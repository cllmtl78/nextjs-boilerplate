type Kayit = { fiyat: number; onceki: number };

async function getir(sembol: string): Promise<Kayit | null> {
  try {
    const cevap = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        sembol
      )}?range=1d&interval=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        next: { revalidate: 60 },
      }
    );
    const json = await cevap.json();
    const meta = json.chart.result[0].meta;
    return {
      fiyat: meta.regularMarketPrice,
      onceki: meta.chartPreviousClose,
    };
  } catch {
    return null;
  }
}

function yaz(sayi: number, basamak: number) {
  return sayi.toLocaleString("tr-TR", {
    minimumFractionDigits: basamak,
    maximumFractionDigits: basamak,
  });
}

type Oge = { ad: string; deger: string; degisim: number | null };

export default async function MarketBar() {
  const [usd, eur, bist, ons, gumus, btc, brent] = await Promise.all([
    getir("USDTRY=X"),
    getir("EURTRY=X"),
    getir("XU100.IS"),
    getir("GC=F"),
    getir("SI=F"),
    getir("BTC-USD"),
    getir("BZ=F"),
  ]);

  const yuzde = (k: Kayit | null) =>
    k ? ((k.fiyat - k.onceki) / k.onceki) * 100 : null;

  const GRAM = 31.1035;
  const gramAltin =
    ons && usd
      ? {
          fiyat: (ons.fiyat * usd.fiyat) / GRAM,
          onceki: (ons.onceki * usd.onceki) / GRAM,
        }
      : null;
  const gramGumus =
    gumus && usd
      ? {
          fiyat: (gumus.fiyat * usd.fiyat) / GRAM,
          onceki: (gumus.onceki * usd.onceki) / GRAM,
        }
      : null;

  const ogeler: Oge[] = [
    { ad: "USD/TL", deger: usd ? yaz(usd.fiyat, 4) : "-", degisim: yuzde(usd) },
    { ad: "EUR/TL", deger: eur ? yaz(eur.fiyat, 4) : "-", degisim: yuzde(eur) },
    { ad: "BIST 100", deger: bist ? yaz(bist.fiyat, 2) : "-", degisim: yuzde(bist) },
    { ad: "Gram Altın", deger: gramAltin ? yaz(gramAltin.fiyat, 2) : "-", degisim: yuzde(gramAltin) },
    { ad: "Gram Gümüş", deger: gramGumus ? yaz(gramGumus.fiyat, 2) : "-", degisim: yuzde(gramGumus) },
    { ad: "BTC/USD", deger: btc ? yaz(btc.fiyat, 0) : "-", degisim: yuzde(btc) },
    { ad: "Brent Petrol", deger: brent ? yaz(brent.fiyat, 2) : "-", degisim: yuzde(brent) },
  ];

  // Kesintisiz akması için liste iki kez yazılıyor
  const kopya = [...ogeler, ...ogeler];

  return (
    <div className="ticker">
      <div className="ticker-track">
        {kopya.map((o, i) => (
          <div
            key={`${o.ad}-${i}`}
            className="ticker-item"
            aria-hidden={i >= ogeler.length}
          >
            <span className="ticker-ad">{o.ad}</span>
            <span className="ticker-deger">{o.deger}</span>
            {o.degisim !== null && (
              <span className={o.degisim >= 0 ? "yukari" : "asagi"}>
                {o.degisim >= 0 ? "▲" : "▼"} %{yaz(Math.abs(o.degisim), 2)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}