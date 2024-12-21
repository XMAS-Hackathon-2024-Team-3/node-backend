import { Provider, ProviderRow } from "../interfaces/provider.js";

export class ProviderMapper {
	static providerRowToProvider(row: ProviderRow): Provider {
		return {
			time: new Date(row.TIME),
			id: Number(row.ID),
			conversion: Number(row.CONVERSION),
			avg_time: Number(row.AVG_TIME),
			min_sum: Number(row.MIN_SUM),
			max_sum: Number(row.MAX_SUM),
			limit_min: Number(row.LIMIT_MIN),
			limit_max: Number(row.LIMIT_MAX),
			commission: Number(row.COMMISSION),
			currency: row.CURRENCY,
		};
	}
}
