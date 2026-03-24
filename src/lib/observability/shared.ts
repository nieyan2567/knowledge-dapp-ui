export const observabilitySeverities = [
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
] as const;

export type ObservabilitySeverity = (typeof observabilitySeverities)[number];

export type ObservabilityTags = Record<string, string>;
export type ObservabilityContext = Record<string, unknown>;

export type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  cause?: SerializedError;
};

export type RequestContext = {
  requestId: string;
  method?: string;
  url?: string;
  pathname?: string;
  host?: string;
  ip?: string | null;
  userAgent?: string | null;
};

export type ClientErrorReport = {
  message: string;
  source: string;
  severity?: ObservabilitySeverity;
  handled?: boolean;
  fingerprint?: string;
  tags?: ObservabilityTags;
  context?: ObservabilityContext;
  error?: SerializedError;
  pathname?: string;
  url?: string;
  userAgent?: string;
  occurredAt?: string;
};

export function normalizeSeverity(
  severity: ObservabilitySeverity | undefined,
  fallback: ObservabilitySeverity = "error"
) {
  return severity ?? fallback;
}

export function severityValue(severity: ObservabilitySeverity) {
  return observabilitySeverities.indexOf(severity);
}

export function isSeverityAtLeast(
  severity: ObservabilitySeverity,
  threshold: ObservabilitySeverity
) {
  return severityValue(severity) >= severityValue(threshold);
}

export function serializeError(error: unknown, depth = 0): SerializedError | undefined {
  if (!error) {
    return undefined;
  }

  if (depth > 2) {
    return {
      name: "NestedError",
      message: "Error cause depth exceeded",
    };
  }

  if (error instanceof Error) {
    const serialized: SerializedError = {
      name: error.name || "Error",
      message: error.message || "Unknown error",
    };

    if (typeof error.stack === "string" && error.stack.length > 0) {
      serialized.stack = error.stack;
    }

    const code = Reflect.get(error, "code");
    if (typeof code === "string" || typeof code === "number") {
      serialized.code = String(code);
    }

    const cause = Reflect.get(error, "cause");
    if (cause) {
      serialized.cause = serializeError(cause, depth + 1);
    }

    return serialized;
  }

  if (typeof error === "object") {
    const message = Reflect.get(error, "message");
    const name = Reflect.get(error, "name");
    const code = Reflect.get(error, "code");

    return {
      name: typeof name === "string" && name.length > 0 ? name : "NonError",
      message:
        typeof message === "string" && message.length > 0
          ? message
          : JSON.stringify(error),
      code:
        typeof code === "string" || typeof code === "number"
          ? String(code)
          : undefined,
    };
  }

  return {
    name: typeof error,
    message: String(error),
  };
}

export function sanitizeContext(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (depth > 3) {
    return "[Truncated]";
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeContext(item, depth + 1));
  }

  if (typeof value === "object") {
    const output: Record<string, unknown> = {};

    for (const [key, nested] of Object.entries(value)) {
      output[key] = sanitizeContext(nested, depth + 1);
    }

    return output;
  }

  return String(value);
}
