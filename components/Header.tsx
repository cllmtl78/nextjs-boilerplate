import Link from "next/link";
import Weather from "./Weather";
import MarketBar from "./MarketBar";

export default function Header() {
  const bugun = new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });

  return (
    <header className="site-header">
      <div className="mainbar">
        <div className="mainbar-inner">
          <Link href="/" className="brand" style={{ padding: "6px 0" }}>
            <img
              src="/logo.png"
              alt="BPT Finans"
              style={{ height: "52px", width: "auto", display: "block" }}
            />
          </Link>

          <div className="header-sag" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px", fontSize: "12.5px", color: "#93c5fd" }}>
            <span style={{ fontWeight: 600, color: "#e2e8f0" }}>{bugun}</span>
            <Weather />
          </div>
        </div>
      </div>

      <MarketBar />
    </header>
  );
}