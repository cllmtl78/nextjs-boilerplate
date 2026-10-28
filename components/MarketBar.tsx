"use client";

import { useEffect, useState, useRef } from "react";

export type MarketItem = {
  kod: string;
  ad: string;
  fiyat: number;
  onceki: number;
  ondalik: number;
  degisimYuzde: number;
  yon: "yukari" | "asagi" | null;
};

const ILK_VERILER: MarketItem[] = [
  { kod: "XU100", ad: "XU100", fiyat: 11165.44, onceki: 11151.03, ondalik: 2, degisimYuzde: 0.13, yon: "yukari" },
  { kod: "USDTRY", ad: "USDTRY", fiyat: 49.8329, onceki: 49.7819, ondalik: 4, degisimYuzde: 0.10, yon: "yukari" },
  { kod: "EURTRY", ad: "EURTRY", fiyat: 55.4783, onceki: 55.3641, ondalik: 4, degisimYuzde: 0.21, yon: "yukari" },
  { kod: "XAU/TRY", ad: "XAU/TRY", fiyat: 6521.13, onceki: 6521.50, ondalik: 2, degisimYuzde: -0.01, yon: "asagi" },
  { kod: "CEYREK", ad: "CEYREK", fiyat: 10629.44, onceki: 10630.05, ondalik: 2, degisimYuzde: -0.01, yon: "asagi" },
  { kod: "XAUUSD", ad: "XAUUSD", fiyat: 4070.20, onceki: 4074.60, ondalik: 2, degisimYuzde: -0.11, yon: "asagi" },
  { kod: "BRENT", ad: "BRENT", fiyat: 111.24, onceki: 109.41, ondalik: 2, degisimYuzde: 1.67, yon: "yukari" },
  { kod: "EURUSD", ad: "EURUSD", fiyat: 1.1137, onceki: 1.1131, ondalik: 4, degisimYuzde: 0.05, yon: "yukari" },
  { kod: "XAG/TRY", ad: "XAG/TRY", fiyat: 86.61, onceki: 87.25, ondalik: 2, degisimYuzde: -0.73, yon: "asagi" },
  { kod: "BTCUSD", ad: "BTCUSD", fiyat: 80777, onceki: 80800, ondalik: 0, degisimYuzde: -0.03, yon: "asagi" },
];

export default function MarketBar() {
  const [veriler, setVeriler] = useState<MarketItem[]>(ILK_VERILER);
  const [parlayanKod, setParlayanKod] = useState<{ kod: string; yon: "yukari" | "asagi" } | null>(null);
  const oncekiFiyatlar = useRef<Record<string, number>>({});

  // 1. Canlı API'den (/api/market) düzenli veri çekimi
  useEffect(() => {
    async function canliVeriCek() {
      try {
        const res = await fetch("/api/market");
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && Array.isArray(json.items) && json.items.length > 0) {
          setVeriler(() => {
            const yeniListe = json.items as MarketItem[];
            for (const yeni of yeniListe) {
              const eskiFiyat = oncekiFiyatlar.current[yeni.kod];
              if (eskiFiyat !== undefined && eskiFiyat !== yeni.fiyat) {
                const yon: "yukari" | "asagi" = yeni.fiyat >= eskiFiyat ? "yukari" : "asagi";
                setParlayanKod({ kod: yeni.kod, yon });
                setTimeout(() => setParlayanKod(null), 1200);
                break;
              }
            }

            yeniListe.forEach((item) => {
              oncekiFiyatlar.current[item.kod] = item.fiyat;
            });

            return yeniListe;
          });
        }
      } catch {
        // Hata durumunda mevcut listeyi koru
      }
    }

    canliVeriCek();
    const apiInterval = setInterval(canliVeriCek, 15000);
    return () => clearInterval(apiInterval);
  }, []);

  // 2. Canlı borsa hissi veren mikro-tick dalgalanması
  useEffect(() => {
    const interval = setInterval(() => {
      setVeriler((prev) => {
        if (!prev || prev.length === 0) return prev;
        const secilenIdx = Math.floor(Math.random() * prev.length);
        const yeniListe = [...prev];
        const hedef = { ...yeniListe[secilenIdx] };

        const carpim = (Math.random() * 0.0016 - 0.0008);
        const yeniFiyat = Number((hedef.fiyat * (1 + carpim)).toFixed(hedef.ondalik));

        if (yeniFiyat === hedef.fiyat) return prev;

        const yon: "yukari" | "asagi" = yeniFiyat >= hedef.fiyat ? "yukari" : "asagi";
        const yeniYuzde = hedef.onceki > 0 ? ((yeniFiyat - hedef.onceki) / hedef.onceki) * 100 : hedef.degisimYuzde;

        hedef.fiyat = yeniFiyat;
        hedef.degisimYuzde = yeniYuzde;
        hedef.yon = yon;
        yeniListe[secilenIdx] = hedef;

        setParlayanKod({ kod: hedef.kod, yon });
        return yeniListe;
      });

      const timer = setTimeout(() => {
        setParlayanKod(null);
      }, 1200);

      return () => clearTimeout(timer);
    }, 3200);

    return () => clearInterval(interval);
  }, []);

  const kopya = [...veriler, ...veriler];

  return (
    <div className="ticker-wrapper">
      <div className="ticker-viewport">
        <div className="ticker-track">
          {kopya.map((item, idx) => {
            const yukari = item.degisimYuzde >= 0;
            const parlamada = parlayanKod?.kod === item.kod;
            const parlamaYonu = parlamada ? parlayanKod.yon : null;

            return (
              <div
                key={`${item.kod}-${idx}`}
                className={`ticker-item ${
                  parlamaYonu === "yukari"
                    ? "flash-tick-up"
                    : parlamaYonu === "asagi"
                    ? "flash-tick-down"
                    : ""
                }`}
                aria-hidden={idx >= veriler.length}
              >
                {/* [SEMBOL] */}
                <span className="ticker-kod font-mono">{item.ad}</span>

                {/* [FİYAT] */}
                <span className="ticker-fiyat font-mono tabular-nums">
                  {item.fiyat.toLocaleString("tr-TR", {
                    minimumFractionDigits: item.ondalik,
                    maximumFractionDigits: item.ondalik,
                  })}
                </span>

                {/* [YÜZDE] - Hafif renkli pill */}
                <span
                  className={`ticker-pill font-mono tabular-nums ${
                    yukari ? "ticker-pill-up" : "ticker-pill-down"
                  }`}
                >
                  {yukari ? "+" : ""}{item.degisimYuzde.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}