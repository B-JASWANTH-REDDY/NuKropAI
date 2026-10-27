import os, sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
html_path = os.path.abspath('app/src/main/assets/index.html').replace('\\', '/')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 430, 'height': 932})
    page.add_init_script("""
        localStorage.setItem('nukrop_user_lang', 'en');
        localStorage.setItem('nukrop_onboarding_plantix_completed', 'true');
        localStorage.setItem('nukrop_auth_method', 'guest');
    """)
    page.goto(f"file:///{html_path}")
    page.wait_for_timeout(1000)

    # 1. Community badge test
    b_before = page.evaluate('!!document.getElementById("community-badge")')
    print('community-badge on raw boot:', b_before)

    # 2. openSearchLandSurveyModal():
    page.evaluate('if (typeof openSearchLandSurveyModal === "function") openSearchLandSurveyModal();')
    print('ror-aadhaar-input:', page.evaluate('!!document.getElementById("ror-aadhaar-input")'))
    print('login-phone-input:', page.evaluate('!!document.getElementById("login-phone-input")'))
    print('pa-phone-inp:', page.evaluate('!!document.getElementById("pa-phone-inp")'))

    # 3. openScreen('gramhaul_tracking'):
    page.evaluate('openScreen("gramhaul_tracking")')
    print('gramhaul-tracking-bottom-sheet:', page.evaluate('!!document.getElementById("gramhaul-tracking-bottom-sheet")'))

    # 4. Modals with correct signatures:
    modals = [
        ('handleFarmerLogout()', 'farmer-logout-confirm-modal'),
        ('openDriverTruckRegistrationModal()', 'driver-truck-reg-modal'),
        ('openDriverCallModal("Raju", "9999999999", "Tata Ace", 4.8)', 'driver-contact-sheet-modal'),
        ('openDriverVehicleSelectorModal()', 'driver-vehicle-selector-modal'),
        ('openDriverInsuranceFastagModal()', 'driver-insurance-modal'),
        ('openSettingsModal()', 'app-settings-modal'),
        ('executeUserLogout()', 'nukrop-logout-confirm-modal'),
        ('openGramhaulCropSelectorModal()', 'gramhaul-crop-modal'),
        ('driverCompleteHaulTrip("t1", 500)', 'driver-payment-collection-modal'),
        ('openKccDisbursalModal()', 'kcc-disbursal-sheet-modal'),
        ('openKccEnhanceModal()', 'kcc-enhance-sheet-modal'),
        ('openBioRxRecipeModal("Custom Mix", "Neem, Cow urine", "Boil and filter", "5L/acre")', 'biorx-recipe-sheet-modal'),
        ('openKisanHelplineModal()', 'kisan-helpline-sheet-modal')
    ]
    for fn, mid in modals:
        err = page.evaluate(f'''(() => {{
            try {{
                {fn};
                return null;
            }} catch(e) {{
                return e.message;
            }}
        }})()''')
        found = page.evaluate(f'!!document.getElementById("{mid}")')
        print(f'{mid} via {fn}: {found} (err: {err})')

    # 5. Scanner diagnostic for save-presc-btn:
    page.evaluate('openScreen("scanner")')
    page.evaluate('''(() => {
        try {
            startScannerDiagnostic();
        } catch(e) {
            console.log(e);
        }
    })()''')
    page.wait_for_timeout(1000)
    print('save-presc-btn after startScannerDiagnostic():', page.evaluate('!!document.getElementById("save-presc-btn")'))

    browser.close()
