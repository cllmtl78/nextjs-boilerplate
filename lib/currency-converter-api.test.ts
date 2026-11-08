import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "../app/api/currency-converter/route";
const request = (from: string, to: string) => new Request(`http://localhost/api/currency-converter?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);

test("converter API validates pairs, deduplicates requests, caches and marks fallback", async () => {
  const originalFetch = globalThis.fetch;
  const originalNow = Date.now;
  let clock = originalNow();
  Date.now = () => clock;
  let hits = 0;
  let failing = false;
  globalThis.fetch = (async (url: string | URL | Request) => {
    if (String(url).endsWith("/currencies")) return Response.json([
      { iso_code: "USD", name: "US Dollar", type: "currency" },
      { iso_code: "TRY", name: "Turkish Lira", type: "currency" },
      { iso_code: "EUR", name: "Euro", type: "currency" },
      { iso_code: "DZD", name: "Algerian Dinar", type: "currency" },
    ]);
    hits++;
    if (failing) throw new Error("Upstream offline");
    await Promise.resolve();
    return Response.json({ base: "USD", quote: "TRY", date: "2026-11-06", rate: 43.25 });
  }) as typeof fetch;
  try {
    assert.equal((await GET(request("USD/evil", "TRY"))).status, 400);
    const identity = await (await GET(request("USD", "USD"))).json();
    assert.equal(identity.rate, 1);
    assert.equal(identity.date, null);
    assert.equal(hits, 0);
    assert.equal((await GET(request("ZZZ", "TRY"))).status, 400);
    assert.equal((await GET(request("DZD", "DZD"))).status, 200);
    const responses = await Promise.all([GET(request("USD", "TRY")), GET(request("USD", "TRY"))]);
    assert.equal(hits, 1);
    assert.equal((await responses[0].json()).rate, 43.25);
    await GET(request("USD", "TRY"));
    assert.equal(hits, 1);
    clock += 16 * 60_000;
    failing = true;
    const fallback = await (await GET(request("USD", "TRY"))).json();
    assert.equal(fallback.stale, true);
    assert.equal(fallback.date, "2026-11-06");
    const error = await GET(request("EUR", "TRY"));
    assert.equal(error.status, 503);
  } finally { globalThis.fetch = originalFetch; Date.now = originalNow; }
});
