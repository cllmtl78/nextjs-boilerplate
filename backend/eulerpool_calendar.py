"""Daily Eulerpool schedule; shared TradingView result checks every minute."""
import os
import json
import logging
from pathlib import Path
import tempfile
import threading
import time
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor

import requests
from news_day import TR
from calendar_merge import merge_results

FIELDS = ("timestamp", "name", "country_code", "full_day", "reference_date", *(
    f"{prefix}_{suffix}" for prefix in ("actual", "previous", "consensus", "forecast")
    for suffix in ("value", "currency", "multiplier")))


logger = logging.getLogger(__name__)


def default_cache_path():
    global_db = os.environ.get("GLOBAL_NEWS_DB_PATH")
    directory = Path(global_db).parent if global_db and global_db != ":memory:" else Path(__file__).parent / ".data"
    return os.environ.get("EULERPOOL_CALENDAR_CACHE_PATH", str(directory / "eulerpool-calendar.json"))


class ScheduleError(ValueError):
    pass


class EulerpoolCalendar:
    def __init__(self, cache_path=None):
        self.lock = threading.Lock()
        self.day = None
        self.next_check = 0
        self.cached = None
        self.last_success = None
        self.cache_path = Path(cache_path) if cache_path is not None else None
        self.schedule = None
        self.schedule_retry_at = 0
        self.schedule_error = "Eulerpool calendar connection failed"

    def load_schedule(self, day):
        self.schedule = None
        if self.cache_path is not None:
            try:
                cached = json.loads(self.cache_path.read_text())
                if cached.get("day") == day and isinstance(cached.get("records"), list) and isinstance(cached.get("fetchedAt"), str):
                    self.schedule = cached
            except (OSError, ValueError, AttributeError):
                pass

    def daily_schedule(self, day, start, key, now):
        if self.schedule is not None and self.schedule["day"] == day:
            return self.schedule
        if time.monotonic() < self.schedule_retry_at:
            raise ScheduleError(self.schedule_error)
        self.schedule_retry_at = time.monotonic() + 900
        try:
            response = requests.get("https://api.eulerpool.com/api/1/macro/calendar", params={
                "language": "en", "start": start, "end": start + 86_400_000 - 1,
                "countries": "tr,us,cn,jp", "token": key,
            }, headers={"Accept": "application/json"}, timeout=(3, 10))
            if response.status_code != 200:
                raise ScheduleError(f"Eulerpool calendar HTTP {response.status_code}")
            payload = response.json()
            if not isinstance(payload, list) or (payload and not any(
                isinstance(row, dict) and all(field in row for field in ("timestamp", "name", "country_code")) for row in payload
            )):
                raise ScheduleError("Eulerpool calendar response has an unsupported schema")
            records = [{field: row.get(field) for field in FIELDS} for row in payload if isinstance(row, dict)]
        except (requests.RequestException, ValueError) as exc:
            self.schedule_error = str(exc) if isinstance(exc, ScheduleError) else "Eulerpool calendar connection failed"
            raise ScheduleError(self.schedule_error) from None
        self.schedule = {"day": day, "records": records, "fetchedAt": now.isoformat()}
        if self.cache_path is not None:
            temporary = None
            try:
                self.cache_path.parent.mkdir(parents=True, exist_ok=True)
                with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=self.cache_path.parent, delete=False) as output:
                    temporary = Path(output.name)
                    json.dump(self.schedule, output, ensure_ascii=False)
                os.replace(temporary, self.cache_path)
            except OSError:
                logger.warning("[Takvim] Günlük takvim diske kaydedilemedi; bellek önbelleği kullanılıyor")
            finally:
                if temporary is not None:
                    try:
                        temporary.unlink(missing_ok=True)
                    except OSError:
                        pass
        return self.schedule

    def get(self, now=None):
        now = (now or datetime.now(TR)).astimezone(TR)
        day = now.date().isoformat()
        with self.lock:
            key = os.environ.get("EULERPOOL_API_KEY", "").strip()
            if not key:
                return {"success": False, "source": "eulerpool", "date": day,
                        "eulerpoolKeyConfigured": False, "error": "EULERPOOL_API_KEY is not configured on the backend"}, 503
            if self.day == day and time.monotonic() < self.next_check and self.cached:
                return self.cached
            if self.day != day:
                self.last_success = None
                self.schedule_retry_at = 0
                self.load_schedule(day)
            self.day = day
            self.next_check = time.monotonic() + 60
            start = int(now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
            error = "Eulerpool calendar connection failed"
            previous = self.last_success
            with ThreadPoolExecutor(max_workers=1) as pool:
                tv_future = pool.submit(fetch_tradingview_results, start)
                try:
                    schedule = self.daily_schedule(day, start, key, now)
                    result = {"success": True, "source": "eulerpool", "date": day,
                              "eulerpoolKeyConfigured": True, "records": schedule["records"],
                              "fetchedAt": now.isoformat(), "scheduleFetchedAt": schedule["fetchedAt"], "stale": False}
                except ScheduleError as exc:
                    error = str(exc)
                    result = {**previous, "stale": True} if previous else None
                try:
                    tradingview = tv_future.result()
                    available = True
                except (requests.RequestException, ValueError):
                    tradingview, available = [], False
                if result is not None:
                    merged, stats = merge_results(result["records"], tradingview, previous["records"] if previous else [])
                    result = {**result, "records": merged, "resultSource": "tradingview",
                              "matching": {**stats, "tradingviewAvailable": available}}
                    self.last_success = result
                    self.cached = (result, 200)
                else:
                    self.cached = ({"success": False, "source": "eulerpool", "date": day,
                                    "eulerpoolKeyConfigured": True, "error": error}, 503)
            return self.cached


def fetch_tradingview_results(start):
    # Query the same Istanbul day, including releases after 21:00 UTC yesterday.
    iso = lambda stamp: datetime.fromtimestamp(stamp / 1000, timezone.utc).isoformat().replace("+00:00", "Z")
    response = requests.get("https://economic-calendar.tradingview.com/events", params={
        "from": iso(start), "to": iso(start + 86_400_000 - 1),
        "countries": "TR,US,CN,JP", "minImportance": -1,
    }, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0", "Origin": "https://www.tradingview.com", "Referer": "https://www.tradingview.com/"}, timeout=(3, 5))
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict) or not isinstance(payload.get("result"), list):
        raise ValueError("Invalid TradingView result response")
    return payload["result"]


calendar = EulerpoolCalendar(default_cache_path())
