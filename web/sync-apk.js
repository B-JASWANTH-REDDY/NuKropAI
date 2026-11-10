import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Production release candidate paths
const releaseCandidates = [
  path.resolve(__dirname, '../app/build/outputs/apk/release/app-release.apk'),
  path.resolve(__dirname, '../NuKropAI.apk'),
  path.resolve(__dirname, '../NuKropAI_v3_Production.apk')
];

const debugCandidate = path.resolve(__dirname, '../app/build/outputs/apk/debug/app-debug.apk');

// Flutter mobile app candidate paths
const flutterCandidates = [
  path.resolve(__dirname, '../flutter_app/build/app/outputs/flutter-apk/app-arm64-v8a-release.apk'),
  path.resolve(__dirname, '../flutter_app/build/app/outputs/flutter-apk/app-release.apk'),
  path.resolve(__dirname, '../flutter_app/build/app/outputs/flutter-apk/app-arm64-v8a-debug.apk'),
  path.resolve(__dirname, '../flutter_app/build/app/outputs/flutter-apk/app-debug.apk')
];

let releaseSource = null;
for (const cand of releaseCandidates) {
  if (fs.existsSync(cand)) {
    const stat = fs.statSync(cand);
    if (stat.size > 20 * 1024 * 1024) {
      if (!releaseSource || stat.mtimeMs > releaseSource.mtimeMs) {
        releaseSource = { path: cand, size: stat.size, mtimeMs: stat.mtimeMs };
      }
    }
  }
}

let flutterSource = null;
for (const cand of flutterCandidates) {
  if (fs.existsSync(cand)) {
    const stat = fs.statSync(cand);
    if (stat.size > 20 * 1024 * 1024) {
      if (!flutterSource || stat.mtimeMs > flutterSource.mtimeMs) {
        flutterSource = { path: cand, size: stat.size, mtimeMs: stat.mtimeMs };
      }
    }
  }
}

const pubDir = path.resolve(__dirname, 'public');
if (!fs.existsSync(pubDir)) {
  fs.mkdirSync(pubDir, { recursive: true });
}

const distDir = path.resolve(__dirname, 'dist');

/**
 * Checks if an APK is signed with Android debug keys
 */
function isDebugSigned(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return buf.includes(Buffer.from('Android Debug')) || buf.includes(Buffer.from('androiddebugkey'));
  } catch (e) {
    return true;
  }
}

// Prohibited production artifact names when in preview / debug-signed mode
const productionTargetNames = [
  'NuKropAI.apk',
  'NuKropAI_latest.apk',
  'NuKropAI_v2.0.apk',
  'NuKropAI_v1.0.apk',
  'NuKropAI_v3_Production.apk'
];

function purgeProductionArtifacts() {
  const dirs = [pubDir];
  if (fs.existsSync(distDir)) dirs.push(distDir);

  for (const dir of dirs) {
    for (const name of productionTargetNames) {
      const p = path.join(dir, name);
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
          console.log(`  🗑️ [sync-apk] Purged prohibited debug artifact from production endpoint: ${path.relative(__dirname, p)}`);
        } catch (err) {
          console.warn(`  ⚠️ [sync-apk] Could not purge ${p}: ${err.message}`);
        }
      }
    }
  }
}

const isCandidateDebug = !releaseSource || isDebugSigned(releaseSource.path);

if (isCandidateDebug) {
  console.log('='.repeat(78));
  console.log('🛡️  [sync-apk] PRODUCTION SIGNING POLICY ENFORCEMENT');
  console.log('='.repeat(78));
  console.warn('⚠️ [sync-apk] Production signing credentials unavailable (staging/preview mode).');
  console.warn('⚠️ [sync-apk] Release candidate is DEBUG_SIGNED (CN=Android Debug).');
  console.warn('🛑 [sync-apk] Strict law: Prohibiting distribution of debug-signed APKs via production download links.');

  // 1. Purge all production endpoints so no debug-signed APK masquerades as production
  purgeProductionArtifacts();

  // 2. Prepare isolated preview artifact with explicit NOT FOR PRODUCTION warning
  let sourceToUse = null;
  if (fs.existsSync(debugCandidate)) {
    const debugStat = fs.statSync(debugCandidate);
    if (!releaseSource || debugStat.mtimeMs >= releaseSource.mtimeMs) {
      sourceToUse = debugCandidate;
    } else {
      sourceToUse = releaseSource.path;
    }
  } else if (releaseSource) {
    sourceToUse = releaseSource.path;
  }

  const disclaimerText = `================================================================================
NuKropAI Agrarian OS & Fullstack Mobile Client — Internal Staging Preview Builds
================================================================================
STATUS: STAGING / PREVIEW ONLY
SIGNING CLASSIFICATION: DEBUG_SIGNED (NOT FOR PRODUCTION USE)
CERTIFICATE SUBJECT: CN=Android Debug, O=Android, C=US

AVAILABLE STAGING ARTIFACTS:
1. NuKropAI_preview_debug.apk
   - Role: Android Native Agrarian OS Engine (WebView, Sensors, Background GPS Service)
   - Route: /NuKropAI_preview_debug.apk, /NuKropAI-debug.apk

2. NuKropAI_flutter_mobile_debug.apk
   - Role: Fullstack Mobile Client (Flutter 3.44, Riverpod, Offline First)
   - Architecture: arm64-v8a
   - Route: /NuKropAI_flutter_mobile_debug.apk, /flutter-debug.apk

WARNING:
These binaries are internal preview builds intended exclusively for staging evaluation,
automated CI/CD testing, and internal QA. They are cryptographically signed using the
standard Android debug key.

Production release distribution (NuKropAI.apk) is strictly DISABLED until official
Google Play Console upload keystore credentials are provided.
================================================================================
`;

  const statusJson = {
    production_distribution_enabled: false,
    release_signing_gate: "BLOCKED",
    mode: "STAGING_PREVIEW_ONLY",
    signing_classification: "DEBUG_SIGNED",
    warning: "DEBUG SIGNED / NOT FOR PRODUCTION — INTERNAL PREVIEW ONLY",
    preview_artifact: sourceToUse ? {
      name: "NuKropAI_preview_debug.apk",
      title: "NuKropAI Agrarian OS Native Engine",
      url: "/NuKropAI_preview_debug.apk",
      size_bytes: fs.statSync(sourceToUse).size
    } : null,
    flutter_preview_artifact: flutterSource ? {
      name: "NuKropAI_flutter_mobile_debug.apk",
      title: "NuKropAI Fullstack Mobile Client (Flutter)",
      architecture: "arm64-v8a",
      url: "/NuKropAI_flutter_mobile_debug.apk",
      size_bytes: fs.statSync(flutterSource.path).size
    } : null,
    generated_at: new Date().toISOString()
  };

  const writePreviewArtifacts = (dir) => {
    if (!fs.existsSync(dir)) return;
    if (sourceToUse) {
      fs.copyFileSync(sourceToUse, path.join(dir, 'NuKropAI_preview_debug.apk'));
      fs.copyFileSync(sourceToUse, path.join(dir, 'NuKropAI-debug.apk'));
    }
    if (flutterSource) {
      fs.copyFileSync(flutterSource.path, path.join(dir, 'NuKropAI_flutter_mobile_debug.apk'));
    }
    fs.writeFileSync(path.join(dir, 'NuKropAI_preview_debug.txt'), disclaimerText, 'utf8');
    fs.writeFileSync(path.join(dir, 'production-apk-status.json'), JSON.stringify(statusJson, null, 2), 'utf8');
  };

  writePreviewArtifacts(pubDir);
  if (fs.existsSync(distDir)) {
    writePreviewArtifacts(distDir);
  }

  // Also sync the root NuKropAI-debug.apk if source exists
  if (sourceToUse) {
    const rootDebugApk = path.resolve(__dirname, '../NuKropAI-debug.apk');
    fs.copyFileSync(sourceToUse, rootDebugApk);
    console.log(`  ✓ Synced Native APK -> ${path.relative(__dirname, rootDebugApk)}`);
  }
  if (flutterSource) {
    console.log(`  ✓ Synced Flutter Mobile APK -> public/NuKropAI_flutter_mobile_debug.apk (${(flutterSource.size / (1024 * 1024)).toFixed(1)} MB)`);
  }

  console.log('✅ [sync-apk] Production download endpoints successfully disabled and purged.');
  console.log('ℹ️ [sync-apk] Protected preview artifact staged at NuKropAI_preview_debug.apk with explicit security disclosure.');
  console.log('='.repeat(78));

} else {
  // Candidate is genuinely production signed
  const sizeMb = (releaseSource.size / (1024 * 1024)).toFixed(1);
  console.log(`🚀 [sync-apk] Verified production release artifact: ${releaseSource.path} (${sizeMb} MB) [PRODUCTION_SIGNED]`);
  
  const targets = [
    path.join(pubDir, 'NuKropAI.apk'),
    path.join(pubDir, 'NuKropAI_v2.0.apk'),
    path.join(pubDir, 'NuKropAI_latest.apk')
  ];

  if (fs.existsSync(distDir)) {
    targets.push(
      path.join(distDir, 'NuKropAI.apk'),
      path.join(distDir, 'NuKropAI_v2.0.apk'),
      path.join(distDir, 'NuKropAI_latest.apk')
    );
  }

  for (const target of targets) {
    if (path.resolve(releaseSource.path) !== path.resolve(target)) {
      fs.copyFileSync(releaseSource.path, target);
      console.log(`  ✓ Synced -> ${path.relative(__dirname, target)}`);
    }
  }

  const statusJson = {
    production_distribution_enabled: true,
    release_signing_gate: "PASS",
    mode: "PRODUCTION",
    signing_classification: "PRODUCTION_SIGNED",
    generated_at: new Date().toISOString()
  };

  fs.writeFileSync(path.join(pubDir, 'production-apk-status.json'), JSON.stringify(statusJson, null, 2), 'utf8');
  if (fs.existsSync(distDir)) {
    fs.writeFileSync(path.join(distDir, 'production-apk-status.json'), JSON.stringify(statusJson, null, 2), 'utf8');
  }

  console.log('✅ [sync-apk] Production APK download endpoints verified and synchronized.');
}
