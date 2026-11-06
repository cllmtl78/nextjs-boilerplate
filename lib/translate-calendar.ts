import { localizeCalendarTitle } from "./calendar-titles";

const cache = new Map<string, { title: string; expires: number }>();

// Known indicators require no network. Unrecognized names are translated once,
// cached, and retried on the next refresh if the translation service is unavailable.
export async function translateCalendarTitles(titles: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const missing: string[] = [];
  for (const title of new Set(titles)) {
    const local = localizeCalendarTitle(title);
    const cached = cache.get(title);
    if (local) result.set(title, local);
    else if (cached && cached.expires > Date.now()) result.set(title, cached.title);
    else missing.push(title);
  }
  // One timeout bounds the entire batch, rather than a timeout for each event.
  const signal = AbortSignal.timeout(2500);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, missing.length) }, async () => {
    while (cursor < missing.length) {
      const title = missing[cursor++];
      try {
        const url = new URL("https://translate.googleapis.com/translate_a/single");
        url.search = new URLSearchParams({ client: "gtx", sl: "auto", tl: "tr", dt: "t", q: title }).toString();
        const response = await fetch(url, { signal, cache: "no-store" });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data: unknown = await response.json();
        const segments = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : [];
        const translated = segments.map((segment: unknown) => Array.isArray(segment) && typeof segment[0] === "string" ? segment[0] : "").join("").trim();
        if (!translated || translated.toLowerCase() === title.toLowerCase()) throw new Error("Başlık çevrilmedi");
        result.set(title, translated);
        if (cache.size >= 500) cache.delete(cache.keys().next().value!);
        cache.set(title, { title: translated, expires: Date.now() + 24 * 60 * 60 * 1000 });
      } catch {
        console.warn(`[Takvim] Türkçe başlık alınamadı: ${title}`);
        result.set(title, "Ekonomik Gösterge (Türkçe başlık bekleniyor)");
      }
    }
  }));
  return result;
}
