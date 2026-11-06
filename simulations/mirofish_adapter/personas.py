"""
NuKropAI — MiroFish Persona Generation Engine
Generates 9 Distinct Synthetic Agrarian Personas with Realistic Goals, Constraints & Behaviors

All generated personas strictly operate with synthetic credentials (@nukrop-sim.in)
and are clearly tagged as SIMULATED to ensure 100% isolation from real users.
"""

import random
import uuid
from typing import List, Dict, Any, Tuple
from .models import PersonaProfile

# Real Telangana & AP Agricultural Hub Coordinates
AGRICULTURAL_HUBS = [
    {"village": "Bowenpally Market Hub", "district": "Hyderabad", "state": "Telangana", "lat": 17.4700, "lng": 78.4850, "is_mandi": True},
    {"village": "Secunderabad Rythu Bazaar", "district": "Hyderabad", "state": "Telangana", "lat": 17.4400, "lng": 78.4980, "is_mandi": True},
    {"village": "Kothaguda Agro Cluster", "district": "Rangareddy", "state": "Telangana", "lat": 17.4600, "lng": 78.3650, "is_mandi": False},
    {"village": "Shamshabad Sowing Belt", "district": "Rangareddy", "state": "Telangana", "lat": 17.2500, "lng": 78.4300, "is_mandi": False},
    {"village": "Medchal Green Fields", "district": "Medchal-Malkajgiri", "state": "Telangana", "lat": 17.6300, "lng": 78.4800, "is_mandi": False},
    {"village": "Gaddiannaram Fruit Market", "district": "Hyderabad", "state": "Telangana", "lat": 17.3600, "lng": 78.5200, "is_mandi": True},
    {"village": "Sangareddy Farm Corridor", "district": "Sangareddy", "state": "Telangana", "lat": 17.6200, "lng": 78.0800, "is_mandi": False},
    {"village": "Warangal Enamamula Mandi", "district": "Warangal", "state": "Telangana", "lat": 17.9850, "lng": 79.6050, "is_mandi": True},
    {"village": "Ghanpur Cotton Basin", "district": "Jangaon", "state": "Telangana", "lat": 17.8500, "lng": 79.3500, "is_mandi": False},
    {"village": "Suryapet Grain Terminal", "district": "Suryapet", "state": "Telangana", "lat": 17.1400, "lng": 79.6200, "is_mandi": True},
]

MANDI_DESTINATIONS = [
    "Bowenpally Agriculture Market",
    "Secunderabad Rythu Bazaar",
    "Gaddiannaram Fruit Market Yard",
    "Warangal Enamamula Mandi",
    "Suryapet Grain Terminal"
]

CROP_CATALOG = [
    {"name": "Organic Tomatoes", "typical_load": 12.0, "perishable": True},
    {"name": "Paddy Grain (Sona Masoori)", "typical_load": 35.0, "perishable": False},
    {"name": "Cotton Bales", "typical_load": 25.0, "perishable": False},
    {"name": "Red Chilli (Teja)", "typical_load": 15.0, "perishable": False},
    {"name": "Fresh Green Chillies", "typical_load": 10.0, "perishable": True},
    {"name": "Maize Corn", "typical_load": 40.0, "perishable": False},
    {"name": "Papaya Harvest", "typical_load": 18.0, "perishable": True},
    {"name": "Turmeric Roots", "typical_load": 20.0, "perishable": False},
]

VEHICLE_FLEET = [
    {"type": "Tata Ace Gold (1.5T)", "capacity": 1.5, "base_fare": 800.0, "per_km": 25.0},
    {"type": "Mahindra Bolero Maxi Truck (1.7T)", "capacity": 1.7, "base_fare": 950.0, "per_km": 28.0},
    {"type": "Ashok Leyland Dost (2.0T)", "capacity": 2.0, "base_fare": 1100.0, "per_km": 32.0},
    {"type": "Tata 407 LPT (4.5T)", "capacity": 4.5, "base_fare": 1800.0, "per_km": 45.0},
    {"type": "Eicher Pro 2049 (3.5T)", "capacity": 3.5, "base_fare": 1500.0, "per_km": 40.0},
]

INDIAN_FIRST_NAMES = [
    "Ramesh", "Suresh", "Venkat", "Anitha", "Lakshmi", "Rajesh", "Narasimha", "Srinivas",
    "Mallesh", "Bhadramma", "Prabhakar", "Swamy", "Chandramouli", "Kavitha", "Govardhan",
    "Ravinder", "Madhu", "Naresh", "Sai", "Manjula", "Balaraju", "Anjamma", "Raju"
]

INDIAN_LAST_NAMES = [
    "Reddy", "Rao", "Goud", "Yadav", "Kurva", "Chary", "Patel", "Naidu", "Sharma", "Boya"
]

def generate_persona(role: str, subtype: str = None, hub_index: int = None, is_verified: bool = True) -> PersonaProfile:
    """Generate a single high-fidelity MiroFish-compatible synthetic persona."""
    first = random.choice(INDIAN_FIRST_NAMES)
    last = random.choice(INDIAN_LAST_NAMES)
    name = f"{first} {last}"
    sim_id = f"sim_{role[:4]}_{uuid.uuid4().hex[:6]}"
    
    hub = AGRICULTURAL_HUBS[hub_index % len(AGRICULTURAL_HUBS)] if hub_index is not None else random.choice(AGRICULTURAL_HUBS)
    
    # Jitter coordinates slightly around the hub (+/- ~1.5 km)
    lat_jitter = hub["lat"] + (random.uniform(-0.015, 0.015))
    lng_jitter = hub["lng"] + (random.uniform(-0.015, 0.015))
    
    phone = f"+919{random.randint(100000000, 999999999)}"
    
    if role == "farmer":
        subtype = subtype or random.choice(["marginal_farmer", "commercial_farmer", "periurban_horticulture"])
        crop = random.choice(CROP_CATALOG)
        patience = 120 if crop["perishable"] else 300
        tolerance = 1200.0 if subtype == "marginal_farmer" else 2800.0
        return PersonaProfile(
            agent_id=sim_id,
            name=f"[SIM] {name}",
            role="farmer",
            subtype=subtype,
            phone=phone,
            village=hub["village"],
            district=hub["district"],
            state=hub["state"],
            lat=lat_jitter,
            lng=lng_jitter,
            is_verified=True,
            crop_focus=[crop["name"]],
            preferred_mandi=random.choice(MANDI_DESTINATIONS),
            fare_tolerance_inr=tolerance,
            patience_seconds=patience,
            cancellation_probability=0.08 if crop["perishable"] else 0.03,
            bio=f"Synthetic {subtype.replace('_', ' ')} farming in {hub['village']}. Primary crop: {crop['name']}."
        )
    
    elif role in ("verified_driver", "unverified_driver"):
        veh = random.choice(VEHICLE_FLEET)
        plate_state = "TS" if hub["state"] == "Telangana" else "AP"
        plate = f"{plate_state}-{random.randint(1, 39):02d}-{random.choice(['AB', 'TK', 'CD'])}-{random.randint(1000, 9999)}"
        ver_status = (role == "verified_driver") and is_verified
        return PersonaProfile(
            agent_id=sim_id,
            name=f"[SIM] {name} ({'Verified' if ver_status else 'Unverified'})",
            role="verified_driver" if ver_status else "unverified_driver",
            subtype="owner_operator" if random.random() > 0.3 else "fleet_pilot",
            phone=phone,
            village=hub["village"],
            district=hub["district"],
            state=hub["state"],
            lat=lat_jitter,
            lng=lng_jitter,
            is_verified=ver_status,
            vehicle_plate=plate,
            vehicle_type=veh["type"],
            capacity_tonnes=veh["capacity"],
            acceptance_delay_seconds=random.randint(3, 8),
            network_instability_probability=0.04,
            bio=f"Synthetic transporter piloting {veh['type']} ({plate}). KYC Verified: {ver_status}."
        )
    
    elif role == "fleet_operator":
        return PersonaProfile(
            agent_id=sim_id,
            name=f"[SIM] {name} Logistics",
            role="fleet_operator",
            subtype="regional_transporter",
            phone=phone,
            village=hub["village"],
            district=hub["district"],
            state=hub["state"],
            lat=lat_jitter,
            lng=lng_jitter,
            is_verified=True,
            capacity_tonnes=18.0,
            bio=f"Synthetic transport enterprise operating 5 multi-utility trucks out of {hub['district']}."
        )
        
    elif role == "machinery_owner":
        machinery = random.choice(["John Deere 5050D 4WD Tractor", "Kubota Harvester DC-68G", "Rotavator & Disc Harrow"])
        return PersonaProfile(
            agent_id=sim_id,
            name=f"[SIM] {name} (Machinery)",
            role="machinery_owner",
            subtype="custom_hiring_center",
            phone=phone,
            village=hub["village"],
            district=hub["district"],
            state=hub["state"],
            lat=lat_jitter,
            lng=lng_jitter,
            is_verified=True,
            bio=f"Synthetic agricultural equipment owner offering {machinery} on rental basis."
        )
        
    elif role == "equipment_renter":
        return PersonaProfile(
            agent_id=sim_id,
            name=f"[SIM] {name} (Renter)",
            role="equipment_renter",
            subtype="tenant_farmer",
            phone=phone,
            village=hub["village"],
            district=hub["district"],
            state=hub["state"],
            lat=lat_jitter,
            lng=lng_jitter,
            is_verified=True,
            bio=f"Synthetic tenant cultivator seeking micro-rental of tillage machinery for seasonal prep."
        )
        
    elif role == "mandi_trader":
        mandi_hub = [h for h in AGRICULTURAL_HUBS if h.get("is_mandi", False)]
        target_hub = random.choice(mandi_hub) if mandi_hub else hub
        return PersonaProfile(
            agent_id=sim_id,
            name=f"[SIM] {name} Traders (APMC #44)",
            role="mandi_trader",
            subtype="commission_agent",
            phone=phone,
            village=target_hub["village"],
            district=target_hub["district"],
            state=target_hub["state"],
            lat=target_hub["lat"],
            lng=target_hub["lng"],
            is_verified=True,
            bio=f"Synthetic APMC registered commission agent receiving grain & vegetable consignments."
        )
        
    elif role == "agri_expert":
        return PersonaProfile(
            agent_id=sim_id,
            name=f"[SIM] Dr. {name} (Agronomist)",
            role="agri_expert",
            subtype="crop_pathologist",
            phone=phone,
            village="Hyderabad Central Agro Research",
            district="Hyderabad",
            state="Telangana",
            lat=17.3850,
            lng=78.4867,
            is_verified=True,
            bio="Synthetic plant pathologist providing automated LeafNet crop disease diagnostics."
        )
        
    elif role == "platform_admin":
        return PersonaProfile(
            agent_id=sim_id,
            name=f"[SIM] Officer {name} (Compliance)",
            role="platform_admin",
            subtype="kyc_auditor",
            phone=phone,
            village="NuKropAI Security Operations",
            district="Hyderabad",
            state="Telangana",
            lat=17.3850,
            lng=78.4867,
            is_verified=True,
            bio="Synthetic administrative agent enforcing DPDP consent boundaries and driver KYC verification."
        )
    
    # Default fallback
    return PersonaProfile(
        agent_id=sim_id,
        name=f"[SIM] {name}",
        role=role,
        subtype="generic_user",
        phone=phone,
        village=hub["village"],
        district=hub["district"],
        state=hub["state"],
        lat=lat_jitter,
        lng=lng_jitter,
        bio=f"Synthetic platform user {sim_id}"
    )

def generate_population(
    farmers_count: int = 50,
    verified_drivers_count: int = 10,
    unverified_drivers_count: int = 2,
    fleet_operators_count: int = 2,
    machinery_owners_count: int = 3,
    equipment_renters_count: int = 5,
    mandi_traders_count: int = 4,
    agri_experts_count: int = 2,
    platform_admins_count: int = 1
) -> List[PersonaProfile]:
    """Generate a full balanced population across all 9 platform personas."""
    population: List[PersonaProfile] = []
    
    for i in range(farmers_count):
        population.append(generate_persona("farmer", hub_index=i))
        
    for i in range(verified_drivers_count):
        population.append(generate_persona("verified_driver", hub_index=i, is_verified=True))
        
    for i in range(unverified_drivers_count):
        population.append(generate_persona("unverified_driver", hub_index=i, is_verified=False))
        
    for i in range(fleet_operators_count):
        population.append(generate_persona("fleet_operator", hub_index=i))
        
    for i in range(machinery_owners_count):
        population.append(generate_persona("machinery_owner", hub_index=i))
        
    for i in range(equipment_renters_count):
        population.append(generate_persona("equipment_renter", hub_index=i))
        
    for i in range(mandi_traders_count):
        population.append(generate_persona("mandi_trader", hub_index=i))
        
    for i in range(agri_experts_count):
        population.append(generate_persona("agri_expert", hub_index=i))
        
    for i in range(platform_admins_count):
        population.append(generate_persona("platform_admin", hub_index=i))
        
    return population

