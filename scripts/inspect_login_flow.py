import sys, re

sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Check where 'login' is referenced with plantixFlowState
matches = list(re.finditer(r"plantixFlowState\.currentScreen\s*=\s*'login'", text))
print("plantixFlowState.currentScreen = 'login':", len(matches))
for m in matches:
    print(text[m.start()-50:m.start()+200])

# Check finishPlantixOnboarding
idx = text.find('function finishPlantixOnboarding')
print("\n=== finishPlantixOnboarding ===")
print(text[idx:idx+2500])

# Check renderLoginScreen
idx2 = text.find('function renderLoginScreen')
print("\n=== renderLoginScreen ===")
print(text[idx2:idx2+2500])
