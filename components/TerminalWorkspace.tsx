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

const CACHE_KEY_GLOBAL = "bpt_global_news_v2";
const CACHE_KEY_TRANSLATIONS = "global_translations_cache_v2";

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
  let clean = text.replace(/^[\s\*\/\-]+/, "").trim();
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

// ============================================================================
// KAP BİLDİRİMLERİ: SAAT KİLİTLEME & ÇOKLU KAYNAK MOTORU (SIFIR Date.now() HATASI)
// ============================================================================

export interface KapItem {
  id: number;
  code: string;
  type: string;
  title: string;
  subject: string;
  summary: string;
  time: string;
  timestamp: number;
  kapUrl: string;
}

const CACHE_KEY_KAP_V4 = "bpt_kap_disclosures_v4";
const CACHE_KEY_KAP_DATE = "bpt_kap_last_date";

export const DISCLOSURE_TYPE_NAMES: Record<string, string> = {
  FR: "Finansal Rapor",
  ÖDA: "Özel Durum Açıklaması (Genel)",
  ODA: "Özel Durum Açıklaması (Genel)",
  DKB: "Düzenleyici Kurum Bildirimi",
  DG: "Duyuru / Diğer",
  GKK: "Genel Kurul İşlemleri",
  PGO: "Pay Alım Satım / Geri Alım",
  SÖZ: "Yeni İş İlişkisi / Sözleşme",
  SOZ: "Yeni İş İlişkisi / Sözleşme",
  İHR: "Sermaye / Borçlanma Aracı İhracı",
  IHR: "Sermaye / Borçlanma Aracı İhracı",
};

// Şirket unvanından BIST hisse kodunu çıkaran veya türeten akıllı eşleştirici
export function resolveBistTicker(companyTitle?: string, rawCode?: string): string {
  if (rawCode && typeof rawCode === "string") {
    const clean = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean && clean !== "KAP" && clean !== "BIST" && clean !== "NULL" && clean !== "UNDEFINED" && clean.length >= 2) {
      return clean;
    }
  }

  if (!companyTitle || typeof companyTitle !== "string") return "BIST";

  const norm = companyTitle
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .trim();

  // Bilinen şirket eşleştirmeleri
  const KNOWN_TICKERS: [RegExp, string][] = [
    [/FORMUL\s+PLASTIK/i, "FRMPL"],
    [/VAKIF\s+GAYRIMENKUL|VAKIF\s+GYO/i, "VKGYO"],
    [/NET\s+VARLIK/i, "NTVRK"],
    [/TURK\s+HAVA\s+YOLLARI|THY/i, "THYAO"],
    [/TURKIYE\s+IS\s+BANKASI|IS\s+BANKASI/i, "ISCTR"],
    [/GARANTI\s+BANKASI|GARANTI\s+BBVA/i, "GARAN"],
    [/AKBANK/i, "AKBNK"],
    [/YAPI\s+VE\s+KREDI|YAPI\s+KREDI/i, "YKBNK"],
    [/HALK\s+BANKASI|HALKBANK/i, "HALKB"],
    [/VAKIFLAR\s+BANKASI|VAKIFBANK/i, "VAKBN"],
    [/TUPRAS|TURKIYE\s+PETROL\s+RAFINERILERI/i, "TUPRS"],
    [/EREGLI\s+DEMIR|ERDEMIR/i, "EREGL"],
    [/KARDEMIR/i, "KRDMD"],
    [/TURKIYE\s+SISE|SISECAM/i, "SISE"],
    [/BIM\s+BIRLESIK|BIM\s+MAGAZA/i, "BIMAS"],
    [/MIGROS/i, "MGROS"],
    [/SOK\s+MARKET/i, "SOKM"],
    [/ASELSAN/i, "ASELS"],
    [/KOC\s+HOLDING/i, "KCHOL"],
    [/SABANCI\s+HOLDING/i, "SAHOL"],
    [/ENKA\s+INSAAT/i, "ENKAI"],
    [/TURK\s+TELEKOM/i, "TTKOM"],
    [/TURKCELL/i, "TCELL"],
    [/FORD\s+OTOMOTIV|FORD\s+OTOSAN/i, "FROTO"],
    [/TOFAS/i, "TOASO"],
    [/ARCELIK/i, "ARCLK"],
    [/VESTEL\s+BEYAZ/i, "VESBE"],
    [/VESTEL/i, "VESTL"],
    [/PEGASUS/i, "PGSUS"],
    [/TAV\s+HAVALIMAN/i, "TAVHL"],
    [/PETKIM/i, "PETKM"],
    [/KOZA\s+ALTIN/i, "KOZAL"],
    [/KOZA\s+ANADOLU/i, "KOZAA"],
    [/IPEK\s+DOGAL/i, "IPEKE"],
    [/GUBRE\s+FABRIK/i, "GUBRF"],
    [/HEKTAS/i, "HEKTS"],
    [/SASA\s+POLYESTER|SASA/i, "SASA"],
    [/KONTROLMATIK/i, "KONTR"],
    [/ASTOR\s+ENERJI/i, "ASTOR"],
    [/CANTE|CAN\s+KOMUR/i, "CANTE"],
    [/ODAS\s+ELEKTRIK/i, "ODAS"],
    [/ZORLU\s+ENERJI/i, "ZOREN"],
    [/ENERJISA/i, "ENJSA"],
    [/AKSA\s+ENERJI/i, "AKSEN"],
    [/AKSA\s+AKRILIK/i, "AKSA"],
    [/OYAK\s+CIMENTO/i, "OYAKC"],
    [/CIMSA/i, "CIMSA"],
    [/ALARKO\s+HOLDING|ALARKO/i, "ALARK"],
    [/BERA\s+HOLDING/i, "BERA"],
    [/TEKFEN/i, "TKFEN"],
    [/EMLAK\s+KONUT|EKGYO/i, "EKGYO"],
    [/TORUNLAR\s+GYO/i, "TRGYO"],
    [/IS\s+GYO/i, "ISGYO"],
    [/REYSAS\s+GYO/i, "RYGYO"],
    [/TAB\s+GIDA/i, "TABGD"],
    [/KUZEY\s+BORU/i, "KBORU"],
    [/MEGA\s+METAL/i, "MEGMT"],
    [/KALEKIM/i, "KLKIM"],
    [/EBEBEK/i, "EBEBK"],
    [/REEDER/i, "REEDR"],
    [/BORLIS/i, "BORLS"],
    [/BATI\s+EGE/i, "BEGYO"],
    [/SUR\s+TATIL/i, "SURGY"],
    [/CATES\s+ELEKTRIK/i, "CATES"],
    [/TARKIM/i, "TARKM"],
    [/GIPTA/i, "GIPTA"],
    [/HAT-SAN|HATSAN/i, "HATSN"],
    [/ADRA\s+GYO/i, "ADGYO"],
    [/MHR\s+GYO/i, "MHRGY"],
    [/VERA\s+KONSEPT/i, "VRGYO"],
  ];

  for (const [regex, ticker] of KNOWN_TICKERS) {
    if (regex.test(norm)) return ticker;
  }

  // Dinamik BIST Kısaltma Üretimi:
  const cleanedTitle = norm
    .replace(/\b(A\.S|A\.S\.|AS|ANONIM|SIRKETI|SIRKETLERI|SANAYI|TICARET|VE|HOLDING|YATIRIM|ORTAKLIGI|LTD|STI)\b/g, "")
    .replace(/[^A-Z\s]/g, "")
    .trim();

  const words = cleanedTitle.split(/\s+/).filter((w) => w.length >= 2);

  if (words.length >= 2) {
    const w1 = words[0];
    const w2 = words[1];
    const c1 = w1.replace(/[AEIOU]/g, "");
    const c2 = w2.replace(/[AEIOU]/g, "");
    const prefix1 = c1.length >= 3 ? c1.slice(0, 3) : w1.slice(0, 3);
    const prefix2 = c2.length >= 2 ? c2.slice(0, 2) : w2.slice(0, 2);
    const candidate = (prefix1 + prefix2).slice(0, 5);
    if (candidate.length >= 4) return candidate;
  }

  if (words.length === 1) {
    const w = words[0];
    if (w.length >= 4 && w.length <= 5) return w;
    const c = w.replace(/[AEIOU]/g, "");
    if (c.length >= 4) return c.slice(0, 5);
    return w.slice(0, 5);
  }

  return "BIST";
}

// Konu şirket unvanıyla aynıysa anlamlı bildirim konusunu çözer
export function getCleanKapSubject(
  subject: string,
  companyTitle: string,
  type: string,
  summary?: string
): string {
  const normSub = (subject || "").trim();
  const normComp = (companyTitle || "").trim();

  const isGenericOrDuplicate =
    !normSub ||
    normSub.toLowerCase() === normComp.toLowerCase() ||
    normSub.toLowerCase() === "özel durum açıklaması" ||
    normSub.toLowerCase() === "kap bildirimi";

  if (isGenericOrDuplicate) {
    if (summary && summary.trim() && summary.toLowerCase() !== normComp.toLowerCase()) {
      return summary.trim();
    }
    const mapped = DISCLOSURE_TYPE_NAMES[type.toUpperCase()] || "Özel Durum Açıklaması";
    return mapped;
  }

  return normSub;
}

// 1. SAAT KİLİTLEME YARDIMCI FONKSİYONU
export const extractFixedKapTime = (rawDateStr: unknown): string => {
  if (!rawDateStr) return "--:--";
  const str = String(rawDateStr).trim();
  const timeMatch = str.match(/\b([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?\b/);
  if (timeMatch) {
    return timeMatch[3]
      ? `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`
      : `${timeMatch[1]}:${timeMatch[2]}:00`;
  }
  return "--:--";
};

// Gelecek Saat Kontrolü ile Dünkü Veriyi Kesin Eleme Filtresi
export const isStrictlyTodayKap = (rawDateStr: unknown, extractedTime: string): boolean => {
  const now = new Date();
  const trNowStr = now.toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  if (rawDateStr) {
    const str = String(rawDateStr).trim().toLowerCase();
    if (str.includes("dün") || str.includes("yesterday")) return false;

    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = String(now.getFullYear());

    // İçinde tarih formatı varsa bugünün tarihiyle eşleşmek zorunda
    if (/\d{2}[\.\/\-]\d{2}[\.\/\-]\d{4}|\d{4}-\d{2}-\d{2}/.test(str)) {
      const isTodayMatch =
        str.includes(`${dd}.${mm}.${yyyy}`) ||
        str.includes(`${yyyy}-${mm}-${dd}`) ||
        str.includes(`${dd}/${mm}/${yyyy}`);
      if (!isTodayMatch) return false;
    }
  }

  // Eğer bildirim saati şu anki Türkiye saatinden ilerideyse (örn: dün 22:46, şu an 18:07), kesinlikle dünün bildirimidir!
  if (extractedTime && extractedTime !== "--:--" && extractedTime > trNowStr) {
    return false;
  }

  return true;
};

export const isTodayKap = (timestampOrDate: unknown): boolean => {
  if (!timestampOrDate) return false;
  const time = extractFixedKapTime(timestampOrDate);
  return isStrictlyTodayKap(timestampOrDate, time);
};

export const checkAndResetKapDailyCache = (): void => {
  if (typeof window === "undefined") return;
  try {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const lastDate = localStorage.getItem(CACHE_KEY_KAP_DATE);

    if (lastDate !== todayStr) {
      localStorage.removeItem("bpt_kap_cache");
      localStorage.removeItem("bpt_kap_disclosures");
      localStorage.removeItem("bpt_kap_disclosures_v3");
      localStorage.removeItem(CACHE_KEY_KAP_V4);
      localStorage.setItem(CACHE_KEY_KAP_DATE, todayStr);
    }
  } catch {
    // ignore
  }
};

export const parseKapItems = (data: unknown[]): KapItem[] => {
  if (!Array.isArray(data)) return [];

  const results: KapItem[] = [];

  data.slice(0, 40).forEach((rawItem) => {
    if (!rawItem || typeof rawItem !== "object") return;
    const obj = rawItem as Record<string, unknown>;
    const basic = (obj.basic as Record<string, unknown>) || obj;

    const rawId = basic.disclosureIndex || basic.disclosureId || basic.id || basic.kapId;
    const numId = Number(String(rawId || "").replace(/\D/g, ""));
    if (!numId || numId < 1000) return;

    const rawTime =
      basic.time ||
      basic.saat ||
      basic.publishDate ||
      basic.disclosureTime ||
      basic.tarih ||
      "";

    const timestamp =
      typeof basic.timestamp === "number" && basic.timestamp > 10000000000
        ? basic.timestamp
        : basic.publishDate
        ? new Date(String(basic.publishDate)).getTime()
        : 0;

    const fixedTime = extractFixedKapTime(rawTime);

    // Sadece bugünün bildirimlerini kabul et (dünden kalan saatler kesinlikle elenir)
    const isItemToday = isStrictlyTodayKap(rawTime || timestamp, fixedTime);
    if (!isItemToday) return;

    // 1. stockCodes, stockCode, relatedStocks, hisseKodu, kod, memberCode alanlarını kontrol et
    const rawStockCandidate =
      basic.stockCodes ||
      basic.stockCode ||
      basic.relatedStocks ||
      basic.hisseKodu ||
      basic.kod ||
      basic.memberCode ||
      basic.code ||
      "";

    let extractedCode = "";
    if (Array.isArray(rawStockCandidate)) {
      extractedCode = rawStockCandidate[0] ? String(rawStockCandidate[0]).trim().toUpperCase() : "";
    } else if (typeof rawStockCandidate === "string") {
      extractedCode = rawStockCandidate.split(",")[0].trim().toUpperCase();
    }

    const rawCompany = String(
      basic.companyTitle || basic.companyName || basic.sirketAdi || basic.title || ""
    ).trim();

    const cleanCompany =
      rawCompany
        .replace(/\*\*\*([A-Z0-9_]+)\*\*\*/gi, "")
        .replace(/\([^)]*\)/g, "")
        .trim() || rawCompany || "Şirket";

    // Eğer kod bulunamadıysa veya generic (KAP, BIST, NULL) ise
    if (!extractedCode || extractedCode === "KAP" || extractedCode === "BIST" || extractedCode === "NULL") {
      const searchStr = `${basic.title || ""} ${basic.subject || ""} ${rawCompany} ${basic.summary || ""}`;
      const starMatch = searchStr.match(/\*\*\*([A-Z0-9_]{2,8})\*\*\*/i);
      const bracketMatch = searchStr.match(/\[([A-Z0-9_]{2,8})\]/i);
      const parenMatch = searchStr.match(/\(([A-Z]{3,6})\)/i);

      if (starMatch && !["KAP", "BIST"].includes(starMatch[1].toUpperCase())) {
        extractedCode = starMatch[1].toUpperCase();
      } else if (bracketMatch && !["KAP", "BIST"].includes(bracketMatch[1].toUpperCase())) {
        extractedCode = bracketMatch[1].toUpperCase();
      } else if (parenMatch && !["KAP", "BIST"].includes(parenMatch[1].toUpperCase())) {
        extractedCode = parenMatch[1].toUpperCase();
      } else {
        extractedCode = resolveBistTicker(rawCompany || searchStr, extractedCode);
      }
    }

    // Asla sabit "KAP" yazma
    if (!extractedCode || extractedCode === "KAP") {
      extractedCode = resolveBistTicker(cleanCompany);
    }

    const rawType = String(
      basic.disclosureClass || basic.disclosureType || basic.tur || basic.type || "ÖDA"
    ).toUpperCase();
    const cleanType = rawType.length <= 4 ? rawType : "ÖDA";

    const rawSubject = String(
      basic.subject || basic.disclosureTitle || basic.baslik || basic.title || ""
    ).trim();
    const cleanSubject = rawSubject.replace(/\*\*\*([A-Z0-9_]+)\*\*\*/gi, "").trim();

    const resolvedSubject = getCleanKapSubject(
      cleanSubject,
      cleanCompany,
      cleanType,
      String(basic.summary || basic.ozet || "")
    );

    results.push({
      id: numId,
      code: extractedCode,
      type: cleanType,
      title: cleanCompany,
      subject: resolvedSubject,
      summary: String(basic.summary || basic.ozet || resolvedSubject || "").trim(),
      time: fixedTime,
      timestamp: timestamp || numId,
      kapUrl: `https://www.kap.org.tr/tr/Bildirim/${numId}`,
    });
  });

  return results.sort((a, b) => b.id - a.id);
};

// 2. YENİ KAP BİLDİRİMLERİNİ ÇEKEN ÇOKLU MOTOR (WAF/CACHE ENGELİNİ AŞAR):
export const fetchLiveKapFeed = async (): Promise<KapItem[]> => {
  checkAndResetKapDailyCache();
  const bust = Date.now();

  const proxies = [
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url: string) => `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  ];

  // ADIM 0: Varsa sunucu tarafı dahili API (/api/kap-disclosures)
  try {
    const internalRes = await fetch(`/api/kap-disclosures?_t=${bust}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    if (internalRes.ok) {
      const internalJson = await internalRes.json();
      const rawArr = Array.isArray(internalJson) ? internalJson : internalJson?.data;
      if (Array.isArray(rawArr) && rawArr.length > 0) {
        const parsed = parseKapItems(rawArr);
        if (parsed.length > 0) return parsed;
      }
    }
  } catch {
    // Dahili rota yoksa veya hata verdiyse dış kaynaklara geç
  }

  // KAYNAK 1: KAP Resmi Bildirim Servisi (Paralel Proxy Yarışı)
  try {
    const rawData = await Promise.any(
      proxies.map(async (makeProxy) => {
        const res = await fetch(makeProxy(`https://www.kap.org.tr/tr/api/disclosures?_t=${bust}`), {
          signal: AbortSignal.timeout(4500),
        });
        if (!res.ok) throw new Error("Proxy failed");
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) return data;
        throw new Error("Invalid KAP data");
      })
    );
    if (rawData) {
      const parsed = parseKapItems(rawData);
      if (parsed.length > 0) return parsed;
    }
  } catch {
    // Sonraki kaynağa geç
  }

  // KAYNAK 2: Mynet Finans Canlı KAP JSON Servisi (Paralel Proxy Yarışı)
  try {
    const rawList = await Promise.any(
      proxies.map(async (makeProxy) => {
        const res = await fetch(makeProxy(`https://finans.mynet.com/api/kap/haberler?_t=${bust}`), {
          signal: AbortSignal.timeout(4500),
        });
        if (!res.ok) throw new Error("Proxy failed");
        const json = await res.json();
        const list = Array.isArray(json) ? json : json?.data || [];
        if (Array.isArray(list) && list.length > 0) return list;
        throw new Error("Invalid Mynet data");
      })
    );
    if (rawList) {
      const parsed = parseKapItems(rawList);
      if (parsed.length > 0) return parsed;
    }
  } catch {
    // Sonraki kaynağa geç
  }

  // KAYNAK 3: Bigpara Canlı KAP Haberleri (Paralel Proxy Yarışı)
  if (typeof window !== "undefined") {
    try {
      const html = await Promise.any(
        proxies.map(async (makeProxy) => {
          const res = await fetch(
            makeProxy(`https://bigpara.hurriyet.com.tr/haberler/kap-haberleri/?_t=${bust}`),
            { signal: AbortSignal.timeout(4500) }
          );
          if (!res.ok) throw new Error("Proxy failed");
          const text = await res.text();
          if (text && text.includes("news-card__title")) return text;
          throw new Error("Invalid Bigpara HTML");
        })
      );

      if (html) {
        const reg = /<a[^>]+class="news-card__title"[^>]+href="([^"]*_ID(\d+)\/)"[^>]*>([\s\S]*?)<\/a>/gi;
        let m;
        const parsed: KapItem[] = [];

        while ((m = reg.exec(html)) !== null && parsed.length < 25) {
          const bigparaId = m[2];
          const rawTitle = m[3].replace(/<[^>]+>/g, "").trim();
          const codeMatch = rawTitle.match(/\*\*\*([A-Z0-9]+)\*\*\*/i);
          const remainder = rawTitle.replace(/\*\*\*([A-Z0-9]+)\*\*\*/i, "").trim();
          const firstParen = remainder.indexOf("(");

          let companyTitle = remainder;
          let subject = "Özel Durum Açıklaması";

          if (firstParen !== -1) {
            companyTitle = remainder.slice(0, firstParen).trim();
            subject = remainder.slice(firstParen).replace(/^\(|\)$/g, "").trim();
          }

          const resolvedCode = resolveBistTicker(companyTitle, codeMatch ? codeMatch[1] : undefined);
          const cleanSubject = getCleanKapSubject(subject, companyTitle, "ÖDA");

          const numId = Number(bigparaId);
          parsed.push({
            id: numId,
            code: resolvedCode,
            type: "ÖDA",
            title: companyTitle || "BIST Şirketi",
            subject: cleanSubject,
            summary: rawTitle,
            time: "--:--",
            timestamp: numId,
            kapUrl: `https://www.kap.org.tr/tr/Bildirim/${numId}`,
          });
        }

        if (parsed.length > 0) {
          return parsed.sort((a, b) => b.id - a.id);
        }
      }
    } catch {
      // ignore
    }
  }

  return [];
};

export const fetchTodayKapDisclosures = fetchLiveKapFeed;
export const fetchLiveKapDisclosures = fetchLiveKapFeed;
export const fetchKapDisclosures = fetchLiveKapFeed;

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

// HTML entity decode mekanizması
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

function cleanHtmlStr(str?: string | null): string {
  return decodeHtmlEntities(str);
}

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

const ACRONYMS_LIST: Record<string, string> = {
  us: "US",
  eu: "EU",
  fed: "FED",
  sec: "SEC",
  dod: "DOD",
  "s&p": "S&P",
  ceo: "CEO",
  cfo: "CFO",
  cpi: "CPI",
  gdp: "GDP",
  pmi: "PMI",
  q1: "Q1",
  q2: "Q2",
  q3: "Q3",
  q4: "Q4",
  ai: "AI",
  ipo: "IPO",
  etf: "ETF",
};

// Tamamen BÜYÜK HARF olan metinleri doğal cümle düzenine çevirir, finansal kısaltmaları korur
export function normalizeAllCapsText(raw: string): string {
  if (!raw) return "";
  const letters = raw.replace(/[^a-zA-Z]/g, "");
  const upper = raw.replace(/[^A-Z]/g, "");
  if (letters.length > 6 && upper.length / letters.length > 0.65) {
    let lower = raw.toLowerCase();
    // Cümle başı veya ayraç sonrası ilk harfi büyük harf yap
    lower = lower.charAt(0).toUpperCase() + lower.slice(1);
    lower = lower.replace(/(?:^|[.!?·]\s+)([a-z])/g, (match) => match.toUpperCase());

    // Borsa ve kurum kısaltmalarını koru
    for (const [key, val] of Object.entries(ACRONYMS_LIST)) {
      const reg = new RegExp(`\\b${key}\\b`, "gi");
      lower = lower.replace(reg, val);
    }
    return lower;
  }
  return raw;
}

// Finansal terminoloji eşleme ve baş harf formatlama
export function applyFinancialTerminology(str: string): string {
  if (!str) return "";
  let out = str
    .replace(/\bgrevlere\b/gi, "saldırılara")
    .replace(/\bgrevleri\b/gi, "saldırıları")
    .replace(/\bgrevler\b/gi, "saldırılar")
    .replace(/\bgreve\b/gi, "saldırıya")
    .replace(/\bgrevi\b/gi, "saldırıyı")
    .replace(/\bgrev\b/gi, "saldırı")
    .replace(/\bs&p 500\b/gi, "S&P 500")
    .replace(/ABD Savunma Bakanlığı\s*\([^)]*\)/gi, "ABD Savunma Bakanlığı (DoD)")
    .replace(/\bdod\b/gi, "ABD Savunma Bakanlığı (DoD)")
    .replace(/(?:ABD Savunma Bakanlığı\s*\()?ABD Savunma Bakanlığı \(DoD\)\)?/gi, "ABD Savunma Bakanlığı (DoD)")
    .replace(/\bfed\b/gi, "Fed")
    .replace(/\bsec\b/gi, "SEC")
    .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
    .trim();

  // İlk harf ve ' · ' ayracından sonraki harfi büyük yap
  out = out.charAt(0).toUpperCase() + out.slice(1);
  out = out.replace(/(·\s+)([a-zğüşıöç])/gi, (_, prefix, char) => prefix + char.toUpperCase());
  return out;
}

export const translateGlobalFeed = async (text: string): Promise<string> => {
  if (!text) return "";

  let clean = text
    .replace(/\$[A-Z]{1,6}\b/g, "")
    .replace(/^\[.*?\]\s*·?\s*/gi, "")
    .replace(/^[\s\*\/\-]+/, "")
    .replace(/\s+\*\s*/g, " · ")
    .replace(/[•·]+$/, "")
    .trim();

  if (!clean) return "";

  // ALL CAPS normalizasyonu
  clean = normalizeAllCapsText(clean);

  // Cache kontrolü (v2 key kullan ki eski İngilizce kalan önbellek ezilsin)
  const cacheKey = "tr_v2_" + clean.slice(0, 35).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached && !cached.toLowerCase().includes("grev") && !cached.startsWith("/")) {
        return cached;
      }
    } catch {
      // ignore
    }
  }

  // 1. ADIM: Sunucu tarafı /api/translate rotasını çağır (Gemini & Free Translate entegre)
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean }),
      signal: AbortSignal.timeout(4500),
    });

    if (res.ok) {
      const data = await res.json();
      const result = data?.translated?.trim();
      if (result && result !== clean) {
        const formatted = applyFinancialTerminology(result);
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(cacheKey, formatted);
          } catch {
            // ignore
          }
        }
        return formatted;
      }
    }
  } catch {
    // ignore
  }

  // 2. ADIM: İstemci tarafı doğrudan Google GTX Nöral Çeviri API'si (0-key, ultra hızlı)
  try {
    const preClean = clean
      .replace(/\bstrikes\b/gi, "military operations")
      .replace(/\bstrike\b/gi, "military operation");

    const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=tr&dt=t&q=${encodeURIComponent(preClean)}`;
    const gtxRes = await fetch(gtxUrl, { signal: AbortSignal.timeout(4000) });
    if (gtxRes.ok) {
      const gtxData = await gtxRes.json();
      if (Array.isArray(gtxData) && Array.isArray(gtxData[0])) {
        const parts = gtxData[0].map((chunk: [string, string]) => chunk[0]).filter(Boolean);
        const joined = parts.join("").trim();
        if (joined) {
          const formatted = applyFinancialTerminology(joined);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(cacheKey, formatted);
            } catch {
              // ignore
            }
          }
          return formatted;
        }
      }
    }
  } catch {
    // ignore
  }

  return clean;
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
  const [selectedKap, setSelectedKap] = useState<KapItem | null>(null);
  const [kapBildirimleri, setKapBildirimleri] = useState<KapItem[]>(() => {
    if (typeof window === "undefined") return [];
    checkAndResetKapDailyCache();
    try {
      const cached = localStorage.getItem(CACHE_KEY_KAP_V4);
      if (cached) {
        const parsed = JSON.parse(cached) as KapItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const onlyToday = parsed.filter((item) => isStrictlyTodayKap(item.timestamp || item.time, item.time));
          if (onlyToday.length > 0) {
            return onlyToday.sort((a, b) => Number(b.id) - Number(a.id));
          }
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [loadingKap, setLoadingKap] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    checkAndResetKapDailyCache();
    try {
      const cached = localStorage.getItem(CACHE_KEY_KAP_V4);
      if (cached) {
        const parsed = JSON.parse(cached) as KapItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const onlyToday = parsed.filter((item) => isStrictlyTodayKap(item.timestamp || item.time, item.time));
          if (onlyToday.length > 0) return false;
        }
      }
    } catch {
      // ignore
    }
    return true;
  });
  const [newlyArrivedIds, setNewlyArrivedIds] = useState<Set<string>>(new Set());

  const knownIdsRef = useRef(new Set<string>());
  const isInitialLoadRef = useRef(true);
  const translationsCacheRef = useRef(new Map<string, string>());
  // KAP bildirimlerinin saatlerini bir kez alındıktan sonra kilitleyen referans haritası
  const lockedKapTimesRef = useRef(new Map<number, string>());

  const loadGlobalNews = useCallback(async () => {
    try {
      let items: { id: string; zaman: string; timestamp: number; rawText: string; baslik: string }[] = [];

      try {
        const res = await fetch("/api/telegram-news", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            items = data.items;
          }
        }
      } catch {
        // ignore
      }

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
          // ignore
        }
      }

      if (items.length > 0) {
        items.sort((a, b) => b.timestamp - a.timestamp);

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

        try {
          localStorage.setItem(CACHE_KEY_GLOBAL, JSON.stringify(translatedItems));
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingGlobal(false);
    }
  }, []);

  const fetchRSS = async (url: string): Promise<string | null> => {
    const proxies = [
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    ];
    try {
      return await Promise.any(
        proxies.map(async (pUrl) => {
          const res = await fetch(pUrl, { signal: AbortSignal.timeout(4500) });
          if (!res.ok) throw new Error("Proxy failed");
          const text = await res.text();
          if (text && (text.includes("<item") || text.includes("<entry") || text.includes("<feed"))) return text;
          throw new Error("Invalid XML");
        })
      );
    } catch {
      return null;
    }
  };

  const loadNews = useCallback(async () => {
    try {
      const accumulatedNews: TerminalHaber[] = [];
      const seenTitles = new Set<string>();

      const updateFeedState = (incomingItems: TerminalHaber[]) => {
        if (!incomingItems || incomingItems.length === 0) return;
        for (const item of incomingItems) {
          const normKey = item.baslik.toLowerCase().replace(/[^a-z0-9ğüşıöç]/g, "").slice(0, 40);
          if (!seenTitles.has(normKey)) {
            seenTitles.add(normKey);
            accumulatedNews.push(item);
          }
        }

        accumulatedNews.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const todaysNews = accumulatedNews.filter((item) => isToday(item.dateObj || item.timestamp));
        const listToProcess = todaysNews.length > 0 ? todaysNews : accumulatedNews;

        if (!isInitialLoadRef.current) {
          const yeniGelenler = listToProcess.filter(
            (h) => !knownIdsRef.current.has(h.id) && !knownIdsRef.current.has(h.baslik.slice(0, 30))
          );

          if (yeniGelenler.length > 0) {
            const yeniIdler = new Set(yeniGelenler.map((h) => h.id));
            setNewlyArrivedIds((prev) => new Set([...prev, ...yeniIdler]));

            setTimeout(() => {
              setNewlyArrivedIds((prev) => {
                const kopya = new Set(prev);
                yeniIdler.forEach((id) => kopya.delete(id));
                return kopya;
              });
            }, 4000);
          }
        }

        listToProcess.forEach((h) => {
          knownIdsRef.current.add(h.id);
          knownIdsRef.current.add(h.baslik.slice(0, 30));
        });

        isInitialLoadRef.current = false;
        setBistHaberleri([...listToProcess]);
        setLoadingBist(false);
      };

      // 1. ADIM: Sunucu tarafı dahili /api/news rotasını çağır (anında yanıt döner)
      fetch("/api/news", { cache: "no-store", signal: AbortSignal.timeout(4500) })
        .then((res) => res.json())
        .then((data) => {
          if (data.items && Array.isArray(data.items) && data.items.length > 0) {
            const internalItems: TerminalHaber[] = data.items.map((it: ApiNewsItemResponse) => {
              const parsedDate = parseNewsDate(it.timestamp || it.dateObj);
              const itemTime = it.time || it.zaman || parsedDate.time;
              return {
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
                timestamp: it.timestamp || parsedDate.timestamp,
                dateObj: parsedDate.dateObj,
              };
            });
            updateFeedState(internalItems);
          }
        })
        .catch(() => {});

      // 2. ADIM: Tüm RSS kaynaklarını paralel olarak başlat, her biten kaynak anında ekrana yansısın
      const feedPromises = ACTIVE_RSS_SOURCES.map(async (feed) => {
        try {
          let xml = await fetchRSS(feed.url);

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
              updateFeedState(parsed);
            }
          }
        } catch {
          // ignore
        }
      });

      await Promise.allSettled(feedPromises);

      // Tüm kaynaklar bittikten sonra önbelleğe kaydet
      if (accumulatedNews.length > 0) {
        const todaysNews = accumulatedNews.filter((item) => isToday(item.dateObj || item.timestamp));
        const finalToSave = todaysNews.length > 0 ? todaysNews : accumulatedNews;
        try {
          localStorage.setItem(CACHE_KEY_BIST, JSON.stringify(finalToSave));
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingBist(false);
    }
  }, []);

  useEffect(() => {
    const initialTimer = setTimeout(() => {
      void loadNews();
    }, 0);

    const interval = setInterval(() => {
      void loadNews();
    }, 15000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [loadNews]);

  useEffect(() => {
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

    const timer = setTimeout(() => {
      void loadGlobalNews();
    }, 50);

    const interval = setInterval(() => {
      void loadGlobalNews();
    }, 15000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [loadGlobalNews]);

  // 3. KAP CANLI GÜNCELLEME & SAAT KİLİTLEME MİMARİSİ (`b.id - a.id`)
  useEffect(() => {
    let isMounted = true;

    // Kilitli saat referans haritasını mevcut bildirimlerle eşle
    kapBildirimleri.forEach((item) => {
      if (item.id && item.time && item.time !== "--:--") {
        lockedKapTimesRef.current.set(Number(item.id), item.time);
      }
    });

    const loadKap = async () => {
      checkAndResetKapDailyCache();
      const freshItems = await fetchLiveKapFeed();
      if (!isMounted) return;

      if (freshItems && freshItems.length > 0) {
        setKapBildirimleri((prev) => {
          // Mevcut listedeki bildirimleri ID üzerinden kaydet
          const existingMap = new Map<number, KapItem>();
          prev.forEach((p) => {
            const numId = Number(p.id);
            existingMap.set(numId, p);
            if (p.time && p.time !== "--:--") {
              lockedKapTimesRef.current.set(numId, p.time);
            }
          });

          // Yeni gelenleri işle: Zaten listede olan bir bildirimin `time` değerini ASLA değiştirme!
          freshItems.forEach((item) => {
            const numId = Number(item.id);
            const lockedTime = lockedKapTimesRef.current.get(numId);
            const finalTime = lockedTime || item.time;

            if (finalTime && finalTime !== "--:--") {
              lockedKapTimesRef.current.set(numId, finalTime);
            }

            existingMap.set(numId, {
              ...item,
              id: numId,
              time: finalTime,
            });
          });

          // Doğrudan bildirim ID'sine göre büyükten küçüğe sırala ve sadece bugünün bildirimlerini sakla!
          const merged = Array.from(existingMap.values())
            .filter((item) => isStrictlyTodayKap(item.timestamp || item.time, item.time))
            .sort((a, b) => Number(b.id) - Number(a.id))
            .slice(0, 35);

          try {
            if (merged.length > 0) {
              localStorage.setItem(CACHE_KEY_KAP_V4, JSON.stringify(merged));
            } else {
              localStorage.removeItem(CACHE_KEY_KAP_V4);
            }
          } catch {
            // ignore
          }

          return merged;
        });
      }
      setLoadingKap(false);
    };

    void loadKap();
    const kapInterval = setInterval(() => {
      void loadKap();
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(kapInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedKap(null);
        setSeciliHaber(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="terminal-workspace">
      {/* 3-SÜTUNLU KOMPAKT ENDÜSTRİYEL TERMİNAL DÜZENİ (ÜST SIRA) */}
      <div className="terminal-grid">
        {/* SÜTUN 1: BIST & Türkiye */}
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

        {/* SÜTUN 2: Global */}
        <section className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[520px] overflow-hidden">
          <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
            <div className="flex items-center">
              <h2 className="font-mono text-xs font-semibold tracking-wider text-slate-200">
                <span className="text-[#38bdf8] font-bold mr-1.5">/</span>
                Global
              </h2>
            </div>
          </div>

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
                    <span className="font-mono text-[11px] text-slate-500 shrink-0 select-none pt-0.5">
                      {itemTime}
                    </span>

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

            <div className="pane-scroll p-3">
              {loadingKap && kapBildirimleri.length === 0 ? (
                <TerminalSkeletonList count={3} />
              ) : kapBildirimleri.length === 0 ? (
                <div className="p-6 text-center font-mono text-xs text-slate-500/80 flex flex-col items-center justify-center h-40 select-none">
                  <span>Bugüne ait yeni KAP bildirimi henüz bulunmuyor...</span>
                </div>
              ) : (
                kapBildirimleri.map((item) => {
                  const cleanSubject = getCleanKapSubject(item.subject, item.title, item.type, item.summary);
                  const displayLine =
                    item.title && item.title !== cleanSubject && !item.title.toLowerCase().includes(cleanSubject.toLowerCase())
                      ? `${item.title} — ${cleanSubject}`
                      : cleanSubject || item.title;

                  return (
                    <article
                      key={item.id}
                      onClick={() => setSelectedKap(item)}
                      className="cursor-pointer group hover:bg-slate-900/50 transition border-b border-white/[0.04] pb-2 mb-2 last:border-b-0 last:pb-0 last:mb-0"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[#38bdf8] font-mono font-bold text-xs">
                            {item.code}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-800/80 px-1 rounded">
                            {item.type}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                            {item.time}
                          </span>
                          {item.kapUrl && (
                            <a
                              href={item.kapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              title="Resmi KAP Bildirimini Aç"
                              className="text-slate-500 hover:text-[#38bdf8] transition p-0.5"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed group-hover:text-white mt-1">
                        {displayLine}
                      </p>
                    </article>
                  );
                })
              )}
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

            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 font-mono text-xs select-none">
              <span className="text-[#38bdf8] font-bold mb-1">/</span>
              <span>Resmi kurum duyuru akışı hazırlanıyor...</span>
            </div>
          </section>
        </div>
      </div>

      {/* ALT SIRA: 3 KOLONLU GRID */}
      <div className="w-full mt-4" style={{ marginTop: "16px" }}>
        <MarketIntelligence />
      </div>

      {/* HABER DETAY MODALI */}
      {seciliHaber && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fadeIn"
          onClick={() => setSeciliHaber(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl bg-[#0b0f19] border border-[#2563eb]/40 rounded-xl shadow-[0_0_50px_rgba(37,99,235,0.15)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#2563eb] to-transparent" />

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

            <div className="px-6 py-4 bg-[#080c14] border-t border-white/[0.06] flex items-center justify-between gap-4">
              <div className="text-[11px] font-mono text-slate-500">
                Kategori:{" "}
                <span className="text-slate-300">
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

      {/* KAP DETAY MODALI */}
      {selectedKap && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn"
          onClick={() => setSelectedKap(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-2xl bg-[#0b0f19] border border-[#2563eb]/40 rounded-xl shadow-[0_0_50px_rgba(37,99,235,0.15)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#38bdf8] to-transparent" />

            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-white bg-[#2563eb] px-2.5 py-1 rounded tracking-wider">
                  {selectedKap.code}
                </span>
                <span className="font-mono text-xs text-[#38bdf8] bg-[#38bdf8]/10 px-2 py-0.5 rounded border border-[#38bdf8]/20">
                  {selectedKap.type}
                </span>
                <span className="font-mono text-xs text-slate-400 ml-2">
                  {selectedKap.time}
                </span>
              </div>
              <button
                onClick={() => setSelectedKap(null)}
                className="text-slate-400 hover:text-white text-sm font-mono px-2 py-1 rounded hover:bg-white/[0.06] transition"
              >
                ✕ ESC
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <h2 className="text-base font-bold text-slate-100 leading-snug">
                {selectedKap.title}
              </h2>
              <div className="text-xs font-semibold text-[#38bdf8] bg-slate-900/80 p-2.5 rounded border border-white/[0.04]">
                Konu: {selectedKap.subject}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-normal">
                {selectedKap.summary}
              </p>
            </div>

            <div className="px-6 py-4 bg-[#080c14] border-t border-white/[0.06] flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500">
                Kaynak: Kamuyu Aydınlatma Platformu (#{selectedKap.id})
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedKap(null)}
                  className="text-xs text-slate-400 hover:text-white px-4 py-2 rounded-lg hover:bg-slate-800 transition"
                >
                  Kapat
                </button>
                <a
                  href={selectedKap.kapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs font-semibold text-white bg-[#2563eb] hover:bg-blue-600 px-5 py-2.5 rounded-lg shadow-lg shadow-blue-500/20 transition active:scale-95"
                >
                  <span>KAP&apos;ta Görüntüle</span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
