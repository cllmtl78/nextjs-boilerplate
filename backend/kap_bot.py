import re
import time
import threading
from datetime import datetime, timezone, timedelta
import feedparser
import requests
from bs4 import BeautifulSoup

KAP_CACHE = []

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

def clean_html(text: str) -> str:
    if not text:
        return ""
    soup = BeautifulSoup(text, "html.parser")
    cleaned = soup.get_text(separator=" ").strip()
    return re.sub(r"\s+", " ", cleaned)

def extract_code(text: str) -> str:
    # Metin içindeki [KOD], (KOD) veya büyük harfli hisse kodunu bulur
    m = re.search(r"\[([A-Z0-9]{3,6})\]|\(([A-Z0-9]{3,6})\)", text)
    if m:
        c = m.group(1) or m.group(2)
        if c not in ["KAP", "BIST", "ÖDA", "SON"]:
            return c
    parts = text.split()
    if parts:
        first = parts[0].replace(":", "").replace("-", "").strip()
        if 3 <= len(first) <= 6 and first.isupper() and first not in ["KAP", "BIST"]:
            return first
    return "BIST"

def fetch_kap_disclosures():
    items = []
    tz_tr = timezone(timedelta(hours=3))

    # 1. Kaynak: Foreks Finans Canlı KAP Akışı (Veri merkezlerine açık, engelsiz)
    try:
        url = "https://www.foreks.com/rss/kap-haberleri"
        feed = feedparser.parse(url, request_headers=HEADERS)
        if feed.entries:
            for entry in feed.entries[:30]:
                title = clean_html(getattr(entry, "title", ""))
                if not title:
                    continue
                
                link = getattr(entry, "link", "#")
                summary = clean_html(getattr(entry, "summary", "") or getattr(entry, "description", ""))
                
                # Tarih ve saat
                p_parsed = getattr(entry, "published_parsed", None)
                if p_parsed:
                    utc_ts = time.mktime(p_parsed)
                    dt = datetime.fromtimestamp(utc_ts, tz=timezone.utc).astimezone(tz_tr)
                    time_str = dt.strftime("%H:%M:%S")
                    ts = int(dt.timestamp() * 1000)
                else:
                    now = datetime.now(tz=tz_tr)
                    time_str = now.strftime("%H:%M:%S")
                    ts = int(now.timestamp() * 1000)

                # KAP ID yakalama (varsa linkten, yoksa timestamp'ten)
                id_match = re.search(r"/(\d{6,8})", link)
                disc_id = int(id_match.group(1)) if id_match else ts

                code = extract_code(title)

                items.append({
                    "id": disc_id,
                    "code": code.upper(),
                    "type": "ÖDA",
                    "title": title.split(" - ")[0] if " - " in title else title,
                    "subject": title,
                    "summary": summary[:250] if summary else title,
                    "time": time_str,
                    "url": link,
                    "timestamp": ts,
                })
            if items:
                return items
    except Exception as e:
        print("[KAP Bot] Foreks denemesi:", e)

    # 2. Kaynak (Yedek): Mynet Finans Doğrudan HTML Scrape
    try:
        url_my = "https://finans.mynet.com/borsa/kap-haberleri/"
        res = requests.get(url_my, headers=HEADERS, timeout=8)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, "html.parser")
            rows = soup.find_all("tr", class_=re.compile(r"kap|row|item", re.I)) or soup.find_all("li", class_=re.compile(r"kap", re.I))
            for r in rows[:25]:
                txt = clean_html(r.get_text(separator=" "))
                link_el = r.find("a")
                link = link_el["href"] if link_el and link_el.has_attr("href") else "#"
                if not link.startswith("http"):
                    link = "https://finans.mynet.com" + link
                
                t_match = re.search(r"(\d{2}:\d{2}(?::\d{2})?)", txt)
                time_str = t_match.group(1) if t_match else "--:--"
                
                code = extract_code(txt)
                disc_id = int(time.time() * 1000) + hash(txt) % 10000

                items.append({
                    "id": disc_id,
                    "code": code.upper(),
                    "type": "ÖDA",
                    "title": txt[:60],
                    "subject": txt,
                    "summary": txt,
                    "time": time_str if len(time_str) == 8 else f"{time_str}:00",
                    "url": link,
                    "timestamp": int(time.time() * 1000),
                })
            if items:
                return items
    except Exception as e:
        print("[KAP Bot] Mynet HTML denemesi:", e)

    return items

def run_kap_worker():
    global KAP_CACHE
    while True:
        try:
            results = fetch_kap_disclosures()
            if results:
                results.sort(key=lambda x: x.get("timestamp", 0), reverse=True)
                KAP_CACHE = results
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [KAP Bot] {len(KAP_CACHE)} bildirim hafızaya alındı.")
        except Exception as e:
            print("[KAP Bot] Worker hatası:", e)
        time.sleep(15)

def start_kap_bot():
    t = threading.Thread(target=run_kap_worker, daemon=True)
    t.start()

def get_kap_data():
    return KAP_CACHE
