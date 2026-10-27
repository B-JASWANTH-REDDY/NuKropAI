# -*- coding: utf-8 -*-
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

old_range_block = """      <!-- Arrival & Min-Max details -->
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:#475569;margin-bottom:10px;padding:0 2px;">
        <span>📊 <strong>${TL('Range', 'ధరల పరిమితి', 'Range')}:</strong> ₹${item.minPrice.toLocaleString()} - ₹${item.maxPrice.toLocaleString()}</span>
        <span>🚚 <strong>${TL('Arrivals', 'రాక', 'Arrivals')}:</strong> ${item.arrivals.toLocaleString()} Qtl</span>
      </div>"""

new_range_block = """      <!-- Arrival & Min-Max details -->
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:10.5px;color:#475569;margin-bottom:6px;padding:0 2px;">
        <span>📊 <strong>${TL('Range', 'ధరల పరిమితి', 'Range')}:</strong> ${item.minPrice ? '₹' + item.minPrice.toLocaleString() : '₹' + item.modalPrice.toLocaleString()} - ${item.maxPrice ? '₹' + item.maxPrice.toLocaleString() : '₹' + item.modalPrice.toLocaleString()}</span>
        <span>🚚 <strong>${TL('Arrivals', 'రాక', 'Arrivals')}:</strong> ${item.arrivals ? item.arrivals.toLocaleString() + ' Qtl' : 'Official Volume'}</span>
      </div>

      <!-- Provenance & Official Source -->
      <div style="font-size:9.5px;color:#64748B;font-weight:600;margin-bottom:10px;padding:0 2px;display:flex;align-items:center;justify-content:space-between;">
        <span>🏛️ ${item.sourceName || 'Agmarknet / DMI (Govt of India)'}</span>
        <span>📅 ${item.tradeDate ? 'Reported: ' + item.tradeDate : 'APMC Report'}</span>
      </div>"""

if old_range_block in content:
    content = content.replace(old_range_block, new_range_block)
    print("✔ [SUCCESS] Remediated Mandi cards with official provenance and nullable ranges")
else:
    print("⚠️ [WARNING] Could not find exact old_range_block")

with open('app/src/main/assets/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Saved updated app/src/main/assets/index.html")
