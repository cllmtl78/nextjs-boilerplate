"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, Clock3, X } from "lucide-react";

export default function ReaderDialog({ source, kind, time, title, href, footerNote, children, onClose }: {
  source: string; kind: string; time?: string; title: string; href?: string; footerNote?: string; children?: ReactNode; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);
  return <dialog ref={dialog} className="reader-dialog" aria-labelledby="reader-title" onClose={onClose}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="reader-panel">
      <header className="reader-header">
        <div className="reader-identity"><span className="reader-kind">{kind}</span><div className="reader-meta"><span className="reader-source">{source}</span>{time && <span className="reader-time" title="Geliş saati"><Clock3 size={12} aria-hidden="true" />{time}</span>}</div></div>
        <button type="button" className="reader-close" aria-label="Okuma penceresini kapat" onClick={onClose}><span>ESC</span><X size={17} aria-hidden="true" /></button>
      </header>
      <div className="reader-body" tabIndex={0} aria-label="Haber içeriği">
        <h2 id="reader-title">{title}</h2>
        <div className="reader-prose">{children}</div>
      </div>
      <footer className="reader-footer">
        <span className="reader-footer-note">{footerNote || "BPT Finans · Terminal"}</span>
        <div className="reader-actions"><button type="button" className="reader-dismiss" onClick={onClose}>Kapat</button>{href && href !== "#" && <a className="reader-source-link" href={href} target="_blank" rel="noopener noreferrer">Kaynağında oku<ArrowUpRight size={15} aria-hidden="true" /></a>}</div>
      </footer>
    </div>
  </dialog>;
}
