import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const positiveIntWithDefault = (defaultValue: number) =>
  z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().int().positive().optional()
  ).transform((value) => value ?? defaultValue);

const urlWithDefault = (defaultValue: string) =>
  z.preprocess(
    emptyStringToUndefined,
    z.string().url().optional()
  ).transform((value) => value ?? defaultValue);

const positiveNumberStringWithDefault = (defaultValue: string) =>
  z.preprocess(
    emptyStringToUndefined,
    z
      .string()
      .trim()
      .refine((value) => Number(value) > 0, "Must be a positive number")
      .optional()
  ).transform((value) => value ?? defaultValue);

const numberWithRangeDefault = (
  defaultValue: number,
  constraints: { min: number; max: number }
) =>
  z.preprocess(
    emptyStringToUndefined,
    z.coerce.number().min(constraints.min).max(constraints.max).optional()
  ).transform((value) => value ?? defaultValue);

const optionalUrl = z.preprocess(
  emptyStringToUndefined,
  z.string().url().optional()
);

const productionRequiredPublicUrls = [
  "NEXT_PUBLIC_BESU_RPC_URL",
  "NEXT_PUBLIC_BLOCKSCOUT_URL",
  "NEXT_PUBLIC_IPFS_GATEWAY_URL",
] as const;

const productionRequiredServerUrls = [
  "IPFS_API_URL",
  "IPFS_GATEWAY_URL",
] as const;

const publicEnvSchema = z.object({
  NEXT_PUBLIC_BESU_RPC_URL: urlWithDefault("http://127.0.0.1:8545"),
  NEXT_PUBLIC_BESU_CHAIN_ID: positiveIntWithDefault(20260),
  NEXT_PUBLIC_BLOCKSCOUT_URL: urlWithDefault("http://127.0.0.1:8182"),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().trim().default(""),
  NEXT_PUBLIC_IPFS_GATEWAY_URL: urlWithDefault("http://127.0.0.1:8080/ipfs"),
});

const serverEnvSchema = publicEnvSchema
  .extend({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    UPLOAD_PROVIDER: z.enum(["local"]).default("local"),
    IPFS_API_URL: urlWithDefault("http://127.0.0.1:5001"),
    IPFS_GATEWAY_URL: urlWithDefault("http://127.0.0.1:8080/ipfs"),
    UPLOAD_AUTH_SECRET: z.preprocess(
      emptyStringToUndefined,
      z.string().min(1).optional()
    ),
    UPLOAD_AUTH_NONCE_TTL_SECONDS: positiveIntWithDefault(300),
    UPLOAD_AUTH_SESSION_TTL_SECONDS: positiveIntWithDefault(2 * 60 * 60),
    UPLOAD_MAX_FILE_SIZE_BYTES: positiveIntWithDefault(512 * 1024 * 1024),
    REDIS_URL: optionalUrl,
    API_RATE_LIMIT_WINDOW_SECONDS: positiveIntWithDefault(60),
    API_RATE_LIMIT_MAX: positiveIntWithDefault(120),
    OBS_SERVICE_NAME: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().min(1).optional()
    ).transform((value) => value ?? "knowledge-dapp-ui"),
    OBS_DEPLOYMENT_ENV: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().min(1).optional()
    ).transform((value) => value ?? "development"),
    OBS_LOG_LEVEL: z
      .enum(["debug", "info", "warn", "error", "fatal"])
      .default("info"),
    OBS_ALERT_WEBHOOK_URL: optionalUrl,
    OBS_ALERT_WEBHOOK_TOKEN: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().min(1).optional()
    ),
    OBS_ALERT_MIN_SEVERITY: z
      .enum(["debug", "info", "warn", "error", "fatal"])
      .default("error"),
    OBS_ALERT_DEDUP_WINDOW_SECONDS: positiveIntWithDefault(300),
    OBS_CLIENT_ERROR_SAMPLE_RATE: numberWithRangeDefault(1, {
      min: 0,
      max: 1,
    }),
    FAUCET_PRIVATE_KEY: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .regex(/^0x[0-9a-fA-F]+$/, "Must be a 0x-prefixed hex string")
        .optional()
    ),
    FAUCET_AUTH_SIGNER_PRIVATE_KEY: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .regex(/^0x[0-9a-fA-F]+$/, "Must be a 0x-prefixed hex string")
        .optional()
    ),
    FAUCET_RELAYER_PRIVATE_KEY: z.preprocess(
      emptyStringToUndefined,
      z
        .string()
        .regex(/^0x[0-9a-fA-F]+$/, "Must be a 0x-prefixed hex string")
        .optional()
    ),
    REBALANCE_API_TOKEN: z.preprocess(
      emptyStringToUndefined,
      z.string().trim().min(1).optional()
    ),
    FAUCET_AMOUNT: positiveNumberStringWithDefault("2"),
    FAUCET_MIN_BALANCE: positiveNumberStringWithDefault("1"),
    FAUCET_COOLDOWN_HOURS: positiveIntWithDefault(24),
    FAUCET_LOCK_TTL_SECONDS: positiveIntWithDefault(60),
    FAUCET_NONCE_TTL_SECONDS: positiveIntWithDefault(300),
    FAUCET_NONCE_RATE_LIMIT_WINDOW_SECONDS: positiveIntWithDefault(60),
    FAUCET_NONCE_RATE_LIMIT_MAX: positiveIntWithDefault(5),
    FAUCET_CLAIM_RATE_LIMIT_WINDOW_SECONDS: positiveIntWithDefault(3600),
    FAUCET_CLAIM_RATE_LIMIT_MAX: positiveIntWithDefault(10),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === "production" && !env.UPLOAD_AUTH_SECRET) {
      ctx.addIssue({
        code: "custom",
        path: ["UPLOAD_AUTH_SECRET"],
        message: "Required when NODE_ENV=production",
      });
    }

    if (env.NODE_ENV === "production" && !env.OBS_ALERT_WEBHOOK_URL) {
      ctx.addIssue({
        code: "custom",
        path: ["OBS_ALERT_WEBHOOK_URL"],
        message: "Required when NODE_ENV=production",
      });
    }
  });

type PublicEnvSchema = z.infer<typeof publicEnvSchema>;
type ServerEnvSchema = z.infer<typeof serverEnvSchema>;
type PublicUrlKey = (typeof productionRequiredPublicUrls)[number];
type ServerUrlKey = (typeof productionRequiredServerUrls)[number];

function formatEnvErrors(scope: string, error: z.ZodError) {
  const details = error.issues
    .map((issue) => {
      const path = issue.path.join(".") || "<root>";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

  return `Invalid ${scope} environment variables: ${details}`;
}

function isLocalOnlyUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.hostname === "127.0.0.1" ||
      url.hostname === "localhost" ||
      url.hostname === "::1"
    );
  } catch {
    return false;
  }
}

function assertProductionUrlConfig(
  rawEnv: Record<string, string | undefined>,
  parsedEnv: Partial<Record<PublicUrlKey | ServerUrlKey, string>>,
  scope: "public" | "server"
) {
  if (rawEnv.NODE_ENV !== "production") {
    return;
  }

  const requiredKeys =
    scope === "public" ? productionRequiredPublicUrls : productionRequiredServerUrls;

  for (const key of requiredKeys) {
    const rawValue = rawEnv[key];
    const parsedValue = parsedEnv[key];

    if (!rawValue?.trim()) {
      throw new Error(
        `Invalid ${scope} environment variables: ${key}: Required when NODE_ENV=production`
      );
    }

    if (parsedValue && isLocalOnlyUrl(parsedValue)) {
      throw new Error(
        `Invalid ${scope} environment variables: ${key}: Must not point to localhost when NODE_ENV=production`
      );
    }
  }
}

function parseEnv<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  rawEnv: Record<string, string | undefined>,
  scope: string
): z.infer<TSchema> {
  const result = schema.safeParse(rawEnv);

  if (!result.success) {
    throw new Error(formatEnvErrors(scope, result.error));
  }

  return result.data;
}

function getPublicEnvSource() {
  return {
    NEXT_PUBLIC_BESU_RPC_URL: process.env.NEXT_PUBLIC_BESU_RPC_URL,
    NEXT_PUBLIC_BESU_CHAIN_ID: process.env.NEXT_PUBLIC_BESU_CHAIN_ID,
    NEXT_PUBLIC_BLOCKSCOUT_URL: process.env.NEXT_PUBLIC_BLOCKSCOUT_URL,
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:
      process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
    NEXT_PUBLIC_IPFS_GATEWAY_URL: process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL,
  };
}

function getServerEnvSource() {
  return {
    ...getPublicEnvSource(),
    NODE_ENV: process.env.NODE_ENV,
    UPLOAD_PROVIDER: process.env.UPLOAD_PROVIDER,
    IPFS_API_URL: process.env.IPFS_API_URL,
    IPFS_GATEWAY_URL: process.env.IPFS_GATEWAY_URL,
    UPLOAD_AUTH_SECRET: process.env.UPLOAD_AUTH_SECRET,
    UPLOAD_AUTH_NONCE_TTL_SECONDS: process.env.UPLOAD_AUTH_NONCE_TTL_SECONDS,
    UPLOAD_AUTH_SESSION_TTL_SECONDS:
      process.env.UPLOAD_AUTH_SESSION_TTL_SECONDS,
    UPLOAD_MAX_FILE_SIZE_BYTES: process.env.UPLOAD_MAX_FILE_SIZE_BYTES,
    REDIS_URL: process.env.REDIS_URL,
    API_RATE_LIMIT_WINDOW_SECONDS: process.env.API_RATE_LIMIT_WINDOW_SECONDS,
    API_RATE_LIMIT_MAX: process.env.API_RATE_LIMIT_MAX,
    OBS_SERVICE_NAME: process.env.OBS_SERVICE_NAME,
    OBS_DEPLOYMENT_ENV: process.env.OBS_DEPLOYMENT_ENV,
    OBS_LOG_LEVEL: process.env.OBS_LOG_LEVEL,
    OBS_ALERT_WEBHOOK_URL: process.env.OBS_ALERT_WEBHOOK_URL,
    OBS_ALERT_WEBHOOK_TOKEN: process.env.OBS_ALERT_WEBHOOK_TOKEN,
    OBS_ALERT_MIN_SEVERITY: process.env.OBS_ALERT_MIN_SEVERITY,
    OBS_ALERT_DEDUP_WINDOW_SECONDS:
      process.env.OBS_ALERT_DEDUP_WINDOW_SECONDS,
    OBS_CLIENT_ERROR_SAMPLE_RATE: process.env.OBS_CLIENT_ERROR_SAMPLE_RATE,
    FAUCET_PRIVATE_KEY: process.env.FAUCET_PRIVATE_KEY,
    FAUCET_AUTH_SIGNER_PRIVATE_KEY: process.env.FAUCET_AUTH_SIGNER_PRIVATE_KEY,
    FAUCET_RELAYER_PRIVATE_KEY: process.env.FAUCET_RELAYER_PRIVATE_KEY,
    REBALANCE_API_TOKEN: process.env.REBALANCE_API_TOKEN,
    FAUCET_AMOUNT: process.env.FAUCET_AMOUNT,
    FAUCET_MIN_BALANCE: process.env.FAUCET_MIN_BALANCE,
    FAUCET_COOLDOWN_HOURS: process.env.FAUCET_COOLDOWN_HOURS,
    FAUCET_LOCK_TTL_SECONDS: process.env.FAUCET_LOCK_TTL_SECONDS,
    FAUCET_NONCE_TTL_SECONDS: process.env.FAUCET_NONCE_TTL_SECONDS,
    FAUCET_NONCE_RATE_LIMIT_WINDOW_SECONDS:
      process.env.FAUCET_NONCE_RATE_LIMIT_WINDOW_SECONDS,
    FAUCET_NONCE_RATE_LIMIT_MAX: process.env.FAUCET_NONCE_RATE_LIMIT_MAX,
    FAUCET_CLAIM_RATE_LIMIT_WINDOW_SECONDS:
      process.env.FAUCET_CLAIM_RATE_LIMIT_WINDOW_SECONDS,
    FAUCET_CLAIM_RATE_LIMIT_MAX: process.env.FAUCET_CLAIM_RATE_LIMIT_MAX,
  };
}

export function getPublicEnv(): PublicEnvSchema {
  const rawEnv = {
    ...getPublicEnvSource(),
    NODE_ENV: process.env.NODE_ENV,
  };
  const parsed = parseEnv(publicEnvSchema, rawEnv, "public");
  assertProductionUrlConfig(rawEnv, parsed, "public");
  return parsed;
}

export function getServerEnv(): ServerEnvSchema {
  if (typeof window !== "undefined") {
    throw new Error("Server environment variables are not available in the browser");
  }

  const rawEnv = getServerEnvSource();
  const parsed = parseEnv(serverEnvSchema, rawEnv, "server");
  assertProductionUrlConfig(rawEnv, parsed, "public");
  assertProductionUrlConfig(rawEnv, parsed, "server");
  return parsed;
}

export type PublicEnv = PublicEnvSchema;
export type ServerEnv = ServerEnvSchema;
