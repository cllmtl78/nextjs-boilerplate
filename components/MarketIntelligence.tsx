"use client";

import { useState, useEffect } from "react";

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

export interface EconomicCalendarItem {
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


const CACHE_CALENDAR_DATE = "bpt_calendar_date";
const CACHE_CALENDAR_DATA = "bpt_calendar_data";

// İngilizce gösterge isimlerini finansal Türkçe terminolojiye dönüştür
const translateIndicatorTitle = (title: string): string => {
  if (!title) return "Ekonomik Gösterge";
  const map: [RegExp, string][] = [
    [/Republic Day/i, "29 Ekim Cumhuriyet Bayramı"],
    [/Consumer Confidence Final/i, "Tüketici Güven Endeksi (Nihai)"],
    [/Consumer Confidence/i, "Tüketici Güveni Endeksi"],
    [/Initial Jobless Claims/i, "İşsizlik Maaşı Başvuruları"],
    [/Continuing Jobless Claims/i, "Devam Eden İşsizlik Başvuruları"],
    [/GDP Growth Rate|GDP/i, "GSYİH Büyüme Oranı"],
    [/Inflation Rate|CPI/i, "TÜFE Enflasyon Oranı"],
    [/Core PCE Price Index/i, "Çekirdek PCE Fiyat Endeksi"],
    [/PCE Price Index/i, "PCE Fiyat Endeksi"],
    [/Interest Rate Decision/i, "Faiz Oranı Kararı"],
    [/Manufacturing PMI/i, "İmalat PMI Endeksi"],
    [/Services PMI/i, "Hizmet PMI Endeksi"],
    [/Composite PMI/i, "Bileşik PMI Endeksi"],
    [/Retail Sales/i, "Perakende Satışlar"],
    [/Crude Oil Inventories/i, "Ham Petrol Stokları"],
    [/Non Farm Payrolls|NFP/i, "Tarım Dışı İstihdam (NFP)"],
    [/Unemployment Rate/i, "İşsizlik Oranı"],
    [/Trade Balance/i, "Dış Ticaret Dengesi"],
    [/Industrial Production/i, "Sanayi Üretimi"],
    [/Building Permits/i, "İnşaat İzinleri"],
    [/Housing Starts/i, "Konut Başlangıçları"],
    [/Current Account/i, "Cari Denge"],
    [/Wholesale Inventories/i, "Toptan Satış Stokları"],
    [/Business Confidence/i, "İş Dünyası Güven Endeksi"],
    [/3-Month Bill Auction/i, "3 Aylık Hazine Bonosu İhalesi"],
    [/2-Year JGB Auction/i, "2 Yıllık Devlet Tahvili İhalesi"],
    [/Selling Price Expectations/i, "Satış Fiyatı Beklentileri"],
    [/Services Sentiment/i, "Hizmet Sektörü Güveni"],
    [/Industrial Sentiment/i, "Sanayi Güveni"],
    [/Consumer Inflation Expectations/i, "Tüketici Enflasyon Beklentisi"],
    [/Communist Party Fifth Plenum/i, "Çin Komünist Partisi Genel Kurulu"],
  ];
  for (const [regex, tr] of map) {
    if (regex.test(title)) return tr;
  }
  return title;
};

// Ülke rozeti renklendirme
const renderCountryBadge = (country: "TR" | "US" | "EU" | "CN" | "JP") => {
  switch (country) {
    case "TR":
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-800/60 text-rose-300 font-mono shrink-0">
          TR
        </span>
      );
    case "US":
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-800/60 text-sky-300 font-mono shrink-0">
          US
        </span>
      );
    case "EU":
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-950/70 border border-blue-800/60 text-blue-300 font-mono shrink-0">
          EU
        </span>
      );
    case "CN":
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-800/60 text-amber-300 font-mono shrink-0">
          CN
        </span>
      );
    case "JP":
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-950/70 border border-indigo-800/60 text-indigo-300 font-mono shrink-0">
          JP
        </span>
      );
    default:
      return (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono shrink-0">
          {country}
        </span>
      );
  }
};

const CACHE_BIST_DATA = "bpt_bist_market_data";

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

const fetchBistMarketData = async (): Promise<unknown[] | null> => {
  const targetUrl = "https://bigpara.hurriyet.com.tr/api/v1/hisse/canli";
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;

  try {
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
    const json = await res.json();
    if (json && Array.isArray(json.data) && json.data.length > 0) {
      return json.data;
    }
  } catch {
    try {
      const resAlt = await fetch(
        `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`
      );
      const jsonAlt = await resAlt.json();
      if (jsonAlt && Array.isArray(jsonAlt.data) && jsonAlt.data.length > 0) {
        return jsonAlt.data;
      }
    } catch {
      // proxy hatası
    }
  }

  try {
    const sRes = await fetch("/api/bist-market-data", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (sRes.ok) {
      const sJson = await sRes.json();
      if (sJson && Array.isArray(sJson.data) && sJson.data.length > 0) {
        return sJson.data;
      }
    }
  } catch {
    // ignore
  }

  return null;
};

const SECTOR_DEFINITIONS: { code: string; name: string; keyStocks: string[]; fallbackChange: number }[] = [
  { code: "XBANK", name: "Bankacılık", keyStocks: ["AKBNK", "ISCTR", "YKBNK", "GARAN", "VAKBN"], fallbackChange: 2.48 },
  { code: "XULAŞ", name: "Ulaştırma", keyStocks: ["THYAO", "PGSUS", "TAVHL", "CLEBI"], fallbackChange: 2.15 },
  { code: "XHOLD", name: "Holding", keyStocks: ["KCHOL", "SAHOL", "ALARK", "ENKAI"], fallbackChange: 1.34 },
  { code: "XMANA", name: "Metal Ana", keyStocks: ["EREGL", "KRDMD", "CEMTS"], fallbackChange: 0.72 },
  { code: "XUSIN", name: "Sanayi", keyStocks: ["FROTO", "TOASO", "TUPRS", "SISE", "ARCLK"], fallbackChange: 0.45 },
  { code: "XGIDA", name: "Gıda İçecek", keyStocks: ["BIMAS", "MGROS", "CCOLA", "ULKER"], fallbackChange: -0.38 },
  { code: "XGMYO", name: "Gayrimenkul", keyStocks: ["EKGYO", "SNGYO", "ISGYO", "TRGYO"], fallbackChange: -0.82 },
  { code: "XBLSM", name: "Bilişim", keyStocks: ["MIATK", "REEDR", "KFEIN", "VBTYZ"], fallbackChange: -1.24 },
  { code: "XKMYA", name: "Kimya Petrol", keyStocks: ["SASA", "HEKTS", "PETKM", "GUBRF"], fallbackChange: -1.55 },
  { code: "XINSA", name: "İnşaat", keyStocks: ["ENKAI", "OYAKC", "CIMSA", "NUHCM"], fallbackChange: -1.82 },
];

export default function MarketIntelligence() {
  const [sectors, setSectors] = useState<SectorItem[]>([]);

  const [calendarEvents, setCalendarEvents] = useState<EconomicCalendarItem[]>([]);

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

        let finalChange = def.fallbackChange;
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
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (typeof window !== "undefined") {
      try {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const storedDate = localStorage.getItem(CACHE_CALENDAR_DATE);
        if (storedDate && storedDate !== todayStr) {
          localStorage.removeItem(CACHE_CALENDAR_DATA);
          localStorage.setItem(CACHE_CALENDAR_DATE, todayStr);
        }
      } catch {
        // ignore
      }
    }

    const fetchCalendar = async () => {
      try {
        const res = await fetch("/api/calendar", { cache: "no-store" });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (Array.isArray(data.events) && data.events.length > 0) {
            setCalendarEvents(data.events);
            if (typeof window !== "undefined") {
              try {
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
                localStorage.setItem(CACHE_CALENDAR_DATE, todayStr);
                localStorage.setItem(CACHE_CALENDAR_DATA, JSON.stringify(data.events));
              } catch {
                // ignore
              }
            }
          }
        }
      } catch {
        // Ağ kesintisinde mevcut veriler korunur
      }
    };

    void fetchCalendar();
    const interval = setInterval(() => {
      void fetchCalendar();
    }, 45000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-[10px]">
      <div className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[380px] overflow-hidden">
        <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
          <div className="flex items-center">
            <span className="font-mono text-xs font-bold tracking-wider text-slate-200">
              <span className="text-[#38bdf8] mr-1.5 font-bold">/</span>
              BIST Sektör
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 tracking-wider">CANLI ENDEKS</span>
        </div>

        <div className="flex flex-col justify-between h-full flex-1 px-3 py-2">
          {sectors.length === 0 ? (
            <div className="flex flex-col justify-between h-full py-2 space-y-2">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="flex items-center justify-between animate-pulse">
                  <div className="h-3 w-16 bg-slate-800/80 rounded" />
                  <div className="h-2 w-28 bg-slate-800/50 rounded" />
                  <div className="h-3 w-12 bg-slate-800/80 rounded" />
                </div>
              ))}
            </div>
          ) : (
          <>
          {sectors.map((s) => {
            const isPositive = s.change >= 0;
            const barWidthPct = Math.min(Math.abs(s.change) * 25, 100);

            return (
              <div
                key={s.code}
                className="flex items-center text-xs font-mono py-1 hover:bg-white/[0.02] rounded px-1.5 transition-colors"
              >
                <div className="w-[110px] shrink-0 flex items-center justify-between pr-2 border-r border-white/[0.04]">
                  <span className="text-[#38bdf8] font-bold text-[11px] font-mono">{s.code}</span>
                  <span className="text-slate-400 text-[10px] truncate max-w-[65px]">
                    {s.name}
                  </span>
                </div>

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

                <div className="w-14 text-right shrink-0">
                  <span className={`font-mono text-[11px] tabular-nums ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                    {isPositive ? "+" : ""}{s.change.toFixed(2)}%
                  </span>
                </div>
              </div>
            );
          })}
          </>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[380px] overflow-hidden">
        <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
          <div className="flex items-center">
            <span className="font-mono text-xs font-bold tracking-wider text-slate-200">
              <span className="text-[#38bdf8] mr-1.5 font-bold">/</span>
              TAKVİM
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 tracking-wider">EKONOMİK GÖSTERGELER</span>
        </div>

        <div className="overflow-y-auto flex-1 pane-scroll p-3 flex flex-col gap-3">
          {calendarEvents.length === 0 ? (
            <div className="flex flex-col gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="p-3.5 rounded-lg bg-[#0e1628]/90 border border-white/[0.07] animate-pulse flex items-center justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 bg-slate-800/80 rounded" />
                    <div className="h-2.5 w-1/2 bg-slate-800/50 rounded" />
                  </div>
                  <div className="h-6 w-16 bg-slate-800/70 rounded" />
                </div>
              ))}
            </div>
          ) : (
          <>
          {calendarEvents.map((item) => {
            const trTitle = translateIndicatorTitle(item.title);
            const hasActual = item.actual !== null && item.actual !== undefined;

            return (
              <div
                key={item.id}
                className="p-3.5 rounded-lg bg-[#0e1628]/90 border border-white/[0.07] hover:bg-[#131f38] hover:border-white/[0.14] transition-all flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-mono tabular-nums text-slate-300 font-bold shrink-0">
                      {item.time}
                    </span>
                    {renderCountryBadge(item.country)}
                    <span className="text-xs font-semibold text-slate-100 truncate leading-snug">
                      {trTitle}
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 pl-7 flex items-center gap-2 mt-1">
                    <span>
                      Bekl:{" "}
                      <span className="text-slate-200 font-medium tabular-nums">
                        {item.forecast !== null && item.forecast !== undefined ? String(item.forecast) : "--"}
                      </span>
                    </span>
                    <span className="text-slate-600">|</span>
                    <span>
                      Önceki:{" "}
                      <span className="text-slate-300 tabular-nums">
                        {item.previous !== null && item.previous !== undefined ? String(item.previous) : "--"}
                      </span>
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`text-sm font-bold font-mono tabular-nums ${
                    hasActual ? (item.isCompleted ? "text-emerald-400" : "text-slate-200") : "text-slate-500"
                  }`}>
                    {hasActual ? String(item.actual) : "--"}
                  </span>
                </div>
              </div>
            );
          })}
          </>
          )}
        </div>
      </div>

      <div className="relative rounded-lg p-[1px] overflow-hidden bg-slate-900/60 h-[380px]">
        <div 
          className="absolute -inset-[100%] animate-border-beam"
          style={{
            background: "conic-gradient(from 0deg, transparent 0 340deg, #38bdf8 360deg)",
          }}
        />

        <div className="relative h-full w-full bg-[#0b0f19] rounded-[7px] flex flex-col z-10 overflow-hidden">
          <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
            <span className="text-xs font-mono font-bold text-slate-200">
              <span className="text-[#38bdf8] mr-1">/</span>Bülten
            </span>
            <span className="text-[10px] font-mono text-slate-500 tracking-wider">RAPOR & ANALİZ</span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-[#38bdf8]/10 border border-[#38bdf8]/20 flex items-center justify-center text-[#38bdf8] mb-3 shadow-[0_0_15px_rgba(56,189,248,0.15)]">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-slate-200">Bülten verisi bekleniyor...</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
              Günlük aracı kurum ve bülten raporları akışa eklenecektir.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
