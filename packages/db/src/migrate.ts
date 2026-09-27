import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

// Arbitrary app-wide key for pg_advisory_lock.
const MIGRATION_LOCK_KEY = 4_815_162_342;

// src/migrate.ts and dist/migrate.js both sit one level below packages/db.
const MIGRATIONS_FOLDER = fileURLToPath(new URL("../drizzle", import.meta.url));

/**
 * Applies pending migrations. Called by every API and worker process on boot,
 * so it doesn't matter which starts first or how many replicas there are:
 * the advisory lock lets one migrate while the others wait, and they then
 * find nothing left to apply.
 */
export async function runMigrations(databaseUrl: string) {
  // A dedicated connection: advisory locks belong to the session that took them.
  const client = new Client({ connectionString: databaseUrl });

  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    const orm = drizzle({ client });
    await migrate(orm, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await client.end();
  }
}
