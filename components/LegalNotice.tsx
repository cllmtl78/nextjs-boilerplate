"use client";

import { useRef } from "react";

export default function LegalNotice() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className="legal-notice-trigger"
        onClick={() => dialogRef.current?.showModal()}
      >
        Yasal Uyarı
      </button>
      <dialog
        ref={dialogRef}
        className="legal-notice-dialog"
        aria-labelledby="legal-notice-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="legal-notice-panel">
          <div className="flex items-center justify-between border-b border-white/10 gap-4 px-5 py-4 sm:px-6">
            <h2 id="legal-notice-title" className="text-base font-bold text-[#38bdf8]">
              Yasal Uyarı
            </h2>
            <button
              type="button"
              aria-label="Yasal uyarıyı kapat"
              className="shrink-0 px-2 py-1 text-sm text-slate-400 hover:text-white"
              onClick={() => dialogRef.current?.close()}
            >
              ✕ ESC
            </button>
          </div>
          <p className="px-5 py-5 sm:px-6 text-sm leading-relaxed text-slate-300">
            Sitemiz bir haber terminali olup, içerikler otomatik olarak RSS üzerinden
            çekilmektedir. İçeriklerin mülkiyeti kaynak sitelere aittir. Telif hakkı
            bildirimi için{" "}
            <a href="mailto:finans@bpt.tr" className="font-semibold text-[#38bdf8] underline underline-offset-2">
              finans@bpt.tr
            </a>{" "}
            adresi üzerinden uyar-kaldır talebinde bulunabilirsiniz.
          </p>
        </div>
      </dialog>
    </>
  );
}
