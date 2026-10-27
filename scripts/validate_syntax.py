import sys, re, subprocess

sys.stdout.reconfigure(encoding='utf-8')

# 1. Validate JS files directly
js_files = [
    'app/src/main/assets/js/supabase_production_bridge.js',
    'app/src/main/assets/js/supabase_integration.js',
    'app/src/main/assets/js/geo_tracking_service.js',
    'app/src/main/assets/js/agristack_dpi_service.js'
]

for f in js_files:
    res = subprocess.run(['node', '--check', f], capture_output=True, text=True)
    if res.returncode == 0:
        print(f"✓ Syntax VALID: {f}")
    else:
        print(f"✗ Syntax ERROR: {f}\n{res.stderr}")

# 2. Validate scripts inside index.html
with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract inline script
scripts = re.findall(r'<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>', html, re.IGNORECASE)
print(f"Found {len(scripts)} inline script block(s) in index.html")

for idx, s in enumerate(scripts):
    temp_name = f'scratch/temp_script_check_{idx}.js'
    with open(temp_name, 'w', encoding='utf-8') as tf:
        tf.write(s)
    
    res = subprocess.run(['node', '--check', temp_name], capture_output=True, text=True)
    if res.returncode == 0:
        print(f"✓ Inline script {idx} Syntax VALID ({len(s)} chars)")
    else:
        print(f"✗ Inline script {idx} Syntax ERROR:\n{res.stderr[:500]}")
