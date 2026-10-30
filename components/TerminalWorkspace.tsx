"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import MarketIntelligence from "@/components/MarketIntelligence";

export type TerminalHaber = {
  id: string;
  zaman: string;
  time?: string;
  tarih: string;
  kaynak: string;
  baslik: string;
  ozet?: string;
  paragraflar?: string[];
  detay?: string;
  url?: string;
  kategori: "bist" | "global" | "kap" | "resmi";
  hisseler?: string[];
  kapTuru?: "ÖDA" | "PGO" | "FR" | "GKK" | "SÖZ";
  resmiKurum?: "TCMB" | "SPK" | "BDDK" | "HMB" | "TÜİK" | "RESMİ GAZETE";
  timestamp?: number;
  dateObj?: Date | null;
};

const CACHE_KEY_BIST = "bpt_bist_news";

interface ApiNewsItemResponse {
  id: string;
  zaman: string;
  time?: string;
  tarih?: string;
  kaynak: string;
  baslik: string;
  ozet?: string;
  paragraflar?: string[];
  detay?: string;
  url?: string;
  timestamp?: number;
  dateObj?: string | null;
}


export interface GlobalNewsItem {
  id: string;
  zaman: string;
  timestamp: number;
  baslik: string;
  rawText?: string;
  rawClean?: string;
}

const CACHE_KEY_GLOBAL = "bpt_global_news";
const CACHE_KEY_TRANSLATIONS = "global_translations_cache_v1";

// Ticker ve gereksiz karakterleri temizleyen yardımcı fonksiyon
export function cleanWireText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\$[A-Z]{1,6}\b/gi, "") // $MSFT, $GOOGL, $NVDA vb. borsa ticker etiketlerini sil
    .replace(/^[\*\/\s]+/, "")        // Baştaki * veya / işaretleri
    .replace(/\s+\*\s*/g, " · ")      // Ara yıldız işaretlerini temizle
    .replace(/\s{2,}/g, " ")          // Çoklu boşlukları teke indir
    .trim();
}

// Gerçek Yayın Zaman Damgası ve Türkiye Saati (Europe/Istanbul) Çeviricisi
export const parseNewsDate = (
  pubDateStr: string | number | Date | null | undefined
): { time: string; timestamp: number; dateObj: Date } => {
  if (!pubDateStr) {
    const now = new Date();
    const time = now.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Europe/Istanbul",
    });
    return { time, timestamp: now.getTime(), dateObj: now };
  }
  try {
    const raw = typeof pubDateStr === "string" ? pubDateStr.trim() : pubDateStr;
    const d = new Date(raw);

    // Eğer tarih parse edilemediyse veya geçersizse Date.now() ver
    if (isNaN(d.getTime())) {
      const now = new Date();
      const time = now.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Europe/Istanbul",
      });
      return { time, timestamp: now.getTime(), dateObj: now };
    }

    const formattedTime = d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Europe/Istanbul",
    });

    return {
      time: formattedTime,
      timestamp: d.getTime(),
      dateObj: d,
    };
  } catch {
    const now = new Date();
    const time = now.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Europe/Istanbul",
    });
    return { time, timestamp: now.getTime(), dateObj: now };
  }
};

export const normalizeNewsDate = (
  pubDateStr: string | number | Date | null | undefined
): { timestamp: number; zaman: string; time: string; dateObj: Date | null } => {
  const res = parseNewsDate(pubDateStr);
  return { timestamp: res.timestamp, zaman: res.time, time: res.time, dateObj: res.dateObj };
};

export const parseNewsTime = (dateInput: string | number | Date | null | undefined): string => {
  return parseNewsDate(dateInput).time;
};

export const formatTimeTR = parseNewsTime;

// 2. GÜNLÜK AKIŞI SIFIRLAMA (23:59 Sonrası Yeni Gün Temizliği):
export const isToday = (dateObj: Date | number | string | null | undefined): boolean => {
  if (!dateObj) return false;
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};

export function formatNaturalCase(text: string): string {
  if (!text) return "";
  // Baştaki tüm /, *, tire ve boşluk artıklarını temizle
  let clean = text.replace(/^[\s\*\/\-]+/, "").trim();
  // Cümle başı standart büyük harfle başlasın, metnin geri kalanı asla toLowerCase ile bozulmasın
  if (clean.length > 0) {
    clean = clean.charAt(0).toUpperCase() + clean.slice(1);
  }
  return clean;
}

export function cleanEnglishWire(text: string): string {
  const cleaned = cleanWireText(text);
  return cleaned ? formatNaturalCase(cleaned) : "Wire";
}



// Profesyonel Terminal Skeleton Loader (Haberler çekilirken gösterilen zarif animasyon)
function TerminalSkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="p-3 flex flex-col space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="pb-3 border-b border-white/[0.04] last:border-0 flex items-start gap-3 px-1"
        >
          <div className="w-12 h-3 bg-slate-800/80 rounded animate-pulse shrink-0 mt-0.5" />
          <div className="flex-1 flex flex-col gap-1.5">
            <div
              className={`h-3 bg-slate-800/60 rounded animate-pulse ${
                i % 3 === 0 ? "w-4/5" : i % 2 === 0 ? "w-3/4" : "w-11/12"
              }`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Statik KAP Bildirimleri (Belirgin Cyan Hisse Kodu + İnce Bildirim Türü)
const KAP_BILDIRIMLERI: TerminalHaber[] = [
  {
    id: "k1",
    zaman: "16:27:04",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    hisseler: ["KCHOL"],
    kapTuru: "PGO",
    baslik: "Koç Holding A.Ş. — Pay Geri Alım İşlemlerine İlişkin Bildirim",
    detay: "Şirketin sahip olduğu KCHOL payları sermayenin %0.84'üne ulaşmıştır. Program çerçevesinde fon kaynağı şirket iç kaynaklarından karşılanmaktadır.",
    paragraflar: [
      "Koç Holding A.Ş. Yönetim Kurulu kararıyla başlatılan hisse geri alım programı çerçevesinde, Borsa İstanbul pay piyasasında 184.50 TL ortalama fiyattan 250.000 adet pay geri alınmıştır.",
      "İşlem sonucunda şirketin sahip olduğu kendi paylarının nominal tutarı 21.3 milyon TL'ye ve şirket sermayesine oranı %0.84 seviyesine ulaşmıştır."
    ],
    url: "https://www.kap.org.tr",
  },
  {
    id: "k2",
    zaman: "16:11:18",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    hisseler: ["SISE"],
    kapTuru: "ÖDA",
    baslik: "Türkiye Şişe ve Cam Fabrikaları A.Ş. — Kapasite Artışı ve Modernizasyon Kararı",
    detay: "Yatırımın 2027 ilk çeyreğinde tamamlanmasıyla enerji tüketiminde verimlilik ve katma değerli kaplamalı cam üretiminde kapasite artışı hedeflenmektedir.",
    paragraflar: [
      "Şirketimiz Yönetim Kurulu, Mersin ve Yenişehir üretim tesislerindeki düzcam hatlarının fırın soğuk tamiri ve yeni teknoloji kaplama hattı entegrasyonu için 115 milyon euro bütçeli yatırım planını onaylamıştır.",
      "Yatırımın 2027 ilk çeyreğinde devreye girmesiyle birlikte birim enerji tüketiminde %14 verimlilik ve yüksek katma değerli mimari cam üretim kapasitesinde yıllık 180 bin ton artış öngörülmektedir."
    ],
    url: "https://www.kap.org.tr",
  },
  {
    id: "k3",
    zaman: "15:50:30",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    hisseler: ["SASA"],
    kapTuru: "FR",
    baslik: "SASA Polyester Sanayi A.Ş. — Dönemsel Faaliyet ve Yatırım Raporu",
    detay: "Tesisin ticari üretim takvimi ve ham madde tedarik sözleşmelerinin finansal tablolara yansıması paylaşıldı.",
    paragraflar: [
      "Adana Yumurtalık Özel Endüstri Bölgesi'nde sürdürülen PTA ve polimerizasyon tesisi inşaatında mekanik tamamlama oranı %94 seviyesine ulaşmıştır.",
      "Deneme üretimlerinin planlandığı şekilde devam ettiği ve tesisin tam kapasite devreye alınmasıyla yıllık yaklaşık 1.2 milyar dolarlık ithal ikamesi sağlanacağı kamuoyuyla paylaşılmıştır."
    ],
    url: "https://www.kap.org.tr",
  },
  {
    id: "k4",
    zaman: "15:36:12",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    hisseler: ["FROTO"],
    kapTuru: "SÖZ",
    baslik: "Ford Otomotiv Sanayi A.Ş. — Yeni Model Batarya Montaj Tedarik Sözleşmesi",
    detay: "Sözleşmenin şirketin ihracat hacmine yıllık yaklaşık 320 milyon euro katkı sağlaması öngörülmektedir.",
    paragraflar: [
      "Ford Otosan, Avrupa pazarına yönelik tam elektrikli ticari araç serisi için batarya paketleme ve modül montajına ilişkin çok yıllı tedarik anlaşmasını imzalamıştır.",
      "Kocaeli fabrikalarında üretilecek yeni nesil batarya paketlerinin yıllık ciroya yaklaşık 320 milyon euro ilave ihracat geliri oluşturması beklenmektedir."
    ],
    url: "https://www.kap.org.tr",
  },
  {
    id: "k5",
    zaman: "15:14:09",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    hisseler: ["TUPRS"],
    kapTuru: "ÖDA",
    baslik: "Tüpraş — Rafineri Bakım Planı Güncellemesi Bildirildi",
    detay: "Planlı duruş süresince nihai ürün satışları mevcut stoklardan karşılanacak olup satış hacminde kesinti öngörülmemektedir.",
    paragraflar: [
      "İzmit Rafinerisi Ham Petrol Ünitesi'nde planlı periyodik bakım çalışmalarının 3 hafta süreyle yürütüleceği, bakım süresince ürün satışlarının mevcut stok depolarından kesintisiz karşılanacağı bildirilmiştir.",
      "Şirketin yıllık toplam üretim ve satış hedeflerinde herhangi bir revizyona ihtiyaç duyulmadığı belirtilmiştir."
    ],
    url: "https://www.kap.org.tr",
  },
];

// Statik Resmi Kurumlar
const RESMI_HABERLER: TerminalHaber[] = [
  {
    id: "r1",
    zaman: "16:22:00",
    tarih: "Bugün",
    kaynak: "TCMB",
    kategori: "resmi",
    resmiKurum: "TCMB",
    baslik: "TCMB: Para Politikası Kurulu Toplantı Özeti yayımlandı",
    detay: "Kurul, yurt içi talepteki dengelenmenin sürdüğünü ve TL likidite sterilizasyon araçlarının etkin kullanılacağını ifade etti.",
    paragraflar: [
      "Türkiye Cumhuriyet Merkez Bankası Para Politikası Kurulu Toplantı Özeti'nde, aylık enflasyonun ana eğiliminde belirgin ve kalıcı bir düşüş sağlanana kadar sıkı para politikası duruşunun sürdürüleceği teyit edildi.",
      "Likidite fazlasının sterilizasyonunda zorunlu karşılıklar ve depo ihaleleri gibi araçların çeşitlendirilerek kararlılıkla kullanılacağı bildirildi."
    ],
    url: "https://www.tcmb.gov.tr",
  },
  {
    id: "r2",
    zaman: "16:01:15",
    tarih: "Bugün",
    kaynak: "SPK",
    kategori: "resmi",
    resmiKurum: "SPK",
    baslik: "SPK Haftalık Bülteni: 2 şirketin sermaye piyasası ihracına onay verildi",
    detay: "Halka arz gelirlerinin büyük kısmının işletme sermayesi ve kapasite artırım yatırımlarında kullanılacağı bildirildi.",
    paragraflar: [
      "Sermaye Piyasası Kurulu haftalık bülteninde iki sanayi kuruluşunun pay ihracı ve bedelsiz sermaye artırımı başvurularının onaylandığı duyuruldu.",
      "Ayrıca borçlanma aracı ihraç limitlerine ilişkin değerlendirmeler neticesinde kurumsal tahvil ve finansman bonosu ihraç izinleri onaylandı."
    ],
    url: "https://spk.gov.tr",
  },
  {
    id: "r3",
    zaman: "15:40:00",
    tarih: "Bugün",
    kaynak: "BDDK",
    kategori: "resmi",
    resmiKurum: "BDDK",
    baslik: "BDDK Haftalık Bankacılık Verileri: TL mevduat payı artışını koruyor",
    detay: "TL mevduatın toplam mevduat içindeki payı %56.4'e yükselirken bankacılık sektörünün sermaye yeterlilik rasyosu %17.2 seviyesinde gerçekleşti.",
    paragraflar: [
      "Bankacılık Düzenleme ve Denetleme Kurumu (BDDK) haftalık bülteninde, sektörün toplam kredi hacminin dengeli büyüdüğü ve takipteki alacaklar rasyosunun %1.68 seviyesinde stabil kaldığı belirtildi.",
      "Kur korumalı mevduat bakiyesindeki düşüş eğiliminin kesintisiz sürdüğü, standart TL vadeli mevduat hesaplarına geçişin hızlandığı kaydedildi."
    ],
    url: "https://www.bddk.org.tr",
  },
  {
    id: "r4",
    zaman: "15:15:00",
    tarih: "Bugün",
    kaynak: "HMB",
    kategori: "resmi",
    resmiKurum: "HMB",
    baslik: "Hazine ve Maliye Bakanlığı: Merkezi Yönetim Bütçe Dengesi hedeflerle uyumlu",
    detay: "Açıklamada, Hazine nakit rezervlerinin güçlü seviyesini koruduğu kaydedildi.",
    paragraflar: [
      "Hazine ve Maliye Bakanlığı bütçe gerçekleşmeleri raporunda, kamu harcamalarında tasarruf tedbirlerinin ve gelir artırıcı mali disiplin uygulamalarının sonuç verdiği belirtildi.",
      "Hazine nakit rezervlerinin güçlü yapısı sayesinde borçlanma vadelerinin uzatıldığı ve borçlanma maliyetlerinde düşüş kaydedildiği bildirildi."
    ],
    url: "https://www.hmb.gov.tr",
  },
  {
    id: "r5",
    zaman: "10:00:00",
    tarih: "Bugün",
    kaynak: "TÜİK",
    kategori: "resmi",
    resmiKurum: "TÜİK",
    baslik: "TÜİK: Yıllık Tüketici Fiyat Endeksi gerilemesini sürdürdü",
    detay: "Çekirdek enflasyon göstergelerinde genele yayılan yavaşlama izlendi.",
    paragraflar: [
      "Türkiye İstatistik Kurumu verilerine göre tüketici fiyat endeksi yıllık bazda gerileme eğilimini sürdürdü. Temel mallar ve ulaştırma kalemleri düşüşe en yüksek katkıyı verdi.",
      "Yurt içi üretici fiyat endeksi de (Yİ-ÜFE) aylık bazda sınırlı artış kaydederek maliyet yönlü baskıların azaldığını ortaya koydu."
    ],
    url: "https://www.tuik.gov.tr",
  },
];

export interface RssFeedConfig {
  url: string;
  badge: string;
  filterEconomyOnly?: boolean;
  fallbackUrls?: string[];
}

// Aktif Doğrudan RSS Kaynak Konfigürasyonu
const ACTIVE_RSS_SOURCES: RssFeedConfig[] = [
  {
    url: "https://www.aa.com.tr/tr/rss/default?cat=ekonomi",
    fallbackUrls: ["https://www.aa.com.tr/tr/rss/ekonomi"],
    badge: "AA FİNANS",
  },
  { url: "https://www.ekonomim.com/rss", badge: "EKONOMİM" },
  { url: "https://www.cnbce.com/rss", badge: "CNBC-E" },
  { url: "https://www.ekonomist.com.tr/rss", badge: "EKONOMİST" },
  { url: "https://www.foreks.com/rss", badge: "FOREKS" },
  { url: "https://www.ntv.com.tr/ntvpara.rss", badge: "NTV PARA" },
  {
    url: "https://www.turkiyegazetesi.com.tr/rss",
    badge: "TÜRKİYE GAZETESİ",
    filterEconomyOnly: true,
  },
  {
    url: "https://www.dunya.com/rss",
    badge: "DÜNYA GAZETESİ",
    filterEconomyOnly: true,
  },
];

// HTML entity decode mekanizması (&ouml;, &uuml;, &ccedil;, &rsquo;, &#39; vb. temizliği)
export const decodeHtmlEntities = (str?: string | null): string => {
  if (!str) return "";
  const raw = String(str).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
  if (typeof window === "undefined" || typeof document === "undefined") {
    return raw
      .replace(/&ouml;/gi, "ö")
      .replace(/&Ouml;/gi, "Ö")
      .replace(/&uuml;/gi, "ü")
      .replace(/&Uuml;/gi, "Ü")
      .replace(/&ccedil;/gi, "ç")
      .replace(/&Ccedil;/gi, "Ç")
      .replace(/&thorn;/gi, "ş")
      .replace(/&yacute;/gi, "ı")
      .replace(/&eth;/gi, "ğ")
      .replace(/&rsquo;/gi, "’")
      .replace(/&lsquo;/gi, "‘")
      .replace(/&rdquo;/gi, "”")
      .replace(/&ldquo;/gi, "“")
      .replace(/&quot;/gi, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#036;/g, "$")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/<[^>]*>?/gm, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  try {
    const txt = document.createElement("textarea");
    txt.innerHTML = raw;
    return txt.value.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
  } catch {
    return raw.replace(/<[^>]*>?/gm, "").replace(/\s+/g, " ").trim();
  }
};

// HTML ve özel karakterleri temizleyen yardımcı
function cleanHtmlStr(str?: string | null): string {
  return decodeHtmlEntities(str);
}

// Description metninden ilk 2 paragrafı ayıklayan fonksiyon
function extractTwoParagraphs(desc: string, title: string, badge: string): string[] {
  if (!desc || desc.length < 15) {
    return [
      `[${badge}] tarafından aktarılan son dakika ekonomi ve finans gelişmesi: "${title}".`,
      "Piyasa analistleri, haberin sektör endeksleri ve şirket değerlemeleri üzerindeki etkilerini izliyor.",
    ];
  }

  const paragraphs = desc
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  if (paragraphs.length >= 2) {
    return paragraphs.slice(0, 2);
  }

  const sentences = desc.match(/[^\.!\?]+[\.!\?]+/g);
  if (sentences && sentences.length >= 2) {
    const mid = Math.ceil(sentences.length / 2);
    const p1 = sentences.slice(0, mid).join(" ").trim();
    const p2 = sentences.slice(mid).join(" ").trim();
    if (p1 && p2) return [p1, p2];
  }

  return [
    desc,
    "Borsa İstanbul ve finansal piyasalara ilişkin gelişmeler güncellenmektedir.",
  ];
}

// DOMParser ile RSS XML ayrıştırma
function parseRssWithDomParser(
  xmlText: string,
  feed: RssFeedConfig
): TerminalHaber[] {
  if (!xmlText || typeof xmlText !== "string") return [];
  const items: TerminalHaber[] = [];

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
      throw new Error("XML parsererror");
    }

    const itemNodes = xmlDoc.getElementsByTagName("item");
    for (let i = 0; i < itemNodes.length; i++) {
      const node = itemNodes[i];

      // Özel Filtre: Türkiye Gazetesi ve Dünya Gazetesi için sadece "Ekonomi" kategorisi
      if (feed.filterEconomyOnly) {
        const catNodes = node.getElementsByTagName("category");
        let isEconomy = false;
        for (let c = 0; c < catNodes.length; c++) {
          const catText = (catNodes[c].textContent || "").trim().toLowerCase();
          if (catText.includes("ekonomi")) {
            isEconomy = true;
            break;
          }
        }

        if (!isEconomy) {
          const linkText = (node.getElementsByTagName("link")[0]?.textContent || "").toLowerCase();
          if (linkText.includes("/ekonomi/")) {
            isEconomy = true;
          }
        }

        if (!isEconomy) continue;
      }

      const titleEl = node.getElementsByTagName("title")[0];
      const rawTitle = cleanHtmlStr(titleEl?.textContent);
      if (!rawTitle || rawTitle.length < 5) continue;

      const linkEl = node.getElementsByTagName("link")[0];
      const guidEl = node.getElementsByTagName("guid")[0];
      const rawLink = cleanHtmlStr(linkEl?.textContent || guidEl?.textContent || "#");

      const pubDateEl = node.getElementsByTagName("pubDate")[0];
      const { time, timestamp, dateObj } = parseNewsDate(pubDateEl?.textContent);

      const descEl = node.getElementsByTagName("description")[0];
      const cleanDesc = cleanHtmlStr(descEl?.textContent);
      const paragraflar = extractTwoParagraphs(cleanDesc, rawTitle, feed.badge);

      const id = `rss_${feed.badge.toLowerCase().replace(/[^a-z]/g, "")}_${timestamp}_${i}`;

      items.push({
        id,
        zaman: time,
        time,
        tarih: "Bugün",
        kaynak: feed.badge,
        baslik: rawTitle,
        ozet: rawTitle,
        detay: cleanDesc,
        paragraflar,
        url: rawLink,
        kategori: "bist",
        timestamp,
        dateObj,
      });
    }
  } catch {
    // DOMParser istisna verirse regex ile dene
    const chunks = xmlText.split(/<item[\s>]/i).slice(1);
    chunks.forEach((chunk, i) => {
      if (feed.filterEconomyOnly) {
        const catMatches = [...chunk.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)];
        let isEconomy = false;
        for (const m of catMatches) {
          if (cleanHtmlStr(m[1]).toLowerCase().includes("ekonomi")) {
            isEconomy = true;
            break;
          }
        }
        if (!isEconomy) {
          const linkMatch = chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] || "";
          if (linkMatch.toLowerCase().includes("/ekonomi/")) {
            isEconomy = true;
          }
        }
        if (!isEconomy) return;
      }

      const titleMatch = chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
      if (!titleMatch) return;
      const rawTitle = cleanHtmlStr(titleMatch);
      if (!rawTitle || rawTitle.length < 5) return;

      const linkMatch =
        chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ||
        chunk.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ||
        "#";
      const rawLink = cleanHtmlStr(linkMatch);

      const pubDateMatch = chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1];
      const { time, timestamp, dateObj } = parseNewsDate(pubDateMatch);

      const descMatch =
        chunk.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ||
        chunk.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1] ||
        "";
      const cleanDesc = cleanHtmlStr(descMatch);
      const paragraflar = extractTwoParagraphs(cleanDesc, rawTitle, feed.badge);

      items.push({
        id: `rss_fb_${feed.badge.toLowerCase().replace(/[^a-z]/g, "")}_${timestamp}_${i}`,
        zaman: time,
        time,
        tarih: "Bugün",
        kaynak: feed.badge,
        baslik: rawTitle,
        ozet: rawTitle,
        detay: cleanDesc,
        paragraflar,
        url: rawLink,
        kategori: "bist",
        timestamp,
        dateObj,
      });
    });
  }

  return items;
}

// 3. ÇEVİRİ MOTORUNU KESİN OLARAK GEMINI PROMPT'UNA BAĞLA (MyMemory tamamen kaldırıldı)
export const translateGlobalFeed = async (text: string): Promise<string> => {
  if (!text) return "";

  // 1. Regex temizliği (çöp karakterleri ve Telegram artıklarını sil)
  const clean = text
    .replace(/\$[A-Z]{1,6}\b/g, "")
    .replace(/^\[.*?\]\s*·?\s*/gi, "")
    .replace(/[•·]+$/, "")
    .replace(/^[\s\*\/\-]+/, "")
    .trim();

  if (!clean) return "";

  // 2. Cache kontrolü (aynı haber tekrar çevrilmesin)
  const cacheKey = "tr_" + clean.slice(0, 25);
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return cached;
    } catch {
      // ignore
    }
  }

  const apiKey =
    process.env.NEXT_PUBLIC_GEMINI_KEY ||
    (typeof window !== "undefined" &&
      ((window as unknown as { __GEMINI_KEY__?: string }).__GEMINI_KEY__ ||
        localStorage.getItem("gemini_api_key"))) ||
    "";

  // 3.a Öncelikli: Next.js Sunucu Proxy Rotası (/api/translate - process.env.GEMINI_API_KEY)
  try {
    const sRes = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, apiKey }),
    });
    if (sRes.ok) {
      const sData = await sRes.json();
      if (sData.translated && typeof sData.translated === "string" && sData.translated !== clean) {
        const finalTr = sData.translated.replace(/^[\s\*\/\-]+/, "").trim();
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(cacheKey, finalTr);
          } catch {
            // ignore
          }
        }
        return finalTr;
      }
    }
  } catch {
    // ignore
  }

  if (!apiKey) {
    // API anahtarı yoksa saçmalamaktansa orijinal temiz metni bırak (Sözlük motoruna DÜŞME)
    return clean;
  }

  // 3.b Doğrudan Gemini Flash REST API Çağrısı
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Sen Bloomberg terminali için çalışan kıdemli bir borsa bülteni editörüsün. Aşağıdaki metni akıcı ve profesyonel finans Türkçesine çevir.
KESİN KURALLAR:
1. 'Strikes' kelimesi bağlama göre 'saldırılar / operasyonlar'dır, asla 'grev' olarak çevirme!
2. Şirket isimlerini ve borsa kodlarını koru: Binance, Intel, Sandisk, Reddit, Amazon, WSJ, Fed.
3. Kısaltmaları koru: Q1, Q2, Q3, Q4, EPS, Capex, Devops, Private key, Stock split (Hisse bölünmesi).
4. Cümle başları ve özel isimler BÜYÜK harfle başlasın, asla metni komple küçük harfe çevirme.
5. Sadece Türkçe çeviriyi tek satır olarak ver. Başına veya sonuna hiçbir işaret/açıklama koyma.

Metin: ${clean}`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await res.json();
    const result = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || clean;
    const finalClean = result
      .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
      .replace(/^Metin:\s*/i, "")
      .replace(/^Haber:\s*/i, "")
      .replace(/^[\s\*\/\-]+/, "")
      .trim();

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(cacheKey, finalClean);
      } catch {
        // ignore
      }
    }
    return finalClean;
  } catch {
    // Hata durumunda saçma sözlük motorlarına DÜŞME, orijinal metni bırak
    return clean;
  }
};

export const translateFinancialWithGemini = translateGlobalFeed;

export default function TerminalWorkspace() {
  const [bistHaberleri, setBistHaberleri] = useState<TerminalHaber[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = localStorage.getItem(CACHE_KEY_BIST);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Eğer hafızadaki kayıtlı son haberin tarihi dünden kalmaysa localStorage önbelleğini otomatik temizle
          const latestItem = parsed[0];
          const latestTime = latestItem?.timestamp || (latestItem?.dateObj ? new Date(latestItem.dateObj).getTime() : 0);
          if (latestTime && !isToday(latestTime)) {
            localStorage.removeItem(CACHE_KEY_BIST);
            return [];
          }
          const filtered = parsed.filter((it: TerminalHaber) => isToday(it.dateObj || it.timestamp));
          if (filtered.length > 0) return filtered;
          localStorage.removeItem(CACHE_KEY_BIST);
          return [];
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [globalHaberler, setGlobalHaberler] = useState<GlobalNewsItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = localStorage.getItem(CACHE_KEY_GLOBAL);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [loadingBist, setLoadingBist] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const cached = localStorage.getItem(CACHE_KEY_BIST);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const latestItem = parsed[0];
          const latestTime = latestItem?.timestamp || (latestItem?.dateObj ? new Date(latestItem.dateObj).getTime() : 0);
          if (latestTime && isToday(latestTime)) {
            return false;
          }
        }
      }
    } catch {
      // ignore
    }
    return true;
  });

  const [loadingGlobal, setLoadingGlobal] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const cached = localStorage.getItem(CACHE_KEY_GLOBAL);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return false;
      }
    } catch {
      // ignore
    }
    return true;
  });

  const [seciliHaber, setSeciliHaber] = useState<TerminalHaber | null>(null);
  const [newlyArrivedIds, setNewlyArrivedIds] = useState<Set<string>>(new Set());

  const knownIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);
  const translationsCacheRef = useRef<Map<string, string>>(new Map());




  const loadGlobalNews = useCallback(async () => {

    try {
      let items: { id: string; zaman: string; timestamp: number; rawText: string; baslik: string }[] = [];

      // 1. Birincil Canlı İstek (Next.js server-side telegram rotası)
      try {
        const res = await fetch("/api/telegram-news", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            items = data.items;
          }
        }
      } catch {
        // Sunucu rotası geçici hata verirse ikincil adıma geç
      }

      // 2. İkincil İstemci Tarafı Fallback (allorigins proxy)
      if (items.length === 0) {
        try {
          const proxyUrl =
            "https://api.allorigins.win/raw?url=" + encodeURIComponent("https://t.me/s/trad_fin");
          const proxyRes = await fetch(proxyUrl);
          if (proxyRes.ok) {
            const html = await proxyRes.text();
            const blocks = html.split('<div class="tgme_widget_message_wrap');
            for (let i = 1; i < blocks.length; i++) {
              const blk = blocks[i];
              const textM = blk.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i);
              const timeM = blk.match(/<time[^>]*datetime="([^"]*)"[^>]*>([\s\S]*?)<\/time>/i);
              const postM = blk.match(/data-post="([^"]*)"/i);

              if (textM && textM[1]) {
                const raw = textM[1]
                  .replace(/<br\s*[\/]?>/gi, " ")
                  .replace(/<[^>]+>/g, " ")
                  .replace(/&#036;/g, "$")
                  .replace(/&#39;/g, "'")
                  .replace(/&quot;/g, '"')
                  .replace(/&amp;/g, "&")
                  .trim();

                if (!raw) continue;
                const { timestamp, zaman: zStr } = normalizeNewsDate(timeM?.[1]);
                const pId = postM ? postM[1] : `tg_proxy_${timestamp}_${i}`;
                const cleanText = cleanWireText(raw);
                items.push({
                  id: pId,
                  zaman: zStr,
                  timestamp,
                  rawText: raw,
                  baslik: cleanText,
                });
              }
            }
          }
        } catch {
          // İkincil proxy hatası yoksayılır
        }
      }

      if (items.length > 0) {
        // En yeni en üstte olacak şekilde sırala
        items.sort((a, b) => b.timestamp - a.timestamp);

        // Telegram mesajlarını Gemini Flash API ile Türkçeye çevir
        const translatedItems: GlobalNewsItem[] = await Promise.all(
          items.slice(0, 30).map(async (item) => {
            const rawContent = item.rawText || item.baslik;
            const trTitle = await translateGlobalFeed(rawContent);
            return {
              id: item.id,
              zaman: item.zaman,
              timestamp: item.timestamp,
              baslik: trTitle,
              rawText: item.rawText,
              rawClean: rawContent,
            };
          })
        );

        setGlobalHaberler(translatedItems);

        // Başarılı akışı yerel hafızaya kaydet
        try {
          localStorage.setItem(CACHE_KEY_GLOBAL, JSON.stringify(translatedItems));
        } catch {
          // Önbellek yazma hatası yoksayılır
        }
      }
    } catch {
      // Hata durumunda mevcut liste ekranda korunur
    } finally {
      setLoadingGlobal(false);
    }
  }, []);

  // 8 Kaynaklı Güçlü Çift/Çoklu Proxy Havuzu (AbortSignal.timeout(8000))
  const fetchRSS = async (url: string): Promise<string | null> => {
    const proxies = [
      (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
      (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
      (u: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    ];

    for (const getProxyUrl of proxies) {
      try {
        const res = await fetch(getProxyUrl(url), { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          const text = await res.text();
          if (text && (text.includes("<rss") || text.includes("<xml") || text.includes("<feed"))) {
            return text;
          }
        }
      } catch {
        // Bir sonraki proxy'ye geç
      }
    }
    return null;
  };

  const loadNews = useCallback(async () => {
    try {
      const kaynakIsimleri: string[] = [];
      const allNews: TerminalHaber[] = [];

      // Tüm kaynakları Promise.allSettled ile çek
      const results = await Promise.allSettled(
        ACTIVE_RSS_SOURCES.map(async (feed) => {
          try {
            let xml = await fetchRSS(feed.url);

            // AA Finans ve diğer kaynaklar için: eğer yanıtta <item> bulunamazsa alternatif/fallback URL'e istek at
            if ((!xml || !xml.includes("<item")) && feed.fallbackUrls && feed.fallbackUrls.length > 0) {
              for (const fallbackUrl of feed.fallbackUrls) {
                const altXml = await fetchRSS(fallbackUrl);
                if (altXml && altXml.includes("<item")) {
                  xml = altXml;
                  break;
                }
              }
            }

            if (xml) {
              const parsed = parseRssWithDomParser(xml, feed);
              if (parsed && parsed.length > 0) {
                kaynakIsimleri.push(feed.badge);
                return { badge: feed.badge, items: parsed };
              }
            }
            return { badge: feed.badge, items: [] };
          } catch {
            return { badge: feed.badge, items: [] };
          }
        })
      );

      console.log("Çekilen kaynaklar:", kaynakIsimleri);

      // Gelen her başarılı XML'deki haberleri ortak bir diziye push et
      results.forEach((res) => {
        if (res.status === "fulfilled" && Array.isArray(res.value?.items)) {
          allNews.push(...res.value.items);
        }
      });

      // Tüm kaynaklardan gelen haberler birleştikten sonra sayısal sıralamayı kesin uygula:
      allNews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

      // Eğer dış proxy havuzu tamamen kapalıysa veya boşsa, sunucu tarafındaki /api/news rotasını dene
      if (allNews.length === 0) {
        try {
          const res = await fetch("/api/news", { cache: "no-store", signal: AbortSignal.timeout(8000) });
          if (res.ok) {
            const data = await res.json();
            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
              data.items.forEach((it: ApiNewsItemResponse) => {
                const parsedDate = parseNewsDate(it.timestamp || it.dateObj);
                const itemTime = it.time || it.zaman || parsedDate.time;
                allNews.push({
                  id: it.id,
                  zaman: itemTime,
                  time: itemTime,
                  tarih: it.tarih || "Bugün",
                  kaynak: it.kaynak,
                  baslik: it.baslik,
                  ozet: it.baslik,
                  paragraflar: it.paragraflar,
                  detay: it.paragraflar?.join("\n\n") || it.detay || it.baslik,
                  url: it.url || "#",
                  kategori: "bist" as const,
                  timestamp: it.timestamp,
                  dateObj: parsedDate.dateObj,
                });
              });
            }
          }
        } catch {
          // Sunucu isteği hatası yoksayılır
        }
      }

      if (allNews.length > 0) {
        // Tüm kaynaklardan gelen haberleri kesin sırala
        allNews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // 2. GÜNLÜK AKIŞI SIFIRLAMA (23:59 Sonrası Yeni Gün Temizliği):
        // Haber birikmesini engelle: Öncelikle bugünün haberleri listelensin
        const todaysNews = allNews.filter((item) => isToday(item.dateObj || item.timestamp));
        const listToProcess = todaysNews.length > 0 ? todaysNews : allNews;

        // En güncelden eskiye doğru sırala
        listToProcess.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // Mükerrer haberleri filtrele
        const seenTitles = new Set<string>();
        const deduplicated: TerminalHaber[] = [];

        for (const item of listToProcess) {
          const normKey = item.baslik.toLowerCase().replace(/[^a-z0-9ğüşıöç]/g, "").slice(0, 40);
          if (!seenTitles.has(normKey)) {
            seenTitles.add(normKey);
            deduplicated.push(item);
          }
        }

        // Kesin sayısal sıralama (En son yayınlanan haber her zaman 1. sırada / en üstte)
        deduplicated.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        deduplicated.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // Yeni haber tespiti (İlk yükleme sonrasında yeni düşen haberler için parlama/fade efekti)
        if (!isInitialLoadRef.current) {
          const yeniGelenler = deduplicated.filter(
            (h) => !knownIdsRef.current.has(h.id) && !knownIdsRef.current.has(h.baslik.slice(0, 30))
          );

          if (yeniGelenler.length > 0) {
            const yeniIdler = new Set(yeniGelenler.map((h) => h.id));
            setNewlyArrivedIds((prev) => new Set([...prev, ...yeniIdler]));

            // 4 saniye sonra yeni efektini kaldır
            setTimeout(() => {
              setNewlyArrivedIds((prev) => {
                const kopya = new Set(prev);
                yeniIdler.forEach((id) => kopya.delete(id));
                return kopya;
              });
            }, 4000);
          }
        }

        // Bilinen ID ve başlık havuzunu güncelle
        deduplicated.forEach((h) => {
          knownIdsRef.current.add(h.id);
          knownIdsRef.current.add(h.baslik.slice(0, 30));
        });

        isInitialLoadRef.current = false;
        setBistHaberleri(deduplicated);

        // Başarılı akışı anında yerel hafızaya (localStorage) kaydet, liste boşsa temizle
        try {
          if (deduplicated.length > 0) {
            localStorage.setItem(CACHE_KEY_BIST, JSON.stringify(deduplicated));
          } else {
            localStorage.removeItem(CACHE_KEY_BIST);
          }
        } catch {
          // LocalStorage hatası yoksayılır
        }
      }
    } catch {
      // Ağ veya proxy hatasında ekran asla boş kalmaz; mevcut önbellek ekranda tutulur
    } finally {
      setLoadingBist(false);
    }
  }, []);

  // 15 saniyede bir BIST & Türkiye arka planda sessizce sorgula (polling)
  useEffect(() => {
    // İlk sorguyu asenkron olarak tetikle
    const initialTimer = setTimeout(() => {
      void loadNews();
    }, 0);

    // Her 15 saniyede bir periyodik canlı polling
    const interval = setInterval(() => {
      void loadNews();
    }, 15000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [loadNews]);

  // 15 saniyede bir Telegram @trad_fin Global haber akışını arka planda sorgula (polling)
  useEffect(() => {
    // Önbellekten kaydedilmiş çevirileri yükle
    try {
      const savedTrans = localStorage.getItem(CACHE_KEY_TRANSLATIONS);
      if (savedTrans) {
        const parsed = JSON.parse(savedTrans);
        if (parsed && typeof parsed === "object") {
          Object.entries(parsed).forEach(([k, v]) => {
            if (typeof v === "string") translationsCacheRef.current.set(k, v);
          });
        }
      }
    } catch {
      // ignore
    }

    // İlk sorgu
    const timer = setTimeout(() => {
      void loadGlobalNews();
    }, 50);

    // Her 15 saniyede bir canlı polling
    const interval = setInterval(() => {
      void loadGlobalNews();
    }, 15000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loadGlobalNews]);

  // Modal için ESC klavye tuşu dinleyicisi
  useEffect(() => {
    if (!seciliHaber) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSeciliHaber(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [seciliHaber]);

  return (
    <div className="terminal-workspace">
      {/* 3-SÜTUNLU KOMPAKT ENDÜSTRİYEL TERMİNAL DÜZENİ (ÜST SIRA) */}
      <div className="terminal-grid">
        {/* SÜTUN 1: BIST & Türkiye (Canlı Çok Kaynaklı Akış) */}
        <section className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[520px] overflow-hidden">
          <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
            <div className="flex items-center">
              <h2 className="font-mono text-xs font-semibold tracking-wider text-slate-200">
                <span className="text-[#38bdf8] font-bold mr-1.5">/</span>
                BIST & Türkiye
              </h2>
            </div>
          </div>

          <div className="pane-scroll">
            {loadingBist ? (
              <TerminalSkeletonList count={6} />
            ) : bistHaberleri.length === 0 ? (
              <div className="p-6 flex flex-col items-center justify-center h-48 text-center gap-2.5 font-mono select-none">
                <div className="flex items-center gap-2 text-[#38bdf8] text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#2563eb] animate-ping" />
                  <span>Canlı akış bekleniyor...</span>
                </div>
                <p className="text-[11px] text-slate-500 max-w-[320px]">
                  Ekonomi ve finans kaynakları taranıyor, yeni haberler düştükçe akışa eklenecek.
                </p>
              </div>
            ) : (
              bistHaberleri.map((h) => {
                const isNew = newlyArrivedIds.has(h.id);
                return (
                  <article
                    key={h.id}
                    onClick={() => setSeciliHaber(h)}
                    className={`terminal-row group transition-all duration-300 ${
                      isNew ? "terminal-row-new" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 font-mono text-[10.5px]">
                      <span className="row-time tabular-nums text-slate-500">{h.time || h.zaman}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[#0a1120] border border-slate-700/60 text-slate-300 font-mono text-[9.5px] uppercase tracking-wide">
                        [{h.kaynak}]
                      </span>
                      {isNew && (
                        <span className="px-1.5 py-0.2 rounded text-[#38bdf8] bg-[#2563eb]/15 border border-[#2563eb]/30 text-[8.5px] font-bold animate-pulse">
                          YENİ
                        </span>
                      )}
                    </div>

                    <h3 className="row-headline font-medium text-slate-200 group-hover:text-[#38bdf8] cursor-pointer transition text-xs leading-snug">
                      {h.baslik}
                    </h3>
                  </article>
                );
              })
            )}
          </div>
        </section>

        {/* SÜTUN 2: Global (Telegram @trad_fin Canlı Otomatik Çevrilen Akış) */}
        <section className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[520px] overflow-hidden">
          <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
            <div className="flex items-center">
              <h2 className="font-mono text-xs font-semibold tracking-wider text-slate-200">
                <span className="text-[#38bdf8] font-bold mr-1.5">/</span>
                Global
              </h2>
            </div>
          </div>

          {/* Ana Liste Kapsayıcısı */}
          <div className="flex flex-col gap-3 p-3 overflow-y-auto pane-scroll flex-1 min-h-0">
            {loadingGlobal ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 pb-3 border-b border-slate-800/80 last:border-b-0 w-full animate-pulse"
                >
                  <span className="w-12 h-3.5 bg-slate-800/80 rounded shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="w-full h-3 bg-slate-800/60 rounded" />
                    <div className="w-4/5 h-3 bg-slate-800/40 rounded" />
                  </div>
                </div>
              ))
            ) : globalHaberler.length === 0 ? (
              <div className="p-6 flex flex-col items-center justify-center h-48 text-center gap-2.5 font-mono select-none">
                <div className="flex items-center gap-2 text-[#38bdf8] text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#2563eb] animate-ping" />
                  <span>Küresel canlı akış bekleniyor...</span>
                </div>
                <p className="text-[11px] text-slate-500 max-w-[320px]">
                  Telegram @trad_fin bağlantısı kuruluyor.
                </p>
              </div>
            ) : (
              globalHaberler.map((item, index) => {
                const itemTime = item.zaman || parseNewsTime(item.timestamp);
                const itemText = (item.baslik || "")
                  .replace(/^[\s\*\/\-]+/, "")
                  .trim();

                return (
                  <div
                    key={item.id || index}
                    style={{ gap: "14px" }}
                    className="flex items-start pb-3 border-b border-slate-800/80 last:border-b-0 w-full"
                  >
                    {/* 1. Sol Kolon: Sabit genişlikli saat */}
                    <span className="font-mono text-[11px] text-slate-500 shrink-0 select-none pt-0.5">
                      {itemTime}
                    </span>

                    {/* 2. Sağ Kolon: Haber metni (Doğrudan ilk kelimeyle başlar, / işareti YOK) */}
                    <p className="text-[12px] text-slate-200 leading-relaxed font-normal m-0 p-0 flex-1">
                      <span>{itemText}</span>
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* SÜTUN 3: KAP Bildirimleri + Resmi Kurumlar */}
        <div className="terminal-stack">
          {/* Üst: KAP Bildirimleri */}
          <section className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[255px] overflow-hidden">
            <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
              <div className="flex items-center">
                <h2 className="font-mono text-xs font-semibold tracking-wider text-slate-200">
                  <span className="text-[#38bdf8] font-bold mr-1.5">/</span>
                  KAP Bildirimleri
                </h2>
              </div>
            </div>

            <div className="pane-scroll">
              {KAP_BILDIRIMLERI.map((h) => (
                <article
                  key={h.id}
                  onClick={() => setSeciliHaber(h)}
                  className="terminal-row kap-row group"
                >
                  <div className="kap-row-top">
                    <div className="flex items-center gap-2">
                      {h.hisseler?.map((s) => (
                        <span key={s} className="text-[#38bdf8] font-mono font-bold text-[11px] tracking-tight">
                          {s}
                        </span>
                      ))}
                      {h.kapTuru && (
                        <span className="kap-type-subtle font-mono">
                          {h.kapTuru}
                        </span>
                      )}
                    </div>
                    <span className="row-time font-mono tabular-nums text-slate-500 text-[11px]">
                      {h.zaman}
                    </span>
                  </div>

                  <h3 className="row-headline kap-headline group-hover:text-[#38bdf8] transition">
                    {h.baslik}
                  </h3>
                </article>
              ))}
            </div>
          </section>

          {/* Alt: Resmi Kurumlar */}
          <section className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[255px] overflow-hidden">
            <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
              <div className="flex items-center">
                <h2 className="font-mono text-xs font-semibold tracking-wider text-slate-200">
                  <span className="text-[#38bdf8] font-bold mr-1.5">/</span>
                  Resmi Kurumlar
                </h2>
              </div>
            </div>

            <div className="pane-scroll">
              {RESMI_HABERLER.map((h) => (
                <article
                  key={h.id}
                  onClick={() => setSeciliHaber(h)}
                  className="terminal-row resmi-row group"
                >
                  <div className="row-meta font-mono">
                    <span className="row-time tabular-nums text-slate-500">{h.zaman}</span>
                    <span className="resmi-badge">@{h.resmiKurum || h.kaynak}</span>
                  </div>

                  <h3 className="row-headline font-medium text-slate-200 group-hover:text-[#38bdf8] transition text-xs leading-snug">
                    {h.baslik}
                  </h3>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* ALT SIRA: 3 KOLONLU GRID (/ BIST Hareketler, / TAKVİM, / Bülten) */}
      <div className="w-full mt-4" style={{ marginTop: "16px" }}>
        <MarketIntelligence />
      </div>

      {/* 3. HABER DETAY MODALI (PREMIUM TERMINAL TASARIMI) */}
      {seciliHaber && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
          onClick={() => setSeciliHaber(null)}
          role="dialog"
          aria-modal="true"
        >
          {/* Modal Box */}
          <div
            className="w-full max-w-2xl bg-[#0b0f19] border border-[#2563eb]/40 rounded-xl shadow-[0_0_50px_rgba(37,99,235,0.15)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Üst İnce Accent Çizgisi */}
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#2563eb] to-transparent" />

            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-white bg-[#2563eb] px-2.5 py-1 rounded tracking-wider shadow-sm uppercase">
                  {seciliHaber.kaynak}
                </span>
                <span className="font-mono text-xs text-slate-400">
                  {seciliHaber.time || seciliHaber.zaman} · {seciliHaber.tarih || "Bugün"}
                </span>
              </div>
              <button
                onClick={() => setSeciliHaber(null)}
                className="flex items-center gap-1.5 text-xs font-mono text-slate-400 hover:text-white px-2.5 py-1 rounded-md hover:bg-white/[0.06] transition"
              >
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">ESC</span>
                <span>✕</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <h2 className="text-lg font-bold text-slate-100 leading-snug tracking-tight">
                {decodeHtmlEntities(seciliHaber.baslik)}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed font-normal whitespace-pre-line">
                {decodeHtmlEntities(
                  seciliHaber.paragraflar && seciliHaber.paragraflar.length > 0
                    ? seciliHaber.paragraflar.join("\n\n")
                    : seciliHaber.detay || seciliHaber.ozet || "Haber detayları piyasa kaynakları üzerinden canlı aktarılmıştır."
                )}
              </p>
            </div>

            {/* Footer Bar */}
            <div className="px-6 py-4 bg-[#080c14] border-t border-white/[0.06] flex items-center justify-between gap-4">
              <div className="text-[11px] font-mono text-slate-500">
                Kategori: <span className="text-slate-300">
                  {seciliHaber.kategori === "bist"
                    ? "Piyasa Özeti / BIST"
                    : seciliHaber.kategori === "kap"
                    ? "KAP Kamuyu Aydınlatma"
                    : seciliHaber.kategori === "resmi"
                    ? "Resmi Kurum Bülteni"
                    : "Piyasa Özeti / BIST"}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSeciliHaber(null)}
                  className="text-xs font-medium text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"
                >
                  Kapat
                </button>
                {seciliHaber.url && seciliHaber.url !== "#" ? (
                  <a
                    href={seciliHaber.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs font-semibold text-white bg-[#2563eb] hover:bg-[#1d4ed8] px-5 py-2.5 rounded-lg shadow-lg shadow-[#2563eb]/25 transition active:scale-95"
                  >
                    <span>Kaynağında Oku</span>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                ) : (
                  <span className="text-xs text-slate-500 font-mono">Terminal Orijinal Kayıt</span>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
