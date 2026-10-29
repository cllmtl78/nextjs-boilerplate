import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const SYSTEM_INSTRUCTION = `Sen Bloomberg ve TradFi için çalışan kıdemli bir finans editörüsün. Sana verilen kısa Wall Street/Telegram haberini Türkçeye çevir.
KESİN KURALLAR:
1. 'AI' kelimesini asla 'Aı' veya benzeri yapma; doğrudan 'Yapay Zeka' olarak çevir.
2. Şirket isimlerini ASLA Türkçeleştirme ('Alphabet' şirketini 'alfabe' yapma, 'Alphabet' olarak koru; 'Jump Trading', 'Susquehanna', 'Marvell', 'Lumentum' olduğu gibi kalsın).
3. Özel isimleri ASLA çevirme: 'Warsh', 'Bessent', 'Trump', 'Powell', 'Vance' aynen kalsın.
4. Finansal terimleri koru: EPS, Capex, Rev, Est, Q1, Q2, Q3, Q4, FOMC, Fed kısaltmalarını büyük harfle bırak. 'Hard-liner' ifadesini 'şahin/katı tutumlu' olarak çevir, 'sert liner' yazma.
5. Sadece ve sadece çevrilmiş tek satırlık Türkçe sonucu döndür; açıklama, tırnak işareti veya fazladan hiçbir şey ekleme.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, texts, apiKey: clientApiKey } = body;

    const apiKey =
      clientApiKey?.trim() ||
      process.env.GEMINI_API_KEY ||
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
        return NextResponse.json({
          translated: cleanText,
          warning: "GEMINI_API_KEY bulunamadı, orijinal metin kullanıldı.",
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
          model: "gemini-3.8-flash",
          contents: cleanText,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            temperature: 0.1,
          },
        });

        const translated = response.text?.trim() || cleanText;
        return NextResponse.json({ translated });
      } catch (sdkErr) {
        // SDK çağrısı başarısız olursa REST API fallback'i dene
        try {
          const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
          const restRes = await fetch(restUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              system_instruction: {
                parts: [{ text: SYSTEM_INSTRUCTION }],
              },
              contents: [{ parts: [{ text: cleanText }] }],
              generationConfig: { temperature: 0.1 },
            }),
          });

          if (restRes.ok) {
            const data = await restRes.json();
            const candidateText =
              data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (candidateText) {
              return NextResponse.json({ translated: candidateText });
            }
          }
        } catch {
          // REST fallback de başarısız
        }

        console.error("Gemini translation error:", sdkErr);
        return NextResponse.json({ translated: cleanText });
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
