import re
import time
import threading
from datetime import datetime, timezone, timedelta
import requests

KAP_CACHE = []

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://tr.tradingview.com",
    "Referer": "https://tr.tradingview.com/",
}

def fetch_kap_disclosures():
    tz_tr = timezone(timedelta(hours=3))
    results = []

    # DOĞRUDAN RESMİ KAP VERİ SAĞLAYICISI (Yurt dışı sunucu / Render IP engeli yoktur, haber içermez)
    url = f"https://news-headlines.tradingview.com/v2/view/headlines/symbol?client=web&lang=tr&market=TR&provider=kap&_={int(time.time()*1000)}"

    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        if res.status_code == 200:
            data = res.json()
            items = data.get("items", [])

            for it in items[:45]:
                raw_title = it.get("title", "").strip()
                if not raw_title:
                    continue

                # Bildirim zamanı (Türkiye saati)
                ts = it.get("published", int(time.time()))
                dt = datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(tz_tr)
                time_str = dt.strftime("%H:%M:%S")

                # 1. Hisse kodunu sembol listesinden al (Örn: BIST:THYAO -> THYAO)
                code = ""
                related = it.get("relatedSymbols", [])
                if related and isinstance(related, list):
                    sym = related[0].get("symbol", "")
                    code = sym.split(":")[-1].strip().upper()

                # 2. Başlığı ayrıştır -> Format: "KAP: THYAO [TÜRK HAVA YOLLARI A.O.] ÖZEL DURUM AÇIKLAMASI (GENEL)"
                clean_str = re.sub(r"^KAP:\s*", "", raw_title).strip()

                # Şirket unvanı köşeli parantez içindedir: [TÜRK HAVA YOLLARI A.O.]
                m_comp = re.search(r"\[(.*?)\]", clean_str)
                if m_comp:
                    company = m_comp.group(1).strip()
                    before_bracket = clean_str[:m_comp.start()].strip()
                    after_bracket = clean_str[m_comp.end():].strip()

                    if not code and before_bracket:
                        code = before_bracket.split(",")[0].replace(":", "").strip().upper()
                    subject = after_bracket if after_bracket else "Özel Durum Açıklaması"
                else:
                    company = clean_str
                    subject = clean_str

                if not code:
                    if "BORSA İSTANBUL" in company.upper() or "BIST" in company.upper():
                        code = "BIST"
                    elif "MERKEZİ KAYIT" in company.upper():
                        code = "MKK"
                    elif "SERMAYE PİYASASI" in company.upper():
                        code = "SPK"
                    else:
                        first_token = clean_str.split()[0].replace(":", "").strip().upper()
                        code = first_token if 3 <= len(first_token) <= 6 else "KAP"

                # Bildirim tipi (ÖDA, FR, DG vb.)
                disc_type = "ÖDA"
                if "FİNANSAL RAPOR" in subject.upper() or "FINANSAL RAPOR" in subject.upper():
                    disc_type = "FR"
                elif "DEVRE KESİCİ" in subject.upper() or "DEVRE KESICI" in subject.upper():
                    disc_type = "DK"
                elif "PAY ALIM" in subject.upper():
                    disc_type = "PAY"

                # Benzersiz bildirim ID'si ve bildirim detayı linki
                raw_id = str(it.get("id", ""))
                digits = re.sub(r"\D", "", raw_id)
                disc_id = int(digits[:9]) if digits else int(ts)

                story_path = it.get("storyPath", "")
                detail_url = f"https://tr.tradingview.com{story_path}" if story_path else "https://www.kap.org.tr/tr/"

                results.append({
                    "id": disc_id,
                    "code": code,
                    "type": disc_type,
                    "title": company if company else code,
                    "subject": subject,
                    "summary": f"{company} — {subject}" if company != subject else subject,
                    "time": time_str,
                    "url": detail_url,
                    "timestamp": ts
                })

            results.sort(key=lambda x: x["timestamp"], reverse=True)
            return results

    except Exception as e:
        print("[KAP Bot] Veri çekme hatası:", e)

    return []

def run_kap_worker():
    global KAP_CACHE
    while True:
        try:
            data = fetch_kap_disclosures()
            if data and len(data) > 0:
                KAP_CACHE = data
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [KAP Bot] {len(KAP_CACHE)} resmi KAP bildirimi çekildi.")
        except Exception as e:
            print("[KAP Bot] Worker hatası:", e)
        time.sleep(15)

def start_kap_bot():
    t = threading.Thread(target=run_kap_worker, daemon=True)
    t.start()

def get_kap_data():
    return KAP_CACHE
