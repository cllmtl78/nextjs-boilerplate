"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

type Rate = { code: string; name: string; unit: number; buy: string | null; sell: string | null };
type Rates = { status: string; date: string | null; data: Rate[] };
const price = (value: string | null) => value !== null && Number.isFinite(Number(value))
  ? Number(value).toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 4 }) : "—";

export default function TcmbRates({ backendUrl }: { backendUrl: string }) {
  const [open, setOpen] = useState(false);
  const [rates, setRates] = useState<Rates | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    let disposed = false;
    let running = false;
    const controller = new AbortController();
    const load = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch(`${backendUrl}/api/tcmb-rates`, {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        });
        if (!response.ok) throw new Error("Rates unavailable");
        const body: Rates = await response.json();
        if (!Array.isArray(body.data)) throw new Error("Invalid rates");
        if (!disposed) { setRates(body); setError(body.status !== "ok"); }
      } catch { if (!disposed) setError(true); }
      finally { running = false; }
    };
    void load();
    const interval = setInterval(() => void load(), 60000);
    return () => { disposed = true; controller.abort(); clearInterval(interval); };
  }, [open, backendUrl]);
  const date = rates?.date?.split("-").reverse().join(".");
  return <section className="tcmb-panel rounded-lg border border-white/[0.06] bg-[#0d1322] overflow-hidden">
    <h2>
      <button type="button" onClick={() => setOpen(current => !current)} aria-expanded={open} aria-controls="tcmb-rates-content"
        className="w-full min-h-10 px-4 py-2 flex items-center justify-between gap-3 bg-slate-900/40 text-left">
        <span className="font-mono text-xs font-semibold tracking-wider text-slate-200"><span className="text-[#38bdf8] font-bold mr-1.5">/</span>TCMB Kurlar</span>
        <ChevronDown size={14} aria-hidden="true" className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </h2>
    <div id="tcmb-rates-content" hidden={!open} className="border-t border-white/[0.06]">
      <div className="px-3 pt-3 pb-2 text-[10px] leading-4 text-slate-500 font-mono">
        {date && <span className="text-slate-300">Kur tarihi: {date} · </span>}
        Gösterge döviz alış / satış · TL · İş günlerinde 15.30 itibarıyla belirlenir.
        <span className="block">Hafta sonu ve resmî tatillerde son yayımlanan kurlar gösterilir.</span>
      </div>
      {error && <p className="px-3 pb-2 text-xs text-amber-400/80">{rates?.data.length ? "Kurlar güncellenemedi; son alınan tablo gösteriliyor." : "TCMB kurlarına şu anda ulaşılamıyor."}</p>}
      {!rates && !error && <p className="px-3 pb-3 text-xs text-slate-500">Kurlar yükleniyor...</p>}
      {rates && <div className="tcmb-rates-grid">
        {rates.data.slice(0, 8).map(rate => <div key={rate.code} className="tcmb-rate" title={rate.name}>
          <div className="flex flex-wrap items-center gap-x-1 font-mono text-xs font-semibold text-[#38bdf8]">{rate.code}<span className="text-[9px] font-normal text-slate-500">{rate.unit} {rate.code}</span></div>
          <dl className="mt-2 space-y-1 font-mono text-[10px]">
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Alış</dt><dd className="tabular-nums text-slate-200">{price(rate.buy)}</dd></div>
            <div className="flex justify-between gap-2"><dt className="text-slate-500">Satış</dt><dd className="tabular-nums text-slate-200">{price(rate.sell)}</dd></div>
          </dl>
        </div>)}
      </div>}
    </div>
  </section>;
}
