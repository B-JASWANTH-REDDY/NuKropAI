# NuKropAI — Flutter Full-Stack Integration Map

## Executive Summary
This document delineates the network communication architecture, endpoint mapping, data contracts, and real-time synchronizations connecting the Flutter mobile client (`flutter_app/`) to the Fastify enterprise backend (`backend/`) and Supabase PostgreSQL database.

---

## 1. System Communication Architecture

```mermaid
sequenceDiagram
    autonumber
    actor Farmer as Farmer (Flutter Mobile)
    participant API as Fastify API Gateway (:3000)
    participant Redis as Redis Queue & Cache
    participant DB as Supabase PostgreSQL / PostGIS
    participant Agmark as Government Mandi Portal

    Farmer->>API: POST /api/v1/auth/login (Phone + OTP)
    API->>DB: Verify credentials & role metadata
    DB-->>API: User profile & role claims
    API-->>Farmer: Access JWT (15m) + Refresh Token (7d HTTP-only)

    Farmer->>API: GET /api/v1/mandi/rates?lat=17.96&lon=79.59
    API->>Redis: Check APMC proximity cache
    alt Cache Hit
        Redis-->>API: Cached APMC rates
    else Cache Miss
        API->>DB: Spatial query (ST_DWithin 50km)
        DB-->>API: Live APMC transactions
        API->>Redis: Set TTL 600s
    end
    API-->>Farmer: Standardized Mandi Rates JSON

    Farmer->>API: POST /api/v1/scanner/diagnose (Foliar Image)
    API->>API: Validate image authenticity (Reject non-crop samples)
    API-->>Farmer: Diagnosis: Cotton Leaf Curl Virus (96% Conf) + ICAR Rx
```

---

## 2. API Endpoint Directory

| Category | HTTP Method & Path | Flutter Client Caller | Backend Handler | Database / Target |
| :--- | :--- | :--- | :--- | :--- |
| **Auth** | `POST /api/v1/auth/register` | `ApiClient.register` | `auth.controller.ts` | `users`, `farmer_profiles` |
| **Auth** | `POST /api/v1/auth/login` | `ApiClient.login` | `auth.controller.ts` | `users`, `refresh_tokens` |
| **Auth** | `POST /api/v1/auth/refresh` | `ApiClient.refreshToken`| `auth.controller.ts` | Token rotation table |
| **Mandi** | `GET /api/v1/mandi/rates` | `ApiClient.getMandiRates` | `mandi.controller.ts` | `mandi_prices`, PostGIS |
| **Community**| `GET /api/v1/community/feed`| `ApiClient.getPosts` | `community.controller.ts`| `posts`, `comments` |
| **Scanner**| `POST /api/v1/scanner/diagnose`| `ApiClient.diagnoseCrop` | `scanner.controller.ts` | Groq Vision / ICAR db |
| **Freight** | `POST /api/v1/trips/book` | `ApiClient.bookTrip` | `trip.controller.ts` | `trips`, `driver_locations` |
| **Ledger** | `POST /api/v1/khata/entries`| `ApiClient.saveKhata` | `khata.controller.ts` | `farm_khata_ledger` |
| **Health** | `GET /health` | App initialization | `server.ts` | PostgreSQL ping |
