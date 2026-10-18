"use client";

import { useEffect, useState } from "react";

const sehirler = [
  { ad: "Ankara", lat: 39.93, lon: 32.86 },
  { ad: "İstanbul", lat: 41.01, lon: 28.98 },
  { ad: "İzmir", lat: 38.42, lon: 27.14 },
];

type Veri = { sicaklik: number; kod: number };

function durum(kod: number) {
  if (kod === 0) return "Açık";
  if (kod <= 3) return "Parçalı bulutlu";
  if (kod === 45 || kod === 48) return "Sisli";
  if (kod >= 51 && kod <= 67) return "Yağmurlu";
  if (kod >= 71 && kod <= 77) return "Karlı";
  if (kod >= 80 && kod <= 82) return "Sağanak";
  if (kod >= 95) return "Fırtına";
  return "";
}

export default function Weather() {
  const [veriler, setVeriler] = useState<Veri[]>([]);
  const [sira, setSira] = useState(0);

  useEffect(() => {
    async function getir() {
      try {
        const url =
          "https://api.open-meteo.com/v1/forecast?latitude=" +
          sehirler.map((s) => s.lat).join(",") +
          "&longitude=" +
          sehirler.map((s) => s.lon).join(",") +
          "&current=temperature_2m,weather_code";
        const cevap = await fetch(url);
        const json = await cevap.json();
        const liste = Array.isArray(json) ? json : [json];
        setVeriler(
          liste.map((j) => ({
            sicaklik: Math.round(j.current.temperature_2m),
            kod: j.current.weather_code,
          }))
        );
      } catch {
        setVeriler([]);
      }
    }
    getir();
    const yenile = setInterval(getir, 15 * 60 * 1000);
    return () => clearInterval(yenile);
  }, []);

  useEffect(() => {
    const zamanlayici = setInterval(() => {
      setSira((s) => (s + 1) % sehirler.length);
    }, 10000);
    return () => clearInterval(zamanlayici);
  }, []);

  const sehir = sehirler[sira];
  const v = veriler[sira];

  return (
    <span className="weather-box">
      <span key={sira} className="weather-item">
        {sehir.ad}
        {v ? `: ${v.sicaklik}°C ${durum(v.kod)}` : ""}
      </span>
    </span>
  );
}