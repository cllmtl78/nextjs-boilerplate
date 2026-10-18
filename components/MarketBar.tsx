"use client";

import { useEffect, useState } from "react";

type Veri = {
  fiyat: number;
  onceki: number;
  yon: "yukari" | "asagi" | null;
};

export default function MarketBar() {
  const [veriler, setVeriler] = useState<Record<string, Veri>>({
    "USD/TL": { fiyat: 34.85, onceki: 34.80, yon: null },
    "EUR/TL": { fiyat: 36.40, onceki: 36.35, yon: null },
    "BIST 100": { fiyat: 9850.20, onceki: 9800.00, yon: null },
    "Gram Altın": { fiyat: 3050.40, onceki: 3040.00, yon: null },
    "Gram Gümüş": { fiyat: 36.20, onceki: 35.90, yon: null },
    "BTC/USD": { fiyat: 96400, onceki: 95500, yon: null },
    "ETH/USD": { fiyat: 2750, onceki: 2720, yon: null },
    "Brent Petrol": { fiyat: 75.30, onceki: 74.80, yon: null },
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setVeriler((prev) => {
        const yeni = { ...prev };
        Object.keys(yeni).forEach((key) => {
          const degisimMiktari = (Math.random() * 0.04 - 0.02) * (yeni[key].fiyat * 0.001);
          const yeniFiyat = Number((yeni[key].fiyat + degisimMiktari).toFixed(key.includes("BIST") || key.includes("BTC") ? 0 : 2));
          
          let yon: "yukari" | "asagi" | null = null;
          if (yeniFiyat > yeni[key].fiyat) yon = "yukari";
          else if (yeniFiyat < yeni[key].fiyat) yon = "asagi";

          yeni[key] = { ...yeni[key], fiyat: yeniFiyat, yon };
        });
        return yeni;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const liste = Object.entries(veriler);
  const kopya = [...liste, ...liste];

  return (
    <div className="ticker">
      <div className="ticker-track">
        {kopya.map(([ad, veri], i) => {
          const yuzde = ((veri.fiyat - veri.onceki) / veri.onceki) * 100;
          const basamak = ad.includes("BIST") || ad.includes("BTC") ? 0 : ad.includes("Gram") ? 2 : 2;

          return (
            <div key={`${ad}-${i}`} className="ticker-item" aria-hidden={i >= liste.length}>
              <span className="ticker-ad">{ad}</span>
              <span className={`ticker-deger ${veri.yon === "yukari" ? "flash-yesil" : veri.yon === "asagi" ? "flash-kirmizi" : ""}`}>
                {veri.fiyat.toLocaleString("tr-TR", { minimumFractionDigits: basamak, maximumFractionDigits: basamak })}
              </span>
              <span className={yuzde >= 0 ? "yukari" : "asagi"}>
                {yuzde >= 0 ? "▲" : "▼"} %{Math.abs(yuzde).toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}