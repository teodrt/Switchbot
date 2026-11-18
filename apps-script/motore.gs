/**
 * Ritmo - motore fisso (bootstrap). Nel progetto Apps Script il file si chiama "Motore".
 *
 * È l'unico file di codice del progetto Apps Script, insieme alla pagina HTML "ritmo".
 * NON va più modificato: a ogni esecuzione scarica da GitHub (ramo main del repo teodrt/Switchbot,
 * oppure il ramo scritto nella proprietà RITMO_BRANCH, es. "stabile")
 * i file elencati in apps-script/engine.json, li controlla e li esegue. Così ogni modifica al
 * codice arriva da sola. Se GitHub non risponde o il codice nuovo ha un errore di sintassi,
 * usa l'ultima versione buona salvata nelle proprietà dello script.
 *
 * Le chiavi (SwitchBot, Garmin, Renpho) restano nelle proprietà dello script, mai nel repo.
 *
 * Installazione (una volta sola): incolla questo file come "Motore", salva, esegui ritmoInstall.
 */

var RITMO_SRC = 'https://raw.githubusercontent.com/teodrt/Switchbot/' +
  (PropertiesService.getScriptProperties().getProperty('RITMO_BRANCH') || 'main') + '/apps-script/';
var RITMO_CACHE_SEC = 900;      // il codice scaricato vale 15 minuti
var RITMO_CHUNK_CACHE = 90000;  // CacheService: massimo 100 KB per valore
var RITMO_CHUNK_PROP = 4000;    // proprietà: massimo 9 KB per valore (lettere accentate = 2 byte)
var ritmoLoaded_ = false;

// ---- punti di ingresso fissi (trigger, web app, chiamate dall'app) ----
function doGet(e) { return ritmoCall_('doGet', [e]); }
function ritmoSaveCheckin(c) { return ritmoCall_('ritmoSaveCheckin', [c]); }
function ritmoTick() { return ritmoCall_('ritmoEngineTick_', []); }
doGet.ritmoBoot = true; ritmoSaveCheckin.ritmoBoot = true;

/** Da eseguire una volta a mano: credenziali, trigger, primo giro del motore. */
function ritmoInstall() {
  var p = PropertiesService.getScriptProperties();
  // Credenziali SwitchBot dal vecchio file "Codice", se c'è ancora (prima di cancellarlo).
  try { if (typeof TOKEN !== 'undefined' && TOKEN && !p.getProperty('SWITCHBOT_TOKEN')) p.setProperty('SWITCHBOT_TOKEN', TOKEN); } catch (e) {}
  try { if (typeof SECRET !== 'undefined' && SECRET && !p.getProperty('SWITCHBOT_SECRET')) p.setProperty('SWITCHBOT_SECRET', SECRET); } catch (e) {}
  ['SHEET_ID', 'GARMIN_API_KEY', 'RENPHO_EMAIL', 'RENPHO_PASSWORD'].forEach(function (k) {
    Logger.log(k + ': ' + (p.getProperty(k) ? 'presente' : 'MANCANTE'));
  });
  Logger.log('Aria della camera: ' + (p.getProperty('SWITCHBOT_TOKEN') ? 'sensore SwitchBot proprio' : p.getProperty('AIR_SOURCE_ID') ? 'letta dal foglio condiviso (AIR_SOURCE_ID)' : 'nessuna'));
  Logger.log('Ramo del codice: ' + (p.getProperty('RITMO_BRANCH') || 'main'));
  CacheService.getScriptCache().remove('RITMO_N');
  ritmoLoad_();
  Logger.log('Codice scaricato da GitHub e caricato (versione ' + p.getProperty('RITMO_MD5') + ').');
  // Un solo trigger: ritmoTick ogni 10 minuti. Il motore decide cosa fare e quando.
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('ritmoTick').timeBased().everyMinutes(10).create();
  Logger.log('Trigger: ritmoTick ogni 10 minuti (gli altri trigger sono stati rimossi).');
  globalThis.ritmoEngineTick_();
  Logger.log('Primo giro completato. Ora puoi cancellare i vecchi file di codice: resta solo "Motore" e la pagina "ritmo".');
}

// ---- caricamento del codice ----
function ritmoCall_(name, args) {
  ritmoLoad_();
  var f = globalThis[name];
  if (typeof f !== 'function' || f.ritmoBoot) throw new Error('Ritmo: la funzione ' + name + ' non c\'è nel codice scaricato.');
  return f.apply(null, args || []);
}

function ritmoLoad_() {
  if (ritmoLoaded_) return;
  var src = ritmoSource_();
  (0, eval)(src);   // eval globale: le funzioni dei file diventano globali
  ritmoLoaded_ = true;
}

function ritmoSource_() {
  var cache = CacheService.getScriptCache();
  var n = +(cache.get('RITMO_N') || 0);
  if (n) {
    var keys = []; for (var i = 0; i < n; i++) keys.push('RITMO_C' + i);
    var got = cache.getAll(keys);
    if (keys.every(function (k) { return got[k] !== undefined && got[k] !== null; })) return keys.map(function (k) { return got[k]; }).join('');
  }
  var src = null;
  try {
    src = ritmoFetch_();
    new Function(src);   // controllo di sintassi senza eseguire
  } catch (e) {
    console.warn('Ritmo: uso l\'ultima versione buona (' + e.message + ')');
    var fb = ritmoFallback_();
    if (fb) return fb;
    throw new Error('Ritmo: impossibile scaricare il codice e nessuna copia salvata. ' + e.message);
  }
  var parts = []; for (var j = 0; j < src.length; j += RITMO_CHUNK_CACHE) parts.push(src.slice(j, j + RITMO_CHUNK_CACHE));
  var put = { RITMO_N: String(parts.length) }; parts.forEach(function (s, k) { put['RITMO_C' + k] = s; });
  try { cache.putAll(put, RITMO_CACHE_SEC); } catch (e) { console.warn('Ritmo: cache non disponibile ' + e.message); }
  ritmoSaveFallback_(src);
  return src;
}

function ritmoFetch_() {
  var list = JSON.parse(UrlFetchApp.fetch(RITMO_SRC + 'engine.json', { muteHttpExceptions: false }).getContentText()).files;
  var res = UrlFetchApp.fetchAll(list.map(function (f) { return { url: RITMO_SRC + f, muteHttpExceptions: true }; }));
  return res.map(function (r, i) {
    if (r.getResponseCode() !== 200) throw new Error(list[i] + ' HTTP ' + r.getResponseCode());
    return '\n// ===== ' + list[i] + ' =====\n' + r.getContentText();
  }).join('\n');
}

function ritmoMd5_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('').slice(0, 10);
}

function ritmoSaveFallback_(src) {
  var p = PropertiesService.getScriptProperties(), md5 = ritmoMd5_(src);
  if (p.getProperty('RITMO_MD5') === md5) return;
  var old = +(p.getProperty('RITMO_PN') || 0), put = {}, n = 0;
  for (var i = 0; i < src.length; i += RITMO_CHUNK_PROP) put['RITMO_P' + (n++)] = src.slice(i, i + RITMO_CHUNK_PROP);
  put.RITMO_PN = String(n); put.RITMO_MD5 = md5;
  put.RITMO_UPDATED = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd HH:mm');
  p.setProperties(put);
  for (var k = n; k < old; k++) p.deleteProperty('RITMO_P' + k);
}

function ritmoFallback_() {
  var p = PropertiesService.getScriptProperties(), n = +(p.getProperty('RITMO_PN') || 0);
  if (!n) return null;
  var out = ''; for (var i = 0; i < n; i++) out += p.getProperty('RITMO_P' + i) || '';
  return out;
}

// Mai eseguita: serve solo perché Google chieda i permessi che il codice scaricato userà
// (fogli, richieste web, email a te stesso, trigger, pagina web).
function ritmoScopes_() {
  SpreadsheetApp.openById('x'); UrlFetchApp.fetch('https://x'); MailApp.sendEmail('x', 'x', 'x');
  Session.getEffectiveUser().getEmail(); ScriptApp.newTrigger('x'); HtmlService.createTemplateFromFile('ritmo');
  LockService.getScriptLock();
}
