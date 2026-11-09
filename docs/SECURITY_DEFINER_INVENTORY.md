# NuKropAI Machine-Readable SECURITY DEFINER Function Inventory

This document contains the authoritative audit of every `SECURITY DEFINER` function declared in the NuKropAI repository.

## Security Directives Enforced
1. **Fixed Search Path**: Every function specifies an explicit `search_path` avoiding ambient caller resolution.
2. **Object Shadowing Defense**: Every search path strictly appends `pg_temp` last (e.g. `public, pg_temp` or `public, extensions, pg_temp`), preventing temporary tables/operators created by unprivileged callers from hijacking execution.
3. **Untrusted Schema CREATE Denied**: Untrusted roles (`anon`, `authenticated`) have `CREATE` privilege revoked on `public` and `extensions` schemas.
4. **Execution Privilege Least-Authority**: Discovery and mutate RPCs explicitly revoke execute from `PUBLIC` and `anon`, granting only to `authenticated` or internal system triggers.

## Inventory Table

| File | Function | Signature | search_path | Shadowing Defense | Grants / Call Authority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `supabase/CANONICAL_PRODUCTION_SETUP.sql` | `public.fn_sync_post_likes_count` | `` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/CANONICAL_PRODUCTION_SETUP.sql` | `public.set_my_profile_discovery` | `p_enabled boolean` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/CANONICAL_PRODUCTION_SETUP.sql` | `public.get_community_author_profile` | `p_author_id text` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/CANONICAL_PRODUCTION_SETUP.sql` | `public.get_community_authors` | `p_author_ids text[]` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/CANONICAL_PRODUCTION_SETUP.sql` | `public.handle_new_auth_user` | `` | `public, pg_temp` | **ELIMINATED** | TRIGGER / OWNER ONLY |
| `supabase/COMPLETE_PRODUCTION_DATABASE.sql` | `public.get_nearby_drivers` | `p_lat DOUBLE PRECISION, p_lng DOUBLE PRE...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql` | `public.fn_sync_post_likes_count` | `` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql` | `public.set_my_profile_discovery` | `p_enabled boolean` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql` | `public.get_community_author_profile` | `p_author_id text` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql` | `public.get_community_authors` | `p_author_ids text[]` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/COMPLETE_SUPABASE_ALL_IN_ONE_PRODUCTION.sql` | `public.handle_new_auth_user` | `` | `public, pg_temp` | **ELIMINATED** | TRIGGER / OWNER ONLY |
| `supabase/FIX_GEOM_AND_FULL_SCHEMA.sql` | `public.get_nearby_drivers` | `p_lat DOUBLE PRECISION, p_lng DOUBLE PRE...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/FULL_NUKROPAI_SCHEMA.sql` | `public.get_active_driver_telemetry` | `` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/FULL_NUKROPAI_SCHEMA.sql` | `public.get_nearby_mandis` | `p_lat NUMERIC, p_lng NUMERIC, p_radius_k...` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/FULL_PRODUCTION_SCHEMA_AND_TRIGGERS.sql` | `public.get_nearby_drivers` | `p_lat DOUBLE PRECISION, p_lng DOUBLE PRE...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/NUKROP_SUPABASE_ADDITIONS.sql` | `public.handle_new_auth_user` | `` | `public, pg_temp` | **ELIMINATED** | TRIGGER / OWNER ONLY |
| `supabase/NUKROP_SUPABASE_ADDITIONS.sql` | `public.fn_sync_post_likes_count` | `` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/NUKROP_SUPABASE_ADDITIONS.sql` | `public.fn_sync_post_comments_count` | `` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/UNIFIED_PRODUCTION_CONSOLIDATION.sql` | `public.handle_new_auth_user` | `` | `public, pg_temp` | **ELIMINATED** | TRIGGER / OWNER ONLY |
| `supabase/UNIFIED_PRODUCTION_CONSOLIDATION.sql` | `public.get_nearby_drivers` | `p_lat DOUBLE PRECISION, p_lng DOUBLE PRE...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/UNIFIED_PRODUCTION_CONSOLIDATION.sql` | `public.get_active_driver_telemetry` | `` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/UNIFIED_PRODUCTION_CONSOLIDATION.sql` | `public.fetch_authentic_agristack_registry` | `p_search_token TEXT` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/archive/supabase_enterprise_v41.sql` | `public.get_farmer_dashboard_summary` | `p_farmer_id TEXT` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/archive/supabase_master_production_v41.sql` | `public.handle_new_auth_user` | `` | `public, pg_temp` | **ELIMINATED** | TRIGGER / OWNER ONLY |
| `supabase/archive/supabase_master_production_v41.sql` | `public.get_nearby_drivers` | `p_lat DOUBLE PRECISION, p_lng DOUBLE PRE...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/archive/supabase_master_production_v41.sql` | `public.get_active_driver_telemetry` | `` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/archive/supabase_master_production_v41.sql` | `public.fetch_authentic_agristack_registry` | `p_search_token TEXT` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/archive/supabase_realtime_setup.sql` | `public.sync_post_likes_count` | `` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/archive/supabase_realtime_setup.sql` | `public.sync_post_comments_count` | `` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/archive/supabase_realtime_setup.sql` | `public.increment_post_likes` | `p_post_id TEXT, p_delta INT` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20260901000001_initial_schema_and_rls.sql` | `public.check_rate_limit` | `user_uuid UUID, max_requests INT, interv...` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261003010000_production_mandi_and_rls.sql` | `public.get_active_driver_telemetry` | `` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261003010000_production_mandi_and_rls.sql` | `public.get_nearby_mandis` | `p_lat NUMERIC, p_lng NUMERIC, p_radius_k...` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261004020000_postgis_driver_tracking_osrm.sql` | `public.get_nearest_drivers` | `user_lon DOUBLE PRECISION, user_lat DOUB...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261004020000_postgis_driver_tracking_osrm.sql` | `public.upsert_driver_location` | `p_driver_id VARCHAR(100` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261004030000_agristack_cadastral_dcs.sql` | `public.get_farmer_agristack` | `p_fid VARCHAR` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261004040000_agristack_relational_search.sql` | `public.search_farmer_land_registry` | `p_query text` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261004050000_authentic_agristack_registry.sql` | `public.fetch_authentic_agristack_registry` | `p_search_token TEXT` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261104000001_realtime_driver_dispatch.sql` | `public.get_nearby_drivers` | `p_farmer_lat DOUBLE PRECISION, p_farmer_...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261104000001_realtime_driver_dispatch.sql` | `public.set_driver_duty_status` | `p_driver_id TEXT, p_is_on_duty BOOLEAN, ...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261104000001_realtime_driver_dispatch.sql` | `public.accept_haul_booking` | `p_booking_id TEXT, p_driver_id TEXT` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261104000001_realtime_driver_dispatch.sql` | `public.update_haul_trip_status` | `p_booking_id TEXT, p_driver_id TEXT, p_n...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261104000001_realtime_driver_dispatch.sql` | `public.record_driver_gps_ping` | `p_driver_id TEXT, p_lat DOUBLE PRECISION...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261104000002_reconcile_driver_dispatch_rpcs.sql` | `public.get_nearby_drivers` | `p_farmer_lat DOUBLE PRECISION, p_farmer_...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261104000002_reconcile_driver_dispatch_rpcs.sql` | `public.accept_haul_booking` | `p_booking_id TEXT, p_driver_id TEXT` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000001_land_survey_intelligence.sql` | `public.search_land_parcels` | `p_state_code VARCHAR, p_district TEXT DE...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000001_land_survey_intelligence.sql` | `public.get_land_survey_coverage` | `` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000002_land_survey_phase3.sql` | `public.get_land_survey_coverage` | `` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000004_gramhaul_production_dispatch_and_rentals.sql` | `public.get_nearby_eligible_drivers` | `p_farmer_lat DOUBLE PRECISION, p_farmer_...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000004_gramhaul_production_dispatch_and_rentals.sql` | `public.atomic_accept_booking` | `p_booking_id TEXT, p_driver_id TEXT, p_v...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000004_gramhaul_production_dispatch_and_rentals.sql` | `public.atomic_cancel_booking` | `p_booking_id TEXT, p_actor_id TEXT, p_ac...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000004_gramhaul_production_dispatch_and_rentals.sql` | `public.atomic_verify_booking_otp` | `p_booking_id TEXT, p_driver_id TEXT, p_c...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000004_gramhaul_production_dispatch_and_rentals.sql` | `public.check_rental_conflict` | `p_vehicle_id TEXT, p_start_time TIMESTAM...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000005_gramhaul_end_to_end_offers_and_lifecycle.sql` | `public.dispatch_booking_offers` | `p_booking_id TEXT, p_radius_meters DOUBL...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000005_gramhaul_end_to_end_offers_and_lifecycle.sql` | `public.atomic_reject_offer` | `p_offer_id TEXT, p_driver_id TEXT` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000005_gramhaul_end_to_end_offers_and_lifecycle.sql` | `public.atomic_accept_booking` | `p_booking_id TEXT, p_driver_id TEXT, p_v...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000005_gramhaul_end_to_end_offers_and_lifecycle.sql` | `public.atomic_cancel_booking` | `p_booking_id TEXT, p_actor_id TEXT, p_ac...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000005_gramhaul_end_to_end_offers_and_lifecycle.sql` | `public.atomic_extend_rental` | `p_rental_id TEXT, p_renter_id TEXT, p_ne...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261105000005_gramhaul_end_to_end_offers_and_lifecycle.sql` | `public.atomic_return_rental` | `p_rental_id TEXT, p_actor_id TEXT, p_ret...` | `public, extensions, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261109000001_canonical_identity_reconciliation.sql` | `public.handle_new_auth_user` | `` | `public, pg_temp` | **ELIMINATED** | TRIGGER / OWNER ONLY |
| `supabase/migrations/20261109000001_canonical_identity_reconciliation.sql` | `public.prevent_direct_discovery_mutation` | `` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |
| `supabase/migrations/20261109000001_canonical_identity_reconciliation.sql` | `public.set_my_profile_discovery` | `p_enabled boolean` | `public, pg_temp` | **ELIMINATED** | INTERNAL / SYSTEM DEFINER |