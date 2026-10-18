import type { ReportExport } from "./report-export-types";
import { exportFilename } from "./report-csv";

const escapeHtml = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

export function printHeading(report: ReportExport, now = new Date()): HTMLElement {
  const heading = document.createElement("header");
  heading.className = "report-print-heading";
  heading.innerHTML = `<h1>${escapeHtml(report.title)}</h1><dl>${report.filters.map(([name, value]) => `<div><dt>${escapeHtml(name)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl><p>Exported ${escapeHtml(now.toISOString())}</p>`;
  return heading;
}

export function printTable(report: ReportExport): string {
  return `<section class="print-results"><h2>Results table (${report.table.rows.length} rows)</h2><table><thead><tr>${report.table.columns.map((column) => `<th scope="col">${escapeHtml(column.name)}</th>`).join("")}</tr></thead><tbody>${report.table.rows.map((row) => `<tr>${row.map((cell) => `<td>${cell === null ? "N/A" : escapeHtml(String(cell))}</td>`).join("")}</tr>`).join("")}</tbody></table>${report.table.rows.length ? "" : "<p>No results matched the applied filters.</p>"}</section>`;
}

export const reportPrintStyles = `
@page { size: A4 portrait; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #17283e; background: white; font: 10pt Arial, sans-serif; }
h1 { font-size: 19pt; margin: 0 0 12px; } h2, h3 { font-size: 12pt; margin: 14px 0 8px; break-after: avoid; }
p { line-height: 1.5; } table { width: 100%; border-collapse: collapse; font-size: 9pt; }
th, td { border-bottom: 1px solid #cbd3dc; padding: 7px; text-align: left; overflow-wrap: anywhere; }
th { background: #edf2f7; } thead { display: table-header-group; }
tr, .chart-section, .train-baseline-card, .metrics-section { break-inside: avoid; }
thead th { vertical-align: bottom; } .print-results { margin-top: 18px; }
.report-print-heading { border-bottom: 2px solid #26588c; margin-bottom: 16px; padding-bottom: 8px; }
.report-print-heading dl { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
.report-print-heading dl div { min-width: 0; } dt { font-weight: bold; } dd { margin: 3px 0 7px; overflow-wrap: anywhere; }
.report-print-heading p, .warehouse-status, .metric-note { font-size: 9pt; }
.trend-layout, .train-layout { display: block; } .chart-section, .train-baseline-card, .metrics-section { margin: 0 0 16px; padding: 12px; border: 1px solid #cbd3dc; border-radius: 4px; }
.company-rate { display: grid; gap: 4px; } .company-rate strong { font-size: 20pt; }
.on-time-echart, .station-chart { width: 100%; height: auto; overflow: visible; }
.on-time-echart svg, .station-chart svg { position: static !important; display: block; width: 100%; height: auto; max-height: 85mm; }
.on-time-echart > div, .station-chart > div { width: 100% !important; height: auto !important; overflow: visible !important; }
.train-chart-scroll, .table-scroll { overflow: visible; } .train-chart { min-width: 0; }
.train-chart-row { display: grid; grid-template-columns: 58px minmax(0, 1fr) 74px; gap: 8px; align-items: center; margin: 10px 0; break-inside: avoid; }
.train-track { position: relative; height: 18px; background: #edf2f7; border-left: 1px solid #aaa; }
.train-bar { height: 100%; background: #26588c; } .train-baseline { position: absolute; top: -3px; bottom: -3px; width: 2px; background: #b18b00; }
.train-axis { display: flex; justify-content: space-between; margin: 0 82px 0 66px; font-size: 8pt; }
.train-legend span { display: inline-block; width: 14px; height: 3px; background: #b18b00; margin-right: 6px; }
.train-axis-title, .train-legend { text-align: center; font-size: 9pt; }
.chart-settings, .station-chart-controls, .zoom-button, .results-disclosure, button, .report-export-buttons { display: none !important; }
* { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
`;

export function preparePrintDocument(root: HTMLElement, report: ReportExport, now = new Date()): string {
  const copy = root.cloneNode(true) as HTMLElement;
  copy.querySelectorAll("script, iframe, object, embed, .results-disclosure, .chart-settings, .station-chart-controls, .zoom-button").forEach((node) => node.remove());
  copy.querySelectorAll("svg").forEach((svg) => {
    const width = svg.getAttribute("width"), height = svg.getAttribute("height");
    if (!svg.getAttribute("viewBox") && width && height) svg.setAttribute("viewBox", `0 0 ${parseFloat(width)} ${parseFloat(height)}`);
  });
  copy.querySelectorAll("button").forEach((button) => button.replaceWith(document.createTextNode(button.textContent ?? "")));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(exportFilename(report, "report", now))}</title><style>${reportPrintStyles}</style></head><body>${printHeading(report, now).outerHTML}${copy.outerHTML}${printTable(report)}</body></html>`;
}

export async function printReport(root: HTMLElement, report: ReportExport): Promise<void> {
  // Dynamic charts may still be loading immediately after a query completes.
  const charts = [...root.querySelectorAll(".on-time-echart, .station-chart")];
  if (charts.some((chart) => !chart.querySelector("svg")) || root.querySelector('[role="status"]')) {
    throw new Error("The chart is still loading. Try Export PDF again once it appears.");
  }
  const frame = document.createElement("iframe");
  frame.className = "report-print-frame";
  frame.title = "Report print preview";
  const now = new Date();
  const ready = new Promise<void>((resolve, reject) => {
    frame.onload = () => resolve();
    frame.onerror = () => reject(new Error("Could not prepare the report for printing."));
  });
  frame.srcdoc = preparePrintDocument(root, report, now);
  document.body.append(frame);
  try {
    await ready;
    const target = frame.contentWindow;
    if (!target) throw new Error("The browser could not open the report print dialog.");
    await target.document.fonts.ready;
    await new Promise<void>((resolve) => target.requestAnimationFrame(() => target.requestAnimationFrame(() => resolve())));
    target.addEventListener("afterprint", () => frame.remove(), { once: true });
    target.focus();
    target.print();
  } catch (error) {
    frame.remove();
    throw error;
  }
}
