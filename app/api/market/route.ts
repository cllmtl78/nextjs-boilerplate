import { NextResponse } from "next/server";

export type ApiMarketItem = {
  kod: string;
  ad: string;
  fiyat: number;
  onceki: number;
  birim?: string;
  ondalik: number;
  degisimYuzde: number;
  yon: "yukari" | "asagi" | null;
};

// Yahoo Finance sembol listesi
const SYMBOLS = [
  { kod: "XU100", symbol: "XU100.IS", ad: "BIST 100", ondalik: 2 },
  { kod: "USDTRY", symbol: "USDTRY=X", ad: "Dolar/TL", ondalik: 4 },
  { kod: "EURTRY", symbol: "EURTRY=X", ad: "Euro/TL", ondalik: 4 },
  { kod: "EURUSD", symbol: "EURUSD=X", ad: "EUR/USD", ondalik: 4 },
  { kod: "XAUUSD", symbol: "GC=F", ad: "Ons Altın", birim: "$", ondalik: 2 },
  { kod: "BZ", symbol: "BZ=F", ad: "Brent Petrol", birim: "$", ondalik: 2 },
  { kod: "BTCUSD", symbol: "BTC-USD", ad: "Bitcoin", birim: "$", ondalik: 0 },
  { kod: "SI", symbol: "SI=F", ad: "Ons Gümüş", birim: "$", ondalik: 2 },
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
            birim: item.birim,
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

    // Gram Altın hesabı: (Ons / 31.1034768) * USDTRY
    const gramAltinFiyat = Number(((onsAltin / 31.1034768) * usdtry).toFixed(2));
    const gramAltinOnceki = Number(((onsAltinOnceki / 31.1034768) * usdOnceki).toFixed(2));
    const gramAltinYuzde = ((gramAltinFiyat - gramAltinOnceki) / gramAltinOnceki) * 100;

    // Çeyrek Altın hesabı: Gram Altın * 1.63 (yaklaşık 1.75 gr 22 ayar)
    const ceyrekFiyat = Number((gramAltinFiyat * 1.63).toFixed(2));
    const ceyrekOnceki = Number((gramAltinOnceki * 1.63).toFixed(2));
    const ceyrekYuzde = ((ceyrekFiyat - ceyrekOnceki) / ceyrekOnceki) * 100;

    // Gram Gümüş hesabı: (Ons Gümüş / 31.1034768) * USDTRY
    const gramGumusFiyat = Number(((onsGumus / 31.1034768) * usdtry).toFixed(2));
    const gramGumusOnceki = Number(((onsGumusOnceki / 31.1034768) * usdOnceki).toFixed(2));
    const gramGumusYuzde = ((gramGumusFiyat - gramGumusOnceki) / gramGumusOnceki) * 100;

    // Nihai sıralı liste
    const items: ApiMarketItem[] = [
      map.get("XU100") || { kod: "XU100", ad: "BIST 100", fiyat: 11165.44, onceki: 11151.03, ondalik: 2, degisimYuzde: 0.13, yon: "yukari" },
      map.get("USDTRY") || { kod: "USDTRY", ad: "Dolar/TL", fiyat: 49.833, onceki: 49.782, ondalik: 4, degisimYuzde: 0.10, yon: "yukari" },
      map.get("EURTRY") || { kod: "EURTRY", ad: "Euro/TL", fiyat: 55.476, onceki: 55.364, ondalik: 4, degisimYuzde: 0.20, yon: "yukari" },
      {
        kod: "GAU",
        ad: "Gram Altın",
        fiyat: gramAltinFiyat,
        onceki: gramAltinOnceki,
        birim: "TL",
        ondalik: 2,
        degisimYuzde: gramAltinYuzde,
        yon: gramAltinFiyat >= gramAltinOnceki ? "yukari" : "asagi",
      },
      {
        kod: "CEYREK",
        ad: "Çeyrek Altın",
        fiyat: ceyrekFiyat,
        onceki: ceyrekOnceki,
        birim: "TL",
        ondalik: 2,
        degisimYuzde: ceyrekYuzde,
        yon: ceyrekFiyat >= ceyrekOnceki ? "yukari" : "asagi",
      },
      map.get("XAUUSD") || { kod: "XAUUSD", ad: "Ons Altın", fiyat: 4070.6, onceki: 4074.6, birim: "$", ondalik: 2, degisimYuzde: -0.10, yon: "asagi" },
      map.get("BZ") || { kod: "BZ", ad: "Brent Petrol", fiyat: 111.27, onceki: 109.41, birim: "$", ondalik: 2, degisimYuzde: 1.70, yon: "yukari" },
      map.get("EURUSD") || { kod: "EURUSD", ad: "EUR/USD", fiyat: 1.1137, onceki: 1.1131, ondalik: 4, degisimYuzde: 0.05, yon: "yukari" },
      {
        kod: "GAG",
        ad: "Gram Gümüş",
        fiyat: gramGumusFiyat,
        onceki: gramGumusOnceki,
        birim: "TL",
        ondalik: 2,
        degisimYuzde: gramGumusYuzde,
        yon: gramGumusFiyat >= gramGumusOnceki ? "yukari" : "asagi",
      },
      map.get("BTCUSD") || { kod: "BTCUSD", ad: "Bitcoin", fiyat: 80771, onceki: 80800, birim: "$", ondalik: 0, degisimYuzde: -0.04, yon: "asagi" },
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
