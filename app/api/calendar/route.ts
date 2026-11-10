import { NextResponse } from "next/server";
import { istanbulDay } from "@/lib/wire-text";
import { translateCalendarTitles } from "@/lib/translate-calendar";
import type { CalendarUnits } from "@/lib/calendar-values";
import { fetchCalendarSource } from "@/lib/calendar-sources";
import { CalendarBackendError } from "@/lib/eulerpool-calendar";

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
  actualSource?: string;
}

const ALLOWED_COUNTRIES = ["TR", "US", "EU", "CN", "JP"] as const;

export async function GET(request?: Request) {
  const diagnostics = request ? new URL(request.url).searchParams.get("diagnostics") === "1" : false;
  const day = istanbulDay(Date.now());
  try {
    // Render owns matching, credentials and the shared 60-second cache.
    const upstream = await fetchCalendarSource(day);
    const data = upstream.data;
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
        time: row.fullDay === true ? "Gün boyu" : new Date(timestamp).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hour12: false }),
        actual, forecast: calendarValue(row.forecast), previous: calendarValue(row.previous),
        preformatted: row.preformatted === true,
        unit: typeof row.unit === "string" ? row.unit : null,
        scale: typeof row.scale === "string" || typeof row.scale === "number" ? row.scale : null,
        currency: typeof row.currency === "string" ? row.currency : null,
        importance: typeof row.importance === "number" ? row.importance : 0,
        isCompleted: actual !== null,
        actualSource: typeof row.actualSource === "string" ? row.actualSource : undefined,
      };
    });
    events.sort((a, b) => a.timestamp - b.timestamp);
    return NextResponse.json({ success: true, date: day, source: upstream.source, fetchedAt: upstream.fetchedAt, count: events.length, events,
      stale: upstream.stale === true, degraded: upstream.degraded === true, resultSource: upstream.resultSource,
      ...(diagnostics ? { diagnostics: {
        upstreamStatus: upstream.status,
        eulerpoolKeyConfigured: upstream.eulerpoolKeyConfigured ?? Boolean(process.env.EULERPOOL_API_KEY?.trim()),
        keyLocation: upstream.keyLocation || "nextjs",
        sourceUrl: upstream.sourceUrl,
        fallbackReason: upstream.fallbackReason,
        totalRows: data.result.length,
        completedRows: events.filter(event => event.isCompleted).length,
        matching: upstream.matching,
        // Provider records before API mapping/translation. Investing HTML has
        // already been converted into records by the source adapter.
        rawSample: rows.slice(0, 7),
      } } : {}),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.warn("[Takvim] Güncel veriler alınamadı:", error instanceof Error ? error.message : "Bilinmeyen hata");
    return NextResponse.json({ success: false, date: day, count: 0, events: [], error: "Takvim bağlantısı kurulamadı. Yeniden deneniyor.",
      ...(diagnostics ? { diagnostics: { error: error instanceof Error ? error.message : "Bilinmeyen hata",
        ...(error instanceof CalendarBackendError ? { eulerpoolKeyConfigured: error.keyConfigured, keyLocation: "backend" } : {}),
      } } : {}),
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

function calendarValue(value: unknown): string | number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || ["", "--", "N/A", "NaN", "null"].includes(value.trim())) return null;
  return value;
}
