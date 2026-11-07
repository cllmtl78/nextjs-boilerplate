import unittest
from datetime import datetime
from official_news_bot import parse_feed
from news_day import TR

NOW = datetime(2026, 11, 7, 16, tzinfo=TR)


def rss(account='memetsimsek', title='Açıklama', date='Sat, 07 Nov 2026 09:00:00 GMT'):
    return f'''<rss version="2.0"><channel><title>Profile</title><link>https://nitter.click/{account}</link><description>Posts</description><item><title>{title}</title><link>https://nitter.click/{account}/status/123#m</link><pubDate>{date}</pubDate><description><![CDATA[<p>Türkiye ekonomisi<br/>İkinci satır</p>]]></description></item></channel></rss>'''


class OfficialTests(unittest.TestCase):
    def test_own_post_unicode_clock_and_canonical_link(self):
        item = parse_feed(rss(), 'memetsimsek', NOW)[0]
        self.assertEqual(item['url'], 'https://x.com/memetsimsek/status/123')
        self.assertEqual(item['zaman'], '12:00:00')
        self.assertEqual(item['baslik'], 'Türkiye ekonomisi\nİkinci satır')
        self.assertEqual(item['id'], parse_feed(rss(), 'memetsimsek', NOW)[0]['id'])

    def test_retweet_reply_and_foreign_author_excluded(self):
        for title in ['RT by @memetsimsek: test', 'R to @memetsimsek: test']:
            self.assertEqual(parse_feed(rss(title=title), 'memetsimsek', NOW), [])
        self.assertEqual(parse_feed(rss(account='other'), 'memetsimsek', NOW), [])

    def test_old_posts_excluded(self):
        self.assertEqual(parse_feed(rss(date='Fri, 06 Nov 2026 09:00:00 GMT'), 'memetsimsek', NOW), [])

    def test_challenge_page_is_not_empty_success(self):
        with self.assertRaises(ValueError):
            parse_feed('<html>Check your browser</html>', 'memetsimsek', NOW)

    def test_valid_empty_rss(self):
        self.assertEqual(parse_feed('<rss version="2.0"><channel><title>Empty</title></channel></rss>', 'memetsimsek', NOW), [])


if __name__ == '__main__':
    unittest.main()
