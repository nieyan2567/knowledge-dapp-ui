export const DEFAULT_LOG_BLOCK_RANGE = 1000n;

export async function collectByBlockRange<T>({
	fromBlock = 0n,
	toBlock,
	step = DEFAULT_LOG_BLOCK_RANGE,
	fetchRange,
}: {
	fromBlock?: bigint;
	toBlock: bigint;
	step?: bigint;
	fetchRange: (range: { fromBlock: bigint; toBlock: bigint }) => Promise<T[]>;
}) {
	if (toBlock < fromBlock) {
		return [] as T[];
	}

	const results: T[] = [];

	for (let start = fromBlock; start <= toBlock; start += step) {
		const end = start + step - 1n > toBlock ? toBlock : start + step - 1n;
		const chunk = await fetchRange({ fromBlock: start, toBlock: end });
		results.push(...chunk);
	}

	return results;
}
