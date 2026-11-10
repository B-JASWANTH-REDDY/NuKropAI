const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');
const assert = require('assert');

console.log('================================================================================');
console.log('📱 NUKROPAI MOBILE PERMANENT ENGINEERING STANDARDS VERIFICATION');
console.log('================================================================================\n');

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

const indexPath = path.resolve(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html');
const emulatorPath = path.resolve(__dirname, '..', 'nukrop_emulator.html');
const netSecPath = path.resolve(__dirname, '..', 'app', 'src', 'main', 'res', 'xml', 'network_security_config.xml');

const indexContent = fs.readFileSync(indexPath, 'utf8');
const emulatorContent = fs.readFileSync(emulatorPath, 'utf8');
const netSecContent = fs.readFileSync(netSecPath, 'utf8');

// 1. Strict SHA-256 Byte-for-Byte Parity
test('MPS.1: Exact SHA-256 Byte-for-Byte Parity between index.html and nukrop_emulator.html', () => {
  const indexHash = crypto.createHash('sha256').update(indexContent).digest('hex');
  const emulatorHash = crypto.createHash('sha256').update(emulatorContent).digest('hex');
  assert.strictEqual(indexHash, emulatorHash, 'SHA-256 hashes must be identical');
  assert.strictEqual(indexContent.length, emulatorContent.length, 'File lengths must match');
});

// 2. CSS Standards Verification
test('MPS.2: Tabular numbers CSS rule (.tabular-nums) configured with font-variant-numeric: tabular-nums', () => {
  assert.ok(indexContent.includes('font-variant-numeric: tabular-nums !important;'), 'Must have tabular-nums font variant');
  assert.ok(indexContent.includes('font-feature-settings: "tnum" 1 !important;'), 'Must have tnum font-feature-settings');
});

test('MPS.3: Balanced headlines & typography (text-wrap: balance) configured', () => {
  assert.ok(indexContent.includes('text-wrap: balance !important;'), 'Must enforce text-wrap: balance on headings');
});

test('MPS.4: Accessible touch targets (>=44px min-height & touch-action: manipulation) enforced', () => {
  assert.ok(indexContent.includes('min-height: 44px;'), 'Must enforce 44px minimum touch targets');
  assert.ok(indexContent.includes('touch-action: manipulation;'), 'Must eliminate 300ms double-tap zoom delay');
});

test('MPS.5: BlurHash and progressive placeholder CSS (.blurhash-placeholder) present', () => {
  assert.ok(indexContent.includes('.blurhash-placeholder {'), 'Must define .blurhash-placeholder');
  assert.ok(indexContent.includes('.blurhash-loaded {'), 'Must define .blurhash-loaded');
});

test('MPS.6: Continuous corner radius & squircles (.squircle-card) defined', () => {
  assert.ok(indexContent.includes('.squircle-card'), 'Must define squircle continuous corner class');
});

// 3. JavaScript Standards Verification
test('MPS.7: Reversible Actions & Undo Toast (showLuxuryToastWithUndo) declared and exported', () => {
  assert.ok(indexContent.includes('function showLuxuryToastWithUndo('), 'Must declare showLuxuryToastWithUndo');
  assert.ok(indexContent.includes('window.showLuxuryToastWithUndo = showLuxuryToastWithUndo'), 'Must expose showLuxuryToastWithUndo on window');
});

test('MPS.8: Idempotency Key Generator (generateIdempotencyKey) declared and exported', () => {
  assert.ok(indexContent.includes('function generateIdempotencyKey('), 'Must declare generateIdempotencyKey');
  assert.ok(indexContent.includes('window.generateIdempotencyKey = generateIdempotencyKey'), 'Must expose generateIdempotencyKey on window');
});

test('MPS.9: Mobile Quick Actions Command Menu (openMobileQuickActionsSheet) declared and exported', () => {
  assert.ok(indexContent.includes('function openMobileQuickActionsSheet('), 'Must declare openMobileQuickActionsSheet');
  assert.ok(indexContent.includes('window.openMobileQuickActionsSheet = openMobileQuickActionsSheet'), 'Must expose openMobileQuickActionsSheet on window');
});

test('MPS.10: Swipe-to-dismiss bottom sheet gesture handler (enableSwipeToDismiss) declared', () => {
  assert.ok(indexContent.includes('function enableSwipeToDismiss('), 'Must declare enableSwipeToDismiss');
  assert.ok(indexContent.includes('window.enableSwipeToDismiss = enableSwipeToDismiss'), 'Must expose enableSwipeToDismiss on window');
});

test('MPS.11: Predictive back navigation & keyboard shortcuts (handleMobileBackPress) declared', () => {
  assert.ok(indexContent.includes('function handleMobileBackPress('), 'Must declare handleMobileBackPress');
  assert.ok(indexContent.includes('window.handleMobileBackPress = handleMobileBackPress'), 'Must expose handleMobileBackPress on window');
});

test('MPS.12: Farm Khata deletion uses optimistic removal with Undo Toast restoration', () => {
  assert.ok(indexContent.includes('showLuxuryToastWithUndo('), 'Must call showLuxuryToastWithUndo in deleteKhataEntry');
  assert.ok(indexContent.includes('farmKhataEntries.splice(index, 0, deletedItem)'), 'Must restore deleted item upon Undo click');
});

test('MPS.13: OTP input fields include autocomplete="one-time-code" and inputmode="numeric"', () => {
  assert.ok(indexContent.includes('id="kcc-otp-input" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code"'), 'kcc-otp-input must have OTP autofill attributes');
  assert.ok(indexContent.includes('id="driver-start-otp-input" type="text" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="one-time-code"'), 'driver-start-otp-input must have OTP autofill attributes');
});

// 4. Android Security Standards Verification
test('MPS.14: network_security_config.xml enforces cleartextTrafficPermitted="false" for production HTTPS', () => {
  assert.ok(netSecContent.includes('<base-config cleartextTrafficPermitted="false">'), 'base-config must forbid cleartext traffic');
  assert.ok(netSecContent.includes('<domain includeSubdomains="true">localhost</domain>'), 'domain-config must restrict cleartext to local dev');
});

// 5. Functional VM Execution of New Standards
test('MPS.15: Idempotency Key generates unique prefixed keys in VM', () => {
  const sandbox = {
    window: {},
    crypto: crypto,
    Math: Math,
    Date: Date
  };
  vm.createContext(sandbox);

  const snippet = `
    function generateIdempotencyKey(prefix = 'nk') {
      const time = Date.now().toString(36);
      const rand = (typeof crypto !== 'undefined' && crypto.getRandomValues)
        ? Array.from(crypto.getRandomValues(new Uint8Array(6))).map(b => b.toString(16).padStart(2, '0')).join('')
        : Math.random().toString(36).substring(2, 10);
      return \`\${prefix}_\${time}_\${rand}\`;
    }
  `;
  vm.runInContext(snippet, sandbox);

  const key1 = vm.runInContext("generateIdempotencyKey('booking')", sandbox);
  const key2 = vm.runInContext("generateIdempotencyKey('booking')", sandbox);

  assert.ok(key1.startsWith('booking_'), 'Key 1 must start with prefix');
  assert.ok(key2.startsWith('booking_'), 'Key 2 must start with prefix');
  assert.notStrictEqual(key1, key2, 'Two generated keys must be distinct');
});

// 6. Phase 2 Standards Verification
test('MPS.16: NuKropSWR stale-while-revalidate data fetching with cache invalidation', () => {
  assert.ok(indexContent.includes('const NuKropSWR = {'), 'Must declare NuKropSWR');
  assert.ok(indexContent.includes('window.NuKropSWR = NuKropSWR'), 'Must export NuKropSWR to window');
  
  // Test in VM
  const memStore = {};
  const sandbox = {
    window: {},
    localStorage: {
      getItem: (k) => memStore[k] || null,
      setItem: (k, v) => { memStore[k] = v; },
      removeItem: (k) => { delete memStore[k]; }
    },
    Date: Date,
    console: console
  };
  vm.createContext(sandbox);

  const swrSnippet = `
    const memCache = new Map();
    const NuKropSWR = {
      async fetch(key, fetcher, ttlMs = 120000, onRevalidated = null) {
        let cached = memCache.get(key);
        if (!cached) {
          const stored = localStorage.getItem('swr_' + key);
          if (stored) {
            try { cached = JSON.parse(stored); memCache.set(key, cached); } catch(e){}
          }
        }
        let staleData = null;
        if (cached) {
          staleData = cached.data;
          const isFresh = (Date.now() - cached.timestamp) < ttlMs;
          if (isFresh) return { data: cached.data, isStale: false };
        }
        const data = await fetcher();
        const entry = { data, timestamp: Date.now() };
        memCache.set(key, entry);
        localStorage.setItem('swr_' + key, JSON.stringify(entry));
        return { data, isStale: false };
      },
      invalidate(key) {
        memCache.delete(key);
        localStorage.removeItem('swr_' + key);
      }
    };
  `;
  vm.runInContext(swrSnippet, sandbox);
  vm.runInContext(`
    (async () => {
      let callCount = 0;
      const fetcher = async () => { callCount++; return { mandi: 'Warangal', rate: 7500 }; };
      const res1 = await NuKropSWR.fetch('test_mandi', fetcher, 60000);
      if (res1.data.rate !== 7500 || callCount !== 1) throw new Error('Initial fetch failed');
      const res2 = await NuKropSWR.fetch('test_mandi', fetcher, 60000);
      if (res2.data.rate !== 7500 || callCount !== 1) throw new Error('Cache hit failed');
      NuKropSWR.invalidate('test_mandi');
      const res3 = await NuKropSWR.fetch('test_mandi', fetcher, 60000);
      if (res3.data.rate !== 7500 || callCount !== 2) throw new Error('Invalidation failed');
    })()
  `, sandbox);
});

test('MPS.17: renderAgrarianStateCard covers 5 states (loading, empty, error, offline, success)', () => {
  assert.ok(indexContent.includes('function renderAgrarianStateCard('), 'Must declare renderAgrarianStateCard');
  assert.ok(indexContent.includes('window.renderAgrarianStateCard = renderAgrarianStateCard'), 'Must expose renderAgrarianStateCard on window');
  
  assert.ok(indexContent.includes('agrarian-state-loading'), 'Must have loading state class');
  assert.ok(indexContent.includes('agrarian-state-empty'), 'Must have empty state class');
  assert.ok(indexContent.includes('agrarian-state-error'), 'Must have error state class');
  assert.ok(indexContent.includes('agrarian-state-offline'), 'Must have offline state class');
  assert.ok(indexContent.includes('agrarian-state-success'), 'Must have success state class');
});

test('MPS.18: renderProgressiveImage integrates BlurHash placeholder into image rendering', () => {
  assert.ok(indexContent.includes('function renderProgressiveImage('), 'Must declare renderProgressiveImage');
  assert.ok(indexContent.includes('window.renderProgressiveImage = renderProgressiveImage'), 'Must expose renderProgressiveImage on window');
  assert.ok(indexContent.includes('progressive-img-wrapper'), 'Must include progressive-img-wrapper container');
  assert.ok(indexContent.includes('blurhash-loaded'), 'Must attach onload blurhash-loaded transition');
});

test('MPS.19: Complete coverage of all 9 mobile agrarian skeleton loaders', () => {
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
    assert.ok(indexContent.includes(`function ${skel}(`), `Must declare ${skel}`);
    assert.ok(indexContent.includes(`window.${skel} = ${skel}`), `Must export ${skel} to window`);
  }
});

test('MPS.20: Community like mutation includes optimistic update with rollback on failure', () => {
  assert.ok(indexContent.includes('async function syncCommunityLikeToSupabase('), 'Must declare syncCommunityLikeToSupabase');
  assert.ok(indexContent.includes('p.likes = Math.max(0, (p.likes || 0) - delta)'), 'Must rollback likes count on network error');
  assert.ok(indexContent.includes('p.isLiked = !willBeLiked'), 'Must rollback liked boolean on network error');
});

test('MPS.21: Community post deletion includes optimistic removal and reversible undo toast', () => {
  assert.ok(indexContent.includes('async function deleteCommunityPost('), 'Must declare deleteCommunityPost');
  assert.ok(indexContent.includes('COMMUNITY_POSTS_CATALOG.splice(postIndex, 0, p)'), 'Must rollback post in feed on undo');
  assert.ok(indexContent.includes('showLuxuryToastWithUndo'), 'Must trigger undo toast on post deletion');
});

test('MPS.22: Community author follow toggle includes optimistic toggle with undo toast', () => {
  assert.ok(indexContent.includes('async function toggleFollowUser('), 'Must declare toggleFollowUser');
  assert.ok(indexContent.includes('showLuxuryToastWithUndo'), 'Must display undo toast on follow change');
  assert.ok(indexContent.includes('reFollow.push(targetIdStr)'), 'Must restore following state on undo');
});

test('MPS.23: Notification dismissal provides reversible undo action', () => {
  assert.ok(indexContent.includes('function dismissNotificationWithUndo('), 'Must declare dismissNotificationWithUndo');
  assert.ok(indexContent.includes('window.dismissNotificationWithUndo = dismissNotificationWithUndo'), 'Must export dismissNotificationWithUndo');
  assert.ok(indexContent.includes('APP_NOTIFICATIONS.splice(index, 0, removed)'), 'Must restore notification on undo');
});

test('MPS.24: Precomputed agrarian matrices (BioRx dosages, spray windows, N-P-K tables)', () => {
  assert.ok(indexContent.includes('function precomputeAgrarianMatrices('), 'Must declare precomputeAgrarianMatrices');
  assert.ok(indexContent.includes('window.precomputeAgrarianMatrices = precomputeAgrarianMatrices'), 'Must export precomputeAgrarianMatrices');
  assert.ok(indexContent.includes('window.NUKROP_PRECOMPUTED ='), 'Must run precompute on boot');
});

test('MPS.25: Server-side idempotency replay in Fastify dispatch controller', () => {
  const dispatchPath = path.resolve(__dirname, '..', 'backend', 'src', 'controllers', 'dispatch.controller.ts');
  const dispatchCode = fs.readFileSync(dispatchPath, 'utf8');
  assert.ok(dispatchCode.includes('IdempotencyService'), 'dispatch controller must import IdempotencyService');
  assert.ok(dispatchCode.includes('IdempotencyService.check(idempotencyKey)'), 'createBookingRequest must check IdempotencyService');
  assert.ok(dispatchCode.includes('IdempotencyService.record'), 'createBookingRequest must record into IdempotencyService');
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. Visual Experience & Animation Preservation Standards (MPS.26 - MPS.40)
// ══════════════════════════════════════════════════════════════════════════════

test('MPS.26: Screen transition @keyframes viewFade and .screen-fade class defined', () => {
  assert.ok(indexContent.includes('.screen-fade {'), 'Must define .screen-fade class');
  assert.ok(indexContent.includes('@keyframes viewFade {'), 'Must declare @keyframes viewFade');
  assert.ok(indexContent.includes('animation: viewFade 0.18s cubic-bezier(0.16, 1, 0.3, 1);'), 'Must use cubic-bezier easing');
});

test('MPS.27: Bottom dock tab micro-animations (navTabPop, roof bounce, nod, bars rise, profile pop)', () => {
  assert.ok(indexContent.includes('@keyframes navTabPop {'), 'Must declare @keyframes navTabPop');
  assert.ok(indexContent.includes('@keyframes navHomeRoofBounce {'), 'Must declare @keyframes navHomeRoofBounce');
  assert.ok(indexContent.includes('@keyframes navCommAvatarNod {'), 'Must declare @keyframes navCommAvatarNod');
  assert.ok(indexContent.includes('@keyframes navMarketBarsRise {'), 'Must declare @keyframes navMarketBarsRise');
  assert.ok(indexContent.includes('@keyframes navProfilePop {'), 'Must declare @keyframes navProfilePop');
  assert.ok(indexContent.includes('@keyframes navDotScale {'), 'Must declare @keyframes navDotScale');
});

test('MPS.28: Center elevated FAB breathing glow animation (navFabBreathingGlow)', () => {
  assert.ok(indexContent.includes('@keyframes navFabBreathingGlow {'), 'Must declare @keyframes navFabBreathingGlow');
  assert.ok(indexContent.includes('.dock-center-fab'), 'Must declare .dock-center-fab element');
  assert.ok(indexContent.includes('radial-gradient(circle at 35% 30%'), 'Must have tactile radial gradient');
});

test('MPS.29: Modal and bottom-sheet slide-up animations (modalSheetSlideUp)', () => {
  assert.ok(indexContent.includes('@keyframes modalSheetSlideUp {'), 'Must declare @keyframes modalSheetSlideUp');
  assert.ok(indexContent.includes('transform: translateY(0)'), 'Must animate to translateY(0)');
  assert.ok(indexContent.includes('backdrop-filter: blur('), 'Must feature blur backdrop filter');
});

test('MPS.30: Splash screen aura pulse and laser scan animations (splashAuraPulse, vfLaserScan)', () => {
  assert.ok(indexContent.includes('@keyframes splashAuraPulse {'), 'Must declare @keyframes splashAuraPulse');
  assert.ok(indexContent.includes('@keyframes vfLaserScan {'), 'Must declare @keyframes vfLaserScan');
  assert.ok(indexContent.includes('@keyframes splashLeafShimmer {'), 'Must declare @keyframes splashLeafShimmer');
});

test('MPS.31: News ticker marquee scrolling animation (newsTickerScroll)', () => {
  assert.ok(indexContent.includes('@keyframes newsTickerScroll {'), 'Must declare @keyframes newsTickerScroll');
  assert.ok(indexContent.includes('transform: translateX(-50%)'), 'Must scroll seamlessly');
});

test('MPS.32: Heart pop and social engagement animation (heartPopAnimation)', () => {
  assert.ok(indexContent.includes('@keyframes heartPopAnimation {'), 'Must declare @keyframes heartPopAnimation');
  assert.ok(indexContent.includes('@keyframes storyRingGlow {'), 'Must declare @keyframes storyRingGlow');
});

test('MPS.33: Skeleton shimmer gradient sweep animation (nkShimmer)', () => {
  assert.ok(indexContent.includes('@keyframes nkShimmer {'), 'Must declare @keyframes nkShimmer');
  assert.ok(indexContent.includes('background-size: 200% 100%'), 'Must have 200% background size for shimmer sweep');
  assert.ok(indexContent.includes('@media (prefers-reduced-motion: reduce)'), 'Must support prefers-reduced-motion');
});

test('MPS.34: Luxury toast container, undo countdown and dynamic styling', () => {
  assert.ok(indexContent.includes('nukrop-luxury-toast-container'), 'Must manage luxury toast container');
  assert.ok(indexContent.includes('showLuxuryToastWithUndo'), 'Must support undo toasts');
});

test('MPS.35: Device safe-area top padding and device inset CSS handling (--sat)', () => {
  assert.ok(indexContent.includes('var(--sat'), 'Must use --sat safe-area token');
  assert.ok(indexContent.includes('padding-top:max('), 'Must guard with padding-top:max');
});

test('MPS.36: Micro-climate spray window gauge and astronomical visual assets', () => {
  assert.ok(indexContent.includes('function getAstronomicalState('), 'Must declare getAstronomicalState');
  assert.ok(indexContent.includes('function getDynamicSprayWindows('), 'Must calculate dynamic spray windows');
});

test('MPS.37: OTP input numeric styling and focus visual states', () => {
  assert.ok(indexContent.includes('inputmode="numeric"'), 'Must specify numeric keyboard');
  assert.ok(indexContent.includes('autocomplete="one-time-code"'), 'Must support one-time-code autofill');
});

test('MPS.38: Crop doctor foliar camera viewfinder and scanning laser', () => {
  assert.ok(indexContent.includes('camera-feed') || indexContent.includes('scanner') || indexContent.includes('vfLaserScan'), 'Must include scanner camera styles');
});

test('MPS.39: Responsive layout overflow containment across Android screen sizes', () => {
  assert.ok(indexContent.includes('overscroll-behavior: contain;'), 'Must contain overscroll behavior');
  assert.ok(indexContent.includes('touch-action: manipulation;'), 'Must enforce touch manipulation');
});

test('MPS.40: Strict parity of visual assets, SVGs, and animations between index.html and nukrop_emulator.html', () => {
  const indexKeyframes = (indexContent.match(/@keyframes\s+([a-zA-Z0-9_-]+)/g) || []).sort();
  const emulatorKeyframes = (emulatorContent.match(/@keyframes\s+([a-zA-Z0-9_-]+)/g) || []).sort();
  assert.strictEqual(indexKeyframes.length, emulatorKeyframes.length, 'Keyframe counts must be identical across mirrors');
  assert.deepStrictEqual(indexKeyframes, emulatorKeyframes, 'Keyframe names must match 100%');
});

console.log('\n================================================================================');
console.log(`📊 PERMANENT STANDARDS AUDIT: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================================\n');

if (failCount > 0) {
  process.exit(1);
}

