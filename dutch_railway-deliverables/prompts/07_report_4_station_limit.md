# Report 4 Customizable Station Limit

**Task.** Add a customizable station limit to the Report 4 page.

**Tool.** OpenAI Codex ChatGPT 6.1 Sol

**Record.** Consolidated prompt describing the requested Report 4 change, rather than a verbatim conversation transcript.

## Prompt

> Make the page for report-4 allow a customizable LIMIT in `dutch_railway-app`, similar to the train count selector in Report 3.
>
> - Add a "Stations to show" selector with 5, 10, 20, and Custom options. Allow custom whole numbers from 1 to 100.
> - The original optimized query has `LIMIT 5`. Replace that fixed limit with the selected count in the application's SQL adapter. Do not change any files in `dutch_railway`.
> - Keep the date range, time of day, and largest delay increase or greatest recovery filters. Apply the limit after ranking the stations.
> - Update the chart, results table, summary, and exports to use the last successful query's station count. Keep the existing page layout and collapsible, sortable table.
> - Default to 5 stations and restore that value when Reset Filters is clicked. Validate the count in both the page and API.
>
> Verify the preset and custom counts, both ranking options, reset behavior, and SQL output. Run TypeScript and lint checks.
