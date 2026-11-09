import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path

from kap_archive import KapArchive, merge_disclosures
from news_day import TR


class KapArchiveTests(unittest.TestCase):
    now = datetime(2026, 11, 9, 18, 0, tzinfo=TR)

    def item(self, identity, hour=9, **extra):
        return {"id": identity, "date": self.now.replace(hour=hour).isoformat(), **extra}

    def test_latest_forty_do_not_replace_morning_records(self):
        morning = [self.item(i) for i in range(1, 101)]
        latest = [self.item(i, 17) for i in range(101, 141)]
        result = merge_disclosures(morning, latest, self.now)
        self.assertEqual(len(result), 140)
        self.assertEqual(result[-1]["id"], 1)
        self.assertEqual(result[0]["id"], 140)
        self.assertEqual(merge_disclosures(result, [], self.now), result)

    def test_restart_deduplication_updates_and_midnight(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "kap.sqlite3"
            first = KapArchive(path)
            first.update([self.item(1, title="Old"), self.item(2)], self.now)
            first.close()
            restarted = KapArchive(path)
            result = restarted.update([self.item(1, title="Corrected")], self.now)
            self.assertEqual([item["id"] for item in result], [2, 1])
            self.assertEqual(result[-1]["title"], "Corrected")
            self.assertEqual(restarted.update([], self.now + timedelta(days=1)), [])
            restarted.close()

    def test_rejects_yesterday_future_and_undated_records(self):
        result = merge_disclosures([], [self.item(1), {"id": 2},
            {"id": 3, "date": "2026-11-08T23:59:59+03:00"},
            {"id": 4, "date": "2026-11-10T00:00:00+03:00"}], self.now)
        self.assertEqual([item["id"] for item in result], [1])
