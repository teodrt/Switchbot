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

test('nActivities_: battito massimo oltre 200 scartato', () => {
  const h = ['activity_id', 'date', 'start', 'type', 'name', 'duration_min', 'distance_km', 'avg_hr', 'max_hr', 'calories', 'aerobic_te', 'anaerobic_te', 'training_load', 'vo2max'];
  const a = nActivities_([h, ['1', '2026-01-01', '10:00', 'padel', 'x', 60, 2, 130, 212, 500, 2, 2, 100, 50]]);
  assert.strictEqual(a[0][7], null);
});

test('lavori del pianificatore: funzioni esistenti', () => {
  E_JOBS.concat(E_MIGRATIONS).forEach(j => { assert.strictEqual(typeof global[j.fn], 'function', j.fn); if (j.until) assert.strictEqual(typeof global[j.until], 'function', j.until); });
});

if (failed) { console.log('\n' + failed + ' controlli falliti'); process.exit(1); }
console.log('\nTutti i controlli passati');
