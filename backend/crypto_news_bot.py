"""OneCryptoFeed headlines, neutral Turkish translation and original source links."""
import logging
import os
from pathlib import Path
import threading
from urllib.parse import urlparse

from bs4 import BeautifulSoup
from global_news_bot import GlobalNewsBot, GlobalNewsStore, parse_telegram_page, telegram_body_text

logger = logging.getLogger(__name__)


def parse_crypto_page(document):
    posts, cursor, oldest = parse_telegram_page(document, 'onecryptofeed')
    by_id = {post['id'].lower(): post for post in posts}
    for node in BeautifulSoup(document, 'html.parser').select('div[data-post]'):
        post = by_id.get(node.get('data-post', '').lower())
        body = node.select_one('.tgme_widget_message_text')
        if not post or body is None:
            continue
        # The final external text link is the publisher attribution in this feed.
        links = []
        for anchor in body.select('a[href]'):
            url = anchor.get('href', '')
            parsed = urlparse(url)
            if parsed.scheme in ('http', 'https') and parsed.hostname and parsed.hostname.lower() not in ('t.me', 'telegram.me', 'www.t.me') and not parsed.username and not parsed.password:
                links.append((anchor, url))
        if not links:
            continue
        anchor, url = links[-1]
        post['url'] = url
        post['kaynak'] = anchor.get_text(' ', strip=True) or urlparse(url).hostname
        anchor.decompose()
        post['rawText'] = telegram_body_text(body).rstrip(' \n-–—|')
    return [post for post in posts if post.get('url') and post['rawText']], cursor, oldest


class CryptoNewsStore(GlobalNewsStore):
    def __init__(self, path, model='gemini-2.5-flash'):
        super().__init__(path, model)
        with self.connection:
            self.connection.execute('CREATE TABLE IF NOT EXISTS crypto_sources (id TEXT PRIMARY KEY, url TEXT NOT NULL, publisher TEXT NOT NULL)')

    def upsert(self, posts):
        with self.lock, self.connection:
            super().upsert(posts)
            self.connection.executemany('INSERT OR REPLACE INTO crypto_sources VALUES(?,?,?)',
                                        [(post['id'], post['url'], post['kaynak']) for post in posts])

    def snapshot(self, now=None):
        with self.lock:
            result = super().snapshot(now)
            sources = {row['id']: row for row in self.connection.execute('SELECT * FROM crypto_sources')}
            for item in result['data']:
                source = sources.get(item['id'])
                if source:
                    item.update(url=source['url'], kaynak=source['publisher'], kategori='kripto',
                                detay=item['baslik'], tarih='')
            result['data'] = [item for item in result['data'] if item.get('url')]
            result['items'] = result['data']
            result['count'] = len(result['data'])
            return result

    def prune(self, now=None):
        super().prune(now)
        with self.lock, self.connection:
            self.connection.execute('DELETE FROM crypto_sources WHERE id NOT IN (SELECT id FROM global_posts)')


class CryptoNewsBot(GlobalNewsBot):
    source = 'https://t.me/s/onecryptofeed'
    channel = 'onecryptofeed'
    label = 'Kripto'
    parse_page = staticmethod(parse_crypto_page)


_store = None
_lock = threading.RLock()
_worker = None


def get_store():
    global _store
    with _lock:
        if _store is None:
            default = Path(os.environ.get('GLOBAL_NEWS_DB_PATH', str(Path(__file__).parent / '.data' / 'global-news.sqlite3'))).parent / 'crypto-news.sqlite3'
            _store = CryptoNewsStore(os.environ.get('CRYPTO_NEWS_DB_PATH', str(default)), os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash'))
        return _store


def get_crypto_news_data():
    return get_store().snapshot()


def start_crypto_news_bot():
    global _worker
    with _lock:
        if _worker is not None and _worker.is_alive():
            return
        def run():
            bot = None
            while True:
                try:
                    if bot is None:
                        bot = CryptoNewsBot(get_store())
                    bot.cycle()
                    if not os.environ.get('GEMINI_API_KEY'):
                        logger.warning('[Kripto] GEMINI_API_KEY eksik; haberler toplanıyor, çeviri bekliyor.')
                except Exception as exc:
                    logger.warning('[Kripto] İşçi hatası: %s', type(exc).__name__)
                threading.Event().wait(60)
        _worker = threading.Thread(target=run, daemon=True, name='crypto-news')
        _worker.start()
