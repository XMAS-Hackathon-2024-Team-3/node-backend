import csv from "fast-csv";
import console from "node:console";
import fs from "node:fs";
import path from "node:path";
import { pool } from "./db/db.js";
import { getProvidersByPayment } from "./db/queries/provider.js";
import { createProvidersTableFromReadStream } from "./db/utils/table-queries.js";
import { getFilteredProvidersIdFromAI } from "./http/requests/aiRequests.js";
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
				console.log(`Parsed ${rowCount} rows in file ${resultFilePath}`)
			)
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

main();
