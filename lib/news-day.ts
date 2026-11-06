import { istanbulDay } from "./wire-text";

export function newsTimestamp(value: unknown): number | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return null;
    const timestamp = value < 100_000_000_000 ? value * 1000 : value;
    return Number.isFinite(new Date(timestamp).getTime()) ? timestamp : null;
  }
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (/^(?:\d{10}|\d{13})$/.test(text)) return newsTimestamp(Number(text));
  let normalized = text;
  const turkishDate = text.match(/^(\d{2})[./](\d{2})[./](\d{4})(?:\s+(\d{2}:\d{2}(?::\d{2})?))?$/);
  if (turkishDate) normalized = `${turkishDate[3]}-${turkishDate[2]}-${turkishDate[1]}T${turkishDate[4] || "00:00:00"}+03:00`;
  else {
    if (!/^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(text)) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) normalized += "T00:00:00+03:00";
    else if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) normalized += "+03:00";
  }
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isCurrentNewsDay(value: unknown, now = Date.now()): boolean {
  const timestamp = newsTimestamp(value);
  return timestamp !== null && istanbulDay(timestamp) === istanbulDay(now);
}

export function isCurrentNewsItem(item: { timestamp?: unknown; date?: unknown; dateObj?: unknown }, now = Date.now()): boolean {
  for (const value of [item.timestamp, item.date, item.dateObj]) {
    if (newsTimestamp(value) !== null) return isCurrentNewsDay(value, now);
  }
  return false;
}

export function untilIstanbulMidnight(now = Date.now()): number {
  return Date.parse(`${istanbulDay(now)}T00:00:00+03:00`) + 86400000 - now;
}

interface DayClock {
  now(): number;
  schedule(callback: () => void, delay: number): number;
  cancel(timer: number): void;
  onWake(callback: () => void): () => void;
}

// Visibility/focus also check the date after browser sleep or timer throttling.
export function watchIstanbulDay(onChange: () => void, clock: DayClock = {
  now: () => Date.now(),
  schedule: (callback, delay) => window.setTimeout(callback, delay),
  cancel: timer => window.clearTimeout(timer),
  onWake: callback => {
    window.addEventListener("focus", callback);
    document.addEventListener("visibilitychange", callback);
    return () => { window.removeEventListener("focus", callback); document.removeEventListener("visibilitychange", callback); };
  },
}): () => void {
  let day = istanbulDay(clock.now());
  let timer: number;
  const check = () => {
    const now = clock.now();
    const currentDay = istanbulDay(now);
    if (day !== currentDay) { day = currentDay; onChange(); }
    clock.cancel(timer);
    timer = clock.schedule(check, untilIstanbulMidnight(now) + 1);
  };
  timer = clock.schedule(check, untilIstanbulMidnight(clock.now()) + 1);
  const removeWake = clock.onWake(check);
  return () => { clock.cancel(timer); removeWake(); };
}

export const DAILY_NEWS_CACHE_KEYS = ["bpt_bist_news", "bpt_global_walter_v1", "bpt_global_news_v2", "bpt_kap_cache", "bpt_kap_disclosures", "bpt_kap_disclosures_v3", "bpt_kap_disclosures_v4"];

export function resetDailyNewsCache(storage: Pick<Storage, "removeItem" | "setItem">, now = Date.now()): void {
  for (const key of DAILY_NEWS_CACHE_KEYS) storage.removeItem(key);
  storage.setItem("bpt_kap_last_date", istanbulDay(now));
}
