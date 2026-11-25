/* Controlli automatici di Ritmo (girano su GitHub a ogni modifica, e in locale con: node tests/run.js).
   Solo dati finti: nessun dato personale in questo file. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const ROOT = path.join(__dirname, '..'), GS = path.join(ROOT, 'apps-script');
let failed = 0;
const test = (name, fn) => { try { fn(); console.log('ok  ' + name); } catch (e) { failed++; console.log('NO  ' + name + '\n    ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n    ')); } };

const files = JSON.parse(fs.readFileSync(path.join(GS, 'engine.json'), 'utf8')).files;
const src = f => fs.readFileSync(path.join(GS, f), 'utf8');

test('sintassi dei file .gs e dell\'app', () => {
  files.concat(['motore.gs']).forEach(f => { try { new Function(src(f)); } catch (e) { throw new Error(f + ': ' + e.message); } });
  new Function(fs.readFileSync(path.join(ROOT, 'app', 'ritmo.js'), 'utf8'));
});

test('nomi globali unici tra i file uniti dal motore', () => {
  const seen = {};
  files.forEach(f => (src(f).match(/^(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm) || []).forEach(m => {
    const n = m.split(/\s+/)[1]; assert(!seen[n], n + ' è in ' + seen[n] + ' e in ' + f); seen[n] = f; }));
});

// Ambiente Apps Script finto: Utilities, foglio in memoria.
const isDay = s => typeof s === 'string' && /^\d{4}-\d\d-\d\d$/.test(s);
function Sheet(rows) { this.rows = rows || []; this.fmt = {}; this.max = 1000; }
Sheet.prototype = {
  getLastRow() { return this.rows.length; }, getMaxRows() { return this.max; }, insertRowsAfter(a, n) { this.max += n; },
  getLastColumn() { return Math.max(0, ...this.rows.map(r => r.length)); },
  appendRow(r) { const row = r.slice(); if (isDay(row[0])) row[0] = new Date(row[0] + 'T00:00:00Z'); this.rows.push(row); },   // come Sheets: la data diventa Date
  getRange(a, b, c, d) {
    const sh = this;
    if (typeof a === 'string') return { setNumberFormat(f) { for (let i = 1; i <= sh.max; i++) sh.fmt[i] = f; } };
    c = c || 1; d = d || 1;
    return {
      getValues() { return sh.rows.slice(a - 1, a - 1 + c).map(r => r.slice(b - 1, b - 1 + d)); },
      getValue() { return (sh.rows[a - 1] || [])[b - 1]; },
      setNumberFormat(f) { for (let i = 0; i < c; i++) sh.fmt[a + i] = f; },
      setValues(v) { v.forEach((r, i) => { const row = r.slice(); if (sh.fmt[a + i] !== '@' && isDay(row[0])) row[0] = new Date(row[0] + 'T00:00:00Z'); sh.rows[a - 1 + i] = Object.assign(sh.rows[a - 1 + i] || [], row); }); },
      sort() { const k = x => x[0] instanceof Date ? x[0].toISOString().slice(0, 10) : String(x[0]); const body = sh.rows.slice(a - 1); body.sort((x, y) => k(x) < k(y) ? -1 : 1); sh.rows.splice(a - 1, body.length, ...body); }
    };
  }
};
const SHEETS = {};
const ctx = {
  Utilities: { formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? d.toISOString().slice(0, 10) : d.toISOString().slice(0, 16).replace('T', ' ') },
  SpreadsheetApp: { openById: () => ({ getSheetByName: n => SHEETS[n] || null, insertSheet: n => (SHEETS[n] = new Sheet()) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'x', setProperty() {}, deleteProperty() {} }) },
  Logger: { log() {} }
};
Object.assign(global, ctx);
files.forEach(f => (0, eval)(src(f).replace(/^const /gm, 'var ')));

test('nBuild_ su un foglio finto (anche con una data diventata Date)', () => {
  const sb = [['timestamp', 'temp_c', 'rh_pct', 'co2_ppm', 'battery', 'hub_temp_c', 'hub_rh_pct', 'hub_light', 'note']];
  for (let i = 0; i < 6 * 24 * 3; i++) { const t = new Date(Date.UTC(2026, 0, 1, 0, 0) + i * 600000).toISOString().slice(0, 16).replace('T', ' '); sb.push([t, 20, 50, 600 + (i % 50), 100, 21, 50, 1, '']); }
  const g = [['date', 'sleep_score', 'sleep_h', 'deep_min', 'light_min', 'rem_min', 'awake_min', 'awake_count', 'bed_start', 'bed_end', 'sleep_hr_avg', 'sleep_stress_avg', 'resp_avg', 'spo2_avg', 'hrv_night_ms', 'hrv_weekly_ms', 'hrv_status', 'rhr', 'bb_wake', 'bb_high', 'bb_low', 'stress_avg', 'steps', 'note']];
  ['2026-01-02', '2026-01-03'].forEach((d, i) => g.push([i ? d : new Date(d + 'T00:00:00Z'), 80, 7.5, 90, 250, 90, 5, 1, '23:30', '07:00', 55, 20, 14, 95, 50, 48, 'BALANCED', 50, 70, 80, 10, 30, 8000, '']));
  const r = [['date', 'weight_kg', 'bodyfat_pct', 'water_pct', 'muscle', 'bone', 'visfat', 'bmr_kcal', 'bmi', 'note'], ['2026-01-02', 80, 20, 55, 44, 3.1, 8, 1700, 24, '']];
  const fmt = v => v instanceof Date ? v.toISOString().slice(0, 10) : v;   // come nData_
  const D = nBuild_(sb, g.map(x => [fmt(x[0])].concat(x.slice(1))), r, '2026-01-03 12:00');
  assert(D.nights.length >= 2, 'notti: ' + D.nights.length);
  assert.strictEqual(D.last.date, '2026-01-03');
  assert(D.room && D.room.co2 > 0, 'room');
  assert(D.recent.length > 0, 'recent');
});

test('garminWrite_: niente doppioni, date come testo, ordine giusto', () => {
  SHEETS.Garmin = new Sheet([['date', 'x'], [new Date('2026-11-17T00:00:00Z'), 'vecchia'], ['2026-11-15', 1], ['2026-11-16', 1]]);
  garminWrite_([['2026-11-16', 2], ['2026-11-17', 3], ['2026-11-18', 4]]);
  garminWrite_([['2026-11-18', 5]]);
  assert.deepStrictEqual(SHEETS.Garmin.rows.slice(1).map(x => [x[0] instanceof Date ? 'DATE' : x[0], x[1]]), [['2026-11-15', 1], ['2026-11-16', 2], ['2026-11-17', 3], ['2026-11-18', 5]]);
});

test('renphoWrite_: niente doppioni', () => {
  SHEETS.Renpho = new Sheet([['date', 'w'], ['2026-11-15', 80]]);
  renphoWrite_([['2026-11-15', 81], ['2026-11-16', 82]]); renphoWrite_([['2026-11-16', 83]]);
  assert.deepStrictEqual(SHEETS.Renpho.rows.slice(1).map(x => [x[0] instanceof Date ? 'DATE' : x[0], x[1]]), [['2026-11-15', 81], ['2026-11-16', 83]]);
});

test('nMood_: tag fisio e date', () => {
  const m = nMood_([N_MOOD_HEADER, ['2026-11-18', '08:15', 3, 3, 3, 'nota', 'fisio,altro'], ['2026-11-19', '08:00', 4, 4, 2, '', '']]);
  assert.deepStrictEqual(m.map(x => x.tags), [['fisio'], []]);
});

test('nMood_: nessun check-in perso se la data è diventata "yyyy-MM-dd HH:mm" o Date', () => {
  const m = nMood_([N_MOOD_HEADER.slice(0, 6), ['2026-11-18 00:00', '08:15', 3, 3, 3, 'ieri'], [new Date('2026-11-17T12:00:00Z'), '08:00', 2, 2, 4, ''], ['2026-11-19', '07:25', 3, 3, 3, 'oggi']]);
  assert.deepStrictEqual(m.map(x => x.date), ['2026-11-18', '2026-11-17', '2026-11-19']);
});

test('eFixDates_: le date diventano testo, nessuna riga persa', () => {
  SHEETS.Umore = new Sheet([N_MOOD_HEADER, [new Date('2026-11-18T00:00:00Z'), '08:15', 3, 3, 3, 'ieri', ''], ['2026-11-19', '07:25', 3, 3, 3, 'oggi', '']]);
  const P = global.PropertiesService, props = { SHEET_ID: 'x' };
  global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) };
  try { eFixDates_(); } finally { global.PropertiesService = P; }
  assert.deepStrictEqual(SHEETS.Umore.rows.slice(1).map(r => [r[0], r[5]]), [['2026-11-18', 'ieri'], ['2026-11-19', 'oggi']]);
});

test('nActivities_: battito massimo oltre 200 scartato', () => {
  const h = ['activity_id', 'date', 'start', 'type', 'name', 'duration_min', 'distance_km', 'avg_hr', 'max_hr', 'calories', 'aerobic_te', 'anaerobic_te', 'training_load', 'vo2max'];
  const a = nActivities_([h, ['1', '2026-01-01', '10:00', 'padel', 'x', 60, 2, 130, 212, 500, 2, 2, 100, 50]]);
  assert.strictEqual(a[0][7], null);
});

test('aria condivisa: solo letture valide e solo dati dell\'aria', () => {
  const log = [['timestamp', 'temp_c', 'rh_pct', 'co2_ppm', 'battery', 'hub_temp_c', 'hub_rh_pct', 'hub_light', 'note'],
    ['2026-01-01 00:00', 20, 50, 600, 100, 21, 50, 1, ''], ['2026-01-01 00:10', 0, 0, 415, 0, '', '', '', ''], ['2026-01-02 00:00', '20,5', 51, 610, 100, '', '', '', '']];
  assert.deepStrictEqual(aRows_(log, '2026-01-01 00:05'), [['2026-01-02 00:00', 20.5, 51, 610]]);
  assert.deepStrictEqual(aRows_(log, '').map(r => r.length), [4, 4]);
});

test('promemoria del check-in: solo dopo la notte (o alle 12), una volta, con il proprio link', () => {
  const props = { SHEET_ID: 'x', APP_URL: 'https://script.google.com/macros/s/ABC/dev' }, mails = [];
  const saved = { P: global.PropertiesService, M: global.MailApp, S: global.Session, F: global.Utilities.formatDate };
  global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) };
  global.MailApp = { sendEmail: m => mails.push(m) }; global.Session = { getEffectiveUser: () => ({ getEmail: () => 'me' }) };
  let now = '08:00';
  global.Utilities.formatDate = (d, tz, f) => f === 'HH:mm' ? now : '2026-11-19';
  SHEETS.Umore = new Sheet([N_MOOD_HEADER]);
  SHEETS.Garmin = new Sheet([['date', 'sleep_score']]);
  try {
    nCheckinReminder(); assert.strictEqual(mails.length, 0, 'prima della notte: niente mail'); assert(!nReminderDone_());
    SHEETS.Garmin.rows.push(['2026-11-19', 87, 7.5, 0, 0, 0, 0, 0, '23:10', '07:05']);
    nCheckinReminder(); assert.strictEqual(mails.length, 1, 'notte arrivata: una mail'); assert(nReminderDone_());
    assert(mails[0].htmlBody.indexOf(props.APP_URL) >= 0, 'con il proprio link'); assert(mails[0].htmlBody.indexOf('87') >= 0);
    nCheckinReminder(); assert.strictEqual(mails.length, 1, 'una sola al giorno');
    delete props.REMINDER_DAY; SHEETS.Umore.rows.push(['2026-11-19', '08:30', 3, 3, 2, '', '']);
    nCheckinReminder(); assert.strictEqual(mails.length, 1, 'check-in già fatto: niente mail');
    delete props.REMINDER_DAY; SHEETS.Umore.rows.pop(); SHEETS.Garmin.rows.pop(); now = '12:05';
    nCheckinReminder(); assert.strictEqual(mails.length, 2, 'alle 12 anche senza notte');
  } finally { global.PropertiesService = saved.P; global.MailApp = saved.M; global.Session = saved.S; global.Utilities.formatDate = saved.F; }
});

test('calendario: solo sì/no e orari, fisio e serate riconosciute', () => {
  const r = cxDayRow_('2026-11-20', [{ title: 'Fisioterapia ginocchio', start: '10:00', end: '11:00' }, { title: 'Cena', start: '20:30', end: '22:15' }]);
  assert.deepStrictEqual(r, ['2026-11-20', 1, 1, '22:15', 2]);
  assert.deepStrictEqual(cxDayRow_('2026-11-21', [{ title: 'Riunione', start: '09:00', end: '10:00' }]), ['2026-11-21', 0, 0, '10:00', 1]);
  assert.deepStrictEqual(cxDayRow_('2026-11-22', []), ['2026-11-22', 0, 0, '', 0]);
  const cal = nCal_([CX_CAL_HEADER, r, ['2026-11-21 00:00', '0', '0', '10:00', 1]]);
  assert.strictEqual(cal['2026-11-20'].fisio, true); assert.strictEqual(cal['2026-11-21'].sera, false);
});

test('meteo: una riga per notte finita, niente previsioni', () => {
  const time = [], T = [], RH = [], P = [];
  ['2026-11-24', '2026-11-25', '2026-11-26'].forEach((d, k) => { for (let hh = 0; hh < 24; hh++) { time.push(d + 'T' + String(hh).padStart(2, '0') + ':00'); T.push(10 + k + hh / 10); RH.push(60); P.push(1010 + k * 2); } });
  const rows = cxMeteoRows_({ hourly: { time: time, temperature_2m: T, relative_humidity_2m: RH, surface_pressure: P } }, '2026-11-26T08:00');
  assert.deepStrictEqual(rows.map(r => r[0]), ['2026-11-25', '2026-11-26'], 'solo notti finite e complete');
  assert.strictEqual(rows[1][4], 2, 'pressione +2 hPa in 24 ore');
  assert(rows[0][5] !== '', 'massima del giorno prima');
  assert.strictEqual(cxMeteoRows_({ hourly: { time: time, temperature_2m: T, relative_humidity_2m: RH, surface_pressure: P } }, '2026-11-26T06:00').length, 1, 'la notte di oggi alle 6 non è ancora finita');
  const w = nMeteo_([CX_MET_HEADER].concat(rows)); assert(w['2026-11-26'].dp === 2);
});

test('ora ideale per dormire: finestra delle notti migliori, serie, poche notti = niente', () => {
  const ns = [];
  for (let i = 0; i < 30; i++) { const good = i % 2 === 0; ns.push({ date: '2026-10-' + String(i + 1).padStart(2, '0'), score: good ? 85 + (i % 5) : 60, bed_start: good ? '23:0' + (i % 5) : '00:4' + (i % 5) }); }
  const bw = nBedWindow_(ns);
  assert(bw && bw.from <= '23:05' && bw.to >= '23:00' && bw.from >= '22:30', JSON.stringify(bw && [bw.from, bw.to]));
  assert(bw.inAvg > bw.outAvg); assert.strictEqual(bw.last.length, 7);
  assert.strictEqual(nBedWindow_(ns.slice(0, 10)), null);
  ns.push({ date: '2026-10-31', score: 80, bed_start: '23:02' }); assert(nBedWindow_(ns).streak >= 1);
});

test('mail della sera: cosa sistemare solo quando serve, oggetto chiaro', () => {
  const ok = wkEveningBuild_({ room: { ts: '2026-11-25 21:30', t: 19.5, rh: 52, co2: 640 }, out: { t: 11.9 }, night: { over1000: 0 }, bw: null, exp: null, url: '' });
  assert.strictEqual(ok.fix.length, 0); assert(/camera a posto/.test(ok.subject));
  const bad = wkEveningBuild_({ room: { ts: '2026-11-25 21:30', t: 21.4, rh: 63, co2: 950 }, out: { t: 11.9 }, night: { over1000: 180 },
    bw: { from: '22:50', to: '23:25', streak: 2 }, exp: { t: 'Camera sotto i 20 °C', how: 'x', k: 3 }, url: 'https://script.google.com/macros/s/X/dev' });
  assert.strictEqual(bad.fix.length, 4, bad.fix.join(' | ')); assert(/4 cose da sistemare/.test(bad.subject));
  assert(/3 ore/.test(bad.html) && /22:50/.test(bad.html) && /notte 3 di 7/.test(bad.html) && /fuori ci sono 11,9/.test(bad.html) && /macros\/s\/X\/dev/.test(bad.html));
  assert.strictEqual(wkEveningBuild_({ room: null }).fix.length, 1, 'senza letture: lo dice');
});

test('nAssemble_: le schede nuove arrivano all\'app', () => {
  const D = nAssemble_({ sb: [['timestamp', 'temp_c', 'rh_pct', 'co2_ppm', 'battery']], Garmin: [['date']], Renpho: [['date']],
    Calendario: [CX_CAL_HEADER, ['2026-11-20', 1, 0, '18:00', 1]], Meteo: [CX_MET_HEADER, ['2026-11-21', 9.5, 70, 1012, -3.1, 16]] }, '2026-11-21 10:00', {});
  assert.strictEqual(D.calendar['2026-11-20'].fisio, true); assert.strictEqual(D.weather['2026-11-21'].dp, -3.1); assert.strictEqual(D.bedWindow, null);
});

test('lavori del pianificatore: funzioni esistenti', () => {
  E_JOBS.concat(E_MIGRATIONS).forEach(j => { assert.strictEqual(typeof global[j.fn], 'function', j.fn); if (j.until) assert.strictEqual(typeof global[j.until], 'function', j.until); });
});

if (failed) { console.log('\n' + failed + ' controlli falliti'); process.exit(1); }
console.log('\nTutti i controlli passati');
