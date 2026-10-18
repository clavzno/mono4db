export type ExportValue = string | number | boolean | null;
export type ExportColumn = { name: string; kind: "text" | "number" | "boolean" };
export type ExportTable = { columns: ExportColumn[]; rows: ExportValue[][] };
export type ExportableResult = { sqlOutput: ExportTable };
export type ExportReportId = "report-1" | "report-2" | "report-3" | "report-4";
export type ReportExport = {
  id: ExportReportId;
  title: string;
  filters: [string, string][];
  table: ExportTable;
  sqlOutput: ExportTable;
};

export const numericColumn = (name: string): ExportColumn => ({ name, kind: "number" });
export const textColumn = (name: string): ExportColumn => ({ name, kind: "text" });
