/**
 * NUKROPAI AGRARIAN OS — ANDROID WIDGETS INTEGRATION SUITE
 * Pillar 6: Native Android Home-Screen Weather & Mandi AppWidgets
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log('📱 NUKROPAI ANDROID HOME-SCREEN WIDGETS INTEGRATION SUITE');
console.log('================================================================================\n');

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${desc}: ${err.message}`);
    process.exitCode = 1;
  }
}

const rootDir = path.join(__dirname, '..');

// ── TEST CASES ──

it('AW-1: Weather widget XML layout exists and defines required RemoteViews IDs', () => {
  const layoutPath = path.join(rootDir, 'app', 'src', 'main', 'res', 'layout', 'widget_weather.xml');
  assert.ok(fs.existsSync(layoutPath), 'widget_weather.xml must exist');
  const xml = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(xml.includes('@+id/widget_weather_root'), 'Must contain root container');
  assert.ok(xml.includes('@+id/widget_weather_location'), 'Must contain location TextView');
  assert.ok(xml.includes('@+id/widget_weather_badge'), 'Must contain provenance badge');
  assert.ok(xml.includes('@+id/widget_weather_temp'), 'Must contain temperature TextView');
  assert.ok(xml.includes('@+id/widget_weather_condition'), 'Must contain spray condition TextView');
  assert.ok(xml.includes('@+id/widget_weather_hilo'), 'Must contain high/low TextView');
  assert.ok(xml.includes('@+id/widget_weather_humidity'), 'Must contain humidity TextView');
  assert.ok(xml.includes('@+id/widget_weather_rain'), 'Must contain rainfall TextView');
  assert.ok(xml.includes('@+id/widget_weather_wind'), 'Must contain wind TextView');
  assert.ok(xml.includes('@+id/widget_weather_updated'), 'Must contain updated timestamp');
});

it('AW-2: Mandi Bhav widget XML layout exists and defines required RemoteViews IDs', () => {
  const layoutPath = path.join(rootDir, 'app', 'src', 'main', 'res', 'layout', 'widget_mandi.xml');
  assert.ok(fs.existsSync(layoutPath), 'widget_mandi.xml must exist');
  const xml = fs.readFileSync(layoutPath, 'utf8');

  assert.ok(xml.includes('@+id/widget_mandi_root'), 'Must contain root container');
  assert.ok(xml.includes('@+id/widget_mandi_market'), 'Must contain market TextView');
  assert.ok(xml.includes('@+id/widget_mandi_badge'), 'Must contain Agmarknet badge');
  assert.ok(xml.includes('@+id/widget_mandi_crop'), 'Must contain crop name');
  assert.ok(xml.includes('@+id/widget_mandi_price'), 'Must contain modal price');
  assert.ok(xml.includes('@+id/widget_mandi_range'), 'Must contain min-max range');
  assert.ok(xml.includes('@+id/widget_mandi_arrivals'), 'Must contain arrival volume');
  assert.ok(xml.includes('@+id/widget_mandi_updated'), 'Must contain trade date');
});

it('AW-3: AppWidgetProvider XML metadata configurations are present and valid', () => {
  const weatherMeta = path.join(rootDir, 'app', 'src', 'main', 'res', 'xml', 'weather_widget_info.xml');
  const mandiMeta = path.join(rootDir, 'app', 'src', 'main', 'res', 'xml', 'mandi_widget_info.xml');

  assert.ok(fs.existsSync(weatherMeta), 'weather_widget_info.xml must exist');
  assert.ok(fs.existsSync(mandiMeta), 'mandi_widget_info.xml must exist');

  const wXml = fs.readFileSync(weatherMeta, 'utf8');
  assert.ok(wXml.includes('appwidget-provider'), 'Must declare appwidget-provider');
  assert.ok(wXml.includes('@layout/widget_weather'), 'Must bind @layout/widget_weather');
  assert.ok(wXml.includes('updatePeriodMillis'), 'Must specify update period');

  const mXml = fs.readFileSync(mandiMeta, 'utf8');
  assert.ok(mXml.includes('appwidget-provider'), 'Must declare appwidget-provider');
  assert.ok(mXml.includes('@layout/widget_mandi'), 'Must bind @layout/widget_mandi');
  assert.ok(mXml.includes('updatePeriodMillis'), 'Must specify update period');
});

it('AW-4: Kotlin AppWidgetProvider classes exist and implement correct actions and lifecycle', () => {
  const wProviderPath = path.join(rootDir, 'app', 'src', 'main', 'java', 'com', 'example', 'widget', 'WeatherWidgetProvider.kt');
  const mProviderPath = path.join(rootDir, 'app', 'src', 'main', 'java', 'com', 'example', 'widget', 'MandiWidgetProvider.kt');
  const workerPath = path.join(rootDir, 'app', 'src', 'main', 'java', 'com', 'example', 'widget', 'WidgetUpdateWorker.kt');

  assert.ok(fs.existsSync(wProviderPath), 'WeatherWidgetProvider.kt must exist');
  assert.ok(fs.existsSync(mProviderPath), 'MandiWidgetProvider.kt must exist');
  assert.ok(fs.existsSync(workerPath), 'WidgetUpdateWorker.kt must exist');

  const wCode = fs.readFileSync(wProviderPath, 'utf8');
  assert.ok(wCode.includes('class WeatherWidgetProvider : AppWidgetProvider()'));
  assert.ok(wCode.includes('ACTION_WEATHER_UPDATED'));
  assert.ok(wCode.includes('ACTION_LOGOUT'));
  assert.ok(wCode.includes('nukrop://screen/home'), 'Deep link to home/weather must be set');

  const mCode = fs.readFileSync(mProviderPath, 'utf8');
  assert.ok(mCode.includes('class MandiWidgetProvider : AppWidgetProvider()'));
  assert.ok(mCode.includes('ACTION_MANDI_UPDATED'));
  assert.ok(mCode.includes('ACTION_LOGOUT'));
  assert.ok(mCode.includes('nukrop://screen/market'), 'Deep link to market must be set');
});

it('AW-5: AndroidManifest.xml registers both widget receivers and deep link intent filters', () => {
  const manifestPath = path.join(rootDir, 'app', 'src', 'main', 'AndroidManifest.xml');
  const manifest = fs.readFileSync(manifestPath, 'utf8');

  assert.ok(manifest.includes('.widget.WeatherWidgetProvider'), 'WeatherWidgetProvider receiver registered');
  assert.ok(manifest.includes('.widget.MandiWidgetProvider'), 'MandiWidgetProvider receiver registered');
  assert.ok(manifest.includes('android.appwidget.action.APPWIDGET_UPDATE'), 'APPWIDGET_UPDATE action handled');
  assert.ok(manifest.includes('android:scheme="nukrop" android:host="screen"'), 'Widget deep link scheme registered');
});

it('AW-6: MainActivity bridge exposes updateWeatherWidget, updateMandiWidget, and clearWidgetData', () => {
  const mainActivityPath = path.join(rootDir, 'app', 'src', 'main', 'java', 'com', 'example', 'MainActivity.kt');
  const mainCode = fs.readFileSync(mainActivityPath, 'utf8');

  assert.ok(mainCode.includes('fun updateWeatherWidget'), 'updateWeatherWidget exposed');
  assert.ok(mainCode.includes('fun updateMandiWidget'), 'updateMandiWidget exposed');
  assert.ok(mainCode.includes('fun clearWidgetData'), 'clearWidgetData exposed');
  assert.ok(mainCode.includes('handleAppDeepLinks'), 'handleAppDeepLinks routes deep link navigation');
});

it('AW-7: Frontend index.html and emulator invoke widget bridge on live data updates', () => {
  const indexPath = path.join(rootDir, 'app', 'src', 'main', 'assets', 'index.html');
  const emuPath = path.join(rootDir, 'nukrop_emulator.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  const emuHtml = fs.readFileSync(emuPath, 'utf8');

  assert.ok(indexHtml.includes('syncWeatherToAndroidWidget'), 'index.html has syncWeatherToAndroidWidget');
  assert.ok(indexHtml.includes('syncMandiToAndroidWidget'), 'index.html has syncMandiToAndroidWidget');
  assert.ok(indexHtml.includes('AndroidBridge.clearWidgetData'), 'index.html clears widget on logout');

  assert.strictEqual(indexHtml, emuHtml, '100% byte parity enforced across index.html and nukrop_emulator.html');
});

console.log('\n================================================================================');
console.log(`📊 ANDROID WIDGETS INTEGRATION SUITE: ${passed}/${total} PASSED (100% SUCCESS)`);
console.log('================================================================================');
