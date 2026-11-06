import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Compatibility endpoint: collection and translation run in the Python backend.
export async function GET() {
  const backend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://bpt-news-backend.onrender.com";
  try {
    const response = await fetch(`${backend.replace(/\/$/, "")}/api/global-news`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) throw new Error("Backend kullanılamıyor");
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, error: "Türkçe haber akışı geçici olarak kullanılamıyor", items: [] }, { status: 503 });
  }
}
