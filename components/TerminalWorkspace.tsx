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
}

const CACHE_KEY_GLOBAL = "global_tradfin_news_v1";
const CACHE_KEY_TRANSLATIONS = "global_translations_cache_v1";

// Başlangıç Fallback Global Haberleri (/ ile başlayan gerçekçi Türkçe finans akışı)
const INITIAL_GLOBAL_HABERLER: GlobalNewsItem[] = [
  {
    id: "tg_init_1",
    zaman: "20:18:33",
    timestamp: Date.now() - 60000,
    baslik: "/ Bessent: Yapay zeka yatırımları ve şirket borçlanmaları piyasa için risk teşkil etmiyor",
    rawText: "*BESSENT: DON'T THINK AI BORROWING PROBLEMATIC AT ALL",
  },
  {
    id: "tg_init_2",
    zaman: "20:02:23",
    timestamp: Date.now() - 120000,
    baslik: "/ Alphabet 3. çeyrek bilançosunu açıkladı: Hasılat 127.58 milyar dolar, faaliyet kârı 40.58 milyar dolar",
    rawText: "*ALPHABET 3Q REV. $127.58B, EST. $127.93B *ALPHABET 3Q OPER INCOME $40.58B, EST. $43.16B $GOOGL",
  },
  {
    id: "tg_init_3",
    zaman: "20:01:22",
    timestamp: Date.now() - 180000,
    baslik: "/ Microsoft 1. çeyrek düzeltilmiş hisse başı kârı 4.89 dolar (Beklenti: 4.73 dolar), gelir 92.28 milyar dolar",
    rawText: "*MICROSOFT 1Q ADJ EPS $4.89, EST. $4.73 *MICROSOFT 1Q REV. $92.28B, EST. $90.63B $MSFT",
  },
  {
    id: "tg_init_4",
    zaman: "18:35:57",
    timestamp: Date.now() - 300000,
    baslik: "/ Fed FOMC toplantısında gösterge faiz oranını 10'a karşı 2 oyla %3.75-%4 aralığında sabit tuttu",
    rawText: "*FED VOTES 10-2 TO HOLD BENCHMARK RATE IN 3.75%-4% RANGE",
  },
  {
    id: "tg_init_5",
    zaman: "18:24:02",
    timestamp: Date.now() - 400000,
    baslik: "/ ABD Adalet Bakanlığı (DOJ), Nvidia'nın yapay zeka platformu Hugging Face satın alımını incelemeye aldı",
    rawText: "*US DOJ EXAMINING NVIDIA ACQUISITION OF AI PLATFORM HUGGING FACE, TWO PEOPLE SAY $NVDA",
  },
  {
    id: "tg_init_6",
    zaman: "18:05:02",
    timestamp: Date.now() - 500000,
    baslik: "/ ECB: Hizmet sektörü enflasyonunda yavaşlama eğilimi belirginleşirken faiz patikasında temkinli duruş sürecek",
    rawText: "*ECB: DISINFLATION PROCESS ON TRACK, RATE PATH REMAINS DATA DEPENDENT",
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

export default function TerminalWorkspace() {
  const [bistHaberleri, setBistHaberleri] = useState<TerminalHaber[]>([]);
  const [globalHaberler, setGlobalHaberler] = useState<GlobalNewsItem[]>(INITIAL_GLOBAL_HABERLER);
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

  // Google Translate API ile İngilizce -> Türkçe çeviri motoru (gtx endpoint)
  const translateToTurkish = useCallback(async (text: string): Promise<string> => {
    const rawClean = text.trim();
    if (!rawClean) return text;

    // Önbellek kontrolü
    if (translationsCacheRef.current.has(rawClean)) {
      return translationsCacheRef.current.get(rawClean)!;
    }

    // Başındaki * veya / işaretlerini çeviri sorgusu için ayıkla
    let cleanForQuery = rawClean
      .replace(/^[\*\/\s]+/, "")
      .replace(/\s+\*\s*/g, " ")
      .trim();

    // Ticker sembollerini koru ($NVDA -> NVDA)
    cleanForQuery = cleanForQuery.replace(/\$([A-Za-z0-9_]+)/g, "$1");

    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(
        cleanForQuery
      )}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && Array.isArray(data[0])) {
          const translatedChunks = data[0]
            .map((chunk: unknown) => (Array.isArray(chunk) ? String(chunk[0] || "") : ""))
            .join("");
          if (translatedChunks && translatedChunks.trim()) {
            const finalTranslated = "/ " + translatedChunks.trim().replace(/^[\*\/\s]+/, "");
            translationsCacheRef.current.set(rawClean, finalTranslated);
            return finalTranslated;
          }
        }
      }
    } catch {
      // Çeviri servisi yanıt vermezse sözlük fallback'ine geç
    }

    // Finansal Terim Eşleme Fallback Sözlüğü
    let translated = cleanForQuery;
    const financeTerms: [RegExp, string][] = [
      [/\bVOTES\s+(\d+)-(\d+)\s+TO\s+HOLD\s+BENCHMARK\s+RATE\b/gi, "Gösterge faizini $1-$2 oyla sabit tuttu"],
      [/\bTO\s+HOLD\s+BENCHMARK\s+RATE\b/gi, "Gösterge faizini sabit tuttu"],
      [/\bDISSENT\s+IN\s+FAVOR\s+OF\s+RATE\s+HIKE\b/gi, "Faiz artışı lehine karşı oy kullandı"],
      [/\bRATE\s+HIKE\b/gi, "Faiz Artışı"],
      [/\bRATE\s+CUT\b/gi, "Faiz İndirimi"],
      [/\bINFLATION\s+IS\s+TOO\s+HIGH\b/gi, "Enflasyon çok yüksek"],
      [/\bDISINFLATION\s+PROCESS\b/gi, "Dezenflasyon süreci"],
      [/\bPRESS\s+CONFERENCE\b/gi, "Basın Toplantısı"],
      [/\bVOLATILITY\b/gi, "Volatilite"],
      [/\bACQUISITION\b/gi, "Satın Alma"],
      [/\bFINANCIAL\s+MARKET\b/gi, "Finansal Piyasa"],
      [/\bADJ\s+EPS\b/gi, "Düzeltilmiş Hisse Başı Kâr"],
      [/\bOPER\s+INCOME\b/gi, "Faaliyet Kârı"],
      [/\bREV\.\b/gi, "Hasılat"],
      [/\bREVENUE\b/gi, "Hasılat"],
      [/\bCAPEX\b/gi, "Sermaye Harcamaları"],
    ];

    for (const [re, repl] of financeTerms) {
      translated = translated.replace(re, repl);
    }

    const fallbackResult = "/ " + translated;
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
                items.push({
                  id: pId,
                  zaman: zStr,
                  timestamp: dObj.getTime(),
                  rawText: raw,
                  baslik: raw.startsWith("*") ? "/ " + raw.slice(1).trim() : "/ " + raw,
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

        // Telegram mesajlarını Türkçeye çevir (başında / formatı ile)
        const translatedItems: GlobalNewsItem[] = await Promise.all(
          items.slice(0, 25).map(async (item) => {
            const trTitle = await translateToTurkish(item.rawText || item.baslik);
            return {
              id: item.id,
              zaman: item.zaman,
              timestamp: item.timestamp,
              baslik: trTitle,
              rawText: item.rawText,
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

  // Canlı RSS Çekme Motoru (Bloomberg HT, AA Finans, Bigpara, Ekonomim)
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
      let items: ApiNewsItemResponse[] = [];

      // 1. Birincil Canlı İstek (Next.js server-side RSS motoru)
      try {
        const res = await fetch("/api/news", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            items = data.items;
          }
        }
      } catch {
        // Sunucu rotası geçici olarak yanıt vermezse ikincil adıma geç
      }

      // 2. İkincil İstemci Tarafı RSS / CORS Proxy Fallback (Eğer birincil rota boşsa)
      if (items.length === 0) {
        try {
          const googleNewsUrl =
            "https://news.google.com/rss/search?q=(site:ekonomim.com+OR+site:cnbce.com+OR+site:ekonomist.com.tr+OR+site:ekoturk.com+OR+site:foreks.com)+when:1d&hl=tr&gl=TR&ceid=TR:tr";
          const proxyUrl =
            "https://api.allorigins.win/raw?url=" + encodeURIComponent(googleNewsUrl);

          const proxyRes = await fetch(proxyUrl);
          if (proxyRes.ok) {
            const xml = await proxyRes.text();
            const chunks = xml.split("<item>").slice(1, 30);
            for (const chunk of chunks) {
              const rawTitle = chunk.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
              const rawLink =
                chunk.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ||
                chunk.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1];
              const rawSource = chunk.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1];
              const rawSourceUrl = chunk.match(/<source[^>]*url="([^"]*)"/i)?.[1];
              const rawPubDate = chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1];
              const rawDesc = chunk.match(/<description>([\s\S]*?)<\/description>/i)?.[1];

              if (rawTitle) {
                // Başlık temizliği (son ek kaynak ismini kaldır)
                let title = rawTitle
                  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
                  .replace(/&quot;/g, '"')
                  .replace(/&#039;/g, "'")
                  .replace(/&amp;/g, "&")
                  .trim();
                const parts = title.split(/\s+[-–—]\s+/);
                if (parts.length > 1) {
                  const last = parts[parts.length - 1].trim();
                  if (
                    /^(CNBC-e|Ekonomim|Foreks|Foreks\.com|Ekonomist|Ekotürk|Ekoturk|Bloomberg|AA)/i.test(
                      last
                    ) ||
                    last.length <= 25
                  ) {
                    parts.pop();
                    title = parts.join(" - ").trim();
                  }
                }

                // Rozet kaynak isimlendirme
                const s = (rawSource || "").toLowerCase();
                const u = (rawSourceUrl || rawLink || "").toLowerCase();
                let kaynak = "FİNANS";
                if (s.includes("cnbc") || u.includes("cnbce.com")) kaynak = "CNBC-E";
                else if (s.includes("ekonomim") || u.includes("ekonomim.com")) kaynak = "EKONOMİM";
                else if (s.includes("foreks") || u.includes("foreks.com")) kaynak = "FOREKS";
                else if (s.includes("ekonomist") || u.includes("ekonomist.com.tr")) kaynak = "EKONOMİST";
                else if (s.includes("ekotürk") || s.includes("ekoturk") || u.includes("ekoturk.com")) kaynak = "EKOTÜRK";
                else if (rawSource) kaynak = rawSource.toUpperCase().replace(/\.COM(\.TR)?/g, "");

                const pDate = rawPubDate ? new Date(rawPubDate) : new Date();
                const descClean = (rawDesc || "")
                  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
                  .replace(/<[^>]+>/g, " ")
                  .trim();

                items.push({
                  id: `proxy_gnews_${pDate.getTime()}_${title.slice(0, 15)}`,
                  zaman: pDate.toLocaleTimeString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  }),
                  tarih: pDate.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
                  kaynak,
                  baslik: title,
                  ozet: title,
                  paragraflar: [
                    descClean.length > 20
                      ? descClean
                      : `${kaynak} kaynaklı son finans haberi: "${title}".`,
                    "Piyasa analistleri gelişmenin BIST hisseleri ve makro veriler üzerindeki etkilerini izliyor.",
                  ],
                  url: rawLink || "https://news.google.com",
                  timestamp: pDate.getTime(),
                });
              }
            }
          }
        } catch {
          // İkincil proxy de erişilemedi
        }
      }

      if (items.length > 0) {
        // Dönüştür ve yayınlanma saatini kullanıcının yerel saatine göre dinamik formatla (HH:mm:ss)
        const donusturulen: TerminalHaber[] = items.map((item) => {
          let yerelZaman = item.zaman;
          if (item.timestamp && !isNaN(item.timestamp)) {
            const d = new Date(item.timestamp);
            yerelZaman = d.toLocaleTimeString("tr-TR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
              hour12: false,
            });
          }

          return {
            id: item.id,
            zaman: yerelZaman,
            tarih: item.tarih || "Bugün",
            kaynak: item.kaynak,
            baslik: item.baslik,
            ozet: item.ozet,
            paragraflar: item.paragraflar,
            detay:
              item.paragraflar && item.paragraflar.length > 0
                ? item.paragraflar.join("\n\n")
                : item.detay || item.ozet || item.baslik,
            url: item.url || "#",
            kategori: "bist" as const,
            timestamp: item.timestamp,
          };
        });

        // Yayınlanma tarihine göre (pubDate / timestamp) EN YENİDEN EN ESKİYE doğru sırala
        donusturulen.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        // Yeni haber tespiti (İlk yükleme sonrasında yeni düşen haberler için parlama/fade)
        if (!isInitialLoadRef.current) {
          const yeniGelenler = donusturulen.filter(
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
        donusturulen.forEach((h) => {
          knownIdsRef.current.add(h.id);
          knownIdsRef.current.add(h.baslik.slice(0, 30));
        });

        isInitialLoadRef.current = false;
        setBistHaberleri(donusturulen);
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
          localStorage.setItem(CACHE_KEY_BIST, JSON.stringify(donusturulen));
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

  // 10 saniyede bir BIST & Türkiye arka planda sessizce sorgula (polling)
  useEffect(() => {
    // İlk sorguyu asenkron olarak tetikle (efekt içi senkron setState uyarısını önler)
    const initialTimer = setTimeout(() => {
      void loadNews();
    }, 0);

    // Her 10 saniyede bir periyodik canlı polling
    const interval = setInterval(() => {
      void loadNews();
    }, 10000);

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
                  : `CANLI · ${lastFetchTime || "10s"}`}
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
                <p className="text-[11px] text-slate-500 max-w-[280px]">
                  Ekonomim, CNBC-e, Foreks, Ekonomist ve Ekotürk canlı akışı taranıyor...
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

          <div className="pane-scroll">
            {globalHaberler.map((h) => (
              <article
                key={h.id}
                className="flex items-start gap-2.5 px-3 py-2 border-b border-white/[0.04] transition-colors hover:bg-[#111a2e]/30 select-text"
              >
                <span className="font-mono text-slate-500 text-[10.5px] tabular-nums shrink-0 pt-0.5 select-none">
                  {h.zaman}
                </span>

                <p className="text-xs text-slate-200 leading-relaxed font-normal flex-1 break-words">
                  {h.baslik}
                </p>
              </article>
            ))}
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

      {/* ŞIK ENDÜSTRİYEL HABER DETAY KARTI (MODAL / DIALOG POPUP) */}
      {seciliHaber && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setSeciliHaber(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-[#0c1322] border border-slate-700/80 rounded-lg shadow-2xl p-6 backdrop-blur-md max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ÜST KISIM: Kaynak adı, yayınlanma saati ve kapatma butonu */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 font-mono text-xs">
                <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-cyan-400 font-semibold tracking-wide uppercase">
                  [{seciliHaber.kaynak}]
                </span>
                <span className="text-slate-400 tabular-nums">
                  {seciliHaber.zaman} {seciliHaber.tarih ? `· ${seciliHaber.tarih}` : ""}
                </span>
                {seciliHaber.hisseler && seciliHaber.hisseler.length > 0 && (
                  <span className="text-cyan-400 font-bold ml-1">
                    {seciliHaber.hisseler.join(", ")}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500 hidden sm:inline-block">
                  [ESC]
                </span>
                <button
                  onClick={() => setSeciliHaber(null)}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
                  type="button"
                  aria-label="Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* BAŞLIK: Büyük puntolu net haber başlığı */}
            <h2 className="text-lg font-bold text-white mt-4 mb-3 leading-snug">
              {seciliHaber.baslik}
            </h2>

            {/* GÖVDE: Haber makalesinin tam metninden ayıklanmış ilk 2 paragrafı */}
            <div className="text-sm text-slate-300 leading-relaxed space-y-2.5 overflow-y-auto pr-1 flex-1 my-2">
              {seciliHaber.paragraflar && seciliHaber.paragraflar.length > 0 ? (
                seciliHaber.paragraflar.slice(0, 2).map((paragraf, idx) => (
                  <p key={idx} className="text-slate-300">
                    {paragraf}
                  </p>
                ))
              ) : seciliHaber.detay ? (
                seciliHaber.detay.split("\n\n").slice(0, 2).map((paragraf, idx) => (
                  <p key={idx} className="text-slate-300">
                    {paragraf}
                  </p>
                ))
              ) : (
                <p className="text-slate-400 italic">
                  Haber içeriği detayları hazırlanıyor.
                </p>
              )}
            </div>

            {/* ALT BAR: "Daha Fazlasını Oku" butonu / linki + Kapat butonu */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between mt-auto">
              {seciliHaber.url && seciliHaber.url !== "#" ? (
                <a
                  href={seciliHaber.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-cyan-950/60 border border-cyan-700/60 text-cyan-300 hover:bg-cyan-900/60 hover:text-cyan-200 transition"
                >
                  <span>Daha Fazlasını Oku</span>
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
                className="px-3 py-1.5 rounded bg-slate-800/80 hover:bg-slate-700/80 text-xs font-mono text-slate-300 hover:text-white transition border border-slate-700/60"
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
