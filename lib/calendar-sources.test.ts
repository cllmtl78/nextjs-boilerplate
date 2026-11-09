import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { clearCalendarSourceHistory, fetchCalendarSource, parseInvestingCalendar } from "./calendar-sources";
import { calendarSourceCache } from "./calendar-cache";
import { GET } from "../app/api/calendar/route";
import { istanbulDay } from "./wire-text";

beforeEach(() => { clearCalendarSourceHistory(); calendarSourceCache.clear(); });

// Synthetic HTML follows the semantic ids/cells used in investpy's news parser.
// This verifies parsing and fallback behavior, not live provider accessibility.
function fixture(day: string, actual = "0.0%", id = "101"): string {
  return `<table id="economicCalendarData"><tbody><tr id="eventRowId_${id}" data-event-datetime="${day.replaceAll("-", "/")} 04:30:00">
    <td class="first left time">04:30</td><td class="flagCur"><span title="China"></span> CNY</td>
    <td class="sentiment" data-img_key="bull3"></td><td class="left event"><a>CPI (YoY)</a></td>
    <td id="eventActual_${id}" class="act">${actual}</td><td id="eventForecast_${id}" class="fore">0.8%</td><td id="eventPrevious_${id}" class="prev">0.9%</td>
  </tr></tbody></table>`;
}

test("Investing actual, forecast and previous cells remain separate, zero and timezone are preserved", () => {
  const [row] = parseInvestingCalendar(fixture("2026-11-09"), "2026-11-09");
  assert.equal(row.id, "investing:101");
  assert.equal(row.actual, "0.0%");
  assert.equal(row.forecast, "0.8%");
  assert.equal(row.previous, "0.9%");
  assert.equal(row.date, "2026-11-09T01:30:00.000Z");
  assert.equal(row.country, "CN");
  assert.equal(row.importance, 2);
  assert.equal(parseInvestingCalendar(fixture("2026-11-09").replace(/<\/?(?:table|tbody)[^>]*>/g, ""), "2026-11-09")[0].actual, "0.0%");
  assert.equal(parseInvestingCalendar(fixture("2026-11-09", ""), "2026-11-09")[0].actual, null);
  assert.deepEqual(parseInvestingCalendar(fixture("2026-11-08"), "2026-11-09"), []);
  assert.throws(() => parseInvestingCalendar("<html>Access denied</html>", "2026-11-09"), /table missing/);
});

test("Investing service paginates, filters countries and becomes the API's primary source", async () => {
  const saved = globalThis.fetch;
  const day = istanbulDay(Date.now());
  const offsets: string[] = [];
  globalThis.fetch = (async (input, options) => {
    assert.ok(String(input).startsWith("https://www.investing.com/"));
    assert.equal(options?.method, "POST");
    const form = new URLSearchParams(String(options?.body));
    assert.equal(form.get("dateFrom"), day);
    assert.equal(form.get("dateTo"), day);
    assert.equal(form.get("timeZone"), "18");
    assert.deepEqual(form.getAll("country[]"), ["63", "5", "72", "37", "35"]);
    const offset = form.get("limit_from")!;
    offsets.push(offset);
    return Response.json({ data: (offset === "0" ? fixture(day) : offset === "1" ? fixture(day, "1.2%", "102") : "").replace(/<\/?(?:table|tbody)[^>]*>/g, "") });
  }) as typeof fetch;
  try {
    const body = await (await GET()).json();
    assert.equal(body.success, true);
    assert.equal(body.source, "investing");
    assert.equal(body.degraded, false);
    assert.equal(body.events.length, 2);
    assert.equal(body.events[0].actual, "0.0%");
    assert.equal(body.events[0].isCompleted, true);
    assert.equal(body.events[0].time, "04:30");
    assert.deepEqual(offsets, ["0", "1", "2"]);
  } finally { globalThis.fetch = saved; }
});

test("blocked service uses Investing's public widget before TradingView", async () => {
  const saved = globalThis.fetch;
  const day = "2026-11-09";
  globalThis.fetch = (async input => {
    const url = new URL(String(input));
    if (url.hostname === "www.investing.com") return new Response("Forbidden", { status: 403 });
    assert.equal(url.hostname, "sslecal2.investing.com");
    assert.equal(url.searchParams.get("timeZone"), "18");
    return new Response(fixture(day, "1.1%"));
  }) as typeof fetch;
  try {
    const result = await fetchCalendarSource(day);
    assert.equal(result.source, "investing");
    assert.equal(result.data.result[0].actual, "1.1%");
  } finally { globalThis.fetch = saved; }
});

test("Investing outage retains its last results; a new day never reuses them", async () => {
  const saved = globalThis.fetch;
  let offline = false;
  globalThis.fetch = (async (input, options) => {
    if (offline) {
      if (String(input).includes("tradingview")) return Response.json({ result: [] });
      return new Response("Unavailable", { status: 503 });
    }
    const page = new URLSearchParams(String(options?.body)).get("limit_from");
    return Response.json({ data: page === "0" ? fixture("2026-11-09") : "" });
  }) as typeof fetch;
  try {
    const original = await fetchCalendarSource("2026-11-09");
    offline = true;
    const stale = await fetchCalendarSource("2026-11-09");
    assert.equal(stale.stale, true);
    assert.deepEqual(stale.data, original.data);
    const nextDay = await fetchCalendarSource("2026-11-10");
    assert.equal(nextDay.source, "tradingview");
    assert.equal(nextDay.degraded, true);
    assert.deepEqual(nextDay.data.result, []);
  } finally { globalThis.fetch = saved; }
});

test("fallback is explicit when both Investing endpoints fail", async () => {
  const saved = globalThis.fetch;
  globalThis.fetch = (async input => String(input).includes("tradingview")
    ? Response.json({ result: [{ id: "tv", actual: null }] }) : new Response("Forbidden", { status: 403 })) as typeof fetch;
  try {
    const result = await fetchCalendarSource("2026-11-09");
    assert.equal(result.source, "tradingview");
    assert.equal(result.degraded, true);
    assert.match(result.fallbackReason!, /HTTP 403/);
  } finally { globalThis.fetch = saved; }
});
