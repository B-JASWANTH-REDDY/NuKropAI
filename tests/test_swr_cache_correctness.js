/**
 * ════════════════════════════════════════════════════════════════════════════
 * NUKROPAI SWR CACHE ISOLATION & LOGOUT PURGE VERIFICATION
 * ════════════════════════════════════════════════════════════════════════════
 */

const assert = require('assert');
const vm = require('vm');

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

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✔ [PASS] ${name}`);
    passCount++;
  } catch (err) {
    console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    failCount++;
  }
}

console.log('================================================================================');
console.log('⚡ NUKROPAI SWR CACHE ISOLATION, USER PARTITIONING & PURGE AUDIT');
console.log('================================================================================\n');

(async () => {
  const localStorageMock = (() => {
    let store = {};
    return {
      getItem: (k) => store[k] || null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { store = {}; },
      key: (i) => Object.keys(store)[i] || null,
      get length() { return Object.keys(store).length; },
      dump: () => ({ ...store })
    };
  })();

  const sandbox = {
    window: {},
    localStorage: localStorageMock,
    getCurrentUserId: () => 'farmer_123',
    authUserRole: 'farmer',
    console: console,
    Date: Date,
    Promise: Promise
  };
  vm.createContext(sandbox);

  const swrCode = `
    const NuKropSWR = {
      _cache: new Map(),
      _getUserScope() {
        try {
          const uid = (typeof getCurrentUserId === 'function' ? getCurrentUserId() : '') || 
                      localStorage.getItem('nukrop_user_uuid') || 
                      localStorage.getItem('nukrop_supabase_uid') || 
                      'anon';
          const role = (typeof authUserRole !== 'undefined' ? authUserRole : '') || 
                       localStorage.getItem('nukrop_user_role') || 
                       'farmer';
          return \`\${uid}_\${role}\`;
        } catch(e) {
          return 'anon_farmer';
        }
      },
      _resolveKey(key, isShared = false) {
        if (isShared) return \`shared_\${key}\`;
        return \`usr_\${this._getUserScope()}_\${key}\`;
      },
      get(key, fetcher, onFresh, ttlMs = 180000, isShared = false) {
        const scopedKey = this._resolveKey(key, isShared);
        let cached = this._cache.get(scopedKey);
        if (!cached) {
          try {
            const stored = localStorage.getItem('nk_swr_' + scopedKey);
            if (stored) cached = JSON.parse(stored);
          } catch(e) {}
        }
        const now = Date.now();
        const isStale = !cached || (now - (cached.timestamp || 0)) > ttlMs;

        if (cached && typeof onFresh === 'function') {
          try { onFresh(cached.data, true); } catch(err) { console.warn('SWR cached callback error:', err); }
        }

        if (typeof fetcher === 'function' && isStale) {
          Promise.resolve(fetcher()).then(freshData => {
            if (freshData !== undefined && freshData !== null) {
              const record = { data: freshData, timestamp: Date.now() };
              this._cache.set(scopedKey, record);
              try { localStorage.setItem('nk_swr_' + scopedKey, JSON.stringify(record)); } catch(e) {}
              if (typeof onFresh === 'function') {
                try { onFresh(freshData, false); } catch(err) { console.warn('SWR fresh callback error:', err); }
              }
            }
          }).catch(err => {
            console.warn('[NuKropSWR] Revalidation error for ' + key + ':', err && err.message);
          });
        }
        return cached ? cached.data : null;
      },
      invalidate(key, isShared = false) {
        const scopedKey = key ? this._resolveKey(key, isShared) : '';
        for (const k of this._cache.keys()) {
          if (!scopedKey || k.startsWith(scopedKey) || (key && k.includes(key))) this._cache.delete(k);
        }
        try {
          const toRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('nk_swr_' + scopedKey) || (key && k.includes(key)))) toRemove.push(k);
          }
          toRemove.forEach(k => localStorage.removeItem(k));
        } catch(e) {}
      },
      invalidateUserCache() {
        const userScope = this._getUserScope();
        for (const k of this._cache.keys()) {
          if (k.startsWith(\`usr_\${userScope}\`) || k.startsWith('usr_')) this._cache.delete(k);
        }
        try {
          const toRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith(\`nk_swr_usr_\${userScope}\`) || k.startsWith('nk_swr_usr_'))) toRemove.push(k);
          }
          toRemove.forEach(k => localStorage.removeItem(k));
        } catch(e) {}
      }
    };
    window.NuKropSWR = NuKropSWR;
  `;
  vm.runInContext(swrCode, sandbox);

  // Test 1: User A stores sensitive khata ledger
  await runAsyncTest('SWR-1: User A writes user-scoped cache entry', async () => {
    await vm.runInContext(`
      (async () => {
        await new Promise(resolve => {
          NuKropSWR.get('farm_khata', () => ({ entries: [{ id: 1, amount: 5000 }] }), (data, isStale) => {
            if (!isStale) resolve();
          });
        });
      })()
    `, sandbox);

    const store = localStorageMock.dump();
    const hasUserAKey = Object.keys(store).some(k => k.includes('farmer_123_farmer_farm_khata'));
    assert.ok(hasUserAKey, 'Must store cache entry with user and role scope');
  });

  // Test 2: Switch to User B (Farmer B) -> User A's data is strictly inaccessible
  await runAsyncTest('SWR-2: Multi-user isolation prevents Farmer B from reading Farmer A cache', async () => {
    sandbox.getCurrentUserId = () => 'farmer_999';
    const result = vm.runInContext(`NuKropSWR.get('farm_khata')`, sandbox);
    assert.strictEqual(result, null, 'Farmer B must receive null when querying Farmer A khata key');
  });

  // Test 3: Shared data accessible across users
  await runAsyncTest('SWR-3: Shared data (e.g. Mandi rates) accessible across multiple users', async () => {
    // Write shared data as Farmer B
    await vm.runInContext(`
      (async () => {
        await new Promise(resolve => {
          NuKropSWR.get('apmc_mandi_rates', () => ({ mandi: 'Warangal', rate: 7480 }), (data, isStale) => {
            if (!isStale) resolve();
          }, 180000, true);
        });
      })()
    `, sandbox);

    // Switch back to Farmer A
    sandbox.getCurrentUserId = () => 'farmer_123';
    const sharedData = vm.runInContext(`NuKropSWR.get('apmc_mandi_rates', null, null, 180000, true)`, sandbox);
    assert.ok(sharedData, 'Farmer A must access shared mandi data');
    assert.strictEqual(sharedData.rate, 7480);
  });

  // Test 4: Logout invalidation purges all user-scoped cache entries
  await runAsyncTest('SWR-4: Logout invalidation clears all user-scoped cache while keeping shared', async () => {
    vm.runInContext(`NuKropSWR.invalidateUserCache()`, sandbox);

    const store = localStorageMock.dump();
    const hasAnyUserScoped = Object.keys(store).some(k => k.startsWith('nk_swr_usr_'));
    assert.strictEqual(hasAnyUserScoped, false, 'All user-scoped keys must be purged on logout');

    const hasShared = Object.keys(store).some(k => k.includes('shared_apmc_mandi_rates'));
    assert.ok(hasShared, 'Public/shared data can persist safely');
  });

  // Test 5: Stale-while-revalidate returns stale with isStale=true, then fresh with isStale=false
  await runAsyncTest('SWR-5: Callbacks receive exact isStale boolean flag (never misleading)', async () => {
    const flagsReceived = [];
    sandbox.recordCallback = (data, isStale) => { flagsReceived.push(isStale); };

    // Prime cache with short TTL (1ms)
    await vm.runInContext(`
      (async () => {
        await new Promise(resolve => {
          NuKropSWR.get('weather_widget', () => ({ temp: 32 }), (data, isStale) => {
            recordCallback(data, isStale);
            if (!isStale) resolve();
          }, 1, true);
        });
      })()
    `, sandbox);

    // Wait 10ms so it becomes stale
    await new Promise(r => setTimeout(r, 10));

    // Request again: should trigger cached callback (isStale = true) followed by revalidated (isStale = false)
    await vm.runInContext(`
      (async () => {
        await new Promise(resolve => {
          let calledFresh = false;
          NuKropSWR.get('weather_widget', () => ({ temp: 33 }), (data, isStale) => {
            recordCallback(data, isStale);
            if (!isStale) resolve();
          }, 1, true);
        });
      })()
    `, sandbox);

    assert.ok(flagsReceived.includes(true), 'Must signal isStale: true on cached return');
    assert.ok(flagsReceived.includes(false), 'Must signal isStale: false on fresh background sync');
  });

  console.log('\n================================================================================');
  console.log(`📊 SWR CACHE AUDIT: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================================\n');

  if (failCount > 0) process.exit(1);
})();
