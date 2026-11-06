"""Parser/worker tests use synthetic HTML; they do not claim live-site compatibility."""
import unittest
from unittest.mock import Mock, patch
import requests
import kap_bot as bot

ARTICLE = '''<html><meta property="article:published_time" content="2026-11-06T12:30:00+03:00">
<article><h1>THYAO [TÜRK HAVA YOLLARI] Özel Durum Açıklaması</h1>
<p>İlgili Şirketler: THYAO</p><a href="https://www.kap.org.tr/tr/Bildirim/1234567">KAP</a>
<a href="https://www.kap.org.tr/tr/Bildirim/1234567">Tekrar</a></article></html>'''
URL = 'https://www.yenisafak.com/ekonomi/kap-haberleri/kap-thy-ozel-durum-1234567'

class KapTests(unittest.TestCase):
    def test_article_preserves_official_link_and_time(self):
        items = bot.parse_article(ARTICLE, URL)
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]['id'], 1234567)
        self.assertEqual(items[0]['code'], 'THYAO')
        self.assertEqual(items[0]['time'], '12:30:00')
        self.assertEqual(items[0]['title'], 'Özel Durum Açıklaması')
        self.assertEqual(items[0]['url'], 'https://www.kap.org.tr/tr/Bildirim/1234567')
        self.assertEqual(items[0]['sourceUrl'], URL)

    def test_no_invented_id_or_time(self):
        self.assertEqual(bot.parse_article('<article><h1>THYAO haber 1234567</h1></article>', URL), [])
        item = bot.parse_article('<article><h1>Şirket açıklaması</h1><a href="https://kap.org.tr/tr/Bildirim/1234567">KAP</a></article>', URL)[0]
        self.assertEqual(item['time'], '--:--')
        self.assertIsNone(item['timestamp'])
        self.assertEqual(item['code'], '')

    def test_false_hosts_and_paths_rejected(self):
        for url in ['https://kap.org.tr.evil.com/tr/Bildirim/1234567',
                    'https://evil.com/?kap.org.tr/tr/Bildirim/1234567',
                    'https://kap.org.tr/tr/Bildirim/1234567/other']:
            self.assertIsNone(bot.official_link(url))

    def test_official_paths_with_and_without_language(self):
        for path in ['/Bildirim/1234567', '/tr/Bildirim/1234567',
                     '/en/disclosure/1234567', '/disclosure/1234567/']:
            self.assertEqual(bot.official_link('https://www.kap.org.tr' + path),
                             (1234567, 'https://www.kap.org.tr/tr/Bildirim/1234567'))

    def test_root_path_link_from_publisher_article(self):
        html = ARTICLE.replace('/tr/Bildirim/', '/Bildirim/')
        self.assertEqual(bot.parse_article(html, URL)[0]['id'], 1234567)

    def test_escaped_article_content_and_protocol_relative_url(self):
        for content in [
            'https://www.kap.org.tr/Bildirim/1234567',
            'https:\\/\\/www.kap.org.tr\\/Bildirim\\/1234567',
            'https%3A%2F%2Fwww.kap.org.tr%2FBildirim%2F1234567',
            '//www.kap.org.tr/Bildirim/1234567',
            r'https:\u002f\u002fwww.kap.org.tr\u002fBildirim\u002f1234567',
        ]:
            with self.subTest(content=content):
                html = '<article><h1>PCILT [Şirket] Payların Geri Alınması</h1><p>' + content + '</p></article>'
                self.assertEqual(bot.parse_article(html, URL)[0]['id'], 1234567)

    def test_unrelated_page_links_do_not_become_disclosures(self):
        html = '<article><h1>Şirket açıklaması</h1></article><footer><a href="https://www.kap.org.tr/Bildirim/9999999">Başka haber</a></footer>'
        self.assertEqual(bot.parse_article(html, URL), [])

    def test_exact_kap_section_from_deployment_log(self):
        path = '/ekonomi/kap-haberleri/kap-pc-iletisim-ve-medya-hizmetleri-sanayi-ticaret-as-pcilt-paylarin-geri-alinmasina-iliskin-bildirim-5159325'
        self.assertEqual(bot.article_url(path), 'https://www.yenisafak.com' + path)
        for path in ['/ekonomi/oruc-reis-rotayi-cevirdi-turkiyenin-yeni-hedefi-belli-oldu-4870340',
                     '/ekonomi/kap-haberleri', '/ekonomi/kap-haberleri?page=2']:
            self.assertIsNone(bot.article_url(path))

    def test_listing_relative_links_dedup_and_scope(self):
        html = f'<a href="{URL}">Haber</a><a href="{URL}?x=2">Tekrar</a><a href="/ekonomi/kap-haberleri">Liste</a><a href="https://evil.com/ekonomi/kap-123456">Dış</a><a href="/ekonomi/oruc-reis-rotayi-cevirdi-4870340">Ekonomi</a>'
        self.assertEqual(bot.parse_listing(html), [URL])

    def test_json_ld_and_utc(self):
        html = '''<script type="application/ld+json">{"@graph":[{"@type":"NewsArticle","headline":"THYAO [Şirket] Açıklama","datePublished":"2026-11-06T09:30:00Z","articleBody":"BIST:THYAO https://www.kap.org.tr/tr/Bildirim/1234567"}]}</script>'''
        item = bot.parse_article(html, URL)[0]
        self.assertEqual(item['time'], '12:30:00')
        self.assertEqual(item['code'], 'THYAO')

    def test_cached_details_not_fetched_again(self):
        collector = bot.YeniSafakCollector()
        collector.get_html = Mock(side_effect=[f'<a href="{URL}">haber</a>', ARTICLE, f'<a href="{URL}">haber</a>'])
        with patch.object(bot.time, 'sleep'):
            self.assertEqual(collector.fetch(), collector.fetch())
        self.assertEqual(collector.get_html.call_count, 3)

    def test_source_failure_uses_official_fallback(self):
        with patch.object(bot._collector, 'fetch', side_effect=requests.HTTPError('403')), patch.object(bot, 'fetch_official_kap', return_value=[{'id': 42}]):
            self.assertEqual(bot.fetch_fast_kap(), [{'id': 42}])

    def test_no_live_workers_started_by_import(self):
        self.assertIsNone(bot._worker)

if __name__ == '__main__':
    unittest.main()
