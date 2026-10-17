"use client";

import { useState } from "react";
import Link from "next/link";
import { OnTimeResults } from "./on-time-results";
import { TrainResults } from "./train-results";
import { useTrainReport } from "./use-train-report";
import { defaultsForReport, validTrainCount, filterDefinitions, isConfiguration, reports, type Filters, type ReportId } from "./reports";

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
  </div>;
  return <div className="filter-grid">{report.fields.map((key) => {
    const field = filterDefinitions[key];
    return <div className="filter-field" key={key}>{key === "reporting" ? <fieldset><legend>{field.label}</legend><div className="segmented-control">{field.options.map((option) => <button type="button" key={option} aria-pressed={filters[key] === option} onClick={() => onChange(key, option)}>{option}</button>)}</div></fieldset> : <><label htmlFor={key}>{field.label}</label><select id={key} value={filters[key]} onChange={(event) => onChange(key, event.target.value)}>{field.options.map((option) => <option key={option}>{option}</option>)}</select></>}</div>;
  })}<div className="date-range">{(["from", "to"] as const).map((key) => <div className="filter-field" key={key}><label htmlFor={key}>{key === "from" ? "From" : "To"}</label><input id={key} type="date" min="2025-01-01" max="2025-12-31" value={filters[key]} onChange={(event) => onChange(key, event.target.value)} required /></div>)}</div></div>;
}

function ReportActions({ onReset, onCopy, onPaste, runDisabled = false, busy = false }: { onReset: () => void; onCopy: () => void; onPaste: () => void; runDisabled?: boolean; busy?: boolean }) {
  return <div className="report-actions"><div className="action-group"><button type="submit" className="button primary" disabled={runDisabled} aria-busy={busy}><span aria-hidden="true">▷</span> {busy ? "Running query…" : "Run Query"}</button><button type="button" className="button" onClick={onReset}>Reset Filters</button><span className="action-divider" /><button type="button" className="button" disabled title="Temporarily unavailable" onClick={onCopy}>Copy Config</button><button type="button" className="button" disabled title="Temporarily unavailable" onClick={onPaste}>Paste Config</button></div><div className="action-group"><button type="button" className="button" disabled title="Available when report results are connected">Download Report</button><button type="button" className="button" disabled title="Available when report results are connected">Export CSV</button></div></div>;
}

export function RailwayDashboard({ onTimeReport = false, initialReport = "on-time" }: { onTimeReport?: boolean; initialReport?: ReportId }) {
  const [selected, setSelected] = useState<ReportId>(initialReport);
  const [configurations, setConfigurations] = useState<Record<ReportId, Filters>>(() => Object.fromEntries(reports.map((report) => [report.id, defaultsForReport(report.id)])) as Record<ReportId, Filters>);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [submittedFilters, setSubmittedFilters] = useState<Filters>(defaultsForReport("on-time"));
  const trainReport = useTrainReport(selected === "trains");
  const [queryVersion, setQueryVersion] = useState(0);
  const report = reports.find((item) => item.id === selected)!;
  const storedFilters = configurations[selected];
  const filters = selected === "trains" ? { ...storedFilters, company: storedFilters.company || trainReport.companies[0] || "" } : storedFilters;

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
  async function copyConfig() {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ version: 1, report: selected, filters }, null, 2));
      setNotice({ error: false, text: "Configuration copied. Paste it to restore this report and its filters." });
    } catch { setNotice({ error: true, text: "Clipboard access failed. Allow clipboard access in your browser and try again." }); }
  }
  async function pasteConfig() {
    try {
      const config: unknown = JSON.parse(await navigator.clipboard.readText());
      if (!isConfiguration(config)) throw new Error("invalid");
      setConfigurations((previous) => ({ ...previous, [config.report]: { ...defaultsForReport(config.report), ...config.filters } }));
      setSelected(config.report);
      setNotice({ error: false, text: "Configuration restored." });
    } catch { setNotice({ error: true, text: "Could not paste configuration. Copy a valid dashboard configuration and allow clipboard access, then try again." }); }
  }
  return <div className="dashboard-shell">
    <header className="site-header"><div className="header-inner"><Link href="/" className="brand"><span className="brand-mark"><RailMark /></span><span>Dutch Railway</span></Link><span className="dataset-badge">2025 dataset</span></div></header>
    <main className="dashboard-main"><div className="page-heading"><div><h1>Railway performance</h1><p>Explore the journeys behind the numbers.</p></div></div>
      <ReportNavigation selected={selected} onSelect={(id) => { setSelected(id); setNotice(null); }} />
      <section aria-labelledby="report-title" className="report-panel"><div className="panel-heading"><div><h2 id="report-title">{report.title}</h2><p>{report.description}</p></div><span className="filter-indicator">Filters</span></div>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (selected === "trains") {
            if (!trainReport.companies.includes(filters.company) || !validTrainCount(filters.trainCount === "Custom" ? filters.customTrainCount : filters.trainCount)) {
              setNotice({ error: true, text: "Select a company and enter a whole number of trains from 1 to 100." });
              return;
            }
            setNotice(null);
            void trainReport.run(filters.company, Number(filters.trainCount === "Custom" ? filters.customTrainCount : filters.trainCount));
          } else if (filters.from > filters.to) {
            setNotice({ error: true, text: "Choose an end date on or after the start date." });
          } else if (onTimeReport && selected === "on-time") {
            setSubmittedFilters({ ...filters });
            setQueryVersion((previous) => previous + 1);
            setNotice({ error: false, text: "Sample preview updated. Warehouse query integration is pending." });
          } else {
            setNotice({ error: true, text: "Report queries are not connected yet. Your filters are ready for the data connection." });
          }
        }}>
          <ReportFilters report={report} filters={filters} onChange={changeFilter} companies={trainReport.companies} companiesReady={trainReport.companyStatus === "ready"} />
          <ReportActions busy={selected === "trains" && trainReport.busy} runDisabled={selected === "trains" && (trainReport.busy || trainReport.companyStatus !== "ready" || !trainReport.companies.length)} onReset={() => { setConfigurations((previous) => ({ ...previous, [selected]: defaultsForReport(selected) })); setNotice(null); }} onCopy={copyConfig} onPaste={pasteConfig} />
        </form>
      </section>
      {notice ? <div className={`notice ${notice.error ? "notice-error" : "notice-success"}`} role={notice.error ? "alert" : "status"}><span>{notice.text}</span><button type="button" aria-label="Dismiss message" onClick={() => setNotice(null)}>×</button></div> : null}
      {selected === "trains" ? <section aria-label="Warehouse train report" aria-busy={trainReport.busy}>
        {trainReport.companyStatus === "idle" || trainReport.companyStatus === "loading" ? <p className="warehouse-status" role="status">Loading companies from the warehouse…</p> : null}
        {trainReport.companyError ? <div className="notice notice-error" role="alert"><span>{trainReport.companyError}</span><button type="button" className="button" onClick={trainReport.retryCompanies}>Retry companies</button></div> : null}
        {trainReport.companyStatus === "ready" && !trainReport.companies.length ? <p className="warehouse-status">No companies are available in the warehouse.</p> : null}
        {trainReport.busy ? <p className="warehouse-status" role="status">Querying the warehouse. Any results below are from the last successful query.</p> : null}
        {trainReport.error ? <div className="notice notice-error" role="alert"><span>{trainReport.error} {trainReport.result ? "The last successful results remain below." : ""}</span></div> : null}
        {trainReport.result ? <TrainResults key={trainReport.version} result={trainReport.result} /> : <section className="results-panel"><div className="empty-state"><h3>Choose your company, then run the query</h3><p>Compare its lowest-ranked trains with the overall company on-time baseline.</p></div></section>}
      </section> : onTimeReport && selected === "on-time" ? <OnTimeResults key={queryVersion} filters={submittedFilters} /> : <section aria-label={`${report.title} results`} className="results-panel"><div className="results-toolbar"><h2>Report results</h2><span>Waiting for query</span></div><div className="empty-state"><div className="empty-graphic" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /></div><h3>Your next insight starts here</h3><p>Set your filters above, then run a query<br className="hidden sm:block" /> to explore {report.title.toLowerCase()}.</p>{selected === "on-time" ? <Link className="empty-hint" href="/report-1">Open On-time Trends</Link> : <span className="empty-hint">Start with the filters above</span>}</div></section>}
    </main>
  </div>;
}
