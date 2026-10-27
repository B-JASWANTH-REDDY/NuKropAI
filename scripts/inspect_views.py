# -*- coding: utf-8 -*-
import sys, re

sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Find openScreen definition
idx = text.find('function openScreen(')
if idx != -1:
    print('=== openScreen ===')
    print(text[idx:idx+800])

# Find where screen containers are defined
views = re.findall(r'id=["\'](screen-[^"\']+|view-[^"\']+)["\']', text)
print('Screen/view IDs:', set(views))

# Also search for 'case \'' in openScreen
case_matches = re.findall(r'case\s+[\'"]([^\'"]+)[\'"]:', text[idx:idx+4000] if idx != -1 else '')
print('openScreen cases:', case_matches)
