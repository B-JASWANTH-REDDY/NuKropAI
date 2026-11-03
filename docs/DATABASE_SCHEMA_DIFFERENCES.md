# NUKROPAI — DATABASE SCHEMA DIFFERENCES & RECONCILIATION

**Audit Scope:** Local Repository SQL vs. Live Supabase Database (`yxjqseiegwjdfnccdchk`) vs. Application Clients  
**Reconciliation Migration:** [`supabase/migrations/20261103000001_production_schema_alignment.sql`](file:///c:/Users/bjasw/Downloads/agriculture-ai-os/supabase/migrations/20261103000001_production_schema_alignment.sql)  

---

## 1. Discrepancy Analysis & Reconciliation Table

| Table | Local Canonical Definition | Live Supabase State | Client Usage (Backend/Web/Mobile) | Reconciliation Action |
| :--- | :--- | :--- | :--- | :--- |
| `truck_listings` | 29 columns including `vehicle_type`, `capacity_tons`, `latitude`, `longitude` | 8 columns (`id`, `driver_name`, `driver_phone`, `truck_type`, `vehicle_plate`, `rate_per_km`, `status`, `created_at`) | Web & Android use `vehicle_type`, `capacity_tonnes`, `rate_per_km`, `latitude`, `longitude` | Applied `ADD COLUMN IF NOT EXISTS` for all 21 missing columns with operational defaults. |
| `driver_locations` | 14 columns including `current_lat`, `current_lng`, `is_available` | Core PostGIS columns (`driver_id`, `location`, `heading`, `speed`, `updated_at`) | Realtime tracking queries `current_lat`, `current_lng`, `driver_name` | Added scalar latitude/longitude columns and driver metadata. |
| `driver_telemetry` | 13 columns including `latitude`, `longitude`, `speed` | Created with `current_lat`, `current_lng`, `speed_kmh`, `heading`, `is_online` | Clients use both `latitude`/`longitude` and `current_lat`/`current_lng` | Added alias columns ensuring both conventions resolve without query failures. |
| `disease_scans` | 13 columns with `recommendations`, `image_url` | Created with `recommended_treatment`, `image_storage_path` | Android & Web send `treatment_recommendation`, `image_url`, `disease_detected` | Added `recommendations`, `image_url`, `treatment_recommendation`, and `confidence_score`. |
| `khata_transactions` | 11 columns with `farmer_id`, `date` | Created with `user_id`, `transaction_date` | Legacy scripts query `farmer_id` and `date` | Added `farmer_id` and `date` alias columns defaulting to `transaction_date`. |
| `land_parcels` | 20 columns with `cadastral_geojson`, `is_verified` | Created without GeoJSON and verification audit columns | AgriStack passport uses `cadastral_geojson` | Added `irrigation_source`, `cadastral_geojson`, `is_verified`, and `verified_at`. |
| `outbreak_alerts` | 9 columns with `pest_disease`, `crop_affected` | Created with `crop_name`, `pest_name`, `broadcast_message` | UI cards look for `advisory_summary` | Added alias columns for pest and advisory fields. |
| `peer_messages` | 9 columns with `sender_id`, `receiver_id` | Created with `sender_email`, `receiver_email`, `receiver_name` | Direct peer chat requires UUID/text sender ID | Added `sender_id` and `receiver_id` columns. |
| `biorx_batches` | 9 columns with `batch_number`, `status` | Created with recipe and farmer ID | BioRx fermentation tracker needs batch state | Added `batch_number`, `started_at`, `ready_at`, and `status`. |
| `user_profiles` | Missing (historical legacy table) | Not present in public schema | Android `SupabaseClient.syncProfile()` queries `/rest/v1/user_profiles` | Created `user_profiles` as an updateable/queryable view projecting `public.profiles`. |
| `mandi_arbitrage_quotes` | Missing in base schema | Not present in public schema | Android `MandiPilotScreen` queries `/rest/v1/mandi_arbitrage_quotes` | Created view calculating real-time arbitrage spreads from `public.mandi_live_rates`. |
| Storage `crop-scans` | Storage bucket required | Bucket was uninitialized | LeafNet scanner uploads diagnostic images | Added bucket insertion and public read / authenticated insert policies. |

---

## 2. Safety Guarantees

1. **Zero Data Loss**: Every schema adjustment is additive (`ADD COLUMN IF NOT EXISTS`).
2. **Zero Constraint Violations**: Default values are provided for non-null constraints to avoid breaking existing data.
3. **Zero Destruction**: No tables, columns, or schemas were dropped or altered destructively.
