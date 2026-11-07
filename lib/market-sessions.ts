export const EXCHANGES = [
  { name: "BIST", zone: "Europe/Istanbul", open: 10 * 3600, close: 18 * 3600 },
  { name: "LSE", zone: "Europe/London", open: 8 * 3600, close: 16 * 3600 + 30 * 60 },
  { name: "NYSE", zone: "America/New_York", open: 9 * 3600 + 30 * 60, close: 16 * 3600 },
] as const;

export function marketSessions(now: Date) {
  return EXCHANGES.map(exchange => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: exchange.zone, weekday: "short", hour: "2-digit",
      minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(now);
    const value = (type: string) => parts.find(part => part.type === type)?.value || "";
    const seconds = Number(value("hour")) * 3600 + Number(value("minute")) * 60 + Number(value("second"));
    const weekday = !["Sat", "Sun"].includes(value("weekday"));
    const isOpen = weekday && seconds >= exchange.open && seconds < exchange.close;
    const remaining = exchange.close - seconds;
    const countdown = isOpen ? [Math.floor(remaining / 3600), Math.floor(remaining % 3600 / 60), remaining % 60]
      .map(number => String(number).padStart(2, "0")).join(":") : null;
    return { name: exchange.name, isOpen, countdown };
  });
}
