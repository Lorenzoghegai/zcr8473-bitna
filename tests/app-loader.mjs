// Hook per Node: risolve gli import «@app/...» (gestiti dall'import map nel
// browser) come percorsi relativi alla cartella del progetto.
import { register } from 'node:module';

const root = new URL('../', import.meta.url).href;
register(`data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@app/')) return next(${JSON.stringify(root)} + specifier.slice(5), context);
  return next(specifier, context);
}`)}`);
