"""Parser/worker tests use synthetic HTML; they do not claim live-site compatibility."""
import unittest
import time
from pathlib import Path
from unittest.mock import Mock, patch
import requests
import kap_bot as bot

ARTICLE = '''<html><meta property="article:published_time" content="2026-11-06T12:30:00+03:00">
<article><h1>THYAO [TÜRK HAVA YOLLARI] Özel Durum Açıklaması</h1>
<p>İlgili Şirketler: THYAO</p><a href="https://www.kap.org.tr/tr/Bildirim/1234567">KAP</a>
<a href="https://www.kap.org.tr/tr/Bildirim/1234567">Tekrar</a></article></html>'''
URL = 'https://www.yenisafak.com/ekonomi/kap-haberleri/kap-thy-ozel-durum-1234567'

class KapTests(unittest.TestCase):
    def test_real_source_line_wraps_are_joined_without_losing_text(self):
        from bs4 import BeautifulSoup
        html = (Path(__file__).parent / 'fixtures/yenisafak_kap_5159326.html').read_text()
        blocks = bot.article_content(BeautifulSoup(html, 'html.parser').select_one('.detail-layout'))
        explanation = [block for block in blocks if block['type'] == 'text' and 'GOLDEN GLOBAL' in block['text']]
        self.assertEqual(len(explanation), 1)
        self.assertIn('A.Ş. olduğu TRDGLVKK2611', explanation[0]['text'])
        self.assertIn('2026 tarihli itfa', explanation[0]['text'])
        self.assertTrue(explanation[0]['text'].endswith('gerçekleştirilememiştir.'))

    def test_inline_text_keeps_word_separation_and_section_headings(self):
        from bs4 import BeautifulSoup
        html = '''<article><h2>Bildirim İçeriği</h2>
        <p class="detail-text"><span>Sermaye</span><span>Piyasası</span> Kurulu'nun <b>kararı</b>.</p>
        <p class="detail-text">Açıklama</p><p class="detail-text">İlk paragraf.</p>
        <p class="detail-text">İkinci paragraf.</p></article>'''
        blocks = bot.article_content(BeautifulSoup(html, 'html.parser').article)
        self.assertEqual(blocks[0], {'type':'text','text':'Bildirim İçeriği','heading':True})
        self.assertEqual(blocks[1]['text'], "Sermaye Piyasası Kurulu'nun kararı.")
        self.assertTrue(blocks[2]['heading'])
        self.assertEqual([block['text'] for block in blocks[3:]], ['İlk paragraf.', 'İkinci paragraf.'])

    def test_duplicate_title_is_not_repeated_in_disclosure_body(self):
        html = '''<article><h1>Sorumluluk Beyanı (Konsolide)</h1>
        <p class="detail-text">Sorumluluk Beyanı (Konsolide)</p>
        <p class="detail-text">Açıklama</p><p class="detail-text">Şirket açıklaması.</p>
        <a href="https://www.kap.org.tr/tr/Bildirim/1694480">KAP</a></article>'''
        item = bot.parse_article(html, URL)[0]
        self.assertEqual(item['content'][0]['text'], 'Açıklama')
        self.assertNotIn('Sorumluluk Beyanı', item['summary'])

    def test_utf8_html_is_not_decoded_as_requests_default_latin1(self):
        text = '<h1>İŞ YATIRIM A.Ş. — Açıklama, çığ, ödeme</h1>'
        response = requests.Response()
        response.status_code = 200
        response.url = URL
        response._content = text.encode('utf-8')
        response.encoding = 'ISO-8859-1'
        self.assertNotEqual(response.text, text)
        collector = bot.YeniSafakCollector()
        collector.session.get = Mock(return_value=response)
        self.assertEqual(collector.get_html(URL), text)

    def test_non_utf8_declared_html_charset(self):
        text = '<meta charset="windows-1254"><p>Şirket açıklaması</p>'
        response = requests.Response()
        response._content = text.encode('windows-1254')
        self.assertIn('Şirket açıklaması', bot.decode_response_html(response))

    def test_turkish_multi_symbol_title_and_financial_table(self):
        html = '''<div class="detail-layout"><article class="detail-head">
        <h1>KAP *** AYTEMİZ YATIRIM BANKASI A.Ş. *** AYTEM,YYA *** Banka Finansal Rapor</h1></article>
        <div class="detail-text"><p>Finansal Durum Tablosu (Bilanço)</p>
        <table><caption>Para Tipi: TL</caption><tr><th rowspan="2">Varlıklar</th><th colspan="2">Dönem</th></tr>
        <tr><th>Cari Dönem</th><th>Önceki Dönem</th></tr>
        <tr><td>İlişkili Taraflardan Alacaklar</td><td>610000000</td><td>110000000</td></tr></table>
        <p>Özkaynaklar ve yükümlülükler.</p></div>
        <a href="https://www.kap.org.tr/tr/Bildirim/1694432">KAP</a></div>'''
        item = bot.parse_article(html, URL)[0]
        self.assertEqual(item['code'], 'AYTEM,YYA')
        self.assertEqual(item['title'], 'Banka Finansal Rapor')
        self.assertEqual(item['company'], 'AYTEMİZ YATIRIM BANKASI A.Ş.')
        self.assertEqual([block['type'] for block in item['content']], ['text', 'table', 'text'])
        table = item['content'][1]
        self.assertEqual(table['rows'][0][0]['rowSpan'], 2)
        self.assertEqual(table['rows'][0][1]['colSpan'], 2)
        self.assertEqual(table['rows'][2][0]['text'], 'İlişkili Taraflardan Alacaklar')
        self.assertEqual(table['rows'][2][1]['text'], '610000000')
        self.assertIn('İlişkili Taraflardan Alacaklar\t610000000\t110000000', item['summary'])

    def test_nested_detail_paragraphs_and_sibling_tables_are_not_duplicated(self):
        html = '''<article><div class="detail-text"><div class="detail-text">İlk paragraf</div></div>
        <table><tr><td>Varlıklar</td><td>123</td></tr></table></article>'''
        from bs4 import BeautifulSoup
        blocks = bot.article_content(BeautifulSoup(html, 'html.parser').article)
        self.assertEqual(len(blocks), 2)
        self.assertEqual(blocks[0]['text'], 'İlk paragraf')
        self.assertEqual(blocks[1]['rows'][0][1]['text'], '123')

    def test_real_saved_yenisafak_page_header_and_body_are_siblings(self):
        html = (Path(__file__).parent / 'fixtures/yenisafak_kap_5159326.html').read_text()
        url = 'https://www.yenisafak.com/ekonomi/kap-haberleri/kap-merkezi-kayit-kurulusu-as-ggbvk-merkezi-kayit-kurulusu-as-duyurusu-5159326'
        items = bot.parse_article(html, url)
        self.assertEqual(len(items), 1)
        item = items[0]
        self.assertEqual(item['id'], 1694413)
        self.assertEqual(item['url'], 'https://www.kap.org.tr/tr/Bildirim/1694413')
        self.assertEqual(item['code'], 'GGBVK')
        self.assertEqual(item['company'], 'MERKEZİ KAYIT KURULUŞU A.Ş.')
        self.assertEqual(item['subject'], 'Merkezi Kayıt Kuruluşu A.Ş. Duyurusu')
        self.assertEqual(item['time'], '20:00:00')
        self.assertEqual(item['date'], '2026-11-06T20:00:00+03:00')
        self.assertIn('GOLDEN GLOBAL', item['summary'])
        self.assertNotIn('Reklam', item['summary'])

    def test_real_layout_ignores_recommendations_outside_detail(self):
        html = (Path(__file__).parent / 'fixtures/yenisafak_kap_5159326.html').read_text()
        html += '<article><h1>Başka haber</h1><a href="https://www.kap.org.tr/tr/Bildirim/9999999">KAP</a></article>'
        self.assertEqual([item['id'] for item in bot.parse_article(html, URL)], [1694413])

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
        item = {'id': 42, 'timestamp': int(time.time() * 1000)}
        with patch.object(bot._collector, 'fetch', side_effect=requests.HTTPError('403')), patch.object(bot, 'fetch_official_kap', return_value=[item]):
            self.assertEqual(bot.fetch_fast_kap(), [item])

    def test_no_live_workers_started_by_import(self):
        self.assertIsNone(bot._worker)

if __name__ == '__main__':
    unittest.main()
