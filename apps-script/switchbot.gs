/**
 * SwitchBot logger: legge ogni 10 minuti il Meter Pro CO2 (camera) e l'Hub 2
 * (seconda stanza) tramite l'API SwitchBot v1.1 e aggiunge una riga al foglio hub.
 *
 * Proprietà dello script richieste (Impostazioni progetto > Proprietà script):
 *   SWITCHBOT_TOKEN   token dell'app SwitchBot (Profilo > Preferenze > Opzioni sviluppatore)
 *   SWITCHBOT_SECRET  secret dell'app SwitchBot
 *   SHEET_ID          ID del foglio Google di destinazione
 * Proprietà salvate in automatico dallo script:
 *   DEVICE_ID         ID del Meter Pro CO2
 *   HUB_ID            ID dell'Hub
 *
 * Le funzioni che finiscono con "_" sono private: non compaiono nel menu "Esegui",
 * così non si lancia per sbaglio una funzione interna.
 */

const SWITCHBOT_API = 'https://api.switch-bot.com/v1.1';
const TZ = 'Europe/Madrid';

function cfg_(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Proprietà dello script mancante: ' + key);
  return v;
}

function sb_(path) {
  const token = cfg_('SWITCHBOT_TOKEN');
  const secret = cfg_('SWITCHBOT_SECRET');
  const t = Date.now().toString();
  const nonce = Utilities.getUuid();
  const sign = Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(token + t + nonce, secret));
  const res = UrlFetchApp.fetch(SWITCHBOT_API + path, {
    headers: { Authorization: token, sign: sign, nonce: nonce, t: t,
               'Content-Type': 'application/json; charset=utf8' },
    muteHttpExceptions: true });
  const b = JSON.parse(res.getContentText());
  if (b.statusCode !== 100) throw new Error('SwitchBot: ' + res.getContentText());
  return b.body;
}

function findDevice_(propKey, test, label) {
  const p = PropertiesService.getScriptProperties();
  const cached = p.getProperty(propKey);
  if (cached) return cached;
  const list = sb_('/devices').deviceList;
  const d = list.find(test);
  if (!d) throw new Error(label + ' non trovato: ' +
    JSON.stringify(list.map(x => [x.deviceName, x.deviceType])));
  p.setProperty(propKey, d.deviceId);
  return d.deviceId;
}

function deviceId_() {
  return findDevice_('DEVICE_ID', x => /co2/i.test(x.deviceType + ' ' + x.deviceName), 'CO2');
}

function hubId_() {
  return findDevice_('HUB_ID', x => /^hub/i.test(x.deviceType), 'Hub');
}

function safeStatus_(getId) {
  try {
    return { s: sb_('/devices/' + getId() + '/status'), err: '' };
  } catch (e) {
    return { s: null, err: String((e && e.message) || e).slice(0, 300) };
  }
}

/**
 * Colonne del foglio: vedi docs/schema-foglio.md.
 * Se un dispositivo non risponde o non ha dati, le sue colonne restano vuote
 * e il motivo finisce nella colonna "note".
 */
function logReading() {
  if (!PropertiesService.getScriptProperties().getProperty('SWITCHBOT_TOKEN')) return;   // senza sensore proprio (es. aria condivisa): niente da leggere
  const sheet = SpreadsheetApp.openById(cfg_('SHEET_ID')).getSheets()[0];
  if (sheet.getRange('F1').getValue() === '') {
    sheet.getRange('F1:I1').setValues([['hub_temp_c', 'hub_rh_pct', 'hub_light', 'note']]);
  }
  const ts = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm');
  const v = x => (x === undefined || x === null) ? '' : x;
  const hasData = s => typeof s.humidity === 'number' && s.humidity > 0;
  const note = [];

  const m = safeStatus_(deviceId_);
  let meter = ['', '', '', ''];
  if (m.err) note.push('meter: ' + m.err);
  else if (hasData(m.s)) meter = [m.s.temperature, m.s.humidity, v(m.s.CO2), v(m.s.battery)];
  else note.push('meter senza dati: ' + JSON.stringify(m.s));

  const h = safeStatus_(hubId_);
  let hub = ['', '', ''];
  if (h.err) note.push('hub: ' + h.err);
  else if (hasData(h.s)) hub = [h.s.temperature, h.s.humidity, v(h.s.lightLevel)];
  else note.push('hub senza dati: ' + JSON.stringify(h.s));

  sheet.appendRow([ts].concat(meter, hub, [note.join(' | ')]));
}

/** Ricrea solo il trigger di logReading (ogni 10 minuti) e scrive subito una riga. */
function setup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'logReading')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('logReading').timeBased().everyMinutes(10).create();
  logReading();
}

/** Stampa nel log i dispositivi e lo stato di sensore e hub (solo lettura). */
function debugStatus() {
  Logger.log(JSON.stringify(sb_('/devices').deviceList.map(x => [x.deviceName, x.deviceType])));
  Logger.log(JSON.stringify(sb_('/devices/' + deviceId_() + '/status')));
  Logger.log(JSON.stringify(sb_('/devices/' + hubId_() + '/status')));
}
