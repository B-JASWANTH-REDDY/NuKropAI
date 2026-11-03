import urllib.request
import urllib.error
import json
import uuid
import sys

sys.stdout.reconfigure(encoding='utf-8')

key = ''
with open('.env') as f:
    for line in f:
        if line.startswith('SUPABASE_ANON_KEY='):
            key = line.split('=', 1)[1].strip()

url = 'https://yxjqseiegwjdfnccdchk.supabase.co'

print("======================================================================")
print("🛡️  NUKROPAI LIVE STORAGE SECURITY & END-TO-END VALIDATION SUITE")
print("======================================================================\n")

# 1. Setup Farmer A
email_a = f"farmer_storage_a_{uuid.uuid4().hex[:8]}@example.com"
req_a = urllib.request.Request(
    f"{url}/auth/v1/signup",
    data=json.dumps({"email": email_a, "password": "SecurePassword2026!", "data": {"full_name": "Storage Farmer A"}}).encode('utf-8'),
    headers={"apikey": key, "Content-Type": "application/json"}
)
with urllib.request.urlopen(req_a) as resp:
    res_a = json.loads(resp.read().decode())
    uid_a = res_a.get('id') or res_a['user']['id']
    token_a = res_a.get('access_token') or res_a['session']['access_token']

# 2. Setup Farmer B (Adversary)
email_b = f"farmer_storage_b_{uuid.uuid4().hex[:8]}@example.com"
req_b = urllib.request.Request(
    f"{url}/auth/v1/signup",
    data=json.dumps({"email": email_b, "password": "SecurePassword2026!", "data": {"full_name": "Adversary Farmer B"}}).encode('utf-8'),
    headers={"apikey": key, "Content-Type": "application/json"}
)
with urllib.request.urlopen(req_b) as resp:
    res_b = json.loads(resp.read().decode())
    uid_b = res_b.get('id') or res_b['user']['id']
    token_b = res_b.get('access_token') or res_b['session']['access_token']

headers_a = {"apikey": key, "Authorization": f"Bearer {token_a}"}
headers_b = {"apikey": key, "Authorization": f"Bearer {token_b}"}
headers_anon = {"apikey": key}

dummy_png = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

# TEST 1: Farmer A uploads private crop scan
file_path_a = f"{uid_a}/field_scan_{uuid.uuid4().hex[:6]}.png"
req_up = urllib.request.Request(
    f"{url}/storage/v1/object/crop-scans/{file_path_a}",
    data=dummy_png,
    headers={**headers_a, "Content-Type": "image/png"}
)
with urllib.request.urlopen(req_up) as resp:
    assert resp.status in (200, 201)
    print(f"✔ [PASS] 1. Farmer A Upload to private 'crop-scans': SUCCESS (HTTP {resp.status}) -> {file_path_a}")

# TEST 2: Farmer A reads own private scan
req_down_a = urllib.request.Request(f"{url}/storage/v1/object/authenticated/crop-scans/{file_path_a}", headers=headers_a)
with urllib.request.urlopen(req_down_a) as resp:
    downloaded = resp.read()
    assert downloaded == dummy_png
    print(f"✔ [PASS] 2. Farmer A Authenticated Download of own scan: SUCCESS ({len(downloaded)} bytes verified)")

# TEST 3: Anonymous access to private scan MUST FAIL
req_anon = urllib.request.Request(f"{url}/storage/v1/object/public/crop-scans/{file_path_a}", headers=headers_anon)
try:
    with urllib.request.urlopen(req_anon) as resp:
        print("✖ [FAIL] 3. Anonymous read of private scan was permitted!")
        sys.exit(1)
except urllib.error.HTTPError as e:
    assert e.code in (400, 403, 404)
    print(f"✔ [PASS] 3. Anonymous read of private 'crop-scans' BLOCKED (HTTP {e.code})")

# TEST 4: Farmer B (Cross-Tenant) access to Farmer A's scan MUST FAIL
req_down_b = urllib.request.Request(f"{url}/storage/v1/object/authenticated/crop-scans/{file_path_a}", headers=headers_b)
try:
    with urllib.request.urlopen(req_down_b) as resp:
        print("✖ [FAIL] 4. Farmer B read of Farmer A scan was permitted!")
        sys.exit(1)
except urllib.error.HTTPError as e:
    assert e.code in (400, 403, 404)
    print(f"✔ [PASS] 4. Cross-Tenant Farmer B read of Farmer A scan BLOCKED (HTTP {e.code})")

# TEST 5: Farmer A generates signed URL (nk_getSignedScanUrl pattern)
req_sign = urllib.request.Request(
    f"{url}/storage/v1/object/sign/crop-scans/{file_path_a}",
    data=json.dumps({"expiresIn": 3600}).encode('utf-8'),
    headers={**headers_a, "Content-Type": "application/json"}
)
with urllib.request.urlopen(req_sign) as resp:
    sign_data = json.loads(resp.read().decode())
    signed_path = sign_data.get('signedURL') or sign_data.get('signedUrl')
    assert signed_path, "Signed URL missing from response"
    full_signed_url = f"{url}/storage/v1{signed_path}"
    print(f"✔ [PASS] 5. Cryptographic Signed URL Generated: SUCCESS (Valid for 3600s)")

# TEST 6: Signed URL retrieval without bearer token
req_signed_fetch = urllib.request.Request(full_signed_url, headers=headers_anon)
with urllib.request.urlopen(req_signed_fetch) as resp:
    signed_bytes = resp.read()
    assert signed_bytes == dummy_png
    print(f"✔ [PASS] 6. Signed URL Download Verification: SUCCESS ({len(signed_bytes)} bytes match)")

# TEST 7: Public bucket 'avatars' upload & public read
avatar_path = f"{uid_a}/profile.png"
req_av_up = urllib.request.Request(
    f"{url}/storage/v1/object/avatars/{avatar_path}",
    data=dummy_png,
    headers={**headers_a, "Content-Type": "image/png"}
)
with urllib.request.urlopen(req_av_up) as resp:
    print(f"✔ [PASS] 7. Farmer A Upload to public 'avatars': SUCCESS (HTTP {resp.status})")

req_av_pub = urllib.request.Request(f"{url}/storage/v1/object/public/avatars/{avatar_path}", headers=headers_anon)
with urllib.request.urlopen(req_av_pub) as resp:
    av_bytes = resp.read()
    assert av_bytes == dummy_png
    print(f"✔ [PASS] 8. Anonymous Public Read of avatar: SUCCESS ({len(av_bytes)} bytes)")

# TEST 8: Adversarial Deletion: Farmer B cannot delete Farmer A's scan
req_del_b = urllib.request.Request(
    f"{url}/storage/v1/object/crop-scans",
    data=json.dumps({"prefixes": [file_path_a]}).encode('utf-8'),
    headers={**headers_b, "Content-Type": "application/json"}
)
try:
    with urllib.request.urlopen(req_del_b) as resp:
        del_res = json.loads(resp.read().decode())
        # If Supabase storage delete returns empty list when no rows match RLS:
        deleted_count = len(del_res) if isinstance(del_res, list) else 0
        assert deleted_count == 0, f"Farmer B deleted {deleted_count} files belonging to Farmer A!"
        print(f"✔ [PASS] 9. Cross-Tenant File Deletion BLOCKED: Farmer B deleted 0 files")
except urllib.error.HTTPError as e:
    assert e.code in (400, 403, 404)
    print(f"✔ [PASS] 9. Cross-Tenant File Deletion BLOCKED by policy (HTTP {e.code})")

# TEST 9: Owner Deletion: Farmer A deletes own scan
req_del_a = urllib.request.Request(
    f"{url}/storage/v1/object/crop-scans/{file_path_a}",
    headers=headers_a
)
req_del_a.get_method = lambda: 'DELETE'
with urllib.request.urlopen(req_del_a) as resp:
    assert resp.status in (200, 204)
    print(f"✔ [PASS] 10. Farmer A Owner Deletion of scan: SUCCESS (HTTP {resp.status})")

print("\n======================================================================")
print("✨ ALL 10 STORAGE SECURITY & ACCESS ASSERTIONS VERIFIED 100%!")
print("======================================================================\n")
