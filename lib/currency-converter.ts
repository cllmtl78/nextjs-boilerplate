export const COMMON_CURRENCY_NAMES = [
  ["TRY", "Türk Lirası"], ["USD", "ABD Doları"], ["EUR", "Euro"], ["GBP", "İngiliz Sterlini"],
  ["CHF", "İsviçre Frangı"], ["JPY", "Japon Yeni"], ["CAD", "Kanada Doları"],
  ["AUD", "Avustralya Doları"], ["CNY", "Çin Yuanı"], ["SAR", "Suudi Arabistan Riyali"],
  ["AED", "BAE Dirhemi"], ["QAR", "Katar Riyali"], ["NOK", "Norveç Kronu"],
  ["SEK", "İsveç Kronu"], ["DKK", "Danimarka Kronu"], ["NZD", "Yeni Zelanda Doları"],
  ["INR", "Hindistan Rupisi"], ["BRL", "Brezilya Reali"], ["PLN", "Polonya Zlotisi"],
  ["KRW", "Güney Kore Wonu"], ["SGD", "Singapur Doları"], ["HKD", "Hong Kong Doları"],
] as const;
export type ConversionQuote = { base: string; quote: string; rate: number; date: string | null; stale?: boolean };

export function parseConversionAmount(input: string): number | null {
  const text = input.trim();
  const normalized = /^\d{1,3}(?:\.\d{3})+(?:,\d{1,6})?$/.test(text)
    ? text.replaceAll(".", "").replace(",", ".") : /^\d+(?:[.,]\d{1,6})?$/.test(text) ? text.replace(",", ".") : "";
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000_000_000 ? amount : null;
}

export function parseConversionQuote(value: unknown, base: string, quote: string): ConversionQuote {
  if (typeof value !== "object" || value === null) throw new Error("Invalid quote");
  const row = value as Record<string, unknown>;
  if (row.base !== base || row.quote !== quote || typeof row.rate !== "number" || !Number.isFinite(row.rate) || row.rate <= 0 || typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(row.date))) throw new Error("Invalid quote");
  return { base, quote, rate: row.rate, date: row.date };
}

export function conversionNumber(value: number): string {
  return value.toLocaleString("tr-TR", value > 0 && value < 0.000001
    ? { maximumSignificantDigits: 6 } : { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}
