import re, sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

def print_function(name):
    print(f"\n==================== FUNCTION: {name} ====================")
    found = False
    brace_count = 0
    fn_lines = []
    for idx, line in enumerate(lines):
        if not found:
            if re.search(rf'function\s+{name}\s*\(', line):
                found = True
                fn_lines.append((idx+1, line))
                brace_count += line.count('{') - line.count('}')
                if brace_count == 0 and '{' in line:
                    break
        else:
            fn_lines.append((idx+1, line))
            brace_count += line.count('{') - line.count('}')
            if brace_count <= 0:
                break
    if found:
        for lnum, l in fn_lines[:60]:
            print(f"{lnum}: {l.rstrip()}")
        if len(fn_lines) > 60:
            print(f"... [{len(fn_lines)-60} lines truncated] ...")
            for lnum, l in fn_lines[-10:]:
                print(f"{lnum}: {l.rstrip()}")

print_function('confirmGramhaulBooking')
print_function('executeRealGramhaulDispatch')
print_function('startGramhaulRealtimeTracking')
print_function('displayDriverIncomingHaulModal')
