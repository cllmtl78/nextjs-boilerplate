import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_INSTRUCTION = `Sen Bloomberg ve TradFi için çalışan kıdemli bir borsa bülteni editörüsün. Aşağıdaki Wall Street haberini Türkçeye çevir.
Kurallar:
- Özel isimleri ve şirketleri ASLA çevirme (Binance, Coinbase, Intel, Reddit, Amazon, Sandisk, Brian Armstrong aynen kalsın).
- Finans terimlerini koru: EPS, Revenue (Hasılat), Q1, Q2, Q3, Q4, Capex, Devops, Private key, Stock split (Hisse bölünmesi).
- Sadece tek satır Türkçe çeviriyi ver, tırnak veya açıklama ekleme.`;

async function fetchMyMemoryFallback(text: string): Promise<string> {
  try {
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|tr`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (res.ok) {
      const data = await res.json();
      const tr = data?.responseData?.translatedText;
      if (tr && typeof tr === "string" && !tr.includes("MYMEMORY WARNING")) {
        return tr.trim();
      }
    }
  } catch {
    // fallback error ignored
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
        const fallbackTranslation = await fetchMyMemoryFallback(cleanText);
        return NextResponse.json({
          translated: fallbackTranslation,
          source: "mymemory-fallback",
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
          contents: `Haber: ${cleanText}`,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.1,
          },
        });

        const translated = response.text?.trim() || "";
        if (translated) {
          const finalClean = translated
            .replace(/^["'“”«»]+|["'“”«»]+$/g, "")
            .replace(/^Haber:\s*/i, "")
            .trim();
          return NextResponse.json({ translated: finalClean, source: "gemini-sdk" });
        }
      } catch {
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
                      text: `${SYSTEM_INSTRUCTION}\n\nHaber: ${cleanText}`,
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
                .replace(/^Haber:\s*/i, "")
                .trim();
              return NextResponse.json({ translated: finalClean, source: "gemini-rest" });
            }
          }
        } catch {
          // REST fallback de başarısız
        }

        // Gemini erişilemediyse MyMemory ile çevir
        const fallbackText = await fetchMyMemoryFallback(cleanText);
        return NextResponse.json({ translated: fallbackText, source: "mymemory-fallback" });
      }
    }

    // Çoklu/Toplu metin çevirisi (Hız ve kota tasarrufu için toplu çeviri desteği)
    if (Array.isArray(texts) && texts.length > 0) {
      if (!apiKey) {
        return NextResponse.json({
          translations: texts.map((t: string) => t),
          warning: "GEMINI_API_KEY bulunamadı.",
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
