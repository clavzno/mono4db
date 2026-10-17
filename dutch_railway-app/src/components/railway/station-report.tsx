"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { timePeriods, type StationReport as StationReportData, type StationRow, type TimePeriod } from "@/lib/station-report-types";

const StationChart = dynamic(() => import("./station-chart"), { ssr: false, loading: () => <p className="warehouse-status" role="status">Loading chart…</p> });
const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
const columns = [["stationName", "Station"], ["timeOfDay", "Time of day"], ["averageDelayChange", "Average delay change (min)"], ["totalStops", "Eligible stops"]] as const;

function StationResults({ result }: { result: StationReportData }) {
  const [recovery, setRecovery] = useState(false);
  const [sort, setSort] = useState<{ key: keyof StationRow; ascending: boolean }>({ key: "averageDelayChange", ascending: false });
  const chartRows = useMemo(() => [...result.rows].sort((a, b) => (recovery ? a.averageDelayChange - b.averageDelayChange : b.averageDelayChange - a.averageDelayChange) || a.stationName.localeCompare(b.stationName)), [result.rows, recovery]);
  const tableRows = [...result.rows].sort((a, b) => {
    const left = a[sort.key]; const right = b[sort.key];
    const comparison = typeof left === "number" ? left - Number(right) : left.localeCompare(String(right));
    return sort.ascending ? comparison : -comparison;
  });
  const totalStops = result.rows.reduce((sum, row) => sum + row.totalStops, 0);
  const largestIncrease = result.rows.find((row) => row.averageDelayChange > 0);
  const greatestRecovery = [...result.rows].reverse().find((row) => row.averageDelayChange < 0);
  return <section className="on-time-results" aria-label="Station delay results">
    <p className="warehouse-status">Last successful query: {result.timeOfDay}. {result.rows.length} station groups. Across the full dataset.</p>
    {result.rows.length ? <div className="train-layout"><section className="chart-section" aria-labelledby="station-chart-title"><div className="trend-heading"><div><h3 id="station-chart-title">Where trains lose time and recover it</h3><p>Positive means added delay. Negative means recovery. Use the chart slider to explore more stations.</p></div></div>
      <fieldset className="station-chart-controls"><legend className="sr-only">Chart order</legend><div className="segmented-control"><button type="button" aria-pressed={!recovery} onClick={() => setRecovery(false)}>Largest delay increases</button><button type="button" aria-pressed={recovery} onClick={() => setRecovery(true)}>Greatest recovery</button></div></fieldset><StationChart rows={chartRows} />
    </section><aside className="train-baseline-card"><h3>Station overview</h3><dl><div><dt>Eligible stops</dt><dd>{totalStops.toLocaleString("en-GB")}</dd></div><div><dt>Station groups</dt><dd>{result.rows.length}</dd></div><div><dt>Largest delay increase</dt><dd>{largestIncrease ? `${largestIncrease.stationName}: ${signed(largestIncrease.averageDelayChange)} min` : "None"}</dd></div><div><dt>Greatest recovery</dt><dd>{greatestRecovery ? `${greatestRecovery.stationName}: ${signed(greatestRecovery.averageDelayChange)} min` : "None"}</dd></div></dl><p className="metric-note">Only non-cancelled stops with both arrival and departure delays qualify.</p></aside></div> : <div className="results-panel empty-state"><h3>No eligible stops found</h3><p>Try another time of day.</p></div>}
    <details className="results-disclosure"><summary><span>Results table <span className="row-count">{result.rows.length} station groups</span></span><span aria-hidden="true" className="disclosure-chevron">⌄</span></summary><div className="table-scroll"><table className="trend-table"><caption className="sr-only">Warehouse station delay results in minutes</caption><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.ascending ? "ascending" : "descending" : "none"}><button type="button" onClick={() => setSort({ key, ascending: sort.key === key ? !sort.ascending : true })}>{label}<span aria-hidden="true">{sort.key === key ? sort.ascending ? "↑" : "↓" : "↕"}</span></button></th>)}</tr></thead><tbody>{tableRows.map((row) => <tr key={`${row.stationName}-${row.timeOfDay}`}><th scope="row">{row.stationName}</th><td>{row.timeOfDay}</td><td>{signed(row.averageDelayChange)}</td><td>{row.totalStops.toLocaleString("en-GB")}</td></tr>)}</tbody></table></div></details>
  </section>;
}

export function StationReport() {
  const [timeOfDay, setTimeOfDay] = useState<TimePeriod>("morning");
  const [result, setResult] = useState<StationReportData | null>(null);
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
      const response = await fetch(`/api/reports/station-delay?${new URLSearchParams({ timeOfDay })}`, { signal: controller.signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (!controller.signal.aborted) { setResult(data); setVersion((value) => value + 1); }
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Could not load station results. Run the query again.");
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false); }
    }
  }
  return <section aria-label="Station Delay report" aria-busy={busy}>
    <section className="report-panel"><div className="panel-heading"><div><h2>Station Delay</h2><p>Compare arrival and departure delays at each station.</p></div><span className="filter-indicator">Filters</span></div><form onSubmit={(event) => { event.preventDefault(); void run(); }}><div className="filter-grid train-filter-grid"><div className="filter-field"><fieldset><legend>Time of day</legend><div className="segmented-control">{timePeriods.map((period) => <button type="button" key={period} aria-pressed={timeOfDay === period} onClick={() => setTimeOfDay(period)}>{period[0].toUpperCase() + period.slice(1)}</button>)}</div></fieldset><p className="filter-help">Based on arrival time, across the full dataset.</p></div></div><div className="report-actions"><div className="action-group"><button type="submit" className="button primary" disabled={busy}>{busy ? "Running query…" : "Run Query"}</button><button type="button" className="button" onClick={() => { setTimeOfDay("morning"); setError(null); }}>Reset Filters</button><button type="button" className="button" disabled>Copy Config</button><button type="button" className="button" disabled>Paste Config</button></div><div className="action-group"><button type="button" className="button" disabled>Download Report</button><button type="button" className="button" disabled>Export CSV</button></div></div></form></section>
    {busy ? <p className="warehouse-status" role="status">Querying the warehouse. Previous results remain below.</p> : null}
    {error ? <div className="notice notice-error" role="alert">{error} {result ? "The last successful results remain below." : ""}</div> : null}
    {result ? <StationResults key={version} result={result} /> : <section className="results-panel empty-state"><h3>Select a time of day, then run the query</h3><p>Explore stations that add delay and stations where trains recover time.</p></section>}
  </section>;
}
