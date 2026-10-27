with open('scratch/test_community_light.js', 'r', encoding='utf-8') as f:
    code = f.read()

target = "const match = btn.getAttribute('onclick').match(/setCommunityFilter\\('([^']+)'\\)/);"
replacement = "const onclickAttr = btn.getAttribute('onclick') || ''; const match = onclickAttr.match(/setCommunityFilter\\('([^']+)'\\)/);"

if target in code:
    code = code.replace(target, replacement)
    print("Replaced target in test file.")

with open('scratch/test_community_light.js', 'w', encoding='utf-8') as f:
    f.write(code)

import subprocess
res = subprocess.run(['node', 'scratch/test_community_light.js'], capture_output=True, text=True)
print("STDOUT:\n", res.stdout)
print("STDERR:\n", res.stderr)
