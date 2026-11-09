// htmlparser2 preserves the bare <tr> fragments returned by the JSON service.
import { load } from "cheerio/slim";
import { istanbulDay } from "./wire-text";

export interface CalendarUpstream {
  data: { result: Record<string, unknown>[] };
  source: "investing" | "tradingview";
  sourceUrl: string;
  status: number;
  fetchedAt: string;
  degraded?: boolean;
  stale?: boolean;
  fallbackReason?: string;
}

const SERVICE = "https://www.investing.com/economic-calendar/Service/getCalendarFilteredData";
const COUNTRIES: Record<string, string> = { turkey: "TR", türkiye: "TR", "united states": "US", "united states of america": "US", "euro zone": "EU", eurozone: "EU", japan: "JP", china: "CN" };
const COUNTRY_IDS = [63, 5, 72, 37, 35];
const HEADERS = { "User-Agent": "Mozilla/5.0", Accept: "application/json,text/html", Referer: "https://www.investing.com/economic-calendar/" };

function value(text: string): string | null {
  const clean = text.replace(/\s+/g, " ").trim();
  return /^(?:|--?|n\/a|null)$/i.test(clean) ? null : clean;
}

// Select semantic cells, never infer actuals from forecasts or previous readings.
// Investing's requested timezone is fixed GMT+3 (id 18).
export function parseInvestingCalendar(html: string, day: string): Record<string, unknown>[] {
  const $ = load(html);
  if (!$("tr[id^='eventRowId_']").length && !$("#economicCalendarData").length && !/no\s+(?:economic\s+)?events|noEvent/i.test($.text())) {
    throw new Error("Investing calendar table missing");
  }
  const events: Record<string, unknown>[] = [];
  let sectionDay = day;
  $("tr").each((_, element) => {
    const row = $(element);
    const dateHeader = row.find("td[id^='theDay']").attr("id");
    if (dateHeader && /^theDay\d{10}$/.test(dateHeader)) sectionDay = istanbulDay(Number(dateHeader.slice(6)) * 1000);
    const id = row.attr("id")?.match(/^eventRowId_(\d+)$/)?.[1];
    if (!id) return;
    const name = row.find("td.flagCur span[title]").attr("title")?.trim().toLowerCase() || "";
    const country = COUNTRIES[name];
    if (!country) return;
    const titleCell = row.find("td.event");
    const title = (titleCell.find("a").first().text() || titleCell.text()).replace(/\s+/g, " ").trim();
    const clock = row.find("td.time, td.first.left").first().text().trim();
    const rawDate = row.attr("data-event-datetime");
    let date: string;
    if (rawDate && /^\d{4}[/-]\d{2}[/-]\d{2}[ T]\d{2}:\d{2}(?::\d{2})?$/.test(rawDate)) {
      date = `${rawDate.replaceAll("/", "-").replace(" ", "T")}+03:00`;
    } else if (/^\d{2}:\d{2}$/.test(clock)) date = `${sectionDay}T${clock}:00+03:00`;
    else return; // Never invent a publication time for all-day/unscheduled rows.
    const timestamp = Date.parse(date);
    if (!title || !Number.isFinite(timestamp) || istanbulDay(timestamp) !== day) return;
    const actual = value(row.find(`#eventActual_${id}, td.act`).first().text());
    const forecast = value(row.find(`#eventForecast_${id}, td.fore`).first().text());
    const previous = value(row.find(`#eventPrevious_${id}, td.prev`).first().text());
    const impact = row.find("td.sentiment").attr("data-img_key")?.match(/bull(\d)/)?.[1];
    events.push({ id: `investing:${id}`, title, country, date: new Date(timestamp).toISOString(), actual, forecast, previous,
      currency: row.find("td.flagCur").text().trim(), importance: impact ? Number(impact) - 1 : 0 });
  });
  return events;
}

async function fetchInvesting(day: string): Promise<CalendarUpstream> {
  const errors: string[] = [];
  // Published calendar HTML endpoint; no login, API key or challenge bypass.
  try {
    const signal = AbortSignal.timeout(6000);
    const records = new Map<string, Record<string, unknown>>();
    for (let page = 0; page < 10; page++) {
      const body = new URLSearchParams({ dateFrom: day, dateTo: day, timeZone: "18", timeFilter: "timeOnly", currentTab: "custom", submitFilters: "1", limit_from: String(page) });
      COUNTRY_IDS.forEach(id => body.append("country[]", String(id)));
      const response = await fetch(SERVICE, { method: "POST", headers: { ...HEADERS, "X-Requested-With": "XMLHttpRequest", "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(), cache: "no-store", signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload: unknown = await response.json();
      if (!payload || typeof payload !== "object" || !("data" in payload) || typeof payload.data !== "string") throw new Error("Invalid calendar HTML response");
      if (!payload.data.trim()) return { data: { result: [...records.values()] }, source: "investing", sourceUrl: SERVICE, status: 200, fetchedAt: new Date().toISOString() };
      const parsed = parseInvestingCalendar(payload.data, day);
      if (!parsed.length && /eventRowId_\d+/.test(payload.data)) throw new Error("No supported dated records in Investing response");
      const size = records.size;
      for (const item of parsed) records.set(String(item.id), item);
      if (records.size === size) return { data: { result: [...records.values()] }, source: "investing", sourceUrl: SERVICE, status: 200, fetchedAt: new Date().toISOString() };
    }
    throw new Error("Calendar pagination exceeded safe page limit");
  } catch (error) { errors.push(`service: ${error instanceof Error ? error.message : "failed"}`); }

  // The provider's public embedding page serves the same actual/forecast cells.
  try {
    const url = new URL("https://sslecal2.investing.com/");
    url.search = new URLSearchParams({ countries: COUNTRY_IDS.join(","), columns: "exc_flags,exc_currency,exc_importance,exc_actual,exc_forecast,exc_previous", calType: "day", timeZone: "18", lang: "1" }).toString();
    const response = await fetch(url, { headers: HEADERS, cache: "no-store", signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const rows = parseInvestingCalendar(html, day);
    if (!rows.length && /eventRowId_\d+/.test(html)) throw new Error("No supported dated records in Investing widget");
    return { data: { result: rows }, source: "investing", sourceUrl: url.toString(), status: response.status, fetchedAt: new Date().toISOString() };
  } catch (error) { errors.push(`widget: ${error instanceof Error ? error.message : "failed"}`); }
  throw new Error(`Investing unavailable (${errors.join("; ")})`);
}

let lastInvesting: { day: string; response: CalendarUpstream } | undefined;

export function clearCalendarSourceHistory(): void { lastInvesting = undefined; }

export async function fetchCalendarSource(day: string): Promise<CalendarUpstream> {
  if (lastInvesting?.day !== day) lastInvesting = undefined;
  let fallbackReason: string;
  try {
    const response = await fetchInvesting(day);
    lastInvesting = { day, response };
    return response;
  } catch (error) {
    fallbackReason = error instanceof Error ? error.message : "Investing unavailable";
    console.warn("[Takvim]", fallbackReason);
    if (lastInvesting) return { ...lastInvesting.response, stale: true, fallbackReason };
  }
  const from = new Date(`${day}T00:00:00+03:00`).toISOString();
  const to = new Date(Date.parse(from) + 86_400_000 - 1).toISOString();
  const url = new URL("https://economic-calendar.tradingview.com/events");
  url.search = new URLSearchParams({ from, to, countries: "TR,US,EU,CN,JP", minImportance: "-1" }).toString();
  const response = await fetch(url, { headers: { Accept: "application/json", Origin: "https://www.tradingview.com", Referer: "https://www.tradingview.com/" }, cache: "no-store", signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`TradingView HTTP ${response.status}; ${fallbackReason}`);
  const data: unknown = await response.json();
  if (!data || typeof data !== "object" || !("result" in data) || !Array.isArray(data.result)) throw new Error("Invalid calendar response");
  return { data: { result: data.result }, source: "tradingview", sourceUrl: url.toString(), status: response.status, fetchedAt: new Date().toISOString(), degraded: true, fallbackReason };
}
