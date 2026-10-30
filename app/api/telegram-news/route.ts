import { NextResponse } from "next/server";

export interface TelegramNewsItem {
  id: string;
  zaman: string;
  timestamp: number;
  rawText: string;
  baslik: string;
}

function cleanHtml(html: string): string {
  return html
    .replace(/<br\s*[\/]?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#036;/g, "$")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\s+/g, " ")
    .trim();
}

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
    const zaman = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);

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

function cleanWireHeadline(text: string): string {
  if (!text) return "";
  // 1. Ticker ve çöp karakter temizliği
  let cleaned = text
    .replace(/\$[A-Z]{1,6}\b/gi, "")
    .replace(/^\[.*?\]\s*·?\s*/gi, "")
    .replace(/^[\s\*\/\-•·]+/, "")
    .replace(/[•·]+$/, "")
    .replace(/\s+\*\s*/g, " · ")
    .replace(/\s{2,}/g, " ")
    .trim();

  // 2. Metni ASLA toLowerCase() ile bozma; özel isimler (Binance, Intel, Sandisk, WSJ, Fed) aynen korunur.
  // Sadece ilk harfin büyük başladığından emin ol.
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

export async function GET() {
  const telegramUrl = "https://t.me/s/trad_fin";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const res = await fetch(telegramUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,tr;q=0.8",
      },
      signal: controller.signal,
      next: { revalidate: 10 },
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Telegram HTTP error: ${res.status}`);
    }

    const html = await res.text();
    const items: TelegramNewsItem[] = [];

    // Her mesaj bloğu <div class="tgme_widget_message_wrap... içindedir
    const messageBlocks = html.split('<div class="tgme_widget_message_wrap');

    for (let i = 1; i < messageBlocks.length; i++) {
      const block = messageBlocks[i];
      const textMatch = block.match(
        /<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i
      );
      const timeMatch = block.match(
        /<time[^>]*datetime="([^"]*)"[^>]*>([\s\S]*?)<\/time>/i
      );
      const postMatch = block.match(/data-post="([^"]*)"/i);

      if (textMatch && textMatch[1]) {
        const rawContent = cleanHtml(textMatch[1]);
        if (!rawContent || rawContent.length < 3) continue;

        const formatted = cleanWireHeadline(rawContent);
        const { timestamp, zaman: zamanStr } = normalizeNewsDate(timeMatch ? timeMatch[1] : null);

        const postId = postMatch ? postMatch[1] : `trad_fin_${timestamp}_${i}`;

        items.push({
          id: postId,
          zaman: zamanStr,
          timestamp,
          rawText: rawContent,
          baslik: formatted,
        });
      }
    }

    // En yeni mesajlar en üstte olacak şekilde sırala
    items.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({
      success: true,
      count: items.length,
      items: items.slice(0, 30),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Bilinmeyen hata",
        items: [],
      },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
