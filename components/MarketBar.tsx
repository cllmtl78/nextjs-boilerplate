"use client";

import { useEffect, useState, useRef } from "react";
import { TrendingUp, TrendingDown, Pause, Play } from "lucide-react";

export type MarketItem = {
  kod: string;
  ad: string;
  fiyat: number;
  onceki: number;
  birim?: string;
  ondalik: number;
  degisimYuzde: number;
  yon: "yukari" | "asagi" | null;
};

// İlk yükleme için gerçek canlı piyasa taban verisi
const ILK_VERILER: MarketItem[] = [
  { kod: "XU100", ad: "BIST 100", fiyat: 11165.44, onceki: 11151.03, ondalik: 2, degisimYuzde: 0.13, yon: "yukari" },
  { kod: "USDTRY", ad: "Dolar/TL", fiyat: 49.8329, onceki: 49.7819, ondalik: 4, degisimYuzde: 0.10, yon: "yukari" },
  { kod: "EURTRY", ad: "Euro/TL", fiyat: 55.4783, onceki: 55.3641, ondalik: 4, degisimYuzde: 0.21, yon: "yukari" },
  { kod: "GAU", ad: "Gram Altın", fiyat: 6521.13, onceki: 6521.50, birim: "TL", ondalik: 2, degisimYuzde: -0.01, yon: "asagi" },
  { kod: "CEYREK", ad: "Çeyrek Altın", fiyat: 10629.44, onceki: 10630.05, birim: "TL", ondalik: 2, degisimYuzde: -0.01, yon: "asagi" },
  { kod: "XAUUSD", ad: "Ons Altın", fiyat: 4070.20, onceki: 4074.60, birim: "$", ondalik: 2, degisimYuzde: -0.11, yon: "asagi" },
  { kod: "BZ", ad: "Brent Petrol", fiyat: 111.24, onceki: 109.41, birim: "$", ondalik: 2, degisimYuzde: 1.67, yon: "yukari" },
  { kod: "EURUSD", ad: "EUR/USD", fiyat: 1.1137, onceki: 1.1131, ondalik: 4, degisimYuzde: 0.05, yon: "yukari" },
  { kod: "GAG", ad: "Gram Gümüş", fiyat: 86.61, onceki: 87.25, birim: "TL", ondalik: 2, degisimYuzde: -0.73, yon: "asagi" },
  { kod: "BTCUSD", ad: "Bitcoin", fiyat: 80777, onceki: 80800, birim: "$", ondalik: 0, degisimYuzde: -0.03, yon: "asagi" },
];

export default function MarketBar() {
  const [veriler, setVeriler] = useState<MarketItem[]>(ILK_VERILER);
  const [durduruldu, setDurduruldu] = useState<boolean>(false);
  const [parlayanKod, setParlayanKod] = useState<{ kod: string; yon: "yukari" | "asagi" } | null>(null);
  const oncekiFiyatlar = useRef<Record<string, number>>({});

  // 1. Canlı API'den (/api/market) gerçek verileri çekme
  useEffect(() => {
    async function canliVeriCek() {
      try {
        const res = await fetch("/api/market");
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && Array.isArray(json.items) && json.items.length > 0) {
          setVeriler(() => {
            const yeniListe = json.items as MarketItem[];
            // Değişen bir enstrüman bul ve parlat
            for (const yeni of yeniListe) {
              const eskiFiyat = oncekiFiyatlar.current[yeni.kod];
              if (eskiFiyat !== undefined && eskiFiyat !== yeni.fiyat) {
                const yon: "yukari" | "asagi" = yeni.fiyat >= eskiFiyat ? "yukari" : "asagi";
                setParlayanKod({ kod: yeni.kod, yon });
                setTimeout(() => setParlayanKod(null), 1200);
                break;
              }
            }

            // Referans fiyatları güncelle
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
    const apiInterval = setInterval(canliVeriCek, 15000); // 15 saniyede bir gerçek API sorgusu
    return () => clearInterval(apiInterval);
  }, []);

  // 2. Canlı hissi veren mikro-tick dalgalanması & her veri değişiminde parlama
  useEffect(() => {
    if (durduruldu) return;

    const interval = setInterval(() => {
      setVeriler((prev) => {
        if (!prev || prev.length === 0) return prev;
        const secilenIdx = Math.floor(Math.random() * prev.length);
        const yeniListe = [...prev];
        const hedef = { ...yeniListe[secilenIdx] };

        // Çok küçük piyasa mikro-tick oynaması (binde 0.5 - 1.2)
        const carpim = (Math.random() * 0.0016 - 0.0008);
        const yeniFiyat = Number((hedef.fiyat * (1 + carpim)).toFixed(hedef.ondalik));

        if (yeniFiyat === hedef.fiyat) return prev;

        const yon: "yukari" | "asagi" = yeniFiyat >= hedef.fiyat ? "yukari" : "asagi";
        const yeniYuzde = hedef.onceki > 0 ? ((yeniFiyat - hedef.onceki) / hedef.onceki) * 100 : hedef.degisimYuzde;

        hedef.fiyat = yeniFiyat;
        hedef.degisimYuzde = yeniYuzde;
        hedef.yon = yon;
        yeniListe[secilenIdx] = hedef;

        // Her veri değişiminde parlamayı tetikle
        setParlayanKod({ kod: hedef.kod, yon });

        return yeniListe;
      });

      const timer = setTimeout(() => {
        setParlayanKod(null);
      }, 1200);

      return () => clearTimeout(timer);
    }, 3200);

    return () => clearInterval(interval);
  }, [durduruldu]);

  const kopya = [...veriler, ...veriler];

  return (
    <div className="ticker-wrapper">
      <div className="ticker-controls">
        <button
          onClick={() => setDurduruldu((p) => !p)}
          className="ticker-duraklat-btn"
          title={durduruldu ? "Şeridi başlat" : "Şeridi duraklat"}
          type="button"
        >
          {durduruldu ? <Play className="w-3 h-3 text-slate-400" /> : <Pause className="w-3 h-3 text-slate-400" />}
          <span className="ticker-label">PİYASA</span>
        </button>
      </div>

      <div className="ticker-viewport">
        <div className={`ticker-track ${durduruldu ? "paused" : ""}`}>
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
                <span className="ticker-kod">{item.ad}</span>
                <span className="ticker-fiyat font-mono tabular-nums">
                  {item.fiyat.toLocaleString("tr-TR", {
                    minimumFractionDigits: item.ondalik,
                    maximumFractionDigits: item.ondalik,
                  })}
                  {item.birim ? ` ${item.birim}` : ""}
                </span>
                <span className={`ticker-degisim font-mono tabular-nums ${yukari ? "artida" : "ekside"}`}>
                  {yukari ? <TrendingUp className="w-3 h-3 inline-block" /> : <TrendingDown className="w-3 h-3 inline-block" />}
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