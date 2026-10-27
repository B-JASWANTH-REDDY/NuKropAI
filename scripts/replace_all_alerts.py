import sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all regex matches for alert(...)
# If alert(TL(...)) -> showLuxuryToast(TL(...), 'info')
# If alert('...') -> showLuxuryToast('...', 'info')
# If onclick="alert('...')" -> onclick="showLuxuryToast('...', 'info')"
# If alert(`...`) -> showLuxuryToast(`...`, 'info')

def replacer(match):
    prefix = match.group(1) # e.g. onclick=" or whitespace or empty
    arg = match.group(2)
    suffix = match.group(3)
    # Determine type
    toast_type = "'info'"
    if '✅' in arg or 'Success' in arg or 'success' in arg or '✓' in arg:
        toast_type = "'success'"
    elif '⚠️' in arg or 'Please' in arg or 'warning' in arg:
        toast_type = "'warning'"
    elif '❌' in arg or 'error' in arg or 'Error' in arg:
        toast_type = "'error'"

    return f"{prefix}showLuxuryToast({arg}, {toast_type}){suffix}"

# Regex for alert(arg)
# Note: we need to handle balanced parentheses or simple single-line patterns
lines = content.split('\n')
modified_count = 0

for i in range(len(lines)):
    line = lines[i]
    if 'alert(' in line:
        # Check onclick="alert('...')"
        line_mod = re.sub(r'onclick="alert\((.*?)\)(;[^"]*)?"', r'onclick="showLuxuryToast(\1, \'info\')\2"', line)
        if line_mod != line:
            lines[i] = line_mod
            modified_count += 1
            continue
        
        # Check alert(...)
        line_mod = re.sub(r'\balert\(', 'showLuxuryToast(', line)
        if line_mod != line:
            lines[i] = line_mod
            modified_count += 1

print(f"Replaced {modified_count} lines containing alert(")

content = '\n'.join(lines)
with open('app/src/main/assets/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Saved updated index.html!")
