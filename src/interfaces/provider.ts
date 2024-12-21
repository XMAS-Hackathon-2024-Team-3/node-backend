export interface ProviderRow {
	TIME: string;
	ID: string;
	CONVERSION: string;
	AVG_TIME: string;
	MIN_SUM: string;
	MAX_SUM: string;
	LIMIT_MIN: string;
	LIMIT_MAX: string;
	LIMIT_BY_CARD: string;
	COMMISSION: string;
	CURRENCY: string;
}

export interface Provider {
	time: Date;
	id: number;
	conversion: number;
	avg_time: number;
	min_sum: number;
	max_sum: number;
	limit_min: number;
	limit_max: number;
	commission: number;
	currency: string;
}

export interface GetFilteredProvidersInputDTO {
	id: number;
	conversion: number;
	avg_time: number;
	limit_min: number;
	limit_max: number;
}

export interface FilteredProviderDTO {
	id: number;
	conversion: number;
	avg_time: number;
	limit_min: number;
	limit_max: number;
}

export interface GetFilteredProvidersOutputDTO {
	filteredData: FilteredProviderDTO[];
	executionTime: number;
}
