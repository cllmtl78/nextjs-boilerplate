import os
import re
import time
import threading
from datetime import datetime, timezone, timedelta
import feedparser
from bs4 import BeautifulSoup
import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="BPT Terminal Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------------------------------------------
# 1. BELLEK ALANLARI (BİRBİRİNDEN TAMAMEN AYRI HAVUZLAR)
# ----------------------------------------------------
NEWS_CACHE = []  # Sadece BIST Türkçe Ekonomi Haberleri
KAP_CACHE = []   # Sadece Resmi KAP Bildirimleri

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

# ----------------------------------------------------
# 2. TÜRKÇE EKONOMİ HABERLERİ BOTU
# ----------------------------------------------------
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

def clean_html(raw_html):
    if not raw_html:
        return ""
    soup = BeautifulSoup(raw_html, "html.parser")
    text = soup.get_text(separator=" ").strip()
    return re.sub(r"\s+", " ", text)

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

            if source.get("filter_eco"):
                cats = [c.get("term", "").lower() for c in getattr(entry, "tags", []) if isinstance(c, dict)]
                link = getattr(entry, "link", "").lower()
                is_eco = any("ekonomi" in c for c in cats) or ("/ekonomi" in link)
                if not is_eco:
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
        print(f"[{source['badge']}] Hata:", e)
    return items

def news_worker():
    """Arka planda 20 saniyede bir Türkçe haberleri çeker"""
    global NEWS_CACHE
    while True:
        try:
            all_collected = []
            threads = []
            results = [[] for _ in SOURCES]

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
                seen = set()
                unique_news = []
                for n in all_collected:
                    key = re.sub(r"[^a-zA-Z0-9çğıöşüÇĞİÖŞÜ]", "", n["baslik"].lower())[:35]
                    if key not in seen:
                        seen.add(key)
                        unique_news.append(n)

                unique_news.sort(key=lambda x: x["timestamp"], reverse=True)
                NEWS_CACHE = unique_news
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Türkçe Haberler Güncellendi: {len(NEWS_CACHE)} adet")
        except Exception as e:
            print("News Worker Hatası:", e)
        time.sleep(20)

# ----------------------------------------------------
# 3. KAP BİLDİRİMLERİ BOTU
# ----------------------------------------------------
def extract_kap_time(raw_time):
    if not raw_time:
        return "--:--"
    raw_str = str(raw_time).strip()
    if "T" in raw_str:
        return raw_str.split("T")[-1][:8]
    if len(raw_str) >= 8:
        return raw_str[-8:]
    return "--:--"

def kap_worker():
    """Arka planda 15 saniyede bir KAP bildirimlerini çeker"""
    global KAP_CACHE
    while True:
        try:
            today_str = datetime.now().strftime("%Y-%m-%d")
            url = f"https://www.kap.org.tr/tr/api/disclosures?fromDate={today_str}&toDate={today_str}&_t={int(time.time()*1000)}"
            res = requests.get(url, headers=HEADERS, timeout=8)
            
            if res.status_code == 200:
                raw_data = res.json()
                if isinstance(raw_data, list):
                    parsed = []
                    for item in raw_data[:40]:
                        basic = item.get("basic", item)
                        disc_id = basic.get("disclosureIndex") or basic.get("id") or basic.get("disclosureId")
                        if not disc_id:
                            continue

                        raw_time = basic.get("publishDate") or basic.get("disclosureTime") or ""
                        time_str = extract_kap_time(raw_time)

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

                    # En büyük ID = En yeni KAP
                    parsed.sort(key=lambda x: x["id"], reverse=True)
                    KAP_CACHE = parsed
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] KAP Bildirimleri Güncellendi: {len(KAP_CACHE)} adet")
        except Exception as e:
            print("KAP Worker Hatası:", e)
        time.sleep(15)

# ----------------------------------------------------
# 4. WORKER'LARIN BAŞLATILDIĞI YER (İŞTE BURASI!)
# ----------------------------------------------------
threading.Thread(target=news_worker, daemon=True).start()  # Türkçe haber döngüsü başlar
threading.Thread(target=kap_worker, daemon=True).start()   # KAP bildirim döngüsü başlar

# ----------------------------------------------------
# 5. FRONTEND İÇİN AYRI AYRI API UÇ NOKTALARI
# ----------------------------------------------------
@app.get("/")
def health():
    return {
        "status": "running",
        "news_count": len(NEWS_CACHE),
        "kap_count": len(KAP_CACHE)
    }

# 1. KUTU İÇİN (BIST & Türkiye Paneli):
@app.get("/api/bist-news")
def get_bist_news():
    return {
        "status": "ok",
        "count": len(NEWS_CACHE),
        "data": NEWS_CACHE
    }

# 2. KUTU İÇİN (KAP Bildirimleri Paneli):
@app.get("/api/kap")
def get_kap_disclosures():
    return {
        "status": "ok",
        "count": len(KAP_CACHE),
        "data": KAP_CACHE
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("bist_news_bot:app", host="0.0.0.0", port=port)
