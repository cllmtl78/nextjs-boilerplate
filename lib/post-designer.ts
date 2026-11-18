export const POST_WIDTH = 1080;
export const POST_HEIGHT = 1350;
export const DEFAULT_DESCRIPTION = "Altın, gümüş ve bakır gibi emtialarda yaşanan fiyat düşüşleri, 9 günde 3,3 trilyon dolarlık piyasa değerinin silinmesine yol açtı.\n\n– Altın bugün yaklaşık %3 düşerken,\ngümüş %4,5 değer kaybetti.";
export type PostPhoto = { data: string; original: boolean };

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

export function drawPost(canvas: HTMLCanvasElement, background: HTMLImageElement, description: string, location: string) {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bu tarayıcı görsel düzenlemeyi desteklemiyor.");
  ctx.clearRect(0, 0, POST_WIDTH, POST_HEIGHT);
  ctx.drawImage(background, 0, 0, POST_WIDTH, POST_HEIGHT);
  const paragraphs = description.trim().replace(/\r/g, "").split(/\n\s*\n/);
  const title = paragraphs[0] || "";
  const detail = paragraphs.slice(1).join("\n\n");
  let size = 39;
  let titleLines: string[] = [], detailLines: string[] = [];
  let height = 0;
  for (; size >= 26; size--) {
    ctx.font = `700 ${size}px "BPT Rubik"`;
    titleLines = wrapPostText(title, 876, value => ctx.measureText(value).width);
    ctx.font = `400 ${size}px "BPT Rubik"`;
    detailLines = detail ? wrapPostText(detail, 876, value => ctx.measureText(value).width) : [];
    height = (titleLines.length + detailLines.length) * size * 1.1 + (detail ? size : 0);
    if (height <= 310) break;
  }
  const overflow = height > 310;
  ctx.save();
  ctx.beginPath(); ctx.rect(154, 910, 876, 330); ctx.clip();
  ctx.fillStyle = "#fff"; ctx.textBaseline = "top";
  let y = 919;
  ctx.font = `700 ${Math.max(size, 26)}px "BPT Rubik"`;
  for (const line of titleLines) { ctx.fillText(line, 154, y); y += Math.max(size, 26) * 1.1; }
  if (detail) {
    y += Math.max(size, 26);
    ctx.font = `400 ${Math.max(size, 26)}px "BPT Rubik"`;
    for (const line of detailLines) { ctx.fillText(line, 154, y); y += Math.max(size, 26) * 1.1; }
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
