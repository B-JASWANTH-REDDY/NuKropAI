# -*- coding: utf-8 -*-
import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# 1. Purge fake 120-crop mandi generator in getFilteredMandiRates
old_dyn_gen = """    // Dynamic generation for any of the 120+ crops from OpenFarm catalog
    const foundIn120 = OPENFARM_CROPS_CATALOG.find(c => c.id.toLowerCase() === targetCrop || getLocalizedCropName(c.id).toLowerCase().includes(targetCrop) || (CROP_TRANSLATIONS[c.id]?.en || '').toLowerCase().includes(targetCrop));
    if (foundIn120) {
      const dynSlug = foundIn120.id;
      const dynNameEn = CROP_TRANSLATIONS[dynSlug]?.en || dynSlug;
      const dynNameTe = CROP_TRANSLATIONS[dynSlug]?.te || dynNameEn;
      const dynNameHi = CROP_TRANSLATIONS[dynSlug]?.hi || dynNameEn;
      const dynBasePrice = parseInt((foundIn120.price || '₹2,400').replace(/[^0-9]/g, '')) || 2400;
      return [
        {
          id: 'dyn-mkt-' + dynSlug + '-0',
          cropKey: dynSlug,
          cropSlug: dynSlug,
          cropPath: `${dynSlug}/${dynSlug}.svg`,
          cropName: { en: dynNameEn + ' (A-Grade)', te: dynNameTe + ' (A-గ్రేడ్)', hi: dynNameHi + ' (ग्रेड A)' },
          variety: { en: 'Desi Pure / Standard FAQ', te: 'ప్రామాణిక దేశీ రకం', hi: 'मानक देसी किस्म' },
          mandi: { en: 'Warangal APMC Yard', te: 'వరంగల్ ఏనుమాముల మార్కెట్ యార్డ్', hi: 'वारंगल मंडी' },
          district: 'Warangal',
          state: { en: 'Telangana', te: 'తెలంగాణ', hi: 'तेलंगाना' },
          modalPrice: dynBasePrice,
          minPrice: Math.round(dynBasePrice * 0.85),
          maxPrice: Math.round(dynBasePrice * 1.15),
          mspPrice: Math.round(dynBasePrice * 0.95),
          unit: foundIn120.unit || '/Qtl',
          arrivals: 3200,
          change: '+5.4%',
          up: true,
          badge: '📍 Local Mandi'
        },
        {
          id: 'dyn-mkt-' + dynSlug + '-1',
          cropKey: dynSlug,
          cropSlug: dynSlug,
          cropPath: `${dynSlug}/${dynSlug}.svg`,
          cropName: { en: dynNameEn + ' (Export Quality)', te: dynNameTe + ' (ప్రీమియం నాణ్యత)', hi: dynNameHi + ' (प्रीमियम)' },
          variety: { en: 'Premium Selection', te: 'ప్రీమియం సెలక్షన్', hi: 'प्रीमियम चयन' },
          mandi: { en: 'Bowenpally APMC, Hyderabad', te: 'బోయిన్‌పల్లి మార్కెట్, హైదరాబాద్', hi: 'बोवेनपल्ली मंडी' },
          district: 'Hyderabad',
          state: { en: 'Telangana', te: 'తెలంగాణ', hi: 'तेलंगाना' },
          modalPrice: Math.round(dynBasePrice * 1.08),
          minPrice: Math.round(dynBasePrice * 0.9),
          maxPrice: Math.round(dynBasePrice * 1.25),
          mspPrice: Math.round(dynBasePrice * 0.95),
          unit: foundIn120.unit || '/Qtl',
          arrivals: 5100,
          change: '+7.2%',
          up: true,
          badge: '⚡ High Demand'
        }
      ];
    }"""

new_dyn_gen = """    // Return empty list if no official Agmarknet rate is reported for this target crop
    return [];"""

if old_dyn_gen in content:
    content = content.replace(old_dyn_gen, new_dyn_gen)
    print("✔ [SUCCESS] Purged fabricated 120-crop dynamic mandi price generator")
else:
    print("⚠️ [WARNING] Could not find exact old_dyn_gen")

# 2. Update Weather badge in APP_VIEWS.home
old_badge = """            <span style="font-size:13.5px;font-weight:900;color:#0F172A;" id="w-loc-title">${liveWeather.locationName[currentLang] || liveWeather.locationName.en}</span>
            <span style="font-size:9px;background:#DCFCE7;color:#15803D;font-weight:900;padding:2px 6px;border-radius:4px;letter-spacing:0.02em;">LIVE</span>"""

new_badge = """            <span style="font-size:13.5px;font-weight:900;color:#0F172A;" id="w-loc-title">${liveWeather.locationName[currentLang] || liveWeather.locationName.en}</span>
            <span style="font-size:9px;background:${liveWeather.status === 'LIVE' ? '#DCFCE7' : (liveWeather.status === 'CACHED' ? '#FEF3C7' : '#F1F5F9')};color:${liveWeather.status === 'LIVE' ? '#15803D' : (liveWeather.status === 'CACHED' ? '#B45309' : '#64748B')};font-weight:900;padding:2px 6px;border-radius:4px;letter-spacing:0.02em;">
              ${liveWeather.status === 'LIVE' ? 'LIVE' : (liveWeather.status === 'CACHED' ? 'CACHED' : 'STANDBY')}
            </span>"""

if old_badge in content:
    content = content.replace(old_badge, new_badge)
    print("✔ [SUCCESS] Updated Weather badge in APP_VIEWS.home to reflect Live vs Cached vs Standby")
else:
    print("⚠️ [WARNING] Could not find exact old_badge")

with open('app/src/main/assets/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Saved updated app/src/main/assets/index.html")
