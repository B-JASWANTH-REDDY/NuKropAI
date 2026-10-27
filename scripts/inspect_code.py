import re

with open('app/src/main/assets/js/supabase_integration.js', 'r', encoding='utf-8') as f:
    c = f.read()

tables = set(re.findall(r"\.from\(['\"]([a-zA-Z0-9_]+)['\"]", c))
print('Tables in supabase_integration.js:', sorted(list(tables)))

funcs = re.findall(r"(?:async\s+)?function\s+([a-zA-Z0-9_]+)", c)
print('Functions in supabase_integration.js:', len(funcs), funcs[:25])
