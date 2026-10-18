"use client";

import { useEffect, useState } from "react";

type SembolVeri = {
  fiyat: number;
  onceki: number;
};

// Yahoo Finance API'den CORS engeline takılmamak için Next.js API route üzerinden ya da alternatif public proxy ile çekilebilir,
// ancak client-side simülasyonu ve canlı akış için periyodik state yapısı kuruyoruz:
export default function MarketBar() {
  const [veriler, setVeriler] = useState<Record<string, { fiyat: number; onceki: number; yon: "yukari" | "asagi" | null }>>({});

  useEffect(() => {
    async function veriCek() {
      // Gerçek projede burayı kendi API endpoint'inize (örn: /api/market) bağlayabilirsiniz.
      // Yahoo CORS engeli nedeniyle istemci tarafında doğrudan fetch edilemeyebilir, bu yüzden 
      // verileri anlık simüle eden veya API'nizden beslenen canlı yapı:
      const semboller = [
        { ad: "USD/TL", fiyat: 34.85 + Math.random() * 0.05 - 0.02, onceki: 34.80 },
        { ad: "EUR/TL", fiyat: 36.40 + Math.random() * 0.06 - 0.03, onceki: 36.35 },
        { ad: "BIST 100", fiyat: 9850.20 + Math.random() * 10 - 5, onceki: 9800.00 },
        { ad: "Gram Altın", fiyat: 3050.40 + Math.random() * 4 - 2, onceki: 3040.00 },
        { ad: "Gram Gümüş", fiyat: 36.20 + Math.random() * 0.2 - 0.1, onceki: 35.90 },
        { ad: "BTC/USD", fiyat: 96400 + Math.random() * 200 - 100, onceki: 95500 },
        { ad: "ETH/USD", fiyat: 2750 + Math.random() * 10 - 5, onceki: 2720 },
        { ad: "Brent Petrol", fiyat: 75.30 + Math.random() * 0.4 - 0.2, onceki: 74.80 },
        { ad: "ABD 10Y", fiyat: 4.42 + Math.random() * 0.02 - 0.01, onceki: 4.40 },
        { ad: "DXY", fiyat: 106.80 + Math.random() * 0.05 - 0.02, onceki: 106.50 },
      ];

      setVeriler((oncekiVeriler) => {
        const yeniVeriler: Record<string, { fiyat: number; onceki: number; yon: "yukari" | "asagi" | null }> = {};
        semboller.forEach((s) => {
          const eskiFiyat = oncekiVeriler[s.ad]?.fiyat;
          let yon: "yukari" | "asagi" | null = null;
          
          if (eskiFiyat !== undefined) {
            if (s.fiyat > eskiFiyat) yon = "yukari";
            else if (s.fiyat < eskiFiyat) yon = "asagi";
            else yon = oncekiVeriler[s.ad].yon; // Değişmediyse son yönü koru
          }

          yeniVeriler[s.ad] = {
            fiyat: s.fiyat,
            onceki: s.onceki,
            yon,
          };
        });
        return yeniVeriler;
      });
    }

    veriCek();
    const interval = setInterval(veriCek, 4000); // Her 4 saniyede bir güncellenir ve yanıp söner
    return () => clearInterval(interval);
  }, []);

  const liste = Object.entries(veriler);
  if (liste.length === 0) return <div className="ticker">Yükleniyor...</div>;

  // Akışın kesintisiz olması için listeyi ikiye katlıyoruz
  const kopya = [...liste, ...liste];

  return (
    <div className="ticker">
      <div className="ticker-track">
        {kopya.map(([ad, veri], i) => {
          const yuzde = ((veri.fiyat - veri.onceki) / veri.onceki) * 100;
          const basamak = ad.includes("BIST") || ad.includes("BTC") ? 0 : ad.includes("Gram") ? 2 : 4;

          return (
            <div
              key={`${ad}-${i}`}
              className={`ticker-item ${veri.yon === "yukari" ? "flash-yesil" : veri.yon === "asagi" ? "flash-kirmizi" : ""}`}
              aria-hidden={i >= liste.length}
            >
              <span className="ticker-ad">{ad}</span>
              <span className="ticker-deger">{veri.fiyat.toLocaleString("tr-TR", { minimumFractionDigits: basamak, maximumFractionDigits: basamak })}</span>
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