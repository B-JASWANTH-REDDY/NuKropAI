import urllib.request
import urllib.error
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

key = ''
with open('.env') as f:
    for line in f:
        if line.startswith('SUPABASE_ANON_KEY='):
            key = line.split('=', 1)[1].strip()

url = 'https://yxjqseiegwjdfnccdchk.supabase.co'

# Parse CANONICAL_PRODUCTION_SETUP.sql for tables and columns
with open('supabase/CANONICAL_PRODUCTION_SETUP.sql', 'r', encoding='utf-8') as f:
    sql = f.read()

table_blocks = re.findall(
    r'CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)\s*\((.*?)\);',
    sql,
    re.DOTALL | re.IGNORECASE
)

print(f'Parsed {len(table_blocks)} table blocks from CANONICAL_PRODUCTION_SETUP.sql')

table_cols = {}
for tbl, block in table_blocks:
    cols = []
    lines = block.split('\n')
    for line in lines:
        line = line.strip().rstrip(',')
        if (
            not line
            or line.startswith('--')
            or line.startswith('/*')
            or line.startswith('CONSTRAINT')
            or line.startswith('PRIMARY KEY')
            or line.startswith('UNIQUE')
            or line.startswith('FOREIGN KEY')
            or line.startswith('CHECK')
        ):
            continue
        parts = line.split()
        if len(parts) >= 2:
            col_name = parts[0].strip('\"')
            if col_name.isidentifier() and col_name.lower() not in [
                'primary', 'constraint', 'unique', 'foreign', 'check', 'references'
            ]:
                cols.append(col_name)
    table_cols[tbl] = list(dict.fromkeys(cols))

def check_col(tbl, col):
    req = urllib.request.Request(
        f'{url}/rest/v1/{tbl}?select={col}&limit=1',
        headers={'apikey': key, 'Authorization': f'Bearer {key}'}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return True, 'EXISTS'
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        if '42703' in body:
            return False, 'MISSING_COL'
        elif '42P01' in body or 'PGRST205' in body:
            return False, 'TABLE_NOT_FOUND'
        elif '42501' in body:
            return True, 'PROTECTED_RLS'
        return False, f'ERR_{e.code}'
    except Exception as e:
        return False, str(e)

print('\nAuditing live Supabase tables and columns...')
report = {}
missing_details = {}

for tbl, cols in sorted(table_cols.items()):
    missing = []
    table_exists = True
    for col in cols:
        exists, status = check_col(tbl, col)
        if status == 'TABLE_NOT_FOUND':
            table_exists = False
            break
        if not exists:
            missing.append((col, status))
    if not table_exists:
        report[tbl] = 'TABLE_MISSING'
    elif missing:
        report[tbl] = f'MISSING_COLS ({len(missing)} of {len(cols)})'
        missing_details[tbl] = missing
    else:
        report[tbl] = f'ALL_{len(cols)}_COLS_VERIFIED'

print('\n======================================================================')
print('LIVE DATABASE SCHEMA AUDIT RESULTS')
print('======================================================================')
for tbl, res in sorted(report.items()):
    print(f'{tbl:<25}: {res}')

if missing_details:
    print('\n======================================================================')
    print('DISCREPANCY DETAILS (MISSING OR MISMATCHED COLUMNS)')
    print('======================================================================')
    for tbl, miss in missing_details.items():
        print(f'{tbl}:')
        for col, reason in miss:
            print(f'   - {col}: {reason}')

