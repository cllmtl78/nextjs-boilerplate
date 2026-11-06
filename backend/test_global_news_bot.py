import importlib
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
from datetime import datetime

from global_news_bot import GlobalNewsBot, GlobalNewsStore, TR, clean_wire_text, parse_telegram_page, day_bounds

NOW = datetime(2026, 11, 6, 18, tzinfo=TR)


def message(number, text, date="2026-11-06T12:30:00Z"):
    return f'''<div class="tgme_widget_message_wrap"><div class="tgme_widget_message" data-post="WalterBloomberg/{number}">
      <div class="tgme_widget_message_text js-message_text">{text}</div>
      <a><time datetime="{date}">15:30</time></a></div></div>'''


def response(document):
    result = Mock()
    result.status_code = 200
    result.content = document.encode("utf-8")
    return result


class GlobalBotTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "news.sqlite3"
        self.store = GlobalNewsStore(self.path)

    def tearDown(self):
        self.store.close()
        self.temp.cleanup()

    def posts(self, document):
        return parse_telegram_page(document)[0]

    def test_clean_text_preserves_meaning_numbers_and_names(self):
        text = "*** Silver Lake & PIF: $MSFT drops 4.2% * (@WalterBloomberg) https://t.me/WalterBloomberg/42"
        self.assertEqual(clean_wire_text(text), "Silver Lake & PIF: MSFT drops 4.2%")
        self.assertEqual(clean_wire_text("Workers go on strike - NYT"), "Workers go on strike - NYT")
        self.assertEqual(clean_wire_text("&#83;ilver Lake raises $2.5 billion"), "Silver Lake raises $2.5 billion")
        self.assertEqual(clean_wire_text("News (https://example.com)"), "News")

    def test_parse_realistic_nested_html_and_dates(self):
        posts, cursor, oldest = parse_telegram_page(message(11, "<b>S&amp;P 500</b><div>FALLS 4%</div>* (@WalterBloomberg)") + message(12, "NASDAQ 100 FALLS 6%", "2026-11-06T12:31:00Z"))
        self.assertEqual(len(posts), 2)
        self.assertEqual(posts[0]["id"], "WalterBloomberg/12")
        self.assertEqual(posts[1]["rawText"], "S&P 500 FALLS 4%")
        self.assertEqual(posts[1]["zaman"], "15:30:00")
        self.assertEqual(cursor, 11)
        self.assertEqual(oldest, int(datetime.fromisoformat("2026-11-06T12:30:00+00:00").timestamp()*1000))

    def test_invalid_dates_wrong_channel_and_link_only_posts(self):
        self.assertFalse(self.posts(message(1, "News", "invalid")))
        self.assertFalse(self.posts(message(1, "News").replace('data-post="WalterBloomberg/', 'data-post="trad_fin/')))
        self.assertFalse(self.posts(message(1, "https://example.com * (@WalterBloomberg)")))
        self.assertFalse(self.posts('<div data-post="WalterBloomberg/1"><div class="tgme_widget_message_text">NEWS</div></div>'))

    def test_today_backfill_and_photo_only_page_cursor(self):
        session = Mock()
        session.get.side_effect = [response(message(11, "NEW TODAY") + message(10, "TODAY", "2026-11-05T21:01:00Z")),
                                   response(message(9, "<img src='x'>")),
                                   response(message(8, "EARLIER TODAY") + message(7, "YESTERDAY", "2026-11-05T20:59:00Z"))]
        bot = GlobalNewsBot(self.store, session=session)
        bot.collect(NOW)
        self.assertEqual(len(self.store.rows(NOW)), 3)
        self.assertEqual(session.get.call_count, 3)
        self.assertEqual(session.get.call_args_list[1].kwargs["params"], {"before": 10})
        self.assertEqual(session.get.call_args_list[2].kwargs["params"], {"before": 9})
        self.assertTrue(bot.history_complete)

    def test_200_post_history_not_just_last_page(self):
        session = Mock()
        def get(url, **kwargs):
            before = kwargs["params"].get("before", 201)
            return response("".join(message(before-i-1, f"NEWS {before-i-1}") for i in range(20)))
        session.get.side_effect = get
        bot = GlobalNewsBot(self.store, session=session)
        bot.collect(NOW)
        self.assertEqual(len(self.store.rows(NOW)), 200)
        self.assertEqual(session.get.call_count, 10)
        self.assertEqual(self.store.snapshot(NOW)["pending"], 200)

    def test_translations_survive_reopening_database(self):
        self.store.upsert(self.posts(message(1, "Company begins talks")))
        batch = self.store.pending(NOW)
        self.store.save_translations(batch, [{"id": batch[0]["id"], "text": "Şirket görüşmelere başladı."}])
        self.store.close()
        self.store = GlobalNewsStore(self.path)
        self.assertEqual(self.store.pending(NOW), [])
        self.assertEqual(self.store.snapshot(NOW)["data"][0]["baslik"], "Şirket görüşmelere başladı.")

    def test_full_source_digest_handles_edits_and_matching_prefixes(self):
        prefix = "The S&P 500 and Nasdaq futures are moving "
        self.store.upsert(self.posts(message(1, prefix + "up") + message(2, prefix + "down")))
        self.store.save_translations(self.store.pending(NOW), [
            {"id": "WalterBloomberg/1", "text": "Endeksler yükseliyor."},
            {"id": "WalterBloomberg/2", "text": "Endeksler düşüyor."}])
        self.store.upsert(self.posts(message(1, prefix + "sideways")))
        self.assertEqual(len(self.store.pending(NOW)), 1)
        self.assertEqual(self.store.snapshot(NOW)["count"], 1)
        self.assertEqual(self.store.snapshot(NOW)["data"][0]["baslik"], "Endeksler düşüyor.")

    def test_out_of_order_translation_ids_and_partial_failure(self):
        self.store.upsert(self.posts(message(1, "Workers go on strike - NYT") + message(2, "Iran considers strikes")))
        batch = self.store.pending(NOW)
        count = self.store.save_translations(batch, [{"id": "WalterBloomberg/2", "text": "İran saldırıları değerlendiriyor."},
                                                    {"id": "WalterBloomberg/1", "text": "New York Times’a göre işçiler greve gidiyor."}])
        self.assertEqual(count, 2)
        result = {item["id"]: item["baslik"] for item in self.store.snapshot(NOW)["data"]}
        self.assertIn("greve", result["WalterBloomberg/1"])
        self.assertIn("saldırıları", result["WalterBloomberg/2"])

    def test_unknown_ids_rejected_without_polluting_cache(self):
        self.store.upsert(self.posts(message(1, "A news item")))
        with self.assertRaises(ValueError):
            self.store.save_translations(self.store.pending(NOW), [{"id": "wrong", "text": "Yanlış haber"}])
        self.assertEqual(self.store.snapshot(NOW)["count"], 0)

    def test_unchanged_translation_does_not_block_other_news(self):
        self.store.upsert(self.posts(message(1, "A news item") + message(2, "Another news item")))
        count = self.store.save_translations(self.store.pending(NOW), [{"id": "WalterBloomberg/1", "text": "A news item"},
                                                                       {"id": "WalterBloomberg/2", "text": "Şirketin kârı arttı."}])
        self.assertEqual(count, 1)
        self.assertEqual(self.store.snapshot(NOW)["count"], 1)
        self.assertEqual(self.store.snapshot(NOW)["pending"], 1)

    def test_background_cycle_collects_and_translates_without_api_visitors(self):
        session = Mock()
        session.get.return_value = response(message(1, "Company begins talks") + message(0, "OLD", "2026-11-05T20:59:00Z"))
        translator = Mock(side_effect=lambda batch: [{"id": item["id"], "text": "Şirket görüşmelere başladı."} for item in batch])
        bot = GlobalNewsBot(self.store, session=session, translator=translator)
        bot.cycle(NOW)
        bot.cycle(NOW)
        self.assertEqual(translator.call_count, 1)
        self.assertEqual(self.store.snapshot(NOW)["count"], 1)

    def test_model_failure_preserves_ready_news_and_defers_retry(self):
        self.store.upsert(self.posts(message(1, "News one")))
        batch = self.store.pending(NOW)
        self.store.save_translations(batch, [{"id": batch[0]["id"], "text": "İlk haber hazır."}])
        session = Mock()
        session.get.return_value = response(message(2, "News two") + message(0, "OLD", "2026-11-05T20:00:00Z"))
        translator = Mock(side_effect=RuntimeError("Gemini HTTP 429"))
        bot = GlobalNewsBot(self.store, session=session, translator=translator)
        bot.cycle(NOW)
        self.assertEqual(self.store.snapshot(NOW)["count"], 1)
        self.assertEqual(self.store.snapshot(NOW)["pending"], 1)
        self.assertEqual(self.store.pending(NOW), [])

    def test_missing_key_does_not_send_translation_request(self):
        session = Mock()
        bot = GlobalNewsBot(self.store, session=session)
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}):
            with self.assertRaises(ValueError):
                bot.translate([{"id": "1", "text": "News"}])
        session.post.assert_not_called()

    def test_api_only_reads_database_and_has_no_network_or_translation_call(self):
        self.store.upsert(self.posts(message(1, "Company begins talks")))
        batch = self.store.pending(NOW)
        self.store.save_translations(batch, [{"id": batch[0]["id"], "text": "Şirket görüşmelere başladı."}])
        with patch("bist_news_bot.start_bist_news_bot"), patch("kap_bot.start_kap_bot"), patch("global_news_bot.start_global_news_bot"):
            main = importlib.import_module("main")
        with patch("global_news_bot.get_store", return_value=self.store), patch("global_news_bot.day_bounds", return_value=day_bounds(NOW)):
            with patch("requests.Session.get", side_effect=AssertionError("Network in API")), patch("requests.Session.post", side_effect=AssertionError("Translation in API")):
                result = main.api_global_news()
        self.assertEqual(result["count"], 1)
        self.assertEqual(result["data"][0]["baslik"], "Şirket görüşmelere başladı.")
        self.assertIn("/api/global-news", [route.path for route in main.app.routes])

    def test_istanbul_day_rollover_filters_yesterday(self):
        self.store.upsert(self.posts(message(1, "Yesterday", "2026-11-05T20:59:00Z") + message(2, "Today", "2026-11-05T21:01:00Z")))
        self.assertEqual(len(self.store.rows(NOW)), 1)
        self.assertEqual(self.store.rows(NOW)[0]["id"], "WalterBloomberg/2")
        start, end = day_bounds(NOW)
        self.assertEqual(end-start, 86400000)


if __name__ == "__main__":
    unittest.main()
