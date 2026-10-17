import "server-only";

import { Pool, type QueryResultRow } from "pg";

const databaseGlobal = globalThis as typeof globalThis & {
  railwayPool?: Pool;
};

export function getPool(): Pool {
  if (databaseGlobal.railwayPool) return databaseGlobal.railwayPool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Set DATABASE_URL in the app's .env or .env.local file before querying the database.");
  }

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  pool.on("error", () => {
    console.error("An idle PostgreSQL connection failed. The pool will replace it on the next request.");
  });

  // Keep one pool when Next.js reloads server modules during development.
  databaseGlobal.railwayPool = pool;
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query<T>(text, values);
  return result.rows;
}
