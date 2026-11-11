import { NextResponse } from "next/server";
import { checkSystemHealth, type SystemHealth } from "@/lib/system-status";

export const dynamic = "force-dynamic";
let cached: { data: SystemHealth; expires: number } | undefined;
let pending: Promise<SystemHealth> | undefined;

export async function GET() {
  if (!cached || cached.expires < Date.now()) {
    if (!pending) {
      const backend = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "https://bpt-news-backend.onrender.com";
      pending = checkSystemHealth(backend).then(data => {
        cached = { data, expires: Date.now() + 30_000 };
        return data;
      }).finally(() => { pending = undefined; });
    }
    await pending;
  }
  return NextResponse.json(cached!.data, { headers: { "Cache-Control": "no-store" } });
}
