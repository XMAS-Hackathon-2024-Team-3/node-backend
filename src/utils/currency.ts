import csv from "fast-csv";
import { ReadStream } from "fs";
import { CurrenciesToDollars, CurrencyRow } from "../interfaces/currencies.js";
export function createCurrencyObjectFromReadStream(
	currencyStream: ReadStream
): CurrenciesToDollars {
	const currencies: CurrenciesToDollars = {
		AZN: 0,
		EUR: 0,
		HKD: 0,
		KRW: 0,
		AUD: 0,
		MXN: 0,
		PEN: 0,
		RUB: 0,
		BRL: 0,
		JPY: 0,
		KZT: 0,
		NGN: 0,
		PHP: 0,
		ZAR: 0,
		MYR: 0,
		TJS: 0,
		KES: 0,
		THB: 0,
		TRY: 0,
		UZS: 0,
		USD: 0,
		GHS: 0,
	};

	currencyStream
		.pipe(csv.parse({ headers: true }))
		.on("data", (row: CurrencyRow) => {
			// @ts-ignore
			currencies[row.destination] = parseFloat(row.rate);
		});

	return currencies;
}
