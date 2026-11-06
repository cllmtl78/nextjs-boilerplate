import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCalendarValue } from "./calendar-values";
import { GET } from "../app/api/calendar/route";

test("percentages and payroll counts are distinct across all three displayed values", () => {
  const earnings={originalTitle:'Average Hourly Earnings MoM',country:'US'};
  const payrolls={originalTitle:'Government Payrolls',country:'US'};
  assert.equal(formatCalendarValue(.4,earnings),'0.4%');
  assert.equal(formatCalendarValue(.3,earnings),'0.3%');
  assert.equal(formatCalendarValue(0,earnings),'0%');
  assert.equal(formatCalendarValue(6,payrolls),'6K');
  assert.equal(formatCalendarValue(-18,payrolls),'-18K');
  assert.equal(formatCalendarValue(19,{originalTitle:'Manufacturing Payrolls',country:'US'}),'19K');
  assert.equal(formatCalendarValue(61.9,{originalTitle:'Participation Rate',country:'US'}),'61.9%');
});

test("explicit metadata wins and values are never multiplied or divided", () => {
  assert.equal(formatCalendarValue(6,{unit:'%'}),'6%');
  assert.equal(formatCalendarValue(6,{unit:'K'}),'6K');
  assert.equal(formatCalendarValue(6,{unit:'thousands'}),'6K');
  assert.equal(formatCalendarValue(1.5,{unit:'USD',scale:'M'}),'1.5M USD');
  assert.equal(formatCalendarValue(6,{unit:'persons',scale:'K'}),'6K kişi');
  assert.equal(formatCalendarValue(6,{unit:'hours',title:'Unknown MoM'}),'6 saat');
  assert.equal(formatCalendarValue(6,{unit:'Index points'}),'6 puan');
  assert.equal(formatCalendarValue(25,{unit:'basis points'}),'25 baz puan');
});

test("affected currency alone does not turn unemployment or payrolls into money", () => {
  assert.equal(formatCalendarValue(6,{currency:'USD',originalTitle:'Government Payrolls',country:'US'}),'6K');
  assert.equal(formatCalendarValue(4.1,{currency:'USD',originalTitle:'Unemployment Rate',country:'US'}),'4.1%');
  assert.equal(formatCalendarValue(50.1,{currency:'USD',originalTitle:'Manufacturing PMI'}),'50.1 puan');
});

test("already formatted values, missing data, signs and zero remain correct", () => {
  for(const text of ['6K','-1.5M','%0.3','0.3%','154.2 Mr $','6 USD']) assert.equal(formatCalendarValue(text,{unit:'%'}),text);
  for(const value of [null,undefined,'','--','N/A']) assert.equal(formatCalendarValue(value,{unit:'K'}),'--');
  assert.equal(formatCalendarValue(0,{unit:'K'}),'0K');
  assert.equal(formatCalendarValue(-.7,{unit:'%'}),'-0.7%');
});

test("cached Turkish titles retain units and unknown indicators receive no invented unit", () => {
  assert.equal(formatCalendarValue(.4,{title:'Perakende Satışlar (Aylık)'}),'0.4%');
  assert.equal(formatCalendarValue(61.9,{title:'İşgücüne Katılım Oranı'}),'61.9%');
  assert.equal(formatCalendarValue(6,{title:'Kamu Sektörü İstihdamı',country:'US'}),'6K');
  assert.equal(formatCalendarValue(6,{title:'Unknown indicator'}),'6');
  assert.equal(formatCalendarValue(6,{title:'Unknown indicator',scale:1000}),'6');
});

test("API preserves upstream metadata without changing numeric data", async () => {
  const saved=globalThis.fetch;
  globalThis.fetch=(async()=>Response.json({result:[{id:'units-1',title:'Government Payrolls',country:'US',date:'2026-11-06T13:30:00Z',actual:6,forecast:5,previous:-18,unit:'K',scale:null,currency:'USD'}]})) as typeof fetch;
  try {
    const response=await GET();
    const body=await response.json();
    const item=body.events[0];
    assert.equal(item.unit,'K');
    assert.equal(item.currency,'USD');
    assert.equal(item.actual,6);
    assert.equal(item.previous,-18);
    assert.equal(formatCalendarValue(item.actual,item),'6K');
    assert.equal(formatCalendarValue(item.forecast,item),'5K');
    assert.equal(formatCalendarValue(item.previous,item),'-18K');
  } finally {globalThis.fetch=saved;}
});
