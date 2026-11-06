export interface CalendarUnits {
  unit?: string | null;
  scale?: string | number | null;
  currency?: string | null;
}

interface CalendarValueContext extends CalendarUnits {
  title?: string;
  originalTitle?: string;
  country?: string;
}

function magnitude(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const key = value.trim().toLowerCase();
  return ({ k: "K", thousand: "K", thousands: "K", bin: "K", m: "M", million: "M", millions: "M", milyon: "M", b: "B", billion: "B", billions: "B", milyar: "B", t: "T", trillion: "T" } as Record<string, string>)[key];
}

export function calendarUnit(event: CalendarValueContext): string | undefined {
  const unit = event.unit?.trim() || "";
  const scale = magnitude(event.scale);
  if (/^(?:%|percent|percentage|pct|yüzde)$/i.test(unit)) return "%";
  const count = magnitude(unit);
  if (count) return count;
  if (/^(?:index|index points?|points?|pts|puan)$/i.test(unit)) return " puan";
  if (/^(?:percentage points?|yüzde puan)$/i.test(unit)) return " yüzde puan";
  if (/^(?:basis points?|bps|baz puan)$/i.test(unit)) return " baz puan";
  if (/^(?:persons?|people|kişi)$/i.test(unit)) return `${scale || ""} kişi`;
  if (/^[A-Z]{3}$/.test(unit)) return `${scale || ""} ${unit}`;
  if (/^(?:currency|para)$/i.test(unit) && /^[A-Z]{3}$/.test(event.currency || "")) return `${scale || ""} ${event.currency}`;
  const money = unit.match(/^(K|M|B|T)\s+([A-Z]{3})$/);
  if (money) return `${money[1]} ${money[2]}`;
  if (/^barrels?$/i.test(unit)) return `${scale || ""} varil`;
  if (/^hours?$/i.test(unit)) return " saat";
  if (/^units?$/i.test(unit)) return `${scale || ""} adet`;
  if (unit) return `${scale || ""} ${unit}`;
  if (scale) return scale;
  // The provider's currency denotes the affected market, not necessarily the
  // measurement unit: a US unemployment rate is a percentage, never USD.
  const title = (event.originalTitle || event.title || "").toLowerCase().replace(/\u0307/g, "");
  if (event.country === "US" && /\b(?:payrolls|jobless claims|nonfarm employment change|ADP employment change)\b|kamu sektörü istihdamı|imalat sektörü istihdamı|tarım dışı istihdam|özel sektör istihdam|işsizlik maaşı başvuruları/i.test(title)) return "K";
  if (/(?:\b(?:unemployment rate|participation rate|interest rate|deposit facility rate|lending facility rate|loan prime rate|gdp growth rate)\b|işsizlik oranı|işgücüne katılım oranı|gsyih büyüme oranı|faiz.*(?:oranı|kararı))/i.test(title)) return "%";
  if (/\bPMI\b|satın alma yöneticileri endeksi|consumer confidence|tüketici güven|business confidence|iş dünyası güven/i.test(title)) return " puan";
  if (/\b(?:MoM|YoY|QoQ)\b|\((?:Aylık|Yıllık|Çeyreklik)(?:,|\))/i.test(title)) return "%";
  return undefined;
}

export function formatCalendarValue(value: string | number | null | undefined, event: CalendarValueContext): string {
  if (value === null || value === undefined || String(value).trim() === "") return "--";
  const text = String(value).trim();
  if (/^(?:--?|n\/a|null|nan)$/i.test(text)) return "--";
  // Values already supplied as 6K, -1.5M, %0.3 or currency amounts stay intact.
  if (/[%$€£¥₺]|(?:\d\s*[KMBT])(?:\s|$)|\b(?:USD|EUR|TRY|JPY|CNY|puan|kişi|varil)\b/i.test(text)) return text;
  const unit = calendarUnit(event);
  return unit ? `${text}${unit}` : text;
}
