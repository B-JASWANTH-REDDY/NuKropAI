/**
 * NuKropAI Agrarian OS — Strict Location Lock & Mandi Isolation Verification Suite
 * Verifies that when a user selects or sets their exact location (State or Mandi):
 * - ONLY records matching that exact location are displayed.
 * - ZERO cross-state or cross-mandi rate leakage (even on crop search or fallback).
 * - Interactive quick state selector chips and datalists are wired.
 * - 100% parity between app/src/main/assets/index.html and nukrop_emulator.html.
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
describe('Mandi Strict Location Lock — Static Contracts & Parity', () => {

  it('M.S.1: index.html and nukrop_emulator.html are 100% byte-for-byte identical', () => {
    expect(indexHtml.length).toBe(emulatorHtml.length);
    expect(indexHtml === emulatorHtml).toBe(true);
  });

  const assets = [
    { name: 'app/src/main/assets/index.html', html: indexHtml },
    { name: 'nukrop_emulator.html', html: emulatorHtml }
  ];

  assets.forEach(({ name, html }) => {
    it(`M.S.2 [${name}]: Strict Location Lock functions are declared`, () => {
      expect(html.includes('function selectMandiState(state)')).toBe(true);
      expect(html.includes('function selectMandiMarket(market, state')).toBe(true);
      expect(html.includes('function getFilteredMandiRates()')).toBe(true);
      expect(html.includes('function getMandiDefaults(')).toBe(true);
    });

    it(`M.S.3 [${name}]: Quick State Selector chips and datalists are present in UI`, () => {
      expect(html.includes('id="mandi-states-list"')).toBe(true);
      expect(html.includes('id="mandi-markets-list"')).toBe(true);
      expect(html.includes('id="mandi-lock-indicator"')).toBe(true);
      expect(html.includes("selectMandiState('${s.key}')")).toBe(true);
      expect(html.includes("option value=\"Telangana\"")).toBe(true);
      expect(html.includes("option value=\"Punjab\"")).toBe(true);
    });

    it(`M.S.4 [${name}]: farmerProfile has state and district explicitly defined`, () => {
      expect(html.includes("state: 'Telangana'")).toBe(true);
      expect(html.includes("district: 'Warangal'")).toBe(true);
    });
  });
});

// ============================================================================
// SECTION 2: Dynamic Execution & Strict Location Isolation
// ============================================================================
describe('Mandi Strict Location Lock — Dynamic Isolation & Anti-Leakage', () => {

  function buildMandiContext() {
    const mockStorage = createMockStorage();
    const domElements = {};

    const ctx = {
      window: {},
      document: {
        getElementById: (id) => {
          if (!domElements[id]) {
            domElements[id] = {
              id,
              value: '',
              innerHTML: '',
              textContent: '',
              style: {},
              classList: { add: () => {}, remove: () => {}, contains: () => false }
            };
          }
          return domElements[id];
        },
        querySelectorAll: () => [],
        createElement: (tag) => ({ tag, style: {}, appendChild: () => {}, setAttribute: () => {} })
      },
      localStorage: mockStorage,
      sessionStorage: mockStorage,
      navigator: { userAgent: 'NodeTest', geolocation: null },
      console: { log: () => {}, warn: () => {}, error: () => {} },
      setTimeout: (fn) => fn(),
      clearTimeout: () => {},
      alert: () => {},
      TL: (en, te, hi) => en,
      currentLang: 'en',
      getCropIconImg: () => '<img>',
      fetchMandiRatesFromSupabase: async () => []
    };

    ctx.window = ctx;

    // Extract scripts from indexHtml
    const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    const scripts = [];
    while ((match = re.exec(indexHtml)) !== null) {
      scripts.push(match[1]);
    }

    const scriptCode = scripts.join('\n;\n');
    vm.createContext(ctx);
    vm.runInContext(scriptCode, ctx);

    return ctx;
  }

  it('M.D.1: Default cold-boot state locks to farmer home state (Telangana)', () => {
    const ctx = buildMandiContext();
    expect(ctx.mandiSearchState).toBe('Telangana');

    const rates = ctx.getFilteredMandiRates();
    expect(rates.length > 0).toBe(true);

    // Every single rate must belong to Telangana
    const nonTs = rates.filter(r => r.state.en.toLowerCase() !== 'telangana');
    expect(nonTs.length).toBe(0);
  });

  it('M.D.2: Selecting Punjab locks ONLY Punjab APMC records (0 leakage from others)', () => {
    const ctx = buildMandiContext();
    ctx.selectMandiState('Punjab');

    expect(ctx.mandiSearchState).toBe('Punjab');
    const rates = ctx.getFilteredMandiRates();
    expect(rates.length > 0).toBe(true);

    rates.forEach(r => {
      expect(r.state.en.toLowerCase()).toBe('punjab');
    });

    const otherStates = rates.filter(r => r.state.en.toLowerCase() !== 'punjab');
    expect(otherStates.length).toBe(0);
  });

  it('M.D.3: Selecting Maharashtra locks ONLY Maharashtra APMC records', () => {
    const ctx = buildMandiContext();
    ctx.selectMandiState('Maharashtra');

    expect(ctx.mandiSearchState).toBe('Maharashtra');
    const rates = ctx.getFilteredMandiRates();
    expect(rates.length > 0).toBe(true);

    rates.forEach(r => {
      expect(r.state.en.toLowerCase()).toBe('maharashtra');
    });
  });

  it('M.D.4: Specific Mandi filter locks ONLY that exact APMC market', () => {
    const ctx = buildMandiContext();
    ctx.selectMandiMarket('Warangal', 'Telangana');

    expect(ctx.mandiSearchState).toBe('Telangana');
    expect(ctx.mandiSearchMandi).toBe('Warangal');

    const rates = ctx.getFilteredMandiRates();
    expect(rates.length > 0).toBe(true);

    rates.forEach(r => {
      const matchMandi = (r.mandi.en + ' ' + (r.district || '')).toLowerCase();
      expect(matchMandi.includes('warangal')).toBe(true);
    });
  });

  it('M.D.5: Anti-Leakage: Crop search in locked location NEVER leaks out other states', () => {
    const ctx = buildMandiContext();
    
    // Case A: Crop present in Telangana (Potato) returns ONLY Telangana records
    ctx.selectMandiState('Telangana');
    ctx.window.mandiSearchCrop = 'Potato';
    ctx.window.mandiSelectedPopular = 'all';

    const potatoRates = ctx.getFilteredMandiRates();
    expect(potatoRates.length > 0).toBe(true);
    potatoRates.forEach(r => {
      expect(r.state.en.toLowerCase()).toBe('telangana');
    });

    // Case B: Crop NOT present in Telangana (Cashewnuts / Jaggery) MUST return 0 matches
    // (Never leaking Cashewnuts from UP or Maharashtra!)
    ctx.window.mandiSearchCrop = 'Cashewnuts';
    const cashewnutRates = ctx.getFilteredMandiRates();
    expect(cashewnutRates.length).toBe(0);

    const cardsHtml = ctx.renderMandiCardsHtml();
    expect(cardsHtml.includes('Strict Location Filter active')).toBe(true);
    expect(cardsHtml.includes('Telangana')).toBe(true);
    expect(cardsHtml.includes('Show All Crops in Telangana')).toBe(true);
  });

  it('M.D.6: All-India exploration mode works when location lock is cleared', () => {
    const ctx = buildMandiContext();
    ctx.selectMandiState('all');

    expect(ctx.mandiSearchState).toBe('');
    expect(ctx.mandiSearchMandi).toBe('');

    const allRates = ctx.getFilteredMandiRates();
    expect(allRates.length > 300).toBe(true);

    // Now search for potato across All India
    ctx.window.mandiSearchCrop = 'Potato';
    const potatoRates = ctx.getFilteredMandiRates();
    expect(potatoRates.length > 0).toBe(true);
  });

  it('M.D.7: getMandiDefaults prioritizes farmer local state rate', () => {
    const ctx = buildMandiContext();
    
    // For default farmer in Telangana (cotton is traded in Telangana)
    const tsDefault = ctx.getMandiDefaults('cotton');
    expect(tsDefault.catalogItem.state.en.toLowerCase()).toBe('telangana');

    // For farmer querying with Punjab preferred state (wheat is traded in Punjab)
    const pbDefault = ctx.getMandiDefaults('wheat', 'Punjab');
    expect(pbDefault.catalogItem.state.en.toLowerCase()).toBe('punjab');
  });

  it('M.D.8: executeMandiSearch updates #mandi-lock-indicator in DOM', () => {
    const ctx = buildMandiContext();
    const ind = ctx.document.getElementById('mandi-lock-indicator');
    
    ctx.selectMandiState('Telangana');
    expect(ind.innerHTML.includes('Showing ONLY Mandi Rates for')).toBe(true);
    expect(ind.innerHTML.includes('Telangana')).toBe(true);

    ctx.selectMandiState('all');
    expect(ind.innerHTML.includes('All India Mandis')).toBe(true);
  });
});

// ============================================================================
// SECTION 3: Real Price Trends, Persistent Price Alerts & Notification Engine
// ============================================================================
describe('Mandi Real Price Trends, Real Price Alerts & Notification Integrity', () => {

  function buildMandiContext() {
    const mockStorage = createMockStorage();
    const domElements = {};

    const ctx = {
      window: {},
      document: {
        getElementById: (id) => {
          if (!domElements[id]) {
            domElements[id] = {
              id,
              value: '',
              innerHTML: '',
              textContent: '',
              style: {},
              classList: { add: () => {}, remove: () => {}, contains: () => false }
            };
          }
          return domElements[id];
        },
        querySelectorAll: () => [],
        createElement: (tag) => ({ tag, style: {}, appendChild: () => {}, setAttribute: () => {} })
      },
      localStorage: mockStorage,
      sessionStorage: mockStorage,
      navigator: { userAgent: 'NodeTest', geolocation: null },
      console: { log: () => {}, warn: () => {}, error: () => {} },
      setTimeout: (fn) => fn(),
      clearTimeout: () => {},
      alert: () => {},
      TL: (en, te, hi) => en,
      currentLang: 'en',
      getCropIconImg: () => '<img>',
      fetchMandiRatesFromSupabase: async () => []
    };

    ctx.window = ctx;

    const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    const scripts = [];
    while ((match = re.exec(indexHtml)) !== null) {
      scripts.push(match[1]);
    }

    const scriptCode = scripts.join('\n;\n');
    vm.createContext(ctx);
    vm.runInContext(scriptCode, ctx);

    return ctx;
  }

  it('M.PT.1: Price trend curve renders authentic calendar dates (Nov/Oct 2026) and zero Aug/Jul placeholders', () => {
    const ctx = buildMandiContext();
    const item = ctx.AGMARKNET_MANDI_CATALOG[0];
    ctx.openPriceTrendModal(item.id);

    const body = ctx.document.getElementById('pt-modal-body');
    expect(body.innerHTML.length > 100).toBe(true);
    expect(body.innerHTML.includes('Aug')).toBe(false);
    expect(body.innerHTML.includes('Jul')).toBe(false);
    expect(body.innerHTML.includes('Nov') || body.innerHTML.includes('Oct')).toBe(true);
  });

  it('M.PT.2: Price trend curve terminal point matches exact Agmarknet modal price', () => {
    const ctx = buildMandiContext();
    const item = ctx.AGMARKNET_MANDI_CATALOG[0];
    ctx.openPriceTrendModal(item.id);

    const selected = ctx.selectedPriceTrendItem;
    expect(selected).toBeTruthy();
    const body = ctx.document.getElementById('pt-modal-body');
    // Must display live modal price with proper rupee format
    expect(body.innerHTML.includes(`₹${selected.modalPrice.toLocaleString()}`)).toBe(true);
  });

  it('M.PA.1: saveCurrentPriceAlert persists alert to localStorage and dispatches real notification', () => {
    const ctx = buildMandiContext();
    const item = ctx.AGMARKNET_MANDI_CATALOG[0];
    ctx.openPriceAlertModal(item.id, 'manage');

    ctx.currentAlertTargetPrice = 7900;
    ctx.saveCurrentPriceAlert();

    // Check localStorage persistence
    const savedAlertsStr = ctx.localStorage.getItem('nukrop_active_price_alerts');
    expect(savedAlertsStr).toBeTruthy();
    const savedAlerts = JSON.parse(savedAlertsStr);
    expect(savedAlerts.length > 0).toBe(true);
    const customAlert = savedAlerts.find(a => a.targetPrice === 7900);
    expect(customAlert).toBeTruthy();

    // Check notification dispatch
    const savedNotifsStr = ctx.localStorage.getItem('nukrop_app_notifications');
    expect(savedNotifsStr).toBeTruthy();
    const savedNotifs = JSON.parse(savedNotifsStr);
    const alertNotif = savedNotifs.find(n => n.title.en.includes('7,900'));
    expect(alertNotif).toBeTruthy();
    expect(alertNotif.read).toBe(false);
  });

  it('M.PA.2: togglePriceAlertActive and deletePriceAlert update localStorage', () => {
    const ctx = buildMandiContext();
    expect(ctx.activePriceAlerts.length > 0).toBe(true);

    const firstId = ctx.activePriceAlerts[0].id;
    const initialActive = ctx.activePriceAlerts[0].active;

    // Toggle
    ctx.togglePriceAlertActive(firstId);
    let stored = JSON.parse(ctx.localStorage.getItem('nukrop_active_price_alerts'));
    expect(stored.find(a => a.id === firstId).active).toBe(!initialActive);

    // Delete
    const prevCount = ctx.activePriceAlerts.length;
    ctx.deletePriceAlert(firstId);
    stored = JSON.parse(ctx.localStorage.getItem('nukrop_active_price_alerts'));
    expect(stored.length).toBe(prevCount - 1);
  });

  it('M.PA.3: checkAndTriggerRealtimeAlerts triggers real surge notification when live rate meets target', () => {
    const ctx = buildMandiContext();

    // Add an alert with target lower than current rate to trigger immediate surge
    const item = ctx.AGMARKNET_MANDI_CATALOG[0];
    ctx.activePriceAlerts.unshift({
      id: 'pa-test-surge',
      cropKey: item.cropKey,
      cropSlug: item.cropSlug,
      cropName: item.cropName,
      mandi: item.mandi,
      state: item.state,
      basePrice: item.modalPrice - 100,
      targetPrice: item.modalPrice, // Exactly live rate
      unit: '/Qtl',
      phone: '9849022338',
      channelSms: true,
      channelPush: true,
      active: true,
      createdDate: '01 Nov 2026',
      lastTriggeredAt: null
    });
    ctx.persistPriceAlerts();

    ctx.checkAndTriggerRealtimeAlerts();

    const notifs = ctx.APP_NOTIFICATIONS;
    const surgeNotif = notifs.find(n => n.id.startsWith('notif-surge-'));
    expect(surgeNotif).toBeTruthy();
    expect(surgeNotif.title.en.includes('Rate Surpassed')).toBe(true);
  });

  it('M.NT.1: markAllNotificationsRead marks all notifications read and persists', () => {
    const ctx = buildMandiContext();
    ctx.markAllNotificationsRead();

    ctx.APP_NOTIFICATIONS.forEach(n => {
      expect(n.read).toBe(true);
    });

    const stored = JSON.parse(ctx.localStorage.getItem('nukrop_app_notifications'));
    stored.forEach(n => {
      expect(n.read).toBe(true);
    });
  });
});
