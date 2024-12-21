import csv from "fast-csv";
import console from "node:console";
import crypto from "node:crypto";
import fs, { ReadStream } from "node:fs";
import path from "node:path";
import pg from "pg";
import { PaymentRow, PaymentRowWithProviders, Provider } from "./interfaces.js";

const pool = new pg.Pool({
	host: process.env.POSTGRES_HOST,
	port: Number(process.env.POSTGRES_PORT),
	user: process.env.POSTGRES_USER,
	password: process.env.POSTGRES_PASSWORD,
	database: process.env.POSTGRES_DB,
});

function loadFiles() {
	const [
		,
		,
		paymentsFilePath,
		providersFilePath,
		exRatesFilePath,
		resultPath = path.resolve(process.cwd(), "data", "results"),
	] = process.argv;

	if (!paymentsFilePath || !providersFilePath || !exRatesFilePath) {
		console.error("Please provide all the required file paths");
		process.exit(1);
	}

	const filePaths = [paymentsFilePath, providersFilePath, exRatesFilePath];

	for (const filePath of filePaths) {
		if (!fs.existsSync(filePath)) {
			console.error(`File not found: ${filePath}`);
			process.exit(1);
		}
	}

	return { paymentsFilePath, providersFilePath, exRatesFilePath, resultPath };
}

function getFileHash() {
	return crypto.createHash("md5").update(Date.now().toString()).digest("hex");
}

async function main() {
	const { paymentsFilePath, providersFilePath, exRatesFilePath, resultPath } =
		loadFiles();

	const paymentsReadStream = fs.createReadStream(
		path.resolve(paymentsFilePath)
	);

	const providersReadStream = fs.createReadStream(
		path.resolve(providersFilePath)
	);

	const resultWriteStream = fs.createWriteStream(
		path.resolve(resultPath, `result_${getFileHash()}.csv`)
	);

	await createProvidersInSQL(providersReadStream);

	paymentsReadStream
		.pipe(csv.parse({ headers: true }))
		.pipe(
			csv.format<PaymentRow, PaymentRowWithProviders>({ headers: true })
		)
		.transform(async (row, next) => {
			const payment: PaymentRow = {
				cardToken: row.cardToken,
				payment: row.payment,
				amount: row.amount,
				cur: row.cur,
				eventTimeRes: new Date(row.eventTimeRes),
			};

			const providers = await getProvidersByPayment(payment);

			if (providers.length > 0) {
				const body = JSON.stringify(
					providers.map((provider) => ({
						id: provider.ID,
						conversion: provider.CONVERSION,
						avg_time: provider.AVG_TIME,
						commission: provider.COMMISSION,
						limit_min: provider.LIMIT_MIN,
						limit_max: provider.LIMIT_MAX,
					}))
				);

				try {
					const res = await fetch(
						"http://localhost:3000/ai_filtered_data",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json", // Указываем, что отправляем JSON
							},
							body: body,
						}
					);
					const data = await res.json();

					console.log({
						...row,
						providers: providers,
						providersFiltered: data.filteredData,
					});
					return next(null, {
						...row,
						providers: providers.map((p) => p.ID).join("-"),
						providersFiltered: data.filteredData
							.map((p: any) => p.id)
							.join("-"),
					});
				} catch (error) {
					console.error(error);
				}
			}

			return next(null, { ...row, providers: "", providersFiltered: "" });
		})
		.pipe(resultWriteStream)
		.on("end", (rowCount: number) => console.log(`Parsed ${rowCount} rows`))
		.on("error", (error) => {
			console.error(error);
		});

	await pool.query("TRUNCATE TABLE providers");
}

async function getProvidersByPayment(payment: PaymentRow): Promise<Provider[]> {
	try {
		const { rows } = await pool.query(
			`SELECT
    p.*
FROM
    providers p
INNER JOIN (
    SELECT
        id,
        MAX(time) AS max_time
    FROM
        providers
    WHERE
        currency = $1 AND time <= $2 AND $3 BETWEEN min_sum AND max_sum
    GROUP BY
        id
) AS max_times
ON
    p.id = max_times.id AND p.time = max_times.max_time
WHERE
    currency = $1 AND time <= $2 AND $3 BETWEEN min_sum AND max_sum`,
			[payment.cur, payment.eventTimeRes, payment.amount]
		);

		return rows.map((row) => ({
			TIME: row.time,
			ID: row.id,
			CONVERSION: row.conversion,
			AVG_TIME: row.avg_time,
			MIN_SUM: row.min_sum,
			MAX_SUM: row.max_sum,
			LIMIT_MIN: row.limit_min,
			LIMIT_MAX: row.limit_max,
			LIMIT_BY_CARD: row.limit_by_card,
			COMMISSION: row.commission,
			CURRENCY: row.currency,
		}));
	} catch (error) {
		throw error;
	}
}

async function createProvidersInSQL(providersStream: ReadStream) {
	try {
		await pool.query(
			"CREATE TABLE IF NOT EXISTS providers (time TIMESTAMP, id INT, conversion FLOAT, avg_time FLOAT, min_sum FLOAT, max_sum FLOAT, limit_min FLOAT, limit_max FLOAT, commission FLOAT, currency VARCHAR(10), PRIMARY KEY (id, time))"
		);

		providersStream.pipe(
			csv
				.parse({ headers: true })
				.transform((row: any) => {
					// Преобразование каждого поля с нужным типом
					return {
						TIME: new Date(row.TIME),
						ID: Number(row.ID),
						CONVERSION: parseFloat(row.CONVERSION),
						AVG_TIME: parseFloat(row.AVG_TIME),
						MIN_SUM: parseFloat(row.MIN_SUM),
						MAX_SUM: parseFloat(row.MAX_SUM),
						LIMIT_MIN: parseFloat(row.LIMIT_MIN),
						LIMIT_MAX: parseFloat(row.LIMIT_MAX),
						LIMIT_BY_CARD: row.LIMIT_BY_CARD || "-", // Если пусто, ставим дефолтное значение
						COMMISSION: parseFloat(row.COMMISSION),
						CURRENCY: row.CURRENCY,
					} as Provider;
				})
				.on("data", async (row: Provider) => {
					await pool.query(
						"INSERT INTO providers(time, id, conversion, avg_time, min_sum, max_sum, limit_min, limit_max, commission, currency) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (time, id) DO NOTHING",
						[
							row.TIME,
							row.ID,
							row.CONVERSION,
							row.AVG_TIME,
							row.MIN_SUM,
							row.MAX_SUM,
							row.LIMIT_MIN,
							row.LIMIT_MAX,
							row.COMMISSION,
							row.CURRENCY,
						]
					);
				})
				.on("error", (error) => console.error(error))
		);
	} catch (error) {
		console.error(error);
	}
}

main();
