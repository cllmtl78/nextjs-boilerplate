export function decodeWireEntities(text: string): string {
  const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, key: string) => {
    if (key.startsWith("#")) {
      const code = key[1].toLowerCase() === "x" ? parseInt(key.slice(2), 16) : parseInt(key.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return named[key.toLowerCase()] ?? entity;
  });
}

// Preserve names, case, market tickers and numbers. Never rewrite meaning here.
export function cleanWireText(text: string): string {
  return decodeWireEntities(text)
    .replace(/\r\n?/g, "\n")
    .replace(/https?:\/\/[^\s<>()]+|\bwww\.[^\s<>()]+|\bt\.me\/[^\s<>()]+/gi, " ")
    .replace(/\([^\S\n]*@WalterBloomberg[^\S\n]*\)|@WalterBloomberg\b/gi, " ")
    .replace(/\([^\S\n]*\)|\[[^\S\n]*\]/g, " ")
    .replace(/\*/g, "")
    .replace(/\$([A-Z][A-Z0-9.]{0,9})\b/g, "$1")
    .split("\n").map(line => line.replace(/[^\S\n]+/g, " ").trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function wireHtmlToText(html: string): string {
  const text = html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ");
  return cleanWireText(text);
}

export function istanbulDay(timestamp: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(timestamp);
}
