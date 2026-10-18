# Report PDF and CSV Export

**Task.** Implement report PDF export and two CSV downloads from one Export CSV action for all four reports.

**Tool.** OpenAI Codex ChatGPT 6.1 Sol

**Record.** Consolidated implementation request, rather than a verbatim conversation transcript or a record of completed export functionality.

## Prompt

> Implement two export buttons for all four reports in `dutch_railway-app`:
>
> - **Export PDF:** Include the report title, applied filters, current chart, summary metrics, and full displayed results table. Use a print-friendly layout and open the browser's print dialog so the user can choose Save as PDF.
> - **Export CSV:** One click must trigger two separate CSV downloads:
>   1. **Results table CSV:** The displayed table's columns and rows in the current sort order.
>   2. **SQL query output CSV:** The complete result returned by the executed report query, before browser-side filtering, aggregation, formatting, or sorting. Preserve original column names and order, duplicate rows, nulls, and numeric precision.
>
> Do not add separate CSV buttons or combine the files into a ZIP. Both downloads must use the same successful result snapshot. If the browser requires permission for multiple downloads, explain that to the user.
>
> ## Report-specific behavior
>
> | Report | Displayed report/table export | SQL results export |
> | --- | --- | --- |
> | 1 | Current drill-down level and combined-company view | All returned per-company rollups, including overall totals |
> | 2 | Selected companies, retaining their original monthly ranks | All companies returned before browser-side company filtering |
> | 3 | Displayed trains; PDF also includes company baseline | All returned columns for the selected company, dates, and train limit |
> | 4 | Displayed stations and addition/recovery selection | Returned top-five station rows in SQL order |
>
> ## Requirements
>
> - Change only `dutch_railway-app`. Preserve existing layouts, filters, calculations, and SQL loading. Do not modify `dutch_railway`.
> - Reuse shared export controls and utilities. Replace the existing disabled export buttons.
> - Export the last successful result without rerunning SQL. Use its applied filters, not unsaved form changes. Retain original SQL rows and ordered column metadata alongside presentation data, including column headings for empty results.
> - PDF output must show only the active report, expand its results table, hide interactive controls, and handle charts and multi-page tables cleanly. Restore the screen state after printing or cancellation.
> - CSV output must use UTF-8, escape commas/quotes/line breaks, handle nulls consistently, and prevent spreadsheet formula injection without altering genuine negative numbers. Keep units in table CSV headings and preserve complete train IDs.
> - Use distinct filenames for report PDFs, table CSVs, and SQL-results CSVs. Never export credentials, connection strings, or SQL text.
> - Disable exports while querying or before results exist. Handle successful empty results explicitly.
>
> Verify PDF export and confirm that each Export CSV click initiates both downloads with distinct filenames. Check displayed versus SQL row counts, filters, sorting, Report 1 drill-down, Report 2 company selection, CSV escaping, and PDF pagination. Run TypeScript and lint checks.
