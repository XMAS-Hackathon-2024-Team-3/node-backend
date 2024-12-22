import {
	FilteredProviderDTO,
	GetFilteredProvidersInputDTO,
	GetFilteredProvidersOutputDTO,
	Provider,
} from "../../interfaces/provider.js";
import { ML_HTTP_PATH } from "../constants.js";

export async function getFilteredProvidersFromAI(
	providers: GetFilteredProvidersInputDTO[]
): Promise<{
	filteredProviders: FilteredProviderDTO[];
	executionTime: number;
}> {
	const body = JSON.stringify(providers);

	try {
		const res = await fetch(`http://${ML_HTTP_PATH}/ai_filtered_data`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: body,
		});
		const data: GetFilteredProvidersOutputDTO = await res.json();

		return {
			filteredProviders: data.filteredData,
			executionTime: data.executionTime,
		};
	} catch (error) {
		throw error;
	}
}
