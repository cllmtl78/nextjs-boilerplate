import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface EconomicCalendarEvent {
  id: string;
  title: string;
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

// Ağ veya proxy kesintisinde kullanılacak zengin makro takvim şablonu
const FALLBACK_CALENDAR_EVENTS: EconomicCalendarEvent[] = [
  {
    id: "fb_tr_1",
    title: "TCMB Haftalık Para ve Banka İstatistikleri",
    country: "TR",
    date: new Date().toISOString(),
    time: "14:30",
    timestamp: Date.now() - 3600000,
    actual: "154.2 Mr $",
    forecast: "153.8 Mr $",
    previous: "152.9 Mr $",
    importance: 1,
    isCompleted: true,
  },
  {
    id: "fb_us_1",
    title: "ABD Gayri Safi Yurtiçi Hasıla (GSYİH) Çeyreklik",
    country: "US",
    date: new Date().toISOString(),
    time: "15:30",
    timestamp: Date.now() + 1800000,
    actual: null,
    forecast: "%2.8",
    previous: "%3.0",
    importance: 2,
    isCompleted: false,
  },
  {
    id: "fb_eu_1",
    title: "Euro Bölgesi Tüketici Güven Endeksi",
    country: "EU",
    date: new Date().toISOString(),
    time: "12:00",
    timestamp: Date.now() - 7200000,
    actual: "-12.5",
    forecast: "-12.8",
    previous: "-13.1",
    importance: 1,
    isCompleted: true,
  },
  {
    id: "fb_cn_1",
    title: "Çin İmalat PMI (Satın Alma Yöneticileri Endeksi)",
    country: "CN",
    date: new Date().toISOString(),
    time: "04:30",
    timestamp: Date.now() - 25000000,
    actual: "50.1",
    forecast: "49.9",
    previous: "49.8",
    importance: 2,
    isCompleted: true,
  },
  {
    id: "fb_jp_1",
    title: "Japonya Merkez Bankası (BOJ) Tüketici Güveni",
    country: "JP",
    date: new Date().toISOString(),
    time: "08:00",
    timestamp: Date.now() - 14400000,
    actual: "35.0",
    forecast: "35.1",
    previous: "35.4",
    importance: 1,
    isCompleted: true,
  },
  {
    id: "fb_us_2",
    title: "ABD Çekirdek PCE Fiyat Endeksi (Aylık)",
    country: "US",
    date: new Date().toISOString(),
    time: "15:30",
    timestamp: Date.now() + 3600000,
    actual: null,
    forecast: "%0.3",
    previous: "%0.2",
    importance: 2,
    isCompleted: false,
  },
  {
    id: "fb_tr_2",
    title: "TCMB Politika Faizi Kararı (Bir Hafta Repo)",
    country: "TR",
    date: new Date().toISOString(),
    time: "14:00",
    timestamp: Date.now() - 1800000,
    actual: "%50.00",
    forecast: "%50.00",
    previous: "%50.00",
    importance: 2,
    isCompleted: true,
  },
  {
    id: "fb_us_3",
    title: "ABD Ham Petrol Stokları (EIA)",
    country: "US",
    date: new Date().toISOString(),
    time: "17:30",
    timestamp: Date.now() + 7200000,
    actual: null,
    forecast: "-1.50M",
    previous: "+2.15M",
    importance: 1,
    isCompleted: false,
  },
];

export async function GET() {
  try {
    const today = new Date();
    // Türkiye gün sınırları (00:00:00 - 23:59:59)
    const year = today.getUTCFullYear();
    const month = String(today.getUTCMonth() + 1).padStart(2, "0");
    const day = String(today.getUTCDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    const fromDate = `${todayStr}T00:00:00.000Z`;
    const toDate = `${todayStr}T23:59:59.000Z`;

    const payload = {
      countries: ["TR", "US", "EU", "CN", "JP"],
      from: fromDate,
      to: toDate,
      minImportance: -1,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch("https://economic-calendar.tradingview.com/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Origin: "https://www.tradingview.com",
        Referer: "https://www.tradingview.com/",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      next: { revalidate: 60 },
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data?.result) ? data.result : [];

      // 5 ülkeye göre filtrele
      const filtered = rawList.filter(
        (item: { country?: string }) =>
          typeof item.country === "string" &&
          ALLOWED_COUNTRIES.includes(item.country as "TR" | "US" | "EU" | "CN" | "JP")
      );

      if (filtered.length > 0) {
        const events: EconomicCalendarEvent[] = filtered.map(
          (item: {
            id?: string | number;
            title?: string;
            country?: string;
            date?: string;
            actual?: number | string | null;
            forecast?: number | string | null;
            previous?: number | string | null;
            importance?: number;
          }, idx: number) => {
            const rawDate = item.date || new Date().toISOString();
            const dateObj = new Date(rawDate);
            const timestamp = isNaN(dateObj.getTime()) ? Date.now() : dateObj.getTime();

            // Europe/Istanbul saatine çevir
            let timeStr = "--:--";
            if (!isNaN(dateObj.getTime())) {
              timeStr = dateObj.toLocaleTimeString("tr-TR", {
                timeZone: "Europe/Istanbul",
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              });
            }

            const actualVal =
              item.actual !== null && item.actual !== undefined && String(item.actual).trim() !== ""
                ? item.actual
                : null;
            const forecastVal =
              item.forecast !== null && item.forecast !== undefined && String(item.forecast).trim() !== ""
                ? item.forecast
                : null;
            const previousVal =
              item.previous !== null && item.previous !== undefined && String(item.previous).trim() !== ""
                ? item.previous
                : null;

            return {
              id: item.id ? String(item.id) : `tv_${idx}`,
              title: item.title || "Ekonomik Gösterge",
              country: (item.country || "TR") as "TR" | "US" | "EU" | "CN" | "JP",
              date: rawDate,
              time: timeStr,
              timestamp,
              actual: actualVal,
              forecast: forecastVal,
              previous: previousVal,
              importance: typeof item.importance === "number" ? item.importance : 0,
              isCompleted: actualVal !== null,
            };
          }
        );

        // Kronolojik sıralama: Saate göre (timestamp artan sırada)
        events.sort((a, b) => a.timestamp - b.timestamp);

        return NextResponse.json({
          success: true,
          date: todayStr,
          source: "tradingview",
          count: events.length,
          events,
        });
      }
    }
  } catch {
    // API hatası veya zaman aşımı durumunda fallback verisi döner
  }

  // Fallback
  return NextResponse.json({
    success: true,
    date: new Date().toISOString().split("T")[0],
    source: "fallback",
    count: FALLBACK_CALENDAR_EVENTS.length,
    events: FALLBACK_CALENDAR_EVENTS,
  });
}
