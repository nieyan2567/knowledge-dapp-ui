export type Address = `0x${string}`;
export type BigintIsh = bigint | number | string;
export type HexString = `0x${string}`;
export type ContractReadResult<T> = T | undefined;