import { loadAll } from '@app/js/data.js';
import { evaluate, picks } from '@app/js/logic/score.js';
import { state, save } from '@app/js/state.js';
import { esc } from '@app/js/ui/dom.js';
import * as catalog from '@app/js/ui/catalog.js';
import * as detail from '@app/js/ui/detail.js';
import * as compare from '@app/js/ui/compare.js';
import * as choices from '@app/js/ui/picks.js';
import * as value from '@app/js/ui/value.js';
import * as method from '@app/js/ui/method.js';
import * as conventions from '@app/js/ui/conventions.js';
import * as room from '@app/js/ui/room.js';

const app = document.getElementById('app');
const ctx = { data: null, evaluated: [], byId: new Map(), picks: null };

const ROUTES = {
  catalogo: catalog,
  sedia: detail,
  confronto: compare,
  scelte: choices,
  valore: value,
  metodo: method,
  convenzioni: conventions,
  stanza: room,
};

ctx.recompute = function recompute() {
  ctx.evaluated = evaluate(ctx.data.chairs, state.weights, ctx.constraints);
  ctx.byId = new Map(ctx.evaluated.map((e) => [e.chair.id, e]));
  ctx.picks = picks(ctx.evaluated);
};

ctx.updateCounts = function updateCounts() {
  document.getElementById('cmp-count').textContent = state.compare.length;
};

ctx.go = (hash) => { location.hash = hash; };

let current = null;

function route() {
  const [name = 'catalogo', ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  const view = ROUTES[name] || catalog;
  if (current?.cleanup) current.cleanup();
  document.querySelectorAll('.mainnav a').forEach((a) => a.classList.toggle('active', a.dataset.route === (ROUTES[name] ? name : 'catalogo') || (name === 'sedia' && a.dataset.route === 'catalogo')));
  current = view;
  try {
    view.render(app, ctx, rest.map(decodeURIComponent));
  } catch (err) {
    console.error(err);
    app.innerHTML = `<div class="panel"><h2>Errore di visualizzazione</h2><p>${esc(err.message)}</p></div>`;
  }
  ctx.updateCounts();
  if (!location.hash.includes('/stanza')) window.scrollTo(0, 0);
}

async function init() {
  try {
    ctx.data = await loadAll('./data/');
  } catch (err) {
    app.innerHTML = `<div class="panel"><h2>Dati non disponibili</h2><p>${esc(err.message)}</p>
      <p>L'app va aperta tramite un piccolo server locale (non con doppio clic sul file): vedi il README, comando <code>python -m http.server 8765</code>.</p></div>`;
    return;
  }
  const { catalog: cat } = ctx.data;
  ctx.constraints = { maxWidthCm: cat.constraints.maxWidthCm, maxArmHeightCm: cat.constraints.maxArmHeightCm, budgetEur: cat.budgetEur };
  ctx.recompute();
  const counts = ctx.evaluated.reduce((m, e) => ((m[e.assess.status] = (m[e.assess.status] || 0) + 1), m), {});
  document.getElementById('databar').innerHTML =
    `Dati rilevati il <strong>${esc(cat.checkWindow)}</strong> · ${ctx.data.chairs.length} modelli analizzati: ` +
    `<strong>${counts.idonea || 0}</strong> idonei, ${counts['da-verificare'] || 0} da verificare, ${counts.esclusa || 0} esclusi · ` +
    'prezzi non aggiornati in tempo reale';
  window.addEventListener('hashchange', route);
  route();
  save();
}

init();
