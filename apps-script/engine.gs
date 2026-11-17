/**
 * Pianificatore di Ritmo. Scaricato ed eseguito dal motore fisso (motore.gs) a ogni ritmoTick,
 * cioè ogni 10 minuti. Decide quali lavori sono dovuti, esegue le operazioni una tantum
 * (migrazioni) e tiene in ordine i trigger. Per aggiungere un lavoro o una migrazione basta
 * modificare questo file su main: non serve toccare il progetto Apps Script.
 */

const E_TZ = 'Europe/Madrid';

// Lavori ricorrenti. every: ogni giro (10 minuti); daily: una volta al giorno dopo l'ora indicata;
// weekly: [giorno ISO 1 = lunedì, ora].
const E_JOBS = [
  { id: 'switchbot', fn: 'logReading', every: true },
  { id: 'garmin', fn: 'garminDaily', daily: '10:00' },
  { id: 'renpho', fn: 'renphoDaily', daily: '11:00' },
  { id: 'report', fn: 'ritmoReportWeekly', weekly: [1, '08:40'] }
];

// Operazioni una tantum: girano una volta sola, al primo giro utile, una per giro.
const E_MIGRATIONS = [
  { id: '2026-11-17-attivita-3-anni', fn: 'garminActivitiesBackfill' }
];

function ritmoEngineTick_() {
  const p = PropertiesService.getScriptProperties();
  const now = new Date();
  const day = Utilities.formatDate(now, E_TZ, 'yyyy-MM-dd');
  const hm = Utilities.formatDate(now, E_TZ, 'HH:mm');
  const isoDow = +Utilities.formatDate(now, E_TZ, 'u');
  eEnsureTriggers_();

  E_JOBS.forEach(j => {
    const doneKey = 'JOB_' + j.id, failKey = 'JOBFAIL_' + j.id;
    let due = false;
    if (j.every) due = true;
    else if (j.daily) due = hm >= j.daily && p.getProperty(doneKey) !== day;
    else if (j.weekly) due = isoDow === j.weekly[0] && hm >= j.weekly[1] && p.getProperty(doneKey) !== day;
    if (!due) return;
    if (!j.every && Date.now() - +(p.getProperty(failKey) || 0) < 3600 * 1000) return;   // riprova dopo un'ora
    try {
      globalThis[j.fn]();
      if (!j.every) { p.setProperty(doneKey, day); eLog_('ok ' + j.id); }
      p.deleteProperty(failKey);
    } catch (e) {
      p.setProperty(failKey, String(Date.now()));
      eLog_('errore ' + j.id + ': ' + e.message);
    }
  });

  const done = JSON.parse(p.getProperty('MIGRATIONS_DONE') || '[]');
  const next = E_MIGRATIONS.find(m => done.indexOf(m.id) < 0);
  if (next && Date.now() - +(p.getProperty('MIGFAIL_' + next.id) || 0) > 3600 * 1000) {
    try {
      globalThis[next.fn]();
      done.push(next.id); p.setProperty('MIGRATIONS_DONE', JSON.stringify(done));
      p.deleteProperty('MIGFAIL_' + next.id);
      eLog_('migrazione fatta: ' + next.id);
    } catch (e) {
      p.setProperty('MIGFAIL_' + next.id, String(Date.now()));
      eLog_('migrazione fallita ' + next.id + ': ' + e.message);
    }
  }
  p.setProperty('ENGINE_LAST', Utilities.formatDate(new Date(), E_TZ, 'yyyy-MM-dd HH:mm'));
}

/** Tiene un solo trigger: ritmoTick ogni 10 minuti. Rimuove quelli vecchi (logReading, garminDaily...). */
function eEnsureTriggers_() {
  const all = ScriptApp.getProjectTriggers();
  const ticks = all.filter(t => t.getHandlerFunction() === 'ritmoTick');
  all.filter(t => t.getHandlerFunction() !== 'ritmoTick').forEach(t => ScriptApp.deleteTrigger(t));
  ticks.slice(1).forEach(t => ScriptApp.deleteTrigger(t));
  if (!ticks.length) ScriptApp.newTrigger('ritmoTick').timeBased().everyMinutes(10).create();
}

/** Registro breve del motore (ultime 30 righe), mostrato nell'app. */
function eLog_(msg) {
  const p = PropertiesService.getScriptProperties();
  const log = JSON.parse(p.getProperty('ENGINE_LOG') || '[]');
  log.push([Utilities.formatDate(new Date(), E_TZ, 'yyyy-MM-dd HH:mm'), String(msg).slice(0, 200)]);
  p.setProperty('ENGINE_LOG', JSON.stringify(log.slice(-30)));
}

/** Stato del motore per l'app. */
function eStatus_() {
  const p = PropertiesService.getScriptProperties();
  const log = JSON.parse(p.getProperty('ENGINE_LOG') || '[]');
  return { last: p.getProperty('ENGINE_LAST') || '', code: p.getProperty('RITMO_MD5') || '', updated: p.getProperty('RITMO_UPDATED') || '',
    errors: log.filter(l => /errore|fallita/.test(l[1])).slice(-5), log: log.slice(-8) };
}
