import unittest
from unittest.mock import Mock, patch
from datetime import datetime
import official_news_bot as bot
from official_news_bot import parse_feed
from news_day import TR

NOW = datetime(2026, 11, 7, 16, tzinfo=TR)


def rss(account='memetsimsek', title='Açıklama', date='Sat, 07 Nov 2026 09:00:00 GMT'):
    return f'''<rss version="2.0"><channel><title>Profile</title><link>https://nitter.click/{account}</link><description>Posts</description><item><title>{title}</title><link>https://nitter.click/{account}/status/123#m</link><pubDate>{date}</pubDate><description><![CDATA[<p>Türkiye ekonomisi<br/>İkinci satır</p>]]></description></item></channel></rss>'''


class OfficialTests(unittest.TestCase):
    def test_default_instances_are_ordered_and_can_be_overridden(self):
        with patch.dict(bot.os.environ, {}, clear=True):
            self.assertEqual(bot.instances(), [
                'https://nitter.pp.ua', 'https://shitter.thepixora.com', 'https://nitter.netbub.com',
            ])
        with patch.dict(bot.os.environ, {'NITTER_INSTANCES': 'https://custom.example/'}):
            self.assertEqual(bot.instances(), ['https://custom.example'])

    def test_fetch_falls_back_after_http_error_and_invalid_rss(self):
        forbidden = Mock()
        forbidden.raise_for_status.side_effect = bot.requests.HTTPError(response=Mock(status_code=403))
        challenge = Mock(content=b'<html>Check your browser</html>')
        success = Mock(content=rss().encode())
        parse = bot.parse_feed
        with patch.dict(bot.os.environ, {}, clear=True), \
                patch.object(bot.requests, 'get', side_effect=[forbidden, challenge, success]) as get, \
                patch.object(bot, 'parse_feed', side_effect=lambda content, account: parse(content, account, NOW)):
            items, error = bot.fetch_account('memetsimsek')
        self.assertIsNone(error)
        self.assertEqual([item['id'] for item in items], ['x-123'])
        self.assertEqual([entry.args[0] for entry in get.call_args_list], [
            'https://nitter.pp.ua/memetsimsek/rss',
            'https://shitter.thepixora.com/memetsimsek/rss',
            'https://nitter.netbub.com/memetsimsek/rss',
        ])

    def test_timeout_falls_back_and_stops_at_first_valid_feed(self):
        empty = Mock(content=b'<rss version="2.0"><channel><title>Empty</title></channel></rss>')
        with patch.dict(bot.os.environ, {}, clear=True), \
                patch.object(bot.requests, 'get', side_effect=[bot.requests.Timeout(), empty]) as get:
            self.assertEqual(bot.fetch_account('memetsimsek'), ([], None))
        self.assertEqual(get.call_count, 2)

    def test_repeated_polls_from_different_instances_do_not_duplicate_posts(self):
        posts = [parse_feed(rss().replace('nitter.click', host), 'memetsimsek', NOW)[0]
                 for host in ('nitter.pp.ua', 'nitter.netbub.com')]
        with patch.object(bot, 'ACCOUNTS', {'memetsimsek': 'Mehmet Şimşek'}), \
                patch.object(bot, '_items', {}), patch.object(bot, '_states', {}), \
                patch.object(bot, 'only_today', side_effect=lambda items, *args: items), \
                patch.object(bot, 'fetch_account', side_effect=[([post], None) for post in posts]):
            bot.poll_once()
            bot.poll_once()
            self.assertEqual(bot.get_official_news_data()['count'], 1)

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
