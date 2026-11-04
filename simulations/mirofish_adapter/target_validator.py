"""
NuKropAI — Production Target Safety Validator for Simulation & Load Testing
Enforces absolute fail-closed isolation:
The production Supabase project (yxjqseiegwjdfnccdchk) must NEVER be reachable
under ANY circumstances, flags, or environment overrides.
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
    """Raised when an attempt is made to target the production environment."""
    pass

class TargetConfigurationError(ValueError):
    """Raised when simulation target configuration is missing, invalid, or ambiguous."""
    pass

def extract_project_ref(url: str) -> Optional[str]:
    """Extract project reference from a Supabase URL or hostname."""
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or url
        match = re.match(r"^([a-z0-9_-]+)\.supabase\.co$", hostname, re.IGNORECASE)
        if match:
            return match.group(1).lower()
        return hostname.lower()
    except Exception:
        return None

def validate_simulation_target(
    url: Optional[str] = None,
    anon_key: Optional[str] = None,
    env: Optional[Dict[str, str]] = None
) -> Tuple[str, str, str]:
    """
    Validates that a simulation or load test is targeting an isolated test project.
    
    Returns:
        Tuple[str, str, str]: (sanitized_url, project_ref, environment_label)
        
    Raises:
        ProductionTargetSafetyError: If production project ref or host is targeted.
        TargetConfigurationError: If target is missing, invalid, or ambiguous.
    """
    if env is None:
        env = os.environ

    # 1. Resolve URL: Must come explicitly from parameters or test environment variables
    # Priority: explicit arg -> TEST_SUPABASE_URL -> SIMULATION_SUPABASE_URL -> SUPABASE_URL
    target_url = url
    if not target_url:
        target_url = (
            env.get("TEST_SUPABASE_URL")
            or env.get("SIMULATION_SUPABASE_URL")
            or env.get("SUPABASE_URL")
        )

    # Reject missing or empty target configuration
    if not target_url or not str(target_url).strip():
        raise TargetConfigurationError(
            "[SAFETY BLOCK] Target Supabase URL is missing or empty. "
            "Simulations and load tests require an explicitly configured isolated test environment. "
            "Please configure TEST_SUPABASE_URL (e.g., https://your-test-project.supabase.co or http://localhost:54321)."
        )

    target_url = str(target_url).strip()

    # 2. Reject malformed / invalid URL schemes
    if not (target_url.startswith("http://") or target_url.startswith("https://")):
        raise TargetConfigurationError(
            f"[SAFETY BLOCK] Invalid target URL format: '{target_url}'. "
            "Target URL must start with http:// or https://"
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
        raise TargetConfigurationError(
            f"[SAFETY BLOCK] Failed to parse target URL '{target_url}': {e}"
        )

    hostname = (parsed.hostname or "").lower()
    raw_lower = target_url.lower()

    # 3. Reject the known production project reference or host under ALL circumstances
    # Legacy bypass flags are explicitly checked and disregarded.
    if PRODUCTION_PROJECT_REF in raw_lower or any(p in hostname for p in PRODUCTION_HOST_PATTERNS):
        raise ProductionTargetSafetyError(
            f"[SAFETY BLOCK: CRITICAL] The production Supabase project '{PRODUCTION_PROJECT_REF}' "
            "must NEVER be targeted by simulation or load-test executions under any circumstances. "
            "All bypass flags (e.g. NUKROPAI_ALLOW_SIMULATION, NUKROPAI_FORCE_PRODUCTION_TEST) have been permanently removed. "
            "You MUST specify an independently configured, isolated test project."
        )

    project_ref = extract_project_ref(target_url) or hostname

    # 4. Reject production API keys
    key_to_check = (
        anon_key
        or env.get("TEST_SUPABASE_ANON_KEY")
        or env.get("SIMULATION_SUPABASE_ANON_KEY")
        or env.get("SUPABASE_ANON_KEY")
    )
    if key_to_check:
        key_str = str(key_to_check).strip()
        if PRODUCTION_PROJECT_REF in key_str.lower():
            raise ProductionTargetSafetyError(
                f"[SAFETY BLOCK: CRITICAL] The provided API key references the production project '{PRODUCTION_PROJECT_REF}'. "
                "Production API keys cannot be used in simulation environments."
            )

    env_label = "isolated_test_project"
    if "localhost" in hostname or "127.0.0.1" in hostname:
        env_label = "local_docker_supabase"

    return target_url, project_ref, env_label

def verify_and_print_target(
    url: Optional[str] = None,
    anon_key: Optional[str] = None,
    env: Optional[Dict[str, str]] = None
) -> Tuple[str, str, str]:
    """Validates target and prints a sanitized audit banner without secrets."""
    target_url, project_ref, env_label = validate_simulation_target(url, anon_key, env)
    parsed = urlparse(target_url)
    sanitized_host = parsed.netloc
    
    print("=" * 75)
    print("🛡️  NUKROPAI TARGET SAFETY VALIDATION: PASSED")
    print(f"  • Environment:    {env_label}")
    print(f"  • Target Host:    {sanitized_host}")
    print(f"  • Project Ref:    {project_ref}")
    print(f"  • Production Ref: {PRODUCTION_PROJECT_REF} (PROTECTED / BLOCKED)")
    print("=" * 75)
    
    return target_url, project_ref, env_label
