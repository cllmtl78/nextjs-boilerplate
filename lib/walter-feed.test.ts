import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { cleanWireText, wireHtmlToText, istanbulDay } from "./wire-text";
import { parseWalterPosts, WalterFeed } from "./walter-feed";
import { WireTranslator, type WireTranslationInput } from "./wire-translation";
import { POST } from "../app/api/translate/route";
import { NextRequest } from "next/server";

function message(id: number, text: string, date = "2026-11-06T12:30:00Z") {
  return `<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="WalterBloomberg/${id}"><div class="tgme_widget_message_text js-message_text">${text}</div><a class="tgme_widget_message_date"><time datetime="${date}">15:30</time></a></div></div>`;
}

describe("WalterBloomberg source and text cleaning", () => {
  test("removes links, all asterisks and signatures without damaging names/numbers", () => {
    assert.equal(cleanWireText("*** Silver Lake & PIF: $MSFT drops 4.2% * (@WalterBloomberg) https://t.me/WalterBloomberg/42"), "Silver Lake & PIF: MSFT drops 4.2%");
    assert.equal(wireHtmlToText('S&amp;P 500 <b>FALLS 4%</b><br><a href="https://example.com">https://example.com</a> (@WalterBloomberg)'), "S&P 500 FALLS 4%");
    assert.equal(cleanWireText("Workers go on strike - NYT"), "Workers go on strike - NYT");
    assert.equal(cleanWireText("&#83;ilver Lake raises $2.5 billion"), "Silver Lake raises $2.5 billion");
  });

  test("reads nested Telegram text and actual timestamps, excluding channel decorations", () => {
    const html = '<header>Subscribe @WalterBloomberg</header>' + message(11, '<b>S&amp;P 500</b><div>FALLS 4%</div>* (@WalterBloomberg)') + message(12, 'NASDAQ 100 FALLS 6%', "2026-11-06T12:31:00Z");
    const posts = parseWalterPosts(html);
    assert.equal(posts.length, 2);
    assert.equal(posts[0].id, "WalterBloomberg/12");
    assert.equal(posts[1].rawText, "S&P 500 FALLS 4%");
    assert.equal(posts[1].zaman, "15:30:00");
    assert.equal(posts[1].timestamp, Date.parse("2026-11-06T12:30:00Z"));
  });

  test("skips link-only posts, wrong channels and invalid timestamps", () => {
    assert.equal(parseWalterPosts(message(1, 'https://example.com * (@WalterBloomberg)')).length, 0);
    assert.equal(parseWalterPosts(message(1, 'A real news item', 'not-a-date')).length, 0);
    assert.equal(parseWalterPosts(message(1, 'A real news item').replace('data-post="WalterBloomberg/', 'data-post="trad_fin/')).length, 0);
  });

  test("backfills today's posts, deduplicates and stops at Istanbul midnight", async () => {
    const requested: string[] = [];
    const feed = new WalterFeed((async input => {
      const url = String(input); requested.push(url);
      return new Response(url.includes('before=')
        ? message(9, 'OLDER TODAY') + message(8, 'YESTERDAY', '2026-11-05T20:59:00Z')
        : message(11, 'NEW TODAY') + message(10, 'TODAY AT MIDNIGHT', '2026-11-05T21:01:00Z'));
    }) as typeof fetch);
    const now = Date.parse('2026-11-06T13:00:00Z');
    const posts = await feed.getPosts(now);
    assert.deepEqual(posts.map(post => post.id), ['WalterBloomberg/11', 'WalterBloomberg/9', 'WalterBloomberg/10']);
    assert.equal(requested.length, 2);
    assert.ok(requested[1].includes('before=10'));
    await feed.getPosts(now + 1000);
    assert.equal(requested.length, 2);
    assert.equal(istanbulDay(Date.parse('2026-11-05T21:01:00Z')), '2026-11-06');
  });

  test("loads 200 posts instead of stopping at Telegram's latest page", async () => {
    let calls = 0;
    const feed = new WalterFeed((async input => {
      calls++;
      const before = Number(new URL(String(input)).searchParams.get('before') || 201);
      return new Response(Array.from({length:20}, (_, i) => message(before - i - 1, `NEWS ${before - i - 1}`)).join(''));
    }) as typeof fetch);
    const posts = await feed.getPosts(Date.parse('2026-11-06T13:00:00Z'));
    assert.equal(posts.length, 200);
    assert.equal(calls, 10);
    assert.equal(new Set(posts.map(post => post.id)).size, 200);
  });

  test("concurrent clients share one source refresh and recover after Telegram fails", async () => {
    let calls = 0;
    const feed = new WalterFeed((async () => {
      calls++;
      if (calls === 1) return new Response('Unavailable', {status:503});
      return new Response(message(1, 'NEWS', '2026-11-05T21:00:00Z') + message(0, 'OLD', '2026-11-05T20:00:00Z'));
    }) as typeof fetch);
    const now = Date.parse('2026-11-06T12:00:00Z');
    await assert.rejects(feed.getPosts(now));
    const [a,b] = await Promise.all([feed.getPosts(now), feed.getPosts(now)]);
    assert.equal(calls, 2);
    assert.deepEqual(a,b);
    assert.equal(a.length,1);
  });
});

describe("server-side news translation", () => {
  test("maps translations by message ID, not output order; leaves labor strikes intact", async () => {
    const translator = new WireTranslator(async items => {
      assert.equal(items[0].text, 'Workers go on strike - NYT');
      return [{id:items[1].id, text:'İran saldırıları değerlendiriyor.'}, {id:items[0].id, text:'New York Times’a göre işçiler greve gidiyor.'}];
    });
    const result = await translator.translate([{id:'1', text:'Workers go on strike - NYT'}, {id:'2',text:'Iran considers strikes'}]);
    assert.equal(result.get('1'), 'New York Times’a göre işçiler greve gidiyor.');
    assert.equal(result.get('2'), 'İran saldırıları değerlendiriyor.');
  });

  test("full-source cache distinguishes matching prefixes and revised messages", async () => {
    let calls = 0;
    const translator = new WireTranslator(async items => { calls++; return items.map(item => ({id:item.id,text:`Türkçe haber ${item.text.endsWith('up') ? 'yükseliyor' : 'düşüyor'}`})); });
    const prefix = 'The S&P 500 and Nasdaq futures are moving ';
    const posts = [{id:'1',text:prefix+'up'}, {id:'2',text:prefix+'down'}];
    const result = await translator.translate(posts);
    assert.notEqual(result.get('1'), result.get('2'));
    await translator.translate(posts);
    assert.equal(calls,1);
    await translator.translate([{id:'1',text:prefix+'down'}]);
    assert.equal(calls,1); // same full source already translated for message 2
    assert.equal(translator.getCached([{id:'1',text:prefix+'down'}]).get('1'), 'Türkçe haber düşüyor');
  });

  test("incrementally translates up to 200 messages without repeating successful batches", async () => {
    const batches: WireTranslationInput[][] = [];
    const translator = new WireTranslator(async items => { batches.push(items); return items.map(item=>({id:item.id,text:`Türkçe haber ${item.id}`})); });
    const items = Array.from({length:200},(_,i)=>({id:String(i),text:`English news ${i}`}));
    for(let i=0;i<10;i++) await translator.translate(items);
    assert.equal(translator.getCached(items).size,200);
    assert.equal(batches.length,10);
    assert.equal(new Set(batches.flatMap(batch=>batch.map(item=>item.id))).size,200);
  });

  test("does not cache malformed or untranslated responses and retries them", async () => {
    let calls=0;
    const translator = new WireTranslator(async items => { calls++; return calls===1 ? [{id:'wrong',text:'Başka haber'}] : [{id:items[0].id,text:'Haber doğru çevrildi.'}]; });
    const items = [{id:'1',text:'The real news'}];
    await assert.rejects(translator.translate(items));
    assert.equal(translator.getCached(items).size,0);
    assert.equal((await translator.translate(items)).get('1'),'Haber doğru çevrildi.');
    const noTranslation = new WireTranslator(async items=>items);
    await assert.rejects(noTranslation.translate(items));
  });

  test("simultaneous translations share successful cached work", async () => {
    let calls=0;
    const translator = new WireTranslator(async items=>{ calls++; await new Promise(resolve=>setTimeout(resolve,1)); return items.map(item=>({id:item.id,text:'Şirket görüşmelere başladı.'})); });
    const input=[{id:'1',text:'Company begins talks'}];
    await Promise.all([translator.translate(input),translator.translate(input)]);
    assert.equal(calls,1);
  });

  test("one unchanged translation does not hide the other translated news", async () => {
    const translator = new WireTranslator(async items=>[
      {id:items[0].id,text:items[0].text},
      {id:items[1].id,text:'Şirketin kârı arttı.'},
    ]);
    const result = await translator.translate([{id:'1',text:'Untranslated text'}, {id:'2',text:'Company profit rises'}]);
    assert.equal(result.size,1);
    assert.equal(result.get('2'),'Şirketin kârı arttı.');
  });

  test("missing server key is explicit rather than a low-quality fallback", {skip:!!process.env.GEMINI_API_KEY}, async () => {
    const request = new NextRequest('http://localhost/api/translate', {method:'POST',body:JSON.stringify({text:'A company starts talks'})});
    const response = await POST(request);
    assert.equal(response.status,503);
    const body = await response.json();
    assert.equal(body.translated,undefined);
  });

  test("translation API rejects malformed inputs instead of echoing English", async () => {
    const request = new NextRequest('http://localhost/api/translate', {method:'POST', body:JSON.stringify({texts:[1]})});
    assert.equal((await POST(request)).status,400);
    const invalid = new NextRequest('http://localhost/api/translate', {method:'POST', body:'not json'});
    assert.equal((await POST(invalid)).status,400);
  });
});
