# Ekonomik takvim

Terminaldeki etkin takvim `components/EconomicCalendar.tsx` içindeki resmi
Investing iframe'idir. Ziyaretçi tarayıcısı `sslecal2.investing.com` adresini
doğrudan yükler; uygulama sunucusu bu tabloyu kazımaz ve takvim kutusu
`/api/calendar` yolunu çağırmaz.

Bu yol kullanıcı tarafından tarayıcıda açılarak doğrulandı. Önceki canlı tanılama
Investing'in hem HTML servisine hem widget'ına uygulama sunucusundan erişimin
HTTP 403 ile engellendiğini gösterdi. TradingView'ın gerçek yanıtındaki `actual`
ve `actualRaw` alanları da boştu. FXStreet denemesi HTTP 401 döndürdü. Bu nedenle
bu kaynakları sunucudan art arda denemek kullanıcıya sonuç sağlamıyordu.

Iframe Türkiye, ABD, Euro Bölgesi, Çin ve Japonya için günlük takvimi; açıklanan,
beklenti ve önceki sütunları gösterir. `lang=10` Türkçe, `timeZone=18` sabit GMT+3
ayarlarıdır. Kutu 380px yüksekliğindedir; içerik sağlayıcının kendi tablosudur.
Koyu renk parametreleri sağlayıcıya iletilir, çapraz kaynak içeriğine CSS veya
JavaScript enjekte edilmez. Sağlayıcı bağlantısı görünür tutulur ve ayrıca ayrı
sekmede açma imkânı verir.

Açık sayfada iframe her 60 saniyede yeni `_refresh` parametresiyle yeniden
oluşturulur. Başlıktaki yenile düğmesi aynı işlemi hemen yapar. Bu tarayıcı
yenilemesidir; sağlayıcının bir sonucu yayımlama hızına ilişkin garanti vermez.
Arka plandaki sekmeler tarayıcı tarafından yavaşlatılabilir.

Eski JSON adaptörü `/api/calendar` tanılama ve gelecekteki doğrudan veri
entegrasyonları için tutulmaktadır. Bu API'nin kaynak/başarı durumu ekranda
gösterilen resmi iframe'in durumunu temsil etmez. Tarayıcıdan Investing'e erişim
ve üçüncü taraf iframe yükleme izni gerekir. Resmi tablonun gerçek içeriği
çapraz kaynak güvenliği nedeniyle üst sayfadan okunamaz.

Kontrollü tarayıcı testi resmi iframe adresi/ülke/saat ayarlarını, sonuç hücresinin
görüntülenmesini, 60 saniyede yenilemeyi, elle yenilemeyi, eski JSON API'sinin
çağrılmadığını ve mobil sınırları doğrular. Bu testte iframe yanıtı sentetiktir;
üretimdeki gömülü içeriğin gerçek sonuçları ayrıca sağlayıcıya bağlıdır.
