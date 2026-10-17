"use client";

import { useState } from "react";
import type { TrainReport, TrainRow } from "@/lib/train-report-types";

const percent = (value: number) => `${value.toFixed(1)}%`;
const gap = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
type SortKey = "trainId" | "rate" | "averageDelay" | "gap";
const columns = [["trainId", "Train ID"], ["rate", "Train on-time rate (%)"], ["averageDelay", "Average arrival delay (min)"], ["gap", "Gap vs company baseline (pp)"]] as const;

function TrainTable({ rows }: { rows: TrainRow[] }) {
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({ key: "rate", ascending: true });
  const sorted = [...rows].sort((a, b) => {
    const left = a[sort.key];
    const right = b[sort.key];
    const comparison = typeof left === "string" ? left.localeCompare(String(right), undefined, { numeric: true }) : left - Number(right);
    return sort.ascending ? comparison : -comparison;
  });
  return <details className="results-disclosure">
    <summary><span>Results table <span className="row-count">{rows.length} trains</span></span><svg className="disclosure-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="1.8" /></svg></summary>
    <div className="table-scroll"><table className="trend-table"><caption className="sr-only">Warehouse train results. Gap is train on-time rate minus company on-time rate.</caption><thead><tr>{columns.map(([key, label]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.ascending ? "ascending" : "descending" : "none"}><button type="button" onClick={() => setSort({ key, ascending: sort.key === key ? !sort.ascending : true })}>{label}<span aria-hidden="true">{sort.key === key ? sort.ascending ? "↑" : "↓" : "↕"}</span></button></th>)}</tr></thead>
      <tbody>{sorted.map((row) => <tr key={row.trainId}><th scope="row">{row.trainId}</th><td>{percent(row.rate)}</td><td>{row.averageDelay.toFixed(2)}</td><td>{gap(row.gap)}</td></tr>)}</tbody></table></div>
  </details>;
}

export function TrainResults({ result }: { result: TrainReport }) {
  const [showBaseline, setShowBaseline] = useState(true);
  const [showValues, setShowValues] = useState(true);
  const { rows, companyOnTimeRate: baseline } = result;
  const applied = <p className="warehouse-status">Last successful query: {result.companyName}. Requested {result.requestedLimit} trains; returned {rows.length}.</p>;
  if (!rows.length || baseline === null) return <section className="on-time-results" aria-label="Underperforming train results">{applied}<div className="results-panel empty-state"><h3>No eligible arrivals found</h3><p>This company has no arrivals matching the report eligibility rules.</p></div></section>;
  return <section className="on-time-results" aria-label="Underperforming train results">
    {applied}
    <div className="train-layout"><section className="chart-section" aria-labelledby="train-chart-title">
      <div className="trend-heading"><div><h3 id="train-chart-title">Worst performing trains by on-time rate</h3><p>Overall on-time rate across the dataset, ranked lowest first. On time means zero arrival delay.</p></div>
        <details className="chart-settings"><summary>Settings</summary><div><label><input type="checkbox" checked={showBaseline} onChange={(event) => setShowBaseline(event.target.checked)} />Company baseline</label><label><input type="checkbox" checked={showValues} onChange={(event) => setShowValues(event.target.checked)} />Rate labels</label></div></details>
      </div>
      <p className="view-context">{result.companyName} / {rows.length} lowest-ranked trains</p>
      <div className="train-chart-scroll"><div className="train-chart" role="img" aria-label={`On-time rates of ${rows.length} trains, from 0 to 100 percent. Company baseline ${percent(baseline)}. Exact values are in the results table.`}>
        {rows.map((row) => <div className="train-chart-row" key={row.trainId}><span className="train-id">{row.trainId}</span><div className="train-track"><div className="train-bar" style={{ width: `${row.rate}%` }} />{showBaseline ? <span className="train-baseline" style={{ left: `${baseline}%` }} /> : null}</div><span className="train-rate">{showValues ? percent(row.rate) : null}</span></div>)}
        <div className="train-axis"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>
      </div></div>
      <p className="train-axis-title">On-time rate (%)</p>{showBaseline ? <p className="train-legend"><span />Company on-time baseline: {percent(baseline)}</p> : null}
    </section>
    <aside className="train-baseline-card" aria-label="Company comparison summary"><h3>Company on-time rate baseline</h3><div className="company-rate"><strong>{percent(baseline)}</strong><span>{result.companyName}</span></div><dl><div><dt>Comparison basis</dt><dd>Company average</dd></div><div><dt>Lowest train for {rows.length} trains</dt><dd>Train {rows[0]?.trainId ?? "N/A"}</dd></div></dl><p className="metric-note">Baseline covers all eligible arrivals for the company. A negative gap means the train falls below this baseline.</p></aside></div>
    <TrainTable rows={rows} />
  </section>;
}
