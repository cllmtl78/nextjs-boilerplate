"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, RefreshCw, X } from "lucide-react";
import MacroInsights from "./MacroInsights";
import MacroHistoryChart from "./MacroHistoryChart";
import { MACRO_COLORS, macroDate, macroHistory, macroNumber, type MacroMetric, type MacroRange, type MacroSnapshot } from "@/lib/macro-data";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://bpt-news-backend.onrender.com";
const GROUPS = [
  { id: "rates", title: "Faiz ve tahvil", note: "Fed hedef aralığı ve ABD Hazine tahvil getirileri" },
  { id: "economy", title: "Enflasyon ve istihdam", note: "Fiyatlar ve işgücü piyasasının son açıklanan görünümü" },
  { id: "liquidity", title: "Merkez bankası bilançosu", note: "Federal Reserve toplam varlıklarının seyri" },
] as const;
function MetricValue({ item }: { item: MacroMetric }) {
  return <>{item.low !== null && item.value !== null ? `${macroNumber(item.low, item.digits)}–${macroNumber(item.value, item.digits)}` : macroNumber(item.value, item.digits)}<small>{item.unit}</small></>;
}
function Change({ item }: { item: MacroMetric }) {
  if (item.change === null) return <span className="macro-no-change">Önceki gözlem bulunmuyor</span>;
  if (Math.abs(item.change) < 0.00001) return <span className="macro-no-change">Önceki gözleme göre değişim yok</span>;
  const Icon = item.change > 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={`macro-change ${item.change > 0 ? "macro-change-up" : "macro-change-down"}`} title={`Önceki gözlem: ${macroDate(item.previous_date, item.frequency)}`}><Icon size={13} aria-hidden="true" />{item.change > 0 ? "+" : ""}{macroNumber(item.change, item.delta_unit === "baz puan" ? 1 : item.digits)} {item.delta_unit}<span>önceki gözleme göre</span></span>;
}

export default function MacroDashboard() {
  const [snapshot, setSnapshot] = useState<MacroSnapshot | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [range, setRange] = useState<MacroRange>("1Y");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const selected = snapshot?.data.find(item => item.id === selectedId);
  useEffect(() => {
    let disposed = false;
    let running = false;
    const controller = new AbortController();
    const load = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch(`${BACKEND}/api/macro`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        if (!response.ok) throw new Error("Macro unavailable");
        const body: MacroSnapshot = await response.json();
        if (!Array.isArray(body.data)) throw new Error("Invalid macro data");
        if (!disposed) { setSnapshot(body); setUnavailable(false); }
      } catch { if (!disposed) setUnavailable(true); }
      finally { running = false; }
    };
    void load();
    const interval = setInterval(() => void load(), 5 * 60_000);
    return () => { disposed = true; controller.abort(); clearInterval(interval); };
  }, [refresh]);
  const state = snapshot?.status;
  const warning = unavailable || state === "unavailable" || state === "not_configured" || state === "partial" || state === "stale";
  return <div className="macro-page">
    <div className="macro-page-heading"><div><span className="macro-eyebrow">BPT FİNANS / MAKRO</span><h1>Ekonominin sayısal görünümü</h1><p>ABD makro göstergeleri ve küresel tarihsel karşılaştırmalar</p></div><div className="macro-page-actions"><button type="button" aria-label="Makro verilerini yenile" title="Makro verilerini yenile" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={14} /></button></div></div>
    <div className="macro-statusbar"><span>{snapshot?.count ?? 0} / 9 temel gösterge</span><span>{snapshot?.last_checked ? `Son kontrol: ${new Date(snapshot.last_checked).toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "short" })}` : "Veri kaynağı kontrol ediliyor"}</span><div role="group" aria-label="Makro grafik dönemi">{([['1Y','1Y'],['3Y','3Y'],['ALL','Tümü']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)}>{label}</button>)}</div></div>
    {warning && <div className="macro-alert" role="status">{snapshot?.count ? "Bazı veriler yenilenemiyor; son alınan değerler tarihleriyle gösteriliyor." : "Makro verileri şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin."}</div>}
    {state === "starting" && !snapshot?.count && <div className="macro-alert" role="status">Ekonomik göstergeler hazırlanıyor...</div>}
    {!snapshot && !unavailable ? <div className="macro-card-grid" aria-label="Makro verileri yükleniyor">{Array.from({ length: 8 }, (_,index) => <div key={index} className="macro-skeleton animate-pulse"><span /><strong /><div /></div>)}</div> : GROUPS.map(group => {
      const items = snapshot?.data.filter(item => item.group === group.id) || [];
      if (!items.length) return null;
      return <section key={group.id} className={`macro-group macro-group-${group.id}`} aria-labelledby={`macro-group-${group.id}`}><div className="macro-group-heading"><h2 id={`macro-group-${group.id}`}><span>/</span> {group.title}</h2><p>{group.note}</p></div><div className="macro-card-grid">{items.map(item => <button type="button" key={item.id} className={`macro-card ${item.group === 'liquidity' ? 'macro-card-wide' : ''}`} disabled={item.value === null}
        aria-label={`${item.title}: ${item.value === null ? 'Veri bekleniyor' : macroNumber(item.value, item.digits) + ' ' + item.unit}. Geçmiş grafiği aç.`}
        onClick={() => { setSelectedId(item.id); dialog.current?.showModal(); }}>
        <div className="macro-card-summary"><div className="macro-card-top"><span>{item.frequency}</span>{item.status === 'stale' && <span className="macro-stale">Son veri</span>}<ArrowUpRight size={13} aria-hidden="true" /></div><h3>{item.title}</h3><div className="macro-card-value"><MetricValue item={item} /></div><Change item={item} /><p className="macro-card-date">{macroDate(item.date, item.frequency)}</p></div>
        <div className="macro-card-history"><MacroHistoryChart compact points={macroHistory(item.history, range)} color={MACRO_COLORS[item.group]} title={item.title} digits={item.digits} unit={item.unit} /><div className="macro-card-foot"><span>{item.id === 'fed-rate' ? 'Grafik: üst sınır' : item.id === 'cpi' || item.id === 'core-pce' ? 'Yıllık değişim' : 'Geçmiş görünümü'}</span></div></div>
      </button>)}</div></section>;
    })}
    {unavailable && !snapshot && <div className="macro-empty"><h2>Makro veri akışına ulaşılamıyor</h2><p>Bağlantı yeniden kurulduğunda göstergeler burada görünecek.</p><button type="button" onClick={() => setRefresh(value => value + 1)}>Tekrar dene</button></div>}
    <MacroInsights />
    <p className="macro-footnote">Bunlar gün içi fiyatlar değildir. Her gösterge kendi yayın sıklığına ve veri dönemine göre güncellenir. Geçmiş değerler revize edilebilir. Artış ve azalış renkleri yönü belirtir; ekonomik değerlendirme içermez.</p>
    <dialog ref={dialog} className="currency-converter-dialog macro-detail-dialog" aria-labelledby="macro-detail-title" onClose={() => setSelectedId(null)} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <div className="converter-heading"><div><h2 id="macro-detail-title">{selected?.title || 'Gösterge geçmişi'}</h2><p>{selected?.frequency}</p></div><button type="button" className="converter-close" aria-label="Makro grafiğini kapat" onClick={() => dialog.current?.close()}><X size={18} /></button></div>
      {selected && <div className="macro-detail-body"><div className="macro-detail-stat"><div className="macro-card-value"><MetricValue item={selected} /></div><span>{macroDate(selected.date, selected.frequency)}</span></div><p className="macro-detail-description">{selected.description}</p><div className="macro-detail-range" role="group" aria-label="Gösterge grafik dönemi">{([['1Y','1Y'],['3Y','3Y'],['ALL','Tümü']] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={range === value} onClick={() => setRange(value)}>{label}</button>)}</div><MacroHistoryChart points={macroHistory(selected.history, range)} color={MACRO_COLORS[selected.group]} title={selected.title} digits={selected.digits} unit={selected.unit} /><div className="macro-detail-foot"><span>Veri dönemi: {macroDate(selected.date, selected.frequency)}</span></div></div>}
    </dialog>
  </div>;
}
