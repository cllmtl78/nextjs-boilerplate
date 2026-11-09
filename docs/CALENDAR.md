# Ekonomik takvim

Açık terminal sayfası `/api/calendar` yolunu her 60 saniyede kontrol eder.
Sunucu, aynı Türkiye günü için istekleri 60 saniyelik ortak bellek önbelleğinde
birleştirir; aynı anda gelen ziyaretçiler aynı Promise'ı bekler. Başarısız
istekler de bir dakika tutulur. Bu önbellek sunucu süreci başınadır; ayrı sunucular
veya serverless örnekleri birbirlerinin önbelleğini paylaşmaz. Ziyaretçi yokken
arka planda çalışan bir cron değildir.

`fetchedAt` kaynağın gerçekten sorgulandığı zamanı gösterir. Türkiye günü
değiştiğinde eski önbellek kullanılmaz. API hataları örnek veri üretmez;
tarayıcı aynı güne ait son başarılı sonuçları korur ve hata mesajı gösterir.

Birincil kaynak Investing'dir. Önce genel ekonomik takvim servisi POST formuyla
sorgulanır; sayfalar bildirim kimlikleriyle birleştirilir. Servis erişilemezse
Investing'in genel takvim widget'ının HTML yanıtı denenir. İkisinden de yanıt
alınamazsa aynı gün alınmış Investing sonuçları korunur. Henüz Investing yanıtı
yoksa TradingView yedeği kullanılır; API `degraded: true` döndürür ve arayüz
sonuçların eksik olabileceğini bildirir. Bir sonraki dakikada yeniden Investing
denenir. Önceki günün sonuçları yeni güne taşınmaz.

Türkiye, ABD, Euro Bölgesi, Çin ve Japonya sorgulanır. Investing'in sabit GMT+3
saat dilimi (18) kullanılır; tablo parçaları `cheerio/slim` ile ayrıştırılır.
`eventActual_`, `eventForecast_`, `eventPrevious_` hücreleri ayrı ayrı okunur.
Boş actual hücresi forecast/previous değerleriyle doldurulmaz. Zamanı belirsiz
satırlar için saat uydurulmaz. API anahtarı veya oturum açma gerekmez; erişim
engelleri aşılmaya çalışılmaz.

`/api/calendar?diagnostics=1` seçilen kaynak adresini, varsa yedek kaynağa geçiş
nedenini ve API eşlemesinden önceki ilk yedi kaydı gösterir. Investing kayıtları
bu aşamada HTML hücrelerinden ortak kayıt yapısına çevrilmiş durumdadır.

İstek biçimi ve hücreler açık kaynak `alvarobartt/investpy` istemcisiyle
karşılaştırıldı. Ayrıştırma, sayfalama, sıfır sonuç, kaynak sırası ve arıza
senaryoları sentetik HTML ile test edildi; bu bir canlı erişim doğrulaması değildir. FXStreet, Myfxbook,
Trading Economics ve Investing için bu Cloud ortamından yapılan canlı denemeler
ortamın ağ kısıtında engellendi. İlgili alan adları ortam taslağına eklendi;
taslağın kaydedilip yayınlanması henüz uygulanmış ağ erişimi anlamına gelmez.
