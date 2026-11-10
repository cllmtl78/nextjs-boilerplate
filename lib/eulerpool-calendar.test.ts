import { test } from "node:test";
import assert from "node:assert/strict";
import fixture from "./fixtures/eulerpool-calendar.json";
import { fetchEulerpoolCalendar, normalizeEulerpoolCalendar } from "./eulerpool-calendar";
import { fetchCalendarSource } from "./calendar-sources";
import { formatCalendarValue } from "./calendar-values";
import { istanbulDay } from "./wire-text";
import { calendarSourceCache } from "./calendar-cache";
import { GET } from "../app/api/calendar/route";

test("real Eulerpool records include China's published 0.7% and zero, preserving consensus separately", () => {
  const rows = normalizeEulerpoolCalendar(fixture, "2026-11-09");
  const annual = rows.find(row => row.title === "Inflation Rate YoY")!;
  const monthly = rows.find(row => row.title === "Inflation Rate MoM")!;
  assert.equal(annual.actual, "0.7%");
  assert.equal(annual.forecast, "0.8%");
  assert.equal(annual.previous, "0.9%");
  assert.equal(monthly.actual, "0%");
  assert.equal(monthly.forecast, "0%");
  assert.equal(monthly.previous, "0.2%");
  assert.equal(annual.date, "2026-11-09T01:30:00.000Z");
  assert.equal(formatCalendarValue(monthly.actual as string, monthly), "0%");
});

test("real reserve/count records retain independent scales without multiplying or appending units twice", () => {
  for (const [index, expected] of [[2, "48.44B $"], [3, "43.994K"]] as const) {
    const original = fixture[index];
    const [row] = normalizeEulerpoolCalendar([original], istanbulDay(Number(original.timestamp)));
    assert.equal(row.actual, expected);
    assert.equal(formatCalendarValue(row.actual as string, row), expected);
  }
});

test("only today's supported countries are displayed; forecast fills absent consensus, never actual", () => {
  const original = fixture[0];
  const missing = { ...original, actual_value: null, consensus_value: null, forecast_value: 0.2 };
  const rows = normalizeEulerpoolCalendar([missing, { ...missing, country_code: "fr" }, { ...missing, timestamp: "bad" }], "2026-11-09");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].actual, null);
  assert.equal(rows[0].forecast, "0.2%");
  assert.deepEqual(normalizeEulerpoolCalendar([original], "2026-11-10"), []);
  assert.throws(() => normalizeEulerpoolCalendar([{}], "2026-11-09"), /unsupported schema/);
});

test("configured Eulerpool key selects correct endpoint, Istanbul bounds and exactly one request", async () => {
  const previousKey = process.env.EULERPOOL_API_KEY;
  const saved = globalThis.fetch;
  const key = "test-eulerpool-key";
  let calls = 0;
  process.env.EULERPOOL_API_KEY = key;
  globalThis.fetch = (async input => {
    calls++;
    const url = new URL(String(input));
    assert.equal(url.hostname, "api.eulerpool.com");
    assert.equal(url.pathname, "/api/1/macro/calendar");
    assert.equal(url.searchParams.get("token"), key);
    assert.equal(url.searchParams.get("start"), String(Date.parse("2026-11-09T00:00:00+03:00")));
    assert.equal(url.searchParams.get("end"), String(Date.parse("2026-11-09T23:59:59.999+03:00")));
    assert.equal(url.searchParams.get("countries"), "tr,us,cn,jp");
    return Response.json(fixture);
  }) as typeof fetch;
  try {
    const result = await fetchCalendarSource("2026-11-09");
    assert.equal(result.source, "eulerpool");
    assert.equal(calls, 1);
    assert.ok(result.data.result.some(row => row.actual === "0.7%"));
    assert.ok(!JSON.stringify(result).includes(key));
  } finally {
    globalThis.fetch = saved;
    if (previousKey === undefined) delete process.env.EULERPOOL_API_KEY;
    else process.env.EULERPOOL_API_KEY = previousKey;
  }
});

test("token-bearing connection errors are sanitized; API failures stay failures", async () => {
  const saved = globalThis.fetch;
  try {
    globalThis.fetch = (async () => { throw new Error("https://api.eulerpool.com/?token=secret"); }) as typeof fetch;
    await assert.rejects(fetchEulerpoolCalendar("2026-11-09", "secret"), error => error instanceof Error && !error.message.includes("secret"));
    globalThis.fetch = (async () => new Response("private details", { status: 401 })) as typeof fetch;
    await assert.rejects(fetchEulerpoolCalendar("2026-11-09", "secret"), /HTTP 401/);
  } finally { globalThis.fetch = saved; }
});

test("API returns native-calendar readings and completed zero without exposing the key", async () => {
  const saved = globalThis.fetch;
  const previousKey = process.env.EULERPOOL_API_KEY;
  const key = "private-fixture-key";
  const day = istanbulDay(Date.now());
  const timestamp = String(Date.parse(`${day}T01:30:00Z`));
  const rows = fixture.slice(0, 2).map(row => ({ ...row, timestamp }));
  process.env.EULERPOOL_API_KEY = key;
  calendarSourceCache.clear();
  globalThis.fetch = (async () => Response.json(rows)) as typeof fetch;
  try {
    const response = await GET(new Request("https://example.com/api/calendar?diagnostics=1"));
    const body = await response.json();
    assert.equal(body.source, "eulerpool");
    assert.equal(body.events.length, 2);
    const monthly = body.events.find((row: { originalTitle: string }) => row.originalTitle === "Inflation Rate MoM");
    assert.equal(monthly.actual, "0%");
    assert.equal(monthly.isCompleted, true);
    assert.equal(monthly.time, "04:30");
    assert.equal(formatCalendarValue(monthly.actual, monthly), "0%");
    assert.equal(body.diagnostics.eulerpoolKeyConfigured, true);
    assert.ok(!JSON.stringify(body).includes(key));
  } finally {
    globalThis.fetch = saved;
    calendarSourceCache.clear();
    if (previousKey === undefined) delete process.env.EULERPOOL_API_KEY;
    else process.env.EULERPOOL_API_KEY = previousKey;
  }
});
