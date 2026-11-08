"""Public Nitter RSS collector. No X login, cookies or paid API required."""
import calendar
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from urllib.parse import urlparse

import feedparser
import requests
from bs4 import BeautifulSoup
from news_day import TR, only_today

OFFICIAL_ACCOUNTS = {
    'memetsimsek': 'Mehmet Şimşek',
    'HMBakanligi': 'Hazine ve Maliye Bakanlığı',
    '_cevdetyilmaz': 'Cevdet Yılmaz',
    'ticaret': 'Ticaret Bakanlığı',
    'spkgovtr': 'SPK',
    'Merkez_Bankasi': 'TCMB',
    'BDDKResmi': 'BDDK',
    'tuikbilgi': 'TÜİK',
}
ACCOUNTS = {**OFFICIAL_ACCOUNTS, 'bptfinans': 'BPT FİNANS'}
_lock = threading.Lock()
_items = {}
_states = {}
_started = False


def instances():
    result = []
    for value in os.getenv('NITTER_INSTANCES', 'https://nitter.mizuki.st').split(','):
        value = value.strip().rstrip('/')
        parsed = urlparse(value)
        if parsed.scheme == 'https' and parsed.hostname and not parsed.username and not parsed.password and not parsed.query and not parsed.fragment:
            result.append(value)
    return result[:3]


def parse_feed(content, account, now=None):
    feed = feedparser.parse(content)
    if feed.get('version') not in ('rss20', 'rss10', 'atom10', 'rss091u', 'rss092'):
        raise ValueError('Yanıt geçerli RSS/Atom değil (reklam veya erişim engeli olabilir)')
    result = []
    for entry in feed.entries:
        path = urlparse(entry.get('link', '')).path
        match = re.fullmatch(r'/([^/]+)/status/(\d+)/?', path)
        title = entry.get('title', '')
        # Only own posts; do not misattribute retweets, replies or quoted posts.
        if not match or match[1].lower() != account.lower() or re.match(r'^(RT|R)\s+(?:by|to)\b', title, re.I):
            continue
        stamp = entry.get('published_parsed')
        if not stamp:
            continue
        soup = BeautifulSoup(entry.get('description') or entry.get('summary') or title, 'html.parser')
        for tag in soup(['script', 'style']):
            tag.decompose()
        # Nitter footer/media links are not tweet text.
        for tag in soup.select('a[href]'):
            if tag.get_text(strip=True) in ('View tweet', 'View Tweet', 'Video', 'Photo'):
                tag.decompose()
        for br in soup.find_all('br'):
            br.replace_with('\n')
        text = soup.get_text('\n', strip=True).strip()
        if not text:
            continue
        timestamp = calendar.timegm(stamp) * 1000
        clock = datetime.fromtimestamp(timestamp / 1000, TR)
        result.append({
            'id': 'x-' + match[2], 'account': account, 'kaynak': ACCOUNTS[account],
            'baslik': text, 'detay': text, 'kategori': 'resmi',
            'url': f'https://x.com/{account}/status/{match[2]}',
            'timestamp': timestamp, 'zaman': clock.strftime('%H:%M:%S'),
            'tarih': clock.strftime('%d.%m.%Y'),
        })
    return only_today(result, now)


def fetch_account(account):
    error = 'NITTER_INSTANCES yapılandırması boş veya geçersiz'
    for base in instances():
        try:
            response = requests.get(f'{base}/{account}/rss', timeout=(5, 12),
                                    headers={'User-Agent': 'BPT-Finans-RSS/1.0'})
            response.raise_for_status()
            if len(response.content) > 2_000_000:
                raise ValueError('RSS yanıtı çok büyük')
            return parse_feed(response.content, account), None
        except requests.HTTPError as exc:
            error = f'RSS HTTP {exc.response.status_code}'
        except requests.RequestException:
            error = 'RSS bağlantı hatası veya zaman aşımı'
        except ValueError as exc:
            error = str(exc)
    return [], error


def poll_once():
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(fetch_account, ACCOUNTS))
    with _lock:
        current = {item['id']: item for item in only_today(list(_items.values()))}
        for account, (items, error) in zip(ACCOUNTS, results):
            current.update({item['id']: item for item in items})
            _states[account] = {'status': 'error' if error else 'ok', 'count': len(items), 'error': error}
            print(f'[Resmi] @{account}: {error or str(len(items)) + " güncel paylaşım"}', flush=True)
        _items.clear()
        _items.update(dict(sorted(current.items(), key=lambda pair: pair[1]['timestamp'], reverse=True)[:300]))


def snapshot(accounts):
    with _lock:
        data = sorted(only_today([item for item in _items.values() if item['account'] in accounts]), key=lambda item: item['timestamp'], reverse=True)
        states = {account: state for account, state in _states.items() if account in accounts}
    status = 'starting' if not states else 'unavailable' if all(s['status'] == 'error' for s in states.values()) else 'partial' if any(s['status'] == 'error' for s in states.values()) else 'ok'
    return {'status': status, 'count': len(data), 'data': data, 'accounts': states}


def get_official_news_data():
    return snapshot(OFFICIAL_ACCOUNTS)


def get_bpt_news_data():
    return snapshot({'bptfinans'})


def start_official_news_bot():
    global _started
    if _started:
        return
    _started = True
    def run():
        while True:
            try:
                poll_once()
            except Exception as exc:
                print(f'[Resmi] Toplayıcı hatası: {type(exc).__name__}', flush=True)
            time.sleep(300)
    threading.Thread(target=run, daemon=True, name='official-news').start()
