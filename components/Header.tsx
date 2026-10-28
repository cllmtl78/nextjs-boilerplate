"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Weather from "./Weather";
import MarketBar from "./MarketBar";

export default function Header() {
  const [saat, setSaat] = useState<string>("");
  const [bistDurum, setBistDurum] = useState<{ acik: boolean; metin: string }>({
    acik: true,
    metin: "Açık",
  });
  const [lseAcik, setLseAcik] = useState<boolean>(false);
  const [nyseAcik, setNyseAcik] = useState<boolean>(false);

  useEffect(() => {
    function guncelle() {
      const now = new Date();

      // Format: HH:mm:ss (Canlı saat)
      setSaat(
        now.toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );

      const gun = now.getDay();
      const haftaIci = gun >= 1 && gun <= 5;
      const saatDakika = now.getHours() * 60 + now.getMinutes();

      // BIST İşlem Saatleri: Hafta içi 10:00 - 18:00
      if (haftaIci && saatDakika >= 600 && saatDakika < 1080) {
        // Kapanışa kalan süre hesabı (18:00)
        const kapanis = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0);
        const kalanMs = Math.max(0, kapanis.getTime() - now.getTime());
        const kalanSaat = Math.floor(kalanMs / 3600000);
        const kalanDakika = Math.floor((kalanMs % 3600000) / 60000);
        const kalanSaniye = Math.floor((kalanMs % 60000) / 1000);
        const kalanMetin = `${String(kalanSaat).padStart(2, "0")}:${String(kalanDakika).padStart(2, "0")}:${String(kalanSaniye).padStart(2, "0")}`;

        setBistDurum({
          acik: true,
          metin: `Açık · ${kalanMetin}`,
        });
      } else {
        setBistDurum({
          acik: false,
          metin: "Kapalı (10:00)",
        });
      }

      // LSE (Londra): TR Saatiyle 11:00 - 19:30
      setLseAcik(haftaIci && saatDakika >= 660 && saatDakika < 1170);

      // NYSE (New York): TR Saatiyle 16:30 - 23:00
      setNyseAcik(haftaIci && saatDakika >= 990 && saatDakika < 1380);
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
          {/* Sol: Borsa Saatleri & Dinamik Statü */}
          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 overflow-x-auto whitespace-nowrap">
            {/* BIST */}
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[8px] leading-none ${
                  bistDurum.acik ? "text-emerald-400" : "text-rose-500"
                }`}
              >
                ●
              </span>
              <span className="font-semibold text-slate-300">BIST</span>
              <span className="tabular-nums text-slate-400">{bistDurum.metin}</span>
            </div>

            <span className="text-white/[0.08]">/</span>

            {/* LSE */}
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[8px] leading-none ${
                  lseAcik ? "text-emerald-400" : "text-slate-600"
                }`}
              >
                ●
              </span>
              <span className="font-semibold text-slate-300">LSE</span>
              <span className="text-slate-400">{lseAcik ? "Açık" : "Kapalı (11:00)"}</span>
            </div>

            <span className="text-white/[0.08]">/</span>

            {/* NYSE */}
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[8px] leading-none ${
                  nyseAcik ? "text-emerald-400" : "text-slate-600"
                }`}
              >
                ●
              </span>
              <span className="font-semibold text-slate-300">NYSE</span>
              <span className="text-slate-400">{nyseAcik ? "Açık" : "Kapalı (16:30)"}</span>
            </div>
          </div>

          {/* Sağ: Status Pill (Canlı Saat + Dönen Hava Durumu) */}
          <div className="bg-[#0c1322] border border-white/[0.08] rounded px-2.5 py-1 flex items-center gap-3 text-xs text-slate-300 shadow-sm shrink-0">
            {/* Canlı Saat (Solundaki yeşil nokta kaldırıldı) */}
            <div className="font-mono tabular-nums text-slate-200 font-semibold tracking-wider text-xs">
              {saat || "12:00:00"}
            </div>

            {/* Dikey İnce Ayırıcı Çizgi */}
            <div className="border-r border-slate-700/60 h-3" />

            {/* Dönen Hava Durumu Sistemi (Ankara, İst, İzmir) */}
            <Weather />
          </div>
        </div>
      </div>

      {/* MARKA ÇUBUĞU */}
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