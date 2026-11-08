import { NextResponse } from "next/server";
import { parseConversionQuote, type ConversionQuote } from "@/lib/currency-converter";

import { validCurrencyCode } from "@/lib/currency-catalog";
import { getCurrencyCatalog } from "@/lib/frankfurter-catalog";

export const dynamic = "force-dynamic";
const cache = new Map<string, { data: ConversionQuote; savedAt: number }>();
const inflight = new Map<string, Promise<ConversionQuote>>();
const retryAt = new Map<string, number>();
const TTL = 15 * 60_000;

async function fetchQuote(base: string, quote: string, key: string): Promise<ConversionQuote> {
  const saved = cache.get(key);
  if (saved && Date.now() - saved.savedAt < TTL) return saved.data;
  try {
    if ((retryAt.get(key) || 0) > Date.now()) throw new Error("Retry later");
    const response = await fetch(`https://api.frankfurter.dev/v2/rate/${base}/${quote}`, {
      headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("Frankfurter unavailable");
    const data = parseConversionQuote(await response.json(), base, quote);
    if (cache.size >= 100) cache.delete(cache.keys().next().value!);
    cache.set(key, { data, savedAt: Date.now() });
    retryAt.delete(key);
    return data;
  } catch {
    if (retryAt.size >= 200 && !retryAt.has(key)) retryAt.delete(retryAt.keys().next().value!);
    retryAt.set(key, Date.now() + 60_000);
    if (saved && Date.now() - saved.savedAt < 24 * 60 * 60_000) return { ...saved.data, stale: true };
    throw new Error("Rate unavailable");
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const base = (params.get("from") || "USD").toUpperCase();
  const quote = (params.get("to") || "TRY").toUpperCase();
  const headers = { "Cache-Control": "no-store" };
  if (!validCurrencyCode(base) || !validCurrencyCode(quote)) return NextResponse.json({ error: "Desteklenmeyen para birimi." }, { status: 400, headers });
  try {
    const catalog = await getCurrencyCatalog();
    const codes = new Set(catalog.data.map(item => item.code));
    if (!codes.has(base) || !codes.has(quote)) return NextResponse.json({ error: "Desteklenmeyen para birimi." }, { status: 400, headers });
  } catch {
    return NextResponse.json({ error: "Para birimi listesi şu anda alınamıyor." }, { status: 503, headers });
  }
  if (base === quote) return NextResponse.json({ base, quote, rate: 1, date: null, source: "identity" }, { headers });
  const key = `${base}-${quote}`;
  try {
    let pending = inflight.get(key);
    if (!pending) {
      pending = fetchQuote(base, quote, key).finally(() => inflight.delete(key));
      inflight.set(key, pending);
    }
    return NextResponse.json({ ...await pending, source: "Frankfurter" }, { headers });
  } catch {
    return NextResponse.json({ error: "Kur verisi şu anda alınamıyor. Biraz sonra tekrar deneyin." }, { status: 503, headers });
  }
}
