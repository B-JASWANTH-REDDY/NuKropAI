/**
 * NuKropAI Agrarian OS — Opaque-Box Test Harness
 * Provides assertion library, test runner primitives, and mock domain environments.
 */

class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertionError';
  }
}

class TestContext {
  constructor() {
    this.suites = [];
    this.currentSuite = null;
    this.currentTest = null;
    this.stats = { total: 0, passed: 0, failed: 0, skipped: 0 };
    this.failures = [];
  }

  describe(suiteName, fn) {
    const suite = { name: suiteName, tests: [] };
    this.suites.push(suite);
    const prevSuite = this.currentSuite;
    this.currentSuite = suite;
    try {
      fn();
    } finally {
      this.currentSuite = prevSuite;
    }
  }

  it(testName, fn) {
    const test = { name: testName, fn, status: 'pending', error: null, duration: 0 };
    if (this.currentSuite) {
      this.currentSuite.tests.push(test);
    }
    this.stats.total++;
  }

  async run() {
    console.log('\n' + '='.repeat(80));
    console.log('🌱 NUKROPAI AGRARIAN OS — E2E PRODUCTION READINESS TEST RUNNER');
    console.log('='.repeat(80) + '\n');

    const startTime = Date.now();

    for (const suite of this.suites) {
      console.log(`\x1b[1m\x1b[36m▶ ${suite.name}\x1b[0m`);
      for (const test of suite.tests) {
        const testStart = Date.now();
        try {
          await test.fn();
          test.status = 'passed';
          test.duration = Date.now() - testStart;
          this.stats.passed++;
          console.log(`  \x1b[32m✔\x1b[0m ${test.name} \x1b[90m(${test.duration}ms)\x1b[0m`);
        } catch (err) {
          test.status = 'failed';
          test.error = err;
          test.duration = Date.now() - testStart;
          this.stats.failed++;
          this.failures.push({ suite: suite.name, test: test.name, error: err });
          console.log(`  \x1b[31m✖\x1b[0m ${test.name} \x1b[90m(${test.duration}ms)\x1b[0m`);
          console.log(`    \x1b[31mError: ${err.message}\x1b[0m`);
          if (err.stack) {
            const stackLines = err.stack.split('\n').slice(1, 4).join('\n');
            console.log(`    \x1b[90m${stackLines}\x1b[0m`);
          }
        }
      }
      console.log('');
    }

    const totalDuration = Date.now() - startTime;
    console.log('='.repeat(80));
    console.log('📊 TEST EXECUTION SUMMARY:');
    console.log(`  Total Tests:    ${this.stats.total}`);
    console.log(`  Passed:         \x1b[32m${this.stats.passed}\x1b[0m`);
    console.log(`  Failed:         \x1b[31m${this.stats.failed}\x1b[0m`);
    console.log(`  Total Duration: ${totalDuration}ms`);
    console.log('='.repeat(80) + '\n');

    if (this.failures.length > 0) {
      console.log('\x1b[31m❌ FAILURES DETECTED:\x1b[0m');
      this.failures.forEach((f, idx) => {
        console.log(`${idx + 1}) [${f.suite}] ${f.test}`);
        console.log(`   ${f.error.message}\n`);
      });
      return false;
    }

    console.log('\x1b[32m✨ ALL TESTS PASSED WITH 100% SUCCESS!\x1b[0m\n');
    return true;
  }
}

const globalContext = new TestContext();

function describe(suiteName, fn) {
  globalContext.describe(suiteName, fn);
}

function it(testName, fn) {
  globalContext.it(testName, fn);
}

function expect(actual) {
  const matchers = (isNot = false) => ({
    toBe(expected) {
      const pass = actual === expected;
      if (isNot ? pass : !pass) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} ${isNot ? 'not to be' : 'to be'} ${JSON.stringify(expected)}`);
      }
    },
    toEqual(expected) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      const pass = actualStr === expectedStr;
      if (isNot ? pass : !pass) {
        throw new AssertionError(`Expected equality: got ${actualStr}, expected ${isNot ? 'not ' : ''}${expectedStr}`);
      }
    },
    toBeTruthy() {
      const pass = Boolean(actual);
      if (isNot ? pass : !pass) {
        throw new AssertionError(`Expected ${actual} ${isNot ? 'not to be' : 'to be'} truthy`);
      }
    },
    toBeFalsy() {
      const pass = !Boolean(actual);
      if (isNot ? pass : !pass) {
        throw new AssertionError(`Expected ${actual} ${isNot ? 'not to be' : 'to be'} falsy`);
      }
    },
    toBeDefined() {
      const pass = actual !== undefined;
      if (isNot ? pass : !pass) {
        throw new AssertionError(`Expected value ${isNot ? 'not to be' : 'to be'} defined`);
      }
    },
    toBeNull() {
      const pass = actual === null;
      if (isNot ? pass : !pass) {
        throw new AssertionError(`Expected ${actual} ${isNot ? 'not to be' : 'to be'} null`);
      }
    },
    toContain(substrOrItem) {
      let pass = false;
      if (typeof actual === 'string' || Array.isArray(actual)) {
        pass = actual.includes(substrOrItem);
      } else if (actual && typeof actual === 'object') {
        pass = substrOrItem in actual;
      }
      if (isNot ? pass : !pass) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} ${isNot ? 'not to contain' : 'to contain'} ${JSON.stringify(substrOrItem)}`);
      }
    },
    toBeGreaterThan(value) {
      const pass = actual > value;
      if (isNot ? pass : !pass) {
        throw new AssertionError(`Expected ${actual} ${isNot ? 'not to be >' : 'to be >'} ${value}`);
      }
    },
    toBeLessThan(value) {
      const pass = actual < value;
      if (isNot ? pass : !pass) {
        throw new AssertionError(`Expected ${actual} ${isNot ? 'not to be <' : 'to be <'} ${value}`);
      }
    },
    toBeGreaterThanOrEqual(value) {
      const pass = actual >= value;
      if (isNot ? pass : !pass) {
        throw new AssertionError(`Expected ${actual} ${isNot ? 'not to be >=' : 'to be >='} ${value}`);
      }
    },
    toBeLessThanOrEqual(value) {
      const pass = actual <= value;
      if (isNot ? pass : !pass) {
        throw new AssertionError(`Expected ${actual} ${isNot ? 'not to be <=' : 'to be <='} ${value}`);
      }
    },
    toMatch(regex) {
      const pass = regex.test(String(actual));
      if (isNot ? pass : !pass) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} ${isNot ? 'not to match' : 'to match'} ${regex}`);
      }
    },
    toThrow(expectedErrorSubstr) {
      if (typeof actual !== 'function') {
        throw new AssertionError('expect(actual).toThrow requires actual to be a function');
      }
      let threw = false;
      let error = null;
      try {
        actual();
      } catch (e) {
        threw = true;
        error = e;
      }
      if (isNot ? threw : !threw) {
        throw new AssertionError(`Expected function ${isNot ? 'not to throw' : 'to throw'}, but it did ${threw ? 'throw: ' + error.message : 'not throw'}`);
      }
      if (threw && expectedErrorSubstr && !error.message.includes(expectedErrorSubstr)) {
        throw new AssertionError(`Expected thrown error message to contain "${expectedErrorSubstr}", got "${error.message}"`);
      }
    }
  });

  const res = matchers(false);
  res.not = matchers(true);
  return res;
}

/**
 * Mocking & Environment Simulators
 */

function createMockStorage(initialData = {}) {
  const store = { ...initialData };
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? String(store[key]) : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      for (const k in store) delete store[k];
    },
    dump() {
      return { ...store };
    }
  };
}

function createMockFetch(routes = {}) {
  const calls = [];
  const mock = async (url, options = {}) => {
    calls.push({ url, options, timestamp: Date.now() });
    
    // Check registered routes
    for (const [pattern, handler] of Object.entries(routes)) {
      if ((typeof pattern === 'string' && url.includes(pattern)) || 
          (pattern instanceof RegExp && pattern.test(url))) {
        return typeof handler === 'function' ? await handler(url, options) : handler;
      }
    }

    // Default mock response
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => ''
    };
  };

  mock.calls = calls;
  mock.getCalls = () => calls;
  mock.lastCall = () => calls[calls.length - 1];
  mock.reset = () => { calls.length = 0; };
  return mock;
}

module.exports = {
  describe,
  it,
  expect,
  globalContext,
  createMockStorage,
  createMockFetch
};
