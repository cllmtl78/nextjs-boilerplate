// Shared by the API and UI so previously cached English titles are localized too.
const INDICATORS: [RegExp, string][] = [
  [/^Republic Day$/i, "29 Ekim Cumhuriyet Bayramı"],
  [/^Average Hourly Earnings/i, "Ortalama Saatlik Kazançlar"],
  [/^Average Weekly Hours/i, "Ortalama Haftalık Çalışma Saati"],
  [/^Average Weekly Earnings/i, "Ortalama Haftalık Kazançlar"],
  [/^Government Payrolls/i, "Kamu Sektörü İstihdamı"],
  [/^Manufacturing Payrolls/i, "İmalat Sektörü İstihdamı"],
  [/^Private (?:Nonfarm )?Payrolls/i, "Özel Sektör İstihdamı"],
  [/^ADP (?:Nonfarm Employment Change|Employment Change)/i, "ADP Özel Sektör İstihdam Değişimi"],
  [/^(?:Non[ -]?Farm Payrolls|Nonfarm Employment Change|NFP)/i, "Tarım Dışı İstihdam"],
  [/^(?:Labor Force )?Participation Rate/i, "İşgücüne Katılım Oranı"],
  [/^Unemployment Rate/i, "İşsizlik Oranı"],
  [/^Initial Jobless Claims/i, "İlk İşsizlik Maaşı Başvuruları"],
  [/^Continuing Jobless Claims/i, "Devam Eden İşsizlik Maaşı Başvuruları"],
  [/^JOLTs? Job (?:Openings|Offers)/i, "JOLTS Açık İş Sayısı"],
  [/^JOLTs? Job Quits/i, "JOLTS İşten Ayrılmalar"],
  [/^Employment Change/i, "İstihdam Değişimi"],
  [/^Employment Rate/i, "İstihdam Oranı"],
  [/^Core (?:Inflation Rate|CPI)/i, "Çekirdek TÜFE Enflasyonu"],
  [/^(?:Inflation Rate|CPI)/i, "TÜFE Enflasyonu"],
  [/^Harmonised Inflation Rate|^HICP/i, "Uyumlaştırılmış Tüketici Enflasyonu"],
  [/^Core PCE Price Index/i, "Çekirdek Kişisel Tüketim Harcamaları Fiyat Endeksi"],
  [/^PCE Price Index/i, "Kişisel Tüketim Harcamaları Fiyat Endeksi"],
  [/^Core PPI/i, "Çekirdek Üretici Fiyat Endeksi"],
  [/^(?:Producer Prices Change|Producer Price Inflation|PPI)/i, "Üretici Fiyat Endeksi"],
  [/^Inflation Expectations/i, "Enflasyon Beklentileri"],
  [/^Consumer Inflation Expectations/i, "Tüketici Enflasyon Beklentisi"],
  [/^GDP Growth Rate/i, "GSYİH Büyüme Oranı"],
  [/^GDP Price Index/i, "GSYİH Fiyat Endeksi"],
  [/^GDP/i, "Gayri Safi Yurtiçi Hasıla"],
  [/^Retail Sales Ex (?:Autos|Auto)/i, "Otomotiv Hariç Perakende Satışlar"],
  [/^Retail Sales/i, "Perakende Satışlar"],
  [/^Personal Income/i, "Kişisel Gelirler"],
  [/^Personal Spending/i, "Kişisel Harcamalar"],
  [/^Real Personal Consumption/i, "Reel Kişisel Tüketim"],
  [/^Consumer Confidence/i, "Tüketici Güven Endeksi"],
  [/^Business Confidence/i, "İş Dünyası Güven Endeksi"],
  [/^Economic Sentiment/i, "Ekonomik Güven Endeksi"],
  [/^Services Sentiment/i, "Hizmet Sektörü Güveni"],
  [/^Industrial Sentiment/i, "Sanayi Güveni"],
  [/^Selling Price Expectations/i, "Satış Fiyatı Beklentileri"],
  [/^Industrial Production/i, "Sanayi Üretimi"],
  [/^Manufacturing Production/i, "İmalat Üretimi"],
  [/^Capacity Utilization/i, "Kapasite Kullanım Oranı"],
  [/^Factory Orders/i, "Fabrika Siparişleri"],
  [/^Durable Goods Orders/i, "Dayanıklı Mal Siparişleri"],
  [/^(?:S&P Global |Caixin |Jibun Bank |NBS |ISM )?Manufacturing PMI/i, "İmalat Satın Alma Yöneticileri Endeksi"],
  [/^ISM Non-Manufacturing PMI/i, "İmalat Dışı Satın Alma Yöneticileri Endeksi"],
  [/^(?:S&P Global |Caixin |Jibun Bank )?Services PMI/i, "Hizmet Satın Alma Yöneticileri Endeksi"],
  [/^(?:S&P Global |Caixin |Jibun Bank )?Composite PMI/i, "Bileşik Satın Alma Yöneticileri Endeksi"],
  [/^Interest Rate Decision/i, "Faiz Oranı Kararı"],
  [/^ECB Interest Rate Decision/i, "Avrupa Merkez Bankası Faiz Kararı"],
  [/^Fed Interest Rate Decision/i, "ABD Merkez Bankası Faiz Kararı"],
  [/^BoJ Interest Rate Decision/i, "Japonya Merkez Bankası Faiz Kararı"],
  [/^Deposit Facility Rate/i, "Mevduat Faizi"],
  [/^Lending Facility Rate/i, "Borç Verme Faizi"],
  [/^Loan Prime Rate/i, "Kredi Referans Faizi"],
  [/^Balance of Trade|^Trade Balance/i, "Dış Ticaret Dengesi"],
  [/^Current Account/i, "Cari İşlemler Dengesi"],
  [/^Exports/i, "İhracat"],
  [/^Imports/i, "İthalat"],
  [/^Building Permits/i, "İnşaat İzinleri"],
  [/^Housing Starts/i, "Konut Başlangıçları"],
  [/^New Home Sales/i, "Yeni Konut Satışları"],
  [/^Existing Home Sales/i, "İkinci El Konut Satışları"],
  [/^Pending Home Sales/i, "Bekleyen Konut Satışları"],
  [/^Construction Spending/i, "İnşaat Harcamaları"],
  [/^Wholesale Inventories/i, "Toptan Satış Stokları"],
  [/^(?:EIA )?Crude Oil (?:Stocks Change|Inventories)/i, "Ham Petrol Stokları Değişimi"],
  [/^(?:EIA )?Gasoline Stocks Change/i, "Benzin Stokları Değişimi"],
  [/^Natural Gas Stocks Change/i, "Doğal Gaz Stokları Değişimi"],
  [/^Communist Party Fifth Plenum$/i, "Çin Komünist Partisi Genel Kurulu"],
];

const QUALIFIERS: [RegExp, string][] = [
  [/\bMoM\b/gi, "Aylık"], [/\bYoY\b/gi, "Yıllık"], [/\bQoQ\b/gi, "Çeyreklik"],
  [/\bFinal\b/gi, "Nihai"], [/\bPrel(?:iminary)?\b/gi, "Öncü"],
  [/\bFlash\b/gi, "Öncü"], [/\bAdv(?:ance)?\b/gi, "İlk Tahmin"],
  [/\b(?:2nd|Second) Est(?:imate)?\b/gi, "İkinci Tahmin"],
  [/\b(?:3rd|Third) Est(?:imate)?\b/gi, "Üçüncü Tahmin"],
  [/\bAnnualized\b/gi, "Yıllıklandırılmış"],
];

// null means the complete title needs translation; never return half-translated text.
export function localizeCalendarTitle(title: string): string | null {
  const normalized = title.trim().replace(/\s+/g, " ");
  if (!normalized) return "Ekonomik Gösterge";
  // Preserve titles already localized by the provider or our API.
  if (/[çğıöşüÇĞİÖŞÜ]/u.test(normalized)) return normalized;
  const auction = normalized.match(/^(\d+)-(Month|Year) (Bill|Note|Bond|JGB) Auction$/i);
  if (auction) return `${auction[1]} ${auction[2].toLowerCase() === "month" ? "Aylık" : "Yıllık"} ${auction[3].toLowerCase() === "bill" ? "Hazine Bonosu" : "Devlet Tahvili"} İhalesi`;
  for (const [pattern, translation] of INDICATORS) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const suffix = normalized.slice(match[0].length).replace(/[()]/g, "").trim();
    if (!suffix) return translation;
    let remainder = suffix;
    const labels: string[] = [];
    for (const [qualifier, label] of QUALIFIERS) {
      remainder = remainder.replace(qualifier, () => { labels.push(label); return ""; });
    }
    if (remainder.replace(/[\s,./-]/g, "") === "") return `${translation} (${labels.join(", ")})`;
    return null;
  }
  return null;
}

export function displayCalendarTitle(title: string): string {
  return localizeCalendarTitle(title) ?? "Ekonomik Gösterge";
}
