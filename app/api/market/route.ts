import { NextResponse } from "next/server";
import { marketData } from "@/lib/market-data";
import { MARKET_INSTRUMENTS, emptyMarketItem } from "@/lib/market-types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await marketData.snapshot();
    return NextResponse.json(data, {status:data.success?200:503,headers:{"Cache-Control":"no-store"}});
  } catch {
    return NextResponse.json({success:false,partial:true,items:MARKET_INSTRUMENTS.map(emptyMarketItem)}, {status:503,headers:{"Cache-Control":"no-store"}});
  }
}
