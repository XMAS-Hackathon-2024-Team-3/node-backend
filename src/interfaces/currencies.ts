export interface CurrencyRow {
	rate: string;
	destination: CurrenciesEnum;
}

export enum CurrenciesEnum {
	AZN,
	EUR,
	HKD,
	KRW,
	AUD,
	MXN,
	PEN,
	RUB,
	BRL,
	JPY,
	KZT,
	NGN,
	PHP,
	ZAR,
	MYR,
	TJS,
	KES,
	THB,
	TRY,
	UZS,
	USD,
	GHS,
}

export interface CurrenciesToDollars {
	AZN: number;
	EUR: number;
	HKD: number;
	KRW: number;
	AUD: number;
	MXN: number;
	PEN: number;
	RUB: number;
	BRL: number;
	JPY: number;
	KZT: number;
	NGN: number;
	PHP: number;
	ZAR: number;
	MYR: number;
	TJS: number;
	KES: number;
	THB: number;
	TRY: number;
	UZS: number;
	USD: number;
	GHS: number;
}
