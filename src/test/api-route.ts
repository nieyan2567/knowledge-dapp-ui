import { NextRequest } from "next/server";

export function createNextRequest(input: string, init?: RequestInit) {
  return new NextRequest(new Request(input, init));
}

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
