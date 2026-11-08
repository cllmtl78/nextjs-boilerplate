import { NextResponse } from "next/server";
import { getCurrencyCatalog } from "@/lib/frankfurter-catalog";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json({ ...await getCurrencyCatalog(), source: "Frankfurter" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Para birimi listesi şu anda alınamıyor." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
