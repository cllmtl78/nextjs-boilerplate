import re
import time
import threading
from datetime import datetime, timezone, timedelta
import feedparser
from bs4 import BeautifulSoup
import requests

KAP_CACHE = []

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

def clean_text(text: str) -> str:
    if not text:
        return ""
    soup = BeautifulSoup(text, "html.parser")
    cleaned = soup.get_text(separator=" ").strip()
    return re.sub(r"\s+", " ", cleaned)

def extract_code_from_title(title: str) -> str:
    # Başlıktaki [THYAO], (GARAN) veya ilk kelimedeki hisse kodunu yakalar
    m = re.search(r"\[([A-Z0-9]{3,6})\]|\(([A-Z0-9]{3,6})\)", title)
    if m:
        return m.group(1) or m.group(2)
    
    first_word = title.split()[0].replace(":", "").replace("-", "").strip() if title else ""
    if 3 <= len(first_word) <= 6 and first_word.isupper():
        return first_word
    return "BIST"

def fetch_kap_rss():
    items = []
    # KAP Resmi Günlük Bildirim Akışı
    url = f"https://www.kap.org.tr/tr/rss/bildirimler?_={int(time.time()*1000)}"
    try:
        feed = feedparser.parse(url, request_headers=HEADERS)
        if not feed.entries:
            return items

        tz_tr = timezone(timedelta(hours=3))
        today_date = datetime.now(tz=tz_tr).date()

        for entry in feed.entries[:35]:
            title = clean_text(getattr(entry, "title", ""))
            link = getattr(entry, "link", "")
            summary = clean_text(getattr(entry, "summary", "") or getattr(entry, "description", ""))

            # Bildirim ID'sini linkten çıkar (örn: https://www.kap.org.tr/tr/Bildirim/1234567)
            id_match = re.search(r"/Bildirim/(\d+)", link)
            disc_id = int(id_match.group(1)) if id_match else int(time.time() * 1000)

            # Tarih ve saat ayrıştırma
            p_parsed = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
            if p_parsed:
                utc_ts = time.mktime(p_parsed)
                dt = datetime.fromtimestamp(utc_ts, tz=timezone.utc).astimezone(tz_tr)
                time_str = dt.strftime("%H:%M:%S")
            else:
                dt = datetime.now(tz=tz_tr)
                time_str = dt.strftime("%H:%M:%S")

            # Şirket / Konu / Hisse Kodu ayrıştırma
            code = extract_code_from_title(title)
            
            # Başlık formatı genelde: "[KOD] ŞİRKET UNVANI - Konu" şeklindedir
            parts = title.split(" - ", 1)
            company_title = parts[0].strip() if len(parts) > 0 else title
            subject = parts[1].strip() if len(parts) > 1 else (summary[:100] or "Özel Durum Açıklaması")

            items.append({
                "id": disc_id,
                "code": code.upper(),
                "type": "ÖDA",
                "title": company_title,
                "subject": subject,
                "summary": summary if summary else subject,
                "time": time_str,
                "url": link if link else f"https://www.kap.org.tr/tr/Bildirim/{disc_id}"
            })

        # En yeni bildirim en üstte
        items.sort(key=lambda x: x["id"], reverse=True)
        return items
    except Exception as e:
        print("[KAP Bot] RSS Hatası:", e)
        return items

def run_kap_worker():
    global KAP_CACHE
    while True:
        try:
            data = fetch_kap_rss()
            if data and len(data) > 0:
                KAP_CACHE = data
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [KAP Bot] {len(KAP_CACHE)} resmi bildirim güncellendi.")
        except Exception as e:
            print("[KAP Bot] Worker Hatası:", e)
        time.sleep(15)

def start_kap_bot():
    t = threading.Thread(target=run_kap_worker, daemon=True)
    t.start()

def get_kap_data():
    return KAP_CACHE
