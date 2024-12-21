import { Payment } from "../../interfaces/payment.js";
import { Provider } from "../../interfaces/provider.js";
import { pool } from "../db.js";

export async function getProvidersByPayment(
	payment: Payment
): Promise<Provider[]> {
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
