import { NextResponse } from "next/server";

export type ApiMarketItem = {
  kod: string;
  ad: string;
  fiyat: number;
  onceki: number;
  ondalik: number;
  degisimYuzde: number;
  yon: "yukari" | "asagi" | null;
};

// Yahoo Finance sembol listesi
const SYMBOLS = [
  { kod: "XU100", symbol: "XU100.IS", ad: "XU100", ondalik: 2 },
  { kod: "USDTRY", symbol: "USDTRY=X", ad: "USDTRY", ondalik: 4 },
  { kod: "EURTRY", symbol: "EURTRY=X", ad: "EURTRY", ondalik: 4 },
  { kod: "EURUSD", symbol: "EURUSD=X", ad: "EURUSD", ondalik: 4 },
  { kod: "XAUUSD", symbol: "GC=F", ad: "XAUUSD", ondalik: 2 },
  { kod: "BRENT", symbol: "BZ=F", ad: "BRENT", ondalik: 2 },
  { kod: "BTCUSD", symbol: "BTC-USD", ad: "BTCUSD", ondalik: 0 },
  { kod: "SI", symbol: "SI=F", ad: "XAGUSD", ondalik: 2 },
];

export async function GET() {
  try {
    const sonuclar = await Promise.all(
      SYMBOLS.map(async (item) => {
        try {
          const res = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${item.symbol}?interval=1d&range=1d`,
            {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
              },
              next: { revalidate: 15 },
            }
          );

          if (!res.ok) return null;
          const data = await res.json();
          const meta = data?.chart?.result?.[0]?.meta;
          if (!meta) return null;

          const fiyat = meta.regularMarketPrice ?? 0;
          const onceki = meta.chartPreviousClose || meta.previousClose || fiyat;
          const degisimYuzde = onceki > 0 ? ((fiyat - onceki) / onceki) * 100 : 0;
          const yon: "yukari" | "asagi" = fiyat >= onceki ? "yukari" : "asagi";

          return {
            kod: item.kod,
            ad: item.ad,
            fiyat,
            onceki,
            ondalik: item.ondalik,
            degisimYuzde,
            yon,
          };
        } catch {
          return null;
        }
      })
    );

    // Başarılı öğeleri topla
    const map = new Map<string, ApiMarketItem>();
    sonuclar.forEach((s) => {
      if (s) map.set(s.kod, s);
    });

    const usdtry = map.get("USDTRY")?.fiyat || 49.83;
    const usdOnceki = map.get("USDTRY")?.onceki || 49.78;
    const onsAltin = map.get("XAUUSD")?.fiyat || 4070.6;
    const onsAltinOnceki = map.get("XAUUSD")?.onceki || 4074.6;
    const onsGumus = map.get("SI")?.fiyat || 54.09;
    const onsGumusOnceki = map.get("SI")?.onceki || 54.51;

    // Gram Altın (XAU/TRY): (Ons / 31.1034768) * USDTRY
    const gramAltinFiyat = Number(((onsAltin / 31.1034768) * usdtry).toFixed(2));
    const gramAltinOnceki = Number(((onsAltinOnceki / 31.1034768) * usdOnceki).toFixed(2));
    const gramAltinYuzde = ((gramAltinFiyat - gramAltinOnceki) / gramAltinOnceki) * 100;

    // Çeyrek Altın (CEYREK): Gram Altın * 1.63
    const ceyrekFiyat = Number((gramAltinFiyat * 1.63).toFixed(2));
    const ceyrekOnceki = Number((gramAltinOnceki * 1.63).toFixed(2));
    const ceyrekYuzde = ((ceyrekFiyat - ceyrekOnceki) / ceyrekOnceki) * 100;

    // Gram Gümüş (XAG/TRY): (Ons Gümüş / 31.1034768) * USDTRY
    const gramGumusFiyat = Number(((onsGumus / 31.1034768) * usdtry).toFixed(2));
    const gramGumusOnceki = Number(((onsGumusOnceki / 31.1034768) * usdOnceki).toFixed(2));
    const gramGumusYuzde = ((gramGumusFiyat - gramGumusOnceki) / gramGumusOnceki) * 100;

    // Bloomberg / FactSet tarzı endüstriyel sembol dizilişi
    const items: ApiMarketItem[] = [
      map.get("XU100") || { kod: "XU100", ad: "XU100", fiyat: 11165.44, onceki: 11151.03, ondalik: 2, degisimYuzde: 0.13, yon: "yukari" },
      map.get("USDTRY") || { kod: "USDTRY", ad: "USDTRY", fiyat: 49.833, onceki: 49.782, ondalik: 4, degisimYuzde: 0.10, yon: "yukari" },
      map.get("EURTRY") || { kod: "EURTRY", ad: "EURTRY", fiyat: 55.476, onceki: 55.364, ondalik: 4, degisimYuzde: 0.20, yon: "yukari" },
      {
        kod: "XAU/TRY",
        ad: "XAU/TRY",
        fiyat: gramAltinFiyat,
        onceki: gramAltinOnceki,
        ondalik: 2,
        degisimYuzde: gramAltinYuzde,
        yon: gramAltinFiyat >= gramAltinOnceki ? "yukari" : "asagi",
      },
      {
        kod: "CEYREK",
        ad: "CEYREK",
        fiyat: ceyrekFiyat,
        onceki: ceyrekOnceki,
        ondalik: 2,
        degisimYuzde: ceyrekYuzde,
        yon: ceyrekFiyat >= ceyrekOnceki ? "yukari" : "asagi",
      },
      map.get("XAUUSD") || { kod: "XAUUSD", ad: "XAUUSD", fiyat: 4070.6, onceki: 4074.6, ondalik: 2, degisimYuzde: -0.10, yon: "asagi" },
      map.get("BRENT") || { kod: "BRENT", ad: "BRENT", fiyat: 111.27, onceki: 109.41, ondalik: 2, degisimYuzde: 1.70, yon: "yukari" },
      map.get("EURUSD") || { kod: "EURUSD", ad: "EURUSD", fiyat: 1.1137, onceki: 1.1131, ondalik: 4, degisimYuzde: 0.05, yon: "yukari" },
      {
        kod: "XAG/TRY",
        ad: "XAG/TRY",
        fiyat: gramGumusFiyat,
        onceki: gramGumusOnceki,
        ondalik: 2,
        degisimYuzde: gramGumusYuzde,
        yon: gramGumusFiyat >= gramGumusOnceki ? "yukari" : "asagi",
      },
      map.get("BTCUSD") || { kod: "BTCUSD", ad: "BTCUSD", fiyat: 80771, onceki: 80800, ondalik: 0, degisimYuzde: -0.04, yon: "asagi" },
    ];

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      items,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: String(error),
      },
      { status: 500 }
    );
  }
}
