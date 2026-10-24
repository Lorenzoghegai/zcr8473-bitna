# Sedie da lavoro entro 120 € — catalogo, qualità-prezzo e stanza 3D

Ricerca documentata delle sedie da lavoro da casa con **budget massimo di 120 € complessivi** (IVA, spedizione e costi obbligatori inclusi) e una web app statica per confrontarle, valutarne il rapporto qualità-prezzo e vederle in 3D nella postazione.

Vincoli: larghezza d'ingombro ≤ 69 cm (braccioli e base inclusi), braccioli ≤ 69 cm da terra nella configurazione sotto il tavolo, 90 cm tra bordo del tavolo e muro. Dati rilevati il 24/10/2026, 11:30–12:10: **66 modelli**, 15 idonei, 30 da verificare, 21 esclusi. Il riepilogo completo è in [`research/REPORT.md`](research/REPORT.md).

## Avvio

| Cosa | Come |
|---|---|
| Usare l'app | doppio clic su **`Sedie-120.html`** (oppure `avvia.bat`): file unico, nessun server, nessuna installazione |
| Sviluppo e test | `avvia-con-server.bat` oppure `python tools/serve.py --open` → app su `http://localhost:8765/`, test su `http://localhost:8765/tests/` |

`Sedie-120.html` è generato dai sorgenti: **va rigenerato dopo ogni modifica** a dati, CSS o codice (vedi sotto).

## Pagine dell'app

- **Catalogo** — ricerca, filtri (esito, dimensioni, prezzo, braccioli, caratteristiche, negozio, preferiti, *solo frontiera qualità-prezzo*), ordinamenti (anche per € per punto di qualità), preferiti ed **esportazione CSV** per Excel dei modelli mostrati.
- **Scelte** — migliore complessiva, **miglior rapporto qualità-prezzo**, spazio ridotto, regolazioni, offerta verificata, alternative, promettenti da verificare, e un controllo di **solidità della prima scelta** (cosa succede variando i pesi del ±50%).
- **Qualità/prezzo** — grafico totale/indice di qualità con la **frontiera di Pareto**, il costo di ogni punto di qualità in più lungo la frontiera e, per ogni sedia battuta, l'alternativa migliore e meno cara. Opzione per includere le «da verificare».
- **Confronto** — fino a 4 sedie affiancate, con il migliore valore evidenziato per riga.
- **Stanza 3D** — postazione parametrica (Three.js r160) con viste prospettica, dall'alto, laterale e schema 2D; trascinamento, posizione, rotazione, seduta, braccioli, reclinazione, spostamento del tavolo, verifiche geometriche e misure modificabili. Le sedie sono ricostruzioni approssimate.
- **Convenzioni** — convenzioni aziendali e calcolatore dell'esborso reale con le gift card home24.
- **Metodo e fonti** — vincoli, punteggio con **pesi modificabili**, indice di qualità, condizioni dei negozi e limiti.
- **Scheda prodotto** — prezzo e totale, calcoli dei vincoli, caratteristiche, recensioni, rapporto qualità-prezzo con alternative, discrepanze tra fonti e link alle fonti.

## Come si valuta

1. **Vincoli prima di tutto** (`js/logic/compat.js`): esito *idonea* / *da verificare* / *esclusa*. Base a stella nota solo come diametro Φ > 69 cm → ingombro derivato Φ·sin 72° e sedia «da verificare»; braccioli da terra documentati o ricavati (seduta minima + quota sulla seduta); spedizione a intervallo calcolata sul caso peggiore, «gratis solo al primo ordine» o non visibile = totale non verificato.
2. **Punteggio editoriale 0–100** (`js/logic/score.js`), solo per ordinare le idonee: regolazioni 30, recensioni (media bayesiana) 20, prezzo 20, margini 15, robustezza 10, completezza 5. Pesi modificabili nell'app.
3. **Indice di qualità 0–100** (`js/logic/value.js`): le componenti che descrivono la sedia (regolazioni, recensioni, robustezza) senza prezzo; da qui **€ per punto** e **frontiera di Pareto** tra le idonee.

Con i pesi predefiniti la prima scelta (Yaheetech YP-136N, 66,1) supera la JYSK NIMTOFTE (65,7) di soli 0,4 punti e resta prima in 8 varianti dei pesi su 12: la pagina Scelte lo dichiara. Il miglior rapporto qualità-prezzo (NIMTOFTE, 1,22 € per punto, con ritiro in negozio) e la frontiera restano invece gli stessi in tutte le varianti.

## Struttura

```
index.html            app per lo sviluppo (moduli ES, import map con prefisso @app/)
Sedie-120.html        app a file unico generata (dati, CSS, codice e Three.js incorporati)
css/style.css         stili (tema chiaro/scuro automatico)
data/
  catalog.json        vincoli, data di rilevazione, file per negozio, condizioni dei negozi
  sources/*.json      schede delle sedie, un file per negozio
  conventions.json    convenzioni aziendali e tagli delle gift card
  room.json           misure della stanza (fornite / derivate / stimate / ipotesi)
js/
  main.js             router delle pagine        context.js  dati + valutazioni condivisi
  data.js             caricamento dei dati       state.js    stato salvato in localStorage
  logic/              funzioni pure: compat, score, value, geometry, giftcard, csv, format
  ui/                 pagine: catalog, picks, value, compare, detail, room, schematic, conventions, method
  three/scene3d.js    scena 3D
vendor/three/         Three.js r160 (licenza MIT, vedi vendor/three/LICENSE)
tests/                test nel browser (/tests/) e in Node
tools/                serve.py, build_standalone.py, validate_data.py, run_tests.mjs, make_report.mjs
research/REPORT.md    report generato dai dati
```

Gli import interni usano il prefisso `@app/` (mappato dall'import map) perché nel file unico ogni modulo è un URL `data:` e i percorsi relativi non funzionerebbero.

## Aggiornare i dati

1. Modifica le schede in `data/sources/*.json` (o aggiungi un file ed elencalo in `catalog.json` → `files`). Campi principali di una scheda: `id`, `name`, `brand`, `model`, `code`, `store`, `seller`, `url`, `price`, `priceRef` (`consigliato` | `mediano` | `minimo-30gg` | `precedente` | `listino`), `shipping` (`gratuita` | `fissa` | `intervallo` | `ritiro-gratuito` | `primo-ordine` | `sconosciuta`), `widths` (`ingombro` | `base` | `base-diametro` | `braccioli`, ognuna con la fonte `src`), `arms` (`type`, `min`/`max` da terra o `single`, `derived`, `refUncertain`), `seatHeight`, `depth`, `tilt`, `lumbar`, `headrest`, `maxLoad`, `rating` (`v`, `n`, `platform`), `pros`, `cons`, `issues` (discrepanze tra fonti), `sources`, `exclude` (`reason`).
2. Aggiorna `checkedDate` e `checkWindow` in `data/catalog.json`.
3. Mai inventare valori: ciò che manca resta assente (l'app lo mostra «da verificare»), le discrepanze vanno in `issues`.
4. Esegui, in quest'ordine:

```
python tools/validate_data.py                         # coerenza dei dati
node --import ./tests/app-loader.mjs tests/run-node.mjs   # test di logica (senza browser)
python tools/serve.py --open                          # poi apri /tests/: tutti i test
python tools/build_standalone.py                      # rigenera Sedie-120.html
node --import ./tests/app-loader.mjs tools/make_report.mjs # rigenera research/REPORT.md
```

`python tools/build_standalone.py --check` dice se `Sedie-120.html` è allineato ai sorgenti senza riscriverlo. Alcuni test fissano i risultati attesi con i dati attuali (15 idonee, scelte, frontiera): se aggiorni prezzi o misure, aggiornali di conseguenza.

## Test

- **Nel browser**: `http://localhost:8765/tests/` con il server avviato. 46 test: logica (vincoli, punteggio, qualità-prezzo, geometria, gift card, CSV), invarianti sui dati rilevati e disegno di tutte le pagine. Usano una chiave di salvataggio propria e non toccano le impostazioni dell'app; non contattano siti esterni.
- **Senza finestra**: `node tools/run_tests.mjs` (richiede Node e Playwright con Chromium).
- **Solo logica, in Node**: `node --import ./tests/app-loader.mjs tests/run-node.mjs`.

## Privacy e limiti

- Nessun acquisto, registrazione o invio di dati: preferiti, pesi, configurazione della stanza restano nel `localStorage` del browser. Le immagini dei prodotti sono caricate dai siti dei negozi e si possono disattivare dal catalogo.
- Le foto della stanza non sono nel progetto: le misure diverse da 90/69/69 cm sono stime modificabili in `data/room.json` o nella pagina Stanza 3D.
- Prezzi e disponibilità non si aggiornano da soli; spedizioni dei venditori terzi Amazon e consegna JYSK a domicilio sono visibili solo nel carrello.
- Punteggio e indice di qualità ordinano dati dichiarati dai venditori: non misurano comfort, durata o postura.

## Nota sulla ricostruzione (24/10/2026)

Il repository è stato ricostruito a partire dal file unico `Sedie-120.html`, che conteneva codice, dati e Three.js: `tools/build_standalone.py` rigenera da questi sorgenti un file identico all'originale (a parte i fine riga). Strumenti, test, README e report non erano inclusi nel file unico e sono stati riscritti: la suite di test è nuova (46 test, non i 34 originali), `research/REPORT.md` è generato dai dati e gli appunti grezzi `research/note-raccolta.md` non sono disponibili.
