"""
NuKropAI — MiroFish Multi-Agent Simulation Engine Adapter
Models & Data Structures

Implements MiroFish-compatible agent profiles, action contracts, and telemetry logging
specifically adapted for NuKropAI's Agrarian Operating System.

License & Architecture Boundary:
This adapter runs strictly within the testing/simulation boundary and communicates with
NuKropAI exclusively over documented REST/RPC APIs. It does not alter core production
licensing or introduce AGPL copyleft contagion to NuKropAI core repositories.
"""

from dataclasses import dataclass, field, asdict
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import uuid

@dataclass
class PersonaProfile:
    """MiroFish-compatible Agent Persona Profile adapted for NuKropAI."""
    agent_id: str
    name: str
    role: str                       # farmer, verified_driver, unverified_driver, fleet_operator, machinery_owner, equipment_renter, mandi_trader, agri_expert, platform_admin
    subtype: str                    # marginal_farmer, commercial_farmer, periurban_horticulture, freelance_driver, fleet_captain, etc.
    phone: str
    village: str
    district: str
    state: str
    lat: float
    lng: float
    # Behavioral and operational parameters
    is_verified: bool = True
    vehicle_plate: Optional[str] = None
    vehicle_type: Optional[str] = None
    capacity_tonnes: float = 0.0
    crop_focus: List[str] = field(default_factory=list)
    preferred_mandi: Optional[str] = None
    fare_tolerance_inr: float = 1500.0
    patience_seconds: int = 180      # Time farmer will wait for acceptance before cancelling
    acceptance_delay_seconds: int = 5 # Driver decision latency
    cancellation_probability: float = 0.05
    network_instability_probability: float = 0.02
    bio: str = ""
    # Session state
    auth_token: Optional[str] = None
    user_id: Optional[str] = None
    current_status: str = "OFF_DUTY" # OFF_DUTY, ON_DUTY, SEARCHING, PENDING, ACCEPTED, IN_TRANSIT, COMPLETED, CANCELLED
    active_booking_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PersonaProfile":
        return cls(**data)

@dataclass
class SimulationAction:
    """MiroFish action log record mirroring actions.jsonl structure."""
    action_id: str
    timestamp: str
    scenario_id: str
    agent_id: str
    role: str
    action_type: str               # GO_ON_DUTY, GO_OFF_DUTY, SEARCH_DRIVERS, CREATE_BOOKING, ACCEPT_BOOKING, CANCEL_BOOKING, GPS_PING, ADVANCE_STATUS, COMPLETE_TRIP, DISCONNECT
    target_id: Optional[str] = None # booking_id or driver_id
    payload: Dict[str, Any] = field(default_factory=dict)
    http_status: int = 200
    latency_ms: float = 0.0
    success: bool = True
    error_message: Optional[str] = None

    def to_jsonl(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False)

@dataclass
class ScenarioMetrics:
    """Aggregated execution metrics for a simulated scenario."""
    scenario_name: str
    scenario_type: str
    start_time: str
    end_time: str
    duration_seconds: float
    total_agents: int
    farmer_count: int
    driver_count: int
    bookings_requested: int = 0
    bookings_accepted: int = 0
    bookings_completed: int = 0
    bookings_cancelled: int = 0
    bookings_unassigned: int = 0
    concurrency_conflicts_detected: int = 0
    network_disconnects_handled: int = 0
    unverified_rejections_enforced: int = 0
    avg_acceptance_latency_sec: float = 0.0
    api_call_count: int = 0
    api_error_count: int = 0
    avg_api_latency_ms: float = 0.0
    rls_violations: int = 0
    data_integrity_passed: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
