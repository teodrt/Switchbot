/**
 * Import Garmin: ogni mattina scarica sonno, HRV e riepilogo giornaliero dalla
 * Garmin Personal API e li scrive nella scheda "Garmin" del foglio hub (una riga per data).
 *
 * Proprietà dello script richieste:
 *   GARMIN_API_KEY  chiave creata su https://connect.garmin.com/app/settings/personalApiToken
 *   SHEET_ID        ID del foglio hub (la stessa usata dal logger SwitchBot)
 * Proprietà gestite dallo script: GARMIN_TOKEN, GARMIN_TOKEN_EXP (token di accesso, dura 24 ore).
 *
 * Funzioni da eseguire a mano:
 *   garminDebug     prova: chiede il token e mostra nel log la forma delle risposte di ieri
 *   garminBackfill  importa gli ultimi 90 giorni
 *   garminSetup     crea il trigger giornaliero (ore 10) e importa gli ultimi 3 giorni
 *
 * Documentazione: https://developer.garmin.com/gc-developer-program/personal/swagger-docs/
 */

const GARMIN_HOST = 'https://personal.connectapi.garmin.com';
const GARMIN_TAB = 'Garmin';
const GARMIN_TZ = 'Europe/Madrid';
const GARMIN_HEADER = [
  'date', 'sleep_score', 'sleep_h', 'deep_min', 'light_min', 'rem_min', 'awake_min',
  'awake_count', 'bed_start', 'bed_end', 'sleep_hr_avg', 'sleep_stress_avg', 'resp_avg',
  'spo2_avg', 'hrv_night_ms', 'hrv_weekly_ms', 'hrv_status', 'rhr', 'bb_wake', 'bb_high',
  'bb_low', 'stress_avg', 'steps', 'note'];

function gcfg_(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Proprietà dello script mancante: ' + key);
  return v;
}

function garminToken_(force) {
  const p = PropertiesService.getScriptProperties();
  const tok = p.getProperty('GARMIN_TOKEN');
  const exp = Number(p.getProperty('GARMIN_TOKEN_EXP') || 0);
  if (!force && tok && Date.now() < exp - 10 * 60 * 1000) return tok;
  const res = UrlFetchApp.fetch(
    GARMIN_HOST + '/personalapitoken-service/personal-api/personal-api-key/token', {
      method: 'post',
      headers: { Authorization: 'ApiKey ' + gcfg_('GARMIN_API_KEY') },
      muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code !== 200) throw new Error('Garmin token HTTP ' + code + ': ' + res.getContentText().slice(0, 300));
  // Garmin risponde con il token (un JWT) come testo semplice; per sicurezza accetta anche JSON.
  const body = res.getContentText().trim();
  let t = body.replace(/^"|"$/g, '');
  if (body.charAt(0) === '{') {
    const b = JSON.parse(body);
    t = b.access_token || b.accessToken || b.token;
    if (!t) throw new Error('Garmin token: risposta senza token. Campi: ' + Object.keys(b).join(', '));
  }
  p.setProperties({ GARMIN_TOKEN: t, GARMIN_TOKEN_EXP: String(gjwtExp_(t) || Date.now() + 86400000) });
  return t;
}

/** Scadenza (ms) letta dal campo "exp" del JWT, oppure 0 se non si riesce a leggerla. */
function gjwtExp_(jwt) {
  try {
    const part = jwt.split('.')[1];
    const pad = part + '==='.slice((part.length + 3) % 4);
    const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(pad)).getDataAsString();
    const exp = JSON.parse(json).exp;
    return exp ? exp * 1000 : 0;
  } catch (e) {
    return 0;
  }
}

/** GET autenticata. Restituisce il JSON, oppure null se Garmin risponde 204 (nessun dato). */
function garminGet_(path, retried) {
  const res = UrlFetchApp.fetch(GARMIN_HOST + path, {
    headers: { Authorization: 'Bearer ' + garminToken_(retried), Accept: 'application/json' },
    muteHttpExceptions: true });
  const code = res.getResponseCode();
  if (code === 401 && !retried) return garminGet_(path, true);
  if (code === 204) return null;
  if (code !== 200) throw new Error('Garmin ' + path.split('?')[0] + ' HTTP ' + code + ': ' + res.getContentText().slice(0, 200));
  const txt = res.getContentText();
  return txt ? JSON.parse(txt) : null;
}

function gday_(d) { return Utilities.formatDate(d, GARMIN_TZ, 'yyyy-MM-dd'); }

function gdays_(start, end) {
  const out = [];
  const d = new Date(start + 'T12:00:00Z');
  const e = new Date(end + 'T12:00:00Z');
  for (; d <= e; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

const gmin_ = s => (typeof s === 'number') ? Math.round(s / 60) : '';
const gnum_ = (v, dec) => (typeof v === 'number' && isFinite(v)) ? Number(v.toFixed(dec || 0)) : '';
// I timestamp "Local" di Garmin sono millisecondi già spostati sull'ora locale: si formattano in UTC.
const gtime_ = ms => (typeof ms === 'number') ? Utilities.formatDate(new Date(ms), 'UTC', 'HH:mm') : '';

/** Scarica e scrive nel foglio le date da start a end (yyyy-MM-dd, massimo 31 giorni). */
function garminImport_(start, end) {
  const notes = {};
  const addNote = (d, msg) => { (notes[d] = notes[d] || []).push(msg); };

  const sleep = {};
  try {
    (garminGet_('/sleep-service/sleep/dailySleepSummariesByDate?startDate=' + start + '&endDate=' + end) || [])
      .forEach(x => { const s = x.dailySleepDTO || x; if (s.calendarDate) sleep[s.calendarDate] = s; });
  } catch (e) { gdays_(start, end).forEach(d => addNote(d, 'sleep: ' + e.message)); }

  const hrv = {};
  try {
    const h = garminGet_('/hrv-service/hrv/daily/' + start + '/' + end);
    ((h && (h.hrvSummaries || h.items)) || []).forEach(x => { if (x.calendarDate) hrv[x.calendarDate] = x; });
  } catch (e) { gdays_(start, end).forEach(d => addNote(d, 'hrv: ' + e.message)); }

  const rows = gdays_(start, end).map(d => {
    let u = {};
    try { u = garminGet_('/usersummary-service/usersummary/daily?calendarDate=' + d) || {}; }
    catch (e) { addNote(d, 'summary: ' + e.message); }
    const s = sleep[d] || {};
    const h = hrv[d] || {};
    const score = s.sleepScores && s.sleepScores.overall ? s.sleepScores.overall.value : '';
    if (!sleep[d]) addNote(d, 'nessun sonno registrato');
    return [d, gnum_(score), gnum_(typeof s.sleepTimeSeconds === 'number' ? s.sleepTimeSeconds / 3600 : null, 2),
      gmin_(s.deepSleepSeconds), gmin_(s.lightSleepSeconds), gmin_(s.remSleepSeconds), gmin_(s.awakeSleepSeconds),
      gnum_(s.awakeCount), gtime_(s.sleepStartTimestampLocal), gtime_(s.sleepEndTimestampLocal),
      gnum_(s.avgHeartRate), gnum_(s.avgSleepStress, 1), gnum_(s.averageRespirationValue, 1), gnum_(s.averageSpO2Value),
      gnum_(h.lastNightAvg), gnum_(h.weeklyAvg), h.status || '',
      gnum_(u.restingHeartRate), gnum_(u.bodyBatteryAtWakeTime), gnum_(u.bodyBatteryHighestValue),
      gnum_(u.bodyBatteryLowestValue), gnum_(u.averageStressLevel), gnum_(u.totalSteps),
      (notes[d] || []).join(' | ').slice(0, 500)];
  });
  garminWrite_(rows);
  return rows.length;
}

/** Aggiorna la riga della data se esiste già, altrimenti la aggiunge. Le righe restano in ordine di data. */
function garminWrite_(rows) {
  const ss = SpreadsheetApp.openById(gcfg_('SHEET_ID'));
  const sh = ss.getSheetByName(GARMIN_TAB) || ss.insertSheet(GARMIN_TAB);
  sh.getRange('A:A').setNumberFormat('@'); // date come testo, così non diventano date locali
  if (sh.getLastRow() === 0) sh.appendRow(GARMIN_HEADER);
  const n = sh.getLastRow() - 1;
  const dates = n > 0 ? sh.getRange(2, 1, n, 1).getDisplayValues().map(r => r[0]) : [];
  rows.forEach(r => {
    const i = dates.indexOf(r[0]);
    if (i >= 0) sh.getRange(i + 2, 1, 1, r.length).setValues([r]);
    else { sh.appendRow(r); dates.push(r[0]); }
  });
  if (sh.getLastRow() > 2) sh.getRange(2, 1, sh.getLastRow() - 1, GARMIN_HEADER.length).sort(1);
}

/** Trigger giornaliero: ultimi 3 giorni, così recupera anche le sincronizzazioni in ritardo. */
function garminDaily() {
  const today = new Date();
  const from = new Date(today.getTime() - 2 * 86400000);
  garminImport_(gday_(from), gday_(today));
}

/** Importa gli ultimi 90 giorni, a blocchi di 31 (limite dell'API). */
function garminBackfill() {
  const end = new Date();
  for (let back = 90; back > 0; back -= 31) {
    const from = new Date(end.getTime() - back * 86400000);
    const to = new Date(end.getTime() - Math.max(0, back - 30) * 86400000);
    garminImport_(gday_(from), gday_(to));
  }
}

/** Crea (o ricrea) solo il trigger di garminDaily, senza toccare gli altri. */
function garminSetup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'garminDaily')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('garminDaily').timeBased().everyDays(1).atHour(10).inTimezone(GARMIN_TZ).create();
  garminDaily();
}

/** Solo lettura: mostra nel log i campi che Garmin restituisce per ieri. Non scrive nel foglio. */
function garminDebug() {
  const d = gday_(new Date(Date.now() - 86400000));
  const show = (label, v) => Logger.log(label + ': ' + (v === null ? '204 nessun dato'
    : JSON.stringify(v).slice(0, 1500)));
  garminToken_(true);
  Logger.log('Token ottenuto');
  show('sleep', garminGet_('/sleep-service/sleep/dailySleepSummariesByDate?startDate=' + d + '&endDate=' + d));
  show('hrv', garminGet_('/hrv-service/hrv/daily/' + d + '/' + d));
  const u = garminGet_('/usersummary-service/usersummary/daily?calendarDate=' + d);
  show('summary', u && {
    restingHeartRate: u.restingHeartRate, totalSteps: u.totalSteps, averageStressLevel: u.averageStressLevel,
    bodyBatteryAtWakeTime: u.bodyBatteryAtWakeTime, bodyBatteryHighestValue: u.bodyBatteryHighestValue });
}
