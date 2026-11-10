# ABD ulusal borcu

Makro sayfasında Fed bilançosunun altında `/ ABD ulusal borcu` kartı bulunur.
Toplam federal borç, piyasadaki borç ve federal hesaplar arası borç gösterilir.
Karttan açılan pencerede üç serinin geçmiş grafikleri ve kaynak bağlantıları
vardır. Tutarlar son raporlanan tarihe aittir; tahmini/canlı artan sayaç yoktur.

Veri akışı: `USNationalDebt → Render /api/macro/us-debt → Eulerpool
/api/1/government/treasury/debt?limit=100`. Render'daki mevcut
`EULERPOOL_API_KEY` kullanılır; tarayıcıya anahtar gönderilmez. API hatalarının
token içerebilen ham metinleri loglanmaz veya yanıta konmaz.

Başarılı sorgu Türkiye günü başına bir kez yapılır (normal tek backend süreci
ve korunan önbellekte yaklaşık 30 istek/ay). Ziyaretçi yokken çalışan cron yoktur.
Arayüz 30 dakikada bir veya genel yenile düğmesiyle backend'i kontrol eder;
bunlar aynı gün Eulerpool'a yeni istek oluşturmaz. Başarısız sorguda en az
15 dakika beklenir. Son başarılı rapor varsa tarihini koruyarak `stale` döner.

Önbellek `backend/.data/us-national-debt.json` dosyasına atomik yazılır.
`GLOBAL_NEWS_DB_PATH` ayarlıysa aynı klasör kullanılır; ayrı yol
`EULERPOOL_DEBT_CACHE_PATH` ile seçilir. Dosya korunduğunda yeniden başlatma
aynı güne ikinci sorgu atmaz. Geçici disk silinirse veya bağımsız backend
örnekleri kullanılırsa ek sorgular olabilir. Takvimle birlikte iki günlük
Eulerpool sorgusu normalde yaklaşık 60 istek/ay eder.

Yanıtın tarihleri sıralanıp son 100 gözlem tutulur. Borç alanları Decimal ile
okunur; toplamın iki alt kalemle tutarlılığı kontrol edilir. JSON'da dolar
alanları ondalık metin olarak korunur. Tam tutar tarayıcıda BigInt ile biçimlenir;
trilyon dolar grafiği ve kısa gösterim için Number kullanılır. Değişim son iki
rapor arasındadır; raporlar ardışık takvim günü olmak zorunda değildir.

Kullanıcının paylaştığı gerçek 100 kayıt `fixtures/treasury-debt.json` içindedir.
Testler tutar/tarih/kuruş, günlük önbellek, yeniden başlatma, hata beklemesi,
anahtar gizliliği ve eski tarihsel karşılaştırma rotasının kaldırılmasını kapsar.
Yeni kartın çalışması için hem Render backend hem site güncel koda dağıtılmalıdır.
