# BPT Finans post editörü

`/tasarim-bptfinans` tek şablonlu, mobil uyumlu bir editördür. Giriş gerektirmez;
arama motorlarında indekslenmemesi için sayfa metadata'sında `noindex` bulunur.
Fotoğraf ve metinler sunucuya gönderilmez; sayfa kapatıldığında saklanmaz.

## Şablon

Kullanıcının verdiği 1080 × 1350 Figma SVG'sinden sol şerit, BPT logosu, marka
yazısı, ikonlar ve mavi efekt korunmuştur. Kaynak SVG'deki haber metni ve konum
eğrileri kaldırılmış; bu iki alan Canvas üzerinde yeniden çizilir.
`public/post-template/template.svg` fotoğraf için yer tutucular içerir;
tek başına gösterilmek yerine `buildPostOverlay` tarafından sabit bir katmana
dönüştürülür. Fotoğraf bu katmanın altında ayrı çizilir.
Varsayılan fotoğraf aynı görselin WebP sürümüdür.

Metinler Rubik Bold (700), Rubik Regular (400); konum Rubik Medium (500)
kullanır. Değişken font ve OFL lisansı `public/post-template/fonts` içindedir.
Açıklama varsayılan olarak kalındır. Zengin metin alanında seçili bölümler
Kalın / İnce düğmeleriyle ayrı biçimlendirilebilir. Panodan yalnızca düz metin
alınır; HTML içeriği eklenmez. Satır sonları ve metin parçalarının kalınlıkları
PNG çıktısında korunur. Metin alanı y=876 konumunda başlar, 396 piksel yüksekliğe
kadar uzanır ve sağda 24 piksel pay bırakır.
Konum Türkçe büyük harfle yazılır. Haber açıklaması her zaman 39 px boyutunda kalır.
439 px yüksekliğindeki alana sığmıyorsa uyarı gösterilir ve indirme engellenir; metin otomatik küçültülmez.

## Fotoğraf ve indirme

JPG, PNG ve WebP desteklenir; dosya sınırı 20 MB'dir. Yeni fotoğraf merkeze
alınarak çerçeveyi doldurur. %50–%300 yakınlık, yatay/dikey kaydırıcılar ve
isteğe bağlı dokunmatik/fare sürükleme ile fotoğraf hareket ettirilebilir.
%100 altında koyu kenar boşlukları oluşabilir. Ortala düğmesi fotoğrafı
başlangıç kadrajına döndürür. Büyük görseller cihazda küçültülür. Yalnızca
fotoğraf değişir; mavi efekt ve marka katmanları şablondan korunur.

Önizleme ve PNG indirmesi aynı 1080 × 1350 Canvas'ı kullanır. Harici çeviri,
Figma API'si veya ücretli bir servis gerekmez. iOS'ta indirme Dosyalar /
İndirilenler bölümüne kaydedilebilir; otomatik Fotoğraflar'a kayıt yapılmaz.

## Kontrol

`lib/post-designer.test.ts` satır bölmenin sayıları, Türkçe ve Unicode
karakterleri koruduğunu kontrol eder. Tarayıcıda fotoğraf değiştirme, boş ve
uzun metin, konum, sıfırlama, çıktı boyutu, sabit marka katmanları ve mobil
ekranlar kontrol edilmelidir.

### Önizleme ve isteğe bağlı detaylar

Fotoğraf sürükleme varsayılan olarak açıktır. “Manuel sürükle” yakınlık ve konum kaydırıcılarını açar. Sürükleme olayları `requestAnimationFrame` ile birleştirilir; sabit katmanlar ve metin ayrı bir tuvalde önbelleğe alınır. Fotoğraf hareket ederken metin ölçümü ve satır düzeni tekrar hesaplanmaz; React konum durumu sürükleme bitince güncellenir.

Yeni SVG’den alınan `quote.svg` ve `swipe.svg` kaynak konumlarını korur. İki detay da başlangıçta kapalıdır ve PNG’ye önizlemeyle aynı şekilde eklenir. Tırnak işareti haber metninden önce çizilir; metnin arkasında kalır. Haber metni y=833 konumunda başlar; alt sınır korunur.

### Ek fotoğraf

“Üste fotoğraf ekle” ikinci bir yerel fotoğraf katmanı ekler. Ana fotoğraf yerinde kalır. Ek fotoğrafın boyutu tek Yakınlık kontrolüyle, en-boy oranı ve merkezi korunarak değiştirilir; köşe yuvarlaklığı ayrı ayarlanır; kırpma konumu iki eksende kaynak fotoğrafın sınırları içinde kalır. Sürükleme hedefi ana veya ek fotoğraf olarak seçilir. İkinci fotoğraf her zaman sabit mavi efekt, logo ve metinden önce çizilir; PNG ile önizleme aynı çizim yolunu kullanır. Kaldırma yalnızca ek fotoğrafı siler; genel sıfırlama tüm tasarımı başlangıca döndürür. Fotoğraflar ve düzenlemeler sayfa belleğinde tutulmaya devam eder.

Kırpma, isteğe bağlı yüklenen `react-advanced-cropper` penceresinde yapılır: taşınabilir ve köşelerinden boyutlandırılabilir çerçeve, serbest/sabit oranlar, fare tekerleği/dokunma ile yakınlaştırma ve fotoğraf kaydırma desteklenir. “Uygula” seçimi orijinal fotoğrafın koordinatları olarak saklar; tekrar kırpma kaynak görüntüyü korur. “Vazgeç” tasarımı değiştirmez. Çerçeve oranı uygulandığında ek fotoğrafın yüksekliği seçilen orana uyarlanır; konumu ve köşe yuvarlaklığı korunur. Pencere açıkken arka sayfanın kayması engellenir.

### Düzenleme sekmeleri

Fotoğraf ve açıklama ayarları masaüstü ve mobilde tek bir panel içinde iki sekmeye ayrılır. Başlangıç sekmesi “Haber Fotoğrafı”dır. “Haber Açıklaması” sekmesi metin, konum ve tasarım detaylarını içerir. Paneller sekme değişiminde kaldırılmaz; fotoğraf, kırpma, metin biçimi ve diğer ayarlar korunur. PNG ve sıfırlama eylemleri sekmelerin dışında ortak kalır. Sekmeler yön tuşları, Home ve End ile de seçilebilir. Masaüstünde önizleme daraltılmıştır; iki kart 690 px sabit yükseklikte eşitlenir. Mobilde ayar kartı 650 px yüksekliğindedir; önizleme ekran genişliğine göre sabit oranını korur. Sekmelerin içerikleri kendi içinde kayar, açıklama girişinin yüksekliği 190 px ile sabittir.

Enter/Backspace sonrasında oluşan iç içe DIV/P ve BR yapıları, satır sınırları korunarak okunur. Bloklar arasındaki sınırlar inline kalınlık etiketlerinin içinden de taşınır; tarayıcının boş satır BR yer tutucuları fazladan satır olarak eklenmez.
