import { test } from "node:test";
import assert from "node:assert/strict";
import { insightChange, movingExplanation, type MovingInsight } from "./macro-insights";
const row: MovingInsight = { id:"DGS10",name:"ABD 10 yıllık tahvil getirisi",category:"Faiz",change:-.43,change_kind:"level_pp",window:"month",percentile:90.85,rarity:"unusual",latest_date:"2026-11-05",prior_date:"2026-10-06",history_start:"2006-11-10",sample_size:4979,restricted:false,source_url:"https://www.macroradar.io/10-year-treasury-yield" };
test("level-point and relative percent moves keep distinct units",()=>{
  assert.equal(insightChange(row),"-0,43 puan");
  assert.equal(insightChange({...row,change_kind:"percent"}),"-0,43%");
  assert.ok(movingExplanation(row).includes("0,43 puan azaldı"));
});
test("flat and tiny changes are not narrated as false moves or rounded to zero",()=>{
  assert.ok(movingExplanation({...row,change:0}).includes("değişmedi"));
  assert.ok(!movingExplanation({...row,change:0}).includes("arttı"));
  assert.notEqual(insightChange({...row,change:.000001}),"+0,00 puan");
  assert.ok(movingExplanation({...row,change_kind:"percent",change:5.38}).includes("yüzde 5,38 arttı"));
});
