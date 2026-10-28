"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  Globe,
  Building2,
  Landmark,
  X,
} from "lucide-react";

export type TerminalHaber = {
  id: string;
  zaman: string;
  tarih: string;
  kaynak: string;
  baslik: string;
  spot?: string;
  detay: string;
  kategori: "bist" | "global" | "kap" | "resmi";
  onem?: "flas" | "onemli" | "normal";
  hisseler?: string[];
  piyasaEtkisi?: "pozitif" | "negatif" | "notr";
  kapTuru?: "ÖDA" | "PGO" | "FR" | "GKK" | "SÖZ";
  resmiKurum?: "TCMB" | "SPK" | "BDDK" | "HMB" | "TÜİK" | "RESMİ GAZETE";
};

const BASLANGIC_HABERLER: TerminalHaber[] = [
  // BIST & TÜRKİYE
  {
    id: "b1",
    zaman: "16:24:18",
    tarih: "Bugün",
    kaynak: "FOREKS",
    kategori: "bist",
    onem: "flas",
    baslik: "Türk Hava Yolları, 2026 yılı 3. çeyrek yolcu doluluk oranlarında artış kaydetti",
    spot: "Toplam yolcu sayısı yıllık bazda %12.4 artarak 24.8 milyona ulaştı. Dış hat transfer yolcu trafiğinde dengeli seyir sürüyor.",
    detay: "Şirketten Kamuyu Aydınlatma Platformu'na ve analistlere yapılan sunumda, kargo birimi Turkish Cargo'nun küresel pazar payının %6.2'ye çıktığı ve filoya eklenecek yeni nesil uçaklarla kapasitenin güçlendirileceği ifade edildi.",
    piyasaEtkisi: "pozitif",
  },
  {
    id: "b2",
    zaman: "16:15:02",
    tarih: "Bugün",
    kaynak: "BLOOMBERG HT",
    kategori: "bist",
    onem: "onemli",
    baslik: "Demir-çelik sektöründe yerli üretim kapasite kullanım oranı %78.6 seviyesine yükseldi",
    spot: "Cevher ve enerji maliyetlerindeki dengelenme sonrası üreticilerin ihracat marjlarında toparlanma izleniyor.",
    detay: "Çelik İhracatçıları Birliği değerlendirmesinde, modernizasyon yatırımlarının hızlanmasıyla katma değerli yassı çelik siparişlerinin arttığı kaydedildi.",
    piyasaEtkisi: "pozitif",
  },
  {
    id: "b3",
    zaman: "15:58:45",
    tarih: "Bugün",
    kaynak: "AA FİNANS",
    kategori: "bist",
    onem: "normal",
    baslik: "Aselsan, yurt dışı savunma konsorsiyumu ile 84.5 milyon dolarlık radar teslimat anlaşması imzaladı",
    spot: "Teslimatların 2026 son çeyreği ile 2027 ilk yarısı arasında tamamlanması planlanıyor.",
    detay: "Sözleşme kapsamında yerli AESA radar platformlarının entegrasyonu ve bakım-onarım paketi yer alıyor. Bakiye sipariş toplamı 13.1 milyar dolar düzeyine çıktı.",
    piyasaEtkisi: "pozitif",
  },
  {
    id: "b4",
    zaman: "15:42:10",
    tarih: "Bugün",
    kaynak: "BIST DESK",
    kategori: "bist",
    onem: "normal",
    baslik: "Bankacılık endeksinde net faiz marjı toparlanmasıyla hacim artışı izleniyor",
    spot: "XBANK günlük kazanımı %1.85 seviyesinde seyrederken işlem hacminde bankalar ilk sıralarda kalmaya devam ediyor.",
    detay: "Aracı kurum raporlarında bankacılık sektörünün özkaynak karlılığı görünümünün dengeli olduğu ve TL mevduat payının istikrarlı seyrettiği vurgulanıyor.",
    piyasaEtkisi: "pozitif",
  },
  {
    id: "b5",
    zaman: "15:30:19",
    tarih: "Bugün",
    kaynak: "REUTERS TR",
    kategori: "bist",
    onem: "normal",
    baslik: "Perakende gıda zincirlerinde lojistik optimizasyonu operasyonel karlılığı destekliyor",
    spot: "Organize perakende sektöründe yeni mağaza açılışları ve dağıtım merkezi yatırımları devam ediyor.",
    detay: "Tüketici sepet harcamalarında temel gıda talebinin dirençli kalması, marjlardaki dönemsel baskıyı sınırlıyor.",
    piyasaEtkisi: "notr",
  },
  {
    id: "b6",
    zaman: "15:18:33",
    tarih: "Bugün",
    kaynak: "MATRİKS",
    kategori: "bist",
    onem: "normal",
    baslik: "Telekomünikasyon sektöründe abone başı gelir büyümesi istikrarlı seyrini koruyor",
    spot: "Fiber internet altyapı yatırımları ve şebeke modernizasyonu sürüyor.",
    detay: "Faturalı abone oranının artmasıyla birlikte telekom şirketlerinin nakit akışı yaratma kapasitesi destekleniyor.",
    piyasaEtkisi: "pozitif",
  },

  // GLOBAL
  {
    id: "g1",
    zaman: "16:20:11",
    tarih: "Bugün",
    kaynak: "BLOOMBERG",
    kategori: "global",
    onem: "flas",
    baslik: "Fed Yönetim Kurulu: Enflasyonda düşüş eğilimi faiz adımlarının planlandığı şekilde sürmesine imkan tanıyor",
    spot: "İşgücü piyasasında soğumanın kontrol altında olduğu ve para politikasının nötr seviyeye doğru kademeli ayarlanacağı belirtildi.",
    detay: "Piyasa fiyatlamalarında 25 baz puanlık faiz indirim olasılığı %86'ya yükseldi. ABD 10 yıllık tahvil getirisi %4.18 seviyesine gevşedi.",
    piyasaEtkisi: "pozitif",
  },
  {
    id: "g2",
    zaman: "16:04:40",
    tarih: "Bugün",
    kaynak: "REUTERS",
    kategori: "global",
    onem: "onemli",
    baslik: "ECB: Hizmet sektörü enflasyonunda yavaşlama sinyalleri güçleniyor",
    spot: "Euro Bölgesi'nde kredi talebinde toparlanma sinyalleri izlenirken sanayi üretimi toparlanma eğiliminde.",
    detay: "Ücret baskılarının hedeflenen patikaya yakınsayacağı ve para politikasındaki dengelenmenin iktisadi aktiviteyi destekleyeceği belirtildi.",
    piyasaEtkisi: "notr",
  },
  {
    id: "g3",
    zaman: "15:47:22",
    tarih: "Bugün",
    kaynak: "FINANCIAL TIMES",
    kategori: "global",
    onem: "normal",
    baslik: "OPEC+ toplantısı öncesi Brent petrol 74.80 dolar bandında yatay seyrediyor",
    spot: "Küresel talep projeksiyonları ve ABD stok verileri öncesinde enerji emtialarında dalgalanma sınırlı kaldı.",
    detay: "Uluslararası Enerji Ajansı haftalık bülteninde rafineri işletme oranlarındaki toparlanmanın altı çizildi.",
    piyasaEtkisi: "notr",
  },
  {
    id: "g4",
    zaman: "15:26:05",
    tarih: "Bugün",
    kaynak: "CNBC",
    kategori: "global",
    onem: "normal",
    baslik: "Wall Street vadeli kontratlarında teknoloji şirketleri öncülüğünde pozitif seyir",
    spot: "Nasdaq 100 vadelileri %+0.65, S&P 500 vadelileri %+0.42 artıda işlem görüyor.",
    detay: "Yarı iletken sektörü öncülüğünde kurumsal yatırım harcamalarına dair şirket açıklamaları risk iştahını destekliyor.",
    piyasaEtkisi: "pozitif",
  },
  {
    id: "g5",
    zaman: "15:05:51",
    tarih: "Bugün",
    kaynak: "NIKKEI",
    kategori: "global",
    onem: "normal",
    baslik: "Asya piyasalarında Japon Yeni güçlenirken Nikkei endeksi günü %+0.35 ile tamamladı",
    spot: "Japonya Merkez Bankası faiz kararı beklentileri Asya para birimlerinde fiyatlamaları etkiledi.",
    detay: "Bölgesel teknoloji tedarikçileri güçlü sipariş akışıyla endekste pozitif ayrışmayı sürdürdü.",
    piyasaEtkisi: "notr",
  },

  // KAP BİLDİRİMLERİ (Hisse kodları korundu)
  {
    id: "k1",
    zaman: "16:27:04",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    onem: "onemli",
    hisseler: ["KCHOL"],
    kapTuru: "PGO",
    baslik: "Koç Holding A.Ş. — Pay Geri Alım İşlemlerine İlişkin Bildirim",
    spot: "Yönetim Kurulu kararı uyarınca 150.000 adet pay 214.50 - 216.00 TL fiyat aralığından geri alındı.",
    detay: "Şirketin sahip olduğu KCHOL payları sermayenin %0.84'üne ulaşmıştır. Program çerçevesinde fon kaynağı şirket iç kaynaklarından karşılanmaktadır.",
    piyasaEtkisi: "pozitif",
  },
  {
    id: "k2",
    zaman: "16:11:18",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    onem: "flas",
    hisseler: ["SISE"],
    kapTuru: "ÖDA",
    baslik: "Türkiye Şişe ve Cam Fabrikaları A.Ş. — Kapasite Artışı ve Modernizasyon Kararı",
    spot: "Mimari camlar üretim hattına yönelik 185 milyon euroluk hat modernizasyonu onaylandı.",
    detay: "Yatırımın 2027 ilk çeyreğinde tamamlanmasıyla enerji tüketiminde verimlilik ve katma değerli kaplamalı cam üretiminde kapasite artışı hedeflenmektedir.",
    piyasaEtkisi: "pozitif",
  },
  {
    id: "k3",
    zaman: "15:50:30",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    onem: "normal",
    hisseler: ["SASA"],
    kapTuru: "FR",
    baslik: "SASA Polyester Sanayi A.Ş. — Dönemsel Faaliyet ve Yatırım Raporu",
    spot: "Üretim tesisinde deneme üretim süreçlerine ilişkin teknik revizyonlar kamuoyuna açıklandı.",
    detay: "Tesisin ticari üretim takvimi ve ham madde tedarik sözleşmelerinin finansal tablolara yansıması paylaşıldı.",
    piyasaEtkisi: "notr",
  },
  {
    id: "k4",
    zaman: "15:36:12",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    onem: "normal",
    hisseler: ["FROTO"],
    kapTuru: "SÖZ",
    baslik: "Ford Otomotiv Sanayi A.Ş. — Yeni Model Batarya Montaj Tedarik Sözleşmesi",
    spot: "İhraç edilecek ticari araç serisi için batarya paketleme anlaşması imzalandı.",
    detay: "Sözleşmenin şirketin ihracat hacmine yıllık yaklaşık 320 milyon euro katkı sağlaması öngörülmektedir.",
    piyasaEtkisi: "pozitif",
  },
  {
    id: "k5",
    zaman: "15:14:09",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    onem: "normal",
    hisseler: ["TUPRS"],
    kapTuru: "ÖDA",
    baslik: "Tüpraş — Rafineri Bakım Planı Güncellemesi Bildirildi",
    spot: "İzmit Rafinerisi ünitesinde planlı bakım çalışması 18 gün içinde tamamlanacak.",
    detay: "Planlı duruş süresince nihai ürün satışları mevcut stoklardan karşılanacak olup satış hacminde kesinti öngörülmemektedir.",
    piyasaEtkisi: "notr",
  },

  // RESMİ KURUMLAR
  {
    id: "r1",
    zaman: "16:22:00",
    tarih: "Bugün",
    kaynak: "TCMB",
    kategori: "resmi",
    resmiKurum: "TCMB",
    onem: "flas",
    baslik: "TCMB: Para Politikası Kurulu Toplantı Özeti yayımlandı",
    spot: "Enflasyonun ana eğiliminde kalıcı düşüş sağlanana kadar sıkı para politikası duruşunun sürdürüleceği belirtildi.",
    detay: "Kurul, yurt içi talepteki dengelenmenin sürdüğünü ve TL likidite sterilizasyon araçlarının etkin kullanılacağını ifade etti.",
    piyasaEtkisi: "pozitif",
  },
  {
    id: "r2",
    zaman: "16:01:15",
    tarih: "Bugün",
    kaynak: "SPK",
    kategori: "resmi",
    resmiKurum: "SPK",
    onem: "onemli",
    baslik: "SPK Haftalık Bülteni: 2 şirketin sermaye piyasası ihracına onay verildi",
    spot: "Sermaye piyasalarının derinleşmesi kapsamında 2 sanayi şirketinin pay ihracı onaylandı.",
    detay: "Halka arz gelirlerinin büyük kısmının işletme sermayesi ve kapasite artırım yatırımlarında kullanılacağı bildirildi.",
    piyasaEtkisi: "pozitif",
  },
  {
    id: "r3",
    zaman: "15:40:00",
    tarih: "Bugün",
    kaynak: "BDDK",
    kategori: "resmi",
    resmiKurum: "BDDK",
    onem: "normal",
    baslik: "BDDK Haftalık Bankacılık Verileri: TL mevduat payı artışını koruyor",
    spot: "Kur Korumalı Mevduat toplam bakiyesinde haftalık düşüş devam etti.",
    detay: "TL mevduatın toplam mevduat içindeki payı %56.4'e yükselirken bankacılık sektörünün sermaye yeterlilik rasyosu %17.2 seviyesinde gerçekleşti.",
    piyasaEtkisi: "pozitif",
  },
  {
    id: "r4",
    zaman: "15:15:00",
    tarih: "Bugün",
    kaynak: "HMB",
    kategori: "resmi",
    resmiKurum: "HMB",
    onem: "normal",
    baslik: "Hazine ve Maliye Bakanlığı: Merkezi Yönetim Bütçe Dengesi ilk 9 ayda hedeflerle uyumlu gerçekleşti",
    spot: "Mali disiplin tedbirlerinin bütçe dengesi üzerindeki olumlu etkisi sürüyor.",
    detay: "Açıklamada, Hazine nakit rezervlerinin güçlü seviyesini koruduğu kaydedildi.",
    piyasaEtkisi: "pozitif",
  },
  {
    id: "r5",
    zaman: "10:00:00",
    tarih: "Bugün",
    kaynak: "TÜİK",
    kategori: "resmi",
    resmiKurum: "TÜİK",
    onem: "flas",
    baslik: "TÜİK: Yıllık Tüketici Fiyat Endeksi gerilemesini sürdürdü",
    spot: "TÜFE aylık bazda %+1.88 artarken yıllık enflasyon %44.20 seviyesine indi.",
    detay: "Çekirdek enflasyon göstergelerinde genele yayılan yavaşlama izlendi.",
    piyasaEtkisi: "pozitif",
  },
];

export default function TerminalWorkspace() {
  const [haberler, setHaberler] = useState<TerminalHaber[]>(BASLANGIC_HABERLER);
  const [seciliHaber, setSeciliHaber] = useState<TerminalHaber | null>(null);

  // Periyodik hafif canlı güncelleme
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const zamanStr = now.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      const havuz: Partial<TerminalHaber>[] = [
        {
          kaynak: "KAP",
          kategori: "kap",
          onem: "normal",
          hisseler: ["BIMAS"],
          kapTuru: "PGO",
          baslik: "BİM Birleşik Mağazalar A.Ş. — Pay Geri Alım İşlemi Gerçekleştirildi",
          spot: "Geri alım işlemi ortalama 488.50 TL fiyattan tamamlandı.",
          detay: "Şirketin sermayedeki payı %0.42 seviyesine ulaşmıştır.",
          piyasaEtkisi: "notr",
        },
        {
          kaynak: "FOREKS",
          kategori: "bist",
          onem: "normal",
          baslik: "THY, yurt dışı hatlarda ilave sefer düzenleme kararı aldı",
          spot: "Asya-Pasifik rotalarında frekans artışı tamamlandı.",
          detay: "Uzak Doğu transfer yolcu trafiğinde büyüme planı çerçevesinde uçuş izinleri onaylandı.",
          piyasaEtkisi: "pozitif",
        },
      ];

      const rastgele = havuz[Math.floor(Math.random() * havuz.length)];
      const yeni: TerminalHaber = {
        id: "live_" + Date.now(),
        zaman: zamanStr,
        tarih: "Bugün",
        kaynak: rastgele.kaynak || "TERMINAL",
        kategori: rastgele.kategori || "bist",
        onem: rastgele.onem || "normal",
        hisseler: rastgele.hisseler || [],
        kapTuru: rastgele.kapTuru,
        baslik: rastgele.baslik || "Piyasada yeni işlem hacmi gerçekleşti",
        spot: rastgele.spot || "Haber akışı terminale işlendi.",
        detay: rastgele.detay || "Piyasa analistleri gelişmeyi takip ediyor.",
        piyasaEtkisi: rastgele.piyasaEtkisi || "notr",
      };

      setHaberler((prev) => [yeni, ...prev.slice(0, 35)]);
    }, 25000);

    return () => clearInterval(interval);
  }, []);

  const bistHaberleri = haberler.filter((h) => h.kategori === "bist");
  const globalHaberleri = haberler.filter((h) => h.kategori === "global");
  const kapBildirimleri = haberler.filter((h) => h.kategori === "kap");
  const resmiHaberleri = haberler.filter((h) => h.kategori === "resmi");

  return (
    <div className="terminal-workspace">
      {/* 3-SÜTUNLU ANA TERMİNAL GRİDİ */}
      <div className="terminal-grid">
        {/* SÜTUN 1: BIST & Türkiye */}
        <section className="terminal-pane">
          <div className="pane-header">
            <div className="pane-title-group">
              <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="pane-title">BIST & Türkiye</h2>
            </div>
          </div>

          <div className="pane-scroll">
            {bistHaberleri.map((h) => (
              <article
                key={h.id}
                onClick={() => setSeciliHaber(h)}
                className="terminal-row"
              >
                <div className="row-meta font-mono">
                  <span className="row-time tabular-nums">{h.zaman}</span>
                  <span className="row-source">{h.kaynak}</span>
                  {h.onem === "flas" && <span className="marker-flas">FLAŞ</span>}
                </div>

                <h3 className="row-headline">{h.baslik}</h3>
              </article>
            ))}
          </div>
        </section>

        {/* SÜTUN 2: Global */}
        <section className="terminal-pane">
          <div className="pane-header">
            <div className="pane-title-group">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <h2 className="pane-title">Global</h2>
            </div>
          </div>

          <div className="pane-scroll">
            {globalHaberleri.map((h) => (
              <article
                key={h.id}
                onClick={() => setSeciliHaber(h)}
                className="terminal-row"
              >
                <div className="row-meta font-mono">
                  <span className="row-time tabular-nums">{h.zaman}</span>
                  <span className="row-source">{h.kaynak}</span>
                  {h.onem === "flas" && <span className="marker-flas">FLAŞ</span>}
                </div>

                <h3 className="row-headline">{h.baslik}</h3>
                {h.spot && <p className="row-excerpt">{h.spot}</p>}
              </article>
            ))}
          </div>
        </section>

        {/* SÜTUN 3: KAP Bildirimleri + Resmi Kurumlar (İKİLİ STACK) */}
        <div className="terminal-stack">
          {/* Üst Kutu: KAP Bildirimleri */}
          <section className="terminal-pane pane-kap">
            <div className="pane-header">
              <div className="pane-title-group">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <h2 className="pane-title">KAP Bildirimleri</h2>
              </div>
            </div>

            <div className="pane-scroll">
              {kapBildirimleri.map((h) => (
                <article
                  key={h.id}
                  onClick={() => setSeciliHaber(h)}
                  className="terminal-row kap-row"
                >
                  <div className="kap-row-top font-mono">
                    <div className="kap-ticker-wrap">
                      {h.hisseler?.map((s) => (
                        <span key={s} className="kap-code">{s}</span>
                      ))}
                      {h.kapTuru && <span className="kap-type">{h.kapTuru}</span>}
                    </div>
                    <span className="row-time tabular-nums">{h.zaman}</span>
                  </div>

                  <h3 className="row-headline kap-headline">{h.baslik}</h3>
                </article>
              ))}
            </div>
          </section>

          {/* Alt Kutu: Resmi Kurumlar */}
          <section className="terminal-pane pane-resmi">
            <div className="pane-header">
              <div className="pane-title-group">
                <Landmark className="w-3.5 h-3.5 text-slate-400" />
                <h2 className="pane-title">Resmi Kurumlar</h2>
              </div>
            </div>

            <div className="pane-scroll">
              {resmiHaberleri.map((h) => (
                <article
                  key={h.id}
                  onClick={() => setSeciliHaber(h)}
                  className="terminal-row resmi-row"
                >
                  <div className="row-meta font-mono">
                    <span className="row-time tabular-nums">{h.zaman}</span>
                    <span className="resmi-badge">@{h.resmiKurum || h.kaynak}</span>
                  </div>

                  <h3 className="row-headline">{h.baslik}</h3>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* DETAY ÇEKMECESİ / MODAL */}
      {seciliHaber && (
        <div className="drawer-overlay" onClick={() => setSeciliHaber(null)}>
          <div
            className="drawer-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="drawer-header">
              <div className="drawer-meta font-mono">
                <span className="drawer-time">{seciliHaber.zaman} · {seciliHaber.tarih}</span>
                <span className="drawer-source">[{seciliHaber.kaynak}]</span>
              </div>
              <button
                onClick={() => setSeciliHaber(null)}
                className="drawer-close-btn"
                type="button"
                aria-label="Kapat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="drawer-body">
              <h2 className="drawer-title">{seciliHaber.baslik}</h2>

              {seciliHaber.spot && <p className="drawer-spot">{seciliHaber.spot}</p>}

              <div className="drawer-divider" />

              <div className="drawer-prose">
                <h4 className="drawer-section-heading">Piyasa Notu</h4>
                <p>{seciliHaber.detay}</p>
              </div>
            </div>

            <div className="drawer-footer">
              <span className="drawer-footer-text font-mono">BPT Finans Terminal Verisi</span>
              <button
                type="button"
                onClick={() => setSeciliHaber(null)}
                className="drawer-btn-secondary font-mono"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
