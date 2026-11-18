/**
 * Ritmo: web app che legge il foglio hub (SwitchBot, Garmin, Renpho) e mostra la dashboard.
 * Si apre con il link della distribuzione "App web" (Esegui come: me, Accesso: solo io).
 *
 * Proprietà dello script richieste: SHEET_ID.
 * File HTML richiesto nello stesso progetto: "ritmo" (apps-script/ritmo.html). Non può chiamarsi
 * "dashboard": Apps Script non accetta un file Script e uno HTML con lo stesso nome.
 */

const N_TZ = 'Europe/Madrid';
const N_DAYS = 400;   // notti mandate alla pagina
const N_RECENT_DAYS = 30;  // giorni di storico di casa mandati alla pagina (ultimi 7 a 10 minuti, prima medie orarie)
const N_RAW_DAYS = 7;

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
  const out = nBuild_(vals(ss.getSheets()[0]), vals(ss.getSheetByName('Garmin')),
    vals(ss.getSheetByName('Renpho')), Utilities.formatDate(new Date(), N_TZ, 'yyyy-MM-dd HH:mm'));
  out.activities = nActivities_(vals(ss.getSheetByName('Attivita')));
  out.mood = nMood_(vals(ss.getSheetByName(N_MOOD_TAB)));
  out.settings = nSettings_();
  try { out.engine = typeof eStatus_ === 'function' ? eStatus_() : null; } catch (e) { out.engine = null; }
  return out;
}

const N_MOOD_TAB = 'Umore';
const N_MOOD_HEADER = ['date', 'time', 'energy', 'mood', 'pain', 'note', 'tags'];
const N_TAGS = ['fisio'];   // caselle del check-in (cosa hai fatto ieri)

/** Impostazioni dell'utente salvate dall'app (es. data dell'operazione): proprietà APP_SETTINGS, mai nel repo. */
function nSettings_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('APP_SETTINGS') || '{}'); } catch (e) { return {}; }
}

/** Attività sportive (scheda "Attivita"): [data, ora, tipo, nome, minuti, km, FC media, FC max, kcal, TE aerobico, TE anaerobico, carico, VO2max]. */
function nActivities_(rows) {
  if (rows.length < 2) return [];
  const h = {}; rows[0].forEach((n, i) => { h[String(n).trim()] = i; });
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : (typeof v === 'string' && v.trim() !== '' && isFinite(+v.replace(',', '.')) ? +v.replace(',', '.') : null);
  const str = v => (v instanceof Date) ? Utilities.formatDate(v, N_TZ, 'yyyy-MM-dd') : String(v || '');
  return rows.slice(1).filter(r => /^\d{4}-\d{2}-\d{2}/.test(str(r[h.date]))).map(r => [
    str(r[h.date]).slice(0, 10), String(r[h.start] || '').slice(0, 5), String(r[h.type] || ''), String(r[h.name] || '').slice(0, 60),
    num(r[h.duration_min]), num(r[h.distance_km]), num(r[h.avg_hr]), nHr_(num(r[h.max_hr])), num(r[h.calories]),
    num(r[h.aerobic_te]), num(r[h.anaerobic_te]), num(r[h.training_load]), num(r[h.vo2max])]);
}

/** Battito oltre 200 = errore del sensore al polso: scartato. */
function nHr_(v) { return v !== null && v > 200 ? null : v; }

/** Check-in (scheda "Umore"): una riga per giorno. */
function nMood_(rows) {
  if (rows.length < 2) return [];
  const h = {}; rows[0].forEach((n, i) => { h[String(n).trim()] = i; });
  const str = v => (v instanceof Date) ? Utilities.formatDate(v, N_TZ, 'yyyy-MM-dd') : String(v || '');
  const num = v => (typeof v === 'number' && isFinite(v)) ? v : null;
  return rows.slice(1).filter(r => /^\d{4}-\d{2}-\d{2}$/.test(str(r[h.date]))).map(r => ({
    date: str(r[h.date]), time: String(r[h.time] || ''), energy: num(r[h.energy]), mood: num(r[h.mood]),
    pain: num(r[h.pain]), note: String(r[h.note] || '').slice(0, 280),
    tags: h.tags === undefined ? [] : String(r[h.tags] || '').split(',').map(t => t.trim()).filter(t => N_TAGS.indexOf(t) >= 0) }));
}

/**
 * Salva il check-in del giorno (chiamata dall'app con google.script.run).
 * Una riga per data: se esiste già la aggiorna. Restituisce la riga salvata.
 */
function ritmoSaveCheckin(c) {
  // Segnale di apertura dall'app (nessun dato salvato nel foglio Umore): versione e ora, per la diagnosi.
  if (c && c.ping) {
    PropertiesService.getScriptProperties().setProperty('APP_SEEN', JSON.stringify({
      at: Utilities.formatDate(new Date(), N_TZ, 'yyyy-MM-dd HH:mm'), release: String(c.release || '').slice(0, 40),
      ref: String(c.ref || '').slice(0, 12), view: String(c.view || '').slice(0, 20), w: Number(c.w) || null }));
    return { ok: true };
  }
  // Impostazioni dall'app (nessun dato nel foglio): per ora solo la data dell'operazione.
  if (c && c.settings) {
    const st = nSettings_(), op = String(c.settings.op_date || '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(op)) st.op_date = op; else if (op === '') delete st.op_date;
    PropertiesService.getScriptProperties().setProperty('APP_SETTINGS', JSON.stringify(st));
    return st;
  }
  const day = Utilities.formatDate(new Date(), N_TZ, 'yyyy-MM-dd');
  const date = (c && /^\d{4}-\d{2}-\d{2}$/.test(c.date || '')) ? c.date : day;
  const int = (v, a, b) => { const x = Math.round(Number(v)); return isFinite(x) && x >= a && x <= b ? x : ''; };
  const row = [date, Utilities.formatDate(new Date(), N_TZ, 'HH:mm'), int(c && c.energy, 1, 5), int(c && c.mood, 1, 5),
    int(c && c.pain, 0, 10), String((c && c.note) || '').replace(/[\r\n]+/g, ' ').slice(0, 280),
    ((c && c.tags) || []).filter(t => N_TAGS.indexOf(t) >= 0).join(',')];
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
    const sh = ss.getSheetByName(N_MOOD_TAB) || ss.insertSheet(N_MOOD_TAB);
    sh.getRange('A:B').setNumberFormat('@');
    if (sh.getLastRow() === 0) sh.appendRow(N_MOOD_HEADER);
    else if (sh.getLastColumn() < N_MOOD_HEADER.length) sh.getRange(1, 1, 1, N_MOOD_HEADER.length).setValues([N_MOOD_HEADER]);
    const i = eKeys_(sh).indexOf(date);
    if (i >= 0) sh.getRange(i + 2, 1, 1, row.length).setValues([row]); else eAppend_(sh, [row], 2);
  } finally { lock.releaseLock(); }
  return { date: row[0], time: row[1], energy: row[2] === '' ? null : row[2], mood: row[3] === '' ? null : row[3],
    pain: row[4] === '' ? null : row[4], note: row[5], tags: row[6] ? row[6].split(',') : [] };
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
        co2: num(r[hs.co2_ppm]), temp: num(r[hs.temp_c]), rh: rh, bat: num(r[hs.battery]),
        htemp: hs.hub_temp_c === undefined ? null : num(r[hs.hub_temp_c]),
        hrh: hs.hub_rh_pct === undefined ? null : num(r[hs.hub_rh_pct]) };
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

  // Curve di ogni notte con dati della camera (22:00-10:00): [minuti dalle 22, CO2, temperatura].
  const nightSeries = {};
  nights.forEach(n => {
    if (!n.air) return;
    const from = absMin(prevDay(n.date), '22:00'), to = absMin(n.date, '10:00');
    const w = windowOf(n.date);
    nightSeries[n.date] = { win: [w.start - from, w.end - from],
      pts: air.filter(p => p.t >= from && p.t <= to).map(p => [p.t - from, p.co2, p.temp]) };
  });
  // Ultimi giorni di letture grezze di casa: [minuti assoluti, CO2, temp, umidità, temp e umidità seconda stanza].
  const lastT = air.length ? air[air.length - 1].t : 0;
  const cutRaw = lastT - N_RAW_DAYS * 1440, hours = {};
  air.filter(p => p.t >= lastT - N_RECENT_DAYS * 1440 && p.t < cutRaw).forEach(p => { const k = Math.floor(p.t / 60) * 60; (hours[k] = hours[k] || []).push(p); });
  const mean = (a, f) => { const v = a.map(f).filter(x => typeof x === 'number' && isFinite(x)); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10) / 10 : null; };
  const recent = Object.keys(hours).map(Number).sort((a, b) => a - b)
    .map(k => [k, mean(hours[k], p => p.co2), mean(hours[k], p => p.temp), mean(hours[k], p => p.rh), mean(hours[k], p => p.htemp), mean(hours[k], p => p.hrh)])
    .concat(air.filter(p => p.t >= cutRaw).map(p => [p.t, p.co2, p.temp, p.rh, p.htemp, p.hrh]));

  return { now: now, last: last, series: series, win: win, nights: nights, body: body,
    nightSeries: nightSeries, recent: recent,
    room: latest ? { ts: latest.ts, co2: latest.co2, temp: latest.temp, rh: latest.rh, bat: latest.bat } : null,
    hub: latestHub };
}

/**
 * Promemoria del check-in (dal pianificatore, alle 12): una mail breve se oggi manca il check-in.
 * Restituisce true se ha mandato la mail.
 */
function nCheckinReminder() {
  const p = PropertiesService.getScriptProperties();
  const ss = SpreadsheetApp.openById(p.getProperty('SHEET_ID'));
  const sh = ss.getSheetByName(N_MOOD_TAB);
  const today = Utilities.formatDate(new Date(), N_TZ, 'yyyy-MM-dd');
  if (sh && eKeys_(sh).indexOf(today) >= 0) return false;
  const url = p.getProperty('RITMO_URL') || '';
  MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), subject: 'Ritmo · come ti senti oggi?', name: 'Ritmo',
    htmlBody: '<div style="font-family:-apple-system,Segoe UI,sans-serif;font-size:15px;color:#1d2433">' +
      '<p>Non hai ancora fatto il check-in di oggi: energia, umore, dolore e se ieri hai fatto fisio.</p>' +
      '<p>Bastano 10 secondi e ogni giorno in più aiuta Ritmo a capire cosa ti fa dormire e recuperare meglio.</p>' +
      (url ? '<p><a href="' + url + '" style="display:inline-block;background:#ff6a2b;color:#fff;text-decoration:none;padding:11px 20px;border-radius:12px;font-weight:600">Apri Ritmo</a></p>' : '<p>Apri Ritmo dal tuo link.</p>') + '</div>' });
  return true;
}
