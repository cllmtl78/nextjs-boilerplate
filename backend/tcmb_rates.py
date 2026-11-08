"""Daily indicative FX rates. Browser XSLT is unnecessary: parse the raw XML."""
from datetime import datetime
from decimal import Decimal, InvalidOperation
import logging
import threading
import time
import xml.etree.ElementTree as ET

import requests

SOURCE = 'https://www.tcmb.gov.tr/kurlar/today.xml'
CURRENCIES = {'USD': 'ABD Doları', 'EUR': 'Euro', 'GBP': 'İngiliz Sterlini',
              'CHF': 'İsviçre Frangı', 'JPY': 'Japon Yeni', 'CAD': 'Kanada Doları',
              'AUD': 'Avustralya Doları', 'SAR': 'Suudi Arabistan Riyali'}
_lock = threading.Lock()
_cache = None
_next_attempt = 0
_failed = False
logger = logging.getLogger(__name__)


def parse_rates(content):
    if len(content) > 1_000_000 or b'<!ENTITY' in content.upper() or b'<!DOCTYPE' in content.upper():
        raise ValueError('Unexpected XML content')
    root = ET.fromstring(content)
    if root.tag != 'Tarih_Date':
        raise ValueError('Unexpected XML root')
    date = datetime.strptime(root.attrib['Tarih'], '%d.%m.%Y').date().isoformat()
    found = {}
    for node in root.findall('Currency'):
        code = node.attrib.get('CurrencyCode', '')
        if code not in CURRENCIES:
            continue
        unit = int(node.findtext('Unit', '1'))
        if unit <= 0:
            raise ValueError('Invalid currency unit')
        def price(field):
            raw = (node.findtext(field) or '').strip()
            if not raw:
                return None
            value = Decimal(raw)
            if not value.is_finite() or value <= 0:
                raise ValueError('Invalid FX value')
            return str(value)
        found[code] = {'code': code, 'name': CURRENCIES[code], 'unit': unit,
                       'buy': price('ForexBuying'), 'sell': price('ForexSelling')}
    if any(code not in found for code in CURRENCIES):
        raise ValueError('Incomplete FX table')
    if any(item['buy'] is None and item['sell'] is None for item in found.values()):
        raise ValueError('Missing FX quotes')
    return {'date': date, 'data': [found[code] for code in CURRENCIES]}


def get_tcmb_rates():
    global _cache, _next_attempt, _failed
    with _lock:
        if time.monotonic() >= _next_attempt:
            try:
                response = requests.get(SOURCE, timeout=(5, 12), headers={'User-Agent': 'BPT-Finans-RSS/1.0'})
                response.raise_for_status()
                parsed = parse_rates(response.content)
                _cache = parsed
                _failed = False
                _next_attempt = time.monotonic() + 300
            except (requests.RequestException, ValueError, KeyError, ET.ParseError, InvalidOperation) as exc:
                _failed = True
                _next_attempt = time.monotonic() + 60
                logger.warning('[TCMB] Kur tablosu alınamadı: %s', type(exc).__name__)
        snapshot = _cache or {'date': None, 'data': []}
        return {**snapshot, 'status': 'stale' if _cache and _failed else 'unavailable' if not _cache else 'ok',
                'source': 'TCMB', 'count': len(snapshot['data'])}
