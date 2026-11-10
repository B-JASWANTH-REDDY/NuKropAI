/**
 * Milestone 2 Verification Suite: Dynamic Pest & Disease Alerts without Hardcoded Fallbacks
 * NuKropAI Agrarian OS
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log('================================================================================');
console.log('🛡️  MILESTONE 2 VERIFICATION: DYNAMIC PEST & DISEASE ALERTS (MULTI-STATE ENGINE)');
console.log('================================================================================\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

async function testAsync(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    throw err;
  }
}

const targetFiles = [
  path.join(__dirname, '..', 'nukrop_emulator.html'),
  path.join(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html')
];

(async function runAllM2Tests() {
  // ── PART 1: STATIC CODE AUDIT ACROSS BOTH PLATFORMS ──
  targetFiles.forEach((targetPath) => {
    const relName = path.relative(path.join(__dirname, '..'), targetPath);

    test(`M2.1 [${relName}]: Core Dynamic Pest & Location functions are defined`, () => {
      const html = fs.readFileSync(targetPath, 'utf8');
      assert.ok(html.includes('function getEffectiveUserState'), 'Must define getEffectiveUserState');
      assert.ok(html.includes('function getEffectiveUserDistrict'), 'Must define getEffectiveUserDistrict');
      assert.ok(html.includes('function getRegionalPestMatrix'), 'Must define getRegionalPestMatrix');
      assert.ok(html.includes('async function fetchDynamicPestAlerts'), 'Must define fetchDynamicPestAlerts');
      assert.ok(html.includes('function updateAlertsUI'), 'Must define updateAlertsUI');
    });

    test(`M2.2 [${relName}]: Zero hardcoded 'Warangal Cluster' in REAL_MARKET_TICKER_ITEMS`, () => {
      const html = fs.readFileSync(targetPath, 'utf8');
      const tickerMatch = html.match(/const REAL_MARKET_TICKER_ITEMS = \[([\s\S]*?)\];/);
      assert.ok(tickerMatch, 'REAL_MARKET_TICKER_ITEMS must exist');
      const tickerContent = tickerMatch[1];
      assert.ok(!tickerContent.includes("'Warangal Cluster'"), "Must NOT contain hardcoded 'Warangal Cluster'");
      assert.ok(!tickerContent.includes('"Warangal Cluster"'), 'Must NOT contain hardcoded "Warangal Cluster"');
      assert.ok(tickerContent.includes('getEffectiveUserDistrict') || tickerContent.includes('getEffectiveUserState'), 'Pest alert must bind dynamically to user location');
    });

    test(`M2.3 [${relName}]: Zero hardcoded 'Warangal' or 'Telangana' geocoding fallback in location engine`, () => {
      const html = fs.readFileSync(targetPath, 'utf8');
      
      // onNativeLocationReceived check
      const onNativeMatch = html.match(/window\.onNativeLocationReceived = async function\(lat, lon\) \{([\s\S]*?)\n\};/);
      assert.ok(onNativeMatch, 'onNativeLocationReceived must exist');
      const onNativeCode = onNativeMatch[1];
      assert.ok(!onNativeCode.includes("|| 'Warangal'"), "onNativeLocationReceived must not have || 'Warangal' fallback");
      assert.ok(!onNativeCode.includes("|| 'Telangana'"), "onNativeLocationReceived must not have || 'Telangana' fallback");
      assert.ok(onNativeCode.includes('fetchDynamicPestAlerts(state, district)'), 'onNativeLocationReceived must trigger fetchDynamicPestAlerts');

      // fetchRealLocationAndWeather check
      const fetchLocMatch = html.match(/async function fetchRealLocationAndWeather\(\) \{([\s\S]*?)\n\}/);
      assert.ok(fetchLocMatch, 'fetchRealLocationAndWeather must exist');
      const fetchLocCode = fetchLocMatch[1];
      assert.ok(!fetchLocCode.includes("|| 'Warangal'"), "fetchRealLocationAndWeather must not have || 'Warangal' fallback");
      assert.ok(!fetchLocCode.includes("|| 'Telangana'"), "fetchRealLocationAndWeather must not have || 'Telangana' fallback");
      assert.ok(fetchLocCode.includes('fetchDynamicPestAlerts(state, district)'), 'fetchRealLocationAndWeather must trigger fetchDynamicPestAlerts');
    });

    test(`M2.4 [${relName}]: Boot sequence triggers fetchDynamicPestAlerts`, () => {
      const html = fs.readFileSync(targetPath, 'utf8');
      const bootMatch = html.match(/function bootApp\(\) \{([\s\S]*?)\n\}/);
      assert.ok(bootMatch, 'bootApp function must exist');
      const bootCode = bootMatch[1];
      assert.ok(bootCode.includes('fetchDynamicPestAlerts'), 'bootApp must invoke fetchDynamicPestAlerts');
    });

    test(`M2.5 [${relName}]: APP_NOTIFICATIONS notif-1 and notif-2 are clean of hardcoded Warangal`, () => {
      const html = fs.readFileSync(targetPath, 'utf8');
      const notifMatch = html.match(/let APP_NOTIFICATIONS = (?:\[|\(function\(\)[\s\S]*?return \[)([\s\S]*?)\];/);
      assert.ok(notifMatch, 'APP_NOTIFICATIONS must exist');
      const notifCode = notifMatch[1];
      const notif1 = notifCode.match(/id:\s*'notif-1'[\s\S]*?msg:\s*\{[\s\S]*?\}/);
      const notif2 = notifCode.match(/id:\s*'notif-2'[\s\S]*?msg:\s*\{[\s\S]*?\}/);
      assert.ok(notif1, 'notif-1 must exist');
      assert.ok(notif2, 'notif-2 must exist');
      assert.ok(!notif1[0].includes('Warangal'), 'notif-1 message must not contain hardcoded Warangal');
      assert.ok(!notif2[0].includes('Warangal'), 'notif-2 message must not contain hardcoded Warangal');
    });

    test(`M2.6 [${relName}]: Regional Pest Matrix supports multiple agro-climatic states`, () => {
      const html = fs.readFileSync(targetPath, 'utf8');
      const matrixMatch = html.match(/function getRegionalPestMatrix\([\s\S]*?\n\}/);
      assert.ok(matrixMatch, 'getRegionalPestMatrix must exist');
      const code = matrixMatch[0];
      assert.ok(code.includes('maharashtra'), 'Must support Maharashtra');
      assert.ok(code.includes('punjab') || code.includes('haryana'), 'Must support Punjab/Haryana');
      assert.ok(code.includes('gujarat'), 'Must support Gujarat');
      assert.ok(code.includes('telangana') || code.includes('andhra'), 'Must support Telangana/Andhra');
      assert.ok(code.includes('nat-pink-bollworm') || code.includes('nat-fall-armyworm'), 'Must have national default fallback');
    });
  });

  // ── PART 2: DYNAMIC VM EXECUTION & STATE SWITCHING TESTS ──
  const emulatorHtml = fs.readFileSync(targetFiles[0], 'utf8');
  const scriptMatch = emulatorHtml.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch, 'Must find script tag in nukrop_emulator.html');
  const jsCode = scriptMatch[1];

  const testStorage = {};
  const domElements = {};
  function getEl(id) {
    if (!domElements[id]) {
      domElements[id] = {
        id,
        style: {},
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        appendChild: () => {},
        setAttribute: () => {},
        getAttribute: () => '',
        addEventListener: () => {},
        removeEventListener: () => {},
        remove: () => {},
        querySelectorAll: () => [],
        querySelector: () => null,
        scrollIntoView: () => {},
        offsetWidth: 100,
        offsetHeight: 100,
        innerHTML: '',
        textContent: '',
        value: '',
        disabled: false
      };
    }
    return domElements[id];
  }

  const tickerTrackEl = getEl('market-ticker-track');

  let fetchCallLog = [];
  const sandbox = {
    window: null,
    document: {
      readyState: 'complete',
      getElementById: (id) => getEl(id),
      querySelector: (sel) => {
        if (sel === '.news-ticker-track' || sel === '#market-ticker-track') return tickerTrackEl;
        return getEl('query_' + sel);
      },
      querySelectorAll: (sel) => {
        if (sel.includes('news-ticker-track') || sel.includes('market-ticker-track')) return [tickerTrackEl];
        return [];
      },
      createElement: (tag) => getEl(tag),
      addEventListener: () => {},
      removeEventListener: () => {},
      body: getEl('body')
    },
    localStorage: {
      getItem: (k) => testStorage[k] !== undefined ? testStorage[k] : null,
      setItem: (k, v) => { testStorage[k] = String(v); },
      removeItem: (k) => { delete testStorage[k]; }
    },
    navigator: {
      geolocation: { getCurrentPosition: () => {} },
      userAgent: 'PestAlertTester'
    },
    location: { href: '', search: '', pathname: '' },
    fetch: async (url, opts) => {
      fetchCallLog.push({ url, opts });
      return {
        ok: false, // fallback to matrix
        status: 404,
        json: async () => []
      };
    },
    speechSynthesis: { speak: () => {}, cancel: () => {} },
    SpeechSynthesisUtterance: function() {},
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: (cb, ms) => setTimeout(cb, 10),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: () => 123,
    clearInterval: () => {}
  };
  sandbox.window = sandbox;

  const context = vm.createContext(sandbox);
  vm.runInContext(jsCode, context);

  await testAsync('M2.7: Dynamic State Switching to Maharashtra updates PEST_SURVEILLANCE_ALERTS and Ticker', async () => {
    await vm.runInContext(`
      liveWeather.detectedState = 'Maharashtra';
      liveWeather.detectedDistrict = 'Akola';
      fetchDynamicPestAlerts('Maharashtra', 'Akola');
    `, context);

    const alerts = vm.runInContext('PEST_SURVEILLANCE_ALERTS', context);
    assert.ok(alerts && alerts.length > 0, 'Must have active alerts for Maharashtra');
    const hasPinkBollworm = alerts.some(a => a.id.includes('mh-pink-bollworm') || (a.pest && JSON.stringify(a.pest).includes('Pink Bollworm')));
    assert.ok(hasPinkBollworm, 'Maharashtra must feature Pink Bollworm surveillance');

    const tickerItems = vm.runInContext('REAL_MARKET_TICKER_ITEMS', context);
    const pestTicker = tickerItems.find(x => x.type === 'alert');
    assert.ok(pestTicker, 'Must have pest alert ticker item');
    assert.ok(pestTicker.mandi.includes('Akola') || pestTicker.mandi.includes('Maharashtra'), 'Ticker mandi must reflect Akola or Maharashtra sector');
  });

  await testAsync('M2.8: Dynamic State Switching to Punjab updates alerts to Yellow Rust / Karnal Bunt', async () => {
    await vm.runInContext(`
      liveWeather.detectedState = 'Punjab';
      liveWeather.detectedDistrict = 'Ludhiana';
      fetchDynamicPestAlerts('Punjab', 'Ludhiana');
    `, context);

    const alerts = vm.runInContext('PEST_SURVEILLANCE_ALERTS', context);
    assert.ok(alerts && alerts.length > 0, 'Must have active alerts for Punjab');
    const hasYellowRust = alerts.some(a => a.id.includes('pb-yellow-rust') || (a.pest && JSON.stringify(a.pest).includes('Yellow Rust')));
    assert.ok(hasYellowRust, 'Punjab must feature Yellow Rust stripe fungus surveillance');

    const tickerItems = vm.runInContext('REAL_MARKET_TICKER_ITEMS', context);
    const pestTicker = tickerItems.find(x => x.type === 'alert');
    assert.ok(pestTicker.mandi.includes('Ludhiana') || pestTicker.mandi.includes('Punjab'), 'Ticker must reflect Ludhiana/Punjab sector');
  });

  await testAsync('M2.9: Dynamic State Switching to Gujarat updates alerts to Whitefly / Groundnut Tikka', async () => {
    await vm.runInContext(`
      liveWeather.detectedState = 'Gujarat';
      liveWeather.detectedDistrict = 'Rajkot';
      fetchDynamicPestAlerts('Gujarat', 'Rajkot');
    `, context);

    const alerts = vm.runInContext('PEST_SURVEILLANCE_ALERTS', context);
    assert.ok(alerts && alerts.length > 0, 'Must have active alerts for Gujarat');
    const hasGjAlert = alerts.some(a => a.id.includes('gj-') || (a.crop && JSON.stringify(a.crop).includes('Groundnut')));
    assert.ok(hasGjAlert, 'Gujarat must feature Gujarat agricultural belt surveillance');
  });

  await testAsync('M2.10: Location updates in onNativeLocationReceived and fetchRealLocationAndWeather trigger fetchDynamicPestAlerts', async () => {
    let triggeredPestAlertWith = null;
    sandbox.fetchDynamicPestAlerts = function(s, d) {
      triggeredPestAlertWith = { s, d };
    };

    // Simulate native reverse geocode response
    sandbox.fetch = async (url) => {
      if (url.includes('nominatim.openstreetmap.org')) {
        return {
          ok: true,
          json: async () => ({
            address: { state: 'Karnataka', county: 'Dharwad' }
          })
        };
      }
      return { ok: true, json: async () => ({ current: {}, daily: {} }) };
    };

    await sandbox.onNativeLocationReceived(15.4589, 75.0078);
    assert.ok(triggeredPestAlertWith, 'onNativeLocationReceived must trigger fetchDynamicPestAlerts');
    assert.strictEqual(triggeredPestAlertWith.s, 'Karnataka', 'State must be Karnataka');
    assert.strictEqual(triggeredPestAlertWith.d, 'Dharwad', 'District must be Dharwad');
  });

  console.log('\n================================================================================');
  console.log(`🎉 ALL ${passed}/${total} MILESTONE 2 VERIFICATIONS PASSED WITH ZERO ERRORS!`);
  console.log('================================================================================\n');
})();
