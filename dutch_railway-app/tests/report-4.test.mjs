import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";
import nextEnv from "@next/env";
import pg from "pg";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function load(file, imports = {}) {
  const loadedModule = { exports: {} };
  const source = readFileSync(path.join(root, file), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  vm.runInNewContext(outputText, {
    module: loadedModule, exports: loadedModule.exports, URL, Response, console: { error() {} },
    require(name) {
      if (name === "server-only") return {};
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return loadedModule.exports;
}
const types = load("src/lib/station-report-types.ts");
const queries = load("src/lib/queries.ts");
const routeFile = "src/app/api/reports/station-delay/route.ts";

test("station endpoint rejects missing, duplicate, and unsupported time periods", async () => {
  let calls = 0;
  const route = load(routeFile, {
    "@/lib/station-report-types": types,
    "@/lib/station-report": { getStationReport() { calls++; } },
  });
  for (const params of ["", "?timeOfDay=", "?timeOfDay=noon", "?timeOfDay=Morning", "?timeOfDay=all", "?timeOfDay=morning&timeOfDay=night"]) {
    assert.equal((await route.GET(new Request("http://localhost/api/reports/station-delay" + params))).status, 400);
  }
  assert.equal(calls, 0);
});

test("station endpoint accepts each warehouse time period and empty results", async () => {
  const route = load(routeFile, {
    "@/lib/station-report-types": types,
    "@/lib/station-report": { getStationReport: async (timeOfDay) => ({ timeOfDay, rows: [] }) },
  });
  for (const period of types.timePeriods) {
    const response = await route.GET(new Request(`http://localhost/api/reports/station-delay?timeOfDay=${period}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(await response.json(), { timeOfDay: period, rows: [] });
  }
});

test("station endpoint hides database exception details", async () => {
  const route = load(routeFile, {
    "@/lib/station-report-types": types,
    "@/lib/station-report": { getStationReport: async () => { throw new Error("private connection details"); } },
  });
  const response = await route.GET(new Request("http://localhost/api/reports/station-delay?timeOfDay=morning"));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("private"));
});

test("station data access parameterizes the period and maps numeric values", async () => {
  const service = load("src/lib/station-report.ts", {
    "./queries": queries,
    "./db": { query: async (sql, values) => {
      assert.equal(sql, queries.stationDelayQuery);
      assert.equal(values[0], "night");
      return [{ station_name: "Station A", time_of_day: "night", avg_delay_change: "-1.25", total_stops: "1234" }];
    } },
  });
  const result = await service.getStationReport("night");
  assert.equal(result.rows[0].averageDelayChange, -1.25);
  assert.equal(result.rows[0].totalStops, 1234);
});

test("station SQL preserves sign, cancellation/null exclusions, counts, and deterministic ties", { skip: process.env.REPORT4_DATABASE_TESTS !== "1" }, async () => {
  nextEnv.loadEnvConfig(root);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const sql = `WITH dim_station(station_code, station_name) AS (VALUES ('a','Added'),('b','Recovered'),('c','Tied'),('d','Excluded')),
      dim_time(time_key, time_of_day) AS (VALUES (1,'morning'),(2,'night')),
      fact_stop(station_code,arrival_time,cancel_status,arrival_delay,departure_delay) AS (VALUES
        ('a',1,'none',1,3),('a',1,'none',1,5),('b',1,'none',5,2),('c',1,'none',0,3),
        ('d',1,'none',NULL::integer,9),('d',1,'none',9,NULL::integer),('d',1,'departure-only',0,9),
        ('d',1,'arrival-only',0,9),('d',1,'completely',0,9),('a',2,'none',0,1)
      ) ${queries.stationDelayQuery}`;
    const rows = (await client.query(sql, ["morning"])).rows;
    assert.deepEqual(rows.map((row) => row.station_name), ["Added", "Tied", "Recovered"]);
    assert.deepEqual(rows.map((row) => Number(row.avg_delay_change)), [3, 3, -3]);
    assert.deepEqual(rows.map((row) => Number(row.total_stops)), [2, 1, 1]);
    assert.equal((await client.query(sql, ["afternoon"])).rows.length, 0);
  } finally { await client.end(); }
});

test("live station API matches the baseline warehouse query for all time periods", { skip: process.env.REPORT4_LIVE_TESTS !== "1" }, async () => {
  nextEnv.loadEnvConfig(root);
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    // The supplied query, independently evaluated without an application-side row limit.
    const directSQL = `SELECT s.station_name, t.time_of_day,
      ROUND(AVG(fst.departure_delay - fst.arrival_delay), 2) AS avg_delay_change, COUNT(*) AS total_stops
      FROM fact_stop fst JOIN dim_station s ON s.station_code = fst.station_code
      JOIN dim_time t ON t.time_key = fst.arrival_time
      WHERE fst.cancel_status = 'none' AND fst.arrival_delay IS NOT NULL AND fst.departure_delay IS NOT NULL
      AND t.time_of_day = $1 GROUP BY s.station_name, t.time_of_day ORDER BY avg_delay_change DESC, s.station_name ASC`;
    for (const timeOfDay of types.timePeriods) {
      const response = await fetch(`http://localhost:3000/api/reports/station-delay?timeOfDay=${timeOfDay}`);
      assert.equal(response.status, 200);
      const result = await response.json();
      const direct = (await client.query(directSQL, [timeOfDay])).rows;
      assert.equal(result.timeOfDay, timeOfDay);
      assert.deepEqual(result.rows, direct.map((row) => ({ stationName: row.station_name, timeOfDay: row.time_of_day, averageDelayChange: Number(row.avg_delay_change), totalStops: Number(row.total_stops) })));
    }
  } finally { await client.end(); }
});
