import sys, re
sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

# 1. Search for @import url in <style>
for i, l in enumerate(lines[:100]):
    if '@import' in l:
        print(f"Line {i+1}: {l.strip()}")

# 2. Search for .m3-card
m3_cards = [(i+1, l.strip()) for i, l in enumerate(lines) if '.m3-card' in l and '{' in l]
print("m3-card declarations:", m3_cards)

# 3. Search for .plantix-crop-badge
plantix = [(i+1, l.strip()) for i, l in enumerate(lines) if '.plantix-crop-badge' in l and '{' in l]
print("plantix-crop-badge declarations:", plantix)

# 4. Search for .dock-tab-btn and .dock-center-fab
docks = [(i+1, l.strip()) for i, l in enumerate(lines[:1800]) if ('.dock-tab-btn' in l or '.dock-center-fab' in l) and '{' in l]
print("dock declarations count in head:", len(docks))
for d in docks:
    print(f"  Line {d[0]}: {d[1]}")

# 5. Search for #global-push-toast
toast_lines = [(i+1, l.strip()) for i, l in enumerate(lines) if 'global-push-toast' in l or 'toast-title' in l or 'toast-msg' in l]
print("global-push-toast lines:")
for tl in toast_lines:
    print(f"  Line {tl[0]}: {tl[1]}")

# 6. Search for ta translation
ta_lines = [(i+1, l.strip()) for i, l in enumerate(lines) if 'with Diesel & Pilot' in l]
print("ta translation lines:")
for tal in ta_lines:
    print(f"  Line {tal[0]}: {tal[1]}")

# 7. Search for turmeric in CROP_TRANSLATIONS
turmeric_lines = [(i+1, l.strip()) for i, l in enumerate(lines) if "'turmeric':" in l or '"turmeric":' in l]
print("turmeric lines:")
for tur in turmeric_lines:
    print(f"  Line {tur[0]}: {tur[1]}")

# 8. Search for GramHaul tracking
gh_lines = [(i+1, l.strip()) for i, l in enumerate(lines) if 'GRAMHAUL_POOLED_TRUCKS' in l or 'startGramhaulRealtimeTracking' in l or 'gramhaulLiveMap' in l]
print("GramHaul tracking lines:")
for g in gh_lines:
    print(f"  Line {g[0]}: {g[1]}")

# 9. Search for alert(
alert_lines = [(i+1, l.strip()) for i, l in enumerate(lines) if re.search(r'\balert\(', l)]
print(f"Total alert() calls: {len(alert_lines)}")
for al in alert_lines:
    print(f"  Line {al[0]}: {al[1]}")

# 10. Search for 579b464d in syncGovAgmarknetData
gov_lines = [(i+1, l.strip()) for i, l in enumerate(lines) if '579b464d' in l or 'syncGovAgmarknetData' in l]
print("Gov agmarknet lines:")
for g in gov_lines:
    print(f"  Line {g[0]}: {g[1]}")
