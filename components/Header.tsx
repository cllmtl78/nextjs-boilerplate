"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import NotificationBell from "./NotificationBell";
import Weather from "./Weather";
import MarketBar from "./MarketBar";
import SystemStatus from "./SystemStatus";
import { EXCHANGES, marketSessions } from "@/lib/market-sessions";

export default function Header() {
  const pathname = usePathname();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const update = () => setNow(new Date());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);
  const sessions = now ? marketSessions(now) : EXCHANGES.map(exchange => ({ name: exchange.name, isOpen: false, countdown: null }));
  const clock = now?.toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }) || "--:--:--";

  return (
    <header className="site-header">
      <div className="topbar">
        <div className="topbar-inner">
          <div className="exchange-status">
            {sessions.map(session => (
              <span key={session.name} className={`exchange-badge ${session.isOpen ? "exchange-open" : "exchange-closed"}`}
                title="Normal hafta içi seans saatleri; resmî tatil ve yarım günler dahil değildir.">
                <span className="exchange-dot" aria-hidden="true">●</span>
                <span className="font-semibold">{session.name}</span>
                <span>{!now ? "--" : session.isOpen ? "Açık" : "Kapalı"}</span>
                {session.countdown && <span className="exchange-countdown tabular-nums" aria-label={`Kapanışa ${session.countdown}`}>
                  <span className="exchange-countdown-label">Kapanışa </span>{session.countdown}
                </span>}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mainbar">
        <div className="mainbar-inner">
          <div className="header-brand-nav">
            <div className="brand-group">
              <Link href="/" className="brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="BPT Finans" className="brand-logo" />
              </Link>
              <div className="terminal-badge-wrap"><span className="terminal-tag">TERMINAL</span></div>
            </div>
            <div className="header-navigation">
              <nav className="header-nav" aria-label="Ana gezinme">
                <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>Ana sayfa</Link>
                <Link href="/makro" aria-current={pathname === "/makro" ? "page" : undefined}>Makro</Link>
              </nav>
              <SystemStatus />
            </div>
          </div>
          <div className="header-tools">
            <NotificationBell />
            <div className="header-clock-weather">
              <div className="header-clock font-mono tabular-nums">{clock}</div>
              <Weather />
            </div>
          </div>
        </div>
      </div>
      <MarketBar />
    </header>
  );
}
