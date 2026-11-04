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

content = content.slice(0, cssEndBrace + 1) + lineBreak + cssContent + content.slice(cssEndBrace + 1);
console.log('Injected CSS standards.');

// 2. Inject JS standards
const jsContent = fs.readFileSync(path.resolve(__dirname, 'mobile_standards_snippet.js'), 'utf8');
const jsMarker = 'window.showPremiumSnackBar = showLuxuryToast;';
const jsMarkerIdx = content.indexOf(jsMarker);
if (jsMarkerIdx === -1) {
  console.error('JS marker not found!');
  process.exit(1);
}
const jsInsertPos = jsMarkerIdx + jsMarker.length;
content = content.slice(0, jsInsertPos) + lineBreak + jsContent + content.slice(jsInsertPos);
console.log('Injected JS standards.');

// 3. Update deleteKhataEntry
const modernKhata = fs.readFileSync(path.resolve(__dirname, 'modern_khata_delete.js'), 'utf8');
const khataStartStr = 'function deleteKhataEntry(id)';
const khataStartIdx = content.indexOf(khataStartStr);
if (khataStartIdx === -1) {
  console.error('deleteKhataEntry start not found!');
  process.exit(1);
}
const khataNextFuncStr = 'function closeKhataModal';
const khataNextFuncIdx = content.indexOf(khataNextFuncStr, khataStartIdx);
if (khataNextFuncIdx === -1) {
  console.error('closeKhataModal not found!');
  process.exit(1);
}

content = content.slice(0, khataStartIdx) + modernKhata + lineBreak + lineBreak + content.slice(khataNextFuncIdx);
console.log('Updated deleteKhataEntry.');

// 4. Update kcc-otp-input
const kccOld = '<input id="kcc-otp-input" class="clean-field" value="" placeholder="Enter 6-digit OTP"';
const kccNew = '<input id="kcc-otp-input" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" class="clean-field tabular-nums" value="" placeholder="Enter 6-digit OTP"';
if (!content.includes(kccOld)) {
  console.error('kccOld not found!');
  process.exit(1);
}
content = content.replace(kccOld, () => kccNew);
console.log('Updated kcc-otp-input.');

// Write back
fs.writeFileSync(targetPath, content, 'utf8');
console.log('Written to index.html. New length:', content.length);

// Synchronize nukrop_emulator.html for 100% byte-for-byte SHA-256 parity
const emulatorPath = path.resolve(__dirname, '..', 'nukrop_emulator.html');
fs.writeFileSync(emulatorPath, content, 'utf8');
console.log('Synchronized nukrop_emulator.html for 100% SHA-256 parity.');
