import re, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

for m in re.finditer(r'id=["\']price-alert-modal["\']', text):
    start = m.start()
    line_no = text[:start].count('\n') + 1
    print("Found at line", line_no)
    print(text[start-50:start+300])
