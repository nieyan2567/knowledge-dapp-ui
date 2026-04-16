/**
 * @notice 可观测性共享类型与序列化工具。
 * @dev 定义日志级别、错误序列化结构和上下文清洗逻辑，供前后端共用。
 */
/**
 * @notice 可观测性支持的严重级别列表。
 * @dev 顺序同时用于严重级别比较。
 */
export const observabilitySeverities = [
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
] as const;

/**
 * @notice 可观测性严重级别类型。
 * @dev 取值范围来自 `observabilitySeverities`。
 */
export type ObservabilitySeverity = (typeof observabilitySeverities)[number];

/**
 * @notice 可观测性标签集合类型。
 * @dev 适合承载低维度、可索引的字符串标签。
 */
export type ObservabilityTags = Record<string, string>;
/**
 * @notice 可观测性上下文类型。
 * @dev 用于承载结构化但可序列化的附加数据。
 */
export type ObservabilityContext = Record<string, unknown>;

/**
 * @notice 序列化后的错误结构。
 * @dev 用于将 Error 或非 Error 异常对象统一转换为可传输格式。
 */
export type SerializedError = {
  name: string;
  message: string;
  stack?: string;
  code?: string;
  cause?: SerializedError;
};

/**
 * @notice 请求上下文结构。
 * @dev 记录请求 ID、方法、路径、来源主机和客户端信息。
 */
export type RequestContext = {
  requestId: string;
  method?: string;
  url?: string;
  pathname?: string;
  host?: string;
  ip?: string | null;
  userAgent?: string | null;
};

/**
 * @notice 客户端错误上报结构。
 * @dev 供浏览器端错误上报接口与服务端接收端共享。
 */
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

/**
 * @notice 归一化严重级别。
 * @param severity 待归一化的严重级别。
 * @param fallback 当输入为空时使用的默认级别。
 * @returns 最终可用的严重级别。
 */
export function normalizeSeverity(
  severity: ObservabilitySeverity | undefined,
  fallback: ObservabilitySeverity = "error"
) {
  return severity ?? fallback;
}

/**
 * @notice 获取严重级别在级别序列中的顺序值。
 * @param severity 严重级别。
 * @returns 对应的整数顺序值。
 */
export function severityValue(severity: ObservabilitySeverity) {
  return observabilitySeverities.indexOf(severity);
}

/**
 * @notice 判断严重级别是否达到某个阈值。
 * @param severity 当前严重级别。
 * @param threshold 阈值严重级别。
 * @returns 若当前级别不低于阈值则返回 `true`。
 */
export function isSeverityAtLeast(
  severity: ObservabilitySeverity,
  threshold: ObservabilitySeverity
) {
  return severityValue(severity) >= severityValue(threshold);
}

/**
 * @notice 将未知错误对象序列化为可传输结构。
 * @param error 待序列化的错误对象。
 * @param depth 当前递归深度。
 * @returns 可序列化的错误结构；若输入为空则返回 `undefined`。
 */
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

/**
 * @notice 递归清洗上下文对象，确保可安全序列化。
 * @param value 待清洗的值。
 * @param depth 当前递归深度。
 * @returns 适合日志记录和传输的结构化值。
 */
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
