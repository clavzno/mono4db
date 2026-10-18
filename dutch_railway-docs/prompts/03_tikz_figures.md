# Figure Creation Using TikZ

**Task.** Figure creation using TikZ.

**Model.** Claude Opus 5.5

## Prompts

### Schema

> Using the warehouse schema in our DDL (fact tables `fact_service` and `fact_stop`, dimension tables `dim_date`, `dim_time`, `dim_station`), create a TikZ entity-relationship diagram for our ACM two-column paper.
>
> - Make it a `standalone` file in `figures/`, so it can be compiled to PNG/PDF and included with `\includegraphics`.
> - Show each table with its columns; mark primary keys and foreign keys.
> - Visually separate fact tables from dimension tables, and draw one line per foreign key with 1 and N labels.
> - Match the colours of our other figures (accent `#2F5D8C`) and keep text readable at full page width.
>
> Take the table and column names from the DDL; don't make any up. Compile the file and check that nothing overlaps.

### Query plans

> For each query in `dutch_railway/qpo/queries/` (skip `_example`), create a TikZ figure for our ACM paper that compares the baseline plan with the optimized plan.
>
> - Put the baseline on the left and the optimized plan on the right, as bottom-up operator trees (tables at the bottom, result at the top).
> - Highlight the operators that differ between the two plans in one accent colour, and add a one-line note under each side saying why the optimized version is faster.
> - Use real numbers from the saved `EXPLAIN ANALYZE` output in `qpo/results/` where they are available (row counts, loops). If a plan isn't saved or looks stale, draw that side from the SQL and tell me.
> - Use one shared style file and match our existing figures (`figures/etl_dag.tex`). Make each figure a `standalone` file that compiles to PNG.
> - Insert the figures into `chapters/qpo.tex` with captions and `\Description`s.
>
> Compile every figure, check that the layouts don't overlap, and tell me about anything you could not verify.
