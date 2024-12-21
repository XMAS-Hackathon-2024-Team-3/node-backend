export interface PaymentRow {
	eventTimeRes: string;
	amount: string;
	cur: string;
	payment: string;
	cardToken: string;
}

export interface PaymentRowWithProviders extends PaymentRow {
	providersPriority: string;
}

export interface Payment {
	eventTimeRes: Date;
	amount: number;
	cur: string;
	payment: string;
	cardToken: string;
	providersPriority?: string;
}
