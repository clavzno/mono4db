"use client";

import { useReportExport } from "./report-export";
import { numericColumn, textColumn } from "@/lib/report-export-types";
import dynamic from "next/dynamic";
import { DisclosureChevron } from "./disclosure-chevron";
import { useCallback, useMemo, useState } from "react";
import { combineRollups, type RollupView, type DisplayTrendRow as TrendRow } from "./on-time-data";
import type { OnTimeReport } from "@/lib/on-time-report-types";
const TrendChart = dynamic(() => import("./on-time-chart"), { ssr: false, loading: () => <p className="warehouse-status" role="status">Loading chart…</p> });

const number = new Intl.NumberFormat("en-GB");
const percentage = (value: number) => `${value.toFixed(2)}%`;
const changeLabel = (value: number | null) => value === null ? "N/A" : `${value > 0 ? "+" : ""}${value.toFixed(2)} pp`;

function KeyMetrics({ rows }: { rows: TrendRow[] }) {
  const eligible = rows.reduce((sum, row) => sum + row.eligible, 0);
  const rate = eligible ? rows.reduce((sum, row) => sum + row.rate * row.eligible, 0) / eligible : 0;
  const latest = rows.at(-1);
  return <section className="metrics-section" aria-labelledby="metrics-title"><h3 id="metrics-title">Key metrics</h3>
    <table className="metrics-table"><thead><tr><th scope="col">Metric</th><th scope="col">Value</th></tr></thead><tbody>
      <tr><th scope="row">Eligible arrivals</th><td>{number.format(eligible)}</td></tr>
      <tr><th scope="row">On-time rate</th><td>{eligible ? percentage(rate) : "N/A"}</td></tr>
      <tr><th scope="row">Change vs previous period</th><td>{changeLabel(latest?.change ?? null)}</td></tr>
    </tbody></table><p className="metric-note">Rate covers the visible periods. Change compares the latest period with the preceding period in the queried date range. N/A means no preceding period is available. All-company rates weight the returned company rates by eligible arrivals; source rounding may affect the last decimal. Dates filter eligible arrivals; weeks follow the assigned month and quarter.</p>
  </section>;
}

function ResultsTable({ rows, canDrill, onDrill, result, viewLabel }: { result: OnTimeReport; viewLabel: string; rows: TrendRow[]; canDrill: boolean; onDrill: (row: TrendRow) => void }) {
  const [sort, setSort] = useState<{ key: "order" | "eligible" | "rate" | "change"; ascending: boolean }>({ key: "order", ascending: true });
  const columns = [ ["order", "Period"], ["eligible", "Eligible arrivals"], ["rate", "On-time rate (%)"], ["change", "Change vs previous period (pp)"] ] as const;
  const sorted = [...rows].sort((a, b) => {
    const left = a[sort.key]; const right = b[sort.key];
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    const comparison = left - right;
    return sort.ascending ? comparison : -comparison;
  });
  useReportExport({ id: "report-1", title: "On-time Trends", filters: [["Company", result.companyName ?? "All companies"], ["Service dates", result.from + " to " + result.to], ["View", viewLabel]], sqlOutput: result.sqlOutput, table: {
    columns: [textColumn("Period"), numericColumn("Eligible arrivals"), numericColumn("On-time rate (%)"), numericColumn("Change vs previous period (pp)")],
    rows: sorted.map((row) => [row.period, row.eligible, row.rate.toFixed(2), row.change === null ? null : row.change.toFixed(2)]),
  } });
  return <details className="results-disclosure"><summary><span>Results table <span className="row-count">{rows.length} periods</span></span><DisclosureChevron /></summary>
    <div className="table-scroll"><table className="trend-table"><caption className="sr-only">Warehouse on-time results for the current chart view</caption><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.ascending ? "ascending" : "descending" : "none"}><button type="button" onClick={() => setSort({ key, ascending: sort.key === key ? !sort.ascending : true })}>{label}<span aria-hidden="true">{sort.key === key ? sort.ascending ? "↑" : "↓" : "↕"}</span></button></th>)}</tr></thead>
      <tbody>{sorted.map((row) => <tr key={row.period}><th scope="row">{canDrill ? <button type="button" className="text-button" onClick={() => onDrill(row)} aria-label={`Drill into ${row.period}`}>{row.period}</button> : row.period}</th><td>{number.format(row.eligible)}</td><td>{percentage(row.rate)}</td><td>{changeLabel(row.change)}</td></tr>)}</tbody></table></div>
  </details>;
}

export function OnTimeResults({ result }: { result: OnTimeReport }) {
  const initialLevel = result.level;
  const [path, setPath] = useState<(RollupView & { label: string })[]>([]);
  const view = useMemo(() => path.at(-1) ?? { level: initialLevel, label: result.companyName ?? "All companies" }, [path, initialLevel, result.companyName]);
  const rows = useMemo(() => combineRollups(result.rows, view, result.from.slice(0, 4)), [result.rows, view, result.from]);
  const canDrill = view.level !== "Week";
  const drill = useCallback((row: TrendRow) => {
    if (!canDrill) return;
    setPath((previous) => [...previous, { level: view.level === "Quarter" ? "Month" : "Week", quarter: row.quarter ?? undefined, month: row.month ?? undefined, label: row.period }]);
  }, [canDrill, view.level]);
  return <section className="on-time-results" data-export-report="report-1" aria-label="On-time trend results">
    <p className="warehouse-status">Last successful query: {result.companyName ?? "All companies"}. {result.from} to {result.to}. On time means zero arrival delay.</p>
    <div className="trend-layout"><section className="chart-section" aria-labelledby="trend-title"><div className="trend-heading"><div><h3 id="trend-title">On-time rate by period</h3><p>{canDrill ? `Select a ${view.level.toLowerCase()} to view ${view.level === "Quarter" ? "months" : "weeks"}.` : "Weekly view is the most detailed reporting level."}</p></div><button type="button" className="button zoom-button" disabled={!path.length} onClick={() => setPath((previous) => previous.slice(0, -1))}>Zoom out</button></div>
      <p className="view-context" aria-live="polite">{view.label} / {view.level} · {result.from} to {result.to}</p>
      {rows.length ? <TrendChart rows={rows} canDrill={canDrill} onDrill={drill} /> : <p className="no-trends">No arrivals match this date range.</p>}
    </section><KeyMetrics rows={rows} /></div>
    <ResultsTable key={JSON.stringify(view)} result={result} viewLabel={`${view.label} / ${view.level}`} rows={rows} canDrill={canDrill} onDrill={drill} />
  </section>;
}
