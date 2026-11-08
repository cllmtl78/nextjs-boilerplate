import unittest
from unittest.mock import Mock, patch

import requests
import tcmb_rates as bot


def xml():
    return ('<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="isokur.xsl"?>'
            '<Tarih_Date Tarih="06.11.2026">' + ''.join(
                f'<Currency CurrencyCode="{code}"><Unit>{100 if code == "JPY" else 1}</Unit>'
                '<ForexBuying>40.1234</ForexBuying><ForexSelling>40.4567</ForexSelling>'
                '<BanknoteBuying>1.0000</BanknoteBuying></Currency>' for code in bot.CURRENCIES)
            + '</Tarih_Date>').encode()


class TcmbTests(unittest.TestCase):
    def test_xml_date_eight_currencies_and_jpy_unit_preserved(self):
        data = bot.parse_rates(xml())
        self.assertEqual(data['date'], '2026-11-06')
        self.assertEqual([row['code'] for row in data['data']], list(bot.CURRENCIES))
        self.assertEqual(next(row['unit'] for row in data['data'] if row['code'] == 'JPY'), 100)
        self.assertEqual(data['data'][0]['buy'], '40.1234')

    def test_missing_quote_is_not_zero(self):
        data = bot.parse_rates(xml().replace(b'<ForexBuying>40.1234</ForexBuying>', b'<ForexBuying/>', 1))
        self.assertIsNone(data['data'][0]['buy'])

    def test_rejects_challenge_incomplete_and_invalid_numbers(self):
        for content in [b'<html>Check your browser</html>', xml().replace(b'CurrencyCode="USD"', b'CurrencyCode="ZZZ"'),
                        xml().replace(b'40.1234', b'NaN'), xml().replace(b'40.1234', b'-1'), b'<!DOCTYPE malicious><Tarih_Date/>']:
            with self.assertRaises((ValueError, KeyError)):
                bot.parse_rates(content)

    def test_cache_and_failed_refresh_keep_actual_publication_date(self):
        response = Mock(content=xml())
        with patch.object(bot, '_cache', None), patch.object(bot, '_next_attempt', 0), patch.object(bot, '_failed', False), patch.object(bot.time, 'monotonic', return_value=1000) as clock, patch.object(bot.requests, 'get', return_value=response) as get:
            first = bot.get_tcmb_rates()
            second = bot.get_tcmb_rates()
            self.assertEqual(get.call_count, 1)
            self.assertEqual(first['date'], second['date'])
            clock.return_value = 1400
            get.side_effect = requests.ReadTimeout()
            stale = bot.get_tcmb_rates()
            self.assertEqual(stale['status'], 'stale')
            self.assertEqual(stale['date'], '2026-11-06')
            self.assertEqual(stale['count'], 8)

    def test_initial_failure_explicitly_unavailable(self):
        with patch.object(bot, '_cache', None), patch.object(bot, '_next_attempt', 0), patch.object(bot, '_failed', False), patch.object(bot.requests, 'get', side_effect=requests.ReadTimeout()):
            data = bot.get_tcmb_rates()
            self.assertEqual(data['status'], 'unavailable')
            self.assertEqual(data['data'], [])


if __name__ == '__main__':
    unittest.main()
