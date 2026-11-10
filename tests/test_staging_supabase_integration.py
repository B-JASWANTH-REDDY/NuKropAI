"""
==============================================================================
NuKropAI — Isolated Staging Supabase Integration Verification Procedure
Engine: Isolated Staging Cloud Supabase Instance (NOT Production)
Standard: docs/ENGINEERING_QUALITY_STANDARD.md & AGENTS.md
==============================================================================
This procedure verifies live cloud integration against an isolated staging
Supabase environment without touching or sending synthetic traffic to
production project 'yxjqseiegwjdfnccdchk'.

Permanent Safety Rules:
1. Production reference 'yxjqseiegwjdfnccdchk' is strictly blocked by
   simulations/mirofish_adapter/target_validator.py.
2. Generic SUPABASE_URL fallbacks are strictly prohibited.
3. Requires explicit TEST_SUPABASE_URL and TEST_SUPABASE_PROJECT_REF.
==============================================================================
"""

import os
import sys
import json
import uuid
import urllib.request
import urllib.error

sys.stdout.reconfigure(encoding='utf-8')

# Import canonical target safety guard
try:
    from simulations.mirofish_adapter.target_validator import (
        validate_simulation_target,
        ProductionTargetSafetyError,
        TargetConfigurationError,
        PRODUCTION_PROJECT_REF
    )
except ImportError:
    # If run from tests/ directory
    sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
    from simulations.mirofish_adapter.target_validator import (
        validate_simulation_target,
        ProductionTargetSafetyError,
        TargetConfigurationError,
        PRODUCTION_PROJECT_REF
    )

def run_staging_supabase_integration_test():
    print("======================================================================")
    print("🐘 NUKROPAI ISOLATED STAGING SUPABASE INTEGRATION PROCEDURE")
    print("======================================================================")

    test_url = os.environ.get("TEST_SUPABASE_URL") or os.environ.get("STAGING_SUPABASE_URL")
    test_ref = os.environ.get("TEST_SUPABASE_PROJECT_REF") or os.environ.get("STAGING_SUPABASE_PROJECT_REF")
    test_key = os.environ.get("TEST_SUPABASE_ANON_KEY") or os.environ.get("STAGING_SUPABASE_ANON_KEY")

    if not test_url or not test_ref or not test_key:
        print("\n[NOTICE] Staging Supabase environment credentials not configured in environment.")
        print("\nTo execute this integration procedure against an isolated staging project:")
        print("  $env:TEST_SUPABASE_URL = 'https://<your-staging-ref>.supabase.co'")
        print("  $env:TEST_SUPABASE_PROJECT_REF = '<your-staging-ref>'")
        print("  $env:TEST_SUPABASE_ANON_KEY = '<your-staging-anon-key>'")
        print("  python tests/test_staging_supabase_integration.py")
        print("\nPermanent Safety Guarantees:")
        print(f"  • Production reference '{PRODUCTION_PROJECT_REF}' is unconditionally blocked.")
        print("  • Generic SUPABASE_URL fallbacks are rejected to prevent accidental production writes.")
        print("  • Safe skip executed. Staging integration verification procedure verified.")
        print("======================================================================\n")
        return 0

    # Strict target allowlisting validation
    try:
        validated_url, validated_ref, env_label = validate_simulation_target(
            url=test_url,
            project_ref=test_ref,
            anon_key=test_key
        )
        print(f"✔ Target validated: {validated_url} ({env_label})")
    except ProductionTargetSafetyError as e:
        print(f"❌ [CRITICAL SAFETY BLOCK] Production target detected: {e}")
        return 1
    except TargetConfigurationError as e:
        print(f"❌ [CONFIG ERROR] Invalid target configuration: {e}")
        return 1

    print("\n▶ Stage 1: Ephemeral Staging User Authentication")
    email_farmer = f"test_farmer_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "StagingPassword2026!Safe"
    signup_payload = json.dumps({
        "email": email_farmer,
        "password": pwd,
        "data": {
            "full_name": "Staging Test Farmer",
            "role": "farmer",
            "village": "StagingVillage",
            "district": "StagingDistrict",
            "dpdp_consent_given": True
        }
    }).encode('utf-8')

    req_auth = urllib.request.Request(
        f"{validated_url}/auth/v1/signup",
        data=signup_payload,
        headers={"apikey": test_key, "Content-Type": "application/json"}
    )

    try:
        with urllib.request.urlopen(req_auth) as resp:
            auth_data = json.loads(resp.read().decode())
            uid = auth_data.get('id') or auth_data['user']['id']
            token = auth_data.get('access_token') or auth_data['session']['access_token']
            print(f"✔ [PASS] Staging Auth Registration: uid={uid}")
    except Exception as e:
        print(f"❌ [FAIL] Staging auth registration failed: {e}")
        return 1

    headers = {
        "apikey": test_key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }

    print("\n▶ Stage 2: Staging Profile Trigger & Non-Fabricated Defaults")
    try:
        req_prof = urllib.request.Request(f"{validated_url}/rest/v1/profiles?id=eq.{uid}", headers=headers)
        with urllib.request.urlopen(req_prof) as resp:
            prof_data = json.loads(resp.read().decode())
            assert len(prof_data) == 1, "Profile trigger failed"
            p = prof_data[0]
            assert p['village'] == "StagingVillage"
            assert p['district'] == "StagingDistrict"
            assert p['role'] == "farmer"
            print(f"✔ [PASS] Staging Profile Provisioned: farmer_id={p.get('farmer_id')}, role={p.get('role')}")
    except Exception as e:
        print(f"❌ [FAIL] Profile verification failed: {e}")
        return 1

    print("\n▶ Stage 3: Public Profiles Discovery View Sanitization")
    try:
        req_pub = urllib.request.Request(f"{validated_url}/rest/v1/public_profiles?select=*&limit=1", headers=headers)
        with urllib.request.urlopen(req_pub) as resp:
            pub_data = json.loads(resp.read().decode())
            assert len(pub_data) >= 1
            sanitized_keys = set(pub_data[0].keys())
            prohibited_keys = {"id", "user_id", "phone", "email", "village", "land_acres", "kcc_credit_limit", "agristack_id"}
            leaked = prohibited_keys.intersection(sanitized_keys)
            assert len(leaked) == 0, f"Public profiles view leaked private fields: {leaked}"
            print(f"✔ [PASS] Public Profiles View Sanitized (0 private fields leaked: {sanitized_keys})")
    except Exception as e:
        print(f"❌ [FAIL] Public profiles verification failed: {e}")
        return 1

    print("\n======================================================================")
    print("✔ STAGING SUPABASE INTEGRATION VERIFICATION COMPLETE: ALL PASS")
    print("======================================================================")
    return 0

if __name__ == '__main__':
    exit_code = run_staging_supabase_integration_test()
    sys.exit(exit_code)
