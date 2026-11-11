import type { Metadata } from "next";
import MacroDashboard from "@/components/MacroDashboard";

export const metadata: Metadata = {
  title: "BPT Finans | Terminal",
  description: "ABD faiz, tahvil, enflasyon, istihdam, Fed bilançosu ve ulusal borç göstergeleri.",
};

export default function MacroPage() {
  return <MacroDashboard />;
}
