"use client";

import "./report-export.css";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ExportReportId, ReportExport } from "@/lib/report-export-types";
import { downloadCsvPair, exportFilename } from "@/lib/report-csv";
import { printHeading, printReport } from "@/lib/report-print";

type ExportRegistry = {
  register: (report: ReportExport) => () => void;
  get: (id: ExportReportId) => ReportExport | undefined;
};
const ExportContext = createContext<ExportRegistry | null>(null);

function reportRoot(id: ExportReportId) {
  return document.querySelector<HTMLElement>(`[data-export-report="${id}"]`);
}

export function ReportExportProvider({ children }: { children: ReactNode }) {
  const reports = useRef(new Map<ExportReportId, ReportExport>());
  const register = useCallback((report: ReportExport) => {
    reports.current.set(report.id, report);
    return () => { if (reports.current.get(report.id) === report) reports.current.delete(report.id); };
  }, []);
  const get = useCallback((id: ExportReportId) => reports.current.get(id), []);
  const registry = useMemo(() => ({ register, get }), [register, get]);

  useEffect(() => {
    let restore: (() => void) | undefined;
    function beforePrint() {
      restore?.();
      const report = [...reports.current.values()].find((entry) => {
        const root = reportRoot(entry.id);
        return root && !root.closest("[hidden]") && root.getClientRects().length > 0;
      });
      if (!report) return;
      const root = reportRoot(report.id)!;
      const disclosures = [...root.querySelectorAll<HTMLDetailsElement>("details.results-disclosure")];
      const states = disclosures.map((node) => node.open);
      const header = printHeading(report);
      root.prepend(header);
      disclosures.forEach((node) => { node.open = true; });
      const title = document.title;
      document.title = exportFilename(report, "report");
      document.body.classList.add("report-printing");
      restore = () => {
        header.remove();
        disclosures.forEach((node, index) => { node.open = states[index]; });
        document.title = title;
        document.body.classList.remove("report-printing");
        window.dispatchEvent(new Event("resize"));
        restore = undefined;
      };
    }
    const afterPrint = () => restore?.();
    window.addEventListener("beforeprint", beforePrint);
    window.addEventListener("afterprint", afterPrint);
    return () => { afterPrint(); window.removeEventListener("beforeprint", beforePrint); window.removeEventListener("afterprint", afterPrint); };
  }, []);
  return <ExportContext.Provider value={registry}>{children}</ExportContext.Provider>;
}

export function useReportExport(report: ReportExport) {
  const registry = useContext(ExportContext);
  if (!registry) throw new Error("Report exports require ReportExportProvider.");
  useEffect(() => registry.register(report), [registry, report]);
}

export function ExportButtons({ reportId, disabled }: { reportId: ExportReportId; disabled: boolean }) {
  const registry = useContext(ExportContext);
  const [preparing, setPreparing] = useState<"pdf" | "csv" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  async function run(pdf: boolean) {
    try {
      setMessage(null);
      const report = registry?.get(reportId);
      if (!report) throw new Error("Run a report query before exporting.");
      if (pdf) {
        const root = reportRoot(reportId);
        if (!root) throw new Error("The report is not available for printing.");
        setPreparing("pdf");
        await printReport(root, report);
        setMessage("Print dialog opened. Choose Save as PDF.");
      } else {
        setPreparing("csv");
        await downloadCsvPair(report);
        setMessage("Two CSV downloads requested: displayed table and SQL results. Allow multiple downloads if prompted. SQL results may include rows hidden by the table filter. Nulls use empty fields; import train IDs as text in spreadsheets.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed. Try again.");
    } finally {
      setPreparing(null);
    }
  }
  return <div className="report-export-buttons"><div className="action-group"><button type="button" className="button" disabled={disabled || preparing !== null} title="Opens the print dialog. Choose Save as PDF." onClick={() => void run(true)}>{preparing === "pdf" ? "Preparing PDF..." : "Export PDF"}</button><button type="button" className="button" disabled={disabled || preparing !== null} title="Downloads the displayed table and SQL results as two CSV files." onClick={() => void run(false)}>{preparing === "csv" ? "Exporting CSV..." : "Export CSV"}</button></div>{message ? <p className="export-message" role="status">{message}</p> : null}</div>;
}
