import { test } from "node:test";
import assert from "node:assert/strict";
import { photoFrame, wrapPostText, wrapStyledPostText } from "./post-designer";

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

test("mixed weights stay attached to the right text when a word wraps", () => {
  const lines = wrapStyledPostText([{ text: "Altın fi", bold: true }, { text: "yatı %3", bold: false }], 8, text => text.length);
  assert.equal(lines.flat().filter(run => run.bold).map(run => run.text).join("").replace(/ /g, ""), "Altınfi");
  assert.equal(lines.flat().filter(run => !run.bold).map(run => run.text).join("").replace(/ /g, ""), "yatı%3");
  assert.equal(lines.map(line => line.map(run => run.text).join("")).join(" "), "Altın fiyatı %3");
  assert.ok(lines.every(line => line.reduce((n, run) => n + run.text.length, 0) <= 8));
});

test("rich text retains explicit empty lines", () => {
  const lines = wrapStyledPostText([{ text: "Bir\n\nİki", bold: true }], 10, text => text.length);
  assert.deepEqual(lines.map(line => line.map(run => run.text).join("")), ["Bir", "", "İki"]);
});

test("zoom stays centered and pan changes only the photo frame", () => {
  const normal = photoFrame(false, { zoom: 1, x: 0, y: 0 });
  const zoomed = photoFrame(false, { zoom: 2, x: 0, y: 0 });
  assert.equal(normal.x + normal.width / 2, zoomed.x + zoomed.width / 2);
  assert.equal(normal.y + normal.height / 2, zoomed.y + zoomed.height / 2);
  const moved = photoFrame(false, { zoom: 2, x: 120, y: -80 });
  assert.equal(moved.x, zoomed.x + 120); assert.equal(moved.y, zoomed.y - 80);
});

test("original photo starts with the original Figma crop", () => {
  assert.deepEqual(photoFrame(true, { zoom: 1, x: 0, y: 0 }), { x: -717, y: -15, width: 2609, height: 1463 });
});
