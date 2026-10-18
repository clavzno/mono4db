# OLAP Application Design

**Task.** Design and implement the Dutch Railway OLAP application interface.

**Tool.** OpenAI Codex ChatGPT 6.1 Sol

**Record.** Consolidated prompt describing the design assistance requested, rather than a verbatim conversation transcript.

## Prompt

> Design the interface for `dutch_railway-app` using our wireframe and Dutch Railway reporting requirements. You may slightly modernize the design while keeping the intended layout and interactions.
>
> - Use reusable components for the shared dashboard layout, report selection, filters, charts, and results.
> - Provide report-specific filters for the four reports: company on-time trends, monthly company comparison by time of day, underperforming trains, and station delay recovery.
> - For on-time trends, support quarter-to-month-to-week drill-down and a way to return to the previous level.
> - Make the results table collapsible and sortable.
> - Use a responsive layout with clear labels and consistent spacing.
> - Clearly label sample data until the reports connect to the database.

