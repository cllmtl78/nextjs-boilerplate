# Makro / FRED

Frontend `/makro`, Python backend `GET /api/macro` yanıtını kullanır.
Header'da Ana sayfa ve Makro bağlantıları bulunur; aktif sayfanın altı turkuazdır.
9 gösterge, üç grup, küçük geçmiş grafikleri ve tıklanınca ayrıntılı grafik
vardır. 1Y/3Y/Tümü seçimleri alınmış gözlem penceresini filtreler; tüm FRED
arşivinin indirildiği anlamına gelmez.

## Render kurulumu

Ücretsiz anahtar: https://fred.stlouisfed.org/docs/api/api_key.html
Render **bpt-news-backend > Environment** altında `FRED_API_KEY` eklenmeli ve
backend yeniden deploy edilmelidir. Anahtar Git'e, frontend'e veya
NEXT_PUBLIC değişkenine konmamalıdır. Gemini anahtarından ayrıdır.
Frontend'in mevcut NEXT_PUBLIC_BACKEND_URL bağlantısı korunur.

Anahtar yokken FRED isteği yapılmaz, durum `not_configured`, değerler null ve
geçmişler boş döner. UI örnek veya sahte değer üretmez. Anahtar ve ağ erişimi
olmadan canlı uçtan uca veri doğrulaması yapılmış sayılmaz.

## Seriler ve dönüşümler

- DFEDTARL/DFEDTARU: Fed hedef alt/üst sınırı; ortak son tarih seçilir.
  Grafik üst sınırdır, gösterilen değer alt–üst aralığıdır.
- DGS2/DGS10: yüzde tahvil getirisi; değişim yüzde puandan baz puana x100.
- T10Y2Y: 10Y–2Y farkı, yüzde puan; değişim baz puan.
- CPIAUCNS: arındırılmamış TÜFE; aynı takvim ayının bir önceki yılına göre
  `(endeks / önceki yıl endeksi - 1) * 100` yıllık değişimi.
- PCEPILFE: arındırılmış çekirdek PCE endeksi; aynı yıllık hesaplama.
- UNRATE: arındırılmış işsizlik oranı, yüzde.
- ICSA: arındırılmış ilk başvurular, adet -> bin başvuru (x.001).
- WALCL: Fed varlıkları, milyon USD -> trilyon USD (x.000001).
  Önceki gözleme göre fark milyar USD olarak gösterilir (trilyon fark x1000).

Her kartın değişimi bir önceki geçerli tarihsel gözleme göredir. Aylık seride
veri dönemi ay/yıl; günlük ve haftalıkta gözlem tarihi gösterilir. `last_checked`
sunucunun kontrol zamanıdır, yayın veya gözlem tarihi yerine kullanılmaz.
FRED'deki son revize edilmiş tarihsel değerler kullanılır; ALFRED ilk-açıklama
vintage analizi yapılmaz. Nokta/NaN/eksik kayıtlar sıfır sayılmaz.

## İşleyiş ve test

FRED v1 `https://api.stlouisfed.org/fred/series/observations` kullanılır.
Anahtar yalnızca server-side params içindedir; URL/exception gövdesi loglanmaz.
Arka plan işçisi 30 dakikada bir, en fazla 3 eşzamanlı istekle 10 seri alır.
İlk beş günlük seride 1200, diğerlerinde 156 son gözlem istenir. Ziyaretçiler
FRED'e istek atmaz; 5 dakikada bir backend'in bellek snapshot'ını okur.
Başarısız yenilemede son başarılı gözlemler `stale` olarak tarihleriyle korunur.
Başlangıçta veri yoksa boş kalır. Bellek cache'i restart'ta sıfırlanır.

Kontroller:
`python -m unittest discover -s backend -p test_fred_macro.py`
Enflasyon takvim ayı, birimler, eksik değerler, hedef aralığının ortak tarihi,
anahtarsız istek yapılmaması ve hata metninde anahtar sızmaması doğrulanır.
Tarayıcı testlerinde kontrollü veri kullanıldı; 320/390/768/1024/1440px,
aktif sekme, detay dialog'u ve not_configured görünümü doğrulandı.

## Türkiye seri araştırması

`GET /api/macro/turkey-series` mevcut backend anahtarını kullanarak Turkey ve
Türkiye için iki sabit FRED seri araması yapar. Makro göstergelerini değiştirmez.
Enflasyon, istihdam, büyüme, sanayi, faiz ve döviz başlıkları için en fazla dörder
adayın kod, başlık, birim, sıklık, mevsimsellik, başlangıç/son gözlem ve güncelleme
alanlarını döndürür. Başlıkta veya açık notta discontinued olanlar işaretlenir
ve aktif adayların arkasına sıralanır. Aday gözlem tarihi otomatik olarak
"güncel veri" veya "kesin açıklama tarihi" sayılmaz. Özellikle bankalararası
faiz, TCMB politika faizi olarak yeniden etiketlenmemelidir.

Başarılı arama 24 saat, kısmi arama 5 dakika önbelleklenir. Hatalı aramalar
arasında en az 60 saniye beklenir. API anahtarı ve ham hata gövdeleri dönmez.
Bu araştırma endpoint'inin canlı sonucu Cloud ağ engeli nedeniyle okunamadı;
seri güncelliği endpoint çıktısıyla ayrıca değerlendirilecek.
