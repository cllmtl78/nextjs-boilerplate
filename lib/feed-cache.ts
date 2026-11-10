import { isCurrentNewsItem, newsTimestamp } from "./news-day";
import { istanbulDay } from "./wire-text";

interface FeedItem { id: string; timestamp?: unknown; date?: unknown }
const EMPTY: FeedItem[] = [];
const memory = new Map<string, { raw: string | null; day: string; items: FeedItem[] }>();
const listeners = new Set<() => void>();

export function subscribeFeedCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function emptyFeedCache<T extends FeedItem>(): T[] { return EMPTY as T[]; }

// Stable snapshots let React hydrate the server's empty feed, then show today's
// local cache immediately without a hydration mismatch or network dependency.
export function readFeedCache<T extends FeedItem>(key: string): T[] {
  if (typeof window === "undefined") return emptyFeedCache<T>();
  const day = istanbulDay(Date.now());
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* Memory cache still works. */ }
  const known = memory.get(key);
  if (known?.raw === raw && known.day === day) return known.items as T[];
  let items: FeedItem[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) items = parsed.filter(item => item && typeof item.id === "string" && isCurrentNewsItem(item));
  } catch { /* Invalid cache is ignored. */ }
  memory.set(key, { raw, day, items });
  return items as T[];
}

export function mergeFeedCache<T extends FeedItem>(previous: T[], incoming: T[]): T[] {
  const items = new Map<string, T>();
  for (const item of [...previous, ...incoming]) if (isCurrentNewsItem(item)) items.set(item.id, item);
  return [...items.values()].sort((a, b) => (newsTimestamp(b.timestamp ?? b.date) || 0) - (newsTimestamp(a.timestamp ?? a.date) || 0)).slice(0, 200);
}

export function writeFeedCache<T extends FeedItem>(key: string, items: T[]): void {
  const current = mergeFeedCache([], items);
  let raw: string | null = JSON.stringify(current);
  try { localStorage.setItem(key, raw); } catch {
    try { raw = localStorage.getItem(key); } catch { raw = null; }
  }
  memory.set(key, { raw, day: istanbulDay(Date.now()), items: current });
  listeners.forEach(listener => listener());
}
