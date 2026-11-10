# Global haber akışı

WalterBloomberg toplama ve Gemini çeviri kodu `backend/global_news_bot.py` içindedir. `backend/main.py` bağımsız arka plan işçisini başlatır. Haberler ziyaretçi isteği beklemeden 30 saniyede bir kontrol edilir. `/api/global-news` hazır Türkçe haberleri döndürür; HTTP isteği sırasında Telegram veya Gemini çağrısı yapılmaz.

Terminal mevcut `NEXT_PUBLIC_BACKEND_URL` üzerinden bu API'yi 15 saniyede bir okur. BIST ve KAP ile aynı Render servisi kullanılır. Eski `/api/telegram-news` yolu yalnızca uyumluluk proxy'sidir. Next.js içinde haber toplama/çevirme kodu veya Gemini anahtarı ihtiyacı kalmadı. Ekonomik takvimin bağımsız çevirisi değişmedi.

## Render ayarları

1. `backend/main.py` uygulamasının çalıştığı Render servisini açın.
2. **Environment → Add Environment Variable**: ad `GEMINI_API_KEY`, değer Google AI Studio'dan aldığınız yeni anahtar.
3. Kaydedip servisi yeniden dağıtın. Anahtarı koda, GitHub'a veya sohbete koymayın. `NEXT_PUBLIC_` öneki kullanmayın.
4. İsteğe bağlı `GEMINI_MODEL` (varsayılan `gemini-2.5-flash`). Modelin hesabınızda kullanılabilir olması gerekir.
5. Tek worker kullanın (`WEB_CONCURRENCY=1`). Servisin uyku durumunda haber toplanmaz; yeniden uyanınca bugünün geçmişi taranır.

Anahtar edinme: https://aistudio.google.com/apikey → Google hesabınızla giriş yapın → API anahtarı oluşturun. Hesap/proje seçimi istenirse size ait projeyi seçin. Sohbette paylaşılmış anahtarı iptal edip yeni bir anahtar kullanın.

## Kalıcı kayıt

Haberler ve başarılı çeviriler SQLite'a yazılır; anahtar dosyaya kaydedilmez. Varsayılan dosya `backend/.data/global-news.sqlite3` (Git tarafından yok sayılır). Yazılabilir aynı dosya korunduğunda süreç yeniden başlatılsa da çeviriler tekrar kullanılabilir.

Render'ın geçici dosya sistemi yeniden dağıtımda silinebilir. Dağıtımlar arasında kalıcılık gerekiyorsa Render Persistent Disk bağlayıp **GLOBAL_NEWS_DB_PATH=/var/data/global-news.sqlite3** ayarlayın; `/var/data` diskinizin gerçek bağlama yolu olmalı. Disk yoksa uygulama yine çalışır, dosya kaybolduğunda çeviriler yeniden üretilir. Yedi günden eski kayıtlar temizlenir.

Türkiye gününe ait en fazla 200 haber sunulur. Telegram'ın eski sayfaları da taranır; ilk yüklemede 20'şer haber çevrilir. Model çıktıları haber kimliğiyle eşleştirilir. Kaynak metnin tamamı ve model adının hash'i kullanılır; düzenlenen mesaj tekrar çevrilir. Kaynak haberlerin eksiksizliği Telegram'ın sunduğu geçmişe bağlıdır.

URL, yıldız ve `(@WalterBloomberg)` temizlenir; rakamlar, özel isimler, atıflar korunur. Haberler tıklanamaz. Gemini kullanılamadığında İngilizce veya düşük kaliteli yedek çeviri gösterilmez. Hazır Türkçe haberler korunur, eksikler tekrar denenir. Anahtar eksikse haberler yine toplanıp kaydedilir; çeviri anahtar eklenip servis yeniden başlatılınca başlar.

## Kontrol

```sh
python -m unittest discover -s backend -p 'test_*.py'
bun test lib/calendar-titles.test.ts
npm run lint
node_modules/.bin/tsc --noEmit
```

Testler kontrollü kaynak HTML'i ve çeviri yanıtları kullanır; canlı çeviri kalitesini ölçmek için gerçek Gemini erişimiyle örnek haberler okunmalıdır.

## Haber biçimi ve tarafsızlık

Çeviri talimatları `backend/global_translation_prompt.txt` dosyasındadır. Başlık, paragraf ve madde düzeni Telegram HTML'inden arayüze kadar korunur. Madde veya paragraf yapısını kaybeden yanıtlar kaydedilmez ve tekrar denenir. Çeviri promptu kaynak dışı yorum, analiz, çıkarım, neden-sonuç ilişkisi veya yatırım tavsiyesi eklemeyi yasaklar. Bu yapısal kontroller anlam doğruluğunu otomatik olarak garanti etmez; örnekler gerçek model yanıtlarıyla da incelenmelidir.

Prompt içeriği çeviri önbelleği anahtarına dahildir. Prompt veya biçim sürümü değiştiğinde eski düz metin çevirileri yeni kurallarla tekrar üretilir. Haberler kademeli çevrildiği için yeniden dağıtımdan sonra geçmişin dolması birkaç dakika sürebilir.

Yenilemede aynı güne ait tarayıcı önbelleği anında gösterilir; arka plandaki
boş/geçici başarısız yanıtlar hazır haberleri silmez. Terminalin kutuları ve
başlıkları ilk sunucu HTML'inde çizilir; tarayıcı önbelleği hydration sonrasında
güvenle geri yüklenir. Boş tam sayfa yükleme ekranı ve içerik uyuşmazlığından
kaynaklanan yeniden kurulum önlenir. Soğuk başlangıçta ilk çevrilebilir
altı haber, günün tüm geçmişi toplanmadan hazırlanır. Sonrasında normal
20'lik gruplar ve geçmiş toplama devam eder. Gerçek ilk hazırlık süresi kaynak,
çeviri servisi ve kota durumuna bağlıdır.

## Gemini 429 (kota / hız sınırı)

HTTP 429, Gemini'nin kota veya hız sınırı yanıtıdır. Tek başına API anahtarının geçersiz olduğunu göstermez. Uygulamanın `/api/global-news` için HTTP 200 vermesi ise yalnızca haber API'sine erişilebildiğini gösterir; hazır haber sayısı `count`, bekleyen çeviri sayısı `pending` alanındadır.

429 alınınca yalnızca başarısız grup değil tüm Gemini çeviri kuyruğu bekletilir. `Retry-After` ve Google `RetryInfo` süreleri dikkate alınır; tekrar eden sınır hatalarında bekleme 1 dakikadan 30 dakikaya artar. Google günlük kota sınırı bildirmişse en az 1 saat beklenir; bu saat dolunca kotanın açılacağı garanti edilmez. Telegram toplama ve hazır haberleri sunma devam eder. Bekleme SQLite'a kaydedilir; dosya korunduğunda süreç yeniden başlatılsa da korunur. Başarılı çeviriden sonra normal akışa dönülür. API, `translation_state` ve UTC `translation_retry_at` ile bu durumu açıklar. Yanıt gövdesi veya anahtar loglanmaz.

Google AI Studio'da https://aistudio.google.com/usage üzerinden aynı proje/modelin kullanımını ve limitlerini kontrol edin. Günlük kota dolmuşsa ilgili kota yenilenmesini beklemek veya proje kotasını/faturalandırmasını düzenlemek gerekir. Limit 0 görünüyorsa projede o modele kullanılabilir kota tanımlanmamış olabilir. Aynı projede yeni bir API anahtarı oluşturmak proje/model kotasını artırmaz. Kota ya da faturalandırma ayarları bu kod değişikliğiyle değiştirilmez.
