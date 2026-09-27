import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

let pool: Pool | undefined;
let database: NodePgDatabase | undefined;

/**
 * Called once by each app at startup with its validated config; the package
 * never reads process.env itself.
 */
export function initDb(databaseUrl: string) {
  pool = new Pool({ connectionString: databaseUrl });
  database = drizzle({ client: pool });
}

export function getDb(): NodePgDatabase {
  if (!database) {
    throw new Error("Database not initialised: call initDb() at startup");
  }

  return database;
}

export async function closeDb() {
  await pool?.end();
}
