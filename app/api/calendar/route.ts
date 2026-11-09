import { NextResponse } from "next/server";
import { istanbulDay } from "@/lib/wire-text";
import { translateCalendarTitles } from "@/lib/translate-calendar";
import type { CalendarUnits } from "@/lib/calendar-values";

export const dynamic = "force-dynamic";

export interface EconomicCalendarEvent extends CalendarUnits {
  id: string;
  title: string;
  originalTitle?: string;
  country: "TR" | "US" | "EU" | "CN" | "JP";
  date: string;
  time: string;
  timestamp: number;
  actual: string | number | null;
  forecast: string | number | null;
  previous: string | number | null;
  importance: number;
  isCompleted: boolean;
}

const ALLOWED_COUNTRIES = ["TR", "US", "EU", "CN", "JP"] as const;

export async function GET(request?: Request) {
  const diagnostics = request ? new URL(request.url).searchParams.get("diagnostics") === "1" : false;
  const day = istanbulDay(Date.now());
  const from = new Date(`${day}T00:00:00+03:00`).toISOString();
  const to = new Date(Date.parse(from) + 86_400_000 - 1).toISOString();
  try {
    const url = new URL("https://economic-calendar.tradingview.com/events");
    url.search = new URLSearchParams({ from, to, countries: ALLOWED_COUNTRIES.join(","), minImportance: "-1" }).toString();
    const response = await fetch(url, {
      headers: { Accept: "application/json", Origin: "https://www.tradingview.com", Referer: "https://www.tradingview.com/" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data?.result)) throw new Error("Invalid calendar response");
    const rows = data.result.filter((row: Record<string, unknown>) => row &&
      ALLOWED_COUNTRIES.includes(row.country as EconomicCalendarEvent["country"]) &&
      typeof row.date === "string" && Number.isFinite(Date.parse(row.date)) &&
      istanbulDay(Date.parse(row.date)) === day);
    const titles = await translateCalendarTitles(rows.map((row: { title?: string }) => row.title || ""));
    const events: EconomicCalendarEvent[] = rows.map((row: Record<string, unknown>) => {
      const date = String(row.date);
      const timestamp = Date.parse(date);
      const originalTitle = typeof row.title === "string" ? row.title : "";
      const actual = calendarValue(row.actual);
      return {
        id: row.id != null ? String(row.id) : `${row.country}:${date}:${originalTitle}`,
        title: titles.get(originalTitle) || "Ekonomik Gösterge",
        originalTitle,
        country: row.country as EconomicCalendarEvent["country"],
        date, timestamp,
        time: new Date(timestamp).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hour12: false }),
        actual, forecast: calendarValue(row.forecast), previous: calendarValue(row.previous),
        unit: typeof row.unit === "string" ? row.unit : null,
        scale: typeof row.scale === "string" || typeof row.scale === "number" ? row.scale : null,
        currency: typeof row.currency === "string" ? row.currency : null,
        importance: typeof row.importance === "number" ? row.importance : 0,
        isCompleted: actual !== null,
      };
    });
    events.sort((a, b) => a.timestamp - b.timestamp);
    return NextResponse.json({ success: true, date: day, source: "tradingview", fetchedAt: new Date().toISOString(), count: events.length, events,
      ...(diagnostics ? { diagnostics: {
        upstreamStatus: response.status,
        totalRows: data.result.length,
        completedRows: events.filter(event => event.isCompleted).length,
        // These are public economic records, before any mapping or translation.
        // Preserve keys and value types to distinguish absent/renamed fields
        // from a provider actually returning null.
        rawSample: rows.slice(0, 7),
      } } : {}),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.warn("[Takvim] Güncel veriler alınamadı:", error instanceof Error ? error.message : "Bilinmeyen hata");
    return NextResponse.json({ success: false, date: day, count: 0, events: [], error: "Takvim bağlantısı kurulamadı. Yeniden deneniyor.",
      ...(diagnostics ? { diagnostics: { error: error instanceof Error ? error.message : "Bilinmeyen hata" } } : {}),
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

function calendarValue(value: unknown): string | number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || ["", "--", "N/A", "NaN", "null"].includes(value.trim())) return null;
  return value;
}
