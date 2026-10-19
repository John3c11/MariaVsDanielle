// Release check (v155): the things every version has to keep in step, checked in one go.
// Usage: node tools/check.js .     (no packages needed)   Exit code 1 if anything is off.
//   1. Version number: <!-- vN --> on line 1 of index.html, every ?v=N in index.html, --css-v in style.css
//      and the newest line in js/patchnotes.js all say the same N.
//   2. Script versions: each .gs file's *_VERSION constant matches its SCRIPT_VERSIONS entry in js/admin.js
//      (WeeklyRecap.gs only lives in Apps Script, so it's skipped).
//   3. Columns: COL in js/core.js and WCOL in apps-script/PicksAPI.gs map the Winnings tab the same way.
//   4. PINs: no script reply hands PINs back to the site (mainPins_() or a raw friends list in a reply).
// It never prints a PIN.
const fs = require('fs'), path = require('path');
const root = process.argv[2] || '.';
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const fails = [], oks = [];
const fail = m => fails.push(m), ok = m => oks.push(m);

// ── 1. Version number ──
const html = read('index.html');
const top = (html.split('\n')[0].match(/<!--\s*v(\d+)\s*-->/) || [])[1];
if (!top) fail('index.html line 1 has no <!-- vN --> marker');
else {
  const vs = (html.match(/\?v=\d+/g) || []).map(s => s.slice(3));
  const off = vs.filter(v => v !== top);
  if (!vs.length) fail('index.html has no ?v=N');
  else if (off.length) fail('index.html says v' + top + ' on line 1, but has ?v=' + [...new Set(off)].join(', ?v=') + ' (' + off.length + ' of ' + vs.length + ')');
  else ok('index.html: line 1 and all ' + vs.length + ' ?v= say v' + top);
  const css = (read('style.css').match(/--css-v:\s*"(\d+)"/) || [])[1];
  if (css !== top) fail('style.css --css-v is "' + css + '", index.html is v' + top);
  else ok('style.css --css-v is "' + css + '"');
  const pn = (read('js/patchnotes.js').match(/\[\s*(\d+)\s*,\s*'/) || [])[1];
  if (pn !== top) fail('the newest line in js/patchnotes.js is v' + pn + ', index.html is v' + top);
  else ok('js/patchnotes.js starts with v' + pn);
}

// ── 2. Script versions ──
const admin = read('js/admin.js');
const svSrc = (admin.match(/var SCRIPT_VERSIONS = (\{[^}]*\})/) || [])[1];
let SV = null;
try { SV = Function('return ' + svSrc)(); } catch (e) { fail('could not read SCRIPT_VERSIONS in js/admin.js'); }
if (SV) {
  const gsDir = path.join(root, 'apps-script'), seen = {};
  fs.readdirSync(gsDir).filter(f => f.endsWith('.gs')).forEach(f => {
    const name = f.replace(/\.gs$/, ''), m = fs.readFileSync(path.join(gsDir, f), 'utf8').match(/const \w+_VERSION = '([^']+)'/);
    if (!m) { if (SV[name]) fail(f + ' has no *_VERSION constant, but SCRIPT_VERSIONS expects ' + SV[name]); return; }
    seen[name] = 1;
    if (!SV[name]) fail(f + ' is version ' + m[1] + ' but has no SCRIPT_VERSIONS entry in js/admin.js');
    else if (SV[name] !== m[1]) fail(f + ' is version ' + m[1] + ', SCRIPT_VERSIONS in js/admin.js expects ' + SV[name]);
  });
  const missing = Object.keys(SV).filter(k => !seen[k] && k !== 'WeeklyRecap');
  if (missing.length) fail('SCRIPT_VERSIONS lists ' + missing.join(', ') + ' but there is no such .gs file');
  if (!fails.some(m => /SCRIPT_VERSIONS|_VERSION/.test(m))) ok('all ' + Object.keys(seen).length + ' .gs versions match SCRIPT_VERSIONS (WeeklyRecap skipped)');
}

// ── 3. Columns ──
function colMap(src, name) {
  const m = src.match(new RegExp('(?:var|const) ' + name + ' = (\\{[^}]*\\})'));
  try { return m && Function('return ' + m[1])(); } catch (e) { return null; }
}
const COL = colMap(read('js/core.js'), 'COL'), WCOL = colMap(read('apps-script/PicksAPI.gs'), 'WCOL');
if (!COL || !WCOL) fail('could not read ' + (!COL ? 'COL in js/core.js' : 'WCOL in apps-script/PicksAPI.gs'));
else {
  const keys = [...new Set(Object.keys(COL).concat(Object.keys(WCOL)))];
  const diff = keys.filter(k => COL[k] !== WCOL[k]);
  if (diff.length) fail('COL (core.js) and WCOL (PicksAPI.gs) disagree on: ' + diff.map(k => k + ' ' + COL[k] + ' vs ' + WCOL[k]).join(', '));
  else ok('COL and WCOL agree on all ' + keys.length + ' columns');
}

// ── 4. PINs never go back to the site ──
const leaks = [];
fs.readdirSync(path.join(root, 'apps-script')).filter(f => f.endsWith('.gs')).forEach(f => {
  fs.readFileSync(path.join(root, 'apps-script', f), 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    if (/\bpins\s*:\s*mainPins_\(\)/.test(code)) leaks.push(f + ':' + (i + 1) + ' sends mainPins_()');
    if (/\bfriends\s*:\s*(friends_\(\)|now|list)\s*[,}]/.test(code)) leaks.push(f + ':' + (i + 1) + ' sends the friends list with PINs (use .map(noPin_))');
  });
});
if (leaks.length) leaks.forEach(l => fail('PIN leak: ' + l));
else ok('no script reply sends PINs');

oks.forEach(m => console.log('OK:   ' + m));
fails.forEach(m => console.log('FAIL: ' + m));
console.log(fails.length ? fails.length + ' problem' + (fails.length === 1 ? '' : 's') + '.' : 'All good.');
process.exit(fails.length ? 1 : 0);
