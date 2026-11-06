# Global haber akışı

Kaynak: `https://t.me/s/WalterBloomberg`. `/api/telegram-news`, Europe/Istanbul gününe ait en fazla 200 metinli haberi Telegram'ın önceki sayfalarını da dolaşarak toplar. Kutudaki haberler bağlantı değildir. URL, yıldız ve `(@WalterBloomberg)` imzası sunucuda temizlenir; şirket/kişi adları, rakamlar ve kaynak atıfları korunur.

## Yayına alma

Next.js arayüz uygulamasının yayınlandığı servisin Environment bölümüne **GEMINI_API_KEY** ekleyin ve yeniden dağıtın. Anahtarı kaynak koda, sohbete veya `NEXT_PUBLIC_` değişkenlerine koymayın. Anahtarın Gemini API erişimi ve yeterli kotası olmalı. Varsayılan model `gemini-2.5-flash`; gerektiğinde erişiminiz olan modeli `GEMINI_MODEL` ile seçebilirsiniz. HTTPS erişimi: `t.me` ve `generativelanguage.googleapis.com`.

Bu değişken Next.js API rotalarında kullanılır. `backend/main.py` içindeki Python haber servisi Global çevirisini yapmaz.

## Çeviri ve hata davranışı

Çeviri tek merkezde, haber kimlikleriyle eşleştirilmiş JSON çıktısı olarak üretilir. İlk yüklemede en yeni 20 çevrilmemiş haber işlenir; sonraki 15 saniyelik yenilemelerde tarihçe tamamlanır. Yeni gelen haberler önce işlenir. Başarılı çeviriler haber metninin tamamının hash'iyle 48 saat saklanır. Kaynak metin düzenlenirse tekrar çevrilir. Eşzamanlı talepler aynı sunucudaki işi paylaşır.

Önbellek çalışan Node sürecinin belleğindedir; yeniden dağıtımda veya başka sunucu örneğinde tekrar çeviri gerekir. Kalıcı arşiv veya paylaşılan veritabanı bu değişiklikte yoktur. Telegram'ın sunmadığı/sildiği mesajların tamlığı garanti edilemez.

Gemini erişimi yoksa kalitesiz bir Google çevirisine veya İngilizce metne sessizce dönülmez. Daha önce çevrilmiş bugünkü haberler korunur; henüz çevrilemeyenler yeniden denenir. Hiç çevrilmiş haber yoksa API 503 döner ve kutu Türkçe haberlerin hazırlanmasını bekler. Logdaki `[Global]` mesajları erişim/model/kota sorunlarını belirtir, anahtar değerini yazdırmaz.

## Kontrol

```sh
bun test lib/walter-feed.test.ts lib/calendar-titles.test.ts
npm run lint
node_modules/.bin/tsc --noEmit
```

Testler örnek Telegram HTML'i ve kontrollü çeviri yanıtlarını kullanır. Canlı çeviri kalitesini ölçmek için gerçek Gemini erişimiyle haberlerden örnekler okunmalıdır; bu ortamda anahtar yok ve Telegram erişimi proxy tarafından engelleniyor.
