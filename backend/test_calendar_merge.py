import copy
import json
import unittest
from pathlib import Path
from calendar_merge import merge_results

FIXTURE = json.loads((Path(__file__).parent / "fixtures/calendar_hybrid.json").read_text())


class CalendarMergeTests(unittest.TestCase):
    def test_real_eulerpool_schedule_is_filled_from_real_tradingview_results(self):
        before = copy.deepcopy(FIXTURE["eulerpool"])
        result, stats = merge_results(before, FIXTURE["tradingview"])
        self.assertEqual(len(result), len(before))
        self.assertEqual(stats["updated"], 4)
        by_name = {row["name"]: row for row in result}
        self.assertEqual(by_name["Household Spending YoY"]["actual_value"], -6.8)
        self.assertEqual(by_name["Household Spending MoM"]["actual_value"], -2.8)
        self.assertEqual(by_name["Bank Lending YoY"]["actual_value"], 5.2)
        self.assertAlmostEqual(by_name["Current Account"]["actual_value"], 2372.3)
        self.assertEqual(by_name["Current Account"]["actual_multiplier"], "1000000000")
        self.assertEqual(by_name["Current Account"]["actual_currency"], "¥")
        for old, new in zip(before, result):
            for field in ("timestamp", "name", "country_code", "reference_date", "previous_value", "consensus_value"):
                self.assertEqual(old[field], new[field])
            self.assertEqual(new["actual_source"], "tradingview")
        self.assertEqual(before, FIXTURE["eulerpool"])

    def test_wrong_country_period_frequency_and_ambiguous_events_never_fill_a_result(self):
        schedule = FIXTURE["eulerpool"]
        for change in ({"country": "CN"}, {"referencePeriod": "Oct 2026"}, {"title": "Household Spending Final"}):
            tv = [{**row, **change} for row in FIXTURE["tradingview"]]
            result, _ = merge_results(schedule, tv)
            # Country/final mismatches match nothing; changed period can only
            # match bank lending's genuine October period.
            spending = next(row for row in result if row["name"] == "Household Spending YoY")
            self.assertIsNone(spending["actual_value"])
        ambiguous = FIXTURE["tradingview"] + FIXTURE["tradingview"]
        result, stats = merge_results(schedule, ambiguous)
        self.assertEqual(stats["updated"], 0)
        self.assertTrue(all(row["actual_value"] is None for row in result))
        duplicate_schedule = [schedule[0], {**schedule[0], "timestamp": str(int(schedule[0]["timestamp"]) + 60000)}]
        _, stats = merge_results(duplicate_schedule, FIXTURE["tradingview"])
        self.assertEqual(stats["updated"], 0)

    def test_zero_is_a_published_result_and_is_retained_when_next_response_is_blank(self):
        tv = [{**row, "actual": 0, "actualRaw": 0} for row in FIXTURE["tradingview"]]
        result, stats = merge_results(FIXTURE["eulerpool"], tv)
        self.assertEqual(stats["updated"], 4)
        self.assertTrue(all(row["actual_value"] == 0 for row in result))
        retained, _ = merge_results(FIXTURE["eulerpool"], [], result)
        self.assertTrue(all(row["actual_value"] == 0 for row in retained))

    def test_year_boundary_alias_and_no_extra_tradingview_events(self):
        schedule = [{"name": "Exports YoY", "country_code": "cn", "timestamp": "1767317400000", "reference_date": "12", "actual_value": None, "actual_multiplier": "1", "previous_multiplier": "1"}]
        tv = [{"title": "Export Growth YoY", "country": "CN", "date": "2026-01-02T01:30:00Z", "referencePeriod": "Dec 2025", "actual": 4.2, "unit": "%"}]
        result, stats = merge_results(schedule, tv)
        self.assertEqual(stats["updated"], 1)
        self.assertEqual(result[0]["actual_value"], 4.2)
        self.assertEqual(len(result), 1)

    def test_missing_result_and_incompatible_currency_are_not_copied(self):
        tv = [{**row, "actual": None, "actualRaw": None} for row in FIXTURE["tradingview"]]
        result, stats = merge_results(FIXTURE["eulerpool"], tv)
        self.assertEqual(stats["updated"], 0)
        self.assertTrue(all(row["actual_value"] is None for row in result))
        tv = [{**row, "unit": "$"} for row in FIXTURE["tradingview"]]
        result, _ = merge_results(FIXTURE["eulerpool"], tv)
        current = next(row for row in result if row["name"] == "Current Account")
        self.assertIsNone(current["actual_value"])

    def test_display_scale_also_works_when_actual_raw_is_absent(self):
        tv = [{key: val for key, val in row.items() if key != "actualRaw"} for row in FIXTURE["tradingview"]]
        result, stats = merge_results(FIXTURE["eulerpool"], tv)
        self.assertEqual(stats["updated"], 4)
        current = next(row for row in result if row["name"] == "Current Account")
        self.assertAlmostEqual(current["actual_value"], 2372.3)
        self.assertEqual(current["actual_multiplier"], "1000000000")
