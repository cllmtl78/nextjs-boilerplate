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

// HTML & Karakter Kodlama Temizleyici
function cleanHtml(str?: string | null): string {
  if (!str) return "";
  const text = str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&ouml;/g, "ö")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&ccedil;/g, "ç")
    .replace(/&Ccedil;/g, "Ç")
    .replace(/&para;/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

// Başlık sonundaki kaynak ismini temizle (Örn: "Borsa Güne Yükselişle Başladı - CNBC-e" -> "Borsa Güne Yükselişle Başladı")
function cleanTitle(rawTitle: string): string {
  const title = cleanHtml(rawTitle);

  // Tire veya tire varyantlarına göre son kaynak ekini ayır
  const parts = title.split(/\s+[-–—]\s+/);
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1].trim();
    // Bilinen kaynak isimleri veya 25 karakterden kısa son ekler
    if (
      /^(CNBC-e|Ekonomim|Foreks|Foreks\.com|Ekonomist|Ekotürk|Ekoturk|Bloomberg|AA|Reuters|Investing)/i.test(
        lastPart
      ) ||
      lastPart.length <= 25
    ) {
      parts.pop();
      return parts.join(" - ").trim();
    }
  }

  return title;
}

// Kaynak ismini Google News metadata'sından ayıkla ve standartlaştır
function formatSourceBadge(rawSource?: string | null, rawUrl?: string | null): string {
  const s = (rawSource || "").toLowerCase();
  const u = (rawUrl || "").toLowerCase();

  if (s.includes("cnbc") || u.includes("cnbce.com")) return "CNBC-E";
  if (s.includes("ekonomim") || u.includes("ekonomim.com")) return "EKONOMİM";
  if (s.includes("foreks") || u.includes("foreks.com")) return "FOREKS";
  if (s.includes("ekonomist") || u.includes("ekonomist.com.tr")) return "EKONOMİST";
  if (s.includes("ekotürk") || s.includes("ekoturk") || u.includes("ekoturk.com")) return "EKOTÜRK";
  if (s.includes("bloomberg") || u.includes("bloomberght.com")) return "BLOOMBERG HT";
  if (s.includes("aa") || s.includes("anadolu") || u.includes("aa.com.tr")) return "AA FİNANS";

  if (rawSource && rawSource.trim().length > 0) {
    return rawSource
      .toUpperCase()
      .replace(/\.COM(\.TR)?/g, "")
      .trim();
  }

  return "FİNANS";
}

// Google News XML çıktısını parse et
function parseGoogleNewsXml(xml: string): ApiNewsItem[] {
  const items: ApiNewsItem[] = [];
  const itemChunks = xml.split("<item>").slice(1);

  for (const chunk of itemChunks) {
    const rawTitle = chunk.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
    const rawLink =
      chunk.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ||
      chunk.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1];
    const rawSource = chunk.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1];
    const rawSourceUrl = chunk.match(/<source[^>]*url="([^"]*)"/i)?.[1];
    const rawPubDate = chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1];
    const rawDesc = chunk.match(/<description>([\s\S]*?)<\/description>/i)?.[1];

    if (!rawTitle) continue;

    const baslik = cleanTitle(rawTitle);
    if (!baslik || baslik.length < 5) continue;

    const kaynak = formatSourceBadge(rawSource, rawSourceUrl || rawLink);
    const link = cleanHtml(rawLink) || "https://news.google.com";

    let pubDateObj = new Date();
    if (rawPubDate) {
      const parsed = new Date(rawPubDate);
      if (!isNaN(parsed.getTime())) {
        pubDateObj = parsed;
      }
    }

    const zaman = pubDateObj.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const tarih = pubDateObj.toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
    });

    const aciklama = cleanHtml(rawDesc);
    const ozet = baslik; // Kullanıcı kuralı: kutucukta özet metin yok, sadece başlık ve modal detayı

    // Modal detay paragrafları (Temiz metin)
    const p1 =
      aciklama && aciklama.length > 25 && !aciklama.toLowerCase().startsWith("http")
        ? aciklama
        : `${kaynak} kaynaklı son dakika ekonomi ve finans gelişmesi: "${baslik}".`;
    const p2 =
      "Piyasa analistleri, haberin Borsa İstanbul şirket değerlemeleri, sektör endeksleri ve makro göstergeler üzerindeki olası etkilerini yakından izliyor.";

    const slug = baslik
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 24);
    const id = `gnews_${kaynak.toLowerCase().replace(/[^a-z]/g, "")}_${slug}_${pubDateObj.getTime()}`;

    items.push({
      id,
      zaman,
      tarih,
      kaynak,
      baslik,
      ozet,
      paragraflar: [p1, p2],
      url: link,
      timestamp: pubDateObj.getTime(),
    });
  }

  return items;
}

// Bellek içi önbellek (Memory Cache)
let memoryCache: { items: ApiNewsItem[]; timestamp: number } = {
  items: [],
  timestamp: 0,
};

export async function GET() {
  const simdi = Date.now();

  // 5 saniyeden taze önbellek varsa doğrudan sun
  if (memoryCache.items.length > 0 && simdi - memoryCache.timestamp < 5000) {
    return NextResponse.json({
      success: true,
      cached: true,
      timestamp: memoryCache.timestamp,
      items: memoryCache.items,
    });
  }

  const googleNewsUrl =
    "https://news.google.com/rss/search?q=(site:ekonomim.com+OR+site:cnbce.com+OR+site:ekonomist.com.tr+OR+site:ekoturk.com+OR+site:foreks.com)+when:1d&hl=tr&gl=TR&ceid=TR:tr";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(googleNewsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, */*",
      },
      signal: controller.signal,
      next: { revalidate: 10 },
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const xml = await res.text();
      const parsedItems = parseGoogleNewsXml(xml);

      if (parsedItems.length > 0) {
        // Başlık benzerliği ile tekilleştirme (deduplication)
        const tekilMap = new Map<string, ApiNewsItem>();
        parsedItems.forEach((item) => {
          const key = item.baslik.slice(0, 35).toLowerCase();
          if (!tekilMap.has(key)) {
            tekilMap.set(key, item);
          }
        });

        // En yeniden en eskiye sırala (timestamp descending)
        const sortedItems = Array.from(tekilMap.values()).sort(
          (a, b) => b.timestamp - a.timestamp
        );

        memoryCache = {
          items: sortedItems,
          timestamp: simdi,
        };

        return NextResponse.json({
          success: true,
          cached: false,
          timestamp: simdi,
          items: sortedItems,
        });
      }
    }

    // Google News yanıt vermediyse önceki hafızayı dön
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
      error: "Haber akışına bağlanılıyor...",
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
