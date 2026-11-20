export const POST_WIDTH = 1080;
export const POST_HEIGHT = 1350;
export const DEFAULT_DESCRIPTION = "Altın, gümüş ve bakır gibi emtialarda yaşanan fiyat düşüşleri, 9 günde 3,3 trilyon dolarlık piyasa değerinin silinmesine yol açtı.\n\n– Altın bugün yaklaşık %3 düşerken,\ngümüş %4,5 değer kaybetti.";
export type PostPhoto = { data: string; original: boolean };
export type PostTextRun = { text: string; bold: boolean };
export type PhotoTransform = { zoom: number; x: number; y: number };
export type PostScene = { photo: HTMLImageElement; overlay: HTMLImageElement; original: boolean; quote?: HTMLImageElement; swipe?: HTMLImageElement };
export type PostDecorations = { quote: boolean; swipe: boolean };
export type ExtraPhoto = { image: HTMLImageElement; x: number; y: number; width: number; height: number; radius: number; cropZoom: number; cropX: number; cropY: number; sourceCrop?: { x: number; y: number; width: number; height: number } };

/** Source crop stays inside the photo, including when zoomed or moved to an edge. */
export function extraPhotoCrop(photo: ExtraPhoto) {
  const source = photo.sourceCrop ?? { x: 0, y: 0, width: photo.image.naturalWidth, height: photo.image.naturalHeight };
  const ratio = Math.max(photo.width / source.width, photo.height / source.height) * photo.cropZoom;
  const width = photo.width / ratio, height = photo.height / ratio;
  return { x: source.x + (source.width - width) * (photo.cropX + 100) / 200, y: source.y + (source.height - height) * (photo.cropY + 100) / 200, width, height };
}

export const DEFAULT_PHOTO_TRANSFORM: PhotoTransform = { zoom: 1, x: 0, y: 0 };

export function photoFrame(original: boolean, transform: PhotoTransform) {
  const base = original ? { x: -717, y: -15, width: 2609, height: 1463 } : { x: 0, y: 0, width: POST_WIDTH, height: POST_HEIGHT };
  return { x: base.x - base.width * (transform.zoom - 1) / 2 + transform.x, y: base.y - base.height * (transform.zoom - 1) / 2 + transform.y, width: base.width * transform.zoom, height: base.height * transform.zoom };
}

/** Uploaded photos start fully visible. Pan/zoom moves the complete image, never a cropped intermediate frame. */
export function mainPhotoBounds(original: boolean, imageWidth: number, imageHeight: number, transform: PhotoTransform) {
  const frame = photoFrame(original, transform);
  const fit = original ? Math.max : Math.min;
  const ratio = fit(frame.width / imageWidth, frame.height / imageHeight);
  const width = imageWidth * ratio, height = imageHeight * ratio;
  return { x: frame.x + (frame.width - width) / 2, y: frame.y + (frame.height - height) / 2, width, height };
}

export function wrapStyledPostText(runs: PostTextRun[], width: number, measure: (text: string, bold: boolean) => number): PostTextRun[][] {
  const append = (target: PostTextRun[], run: PostTextRun) => {
    if (!run.text) return;
    const last = target[target.length - 1];
    if (last?.bold === run.bold) last.text += run.text;
    else target.push({ ...run });
  };
  const tokens: { kind: "word" | "space" | "break"; runs: PostTextRun[] }[] = [];
  let word: PostTextRun[] = [];
  const flush = () => { if (word.length) { tokens.push({ kind: "word", runs: word }); word = []; } };
  for (const run of runs) for (const char of Array.from(run.text.replace(/\r/g, ""))) {
    if (char === "\n") { flush(); tokens.push({ kind: "break", runs: [] }); }
    else if (/\s/u.test(char)) { flush(); if (tokens.at(-1)?.kind !== "space") tokens.push({ kind: "space", runs: [{ text: " ", bold: run.bold }] }); }
    else append(word, { text: char, bold: run.bold });
  }
  flush();
  const total = (value: PostTextRun[]) => value.reduce((sum, run) => sum + measure(run.text, run.bold), 0);
  const lines: PostTextRun[][] = [];
  let line: PostTextRun[] = [], space: PostTextRun[] = [];
  for (const token of tokens) {
    if (token.kind === "break") { lines.push(line); line = []; space = []; continue; }
    if (token.kind === "space") { if (line.length) space = token.runs; continue; }
    if (line.length && total([...line, ...space, ...token.runs]) > width) { lines.push(line); line = []; space = []; }
    for (const run of space) append(line, run);
    space = [];
    if (total(token.runs) <= width) { for (const run of token.runs) append(line, run); continue; }
    for (const run of token.runs) for (const char of Array.from(run.text)) {
      if (line.length && total([...line, { text: char, bold: run.bold }]) > width) { lines.push(line); line = []; }
      append(line, { text: char, bold: run.bold });
    }
  }
  lines.push(line);
  return lines;
}

export function readEditorRuns(root: HTMLElement): PostTextRun[] {
  const runs: PostTextRun[] = [];
  const append = (text: string, bold: boolean) => {
    text = text.replace(/\u200b/g, "");
    if (!text) return;
    const last = runs.at(-1);
    if (last?.bold === bold) last.text += text; else runs.push({ text, bold });
  };
  // Browsers split/merge editable paragraphs into nested blocks on Enter/Backspace.
  // Keep a pending block boundary across inline wrappers instead of relying on sibling indexes.
  let pendingBreak = false;
  const lastCharacter = () => runs.at(-1)?.text.at(-1);
  const flushBoundary = (bold: boolean) => { if (pendingBreak) { append("\n", bold); pendingBreak = false; } };
  const walk = (parent: Node, inherited: boolean) => {
    Array.from(parent.childNodes).forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent || "").replace(/\u200b/g, "").replace(/\u00a0/g, " ");
        if (text) { flushBoundary(inherited); append(text, inherited); }
        return;
      }
      if (!(node instanceof HTMLElement)) return;
      const weight = node.style.fontWeight;
      const bold = weight ? weight === "bold" || Number(weight) >= 600 : ["B", "STRONG"].includes(node.tagName) ? true : inherited;
      if (node.tagName === "BR") {
        // A terminal BR (possibly inside inline formatting) is the browser's empty-line placeholder.
        let tail: Node = node;
        while (!tail.nextSibling && tail.parentNode && tail.parentNode !== root && tail.parentNode instanceof HTMLElement && !["DIV", "P"].includes(tail.parentNode.tagName)) tail = tail.parentNode;
        flushBoundary(bold);
        if (tail.nextSibling) append("\n", bold);
        return;
      }
      const block = ["DIV", "P"].includes(node.tagName);
      if (block) {
        if (pendingBreak) flushBoundary(bold);
        else if (lastCharacter() && lastCharacter() !== "\n") append("\n", bold);
      }
      walk(node, bold);
      if (block) pendingBreak = true;
    });
  };
  walk(root, false);
  return runs;
}

export async function buildPostOverlay(template: string) {
  const doc = new DOMParser().parseFromString(template, "image/svg+xml");
  doc.querySelector('image[href="__PHOTO_DATA__"]')?.remove();
  // Keep only the photo's fixed inner shadow, rather than its source rectangle.
  doc.getElementById("filter1_i_14622_242")?.lastElementChild?.remove();
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(doc)], { type: "image/svg+xml" }));
  try { return await loadPostImage(url); } finally { URL.revokeObjectURL(url); }
}

export function wrapPostText(text: string, width: number, measure: (value: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    let line = "";
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (line && measure(`${line} ${word}`) > width) { lines.push(line); line = ""; }
      if (measure(word) <= width) { line = line ? `${line} ${word}` : word; continue; }
      for (const letter of Array.from(word)) {
        if (line && measure(line + letter) > width) { lines.push(line); line = ""; }
        line += letter;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function loadPostImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Görsel açılamadı. JPG, PNG veya WebP dosyası kullan."));
    image.src = src;
  });
}

export function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Fotoğraf okunamadı."));
    reader.readAsDataURL(blob);
  });
}

export async function buildPostBackground(template: string, photo: PostPhoto) {
  const svg = template.replaceAll("__PHOTO_DATA__", photo.data)
    .replaceAll("__PHOTO_X__", photo.original ? "-717" : "0")
    .replaceAll("__PHOTO_Y__", photo.original ? "-15" : "0")
    .replaceAll("__PHOTO_WIDTH__", photo.original ? "2609" : "1080")
    .replaceAll("__PHOTO_HEIGHT__", photo.original ? "1463" : "1350");
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try { return await loadPostImage(url); } finally { URL.revokeObjectURL(url); }
}

export async function prepareUploadedPhoto(file: File): Promise<PostPhoto> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("JPG, PNG veya WebP fotoğrafı seç.");
  if (file.size > 20 * 1024 * 1024) throw new Error("Fotoğraf en fazla 20 MB olabilir.");
  const url = URL.createObjectURL(file);
  try {
    const image = await loadPostImage(url);
    const ratio = Math.min(1, 2700 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Bu tarayıcı görsel düzenlemeyi desteklemiyor.");
    ctx.fillStyle = "#0b1734"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return { data: canvas.toDataURL("image/jpeg", 0.95), original: false };
  } finally { URL.revokeObjectURL(url); }
}

const foregroundCache = new WeakMap<HTMLImageElement, { key: string; canvas: HTMLCanvasElement; result: { overflow: boolean; fontSize: number } }>();

export function drawPost(canvas: HTMLCanvasElement, scene: PostScene, description: PostTextRun[], location: string, transform: PhotoTransform = DEFAULT_PHOTO_TRANSFORM, decorations: PostDecorations = { quote: false, swipe: false }, extras: ExtraPhoto[] = []) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bu tarayıcı görsel düzenlemeyi desteklemiyor.");
  ctx.clearRect(0, 0, POST_WIDTH, POST_HEIGHT);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, POST_WIDTH, POST_HEIGHT);
  const bounds = mainPhotoBounds(scene.original, scene.photo.naturalWidth, scene.photo.naturalHeight, transform);
  ctx.drawImage(scene.photo, bounds.x, bounds.y, bounds.width, bounds.height);
  // Both photos are below the fixed blue effect, branding and text.
  for (const extra of extras) {
    const crop = extraPhotoCrop(extra);
    ctx.save(); ctx.beginPath();
    ctx.roundRect(extra.x, extra.y, extra.width, extra.height, Math.min(extra.width, extra.height) * extra.radius / 200);
    ctx.clip();
    ctx.drawImage(extra.image, crop.x, crop.y, crop.width, crop.height, extra.x, extra.y, extra.width, extra.height);
    ctx.restore();
  }
  const key = JSON.stringify([description, location, decorations]);
  let cached = foregroundCache.get(scene.overlay);
  if (!cached || cached.key !== key) {
    const layer = document.createElement("canvas"); layer.width = POST_WIDTH; layer.height = POST_HEIGHT;
    const result = drawForeground(layer, scene, description, location, decorations);
    cached = { key, canvas: layer, result }; foregroundCache.set(scene.overlay, cached);
  }
  ctx.drawImage(cached.canvas, 0, 0);
  return cached.result;
}

function drawForeground(canvas: HTMLCanvasElement, scene: PostScene, description: PostTextRun[], location: string, decorations: PostDecorations) {
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(scene.overlay, 0, 0, POST_WIDTH, POST_HEIGHT);
  if (decorations.quote && scene.quote) ctx.drawImage(scene.quote, 0, 0, POST_WIDTH, POST_HEIGHT);
  if (decorations.swipe && scene.swipe) ctx.drawImage(scene.swipe, 0, 0, POST_WIDTH, POST_HEIGHT);
  const size = 39;
  const lines = wrapStyledPostText(description, 902, (text, bold) => { ctx.font = `${bold ? 700 : 400} ${size}px "BPT Rubik"`; return ctx.measureText(text).width; });
  const overflow = lines.length * size * 1.1 > 439;
  ctx.save();
  ctx.beginPath(); ctx.rect(154, 825, 902, 453); ctx.clip();
  ctx.fillStyle = "#fff"; ctx.textBaseline = "top";
  let y = 833;
  for (const line of lines) {
    let x = 154;
    for (const run of line) {
      ctx.font = `${run.bold ? 700 : 400} ${size}px "BPT Rubik"`;
      ctx.fillText(run.text, x, y); x += ctx.measureText(run.text).width;
    }
    y += size * 1.1;
  }
  ctx.restore();
  ctx.save(); ctx.translate(70, 945); ctx.rotate(-Math.PI / 2);
  const label = location.trim().toLocaleUpperCase("tr-TR");
  let labelSize = 20;
  ctx.font = `500 ${labelSize}px "BPT Rubik"`;
  while (ctx.measureText(label).width > 200 && labelSize > 10) { labelSize--; ctx.font = `500 ${labelSize}px "BPT Rubik"`; }
  ctx.fillStyle = "#000"; ctx.textBaseline = "alphabetic"; ctx.fillText(label, 0, 0); ctx.restore();
  return { overflow, fontSize: size };
}
