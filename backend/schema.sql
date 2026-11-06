-- Database Initialization Schema for NuKropAI Enterprise
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users Table
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'buyer' CHECK (role IN ('farmer', 'buyer', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- 2. Refresh Tokens Table for JWT rotation
CREATE TABLE IF NOT EXISTS public.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON public.refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON public.refresh_tokens(user_id);

-- 3. Mandi Live Rates Table
CREATE TABLE IF NOT EXISTS public.mandi_live_rates (
    id SERIAL PRIMARY KEY,
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL,
    market VARCHAR(100) NOT NULL,
    commodity VARCHAR(100) NOT NULL,
    variety VARCHAR(100) NOT NULL,
    arrival_date VARCHAR(50) NOT NULL,
    min_price NUMERIC(12, 2) NOT NULL,
    max_price NUMERIC(12, 2) NOT NULL,
    modal_price NUMERIC(12, 2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mandi_commodity ON public.mandi_live_rates(commodity);
CREATE INDEX IF NOT EXISTS idx_mandi_state_district ON public.mandi_live_rates(state, district);

-- 4. Pest Outbreaks Table (Radar Network)
CREATE TABLE IF NOT EXISTS public.pest_outbreaks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pest_name VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    reporter_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    wind_direction VARCHAR(50) NOT NULL DEFAULT 'East',
    wind_speed NUMERIC(5, 2) NOT NULL DEFAULT 12.0
);
CREATE INDEX IF NOT EXISTS idx_pest_outbreaks_coords ON public.pest_outbreaks(latitude, longitude);

-- 5. Soil Telemetry Table (Subsoil Probe)
CREATE TABLE IF NOT EXISTS public.soil_telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    nitrogen INTEGER NOT NULL CHECK (nitrogen >= 0),
    phosphorus INTEGER NOT NULL CHECK (phosphorus >= 0),
    potassium INTEGER NOT NULL CHECK (potassium >= 0),
    ph NUMERIC(3,1) NOT NULL CHECK (ph BETWEEN 0.0 AND 14.0),
    organic_carbon NUMERIC(4,2) NOT NULL CHECK (organic_carbon >= 0.0),
    moisture INTEGER NOT NULL CHECK (moisture BETWEEN 0 AND 100),
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_soil_telemetry_user_logged ON public.soil_telemetry(user_id, logged_at DESC);

-- 6. Valve Operations (Smart Micro-Irrigation)
CREATE TABLE IF NOT EXISTS public.valve_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    valve_name VARCHAR(100) NOT NULL,
    state VARCHAR(20) NOT NULL CHECK (state IN ('OPEN', 'CLOSED')),
    flow_rate NUMERIC(4,1) NOT NULL DEFAULT 0.0,
    triggered_by VARCHAR(50) NOT NULL DEFAULT 'manual',
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_valve_ops_name_logged ON public.valve_operations(valve_name, logged_at DESC);

-- 7. Escrow Contracts (Blockchain Smart Contracts)
CREATE TABLE IF NOT EXISTS public.escrow_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    contract_address VARCHAR(100) UNIQUE NOT NULL,
    buyer_name VARCHAR(255) NOT NULL,
    commodity VARCHAR(100) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0.0),
    funds_status VARCHAR(20) NOT NULL DEFAULT 'LOCKED' CHECK (funds_status IN ('LOCKED', 'RELEASED', 'REFUNDED')),
    qr_verification_code VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verified_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_escrow_contracts_address ON public.escrow_contracts(contract_address);
CREATE INDEX IF NOT EXISTS idx_escrow_contracts_status ON public.escrow_contracts(funds_status);

-- 8. Crop Simulations (What-If Crop Simulation Sandbox)
CREATE TABLE IF NOT EXISTS public.crop_simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    crop_name VARCHAR(100) NOT NULL,
    field_size NUMERIC(5,2) NOT NULL CHECK (field_size > 0.0),
    yield_loss_risk INTEGER NOT NULL CHECK (yield_loss_risk BETWEEN 0 AND 100),
    recommendation TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crop_simulations_user ON public.crop_simulations(user_id);

-- 9. IoT Devices Registry (Tuya, Shelly, MQTT, GSM)
CREATE TABLE IF NOT EXISTS public.iot_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    device_name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('tuya', 'shelly', 'mqtt', 'gsm', 'custom')),
    provider_device_id VARCHAR(255) NOT NULL,
    provider_config JSONB DEFAULT '{}'::jsonb, -- Store SSID, Broker URL, API Keys
    status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'fault')),
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_iot_devices_farmer ON public.iot_devices(farmer_id);
CREATE INDEX IF NOT EXISTS idx_iot_devices_provider_id ON public.iot_devices(provider_device_id);

-- 10. IoT Telemetry Logs
CREATE TABLE IF NOT EXISTS public.iot_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.iot_devices(id) ON DELETE CASCADE,
    voltage NUMERIC(5,2),
    amperage NUMERIC(5,2),
    moisture NUMERIC(5,2),
    raw_payload JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_iot_telemetry_device_time ON public.iot_telemetry_logs(device_id, timestamp DESC);

-- 11. IoT Command Queue (State Verification Engine)
CREATE TABLE IF NOT EXISTS public.iot_commands_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.iot_devices(id) ON DELETE CASCADE,
    command VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verification', 'running', 'failed', 'completed')),
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_iot_commands_status ON public.iot_commands_queue(status);

-- 12. IoT Automation Rules (Rule Engine)
CREATE TABLE IF NOT EXISTS public.iot_automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.iot_devices(id) ON DELETE CASCADE,
    rule_name VARCHAR(100) NOT NULL,
    condition_config JSONB NOT NULL, -- e.g., {"metric": "moisture", "op": "<", "value": 35}
    action_config JSONB NOT NULL,    -- e.g., {"command": "MOTOR_ON", "duration_mins": 15}
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Event Sourcing Table for strict IoT audit trailing
CREATE TABLE IF NOT EXISTS public.device_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.iot_devices(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('COMMAND_ISSUED', 'TELEMETRY_RECEIVED', 'FAULT_DETECTED', 'STATE_CONFIRMED', 'PROTECTION_TRIGGERED')),
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_device_events_device_time ON public.device_events(device_id, created_at DESC);

-- 14. Multi-Tenant Organizations (Cooperatives/Agri-Businesses)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('cooperative', 'enterprise', 'individual')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Organization Members (RBAC)
CREATE TABLE IF NOT EXISTS public.org_members (
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
    PRIMARY KEY (org_id, user_id)
);

-- 16. Farm Zones (Physical Graph Topology)
CREATE TABLE IF NOT EXISTS public.farm_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    crop_type VARCHAR(100),
    area_hectares NUMERIC(6,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_farm_zones_org ON public.farm_zones(org_id);

-- 17. Irrigation Topology (Pump -> Valve -> Zone Graph)
CREATE TABLE IF NOT EXISTS public.irrigation_topology (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_device_id UUID NOT NULL REFERENCES public.iot_devices(id) ON DELETE CASCADE, -- e.g., The Pump
    target_device_id UUID REFERENCES public.iot_devices(id) ON DELETE CASCADE, -- e.g., The Valve (Optional)
    farm_zone_id UUID NOT NULL REFERENCES public.farm_zones(id) ON DELETE CASCADE,
    flow_capacity_lph NUMERIC(8,2) NOT NULL DEFAULT 0.0, -- Liters per hour
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Dead Letter Queue (DLQ) for failed/corrupted IoT Telemetry
CREATE TABLE IF NOT EXISTS public.device_dlq (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES public.iot_devices(id) ON DELETE SET NULL,
    error_reason TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_device_dlq_unresolved ON public.device_dlq(resolved) WHERE resolved = FALSE;

-- 19. Edge Node Identity & Trust (mTLS Certificates)
CREATE TABLE IF NOT EXISTS public.edge_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mac_address VARCHAR(100) UNIQUE NOT NULL,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    cert_fingerprint VARCHAR(255) NOT NULL,

-- 9. IoT Devices Registry (Tuya, Shelly, MQTT, GSM)
CREATE TABLE IF NOT EXISTS public.iot_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    farm_zone_id UUID REFERENCES public.farm_zones(id) ON DELETE SET NULL, -- Enforcing topology
    device_name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('tuya', 'shelly', 'mqtt', 'gsm', 'custom')),
    provider_device_id VARCHAR(255) NOT NULL,
    provider_config JSONB DEFAULT '{}'::jsonb, -- Store SSID, Broker URL, API Keys
    status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'fault')),
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_iot_devices_farmer ON public.iot_devices(farmer_id);
CREATE INDEX IF NOT EXISTS idx_iot_devices_zone ON public.iot_devices(farm_zone_id);
CREATE INDEX IF NOT EXISTS idx_iot_devices_provider_id ON public.iot_devices(provider_device_id);

-- 10. IoT Telemetry Logs
CREATE TABLE IF NOT EXISTS public.iot_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.iot_devices(id) ON DELETE CASCADE,
    voltage NUMERIC(5,2),
    amperage NUMERIC(5,2),
    moisture NUMERIC(5,2),
    raw_payload JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_iot_telemetry_device_time ON public.iot_telemetry_logs(device_id, timestamp DESC);

-- 11. IoT Command Queue (State Verification Engine)
CREATE TABLE IF NOT EXISTS public.iot_commands_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.iot_devices(id) ON DELETE CASCADE,
    command VARCHAR(100) NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verification', 'running', 'failed', 'completed')),
    queued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_iot_commands_status ON public.iot_commands_queue(status);

-- 12. IoT Automation Rules (Rule Engine)
CREATE TABLE IF NOT EXISTS public.iot_automation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.iot_devices(id) ON DELETE CASCADE,
    rule_name VARCHAR(100) NOT NULL,
    condition_config JSONB NOT NULL, -- e.g., {"metric": "moisture", "op": "<", "value": 35}
    action_config JSONB NOT NULL,    -- e.g., {"command": "MOTOR_ON", "duration_mins": 15}
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Event Sourcing Table for strict IoT audit trailing
CREATE TABLE IF NOT EXISTS public.device_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES public.iot_devices(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('COMMAND_ISSUED', 'TELEMETRY_RECEIVED', 'FAULT_DETECTED', 'STATE_CONFIRMED', 'PROTECTION_TRIGGERED')),
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_device_events_device_time ON public.device_events(device_id, created_at DESC);

-- 14. Multi-Tenant Organizations (Cooperatives/Agri-Businesses)
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('cooperative', 'enterprise', 'individual')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Organization Members (RBAC)
CREATE TABLE IF NOT EXISTS public.org_members (
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
    PRIMARY KEY (org_id, user_id)
);

-- 15.5 Farms (Core Domain)
CREATE TABLE IF NOT EXISTS public.farms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    location_state VARCHAR(100),
    location_district VARCHAR(100),
    total_area_hectares NUMERIC(8,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_farms_farmer ON public.farms(farmer_id);

-- 16. Farm Zones (Physical Graph Topology)
CREATE TABLE IF NOT EXISTS public.farm_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    area_hectares NUMERIC(6,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_farm_zones_farm ON public.farm_zones(farm_id);

-- 16.5 Crops (Planted instances)
CREATE TABLE IF NOT EXISTS public.crops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_zone_id UUID NOT NULL REFERENCES public.farm_zones(id) ON DELETE CASCADE,
    crop_type VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    planted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    expected_harvest_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'growing' CHECK (status IN ('growing', 'harvested', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_crops_zone ON public.crops(farm_zone_id);

-- 17. Irrigation Topology (Pump -> Valve -> Zone Graph)
CREATE TABLE IF NOT EXISTS public.irrigation_topology (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_device_id UUID NOT NULL REFERENCES public.iot_devices(id) ON DELETE CASCADE, -- e.g., The Pump
    target_device_id UUID REFERENCES public.iot_devices(id) ON DELETE CASCADE, -- e.g., The Valve (Optional)
    farm_zone_id UUID NOT NULL REFERENCES public.farm_zones(id) ON DELETE CASCADE,
    flow_capacity_lph NUMERIC(8,2) NOT NULL DEFAULT 0.0, -- Liters per hour
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 18. Telemetry Quarantine Pipeline (Advanced DLQ)
CREATE TABLE IF NOT EXISTS public.telemetry_quarantine (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID REFERENCES public.iot_devices(id) ON DELETE SET NULL,
    error_reason TEXT NOT NULL,
    raw_payload JSONB NOT NULL,
    schema_version VARCHAR(50) DEFAULT 'v1',
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_telemetry_quarantine_unresolved ON public.telemetry_quarantine(resolved) WHERE resolved = FALSE;

-- 19. Edge Node Identity & Trust (mTLS Certificates)
CREATE TABLE IF NOT EXISTS public.edge_identities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mac_address VARCHAR(100) UNIQUE NOT NULL,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    cert_fingerprint VARCHAR(255) NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    last_connected_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_edge_identities_mac ON public.edge_identities(mac_address);

-- 20. Edge Configuration Versioning
CREATE TABLE IF NOT EXISTS public.edge_deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    edge_id UUID NOT NULL REFERENCES public.edge_identities(id) ON DELETE CASCADE,
    firmware_version VARCHAR(50) NOT NULL,
    rule_version INTEGER NOT NULL DEFAULT 1,
    topology_version INTEGER NOT NULL DEFAULT 1,
    orchestration_version INTEGER NOT NULL DEFAULT 1,
    deployed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 21. Subsidies (Structured Database)
CREATE TABLE IF NOT EXISTS public.subsidies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    agency VARCHAR(255) NOT NULL,
    amount NUMERIC(15, 2),
    amount_type VARCHAR(50) DEFAULT 'fixed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.subsidy_eligibility_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subsidy_id UUID NOT NULL REFERENCES public.subsidies(id) ON DELETE CASCADE,
    state VARCHAR(100),
    crop VARCHAR(100),
    max_land_size_hectares NUMERIC(8,2),
    min_land_size_hectares NUMERIC(8,2),
    social_category VARCHAR(100)
);

-- 22. AI Farm Calendar Engine
CREATE TABLE IF NOT EXISTS public.farm_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_zone_id UUID NOT NULL REFERENCES public.farm_zones(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    assigned_to UUID REFERENCES public.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.farm_timeline_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_zone_id UUID NOT NULL REFERENCES public.farm_zones(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    description TEXT,
    event_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 23. Intelligent Field Navigation
CREATE TABLE IF NOT EXISTS public.field_navigation_paths (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_zone_id UUID NOT NULL REFERENCES public.farm_zones(id) ON DELETE CASCADE,
    path_data JSONB NOT NULL,
    distance_meters NUMERIC(10,2),
    estimated_time_mins INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.spray_coverage_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    path_id UUID NOT NULL REFERENCES public.field_navigation_paths(id) ON DELETE CASCADE,
    coverage_polygon JSONB NOT NULL,
    chemical_used VARCHAR(100),
    amount_liters NUMERIC(8,2),
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 24. Market Anomalies
CREATE TABLE IF NOT EXISTS public.mandi_price_anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market VARCHAR(100) NOT NULL,
    commodity VARCHAR(100) NOT NULL,
    expected_price NUMERIC(12, 2) NOT NULL,
    actual_price NUMERIC(12, 2) NOT NULL,
    anomaly_reason TEXT,
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 25. OTA Releases
CREATE TABLE IF NOT EXISTS public.ota_releases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_code INTEGER NOT NULL,
    version_name VARCHAR(50) NOT NULL,
    download_url TEXT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    release_notes TEXT,
    is_mandatory BOOLEAN DEFAULT FALSE,
    signature_status VARCHAR(50) DEFAULT 'verified',
    released_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 26. AI Farm Memory Engine
CREATE TABLE IF NOT EXISTS public.ai_farm_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_zone_id UUID NOT NULL REFERENCES public.farm_zones(id) ON DELETE CASCADE,
    season VARCHAR(50) NOT NULL, -- e.g. "Kharif 2025"
    crop_id UUID REFERENCES public.crops(id),
    yield_kg NUMERIC(10,2),
    diseases_detected JSONB DEFAULT '[]'::jsonb,
    total_water_used_liters NUMERIC(12,2),
    historical_notes TEXT,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 27. Workflow Orchestrations
CREATE TABLE IF NOT EXISTS public.workflow_orchestrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_type VARCHAR(100) NOT NULL, -- e.g. "irrigation", "subsidy_eval"
    target_id UUID, -- Can be farm_zone_id, crop_id, etc.
    job_id VARCHAR(255), -- BullMQ job ID
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    state_data JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 28. Domain Events Ledger (Event Sourcing)
CREATE TABLE IF NOT EXISTS public.domain_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL, -- CROP_PLANTED, IRRIGATION_STARTED, etc.
    aggregate_id UUID NOT NULL, -- ID of the Crop, Farm, Workflow, etc.
    aggregate_type VARCHAR(50) NOT NULL, -- 'crop', 'workflow', 'device'
    payload JSONB NOT NULL,
    schema_version VARCHAR(50) DEFAULT 'v1',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON public.domain_events(aggregate_id);
CREATE INDEX IF NOT EXISTS idx_domain_events_type_time ON public.domain_events(event_type, created_at DESC);

-- 29. Disease Scans (Anonymous on-device telemetry logs)
CREATE TABLE IF NOT EXISTS public.disease_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disease_name VARCHAR(100) NOT NULL,
    crop_name VARCHAR(100) NOT NULL DEFAULT 'General',
    state VARCHAR(100) NOT NULL,
    district VARCHAR(100) NOT NULL DEFAULT '',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    severity VARCHAR(50) NOT NULL DEFAULT 'Moderate',
    confidence INTEGER NOT NULL DEFAULT 90 CHECK (confidence BETWEEN 0 AND 100),
    scanned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_disease_scans_state_disease_time ON public.disease_scans(state, disease_name, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_disease_scans_time ON public.disease_scans(scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_disease_scans_crop ON public.disease_scans(crop_name);

-- 30. State Adjacencies (Symmetric Indian State Boundary Graph)
CREATE TABLE IF NOT EXISTS public.state_adjacencies (
    id SERIAL PRIMARY KEY,
    state VARCHAR(100) NOT NULL,
    neighbor_state VARCHAR(100) NOT NULL,
    border_risk_weight NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_state_neighbor UNIQUE (state, neighbor_state)
);
CREATE INDEX IF NOT EXISTS idx_state_adjacencies_state ON public.state_adjacencies(state);
CREATE INDEX IF NOT EXISTS idx_state_adjacencies_neighbor ON public.state_adjacencies(neighbor_state);

-- 31. Outbreak Alerts (Epicenters & Early Warnings)
CREATE TABLE IF NOT EXISTS public.outbreak_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    disease_name VARCHAR(100) NOT NULL,
    source_state VARCHAR(100) NOT NULL,
    target_state VARCHAR(100) NOT NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('EPICENTER', 'EARLY_WARNING')),
    severity VARCHAR(50) NOT NULL DEFAULT 'MODERATE' CHECK (severity IN ('LOW', 'MODERATE', 'HIGH', 'CRITICAL')),
    scan_count INTEGER NOT NULL DEFAULT 0,
    threshold_density INTEGER NOT NULL DEFAULT 100,
    time_window_hours INTEGER NOT NULL DEFAULT 168,
    message TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    predicted_market_impact_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_outbreak_alert_state UNIQUE (disease_name, source_state, target_state, alert_type)
);
CREATE INDEX IF NOT EXISTS idx_outbreak_alerts_target_active ON public.outbreak_alerts(target_state, is_active);
CREATE INDEX IF NOT EXISTS idx_outbreak_alerts_source_disease ON public.outbreak_alerts(source_state, disease_name);
CREATE INDEX IF NOT EXISTS idx_outbreak_alerts_disease_active ON public.outbreak_alerts(disease_name, is_active);

-- Trigger Function for Outbreak Density Evaluation & Early Warning Fan-out
CREATE OR REPLACE FUNCTION public.fn_evaluate_disease_outbreak()
RETURNS TRIGGER AS $$
DECLARE
    v_scan_count INTEGER;
    v_window_hours INTEGER := 168; -- 7 days rolling window
    v_threshold INTEGER := 100;
    v_severity VARCHAR(50);
    v_epicenter_msg TEXT;
    v_epicenter_action TEXT;
    v_epicenter_impact NUMERIC(6,2);
    v_neighbor_record RECORD;
    v_neighbor_msg TEXT;
    v_neighbor_action TEXT;
    v_neighbor_impact NUMERIC(6,2);
BEGIN
    SELECT COUNT(*)
    INTO v_scan_count
    FROM public.disease_scans
    WHERE disease_name = NEW.disease_name
      AND state = NEW.state
      AND scanned_at >= NOW() - (v_window_hours || ' hours')::INTERVAL;

    IF v_scan_count >= v_threshold THEN
        IF v_scan_count >= 300 THEN
            v_severity := 'CRITICAL';
            v_epicenter_impact := 35.00;
            v_neighbor_impact := 20.00;
        ELSIF v_scan_count >= 200 THEN
            v_severity := 'HIGH';
            v_epicenter_impact := 25.00;
            v_neighbor_impact := 15.00;
        ELSE
            v_severity := 'MODERATE';
            v_epicenter_impact := 15.00;
            v_neighbor_impact := 8.00;
        END IF;

        v_epicenter_msg := 'CRITICAL OUTBREAK DETECTED: ' || NEW.disease_name || ' outbreak confirmed in ' || NEW.state || ' with ' || v_scan_count || ' recent scan detections crossing density threshold (' || v_threshold || ').';
        v_epicenter_action := 'Deploy immediate containment, quarantine affected fields, apply targeted chemical/biological fungicides or insecticides, and alert local Krishi Vigyan Kendra (KVK).';

        -- 1. Upsert EPICENTER alert for source state
        INSERT INTO public.outbreak_alerts (
            disease_name,
            source_state,
            target_state,
            alert_type,
            severity,
            scan_count,
            threshold_density,
            time_window_hours,
            message,
            recommended_action,
            predicted_market_impact_pct,
            is_active,
            updated_at
        ) VALUES (
            NEW.disease_name,
            NEW.state,
            NEW.state,
            'EPICENTER',
            v_severity,
            v_scan_count,
            v_threshold,
            v_window_hours,
            v_epicenter_msg,
            v_epicenter_action,
            v_epicenter_impact,
            TRUE,
            NOW()
        )
        ON CONFLICT (disease_name, source_state, target_state, alert_type)
        DO UPDATE SET
            severity = EXCLUDED.severity,
            scan_count = EXCLUDED.scan_count,
            message = EXCLUDED.message,
            recommended_action = EXCLUDED.recommended_action,
            predicted_market_impact_pct = EXCLUDED.predicted_market_impact_pct,
            is_active = TRUE,
            updated_at = NOW();

        -- 2. Fan out EARLY_WARNING alerts for all adjacent neighboring states
        FOR v_neighbor_record IN
            SELECT neighbor_state, border_risk_weight
            FROM public.state_adjacencies
            WHERE state = NEW.state
        LOOP
            v_neighbor_msg := 'EARLY WARNING: Outbreak of ' || NEW.disease_name || ' detected in neighboring ' || NEW.state || ' (' || v_scan_count || ' active scans). High risk of trans-boundary spore/pest vector transmission to ' || v_neighbor_record.neighbor_state || '.';
            v_neighbor_action := 'Inspect border district fields daily, prepare preventative spraying protocols, and monitor Mandi arrivals from ' || NEW.state || '.';

            INSERT INTO public.outbreak_alerts (
                disease_name,
                source_state,
                target_state,
                alert_type,
                severity,
                scan_count,
                threshold_density,
                time_window_hours,
                message,
                recommended_action,
                predicted_market_impact_pct,
                is_active,
                updated_at
            ) VALUES (
                NEW.disease_name,
                NEW.state,
                v_neighbor_record.neighbor_state,
                'EARLY_WARNING',
                CASE WHEN v_severity = 'CRITICAL' THEN 'HIGH' ELSE 'MODERATE' END,
                v_scan_count,
                v_threshold,
                v_window_hours,
                v_neighbor_msg,
                v_neighbor_action,
                ROUND(v_neighbor_impact * v_neighbor_record.border_risk_weight, 2),
                TRUE,
                NOW()
            )
            ON CONFLICT (disease_name, source_state, target_state, alert_type)
            DO UPDATE SET
                severity = EXCLUDED.severity,
                scan_count = EXCLUDED.scan_count,
                message = EXCLUDED.message,
                recommended_action = EXCLUDED.recommended_action,
                predicted_market_impact_pct = EXCLUDED.predicted_market_impact_pct,
                is_active = TRUE,
                updated_at = NOW();
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_disease_scan_outbreak_eval ON public.disease_scans;
CREATE TRIGGER trg_disease_scan_outbreak_eval
AFTER INSERT ON public.disease_scans
FOR EACH ROW
EXECUTE FUNCTION public.fn_evaluate_disease_outbreak();

-- Row Level Security (RLS) Policies
ALTER TABLE public.disease_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_adjacencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbreak_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read and write on disease_scans') THEN
        CREATE POLICY "Allow public read and write on disease_scans" ON public.disease_scans FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read and write on state_adjacencies') THEN
        CREATE POLICY "Allow public read and write on state_adjacencies" ON public.state_adjacencies FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read and write on outbreak_alerts') THEN
        CREATE POLICY "Allow public read and write on outbreak_alerts" ON public.outbreak_alerts FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- 32. GramHaul Shared Logistics Truck Listings
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.truck_listings (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    driver_name TEXT NOT NULL,
    driver_phone TEXT NOT NULL,
    vehicle_type TEXT NOT NULL DEFAULT 'Tata 407 (Heavy Duty)',
    vehicle_plate TEXT NOT NULL,
    capacity_tons NUMERIC(5,2) DEFAULT 3.0,
    total_bags_capacity INTEGER NOT NULL DEFAULT 30,
    filled_bags INTEGER NOT NULL DEFAULT 0,
    rate_per_bag NUMERIC(8,2) NOT NULL DEFAULT 45.00,
    rate_per_km NUMERIC(8,2) DEFAULT 20.00,
    solo_rate NUMERIC(10,2) DEFAULT 1800.00,
    origin_village TEXT NOT NULL,
    destination_mandi TEXT NOT NULL,
    departure_time TEXT NOT NULL,
    pickup_eta TEXT DEFAULT '30 mins',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    is_cold_chain BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FULL', 'DEPARTED', 'CANCELLED')),
    rating NUMERIC(2,1) DEFAULT 4.9,
    trips_count INTEGER DEFAULT 25,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_truck_listings_status ON public.truck_listings(status);
CREATE INDEX IF NOT EXISTS idx_truck_listings_coords ON public.truck_listings(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_truck_listings_created_at ON public.truck_listings(created_at DESC);

ALTER TABLE public.truck_listings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on truck_listings') THEN
        CREATE POLICY "Allow public read on truck_listings" ON public.truck_listings FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on truck_listings') THEN
        CREATE POLICY "Allow public insert on truck_listings" ON public.truck_listings FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update on truck_listings') THEN
        CREATE POLICY "Allow public update on truck_listings" ON public.truck_listings FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete on truck_listings') THEN
        CREATE POLICY "Allow public delete on truck_listings" ON public.truck_listings FOR DELETE USING (true);
    END IF;
END $$;

INSERT INTO public.truck_listings (
    id, driver_name, driver_phone, vehicle_type, vehicle_plate, 
    capacity_tons, total_bags_capacity, filled_bags, rate_per_bag, 
    rate_per_km, solo_rate, origin_village, destination_mandi, departure_time, 
    pickup_eta, latitude, longitude, is_cold_chain, status, rating, trips_count
) VALUES
(
    'TRK-8419', 'Ramesh Yadav', '+91 98492 11048', 'Tata 407 (Heavy Duty)', 'TS-03-UB-8419',
    3.5, 30, 22, 45.00,
    22.00, 1800.00, 'Narsampet Rural', 'Warangal Enumamula APMC Yard', 'Today, 4:30 PM',
    '25 mins', 17.9750, 79.5990, FALSE, 'ACTIVE', 4.9, 142
),
(
    'TRK-4920', 'K. Venkatesham', '+91 94401 77391', 'Eicher Pro 2049 (Express)', 'AP-36-TA-4920',
    5.0, 45, 31, 65.00,
    28.00, 2800.00, 'Station Road, Warangal', 'Bowenpally APMC, Hyderabad', 'Today, 6:00 PM',
    '45 mins', 17.9880, 79.6150, FALSE, 'ACTIVE', 4.8, 98
),
(
    'TRK-1102', 'Md. Ismail Khan', '+91 99890 32184', 'Mahindra Bolero Maxi Truck', 'TS-04-EA-1102',
    2.0, 20, 14, 45.00,
    18.00, 1400.00, 'Mulugu Hub', 'Warangal Enumamula APMC Yard', 'Today, 5:15 PM',
    '35 mins', 17.9620, 79.6050, FALSE, 'ACTIVE', 4.9, 210
),
(
    'TRK-3391', 'Gurpreet Singh', '+91 98765 43210', 'Tata Ace (Chhota Hathi)', 'PB-10-CZ-3391',
    1.5, 15, 5, 40.00,
    16.00, 1200.00, 'Kazipet Mandi Gate', 'Warangal APMC Yard', 'Today, 5:45 PM',
    '20 mins', 17.9820, 79.5820, FALSE, 'ACTIVE', 5.0, 36
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 20. Interactive Kisan Community Features (Posts, Likes, Follows)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.community_posts (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    author_name TEXT NOT NULL,
    author_village TEXT,
    avatar_url TEXT,
    crop_id TEXT,
    title TEXT NOT NULL,
    content TEXT,
    body TEXT,
    media_url TEXT,
    media_type TEXT,
    media_label TEXT,
    likes_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.community_posts 
ADD COLUMN IF NOT EXISTS user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_community_posts_user_id ON public.community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_crop_id ON public.community_posts(crop_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON public.community_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS public.post_likes (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    post_id TEXT NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_post_likes UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_created_at ON public.post_likes(created_at DESC);

CREATE TABLE IF NOT EXISTS public.user_follows (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    follower_id TEXT NOT NULL,
    following_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_follows UNIQUE (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_created_at ON public.user_follows(created_at DESC);

CREATE OR REPLACE FUNCTION public.fn_sync_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.community_posts
        SET likes_count = COALESCE(likes_count, 0) + 1,
            updated_at = NOW()
        WHERE id = NEW.post_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.community_posts
        SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1),
            updated_at = NOW()
        WHERE id = OLD.post_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_likes_count ON public.post_likes;
CREATE TRIGGER trg_post_likes_count
AFTER INSERT OR DELETE ON public.post_likes
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_post_likes_count();

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on community_posts') THEN
        CREATE POLICY "Allow public read on community_posts" ON public.community_posts FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on community_posts') THEN
        CREATE POLICY "Allow public insert on community_posts" ON public.community_posts FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow author update on community_posts') THEN
        CREATE POLICY "Allow author update on community_posts" ON public.community_posts FOR UPDATE USING (
            auth.uid()::text = user_id OR auth.role() = 'service_role' OR user_id IS NULL
        ) WITH CHECK (
            auth.uid()::text = user_id OR auth.role() = 'service_role' OR user_id IS NULL
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow author delete on community_posts') THEN
        CREATE POLICY "Allow author delete on community_posts" ON public.community_posts FOR DELETE USING (
            auth.uid()::text = user_id OR auth.role() = 'service_role' OR user_id IS NULL
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on post_likes') THEN
        CREATE POLICY "Allow public read on post_likes" ON public.post_likes FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on post_likes') THEN
        CREATE POLICY "Allow public insert on post_likes" ON public.post_likes FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update on post_likes') THEN
        CREATE POLICY "Allow public update on post_likes" ON public.post_likes FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete on post_likes') THEN
        CREATE POLICY "Allow public delete on post_likes" ON public.post_likes FOR DELETE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read on user_follows') THEN
        CREATE POLICY "Allow public read on user_follows" ON public.user_follows FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public insert on user_follows') THEN
        CREATE POLICY "Allow public insert on user_follows" ON public.user_follows FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public update on user_follows') THEN
        CREATE POLICY "Allow public update on user_follows" ON public.user_follows FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public delete on user_follows') THEN
        CREATE POLICY "Allow public delete on user_follows" ON public.user_follows FOR DELETE USING (true);
    END IF;
END $$;


