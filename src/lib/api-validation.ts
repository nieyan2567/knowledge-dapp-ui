/**
 * @notice API 请求体与输入值校验工具。
 * @dev 基于 Zod 提供统一的 JSON 解析、值校验和错误响应构造逻辑。
 */
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

/**
 * @notice 校验成功时的结果结构。
 * @dev 包含 `ok: true` 和经过 schema 解析后的值。
 */
type ValidationSuccess<T> = {
  ok: true;
  value: T;
};

/**
 * @notice 校验失败时的结果结构。
 * @dev 统一返回可直接交给 API Route 的 `NextResponse`。
 */
type ValidationFailure = {
  ok: false;
  response: NextResponse;
};

/**
 * @notice 校验结果联合类型。
 * @dev 用于统一表示解析成功或失败两种状态。
 */
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * @notice 生成标准错误 JSON 响应。
 * @param error 返回给调用方的错误文案。
 * @param status HTTP 状态码，默认值为 400。
 * @returns 包含错误对象的 `NextResponse`。
 */
export function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function getZodErrorMessage(error: ZodError, fallback: string) {
  const firstIssue = error.issues[0];
  return firstIssue?.message || fallback;
}

/**
 * @notice 解析并校验 JSON 请求体。
 * @param req 当前请求对象。
 * @param schema 用于解析请求体的 Zod schema。
 * @param invalidMessage 解析失败时的默认错误文案。
 * @returns 成功时返回解析后的值，失败时返回标准错误响应。
 */
export async function parseJsonBody<T>(
  req: Request,
  schema: ZodType<T>,
  invalidMessage = "请求体格式无效"
): Promise<ValidationResult<T>> {
  try {
    const data = await req.json();
    const result = schema.safeParse(data);

    if (!result.success) {
      return {
        ok: false,
        response: errorResponse(getZodErrorMessage(result.error, invalidMessage)),
      };
    }

    return {
      ok: true,
      value: result.data,
    };
  } catch {
    return {
      ok: false,
      response: errorResponse(invalidMessage),
    };
  }
}

/**
 * @notice 校验任意输入值。
 * @param value 待校验的输入值。
 * @param schema 用于校验该值的 Zod schema。
 * @param invalidMessage 校验失败时的默认错误文案。
 * @returns 成功时返回解析后的值，失败时返回标准错误响应。
 */
export function parseValue<T>(
  value: unknown,
  schema: ZodType<T>,
  invalidMessage: string
): ValidationResult<T> {
  const result = schema.safeParse(value);

  if (!result.success) {
    return {
      ok: false,
      response: errorResponse(getZodErrorMessage(result.error, invalidMessage)),
    };
  }

  return {
    ok: true,
    value: result.data,
  };
}
