"use client";

import { useState } from "react";
import { aggregateArrivals, sampleArrivals, type Level, type TrendRow } from "./on-time-data";
import type { Filters } from "./reports";

const number = new Intl.NumberFormat("en-GB");
const percentage = (value: number) => `${value.toFixed(2)}%`;
const changeLabel = (value: number | null) => value === null ? "N/A" : `${value > 0 ? "+" : ""}${value.toFixed(2)} pp`;

function TrendChart({ rows, canDrill, onDrill }: { rows: TrendRow[]; canDrill: boolean; onDrill: (row: TrendRow) => void }) {
  return <div className="trend-chart">
    <div className="chart-scale" aria-hidden="true">{[100, 75, 50, 25, 0].map((tick) => <span key={tick}>{tick}%</span>)}</div>
    <div className="chart-scroll"><div className="chart-columns">
      {rows.map((row) => <div key={row.period} className="chart-column">
        <button type="button" className="trend-bar" style={{ height: `${row.rate}%` }} disabled={!canDrill}
          aria-label={`${row.period}: ${percentage(row.rate)} on time${canDrill ? ". Show smaller periods" : ""}`}
          title={`${row.period}: ${percentage(row.rate)}`} onClick={() => onDrill(row)}><span>{row.rate.toFixed(1)}%</span></button>
        <span className="chart-period">{row.period}</span>
      </div>)}
    </div></div>
  </div>;
}

function KeyMetrics({ rows }: { rows: TrendRow[] }) {
  const eligible = rows.reduce((sum, row) => sum + row.eligible, 0);
  const rate = eligible ? rows.reduce((sum, row) => sum + row.rate * row.eligible, 0) / eligible : 0;
  const latest = rows.at(-1);
  return <section className="metrics-section" aria-labelledby="metrics-title"><h3 id="metrics-title">Key metrics</h3>
    <table className="metrics-table"><thead><tr><th scope="col">Metric</th><th scope="col">Value</th></tr></thead><tbody>
      <tr><th scope="row">Eligible arrivals</th><td>{number.format(eligible)}</td></tr>
      <tr><th scope="row">On-time rate</th><td>{percentage(rate)}</td></tr>
      <tr><th scope="row">Change vs previous period</th><td>{changeLabel(latest?.change ?? null)}</td></tr>
    </tbody></table><p className="metric-note">Rate covers the visible periods. Change compares the latest visible period with its predecessor. N/A means no prior period in this view.</p>
  </section>;
}

function ResultsTable({ rows }: { rows: TrendRow[] }) {
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
    <div className="table-scroll"><table className="trend-table"><caption className="sr-only">Sample on-time results for the current chart view</caption><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.ascending ? "ascending" : "descending" : "none"}><button type="button" onClick={() => setSort({ key, ascending: sort.key === key ? !sort.ascending : true })}>{label}<span aria-hidden="true">{sort.key === key ? sort.ascending ? "↑" : "↓" : "↕"}</span></button></th>)}</tr></thead>
      <tbody>{sorted.map((row) => <tr key={row.period}><th scope="row">{row.period}</th><td>{number.format(row.eligible)}</td><td>{percentage(row.rate)}</td><td>{changeLabel(row.change)}</td></tr>)}</tbody></table></div>
  </details>;
}

export function OnTimeResults({ filters }: { filters: Filters }) {
  const initialLevel = filters.reporting as Level;
  const [path, setPath] = useState<{ level: Level; from: string; to: string; label: string }[]>([]);
  const view = path.at(-1) ?? { level: initialLevel, from: filters.from, to: filters.to, label: filters.period };
  const rows = aggregateArrivals(sampleArrivals, view.level, view.from, view.to);
  const canDrill = view.level !== "Week";
  function drill(row: TrendRow) {
    if (!canDrill) return;
    setPath((previous) => [...previous, { level: view.level === "Quarter" ? "Month" : "Week", from: row.start, to: row.end, label: row.period }]);
  }
  return <section className="on-time-results" aria-label="On-time trend results">
    <div className="preview-banner"><span className="preview-badge">Sample data</span><p>Interactive preview. These values do not come from a warehouse query.</p></div>
    <div className="trend-layout"><section className="chart-section" aria-labelledby="trend-title"><div className="trend-heading"><div><h3 id="trend-title">On-time rate by period</h3><p>{canDrill ? `Select a ${view.level.toLowerCase()} to view ${view.level === "Quarter" ? "months" : "weeks"}.` : "Weekly view is the most detailed reporting level."}</p></div><button type="button" className="button zoom-button" disabled={!path.length} onClick={() => setPath((previous) => previous.slice(0, -1))}>Zoom out</button></div>
      <p className="view-context" aria-live="polite">{view.label} / {view.level} · {view.from} to {view.to}</p>
      {rows.length ? <TrendChart rows={rows} canDrill={canDrill} onDrill={drill} /> : <p className="no-trends">No arrivals match this date range.</p>}
    </section><KeyMetrics rows={rows} /></div>
    <ResultsTable rows={rows} />
  </section>;
}
