"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, X } from "lucide-react";
import MacroHistoryChart from "./MacroHistoryChart";
import { macroDate, macroNumber } from "@/lib/macro-data";
import { DEBT_SERIES, debtDollars, debtHistory, type DebtField, type DebtSnapshot } from "@/lib/debt-data";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://bpt-news-backend.onrender.com";

export default function USNationalDebt({ refresh }: { refresh: number }) {
  const [snapshot, setSnapshot] = useState<DebtSnapshot | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [retry, setRetry] = useState(0);
  const [field, setField] = useState<DebtField>("total_debt");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let disposed = false, running = false;
    const controller = new AbortController();
    const load = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch(`${BACKEND}/api/macro/us-debt`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(18000)]) });
        if (!response.ok) throw new Error("Debt unavailable");
        const body: DebtSnapshot = await response.json();
        if (!Array.isArray(body.data) || !body.data.length) throw new Error("Invalid debt data");
        if (!disposed) { setSnapshot(body); setUnavailable(false); }
      } catch { if (!disposed) setUnavailable(true); }
      finally { running = false; }
    };
    void load();
    const interval = setInterval(() => void load(), 30 * 60_000);
    return () => { disposed = true; controller.abort(); clearInterval(interval); };
  }, [refresh, retry]);

  const rows = snapshot?.data || [];
  const latest = rows[rows.length - 1];
  const change = snapshot?.daily_change == null ? null : Number(snapshot.daily_change) / 1e9;
  const selected = DEBT_SERIES.find(series => series.field === field)!;
  const stale = unavailable || (snapshot !== null && snapshot.status !== "ok");

  return <section className="macro-group macro-group-debt" aria-labelledby="us-debt-heading">
    <div className="macro-group-heading"><h2 id="us-debt-heading"><span>/</span> ABD ulusal borcu</h2><p>Son raporlanan federal borç · ABD doları</p></div>
    {stale && <div className="macro-alert" role="status">{latest ? "Borç verisi yenilenemedi; son rapor gösteriliyor." : <>ABD ulusal borç verisi şu anda alınamıyor. <button type="button" onClick={() => setRetry(value => value + 1)} className="text-sky-400 underline">Tekrar dene</button></>}</div>}
    <div className="macro-card-grid"><button type="button" className="macro-card macro-card-wide debt-card" disabled={!latest}
      aria-label="ABD ulusal borcu detaylarını aç" onClick={() => { setField("total_debt"); dialog.current?.showModal(); }}>
      <div className="macro-card-summary">
        <div className="macro-card-top"><span>Günlük rapor</span>{stale && latest && <span className="macro-stale">Son veri</span>}<ArrowUpRight size={13} aria-hidden="true" /></div>
        <h3>Toplam federal borç</h3>
        <div className="macro-card-value">{latest ? macroNumber(Number(latest.total_debt) / 1e12, 3) : "—"}<small>trilyon $</small></div>
        {latest && <p className="debt-exact">{debtDollars(latest.total_debt)}</p>}
        {change !== null && Number.isFinite(change) ? <span className={`macro-change ${change >= 0 ? "macro-change-up" : "macro-change-down"}`} title={`Önceki rapor: ${macroDate(snapshot?.previous_date || null)}`}>
          {change >= 0 ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowDownRight size={13} aria-hidden="true" />}{change > 0 ? "+" : ""}{macroNumber(change, 2)} milyar $<span>önceki rapora göre</span>
        </span> : <span className="macro-no-change">{latest ? "Önceki rapor bulunmuyor" : unavailable ? "Veri alınamadı" : "Borç verisi hazırlanıyor..."}</span>}
        <p className="macro-card-date">Rapor tarihi: {macroDate(latest?.record_date || null)}</p>
        {latest && <div className="debt-breakdown">{DEBT_SERIES.slice(1).map(series => <div key={series.field}><span>{series.title}</span><strong>{macroNumber(Number(latest[series.field]) / 1e12, 3)}<small> trilyon $</small></strong></div>)}</div>}
      </div>
      <div className="macro-card-history"><MacroHistoryChart compact points={debtHistory(rows)} color="#38bdf8" title="ABD ulusal borcu" digits={3} unit="trilyon $" /><div className="macro-card-foot"><span>Son {rows.length || "—"} yayımlanan gözlem</span><span>Detay ve dağılım ↗</span></div></div>
    </button></div>
    <dialog ref={dialog} className="currency-converter-dialog macro-detail-dialog" aria-labelledby="debt-detail-title" onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="converter-heading"><div><h2 id="debt-detail-title">ABD ulusal borcu</h2><p>Son yayımlanan rapor ve borç dağılımı</p></div><button type="button" className="converter-close" aria-label="Borç grafiğini kapat" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
      {latest && <div className="macro-detail-body">
        <div className="macro-detail-stat"><div className="macro-card-value">{macroNumber(Number(latest[field]) / 1e12, 3)}<small>trilyon $</small></div><span>{macroDate(latest.record_date)}</span></div>
        <p className="debt-exact">{debtDollars(latest[field])}</p>
        <div className="macro-detail-range" role="group" aria-label="Borç serisi">{DEBT_SERIES.map(series => <button key={series.field} type="button" aria-pressed={field === series.field} onClick={() => setField(series.field)}>{series.title}</button>)}</div>
        <MacroHistoryChart points={debtHistory(rows, field)} color={selected.color} title={selected.title} digits={3} unit="trilyon $" />
        <p className="macro-detail-description">Toplam federal borç; piyasada tutulan borç ile federal kamu hesaplarının elindeki kurumlar arası borcun toplamıdır. Değerler son yayımlanan rapora aittir; canlı bir borç sayacı değildir.</p>
        <div className="macro-detail-foot"><a href="https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/debt-to-the-penny" target="_blank" rel="noopener noreferrer">Kaynak: ABD Hazinesi ↗</a><a href="https://eulerpool.com/developers/api/government/treasury/debt" target="_blank" rel="noopener noreferrer">Veri erişimi: Eulerpool ↗</a></div>
      </div>}
    </dialog>
  </section>;
}
