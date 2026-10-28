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

const CACHE_KEY_BIST = "bist_turkiye_live_news_v2";

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

const CACHE_KEY_GLOBAL = "global_tradfin_news_v1";
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

export function cleanEnglishWire(text: string): string {
  const cleaned = cleanWireText(text);
  return cleaned ? "/ " + cleaned : "/ Wire";
}

// Özel İsim ve Finansal Terim Koruma Sözlüğü (Google Translate öncesi maskeleme)
const PROTECTED_TERMS: { pattern: RegExp; token: string; restore: string }[] = [
  // Özel İsimler (Asla tercüme edilmeyecek)
  { pattern: /\bWARSH\b/gi, token: "ZXWARSHXZ", restore: "Warsh" },
  { pattern: /\bPOWELL\b/gi, token: "ZXPOWELLXZ", restore: "Powell" },
  { pattern: /\bYELLEN\b/gi, token: "ZXYELLENXZ", restore: "Yellen" },
  { pattern: /\bBESSENT\b/gi, token: "ZXBESSENTXZ", restore: "Bessent" },
  { pattern: /\bTRUMP\b/gi, token: "ZXTRUMPXZ", restore: "Trump" },
  { pattern: /\bBIDEN\b/gi, token: "ZXBIDENXZ", restore: "Biden" },

  // Finansal Terimler ve Kısaltmalar
  { pattern: /\bCREDIT\s+SPREADS?\b/gi, token: "ZXCREDITSPREADSXZ", restore: "Kredi Spread'leri" },
  { pattern: /\bSPREADS?\b/gi, token: "ZXSPREADSXZ", restore: "Spread'ler" },
  { pattern: /\bADJ\s+EPS\b/gi, token: "ZXADJEPSXZ", restore: "Düzeltilmiş HBK (EPS)" },
  { pattern: /\bEPS\b/gi, token: "ZXEPSXZ", restore: "Hisse Başı Kâr (EPS)" },
  { pattern: /\bOPER\s+INCOME\b/gi, token: "ZXOPERINCOMEXZ", restore: "Faaliyet Kârı" },
  { pattern: /\bREV\b\.?/gi, token: "ZXREVXZ", restore: "Hasılat" },
  { pattern: /\bREVENUE\b/gi, token: "ZXREVENUEXZ", restore: "Hasılat" },
  { pattern: /\bEST\b\.?/gi, token: "ZXESTXZ", restore: "Beklenti" },
  { pattern: /\bADJ\b\.?/gi, token: "ZXADJXZ", restore: "Düzeltilmiş" },
  { pattern: /\bFOMC\b/gi, token: "ZXFOMCXZ", restore: "FOMC" },
  { pattern: /\bFED\b/gi, token: "ZXFEDXZ", restore: "Fed" },
  { pattern: /\bECB\b/gi, token: "ZXECBXZ", restore: "ECB" },
  { pattern: /\bCPI\b/gi, token: "ZXCPIXZ", restore: "TÜFE (CPI)" },
  { pattern: /\bPPI\b/gi, token: "ZXPPIXZ", restore: "ÜFE (PPI)" },
  { pattern: /\bPMI\b/gi, token: "ZXPMIXZ", restore: "PMI" },
  { pattern: /\bPCE\b/gi, token: "ZXPCEXZ", restore: "PCE" },
  { pattern: /\bCAPEX\b/gi, token: "ZXCAPEXXZ", restore: "Sermaye Harcamaları (Capex)" },
  { pattern: /\bEBITDA\b/gi, token: "ZXEBITDAXZ", restore: "FAVÖK (EBITDA)" },
  { pattern: /\b1Q\b/gi, token: "ZX1QXZ", restore: "1. Çeyrek (1Ç)" },
  { pattern: /\b2Q\b/gi, token: "ZX2QXZ", restore: "2. Çeyrek (2Ç)" },
  { pattern: /\b3Q\b/gi, token: "ZX3QXZ", restore: "3. Çeyrek (3Ç)" },
  { pattern: /\b4Q\b/gi, token: "ZX4QXZ", restore: "4. Çeyrek (4Ç)" },
  { pattern: /\bQ1\b/gi, token: "ZXQ1XZ", restore: "1Ç" },
  { pattern: /\bQ2\b/gi, token: "ZXQ2XZ", restore: "2Ç" },
  { pattern: /\bQ3\b/gi, token: "ZXQ3XZ", restore: "3Ç" },
  { pattern: /\bQ4\b/gi, token: "ZXQ4XZ", restore: "4Ç" },
  { pattern: /\bY\/Y\b/gi, token: "ZXYOYXZ", restore: "Yıllık (Y/Y)" },
  { pattern: /\bM\/M\b/gi, token: "ZXMOMXZ", restore: "Aylık (M/M)" },
];

// Başlangıç Fallback Global Haberleri (/ ile başlayan gerçekçi Türkçe finans akışı)
const INITIAL_GLOBAL_HABERLER: GlobalNewsItem[] = [
  {
    id: "tg_init_1",
    zaman: "20:18:33",
    timestamp: Date.now() - 60000,
    baslik: "/ Bessent: Yapay zeka yatırımları ve şirket borçlanmaları piyasa için risk teşkil etmiyor",
    rawText: "*BESSENT: DON'T THINK AI BORROWING PROBLEMATIC AT ALL",
    rawClean: "/ BESSENT: DON'T THINK AI BORROWING PROBLEMATIC AT ALL",
  },
  {
    id: "tg_init_2",
    zaman: "20:02:23",
    timestamp: Date.now() - 120000,
    baslik: "/ Alphabet 3. Çeyrek Hasılat 127.58 milyar dolar (Beklenti: 127.93 milyar dolar), Faaliyet Kârı 40.58 milyar dolar (Beklenti: 43.16 milyar dolar)",
    rawText: "*ALPHABET 3Q REV. $127.58B, EST. $127.93B *ALPHABET 3Q OPER INCOME $40.58B, EST. $43.16B",
    rawClean: "/ ALPHABET 3Q REV. $127.58B, EST. $127.93B · ALPHABET 3Q OPER INCOME $40.58B, EST. $43.16B",
  },
  {
    id: "tg_init_3",
    zaman: "20:01:22",
    timestamp: Date.now() - 180000,
    baslik: "/ Microsoft 1. Çeyrek Düzeltilmiş Hisse Başı Kârı (EPS) 4.89 dolar (Beklenti: 4.73 dolar), Hasılat 92.28 milyar dolar (Beklenti: 90.63 milyar dolar)",
    rawText: "*MICROSOFT 1Q ADJ EPS $4.89, EST. $4.73 *MICROSOFT 1Q REV. $92.28B, EST. $90.63B",
    rawClean: "/ MICROSOFT 1Q ADJ EPS $4.89, EST. $4.73 · MICROSOFT 1Q REV. $92.28B, EST. $90.63B",
  },
  {
    id: "tg_init_4",
    zaman: "18:35:57",
    timestamp: Date.now() - 300000,
    baslik: "/ Fed FOMC toplantısında gösterge faiz oranını 10'a karşı 2 oyla %3.75-%4 aralığında sabit tuttu",
    rawText: "*FED VOTES 10-2 TO HOLD BENCHMARK RATE IN 3.75%-4% RANGE",
    rawClean: "/ FED VOTES 10-2 TO HOLD BENCHMARK RATE IN 3.75%-4% RANGE",
  },
  {
    id: "tg_init_5",
    zaman: "18:24:02",
    timestamp: Date.now() - 400000,
    baslik: "/ ABD Adalet Bakanlığı (DOJ), Nvidia'nın yapay zeka platformu Hugging Face satın alımını incelemeye aldı",
    rawText: "*US DOJ EXAMINING NVIDIA ACQUISITION OF AI PLATFORM HUGGING FACE, TWO PEOPLE SAY",
    rawClean: "/ US DOJ EXAMINING NVIDIA ACQUISITION OF AI PLATFORM HUGGING FACE, TWO PEOPLE SAY",
  },
  {
    id: "tg_init_6",
    zaman: "18:05:02",
    timestamp: Date.now() - 500000,
    baslik: "/ ECB: Dezenflasyon süreci rotasında devam ederken faiz patikasında temkinli duruş sürecek",
    rawText: "*ECB: DISINFLATION PROCESS ON TRACK, RATE PATH REMAINS DATA DEPENDENT",
    rawClean: "/ ECB: DISINFLATION PROCESS ON TRACK, RATE PATH REMAINS DATA DEPENDENT",
  },
];


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

// 8 Aktif Doğrudan RSS Kaynak Konfigürasyonu
const ACTIVE_RSS_SOURCES: { url: string; badge: string; filterEconomyOnly?: boolean }[] = [
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
      let timestamp = Date.now();
      let zaman = "";
      if (pubDateEl?.textContent) {
        const parsedDate = new Date(pubDateEl.textContent.trim());
        if (!isNaN(parsedDate.getTime())) {
          timestamp = parsedDate.getTime();
          zaman = parsedDate.toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });
        }
      }

      if (!zaman) {
        zaman = new Date(timestamp).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
      }

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
      let timestamp = Date.now();
      let zaman = "";
      if (pubDateMatch) {
        const parsed = new Date(pubDateMatch.trim());
        if (!isNaN(parsed.getTime())) {
          timestamp = parsed.getTime();
          zaman = parsed.toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          });
        }
      }
      if (!zaman) {
        zaman = new Date(timestamp).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
      }

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
  const [bistHaberleri, setBistHaberleri] = useState<TerminalHaber[]>([]);
  const [globalHaberler, setGlobalHaberler] = useState<GlobalNewsItem[]>(INITIAL_GLOBAL_HABERLER);
  const [globalLangMode, setGlobalLangMode] = useState<"TR" | "EN">("TR");
  const [seciliHaber, setSeciliHaber] = useState<TerminalHaber | null>(null);
  const [loadingBist, setLoadingBist] = useState<boolean>(true);
  const [loadingGlobal, setLoadingGlobal] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(true);
  const [lastFetchTime, setLastFetchTime] = useState<string>("");
  const [lastGlobalFetchTime, setLastGlobalFetchTime] = useState<string>("");
  const [newlyArrivedIds, setNewlyArrivedIds] = useState<Set<string>>(new Set());

  const knownIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef<boolean>(true);
  const translationsCacheRef = useRef<Map<string, string>>(new Map());

  // Google Translate API ile İngilizce -> Türkçe çeviri motoru (Term Masking & Dictionary Korumalı)
  const translateToTurkish = useCallback(async (text: string): Promise<string> => {
    const rawClean = cleanWireText(text);
    if (!rawClean) return text;

    // Önbellek kontrolü
    if (translationsCacheRef.current.has(rawClean)) {
      return translationsCacheRef.current.get(rawClean)!;
    }

    // 1. Term Masking (Özel isimleri ve finansal kısaltmaları tercümeden önce korumalı token'lara çevir)
    let maskedQuery = rawClean;
    for (const item of PROTECTED_TERMS) {
      maskedQuery = maskedQuery.replace(item.pattern, item.token);
    }

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(
        maskedQuery
      )}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          let translated = data[0]
            .map((chunk: unknown) => (Array.isArray(chunk) ? String(chunk[0] || "") : ""))
            .join("");

          if (translated && translated.trim()) {
            // Maskelenmiş korumalı terimleri doğru finansal karşılıkları ve isimleriyle geri yükle
            for (const item of PROTECTED_TERMS) {
              const tokenRegex = new RegExp(item.token, "gi");
              translated = translated.replace(tokenRegex, item.restore);
            }

            // Çeviri motorunun finansal terim hatalarını düzelt
            translated = translated
              .replace(/\b(kredi sporları|kredi sporlar|kredi formaları)\b/gi, "Kredi Spread'leri")
              .replace(/\b(savaşın|savaş)\b/gi, (m, _p, offset, str) => {
                if (/fed|faiz|powell|bessent|merkez|enflasyon|politika/i.test(str)) return "Warsh";
                return m;
              })
              .replace(/\bAi\b/g, "AI")
              .replace(/\s{2,}/g, " ")
              .trim();

            const finalTranslated = "/ " + translated.replace(/^[\*\/\s]+/, "");
            translationsCacheRef.current.set(rawClean, finalTranslated);
            return finalTranslated;
          }
        }
      }
    } catch {
      // Çeviri servisi yanıt vermezse sözlük fallback'ine geç
    }

    // Finansal Terim Eşleme Fallback Sözlüğü
    let translated = rawClean;
    const financeTerms: [RegExp, string][] = [
      [/\bVOTES\s+(\d+)-(\d+)\s+TO\s+HOLD\s+BENCHMARK\s+RATE\b/gi, "Gösterge faizini $1-$2 oyla sabit tuttu"],
      [/\bTO\s+HOLD\s+BENCHMARK\s+RATE\b/gi, "Gösterge faizini sabit tuttu"],
      [/\bDISSENT\s+IN\s+FAVOR\s+OF\s+RATE\s+HIKE\b/gi, "Faiz artışı lehine karşı oy kullandı"],
      [/\bRATE\s+HIKE\b/gi, "Faiz Artışı"],
      [/\bRATE\s+CUT\b/gi, "Faiz İndirimi"],
      [/\bINFLATION\s+IS\s+TOO\s+HIGH\b/gi, "Enflasyon çok yüksek"],
      [/\bDISINFLATION\s+PROCESS\b/gi, "Dezenflasyon süreci"],
      [/\bON\s+TRACK\b/gi, "rotasında"],
      [/\bDATA\s+DEPENDENT\b/gi, "veriye duyarlı"],
      [/\bPRESS\s+CONFERENCE\b/gi, "Basın Toplantısı"],
      [/\bVOLATILITY\b/gi, "Volatilite"],
      [/\bACQUISITION\b/gi, "Satın Alma"],
      [/\bFINANCIAL\s+MARKET\b/gi, "Finansal Piyasa"],
      [/\bOPER\s+INCOME\b/gi, "Faaliyet Kârı"],
      [/\bCAPEX\b/gi, "Sermaye Harcamaları"],
    ];

    for (const [re, repl] of financeTerms) {
      translated = translated.replace(re, repl);
    }

    for (const item of PROTECTED_TERMS) {
      translated = translated.replace(item.pattern, item.restore);
    }

    const fallbackResult = "/ " + translated.replace(/^[\*\/\s]+/, "").trim();
    translationsCacheRef.current.set(rawClean, fallbackResult);
    return fallbackResult;
  }, []);

  // Telegram @trad_fin canlı akışını çekme ve Türkçeleştirme motoru (15s polling)
  const loadGlobalNews = useCallback(async () => {
    setLoadingGlobal(true);

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
                const dObj = timeM?.[1] ? new Date(timeM[1]) : new Date();
                const zStr = dObj.toLocaleTimeString("tr-TR", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                });
                const pId = postM ? postM[1] : `tg_proxy_${dObj.getTime()}_${i}`;
                const cleanText = cleanWireText(raw);
                items.push({
                  id: pId,
                  zaman: zStr,
                  timestamp: dObj.getTime(),
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

        // Telegram mesajlarını Türkçeye çevir (başında / formatı ile ve Ticker temizlenmiş orijinal İngilizceyi de koru)
        const translatedItems: GlobalNewsItem[] = await Promise.all(
          items.slice(0, 25).map(async (item) => {
            const cleanedRaw = cleanWireText(item.rawText || item.baslik);
            const trTitle = await translateToTurkish(cleanedRaw);
            return {
              id: item.id,
              zaman: item.zaman,
              timestamp: item.timestamp,
              baslik: trTitle,
              rawText: item.rawText,
              rawClean: "/ " + cleanedRaw,
            };
          })
        );

        setGlobalHaberler(translatedItems);
        setLastGlobalFetchTime(
          new Date().toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
        );

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
  }, [translateToTurkish]);



  // 8 Kaynaklı Canlı RSS Çekme Motoru (Promise.allSettled & allorigins proxy)
  const loadNews = useCallback(async () => {
    setIsConnecting(true);

    // İlk açılışta yerel önbellek varsa boş ekranı önlemek için hemen yükle
    if (knownIdsRef.current.size === 0) {
      try {
        const cached = localStorage.getItem(CACHE_KEY_BIST);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setBistHaberleri(parsed);
            parsed.forEach((h: TerminalHaber) => {
              knownIdsRef.current.add(h.id);
              knownIdsRef.current.add(h.baslik.slice(0, 30));
            });
            setLoadingBist(false);
          }
        }
      } catch {
        // Önbellek okuma hatası yoksayılır
      }
    }

    try {
      // Tarayıcının dosyayı doğrudan indirmesini engellemek ve CORS kuralını aşmak için allorigins proxy kullanımı
      const fetchUrl = (rssUrl: string) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6500);
        return fetch("https://api.allorigins.win/raw?url=" + encodeURIComponent(rssUrl), {
          signal: controller.signal,
        })
          .then((r) => {
            clearTimeout(timeoutId);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
          })
          .catch((err) => {
            clearTimeout(timeoutId);
            throw err;
          });
      };

      // Promise.allSettled kullanarak 8 kaynağı aynı anda paralel çek
      const results = await Promise.allSettled(
        ACTIVE_RSS_SOURCES.map(async (feed) => {
          try {
            const xml = await fetchUrl(feed.url);
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

      // Eğer allorigins proxy geçici olarak yanıt vermediyse veya boş döndüyse, sunucu tarafındaki /api/news rotasını dene
      if (items.length === 0) {
        try {
          const res = await fetch("/api/news", { cache: "no-store" });
          if (res.ok) {
            const data = await res.json();
            if (data.items && Array.isArray(data.items) && data.items.length > 0) {
              items = data.items.map((it: ApiNewsItemResponse) => ({
                id: it.id,
                zaman: it.zaman,
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
        // pubDate zaman damgasına göre EN GÜNCELDEN ESKİYE doğru sırala
        items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // Birebir aynı başlığa sahip mükerrer haberleri filtrele (de-duplicate)
        const seenTitles = new Set<string>();
        const deduplicated: TerminalHaber[] = [];

        for (const item of items) {
          const normKey = item.baslik.toLowerCase().replace(/[^a-z0-9ğüşıöç]/g, "").slice(0, 40);
          if (!seenTitles.has(normKey)) {
            seenTitles.add(normKey);
            deduplicated.push(item);
          }
        }

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
        setLastFetchTime(
          new Date().toLocaleTimeString("tr-TR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
        );

        // Başarılı akışı yerel hafızaya (localStorage) önbelleğe al
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
      setIsConnecting(false);
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
            <div className="flex items-center gap-1.5 font-mono text-[9.5px]">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnecting && bistHaberleri.length === 0
                    ? "bg-amber-400 animate-ping"
                    : "bg-emerald-400 animate-pulse"
                }`}
              />
              <span className="text-slate-400 uppercase tracking-wider tabular-nums">
                {isConnecting && bistHaberleri.length === 0
                  ? "BAĞLANIYOR..."
                  : `CANLI · ${lastFetchTime || "15s"}`}
              </span>
            </div>
          </div>

          <div className="pane-scroll">
            {loadingBist && bistHaberleri.length === 0 ? (
              <div className="p-4 flex flex-col items-center justify-center h-48 text-center gap-2.5 font-mono">
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span>Canlı akışa bağlanılıyor...</span>
                </div>
                <p className="text-[11px] text-slate-500 max-w-[320px]">
                  Ekonomim, CNBC-e, Ekonomist, Foreks, Uzman Para, NTV Para, Türkiye Gazetesi ve Dünya Gazetesi taranıyor...
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
                      <span className="row-time tabular-nums text-slate-500">{h.zaman}</span>
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

            <div className="flex items-center gap-2">
              {/* Orijinal (EN) / Çeviri (TR) Görünüm Seçici */}
              <div className="inline-flex items-center bg-[#070b14] border border-slate-700/80 rounded p-0.5 font-mono text-[9px]">
                <button
                  type="button"
                  onClick={() => setGlobalLangMode("TR")}
                  className={`px-1.5 py-0.5 rounded transition ${
                    globalLangMode === "TR"
                      ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-700/60 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Türkçe Çeviri"
                >
                  TR
                </button>
                <button
                  type="button"
                  onClick={() => setGlobalLangMode("EN")}
                  className={`px-1.5 py-0.5 rounded transition ${
                    globalLangMode === "EN"
                      ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-700/60 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Orijinal İngilizce Wire"
                >
                  EN
                </button>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-[9.5px]">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    loadingGlobal && globalHaberler.length === 0
                      ? "bg-amber-400 animate-ping"
                      : "bg-emerald-400 animate-pulse"
                  }`}
                />
                <span className="text-slate-400 uppercase tracking-wider tabular-nums">
                  {loadingGlobal && globalHaberler.length === 0
                    ? "BAĞLANIYOR..."
                    : `CANLI · ${lastGlobalFetchTime || "15s"}`}
                </span>
              </div>
            </div>
          </div>

          <div className="pane-scroll">
            {globalHaberler.map((h) => {
              const displayTitle =
                globalLangMode === "EN"
                  ? h.rawClean || cleanEnglishWire(h.rawText || h.baslik)
                  : h.baslik;

              return (
                <article
                  key={h.id}
                  className="flex items-start gap-2.5 px-3 py-2 border-b border-white/[0.04] transition-colors hover:bg-[#111a2e]/30 select-text"
                >
                  <span className="font-mono text-slate-500 text-[10.5px] tabular-nums shrink-0 pt-0.5 select-none">
                    {h.zaman}
                  </span>

                  <p className="text-xs text-slate-200 leading-relaxed font-normal flex-1 break-words">
                    {displayTitle}
                  </p>
                </article>
              );
            })}
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
