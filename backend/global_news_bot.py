"""WalterBloomberg collection and Turkish translation, independent of API visitors."""
import hashlib
import html
import json
import logging
import os
from pathlib import Path
import re
import sqlite3
import threading
import time
from datetime import datetime, timedelta, timezone

import requests
from bs4 import BeautifulSoup, UnicodeDammit

logger = logging.getLogger(__name__)
TR = timezone(timedelta(hours=3))
SOURCE = "https://t.me/s/WalterBloomberg"
PROMPT = Path(__file__).with_name("global_translation_prompt.txt").read_text(encoding="utf-8")
PROMPT_REVISION = hashlib.sha256(PROMPT.encode("utf-8")).hexdigest()
DEFAULT_DB = Path(__file__).parent / ".data" / "global-news.sqlite3"


class ServiceHTTPError(RuntimeError):
    """Only an upstream name and status code, never request headers or bodies."""
    def __init__(self, source, status):
        super().__init__(f"{source} HTTP {int(status)}")


def failure_category(error):
    return str(error) if isinstance(error, ServiceHTTPError) else type(error).__name__


def clean_wire_text(text):
    text = html.unescape(text).replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"https?://[^\s<>()]+|\bwww\.[^\s<>()]+|\bt\.me/[^\s<>()]+", " ", text, flags=re.I)
    text = re.sub(r"\([^\S\n]*@WalterBloomberg[^\S\n]*\)|@WalterBloomberg\b", " ", text, flags=re.I)
    text = re.sub(r"\([^\S\n]*\)|\[[^\S\n]*\]", " ", text).replace("*", "")
    text = re.sub(r"\$([A-Z][A-Z0-9.]{0,9})\b", r"\1", text)
    lines = [re.sub(r"[^\S\n]+", " ", line).strip() for line in text.split("\n")]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()


def telegram_body_text(body):
    fragment = BeautifulSoup(str(body), "html.parser")
    for tag in fragment.select("br"):
        tag.replace_with("\n")
    for tag in fragment.select("p, div, li"):
        tag.insert_before("\n")
        tag.insert_after("\n")
    return clean_wire_text(fragment.get_text(" "))


def preserves_news_structure(source, translated):
    def paragraphs(text):
        return [part for part in text.split("\n\n") if part.strip()]

    def bullets(text):
        return sum(bool(re.match(r"^(?:[🔸🔹•▪●]\s*|[-–]\s+|\d+[.)]\s+)", line.strip())) for line in text.splitlines())

    return len(paragraphs(source)) == len(paragraphs(translated)) and bullets(source) == bullets(translated) and ("\n" not in source or "\n" in translated)


def day_bounds(now=None):
    now = now or datetime.now(TR)
    start = now.astimezone(TR).replace(hour=0, minute=0, second=0, microsecond=0)
    return int(start.timestamp() * 1000), int((start + timedelta(days=1)).timestamp() * 1000)


def parse_telegram_page(document):
    soup = BeautifulSoup(document, "html.parser")
    posts, ids, times = {}, [], []
    for node in soup.select("div[data-post]"):
        match = re.fullmatch(r"WalterBloomberg/(\d+)", node.get("data-post", ""), re.I)
        if not match:
            continue
        ids.append(int(match[1]))
        clock = node.select_one("time[datetime]")
        try:
            date = datetime.fromisoformat(clock["datetime"].replace("Z", "+00:00"))
            if date.tzinfo is None:
                continue
        except (ValueError, TypeError):
            continue
        timestamp = int(date.timestamp() * 1000)
        times.append(timestamp)
        body = node.select_one(".tgme_widget_message_text")
        text = telegram_body_text(body) if body else ""
        if len(text) < 3:
            continue
        post_id = f"WalterBloomberg/{int(match[1])}"
        posts[post_id] = {"id": post_id, "timestamp": timestamp,
                          "zaman": date.astimezone(TR).strftime("%H:%M:%S"), "rawText": text}
    return sorted(posts.values(), key=lambda item: item["timestamp"], reverse=True), min(ids) if ids else None, min(times) if times else None


class GlobalNewsStore:
    def __init__(self, path, model="gemini-2.5-flash"):
        self.model = model
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(str(path), check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.lock = threading.RLock()
        with self.connection:
            self.connection.executescript('''
                CREATE TABLE IF NOT EXISTS global_posts (
                    id TEXT PRIMARY KEY, timestamp INTEGER NOT NULL, time TEXT NOT NULL,
                    raw_text TEXT NOT NULL, digest TEXT NOT NULL, retry_at REAL NOT NULL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS global_translations (
                    digest TEXT PRIMARY KEY, text TEXT NOT NULL, saved_at REAL NOT NULL);
                CREATE INDEX IF NOT EXISTS global_post_date ON global_posts(timestamp);
            ''')
            for row in self.connection.execute("SELECT id,raw_text,digest FROM global_posts").fetchall():
                digest = self.digest(row["raw_text"])
                if digest != row["digest"]:
                    self.connection.execute("UPDATE global_posts SET digest=?,retry_at=0 WHERE id=?", (digest,row["id"]))

    def close(self):
        with self.lock:
            self.connection.close()

    def digest(self, text):
        return hashlib.sha256(f"walter-v3:{self.model}:{PROMPT_REVISION}:{clean_wire_text(text)}".encode("utf-8")).hexdigest()

    def upsert(self, posts):
        with self.lock, self.connection:
            for post in posts:
                digest = self.digest(post["rawText"])
                self.connection.execute('''INSERT INTO global_posts(id,timestamp,time,raw_text,digest)
                    VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET
                    timestamp=excluded.timestamp,time=excluded.time,raw_text=excluded.raw_text,
                    retry_at=CASE WHEN global_posts.digest=excluded.digest THEN global_posts.retry_at ELSE 0 END,
                    digest=excluded.digest''', (post["id"], post["timestamp"], post["zaman"], post["rawText"], digest))

    def rows(self, now=None):
        start, end = day_bounds(now)
        with self.lock:
            return self.connection.execute('''SELECT p.*,t.text AS translation FROM global_posts p
                LEFT JOIN global_translations t ON t.digest=p.digest
                WHERE p.timestamp>=? AND p.timestamp<? ORDER BY p.timestamp DESC LIMIT 200''', (start, end)).fetchall()

    def pending(self, now=None):
        seen, result = set(), []
        for row in self.rows(now):
            if not row["translation"] and row["retry_at"] <= time.time() and row["digest"] not in seen:
                seen.add(row["digest"])
                result.append({"id": row["id"], "text": row["raw_text"], "digest": row["digest"]})
                if len(result) >= 20:
                    break
        return result

    def save_translations(self, batch, rows):
        if not isinstance(rows, list):
            raise ValueError("Geçersiz çeviri yanıtı")
        expected = {item["id"]: item for item in batch}
        received = {}
        for row in rows:
            if not isinstance(row, dict) or not isinstance(row.get("text"), str) or row.get("id") not in expected or row["id"] in received:
                raise ValueError("Çeviri kimlikleri eşleşmiyor")
            received[row["id"]] = clean_wire_text(row["text"])
        count = 0
        with self.lock, self.connection:
            for item in batch:
                translated = received.get(item["id"], "")
                if translated and translated.casefold() != item["text"].casefold() and preserves_news_structure(item["text"], translated):
                    self.connection.execute("INSERT OR REPLACE INTO global_translations VALUES(?,?,?)", (item["digest"], translated, time.time()))
                    count += 1
                else:
                    self.connection.execute("UPDATE global_posts SET retry_at=? WHERE digest=?", (time.time() + 180, item["digest"]))
        return count

    def defer(self, batch):
        with self.lock, self.connection:
            self.connection.executemany("UPDATE global_posts SET retry_at=? WHERE digest=?", [(time.time()+180, item["digest"]) for item in batch])

    def snapshot(self, now=None):
        rows = self.rows(now)
        data = [{"id": row["id"], "timestamp": row["timestamp"], "zaman": row["time"],
                 "baslik": row["translation"]} for row in rows if row["translation"]]
        return {"status": "ok", "success": True, "count": len(data), "pending": len(rows)-len(data),
                "data": data, "items": data}

    def prune(self, now=None):
        current = now.timestamp() if now else time.time()
        with self.lock, self.connection:
            self.connection.execute("DELETE FROM global_posts WHERE timestamp<?", (int((current-7*86400)*1000),))
            self.connection.execute("DELETE FROM global_translations WHERE saved_at<?", (current-7*86400,))


class GlobalNewsBot:
    def __init__(self, store, session=None, translator=None):
        self.store = store
        self.session = session or requests.Session()
        self.translator = translator or self.translate
        self.day = None
        self.history_complete = False
        self.before = None

    def collect(self, now=None):
        start, end = day_bounds(now)
        if start != self.day:
            self.day, self.history_complete, self.before = start, False, None
        known = {row["id"] for row in self.store.rows(now)}
        cursor = None
        seen_today = set()
        deadline = time.monotonic() + 25
        for page in range(12):
            response = self.session.get(SOURCE, params={"before": cursor} if cursor is not None else {},
                                        headers={"User-Agent": "Mozilla/5.0", "Accept": "text/html"}, timeout=(5, 15))
            if response.status_code != 200:
                raise ServiceHTTPError("Telegram", response.status_code)
            try:
                document = response.content.decode("utf-8-sig")
            except UnicodeDecodeError:
                document = UnicodeDammit(response.content, is_html=True).unicode_markup
            if document is None:
                raise ValueError("Telegram HTML kodlaması okunamadı")
            posts, next_cursor, oldest = parse_telegram_page(document)
            if next_cursor is None:
                raise ValueError("Telegram mesaj yapısı bulunamadı")
            today = [post for post in posts if start <= post["timestamp"] < end]
            seen_today.update(post["id"] for post in today)
            self.store.upsert(today)
            if len(seen_today) >= 200 or (oldest is not None and oldest < start) or next_cursor == cursor:
                self.history_complete, self.before = True, None
                break
            if self.history_complete and any(post["id"] in known for post in today):
                break
            # Resume interrupted cold-start history after refreshing the latest page.
            cursor = self.before if page == 0 and self.before is not None and not self.history_complete else next_cursor
            self.before = cursor
            if time.monotonic() >= deadline:
                break

    def translate(self, batch):
        key = os.environ.get("GEMINI_API_KEY")
        if not key:
            raise ValueError("GEMINI_API_KEY eksik")
        model = self.store.model
        if not re.fullmatch(r"[A-Za-z0-9._-]+", model):
            raise ValueError("Geçersiz Gemini model adı")
        schema = {"type": "OBJECT", "properties": {"translations": {"type": "ARRAY", "items": {
            "type": "OBJECT", "properties": {"id": {"type": "STRING"}, "text": {"type": "STRING"}}, "required": ["id", "text"]}}}, "required": ["translations"]}
        response = self.session.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            headers={"Content-Type": "application/json", "x-goog-api-key": key}, timeout=(5, 25),
            json={"systemInstruction": {"parts": [{"text": PROMPT}]},
                  "contents": [{"role": "user", "parts": [{"text": json.dumps({"news": [{"id": item["id"], "text": item["text"]} for item in batch]}, ensure_ascii=False)}]}],
                  "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json", "responseSchema": schema}})
        if response.status_code != 200:
            raise ServiceHTTPError("Gemini", response.status_code)
        parts = response.json().get("candidates", [{}])[0].get("content", {}).get("parts", [])
        text = "".join(part.get("text", "") for part in parts)
        return json.loads(text).get("translations")

    def cycle(self, now=None):
        try:
            self.collect(now)
        except Exception as exc:
            logger.warning("[Global] Telegram toplama başarısız (%s); kayıtlı haberler korunuyor", failure_category(exc))
        batch = self.store.pending(now)
        if batch and (os.environ.get("GEMINI_API_KEY") or self.translator != self.translate):
            try:
                count = self.store.save_translations(batch, self.translator(batch))
                print(f"[Global] {count} WalterBloomberg haberi Türkçeye çevrildi.", flush=True)
            except Exception as exc:
                self.store.defer(batch)
                # Exception bodies may contain request metadata; log only safe category.
                logger.warning("[Global] Çeviri başarısız (%s). GEMINI_API_KEY, model ve kotayı kontrol edin.", failure_category(exc))
        self.store.prune(now)


_store = None
_store_lock = threading.RLock()
_worker = None
_stop = threading.Event()


def get_store():
    global _store
    with _store_lock:
        if _store is None:
            _store = GlobalNewsStore(os.environ.get("GLOBAL_NEWS_DB_PATH", str(DEFAULT_DB)), os.environ.get("GEMINI_MODEL", "gemini-2.5-flash"))
        return _store


def start_global_news_bot():
    global _worker
    with _store_lock:
        if _worker is not None and _worker.is_alive():
            return
        def run():
            try:
                bot = GlobalNewsBot(get_store())
            except Exception:
                logger.exception("[Global] Haber veritabanı başlatılamadı; GLOBAL_NEWS_DB_PATH ayarını kontrol edin")
                return
            if not os.environ.get("GEMINI_API_KEY"):
                logger.warning("[Global] GEMINI_API_KEY eksik. Telegram haberleri toplanacak; Türkçe çeviri anahtar eklenince çalışır.")
            while not _stop.is_set():
                try:
                    bot.cycle()
                except Exception:
                    logger.exception("[Global] Arka plan haber işçisi hatası")
                _stop.wait(30)
        _worker = threading.Thread(target=run, name="global-news-worker", daemon=True)
        _worker.start()


def get_global_news_data():
    return get_store().snapshot()
