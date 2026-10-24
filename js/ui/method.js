import { state, save } from '@app/js/state.js';
import { esc } from '@app/js/ui/dom.js';
import { DEFAULT_WEIGHTS, WEIGHT_LABELS } from '@app/js/logic/score.js';

export function render(root, ctx) {
  const cat = ctx.data.catalog;
  const stores = Object.entries(cat.stores);
  const total = Object.values(state.weights).reduce((a, b) => a + b, 0);
  root.innerHTML = `
    <div class="prose">
      <h1>Metodo e fonti</h1>
      <div class="panel">
        <h2>1. Vincoli (vengono prima di tutto)</h2>
        <ul class="tight">
          <li><strong>Larghezza ≤ ${cat.constraints.maxWidthCm} cm</strong> sull'ingombro reale (braccioli e base). Se la base è nota solo come diametro Φ, l'ingombro laterale massimo di una stella a 5 razze è Φ × sin 72° ≈ 0,951 Φ: è un <em>dato derivato</em> e porta la sedia tra le «da verificare», mai tra le verificate.</li>
          <li><strong>Braccioli ≤ ${cat.constraints.maxArmHeightCm} cm da terra</strong> con la seduta alla minima altezza. Se il venditore indica l'altezza dei braccioli sopra la seduta, la quota da terra è ricavata sommando l'altezza minima della seduta (calcolo mostrato in scheda). Un valore unico ≤ 69 cm vale come limite superiore. Braccioli ribaltabili oltre il limite: «solo con braccioli sollevati» (compromesso).</li>
          <li><strong>Totale ≤ ${cat.budgetEur} €</strong> IVA e spedizione incluse. Spedizione variabile → caso peggiore; spedizione non visibile → «probabile», non verificata. Solo gli sconti verificati riducono il totale; coupon e codici non provati al checkout restano «pubblicizzati».</li>
          <li><strong>Spazio di ${cat.constraints.spaceBehindTableCm} cm</strong>: verifica geometrica indicativa nella stanza 3D (profondità, quanto la sedia entra sotto il piano, arretramento per alzarsi, reclinazione), con ipotesi modificabili.</li>
        </ul>
        <p class="small">Esito: <strong>idonea</strong> = tutti i vincoli verificati con dati documentati (o derivati per semplice somma di quote); <strong>da verificare</strong> = nessun vincolo violato ma almeno un dato mancante, ambiguo o derivato da ipotesi; <strong>esclusa</strong> = vincolo violato, non disponibile, non nuova o tipologia non adatta.</p>
      </div>

      <div class="panel">
        <h2>2. Punteggio editoriale (solo per ordinare le idonee)</h2>
        <p class="small">Somma pesata di componenti tra 0 e 1. Non è una misura scientifica: puoi cambiare i pesi e le classifiche si aggiornano.</p>
        <div class="weights" id="weights">
          ${Object.keys(DEFAULT_WEIGHTS).map((k) => `<label><span>${esc(WEIGHT_LABELS[k])}</span><input type="range" min="0" max="50" step="1" data-w="${k}" value="${state.weights[k]}"><output>${state.weights[k]}</output></label>`).join('')}
        </div>
        <p class="small muted">Somma pesi: <span id="wsum">${total}</span> (normalizzata). <button class="btn" id="wreset">Ripristina pesi</button></p>
        <ul class="tight small">
          <li><strong>Regolazioni</strong>: altezza seduta, tipo di inclinazione (oscillante / con tensione / bloccabile), braccioli (fissi → ribaltabili → regolabili 3D), lombare (fisso → regolabile → 2D/4D), poggiatesta, schienale pieghevole. Solo funzioni dichiarate.</li>
          <li><strong>Recensioni</strong>: media ponderata bayesiana (prior 4,0 con peso 100 valutazioni), così 4,8 su 11 recensioni non supera 4,4 su 8.000.</li>
          <li><strong>Prezzo</strong>: lineare tra 50 € (massimo) e 120 € (zero) sul totale.</li>
          <li><strong>Margini</strong>: centimetri di margine su larghezza e braccioli; i dati derivati valgono la metà.</li>
          <li><strong>Robustezza</strong>: portata dichiarata, garanzia oltre i 2 anni, resi estesi, certificazioni dichiarate (peso minimo perché non verificate).</li>
          <li><strong>Completezza</strong>: quota di dati chiave documentati.</li>
        </ul>
      </div>

      <div class="panel">
        <h2>3. Rapporto qualità-prezzo</h2>
        <ul class="tight small">
          <li><strong>Indice di qualità (0–100)</strong>: le stesse componenti del punteggio che descrivono la sedia — regolazioni, recensioni, robustezza — con i pesi qui sopra, rinormalizzati tra loro. Prezzo, margini sui vincoli e completezza dei dati restano fuori: così la qualità si può mettere a confronto con il costo. Se i tre pesi sono tutti a zero, contano allo stesso modo.</li>
          <li><strong>Euro per punto</strong>: totale (spedizione inclusa) diviso per l'indice; per le sedie con spedizione non verificata si usa il solo prezzo e lo si dichiara. La «Miglior rapporto qualità-prezzo» delle Scelte è l'idonea con meno euro per punto.</li>
          <li><strong>Frontiera di Pareto</strong>: le idonee che nessun'altra idonea batte insieme su totale e indice. Per ogni passo della frontiera è mostrato quanto costa ogni punto di qualità in più. Le altre sedie hanno almeno un'alternativa che costa non di più e vale non di meno.</li>
          <li>È un ordinamento di dati dichiarati, non una misura di comfort o durata: le componenti senza dati (per esempio nessuna recensione) valgono zero e l'indice è prudente.</li>
        </ul>
      </div>

      <div class="panel">
        <h2>4. Raccolta dei dati</h2>
        <p class="small">Rilevazione del ${esc(cat.checkWindow)} con navigazione diretta delle schede prodotto (non dei soli risultati sponsorizzati). Misure da schede tecniche, testi e diagrammi quotati ufficiali delle gallerie; quando le fonti divergono la discrepanza è conservata nella scheda («Dati mancanti, contraddittori o da confermare»). Le valutazioni Amazon possono aggregare più varianti della stessa inserzione.</p>
        <h3>Condizioni dei negozi rilevate</h3>
        <ul class="tight small">${stores.map(([name, s]) => `<li><strong>${esc(name)}</strong>: ${esc(s.shipping)} ${esc(s.returns || '')} ${s.priceRefs ? esc(s.priceRefs) : ''}</li>`).join('')}</ul>
        <p class="small">${esc(cat.legal)}</p>
      </div>

      <div class="panel">
        <h2>5. Limiti</h2>
        <ul class="tight small">
          <li>Prezzi, coupon e disponibilità cambiano: nessun aggiornamento automatico (non esiste un'integrazione consentita con i negozi).</li>
          <li>Costi di spedizione dei venditori terzi Amazon e di JYSK a domicilio non visibili senza account/carrello; home24 quotato con un CAP di riferimento (50122).</li>
          <li>Le misure della stanza diverse da quelle fornite (90 cm, 69 cm, 69 cm) sono stime dalle foto, modificabili nella pagina Stanza 3D.</li>
          <li>I modelli 3D delle sedie sono ricostruzioni parametriche approssimate o semplici ingombri: nessun modello 3D ufficiale è stato usato.</li>
          <li>Le verifiche geometriche non valutano comfort, postura o idoneità all'uso prolungato.</li>
        </ul>
      </div>
    </div>`;

  root.querySelectorAll('input[data-w]').forEach((inp) => inp.addEventListener('input', () => {
    state.weights[inp.dataset.w] = +inp.value;
    inp.nextElementSibling.textContent = inp.value;
    root.querySelector('#wsum').textContent = Object.values(state.weights).reduce((a, b) => a + b, 0);
    save();
    ctx.recompute();
  }));
  root.querySelector('#wreset').addEventListener('click', () => { state.weights = { ...DEFAULT_WEIGHTS }; save(); ctx.recompute(); render(root, ctx); });
}
