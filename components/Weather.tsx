"use client";

import { useEffect, useState } from "react";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
} from "lucide-react";

type Sehir = {
  ad: string;
  lat: number;
  lon: number;
  varsayilanSicaklik: number;
  varsayilanKod: number;
};

const SEHIRLER: Sehir[] = [
  { ad: "Ankara", lat: 39.93, lon: 32.86, varsayilanSicaklik: 17, varsayilanKod: 1 },
  { ad: "İstanbul", lat: 41.01, lon: 28.98, varsayilanSicaklik: 18, varsayilanKod: 2 },
  { ad: "İzmir", lat: 38.42, lon: 27.14, varsayilanSicaklik: 22, varsayilanKod: 0 },
  { ad: "Bursa", lat: 40.18, lon: 29.06, varsayilanSicaklik: 19, varsayilanKod: 2 },
  { ad: "Antalya", lat: 36.89, lon: 30.71, varsayilanSicaklik: 25, varsayilanKod: 0 },
];

type SehirHavaVerisi = {
  sicaklik: number;
  kod: number;
};

function renderWeatherIcon(kod: number) {
  if (kod === 0) {
    return <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
  }
  if (kod <= 3) {
    return <CloudSun className="w-3.5 h-3.5 text-slate-300 shrink-0" />;
  }
  if (kod === 45 || kod === 48) {
    return <Cloud className="w-3.5 h-3.5 text-slate-400 shrink-0" />;
  }
  if ((kod >= 51 && kod <= 67) || (kod >= 80 && kod <= 82)) {
    return <CloudRain className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
  }
  if (kod >= 71 && kod <= 77) {
    return <CloudSnow className="w-3.5 h-3.5 text-blue-200 shrink-0" />;
  }
  if (kod >= 95) {
    return <CloudLightning className="w-3.5 h-3.5 text-amber-300 shrink-0" />;
  }
  return <Sun className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
}

export default function Weather() {
  const [havaVerileri, setHavaVerileri] = useState<SehirHavaVerisi[]>(() =>
    SEHIRLER.map((s) => ({
      sicaklik: s.varsayilanSicaklik,
      kod: s.varsayilanKod,
    }))
  );
  const [sira, setSira] = useState(0);

  // 1. Open-Meteo API'den 5 şehir için anlık hava durumunu çek
  useEffect(() => {
    async function havaGetir() {
      try {
        const url =
          "https://api.open-meteo.com/v1/forecast?latitude=" +
          SEHIRLER.map((s) => s.lat).join(",") +
          "&longitude=" +
          SEHIRLER.map((s) => s.lon).join(",") +
          "&current=temperature_2m,weather_code";

        const res = await fetch(url);
        if (!res.ok) return;
        const json = await res.json();
        const liste = Array.isArray(json) ? json : [json];

        setHavaVerileri(
          liste.map((j, idx) => ({
            sicaklik:
              j?.current?.temperature_2m !== undefined
                ? Math.round(j.current.temperature_2m)
                : SEHIRLER[idx].varsayilanSicaklik,
            kod:
              j?.current?.weather_code !== undefined
                ? j.current.weather_code
                : SEHIRLER[idx].varsayilanKod,
          }))
        );
      } catch {
        // Hata durumunda varsayılan değerleri koru
      }
    }

    havaGetir();
    const yenileme = setInterval(havaGetir, 10 * 60 * 1000); // 10 dakikada bir güncelle
    return () => clearInterval(yenileme);
  }, []);

  // 2. Her 5 saniyede bir sıradaki şehre geçiş
  useEffect(() => {
    const zamanlayici = setInterval(() => {
      setSira((prev) => (prev + 1) % SEHIRLER.length);
    }, 5000);
    return () => clearInterval(zamanlayici);
  }, []);

  const aktifSehir = SEHIRLER[sira];
  const aktifVeri = havaVerileri[sira] || {
    sicaklik: aktifSehir.varsayilanSicaklik,
    kod: aktifSehir.varsayilanKod,
  };

  return (
    <div className="flex items-center gap-1.5 overflow-hidden min-w-[105px]">
      <div
        key={aktifSehir.ad}
        className="flex items-center gap-1.5 weather-slide-item"
      >
        {renderWeatherIcon(aktifVeri.kod)}
        <span className="font-semibold text-slate-200">
          {aktifSehir.ad}:
        </span>
        <span className="font-mono tabular-nums text-slate-300">
          {aktifVeri.sicaklik}°C
        </span>
      </div>
    </div>
  );
}