"use client";

import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

type MoverTab = "sectors" | "gainers" | "losers" | "volume";

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

const DEFAULT_GAINERS: StockMover[] = [
  { symbol: "ASELS", price: 89.20, changePercent: 6.85, volumeStr: "8.42 Mr TL", isUp: true },
  { symbol: "THYAO", price: 326.00, changePercent: 4.92, volumeStr: "14.28 Mr TL", isUp: true },
  { symbol: "AKBNK", price: 63.40, changePercent: 3.88, volumeStr: "7.95 Mr TL", isUp: true },
  { symbol: "KCHOL", price: 215.80, changePercent: 3.65, volumeStr: "5.64 Mr TL", isUp: true },
  { symbol: "TUPRS", price: 185.50, changePercent: 3.24, volumeStr: "6.12 Mr TL", isUp: true },
  { symbol: "BIMAS", price: 514.50, changePercent: 2.90, volumeStr: "4.81 Mr TL", isUp: true },
  { symbol: "EREGL", price: 47.80, changePercent: 2.58, volumeStr: "5.10 Mr TL", isUp: true },
  { symbol: "ISCTR", price: 14.95, changePercent: 2.40, volumeStr: "9.85 Mr TL", isUp: true },
  { symbol: "SAHOL", price: 92.15, changePercent: 2.16, volumeStr: "4.20 Mr TL", isUp: true },
  { symbol: "YKBNK", price: 31.60, changePercent: 1.94, volumeStr: "6.82 Mr TL", isUp: true },
];

const DEFAULT_LOSERS: StockMover[] = [
  { symbol: "HEKTS", price: 3.80, changePercent: -4.74, volumeStr: "1.12 Mr TL", isUp: false },
  { symbol: "SASA", price: 4.46, changePercent: -3.66, volumeStr: "2.35 Mr TL", isUp: false },
  { symbol: "KONTR", price: 48.70, changePercent: -3.18, volumeStr: "1.85 Mr TL", isUp: false },
  { symbol: "GUBRF", price: 182.10, changePercent: -2.93, volumeStr: "1.78 Mr TL", isUp: false },
  { symbol: "EUPWR", price: 43.15, changePercent: -2.80, volumeStr: "1.42 Mr TL", isUp: false },
  { symbol: "ASTOR", price: 94.25, changePercent: -2.44, volumeStr: "2.65 Mr TL", isUp: false },
  { symbol: "ENKAI", price: 45.10, changePercent: -2.17, volumeStr: "1.94 Mr TL", isUp: false },
  { symbol: "ALARK", price: 96.80, changePercent: -1.92, volumeStr: "1.60 Mr TL", isUp: false },
  { symbol: "KOZAL", price: 23.35, changePercent: -1.85, volumeStr: "2.05 Mr TL", isUp: false },
  { symbol: "PETKM", price: 19.82, changePercent: -1.68, volumeStr: "2.41 Mr TL", isUp: false },
];

const DEFAULT_VOLUME: StockMover[] = [
  { symbol: "THYAO", price: 326.00, changePercent: 4.92, volumeStr: "14.28 Mr TL", isUp: true },
  { symbol: "ISCTR", price: 14.95, changePercent: 2.40, volumeStr: "9.85 Mr TL", isUp: true },
  { symbol: "ASELS", price: 89.20, changePercent: 6.85, volumeStr: "8.42 Mr TL", isUp: true },
  { symbol: "AKBNK", price: 63.40, changePercent: 3.88, volumeStr: "7.95 Mr TL", isUp: true },
  { symbol: "YKBNK", price: 31.60, changePercent: 1.94, volumeStr: "6.82 Mr TL", isUp: true },
  { symbol: "TUPRS", price: 185.50, changePercent: 3.24, volumeStr: "6.12 Mr TL", isUp: true },
  { symbol: "KCHOL", price: 215.80, changePercent: 3.65, volumeStr: "5.64 Mr TL", isUp: true },
  { symbol: "EREGL", price: 47.80, changePercent: 2.58, volumeStr: "5.10 Mr TL", isUp: true },
  { symbol: "BIMAS", price: 514.50, changePercent: 2.90, volumeStr: "4.81 Mr TL", isUp: true },
  { symbol: "SAHOL", price: 92.15, changePercent: 2.16, volumeStr: "4.20 Mr TL", isUp: true },
];

const DEFAULT_SECTORS: SectorItem[] = [
  { code: "XBANK", name: "Bankacılık", change: 2.48 },
  { code: "XULAŞ", name: "Ulaştırma", change: 2.15 },
  { code: "XHOLD", name: "Holding", change: 1.34 },
  { code: "XMANA", name: "Metal Ana", change: 0.72 },
  { code: "XUSIN", name: "Sanayi", change: 0.45 },
  { code: "XGIDA", name: "Gıda İçecek", change: -0.38 },
  { code: "XGMYO", name: "Gayrimenkul", change: -0.82 },
  { code: "XBLSM", name: "Bilişim", change: -1.24 },
  { code: "XKMYA", name: "Kimya Petrol", change: -1.55 },
  { code: "XINSA", name: "İnşaat", change: -1.82 },
];

const FALLBACK_CALENDAR: EconomicCalendarItem[] = [
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
    title: "Euro Bölgesi Tüketici Güven Endeksi (Nihai)",
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
    title: "Japonya Tüketici Güveni Endeksi",
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
];

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

// Ülke rozeti renklendirme (TR: kırmızı, US: mavi, EU: lacivert/mavi, CN: amber, JP: indigo)
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

export default function MarketIntelligence() {
  // Varsayılan olarak (ilk açılışta) Sektör sekmesi aktif
  const [activeTab, setActiveTab] = useState<MoverTab>("sectors");
  const [gainers, setGainers] = useState<StockMover[]>(DEFAULT_GAINERS);
  const [losers, setLosers] = useState<StockMover[]>(DEFAULT_LOSERS);
  const [volume, setVolume] = useState<StockMover[]>(DEFAULT_VOLUME);
  const [sectors, setSectors] = useState<SectorItem[]>(DEFAULT_SECTORS);
  const [tickingSymbol, setTickingSymbol] = useState<string | null>(null);

  // Canlı Takvim State (Önce localStorage veya fallback ile başlat)
  const [calendarEvents, setCalendarEvents] = useState<EconomicCalendarItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
        const storedDate = localStorage.getItem(CACHE_CALENDAR_DATE);
        if (storedDate === todayStr) {
          const raw = localStorage.getItem(CACHE_CALENDAR_DATA);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        }
      } catch {
        // ignore
      }
    }
    return FALLBACK_CALENDAR;
  });

  // 1. Canlı BIST verilerini sunucu rotasından çek (/api/bist-movers)
  useEffect(() => {
    let isMounted = true;
    const fetchMovers = async () => {
      try {
        const res = await fetch("/api/bist-movers", { cache: "no-store" });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.gainers && Array.isArray(data.gainers)) {
            setGainers(data.gainers.slice(0, 10));
          }
          if (data.losers && Array.isArray(data.losers)) {
            setLosers(data.losers.slice(0, 10));
          }
          if (data.volume && Array.isArray(data.volume)) {
            setVolume(data.volume.slice(0, 10));
          }
          if (data.sectors && Array.isArray(data.sectors)) {
            setSectors(data.sectors);
          }
        }
      } catch {
        // Fallback veriler aktif kalır
      }
    };

    void fetchMovers();
    const interval = setInterval(() => {
      void fetchMovers();
    }, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Canlı Takvim Verisi Çekme (TradingView API /api/calendar + Günlük Otomatik Sıfırlama)
  useEffect(() => {
    let isMounted = true;

    // Yeni gün kontrolü (dünün takvimi kalmışsa sil)
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

  // 3. Canlı terminal hissi için mikro dalgalanma (Fiyat/oran titremesi)
  useEffect(() => {
    const tickInterval = setInterval(() => {
      const activeList =
        activeTab === "gainers" ? gainers : activeTab === "losers" ? losers : volume;

      if (!activeList || activeList.length === 0) return;

      const randomIdx = Math.floor(Math.random() * activeList.length);
      const chosen = activeList[randomIdx];
      if (!chosen) return;

      const deltaPercent = (Math.random() * 0.12 - 0.06);
      const newPct = Math.round((chosen.changePercent + deltaPercent) * 100) / 100;
      const newPrice = Math.round((chosen.price * (1 + deltaPercent / 100)) * 100) / 100;

      const updateList = (prev: StockMover[]) =>
        prev.map((item, idx) =>
          idx === randomIdx
            ? {
                ...item,
                price: newPrice,
                changePercent: newPct,
                isUp: newPct >= 0,
              }
            : item
        );

      if (activeTab === "gainers") setGainers(updateList);
      else if (activeTab === "losers") setLosers(updateList);
      else if (activeTab === "volume") setVolume(updateList);

      setTickingSymbol(chosen.symbol);
      setTimeout(() => setTickingSymbol(null), 1200);
    }, 4500);

    return () => clearInterval(tickInterval);
  }, [activeTab, gainers, losers, volume]);

  const currentStocks: StockMover[] =
    activeTab === "gainers"
      ? gainers.slice(0, 10)
      : activeTab === "losers"
      ? losers.slice(0, 10)
      : volume.slice(0, 10);

  const maxAbsSectorChange = 3.2;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-[10px]">
      {/* ================= 1. KOLON: / BIST Hareketler (h-[380px]) ================= */}
      <div className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[380px] overflow-hidden">
        {/* Header: Başlık ve Entegre Segment Sekmeleri */}
        <div className="h-10 px-3 sm:px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
          <div className="flex items-center">
            <span className="font-mono text-xs font-bold tracking-wider text-slate-200">
              <span className="text-[#38bdf8] mr-1.5 font-bold">/</span>
              BIST Hareketler
            </span>
          </div>

          {/* Entegre Segment Sekmeleri: Sektör | Artanlar | Düşenler | Hacim */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-md border border-white/[0.06]">
            {[
              { id: "sectors" as const, label: "Sektör" },
              { id: "gainers" as const, label: "Artanlar" },
              { id: "losers" as const, label: "Düşenler" },
              { id: "volume" as const, label: "Hacim" },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1 text-xs font-mono rounded transition-all select-none ${
                    isActive
                      ? "bg-[#2563eb] text-white font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sekme 1: SEKTÖR AKIŞI (Çift Yönlü 0-Merkezli Bar Grafiği) */}
        {activeTab === "sectors" ? (
          <div className="flex flex-col justify-between h-full flex-1 px-3 py-1">
            {sectors.map((s) => {
              const isPositive = s.change >= 0;
              const widthPct = Math.min(
                100,
                Math.round((Math.abs(s.change) / maxAbsSectorChange) * 100)
              );

              return (
                <div
                  key={s.code}
                  className="flex items-center text-xs font-mono py-1 hover:bg-white/[0.02] rounded px-1.5 transition-colors"
                >
                  {/* Sol: Sektör Kodu ve İsim */}
                  <div className="w-[110px] shrink-0 flex items-center justify-between pr-2 border-r border-white/[0.04]">
                    <span className="text-[#38bdf8] font-bold text-[11px]">{s.code}</span>
                    <span className="text-slate-400 text-[10px] truncate max-w-[65px]">
                      {s.name}
                    </span>
                  </div>

                  {/* Orta: 0 Merkezli Çift Yönlü Bar */}
                  <div className="flex-1 flex items-center h-4 mx-2 relative bg-slate-900/40 rounded-sm overflow-hidden">
                    {/* Merkez Çizgisi */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-700/60 z-10" />

                    {/* Negatif Bar (Sola doğru) */}
                    <div className="w-1/2 h-full flex justify-end">
                      {!isPositive && (
                        <div
                          className="h-full bg-rose-500/80 rounded-l-xs transition-all duration-500"
                          style={{ width: `${widthPct}%` }}
                        />
                      )}
                    </div>

                    {/* Pozitif Bar (Sağa doğru) */}
                    <div className="w-1/2 h-full flex justify-start">
                      {isPositive && (
                        <div
                          className="h-full bg-emerald-500/80 rounded-r-xs transition-all duration-500"
                          style={{ width: `${widthPct}%` }}
                        />
                      )}
                    </div>
                  </div>

                  {/* Sağ: Yüzde Değer */}
                  <div className="w-[52px] shrink-0 text-right">
                    <span
                      className={`text-[11px] font-semibold tabular-nums ${
                        isPositive ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {s.change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Sekme 2, 3, 4: Artanlar / Düşenler / Hacim (İlk 10 Hisse) */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Tablo Başlıkları */}
            <div className="grid grid-cols-12 px-3.5 py-1.5 text-[10.5px] font-mono text-slate-500 border-b border-white/[0.04] bg-slate-900/30 shrink-0">
              <span className="col-span-3">SEMBOL</span>
              <span className="col-span-3 text-right">SON (TL)</span>
              <span className="col-span-3 text-right">HACİM</span>
              <span className="col-span-3 text-right">FARK %</span>
            </div>

            {/* Hisse Satırları (Maksimum 10) */}
            <div className="flex flex-col justify-between h-full flex-1 py-1 divide-y divide-white/[0.03]">
              {currentStocks.map((stock) => {
                const isPositive = stock.changePercent >= 0;
                const isTicking = tickingSymbol === stock.symbol;

                return (
                  <div
                    key={stock.symbol}
                    className={`grid grid-cols-12 px-3.5 py-1 text-xs font-mono items-center hover:bg-[#111a2e]/60 transition-colors ${
                      isTicking ? (isPositive ? "bg-emerald-950/20" : "bg-rose-950/20") : ""
                    }`}
                  >
                    {/* Sembol (Sadece kalın #38bdf8 kodu) */}
                    <div className="col-span-3 flex items-center gap-1.5">
                      <span className="text-[#38bdf8] font-bold text-[12px] tracking-wide">
                        {stock.symbol}
                      </span>
                      {isPositive ? (
                        <ArrowUpRight className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 text-rose-400 shrink-0" />
                      )}
                    </div>

                    {/* Son Fiyat */}
                    <div className="col-span-3 text-right tabular-nums text-slate-200 font-semibold text-[11.5px]">
                      {stock.price.toFixed(2)}
                    </div>

                    {/* Hacim */}
                    <div className="col-span-3 text-right tabular-nums text-slate-400 text-[10.5px]">
                      {stock.volumeStr}
                    </div>

                    {/* Fark % */}
                    <div className="col-span-3 text-right">
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] font-bold tabular-nums border ${
                          isPositive
                            ? "text-emerald-400 bg-emerald-950/60 border-emerald-800/40"
                            : "text-rose-400 bg-rose-950/60 border-rose-800/40"
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {stock.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ================= 2. KOLON: / TAKVİM (Ferah Tipografi & h-[380px]) ================= */}
      <div className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[380px] overflow-hidden">
        {/* Header */}
        <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
          <div className="flex items-center">
            <span className="font-mono text-xs font-bold tracking-wider text-slate-200">
              <span className="text-[#38bdf8] mr-1.5 font-bold">/</span>
              TAKVİM
            </span>
          </div>
        </div>

        {/* Canlı Takvim Satırları (Ferah Boşluk ve Net Sağ/Sol Hiyerarşi) */}
        <div className="overflow-y-auto flex-1 pane-scroll">
          {calendarEvents.map((item) => {
            const trTitle = translateIndicatorTitle(item.title);
            const hasActual = item.actual !== null && item.actual !== undefined;

            return (
              <div
                key={item.id}
                className="py-3 px-3.5 border-b border-white/[0.06] last:border-b-0 flex items-center justify-between gap-4 hover:bg-[#111a2e]/60 transition-colors"
              >
                {/* Sol Taraf: Saat, Bayrak, Başlık ve Beklenti Detayı */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono tabular-nums text-slate-400 font-semibold shrink-0">
                      {item.time}
                    </span>
                    {renderCountryBadge(item.country)}
                    <span className="text-xs font-medium text-slate-100 truncate leading-tight">
                      {trTitle}
                    </span>
                  </div>

                  {/* Alt Detay: Beklenti vs Önceki */}
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5 pl-6 flex items-center gap-2">
                    <span>
                      Bekl:{" "}
                      <span className="text-slate-200 font-medium tabular-nums">
                        {item.forecast !== null && item.forecast !== undefined ? String(item.forecast) : "--"}
                      </span>
                    </span>
                    <span className="text-slate-700">|</span>
                    <span>
                      Önceki:{" "}
                      <span className="text-slate-300 tabular-nums">
                        {item.previous !== null && item.previous !== undefined ? String(item.previous) : "--"}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Sağ Taraf: Sabit Genişlikli Açıklanan Değer Bloğu */}
                <div className="w-24 text-right shrink-0">
                  {hasActual ? (
                    <>
                      <span className="text-xs font-mono font-bold text-emerald-400 block tabular-nums">
                        {String(item.actual)}
                      </span>
                      <span className="text-[9px] font-mono tracking-wider text-emerald-500/80 uppercase block mt-0.5">
                        AÇIKLANDI
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-xs font-mono text-slate-600 block tabular-nums">
                        --
                      </span>
                      <span className="text-[9px] font-mono tracking-wider text-slate-600 uppercase block mt-0.5">
                        BEKLENİYOR
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ================= 3. KOLON: / Bülten (Dönen Neon Işık - Border Beam - h-[380px]) ================= */}
      <div className="relative rounded-lg p-[1px] overflow-hidden bg-slate-900/60 h-[380px]">
        {/* Dönen Koni / Gradyan Efekti (Snake Animation) */}
        <div 
          className="absolute -inset-[100%] animate-border-beam"
          style={{
            background: "conic-gradient(from 0deg, transparent 0 340deg, #38bdf8 360deg)",
          }}
        />

        {/* İç Kart Gövdesi */}
        <div className="relative h-full w-full bg-[#0b0f19] rounded-[7px] flex flex-col z-10 overflow-hidden">
          {/* Başlık Alanı */}
          <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
            <span className="text-xs font-mono font-bold text-slate-200">
              <span className="text-[#38bdf8] mr-1">/</span>Bülten
            </span>
            <span className="text-[10px] font-mono text-slate-500 tracking-wider">RAPOR & ANALİZ</span>
          </div>

          {/* İçerik */}
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
