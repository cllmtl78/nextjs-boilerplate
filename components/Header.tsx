"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Weather from "./Weather";
import MarketBar from "./MarketBar";

export default function Header() {
  const [saat, setSaat] = useState<string>("");
  const [bistAcik, setBistAcik] = useState<boolean>(true);
  const [lseAcik, setLseAcik] = useState<boolean>(false);
  const [nyseAcik, setNyseAcik] = useState<boolean>(false);

  useEffect(() => {
    function guncelle() {
      const now = new Date();

      // Format: HH:mm:ss
      setSaat(
        now.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );

      // Hafta içi kontrolü (1=Pazartesi, 5=Cuma)
      const gun = now.getDay();
      const haftaIci = gun >= 1 && gun <= 5;
      const toplamDakika = now.getHours() * 60 + now.getMinutes();

      // TR Saati (UTC+3) Borsa Çalışma Saatleri:
      // BIST: 10:00 - 18:00 (600 - 1080 dk)
      setBistAcik(haftaIci && toplamDakika >= 600 && toplamDakika < 1080);

      // LSE (Londra): TR saatiyle 11:00 - 19:30 (660 - 1170 dk)
      setLseAcik(haftaIci && toplamDakika >= 660 && toplamDakika < 1170);

      // NYSE (New York): TR saatiyle 16:30 - 23:00 (990 - 1380 dk)
      setNyseAcik(haftaIci && toplamDakika >= 990 && toplamDakika < 1380);
    }

    guncelle();
    const interval = setInterval(guncelle, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="site-header">
      {/* ÜST BİLGİ & STATUS BARI */}
      <div className="topbar">
        <div className="topbar-inner">
          {/* Sol: Borsa Çalışma Saatleri (Kompakt ve Minik Göstergeli) */}
          <div className="flex items-center gap-2.5 text-[11px] font-mono text-slate-400 overflow-x-auto whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  bistAcik ? "bg-emerald-400" : "bg-rose-500"
                }`}
                title={bistAcik ? "BIST Seansı Açık" : "BIST Seansı Kapalı"}
              />
              <span className="font-semibold text-slate-300">BIST</span>
              <span>10:00-18:00</span>
            </div>

            <span className="text-slate-700">·</span>

            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  lseAcik ? "bg-emerald-400" : "bg-rose-500"
                }`}
                title={lseAcik ? "LSE Seansı Açık" : "LSE Seansı Kapalı"}
              />
              <span className="font-semibold text-slate-300">LSE</span>
              <span>11:00-19:30</span>
            </div>

            <span className="text-slate-700">·</span>

            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  nyseAcik ? "bg-emerald-400" : "bg-rose-500"
                }`}
                title={nyseAcik ? "NYSE Seansı Açık" : "NYSE Seansı Kapalı"}
              />
              <span className="font-semibold text-slate-300">NYSE</span>
              <span>16:30-23:00</span>
            </div>
          </div>

          {/* Sağ: Status Pill (Canlı Saat + Yeşil Işık + Ayrıcı + Dönen Hava Durumu) */}
          <div className="bg-[#0c1322] border border-slate-800 rounded-md px-3 py-1 flex items-center gap-3 text-xs text-slate-300 shadow-sm shrink-0">
            {/* Canlı Saat ve Yeşil Gösterge Işığı */}
            <div className="flex items-center gap-1.5 font-mono tabular-nums text-slate-200">
              <span
                className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"
                title="Canlı Veri Akışı Aktif"
              />
              <span className="font-semibold tracking-wider">
                {saat || "12:00:00"}
              </span>
            </div>

            {/* Dikey İnce Ayırıcı Çizgi */}
            <div className="border-r border-slate-700 h-3.5" />

            {/* Dönen Hava Durumu Sistemi */}
            <Weather />
          </div>
        </div>
      </div>

      {/* ANA MARKA ÇUBUĞU */}
      <div className="mainbar">
        <div className="mainbar-inner">
          <div className="brand-group">
            <Link href="/" className="brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="BPT Finans"
                className="brand-logo"
              />
            </Link>
            <div className="terminal-badge-wrap">
              <span className="terminal-tag">TERMINAL</span>
            </div>
          </div>
        </div>
      </div>

      {/* PİYASA ŞERİDİ */}
      <MarketBar />
    </header>
  );
}