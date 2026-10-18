import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "BPT Finans | Finans Haberleri",
  description: "Borsa, döviz, emtia ve ekonomi haberleri.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body>
        <Header />
        <main className="container main">{children}</main>
        <div className="footer-wrap">
          <footer className="container footer">
            <p>
              Bu sitedeki içerikler bilgilendirme amaçlıdır ve yatırım tavsiyesi
              değildir.
            </p>
            <p>© 2026 BPT Finans. Tüm hakları saklıdır.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}