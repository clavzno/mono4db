"use client";

import { DisclosureChevron } from "./disclosure-chevron";

import { useReportExport, ExportButtons } from "./report-export";
import { numericColumn, textColumn } from "@/lib/report-export-types";
import dynamic from "next/dynamic";
import { validDate } from "@/lib/on-time-report-types";
import { useEffect, useRef, useState } from "react";
import { timePeriods, validStationCount, type StationReport as StationReportData, type StationRow, type TimePeriod } from "@/lib/station-report-types";

const StationChart = dynamic(() => import("./station-chart"), { ssr: false, loading: () => <p className="warehouse-status" role="status">Loading chart…</p> });
const signed = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
const columns = [["stationName", "Station"], ["timeOfDay", "Time of day"], ["averageDelayChange", "Average delay change (min)"], ["totalStops", "Eligible stops"]] as const;

function StationResults({ result }: { result: StationReportData }) {
  const [sort, setSort] = useState<{ key: keyof StationRow; ascending: boolean }>({ key: "averageDelayChange", ascending: result.recovery });
  const tableRows = [...result.rows].sort((a, b) => {
    const left = a[sort.key]; const right = b[sort.key];
    const comparison = typeof left === "number" ? left - Number(right) : left.localeCompare(String(right));
    return sort.ascending ? comparison : -comparison;
  });
  useReportExport({ id: "report-4", title: "Station Delay", filters: [["Service dates", result.from + " to " + result.to], ["Time of day", result.timeOfDay], ["Order", result.recovery ? "Greatest recovery" : "Largest delay increases"], ["Requested stations", String(result.requestedLimit)]], sqlOutput: result.sqlOutput, table: {
    columns: [textColumn("Station"), textColumn("Time of day"), numericColumn("Average delay change (min)"), numericColumn("Eligible stops")],
    rows: tableRows.map((row) => [row.stationName, row.timeOfDay, row.averageDelayChange.toFixed(2), row.totalStops]),
  } });
  const totalStops = result.rows.reduce((sum, row) => sum + row.totalStops, 0);
  const largestIncrease = [...result.rows].sort((a, b) => b.averageDelayChange - a.averageDelayChange).find((row) => row.averageDelayChange > 0);
  const greatestRecovery = [...result.rows].sort((a, b) => a.averageDelayChange - b.averageDelayChange).find((row) => row.averageDelayChange < 0);
  return <section className="on-time-results" data-export-report="report-4" aria-label="Station delay results">
    <p className="warehouse-status">Last successful query: {result.timeOfDay}. {result.rows.length} stations, {result.recovery ? "greatest recovery" : "largest delay increases"} (up to {result.requestedLimit}). {result.from} to {result.to}.</p>
    {result.rows.length ? <div className="train-layout"><section className="chart-section" aria-labelledby="station-chart-title"><div className="trend-heading"><div><h3 id="station-chart-title">Where trains lose time and recover it</h3><p>Positive means added delay. Negative means recovery. Showing up to {result.requestedLimit} stations in the selected order.</p></div></div>
      <StationChart rows={result.rows} />
    </section><aside className="train-baseline-card"><h3>Station overview</h3><dl><div><dt>Eligible stops at displayed stations</dt><dd>{totalStops.toLocaleString("en-GB")}</dd></div><div><dt>Displayed stations</dt><dd>{result.rows.length}</dd></div><div><dt>Largest delay increase</dt><dd>{largestIncrease ? `${largestIncrease.stationName}: ${signed(largestIncrease.averageDelayChange)} min` : "None"}</dd></div><div><dt>Greatest recovery</dt><dd>{greatestRecovery ? `${greatestRecovery.stationName}: ${signed(greatestRecovery.averageDelayChange)} min` : "None"}</dd></div></dl><p className="metric-note">Overview values cover only these displayed stations. Only non-cancelled stops with both arrival and departure delays qualify.</p></aside></div> : <div className="results-panel empty-state"><h3>No eligible stops found</h3><p>Try another date range or time of day.</p></div>}
    <details className="results-disclosure"><summary><span>Results table <span className="row-count">{result.rows.length} station groups</span></span><DisclosureChevron /></summary><div className="table-scroll"><table className="trend-table"><caption className="sr-only">Warehouse station delay results in minutes</caption><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.ascending ? "ascending" : "descending" : "none"}><button type="button" onClick={() => setSort({ key, ascending: sort.key === key ? !sort.ascending : true })}>{label}<span aria-hidden="true">{sort.key === key ? sort.ascending ? "↑" : "↓" : "↕"}</span></button></th>)}</tr></thead><tbody>{tableRows.map((row) => <tr key={`${row.stationName}-${row.timeOfDay}`}><th scope="row">{row.stationName}</th><td>{row.timeOfDay}</td><td>{signed(row.averageDelayChange)}</td><td>{row.totalStops.toLocaleString("en-GB")}</td></tr>)}</tbody></table></div></details>
  </section>;
}

export function StationReport() {
  const [recovery, setRecovery] = useState(false);
  const [stationCount, setStationCount] = useState("5");
  const [customStationCount, setCustomStationCount] = useState("25");
  const [from, setFrom] = useState("2025-01-01");
  const [to, setTo] = useState("2025-12-31");
  const [timeOfDay, setTimeOfDay] = useState<TimePeriod>("morning");
  const [result, setResult] = useState<StationReportData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function run() {
    if (request.current) return;
    const limit = stationCount === "Custom" ? customStationCount : stationCount;
    if (!validStationCount(limit)) {
      setError("Choose a whole number of stations from 1 to 100.");
      return;
    }
    if (!validDate(from) || !validDate(to) || from > to || from < "2025-01-01" || to > "2025-12-31") {
      setError("Choose a valid date range within 2025, with the end on or after the start.");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/reports/station-delay?${new URLSearchParams({ timeOfDay, from, to, order: recovery ? "recovery" : "addition", limit })}`, { signal: controller.signal, cache: "no-store" });
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
    <section className="report-panel"><div className="panel-heading"><div><h2>Station Delay</h2><p>Compare arrival and departure delays at each station.</p></div><span className="filter-indicator">Filters</span></div><form onSubmit={(event) => { event.preventDefault(); void run(); }}><div className="filter-grid train-filter-grid"><div className="filter-field"><fieldset><legend>Time of day</legend><div className="segmented-control">{timePeriods.map((period) => <button type="button" key={period} aria-pressed={timeOfDay === period} onClick={() => setTimeOfDay(period)}>{period[0].toUpperCase() + period.slice(1)}</button>)}</div></fieldset><p className="filter-help">Based on arrival time. Dates filter the service date.</p></div><div className="filter-field"><fieldset><legend>Rank stations by</legend><div className="segmented-control"><button type="button" aria-pressed={!recovery} onClick={() => setRecovery(false)}>Largest delay increases</button><button type="button" aria-pressed={recovery} onClick={() => setRecovery(true)}>Greatest recovery</button></div></fieldset></div><div className="filter-field"><fieldset><legend>Stations to show</legend><div className="segmented-control">{["5", "10", "20", "Custom"].map((count) => <button key={count} type="button" aria-pressed={stationCount === count} onClick={() => setStationCount(count)}>{count}</button>)}</div></fieldset>{stationCount === "Custom" ? <div className="custom-train-count"><label htmlFor="custom-station-count">Number of stations (1-100)</label><input id="custom-station-count" type="number" min="1" max="100" step="1" required value={customStationCount} onChange={(event) => setCustomStationCount(event.target.value)} /></div> : null}</div><div className="date-range"><div className="filter-field"><label htmlFor="station-from">From</label><input id="station-from" type="date" min="2025-01-01" max="2025-12-31" required value={from} onChange={(event) => setFrom(event.target.value)} /></div><div className="filter-field"><label htmlFor="station-to">To</label><input id="station-to" type="date" min="2025-01-01" max="2025-12-31" required value={to} onChange={(event) => setTo(event.target.value)} /></div></div></div><div className="report-actions"><div className="action-group"><button type="submit" className="button primary" disabled={busy}>{busy ? "Running query…" : "Run Query"}</button><button type="button" className="button" onClick={() => { setTimeOfDay("morning"); setRecovery(false); setStationCount("5"); setCustomStationCount("25"); setFrom("2025-01-01"); setTo("2025-12-31"); setError(null); }}>Reset Filters</button></div><ExportButtons reportId="report-4" disabled={busy || !result} /></div></form></section>
    {busy ? <p className="warehouse-status" role="status">Querying the warehouse. Previous results remain below.</p> : null}
    {error ? <div className="notice notice-error" role="alert">{error} {result ? "The last successful results remain below." : ""}</div> : null}
    {result ? <StationResults key={version} result={result} /> : <section className="results-panel empty-state"><h3>Select a date range and time of day, then run the query</h3><p>Explore stations that add delay and stations where trains recover time.</p></section>}
  </section>;
}
