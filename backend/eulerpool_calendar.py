"""Server-owned Eulerpool key and one shared calendar request per minute."""
import os
import threading
import time
from datetime import datetime

import requests
from news_day import TR

FIELDS = ("timestamp", "name", "country_code", "full_day", "reference_date", *(
    f"{prefix}_{suffix}" for prefix in ("actual", "previous", "consensus", "forecast")
    for suffix in ("value", "currency", "multiplier")))


class EulerpoolCalendar:
    def __init__(self):
        self.lock = threading.Lock()
        self.day = None
        self.next_check = 0
        self.cached = None
        self.last_success = None

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
            self.day = day
            self.next_check = time.monotonic() + 60
            start = int(now.replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
            error = "Eulerpool calendar connection failed"
            try:
                response = requests.get("https://api.eulerpool.com/api/1/macro/calendar", params={
                    "language": "en", "start": start, "end": start + 86_400_000 - 1,
                    "countries": "tr,us,cn,jp", "token": key,
                }, headers={"Accept": "application/json"}, timeout=(3, 10))
                if response.status_code != 200:
                    error = f"Eulerpool calendar HTTP {response.status_code}"
                    raise ValueError("upstream status")
                payload = response.json()
                if not isinstance(payload, list) or (payload and not any(
                    isinstance(row, dict) and all(field in row for field in ("timestamp", "name", "country_code")) for row in payload
                )):
                    error = "Eulerpool calendar response has an unsupported schema"
                    raise ValueError("schema")
                records = [{field: row.get(field) for field in FIELDS} for row in payload if isinstance(row, dict)]
                result = {"success": True, "source": "eulerpool", "date": day,
                          "eulerpoolKeyConfigured": True, "records": records,
                          "fetchedAt": now.isoformat(), "stale": False}
                self.last_success = result
                self.cached = (result, 200)
            except (requests.RequestException, ValueError):
                # Exception text can contain the token-bearing request URL.
                if self.last_success:
                    self.cached = ({**self.last_success, "stale": True}, 200)
                else:
                    self.cached = ({"success": False, "source": "eulerpool", "date": day,
                                    "eulerpoolKeyConfigured": True, "error": error}, 503)
            return self.cached


calendar = EulerpoolCalendar()
