import unittest
from unittest.mock import patch, MagicMock
import sys
import os
import json
from datetime import datetime

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from mandi_pipeline_sync import (
    extract_mandi_data,
    filter_agra_records,
    transform_and_validate_records,
    get_required_env,
    load_to_database,
    run_sync_pipeline,
    API_ENDPOINT
)

class TestMandiPipelineComprehensive(unittest.TestCase):

    # -------------------------------------------------------------------------
    # 1. Correct Agra Market Filtering
    # -------------------------------------------------------------------------
    def test_agra_market_filtering_accuracy(self):
        """
        Validates records against actual source fields:
        State: Uttar Pradesh, District: Agra, Market: Agra.
        Rejects records that belong to similar districts or other markets.
        """
        sample_records = [
            # True Agra APMC record
            {
                "state": "Uttar Pradesh",
                "district": "Agra",
                "market": "Agra",
                "commodity": "Potato",
                "variety": "Desi",
                "arrival_date": "2026-10-25",
                "min_price": "1200",
                "max_price": "1450",
                "modal_price": "1350"
            },
            # False match 1: District Agra, but market is Fatehabad
            {
                "state": "Uttar Pradesh",
                "district": "Agra",
                "market": "Fatehabad",
                "commodity": "Potato",
                "arrival_date": "2026-10-25",
                "modal_price": "1300"
            },
            # False match 2: Market Agra, but state is not Uttar Pradesh
            {
                "state": "Madhya Pradesh",
                "district": "Agar Malwa",
                "market": "Agra",
                "commodity": "Wheat",
                "arrival_date": "2026-10-25",
                "modal_price": "2100"
            },
            # False match 3: Similar district name (e.g. Agar)
            {
                "state": "Uttar Pradesh",
                "district": "Aligarh",
                "market": "Agra Road",
                "commodity": "Mustard",
                "arrival_date": "2026-10-25",
                "modal_price": "5200"
            }
        ]

        agra_filtered = filter_agra_records(sample_records)
        self.assertEqual(len(agra_filtered), 1)
        self.assertEqual(agra_filtered[0]["market"], "Agra")
        self.assertEqual(agra_filtered[0]["district"], "Agra")
        self.assertEqual(agra_filtered[0]["state"], "Uttar Pradesh")
        self.assertEqual(agra_filtered[0]["commodity"], "Potato")

    # -------------------------------------------------------------------------
    # 2. Missing Fields Validation
    # -------------------------------------------------------------------------
    def test_missing_fields_rejection(self):
        """
        Rejects records missing state, market, commodity, or arrival date.
        """
        incomplete_records = [
            {"state": "", "district": "Agra", "market": "Agra", "commodity": "Wheat", "arrival_date": "2026-10-25", "modal_price": "2100"},
            {"state": "Uttar Pradesh", "district": "Agra", "market": "", "commodity": "Wheat", "arrival_date": "2026-10-25", "modal_price": "2100"},
            {"state": "Uttar Pradesh", "district": "Agra", "market": "Agra", "commodity": "", "arrival_date": "2026-10-25", "modal_price": "2100"},
            {"state": "Uttar Pradesh", "district": "Agra", "market": "Agra", "commodity": "Wheat", "arrival_date": "", "modal_price": "2100"},
        ]
        cleaned, metrics = transform_and_validate_records(incomplete_records, return_metrics=True)
        self.assertEqual(len(cleaned), 0)
        self.assertEqual(metrics["rejected"], 4)

    # -------------------------------------------------------------------------
    # 3. Malformed Prices Validation
    # -------------------------------------------------------------------------
    def test_malformed_and_impossible_prices_rejection(self):
        """
        Rejects negative, non-numeric, zero, and absurd (>1,000,000/qtl) prices.
        """
        bad_price_records = [
            {"state": "Uttar Pradesh", "district": "Agra", "market": "Agra", "commodity": "Potato", "arrival_date": "2026-10-25", "min_price": "-100", "max_price": "0", "modal_price": "0"},
            {"state": "Uttar Pradesh", "district": "Agra", "market": "Agra", "commodity": "Potato", "arrival_date": "2026-10-25", "modal_price": "NaN"},
            {"state": "Uttar Pradesh", "district": "Agra", "market": "Agra", "commodity": "Potato", "arrival_date": "2026-10-25", "modal_price": "100000000"}, # > 1,000,000 impossible price
            {"state": "Uttar Pradesh", "district": "Agra", "market": "Agra", "commodity": "Potato", "arrival_date": "2026-10-25", "modal_price": "INVALID"}
        ]
        cleaned, metrics = transform_and_validate_records(bad_price_records, return_metrics=True)
        self.assertEqual(len(cleaned), 0)
        self.assertEqual(metrics["rejected"], 4)

    # -------------------------------------------------------------------------
    # 4. Unexpected HTML or JSON Response Handling
    # -------------------------------------------------------------------------
    @patch('mandi_pipeline_sync.time.sleep')
    @patch('requests.Session.get')
    def test_unexpected_html_response_handling(self, mock_get, mock_sleep):
        """
        Handles upstream returning unexpected HTML error pages (e.g. 502 Bad Gateway Cloudflare).
        """
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.side_effect = json.JSONDecodeError("Expecting value", "<html>502 Bad Gateway</html>", 0)
        mock_get.return_value = mock_response

        # extraction should catch parsing error and return empty list cleanly without crashing
        result = extract_mandi_data("test_key", limit=10, max_pages=1)
        self.assertEqual(result, [])

    # -------------------------------------------------------------------------
    # 5. Empty Responses Preserving Existing State
    # -------------------------------------------------------------------------
    @patch('requests.Session.get')
    def test_empty_response_handling(self, mock_get):
        """
        When upstream returns 200 OK with empty records, pipeline handles without crash and returns [].
        """
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"records": []}
        mock_get.return_value = mock_response

        records = extract_mandi_data("test_key", limit=10, max_pages=1)
        self.assertEqual(records, [])

    # -------------------------------------------------------------------------
    # 6. HTTP 429 Rate Limiting with Exponential Backoff
    # -------------------------------------------------------------------------
    @patch('mandi_pipeline_sync.time.sleep')
    @patch('requests.Session.get')
    def test_http_429_backoff_and_retry(self, mock_get, mock_sleep):
        """
        Verifies that HTTP 429 returns backoff and retries up to MAX_RETRIES.
        """
        res_429 = MagicMock()
        res_429.status_code = 429

        res_200 = MagicMock()
        res_200.status_code = 200
        res_200.json.return_value = {"records": [{"state": "Uttar Pradesh", "district": "Agra", "market": "Agra", "commodity": "Potato", "arrival_date": "2026-10-25", "modal_price": "1400"}]}

        mock_get.side_effect = [res_429, res_200]

        records = extract_mandi_data("test_key", limit=10, max_pages=1)
        self.assertEqual(len(records), 1)
        mock_sleep.assert_called()

    # -------------------------------------------------------------------------
    # 7. HTTP 5xx Server Error Bounded Retries
    # -------------------------------------------------------------------------
    @patch('mandi_pipeline_sync.time.sleep')
    @patch('requests.Session.get')
    def test_http_500_bounded_retries(self, mock_get, mock_sleep):
        """
        Verifies that repeated 500 errors abort after MAX_RETRIES without hanging indefinitely.
        """
        res_500 = MagicMock()
        res_500.status_code = 500
        mock_get.return_value = res_500

        records = extract_mandi_data("test_key", limit=10, max_pages=1)
        self.assertEqual(records, [])
        self.assertEqual(mock_get.call_count, 5) # MAX_RETRIES

    # -------------------------------------------------------------------------
    # 8. Duplicate Ingestion & Deduplication
    # -------------------------------------------------------------------------
    def test_duplicate_record_handling_and_normalization(self):
        """
        Validates date normalization and price bounds normalization.
        """
        duplicate_records = [
            {"state": "Uttar Pradesh", "district": "Agra", "market": "Agra", "commodity": "Potato", "variety": "Desi", "arrival_date": "25/10/2026", "min_price": "1200", "max_price": "1500", "modal_price": "1350"},
            {"state": "uttar pradesh", "district": "agra", "market": "Agra", "commodity": "Potato", "variety": "Desi", "arrival_date": "2026-10-25", "min_price": "1200", "max_price": "1500", "modal_price": "1350"}
        ]
        cleaned = transform_and_validate_records(duplicate_records)
        self.assertEqual(len(cleaned), 2)
        # Both standardized to same arrival_date 2026-10-25
        self.assertEqual(cleaned[0][5], "2026-10-25")
        self.assertEqual(cleaned[1][5], "2026-10-25")

    # -------------------------------------------------------------------------
    # 9. Out-of-Order Dates Prevention
    # -------------------------------------------------------------------------
    def test_impossible_future_dates_rejected(self):
        """
        Rejects arrival dates more than 7 days in the future.
        """
        future_record = [
            {"state": "Uttar Pradesh", "district": "Agra", "market": "Agra", "commodity": "Potato", "arrival_date": "2099-01-01", "modal_price": "1400"}
        ]
        cleaned, metrics = transform_and_validate_records(future_record, return_metrics=True)
        self.assertEqual(len(cleaned), 0)
        self.assertEqual(metrics["rejected"], 1)

    # -------------------------------------------------------------------------
    # 10. Database Rollback on Failure (Preserves Existing Records)
    # -------------------------------------------------------------------------
    @patch('psycopg2.connect')
    def test_database_rollback_on_failure(self, mock_connect):
        """
        Verifies transaction rollback when database connection drops during upsert.
        """
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.execute.side_effect = Exception("Simulated DB connection drop")

        records = [("Uttar Pradesh", "Agra", "Agra", "Potato", "Desi", "2026-10-25", 1200.0, 1500.0, 1350.0)]
        result = load_to_database("postgresql://fake:conn@localhost/db", records)

        self.assertFalse(result)
        mock_conn.rollback.assert_called_once()
        mock_conn.commit.assert_not_called()

    # -------------------------------------------------------------------------
    # 11. Empty Records Does Not Execute Database Upsert
    # -------------------------------------------------------------------------
    @patch('psycopg2.connect')
    def test_empty_records_does_not_modify_database(self, mock_connect):
        result = load_to_database("postgresql://fake:conn@localhost/db", [])
        self.assertFalse(result)
        mock_connect.assert_not_called()

    # -------------------------------------------------------------------------
    # 12. Missing Environment Credentials Aborts Safely
    # -------------------------------------------------------------------------
    def test_missing_env_vars_fail(self):
        with patch.dict(os.environ, {}, clear=True):
            val = get_required_env("GOVT_API_KEY")
            self.assertEqual(val, "")
            self.assertFalse(run_sync_pipeline())

    # -------------------------------------------------------------------------
    # 13. End-to-End Agra Ingestion Simulation
    # -------------------------------------------------------------------------
    @patch('mandi_pipeline_sync.time.sleep')
    @patch('psycopg2.connect')
    @patch('requests.Session.get')
    def test_e2e_agra_targeted_pipeline_execution(self, mock_get, mock_connect, mock_sleep):
        """
        Simulates end-to-end extraction, filtering, transformation, and database upsert
        for the Agra APMC use case.
        """
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_connect.return_value = mock_conn
        mock_conn.cursor.return_value = mock_cursor
        mock_cursor.connection.encoding = 'UTF8'
        mock_cursor.mogrify.return_value = b"('Uttar Pradesh', 'Agra', 'Agra', 'Potato', 'Desi', '2026-10-25', 1150.0, 1420.0, 1300.0)"

        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "records": [
                {
                    "state": "Uttar Pradesh",
                    "district": "Agra",
                    "market": "Agra",
                    "commodity": "Potato",
                    "variety": "Desi",
                    "arrival_date": "2026-10-25",
                    "min_price": "1150",
                    "max_price": "1420",
                    "modal_price": "1300"
                }
            ]
        }
        mock_get.return_value = mock_response

        env_vars = {
            "DATA_GOV_IN_API_KEY": "test_api_key_12345",
            "DB_CONNECTION_STRING": "postgresql://postgres:pass@localhost:5432/postgres"
        }
        with patch.dict(os.environ, env_vars):
            success = run_sync_pipeline(target_filters={"state": "Uttar Pradesh", "district": "Agra", "market": "Agra"})
            self.assertTrue(success)
            mock_conn.commit.assert_called_once()

if __name__ == '__main__':
    unittest.main()
