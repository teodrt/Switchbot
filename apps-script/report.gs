/**
 * Report settimanale di Ritmo: ogni lunedì mattina una email con la settimana appena finita
 * (lunedì-domenica) confrontata con le 4 settimane precedenti.
 *
 * Usa nData_() di dashboard.gs (stesso progetto). Manda l'email all'indirizzo del proprietario
 * dello script. Proprietà facoltativa: RITMO_URL (link dell'app, per il pulsante "Apri Ritmo").
 *
 * Funzioni da eseguire a mano:
 *   ritmoReportTest   manda subito il report dell'ultima settimana completa
 *   ritmoReportSetup  crea il trigger del lunedì (8:40) senza toccare gli altri
 */

const WK_TZ = 'Europe/Madrid';
const WK_MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function ritmoReportWeekly() { wkSend_(); }
function ritmoReportTest() { wkSend_(); }

function ritmoReportSetup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'ritmoReportWeekly')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('ritmoReportWeekly').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(8).nearMinute(40).inTimezone(WK_TZ).create();
}

function wkSend_() {
  const today = Utilities.formatDate(new Date(), WK_TZ, 'yyyy-MM-dd');
  const w = wkBuild_(nData_(), today);
  const url = PropertiesService.getScriptProperties().getProperty('RITMO_URL') || '';
  MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), subject: 'Ritmo · la tua settimana ' + w.label,
    htmlBody: wkHtml_(w, url), name: 'Ritmo' });
}

/** Funzione pura: dati dell'app -> riepilogo dell'ultima settimana completa prima di oggi. */
function wkBuild_(D, today) {
  const dn = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
  const fd = n => new Date(n * 86400000).toISOString().slice(0, 10);
  const isNum = x => typeof x === 'number' && isFinite(x);
  const avg = a => { const v = a.filter(isNum); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const t = dn(today), dow = (new Date(t * 86400000).getUTCDay() + 6) % 7;   // 0 = lunedì
  const end = t - dow - 1, start = end - 6, pStart = start - 28, pEnd = start - 1;
  const inW = (d, a, b) => { const x = dn(d); return x >= a && x <= b; };
  const nights = D.nights || [];
  const cur = nights.filter(n => inW(n.date, start, end)), prev = nights.filter(n => inW(n.date, pStart, pEnd));
  const bed = s => { if (!/^\d{2}:\d{2}$/.test(s || '')) return null; const m = +s.slice(0, 2) * 60 + +s.slice(3, 5); return m >= 720 ? m - 1440 : m; };
  const metric = (k, get, better, dec, unit, label, fmt) => {
    const a = avg(cur.map(get)), b = avg(prev.map(get));
    return { k: k, label: label, now: a, was: b, better: better, dec: dec, unit: unit, fmt: fmt || null,
      delta: isNum(a) && isNum(b) ? a - b : null };
  };
  const M = [
    metric('score', n => n.score, 1, 0, '', 'Sleep score'),
    metric('sleep_h', n => n.sleep_h, 1, 1, ' h', 'Ore di sonno'),
    metric('bed', n => bed(n.bed_start), -1, 0, '', 'Ti addormenti alle', 'clock'),
    metric('hrv', n => n.hrv, 1, 0, ' ms', 'HRV notturna'),
    metric('rhr', n => n.rhr, -1, 0, ' bpm', 'Battito a riposo'),
    metric('bb', n => n.bb_wake, 1, 0, '', 'Body Battery al risveglio'),
    metric('stress', n => n.stress, -1, 0, '', 'Stress medio'),
    metric('steps', n => n.steps, 1, 0, '', 'Passi al giorno'),
    metric('co2', n => n.air ? n.air.co2_avg : null, -1, 0, ' ppm', 'CO2 notturna in camera'),
    metric('temp', n => n.air ? n.air.temp_avg : null, 0, 1, ' °C', 'Temperatura della camera')
  ];
  const scored = cur.filter(n => isNum(n.score));
  const best = scored.length ? scored.reduce((a, b) => (b.score > a.score ? b : a)) : null;
  const worst = scored.length ? scored.reduce((a, b) => (b.score < a.score ? b : a)) : null;
  const co2High = cur.filter(n => n.air && n.air.over1000_min >= 60).length;
  const acts = (D.activities || []).filter(a => inW(a[0], start, end));
  const actsPrev = (D.activities || []).filter(a => inW(a[0], pStart, pEnd));
  const sum = (l, i) => l.reduce((s, a) => s + (isNum(a[i]) ? a[i] : 0), 0);
  const sport = { n: acts.length, min: sum(acts, 4), load: sum(acts, 11), prevMinWeek: sum(actsPrev, 4) / 4 };
  const body = (D.body || []).filter(b => inW(b.date, start, end));
  const bodyBefore = (D.body || []).filter(b => dn(b.date) < start);
  const weight = body.length ? { now: body[body.length - 1].w, was: bodyBefore.length ? bodyBefore[bodyBefore.length - 1].w : null } : null;
  const mood = (D.mood || []).filter(m => inW(m.date, start, end)), moodPrev = (D.mood || []).filter(m => inW(m.date, pStart, pEnd));
  const feel = { n: mood.length, energy: avg(mood.map(m => m.energy)), mood: avg(mood.map(m => m.mood)), pain: avg(mood.map(m => m.pain)),
    energyWas: avg(moodPrev.map(m => m.energy)), painWas: avg(moodPrev.map(m => m.pain)) };
  // Le variazioni più grandi rispetto alla variabilità delle 4 settimane prima.
  const sd = (get) => { const v = prev.map(get).filter(isNum); if (v.length < 5) return null; const m = avg(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / (v.length - 1)); };
  const getters = { score: n => n.score, sleep_h: n => n.sleep_h, bed: n => bed(n.bed_start), hrv: n => n.hrv, rhr: n => n.rhr, bb: n => n.bb_wake, stress: n => n.stress, steps: n => n.steps };
  const moves = M.filter(m => isNum(m.delta) && m.better !== 0 && getters[m.k]).map(m => { const s = sd(getters[m.k]); return s ? Object.assign({ z: m.delta / s }, m) : null; })
    .filter(m => m && Math.abs(m.z) >= 0.5).sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 3);
  const dl = n => { const d = fd(n); return +d.slice(8, 10) + ' ' + WK_MESI[+d.slice(5, 7) - 1]; };
  return { label: dl(start) + ' - ' + dl(end), start: fd(start), end: fd(end), nights: cur.length, metrics: M, best: best, worst: worst,
    co2High: co2High, airNights: cur.filter(n => n.air).length, sport: sport, weight: weight, feel: feel, moves: moves };
}

function wkHtml_(w, url) {
  const isNum = x => typeof x === 'number' && isFinite(x);
  const f = (v, d) => !isNum(v) ? '-' : v.toFixed(d || 0).replace('.', ',');
  const clock = m => { let x = Math.round(m); x = ((x % 1440) + 1440) % 1440; return ('0' + Math.floor(x / 60)).slice(-2) + ':' + ('0' + x % 60).slice(-2); };
  const val = m => m.fmt === 'clock' ? (isNum(m.now) ? clock(m.now) : '-') : f(m.now, m.dec) + (isNum(m.now) ? m.unit : '');
  const dlt = m => {
    if (!isNum(m.delta)) return '';
    const good = m.better === 0 ? null : m.delta * m.better > 0;
    const col = good === null || Math.abs(m.delta) < Math.pow(10, -m.dec) ? '#6b7593' : good ? '#19976a' : '#cc4247';
    const zero = Math.abs(m.delta) < 0.5 * Math.pow(10, -m.dec);
    const txt = zero ? '=' : m.fmt === 'clock' ? (m.delta > 0 ? '+' : '-') + f(Math.abs(m.delta), 0) + ' min' : (m.delta > 0 ? '+' : '-') + f(Math.abs(m.delta), m.dec);
    return '<span style="color:' + col + ';font-size:13px">' + txt + '</span>';
  };
  const row = m => '<tr><td style="padding:9px 0;border-bottom:1px solid #e6e9f2;color:#3b4560">' + m.label + '</td><td style="padding:9px 0;border-bottom:1px solid #e6e9f2;text-align:right;font-family:Menlo,monospace">' + val(m) + '</td><td style="padding:9px 0 9px 12px;border-bottom:1px solid #e6e9f2;text-align:right;white-space:nowrap">' + dlt(m) + '</td></tr>';
  const card = (title, body) => '<div style="background:#fff;border:1px solid #e1e5f0;border-radius:16px;padding:18px 20px;margin:0 0 14px">' +
    '<div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#6b7593;font-weight:600;margin-bottom:8px">' + title + '</div>' + body + '</div>';
  const moves = w.moves.map(m => { const good = m.delta * m.better > 0;
    return '<p style="margin:6px 0;color:#1b2340"><span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 8px;border-radius:999px;margin-right:6px;color:' + (good ? '#19976a;background:#e3f5ee' : '#cc4247;background:#fbe7e8') + '">' + (good ? 'meglio' : 'peggio') + '</span>' +
      m.label + ': ' + val(m) + ' contro ' + (m.fmt === 'clock' ? clock(m.was) : f(m.was, m.dec) + m.unit) + ' nelle 4 settimane prima.</p>'; }).join('');
  const dname = d => { const x = new Date(d + 'T12:00:00Z'); return ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'][x.getUTCDay()] + ' ' + +d.slice(8, 10); };
  let h = '<div style="background:#eef1f8;padding:24px 12px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111a2e">' +
    '<div style="max-width:560px;margin:0 auto">' +
    '<div style="background:linear-gradient(135deg,#1b2550,#0d1430);border-radius:20px;padding:24px;color:#eaeefa;margin-bottom:14px">' +
    '<div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.75">Ritmo · settimana</div>' +
    '<div style="font-size:26px;font-weight:700;margin:6px 0 4px">' + w.label + '</div>' +
    '<div style="opacity:.8;font-size:14px">' + w.nights + ' notti registrate' + (w.airNights ? ', ' + w.airNights + ' con i dati della camera' : '') + '</div></div>';
  if (moves) h += card('Cosa è cambiato', moves);
  h += card('Sonno e recupero', '<table style="width:100%;border-collapse:collapse;font-size:14px">' + w.metrics.slice(0, 7).map(row).join('') + '</table>' +
    (w.best ? '<p style="margin:12px 0 0;font-size:13px;color:#3b4560">Notte migliore: <b>' + dname(w.best.date) + '</b> (' + w.best.score + ') · peggiore: <b>' + dname(w.worst.date) + '</b> (' + w.worst.score + ')</p>' : ''));
  h += card('Casa', '<table style="width:100%;border-collapse:collapse;font-size:14px">' + w.metrics.slice(8).map(row).join('') + '</table>' +
    '<p style="margin:12px 0 0;font-size:13px;color:#3b4560">' + (w.airNights ? (w.co2High ? '<b style="color:#cc4247">' + w.co2High + ' notti</b> con CO2 sopra 1000 ppm per più di un\'ora.' : 'Nessuna notte con CO2 sopra 1000 ppm a lungo.') : 'Nessun dato della camera questa settimana.') + '</p>');
  h += card('Attività', '<table style="width:100%;border-collapse:collapse;font-size:14px">' + row(w.metrics[7]) + '</table>' +
    '<p style="margin:12px 0 0;font-size:14px">' + (w.sport.n ? '<b>' + w.sport.n + '</b> ' + (w.sport.n === 1 ? 'allenamento' : 'allenamenti') + ', <b>' + f(w.sport.min) + '</b> minuti' + (w.sport.load ? ', carico ' + f(w.sport.load) : '') + ' (media delle 4 settimane prima: ' + f(w.sport.prevMinWeek) + ' minuti).' : 'Nessun allenamento registrato: durante il recupero va benissimo.') + '</p>');
  if (w.weight) h += card('Corpo', '<p style="margin:0;font-size:14px">Peso <b>' + f(w.weight.now, 1) + ' kg</b>' + (isNum(w.weight.was) ? ' (' + (w.weight.now - w.weight.was > 0 ? '+' : '') + f(w.weight.now - w.weight.was, 1) + ' kg dalla pesata precedente)' : '') + '.</p>');
  h += card('Come ti sei sentito', w.feel.n ? '<p style="margin:0;font-size:14px">' + w.feel.n + ' check-in · energia <b>' + f(w.feel.energy, 1) + '</b>/5 · umore <b>' + f(w.feel.mood, 1) + '</b>/5 · dolore <b>' + f(w.feel.pain, 1) + '</b>/10' +
    (isNum(w.feel.painWas) ? ' (prima ' + f(w.feel.painWas, 1) + ')' : '') + '.</p>' : '<p style="margin:0;font-size:14px;color:#3b4560">Nessun check-in questa settimana. Bastano pochi secondi al giorno dall\'app: più check-in, più Ritmo capisce cosa ti fa stare bene.</p>');
  if (url) h += '<div style="text-align:center;margin:18px 0 6px"><a href="' + url + '" style="display:inline-block;background:#3d56d4;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">Apri Ritmo</a></div>';
  h += '<p style="text-align:center;font-size:11px;color:#8a93ab;margin-top:14px">Confronto con le 4 settimane precedenti. Generato automaticamente da Ritmo.</p></div></div>';
  return h;
}
