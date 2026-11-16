/**
 * Ritmo: web app che legge il foglio hub (SwitchBot, Garmin, Renpho) e mostra la dashboard.
 * Si apre con il link della distribuzione "App web" (Esegui come: me, Accesso: solo io).
 *
 * Proprietà dello script richieste: SHEET_ID.
 * File HTML richiesto nello stesso progetto: "ritmo" (apps-script/ritmo.html). Non può chiamarsi
 * "dashboard": Apps Script non accetta un file Script e uno HTML con lo stesso nome.
 */

const N_TZ = 'Europe/Madrid';
const N_DAYS = 120;   // notti mandate alla pagina

function doGet() {
  const t = HtmlService.createTemplateFromFile('ritmo');
  t.json = JSON.stringify(nData_()).replace(/</g, '\\u003c');
  return t.evaluate()
    .setTitle('Ritmo')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function nData_() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw new Error('Proprietà dello script mancante: SHEET_ID');
  const ss = SpreadsheetApp.openById(id);
  const fmt = v => (v instanceof Date) ? Utilities.formatDate(v, N_TZ, 'yyyy-MM-dd HH:mm') : v;
  const vals = sh => sh ? sh.getDataRange().getValues().map(r => [fmt(r[0])].concat(r.slice(1))) : [];
  return nBuild_(vals(ss.getSheets()[0]), vals(ss.getSheetByName('Garmin')),
    vals(ss.getSheetByName('Renpho')), Utilities.formatDate(new Date(), N_TZ, 'yyyy-MM-dd HH:mm'));
}

/** Funzione pura (provabile fuori da Apps Script): righe delle tre schede -> dati per la pagina. */
function nBuild_(sbRows, gRows, rRows, now) {
  const num = v => {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (typeof v === 'string' && v.trim() !== '') { const x = Number(v.replace(',', '.')); return isFinite(x) ? x : null; }
    return null;
  };
  const idx = rows => {
    const h = {}; (rows[0] || []).forEach((name, i) => { h[String(name).trim()] = i; }); return h;
  };
  // minuti "assoluti" trattando l'ora locale come UTC (basta per confronti e differenze)
  const absMin = (day, hm) => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10),
    +hm.slice(0, 2), +hm.slice(3, 5)) / 60000;
  const prevDay = d => new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - 86400000)
    .toISOString().slice(0, 10);
  const isDay = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s);

  // --- SwitchBot: letture valide (umidità > 0) ---
  const hs = idx(sbRows);
  const air = [];
  let latest = null, latestHub = null;
  for (let i = 1; i < sbRows.length; i++) {
    const r = sbRows[i], ts = r[hs.timestamp];
    if (!isDay(ts) || ts.length < 16) continue;
    const rh = num(r[hs.rh_pct]);
    if (rh && rh > 0) {
      const p = { t: absMin(ts.slice(0, 10), ts.slice(11, 16)), ts: ts.slice(0, 16),
        co2: num(r[hs.co2_ppm]), temp: num(r[hs.temp_c]), rh: rh, bat: num(r[hs.battery]) };
      air.push(p); latest = p;
    }
    if (hs.hub_rh_pct !== undefined && num(r[hs.hub_rh_pct])) {
      latestHub = { ts: ts.slice(0, 16), temp: num(r[hs.hub_temp_c]), rh: num(r[hs.hub_rh_pct]),
        light: num(r[hs.hub_light]) };
    }
  }

  // --- Garmin: una riga per data (data del risveglio) ---
  const hg = idx(gRows);
  const garmin = {};
  const gv = (r, k) => (hg[k] === undefined ? null : num(r[hg[k]]));
  const gs = (r, k) => (hg[k] === undefined || r[hg[k]] === null ? '' : String(r[hg[k]]));
  for (let i = 1; i < gRows.length; i++) {
    const r = gRows[i], d = r[hg.date];
    if (!isDay(d)) continue;
    garmin[d.slice(0, 10)] = {
      score: gv(r, 'sleep_score'), sleep_h: gv(r, 'sleep_h'), deep: gv(r, 'deep_min'),
      light: gv(r, 'light_min'), rem: gv(r, 'rem_min'), awake: gv(r, 'awake_min'),
      awake_count: gv(r, 'awake_count'), bed_start: gs(r, 'bed_start'), bed_end: gs(r, 'bed_end'),
      hr: gv(r, 'sleep_hr_avg'), resp: gv(r, 'resp_avg'), spo2: gv(r, 'spo2_avg'),
      hrv: gv(r, 'hrv_night_ms'), hrv_week: gv(r, 'hrv_weekly_ms'), hrv_status: gs(r, 'hrv_status'),
      rhr: gv(r, 'rhr'), bb_wake: gv(r, 'bb_wake'), stress: gv(r, 'stress_avg'), steps: gv(r, 'steps')
    };
  }

  // Finestra di sonno della notte che finisce il giorno d: orari Garmin, altrimenti 23:00-07:30.
  const windowOf = d => {
    const g = garmin[d];
    const ok = s => /^\d{2}:\d{2}$/.test(s || '');
    if (g && ok(g.bed_start) && ok(g.bed_end)) {
      const startDay = +g.bed_start.slice(0, 2) >= 12 ? prevDay(d) : d;
      return { start: absMin(startDay, g.bed_start), end: absMin(d, g.bed_end), fromGarmin: true };
    }
    return { start: absMin(prevDay(d), '23:00'), end: absMin(d, '07:30'), fromGarmin: false };
  };

  const airStats = d => {
    const w = windowOf(d);
    const pts = air.filter(p => p.t >= w.start && p.t <= w.end && p.co2 !== null);
    if (pts.length < 6) return null;
    const avg = a => a.reduce((s, x) => s + x, 0) / a.length;
    const co2 = pts.map(p => p.co2);
    const peak = pts.reduce((a, b) => (b.co2 > a.co2 ? b : a));
    return {
      co2_avg: Math.round(avg(co2)), co2_max: peak.co2, co2_max_at: peak.ts.slice(11, 16),
      over1000_min: pts.filter(p => p.co2 > 1000).length * 10,
      temp_avg: Math.round(avg(pts.map(p => p.temp)) * 10) / 10,
      rh_avg: Math.round(avg(pts.map(p => p.rh))), n: pts.length
    };
  };

  // Date da considerare: tutte quelle Garmin più quelle con dati della camera.
  const today = now.slice(0, 10);
  const dates = {};
  Object.keys(garmin).forEach(d => { dates[d] = true; });
  air.forEach(p => { const d = p.ts.slice(0, 10); if (d <= today) dates[d] = true; });
  const sorted = Object.keys(dates).sort().slice(-N_DAYS);
  const nights = sorted.map(d => Object.assign({ date: d }, garmin[d] || {}, { air: airStats(d) }))
    .filter(n => n.score !== undefined || n.air);

  // Ultima notte: oggi se la camera ha dati della notte, altrimenti l'ultima data Garmin.
  let last = nights.length ? nights[nights.length - 1] : null;
  for (let i = nights.length - 1; i >= 0; i--) {
    if (nights[i].air || nights[i].score !== undefined) { last = nights[i]; break; }
  }
  let series = [], win = null;
  if (last) {
    win = windowOf(last.date);
    const from = absMin(prevDay(last.date), '22:00'), to = absMin(last.date, '10:00');
    series = air.filter(p => p.t >= from && p.t <= to).map(p => [p.t - from, p.co2, p.temp, p.rh]);
    win = { start: win.start - from, end: win.end - from, fromGarmin: win.fromGarmin };
  }

  // --- Renpho ---
  const hr = idx(rRows);
  const body = [];
  for (let i = 1; i < rRows.length; i++) {
    const r = rRows[i], d = r[hr.date];
    if (!isDay(d)) continue;
    const w = num(r[hr.weight_kg]);
    if (!w) continue;
    body.push({ date: d.slice(0, 10), w: w, fat: num(r[hr.bodyfat_pct]), water: num(r[hr.water_pct]),
      muscle: num(r[hr.muscle]), bone: num(r[hr.bone]), visfat: num(r[hr.visfat]), bmi: num(r[hr.bmi]) });
  }
  body.sort((a, b) => (a.date < b.date ? -1 : 1));

  return { now: now, last: last, series: series, win: win, nights: nights, body: body,
    room: latest ? { ts: latest.ts, co2: latest.co2, temp: latest.temp, rh: latest.rh, bat: latest.bat } : null,
    hub: latestHub };
}
