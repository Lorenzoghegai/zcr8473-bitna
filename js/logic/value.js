// Rapporto qualità-prezzo. L'indice di qualità (0–100) usa solo le componenti
// del punteggio che descrivono la sedia — regolazioni, recensioni, robustezza —
// con i pesi scelti in «Metodo»: prezzo e margini restano fuori, così la
// qualità si può mettere a confronto con quanto costa.

export const QUALITY_KEYS = ['regolazioni', 'recensioni', 'robustezza'];

const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

export function qualityIndex(parts, weights) {
  const wsum = QUALITY_KEYS.reduce((a, k) => a + (weights?.[k] || 0), 0);
  // Pesi tutti a zero: le tre componenti contano allo stesso modo.
  const w = (k) => (wsum > 0 ? weights[k] || 0 : 1);
  const den = wsum > 0 ? wsum : QUALITY_KEYS.length;
  return round1(QUALITY_KEYS.reduce((a, k) => a + parts[k] * w(k), 0) / den * 100);
}

// Totale confrontabile: quello verificato, altrimenti il solo prezzo
// (limite inferiore: la spedizione non è nota).
export const valueTotal = (e) => e.assess.budget.total ?? e.chair.price;
export const isLowerBound = (e) => e.assess.budget.total == null;

export function eurPerPoint(total, quality) {
  return quality > 0 ? round2(total / quality) : null;
}

// a domina b se costa non di più, vale non di meno ed è strettamente meglio in almeno uno dei due.
export const dominates = (a, b) => a.total <= b.total && a.q >= b.q && (a.total < b.total || a.q > b.q);

// Frontiera di Pareto: le sedie che nessun'altra batte insieme su prezzo e qualità.
// Restituisce i punti in ordine di prezzo crescente.
export function paretoFrontier(points) {
  return points.filter((p) => !points.some((o) => o !== p && dominates(o, p)))
    .sort((a, b) => a.total - b.total || b.q - a.q);
}

const pointOf = (e) => ({ e, id: e.chair.id, total: valueTotal(e), q: e.score.quality, lowerBound: isLowerBound(e) });

// Analisi su un insieme di sedie valutate (di norma le idonee).
// Per ogni sedia: €/punto, appartenenza alla frontiera, sedie che la battono,
// e per i punti della frontiera il «salto» dal punto precedente.
export function analyzeValue(entries) {
  const points = entries.map(pointOf);
  const frontier = paretoFrontier(points);
  const onFrontier = new Set(frontier.map((p) => p.id));
  const steps = new Map();
  frontier.forEach((p, i) => {
    const prev = frontier[i - 1];
    if (!prev) return;
    const dEur = round2(p.total - prev.total);
    const dQ = round1(p.q - prev.q);
    steps.set(p.id, { from: prev.e, dEur, dQ, eurPerExtraPoint: dQ > 0 ? round2(dEur / dQ) : null });
  });
  const items = points.map((p) => ({
    ...p,
    eurPerPoint: eurPerPoint(p.total, p.q),
    onFrontier: onFrontier.has(p.id),
    step: steps.get(p.id) || null,
    dominatedBy: betterAndCheaper(p, points),
  }));
  const ranked = items.filter((i) => i.eurPerPoint != null).sort((a, b) => a.eurPerPoint - b.eurPerPoint || b.q - a.q);
  return { items, byId: new Map(items.map((i) => [i.id, i])), frontier: frontier.map((p) => items.find((i) => i.id === p.id)), ranked };
}

// Sedie dell'insieme che costano non di più e valgono non di meno (esclusa la sedia stessa),
// dalla più conveniente: prima la qualità più alta, poi il prezzo più basso.
export function betterAndCheaper(target, pool) {
  return pool.filter((o) => o.id !== target.id && dominates(o, target))
    .sort((a, b) => b.q - a.q || a.total - b.total)
    .map((o) => ({ e: o.e, id: o.id, saving: round2(target.total - o.total), gain: round1(o.q - target.q) }));
}

// Confronto di una sedia qualsiasi (anche esclusa o da verificare) con un insieme di riferimento.
export function alternativesFor(e, poolEntries) {
  return betterAndCheaper(pointOf(e), poolEntries.map(pointOf));
}
