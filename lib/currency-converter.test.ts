import { test } from "node:test";
import assert from "node:assert/strict";
import { parseConversionAmount, parseConversionQuote, conversionNumber } from "./currency-converter";

test("Turkish grouped amounts and decimal input calculate consistently", () => {
  for (const input of ["1.000,50", "1000,50", "1000.50", " 1000,50 "]) assert.equal(parseConversionAmount(input), 1000.5);
  assert.equal(parseConversionAmount("1.000"), 1000);
  assert.equal(parseConversionAmount("0"), 0);
  for (const input of ["", "-1", "NaN", "Infinity", "1,2,3", "1e10", "1000000000001", "0,1234567"]) assert.equal(parseConversionAmount(input), null);
});
test("quotes must match selected pair and have a positive finite rate", () => {
  const row = { base: "USD", quote: "TRY", date: "2026-11-06", rate: 43.25 };
  assert.equal(parseConversionQuote(row, "USD", "TRY").rate * 1000, 43250);
  assert.throws(() => parseConversionQuote(row, "EUR", "TRY"));
  for (const rate of [0, -1, Infinity, NaN, "43.25"]) assert.throws(() => parseConversionQuote({ ...row, rate }, "USD", "TRY"));
  assert.throws(() => parseConversionQuote({ ...row, date: "not-a-date" }, "USD", "TRY"));
});
test("tiny positive amounts are never displayed as zero", () => {
  assert.notEqual(conversionNumber(0.0000000006), conversionNumber(0));
  assert.equal(conversionNumber(43250), "43.250,00");
});
