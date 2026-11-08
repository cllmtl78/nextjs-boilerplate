import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCurrencyComparison, comparisonRangeDates } from "./currency-comparison";
const row = (quote: string, date: string, rate: number) => ({ base: "TRY", quote, date, rate });

test("TRY base displays target appreciation in the familiar USD/TRY direction", () => {
  const data = buildCurrencyComparison([row("USD", "2026-11-06", 1 / 55), row("USD", "2026-11-02", 1 / 50)], "TRY", ["USD"]);
  assert.deepEqual(data.dates, ["2026-11-02", "2026-11-06"]);
  assert.equal(data.series[0].values[0], 0);
  assert.ok(Math.abs(data.series[0].values[1]! - 10) < 0.00001);
});
test("all series start and finish on common dates; missing values remain gaps", () => {
  const data = buildCurrencyComparison([
    row("USD", "2026-11-01", .02), row("USD", "2026-11-02", .019), row("USD", "2026-11-03", .018), row("USD", "2026-11-04", .017), row("USD", "2026-11-05", .016),
    row("EUR", "2026-11-02", .016), row("EUR", "2026-11-04", .015),
  ], "TRY", ["USD", "EUR", "GBP"]);
  assert.equal(data.start, "2026-11-02");
  assert.equal(data.end, "2026-11-04");
  assert.deepEqual(data.dates, ["2026-11-02", "2026-11-03", "2026-11-04"]);
  assert.equal(data.series[1].values[1], null);
  assert.deepEqual(data.missing, ["GBP"]);
  assert.ok(data.series.every(series => series.values[0] === 0));
});
test("invalid and unrelated records are rejected and no overlap produces no chart", () => {
  const data = buildCurrencyComparison([row("USD", "2026-11-01", 0), row("USD", "2026-11-02", NaN), { ...row("USD", "2026-11-03", .02), base: "EUR" }], "TRY", ["USD"]);
  assert.equal(data.series.length, 0);
  const disjoint = buildCurrencyComparison([row("USD", "2026-11-01", .02), row("USD", "2026-11-02", .02), row("EUR", "2026-11-03", .02), row("EUR", "2026-11-04", .02)], "TRY", ["USD", "EUR"]);
  assert.equal(disjoint.series.length, 0);
});
test("longer ranges aggregate weekly and dates cross year boundaries correctly", () => {
  assert.deepEqual(comparisonRangeDates("1M", "2026-01-10"), { from: "2025-12-11", to: "2026-01-10", group: null });
  assert.equal(comparisonRangeDates("5Y", "2026-11-08").group, "week");
});
