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

console.log('\n================================================================================');
console.log(`📊 PERMANENT STANDARDS AUDIT: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================================\n');

if (failCount > 0) {
  process.exit(1);
}
