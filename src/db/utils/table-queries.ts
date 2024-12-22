import csv from "fast-csv";
import { ReadStream } from "fs";
import { ProviderRow } from "../../interfaces/provider.js";
import { ProviderMapper } from "../../mappers/provider.mapper.js";
import { pool } from "../db.js";

export async function createProvidersTableFromReadStream(
	providersStream: ReadStream
) {
	try {
		await pool.query(
			"CREATE TABLE IF NOT EXISTS providers (time TIMESTAMP, id INT, conversion FLOAT, avg_time FLOAT, min_sum FLOAT, max_sum FLOAT, limit_min FLOAT, limit_max FLOAT, commission FLOAT, currency VARCHAR(10), PRIMARY KEY (id, time))"
		);

		providersStream
			.pipe(csv.parse<ProviderRow, ProviderRow>({ headers: true }))
			.on("data", async (row: ProviderRow) => {
				try {
					const provider = ProviderMapper.providerRowToProvider(row);

					await pool.query(
						"INSERT INTO providers(time, id, conversion, avg_time, min_sum, max_sum, limit_min, limit_max, commission, currency) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT (time, id) DO NOTHING",
						[
							provider.time,
							provider.id,
							provider.conversion,
							provider.avg_time,
							provider.min_sum,
							provider.max_sum,
							provider.limit_min,
							provider.limit_max,
							provider.commission,
							provider.currency,
						]
					);
				} catch (error) {
					console.error("Error inserting row:", error);
					throw error;
				}
			})
			.on("error", (error) => {
				console.error("Stream error:", error);
				providersStream.destroy();
				throw error;
			});
	} catch (error) {
		console.error("Error creating table:", error);
		throw error;
	}
}
