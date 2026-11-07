import unittest
from datetime import datetime
from crypto_news_bot import CryptoNewsStore, parse_crypto_page
from global_news_bot import TR

NOW = datetime(2026, 11, 7, 16, tzinfo=TR)


def page(body, date='2026-11-07T10:00:00Z'):
    return f'''<div data-post="onecryptofeed/123"><div class="tgme_widget_message_text">{body}</div><time datetime="{date}"></time></div>'''


class CryptoTests(unittest.TestCase):
    def setUp(self):
        self.store = CryptoNewsStore(':memory:')

    def tearDown(self):
        self.store.close()

    def test_publisher_link_is_metadata_not_translation_input(self):
        posts, cursor, oldest = parse_crypto_page(page('Treasury cuts off MEXC - <a href="https://www.theblock.co/news/123">The Block</a>'))
        self.assertEqual(posts[0]['rawText'], 'Treasury cuts off MEXC')
        self.assertEqual(posts[0]['kaynak'], 'The Block')
        self.assertEqual(posts[0]['url'], 'https://www.theblock.co/news/123')
        self.assertEqual(cursor, 123)
        self.assertIsNotNone(oldest)

    def test_unsafe_and_telegram_only_links_not_published(self):
        for link in ['javascript:alert(1)', 'https://t.me/advert', 'https://user:pass@example.com/news']:
            self.assertEqual(parse_crypto_page(page(f'News - <a href="{link}">Link</a>'))[0], [])

    def test_translation_cache_link_dedup_and_daily_reset(self):
        posts, _, _ = parse_crypto_page(page('Market news - <a href="https://example.com/article">Publisher</a>'))
        self.store.upsert(posts)
        self.store.upsert(posts)
        self.assertEqual(len(self.store.pending(NOW)), 1)
        self.assertEqual(self.store.snapshot(NOW)['count'], 0)
        batch = self.store.pending(NOW)
        self.store.save_translations(batch, [{'id': posts[0]['id'], 'text': 'Piyasa haberi'}])
        snapshot = self.store.snapshot(NOW)
        self.assertEqual(snapshot['count'], 1)
        self.assertEqual(snapshot['data'][0]['url'], 'https://example.com/article')
        self.assertEqual(snapshot['data'][0]['baslik'], 'Piyasa haberi')
        self.assertEqual(self.store.pending(NOW), [])
        self.assertEqual(self.store.snapshot(datetime(2026,11,8,tzinfo=TR))['count'], 0)

    def test_rate_limit_keeps_pending_and_prior_translations(self):
        from global_news_bot import ServiceHTTPError
        self.store.rate_limited(ServiceHTTPError('Gemini',429,retry_after=60))
        self.assertEqual(self.store.snapshot(NOW)['translation_state'], 'rate_limited')


if __name__ == '__main__':
    unittest.main()
