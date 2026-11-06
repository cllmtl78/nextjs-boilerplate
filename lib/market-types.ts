export type InstrumentKind = "index" | "fx" | "spot" | "futures" | "crypto" | "derived";
export interface MarketDefinition {
  kod: string;
  description: string;
  digits: number;
  kind: InstrumentKind;
  yahoo?: string;
  metal?: "XAU" | "XAG";
  currency?: string;
}

export const MARKET_INSTRUMENTS: readonly MarketDefinition[] = [
  { kod:"BIST100", description:"BIST 100 endeksi", digits:2, kind:"index", yahoo:"XU100.IS", currency:"TRY" },
  { kod:"SPX", description:"S&P 500 endeksi", digits:2, kind:"index", yahoo:"^GSPC", currency:"USD" },
  { kod:"KOSPI", description:"Güney Kore KOSPI endeksi", digits:2, kind:"index", yahoo:"^KS11", currency:"KRW" },
  { kod:"NI225", description:"Japonya Nikkei 225 endeksi", digits:2, kind:"index", yahoo:"^N225", currency:"JPY" },
  { kod:"DXY", description:"ABD Dolar Endeksi", digits:2, kind:"index", yahoo:"DX-Y.NYB" },
  { kod:"EURUSD", description:"Euro / ABD doları", digits:4, kind:"fx", yahoo:"EURUSD=X", currency:"USD" },
  { kod:"BRENT", description:"Brent petrol vadeli kontratı · USD/varil", digits:2, kind:"futures", yahoo:"BZ=F", currency:"USD" },
  { kod:"WTI", description:"WTI petrol vadeli kontratı · USD/varil", digits:2, kind:"futures", yahoo:"CL=F", currency:"USD" },
  { kod:"USDTRY", description:"ABD doları / Türk lirası", digits:4, kind:"fx", yahoo:"USDTRY=X", currency:"TRY" },
  { kod:"EURTRY", description:"Euro / Türk lirası", digits:4, kind:"fx", yahoo:"EURTRY=X", currency:"TRY" },
  { kod:"GBPTRY", description:"İngiliz sterlini / Türk lirası", digits:4, kind:"fx", yahoo:"GBPTRY=X", currency:"TRY" },
  { kod:"XAUUSD", description:"Spot altın · USD/troy ons", digits:2, kind:"spot", metal:"XAU" },
  { kod:"XAUTRYG", description:"Hesaplanan gram altın · TRY/gram; spot ons × USDTRY / 31.1034768", digits:2, kind:"derived" },
  { kod:"XAGUSD", description:"Spot gümüş · USD/troy ons", digits:3, kind:"spot", metal:"XAG" },
  { kod:"XAGTRYG", description:"Hesaplanan gram gümüş · TRY/gram; spot ons × USDTRY / 31.1034768", digits:2, kind:"derived" },
  { kod:"BTCUSD", description:"Bitcoin / ABD doları", digits:2, kind:"crypto", yahoo:"BTC-USD", currency:"USD" },
  { kod:"ETHUSD", description:"Ethereum / ABD doları", digits:2, kind:"crypto", yahoo:"ETH-USD", currency:"USD" },
];

export const MAX_MARKET_STALE_MS = 15 * 60_000;
export interface MarketItem {
  kod: string;
  ad: string;
  fiyat: number | null;
  onceki: number | null;
  ondalik: number;
  degisimYuzde: number | null;
  yon: "yukari" | "asagi" | null;
  status: "ok" | "stale" | "unavailable";
  source: string | null;
  quoteTime: string | null;
  fetchedAt: string | null;
  delayMinutes: number | null;
}

export function emptyMarketItem(def: MarketDefinition): MarketItem {
  return { kod:def.kod, ad:def.kod, fiyat:null, onceki:null, ondalik:def.digits, degisimYuzde:null, yon:null, status:"unavailable", source:null, quoteTime:null, fetchedAt:null, delayMinutes:null };
}

export function expireMarketItems(items: MarketItem[], now = Date.now()): MarketItem[] {
  return MARKET_INSTRUMENTS.map(def => {
    const item = items.find(row => row.kod === def.kod);
    if (!item || item.fiyat === null || !item.fetchedAt || now - Date.parse(item.fetchedAt) > MAX_MARKET_STALE_MS || now-Date.parse(item.fetchedAt)<-60000 || !Number.isFinite(Date.parse(item.fetchedAt))) return emptyMarketItem(def);
    return { ...item, status:"stale" };
  });
}

export function normalizeMarketItems(rows: unknown, now=Date.now()): MarketItem[] {
  return MARKET_INSTRUMENTS.map(def=>{
    if(!Array.isArray(rows)) return emptyMarketItem(def);
    const row=rows.find(item=>item?.kod===def.kod);
    if(!row || (row.status!=="ok"&&row.status!=="stale") || typeof row.fiyat!=="number" || !Number.isFinite(row.fiyat) || row.fiyat<=0) return emptyMarketItem(def);
    const received=typeof row.fetchedAt==="string"?Date.parse(row.fetchedAt):NaN;
    if(!Number.isFinite(received)||now-received>MAX_MARKET_STALE_MS||received-now>60000) return emptyMarketItem(def);
    const previous=typeof row.onceki==="number"&&Number.isFinite(row.onceki)&&row.onceki>0?row.onceki:null;
    const change=previous!==null&&typeof row.degisimYuzde==="number"&&Number.isFinite(row.degisimYuzde)?row.degisimYuzde:null;
    return {...emptyMarketItem(def),fiyat:row.fiyat,onceki:previous,degisimYuzde:change,
      yon:change===null||change===0?null:change>0?"yukari":"asagi",status:row.status,
      source:typeof row.source==="string"?row.source:null,quoteTime:typeof row.quoteTime==="string"?row.quoteTime:null,
      fetchedAt:row.fetchedAt,delayMinutes:typeof row.delayMinutes==="number"?row.delayMinutes:null};
  });
}

export function mergeMarketItems(previous: MarketItem[], next: MarketItem[], now=Date.now()): MarketItem[] {
  const retained=expireMarketItems(previous,now);
  return MARKET_INSTRUMENTS.map((def,index)=>next.find(item=>item.kod===def.kod&&item.fiyat!==null) ?? retained[index]);
}
