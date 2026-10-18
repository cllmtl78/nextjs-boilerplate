"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Haber = {
  _id: string;
  baslik: string;
  slug: string;
  spot?: string;
  kategori?: string;
  gorsel?: string;
};

const kategoriAdlari: Record<string, string> = {
  borsa: "Borsa",
  doviz: "Döviz",
  emtia: "Emtia",
  ekonomi: "Ekonomi",
  kripto: "Kripto",
};

export default function FeaturedSlider({ haberler }: { haberler: Haber[] }) {
  const [aktif, setAktif] = useState(0);
  const [durdur, setDurdur] = useState(false);

  useEffect(() => {
    if (durdur || haberler.length < 2) return;
    const t = setInterval(() => {
      setAktif((a) => (a + 1) % haberler.length);
    }, 5000);
    return () => clearInterval(t);
  }, [durdur, haberler.length]);

  if (haberler.length === 0) return null;

  const git = (n: number) =>
    setAktif((n + haberler.length) % haberler.length);

  return (
    <div
      className="slider"
      onMouseEnter={() => setDurdur(true)}
      onMouseLeave={() => setDurdur(false)}
    >
      {haberler.map((h, i) => (
        <Link
          key={h._id}
          href={`/haber/${h.slug}`}
          className={`slide ${i === aktif ? "slide-aktif" : ""}`}
        >
          {h.gorsel && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${h.gorsel}?w=1000&h=800&fit=crop`}
              alt={h.baslik}
              className="slide-img"
            />
          )}
          <div className="slide-yazi">
            <span className="badge">
              {kategoriAdlari[h.kategori ?? ""] ?? h.kategori}
            </span>
            <h2>{h.baslik}</h2>
            {h.spot && <p>{h.spot}</p>}
          </div>
        </Link>
      ))}

      {haberler.length > 1 && (
        <>
          <button
            className="slider-ok slider-sol"
            onClick={() => git(aktif - 1)}
            aria-label="Önceki"
          >
            ‹
          </button>
          <button
            className="slider-ok slider-sag"
            onClick={() => git(aktif + 1)}
            aria-label="Sonraki"
          >
            ›
          </button>
          <div className="slider-noktalar">
            {haberler.map((h, i) => (
              <button
                key={h._id}
                className={i === aktif ? "nokta nokta-aktif" : "nokta"}
                onClick={() => git(i)}
                aria-label={`Haber ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}