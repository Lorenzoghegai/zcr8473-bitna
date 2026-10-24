// Contesto condiviso dalle pagine: dati, valutazioni e scelte ricalcolate
// quando cambiano i pesi. Usato da main.js e dai test dell'interfaccia.
import { evaluate, picks } from '@app/js/logic/score.js';
import { state } from '@app/js/state.js';

export function createContext(data) {
  const { catalog } = data;
  const ctx = {
    data,
    evaluated: [],
    byId: new Map(),
    picks: null,
    constraints: { maxWidthCm: catalog.constraints.maxWidthCm, maxArmHeightCm: catalog.constraints.maxArmHeightCm, budgetEur: catalog.budgetEur },
  };
  ctx.recompute = function recompute() {
    ctx.evaluated = evaluate(ctx.data.chairs, state.weights, ctx.constraints);
    ctx.byId = new Map(ctx.evaluated.map((e) => [e.chair.id, e]));
    ctx.picks = picks(ctx.evaluated);
  };
  ctx.updateCounts = function updateCounts() {
    const el = document.getElementById('cmp-count');
    if (el) el.textContent = state.compare.length;
  };
  ctx.go = (hash) => { location.hash = hash; };
  ctx.recompute();
  return ctx;
}
