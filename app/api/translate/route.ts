import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_INSTRUCTION = `Sen Bloomberg terminali için çalışan kıdemli bir borsa bülteni editörüsün. Aşağıdaki metni akıcı ve profesyonel finans Türkçesine çevir.
KESİN KURALLAR:
1. 'Strikes' kelimesi bağlama göre 'saldırılar / operasyonlar'dır, asla 'grev' olarak çevirme!
2. Şirket isimlerini ve borsa kodlarını koru: Binance, Intel, Sandisk, Reddit, Amazon, WSJ, Fed.
3. Kısaltmaları koru: Q1, Q2, Q3, Q4, EPS, Capex, Devops, Private key, Stock split (Hisse bölünmesi).
4. Cümle başları ve özel isimler BÜYÜK harfle başlasın, asla metni komple küçük harfe çevirme.
5. Sadece Türkçe çeviriyi tek satır olarak ver. Başına veya sonuna hiçbir işaret/açıklama koyma.`;

async function freeGoogleTranslate(text: string): Promise<string> {
  if (!text) return "";
  try {
    const preText = text
      .replace(/\bstrikes\b/gi, "military operations")
      .replace(/\bstrike\b/gi, "military operation");

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=tr&dt=t&q=${encodeURIComponent(preText)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && Array.isArray(data[0])) {
        const parts = data[0].map((chunk: [string, string]) => chunk[0]).filter(Boolean);
        let joined = parts.join("").trim();
        joined = joined
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
        return joined || text;
      }
    }
  } catch {
    // ignore
  }
  return text;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, texts, apiKey: clientApiKey } = body;

    const apiKey =
      clientApiKey?.trim() ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      "";

    // Tekil metin çevirisi
    if (text && typeof text === "string") {
      const cleanText = text
        .replace(/\$[A-Z]{1,6}\b/g, "")
        .replace(/^\[.*?\]\s*·?\s*/gi, "")
        .replace(/[•·]+$/, "")
        .trim();

      if (!cleanText) {
        return NextResponse.json({ translated: "" });
      }

    if (!apiKey) {
      const freeTr = await freeGoogleTranslate(cleanText);
      return NextResponse.json({
        translated: freeTr || cleanText,
        source: "google-translate-direct",
      });
    }

      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build",
            },
          },
        });

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: `Metin: ${cleanText}`,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.1,
          },
        });

        const translated = response.text?.trim() || "";
        if (translated) {
          const finalClean = translated
            .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
            .replace(/^Metin:\s*/i, "")
            .replace(/^Haber:\s*/i, "")
            .trim();
          return NextResponse.json({ translated: finalClean, source: "gemini-sdk" });
        }
      } catch (err: unknown) {
        let restErrorMsg = "";
        console.error("SDK generateContent error:", (err as Error)?.message || err);
        // SDK çağrısı başarısız olursa REST API fallback'i dene
        try {
          const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
          const restRes = await fetch(restUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `${SYSTEM_INSTRUCTION}\n\nMetin: ${cleanText}`,
                    },
                  ],
                },
              ],
            }),
          });

          if (restRes.ok) {
            const data = await restRes.json();
            const candidateText =
              data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (candidateText) {
              const finalClean = candidateText
                .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
                .replace(/^Metin:\s*/i, "")
                .replace(/^Haber:\s*/i, "")
                .trim();
              return NextResponse.json({ translated: finalClean, source: "gemini-rest" });
            }
          } else {
            const errText = await restRes.text();
            restErrorMsg = `Status ${restRes.status}: ${errText}`;
            console.error("REST generateContent error status:", restRes.status, errText);
          }
        } catch (restErr: unknown) {
          restErrorMsg = (restErr as Error)?.message || String(restErr);
          console.error("REST fallback error:", restErrorMsg);
        }

        const fallbackTr = await freeGoogleTranslate(cleanText);
        return NextResponse.json({
          translated: fallbackTr || cleanText,
          source: "google-translate-fallback",
        });
      }
    }

    // Çoklu/Toplu metin çevirisi (Hız ve kota tasarrufu için toplu çeviri desteği)
    if (Array.isArray(texts) && texts.length > 0) {
      if (!apiKey) {
        const translations = await Promise.all(
          texts.map((t: string) => freeGoogleTranslate(t))
        );
        return NextResponse.json({
          translations,
          source: "google-translate-batch",
        });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const prompt = `Aşağıdaki numaralandırılmış Wall Street/Telegram haberlerini yukarıdaki kurallara göre tek tek Türkçeye çevir. Her satıra sadece "1. Çeviri", "2. Çeviri" formatında cevap ver:\n\n${texts
        .map((t: string, i: number) => `${i + 1}. ${t}`)
        .join("\n")}`;

      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.1,
          },
        });

        const lines = (response.text || "").split("\n").filter((l) => l.trim().length > 0);
        const translations: string[] = texts.map((t: string, i: number) => {
          const found = lines.find((l) => l.trim().startsWith(`${i + 1}.`));
          if (found) {
            return found.replace(/^\d+\.\s*/, "").trim();
          }
          return t;
        });

        return NextResponse.json({ translations });
      } catch {
        return NextResponse.json({ translations: texts });
      }
    }

    return NextResponse.json({ error: "Eksik metin parametresi" }, { status: 400 });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Bilinmeyen hata";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
