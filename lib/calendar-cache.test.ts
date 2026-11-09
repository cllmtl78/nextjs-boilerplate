import { test } from "node:test";
import assert from "node:assert/strict";
import { CalendarMinuteCache } from "./calendar-cache";

test("concurrent visitors share one upstream request; refresh occurs at 60 seconds", async () => {
  let now = 0, calls = 0;
  const cache = new CalendarMinuteCache<number>(() => now);
  const fetchValue = async () => ++calls;
  assert.deepEqual(await Promise.all([cache.get("day-1", fetchValue), cache.get("day-1", fetchValue)]), [1, 1]);
  now = 59_999;
  assert.equal(await cache.get("day-1", fetchValue), 1);
  now = 60_000;
  assert.equal(await cache.get("day-1", fetchValue), 2);
  assert.equal(await cache.get("day-2", fetchValue), 3);
});

test("failed requests are retried next minute without a visitor-driven retry storm", async () => {
  let now = 0, calls = 0;
  const cache = new CalendarMinuteCache<number>(() => now);
  const fetchValue = async () => { calls++; throw new Error("offline"); };
  await assert.rejects(cache.get("day", fetchValue), /offline/);
  await assert.rejects(cache.get("day", fetchValue), /offline/);
  assert.equal(calls, 1);
  now = 60_000;
  await assert.rejects(cache.get("day", fetchValue), /offline/);
  assert.equal(calls, 2);
});
