import re, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

targets = ['driver_suresh_01', 'Suresh', 'Ramesh', 'B. Jaswanth Reddy']
for idx, line in enumerate(lines):
    for t in targets:
        if t.lower() in line.lower():
            print(f"Line {idx+1} [{t}]: {line.strip()[:120]}")
