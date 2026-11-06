import re
import calendar
import hashlib
import time
import threading
import unicodedata
from datetime import datetime, timezone, timedelta
from urllib.parse import unquote, urlsplit
import requests
import feedparser
from bs4 import BeautifulSoup
from news_day import only_today
from bist_arrivals import record_arrivals

NEWS_CACHE = []

SOURCES = [
    {"badge": "AA FİNANS", "url": "https://www.aa.com.tr/tr/rss/default?cat=ekonomi"},
    {"badge": "EKONOMİM", "url": "https://www.ekonomim.com/rss", "categories": ("ekonomi", "finans"), "host": "ekonomim.com"},
    {"badge": "CNBC-E", "url": "https://www.cnbce.com/rss"},
    {"badge": "EKONOMİST", "url": "https://www.ekonomist.com.tr/rss"},
    {"badge": "FOREKS", "url": "https://www.foreks.com/rss"},
    {"badge": "NTV PARA", "url": "https://www.ntv.com.tr/ntvpara.rss"},
    {"badge": "TRT HABER", "url": "https://www.trthaber.com/sondakika.rss", "categories": ("ekonomi",), "host": "trthaber.com"},
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
        utc_ts = calendar.timegm(p_parsed)
        dt = datetime.fromtimestamp(utc_ts, tz=timezone.utc).astimezone(tz_tr)
        return dt.strftime("%H:%M:%S"), int(dt.timestamp() * 1000), dt
    return "--:--", None, None


def category_slug(value):
    text = str(value or "").casefold().replace("ı", "i")
    return "".join(char for char in unicodedata.normalize("NFKD", text) if not unicodedata.combining(char)).strip()


def matches_source_category(entry, source):
    allowed = source.get("categories")
    if not allowed:
        return True
    link = urlsplit(str(entry.get("link", "")))
    expected_host = source["host"]
    if link.hostname not in (expected_host, f"www.{expected_host}"):
        return False
    # RSS <category> appears in feedparser's tags; some feeds expose only a
    # section URL. Never guess a category from words in a headline.
    categories = [category_slug(tag.get("term", "")) for tag in entry.get("tags", []) if isinstance(tag, dict)]
    categories.append(category_slug(entry.get("category", "")))
    for category in categories:
        if category in allowed:
            return True
        path = [category_slug(part) for part in urlsplit(category).path.split("/") if part]
        if path and path[-1] in allowed:
            return True
    path = [category_slug(unquote(part)) for part in link.path.split("/") if part]
    # EKONOMİM: /ekonomi/... or /finans/...; TRT: /haber/ekonomi/...
    if path and path[0] in allowed:
        return True
    return len(path) > 1 and path[0] == "haber" and path[1] in allowed


def fetch_feed(source):
    items = []
    try:
        response = requests.get(source["url"], headers=HEADERS, timeout=(5, 10))
        response.raise_for_status()
        feed = feedparser.parse(response.content)
        if not feed.entries:
            return items

        tz_tr = timezone(timedelta(hours=3))
        today_date = datetime.now(tz=tz_tr).date()

        for entry in feed.entries:
            if not matches_source_category(entry, source):
                continue
            title = clean_html(getattr(entry, "title", ""))
            if not title or len(title) < 6:
                continue

            time_str, ts, dt_obj = parse_entry_time(entry)
            if dt_obj is None or dt_obj.date() != today_date:
                continue

            summary = clean_html(getattr(entry, "summary", "") or getattr(entry, "description", ""))
            link = getattr(entry, "link", "#")
            identity = str(getattr(entry, "id", "") or (link if urlsplit(str(link)).scheme in ("http", "https") else "") or title)

            items.append({
                "id": f"{source['badge'].lower()}_{hashlib.sha256(identity.encode('utf-8')).hexdigest()[:24]}",
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
    # Filter the entire feed before limiting, otherwise general-news items can
    # crowd economy stories out of the first 15 entries.
    return sorted(items, key=lambda item: item["timestamp"], reverse=True)[:15]


def sort_and_deduplicate(items):
    seen, result = set(), []
    for item in sorted(items, key=lambda item: (item.get("receivedAt", item["timestamp"]), item["timestamp"]), reverse=True):
        # Full headline: a common 35-character prefix does not mean same story.
        key = re.sub(r"[^\w]", "", item["baslik"].casefold())
        if key not in seen:
            seen.add(key)
            result.append(item)
    return result

def run_news_worker():
    global NEWS_CACHE
    while True:
        try:
            NEWS_CACHE = only_today(NEWS_CACHE)
            all_collected = []
            for src in SOURCES:
                all_collected.extend(record_arrivals(fetch_feed(src)))

            if all_collected:
                unique_news = sort_and_deduplicate(all_collected)
                NEWS_CACHE = only_today(unique_news)
                print(f"[{datetime.now().strftime('%H:%M:%S')}] [BIST Bot] {len(NEWS_CACHE)} haber hazır.")
        except Exception as e:
            print("[BIST Bot] Worker hatası:", e)
        time.sleep(20)

def start_bist_news_bot():
    t = threading.Thread(target=run_news_worker, daemon=True)
    t.start()

def get_bist_news_data():
    return only_today(NEWS_CACHE)
