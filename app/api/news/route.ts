import { NextResponse } from "next/server";

export type ApiNewsItem = {
  id: string;
  zaman: string; // HH:mm:ss
  tarih: string;
  kaynak: string;
  baslik: string;
  ozet: string;
  paragraflar: string[];
  url: string;
  timestamp: number;
};

interface FeedConfig {
  url: string;
  badge: string;
  filterEconomyOnly?: boolean;
}

const ACTIVE_FEEDS: FeedConfig[] = [
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

function normalizeNewsDate(dateInput: string | number | Date | null | undefined): {
  timestamp: number;
  zaman: string;
} {
  if (!dateInput) {
    return {
      timestamp: 0,
      zaman: "--:--:--",
    };
  }

  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) {
      return {
        timestamp: 0,
        zaman: "--:--:--",
      };
    }

    const timestamp = d.getTime();
    const zaman = d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    return {
      timestamp,
      zaman,
    };
  } catch {
    return {
      timestamp: 0,
      zaman: "--:--:--",
    };
  }
}

function cleanHtmlText(str?: string | null): string {
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

function extractFirstTwoParagraphs(cleanDesc: string, title: string, badge: string): string[] {
  if (!cleanDesc || cleanDesc.length < 15) {
    return [
      `[${badge}] tarafından aktarılan son dakika finans ve ekonomi haberi: "${title}".`,
      "Piyasa analistleri, gelişmenin sektör endeksleri ve şirket değerlemeleri üzerindeki etkilerini izliyor.",
    ];
  }

  const splitParagraphs = cleanDesc
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  if (splitParagraphs.length >= 2) {
    return splitParagraphs.slice(0, 2);
  }

  const sentences = cleanDesc.match(/[^\.!\?]+[\.!\?]+/g);
  if (sentences && sentences.length >= 2) {
    const mid = Math.ceil(sentences.length / 2);
    const p1 = sentences.slice(0, mid).join(" ").trim();
    const p2 = sentences.slice(mid).join(" ").trim();
    if (p1 && p2) return [p1, p2];
  }

  return [
    cleanDesc,
    "Borsa İstanbul ve finansal piyasalara ilişkin gelişmeler güncellenmektedir.",
  ];
}

function parseFeedXml(xml: string, feed: FeedConfig): ApiNewsItem[] {
  const items: ApiNewsItem[] = [];
  const itemChunks = xml.split(/<item[\s>]/i).slice(1);

  for (let i = 0; i < itemChunks.length; i++) {
    const chunk = itemChunks[i];

    // Özel Filtre: Türkiye Gazetesi ve Dünya Gazetesi için sadece "Ekonomi" kategorisi
    if (feed.filterEconomyOnly) {
      const categoryMatches = [...chunk.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)];
      let isEconomy = false;
      for (const m of categoryMatches) {
        const cat = cleanHtmlText(m[1]).toLowerCase();
        if (cat.includes("ekonomi")) {
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

      if (!isEconomy) continue;
    }

    const titleMatch = chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    if (!titleMatch) continue;
    const baslik = cleanHtmlText(titleMatch);
    if (!baslik || baslik.length < 5) continue;

    const linkMatch =
      chunk.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ||
      chunk.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ||
      "#";
    const url = cleanHtmlText(linkMatch);

    const pubDateMatch = chunk.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1];
    const { timestamp, zaman } = normalizeNewsDate(pubDateMatch);

    const descMatch =
      chunk.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] ||
      chunk.match(/<content:encoded[^>]*>([\s\S]*?)<\/content:encoded>/i)?.[1] ||
      "";
    const cleanDesc = cleanHtmlText(descMatch);
    const paragraflar = extractFirstTwoParagraphs(cleanDesc, baslik, feed.badge);

    const slug = baslik
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 24);
    const id = `rss_${feed.badge.toLowerCase().replace(/[^a-z]/g, "")}_${slug}_${timestamp}_${i}`;

    items.push({
      id,
      zaman,
      tarih: "Bugün",
      kaynak: feed.badge,
      baslik,
      ozet: baslik,
      paragraflar,
      url,
      timestamp,
    });
  }

  return items;
}

// Memory Cache
let memoryCache: { items: ApiNewsItem[]; timestamp: number } = {
  items: [],
  timestamp: 0,
};

export async function GET() {
  const simdi = Date.now();

  // 10 saniyeden taze önbellek varsa doğrudan döndür
  if (memoryCache.items.length > 0 && simdi - memoryCache.timestamp < 10000) {
    return NextResponse.json({
      success: true,
      cached: true,
      timestamp: memoryCache.timestamp,
      items: memoryCache.items,
    });
  }

  try {
    // 8 kaynağı aynı anda paralel çek (Promise.allSettled) 8s timeout ile
    const results = await Promise.allSettled(
      ACTIVE_FEEDS.map(async (feed) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
          const res = await fetch(feed.url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
              Accept: "application/rss+xml, application/xml, text/xml, */*",
            },
            signal: controller.signal,
            next: { revalidate: 15 },
          });

          clearTimeout(timeoutId);

          if (!res.ok) {
            return [];
          }

          const xml = await res.text();
          return parseFeedXml(xml, feed);
        } catch {
          clearTimeout(timeoutId);
          return [];
        }
      })
    );

    const allItems: ApiNewsItem[] = [];
    results.forEach((r) => {
      if (r.status === "fulfilled" && Array.isArray(r.value)) {
        allItems.push(...r.value);
      }
    });

    if (allItems.length > 0) {
      // Başlık bazlı tekilleştirme (de-duplicate)
      const seen = new Set<string>();
      const deduplicated: ApiNewsItem[] = [];

      // Zaman damgasına göre en yeniden en eskiye sırala
      allItems.sort((a, b) => b.timestamp - a.timestamp);

      for (const item of allItems) {
        const normKey = item.baslik.toLowerCase().replace(/[^a-z0-9ğüşıöç]/g, "").slice(0, 40);
        if (!seen.has(normKey)) {
          seen.add(normKey);
          deduplicated.push(item);
        }
      }

      memoryCache = {
        items: deduplicated,
        timestamp: simdi,
      };

      return NextResponse.json({
        success: true,
        cached: false,
        timestamp: simdi,
        items: deduplicated,
      });
    }

    if (memoryCache.items.length > 0) {
      return NextResponse.json({
        success: true,
        cached: true,
        timestamp: memoryCache.timestamp,
        items: memoryCache.items,
      });
    }

    return NextResponse.json({
      success: false,
      items: [],
      error: "Haber akışı güncelleniyor...",
    });
  } catch (err: unknown) {
    if (memoryCache.items.length > 0) {
      return NextResponse.json({
        success: true,
        cached: true,
        timestamp: memoryCache.timestamp,
        items: memoryCache.items,
      });
    }

    const errorMsg = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json(
      {
        success: false,
        items: [],
        error: errorMsg,
      },
      { status: 500 }
    );
  }
}
