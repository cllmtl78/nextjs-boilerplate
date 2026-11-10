import { test } from "node:test";
import assert from "node:assert/strict";
import { debtDollars, debtHistory } from "./debt-data";

test("debt full-dollar readout preserves cents while the chart uses trillions", () => {
  assert.equal(debtDollars("40552751019092.61"), "40.552.751.019.092,61 $");
  assert.equal(debtDollars("-3369765891.04"), "−3.369.765.891,04 $");
  const row = { record_date: "2026-11-06", total_debt: "40552751019092.61", debt_held_public: "32762925356629.47", intragov_holdings: "7789825662463.14" };
  const [total] = debtHistory([row]);
  assert.ok(Math.abs(total.value - 40.55275101909261) < 1e-10);
  assert.equal(total.date, row.record_date);
  assert.ok(Math.abs(debtHistory([row], "intragov_holdings")[0].value - 7.78982566246314) < 1e-10);
});
