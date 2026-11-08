# Kur karşılaştırması

Masaüstünde Kripto kutucuğunun altındaki sağ sütunda, en az 380px yükseklik ve
aynı sütun genişliğinde SVG grafik bulunur. Alt sıradaki sol bölümle grafik
ayrı içerik yüksekliklerinde de aynı alt kenarda biter; BPT Finans boşluğu doldurur. Soldaki iki sütun Kur dönüştürücü,
TCMB Kurlar ve BPT Finans'a ayrılır. Aralıklar ortak 7px değişkenini kullanır.
1200px ve altında grafik Kripto'nun ardından gelir, sol bölümler altına sıralanır.
Kur dönüştürücü artık header'da değildir; mevcut modalını korur.

Varsayılan baz TRY, hedefler USD/EUR/GBP ve dönem 3 aydır. Ayarlar penceresi
mevcut tam katalog ve aramalı CurrencySelect menüsünü kullanır. En fazla 5 hedef,
baz ile hedefin farklı olması ve en az 1 hedef koşulları uygulanır. Pencere
kaydedilmeden grafik seçimleri değişmez. Dönemler 30/90/365/1825 gündür; uzun
aralıkta API `group=week` kullanır. Max için yanıltıcı sabit 1999 tarihi eklenmez.

## Değer yönü ve başlangıç

Frankfurter `base=TRY&quotes=USD` için 1 TRY'nin USD değerini verir. Bu grafik
alışılmış USD/TRY yönünü gösterir: fiyat = 1 / rate. Normalize değişim:
`(ilkRate / güncelRate - 1) * 100`.
Örneğin USD/TRY 50'den 55'e çıkarsa çizgi +%10 gösterir. Pozitif değer, hedefin
baz karşısında değer kazanmasıdır; TRY bazındaki pozitif USD çizgisi TRY'nin
USD karşısında güçlenmesi anlamına gelmez.

Seriler tarihe göre sıralanır. En az iki kaydı olan seriler için ortak ilk ve
son tarihler seçilir; her çizgi aynı başlangıçta %0'dır. Aradaki eksik kayıtlar
null kalır, sıfır veya uydurma kurla doldurulmaz. Ortak tarih yoksa grafik
üretilmez; yetersiz seriler ayrıca belirtilir. API yayın tarihleri korunur.
Fare/dokunma ile tarih seçimi ve sol/sağ oklarla klavye gezinmesi desteklenir.

## API

`GET /api/currency-comparison?base=TRY&quotes=USD,EUR,GBP&range=3M`
Frankfurter v2 `/rates?base=...&quotes=...&from=...&to=...` kullanır. Sorgu alanları
resmî depo OpenAPI şemasından doğrulandı. Çiftler tam aktif kataloğa göre
kontrol edilir. Anahtar gerekmez. 30 dakika süreç içi önbellek (en fazla 50
sorgu), eşzamanlı istek birleştirme, hata sonrası 60sn bekleme ve en fazla 24
saatlik kayıt için açıkça işaretli `stale` dönüşü bulunur. Tarih cache anahtarına
dahildir; gece yarısı ve 15 dakikalık kontrol yeni tarihi talep eder.

Canlı Frankfurter erişimi bu Cloud ortamının ağ filtresinde engellendiği için
canlı tarihsel veri doğrulanmadı. Yerel API verileriyle 320/390/768/1024/1440px
boyutlar, yerleşim, menüler, seçim, dönem ve taşınan dönüştürücü test edildi.
Normalize hesap, ortak tarihler, boşluklar ve API doğrulama/cache testleri:
`bun test lib/currency-comparison.test.ts lib/currency-comparison-api.test.ts`.

Yalnızca Next.js frontend deploy'u gerekir; Python backend değişmedi.
