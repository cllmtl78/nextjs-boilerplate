"use client";

import { useEffect, useState } from "react";
import { CALENDAR_REFRESH_MS, investingCalendarEmbedUrl } from "@/lib/calendar-embed";

// Load the provider's supported embed in the visitor's browser. Do not scrape
// it on the server: the production server receives HTTP 403 from Investing.
export default function EconomicCalendar() {
  const [refresh, setRefresh] = useState<number>();

  useEffect(() => {
    const timer = window.setInterval(() => setRefresh(Date.now()), CALENDAR_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section aria-label="Ekonomik takvim" className="rounded-lg border border-white/[0.06] bg-[#0d1322] flex flex-col h-[380px] overflow-hidden">
      <div className="h-10 px-4 flex items-center justify-between border-b border-white/[0.06] bg-slate-900/40 shrink-0">
        <h2 className="font-mono text-xs font-bold tracking-wider text-slate-200">
          <span className="text-[#38bdf8] mr-1.5 font-bold">/</span> TAKVİM
        </h2>
        <button type="button" onClick={() => setRefresh(Date.now())} aria-label="Takvimi yenile" title="Takvimi yenile" className="text-[#38bdf8] hover:text-sky-200 text-lg leading-none px-1 py-1">↻</button>
      </div>
      <iframe
        key={refresh ?? "initial"}
        title="Investing ekonomik takvim"
        src={investingCalendarEmbedUrl(refresh)}
        className="w-full min-h-0 flex-1 border-0 bg-[#0d1322]"
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <div className="flex items-center justify-between px-2 py-1 border-t border-white/[0.06] text-[9px] font-mono text-slate-500 shrink-0">
        <span>60 sn’de bir yenilenir · GMT+3</span>
        <a href={investingCalendarEmbedUrl()} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-[#38bdf8]">Investing.com ↗</a>
      </div>
    </section>
  );
}
