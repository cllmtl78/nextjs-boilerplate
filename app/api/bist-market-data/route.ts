import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface RawStockItem {
  kod: string;
  son: number;
  degisim: number;
  hacimtl: number;
}

export async function GET() {
  try {
    const res = await fetch("https://finans.mynet.com/borsa/hisseler/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      next: { revalidate: 15 },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      throw new Error(`Mynet HTTP ${res.status}`);
    }

    const html = await res.text();
    const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    const list: RawStockItem[] = [];

    for (const row of rows) {
      const tds = row.match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
      if (!tds || tds.length < 4) continue;
      const cleanText = (t: string) =>
        t.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

      const symMatch = tds[0].match(/<a[^>]*>([\s\S]*?)<\/a>/i);
      const sym = symMatch
        ? cleanText(symMatch[1]).split(" ")[0].toUpperCase()
        : "";
      if (!sym || sym.length < 2 || sym.length > 8) continue;

      const price =
        parseFloat(cleanText(tds[1]).replace(/\./g, "").replace(",", ".")) || 0;
      const changePercent =
        parseFloat(
          cleanText(tds[2])
            .replace(/[^0-9,\-+]/g, "")
            .replace(",", ".")
        ) || 0;
      const volume =
        parseFloat(cleanText(tds[3]).replace(/\./g, "").replace(",", ".")) || 0;

      list.push({
        kod: sym,
        son: price,
        degisim: Math.round(changePercent * 100) / 100,
        hacimtl: volume,
      });
    }

    if (list.length > 0) {
      return NextResponse.json({
        success: true,
        count: list.length,
        data: list,
      });
    }

    return NextResponse.json({ success: false, data: [] });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ success: false, error: errorMsg, data: [] });
  }
}
