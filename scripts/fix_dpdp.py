with open('nukrop_emulator.html', 'r', encoding='utf-8') as f:
    c = f.read()

bad = "'📦 Data Portability Export Complete!\\n\\nYour complete encrypted farm record (JSON, 'info') has been downloaded per DPDP Act 2023 compliance.'"
good = "'📦 Data Portability Export Complete!\\n\\nYour complete encrypted farm record (JSON) has been downloaded per DPDP Act 2023 compliance.'"

if bad in c:
    c = c.replace(bad, good, 1)
    with open('nukrop_emulator.html', 'w', encoding='utf-8') as f:
        f.write(c)
    print("Fixed DPDP JSON toast in nukrop_emulator.html")
else:
    print("Not found")
