/**
 * Contesto della giornata, per capire cosa cambia il sonno senza chiedere niente in più:
 * - Calendario (Google Calendar dell'account): giorni con fisioterapia e serate con impegni dopo le 21.
 *   Nella scheda "Calendario" finiscono solo sì/no, l'ora di fine dell'ultimo impegno e il numero di
 *   impegni: mai titoli, luoghi o partecipanti. Solo i calendari di proprietà (niente calendari condivisi
 *   da altri, che potrebbero essere di un'altra persona).
 * - Meteo fuori casa (Open-Meteo, gratuito, senza account): per ogni notte temperatura e umidità medie
 *   dalle 22 alle 7, pressione media e variazione della pressione in 24 ore, massima del giorno prima.
 *   La posizione (città scelta nell'app, arrotondata a ~1 km) resta in APP_SETTINGS.place, mai nel repo.
 * Prefisso dei nomi: cx.
 */
const CX_CAL_TAB = 'Calendario';
const CX_CAL_HEADER = ['date', 'fisio', 'sera', 'fine_ultimo', 'eventi'];
const CX_MET_TAB = 'Meteo';
const CX_MET_HEADER = ['date', 't_notte', 'rh_notte', 'p_notte', 'dp24', 't_max'];
const CX_FISIO = /fisio|physio|riabilit|osteopat|kinesi/i;
const CX_LATE = '21:00';
const CX_API = 'https://api.open-meteo.com/v1/forecast';

/** Giorno precedente di una data "yyyy-MM-dd" (calcolo puro, senza fusi orari). */
function cxPrevDay_(d) {
  return new Date(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - 86400000).toISOString().slice(0, 10);
}

/** Funzione pura: impegni di un giorno -> riga della scheda Calendario. ev = [{title, start, end}] (HH:mm). */
function cxDayRow_(date, ev) {
  const fisio = ev.some(e => CX_FISIO.test(e.title || ''));
  const last = ev.map(e => e.end).filter(Boolean).sort().pop() || '';
  return [date, fisio ? 1 : 0, last > CX_LATE ? 1 : 0, last, ev.length];
}

/** Impegni dei calendari di proprietà tra due date, raggruppati per giorno (niente eventi di tutto il giorno o rifiutati). */
function cxEvents_(from, to) {
  const out = {};
  CalendarApp.getAllOwnedCalendars().forEach(c => {
    let evs = [];
    try { evs = c.getEvents(from, to); } catch (e) { evs = []; }
    evs.forEach(e => {
      if (e.isAllDayEvent()) return;
      let st = ''; try { st = String(e.getMyStatus()); } catch (x) { st = ''; }
      if (st === 'NO') return;
      const s = e.getStartTime(), en = e.getEndTime();
      const day = Utilities.formatDate(s, E_TZ, 'yyyy-MM-dd'), endDay = Utilities.formatDate(en, E_TZ, 'yyyy-MM-dd');
      (out[day] = out[day] || []).push({ title: e.getTitle(), start: Utilities.formatDate(s, E_TZ, 'HH:mm'),
        end: endDay > day ? '23:59' : Utilities.formatDate(en, E_TZ, 'HH:mm') });
    });
  });
  return out;
}

/** Ogni mattina: i giorni finiti più recenti (la prima volta gli ultimi 90). Serve il permesso del calendario. */
function cxCalendarDaily() {
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  const sh = ss.getSheetByName(CX_CAL_TAB);
  const back = !sh || sh.getLastRow() < 30 ? 90 : 3;
  const today = Utilities.formatDate(new Date(), E_TZ, 'yyyy-MM-dd');
  const days = []; let d = today;
  for (let k = 0; k < back; k++) { d = cxPrevDay_(d); days.unshift(d); }
  const ev = cxEvents_(new Date(days[0] + 'T00:00:00'), new Date(today + 'T00:00:00'));
  cxWrite_(ss, CX_CAL_TAB, CX_CAL_HEADER, days.map(x => cxDayRow_(x, ev[x] || [])), 4);
}

/** Aggiorna o aggiunge righe per data, con le prime textCols colonne come testo, e tiene la scheda in ordine. */
function cxWrite_(ss, tab, header, rows, textCols) {
  const sh = ss.getSheetByName(tab) || ss.insertSheet(tab);
  if (sh.getLastRow() === 0) sh.appendRow(header);
  const keys = eKeys_(sh), add = [];
  rows.forEach(r => {
    const i = keys.indexOf(r[0]);
    if (i >= 0) sh.getRange(i + 2, 1, 1, r.length).setValues([r]);
    else { add.push(r); keys.push(r[0]); }
  });
  eAppend_(sh, add, textCols);
  if (sh.getLastRow() > 2) sh.getRange(2, 1, sh.getLastRow() - 1, header.length).sort(1);
}

/**
 * Funzione pura: risposta oraria di Open-Meteo -> una riga per notte (data del risveglio), solo notti già finite
 * (le 7 del mattino sono prima di nowIso, "yyyy-MM-ddTHH:mm"): niente previsioni scambiate per misure.
 */
function cxMeteoRows_(j, nowIso) {
  const h = j && j.hourly;
  if (!h || !h.time) return [];
  const at = {}; h.time.forEach((t, i) => { at[t] = i; });
  const num = v => typeof v === 'number' && isFinite(v);
  const mean = (idx, k) => { const v = idx.map(i => h[k] && h[k][i]).filter(num); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10) / 10 : ''; };
  const days = Array.from(new Set(h.time.map(t => t.slice(0, 10)))).sort();
  const rows = [];
  days.forEach(d => {
    if (d + 'T07:00' > nowIso) return;
    const prev = cxPrevDay_(d);
    const night = h.time.map((t, i) => [t, i]).filter(x => x[0] >= prev + 'T22:00' && x[0] <= d + 'T07:00').map(x => x[1]);
    if (night.length < 10) return;   // notte completa: dalle 22 alle 7 sono 10 ore
    const p7 = at[d + 'T07:00'], p7y = at[prev + 'T07:00'], P = h.surface_pressure || [];
    const dp = p7 !== undefined && p7y !== undefined && num(P[p7]) && num(P[p7y]) ? Math.round((P[p7] - P[p7y]) * 10) / 10 : '';
    const day = h.time.map((t, i) => [t, i]).filter(x => x[0].slice(0, 10) === prev).map(x => h.temperature_2m[x[1]]).filter(num);
    rows.push([d, mean(night, 'temperature_2m'), mean(night, 'relative_humidity_2m'), mean(night, 'surface_pressure'), dp,
      day.length >= 20 ? Math.max.apply(null, day) : '']);
  });
  return rows;
}

/** Ogni mattina: le ultime notti (la prima volta gli ultimi 92 giorni). Niente da fare se la città non è scelta. */
function cxWeatherDaily() {
  const place = nSettings_().place;
  if (!place) return;
  const ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  const sh = ss.getSheetByName(CX_MET_TAB);
  const past = !sh || sh.getLastRow() < 30 ? 92 : 3;
  const url = CX_API + '?latitude=' + place.lat + '&longitude=' + place.lon +
    '&hourly=temperature_2m,relative_humidity_2m,surface_pressure&past_days=' + past + '&forecast_days=1&timezone=Europe%2FMadrid';
  const j = JSON.parse(UrlFetchApp.fetch(url).getContentText());
  cxWrite_(ss, CX_MET_TAB, CX_MET_HEADER, cxMeteoRows_(j, Utilities.formatDate(new Date(), E_TZ, "yyyy-MM-dd'T'HH:mm")), 1);
}

/** Temperatura e umidità fuori adesso, per la mail della sera (null se la città non è scelta o il servizio non risponde). */
function cxOutsideNow_() {
  const place = nSettings_().place;
  if (!place) return null;
  try {
    const j = JSON.parse(UrlFetchApp.fetch(CX_API + '?latitude=' + place.lat + '&longitude=' + place.lon +
      '&current=temperature_2m,relative_humidity_2m&timezone=Europe%2FMadrid').getContentText());
    return j.current ? { t: j.current.temperature_2m, rh: j.current.relative_humidity_2m } : null;
  } catch (e) { return null; }
}

/** Città scritta nell'app -> posizione arrotondata a 2 decimali (circa 1 km). */
function cxGeocode_(name) {
  const j = JSON.parse(UrlFetchApp.fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=it&format=json&name=' +
    encodeURIComponent(String(name).slice(0, 80))).getContentText());
  const r = j.results && j.results[0];
  if (!r) throw new Error('Città non trovata: prova con il nome della città (es. Barcellona)');
  return { name: r.name + (r.admin1 && r.admin1 !== r.name ? ', ' + r.admin1 : ''), lat: Math.round(r.latitude * 100) / 100, lon: Math.round(r.longitude * 100) / 100 };
}

/** Dati meteo per l'app subito dopo aver scelto la città (stessa forma di DATA.weather). */
function cxWeatherMap_() {
  const sh = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID')).getSheetByName(CX_MET_TAB);
  return sh ? nMeteo_(sh.getDataRange().getValues().map(r => [r[0] instanceof Date ? Utilities.formatDate(r[0], E_TZ, 'yyyy-MM-dd') : r[0]].concat(r.slice(1)))) : {};
}
