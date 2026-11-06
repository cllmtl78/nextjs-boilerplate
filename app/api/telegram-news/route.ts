import { NextResponse } from "next/server";
import { WalterFeed } from "@/lib/walter-feed";
import { globalWireTranslator } from "@/lib/wire-translation";
import { istanbulDay } from "@/lib/wire-text";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export interface TelegramNewsItem {
  id: string;
  zaman: string;
  timestamp: number;
  rawText: string;
  baslik: string;
}

const feed = new WalterFeed();
interface FeedResult { success: boolean; date: string; count: number; pending: number; items: TelegramNewsItem[] }
let cached: { at: number; data: FeedResult } | undefined;
let inFlight: Promise<FeedResult> | undefined;
let lastAttempt = 0;

async function refresh(): Promise<FeedResult> {
  const posts = await feed.getPosts();
  const inputs = posts.map(post => ({ id: post.id, text: post.rawText }));
  try {
    if (posts.length) await globalWireTranslator.translate(inputs, 20);
  } catch {
    console.warn("[Global] Gemini çevirisi kullanılamıyor; GEMINI_API_KEY, model erişimi ve kotayı kontrol edin");
  }
  const translated = globalWireTranslator.getCached(inputs);
  const items: TelegramNewsItem[] = posts.flatMap(post => {
    const baslik = translated.get(post.id);
    return baslik ? [{ ...post, baslik }] : [];
  });
  if (posts.length && !items.length) throw new Error("Türkçe haber akışı geçici olarak kullanılamıyor");
  const data = { success: true, date: istanbulDay(Date.now()), count: items.length, pending: posts.length - items.length, items };
  cached = { at: Date.now(), data };
  return data;
}

export async function GET() {
  try {
    if (cached && cached.data.date === istanbulDay(Date.now()) && Date.now() - cached.at < 15000) {
      return NextResponse.json(cached.data, { headers: { "Cache-Control": "no-store" } });
    }
    if (!inFlight) {
      if (Date.now() - lastAttempt < 15000) throw new Error("Yenileme bekleniyor");
      lastAttempt = Date.now();
      inFlight = refresh().finally(() => { inFlight = undefined; });
    }
    return NextResponse.json(await inFlight, { headers: { "Cache-Control": "no-store" } });
  } catch {
    if (cached?.data.date === istanbulDay(Date.now())) {
      return NextResponse.json({ ...cached.data, stale: true }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ success: false, error: "Türkçe haber akışı geçici olarak kullanılamıyor", count: 0, items: [] }, { status: 503 });
  }
}
