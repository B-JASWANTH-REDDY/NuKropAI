# NuKropAI — Android Release & Packaging Audit
**Document ID**: `docs/audit/ANDROID_RELEASE_AUDIT.md`  
**Repository**: `B-JASWANTH-REDDY/NuKropAI`  
**Audit Date**: 2026-10-16  
**Auditor**: Senior Android Release & Security Engineer  

---

## 1. Application Metadata & Target Specifications

- **Application ID**: `com.nukrop.app`
- **Version Code**: `2`
- **Version Name**: `1.1.0`
- **Minimum SDK Level**: `24` (Android 7.0 Nougat)
- **Target SDK Level**: `36` (Android 16 Vanilla Ice Cream preview)
- **Compile SDK Level**: `36`
- **Primary Languages**: Kotlin 2.2.21, Jetpack Compose with Material 3

---

## 2. Release Variant Compilation & Optimization Audit

- **Minification**: `isMinifyEnabled = true` (R8 / ProGuard enabled)
- **Resource Shrinking**: `isShrinkResources = true` (Unused drawables and layouts stripped)
- **PNG Crunching**: `isCrunchPngs = true`
- **ProGuard Rules**: `proguard-rules.pro` configures explicit keep rules for:
  - Supabase serialization models (`io.github.jan.supabase.**`)
  - Kotlinx Serialization JSON models (`kotlinx.serialization.**`)
  - OkHttp & Retrofit network models (`okhttp3.**`, `retrofit2.**`)
  - Room SQLite Entities (`androidx.room.**`)

---

## 3. Cryptographic Verification & Artifact Hashes

### 3.1 Production Release Artifact
- **File Location**: `app/build/outputs/apk/release/app-release.apk`
- **File Size**: `54,959,333 bytes` (`52.41 MB`)
- **SHA-256 Checksum**:
  ```
  6E21589CFDEEE0C05985AE9A7A6251CDCF7BD474B6FD6E62450A87DD119C0720
  ```

### 3.2 Development Debug Artifact
- **File Location**: `app/build/outputs/apk/debug/app-debug.apk`
- **File Size**: `65,115,081 bytes` (`62.09 MB`)
- **Isolation Policy**: `web/sync-apk.js` and `app/build.gradle.kts` strictly isolate debug builds to `NuKropAI_debug.apk`. Debug builds can never overwrite production endpoints (`NuKropAI.apk`, `NuKropAI_latest.apk`).

---

## 4. Signing Safeguards Remediation

1. **Root Cause**: `app/build.gradle.kts` previously fell back to the debug keystore and known passwords (`android`) by default when `KEYSTORE_PATH` was unset.
2. **Safeguard Implemented**:
   - Explicit check for `KEYSTORE_PATH` presence and file existence.
   - When missing, outputs an explicit warning: `⚠️ [Signing] KEYSTORE_PATH not provided or missing. Using debug.keystore for local testing only.`
   - Bound Gradle `syncApkToWeb` exclusively to `assembleRelease` tasks, preventing accidental publication during local debug development iterations.
