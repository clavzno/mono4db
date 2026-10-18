"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { aggregateArrivals, type Level, type TrendRow } from "./on-time-data";
import type { OnTimeReport } from "@/lib/on-time-report-types";
const TrendChart = dynamic(() => import("./on-time-chart"), { ssr: false, loading: () => <p className="warehouse-status" role="status">Loading chart…</p> });

const number = new Intl.NumberFormat("en-GB");
const percentage = (value: number) => `${value.toFixed(2)}%`;
const changeLabel = (value: number | null) => value === null ? "N/A" : `${value > 0 ? "+" : ""}${value.toFixed(2)} pp`;

function KeyMetrics({ rows }: { rows: TrendRow[] }) {
  const eligible = rows.reduce((sum, row) => sum + row.eligible, 0);
  const rate = eligible ? rows.reduce((sum, row) => sum + row.onTime, 0) / eligible * 100 : 0;
  const latest = rows.at(-1);
  return <section className="metrics-section" aria-labelledby="metrics-title"><h3 id="metrics-title">Key metrics</h3>
    <table className="metrics-table"><thead><tr><th scope="col">Metric</th><th scope="col">Value</th></tr></thead><tbody>
      <tr><th scope="row">Eligible arrivals</th><td>{number.format(eligible)}</td></tr>
      <tr><th scope="row">On-time rate</th><td>{eligible ? percentage(rate) : "N/A"}</td></tr>
      <tr><th scope="row">Change vs previous period</th><td>{changeLabel(latest?.change ?? null)}</td></tr>
    </tbody></table><p className="metric-note">Rate covers the visible periods. Change compares the latest period with the preceding calendar period in this view. N/A means that period has no eligible arrivals in this view. Weeks and periods are clipped to the selected dates.</p>
  </section>;
}

function ResultsTable({ rows, canDrill, onDrill }: { rows: TrendRow[]; canDrill: boolean; onDrill: (row: TrendRow) => void }) {
  const [sort, setSort] = useState<{ key: "start" | "eligible" | "rate" | "change"; ascending: boolean }>({ key: "start", ascending: true });
  const columns = [ ["start", "Period"], ["eligible", "Eligible arrivals"], ["rate", "On-time rate (%)"], ["change", "Change vs previous period (pp)"] ] as const;
  const sorted = [...rows].sort((a, b) => {
    const left = a[sort.key]; const right = b[sort.key];
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    const comparison = typeof left === "string" ? left.localeCompare(String(right)) : left - Number(right);
    return sort.ascending ? comparison : -comparison;
  });
  return <details className="results-disclosure"><summary><span>Results table <span className="row-count">{rows.length} periods</span></span><svg className="disclosure-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" /></svg></summary>
    <div className="table-scroll"><table className="trend-table"><caption className="sr-only">Warehouse on-time results for the current chart view</caption><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.ascending ? "ascending" : "descending" : "none"}><button type="button" onClick={() => setSort({ key, ascending: sort.key === key ? !sort.ascending : true })}>{label}<span aria-hidden="true">{sort.key === key ? sort.ascending ? "↑" : "↓" : "↕"}</span></button></th>)}</tr></thead>
      <tbody>{sorted.map((row) => <tr key={row.period}><th scope="row">{canDrill ? <button type="button" className="text-button" onClick={() => onDrill(row)} aria-label={`Drill into ${row.period}`}>{row.period}</button> : row.period}</th><td>{number.format(row.eligible)}</td><td>{percentage(row.rate)}</td><td>{changeLabel(row.change)}</td></tr>)}</tbody></table></div>
  </details>;
}

export function OnTimeResults({ result }: { result: OnTimeReport }) {
  const initialLevel = result.level;
  const [path, setPath] = useState<{ level: Level; from: string; to: string; label: string }[]>([]);
  const view = path.at(-1) ?? { level: initialLevel, from: result.from, to: result.to, label: result.companyName ?? "All companies" };
  const rows = useMemo(() => aggregateArrivals(result.arrivals, view.level, view.from, view.to), [result.arrivals, view.level, view.from, view.to]);
  const canDrill = view.level !== "Week";
  const drill = useCallback((row: TrendRow) => {
    if (!canDrill) return;
    setPath((previous) => [...previous, { level: view.level === "Quarter" ? "Month" : "Week", from: row.start, to: row.end, label: row.period }]);
  }, [canDrill, view.level]);
  return <section className="on-time-results" aria-label="On-time trend results">
    <p className="warehouse-status">Last successful query: {result.companyName ?? "All companies"}. {result.from} to {result.to}. On time means zero arrival delay.</p>
    <div className="trend-layout"><section className="chart-section" aria-labelledby="trend-title"><div className="trend-heading"><div><h3 id="trend-title">On-time rate by period</h3><p>{canDrill ? `Select a ${view.level.toLowerCase()} to view ${view.level === "Quarter" ? "months" : "weeks"}.` : "Weekly view is the most detailed reporting level."}</p></div><button type="button" className="button zoom-button" disabled={!path.length} onClick={() => setPath((previous) => previous.slice(0, -1))}>Zoom out</button></div>
      <p className="view-context" aria-live="polite">{view.label} / {view.level} · {view.from} to {view.to}</p>
      {rows.length ? <TrendChart rows={rows} canDrill={canDrill} onDrill={drill} /> : <p className="no-trends">No arrivals match this date range.</p>}
    </section><KeyMetrics rows={rows} /></div>
    <ResultsTable key={`${view.level}-${view.from}-${view.to}`} rows={rows} canDrill={canDrill} onDrill={drill} />
  </section>;
}
