// Esegue i test di logica in Node, senza browser:
//   node --import ./tests/app-loader.mjs tests/run-node.mjs
import fs from 'node:fs';
import { createSuite } from './harness.js';
import { defineLogicTests } from './logic.test.js';

const root = new URL('../', import.meta.url);
const read = (rel) => JSON.parse(fs.readFileSync(new URL(`data/${rel}`, root), 'utf8'));
const catalog = read('catalog.json');
const data = {
  catalog,
  conventions: read('conventions.json'),
  room: read('room.json'),
  chairs: catalog.files.flatMap((f) => read(f)).map((c) => ({ checked: catalog.checkedDate, ...c })),
};

const suite = createSuite();
defineLogicTests(suite.test, data);
const results = await suite.run();
for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.name}${r.ok ? '' : `\n     ${r.error}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} superati`);
process.exit(failed ? 1 : 0);
