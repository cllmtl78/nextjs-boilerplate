"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Copy, X } from "lucide-react";
import { conversionNumber, parseConversionAmount, parseConversionQuote, type ConversionQuote } from "@/lib/currency-converter";

import CurrencySelect from "./CurrencySelect";
import type { CurrencyOption } from "@/lib/currency-catalog";

export default function CurrencyConverter() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("TRY");
  const [input, setInput] = useState("1000");
  const [quote, setQuote] = useState<ConversionQuote | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [copyState, setCopyState] = useState("");
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const matching = quote?.base === from && quote?.quote === to;
  const current = from === to ? { rate: 1, date: null, stale: false } : matching ? quote : null;
  const amount = parseConversionAmount(input);
  const result = amount !== null && current ? amount * current.rate : null;

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let disposed = false;
    const load = async () => {
      try {
        const response = await fetch("/api/currency-converter/currencies", {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!response.ok) throw new Error("No catalog");
        const body = await response.json();
        if (!Array.isArray(body.data) || !body.data.length) throw new Error("Invalid catalog");
        if (!disposed) { setCurrencies(body.data); setCatalogError(body.stale === true); }
      } catch { if (!disposed) setCatalogError(true); }
    };
    void load();
    return () => { disposed = true; controller.abort(); };
  }, [open, catalogAttempt]);

  useEffect(() => {
    if (!open || from === to) return;
    const controller = new AbortController();
    let disposed = false;
    const load = async () => {
      try {
        const response = await fetch(`/api/currency-converter?from=${from}&to=${to}`, {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!response.ok) throw new Error("No rate");
        const body = await response.json();
        const parsed = parseConversionQuote(body, from, to);
        if (!disposed) { setQuote({ ...parsed, stale: body.stale === true }); setError(false); }
      } catch { if (!disposed) setError(true); }
    };
    void load();
    const timer = setInterval(() => void load(), 15 * 60_000);
    return () => { disposed = true; controller.abort(); clearInterval(timer); };
  }, [open, from, to, attempt]);

  const changed = () => { setQuote(null); setError(false); setCopyState(""); };
  const date = current?.date?.split("-").reverse().join(".");
  return <>
    <button type="button" className="currency-converter-trigger" aria-haspopup="dialog" onClick={() => {
      changed(); dialog.current?.showModal(); setOpen(true);
    }}><ArrowLeftRight size={14} aria-hidden="true" /><span>Kur dönüştürücü</span></button>
    <dialog ref={dialog} className="currency-converter-dialog" aria-labelledby="currency-converter-title"
      onClose={() => setOpen(false)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="converter-heading">
        <div><h2 id="currency-converter-title">Kur dönüştürücü</h2><p>Günlük referans kurlarla hızlı hesaplama</p></div>
        <button type="button" className="converter-close" aria-label="Kur dönüştürücüyü kapat" onClick={() => dialog.current?.close()}><X size={18} /></button>
      </div>
      <div className="converter-body">
        <label className="converter-label" htmlFor="converter-amount">Tutar</label>
        <div className="converter-amount-wrap"><input id="converter-amount" autoFocus inputMode="decimal" autoComplete="off" maxLength={24}
          value={input} aria-invalid={amount === null} aria-describedby="converter-amount-hint" onChange={event => { setInput(event.target.value); setCopyState(""); }} /><span>{from}</span></div>
        <p id="converter-amount-hint" className={amount === null ? "converter-error" : "converter-hint"}>{amount === null ? "Geçerli bir tutar girin (0–1 trilyon). Örnek: 1.000,50" : "Örnek: 1.000,50 · En fazla 6 ondalık basamak"}</p>
        {catalogError && <p className="converter-error">{currencies.length ? "Para birimi listesi güncellenemedi; son alınan liste gösteriliyor." : "Para birimi listesi alınamadı."} <button type="button" onClick={() => { setCatalogError(false); setCatalogAttempt(value => value + 1); }}>Listeyi tekrar yükle</button></p>}
        {!currencies.length && !catalogError && <p className="converter-hint">Tüm para birimleri yükleniyor...</p>}
        <div className="converter-pair">
          <CurrencySelect key={`from-${open}`} id="converter-from" label="Çevrilen" value={from} options={currencies} onChange={value => { changed(); setFrom(value); }} />
          <button type="button" className="converter-swap" aria-label="Para birimlerini değiştir" title="Para birimlerini değiştir" onClick={() => { changed(); setFrom(to); setTo(from); }}><ArrowLeftRight size={18} /></button>
          <CurrencySelect key={`to-${open}`} id="converter-to" label="Hedef" value={to} options={currencies} onChange={value => { changed(); setTo(value); }} />
        </div>
        <div className="converter-result" aria-live="polite" aria-atomic="true">
          <span className="converter-label">Karşılığı</span>
          <div className="converter-result-number">{result !== null ? conversionNumber(result) : "—"}<span>{to}</span></div>
          {current && <p className="converter-hint">1 {from} = {conversionNumber(current.rate)} {to}</p>}
          {!current && !error && <p className="converter-hint">Güncel referans kur alınıyor...</p>}
          {error && <p className="converter-error">Kur alınamadı. {current ? "Önceki hesaplama korunuyor." : "Lütfen tekrar deneyin."} <button type="button" onClick={() => { setError(false); setAttempt(value => value + 1); }}>Tekrar dene</button></p>}
          {current?.stale && <p className="converter-error">Kaynak güncellenemedi; son alınan kur kullanılıyor.</p>}
        </div>
        <div className="converter-meta"><span>{from === to ? "Aynı para birimi · Kur: 1" : date ? `Kur tarihi: ${date}` : ""}</span>
          <button type="button" disabled={result === null} onClick={async () => {
            if (result === null) return;
            try { await navigator.clipboard.writeText(`${conversionNumber(result)} ${to}`); setCopyState("Kopyalandı"); }
            catch { setCopyState("Kopyalanamadı"); }
          }}><Copy size={12} aria-hidden="true" />{copyState || "Sonucu kopyala"}</button>
        </div>
      </div>
      <div className="converter-note">Kaynak: Frankfurter · Referans kurlar günlük güncellenir. Hafta sonu ve tatillerde son yayımlanan değerler kullanılabilir. Banka alış/satış kuru, komisyon veya anlık işlem fiyatı değildir.</div>
    </dialog>
  </>;
}
