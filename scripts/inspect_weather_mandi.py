# -*- coding: utf-8 -*-
import sys, re

sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

screens = re.findall(r'<div[^>]*class=["\'][^"\']*screen[^"\']*["\'][^>]*id=["\']([^"\']+)["\']', text)
print('Screens found in index.html:', len(screens))
for s in screens:
    if any(k in s for k in ['weather', 'home', 'market', 'scan', 'gramhaul', 'soil', 'iot']):
        print('  Screen:', s)

idx = text.find('AGMARKNET_MANDI_CATALOG = [')
if idx != -1:
    print('=== AGMARKNET_MANDI_CATALOG ===')
    print(text[idx:idx+1500])

with open('app/src/main/assets/index.html', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

for i, l in enumerate(lines):
    if 'id="w-temp"' in l:
        print(f'w-temp found at line {i+1}')
        for j in range(max(0, i-25), min(len(lines), i+65)):
            print(f'{j+1}: {lines[j]}', end='')
        break













