import { createSuite } from './harness.js';
import { defineLogicTests } from './logic.test.js';
import { defineUiTests } from './ui.test.js';
import { loadAll } from '../js/data.js';

const summary = document.getElementById('summary');
const list = document.getElementById('results');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

try {
  const data = await loadAll('../data/');
  const suite = createSuite();
  defineLogicTests(suite.test, data);
  defineUiTests(suite.test, data);
  const results = await suite.run();
  document.getElementById('sandbox').innerHTML = '';
  const failed = results.filter((r) => !r.ok);
  list.innerHTML = results.map((r) => `<li class="${r.ok ? 'ok' : 'ko'}">${r.ok ? '✓' : '✗'} ${esc(r.name)}${r.ok ? '' : `<div class="err">${esc(r.error)}</div>`}</li>`).join('');
  summary.textContent = `${results.length - failed.length}/${results.length} superati${failed.length ? ` — ${failed.length} falliti` : ''}`;
  summary.className = failed.length ? 'ko' : 'ok';
  window.__TEST_RESULTS__ = { passed: results.length - failed.length, total: results.length, results };
} catch (err) {
  summary.textContent = `Errore nel caricamento dei test: ${err.message}`;
  summary.className = 'ko';
  window.__TEST_RESULTS__ = { passed: 0, total: 0, error: err.message, results: [] };
}
