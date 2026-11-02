import re
import time
import threading
from datetime import datetime
import requests

KAP_CACHE = []

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
}

def extract_ticker(title: str, company: str) -> str:
    full = f"{title} {company}"
    m = re.search(r"\[([A-Z0-9]{3,6})\]|\(([A-Z0-9]{3,6})\)|\b([A-Z]{4,5})\b", full)
    if m:
        code = m.group(1) or m.group(2) or m.group(3)
        if code not in ["KAP", "BIST", "SANAYI", "GENEL", "RAPOR"]:
            return code
    return "BIST"

def fetch_kap_disclosures():
    disclosures = []
    # 1. Öncelik: Mynet Finans Canlı KAP Akışı
    try:
        url = f"https://finans.mynet.com/api/kap/haberler?_={int(time.time()*1000)}"
        res = requests.get(url, headers=HEADERS, timeout=6)
        if res.status_code == 200:
            data = res.json()
            items = data.get("data") if isinstance(data, dict) else data
            if isinstance(items, list) and len(items) > 0:
                for item in items[:40]:
                    disc_id = item.get("id") or item.get("disclosureId") or item.get("disclosureIndex")
                    raw_time = item.get("date") or item.get("publishDate") or ""
                    
                    time_str = "--:--"
                    if " " in str(raw_time):
                        time_str = str(raw_time).split(" ")[-1][:8]
                    elif "T" in str(raw_time):
                        time_str = str(raw_time).split("T")[-1][:8]
                    elif len(str(raw_time)) >= 8:
                        time_str = str(raw_time)[-8:]

                    company = item.get("companyTitle") or item.get("companyName") or "KAP Bildirimi"
                    subject = item.get("subject") or item.get("title") or "Özel Durum Açıklaması"
                    
                    code = item.get("stockCode") or item.get("stockCodes") or ""
                    if not code or code in ["KAP", "BIST"]:
                        code = extract_ticker(subject, company)

                    disclosures.append({
                        "id": int(disc_id) if str(disc_id).isdigit() else int(time.time()),
                        "code": code.upper().strip(),
                        "type": (item.get("disclosureClass") or item.get("type") or "ÖDA").upper(),
                        "title": company.strip(),
                        "subject": subject.strip(),
                        "summary": item.get("summary") or subject.strip(),
                        "time": time_str,
                        "url": f"https://www.kap.org.tr/tr/Bildirim/{disc_id}" if str(disc_id).isdigit() else f"https://finans.mynet.com/haberler/detay/{disc_id}"
                    })
                return disclosures
    except Exception as e:
        print("[KAP Bot] Mynet hatası:", e)

    # 2. Öncelik (Yedek): Bigpara KAP Akışı
    try:
        url_bp = "https://bigpara.hurriyet.com.tr/api/v1/hisse/kaphaberleri"
        res = requests.get(url_bp, headers=HEADERS, timeout=6)
        if res.status_code == 200:
            data = res.json()
            for item in data.get("data", [])[:40]:
                disc_id = item.get("id")
                time_str = item.get("tarih", "")[-8:] if item.get("tarih") else "--:--"
                title = item.get("baslik", "")
                code = item.get("kod") or extract_ticker(title, "")
                
                disclosures.append({
                    "id": int(disc_id) if str(disc_id).isdigit() else int(time.time()),
                    "code": code.upper().strip(),
                    "type": "ÖDA",
                    "title": item.get("sirket", title),
                    "subject": title,
                    "summary": item.get("ozet", title),
                    "time": time_str,
                    "url": f"https://www.kap.org.tr/tr/Bildirim/{disc_id}" if str(disc_id).isdigit() else "#"
                })
            return disclosures
    except Exception as e:
        print("[KAP Bot] Bigpara hatası:", e)

    return disclosures

def run_kap_worker():
    global KAP_CACHE
    while True:
        try:
            items = fetch_kap_disclosures()
            if items:
                items.sort(key=lambda x: x["id"], reverse=True)
                KAP_CACHE = items
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [KAP Bot] {len(KAP_CACHE)} bildirim hazır.")
        except Exception as e:
            print("[KAP Bot] Worker hatası:", e)
        time.sleep(15)

def start_kap_bot():
    t = threading.Thread(target=run_kap_worker, daemon=True)
    t.start()

def get_kap_data():
    return KAP_CACHE
