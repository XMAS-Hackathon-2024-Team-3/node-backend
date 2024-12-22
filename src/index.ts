import csv from "fast-csv";
import fs from "node:fs";
import path from "node:path";
import stream from "node:stream";
import { promisify } from "node:util";
import { pool } from "./db/db.js";
import { getProvidersByPayment } from "./db/queries/provider.js";
import { createProvidersTableFromReadStream } from "./db/utils/table-queries.js";
import { getFilteredProvidersFromAI } from "./http/requests/ai.js";
import { CurrenciesToDollars } from "./interfaces/currencies.js";
import { PaymentRow, PaymentRowWithProviders } from "./interfaces/payment.js";
import { PaymentMapper } from "./mappers/payment.mapper.js";
import { createCurrencyObjectFromReadStream } from "./utils/currency.js";
import { hashFileName } from "./utils/files.js";
import { countAvgExecutionTime } from "./utils/time.js";

const wait = promisify(setTimeout);

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

async function gracefulShutdown(error?: Error) {
	if (error) {
		console.error(error);
	}
	try {
		await pool.end();
		console.log("Database connection closed.");
	} catch (shutdownError) {
		console.error("Error during database disconnection:", shutdownError);
	}
	process.exit(error ? 1 : 0);
}

let currenciesToDollars: CurrenciesToDollars;

async function main() {
	await wait(5000);

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

		const exRatesReadStream = fs.createReadStream(
			path.resolve(exRatesFilePath)
		);

		currenciesToDollars =
			createCurrencyObjectFromReadStream(exRatesReadStream);

		await createProvidersTableFromReadStream(providersReadStream);

		let executionTimeSum = 0;
		let requestCount = 0;
		let totalProfitUSD = 0;

		const transformStream = csv
			.format<PaymentRow, PaymentRowWithProviders>({
				headers: true,
			})
			.transform(async (row, next) => {
				try {
					const { processedRow, executionTime, expectedProfitUSD } =
						await processPaymentRow(row);

					executionTimeSum += executionTime;
					requestCount++;
					totalProfitUSD += expectedProfitUSD;

					return next(null, processedRow);
				} catch (error) {
					if (error instanceof Error) {
						console.error(error);
						return next(error);
					}
				}
			});

		stream.pipeline(
			paymentsReadStream,
			csv.parse({ headers: true }),
			transformStream,
			resultWriteStream,
			(error) => {
				if (error) {
					console.error(error);
					gracefulShutdown(error);
				} else {
					console.log(`Parsed rows in file ${resultFilePath}`);
					if (requestCount > 0) {
						console.log(
							`Average ML execution time: ${countAvgExecutionTime(
								executionTimeSum,
								requestCount
							)}`
						);
					}
					console.log(`Total profit in USD: ${totalProfitUSD}`);
					gracefulShutdown();
				}
			}
		);

		await pool.query("TRUNCATE TABLE providers");
	} catch (error) {
		if (error instanceof Error) await gracefulShutdown(error);
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

async function processPaymentRow(paymentRow: PaymentRow): Promise<{
	processedRow: PaymentRowWithProviders;
	executionTime: number;
	expectedProfitUSD: number;
}> {
	const payment = PaymentMapper.paymentRowToPayment(paymentRow);

	const providers = await getProvidersByPayment(payment);

	if (providers.length === 0) {
		return {
			processedRow: { ...paymentRow, providersPriority: "" },
			executionTime: 0,
			expectedProfitUSD: 0,
		};
	}

	try {
		const { filteredProviders, executionTime } =
			await getFilteredProvidersFromAI(providers);

		const amountUSD =
			currenciesToDollars[payment.cur as keyof CurrenciesToDollars] *
			payment.amount;

		let netProfitUSD = amountUSD;
		let expectedProfitUSD = amountUSD;

		let weightedProfitUSD = 0;
		for (const provider of filteredProviders) {
			const commission = provider.commission;
			const netProfitUSD = amountUSD * (1 - commission);
			const probability = 1 / filteredProviders.length;
			weightedProfitUSD +=
				netProfitUSD * probability * provider.conversion;
		}
		expectedProfitUSD = weightedProfitUSD;

		return {
			processedRow: {
				...paymentRow,
				providersPriority: filteredProviders.map((p) => p.id).join("-"),
			},
			executionTime,
			expectedProfitUSD,
		};
	} catch (error) {
		throw error;
	}
}

process.on("uncaughtException", gracefulShutdown);
process.on("unhandledRejection", gracefulShutdown);

main();
