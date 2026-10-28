import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";

const sansFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BPT Finans | Canlı Piyasa & Haber Terminali",
  description: "Borsa İstanbul, KAP bildirimleri, TCMB duyuruları ve küresel finans haberleri anlık terminali.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr" className={`${sansFont.variable} ${monoFont.variable}`}>
      <body className="antialiased">
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