export function countAvgExecutionTime(
	executionTimeSum: number,
	requestCount: number
) {
	return executionTimeSum / requestCount;
}
