import csv from "fast-csv";
import console from "node:console";
import fs from "node:fs";
import path from "node:path";
import { pool } from "./db/db.js";
import { getProvidersByPayment } from "./db/queries/provider.js";
import { createProvidersTableFromReadStream } from "./db/utils/table-queries.js";
import { getFilteredProvidersIdFromAI } from "./http/requests/ai.js";
import { PaymentRow, PaymentRowWithProviders } from "./interfaces/payment.js";
import { PaymentMapper } from "./mappers/payment.mapper.js";
import { hashFileName } from "./utils/files.js";

function loadFiles() {
	const [, , paymentsFilePath, providersFilePath, exRatesFilePath] =
		process.argv;

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

	return { paymentsFilePath, providersFilePath, exRatesFilePath };
}

async function main() {
	try {
		const { paymentsFilePath, providersFilePath, exRatesFilePath } =
			loadFiles();

		const paymentsReadStream = fs.createReadStream(
			path.resolve(paymentsFilePath)
		);

		const providersReadStream = fs.createReadStream(
			path.resolve(providersFilePath)
		);

		const resultFilePath = createResultFilePath();

		const resultWriteStream = fs.createWriteStream(resultFilePath);

		await createProvidersTableFromReadStream(providersReadStream);

		let executionTimeSum = 0;
		let requestCount = 0;

		paymentsReadStream
			.pipe(csv.parse({ headers: true }))
			.pipe(
				csv.format<PaymentRow, PaymentRowWithProviders>({
					headers: true,
				})
			)
			.transform(async (row, next) => {
				try {
					const { processedRow, executionTime } =
						await processPaymentRow(row);

					executionTimeSum += executionTime;
					requestCount++;

					return next(null, processedRow);
				} catch (error) {
					if (error instanceof Error) {
						console.error(error);
						return next(error);
					}
				}
			})
			.pipe(resultWriteStream)
			.on("end", (rowCount: number) => {
				console.log(
					`Parsed ${rowCount} rows in file ${resultFilePath}`
				);
				console.log(
					`Total execution time: ${executionTimeSum / requestCount}ms`
				);
			})
			.on("error", (error) => {
				console.error(error);
			});

		await pool.query("TRUNCATE TABLE providers");
	} catch (error) {
		console.error(error);
	}
}

function createResultFilePath() {
	if (
		!fs.existsSync(
			path.resolve(import.meta.dirname, "..", "data", "results")
		)
	) {
		if (!fs.existsSync(path.resolve(import.meta.dirname, "..", "data"))) {
			fs.mkdirSync(path.resolve(import.meta.dirname, "..", "data"));
		}

		fs.mkdirSync(
			path.resolve(import.meta.dirname, "..", "data", "results")
		);
	}

	const resultPath = path.resolve(
		import.meta.dirname,
		"..",
		"data",
		"results"
	);
	const resultFileName = `result_${hashFileName()}.csv`;

	return path.resolve(resultPath, resultFileName);
}

async function processPaymentRow(
	paymentRow: PaymentRow
): Promise<{ processedRow: PaymentRowWithProviders; executionTime: number }> {
	const payment = PaymentMapper.paymentRowToPayment(paymentRow);

	const providers = await getProvidersByPayment(payment);

	if (providers.length === 0) {
		return {
			processedRow: { ...paymentRow, providersPriority: "" },
			executionTime: 0,
		};
	}

	try {
		const { filteredProvidersId, executionTime } =
			await getFilteredProvidersIdFromAI(providers);

		return {
			processedRow: {
				...paymentRow,
				providersPriority: filteredProvidersId.join("-"),
			},
			executionTime,
		};
	} catch (error) {
		throw error;
	}
}

main();
