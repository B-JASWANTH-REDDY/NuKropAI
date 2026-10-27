import sys

sys.stdout.reconfigure(encoding='utf-8')
start = int(sys.argv[1])
end = int(sys.argv[2])
filepath = sys.argv[3] if len(sys.argv) > 3 else 'app/src/main/assets/index.html'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(start - 1, min(end, len(lines))):
    print(f"{i+1}: {lines[i]}", end='')
