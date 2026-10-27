import re

with open('nukrop_emulator.html', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Deduplicate turmeric in CROP_TRANSLATIONS
# Find duplicate turmeric
patt = r"(\s*'turmeric':\s*\{[^\}]+\},)"
matches = list(re.finditer(patt, c))
if len(matches) > 1:
    # Remove second occurrence
    second_start = matches[1].start()
    second_end = matches[1].end()
    c = c[:second_start] + c[second_end:]
    print("Removed duplicate turmeric from CROP_TRANSLATIONS")

# 2. Window alert failsafe & replacement
# Inject window.alert override right at the top of the main <script>
script_marker = "<script>\n"
if script_marker in c:
    replacement_interceptor = """<script>
// Mobile WebView Failsafe: Never block UI thread with window.alert
window._nativeAlert = window.alert;
window.alert = function(msg) {
  if (typeof showLuxuryToast === 'function') {
    showLuxuryToast(String(msg), 'info');
  } else {
    console.warn('[Alert Intercepted]:', msg);
  }
};
"""
    c = c.replace(script_marker, replacement_interceptor, 1)
    print("Injected window.alert override in nukrop_emulator.html")

# 3. Replace direct alert(...) with showLuxuryToast(...)
def replace_alert(m):
    arg = m.group(1).strip()
    return f"showLuxuryToast({arg}, 'info')"

c = re.sub(r'(?<![a-zA-Z0-9_\$])alert\(([^)]+)\)', replace_alert, c)

with open('nukrop_emulator.html', 'w', encoding='utf-8') as f:
    f.write(c)

print("nukrop_emulator.html fully updated!")
