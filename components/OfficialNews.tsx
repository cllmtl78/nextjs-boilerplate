"use client";

import { useEffect, useState } from "react";
import type { TerminalHaber } from "./TerminalWorkspace";
import { isCurrentNewsItem, watchIstanbulDay } from "@/lib/news-day";

export default function OfficialNews({ backendUrl, onSelect }: {
  backendUrl: string;
  onSelect: (item: TerminalHaber) => void;
}) {
  const [items, setItems] = useState<TerminalHaber[]>([]);
  const [state, setState] = useState("starting");
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const load = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/official-news`, {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!response.ok) throw new Error("Feed unavailable");
        const body = await response.json();
        if (!Array.isArray(body.data)) throw new Error("Invalid feed");
        if (!disposed) {
          setItems(body.data.filter(isCurrentNewsItem));
          setState(body.status);
        }
      } catch {
        if (!disposed) {
          setItems(current => current.filter(isCurrentNewsItem));
          setState("unavailable");
        }
      }
    };
    void load();
    const interval = setInterval(() => void load(), 60000);
    const unwatch = watchIstanbulDay(() => {
      setItems(current => current.filter(isCurrentNewsItem));
      void load();
    });
    return () => { disposed = true; controller.abort(); clearInterval(interval); unwatch(); };
  }, [backendUrl]);

  return <div className="flex-1 min-h-0 overflow-y-auto">
    {(state === "unavailable" || state === "partial") && <p className="px-4 py-2 text-xs text-slate-500">Paylaşım kaynağına erişimde sorun var.</p>}
    {items.length ? items.map(item => <button key={item.id} onClick={() => onSelect(item)}
      className="block w-full text-left px-4 py-2 border-b border-white/[0.06] hover:bg-white/[0.03]">
      <div className="flex items-center gap-2 text-[10px] font-mono mb-1">
        <span className="text-slate-500">{item.zaman}</span>
        <span className="text-[#38bdf8]">{item.kaynak}</span>
      </div>
      <p className="text-xs leading-4 font-normal text-slate-200 line-clamp-3 whitespace-pre-line">{item.baslik}</p>
    </button>) : <p className="p-6 text-center text-xs font-mono text-slate-500">
      {state === "starting" ? "Paylaşımlar kontrol ediliyor..." : state === "unavailable" ? "Nitter akışına şu anda ulaşılamıyor." : "Bugüne ait paylaşım bulunamadı."}
    </p>}
  </div>;
}
