"use client";

import { DisclosureChevron } from "./disclosure-chevron";

import { useState } from "react";
import type { TrainReport, TrainRow } from "@/lib/train-report-types";

const minutes = (value: number) => `${value.toFixed(2)} min`;
const percent = (value: number) => `${value.toFixed(2)}%`;
const gap = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
type SortKey = "trainId" | "rate" | "averageDelay" | "gap";
const columns = [["trainId", "Train ID"], ["rate", "Train on-time rate (%)"], ["averageDelay", "Average arrival delay (min)"], ["gap", "Company minus train delay (min)"]] as const;

function TrainTable({ rows }: { rows: TrainRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({ key: "gap", ascending: true });
  const sorted = [...rows].sort((a, b) => {
    const left = a[sort.key];
    const right = b[sort.key];
    const comparison = typeof left === "string" ? left.localeCompare(String(right), undefined, { numeric: true }) : left - Number(right);
    return sort.ascending ? comparison : -comparison;
  });
  return <details className="results-disclosure">
    <summary><span>Results table <span className="row-count">{rows.length} trains</span></span><DisclosureChevron /></summary>
    <div className="table-scroll"><table className="trend-table"><caption className="sr-only">Warehouse train results. Gap is company average arrival delay minus train average arrival delay, in minutes.</caption><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.ascending ? "ascending" : "descending" : "none"}><button type="button" onClick={() => setSort({ key, ascending: sort.key === key ? !sort.ascending : true })}>{label}<span aria-hidden="true">{sort.key === key ? sort.ascending ? "↑" : "↓" : "↕"}</span></button></th>)}</tr></thead>
      <tbody>{sorted.map((row) => <tr key={row.trainId}><th scope="row">{row.trainId}</th><td>{percent(row.rate)}</td><td>{row.averageDelay.toFixed(2)}</td><td>{gap(row.gap)}</td></tr>)}</tbody></table></div>
  </details>;
}

export function TrainResults({ result }: { result: TrainReport }) {
  const [showBaseline, setShowBaseline] = useState(true);
  const [showValues, setShowValues] = useState(true);
  const { rows, companyAverageDelay: baseline } = result;
  const maximumDelay = Math.max(1, baseline ?? 0, ...rows.map((row) => row.averageDelay)) * 1.1;
  const applied = <p className="warehouse-status">Last successful query: {result.companyName}, {result.from} to {result.to}. Requested {result.requestedLimit} trains; returned {rows.length}.</p>;
  if (!rows.length || baseline === null) return <section className="on-time-results" aria-label="Underperforming train results">{applied}<div className="results-panel empty-state"><h3>No eligible arrivals found</h3><p>This company has no eligible arrivals in the selected date range.</p></div></section>;
  return <section className="on-time-results" aria-label="Underperforming train results">
    {applied}
    <div className="train-layout"><section className="chart-section" aria-labelledby="train-chart-title">
      <div className="trend-heading"><div><h3 id="train-chart-title">Worst performing trains by arrival delay</h3><p>Ranked by company average delay minus train average delay, lowest gap first.</p></div>
        <details className="chart-settings"><summary>Settings</summary><div><label><input type="checkbox" checked={showBaseline} onChange={(event) => setShowBaseline(event.target.checked)} />Company baseline</label><label><input type="checkbox" checked={showValues} onChange={(event) => setShowValues(event.target.checked)} />Delay labels</label></div></details>
      </div>
      <p className="view-context">{result.companyName} / {rows.length} trains ranked by delay gap</p>
      <div className="train-chart-scroll"><div className="train-chart" role="img" aria-label={`Average arrival delays of ${rows.length} trains in minutes. Company baseline ${minutes(baseline)}. Exact values are in the results table.`}>
        {rows.map((row) => <div className="train-chart-row" key={row.trainId}><span className="train-id">{row.trainId}</span><div className="train-track"><div className="train-bar" style={{ width: `${100 * row.averageDelay / maximumDelay}%` }} />{showBaseline ? <span className="train-baseline" style={{ left: `${100 * baseline / maximumDelay}%` }} /> : null}</div><span className="train-rate">{showValues ? minutes(row.averageDelay) : null}</span></div>)}
        <div className="train-axis">{[0, 0.25, 0.5, 0.75, 1].map((fraction) => <span key={fraction}>{(fraction * maximumDelay).toFixed(1)}</span>)}</div>
      </div></div>
      <p className="train-axis-title">Average arrival delay (min)</p>{showBaseline ? <p className="train-legend"><span />Company average arrival delay: {minutes(baseline)}</p> : null}
    </section>
    <aside className="train-baseline-card" aria-label="Company comparison summary"><h3>Company average arrival delay</h3><div className="company-rate"><strong>{minutes(baseline)}</strong><span>{result.companyName}</span></div><dl><div><dt>Comparison basis</dt><dd>Company average</dd></div><div><dt>Largest delay gap among {rows.length} trains</dt><dd>Train {rows[0]?.trainId ?? "N/A"}</dd></div></dl><p className="metric-note">Baseline covers all eligible arrivals for the company within the selected date range. A negative gap means the train has a greater average delay than the company baseline.</p></aside></div>
    <TrainTable rows={rows} />
  </section>;
}
