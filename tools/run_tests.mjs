// Esegue i test del browser (/tests/) in Chromium senza finestra e ne riporta l'esito.
// Richiede Node e il pacchetto «playwright» con Chromium installato.
//   node tools/run_tests.mjs
// In alternativa: avvia il server (python tools/serve.py) e apri /tests/ nel browser.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };

let chromium;
try {
  ({ chromium } = createRequire(import.meta.url)('playwright'));
} catch {
  console.error('Pacchetto «playwright» non trovato: apri http://localhost:8765/tests/ con python tools/serve.py');
  process.exit(2);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
// Nessuna richiesta verso siti esterni durante i test.
await page.route((u) => !u.href.startsWith(base), (r) => r.abort());
await page.goto(`${base}/tests/`);
const out = await page.waitForFunction(() => window.__TEST_RESULTS__, null, { timeout: 60000 }).then((h) => h.jsonValue());
await browser.close();
server.close();

for (const r of out.results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.ok ? '' : `\n     ${r.error}`}`);
if (out.error) console.log(`Errore: ${out.error}`);
if (pageErrors.length) console.log(`Errori JavaScript nella pagina: ${pageErrors.join(' | ')}`);
console.log(`\n${out.passed}/${out.total} superati`);
process.exit(out.passed === out.total && out.total > 0 && !pageErrors.length ? 0 : 1);
