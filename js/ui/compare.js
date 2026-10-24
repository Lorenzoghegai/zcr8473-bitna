import { state, toggleIn, save } from '@app/js/state.js';
import { esc, productImage, wireImageFallbacks, badge } from '@app/js/ui/dom.js';
import { euro, cm, range, int, STATUS_LABEL, WIDTH_LABEL, ARMS_LABEL, SHIP_LABEL } from '@app/js/logic/format.js';
import { eurPerPoint, valueTotal } from '@app/js/logic/value.js';

const epp = (e) => eurPerPoint(valueTotal(e), e.score.quality);

// Ogni riga: etichetta, valore da mostrare, valore numerico per evidenziare il migliore.
const ROWS = [
  ['Stato', (e) => badge(e.assess.status, STATUS_LABEL[e.assess.status])],
  ['Negozio', (e) => `${esc(e.chair.store)}<div class="small muted">${esc(e.chair.seller)}</div>`],
  ['Totale', (e) => (e.assess.budget.total != null ? euro(e.assess.budget.total) : `${euro(e.chair.price)} + spedizione`), (e) => e.assess.budget.total ?? e.chair.price, 'min'],
  ['Spedizione', (e) => esc(SHIP_LABEL[e.chair.shipping.status])],
  ['Larghezza', (e) => `${e.assess.width.value != null ? cm(e.assess.width.value) : 'n.d.'}<div class="small muted">${esc(WIDTH_LABEL[e.assess.width.status])}</div>`, (e) => e.assess.width.value, 'min'],
  ['Braccioli da terra (min)', (e) => (e.chair.arms?.type === 'nessuno' ? 'senza braccioli' : `${e.assess.arms.value != null ? cm(e.assess.arms.value) : 'n.d.'}<div class="small muted">${esc(ARMS_LABEL[e.assess.arms.status])}</div>`), (e) => (e.chair.arms?.type === 'nessuno' ? 0 : e.assess.arms.value), 'min'],
  ['Tipo braccioli', (e) => esc(e.chair.arms?.type || '—')],
  ['Profondità', (e) => (e.chair.depth?.v ? cm(e.chair.depth.v) : 'n.d.'), (e) => e.chair.depth?.v, 'min'],
  ['Altezza seduta', (e) => range(e.chair.seatHeight)],
  ['Seduta L × P', (e) => `${e.chair.seat?.w ? cm(e.chair.seat.w) : '—'} × ${e.chair.seat?.d ? cm(e.chair.seat.d) : '—'}`],
  ['Inclinazione', (e) => esc(e.chair.tilt?.kind || 'non dichiarata') + (e.chair.tilt?.range ? `<div class="small muted">${esc(e.chair.tilt.range)}</div>` : '')],
  ['Supporto lombare', (e) => esc(e.chair.lumbar || '—')],
  ['Poggiatesta', (e) => esc(e.chair.headrest || '—')],
  ['Regolazioni (punteggio)', (e) => `${Math.round(e.score.parts.regolazioni * 100)}%`, (e) => e.score.parts.regolazioni, 'max'],
  ['Portata', (e) => (e.chair.maxLoad?.v ? `${e.chair.maxLoad.v} kg` : '—'), (e) => e.chair.maxLoad?.v, 'max'],
  ['Valutazione', (e) => (e.chair.rating ? `★ ${String(e.chair.rating.v).replace('.', ',')} (${int(e.chair.rating.n)})` : '—'), (e) => e.score.bayes, 'max'],
  ['Garanzia / reso', (e) => `${esc(e.chair.warranty || '—')}<div class="small muted">${esc(e.chair.returns || '')}</div>`],
  ['Punteggio editoriale', (e) => `${String(e.score.value).replace('.', ',')}/100`, (e) => e.score.value, 'max'],
  ['Indice di qualità (senza prezzo)', (e) => `${String(e.score.quality).replace('.', ',')}/100`, (e) => e.score.quality, 'max'],
  ['Euro per punto di qualità', (e) => (epp(e) != null ? `${epp(e).toFixed(2).replace('.', ',')} €${e.assess.budget.total == null ? '<div class="small muted">sul solo prezzo</div>' : ''}` : '—'), (e) => epp(e), 'min'],
];

export function render(root, ctx) {
  const list = state.compare.map((id) => ctx.byId.get(id)).filter(Boolean);
  if (list.length !== state.compare.length) { state.compare = list.map((e) => e.chair.id); save(); }
  if (!list.length) {
    root.innerHTML = `<h1>Confronto</h1><div class="panel empty">Nessuna sedia selezionata. Dal <a href="#/catalogo">catalogo</a> premi «Confronta» su 2–4 modelli.</div>`;
    return;
  }
  const best = ROWS.map(([, , num, dir]) => {
    if (!num) return null;
    const vals = list.map(num).filter((v) => v != null);
    if (vals.length < 2) return null;
    return dir === 'min' ? Math.min(...vals) : Math.max(...vals);
  });
  root.innerHTML = `
    <div class="toolbar"><h1>Confronto affiancato</h1><button class="btn" id="clear">Svuota confronto</button></div>
    <p class="muted small">In verde il valore migliore della riga tra le sedie confrontate. «n.d.» = dato non documentato.</p>
    <div class="compare-wrap"><table class="compare">
      <thead><tr><th></th>${list.map((e) => `<td><a href="#/sedia/${encodeURIComponent(e.chair.id)}">${productImage(e.chair)}</a><div><strong>${esc(e.chair.brand)} ${esc(e.chair.model)}</strong></div>
        <div class="btn-row" style="margin-top:6px"><a class="btn" href="#/stanza/${encodeURIComponent(e.chair.id)}">Stanza 3D</a><button class="btn" data-rm="${esc(e.chair.id)}">Rimuovi</button></div></td>`).join('')}</tr></thead>
      <tbody>${ROWS.map(([label, show, num], i) => `<tr><th>${esc(label)}</th>${list.map((e) => `<td class="${best[i] != null && num(e) === best[i] ? 'best' : ''}">${show(e)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
  wireImageFallbacks(root);
  root.querySelector('#clear').addEventListener('click', () => { state.compare = []; save(); ctx.updateCounts(); render(root, ctx); });
  root.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { toggleIn('compare', b.dataset.rm); ctx.updateCounts(); render(root, ctx); }));
}
