"use client";

import { validDate } from "@/lib/on-time-report-types";
import { useState } from "react";
import Link from "next/link";
import { OnTimeResults } from "./on-time-results";
import { StationReport } from "./station-report";
import { CompanyReport } from "./company-report";
import { TrainResults } from "./train-results";
import { useTrainReport } from "./use-train-report";
import { useOnTimeReport } from "./use-on-time-report";
import { useWarehouseCompanies } from "./use-warehouse-companies";
import { defaultsForReport, validTrainCount, filterDefinitions, reports, type Filters, type ReportId } from "./reports";

function RailMark() {
  return <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="7" y="3" width="18" height="22" rx="5" stroke="currentColor" strokeWidth="2"/><path d="M8 15h16M16 4v11M11 25l-3 5m13-5 3 5M10 28h12" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="20" r="1.5" fill="currentColor"/><circle cx="20" cy="20" r="1.5" fill="currentColor"/></svg>;
}

function ReportNavigation({ selected, onSelect }: { selected: ReportId; onSelect: (id: ReportId) => void }) {
  return <nav aria-label="Reports" className="report-navigation"><span className="report-label">Report</span><div className="report-links">{reports.map((report) => <button key={report.id} type="button" aria-pressed={selected === report.id} className={`report-tab ${selected === report.id ? "selected" : ""}`} onClick={() => onSelect(report.id)}>{report.title}</button>)}</div></nav>;
}

function ReportFilters({ report, filters, onChange, companies, companiesReady }: { report: (typeof reports)[number]; filters: Filters; onChange: (key: keyof Filters, value: string) => void; companies: string[]; companiesReady: boolean }) {
  if (report.id === "trains") return <div className="filter-grid train-filter-grid">
    <div className="filter-field"><label htmlFor="train-company">Company</label><select id="train-company" required disabled={!companiesReady || !companies.length} value={filters.company} onChange={(event) => onChange("company", event.target.value)}>{!companies.length ? <option value="">{companiesReady ? "No companies available" : "Companies unavailable"}</option> : companies.map((company) => <option key={company}>{company}</option>)}</select><p className="filter-help">Select one company.</p></div>
    <div className="filter-field"><fieldset><legend>Number of worst trains to show</legend><div className="segmented-control">{["5", "10", "20", "Custom"].map((count) => <button key={count} type="button" aria-pressed={filters.trainCount === count} onClick={() => onChange("trainCount", count)}>{count}</button>)}</div></fieldset>{filters.trainCount === "Custom" ? <div className="custom-train-count"><label htmlFor="custom-train-count">Number of trains (1–100)</label><input id="custom-train-count" type="number" min="1" max="100" step="1" required value={filters.customTrainCount} onChange={(event) => onChange("customTrainCount", event.target.value)} /></div> : null}</div>
    <div className="date-range">{(["from", "to"] as const).map((key) => <div className="filter-field" key={key}><label htmlFor={`train-${key}`}>{key === "from" ? "From" : "To"}</label><input id={`train-${key}`} type="date" min="2025-01-01" max="2025-12-31" required value={filters[key]} onChange={(event) => onChange(key, event.target.value)} /></div>)}</div>
  </div>;
  return <div className="filter-grid">{report.fields.map((key) => {
    const field = filterDefinitions[key];
    const options = key === "company" ? ["All companies", ...companies] : field.options;
    return <div className="filter-field" key={key}>{key === "reporting" ? <fieldset><legend>{field.label}</legend><div className="segmented-control">{field.options.map((option) => <button type="button" key={option} aria-pressed={filters[key] === option} onClick={() => onChange(key, option)}>{option}</button>)}</div></fieldset> : <><label htmlFor={key}>{field.label}</label><select id={key} disabled={key === "company" && !companiesReady} value={filters[key]} onChange={(event) => onChange(key, event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></>}</div>;
  })}<div className="date-range">{(["from", "to"] as const).map((key) => <div className="filter-field" key={key}><label htmlFor={key}>{key === "from" ? "From" : "To"}</label><input id={key} type="date" min="2025-01-01" max="2025-12-31" value={filters[key]} onInput={(event) => onChange(key, event.currentTarget.value)} required /></div>)}</div></div>;
}

function ReportActions({ onReset, runDisabled = false, busy = false }: { onReset: () => void; runDisabled?: boolean; busy?: boolean }) {
  return <div className="report-actions"><div className="action-group"><button type="submit" className="button primary" disabled={runDisabled} aria-busy={busy}>{busy ? "Running query…" : "Run Query"}</button><button type="button" className="button" onClick={onReset}>Reset Filters</button></div><div className="action-group"><button type="button" className="button" disabled title="Available when report results are connected">Download Report</button><button type="button" className="button" disabled title="Available when report results are connected">Export CSV</button></div></div>;
}

export function RailwayDashboard({ initialReport = "on-time" }: { initialReport?: ReportId }) {
  const [selected, setSelected] = useState<ReportId>(initialReport);
  const [configurations, setConfigurations] = useState<Record<ReportId, Filters>>(() => Object.fromEntries(reports.map((report) => [report.id, defaultsForReport(report.id)])) as Record<ReportId, Filters>);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const companyOptions = useWarehouseCompanies(selected === "trains" || selected === "on-time");
  const trainReport = useTrainReport();
  const onTimeReport = useOnTimeReport();
  const report = reports.find((item) => item.id === selected)!;
  const storedFilters = configurations[selected];
  const filters = selected === "trains" ? { ...storedFilters, company: storedFilters.company || companyOptions.companies[0] || "" } : storedFilters;
  const queryBusy = selected === "on-time" ? onTimeReport.busy : selected === "trains" && trainReport.busy;
  const queryDisabled = queryBusy || ((selected === "on-time" || selected === "trains") && companyOptions.companyStatus !== "ready") || (selected === "trains" && !companyOptions.companies.length);

  function changeFilter(key: keyof Filters, value: string) {
    setNotice(null);
    setConfigurations((previous) => {
      const next = { ...previous[selected], [key]: value };
      if (key === "from" || key === "to") next.period = "Custom dates";
      if (key === "period" && value !== "Custom dates") {
        const quarter = /^Q([1-4])/.exec(value)?.[1];
        const month = quarter ? (Number(quarter) - 1) * 3 : 0;
        next.from = `2025-${String(month + 1).padStart(2, "0")}-01`;
        next.to = quarter ? new Date(Date.UTC(2025, month + 3, 0)).toISOString().slice(0, 10) : "2025-12-31";
      }
      return { ...previous, [selected]: next };
    });
  }
  return <div className="dashboard-shell">
    <header className="site-header"><div className="header-inner"><Link href="/" className="brand"><span className="brand-mark"><RailMark /></span><span>Dutch Railway</span></Link><span className="dataset-badge">2025 dataset</span></div></header>
    <main className="dashboard-main"><div className="page-heading"><div><h1>Railway performance</h1><p>Explore the journeys behind the numbers.</p></div></div>
      <ReportNavigation selected={selected} onSelect={(id) => { setSelected(id); setNotice(null); }} />
      <div hidden={selected === "stations" || selected === "companies"}>
      <section aria-labelledby="report-title" className="report-panel"><div className="panel-heading"><div><h2 id="report-title">{report.title}</h2><p>{report.description}</p></div><span className="filter-indicator">Filters</span></div>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!validDate(filters.from) || !validDate(filters.to) || filters.from > filters.to || filters.from < "2025-01-01" || filters.to > "2025-12-31") {
            setNotice({ error: true, text: "Choose a valid date range within 2025, with the end on or after the start." });
            return;
          }
          if (selected === "trains") {
            if (!companyOptions.companies.includes(filters.company) || !validTrainCount(filters.trainCount === "Custom" ? filters.customTrainCount : filters.trainCount)) {
              setNotice({ error: true, text: "Select a company and enter a whole number of trains from 1 to 100." });
              return;
            }
            setNotice(null);
            void trainReport.run(filters.company, Number(filters.trainCount === "Custom" ? filters.customTrainCount : filters.trainCount), filters.from, filters.to);
          } else if (filters.from > filters.to) {
            setNotice({ error: true, text: "Choose an end date on or after the start date." });
          } else if (selected === "on-time") {
            if (filters.company !== "All companies" && !companyOptions.companies.includes(filters.company)) {
              setNotice({ error: true, text: "Choose a company from the warehouse list." });
              return;
            }
            setNotice(null);
            void onTimeReport.run({ ...filters });
          } else {
            setNotice({ error: true, text: "Report queries are not connected yet. Your filters are ready for the data connection." });
          }
        }}>
          <ReportFilters report={report} filters={filters} onChange={changeFilter} companies={companyOptions.companies} companiesReady={companyOptions.companyStatus === "ready"} />
          <ReportActions busy={queryBusy} runDisabled={queryDisabled} onReset={() => { setConfigurations((previous) => ({ ...previous, [selected]: defaultsForReport(selected) })); setNotice(null); }} />
        </form>
      </section>
      {notice ? <div className={`notice ${notice.error ? "notice-error" : "notice-success"}`} role={notice.error ? "alert" : "status"}><span>{notice.text}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button></div> : null}
      {selected === "trains" || selected === "on-time" ? <>
        {companyOptions.companyStatus === "idle" || companyOptions.companyStatus === "loading" ? <p className="warehouse-status" role="status">Loading companies from the warehouse…</p> : null}
        {companyOptions.companyError ? <div className="notice notice-error" role="alert"><span>{companyOptions.companyError}</span><button type="button" className="button" onClick={companyOptions.retryCompanies}>Retry companies</button></div> : null}
        {companyOptions.companyStatus === "ready" && !companyOptions.companies.length ? <p className="warehouse-status">No companies are available in the warehouse.</p> : null}
      </> : null}
      {selected === "trains" ? <section aria-label="Warehouse train report" aria-busy={trainReport.busy}>
        {trainReport.busy ? <p className="warehouse-status" role="status">Querying the warehouse. Any results below are from the last successful query.</p> : null}
        {trainReport.error ? <div className="notice notice-error" role="alert"><span>{trainReport.error} {trainReport.result ? "The last successful results remain below." : ""}</span></div> : null}
        {trainReport.result ? <TrainResults key={trainReport.version} result={trainReport.result} /> : <section className="results-panel"><div className="empty-state"><h3>Choose your company, then run the query</h3><p>Compare its worst delay gaps with the company average arrival delay.</p></div></section>}
      </section> : selected === "on-time" ? <section aria-label="Warehouse on-time report" aria-busy={onTimeReport.busy}>
        {onTimeReport.busy ? <p className="warehouse-status" role="status">Querying the warehouse. Any results below are from the last successful query.</p> : null}
        {onTimeReport.error ? <div className="notice notice-error" role="alert">{onTimeReport.error} {onTimeReport.result ? "The last successful results remain below." : ""}</div> : null}
        {onTimeReport.result ? <OnTimeResults key={onTimeReport.version} result={onTimeReport.result} /> : <section className="results-panel empty-state"><h3>Choose your filters, then run the query</h3><p>Explore company punctuality by quarter, month, and week.</p></section>}
      </section> : <section aria-label={`${report.title} results`} className="results-panel"><div className="results-toolbar"><h2>Report results</h2><span>Waiting for query</span></div><div className="empty-state"><div className="empty-graphic" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /></div><h3>Your next insight starts here</h3><p>Set your filters above, then run a query<br className="hidden sm:block" /> to explore {report.title.toLowerCase()}.</p><span className="empty-hint">Start with the filters above</span></div></section>}
      </div>
      <div hidden={selected !== "stations"}><StationReport /></div>
      <div hidden={selected !== "companies"}><CompanyReport /></div>
    </main>
  </div>;
}
