import { NextRequest, NextResponse } from "next/server";
import { globalWireTranslator } from "@/lib/wire-translation";
import { cleanWireText } from "@/lib/wire-text";

export async function POST(req: NextRequest) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 }); }
  const list = typeof body?.text === "string" ? [body.text] : body?.texts;
  if (!Array.isArray(list) || list.length === 0 || list.length > 20 || list.some(text => typeof text !== "string" || text.length > 10000)) {
    return NextResponse.json({ error: "1–20 adet metin gönderilmeli" }, { status: 400 });
  }
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Çeviri hizmeti hazır değil" }, { status: 503 });
  const items = list.map((text: string, index: number) => ({ id: String(index), text: cleanWireText(text) }));
  const nonempty = items.filter(item => item.text);
  try {
    const translated = await globalWireTranslator.translate(nonempty);
    const translations = items.map(item => translated.get(item.id) || "");
    return NextResponse.json(typeof body.text === "string" ? { translated: translations[0], source: "gemini" } : { translations, source: "gemini" });
  } catch {
    console.warn("[Global] Haber çevirisi tamamlanamadı; düşük kaliteli yedek çeviri kullanılmadı");
    return NextResponse.json({ error: "Çeviri hizmeti geçici olarak kullanılamıyor" }, { status: 503 });
  }
}
