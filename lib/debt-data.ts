import type { MacroPoint } from "./macro-data";

export type DebtField = "total_debt" | "debt_held_public" | "intragov_holdings";
export type DebtRow = { record_date: string } & Record<DebtField, string>;
export type DebtSnapshot = { status: string; source: string; last_checked: string | null; data: DebtRow[]; daily_change: string | null; previous_date: string | null };
export const DEBT_SERIES: { field: DebtField; title: string; color: string }[] = [
  { field: "total_debt", title: "Toplam borç", color: "#38bdf8" },
  { field: "debt_held_public", title: "Piyasadaki borç", color: "#38bdf8" },
  { field: "intragov_holdings", title: "Kamu kurumları arası", color: "#a78bfa" },
];

export function debtHistory(rows: DebtRow[], field: DebtField = "total_debt"): MacroPoint[] {
  return rows.map(row => ({ date: row.record_date, value: Number(row[field]) / 1e12 }));
}

// Keep the original cents for the full-dollar readout; Number loses precision
// at a national debt level of tens of trillions.
export function debtDollars(value: string): string {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) return "—";
  const negative = value.startsWith("-");
  const [integer, cents = ""] = value.replace(/^-/, "").split(".");
  return `${negative ? "−" : ""}${BigInt(integer).toLocaleString("tr-TR")},${cents.padEnd(2, "0")} $`;
}
