import sys, re
sys.stdout.reconfigure(encoding='utf-8')

q = sys.argv[1]
with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if q.lower() in l.lower():
        print(f"{i+1}: {l.strip()[:100]}")
