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

## Scheda Renpho (da definire)

Da definire dopo il primo export da Renpho Health. Candidati: data e ora della pesata,
peso, % grasso, massa muscolare, % acqua.

## Regole

- Le date usano sempre il fuso Europe/Madrid.
- Una "notte" va dalle 22:00 del giorno D alle 10:00 del giorno D+1 ed è etichettata con D+1
  (la data del risveglio, come fa Garmin).
- I numeri decimali nel foglio usano la virgola (impostazioni locali spagnole/italiane):
  chi legge il CSV esportato deve gestirla.
