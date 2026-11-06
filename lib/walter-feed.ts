import { istanbulDay, wireHtmlToText } from "./wire-text";

export interface WalterPost {
  id: string;
  timestamp: number;
  zaman: string;
  rawText: string;
}

// Read only message elements; exclude Telegram's channel header/forwarded labels.
export function parseWalterPosts(html: string): WalterPost[] {
  const starts = [...html.matchAll(/<div\b[^>]*\bdata-post=["'](WalterBloomberg\/(\d+))["'][^>]*>/gi)];
  const posts = new Map<string, WalterPost>();
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const block = html.slice(start.index, starts[i + 1]?.index ?? html.length);
    const opening = /<div\b[^>]*class=["'][^"']*\btgme_widget_message_text\b[^"']*["'][^>]*>/i.exec(block);
    const datetime = /<time\b[^>]*datetime=["']([^"']+)["']/i.exec(block)?.[1];
    if (!opening || !datetime) continue;
    const from = opening.index + opening[0].length;
    const tags = /<\/?div\b[^>]*>/gi;
    tags.lastIndex = from;
    let depth = 1;
    let end = -1;
    for (let tag = tags.exec(block); tag; tag = tags.exec(block)) {
      depth += /^<\/div/i.test(tag[0]) ? -1 : 1;
      if (depth === 0) { end = tag.index; break; }
    }
    if (end === -1) continue;
    const rawText = wireHtmlToText(block.slice(from, end));
    const timestamp = Date.parse(datetime);
    if (rawText.length < 3 || !Number.isFinite(timestamp)) continue;
    const id = `WalterBloomberg/${start[2]}`;
    posts.set(id, { id, timestamp, rawText, zaman: new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(timestamp) });
  }
  return [...posts.values()].sort((a, b) => b.timestamp - a.timestamp);
}

export class WalterFeed {
  private day = "";
  private posts = new Map<string, WalterPost>();
  private refreshed = 0;
  private historyComplete = false;
  private inFlight?: Promise<WalterPost[]>;
  constructor(private fetcher: typeof fetch = (input, init) => fetch(input, init)) {}

  async getPosts(now = Date.now()): Promise<WalterPost[]> {
    if (this.inFlight) return this.inFlight;
    if (this.day === istanbulDay(now) && now - this.refreshed < 15000) return this.sorted();
    this.inFlight = this.refresh(now).finally(() => { this.inFlight = undefined; });
    return this.inFlight;
  }

  private sorted(): WalterPost[] {
    return [...this.posts.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 200);
  }

  private async refresh(now: number): Promise<WalterPost[]> {
    const day = istanbulDay(now);
    if (this.day !== day) { this.posts.clear(); this.day = day; this.historyComplete = false; this.refreshed = 0; }
    let before = "";
    const signal = AbortSignal.timeout(12000);
    for (let page = 0; page < 12; page++) {
      const url = new URL("https://t.me/s/WalterBloomberg");
      if (before) url.searchParams.set("before", before);
      try {
        const response = await this.fetcher(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" }, signal, cache: "no-store" });
        if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
        const parsed = parseWalterPosts(await response.text());
        if (!parsed.length) throw new Error("Telegram haber yapısı okunamadı veya metin içeren haber yok");
        let added = 0;
        for (const post of parsed) {
          if (istanbulDay(post.timestamp) !== day) continue;
          if (!this.posts.has(post.id)) added++;
          this.posts.set(post.id, post);
        }
        const oldest = parsed[parsed.length - 1];
        const nextBefore = String(Math.min(...parsed.map(post => Number(post.id.split("/")[1]))));
        if (this.posts.size >= 200 || istanbulDay(oldest.timestamp) < day || nextBefore === before) { this.historyComplete = true; break; }
        // Existing history is complete; only the newest page needs refreshing.
        if (page === 0 && this.historyComplete && this.refreshed && added === 0) break;
        before = nextBefore;
      } catch (error) {
        console.warn("[Global] WalterBloomberg akışı alınamadı:", error instanceof Error ? error.message : "İstek hatası");
        if (!this.posts.size) throw error;
        break;
      }
    }
    this.refreshed = now;
    return this.sorted();
  }
}
