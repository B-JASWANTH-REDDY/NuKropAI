import sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if re.search(r'\balert\(', l):
        print(f"Line {i+1}: {l.strip()[:120]}")
