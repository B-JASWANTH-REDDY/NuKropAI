/**
 * NuKropAI Agrarian OS — Master E2E Test Suite Runner
 * Executes all 5 tiers of tests:
 * - Tier 0: Forensic Integrity & Anti-Facade Gate (app/src/main/assets/index.html & nukrop_emulator.html)
 * - Tier 1: Feature Coverage (R1, R2, R3, R4)
 * - Tier 2: Boundary & Corner Cases
 * - Tier 3: Cross-Feature Combinations (Pairwise)
 * - Tier 4: Real-World Scenarios (Farmer Lifecycle)
 */

const { globalContext } = require('./test_harness');

// Tier 0: Mandatory Forensic Integrity & Anti-Facade Gate
require('./tier0_forensic_integrity');

// Role Integrity & Multi-Role Anti-Loophole Verification Gate
require('./test_role_integrity_anti_loophole');

// Tier 1-4: Acceptance & Stress Suites
require('./tier1_feature_coverage');
require('./tier2_boundary_cases');
require('./tier3_cross_feature');
require('./tier4_real_world');

// Run the master suite
(async () => {
  try {
    const success = await globalContext.run();
    process.exit(success ? 0 : 1);
  } catch (err) {
    console.error('Fatal Test Runner Exception:', err);
    process.exit(1);
  }
})();
