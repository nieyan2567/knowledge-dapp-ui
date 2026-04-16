/**
 * @file API 测试请求工具模块。
 * @description 提供构造 `NextRequest` 和 JSON 请求的测试辅助函数。
 */
import { NextRequest } from "next/server";

/**
 * @notice 创建一个用于 API 测试的 `NextRequest`。
 * @param input 请求地址。
 * @param init 原始请求初始化参数。
 * @returns 构造完成的 `NextRequest` 对象。
 */
export function createNextRequest(input: string, init?: RequestInit) {
  return new NextRequest(new Request(input, init));
}

/**
 * @notice 创建一个携带 JSON 请求体的测试请求。
 * @param input 请求地址。
 * @param method HTTP 方法。
 * @param body 要序列化为 JSON 的请求体。
 * @param init 除 `method` 和 `body` 外的其他请求初始化参数。
 * @returns 构造完成的 `NextRequest` 对象。
 */
export function createJsonRequest(
  input: string,
  method: string,
  body: unknown,
  init?: Omit<RequestInit, "method" | "body">
) {
  return createNextRequest(input, {
    ...init,
    method,
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
}
