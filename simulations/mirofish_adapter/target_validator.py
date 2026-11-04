"""
NuKropAI — Production Target Safety Validator for Simulation & Load Testing
Phase 12.1 Hardened: Strict Allowlisting Architecture.

Accepts ONLY:
A. An approved isolated Supabase test project whose URL hostname matches its expected project reference:
   https://<project-ref>.supabase.co
B. An approved local Supabase instance using loopback addresses:
   http://127.0.0.1:<port> or http://localhost:<port>

Rejects:
- Production project reference ('yxjqseiegwjdfnccdchk') unconditionally.
- Arbitrary external domains (e.g. evil.com, example.com, other cloud APIs).
- Custom proxy URLs and non-standard hostnames.
- Missing or mismatched project references.
- Generic SUPABASE_URL and SUPABASE_ANON_KEY fallbacks.
- Any environment-variable bypass flags.
"""
import os
import re
from urllib.parse import urlparse
from typing import Tuple, Dict, Any, Optional

PRODUCTION_PROJECT_REF = "yxjqseiegwjdfnccdchk"
PRODUCTION_HOST_PATTERNS = [
    "yxjqseiegwjdfnccdchk.supabase.co",
    "yxjqseiegwjdfnccdchk",
]

LEGACY_BYPASS_ENV_VARS = [
    "NUKROPAI_ALLOW_SIMULATION",
    "NUKROPAI_FORCE_PRODUCTION_TEST",
    "FORCE_PRODUCTION",
    "ALLOW_PRODUCTION_TEST",
]

class ProductionTargetSafetyError(RuntimeError):
    """Raised when an attempt is made to target the production environment or perform unsafe redirects."""
    pass

class TargetConfigurationError(ValueError):
    """Raised when simulation target configuration is missing, invalid, ambiguous, or unauthorized."""
    pass

def extract_project_ref_from_url(url: str) -> Optional[str]:
    """Extract project reference from a standard Supabase URL."""
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()
        match = re.match(r"^([a-z0-9_-]+)\.supabase\.co$", hostname)
        if match:
            return match.group(1).lower()
        if hostname in ("127.0.0.1", "localhost", "::1"):
            return hostname
        return None
    except Exception:
        return None

extract_project_ref = extract_project_ref_from_url

def validate_simulation_target(
    url: Optional[str] = None,
    project_ref: Optional[str] = None,
    anon_key: Optional[str] = None,
    env: Optional[Dict[str, str]] = None
) -> Tuple[str, str, str]:
    """
    Strict allowlist validation for simulation & load-test targets.
    
    Returns:
        Tuple[str, str, str]: (sanitized_url, project_ref, environment_label)
        
    Raises:
        ProductionTargetSafetyError: If production project ref or host is targeted.
        TargetConfigurationError: If target is missing, invalid, ambiguous, or unauthorized.
    """
    if env is None:
        env = os.environ

    # 1. Reject generic credential fallbacks
    # Simulations MUST NOT silently fall back to generic production application variables
    explicit_test_url = (
        url
        or env.get("TEST_SUPABASE_URL")
        or env.get("SIMULATION_SUPABASE_URL")
    )
    if not explicit_test_url:
        if env.get("SUPABASE_URL"):
            raise TargetConfigurationError(
                "[SAFETY BLOCK] Generic 'SUPABASE_URL' fallback is strictly prohibited. "
                "Simulations require explicit 'TEST_SUPABASE_URL' and 'TEST_SUPABASE_PROJECT_REF'."
            )
        raise TargetConfigurationError(
            "[SAFETY BLOCK] Target Supabase test URL is missing or empty. "
            "Please configure TEST_SUPABASE_URL and TEST_SUPABASE_PROJECT_REF."
        )

    target_url = str(explicit_test_url).strip()
    if not target_url:
        raise TargetConfigurationError("[SAFETY BLOCK] Target Supabase test URL is missing or empty.")

    # 2. Reject generic anon key fallback
    explicit_test_key = (
        anon_key
        or env.get("TEST_SUPABASE_ANON_KEY")
        or env.get("SIMULATION_SUPABASE_ANON_KEY")
    )
    if not explicit_test_key:
        if env.get("SUPABASE_ANON_KEY"):
            raise TargetConfigurationError(
                "[SAFETY BLOCK] Generic 'SUPABASE_ANON_KEY' fallback is strictly prohibited. "
                "Simulations require explicit 'TEST_SUPABASE_ANON_KEY'."
            )
        raise TargetConfigurationError(
            "[SAFETY BLOCK] Isolated test anon key is missing. Please configure TEST_SUPABASE_ANON_KEY."
        )

    resolved_key = str(explicit_test_key).strip()
    if not resolved_key:
        raise TargetConfigurationError("[SAFETY BLOCK] Isolated test anon key is missing or empty.")

    # 3. Resolve Expected Project Ref
    expected_ref = (
        project_ref
        or env.get("TEST_SUPABASE_PROJECT_REF")
        or env.get("SIMULATION_SUPABASE_PROJECT_REF")
    )

    # 4. Strict Production Rejection: Project ref or host matching
    # Legacy bypass flags are intentionally ignored - production is ALWAYS blocked first
    raw_lower = target_url.lower()
    if (
        PRODUCTION_PROJECT_REF in raw_lower
        or any(p in raw_lower for p in PRODUCTION_HOST_PATTERNS)
        or (expected_ref and PRODUCTION_PROJECT_REF in str(expected_ref).lower())
    ):
        raise ProductionTargetSafetyError(
            f"[SAFETY BLOCK: CRITICAL] The production Supabase project '{PRODUCTION_PROJECT_REF}' "
            "must NEVER be targeted by simulation or load-test executions under any circumstances. "
            "All bypass flags have been permanently removed."
        )

    if PRODUCTION_PROJECT_REF in resolved_key.lower():
        raise ProductionTargetSafetyError(
            f"[SAFETY BLOCK: CRITICAL] The provided API key references the production project '{PRODUCTION_PROJECT_REF}'."
        )

    # 5. URL Syntax & Structure Validation
    if not (target_url.startswith("http://") or target_url.startswith("https://")):
        raise TargetConfigurationError(
            f"[SAFETY BLOCK] Invalid target URL format: '{target_url}'. Must start with http:// or https://"
        )

    try:
        parsed = urlparse(target_url)
        if not parsed.hostname or not parsed.netloc:
            raise TargetConfigurationError(
                f"[SAFETY BLOCK] Malformed target URL: '{target_url}'. Missing hostname or network location."
            )
    except TargetConfigurationError:
        raise
    except Exception as e:
        raise TargetConfigurationError(f"[SAFETY BLOCK] Failed to parse target URL '{target_url}': {e}")

    # Reject custom proxy subpaths or non-root paths (e.g. https://proxy.internal/supabase)
    if parsed.path and parsed.path not in ("", "/"):
        raise TargetConfigurationError(
            f"[SAFETY BLOCK] Custom proxy path '{parsed.path}' is rejected. Target URL must point to domain root."
        )

    hostname = (parsed.hostname or "").lower()

    # 6. STRICT TARGET ALLOWLISTING (Only Category A or Category B allowed)
    is_loopback = hostname in ("127.0.0.1", "localhost", "::1")
    is_supabase_cloud = bool(re.match(r"^[a-z0-9_-]+\.supabase\.co$", hostname))

    if not is_loopback and not is_supabase_cloud:
        raise TargetConfigurationError(
            f"[SAFETY BLOCK] Target host '{hostname}' is not an authorized Supabase endpoint. "
            "Arbitrary external domains and custom proxies are strictly rejected. "
            "Target must be either an isolated '*.supabase.co' project or local loopback (localhost/127.0.0.1)."
        )

    # Cloud targets MUST use HTTPS
    if is_supabase_cloud and parsed.scheme != "https":
        raise TargetConfigurationError(
            f"[SAFETY BLOCK] Insecure HTTP scheme '{target_url}' is rejected for Supabase cloud targets. "
            "Cloud targets must use HTTPS."
        )

    # Cloud targets MUST have explicit TEST_SUPABASE_PROJECT_REF matching the URL hostname
    if is_supabase_cloud:
        if not expected_ref or not str(expected_ref).strip():
            raise TargetConfigurationError(
                "[SAFETY BLOCK] 'TEST_SUPABASE_PROJECT_REF' is required for Supabase cloud targets. "
                "Target URL and project reference must agree exactly."
            )
        expected_ref_str = str(expected_ref).strip().lower()
        extracted_ref = extract_project_ref_from_url(target_url)
        if extracted_ref != expected_ref_str:
            raise TargetConfigurationError(
                f"[SAFETY BLOCK] Target URL hostname project reference '{extracted_ref}' does not match "
                f"expected TEST_SUPABASE_PROJECT_REF '{expected_ref_str}'."
            )
        project_ref_final = expected_ref_str
        env_label = "isolated_test_project"
    else:
        # Loopback
        project_ref_final = str(expected_ref).strip().lower() if expected_ref else hostname
        env_label = "local_docker_supabase"

    # Normalize sanitized URL (origin only, no trailing slash or path)
    sanitized_url = f"{parsed.scheme}://{parsed.netloc}"
    return sanitized_url, project_ref_final, env_label

def verify_and_print_target(
    url: Optional[str] = None,
    project_ref: Optional[str] = None,
    anon_key: Optional[str] = None,
    env: Optional[Dict[str, str]] = None
) -> Tuple[str, str, str]:
    """Validates target and prints a sanitized audit banner without secrets."""
    target_url, ref, env_label = validate_simulation_target(url, project_ref, anon_key, env)
    parsed = urlparse(target_url)
    sanitized_host = parsed.netloc
    
    print("=" * 75)
    print("🛡️  NUKROPAI TARGET SAFETY VALIDATION: PASSED")
    print(f"  • Environment:    {env_label}")
    print(f"  • Target Host:    {sanitized_host}")
    print(f"  • Project Ref:    {ref}")
    print(f"  • Production Ref: {PRODUCTION_PROJECT_REF} (PROTECTED / BLOCKED)")
    print("=" * 75)
    
    return target_url, ref, env_label
