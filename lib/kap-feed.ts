import { isCurrentNewsItem } from "./news-day";

export function mergeKapFeed<T extends { id: number; timestamp?: unknown; date?: unknown }>(previous: T[], incoming: T[], now = Date.now()): T[] {
  const records = new Map<number, T>();
  for (const item of [...previous, ...incoming]) {
    if (isCurrentNewsItem(item, now)) records.set(item.id, { ...records.get(item.id), ...item });
  }
  return [...records.values()].sort((a, b) => b.id - a.id);
}
