# Kripto haber akışı

Kaynak: https://t.me/s/onecryptofeed. Backend her 60 saniyede kontrol eder ve
sayfalama ile bugünün en fazla 200 kaydını alır. 60–80 haber/gün için yeterlidir.
Yalnızca HTTP(S) kaynak bağlantısı olan mesajlar yayınlanır. Mesajın son dış
bağlantısı haber kaynağı kabul edilir; bu kanaldaki `başlık - kaynak` biçimine
göredir. Kaynak etiketi ve URL çeviriye gönderilmez, ayrı tutulur.

Başlıklar mevcut tarafsız finans çeviri promptuyla Gemini üzerinden Türkçeye
çevrilir. Yorum/ek bilgi üretilmez. Çeviri tamamlanmadan İngilizce başlık arayüze
verilmez. 20'lik partiler, kalıcı çeviri önbelleği ve 429 beklemesi Global
botuyla aynı uygulamayı kullanır. İki akış aynı anahtarın kotasını tüketir;
yeni bot eklenmesi kotayı artırmaz. Her bot kendi kuyruğunun geri çekilmesini
uygular. Yeni API anahtarı zorunlu değildir.

- `GEMINI_API_KEY`: Render backend'deki mevcut anahtar.
- `GEMINI_MODEL`: mevcut model, varsayılan `gemini-2.5-flash`.
- `CRYPTO_NEWS_DB_PATH`: isteğe bağlı kalıcı SQLite dosyası. Varsayılan,
  GLOBAL_NEWS_DB_PATH dosyasıyla aynı klasörde `crypto-news.sqlite3`.
- `GET /api/crypto-news`: Türkçe kayıtlar, `pending`, `translation_state` ve
  `translation_retry_at`.
- Log öneki: `[Kripto]`.

Geçmiş yedi gün DB'de kısa süreli önbellek için saklanır; API ve arayüz yalnızca
Europe/Istanbul bugününü gösterir. Gece yarısında ve sekmeye dönüşte ekran
filtresi yenilenir. Başlığa tıklanınca mevcut haber modalı açılır; Kaynağında Oku
orijinal yayıncıya gider. Yayıncının haber gövdesi kazınmaz.

Arayüz günün çevrilmiş haberlerini tarayıcı önbelleğinde tutar; sayfa yenilenince
ağ yanıtını beklemeden son haberleri gösterir. Boş/geçici başarısız yanıt aynı
günün haberlerini silmez. Arayüz 15 saniyede bir hazır veriyi kontrol eder;
bu istekler Gemini çağrısı başlatmaz. İlk hazırlıkta önce en yeni sayfa ve altı
haber çevrilir; ardından normal geçmiş toplama ve 20'lik gruplar devam eder.
Kota beklemesi veya çeviri anahtarı yokken geçmiş toplama normal biçimde sürer.

Testler: `python -m unittest discover -s backend`.
Bu ortamın ağ filtresi t.me bağlantısını CONNECT 403 ile engellediği için canlı
kanal doğrulaması yapılmadı. HTML ayrıştırma, bağlantı saklama, çeviri önbelleği
ve günlük sıfırlama yerel verilerle test edildi. Backend ve frontend birlikte
deploy edilmeli; sonrasında API ve `[Kripto]` logları kontrol edilmeli.
