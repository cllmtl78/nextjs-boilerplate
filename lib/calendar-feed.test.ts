import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeCalendarReadings } from "./calendar-feed";
import { mergeKapFeed } from "./kap-feed";


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
