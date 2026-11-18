export const POST_WIDTH = 1080;
export const POST_HEIGHT = 1350;
export const DEFAULT_DESCRIPTION = "Altın, gümüş ve bakır gibi emtialarda yaşanan fiyat düşüşleri, 9 günde 3,3 trilyon dolarlık piyasa değerinin silinmesine yol açtı.\n\n– Altın bugün yaklaşık %3 düşerken,\ngümüş %4,5 değer kaybetti.";
export type PostPhoto = { data: string; original: boolean };
export type PostTextRun = { text: string; bold: boolean };
export type PhotoTransform = { zoom: number; x: number; y: number };
export type PostScene = { photo: HTMLImageElement; overlay: HTMLImageElement; original: boolean };
export const DEFAULT_PHOTO_TRANSFORM: PhotoTransform = { zoom: 1, x: 0, y: 0 };

export function photoFrame(original: boolean, transform: PhotoTransform) {
  const base = original ? { x: -717, y: -15, width: 2609, height: 1463 } : { x: 0, y: 0, width: POST_WIDTH, height: POST_HEIGHT };
  return { x: base.x - base.width * (transform.zoom - 1) / 2 + transform.x, y: base.y - base.height * (transform.zoom - 1) / 2 + transform.y, width: base.width * transform.zoom, height: base.height * transform.zoom };
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
  const walk = (parent: Node, inherited: boolean) => {
    Array.from(parent.childNodes).forEach((node, index) => {
      if (node.nodeType === Node.TEXT_NODE) { append(node.textContent || "", inherited); return; }
      if (!(node instanceof HTMLElement)) return;
      const block = ["DIV", "P"].includes(node.tagName);
      if (block && index > 0) append("\n", inherited);
      if (node.tagName === "BR") {
        if (parent.childNodes.length > 1) append("\n", inherited);
        return;
      }
      const weight = node.style.fontWeight;
      const bold = weight ? weight === "bold" || Number(weight) >= 600 : ["B", "STRONG"].includes(node.tagName) ? true : inherited;
      walk(node, bold);
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

export function drawPost(canvas: HTMLCanvasElement, scene: PostScene, description: PostTextRun[], location: string, transform: PhotoTransform = DEFAULT_PHOTO_TRANSFORM) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bu tarayıcı görsel düzenlemeyi desteklemiyor.");
  ctx.clearRect(0, 0, POST_WIDTH, POST_HEIGHT);
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, POST_WIDTH, POST_HEIGHT);
  const frame = photoFrame(scene.original, transform);
  const ratio = Math.max(frame.width / scene.photo.naturalWidth, frame.height / scene.photo.naturalHeight);
  const width = scene.photo.naturalWidth * ratio, photoHeight = scene.photo.naturalHeight * ratio;
  ctx.save(); ctx.beginPath(); ctx.rect(frame.x, frame.y, frame.width, frame.height); ctx.clip();
  ctx.drawImage(scene.photo, frame.x + (frame.width - width) / 2, frame.y + (frame.height - photoHeight) / 2, width, photoHeight);
  ctx.restore();
  ctx.drawImage(scene.overlay, 0, 0, POST_WIDTH, POST_HEIGHT);
  let size = 39;
  let lines: PostTextRun[][] = [];
  let height = 0;
  for (; size >= 26; size--) {
    lines = wrapStyledPostText(description, 902, (text, bold) => { ctx.font = `${bold ? 700 : 400} ${size}px "BPT Rubik"`; return ctx.measureText(text).width; });
    height = lines.length * size * 1.1;
    if (height <= 396) break;
  }
  const overflow = height > 396;
  ctx.save();
  ctx.beginPath(); ctx.rect(154, 868, 902, 410); ctx.clip();
  ctx.fillStyle = "#fff"; ctx.textBaseline = "top";
  let y = 876;
  for (const line of lines) {
    let x = 154;
    for (const run of line) {
      ctx.font = `${run.bold ? 700 : 400} ${Math.max(size, 26)}px "BPT Rubik"`;
      ctx.fillText(run.text, x, y); x += ctx.measureText(run.text).width;
    }
    y += Math.max(size, 26) * 1.1;
  }
  ctx.restore();
  ctx.save(); ctx.translate(70, 945); ctx.rotate(-Math.PI / 2);
  const label = location.trim().toLocaleUpperCase("tr-TR");
  let labelSize = 20;
  ctx.font = `500 ${labelSize}px "BPT Rubik"`;
  while (ctx.measureText(label).width > 200 && labelSize > 10) { labelSize--; ctx.font = `500 ${labelSize}px "BPT Rubik"`; }
  ctx.fillStyle = "#000"; ctx.textBaseline = "alphabetic"; ctx.fillText(label, 0, 0); ctx.restore();
  return { overflow, fontSize: Math.max(size, 26) };
}
