# BIST haber saatleri

BIST kutusu sunucunun haberi ilk yakaladığı zamana göre sıralanır. `receivedAt` bu anın milisaniye zaman damgası; `time` ve `zaman` Türkiye saatindeki karşılığıdır. Aynı haber yeniden çekilince veya yayın saati güncellenince geliş saati değişmez. Yeni kaynakta aynı başlığın tekrarı da haberin yeniden yukarı çıkmasına neden olmaz.

Kaynak yayın zamanı `timestamp` ve `publishedAt` alanlarında korunur. `publishedTime` detayda gösterilir. Günlük filtre, geliş zamanı yerine kaynak yayın tarihini kontrol eder: dün yayımlanıp bugün RSS'e giren haber kutuya alınmaz. Günlük Türkiye saati 00.00 temizliği devam eder.

İlk taramada aynı anda keşfedilen haberlerin geliş saati aynıdır; eşitlikler kaynak yayın saatiyle sıralanır. Saat, kullanıcının tarayıcıyı açtığı anı değil backend'in ilk tespitini belirtir.

Geliş saatleri `backend/.data/bist-arrivals.sqlite3` dosyasında saklanır. `BIST_NEWS_DB_PATH` ile farklı bir dosya seçilebilir. `GLOBAL_NEWS_DB_PATH` bir kalıcı diske ayarlıysa BIST dosyası da varsayılan olarak aynı klasöre konur. Dosya korunduğu sürece yeniden başlatmalarda saatler sabit kalır; Render'ın geçici dosya sistemi silinirse ilk tespit geçmişi de sıfırlanır. Yedi günden eski saat kayıtları temizlenir.
