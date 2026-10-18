import type { ExportColumn, ExportTable, ExportValue, ReportExport } from "./report-export-types";

const numericLiteral = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function csvCell(value: ExportValue, column: ExportColumn): string {
  if (value === null) return "";
  let text = String(value);
  const isNumber = column.kind === "number" && numericLiteral.test(text);
  if (!isNumber && (/^[\s\u0000-\u001f\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function serializeCsv(table: ExportTable): string {
  const header = table.columns.map((column) => csvCell(column.name, { name: column.name, kind: "text" })).join(",");
  const rows = table.rows.map((row) => {
    if (row.length !== table.columns.length) throw new Error("Export column count does not match the results.");
    return row.map((value, index) => csvCell(value, table.columns[index])).join(",");
  });
  return "\uFEFF" + [header, ...rows].join("\r\n") + "\r\n";
}

export function exportFilename(report: ReportExport, kind: string, now = new Date()): string {
  return `${report.id}-${kind}-${now.toISOString().replaceAll(":", "-").replaceAll(".", "-")}`;
}

export async function downloadCsvPair(report: ReportExport): Promise<void> {
  const now = new Date();
  const files = [
    { name: exportFilename(report, "table", now) + ".csv", content: serializeCsv(report.table) },
    { name: exportFilename(report, "sql-results", now) + ".csv", content: serializeCsv(report.sqlOutput) },
  ];
  // Separate download dispatches so browsers can process both requests.
  for (const file of files) {
    const url = URL.createObjectURL(new Blob([file.content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (file === files[0]) await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
  }
}
