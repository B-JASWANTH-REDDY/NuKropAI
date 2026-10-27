import re, sys, os

sys.stdout.reconfigure(encoding='utf-8')

print("Loading index.html and nukrop_emulator.html...")
with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    idx = f.read()

with open('nukrop_emulator.html', 'r', encoding='utf-8') as f:
    emu = f.read()

# Helper function to assert and replace
def safe_replace(content, pattern_or_target, replacement, desc, file_name, is_regex=False):
    if is_regex:
        if not re.search(pattern_or_target, content):
            print(f"FAILED to find pattern for {desc} in {file_name}")
            return content, False
        new_content = re.sub(pattern_or_target, replacement, content, count=1)
        print(f"SUCCESS: {desc} in {file_name}")
        return new_content, True
    else:
        if pattern_or_target not in content:
            print(f"FAILED to find exact target for {desc} in {file_name}")
            return content, False
        new_content = content.replace(pattern_or_target, replacement, 1)
        print(f"SUCCESS: {desc} in {file_name}")
        return new_content, True

print("Test run completed.")
