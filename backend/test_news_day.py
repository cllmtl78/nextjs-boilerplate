import calendar
from datetime import datetime, timezone
import importlib
from pathlib import Path
import tempfile
import time
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import bist_news_bot
import kap_bot
from global_news_bot import GlobalNewsStore, TR
from news_day import is_today, only_today, publication_time

BEFORE = datetime(2026, 11, 6, 23, 59, 59, tzinfo=TR)
AFTER = datetime(2026, 11, 7, 0, 0, 0, tzinfo=TR)


class ClockDateTime(datetime):
    current = BEFORE

    @classmethod
    def now(cls, tz=None):
        return cls.current.astimezone(tz) if tz else cls.current.replace(tzinfo=None)


class NewsDayTests(unittest.TestCase):
    def test_date_parsing_and_unknown_clock(self):
        for value in [AFTER, AFTER.isoformat(), '2026-11-06T21:00:00Z', '07.11.2026 00:00', '07/11/2026 00:00:00',
                      '2026-11-07', AFTER.timestamp(), int(AFTER.timestamp()*1000)]:
            self.assertEqual(publication_time(value), AFTER)
        for value in [None, '', '23:59:59', 'Bugün', 'invalid', float('nan'), float('inf')]:
            self.assertIsNone(publication_time(value))

    def test_seconds_milliseconds_and_dates_change_at_istanbul_midnight(self):
        for record in [{'timestamp':BEFORE.timestamp()}, {'timestamp':int(BEFORE.timestamp()*1000)}, {'date':BEFORE.isoformat()}]:
            self.assertTrue(is_today(record, BEFORE))
            self.assertFalse(is_today(record, AFTER))
        self.assertTrue(is_today({'timestamp':int(AFTER.timestamp()*1000)}, AFTER))
        self.assertFalse(is_today({'time':'00:00:00'}, AFTER))

    def test_rss_time_is_utc_not_server_local_and_missing_date_is_not_today(self):
        published = time.gmtime(AFTER.timestamp())
        entry = SimpleNamespace(published_parsed=published)
        clock, stamp, date = bist_news_bot.parse_entry_time(entry)
        self.assertEqual(clock, '00:00:00')
        self.assertEqual(stamp, int(AFTER.timestamp()*1000))
        self.assertEqual(date, AFTER)
        self.assertEqual(calendar.timegm(published), AFTER.timestamp())
        self.assertIsNone(bist_news_bot.parse_entry_time(SimpleNamespace())[2])

    def test_all_apis_empty_at_midnight_even_when_sources_have_not_updated(self):
        with tempfile.TemporaryDirectory() as directory:
            store = GlobalNewsStore(Path(directory)/'news.sqlite3')
            old = {'id':'WalterBloomberg/1','timestamp':int(BEFORE.timestamp()*1000),'zaman':'23:59:59','rawText':'Yesterday news'}
            store.upsert([old])
            store.save_translations(store.pending(BEFORE), [{'id':old['id'],'text':'Dünkü haber.'}])
            with patch('bist_news_bot.start_bist_news_bot'), patch('kap_bot.start_kap_bot'), patch('global_news_bot.start_global_news_bot'), \
                 patch('official_news_bot.start_official_news_bot'), patch('crypto_news_bot.start_crypto_news_bot'), \
                 patch('fred_macro.start_fred_macro_bot'), patch('macroradar.start_macroradar_bot'):
                main = importlib.import_module('main')
            with patch('bist_news_bot.NEWS_CACHE',[{'id':'bist1','timestamp':int(BEFORE.timestamp()*1000)}]), \
                 patch('kap_bot.KAP_CACHE',[{'id':1694413,'timestamp':int(BEFORE.timestamp()*1000)}]), \
                 patch('global_news_bot.get_store',return_value=store), \
                 patch('news_day.datetime',ClockDateTime), patch('global_news_bot.datetime',ClockDateTime):
                ClockDateTime.current=BEFORE
                self.assertEqual(main.api_bist_news()['count'],1)
                self.assertEqual(main.api_kap()['count'],1)
                self.assertEqual(main.api_global_news()['count'],1)
                ClockDateTime.current=AFTER
                # No worker refresh and no network response is needed for reset.
                self.assertEqual(main.api_bist_news()['data'],[])
                self.assertEqual(main.api_kap()['data'],[])
                self.assertEqual(main.api_global_news()['data'],[])
                self.assertEqual(main.health()['bist_news_count'],0)
                self.assertEqual(main.health()['kap_count'],0)
            store.close()

    def test_late_yesterday_responses_cannot_repopulate_a_new_day(self):
        old={'timestamp':int(BEFORE.timestamp()*1000)}
        new={'timestamp':int(AFTER.timestamp()*1000)}
        self.assertEqual(only_today([old,new], AFTER),[new])

    def test_kap_official_fallback_also_requires_real_publication_date(self):
        response=SimpleNamespace(raise_for_status=lambda:None,json=lambda:[
            {'basic':{'id':1,'title':'Test','publishDate':'06.11.2026 23:59:59'}},
            {'basic':{'id':2,'title':'Test','publishDate':'07.11.2026 00:00:00'}},
            {'basic':{'id':3,'title':'Test','disclosureTime':'00:00:00'}},
        ])
        with patch('kap_bot.requests.get',return_value=response):
            records=kap_bot.fetch_official_kap()
        self.assertEqual([record['id'] for record in only_today(records, AFTER)],[2])
        self.assertEqual(next(record for record in records if record['id']==2)['timestamp'],int(AFTER.timestamp()*1000))


if __name__ == '__main__':
    unittest.main()
