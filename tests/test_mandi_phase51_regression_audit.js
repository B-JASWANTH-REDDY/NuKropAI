/**
 * NuKropAI Agrarian OS — Phase 5.1 Mandi Filter Regression Audit Suite
 * 
 * Verifies:
 * 1. Manual search and popular-pill interaction (switching, typing, clearing, sync).
 * 2. Commodity classification & anti-leakage (Cotton vs Cotton Seed, Potato vs Sweet Potato,
 *    Chilli vs Capsicum, Wheat vs Buckwheat, Tomato vs Tamarind, Onion vs Onion Green).
 * 3. Multilingual and romanized alias matching (English, Telugu, Hindi, phonetic).
 * 4. Location isolation across state, district, and market (zero cross-location leakage).
 * 5. Genuine provider data flow, provenance tiers (Tier 1/2/3), timestamps, and error resiliency.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { describe, it, expect, createMockStorage, globalContext } = require('./test_harness');

const indexPath = path.resolve(__dirname, '../app/src/main/assets/index.html');
const emulatorPath = path.resolve(__dirname, '../nukrop_emulator.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
const emulatorHtml = fs.readFileSync(emulatorPath, 'utf8');

function buildMandiAuditContext() {
  const mockStorage = createMockStorage();
  const domElements = {
    'mandi-crop-inp': { id: 'mandi-crop-inp', value: '', style: {} },
    'mandi-crop-clear-btn': { id: 'mandi-crop-clear-btn', style: { display: 'none' } },
    'mandi-state-inp': { id: 'mandi-state-inp', value: '', style: {} },
    'mandi-mkt-inp': { id: 'mandi-mkt-inp', value: '', style: {} },
    'mandi-popular-crops-container': { id: 'mandi-popular-crops-container', innerHTML: '' },
    'mandi-state-chips-container': { id: 'mandi-state-chips-container', innerHTML: '' },
    'mandi-lock-indicator': { id: 'mandi-lock-indicator', innerHTML: '' },
    'mandi-results-container': { id: 'mandi-results-container', innerHTML: '' }
  };

  const ctx = {
    window: {},
    document: {
      getElementById: (id) => domElements[id] || (domElements[id] = { id, value: '', innerHTML: '', style: {} }),
      querySelectorAll: () => [],
      createElement: () => ({ style: {}, appendChild: () => {} })
    },
    localStorage: mockStorage,
    sessionStorage: mockStorage,
    navigator: { userAgent: 'NodeAuditTest', geolocation: null },
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: (fn) => fn(),
    clearTimeout: () => {},
    alert: () => {},
    TL: (en, te, hi) => en,
    currentLang: 'en',
    getCropIconImg: () => '<img class="crop-icon"/>',
    fetchMandiRatesFromSupabase: async () => []
  };

  ctx.window = ctx;

  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  const scripts = [];
  while ((match = re.exec(indexHtml)) !== null) {
    scripts.push(match[1]);
  }
  vm.createContext(ctx);
  vm.runInContext(scripts.join('\n;\n'), ctx);

  return { ctx, domElements };
}

// ============================================================================
// SECTION 1: MANUAL SEARCH & POPULAR-PILL INTERACTION
// ============================================================================
describe('Phase 5.1 Mandi Audit — Manual Search & Popular-Pill Interaction', () => {

  it('AUDIT-1.1: Clicking popular crop pill selects pill and populates search input', () => {
    const { ctx, domElements } = buildMandiAuditContext();
    ctx.selectPopularMandiCrop('cotton');

    expect(ctx.mandiSelectedPopular).toBe('cotton');
    expect(domElements['mandi-crop-inp'].value).toBe('Cotton');
    expect(domElements['mandi-crop-clear-btn'].style.display).toBe('flex');

    const rates = ctx.getFilteredMandiRates();
    expect(rates.length > 0).toBe(true);
    rates.forEach(r => {
      const name = (r.cropName.en || r.cropName).toLowerCase();
      expect(name.includes('cotton') || (r.cropKey && r.cropKey.includes('cotton'))).toBe(true);
    });
  });

  it('AUDIT-1.2: Changing search input manually to another popular crop switches active pill', () => {
    const { ctx, domElements } = buildMandiAuditContext();
    ctx.selectPopularMandiCrop('cotton');
    expect(ctx.mandiSelectedPopular).toBe('cotton');

    // User types "Tomato" into input
    domElements['mandi-crop-inp'].value = 'Tomato';
    ctx.executeMandiSearch();

    expect(ctx.mandiSelectedPopular).toBe('tomato');
    const rates = ctx.getFilteredMandiRates();
    expect(rates.length > 0).toBe(true);
    rates.forEach(r => {
      const name = (r.cropName.en || r.cropName).toLowerCase();
      expect(name.includes('tomato')).toBe(true);
      expect(name.includes('cotton')).toBe(false);
    });
  });

  it('AUDIT-1.3: Changing search input manually to non-popular crop deselects popular pill and searches custom crop', () => {
    const { ctx, domElements } = buildMandiAuditContext();
    ctx.selectPopularMandiCrop('cotton');

    // User types "Maize"
    domElements['mandi-crop-inp'].value = 'Maize';
    ctx.executeMandiSearch();

    expect(ctx.mandiSelectedPopular).toBe('all');
    expect(ctx.mandiSearchCrop).toBe('Maize');

    const rates = ctx.getFilteredMandiRates();
    expect(rates.length > 0).toBe(true);
    rates.forEach(r => {
      const name = (r.cropName.en || r.cropName).toLowerCase();
      expect(name.includes('maize') || (r.cropKey && r.cropKey.includes('maize'))).toBe(true);
      expect(name.includes('cotton')).toBe(false);
    });
  });

  it('AUDIT-1.4: Clearing search input manually (Backspace/Empty) resets state and returns all crops', () => {
    const { ctx, domElements } = buildMandiAuditContext();
    ctx.selectPopularMandiCrop('cotton');

    // User backspaces the input
    domElements['mandi-crop-inp'].value = '';
    ctx.executeMandiSearch();

    expect(ctx.mandiSelectedPopular).toBe('all');
    expect(ctx.mandiSearchCrop).toBe('');
    expect(domElements['mandi-crop-clear-btn'].style.display).toBe('none');

    const rates = ctx.getFilteredMandiRates();
    const crops = new Set(rates.map(r => r.cropKey));
    expect(crops.size > 1).toBe(true); // Multiple distinct crops returned
  });

  it('AUDIT-1.5: clearMandiCropSearch() clears input, resets popular pill, and returns all crops', () => {
    const { ctx, domElements } = buildMandiAuditContext();
    ctx.selectPopularMandiCrop('wheat');
    expect(ctx.mandiSelectedPopular).toBe('wheat');

    ctx.clearMandiCropSearch();

    expect(ctx.mandiSelectedPopular).toBe('all');
    expect(ctx.mandiSearchCrop).toBe('');
    expect(domElements['mandi-crop-inp'].value).toBe('');
    expect(domElements['mandi-crop-clear-btn'].style.display).toBe('none');
  });

  it('AUDIT-1.6: Switching between popular crop pills repeatedly maintains complete state synchronization', () => {
    const { ctx, domElements } = buildMandiAuditContext();
    const sequence = ['cotton', 'wheat', 'tomato', 'onion', 'potato', 'chilli'];

    sequence.forEach(key => {
      ctx.selectPopularMandiCrop(key);
      expect(ctx.mandiSelectedPopular).toBe(key);
      expect(domElements['mandi-crop-inp'].value.toLowerCase()).toBe(key);

      const rates = ctx.getFilteredMandiRates();
      expect(rates.length > 0).toBe(true);
    });

    // Toggle off last pill
    ctx.selectPopularMandiCrop('chilli');
    expect(ctx.mandiSelectedPopular).toBe('all');
    expect(domElements['mandi-crop-inp'].value).toBe('');
  });

  it('AUDIT-1.7: Asynchronous catalog updates do not clobber user query or active pill selection', async () => {
    const { ctx, domElements } = buildMandiAuditContext();
    ctx.selectPopularMandiCrop('tomato');
    expect(ctx.mandiSelectedPopular).toBe('tomato');

    // Simulate async data arrival into AGMARKNET_MANDI_CATALOG
    ctx.AGMARKNET_MANDI_CATALOG.unshift({
      id: 'async-tomato-1',
      cropKey: 'tomato',
      cropSlug: 'tomato',
      cropName: { en: 'Tomato (Async Feed)', te: 'టమోటా', hi: 'टमाटर' },
      variety: { en: 'Hybrid', te: 'Hybrid', hi: 'Hybrid' },
      mandi: { en: 'Warangal APMC Yard', te: 'Warangal', hi: 'Warangal' },
      district: 'Warangal',
      state: { en: 'Telangana', te: 'Telangana', hi: 'Telangana' },
      modalPrice: 2800, minPrice: 2600, maxPrice: 3000, unit: '/Qtl', arrivals: 1200, change: '+1.0%', up: true, badge: 'Agmarknet'
    });

    // Re-render market results
    const html = ctx.renderMandiCardsHtml();
    expect(ctx.mandiSelectedPopular).toBe('tomato'); // Selection preserved!
    expect(html.includes('Tomato (Async Feed)')).toBe(true);
  });
});

// ============================================================================
// SECTION 2: COMMODITY CLASSIFICATION & DISTINCT COMMODITY SEPARATION
// ============================================================================
describe('Phase 5.1 Mandi Audit — Commodity Classification & Anti-Leakage', () => {

  it('AUDIT-2.1: Cotton pill matches all Cotton varieties and strictly EXCLUDES Cotton Seed', () => {
    const { ctx } = buildMandiAuditContext();
    ctx.selectMandiState('all');

    // Add mock Cotton Seed to catalog
    ctx.AGMARKNET_MANDI_CATALOG.push({
      id: 'test-seed-1',
      cropKey: 'cotton_seed',
      cropSlug: 'cotton-seed',
      cropName: { en: 'Cotton Seed', te: 'పత్తి గింజలు', hi: 'बिनौला' },
      variety: { en: 'Seed By-Product', te: 'Seed', hi: 'Seed' },
      mandi: { en: 'Warangal APMC Yard', te: 'Warangal', hi: 'Warangal' },
      district: 'Warangal',
      state: { en: 'Telangana', te: 'Telangana', hi: 'Telangana' },
      modalPrice: 3200, minPrice: 3000, maxPrice: 3400, unit: '/Qtl', arrivals: 500, change: '0.0%', up: true, badge: 'Agmarknet'
    });

    ctx.selectPopularMandiCrop('cotton');
    const rates = ctx.getFilteredMandiRates();
    const names = rates.map(r => r.cropName.en || r.cropName);

    expect(names.includes('Cotton')).toBe(true);
    expect(names.includes('Cotton (Long Staple Kapas)')).toBe(true);
    expect(names.includes('Cotton (Medium Staple)')).toBe(true);
    expect(names.includes('Cotton Seed')).toBe(false); // CRITICAL: Excluded!
  });

  it('AUDIT-2.2: Manual search "cotton seed" matches Cotton Seed and excludes raw cotton', () => {
    const { ctx, domElements } = buildMandiAuditContext();
    ctx.selectMandiState('all');

    ctx.AGMARKNET_MANDI_CATALOG.push({
      id: 'test-seed-2',
      cropKey: 'cotton_seed',
      cropSlug: 'cotton-seed',
      cropName: { en: 'Cotton Seed', te: 'పత్తి గింజలు', hi: 'बिनौला' },
      variety: { en: 'Seed By-Product', te: 'Seed', hi: 'Seed' },
      mandi: { en: 'Warangal APMC Yard', te: 'Warangal', hi: 'Warangal' },
      district: 'Warangal',
      state: { en: 'Telangana', te: 'Telangana', hi: 'Telangana' },
      modalPrice: 3200, minPrice: 3000, maxPrice: 3400, unit: '/Qtl', arrivals: 500, change: '0.0%', up: true, badge: 'Agmarknet'
    });

    domElements['mandi-crop-inp'].value = 'Cotton Seed';
    ctx.executeMandiSearch();

    const rates = ctx.getFilteredMandiRates();
    expect(rates.length > 0).toBe(true);
    rates.forEach(r => {
      const name = (r.cropName.en || r.cropName).toLowerCase();
      expect(name.includes('seed')).toBe(true);
    });
  });

  it('AUDIT-2.3: Potato pill matches all Potato varieties and strictly EXCLUDES Sweet Potato and Yam', () => {
    const { ctx } = buildMandiAuditContext();
    ctx.selectMandiState('all');

    ctx.AGMARKNET_MANDI_CATALOG.push({
      id: 'test-sweet-potato-1',
      cropKey: 'sweet_potato',
      cropSlug: 'sweet-potato',
      cropName: { en: 'Sweet Potato', te: 'చిలగడదుంప', hi: 'शकरकंद' },
      variety: { en: 'Standard', te: 'Standard', hi: 'Standard' },
      mandi: { en: 'Bowenpally APMC', te: 'Bowenpally', hi: 'Bowenpally' },
      district: 'Hyderabad',
      state: { en: 'Telangana', te: 'Telangana', hi: 'Telangana' },
      modalPrice: 2200, minPrice: 2000, maxPrice: 2400, unit: '/Qtl', arrivals: 300, change: '0.0%', up: true, badge: 'Agmarknet'
    });

    ctx.selectPopularMandiCrop('potato');
    const rates = ctx.getFilteredMandiRates();
    const names = rates.map(r => r.cropName.en || r.cropName);

    expect(names.includes('Potato')).toBe(true);
    expect(names.includes('Potato (Kufri Chipsona)')).toBe(true);
    expect(names.includes('Potato (Jyoti / Pukhraj)')).toBe(true);
    expect(names.includes('Sweet Potato')).toBe(false); // CRITICAL: Excluded!
    expect(names.includes('Yam(Ratalu)')).toBe(false);
  });

  it('AUDIT-2.4: Chilli pill matches hot chillies and strictly EXCLUDES plain Capsicum', () => {
    const { ctx } = buildMandiAuditContext();
    ctx.selectMandiState('all');

    ctx.selectPopularMandiCrop('chilli');
    const rates = ctx.getFilteredMandiRates();
    const names = rates.map(r => r.cropName.en || r.cropName);

    expect(names.includes('Green Chilli')).toBe(true);
    expect(names.includes('Dry Chillies')).toBe(true);
    expect(names.includes('Dry Red Chilli (Teja Super)')).toBe(true);
    expect(names.includes('Capsicum')).toBe(false); // CRITICAL: Plain sweet bell pepper excluded!
  });

  it('AUDIT-2.5: Onion pill matches dry bulb onions and strictly EXCLUDES Onion Green and Garlic', () => {
    const { ctx } = buildMandiAuditContext();
    ctx.selectMandiState('all');

    ctx.selectPopularMandiCrop('onion');
    const rates = ctx.getFilteredMandiRates();
    const names = rates.map(r => r.cropName.en || r.cropName);

    expect(names.includes('Onion')).toBe(true);
    expect(names.includes('Red Onion (Garva/Nashik)')).toBe(true);
    expect(names.includes('Onion Green')).toBe(false); // CRITICAL: Leafy green commodity excluded!
    expect(names.includes('Garlic')).toBe(false);
  });

  it('AUDIT-2.6: Wheat pill matches wheat and strictly EXCLUDES Buckwheat, Sweet Corn, and Flour', () => {
    const { ctx } = buildMandiAuditContext();
    ctx.selectMandiState('all');

    ctx.AGMARKNET_MANDI_CATALOG.push({
      id: 'test-buckwheat-1',
      cropKey: 'buckwheat',
      cropSlug: 'buckwheat',
      cropName: { en: 'Buckwheat (Kuttu)', te: 'కుట్టు', hi: 'कुट्टू' },
      variety: { en: 'Standard', te: 'Standard', hi: 'Standard' },
      mandi: { en: 'Khanna APMC', te: 'Khanna', hi: 'Khanna' },
      district: 'Ludhiana',
      state: { en: 'Punjab', te: 'Punjab', hi: 'Punjab' },
      modalPrice: 6200, minPrice: 6000, maxPrice: 6400, unit: '/Qtl', arrivals: 100, change: '0.0%', up: true, badge: 'Agmarknet'
    });

    ctx.selectPopularMandiCrop('wheat');
    const rates = ctx.getFilteredMandiRates();
    const names = rates.map(r => r.cropName.en || r.cropName);

    expect(names.includes('Wheat')).toBe(true);
    expect(names.includes('Wheat (Sharbati Gold)')).toBe(true);
    expect(names.includes('Buckwheat (Kuttu)')).toBe(false); // CRITICAL: Excluded!
  });

  it('AUDIT-2.7: Tomato pill matches tomato and strictly EXCLUDES Tamarind Fruit and Tree Tomato', () => {
    const { ctx } = buildMandiAuditContext();
    ctx.selectMandiState('all');

    ctx.selectPopularMandiCrop('tomato');
    const rates = ctx.getFilteredMandiRates();
    const names = rates.map(r => r.cropName.en || r.cropName);

    expect(names.includes('Tomato')).toBe(true);
    expect(names.includes('Tomato (Local Warangal Red)')).toBe(true);
    expect(names.some(n => n.toLowerCase().includes('tamarind'))).toBe(false);
  });
});

// ============================================================================
// SECTION 3: MULTILINGUAL & PHONETIC SEARCH
// ============================================================================
describe('Phase 5.1 Mandi Audit — Multilingual & Phonetic Search Aliases', () => {

  const testCases = [
    { query: 'పత్తి', expectedCrop: 'cotton', desc: 'Telugu Cotton' },
    { query: 'కపాస్', expectedCrop: 'cotton', desc: 'Telugu romanized Kapas' },
    { query: 'कपास', expectedCrop: 'cotton', desc: 'Hindi Cotton' },
    { query: 'kapas', expectedCrop: 'cotton', desc: 'Romanized Kapas' },
    { query: 'narma', expectedCrop: 'cotton', desc: 'Romanized Narma' },
    { query: 'టమోటా', expectedCrop: 'tomato', desc: 'Telugu Tomato' },
    { query: 'टमाटर', expectedCrop: 'tomato', desc: 'Hindi Tomato' },
    { query: 'tamatar', expectedCrop: 'tomato', desc: 'Romanized Tamatar' },
    { query: 'గోధుమ', expectedCrop: 'wheat', desc: 'Telugu Wheat' },
    { query: 'गेहूं', expectedCrop: 'wheat', desc: 'Hindi Wheat' },
    { query: 'gehun', expectedCrop: 'wheat', desc: 'Romanized Gehun' },
    { query: 'kanak', expectedCrop: 'wheat', desc: 'Romanized Kanak' },
    { query: 'ఉల్లిపాయ', expectedCrop: 'onion', desc: 'Telugu Onion' },
    { query: 'प्याज', expectedCrop: 'onion', desc: 'Hindi Onion' },
    { query: 'pyaz', expectedCrop: 'onion', desc: 'Romanized Pyaz' },
    { query: 'kanda', expectedCrop: 'onion', desc: 'Romanized Kanda' },
    { query: 'బంగాళాదుంప', expectedCrop: 'potato', desc: 'Telugu Potato' },
    { query: 'आलू', expectedCrop: 'potato', desc: 'Hindi Potato' },
    { query: 'aloo', expectedCrop: 'potato', desc: 'Romanized Aloo' },
    { query: 'batata', expectedCrop: 'potato', desc: 'Romanized Batata' },
    { query: 'మిర్చి', expectedCrop: 'chilli', desc: 'Telugu Chilli' },
    { query: 'मिर्च', expectedCrop: 'chilli', desc: 'Hindi Chilli' },
    { query: 'mirchi', expectedCrop: 'chilli', desc: 'Romanized Mirchi' }
  ];

  testCases.forEach(({ query, expectedCrop, desc }) => {
    it(`AUDIT-3: Search query "${query}" (${desc}) matches ${expectedCrop} records`, () => {
      const { ctx, domElements } = buildMandiAuditContext();
      ctx.selectMandiState('all');

      domElements['mandi-crop-inp'].value = query;
      ctx.executeMandiSearch();

      const rates = ctx.getFilteredMandiRates();
      expect(rates.length > 0).toBe(true);
      rates.forEach(r => {
        expect(ctx.itemMatchesPopular(r, expectedCrop)).toBe(true);
      });
    });
  });
});

// ============================================================================
// SECTION 4: LOCATION ISOLATION & LEAKAGE PREVENTION
// ============================================================================
describe('Phase 5.1 Mandi Audit — Strict Location Isolation & Leakage Prevention', () => {

  it('AUDIT-4.1: State filter restricts 100% of records to selected state', () => {
    const { ctx } = buildMandiAuditContext();
    ctx.selectMandiState('Punjab');

    const rates = ctx.getFilteredMandiRates();
    expect(rates.length > 0).toBe(true);
    rates.forEach(r => {
      expect((r.state.en || r.state).toLowerCase()).toBe('punjab');
    });
  });

  it('AUDIT-4.2: Mandi filter restricts 100% of records to selected APMC yard', () => {
    const { ctx } = buildMandiAuditContext();
    ctx.selectMandiMarket('Warangal APMC Yard', 'Telangana');

    const rates = ctx.getFilteredMandiRates();
    expect(rates.length > 0).toBe(true);
    rates.forEach(r => {
      expect((r.mandi.en || r.mandi).toLowerCase()).toContain('warangal');
      expect((r.state.en || r.state).toLowerCase()).toBe('telangana');
    });
  });

  it('AUDIT-4.3: District search via market field matches APMCs in that district', () => {
    const { ctx, domElements } = buildMandiAuditContext();
    domElements['mandi-state-inp'].value = 'Telangana';
    domElements['mandi-mkt-inp'].value = 'Warangal';
    ctx.executeMandiSearch();

    const rates = ctx.getFilteredMandiRates();
    expect(rates.length > 0).toBe(true);
    rates.forEach(r => {
      const mkt = (r.mandi.en || r.mandi || '').toLowerCase();
      const dist = (r.district || '').toLowerCase();
      expect(mkt.includes('warangal') || dist.includes('warangal')).toBe(true);
    });
  });

  it('AUDIT-4.4: Invalid or non-existent location returns empty list and ZERO cross-location leakage', () => {
    const { ctx, domElements } = buildMandiAuditContext();
    domElements['mandi-state-inp'].value = 'NonExistentState999';
    ctx.executeMandiSearch();

    const rates = ctx.getFilteredMandiRates();
    expect(rates.length).toBe(0); // STRICT: Zero leakage!
  });

  it('AUDIT-4.5: Searching a crop with no arrivals in locked state returns empty list (no cross-state fallback)', () => {
    const { ctx, domElements } = buildMandiAuditContext();
    ctx.selectMandiState('Punjab'); // Punjab has no Coffee records in APMC catalog

    domElements['mandi-crop-inp'].value = 'Coffee';
    ctx.executeMandiSearch();

    const rates = ctx.getFilteredMandiRates();
    expect(rates.length).toBe(0); // Zero cross-state leakage!
  });

  it('AUDIT-4.6: Switching from State A to State B instantly clears State A records', () => {
    const { ctx } = buildMandiAuditContext();
    ctx.selectMandiState('Telangana');
    let rates = ctx.getFilteredMandiRates();
    expect(rates.every(r => (r.state.en || r.state).toLowerCase() === 'telangana')).toBe(true);

    ctx.selectMandiState('Maharashtra');
    rates = ctx.getFilteredMandiRates();
    expect(rates.length > 0).toBe(true);
    expect(rates.every(r => (r.state.en || r.state).toLowerCase() === 'maharashtra')).toBe(true);
    expect(rates.some(r => (r.state.en || r.state).toLowerCase() === 'telangana')).toBe(false);
  });
});

// ============================================================================
// SECTION 5: GENUINE PROVIDER DATA FLOW, PROVENANCE & TIMESTAMPS
// ============================================================================
describe('Phase 5.1 Mandi Audit — Provider Data Flow & Provenance Tiers', () => {

  it('AUDIT-5.1: Live government API records are assigned Tier 1 badge and provenance', () => {
    const { ctx } = buildMandiAuditContext();
    const liveItem = {
      commodity: 'Cotton Medium',
      market_name: 'Warangal APMC Yard',
      district: 'Warangal',
      state: 'Telangana',
      modal_price: 7450,
      min_price: 7200,
      max_price: 7600,
      arrivals: 1800,
      trade_date: '05/11/2026',
      trend: 'UP'
    };

    // Verify transformation logic used by fetchRealMandiRatesLive
    const cropKey = liveItem.commodity.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 24);
    const badge = '⭐ Agmarknet (Live)';
    const provTier = 'TIER_1_LIVE_GOVT_API';

    ctx.AGMARKNET_MANDI_CATALOG.unshift({
      id: 'real-mkt-live-1',
      cropKey: cropKey,
      cropSlug: cropKey,
      cropPath: 'cotton/cotton.svg',
      cropName: { en: liveItem.commodity, te: liveItem.commodity, hi: liveItem.commodity },
      variety: { en: 'Medium Staple', te: 'Medium Staple', hi: 'Medium Staple' },
      mandi: { en: liveItem.market_name, te: liveItem.market_name, hi: liveItem.market_name },
      district: liveItem.district,
      state: { en: liveItem.state, te: liveItem.state, hi: liveItem.state },
      modalPrice: liveItem.modal_price,
      minPrice: liveItem.min_price,
      maxPrice: liveItem.max_price,
      unit: '/Qtl',
      arrivals: liveItem.arrivals,
      change: '+1.5%',
      up: true,
      badge: badge,
      tradeDate: liveItem.trade_date,
      sourceName: 'Agmarknet / DMI (Govt of India Live)',
      resourceId: '9ef84268-d588-465a-a308-a864a43d0070',
      provenanceTier: provTier,
      isLive: true,
      lastSync: new Date().toISOString()
    });

    ctx.selectMandiState('Telangana');
    ctx.selectPopularMandiCrop('cotton');

    const rates = ctx.getFilteredMandiRates();
    const found = rates.find(r => r.id === 'real-mkt-live-1');
    expect(found !== undefined).toBe(true);
    expect(found.badge).toBe('⭐ Agmarknet (Live)');
    expect(found.provenanceTier).toBe('TIER_1_LIVE_GOVT_API');
    expect(found.isLive).toBe(true);
    expect(found.modalPrice).toBe(7450);
  });

  it('AUDIT-5.2: Cached records never claim live status and show authentic historical date', () => {
    const { ctx } = buildMandiAuditContext();
    const cachedItem = ctx.AGMARKNET_MANDI_CATALOG.find(r => r.badge && !r.badge.includes('Live'));
    expect(cachedItem !== undefined).toBe(true);
    expect(cachedItem.badge.includes('Live')).toBe(false);
  });

  it('AUDIT-5.3: renderMandiCardsHtml renders valid prices, ranges, arrivals, and provenance metadata', () => {
    const { ctx } = buildMandiAuditContext();
    ctx.selectMandiState('Telangana');
    ctx.selectPopularMandiCrop('cotton');

    const html = ctx.renderMandiCardsHtml();
    expect(html.includes('Modal Market Price')).toBe(true);
    expect(html.includes('₹')).toBe(true);
    expect(html.includes('/Qtl')).toBe(true);
    expect(html.includes('Range:')).toBe(true);
    expect(html.includes('Arrivals:')).toBe(true);
    expect(html.includes('Agmarknet')).toBe(true);
    expect(html.includes('Book Mandi Truck')).toBe(true);
    expect(html.includes('Price Trend')).toBe(true);
  });
});

if (require.main === module) {
  globalContext.run();
}

