"""Daily US national debt snapshot. Eulerpool credentials stay on Render."""
from datetime import datetime
from decimal import Decimal, InvalidOperation
import json
import os
from pathlib import Path
import tempfile
import threading
import time

import requests
from news_day import TR

FIELDS = ("total_debt", "debt_held_public", "intragov_holdings")


def parse_debt(payload):
    if not isinstance(payload, list):
        raise ValueError("Invalid debt response")
    result = {}
    for row in payload:
        try:
            day = datetime.strptime(row["record_date"], "%Y-%m-%d").date().isoformat()
            values = [Decimal(str(row[field])) for field in FIELDS]
            if not all(value.is_finite() and value >= 0 for value in values):
                continue
            if abs(values[0] - values[1] - values[2]) > Decimal("0.02"):
                continue
            result[day] = {"record_date": day, **{field: format(value, ".2f") for field, value in zip(FIELDS, values)}}
        except (ValueError, TypeError, KeyError, InvalidOperation):
            continue
    if not result:
        raise ValueError("No usable debt records")
    return [result[day] for day in sorted(result)][-100:]


def default_path():
    global_db = os.environ.get("GLOBAL_NEWS_DB_PATH")
    directory = Path(global_db).parent if global_db and global_db != ":memory:" else Path(__file__).parent / ".data"
    return os.environ.get("EULERPOOL_DEBT_CACHE_PATH", str(directory / "us-national-debt.json"))


class TreasuryDebt:
    def __init__(self, cache_path=None):
        self.path = Path(cache_path) if cache_path is not None else None
        self.lock = threading.Lock()
        self.loaded = False
        self.day = None
        self.last_checked = None
        self.records = []
        self.attempt_day = None
        self.retry_at = 0
        self.failure = "unavailable"

    def snapshot(self, status):
        previous = self.records[-2] if len(self.records) > 1 else None
        delta = Decimal(self.records[-1]["total_debt"]) - Decimal(previous["total_debt"]) if previous else None
        body = {"status": status, "source": "eulerpool", "last_checked": self.last_checked,
                "data": self.records, "count": len(self.records),
                "daily_change": format(delta, ".2f") if delta is not None else None,
                "previous_date": previous["record_date"] if previous else None}
        return body, 200 if self.records else 503

    def get(self, now=None):
        now = (now or datetime.now(TR)).astimezone(TR)
        day = now.date().isoformat()
        with self.lock:
            if not self.loaded:
                self.loaded = True
                if self.path is not None:
                    try:
                        cached = json.loads(self.path.read_text())
                        self.records = parse_debt(cached["data"])
                        self.day, self.last_checked = cached["day"], cached["last_checked"]
                    except (OSError, ValueError, KeyError, TypeError):
                        pass
            if self.day == day and self.records:
                return self.snapshot("ok")
            if self.attempt_day != day:
                self.attempt_day, self.retry_at = day, 0
            if time.monotonic() < self.retry_at:
                return self.snapshot("stale" if self.records else self.failure)
            key = os.environ.get("EULERPOOL_API_KEY", "").strip()
            if not key:
                return self.snapshot("stale" if self.records else "not_configured")
            self.retry_at = time.monotonic() + 900
            self.last_checked = now.isoformat()
            try:
                response = requests.get("https://api.eulerpool.com/api/1/government/treasury/debt",
                                        params={"limit": 100, "token": key}, headers={"Accept": "application/json"}, timeout=(3, 10))
                if response.status_code != 200:
                    raise ValueError("upstream status")
                self.records = parse_debt(response.json())
                self.day = day
            except (requests.RequestException, ValueError):
                # Exceptions can include token-bearing URLs; never return/log them.
                self.failure = "unavailable"
                return self.snapshot("stale" if self.records else self.failure)
            if self.path is not None:
                temporary = None
                try:
                    self.path.parent.mkdir(parents=True, exist_ok=True)
                    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=self.path.parent, delete=False) as output:
                        temporary = Path(output.name)
                        json.dump({"day": self.day, "last_checked": self.last_checked, "data": self.records}, output)
                    os.replace(temporary, self.path)
                except OSError:
                    pass  # A writable disk is optional; memory caching still applies.
                finally:
                    if temporary is not None:
                        try:
                            temporary.unlink(missing_ok=True)
                        except OSError:
                            pass
            return self.snapshot("ok")


debt = TreasuryDebt(default_path())
