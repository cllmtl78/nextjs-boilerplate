"use client";

import dynamic from "next/dynamic";

// The terminal initializes several feeds from browser storage. Rendering those
// caches against an empty server snapshot remounts the whole dashboard on reload.
const TerminalWorkspace = dynamic(() => import("./TerminalWorkspace"), {
  ssr: false,
  loading: () => <div className="terminal-grid" aria-label="Terminal yükleniyor" aria-busy="true">
    {[0, 1, 2].map(index => <div key={index} className="h-[520px] rounded-lg border border-white/[0.06] bg-[#0d1322] animate-pulse" />)}
  </div>,
});

export default function TerminalClient() {
  return <TerminalWorkspace />;
}
