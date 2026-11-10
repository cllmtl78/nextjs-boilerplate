import json
import importlib
import os
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from datetime import datetime, timedelta

import requests
from news_day import TR
from treasury_debt import TreasuryDebt, parse_debt

FIXTURE = json.loads((Path(__file__).parent / "fixtures/treasury-debt.json").read_text())


class TreasuryDebtTests(unittest.TestCase):
    now = datetime(2026, 11, 10, 12, tzinfo=TR)

    def test_real_debt_values_dates_and_cents_are_preserved(self):
        rows = parse_debt(FIXTURE)
        self.assertEqual(len(rows), 100)
        self.assertEqual(rows[-1]["record_date"], "2026-11-06")
        self.assertEqual(rows[-1]["total_debt"], "40552751019092.61")
        self.assertEqual(rows[-1]["debt_held_public"], "32762925356629.47")
        self.assertEqual(rows[-1]["intragov_holdings"], "7789825662463.14")
        self.assertEqual(rows[0]["record_date"], "2026-06-17")

    def test_daily_cache_survives_restart_and_does_not_expose_key(self):
        response = SimpleNamespace(status_code=200, json=lambda: FIXTURE)
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {"EULERPOOL_API_KEY": "private-key"}), patch("treasury_debt.requests.get", return_value=response) as get:
            path = Path(folder) / "debt.json"
            store = TreasuryDebt(path)
            body, status = store.get(self.now)
            self.assertEqual(status, 200)
            self.assertEqual(body["daily_change"], "-3369765891.04")
            store.get(self.now + timedelta(hours=1))
            TreasuryDebt(path).get(self.now + timedelta(hours=2))
            self.assertEqual(get.call_count, 1)
            self.assertEqual(get.call_args.kwargs["params"], {"limit": 100, "token": "private-key"})
            self.assertNotIn("private-key", json.dumps(body))
            self.assertNotIn("private-key", path.read_text())
            store.get(self.now + timedelta(days=1))
            self.assertEqual(get.call_count, 2)

    def test_failure_retains_last_report_and_retries_only_after_cooldown(self):
        store = TreasuryDebt()
        response = SimpleNamespace(status_code=200, json=lambda: FIXTURE)
        with patch.dict(os.environ, {"EULERPOOL_API_KEY": "private-key"}), patch("treasury_debt.requests.get", return_value=response) as get, patch("treasury_debt.time.monotonic", return_value=0) as clock:
            store.get(self.now)
            clock.return_value = 900
            get.side_effect = requests.ConnectionError("token=private-key")
            body, status = store.get(self.now + timedelta(days=1))
            self.assertEqual(status, 200)
            self.assertEqual(body["status"], "stale")
            self.assertEqual(body["data"][-1]["record_date"], "2026-11-06")
            self.assertNotIn("private-key", json.dumps(body))
            clock.return_value = 950
            store.get(self.now + timedelta(days=1))
            self.assertEqual(get.call_count, 2)

    def test_missing_key_and_bad_data_do_not_create_fake_debt(self):
        with patch.dict(os.environ, {"EULERPOOL_API_KEY": ""}), patch("treasury_debt.requests.get") as get:
            body, status = TreasuryDebt().get(self.now)
            self.assertEqual(status, 503)
            self.assertEqual(body["data"], [])
            get.assert_not_called()
        for payload in ({}, [], [{"record_date": "2026-11-06", "total_debt": "NaN"}]):
            with self.assertRaises(ValueError):
                parse_debt(payload)

    def test_debt_route_exists_and_historical_insights_route_is_removed(self):
        with patch("bist_news_bot.start_bist_news_bot"), patch("kap_bot.start_kap_bot"), \
             patch("global_news_bot.start_global_news_bot"), patch("official_news_bot.start_official_news_bot"), \
             patch("crypto_news_bot.start_crypto_news_bot"), patch("fred_macro.start_fred_macro_bot"):
            main = importlib.import_module("main")
        paths = [route.path for route in main.app.routes]
        self.assertIn("/api/macro/us-debt", paths)
        self.assertNotIn("/api/macro/insights", paths)
