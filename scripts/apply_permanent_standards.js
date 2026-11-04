const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '..', 'app', 'src', 'main', 'assets', 'index.html');
let content = fs.readFileSync(targetPath, 'utf8');
const isCrlf = content.includes('\r\n');
const lineBreak = isCrlf ? '\r\n' : '\n';

console.log('Original content length:', content.length, 'CRLF:', isCrlf);

// 1. Inject CSS standards
const cssContent = fs.readFileSync(path.resolve(__dirname, 'mobile_standards.css'), 'utf8');
const cssMarker = '.stale-cache-pill {';
const cssMarkerIdx = content.indexOf(cssMarker);
if (cssMarkerIdx === -1) {
  console.error('CSS marker not found!');
  process.exit(1);
}
const cssEndBrace = content.indexOf('}', cssMarkerIdx);
if (cssEndBrace === -1) {
  console.error('CSS end brace not found!');
  process.exit(1);
}

// Remove any prior injected block if re-running
const priorCssIdx = content.indexOf('/* ═════════════════ MANDATORY STANDARDS: TABULAR NUMBERS');
if (priorCssIdx !== -1) {
  const priorCssEnd = content.indexOf('/* ═════════════════ RESPONSIVE DESKTOP CANVAS', priorCssIdx);
  if (priorCssEnd !== -1) {
    content = content.slice(0, priorCssIdx) + content.slice(priorCssEnd);
  }
}

// Re-locate cssMarkerIdx after cleanup
const curCssMarkerIdx = content.indexOf(cssMarker);
const curCssEndBrace = content.indexOf('}', curCssMarkerIdx);
content = content.slice(0, curCssEndBrace + 1) + lineBreak + cssContent + content.slice(curCssEndBrace + 1);
console.log('Injected CSS standards.');

// 2. Inject JS standards
const jsContent = fs.readFileSync(path.resolve(__dirname, 'mobile_standards_snippet.js'), 'utf8');
const jsMarker = 'window.showPremiumSnackBar = showLuxuryToast;';
const jsMarkerIdx = content.indexOf(jsMarker);
if (jsMarkerIdx === -1) {
  console.error('JS marker not found!');
  process.exit(1);
}

// Remove prior injected block if present
const priorJsIdx = content.indexOf('/* ═════════════════ REVERSIBLE ACTIONS & UNDO TOAST NOTIFICATION');
if (priorJsIdx !== -1) {
  const priorJsEnd = content.indexOf('/* ═════════════════ TOP-LEVEL GLOBAL GEOLOCATION STATE HOISTING', priorJsIdx);
  if (priorJsEnd !== -1) {
    content = content.slice(0, priorJsIdx) + content.slice(priorJsEnd);
  }
}

const curJsMarkerIdx = content.indexOf(jsMarker);
const curJsInsertPos = curJsMarkerIdx + jsMarker.length;
content = content.slice(0, curJsInsertPos) + lineBreak + jsContent + content.slice(curJsInsertPos);
console.log('Injected JS standards.');

// 3. Update deleteKhataEntry
const modernKhata = fs.readFileSync(path.resolve(__dirname, 'modern_khata_delete.js'), 'utf8');
const khataStartStr = 'function deleteKhataEntry(id)';
const khataStartIdx = content.indexOf(khataStartStr);
if (khataStartIdx !== -1) {
  const khataNextFuncStr = 'function closeKhataModal';
  const khataNextFuncIdx = content.indexOf(khataNextFuncStr, khataStartIdx);
  if (khataNextFuncIdx !== -1) {
    content = content.slice(0, khataStartIdx) + modernKhata + lineBreak + lineBreak + content.slice(khataNextFuncIdx);
    console.log('Updated deleteKhataEntry.');
  }
}

// 4. Update toggleFollowUser
const modernFollow = fs.readFileSync(path.resolve(__dirname, 'modern_community_follow.js'), 'utf8');
const followStartStr = 'async function toggleFollowUser(authorId, authorName)';
const followStartIdx = content.indexOf(followStartStr);
if (followStartIdx !== -1) {
  const followNextStr = 'function isOwnCommunityPost(p)';
  const followNextIdx = content.indexOf(followNextStr, followStartIdx);
  if (followNextIdx !== -1) {
    content = content.slice(0, followStartIdx) + modernFollow + lineBreak + lineBreak + content.slice(followNextIdx);
    console.log('Updated toggleFollowUser.');
  }
}

// 5. Update deleteCommunityPost
const commMutations = fs.readFileSync(path.resolve(__dirname, 'modern_community_mutations.js'), 'utf8');
const delPostStartStr = 'async function deleteCommunityPost(postId)';
const delPostStartIdx = content.indexOf(delPostStartStr);
if (delPostStartIdx !== -1) {
  const delPostNextStr = 'function getCommunityLikedIds()';
  const delPostNextIdx = content.indexOf(delPostNextStr, delPostStartIdx);
  if (delPostNextIdx !== -1) {
    // Also find syncCommunityLikeToSupabase
    const syncLikeStartStr = 'async function syncCommunityLikeToSupabase(postId, willBeLiked, delta, newLikesCount)';
    const syncLikeStartIdx = content.indexOf(syncLikeStartStr);
    const syncLikeNextStr = 'function setCommunityFilter(cat)';
    const syncLikeNextIdx = content.indexOf(syncLikeNextStr, syncLikeStartIdx);

    if (syncLikeStartIdx !== -1 && syncLikeNextIdx !== -1) {
      // Replace syncCommunityLikeToSupabase first
      const modernLikeSync = commMutations.slice(0, commMutations.indexOf('async function deleteCommunityPost'));
      content = content.slice(0, syncLikeStartIdx) + modernLikeSync.trim() + lineBreak + lineBreak + content.slice(syncLikeNextIdx);
    }

    // Now re-locate and replace deleteCommunityPost
    const curDelPostStartIdx = content.indexOf(delPostStartStr);
    const curDelPostNextIdx = content.indexOf(delPostNextStr, curDelPostStartIdx);
    const modernDelPost = commMutations.slice(commMutations.indexOf('async function deleteCommunityPost'));
    content = content.slice(0, curDelPostStartIdx) + modernDelPost.trim() + lineBreak + lineBreak + content.slice(curDelPostNextIdx);
    console.log('Updated community like and delete mutations.');
  }
}

// 6. Update kcc-otp-input
const kccOld = '<input id="kcc-otp-input" class="clean-field" value="" placeholder="Enter 6-digit OTP"';
const kccNew = '<input id="kcc-otp-input" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" class="clean-field tabular-nums" value="" placeholder="Enter 6-digit OTP"';
if (content.includes(kccOld)) {
  content = content.replace(kccOld, () => kccNew);
  console.log('Updated kcc-otp-input.');
}

// 7. Add Visible Quick Actions Button in Top Header (with Ctrl+K hint)
const headerLangSelectStr = '<select id="top-lang-select"';
if (content.includes(headerLangSelectStr) && !content.includes('openMobileQuickActionsSheet()')) {
  const quickBtnHtml = `<button onclick="openMobileQuickActionsSheet()" style="display:flex;align-items:center;gap:5px;background:#FFFFFF;border:1.5px solid #D6E4D6;border-radius:20px;padding:4px 9px;font-size:11px;font-weight:800;color:#15803D;outline:none;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,0.04);min-height:36px;touch-action:manipulation;" title="Quick Actions Command Menu (Ctrl+K)"><span>⚡ Quick</span><kbd class="shortcut-hint">Ctrl+K</kbd></button>\n        `;
  content = content.replace(headerLangSelectStr, () => quickBtnHtml + headerLangSelectStr);
  console.log('Added Quick Actions button with shortcut hint to Top Header.');
}

// Write back
fs.writeFileSync(targetPath, content, 'utf8');
console.log('Written to index.html. New length:', content.length);

// Synchronize nukrop_emulator.html for 100% byte-for-byte SHA-256 parity
const emulatorPath = path.resolve(__dirname, '..', 'nukrop_emulator.html');
fs.writeFileSync(emulatorPath, content, 'utf8');
console.log('Synchronized nukrop_emulator.html for 100% SHA-256 parity.');
