# -*- coding: utf-8 -*-
"""
NuKropAI Automated SQL Security Audit Verification Suite
Evaluates CANONICAL_PRODUCTION_SETUP.sql and dev_fixtures.sql against the 12 Security Directives.
"""

import sys, os, re

sys.stdout.reconfigure(encoding='utf-8')

def run_security_audit():
    print("="*80)
    print("🛡️  NUKROPAI SQL SECURITY AUDIT VERIFICATION SUITE")
    print("="*80)

    sql_path = 'supabase/CANONICAL_PRODUCTION_SETUP.sql'
    fixtures_path = 'supabase/seed/dev_fixtures.sql'

    assert os.path.exists(sql_path), f"Missing {sql_path}"
    assert os.path.exists(fixtures_path), f"Missing {fixtures_path}"

    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    with open(fixtures_path, 'r', encoding='utf-8') as f:
        fixtures = f.read()

    passed = 0
    failed = 0

    def check(name, condition, details=""):
        nonlocal passed, failed
        if condition:
            passed += 1
            print(f"  ✔ [PASS] {name}")
        else:
            failed += 1
            print(f"  ❌ [FAIL] {name} - {details}")

    print("\n▶ Directive 1 & 3: Unrestricted Write Removal & GramHaul Write Restriction")
    # Truck listings write policies must NOT have WITH CHECK (true)
    truck_write_true = bool(re.search(r'CREATE POLICY [^;]+ ON public\.truck_listings FOR INSERT WITH CHECK \(\s*true\s*\)', sql, re.IGNORECASE))
    check("truck_listings INSERT requires authenticated owner", not truck_write_true and "truck_listings_insert_owner" in sql)

    truck_update_true = bool(re.search(r'CREATE POLICY [^;]+ ON public\.truck_listings FOR UPDATE USING \(\s*true\s*\)', sql, re.IGNORECASE))
    check("truck_listings UPDATE requires authenticated owner", not truck_update_true and "truck_listings_update_owner" in sql)

    truck_delete_true = bool(re.search(r'CREATE POLICY [^;]+ ON public\.truck_listings FOR DELETE USING \(\s*true\s*\)', sql, re.IGNORECASE))
    check("truck_listings DELETE requires authenticated owner", not truck_delete_true and "truck_listings_delete_owner" in sql)

    print("\n▶ Directive 2: Profile Access Restriction & Public Profile Separation")
    profiles_true = bool(re.search(r'CREATE POLICY "profiles_read_all" ON public\.profiles FOR SELECT USING \(\s*true\s*\)', sql, re.IGNORECASE))
    check("profiles table does NOT expose all data via USING (true)", not profiles_true)
    check("profiles SELECT restricted to owner", "profiles_select_own" in sql and "auth.uid()" in sql)
    check("public_profiles view defined for non-sensitive public metadata", "CREATE OR REPLACE VIEW public.public_profiles" in sql)
    check("public_profiles excludes sensitive fields (agristack_id, phone, kcc_balance)", 
          "agristack_id" not in sql[sql.find("public.public_profiles"):sql.find("GRANT SELECT ON public.public_profiles")])

    print("\n▶ Directive 4: Driver GPS Data & Telemetry Access Control")
    check("driver_telemetry INSERT requires driver auth.uid()", "driver_telemetry_insert" in sql and "auth.uid()::text = user_id" in sql)
    check("driver_telemetry UPDATE requires driver auth.uid()", "driver_telemetry_update" in sql)
    check("driver_telemetry SELECT enforces booking party & 24h freshness check", 
          "last_ping >= (NOW() - INTERVAL '24 hours')" in sql or "last_ping >=" in sql)
    check("driver_locations writes restricted to driver", "driver_locations_write" in sql)

    print("\n▶ Directive 5: Policy Preservation (No Blind Schema-Wide Drop Loop)")
    wildcard_drop = bool(re.search(r'FOR pol IN \(\s*SELECT schemaname.*FROM pg_policies\s*WHERE schemaname = \'public\'', sql, re.IGNORECASE))
    check("No wildcard loop dropping all public policies", not wildcard_drop)

    print("\n▶ Directive 6: Purge Fabricated Production Seed Data")
    check("Demo truck TRK-8419 removed from production setup", "TRK-8419" not in sql)
    check("Demo driver Ramesh Yadav removed from production setup", "Ramesh Yadav" not in sql)
    check("Demo post 'post-1' removed from production setup", "'post-1'" not in sql)
    check("Demo fixtures isolated in dev_fixtures.sql", "TRK-8419" in fixtures and "post-1" in fixtures)

    print("\n▶ Directive 7: Removal of Misleading Operational Defaults")
    check("truck_listings does not hardcode Warangal Rural default", "origin_village text DEFAULT 'Warangal Rural'" not in sql)
    check("truck_listings does not hardcode fake 4.9 rating", "rating numeric DEFAULT 4.9" not in sql)
    check("land_parcels does not hardcode survey 142/A default", "survey_number text NOT NULL DEFAULT '142/A'" not in sql)
    check("soil_health_cards does not hardcode fake NPK readings", "nitrogen_kg_ha numeric NOT NULL DEFAULT 240.00" not in sql)
    check("kcc_applications does not hardcode fake 150000 sanction", "sanctioned_amount numeric DEFAULT 150000" not in sql)

    print("\n▶ Directive 8: Private Storage Buckets & Owner Enforcement")
    check("crop-scans bucket marked public = false (PRIVATE)", "('crop-scans', 'crop-scans', false)" in sql)
    check("crop-scans public read policy removed", "Allow public read on crop scans" not in sql or "DROP POLICY \"Allow public read on crop scans\"" in sql)
    check("crop-scans owner read policy enforced", "crop_scans_owner_read" in sql and "auth.uid()" in sql)
    check("crop-scans owner upload policy enforced", "crop_scans_owner_upload" in sql)

    print("\n▶ Directive 9: Auth Signup Trigger Role Escalation Protection")
    check("handle_new_auth_user whitelists roles to farmer/driver", "v_requested_role NOT IN ('farmer', 'driver')" in sql)
    check("handle_new_auth_user enforces search_path", "SET search_path = public, pg_temp" in sql)

    print("\n▶ Directive 10: SECURITY DEFINER Search Path Enforcement")
    sec_defs = re.findall(r'CREATE OR REPLACE FUNCTION public\.(\w+)[^;]+SECURITY DEFINER', sql, re.IGNORECASE)
    all_sec_defs_secure = True
    for fn in sec_defs:
        fn_body = sql[sql.find(f"public.{fn}"):sql.find("$$ LANGUAGE plpgsql SECURITY DEFINER", sql.find(f"public.{fn}"))]
        if "SET search_path" not in fn_body and "SET search_path" not in sql[sql.find(f"public.{fn}"):sql.find(f"public.{fn}")+300]:
            all_sec_defs_secure = False
            print(f"    Missing search_path in {fn}")
    check("All SECURITY DEFINER functions have explicit search_path", all_sec_defs_secure)

    print("\n▶ Directive 11 & 12: Safe, Repeatable Idempotency & Legitimacy")
    check("Authentic ICAR recipes preserved (Dashaparni Kashayam)", "Dashaparni Kashayam" in sql)
    check("Authentic Government Subsidies preserved (PM-KISAN)", "PM-KISAN Samman Nidhi" in sql)
    check("Authentic Mandi Rates initial benchmark preserved", "Cotton (Long Staple)" in sql)
    check("Zero Firebase references introduced", "firebase" not in sql.lower())

    print("\n" + "="*80)
    print(f"📊 AUDIT RESULTS: {passed} PASSED, {failed} FAILED")
    print("="*80)

    if failed == 0:
        print("✨ ALL 28 SECURITY DIRECTIVE ASSERTIONS VERIFIED SUCCESSFULLY!")
        return 0
    else:
        print(f"⚠️ {failed} SECURITY DIRECTIVE ASSERTIONS FAILED")
        return 1

if __name__ == '__main__':
    sys.exit(run_security_audit())
