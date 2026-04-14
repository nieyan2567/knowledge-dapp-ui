import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(repoRoot, "migrations");

export function parseDotEnv(content) {
  const result = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}

export function hashMigration(sql) {
  return createHash("sha256").update(sql).digest("hex");
}

export async function readMigrationFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

export function parseCliArgs(argv) {
  const statusOnly = argv.includes("--status");
  const envFileIndex = argv.findIndex((arg) => arg === "--env-file");
  const envFile =
    envFileIndex >= 0 && argv[envFileIndex + 1]
      ? argv[envFileIndex + 1]
      : undefined;

  if (envFileIndex >= 0 && !envFile) {
    throw new Error("--env-file requires a filename, for example --env-file .env.production.local");
  }

  return {
    statusOnly,
    envFile,
  };
}

function loadEnvFile(filename) {
  const fullPath = path.join(repoRoot, filename);
  if (!existsSync(fullPath)) return;

  const parsed = parseDotEnv(readFileSync(fullPath, "utf8"));

  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function loadDefaultEnvFiles() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");
}

function loadEnv(cliEnvFile) {
  if (cliEnvFile) {
    loadEnvFile(cliEnvFile);
    return;
  }

  loadDefaultEnvFiles();
}

async function ensureMigrationTable(pool) {
  await pool.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      checksum text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function getAppliedMigrations(pool) {
  const result = await pool.query(
    "select filename, checksum, applied_at from schema_migrations order by filename asc"
  );

  return new Map(result.rows.map((row) => [row.filename, row]));
}

async function applyMigration(pool, filename, sql, checksum) {
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(sql);
    await client.query(
      `
        insert into schema_migrations (filename, checksum)
        values ($1, $2)
      `,
      [filename, checksum]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function run() {
  const { statusOnly, envFile } = parseCliArgs(process.argv.slice(2));

  loadEnv(envFile);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Set it in your environment or .env.local before running migrations.");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 5000,
  });

  try {
    await ensureMigrationTable(pool);
    const appliedMigrations = await getAppliedMigrations(pool);
    const migrationFiles = await readMigrationFiles(migrationsDir);

    if (migrationFiles.length === 0) {
      console.log("No migration files found.");
      return;
    }

    let appliedCount = 0;

    for (const filename of migrationFiles) {
      const fullPath = path.join(migrationsDir, filename);
      const sql = await readFile(fullPath, "utf8");
      const checksum = hashMigration(sql);
      const existing = appliedMigrations.get(filename);

      if (existing) {
        if (existing.checksum !== checksum) {
          throw new Error(`Migration checksum mismatch for ${filename}. Update the migration history or add a new migration instead of editing an applied one.`);
        }

        console.log(`[skip] ${filename}`);
        continue;
      }

      if (statusOnly) {
        console.log(`[pending] ${filename}`);
        continue;
      }

      await applyMigration(pool, filename, sql, checksum);
      appliedCount += 1;
      console.log(`[apply] ${filename}`);
    }

    if (statusOnly) {
      console.log("Migration status check complete.");
    } else {
      console.log(`Migration run complete. Applied ${appliedCount} migration(s).`);
    }
  } finally {
    await pool.end();
  }
}

const isEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isEntrypoint) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
