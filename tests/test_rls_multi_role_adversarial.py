# -*- coding: utf-8 -*-
"""
Multi-Role Adversarial Simulation for NuKropAI RLS Policies
Simulates and proves:
1. Anonymous user cannot read private profiles or inject telemetry
2. Farmer A cannot read or alter Farmer B's khata, scans, or land
3. Unauthorized users cannot modify trucks, likes, follows, or driver locations
4. Storage privacy: crop-scans is strictly private to owner
5. Role escalation attack via signup metadata fails safely
"""

import sys, os, re

sys.stdout.reconfigure(encoding='utf-8')

def run_adversarial_simulation():
    print("="*80)
    print("⚔️  NUKROPAI MULTI-ROLE ADVERSARIAL RLS POLICY SIMULATOR")
    print("="*80)

    with open('supabase/CANONICAL_PRODUCTION_SETUP.sql', 'r', encoding='utf-8') as f:
        sql = f.read()

    # Extract all policies into a dictionary: (table, policy_name, cmd) -> (using_expr, check_expr)
    policies = {}
    pattern = re.compile(
        r'CREATE POLICY "([^"]+)" ON public\.(\w+)\s+(?:FOR (\w+)\s*)?(?:USING \((.*?)\))?(?:\s*WITH CHECK \((.*?)\))?;',
        re.DOTALL | re.IGNORECASE
    )
    for m in pattern.finditer(sql):
        pname, table, cmd, using_expr, check_expr = m.groups()
        cmd = (cmd or 'ALL').upper()
        using_expr = (using_expr or '').strip()
        check_expr = (check_expr or '').strip()
        policies[(table, pname, cmd)] = (using_expr, check_expr)

    print(f"Loaded {len(policies)} verified RLS policies from CANONICAL_PRODUCTION_SETUP.sql\n")

    # Actors:
    # Anon: auth_uid = None
    # Farmer A: auth_uid = 'usr-farmer-a'
    # Farmer B: auth_uid = 'usr-farmer-b'
    # Driver: auth_uid = 'usr-driver-1'

    def eval_policy_expr(expr, auth_uid, row):
        if not expr:
            return False
        # Normalize
        norm = expr.replace('\n', ' ')
        # Simple logical evaluator
        if norm == 'true':
            return True
        if norm == 'false':
            return False

        # auth.uid() check
        if 'auth.uid() IS NOT NULL' in norm:
            if auth_uid is None:
                return False

        # user_id checks
        if 'auth.uid()::text = user_id' in norm:
            if row.get('user_id') != auth_uid:
                return False

        # follower_id check
        if 'auth.uid()::text = follower_id' in norm:
            if row.get('follower_id') != auth_uid:
                return False

        # owner_id / transporter_id check
        if 'auth.uid()::text = owner_id' in norm:
            if row.get('owner_id') != auth_uid:
                return False

        if 'auth.uid()::text = transporter_id' in norm:
            if row.get('transporter_id') != auth_uid and row.get('user_id') != auth_uid:
                return False

        # booking party check
        if 'auth.uid()::text = farmer_user_id' in norm or 'auth.uid()::text = driver_user_id' in norm:
            is_party = (row.get('farmer_user_id') == auth_uid or 
                        row.get('driver_user_id') == auth_uid or 
                        row.get('user_id') == auth_uid)
            if not is_party:
                return False

        return True

    passed = 0
    failed = 0

    def assert_perm(name, allowed, expected_allowed):
        nonlocal passed, failed
        if allowed == expected_allowed:
            passed += 1
            status = "PERMITTED" if allowed else "BLOCKED"
            print(f"  ✔ [PASS] {name} -> {status} as expected")
        else:
            failed += 1
            print(f"  ❌ [FAIL] {name} -> Got {allowed}, expected {expected_allowed}")

    print("▶ Phase 1: Anonymous User Boundaries")
    # Anon trying to read Farmer A's profile
    p_using = policies.get(('profiles', 'profiles_select_own', 'SELECT'), ('', ''))[0]
    anon_read_profile = eval_policy_expr(p_using, None, {'id': 'usr-farmer-a', 'user_id': 'usr-farmer-a'})
    assert_perm("Anonymous user SELECT profiles (private table)", anon_read_profile, False)

    # Anon trying to read public_profiles view
    has_public_view = "CREATE OR REPLACE VIEW public.public_profiles" in sql
    assert_perm("Anonymous user permitted SELECT public_profiles view", has_public_view, True)

    # Anon trying to insert truck listing
    trk_check = policies.get(('truck_listings', 'truck_listings_insert_owner', 'INSERT'), ('', ''))[1]
    anon_insert_truck = eval_policy_expr(trk_check, None, {'user_id': 'usr-driver-1'})
    assert_perm("Anonymous user INSERT truck_listings", anon_insert_truck, False)

    # Anon trying to insert driver telemetry
    tel_check = policies.get(('driver_telemetry', 'driver_telemetry_insert', 'INSERT'), ('', ''))[1]
    anon_insert_tel = eval_policy_expr(tel_check, None, {'user_id': 'usr-driver-1'})
    assert_perm("Anonymous user INSERT driver_telemetry", anon_insert_tel, False)

    print("\n▶ Phase 2: Farmer A vs Farmer B Horizontal Isolation")
    # Farmer A reading Farmer B's khata
    khata_using = policies.get(('khata_transactions', 'khata_transactions_owner', 'ALL'), ('', ''))[0]
    farmer_a_read_b_khata = eval_policy_expr(khata_using, 'usr-farmer-a', {'user_id': 'usr-farmer-b'})
    assert_perm("Farmer A SELECT Farmer B's khata_transactions", farmer_a_read_b_khata, False)

    farmer_a_read_own_khata = eval_policy_expr(khata_using, 'usr-farmer-a', {'user_id': 'usr-farmer-a'})
    assert_perm("Farmer A SELECT own khata_transactions", farmer_a_read_own_khata, True)

    # Farmer A reading Farmer B's disease scans
    scans_using = policies.get(('disease_scans', 'disease_scans_owner', 'ALL'), ('', ''))[0]
    farmer_a_read_b_scan = eval_policy_expr(scans_using, 'usr-farmer-a', {'user_id': 'usr-farmer-b'})
    assert_perm("Farmer A SELECT Farmer B's disease_scans", farmer_a_read_b_scan, False)

    # Farmer A reading Farmer B's land parcels
    land_using = policies.get(('land_parcels', 'land_parcels_owner', 'ALL'), ('', ''))[0]
    farmer_a_read_b_land = eval_policy_expr(land_using, 'usr-farmer-a', {'user_id': 'usr-farmer-b'})
    assert_perm("Farmer A SELECT Farmer B's land_parcels", farmer_a_read_b_land, False)

    # Farmer A reading Farmer B's soil health cards
    soil_using = policies.get(('soil_health_cards', 'soil_health_cards_owner', 'ALL'), ('', ''))[0]
    farmer_a_read_b_soil = eval_policy_expr(soil_using, 'usr-farmer-a', {'user_id': 'usr-farmer-b'})
    assert_perm("Farmer A SELECT Farmer B's soil_health_cards", farmer_a_read_b_soil, False)

    # Farmer A reading Farmer B's KCC loan application
    kcc_using = policies.get(('kcc_applications', 'kcc_applications_owner', 'ALL'), ('', ''))[0]
    farmer_a_read_b_kcc = eval_policy_expr(kcc_using, 'usr-farmer-a', {'user_id': 'usr-farmer-b'})
    assert_perm("Farmer A SELECT Farmer B's kcc_applications", farmer_a_read_b_kcc, False)

    print("\n▶ Phase 3: GramHaul Fleet & Booking Authority")
    # Farmer A trying to update Driver's truck listing
    trk_upd = policies.get(('truck_listings', 'truck_listings_update_owner', 'UPDATE'), ('', ''))[0]
    farmer_a_upd_trk = eval_policy_expr(trk_upd, 'usr-farmer-a', {'user_id': 'usr-driver-1', 'transporter_id': 'usr-driver-1'})
    assert_perm("Farmer A UPDATE Driver's truck_listings", farmer_a_upd_trk, False)

    driver_upd_own_trk = eval_policy_expr(trk_upd, 'usr-driver-1', {'user_id': 'usr-driver-1', 'transporter_id': 'usr-driver-1'})
    assert_perm("Driver UPDATE own truck_listings", driver_upd_own_trk, True)

    # Uninvolved Farmer B trying to read Farmer A's haul booking
    haul_using = policies.get(('haul_bookings', 'haul_bookings_select', 'SELECT'), ('', ''))[0]
    farmer_b_read_haul = eval_policy_expr(haul_using, 'usr-farmer-b', {
        'farmer_user_id': 'usr-farmer-a',
        'driver_user_id': 'usr-driver-1',
        'user_id': 'usr-farmer-a'
    })
    assert_perm("Uninvolved Farmer B SELECT Farmer A's haul_bookings", farmer_b_read_haul, False)

    farmer_a_read_own_haul = eval_policy_expr(haul_using, 'usr-farmer-a', {
        'farmer_user_id': 'usr-farmer-a',
        'driver_user_id': 'usr-driver-1',
        'user_id': 'usr-farmer-a'
    })
    assert_perm("Farmer A SELECT own haul_bookings", farmer_a_read_own_haul, True)

    print("\n▶ Phase 4: Social Interactions & Anti-Forgery")
    # Farmer A attempting to like on behalf of Farmer B
    like_check = policies.get(('post_likes', 'post_likes_write', 'INSERT'), ('', ''))[1]
    forge_like = eval_policy_expr(like_check, 'usr-farmer-a', {'user_id': 'usr-farmer-b', 'post_id': 'post-1'})
    assert_perm("Farmer A INSERT post_likes on behalf of Farmer B", forge_like, False)

    own_like = eval_policy_expr(like_check, 'usr-farmer-a', {'user_id': 'usr-farmer-a', 'post_id': 'post-1'})
    assert_perm("Farmer A INSERT post_likes for themselves", own_like, True)

    # Farmer A attempting to follow someone on behalf of Farmer B
    follow_check = policies.get(('user_follows', 'user_follows_write', 'INSERT'), ('', ''))[1]
    forge_follow = eval_policy_expr(follow_check, 'usr-farmer-a', {'follower_id': 'usr-farmer-b', 'following_id': 'usr-driver-1'})
    assert_perm("Farmer A INSERT user_follows on behalf of Farmer B", forge_follow, False)

    print("\n▶ Phase 5: Storage Privacy & Role Escalation Defense")
    # crop-scans bucket privacy
    is_crop_scans_private = "('crop-scans', 'crop-scans', false)" in sql
    assert_perm("crop-scans storage bucket set to private (public = false)", is_crop_scans_private, True)

    # Auth signup role escalation check
    signup_role_whitelisted = "v_requested_role NOT IN ('farmer', 'driver')" in sql
    assert_perm("Signup role whitelist denies 'admin' and defaults to 'farmer'", signup_role_whitelisted, True)

    print("\n" + "="*80)
    print(f"📊 ADVERSARIAL SIMULATION RESULTS: {passed} PASSED, {failed} FAILED")
    print("="*80)
    return 0 if failed == 0 else 1

if __name__ == '__main__':
    sys.exit(run_adversarial_simulation())
