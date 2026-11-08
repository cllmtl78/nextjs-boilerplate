export type InsightMeta = { provider: string; source_url: string; method_url: string; generated_at: string; as_of: string };
export type MovingInsight = { id: string; name: string; category: string; change: number; change_kind: "percent" | "level_pp"; window: "month" | "quarter"; percentile: number; rarity: "rare" | "unusual" | "typical" | "quiet"; latest_date: string; prior_date: string; history_start: string; sample_size: number; restricted: boolean; source_url: string };
export type CurveEpisode = { id: string; start_date: string; end_date: string | null; open: boolean; days: number; extreme: number | null; source_url: string };
export type InsightFeed<T> = { status: "starting" | "ok" | "stale" | "unavailable"; data: T | null };
export type MovingFeed = InsightMeta & { data: MovingInsight[]; excluded_old: number };
export type CurveFeed = InsightMeta & { data: CurveEpisode[]; open_count: number };
export type MacroInsights = { moving: InsightFeed<MovingFeed>; curve: InsightFeed<CurveFeed> };
export const insightNumber = (value: number, digits = 2) => value.toLocaleString("tr-TR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const changeNumber = (value: number) => Math.abs(value) > 0 && Math.abs(value) < 0.0001
  ? value.toLocaleString("tr-TR", { maximumSignificantDigits: 3 })
  : insightNumber(value, Math.abs(value) > 0 && Math.abs(value) < 0.01 ? 4 : 2);
export const insightChange = (row: MovingInsight) => `${row.change > 0 ? "+" : ""}${changeNumber(row.change)}${row.change_kind === "percent" ? "%" : " puan"}`;
export const insightWindow = (row: MovingInsight) => row.window === "month" ? "Aylık pencere" : "Çeyreklik pencere";
export const rarityLabel = { rare: "Çok sıra dışı", unusual: "Sıra dışı", typical: "Olağan", quiet: "Sakin" };
export function movingExplanation(row: MovingInsight) {
  const period = row.window === "month" ? "aylık" : "çeyreklik";
  const change = row.change === 0 ? "değişmedi" : `${row.change_kind === "percent" ? `yüzde ${changeNumber(Math.abs(row.change))}` : `${changeNumber(Math.abs(row.change))} puan`} ${row.change > 0 ? "arttı" : "azaldı"}`;
  return `${row.name}, kaynağın ${period} karşılaştırma penceresinde ${change}. Kaynağın tarihsel büyüklük sıralaması %${insightNumber(row.percentile)}.`;
}
