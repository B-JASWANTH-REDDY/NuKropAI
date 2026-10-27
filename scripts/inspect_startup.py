import sys, re

sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Find static HTML tags with id startup-experience-overlay
static_matches = list(re.finditer(r'<[a-zA-Z0-9_-]+[^>]*id=["\']startup-experience-overlay["\']', text))
print("Static HTML tag for startup-experience-overlay count:", len(static_matches))
for m in static_matches:
    print("Found static HTML:", text[m.start():m.start()+300])

# Also check phone-chassis
chassis = list(re.finditer(r'class=["\'][^"\']*phone-chassis', text))
print("phone-chassis tag count:", len(chassis))
for m in chassis:
    print("Found chassis tag:", text[m.start():m.start()+200])
