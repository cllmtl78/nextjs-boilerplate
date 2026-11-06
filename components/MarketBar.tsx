"use client";

import { useEffect, useRef, useState } from "react";
import { MARKET_INSTRUMENTS, emptyMarketItem, expireMarketItems, mergeMarketItems, normalizeMarketItems, type MarketItem } from "@/lib/market-types";

export default function MarketBar() {
  const [items,setItems]=useState<MarketItem[]>(()=>MARKET_INSTRUMENTS.map(emptyMarketItem));
  const [flashes,setFlashes]=useState<Record<string,"yukari"|"asagi">>({});
  const [loading,setLoading]=useState(true);
  const previousPrices=useRef(new Map<string,number>());

  useEffect(()=>{
    let disposed=false;
    let request:AbortController|null=null;
    let flashTimer:ReturnType<typeof setTimeout>|undefined;
    const refresh=async()=>{
      if(request||document.hidden) return;
      const controller=new AbortController(); request=controller;
      const timeout=setTimeout(()=>controller.abort(),12000);
      try {
        const response=await fetch("/api/market",{cache:"no-store",signal:controller.signal});
        const body=await response.json();
        if(!Array.isArray(body.items)) throw Error("Piyasa verisi okunamadı");
        if(disposed) return;
        const next=normalizeMarketItems(body.items);
        const changed:Record<string,"yukari"|"asagi">={};
        for(const item of next) {
          if(item.status!=="ok"||item.fiyat===null) continue;
          const previous=previousPrices.current.get(item.kod);
          if(previous!==undefined&&previous!==item.fiyat) changed[item.kod]=item.fiyat>previous?"yukari":"asagi";
          previousPrices.current.set(item.kod,item.fiyat);
        }
        setItems(current=>mergeMarketItems(current,next));
        setFlashes(changed);
        clearTimeout(flashTimer);
        flashTimer=setTimeout(()=>{if(!disposed)setFlashes({});},1200);
      }catch {
        if(!disposed) {setItems(current=>expireMarketItems(current));setFlashes({});}
      }finally {clearTimeout(timeout);request=null;if(!disposed)setLoading(false);}
    };
    void refresh();
    const interval=setInterval(()=>{void refresh();},15000);
    const wake=()=>{if(!document.hidden)void refresh();};
    document.addEventListener("visibilitychange",wake);
    return()=>{disposed=true;request?.abort();clearInterval(interval);clearTimeout(flashTimer);document.removeEventListener("visibilitychange",wake);};
  },[]);

  return (
    <div className="ticker-wrapper">
      <div className="ticker-viewport">
        <div className="ticker-track" style={{animationDuration:`${items.length*4.5}s`}}>
          {[...items,...items].map((item,index)=>{
            const definition=MARKET_INSTRUMENTS[index%items.length];
            const change=item.degisimYuzde;
            const state=loading?"Veri bekleniyor":item.status==="stale"?"Son alınan fiyat; kaynak yenilenemedi":item.status==="unavailable"?"Veri alınamadı":"Son kaynak fiyatı";
            const quoteTime=item.quoteTime?new Date(item.quoteTime).toLocaleString("tr-TR",{timeZone:"Europe/Istanbul"}):"kaynak zamanı belirtilmedi";
            const details=[definition.description,state,item.source,`Kaynak zamanı: ${quoteTime}`,item.fiyat!==null&&change===null?"Önceki kapanış alınamadı; yüzde değişimi yok":null,item.delayMinutes!==null?`Kaynak gecikmesi: ${item.delayMinutes} dk`:"Kaynağa göre gecikme olabilir"].filter(Boolean).join(" · ");
            return (
              <div key={`${item.kod}-${index}`} title={details} className={`ticker-item ${flashes[item.kod]==="yukari"?"flash-tick-up":flashes[item.kod]==="asagi"?"flash-tick-down":""}`} aria-hidden={index>=items.length}>
                <span className="ticker-kod font-mono">{item.ad}</span>
                <span className="ticker-fiyat font-mono tabular-nums">{item.fiyat===null?"--":item.fiyat.toLocaleString("tr-TR",{minimumFractionDigits:item.ondalik,maximumFractionDigits:item.ondalik})}</span>
                {item.fiyat===null ? <span className="ticker-state">{loading?"BEKLENİYOR":"VERİ YOK"}</span> : <>
                  <span className={`ticker-pill font-mono tabular-nums ${change===null||change===0?"ticker-pill-neutral":change>0?"ticker-pill-up":"ticker-pill-down"}`}>{change===null?"--":`${change>0?"+":""}${change.toFixed(2)}%`}</span>
                  {item.status==="stale"&&<span className="ticker-state">SON VERİ</span>}
                </>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
