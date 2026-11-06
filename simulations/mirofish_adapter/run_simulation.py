"""
NuKropAI — MiroFish Multi-Agent Simulation Engine CLI
Executes Synthetic User Swarms & Verifies Agrarian Ecosystem Dynamics

Usage:
  python -m simulations.mirofish_adapter.run_simulation --pilot
  python -m simulations.mirofish_adapter.run_simulation --all
  python -m simulations.mirofish_adapter.run_simulation --scenario F
"""

import sys
import os
import json
import argparse
from typing import List
from .scenarios import ScenarioRunner
from .models import ScenarioMetrics

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

def print_metrics(m: ScenarioMetrics):
    print("=" * 75)
    print(f"📊 SIMULATION RESULTS: {m.scenario_name}")
    print("=" * 75)
    print(f"  • Execution Window:        {m.start_time} -> {m.end_time} ({m.duration_seconds}s)")
    print(f"  • Total Synthetic Agents:  {m.total_agents} ({m.farmer_count} Farmers, {m.driver_count} Drivers)")
    print(f"  • Bookings Requested:      {m.bookings_requested}")
    print(f"  • Bookings Accepted:       {m.bookings_accepted}")
    print(f"  • Bookings Completed:      {m.bookings_completed}")
    print(f"  • Bookings Cancelled:      {m.bookings_cancelled}")
    print(f"  • Unassigned / Expired:    {m.bookings_unassigned}")
    if m.concurrency_conflicts_detected > 0:
        print(f"  • Concurrency Races Won:   1 (409 Conflict Rejections: {m.concurrency_conflicts_detected})")
    if m.unverified_rejections_enforced > 0:
        print(f"  • Unverified KYC Blocked:  {m.unverified_rejections_enforced}")
    print(f"  • Total API Operations:    {m.api_call_count} (Errors: {m.api_error_count})")
    print(f"  • Average API Latency:     {m.avg_api_latency_ms:.1f} ms")
    print("=" * 75)

def main():
    parser = argparse.ArgumentParser(description="NuKropAI MiroFish Multi-Agent Simulation Engine")
    parser.add_argument("--pilot", action="store_true", help="Run rapid pilot simulation (5 farmers, 2 drivers)")
    parser.add_argument("--all", action="store_true", help="Run complete scenario test suite")
    parser.add_argument("--scenario", type=str, choices=["A", "C", "F", "G", "pilot"], default="pilot", help="Specific scenario to execute")
    parser.add_argument("--scale", type=float, default=0.2, help="Population scale factor (default 0.2 for fast testing)")
    
    args = parser.parse_args()

    # Fail-closed target validation BEFORE creating runner or sending any requests
    try:
        from .target_validator import verify_and_print_target
        verify_and_print_target()
    except Exception as e:
        print(f"\n❌ [SAFETY ABORT] {e}", file=sys.stderr)
        sys.exit(1)

    runner = ScenarioRunner()
    results: List[ScenarioMetrics] = []

    os.makedirs("simulations/logs", exist_ok=True)

    print("\n" + "=" * 75)
    print("🌾 NUKROPAI — MIROFISH MULTI-AGENT SWARM SIMULATOR")
    print("=" * 75)

    if args.pilot or args.scenario == "pilot":
        print("\n🚀 Executing Pilot Scenario (5 Farmers, 2 Drivers, 1 Unverified Driver)...")
        res = runner.run_pilot()
        results.append(res)
        print_metrics(res)
        
    if args.all:
        print(f"\n🚀 Executing Scenario Suite (Scale Factor: {args.scale})...")
        
        print("\n▶ Running Scenario A (Normal Day)...")
        res_a = runner.run_scenario_a_normal_day(sample_size_factor=args.scale)
        results.append(res_a)
        print_metrics(res_a)
        
        print("\n▶ Running Scenario C (Driver Shortage)...")
        res_c = runner.run_scenario_c_driver_shortage(sample_size_factor=args.scale)
        results.append(res_c)
        print_metrics(res_c)
        
        print("\n▶ Running Scenario F (Concurrency Race)...")
        res_f = runner.run_scenario_f_concurrency_race()
        results.append(res_f)
        print_metrics(res_f)
        
        print("\n▶ Running Scenario G (Cancellation Surge)...")
        res_g = runner.run_scenario_g_cancellation_surge()
        results.append(res_g)
        print_metrics(res_g)
        
    elif not args.pilot:
        if args.scenario == "A":
            res = runner.run_scenario_a_normal_day(sample_size_factor=args.scale)
        elif args.scenario == "C":
            res = runner.run_scenario_c_driver_shortage(sample_size_factor=args.scale)
        elif args.scenario == "F":
            res = runner.run_scenario_f_concurrency_race()
        elif args.scenario == "G":
            res = runner.run_scenario_g_cancellation_surge()
        results.append(res)
        print_metrics(res)

    # Save summary
    summary_path = "simulations/logs/simulation_summary.json"
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump([r.to_dict() for r in results], f, indent=2)
    print(f"\n✨ Simulation metrics written to: {summary_path}")

if __name__ == "__main__":
    main()

