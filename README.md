# Switchbot

Monitoraggio personale di sonno e qualità di vita: aria della camera (SwitchBot Meter Pro CO2
e Hub 2), sonno e attività (Garmin), composizione corporea (Renpho Health), riuniti in un foglio
Google e in una dashboard.

- `apps-script/switchbot.gs`: logger SwitchBot, una riga ogni 10 minuti.
- `docs/schema-foglio.md`: schede e colonne del foglio.
- `dashboard/`: dashboard (in costruzione).
- `CLAUDE.md`: architettura e regole del progetto.

## Installare il logger

1. Crea un progetto su script.google.com e incolla `apps-script/switchbot.gs`.
2. In Impostazioni progetto > Proprietà script aggiungi `SWITCHBOT_TOKEN`, `SWITCHBOT_SECRET`
   e `SHEET_ID`.
3. Esegui `setup` una volta: crea il trigger ogni 10 minuti e scrive la prima riga.

Credenziali e ID non vanno mai nel repo.
