"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { monthNames, type CompanyReport as CompanyReportData, type CompanyRow } from "@/lib/company-report-types";
import { timePeriods, type TimePeriod } from "@/lib/station-report-types";

const CompanyChart = dynamic(() => import("./company-chart"), { ssr: false, loading: () => <p role="status" className="warehouse-status">Loading chart…</p> });
const columns = [["companyName", "Company"], ["month", "Month"], ["onTimeRate", "On-time rate (%)"], ["averageArrivalDelay", "Average arrival delay (min)"], ["rank", "Monthly rank"]] as const;

function CompanyResults({ result }: { result: CompanyReportData }) {
  const [sort, setSort] = useState<{ key: keyof CompanyRow; ascending: boolean } | null>(null);
  const tableRows = [...result.rows].sort((a, b) => {
    if (!sort) return a.month - b.month || a.rank - b.rank || a.companyName.localeCompare(b.companyName);
    const left = a[sort.key]; const right = b[sort.key];
    const comparison = typeof left === "number" ? left - Number(right) : left.localeCompare(String(right));
    return (sort.ascending ? comparison : -comparison) || a.month - b.month || a.companyName.localeCompare(b.companyName);
  });
  const companies = new Set(result.rows.map((row) => row.companyName));
  const latestMonth = Math.max(0, ...result.rows.map((row) => row.month));
  const leaders = result.rows.filter((row) => row.month === latestMonth && row.rank === 1);
  return <section className="on-time-results" aria-label="Company comparison results">
    <p className="warehouse-status">Last successful query: {result.timeOfDay}. {companies.size} companies, {result.rows.length} company-month results. Full 2025 dataset.</p>
    {result.rows.length ? <div className="train-layout"><section className="chart-section" aria-labelledby="company-chart-title"><div className="trend-heading"><div><h3 id="company-chart-title">Monthly company punctuality</h3><p>Compare on-time arrival rates. Select a company in the legend to show or hide its line.</p></div></div><CompanyChart rows={result.rows} /></section><aside className="train-baseline-card"><h3>Company overview</h3><dl><div><dt>Companies with eligible arrivals</dt><dd>{companies.size}</dd></div><div><dt>Months with results</dt><dd>{new Set(result.rows.map((row) => row.month)).size}</dd></div><div><dt>Leading companies in {monthNames[latestMonth - 1]}</dt><dd>{leaders.map((row) => row.companyName).join(", ")}</dd></div><div><dt>Leading on-time rate</dt><dd>{leaders[0]?.onTimeRate.toFixed(2)}%</dd></div></dl><p className="metric-note">Ranks compare companies within the same month. Equal rounded rates share a rank, with gaps after ties. Only arrivals with a recorded delay and cancellation status none or departure-only qualify.</p></aside></div> : <section className="results-panel empty-state"><h3>No eligible arrivals found</h3><p>Choose another time of day and run the query again.</p></section>}
    <details className="results-disclosure"><summary><span>Results table <span className="row-count">{result.rows.length} company-month results</span></span><span aria-hidden="true" className="disclosure-chevron">⌄</span></summary><div className="table-scroll"><table className="trend-table"><caption className="sr-only">Warehouse monthly company comparison</caption><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort?.key === key ? sort.ascending ? "ascending" : "descending" : "none"}><button type="button" onClick={() => setSort({ key, ascending: sort?.key === key ? !sort.ascending : true })}>{label}<span aria-hidden="true">{sort?.key === key ? sort.ascending ? "↑" : "↓" : "↕"}</span></button></th>)}</tr></thead><tbody>{tableRows.map((row) => <tr key={`${row.companyName}:${row.month}`}><th scope="row">{row.companyName}</th><td>{monthNames[row.month - 1]}</td><td>{row.onTimeRate.toFixed(2)}</td><td>{row.averageArrivalDelay.toFixed(2)}</td><td>{row.rank}</td></tr>)}</tbody></table></div></details>
  </section>;
}

export function CompanyReport() {
  const [timeOfDay, setTimeOfDay] = useState<TimePeriod>("morning");
  const [result, setResult] = useState<CompanyReportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function run() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/reports/company-comparison?${new URLSearchParams({ timeOfDay })}`, { signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!controller.signal.aborted) { setResult(data); setVersion((value) => value + 1); }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load company results. Run the query again.");
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false); }
    }
  }
  return <section aria-label="Company Comparison report" aria-busy={busy}>
    <section className="report-panel"><div className="panel-heading"><div><h2>Company Comparison</h2><p>Compare monthly company punctuality and average arrival delays.</p></div><span className="filter-indicator">Filters</span></div><form onSubmit={(event) => { event.preventDefault(); void run(); }}><div className="filter-grid train-filter-grid"><div className="filter-field"><fieldset><legend>Time of day</legend><div className="segmented-control">{timePeriods.map((period) => <button type="button" key={period} aria-pressed={timeOfDay === period} onClick={() => setTimeOfDay(period)}>{period[0].toUpperCase() + period.slice(1)}</button>)}</div></fieldset><p className="filter-help">Based on arrival time, across the full 2025 dataset.</p></div></div><div className="report-actions"><div className="action-group"><button type="submit" className="button primary" disabled={busy}>{busy ? "Running query…" : "Run Query"}</button><button type="button" className="button" onClick={() => { setTimeOfDay("morning"); setError(null); }}>Reset Filters</button><button type="button" className="button" disabled>Copy Config</button><button type="button" className="button" disabled>Paste Config</button></div><div className="action-group"><button type="button" className="button" disabled>Download Report</button><button type="button" className="button" disabled>Export CSV</button></div></div></form></section>
    {busy ? <p className="warehouse-status" role="status">Querying the warehouse. Previous results remain below.</p> : null}
    {error ? <div className="notice notice-error" role="alert">{error} {result ? "The last successful results remain below." : ""}</div> : null}
    {result ? <CompanyResults key={version} result={result} /> : <section className="results-panel empty-state"><h3>Select a time of day, then run the query</h3><p>Compare monthly on-time rates, average arrival delays, and company ranks.</p></section>}
  </section>;
}
