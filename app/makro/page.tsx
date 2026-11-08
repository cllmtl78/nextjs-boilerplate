import type { Metadata } from "next";
import MacroDashboard from "@/components/MacroDashboard";

export const metadata: Metadata = {
  title: "Makro | BPT Finans",
  description: "FRED verileriyle ABD faiz, tahvil, enflasyon, istihdam ve Fed bilançosu göstergeleri.",
};

export default function MacroPage() {
  return <MacroDashboard />;
}
