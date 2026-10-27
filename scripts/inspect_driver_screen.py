import re, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines):
    if "screenKey === 'driver_dashboard'" in line or "case 'driver_dashboard'" in line:
        print(f"Line {idx+1}: {line.rstrip()}")
        for sub_idx in range(idx, min(idx + 120, len(lines))):
            print(f"{sub_idx+1}: {lines[sub_idx].rstrip()}")
        break
