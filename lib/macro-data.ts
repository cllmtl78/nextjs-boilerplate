export type MacroPoint = { date: string; value: number };
export type MacroMetric = {
  id: string; title: string; group: "rates" | "economy" | "liquidity"; series: string[];
  unit: string; digits: number; frequency: string; source: string; description: string;
  delta_unit: string; status: "ok" | "stale" | "unavailable"; value: number | null;
  low: number | null; date: string | null; previous_date: string | null; change: number | null; history: MacroPoint[];
};
export type MacroSnapshot = { status: string; last_checked: string | null; count: number; data: MacroMetric[] };
export type MacroRange = "1Y" | "3Y" | "ALL";
export const MACRO_COLORS = { rates: "#38bdf8", economy: "#fbbf24", liquidity: "#a78bfa" };
export const macroNumber = (value: number | null, digits = 2) => value === null ? "—" : value.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export function macroDate(date: string | null, frequency = "") {
  if (!date) return "Veri bekleniyor";
  return new Intl.DateTimeFormat("tr-TR", frequency === "Aylık" ? { month: "long", year: "numeric", timeZone: "UTC" } : { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}
export function macroHistory(points: MacroPoint[], range: MacroRange) {
  if (!points.length || range === "ALL") return points;
  const last = Date.parse(points[points.length - 1].date);
  const start = last - (range === "1Y" ? 365 : 3 * 365) * 86400000;
  return points.filter(point => Date.parse(point.date) >= start);
}
