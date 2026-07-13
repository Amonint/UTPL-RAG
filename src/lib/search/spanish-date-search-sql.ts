/** Lowercase Spanish month name from a 1–12 month extract expression. */
export function spanishMonthNameSql(monthNumberExpr: string): string {
  return `
    case ${monthNumberExpr}
      when 1 then 'enero'
      when 2 then 'febrero'
      when 3 then 'marzo'
      when 4 then 'abril'
      when 5 then 'mayo'
      when 6 then 'junio'
      when 7 then 'julio'
      when 8 then 'agosto'
      when 9 then 'septiembre'
      when 10 then 'octubre'
      when 11 then 'noviembre'
      when 12 then 'diciembre'
      else ''
    end
  `.trim()
}

/** SQL expression that expands an ISO date column into Spanish search tokens. */
export function buildSpanishDateSearchTextSql(dateColumnExpr: string): string {
  const monthExpr = `extract(month from ${dateColumnExpr})::int`
  const dayExpr = `extract(day from ${dateColumnExpr})::int`
  const yearExpr = `extract(year from ${dateColumnExpr})::int`
  const monthName = spanishMonthNameSql(monthExpr)
  const dayText = `${dayExpr}::text`
  const dayPadded = `lpad(${dayExpr}::text, 2, '0')`
  const monthPadded = `lpad(${monthExpr}::text, 2, '0')`

  return `
    trim(
      both
      from
      concat_ws(
        ' ',
        ${dayText},
        ${dayPadded},
        ${monthName},
        concat(${dayText}, ' ', ${monthName}),
        concat(${dayPadded}, ' ', ${monthName}),
        concat(${dayText}, ' de ', ${monthName}),
        concat(${monthName}, ' ', ${dayText}),
        concat(${monthName}, ' ', ${yearExpr}::text),
        concat(${dayText}, ' ', ${monthName}, ' ', ${yearExpr}::text),
        concat(${dayPadded}, ' ', ${monthName}, ' ', ${yearExpr}::text),
        concat(${monthPadded}, '-', ${dayPadded}),
        concat(${yearExpr}::text, '-', ${monthPadded}, '-', ${dayPadded})
      )
    )
  `.trim()
}
