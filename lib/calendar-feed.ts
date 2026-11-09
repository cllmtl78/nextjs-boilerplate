import { isCurrentNewsItem } from "./news-day";

interface CalendarReading {
  id: string;
  timestamp: number;
  actual: number | string | null;
  isCompleted: boolean;
}

// A schedule-only response must not erase a result already received that day.
export function mergeCalendarReadings<T extends CalendarReading>(previous: T[], incoming: T[], now = Date.now()): T[] {
  const known = new Map(previous.filter(item => isCurrentNewsItem(item, now)).map(item => [item.id, item]));
  return incoming.filter(item => isCurrentNewsItem(item, now)).map(item => {
    const old = known.get(item.id);
    const actual = item.actual ?? (old?.timestamp === item.timestamp ? old.actual : null);
    return { ...item, actual, isCompleted: actual !== null };
  });
}
