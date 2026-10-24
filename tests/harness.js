// Mini harness di test senza dipendenze: funziona nel browser (/tests/) e in Node.

export function createSuite() {
  const cases = [];
  const test = (name, fn) => cases.push({ name, fn });
  async function run() {
    const results = [];
    for (const c of cases) {
      const t0 = performance.now();
      try {
        await c.fn();
        results.push({ name: c.name, ok: true, ms: performance.now() - t0 });
      } catch (err) {
        results.push({ name: c.name, ok: false, error: err?.message || String(err), ms: performance.now() - t0 });
      }
    }
    return results;
  }
  return { test, run };
}

export function assert(cond, msg = 'condizione falsa') {
  if (!cond) throw new Error(msg);
}

export function eq(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg ? `${msg}: ` : ''}atteso ${e}, ottenuto ${a}`);
}

export function near(actual, expected, tol = 1e-6, msg = '') {
  if (!(Math.abs(actual - expected) <= tol)) throw new Error(`${msg ? `${msg}: ` : ''}atteso ${expected} ± ${tol}, ottenuto ${actual}`);
}
