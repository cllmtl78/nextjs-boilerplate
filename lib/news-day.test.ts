import { test } from "node:test";
import assert from "node:assert/strict";
import { isCurrentNewsDay, isCurrentNewsItem, newsTimestamp, untilIstanbulMidnight, watchIstanbulDay, resetDailyNewsCache, DAILY_NEWS_CACHE_KEYS } from "./news-day";

const before = Date.parse("2026-11-06T20:59:59Z");
const after = Date.parse("2026-11-06T21:00:00Z");

test("all three feeds exclude yesterday exactly at Istanbul midnight", () => {
  const bist = { timestamp: before };
  const global = { timestamp: before };
  const kap = { timestamp: before / 1000, date: "2026-11-06T23:59:59+03:00" };
  for (const item of [bist, global, kap]) {
    assert.equal(isCurrentNewsItem(item, before), true);
    assert.equal(isCurrentNewsItem(item, after), false);
  }
  assert.equal(isCurrentNewsDay("2026-11-07T00:00:00+03:00", after), true);
  assert.equal(isCurrentNewsDay("2026-11-06T23:59:59+03:00", after), false);
});

test("seconds, milliseconds, ISO dates, Turkish dates and date objects agree", () => {
  for (const value of [after, after / 1000, String(after), String(after / 1000), "2026-11-06T21:00:00Z", "2026-11-07T00:00:00", "2026-11-07", "07.11.2026 00:00", new Date(after)]) {
    assert.equal(newsTimestamp(value), after);
    assert.equal(isCurrentNewsDay(value, after), true);
  }
  for (const value of [null, undefined, NaN, Infinity, "23:59:59", "Bugün", "invalid"]) assert.equal(isCurrentNewsDay(value, after), false);
});

test("a date is used when timestamp is missing; a stale timestamp is not overridden", () => {
  assert.equal(isCurrentNewsItem({timestamp:null, date:"2026-11-07T00:00:00+03:00"}, after), true);
  assert.equal(isCurrentNewsItem({timestamp:before, date:"2026-11-07T00:00:00+03:00"}, after), false);
  assert.equal(isCurrentNewsItem({timestamp:after}, after), true);
});

test("midnight calculation handles month and year boundaries", () => {
  assert.equal(untilIstanbulMidnight(before), 1000);
  assert.equal(untilIstanbulMidnight(Date.parse("2026-12-31T20:59:59Z")), 1000);
  assert.equal(untilIstanbulMidnight(Date.parse("2026-11-30T20:59:59Z")), 1000);
  assert.equal(untilIstanbulMidnight(after), 86400000);
});

function fakeClock() {
  let now = before;
  let id = 0;
  const tasks = new Map<number, { at:number; callback:()=>void }>();
  const listeners = new Set<()=>void>();
  const clock = {
    now:()=>now,
    schedule:(callback:()=>void, delay:number)=>{ const key=++id; tasks.set(key,{at:now+delay,callback}); return key; },
    cancel:(key:number)=>{tasks.delete(key);},
    onWake:(callback:()=>void)=>{listeners.add(callback); return ()=>{listeners.delete(callback);};},
  };
  return {clock, jump:(ms:number)=>{now+=ms;}, wake:()=>{for(const callback of listeners) callback();}, advance:(ms:number)=>{
    now+=ms;
    for(const [key, task] of [...tasks]) if(task.at<=now) {tasks.delete(key); task.callback();}
  }};
}

test("an open page resets at midnight without waiting for a news request", () => {
  const fake=fakeClock(); let clears=0;
  const stop=watchIstanbulDay(()=>{clears++;},fake.clock);
  fake.advance(999); assert.equal(clears,0);
  fake.advance(2); assert.equal(clears,1);
  fake.wake(); fake.wake(); assert.equal(clears,1);
  fake.advance(86400000); assert.equal(clears,2);
  stop(); fake.advance(86400000); fake.wake(); assert.equal(clears,2);
});

test("a sleeping/background tab clears yesterday on wake even if timers did not run", () => {
  const fake=fakeClock(); let clears=0;
  const stop=watchIstanbulDay(()=>{clears++;},fake.clock);
  fake.jump(10*3600000); assert.equal(clears,0);
  fake.wake(); assert.equal(clears,1);
  fake.advance(1); assert.equal(clears,1);
  stop();
});

test("all three browser caches and legacy KAP caches clear together", () => {
  const data=new Map(DAILY_NEWS_CACHE_KEYS.map(key=>[key,"yesterday"]));
  data.set("unrelated-setting","keep");
  resetDailyNewsCache({removeItem:key=>{data.delete(key);},setItem:(key,value)=>{data.set(key,value);}},after);
  for(const key of DAILY_NEWS_CACHE_KEYS) assert.equal(data.has(key),false);
  assert.equal(data.get("bpt_kap_last_date"),"2026-11-07");
  assert.equal(data.get("unrelated-setting"),"keep");
});
