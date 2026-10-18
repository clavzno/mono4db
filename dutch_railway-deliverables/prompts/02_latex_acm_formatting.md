# LaTeX and ACM Template Formatting

**Task.** LaTeX formatting and ACM template formatting.

**Model.** Claude Opus 5.5

## Prompt

> Our report uses the ACM `acmart` class with the `sigconf` option (see `paper.tex`). Please reformat every table in `paper.tex` and `chapters/*.tex` so they follow the ACM template:
>
> - Use `booktabs` rules (`\toprule`, `\midrule`, `\bottomrule`) and no vertical lines.
> - Put the caption above the table, and give each table a `\label` and a `\Description` for accessibility.
> - Make tables fit the column (`\columnwidth`, with `tabularx` for long text); use `table*` only when a table cannot fit in one column.
> - Right-align numbers and use thousands separators.
>
> Do not change any numbers or wording inside the tables. When you're done, list each table you changed and what you changed, and point out any table you weren't sure about.
