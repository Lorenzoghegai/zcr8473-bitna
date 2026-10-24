import { loadAll } from '@app/js/data.js';
import { createContext } from '@app/js/context.js';
import { save } from '@app/js/state.js';
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
let ctx = null;

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
  let data;
  try {
    data = await loadAll('./data/');
  } catch (err) {
    app.innerHTML = `<div class="panel"><h2>Dati non disponibili</h2><p>${esc(err.message)}</p>
      <p>Per usarla senza server apri <code>Sedie-120.html</code> (doppio clic). Questa versione di sviluppo va aperta con il server locale: <code>avvia-con-server.bat</code> oppure <code>python tools/serve.py --open</code> (vedi il README).</p></div>`;
    return;
  }
  ctx = createContext(data);
  const { catalog: cat } = ctx.data;
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
