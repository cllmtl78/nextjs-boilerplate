# BPT Finans post editörü

`/tasarim-bptfinans` tek şablonlu, mobil uyumlu bir editördür. Giriş gerektirmez;
arama motorlarında indekslenmemesi için sayfa metadata'sında `noindex` bulunur.
Fotoğraf ve metinler sunucuya gönderilmez; sayfa kapatıldığında saklanmaz.

## Şablon

Kullanıcının verdiği 1080 × 1350 Figma SVG'sinden sol şerit, BPT logosu, marka
yazısı, ikonlar ve mavi efekt korunmuştur. Kaynak SVG'deki haber metni ve konum
eğrileri kaldırılmış; bu iki alan Canvas üzerinde yeniden çizilir.
`public/post-template/template.svg` fotoğraf için yer tutucular içerir;
tek başına gösterilmek yerine `buildPostBackground` tarafından hazırlanır.
Varsayılan fotoğraf aynı görselin WebP sürümüdür.

Metinler Rubik Bold (700), Rubik Regular (400); konum Rubik Medium (500)
kullanır. Değişken font ve OFL lisansı `public/post-template/fonts` içindedir.
Açıklamanın ilk paragrafı kalın, boş satırdan sonraki paragraflar normaldir.
Konum Türkçe büyük harfle yazılır. Çok uzun metin otomatik küçülür; minimum
boyutta hâlâ sığmıyorsa indirme engellenir, metin sessizce kesilmez.

## Fotoğraf ve indirme

JPG, PNG ve WebP desteklenir; dosya sınırı 20 MB'dir. Yeni fotoğraf merkeze
alınarak çerçeveyi doldurur. Büyük görseller cihazda küçültülür. Yalnızca
fotoğraf değişir; mavi efekt ve marka katmanları şablondan korunur.

Önizleme ve PNG indirmesi aynı 1080 × 1350 Canvas'ı kullanır. Harici çeviri,
Figma API'si veya ücretli bir servis gerekmez. iOS'ta indirme Dosyalar /
İndirilenler bölümüne kaydedilebilir; otomatik Fotoğraflar'a kayıt yapılmaz.

## Kontrol

`lib/post-designer.test.ts` satır bölmenin sayıları, Türkçe ve Unicode
karakterleri koruduğunu kontrol eder. Tarayıcıda fotoğraf değiştirme, boş ve
uzun metin, konum, sıfırlama, çıktı boyutu, sabit marka katmanları ve mobil
ekranlar kontrol edilmelidir.
