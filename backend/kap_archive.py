"""Keep every observed disclosure until Istanbul midnight, across worker restarts."""
import json
import os
import sqlite3
import threading
from pathlib import Path
from datetime import datetime

from news_day import TR, only_today


def default_path():
    global_path = os.environ.get("GLOBAL_NEWS_DB_PATH")
    directory = Path(global_path).parent if global_path and global_path != ":memory:" else Path(__file__).parent / ".data"
    return os.environ.get("KAP_NEWS_DB_PATH", str(directory / "kap.sqlite3"))


def merge_disclosures(previous, incoming, now=None):
    records = {}
    for item in only_today([*previous, *incoming], now):
        identity = str(item.get("id", ""))
        if not identity.isdigit():
            continue
        records[identity] = {**records.get(identity, {}), **item}
    return sorted(records.values(), key=lambda item: int(item["id"]), reverse=True)


class KapArchive:
    def __init__(self, path):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.connection = sqlite3.connect(str(path), check_same_thread=False)
        self.lock = threading.Lock()
        with self.connection:
            self.connection.execute("CREATE TABLE IF NOT EXISTS disclosures (id TEXT PRIMARY KEY, day TEXT NOT NULL, payload TEXT NOT NULL)")

    def update(self, incoming, now=None):
        now = (now or datetime.now(TR)).astimezone(TR)
        day = now.date().isoformat()
        with self.lock, self.connection:
            self.connection.execute("DELETE FROM disclosures WHERE day<>?", (day,))
            previous = [json.loads(row[0]) for row in self.connection.execute("SELECT payload FROM disclosures WHERE day=?", (day,))]
            records = merge_disclosures(previous, incoming, now)
            self.connection.executemany("INSERT OR REPLACE INTO disclosures VALUES(?,?,?)",
                                        [(str(item["id"]), day, json.dumps(item, ensure_ascii=False)) for item in records])
        return records

    def close(self):
        self.connection.close()
