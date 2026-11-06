"""Stable first-observation times; publication timestamps stay untouched."""
import hashlib
import os
from pathlib import Path
import re
import sqlite3
import threading
from datetime import datetime, timedelta

from news_day import TR, only_today, publication_time


def default_path():
    global_path = os.environ.get("GLOBAL_NEWS_DB_PATH")
    directory = Path(global_path).parent if global_path and global_path != ":memory:" else Path(__file__).parent / ".data"
    return directory / "bist-arrivals.sqlite3"


class ArrivalStore:
    def __init__(self, path):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(str(path), check_same_thread=False)
        self.lock = threading.RLock()
        with self.connection:
            self.connection.execute("CREATE TABLE IF NOT EXISTS bist_arrivals (identity TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, day TEXT NOT NULL)")

    def close(self):
        self.connection.close()

    def stamp(self, items, now=None):
        now = (now or datetime.now(TR)).astimezone(TR)
        observed = int(now.timestamp() * 1000)
        result = []
        with self.lock, self.connection:
            for item in only_today(items, now):
                published = publication_time(item["timestamp"])
                day = published.date().isoformat()
                headline = re.sub(r"[^\w]", "", item["baslik"].casefold())
                digest = hashlib.sha256(headline.encode("utf-8")).hexdigest()
                keys = (f"id:{day}:{item['id']}", f"headline:{day}:{digest}")
                existing = dict(self.connection.execute("SELECT identity, first_seen FROM bist_arrivals WHERE identity IN (?,?)", keys).fetchall())
                first_seen = existing.get(keys[0], existing.get(keys[1], observed))
                for key in keys:
                    self.connection.execute("INSERT OR IGNORE INTO bist_arrivals VALUES(?,?,?)", (key, first_seen, day))
                clock = datetime.fromtimestamp(first_seen / 1000, TR).strftime("%H:%M:%S")
                result.append({**item, "receivedAt": first_seen, "publishedAt": item["timestamp"],
                               "publishedTime": item.get("publishedTime") or item.get("time") or item.get("zaman"),
                               "time": clock, "zaman": clock})
            self.connection.execute("DELETE FROM bist_arrivals WHERE day<?", ((now.date()-timedelta(days=7)).isoformat(),))
        return result


_store = None
_store_lock = threading.Lock()


def record_arrivals(items):
    global _store
    with _store_lock:
        if _store is None:
            _store = ArrivalStore(os.environ.get("BIST_NEWS_DB_PATH", str(default_path())))
    return _store.stamp(items)
