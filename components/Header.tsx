import Link from "next/link";
import Weather from "./Weather";
import MarketBar from "./MarketBar";

const menu = [
  { ad: "Haberler", href: "/" },
  { ad: "Hakkımızda", href: "/hakkimizda" },
  { ad: "İletişim", href: "/iletisim" },
];

export default function Header() {
  const bugun = new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  });

  return (
    <header className="site-header">
      <div className="topbar">
        <div className="topbar-inner">
          <span>{bugun}</span>
          <Weather />
        </div>
      </div>

      <div className="mainbar">
        <div className="mainbar-inner">
          <Link href="/" className="brand" style={{ padding: "8px 0" }}>
            <img
              src="/logo.png"
              alt="BPT Finans"
              style={{ height: "64px", width: "auto", display: "block" }}
            />
          </Link>

          <nav className="site-nav">
            {menu.map((m) => (
              <Link key={m.href} href={m.href}>
                {m.ad}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <MarketBar />
    </header>
  );
}