import { state, save, toggleIn } from '@app/js/state.js';
import { esc, productImage, wireImageFallbacks, badge, toast } from '@app/js/ui/dom.js';
import { euro, cm, int, STATUS_LABEL, SHIP_LABEL, REF_LABEL } from '@app/js/logic/format.js';

const DEFAULT_FILTERS = {
  q: '',
  statuses: ['idonea', 'da-verificare', 'esclusa'],
  dims: ['verificata', 'probabile', 'incompatibile'],
  stores: [],
  maxTotal: 260,
  maxWidth: 80,
  includeUnknownWidth: true,
  arms: 'any',
  features: [],
  favOnly: false,
};

const FEATURES = {
  lombare: { label: 'Lombare regolabile/adattivo', test: (c) => /regolabil|adattiv|4d|2d/i.test(c.lumbar || '') && !/non regolabil/i.test(c.lumbar || '') },
  poggiatesta: { label: 'Poggiatesta', test: (c) => c.headrest && !/^nessuno/i.test(c.headrest) },
  inclinazione: { label: 'Inclinazione con tensione o blocco', test: (c) => ['oscillante-tensione', 'bloccabile'].includes(c.tilt?.kind) },
  rete: { label: 'Schienale/seduta in rete', test: (c) => c.type === 'rete' },
  consegna: { label: 'Consegna a casa verificata', test: (c) => ['gratuita', 'fissa', 'intervallo'].includes(c.shipping?.status) },
};

const SORTS = {
  score: { label: 'Punteggio (desc.)', fn: (a, b) => statusRank(a) - statusRank(b) || b.score.value - a.score.value },
  price: { label: 'Prezzo finale (cresc.)', fn: (a, b) => total(a) - total(b) },
  width: { label: 'Larghezza (cresc.)', fn: (a, b) => (a.assess.width.value ?? 999) - (b.assess.width.value ?? 999) },
  arms: { label: 'Altezza braccioli (cresc.)', fn: (a, b) => armVal(a) - armVal(b) },
  depth: { label: 'Profondità (cresc.)', fn: (a, b) => (a.chair.depth?.v ?? 999) - (b.chair.depth?.v ?? 999) },
  rating: { label: 'Valutazione (desc.)', fn: (a, b) => (b.chair.rating?.v ?? 0) - (a.chair.rating?.v ?? 0) },
  reviews: { label: 'Numero recensioni (desc.)', fn: (a, b) => (b.chair.rating?.n ?? 0) - (a.chair.rating?.n ?? 0) },
};

const statusRank = (e) => ({ idonea: 0, 'da-verificare': 1, esclusa: 2 }[e.assess.status]);
const total = (e) => e.assess.budget.total ?? e.chair.price;
const armVal = (e) => (e.chair.arms?.type === 'nessuno' ? 0 : e.assess.arms.value ?? 999);

function filters() {
  if (!state.filters) state.filters = structuredClone(DEFAULT_FILTERS);
  return { ...DEFAULT_FILTERS, ...state.filters };
}

export function applyFilters(list, f) {
  const q = f.q.trim().toLowerCase();
  return list.filter((e) => {
    const c = e.chair;
    if (q && !`${c.name} ${c.brand} ${c.model} ${c.store} ${c.seller} ${c.code}`.toLowerCase().includes(q)) return false;
    if (!f.statuses.includes(e.assess.status)) return false;
    if (!f.dims.includes(e.assess.dims)) return false;
    if (f.stores.length && !f.stores.includes(c.store)) return false;
    if (total(e) > f.maxTotal) return false;
    const w = e.assess.width.value;
    if (w == null ? !f.includeUnknownWidth : w > f.maxWidth) return false;
    if (f.arms !== 'any') {
      const t = c.arms?.type || '';
      if (f.arms === 'nessuno' && t !== 'nessuno') return false;
      if (f.arms === 'ribaltabili' && !t.startsWith('ribaltabili')) return false;
      if (f.arms === 'regolabili' && !/regolabili/.test(t)) return false;
      if (f.arms === 'fissi' && !['fissi', 'integrati'].includes(t)) return false;
    }
    for (const k of f.features) if (!FEATURES[k].test(c)) return false;
    if (f.favOnly && !state.favorites.includes(c.id)) return false;
    return true;
  });
}

function card(e) {
  const c = e.chair;
  const a = e.assess;
  const fav = state.favorites.includes(c.id);
  const inCmp = state.compare.includes(c.id);
  const ship = SHIP_LABEL[c.shipping?.status] || '';
  const totalTxt = a.budget.total != null ? euro(a.budget.total) : `${euro(c.price)} + sped.`;
  const disc = e.discount?.reliable ? `<span class="chip ok" title="Rispetto al ${esc(REF_LABEL[e.discount.ref.kind])} di ${euro(e.discount.ref.v)}">−${e.discount.pct}% vs ${esc(REF_LABEL[e.discount.ref.kind])}</span>` : '';
  const wCls = { ok: 'ok', derivata: 'warn', parziale: 'warn', mancante: 'warn', incompatibile: 'bad' }[a.width.status];
  const aCls = { ok: 'ok', compromesso: 'warn', incerta: 'warn', mancante: 'warn', incompatibile: 'bad' }[a.arms.status];
  const armsTxt = c.arms?.type === 'nessuno' ? 'senza braccioli' : a.arms.value != null ? `braccioli ${cm(a.arms.value)}` : 'braccioli n.d.';
  return `<article class="card chair-card" data-id="${esc(c.id)}">
    <div class="thumb">${productImage(c)}${badge(a.status, STATUS_LABEL[a.status])}
      <button class="fav" data-act="fav" aria-pressed="${fav}" title="${fav ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}">${fav ? '♥' : '♡'}</button></div>
    <div class="body">
      <div class="store">${esc(c.store)} · ${esc(c.seller)}</div>
      <a class="name" href="#/sedia/${encodeURIComponent(c.id)}" title="${esc(c.name)}">${esc(c.brand)} ${esc(c.model)}</a>
      <div class="price">${totalTxt} <small>${esc(ship)}</small></div>
      <div class="chips">${disc}
        <span class="chip ${wCls}">L ${a.width.value != null ? cm(a.width.value) : 'n.d.'}</span>
        <span class="chip ${aCls}">${armsTxt}</span>
        ${c.depth?.v ? `<span class="chip">P ${cm(c.depth.v)}</span>` : ''}
      </div>
      <div class="small muted">${c.rating ? `★ ${String(c.rating.v).replace('.', ',')} · ${int(c.rating.n)} recensioni` : 'Nessuna recensione rilevata'} · punteggio ${String(e.score.value).replace('.', ',')}</div>
      <div class="actions">
        <a class="btn" href="#/sedia/${encodeURIComponent(c.id)}">Dettagli</a>
        <button class="btn ${inCmp ? 'on' : ''}" data-act="cmp" aria-pressed="${inCmp}">${inCmp ? '✓ In confronto' : 'Confronta'}</button>
        <a class="btn primary" href="#/stanza/${encodeURIComponent(c.id)}" style="grid-column:1/-1">Vedi nella stanza</a>
      </div>
    </div>
  </article>`;
}

export function render(root, ctx) {
  const f = filters();
  const stores = [...new Set(ctx.evaluated.map((e) => e.chair.store))].sort();
  const chk = (name, value, list, label) => `<label><input type="checkbox" data-f="${name}" value="${esc(value)}" ${list.includes(value) ? 'checked' : ''}> ${esc(label)}</label>`;

  root.innerHTML = `
    <div class="toolbar">
      <div><h1>Catalogo</h1><p class="muted small" style="margin:0">Tutti i modelli analizzati, con stato di idoneità calcolato dai vincoli (larghezza ≤ 69 cm, braccioli ≤ 69 cm da terra, totale ≤ 120 €).</p></div>
      <div class="btn-row">
        <button class="btn filter-toggle" id="ftoggle">Filtri</button>
        <label class="small">Ordina <select id="sort">${Object.entries(SORTS).map(([k, s]) => `<option value="${k}" ${state.sort === k ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
      </div>
    </div>
    <div class="catalog">
      <aside class="filters panel" id="filters" aria-label="Filtri">
        <h3>Cerca</h3>
        <input type="search" id="q" placeholder="Nome, marca, modello, negozio" value="${esc(f.q)}">
        <h3>Esito</h3>
        ${chk('statuses', 'idonea', f.statuses, 'Idonee')}${chk('statuses', 'da-verificare', f.statuses, 'Da verificare')}${chk('statuses', 'esclusa', f.statuses, 'Escluse')}
        <h3>Compatibilità dimensionale</h3>
        ${chk('dims', 'verificata', f.dims, 'Verificata')}${chk('dims', 'probabile', f.dims, 'Probabile, da confermare')}${chk('dims', 'incompatibile', f.dims, 'Incompatibile')}
        <h3>Prezzo finale <span class="rangeval" id="vt">≤ ${euro(f.maxTotal)}</span></h3>
        <input type="range" id="maxTotal" min="40" max="260" step="5" value="${f.maxTotal}">
        <h3>Larghezza <span class="rangeval" id="vw">≤ ${f.maxWidth} cm</span></h3>
        <input type="range" id="maxWidth" min="45" max="80" step="1" value="${f.maxWidth}">
        <label><input type="checkbox" id="unkW" ${f.includeUnknownWidth ? 'checked' : ''}> Includi larghezza non documentata</label>
        <h3>Braccioli</h3>
        <select id="arms">
          ${[['any', 'Qualsiasi'], ['nessuno', 'Senza braccioli'], ['fissi', 'Fissi/integrati'], ['ribaltabili', 'Ribaltabili'], ['regolabili', 'Regolabili']].map(([v, l]) => `<option value="${v}" ${f.arms === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <h3>Caratteristiche</h3>
        ${Object.entries(FEATURES).map(([k, v]) => chk('features', k, f.features, v.label)).join('')}
        <h3>Negozio</h3>
        ${stores.map((s) => chk('stores', s, f.stores, s)).join('')}
        <h3>Altro</h3>
        <label><input type="checkbox" id="favOnly" ${f.favOnly ? 'checked' : ''}> Solo preferiti (${state.favorites.length})</label>
        <label><input type="checkbox" id="imgs" ${state.showImages ? 'checked' : ''}> Mostra immagini dei negozi</label>
        <p class="small muted">Le immagini sono caricate dai server dei negozi. Disattivandole non viene contattato nessun sito esterno.</p>
        <button class="btn" id="reset" style="width:100%">Azzera filtri</button>
      </aside>
      <section>
        <div class="toolbar"><div class="legend">${badge('idonea', 'Idonea: vincoli verificati')}${badge('da-verificare', 'Da verificare: dati mancanti o derivati')}${badge('esclusa', 'Esclusa: vincolo non rispettato')}</div><span class="muted small" id="count"></span></div>
        <div class="grid" id="grid"></div>
      </section>
    </div>`;

  const grid = root.querySelector('#grid');
  const draw = () => {
    const ff = filters();
    const list = applyFilters(ctx.evaluated, ff).sort(SORTS[state.sort]?.fn || SORTS.score.fn);
    root.querySelector('#count').textContent = `${list.length} di ${ctx.evaluated.length} modelli`;
    grid.innerHTML = list.length ? list.map(card).join('') : '<div class="empty">Nessun modello con questi filtri.</div>';
    wireImageFallbacks(grid);
  };
  const setF = (patch) => { state.filters = { ...filters(), ...patch }; save(); draw(); };

  root.querySelector('#q').addEventListener('input', (ev) => setF({ q: ev.target.value }));
  root.querySelector('#sort').addEventListener('change', (ev) => { state.sort = ev.target.value; save(); draw(); });
  root.querySelector('#maxTotal').addEventListener('input', (ev) => { root.querySelector('#vt').textContent = `≤ ${euro(+ev.target.value)}`; setF({ maxTotal: +ev.target.value }); });
  root.querySelector('#maxWidth').addEventListener('input', (ev) => { root.querySelector('#vw').textContent = `≤ ${ev.target.value} cm`; setF({ maxWidth: +ev.target.value }); });
  root.querySelector('#unkW').addEventListener('change', (ev) => setF({ includeUnknownWidth: ev.target.checked }));
  root.querySelector('#arms').addEventListener('change', (ev) => setF({ arms: ev.target.value }));
  root.querySelector('#favOnly').addEventListener('change', (ev) => setF({ favOnly: ev.target.checked }));
  root.querySelector('#imgs').addEventListener('change', (ev) => { state.showImages = ev.target.checked; save(); draw(); });
  root.querySelector('#reset').addEventListener('click', () => { state.filters = structuredClone(DEFAULT_FILTERS); save(); render(root, ctx); });
  root.querySelector('#ftoggle').addEventListener('click', () => root.querySelector('#filters').classList.toggle('open'));
  root.querySelectorAll('input[data-f]').forEach((el) => el.addEventListener('change', () => {
    const name = el.dataset.f;
    const vals = [...root.querySelectorAll(`input[data-f="${name}"]:checked`)].map((x) => x.value);
    setF({ [name]: vals });
  }));
  grid.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.closest('[data-id]').dataset.id;
    if (btn.dataset.act === 'fav') toggleIn('favorites', id);
    if (btn.dataset.act === 'cmp' && !toggleIn('compare', id, 4)) toast('Puoi confrontare al massimo 4 sedie: rimuovine una dalla pagina Confronto.');
    ctx.updateCounts();
    draw();
  });
  draw();
}
