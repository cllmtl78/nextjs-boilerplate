"use client";

import { useEffect, useRef, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import CurrencySelect from "./CurrencySelect";
import CurrencyComparisonChart, { COMPARISON_COLORS } from "./CurrencyComparisonChart";
import type { CurrencyOption } from "@/lib/currency-catalog";
import { COMPARISON_RANGES, type ComparisonData, type ComparisonRange } from "@/lib/currency-comparison";
import { watchIstanbulDay } from "@/lib/news-day";

export default function CurrencyComparison() {
  const [base, setBase] = useState("TRY");
  const [quotes, setQuotes] = useState(["USD", "EUR", "GBP"]);
  const [range, setRange] = useState<ComparisonRange>("3M");
  const [loaded, setLoaded] = useState<{ key: string; data: ComparisonData } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [settings, setSettings] = useState(false);
  const [draftBase, setDraftBase] = useState("TRY");
  const [draftQuotes, setDraftQuotes] = useState(["USD", "EUR", "GBP"]);
  const [catalog, setCatalog] = useState<CurrencyOption[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const key = `${base}:${quotes.join(",")}:${range}`;
  const current = loaded?.key === key ? loaded.data : null;
  const failed = failedKey === key;

  useEffect(() => {
    let disposed = false;
    let running = false;
    const controller = new AbortController();
    const load = async () => {
      if (running) return;
      running = true;
      try {
        const params = new URLSearchParams({ base, quotes: quotes.join(","), range });
        const response = await fetch(`/api/currency-comparison?${params}`, {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        });
        if (!response.ok) throw new Error("History unavailable");
        const body: ComparisonData = await response.json();
        if (!Array.isArray(body.dates) || !Array.isArray(body.series)) throw new Error("Invalid chart");
        if (!disposed) { setLoaded({ key, data: body }); setFailedKey(null); }
      } catch { if (!disposed) setFailedKey(key); }
      finally { running = false; }
    };
    void load();
    const interval = setInterval(() => void load(), 15 * 60_000);
    const unwatch = watchIstanbulDay(() => void load());
    return () => { disposed = true; controller.abort(); clearInterval(interval); unwatch(); };
  }, [base, quotes, range, key, retry]);

  useEffect(() => {
    if (!settings) return;
    let disposed = false;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch("/api/currency-converter/currencies", {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!response.ok) throw new Error("No catalog");
        const body = await response.json();
        if (!Array.isArray(body.data)) throw new Error("Invalid catalog");
        if (!disposed) { setCatalog(body.data); setCatalogError(body.stale === true); }
      } catch { if (!disposed) setCatalogError(true); }
    };
    void load();
    return () => { disposed = true; controller.abort(); };
  }, [settings, catalogRetry]);

  return <>
    <section className="comparison-panel rounded-lg border border-white/[0.06] bg-[#0d1322] overflow-hidden" aria-labelledby="currency-comparison-title">
      <div className="h-10 px-4 flex items-center justify-between gap-2 border-b border-white/[0.06] bg-slate-900/40 shrink-0">
        <h2 id="currency-comparison-title" className="font-mono text-xs font-semibold tracking-wider text-slate-200"><span className="text-[#38bdf8] font-bold mr-1.5">/</span>Kur karşılaştırması</h2>
        <button type="button" className="comparison-settings" aria-label="Karşılaştırma para birimlerini seç" title="Para birimlerini değiştir" aria-haspopup="dialog" onClick={() => {
          setDraftBase(base); setDraftQuotes([...quotes]); setCatalogError(false); setSettings(true); dialog.current?.showModal();
        }}><SlidersHorizontal size={14} aria-hidden="true" /><span>{base}</span></button>
      </div>
      <div className="comparison-toolbar"><div role="group" aria-label="Karşılaştırma dönemi">{COMPARISON_RANGES.map(item => <button type="button" key={item.value} aria-pressed={range === item.value} onClick={() => setRange(item.value)}>{item.label}</button>)}</div><span>{quotes.join(" · ")} / {base}</span></div>
      <div className="comparison-body">
        {(failed || current?.stale) && <p className="comparison-warning">{current?.series.length ? "Güncellenemedi; son grafik gösteriliyor." : "Geçmiş kur verisi alınamadı."} <button type="button" onClick={() => { setFailedKey(null); setRetry(value => value + 1); }}>Tekrar dene</button></p>}
        {current?.series.length ? <CurrencyComparisonChart key={`${key}:${current.start}:${current.end}`} data={current} /> : <div className="comparison-empty">{!current && !failed ? "Kur geçmişi yükleniyor..." : !failed ? "Bu seçimler için yeterli ortak geçmiş veri bulunamadı." : "Kaynak yeniden erişilebilir olduğunda grafik güncellenecek."}</div>}
      </div>
      <div className="comparison-note">
        <span>Günlük referans kur · Frankfurter{range === "5Y" ? " · Haftalık veri" : ""}</span>
        <span>Yükseliş, seçilen paranın {base} karşısında değer kazanmasıdır.</span>
        {!!current?.missing.length && <span className="text-amber-400/80">Yeterli veri yok: {current.missing.join(", ")}</span>}
      </div>
    </section>
    <dialog ref={dialog} className="currency-converter-dialog comparison-dialog" aria-labelledby="comparison-settings-title" onClose={() => setSettings(false)}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="converter-heading"><div><h2 id="comparison-settings-title">Kur karşılaştırması</h2><p>Baz birim ve en fazla 5 karşılaştırma birimi seç.</p></div><button type="button" className="converter-close" aria-label="Kur karşılaştırması ayarlarını kapat" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
      <div className="converter-body comparison-settings-body">
        {catalogError && <p className="converter-error">Para birimi listesi güncellenemedi. <button type="button" onClick={() => { setCatalogError(false); setCatalogRetry(value => value + 1); }}>Listeyi tekrar yükle</button></p>}
        {!catalog.length && !catalogError && <p className="converter-hint">Para birimleri yükleniyor...</p>}
        <CurrencySelect key={`base-${settings}`} id="comparison-base" label="Baz para birimi" value={draftBase} options={catalog} onChange={value => { setDraftBase(value); setDraftQuotes(current => current.filter(code => code !== value)); }} />
        <div className="comparison-add-field">{draftQuotes.length < 5 ? <CurrencySelect key={`add-${settings}-${draftQuotes.join(",")}`} id="comparison-add" label="Para birimi ekle" value="" options={catalog.filter(item => item.code !== draftBase && !draftQuotes.includes(item.code))} onChange={value => setDraftQuotes(current => current.length < 5 && !current.includes(value) && value !== draftBase ? [...current, value] : current)} /> : <p className="converter-hint">Yeni bir birim eklemek için önce seçimlerden birini kaldır.</p>}</div>
        <div className="comparison-selected"><span className="converter-label">Karşılaştırılacak birimler · {draftQuotes.length}/5</span><div>{draftQuotes.map((code, index) => <button key={code} type="button" aria-label={`${code} kaldır`} onClick={() => setDraftQuotes(current => current.filter(value => value !== code))}><i style={{ background: COMPARISON_COLORS[index] }} />{code}<X size={12} aria-hidden="true" /></button>)}</div></div>
        <p className="converter-hint">Tüm çizgiler ortak başlangıç tarihinde %0’dan başlar. Örneğin USD/{draftBase}, doların {draftBase} cinsinden değerini karşılaştırır.</p>
        <button type="button" className="comparison-apply" disabled={!draftQuotes.length || !catalog.length} onClick={() => {
          setBase(draftBase); setQuotes([...draftQuotes]); dialog.current?.close();
        }}>Grafiği güncelle</button>
      </div>
    </dialog>
  </>;
}
