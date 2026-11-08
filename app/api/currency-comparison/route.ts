import { NextResponse } from "next/server";
import { getCurrencyCatalog } from "@/lib/frankfurter-catalog";
import { validCurrencyCode } from "@/lib/currency-catalog";
import { COMPARISON_RANGES, buildCurrencyComparison, comparisonRangeDates, type ComparisonData, type ComparisonRange } from "@/lib/currency-comparison";
import { istanbulDay } from "@/lib/wire-text";

export const dynamic = "force-dynamic";
const cache = new Map<string, { data: ComparisonData; time: number }>();
const pending = new Map<string, Promise<ComparisonData>>();
const retries = new Map<string, number>();

async function history(base: string, quotes: string[], range: ComparisonRange, today: string, key: string): Promise<ComparisonData> {
  const saved = cache.get(key);
  if (saved && Date.now() - saved.time < 30 * 60_000) return saved.data;
  try {
    if (Date.now() < (retries.get(key) || 0)) throw new Error("Retry later");
    const dates = comparisonRangeDates(range, today);
    const params = new URLSearchParams({ base, quotes: quotes.join(","), from: dates.from, to: dates.to });
    if (dates.group) params.set("group", dates.group);
    const response = await fetch(`https://api.frankfurter.dev/v2/rates?${params}`, {
      headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error("History unavailable");
    const data = buildCurrencyComparison(await response.json(), base, quotes);
    if (cache.size >= 50 && !cache.has(key)) cache.delete(cache.keys().next().value!);
    cache.set(key, { data, time: Date.now() });
    retries.delete(key);
    return data;
  } catch {
    if (retries.size >= 100 && !retries.has(key)) retries.delete(retries.keys().next().value!);
    retries.set(key, Date.now() + 60_000);
    if (saved && Date.now() - saved.time < 24 * 60 * 60_000) return { ...saved.data, stale: true };
    throw new Error("History unavailable");
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const base = (params.get("base") || "TRY").toUpperCase();
  const quotes = [...new Set((params.get("quotes") || "USD,EUR,GBP").toUpperCase().split(","))];
  const range = params.get("range") || "3M";
  const headers = { "Cache-Control": "no-store" };
  if (!validCurrencyCode(base) || !quotes.length || quotes.length > 5 || quotes.includes(base) || quotes.some(code => !validCurrencyCode(code)) || !COMPARISON_RANGES.some(item => item.value === range)) {
    return NextResponse.json({ error: "Bir baz ve en fazla beş farklı hedef birim seçin." }, { status: 400, headers });
  }
  try {
    const catalog = await getCurrencyCatalog();
    if ([base, ...quotes].some(code => !catalog.data.some(item => item.code === code))) return NextResponse.json({ error: "Desteklenmeyen para birimi." }, { status: 400, headers });
    const today = istanbulDay(Date.now());
    const key = `${base}:${quotes.join(",")}:${range}:${today}`;
    let work = pending.get(key);
    if (!work) { work = history(base, quotes, range as ComparisonRange, today, key).finally(() => pending.delete(key)); pending.set(key, work); }
    return NextResponse.json({ ...await work, source: "Frankfurter" }, { headers });
  } catch {
    return NextResponse.json({ error: "Geçmiş kur verileri şu anda alınamıyor." }, { status: 503, headers });
  }
}
