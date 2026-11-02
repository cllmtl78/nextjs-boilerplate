import time
import threading
from datetime import datetime
import requests

KAP_CACHE = []

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

def extract_time_str(raw_time):
    if not raw_time:
        return "--:--"
    raw_str = str(raw_time).strip()
    if "T" in raw_str:
        return raw_str.split("T")[-1][:8]
    if len(raw_str) >= 8:
        return raw_str[-8:]
    return "--:--"

def fetch_kap_feed():
    global KAP_CACHE
    today_str = datetime.now().strftime("%Y-%m-%d")
    url = f"https://www.kap.org.tr/tr/api/disclosures?fromDate={today_str}&toDate={today_str}&_t={int(time.time()*1000)}"
    
    try:
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.status_code == 200:
            raw_data = res.json()
            if not isinstance(raw_data, list):
                return

            parsed = []
            for item in raw_data[:40]:
                basic = item.get("basic", item)
                disc_id = basic.get("disclosureIndex") or basic.get("id") or basic.get("disclosureId")
                if not disc_id:
                    continue

                raw_time = basic.get("publishDate") or basic.get("disclosureTime") or ""
                time_str = extract_time_str(raw_time)

                code = basic.get("stockCodes") or basic.get("stockCode") or basic.get("relatedStocks") or "BIST"
                if "," in code:
                    code = code.split(",")[0].strip()

                title = basic.get("companyTitle") or basic.get("companyName") or "KAP Bildirimi"
                subject = basic.get("title") or basic.get("disclosureTitle") or "Özel Durum Açıklaması"
                summary = basic.get("summary") or subject

                parsed.append({
                    "id": int(disc_id),
                    "code": code.strip().upper(),
                    "type": (basic.get("disclosureClass") or basic.get("disclosureType") or "ÖDA").upper(),
                    "title": title.strip(),
                    "subject": subject.strip(),
                    "summary": summary.strip(),
                    "time": time_str,
                    "url": f"https://www.kap.org.tr/tr/Bildirim/{disc_id}"
                })

            # ID'ye göre sırala: En büyük ID = En yeni KAP!
            parsed.sort(key=lambda x: x["id"], reverse=True)
            KAP_CACHE = parsed
            print(f"[{datetime.now().strftime('%H:%M:%S')}] KAP Bildirimleri güncellendi: {len(KAP_CACHE)} adet.")
    except Exception as e:
        print("KAP Fetch Hatası:", e)

def kap_worker():
    while True:
        fetch_kap_feed()
        time.sleep(15)  # 15 saniyede bir yeni KAP kontrolü

def start_kap_worker():
    t = threading.Thread(target=kap_worker, daemon=True)
    t.start()

def get_latest_kap():
    return KAP_CACHE
