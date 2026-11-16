/* Ritmo: l'app. Caricata da jsDelivr (ramo main del repo) dal caricatore apps-script/ritmo.html,
   che fornisce la variabile globale DATA con i dati del foglio. Nessun dato personale in questo file. */
(function () {
  'use strict';
  // Versione: data della release (aggiornarla a ogni modifica) e commit da cui jsDelivr ha servito il file.
  const RELEASE = '16 nov 2026';
  const SRC = (document.currentScript && document.currentScript.src) || '';
  const REF = (SRC.match(/@([0-9a-f]{7,40}|main)\//) || [])[1] || 'locale';
  const MARKUP = `<header class="top"><div class="top-in">
  <div class="brand"><svg class="pulse" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 13h4l2.5-6 4 11 3-8 2 3H22"/></svg>Ritmo</div>
  <div class="stamp" id="stamp"></div>
</div></header>
<main id="main"></main>
<nav class="tabs" aria-label="Sezioni"><div class="tabs-in" id="tabs"><span class="tabpill" id="pill"></span></div></nav>`;
  const FONTS = 'https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap';
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

  'use strict';
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
  const median = a => { const v = a.filter(isNum).sort((x, y) => x - y); if (!v.length) return null; const m = v.length >> 1; return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2; };
  const sd = a => { const v = a.filter(isNum); if (v.length < 2) return null; const m = avg(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / (v.length - 1)); };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];
  const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
  const dayNum = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
  const fromDayNum = n => new Date(n * 86400000).toISOString().slice(0, 10);
  const addDays = (d, n) => fromDayNum(dayNum(d) + n);
  const dow = d => new Date(dayNum(d) * 86400000).getUTCDay();
  const dLabel = d => +d.slice(8, 10) + ' ' + MESI[+d.slice(5, 7) - 1];
  const dLabelY = d => dLabel(d) + ' ' + d.slice(0, 4);
  const hm = hrs => { if (!isNum(hrs)) return '-'; const m = Math.round(hrs * 60); return Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0'); };
  const clock = m => { let x = Math.round(m); x = ((x % 1440) + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
  const bedMin = s => { if (!/^\d{2}:\d{2}$/.test(s || '')) return null; const m = +s.slice(0, 2) * 60 + +s.slice(3, 5); return m >= 720 ? m - 1440 : m; };
  const absToDate = m => new Date(m * 60000);   // minuti "locali come UTC"
  const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raf2 = fn => requestAnimationFrame(() => requestAnimationFrame(fn));
  const countUp = (node, to, dec) => {
    if (!isNum(to) || reduced) { node.textContent = fmt(to, dec); return; }
    const t0 = performance.now(), dur = 900;
    const step = t => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); node.textContent = fmt(to * e, dec); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  };
  const ICON = {
    oggi: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    sonno: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    corpo: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9.5a3.5 3.5 0 0 1 6 0M12 9.5l1.2-1.6"/>',
    casa: '<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/>',
    analisi: '<path d="M4 19h16M7 15l3-4 3 2 4-6"/><circle cx="17" cy="7" r="1.3"/>',
    co2: '<path d="M4 15a4 4 0 0 1 4-4 5 5 0 0 1 9.6 1.5A3.5 3.5 0 0 1 17 19H8a4 4 0 0 1-4-4z"/>',
    temp: '<path d="M10 14V5a2 2 0 1 1 4 0v9a4 4 0 1 1-4 0z"/>',
    alert: '<path d="M12 8v5M12 16.5v.5"/><path d="M10.3 3.9L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
    clock: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
    up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>'
  };
  const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;

  // =========================================================================
  // Dati
  // =========================================================================
  const nights = (DATA.nights || []).slice();
  const byDate = {}; nights.forEach(n => { byDate[n.date] = n; });
  const gNights = nights.filter(n => isNum(n.score));
  const body = DATA.body || [];
  const L = DATA.last;
  nights.forEach((n, i) => {   // scarto dall'orario abituale (mediana delle 7 notti prima)
    const b = bedMin(n.bed_start); if (b === null) return;
    const prev = nights.slice(Math.max(0, i - 7), i).map(x => bedMin(x.bed_start)).filter(isNum);
    if (prev.length >= 4) n._irreg = Math.abs(b - median(prev));
  });
  const baseline = (date, k, days) => { const prev = nights.filter(n => n.date < date && isNum(n[k])).slice(-(days || 30)); return prev.length >= 7 ? median(prev.map(n => n[k])) : null; };

  // Punteggio di recupero: sonno, HRV e battito rispetto alla tua normalità, Body Battery al risveglio.
  const readiness = n => {
    if (!n || !isNum(n.score)) return null;
    const parts = [];
    parts.push({ k: 'Sonno', v: clamp(n.score, 0, 100), w: .35, d: 'sleep score ' + fmt(n.score) });
    const bh = baseline(n.date, 'hrv'); if (isNum(n.hrv) && bh) parts.push({ k: 'HRV', v: clamp(70 + 150 * (n.hrv / bh - 1), 0, 100), w: .25, d: fmt(n.hrv) + ' ms, normale ' + fmt(bh) });
    const br = baseline(n.date, 'rhr'); if (isNum(n.rhr) && br) parts.push({ k: 'FC a riposo', v: clamp(70 - 300 * (n.rhr / br - 1), 0, 100), w: .2, d: fmt(n.rhr) + ' bpm, normale ' + fmt(br) });
    if (isNum(n.bb_wake)) parts.push({ k: 'Body Battery', v: clamp(n.bb_wake, 0, 100), w: .2, d: 'al risveglio ' + fmt(n.bb_wake) });
    const tw = parts.reduce((s, p) => s + p.w, 0);
    return { score: Math.round(parts.reduce((s, p) => s + p.v * p.w, 0) / tw), parts: parts };
  };
  const state = v => !isNum(v) ? '' : v >= 80 ? 'good' : v >= 60 ? 'warn' : 'bad';
  const co2State = v => !isNum(v) ? '' : v <= 800 ? 'good' : v <= 1000 ? 'warn' : 'bad';
  const tempState = v => !isNum(v) ? '' : (v >= 17 && v <= 20) ? 'good' : (v >= 16 && v <= 22) ? 'warn' : 'bad';
  const rhState = v => !isNum(v) ? '' : (v >= 40 && v <= 60) ? 'good' : (v >= 30 && v <= 70) ? 'warn' : 'bad';

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
    const FACTORS = [
      { id: 'bed', label: 'ora in cui ti addormenti', axis: 'ti addormenti alle', get: n => bedMin(n.bed_start), show: v => clock(v), when: 'Quando ti addormenti tardi', hiP: v => 'ti addormenti dalle ' + clock(v) + ' in poi', loP: v => 'ti addormenti entro le ' + clock(v) },
      { id: 'irreg', label: 'scarto dal tuo orario', axis: 'minuti fuori orario', get: n => n._irreg, show: v => fmt(v) + ' min', when: 'Quando cambi orario', hiP: v => 'ti addormenti almeno ' + fmt(v) + ' minuti fuori dal tuo orario solito', loP: v => 'resti entro ' + fmt(v) + ' minuti dal tuo orario' },
      { id: 'steps', label: 'passi del giorno prima', axis: 'passi del giorno prima', get: n => { const p = prevDay(n); return p && isNum(p.steps) ? p.steps : null; }, show: v => fmt(v), when: 'Dopo giornate più attive', hiP: v => 'il giorno prima fai almeno ' + fmt(v) + ' passi', loP: v => 'ne fai al massimo ' + fmt(v) },
      { id: 'stress', label: 'stress del giorno prima', axis: 'stress del giorno prima', get: n => { const p = prevDay(n); return p && isNum(p.stress) ? p.stress : null; }, show: v => fmt(v), when: 'Dopo giornate più stressanti', hiP: v => 'lo stress medio del giorno prima è almeno ' + fmt(v), loP: v => 'è al massimo ' + fmt(v) },
      { id: 'co2', label: 'CO2 media in camera', axis: 'CO2 media (ppm)', get: n => n.air ? n.air.co2_avg : null, show: v => fmt(v) + ' ppm', room: true, when: 'Con più CO2 in camera', hiP: v => 'la CO2 media della notte è almeno ' + fmt(v) + ' ppm', loP: v => 'è al massimo ' + fmt(v) + ' ppm' },
      { id: 'temp', label: 'temperatura della camera', axis: 'temperatura camera (°C)', get: n => n.air ? n.air.temp_avg : null, show: v => fmt(v, 1) + ' °C', room: true, when: 'Con la camera più calda', hiP: v => 'la camera è almeno a ' + fmt(v, 1) + ' °C', loP: v => 'è al massimo a ' + fmt(v, 1) + ' °C' },
      { id: 'rh', label: 'umidità della camera', axis: 'umidità camera (%)', get: n => n.air ? n.air.rh_avg : null, show: v => fmt(v) + ' %', room: true, when: 'Con aria più umida', hiP: v => 'l\'umidità è almeno al ' + fmt(v) + ' %', loP: v => 'è al massimo al ' + fmt(v) + ' %' },
      { id: 'weekend', label: 'notti del weekend', get: n => { const w = dow(n.date); return w === 6 || w === 0 ? 1 : 0; }, binary: true, hiName: 'weekend', loName: 'in settimana', when: 'Nel weekend' }
    ];
    const OUTCOMES = [
      { id: 'score', label: 'sleep score', the: 'lo sleep score', get: n => n.score, dec: 0, unit: '', better: 1 },
      { id: 'hrv', label: 'HRV notturna', the: "l'HRV notturna", get: n => n.hrv, dec: 0, unit: ' ms', better: 1 },
      { id: 'rhr', label: 'battito a riposo', the: 'il battito a riposo', get: n => n.rhr, dec: 0, unit: ' bpm', better: -1 },
      { id: 'bb', label: 'Body Battery al risveglio', the: 'il Body Battery al risveglio', get: n => n.bb_wake, dec: 0, unit: '', better: 1 },
      { id: 'deep', label: 'sonno profondo', the: 'il sonno profondo', get: n => n.deep, dec: 0, unit: ' min', better: 1 }
    ];
    const MIN_N = 12, IT = 1500, tests = [], learning = [];
    FACTORS.forEach(f => OUTCOMES.forEach(o => {
      const pairs = nights.map(n => [f.get(n), o.get(n), n.date]).filter(p => isNum(p[0]) && isNum(p[1]));
      if (pairs.length < MIN_N) { if (f.room && o.id === 'score') learning.push({ f: f, n: pairs.length }); return; }
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
      .filter(t => (per[t.f.id] = (per[t.f.id] || 0) + 1) <= 2).slice(0, 8);
    const trends = [];
    OUTCOMES.concat([{ id: 'sleep_h', label: 'ore di sonno', get: n => n.sleep_h, dec: 1, unit: ' h', better: 1 }]).forEach(o => {
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

  // Note sulla notte: soglie dell'aria e valori insoliti rispetto alla tua normalità.
  const nightNotes = n => {
    const out = []; if (!n) return out;
    const A = n.air;
    if (A && A.over1000_min >= 60) out.push({ s: 'bad', i: 'co2', t: `CO2 <strong>sopra 1000 ppm per ${hm(A.over1000_min / 60)}</strong>, picco di <span class="num">${fmt(A.co2_max)}</span> ppm alle ${esc(A.co2_max_at)}.`, tip: 'Lascia la porta o la finestra socchiusa e confronta la notte dopo.' });
    if (A && A.temp_avg > 20.5) out.push({ s: 'warn', i: 'temp', t: `Camera a <span class="num">${fmt(A.temp_avg, 1)}</span> °C, sopra l'ideale per dormire (17-20 °C).`, tip: A.temp_avg > 21.5 ? 'Uno o due gradi in meno di notte aiutano il sonno profondo.' : '' });
    if (isNum(n.score)) {
      const base = nights.filter(x => x.date < n.date).slice(-60);
      [{ k: 'resp', l: 'respirazione nel sonno', u: ' resp/min', b: 0 }, { k: 'hr', l: 'battito nel sonno', u: ' bpm', b: -1 }, { k: 'rhr', l: 'battito a riposo', u: ' bpm', b: -1 },
       { k: 'hrv', l: 'HRV', u: ' ms', b: 1 }, { k: 'awake', l: 'minuti svegli', u: ' min', b: -1 }].forEach(m => {
        const v = n[m.k], vals = base.map(x => x[m.k]).filter(isNum);
        if (!isNum(v) || vals.length < 20) return;
        const med = median(vals), mad = median(vals.map(x => Math.abs(x - med))) * 1.4826; if (!mad) return;
        const z = (v - med) / mad; if (Math.abs(z) < 2.5) return;
        const worse = m.b === 0 || (m.b > 0 ? z < 0 : z > 0);
        out.push({ s: worse ? 'warn' : 'good', i: 'alert', t: `Insolito: ${m.l} <span class="num">${fmt(v)}</span>${m.u}, ${z > 0 ? 'molto sopra' : 'molto sotto'} i tuoi soliti ${fmt(med)}.`,
          tip: worse && /resp|hr|rhr/.test(m.k) ? 'Succede con alcol, pasti tardi, allenamenti intensi o un inizio di malanno.' : '' });
      });
    }
    return out;
  };
  const noteHTML = n => `<div class="note ${n.s}"><span class="nicon">${icon(n.i)}</span><div><p>${n.t}</p>${n.tip ? '<p class="tip">' + n.tip + '</p>' : ''}</div></div>`;

  // =========================================================================
  // Componenti grafici
  // =========================================================================
  const W = 360;
  // Grafico a linee interattivo: scorri col dito per leggere, tocca per scegliere.
  function lineChart(host, o) {
    const H = o.h || 190, PL = o.pl || 34, PR = 10, PT = 14, PB = 22;
    const wrap = h('div', 'chart'); host.appendChild(wrap);
    const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': o.aria || 'grafico' }, wrap);
    const tip = h('div', 'ctip'); wrap.appendChild(tip);
    const all = o.series.reduce((a, s) => a.concat(s.data), []);
    if (!all.length) { wrap.innerHTML = '<p class="empty">Nessun dato in questo periodo.</p>'; return; }
    const xs = all.map(p => p[0]), ys = all.map(p => p[1]).filter(isNum);
    let x0 = isNum(o.xMin) ? o.xMin : Math.min.apply(null, xs), x1 = isNum(o.xMax) ? o.xMax : Math.max.apply(null, xs);
    if (x1 === x0) { x0 -= 1; x1 += 1; }
    let y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    if (isNum(o.yMin)) y0 = Math.min(y0, o.yMin); if (isNum(o.yMax)) y1 = Math.max(y1, o.yMax);
    const pad = (y1 - y0) * .12 || 1; y0 -= pad; y1 += pad;
    if (isNum(o.yFloor)) y0 = Math.max(y0, o.yFloor);
    const X = v => PL + (v - x0) / (x1 - x0) * (W - PL - PR), Y = v => H - PB - (v - y0) / (y1 - y0) * (H - PT - PB);
    const defs = svgEl('defs', {}, svg);
    (o.bands || []).forEach(b => { const a = Math.max(y0, b[0]), c = Math.min(y1, b[1]); if (c > a) svgEl('rect', { x: PL, y: Y(c), width: W - PL - PR, height: Y(a) - Y(c), fill: b[2] }, svg); });
    const step = niceStep((y1 - y0) / 4);
    for (let v = Math.ceil(y0 / step) * step; v <= y1; v += step) {
      svgEl('line', { x1: PL, x2: W - PR, y1: Y(v), y2: Y(v), stroke: 'var(--line)', 'stroke-width': .6 }, svg);
      const tx = svgEl('text', { x: PL - 5, y: Y(v) + 3, 'text-anchor': 'end' }, svg); tx.textContent = o.yFmt ? o.yFmt(v) : fmt(v, step < 1 ? 1 : 0);
    }
    (o.hlines || []).forEach(l => { if (l[0] >= y0 && l[0] <= y1) svgEl('line', { x1: PL, x2: W - PR, y1: Y(l[0]), y2: Y(l[0]), stroke: l[1], 'stroke-width': .8, 'stroke-dasharray': '3 3' }, svg); });
    (o.xTicks ? o.xTicks(x0, x1) : []).forEach(t => { const tx = svgEl('text', { x: X(t[0]), y: H - 6, 'text-anchor': 'middle' }, svg); tx.textContent = t[1]; });
    (o.boxes || []).forEach(b => { const a = Math.max(x0, b[0]), c = Math.min(x1, b[1]); if (c > a) { svgEl('rect', { x: X(a), y: PT, width: X(c) - X(a), height: H - PT - PB, fill: 'none', stroke: 'var(--faint)', 'stroke-dasharray': '2 3', 'stroke-width': .7, rx: 4 }, svg);
      if (b[2]) { const tx = svgEl('text', { x: X(a) + 4, y: PT + 10 }, svg); tx.textContent = b[2]; } } });
    const draws = [];
    o.series.forEach((s, si) => {
      const d = s.data.filter(p => isNum(p[1])); if (!d.length) return;
      const path = d.map((p, i) => (i && !(s.gap && p[0] - d[i - 1][0] > s.gap) ? 'L' : 'M') + X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ');
      if (s.area) {
        const gid = 'g' + Math.random().toString(36).slice(2, 8);
        const gr = svgEl('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
        svgEl('stop', { offset: 0, 'stop-color': s.color, 'stop-opacity': .38 }, gr); svgEl('stop', { offset: 1, 'stop-color': s.color, 'stop-opacity': 0 }, gr);
        svgEl('path', { class: 'fade', d: path + ` L${X(d[d.length - 1][0]).toFixed(1)},${H - PB} L${X(d[0][0]).toFixed(1)},${H - PB} Z`, fill: `url(#${gid})` }, svg);
      }
      if (s.dots) d.forEach(p => svgEl('circle', { class: 'fade', cx: X(p[0]), cy: Y(p[1]), r: s.dots, fill: s.dotColor || s.color, 'fill-opacity': s.dotOpacity || 1 }, svg));
      if (s.line !== false) draws.push(svgEl('path', { class: 'draw', d: path, fill: 'none', stroke: s.color, 'stroke-width': s.w || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round', 'stroke-dasharray': s.dash || '' , opacity: s.opacity || 1 }, svg));
    });
    if (o.mark) { const m = o.mark; svgEl('circle', { cx: X(m[0]), cy: Y(m[1]), r: 7, fill: m[2] || 'var(--accent)', 'fill-opacity': .22 }, svg); svgEl('circle', { cx: X(m[0]), cy: Y(m[1]), r: 3.4, fill: m[2] || 'var(--accent)', stroke: 'var(--surface)', 'stroke-width': 1.5 }, svg); }
    // cursore
    const cur = svgEl('g', { class: 'cursor' }, svg);
    const cl = svgEl('line', { y1: PT, y2: H - PB, stroke: 'var(--muted)', 'stroke-width': .8 }, cur);
    const dots = o.series.map(s => svgEl('circle', { r: 4, fill: s.color, stroke: 'var(--surface)', 'stroke-width': 2 }, cur));
    // animazione di disegno
    if (!reduced) draws.forEach(p => { const len = p.getTotalLength ? p.getTotalLength() : 0; if (len) { p.style.strokeDasharray = p.getAttribute('stroke-dasharray') || len; if (!p.getAttribute('stroke-dasharray')) { p.style.strokeDasharray = len; p.style.strokeDashoffset = len; } } });
    raf2(() => { wrap.classList.add('on'); draws.forEach(p => { p.style.strokeDashoffset = 0; }); });
    // interazione
    const main = o.series[o.pickSeries || 0].data.filter(p => isNum(p[1]));
    let startX = null, moved = false, active = null;
    const pickAt = clientX => {
      const r = svg.getBoundingClientRect(), vx = (clientX - r.left) / r.width * W;
      let best = null, bd = Infinity; main.forEach(p => { const dd = Math.abs(X(p[0]) - vx); if (dd < bd) { bd = dd; best = p; } });
      return best;
    };
    const show = p => {
      if (!p) return; active = p;
      cl.setAttribute('x1', X(p[0])); cl.setAttribute('x2', X(p[0]));
      o.series.forEach((s, i) => { const q = s.data.find(z => z[0] === p[0]) || (i === (o.pickSeries || 0) ? p : null);
        if (q && isNum(q[1])) { dots[i].setAttribute('cx', X(q[0])); dots[i].setAttribute('cy', Y(q[1])); dots[i].style.display = ''; } else dots[i].style.display = 'none'; });
      tip.innerHTML = o.tip(p);
      const r = svg.getBoundingClientRect(), px = X(p[0]) / W * r.width;
      tip.style.left = clamp(px, 60, r.width - 60) + 'px';
      wrap.classList.add('scrub');
    };
    wrap.addEventListener('pointerdown', e => { startX = e.clientX; moved = false; show(pickAt(e.clientX)); });
    wrap.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' || startX !== null) { if (startX !== null && Math.abs(e.clientX - startX) > 6) moved = true; show(pickAt(e.clientX)); } });
    const end = e => { if (startX !== null && !moved && o.onPick && active) o.onPick(active); startX = null; if (e.pointerType !== 'mouse') setTimeout(() => wrap.classList.remove('scrub'), 1400); };
    wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', () => { startX = null; wrap.classList.remove('scrub'); });
    wrap.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') wrap.classList.remove('scrub'); });
    return wrap;
  }
  function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p; }
  // Etichette dell'asse per date (x = numero del giorno).
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

  // Anello animato.
  const ringHTML = (v, label, cls) => {
    const st = state(v), C = 2 * Math.PI * 50;
    return `<div class="ring ${cls || ''}" role="img" aria-label="${label} ${isNum(v) ? v : 'non disponibile'}">
      <svg viewBox="0 0 120 120"><defs><linearGradient id="rg${cls || ''}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent-2)"/><stop offset="1" stop-color="var(--accent)"/></linearGradient></defs>
      <circle cx="60" cy="60" r="50" fill="none" stroke="var(--surface-3)" stroke-width="10"/>
      <circle class="arc" cx="60" cy="60" r="50" fill="none" stroke="${st === 'bad' ? 'var(--bad)' : st === 'warn' ? 'var(--warn)' : `url(#rg${cls || ''})`}" stroke-width="10" stroke-linecap="round"
        stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="${C.toFixed(2)}" data-to="${(C * (1 - (isNum(v) ? clamp(v, 0, 100) : 0) / 100)).toFixed(2)}" transform="rotate(-90 60 60)"/></svg>
      <div class="center"><span class="n" data-count="${isNum(v) ? v : ''}">${isNum(v) ? '0' : '-'}</span><span class="l">${label}</span></div></div>`;
  };
  const animate = root => {
    raf2(() => {
      root.querySelectorAll('.arc[data-to]').forEach(a => a.setAttribute('stroke-dashoffset', a.dataset.to));
      root.querySelectorAll('[data-count]').forEach(n => { if (n.dataset.count !== '') countUp(n, +n.dataset.count, +(n.dataset.dec || 0)); });
      root.querySelectorAll('[data-w]').forEach(n => { n.style.width = n.dataset.w; });
      root.querySelectorAll('[data-hgt]').forEach(n => { n.style.height = n.dataset.hgt; });
      root.querySelectorAll('[data-flex]').forEach(n => { n.style.flexGrow = n.dataset.flex; });
    });
  };
  const chips = (items, cur, onSel, cls) => {
    const box = h('div', cls || 'chips');
    items.forEach(it => { const b = h('button', cls === 'seg' ? '' : 'chip', it[1]); b.setAttribute('aria-pressed', String(it[0] === cur)); b.onclick = () => onSel(it[0]); box.appendChild(b); });
    return box;
  };
  const stat = (k, v, unit, sub, st) => `<div class="stat"><span class="k">${k}</span><span class="v">${v}${unit ? '<small>' + unit + '</small>' : ''}</span><span class="s ${st || ''}"><i class="dot ${st || ''}"></i>${sub}</span></div>`;

  // =========================================================================
  // Navigazione
  // =========================================================================
  const TABS = [['oggi', 'Oggi'], ['sonno', 'Sonno'], ['corpo', 'Corpo'], ['casa', 'Casa'], ['analisi', 'Analisi']];
  const S = { tab: 'oggi', night: L ? L.date : null, sMetric: 'score', sPeriod: 30, cMetric: 'w', cPeriod: 365, hMetric: 'co2', hPeriod: 1, nMode: 'co2', aFilter: 'all' };
  try { const saved = JSON.parse(localStorage.getItem('ritmo') || '{}'); ['sMetric', 'sPeriod', 'cMetric', 'cPeriod', 'hMetric', 'hPeriod', 'aFilter'].forEach(k => { if (saved[k] !== undefined) S[k] = saved[k]; }); } catch (e) {}
  const save = () => { try { localStorage.setItem('ritmo', JSON.stringify(S)); } catch (e) {} };
  const tabsEl = $('#tabs'), pill = $('#pill'), main = $('#main');
  TABS.forEach(([id, label], i) => {
    const b = h('button', 'tab', icon(id) + '<span>' + label + '</span>'); b.dataset.id = id;
    b.onclick = () => go(id); tabsEl.appendChild(b);
  });
  const go = (id, opts) => {
    if (opts && opts.night) S.night = opts.night;
    S.tab = id; save();
    try { if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id); } catch (e) {}
    const i = TABS.findIndex(t => t[0] === id);
    pill.style.left = `calc(${i * 20}% + 8px)`;
    tabsEl.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-current', b.dataset.id === id ? 'page' : 'false'));
    render();
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  };
  const render = () => {
    main.innerHTML = '';
    const v = h('div', 'view'); main.appendChild(v);
    ({ oggi: viewOggi, sonno: viewSonno, corpo: viewCorpo, casa: viewCasa, analisi: viewAnalisi })[S.tab](v);
    v.appendChild(h('p', 'foot', `Ritmo · versione ${esc(REF === 'main' || REF === 'locale' ? REF : REF.slice(0, 7))} · ${RELEASE}`));
    animate(v);
  };
  const rerender = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };
  $('#stamp').innerHTML = `<i class="live"></i>aggiornato alle ${esc((DATA.now || '').slice(11, 16))}`;

  // =========================================================================
  // OGGI
  // =========================================================================
  function viewOggi(v) {
    if (!L) { v.appendChild(h('p', 'empty', 'Il foglio non ha ancora dati da mostrare.')); return; }
    const R = readiness(L);
    const lastG = isNum(L.score) ? L : gNights[gNights.length - 1];
    const R2 = R || readiness(lastG);
    const title = !R2 ? 'Dati del sonno in arrivo' : R2.score >= 80 ? 'Pronto per la giornata' : R2.score >= 65 ? 'Recupero discreto' : R2.score >= 50 ? 'Vai con calma oggi' : 'Giornata di recupero';
    const advice = !R2 ? 'Garmin aggiorna i dati ogni mattina alle 10.' : R2.score >= 80 ? 'Corpo recuperato: buona giornata per carichi e impegni.' : R2.score >= 65 ? 'Recupero nella media: ascolta come ti senti.' : 'Il corpo chiede recupero: riposo, idratazione e un orario regolare stasera.';
    const hero = h('div', 'hero card');
    hero.innerHTML = `<div class="chead"><span class="eyebrow">${GIORNI[dow(L.date)]} ${dLabel(L.date)}</span><span class="eyebrow">recupero</span></div>
      <div class="hero-row">${ringHTML(R2 ? R2.score : null, 'recupero')}<div style="display:grid;gap:8px;min-width:0"><h2>${title}</h2><p class="muted small">${advice}</p></div></div>
      ${R2 ? '<div class="comp">' + R2.parts.map(p => `<div class="comprow"><span class="muted">${p.k}</span><div class="track"><i data-w="${p.v.toFixed(0)}%"></i></div><span class="v">${fmt(p.v)}</span></div>`).join('') + '</div><p class="hint">Sonno, HRV e battito confrontati con la tua normalità delle ultime 30 notti, più il Body Battery al risveglio.</p>' : ''}`;
    v.appendChild(hero);

    // trend del recupero
    const rs = gNights.slice(-30).map(n => { const r = readiness(n); return r ? [dayNum(n.date), r.score, n.date] : null; }).filter(Boolean);
    if (rs.length >= 5) {
      const c = h('div', 'card'); c.appendChild(h('div', 'chead', `<span class="eyebrow">Recupero, ultime 30 notti</span><span class="muted small">media ${fmt(avg(rs.map(p => p[1])))}</span>`));
      lineChart(c, { h: 120, series: [{ data: rs, color: 'var(--accent)', area: true, w: 2 }], yMin: 30, yMax: 100, bands: [[80, 101, 'var(--band-good)']], xTicks: dateTicks,
        tip: p => `${dLabel(p[2])} · recupero <b>${fmt(p[1])}</b>`, onPick: p => go('sonno', { night: p[2] }), aria: 'Recupero negli ultimi 30 giorni' });
      c.appendChild(h('p', 'hint', 'Scorri col dito per leggere i valori, tocca un giorno per aprire quella notte.'));
      v.appendChild(c);
    }

    const notes = nightNotes(L);
    const an = analysis();
    if (an.findings.length) { const t = an.findings[0]; notes.push({ s: 'info', i: 'spark', t: `<strong>Dai tuoi dati:</strong> ${esc(findingTitle(t).toLowerCase().replace(/^./, c => c.toUpperCase()))}.`, tip: esc(findingBody(t)) }); }
    if (notes.length) { const c = h('div', 'card', '<span class="eyebrow">Da sapere oggi</span>' + notes.slice(0, 4).map(noteHTML).join('')); v.appendChild(c); }

    // scorciatoie
    const g = h('div', 'grid2');
    const sc = h('div', 'card tap', `<div class="chead"><span class="eyebrow">Sonno</span><span class="chev">›</span></div>${isNum(L.score) ? `<div class="big"><span data-count="${L.score}">0</span><small>score</small></div><p class="muted small">${hm(L.sleep_h)} · a letto ${esc(L.bed_start || '-')}</p>` : '<p class="muted small">In arrivo alle 10</p>'}`);
    sc.onclick = () => go('sonno', { night: L.date }); g.appendChild(sc);
    const rm = DATA.room;
    const ca = h('div', 'card tap', `<div class="chead"><span class="eyebrow">Casa adesso</span><span class="chev">›</span></div>${rm ? `<div class="big ${co2State(rm.co2)}"><span data-count="${rm.co2}">0</span><small>ppm</small></div><p class="muted small">${fmt(rm.temp, 1)} °C · ${fmt(rm.rh)} % in camera</p>` : '<p class="muted small">Nessun dato</p>'}`);
    ca.onclick = () => go('casa'); g.appendChild(ca);
    v.appendChild(g);
    if (body.length) {
      const lb = body[body.length - 1], old = body.filter(b => b.date <= addDays(lb.date, -30)), o30 = old.length ? old[old.length - 1] : null;
      const dW = o30 ? lb.w - o30.w : null;
      const co = h('div', 'card tap', `<div class="chead"><span class="eyebrow">Corpo</span><span class="chev">›</span></div>
        <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div class="big"><span data-count="${lb.w}" data-dec="1">0</span><small>kg</small></div>${dW !== null ? `<span class="delta ${dW > 0 ? 'warn' : 'good'}">${dW > 0 ? '+' : ''}${fmt(dW, 1)} kg in 30 giorni</span>` : ''}</div>
        <p class="muted small">ultima pesata ${dLabelY(lb.date)} · grasso ${fmt(lb.fat, 1)} %</p>`);
      co.onclick = () => go('corpo'); v.appendChild(co);
    }
    v.appendChild(h('p', 'foot', 'Garmin ogni mattina alle 10 · Renpho alle 11 · casa ogni 10 minuti'));
  }

  // =========================================================================
  // SONNO
  // =========================================================================
  function viewSonno(v) {
    const list = nights.filter(n => isNum(n.score) || n.air);
    if (!list.length) { v.appendChild(h('p', 'empty', 'Nessuna notte ancora.')); return; }
    if (!S.night || !byDate[S.night]) S.night = list[list.length - 1].date;
    const idx = list.findIndex(n => n.date === S.night), n = list[idx];
    v.appendChild(h('div', 'vtitle', '<h1>Sonno</h1>'));

    // navigatore delle notti
    const card = h('div', 'card');
    const nav = h('div', 'nightnav');
    const prev = h('button', 'arr', '‹'), next = h('button', 'arr', '›');
    prev.setAttribute('aria-label', 'Notte precedente'); next.setAttribute('aria-label', 'Notte successiva');
    prev.disabled = idx <= 0; next.disabled = idx >= list.length - 1;
    prev.onclick = () => { S.night = list[idx - 1].date; rerender(); }; next.onclick = () => { S.night = list[idx + 1].date; rerender(); };
    nav.appendChild(prev);
    nav.appendChild(h('div', 'when', `<b>${GIORNI[dow(n.date)].replace(/^./, c => c.toUpperCase())} ${dLabel(n.date)}</b><span class="muted small">${idx === list.length - 1 ? 'ultima notte' : (list.length - 1 - idx) + (list.length - 1 - idx === 1 ? ' notte fa' : ' notti fa')}</span>`));
    nav.appendChild(next); card.appendChild(nav);
    let sx = null; card.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
    card.addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 60) { if (dx > 0 && idx > 0) prev.onclick(); else if (dx < 0 && idx < list.length - 1) next.onclick(); } }, { passive: true });

    if (isNum(n.score)) {
      const hr = h('div', 'hero-row');
      hr.innerHTML = ringHTML(n.score, 'sleep score', 'sm') + `<div style="display:grid;gap:4px;min-width:0"><div class="big" style="font-size:2rem">${hm(n.sleep_h)}</div>
        <p class="muted small">addormentato ${esc(n.bed_start || '-')} · sveglia ${esc(n.bed_end || '-')}</p>
        <p class="small">${n.awake_count ? n.awake_count + (n.awake_count === 1 ? ' risveglio' : ' risvegli') : 'nessun risveglio'}${isNum(n.resp) ? ' · respiro ' + fmt(n.resp) : ''}${isNum(n.spo2) ? ' · SpO2 ' + fmt(n.spo2) + ' %' : ''}</p></div>`;
      card.appendChild(hr);
      const st = [['deep', 'Profondo', '--st-deep'], ['light', 'Leggero', '--st-light'], ['rem', 'REM', '--st-rem'], ['awake', 'Sveglio', '--st-awake']];
      card.appendChild(h('div', 'stages', st.filter(k => n[k[0]] > 0).map(k => `<i data-flex="${n[k[0]]}" style="background:var(${k[2]})"></i>`).join('')));
      card.appendChild(h('div', 'slist', st.map(k => { const b = baseline(n.date, k[0]); return `<div><span class="muted"><i class="dot" style="background:var(${k[2]})"></i> ${k[1]}</span><b>${fmt(n[k[0]])}′</b><span class="muted">${b !== null ? 'solito ' + fmt(b) + '′' : ''}</span></div>`; }).join('')));
      const R = readiness(n);
      card.appendChild(h('div', 'grid3', stat('HRV', fmt(n.hrv), 'ms', n.hrv_status === 'BALANCED' ? 'equilibrata' : n.hrv_status === 'LOW' ? 'bassa' : n.hrv_status ? 'sbilanciata' : '', n.hrv_status === 'BALANCED' ? 'good' : n.hrv_status === 'LOW' ? 'bad' : 'warn')
        + stat('Riposo', fmt(n.rhr), 'bpm', 'normale ' + fmt(baseline(n.date, 'rhr')), '') + stat('Recupero', R ? fmt(R.score) : '-', '', 'Body Battery ' + fmt(n.bb_wake), R ? state(R.score) : '')));
    } else card.appendChild(h('p', 'empty', 'Dati Garmin non ancora arrivati per questa notte (aggiornamento alle 10).'));
    v.appendChild(card);

    const notes = nightNotes(n);
    if (notes.length) v.appendChild(h('div', 'card', notes.map(noteHTML).join('')));

    // la notte in un grafico
    const ns = (DATA.nightSeries || {})[n.date];
    if (ns && ns.pts.length >= 6) {
      const c = h('div', 'card');
      c.appendChild(h('div', 'chead', '<span class="eyebrow">Aria della camera durante la notte</span>'));
      c.appendChild(chips([['co2', 'CO2'], ['temp', 'Temperatura']], S.nMode, k => { S.nMode = k; rerender(); }, 'seg'));
      const A = n.air;
      if (S.nMode === 'co2') lineChart(c, { h: 190, series: [{ data: ns.pts.map(p => [p[0], p[1]]), color: 'var(--accent)', area: true }], yMin: 400, yMax: Math.max(1100, A ? A.co2_max : 0),
        bands: [[800, 1000, 'var(--band-warn)'], [1000, 5000, 'var(--band-bad)']], hlines: [[1000, 'var(--bad)']], xTicks: nightTicks, xMin: 0, xMax: 720, boxes: [[ns.win[0], ns.win[1], 'a letto']],
        tip: p => `${clock(p[0] + 1320)} · <b>${fmt(p[1])}</b> ppm`, aria: 'CO2 durante la notte' });
      else lineChart(c, { h: 160, series: [{ data: ns.pts.map(p => [p[0], p[2]]), color: 'var(--accent-2)', area: true }], yMin: 17, yMax: 23, bands: [[17, 20, 'var(--band-good)']], xTicks: nightTicks, xMin: 0, xMax: 720,
        boxes: [[ns.win[0], ns.win[1], 'a letto']], yFmt: v => fmt(v, 0), tip: p => `${clock(p[0] + 1320)} · <b>${fmt(p[1], 1)}</b> °C`, aria: 'Temperatura durante la notte' });
      if (A) c.appendChild(h('div', 'grid3', stat('CO2 media', fmt(A.co2_avg), 'ppm', A.over1000_min ? hm(A.over1000_min / 60) + ' sopra 1000' : 'mai sopra 1000', co2State(A.co2_avg)) + stat('Massima', fmt(A.co2_max), 'ppm', 'alle ' + esc(A.co2_max_at), co2State(A.co2_max)) + stat('Camera', fmt(A.temp_avg, 1), '°C', fmt(A.rh_avg) + ' % umidità', tempState(A.temp_avg))));
      v.appendChild(c);
    }

    // andamento con metrica e periodo
    const M = { score: ['Score', n2 => n2.score, 0, ''], sleep_h: ['Durata', n2 => n2.sleep_h, 1, 'h'], hrv: ['HRV', n2 => n2.hrv, 0, 'ms'], rhr: ['FC riposo', n2 => n2.rhr, 0, 'bpm'],
      bb_wake: ['Body Battery', n2 => n2.bb_wake, 0, ''], deep: ['Profondo', n2 => n2.deep, 0, 'min'], bed: ['A letto', n2 => bedMin(n2.bed_start), 0, ''], ready: ['Recupero', n2 => { const r = readiness(n2); return r ? r.score : null; }, 0, ''] };
    if (!M[S.sMetric]) S.sMetric = 'score';
    const c2 = h('div', 'card');
    c2.appendChild(h('div', 'chead', '<span class="eyebrow">Andamento</span>'));
    c2.appendChild(chips(Object.keys(M).map(k => [k, M[k][0]]), S.sMetric, k => { S.sMetric = k; save(); rerender(); }));
    c2.appendChild(chips([[7, '7 g'], [30, '30 g'], [90, '90 g'], [9999, 'Tutto']], S.sPeriod, k => { S.sPeriod = k; save(); rerender(); }, 'seg'));
    const m = M[S.sMetric], lastDay = dayNum(gNights.length ? gNights[gNights.length - 1].date : n.date);
    const pts = gNights.filter(x => dayNum(x.date) > lastDay - S.sPeriod).map(x => [dayNum(x.date), m[1](x), x.date]).filter(p => isNum(p[1]));
    if (pts.length) {
      const vals = pts.map(p => p[1]), mean = avg(vals);
      const roll = pts.map((p, i) => [p[0], avg(pts.slice(Math.max(0, i - 6), i + 1).map(q => q[1]))]);
      const isBed = S.sMetric === 'bed';
      const head = h('div', '', `<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div class="big" style="font-size:2rem">${isBed ? clock(mean) : fmt(mean, m[2])}<small>${m[3]}</small></div><span class="muted small">media del periodo · ${pts.length} notti</span></div>`);
      c2.appendChild(head);
      const sel = pts.find(p => p[2] === n.date);
      lineChart(c2, { h: 200, series: [{ data: pts, color: 'var(--accent)', line: false, dots: pts.length > 60 ? 2 : 3, dotOpacity: .55 }, { data: roll, color: 'var(--accent)', w: 2.2, area: !isBed }],
        hlines: [[mean, 'var(--faint)']], xTicks: dateTicks, yFmt: isBed ? (v2 => clock(v2)) : null, mark: sel ? [sel[0], sel[1], 'var(--accent-2)'] : null,
        tip: p => `${dLabel(p[2])} · <b>${isBed ? clock(p[1]) : fmt(p[1], m[2])}</b> ${m[3]}`, onPick: p => { S.night = p[2]; rerender(); window.scrollTo({ top: 0, behavior: 'smooth' }); }, aria: 'Andamento ' + m[0] });
      c2.appendChild(h('div', 'legend', '<span><i class="sw" style="background:var(--accent);height:8px;width:8px;border-radius:50%;opacity:.55"></i>singole notti</span><span><i class="sw" style="background:var(--accent)"></i>media su 7 notti</span><span><i class="sw" style="background:var(--faint)"></i>media del periodo</span>'));
    } else c2.appendChild(h('p', 'empty', 'Nessun dato in questo periodo.'));
    v.appendChild(c2);

    // calendario
    const c3 = h('div', 'card');
    c3.appendChild(h('div', 'chead', '<span class="eyebrow">Calendario dello sleep score</span><span class="muted small">ultime 13 settimane</span>'));
    const cal = h('div', 'cal');
    const end = dayNum(gNights.length ? gNights[gNights.length - 1].date : n.date), endDow = (dow(fromDayNum(end)) + 6) % 7;
    const start = end - endDow - 7 * 12;
    const col = s => !isNum(s) ? 'var(--surface-2)' : s >= 85 ? 'var(--good)' : s >= 75 ? 'color-mix(in srgb, var(--good) 60%, var(--warn))' : s >= 60 ? 'var(--warn)' : s >= 45 ? 'color-mix(in srgb, var(--warn) 50%, var(--bad))' : 'var(--bad)';
    for (let d = start; d <= end + (6 - endDow); d++) {
      const ds = fromDayNum(d), x = byDate[ds], b = h('button');
      if (d > end) { b.style.visibility = 'hidden'; cal.appendChild(b); continue; }
      b.style.background = col(x && x.score); b.setAttribute('aria-label', dLabel(ds) + (x && isNum(x.score) ? ', score ' + x.score : ', nessun dato'));
      if (ds === n.date) b.classList.add('sel');
      if (x && (isNum(x.score) || x.air)) b.onclick = () => { S.night = ds; rerender(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
      cal.appendChild(b);
    }
    c3.appendChild(cal);
    c3.appendChild(h('div', 'calscale', 'meno <i style="background:var(--bad)"></i><i style="background:color-mix(in srgb, var(--warn) 50%, var(--bad))"></i><i style="background:var(--warn)"></i><i style="background:color-mix(in srgb, var(--good) 60%, var(--warn))"></i><i style="background:var(--good)"></i> più · colonne = settimane, da lunedì'));
    v.appendChild(c3);
  }

  // =========================================================================
  // CORPO
  // =========================================================================
  function viewCorpo(v) {
    v.appendChild(h('div', 'vtitle', '<h1>Corpo</h1>'));
    if (!body.length) { v.appendChild(h('p', 'empty', 'Nessuna pesata ancora.')); return; }
    const M = { w: ['Peso', 'kg', 1, -1], fat: ['Grasso', '%', 1, -1], muscle: ['Muscoli', '%', 1, 1], water: ['Acqua', '%', 1, 1], bmi: ['BMI', '', 1, -1], visfat: ['Viscerale', '', 0, -1] };
    if (!M[S.cMetric]) S.cMetric = 'w';
    const m = M[S.cMetric], lb = body[body.length - 1], endD = dayNum(lb.date);
    const pts = body.filter(b => dayNum(b.date) > endD - S.cPeriod && isNum(b[S.cMetric])).map(b => [dayNum(b.date), b[S.cMetric], b.date]);
    const c = h('div', 'card');
    c.appendChild(chips(Object.keys(M).map(k => [k, M[k][0]]), S.cMetric, k => { S.cMetric = k; save(); rerender(); }));
    c.appendChild(chips([[90, '3 m'], [365, '1 a'], [1095, '3 a'], [99999, 'Tutto']], S.cPeriod, k => { S.cPeriod = k; save(); rerender(); }, 'seg'));
    if (pts.length) {
      const first = pts[0], last = pts[pts.length - 1], d = last[1] - first[1];
      const good = d * m[3] >= 0;
      c.appendChild(h('div', '', `<div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div class="big"><span data-count="${last[1]}" data-dec="${m[2]}">0</span><small>${m[1]}</small></div>
        ${pts.length > 1 ? `<span class="delta ${Math.abs(d) < .05 ? '' : good ? 'good' : 'warn'}">${d > 0 ? '+' : ''}${fmt(d, m[2])} ${m[1]} dal ${dLabelY(first[2])}</span>` : ''}</div>`));
      const roll = pts.map((p, i) => [p[0], avg(pts.slice(Math.max(0, i - 2), i + 3).map(q => q[1]))]);
      lineChart(c, { h: 210, series: [{ data: pts, color: 'var(--muted)', line: false, dots: pts.length > 80 ? 1.8 : 2.6, dotOpacity: .6 }, { data: roll, color: 'var(--accent)', area: true, w: 2.2 }],
        xTicks: dateTicks, tip: p => `${dLabelY(p[2])} · <b>${fmt(p[1], m[2])}</b> ${m[1]}`, aria: 'Andamento ' + m[0] });
      c.appendChild(h('p', 'hint', 'Linea: media delle pesate vicine, per leggere la tendenza sotto gli sbalzi della bilancia. Scorri per leggere ogni pesata.'));
    } else c.appendChild(h('p', 'empty', 'Nessuna pesata in questo periodo.'));
    v.appendChild(c);
    v.appendChild(h('div', 'grid2 grid4', stat('Peso', fmt(lb.w, 1), 'kg', 'BMI ' + fmt(lb.bmi, 1), '') + stat('Grasso', fmt(lb.fat, 1), '%', 'viscerale ' + fmt(lb.visfat), '') + stat('Muscoli', fmt(lb.muscle, 1), '%', 'ossa ' + fmt(lb.bone, 1) + ' kg', '') + stat('Acqua', fmt(lb.water, 1), '%', dLabelY(lb.date), '')));
    const an = analysis();
    if (an.weight) {
      const up = an.weight.perMonth > 0, flat = Math.abs(an.weight.perMonth) < .2;
      v.appendChild(h('div', 'card', noteHTML({ s: flat ? 'good' : up ? 'warn' : 'good', i: up ? 'up' : 'down', t: flat ? `<strong>Peso stabile</strong> negli ultimi 6 mesi.` : `<strong>Peso ${up ? 'in aumento' : 'in calo'}</strong> di circa <span class="num">${fmt(Math.abs(an.weight.perMonth), 1)}</span> kg al mese negli ultimi 6 mesi.`, tip: `Stima robusta agli sbalzi (Theil-Sen) su ${an.weight.n} pesate.` })));
    }
    const rec = body.slice(-8).reverse();
    const lc = h('div', 'card', '<span class="eyebrow">Ultime pesate</span>');
    const ls = h('div', 'list');
    rec.forEach((b, i) => { const p = body[body.length - 1 - i - 1]; const d = p ? b.w - p.w : null;
      ls.appendChild(h('div', 'row', `<span>${dLabelY(b.date)}</span><span class="num">${fmt(b.w, 1)} kg</span><span class="num small ${d === null ? 'muted' : d > 0 ? 'warn' : 'good'}">${d === null ? '' : (d > 0 ? '+' : '') + fmt(d, 1)}</span>`)); });
    lc.appendChild(ls); v.appendChild(lc);
  }

  // =========================================================================
  // CASA
  // =========================================================================
  function viewCasa(v) {
    v.appendChild(h('div', 'vtitle', `<h1>Casa</h1><span class="muted small">${DATA.room ? 'lettura delle ' + esc(DATA.room.ts.slice(11, 16)) : ''}</span>`));
    const rm = DATA.room, hb = DATA.hub;
    if (rm) {
      const c = h('div', 'card');
      c.appendChild(h('div', 'chead', '<span class="eyebrow">Camera da letto</span>' + (isNum(rm.bat) ? `<span class="muted small">batteria ${fmt(rm.bat)} %</span>` : '')));
      c.appendChild(h('div', 'hero-row', `<div><div class="big ${co2State(rm.co2)}"><span data-count="${rm.co2}">0</span><small>ppm CO2</small></div><p class="muted small">${rm.co2 <= 800 ? 'Aria buona' : rm.co2 <= 1000 ? 'Aria discreta' : 'Da ventilare'}</p></div><div></div>`));
      c.appendChild(h('div', 'grid2', stat('Temperatura', fmt(rm.temp, 1), '°C', 'per dormire 17-20', tempState(rm.temp)) + stat('Umidità', fmt(rm.rh), '%', 'ideale 40-60', rhState(rm.rh))));
      v.appendChild(c);
    }
    if (hb) v.appendChild(h('div', 'card', `<span class="eyebrow">Seconda stanza</span><div class="grid2">${stat('Temperatura', fmt(hb.temp, 1), '°C', 'Hub 2', '')}${stat('Umidità', fmt(hb.rh), '%', 'luce ' + fmt(hb.light) + '/20', rhState(hb.rh))}</div>`));

    const rec = DATA.recent || [];
    if (rec.length) {
      const c = h('div', 'card');
      c.appendChild(h('div', 'chead', '<span class="eyebrow">Storico recente</span>'));
      c.appendChild(chips([['co2', 'CO2'], ['temp', 'Temperatura'], ['rh', 'Umidità']], S.hMetric, k => { S.hMetric = k; save(); rerender(); }));
      c.appendChild(chips([[1, '24 h'], [3, '3 g'], [7, '7 g']], S.hPeriod, k => { S.hPeriod = k; save(); rerender(); }, 'seg'));
      const lastT = rec[rec.length - 1][0], from = lastT - S.hPeriod * 1440;
      const r = rec.filter(p => p[0] >= from);
      const col = { co2: 1, temp: 2, rh: 3 }[S.hMetric], hcol = { temp: 4, rh: 5 }[S.hMetric];
      const unit = { co2: 'ppm', temp: '°C', rh: '%' }[S.hMetric], dec = S.hMetric === 'temp' ? 1 : 0;
      const ticks = (a, b) => { const out = []; const stepH = S.hPeriod === 1 ? 6 : S.hPeriod === 3 ? 12 : 24;
        for (let m2 = Math.ceil(a / (stepH * 60)) * stepH * 60; m2 <= b; m2 += stepH * 60) { const dt = absToDate(m2); out.push([m2, stepH >= 24 || dt.getUTCHours() === 0 ? dt.getUTCDate() + ' ' + MESI[dt.getUTCMonth()] : String(dt.getUTCHours()).padStart(2, '0') + ':00']); } return out; };
      const series = [{ data: r.map(p => [p[0], p[col]]), color: S.hMetric === 'co2' ? 'var(--accent)' : 'var(--accent-2)', area: true, gap: 40 }];
      if (hcol) series.push({ data: r.map(p => [p[0], p[hcol]]), color: 'var(--accent-3)', w: 1.6, gap: 40, dash: '4 3' });
      const bands = S.hMetric === 'co2' ? [[800, 1000, 'var(--band-warn)'], [1000, 9999, 'var(--band-bad)']] : S.hMetric === 'temp' ? [[17, 20, 'var(--band-good)']] : [[40, 60, 'var(--band-good)']];
      lineChart(c, { h: 200, series: series, bands: bands, xTicks: ticks, tip: p => { const dt = absToDate(p[0]); const hp = hcol ? r.find(q => q[0] === p[0]) : null;
        return `${dt.getUTCDate()} ${MESI[dt.getUTCMonth()]} ${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')} · <b>${fmt(p[1], dec)}</b> ${unit}${hp && isNum(hp[hcol]) ? ' · altra stanza <b>' + fmt(hp[hcol], dec) + '</b>' : ''}`; }, aria: 'Storico ' + unit });
      if (hcol) c.appendChild(h('div', 'legend', '<span><i class="sw" style="background:var(--accent-2)"></i>camera</span><span><i class="sw" style="background:var(--accent-3)"></i>seconda stanza</span>'));
      v.appendChild(c);
    }
    const an = nights.filter(n => n.air);
    if (an.length) {
      const c = h('div', 'card');
      c.appendChild(h('div', 'chead', `<span class="eyebrow">CO2 media per notte</span><span class="muted small">${an.length} ${an.length === 1 ? 'notte' : 'notti'}</span>`));
      const box = h('div', 'bars'); box.style.gridTemplateColumns = `repeat(${Math.min(an.length, 14)}, minmax(0, 1fr))`;
      const sl = an.slice(-14), mx = Math.max(1200, Math.max.apply(null, sl.map(n => n.air.co2_max)));
      sl.forEach(n => { const b = h('button', 'bar', `<span class="v small">${fmt(n.air.co2_avg)}</span><div class="col"><div class="fill" data-hgt="${(100 * n.air.co2_avg / mx).toFixed(0)}%" style="background:var(--${co2State(n.air.co2_avg)})"></div></div><span class="k">${dLabel(n.date)}</span>`);
        b.onclick = () => go('sonno', { night: n.date }); box.appendChild(b); });
      c.appendChild(box);
      c.appendChild(h('p', 'hint', 'Tocca una notte per aprirla nella sezione Sonno.'));
      v.appendChild(c);
    }
  }

  // =========================================================================
  // ANALISI
  // =========================================================================
  function viewAnalisi(v) {
    const an = analysis();
    v.appendChild(h('div', 'vtitle', `<h1>Analisi</h1><span class="muted small">${gNights.length} notti · ${an.tested} confronti</span>`));
    const F = [['all', 'Tutto'], ['score', 'Sleep score'], ['hrv', 'HRV'], ['rhr', 'Battito'], ['bb', 'Body Battery'], ['deep', 'Profondo']];
    v.appendChild(chips(F, S.aFilter, k => { S.aFilter = k; save(); rerender(); }));
    const list = an.findings.filter(t => S.aFilter === 'all' || t.o.id === S.aFilter);
    if (list.length) {
      list.forEach((t, i) => {
        const good = (t.dir * t.o.better) > 0, strong = t.p < 0.01 && t.strength >= 0.4;
        const c = h('div', 'card find' + (i === 0 ? ' open' : ''));
        const vmax = Math.max.apply(null, t.groups.map(g => g.v)), vmin = Math.min.apply(null, t.groups.map(g => g.v));
        const bars = `<div class="bars" style="grid-template-columns:repeat(${t.groups.length},minmax(0,1fr))">${t.groups.map(g => `<div class="bar${g.hi ? ' hi' : ''}"><span class="v">${fmt(g.v, t.o.dec)}</span><div class="col"><div class="fill" data-hgt="${(25 + 75 * (g.v - vmin) / ((vmax - vmin) || 1)).toFixed(0)}%"></div></div><span class="k">${esc(g.k)} · ${g.n}</span></div>`).join('')}</div>`;
        c.innerHTML = `<div class="meta"><span class="tag ${good ? 'good' : 'bad'}">${good ? 'ti aiuta' : 'ti penalizza'}</span><span class="tag n">${strong ? 'evidenza forte' : 'evidenza moderata'}</span><span class="tag n">${t.n} notti</span></div>
          <h3>${esc(findingTitle(t))}</h3>${bars}<div class="body"><p class="muted small">${esc(findingBody(t))}</p><div class="sc"></div></div><span class="more">${i === 0 ? 'Chiudi' : 'Vedi i dati'}</span>`;
        const sc = c.querySelector('.sc');
        let drawn = false;
        const drawScatter = () => {
          if (drawn || t.f.binary) return; drawn = true;
          sc.appendChild(h('span', 'eyebrow', 'Ogni punto è una notte'));
          const pts = t.pairs.map(p => [p[0], p[1], p[2]]).sort((a, b) => a[0] - b[0]);
          const mx = avg(pts.map(p => p[0])), my = avg(pts.map(p => p[1])), den = pts.reduce((s, p) => s + (p[0] - mx) * (p[0] - mx), 0);
          const k = den ? pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0) / den : 0;
          const xa = pts[0][0], xb = pts[pts.length - 1][0];
          const ticks = (a, b) => { const st = niceStep((b - a) / 4), out = []; for (let x = Math.ceil(a / st) * st; x <= b; x += st) out.push([x, t.f.id === 'bed' ? clock(x) : fmt(x, st < 1 ? 1 : 0)]); return out; };
          lineChart(sc, { h: 200, series: [{ data: pts, color: 'var(--accent)', line: false, dots: 3.4, dotOpacity: .7 }, { data: [[xa, my + k * (xa - mx)], [xb, my + k * (xb - mx)]], color: 'var(--fg)', w: 1.2, dash: '4 3', opacity: .5 }],
            xTicks: ticks, tip: p => `${dLabel(p[2])} · ${esc(t.f.show(p[0]))} · <b>${fmt(p[1], t.o.dec)}</b>${t.o.unit}`, onPick: p => go('sonno', { night: p[2] }), aria: 'Grafico a punti' });
          sc.appendChild(h('p', 'hint', `Orizzontale: ${t.f.axis}. Verticale: ${t.o.label}. Tocca un punto per aprire la notte.`));
        };
        if (i === 0) setTimeout(drawScatter, 50);
        c.onclick = e => { if (e.target.closest('.chart')) return; const open = c.classList.toggle('open'); c.querySelector('.more').textContent = open ? 'Chiudi' : 'Vedi i dati'; if (open) drawScatter(); };
        v.appendChild(c);
      });
    } else v.appendChild(h('p', 'empty', 'Per ora nessuna relazione abbastanza solida per questo filtro. Le scoperte compaiono man mano che i dati crescono.'));

    if (an.trends.length) {
      const c = h('div', 'card', '<span class="eyebrow">Tendenze delle ultime 2 settimane</span>');
      an.trends.forEach(tt => { const good = (tt.diff * tt.o.better) > 0;
        c.insertAdjacentHTML('beforeend', noteHTML({ s: good ? 'good' : 'warn', i: tt.diff > 0 ? 'up' : 'down', t: `<strong>${tt.o.label.replace(/^./, x => x.toUpperCase())} ${tt.diff > 0 ? 'in aumento' : 'in calo'}</strong>: <span class="num">${fmt(tt.now, tt.o.dec)}</span>${tt.o.unit} contro ${fmt(tt.was, tt.o.dec)}${tt.o.unit} nelle 4 settimane prima.` })); });
      v.appendChild(c);
    }
    if (an.learning.length) {
      const c = h('div', 'card', `<div class="chead"><span class="eyebrow">Sto ancora imparando</span><span class="muted small">servono ${an.MIN_N} notti</span></div>`);
      an.learning.forEach(l => c.insertAdjacentHTML('beforeend', `<div class="prog"><span>Effetto della ${esc(l.f.label)} sul sonno · <span class="num">${l.n}/${an.MIN_N}</span></span><div class="track"><i data-w="${Math.min(100, 100 * l.n / an.MIN_N).toFixed(0)}%"></i></div></div>`));
      v.appendChild(c);
    }
    v.appendChild(h('div', 'card', `<details class="how"><summary>Come funziona l'analisi</summary><ul>
      <li>Confronto 8 fattori (ora e regolarità del sonno, passi e stress del giorno prima, CO2, temperatura e umidità della camera, weekend) con 5 risultati (sleep score, HRV, battito a riposo, Body Battery, sonno profondo).</li>
      <li>Correlazione di Spearman, verificata con un test di permutazione (1500 rimescolamenti): niente ipotesi sulla forma dei dati.</li>
      <li>Correzione di Benjamini-Hochberg per i confronti multipli: con tanti confronti alcune coincidenze sono inevitabili, e qui vengono scartate.</li>
      <li>Non confronto lo sleep score con le sue componenti (durata, fasi): sarebbe un risultato scontato.</li>
      <li>Sono associazioni, non prove di causa: usale come ipotesi da provare (per esempio una settimana a letto entro le 23).</li></ul></details>`));
  }

  // avvio
  const start = (location.hash || '').replace('#', '');
  go(TABS.some(t => t[0] === start) ? start : 'oggi');

  }
})();
