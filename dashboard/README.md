# Ritmo: la dashboard

Web app Apps Script nello stesso progetto degli script di raccolta: `apps-script/dashboard.gs`
(server) e `apps-script/ritmo.html` (pagina). Legge le tre schede del foglio hub a ogni apertura.

## Sezioni

App a una pagina con barra in basso e 5 sezioni (la sezione e i filtri scelti restano in
`localStorage`). Tutti i grafici a linee si scorrono col dito per leggere i valori; toccare un
punto che rappresenta una notte apre quella notte nella sezione Sonno.

1. **Oggi**: punteggio di recupero (anello) con componenti, andamento del recupero a 30 giorni,
   "Da sapere oggi" (note della notte + prima scoperta dell'analisi), scorciatoie a Sonno, Casa, Corpo.
2. **Sonno**: navigazione tra le notti (frecce e swipe), anello dello sleep score, fasi rispetto al
   solito, HRV, battito, recupero; note della notte; CO2 o temperatura della notte; andamento con
   8 metriche e 4 periodi (punti per notte, media su 7 notti, media del periodo); calendario di 13
   settimane dello sleep score.
3. **Corpo**: 6 metriche Renpho con periodo (3 mesi, 1 anno, 3 anni, tutto), media mobile su 5
   pesate, tendenza Theil-Sen, ultime 8 pesate.
4. **Casa**: valori attuali di camera e seconda stanza, storico 24 h / 3 g / 7 g per CO2,
   temperatura e umidità, CO2 media per notte (barre che aprono la notte).
5. **Analisi**: scoperte filtrabili per risultato, apribili con grafico a punti; tendenze delle
   ultime 2 settimane; fattori ancora in apprendimento; spiegazione del metodo.

## Punteggio di recupero

Media pesata di: sleep score (35 %), HRV rispetto alla mediana delle 30 notti precedenti
(25 %, `70 + 150 × (rapporto - 1)`), battito a riposo rispetto alla mediana (20 %,
`70 - 300 × (rapporto - 1)`), Body Battery al risveglio (20 %). Ogni componente è limitata a 0-100;
se una manca, i pesi si ridistribuiscono. 80+ pronto, 65-79 discreto, 50-64 con calma, sotto 50 recupero.

## Note della notte

CO2 sopra 1000 ppm per più di un'ora, camera sopra i 20,5 °C, valori insoliti (respirazione,
battito nel sonno e a riposo, HRV, minuti svegli: distanza dalla mediana delle 60 notti precedenti
oltre 2,5 deviazioni assolute mediane).

## Motore di analisi

- **Fattori**: ora di addormentamento, scarto dall'orario abituale (mediana delle 7 notti prima),
  passi e stress del giorno prima, CO2, temperatura e umidità della camera nella finestra di sonno,
  weekend.
- **Risultati**: sleep score, HRV notturna, battito a riposo, Body Battery al risveglio, sonno profondo.
- Non si correla il punteggio con le sue componenti (durata, fasi, stress nel sonno): sarebbe banale.
- Correlazione di Spearman con p-value da test di permutazione (1500 rimescolamenti); per il weekend
  differenza tra medie con permutazione. Almeno 12 notti per coppia.
- Correzione di Benjamini-Hochberg (FDR 10 %) su tutte le coppie, poi solo effetti con |rho| ≥ 0,25.
  Al massimo 2 risultati per fattore, 8 in tutto. "Evidenza forte" se p < 0,01 e |rho| ≥ 0,4.
- I risultati si leggono per terzili del fattore (medie del risultato nel terzo basso, medio, alto).
- **Tendenze**: ultime 14 notti contro le 28 precedenti, permutazione, solo se p < 0,05 e la differenza
  è almeno 0,4 deviazioni standard. Peso: pendenza Theil-Sen sugli ultimi 6 mesi.
- **Sto ancora imparando**: fattori della camera con meno di 12 notti, con barra di avanzamento.
- L'analisi si calcola la prima volta che serve (Oggi o Analisi), non all'apertura.
- Il generatore casuale ha un seme fisso, così la pagina dà sempre gli stessi risultati sugli stessi dati.
