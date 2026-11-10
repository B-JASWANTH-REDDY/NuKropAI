# 🌾 NuKropAI – Complete System Changelog & Supabase Real-Time Architecture

**Date:** October 2, 2026  
**Version:** Production V5.0 (Enterprise Realtime Edition)  
**Target:** Android App (`app-debug.apk`), Web/Emulator (`index.html`, `nukrop_emulator.html`), and Supabase Backend

---

## 📋 Summary of Changes

This update delivers a complete overhaul of the Driver & Farmer applications with Plantix-grade UI components, end-to-end Supabase real-time connectivity, bug-free foreign-key auth workflows, and full GPS/booking lifecycle synchronization.

---

## 1. 🚜 Farmer & Driver UI/UX Upgrades

### A. Driver Cockpit & Map Refinements
- **Neon Lime Palette Integration:** Migrated from generic yellow to vibrant Neon Lime (`#C6FF00` / `#00E676`) paired with deep charcoal dark mode (`#0B0F19`) for high visibility in field conditions.
- **Route Line Precision Alignment:** Standardized pickup-to-drop routing graphics using dedicated `16px` SVG wrappers. The pickup marker, vertical dashed line, and dropoff beacon are now perfectly co-linear.
- **Bottom Navigation "On Duty" Placement:** Fixed overlap between the floating "New Haul Request" bottom sheet and the center "On Duty" toggle by applying a calibrated `bottom: 65px` elevation offset.
- **Profile Avatar Styling:** Redesigned the driver profile avatar container into a geometric circular frame (`border-radius: 50%`) with high-resolution SVG icons.

### B. Farmer GramHaul Upgrade (Driver-Style Interactive Map)
- **Ride-Hailing Layout Architecture:** Overhauled the static card-based truck booking view to match the Driver cockpit layout:
  - Full-screen responsive vector map canvas with road network grid lines.
  - Centered live farmer location GPS pulse pin.
  - Sleek sliding bottom sheet (`.r-sheet`) featuring route points, crop selector chips (Cotton 40 Qtl, Chilli, Paddy), fare calculation (`₹1,850`), and instantaneous haul request dispatching.
- **Agrarian Theme Palette:** Preserved the agrarian branding with Forest & Emerald greens (`#16A34A`, `#064E3B`, `#F0FDF4`) rather than driver high-vis lime.

### C. Community Forum (Plantix Design System)
- **Plantix-Grade Visual Feed:** Redesigned `renderCommunityFeedDom()`:
  - Edge-to-edge white post cards divided by `#F3F4F6` visual channels (no harsh borders).
  - Farmer avatar circular badge displaying initial, farmer name, village origin, and relative post timestamp.
  - Rounded crop indicator tags (e.g. `Cotton`, `Chilli`).
  - High-definition image display containers with rounded corners.
  - Unified bottom action bar with upvote counters, discussion comment counts, and direct social share buttons.

### D. Farmer Profile Reorganization
- **Layout Alignment with Driver Profile:** Reorganized the farmer profile view to mirror the driver's hierarchy:
  - Hero header with verified AgriStack ID badge (`IN-TS-WRG-2026-88914`) and farmer photo.
  - 3-metric statistics banner (Total Land: 4.5 Acres, KCC Limit: ₹1.5L, CIBIL/Agri Score).
  - Clean grouped menu rows with rounded squircle cards and chevron navigation.

---

## 2. ⚡ Supabase Full-Stack Real-Time Engine (V5)

The entire client integration layer has been centralized into `app/src/main/assets/js/supabase_integration.js` and `js/supabase_integration.js`.

### Core Architectural Features:
1. **Schema-Compliant Auth Lifecycle (`nk_signUp`, `nk_loginUser`):**
   - **Foreign Key Safety:** Automatically inserts the parent row into `public.profiles` before inserting into `public.user_profiles`, satisfying the `user_profiles_farmer_id_fkey` constraint without errors.
   - **Session Persistence:** Auto-restores authentication sessions using `persistSession: true` and `onAuthStateChange`.
2. **Real-Time Community Feed (`nk_subscribeToCommunityPosts`, `nk_createCommunityPost`):**
   - Subscribes to Postgres `INSERT` changes on `public.community_posts`.
   - New discussions and farmer questions appear immediately on all active devices without page refreshes.
   - Initial feed loads historical posts via `nk_fetchCommunityHistory()`.
3. **Spam-Free Real-Time Haul Booking (`nk_sendHaulRequest`, `nk_subscribeToHaulRequests`, `nk_acceptHaul`):**
   - Broadcast channel (`haul:${driverId}`) sends direct haul requests from farmer to driver.
   - Driver dashboard displays an animated notification toast and immediately surfaces the request bottom sheet.
   - Accepted trips are persistently saved to `public.haul_bookings` so trip state survives app restarts.
4. **Live GPS Synchronization & Presence (`nk_startDriverLocationBroadcast`, `nk_trackDriverLocation`):**
   - Uses Supabase Presence (`channel.track()`) to broadcast Driver Online/Offline status in real-time.
   - Continuous 3-second GPS coordinate pings streamed over WebSocket channel `gps:${driverId}`.
5. **Peer-to-Peer 1-on-1 Farmer-Driver Chat (`nk_sendMessage`, `nk_subscribeToMessages`, `nk_fetchChatHistory`):**
   - Fixes the database `receiver_name NOT NULL` constraint by ensuring all required fields are included.
   - Streams live incoming messages with real-time audio/toast notifications.
6. **Mandi Market Rates & Disease Scans:**
   - Real-time rate subscriptions via `nk_subscribeToMandiRates()`.
   - Automatic sync of AI disease diagnosis scans to `public.disease_scans`.

---

## 3. 🗄️ Database Setup (`supabase_setup.sql`)

The repository includes a ready-to-run DDL setup script (`supabase_setup.sql`) configuring:
- `profiles` & `user_profiles` (Farmer credentials and land registry).
- `community_posts`, `community_comments`, `community_likes`.
- `haul_bookings`, `truck_listings`, `truck_bookings`.
- `mandi_live_rates`, `mandi_rates`.
- `peer_messages`, `chat_messages`.
- `disease_scans`, `outbreak_alerts`.
- `equipment_rentals`, `machinery_bookings`.
- `khata_records`, `farm_khata_ledger`.
- Permissive Row-Level Security (RLS) policies for anonymous and authenticated access.

---

## 4. 📱 Build & Packaging
- Clean build executed using Gradle: `./gradlew assembleDebug --no-configuration-cache`.
- Compiled Output: `app/build/outputs/apk/debug/app-debug.apk`.
