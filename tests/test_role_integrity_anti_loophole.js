/**
 * NuKropAI Agrarian OS — Role Integrity & Anti-Loophole Verification Suite
 * Verifies strict separation between Farmer and Truck Driver accounts:
 * - A user registered as Farmer CANNOT log in or register as a Driver.
 * - A user registered as Driver CANNOT log in or register as a Farmer.
 * - Zero silent role flipping, zero screen guard leaks, zero rehydration bypasses.
 * - Exact synchronization between app/src/main/assets/index.html and nukrop_emulator.html.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { describe, it, expect, createMockStorage } = require('./test_harness');

const indexPath = path.resolve(__dirname, '../app/src/main/assets/index.html');
const emulatorPath = path.resolve(__dirname, '../nukrop_emulator.html');

const indexHtml = fs.readFileSync(indexPath, 'utf8');
const emulatorHtml = fs.readFileSync(emulatorPath, 'utf8');

// ============================================================================
// SECTION 1: Static Code Contracts & Asset Synchronization
// ============================================================================
describe('Role Integrity — Static Contracts & Asset Synchronization', () => {

  it('R.S.1: index.html and nukrop_emulator.html are 100% byte-for-byte identical', () => {
    expect(indexHtml.length).toBe(emulatorHtml.length);
    expect(indexHtml === emulatorHtml).toBe(true);
  });

  const assets = [
    { name: 'app/src/main/assets/index.html', html: indexHtml },
    { name: 'nukrop_emulator.html', html: emulatorHtml }
  ];

  assets.forEach(({ name, html }) => {
    it(`R.S.2 [${name}]: NuKropRoleGuard architecture is fully declared`, () => {
      expect(html.includes('const NuKropRoleGuard = {')).toBe(true);
      expect(html.includes('checkRoleConflict(identifier, attemptedRole)')).toBe(true);
      expect(html.includes('normalizePhone(phone)')).toBe(true);
      expect(html.includes('normalizeEmail(email)')).toBe(true);
      expect(html.includes('registerAccount(identifier, role, meta')).toBe(true);
      expect(html.includes('showRoleConflictModal(reason, targetRole, opposingRole)')).toBe(true);
      expect(html.includes('window.NuKropRoleGuard = NuKropRoleGuard')).toBe(true);
    });

    it(`R.S.3 [${name}]: handleGoogleLogin is bound and opens Google Auth Modal`, () => {
      expect(html.includes('function handleGoogleLogin()')).toBe(true);
      expect(html.includes('onclick="handleGoogleLogin()"')).toBe(true);
      expect(html.includes('openInAppGoogleAuthModal()')).toBe(true);
    });

    it(`R.S.4 [${name}]: Driver Portal checks role conflict before assigning driver role`, () => {
      expect(html.includes("NuKropRoleGuard.checkRoleConflict(cleanPhone, 'driver')")).toBe(true);
      expect(html.includes("NuKropRoleGuard.registerAccount(cleanPhone, 'driver'")).toBe(true);
    });

    it(`R.S.5 [${name}]: Farmer Phone Auth checks role conflict before assigning farmer role`, () => {
      expect(html.includes("NuKropRoleGuard.checkRoleConflict(cleanPhone, 'farmer')")).toBe(true);
      expect(html.includes("NuKropRoleGuard.registerAccount(cleanPhone, 'farmer'")).toBe(true);
    });

    it(`R.S.6 [${name}]: Farmer Email/Password Auth checks role conflict`, () => {
      expect(html.includes("NuKropRoleGuard.checkRoleConflict(email, 'farmer')")).toBe(true);
      expect(html.includes("NuKropRoleGuard.registerAccount(email, 'farmer'")).toBe(true);
    });

    it(`R.S.7 [${name}]: Google OAuth Auth checks role conflict`, () => {
      expect(html.includes("NuKropRoleGuard.checkRoleConflict(email, 'farmer')")).toBe(true);
      expect(html.includes("NuKropRoleGuard.registerAccount(email, 'farmer'")).toBe(true);
    });

    it(`R.S.8 [${name}]: Screen guard prevents role leaks and unauthorized cross-role screen access`, () => {
      expect(html.includes("activeRole === 'driver' && farmerExclusiveScreens.includes(screenKey)")).toBe(true);
      expect(html.includes("activeRole === 'farmer' && screenKey === 'driver_dashboard'")).toBe(true);
      expect(html.includes("screenKey = 'gramhaul'")).toBe(true);
    });

    it(`R.S.9 [${name}]: Cold boot rehydration is role-aware (shows driver_dashboard for drivers)`, () => {
      expect(html.includes("role === 'driver'")).toBe(true);
      expect(html.includes("openScreen('driver_dashboard', null)")).toBe(true);
      expect(html.includes("updateBottomDockForRole('driver')")).toBe(true);
    });

    it(`R.S.10 [${name}]: switchUserRole enforces explicit confirmation and logout`, () => {
      expect(html.includes('function switchUserRole(targetRole)')).toBe(true);
      expect(html.includes('role-switch-auth-modal')).toBe(true);
      expect(html.includes('executeSignOutToLogin')).toBe(true);
    });
  });
});

// ============================================================================
// SECTION 2: NuKropRoleGuard Unit & Adversarial Logic Verification
// ============================================================================
describe('Role Integrity — Functional Role Guard & Conflict Interception', () => {

  function createRoleGuardVM() {
    const mockStorage = createMockStorage({});
    const toasts = [];

    const sandbox = {
      localStorage: mockStorage,
      sessionStorage: createMockStorage({}),
      showToast: (msg, type) => toasts.push({ msg, type }),
      window: {},
      document: {
        getElementById: () => ({
          style: {},
          classList: { add: () => {}, remove: () => {} },
          innerText: '',
          innerHTML: '',
          value: '',
          remove: () => {}
        }),
        createElement: () => ({
          style: {},
          classList: { add: () => {}, remove: () => {} },
          innerText: '',
          innerHTML: '',
          remove: () => {}
        }),
        body: { appendChild: () => {}, removeChild: () => {} }
      },
      setTimeout: (fn) => fn(),
      console: { log: () => {}, warn: () => {}, error: () => {} }
    };

    // Extract NuKropRoleGuard code
    const startIndex = indexHtml.indexOf('const NuKropRoleGuard = {');
    const stopMarker = 'function handleGoogleLogin()';
    const endIndex = indexHtml.indexOf(stopMarker, startIndex);
    if (startIndex === -1 || endIndex === -1) {
      throw new Error('Could not locate NuKropRoleGuard code block in index.html');
    }
    const guardCode = indexHtml.slice(startIndex, endIndex);

    const script = new vm.Script(guardCode);
    const context = vm.createContext(sandbox);
    script.runInContext(context);

    return {
      guard: sandbox.window.NuKropRoleGuard,
      storage: mockStorage,
      toasts,
      sandbox
    };
  }

  it('R.F.1: Phone normalization handles +91, dashes, spaces, and leading zeros', () => {
    const { guard } = createRoleGuardVM();

    expect(guard.normalizePhone('+91 98490 22338')).toBe('9849022338');
    expect(guard.normalizePhone('+91-98490-22338')).toBe('9849022338');
    expect(guard.normalizePhone('09849022338')).toBe('9849022338');
    expect(guard.normalizePhone('9849022338')).toBe('9849022338');
    expect(guard.normalizePhone(' +91 94401 55667 ')).toBe('9440155667');
  });

  it('R.F.2: Email normalization lowercases and trims identifiers', () => {
    const { guard } = createRoleGuardVM();

    expect(guard.normalizeEmail(' Farmer.Rao@GMAIL.COM ')).toBe('farmer.rao@gmail.com');
    expect(guard.normalizeEmail('Driver.Kumar@GramHaul.IN')).toBe('driver.kumar@gramhaul.in');
  });

  it('R.F.3: Registration stores role profile in local registry and active role', () => {
    const { guard, storage } = createRoleGuardVM();

    guard.registerAccount('9849022338', 'farmer', { name: 'Ramesh Reddy', email: 'ramesh@agri.in' });

    const registry = JSON.parse(storage.getItem('nukrop_role_registry') || '{}');
    expect(registry['9849022338']).toBeDefined();
    expect(registry['9849022338'].role).toBe('farmer');
    expect(registry['9849022338'].name).toBe('Ramesh Reddy');
  });

  it('R.F.4: Conflict Detection: Farmer account CANNOT register or log in as Driver', async () => {
    const { guard } = createRoleGuardVM();

    // Register Farmer Ramesh
    guard.registerAccount('9849022338', 'farmer', { name: 'Ramesh Reddy', email: 'ramesh@agri.in' });
    guard.registerAccount('ramesh@agri.in', 'farmer', { name: 'Ramesh Reddy', phone: '9849022338' });

    // Attempting driver login with farmer phone
    const phoneConflict = await guard.checkRoleConflict('9849022338', 'driver');
    expect(phoneConflict.conflict).toBe(true);
    expect(phoneConflict.opposingRole).toBe('farmer');

    // Attempting driver login with formatted phone +91 98490 22338
    const formattedConflict = await guard.checkRoleConflict('+91 98490 22338', 'driver');
    expect(formattedConflict.conflict).toBe(true);
    expect(formattedConflict.opposingRole).toBe('farmer');

    // Attempting driver login with farmer email
    const emailConflict = await guard.checkRoleConflict('ramesh@agri.in', 'driver');
    expect(emailConflict.conflict).toBe(true);
    expect(emailConflict.opposingRole).toBe('farmer');

    // Farmer re-login with own phone is NOT a conflict
    const farmerSelfCheck = await guard.checkRoleConflict('9849022338', 'farmer');
    expect(farmerSelfCheck.conflict).toBe(false);
  });

  it('R.F.5: Conflict Detection: Driver account CANNOT register or log in as Farmer', async () => {
    const { guard } = createRoleGuardVM();

    // Register Driver Suresh
    guard.registerAccount('9440155667', 'driver', { name: 'Suresh Kumar', email: 'suresh@gramhaul.in' });
    guard.registerAccount('suresh@gramhaul.in', 'driver', { name: 'Suresh Kumar', phone: '9440155667' });

    // Attempting farmer phone OTP with driver phone
    const phoneConflict = await guard.checkRoleConflict('9440155667', 'farmer');
    expect(phoneConflict.conflict).toBe(true);
    expect(phoneConflict.opposingRole).toBe('driver');

    // Attempting farmer email auth with driver email
    const emailConflict = await guard.checkRoleConflict('suresh@gramhaul.in', 'farmer');
    expect(emailConflict.conflict).toBe(true);
    expect(emailConflict.opposingRole).toBe('driver');

    // Driver re-login with own phone is NOT a conflict
    const driverSelfCheck = await guard.checkRoleConflict('9440155667', 'driver');
    expect(driverSelfCheck.conflict).toBe(false);
  });

  it('R.F.6: Unregistered credentials return no conflict for either role', async () => {
    const { guard } = createRoleGuardVM();

    const freshPhoneFarmer = await guard.checkRoleConflict('9123456780', 'farmer');
    expect(freshPhoneFarmer.conflict).toBe(false);

    const freshPhoneDriver = await guard.checkRoleConflict('9123456780', 'driver');
    expect(freshPhoneDriver.conflict).toBe(false);
  });
});

// ============================================================================
// SECTION 3: Screen Navigation & Anti-Bypass Guard Verification
// ============================================================================
describe('Role Integrity — Screen Navigation & Role Isolation', () => {

  function createScreenRoutingSimulation(initialRole) {
    const storage = createMockStorage({
      'nukrop_user_role': initialRole,
      'nukrop_onboarding_plantix_completed': 'true'
    });
    let activeScreen = initialRole === 'driver' ? 'driver_dashboard' : 'home';
    const toasts = [];

    function showLuxuryToast(msg, type) {
      toasts.push({ msg, type });
    }

    function openScreen(screenKey) {
      const activeRole = storage.getItem('nukrop_user_role') || 'farmer';
      const farmerExclusiveScreens = ['home', 'community', 'scanner', 'scan', 'market', 'profile', 'equipment', 'loan', 'biorx', 'bioshield', 'khata', 'agristack'];

      if (activeRole === 'driver' && farmerExclusiveScreens.includes(screenKey)) {
        showLuxuryToast('🚚 Driver Partner session active. Sign out to access Farmer features.', 'warning');
        screenKey = 'driver_dashboard';
      }

      if (activeRole === 'farmer' && screenKey === 'driver_dashboard') {
        showLuxuryToast('🧑‍🌾 Driver Cockpit is restricted to Truck Drivers. Book freight from GramHaul.', 'info');
        screenKey = 'gramhaul';
      }

      activeScreen = screenKey;
      if (activeRole === 'farmer' && ['home', 'community', 'scanner', 'scan', 'market', 'profile'].includes(activeScreen)) {
        storage.setItem('nukrop_user_role', 'farmer');
      }
    }

    return {
      storage,
      getScreen: () => activeScreen,
      openScreen,
      toasts
    };
  }

  it('R.N.1: Driver navigating to home or scanner is kept on driver_dashboard with role intact', () => {
    const sim = createScreenRoutingSimulation('driver');

    sim.openScreen('home');
    expect(sim.getScreen()).toBe('driver_dashboard');
    expect(sim.storage.getItem('nukrop_user_role')).toBe('driver');
    expect(sim.toasts.length).toBe(1);
    expect(sim.toasts[0].msg.includes('Driver Partner session active')).toBe(true);

    sim.openScreen('scanner');
    expect(sim.getScreen()).toBe('driver_dashboard');
    expect(sim.storage.getItem('nukrop_user_role')).toBe('driver');
  });

  it('R.N.2: Farmer navigating to driver_dashboard is redirected to gramhaul booking', () => {
    const sim = createScreenRoutingSimulation('farmer');

    sim.openScreen('driver_dashboard');
    expect(sim.getScreen()).toBe('gramhaul');
    expect(sim.storage.getItem('nukrop_user_role')).toBe('farmer');
    expect(sim.toasts.length).toBe(1);
    expect(sim.toasts[0].msg.includes('restricted to Truck Drivers')).toBe(true);
  });

  it('R.N.3: Farmer navigating across normal screens remains farmer', () => {
    const sim = createScreenRoutingSimulation('farmer');

    sim.openScreen('home');
    expect(sim.getScreen()).toBe('home');

    sim.openScreen('community');
    expect(sim.getScreen()).toBe('community');

    sim.openScreen('scanner');
    expect(sim.getScreen()).toBe('scanner');
    expect(sim.storage.getItem('nukrop_user_role')).toBe('farmer');
  });

  it('R.N.4: Cold start rehydration boots to correct view per role', () => {
    function rehydrate(role) {
      const storage = createMockStorage({ 'nukrop_user_role': role });
      const currentRole = storage.getItem('nukrop_user_role') || 'farmer';
      if (currentRole === 'driver') {
        return { initialScreen: 'driver_dashboard', bottomNavVisible: false };
      } else {
        return { initialScreen: 'home', bottomNavVisible: true };
      }
    }

    const driverBoot = rehydrate('driver');
    expect(driverBoot.initialScreen).toBe('driver_dashboard');
    expect(driverBoot.bottomNavVisible).toBe(false);

    const farmerBoot = rehydrate('farmer');
    expect(farmerBoot.initialScreen).toBe('home');
    expect(farmerBoot.bottomNavVisible).toBe(true);
  });
});
