import { test } from "node:test";
import assert from "node:assert/strict";
import { marketSessions } from "./market-sessions";

const at = (time: string, name: string) => marketSessions(new Date(time)).find(session => session.name === name)!;
test("weekends are closed for all exchanges", () => {
  assert.ok(marketSessions(new Date("2026-11-07T15:00:00Z")).every(session => !session.isOpen && session.countdown === null));
});
test("BIST opens and closes at Istanbul boundaries with countdown", () => {
  assert.equal(at("2026-11-06T06:59:59Z", "BIST").isOpen, false);
  assert.equal(at("2026-11-06T07:00:00Z", "BIST").countdown, "08:00:00");
  assert.equal(at("2026-11-06T14:59:59Z", "BIST").countdown, "00:00:01");
  assert.equal(at("2026-11-06T15:00:00Z", "BIST").isOpen, false);
});
test("London and New York respect their own winter and summer time", () => {
  assert.equal(at("2026-11-06T14:30:00Z", "NYSE").countdown, "06:30:00");
  assert.equal(at("2026-07-06T13:30:00Z", "NYSE").countdown, "06:30:00");
  assert.equal(at("2026-11-06T08:00:00Z", "LSE").countdown, "08:30:00");
  assert.equal(at("2026-07-06T07:00:00Z", "LSE").countdown, "08:30:00");
  assert.equal(at("2026-11-06T16:30:00Z", "LSE").isOpen, false);
});
