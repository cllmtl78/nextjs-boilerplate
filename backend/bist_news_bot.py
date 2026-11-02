import re
import time
import threading
from datetime import datetime, timezone, timedelta
import feedparser
from bs4 import BeautifulSoup

NEWS_CACHE = []

SOURCES = [
    {"badge": "AA FİNANS", "url": "https://www.aa.com.tr/tr/rss/default?cat=ekonomi"},
    {"badge": "EKONOMİM", "url": "https://www.ekonomim.com/rss"},
    {"badge": "CNBC-E", "url": "https://www.cnbce.com/rss"},
    {"badge": "EKONOMİST", "url": "https://www.ekonomist.com.tr/rss"},
    {"badge": "FOREKS", "url": "https://www.foreks.com/rss"},
    {"badge": "NTV PARA", "url": "https://www.ntv.com.tr/ntvpara.rss"},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

def clean_html(raw_html):
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    return re.sub(r"\s+", " ", soup.get_text(separator=" ").strip())

def parse_entry_time(entry):
    p_parsed = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
    tz_tr = timezone(timedelta(hours=3))
    if p_parsed:
        utc_ts = time.mktime(p_parsed)
        dt = datetime.fromtimestamp(utc_ts, tz=timezone.utc).astimezone(tz_tr)
        return dt.strftime("%H:%M:%S"), int(dt.timestamp() * 1000), dt
    now = datetime.now(tz=tz_tr)
    return now.strftime("%H:%M:%S"), int(now.timestamp() * 1000), now

def fetch_feed(source):
    items = []
    try:
        feed = feedparser.parse(source["url"], request_headers=HEADERS)
        if not feed.entries:
            return items

        tz_tr = timezone(timedelta(hours=3))
        today_date = datetime.now(tz=tz_tr).date()

        for entry in feed.entries[:15]:
            title = clean_html(getattr(entry, "title", ""))
            if not title or len(title) < 6:
                continue

            time_str, ts, dt_obj = parse_entry_time(entry)
            if dt_obj.date() != today_date:
                continue

            summary = clean_html(getattr(entry, "summary", "") or getattr(entry, "description", ""))
            link = getattr(entry, "link", "#")

            items.append({
                "id": f"{source['badge'].lower()}_{ts}_{hash(title) % 10000}",
                "zaman": time_str,
                "time": time_str,
                "tarih": "Bugün",
                "kaynak": source["badge"],
                "baslik": title,
                "ozet": summary[:250] if summary else title,
                "detay": summary if summary else title,
                "url": link,
                "kategori": "bist",
                "timestamp": ts,
            })
    except Exception as e:
        print(f"[BIST Bot] {source['badge']} hatası:", e)
    return items

def run_news_worker():
    global NEWS_CACHE
    while True:
        try:
            all_collected = []
            for src in SOURCES:
                all_collected.extend(fetch_feed(src))

            if all_collected:
                seen = set()
                unique_news = []
                for n in all_collected:
                    key = re.sub(r"[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]", "", n["baslik"].lower())[:35]
                    if key not in seen:
                        seen.add(key)
                        unique_news.append(n)

                unique_news.sort(key=lambda x: x["timestamp"], reverse=True)
                NEWS_CACHE = unique_news
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [BIST Bot] {len(NEWS_CACHE)} haber hazır.")
        except Exception as e:
            print("[BIST Bot] Worker hatası:", e)
        time.sleep(20)

def start_bist_news_bot():
    t = threading.Thread(target=run_news_worker, daemon=True)
    t.start()

def get_bist_news_data():
    return NEWS_CACHE
