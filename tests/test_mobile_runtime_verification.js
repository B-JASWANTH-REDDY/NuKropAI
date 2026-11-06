/**
 * ════════════════════════════════════════════════════════════════════════════
 * NUKROPAI MOBILE RUNTIME DEEP VERIFICATION (ALL 18 APP_VIEWS & 5 STATES)
 * ════════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

console.log('================================================================================');
console.log('📱 NUKROPAI MOBILE RUNTIME & ALL-SCREEN DEEP VERIFICATION');
console.log('================================================================================\n');

const htmlPath = path.resolve(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// Build sandbox with mocked DOM and browser globals
const domElements = {};
function makeEl(id = '') {
  return {
    id,
    style: {},
    classList: {
      _classes: new Set(),
      add: function(c) { this._classes.add(c); },
      remove: function(c) { this._classes.delete(c); },
      contains: function(c) { return this._classes.has(c); }
    },
    innerHTML: '',
    value: '',
    appendChild: function(c) { if (c && c.id) domElements[c.id] = c; return c; },
    remove: function() { if (this.id) delete domElements[this.id]; },
    querySelectorAll: function() { return []; },
    querySelector: function() { return null; },
    addEventListener: function() {}
  };
}

const sandbox = {
  window: {},
  navigator: { geolocation: { getCurrentPosition: () => {}, watchPosition: () => 1, clearWatch: () => {} } },
  document: {
    getElementById: (id) => domElements[id] || null,
    createElement: (tag) => makeEl(),
    body: makeEl('body'),
    querySelector: (sel) => makeEl(),
    querySelectorAll: (sel) => []
  },
  localStorage: {
    store: {},
    getItem: function(k) { return this.store[k] || null; },
    setItem: function(k, v) { this.store[k] = String(v); },
    removeItem: function(k) { delete this.store[k]; },
    clear: function() { this.store = {}; }
  },
  console: console,
  Date: Date,
  Math: Math,
  setTimeout: (fn) => setTimeout(fn, 0),
  clearTimeout: (t) => clearTimeout(t),
  setInterval: () => 1,
  clearInterval: () => {}
};
sandbox.window = sandbox;
vm.createContext(sandbox);

// Extract inline scripts
const scriptMatches = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi);
let fullScript = '';
if (scriptMatches) {
  scriptMatches.forEach(tag => {
    const code = tag.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    fullScript += '\n;' + code;
  });
}
vm.runInContext(fullScript, sandbox);

// 1. Verify All 18 APP_VIEWS exist in catalog
test('MRV.1: All 18 Agrarian Views registered in APP_VIEWS', () => {
  const views = sandbox.APP_VIEWS;
  assert.ok(views, 'APP_VIEWS must be defined');
  const expectedViews = [
    'home', 'scanner', 'market', 'gramhaul', 'gramhaul_tracking', 'agristack',
    'equipment', 'loan', 'khata', 'chat', 'bioshield', 'biorx',
    'calc_fert', 'calc_pest', 'calc_budget', 'community', 'driver_dashboard', 'profile'
  ];
  for (const v of expectedViews) {
    assert.ok(views[v] !== undefined, `View '${v}' must exist in APP_VIEWS`);
  }
});

// 2. Open every screen without throwing
test('MRV.2: openScreen executes cleanly across all 18 views', () => {
  const views = Object.keys(sandbox.APP_VIEWS);
  for (const v of views) {
    try {
      sandbox.openScreen(v);
    } catch (err) {
      throw new Error(`Failed to open screen '${v}': ${err.message}`);
    }
  }
});

// 3. Verify All 9 Phase 2 Skeletons render valid non-empty HTML
test('MRV.3: All 9 Phase 2 content skeletons render non-empty shimmer structures', () => {
  const skeletons = [
    'renderHomeDashboardSkeleton',
    'renderLoanKccSkeleton',
    'renderAgriStackSkeleton',
    'renderBioRxSkeleton',
    'renderCalcFertSkeleton',
    'renderCalcPestSkeleton',
    'renderBudgetSkeleton',
    'renderDriverCockpitSkeleton',
    'renderProfileSkeleton'
  ];
  for (const skel of skeletons) {
    assert.strictEqual(typeof sandbox[skel], 'function', `${skel} must be a callable function`);
    const rendered = sandbox[skel]();
    assert.ok(typeof rendered === 'string', `${skel} must return HTML string`);
    assert.ok(rendered.includes('skeleton-shimmer'), `${skel} must contain shimmer elements`);
    assert.ok(rendered.length > 50, `${skel} output must not be empty`);
  }
});

// 4. Verify 5 Agricultural States
test('MRV.4: renderAgrarianStateCard handles loading, empty, error, offline, success', () => {
  const fn = sandbox.renderAgrarianStateCard;
  assert.strictEqual(typeof fn, 'function', 'renderAgrarianStateCard must be defined');

  const states = ['loading', 'empty', 'error', 'offline', 'success'];
  for (const st of states) {
    const card = fn(st, { title: 'Test State', subtitle: 'State Description', actionText: 'Tap Me', onAction: 'noop()' });
    assert.ok(card.includes(`agrarian-state-${st}`), `Card must include agrarian-state-${st}`);
    if (st !== 'loading') {
      assert.ok(card.includes('Test State'), `Card must render title for state ${st}`);
      assert.ok(card.includes('Tap Me'), `Card must render action button for state ${st}`);
    }
  }
});

// 5. Test Android Back Navigation and Modal Interception
test('MRV.5: handleMobileBackPress intercepts active modal before hardware exit', () => {
  const fn = sandbox.handleMobileBackPress;
  assert.strictEqual(typeof fn, 'function', 'handleMobileBackPress must be defined');

  // Inject active modal
  const modal = makeEl('test-active-modal');
  modal.style = { display: 'block' };
  modal.classList.add('active-modal');
  domElements['test-active-modal'] = modal;
  sandbox.document.querySelectorAll = (sel) => [modal];

  let modalClosed = false;
  modal.remove = () => { modalClosed = true; };

  const intercepted = fn();
  assert.strictEqual(intercepted, true, 'Must return true indicating back event was consumed by modal closure');
  assert.strictEqual(modalClosed, true, 'Active modal must be removed by back press');
});

// 6. Test OTP Input Attributes & Accessibility
test('MRV.6: OTP inputs enforce numeric keyboard and one-time-code autofill', () => {
  assert.ok(html.includes('id="kcc-otp-input" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code"'));
  assert.ok(html.includes('id="driver-start-otp-input" type="text" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="one-time-code"'));
});

// 7. Test Touch Targets and Manipulation Mode
test('MRV.7: Minimum 44px touch targets and manipulation mode enforced', () => {
  assert.ok(html.includes('min-height: 44px;'));
  assert.ok(html.includes('touch-action: manipulation;'));
});

console.log('\n================================================================================');
console.log(`📊 MOBILE RUNTIME AUDIT: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================================\n');

if (failCount > 0) process.exit(1);
process.exit(0);
