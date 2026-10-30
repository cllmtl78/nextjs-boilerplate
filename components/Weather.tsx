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
};

const SEHIRLER: Sehir[] = [
  { ad: "Ankara", lat: 39.93, lon: 32.86 },
  { ad: "İstanbul", lat: 41.01, lon: 28.98 },
  { ad: "İzmir", lat: 38.42, lon: 27.14 },
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
  const [havaVerileri, setHavaVerileri] = useState<SehirHavaVerisi[] | null>(null);
  const [sira, setSira] = useState(0);

  // Open-Meteo API'den 3 şehir için hava durumu
  useEffect(() => {
    let isMounted = true;

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

        if (isMounted) {
          const parsed = liste.map((j) => ({
            sicaklik:
              j?.current?.temperature_2m !== undefined
                ? Math.round(j.current.temperature_2m)
                : 0,
            kod:
              j?.current?.weather_code !== undefined
                ? j.current.weather_code
                : 0,
          }));
          if (parsed.length > 0) {
            setHavaVerileri(parsed);
          }
        }
      } catch {
        // Hata durumunda bekle
      }
    }

    havaGetir();
    const yenileme = setInterval(havaGetir, 10 * 60 * 1000);
    return () => {
      isMounted = false;
      clearInterval(yenileme);
    };
  }, []);

  // Her 5 saniyede bir sıradaki şehre yumuşak fade geçişi (sadece veri geldiyse)
  useEffect(() => {
    if (!havaVerileri || havaVerileri.length === 0) return;
    const zamanlayici = setInterval(() => {
      setSira((prev) => (prev + 1) % SEHIRLER.length);
    }, 5000);
    return () => clearInterval(zamanlayici);
  }, [havaVerileri]);

  // Veri yüklenene kadar skeleton göster (asla statik Ankara basılmaz)
  if (!havaVerileri || !havaVerileri[sira]) {
    return (
      <div className="flex items-center min-w-[95px]">
        <div className="h-4 w-16 bg-slate-800 animate-pulse rounded" />
      </div>
    );
  }

  const aktifSehir = SEHIRLER[sira];
  const aktifVeri = havaVerileri[sira];

  return (
    <div className="flex items-center gap-1.5 overflow-hidden min-w-[95px]">
      <div
        key={aktifSehir.ad}
        className="flex items-center gap-1.5 weather-slide-item"
      >
        {renderWeatherIcon(aktifVeri.kod)}
        <span className="font-semibold text-slate-300 text-xs">
          {aktifSehir.ad}
        </span>
        <span className="font-mono tabular-nums text-slate-400 text-xs">
          {aktifVeri.sicaklik}°C
        </span>
      </div>
    </div>
  );
}