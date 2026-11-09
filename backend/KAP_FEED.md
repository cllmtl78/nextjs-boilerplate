# KAP gün içi arşivi

Worker, yeni bildirimleri kimliklerine göre günün mevcut listesiyle birleştirir.
Son 40 kayda kırpma yoktur. Aynı bildirimin yeni sürümü mevcut kaydı günceller;
geçici kaynak kesintileri gün içi listeyi silmez. Türkiye saatiyle gün değiştiğinde
önceki günün kayıtları hem API görünümünden hem arşivden çıkarılır.

Arşiv varsayılan olarak `backend/.data/kap.sqlite3` dosyasındadır.
`GLOBAL_NEWS_DB_PATH` ayarlanmışsa onun klasöründeki `kap.sqlite3` kullanılır.
`KAP_NEWS_DB_PATH` ile ayrıca dosya yolu seçilebilir. Yeniden dağıtımlar arasında
koruma için bu dosya kalıcı diskte olmalıdır; geçici dosya sistemi silinirse arşiv
de silinir. Disk kullanılamazsa worker kayıtları bellekte biriktirmeyi sürdürür.

Açılışta resmî KAP servisinin döndürdüğü eski bildirimler de alınmaya çalışılır.
Kaynakların artık sunmadığı ve daha önce arşivlenmemiş kayıtlar için geriye dönük
eksiksiz kurtarma garantisi yoktur. Tarayıcı da aynı güne ait alınmış kayıtlarını
kısa veya boş sunucu yanıtlarında korur.
