# Costruisce l'anteprima "live": dati letti dal foglio via connettore Google Drive a ogni apertura,
# con copia di riserva incorporata. Uso: RITMO_SHEET_ID=<id> python3 tools/live-preview.py <dati.json> <out.html>
# <dati.json> = DATA costruito con nBuild_ dal foglio scaricato (copia di riserva se Drive non risponde).
import sys, re, json
import os
snap_path, out = sys.argv[1], sys.argv[2]
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + '/'
shell = open(R + 'apps-script/ritmo.html').read()
boot_style = re.search(r'<style>.*?</style>', shell, re.S).group(0)
boot_div = re.search(r'<div id="boot".*?</div>', shell, re.S).group(0)
css = open(R + 'app/ritmo.css').read()
js = open(R + 'app/ritmo.js').read()
gs = open(R + 'apps-script/dashboard.gs').read()
snap = open(snap_path).read().replace('<', '\\u003c')
import os
SHEET = os.environ['RITMO_SHEET_ID']   # id del foglio: mai nel repo, si passa da fuori
live = r'''
<script>
var DATA = null;
var PropertiesService = { getScriptProperties: function () { return { getProperty: function () { return null; }, setProperty: function () {} }; } };
var pad = function (n) { return String(n).padStart(2, '0'); };
var Utilities = { formatDate: function (d, tz, f) { var s = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()), t = pad(d.getHours()) + ':' + pad(d.getMinutes());
  return f === 'yyyy-MM-dd' ? s : f === 'HH:mm' ? t : s + ' ' + t; } };
</script>
<script>
''' + gs + r'''
</script>
<script>
window.__startRitmo = function () {
''' + js + r'''
};
</script>
<script>
(function () {
  var SNAP = ''' + snap + r''';
  var SHEET = ''' + json.dumps(SHEET) + r''';
  function madridNow() {
    var p = {}; new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
      .formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day + ' ' + (p.hour === '24' ? '00' : p.hour) + ':' + p.minute;
  }
  function findB64(o, depth) {
    if (depth > 6 || o == null) return null;
    if (typeof o === 'string') return o.length > 2000 && /^[A-Za-z0-9+/=\s]+$/.test(o.slice(0, 200)) ? o : null;
    if (typeof o === 'object') { for (var k in o) { var r = findB64(o[k], depth + 1); if (r) return r; } }
    return null;
  }
  function rows(ws, first) {
    var a = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    return a.filter(function (r) { return r.some(function (v) { return v !== null && v !== ''; }); }).map(function (r) {
      return r.map(function (v, i) {
        if (!(v instanceof Date)) return v === null ? '' : v;
        if (i === 0) return Utilities.formatDate(v, '', 'yyyy-MM-dd HH:mm');
        return v.getFullYear() < 1900 ? Utilities.formatDate(v, '', 'HH:mm') : Utilities.formatDate(v, '', 'yyyy-MM-dd');
      });
    });
  }
  function engineOf(m) {
    var kv = {}; (m || []).forEach(function (r) { kv[String(r[0])] = String(r[1] == null ? '' : r[1]); });
    var split = function (s) { return (s || '').split(' | ').filter(Boolean).map(function (x) { return [x.slice(0, 16), x.slice(17)]; }); };
    return { last: kv['ultimo giro del motore'] || '', code: kv['versione del codice (md5)'] || '', updated: kv['codice aggiornato il'] || '', errors: split(kv['errori recenti']).slice(-5), log: split(kv['registro']).slice(-8) };
  }
  function build(b64) {
    var wb = XLSX.read(b64.replace(/\s/g, ''), { type: 'base64', cellDates: true });
    var S = {}; wb.SheetNames.forEach(function (n, i) { S[n] = rows(wb.Sheets[n], i === 0); });
    var now = madridNow();
    var D = nBuild_(S[wb.SheetNames[0]] || [], S.Garmin || [], S.Renpho || [], now);
    D.activities = nActivities_(S.Attivita || []); D.mood = nMood_(S.Umore || []); D.settings = nSettings_(); D.engine = engineOf(S.Motore);
    return D;
  }
  var started = false;
  function start(D, label, cls) {
    if (started) return; started = true; DATA = D; window.__startRitmo();
    var b = document.createElement('div'); b.className = 'livechip ' + cls; b.textContent = label; document.body.appendChild(b);
  }
  function fallback(why) { start(SNAP, 'Copia del ' + SNAP.now.slice(8, 10) + '/' + SNAP.now.slice(5, 7) + ' ' + SNAP.now.slice(11) + (why ? ' · ' + why : ''), 'old'); }
  var timer = setTimeout(function () { fallback('Drive lento'); }, 25000);
  (async function () {
    var mcp = window.claude ? await window.claude.use('mcp') : null;
    if (!mcp || typeof XLSX === 'undefined') { clearTimeout(timer); fallback(mcp ? '' : 'senza connettore'); return; }
    try {
      var r = await mcp.callTool('Google Drive', 'download_file_content', { fileId: SHEET, exportMimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }, { cache: false });
      var b64 = findB64(r, 0);
      if (!b64) throw { code: 'no_data' };
      var D = build(b64); clearTimeout(timer);
      start(D, 'Dati live · ' + D.now.slice(11), 'live');
    } catch (e) {
      clearTimeout(timer);
      var c = e && e.code;
      fallback(c === 'needs_reauth' ? 'ricollega Google Drive' : c === 'server_not_connected' ? 'aggiungi Google Drive ai connettori' : c === 'not_in_manifest' || c === 'approval_required' ? 'consenti Google Drive' : 'Drive non risponde');
    }
  })();
})();
</script>
'''
chip = '''
.livechip { position: fixed; z-index: 45; left: max(16px, calc(env(safe-area-inset-left, 0px) + 16px)); bottom: calc(96px + env(safe-area-inset-bottom, 0px));
  font: 500 11px/1 var(--f-data, monospace); padding: 6px 9px; border-radius: 8px; background: var(--pop, #111); color: var(--muted, #aaa); border: 1px solid var(--line-2, #333); pointer-events: none; }
.livechip.live::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--good, #2bd49a); margin-right: 6px; box-shadow: 0 0 6px var(--good, #2bd49a); }
.livechip.old { color: var(--warn, #f5c044); }
'''
page = ('<title>Ritmo</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n' + boot_style + '\n<style>\n' + css + chip + '\n</style>\n'
        + boot_div + '\n<script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>\n' + live)
open(out, 'w').write(page)
print(len(page))
