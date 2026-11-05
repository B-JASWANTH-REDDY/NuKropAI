# NuKropAI Master Application Feature Inventory

**Repository Baseline**: `feature/nukropai-complete-production-remediation`  
**Execution Environment**: Staging / Preview Only  
**PR #2 Status**: OPEN and UNMERGED  
**Date**: November 2026  

---

## 1. Executive Overview

This document establishes the canonical feature inventory of the NuKropAI Agrarian Operating System across all six core product pillars. Every feature is categorized under strict evidentiary standards:
- **IMPLEMENTED AND VERIFIED**: Functionality fully coded, connected end-to-end, and verified through automated test suites and live execution.
- **IMPLEMENTED BUT NOT VERIFIED**: Code complete, awaiting external physical hardware or external provider sandbox access.
- **BLOCKED BY EXTERNAL DEPENDENCY**: Dependency on physical hardware (e.g. physical Android handset on cellular network) or external financial gateway credentials honestly disclosed without synthetic mocks.

---

## 2. Pillar 1: Weather Intelligence

| Feature ID | Feature Description | Status | Authoritative Implementation | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **WI.1** | Current Weather Conditions | `IMPLEMENTED AND VERIFIED` | `app/src/main/assets/index.html` (lines 25680-25735, 26172-26265) | `tests/test_weather_intelligence.js: WI-1, WI-5` |
| **WI.2** | Temperature & Feels-Like | `IMPLEMENTED AND VERIFIED` | Open-Meteo Agricultural API (`current=temperature_2m,relative_humidity_2m`) | `tests/test_weather_intelligence.js: WI-5` |
| **WI.3** | Humidity & Surface Pressure | `IMPLEMENTED AND VERIFIED` | Open-Meteo `relative_humidity_2m`, `surface_pressure` | `tests/test_weather_intelligence.js: WI-5` |
| **WI.4** | Wind Speed & Direction | `IMPLEMENTED AND VERIFIED` | Open-Meteo `wind_speed_10m` parsed and evaluated | `tests/test_weather_intelligence.js: WI-4, WI-5` |
| **WI.5** | Rainfall & Precipitation | `IMPLEMENTED AND VERIFIED` | Open-Meteo `precipitation`, hourly & daily precipitation sums | `tests/test_weather_intelligence.js: WI-4, WI-5` |
| **WI.6** | Daily Max/Min Forecasts | `IMPLEMENTED AND VERIFIED` | Open-Meteo `daily=temperature_2m_max,temperature_2m_min` | `tests/test_weather_intelligence.js: WI-5` |
| **WI.7** | Sunrise, Sunset & Day Progress | `IMPLEMENTED AND VERIFIED` | `getAstronomicalState()` astronomical curve calculation | `tests/test_weather_intelligence.js: WI-2` |
| **WI.8** | Spray Safety Window Advisory | `IMPLEMENTED AND VERIFIED` | Evaluates wind speed (<15 km/h) & precipitation (<1 mm) | `tests/test_weather_intelligence.js: WI-4` |
| **WI.9** | Farm-Specific Geocoding | `IMPLEMENTED AND VERIFIED` | OpenStreetMap Nominatim reverse geocode via hardware GPS | `tests/test_weather_intelligence.js: WI-5` |
| **WI.10** | Provenance & Cache Status | `IMPLEMENTED AND VERIFIED` | `liveWeather.status` strictly tracks `LIVE`, `CACHED`, `UNAVAILABLE` | `tests/test_weather_intelligence.js: WI-1, WI-6` |
| **WI.11** | Offline Resiliency & Fallback | `IMPLEMENTED AND VERIFIED` | `localStorage` caching with clear `CACHED` badge display | `tests/test_mandatory_user_journeys.js: JOURNEY-G` |
| **WI.12** | Android Home-Screen Widget Sync | `IMPLEMENTED AND VERIFIED` | Native bridge `syncWeatherToAndroidWidget()` & `WeatherWidgetProvider` | `tests/test_weather_intelligence.js: WI-5`, `test_android_widgets_integration.js: AW-1` |

---

## 3. Pillar 2: Mandi Intelligence

| Feature ID | Feature Description | Status | Authoritative Implementation | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **MI.1** | Popular Crop Pill Filtering | `IMPLEMENTED AND VERIFIED` | `selectPopularMandiCrop()`, `popularMap` canonical lookup | `tests/test_mandi_phase51_regression_audit.js: AUDIT-1.1, AUDIT-1.6` |
| **MI.2** | Manual Search After Pill Select | `IMPLEMENTED AND VERIFIED` | Real-time input listener clears/deselection synchronization | `tests/test_mandi_phase51_regression_audit.js: AUDIT-1.2, AUDIT-1.3` |
| **MI.3** | Clear Search Reset | `IMPLEMENTED AND VERIFIED` | Backspacing/clearing resets popular selection to 'all' | `tests/test_mandi_phase51_regression_audit.js: AUDIT-1.4, AUDIT-1.5` |
| **MI.4** | Canonical Commodity Classification | `IMPLEMENTED AND VERIFIED` | Strict separation: Cotton vs Cotton Seed; Potato vs Yam; Chilli vs Capsicum | `tests/test_mandi_phase51_regression_audit.js: AUDIT-2.1 - AUDIT-2.7` |
| **MI.5** | Multilingual & Phonetic Aliases | `IMPLEMENTED AND VERIFIED` | English, Telugu (పత్తి), Hindi (कपास), Romanized (kapas, narma) | `tests/test_mandi_phase51_regression_audit.js: AUDIT-3` (23 multilingual tests) |
| **MI.6** | Strict Location Locking | `IMPLEMENTED AND VERIFIED` | State and APMC market isolation with zero cross-state leakage | `tests/test_mandi_strict_location_lock.js: SLL.1 - SLL.26` |
| **MI.7** | Real Provider Provenance Tiers | `IMPLEMENTED AND VERIFIED` | Tier 1 (Govt Live API), Tier 2 (Cached), Tier 3 (Historical DMI) | `tests/test_mandi_phase51_regression_audit.js: AUDIT-5.1 - AUDIT-5.3` |
| **MI.8** | Native Android Mandi Widget Sync | `IMPLEMENTED AND VERIFIED` | `syncMandiToAndroidWidget()` & `MandiWidgetProvider` | `tests/test_android_widgets_integration.js: AW-2, AW-4` |

---

## 4. Pillar 3: Land Survey Intelligence

| Feature ID | Feature Description | Status | Authoritative Implementation | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **LS.1** | Land Information Hierarchy | `IMPLEMENTED AND VERIFIED` | State → District → Mandal → Revenue Village → Survey No → Subdivision | `tests/test_land_survey_intelligence.js: LSI-8, LSI-17` |
| **LS.2** | Authorized Source Policy | `IMPLEMENTED AND VERIFIED` | Source registry (`APPROVED`, `PENDING_AUTHORIZATION`, `PROHIBITED`) | `tests/test_land_survey_intelligence.js: LSI-1, LSI-27, LSI-30` |
| **LS.3** | Official Portal Handoff | `IMPLEMENTED AND VERIFIED` | Strict HTTPS allowlist for Bhu Bharati, Meebhoomi, UP Bhulekh | `tests/test_land_survey_intelligence.js: LSI-8, LSI-18, LSI-36` |
| **LS.4** | GeoJSON Geometry Validation | `IMPLEMENTED AND VERIFIED` | Server-side polygon validation (EPSG:4326, closed rings, vertex count) | `tests/test_land_survey_intelligence.js: LSI-21 - LSI-24` |
| **LS.5** | No Fake Parcel Polygons | `IMPLEMENTED AND VERIFIED` | `GEOMETRY_UNAVAILABLE` honest badge when official geometry is absent | `tests/test_land_survey_intelligence.js: LSI-4, LSI-7, LSI-28` |
| **LS.6** | Farmer Claimed vs Verified Status | `IMPLEMENTED AND VERIFIED` | `claim_status = FARMER_CLAIMED` (never spoofed as government-verified) | `tests/test_land_survey_intelligence.js: LSI-3, LSI-5` |
| **LS.7** | Tenant-Isolated Document Storage | `IMPLEMENTED AND VERIFIED` | Supabase Private Storage with strict RLS and magic number verification | `tests/test_land_survey_pipeline_audit.js: DPA-1 - DPA-6` |
| **LS.8** | DPDP User Consent Enforcement | `IMPLEMENTED AND VERIFIED` | Upload blocked without explicit `user_consent_granted = true` | `tests/test_land_survey_intelligence.js: LSI-32, LSI-37` |

---

## 5. Pillar 4: GramHaul Freight & Dispatch

| Feature ID | Feature Description | Status | Authoritative Implementation | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **GH.1** | Driver Duty ON / OFF Lifecycle | `IMPLEMENTED AND VERIFIED` | `DriverLocationService` foreground tracking & database state | `tests/test_gramhaul_phase45_hardening.js: Section 5` |
| **GH.2** | Server-Authoritative Assignment | `IMPLEMENTED AND VERIFIED` | Prevents double-booking and assignment race conditions | `tests/test_gramhaul_phase45_hardening.js: Section 3` |
| **GH.3** | Server-Keyed HMAC Pickup OTP | `IMPLEMENTED AND VERIFIED` | HMAC-SHA256 with server secret, timing-safe compare | `tests/test_gramhaul_phase45_hardening.js: Section 1` |
| **GH.4** | AES-256-GCM Encrypted Delivery | `IMPLEMENTED AND VERIFIED` | Ephemeral encrypted storage with TTL, authenticated farmer-only | `tests/test_gramhaul_phase45_hardening.js: Section 2, Section 4` |
| **GH.5** | Real Network Live TCP Tracking | `IMPLEMENTED AND VERIFIED` | WebSocket protocol with monotonic sequence ordering & sync_since | `tests/test_gramhaul_phase45_hardening.js: Section 3` |
| **GH.6** | Rental / Haul Vehicle Conflict Lock | `IMPLEMENTED AND VERIFIED` | Reserved rental vehicles cannot be placed ON DUTY for freight | `tests/test_gramhaul_phase45_hardening.js: Section 5` |
| **GH.7** | Transparent Financial Ledger | `IMPLEMENTED AND VERIFIED` | Explicit settlement status (`PENDING_GATEWAY_INTEGRATION`, no fake payments) | `tests/test_gramhaul_phase45_hardening.js: Section 5` |
| **GH.8** | Physical Cellular Device Testing | `BLOCKED BY EXTERNAL DEPENDENCY` | Physical Android handset not connected to ADB | Explicitly documented as `PHYSICAL_DEVICE_TEST_NOT_PERFORMED` |

---

## 6. Pillar 5: Community & Kisan Network

| Feature ID | Feature Description | Status | Authoritative Implementation | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **CM.1** | Clean Empty Feed (No Fake Posts) | `IMPLEMENTED AND VERIFIED` | `COMMUNITY_POSTS_CATALOG` initializes empty on fresh sessions | `tests/verify_milestone3_community.js: M3.14` |
| **CM.2** | Authentic User Story Rehydration | `IMPLEMENTED AND VERIFIED` | `COMMUNITY_STORIES_CATALOG` loads genuine user & extension stories | `tests/test_community_stories_and_real_posts.js: CS.1, CS.5` |
| **CM.3** | Neutral Initials Avatars | `IMPLEMENTED AND VERIFIED` | `getNeutralInitials()` circle (no role-based faces or generated photos) | `tests/test_community_stories_and_real_posts.js: CS.2`, `index.html` line 22100 |
| **CM.4** | Story Creation & Media Publishing | `IMPLEMENTED AND VERIFIED` | `publishUserStory()` validates media before prepending to feed | `tests/test_community_stories_and_real_posts.js: CS.4` |
| **CM.5** | Story Viewer Stability | `IMPLEMENTED AND VERIFIED` | `openInstagramStoryModal()` safely handles empty catalog & out-of-bounds | `tests/test_community_stories_and_real_posts.js: CS.6` |
| **CM.6** | Real Post Creation & Persistence | `IMPLEMENTED AND VERIFIED` | `submitNewCommunityPost()` binds real farmer name & village | `tests/test_community_stories_and_real_posts.js: CS.7` |
| **CM.7** | Real Commenting System | `IMPLEMENTED AND VERIFIED` | `submitCommunityComment()` appends comment with `(You)` attribution | `tests/test_community_stories_and_real_posts.js: CS.8` |
| **CM.8** | Post Liking with Optimistic Rollback | `IMPLEMENTED AND VERIFIED` | `toggleCommunityLike()` updates cache, heart-pop, dispatches Supabase | `tests/verify_milestone3_community.js: M3.9` |
| **CM.9** | Follow / Unfollow System | `IMPLEMENTED AND VERIFIED` | `toggleFollowUser()` maintains following cache and Supabase sync | `tests/verify_milestone3_community.js: M3.10` |
| **CM.10** | Post Ownership & Deletion Security | `IMPLEMENTED AND VERIFIED` | `isOwnCommunityPost()` enforces user_id check before edit/delete | `tests/verify_milestone3_community.js: M3.11 - M3.13` |

---

## 7. Pillar 6: Android Home-Screen Widgets

| Feature ID | Feature Description | Status | Authoritative Implementation | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **AW.1** | Native Weather AppWidget Layout | `IMPLEMENTED AND VERIFIED` | `app/src/main/res/layout/widget_weather.xml` | `tests/test_android_widgets_integration.js: AW-1` |
| **AW.2** | Native Mandi AppWidget Layout | `IMPLEMENTED AND VERIFIED` | `app/src/main/res/layout/widget_mandi.xml` | `tests/test_android_widgets_integration.js: AW-2` |
| **AW.3** | Widget Provider Metadata | `IMPLEMENTED AND VERIFIED` | `app/src/main/res/xml/weather_widget_info.xml`, `mandi_widget_info.xml` | `tests/test_android_widgets_integration.js: AW-3` |
| **AW.4** | Kotlin AppWidgetProviders | `IMPLEMENTED AND VERIFIED` | `WeatherWidgetProvider.kt`, `MandiWidgetProvider.kt` | `tests/test_android_widgets_integration.js: AW-4`, `AndroidWidgetsTest.kt` |
| **AW.5** | WorkManager Periodic Sync | `IMPLEMENTED AND VERIFIED` | `WidgetUpdateWorker.kt` (30m periodic sync) | `tests/test_android_widgets_integration.js: AW-4` |
| **AW.6** | Deep Link Screen Navigation | `IMPLEMENTED AND VERIFIED` | `nukrop://screen/home` and `nukrop://screen/market` | `tests/test_android_widgets_integration.js: AW-5, AW-6` |
| **AW.7** | AndroidBridge Data Sync | `IMPLEMENTED AND VERIFIED` | `updateWeatherWidget()`, `updateMandiWidget()` | `tests/test_android_widgets_integration.js: AW-6, AW-7` |
| **AW.8** | Logout & Account Privacy Isolation | `IMPLEMENTED AND VERIFIED` | `clearWidgetData()` resets widget to locked prompt on sign-out | `tests/test_android_widgets_integration.js: AW-6`, `AndroidWidgetsTest.kt` |
