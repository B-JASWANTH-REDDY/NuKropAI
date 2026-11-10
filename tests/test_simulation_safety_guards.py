"""
NuKropAI — Automated Verification of Fail-Closed Simulation Safety Guards
Phase 12.1 Hardened Test Suite.

Verifies strict target allowlisting:
- The production Supabase project (yxjqseiegwjdfnccdchk) is NEVER reachable.
- Only approved isolated *.supabase.co projects (with matching project ref) or local loopback instances are accepted.
- Arbitrary external domains, custom proxies, URL/ref mismatches, and generic fallbacks are rejected.
- Zero network requests occur on failure, and automatic redirects are strictly blocked.

All tests run strictly locally with ZERO network calls.
"""
import os
import sys
import unittest
from unittest.mock import patch, MagicMock
import subprocess
import urllib.error

from simulations.mirofish_adapter.target_validator import (
    validate_simulation_target,
    extract_project_ref,
    ProductionTargetSafetyError,
    TargetConfigurationError,
    PRODUCTION_PROJECT_REF,
)
from simulations.mirofish_adapter.agent_bridge import (
    NuKropAIAgentBridge,
    SafeNoRedirectHandler,
)

K6_BINARY = r"C:\Program Files\k6\k6.exe"
K6_SCRIPT = os.path.abspath("simulations/k6/haul_dispatch_load.js")

class TestSimulationSafetyGuards(unittest.TestCase):
    """Rigorous offline safety verification for simulation and load-testing guards."""

    # ── TEST 1: PRODUCTION SUPABASE URL REJECTED ──
    def test_01_production_url_rejected(self):
        """Verify that the production Supabase URL is strictly rejected."""
        prod_urls = [
            "https://yxjqseiegwjdfnccdchk.supabase.co",
            "http://yxjqseiegwjdfnccdchk.supabase.co",
            "https://yxjqseiegwjdfnccdchk.supabase.co/rest/v1",
        ]
        for url in prod_urls:
            with self.subTest(url=url):
                with self.assertRaises(ProductionTargetSafetyError) as ctx:
                    validate_simulation_target(url=url, project_ref="yxjqseiegwjdfnccdchk", anon_key="test-key-12345", env={})
                self.assertIn("CRITICAL", str(ctx.exception))
                self.assertIn(PRODUCTION_PROJECT_REF, str(ctx.exception))

    # ── TEST 2: PRODUCTION REFERENCE REJECTED ──
    def test_02_production_project_reference_rejected(self):
        """Verify that any target containing or referencing the production project is rejected."""
        ref_targets = [
            (f"https://{PRODUCTION_PROJECT_REF}.supabase.co", PRODUCTION_PROJECT_REF),
            (f"https://custom-proxy.internal/{PRODUCTION_PROJECT_REF}", PRODUCTION_PROJECT_REF),
            ("https://isolated-test.supabase.co", PRODUCTION_PROJECT_REF),
        ]
        for url, ref in ref_targets:
            with self.subTest(url=url, ref=ref):
                with self.assertRaises(ProductionTargetSafetyError) as ctx:
                    validate_simulation_target(url=url, project_ref=ref, anon_key="test-key-12345", env={})
                self.assertIn(PRODUCTION_PROJECT_REF, str(ctx.exception))

    # ── TEST 3: LEGACY BYPASS FLAGS CANNOT BYPASS PROTECTION ──
    def test_03_legacy_bypass_flags_cannot_bypass_protection(self):
        """Verify that legacy bypass flags cannot bypass the production safety block."""
        bypass_envs = [
            {"NUKROPAI_ALLOW_SIMULATION": "true"},
            {"NUKROPAI_ALLOW_SIMULATION": "1"},
            {"NUKROPAI_FORCE_PRODUCTION_TEST": "true"},
            {"NUKROPAI_FORCE_PRODUCTION_TEST": "1"},
            {"FORCE_PRODUCTION": "true"},
            {"ALLOW_PRODUCTION_TEST": "true"},
            {"NUKROPAI_ENV": "staging"},
            {"NUKROPAI_ENV": "test"},
            {"NUKROPAI_ENV": "simulation"},
            {
                "NUKROPAI_ALLOW_SIMULATION": "true",
                "NUKROPAI_FORCE_PRODUCTION_TEST": "true",
                "NUKROPAI_ENV": "production",
            },
        ]
        prod_url = f"https://{PRODUCTION_PROJECT_REF}.supabase.co"
        for env in bypass_envs:
            with self.subTest(env=env):
                with self.assertRaises(ProductionTargetSafetyError) as ctx:
                    validate_simulation_target(url=prod_url, project_ref=PRODUCTION_PROJECT_REF, anon_key="test-key", env=env)
                self.assertIn("must NEVER be targeted", str(ctx.exception))

    # ── TEST 4: MISSING TEST URL REJECTED ──
    def test_04_missing_test_url_rejected(self):
        """Verify that empty, None, or whitespace-only target URLs are rejected."""
        missing_inputs = [None, "", "   ", "\t\n"]
        for missing in missing_inputs:
            with self.subTest(missing=repr(missing)):
                with self.assertRaises(TargetConfigurationError) as ctx:
                    validate_simulation_target(url=missing, project_ref="test-ref", anon_key="test-key", env={})
                self.assertIn("missing or empty", str(ctx.exception))

    # ── TEST 5: INVALID URL REJECTED ──
    def test_05_invalid_url_rejected(self):
        """Verify that malformed or non-http/https URLs are rejected."""
        invalid_urls = [
            "ftp://test-project.supabase.co",
            "ws://test-project.supabase.co",
            "not-a-url",
            "http://",
            "https://",
            "relative/path/test",
            "://missing-scheme.com",
        ]
        for url in invalid_urls:
            with self.subTest(url=url):
                with self.assertRaises(TargetConfigurationError) as ctx:
                    validate_simulation_target(url=url, project_ref="test-project", anon_key="test-key", env={})
                msg = str(ctx.exception)
                self.assertTrue("Invalid target URL format" in msg or "Malformed target URL" in msg)

    # ── TEST 6: ARBITRARY EXTERNAL HTTPS URL REJECTED ──
    def test_06_arbitrary_external_url_rejected(self):
        """Verify that arbitrary external domains are rejected by strict allowlisting."""
        external_urls = [
            "https://attacker.com",
            "https://example.com",
            "https://google.com",
            "https://api.mycompany.org",
            "https://evil-supabase.internal",
        ]
        for url in external_urls:
            with self.subTest(url=url):
                with self.assertRaises(TargetConfigurationError) as ctx:
                    validate_simulation_target(url=url, project_ref="test-ref", anon_key="test-key", env={})
                self.assertIn("not an authorized Supabase endpoint", str(ctx.exception))

    # ── TEST 7: CUSTOM PROXY URL REJECTED ──
    def test_07_custom_proxy_url_rejected(self):
        """Verify that custom proxy subpaths or non-root proxies are rejected."""
        proxy_urls = [
            "https://proxy.internal/supabase",
            "https://isolated-test-proj.supabase.co/custom-proxy",
            "http://localhost:54321/api/v1",
        ]
        for url in proxy_urls:
            with self.subTest(url=url):
                with self.assertRaises(TargetConfigurationError) as ctx:
                    validate_simulation_target(url=url, project_ref="isolated-test-proj", anon_key="test-key", env={})
                msg = str(ctx.exception)
                self.assertTrue("Custom proxy path" in msg or "not an authorized Supabase endpoint" in msg)

    # ── TEST 8: URL / PROJECT-REFERENCE MISMATCH REJECTED ──
    def test_08_url_project_ref_mismatch_rejected(self):
        """Verify that target URL hostname and expected project reference must agree exactly."""
        mismatches = [
            ("https://isolated-alpha.supabase.co", "isolated-beta"),
            ("https://test-sandbox-01.supabase.co", "test-sandbox-02"),
        ]
        for url, ref in mismatches:
            with self.subTest(url=url, ref=ref):
                with self.assertRaises(TargetConfigurationError) as ctx:
                    validate_simulation_target(url=url, project_ref=ref, anon_key="test-key", env={})
                self.assertIn("does not match expected TEST_SUPABASE_PROJECT_REF", str(ctx.exception))

    # ── TEST 9: LOCAL LOOPBACK SUPABASE ACCEPTED ──
    def test_09_local_loopback_supabase_accepted(self):
        """Verify that local loopback Supabase instances are authorized."""
        loopbacks = [
            ("http://localhost:54321", "localhost", "local_docker_supabase"),
            ("http://127.0.0.1:54321", "127.0.0.1", "local_docker_supabase"),
            ("https://127.0.0.1:8443", "127.0.0.1", "local_docker_supabase"),
        ]
        for url, exp_ref, exp_env in loopbacks:
            with self.subTest(url=url):
                sanitized_url, ref, env_label = validate_simulation_target(
                    url=url, project_ref=exp_ref, anon_key="local-test-key-54321", env={}
                )
                self.assertEqual(sanitized_url, url)
                self.assertEqual(ref, exp_ref)
                self.assertEqual(env_label, exp_env)

    # ── TEST 10: CORRECT ISOLATED SUPABASE TEST HOSTNAME ACCEPTED ──
    def test_10_correct_isolated_supabase_hostname_accepted(self):
        """Verify that approved isolated *.supabase.co projects with matching ref are accepted."""
        valid_targets = [
            ("https://isolated-test-proj.supabase.co", "isolated-test-proj", "isolated_test_project"),
            ("https://dev-sandbox-99.supabase.co", "dev-sandbox-99", "isolated_test_project"),
        ]
        for url, exp_ref, exp_env in valid_targets:
            with self.subTest(url=url):
                sanitized_url, ref, env_label = validate_simulation_target(
                    url=url, project_ref=exp_ref, anon_key="isolated-test-key-54321", env={}
                )
                self.assertEqual(sanitized_url, url)
                self.assertEqual(ref, exp_ref)
                self.assertEqual(env_label, exp_env)

    # ── TEST 11: GENERIC SUPABASE_URL FALLBACK REJECTED ──
    def test_11_generic_supabase_url_fallback_rejected(self):
        """Verify that generic SUPABASE_URL fallback is strictly blocked when TEST_SUPABASE_URL is missing."""
        env_with_generic_url = {"SUPABASE_URL": "https://isolated-test-proj.supabase.co"}
        with self.assertRaises(TargetConfigurationError) as ctx:
            validate_simulation_target(url=None, project_ref="isolated-test-proj", anon_key="key", env=env_with_generic_url)
        self.assertIn("Generic 'SUPABASE_URL' fallback is strictly prohibited", str(ctx.exception))

    # ── TEST 12: GENERIC SUPABASE_ANON_KEY FALLBACK REJECTED ──
    def test_12_generic_supabase_anon_key_fallback_rejected(self):
        """Verify that generic SUPABASE_ANON_KEY fallback is strictly blocked when TEST_SUPABASE_ANON_KEY is missing."""
        env_with_generic_key = {
            "TEST_SUPABASE_URL": "https://isolated-test-proj.supabase.co",
            "TEST_SUPABASE_PROJECT_REF": "isolated-test-proj",
            "SUPABASE_ANON_KEY": "some-generic-key",
        }
        with self.assertRaises(TargetConfigurationError) as ctx:
            validate_simulation_target(url=None, project_ref=None, anon_key=None, env=env_with_generic_key)
        self.assertIn("Generic 'SUPABASE_ANON_KEY' fallback is strictly prohibited", str(ctx.exception))

    # ── TEST 13: ZERO HTTP REQUESTS ON VALIDATION FAILURES ──
    @patch("urllib.request.urlopen")
    def test_13_no_http_request_when_validation_fails(self, mock_urlopen):
        """Verify zero network calls occur when target validation fails."""
        mock_urlopen.side_effect = AssertionError("NETWORK CALL DETECTED! Zero requests allowed on failure.")

        # Attempting to initialize bridge pointing to production
        with self.assertRaises(ProductionTargetSafetyError):
            NuKropAIAgentBridge(
                scenario_id="sim_safety_test",
                supabase_url=f"https://{PRODUCTION_PROJECT_REF}.supabase.co",
                project_ref=PRODUCTION_PROJECT_REF,
                anon_key="test-key",
            )
        mock_urlopen.assert_not_called()

        # Attempting to initialize bridge with arbitrary external domain
        with self.assertRaises(TargetConfigurationError):
            NuKropAIAgentBridge(
                scenario_id="sim_safety_test",
                supabase_url="https://attacker.com",
                project_ref="attacker",
                anon_key="test-key",
            )
        mock_urlopen.assert_not_called()

        # Attempting to initialize bridge with missing URL
        with self.assertRaises(TargetConfigurationError):
            NuKropAIAgentBridge(
                scenario_id="sim_safety_test",
                supabase_url="",
                project_ref="test",
                anon_key="test-key",
            )
        mock_urlopen.assert_not_called()

    # ── TEST 14: REDIRECT REJECTED OR SAFELY DISABLED ──
    def test_14_redirect_rejected_or_safely_disabled(self):
        """Verify that automatic HTTP redirects trigger ProductionTargetSafetyError fail-closed."""
        handler = SafeNoRedirectHandler()
        mock_req = MagicMock()
        with self.assertRaises(ProductionTargetSafetyError) as ctx:
            handler.redirect_request(
                req=mock_req, fp=None, code=302, msg="Found",
                headers={}, newurl=f"https://{PRODUCTION_PROJECT_REF}.supabase.co"
            )
        self.assertIn("Automatic redirects are strictly disabled", str(ctx.exception))

    # ── TEST 15: k6 SAFETY GUARD ABORT (OFFLINE EXECUTION) ──
    def test_15_k6_safety_guard_rejects_production_and_aborts(self):
        """Verify k6 fails closed and aborts execution when production is targeted or unconfigured."""
        if not os.path.exists(K6_BINARY):
            self.skipTest(f"k6 binary not found at {K6_BINARY}")

        # 1. k6 with default/missing env -> MUST fail
        proc_empty = subprocess.run(
            [K6_BINARY, "run", K6_SCRIPT],
            capture_output=True,
            text=True,
            env={**os.environ, "TEST_SUPABASE_URL": "", "SUPABASE_URL": ""},
        )
        self.assertNotEqual(proc_empty.returncode, 0)
        self.assertIn("Target Supabase URL is missing", proc_empty.stderr)

        # 2. k6 with production URL -> MUST fail closed
        proc_prod = subprocess.run(
            [K6_BINARY, "run", K6_SCRIPT],
            capture_output=True,
            text=True,
            env={
                **os.environ,
                "TEST_SUPABASE_URL": f"https://{PRODUCTION_PROJECT_REF}.supabase.co",
                "TEST_SUPABASE_PROJECT_REF": PRODUCTION_PROJECT_REF,
                "TEST_SUPABASE_ANON_KEY": "dummy-key",
            },
        )
        self.assertNotEqual(proc_prod.returncode, 0)
        self.assertIn("BASE_URL targets the production Supabase project", proc_prod.stderr)

        # 3. k6 with production URL and legacy bypass flag -> MUST STILL FAIL
        proc_bypass = subprocess.run(
            [K6_BINARY, "run", K6_SCRIPT],
            capture_output=True,
            text=True,
            env={
                **os.environ,
                "TEST_SUPABASE_URL": f"https://{PRODUCTION_PROJECT_REF}.supabase.co",
                "TEST_SUPABASE_PROJECT_REF": PRODUCTION_PROJECT_REF,
                "TEST_SUPABASE_ANON_KEY": "dummy-key",
                "NUKROPAI_FORCE_PRODUCTION_TEST": "true",
                "NUKROPAI_ALLOW_SIMULATION": "true",
            },
        )
        self.assertNotEqual(proc_bypass.returncode, 0)
        self.assertIn("All bypass flags have been permanently removed", proc_bypass.stderr)

if __name__ == "__main__":
    unittest.main(verbosity=2)
