# Kayan piyasa şeridi

Sıralama ve görünen adlar `market-types.ts` içindeki tek listeden gelir:
BIST100, SPX, KOSPI, NI225, DXY, EURUSD, BRENT, WTI, USDTRY, EURTRY, GBPTRY, XAUUSD, XAUTRYG, XAGUSD, XAGTRYG, BTCUSD, ETHUSD.

Kaynak eşleştirmeleri:

| Görünen sembol | Kaynak |
| --- | --- |
| BIST100 | Yahoo `XU100.IS` |
| SPX | Yahoo `^GSPC` (S&P 500 endeksi) |
| KOSPI | Yahoo `^KS11` |
| NI225 | Yahoo `^N225` (Nikkei 225) |
| DXY | Yahoo `DX-Y.NYB` |
| EURUSD | Yahoo `EURUSD=X` |
| BRENT | Yahoo `BZ=F`, petrol vadeli kontratı |
| WTI | Yahoo `CL=F`, petrol vadeli kontratı |
| USDTRY | Yahoo `USDTRY=X` |
| EURTRY | Yahoo `EURTRY=X` |
| GBPTRY | Yahoo `GBPTRY=X` |
| XAUUSD | Gold API `/price/XAU`, spot USD/troy ons |
| XAUTRYG | XAUUSD × USDTRY / 31.1034768 |
| XAGUSD | Gold API `/price/XAG`, spot USD/troy ons |
| XAGTRYG | XAGUSD × USDTRY / 31.1034768 |
| BTCUSD | Yahoo `BTC-USD` |
| ETHUSD | Yahoo `ETH-USD` |

Spot metal yerine altın/gümüş vadeli kontratları kullanılmaz. Gram fiyatları teorik spot karşılıklardır; kuyumcu/banka alış-satış fiyatı veya fizikî ürün primi içermez. Çeyrek altın çıkarılmıştır.

## Yenileme ve veri doğruluğu

- Açık ve görünür sayfa 15 saniyede bir API'yi kontrol eder. Rastgele fiyat oynatma ve sabit örnek fiyatlar kaldırılmıştır. Parlama yalnızca yeni kaynak fiyatı değiştiğinde olur.
- Sunucuda 30 saniyelik, çalışan süreç başına ortak önbellek ve eşzamanlı istek birleştirme vardır. En fazla altı kaynak isteği paralel çalışır; tüm tur sekiz saniye bütçeyle sınırlıdır.
- Yahoo chart uçlarında query1/query2 sıralı yedekleme kullanılır. 429 yanıtında `Retry-After` dikkate alınır; hız sınırında sürekli yeniden denenmez.
- Sembol, para birimi ve sayısal fiyat doğrulanır. Fiyat 0, NaN, negatif veya beklenen enstrümana ait değilse kullanılmaz.
- Önceki kapanış yoksa yüzde `--` olur. Eksik kapanış yerine güncel fiyatı koyup sahte %0 üretilmez. Gold API yanıtı önceki kapanış sağlamıyorsa spot metal ve ona bağlı gram fiyatlarının yüzdesi bilinmez; fiyat yine gösterilir.
- Kesintide gerçek son alınan fiyat en fazla 15 dakika `SON VERİ` etiketiyle tutulur. Sonrasında veya hiç geçerli fiyat alınmadıysa `-- / VERİ YOK` gösterilir. Önbellek sürecin belleğindedir; yeniden dağıtımda başlangıçta veri beklenir.
- Kaynak ve kaynak zamanı sembolün açıklamasında yer alır. Seans kapalıyken kaynağın son işlem fiyatı görülebilir; ücretsiz veri kaynakları borsaya göre gecikmeli olabilir. Tarama sıklığı, kaynağın piyasa gecikmesini ortadan kaldırmaz.

Gerekli HTTPS hedefleri: `query1.finance.yahoo.com`, `query2.finance.yahoo.com`, `api.gold-api.com`. Yeni bir API anahtarı gerektiren entegrasyon eklenmedi. Bu bulut oturumunda bu kaynaklara proxy erişimi engellendiği için canlı erişim doğrulanamadı; testler kontrollü sağlayıcı yanıtlarıyla çalışır.

Kontrol: `bun test lib/market-data.test.ts`, `npm run lint`, `node_modules/.bin/tsc --noEmit`.
