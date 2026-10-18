const terminalHaberleri = [
  { baslik: "Örnek: Küresel piyasalarda haftanın gündemi", kaynak: "Örnek", zaman: "14:50" },
  { baslik: "Örnek: Merkez bankası toplantı özeti", kaynak: "Örnek", zaman: "14:21" },
  { baslik: "Örnek: Petrol fiyatlarında yeni hareket", kaynak: "Örnek", zaman: "13:47" },
  { baslik: "Örnek: Teknoloji hisselerinde işlem hacmi", kaynak: "Örnek", zaman: "12:55" },
  { baslik: "Örnek: Altın için yeni fiyat beklentileri", kaynak: "Örnek", zaman: "12:10" },
  { baslik: "Örnek: Kripto piyasasında günlük özet", kaynak: "Örnek", zaman: "11:32" },
];

export default function TerminalBox() {
  return (
    <aside className="kap terminal">
      <div className="kap-baslik">
        <span>Terminal</span>
        <span className="kap-etiket">Örnek veri</span>
      </div>

      <div className="kap-liste">
        {terminalHaberleri.map((t, i) => (
          <div key={i} className="kap-satir">
            <div className="kap-ust">
              <strong>{t.kaynak}</strong>
              <span>{t.zaman}</span>
            </div>
            <p>{t.baslik}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}