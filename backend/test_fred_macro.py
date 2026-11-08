import os
import unittest
from unittest.mock import Mock, patch

import requests
import fred_macro as bot


class FredMacroTests(unittest.TestCase):
    def test_missing_values_and_non_finite_values_are_not_zero(self):
        parsed = bot.parse_observations({'observations': [
            {'date':'2026-11-06','value':'4.25'}, {'date':'2026-11-05','value':'.'},
            {'date':'2026-11-04','value':'NaN'}, {'date':'2026-11-03','value':'0'},
        ]})
        self.assertEqual(parsed, [{'date':'2026-11-03','value':0}, {'date':'2026-11-06','value':4.25}])
        with self.assertRaises(ValueError):
            bot.parse_observations({'observations':[{'date':'2026-11-06','value':'.'}]})

    def test_yearly_inflation_uses_same_calendar_month_not_row_offset(self):
        points = [{'date':'2025-10-01','value':100}, {'date':'2026-09-01','value':102}, {'date':'2026-10-01','value':103}]
        result = bot.annual_changes(points)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['date'], '2026-10-01')
        self.assertAlmostEqual(result[0]['value'], 3)

    def test_fed_range_requires_matching_dates(self):
        values = {'DFEDTARL':[{'date':'2026-11-05','value':4.0}],
                  'DFEDTARU':[{'date':'2026-11-05','value':4.25}, {'date':'2026-11-06','value':4.5}]}
        data = bot.build_metric(bot.METRICS[0], values, {})
        self.assertEqual((data['date'],data['low'],data['value']), ('2026-11-05',4.0,4.25))

    def test_basis_points_claims_and_balance_sheet_units(self):
        cases = [
            ('us-10y','DGS10',4.2,4.25,4.25,5),
            ('claims','ICSA',220000,230000,230,10),
            ('fed-balance','WALCL',6500000,6520000,6.52,20),
        ]
        for metric, series, previous, latest, expected, change in cases:
            meta = next(meta for meta in bot.METRICS if meta['id'] == metric)
            data = bot.build_metric(meta, {series:[{'date':'2026-11-05','value':previous},{'date':'2026-11-06','value':latest}]}, {})
            self.assertAlmostEqual(data['value'], expected)
            self.assertAlmostEqual(data['change'], change)

    def test_no_key_makes_no_requests_and_no_fake_values(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(bot, '_status', 'starting'), patch.object(bot, '_values', {}), patch.object(bot, '_errors', {}), patch.object(bot.requests,'get') as get:
            bot.poll_once()
            data = bot.get_macro_data()
            self.assertEqual(data['status'], 'not_configured')
            self.assertEqual(data['count'], 0)
            self.assertEqual(len(data['data']),9)
            self.assertTrue(all(item['value'] is None for item in data['data']))
            get.assert_not_called()

    def test_failed_fetch_preserves_data_and_never_logs_request_url_or_key(self):
        response = Mock(status_code=200)
        response.json.return_value = {'observations':[{'date':'2026-11-06','value':'4.25'}]}
        with patch.object(bot.requests, 'get', return_value=response):
            _, observations, error = bot.fetch_series('DGS2','fake-key')
            self.assertIsNone(error)
            self.assertEqual(observations[0]['value'],4.25)
        with patch.object(bot.requests, 'get', side_effect=requests.ReadTimeout('https://example/?api_key=secret-value')):
            _, observations, error = bot.fetch_series('DGS2','secret-value')
            self.assertIsNone(observations)
            self.assertNotIn('secret-value',error)
        meta = next(meta for meta in bot.METRICS if meta['id']=='us-2y')
        data = bot.build_metric(meta, {'DGS2':[{'date':'2026-11-06','value':4.25}]}, {'DGS2':'HTTP 429'})
        self.assertEqual(data['status'],'stale')
        self.assertEqual(data['date'],'2026-11-06')


if __name__ == '__main__':
    unittest.main()
