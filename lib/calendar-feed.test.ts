import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mergeCalendarReadings } from "./calendar-feed";
import { mergeKapFeed } from "./kap-feed";
import { GET } from "../app/api/calendar/route";
import { istanbulDay } from "./wire-text";
import { calendarSourceCache } from "./calendar-cache";
import { clearCalendarSourceHistory } from "./calendar-sources";

beforeEach(() => { calendarSourceCache.clear(); clearCalendarSourceHistory(); });

test("calendar result arrives, survives a schedule-only refresh, and clears at Istanbul midnight", () => {
  const timestamp = Date.parse("2026-11-09T04:30:00+03:00");
  const now = Date.parse("2026-11-09T22:00:00+03:00");
  const pending = { id: "1", timestamp, actual: null as number | null, isCompleted: false };
  const released = mergeCalendarReadings([pending], [{ ...pending, actual: 0 }], now);
  assert.equal(released[0].actual, 0);
  assert.equal(released[0].isCompleted, true);
  assert.equal(mergeCalendarReadings(released, [pending], now)[0].actual, 0);
  assert.deepEqual(mergeCalendarReadings(released, [pending], Date.parse("2026-11-10T00:00:00+03:00")), []);
});

test("KAP client retains morning entries through short/empty responses and updates duplicates", () => {
  const now = Date.parse("2026-11-09T22:00:00+03:00");
  const morning = { id: 1, date: "2026-11-09T09:00:00+03:00", title: "Old" };
  const evening = { id: 2, date: "2026-11-09T17:00:00+03:00", title: "New" };
  const merged = mergeKapFeed([morning], [evening], now);
  assert.deepEqual(merged.map(item => item.id), [2, 1]);
  assert.deepEqual(mergeKapFeed(merged, [], now), merged);
  assert.equal(mergeKapFeed(merged, [{ ...morning, title: "Corrected" }], now)[1].title, "Corrected");
  assert.deepEqual(mergeKapFeed(merged, [], Date.parse("2026-11-10T00:00:00+03:00")), []);
});

test("calendar requests uncached Istanbul-day bounds and picks up newly published zero", async () => {
  const saved = globalThis.fetch;
  const day = istanbulDay(Date.now());
  let count = 0;
  globalThis.fetch = (async (input, options) => {
    const url = new URL(String(input));
    if (url.hostname !== "economic-calendar.tradingview.com") return new Response("Unavailable", { status: 503 });
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.method ?? "GET", "GET");
    assert.equal(url.searchParams.get("from"), new Date(`${day}T00:00:00+03:00`).toISOString());
    assert.equal(url.searchParams.get("to"), new Date(`${day}T23:59:59.999+03:00`).toISOString());
    return Response.json({ result: [{ id: "fresh", country: "CN", title: "CPI YoY", date: `${day}T01:30:00Z`, actual: count++ ? 0 : null }] });
  }) as typeof fetch;
  try {
    assert.equal((await (await GET()).json()).events[0].isCompleted, false);
    calendarSourceCache.clear();
    const response = await GET();
    const body = await response.json();
    assert.equal(body.events[0].actual, 0);
    assert.equal(body.events[0].isCompleted, true);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
  } finally { globalThis.fetch = saved; }
});

test("calendar empty day is valid, malformed responses and outages never produce fake events", async () => {
  const saved = globalThis.fetch;
  try {
    for (const body of [{ result: [] }, {}, { result: "invalid" }]) {
      calendarSourceCache.clear();
      globalThis.fetch = (async () => Response.json(body)) as typeof fetch;
      const response = await GET();
      const result = await response.json();
      assert.equal(response.status, Array.isArray(body.result) ? 200 : 503);
      assert.deepEqual(result.events, []);
    }
    calendarSourceCache.clear();
    globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
    const response = await GET();
    assert.equal(response.status, 503);
    assert.equal((await response.json()).success, false);
  } finally { globalThis.fetch = saved; }
});

test("opt-in diagnostics preserve raw provider field names and types", async () => {
  const saved = globalThis.fetch;
  const row = { id: "raw", country: "CN", title: "CPI YoY", date: `${istanbulDay(Date.now())}T01:30:00Z`, actual: null, actualRaw: 0, providerStatus: "example" };
  globalThis.fetch = (async () => Response.json({ result: [row] })) as typeof fetch;
  try {
    const normal = await (await GET()).json();
    assert.equal(normal.diagnostics, undefined);
    const diagnostic = await (await GET(new Request("https://example.com/api/calendar?diagnostics=1"))).json();
    assert.deepEqual(diagnostic.diagnostics.rawSample, [row]);
    assert.equal(diagnostic.diagnostics.upstreamStatus, 200);
    assert.equal(diagnostic.diagnostics.completedRows, 0);
  } finally { globalThis.fetch = saved; }
});
