import sys
sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/js/agristack_dpi_service.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace alerts
replacements = [
    ('alert("Please enter a verified Aadhaar / Farmer ID to inspect records.");',
     'if (typeof showLuxuryToast === "function") showLuxuryToast("Please enter a verified Aadhaar / Farmer ID to inspect records.", "warning"); else console.warn("Aadhaar query empty");'),
    
    ('alert("No verified land parcels found for this identifier in the National Registry.");',
     'if (typeof showLuxuryToast === "function") showLuxuryToast("No verified land parcels found for this identifier in the National Registry.", "warning"); else console.warn("No parcels found");'),
    
    ('alert("Database client is offline. Please check connection.");',
     'if (typeof showLuxuryToast === "function") showLuxuryToast("Database client is offline. Please check connection.", "error"); else console.error("Database client offline");'),
    
    ('alert("Please log into your application account first.");',
     'if (typeof showLuxuryToast === "function") showLuxuryToast("Please log into your application account first.", "warning"); else console.warn("Login required");'),
    
    ('alert("No active parcel selected to save.");',
     'if (typeof showLuxuryToast === "function") showLuxuryToast("No active parcel selected to save.", "warning"); else console.warn("No parcel selected");'),
    
    ('alert("✓ Plot already saved in your dashboard portfolio!");',
     'if (typeof showLuxuryToast === "function") showLuxuryToast("✓ Plot already saved in your dashboard portfolio!", "info"); else console.log("Plot already saved");'),
    
    ('alert("Error saving record: " + error.message);',
     'if (typeof showLuxuryToast === "function") showLuxuryToast("Error saving record: " + error.message, "error"); else console.error(error.message);'),
    
    ('alert("✓ Plot successfully saved and linked to your dashboard portfolio!");',
     'if (typeof showLuxuryToast === "function") showLuxuryToast("✓ Plot successfully saved and linked to your dashboard portfolio!", "success"); else console.log("Plot saved");')
]

for old, new in replacements:
    if old in content:
        content = content.replace(old, new)
        print(f"Replaced: {old[:40]}...")
    else:
        print(f"Already replaced or not found: {old[:40]}...")

with open('app/src/main/assets/js/agristack_dpi_service.js', 'w', encoding='utf-8') as f:
    f.write(content)

with open('js/agristack_dpi_service.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated agristack_dpi_service.js in both locations successfully!")
