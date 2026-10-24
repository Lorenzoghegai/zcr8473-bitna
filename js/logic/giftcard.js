// Esborso reale per pagare un totale con carte regalo acquistate a sconto.
// Distingue il risparmio teorico (sconto × totale) da quello effettivo,
// che dipende dai tagli disponibili e dal credito che resta inutilizzato.

const round2 = (n) => Math.round(n * 100) / 100;

// Combinazione di tagli con valore facciale minimo ≥ total (a parità, meno carte).
export function bestDenominationMix(total, denominations) {
  const target = Math.ceil(total * 100);
  const coins = [...denominations].sort((a, b) => b - a).map((d) => Math.round(d * 100));
  const max = target + Math.max(...coins);
  const best = new Array(max + 1).fill(null);
  best[0] = [];
  for (let v = 1; v <= max; v++) {
    for (const c of coins) {
      if (c <= v && best[v - c] && (!best[v] || best[v - c].length + 1 < best[v].length)) best[v] = [...best[v - c], c / 100];
    }
  }
  for (let v = target; v <= max; v++) if (best[v]) return { face: v / 100, cards: best[v] };
  return null;
}

export function giftCardOutlay(total, { rate, denominations, customMin, customMax }) {
  const theoretical = round2(total * rate);
  const scenarios = [];
  if (customMin != null && total >= customMin && total <= customMax) {
    const face = Math.ceil(total);
    scenarios.push({
      label: 'Importo libero (se il portale lo consente)',
      face,
      cards: [face],
      outlay: round2(face * (1 - rate)),
      leftover: round2(face - total),
    });
  }
  const mix = bestDenominationMix(total, denominations);
  if (mix) {
    scenarios.push({
      label: 'Solo tagli fissi',
      face: mix.face,
      cards: mix.cards,
      outlay: round2(mix.face * (1 - rate)),
      leftover: round2(mix.face - total),
    });
  }
  return {
    total,
    theoretical,
    // realSaving: risparmio anche se il credito residuo non viene mai usato.
    // fullSaving: risparmio se il residuo viene speso in seguito (sempre su home24).
    scenarios: scenarios.map((s) => ({ ...s, realSaving: round2(total - s.outlay), fullSaving: round2(s.face - s.outlay) })),
  };
}
