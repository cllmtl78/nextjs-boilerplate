"use client";

import { useState, useEffect } from "react";
import {
  X,
  ExternalLink,
  Layers,
} from "lucide-react";
import MarketIntelligence from "@/components/MarketIntelligence";

export type TerminalHaber = {
  id: string;
  zaman: string;
  tarih: string;
  kaynak: string;
  baslik: string;
  ozet?: string;
  paragraflar?: string[];
  detay?: string;
  url?: string;
  kategori: "bist" | "global" | "kap" | "resmi";
  hisseler?: string[];
  kapTuru?: "ÖDA" | "PGO" | "FR" | "GKK" | "SÖZ";
  resmiKurum?: "TCMB" | "SPK" | "BDDK" | "HMB" | "TÜİK" | "RESMİ GAZETE";
  timestamp?: number;
};

// Başlangıç ve Fallback Veri Havuzu
const BASLANGIC_BIST: TerminalHaber[] = [
  {
    id: "fb_1",
    zaman: "17:15:22",
    tarih: "Bugün",
    kaynak: "FOREKS",
    kategori: "bist",
    baslik: "BIST 100 Endeksinde bankacılık hisseleri öncülüğünde 11.200 puan seviyesi test edildi",
    ozet: "XBANK bankacılık endeksi günlük %2.1 yükselişle işlem hacminde ilk sırayı koruyor.",
    paragraflar: [
      "Borsa İstanbul'da BIST 100 endeksi, haftanın üçüncü işlem gününde bankacılık ve ulaştırma hisselerinde yoğunlaşan alımlarla 11.200 direnç bandına yöneldi. Günlük toplam işlem hacmi 96 milyar TL sınırını aşarken yabancı aracı kurumların para girişi dikkat çekti.",
      "Piyasa analistleri, TCMB faiz patikasına ilişkin pozitif beklentiler ve kredi derecelendirme kuruluşlarının değerlendirmeleri öncesinde BIST endeksinde yukarı yönlü momentumun güç kazandığını belirtiyor."
    ],
    url: "https://foreks.com",
    timestamp: Date.now() - 30000,
  },
  {
    id: "fb_2",
    zaman: "17:08:40",
    tarih: "Bugün",
    kaynak: "BLOOMBERG HT",
    kategori: "bist",
    baslik: "Merkez Bankası toplam rezervleri swap hariç net pozisyonda toparlanma eğilimini sürdürüyor",
    ozet: "Rezerv dinamiklerinde TL mevduat payındaki artış ve portföy girişleri dengelenmeyi destekliyor.",
    paragraflar: [
      "Türkiye Cumhuriyet Merkez Bankası (TCMB) analitik bilanço öncü verilerine göre, brüt ve net rezervlerde istikrarlı artış devam ediyor. Swap hariç net rezerv göstergesi yılın en güçlü seviyelerine yakın seyrediyor.",
      "İktisatçılar, cari dengedeki iyileşme ve dezenflasyon sürecinin güçlenmesiyle Türk lirası varlıklara yönelik risk priminin (CDS) 260 baz puanın altına gerilediğine işaret ediyor."
    ],
    url: "https://www.bloomberght.com",
    timestamp: Date.now() - 90000,
  },
  {
    id: "fb_3",
    zaman: "16:55:12",
    tarih: "Bugün",
    kaynak: "AA FİNANS",
    kategori: "bist",
    baslik: "Aselsan, yurt dışı savunma konsorsiyumu ile 84.5 milyon dolarlık radar ihracat sözleşmesi imzaladı",
    ozet: "Yerli AESA radar sistemlerinin entegrasyonu ve lojistik destek paketini içeren kontrat yürürlüğe girdi.",
    paragraflar: [
      "Aselsan Elektronik Sanayi ve Ticaret A.Ş., uluslararası bir müşterisiyle gelişmiş radar ve aviyonik sistem tedarikine yönelik 84.5 milyon dolar tutarında ihracat sözleşmesi imzaladı.",
      "Açıklamada, teslimatların 2026-2028 yılları arasında tamamlanacağı ve şirketin bakiye sipariş toplamının 13.2 milyar dolar seviyesine ulaştığı bilgisi paylaşıldı."
    ],
    url: "https://www.aa.com.tr/tr/ekonomi",
    timestamp: Date.now() - 150000,
  },
  {
    id: "fb_4",
    zaman: "16:42:05",
    tarih: "Bugün",
    kaynak: "CNBC-E",
    kategori: "bist",
    baslik: "Türk Hava Yolları, kargo taşımacılığında küresel pazar payını %6.2 seviyesine taşıdı",
    ozet: "Turkish Cargo, filo genişleme stratejisi ve yeni hava koridorlarıyla gelir katkısını artırdı.",
    paragraflar: [
      "Türk Hava Yolları (THY), 2026 üçüncü çeyrek operasyonel verilerine göre kargo hacminde yıllık bazda çift haneli büyüme elde etti. Şirket, e-ticaret lojistiğindeki genişleme ile küresel pazar payını %6.2'ye ulaştırdı.",
      "Yönetim kurulu sunumunda, filoya dahil edilecek yeni kargo uçakları ve İstanbul Havalimanı mega aktarma merkezinin sağladığı transit avantajının karlılığı desteklediği belirtildi."
    ],
    url: "https://www.cnbce.com",
    timestamp: Date.now() - 240000,
  },
  {
    id: "fb_5",
    zaman: "16:30:19",
    tarih: "Bugün",
    kaynak: "EKONOMİM",
    kategori: "bist",
    baslik: "Sanayi sektörü kapasite kullanım oranı imalat sanayinde %77.8 seviyesine yükseldi",
    ozet: "Yatırım malları ve ara malı üretiminde ihracat odaklı sipariş toparlanması sürüyor.",
    paragraflar: [
      "Merkez Bankası tarafından açıklanan imalat sanayi kapasite kullanım oranı (KKO), bir önceki aya göre 0.4 puan artarak yüzde 77.8 oldu. Otomotiv, kimya ve makine teçhizat sektörleri artışa öncülük etti.",
      "Sektör temsilcileri, Avrupa pazarında toparlanan talep ve iç piyasada finansman koşullarındaki öngörülebilirliğin kapasite artırımlarını hızlandırdığını bildirdi."
    ],
    url: "https://www.ekonomim.com",
    timestamp: Date.now() - 360000,
  },
  {
    id: "fb_6",
    zaman: "16:18:44",
    tarih: "Bugün",
    kaynak: "EKONOMİST",
    kategori: "bist",
    baslik: "Girişim sermayesi yatırım ortaklıkları 2026 ilk yarısında 420 milyon dolar fon sağladı",
    ozet: "Fintek, yapay zeka ve yenilenebilir enerji teknolojilerine sermaye akışı ivme kazandı.",
    paragraflar: [
      "Türkiye'de faaliyet gösteren girişim sermayesi fonları, 2026 yılı ilk yarısında toplam 420 milyon dolarlık yatırım turu kapattı. Kurumsal yatırımcıların teknoloji fonlarına ilgisi yüksek seyretti.",
      "Uzmanlar, SPK'nın fon mevzuatındaki kolaylaştırıcı düzenlemelerinin ve vergi avantajlarının sermaye piyasalarını derinleştirdiğini kaydetti."
    ],
    url: "https://www.ekonomist.com.tr",
    timestamp: Date.now() - 480000,
  },
  {
    id: "fb_7",
    zaman: "16:05:30",
    tarih: "Bugün",
    kaynak: "BİGPARA",
    kategori: "bist",
    baslik: "Gram altın Kapalıçarşı serbest piyasasında rekor tazelerken işlem hacmi yükseldi",
    ozet: "Ons altın yükselişi ve döviz sepeti fiyatlamasıyla gram altın yeni zirveyi gördü.",
    paragraflar: [
      "Serbest piyasada fiziki altın talebi sürerken Kapalıçarşı'da gram altın fiyatı yeni zirveye ulaştı. Küresel piyasalarda ons altının 2.760 dolar bandını test etmesi iç piyasaya yansıdı.",
      "Altın ve para piyasaları uzmanları, küresel merkez bankası alımları ve jeopolitik risk fiyatlamasının emtia piyasalarında trendi desteklediğini aktardı."
    ],
    url: "https://bigpara.hurriyet.com.tr",
    timestamp: Date.now() - 600000,
  },
  {
    id: "fb_8",
    zaman: "15:52:10",
    tarih: "Bugün",
    kaynak: "EKOTÜRK",
    kategori: "bist",
    baslik: "Enerji sektöründe hibrit santral yatırımları ve YEKA ihaleleriyle kurulu güç arttı",
    ozet: "Güneş ve rüzgar enerjisinde şebeke entegrasyon kapasitesi 35 bin megavata yaklaştı.",
    paragraflar: [
      "Enerji ve Tabii Kaynaklar Bakanlığı verilerine göre yenilenebilir enerjinin toplam elektrik üretimindeki payı %46 sınırını aştı. Lisanslı ve lisanssız güneş santrallerinde yatırım temposu sürüyor.",
      "Sektör raporlarında, yerli türbin ve panel bileşenlerinin ihracat potansiyelinin cari açığı azaltıcı yönde katkı vereceği değerlendirildi."
    ],
    url: "https://www.ekoturk.com",
    timestamp: Date.now() - 720000,
  },
];

// Statik Global Haberler (Sadece Başlık)
const GLOBAL_HABERLER: TerminalHaber[] = [
  {
    id: "g1",
    zaman: "16:20:11",
    tarih: "Bugün",
    kaynak: "BLOOMBERG",
    kategori: "global",
    baslik: "Fed Yönetim Kurulu: Enflasyonda düşüş eğilimi faiz adımlarının sürmesine imkan tanıyor",
    detay: "Piyasa fiyatlamalarında 25 baz puanlık faiz indirim olasılığı %86'ya yükseldi. ABD 10 yıllık tahvil getirisi %4.18 seviyesine gevşedi.",
    paragraflar: [
      "Federal Rezerv yetkilileri, dezenflasyon sürecinin beklentilerle uyumlu ilerlediğini ve iş gücü piyasasındaki dengelenmenin sürdüğünü ifade etti.",
      "ABD 10 yıllık Hazine tahvil faizleri açıklamaların ardından 4 baz puan gerileyerek %4.18 seviyesine çekildi."
    ],
    url: "https://www.bloomberg.com",
  },
  {
    id: "g2",
    zaman: "16:04:40",
    tarih: "Bugün",
    kaynak: "REUTERS",
    kategori: "global",
    baslik: "ECB: Hizmet sektörü enflasyonunda yavaşlama sinyalleri güçleniyor",
    detay: "Euro Bölgesi'nde kredi talebinde toparlanma sinyalleri izlenirken sanayi üretimi toparlanma eğiliminde.",
    paragraflar: [
      "Avrupa Merkez Bankası (ECB) son bülteninde, Euro Bölgesi çekirdek enflasyonunun hedef patikaya doğru gerilediği vurgulandı.",
      "Para piyasaları analistleri, ECB'nin önümüzdeki toplantılarda faiz indirim döngüsünü sürdürmesine kesin gözüyle bakıyor."
    ],
    url: "https://www.reuters.com",
  },
  {
    id: "g3",
    zaman: "15:47:22",
    tarih: "Bugün",
    kaynak: "FINANCIAL TIMES",
    kategori: "global",
    baslik: "OPEC+ toplantısı öncesi Brent petrol 74.80 dolar bandında yatay seyrediyor",
    detay: "Küresel talep projeksiyonları ve ABD stok verileri öncesinde enerji emtialarında dalgalanma sınırlı kaldı.",
    paragraflar: [
      "Petrol İhraç Eden Ülkeler Örgütü ve müttefiklerinin (OPEC+) üretim kotalarına ilişkin çevrim içi toplantısı öncesinde ham petrol fiyatları dar bantta işlem görüyor.",
      "Uluslararası Enerji Ajansı raporunda, Çin talebindeki toparlanma hızının fiyat dengesi üzerinde kritik rol oynamaya devam ettiği aktarıldı."
    ],
    url: "https://www.ft.com",
  },
  {
    id: "g4",
    zaman: "15:26:05",
    tarih: "Bugün",
    kaynak: "CNBC",
    kategori: "global",
    baslik: "Wall Street vadeli kontratlarında teknoloji şirketleri öncülüğünde pozitif seyir",
    detay: "Yarı iletken sektörü öncülüğünde kurumsal yatırım harcamalarına dair şirket açıklamaları risk iştahını destekliyor.",
    paragraflar: [
      "S&P 500 ve Nasdaq 100 vadeli endeksleri, yarı iletken ve veri merkezi altyapı sağlayıcılarının güçlü ciro projeksiyonları sonrası primlendi.",
      "Yatırım bankaları, yapay zeka harcamalarının kurumsal bilançolara reel katkısının geniş tabana yayıldığına dikkat çekiyor."
    ],
    url: "https://www.cnbc.com",
  },
  {
    id: "g5",
    zaman: "15:05:51",
    tarih: "Bugün",
    kaynak: "NIKKEI",
    kategori: "global",
    baslik: "Asya piyasalarında Japon Yeni güçlenirken Nikkei endeksi günü %+0.35 ile tamamladı",
    detay: "Bölgesel teknoloji tedarikçileri güçlü sipariş akışıyla endekste pozitif ayrışmayı sürdürdü.",
    paragraflar: [
      "Tokyo Borsası'nda Nikkei 225 endeksi ihracatçı hisselerdeki dirençle günü artıda kapattı. Japonya Merkez Bankası'nın (BOJ) faiz artırım sinyalleri izleniyor.",
      "Yen karşısında dolar 151.20 seviyesine gevşeyerek değer kaybetti."
    ],
    url: "https://asia.nikkei.com",
  },
  {
    id: "g6",
    zaman: "14:48:19",
    tarih: "Bugün",
    kaynak: "BLOOMBERG",
    kategori: "global",
    baslik: "Almanya 10 yıllık tahvil getirisi büyüme beklentileriyle 4 baz puan geriledi",
    detay: "Avrupa Merkez Bankası politika faizi patikasına ilişkin beklentiler sabit getirili menkul kıymetleri destekliyor.",
    paragraflar: [
      "Alman Bundesbank tahvilleri, imalat PMI verilerinin ardından güvenli liman talebiyle alıcılı seyretti.",
      "Avrupa genelinde tahvil faizlerindeki geri çekilme hisse senedi değerlemelerine destek sundu."
    ],
    url: "https://www.bloomberg.com",
  },
];

// Statik KAP Bildirimleri (Belirgin Cyan Hisse Kodu + İnce Bildirim Türü)
const KAP_BILDIRIMLERI: TerminalHaber[] = [
  {
    id: "k1",
    zaman: "16:27:04",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    hisseler: ["KCHOL"],
    kapTuru: "PGO",
    baslik: "Koç Holding A.Ş. — Pay Geri Alım İşlemlerine İlişkin Bildirim",
    detay: "Şirketin sahip olduğu KCHOL payları sermayenin %0.84'üne ulaşmıştır. Program çerçevesinde fon kaynağı şirket iç kaynaklarından karşılanmaktadır.",
    paragraflar: [
      "Koç Holding A.Ş. Yönetim Kurulu kararıyla başlatılan hisse geri alım programı çerçevesinde, Borsa İstanbul pay piyasasında 184.50 TL ortalama fiyattan 250.000 adet pay geri alınmıştır.",
      "İşlem sonucunda şirketin sahip olduğu kendi paylarının nominal tutarı 21.3 milyon TL'ye ve şirket sermayesine oranı %0.84 seviyesine ulaşmıştır."
    ],
    url: "https://www.kap.org.tr",
  },
  {
    id: "k2",
    zaman: "16:11:18",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    hisseler: ["SISE"],
    kapTuru: "ÖDA",
    baslik: "Türkiye Şişe ve Cam Fabrikaları A.Ş. — Kapasite Artışı ve Modernizasyon Kararı",
    detay: "Yatırımın 2027 ilk çeyreğinde tamamlanmasıyla enerji tüketiminde verimlilik ve katma değerli kaplamalı cam üretiminde kapasite artışı hedeflenmektedir.",
    paragraflar: [
      "Şirketimiz Yönetim Kurulu, Mersin ve Yenişehir üretim tesislerindeki düzcam hatlarının fırın soğuk tamiri ve yeni teknoloji kaplama hattı entegrasyonu için 115 milyon euro bütçeli yatırım planını onaylamıştır.",
      "Yatırımın 2027 ilk çeyreğinde devreye girmesiyle birlikte birim enerji tüketiminde %14 verimlilik ve yüksek katma değerli mimari cam üretim kapasitesinde yıllık 180 bin ton artış öngörülmektedir."
    ],
    url: "https://www.kap.org.tr",
  },
  {
    id: "k3",
    zaman: "15:50:30",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    hisseler: ["SASA"],
    kapTuru: "FR",
    baslik: "SASA Polyester Sanayi A.Ş. — Dönemsel Faaliyet ve Yatırım Raporu",
    detay: "Tesisin ticari üretim takvimi ve ham madde tedarik sözleşmelerinin finansal tablolara yansıması paylaşıldı.",
    paragraflar: [
      "Adana Yumurtalık Özel Endüstri Bölgesi'nde sürdürülen PTA ve polimerizasyon tesisi inşaatında mekanik tamamlama oranı %94 seviyesine ulaşmıştır.",
      "Deneme üretimlerinin planlandığı şekilde devam ettiği ve tesisin tam kapasite devreye alınmasıyla yıllık yaklaşık 1.2 milyar dolarlık ithal ikamesi sağlanacağı kamuoyuyla paylaşılmıştır."
    ],
    url: "https://www.kap.org.tr",
  },
  {
    id: "k4",
    zaman: "15:36:12",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    hisseler: ["FROTO"],
    kapTuru: "SÖZ",
    baslik: "Ford Otomotiv Sanayi A.Ş. — Yeni Model Batarya Montaj Tedarik Sözleşmesi",
    detay: "Sözleşmenin şirketin ihracat hacmine yıllık yaklaşık 320 milyon euro katkı sağlaması öngörülmektedir.",
    paragraflar: [
      "Ford Otosan, Avrupa pazarına yönelik tam elektrikli ticari araç serisi için batarya paketleme ve modül montajına ilişkin çok yıllı tedarik anlaşmasını imzalamıştır.",
      "Kocaeli fabrikalarında üretilecek yeni nesil batarya paketlerinin yıllık ciroya yaklaşık 320 milyon euro ilave ihracat geliri oluşturması beklenmektedir."
    ],
    url: "https://www.kap.org.tr",
  },
  {
    id: "k5",
    zaman: "15:14:09",
    tarih: "Bugün",
    kaynak: "KAP",
    kategori: "kap",
    hisseler: ["TUPRS"],
    kapTuru: "ÖDA",
    baslik: "Tüpraş — Rafineri Bakım Planı Güncellemesi Bildirildi",
    detay: "Planlı duruş süresince nihai ürün satışları mevcut stoklardan karşılanacak olup satış hacminde kesinti öngörülmemektedir.",
    paragraflar: [
      "İzmit Rafinerisi Ham Petrol Ünitesi'nde planlı periyodik bakım çalışmalarının 3 hafta süreyle yürütüleceği, bakım süresince ürün satışlarının mevcut stok depolarından kesintisiz karşılanacağı bildirilmiştir.",
      "Şirketin yıllık toplam üretim ve satış hedeflerinde herhangi bir revizyona ihtiyaç duyulmadığı belirtilmiştir."
    ],
    url: "https://www.kap.org.tr",
  },
];

// Statik Resmi Kurumlar
const RESMI_HABERLER: TerminalHaber[] = [
  {
    id: "r1",
    zaman: "16:22:00",
    tarih: "Bugün",
    kaynak: "TCMB",
    kategori: "resmi",
    resmiKurum: "TCMB",
    baslik: "TCMB: Para Politikası Kurulu Toplantı Özeti yayımlandı",
    detay: "Kurul, yurt içi talepteki dengelenmenin sürdüğünü ve TL likidite sterilizasyon araçlarının etkin kullanılacağını ifade etti.",
    paragraflar: [
      "Türkiye Cumhuriyet Merkez Bankası Para Politikası Kurulu Toplantı Özeti'nde, aylık enflasyonun ana eğiliminde belirgin ve kalıcı bir düşüş sağlanana kadar sıkı para politikası duruşunun sürdürüleceği teyit edildi.",
      "Likidite fazlasının sterilizasyonunda zorunlu karşılıklar ve depo ihaleleri gibi araçların çeşitlendirilerek kararlılıkla kullanılacağı bildirildi."
    ],
    url: "https://www.tcmb.gov.tr",
  },
  {
    id: "r2",
    zaman: "16:01:15",
    tarih: "Bugün",
    kaynak: "SPK",
    kategori: "resmi",
    resmiKurum: "SPK",
    baslik: "SPK Haftalık Bülteni: 2 şirketin sermaye piyasası ihracına onay verildi",
    detay: "Halka arz gelirlerinin büyük kısmının işletme sermayesi ve kapasite artırım yatırımlarında kullanılacağı bildirildi.",
    paragraflar: [
      "Sermaye Piyasası Kurulu haftalık bülteninde iki sanayi kuruluşunun pay ihracı ve bedelsiz sermaye artırımı başvurularının onaylandığı duyuruldu.",
      "Ayrıca borçlanma aracı ihraç limitlerine ilişkin değerlendirmeler neticesinde kurumsal tahvil ve finansman bonosu ihraç izinleri onaylandı."
    ],
    url: "https://spk.gov.tr",
  },
  {
    id: "r3",
    zaman: "15:40:00",
    tarih: "Bugün",
    kaynak: "BDDK",
    kategori: "resmi",
    resmiKurum: "BDDK",
    baslik: "BDDK Haftalık Bankacılık Verileri: TL mevduat payı artışını koruyor",
    detay: "TL mevduatın toplam mevduat içindeki payı %56.4'e yükselirken bankacılık sektörünün sermaye yeterlilik rasyosu %17.2 seviyesinde gerçekleşti.",
    paragraflar: [
      "Bankacılık Düzenleme ve Denetleme Kurumu (BDDK) haftalık bülteninde, sektörün toplam kredi hacminin dengeli büyüdüğü ve takipteki alacaklar rasyosunun %1.68 seviyesinde stabil kaldığı belirtildi.",
      "Kur korumalı mevduat bakiyesindeki düşüş eğiliminin kesintisiz sürdüğü, standart TL vadeli mevduat hesaplarına geçişin hızlandığı kaydedildi."
    ],
    url: "https://www.bddk.org.tr",
  },
  {
    id: "r4",
    zaman: "15:15:00",
    tarih: "Bugün",
    kaynak: "HMB",
    kategori: "resmi",
    resmiKurum: "HMB",
    baslik: "Hazine ve Maliye Bakanlığı: Merkezi Yönetim Bütçe Dengesi hedeflerle uyumlu",
    detay: "Açıklamada, Hazine nakit rezervlerinin güçlü seviyesini koruduğu kaydedildi.",
    paragraflar: [
      "Hazine ve Maliye Bakanlığı bütçe gerçekleşmeleri raporunda, kamu harcamalarında tasarruf tedbirlerinin ve gelir artırıcı mali disiplin uygulamalarının sonuç verdiği belirtildi.",
      "Hazine nakit rezervlerinin güçlü yapısı sayesinde borçlanma vadelerinin uzatıldığı ve borçlanma maliyetlerinde düşüş kaydedildiği bildirildi."
    ],
    url: "https://www.hmb.gov.tr",
  },
  {
    id: "r5",
    zaman: "10:00:00",
    tarih: "Bugün",
    kaynak: "TÜİK",
    kategori: "resmi",
    resmiKurum: "TÜİK",
    baslik: "TÜİK: Yıllık Tüketici Fiyat Endeksi gerilemesini sürdürdü",
    detay: "Çekirdek enflasyon göstergelerinde genele yayılan yavaşlama izlendi.",
    paragraflar: [
      "Türkiye İstatistik Kurumu verilerine göre tüketici fiyat endeksi yıllık bazda gerileme eğilimini sürdürdü. Temel mallar ve ulaştırma kalemleri düşüşe en yüksek katkıyı verdi.",
      "Yurt içi üretici fiyat endeksi de (Yİ-ÜFE) aylık bazda sınırlı artış kaydederek maliyet yönlü baskıların azaldığını ortaya koydu."
    ],
    url: "https://www.tuik.gov.tr",
  },
];

export default function TerminalWorkspace() {
  const [bistHaberleri, setBistHaberleri] = useState<TerminalHaber[]>(BASLANGIC_BIST);
  const [seciliHaber, setSeciliHaber] = useState<TerminalHaber | null>(null);
  const [loadingBist, setLoadingBist] = useState<boolean>(false);

  // Çok kaynaklı dinamik haber çekme mekanizması (5s periyodik yenileme + fallback koruma)
  useEffect(() => {
    let isCancelled = false;

    async function loadNews() {
      try {
        const res = await fetch("/api/news");
        if (!res.ok) return;
        const data = await res.json();

        if (isCancelled) return;

        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          interface ApiItem {
            id: string;
            zaman: string;
            tarih?: string;
            kaynak: string;
            baslik: string;
            ozet?: string;
            paragraflar?: string[];
            detay?: string;
            url?: string;
            timestamp?: number;
          }

          const donusturulen: TerminalHaber[] = data.items.map((item: ApiItem) => ({
            id: item.id,
            zaman: item.zaman,
            tarih: item.tarih || "Bugün",
            kaynak: item.kaynak,
            baslik: item.baslik,
            ozet: item.ozet,
            paragraflar: item.paragraflar,
            detay:
              item.paragraflar && item.paragraflar.length > 0
                ? item.paragraflar.join("\n\n")
                : item.detay || item.ozet || item.baslik,
            url: item.url || "#",
            kategori: "bist" as const,
            timestamp: item.timestamp,
          }));

          setBistHaberleri(donusturulen);
        }
      } catch {
        // Ağ hatasında mevcut önbellek korunur (Fallback)
      } finally {
        if (!isCancelled) {
          setLoadingBist(false);
        }
      }
    }

    void loadNews();
    const interval = setInterval(() => {
      void loadNews();
    }, 5000);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Modal için ESC klavye tuşu dinleyicisi
  useEffect(() => {
    if (!seciliHaber) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSeciliHaber(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [seciliHaber]);

  return (
    <div className="terminal-workspace">
      {/* 3-SÜTUNLU KOMPAKT ENDÜSTRİYEL TERMİNAL DÜZENİ */}
      <div className="terminal-grid">
        {/* SÜTUN 1: BIST & Türkiye (Dinamik Çok Kaynaklı Akış) */}
        <section className="terminal-pane">
          <div className="pane-header">
            <div className="pane-title-group">
              <h2 className="pane-title">BIST & Türkiye</h2>
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
              <span className="tabular-nums">{bistHaberleri.length}</span>
            </div>
          </div>

          <div className="pane-scroll">
            {loadingBist && bistHaberleri.length === 0 ? (
              // Skeleton Loader
              <div className="p-3 space-y-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="animate-pulse space-y-1.5">
                    <div className="flex gap-2">
                      <div className="h-3 w-12 bg-slate-800 rounded" />
                      <div className="h-3 w-20 bg-slate-800 rounded" />
                    </div>
                    <div className="h-4 bg-slate-800/80 rounded w-full" />
                    <div className="h-3 bg-slate-800/40 rounded w-3/4" />
                  </div>
                ))}
              </div>
            ) : (
              bistHaberleri.map((h) => (
                <article
                  key={h.id}
                  onClick={() => setSeciliHaber(h)}
                  className="terminal-row group"
                >
                  <div className="flex items-center gap-2 font-mono text-[10.5px]">
                    <span className="row-time tabular-nums text-slate-500">{h.zaman}</span>
                    <span className="px-1.5 py-0.5 rounded bg-[#0a1120] border border-slate-700/60 text-slate-300 font-mono text-[9.5px] uppercase tracking-wide">
                      [{h.kaynak}]
                    </span>
                  </div>

                  <h3 className="row-headline font-medium text-slate-200 group-hover:text-cyan-400 cursor-pointer transition text-xs leading-snug">
                    {h.baslik}
                  </h3>
                </article>
              ))
            )}
          </div>
        </section>

        {/* SÜTUN 2: Global (Sadece Başlık) */}
        <section className="terminal-pane">
          <div className="pane-header">
            <div className="pane-title-group">
              <h2 className="pane-title">Global</h2>
            </div>
            <div className="font-mono text-[10px] text-slate-500">
              <span className="tabular-nums">{GLOBAL_HABERLER.length}</span>
            </div>
          </div>

          <div className="pane-scroll">
            {GLOBAL_HABERLER.map((h) => (
              <article
                key={h.id}
                onClick={() => setSeciliHaber(h)}
                className="terminal-row group"
              >
                <div className="row-meta font-mono">
                  <span className="row-time tabular-nums text-slate-500">{h.zaman}</span>
                  <span className="px-1.5 py-0.5 rounded bg-[#0a1120] border border-slate-700/60 text-slate-300 font-mono text-[9.5px] uppercase">
                    [{h.kaynak}]
                  </span>
                </div>

                <h3 className="row-headline font-medium text-slate-200 group-hover:text-cyan-400 cursor-pointer transition text-xs leading-snug">
                  {h.baslik}
                </h3>
              </article>
            ))}
          </div>
        </section>

        {/* SÜTUN 3: KAP Bildirimleri + Resmi Kurumlar */}
        <div className="terminal-stack">
          {/* Üst: KAP Bildirimleri */}
          <section className="terminal-pane pane-kap">
            <div className="pane-header">
              <div className="pane-title-group">
                <h2 className="pane-title">KAP Bildirimleri</h2>
              </div>
              <div className="font-mono text-[10px] text-slate-500">
                <span className="tabular-nums">{KAP_BILDIRIMLERI.length}</span>
              </div>
            </div>

            <div className="pane-scroll">
              {KAP_BILDIRIMLERI.map((h) => (
                <article
                  key={h.id}
                  onClick={() => setSeciliHaber(h)}
                  className="terminal-row kap-row group"
                >
                  <div className="kap-row-top">
                    <div className="flex items-center gap-2">
                      {h.hisseler?.map((s) => (
                        <span key={s} className="kap-code-prominent font-mono">
                          {s}
                        </span>
                      ))}
                      {h.kapTuru && (
                        <span className="kap-type-subtle font-mono">
                          {h.kapTuru}
                        </span>
                      )}
                    </div>
                    <span className="row-time font-mono tabular-nums text-slate-500 text-[11px]">
                      {h.zaman}
                    </span>
                  </div>

                  <h3 className="row-headline kap-headline group-hover:text-cyan-400 transition">
                    {h.baslik}
                  </h3>
                </article>
              ))}
            </div>
          </section>

          {/* Alt: Resmi Kurumlar */}
          <section className="terminal-pane pane-resmi">
            <div className="pane-header">
              <div className="pane-title-group">
                <h2 className="pane-title">Resmi Kurumlar</h2>
              </div>
              <div className="font-mono text-[10px] text-slate-500">
                <span className="tabular-nums">{RESMI_HABERLER.length}</span>
              </div>
            </div>

            <div className="pane-scroll">
              {RESMI_HABERLER.map((h) => (
                <article
                  key={h.id}
                  onClick={() => setSeciliHaber(h)}
                  className="terminal-row resmi-row group"
                >
                  <div className="row-meta font-mono">
                    <span className="row-time tabular-nums text-slate-500">{h.zaman}</span>
                    <span className="resmi-badge">@{h.resmiKurum || h.kaynak}</span>
                  </div>

                  <h3 className="row-headline font-medium text-slate-200 group-hover:text-cyan-400 transition text-xs leading-snug">
                    {h.baslik}
                  </h3>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* 3-KOLONLU MARKET INTELLIGENCE TABANI (BIST MOVERS, SECTOR FLOW, CALENDAR) */}
      <MarketIntelligence />

      {/* ŞIK ENDÜSTRİYEL HABER DETAY KARTI (MODAL / DIALOG POPUP) */}
      {seciliHaber && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setSeciliHaber(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-[#0c1322] border border-slate-700/80 rounded-lg shadow-2xl p-6 backdrop-blur-md max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* ÜST KISIM: Kaynak adı, yayınlanma saati ve kapatma butonu */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 font-mono text-xs">
                <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-cyan-400 font-semibold tracking-wide uppercase">
                  [{seciliHaber.kaynak}]
                </span>
                <span className="text-slate-400 tabular-nums">
                  {seciliHaber.zaman} {seciliHaber.tarih ? `· ${seciliHaber.tarih}` : ""}
                </span>
                {seciliHaber.hisseler && seciliHaber.hisseler.length > 0 && (
                  <span className="text-cyan-400 font-bold ml-1">
                    {seciliHaber.hisseler.join(", ")}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500 hidden sm:inline-block">
                  [ESC]
                </span>
                <button
                  onClick={() => setSeciliHaber(null)}
                  className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
                  type="button"
                  aria-label="Kapat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* BAŞLIK: Büyük puntolu net haber başlığı */}
            <h2 className="text-lg font-bold text-white mt-4 mb-3 leading-snug">
              {seciliHaber.baslik}
            </h2>

            {/* GÖVDE: Haber makalesinin tam metninden ayıklanmış ilk 2 paragrafı */}
            <div className="text-sm text-slate-300 leading-relaxed space-y-2.5 overflow-y-auto pr-1 flex-1 my-2">
              {seciliHaber.paragraflar && seciliHaber.paragraflar.length > 0 ? (
                seciliHaber.paragraflar.slice(0, 2).map((paragraf, idx) => (
                  <p key={idx} className="text-slate-300">
                    {paragraf}
                  </p>
                ))
              ) : seciliHaber.detay ? (
                seciliHaber.detay.split("\n\n").slice(0, 2).map((paragraf, idx) => (
                  <p key={idx} className="text-slate-300">
                    {paragraf}
                  </p>
                ))
              ) : (
                <p className="text-slate-400 italic">
                  Haber içeriği detayları hazırlanıyor.
                </p>
              )}
            </div>

            {/* ALT BAR: "Daha Fazlasını Oku" butonu / linki + Kapat butonu */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between mt-auto">
              {seciliHaber.url && seciliHaber.url !== "#" ? (
                <a
                  href={seciliHaber.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-cyan-950/60 border border-cyan-700/60 text-cyan-300 hover:bg-cyan-900/60 hover:text-cyan-200 transition"
                >
                  <span>Daha Fazlasını Oku</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Terminal Orijinal Kayıt</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setSeciliHaber(null)}
                className="px-3 py-1.5 rounded bg-slate-800/80 hover:bg-slate-700/80 text-xs font-mono text-slate-300 hover:text-white transition border border-slate-700/60"
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
