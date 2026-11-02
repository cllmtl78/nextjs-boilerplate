from kap_bot import start_kap_worker, get_latest_kap
import os
import re
import time
import threading
from datetime import datetime, timezone, timedelta
import feedparser
from bs4 import BeautifulSoup
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="BPT BIST & TR News Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Canlı haber havuzu
NEWS_CACHE = []

# Taranacak Türkçe Ekonomi Kaynakları
SOURCES = [
    {"badge": "AA FİNANS", "url": "https://www.aa.com.tr/tr/rss/default?cat=ekonomi"},
    {"badge": "EKONOMİM", "url": "https://www.ekonomim.com/rss"},
    {"badge": "CNBC-E", "url": "https://www.cnbce.com/rss"},
    {"badge": "EKONOMİST", "url": "https://www.ekonomist.com.tr/rss"},
    {"badge": "FOREKS", "url": "https://www.foreks.com/rss"},
    {"badge": "NTV PARA", "url": "https://www.ntv.com.tr/ntvpara.rss"},
    {"badge": "DÜNYA", "url": "https://www.dunya.com/rss", "filter_eco": True},
    {"badge": "TÜRKİYE GAZETESİ", "url": "https://www.turkiyegazetesi.com.tr/rss", "filter_eco": True},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

def clean_html(raw_html):
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    text = soup.get_text(separator=" ").strip()
    return re.sub(r"\s+", " ", text)

def parse_entry_time(entry):
    # feedparser'ın parse ettiği published_parsed struct'ını al
    p_parsed = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
    tz_tr = timezone(timedelta(hours=3))
    
    if p_parsed:
        # UTC epoch'a çevir
        utc_ts = time.mktime(p_parsed)
        dt = datetime.fromtimestamp(utc_ts, tz=timezone.utc).astimezone(tz_tr)
        return dt.strftime("%H:%M:%S"), int(dt.timestamp() * 1000), dt
    
    now = datetime.now(tz=tz_tr)
    return now.strftime("%H:%M:%S"), int(now.timestamp() * 1000), now

def fetch_feed(source):
    items = []
    try:
        # Sunucu doğrudan bağlandığı için proxy engeli yok
        feed = feedparser.parse(source["url"], request_headers=HEADERS)
        if not feed.entries:
            return items

        tz_tr = timezone(timedelta(hours=3))
        today_date = datetime.now(tz=tz_tr).date()

        for entry in feed.entries[:15]:
            title = clean_html(getattr(entry, "title", ""))
            if not title or len(title) < 6:
                continue

            # Özel Kategori Filtresi (Dünya / Türkiye gazetesi için)
            if source.get("filter_eco"):
                cats = [c.get("term", "").lower() for c in getattr(entry, "tags", []) if isinstance(c, dict)]
                link = getattr(entry, "link", "").lower()
                is_eco = any("ekonomi" in c for c in cats) or ("/ekonomi" in link)
                if not is_eco:
                    continue

            time_str, ts, dt_obj = parse_entry_time(entry)

            # Sadece bugünün haberlerini filtrele
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
        print(f"[{source['badge']}] Hata:", e)
    return items

def news_worker():
    global NEWS_CACHE
    while True:
        try:
            all_collected = []
            threads = []
            results = [[] for _ in SOURCES]

            # Tüm haber kaynaklarını aynı anda paralel iş parçacığıyla (Thread) çek
            def worker(idx, src):
                results[idx] = fetch_feed(src)

            for i, src in enumerate(SOURCES):
                t = threading.Thread(target=worker, args=(i, src))
                threads.append(t)
                t.start()

            for t in threads:
                t.join(timeout=6.0)

            for r in results:
                all_collected.extend(r)

            if all_collected:
                # Başlığa göre mükerrerleri temizle
                seen = set()
                unique_news = []
                for n in all_collected:
                    key = re.sub(r"[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]", "", n["baslik"].lower())[:35]
                    if key not in seen:
                        seen.add(key)
                        unique_news.append(n)

                # En yeniden eskiye doğru kesin sayısal sıralama
                unique_news.sort(key=lambda x: x["timestamp"], reverse=True)
                NEWS_CACHE = unique_news
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Türkçe haberler güncellendi: {len(NEWS_CACHE)} haber hazır.")
        except Exception as e:
            print("Worker Ana Hatası:", e)
            
        time.sleep(20)  # Her 20 saniyede bir sessizce yenile

# Botu arka planda başlat
threading.Thread(target=news_worker, daemon=True).start()

# --- API ENDPOINT'LERİ ---
@app.get("/")
def health():
    return {"status": "ok", "service": "BIST News Engine", "count": len(NEWS_CACHE)}

@app.get("/api/bist-news")
def get_bist_news():
    return {
        "status": "ok",
        "count": len(NEWS_CACHE),
        "data": NEWS_CACHE
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("bist_news_bot:app", host="0.0.0.0", port=port)
