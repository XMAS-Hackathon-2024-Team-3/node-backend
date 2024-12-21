import { Payment, PaymentRow } from "../interfaces/payment.js";

export class PaymentMapper {
	static paymentRowToPayment(row: PaymentRow): Payment {
		return {
			eventTimeRes: new Date(row.eventTimeRes),
			amount: Number(row.amount),
			cur: row.cur,
			cardToken: row.cardToken,
			payment: row.payment,
		};
	}
}
