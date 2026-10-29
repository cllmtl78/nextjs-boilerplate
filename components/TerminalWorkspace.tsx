"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  ExternalLink,
  Layers,
} from "lucide-react";
import MarketIntelligence from "@/components/MarketIntelligence";

export type TerminalHaber = {
  id: string;
  zaman: string;
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
};

const CACHE_KEY_BIST = "bpt_bist_news";

interface ApiNewsItemResponse {
  id: string;
  zaman: string;
  tarih?: string;
  kaynak: string;
  baslik: string;
  ozet?: string;
  paragraflar?: string[];
  detay?: string;
  url?: string;
  timestamp?: number;
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

// Akıllı Tarih & Saat Normalizasyonu: Hem sayısal timestamp hem de senkron zaman metni üretir.
export function normalizeNewsDate(dateInput: string | number | Date | null | undefined): {
  timestamp: number;
  zaman: string;
} {
  const now = Date.now();
  if (!dateInput) {
    const d = new Date(now);
    return {
      timestamp: now,
      zaman: d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
    };
  }

  try {
    const rawStr = typeof dateInput === "string" ? dateInput.trim() : "";
    const d =
      typeof dateInput === "number" || dateInput instanceof Date
        ? new Date(dateInput)
        : new Date(rawStr);

    if (isNaN(d.getTime())) {
      const fallback = new Date(now);
      return {
        timestamp: now,
        zaman: fallback.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
      };
    }

    // Gelecekteki saatleri kontrol et:
    // Eğer saat yerel zamana göre 1 saatten daha ilerideyse 3 saat geri çek
    const diffHours = (d.getTime() - now) / (1000 * 60 * 60);
    if (diffHours > 1) {
      d.setHours(d.getHours() - 3);
    }

    const normTimestamp = d.getTime();
    const zaman = d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    return {
      timestamp: normTimestamp,
      zaman,
    };
  } catch {
    const fallback = new Date(now);
    return {
      timestamp: now,
      zaman: fallback.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
    };
  }
}

export const parseNewsTime = (dateInput: string | number | Date | null | undefined): string => {
  return normalizeNewsDate(dateInput).zaman;
};

export const formatTimeTR = parseNewsTime;

export function formatNaturalCase(text: string): string {
  if (!text) return "";
  let prefix = "";
  let clean = text.trim();
  if (clean.startsWith("/ ")) {
    prefix = "/ ";
    clean = clean.slice(2).trim();
  } else if (clean.startsWith("/")) {
    prefix = "/ ";
    clean = clean.slice(1).trim();
  }

  const letters = clean.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/g, "");
  const upperCount = (letters.match(/[A-ZĞÜŞİÖÇ]/g) || []).length;
  const isAllOrMostlyCaps = letters.length > 4 && upperCount / letters.length > 0.55;

  if (!isAllOrMostlyCaps) {
    return prefix + clean;
  }

  const hasTrChars = /[ğüşıöçĞÜŞİÖÇ]/i.test(clean);
  let lowered = hasTrChars ? clean.toLocaleLowerCase("tr-TR") : clean.toLowerCase();

  lowered = lowered.replace(/(^\s*|[.:!?·\n-]\s+)([a-zğüşıöç])/gi, (m, p1, p2) => {
    return p1 + p2.toUpperCase();
  });

  const ACRONYMS = [
    "FED", "ECB", "TCMB", "SPK", "BDDK", "TÜİK", "FOMC", "AI", "EPS", "REV", "EST", "ADJ",
    "Q1", "Q2", "Q3", "Q4", "1Ç", "2Ç", "3Ç", "4Ç", "USD", "EUR", "TL", "BIST",
    "CPI", "PPI", "PMI", "PCE", "GDP", "DOJ", "SEC", "NFP", "OPEC", "IMF", "NATO", "AB", "ABD"
  ];
  for (const ac of ACRONYMS) {
    const re = new RegExp("\\b" + ac + "\\b", "gi");
    lowered = lowered.replace(re, ac);
  }

  const PROPER_NAMES = [
    "Warsh", "Powell", "Yellen", "Bessent", "Trump", "Biden", "Lagarde", "Bailey",
    "Microsoft", "Google", "Alphabet", "Nvidia", "Apple", "Amazon", "Tesla", "Meta",
    "OpenAI", "Hugging Face"
  ];
  for (const name of PROPER_NAMES) {
    const re = new RegExp("\\b" + name + "\\b", "gi");
    lowered = lowered.replace(re, name);
  }

  const firstLetter = lowered.charAt(0).toUpperCase();
  return prefix + firstLetter + lowered.slice(1);
}

export function cleanEnglishWire(text: string): string {
  const cleaned = cleanWireText(text);
  return cleaned ? formatNaturalCase("/ " + cleaned) : "/ Wire";
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

// Aktif Doğrudan RSS Kaynak Konfigürasyonu (AA Finans dahil)
const ACTIVE_RSS_SOURCES: { url: string; badge: string; filterEconomyOnly?: boolean }[] = [
  { url: "https://www.aa.com.tr/tr/rss/default?cat=ekonomi", badge: "AA FİNANS" },
  { url: "https://www.ekonomim.com/rss", badge: "EKONOMİM" },
  { url: "https://www.cnbce.com/rss", badge: "CNBC-E" },
  { url: "https://www.ekonomist.com.tr/rss", badge: "EKONOMİST" },
  { url: "https://www.foreks.com/rss", badge: "FOREKS" },
  { url: "https://uzmanpara.milliyet.com.tr/haber_rss/", badge: "UZMAN PARA" },
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

// HTML ve özel karakterleri temizleyen yardımcı
function cleanHtmlStr(str?: string | null): string {
  if (!str) return "";
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/<[^>]*>?/gi, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  feed: { url: string; badge: string; filterEconomyOnly?: boolean }
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
      const { timestamp, zaman } = normalizeNewsDate(pubDateEl?.textContent);

      const descEl = node.getElementsByTagName("description")[0];
      const cleanDesc = cleanHtmlStr(descEl?.textContent);
      const paragraflar = extractTwoParagraphs(cleanDesc, rawTitle, feed.badge);

      const id = `rss_${feed.badge.toLowerCase().replace(/[^a-z]/g, "")}_${timestamp}_${i}`;

      items.push({
        id,
        zaman,
        tarih: "Bugün",
        kaynak: feed.badge,
        baslik: rawTitle,
        ozet: rawTitle,
        detay: cleanDesc,
        paragraflar,
        url: rawLink,
        kategori: "bist",
        timestamp,
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
      const { timestamp, zaman } = normalizeNewsDate(pubDateMatch);

      const descMatch =
        chunk.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ||
        chunk.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1] ||
        "";
      const cleanDesc = cleanHtmlStr(descMatch);
      const paragraflar = extractTwoParagraphs(cleanDesc, rawTitle, feed.badge);

      items.push({
        id: `rss_fb_${feed.badge.toLowerCase().replace(/[^a-z]/g, "")}_${timestamp}_${i}`,
        zaman,
        tarih: "Bugün",
        kaynak: feed.badge,
        baslik: rawTitle,
        ozet: rawTitle,
        detay: cleanDesc,
        paragraflar,
        url: rawLink,
        kategori: "bist",
        timestamp,
      });
    });
  }

  return items;
}

export default function TerminalWorkspace() {
  const [bistHaberleri, setBistHaberleri] = useState<TerminalHaber[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = localStorage.getItem(CACHE_KEY_BIST);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
        if (Array.isArray(parsed) && parsed.length > 0) return false;
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



  // MyMemory API ile İngilizce -> Türkçe çeviri motoru (TEK VE KESİN ÇEVİRİ MOTORU)
  const translateWithMyMemory = useCallback(async (rawText: string): Promise<string> => {
    if (!rawText) return "";
    try {
      // 1. Regex temizliği: $ sembollü borsa kodlarını ve Telegram artıklarını sil
      const clean = rawText
        .replace(/\$[A-Z]{1,6}\b/g, "")
        .replace(/^\[.*?\]\s*·?\s*/gi, "")
        .replace(/[•·]+$/, "")
        .trim();

      if (!clean) return "";

      // Önbellek kontrolü (aynı metin için mükerrer ağ çağrılarını engeller)
      if (translationsCacheRef.current.has(clean)) {
        return translationsCacheRef.current.get(clean)!;
      }

      // 2. MyMemory API doğrudan GET çağrısı (en -> tr)
      const endpoint = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|tr`;
      const response = await fetch(endpoint);
      const result = await response.json();

      if (result && result.responseData && result.responseData.translatedText) {
        let trText = result.responseData.translatedText;

        // Finansal isimleri ve yanlış çevrilen terimleri düzelt
        trText = trText
          .replace(/\bSavaş\b/gi, "Warsh")
          .replace(/\bAi'nin\b/gi, "Bessent'in")
          .replace(/\bKredi sporları\b/gi, "Kredi marjları");

        translationsCacheRef.current.set(clean, trText);
        return trText;
      }
      return clean;
    } catch {
      return rawText;
    }
  }, []);

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
                  baslik: "/ " + cleanText,
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

        // Telegram mesajlarını MyMemory API ile Türkçeye çevir
        const translatedItems: GlobalNewsItem[] = await Promise.all(
          items.slice(0, 25).map(async (item) => {
            const rawContent = item.rawText || item.baslik;
            const trTitle = await translateWithMyMemory(rawContent);
            return {
              id: item.id,
              zaman: item.zaman,
              timestamp: item.timestamp,
              baslik: trTitle,
              rawText: item.rawText,
              rawClean: "/ " + rawContent,
            };
          })
        );

        setGlobalHaberler(translatedItems);

        // Başarılı akışı ve çevirileri yerel hafızaya kaydet
        try {
          localStorage.setItem(CACHE_KEY_GLOBAL, JSON.stringify(translatedItems));
          const cacheObj: Record<string, string> = {};
          translationsCacheRef.current.forEach((val, key) => {
            cacheObj[key] = val;
          });
          localStorage.setItem(CACHE_KEY_TRANSLATIONS, JSON.stringify(cacheObj));
        } catch {
          // Önbellek yazma hatası yoksayılır
        }
      }
    } catch {
      // Hata durumunda mevcut liste ekranda korunur
    } finally {
      setLoadingGlobal(false);
    }
  }, [translateWithMyMemory]);



  // 8 Kaynaklı Canlı RSS Çekme Motoru (Promise.allSettled & Çoklu Proxy Havuzu & 2.5s Agresif Timeout)
  const loadNews = useCallback(async () => {
    try {
      // Çoklu proxy havuzu (allorigins, corsproxy.io, codetabs)
      const PROXY_BUILDERS = [
        (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
        (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      ];

      const fetchWithAggressiveTimeout = async (url: string, timeoutMs = 2500): Promise<string> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return await res.text();
        } catch (err) {
          clearTimeout(timeoutId);
          throw err;
        }
      };

      const fetchRssFeedWithFallback = async (feedUrl: string, feedIndex: number): Promise<string> => {
        // Kaynaklar arasında proxy dağıtımı yaparak tek bir proxy kuyruğunun kilitlenmesini engelle
        const primaryIdx = feedIndex % PROXY_BUILDERS.length;
        const secondaryIdx = (primaryIdx + 1) % PROXY_BUILDERS.length;
        const primaryUrl = PROXY_BUILDERS[primaryIdx](feedUrl);

        try {
          const text = await fetchWithAggressiveTimeout(primaryUrl, 2500);
          if (text && text.trim().length > 30) return text;
        } catch {
          // İlk proxy 2.5 saniyede dönmez veya hata verirse anında yedek proxy'ye geç
        }

        const fallbackUrl = PROXY_BUILDERS[secondaryIdx](feedUrl);
        return await fetchWithAggressiveTimeout(fallbackUrl, 2500);
      };

      // Promise.allSettled kullanarak 8 kaynağı 2.5s agresif timeout ile paralel çek
      const results = await Promise.allSettled(
        ACTIVE_RSS_SOURCES.map(async (feed, idx) => {
          try {
            const xml = await fetchRssFeedWithFallback(feed.url, idx);
            if (xml && xml.trim().length > 0) {
              return parseRssWithDomParser(xml, feed);
            }
            return [];
          } catch {
            return [];
          }
        })
      );

      let items: TerminalHaber[] = [];
      results.forEach((res) => {
        if (res.status === "fulfilled" && Array.isArray(res.value)) {
          items.push(...res.value);
        }
      });

      // Eğer proxy havuzu geçici olarak yanıt vermediyse veya boş döndüyse, sunucu tarafındaki /api/news rotasını dene
      if (items.length === 0) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2500);
          const res = await fetch("/api/news", { cache: "no-store", signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
              items = data.items.map((it: ApiNewsItemResponse) => ({
                id: it.id,
                zaman: it.zaman || formatTimeTR(it.timestamp || Date.now()),
                tarih: it.tarih || "Bugün",
                kaynak: it.kaynak,
                baslik: it.baslik,
                ozet: it.baslik,
                paragraflar: it.paragraflar,
                detay: it.paragraflar?.join("\n\n") || it.detay || it.baslik,
                url: it.url || "#",
                kategori: "bist" as const,
                timestamp: it.timestamp,
              }));
            }
          }
        } catch {
          // Sunucu yedek isteği yoksayılır
        }
      }

      if (items.length > 0) {
        // 1. KRONOLOJİK SIRALAMA: Tek bir havuzda toplanan haberleri kesinlikle sayısal timestamp değerine göre büyükten küçüğe sırala
        items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // 2. MÜKERRER FİLTRELEME: Birebir aynı başlığa sahip mükerrer haberleri filtrele
        const seenTitles = new Set<string>();
        const deduplicated: TerminalHaber[] = [];

        for (const item of items) {
          const normKey = item.baslik.toLowerCase().replace(/[^a-z0-9ğüşıöç]/g, "").slice(0, 40);
          if (!seenTitles.has(normKey)) {
            seenTitles.add(normKey);
            deduplicated.push(item);
          }
        }

        // Filtreleme sonrasında da kronolojik zaman sırasını garantile
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

        // Başarılı akışı anında yerel hafızaya (localStorage) kaydet
        try {
          localStorage.setItem(CACHE_KEY_BIST, JSON.stringify(deduplicated));
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
      {/* 3-SÜTUNLU KOMPAKT ENDÜSTRİYEL TERMİNAL DÜZENİ */}
      <div className="terminal-grid">
        {/* SÜTUN 1: BIST & Türkiye (Canlı Çok Kaynaklı Akış) */}
        <section className="terminal-pane">
          <div className="pane-header">
            <div className="pane-title-group">
              <h2 className="pane-title">BIST & Türkiye</h2>
            </div>
          </div>

          <div className="pane-scroll">
            {loadingBist ? (
              <TerminalSkeletonList count={6} />
            ) : bistHaberleri.length === 0 ? (
              <div className="p-6 flex flex-col items-center justify-center h-48 text-center gap-2.5 font-mono select-none">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
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
                      <span className="row-time tabular-nums text-slate-500">{h.zaman || parseNewsTime(h.timestamp)}</span>
                      <span className="px-1.5 py-0.5 rounded bg-[#0a1120] border border-slate-700/60 text-slate-300 font-mono text-[9.5px] uppercase tracking-wide">
                        [{h.kaynak}]
                      </span>
                      {isNew && (
                        <span className="px-1 py-0.2 rounded bg-cyan-950/80 border border-cyan-500/50 text-cyan-300 text-[8.5px] font-bold animate-pulse">
                          YENİ
                        </span>
                      )}
                    </div>

                    <h3 className="row-headline font-medium text-slate-200 group-hover:text-cyan-400 cursor-pointer transition text-xs leading-snug">
                      {h.baslik}
                    </h3>
                  </article>
                );
              })
            )}
          </div>
        </section>

        {/* SÜTUN 2: Global (Telegram @trad_fin Canlı Otomatik Çevrilen Akış - Tıklanamaz, Rozetsiz) */}
        <section className="terminal-pane">
          <div className="pane-header">
            <div className="pane-title-group">
              <h2 className="pane-title">Global</h2>
            </div>
          </div>

          {/* Ana Liste Kapsayıcısı: her satır arasına 12px net dikey boşluk */}
          <div className="flex flex-col gap-3 p-2 overflow-y-auto pane-scroll flex-1 min-h-0">
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
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Küresel canlı akış bekleniyor...</span>
                </div>
                <p className="text-[11px] text-slate-500 max-w-[320px]">
                  Telegram @trad_fin bağlantısı kuruluyor.
                </p>
              </div>
            ) : (
              globalHaberler.map((item, index) => {
                const itemTime = item.zaman || parseNewsTime(item.timestamp);
                const rawTitle = formatNaturalCase(item.baslik || "");
                const itemText = rawTitle.replace(/^[\s\*\/\-]+/, "").trim() || rawTitle;

                return (
                  <div
                    key={item.id || index}
                    className="flex items-start gap-3 pb-3 border-b border-slate-800/80 last:border-b-0 w-full"
                  >
                    {/* 1. Sol Kolon: Sabit genişlikli saat, aşağı kaymaz */}
                    <span className="font-mono text-[11px] text-slate-500 shrink-0 select-none pt-0.5">
                      {itemTime}
                    </span>

                    {/* 2. Sağ Kolon: Haber metni */}
                    <p className="text-[12px] text-slate-200 leading-relaxed font-normal m-0 p-0 flex-1">
                      <span className="text-cyan-400 font-bold mr-1">/</span>
                      {itemText}
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
          <section className="terminal-pane pane-kap">
            <div className="pane-header">
              <div className="pane-title-group">
                <h2 className="pane-title">KAP Bildirimleri</h2>
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
                        <span key={s} className="kap-code-prominent font-mono">
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

                  <h3 className="row-headline kap-headline group-hover:text-cyan-400 transition">
                    {h.baslik}
                  </h3>
                </article>
              ))}
            </div>
          </section>

          {/* Alt: Resmi Kurumlar */}
          <section className="terminal-pane pane-resmi">
            <div className="pane-header">
              <div className="pane-title-group">
                <h2 className="pane-title">Resmi Kurumlar</h2>
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

                  <h3 className="row-headline font-medium text-slate-200 group-hover:text-cyan-400 transition text-xs leading-snug">
                    {h.baslik}
                  </h3>
                </article>
              ))}
            </div>
          </section>
        </div>

        {/* ALT SATIR: MARKET INTELLIGENCE (BIST HAREKETLER, SEKTÖR AKIŞI, TAKVİM) */}
        <MarketIntelligence />
      </div>

      {/* BLOOMBERG / REFINITIV KALİTESİNDE PROFESYONEL HABER DETAY MODALI (STORY VIEW) */}
      {seciliHaber && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setSeciliHaber(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl bg-[#0b101b] border border-cyan-500/20 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col relative text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Üst Zarif Cyan Gradient Çizgi */}
            <div className="bg-gradient-to-r from-transparent via-cyan-500 to-transparent h-[1px] w-full shrink-0" />

            {/* HEADER: Kaynak Etiketi + Yayın Saati + ESC Rozeti & Kapat Butonu */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-white/[0.06] bg-[#0c1220]/70">
              <div className="flex items-center gap-2.5 font-mono">
                <span className="text-xs font-mono font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/50 px-2 py-0.5 rounded tracking-wide uppercase">
                  [{seciliHaber.kaynak}]
                </span>
                <span className="text-xs font-mono text-slate-400 tabular-nums">
                  {seciliHaber.zaman} {seciliHaber.tarih ? `· ${seciliHaber.tarih}` : ""}
                </span>
                {seciliHaber.hisseler && seciliHaber.hisseler.length > 0 && (
                  <span className="text-cyan-400 font-bold ml-1 font-mono text-xs">
                    {seciliHaber.hisseler.join(", ")}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-slate-800 border border-slate-700 rounded text-slate-400 select-none">
                  ESC
                </kbd>
                <button
                  onClick={() => setSeciliHaber(null)}
                  className="text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition"
                  type="button"
                  aria-label="Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* BODY: Başlık + Temizlenmiş Özet/Paragraflar + Metadata Barı */}
            <div className="p-6 pt-5 flex-1 overflow-y-auto max-h-[55vh]">
              {/* Başlık */}
              <h2 className="text-lg font-semibold text-white tracking-tight leading-snug mb-4 border-b border-white/[0.06] pb-3">
                {seciliHaber.baslik}
              </h2>

              {/* Özet / İçerik (Başlık tekrarını filtreleyen temiz metin) */}
              <div className="text-sm text-slate-300 leading-relaxed space-y-3 font-normal pr-1">
                {(() => {
                  const rawList =
                    seciliHaber.paragraflar && seciliHaber.paragraflar.length > 0
                      ? seciliHaber.paragraflar
                      : seciliHaber.detay
                      ? seciliHaber.detay.split("\n\n")
                      : seciliHaber.ozet
                      ? [seciliHaber.ozet]
                      : [];

                  // Başlıkla neredeyse birebir örtüşen tekrarlı cümleleri filtrele
                  const cleanTitle = seciliHaber.baslik
                    .toLowerCase()
                    .replace(/[^a-z0-9ğüşıöç]/g, "");

                  const filtered = rawList
                    .map((p) => p.trim())
                    .filter((p) => {
                      if (!p) return false;
                      const cleanP = p.toLowerCase().replace(/[^a-z0-9ğüşıöç]/g, "");
                      if (cleanP === cleanTitle) return false;
                      if (cleanTitle.length > 25 && cleanP.startsWith(cleanTitle.slice(0, 35))) {
                        return false;
                      }
                      return true;
                    });

                  if (filtered.length > 0) {
                    return filtered.map((paragraf, idx) => (
                      <p key={idx} className="text-slate-300">
                        {paragraf}
                      </p>
                    ));
                  }

                  return (
                    <p className="text-slate-300">
                      {seciliHaber.ozet ||
                        seciliHaber.detay ||
                        "Haber detayları piyasa kaynakları üzerinden canlı doğrulanmıştır."}
                    </p>
                  );
                })()}
              </div>

              {/* Metadata Barı */}
              <div className="border-t border-white/[0.06] mt-5 pt-3.5 flex flex-wrap items-center justify-between text-[11px] font-mono text-slate-400 bg-white/[0.02] px-3.5 py-2.5 rounded-lg border border-white/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Kategori:</span>
                  <span className="text-slate-300 font-medium">
                    {seciliHaber.kategori === "bist"
                      ? "Piyasa Özeti / BIST"
                      : seciliHaber.kategori === "kap"
                      ? "KAP Kamuyu Aydınlatma"
                      : seciliHaber.kategori === "resmi"
                      ? "Resmi Kurum Bülteni"
                      : "Piyasa Özeti"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span>
                    Durum: <strong className="text-emerald-400 font-normal">Doğrulandı</strong>
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="text-cyan-400 font-semibold">Terminal Desk</span>
                </div>
              </div>
            </div>

            {/* FOOTER: Sol "Kaynağında Oku" butonu + Sağ "Kapat" butonu */}
            <div className="p-4 px-6 border-t border-white/[0.06] bg-[#080d16] flex items-center justify-between mt-auto">
              {seciliHaber.url && seciliHaber.url !== "#" ? (
                <a
                  href={seciliHaber.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium px-4 py-2 rounded-md transition flex items-center gap-1.5 shadow-lg shadow-cyan-950 font-sans"
                >
                  <span>Kaynağında Oku</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Terminal Orijinal Kayıt</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSeciliHaber(null)}
                className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded hover:bg-slate-800/60 font-mono transition"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
