/**
 * @notice 区块范围分段抓取辅助工具。
 * @dev 用于将大区间日志查询拆分成多个小区间，降低节点单次查询压力。
 */
/**
 * @notice 默认的日志查询区块步长。
 * @dev 当调用方未显式指定步长时，会按该值对区块区间分片。
 */
export const DEFAULT_LOG_BLOCK_RANGE = 1000n;

/**
 * @notice 以固定区块步长分段收集数据。
 * @param input 分段查询配置对象。
 * @param input.fromBlock 起始区块，默认值为 `0n`。
 * @param input.toBlock 结束区块。
 * @param input.step 每次查询覆盖的区块步长。
 * @param input.fetchRange 单段区块范围的实际抓取函数。
 * @returns 所有区间抓取结果拼接后的数组。
 */
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
