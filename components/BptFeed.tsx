"use client";

import { useEffect, useState } from "react";
import { isCurrentNewsItem, watchIstanbulDay } from "@/lib/news-day";
import { observeFeedArrivals } from "@/lib/notification-sound";

type Post = { id: string; baslik: string; timestamp: number; zaman: string; url: string };
const validPost = (item: Post) => item && typeof item.baslik === "string" &&
  /^https:\/\/x\.com\/bptfinans\/status\/\d+$/.test(item.url) && isCurrentNewsItem(item);

export default function BptFeed({ backendUrl }: { backendUrl: string }) {
  const [items, setItems] = useState<Post[]>([]);
  const [state, setState] = useState("starting");
  useEffect(() => {
    let disposed = false;
    let running = false;
    const controller = new AbortController();
    const load = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch(`${backendUrl}/api/bpt-news`, {
          cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!response.ok) throw new Error("Feed unavailable");
        const body = await response.json();
        if (!Array.isArray(body.data)) throw new Error("Invalid feed");
        const fresh: Post[] = body.data.filter(validPost).sort((a: Post, b: Post) => b.timestamp - a.timestamp);
        if (!disposed) {
          observeFeedArrivals("bpt-news", fresh);
          setItems(fresh);
          setState(body.status);
        }
      } catch {
        if (!disposed) {
          setItems(current => current.filter(item => isCurrentNewsItem(item)));
          setState("unavailable");
        }
      } finally { running = false; }
    };
    void load();
    const interval = setInterval(() => void load(), 60000);
    const unwatch = watchIstanbulDay(() => {
      setItems(current => current.filter(item => isCurrentNewsItem(item)));
      void load();
    });
    return () => { disposed = true; controller.abort(); clearInterval(interval); unwatch(); };
  }, [backendUrl]);

  return <section className="bpt-feed rounded-lg border border-white/[0.06] bg-[#0d1322] overflow-hidden" aria-labelledby="bpt-feed-title">
    <div className="feed-panel-heading px-4 flex items-center border-b border-white/[0.06] shrink-0">
      <h2 id="bpt-feed-title" className="font-mono text-xs font-semibold tracking-wider text-slate-200">
        <span className="text-[#38bdf8] font-bold mr-1.5">/</span>BPT Finans
      </h2>
    </div>
    {state === "unavailable" && items.length > 0 && <p className="px-4 py-2 text-xs text-slate-500">Paylaşımlar şu anda güncellenemiyor.</p>}
    {items.length > 0 ? <div className="bpt-feed-track" role="region" aria-label="BPT Finans paylaşımları, en yeni solda" tabIndex={0}>
      {items.map(item => <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer" className="bpt-post">
        <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
          <span className="feed-time tabular-nums">{item.zaman}</span>
          <span className="feed-source">[BPT FİNANS]</span>
          <span className="feed-time">X</span>
        </div>
        <p className="feed-headline mt-2 text-xs leading-5 whitespace-pre-line">{item.baslik}</p>
      </a>)}
    </div> : <p className="p-6 text-center text-xs font-mono text-slate-500">
      {state === "starting" ? "Paylaşımlar kontrol ediliyor..." : state === "unavailable" ? "BPT Finans paylaşımlarına şu anda ulaşılamıyor." : "Bugüne ait paylaşım bulunamadı."}
    </p>}
  </section>;
}
