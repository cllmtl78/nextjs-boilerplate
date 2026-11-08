# Resmî kurumlar — Nitter RSS

`official_news_bot.py` sekiz tanımlı hesabın `/{account}/rss` adresini beş dakikada
bir kontrol eder. `GET /api/official-news` bugünün (Europe/Istanbul) kendi
paylaşımlarını, hesap bazlı durum ve hata bilgisini döndürür. Retweet ve Nitter'ın
`R to` etiketlediği yanıtlar alınmaz. Metinler çevrilmez, HTML çalıştırılmaz;
kaynak bağlantısı asıl X paylaşımına gider. Görsel/video indirilmez.

Varsayılan sunucu: `https://nitter.mizuki.st` (kullanıcının RSS erişimini doğruladığı sunucu). Render backend ortam değişkeniyle
sunucu değiştirilebilir veya en fazla üç sunucu sırasıyla denenebilir:

```
NITTER_INSTANCES=https://nitter.mizuki.st,https://another-verified-instance.example
```

İkinci adres sadece biçim örneğidir; çalışan sunucu olarak eklemeyin. Herhangi
bir anahtar veya X oturum çerezi gerekmez. Boş/geçersiz ayar veri çekmez.

Loglar: `[Resmi] @hesap: N güncel paylaşım`, HTTP hatası, bağlantı hatası veya
geçersiz RSS. HTTP 200 dönen reklam/güvenlik sayfası başarı kabul edilmez.
Geçerli ama eski/boş RSS sıfır güncel kayıt sayılır. Bu durum sunucunun güncel
olduğunu tek başına kanıtlamaz; X profiliyle son paylaşım karşılaştırılmalıdır.

Kesintide o gün alınmış kayıtlar bellekte korunur; gece yarısı API ve arayüz
eski günü gizler. Servis yeniden başlarsa kayıtlar RSS'ten tekrar yüklenir;
RSS'in geçmiş sınırını aşan paylaşımlar için kalıcı arşiv garantisi yoktur.
Birden fazla Uvicorn worker ayrı bot çalıştırır; mevcut tek worker kullanılmalı.

## Doğrulama

```
python -m unittest discover -s backend -p test_official_news_bot.py
```

Önceki nitter.click kaynağının RSS adresi kullanıcıda 403 döndürdü.
Yeni mizuki.st kaynağı kullanıcı tarafından erişilebilir olarak bildirildi;
bu ortamdan canlı Nitter akışı doğrulanmadı. Deploy sonrası backend
logları ve `/api/official-news` yanıtı kontrol edilmeli. Backend ve frontend
birlikte deploy edilmelidir.

## BPT Finans

Aynı toplayıcı `bptfinans` hesabını da beş dakikada bir kontrol eder.
`GET /api/bpt-news` yalnızca bu hesabı döndürür; resmî hesaplar ve BPT durumları
birbirinden ayrıdır. BPT kayıtları `/api/official-news` içine karışmaz.
Metin ve orijinal X bağlantısı kullanılır; görseller, retweetler ve yanıtlar
alınmaz. Diğer akışlar gibi yalnızca Türkiye saatine göre bugünün kayıtları
gösterilir. Ön yüzde en yeni kart soldadır ve yatay kaydırılır; kart bağlantısı
modal açmadan yeni sekmede asıl tweete gider. Kaynak etiketi `[BPT FİNANS] X`.
Yeni kayıtlar mevcut isteğe bağlı haber zilini kullanır, ilk yükleme sessizdir.
Kullanıcı mizuki.st üzerindeki `/bptfinans/rss` adresinin çalıştığını doğruladı;
bu değişiklik canlı ağ yerine örnek RSS ve tarayıcı test verileriyle doğrulandı.
