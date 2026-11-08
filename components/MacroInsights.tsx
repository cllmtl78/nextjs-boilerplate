"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronRight, X } from "lucide-react";
import { macroDate } from "@/lib/macro-data";
import { insightChange, insightNumber, insightWindow, movingExplanation, rarityLabel, type MacroInsights as Insights, type MovingInsight } from "@/lib/macro-insights";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "https://bpt-news-backend.onrender.com";
const SOURCE = "https://www.macroradar.io";

function MovingRow({ row, choose }: { row: MovingInsight; choose: () => void }) {
  const Icon = row.change < 0 ? ArrowDownRight : ArrowUpRight;
  return <button type="button" className="insight-move-row" onClick={choose}>
    <span className="insight-move-name"><strong>{row.name}</strong><span>{row.category} · {row.window === "month" ? "Aylık" : "Çeyreklik"} · {macroDate(row.latest_date)}</span></span>
    <span className={`insight-move-change ${row.change > 0 ? 'insight-up' : row.change < 0 ? 'insight-down' : ''}`}>{row.change !== 0 && <Icon size={12} aria-hidden="true" />}{insightChange(row)}</span>
    <span className="insight-percentile"><span>%{insightNumber(row.percentile,1)}</span><i><b style={{width:`${row.percentile}%`}} /></i></span>
  </button>;
}

export default function MacroInsights() {
  const [feeds, setFeeds] = useState<Insights | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [view, setView] = useState<"moving" | "curve" | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [category, setCategory] = useState("Tümü");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let disposed=false;
    let running=false;
    const controller=new AbortController();
    const load=async()=>{
      if(running)return;
      running=true;
      try{
        const response=await fetch(`${BACKEND}/api/macro/insights`,{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
        if(!response.ok)throw new Error("Insights unavailable");
        const body:Insights=await response.json();
        if(!body.moving||!body.curve)throw new Error("Invalid insights");
        if(!disposed){setFeeds(body);setFailed(false);}
      }catch{if(!disposed)setFailed(true);}
      finally{running=false;}
    };
    void load();
    const interval=setInterval(()=>void load(),60000);
    return()=>{disposed=true;controller.abort();clearInterval(interval);};
  },[retry]);
  const moving=feeds?.moving.data;
  const curve=feeds?.curve.data;
  const selected=moving?.data.find(row=>row.id===selectedId);
  const closed=curve?.data.filter(row=>!row.open)||[];
  const longest=closed.length?Math.max(...closed.map(row=>row.days)):null;
  const show=(kind:"moving"|"curve",id:string|null=null)=>{setView(kind);setSelectedId(id);setCategory("Tümü");dialog.current?.showModal();};
  const metadata=view==="moving"?moving:curve;
  const categories=["Tümü",...new Set(moving?.data.map(row=>row.category)||[])];
  return <section className="macro-group macro-insight-group" aria-labelledby="macro-insight-title">
    <div className="macro-group-heading"><h2 id="macro-insight-title"><span>/</span> Tarihsel karşılaştırmalar</h2><p>Son hareketlerin geçmişteki yeri ve faiz eğrisi dönemleri</p></div>
    <div className="macro-insights-grid">
      <article className="macro-insight-panel">
        <div className="insight-panel-heading"><h3>Sıra dışı hareketler</h3><button type="button" disabled={!moving} onClick={()=>show("moving")}>Tümünü gör <ChevronRight size={12} /></button></div>
        <div className="insight-list-heading"><span>Gösterge / değişim</span><span>Tarihsel sıra</span></div>
        {(failed||feeds?.moving.status==="stale")&&<p className="insight-warning">Güncellenemedi; son kayıtlar korunuyor.</p>}
        {moving?.data.length?<div className="insight-preview-list">{moving.data.slice(0,6).map(row=><MovingRow key={row.id} row={row} choose={()=>show("moving",row.id)} />)}</div>:<div className="insight-empty">{failed||feeds?.moving.status==="unavailable"?<>Hareket analizi şu anda alınamıyor.<button type="button" onClick={()=>setRetry(value=>value+1)}>Tekrar dene</button></>:!moving?"Tarihsel hareketler hazırlanıyor...":"Kaynakta güncel hareket kaydı bulunmuyor."}</div>}
        <div className="insight-panel-foot"><span>{moving?`Hesap tarihi: ${macroDate(moving.as_of)}`:"Saatlik güncellenir"}</span><a href={SOURCE} target="_blank" rel="noopener noreferrer">MacroRadar ↗</a></div>
      </article>
      <article className="macro-insight-panel">
        <div className="insight-panel-heading"><h3>Faiz eğrisi dönemleri</h3><button type="button" disabled={!curve} onClick={()=>show("curve")}>Geçmişi aç <ChevronRight size={12} /></button></div>
        {(failed||feeds?.curve.status==="stale")&&<p className="insight-warning">Güncellenemedi; son kayıtlar korunuyor.</p>}
        {curve?<><button type="button" className={`insight-curve-state ${curve.open_count?'insight-curve-active':''}`} onClick={()=>show("curve")}><span>ABD 10 yıl − 2 yıl</span><strong><i />{curve.open_count?"Devam eden ters eğri dönemi":"Devam eden dönem yok"}</strong><small>{macroDate(curve.as_of)} itibarıyla kaynağın dönem kaydı</small></button><div className="insight-episode-preview">{curve.data.slice(0,3).map(episode=><button type="button" key={episode.id} onClick={()=>show("curve")}><span><strong>{macroDate(episode.start_date)} — {episode.end_date?macroDate(episode.end_date):"Devam ediyor"}</strong><small>{episode.open?"Devam eden":"Tamamlanan"} dönem</small></span><span className="insight-duration">{episode.days.toLocaleString("tr-TR")}<small>takvim günü</small></span></button>)}</div><div className="insight-curve-summary"><span>{closed.length} tamamlanan dönem</span><span>{longest!==null?`Listede en uzun: ${longest} gün`:""}</span></div></>:<div className="insight-empty">{failed||feeds?.curve.status==="unavailable"?<>Dönem analizi şu anda alınamıyor.<button type="button" onClick={()=>setRetry(value=>value+1)}>Tekrar dene</button></>:"Faiz eğrisi dönemleri hazırlanıyor..."}</div>}
        <div className="insight-panel-foot"><span>Tahmin değil, tarihsel dönem kaydı</span><a href={`${SOURCE}/yield-curve`} target="_blank" rel="noopener noreferrer">MacroRadar ↗</a></div>
      </article>
    </div>
    <dialog ref={dialog} className="currency-converter-dialog insight-dialog" aria-labelledby="insight-dialog-title" onClose={()=>{setView(null);setSelectedId(null);}} onClick={event=>{if(event.target===event.currentTarget)dialog.current?.close();}}>
      <div className="converter-heading"><div><h2 id="insight-dialog-title">{view==="curve"?"Faiz eğrisi dönemleri":selected?.name||"Sıra dışı hareketler"}</h2><p>{metadata?`Hesap tarihi: ${macroDate(metadata.as_of)}`:""}</p></div><button type="button" className="converter-close" aria-label="Analiz penceresini kapat" onClick={()=>dialog.current?.close()}><X size={18} /></button></div>
      <div className="insight-dialog-body">
        {view==="moving"&&selected?<>
          <button type="button" className="insight-back" onClick={()=>setSelectedId(null)}>← Tüm hareketler</button>
          <div className="insight-detail-stats"><div><span>Karşılaştırma değişimi</span><strong className={selected.change<0?'insight-down':'insight-up'}>{insightChange(selected)}</strong><small>{insightWindow(selected)}</small></div><div><span>Tarihsel sıra</span><strong>%{insightNumber(selected.percentile)}</strong><small>{rarityLabel[selected.rarity]}</small></div></div>
          <p className="insight-description">{movingExplanation(selected)}</p>
          <p className="insight-method-note">Bu sıralama, hareketin geçmişe göre büyüklüğünü anlatır. Açıklama beklentisine göre sürpriz veya geleceğe yönelik olasılık değildir.</p>
          <dl className="insight-details-grid"><div><dt>Önceki gözlem</dt><dd>{macroDate(selected.prior_date)}</dd></div><div><dt>Son gözlem</dt><dd>{macroDate(selected.latest_date)}</dd></div><div><dt>Karşılaştırma geçmişi</dt><dd>{macroDate(selected.history_start)} itibarıyla</dd></div><div><dt>Örneklem</dt><dd>{selected.sample_size.toLocaleString("tr-TR")} pencere</dd></div><div><dt>Gösterge kodu</dt><dd>{selected.id}</dd></div><div><dt>Değişim türü</dt><dd>{selected.change_kind==="percent"?"Göreli yüzde değişim":"Yüzde puan farkı"}</dd></div></dl>
          {selected.restricted&&<p className="insight-license-note">Bu serinin ham seviyesi lisans nedeniyle paylaşılmıyor. Yalnızca türetilmiş değişim ve tarihsel sıralama gösteriliyor.</p>}
        </>:view==="moving"?<><p className="insight-description">Hareketler, kaynağın kendi geçmişine göre büyüklük sıralamasıdır. Aylık ve çeyreklik pencereler bir arada bulunur; her kaydın gözlem tarihleri ayrıntıda gösterilir. Eski işaretlenen seriler listeye alınmaz.</p><div className="insight-categories" role="group" aria-label="Hareket kategorisi">{categories.map(value=><button key={value} type="button" aria-pressed={category===value} onClick={()=>setCategory(value)}>{value}</button>)}</div><div className="insight-full-list">{moving?.data.filter(row=>category==="Tümü"||row.category===category).map(row=><MovingRow key={row.id} row={row} choose={()=>setSelectedId(row.id)} />)}</div></>:null}
        {view==="curve"&&curve?<><p className="insight-description">ABD 10 yıllık tahvil getirisi 2 yıllık getiriden düşük olduğunda fark negatiftir. Aşağıda kaynağın tanımladığı ters eğri dönemleri yer alıyor. Bu kayıtlar bir resesyon tahmini değildir.</p><div className="insight-period-summary"><div><span>Devam eden</span><strong>{curve.open_count}</strong></div><div><span>Tamamlanan</span><strong>{closed.length}</strong></div><div><span>Listede en uzun</span><strong>{longest??"—"}<small> gün</small></strong></div></div><p className="insight-method-note">Süre, başlangıç ile bitiş (açık dönemlerde hesap tarihi) arasındaki takvim günü farkıdır; işlem günü sayısı değildir.</p><div className="insight-period-list">{curve.data.map(episode=><div key={episode.id}><div><strong>{macroDate(episode.start_date)} — {episode.end_date?macroDate(episode.end_date):"Devam ediyor"}</strong><span>{episode.open?"Devam ediyor":"Tamamlandı"} · {episode.days.toLocaleString("tr-TR")} takvim günü</span></div><div className="insight-period-bar"><i style={{width:`${Math.min(100,episode.days/(longest||episode.days||1)*100)}%`}} /></div><small>En düşük fark: {episode.extreme===null?"—":`${insightNumber(episode.extreme)} puan`}</small></div>)}</div></>:null}
      </div>
      <div className="insight-source-note"><p>Hesaplama ve tarihsel analiz kaynağı: <a href={selected?.source_url||metadata?.source_url||SOURCE} target="_blank" rel="noopener noreferrer">MacroRadar ↗</a></p><p>Ekonomik serilerden türetilen göstergeler. Kaynağın yöntemine göre hesaplanır.</p>{metadata&&<a href={metadata.method_url} target="_blank" rel="noopener noreferrer">Yöntemi kaynağında incele ↗</a>}</div>
    </dialog>
  </section>;
}
