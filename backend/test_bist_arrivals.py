from datetime import datetime
from pathlib import Path
import tempfile
import unittest

from bist_arrivals import ArrivalStore
from bist_news_bot import sort_and_deduplicate
from news_day import TR, only_today


def clock(hour, minute, day=6):
    return datetime(2026, 11, day, hour, minute, tzinfo=TR)


def news(identity, published, title=None):
    return {'id':identity,'baslik':title or f'Haber {identity}', 'timestamp':int(published.timestamp()*1000),
            'time':published.strftime('%H:%M:%S'),'zaman':published.strftime('%H:%M:%S')}


class ArrivalTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=Path(self.temp.name)/'arrivals.sqlite3'
        self.store=ArrivalStore(self.path)

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def test_1450_publication_arriving_at_1454_is_above_1452_arrival(self):
        previous=self.store.stamp([news('first',clock(14,52))],clock(14,52))[0]
        late=self.store.stamp([news('late',clock(14,50))],clock(14,54))[0]
        self.assertEqual(late['time'],'14:54:00')
        self.assertEqual(late['zaman'],'14:54:00')
        self.assertEqual(late['publishedTime'],'14:50:00')
        self.assertEqual(late['timestamp'],int(clock(14,50).timestamp()*1000))
        self.assertEqual(sort_and_deduplicate([previous,late]),[late,previous])

    def test_refetching_and_publication_corrections_never_refresh_first_seen(self):
        first=self.store.stamp([news('same',clock(14,50))],clock(14,54))[0]
        again=self.store.stamp([news('same',clock(14,55))],clock(15,0))[0]
        self.assertEqual(again['receivedAt'],first['receivedAt'])
        self.assertEqual(again['time'],'14:54:00')
        self.assertEqual(again['publishedTime'],'14:55:00')

    def test_disappearance_from_rss_then_reappearance_does_not_make_it_new(self):
        first=self.store.stamp([news('same',clock(14,50))],clock(14,54))[0]
        self.store.stamp([],clock(15,0))
        again=self.store.stamp([news('same',clock(14,50))],clock(16,0))[0]
        self.assertEqual(first['receivedAt'],again['receivedAt'])

    def test_title_revision_cannot_change_an_existing_articles_arrival(self):
        self.store.stamp([news('older',clock(14,40),'Başka haber')],clock(14,45))
        first=self.store.stamp([news('same',clock(14,50),'İlk başlık')],clock(14,54))[0]
        revised=self.store.stamp([news('same',clock(14,50),'Başka haber')],clock(15,0))[0]
        self.assertEqual(first['receivedAt'],revised['receivedAt'])

    def test_first_seen_survives_process_store_reopening(self):
        first=self.store.stamp([news('same',clock(14,50))],clock(14,54))[0]
        self.store.close()
        self.store=ArrivalStore(self.path)
        again=self.store.stamp([news('same',clock(14,50))],clock(16,0))[0]
        self.assertEqual(first['receivedAt'],again['receivedAt'])

    def test_same_story_from_another_source_does_not_jump_to_top(self):
        original=self.store.stamp([news('source-a',clock(14,50),'Aynı haber')],clock(14,54))[0]
        copy=self.store.stamp([news('source-b',clock(15,0),'Aynı haber')],clock(15,1))[0]
        self.assertEqual(copy['receivedAt'],original['receivedAt'])
        self.assertEqual(len(sort_and_deduplicate([copy,original])),1)

    def test_yesterday_published_today_received_is_excluded_and_midnight_still_resets(self):
        self.assertEqual(self.store.stamp([news('yesterday',clock(23,59))],clock(0,1,7)),[])
        old=self.store.stamp([news('old',clock(23,50))],clock(23,59))[0]
        self.assertEqual(only_today([old],clock(0,0,7)),[])
        fresh=self.store.stamp([news('fresh',clock(0,0,7))],clock(0,1,7))[0]
        self.assertEqual(fresh['time'],'00:01:00')
        self.assertEqual(len(only_today([old,fresh],clock(0,1,7))),1)

    def test_reused_source_id_on_new_publication_day_has_a_new_clock(self):
        first=self.store.stamp([news('same',clock(14,50))],clock(14,54))[0]
        following=self.store.stamp([news('same',clock(0,0,7))],clock(0,1,7))[0]
        self.assertNotEqual(first['receivedAt'],following['receivedAt'])
        self.assertEqual(following['time'],'00:01:00')


if __name__=='__main__':
    unittest.main()
