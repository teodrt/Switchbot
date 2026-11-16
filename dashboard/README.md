# Ritmo: la dashboard

Web app Apps Script nello stesso progetto degli script di raccolta. `apps-script/dashboard.gs` legge
le tre schede del foglio a ogni apertura e passa i dati (`DATA`) a `apps-script/ritmo.html`, che è solo
un caricatore: scarica l'interfaccia (`app/ritmo.js`, `app/ritmo.css`) dall'ultimo commit di `main`
tramite jsDelivr. Per cambiare l'app basta un commit su `main`.

## Sezioni

Capsula di navigazione flottante con 5 sezioni (Oggi, Sonno, Sport, Corpo, Casa), pulsante + per il
check-in, Insight dal pulsante in alto a destra. Ogni sezione ha un suo colore. Tutti i grafici a
linee si scorrono col dito; toccare un punto che è una notte apre quella notte. Dettagli (check-in,
attività, settimana) in schede che salgono dal basso. Sezione e filtri restano in `localStorage`.

1. **Oggi**: anello del recupero con 4 indicatori (sonno, HRV, riposo, energia), check-in, carosello
   "Per te oggi" (note della notte, tendenze, scoperte), timeline delle ultime 7 notti, casa (CO2 su
   semicerchio), sport degli ultimi 7 giorni, corpo con peso a 6 mesi, "La tua settimana", recupero a 30 giorni.
2. **Sonno**: navigazione tra le notti (frecce e swipe), anello, fasi rispetto al solito, HRV, riposo,
   recupero, note, aria della camera, timeline di 14 notti, andamento (8 metriche, 4 periodi), calendario.
3. **Sport**: carico degli ultimi 7 giorni rispetto alla media delle ultime 4 settimane (rapporto
   < 0,8 in calo, 0,8-1,3 equilibrato, 1,3-1,5 in salita, > 1,5 molto alto), minuti a settimana,
   VO2 max, attività recenti con dettaglio e notte successiva.
4. **Corpo**: 6 metriche con periodo, composizione dell'ultima pesata, tendenza, ultime pesate.
5. **Casa**: CO2 attuale su semicerchio, temperatura, umidità, seconda stanza, storico, CO2 per notte.
6. **Insight**: scoperte filtrabili (anche energia, umore, dolore), grafico a punti, andamento di
   energia e umore, tendenze, cosa sta ancora imparando, metodo.

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
  passi, stress e carico di allenamento del giorno prima, CO2, temperatura e umidità della camera
  nella finestra di sonno, weekend; per il check-in anche sleep score e HRV della notte.
- **Risultati**: sleep score, HRV notturna, battito a riposo, Body Battery al risveglio, sonno profondo,
  energia, umore e dolore del check-in dello stesso giorno.
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
