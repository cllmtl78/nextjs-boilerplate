"use client";

import { useEffect, useState } from "react";
import type { SystemHealth } from "@/lib/system-status";

export default function SystemStatus() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  useEffect(() => {
    let disposed = false;
    let running = false;
    const controller = new AbortController();
    const load = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch("/api/system-status", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        if (!response.ok) throw new Error("Status unavailable");
        const body: SystemHealth = await response.json();
        if (!["ok", "degraded", "unavailable"].includes(body.state) || !Array.isArray(body.services)) throw new Error("Invalid status");
        if (!disposed) setHealth(body);
      } catch {
        if (!disposed) setHealth({ state: "unavailable", checkedAt: new Date().toISOString(), services: [] });
      } finally { running = false; }
    };
    void load();
    const interval = setInterval(() => void load(), 60000);
    return () => { disposed = true; controller.abort(); clearInterval(interval); };
  }, []);
  const state = health?.state || "checking";
  const label = state === "ok" ? "Sistem aktif" : state === "degraded" ? "Kısmi erişim" : state === "unavailable" ? "Bağlantı sorunu" : "Kontrol ediliyor";
  return <details className={`system-status system-status-${state}`}>
    <summary aria-label={`Sistem durumu: ${label}`}><span className="system-status-dot" aria-hidden="true" /><span>{label}</span></summary>
    <div className="system-status-popover">
      <strong>Sistem durumu</strong>
      <p role="status">{label}</p>
      {health?.services.length ? <ul>{health.services.map(service => <li key={service.name}><span>{service.name}</span><span className={`service-state-${service.state}`}>{service.state === "ok" ? "Aktif" : service.state === "degraded" ? "Sınırlı" : "Erişilemiyor"}</span></li>)}</ul> : null}
      <small>Bağlantılar ve akışların bildirdiği durum kontrol edilir; her kaynağın anlık güncelliğini garanti etmez.</small>
      {health && <small>Son kontrol: {new Date(health.checkedAt).toLocaleTimeString("tr-TR", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit" })}</small>}
    </div>
  </details>;
}
