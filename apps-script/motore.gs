/**
 * Ritmo - motore fisso (bootstrap). Nel progetto Apps Script il file si chiama "Motore".
 *
 * È l'unico file di codice del progetto Apps Script, insieme alla pagina HTML "ritmo".
 * NON va più modificato: a ogni esecuzione scarica da GitHub (ramo main del repo teodrt/Switchbot,
 * oppure il ramo scritto nella proprietà RITMO_BRANCH, es. "p2" per la seconda persona)
 * i file elencati in apps-script/engine.json, li controlla e li esegue. Così ogni modifica al
 * codice arriva da sola. Se GitHub non risponde o il codice nuovo ha un errore di sintassi,
 * usa l'ultima versione buona salvata nelle proprietà dello script.
 *
 * Le chiavi (SwitchBot, Garmin, Renpho) restano nelle proprietà dello script, mai nel repo.
 *
 * Installazione (una volta sola): incolla questo file come "Motore", salva, esegui ritmoInstall.
 */

function ritmoSrc_() {
  return 'https://raw.githubusercontent.com/teodrt/Switchbot/' +
    (PropertiesService.getScriptProperties().getProperty('RITMO_BRANCH') || 'main') + '/apps-script/';
}
var RITMO_CACHE_SEC = 900;      // il codice scaricato vale 15 minuti
var RITMO_CHUNK_CACHE = 90000;  // CacheService: massimo 100 KB per valore
var RITMO_CHUNK_PROP = 4000;    // proprietà: massimo 9 KB per valore (lettere accentate = 2 byte)
var ritmoLoaded_ = false;

// ---- punti di ingresso fissi (trigger, web app, chiamate dall'app) ----
function doGet(e) { return ritmoCall_('doGet', [e]); }
function ritmoSaveCheckin(c) { return ritmoCall_('ritmoSaveCheckin', [c]); }

// ---- installazione da foglio modello: menu "Ritmo → Configura" (solo se lo script è dentro un foglio) ----
function onOpen() {
  try { SpreadsheetApp.getUi().createMenu('Ritmo').addItem('Configura', 'ritmoSetupDialog').addToUi(); } catch (e) {}
}

function ritmoSetupDialog() {
  var p = PropertiesService.getScriptProperties();
  var has = function (k) { return p.getProperty(k) ? ' (già salvata: lascia vuoto per non cambiarla)' : ''; };
  var html = '<style>body{font:14px system-ui,sans-serif;color:#1b1d24;margin:0;padding:4px 2px}label{display:block;margin:12px 0 4px;font-weight:600}' +
    'input{width:100%;box-sizing:border-box;padding:9px 10px;border:1px solid #cfd3dc;border-radius:8px;font:inherit}small{color:#5a5f6e}' +
    'button{margin-top:16px;width:100%;padding:12px;border:0;border-radius:10px;background:#e8591c;color:#fff;font:600 15px system-ui;cursor:pointer}' +
    'ol{padding-left:18px}li{margin:6px 0}#done{display:none}#err{color:#c62f2f;margin-top:10px}</style>' +
    '<div id="form"><p>Inserisci le tue chiavi. Restano solo nel tuo script, nessuno le vede.</p>' +
    '<label>Chiave Garmin (Personal API)</label><input id="g" type="password" autocomplete="off"><small>' + has('GARMIN_API_KEY') + '</small>' +
    '<label>Email del secondo account Renpho</label><input id="re" type="email" autocomplete="off"><small>' + has('RENPHO_EMAIL') + '</small>' +
    '<label>Password del secondo account Renpho</label><input id="rp" type="password" autocomplete="off"><small>' + has('RENPHO_PASSWORD') + '</small>' +
    '<button id="go">Configura Ritmo</button><div id="err"></div></div>' +
    '<div id="done"><p><b>Fatto.</b> Ritmo lavora da solo: nei prossimi minuti importa sonno e pesate degli ultimi mesi.</p>' +
    '<p>Ultimo passo, per avere l\'app sul telefono:</p><ol><li>Menu <b>Estensioni → Apps Script</b>.</li>' +
    '<li>In alto a destra <b>Esegui il deployment → Nuovo deployment</b>, tipo <b>App web</b>, esegui come <b>Me</b>, accesso <b>Solo io</b>, poi <b>Esegui il deployment</b>.</li>' +
    '<li><b>Esegui il deployment → Testa i deployment</b>: copia il link che finisce con <b>/dev</b>, aprilo sul telefono e aggiungilo alla schermata Home.</li></ol></div>' +
    '<script>document.getElementById("go").onclick=function(){var b=this;b.disabled=true;b.textContent="Configuro... (un minuto)";' +
    'google.script.run.withSuccessHandler(function(){document.getElementById("form").style.display="none";document.getElementById("done").style.display="block";})' +
    '.withFailureHandler(function(e){b.disabled=false;b.textContent="Configura Ritmo";document.getElementById("err").textContent=e.message;})' +
    '.ritmoSetupSave({g:document.getElementById("g").value.trim(),re:document.getElementById("re").value.trim(),rp:document.getElementById("rp").value});};</script>';
  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(440).setHeight(520), 'Ritmo · configurazione');
}

/** Salva le chiavi, legge la scheda "Configurazione" del modello (ramo, foglio dell'aria) e avvia il motore. */
function ritmoSetupSave(f) {
  var p = PropertiesService.getScriptProperties(), ss = SpreadsheetApp.getActiveSpreadsheet();
  p.setProperty('SHEET_ID', ss.getId());
  if (f && f.g) p.setProperty('GARMIN_API_KEY', f.g);
  if (f && f.re) p.setProperty('RENPHO_EMAIL', f.re);
  if (f && f.rp) p.setProperty('RENPHO_PASSWORD', f.rp);
  var cfg = ss.getSheetByName('Configurazione');
  if (cfg) cfg.getDataRange().getValues().forEach(function (r) {
    var k = String(r[0]).trim(), v = String(r[1]).trim();
    if (k === 'ramo' && /^[\w.-]+$/.test(v)) p.setProperty('RITMO_BRANCH', v);
    if (k === 'aria' && /^[\w-]{20,}$/.test(v)) p.setProperty('AIR_SOURCE_ID', v);
  });
  if (!p.getProperty('GARMIN_API_KEY')) throw new Error('Manca la chiave Garmin.');
  ritmoInstall();
  return true;
}
function ritmoTick() { return ritmoCall_('ritmoEngineTick_', []); }
doGet.ritmoBoot = true; ritmoSaveCheckin.ritmoBoot = true; onOpen.ritmoBoot = true;

/** Da eseguire una volta a mano: credenziali, trigger, primo giro del motore. */
function ritmoInstall() {
  var p = PropertiesService.getScriptProperties();
  try { if (!p.getProperty('SHEET_ID') && SpreadsheetApp.getActiveSpreadsheet()) p.setProperty('SHEET_ID', SpreadsheetApp.getActiveSpreadsheet().getId()); } catch (e) {}
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
  var SRC = ritmoSrc_();
  var list = JSON.parse(UrlFetchApp.fetch(SRC + 'engine.json', { muteHttpExceptions: false }).getContentText()).files;
  var res = UrlFetchApp.fetchAll(list.map(function (f) { return { url: SRC + f, muteHttpExceptions: true }; }));
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
