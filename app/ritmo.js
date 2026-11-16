/* Ritmo: l'app. Caricata da jsDelivr (ramo main del repo) dal caricatore apps-script/ritmo.html,
   che fornisce la variabile globale DATA con i dati del foglio. Nessun dato personale in questo file. */
(function () {
  'use strict';
  // Versione: data della release (aggiornarla a ogni modifica) e commit da cui jsDelivr ha servito il file.
  const RELEASE = '16 nov 2026 · v3';
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const REF = (SRC.match(/@([0-9a-f]{7,40}|main)\//) || [])[1] || 'locale';
  const FONTS = 'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap';
  const MARKUP = `<div class="aurora" aria-hidden="true"></div>
<header class="top"><div class="top-in">
  <div class="brand"><span class="logo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 13h4l2.5-6 4 11 3-8 2 3H22"/></svg></span><div><b>Ritmo</b><span id="hello"></span></div></div>
  <button class="iconbtn" id="insightBtn" aria-label="Insight"><svg viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg></button>
</div></header>
<main id="main"></main>
<button class="fab" id="fab" aria-label="Check-in: come ti senti"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button>
<nav class="tabs" aria-label="Sezioni"><div class="tabs-in" id="tabs"><span class="tabpill" id="pill"></span></div></nav>
<div id="layer"></div>`;

  const boot = () => {
    const b = document.getElementById('boot'); if (b) b.remove();
    if (!document.querySelector('link[data-fonts]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS; l.dataset.fonts = '1'; document.head.appendChild(l); }
    document.body.insertAdjacentHTML('afterbegin', MARKUP);
    app();
  };
  // Aspetta il foglio di stile (al massimo 1,5 s) per non mostrare la pagina senza grafica.
  const css = [...document.querySelectorAll('link[rel="stylesheet"]')].find(l => /ritmo\.css/.test(l.href));
  if (css && !css.sheet) { let done = false; const go = () => { if (!done) { done = true; boot(); } }; css.addEventListener('load', go); css.addEventListener('error', go); setTimeout(go, 1500); }
  else boot();

  function app() {
  // =========================================================================
  // Utilità
  // =========================================================================
  const NS = 'http://www.w3.org/2000/svg';
  const $ = (sel, root) => (root || document).querySelector(sel);
  const isNum = x => typeof x === 'number' && isFinite(x);
  const fmt = (v, d) => !isNum(v) ? '-' : Number(v).toLocaleString('it-IT', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 });
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const h = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html !== undefined) n.innerHTML = html; return n; };
  const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; };
  const avg = a => { const v = a.filter(isNum); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
  const sum = a => a.filter(isNum).reduce((s, x) => s + x, 0);
  const median = a => { const v = a.filter(isNum).sort((x, y) => x - y); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const sd = a => { const v = a.filter(isNum); if (v.length < 2) return null; const m = avg(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / (v.length - 1)); };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const cap = s => String(s).replace(/^./, c => c.toUpperCase());
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const GG = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
  const dayNum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
  const fromDayNum = n => new Date(n * 86400000).toISOString().slice(0, 10);
  const addDays = (d, n) => fromDayNum(dayNum(d) + n);
  const dow = d => new Date(dayNum(d) * 86400000).getUTCDay();
  const dLabel = d => +d.slice(8, 10) + ' ' + MESI[+d.slice(5, 7) - 1];
  const dLabelY = d => dLabel(d) + ' ' + d.slice(0, 4);
  const hm = hrs => { if (!isNum(hrs)) return '-'; const m = Math.round(hrs * 60); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0'); };
  const clock = m => { let x = Math.round(m); x = ((x % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
  const bedMin = s => { if (!/^\d{2}:\d{2}$/.test(s || '')) return null; const m = +s.slice(0, 2) * 60 + +s.slice(3, 5); return m >= 720 ? m - 1440 : m; };
  const absToDate = m => new Date(m * 60000);
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raf2 = fn => requestAnimationFrame(() => requestAnimationFrame(fn));
  const buzz = () => { try { if (navigator.vibrate) navigator.vibrate(7); } catch (e) {} };
  const countUp = (node, to, dec) => {
    if (!isNum(to) || reduced) { node.textContent = fmt(to, dec); return; }
    const t0 = performance.now(), dur = 1000;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4); node.textContent = fmt(to * e, dec); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  const ICON = {
    oggi: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    sonno: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    sport: '<path d="M13 4a2 2 0 1 0 0 .01M8 21l3-7 3 3v5M7 12l3-4 4 2 3 3"/>',
    corpo: '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M9 9.5a3.5 3.5 0 0 1 6 0M12 9.5l1.2-1.6"/>',
    casa: '<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/>',
    co2: '<path d="M4 15a4 4 0 0 1 4-4 5 5 0 0 1 9.6 1.5A3.5 3.5 0 0 1 17 19H8a4 4 0 0 1-4-4z"/>',
    temp: '<path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z"/>',
    alert: '<path d="M12 8v5M12 16.5v.5"/><path d="M10.3 3.9L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    run: '<circle cx="14" cy="4.5" r="1.6"/><path d="M8 21l3-6 3 2v4M6 12l3-4 4 1.5 3 3.5"/>',
    walk: '<circle cx="13" cy="4.5" r="1.6"/><path d="M10 21l2-6 2 2v4M9 11l2-3 3 1 1 3"/>',
    bike: '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l2 7"/>',
    swim: '<path d="M3 17c2 0 2-1.5 4.5-1.5S9.5 17 12 17s2-1.5 4.5-1.5S18.5 17 21 17M8 13l4-5 3 3"/><circle cx="17" cy="7" r="1.6"/>',
    lift: '<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',
    yoga: '<circle cx="12" cy="5" r="1.6"/><path d="M12 8v6M5 11l7 3 7-3M8 20l4-6 4 6"/>',
    act: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    cal: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>'
  };
  const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k] || ICON.act}</svg>`;
  const SPORT = {
    running: ['Corsa', 'run'], trail_running: ['Trail', 'run'], treadmill_running: ['Tapis roulant', 'run'], walking: ['Camminata', 'walk'], hiking: ['Escursione', 'walk'],
    cycling: ['Bici', 'bike'], road_biking: ['Bici da strada', 'bike'], mountain_biking: ['MTB', 'bike'], indoor_cycling: ['Bici indoor', 'bike'], virtual_ride: ['Bici virtuale', 'bike'],
    lap_swimming: ['Nuoto', 'swim'], open_water_swimming: ['Nuoto', 'swim'], swimming: ['Nuoto', 'swim'], strength_training: ['Forza', 'lift'], fitness_equipment: ['Palestra', 'lift'],
    indoor_cardio: ['Cardio', 'heart'], hiit: ['HIIT', 'heart'], yoga: ['Yoga', 'yoga'], pilates: ['Pilates', 'yoga'], breathwork: ['Respirazione', 'yoga']
  };
  const sportOf = t => SPORT[t] || [t ? cap(String(t).replace(/_/g, ' ')) : 'Attività', 'act'];

  // =========================================================================
  // Dati
  // =========================================================================
  const nights = (DATA.nights || []).slice();
  const byDate = {}; nights.forEach(n => { byDate[n.date] = n; });
  const gNights = nights.filter(n => isNum(n.score));
  const body = DATA.body || [];
  const L = DATA.last;
  const today = (DATA.now || '').slice(0, 10) || (L && L.date);
  const ACTS = (DATA.activities || []).map(a => ({ date: a[0], time: a[1], type: a[2], name: a[3], min: a[4], km: a[5], hr: a[6], hrMax: a[7], kcal: a[8], te: a[9], ane: a[10], load: a[11], vo2: a[12] }));
  let MOOD = (DATA.mood || []).slice();
  const moodBy = () => { const m = {}; MOOD.forEach(x => { m[x.date] = x; }); return m; };
  nights.forEach((n, i) => {
    const b = bedMin(n.bed_start); if (b === null) return;
    const prev = nights.slice(Math.max(0, i - 7), i).map(x => bedMin(x.bed_start)).filter(isNum);
    if (prev.length >= 4) n._irreg = Math.abs(b - median(prev));
  });
  const baseline = (date, k, days) => { const prev = nights.filter(n => n.date < date && isNum(n[k])).slice(-(days || 30)); return prev.length >= 7 ? median(prev.map(n => n[k])) : null; };

  const readiness = n => {
    if (!n || !isNum(n.score)) return null;
    const parts = [];
    parts.push({ k: 'Sonno', v: clamp(n.score, 0, 100), w: .35 });
    const bh = baseline(n.date, 'hrv'); if (isNum(n.hrv) && bh) parts.push({ k: 'HRV', v: clamp(70 + 150 * (n.hrv / bh - 1), 0, 100), w: .25 });
    const br = baseline(n.date, 'rhr'); if (isNum(n.rhr) && br) parts.push({ k: 'Riposo', v: clamp(70 - 300 * (n.rhr / br - 1), 0, 100), w: .2 });
    if (isNum(n.bb_wake)) parts.push({ k: 'Energia', v: clamp(n.bb_wake, 0, 100), w: .2 });
    const tw = parts.reduce((s, p) => s + p.w, 0);
    return { score: Math.round(parts.reduce((s, p) => s + p.v * p.w, 0) / tw), parts: parts };
  };
  const state = v => !isNum(v) ? '' : v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad';
  const co2State = v => !isNum(v) ? '' : v <= 800 ? 'good' : v <= 1000 ? 'warn' : 'bad';
  const tempState = v => !isNum(v) ? '' : (v >= 17 && v <= 20) ? 'good' : (v >= 16 && v <= 22) ? 'warn' : 'bad';
  const rhState = v => !isNum(v) ? '' : (v >= 40 && v <= 60) ? 'good' : (v >= 30 && v <= 70) ? 'warn' : 'bad';
  const stateColor = s => s === 'good' ? 'var(--good)' : s === 'warn' ? 'var(--warn)' : s === 'bad' ? 'var(--bad)' : 'var(--faint)';
  const loadByDay = () => { const m = {}; ACTS.forEach(a => { m[a.date] = (m[a.date] || 0) + (isNum(a.load) ? a.load : 0); }); return m; };
  const minByDay = () => { const m = {}; ACTS.forEach(a => { m[a.date] = (m[a.date] || 0) + (isNum(a.min) ? a.min : 0); }); return m; };

  // =========================================================================
  // Motore di analisi (calcolato la prima volta che serve)
  // =========================================================================
  let ANALYSIS = null;
  const analysis = () => {
    if (ANALYSIS) return ANALYSIS;
    let seed = 20261116;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const ranks = a => { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); let i = 0;
      while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const rk = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k][1]] = rk; i = j + 1; } return r; };
    const pearson = (x, y) => { const n = x.length, mx = avg(x), my = avg(y); let a = 0, b = 0, c = 0; for (let i = 0; i < n; i++) { const p = x[i] - mx, q = y[i] - my; a += p * q; b += p * p; c += q * q; } return b && c ? a / Math.sqrt(b * c) : 0; };
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } };
    const spearmanTest = (x, y, it) => { const rx = ranks(x), ry = ranks(y), rho = pearson(rx, ry), yy = ry.slice(); let hit = 0;
      for (let t = 0; t < it; t++) { shuffle(yy); if (Math.abs(pearson(rx, yy)) >= Math.abs(rho) - 1e-12) hit++; } return { rho: rho, p: (hit + 1) / (it + 1) }; };
    const diffTest = (a, b, it) => { const all = a.concat(b), na = a.length, obs = avg(a) - avg(b); let hit = 0;
      for (let t = 0; t < it; t++) { shuffle(all); if (Math.abs(avg(all.slice(0, na)) - avg(all.slice(na))) >= Math.abs(obs) - 1e-12) hit++; } return { diff: obs, p: (hit + 1) / (it + 1) }; };
    const fdr = (tests, q) => { const s = tests.slice().sort((a, b) => a.p - b.p); let k = -1; s.forEach((t, i) => { if (t.p <= (i + 1) / s.length * q) k = i; }); return k < 0 ? [] : s.slice(0, k + 1); };
    const prevDay = n => byDate[addDays(n.date, -1)];
    const MB = moodBy(), LB = loadByDay(), firstAct = ACTS.length ? ACTS.map(a => a.date).sort()[0] : null;
    const MOODO = ['energy', 'moodv', 'pain'];
    const FACTORS = [
      { id: 'bed', label: 'ora in cui ti addormenti', axis: 'ti addormenti alle', get: n => bedMin(n.bed_start), show: v => clock(v), when: 'Quando ti addormenti tardi', hiP: v => 'ti addormenti dalle ' + clock(v) + ' in poi', loP: v => 'ti addormenti entro le ' + clock(v) },
      { id: 'irreg', label: 'scarto dal tuo orario', axis: 'minuti fuori orario', get: n => n._irreg, show: v => fmt(v) + ' min', when: 'Quando cambi orario', hiP: v => 'ti addormenti almeno ' + fmt(v) + ' minuti fuori dal tuo orario solito', loP: v => 'resti entro ' + fmt(v) + ' minuti dal tuo orario' },
      { id: 'steps', label: 'passi del giorno prima', axis: 'passi del giorno prima', get: n => { const p = prevDay(n); return p && isNum(p.steps) ? p.steps : null; }, show: v => fmt(v), when: 'Dopo giornate più attive', hiP: v => 'il giorno prima fai almeno ' + fmt(v) + ' passi', loP: v => 'ne fai al massimo ' + fmt(v) },
      { id: 'stress', label: 'stress del giorno prima', axis: 'stress del giorno prima', get: n => { const p = prevDay(n); return p && isNum(p.stress) ? p.stress : null; }, show: v => fmt(v), when: 'Dopo giornate più stressanti', hiP: v => 'lo stress medio del giorno prima è almeno ' + fmt(v), loP: v => 'è al massimo ' + fmt(v) },
      { id: 'load', label: 'carico di allenamento del giorno prima', axis: 'carico del giorno prima', get: n => firstAct && addDays(n.date, -1) >= firstAct ? (LB[addDays(n.date, -1)] || 0) : null, show: v => fmt(v), when: 'Dopo allenamenti più pesanti', hiP: v => 'il carico del giorno prima è almeno ' + fmt(v), loP: v => 'è al massimo ' + fmt(v) },
      { id: 'co2', label: 'CO2 media in camera', axis: 'CO2 media (ppm)', get: n => n.air ? n.air.co2_avg : null, show: v => fmt(v) + ' ppm', room: true, when: 'Con più CO2 in camera', hiP: v => 'la CO2 media della notte è almeno ' + fmt(v) + ' ppm', loP: v => 'è al massimo ' + fmt(v) + ' ppm' },
      { id: 'temp', label: 'temperatura della camera', axis: 'temperatura camera (°C)', get: n => n.air ? n.air.temp_avg : null, show: v => fmt(v, 1) + ' °C', room: true, when: 'Con la camera più calda', hiP: v => 'la camera è almeno a ' + fmt(v, 1) + ' °C', loP: v => 'è al massimo a ' + fmt(v, 1) + ' °C' },
      { id: 'rh', label: 'umidità della camera', axis: 'umidità camera (%)', get: n => n.air ? n.air.rh_avg : null, show: v => fmt(v) + ' %', room: true, when: 'Con aria più umida', hiP: v => 'l\'umidità è almeno al ' + fmt(v) + ' %', loP: v => 'è al massimo al ' + fmt(v) + ' %' },
      { id: 'sscore', label: 'sleep score della notte', axis: 'sleep score della notte', get: n => n.score, show: v => fmt(v), only: MOODO, when: 'Dopo notti migliori', hiP: v => 'lo sleep score è almeno ' + fmt(v), loP: v => 'è al massimo ' + fmt(v) },
      { id: 'shrv', label: 'HRV della notte', axis: 'HRV della notte (ms)', get: n => n.hrv, show: v => fmt(v) + ' ms', only: MOODO, when: 'Con HRV più alta', hiP: v => 'l\'HRV è almeno ' + fmt(v) + ' ms', loP: v => 'è al massimo ' + fmt(v) + ' ms' },
      { id: 'weekend', label: 'notti del weekend', get: n => { const w = dow(n.date); return w === 6 || w === 0 ? 1 : 0; }, binary: true, hiName: 'weekend', loName: 'in settimana', when: 'Nel weekend' }
    ];
    const OUTCOMES = [
      { id: 'score', label: 'sleep score', the: 'lo sleep score', get: n => n.score, dec: 0, unit: '', better: 1 },
      { id: 'hrv', label: 'HRV notturna', the: "l'HRV notturna", get: n => n.hrv, dec: 0, unit: ' ms', better: 1 },
      { id: 'rhr', label: 'battito a riposo', the: 'il battito a riposo', get: n => n.rhr, dec: 0, unit: ' bpm', better: -1 },
      { id: 'bb', label: 'Body Battery al risveglio', the: 'il Body Battery al risveglio', get: n => n.bb_wake, dec: 0, unit: '', better: 1 },
      { id: 'deep', label: 'sonno profondo', the: 'il sonno profondo', get: n => n.deep, dec: 0, unit: ' min', better: 1 },
      { id: 'energy', label: 'energia', the: "l'energia", get: n => MB[n.date] ? MB[n.date].energy : null, dec: 1, unit: '/5', better: 1 },
      { id: 'moodv', label: 'umore', the: "l'umore", get: n => MB[n.date] ? MB[n.date].mood : null, dec: 1, unit: '/5', better: 1 },
      { id: 'pain', label: 'dolore', the: 'il dolore', get: n => MB[n.date] ? MB[n.date].pain : null, dec: 1, unit: '/10', better: -1 }
    ];
    const MIN_N = 12, IT = 1200, tests = [];
    const counts = {};
    FACTORS.forEach(f => OUTCOMES.forEach(o => {
      if (f.only && f.only.indexOf(o.id) < 0) return;
      const pairs = nights.map(n => [f.get(n), o.get(n), n.date]).filter(p => isNum(p[0]) && isNum(p[1]));
      const key = (f.room ? 'room' : f.id === 'load' ? 'load' : '') + (MOODO.indexOf(o.id) >= 0 ? '+mood' : '');
      counts[key] = Math.max(counts[key] || 0, pairs.length);
      if (pairs.length < MIN_N) return;
      const xs = pairs.map(p => p[0]), ys = pairs.map(p => p[1]);
      let t;
      if (f.binary) {
        const a = ys.filter((_, i) => xs[i] === 1), b = ys.filter((_, i) => xs[i] === 0);
        if (a.length < 4 || b.length < 4) return;
        const d = diffTest(a, b, IT);
        t = { f: f, o: o, n: pairs.length, p: d.p, strength: Math.abs(d.diff) / (sd(ys) || 1), dir: Math.sign(d.diff), pairs: pairs,
          groups: [{ k: f.loName, v: avg(b), n: b.length }, { k: f.hiName, v: avg(a), n: a.length, hi: true }] };
      } else {
        if (new Set(xs).size < 4) return;
        const s = spearmanTest(xs, ys, IT);
        const ord = pairs.slice().sort((p, q) => p[0] - q[0]), k = Math.floor(ord.length / 3);
        const lo = ord.slice(0, k), mid = ord.slice(k, ord.length - k), hi = ord.slice(ord.length - k);
        t = { f: f, o: o, n: pairs.length, p: s.p, rho: s.rho, strength: Math.abs(s.rho), dir: Math.sign(s.rho), pairs: pairs, cuts: [lo[lo.length - 1][0], hi[0][0]],
          groups: [{ k: '≤ ' + f.show(lo[lo.length - 1][0]), v: avg(lo.map(p => p[1])), n: lo.length }, { k: 'in mezzo', v: avg(mid.map(p => p[1])), n: mid.length },
                   { k: '≥ ' + f.show(hi[0][0]), v: avg(hi.map(p => p[1])), n: hi.length, hi: true }] };
      }
      t.effect = t.groups[t.groups.length - 1].v - t.groups[0].v;
      tests.push(t);
    }));
    const per = {};
    const findings = fdr(tests, 0.1).filter(t => t.strength >= 0.25).sort((a, b) => (b.strength - a.strength) || (a.p - b.p))
      .filter(t => (per[t.f.id] = (per[t.f.id] || 0) + 1) <= 2).slice(0, 10);
    const learning = [];
    if ((counts.room || 0) < MIN_N) learning.push({ l: 'Aria della camera (CO2, temperatura, umidità) e sonno', n: counts.room || 0 });
    if ((counts['+mood'] || 0) < MIN_N) learning.push({ l: 'Sonno e come ti senti (check-in)', n: counts['+mood'] || 0 });
    if (ACTS.length && (counts.load || 0) < MIN_N) learning.push({ l: 'Allenamenti e recupero', n: counts.load || 0 });
    const trends = [];
    OUTCOMES.slice(0, 5).concat([{ id: 'sleep_h', label: 'ore di sonno', get: n => n.sleep_h, dec: 1, unit: ' h', better: 1 }]).forEach(o => {
      const g = nights.filter(n => isNum(o.get(n))); if (g.length < 30) return;
      const rec = g.slice(-14).map(o.get), pri = g.slice(-42, -14).map(o.get); if (pri.length < 14) return;
      const d = diffTest(rec, pri, IT);
      if (d.p < 0.05 && Math.abs(d.diff) >= 0.4 * (sd(rec.concat(pri)) || 1)) trends.push({ o: o, now: avg(rec), was: avg(pri), diff: d.diff });
    });
    let weight = null;
    if (body.length) {
      const lim = addDays(body[body.length - 1].date, -183), w = body.filter(b => b.date >= lim);
      if (w.length >= 6) { const sl = []; for (let i = 0; i < w.length; i++) for (let j = i + 1; j < w.length; j++) { const dd = dayNum(w[j].date) - dayNum(w[i].date); if (dd > 0) sl.push((w[j].w - w[i].w) / dd); } weight = { perMonth: median(sl) * 30.4, n: w.length }; }
    }
    ANALYSIS = { findings: findings, trends: trends, weight: weight, learning: learning, MIN_N: MIN_N, tested: tests.length };
    return ANALYSIS;
  };
  const findingTitle = t => `${t.f.when}: ${t.o.label} più ${t.dir > 0 ? 'alto' : 'basso'}` + (t.f.binary ? ` di ${fmt(Math.abs(t.effect), t.o.dec)}${t.o.unit}` : '');
  const findingBody = t => {
    const lo = t.groups[0], hi = t.groups[t.groups.length - 1];
    return t.f.binary ? `In media ${fmt(hi.v, t.o.dec)}${t.o.unit} nel ${t.f.hiName} (${hi.n} notti) contro ${fmt(lo.v, t.o.dec)}${t.o.unit} ${t.f.loName} (${lo.n}).`
      : `Quando ${t.f.hiP(t.cuts[1])}, ${t.o.the} è in media ${fmt(hi.v, t.o.dec)}${t.o.unit}; quando ${t.f.loP(t.cuts[0])}, ${fmt(lo.v, t.o.dec)}${t.o.unit}.`;
  };

  const nightNotes = n => {
    const out = []; if (!n) return out;
    const A = n.air;
    if (A && A.over1000_min >= 60) out.push({ s: 'bad', i: 'co2', k: 'var(--bad)', t: `CO2 <strong>sopra 1000 ppm per ${hm(A.over1000_min / 60)}</strong>, picco di <span class="num">${fmt(A.co2_max)}</span> ppm alle ${esc(A.co2_max_at)}.`, tip: 'Lascia la porta o la finestra socchiusa e confronta la notte dopo.' });
    if (A && A.temp_avg > 20.5) out.push({ s: 'warn', i: 'temp', k: 'var(--warn)', t: `Camera a <span class="num">${fmt(A.temp_avg, 1)}</span> °C, sopra l'ideale per dormire (17-20 °C).`, tip: A.temp_avg > 21.5 ? 'Uno o due gradi in meno di notte aiutano il sonno profondo.' : '' });
    if (isNum(n.score)) {
      const base = nights.filter(x => x.date < n.date).slice(-60);
      [{ k: 'resp', l: 'respirazione nel sonno', u: ' resp/min', b: 0 }, { k: 'hr', l: 'battito nel sonno', u: ' bpm', b: -1 }, { k: 'rhr', l: 'battito a riposo', u: ' bpm', b: -1 },
       { k: 'hrv', l: 'HRV', u: ' ms', b: 1 }, { k: 'awake', l: 'minuti svegli', u: ' min', b: -1 }].forEach(m => {
        const v = n[m.k], vals = base.map(x => x[m.k]).filter(isNum);
        if (!isNum(v) || vals.length < 20) return;
        const med = median(vals), mad = median(vals.map(x => Math.abs(x - med))) * 1.4826; if (!mad) return;
        const z = (v - med) / mad; if (Math.abs(z) < 2.5) return;
        const worse = m.b === 0 || (m.b > 0 ? z < 0 : z > 0);
        out.push({ s: worse ? 'warn' : 'good', i: 'alert', k: worse ? 'var(--warn)' : 'var(--good)', t: `Insolito: ${m.l} <span class="num">${fmt(v)}</span>${m.u}, ${z > 0 ? 'molto sopra' : 'molto sotto'} i tuoi soliti ${fmt(med)}.`,
          tip: worse && /resp|hr|rhr/.test(m.k) ? 'Succede con alcol, pasti tardi, allenamenti intensi o un inizio di malanno.' : '' });
      });
    }
    return out;
  };
  const noteHTML = n => `<div class="note ${n.s}"><span class="nicon">${icon(n.i)}</span><div><p>${n.t}</p>${n.tip ? '<p class="tip">' + n.tip + '</p>' : ''}</div></div>`;

  // Riepilogo della settimana (stessa logica dell'email del lunedì).
  const weekly = () => {
    const t = dayNum(today), dw = (new Date(t * 86400000).getUTCDay() + 6) % 7;
    const end = t - dw - 1, start = end - 6, pS = start - 28, pE = start - 1;
    const inW = (d, a, b) => { const x = dayNum(d); return x >= a && x <= b; };
    const cur = nights.filter(n => inW(n.date, start, end)), prev = nights.filter(n => inW(n.date, pS, pE));
    const M = [['Sleep score', n => n.score, 1, 0, ''], ['Ore di sonno', n => n.sleep_h, 1, 1, ' h'], ['HRV notturna', n => n.hrv, 1, 0, ' ms'], ['Battito a riposo', n => n.rhr, -1, 0, ' bpm'],
      ['Body Battery', n => n.bb_wake, 1, 0, ''], ['Passi', n => n.steps, 1, 0, ''], ['CO2 notturna', n => n.air ? n.air.co2_avg : null, -1, 0, ' ppm']]
      .map(m => { const a = avg(cur.map(m[1])), b = avg(prev.map(m[1])), s = sd(prev.map(m[1])); return { l: m[0], now: a, was: b, better: m[2], dec: m[3], u: m[4], z: isNum(a) && isNum(b) && s ? (a - b) / s : null }; });
    const sc = cur.filter(n => isNum(n.score));
    const acts = ACTS.filter(a => inW(a.date, start, end));
    const md = MOOD.filter(m => inW(m.date, start, end));
    return { label: dLabel(fromDayNum(start)) + ' - ' + dLabel(fromDayNum(end)), n: cur.length, M: M,
      best: sc.length ? sc.reduce((a, b) => (b.score > a.score ? b : a)) : null, worst: sc.length ? sc.reduce((a, b) => (b.score < a.score ? b : a)) : null,
      co2High: cur.filter(n => n.air && n.air.over1000_min >= 60).length, air: cur.filter(n => n.air).length,
      acts: acts.length, actMin: sum(acts.map(a => a.min)), moodN: md.length, energy: avg(md.map(m => m.energy)), pain: avg(md.map(m => m.pain)) };
  };

  // =========================================================================
  // Componenti grafici
  // =========================================================================
  const W = 360;
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }
  function lineChart(host, o) {
    const H = o.h || 190, PL = o.pl || 34, PR = 10, PT = 14, PB = 22;
    const wrap = h('div', 'chart'); host.appendChild(wrap);
    const all = o.series.reduce((a, s) => a.concat(s.data), []).filter(p => isNum(p[1]));
    if (!all.length) { wrap.innerHTML = '<p class="empty">Nessun dato in questo periodo.</p>'; return wrap; }
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.aria || 'grafico' }, wrap);
    const tip = h('div', 'ctip'); wrap.appendChild(tip);
    const xs = all.map(p => p[0]), ys = all.map(p => p[1]);
    let x0 = isNum(o.xMin) ? o.xMin : Math.min.apply(null, xs), x1 = isNum(o.xMax) ? o.xMax : Math.max.apply(null, xs);
    if (x1 === x0) { x0 -= 1; x1 += 1; }
    let y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (isNum(o.yMin)) y0 = Math.min(y0, o.yMin);
    if (isNum(o.yMax)) y1 = Math.max(y1, o.yMax);
    const pad = (y1 - y0) * .12 || 1; y0 -= pad; y1 += pad;
    const X = v => PL + (v - x0) / (x1 - x0) * (W - PL - PR), Y = v => H - PB - (v - y0) / (y1 - y0) * (H - PT - PB);
    const defs = svgEl('defs', {}, svg);
    (o.bands || []).forEach(b => { const a = Math.max(y0, b[0]), c = Math.min(y1, b[1]); if (c > a) svgEl('rect', { x: PL, y: Y(c), width: W - PL - PR, height: Y(a) - Y(c), fill: b[2] }, svg); });
    const step = niceStep((y1 - y0) / 4);
    for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) {
      svgEl('line', { x1: PL, x2: W - PR, y1: Y(v), y2: Y(v), stroke: 'var(--line)', 'stroke-width': .6, 'stroke-dasharray': '2 4' }, svg);
      const tx = svgEl('text', { x: PL - 5, y: Y(v) + 3, 'text-anchor': 'end' }, svg); tx.textContent = o.yFmt ? o.yFmt(v) : fmt(v, step < 1 ? 1 : 0);
    }
    (o.hlines || []).forEach(l => { if (l[0] >= y0 && l[0] <= y1) svgEl('line', { x1: PL, x2: W - PR, y1: Y(l[0]), y2: Y(l[0]), stroke: l[1], 'stroke-width': .9, 'stroke-dasharray': '4 4' }, svg); });
    (o.xTicks ? o.xTicks(x0, x1) : []).forEach(t => { const tx = svgEl('text', { x: X(t[0]), y: H - 6, 'text-anchor': 'middle' }, svg); tx.textContent = t[1]; });
    (o.boxes || []).forEach(b => { const a = Math.max(x0, b[0]), c = Math.min(x1, b[1]); if (c > a) { svgEl('rect', { x: X(a), y: PT, width: X(c) - X(a), height: H - PT - PB, fill: 'color-mix(in srgb, var(--sec) 7%, transparent)', stroke: 'color-mix(in srgb, var(--sec) 50%, transparent)', 'stroke-dasharray': '3 3', 'stroke-width': .8, rx: 6 }, svg);
      if (b[2]) { const tx = svgEl('text', { x: X(a) + 5, y: PT + 11 }, svg); tx.textContent = b[2]; } } });
    const draws = [];
    o.series.forEach(s => {
      const d = s.data.filter(p => isNum(p[1])); if (!d.length) return;
      const path = d.map((p, i) => (i && !(s.gap && p[0] - d[i - 1][0] > s.gap) ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
      if (s.area) {
        const gid = 'g' + Math.random().toString(36).slice(2, 8);
        const gr = svgEl('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
        svgEl('stop', { offset: 0, 'stop-color': s.color, 'stop-opacity': .42 }, gr); svgEl('stop', { offset: 1, 'stop-color': s.color, 'stop-opacity': 0 }, gr);
        svgEl('path', { class: 'fade', d: path + ` L${X(d[d.length - 1][0]).toFixed(1)},${H - PB} L${X(d[0][0]).toFixed(1)},${H - PB} Z`, fill: `url(#${gid})` }, svg);
      }
      if (s.dots) d.forEach(p => svgEl('circle', { class: 'fade', cx: X(p[0]), cy: Y(p[1]), r: s.dots, fill: s.dotColor ? s.dotColor(p) : s.color, 'fill-opacity': s.dotOpacity || 1 }, svg));
      if (s.line !== false) {
        if (s.glow) svgEl('path', { class: 'fade', d: path, fill: 'none', stroke: s.color, 'stroke-width': 6, opacity: .18, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
        draws.push(svgEl('path', { class: 'draw', d: path, fill: 'none', stroke: s.color, 'stroke-width': s.w || 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': s.dash || '', opacity: s.opacity || 1 }, svg));
      }
    });
    if (o.mark) { const m = o.mark; svgEl('circle', { cx: X(m[0]), cy: Y(m[1]), r: 8, fill: m[2] || 'var(--sec)', 'fill-opacity': .22 }, svg); svgEl('circle', { cx: X(m[0]), cy: Y(m[1]), r: 3.8, fill: m[2] || 'var(--sec)', stroke: 'var(--surface)', 'stroke-width': 1.6 }, svg); }
    const cur = svgEl('g', { class: 'cursor' }, svg);
    const cl = svgEl('line', { y1: PT, y2: H - PB, stroke: 'var(--muted)', 'stroke-width': .8, 'stroke-dasharray': '2 3' }, cur);
    const dots = o.series.map(s => svgEl('circle', { r: 4.5, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }, cur));
    if (!reduced) draws.forEach(p => { if (p.getAttribute('stroke-dasharray')) return; const len = p.getTotalLength ? p.getTotalLength() : 0; if (len) { p.style.strokeDasharray = len; p.style.strokeDashoffset = len; } });
    raf2(() => { wrap.classList.add('on'); draws.forEach(p => { p.style.strokeDashoffset = 0; }); });
    const main = o.series[o.pickSeries || 0].data.filter(p => isNum(p[1]));
    let startX = null, moved = false, active = null;
    const pickAt = clientX => { const r = svg.getBoundingClientRect(), vx = (clientX - r.left) / r.width * W; let best = null, bd = Infinity; main.forEach(p => { const dd = Math.abs(X(p[0]) - vx); if (dd < bd) { bd = dd; best = p; } }); return best; };
    const show = p => {
      if (!p) return;
      if (active !== p) buzz();
      active = p;
      cl.setAttribute('x1', X(p[0])); cl.setAttribute('x2', X(p[0]));
      o.series.forEach((s, i) => { const q = s.data.find(z => z[0] === p[0]) || (i === (o.pickSeries || 0) ? p : null);
        if (q && isNum(q[1])) { dots[i].setAttribute('cx', X(q[0])); dots[i].setAttribute('cy', Y(q[1])); dots[i].style.display = ''; } else dots[i].style.display = 'none'; });
      tip.innerHTML = o.tip(p);
      const r = svg.getBoundingClientRect(), px = X(p[0]) / W * r.width;
      tip.style.left = clamp(px, 64, r.width - 64) + 'px';
      wrap.classList.add('scrub');
    };
    wrap.addEventListener('pointerdown', e => { startX = e.clientX; moved = false; show(pickAt(e.clientX)); });
    wrap.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || startX !== null) { if (startX !== null && Math.abs(e.clientX - startX) > 6) moved = true; show(pickAt(e.clientX)); } });
    wrap.addEventListener('pointerup', e => { if (startX !== null && !moved && o.onPick && active) o.onPick(active); startX = null; if (e.pointerType !== 'mouse') setTimeout(() => wrap.classList.remove('scrub'), 1500); });
    wrap.addEventListener('pointercancel', () => { startX = null; wrap.classList.remove('scrub'); });
    wrap.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') wrap.classList.remove('scrub'); });
    return wrap;
  }
  const dateTicks = (a, b) => {
    const span = b - a, out = [];
    if (span <= 16) { const st = span <= 8 ? 1 : 3; for (let d = Math.ceil(a); d <= b; d += st) out.push([d, dLabel(fromDayNum(d))]); }
    else if (span <= 140) { for (let d = Math.ceil(a); d <= b; d++) { const s = fromDayNum(d); if (dow(s) === 1 && (span <= 45 || +s.slice(8, 10) <= 7)) out.push([d, span <= 45 ? dLabel(s) : MESI[+s.slice(5, 7) - 1]]); } }
    else { const ya = +fromDayNum(a).slice(0, 4), yb = +fromDayNum(b).slice(0, 4); const ys = Math.max(1, Math.ceil((yb - ya) / 6));
      if (yb - ya >= 2) { for (let y = ya + 1; y <= yb; y += ys) out.push([dayNum(y + '-01-01'), String(y)]); }
      else { for (let d = Math.ceil(a); d <= b; d++) { const s = fromDayNum(d); if (s.slice(8, 10) === '01' && (+s.slice(5, 7)) % 2 === 1) out.push([d, MESI[+s.slice(5, 7) - 1] + (s.slice(5, 7) === '01' ? ' ' + s.slice(2, 4) : '')]); } } }
    return out;
  };
  const nightTicks = () => [0, 120, 240, 360, 480, 600, 720].map(m => [m, String((22 + m / 60) % 24).padStart(2, '0')]);

  let uid = 0;
  const ringHTML = (v, label, cls, color) => {
    const st = state(v), C = 2 * Math.PI * 50, id = 'rg' + (++uid);
    const stroke = color || (st === 'bad' ? 'var(--bad)' : st === 'warn' ? 'var(--warn)' : `url(#${id})`);
    const to = (C * (1 - (isNum(v) ? clamp(v, 0, 100) : 0) / 100)).toFixed(2);
    return `<div class="ring ${cls || ''}" role="img" aria-label="${label} ${isNum(v) ? v : 'non disponibile'}">
      <svg viewBox="0 0 120 120"><defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent-2)"/><stop offset="1" stop-color="var(--sec)"/></linearGradient></defs>
      <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface-3)" stroke-width="11"/>
      <circle class="glow" cx="60" cy="60" r="50" fill="none" stroke="${stroke}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}" data-to="${to}" transform="rotate(-90 60 60)"/>
      <circle class="arc" cx="60" cy="60" r="50" fill="none" stroke="${stroke}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}" data-to="${to}" transform="rotate(-90 60 60)"/></svg>
      <div class="center"><span class="n" data-count="${isNum(v) ? v : ''}">${isNum(v) ? '0' : '-'}</span><span class="l">${label}</span></div></div>`;
  };
  const gaugeHTML = (v, label, color) => {
    const C = 2 * Math.PI * 22, to = (C * (1 - (isNum(v) ? clamp(v, 0, 100) : 0) / 100)).toFixed(2);
    return `<div class="gauge"><div class="g"><svg viewBox="0 0 54 54"><circle cx="27" cy="27" r="22" fill="none" stroke="var(--surface-3)" stroke-width="6"/>
      <circle class="arc" cx="27" cy="27" r="22" fill="none" stroke="${color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}" data-to="${to}" transform="rotate(-90 27 27)" style="transition:stroke-dashoffset 1.4s var(--ease)"/></svg>
      <span class="gv" data-count="${isNum(v) ? Math.round(v) : ''}">${isNum(v) ? '0' : '-'}</span></div><span class="gl">${label}</span></div>`;
  };
  // Semicerchio per la CO2 (400-1600 ppm).
  const semiHTML = v => {
    const a0 = Math.PI, frac = isNum(v) ? clamp((v - 400) / 1200, 0, 1) : 0;
    const pt = (f, r) => [100 + r * Math.cos(a0 - f * Math.PI), 100 - r * Math.sin(a0 - f * Math.PI)];
    const arc = (f0, f1, col) => { const p0 = pt(f0, 80), p1 = pt(f1, 80); return `<path d="M${p0[0].toFixed(1)},${p0[1].toFixed(1)} A80,80 0 0 1 ${p1[0].toFixed(1)},${p1[1].toFixed(1)}" stroke="${col}" stroke-width="14" fill="none" stroke-linecap="round" opacity=".9"/>`; };
    const n = pt(frac, 66);
    return `<svg class="semi" viewBox="0 0 200 118" role="img" aria-label="CO2 ${fmt(v)} ppm">${arc(0, (800 - 400) / 1200 - .01, 'var(--good)')}${arc((800 - 400) / 1200 + .01, (1000 - 400) / 1200 - .01, 'var(--warn)')}${arc((1000 - 400) / 1200 + .01, 1, 'var(--bad)')}
      <line x1="100" y1="100" x2="${n[0].toFixed(1)}" y2="${n[1].toFixed(1)}" stroke="var(--fg)" stroke-width="3.5" stroke-linecap="round"/><circle cx="100" cy="100" r="7" fill="var(--fg)"/>
      <text x="20" y="116" text-anchor="middle">400</text><text x="180" y="116" text-anchor="middle">1600</text></svg>`;
  };
  const animate = root => {
    raf2(() => {
      root.querySelectorAll('[data-to]').forEach(a => a.setAttribute('stroke-dashoffset', a.dataset.to));
      root.querySelectorAll('[data-count]').forEach(n => { if (n.dataset.count !== '') countUp(n, +n.dataset.count, +(n.dataset.dec || 0)); });
      root.querySelectorAll('[data-w]').forEach(n => { n.style.width = n.dataset.w; });
      root.querySelectorAll('[data-hgt]').forEach(n => { n.style.height = n.dataset.hgt; });
      root.querySelectorAll('[data-flex]').forEach(n => { n.style.flexGrow = n.dataset.flex; });
    });
  };
  const chips = (items, cur, onSel, seg) => {
    const box = h('div', seg ? 'seg' : 'chips');
    items.forEach(it => { const b = h('button', seg ? '' : 'chip', it[1]); b.setAttribute('aria-pressed', String(it[0] === cur)); b.onclick = () => { buzz(); onSel(it[0]); }; box.appendChild(b); });
    return box;
  };
  const stat = (k, v, unit, sub, st) => `<div class="stat"><span class="k">${k}</span><span class="v">${v}${unit ? '<small>' + unit + '</small>' : ''}</span><span class="s"><i class="dot ${st || ''}"></i>${sub}</span></div>`;
  const scoreColor = s => !isNum(s) ? 'var(--surface-3)' : s >= 85 ? 'var(--good)' : s >= 75 ? 'color-mix(in srgb, var(--good) 60%, var(--warn))' : s >= 60 ? 'var(--warn)' : s >= 45 ? 'color-mix(in srgb, var(--warn) 50%, var(--bad))' : 'var(--bad)';

  // Timeline del sonno: una barra per notte dalle 21 alle 11, divisa nelle fasi.
  const timeline = (list, sel, onPick) => {
    const box = h('div', 'tl');
    const T0 = -180, T1 = 660;   // 21:00 - 11:00 in minuti da mezzanotte
    const x = m => ((m - T0) / (T1 - T0) * 100).toFixed(2) + '%';
    list.forEach((n, j) => {
      const b = bedMin(n.bed_start), e = bedMin(n.bed_end);
      const row = h('div', 'tlrow' + (n.date === sel ? ' sel' : ''));
      row.style.setProperty('--j', j);
      let bar = '';
      if (b !== null && e !== null && e > b) {
        const st = [['deep', '--st-deep'], ['light', '--st-light'], ['rem', '--st-rem'], ['awake', '--st-awake']].filter(k => n[k[0]] > 0);
        bar = `<div class="tlbar" style="left:${x(clamp(b, T0, T1))};width:calc(${x(clamp(e, T0, T1))} - ${x(clamp(b, T0, T1))});--j:${j}">${st.map(k => `<i style="flex:${n[k[0]]};background:var(${k[1]})"></i>`).join('')}</div>`;
      }
      row.innerHTML = `<span class="d"><b>${GG[dow(n.date)]}</b>${+n.date.slice(8, 10)}</span><div class="tltrack">${bar}</div><span class="sc" style="color:${scoreColor(n.score)}">${isNum(n.score) ? n.score : '-'}</span>`;
      row.onclick = () => { buzz(); onPick(n.date); };
      box.appendChild(row);
    });
    const ax = h('div', 'tlaxis', '<span></span><div><span>21</span><span>00</span><span>03</span><span>06</span><span>09</span><span>11</span></div><span></span>');
    const wrap = h('div', ''); wrap.style.display = 'grid'; wrap.style.gap = '8px'; wrap.appendChild(box); wrap.appendChild(ax);
    return wrap;
  };

  // =========================================================================
  // Fogli dal basso e notifiche
  // =========================================================================
  const layer = $('#layer');
  let closeSheet = null;
  const sheet = (build) => {
    if (closeSheet) closeSheet();
    const scrim = h('div', 'scrim'), sh = h('div', 'sheet'), inner = h('div', 'sheet-in');
    sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    sh.appendChild(h('div', 'grab')); sh.appendChild(inner);
    layer.appendChild(scrim); layer.appendChild(sh); document.body.classList.add('locked');
    const close = () => { scrim.classList.remove('on'); sh.classList.remove('on'); document.body.classList.remove('locked'); closeSheet = null; setTimeout(() => { scrim.remove(); sh.remove(); }, 450); };
    closeSheet = close;
    scrim.onclick = close;
    let y0 = null; sh.addEventListener('touchstart', e => { if (sh.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
    sh.addEventListener('touchmove', e => { if (y0 === null) return; const dy = e.touches[0].clientY - y0; if (dy > 0) sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
    sh.addEventListener('touchend', e => { if (y0 === null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null; sh.style.transform = ''; if (dy > 110) close(); }, { passive: true });
    build(inner, close);
    raf2(() => { scrim.classList.add('on'); sh.classList.add('on'); animate(inner); });
    return close;
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && closeSheet) closeSheet(); });
  const toast = msg => { const t = h('div', 'toast', msg); layer.appendChild(t); raf2(() => t.classList.add('on')); setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 400); }, 2600); };

  // =========================================================================
  // Check-in
  // =========================================================================
  const ENERGY = ['Scarico', 'Basso', 'Normale', 'Buono', 'Carico'], MOODL = ['Giù', 'Così così', 'Normale', 'Bene', 'Ottimo'];
  const todayMood = () => MOOD.find(m => m.date === today) || null;
  const openCheckin = pre => sheet((box, close) => {
    const cur = Object.assign({ energy: null, mood: null, pain: 0, note: '' }, todayMood() || {}, pre || {});
    box.style.setProperty('--sec', 'var(--c-insight)');
    box.innerHTML = `<div><span class="eyebrow"><i></i>Check-in · ${GIORNI[dow(today)]} ${dLabel(today)}</span><h2 style="margin-top:6px">Come ti senti oggi?</h2>
      <p class="muted small" style="margin-top:4px">Pochi secondi. Ritmo collega le risposte a sonno, recupero e allenamenti.</p></div>`;
    const scale = (key, labels, title) => {
      const wrap = h('div', '', `<span class="eyebrow" style="margin-bottom:8px">${title}</span>`); wrap.style.display = 'grid'; wrap.style.gap = '8px';
      const s = h('div', 'scale');
      labels.forEach((l, i) => { const b = h('button', '', `<b>${i + 1}</b>${l}`); b.setAttribute('aria-pressed', String(cur[key] === i + 1));
        b.onclick = () => { buzz(); cur[key] = i + 1; s.querySelectorAll('button').forEach((x, j) => x.setAttribute('aria-pressed', String(j === i))); }; s.appendChild(b); });
      wrap.appendChild(s); return wrap;
    };
    box.appendChild(scale('energy', ENERGY, 'Energia'));
    box.appendChild(scale('mood', MOODL, 'Umore'));
    const pain = h('div', 'range', `<div class="chead"><span class="eyebrow">Dolore</span><span class="mid" style="font-size:1.4rem"><span id="pv">${cur.pain}</span><small>/10</small></span></div>
      <input type="range" id="painr" min="0" max="10" step="1" value="${isNum(cur.pain) ? cur.pain : 0}" aria-label="Dolore da 0 a 10"><div class="ends"><span>nessuno</span><span>forte</span></div>`);
    box.appendChild(pain);
    const pr = $('#painr', pain); pr.oninput = () => { cur.pain = +pr.value; $('#pv', pain).textContent = pr.value; };
    const note = h('div', '', '<span class="eyebrow" style="margin-bottom:8px">Nota (facoltativa)</span>'); note.style.display = 'grid'; note.style.gap = '8px';
    const ta = h('textarea'); ta.id = 'cinote'; ta.placeholder = 'Es. fisioterapia, dormito male, giornata pesante'; ta.maxLength = 280; ta.value = cur.note || ''; note.appendChild(ta); box.appendChild(note);
    const save = h('button', 'btn', icon('check') + 'Salva');
    save.querySelector('svg').style.cssText = 'width:18px;height:18px;stroke:#fff;fill:none;stroke-width:2.6';
    save.onclick = () => {
      if (!cur.energy || !cur.mood) { toast('Scegli energia e umore'); return; }
      const payload = { date: today, energy: cur.energy, mood: cur.mood, pain: cur.pain, note: ta.value.trim() };
      const run = window.google && google.script && google.script.run;
      if (!run) { toast('Anteprima: il salvataggio funziona solo nell\'app Ritmo'); return; }
      save.disabled = true; save.textContent = 'Salvo...';
      run.withSuccessHandler(r => {
        MOOD = MOOD.filter(m => m.date !== r.date).concat([r]); ANALYSIS = null;
        close(); toast('Check-in salvato'); buzz(); updateFab(); rerender();
      }).withFailureHandler(err => { save.disabled = false; save.textContent = 'Salva'; toast('Non salvato: ' + (err && err.message ? err.message : 'errore')); }).ritmoSaveCheckin(payload);
    };
    box.appendChild(save);
  });
  const fab = $('#fab');
  const updateFab = () => { const done = !!todayMood(); fab.classList.toggle('done', done); fab.innerHTML = done ? '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>'; fab.setAttribute('aria-label', done ? 'Check-in fatto, modifica' : 'Check-in: come ti senti'); };
  fab.onclick = () => { buzz(); openCheckin(); };
  updateFab();

  // =========================================================================
  // Navigazione
  // =========================================================================
  const TABS = [['oggi', 'Oggi', '--c-oggi'], ['sonno', 'Sonno', '--c-sonno'], ['sport', 'Sport', '--c-sport'], ['corpo', 'Corpo', '--c-corpo'], ['casa', 'Casa', '--c-casa']];
  const S = { tab: 'oggi', night: L ? L.date : null, sMetric: 'score', sPeriod: 30, cMetric: 'w', cPeriod: 365, hMetric: 'co2', hPeriod: 1, nMode: 'co2', aFilter: 'all', spWeeks: 12 };
  try { const saved = JSON.parse(localStorage.getItem('ritmo') || '{}'); ['sMetric', 'sPeriod', 'cMetric', 'cPeriod', 'hMetric', 'hPeriod', 'aFilter'].forEach(k => { if (saved[k] !== undefined) S[k] = saved[k]; }); } catch (e) {}
  const save = () => { try { localStorage.setItem('ritmo', JSON.stringify(S)); } catch (e) {} };
  const tabsEl = $('#tabs'), pill = $('#pill'), main = $('#main');
  TABS.forEach(([id, label, col]) => { const b = h('button', 'tab', icon(id) + '<span>' + label + '</span>'); b.dataset.id = id; b.style.setProperty('--tc', `var(${col})`); b.onclick = () => { buzz(); go(id); }; tabsEl.appendChild(b); });
  $('#insightBtn').onclick = () => { buzz(); go('insight'); };
  const hr = +((DATA.now || '').slice(11, 13) || 12);
  $('#hello').textContent = (hr < 5 ? 'Buonanotte' : hr < 13 ? 'Buongiorno' : hr < 18 ? 'Buon pomeriggio' : 'Buonasera') + ' · ' + GIORNI[dow(today)] + ' ' + dLabel(today);
  let lastIdx = 0;
  const go = (id, opts) => {
    if (opts && opts.night) S.night = opts.night;
    const prevTab = S.tab; S.tab = id; save();
    try { if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id); } catch (e) {}
    const i = TABS.findIndex(t => t[0] === id);
    const col = i >= 0 ? TABS[i][2] : '--c-insight';
    document.documentElement.style.setProperty('--sec', `var(${col})`);
    pill.style.opacity = i >= 0 ? '1' : '0';
    if (i >= 0) { pill.style.transform = `translateX(${i * 100}%)`; pill.style.setProperty('--tc', `var(${col})`); }
    tabsEl.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-current', b.dataset.id === id ? 'page' : 'false'));
    const dir = i < 0 ? '' : prevTab === id ? '' : i > lastIdx ? 'from-right' : 'from-left';
    if (i >= 0) lastIdx = i;
    render(dir);
    window.scrollTo(0, 0);
  };
  const render = dir => {
    main.innerHTML = '';
    const v = h('div', 'view' + (dir ? ' ' + dir : '')); main.appendChild(v);
    ({ oggi: viewOggi, sonno: viewSonno, sport: viewSport, corpo: viewCorpo, casa: viewCasa, insight: viewInsight })[S.tab](v);
    v.appendChild(h('p', 'foot', `Ritmo · versione ${esc(REF === 'main' || REF === 'locale' ? REF : REF.slice(0, 7))} · ${RELEASE}`));
    [...v.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 10)));
    animate(v);
  };
  const rerender = () => { const y = window.scrollY; main.innerHTML = ''; const v = h('div', 'view'); main.appendChild(v);
    ({ oggi: viewOggi, sonno: viewSonno, sport: viewSport, corpo: viewCorpo, casa: viewCasa, insight: viewInsight })[S.tab](v);
    v.appendChild(h('p', 'foot', `Ritmo · versione ${esc(REF === 'main' || REF === 'locale' ? REF : REF.slice(0, 7))} · ${RELEASE}`));
    [...v.children].forEach(c => { c.style.animation = 'none'; }); animate(v); window.scrollTo(0, y); };
  const setBadge = () => { const n = analysis().findings.length; const b = $('#insightBtn'); const old = $('.badge', b); if (old) old.remove(); if (n) b.insertAdjacentHTML('beforeend', `<span class="badge">${n}</span>`); };

  // =========================================================================
  // OGGI
  // =========================================================================
  function viewOggi(v) {
    if (!L) { v.appendChild(h('p', 'empty', 'Il foglio non ha ancora dati da mostrare.')); return; }
    const lastG = isNum(L.score) ? L : gNights[gNights.length - 1];
    const R = readiness(lastG);
    const title = !R ? 'Dati del sonno in arrivo' : R.score >= 80 ? 'Pronto per la giornata' : R.score >= 65 ? 'Recupero discreto' : R.score >= 50 ? 'Vai con calma oggi' : 'Giornata di recupero';
    const advice = !R ? 'Garmin aggiorna i dati ogni mattina alle 10.' : R.score >= 80 ? 'Corpo recuperato: buona giornata per carichi e impegni.' : R.score >= 65 ? 'Recupero nella media: ascolta come ti senti.' : 'Il corpo chiede recupero: riposo, idratazione e un orario regolare stasera.';
    const COL = { Sonno: 'var(--c-sonno)', HRV: 'var(--c-insight)', Riposo: 'var(--c-corpo)', Energia: 'var(--c-sport)' };
    const hero = h('section', 'hero');
    hero.innerHTML = `<div class="chead"><span class="eyebrow"><i></i>Recupero di oggi</span><span class="pill ${R ? state(R.score) : ''}">${R ? (R.score >= 80 ? 'alto' : R.score >= 60 ? 'medio' : 'basso') : '-'}</span></div>
      <div class="hero-row" style="margin-top:12px">${ringHTML(R ? R.score : null, 'recupero')}<div style="display:grid;gap:8px;min-width:0"><h2>${title}</h2><p class="muted small">${advice}</p></div></div>
      ${R ? '<div class="gauges" style="margin-top:16px">' + R.parts.map(p => gaugeHTML(p.v, p.k, COL[p.k])).join('') + '</div>' : ''}`;
    v.appendChild(hero);

    // check-in
    const tm = todayMood();
    const ci = h('section', 'card tap');
    ci.style.setProperty('--sec', 'var(--c-insight)');
    if (!tm) {
      ci.innerHTML = `<div class="chead"><span class="eyebrow"><i></i>Check-in</span><span class="more">30 secondi ›</span></div><h3 style="font-size:1.15rem">Come ti senti oggi?</h3><p class="muted small">Scegli la tua energia: poi umore e dolore.</p>`;
      const sc = h('div', 'scale');
      ENERGY.forEach((l, i) => { const b = h('button', '', `<b>${i + 1}</b>${l}`); b.onclick = e => { e.stopPropagation(); buzz(); openCheckin({ energy: i + 1 }); }; sc.appendChild(b); });
      ci.appendChild(sc);
      ci.onclick = () => openCheckin();
    } else {
      ci.innerHTML = `<div class="chead"><span class="eyebrow"><i></i>Check-in di oggi</span><span class="more">Modifica ›</span></div>
        <div class="grid3">${stat('Energia', fmt(tm.energy), '/5', ENERGY[(tm.energy || 3) - 1], tm.energy >= 4 ? 'good' : tm.energy >= 3 ? 'warn' : 'bad')}${stat('Umore', fmt(tm.mood), '/5', MOODL[(tm.mood || 3) - 1], tm.mood >= 4 ? 'good' : tm.mood >= 3 ? 'warn' : 'bad')}${stat('Dolore', fmt(tm.pain), '/10', tm.pain <= 2 ? 'basso' : tm.pain <= 5 ? 'medio' : 'alto', tm.pain <= 2 ? 'good' : tm.pain <= 5 ? 'warn' : 'bad')}</div>
        ${tm.note ? `<p class="small muted">“${esc(tm.note)}”</p>` : ''}`;
      ci.onclick = () => openCheckin();
    }
    v.appendChild(ci);

    // storie: note, scoperte, tendenze
    const an = analysis(); setBadge();
    const stories = nightNotes(L).map(n => ({ k: n.k, i: n.i, tag: 'Stanotte', t: n.t, tip: n.tip }));
    an.trends.slice(0, 2).forEach(tt => { const good = (tt.diff * tt.o.better) > 0; stories.push({ k: good ? 'var(--good)' : 'var(--warn)', i: tt.diff > 0 ? 'up' : 'down', tag: 'Tendenza', t: `<strong>${cap(tt.o.label)} ${tt.diff > 0 ? 'in aumento' : 'in calo'}</strong>: ${fmt(tt.now, tt.o.dec)}${tt.o.unit} nelle ultime 2 settimane, ${fmt(tt.was, tt.o.dec)}${tt.o.unit} prima.` }); });
    an.findings.slice(0, 3).forEach(t => { const good = (t.dir * t.o.better) > 0; stories.push({ k: 'var(--c-insight)', i: 'spark', tag: good ? 'Ti aiuta' : 'Ti penalizza', t: `<strong>${esc(findingTitle(t))}</strong>`, tip: esc(findingBody(t)), go: 'insight' }); });
    if (stories.length) {
      const sec = h('section', ''); sec.style.display = 'grid'; sec.style.gap = '10px';
      sec.appendChild(h('div', 'chead', `<span class="eyebrow"><i></i>Per te oggi</span><button class="more" id="allIns">Tutti gli insight ›</button>`));
      const car = h('div', 'carousel');
      stories.forEach(s => { const c = h('div', 'story', `<span class="ic">${icon(s.i)}</span><span class="tag n">${s.tag}</span><p>${s.t}</p>${s.tip ? '<p class="tip">' + s.tip + '</p>' : ''}`); c.style.setProperty('--k', s.k); if (s.go) { c.style.cursor = 'pointer'; c.onclick = () => go(s.go); } car.appendChild(c); });
      sec.appendChild(car);
      const dn = h('div', 'dotsnav', stories.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')); sec.appendChild(dn);
      car.addEventListener('scroll', () => { const w = car.firstElementChild ? car.firstElementChild.getBoundingClientRect().width + 12 : 1; const i = Math.round(car.scrollLeft / w); dn.querySelectorAll('i').forEach((d, j) => d.classList.toggle('on', j === i)); }, { passive: true });
      $('#allIns', sec).onclick = () => go('insight');
      v.appendChild(sec);
    }

    // ultime notti
    const last7 = nights.filter(n => isNum(n.score)).slice(-7);
    if (last7.length) {
      const c = h('section', 'card tap'); c.style.setProperty('--sec', 'var(--c-sonno)');
      c.appendChild(h('div', 'chead', `<span class="eyebrow"><i></i>Le tue ultime notti</span><span class="more">Sonno ›</span>`));
      c.appendChild(timeline(last7, L.date, d => go('sonno', { night: d })));
      c.onclick = e => { if (!e.target.closest('.tlrow')) go('sonno'); };
      v.appendChild(c);
    }

    // scorciatoie
    const g = h('div', 'grid2');
    const rm = DATA.room;
    const ca = h('section', 'card tap'); ca.style.setProperty('--sec', 'var(--c-casa)');
    ca.innerHTML = `<div class="chead"><span class="eyebrow"><i></i>Casa</span><span class="more">›</span></div>${rm ? `${semiHTML(rm.co2)}<div style="text-align:center;margin-top:-8px"><div class="mid ${co2State(rm.co2)}"><span data-count="${rm.co2}">0</span><small>ppm</small></div><p class="muted xs">${fmt(rm.temp, 1)} °C · ${fmt(rm.rh)} %</p></div>` : '<p class="muted small">Nessun dato</p>'}`;
    ca.onclick = () => go('casa'); g.appendChild(ca);
    const sp = h('section', 'card tap'); sp.style.setProperty('--sec', 'var(--c-sport)');
    const MD = minByDay(), wk = [...Array(7)].map((_, i) => addDays(today, i - 6)), wkMin = wk.map(d => MD[d] || 0), mx = Math.max(30, Math.max.apply(null, wkMin));
    sp.innerHTML = `<div class="chead"><span class="eyebrow"><i></i>Sport</span><span class="more">›</span></div><div class="mid"><span data-count="${Math.round(sum(wkMin))}">0</span><small>min in 7 giorni</small></div>
      <div class="bars" style="grid-template-columns:repeat(7,minmax(0,1fr))">${wk.map((d, i) => `<div class="bar ${wkMin[i] ? '' : 'dim'}"><div class="col" style="height:46px"><div class="fill" data-hgt="${Math.max(6, 100 * wkMin[i] / mx).toFixed(0)}%"></div></div><span class="k">${GG[dow(d)].slice(0, 1).toUpperCase()}</span></div>`).join('')}</div>`;
    sp.onclick = () => go('sport'); g.appendChild(sp);
    v.appendChild(g);
    if (body.length) {
      const lb = body[body.length - 1], old = body.filter(b => b.date <= addDays(lb.date, -30)), o30 = old.length ? old[old.length - 1] : null, dW = o30 ? lb.w - o30.w : null;
      const co = h('section', 'card tap'); co.style.setProperty('--sec', 'var(--c-corpo)');
      co.innerHTML = `<div class="chead"><span class="eyebrow"><i></i>Corpo</span><span class="more">›</span></div><div class="row-wrap" style="align-items:baseline"><div class="big"><span data-count="${lb.w}" data-dec="1">0</span><small>kg</small></div>${dW !== null ? `<span class="pill ${dW > 0 ? 'warn' : 'good'}">${dW > 0 ? '+' : ''}${fmt(dW, 1)} kg in 30 giorni</span>` : ''}</div><div class="sp"></div><p class="muted xs">ultima pesata ${dLabelY(lb.date)} · grasso ${fmt(lb.fat, 1)} %</p>`;
      const pts = body.filter(b => b.date >= addDays(lb.date, -180)).map(b => [dayNum(b.date), b.w, b.date]);
      if (pts.length >= 3) lineChart($('.sp', co), { h: 80, pl: 6, series: [{ data: pts, color: 'var(--c-corpo)', area: true, w: 2, glow: true }], tip: p => `${dLabel(p[2])} · <b>${fmt(p[1], 1)}</b> kg`, aria: 'Peso ultimi 6 mesi', yFmt: () => '' });
      co.onclick = e => { if (!e.target.closest('.chart')) go('corpo'); };
      v.appendChild(co);
    }

    // settimana
    const wkd = weekly();
    const wc = h('section', 'card tap'); wc.style.setProperty('--sec', 'var(--c-oggi)');
    const best = wkd.M.filter(m => isNum(m.z)).sort((a, b) => Math.abs(b.z) - Math.abs(a.z))[0];
    wc.innerHTML = `<div class="chead"><span class="eyebrow"><i></i>La tua settimana</span><span class="more">Apri ›</span></div><h3 style="font-size:1.1rem">${wkd.label}</h3>
      <p class="muted small">${wkd.n} notti${best ? ` · ${best.l.toLowerCase()} ${fmt(best.now, best.dec)}${best.u} (prima ${fmt(best.was, best.dec)}${best.u})` : ''}</p>`;
    wc.onclick = () => openWeek(wkd);
    v.appendChild(wc);

    // recupero nel tempo
    const rs = gNights.slice(-30).map(n => { const r = readiness(n); return r ? [dayNum(n.date), r.score, n.date] : null; }).filter(Boolean);
    if (rs.length >= 5) {
      const c = h('section', 'card');
      c.appendChild(h('div', 'chead', `<span class="eyebrow"><i></i>Recupero, 30 giorni</span><span class="muted small">media ${fmt(avg(rs.map(p => p[1])))}</span>`));
      lineChart(c, { h: 130, series: [{ data: rs, color: 'var(--c-oggi)', area: true, w: 2.4, glow: true }], yMin: 30, yMax: 100, bands: [[80, 101, 'var(--band-good)']], xTicks: dateTicks,
        tip: p => `${dLabel(p[2])} · recupero <b>${fmt(p[1])}</b>`, onPick: p => go('sonno', { night: p[2] }), aria: 'Recupero negli ultimi 30 giorni' });
      v.appendChild(c);
    }
  }
  const openWeek = w => sheet(box => {
    box.style.setProperty('--sec', 'var(--c-oggi)');
    box.innerHTML = `<div><span class="eyebrow"><i></i>La tua settimana</span><h2 style="margin-top:6px">${w.label}</h2><p class="muted small">Confronto con le 4 settimane precedenti · ${w.n} notti</p></div>`;
    const moves = w.M.filter(m => isNum(m.z) && Math.abs(m.z) >= .5).sort((a, b) => Math.abs(b.z) - Math.abs(a.z)).slice(0, 3);
    if (moves.length) box.appendChild(h('div', 'card flat', '<span class="eyebrow">Cosa è cambiato</span>' + moves.map(m => { const good = (m.now - m.was) * m.better > 0;
      return noteHTML({ s: good ? 'good' : 'warn', i: m.now > m.was ? 'up' : 'down', t: `<strong>${m.l}</strong>: ${fmt(m.now, m.dec)}${m.u} contro ${fmt(m.was, m.dec)}${m.u}.` }); }).join('')));
    box.appendChild(h('div', 'grid2', w.M.map(m => { const d = isNum(m.now) && isNum(m.was) ? m.now - m.was : null; const good = d === null ? '' : d * m.better > 0 ? 'good' : Math.abs(d) < Math.pow(10, -m.dec) ? '' : 'warn';
      return stat(m.l, fmt(m.now, m.dec), m.u.trim(), d === null ? 'nessun confronto' : (d > 0 ? '+' : '') + fmt(d, m.dec) + ' sulla media', good); }).join('')));
    const extra = [];
    if (w.best) extra.push(`Notte migliore: <strong>${GIORNI[dow(w.best.date)]} ${dLabel(w.best.date)}</strong> (${w.best.score}), peggiore: <strong>${GIORNI[dow(w.worst.date)]} ${dLabel(w.worst.date)}</strong> (${w.worst.score}).`);
    extra.push(w.air ? (w.co2High ? `<strong>${w.co2High} notti</strong> con CO2 sopra 1000 ppm per più di un'ora.` : 'Aria della camera nella norma.') : 'Nessun dato della camera in quella settimana.');
    extra.push(w.acts ? `<strong>${w.acts}</strong> ${w.acts === 1 ? 'allenamento' : 'allenamenti'}, ${fmt(w.actMin)} minuti.` : 'Nessun allenamento: durante il recupero va benissimo.');
    extra.push(w.moodN ? `${w.moodN} check-in · energia ${fmt(w.energy, 1)}/5 · dolore ${fmt(w.pain, 1)}/10.` : 'Nessun check-in: bastano pochi secondi al giorno.');
    box.appendChild(h('div', 'card flat', extra.map(t => `<p class="small">${t}</p>`).join('')));
    box.appendChild(h('p', 'hint', 'Ogni lunedì mattina ricevi lo stesso riepilogo via email.'));
  });

  // =========================================================================
  // SONNO
  // =========================================================================
  function viewSonno(v) {
    const list = nights.filter(n => isNum(n.score) || n.air);
    v.appendChild(h('div', 'vhead', '<div><span class="k">Sonno</span><h1>Le tue notti</h1></div>'));
    if (!list.length) { v.appendChild(h('p', 'empty', 'Nessuna notte ancora.')); return; }
    if (!S.night || !byDate[S.night]) S.night = list[list.length - 1].date;
    const idx = list.findIndex(n => n.date === S.night), n = list[idx];
    const card = h('section', 'hero');
    const nav = h('div', 'nightnav');
    const prev = h('button', 'arr', '‹'), next = h('button', 'arr', '›');
    prev.setAttribute('aria-label', 'Notte precedente'); next.setAttribute('aria-label', 'Notte successiva');
    prev.disabled = idx <= 0; next.disabled = idx >= list.length - 1;
    prev.onclick = () => { buzz(); S.night = list[idx - 1].date; rerender(); }; next.onclick = () => { buzz(); S.night = list[idx + 1].date; rerender(); };
    nav.appendChild(prev);
    nav.appendChild(h('div', 'when', `<b>${cap(GIORNI[dow(n.date)])} ${dLabel(n.date)}</b><span class="muted small">${idx === list.length - 1 ? 'ultima notte' : (list.length - 1 - idx) + (list.length - 1 - idx === 1 ? ' notte fa' : ' notti fa')}</span>`));
    nav.appendChild(next); card.appendChild(nav);
    let sx = null; card.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    card.addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 60) { if (dx > 0 && idx > 0) prev.onclick(); else if (dx < 0 && idx < list.length - 1) next.onclick(); } }, { passive: true });
    if (isNum(n.score)) {
      const hr2 = h('div', 'hero-row'); hr2.style.marginTop = '14px';
      hr2.innerHTML = ringHTML(n.score, 'sleep score', 'sm') + `<div style="display:grid;gap:4px;min-width:0"><div class="mid">${hm(n.sleep_h)}</div>
        <p class="muted small">${esc(n.bed_start || '-')} → ${esc(n.bed_end || '-')}</p><div class="row-wrap">${n.awake_count ? `<span class="pill">${n.awake_count} ${n.awake_count === 1 ? 'risveglio' : 'risvegli'}</span>` : '<span class="pill good">senza risvegli</span>'}${isNum(n.spo2) ? `<span class="pill">SpO2 ${fmt(n.spo2)} %</span>` : ''}</div></div>`;
      card.appendChild(hr2);
      const st = [['deep', 'Profondo', '--st-deep'], ['light', 'Leggero', '--st-light'], ['rem', 'REM', '--st-rem'], ['awake', 'Sveglio', '--st-awake']];
      const stw = h('div', ''); stw.style.cssText = 'display:grid;gap:10px;margin-top:16px';
      stw.appendChild(h('div', 'stages', st.filter(k => n[k[0]] > 0).map(k => `<i data-flex="${n[k[0]]}" style="background:var(${k[2]})"></i>`).join('')));
      stw.appendChild(h('div', 'slist', st.map(k => { const b = baseline(n.date, k[0]); const d = isNum(n[k[0]]) && b !== null ? n[k[0]] - b : null;
        return `<div><span class="muted"><i class="dot" style="background:var(${k[2]})"></i> ${k[1]}</span><b>${fmt(n[k[0]])}′</b><span class="${d === null ? 'faint' : (k[0] === 'awake' ? d <= 0 : d >= 0) ? 'good' : 'warn'}">${d === null ? '' : (d > 0 ? '+' : '') + fmt(d) + '′'}</span></div>`; }).join('')));
      card.appendChild(stw);
      const R = readiness(n);
      const g3 = h('div', 'grid3'); g3.style.marginTop = '14px';
      g3.innerHTML = stat('HRV', fmt(n.hrv), 'ms', n.hrv_status === 'BALANCED' ? 'equilibrata' : n.hrv_status === 'LOW' ? 'bassa' : n.hrv_status ? 'sbilanciata' : '', n.hrv_status === 'BALANCED' ? 'good' : n.hrv_status === 'LOW' ? 'bad' : 'warn')
        + stat('Riposo', fmt(n.rhr), 'bpm', 'solito ' + fmt(baseline(n.date, 'rhr')), '') + stat('Recupero', R ? fmt(R.score) : '-', '', 'Battery ' + fmt(n.bb_wake), R ? state(R.score) : '');
      card.appendChild(g3);
    } else card.appendChild(h('p', 'empty', 'Dati Garmin non ancora arrivati per questa notte (aggiornamento alle 10).'));
    v.appendChild(card);
    const notes = nightNotes(n);
    if (notes.length) v.appendChild(h('section', 'card', notes.map(noteHTML).join('')));
    const ns = (DATA.nightSeries || {})[n.date];
    if (ns && ns.pts.length >= 6) {
      const c = h('section', 'card');
      c.appendChild(h('div', 'chead', '<span class="eyebrow"><i></i>Aria della camera</span>'));
      c.appendChild(chips([['co2', 'CO2'], ['temp', 'Temperatura']], S.nMode, k => { S.nMode = k; rerender(); }, true));
      const A = n.air;
      if (S.nMode === 'co2') lineChart(c, { h: 190, series: [{ data: ns.pts.map(p => [p[0], p[1]]), color: 'var(--c-sonno)', area: true, glow: true }], yMin: 400, yMax: Math.max(1100, A ? A.co2_max : 0),
        bands: [[800, 1000, 'var(--band-warn)'], [1000, 5000, 'var(--band-bad)']], hlines: [[1000, 'var(--bad)']], xTicks: nightTicks, xMin: 0, xMax: 720, boxes: [[ns.win[0], ns.win[1], 'a letto']],
        tip: p => `${clock(p[0] + 1320)} · <b>${fmt(p[1])}</b> ppm`, aria: 'CO2 durante la notte' });
      else lineChart(c, { h: 160, series: [{ data: ns.pts.map(p => [p[0], p[2]]), color: 'var(--c-casa)', area: true, glow: true }], yMin: 17, yMax: 23, bands: [[17, 20, 'var(--band-good)']], xTicks: nightTicks, xMin: 0, xMax: 720,
        boxes: [[ns.win[0], ns.win[1], 'a letto']], yFmt: v2 => fmt(v2, 0), tip: p => `${clock(p[0] + 1320)} · <b>${fmt(p[1], 1)}</b> °C`, aria: 'Temperatura durante la notte' });
      if (A) c.appendChild(h('div', 'grid3', stat('CO2 media', fmt(A.co2_avg), 'ppm', A.over1000_min ? hm(A.over1000_min / 60) + ' > 1000' : 'mai sopra 1000', co2State(A.co2_avg)) + stat('Massima', fmt(A.co2_max), 'ppm', 'alle ' + esc(A.co2_max_at), co2State(A.co2_max)) + stat('Camera', fmt(A.temp_avg, 1), '°C', fmt(A.rh_avg) + ' % umidità', tempState(A.temp_avg))));
      v.appendChild(c);
    }
    const last14 = nights.filter(x => isNum(x.score)).slice(-14);
    if (last14.length) {
      const c = h('section', 'card');
      c.appendChild(h('div', 'chead', '<span class="eyebrow"><i></i>Ritmo del sonno</span><span class="muted small">ultime 2 settimane</span>'));
      c.appendChild(timeline(last14, n.date, d => { S.night = d; rerender(); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
      c.appendChild(h('div', 'legend', '<span><i class="sw" style="background:var(--st-deep);height:8px"></i>profondo</span><span><i class="sw" style="background:var(--st-light);height:8px"></i>leggero</span><span><i class="sw" style="background:var(--st-rem);height:8px"></i>REM</span><span><i class="sw" style="background:var(--st-awake);height:8px"></i>sveglio</span>'));
      v.appendChild(c);
    }
    const M = { score: ['Score', x => x.score, 0, ''], sleep_h: ['Durata', x => x.sleep_h, 1, 'h'], hrv: ['HRV', x => x.hrv, 0, 'ms'], rhr: ['FC riposo', x => x.rhr, 0, 'bpm'],
      bb_wake: ['Body Battery', x => x.bb_wake, 0, ''], deep: ['Profondo', x => x.deep, 0, 'min'], bed: ['A letto', x => bedMin(x.bed_start), 0, ''], ready: ['Recupero', x => { const r = readiness(x); return r ? r.score : null; }, 0, ''] };
    if (!M[S.sMetric]) S.sMetric = 'score';
    const c2 = h('section', 'card');
    c2.appendChild(h('div', 'chead', '<span class="eyebrow"><i></i>Andamento</span>'));
    c2.appendChild(chips(Object.keys(M).map(k => [k, M[k][0]]), S.sMetric, k => { S.sMetric = k; save(); rerender(); }));
    c2.appendChild(chips([[7, '7 g'], [30, '30 g'], [90, '90 g'], [9999, 'Tutto']], S.sPeriod, k => { S.sPeriod = k; save(); rerender(); }, true));
    const m = M[S.sMetric], lastDay = dayNum(gNights.length ? gNights[gNights.length - 1].date : n.date);
    const pts = gNights.filter(x => dayNum(x.date) > lastDay - S.sPeriod).map(x => [dayNum(x.date), m[1](x), x.date]).filter(p => isNum(p[1]));
    if (pts.length) {
      const mean = avg(pts.map(p => p[1])), isBed = S.sMetric === 'bed';
      const roll = pts.map((p, i) => [p[0], avg(pts.slice(Math.max(0, i - 6), i + 1).map(q => q[1]))]);
      c2.appendChild(h('div', 'row-wrap', `<div class="mid">${isBed ? clock(mean) : fmt(mean, m[2])}<small>${m[3]}</small></div><span class="muted small">media · ${pts.length} notti</span>`));
      const sel = pts.find(p => p[2] === n.date);
      lineChart(c2, { h: 200, series: [{ data: pts, color: 'var(--c-sonno)', line: false, dots: pts.length > 60 ? 2.2 : 3.2, dotOpacity: .55 }, { data: roll, color: 'var(--c-sonno)', w: 2.6, area: !isBed, glow: true }],
        hlines: [[mean, 'var(--faint)']], xTicks: dateTicks, yFmt: isBed ? (v2 => clock(v2)) : null, mark: sel ? [sel[0], sel[1], 'var(--c-casa)'] : null,
        tip: p => `${dLabel(p[2])} · <b>${isBed ? clock(p[1]) : fmt(p[1], m[2])}</b> ${m[3]}`, onPick: p => { S.night = p[2]; rerender(); window.scrollTo({ top: 0, behavior: 'smooth' }); }, aria: 'Andamento ' + m[0] });
      c2.appendChild(h('div', 'legend', '<span><i class="sw" style="background:var(--c-sonno);height:8px;width:8px;border-radius:50%;opacity:.55"></i>notti</span><span><i class="sw" style="background:var(--c-sonno)"></i>media su 7 notti</span><span><i class="sw" style="background:var(--faint)"></i>media</span>'));
    } else c2.appendChild(h('p', 'empty', 'Nessun dato in questo periodo.'));
    v.appendChild(c2);
    const c3 = h('section', 'card');
    c3.appendChild(h('div', 'chead', '<span class="eyebrow"><i></i>Calendario</span><span class="muted small">13 settimane</span>'));
    const cal = h('div', 'cal');
    const end = dayNum(gNights.length ? gNights[gNights.length - 1].date : n.date), endDow = (dow(fromDayNum(end)) + 6) % 7, start = end - endDow - 7 * 12;
    let j = 0;
    for (let d = start; d <= end + (6 - endDow); d++) {
      const ds = fromDayNum(d), x = byDate[ds], b = h('button');
      if (d > end) { b.style.visibility = 'hidden'; cal.appendChild(b); continue; }
      b.style.background = scoreColor(x && x.score); b.style.setProperty('--j', j++);
      b.setAttribute('aria-label', dLabel(ds) + (x && isNum(x.score) ? ', score ' + x.score : ', nessun dato'));
      if (ds === n.date) b.classList.add('sel');
      if (x && (isNum(x.score) || x.air)) b.onclick = () => { buzz(); S.night = ds; rerender(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
      cal.appendChild(b);
    }
    c3.appendChild(cal);
    c3.appendChild(h('div', 'calscale', 'meno <i style="background:var(--bad)"></i><i style="background:color-mix(in srgb, var(--warn) 50%, var(--bad))"></i><i style="background:var(--warn)"></i><i style="background:color-mix(in srgb, var(--good) 60%, var(--warn))"></i><i style="background:var(--good)"></i> più · colonne = settimane'));
    v.appendChild(c3);
  }

  // =========================================================================
  // SPORT
  // =========================================================================
  function viewSport(v) {
    v.appendChild(h('div', 'vhead', '<div><span class="k">Sport</span><h1>Allenamento</h1></div>'));
    const last28 = ACTS.filter(a => a.date > addDays(today, -28)), last7 = ACTS.filter(a => a.date > addDays(today, -7));
    const LB = loadByDay();
    const acute = sum([...Array(7)].map((_, i) => LB[addDays(today, -i)] || 0)), chronic = sum([...Array(28)].map((_, i) => LB[addDays(today, -i)] || 0)) / 4;
    const ratio = chronic > 0 ? acute / chronic : null;
    const hero = h('section', 'hero');
    const zone = ratio === null ? ['Nessun carico recente', '', 'Durante il recupero dall\'operazione è normale: i dati serviranno quando riprenderai.']
      : ratio < .8 ? ['Carico in calo', 'warn', 'Ti stai allenando meno del solito: va bene se è voluto (recupero, scarico).']
      : ratio <= 1.3 ? ['Carico equilibrato', 'good', 'Settimana in linea con le ultime 4: zona ideale per progredire.']
      : ratio <= 1.5 ? ['Carico in salita', 'warn', 'Più del solito: occhio a sonno e HRV nei prossimi giorni.'] : ['Carico molto alto', 'bad', 'Molto sopra il solito: rischio di sovraccarico, inserisci recupero.'];
    hero.innerHTML = `<div class="chead"><span class="eyebrow"><i></i>Ultimi 7 giorni</span><span class="pill ${zone[1]}">${ratio === null ? '-' : 'rapporto ' + fmt(ratio, 2)}</span></div>
      <div class="grid3" style="margin-top:12px">${stat('Allenamenti', fmt(last7.length), '', 'in 28 g ' + last28.length, '')}${stat('Minuti', fmt(sum(last7.map(a => a.min))), '', 'media sett. ' + fmt(sum(last28.map(a => a.min)) / 4), '')}${stat('Carico', fmt(acute), '', 'medio ' + fmt(chronic), zone[1])}</div>
      <div style="display:grid;gap:4px;margin-top:14px"><h2 style="font-size:1.2rem">${zone[0]}</h2><p class="muted small">${zone[2]}</p></div>`;
    v.appendChild(hero);
    if (!ACTS.length) { v.appendChild(h('p', 'empty', 'Nessuna attività importata. Esegui garminActivitiesBackfill nello script per caricare lo storico da Garmin.')); return; }
    // volume settimanale
    const weeks = [], wEnd = dayNum(today) - ((dow(today) + 6) % 7) + 6;
    for (let k = S.spWeeks - 1; k >= 0; k--) { const e = wEnd - 7 * k, s = e - 6; const a = ACTS.filter(x => { const d = dayNum(x.date); return d >= s && d <= e; }); weeks.push({ s: fromDayNum(s), min: sum(a.map(x => x.min)), n: a.length, load: sum(a.map(x => x.load)) }); }
    const c = h('section', 'card');
    c.appendChild(h('div', 'chead', `<span class="eyebrow"><i></i>Minuti a settimana</span><span class="muted small">ultime ${S.spWeeks} settimane</span>`));
    const mx = Math.max(60, Math.max.apply(null, weeks.map(w => w.min)));
    c.appendChild(h('div', 'bars', weeks.map((w, i) => `<div class="bar ${i === weeks.length - 1 ? '' : 'dim'}" title="${dLabel(w.s)}"><span class="v">${w.min ? fmt(w.min) : ''}</span><div class="col"><div class="fill" data-hgt="${Math.max(3, 100 * w.min / mx).toFixed(0)}%"></div></div><span class="k">${+w.s.slice(8, 10)}/${+w.s.slice(5, 7)}</span></div>`).join('')));
    c.lastChild.style.gridTemplateColumns = `repeat(${weeks.length}, minmax(0, 1fr))`;
    v.appendChild(c);
    // VO2max
    const vo = ACTS.filter(a => isNum(a.vo2)).map(a => [dayNum(a.date), a.vo2, a.date]);
    if (vo.length >= 3) { const c2 = h('section', 'card'); c2.appendChild(h('div', 'chead', `<span class="eyebrow"><i></i>VO2 max</span><span class="mid" style="font-size:1.4rem">${fmt(vo[vo.length - 1][1])}</span>`));
      lineChart(c2, { h: 130, series: [{ data: vo, color: 'var(--c-sport)', area: true, glow: true, dots: 2.4 }], xTicks: dateTicks, tip: p => `${dLabelY(p[2])} · VO2 max <b>${fmt(p[1])}</b>`, aria: 'VO2 max' }); v.appendChild(c2); }
    // elenco
    const lc = h('section', 'card'); lc.appendChild(h('div', 'chead', `<span class="eyebrow"><i></i>Attività recenti</span><span class="muted small">${ACTS.length} in tutto</span>`));
    const ls = h('div', 'list');
    ACTS.slice(-25).reverse().forEach(a => { const sp = sportOf(a.type);
      const r = h('div', 'lrow', `<span class="ai">${icon(sp[1])}</span><div style="min-width:0"><b>${esc(a.name || sp[0])}</b><span class="meta">${sp[0]} · ${dLabelY(a.date)}${a.time ? ' · ' + esc(a.time) : ''}</span></div><div class="r">${fmt(a.min)}′${isNum(a.km) && a.km > 0 ? '<br><span class="muted xs">' + fmt(a.km, 1) + ' km</span>' : ''}</div>`);
      r.onclick = () => openActivity(a); ls.appendChild(r); });
    lc.appendChild(ls); v.appendChild(lc);
  }
  const openActivity = a => sheet(box => {
    const sp = sportOf(a.type); box.style.setProperty('--sec', 'var(--c-sport)');
    const night = byDate[addDays(a.date, 1)];
    box.innerHTML = `<div class="row-wrap"><span class="lrow" style="border:0;padding:0;grid-template-columns:40px"><span class="ai">${icon(sp[1])}</span></span><div><span class="eyebrow">${sp[0]} · ${cap(GIORNI[dow(a.date)])} ${dLabelY(a.date)}</span><h2>${esc(a.name || sp[0])}</h2></div></div>
      <div class="grid3">${stat('Durata', fmt(a.min), 'min', a.time ? 'alle ' + esc(a.time) : '', '')}${stat('Distanza', isNum(a.km) && a.km > 0 ? fmt(a.km, 2) : '-', 'km', isNum(a.km) && a.km > 0 && isNum(a.min) ? fmt(a.min / a.km, 1) + ' min/km' : '', '')}${stat('Calorie', fmt(a.kcal), 'kcal', '', '')}
      ${stat('FC media', fmt(a.hr), 'bpm', 'max ' + fmt(a.hrMax), '')}${stat('Training Effect', fmt(a.te, 1), '', 'anaerobico ' + fmt(a.ane, 1), isNum(a.te) ? (a.te >= 4 ? 'warn' : 'good') : '')}${stat('Carico', fmt(a.load), '', isNum(a.vo2) ? 'VO2 max ' + fmt(a.vo2) : '', '')}</div>
      ${night && isNum(night.score) ? `<div class="card flat"><span class="eyebrow">La notte dopo</span><p class="small">Sleep score <strong>${night.score}</strong>, HRV <strong>${fmt(night.hrv)}</strong> ms, Body Battery al risveglio <strong>${fmt(night.bb_wake)}</strong>.</p></div>` : ''}`;
  });

  // =========================================================================
  // CORPO
  // =========================================================================
  function viewCorpo(v) {
    v.appendChild(h('div', 'vhead', '<div><span class="k">Corpo</span><h1>Composizione</h1></div>'));
    if (!body.length) { v.appendChild(h('p', 'empty', 'Nessuna pesata ancora.')); return; }
    const M = { w: ['Peso', 'kg', 1, -1], fat: ['Grasso', '%', 1, -1], muscle: ['Muscoli', '%', 1, 1], water: ['Acqua', '%', 1, 1], bmi: ['BMI', '', 1, -1], visfat: ['Viscerale', '', 0, -1] };
    if (!M[S.cMetric]) S.cMetric = 'w';
    const m = M[S.cMetric], lb = body[body.length - 1], endD = dayNum(lb.date);
    const pts = body.filter(b => dayNum(b.date) > endD - S.cPeriod && isNum(b[S.cMetric])).map(b => [dayNum(b.date), b[S.cMetric], b.date]);
    const hero = h('section', 'hero');
    hero.appendChild(chips(Object.keys(M).map(k => [k, M[k][0]]), S.cMetric, k => { S.cMetric = k; save(); rerender(); }));
    if (pts.length) {
      const first = pts[0], last = pts[pts.length - 1], d = last[1] - first[1], good = d * m[3] >= 0;
      hero.appendChild(h('div', 'row-wrap', `<div class="big"><span data-count="${last[1]}" data-dec="${m[2]}">0</span><small>${m[1]}</small></div>${pts.length > 1 ? `<span class="pill ${Math.abs(d) < .05 ? '' : good ? 'good' : 'warn'}">${d > 0 ? '+' : ''}${fmt(d, m[2])} ${m[1]} dal ${dLabelY(first[2])}</span>` : ''}`)).style.marginTop = '12px';
      const roll = pts.map((p, i) => [p[0], avg(pts.slice(Math.max(0, i - 2), i + 3).map(q => q[1]))]);
      lineChart(hero, { h: 210, series: [{ data: pts, color: 'var(--muted)', line: false, dots: pts.length > 80 ? 1.8 : 2.8, dotOpacity: .55 }, { data: roll, color: 'var(--c-corpo)', area: true, w: 2.6, glow: true }],
        xTicks: dateTicks, tip: p => `${dLabelY(p[2])} · <b>${fmt(p[1], m[2])}</b> ${m[1]}`, aria: 'Andamento ' + m[0] });
    } else hero.appendChild(h('p', 'empty', 'Nessuna pesata in questo periodo.'));
    hero.appendChild(chips([[90, '3 m'], [365, '1 a'], [1095, '3 a'], [99999, 'Tutto']], S.cPeriod, k => { S.cPeriod = k; save(); rerender(); }, true));
    v.appendChild(hero);
    const comp = h('section', 'card');
    comp.appendChild(h('div', 'chead', `<span class="eyebrow"><i></i>Ultima pesata</span><span class="muted small">${dLabelY(lb.date)}</span>`));
    comp.appendChild(h('div', 'hbar', [['Grasso', lb.fat, 40, '%'], ['Muscoli', lb.muscle, 60, '%'], ['Acqua', lb.water, 70, '%']].map(x => `<div class="line"><span class="muted">${x[0]}</span><div class="track"><i data-w="${isNum(x[1]) ? (100 * x[1] / x[2]).toFixed(0) : 0}%"></i></div><span class="v">${fmt(x[1], 1)} ${x[3]}</span></div>`).join('')));
    comp.appendChild(h('div', 'grid3', stat('BMI', fmt(lb.bmi, 1), '', lb.bmi < 25 ? 'nella norma' : lb.bmi < 30 ? 'sovrappeso' : 'alto', !isNum(lb.bmi) ? '' : lb.bmi < 25 ? 'good' : lb.bmi < 30 ? 'warn' : 'bad') + stat('Viscerale', fmt(lb.visfat), '', isNum(lb.visfat) && lb.visfat <= 9 ? 'nella norma' : 'alto', isNum(lb.visfat) ? (lb.visfat <= 9 ? 'good' : 'warn') : '') + stat('Ossa', fmt(lb.bone, 1), 'kg', '', '')));
    v.appendChild(comp);
    const an = analysis();
    if (an.weight) { const up = an.weight.perMonth > 0, flat = Math.abs(an.weight.perMonth) < .2;
      v.appendChild(h('section', 'card', noteHTML({ s: flat ? 'good' : up ? 'warn' : 'good', i: up ? 'up' : 'down', t: flat ? '<strong>Peso stabile</strong> negli ultimi 6 mesi.' : `<strong>Peso ${up ? 'in aumento' : 'in calo'}</strong> di circa <span class="num">${fmt(Math.abs(an.weight.perMonth), 1)}</span> kg al mese negli ultimi 6 mesi.`, tip: `Stima robusta agli sbalzi su ${an.weight.n} pesate.` }))); }
    const lc = h('section', 'card'); lc.appendChild(h('div', 'chead', '<span class="eyebrow"><i></i>Ultime pesate</span>'));
    const ls = h('div', 'list');
    body.slice(-8).reverse().forEach((b, i) => { const p = body[body.length - 2 - i]; const d = p ? b.w - p.w : null;
      ls.appendChild(h('div', 'lrow', `<span class="ai">${icon('corpo')}</span><div><b>${fmt(b.w, 1)} kg</b><span class="meta">${dLabelY(b.date)} · grasso ${fmt(b.fat, 1)} %</span></div><span class="r ${d === null ? 'muted' : d > 0 ? 'warn' : 'good'}">${d === null ? '' : (d > 0 ? '+' : '') + fmt(d, 1)}</span>`)); });
    lc.appendChild(ls); v.appendChild(lc);
  }

  // =========================================================================
  // CASA
  // =========================================================================
  function viewCasa(v) {
    v.appendChild(h('div', 'vhead', `<div><span class="k">Casa</span><h1>Aria e clima</h1></div><span class="muted small">${DATA.room ? 'lettura delle ' + esc(DATA.room.ts.slice(11, 16)) : ''}</span>`));
    const rm = DATA.room, hb = DATA.hub;
    if (rm) {
      const c = h('section', 'hero');
      c.innerHTML = `<div class="chead"><span class="eyebrow"><i></i>Camera da letto</span>${isNum(rm.bat) ? `<span class="pill ${rm.bat < 20 ? 'bad' : ''}">batteria ${fmt(rm.bat)} %</span>` : ''}</div>${semiHTML(rm.co2)}
        <div style="text-align:center;margin-top:-6px"><div class="big ${co2State(rm.co2)}"><span data-count="${rm.co2}">0</span><small>ppm CO2</small></div><p class="muted small">${rm.co2 <= 800 ? 'Aria buona' : rm.co2 <= 1000 ? 'Aria discreta: apri un po\'' : 'Da ventilare adesso'}</p></div>
        <div class="grid2" style="margin-top:14px">${stat('Temperatura', fmt(rm.temp, 1), '°C', 'per dormire 17-20', tempState(rm.temp))}${stat('Umidità', fmt(rm.rh), '%', 'ideale 40-60', rhState(rm.rh))}</div>`;
      v.appendChild(c);
    }
    if (hb) v.appendChild(h('section', 'card', `<div class="chead"><span class="eyebrow"><i></i>Seconda stanza</span></div><div class="grid3">${stat('Temperatura', fmt(hb.temp, 1), '°C', 'Hub 2', '')}${stat('Umidità', fmt(hb.rh), '%', '', rhState(hb.rh))}${stat('Luce', fmt(hb.light), '/20', '', '')}</div>`));
    const rec = DATA.recent || [];
    if (rec.length) {
      const c = h('section', 'card');
      c.appendChild(h('div', 'chead', '<span class="eyebrow"><i></i>Storico</span>'));
      c.appendChild(chips([['co2', 'CO2'], ['temp', 'Temperatura'], ['rh', 'Umidità']], S.hMetric, k => { S.hMetric = k; save(); rerender(); }));
      c.appendChild(chips([[1, '24 h'], [3, '3 g'], [7, '7 g']], S.hPeriod, k => { S.hPeriod = k; save(); rerender(); }, true));
      const lastT = rec[rec.length - 1][0], from = lastT - S.hPeriod * 1440, r = rec.filter(p => p[0] >= from);
      const col = { co2: 1, temp: 2, rh: 3 }[S.hMetric], hcol = { temp: 4, rh: 5 }[S.hMetric];
      const unit = { co2: 'ppm', temp: '°C', rh: '%' }[S.hMetric], dec = S.hMetric === 'temp' ? 1 : 0;
      const ticks = (a, b) => { const out = [], stepH = S.hPeriod === 1 ? 6 : S.hPeriod === 3 ? 12 : 24;
        for (let m2 = Math.ceil(a / (stepH * 60)) * stepH * 60; m2 <= b; m2 += stepH * 60) { const dt = absToDate(m2); out.push([m2, stepH >= 24 || dt.getUTCHours() === 0 ? dt.getUTCDate() + ' ' + MESI[dt.getUTCMonth()] : String(dt.getUTCHours()).padStart(2, '0') + ':00']); } return out; };
      const series = [{ data: r.map(p => [p[0], p[col]]), color: S.hMetric === 'co2' ? 'var(--c-casa)' : 'var(--c-casa)', area: true, gap: 40, glow: true }];
      if (hcol) series.push({ data: r.map(p => [p[0], p[hcol]]), color: 'var(--c-oggi)', w: 1.7, gap: 40, dash: '4 3' });
      const bands = S.hMetric === 'co2' ? [[800, 1000, 'var(--band-warn)'], [1000, 9999, 'var(--band-bad)']] : S.hMetric === 'temp' ? [[17, 20, 'var(--band-good)']] : [[40, 60, 'var(--band-good)']];
      lineChart(c, { h: 200, series: series, bands: bands, xTicks: ticks, tip: p => { const dt = absToDate(p[0]); const hp = hcol ? r.find(q => q[0] === p[0]) : null;
        return `${dt.getUTCDate()} ${MESI[dt.getUTCMonth()]} ${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')} · <b>${fmt(p[1], dec)}</b> ${unit}${hp && isNum(hp[hcol]) ? ' · altra stanza <b>' + fmt(hp[hcol], dec) + '</b>' : ''}`; }, aria: 'Storico ' + unit });
      if (hcol) c.appendChild(h('div', 'legend', '<span><i class="sw" style="background:var(--c-casa)"></i>camera</span><span><i class="sw" style="background:var(--c-oggi)"></i>seconda stanza</span>'));
      v.appendChild(c);
    }
    const an = nights.filter(n => n.air);
    if (an.length) {
      const c = h('section', 'card');
      c.appendChild(h('div', 'chead', `<span class="eyebrow"><i></i>CO2 media per notte</span><span class="muted small">${an.length} ${an.length === 1 ? 'notte' : 'notti'}</span>`));
      const sl = an.slice(-14), mx = Math.max(1200, Math.max.apply(null, sl.map(n => n.air.co2_max)));
      const box = h('div', 'bars'); box.style.gridTemplateColumns = `repeat(${Math.max(sl.length, 7)}, minmax(0, 1fr))`;
      sl.forEach(n => { const b = h('button', 'bar', `<span class="v">${fmt(n.air.co2_avg)}</span><div class="col"><div class="fill" data-hgt="${(100 * n.air.co2_avg / mx).toFixed(0)}%" style="background:linear-gradient(180deg, var(--${co2State(n.air.co2_avg)}), color-mix(in srgb, var(--${co2State(n.air.co2_avg)}) 30%, transparent))"></div></div><span class="k">${dLabel(n.date)}</span>`);
        b.onclick = () => { buzz(); go('sonno', { night: n.date }); }; box.appendChild(b); });
      c.appendChild(box); c.appendChild(h('p', 'hint', 'Tocca una notte per aprirla.'));
      v.appendChild(c);
    }
  }

  // =========================================================================
  // INSIGHT
  // =========================================================================
  function viewInsight(v) {
    const an = analysis(); setBadge();
    const back = h('button', 'back', '‹ Indietro'); back.onclick = () => go(lastIdx >= 0 ? TABS[lastIdx][0] : 'oggi');
    v.appendChild(back);
    v.appendChild(h('div', 'vhead', `<div><span class="k">Insight</span><h1>Cosa dicono i tuoi dati</h1></div><span class="muted small">${gNights.length} notti · ${an.tested} confronti</span>`));
    const F = [['all', 'Tutto'], ['score', 'Sleep score'], ['hrv', 'HRV'], ['rhr', 'Battito'], ['bb', 'Body Battery'], ['deep', 'Profondo'], ['energy', 'Energia'], ['moodv', 'Umore'], ['pain', 'Dolore']];
    v.appendChild(chips(F, S.aFilter, k => { S.aFilter = k; save(); rerender(); }));
    const list = an.findings.filter(t => S.aFilter === 'all' || t.o.id === S.aFilter);
    if (list.length) list.forEach((t, i) => {
      const good = (t.dir * t.o.better) > 0, strong = t.p < 0.01 && t.strength >= 0.4;
      const c = h('section', 'card find' + (i === 0 ? ' open' : ''));
      const vmax = Math.max.apply(null, t.groups.map(g => g.v)), vmin = Math.min.apply(null, t.groups.map(g => g.v));
      c.innerHTML = `<div class="meta"><span class="tag ${good ? 'good' : 'bad'}">${good ? 'ti aiuta' : 'ti penalizza'}</span><span class="tag n">${strong ? 'evidenza forte' : 'evidenza moderata'}</span><span class="tag n">${t.n} notti</span></div>
        <h3>${esc(findingTitle(t))}</h3><div class="bars" style="grid-template-columns:repeat(${t.groups.length},minmax(0,1fr))">${t.groups.map(g => `<div class="bar ${g.hi ? '' : 'dim'}"><span class="v" style="font-size:.9rem;color:var(--fg)">${fmt(g.v, t.o.dec)}</span><div class="col" style="height:72px"><div class="fill" data-hgt="${(25 + 75 * (g.v - vmin) / ((vmax - vmin) || 1)).toFixed(0)}%"></div></div><span class="k">${esc(g.k)} · ${g.n}</span></div>`).join('')}</div>
        <div class="body"><p class="muted small">${esc(findingBody(t))}</p><div class="sc"></div></div><span class="more">${i === 0 ? 'Chiudi' : 'Vedi i dati'}</span>`;
      const sc = c.querySelector('.sc'); let drawn = false;
      const drawScatter = () => {
        if (drawn || t.f.binary) return; drawn = true;
        sc.appendChild(h('span', 'eyebrow', 'Ogni punto è una notte'));
        const pts = t.pairs.map(p => [p[0], p[1], p[2]]).sort((a, b) => a[0] - b[0]);
        const mx = avg(pts.map(p => p[0])), my = avg(pts.map(p => p[1])), den = pts.reduce((s, p) => s + (p[0] - mx) * (p[0] - mx), 0);
        const k = den ? pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / den : 0, xa = pts[0][0], xb = pts[pts.length - 1][0];
        const ticks = (a, b) => { const st = niceStep((b - a) / 4), out = []; for (let x = Math.ceil(a / st) * st; x <= b; x += st) out.push([x, t.f.id === 'bed' ? clock(x) : fmt(x, st < 1 ? 1 : 0)]); return out; };
        lineChart(sc, { h: 200, series: [{ data: pts, color: 'var(--c-insight)', line: false, dots: 3.6, dotOpacity: .7 }, { data: [[xa, my + k * (xa - mx)], [xb, my + k * (xb - mx)]], color: 'var(--fg)', w: 1.3, dash: '5 4', opacity: .55 }],
          xTicks: ticks, tip: p => `${dLabel(p[2])} · ${esc(t.f.show(p[0]))} · <b>${fmt(p[1], t.o.dec)}</b>${t.o.unit}`, onPick: p => go('sonno', { night: p[2] }), aria: 'Grafico a punti' });
        sc.appendChild(h('p', 'hint', `Orizzontale: ${t.f.axis}. Verticale: ${t.o.label}. Tocca un punto per aprire la notte.`));
      };
      if (i === 0) setTimeout(drawScatter, 60);
      c.onclick = e => { if (e.target.closest('.chart')) return; buzz(); const open = c.classList.toggle('open'); c.querySelector('.more').textContent = open ? 'Chiudi' : 'Vedi i dati'; if (open) drawScatter(); };
      v.appendChild(c);
    });
    else v.appendChild(h('p', 'empty', 'Per ora nessuna relazione abbastanza solida per questo filtro. Le scoperte compaiono man mano che i dati crescono.'));
    if (MOOD.length >= 2) {
      const c = h('section', 'card'); c.style.setProperty('--sec', 'var(--c-insight)');
      c.appendChild(h('div', 'chead', `<span class="eyebrow"><i></i>Come ti sei sentito</span><span class="muted small">${MOOD.length} check-in</span>`));
      const ms = MOOD.slice().sort((a, b) => a.date < b.date ? -1 : 1).slice(-60);
      lineChart(c, { h: 150, series: [{ data: ms.map(m => [dayNum(m.date), m.energy, m.date]), color: 'var(--c-sport)', w: 2.4, dots: 3 }, { data: ms.map(m => [dayNum(m.date), m.mood, m.date]), color: 'var(--c-insight)', w: 2.4, dots: 3 }],
        yMin: 1, yMax: 5, xTicks: dateTicks, tip: p => { const m = ms.find(x => x.date === p[2]) || {}; return `${dLabel(p[2])} · energia <b>${fmt(m.energy)}</b> · umore <b>${fmt(m.mood)}</b> · dolore <b>${fmt(m.pain)}</b>`; }, aria: 'Energia e umore' });
      c.appendChild(h('div', 'legend', '<span><i class="sw" style="background:var(--c-sport)"></i>energia</span><span><i class="sw" style="background:var(--c-insight)"></i>umore</span>'));
      v.appendChild(c);
    }
    if (an.trends.length) v.appendChild(h('section', 'card', '<span class="eyebrow"><i></i>Tendenze delle ultime 2 settimane</span>' + an.trends.map(tt => { const good = (tt.diff * tt.o.better) > 0;
      return noteHTML({ s: good ? 'good' : 'warn', i: tt.diff > 0 ? 'up' : 'down', t: `<strong>${cap(tt.o.label)} ${tt.diff > 0 ? 'in aumento' : 'in calo'}</strong>: <span class="num">${fmt(tt.now, tt.o.dec)}</span>${tt.o.unit} contro ${fmt(tt.was, tt.o.dec)}${tt.o.unit} nelle 4 settimane prima.` }); }).join('')));
    if (an.learning.length) v.appendChild(h('section', 'card', `<div class="chead"><span class="eyebrow"><i></i>Sto ancora imparando</span><span class="muted small">servono ${an.MIN_N} giorni</span></div>` +
      an.learning.map(l => `<div class="prog"><span>${esc(l.l)} · <span class="num">${l.n}/${an.MIN_N}</span></span><div class="track"><i data-w="${Math.min(100, 100 * l.n / an.MIN_N).toFixed(0)}%"></i></div></div>`).join('')));
    v.appendChild(h('section', 'card', `<details class="how"><summary>Come funziona l'analisi</summary><ul>
      <li>Confronto 11 fattori (ora e regolarità del sonno, passi, stress e carico di allenamento del giorno prima, CO2, temperatura e umidità della camera, sleep score e HRV per il check-in, weekend) con 8 risultati (sleep score, HRV, battito a riposo, Body Battery, sonno profondo, energia, umore, dolore).</li>
      <li>Correlazione di Spearman verificata con un test di permutazione: niente ipotesi sulla forma dei dati.</li>
      <li>Correzione di Benjamini-Hochberg per i confronti multipli: le coincidenze vengono scartate.</li>
      <li>Non confronto lo sleep score con le sue componenti (durata, fasi): sarebbe scontato.</li>
      <li>Sono associazioni, non prove di causa: usale come ipotesi da provare.</li></ul></details>`));
  }

  // avvio
  setTimeout(setBadge, 400);
  const start = (location.hash || '').replace('#', '');
  go(TABS.some(t => t[0] === start) || start === 'insight' ? start : 'oggi');
  }
})();
