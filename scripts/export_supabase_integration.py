import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/js/supabase_integration.js', 'r', encoding='utf-8') as f:
    c = f.read()

import re
funcs = re.findall(r'(?:async\s+)?function\s+([a-zA-Z0-9_]+)', c)

export_block = "\n\n// ─── WINDOW EXPORTS FOR GLOBAL RUNTIME INTEROP ───\n"
for fn in funcs:
    export_block += f"if (typeof {fn} !== 'undefined') window.{fn} = {fn};\n"

if "// ─── WINDOW EXPORTS FOR GLOBAL RUNTIME INTEROP ───" not in c:
    c = c.rstrip() + export_block

    with open('app/src/main/assets/js/supabase_integration.js', 'w', encoding='utf-8') as f:
        f.write(c)

    with open('js/supabase_integration.js', 'w', encoding='utf-8') as f:
        f.write(c)

    print("Appended window exports to supabase_integration.js in both locations!")
else:
    print("Exports already present.")
