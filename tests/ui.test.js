// Test delle pagine: ogni vista viene disegnata in un contenitore di prova
// con un contesto nuovo e lo stato azzerato (chiave di salvataggio dei test).
import { assert, eq } from './harness.js';
import { createContext } from '../js/context.js';
import { state, resetState } from '../js/state.js';
import * as catalog from '../js/ui/catalog.js';
import * as detail from '../js/ui/detail.js';
import * as compare from '../js/ui/compare.js';
import * as choices from '../js/ui/picks.js';
import * as value from '../js/ui/value.js';
import * as method from '../js/ui/method.js';
import * as conventions from '../js/ui/conventions.js';
import * as room from '../js/ui/room.js';

export function defineUiTests(test, data) {
  const setup = () => {
    resetState();
    state.showImages = false; // nessuna richiesta ai server dei negozi durante i test
    const sandbox = document.getElementById('sandbox');
    sandbox.innerHTML = '<div class="test-root"></div>';
    return { ctx: createContext(data), root: sandbox.firstChild };
  };

  test('UI catalogo: 66 schede, filtro «solo frontiera» → 5', () => {
    const { ctx, root } = setup();
    catalog.render(root, ctx);
    eq(root.querySelectorAll('.chair-card').length, 66);
    root.querySelector('#frontierOnly').click();
    eq(root.querySelectorAll('.chair-card').length, 5);
    eq(root.querySelectorAll('.chair-card a.chip[href="#/valore"]').length, 5);
  });

  test('UI catalogo: ordinamento qualità/prezzo mette prima JYSK NIMTOFTE', () => {
    const { ctx, root } = setup();
    catalog.render(root, ctx);
    const sel = root.querySelector('#sort');
    sel.value = 'value';
    sel.dispatchEvent(new Event('change'));
    eq(root.querySelector('.chair-card').dataset.id, 'jysk-nimtofte');
  });

  test('UI qualità/prezzo: 15 punti, 5 sulla frontiera, 10 battute; 45 con le «da verificare»', () => {
    const { ctx, root } = setup();
    value.render(root, ctx);
    eq(root.querySelectorAll('.vchart a[data-id]').length, 15);
    const tables = root.querySelectorAll('table.vtable tbody');
    eq([tables[0].rows.length, tables[1].rows.length], [5, 10]);
    root.querySelector('#withCheck').click();
    eq(root.querySelectorAll('.vchart a[data-id]').length, 45);
    value.cleanup();
  });

  test('UI qualità/prezzo: ogni punto è un link alla scheda con descrizione accessibile', () => {
    const { ctx, root } = setup();
    value.render(root, ctx);
    for (const a of root.querySelectorAll('.vchart a[data-id]')) {
      eq(a.getAttribute('href'), `#/sedia/${encodeURIComponent(a.dataset.id)}`);
      assert(/qualità .* su 100/.test(a.getAttribute('aria-label')), a.getAttribute('aria-label'));
    }
    value.cleanup();
  });

  test('UI scheda: tutte le 66 schede si aprono e mostrano il rapporto qualità-prezzo', () => {
    const { ctx, root } = setup();
    for (const c of data.chairs) {
      detail.render(root, ctx, [c.id]);
      assert(root.querySelector('h1')?.textContent === c.name, `titolo di ${c.id}`);
      assert(root.textContent.includes('Rapporto qualità-prezzo'), `pannello qualità-prezzo in ${c.id}`);
    }
  });

  test('UI scelte: miglior rapporto qualità-prezzo e solidità della prima scelta', () => {
    const { ctx, root } = setup();
    choices.render(root, ctx);
    const kickers = [...root.querySelectorAll('.kicker')].map((k) => k.textContent);
    assert(kickers.includes('Miglior rapporto qualità-prezzo'), kickers.join(' | '));
    assert(/resta prima in 8 casi su 12/.test(root.textContent));
  });

  test('UI confronto: 4 sedie con indice di qualità ed euro per punto', () => {
    const { ctx, root } = setup();
    state.compare = ['amz-yaheetech-yp136n', 'jysk-nimtofte', 'amz-songmics-obn22bk', 'amz-songmics-obn37bk'];
    compare.render(root, ctx);
    const rows = [...root.querySelectorAll('tbody tr')];
    const row = (label) => rows.find((r) => r.querySelector('th').textContent === label);
    assert(row('Indice di qualità (senza prezzo)') && row('Euro per punto di qualità'));
    eq(row('Euro per punto di qualità').querySelectorAll('td.best').length, 1);
  });

  test('UI metodo: cambiare un peso ricalcola le scelte', () => {
    const { ctx, root } = setup();
    method.render(root, ctx);
    eq(ctx.picks.bestOverall.chair.id, 'amz-yaheetech-yp136n');
    const slider = root.querySelector('input[data-w="prezzo"]');
    slider.value = '30';
    slider.dispatchEvent(new Event('input'));
    eq(ctx.picks.bestOverall.chair.id, 'jysk-nimtofte');
  });

  test('UI convenzioni: calcolatore gift card per le sedie home24', () => {
    const { ctx, root } = setup();
    conventions.render(root, ctx);
    assert(root.querySelectorAll('#gcsel option').length >= 2);
    assert(root.querySelector('#gcout table'), 'tabella degli scenari');
  });

  test('UI stanza: schema 2D con le verifiche geometriche della prima scelta', () => {
    const { ctx, root } = setup();
    state.room.view = 'schema';
    room.render(root, ctx, []);
    assert(root.querySelector('#canvas svg'), 'schema SVG');
    eq(window.__room.chairId, 'amz-yaheetech-yp136n');
    assert(root.querySelectorAll('#results .checks li').length >= 4);
    room.cleanup();
  });

  test('i test non toccano le impostazioni salvate dell\'app', () => {
    setup();
    assert(localStorage.getItem('sedie120:test'), 'lo stato dei test usa la sua chiave');
    eq(localStorage.getItem('sedie120:v1'), window.__APP_STATE_BEFORE__ ?? null);
  });
}
