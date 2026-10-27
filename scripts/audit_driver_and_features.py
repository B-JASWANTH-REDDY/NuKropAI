import re, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

print("--- 1. Search for driver_dashboard screen generation ---")
for m in re.finditer(r'case\s+[\'"]driver_dashboard[\'"]|if\s*\(\s*screenKey\s*===?\s*[\'"]driver_dashboard[\'"]', text):
    start = m.start()
    print("Found at character", start, "line", text[:start].count('\n') + 1)
    print(text[start:start+300])

print("\n--- 2. Weather fetching logic ---")
for m in re.finditer(r'function\s+(?:fetchRealLocationAndWeather|refreshWeatherData|updateWeatherCardDom)', text):
    start = m.start()
    print("Weather func at line", text[:start].count('\n') + 1)
    print(text[start:start+400])

print("\n--- 3. Price alerts logic ---")
for m in re.finditer(r'function\s+(?:openPriceAlertModal|saveCurrentPriceAlert|initRealPriceAlerts|checkAndTriggerRealtimeAlerts|simulatePriceAlertTrigger)', text):
    start = m.start()
    print("Alert func at line", text[:start].count('\n') + 1)
    print(text[start:start+300])

print("\n--- 4. Community posts logic ---")
for m in re.finditer(r'function\s+(?:renderCommunityFeedDom|setCommunityFilter|submitNewCommunityPost|toggleCommunityLike)', text):
    start = m.start()
    print("Community func at line", text[:start].count('\n') + 1)
    print(text[start:start+300])
