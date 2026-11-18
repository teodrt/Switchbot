/**
 * Aria della camera condivisa tra due persone che dormono nella stessa stanza.
 *
 * Chi ha il sensore SwitchBot (proprietà SWITCHBOT_TOKEN) scrive ogni ora le ultime letture dell'aria
 * in un foglio a parte, "Ritmo - Aria camera" (creato da solo, id nella proprietà AIR_SHEET_ID).
 * Quel foglio contiene SOLO data, temperatura, umidità e CO2: niente sonno, peso o check-in.
 * Il proprietario lo condivide in sola lettura con l'altra persona.
 *
 * Chi non ha il sensore mette l'id di quel foglio nella proprietà AIR_SOURCE_ID: a ogni giro le
 * letture nuove vengono copiate nella prima scheda del suo foglio, nello stesso formato del logger.
 */
const A_TAB = 'Aria';
const A_DAYS = 45;   // giorni di letture tenuti nel foglio condiviso

function airSync() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty('SWITCHBOT_TOKEN')) {
    if (Date.now() - +(p.getProperty('AIR_LAST_EXPORT') || 0) < 55 * 60 * 1000) return;
    aExport_(); p.setProperty('AIR_LAST_EXPORT', String(Date.now()));
  } else if (p.getProperty('AIR_SOURCE_ID')) aImport_();
}

/** Righe valide dell'aria dal log SwitchBot: [timestamp, temp, umidità, CO2] (funzione pura). */
function aRows_(log, sinceTs) {
  const h = {}; (log[0] || []).forEach((n, i) => { h[String(n).trim()] = i; });
  const num = v => typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && isFinite(+v.replace(',', '.')) ? +v.replace(',', '.') : null);
  return log.slice(1).map(r => [String(r[0]).slice(0, 16), num(r[h.temp_c]), num(r[h.rh_pct]), num(r[h.co2_ppm])])
    .filter(r => r[0] >= sinceTs && r[2] !== null && r[2] > 0);
}

function aExport_() {
  const p = PropertiesService.getScriptProperties();
  const src = SpreadsheetApp.openById(p.getProperty('SHEET_ID')).getSheets()[0];
  const fmt = v => v instanceof Date ? Utilities.formatDate(v, E_TZ, 'yyyy-MM-dd HH:mm') : v;
  const log = src.getDataRange().getValues().map(r => [fmt(r[0])].concat(r.slice(1)));
  const since = Utilities.formatDate(new Date(Date.now() - A_DAYS * 86400000), E_TZ, 'yyyy-MM-dd HH:mm');
  const rows = [['timestamp', 'temp_c', 'rh_pct', 'co2_ppm']].concat(aRows_(log, since));
  let id = p.getProperty('AIR_SHEET_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create('Ritmo - Aria camera'); p.setProperty('AIR_SHEET_ID', ss.getId()); eLog_('creato il foglio Ritmo - Aria camera (da condividere in sola lettura)'); }
  const sh = ss.getSheetByName(A_TAB) || ss.getSheets()[0].setName(A_TAB);
  sh.clearContents();
  sh.getRange('A:A').setNumberFormat('@');
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
}

function aImport_() {
  const p = PropertiesService.getScriptProperties();
  const src = SpreadsheetApp.openById(p.getProperty('AIR_SOURCE_ID')).getSheetByName(A_TAB);
  if (!src) throw new Error('Nel foglio condiviso manca la scheda "' + A_TAB + '"');
  const dst = SpreadsheetApp.openById(p.getProperty('SHEET_ID')).getSheets()[0];
  if (dst.getLastRow() === 0) dst.appendRow(['timestamp', 'temp_c', 'rh_pct', 'co2_ppm', 'battery', 'hub_temp_c', 'hub_rh_pct', 'hub_light', 'note']);
  const last = dst.getLastRow() > 1 ? String(dst.getRange(dst.getLastRow(), 1).getDisplayValue()).slice(0, 16) : '';
  const fresh = src.getDataRange().getValues().slice(1).map(r => [String(r[0]).slice(0, 16), r[1], r[2], r[3]]).filter(r => r[0] > last);
  if (!fresh.length) return;
  eAppend_(dst, fresh.map(r => r.concat(['', '', '', '', 'condivisa'])), 1);
}
