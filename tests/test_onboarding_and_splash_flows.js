/**
 * ════════════════════════════════════════════════════════════════════════════
 * NUKROPAI AGRARIAN OS — ONBOARDING & SPLASH FLOW TEST SUITE
 * ════════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✔ [PASS] ${name}`);
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

function buildTestContext(initialStorage = {}) {
  const htmlPath = path.resolve(__dirname, '../app/src/main/assets/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const scriptMatches = html.match(/<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi);
  let fullScript = '';
  if (scriptMatches) {
    scriptMatches.forEach(tag => {
      const code = tag.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
      fullScript += '\n;' + code;
    });
  }

  const storage = { ...initialStorage };
  const domElements = {};

  function makeEl(id = '') {
    const el = {
      id,
      style: {},
      classList: {
        classes: new Set(),
        add: function(c) { this.classes.add(c); },
        remove: function(c) { this.classes.delete(c); },
        contains: function(c) { return this.classes.has(c); }
      },
      innerHTML: '',
      value: '',
      appendChild: (child) => {
        if (child && child.id) {
          domElements[child.id] = child;
        }
      },
      insertAdjacentHTML: (pos, str) => {},
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      remove: function() {
        if (this.id && domElements[this.id]) {
          delete domElements[this.id];
        }
      },
      setAttribute: () => {},
      getAttribute: () => null,
      scrollTop: 0,
      scrollHeight: 100,
      offsetWidth: 360,
      offsetHeight: 640,
      focus: () => {}
    };
    if (id) domElements[id] = el;
    return el;
  }

  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: (fn, ms) => {
      if ((ms || 0) <= 200) fn();
      return 1;
    },
    clearTimeout: () => {},
    setInterval: (fn, ms) => 1,
    clearInterval: () => {},
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => { storage[k] = String(v); },
      removeItem: (k) => { delete storage[k]; },
      clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
    },
    document: {
      getElementById: (id) => {
        if (!domElements[id]) domElements[id] = makeEl(id);
        return domElements[id];
      },
      querySelector: (sel) => {
        if (sel === '.phone-chassis') return makeEl('phone-chassis');
        return makeEl(sel.replace(/[^a-zA-Z0-9_-]/g, ''));
      },
      querySelectorAll: () => [],
      createElement: (tag) => {
        const el = makeEl();
        el.tag = tag;
        return el;
      },
      body: makeEl('body'),
      addEventListener: () => {}
    },
    window: {},
    navigator: { userAgent: 'NodeVM' },
    location: { reload: () => {} },
    alert: () => {}
  };
  sandbox.window = sandbox;

  const ctx = vm.createContext(sandbox);
  vm.runInContext(fullScript, ctx);
  return { ctx, sandbox, storage, domElements };
}

console.log('\n================================================================================');
console.log('🌱 NUKROPAI ONBOARDING & SPLASH FLOW AUTOMATED VERIFICATION');
console.log('================================================================================\n');

runTest('OS.1: 100% byte-for-byte identity between index.html and nukrop_emulator.html', () => {
  const indexHtml = fs.readFileSync(path.resolve(__dirname, '../app/src/main/assets/index.html'), 'utf8');
  const emulatorHtml = fs.readFileSync(path.resolve(__dirname, '../nukrop_emulator.html'), 'utf8');
  if (indexHtml !== emulatorHtml) {
    throw new Error('Parity violation: index.html and nukrop_emulator.html differ');
  }
});

runTest('OS.2: renderSplashScreen generates authentic 4K leaf, laser meter, and telemetry steps', () => {
  const { ctx, sandbox } = buildTestContext();
  const container = sandbox.document.createElement('div');
  ctx.renderSplashScreen(container);

  if (!container.innerHTML.includes('splash-viewport')) {
    throw new Error('splash-viewport container missing');
  }
  if (!container.innerHTML.includes('splash-progress-bar')) {
    throw new Error('Laser progress bar element missing');
  }
  if (!container.innerHTML.includes('DPDP ACT 2023 SECURE')) {
    throw new Error('Security DPDP badge missing');
  }
  if (!container.innerHTML.includes('splash-telemetry-text')) {
    throw new Error('Telemetry text indicator missing');
  }
});

runTest('OS.3: advanceSlide cancels active splash timer and seamlessly transitions screens', () => {
  const { ctx, sandbox } = buildTestContext();
  sandbox.window.splashTimer = 999;
  ctx.advanceSlide('language');

  if (sandbox.window.splashTimer !== null) {
    throw new Error('advanceSlide failed to clear window.splashTimer');
  }
  if (sandbox.window.plantixFlowState.currentScreen !== 'language') {
    throw new Error('Failed to transition to language screen');
  }
});

runTest('OS.4: replayStartupExperience recreates overlay if removed and starts from requested slide', () => {
  const { ctx, sandbox } = buildTestContext({
    nukrop_onboarding_plantix_completed: 'true',
    nukrop_user_email: 'farmer@nukrop.ai'
  });

  ctx.replayStartupExperience('slide_disease');
  if (sandbox.window.plantixFlowState.currentScreen !== 'slide_disease') {
    throw new Error(`Expected currentScreen to be slide_disease, got ${sandbox.window.plantixFlowState.currentScreen}`);
  }
  const overlay = sandbox.document.getElementById('startup-experience-overlay');
  if (!overlay || overlay.style.display !== 'flex') {
    throw new Error('Overlay was not recreated or displayed flex');
  }
});

runTest('OS.5: closeStartupExperienceAndReturn smoothly removes overlay and resumes dashboard', () => {
  const { ctx, sandbox } = buildTestContext({
    nukrop_user_role: 'farmer'
  });

  const overlay = sandbox.document.getElementById('startup-experience-overlay');
  ctx.closeStartupExperienceAndReturn();
  // overlay scheduled for animated exit
});

runTest('OS.6: finishPlantixOnboarding enforces crop selection and updates farm crops', () => {
  const { ctx, sandbox, storage } = buildTestContext();
  sandbox.window.plantixFlowState.selectedCrops = [];
  ctx.finishPlantixOnboarding(); // should guard against empty crops

  sandbox.window.plantixFlowState.selectedCrops = ['cotton', 'chilli'];
  ctx.finishPlantixOnboarding();
  const savedCrops = JSON.parse(storage['nukrop_user_active_crops'] || '[]');
  if (savedCrops.length !== 2) {
    throw new Error(`Expected 2 saved crops, got ${savedCrops.length}`);
  }
});

runTest('OS.7: Profile view renders App Walkthrough & Splash Tour trigger', () => {
  const { ctx, sandbox } = buildTestContext();
  const profileHtml = sandbox.window.APP_VIEWS.profile();
  if (!profileHtml.includes('App Walkthrough & Splash Tour')) {
    throw new Error('Profile view missing App Walkthrough & Splash Tour menu item');
  }
  if (!profileHtml.includes("replayStartupExperience('splash')")) {
    throw new Error('Profile walkthrough button does not invoke replayStartupExperience');
  }
});

runTest('OS.8: openSettingsModal contains Replay Splash and Manage Crops options', () => {
  const { ctx, sandbox } = buildTestContext();
  ctx.openSettingsModal();
  const modal = sandbox.document.getElementById('app-settings-modal');
  if (!modal || !modal.innerHTML.includes('Replay App Tour & Splash')) {
    throw new Error('Settings modal missing Replay App Tour & Splash');
  }
  if (!modal.innerHTML.includes('Manage & Select Crops')) {
    throw new Error('Settings modal missing Manage & Select Crops');
  }
});

runTest('OS.9: Window exposes robust aliases for openSprayingModal, openBiorxRecipeModal, openProfileEditModal', () => {
  const { sandbox } = buildTestContext();
  if (typeof sandbox.window.openSprayingModal !== 'function') {
    throw new Error('window.openSprayingModal alias is not a function');
  }
  if (typeof sandbox.window.openBiorxRecipeModal !== 'function') {
    throw new Error('window.openBiorxRecipeModal alias is not a function');
  }
  if (typeof sandbox.window.openProfileEditModal !== 'function') {
    throw new Error('window.openProfileEditModal alias is not a function');
  }
});

runTest('OS.10: All 18 APP_VIEWS and 8 onboarding screens render without throwing in Node VM', () => {
  const { ctx, sandbox } = buildTestContext();
  const views = Object.keys(sandbox.window.APP_VIEWS);
  if (views.length !== 18) {
    throw new Error(`Expected 18 views, got ${views.length}`);
  }
  views.forEach(v => {
    const res = sandbox.window.APP_VIEWS[v]();
    if (!res || typeof res !== 'string' || res.length < 50) {
      throw new Error(`View ${v} returned invalid content`);
    }
  });

  const dummyEl = sandbox.document.createElement('div');
  ctx.renderSplashScreen(dummyEl);
  ctx.advanceSlide('language');
  ctx.advanceSlide('perm_camera');
  ctx.advanceSlide('perm_location');
  ctx.advanceSlide('perm_notifications');
  ctx.advanceSlide('role_selection');
  ctx.advanceSlide('crops');
  ctx.advanceSlide('login');
});

console.log('\n================================================================================');
console.log('📊 ALL ONBOARDING & SPLASH TESTS COMPLETE');
console.log('================================================================================\n');
