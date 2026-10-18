const kapHaberleri = [
  { kod: "ÖRNK1", baslik: "Özel durum açıklaması", zaman: "14:32" },
  { kod: "ÖRNK2", baslik: "Finansal rapor bildirimi", zaman: "13:58" },
  { kod: "ÖRNK3", baslik: "Genel kurul toplantı çağrısı", zaman: "12:41" },
  { kod: "ÖRNK4", baslik: "Pay geri alım işlemi", zaman: "11:15" },
  { kod: "ÖRNK5", baslik: "Sözleşme imzalanması hakkında", zaman: "10:07" },
  { kod: "ÖRNK6", baslik: "Sermaye artırımı bildirimi", zaman: "09:30" },
];

export default function KapBox() {
  return (
    <aside className="kap">
      <div className="kap-baslik">
        <span>KAP Haberleri</span>
        <span className="kap-etiket">Örnek veri</span>
      </div>

      <div className="kap-liste">
        {kapHaberleri.map((k) => (
          <div key={k.kod} className="kap-satir">
            <div className="kap-ust">
              <strong>{k.kod}</strong>
              <span>{k.zaman}</span>
            </div>
            <p>{k.baslik}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}