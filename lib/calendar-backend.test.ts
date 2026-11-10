import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/calendar/route";
import { calendarSourceCache } from "./calendar-cache";
import { istanbulDay } from "./wire-text";
import fixture from "./fixtures/eulerpool-calendar.json";

test("Next.js uses the Render key through the backend and reports that key location", async () => {
  const saved = globalThis.fetch;
  const previous = process.env.EULERPOOL_API_KEY;
  delete process.env.EULERPOOL_API_KEY;
  calendarSourceCache.clear();
  const day = istanbulDay(Date.now());
  const records = fixture.slice(0, 2).map(row => ({ ...row, timestamp: String(Date.parse(`${day}T01:30:00Z`)) }));
  globalThis.fetch = (async input => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/api/macro/calendar");
    assert.equal(url.searchParams.has("token"), false);
    return Response.json({ success: true, date: day, eulerpoolKeyConfigured: true, records, stale: false });
  }) as typeof fetch;
  try {
    const response = await GET(new Request("https://example.com/api/calendar?diagnostics=1"));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.source, "eulerpool");
    assert.equal(body.diagnostics.eulerpoolKeyConfigured, true);
    assert.equal(body.diagnostics.keyLocation, "backend");
    assert.equal(body.events[1].actual, "0%");
    assert.equal(body.events[1].isCompleted, true);
  } finally { globalThis.fetch = saved; calendarSourceCache.clear(); if (previous !== undefined) process.env.EULERPOOL_API_KEY = previous; }
});

test("missing Render key returns a diagnostic error instead of silently using TradingView", async () => {
  const saved = globalThis.fetch;
  const previous = process.env.EULERPOOL_API_KEY;
  delete process.env.EULERPOOL_API_KEY;
  calendarSourceCache.clear();
  globalThis.fetch = (async () => Response.json({ success: false, eulerpoolKeyConfigured: false }, { status: 503 })) as typeof fetch;
  try {
    const response = await GET(new Request("https://example.com/api/calendar?diagnostics=1"));
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.success, false);
    assert.equal(body.diagnostics.eulerpoolKeyConfigured, false);
    assert.equal(body.diagnostics.keyLocation, "backend");
  } finally { globalThis.fetch = saved; calendarSourceCache.clear(); if (previous !== undefined) process.env.EULERPOOL_API_KEY = previous; }
});
