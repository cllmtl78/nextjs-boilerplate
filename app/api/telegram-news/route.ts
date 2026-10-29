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

function formatNaturalCase(text: string): string {
  if (!text) return "";
  let prefix = "";
  let clean = text.trim();
  if (clean.startsWith("/ ")) {
    prefix = "/ ";
    clean = clean.slice(2).trim();
  }

  const letters = clean.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/g, "");
  const upperCount = (letters.match(/[A-ZĞÜŞİÖÇ]/g) || []).length;
  const isAllOrMostlyCaps = letters.length > 4 && (upperCount / letters.length) > 0.55;

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

function formatHeadline(text: string): string {
  let cleaned = text.trim();
  // Borsa Ticker Temizliği ($MSFT, $GOOGL, $NVDA vb.)
  cleaned = cleaned.replace(/\$[A-Z]{1,6}\b/gi, "");
  // Baştaki * işaretini / ile değiştir veya başına / ekle
  if (cleaned.startsWith("*")) {
    cleaned = "/ " + cleaned.slice(1).trim();
  } else if (!cleaned.startsWith("/")) {
    cleaned = "/ " + cleaned;
  }
  // İçerdeki * işaretlerini temizle
  cleaned = cleaned.replace(/\s+\*\s*/g, " · ");
  // Birden fazla boşlukları teke indir
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  // Tamamen büyük harf metinleri normal harflere dönüştür
  return formatNaturalCase(cleaned);
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

        const formatted = formatHeadline(rawContent);
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
