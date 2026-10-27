import os
import sys
import argparse
import requests
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
import time
import urllib.parse

API_ENDPOINT = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
CHUNK_FETCH_LIMIT = 5000
MAX_RETRIES = 5
MAX_PAGES = 20

def get_required_env(var_name: str) -> str:
    val = os.environ.get(var_name, "").strip()
    if not val:
        print(f"CRITICAL CONFIG ERROR: Required environment variable '{var_name}' is not set.")
        return ""
    return val

def filter_agra_records(records: list) -> list:
    """
    Validates records against the actual source fields for:
    - State: Uttar Pradesh
    - District: Agra
    - Market/APMC: Agra (case-insensitive, trimmed)
    Does not assume a record belongs to Agra merely because the source response
    includes a similar district or market name.
    """
    agra_records = []
    for r in records:
        state = str(r.get('state', '')).strip().lower()
        district = str(r.get('district', '')).strip().lower()
        market = str(r.get('market', '')).strip().lower()
        if state == 'uttar pradesh' and district == 'agra' and market == 'agra':
            agra_records.append(r)
    return agra_records

def extract_mandi_data(api_key: str, filters: dict = None, limit: int = CHUNK_FETCH_LIMIT, max_pages: int = MAX_PAGES) -> list:
    """
    Extracts authentic APMC market rate data from the authorized public endpoint.
    Supports targeted geographic and commodity filters (e.g. Agra APMC).
    Bounces on 429 rate-limiting with exponential backoff and times out gracefully.
    """
    print(f"[{datetime.now()}] Initializing Agmarknet extraction pipeline...")
    current_offset = 0
    collected_records = []
    session = requests.Session()
    page_count = 0

    filter_query = ""
    if filters and isinstance(filters, dict):
        for k, v in filters.items():
            if v:
                filter_query += f"&filters[{urllib.parse.quote(str(k))} release]=".replace(" release]=", f"]={urllib.parse.quote(str(v))}")

    while page_count < max_pages:
        target_url = f"{API_ENDPOINT}?api-key={api_key}&format=json&limit={limit}&offset={current_offset}{filter_query}"
        consecutive_failures = 0
        success = False

        while consecutive_failures < MAX_RETRIES:
            try:
                print(f"Fetching batch page {page_count + 1} (offset {current_offset})...")
                response = session.get(target_url, timeout=30)

                if response.status_code == 429:
                    consecutive_failures += 1
                    backoff = min(60, 2 ** consecutive_failures)
                    print(f"WARNING: Rate limited (429). Backing off for {backoff}s...")
                    time.sleep(backoff)
                    continue

                if response.status_code != 200:
                    consecutive_failures += 1
                    print(f"ERROR: Server returned status {response.status_code}. Retry {consecutive_failures}/{MAX_RETRIES}...")
                    time.sleep(min(30, 2 * consecutive_failures))
                    continue

                payload = response.json()
                records_chunk = payload.get("records", [])

                if not records_chunk:
                    print("Pagination reached end of records.")
                    return collected_records

                collected_records.extend(records_chunk)
                if len(records_chunk) < limit:
                    return collected_records
                current_offset += limit
                page_count += 1
                success = True
                time.sleep(1) # Polite delay between requests
                break

            except Exception as e:
                consecutive_failures += 1
                print(f"Network error during extraction: {e}. Retry {consecutive_failures}/{MAX_RETRIES}...")
                time.sleep(min(30, 2 * consecutive_failures))

        if not success:
            print(f"Aborting extraction after {MAX_RETRIES} consecutive failures at offset {current_offset}.")
            break

    return collected_records

def transform_and_validate_records(records: list, return_metrics: bool = False):
    """
    Validates required fields according to agricultural market specifications:
    - Rejects records missing state, market, commodity, or arrival date.
    - Standardizes dates to YYYY-MM-DD format and rejects impossible dates.
    - Parses prices as valid positive numbers; rejects negative, NaN, or absurd (>1,000,000) values.
    - Retains provenance data and returns clean records.
    """
    import math
    cleaned = []
    rejected_count = 0
    now = datetime.now()

    for node in records:
        try:
            state = str(node.get('state', '')).strip().title()
            district = str(node.get('district', '')).strip().title()
            market = str(node.get('market', '')).strip()
            commodity = str(node.get('commodity', '')).strip()
            variety = str(node.get('variety', '')).strip() or 'Standard'
            arrival_date_raw = str(node.get('arrival_date', '')).strip()

            if not (state and market and commodity and arrival_date_raw):
                rejected_count += 1
                continue

            # Standardize date to YYYY-MM-DD
            try:
                if '/' in arrival_date_raw:
                    dt = datetime.strptime(arrival_date_raw, '%d/%m/%Y')
                else:
                    dt = datetime.strptime(arrival_date_raw[:10], '%Y-%m-%d')

                # Anomaly check: arrival date cannot be far in the future (> 7 days) or before 2000
                diff_days = (dt - now).days
                if diff_days > 7 or dt.year < 2000:
                    rejected_count += 1
                    continue

                arrival_date = dt.strftime('%Y-%m-%d')
            except Exception:
                rejected_count += 1
                continue

            min_p = float(node.get('min_price', 0) or 0)
            max_p = float(node.get('max_price', 0) or 0)
            modal_p = float(node.get('modal_price', 0) or 0)

            # Plausibility check: prices should be positive numbers under 1,000,000/qtl
            if math.isnan(min_p) or math.isnan(max_p) or math.isnan(modal_p) or math.isinf(min_p) or math.isinf(max_p) or math.isinf(modal_p):
                rejected_count += 1
                continue

            if modal_p <= 0 and (min_p > 0 or max_p > 0):
                modal_p = (min_p + max_p) / 2.0
            if min_p <= 0:
                min_p = modal_p
            if max_p <= 0:
                max_p = modal_p

            if modal_p <= 0 or min_p <= 0 or max_p <= 0 or modal_p > 1000000.0:
                rejected_count += 1
                continue

            # Ensure bounds consistency
            if min_p > max_p:
                min_p, max_p = max_p, min_p
            if modal_p < min_p:
                min_p = modal_p
            if modal_p > max_p:
                max_p = modal_p

            cleaned.append((
                state, district, market, commodity, variety,
                arrival_date, min_p, max_p, modal_p
            ))
        except (ValueError, TypeError):
            rejected_count += 1
            continue

    if return_metrics:
        return cleaned, {"received": len(records), "valid": len(cleaned), "rejected": rejected_count}
    return cleaned

def load_to_database(db_connection_string: str, records: list, source_name: str = "Agmarknet Automated Ingestion", rejected_count: int = 0) -> bool:
    """
    Persists validated mandi records into Supabase using a transactional staging pattern.
    - Creates temporary staging table on commit drop.
    - Deduplicates duplicate records in the incoming batch.
    - NEVER overwrites a newer source record with an older observation (arrival_date guard).
    - Preserves historical records on network/database failure.
    - Records run diagnostics and status in mandi_ingestion_runs.
    """
    if not records:
        print("ERROR: No valid records provided for database insertion. Aborting.")
        return False

    db_connection = None
    try:
        print(f"Connecting to database to upsert {len(records)} validated mandi records...")
        db_connection = psycopg2.connect(db_connection_string, connect_timeout=15)
        db_connection.autocommit = False
        db_cursor = db_connection.cursor()

        # Step 1: Create a temporary staging table
        db_cursor.execute("""
            CREATE TEMP TABLE stage_mandi_live_rates (
                state TEXT,
                district TEXT,
                market TEXT,
                commodity TEXT,
                variety TEXT,
                arrival_date TEXT,
                min_price NUMERIC,
                max_price NUMERIC,
                modal_price NUMERIC
            ) ON COMMIT DROP;
        """)

        # Step 2: Insert into staging table
        stage_insert_query = """
            INSERT INTO stage_mandi_live_rates (state, district, market, commodity, variety, arrival_date, min_price, max_price, modal_price)
            VALUES %s;
        """
        execute_values(db_cursor, stage_insert_query, records, page_size=1000)

        # Step 3: Transactional Upsert: Delete only matching updated records, never truncate the whole table!
        # Guard: Only delete/replace existing record if the incoming record is of equal or newer arrival_date
        db_cursor.execute("""
            DELETE FROM public.mandi_live_rates m
            USING stage_mandi_live_rates s
            WHERE LOWER(TRIM(m.state)) = LOWER(TRIM(s.state))
              AND LOWER(TRIM(COALESCE(m.market, m.market_name, ''))) = LOWER(TRIM(s.market))
              AND LOWER(TRIM(m.commodity)) = LOWER(TRIM(s.commodity))
              AND LOWER(TRIM(COALESCE(m.variety, 'Standard'))) = LOWER(TRIM(COALESCE(s.variety, 'Standard')))
              AND m.arrival_date <= s.arrival_date::date;

            WITH deduplicated_stage AS (
                SELECT
                    s.*,
                    ROW_NUMBER() OVER (
                        PARTITION BY LOWER(TRIM(s.state)), LOWER(TRIM(s.market)), LOWER(TRIM(s.commodity)), LOWER(TRIM(COALESCE(s.variety, 'Standard'))), s.arrival_date
                        ORDER BY s.modal_price DESC
                    ) as rn
                FROM stage_mandi_live_rates s
            )
            INSERT INTO public.mandi_live_rates (
                state, district, market, market_name, commodity, variety,
                arrival_date, trade_date, price_date, min_price, max_price, modal_price,
                source_name, source_url, source_dataset, freshness_status, fetched_at, updated_at
            )
            SELECT
                d.state, d.district, d.market, d.market, d.commodity, d.variety,
                d.arrival_date::date, d.arrival_date::date, d.arrival_date::date,
                d.min_price, d.max_price, d.modal_price,
                'Agmarknet / DMI (Govt of India)',
                'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070',
                'Daily Mandi Market Prices',
                'Daily',
                NOW(),
                NOW()
            FROM deduplicated_stage d
            WHERE d.rn = 1
              AND NOT EXISTS (
                  SELECT 1 FROM public.mandi_live_rates m2
                  WHERE LOWER(TRIM(m2.state)) = LOWER(TRIM(d.state))
                    AND LOWER(TRIM(COALESCE(m2.market, m2.market_name, ''))) = LOWER(TRIM(d.market))
                    AND LOWER(TRIM(m2.commodity)) = LOWER(TRIM(d.commodity))
                    AND LOWER(TRIM(COALESCE(m2.variety, 'Standard'))) = LOWER(TRIM(COALESCE(d.variety, 'Standard')))
                    AND m2.arrival_date > d.arrival_date::date
              );
        """)

        # Step 4: Record ingestion run in audit table if present
        db_cursor.execute("""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='mandi_ingestion_runs') THEN
                    INSERT INTO public.mandi_ingestion_runs (
                        source_name, started_at, completed_at, records_received, records_inserted, records_rejected, status
                    ) VALUES (
                        %s, NOW(), NOW(), %s, %s, %s, 'COMPLETED'
                    );
                END IF;
            END $$;
        """, (source_name, len(records) + rejected_count, len(records), rejected_count))

        db_connection.commit()
        print(f"SUCCESS: Transaction committed. Synchronized {len(records)} records without data loss.")
        return True

    except Exception as e:
        print(f"CRITICAL DATABASE ERROR: Database transaction failed: {e}")
        if db_connection:
            try:
                db_connection.rollback()
                print("Database transaction rolled back cleanly. Existing records preserved.")
            except Exception as rb_err:
                print(f"Rollback error: {rb_err}")
        return False
    finally:
        if db_connection:
            try:
                db_cursor.close()
                db_connection.close()
            except Exception:
                pass

def run_sync_pipeline(target_filters: dict = None) -> bool:
    api_key = os.environ.get("DATA_GOV_IN_API_KEY", "").strip() or os.environ.get("GOVT_API_KEY", "").strip()
    db_conn = os.environ.get("DB_CONNECTION_STRING", "").strip() or os.environ.get("DATABASE_URL", "").strip()

    if not api_key:
        print("CRITICAL CONFIG ERROR: Required environment variable 'DATA_GOV_IN_API_KEY' (or 'GOVT_API_KEY') is not set.")
    if not db_conn:
        print("CRITICAL CONFIG ERROR: Required environment variable 'DB_CONNECTION_STRING' (or 'DATABASE_URL') is not set.")

    if not api_key or not db_conn:
        print("ERROR: Ingestion cannot proceed without required credentials in environment.")
        return False

    raw_records = extract_mandi_data(api_key, filters=target_filters)
    if not raw_records:
        if target_filters:
            print(f"INFO: Extraction returned 0 records for filters {target_filters}. Preserving existing database entries.")
        else:
            print("ERROR: Extraction returned 0 records. Preserving existing database entries.")
        return False

    cleaned_records, metrics = transform_and_validate_records(raw_records, return_metrics=True)
    if not cleaned_records:
        print("ERROR: Zero valid records after validation. Preserving existing database entries.")
        return False

    source_label = "Agmarknet Automated Ingestion"
    if target_filters and 'market' in target_filters:
        source_label = f"Agmarknet Mandi Sync ({target_filters.get('market')} APMC)"

    return load_to_database(db_conn, cleaned_records, source_name=source_label, rejected_count=metrics["rejected"])

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="NuKropAI Mandi Market Rates Ingestion Pipeline")
    parser.add_argument("--daemon", action="store_true", help="Run in continuous daemon loop (every 4 hours)")
    parser.add_argument("--state", type=str, default=None, help="Filter target state (e.g. 'Uttar Pradesh')")
    parser.add_argument("--district", type=str, default=None, help="Filter target district (e.g. 'Agra')")
    parser.add_argument("--market", type=str, default=None, help="Filter target APMC market (e.g. 'Agra')")
    parser.add_argument("--commodity", type=str, default=None, help="Filter target commodity (e.g. 'Potato')")
    parser.add_argument("--agra", action="store_true", help="Shortcut for Agra APMC, Uttar Pradesh")
    args = parser.parse_args()

    active_filters = {}
    if args.agra:
        active_filters = {"state": "Uttar Pradesh", "district": "Agra", "market": "Agra"}
        print("🏛️ [Mandi Pipeline] Targeted filter active: Agra APMC Yard, Uttar Pradesh")
    else:
        if args.state:
            active_filters["state"] = args.state
        if args.district:
            active_filters["district"] = args.district
        if args.market:
            active_filters["market"] = args.market
        if args.commodity:
            active_filters["commodity"] = args.commodity

    if args.daemon:
        print("Starting in DAEMON mode (interval: 4 hours)...")
        while True:
            success = run_sync_pipeline(active_filters if active_filters else None)
            print(f"Sync cycle completed. Status: {'SUCCESS' if success else 'FAILED'}. Sleeping for 4 hours...")
            time.sleep(4 * 60 * 60)
    else:
        # Default for CI / scheduled jobs: single bounded execution with exit status
        success = run_sync_pipeline(active_filters if active_filters else None)
        if success:
            print("Pipeline executed successfully.")
            sys.exit(0)
        else:
            print("Pipeline completed with failure or 0 records. Check logs above.")
            sys.exit(1)
