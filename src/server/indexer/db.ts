import { Pool } from "pg";

import { getServerEnv } from "@/lib/env";

let pool: Pool | undefined;

export function getIndexerPool() {
  if (pool) {
    return pool;
  }

  const env = getServerEnv();

  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: 10,
  });

  return pool;
}

