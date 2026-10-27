import sys, re

sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

idx = text.find('function advanceSlide')
print("=== advanceSlide ===")
print(text[idx:idx+2500])

idx2 = text.find('function renderPlantixLanguageScreen')
print("=== renderPlantixLanguageScreen ===")
print(text[idx2:idx2+2500])
