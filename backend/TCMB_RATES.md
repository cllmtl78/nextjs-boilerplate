# TCMB gösterge döviz kurları

Kaynak: https://www.tcmb.gov.tr/kurlar/today.xml
API: `GET /api/tcmb-rates`.

TCMB gösterge kurları iş günlerinde 15.30 itibarıyla belirlenir. Bu saat XML'in
kesin olarak aynı saniyede yenileneceğine dair bir garanti değildir. API XML'deki
`Tarih` alanını döndürür; hafta sonu/tatilde son iş günü tarihi korunur. Tarih
bugünün tarihiyle değiştirilmez. Bunlar anlık işlem fiyatı değildir.

Bölüm BPT Finans'ın üstünde varsayılan kapalıdır. Açılınca sekiz para birimi
(USD, EUR, GBP, CHF, JPY, CAD, AUD, SAR) için ForexBuying/ForexSelling gösterilir;
efektif/banknot kurları kullanılmaz. JPY'nin 100 birimlik değeri dönüştürülmeden
`100 JPY` etiketiyle gösterilir. Masaüstünde 8, tablette 4, telefonda 2 sütun.

Yalnızca bölüm açıkken istemci her dakika kontrol eder. Backend başarılı tabloyu
5 dakika önbellekler; başarısız denemeler arasında 60 saniye bekler. Kesintide
önceki tablo varsa `stale` durumuyla korunur, arayüz güncellenemediğini belirtir.
Kayıt yoksa `unavailable` döner. Eksik fiyat sıfır olarak gösterilmez. API anahtarı
gerekmez. Tarayıcıda XSLT çalıştırılmaz; ham XML backend'de ayrıştırılır.

Resmî XML ve SSS sayfası geliştirme ortamının ağ filtresinde CONNECT 403 ile
engellendi. Güncel canlı yanıt bağımsız doğrulanamadı. Ayrıştırma/önbellek
örnek XML ile, arayüz yerel API örneği ile test edildi. Deploy sonrası gerçek
API yanıtı ve `[TCMB]` logları kontrol edilmeli.

Test: `python -m unittest discover -s backend -p test_tcmb_rates.py`.
