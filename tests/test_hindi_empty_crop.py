import os, sys
from playwright.sync_api import sync_playwright

sys.stdout.reconfigure(encoding='utf-8')
html_path = os.path.abspath('app/src/main/assets/index.html').replace('\\', '/')

if __name__ == '__main__':
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 430, 'height': 932})
        page.add_init_script("""
            localStorage.setItem('nukrop_user_lang', 'hi');
            localStorage.setItem('nukrop_onboarding_plantix_completed', 'true');
            localStorage.setItem('nukrop_auth_method', 'guest');
        """)
        page.goto(f"file:///{html_path}")
        page.wait_for_timeout(1000)
        page.evaluate("openCropModal()")
        page.wait_for_timeout(500)
        page.evaluate("filterCropCatalog('xyznonexistentcrop123')")
        result_text = page.evaluate("document.getElementById('crop-modal-grid')?.innerText.trim()")
        print(f"HINDI EMPTY CROP TEXT: '{result_text}'")
        assert result_text == 'कोई फसल नहीं मिली', f"Unexpected text: {result_text}"
        print("VERIFICATION SUCCESS: Hindi empty crop catalog search results use proper Devanagari Hindi!")
        browser.close()
