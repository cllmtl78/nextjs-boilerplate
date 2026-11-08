"""Hourly, attributed MacroRadar derived insights; keep licensed raw levels out."""
from datetime import date, datetime, timezone
import logging
import math
import threading
from urllib.parse import urlparse

import requests

logger = logging.getLogger(__name__)
BASE = 'https://www.macroradar.io'
NAMES = {
 'TLRESCONS':'ABD konut inşaatı harcamaları','PPIFIS':'ABD nihai talep üretici fiyat endeksi',
 'VIXCLS':'VIX oynaklık endeksi','JTSQUR':'ABD işten ayrılma oranı','PPIACO':'ABD emtia üretici fiyat endeksi',
 'IRLTLT01FRM156N':'Fransa 10 yıllık tahvil getirisi','ECB_IRS_EA_10Y':'Euro Bölgesi 10 yıllık tahvil getirisi',
 'NASDAQCOM':'Nasdaq Bileşik Endeksi','DGS30':'ABD 30 yıllık tahvil getirisi','DGS10':'ABD 10 yıllık tahvil getirisi',
 'RHORUSQ156N':'ABD konut sahipliği oranı','BOC_V39079':'Kanada gecelik hedef faizi','BOE_IUDBEDR':'İngiltere politika faizi',
 'DCPN3M':'ABD 90 günlük finans dışı ticari kâğıt faizi','TTLCONS':'ABD toplam inşaat harcamaları',
 'MSPUS':'ABD yeni konut medyan satış fiyatı','CPIAUCSL':'ABD TÜFE endeksi','IRLTLT01DEM156N':'Almanya 10 yıllık tahvil getirisi',
 'DGS2':'ABD 2 yıllık tahvil getirisi','T10Y3M':'ABD 10 yıl − 3 ay faiz farkı','DFII10':'ABD 10 yıllık reel faiz',
 'IMPGS':'ABD mal ve hizmet ithalatı','SP500':'S&P 500 Endeksi','PCEPI':'ABD PCE fiyat endeksi',
 'DCOILBRENTEU':'Brent petrol spot fiyatı','CP0000EZ19M086NEST':'Euro Bölgesi uyumlaştırılmış TÜFE',
 'OECD_JPN_PRVM':'Japonya sanayi üretimi','BAMLH0A0HYM2':'ABD yüksek getirili şirket tahvili farkı',
 'UMCSENT':'ABD tüketici güven endeksi','U6RATE':'ABD geniş tanımlı işgücü atıl kullanım oranı',
 'MRTSSM44X72USS':'ABD perakende ve yiyecek hizmetleri satışları','T5YIFR':'ABD 5 yıl sonrası 5 yıllık enflasyon beklentisi',
 'RRPONTSYD':'Fed gecelik ters repo işlemleri','IPG2211A2N':'ABD kamu hizmetleri sanayi üretimi',
 'CAPG211S':'ABD petrol ve gaz çıkarma kapasitesi','CES0500000003':'ABD özel sektör ortalama saatlik kazancı',
 'JTSLDL':'ABD işten çıkarmalar','MORTGAGE30US':'ABD 30 yıllık konut kredisi faizi',
 'ACOGNO':'ABD tüketim malları yeni siparişleri','IRLTLT01GBM156N':'İngiltere 10 yıllık tahvil getirisi',
 'OECD_GBR_PRVM':'İngiltere sanayi üretimi','T10Y2Y':'ABD 10 yıl − 2 yıl faiz farkı',
 'IRLTLT01CAM156N':'Kanada 10 yıllık tahvil getirisi','JTSHIR':'ABD işe alım oranı','LRHUTTTTJPM156S':'Japonya işsizlik oranı',
 'REVOLSL':'ABD döner tüketici kredileri','T10YIE':'ABD 10 yıllık başa baş enflasyon oranı',
 'PCEPILFE':'ABD çekirdek PCE fiyat endeksi','CPILFESL':'ABD çekirdek TÜFE endeksi','CUSR0000SAH1':'ABD barınma TÜFE endeksi',
 'RRVRUSQ156N':'ABD kiralık konut boşluk oranı','IRLTLT01JPM156N':'Japonya 10 yıllık tahvil getirisi',
 'DEXCHUS':'USD/CNY döviz kuru','AMTMNO':'ABD imalat sanayisi yeni siparişleri','BAA':'ABD Baa şirket tahvili getirisi',
 'OPHNFB':'ABD tarım dışı işgücü verimliliği','TCU':'ABD toplam kapasite kullanım oranı','JTSJOL':'ABD açık iş sayısı',
 'ECIALLCIV':'ABD toplam işgücü maliyet endeksi','DEXCAUS':'USD/CAD döviz kuru','BAMLHE00EHYIOAS':'Euro yüksek getirili tahvil farkı',
 'IPG211S':'ABD petrol ve gaz çıkarma üretimi','TB3MS':'ABD aylık 3 aylık Hazine bonosu faizi',
 'ISRATIO':'ABD işletme stok/satış oranı','OECD_GBR_CPI':'İngiltere tüketici fiyat endeksi',
 'ICSA':'ABD ilk işsizlik maaşı başvuruları','FGEXPND':'ABD federal kamu cari harcamaları','BAA10Y':'ABD Baa tahvil faiz farkı',
 'UNRATE':'ABD işsizlik oranı','RSAFS':'ABD perakende satışları','DHHNGSP':'Henry Hub doğal gaz spot fiyatı',
 'GACDFSA066MSFRBPHI':'Philadelphia Fed genel faaliyet endeksi','FEDFUNDS':'ABD aylık etkin federal fon faizi',
 'BUSLOANS':'ABD ticari ve sınai banka kredileri','DTB3':'ABD 3 aylık Hazine bonosu faizi','DEXUSEU':'EUR/USD döviz kuru',
 'HOUST':'ABD konut başlangıçları','INDPRO':'ABD sanayi üretim endeksi','BUSINV':'ABD işletme stokları',
 'GS10':'ABD aylık 10 yıllık tahvil getirisi','CUSR0000SETA02':'ABD ikinci el araç TÜFE endeksi',
 'CIVPART':'ABD işgücüne katılım oranı','GDPC1':'ABD reel GSYH','M1SL':'ABD M1 para arzı','PCE':'ABD kişisel tüketim harcamaları',
 'W875RX1':'ABD transferler hariç reel kişisel gelir','WHLSLRIMSA':'ABD toptancı stokları','M2SL':'ABD M2 para arzı',
 'ECBDFR':'ECB mevduat faizi','ECBMLFR':'ECB marjinal borç verme faizi','ECBMRRFR':'ECB ana refinansman faizi',
 'TOTALSL':'ABD toplam tüketici kredileri','DGORDER':'ABD dayanıklı mal yeni siparişleri','SOFR':'ABD teminatlı gecelik finansman faizi',
 'DFEDTARU':'Fed hedef faiz aralığı üst sınırı','GDP':'ABD nominal GSYH','BOGMBASE':'ABD parasal tabanı',
 'OECD_CAN_CPI':'Kanada tüketici fiyat endeksi','DSPIC96':'ABD reel kullanılabilir kişisel gelir',
 'GDPDEF':'ABD GSYH fiyat deflatörü','PSAVERT':'ABD kişisel tasarruf oranı','T5YIE':'ABD 5 yıllık başa baş enflasyon oranı',
 'GS2':'ABD aylık 2 yıllık tahvil getirisi','DEXUSUK':'GBP/USD döviz kuru','WTREGEN':'ABD Hazine genel hesabı bakiyesi',
 'EMRATIO':'ABD istihdam/nüfus oranı','IPMAN':'ABD imalat sanayisi üretimi','CONSUMER':'ABD banka tüketici kredileri',
 'DTWEXBGS':'ABD geniş dolar endeksi','DCOILWTICO':'WTI petrol spot fiyatı','DFF':'ABD etkin federal fon faizi',
 'RETAILIMSA':'ABD perakendeci stokları','CUSR0000SAM2':'ABD sağlık hizmetleri TÜFE endeksi',
 'AWHMAN':'ABD imalat sektörü haftalık çalışma süresi','COMPRNFB':'ABD reel saatlik ücretleri',
 'EXPGS':'ABD mal ve hizmet ihracatı','AWHAETP':'ABD özel sektör haftalık çalışma süresi','PAYEMS':'ABD tarım dışı istihdam',
 'EUROSTAT_UNE_RT_M_EA':'Euro Bölgesi işsizlik oranı','NONREVSL':'ABD döner olmayan tüketici kredileri',
 'CCLACBW027SBOG':'ABD banka kredi kartı ve döner kredileri','CUMFNS':'ABD imalat kapasite kullanım oranı',
 'DTCOLNVHFNM':'ABD finansman şirketleri taşıt kredileri','REALLN':'ABD banka gayrimenkul kredileri',
 'NEWORDER':'ABD çekirdek sermaye malı siparişleri','CSUSHPINSA':'ABD Case-Shiller konut fiyat endeksi',
 'PCOPPUSDM':'Küresel bakır fiyatı','CREACBW027SBOG':'ABD ticari gayrimenkul kredileri','PI':'ABD kişisel gelir',
 'LRUNTTTTCAM156S':'Kanada işsizlik oranı','ULCNFB':'ABD tarım dışı birim işgücü maliyeti',
 'SHILLER_CAPE':'Shiller fiyat/kazanç oranı','SAHMREALTIME':'Sahm kuralı göstergesi','HSN1F':'ABD yeni müstakil konut satışları',
 'PERMIT':'ABD yapı ruhsatları','OECD_CAN_PRVM':'Kanada sanayi üretimi','DEXJPUS':'USD/JPY döviz kuru',
 'ECBASSETSW':'Euro Bölgesi merkez bankası varlıkları','WALCL':'Fed bilançosu',
}
CATEGORIES = {'housing':'Konut','inflation':'Enflasyon','employment':'İstihdam','interest_rates':'Faiz',
              'financial':'Piyasalar','yield_curve':'Faiz eğrisi','gdp':'Büyüme','leading':'Öncü göstergeler',
              'credit':'Kredi','consumer':'Tüketim'}


def iso_date(value):
    if not isinstance(value,str): raise ValueError('Missing date')
    parsed=date.fromisoformat(value)
    if parsed.isoformat()!=value: raise ValueError('Invalid date')
    return value


def number(value):
    return isinstance(value,(int,float)) and not isinstance(value,bool) and math.isfinite(value)


def safe_link(value, fallback=BASE):
    if isinstance(value,str):
        parsed=urlparse(value)
        if parsed.scheme=='https' and parsed.hostname in ('www.macroradar.io','macroradar.io') and not parsed.username and not parsed.password:
            return value
    return fallback


def meta_data(envelope):
    meta=envelope.get('meta')
    if not isinstance(meta,dict) or meta.get('source') != 'MacroRadar' or 'data' not in envelope: raise ValueError('Missing envelope')
    generated=meta.get('generated_at')
    if not isinstance(generated,str): raise ValueError('Missing generation time')
    parsed=datetime.fromisoformat(generated.replace('Z','+00:00'))
    if parsed.tzinfo is None: raise ValueError('Missing time zone')
    return {'provider':'MacroRadar','source_url':BASE,'method_url':safe_link(meta.get('method_url'),BASE+'/developers'),
            'generated_at':generated}


def parse_moving(envelope):
    meta=meta_data(envelope)
    data=envelope['data']
    if not isinstance(data,dict): raise ValueError('Invalid data')
    as_of=iso_date(data.get('as_of'))
    if not isinstance(data.get('moves'),list): raise ValueError('Missing moves')
    result={}
    excluded=0
    for row in data['moves']:
        if not isinstance(row,dict) or row.get('fresh') is not True:
            excluded+=1; continue
        try:
            code=row['series_id']
            latest=iso_date(row.get('latest_date')); prior=iso_date(row.get('prior_date')); start=iso_date(row.get('history_start'))
            change=row.get('change'); percentile=row.get('surprise_percentile'); sample=row.get('sample_size')
            if not isinstance(code,str) or len(code)>64 or not number(change) or not number(percentile) or not 0<=percentile<=100 or not isinstance(sample,int) or isinstance(sample,bool) or sample<=0 or prior>latest or latest>as_of or start>latest:
                continue
            kind=row.get('change_kind')
            window=row.get('window')
            if kind not in ('percent','level_pp') or window not in ('month','quarter') or row.get('rarity') not in ('rare','unusual','typical','quiet'): continue
            restricted=bool(row.get('value_note'))
            # Deliberately omit ALL raw latest/prior levels: units are absent here.
            result[code]={'id':code,'name':NAMES.get(code,code),'category':CATEGORIES.get(row.get('category'),'Diğer'),
                'change':change,'change_kind':kind,'window':window,'percentile':percentile,
                'rarity':row.get('rarity') if row.get('rarity') in ('rare','unusual','typical','quiet') else 'typical',
                'latest_date':latest,'prior_date':prior,'history_start':start,'sample_size':sample,
                'restricted':restricted,'source_url':safe_link(row.get('chart_url'))}
        except (KeyError,ValueError,TypeError): continue
    if not result and any(isinstance(row,dict) and row.get('fresh') is True for row in data['moves']):
        raise ValueError('Unrecognized fresh moves')
    return {**meta,'as_of':as_of,'data':sorted(result.values(),key=lambda item:item['percentile'],reverse=True),'excluded_old':excluded}


def parse_curve(envelope):
    meta=meta_data(envelope)
    data=envelope['data']
    if not isinstance(data,dict): raise ValueError('Invalid data')
    as_of=iso_date(data.get('as_of'))
    if not isinstance(data.get('open'),list) or not isinstance(data.get('episodes'),list): raise ValueError('Missing episodes')
    records={}
    for is_open,rows in [(False,data['episodes']),(True,data['open'])]:
        for row in rows:
            if not isinstance(row,dict) or row.get('kind')!='curve_inversion' or row.get('series_id')!='T10Y2Y': continue
            try:
                start=iso_date(row.get('start_date'))
                end=None if is_open else iso_date(row.get('end_date'))
                extreme=row.get('extreme_value')
                if start>as_of or (end is not None and (end<start or end>as_of)) or (extreme is not None and (not number(extreme) or extreme>0)): continue
                records[start]={'id':start,'start_date':start,'end_date':end,'open':is_open,
                    'days':(date.fromisoformat(end or as_of)-date.fromisoformat(start)).days,
                    'extreme':extreme,'source_url':safe_link(row.get('chart_url'),BASE+'/yield-curve')}
            except (TypeError,ValueError): continue
    if data['open'] and sum(item['open'] for item in records.values()) != len(data['open']):
        raise ValueError('Unrecognized open episode')
    if data['episodes'] and not records:
        raise ValueError('Unrecognized episode records')
    episodes=sorted(records.values(),key=lambda item:item['start_date'],reverse=True)
    return {**meta,'as_of':as_of,'data':episodes,'open_count':sum(item['open'] for item in episodes)}


PARSERS={'moving':parse_moving,'curve':parse_curve}
PATHS={'moving':'/api/v1/whats-moving','curve':'/api/v1/episodes?series=T10Y2Y'}
_lock=threading.RLock()
_state={key:{'status':'starting','data':None} for key in PATHS}
_worker=None


def poll_once():
    for kind,path in PATHS.items():
        try:
            response=requests.get(BASE+path,headers={'Accept':'application/json','User-Agent':'BPT-Finans/1.0'},timeout=(5,20))
            if response.status_code!=200:
                logger.warning('[MacroRadar] %s HTTP %s',kind,response.status_code)
                raise ValueError('Provider error')
            if len(response.content)>3_000_000: raise ValueError('Response too large')
            parsed=PARSERS[kind](response.json())
            with _lock: _state[kind]={'status':'ok','data':parsed}
        except (requests.RequestException,ValueError,TypeError,KeyError,AttributeError) as exc:
            logger.warning('[MacroRadar] %s alınamadı (%s)',kind,type(exc).__name__)
            with _lock: _state[kind]={'status':'stale' if _state[kind]['data'] is not None else 'unavailable','data':_state[kind]['data']}


def get_insights():
    with _lock:
        return {key:dict(value) for key,value in _state.items()}


def start_macroradar_bot():
    global _worker
    with _lock:
        if _worker is not None and _worker.is_alive(): return
        def run():
            while True:
                try: poll_once()
                except Exception as exc: logger.warning('[MacroRadar] İşçi hatası (%s)',type(exc).__name__)
                threading.Event().wait(3600)
        _worker=threading.Thread(target=run,name='macroradar',daemon=True)
        _worker.start()
