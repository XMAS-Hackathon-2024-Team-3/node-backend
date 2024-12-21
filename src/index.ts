import csv from "fast-csv";
import console from "node:console";
import fs from "node:fs";
import path from "node:path";
import { pool } from "./db/db.js";
import { createProvidersTableFromReadStream } from "./db/utils/table-queries.js";
import {
	Payment,
	PaymentRow,
	PaymentRowWithProviders,
} from "./interfaces/payment.js";
import {
	GetFilteredProvidersInputDTO,
	GetFilteredProvidersOutputDTO,
	Provider,
} from "./interfaces/provider.js";
import { PaymentMapper } from "./mappers/payment.mapper.js";
import { hashFileName } from "./utils/files.js";

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

async function main() {
	try {
		const {
			paymentsFilePath,
			providersFilePath,
			exRatesFilePath,
			resultPath,
		} = loadFiles();

		const paymentsReadStream = fs.createReadStream(
			path.resolve(paymentsFilePath)
		);

		const providersReadStream = fs.createReadStream(
			path.resolve(providersFilePath)
		);

		const resultFileName = `result_${hashFileName()}.csv`;
		const resultFile = path.resolve(resultPath, resultFileName);
		const resultWriteStream = fs.createWriteStream(resultFile);

		await createProvidersTableFromReadStream(providersReadStream);

		paymentsReadStream
			.pipe(csv.parse({ headers: true }))
			.pipe(
				csv.format<PaymentRow, PaymentRowWithProviders>({
					headers: true,
				})
			)
			.transform(async (row, next) => {
				try {
					const processedRow = await processPaymentRow(row);

					return next(null, processedRow);
				} catch (error) {
					if (error instanceof Error) {
						console.error(error);
						return next(error);
					}
				}
			})
			.pipe(resultWriteStream)
			.on("end", (rowCount: number) =>
				console.log(`Parsed ${rowCount} rows in file ${resultFile}`)
			)
			.on("error", (error) => {
				console.error(error);
			});

		await pool.query("TRUNCATE TABLE providers");
	} catch (error) {
		console.error(error);
	}
}

async function processPaymentRow(
	paymentRow: PaymentRow
): Promise<PaymentRowWithProviders> {
	const payment = PaymentMapper.paymentRowToPayment(paymentRow);

	const providers = await getProvidersByPayment(payment);

	if (providers.length === 0) {
		return { ...paymentRow, providersPriority: "" };
	}

	try {
		const filteredProvidersId = await getFilteredProvidersIdFromAI(
			providers
		);

		return {
			...paymentRow,
			providersPriority: filteredProvidersId.join("-"),
		};
	} catch (error) {
		throw error;
	}
}

async function getProvidersByPayment(payment: Payment): Promise<Provider[]> {
	try {
		const { rows } = await pool.query(
			`SELECT p.* FROM providers p 
				INNER JOIN (SELECT id, MAX(time) AS max_time FROM providers
					WHERE
					currency = $1 AND time <= $2 AND $3 BETWEEN min_sum AND max_sum
    				GROUP BY id) AS max_times
				ON p.id = max_times.id AND p.time = max_times.max_time
				WHERE currency = $1 AND time <= $2 AND $3 BETWEEN min_sum AND max_sum`,
			[payment.cur, payment.eventTimeRes, payment.amount]
		);

		return rows as Provider[];
	} catch (error) {
		throw error;
	}
}

async function getFilteredProvidersIdFromAI(
	providers: GetFilteredProvidersInputDTO[]
): Promise<number[]> {
	const body = JSON.stringify(providers);

	try {
		const res = await fetch("http://localhost:3000/ai_filtered_data", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: body,
		});
		const data: GetFilteredProvidersOutputDTO = await res.json();

		return data.filteredData.map((p) => p.id);
	} catch (error) {
		throw error;
	}
}

main();
