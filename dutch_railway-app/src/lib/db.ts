import "server-only";

import { Pool, type QueryResultRow } from "pg";
import type { ExportTable, ExportValue } from "./report-export-types";

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

const numericTypes = new Set([20, 21, 23, 26, 700, 701, 1700]);

export async function queryWithOutput<T extends QueryResultRow>(
  text: string,
  values: unknown[] = [],
): Promise<{ rows: T[]; sqlOutput: ExportTable }> {
  // Array mode retains column order, duplicate column names, and original values.
  const result = await getPool().query<ExportValue[]>({ text, values, rowMode: "array" });
  return {
    rows: result.rows.map((row) => Object.fromEntries(result.fields.map((field, index) => [field.name, row[index]])) as T),
    sqlOutput: {
      columns: result.fields.map((field) => ({
        name: field.name,
        kind: numericTypes.has(field.dataTypeID) ? "number" : field.dataTypeID === 16 ? "boolean" : "text",
      })),
      rows: result.rows,
    },
  };
}
