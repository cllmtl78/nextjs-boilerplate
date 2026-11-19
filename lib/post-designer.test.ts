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

test("extra photo crop covers its frame and stays within source bounds", async () => {
  const { extraPhotoCrop } = await import("./post-designer");
  const image = { naturalWidth: 1200, naturalHeight: 800 } as HTMLImageElement;
  for (const cropZoom of [1, 2, 4]) for (const cropX of [-100, 0, 100]) for (const cropY of [-100, 0, 100]) {
    const crop = extraPhotoCrop({ image, x: 0, y: 0, width: 400, height: 600, radius: 0, cropZoom, cropX, cropY });
    assert.ok(crop.x >= 0 && crop.y >= 0);
    assert.ok(crop.x + crop.width <= 1200 && crop.y + crop.height <= 800);
    assert.ok(Math.abs(crop.width / crop.height - 2 / 3) < 0.000001);
  }
});

test("reopening or resizing an extra photo keeps its selected source region", async () => {
  const { extraPhotoCrop } = await import("./post-designer");
  const image = { naturalWidth: 1200, naturalHeight: 800 } as HTMLImageElement;
  const photo = { image, x: 120, y: 300, width: 500, height: 500, radius: 30, cropZoom: 1, cropX: 0, cropY: 0, sourceCrop: { x: 300, y: 100, width: 400, height: 400 } };
  assert.deepEqual(extraPhotoCrop(photo), photo.sourceCrop);
  const resized = extraPhotoCrop({ ...photo, width: 600, height: 300 });
  assert.deepEqual(resized, { x: 300, y: 200, width: 400, height: 200 });
});

test("uploaded landscape and portrait photos start fully visible without distortion", async () => {
  const { mainPhotoBounds } = await import("./post-designer");
  for (const [width, height] of [[2000, 1000], [1000, 2000], [1000, 1000]]) {
    const bounds = mainPhotoBounds(false, width, height, { zoom: 1, x: 0, y: 0 });
    assert.ok(bounds.x >= 0 && bounds.y >= 0);
    assert.ok(bounds.x + bounds.width <= 1080 && bounds.y + bounds.height <= 1350);
    assert.equal(bounds.width / bounds.height, width / height);
  }
});

test("zoomed photos retain their full image bounds when dragged to reveal an edge", async () => {
  const { mainPhotoBounds } = await import("./post-designer");
  const bounds = mainPhotoBounds(false, 2000, 1000, { zoom: 2, x: 540, y: -150 });
  assert.deepEqual(bounds, { x: 0, y: -15, width: 2160, height: 1080 });
});
