# Kur dönüştürücü

Header'daki turkuaz düğme native dialog açar. 22 yaygın para birimi, Türkçe
binlik/ondalık girişi (`1.000,50`), birimleri değiştirme ve sonucu kopyalama
bulunur. Tutar değişimi yerel hesaplanır; API'ye tutar gönderilmez. Negatif,
geçersiz, 6'dan fazla ondalıklı veya 1 trilyondan büyük tutarlar reddedilir.

Next.js `GET /api/currency-converter?from=USD&to=TRY`, sabit Frankfurter v2
`https://api.frankfurter.dev/v2/rate/USD/TRY` adresini kullanır. Şema resmî kaynak
kodundaki `lib/public/v2/openapi.json` ile doğrulandı:
https://github.com/lineofflight/frankfurter/blob/main/lib/public/v2/openapi.json

API anahtarı gerekmez. Çiftler izin verilen 22 para birimiyle sınırlandırılır.
Aynı para birimi kur 1 döndürür, dış isteğe gerek yoktur. Başarılı değerler
sunucu süreci içinde 15 dakika önbelleklenir (en fazla 100 çift); eşzamanlı aynı
çift istekleri birleştirilir. Hata sonrası 60 saniye beklenir. Son 24 saatte
alınmış kur varsa `stale:true` ile döndürülür; tarih değiştirilmez ve arayüz
uyarır. Önbellek yoksa 503 ve tekrar deneme seçeneği gösterilir. Çift değişince
eski çiftin sonucu gösterilmez; eski istek iptal edilir.

Bunlar günlük referans kurlardır; canlı fiyat, banka alış/satış fiyatı veya
komisyon dahil işlem teklifi değildir. TCMB kutucuğu ayrı kaynağını kullanmaya
devam eder. Kur tarihinde hafta sonu/tatil nedeniyle önceki iş günü olabilir.

Bu değişiklik Next.js uygulamasındadır; Render Python backend'inde yeni ortam
anahtarı gerektirmez. Frontend deploy'u gerekir. Canlı Frankfurter alanına
Cloud ağ filtresi CONNECT 403 döndürdüğünden canlı bağlantı doğrulanamadı;
OpenAPI, yerel hesaplama/API testleri ve tarayıcıda kontrollü yanıtlar kullanıldı.
Mobil/masaüstü 320,390,768,1440 genişliklerde, Türkçe tutar, ters çevirme,
kimlik kuru, hata/tekrar deneme ve Escape davranışları doğrulandı.

Testler:
`bun test lib/currency-converter.test.ts lib/currency-converter-api.test.ts`
