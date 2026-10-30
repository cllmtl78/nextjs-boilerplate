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

export function cleanWireText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\$[A-Z]{1,6}\b/gi, "")
    .replace(/^[\*\/\s]+/, "")
    .replace(/\s+\*\s*/g, " · ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

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

export interface KapItem {
  id: string | number;
  code: string;
  type: string;
  title: string;
  subject: string;
  summary: string;
  time: string;
  timestamp: number;
  kapUrl: string;
}

export const isTodayKap = (timestamp: number | string | Date | null | undefined): boolean => {
  if (!timestamp) return false;
  const itemDate = new Date(timestamp);
  if (isNaN(itemDate.getTime())) return false;
  const now = new Date();
  return (
    itemDate.getDate() === now.getDate() &&
    itemDate.getMonth() === now.getMonth() &&
    itemDate.getFullYear() === now.getFullYear()
  );
};

export const checkAndResetKapDailyCache = (): void => {
  if (typeof window === "undefined") return;
  try {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const lastDate = localStorage.getItem("bpt_kap_last_date");

    if (lastDate !== todayStr) {
      localStorage.removeItem("bpt_kap_cache");
      localStorage.removeItem("bpt_kap_disclosures");
      localStorage.setItem("bpt_kap_last_date", todayStr);
    }
  } catch {
    // ignore
  }
};

export const parseKapItems = (data: unknown[]): KapItem[] => {
  return (data as Record<string, unknown>[])
    .map((item) => {
      const disclosureId = String(item.disclosureIndex || item.id || item.disclosureId || "");
      const d = new Date((item.publishDate || item.disclosureTime || Date.now()) as string | number);
      return {
        id: disclosureId,
        code: String(item.stockCodes || item.stockCode || item.relatedStocks || "KAP").toUpperCase(),
        type: String(item.disclosureType || item.type || "ÖDA").toUpperCase(),
        title: String(item.companyTitle || item.stockTitle || "Şirket Bildirimi"),
        subject: String(item.disclosureTitle || item.title || item.subject || "Açıklama"),
        summary: String(item.summary || item.disclosureTitle || item.title || ""),
        time: new Intl.DateTimeFormat("tr-TR", {
          timeZone: "Europe/Istanbul",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }).format(d),
        timestamp: d.getTime(),
        kapUrl: `https://www.kap.org.tr/tr/Bildirim/${disclosureId}`,
      };
    })
    .filter((item) => isTodayKap(item.timestamp))
    .sort((a, b) => b.timestamp - a.timestamp);
};

export const fetchTodayKapDisclosures = async (): Promise<KapItem[]> => {
  checkAndResetKapDailyCache();
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const cacheBuster = Date.now();

  const targetUrl = `https://www.kap.org.tr/tr/api/disclosures?fromDate=${todayStr}&toDate=${todayStr}&_t=${cacheBuster}`;
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;

  try {
    const res = await fetch(proxyUrl, {
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      signal: AbortSignal.timeout(7000),
    });
    const data = await res.json();

    if (Array.isArray(data) && data.length > 0) {
      const items = parseKapItems(data);
      if (items.length > 0) return items;
    }
  } catch {
    try {
      const altUrl = `https://finans.mynet.com/api/kap/haberler?_t=${cacheBuster}`;
      const altProxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(altUrl)}`;
      const altRes = await fetch(altProxy, { signal: AbortSignal.timeout(6000) });
      const altData = await altRes.json();
      const rawList = Array.isArray(altData) ? altData : altData?.data || [];

      if (Array.isArray(rawList) && rawList.length > 0) {
        const mynetItems = (rawList as Record<string, unknown>[])
          .map((item) => {
            const tDate = new Date((item.tarih || item.publishDate || Date.now()) as string | number);
            const kapId = String(item.kapId || item.id || "");
            return {
              id: kapId,
              code: String(item.hisseKodu || item.kod || "BIST").toUpperCase(),
              type: String(item.tur || item.disclosureType || "ÖDA").toUpperCase(),
              title: String(item.sirketAdi || item.title || "Şirket Bildirimi"),
              subject: String(item.baslik || item.konu || "Açıklama"),
              summary: String(item.ozet || item.baslik || ""),
              time: new Intl.DateTimeFormat("tr-TR", {
                timeZone: "Europe/Istanbul",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              }).format(tDate),
              timestamp: tDate.getTime(),
              kapUrl: `https://www.kap.org.tr/tr/Bildirim/${kapId}`,
            };
          })
          .filter((item: KapItem) => isTodayKap(item.timestamp))
          .sort((a: KapItem, b: KapItem) => b.timestamp - a.timestamp);

        if (mynetItems.length > 0) return mynetItems;
      }
    } catch {
      // ignore
    }
  }

  try {
    const sRes = await fetch(`/api/kap-disclosures?_t=${cacheBuster}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (sRes.ok) {
      const sJson = await sRes.json();
      if (sJson && Array.isArray(sJson.data) && sJson.data.length > 0) {
        return (sJson.data as KapItem[])
          .filter((item: KapItem) => isTodayKap(item.timestamp))
          .sort((a, b) => b.timestamp - a.timestamp);
      }
    }
  } catch {
    // ignore
  }

  return [];
};

export const fetchLiveKapDisclosures = fetchTodayKapDisclosures;
export const fetchKapDisclosures = fetchTodayKapDisclosures;

// Resmi Kurumlar - canlı kaynak bağlanana kadar boş (sahte veri yok)
const RESMI_HABERLER: TerminalHaber[] = [];

export interface RssFeedConfig {
  url: string;
  badge: string;
  filterEconomyOnly?: boolean;
  fallbackUrls?: string[];
}

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
      .replace(/<[^>]*>?/gi, " ")
      .replace(/"/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&#036;/g, "$")
      .replace(/&/g, "&")
      .replace(/</g, "<")
      .replace(/>/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  const txt = document.createElement("textarea");
  txt.innerHTML = raw;
  return txt.value;
};

// ... (the rest of the component logic remains the same, only the RESMI section UI is changed)

// NOTE: The full component is large. The key change is:
// - RESMI_HABERLER is now empty array
// - In the JSX, the resmi section shows the waiting message instead of mapping fake items

export default function TerminalWorkspace() {
  // ... existing state and effects ...

  return (
    <div className="terminal-workspace">
      {/* ... existing layout ... */}

      {/* Resmi Kurumlar section updated to show waiting message */}
      <section className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[255px] overflow-hidden">
        <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
          <h2 className="text-xs font-mono font-bold text-slate-200">
            <span className="text-[#38bdf8] font-bold mr-1.5">/</span>
            Resmi Kurumlar
          </h2>
        </div>

        <div className="pane-scroll flex-1 flex flex-col items-center justify-center p-6 text-center text-slate-500 font-mono text-xs">
          <span className="text-[#38bdf8] mb-1">/</span>
          <span>Resmi kurum duyuru akışı hazırlanıyor...</span>
        </div>
      </section>

      {/* ... rest of the component ... */}
    </div>
  );
}
