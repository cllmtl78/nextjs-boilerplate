"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Bell, BellOff } from "lucide-react";
import { initializeSound, resumeSavedSound, serverSoundEnabled, soundEnabled, subscribeSound, toggleSound } from "@/lib/notification-sound";

export default function NotificationBell() {
  const enabled = useSyncExternalStore(subscribeSound, soundEnabled, serverSoundEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    initializeSound();
    document.addEventListener("pointerdown", resumeSavedSound);
    document.addEventListener("keydown", resumeSavedSound);
    return () => {
      document.removeEventListener("pointerdown", resumeSavedSound);
      document.removeEventListener("keydown", resumeSavedSound);
    };
  }, []);
  const label = enabled ? "Haber sesini kapat" : "Haber sesini aç";
  return <div className="notification-control">
    <button type="button" className={`notification-bell ${enabled ? "notification-bell-on" : ""}`}
      aria-label={label} aria-pressed={enabled} disabled={busy} title={error || label}
      onClick={async () => {
        setBusy(true); setError("");
        try { await toggleSound(); } catch { setError("Ses açılamadı. Zile tekrar dokun."); }
        finally { setBusy(false); }
      }}>
      {enabled ? <Bell size={16} aria-hidden="true" /> : <BellOff size={16} aria-hidden="true" />}
    </button>
    <span className="sr-only" role="status">{error}</span>
  </div>;
}
