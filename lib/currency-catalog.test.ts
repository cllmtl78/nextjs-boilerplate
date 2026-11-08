import { test } from "node:test";
import assert from "node:assert/strict";
import { currencySearch, parseCurrencyCatalog } from "./currency-catalog";

test("full provider catalog is not limited to the former 22 options", () => {
  const input = [{ iso_code: "USD", name: "US Dollar", type: "currency" }, { iso_code: "TRY", name: "Turkish Lira", type: "currency" },
    ...Array.from({ length: 240 }, (_, index) => ({ iso_code: `C${index}`, name: `Currency ${index}`, type: "currency" })),
    { iso_code: "DZD", name: "Algerian dinar", type: "currency" },
    { iso_code: "XAU", name: "Gold", type: "metal" }, { iso_code: "BTC", name: "Bitcoin", type: "crypto" }];
  const options = parseCurrencyCatalog(input);
  assert.equal(options.length, input.length);
  assert.ok(options.some(option => option.code === "DZD"));
  assert.ok(options.some(option => option.code === "BTC" && option.type === "crypto"));
  assert.equal(options.find(option => option.code === "TRY")?.name, "Türk Lirası");
});
test("Turkish names and codes can be searched without diacritics", () => {
  assert.ok(currencySearch("İsviçre Frangı CHF").includes(currencySearch("isvicre")));
  assert.ok(currencySearch("Türk Lirası TRY").includes(currencySearch("lira")));
  assert.equal(currencySearch("USD"), "usd");
});
test("invalid records cannot inject paths and an empty catalog is an error", () => {
  assert.throws(() => parseCurrencyCatalog([]));
  const options = parseCurrencyCatalog([
    { iso_code: "USD", name: "US Dollar", type: "currency" }, { iso_code: "TRY", name: "Turkish Lira", type: "currency" },
    { iso_code: "USD/../../", name: "Invalid", type: "currency" }, { iso_code: "INVALID", name: "Unknown", type: "not-a-type" },
  ]);
  assert.equal(options.length, 2);
});
