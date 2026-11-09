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

Etkin kaynak hâlen TradingView'dır. `/api/calendar?diagnostics=1`, eşlemeden
önceki ilk yedi ham kaydı gösterir. Kaynak değişimi henüz canlı doğrulanmadı.

Alternatif araştırması: Investing'in `economic-calendar/Service/getCalendarFilteredData`
servisi, açık kaynak `alvarobartt/investpy` istemcisinde POST formuyla sorgulanır.
`eventActual_`, `eventForecast_`, `eventPrevious_` hücreleri ayrı ayrı okunur.
Bu bir canlı erişim veya kullanım izni doğrulaması değildir. FXStreet, Myfxbook,
Trading Economics ve Investing için bu Cloud ortamından yapılan canlı denemeler
ortamın ağ kısıtında engellendi. İlgili alan adları ortam taslağına eklendi;
taslağın kaydedilip yayınlanması henüz uygulanmış ağ erişimi anlamına gelmez.
