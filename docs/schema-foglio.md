# Schema del foglio hub

Il foglio Google è l'unico punto dove finiscono tutti i dati. Una scheda per fonte.
L'ID del foglio non è nel repo: sta nella proprietà `SHEET_ID` dello script.

## Scheda 1: log SwitchBot (prima scheda del file)

Una riga ogni 10 minuti, scritta da `apps-script/switchbot.gs`. Orario Europe/Madrid.

| Col | Nome | Fonte | Note |
|---|---|---|---|
| A | `timestamp` | script | `yyyy-MM-dd HH:mm` |
| B | `temp_c` | Meter Pro CO2 (camera) | vuota se il sensore non ha dati |
| C | `rh_pct` | Meter Pro CO2 | % umidità relativa |
| D | `co2_ppm` | Meter Pro CO2 | ppm |
| E | `battery` | Meter Pro CO2 | % |
| F | `hub_temp_c` | Hub 2 (seconda stanza) | |
| G | `hub_rh_pct` | Hub 2 | |
| H | `hub_light` | Hub 2 | scala 1-20 |
| I | `note` | script | vuota se tutto ok, altrimenti errore o JSON grezzo |

Storia: prima del collegamento all'Hub 2 (15/11/2026 16:39) le colonne B, C, E sono vuote
e la CO2 in D è un valore vecchio dalla cache del cloud, da non usare nelle analisi.
Le colonne F-I esistono dal 16/11/2026.

## Scheda `Garmin`

Una riga per data, scritta da `apps-script/garmin.gs` tramite la Garmin Personal API
(Forerunner 255). Ogni mattina alle 10 si riscrivono gli ultimi 3 giorni. La data è quella
del risveglio, come in Garmin Connect. La colonna A è testo (`yyyy-MM-dd`).

| Col | Nome | Endpoint e campo |
|---|---|---|
| A | `date` | `calendarDate` |
| B | `sleep_score` | sonno: `sleepScores.overall.value` (0-100) |
| C | `sleep_h` | sonno: `sleepTimeSeconds` in ore |
| D-G | `deep_min`, `light_min`, `rem_min`, `awake_min` | sonno: `deep/light/rem/awakeSleepSeconds` in minuti |
| H | `awake_count` | sonno: `awakeCount` |
| I-J | `bed_start`, `bed_end` | sonno: `sleepStart/EndTimestampLocal` (HH:mm) |
| K | `sleep_hr_avg` | sonno: `avgHeartRate` |
| L | `sleep_stress_avg` | sonno: `avgSleepStress` |
| M | `resp_avg` | sonno: `averageRespirationValue` |
| N | `spo2_avg` | sonno: `averageSpO2Value` |
| O | `hrv_night_ms` | HRV: `lastNightAvg` |
| P | `hrv_weekly_ms` | HRV: `weeklyAvg` |
| Q | `hrv_status` | HRV: `status` |
| R | `rhr` | riepilogo: `restingHeartRate` |
| S-U | `bb_wake`, `bb_high`, `bb_low` | riepilogo: `bodyBatteryAtWakeTime/HighestValue/LowestValue` |
| V | `stress_avg` | riepilogo: `averageStressLevel` |
| W | `steps` | riepilogo: `totalSteps` |
| X | `note` | errori o "nessun sonno registrato" |

Endpoint (host `https://personal.connectapi.garmin.com`):
`/sleep-service/sleep/dailySleepSummariesByDate`, `/hrv-service/hrv/daily/{from}/{to}`,
`/usersummary-service/usersummary/daily`. L'API dà solo i totali per fase, non la sequenza
delle fasi durante la notte.

## Scheda `Renpho`

Una riga per giorno con una pesata (l'ultima del giorno), scritta da `apps-script/renpho.gs`
tramite l'API cloud non ufficiale di Renpho Health, letta da un secondo account "amico".
Ogni giorno alle 11 si riscrivono le ultime ~45-50 pesate. La colonna A è testo (`yyyy-MM-dd`).

| Col | Nome | Parametro API | Note |
|---|---|---|---|
| A | `date` | `groupDay` | giorno della pesata, fuso Madrid |
| B | `weight_kg` | `weight` | |
| C | `bodyfat_pct` | `bodyfat` | % grasso |
| D | `water_pct` | `water` | % acqua |
| E | `muscle` | `muscle` | % muscoli (valori intorno a 42) |
| F | `bone` | `bone` | kg di massa ossea (valori intorno a 3,2) |
| G | `visfat` | `visfat` | livello di grasso viscerale |
| H | `bmr_kcal` | `bmr` | metabolismo basale |
| I | `bmi` | `bmi` | |
| J | `note` | | errori di un parametro, se ci sono |

La composizione corporea c'è solo nei giorni in cui la bilancia l'ha misurata.

## Scheda `Attivita`

Una riga per attività sportiva, scritta da `apps-script/garmin.gs` (`gActivities_`): ultimi 7 giorni
ogni mattina con `garminDaily`, storico di 3 anni con `garminActivitiesBackfill`. Chiave: `activity_id`.

Colonne: `activity_id`, `date`, `start` (HH:mm), `type` (typeKey Garmin, es. `running`), `name`,
`duration_min`, `distance_km`, `avg_hr`, `max_hr`, `calories`, `aerobic_te`, `anaerobic_te`,
`training_load`, `vo2max`, `moderate_min`, `vigorous_min`, `elevation_m`, `te_label`.

## Scheda `Umore`

Check-in giornaliero scritto dall'app (`ritmoSaveCheckin` in `dashboard.gs`), una riga per data.

| Col | Nome | Valori |
|---|---|---|
| A | `date` | `yyyy-MM-dd` (testo) |
| B | `time` | ora del salvataggio |
| C | `energy` | 1-5 (scarico ... carico) |
| D | `mood` | 1-5 (giù ... ottimo) |
| E | `pain` | 0-10 |
| F | `note` | testo libero, al massimo 280 caratteri |
| G | `tags` | cosa hai fatto ieri e stanotte, separato da virgole: `fisio`, `antidolorifico`, `alcol`, `caffe` (dopo le 15), `cena` (tardi), `finestra` (aperta di notte) |

## Scheda `Calendario`

Scritta da `apps-script/context.gs` ogni mattina (la prima volta gli ultimi 90 giorni), una riga per giorno
finito, dai calendari di proprietà dell'account. Mai titoli, luoghi o partecipanti.

| Col | Nome | Valori |
|---|---|---|
| A | `date` | giorno dell'impegno |
| B | `fisio` | 1 se un impegno contiene fisio, physio, riabilit, osteopat o kinesi |
| C | `sera` | 1 se l'ultimo impegno finisce dopo le 21 |
| D | `fine_ultimo` | ora di fine dell'ultimo impegno (HH:mm) |
| E | `eventi` | numero di impegni (esclusi quelli di tutto il giorno e quelli rifiutati) |

## Scheda `Meteo`

Scritta da `apps-script/context.gs` ogni mattina (la prima volta gli ultimi 92 giorni) da Open-Meteo, solo se
nell'app è stata scelta la città (posizione arrotondata in `APP_SETTINGS.place`). Una riga per notte finita.

| Col | Nome | Valori |
|---|---|---|
| A | `date` | data del risveglio |
| B-D | `t_notte`, `rh_notte`, `p_notte` | medie dalle 22 alle 7: °C, %, hPa |
| E | `dp24` | pressione alle 7 meno pressione alle 7 del giorno prima (hPa) |
| F | `t_max` | massima del giorno prima (°C) |

## Foglio separato "Ritmo - Aria camera" (solo se si condivide l'aria)

Scritto ogni ora da `apps-script/air.gs` di chi ha il sensore, scheda `Aria`: `timestamp`, `temp_c`, `rh_pct`,
`co2_ppm` degli ultimi 45 giorni. Nient'altro. Chi lo riceve in sola lettura copia le righe nuove nella prima
scheda del suo foglio (colonna `note` = `condivisa`).

## Regole

- Le date usano sempre il fuso Europe/Madrid.
- Una "notte" va dalle 22:00 del giorno D alle 10:00 del giorno D+1 ed è etichettata con D+1
  (la data del risveglio, come fa Garmin).
- I numeri decimali nel foglio usano la virgola (impostazioni locali spagnole/italiane):
  chi legge il CSV esportato deve gestirla.
