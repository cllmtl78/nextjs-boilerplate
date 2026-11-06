from email.utils import format_datetime
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import Mock, patch

from global_news_bot import GlobalNewsBot, GlobalNewsStore, ServiceHTTPError, gemini_http_error
from test_global_news_bot import NOW, message, response


class RateLimitTests(unittest.TestCase):
    def test_retry_after_and_quota_scope_are_read_without_exposing_error_body(self):
        result=SimpleNamespace(status_code=429,headers={'Retry-After':'120'},json=lambda:{'error':{
            'message':'private-response-body', 'details':[
                {'@type':'type.googleapis.com/google.rpc.RetryInfo','retryDelay':'180.5s'},
                {'@type':'type.googleapis.com/google.rpc.QuotaFailure','violations':[
                    {'quotaId':'GenerateRequestsPerDayPerProjectPerModel-FreeTier'}]}]}})
        error=gemini_http_error(result)
        self.assertEqual(str(error),'Gemini HTTP 429')
        self.assertEqual(error.retry_after,180.5)
        self.assertEqual(error.quota_scope,'daily')
        self.assertNotIn('private-response-body',str(error))

    def test_http_date_retry_header(self):
        start=NOW.timestamp()
        date=format_datetime(datetime.fromtimestamp(start+90,timezone.utc),usegmt=True)
        with patch('global_news_bot.time.time',return_value=start):
            error=gemini_http_error(SimpleNamespace(status_code=429,headers={'Retry-After':date},json=lambda:{}))
        self.assertEqual(error.retry_after,90)

    def test_new_messages_and_restart_cannot_bypass_provider_cooldown(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'global.sqlite3'
            store=GlobalNewsStore(path)
            seconds=[NOW.timestamp()]
            session=Mock()
            session.get.return_value=response(message(1,'News one')+message(0,'Old','2026-11-05T20:00:00Z'))
            def translate(batch):
                if translator.call_count==1:
                    raise ServiceHTTPError('Gemini',429,120,'minute')
                return [{'id':item['id'],'text':'Türkçe haber '+item['id']} for item in batch]
            translator=Mock(side_effect=translate)
            bot=GlobalNewsBot(store,session=session,translator=translator)
            with patch('global_news_bot.time.time',side_effect=lambda:seconds[0]):
                bot.cycle(NOW)
                self.assertEqual(translator.call_count,1)
                self.assertEqual(store.snapshot(NOW)['translation_state'],'rate_limited')
                seconds[0]+=30
                session.get.return_value=response(message(2,'News two')+message(1,'News one')+message(0,'Old','2026-11-05T20:00:00Z'))
                bot.cycle(NOW)
                self.assertEqual(translator.call_count,1)
                self.assertEqual(store.snapshot(NOW)['pending'],2)
                store.close()
                store=GlobalNewsStore(path)
                bot=GlobalNewsBot(store,session=session,translator=translator)
                seconds[0]+=60
                bot.cycle(NOW)
                self.assertEqual(translator.call_count,1)
                seconds[0]+=31
                bot.cycle(NOW)
                self.assertEqual(translator.call_count,2)
                self.assertEqual(store.snapshot(NOW)['count'],2)
                self.assertEqual(store.snapshot(NOW)['translation_state'],'ready')
                self.assertEqual(store.translation_retry_at(),0)
            store.close()

    def test_backoff_grows_and_daily_quota_waits_longer(self):
        with tempfile.TemporaryDirectory() as directory:
            store=GlobalNewsStore(Path(directory)/'global.sqlite3')
            error=ServiceHTTPError('Gemini',429)
            delays=[store.rate_limited(error) for _ in range(8)]
            self.assertEqual(delays[:3],[60,120,240])
            self.assertEqual(delays[-1],1800)
            self.assertGreaterEqual(store.rate_limited(ServiceHTTPError('Gemini',429,0,'daily')),3600)
            store.close()


if __name__=='__main__':
    unittest.main()
