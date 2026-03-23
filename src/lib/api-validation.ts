import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

type ValidationSuccess<T> = {
  ok: true;
  value: T;
};

type ValidationFailure = {
  ok: false;
  response: NextResponse;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export function errorResponse(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function getZodErrorMessage(error: ZodError, fallback: string) {
  const firstIssue = error.issues[0];
  return firstIssue?.message || fallback;
}

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
