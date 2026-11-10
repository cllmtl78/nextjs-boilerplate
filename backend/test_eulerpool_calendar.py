import json
import os
import unittest
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import requests
from eulerpool_calendar import EulerpoolCalendar
from news_day import TR

FIXTURE = json.loads((Path(__file__).parent.parent / "lib/fixtures/eulerpool-calendar.json").read_text())


class CalendarBackendTests(unittest.TestCase):
    now = datetime(2026, 11, 9, 12, tzinfo=TR)

    def setUp(self):
        patcher = patch("eulerpool_calendar.fetch_tradingview_results", return_value=[])
        self.tradingview = patcher.start()
        self.addCleanup(patcher.stop)

    def test_hybrid_endpoint_keeps_eulerpool_schedule_and_reports_tradingview_results(self):
        hybrid = json.loads((Path(__file__).parent / "fixtures/calendar_hybrid.json").read_text())
        response = SimpleNamespace(status_code=200, json=lambda: hybrid["eulerpool"])
        self.tradingview.return_value = hybrid["tradingview"]
        with patch.dict(os.environ, {"EULERPOOL_API_KEY": "private-key"}), patch("eulerpool_calendar.requests.get", return_value=response):
            body, status = EulerpoolCalendar().get(datetime(2026, 11, 10, 12, tzinfo=TR))
        self.assertEqual(status, 200)
        self.assertEqual(body["source"], "eulerpool")
        self.assertEqual(body["resultSource"], "tradingview")
        self.assertEqual(body["matching"]["updated"], 4)
        self.assertTrue(body["matching"]["tradingviewAvailable"])
        self.assertTrue(all(row["actual_source"] == "tradingview" for row in body["records"]))

    def test_backend_key_and_exact_day_bounds_cached_for_all_visitors(self):
        calendar = EulerpoolCalendar()
        response = SimpleNamespace(status_code=200, json=lambda: FIXTURE)
        with patch.dict(os.environ, {"EULERPOOL_API_KEY": "private-key"}), patch("eulerpool_calendar.requests.get", return_value=response) as get, patch("eulerpool_calendar.time.monotonic", return_value=0) as clock:
            with ThreadPoolExecutor(max_workers=4) as pool:
                results = list(pool.map(lambda _: calendar.get(self.now), range(4)))
            self.assertEqual(get.call_count, 1)
            payload, status = results[0]
            self.assertEqual(status, 200)
            self.assertEqual(payload["records"][1]["actual_value"], 0)
            self.assertNotIn("private-key", json.dumps(payload))
            params = get.call_args.kwargs["params"]
            self.assertEqual(params["token"], "private-key")
            self.assertEqual(params["start"], 1794171600000)
            self.assertEqual(params["end"] - params["start"], 86399999)
            clock.return_value = 59
            calendar.get(self.now)
            self.assertEqual(get.call_count, 1)
            clock.return_value = 60
            calendar.get(self.now)
            self.assertEqual(get.call_count, 2)

    def test_missing_key_is_explicit_and_does_not_contact_eulerpool(self):
        with patch.dict(os.environ, {"EULERPOOL_API_KEY": ""}), patch("eulerpool_calendar.requests.get") as get:
            body, status = EulerpoolCalendar().get(self.now)
        self.assertEqual(status, 503)
        self.assertFalse(body["eulerpoolKeyConfigured"])
        get.assert_not_called()

    def test_outage_preserves_today_only_and_never_leaks_exception_urls(self):
        calendar = EulerpoolCalendar()
        response = SimpleNamespace(status_code=200, json=lambda: FIXTURE)
        with patch.dict(os.environ, {"EULERPOOL_API_KEY": "private-key"}), patch("eulerpool_calendar.requests.get", return_value=response) as get, patch("eulerpool_calendar.time.monotonic", return_value=0) as clock:
            original, _ = calendar.get(self.now)
            get.side_effect = requests.ConnectionError("https://api.eulerpool.com/?token=private-key")
            clock.return_value = 60
            stale, status = calendar.get(self.now)
            self.assertEqual(status, 200)
            self.assertTrue(stale["stale"])
            self.assertEqual(stale["records"], original["records"])
            failed, status = calendar.get(self.now + timedelta(days=1))
            self.assertEqual(status, 503)
            self.assertNotIn("records", failed)
            self.assertNotIn("private-key", json.dumps(failed))
