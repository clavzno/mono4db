import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import pg from "pg";
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

function load(relativePath, imports = {}) {
  const loadedModule = { exports: {} };
  const source = readFileSync(path.join(testDirectory, "..", relativePath), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  vm.runInNewContext(outputText, {
    module: loadedModule, exports: loadedModule.exports, Response, URL,
    console: { error() {} },
    require(name) {
      if (name === "server-only") return {};
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
  });
  return loadedModule.exports;
}

const queries = load("src/lib/queries.ts");
const routeFile = "src/app/api/reports/underperforming-trains/route.ts";
const url = "http://localhost/api/reports/underperforming-trains";

test("invalid report inputs never reach the database", async () => {
  let calls = 0;
  const route = load(routeFile, { "@/lib/train-report": { getTrainReport() { calls++; } } });
  for (const params of ["", "?company=A", "?company=&limit=5", "?company=A&limit=0", "?company=A&limit=101", "?company=A&limit=1.5", "?company=A&limit=Infinity", "?company=A&company=B&limit=5", "?company=A&limit=5&limit=10"]) {
    assert.equal((await route.GET(new Request(url + params))).status, 400);
  }
  assert.equal(calls, 0);
});

test("valid report requests preserve company names and normalize the limit", async () => {
  const name = "Operator & rail ' exact";
  const route = load(routeFile, { "@/lib/train-report": { getTrainReport: async (company, limit) => {
    assert.equal(company, name);
    assert.equal(limit, 5);
    return { companyName: company, requestedLimit: limit, companyOnTimeRate: null, rows: [] };
  } } });
  const response = await route.GET(new Request(`${url}?${new URLSearchParams({ company: name, limit: "5" })}`));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual((await response.json()).rows, []);
});

test("unknown companies and unavailable databases produce safe errors", async () => {
  const missing = load(routeFile, { "@/lib/train-report": { getTrainReport: async () => null } });
  assert.equal((await missing.GET(new Request(url + "?company=A&limit=5"))).status, 404);
  const broken = load(routeFile, { "@/lib/train-report": { getTrainReport: async () => { throw new Error("secret connection detail"); } } });
  const response = await broken.GET(new Request(url + "?company=A&limit=5"));
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("secret"));
});

test("company lookup handles empty lists and connection failures", async () => {
  const file = "src/app/api/companies/route.ts";
  const empty = load(file, { "@/lib/train-report": { getCompanies: async () => [] } });
  assert.deepEqual(await (await empty.GET()).json(), { companies: [] });
  const broken = load(file, { "@/lib/train-report": { getCompanies: async () => { throw new Error("secret"); } } });
  assert.equal((await broken.GET()).status, 503);
});

test("data access parameterizes values and retains bigint IDs as strings", async () => {
  const company = "A'; SELECT 1; --";
  let calls = 0;
  const service = load("src/lib/train-report.ts", { "./queries": queries, "./db": { query: async (sql, values) => {
    calls++;
    if (sql === queries.companyExistsQuery) {
      assert.equal(values[0], company);
      return [{ exists: true }];
    }
    assert.equal(sql, queries.underperformingTrainsQuery);
    assert.equal(values[0], company);
    assert.equal(values[1], 5);
    return [{ train_id: "9007199254740993", train_on_time_rate: "50", avg_train_delay: "2", company_on_time_rate: "60", rate_gap: "-10" }];
  } } });
  const result = await service.getTrainReport(company, 5);
  assert.equal(calls, 2);
  assert.equal(result.rows[0].trainId, "9007199254740993");
  assert.equal(result.rows[0].rate, 50);
  assert.equal(result.rows[0].averageDelay, 2);
  assert.equal(result.rows[0].gap, -10);
  assert.equal(result.companyOnTimeRate, 60);
});

test("no eligible arrivals maps to null baseline and an empty result", async () => {
  const service = load("src/lib/train-report.ts", { "./queries": queries, "./db": { query: async (sql) => sql === queries.companyExistsQuery ? [{ exists: true }] : [{ train_id: null, company_on_time_rate: null }] } });
  const report = await service.getTrainReport("Empty", 5);
  assert.equal(report.companyOnTimeRate, null);
  assert.equal(report.rows.length, 0);
});

test("SQL fixtures verify eligibility, weighting, ties, limits, and empty data", { skip: process.env.REPORT3_DATABASE_TESTS !== "1" }, async () => {
  nextEnv.loadEnvConfig(path.join(testDirectory, ".."));
  const { Client } = pg;
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    // CTE fixtures shadow warehouse tables without creating or changing database objects.
    const fixture = queries.underperformingTrainsQuery.replace("WITH train_stats AS (", `WITH
      fact_service(rdt_id, company_name) AS (VALUES (1::bigint, 'A'), (2::bigint, 'Empty')),
      fact_stop(rdt_id, train_id, cancel_status, arrival_delay) AS (VALUES
        (1::bigint, 9007199254740993::bigint, 'none', 0),
        (1, 9007199254740993, 'none', 4),
        (1, 2, 'departure-only', 0),
        (1, 3, 'none', 10),
        (1, 4, 'arrival-only', 0),
        (1, 4, 'completely', 0),
        (1, 4, 'none', NULL::integer),
        (1, 5, 'none', 0)
      ), train_stats AS (`);
    const full = (await client.query(fixture, ["A", 100])).rows;
    assert.deepEqual(full.map((row) => row.train_id), ["3", "9007199254740993", "2", "5"]);
    assert.ok(full.every((row) => Number(row.company_on_time_rate) === 60));
    assert.equal(Number(full[1].avg_train_delay), 2);
    assert.equal(Number(full[1].rate_gap), -10);
    assert.equal(Number(full[2].rate_gap), 40);
    const limited = (await client.query(fixture, ["A", 1])).rows;
    assert.equal(limited.length, 1);
    assert.equal(Number(limited[0].company_on_time_rate), 60);
    const empty = (await client.query(fixture, ["Empty", 5])).rows;
    assert.equal(empty[0].train_id, null);
    assert.equal(empty[0].company_on_time_rate, null);
  } finally {
    await client.end();
  }
});

test("live API matches independent warehouse aggregates for multiple companies and limits", { skip: process.env.REPORT3_LIVE_TESTS !== "1" }, async () => {
  nextEnv.loadEnvConfig(path.join(testDirectory, ".."));
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const companiesResponse = await fetch("http://localhost:3000/api/companies");
    assert.equal(companiesResponse.status, 200);
    const { companies } = await companiesResponse.json();
    assert.ok(companies.length > 0);
    const directCompanies = (await client.query("SELECT DISTINCT company_name FROM fact_service ORDER BY company_name")).rows.map((row) => row.company_name);
    assert.deepEqual(companies, directCompanies);
    const selected = [...new Set([companies[0], companies.includes("Arriva") ? "Arriva" : companies.at(-1)])];
    for (const company of selected) {
      const baselineResult = await client.query(`
        SELECT 100.0 * COUNT(*) FILTER (WHERE fst.arrival_delay = 0) / NULLIF(COUNT(*), 0) AS baseline
        FROM fact_stop fst JOIN fact_service fsv USING (rdt_id)
        WHERE fsv.company_name = $1 AND fst.cancel_status IN ('none', 'departure-only') AND fst.arrival_delay IS NOT NULL
      `, [company]);
      const baseline = baselineResult.rows[0].baseline == null ? null : Number(baselineResult.rows[0].baseline);
      for (const limit of [1, 5]) {
        const response = await fetch(`http://localhost:3000/api/reports/underperforming-trains?${new URLSearchParams({ company, limit: String(limit) })}`);
        assert.equal(response.status, 200);
        const report = await response.json();
        assert.equal(report.companyName, company);
        assert.equal(report.requestedLimit, limit);
        assert.equal(report.companyOnTimeRate, baseline);
        const direct = (await client.query(`
          SELECT fst.train_id::text AS train_id,
            100.0 * COUNT(*) FILTER (WHERE fst.arrival_delay = 0) / COUNT(*) AS rate,
            AVG(fst.arrival_delay) AS average_delay
          FROM fact_stop fst JOIN fact_service fsv USING (rdt_id)
          WHERE fsv.company_name = $1 AND fst.cancel_status IN ('none', 'departure-only') AND fst.arrival_delay IS NOT NULL
          GROUP BY fst.train_id ORDER BY rate ASC, fst.train_id ASC LIMIT $2
        `, [company, limit])).rows;
        assert.equal(report.rows.length, direct.length);
        for (let index = 0; index < direct.length; index++) {
          assert.equal(report.rows[index].trainId, direct[index].train_id);
          assert.equal(report.rows[index].rate, Number(direct[index].rate));
          assert.equal(report.rows[index].averageDelay, Number(direct[index].average_delay));
          assert.ok(Math.abs(report.rows[index].gap - (report.rows[index].rate - baseline)) < 1e-10);
        }
      }
    }
    const unknown = await fetch("http://localhost:3000/api/reports/underperforming-trains?company=__missing_report_test_company__&limit=5");
    assert.equal(unknown.status, 404);
  } finally {
    await client.end();
  }
});
