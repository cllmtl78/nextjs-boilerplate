from pathlib import Path
import tempfile
import unittest

from global_news_bot import GlobalNewsStore, clean_wire_text, parse_telegram_page, preserves_news_structure
from test_global_news_bot import message, NOW

SOURCE = '''US OPTIONS TRADING HITS ALL-TIME RECORD AMID MARKET ROUT

US options volume surged to a record 112 million contracts on Thursday, November 5, as investors rushed to hedge against a sharp stock-market selloff.

🔸 Options volume: 53% above October's daily average
🔸 Put options: Just over 50% of contracts traded
🔸 S&P 500: -4.4%
🔸 Nasdaq 100: More than -6%
🔸 VIX: Highest level since March'''

# Reference fixture, not a claim about a live model response.
TURKISH = '''ABD'de opsiyon işlemleri, piyasadaki sert satış dalgası sırasında rekor kırdı

ABD'de opsiyon işlem hacmi, yatırımcıların hisse senedi piyasasındaki sert satış dalgasına karşı riskten korunmaya yönelmesiyle 5 Kasım Perşembe günü 112 milyon sözleşmeyle rekor seviyeye ulaştı.

🔸 Opsiyon işlem hacmi: Ekim ayının günlük ortalamasının %53 üzerinde
🔸 Satım opsiyonları: İşlem gören sözleşmelerin %50'sinden biraz fazlası
🔸 S&P 500: -%4,4
🔸 Nasdaq 100: %6'dan fazla düşüş
🔸 VIX: Mart ayından bu yana en yüksek seviye'''


class GlobalFormatTests(unittest.TestCase):
    def test_telegram_breaks_preserve_headline_paragraph_and_five_bullets(self):
        document = message(123, SOURCE.replace('\n', '<br>') + '<br><br>(@WalterBloomberg) https://t.me/WalterBloomberg/123')
        posts, _, _ = parse_telegram_page(document)
        self.assertEqual(posts[0]['rawText'], SOURCE)
        self.assertEqual(posts[0]['rawText'].count('\n🔸'), 5)
        self.assertIn('112 million contracts', posts[0]['rawText'])
        self.assertIn('-4.4%', posts[0]['rawText'])

    def test_cleaning_removes_noise_without_flattening_or_losing_first_bullet(self):
        original = 'HEADLINE\r\n\r\nBody    text.\r\n\r\n🔸 First item\r\n🔸 Second item\r\n(@WalterBloomberg) https://example.com ***'
        self.assertEqual(clean_wire_text(original),'HEADLINE\n\nBody text.\n\n🔸 First item\n🔸 Second item')
        self.assertEqual(clean_wire_text('• First\n• Second'),'• First\n• Second')

    def test_flattened_or_missing_bullet_output_is_rejected(self):
        self.assertTrue(preserves_news_structure(SOURCE,TURKISH))
        self.assertFalse(preserves_news_structure(SOURCE,TURKISH.replace('\n',' ')))
        self.assertFalse(preserves_news_structure(SOURCE,TURKISH.rsplit('\n',1)[0]))

    def test_translated_structure_survives_database_and_api_snapshot(self):
        with tempfile.TemporaryDirectory() as directory:
            store=GlobalNewsStore(Path(directory)/'global.sqlite3')
            posts, _, _ = parse_telegram_page(message(123, SOURCE.replace('\n','<br>')))
            store.upsert(posts)
            batch=store.pending(NOW)
            self.assertEqual(store.save_translations(batch,[{'id':posts[0]['id'],'text':TURKISH.replace('\n',' ')}]),0)
            self.assertEqual(store.snapshot(NOW)['count'],0)
            self.assertEqual(store.save_translations(batch,[{'id':posts[0]['id'],'text':TURKISH}]),1)
            self.assertEqual(store.snapshot(NOW)['data'][0]['baslik'],TURKISH)
            store.close()

    def test_legacy_translation_is_invalidated_when_database_reopens(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'global.sqlite3'
            store=GlobalNewsStore(path)
            posts, _, _=parse_telegram_page(message(123,SOURCE.replace('\n','<br>')))
            store.upsert(posts)
            with store.connection:
                store.connection.execute("UPDATE global_posts SET digest='old-prompt'")
                store.connection.execute("INSERT INTO global_translations VALUES('old-prompt','Eski düz çeviri',0)")
            self.assertEqual(store.snapshot(NOW)['count'],1)
            store.close()
            store=GlobalNewsStore(path)
            self.assertEqual(store.snapshot(NOW)['count'],0)
            self.assertEqual(len(store.pending(NOW)),1)
            store.close()

    def test_direct_quotation_marks_are_not_stripped_from_translation(self):
        with tempfile.TemporaryDirectory() as directory:
            store=GlobalNewsStore(Path(directory)/'global.sqlite3')
            posts, _, _ = parse_telegram_page(message(124, '"We are reviewing proposals" - Official'))
            store.upsert(posts)
            translated='“Önerileri değerlendiriyoruz” — yetkili'
            store.save_translations(store.pending(NOW), [{'id':posts[0]['id'],'text':translated}])
            self.assertEqual(store.snapshot(NOW)['data'][0]['baslik'],translated)
            store.close()


if __name__=='__main__':
    unittest.main()
