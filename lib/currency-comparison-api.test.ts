import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/currency-comparison/route";

test("comparison API validates selections, groups 5Y, caches and deduplicates", async () => {
  const original = globalThis.fetch;
  let hits = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/currencies")) return Response.json(["TRY", "USD", "EUR", "GBP", "DZD"].map(code => ({ iso_code: code, name: code, type: "currency" })));
    hits++;
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("group"), "week");
    return Response.json(["USD", "EUR", "GBP"].flatMap(quote => [{ base: "TRY", quote, date: "2026-11-02", rate: .02 }, { base: "TRY", quote, date: "2026-11-06", rate: .018 }]));
  }) as typeof fetch;
  const request = (query: string) => new Request(`http://localhost/api/currency-comparison?${query}`);
  try {
    for (const query of ["quotes=USD,EUR,GBP,CHF,CAD,AUD", "quotes=TRY", "range=100Y", "base=USD/evil"]) assert.equal((await GET(request(query))).status, 400);
    const responses = await Promise.all([GET(request("range=5Y")), GET(request("range=5Y"))]);
    assert.equal(hits, 1);
    const data = await responses[0].json();
    assert.equal(data.series.length, 3);
    assert.equal(data.base, "TRY");
    await GET(request("range=5Y"));
    assert.equal(hits, 1);
  } finally { globalThis.fetch = original; }
});
