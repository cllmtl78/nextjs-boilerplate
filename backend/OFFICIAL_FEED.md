# Resmî kurumlar — Nitter RSS

`official_news_bot.py` sekiz tanımlı hesabın `/{account}/rss` adresini beş dakikada
bir kontrol eder. `GET /api/official-news` bugünün (Europe/Istanbul) kendi
paylaşımlarını, hesap bazlı durum ve hata bilgisini döndürür. Retweet ve Nitter'ın
`R to` etiketlediği yanıtlar alınmaz. Metinler çevrilmez, HTML çalıştırılmaz;
kaynak bağlantısı asıl X paylaşımına gider. Görsel/video indirilmez.

Varsayılan sıra: `https://nitter.pp.ua` → `https://shitter.thepixora.com` →
`https://nitter.netbub.com`. HTTP/bağlantı hatası veya geçersiz RSS yanıtında
sıradaki sunucu denenir; ilk geçerli RSS yanıtında durulur. Render backend ortam
değişkeniyle bu sıra değiştirilebilir (en fazla üç sunucu):

```
NITTER_INSTANCES=https://nitter.pp.ua,https://shitter.thepixora.com,https://nitter.netbub.com
```

Herhangi bir anahtar veya X oturum çerezi gerekmez. Boş/geçersiz ayar veri çekmez.
Render'da eski `NITTER_INSTANCES` değeri varsa varsayılanları geçersiz kılar;
yeni sırayı kullanmak için değer güncellenmeli veya kaldırılmalıdır.
Sunucu değişse de paylaşım kimliği aynı kaldığından tekrarlar birleştirilir.

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
Yeni varsayılan sunucuların canlı erişilebilirliği garanti edilmez. Deploy sonrası backend
logları ve `/api/official-news` yanıtı kontrol edilmeli. Bu değişiklik için
yalnızca backend deploy edilmelidir.

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
