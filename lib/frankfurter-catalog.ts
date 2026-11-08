import { parseCurrencyCatalog, type CurrencyOption } from "./currency-catalog";

let cached: { data: CurrencyOption[]; savedAt: number } | undefined;
let pending: Promise<{ data: CurrencyOption[]; stale: boolean }> | undefined;
let retryAt = 0;

export async function getCurrencyCatalog(): Promise<{ data: CurrencyOption[]; stale: boolean }> {
  if (cached && Date.now() - cached.savedAt < 24 * 60 * 60_000) return { data: cached.data, stale: false };
  if (pending) return pending;
  pending = (async () => {
    try {
      if (Date.now() < retryAt) throw new Error("Catalog retry pending");
      const response = await fetch("https://api.frankfurter.dev/v2/currencies", {
        headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("Catalog unavailable");
      const data = parseCurrencyCatalog(await response.json());
      cached = { data, savedAt: Date.now() };
      retryAt = 0;
      return { data, stale: false };
    } catch {
      retryAt = Date.now() + 60_000;
      if (cached && Date.now() - cached.savedAt < 7 * 24 * 60 * 60_000) return { data: cached.data, stale: true };
      throw new Error("Catalog unavailable");
    }
  })().finally(() => { pending = undefined; });
  return pending;
}
