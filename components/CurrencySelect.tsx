"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { currencySearch, type CurrencyOption } from "@/lib/currency-catalog";

type Props = { id: string; label: string; value: string; options: CurrencyOption[]; onChange: (value: string) => void };

export default function CurrencySelect({ id, label, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.code === value);
  const needle = currencySearch(query.trim());
  const filtered = options.filter(option => currencySearch(`${option.code} ${option.name}`).includes(needle));
  const show = () => { setQuery(""); setActive(Math.max(0, options.findIndex(option => option.code === value))); setOpen(true); };
  const choose = (code: string) => { onChange(code); setOpen(false); trigger.current?.focus(); };

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  useEffect(() => {
    const option = list.current?.children[active] as HTMLElement | undefined;
    const container = list.current;
    if (!open || !option || !container) return;
    if (option.offsetTop < container.scrollTop) container.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > container.scrollTop + container.clientHeight) container.scrollTop = option.offsetTop + option.offsetHeight - container.clientHeight;
  }, [active, open, query]);

  return <div ref={root} className="converter-dropdown" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === "Escape" && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); }
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (!open) show();
      else setActive(index => Math.max(0, Math.min(filtered.length - 1, index + (event.key === "ArrowDown" ? 1 : -1))));
    }
    if (event.key === "Enter" && open && document.activeElement === search.current) {
      event.preventDefault(); if (filtered[active]) choose(filtered[active].code);
    }
  }}>
    <label id={`${id}-label`} className="converter-label" htmlFor={id}>{label}</label>
    <button ref={trigger} type="button" id={id} className="converter-select-button" aria-haspopup="listbox" aria-expanded={open}
      aria-controls={`${id}-list`} aria-labelledby={`${id}-label ${id}-value`} disabled={!options.length}
      onClick={() => { if (open) setOpen(false); else show(); }}>
      <span id={`${id}-value`}><strong>{value}</strong>{selected && <span> · {selected.name}</span>}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <div className="converter-dropdown-menu">
      <div className="converter-dropdown-search"><Search size={13} aria-hidden="true" />
        <input ref={search} type="search" role="combobox" aria-label={`${label}: para birimi ara`} aria-autocomplete="list"
          aria-expanded="true" aria-controls={`${id}-list`} aria-activedescendant={filtered[active] ? `${id}-option-${filtered[active].code}` : undefined}
          autoComplete="off" placeholder="Kod veya ad ara..." value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} />
      </div>
      <div ref={list} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className="converter-dropdown-options">
        {filtered.map((option, index) => <button key={option.code} id={`${id}-option-${option.code}`} type="button" role="option"
          aria-selected={option.code === value} tabIndex={-1} className={index === active ? "converter-option-active" : ""}
          title={`${option.code} · ${option.name}`} onPointerMove={() => setActive(index)} onClick={() => choose(option.code)}>
          <strong>{option.code}</strong><span>{option.name}</span>{option.code === value && <Check size={12} aria-hidden="true" />}
        </button>)}
      </div>
      {!filtered.length && <p className="converter-no-options">Sonuç bulunamadı.</p>}
      <div className="converter-option-count">{filtered.length} / {options.length} birim</div>
    </div>}
  </div>;
}
