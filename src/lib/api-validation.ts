import { NextResponse } from "next/server";

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

export async function parseJsonObject(
  req: Request,
  invalidMessage = "请求体格式无效"
): Promise<ValidationResult<Record<string, unknown>>> {
  try {
    const data = await req.json();

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return {
        ok: false,
        response: errorResponse(invalidMessage),
      };
    }

    return {
      ok: true,
      value: data as Record<string, unknown>,
    };
  } catch {
    return {
      ok: false,
      response: errorResponse(invalidMessage),
    };
  }
}

export function parseRequiredString(
  value: unknown,
  error: string,
  options?: {
    maxLength?: number;
    pattern?: RegExp;
  }
): ValidationResult<string> {
  if (typeof value !== "string") {
    return {
      ok: false,
      response: errorResponse(error),
    };
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return {
      ok: false,
      response: errorResponse(error),
    };
  }

  if (options?.maxLength && trimmed.length > options.maxLength) {
    return {
      ok: false,
      response: errorResponse(error),
    };
  }

  if (options?.pattern && !options.pattern.test(trimmed)) {
    return {
      ok: false,
      response: errorResponse(error),
    };
  }

  return {
    ok: true,
    value: trimmed,
  };
}

export function parseFile(
  value: FormDataEntryValue | null,
  error = "未检测到上传文件"
): ValidationResult<File> {
  if (!(value instanceof File)) {
    return {
      ok: false,
      response: errorResponse(error),
    };
  }

  if (!value.name.trim() || value.size <= 0) {
    return {
      ok: false,
      response: errorResponse(error),
    };
  }

  return {
    ok: true,
    value,
  };
}
