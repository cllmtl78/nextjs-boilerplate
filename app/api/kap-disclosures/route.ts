import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface KapItem {
  id: number;
  disclosureIndex: number;
  code: string;
  type: string;
  title: string;
  subject: string;
  summary: string;
  time: string;
  timestamp: number;
  kapUrl: string;
}

// Kalıcı in-memory önbellek: Bir kere çekilen KAP bildirimi asla silinmez veya saati değişmez
const cachedKapItems = new Map<number, KapItem>();
let lastFetchTimestamp = 0;

export async function GET() {
  const now = Date.now();

  // 15 saniyeden kısa aralıklarla çağrılırsa önbellekteki taze veriyi <1ms sürede dön
  if (now - lastFetchTimestamp < 15000 && cachedKapItems.size > 0) {
    const list = Array.from(cachedKapItems.values()).sort((a, b) => b.id - a.id);
    return NextResponse.json({
      success: true,
      count: list.length,
      data: list,
    });
  }

  try {
    const res = await fetch("https://bigpara.hurriyet.com.tr/haberler/kap-haberleri/", {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const html = await res.text();
      const reg = /<a[^>]+class="news-card__title"[^>]+href="([^"]*_ID(\d+)\/)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      const cards: { href: string; bigparaId: string; fullTitle: string }[] = [];

      while ((m = reg.exec(html)) !== null && cards.length < 25) {
        cards.push({
          href: m[1],
          bigparaId: m[2],
          fullTitle: m[3].replace(/<[^>]+>/g, "").trim(),
        });
      }

      // Her kart için resmi KAP ID'si ve kesin yayın saatini al
      const enrichedResults = await Promise.allSettled(
        cards.map(async (card) => {
          const bpIdNum = Number(card.bigparaId);
          // Eğer zaten hafızada varsa doğrudan döndür
          const existing = Array.from(cachedKapItems.values()).find((it) => it.id === bpIdNum);
          if (existing) return existing;

          try {
            const artRes = await fetch("https://bigpara.hurriyet.com.tr" + card.href, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
              },
              signal: AbortSignal.timeout(4500),
            });

            if (artRes.ok) {
              const artHtml = await artRes.text();
              const kapIdMatch = artHtml.match(/kap\.org\.tr\/Bildirim\/(\d+)/i);
              const dateMatch = artHtml.match(/"datePublished":\s*"(\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}:\d{2})[^"]*)"/);

              const officialId = kapIdMatch ? Number(kapIdMatch[1]) : Number(card.bigparaId);
              const exactTime = dateMatch ? dateMatch[2] : "--:--";
              const publishDateStr = dateMatch ? dateMatch[1] : "";
              const timestamp = publishDateStr ? new Date(publishDateStr).getTime() : officialId;

              // Hisse kodu ve başlık ayrıştır
              const rawTitle = card.fullTitle;
              const codeMatch = rawTitle.match(/\*\*\*([A-Z0-9]+)\*\*\*/i);
              const code = codeMatch ? codeMatch[1].toUpperCase() : "BIST";

              const remainder = rawTitle.replace(/\*\*\*([A-Z0-9]+)\*\*\*/i, "").trim();
              const firstParen = remainder.indexOf("(");
              let companyTitle = remainder;
              let subject = "Özel Durum Açıklaması";

              if (firstParen !== -1) {
                companyTitle = remainder.slice(0, firstParen).trim();
                subject = remainder.slice(firstParen).replace(/^\(|\)$/g, "").trim();
              }

              if (!companyTitle) companyTitle = `${code} Ortaklığı`;

              let type = "ÖDA";
              const subLower = subject.toLowerCase();
              if (subLower.includes("pay") || subLower.includes("geri alım")) type = "PGO";
              else if (subLower.includes("faaliyet") || subLower.includes("finansal") || subLower.includes("rapor") || subLower.includes("sorumluluk")) type = "FR";
              else if (subLower.includes("sözleşme") || subLower.includes("ihale") || subLower.includes("sipariş")) type = "SÖZ";
              else if (subLower.includes("genel kurul")) type = "GKK";
              else if (subLower.includes("sermaye") || subLower.includes("tahvil") || subLower.includes("ihraç") || subLower.includes("kira")) type = "İHR";

              const item: KapItem = {
                id: officialId,
                disclosureIndex: officialId,
                code,
                type,
                title: companyTitle,
                subject,
                summary: `${companyTitle} tarafından Kamuyu Aydınlatma Platformu'na iletilen bildirim: ${subject}. Resmi detaylar KAP bülteninde yayınlanmıştır.`,
                time: exactTime,
                timestamp,
                kapUrl: `https://www.kap.org.tr/tr/Bildirim/${officialId}`,
              };

              return item;
            }
          } catch {
            // ignore
          }

          // Fallback parsing from card title without subpage
          const rawTitle = card.fullTitle;
          const codeMatch = rawTitle.match(/\*\*\*([A-Z0-9]+)\*\*\*/i);
          const code = codeMatch ? codeMatch[1].toUpperCase() : "BIST";
          const rawNum = parseInt(card.bigparaId, 10);
          const officialId = rawNum > 100000000 ? rawNum - 100589669 : rawNum;

          const item: KapItem = {
            id: officialId,
            disclosureIndex: officialId,
            code,
            type: "ÖDA",
            title: rawTitle,
            subject: "Özel Durum Açıklaması",
            summary: rawTitle,
            time: "--:--",
            timestamp: officialId,
            kapUrl: `https://www.kap.org.tr/tr/Bildirim/${officialId}`,
          };
          return item;
        })
      );

      enrichedResults.forEach((res) => {
        if (res.status === "fulfilled" && res.value && res.value.id) {
          cachedKapItems.set(res.value.id, res.value);
        }
      });

      lastFetchTimestamp = now;
    }
  } catch {
    // ignore
  }

  const list = Array.from(cachedKapItems.values()).sort((a, b) => b.id - a.id);

  return NextResponse.json({
    success: true,
    count: list.length,
    data: list,
  });
}
