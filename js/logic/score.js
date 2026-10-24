// Punteggio editoriale (0–100). NON è una misura scientifica: serve solo a
// ordinare le sedie che hanno già superato i vincoli. I pesi sono modificabili.

import { assessChair, verifiedDiscount } from '@app/js/logic/compat.js';
import { qualityIndex, analyzeValue } from '@app/js/logic/value.js';

export const DEFAULT_WEIGHTS = {
  regolazioni: 30,
  recensioni: 20,
  prezzo: 20,
  margini: 15,
  robustezza: 10,
  completezza: 5,
};

export const WEIGHT_LABELS = {
  regolazioni: 'Regolazioni documentate',
  recensioni: 'Recensioni (media ponderata)',
  prezzo: 'Prezzo finale',
  margini: 'Margini rispetto ai vincoli',
  robustezza: 'Portata, garanzia, resi',
  completezza: 'Completezza dei dati',
};

const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function adjustabilityScore(chair) {
  const parts = [];
  let pts = 0;
  const sh = chair.seatHeight;
  if (sh && sh.min != null && sh.max != null && sh.max > sh.min) { pts += 1; parts.push('altezza seduta'); }
  else { pts += 0.5; }
  const tilt = chair.tilt?.kind;
  const tiltPts = { oscillante: 1, 'oscillante-tensione': 1.5, bloccabile: 2 }[tilt] || 0;
  if (tiltPts) { pts += tiltPts; parts.push(tilt === 'bloccabile' ? 'inclinazione bloccabile' : tilt === 'oscillante-tensione' ? 'inclinazione con tensione' : 'oscillazione'); }
  const armPts = { fissi: 0.5, integrati: 0.5, ribaltabili: 1, regolabili: 1.5, 'ribaltabili-regolabili': 2 }[chair.arms?.type] || 0;
  if (armPts > 0.5) parts.push(`braccioli ${chair.arms.type.replace('-', ' e ')}`);
  pts += armPts;
  const lumbar = (chair.lumbar || '').toLowerCase();
  let lumPts = 0;
  if (/non regolabil/.test(lumbar)) lumPts = 0.5;
  else if (/4d|2d/.test(lumbar)) lumPts = 2;
  else if (/regolabil/.test(lumbar)) lumPts = 1.5;
  else if (/adattiv/.test(lumbar)) lumPts = 1;
  else if (lumbar && !/^nessuno|non dichiarato/.test(lumbar)) lumPts = 0.5;
  if (lumPts >= 1) parts.push('lombare regolabile/adattivo');
  pts += lumPts;
  const head = (chair.headrest || '').toLowerCase();
  if (/regolabil|oscillante/.test(head)) { pts += 1; parts.push('poggiatesta regolabile'); }
  else if (head && !/^nessuno/.test(head)) pts += 0.5;
  if (chair.special) { pts += 0.5; parts.push('schienale pieghevole'); }
  return { score: clamp01(pts / 8.5), parts };
}

export function reviewScore(chair) {
  const r = chair.rating;
  if (!r || !r.v || !r.n) return { score: 0, bayes: null };
  const m = 100;
  const prior = 4.0;
  const n = Math.min(r.n, 3000);
  const bayes = (n * r.v + m * prior) / (n + m);
  return { score: clamp01((bayes - 3.8) / 0.9), bayes: Math.round(bayes * 100) / 100 };
}

export function priceScore(total, budget) {
  return clamp01((budget - total) / (budget - 50));
}

function marginScore(assess) {
  const w = assess.width;
  const a = assess.arms;
  const ws = w.margin != null && ['ok', 'derivata', 'parziale'].includes(w.status) ? clamp01(w.margin / 8) * (w.status === 'ok' ? 1 : 0.5) : 0;
  let as = 0;
  if (a.status === 'ok') as = a.value == null ? 1 : clamp01(a.margin / 6);
  else if (a.status === 'compromesso') as = 0.25;
  else if (a.status === 'incerta') as = 0.15;
  return (ws + as) / 2;
}

function robustnessScore(chair) {
  const load = chair.maxLoad?.v;
  let s = load >= 150 ? 0.7 : load >= 136 ? 0.6 : load >= 120 ? 0.5 : load >= 110 ? 0.35 : load >= 100 ? 0.25 : 0.1;
  const warranty = chair.warranty || '';
  const years = (warranty.match(/(\d+)\s*anni/) || [])[1];
  if (years && Number(years) > 2) s += 0.15;
  if (/365/.test(chair.returns || '') || /illimitati/i.test(chair.returns || '')) s += 0.1;
  if (chair.certifications) s += 0.05;
  return clamp01(s);
}

function completenessScore(chair) {
  const checks = [
    (chair.widths || []).length > 0,
    chair.arms?.type === 'nessuno' || chair.arms?.min != null || chair.arms?.single != null,
    chair.seatHeight?.min != null,
    chair.depth?.v != null,
    chair.maxLoad?.v != null,
    chair.rating?.n > 0,
    chair.tilt?.kind && chair.tilt.kind !== 'non-dichiarata',
  ];
  return checks.filter(Boolean).length / checks.length;
}

export function scoreChair(chair, weights = DEFAULT_WEIGHTS, constraints, assess = assessChair(chair, constraints)) {
  const budget = constraints?.budgetEur ?? 120;
  const total = assess.budget.total ?? chair.price;
  const adj = adjustabilityScore(chair);
  const rev = reviewScore(chair);
  const parts = {
    regolazioni: adj.score,
    recensioni: rev.score,
    prezzo: priceScore(total, budget),
    margini: marginScore(assess),
    robustezza: robustnessScore(chair),
    completezza: completenessScore(chair),
  };
  const wsum = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const value = Object.entries(parts).reduce((acc, [k, v]) => acc + v * (weights[k] || 0), 0) / wsum * 100;
  return { value: Math.round(value * 10) / 10, parts, quality: qualityIndex(parts, weights), adjustments: adj.parts, bayes: rev.bayes };
}

// Arricchisce il catalogo con valutazioni e punteggi.
export function evaluate(chairs, weights, constraints) {
  return chairs.map((chair) => {
    const assess = assessChair(chair, constraints);
    const score = scoreChair(chair, weights, constraints, assess);
    return { chair, assess, score, discount: verifiedDiscount(chair) };
  });
}

// Selezioni richieste. I vincoli vengono prima del punteggio: si sceglie solo tra le idonee.
export function picks(evaluated) {
  const ok = evaluated.filter((e) => e.assess.status === 'idonea').sort((a, b) => b.score.value - a.score.value);
  const byScore = (a, b) => b.score.value - a.score.value;
  const bestOverall = ok[0] || null;
  const alternatives = ok.slice(1, 4);
  const smallSpace = [...ok]
    .filter((e) => e.chair.depth?.v != null)
    .sort((a, b) => (a.chair.depth.v - b.chair.depth.v) || byScore(a, b))[0] || null;
  const adjust = [...ok].sort((a, b) => (b.score.parts.regolazioni - a.score.parts.regolazioni) || byScore(a, b))[0] || null;
  // Offerta: tra le idonee con un ribasso verificato su un riferimento affidabile
  // (mediano Amazon, minimo 30 giorni, prezzo precedente) vince il miglior punteggio.
  const deals = ok.filter((e) => e.discount?.reliable && e.discount.pct >= 5).sort((a, b) => byScore(a, b) || (b.discount.pct - a.discount.pct));
  const bestDeal = deals[0] || null;
  const toVerify = evaluated.filter((e) => e.assess.status === 'da-verificare').sort(byScore).slice(0, 5);
  // Qualità-prezzo: costo più basso per punto dell'indice di qualità tra le idonee.
  const value = analyzeValue(ok);
  const bestValue = value.ranked[0]?.e || null;
  return { bestOverall, alternatives, smallSpace, adjust, bestDeal, bestValue, value, toVerify, eligibleCount: ok.length };
}
