import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { displayCalendarTitle, localizeCalendarTitle } from "./calendar-titles";
import { translateCalendarTitles } from "./translate-calendar";
import { GET } from "../app/api/calendar/route";

describe("Turkish economic calendar titles", () => {
  test("translates every English title in the screenshot and retains the period", () => {
    const examples = {
      "Average Hourly Earnings MoM": "Ortalama Saatlik Kazançlar (Aylık)",
      "Average Hourly Earnings YoY": "Ortalama Saatlik Kazançlar (Yıllık)",
      "Government Payrolls": "Kamu Sektörü İstihdamı",
      "Participation Rate": "İşgücüne Katılım Oranı",
      "Manufacturing Payrolls": "İmalat Sektörü İstihdamı",
      "Retail Sales MoM": "Perakende Satışlar (Aylık)",
      "Retail Sales YoY": "Perakende Satışlar (Yıllık)",
    };
    for (const [english, turkish] of Object.entries(examples)) {
      assert.equal(localizeCalendarTitle(english), turkish);
      assert.equal(displayCalendarTitle(english), turkish);
    }
  });

  test("preserves core/sector/final distinctions and already Turkish names", () => {
    assert.equal(localizeCalendarTitle("Core CPI YoY Final"), "Çekirdek TÜFE Enflasyonu (Yıllık, Nihai)");
    assert.equal(localizeCalendarTitle("CPI YoY"), "TÜFE Enflasyonu (Yıllık)");
    assert.equal(localizeCalendarTitle("Core PCE Price Index MoM"), "Çekirdek Kişisel Tüketim Harcamaları Fiyat Endeksi (Aylık)");
    assert.equal(localizeCalendarTitle("GDP Growth Rate QoQ 2nd Est"), "GSYİH Büyüme Oranı (Çeyreklik, İkinci Tahmin)");
    assert.equal(localizeCalendarTitle("3-Month Bill Auction"), "3 Aylık Hazine Bonosu İhalesi");
    assert.equal(localizeCalendarTitle("2-Year JGB Auction"), "2 Yıllık Devlet Tahvili İhalesi");
    assert.equal(localizeCalendarTitle("TCMB Politika Faizi Kararı"), "TCMB Politika Faizi Kararı");
    assert.equal(localizeCalendarTitle("Retail Sales Special Unknown Measure"), null);
  });

  test("known indicators need no translation service", async () => {
    const saved = globalThis.fetch;
    globalThis.fetch = (() => { throw Error("Must not fetch"); }) as typeof fetch;
    try {
      const translated = await translateCalendarTitles(["Government Payrolls", "Participation Rate"]);
      assert.equal(translated.get("Government Payrolls"), "Kamu Sektörü İstihdamı");
    } finally { globalThis.fetch = saved; }
  });

  test("unknown indicators are translated, deduplicated and cached", async () => {
    const saved = globalThis.fetch;
    let requests = 0;
    globalThis.fetch = (async (input) => {
      assert.ok(String(input).includes("tl=tr"));
      requests++;
      return Response.json([[["Bölgesel İş Dünyası Araştırması", "Regional Business Survey"]], null, "en"]);
    }) as typeof fetch;
    try {
      const title = "Regional Business Survey";
      const translated = await translateCalendarTitles([title, title]);
      assert.equal(translated.get(title), "Bölgesel İş Dünyası Araştırması");
      await translateCalendarTitles([title]);
      assert.equal(requests, 1);
    } finally { globalThis.fetch = saved; }
  });

  test("translation outages return an explicit Turkish pending label", async () => {
    const saved = globalThis.fetch;
    globalThis.fetch = (async () => new Response("Unavailable", {status: 503})) as typeof fetch;
    try {
      const translated = await translateCalendarTitles(["Unknown Experimental Survey"]);
      assert.equal(translated.get("Unknown Experimental Survey"), "Ekonomik Gösterge (Türkçe başlık bekleniyor)");
    } finally { globalThis.fetch = saved; }
  });

  test("API localizes titles without changing values, IDs or event ordering", async () => {
    const saved = globalThis.fetch;
    globalThis.fetch = (async () => Response.json({result: [
      {id: 2, title: "Average Hourly Earnings YoY", country: "US", date: "2026-11-06T13:30:00Z", actual: 0, previous: 3.2, forecast: 2.9},
      {id: 1, title: "Retail Sales MoM", country: "EU", date: "2026-11-06T10:00:00Z", actual: null, previous: .4, forecast: -.1},
    ]})) as typeof fetch;
    try {
      const response = await GET();
      const body = await response.json();
      assert.equal(body.source, "tradingview");
      assert.equal(body.count, 2);
      assert.equal(body.events[0].id, "1");
      assert.equal(body.events[0].title, "Perakende Satışlar (Aylık)");
      assert.equal(body.events[1].title, "Ortalama Saatlik Kazançlar (Yıllık)");
      assert.equal(body.events[1].originalTitle, "Average Hourly Earnings YoY");
      assert.equal(body.events[1].actual, 0);
      assert.equal(body.events[1].previous, 3.2);
      assert.equal(body.events[1].forecast, 2.9);
      assert.equal(body.events[1].time, "16:30");
    } finally { globalThis.fetch = saved; }
  });
});
