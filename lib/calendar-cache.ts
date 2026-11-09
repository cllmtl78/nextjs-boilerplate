import type { CalendarUpstream } from "./calendar-sources";

// One shared request per minute per server process, including concurrent visitors.
// Cache failures too so an unavailable source is not hammered by every visitor.
export class CalendarMinuteCache<T> {
  private entry?: { day: string; expiresAt: number; promise: Promise<T> };

  constructor(private readonly now = () => Date.now()) {}

  get(day: string, fetchValue: () => Promise<T>): Promise<T> {
    const now = this.now();
    if (this.entry?.day === day && this.entry.expiresAt > now) return this.entry.promise;
    const promise = Promise.resolve().then(fetchValue);
    this.entry = { day, expiresAt: now + 60_000, promise };
    return promise;
  }

  clear(): void { this.entry = undefined; }
}

export const calendarSourceCache = new CalendarMinuteCache<CalendarUpstream>();
