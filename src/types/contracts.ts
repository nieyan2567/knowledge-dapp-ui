/**
 * @file 合约通用类型模块。
 * @description 定义地址、十六进制字符串和合约读结果等基础类型别名。
 */
/**
 * @notice EVM 地址字符串类型。
 */
export type Address = `0x${string}`;
/**
 * @notice 可被转换为 `bigint` 的输入类型。
 */
export type BigintIsh = bigint | number | string;
/**
 * @notice 十六进制字符串类型。
 */
export type HexString = `0x${string}`;
/**
 * @notice 合约读操作的可选结果类型。
 * @dev 用于表达链上读取尚未返回时的 `undefined` 状态。
 */
export type ContractReadResult<T> = T | undefined;
