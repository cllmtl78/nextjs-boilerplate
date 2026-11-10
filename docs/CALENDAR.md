# Ekonomik takvim

Takvim mevcut terminal tasarımında gösterilir; iframe kullanılmaz. Açık sayfa
`/api/calendar` yolunu 60 saniyede bir sorgular.

## Render kurulumu

`EULERPOOL_API_KEY`, Render'daki **Python backend servisinin** Environment
ayarına eklenir. Next.js'e anahtar eklemek gerekmez. İstek akışı şöyledir:

`Tarayıcı → Next.js /api/calendar → Render /api/macro/calendar → Eulerpool`

Next.js backend adresini `BACKEND_URL`, ardından `NEXT_PUBLIC_BACKEND_URL`
değişkeninden okur. İkisi de yoksa mevcut diğer haber servisleriyle aynı
`https://bpt-news-backend.onrender.com` adresi kullanılır. Kod değişikliği hem
backend'e hem Next.js'e dağıtılmalıdır. Anahtarın eklenmesi/değişmesi sonrasında
Render servisi yeniden dağıtılmalı/başlatılmalıdır.

Render endpoint'i sadece içinde bulunulan Türkiye gününü sorgular. İsteklerde
anahtar tarayıcıdan veya Next.js'ten aktarılmaz; Render tarafından okunur.
İstisnaların token içerebilecek ham URL'leri loglanmaz veya istemciye döndürülmez.

## Veri ve yenileme

Gerçek kaynak `GET https://api.eulerpool.com/api/1/macro/calendar` endpoint'idir.
`start/end` Türkiye günü sınırlarını milisaniye olarak, `countries=tr,us,cn,jp`
ve `language=en` ile gönderilir. Kullanıcının Calendar/Properties yanıtlarında
Euro Bölgesi ayrı ülke kodu olarak bulunmadığından Euro Bölgesi üretilmez.
Properties her dakika sorgulanmaz.

Render'daki kilit ve ortak 60 saniyelik önbellek eşzamanlı ziyaretçileri birleştirir;
anahtarlı dış API sorgusu dakikada en fazla bir defa yapılır (backend süreci
başına). Next.js bu backend yanıtına ikinci bir dakikalık TTL eklemez. Ziyaretçi
olmayan dönemde çalışan bir cron değildir. Birden çok backend süreci/örneği
kendi önbelleğine sahiptir; toplam kota bunların toplamıdır. Tek süreç yaklaşık
43.200 istek/30 gün kullanır.

`actual_value`, `previous_value` ve `consensus_value` ayrı okunur. Konsensüs
boşsa `forecast_value` kullanılır. Sonuç tahminle doldurulmaz; sıfır geçerli
sonuçtur. Her sütunun kendi para birimi ve çarpanı kullanılır. `48.44 × 1e9`
ekranda `48.44B $` gösterilir. Gün boyu olaylarda kesin saat gösterilmez.

Kaynak kesintisinde Render aynı günün son başarılı yanıtını `stale: true` ile
korur; gün değişiminde eski veri taşınmaz. Anahtar eksikliği ve diğer hatalar
503 döndürür. Etkin rota Investing/TradingView'a dönmez. Eski ayrıştırıcılar
geçmiş regresyon testleri için ayrı `fetchLegacyCalendarSource` fonksiyonunda
tutulur ve etkin takvim tarafından çağrılmaz.

## Tanılama

Render `/api/macro/calendar` yanıtındaki `eulerpoolKeyConfigured` backend'in
anahtarı okuyup okuyamadığını belirtir. Site `/api/calendar?diagnostics=1`
yanıtında `source: eulerpool`, `keyLocation: backend` ve
`eulerpoolKeyConfigured: true` görünmelidir. Anahtarın kendisi gösterilmez.

Uyumluluk için Next.js'te ayrıca `EULERPOOL_API_KEY` tanımlıysa doğrudan Eulerpool
sorgusu da desteklenir; bu yolda Next.js'in kendi 60 saniyelik önbelleği kullanılır.
Varsayılan ve önerilen mevcut kurulum Render backend yoludur.

Regresyon testleri kullanıcının gerçek yanıtından alınmış kayıtları kullanır;
`lib/fixtures/eulerpool-calendar.json` API anahtarı içermez. Backend testleri
ortak önbellek/eşzamanlı ziyaretçi, anahtar konumu, token gizliliği, kesinti ve gün
sınırını; Next.js testleri Render üzerinden gerçek alanların dönüştürülmesini
kontrol eder.
