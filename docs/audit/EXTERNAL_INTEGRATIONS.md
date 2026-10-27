# NuKropAI — External Integrations & Provider Specifications
**Document ID**: `docs/audit/EXTERNAL_INTEGRATIONS.md`  
**Repository**: `B-JASWANTH-REDDY/NuKropAI`  
**Audit Date**: 2026-10-16  
**Auditor**: Principal Systems Architect  

---

## 1. Government APMC Mandi Integration (Agmarknet / DMI)

### 1.1 Specification & Endpoints
- **Provider**: Directorate of Marketing & Inspection (DMI), Ministry of Agriculture and Farmers Welfare, Government of India.
- **Authoritative Endpoint**: `https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070`
- **Authentication**: Strict server-side API Key passed via `api-key` parameter. Never exposed to Android client or web browser bundles.
- **Rate Limits & Polling Rules**: Maximum 5,000 records per page; polite 1.0s delay between pagination batches; maximum 5 retries with exponential backoff on HTTP 429.
- **Data Freshness Contract**:
  - `Daily`: Arrival date matches `CURRENT_DATE`.
  - `Recent`: Arrival date within last 3 days.
  - `Delayed`: Arrival date older than 3 days.
- **Fallback Architecture**: When the government upstream API encounters outages or rate limits, the application serves verified cached records from Supabase `public.mandi_live_rates` with an explicit `"Cached Offline"` badge. Never generates fabricated synthetic price records.

---

## 2. Weather & Agronomic Spray Advisory (Open-Meteo)

### 2.1 Specification & Endpoints
- **Provider**: Open-Meteo High-Resolution Non-Commercial API (WMO 40-year reanalysis models).
- **Endpoint**: `https://api.open-meteo.com/v1/forecast`
- **Parameters**: `latitude`, `longitude`, `hourly=temperature_2m,relative_humidity_2m,precipitation_probability,rain,wind_speed_10m`.
- **Agronomic Spray Window Suitability Matrix**:
  - **Wind Speed**: Must be between `3.0 km/h` and `15.0 km/h`. (Speeds `< 3.0 km/h` risk chemical drift via inversion; speeds `> 15.0 km/h` cause droplet drift away from target foliar canopy).
  - **Temperature**: Must be between `15.0°C` and `32.0°C`. (Temperatures `> 32.0°C` cause rapid droplet evaporation and foliar phytotoxicity).
  - **Precipitation Probability**: Must be `< 25%` and Rain must be `0.0 mm` within the 3-hour application window (to prevent chemical wash-off before systemic absorption).
  - **Relative Humidity**: Optimal between `50%` and `80%`.

---

## 3. Agricultural Vision & Foliar Intelligence (Gemini / Groq)

### 3.1 Model Specification & Endpoints
- **Vision Model**: Google Gemini 1.5 Pro / Flash via Google AI Studio API (`v1beta/models/gemini-1.5-flash:generateContent`).
- **Input Constraints & Optimization**:
  - High-resolution camera captures (15MB-30MB) are downsampled via `compressAndDownsampleImage` to a maximum bounding box of `1024x1024` and compressed to JPEG 85% (~200KB).
  - Prevents heap `OutOfMemoryError` on budget rural smartphones (2GB-3GB RAM) and eliminates HTTP 413 Payload Too Large rejections.
- **Response Format**: Strictly structured JSON:
  ```json
  {
    "disease_name": "Cotton Leaf Curl Virus",
    "crop": "Cotton",
    "confidence_score": 0.96,
    "severity": "CRITICAL",
    "causal_organism": "Begomovirus (transmitted by Bemisia tabaci)",
    "symptoms": ["Upward leaf curling", "Thickened foliar veins", "Enation"],
    "immediate_action": "Spray Diafenthiuron 50% WP @ 1.25g/L to control vector whiteflies",
    "organic_control": "Neem oil 10,000 ppm @ 3ml/L water"
  }
  ```
- **Failsafe Offline Fallback**: If network is disconnected or the AI gateway is unreachable, the system automatically falls back to the embedded botanical disease catalog (`DiseaseDetector.kt`) to ensure farmers are never left without agronomic guidance.

---

## 4. Maps, Routing & Logistics (OSRM & Leaflet)

### 4.1 Routing Engine
- **Provider**: Open Source Routing Machine (OSRM) Demo Cluster.
- **Endpoint**: `https://router.project-osrm.org/route/v1/driving/{coords}?overview=full&geometries=geojson`
- **Output**: Accurate driving distance in kilometers, estimated travel duration in minutes, and complete polyline coordinates for real-time map rendering.
- **Failover Geometry**: If OSRM is unreachable, the client computes great-circle distance via the Haversine formula with a rural road curvature factor of `1.28x`.

---

## 5. IoT & Farm Hardware Gateway (Tuya, Shelly, MQTT, GSM)

### 5.1 Protocol Support & Architecture
- **Abstraction Layer**: Universal `IoTGateway` (`backend/src/iot/Gateway.ts`) routes high-level agricultural commands (`MOTOR_ON`, `MOTOR_OFF`, `READ_SENSORS`) to protocol-specific adapters.
- **MQTT**: Real-time bidirectional broker connection via TLS for field telemetry nodes (soil moisture, battery voltage, solar pump RPM).
- **Tuya / Smart Life**: Cloud open API integration for smart motor starters and circuit breakers.
- **Shelly**: Direct local HTTP REST relay triggers for solenoid irrigation valves.
- **Event Sourcing & Dead Letter Queue**: Every command is logged into `iot_commands_queue` as `pending` and verified asynchronously via incoming telemetry within a 15-second fail-safe timeout window.
