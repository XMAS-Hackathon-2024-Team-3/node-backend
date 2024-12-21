import {
	GetFilteredProvidersInputDTO,
	GetFilteredProvidersOutputDTO,
} from "../../interfaces/provider.js";
import { ML_HTTP_PATH } from "../constants.js";

export async function getFilteredProvidersIdFromAI(
	providers: GetFilteredProvidersInputDTO[]
): Promise<number[]> {
	const body = JSON.stringify(providers);

	try {
		const res = await fetch(`${ML_HTTP_PATH}/ai_filtered_data`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: body,
		});
		const data: GetFilteredProvidersOutputDTO = await res.json();

		return data.filteredData.map((p) => p.id);
	} catch (error) {
		throw error;
	}
}
