"use client";

import { useEffect, useState } from "react";
import type { TerminalHaber } from "./TerminalWorkspace";
import { isCurrentNewsItem, watchIstanbulDay } from "@/lib/news-day";

export default function OfficialNews({ backendUrl, onSelect, endpoint = "official-news", feedName = "Nitter", bistStyle = false }: {
  backendUrl: string;
  bistStyle?: boolean;
  endpoint?: string;
  feedName?: string;
  onSelect: (item: TerminalHaber) => void;
}) {
  const [items, setItems] = useState<TerminalHaber[]>([]);
  const [state, setState] = useState("starting");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/${endpoint}`, {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!response.ok) throw new Error("Feed unavailable");
        const body = await response.json();
        if (!Array.isArray(body.data)) throw new Error("Invalid feed");
        if (!disposed) {
          setItems(body.data.filter((item: TerminalHaber) => isCurrentNewsItem(item)));
          setState(body.status);
          setPending(Number(body.pending) > 0);
        }
      } catch {
        if (!disposed) {
          setItems(current => current.filter(item => isCurrentNewsItem(item)));
          setState("unavailable");
        }
      }
    };
    void load();
    const interval = setInterval(() => void load(), 60000);
    const unwatch = watchIstanbulDay(() => {
      setItems(current => current.filter(item => isCurrentNewsItem(item)));
      void load();
    });
    return () => { disposed = true; controller.abort(); clearInterval(interval); unwatch(); };
  }, [backendUrl, endpoint]);

  return <div className="pane-scroll flex-1 min-h-0">
    {(state === "unavailable" || state === "partial") && <p className="px-4 py-2 text-xs text-slate-500">Paylaşım kaynağına erişimde sorun var.</p>}
    {items.length ? items.map(item => <button key={item.id} onClick={() => onSelect(item)}
      className={bistStyle ? "terminal-row group w-full text-left" : "block w-full text-left px-4 py-2 border-b border-white/[0.06] hover:bg-white/[0.03]"}>
      <div className={bistStyle ? "flex items-center gap-2 font-mono text-[10.5px]" : "flex items-center gap-2 text-[10px] font-mono mb-1"}>
        <span className={bistStyle ? "row-time tabular-nums text-slate-500" : "text-slate-500"}>{item.zaman}</span>
        <span className="px-1.5 py-0.5 rounded bg-[#0a1120] border border-slate-700/60 text-slate-300 font-mono text-[9.5px] uppercase tracking-wide">[{item.kaynak.toLocaleUpperCase("tr-TR")}]</span>
      </div>
      <p className={bistStyle ? "row-headline font-normal text-slate-200 group-hover:text-[#38bdf8] cursor-pointer transition text-xs leading-4" : "text-xs leading-4 font-normal text-slate-200 line-clamp-3 whitespace-pre-line"}>{item.baslik}</p>
    </button>) : <p className="p-6 text-center text-xs font-mono text-slate-500">
      {state === "starting" ? "Paylaşımlar kontrol ediliyor..." : state === "unavailable" ? `${feedName} akışına şu anda ulaşılamıyor.` : pending ? "Haberler Türkçeye çevrilmeyi bekliyor." : "Bugüne ait paylaşım bulunamadı."}
    </p>}
  </div>;
}
