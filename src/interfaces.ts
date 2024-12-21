export interface PaymentRow {
	eventTimeRes: Date;
	amount: number;
	cur: number;
	payment: string;
	cardToken: string;
}

export interface PaymentRowWithProviders extends PaymentRow {
	providers: string;
	providersFiltered: string;
}

export interface Provider {
	TIME: Date;
	ID: number;
	CONVERSION: number;
	AVG_TIME: number;
	MIN_SUM: number;
	MAX_SUM: number;
	LIMIT_MIN: number;
	LIMIT_MAX: number;
	LIMIT_BY_CARD: string;
	COMMISSION: number;
	CURRENCY: string;
}
