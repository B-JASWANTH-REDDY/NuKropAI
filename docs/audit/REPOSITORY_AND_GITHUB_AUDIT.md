# NuKropAI — Repository & GitHub Environment Audit
**Document ID**: `docs/audit/REPOSITORY_AND_GITHUB_AUDIT.md`  
**Repository**: `B-JASWANTH-REDDY/NuKropAI`  
**Branch**: `main`  
**Current Head**: `492ad870819308ebd8bc9707e8574cb3ac3c68a3`  
**Audit Date**: 2026-10-16  

---

## 1. GitHub Repository State

### 1.1 Pull Requests & Issues Inventory
- **Open Pull Requests**: `0`
- **Closed Pull Requests**: `0`
- **Open Issues**: `0`
- **Closed Issues**: `0`
- **Verification Command**: `gh pr list --state all && gh issue list --state all`
- **Finding**: The remote repository currently contains 0 open or historical pull requests and 0 issues. No unmerged reviewer threads exist.

### 1.2 GitHub Actions Workflows Audit
The repository configures 3 distinct GitHub Actions workflows:

1. **Android CI** (`.github/workflows/android.yml`):
   - **Trigger**: `push` on `main`, `pull_request` on `main`.
   - **Environment**: `ubuntu-latest`, Temurin JDK 17.
   - **Command**: `./gradlew assembleRelease --no-daemon`.
   - **Historical Status**: Repeated failures (`exit code 1`).
   - **Root Cause**: Hardcoded Windows path `org.gradle.java.home=C:/Program Files/...` in `gradle.properties` crashed Gradle startup on Linux runner.

2. **Automated Mandi Synchronization Engine** (`.github/workflows/mandi_scheduler.yml`):
   - **Trigger**: Cron daily `'0 15 * * *'` (8:30 PM IST), `workflow_dispatch`.
   - **Environment**: `ubuntu-latest`, Python 3.11.
   - **Command**: `python backend/mandi_pipeline_sync.py`.
   - **Historical Status**: Cancelled after exactly 6 hours (`360m`).
   - **Root Cause**: `mandi_pipeline_sync.py` had an un-terminated `while True: sleep(4 * 60 * 60)` loop designed for continuous daemons, causing the GitHub Actions job to exceed the runner maximum timeout.

3. **Backend CI/CD** (`.github/workflows/backend.yml`):
   - **Trigger**: Changes in `backend/**`.
   - **Environment**: Node.js runtime.

---

## 2. Local Workspace Structure & Assets

### 2.1 File & Directory Inventory
The repository is structured into distinct tiers:
- `app/`: Native Android Kotlin application (Jetpack Compose, Room DB, Retrofit, CameraX, Supabase SDK).
- `app/src/main/assets/index.html`: Complete embedded agrarian offline SPA (11 regional languages, Leaflet maps, AgriStack, Rapido-style GramHaul).
- `nukrop_emulator.html`: Mirror web emulator for desktop preview and browser-based forensic testing.
- `web/`: Vite + React 18 promotional showcase and APK distribution web application.
- `backend/`: Fastify, PostgreSQL, BullMQ, and Redis IoT device orchestration service.
- `supabase/`: Canonical SQL schema, triggers, and migrations (`supabase/migrations/`).
- `tests/`: End-to-end automated testing suites (JavaScript and Python test runners).
- `docs/`: Architectural blueprints, agronomic thresholds, and verification audits.

### 2.2 Package Managers & Lockfiles
- `web/`: Managed via `npm` with valid `package-lock.json`.
- `backend/`: Managed via `npm` with `package-lock.json`. Audited to purge unused `firebase-admin`.
- `app/`: Managed via Gradle 9.3.1 with Android Gradle Plugin 8.9.0 and Kotlin 2.2.21.

### 2.3 Generated Binaries vs Source Files
- Generated Binaries: `app/build/`, `web/dist/`, `NuKropAI.apk`, `web/public/*.apk`.
- Editable Source Files: Kotlin files in `app/src/main/java/`, JS/HTML in `app/src/main/assets/`, TypeScript in `backend/src/` and `web/src/`.
- Distribution Safeguard: Production releases must only originate from verified `assembleRelease` artifacts, never from debug binaries.
