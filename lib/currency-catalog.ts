import { COMMON_CURRENCY_NAMES } from "./currency-converter";

export type CurrencyOption = { code: string; name: string; type: "currency" | "metal" | "crypto" };
export const validCurrencyCode = (code: string) => /^[A-Z][A-Z0-9]{1,11}$/.test(code);
const names = new Map<string, string>(COMMON_CURRENCY_NAMES.map(([code, name]) => [code, name]));
const displayNames = new Intl.DisplayNames(["tr"], { type: "currency", fallback: "none" });

export function parseCurrencyCatalog(value: unknown): CurrencyOption[] {
  if (!Array.isArray(value)) throw new Error("Invalid currency catalog");
  const result = new Map<string, CurrencyOption>();
  for (const row of value) {
    if (!row || typeof row.iso_code !== "string" || !validCurrencyCode(row.iso_code) || typeof row.name !== "string" || !["currency", "metal", "crypto"].includes(row.type)) continue;
    let name = names.get(row.iso_code);
    if (!name && row.iso_code.length === 3) {
      try { name = displayNames.of(row.iso_code); } catch { /* Non-ISO asset. */ }
    }
    result.set(row.iso_code, { code: row.iso_code, name: name || row.name, type: row.type });
  }
  if (!result.has("USD") || !result.has("TRY")) throw new Error("Incomplete currency catalog");
  const priority = new Map<string, number>(COMMON_CURRENCY_NAMES.map(([code], index) => [code, index]));
  return [...result.values()].sort((a, b) => (priority.get(a.code) ?? 1000) - (priority.get(b.code) ?? 1000) || a.name.localeCompare(b.name, "tr"));
}

export function currencySearch(value: string): string {
  return value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/\p{M}/gu, "").replaceAll("ı", "i");
}
