/**
 * Import Renpho: ogni giorno legge peso e composizione corporea dall'API cloud NON ufficiale
 * di Renpho Health e li scrive nella scheda "Renpho" del foglio hub (una riga per giorno).
 *
 * Renpho permette una sola sessione attiva per account: il login dello script disconnetterebbe
 * l'app sul telefono. Per questo lo script usa un SECONDO account Renpho, aggiunto come amico
 * dall'account principale, e legge i dati dell'amico (endpoint "friend").
 *
 * Protocollo ricostruito dalla libreria Python renpho-api (MIT,
 * https://github.com/danvaneijck/renpho-api): richieste e risposte cifrate AES-128-ECB
 * con padding PKCS7 e base64, header appVersion < 8.0.0. Può smettere di funzionare
 * se Renpho cambia il server.
 *
 * Proprietà dello script richieste:
 *   RENPHO_EMAIL     email del secondo account (creato con email e password, non con Google/Apple)
 *   RENPHO_PASSWORD  password del secondo account
 *   SHEET_ID         ID del foglio hub
 * Proprietà facoltative:
 *   RENPHO_FRIEND_ID userId dell'account principale (se il secondo account ha più amici)
 * Proprietà gestite dallo script: RENPHO_TOKEN, RENPHO_USER_ID (il login vale 90 giorni).
 *
 * Funzioni da eseguire a mano:
 *   renphoDebug     prova: login, elenco amici, ultime pesate. Non scrive nel foglio
 *   renphoBackfill  importa gli ultimi 12 mesi
 *   renphoSetup     crea il trigger giornaliero (ore 11) e importa l'ultimo mese
 */

const RENPHO_HOST = 'https://cloud.renpho.com/';
const RENPHO_KEY = 'ed*wijdi$h6fe3ew';   // chiave AES dell'app per le versioni < 8.0.0 (da renpho-api)
const RENPHO_APP_VERSION = '6.6.0';      // NON aggiornare: dalla 8.0.0 il server usa un'altra chiave
const RENPHO_TAB = 'Renpho';
const RENPHO_TZ = 'Europe/Madrid';
const RENPHO_PARAMS = ['weight', 'bodyfat', 'water', 'muscle', 'bone', 'visfat', 'bmr', 'bmi'];
const RENPHO_HEADER = ['date', 'weight_kg', 'bodyfat_pct', 'water_pct', 'muscle', 'bone',
  'visfat', 'bmr_kcal', 'bmi', 'note'];

// ---------- AES-128-ECB con padding PKCS7 (Apps Script non ha AES) ----------

const RAES_ = (function () {
  const sbox = new Array(256), inv = new Array(256);
  const xt = a => ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff;
  const mul = (a, b) => { let r = 0; while (b) { if (b & 1) r ^= a; a = xt(a); b >>= 1; } return r; };
  const rotl = (x, s) => ((x << s) | (x >> (8 - s))) & 0xff;
  let p = 1, q = 1;
  do {
    p = (p ^ xt(p)) & 0xff;                                  // p *= 3
    q ^= q << 1; q ^= q << 2; q ^= q << 4; q &= 0xff;        // q /= 3
    if (q & 0x80) q ^= 0x09;
    sbox[p] = (q ^ rotl(q, 1) ^ rotl(q, 2) ^ rotl(q, 3) ^ rotl(q, 4) ^ 0x63) & 0xff;
  } while (p !== 1);
  sbox[0] = 0x63;
  for (let i = 0; i < 256; i++) inv[sbox[i]] = i;

  const SHIFT = [0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12, 1, 6, 11];
  const ISHIFT = [0, 13, 10, 7, 4, 1, 14, 11, 8, 5, 2, 15, 12, 9, 6, 3];

  function expand(key) {
    const w = key.slice();
    let rcon = 1;
    for (let i = 16; i < 176; i += 4) {
      let t = w.slice(i - 4, i);
      if (i % 16 === 0) { t = [sbox[t[1]] ^ rcon, sbox[t[2]], sbox[t[3]], sbox[t[0]]]; rcon = xt(rcon); }
      for (let j = 0; j < 4; j++) w[i + j] = w[i - 16 + j] ^ t[j];
    }
    return w;
  }

  function mix(s, m) {
    const o = new Array(16);
    for (let c = 0; c < 16; c += 4) {
      for (let r = 0; r < 4; r++) {
        o[c + r] = mul(s[c], m[(4 - r) % 4]) ^ mul(s[c + 1], m[(5 - r) % 4]) ^
                   mul(s[c + 2], m[(6 - r) % 4]) ^ mul(s[c + 3], m[(7 - r) % 4]);
      }
    }
    return o;
  }
  const MIX = [2, 3, 1, 1], IMIX = [14, 11, 13, 9];

  function encBlock(b, w) {
    let s = b.map((v, i) => v ^ w[i]);
    for (let round = 1; round <= 10; round++) {
      s = SHIFT.map(i => sbox[s[i]]);
      if (round < 10) s = mix(s, MIX);
      s = s.map((v, i) => v ^ w[round * 16 + i]);
    }
    return s;
  }

  function decBlock(b, w) {
    let s = b.map((v, i) => v ^ w[160 + i]);
    for (let round = 9; round >= 0; round--) {
      s = ISHIFT.map(i => inv[s[i]]);
      s = s.map((v, i) => v ^ w[round * 16 + i]);
      if (round > 0) s = mix(s, IMIX);
    }
    return s;
  }

  const keyBytes = k => Array.from(k).map(ch => ch.charCodeAt(0) & 0xff);

  return {
    encrypt(bytes, key) {
      const w = expand(keyBytes(key));
      const n = 16 - (bytes.length % 16);
      const data = bytes.concat(new Array(n).fill(n));
      let out = [];
      for (let i = 0; i < data.length; i += 16) out = out.concat(encBlock(data.slice(i, i + 16), w));
      return out;
    },
    decrypt(bytes, key) {
      const w = expand(keyBytes(key));
      let out = [];
      for (let i = 0; i < bytes.length; i += 16) out = out.concat(decBlock(bytes.slice(i, i + 16), w));
      const n = out[out.length - 1];
      if (n < 1 || n > 16) throw new Error('Renpho: padding AES non valido');
      return out.slice(0, out.length - n);
    }
  };
})();

const rUnsigned_ = bytes => bytes.map(b => b & 0xff);
const rSigned_ = bytes => bytes.map(b => (b > 127 ? b - 256 : b));

function rEncrypt_(obj) {
  const plain = rUnsigned_(Utilities.newBlob(JSON.stringify(obj)).getBytes());
  return { encryptData: Utilities.base64Encode(rSigned_(RAES_.encrypt(plain, RENPHO_KEY))) };
}

function rDecrypt_(b64) {
  const plain = RAES_.decrypt(rUnsigned_(Utilities.base64Decode(b64)), RENPHO_KEY);
  return JSON.parse(Utilities.newBlob(rSigned_(plain)).getDataAsString('UTF-8'));
}

// ---------- chiamate al server ----------

function rcfg_(key) {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Proprietà dello script mancante: ' + key);
  return v;
}

/** Fuso di Madrid in ore intere con segno, per l'header timeZone (es. "+1" d'inverno). */
function rTzOffset_() {
  const z = Utilities.formatDate(new Date(), RENPHO_TZ, 'Z');   // es. "+0100"
  return (z.charAt(0) === '-' ? -1 : 1) * Number(z.slice(1, 3));
}

const R_OK = ['0', '101', '200', '20000'];

function rPost_(endpoint, payload, opts) {
  opts = opts || {};
  const p = PropertiesService.getScriptProperties();
  const headers = { appVersion: RENPHO_APP_VERSION, platform: 'android' };
  if (opts.auth !== false) {
    if (!p.getProperty('RENPHO_TOKEN')) renphoLogin_();
    headers.token = p.getProperty('RENPHO_TOKEN');
    headers.userId = p.getProperty('RENPHO_USER_ID');
  }
  if (opts.tz !== undefined) headers.timeZone = (opts.tz >= 0 ? '+' : '') + opts.tz;
  const res = UrlFetchApp.fetch(RENPHO_HOST + endpoint, {
    method: 'post', contentType: 'application/json', headers: headers,
    payload: JSON.stringify(rEncrypt_(payload)), muteHttpExceptions: true });
  const http = res.getResponseCode();
  let body = {};
  try { body = JSON.parse(res.getContentText()); } catch (e) { /* risposta non JSON */ }
  const code = String(body.code !== undefined ? body.code : http);
  const msg = String(body.msg || body.message || '');
  // Sessione scaduta o sostituita da un altro login: rifà il login una volta.
  if (opts.auth !== false && !opts.retried && (http === 401 || http === 403 || code === '401' || code === '403')) {
    renphoLogin_();
    return rPost_(endpoint, payload, Object.assign({}, opts, { retried: true }));
  }
  if (http !== 200 || (R_OK.indexOf(code) < 0 && msg.toLowerCase() !== 'success')) {
    throw new Error('Renpho ' + endpoint + ' HTTP ' + http + ' codice ' + code + ': ' + msg.slice(0, 200));
  }
  return body.data ? rDecrypt_(body.data) : null;
}

function renphoLogin_() {
  const data = rPost_('renpho-aggregation/user/login', {
    questionnaire: {},
    login: { password: rcfg_('RENPHO_PASSWORD'), areaCode: 'US', appRevision: RENPHO_APP_VERSION,
      cellphoneType: 'AppsScript', systemType: '11', email: rcfg_('RENPHO_EMAIL'), platform: 'android' },
    bindingList: { deviceTypes: [] }
  }, { auth: false });
  const login = (data && data.login) || {};
  if (!login.token) throw new Error('Renpho: login senza token');
  PropertiesService.getScriptProperties().setProperties({
    RENPHO_TOKEN: login.token, RENPHO_USER_ID: String(login.id) });
}

function rRecords_(d) {
  if (Array.isArray(d)) return d;
  if (d && typeof d === 'object') {
    for (const k of ['list', 'data', 'records', 'rows']) if (Array.isArray(d[k])) return d[k];
  }
  return [];
}

function rFriends_() {
  const me = PropertiesService.getScriptProperties().getProperty('RENPHO_USER_ID');
  return rRecords_(rPost_('RenphoHealth/app/friend/friendsList',
    { userId: String(me), pageNum: 1, pageSize: 50 }, { tz: rTzOffset_() }));
}

function rFriendId_() {
  const p = PropertiesService.getScriptProperties();
  const fixed = p.getProperty('RENPHO_FRIEND_ID');
  if (fixed) return fixed;
  if (!p.getProperty('RENPHO_TOKEN')) renphoLogin_();
  const friends = rFriends_();
  if (friends.length === 0) throw new Error('Renpho: il secondo account non ha amici. Aggiungilo come amico dall\'account principale e accetta.');
  if (friends.length > 1) throw new Error('Renpho: più amici, imposta RENPHO_FRIEND_ID. Amici: ' +
    friends.map(f => f.accountName + '=' + f.userId).join(', '));
  return String(friends[0].userId);
}

/** Punti giornalieri di un parametro in una finestra di circa un mese che finisce a endTime (unix s, 0 = ora). */
function rTrend_(friendId, param, endTime) {
  const tz = rTzOffset_();
  return rRecords_(rPost_('RenphoHealth/app/friend/measure/trendV2', {
    rhFriendId: String(friendId), timeZone: tz, param: param,
    sourceDataType: '', timeType: 'MONTH', endTime: endTime || 0 }, { tz: tz }));
}

// ---------- foglio ----------

const rNum_ = v => (typeof v === 'number' && isFinite(v) && v > 0) ? Number(v.toFixed(2)) : '';

/** Legge tutti i parametri per la finestra che finisce a endTime e li scrive nel foglio. */
function renphoImport_(endTime) {
  const friendId = rFriendId_();
  const days = {};
  const notes = [];
  RENPHO_PARAMS.forEach(param => {
    try {
      rTrend_(friendId, param, endTime).forEach(pt => {
        if (!pt.groupDay || !(typeof pt.value === 'number' && pt.value > 0)) return;
        (days[pt.groupDay] = days[pt.groupDay] || {})[param] = pt.value;
      });
    } catch (e) { notes.push(param + ': ' + e.message); }
  });
  const rows = Object.keys(days).sort().map(d => [d].concat(
    RENPHO_PARAMS.map(k => rNum_(days[d][k])), [notes.join(' | ').slice(0, 300)]));
  if (rows.length) renphoWrite_(rows);
  else if (notes.length) throw new Error(notes.join(' | '));
  return rows.length;
}

function renphoWrite_(rows) {
  const ss = SpreadsheetApp.openById(rcfg_('SHEET_ID'));
  const sh = ss.getSheetByName(RENPHO_TAB) || ss.insertSheet(RENPHO_TAB);
  sh.getRange('A:A').setNumberFormat('@');
  if (sh.getLastRow() === 0) sh.appendRow(RENPHO_HEADER);
  const n = sh.getLastRow() - 1;
  const dates = n > 0 ? sh.getRange(2, 1, n, 1).getDisplayValues().map(r => r[0]) : [];
  rows.forEach(r => {
    const i = dates.indexOf(r[0]);
    if (i >= 0) sh.getRange(i + 2, 1, 1, r.length).setValues([r]);
    else { sh.appendRow(r); dates.push(r[0]); }
  });
  if (sh.getLastRow() > 2) sh.getRange(2, 1, sh.getLastRow() - 1, RENPHO_HEADER.length).sort(1);
}

// ---------- funzioni da eseguire ----------

/** Trigger giornaliero: ultimo mese (aggiorna anche le pesate già scritte). */
function renphoDaily() { renphoImport_(0); }

/** Importa gli ultimi 12 mesi, un mese alla volta. */
function renphoBackfill() {
  const now = Math.floor(Date.now() / 1000);
  let total = 0;
  for (let m = 0; m < 12; m++) total += renphoImport_(m === 0 ? 0 : now - m * 30 * 86400);
  Logger.log('Giorni con pesata importati: ' + total);
}

/** Crea (o ricrea) solo il trigger di renphoDaily, senza toccare gli altri. */
function renphoSetup() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'renphoDaily')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('renphoDaily').timeBased().everyDays(1).atHour(11).inTimezone(RENPHO_TZ).create();
  renphoDaily();
}

/** Solo lettura: login, amici e ultime pesate nel log. Non scrive nel foglio. */
function renphoDebug() {
  renphoLogin_();
  Logger.log('Login riuscito, userId del secondo account: ' +
    PropertiesService.getScriptProperties().getProperty('RENPHO_USER_ID'));
  const friends = rFriends_();
  Logger.log('Amici: ' + JSON.stringify(friends.map(f => ({ userId: f.userId, accountName: f.accountName }))));
  if (!friends.length) return;
  const id = rFriendId_();
  ['weight', 'bodyfat'].forEach(param =>
    Logger.log(param + ': ' + JSON.stringify(rTrend_(id, param, 0).slice(-3))));
}
