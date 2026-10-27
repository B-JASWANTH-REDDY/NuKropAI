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

    # Let's test each of the 44 IDs
    # 1. Static/Global elements on Home screen:
    static_ids = [
        'tab-equipment',
        'tab-khata',
        'tab-lbl-market',
        'tab-lbl-profile',
        'w-spray-compact-pill-box',
        'weather-status-pill-container',
        'nukrop-alert-banner',
        'login-screen-overlay',
        'toast-icon-plate',
        'toast-icon-svg',
        'saved-prescriptions-modal',
        'saved-rx-modal-title',
        'saved-prescriptions-list',
        'nukrop-luxury-toast-container'
    ]
    for sid in static_ids:
        found_id = page.evaluate(f'!!document.getElementById("{sid}")')
        found_q = page.evaluate(f'!!document.querySelector("#{sid}")')
        print(f"STATIC {sid}: id={found_id}, query={found_q}")

    # Check community-badge:
    cb_id = page.evaluate('!!document.getElementById("community-badge")')
    cb_q = page.evaluate('!!document.querySelector("#community-badge")')
    print(f"DOCK community-badge: id={cb_id}, query={cb_q}")

    # 2. Scanner screen:
    page.evaluate('openScreen("scanner")')
    page.wait_for_timeout(200)
    for sid in ['scanner-tab-history-badge', 'real-camera-capture-input', 'vf-scanner-overlay', 'vf-target-label']:
        found_id = page.evaluate(f'!!document.getElementById("{sid}")')
        found_q = page.evaluate(f'!!document.querySelector("#{sid}")')
        print(f"SCANNER {sid}: id={found_id}, query={found_q}")

    # Trigger diagnostic and wait 2.5s for save-presc-btn
    page.evaluate('startScannerDiagnostic()')
    page.wait_for_timeout(2500)
    sp_id = page.evaluate('!!document.getElementById("save-presc-btn")')
    sp_q = page.evaluate('!!document.querySelector("#save-presc-btn")')
    print(f"SCANNER save-presc-btn (after 2.5s): id={sp_id}, query={sp_q}")

    # 3. GramHaul screen:
    page.evaluate('openScreen("gramhaul")')
    page.wait_for_timeout(200)
    for gid in [
        'gramhaul-osm-map',
        'gh-live-radar-status',
        'gramhaul-coords-text',
        'gramhaul-loc-name',
        'gramhaul-trucks-container',
        'gh-phase-2-booked',
        'gh-phase-3-completed',
        'gh-delivered-mandi-name',
        'gh-total-fare-val'
    ]:
        found_id = page.evaluate(f'!!document.getElementById("{gid}")')
        found_q = page.evaluate(f'!!document.querySelector("#{gid}")')
        print(f"GRAMHAUL {gid}: id={found_id}, query={found_q}")

    # 4. GramHaul Tracking screen:
    page.evaluate('openScreen("gramhaul_tracking")')
    page.wait_for_timeout(200)
    ght_id = page.evaluate('!!document.getElementById("gramhaul-tracking-bottom-sheet")')
    ght_q = page.evaluate('!!document.querySelector("#gramhaul-tracking-bottom-sheet")')
    print(f"TRACKING gramhaul-tracking-bottom-sheet: id={ght_id}, query={ght_q}")

    # In tracking sheet, render trip to test gh-driver-eta-badge:
    page.evaluate("""
        (function() {
            const c = document.getElementById('gh-tracking-bottom-container') || document.body;
            c.innerHTML = '<div id="gh-dispatched-eta-badge"><span id="gh-driver-eta-badge">12 min</span></div>';
        })()
    """)
    eta_id = page.evaluate('!!document.getElementById("gh-driver-eta-badge")')
    eta_q = page.evaluate('!!document.querySelector("#gh-driver-eta-badge")')
    print(f"TRACKING gh-driver-eta-badge: id={eta_id}, query={eta_q}")

    # 5. AgriStack screen & RoR modal:
    page.evaluate('openScreen("agristack")')
    page.wait_for_timeout(200)
    page.evaluate('openSearchLandSurveyModal()')
    for aid in ['ror-aadhaar-input', 'login-phone-input', 'pa-phone-inp']:
        found_id = page.evaluate(f'!!document.getElementById("{aid}")')
        found_q = page.evaluate(f'!!document.querySelector("#{aid}")')
        print(f"AGRISTACK {aid}: id={found_id}, query={found_q}")

    # 6. Modals:
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
        ('openBioRxRecipeModal("Custom", "Ing", "Steps", "Dose")', 'biorx-recipe-sheet-modal'),
        ('openKisanHelplineModal()', 'kisan-helpline-sheet-modal')
    ]
    for fn, mid in modals:
        page.evaluate(f'{fn}')
        found_id = page.evaluate(f'!!document.getElementById("{mid}")')
        found_q = page.evaluate(f'!!document.querySelector("#{mid}")')
        print(f"MODAL {mid} ({fn}): id={found_id}, query={found_q}")

    browser.close()
