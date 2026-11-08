export const COMPARISON_RANGES = [{ value: "1M", label: "1A", days: 30 }, { value: "3M", label: "3A", days: 90 }, { value: "1Y", label: "1Y", days: 365 }, { value: "5Y", label: "5Y", days: 1825 }] as const;
export type ComparisonRange = typeof COMPARISON_RANGES[number]["value"];
export type ComparisonSeries = { code: string; values: (number | null)[] };
export type ComparisonData = { base: string; dates: string[]; series: ComparisonSeries[]; missing: string[]; start: string | null; end: string | null; stale?: boolean };

/** Source is quote/base. Invert it so rising USD with TRY base means USD gains vs TRY. */
export function buildCurrencyComparison(value: unknown, base: string, quotes: string[]): ComparisonData {
  if (!Array.isArray(value)) throw new Error("Invalid history");
  const maps = new Map(quotes.map(code => [code, new Map<string, number>()]));
  for (const row of value) {
    if (!row || row.base !== base || !maps.has(row.quote) || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date)) || typeof row.rate !== "number" || !Number.isFinite(row.rate) || row.rate <= 0) continue;
    maps.get(row.quote)!.set(row.date, row.rate);
  }
  const valid = quotes.filter(code => maps.get(code)!.size >= 2);
  const missing = quotes.filter(code => !valid.includes(code));
  const empty: ComparisonData = { base, dates: [], series: [], missing, start: null, end: null };
  if (!valid.length) return empty;
  const common = [...maps.get(valid[0])!.keys()].filter(date => valid.every(code => maps.get(code)!.has(date))).sort();
  if (common.length < 2) return { ...empty, missing: quotes };
  const start = common[0], end = common[common.length - 1];
  const dates = [...new Set(valid.flatMap(code => [...maps.get(code)!.keys()]))].filter(date => date >= start && date <= end).sort();
  const series = valid.map(code => {
    const rates = maps.get(code)!;
    const first = rates.get(start)!;
    return { code, values: dates.map(date => rates.has(date) ? (first / rates.get(date)! - 1) * 100 : null) };
  });
  return { base, dates, series, missing, start, end };
}

export function comparisonRangeDates(range: ComparisonRange, today: string) {
  const item = COMPARISON_RANGES.find(item => item.value === range)!;
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - item.days * 86400000).toISOString().slice(0, 10);
  return { from, to: today, group: item.days > 365 ? "week" : null };
}
