# Progetto: Ritmo

App personale (Ritmo) che mette insieme l'aria della camera (SwitchBot), il sonno e l'attività
(Garmin) e la composizione corporea (Renpho Health), per capire quali parametri fanno stare
meglio. Oggi il centro è il sonno e il recupero dopo un'operazione; in seguito si aggiungeranno
prestazioni sportive e umore. Nomi su Google: script "Ritmo - Raccolta dati", foglio "Ritmo - Dati".

## Regole

- **Il repo è pubblico.** Non committare mai: token, secret, ID di fogli o script Google,
  ID dei dispositivi, email, indirizzi o luoghi, dati di salute o export (CSV, JSON).
  Questi stanno nelle proprietà dello script Apps Script o nel foglio Google.
- Rispondi all'utente in italiano, con il trattino normale (non quello lungo).
- Le chiamate all'API SwitchBot fatte da Claude per diagnosi sono **solo GET**
  (`/devices`, `/devices/{id}/status`). Mai inviare comandi ai dispositivi.
- Se servono TOKEN e SECRET in una sessione, si estraggono in memoria con `python3 -I`
  senza mai stamparli o scriverli su file.

## Architettura

| Ruolo | Dove |
|---|---|
| Hub dei dati | Un foglio Google, una scheda per fonte (vedi `docs/schema-foglio.md`) |
| Raccolta automatica | Apps Script con trigger temporali (`apps-script/`) |
| App Ritmo: dati | Web app Apps Script (`dashboard.gs` legge il foglio, `ritmo.html` è solo il caricatore) |
| App Ritmo: interfaccia | `app/ritmo.js` + `app/ritmo.css`, caricati da jsDelivr dall'ultimo commit di `main` |
| Codice e memoria del progetto | Questo repo |

Claude Code non fa da hub: le sessioni non restano accese. Si usa una sessione quando serve
costruire o analizzare, eventualmente un'attività programmata per i report periodici.

## Motore auto-aggiornante (Apps Script)

- Nel progetto Apps Script ci sono solo due file: **`Motore`** (`apps-script/motore.gs`, fisso, non va
  più modificato) e la pagina **`ritmo`** (`apps-script/ritmo.html`, il caricatore dell'app).
- A ogni esecuzione il motore scarica da `raw.githubusercontent.com/teodrt/Switchbot/main/apps-script/`
  i file elencati in `apps-script/engine.json`, fa un controllo di sintassi e li esegue con un eval
  globale. Cache 15 minuti (CacheService); ultima versione buona salvata nelle proprietà
  (`RITMO_P*`, `RITMO_MD5`), usata se GitHub non risponde o il codice nuovo non compila.
- **Un solo trigger**: `ritmoTick` ogni 10 minuti. `engine.gs` decide i lavori (`E_JOBS`: SwitchBot a
  ogni giro, Garmin dalle 7:30 ogni 30 minuti finché non arriva la notte appena passata (al massimo fino alle 13),
  Renpho dopo le 11, promemoria del check-in via mail appena arriva la notte da Garmin (dalle 7; alle 12 se la
  notte non arriva; una volta al giorno; niente se il check-in è fatto), report il lunedì dopo le 8:40), le operazioni una
  tantum (`E_MIGRATIONS`, una per giro, registrate in `MIGRATIONS_DONE`) e rimuove ogni altro trigger.
  Un lavoro fallito si riprova dopo un'ora. Registro in `ENGINE_LOG`, mostrato nell'app (Insight).
- Per cambiare il codice di raccolta: modificare i `.gs` su `main`. Niente da incollare. Un nuovo file
  va aggiunto a `engine.json`. Le funzioni chiamate dall'esterno (trigger, web app, `google.script.run`)
  devono avere un punto di ingresso fisso in `motore.gs`: oggi `doGet`, `ritmoSaveCheckin`, `ritmoTick`.
  Una nuova funzione chiamata dall'app richiederebbe di aggiornare `motore.gs` a mano: evitarlo
  passando da quelle esistenti.
- Nomi globali unici tra tutti i file (vengono uniti): prefissi `g` Garmin, `r` Renpho, `n` app,
  `wk` report, `e` pianificatore.
- Rischio accettato dall'utente (17/11/2026): il codice di `main` gira con il suo account Google e
  vede le chiavi nelle proprietà. Le chiavi non vanno mai nel repo.
- Il connettore Google Drive permette a Claude di leggere il progetto (`download_file_content` con
  `application/vnd.google-apps.script+json`) per controllare, non di modificarlo.
- **Diagnosi senza aprire l'app** (l'app è privata, Claude non può aprirla): a ogni giro il motore
  scrive la scheda **`Motore`** del foglio (ultimo giro, md5 del codice, trigger, link del servizio,
  ultima apertura dell'app con versione, righe per scheda, errori, registro). L'app all'apertura
  manda un segnale (`ritmoSaveCheckin({ping:true,...})`, salvato in `APP_SEEN`). Leggere quella scheda
  con `read_file_content` prima di chiedere screenshot all'utente. Per vedere l'app: scaricare il
  foglio (xlsx), ricostruire `DATA` con `nBuild_` e renderizzare `app/` con Playwright.

## Pubblicare modifiche all'app

- Controlli automatici: `node tests/run.js` (sintassi, nomi globali unici, `nBuild_` su un foglio finto,
  scritture senza doppioni). Girano su GitHub a ogni pull request (`.github/workflows/check.yml`).
- Impostazioni dell'utente (es. data dell'operazione) si salvano dall'app nella proprietà `APP_SETTINGS`
  (`ritmoSaveCheckin({settings})`), mai nel repo. `RITMO_URL` (facoltativa) è il link messo nelle mail;
  se manca si usa `APP_URL`, salvata dall'app all'apertura (indirizzo della pagina che la contiene).

- L'interfaccia (`app/ritmo.js`, `app/ritmo.css`) si carica a ogni apertura dall'ultimo commit di
  `main`: il caricatore chiede lo SHA a api.github.com e usa `cdn.jsdelivr.net/gh/teodrt/Switchbot@<sha>`,
  con ripiego su `@main`. Una modifica all'interfaccia è online appena arriva su `main`.
- Prima del merge: provare con i dati reali (Node + Playwright) e aggiornare l'anteprima privata.
- L'utente apre l'app dal link di test della web app (finisce con `/dev`, solo per il proprietario).
- `DATA` arriva solo da Apps Script: nessun dato personale in `app/`.
- **A ogni modifica, in fondo al messaggio all'utente, stampare sempre i link**: anteprima privata
  (artifact su claude.ai), link `/dev` dell'app e pull request. I link non vanno nel repo (ID):
  si prendono dalla conversazione, dalla lista degli artifact o dalla scheda `Motore`.

## Più persone (stesso codice, dati separati)

- Ogni persona ha il **suo** account Google, il suo foglio, il suo progetto Apps Script (Motore + ritmo) e le sue
  chiavi nelle proprietà. Nessun dato passa da un'app all'altra. Mai nomi o dati della seconda persona nel repo.
- **Due versioni**: proprietà `RITMO_BRANCH` (default `main`). Il proprietario usa `main`, la seconda persona il ramo
  `p2` (senza nomi: il repo è pubblico). Ognuno può avere funzioni che l'altro non vuole: si sviluppano sul proprio ramo.
  Le migliorie comuni passano da un ramo all'altro solo su richiesta (merge di `main` in `p2`, o cherry-pick al contrario),
  dopo averle provate. Mai portare su `p2` una cosa che la seconda persona non ha chiesto, e viceversa.
  Motore e caricatore leggono il ramo dalla proprietà (solo nelle versioni incollate dopo il 18/11/2026).
- **Installazione da modello**: foglio "Ritmo - Modello" del proprietario, con lo script dentro (Motore + ritmo) e una
  scheda `Configurazione` (righe `ramo` = `p2`, `aria` = id del foglio dell'aria). La seconda persona lo copia con il
  link `/copy`, apre **Ritmo → Configura** (menu creato da `onOpen` in `motore.gs`), inserisce chiave Garmin e secondo
  account Renpho: `ritmoSetupSave` salva `SHEET_ID` (il foglio stesso), legge la scheda Configurazione e lancia
  `ritmoInstall`. Le migrazioni `eBackfillGarmin_` e `eBackfillRenpho_` importano lo storico solo se le schede sono vuote.
  Resta a mano: chiave Garmin, account Renpho, autorizzazione Google, pubblicazione dell'app web.
- Aria della camera condivisa (`air.gs`): chi ha il sensore (`SWITCHBOT_TOKEN`) scrive ogni ora solo data, temperatura,
  umidità e CO2 degli ultimi 45 giorni nel foglio "Ritmo - Aria camera" (creato da solo, `AIR_SHEET_ID`) e lo condivide
  in sola lettura. Chi non ha il sensore mette quell'id in `AIR_SOURCE_ID`: le letture nuove finiscono nella prima scheda
  del suo foglio. `logReading` non fa niente senza `SWITCHBOT_TOKEN`.
- Renpho: ogni persona ha il suo secondo account amico (una sessione per account; e così non vede le pesate dell'altro).
- Parti nascondibili per persona: `APP_SETTINGS.hide` (`recovery`, `tonight`), con "mostra" in fondo a Oggi.

## Garmin Personal API

- Chiave creata dall'utente su https://connect.garmin.com/app/settings/personalApiToken,
  salvata nella proprietà `GARMIN_API_KEY`. L'utente non la incolla mai in chat.
- Token: POST `/personalapitoken-service/personal-api/personal-api-key/token` con
  `Authorization: ApiKey <chiave>`, dura 24 ore, nessun refresh token.
- Dati: GET con `Authorization: Bearer <token>`. Intervalli al massimo 31 giorni.
- Documentazione: https://developer.garmin.com/gc-developer-program/personal/swagger-docs/
- Solo per uso personale, non commerciale.

## Renpho (API non ufficiale)

- Nessuna API ufficiale. Protocollo da renpho-api (https://github.com/danvaneijck/renpho-api):
  host `https://cloud.renpho.com/`, POST con corpo `{"encryptData": ...}` cifrato
  AES-128-ECB + PKCS7 + base64, header `appVersion` 6.6.0 (dalla 8.0.0 il server usa un'altra
  chiave e risponde -114).
- Una sola sessione per account: lo script usa un **secondo account** amico dell'account
  principale (endpoint `RenphoHealth/app/friend/...`), così l'app sul telefono non si disconnette.
- Proprietà: `RENPHO_EMAIL`, `RENPHO_PASSWORD` (del secondo account), facoltativa `RENPHO_FRIEND_ID`.
- `trendV2` con `timeType: MONTH` NON restituisce un mese: restituisce le ultime ~45-50 pesate
  prima di `endTime` (verificato sul conto reale). Il backfill va indietro ripartendo dalla pesata
  più vecchia ricevuta.
- L'id del secondo account ha 19 cifre: si legge dal testo della risposta, non da `JSON.parse`.
- Al login serve la lista completa `deviceTypes` (con lista vuota: HTTP 500 per un account vero).
- AES scritto a mano in `renpho.gs` (Apps Script non lo ha), verificato col vettore FIPS-197
  e con Node crypto. Login con email inventata verificato: risposta 106 "user does not exist".

## Dispositivi

| Dispositivo | Tipo API | Dove | Note |
|---|---|---|---|
| Meter Pro (CO2 Monitor) | `MeterPro(CO2)` | camera da letto | solo Bluetooth, arriva al cloud tramite l'Hub 2 |
| Hub 2 | `Hub 2` | seconda stanza | Wi-Fi 2,4 GHz, ha un suo sensore di temperatura, umidità e luce |

Se `hubDeviceId` del sensore torna `000000000000`, il sensore ha perso l'Hub e il cloud
restituisce zeri e una CO2 vecchia.

## Soglie di riferimento

| Misura | Bene | Discreto | Da correggere |
|---|---|---|---|
| CO2 notturna (ppm) | < 800 | 800-1000 | > 1000 |
| Temperatura camera (°C) | 17-20 | 20-22 | > 22 o < 16 |
| Umidità (%) | 40-60 | 30-40 o 60-70 | < 30 o > 70 |

## Struttura

```
CLAUDE.md                 questo file
apps-script/motore.gs     motore fisso (file "Motore" nel progetto): scarica ed esegue gli altri file
apps-script/engine.json   elenco dei file scaricati dal motore
apps-script/engine.gs     pianificatore: lavori, migrazioni, trigger, stato
apps-script/switchbot.gs  logger SwitchBot (ogni 10 minuti)
apps-script/garmin.gs     import Garmin (ogni giorno alle 10)
apps-script/renpho.gs     import Renpho (ogni giorno alle 11, API non ufficiale)
apps-script/dashboard.gs  web app Ritmo: legge il foglio e prepara i dati (nBuild_ è pura, provabile in Node);
                          ritmoSaveCheckin salva il check-in (chiamata dall'app con google.script.run)
apps-script/report.gs     report settimanale via email (lunedì 8:40), wkBuild_ è pura
apps-script/ritmo.html    caricatore della web app (DATA dal foglio + app da jsDelivr)
app/ritmo.js              interfaccia dell'app e motore di analisi (pubblicata da main)
app/ritmo.css             stile dell'app
dashboard/README.md       sezioni della dashboard e regole del motore di analisi
docs/schema-foglio.md     schede e colonne del foglio hub
```

## Roadmap

1. Logger SwitchBot con sensore camera e Hub 2: fatto.
2. Spostare TOKEN, SECRET e SHEET_ID dal codice alle proprietà dello script (versione nel repo).
3. Prototipo grafico della dashboard con dati SwitchBot veri e dati di esempio: fatto
   (pagina privata su claude.ai, non nel repo perché contiene dati veri).
4. Import Garmin con la Personal API (`apps-script/garmin.gs`): fatto. Backfill di 90 giorni
   eseguito, trigger `garminDaily` attivo (ogni giorno alle 10). SpO2 notturna presente solo da
   metà novembre 2026 (Pulse Ox attivato da poco).
5. Import Renpho con l'API non ufficiale (`apps-script/renpho.gs`): fatto. Backfill eseguito
   (172 giorni con pesata, dal 2018), trigger `renphoDaily` attivo (ogni giorno alle 11).
6. App Ritmo: distribuita come App web (Esegui come: me, Accesso: solo io). Interfaccia separata
   in `app/` e pubblicata da `main` (vedi "Pubblicare modifiche all'app").
7. v3 (16/11/2026): check-in (energia, umore, dolore, scheda `Umore`), sport (attività Garmin,
   scheda `Attivita`, carico 7 g contro 28 g, VO2 max), report settimanale via email e in app,
   interfaccia rifatta (colori per sezione, timeline del sonno, schede dal basso, carosello di insight).
8. v3.1 (17/11/2026): motore auto-aggiornante, nessun file da incollare dopo l'installazione.
9. v5 (18/11/2026): interfaccia "pit wall" (scura, vetro, contagiri del recupero, settori stile F1).
