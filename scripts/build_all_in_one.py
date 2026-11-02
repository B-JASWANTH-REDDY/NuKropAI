import sys
sys.stdout.reconfigure(encoding='utf-8')

# Let's inspect CANONICAL_PRODUCTION_SETUP.sql and NUKROP_SUPABASE_ADDITIONS.sql
with open('supabase/CANONICAL_PRODUCTION_SETUP.sql', 'r', encoding='utf-8') as f:
    canon = f.read()

with open('supabase/NUKROP_SUPABASE_ADDITIONS.sql', 'r', encoding='utf-8') as f:
    additions = f.read()

print('Canonical length:', len(canon))
print('Additions length:', len(additions))
