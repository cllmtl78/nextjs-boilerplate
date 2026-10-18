import Link from "next/link";
import { client } from "../lib/sanity";
import FeedBox from "../components/FeedBox";

type Haber = {
  _id: string;
  baslik: string;
  slug: string;
  spot?: string;
  kategori?: string;
  yayinTarihi?: string;
};

const kategoriAdlari: Record<string, string> = {
  borsa: "Borsa",
  doviz: "Döviz",
  emtia: "Emtia",
  ekonomi: "Ekonomi",
  kripto: "Kripto",
};

const sorgu = `*[_type == "haber" && defined(slug.current)] | order(yayinTarihi desc)[0...20]{
  _id,
  baslik,
  "slug": slug.current,
  spot,
  kategori,
  yayinTarihi
}`;

// Geçici içerik. API bağlanınca gerçek veriyle değişecek.
const kap = [
  { kaynak: "KAP", baslik: "Özel durum açıklaması yayımlandı" },
  { kaynak: "KAP", baslik: "Finansal rapor bildirimi yapıldı" },
  { kaynak: "KAP", baslik: "Genel kurul toplantı çağrısı duyuruldu" },
  { kaynak: "KAP", baslik: "Pay geri alım işlemi hakkında bildirim" },
  { kaynak: "KAP", baslik: "Sözleşme imzalanmasına ilişkin açıklama" },
  { kaynak: "KAP", baslik: "Sermaye artırımı bildirimi paylaşıldı" },
];

const resmi = [
  { kaynak: "@TCMB", baslik: "Para Politikası Kurulu toplantı özeti resmi sitede yayımlandı." },
  { kaynak: "@HMBakanligi", baslik: "Orta Vadeli Program kapsamında mali disiplin kararlılıkla sürüyor." },
  { kaynak: "@SPK_Kurumsal", baslik: "Halka arz başvurularına ilişkin haftalık bülten kamuoyuna duyuruldu." },
  { kaynak: "@BDDKResmi", baslik: "Bankacılık sektörü günlük ve haftalık temel göstergeleri güncellendi." },
  { kaynak: "@TUIKBilgi", baslik: "Tüketici fiyat endeksi ve enflasyon verileri saat 10.00'da açıklanacak." },
];

const terminal = [
  { kaynak: "KAYNAK A", baslik: "Küresel piyasalarda haftanın gündemi belirlendi" },
  { kaynak: "KAYNAK B", baslik: "Merkez bankası toplantısına ilişkin özet geldi" },
  { kaynak: "KAYNAK A", baslik: "Petrol fiyatlarında yeni hareket gözlendi" },
  { kaynak: "KAYNAK C", baslik: "Teknoloji hisselerinde işlem hacmi arttı" },
  { kaynak: "KAYNAK B", baslik: "Altın için yeni fiyat beklentileri paylaşıldı" },
  { kaynak: "KAYNAK C", baslik: "Kripto piyasasında günlük özet yayımlandı" },
];

const global = [
  { kaynak: "KAYNAK X", baslik: "Avrupa borsaları karışık seyirle açıldı" },
  { kaynak: "KAYNAK Y", baslik: "ABD'de enflasyon verisi bekleniyor" },
  { kaynak: "KAYNAK X", baslik: "Asya piyasalarında yön aşağı" },
  { kaynak: "KAYNAK Z", baslik: "Küresel tahvil faizlerinde hareketlilik sürüyor" },
  { kaynak: "KAYNAK Y", baslik: "Dolar endeksi dar bantta işlem görüyor" },
  { kaynak: "KAYNAK Z", baslik: "Emtia fiyatlarında haftalık değişim netleşti" },
];

function tarihYaz(tarih?: string) {
  if (!tarih) return "";
  return new Date(tarih).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export const revalidate = 60;

export default async function Home() {
  const haberler = await client.fetch<Haber[]>(sorgu);

  return (
    <>
      <div className="top-grid">
        <FeedBox baslik="Terminal" satirlar={terminal} />
        <FeedBox baslik="Global" satirlar={global} />
        <div className="right-stack">
          <FeedBox baslik="KAP" satirlar={kap} />
          <FeedBox baslik="Resmi" satirlar={resmi} tur="tweet" />
        </div>
      </div>

      <h2 className="section-title">Son Haberler</h2>

      {haberler.length === 0 ? (
        <p>Henüz yayınlanmış haber yok.</p>
      ) : (
        <div className="grid">
          {haberler.map((h) => (
            <Link href={`/haber/${h.slug}`} key={h._id} className="card">
              <span className="badge">
                {kategoriAdlari[h.kategori ?? ""] ?? h.kategori}
              </span>
              <h3>{h.baslik}</h3>
              <p>{h.spot}</p>
              <div className="meta">{tarihYaz(h.yayinTarihi)}</div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}