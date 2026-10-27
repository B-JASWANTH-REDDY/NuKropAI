import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Production release candidates ONLY - debug builds must never overwrite production endpoints
const releaseCandidates = [
  path.resolve(__dirname, '../app/build/outputs/apk/release/app-release.apk'),
  path.resolve(__dirname, '../NuKropAI_v3_Production.apk')
];

const debugCandidate = path.resolve(__dirname, '../app/build/outputs/apk/debug/app-debug.apk');

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

const pubDir = path.resolve(__dirname, 'public');
if (!fs.existsSync(pubDir)) {
  fs.mkdirSync(pubDir, { recursive: true });
}

const distDir = path.resolve(__dirname, 'dist');

if (releaseSource) {
  const sizeMb = (releaseSource.size / (1024 * 1024)).toFixed(1);
  console.log(`🚀 [sync-apk] Verified production release artifact: ${releaseSource.path} (${sizeMb} MB)`);

  const targets = [
    path.join(pubDir, 'NuKropAI.apk'),
    path.join(pubDir, 'NuKropAI_v2.0.apk'),
    path.join(pubDir, 'NuKropAI_latest.apk'),
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
  console.log('✅ [sync-apk] Production APK download endpoints verified and synchronized.');
} else {
  console.log('ℹ️ [sync-apk] No production release APK found.');
  // If debug APK is available, sync strictly to debug-designated endpoint only
  if (fs.existsSync(debugCandidate)) {
    const debugTarget = path.join(pubDir, 'NuKropAI_debug.apk');
    fs.copyFileSync(debugCandidate, debugTarget);
    console.log(`ℹ️ [sync-apk] Debug artifact isolated to public/NuKropAI_debug.apk. Production download endpoints preserved.`);
  }
}
