from datetime import datetime
import unittest
from unittest.mock import patch

import official_news_bot as bot
from news_day import TR
from test_official_news_bot import rss, NOW


class BptFeedTests(unittest.TestCase):
    def test_bpt_own_text_and_link(self):
        post = bot.parse_feed(rss(account='bptfinans'), 'bptfinans', NOW)[0]
        self.assertEqual(post['kaynak'], 'BPT FİNANS')
        self.assertEqual(post['url'], 'https://x.com/bptfinans/status/123')
        self.assertIn('Türkiye ekonomisi', post['baslik'])

    def test_retweets_and_replies_are_excluded(self):
        for title in ['RT by @bptfinans: test', 'R to @bptfinans: test']:
            self.assertEqual(bot.parse_feed(rss(account='bptfinans', title=title), 'bptfinans', NOW), [])
        self.assertEqual(bot.parse_feed(rss(account='other'), 'bptfinans', NOW), [])

    def test_media_not_present_in_plain_text(self):
        content = rss(account='bptfinans').replace('</p>', '</p><a href="https://example.com/image"><img src="https://example.com/img.jpg" /></a>')
        post = bot.parse_feed(content, 'bptfinans', NOW)[0]
        self.assertNotIn('<', post['baslik'])
        self.assertNotIn('img.jpg', post['baslik'])

    def test_bpt_not_mixed_into_official_feed_and_failures_isolated(self):
        now = int(datetime.now(TR).timestamp() * 1000)
        records = {'bpt': {'id':'bpt', 'account':'bptfinans', 'timestamp':now},
                   'official': {'id':'official', 'account':'ticaret', 'timestamp':now}}
        states = {'bptfinans': {'status':'error','error':'HTTP 403'}, 'ticaret': {'status':'ok','count':1}}
        with patch.object(bot, '_items', records), patch.object(bot, '_states', states):
            official = bot.get_official_news_data()
            bpt = bot.get_bpt_news_data()
        self.assertEqual(official['status'], 'ok')
        self.assertEqual([item['id'] for item in official['data']], ['official'])
        self.assertNotIn('bptfinans', official['accounts'])
        self.assertEqual(bpt['status'], 'unavailable')
        self.assertEqual([item['id'] for item in bpt['data']], ['bpt'])


if __name__ == '__main__':
    unittest.main()
