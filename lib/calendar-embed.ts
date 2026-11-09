export const CALENDAR_REFRESH_MS = 60_000;

export function investingCalendarEmbedUrl(refresh?: number): string {
  const url = new URL("https://sslecal2.investing.com/");
  url.search = new URLSearchParams({
    countries: "63,5,72,37,35",
    columns: "exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous",
    calType: "day",
    timeZone: "18", // Fixed GMT+3; country id 63 is Turkey.
    lang: "10", // Turkish widget interface.
    ecoDayBackground: "#0d1322",
    ecoDayFontColor: "#94a3b8",
    defaultFont: "#e2e8f0",
    innerBorderColor: "#1e293b",
    borderColor: "#1e293b",
  }).toString();
  if (refresh !== undefined) url.searchParams.set("_refresh", String(refresh));
  return url.toString();
}
