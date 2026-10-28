"use client";

import { useState, useEffect } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

type MoverTab = "gainers" | "losers" | "volume";

interface StockMover {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volumeStr: string;
  isUp: boolean;
  highlight?: "cyan" | "amber";
}

interface SectorItem {
  code: string;
  name: string;
  change: number; // e.g. +2.48 or -1.24
}

interface CalendarEvent {
  time: string;
  country: string;
  event: string;
  impact: "high" | "medium" | "low";
  forecast: string;
  actual?: string;
  previous: string;
  isCompleted?: boolean;
}

const INITIAL_GAINERS: StockMover[] = [
  { symbol: "ASELS", name: "Aselsan", price: 88.40, changePercent: 6.85, volumeStr: "8.42 Mr TL", isUp: true, highlight: "cyan" },
  { symbol: "THYAO", name: "Türk Hava Yolları", price: 324.50, changePercent: 4.92, volumeStr: "14.28 Mr TL", isUp: true, highlight: "cyan" },
  { symbol: "AKBNK", name: "Akbank", price: 62.75, changePercent: 3.88, volumeStr: "7.95 Mr TL", isUp: true, highlight: "amber" },
  { symbol: "KCHOL", name: "Koç Holding", price: 214.20, changePercent: 3.65, volumeStr: "5.64 Mr TL", isUp: true, highlight: "cyan" },
  { symbol: "TUPRS", name: "Tüpraş", price: 184.90, changePercent: 3.24, volumeStr: "6.12 Mr TL", isUp: true, highlight: "amber" },
  { symbol: "BIMAS", name: "BİM Birleşik Mağazalar", price: 512.00, changePercent: 2.90, volumeStr: "4.81 Mr TL", isUp: true, highlight: "cyan" },
];

const INITIAL_LOSERS: StockMover[] = [
  { symbol: "HEKTS", name: "Hektaş Ticaret", price: 3.82, changePercent: -4.74, volumeStr: "1.12 Mr TL", isUp: false, highlight: "amber" },
  { symbol: "SASA", name: "SASA Polyester", price: 4.48, changePercent: -3.66, volumeStr: "2.35 Mr TL", isUp: false, highlight: "cyan" },
  { symbol: "GUBRF", name: "Gübre Fabrikaları", price: 182.30, changePercent: -2.93, volumeStr: "1.78 Mr TL", isUp: false, highlight: "cyan" },
  { symbol: "ENKAI", name: "Enka İnşaat", price: 45.12, changePercent: -2.17, volumeStr: "1.94 Mr TL", isUp: false, highlight: "amber" },
  { symbol: "KOZAL", name: "Koza Altın", price: 23.40, changePercent: -1.85, volumeStr: "2.05 Mr TL", isUp: false, highlight: "cyan" },
  { symbol: "PETKM", name: "Petkim Petrokimya", price: 19.85, changePercent: -1.68, volumeStr: "2.41 Mr TL", isUp: false, highlight: "amber" },
];

const INITIAL_VOLUME: StockMover[] = [
  { symbol: "THYAO", name: "Türk Hava Yolları", price: 324.50, changePercent: 4.92, volumeStr: "14.28 Mr TL", isUp: true, highlight: "cyan" },
  { symbol: "ISCTR", name: "İş Bankası (C)", price: 14.85, changePercent: 2.41, volumeStr: "9.85 Mr TL", isUp: true, highlight: "amber" },
  { symbol: "ASELS", name: "Aselsan", price: 88.40, changePercent: 6.85, volumeStr: "8.42 Mr TL", isUp: true, highlight: "cyan" },
  { symbol: "AKBNK", name: "Akbank", price: 62.75, changePercent: 3.88, volumeStr: "7.95 Mr TL", isUp: true, highlight: "amber" },
  { symbol: "YKBNK", name: "Yapı Kredi", price: 31.40, changePercent: 1.95, volumeStr: "6.82 Mr TL", isUp: true, highlight: "cyan" },
  { symbol: "TUPRS", name: "Tüpraş", price: 184.90, changePercent: 3.24, volumeStr: "6.12 Mr TL", isUp: true, highlight: "amber" },
];

const INITIAL_SECTORS: SectorItem[] = [
  { code: "XBANK", name: "Bankacılık", change: 2.48 },
  { code: "XULAŞ", name: "Ulaştırma", change: 2.15 },
  { code: "XHOLD", name: "Holding", change: 1.34 },
  { code: "XMANA", name: "Metal Ana", change: 0.72 },
  { code: "XUSIN", name: "Sanayi", change: 0.45 },
  { code: "XGIDA", name: "Gıda İçecek", change: -0.38 },
  { code: "XGMYO", name: "Gayrimenkul", change: -0.82 },
  { code: "XBLSM", name: "Bilişim", change: -1.24 },
];

const MACRO_CALENDAR: CalendarEvent[] = [
  {
    time: "14:00",
    country: "TR",
    event: "TCMB Politika Faizi Kararı (Bir Hafta Repo)",
    impact: "high",
    forecast: "%50.00",
    previous: "%50.00",
  },
  {
    time: "15:30",
    country: "US",
    event: "ABD Tarım Dışı İstihdam (NFP - Aylık)",
    impact: "high",
    forecast: "185K",
    previous: "175K",
  },
  {
    time: "10:00",
    country: "TR",
    event: "TÜİK Tüketici Fiyat Endeksi (TÜFE Yıllık)",
    impact: "high",
    forecast: "%38.20",
    previous: "%41.50",
  },
  {
    time: "21:00",
    country: "US",
    event: "Fed FOMC Faiz Kararı & Politika Bildirisi",
    impact: "high",
    forecast: "%4.75",
    previous: "%5.00",
  },
  {
    time: "12:00",
    country: "EU",
    event: "Euro Bölgesi Çekirdek TÜFE (Yıllık Öncü)",
    impact: "medium",
    forecast: "%2.70",
    actual: "%2.70",
    previous: "%2.80",
    isCompleted: true,
  },
  {
    time: "14:30",
    country: "TR",
    event: "TCMB Haftalık Net ve Brüt Rezerv Verileri",
    impact: "medium",
    forecast: "$156.5B",
    previous: "$154.2B",
  },
];

export default function MarketIntelligence() {
  const [activeTab, setActiveTab] = useState<MoverTab>("gainers");
  const [gainers, setGainers] = useState<StockMover[]>(INITIAL_GAINERS);
  const [losers, setLosers] = useState<StockMover[]>(INITIAL_LOSERS);
  const [volume, setVolume] = useState<StockMover[]>(INITIAL_VOLUME);
  const [sectors, setSectors] = useState<SectorItem[]>(INITIAL_SECTORS);
  const [tickingSymbol, setTickingSymbol] = useState<string | null>(null);

  // Periyodik mikro simülasyon (canlı hisse & sektör piyasa nabzı)
  useEffect(() => {
    const interval = setInterval(() => {
      // Rastgele 1 hisseyi mikro dalgalandır
      const allSymbols = ["ASELS", "THYAO", "AKBNK", "KCHOL", "TUPRS", "HEKTS", "SASA", "XBANK", "XULAŞ"];
      const randomSymbol = allSymbols[Math.floor(Math.random() * allSymbols.length)];
      setTickingSymbol(randomSymbol);

      setTimeout(() => {
        setTickingSymbol(null);
      }, 1000);

      // Hisse mikro hareketleri
      setGainers((prev) =>
        prev.map((g) => {
          if (g.symbol === randomSymbol) {
            const delta = (Math.random() * 0.1 - 0.04);
            const newPrice = Math.round((g.price + delta) * 100) / 100;
            return { ...g, price: newPrice };
          }
          return g;
        })
      );

      setLosers((prev) =>
        prev.map((l) => {
          if (l.symbol === randomSymbol) {
            const delta = (Math.random() * 0.05 - 0.02);
            const newPrice = Math.round((l.price + delta) * 100) / 100;
            return { ...l, price: newPrice };
          }
          return l;
        })
      );

      setVolume((prev) =>
        prev.map((v) => {
          if (v.symbol === randomSymbol) {
            const delta = (Math.random() * 0.1 - 0.04);
            const newPrice = Math.round((v.price + delta) * 100) / 100;
            return { ...v, price: newPrice };
          }
          return v;
        })
      );

      // Sektörlerde ufak 0.02 - 0.05 mikro dalgalanma
      setSectors((prev) =>
        prev.map((s) => {
          if (Math.random() > 0.6) {
            const delta = (Math.random() * 0.08 - 0.04);
            const newChange = Math.round((s.change + delta) * 100) / 100;
            return { ...s, change: newChange };
          }
          return s;
        })
      );
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  const currentMovers =
    activeTab === "gainers" ? gainers : activeTab === "losers" ? losers : volume;

  // Sektör haritasında maksimum sapma (bar ölçeklendirmesi için)
  const maxAbsChange = 3.2;

  return (
    <>
      {/* ================= 1. SOL KOLON: GÜNÜN HAREKETLİLERİ (/ BIST Hareketler) ================= */}
      <div className="bg-[#0d1322] border border-white/[0.08] rounded-[4px] shadow-sm flex flex-col h-[286px] overflow-hidden">
          {/* Header */}
          <div className="px-2.5 py-1.5 bg-[#111a2e] border-b border-white/[0.08] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center">
              <span className="font-mono text-[11px] font-semibold tracking-wider text-slate-300">
                {"/ BIST Hareketler"}
              </span>
            </div>

            {/* Kompakt Sekmeler - Geniş Aralıklı ve Ayrık Butonlar */}
            <div className="flex items-center gap-1.5 p-0.5 bg-[#090d16] border border-white/[0.1] rounded flex-shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("gainers")}
                className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-medium transition whitespace-nowrap ${
                  activeTab === "gainers"
                    ? "bg-[#16223b] text-emerald-400 font-semibold shadow-sm border border-emerald-500/30"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                Artanlar
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("losers")}
                className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-medium transition whitespace-nowrap ${
                  activeTab === "losers"
                    ? "bg-[#16223b] text-rose-400 font-semibold shadow-sm border border-rose-500/30"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                Düşenler
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("volume")}
                className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-medium transition whitespace-nowrap ${
                  activeTab === "volume"
                    ? "bg-[#16223b] text-cyan-300 font-semibold shadow-sm border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                Hacim
              </button>
            </div>
          </div>

          {/* Tablo Başlıkları */}
          <div className="px-2.5 py-1 bg-[#090d16]/60 border-b border-white/[0.04] grid grid-cols-12 text-[9.5px] font-mono uppercase tracking-wider text-slate-400 flex-shrink-0">
            <span className="col-span-4">Sembol / Şirket</span>
            <span className="col-span-3 text-right">Son (TL)</span>
            <span className="col-span-2 text-right">Hacim</span>
            <span className="col-span-3 text-right">Fark %</span>
          </div>

          {/* Tablo Satırları */}
          <div className="overflow-y-auto flex-1 divide-y divide-white/[0.03]">
            {currentMovers.map((stock) => {
              const isTicking = tickingSymbol === stock.symbol;
              const isPositive = stock.changePercent >= 0;

              return (
                <div
                  key={stock.symbol}
                  className={`px-2.5 py-1.5 grid grid-cols-12 items-center hover:bg-[#111a2e]/70 transition-colors text-xs ${
                    isTicking ? (isPositive ? "bg-emerald-950/20" : "bg-rose-950/20") : ""
                  }`}
                >
                  {/* Sembol ve Adı */}
                  <div className="col-span-4 flex flex-col justify-center min-w-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-mono font-bold tracking-tight text-[11.5px] ${
                          stock.highlight === "amber"
                            ? "text-amber-400"
                            : "text-cyan-400"
                        }`}
                      >
                        {stock.symbol}
                      </span>
                      {isPositive ? (
                        <ArrowUpRight className="w-3 h-3 text-emerald-400 opacity-60 hidden sm:inline-block" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 text-rose-400 opacity-60 hidden sm:inline-block" />
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 truncate leading-tight">
                      {stock.name}
                    </span>
                  </div>

                  {/* Son Fiyat */}
                  <div className="col-span-3 text-right font-mono tabular-nums text-[11.5px] font-medium text-slate-100">
                    {stock.price.toFixed(2)}
                  </div>

                  {/* Hacim */}
                  <div className="col-span-2 text-right font-mono tabular-nums text-[10px] text-slate-400 truncate">
                    {stock.volumeStr.replace(" TL", "")}
                  </div>

                  {/* Değişim % */}
                  <div className="col-span-3 flex justify-end">
                    <span
                      className={`font-mono tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded border leading-tight ${
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

        {/* ================= 2. ORTA KOLON: SEKTÖR PERFORMANSLARI (/ SEKTÖR AKIŞI) ================= */}
        <div className="bg-[#0d1322] border border-white/[0.08] rounded-[4px] shadow-sm flex flex-col h-[286px] overflow-hidden">
          {/* Header */}
          <div className="px-2.5 py-1.5 bg-[#111a2e] border-b border-white/[0.08] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center">
              <span className="font-mono text-[11px] font-semibold tracking-wider text-slate-300">
                {"/ SEKTÖR AKIŞI"}
              </span>
            </div>
          </div>

          {/* Sektör Listesi (Bilateral 0-Centered Progress Bar) */}
          <div className="overflow-y-auto flex-1 p-2 space-y-1.5">
            {sectors.map((sec) => {
              const isPositive = sec.change >= 0;
              // Yüzdeye göre 0-50% bar genişliği hesapla
              const absVal = Math.min(Math.abs(sec.change), maxAbsChange);
              const barPercent = Math.min(Math.round((absVal / maxAbsChange) * 100), 100);

              return (
                <div
                  key={sec.code}
                  className="px-2 py-1 rounded bg-[#090d16]/50 hover:bg-[#111a2e]/60 border border-white/[0.03] transition flex flex-col gap-0.5"
                >
                  {/* Satır Bilgisi */}
                  <div className="flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-cyan-300 text-[11px] tracking-tight">
                        {sec.code}
                      </span>
                      <span className="text-slate-400 text-[10.5px]">
                        {sec.name}
                      </span>
                    </div>

                    <span
                      className={`font-mono tabular-nums text-[10.5px] font-bold ${
                        isPositive ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {sec.change.toFixed(2)}%
                    </span>
                  </div>

                  {/* 0 Noktası Merkezli İki Yönlü Progress Bar */}
                  <div className="relative h-1.5 w-full bg-slate-900 rounded-sm overflow-hidden flex items-center border border-white/[0.04]">
                    {/* 0 Noktası Merkezi Çizgi */}
                    <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-slate-600 z-10" />

                    {/* Negatif Bar: Merkezin Soluna Uzanan */}
                    <div className="w-1/2 h-full flex justify-end">
                      {!isPositive && (
                        <div
                          className="h-full bg-rose-500 rounded-l-sm transition-all duration-500"
                          style={{ width: `${barPercent}%` }}
                        />
                      )}
                    </div>

                    {/* Pozitif Bar: Merkezin Sağına Uzanan */}
                    <div className="w-1/2 h-full flex justify-start">
                      {isPositive && (
                        <div
                          className="h-full bg-emerald-400 rounded-r-sm transition-all duration-500"
                          style={{ width: `${barPercent}%` }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= 3. SAĞ KOLON: EKONOMİK TAKVİM (/ TAKVİM) ================= */}
        <div className="terminal-card-takvim bg-[#0d1322] border border-white/[0.08] rounded-[4px] shadow-sm flex flex-col h-[286px] overflow-hidden">
          {/* Header */}
          <div className="px-2.5 py-1.5 bg-[#111a2e] border-b border-white/[0.08] flex items-center justify-between flex-shrink-0">
            <div className="flex items-center">
              <span className="font-mono text-[11px] font-semibold tracking-wider text-slate-300">
                {"/ TAKVİM"}
              </span>
            </div>
          </div>

          {/* Takvim Satırları */}
          <div className="overflow-y-auto flex-1 divide-y divide-white/[0.03]">
            {MACRO_CALENDAR.map((item, idx) => (
              <div
                key={idx}
                className="px-2.5 py-1.5 hover:bg-[#111a2e]/60 transition-colors flex flex-col gap-1 text-xs"
              >
                {/* Üst Satır: Saat, Bayrak/Ülke, Önem Derecesi, Başlık */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono tabular-nums text-[10.5px] text-slate-400 font-semibold">
                      {item.time}
                    </span>

                    <span className="px-1.5 py-0.2 rounded bg-[#090d16] border border-slate-700/60 font-mono text-[9px] text-slate-300 font-semibold">
                      {item.country}
                    </span>

                    {/* Önem Derecesi (Kırmızı/Sarı Dot) */}
                    {item.impact === "high" ? (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse flex-shrink-0"
                        title="Yüksek Önem"
                      />
                    ) : (
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"
                        title="Orta Önem"
                      />
                    )}

                    <span className="font-medium text-slate-200 text-[11px] truncate leading-tight">
                      {item.event}
                    </span>
                  </div>

                  {item.isCompleted && (
                    <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 flex-shrink-0">
                      AÇIKLANDI
                    </span>
                  )}
                </div>

                {/* Alt Satır: Beklenti vs Açıklanan / Önceki */}
                <div className="flex items-center justify-between text-[10px] font-mono pl-6">
                  <div className="flex items-center gap-2 text-slate-400">
                    <span>
                      Bekl:{" "}
                      <strong className="text-slate-200 font-semibold tabular-nums">
                        {item.forecast}
                      </strong>
                    </span>
                    <span className="text-slate-600">|</span>
                    <span>
                      Önceki:{" "}
                      <span className="text-slate-300 tabular-nums">
                        {item.previous}
                      </span>
                    </span>
                  </div>

                  {item.actual && (
                    <div className="text-[10px]">
                      Açıklanan:{" "}
                      <span className="text-cyan-300 font-bold tabular-nums">
                        {item.actual}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
    </>
  );
}
