# Progetto: monitoraggio sonno e qualità di vita

Dashboard personale che mette insieme l'aria della camera (SwitchBot), il sonno e l'attività
(Garmin) e la composizione corporea (Renpho Health), per capire cosa influisce sul sonno.

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
| Dashboard | Web app Apps Script (`dashboard/`), legge il foglio |
| Codice e memoria del progetto | Questo repo |

Claude Code non fa da hub: le sessioni non restano accese. Si usa una sessione quando serve
costruire o analizzare, eventualmente un'attività programmata per i report periodici.

## Deploy degli Apps Script

Il connettore Google Drive permette a Claude di **leggere** il codice di uno script
(`download_file_content` con `application/vnd.google-apps.script+json`) e di **rinominarlo**,
ma non di modificarne il codice. Il codice in `apps-script/` va incollato a mano dall'utente
nell'editor di script.google.com, poi si controlla scaricandolo di nuovo.

Tutti i file di `apps-script/` stanno nello stesso progetto Apps Script. Ogni funzione di setup
cancella e ricrea **solo il proprio trigger** (filtrando per `getHandlerFunction()`), mai tutti.
I nomi delle funzioni devono essere unici nel progetto: prefisso `g` per Garmin.

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
apps-script/switchbot.gs  logger SwitchBot (ogni 10 minuti)
apps-script/garmin.gs     import Garmin (ogni giorno alle 10)
apps-script/renpho.gs     import Renpho (ogni giorno alle 11, API non ufficiale)
apps-script/dashboard.gs  web app Notturna: legge il foglio e prepara i dati (nBuild_ è pura, provabile in Node)
apps-script/dashboard.html pagina della web app: grafica e motore di analisi
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
6. Dashboard definitiva (`dashboard.gs` + `dashboard.html`): scritta e provata con i dati reali
   in Node e Playwright; da distribuire come App web (Esegui come: me, Accesso: solo io).
7. Report settimanale automatico.
