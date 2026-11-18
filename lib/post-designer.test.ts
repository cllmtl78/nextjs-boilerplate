import { test } from "node:test";
import assert from "node:assert/strict";
import { wrapPostText } from "./post-designer";

const measure = (text: string) => Array.from(text).length;

test("manual line breaks and paragraph spacing survive wrapping", () => {
  assert.deepEqual(wrapPostText("İstanbul\n\nAnkara", 20, measure), ["İstanbul", "", "Ankara"]);
});

test("a long word is wrapped without losing characters", () => {
  const word = "KamuyuAydınlatmaPlatformu";
  const lines = wrapPostText(word, 7, measure);
  assert.equal(lines.join(""), word);
  assert.ok(lines.every(line => measure(line) <= 7));
});

test("Unicode characters are not split into broken surrogate pairs", () => {
  assert.deepEqual(wrapPostText("📈📉📊", 1, measure), ["📈", "📉", "📊"]);
});

test("financial values and punctuation are preserved across lines", () => {
  const text = "%3,3 ve 25 baz puan · 3,3 trilyon dolar";
  const lines = wrapPostText(text, 12, measure);
  assert.equal(lines.join(" "), text);
  assert.ok(lines.every(line => measure(line) <= 12));
});
