import { describe, expect, it } from "vitest";

import { hashMigration, parseCliArgs, parseDotEnv } from "./migrate.mjs";

describe("migrate script helpers", () => {
  it("parses dotenv-style content and ignores comments", () => {
    expect(
      parseDotEnv(`
# comment
DATABASE_URL=postgresql://knowledge:knowledge@127.0.0.1:5432/knowledge_dapp
ADMIN_ADDRESSES="0xabc,0xdef"
BLANK=
      `)
    ).toEqual({
      DATABASE_URL:
        "postgresql://knowledge:knowledge@127.0.0.1:5432/knowledge_dapp",
      ADMIN_ADDRESSES: "0xabc,0xdef",
      BLANK: "",
    });
  });

  it("returns a stable sha256 checksum for migration content", () => {
    const sql = "create table if not exists example (id uuid primary key);";

    expect(hashMigration(sql)).toHaveLength(64);
    expect(hashMigration(sql)).toBe(hashMigration(sql));
    expect(hashMigration(sql)).not.toBe(
      hashMigration(`${sql}\ncreate index on example (id);`)
    );
  });

  it("parses status and env-file CLI args", () => {
    expect(parseCliArgs(["--status", "--env-file", ".env.production.local"])).toEqual({
      statusOnly: true,
      envFile: ".env.production.local",
    });
  });

  it("throws when env-file is missing its filename", () => {
    expect(() => parseCliArgs(["--env-file"])).toThrow(
      "--env-file requires a filename, for example --env-file .env.production.local"
    );
  });
});
