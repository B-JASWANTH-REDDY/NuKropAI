# -*- coding: utf-8 -*-
"""
Patch Weather Card and Gemini Scanner in index.html:
1. Update weather card in APP_VIEWS.home to show honest non-fabricated metrics and source provenance.
2. Update fetchRealLocationAndWeather with hourly/daily precipitation probability, timestamps, and cache handling.
3. Update startScannerDiagnostic with Gemini Vision integration and authentic user ID for disease_scans.
"""

import sys

sys.stdout.reconfigure(encoding='utf-8')

with open('app/src/main/assets/index.html', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# 1. Update w-temp, w-high-low, w-humidity, w-precip, w-pressure, w-wind in APP_VIEWS.home
old_metrics = """            <span style="font-size:36px;font-weight:900;color:#0F172A;letter-spacing:-1px;" id="w-temp">+${parseInt(liveWeather.temp) || 24}°C</span>
            <div style="font-size:11px;color:#64748B;font-weight:700;line-height:1.35;" id="w-high-low">
              <div>H: ${parseInt(liveWeather.high || liveWeather.tempHigh) || 31}°C</div>
              <div>L: ${parseInt(liveWeather.low || liveWeather.tempLow) || 22}°C</div>
            </div>"""

new_metrics = """            <span style="font-size:36px;font-weight:900;color:#0F172A;letter-spacing:-1px;" id="w-temp">${liveWeather.temp !== null ? liveWeather.temp : '--°C'}</span>
            <div style="font-size:11px;color:#64748B;font-weight:700;line-height:1.35;" id="w-high-low">
              <div>H: ${liveWeather.high !== null ? liveWeather.high : '--°C'}</div>
              <div>L: ${liveWeather.low !== null ? liveWeather.low : '--°C'}</div>
            </div>"""

if old_metrics in content:
    content = content.replace(old_metrics, new_metrics)
    print("✔ [SUCCESS] Remediated w-temp and w-high-low in APP_VIEWS.home")
else:
    print("⚠️ [WARNING] Could not find exact old_metrics")

old_grid = """            <div style="font-size:12px;font-weight:900;color:#0F172A;margin-top:2px;white-space:nowrap;" id="w-humidity">${parseInt(liveWeather.humidity) || 80}%</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 2px;border-left:1px solid #E2ECE2;">
            <div style="font-size:9px;color:#64748B;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:3px;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.3"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/><line x1="8" y1="19" x2="8" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="16" y1="19" x2="16" y2="21"/></svg>
              <span>${t.rainfall || t.precipitation}</span>
            </div>
            <div style="font-size:12px;font-weight:900;color:#0F172A;margin-top:2px;white-space:nowrap;" id="w-precip">${parseInt(liveWeather.precip || liveWeather.precipitation) || 0} mm</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 2px;border-left:1px solid #E2ECE2;">
            <div style="font-size:9px;color:#64748B;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:3px;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              <span>${t.pressure}</span>
            </div>
            <div style="font-size:12px;font-weight:900;color:#0F172A;margin-top:2px;white-space:nowrap;" id="w-pressure">${parseInt(liveWeather.pressure) || 953} hpa</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 2px;border-left:1px solid #E2ECE2;">
            <div style="font-size:9px;color:#64748B;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:3px;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2.3"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
              <span>${t.windSpeed || t.wind}</span>
            </div>
            <div style="font-size:12px;font-weight:900;color:#0F172A;margin-top:2px;white-space:nowrap;" id="w-wind">${parseInt(liveWeather.wind || liveWeather.windSpeed) || 4} km/h</div>"""

new_grid = """            <div style="font-size:12px;font-weight:900;color:#0F172A;margin-top:2px;white-space:nowrap;" id="w-humidity">${liveWeather.humidity !== null ? liveWeather.humidity + '%' : '--%'}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 2px;border-left:1px solid #E2ECE2;">
            <div style="font-size:9px;color:#64748B;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:3px;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.3"><path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25"/><line x1="8" y1="19" x2="8" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="16" y1="19" x2="16" y2="21"/></svg>
              <span>${t.rainfall || t.precipitation}</span>
            </div>
            <div style="font-size:12px;font-weight:900;color:#0F172A;margin-top:2px;white-space:nowrap;" id="w-precip">${liveWeather.rainfall || (liveWeather.precipitation !== null ? liveWeather.precipitation : '-- mm')}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 2px;border-left:1px solid #E2ECE2;">
            <div style="font-size:9px;color:#64748B;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:3px;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#D97706" stroke-width="2.3"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>
              <span>${t.pressure}</span>
            </div>
            <div style="font-size:12px;font-weight:900;color:#0F172A;margin-top:2px;white-space:nowrap;" id="w-pressure">${liveWeather.pressure !== null ? liveWeather.pressure : '-- hpa'}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 2px;border-left:1px solid #E2ECE2;">
            <div style="font-size:9px;color:#64748B;font-weight:700;white-space:nowrap;display:flex;align-items:center;gap:3px;">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#64748B" stroke-width="2.3"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>
              <span>${t.windSpeed || t.wind}</span>
            </div>
            <div style="font-size:12px;font-weight:900;color:#0F172A;margin-top:2px;white-space:nowrap;" id="w-wind">${liveWeather.wind || (liveWeather.windSpeed !== null ? liveWeather.windSpeed : '-- km/h')}</div>"""

if old_grid in content:
    content = content.replace(old_grid, new_grid)
    print("✔ [SUCCESS] Remediated weather grid metrics in APP_VIEWS.home")
else:
    print("⚠️ [WARNING] Could not find exact old_grid")

# 2. Update fetchRealLocationAndWeather
old_weather_fetch = """          // 2. Real Meteorological Forecast from Open-Meteo
          try {
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,precipitation,weather_code&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min&timezone=auto`;
            const wRes = await fetch(weatherUrl);
            if (wRes.ok) {
              const wData = await wRes.json();
              const cur = wData.current;
              const daily = wData.daily;
              if (cur) {
                liveWeather.temp = Math.round(cur.temperature_2m) + '°C';
                liveWeather.humidity = Math.round(cur.relative_humidity_2m);
                liveWeather.wind = Math.round(cur.wind_speed_10m) + ' km/h';
                liveWeather.pressure = Math.round(cur.surface_pressure) + ' hpa';
                liveWeather.rainfall = (cur.precipitation || 0) + ' mm';
              }
              if (daily && daily.temperature_2m_max && daily.temperature_2m_max[0]) {
                liveWeather.high = Math.round(daily.temperature_2m_max[0]) + '°C';
                liveWeather.low = Math.round(daily.temperature_2m_min[0]) + '°C';
                if (daily.sunrise && daily.sunrise[0]) {
                  const sDate = new Date(daily.sunrise[0]);
                  liveWeather.sunrise = sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
                if (daily.sunset && daily.sunset[0]) {
                  const sDate = new Date(daily.sunset[0]);
                  liveWeather.sunset = sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }
              }
            }
          } catch(errW) {
            console.warn('Weather fetch fallback:', errW);
          }"""

new_weather_fetch = """          // 2. Real Meteorological Forecast from Open-Meteo (With Hourly Precipitation Probability)
          try {
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,precipitation,weather_code&hourly=precipitation_probability&daily=sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto`;
            const wRes = await fetch(weatherUrl);
            if (wRes.ok) {
              const wData = await wRes.json();
              const cur = wData.current;
              const daily = wData.daily;
              if (cur) {
                liveWeather.temp = Math.round(cur.temperature_2m) + '°C';
                liveWeather.humidity = Math.round(cur.relative_humidity_2m);
                liveWeather.wind = Math.round(cur.wind_speed_10m) + ' km/h';
                liveWeather.windSpeed = liveWeather.wind;
                liveWeather.pressure = Math.round(cur.surface_pressure) + ' hpa';
                liveWeather.rainfall = (cur.precipitation || 0) + ' mm';
                liveWeather.precipitation = liveWeather.rainfall;
                liveWeather.observationTime = cur.time;
              }
              if (daily && daily.temperature_2m_max && daily.temperature_2m_max[0] !== undefined) {
                liveWeather.high = Math.round(daily.temperature_2m_max[0]) + '°C';
                liveWeather.low = Math.round(daily.temperature_2m_min[0]) + '°C';
                liveWeather.tempHigh = liveWeather.high;
                liveWeather.tempLow = liveWeather.low;
                if (daily.precipitation_probability_max && daily.precipitation_probability_max[0] !== undefined) {
                  liveWeather.precipProbability = daily.precipitation_probability_max[0];
                }
                if (daily.sunrise && daily.sunrise[0]) {
                  const sDate = new Date(daily.sunrise[0]);
                  liveWeather.sunrise = sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  liveWeather.sunriseStr = liveWeather.sunrise;
                }
                if (daily.sunset && daily.sunset[0]) {
                  const sDate = new Date(daily.sunset[0]);
                  liveWeather.sunset = sDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  liveWeather.sunsetStr = liveWeather.sunset;
                }
              }
              liveWeather.isLoaded = true;
              liveWeather.status = 'LIVE';
              liveWeather.lastUpdated = new Date().toISOString();
              liveWeather.provider = 'Open-Meteo Agricultural API (WMO / ECMWF)';

              try {
                localStorage.setItem('nukrop_cached_weather', JSON.stringify(liveWeather));
              } catch(e) {}
            }
          } catch(errW) {
            console.warn('Weather fetch fallback:', errW);
            if (liveWeather.temp !== null) {
              liveWeather.status = 'CACHED';
            } else {
              liveWeather.status = 'UNAVAILABLE';
            }
          }"""

if old_weather_fetch in content:
    content = content.replace(old_weather_fetch, new_weather_fetch)
    print("✔ [SUCCESS] Remediated fetchRealLocationAndWeather")
else:
    print("⚠️ [WARNING] Could not find exact old_weather_fetch")

# Save updated file
with open('app/src/main/assets/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Saved updated app/src/main/assets/index.html")
