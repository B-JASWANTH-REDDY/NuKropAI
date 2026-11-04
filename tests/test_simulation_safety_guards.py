"""
NuKropAI — Automated Verification of Fail-Closed Simulation Safety Guards
Verifies that the production Supabase project (yxjqseiegwjdfnccdchk) is NEVER
reachable under any circumstances, bypass flags, or environment combinations.

All tests run strictly locally with ZERO network calls.
"""
import os
import sys
import unittest
from unittest.mock import patch, MagicMock
import subprocess

from simulations.mirofish_adapter.target_validator import (
    validate_simulation_target,
    extract_project_ref,
    ProductionTargetSafetyError,
    TargetConfigurationError,
    PRODUCTION_PROJECT_REF,
)
from simulations.mirofish_adapter.agent_bridge import NuKropAIAgentBridge

K6_BINARY = r"C:\Program Files\k6\k6.exe"
K6_SCRIPT = os.path.abspath("simulations/k6/haul_dispatch_load.js")

class TestSimulationSafetyGuards(unittest.TestCase):
    """Rigorous offline safety verification for simulation and load-testing guards."""

    # ── TEST 1: PRODUCTION URL REJECTED ──
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
                    validate_simulation_target(url=url, anon_key="test-key-12345", env={})
                self.assertIn("CRITICAL", str(ctx.exception))
                self.assertIn(PRODUCTION_PROJECT_REF, str(ctx.exception))

    # ── TEST 2: PRODUCTION PROJECT REFERENCE REJECTED ──
    def test_02_production_project_reference_rejected(self):
        """Verify that any target containing the production project reference is rejected."""
        ref_targets = [
            f"https://{PRODUCTION_PROJECT_REF}.supabase.co",
            f"https://custom-proxy.internal/{PRODUCTION_PROJECT_REF}",
            f"http://subdomain.{PRODUCTION_PROJECT_REF}.io",
        ]
        for target in ref_targets:
            with self.subTest(target=target):
                with self.assertRaises(ProductionTargetSafetyError) as ctx:
                    validate_simulation_target(url=target, anon_key="test-key-12345", env={})
                self.assertIn(PRODUCTION_PROJECT_REF, str(ctx.exception))

    # ── TEST 3: PRODUCTION REJECTED EVEN WHEN LEGACY BYPASS FLAGS ARE SET ──
    def test_03_production_rejected_with_legacy_bypass_flags(self):
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
                    validate_simulation_target(url=prod_url, anon_key="test-key", env=env)
                self.assertIn("must NEVER be targeted", str(ctx.exception))

    # ── TEST 4: MISSING URL REJECTED ──
    def test_04_missing_url_rejected(self):
        """Verify that empty, None, or whitespace-only target URLs are rejected."""
        missing_inputs = [None, "", "   ", "\t\n"]
        for missing in missing_inputs:
            with self.subTest(missing=repr(missing)):
                with self.assertRaises(TargetConfigurationError) as ctx:
                    validate_simulation_target(url=missing, anon_key="test-key", env={})
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
                    validate_simulation_target(url=url, anon_key="test-key", env={})
                msg = str(ctx.exception)
                self.assertTrue("Invalid target URL format" in msg or "Malformed target URL" in msg)

    # ── TEST 6: ISOLATED TEST PROJECT ACCEPTED ──
    def test_06_isolated_test_project_accepted(self):
        """Verify that genuinely isolated test projects and local instances are accepted."""
        valid_targets = [
            ("https://isolated-test-proj.supabase.co", "isolated-test-proj", "isolated_test_project"),
            ("https://dev-sandbox-99.supabase.co", "dev-sandbox-99", "isolated_test_project"),
            ("http://localhost:54321", "localhost", "local_docker_supabase"),
            ("http://127.0.0.1:54321", "127.0.0.1", "local_docker_supabase"),
        ]
        for target, exp_ref, exp_env in valid_targets:
            with self.subTest(target=target):
                sanitized_url, ref, env_label = validate_simulation_target(
                    url=target, anon_key="isolated-test-key-54321", env={}
                )
                self.assertEqual(sanitized_url, target)
                self.assertEqual(ref, exp_ref)
                self.assertEqual(env_label, exp_env)

    # ── TEST 7: NO HTTP REQUEST OCCURS WHEN VALIDATION FAILS ──
    @patch("urllib.request.urlopen")
    def test_07_no_http_request_when_validation_fails(self, mock_urlopen):
        """Verify zero network calls occur when target validation fails."""
        mock_urlopen.side_effect = AssertionError("NETWORK CALL DETECTED! Zero requests allowed on failure.")

        # Attempting to initialize bridge pointing to production
        with self.assertRaises(ProductionTargetSafetyError):
            NuKropAIAgentBridge(
                scenario_id="sim_safety_test",
                supabase_url=f"https://{PRODUCTION_PROJECT_REF}.supabase.co",
                anon_key="test-key",
            )
        mock_urlopen.assert_not_called()

        # Attempting to initialize bridge with missing URL
        with self.assertRaises(TargetConfigurationError):
            NuKropAIAgentBridge(
                scenario_id="sim_safety_test",
                supabase_url="",
                anon_key="test-key",
            )
        mock_urlopen.assert_not_called()

        # Attempting to initialize bridge with production anon key
        with self.assertRaises(ProductionTargetSafetyError):
            NuKropAIAgentBridge(
                scenario_id="sim_safety_test",
                supabase_url="https://valid-isolated-test.supabase.co",
                anon_key=f"header.{PRODUCTION_PROJECT_REF}.signature",
            )
        mock_urlopen.assert_not_called()

    # ── TEST 8: k6 SAFETY GUARD ABORT (OFFLINE EXECUTION) ──
    def test_08_k6_safety_guard_rejects_production_and_aborts(self):
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
                "TEST_SUPABASE_ANON_KEY": "dummy-key",
                "NUKROPAI_FORCE_PRODUCTION_TEST": "true",
                "NUKROPAI_ALLOW_SIMULATION": "true",
            },
        )
        self.assertNotEqual(proc_bypass.returncode, 0)
        self.assertIn("All bypass flags have been permanently removed", proc_bypass.stderr)

if __name__ == "__main__":
    unittest.main(verbosity=2)
