-- ========================================================================
-- NuKropAI: CLEAN DROP SCRIPT
-- Drops all existing tables, foreign keys, and sequences with CASCADE
-- ========================================================================

DROP TABLE IF EXISTS public.equipment_rentals CASCADE;
DROP TABLE IF EXISTS public.farm_khata_ledger CASCADE;
DROP TABLE IF EXISTS public.disease_scans CASCADE;
DROP TABLE IF EXISTS public.community_comments CASCADE;
DROP TABLE IF EXISTS public.community_posts CASCADE;
DROP TABLE IF EXISTS public.mandi_live_rates CASCADE;
DROP TABLE IF EXISTS public.khata_records CASCADE;
DROP TABLE IF EXISTS public.truck_bookings CASCADE;
DROP TABLE IF EXISTS public.subsidies CASCADE;
DROP TABLE IF EXISTS public.farmer_crops CASCADE;
DROP TABLE IF EXISTS public.outbreak_alerts CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

SELECT 'All draft tables dropped cleanly. Ready for schema creation.' AS status;
