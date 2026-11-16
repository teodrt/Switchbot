# Notturna: la dashboard

Web app Apps Script nello stesso progetto degli script di raccolta: `apps-script/dashboard.gs`
(server) e `apps-script/dashboard.html` (pagina). Legge le tre schede del foglio hub a ogni apertura.

## Sezioni

1. **Apertura**: anello dello sleep score, giudizio rispetto alla media delle 30 notti precedenti,
   durata, HRV, battito a riposo, CO2.
2. **Da notare**: CO2 sopra 1000 ppm per più di un'ora, camera sopra i 20,5 °C, valori insoliti
   della notte (respirazione, battito, HRV, minuti svegli: distanza dalla mediana delle 60 notti
   precedenti oltre 2,5 deviazioni assolute mediane), orari irregolari (deviazione standard
   dell'ora di addormentamento oltre 60 minuti nelle ultime 2 settimane).
3. **La notte in numeri**: 8 riquadri con stato verde, giallo o rosso secondo le soglie di `CLAUDE.md`.
4. **La notte in un grafico**: CO2 e temperatura dalle 22 alle 10, finestra di sonno Garmin, fasi del sonno.
5. **Cosa dicono i tuoi dati**: il motore di analisi (sotto).
6. **Andamento**: ultime 30 notti di sleep score, HRV, battito a riposo, ore di sonno.
7. **Corpo**: ultima pesata, variazione in un anno, peso dal primo dato con media mobile.

## Motore di analisi

- **Fattori**: ora di addormentamento, scarto dall'orario abituale (mediana delle 7 notti prima),
  passi e stress del giorno prima, CO2, temperatura e umidità della camera nella finestra di sonno,
  weekend.
- **Risultati**: sleep score, HRV notturna, battito a riposo, Body Battery al risveglio, sonno profondo.
- Non si correla il punteggio con le sue componenti (durata, fasi, stress nel sonno): sarebbe banale.
- Correlazione di Spearman con p-value da test di permutazione (1500 rimescolamenti); per il weekend
  differenza tra medie con permutazione. Almeno 12 notti per coppia.
- Correzione di Benjamini-Hochberg (FDR 10 %) su tutte le coppie, poi solo effetti con |rho| ≥ 0,25.
  Al massimo 2 risultati per fattore, 6 in tutto. "Evidenza forte" se p < 0,01 e |rho| ≥ 0,4.
- I risultati si leggono per terzili del fattore (medie del risultato nel terzo basso, medio, alto).
- **Tendenze**: ultime 14 notti contro le 28 precedenti, permutazione, solo se p < 0,05 e la differenza
  è almeno 0,4 deviazioni standard. Peso: pendenza Theil-Sen sugli ultimi 6 mesi.
- **Sto ancora imparando**: fattori della camera con meno di 12 notti, con barra di avanzamento.
- Il generatore casuale ha un seme fisso, così la pagina dà sempre gli stessi risultati sugli stessi dati.
