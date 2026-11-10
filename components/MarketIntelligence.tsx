"use client";

import { useCachedState } from "@/lib/use-cached-state";
import { useState, useEffect } from "react";
import OfficialNews from "@/components/OfficialNews";
import type { TerminalHaber } from "@/components/TerminalWorkspace";
import { displayCalendarTitle } from "@/lib/calendar-titles";
import { formatCalendarValue, type CalendarUnits } from "@/lib/calendar-values";
import { istanbulDay } from "@/lib/wire-text";
import { isCurrentNewsItem, watchIstanbulDay } from "@/lib/news-day";
import { mergeCalendarReadings } from "@/lib/calendar-feed";

interface StockMover {
  symbol: string;
  price: number;
  changePercent: number;
  volumeStr: string;
  isUp: boolean;
}

interface SectorItem {
  code: string;
  name: string;
  change: number;
}

export interface EconomicCalendarItem extends CalendarUnits {
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

const CACHE_CALENDAR_DATE = "bpt_calendar_date";
const CACHE_CALENDAR_DATA = "bpt_calendar_data";
const CACHE_BIST_DATA = "bpt_bist_market_data_v2";

// Ülke rozeti renklendirme (TR: kırmızı, US: mavi, EU: lacivert/mavi, CN: amber, JP: indigo)
const renderCountryBadge = (country: "TR" | "US" | "EU" | "CN" | "JP") => {
  switch (country) {
    case "TR":
      return (
        <span className="text-[10px] font-bold leading-3 px-0.5 py-0 rounded bg-rose-950/70 border border-rose-800/60 text-rose-300 font-mono shrink-0">
          TR
        </span>
      );
    case "US":
      return (
        <span className="text-[10px] font-bold leading-3 px-0.5 py-0 rounded bg-sky-950/70 border border-sky-800/60 text-sky-300 font-mono shrink-0">
          US
        </span>
      );
    case "EU":
      return (
        <span className="text-[10px] font-bold leading-3 px-0.5 py-0 rounded bg-blue-950/70 border border-blue-800/60 text-blue-300 font-mono shrink-0">
          EU
        </span>
      );
    case "CN":
      return (
        <span className="text-[10px] font-bold leading-3 px-0.5 py-0 rounded bg-amber-950/70 border border-amber-800/60 text-amber-300 font-mono shrink-0">
          CN
        </span>
      );
    case "JP":
      return (
        <span className="text-[10px] font-bold leading-3 px-0.5 py-0 rounded bg-indigo-950/70 border border-indigo-800/60 text-indigo-300 font-mono shrink-0">
          JP
        </span>
      );
    default:
      return (
        <span className="text-[10px] font-bold leading-3 px-0.5 py-0 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono shrink-0">
          {country}
        </span>
      );
  }
};

interface RawBistStock {
  kod?: string;
  symbol?: string;
  sembol?: string;
  code?: string;
  ad?: string;
  name?: string;
  fiyat?: number | string;
  son?: number | string;
  last?: number | string;
  price?: number | string;
  kapanis?: number | string;
  yuzdedegisim?: number | string;
  degisim?: number | string;
  changePercent?: number | string;
  change?: number | string;
  fark?: number | string;
  hacim?: number | string;
  hacimtl?: number | string;
  volume?: number | string;
  vol?: number | string;
}

function parseRawStock(raw: RawBistStock): (StockMover & { volumeNum: number }) | null {
  const symbol = String(raw.kod || raw.symbol || raw.sembol || raw.code || "").trim().toUpperCase();
  if (!symbol || symbol.length < 2 || symbol.length > 8) return null;

  const parseNum = (val: unknown): number => {
    if (typeof val === "number") return isNaN(val) ? 0 : val;
    if (typeof val === "string") {
      const clean = val.replace(/\s+/g, "").trim();
      if (!clean) return 0;
      if (clean.includes(".") && clean.includes(",")) {
        if (clean.lastIndexOf(",") > clean.lastIndexOf(".")) {
          return parseFloat(clean.replace(/\./g, "").replace(",", ".")) || 0;
        } else {
          return parseFloat(clean.replace(/,/g, "")) || 0;
        }
      }
      if (clean.includes(",")) {
        return parseFloat(clean.replace(",", ".")) || 0;
      }
      return parseFloat(clean) || 0;
    }
    return 0;
  };

  const price = parseNum(raw.fiyat ?? raw.son ?? raw.last ?? raw.price ?? raw.kapanis);
  const changePercent = parseNum(raw.yuzdedegisim ?? raw.degisim ?? raw.changePercent ?? raw.change ?? raw.fark);
  const volumeNum = parseNum(raw.hacimtl ?? raw.hacim ?? raw.volume ?? raw.vol);

  const formatVolume = (vol: number): string => {
    if (vol >= 1_000_000_000) {
      return `${(vol / 1_000_000_000).toFixed(2)} Mr TL`;
    }
    if (vol >= 1_000_000) {
      return `${(vol / 1_000_000).toFixed(2)} Mn TL`;
    }
    if (vol > 0) {
      return `${Math.round(vol).toLocaleString("tr-TR")} TL`;
    }
    return "--";
  };

  return {
    symbol,
    price: price > 0 ? price : 10.0,
    changePercent: Math.round(changePercent * 100) / 100,
    volumeStr: formatVolume(volumeNum),
    volumeNum,
    isUp: changePercent >= 0,
  };
}

// 1. PARALEL & ULTRA HIZLI CANLI VERİ ÇEKME MOTORU (Promise.any ile ilk yanıt vereni anında alır):
const fetchBistMarketData = async (): Promise<unknown[] | null> => {
  const targetUrl = "https://bigpara.hurriyet.com.tr/api/v1/hisse/canli";

  const fetchFromInternal = async (): Promise<unknown[]> => {
    const res = await fetch("/api/bist-market-data", {
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error("Internal API error");
    const json = await res.json();
    if (json && Array.isArray(json.data) && json.data.length > 0) return json.data;
    throw new Error("Empty internal data");
  };

  const fetchFromProxy = async (proxyUrl: string): Promise<unknown[]> => {
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(4500) });
    if (!res.ok) throw new Error("Proxy error");
    const json = await res.json();
    if (json && Array.isArray(json.data) && json.data.length > 0) return json.data;
    throw new Error("Empty proxy data");
  };

  try {
    // Tüm kaynakları sırayla beklemek yerine aynı anda yarıştır; ilk gelen cevabı anında kullan!
    const fastestData = await Promise.any([
      fetchFromInternal(),
      fetchFromProxy(`https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`),
      fetchFromProxy(`https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`),
      fetchFromProxy(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`),
    ]);
    return fastestData;
  } catch {
    return null;
  }
};

// 3. SEKTÖR AKIŞI TANIMLARI (Sahte fallback yüzdeleri kaldırıldı):
const SECTOR_DEFINITIONS: { code: string; name: string; keyStocks: string[] }[] = [
  { code: "XBANK", name: "Bankacılık", keyStocks: ["AKBNK", "ISCTR", "YKBNK", "GARAN", "VAKBN"] },
  { code: "XULAŞ", name: "Ulaştırma", keyStocks: ["THYAO", "PGSUS", "TAVHL", "CLEBI"] },
  { code: "XHOLD", name: "Holding", keyStocks: ["KCHOL", "SAHOL", "ALARK", "ENKAI"] },
  { code: "XMANA", name: "Metal Ana", keyStocks: ["EREGL", "KRDMD", "CEMTS"] },
  { code: "XUSIN", name: "Sanayi", keyStocks: ["FROTO", "TOASO", "TUPRS", "SISE", "ARCLK"] },
  { code: "XGIDA", name: "Gıda İçecek", keyStocks: ["BIMAS", "MGROS", "CCOLA", "ULKER"] },
  { code: "XGMYO", name: "Gayrimenkul", keyStocks: ["EKGYO", "SNGYO", "ISGYO", "TRGYO"] },
  { code: "XBLSM", name: "Bilişim", keyStocks: ["MIATK", "REEDR", "KFEIN", "VBTYZ"] },
  { code: "XKMYA", name: "Kimya Petrol", keyStocks: ["SASA", "HEKTS", "PETKM", "GUBRF"] },
  { code: "XINSA", name: "İnşaat", keyStocks: ["ENKAI", "OYAKC", "CIMSA", "NUHCM"] },
];

export default function MarketIntelligence({ backendUrl, onSelectNews }: {
  backendUrl: string;
  onSelectNews: (item: TerminalHaber) => void;
}) {
  // Canlı Sektör Verisi (Önbellek varsa anında başlat, FOUC önle)
  const [sectors, setSectors] = useCachedState<SectorItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const cachedBist = localStorage.getItem(CACHE_BIST_DATA);
      if (cachedBist) {
        const parsed = JSON.parse(cachedBist);
        if (Array.isArray(parsed?.sectors) && parsed.sectors.length > 0) {
          return parsed.sectors;
        }
      }
    } catch {
      // ignore
    }
    return [];
  }, []);

  // Canlı Takvim State (Önbellek varsa anında başlat)
  const [calendarEvents, setCalendarEvents] = useCachedState<EconomicCalendarItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const todayStr = istanbulDay(Date.now());
      const storedDate = localStorage.getItem(CACHE_CALENDAR_DATE);
      if (storedDate === todayStr) {
        const raw = localStorage.getItem(CACHE_CALENDAR_DATA);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed.filter(item => !String(item.id).startsWith("fb_") && isCurrentNewsItem(item));
        }
      } else if (storedDate && storedDate !== todayStr) {
        localStorage.removeItem(CACHE_CALENDAR_DATA);
        localStorage.setItem(CACHE_CALENDAR_DATE, todayStr);
      }
    } catch {
      // ignore
    }
    return [];
  }, []);

  const [loadingCalendar, setLoadingCalendar] = useCachedState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const todayStr = istanbulDay(Date.now());
      const storedDate = localStorage.getItem(CACHE_CALENDAR_DATE);
      if (storedDate === todayStr) {
        const raw = localStorage.getItem(CACHE_CALENDAR_DATA);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) return false;
        }
      }
    } catch {
      // ignore
    }
    return true;
  }, true);

  const [calendarError, setCalendarError] = useState(false);
  const [calendarFallback, setCalendarFallback] = useState(false);

  // 1 & 4. BIST CANLI VERİ ÇEKME & 20 SANİYEDE BİR GÜNCELLEME:
  useEffect(() => {
    let isMounted = true;

    const processAndSetMarketData = (rawList: unknown[]) => {
      if (!Array.isArray(rawList) || rawList.length === 0) return;

      const parsedStocks: (StockMover & { volumeNum: number })[] = [];
      const stockMap = new Map<string, StockMover & { volumeNum: number }>();

      rawList.forEach((item) => {
        const parsed = parseRawStock(item as RawBistStock);
        if (parsed) {
          parsedStocks.push(parsed);
          stockMap.set(parsed.symbol, parsed);
        }
      });

      if (parsedStocks.length === 0) return;

      const dynamicSectors: SectorItem[] = SECTOR_DEFINITIONS.map((def) => {
        if (stockMap.has(def.code)) {
          return {
            code: def.code,
            name: def.name,
            change: stockMap.get(def.code)!.changePercent,
          };
        }

        const matching = def.keyStocks
          .map((sym) => stockMap.get(sym))
          .filter((st): st is StockMover & { volumeNum: number } => !!st);

        let finalChange = 0;
        if (matching.length > 0) {
          const sum = matching.reduce((acc, curr) => acc + curr.changePercent, 0);
          finalChange = Math.round((sum / matching.length) * 100) / 100;
        }

        return {
          code: def.code,
          name: def.name,
          change: finalChange,
        };
      });

      if (isMounted) {
        setSectors(dynamicSectors);

        try {
          localStorage.setItem(
            CACHE_BIST_DATA,
            JSON.stringify({
              sectors: dynamicSectors,
              timestamp: Date.now(),
            })
          );
        } catch {
          // ignore
        }
      }
    };

    const updateMarketData = async () => {
      const data = await fetchBistMarketData();
      if (data && Array.isArray(data) && data.length > 0) {
        processAndSetMarketData(data);
      }
    };

    void updateMarketData();

    const interval = setInterval(() => {
      void updateMarketData();
    }, 20000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [setSectors]);

  // 2. Canlı Takvim Verisi Çekme (TradingView API /api/calendar + Günlük Otomatik Sıfırlama)
  useEffect(() => {
    let isMounted = true;
    let fetching = false;

    const fetchCalendar = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const res = await fetch("/api/calendar", { cache: "no-store", signal: AbortSignal.timeout(25_000) });
        if (!res.ok) throw new Error("Takvim güncellenemedi");
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.success !== true || !Array.isArray(data.events)) throw new Error("Geçersiz takvim yanıtı");
          if (isMounted && data.date === istanbulDay(Date.now())) {
            setCalendarError(data.stale === true || data.degraded === true);
            setCalendarFallback(data.degraded === true);
            setCalendarEvents(current => {
              const events = mergeCalendarReadings(current, data.events as EconomicCalendarItem[]);
              try {
                localStorage.setItem(CACHE_CALENDAR_DATE, data.date);
                localStorage.setItem(CACHE_CALENDAR_DATA, JSON.stringify(events));
              } catch {
                // ignore
              }
              return events;
            });
          }
        }
      } catch {
        // Ağ kesintisinde mevcut veriler korunur
        if (isMounted) {
          setCalendarError(true);
          setCalendarFallback(false);
          setCalendarEvents(current => current.filter(item => isCurrentNewsItem(item)));
        }
      } finally {
        fetching = false;
        if (isMounted) setLoadingCalendar(false);
      }
    };

    const stopDayWatch = watchIstanbulDay(() => {
      setCalendarEvents([]);
      try {
        localStorage.removeItem(CACHE_CALENDAR_DATA);
        localStorage.setItem(CACHE_CALENDAR_DATE, istanbulDay(Date.now()));
      } catch { /* Storage is optional. */ }
      void fetchCalendar();
    });
    void fetchCalendar();
    const interval = setInterval(() => {
      void fetchCalendar();
    }, 60000);

    return () => {
      isMounted = false;
      clearInterval(interval);
      stopDayWatch();
    };
  }, [setCalendarEvents, setLoadingCalendar]);

  return (
    <div className="terminal-grid terminal-secondary-grid">
      {/* ================= 1. KOLON: / BIST Sektör (h-[380px]) ================= */}
      <div className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[380px] overflow-hidden">
        <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
          <div className="flex items-center">
            <span className="font-mono text-xs font-bold tracking-wider text-slate-200">
              <span className="text-[#38bdf8] mr-1.5 font-bold">/</span>
              BIST Sektör
            </span>
          </div>
        </div>

        {/* SEKTÖR AKIŞI (Veri yüklenene kadar Skeleton Loader, yüklendiğinde canlı barlar) */}
        <div className="flex flex-col justify-between h-full flex-1 px-3 py-2">
          {sectors.length === 0 ? (
            <div className="flex flex-col justify-between h-full py-1">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center justify-between animate-pulse px-1.5 py-1">
                  <div className="h-3 w-24 bg-slate-800/80 rounded" />
                  <div className="h-2 w-28 bg-slate-800/50 rounded" />
                  <div className="h-3 w-12 bg-slate-800/80 rounded" />
                </div>
              ))}
            </div>
          ) : (
            sectors.map((s) => {
              const isPositive = s.change >= 0;
              const barWidthPct = Math.min(Math.abs(s.change) * 25, 100);

              return (
                <div
                  key={s.code}
                  className="flex items-center text-xs font-mono py-1 hover:bg-white/[0.02] rounded px-1.5 transition-colors"
                >
                  {/* Sol: Sektör Kodu ve İsim */}
                  <div className="w-[110px] shrink-0 flex items-center justify-between pr-2 border-r border-white/[0.04]">
                    <span className="text-[#38bdf8] font-bold text-[11px] font-mono">{s.code}</span>
                    <span className="text-slate-400 text-[10px] truncate max-w-[65px]">
                      {s.name}
                    </span>
                  </div>

                  {/* Orta: relative w-28 h-2 bg-slate-900 rounded ve orta çizgi referansı */}
                  <div className="flex-1 flex items-center justify-center mx-2">
                    <div className="relative w-28 h-2 bg-slate-900 rounded overflow-hidden flex items-center">
                      <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-700/60 z-10" />

                      <div className="w-1/2 h-full flex justify-end">
                        {!isPositive && (
                          <div
                            className="h-full bg-rose-500 rounded-l transition-all duration-500"
                            style={{ width: `${barWidthPct}%` }}
                          />
                        )}
                      </div>

                      <div className="w-1/2 h-full flex justify-start">
                        {isPositive && (
                          <div
                            className="h-full bg-emerald-500 rounded-r transition-all duration-500"
                            style={{ width: `${barWidthPct}%` }}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Sağ: Yüzde Metni */}
                  <div className="w-[52px] shrink-0 text-right">
                    <span
                      className={`text-[11px] font-semibold font-mono tabular-nums ${
                        isPositive ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {s.change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ================= 2. KOLON: / TAKVİM (Ferah Tipografi & Skeleton Loader) ================= */}
      <div className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[380px] overflow-hidden">
        <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
          <div className="flex items-center">
            <span className="font-mono text-xs font-bold tracking-wider text-slate-200">
              <span className="text-[#38bdf8] mr-1.5 font-bold">/</span>
              TAKVİM
            </span>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 pane-scroll p-0 flex flex-col gap-0">
          {calendarError && <div role="status" className="px-2 py-1 text-[10px] text-amber-400 border-b border-white/[0.05]">{calendarFallback ? "Takvim yedek kaynaktan gösteriliyor; sonuçlar eksik olabilir." : <>Takvim güncellenemedi. {calendarEvents.length > 0 ? "Son alınan veriler gösteriliyor. " : ""}Yeniden deneniyor.</>}</div>}
          {loadingCalendar && calendarEvents.length === 0 ? (
            [...Array(5)].map((_, i) => (
              <div
                key={i}
                className="px-1 py-0.5 border-b border-white/[0.05] flex items-center justify-between gap-3 animate-pulse"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-10 bg-slate-800 rounded" />
                    <div className="h-4 w-6 bg-slate-800 rounded" />
                    <div className="h-3 w-40 bg-slate-800/80 rounded" />
                  </div>
                  <div className="h-2.5 w-32 bg-slate-800/50 rounded ml-7" />
                </div>
                <div className="w-20 flex flex-col items-end gap-1.5">
                  <div className="h-3 w-12 bg-slate-800 rounded" />
                  <div className="h-3.5 w-16 bg-slate-800/60 rounded" />
                </div>
              </div>
            ))
          ) : calendarEvents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 font-mono text-xs select-none">
              <span>{calendarError ? "Takvim bağlantısı bekleniyor..." : "Bugüne ait açıklanacak makro veri bulunmuyor..."}</span>
            </div>
          ) : (
            calendarEvents.map((item) => {
              const trTitle = displayCalendarTitle(item.title);
              const actualText = formatCalendarValue(item.actual, item);
              const hasActual = actualText !== "--";

              return (
                <div
                  key={item.id}
                  className="px-1 py-0.5 shrink-0 border-b border-white/[0.07] last:border-b-0 hover:bg-[#131f38] transition-colors flex items-center justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0">
                      <span className="text-xs font-mono tabular-nums text-slate-300 font-bold shrink-0">
                        {item.time}
                      </span>
                      {renderCountryBadge(item.country)}
                      <span className="text-xs font-semibold text-slate-100 truncate leading-snug">
                        {trTitle}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1 mt-0">
                      <span>
                        Bekl:{" "}
                        <span className="text-slate-200 font-medium tabular-nums">
                          {formatCalendarValue(item.forecast, item)}
                        </span>
                      </span>
                      <span className="text-slate-600">|</span>
                      <span>
                        Önceki:{" "}
                        <span className="text-slate-300 tabular-nums">
                          {formatCalendarValue(item.previous, item)}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="min-w-12 text-right shrink-0 flex flex-col items-end justify-center">
                    {hasActual ? (
                      <>
                        <span className="text-xs font-mono font-bold text-emerald-400 block tabular-nums">
                          {actualText}
                        </span>
                        <span className="text-[9px] font-mono font-bold tracking-wider text-emerald-400 bg-emerald-950/60 border border-emerald-800/50 px-0.5 py-0 rounded-sm uppercase block leading-3 mt-0">
                          AÇIKLANDI
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-xs font-mono text-slate-500 block tabular-nums">
                          --
                        </span>
                        <span className="text-[9px] font-mono font-medium tracking-wider text-slate-400 bg-slate-900 border border-slate-800 px-0.5 py-0 rounded-sm uppercase block leading-3 mt-0">
                          BEKLENİYOR
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Kripto haber akışı */}
      <div className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[380px] overflow-hidden">
        <div className="h-10 px-4 flex items-center border-b border-white/[0.06] bg-slate-900/40 shrink-0">
          <h2 className="font-mono text-xs font-semibold tracking-wider text-slate-200">
            <span className="text-[#38bdf8] font-bold mr-1.5">/</span>
            Kripto
          </h2>
        </div>
        <OfficialNews backendUrl={backendUrl} onSelect={onSelectNews} endpoint="crypto-news" feedName="Telegram" bistStyle />
      </div>
    </div>
  );
}
