// Adapt only known clauses in the repository's optimized SELECT queries.
// Values are bound separately; structural drift must fail instead of skipping a filter.
function replaceOnce(sql: string, pattern: RegExp, replacement: string): string {
  if ([...sql.matchAll(new RegExp(pattern.source, "g"))].length !== 1) {
    throw new Error(`Optimized query has an unexpected clause: ${pattern.source}`);
  }
  return sql.replace(pattern, () => replacement);
}

function selectOnly(sql: string): string {
  const text = sql.replace(/--[^\r\n]*/g, "").trim();
  if (!/^WITH\b/i.test(text) || (text.match(/;/g) ?? []).length !== 1 || !text.endsWith(";")) {
    throw new Error("Expected one optimized WITH query without setup statements.");
  }
  return text;
}

export function adaptOnTimeQuery(source: string): string {
  return replaceOnce(selectOnly(source), /AND fst\.arrival_delay IS NOT NULL/,
    "AND fst.arrival_delay IS NOT NULL\nAND ($1::text IS NULL OR fsv.company_name = $1)\nAND d.service_date BETWEEN $2::date AND $3::date");
}

export function adaptCompanyQuery(source: string): string {
  return replaceOnce(selectOnly(source), /t\.time_of_day = 'morning'/, "t.time_of_day = $1");
}

export function adaptTrainQuery(source: string): string {
  let sql = replaceOnce(selectOnly(source), /fsv\.company_name = 'Arriva'/,
    "fsv.company_name = $1\nAND fsv.date_key BETWEEN to_char($3::date, 'YYYYMMDD')::integer AND to_char($4::date, 'YYYYMMDD')::integer");
  sql = replaceOnce(sql, /ORDER BY company_delay_gap ASC/, "ORDER BY company_delay_gap ASC, train_id ASC");
  return replaceOnce(sql, /LIMIT 5;/, "LIMIT $2;");
}

export function adaptStationQuery(source: string, recovery = false): string {
  let sql = replaceOnce(selectOnly(source), /t\.time_of_day = 'morning'/,
    "t.time_of_day = $1\nAND fst.rdt_id IN (SELECT rdt_id FROM fact_service WHERE date_key BETWEEN to_char($2::date, 'YYYYMMDD')::integer AND to_char($3::date, 'YYYYMMDD')::integer)");
  sql = replaceOnce(sql, /ORDER BY avg_delay_change DESC/,
    `ORDER BY avg_delay_change ${recovery ? "ASC" : "DESC"}, s.station_code ASC`);
  return replaceOnce(sql, /LIMIT 5;/, "LIMIT $4;");
}
