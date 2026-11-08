"""FRED macro dashboard: official public-source series, cached outside request handlers."""
import logging
import math
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import requests

logger = logging.getLogger(__name__)
URL = 'https://api.stlouisfed.org/fred/series/observations'
SERIES = ['DFEDTARL', 'DFEDTARU', 'DGS2', 'DGS10', 'T10Y2Y', 'CPIAUCNS', 'PCEPILFE', 'UNRATE', 'ICSA', 'WALCL']
METRICS = [
    dict(id='fed-rate', title='Fed hedef faiz aralığı', group='rates', series=['DFEDTARL','DFEDTARU'], unit='%', digits=2, frequency='Karar değiştikçe', source='Federal Reserve', description='Federal fonlar hedef faiz aralığı. Grafik üst sınırı gösterir.', delta_unit='baz puan', delta_scale=100),
    dict(id='us-2y', title='ABD 2 yıllık tahvil', group='rates', series=['DGS2'], unit='%', digits=2, frequency='Günlük', source='Federal Reserve', description='2 yıl vadeli ABD Hazine tahvilinin sabit vadeli getirisi.', delta_unit='baz puan', delta_scale=100),
    dict(id='us-10y', title='ABD 10 yıllık tahvil', group='rates', series=['DGS10'], unit='%', digits=2, frequency='Günlük', source='Federal Reserve', description='10 yıl vadeli ABD Hazine tahvilinin sabit vadeli getirisi.', delta_unit='baz puan', delta_scale=100),
    dict(id='yield-spread', title='10 yıl − 2 yıl faiz farkı', group='rates', series=['T10Y2Y'], unit='puan', digits=2, frequency='Günlük', source='Federal Reserve', description='10 yıllık ve 2 yıllık tahvil getirileri arasındaki yüzde puan farkı.', delta_unit='baz puan', delta_scale=100),
    dict(id='cpi', title='ABD tüketici enflasyonu', group='economy', series=['CPIAUCNS'], unit='%', digits=2, frequency='Aylık', source='BLS', transform='yoy', description='Mevsimsellikten arındırılmamış TÜFE endeksinin yıllık yüzde değişimi.', delta_unit='puan', delta_scale=1),
    dict(id='core-pce', title='Çekirdek PCE enflasyonu', group='economy', series=['PCEPILFE'], unit='%', digits=2, frequency='Aylık', source='BEA', transform='yoy', description='Gıda ve enerji hariç, mevsimsellikten arındırılmış PCE endeksinin yıllık yüzde değişimi.', delta_unit='puan', delta_scale=1),
    dict(id='unemployment', title='ABD işsizlik oranı', group='economy', series=['UNRATE'], unit='%', digits=1, frequency='Aylık', source='BLS', description='Mevsimsellikten arındırılmış sivil işsizlik oranı.', delta_unit='puan', delta_scale=1),
    dict(id='claims', title='İşsizlik maaşı başvuruları', group='economy', series=['ICSA'], unit='bin başvuru', digits=1, frequency='Haftalık', source='U.S. Department of Labor', scale=.001, description='Mevsimsellikten arındırılmış ilk işsizlik sigortası başvuruları.', delta_unit='bin başvuru', delta_scale=1),
    dict(id='fed-balance', title='Fed bilançosu', group='liquidity', series=['WALCL'], unit='trilyon $', digits=3, frequency='Haftalık', source='Federal Reserve', scale=.000001, description='Federal Reserve toplam varlıkları. Milyon dolar serisi trilyon dolara çevrilmiştir.', delta_unit='milyar $', delta_scale=1000),
]
_lock = threading.RLock()
_values = {}
_errors = {}
_status = 'starting'
_last_check = None
_worker = None


def parse_observations(payload):
    if not isinstance(payload, dict) or not isinstance(payload.get('observations'), list):
        raise ValueError('Invalid FRED observations')
    values = {}
    for row in payload['observations']:
        try:
            date = datetime.strptime(row['date'], '%Y-%m-%d').date().isoformat()
            value = float(row['value'])
            if math.isfinite(value):
                values[date] = value
        except (ValueError, TypeError, KeyError):
            continue
    if not values:
        raise ValueError('No usable observations')
    return [{'date': date, 'value': value} for date, value in sorted(values.items())]


def annual_changes(history):
    lookup = {point['date'][:7]: point['value'] for point in history}
    result = []
    for point in history:
        year, month = point['date'][:7].split('-')
        previous = lookup.get(f'{int(year)-1:04d}-{month}')
        if previous is not None and previous > 0:
            result.append({'date': point['date'], 'value': (point['value'] / previous - 1) * 100})
    return result


def build_metric(meta, values, errors):
    item = {key: value for key, value in meta.items() if key not in ('scale','transform','delta_scale')}
    source = meta['series'][-1]
    history = list(values.get(source, []))
    low = None
    if meta['id'] == 'fed-rate':
        lower = {point['date']: point['value'] for point in values.get('DFEDTARL', [])}
        history = [point for point in history if point['date'] in lower]
        if history:
            low = lower[history[-1]['date']]
    if meta.get('transform') == 'yoy':
        history = annual_changes(history)
    scale = meta.get('scale', 1)
    history = [{'date': point['date'], 'value': point['value'] * scale} for point in history]
    latest = history[-1] if history else None
    previous = history[-2] if len(history) > 1 else None
    stale = any(series in errors for series in meta['series'])
    return {**item, 'status': 'stale' if latest and stale else 'ok' if latest else 'unavailable',
            'value': latest['value'] if latest else None, 'low': low,
            'date': latest['date'] if latest else None, 'previous_date': previous['date'] if previous else None,
            'change': (latest['value'] - previous['value']) * meta.get('delta_scale', 1) if previous else None,
            'history': history}


def fetch_series(series, key):
    try:
        response = requests.get(URL, params={'api_key': key, 'file_type':'json', 'series_id':series,
                                            'sort_order':'desc', 'limit':1200 if series in SERIES[:5] else 156}, timeout=(5, 18))
        if response.status_code != 200:
            return series, None, f'HTTP {response.status_code}'
        return series, parse_observations(response.json()), None
    except requests.RequestException:
        return series, None, 'Bağlantı hatası veya zaman aşımı'
    except (ValueError, TypeError):
        return series, None, 'Geçersiz veri yanıtı'


def poll_once():
    global _status, _last_check
    key = os.getenv('FRED_API_KEY', '').strip()
    if not key:
        with _lock:
            _status = 'not_configured'
        return
    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(lambda series: fetch_series(series, key), SERIES))
    with _lock:
        successes = 0
        for series, data, error in results:
            if data:
                _values[series] = data
                _errors.pop(series, None)
                successes += 1
            else:
                _errors[series] = error
                logger.warning('[Makro] %s alınamadı (%s)', series, error)
        _last_check = datetime.now(timezone.utc).isoformat()
        _status = 'ok' if successes == len(SERIES) else 'partial' if successes else 'stale' if _values else 'unavailable'
        logger.info('[Makro] %s/%s seri güncellendi.', successes, len(SERIES))


def get_macro_data():
    with _lock:
        items = [build_metric(meta, _values, _errors) for meta in METRICS]
        return {'status': _status, 'last_checked': _last_check, 'count': sum(item['value'] is not None for item in items), 'data': items}


def start_fred_macro_bot():
    global _worker
    with _lock:
        if _worker is not None and _worker.is_alive():
            return
        def run():
            while True:
                try:
                    poll_once()
                except Exception as exc:
                    # Never print request URLs: FRED's API key is a query parameter.
                    logger.warning('[Makro] İşçi hatası (%s)', type(exc).__name__)
                threading.Event().wait(30 * 60)
        _worker = threading.Thread(target=run, name='fred-macro', daemon=True)
        _worker.start()


# Read-only discovery for the next Turkey dashboard; does not modify US metrics.
_research_lock = threading.Lock()
_research_cache = None
_research_retry = 0
TOPICS = {
    'Enflasyon': ('consumer price', 'inflation', 'cpi'),
    'İstihdam': ('unemployment', 'employment rate'),
    'Büyüme': ('gross domestic', 'gdp'),
    'Sanayi üretimi': ('industrial production', 'production: industry', 'production of total industry', 'production in total manufacturing'),
    'Faiz': ('interest rate', 'policy rate', 'immediate rate', 'interbank'),
    'Döviz': ('exchange rate', 'currency conversion'),
}


def summarize_turkey_series(rows):
    series = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get('id'), str):
            continue
        title = str(row.get('title', ''))
        lowered = title.casefold()
        if not any(country in lowered for country in ('turkey', 'türkiye', 'turkiye')):
            continue
        series[row['id']] = {
            'id': row['id'], 'title': title,
            'frequency': row.get('frequency'), 'units': row.get('units'),
            'seasonal_adjustment': row.get('seasonal_adjustment'),
            'observation_start': row.get('observation_start'),
            'observation_end': row.get('observation_end'),
            'last_updated': row.get('last_updated'),
            'discontinued': 'discontinued' in lowered or 'this series has been discontinued' in str(row.get('notes','')).lower(),
        }
    ordered = sorted(series.values(), key=lambda item: (not item['discontinued'], item['observation_end'] or '', item['last_updated'] or ''), reverse=True)
    groups = {topic: [item for item in ordered if any(word in item['title'].lower() for word in words)][:4] for topic, words in TOPICS.items()}
    return {'candidate_count': len(series), 'groups': groups}


def get_turkey_research():
    import time
    global _research_cache, _research_retry
    with _research_lock:
        if _research_cache and time.monotonic() < _research_cache['expires']:
            return _research_cache['data']
        if time.monotonic() < _research_retry:
            if _research_cache:
                return {**_research_cache['data'], 'status':'stale'}
            return {'status':'unavailable','groups':{},'error':'Türkiye serileri şu anda araştırılamıyor.'}
        key = os.getenv('FRED_API_KEY','').strip()
        if not key:
            return {'status':'not_configured','groups':{},'error':'FRED bağlantısı yapılandırılmamış.'}
        rows, failures = [], 0
        for country in ('Turkey', 'Türkiye'):
            try:
                response = requests.get('https://api.stlouisfed.org/fred/series/search',
                    params={'api_key':key,'file_type':'json','search_text':country,'limit':200,'order_by':'popularity','sort_order':'desc'},timeout=(5,15))
                if response.status_code != 200:
                    logger.warning('[Makro TR] Arama alınamadı (HTTP %s)',response.status_code)
                    failures += 1
                    continue
                batch = response.json().get('seriess')
                if not isinstance(batch,list):
                    raise ValueError('Invalid series search')
                rows.extend(batch)
            except (requests.RequestException,ValueError,TypeError,AttributeError) as exc:
                logger.warning('[Makro TR] Arama hatası (%s)',type(exc).__name__)
                failures += 1
        if not rows:
            _research_retry = time.monotonic() + 60
            if _research_cache:
                return {**_research_cache['data'],'status':'stale'}
            return {'status':'unavailable','groups':{},'error':'FRED Türkiye arama yanıtı alınamadı.'}
        data = {'status':'partial' if failures else 'ok','checked_at':datetime.now(timezone.utc).isoformat(),
                **summarize_turkey_series(rows),
                'note':'Gözlem sonu, yayın tarihi değildir. Adaylar değerlendirme içindir; gösterge seçimleri henüz değişmedi.'}
        _research_cache = {'data':data,'expires':time.monotonic()+(300 if failures else 86400)}
        return data
