import calendar
from datetime import datetime
import unittest
from unittest.mock import Mock, patch

import feedparser
import bist_news_bot as bot
from news_day import TR

NOW = datetime(2026, 11, 6, 18, tzinfo=TR)


def entry(title='Ekonomi ile ilgili haber', link='https://www.ekonomim.com/ekonomi/test', category=None, hour=12):
    values = {'title':title, 'link':link, 'published_parsed':datetime(2026,11,6,hour).timetuple()}
    if category is not None:
        values['tags']=[{'term':category}]
    return feedparser.FeedParserDict(values)


class SourceTests(unittest.TestCase):
    def setUp(self):
        self.ekonomim = next(source for source in bot.SOURCES if source['badge']=='EKONOMİM')
        self.trt = next(source for source in bot.SOURCES if source['badge']=='TRT HABER')

    def test_ekonomim_only_finance_and_economy_paths(self):
        for path in ['/ekonomi/haber','/finans/haberler/test','/ekonomi/test?utm=x']:
            self.assertTrue(bot.matches_source_category(entry(link='https://www.ekonomim.com'+path),self.ekonomim))
        for path in ['/gundem/test','/spor/finans-haberi','/ekonomiye-dair-haber','/']:
            self.assertFalse(bot.matches_source_category(entry(link='https://www.ekonomim.com'+path),self.ekonomim))

    def test_rss_category_can_identify_non_section_article_urls(self):
        for label in ['Ekonomi','EKONOMİ','Finans','https://www.ekonomim.com/finans']:
            self.assertTrue(bot.matches_source_category(entry(link='https://www.ekonomim.com/ozel-bir-haber-123',category=label),self.ekonomim))
        self.assertFalse(bot.matches_source_category(entry(link='https://www.ekonomim.com/ozel-haber',category='Spor'),self.ekonomim))
        self.assertFalse(bot.matches_source_category(entry(link='https://evil.example/ekonomi/news',category='Ekonomi'),self.ekonomim))

    def test_trt_source_and_economy_filter(self):
        self.assertEqual(self.trt['url'],'https://www.trthaber.com/sondakika.rss')
        self.assertTrue(bot.matches_source_category(entry(link='https://www.trthaber.com/haber/ekonomi/enflasyon-123.html'),self.trt))
        self.assertTrue(bot.matches_source_category(entry(link='https://www.trthaber.com/haber/123',category='Ekonomi'),self.trt))
        for category in ['Spor','Gündem','Dünya']:
            self.assertFalse(bot.matches_source_category(entry(link='https://www.trthaber.com/haber/gundem/123',category=category),self.trt))

    def test_other_sources_are_unaffected(self):
        for source in bot.SOURCES:
            if 'categories' not in source:
                self.assertTrue(bot.matches_source_category(entry(link='https://example.com/article'),source))

    def fetch_fixture(self, entries):
        response = Mock(content=b'fixture')
        with patch.object(bot.requests,'get',return_value=response), patch.object(bot.feedparser,'parse',return_value=feedparser.FeedParserDict(entries=entries)), patch.object(bot,'datetime') as clock:
            clock.now.return_value=NOW
            clock.fromtimestamp.side_effect=datetime.fromtimestamp
            return bot.fetch_feed(self.ekonomim)

    def test_eligible_stories_beyond_first_15_general_news_entries_are_read(self):
        general=[entry(title=f'Spor haberi {i}',link=f'https://www.ekonomim.com/spor/{i}') for i in range(20)]
        eligible=entry(link='https://www.ekonomim.com/finans/eligible')
        data=self.fetch_fixture(general+[eligible])
        self.assertEqual(len(data),1)
        self.assertEqual(data[0]['url'],eligible.link)
        self.assertEqual(data[0]['kaynak'],'EKONOMİM')

    def test_filter_then_publication_sort_then_limit(self):
        entries=[entry(title=f'Finans haberi {i}',link=f'https://www.ekonomim.com/finans/{i}',hour=i) for i in range(17)]
        data=self.fetch_fixture(entries)
        self.assertEqual(len(data),15)
        self.assertEqual(data[0]['url'],'https://www.ekonomim.com/finans/16')
        self.assertEqual(data[-1]['url'],'https://www.ekonomim.com/finans/2')
        self.assertEqual(data[0]['timestamp'],calendar.timegm(entries[-1].published_parsed)*1000)

    def test_ids_are_stable_when_a_source_corrects_the_timestamp(self):
        first=self.fetch_fixture([entry(hour=12)])[0]
        corrected=self.fetch_fixture([entry(hour=13)])[0]
        self.assertEqual(first['id'],corrected['id'])
        self.assertNotEqual(first['timestamp'],corrected['timestamp'])

    def test_unstamped_source_records_use_publication_as_tiebreaker(self):
        recent={'baslik':'Biraz önce yayımlanan haber','timestamp':2000}
        newly_fetched={'baslik':'RSS akışına sonradan gelen haber','timestamp':1000}
        self.assertEqual(bot.sort_and_deduplicate([newly_fetched,recent]),[recent,newly_fetched])

    def test_dedup_keeps_latest_version_and_does_not_truncate_headlines(self):
        prefix='Merkez Bankası para politikası kararına ilişkin '
        older={'baslik':'Aynı haber','timestamp':1000}
        newer={'baslik':'Aynı haber','timestamp':2000}
        distinct=[{'baslik':prefix+'ilk açıklama','timestamp':3000}, {'baslik':prefix+'ikinci açıklama','timestamp':4000}]
        data=bot.sort_and_deduplicate([older,newer]+distinct)
        self.assertEqual(len(data),3)
        self.assertIn(newer,data)
        self.assertNotIn(older,data)
        self.assertEqual(data[0],distinct[1])


if __name__=='__main__':
    unittest.main()
