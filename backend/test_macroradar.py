import copy
import json
from pathlib import Path
import unittest
from unittest.mock import Mock, patch

import macroradar as bot

FOLDER=Path(__file__).parent/'fixtures'

def fixture(name):return json.loads((FOLDER/f'macroradar-{name}.json').read_text())


class InsightTests(unittest.TestCase):
    def test_live_shape_freshness_ranking_and_licensed_levels(self):
        data=bot.parse_moving(fixture('moving'))
        self.assertEqual(data['data'][0]['id'],'TLRESCONS')
        self.assertEqual(data['excluded_old'],1)
        self.assertEqual(len(data['data']),4)
        self.assertFalse(any(row['id']=='TOTBKCR' for row in data['data']))
        vix=next(row for row in data['data'] if row['id']=='VIXCLS')
        self.assertTrue(vix['restricted'])
        self.assertAlmostEqual(vix['change'],86.87002652519892)
        self.assertFalse(any('latest_value' in row or 'prior_value' in row for row in data['data']))

    def test_percentage_point_change_is_not_relative_percent_and_urls_are_constrained(self):
        payload=fixture('moving')
        payload['data']['moves'][3]['chart_url']='javascript:alert(1)'
        data=bot.parse_moving(payload)
        treasury=next(row for row in data['data'] if row['id']=='DGS10')
        self.assertEqual(treasury['change_kind'],'level_pp')
        self.assertEqual(treasury['source_url'],bot.BASE)
        self.assertAlmostEqual(treasury['change'],-.43)

    def test_missing_or_wrong_schema_is_not_reported_as_valid_empty_data(self):
        payload=fixture('moving');payload['data']['moves'][0]['change']='bad'
        payload['data']['moves']=payload['data']['moves'][:1]
        with self.assertRaises(ValueError):bot.parse_moving(payload)
        payload=fixture('curve');payload['data']['open']=[{'unknown':'schema'}]
        with self.assertRaises(ValueError):bot.parse_curve(payload)

    def test_completed_curve_periods_are_historical_not_current_inversions(self):
        data=bot.parse_curve(fixture('curve'))
        self.assertEqual(data['open_count'],0)
        self.assertEqual(len(data['data']),12)
        latest=data['data'][0]
        self.assertEqual(latest['start_date'],'2022-07-06')
        self.assertEqual(latest['end_date'],'2024-09-05')
        self.assertEqual(latest['days'],792)
        self.assertEqual(latest['extreme'],-1.08)

    def test_open_episode_uses_asof_and_does_not_duplicate(self):
        payload=fixture('curve')
        payload['data']['open']=[{'kind':'curve_inversion','series_id':'T10Y2Y','start_date':'2026-11-01','extreme_value':-.1}]
        data=bot.parse_curve(payload)
        self.assertEqual(data['open_count'],1)
        self.assertEqual(data['data'][0]['days'],7)
        self.assertIsNone(data['data'][0]['end_date'])

    def test_independent_refresh_failure_preserves_prior_attribution_and_dates(self):
        moving=bot.parse_moving(fixture('moving'))
        response=Mock(status_code=200,content=b'fixture')
        response.json.return_value=fixture('curve')
        state={'moving':{'status':'ok','data':moving},'curve':{'status':'starting','data':None}}
        with patch.object(bot,'_state',copy.deepcopy(state)),patch.object(bot.requests,'get',side_effect=[Mock(status_code=503),response]):
            bot.poll_once();data=bot.get_insights()
        self.assertEqual(data['moving']['status'],'stale')
        self.assertEqual(data['moving']['data']['generated_at'],moving['generated_at'])
        self.assertEqual(data['curve']['status'],'ok')
        self.assertEqual(data['curve']['data']['open_count'],0)


if __name__=='__main__':unittest.main()
