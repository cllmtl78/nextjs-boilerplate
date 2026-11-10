# Ekonomik takvim

Takvim mevcut terminal tasarımında gösterilir; iframe kullanılmaz. Açık sayfa
`/api/calendar` yolunu 60 saniyede bir sorgular.

## Render kurulumu

`EULERPOOL_API_KEY`, Render'daki **Python backend servisinin** Environment
ayarına eklenir. Next.js'e anahtar eklemek gerekmez. İstek akışı şöyledir:

`Tarayıcı → Next.js /api/calendar → Render /api/macro/calendar`

Render aynı dakikada paralel olarak Eulerpool'dan takvim listesini, TradingView'dan
açıklanan sonuçları alır. Listede görünen olay, başlık, saat, önceki değer ve
beklenti Eulerpool'dandır. TradingView eşleşen kaydın yalnızca açıklanan sonucunu
doldurur; kendi ek olaylarını listeye katmaz.

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

## Sonuç eşleştirme

Ülke, normalize edilmiş İngilizce gösterge adı, Türkiye yayın günü ve referans
dönemi birlikte karşılaştırılır. Örneğin Eulerpool `reference_date=10` ile
TradingView `referencePeriod=Oct 2026` eşleşir. Bilinen eşanlamlılar (CPI YoY /
Inflation Rate YoY gibi) sınırlı ve açık kurallarla eşlenir. YoY/MoM/QoQ, core,
mevsimsellik ve preliminary/final ayrımları korunur. İki tarafta da dönem
biliniyorsa aynı dönem zorunludur; dönem eksikse saat farkı en fazla 15 dakika
olabilir. Birden fazla aday varsa veya tek TradingView kaydı birden fazla farklı
Eulerpool olayına karşılık geliyorsa sonuç aktarılmaz.

TradingView'ın `actualRaw`, `actual`, `scale` ve `unit` alanlarıyla sayı, para
birimi ve büyüklük birlikte dönüştürülür. Yüzde, bin/milyar ve para birimleri
karıştırılmaz. Eşleşen gerçek TradingView sonucu varsa Eulerpool sonucunun yerine
kullanılır. TradingView sonucu boşsa Eulerpool'un mevcut sonucu veya aynı gün
daha önce doğrulanmış TradingView sonucu korunur. İki kaynakta da sonuç yoksa
sonuç üretilmez. Her kaydın `actualSource` alanı sonucun kaynağını belirtir.

Kaynak kesintisinde Render aynı günün son başarılı yanıtını `stale: true` ile
korur; gün değişiminde eski veri taşınmaz. Anahtar eksikliği ve diğer hatalar
503 döndürür. Takvim listesi Investing/TradingView listesine dönmez. Eski ayrıştırıcılar
geçmiş regresyon testleri için ayrı `fetchLegacyCalendarSource` fonksiyonunda
tutulur ve etkin takvim tarafından çağrılmaz.

## Tanılama

Render `/api/macro/calendar` yanıtındaki `eulerpoolKeyConfigured` backend'in
anahtarı okuyup okuyamadığını belirtir. Site `/api/calendar?diagnostics=1`
yanıtında `source: eulerpool`, `keyLocation: backend` ve
`eulerpoolKeyConfigured: true` görünmelidir. Anahtarın kendisi gösterilmez.

`resultSource: tradingview` sonuç tamamlayıcısını belirtir. `diagnostics.matching`
içindeki `matched/updated/total` ve `tradingviewAvailable` alanları eşleşen olay,
aktarılmış sonuç ve TradingView erişimini gösterir. Sonuç yokluğu takvim listesi
yokluğu ile aynı kabul edilmez.

Etkin takvim tüm durumlarda Render üzerinden geçer; Next.js'teki bir anahtar,
sonuç eşleştirmesini atlayan doğrudan bir yola geçirmez.

Regresyon testleri kullanıcının gerçek yanıtından alınmış kayıtları kullanır;
`lib/fixtures/eulerpool-calendar.json` API anahtarı içermez. Backend testleri
ortak önbellek/eşzamanlı ziyaretçi, anahtar konumu, token gizliliği, kesinti ve gün
sınırını; Next.js testleri Render üzerinden gerçek alanların dönüştürülmesini
kontrol eder.

`backend/fixtures/calendar_hybrid.json`, kullanıcının gerçek Eulerpool ve
TradingView yanıtlarından dört takvim olayı ile yedi sonuç kaydını içerir.
Testlerde bu dört olayın sonuçları doğru eşleşir; saat/başlık/beklenti korunur.
