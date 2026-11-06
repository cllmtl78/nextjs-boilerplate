import { MARKET_INSTRUMENTS, MAX_MARKET_STALE_MS, emptyMarketItem, type MarketDefinition, type MarketItem } from "./market-types";

const YAHOO_HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];
const REFRESH_MS = 30_000;
const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;
function percentage(price:number, previous:number|null):number|null {
  const change=previous===null?NaN:(price-previous)/previous*100;
  return Number.isFinite(change)?change:null;
}
function retryDelay(response:Response,now:number):number {
  const header=response.headers.get("Retry-After");
  const seconds=header?Number(header):NaN;
  const delay=Number.isFinite(seconds)?seconds*1000:header?Date.parse(header)-now:NaN;
  return Number.isFinite(delay)?Math.max(60000,delay):60000;
}

function iso(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = new Date(typeof value === "number" ? (value >= 100_000_000_000 ? value : value * 1000) : value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function parseYahooQuote(def: MarketDefinition, body: unknown, now: number): MarketItem | null {
  const data = body as { chart?: { result?: { meta?: Record<string, unknown> }[] } };
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || meta.symbol !== def.yahoo || !positive(meta.regularMarketPrice)) return null;
  if (def.currency && meta.currency !== def.currency) return null;
  const previous = [meta.regularMarketPreviousClose, meta.previousClose, meta.chartPreviousClose].find(positive) ?? null;
  const change = percentage(meta.regularMarketPrice, previous);
  return { ...emptyMarketItem(def), fiyat:meta.regularMarketPrice, onceki:previous,
    degisimYuzde:change, yon:change === null || change === 0 ? null : change > 0 ? "yukari" : "asagi",
    status:"ok", source:"Yahoo Finance", fetchedAt:new Date(now).toISOString(), quoteTime:iso(meta.regularMarketTime),
    delayMinutes:typeof meta.exchangeDataDelayedBy === "number" && Number.isFinite(meta.exchangeDataDelayedBy) && meta.exchangeDataDelayedBy>=0 ? meta.exchangeDataDelayedBy : null };
}

export function parseMetalQuote(def: MarketDefinition, body: unknown, now: number): MarketItem | null {
  const data = body as {symbol?:unknown; price?:unknown; updatedAt?:unknown; previousClose?:unknown; currency?:unknown};
  if (!data || data.symbol !== def.metal || !positive(data.price)) return null;
  if(data.currency!==undefined&&data.currency!=="USD") return null;
  const previous = positive(data.previousClose) ? data.previousClose : null;
  const change = percentage(data.price,previous);
  return { ...emptyMarketItem(def), fiyat:data.price, onceki:previous, degisimYuzde:change,
    yon:change === null || change === 0 ? null : change > 0 ? "yukari" : "asagi", status:"ok",
    source:"Gold API · spot", fetchedAt:new Date(now).toISOString(), quoteTime:iso(data.updatedAt) };
}

export function calculateGram(def: MarketDefinition, metal: MarketItem | undefined, fx: MarketItem | undefined): MarketItem {
  if (!metal || !fx || !positive(metal.fiyat) || !positive(fx.fiyat)) return emptyMarketItem(def);
  const price = metal.fiyat*fx.fiyat/31.1034768;
  if(!positive(price)) return emptyMarketItem(def);
  const baseline = positive(metal.onceki) && positive(fx.onceki) ? metal.onceki*fx.onceki/31.1034768 : null;
  const previous = positive(baseline)?baseline:null;
  const change = percentage(price,previous);
  const times = [metal.quoteTime,fx.quoteTime].filter((value):value is string=>value!==null).sort();
  const fetched = [metal.fetchedAt,fx.fetchedAt].filter((value):value is string=>value!==null).sort();
  return { ...emptyMarketItem(def), fiyat:price, onceki:previous, degisimYuzde:change,
    yon:change===null||change===0?null:change>0?"yukari":"asagi",
    status:metal.status==="stale"||fx.status==="stale"?"stale":"ok",
    source:`Hesaplanan · ${metal.source} × ${fx.source}`, quoteTime:times.length===2?times[0]:null,
    fetchedAt:fetched.length===2?fetched[0]:null,
    delayMinutes:metal.delayMinutes!==null&&fx.delayMinutes!==null?Math.max(metal.delayMinutes,fx.delayMinutes):null };
}

export class MarketDataService {
  private lastGood = new Map<string, MarketItem>();
  private cached?: { at:number; data: MarketSnapshot };
  private inFlight?: Promise<MarketSnapshot>;
  private yahooRetryAt = 0;
  private metalRetryAt = 0;
  constructor(private fetcher: typeof fetch = (input,init)=>fetch(input,init), private clock:()=>number=Date.now) {}

  async snapshot(): Promise<MarketSnapshot> {
    if (this.inFlight) return this.inFlight;
    if (this.cached && this.clock()-this.cached.at < REFRESH_MS) return this.cached.data;
    this.inFlight=this.refresh().finally(()=>{this.inFlight=undefined;});
    return this.inFlight;
  }

  private async fetchQuote(def:MarketDefinition, deadline:AbortSignal):Promise<MarketItem|null> {
    if (def.metal) {
      if(this.metalRetryAt>this.clock()) return null;
      try {
        const response=await this.fetcher(`https://api.gold-api.com/price/${def.metal}`,{cache:"no-store",signal:AbortSignal.any([deadline,AbortSignal.timeout(3000)])});
        if(response.status===429) {this.metalRetryAt=this.clock()+retryDelay(response,this.clock());return null;}
        if (!response.ok) return null;
        return parseMetalQuote(def,await response.json(),this.clock());
      } catch {return null;}
    }
    if (!def.yahoo || this.yahooRetryAt>this.clock()) return null;
    for(const host of YAHOO_HOSTS) {
      if (deadline.aborted) return null;
      try {
        const symbol=encodeURIComponent(def.yahoo);
        const response=await this.fetcher(`https://${host}/v8/finance/chart/${symbol}?interval=1d&range=1d`,{
          headers:{"User-Agent":"Mozilla/5.0","Accept":"application/json"},cache:"no-store",signal:AbortSignal.any([deadline,AbortSignal.timeout(2500)])});
        if(response.status===429) {this.yahooRetryAt=this.clock()+retryDelay(response,this.clock());return null;}
        if(response.status===404) return null;
        if(!response.ok) continue;
        const quote=parseYahooQuote(def,await response.json(),this.clock());
        if(quote) return quote;
      }catch {/* Try the provider's secondary chart endpoint within the same deadline. */}
    }
    return null;
  }

  private async refresh():Promise<MarketSnapshot> {
    const direct=MARKET_INSTRUMENTS.filter(def=>def.kind!=="derived");
    const selected=new Map<string,MarketItem>();
    const deadline=AbortSignal.timeout(8000);
    let cursor=0;
    await Promise.all(Array.from({length:6},async()=>{
      while(cursor<direct.length) {
        const def=direct[cursor++];
        const fresh=await this.fetchQuote(def,deadline);
        if(fresh) {this.lastGood.set(def.kod,fresh);selected.set(def.kod,fresh);continue;}
        const old=this.lastGood.get(def.kod);
        if(old?.fetchedAt && this.clock()-Date.parse(old.fetchedAt)<=MAX_MARKET_STALE_MS) selected.set(def.kod,{...old,status:"stale"});
        else {this.lastGood.delete(def.kod);selected.set(def.kod,emptyMarketItem(def));}
      }
    }));
    const items=MARKET_INSTRUMENTS.map(def=>def.kind==="derived"
      ?calculateGram(def,selected.get(def.kod==="XAUTRYG"?"XAUUSD":"XAGUSD"),selected.get("USDTRY"))
      :selected.get(def.kod) ?? emptyMarketItem(def));
    const now=this.clock();
    const data={success:items.some(item=>item.fiyat!==null),timestamp:new Date(now).toISOString(),partial:items.some(item=>item.status!=="ok"),items};
    this.cached={at:now,data};
    return data;
  }
}

export interface MarketSnapshot {success:boolean;timestamp:string;partial:boolean;items:MarketItem[]}
export const marketData = new MarketDataService();
