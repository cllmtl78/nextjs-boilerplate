# MacroRadar tarihsel karşılaştırmalar

Makro sayfasının temel 9 FRED göstergesine iki bağımsız analiz kutusu eklenir:
Sıra dışı hareketler ve Faiz eğrisi dönemleri. FRED göstergelerinin kaynağı veya
hesaplaması değiştirilmez. Yeni API anahtarı gerekmez.

## Kaynak ve lisans

- https://www.macroradar.io/api/v1/whats-moving
- https://www.macroradar.io/api/v1/episodes?series=T10Y2Y

Resmî API bağlantısı bu Cloud ortamında engellendi; kullanıcı iki canlı JSON
zarfını paylaştı. Ayrıştırıcı bu yanıtlardaki alanlara göre yazıldı. Fixture
hareket dosyası paylaşılan yanıtın 5 satırlık örneği, dönem dosyası 12 gerçek
kaynak dönemi içerir. Üretimde fixture veya örnek rakam kullanılmaz.

Her kutuda MacroRadar'a bağlantı, ayrıntı penceresinde kaynak grafiği ve meta
`method_url` bağlantısı bulunur. Kaynak geri bağlantı/atıf ister. URL'ler HTTPS
ve macroradar.io alanına sınırlandırılır. FRED ve üçüncü tarafların ham seviye
lisanslarını türetilmiş istatistiklerin izniyle karıştırmayın.

`latest_value` ve `prior_value` TÜM hareketlerde dışarıda bırakılır. Bu endpoint
ham değer birimlerini vermediğinden örneğin CPI endeksi 336'yı enflasyon %336
gibi göstermek de önlenir. `value_note` varsa UI ham seviye lisans notu gösterir.
Yalnızca kaynağın izin verdiği değişim, yüzdelik sıra ve örneklem bilgisi kullanılır.

## Anlam

`fresh:false` satırlar ana listeden çıkarılır; kalanlar `surprise_percentile`
azalan sıralanır. Değişim `percent` ise göreli %, `level_pp` ise yüzde puandır.
`window` month/quarter kaynağın karşılaştırma penceresidir; her satırın gerçek
prior/latest tarihleri ayrıntıda ayrıca gösterilir. Pencere her zaman tam
30/90 takvim günü değildir. Yüzdelik sıra bir tahmin veya açıklama beklentisi
sürprizi değildir. Eşit büyüklükler yüzdelik sıraya girebildiğinden %rank kadar
gözlemden kesinlikle büyüktür gibi bir iddia kurulmaz.

İngilizce kaynak cümleleri çevrilip yorum üretilmez; Türkçe isim haritası ve
sayısal alanlardan deterministik açıklama hazırlanır. Yeni/bilinmeyen birim
adlarında kod gösterilir. Gemini veya ek çeviri kotası kullanılmaz.

T10Y2Y dönemleri, kaynağın ters eğri tanımına dayanır; resesyon olasılığı olarak
sunulmaz. Açık liste boşsa hesap tarihi itibarıyla devam eden kaynak dönemi
yoktur. Kaynak erişilemiyorsa bu durum "dönem yok" diye gösterilmez. Açık
listenin tanınmayan yapısı hata sayılır. Süre `(end_date veya as_of)-start_date`
takvim farkıdır; işlem günü veya iki uç dahil gözlem sayısı değildir.

## İşleyiş

Backend işçisi saatte bir iki sabit endpoint'i çağırır; ziyaretçi istekleri bu
bellek snapshot'ını okur (`GET /api/macro/insights`). Ön yüz dakikada bir kendi
backend'ini kontrol eder, modal açılması sağlayıcıya yeni çağrı yapmaz.
Kaynaklar bağımsız `ok/starting/unavailable/stale` durumları taşır; yenileme
hatasında önceki hesap tarihleri korunur. Restart'ta bellek sıfırlanır. Bir
Uvicorn worker mevcut uygulama düzeniyle uyumludur. Log öneki `[MacroRadar]`.

## Kontroller

`python -m unittest discover -s backend -p test_macroradar.py`
`bun test lib/macro-insights.test.ts`

Canlı yanıt örnekleriyle eski kayıt filtresi, ham seviye çıkarılması, birimler,
kaynak URL'leri, 12 tamamlanan dönem (sonuncusu 792 takvim günü), açık dönem
ve bağımsız hata durumları test edildi. Tarayıcıda 320/390/768/1024/1440px,
kategori, ayrıntı, lisans notu, kaynak linki ve erişim kesintisi doğrulandı.
Backend ve frontend deploy'u birlikte gerekir; Render'ın sağlayıcıya erişimi
bu ortamdan bağımsız olarak deploy sonrası kontrol edilmelidir.
