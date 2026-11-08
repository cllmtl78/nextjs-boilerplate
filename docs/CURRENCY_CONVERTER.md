# Kur dönüştürücü

Header'daki turkuaz düğme native dialog açar. Frankfurter aktif kataloğunun tamamı, Türkçe
binlik/ondalık girişi (`1.000,50`), birimleri değiştirme ve sonucu kopyalama
bulunur. Tutar değişimi yerel hesaplanır; API'ye tutar gönderilmez. Negatif,
geçersiz, 6'dan fazla ondalıklı veya 1 trilyondan büyük tutarlar reddedilir.

Next.js `GET /api/currency-converter?from=USD&to=TRY`, sabit Frankfurter v2
`https://api.frankfurter.dev/v2/rate/USD/TRY` adresini kullanır. Şema resmî kaynak
kodundaki `lib/public/v2/openapi.json` ile doğrulandı:
https://github.com/lineofflight/frankfurter/blob/main/lib/public/v2/openapi.json

API anahtarı gerekmez. `/api/currency-converter/currencies`, Frankfurter v2
`/currencies` kataloğunu alır; sabit 22 birim sınırı yoktur. Sağlayıcının aktif
para birimleri, metalleri ve kripto birimleri korunur. Güncel sayı kaynaktan
gelir; desteklenmeyen çiftler için sonuç uydurulmaz. Tarihî/legacy para birimleri
için `scope=all` kullanılmaz; bunlar güncel dönüşümün parçası değildir.
Katalog 24 saat önbelleklenir, hata durumunda en fazla 7 günlük katalog
`stale:true` ile korunur. Döviz çifti kataloğa üyelikle doğrulanır.
İsimler Türkçe Intl.DisplayNames ve yaygın ad eşlemeleriyle gösterilir; isim
bulunamazsa sağlayıcının adı korunur. Seçimler aşağı açılan özel menüdür:
üstte kod/ad arama, en fazla 280px genişlik, kaydırılan kısa liste, ok/Enter
ve Escape desteği bulunur. Türkçe harfler aramada normalleştirilir.
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
`bun test lib/currency-converter.test.ts lib/currency-converter-api.test.ts lib/currency-catalog.test.ts`
