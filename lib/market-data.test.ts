import {test} from "node:test";
import assert from "node:assert/strict";
import {MarketDataService,parseYahooQuote,parseMetalQuote,calculateGram} from "./market-data";
import {MARKET_INSTRUMENTS,emptyMarketItem,expireMarketItems,normalizeMarketItems,mergeMarketItems,MAX_MARKET_STALE_MS} from "./market-types";
import {GET} from "../app/api/market/route";

const NOW=Date.parse('2026-11-06T18:00:00Z');
const def=(code:string)=>MARKET_INSTRUMENTS.find(item=>item.kod===code)!;
function yahoo(symbol:string,price=110,previous:number|undefined=100) {
 const instrument=MARKET_INSTRUMENTS.find(item=>item.yahoo===symbol)!;
 return {chart:{result:[{meta:{symbol,currency:instrument.currency||'USD',regularMarketPrice:price,previousClose:previous,regularMarketTime:NOW/1000,exchangeDataDelayedBy:15}}]}};
}
function healthy(input:RequestInfo|URL) {
 const url=new URL(String(input));
 if(url.hostname==='api.gold-api.com')return Response.json({symbol:url.pathname.split('/').pop(),price:3110.34768,updatedAt:new Date(NOW).toISOString()});
 return Response.json(yahoo(decodeURIComponent(url.pathname.split('/').pop()!)));
}

test('exactly 17 requested display symbols and correct underlying instruments',()=>{
 assert.deepEqual(MARKET_INSTRUMENTS.map(item=>item.kod),['BIST100','SPX','KOSPI','NI225','DXY','EURUSD','BRENT','WTI','USDTRY','EURTRY','GBPTRY','XAUUSD','XAUTRYG','XAGUSD','XAGTRYG','BTCUSD','ETHUSD']);
 assert.equal(def('SPX').yahoo,'^GSPC');assert.equal(def('KOSPI').yahoo,'^KS11');assert.equal(def('NI225').yahoo,'^N225');
 assert.equal(def('DXY').yahoo,'DX-Y.NYB');assert.equal(def('WTI').yahoo,'CL=F');
 assert.equal(def('XAUUSD').kind,'spot');assert.equal(def('XAUUSD').metal,'XAU');assert.equal(def('XAUUSD').yahoo,undefined);
 assert.equal(def('XAGUSD').metal,'XAG');
});

test('quotes use the actual previous close and validate symbol, currency and price',()=>{
 const body=yahoo('^GSPC',110,100); Object.assign(body.chart.result[0].meta,{chartPreviousClose:80});
 const quote=parseYahooQuote(def('SPX'),body,NOW)!;
 assert.equal(quote.fiyat,110);assert.equal(quote.onceki,100);assert.equal(quote.degisimYuzde,10);assert.equal(quote.delayMinutes,15);
 assert.equal(parseYahooQuote(def('KOSPI'),body,NOW),null);
 for(const price of [0,-1,NaN,Infinity]) assert.equal(parseYahooQuote(def('SPX'),yahoo('^GSPC',price),NOW),null);
 const wrongCurrency=yahoo('^GSPC');wrongCurrency.chart.result[0].meta.currency='TRY';
 assert.equal(parseYahooQuote(def('SPX'),wrongCurrency,NOW),null);
 const noClose=yahoo('^GSPC');delete (noClose.chart.result[0].meta as {previousClose?:number}).previousClose;
 assert.equal(parseYahooQuote(def('SPX'),noClose,NOW)!.degisimYuzde,null);
});

test('spot metals retain real prices without inventing a previous close or percent',()=>{
 const quote=parseMetalQuote(def('XAUUSD'),{symbol:'XAU',price:3110.34768,updatedAt:new Date(NOW).toISOString()},NOW)!;
 assert.equal(quote.onceki,null);assert.equal(quote.degisimYuzde,null);assert.equal(quote.yon,null);
 assert.equal(parseMetalQuote(def('XAGUSD'),{symbol:'XAU',price:3110.34768},NOW),null);
 assert.equal(parseMetalQuote(def('XAUUSD'),{symbol:'XAU',price:0},NOW),null);
 assert.equal(parseMetalQuote(def('XAUUSD'),{symbol:'XAU',price:3000,currency:'EUR'},NOW),null);
 assert.equal(parseMetalQuote(def('XAUUSD'),{symbol:'XAU',price:3000,updatedAt:NOW},NOW)!.quoteTime,new Date(NOW).toISOString());
});

test('gram prices need both real inputs and propagate missing closes/stale status',()=>{
 const metal=parseMetalQuote(def('XAUUSD'),{symbol:'XAU',price:3110.34768,previousClose:2488.278144,updatedAt:new Date(NOW).toISOString()},NOW)!;
 const fx=parseYahooQuote(def('USDTRY'),yahoo('USDTRY=X',30,25),NOW)!;
 const gram=calculateGram(def('XAUTRYG'),metal,fx);
 assert.ok(Math.abs(gram.fiyat!-3000)<.00001);assert.ok(Math.abs(gram.onceki!-2000)<.00001);assert.ok(Math.abs(gram.degisimYuzde!-50)<.00001);
 assert.equal(calculateGram(def('XAUTRYG'),metal,undefined).fiyat,null);
 assert.equal(calculateGram(def('XAUTRYG'),{...metal,onceki:null},fx).degisimYuzde,null);
 assert.equal(calculateGram(def('XAUTRYG'),{...metal,status:'stale'},fx).status,'stale');
});

test('concurrent requests and refreshes share one provider snapshot',async()=>{
 let calls=0;let now=NOW;
 const service=new MarketDataService((async input=>{calls++;return healthy(input);}) as typeof fetch,()=>now);
 const [a,b]=await Promise.all([service.snapshot(),service.snapshot()]);
 assert.equal(calls,15);assert.deepEqual(a,b);assert.equal(a.items.length,17);assert.ok(a.items.every(item=>item.fiyat!==null));
 await service.snapshot();assert.equal(calls,15);
 now+=31000;await service.snapshot();assert.equal(calls,30);
});

test('secondary Yahoo endpoint recovers failures but spot never falls back to futures',async()=>{
 const requests:string[]=[];
 const service=new MarketDataService((async input=>{
  const url=String(input);requests.push(url);
  if(url.includes('query1')&&url.includes('GSPC'))return new Response('failure',{status:503});
  return healthy(input);
 }) as typeof fetch,()=>NOW);
 const data=await service.snapshot();
 assert.equal(data.items.find(item=>item.kod==='SPX')!.fiyat,110);
 assert.ok(requests.some(url=>url.includes('query2')&&url.includes('GSPC')));
 assert.ok(!requests.some(url=>url.includes('GC%3DF')||url.includes('SI%3DF')));
});

test('partial failures preserve marked last-good data, and expired data becomes unavailable',async()=>{
 let fail=false;let now=NOW;
 const service=new MarketDataService((async input=>fail?new Response('failed',{status:503}):healthy(input)) as typeof fetch,()=>now);
 const first=await service.snapshot();fail=true;now+=31000;
 const stale=await service.snapshot();
 assert.ok(stale.items.every(item=>item.status==='stale'));
 assert.equal(stale.items[0].fiyat,first.items[0].fiyat);assert.equal(stale.items[0].fetchedAt,first.items[0].fetchedAt);
 now+=MAX_MARKET_STALE_MS;
 const expired=await service.snapshot();assert.equal(expired.success,false);assert.ok(expired.items.every(item=>item.fiyat===null&&item.status==='unavailable'));
});

test('rate limits honor Retry-After instead of retrying on every visitor',async()=>{
 let calls=0;let now=NOW;
 const service=new MarketDataService((async()=>{calls++;return new Response('limited',{status:429,headers:{'Retry-After':'120'}});}) as typeof fetch,()=>now);
 await service.snapshot();const firstCalls=calls;
 now+=31000;await service.snapshot();assert.equal(calls,firstCalls);
 now+=61000;await service.snapshot();assert.equal(calls,firstCalls);
 now+=31000;await service.snapshot();assert.ok(calls>firstCalls);
});

test('client preserves requested order, rejects malformed data and expires cached values',()=>{
 const quote=parseYahooQuote(def('SPX'),yahoo('^GSPC'),NOW)!;
 const normalized=normalizeMarketItems([quote,{...quote,kod:'unknown'}],NOW);
 assert.equal(normalized.length,17);assert.equal(normalized[1].fiyat,110);assert.equal(normalized[0].fiyat,null);
 assert.equal(normalizeMarketItems([{...quote,fiyat:'110'}],NOW)[1].fiyat,null);
 assert.equal(normalizeMarketItems([{...quote,fetchedAt:null}],NOW)[1].fiyat,null);
 assert.equal(expireMarketItems([quote],NOW+1000)[1].status,'stale');
 assert.equal(expireMarketItems([quote],NOW+MAX_MARKET_STALE_MS+1)[1].fiyat,null);
 assert.equal(mergeMarketItems([quote],MARKET_INSTRUMENTS.map(emptyMarketItem),NOW+1000)[1].status,'stale');
});

test('market API failure includes 17 placeholders without any synthetic prices',async()=>{
 const saved=globalThis.fetch;globalThis.fetch=(async()=>new Response('unavailable',{status:503})) as typeof fetch;
 try {
  const response=await GET();const body=await response.json();
  assert.equal(response.status,503);assert.equal(body.success,false);assert.equal(body.items.length,17);
  assert.ok(body.items.every((item:{fiyat:number|null})=>item.fiyat===null));
 }finally{globalThis.fetch=saved;}
});
