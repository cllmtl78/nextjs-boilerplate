import Link from "next/link";
import { notFound } from "next/navigation";
import { PortableText } from "next-sanity";
import { client } from "../../../lib/sanity";

type Haber = {
  baslik: string;
  spot?: string;
  kategori?: string;
  kaynak?: string;
  yayinTarihi?: string;
  icerik?: any[];
};

const kategoriAdlari: Record<string, string> = {
  borsa: "Borsa",
  doviz: "Döviz",
  emtia: "Emtia",
  ekonomi: "Ekonomi",
  kripto: "Kripto",
};

const sorgu = `*[_type == "haber" && slug.current == $slug][0]{
  baslik,
  spot,
  kategori,
  kaynak,
  yayinTarihi,
  icerik
}`;

export const revalidate = 60;

export default async function HaberSayfasi({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const haber = await client.fetch<Haber | null>(sorgu, { slug });

  if (!haber) notFound();

  const tarih = haber.yayinTarihi
    ? new Date(haber.yayinTarihi).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
       <article className="article">
      <Link href="/" className="meta">
        ← Ana sayfaya dön
      </Link>

      <div style={{ marginTop: 16 }}>
        <span className="badge">
          {kategoriAdlari[haber.kategori ?? ""] ?? haber.kategori}
        </span>
      </div>

      <h1>{haber.baslik}</h1>

         {haber.spot && <p className="spot">{haber.spot}</p>}

         <div className="body">
        {haber.icerik && <PortableText value={haber.icerik} />}
      </div>

      <div className="meta">
        {haber.kaynak ? `Kaynak: ${haber.kaynak} · ` : ""}
        {tarih}
      </div>
    </article>
  );
}