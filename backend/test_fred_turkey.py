import unittest
from fred_macro import summarize_turkey_series


class TurkeyResearchTests(unittest.TestCase):
    def test_recent_active_candidates_precede_discontinued_and_foreign_series_excluded(self):
        rows=[
            {'id':'OLD','title':'Consumer Price Index for Turkey (DISCONTINUED)','observation_end':'2026-10-01'},
            {'id':'CURRENT','title':'Consumer Price Index for Türkiye','observation_end':'2026-09-01','units':'Index','frequency':'Monthly'},
            {'id':'OTHER','title':'Consumer Price Index for Germany','observation_end':'2026-10-01'},
            {'id':'RATE','title':'Interest Rates: Interbank for Turkey','observation_end':'2026-10-01'},
        ]
        data=summarize_turkey_series(rows)
        self.assertEqual(data['candidate_count'],3)
        self.assertEqual(data['groups']['Enflasyon'][0]['id'],'CURRENT')
        self.assertTrue(data['groups']['Enflasyon'][1]['discontinued'])
        self.assertEqual(data['groups']['Faiz'][0]['id'],'RATE')

    def test_duplicate_queries_merge_and_public_output_has_no_arbitrary_upstream_fields(self):
        row={'id':'GDP','title':'Gross Domestic Product for Turkey','observation_end':'2026-07-01','api_key':'must-not-be-returned'}
        data=summarize_turkey_series([row,row])
        self.assertEqual(data['candidate_count'],1)
        self.assertEqual(len(data['groups']['Büyüme']),1)
        self.assertNotIn('api_key',data['groups']['Büyüme'][0])


if __name__=='__main__':unittest.main()
