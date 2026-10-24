// Valutazione dei vincoli (dimensioni, budget, disponibilità) a partire
// SOLO dai dati documentati nel catalogo. Nessun valore di default qui.

import { starSpanWorst } from '@app/js/logic/geometry.js';

export const DEFAULT_CONSTRAINTS = { maxWidthCm: 69, maxArmHeightCm: 69, budgetEur: 120 };

const round1 = (n) => Math.round(n * 10) / 10;

// Testi in italiano: virgola decimale (es. 67,5 cm).
const comma = (t) => (typeof t === 'string' ? t.replace(/(\d)\.(\d)/g, '$1,$2') : t);
const localize = (r) => ({ ...r, text: comma(r.text), calc: comma(r.calc) });

export const assessWidth = (chair, c = DEFAULT_CONSTRAINTS) => localize(assessWidthRaw(chair, c));
export const assessArms = (chair, c = DEFAULT_CONSTRAINTS) => localize(assessArmsRaw(chair, c));
export const assessBudget = (chair, c = DEFAULT_CONSTRAINTS) => localize(assessBudgetRaw(chair, c));

// status: ok | derivata | parziale | mancante | incompatibile
function assessWidthRaw(chair, c = DEFAULT_CONSTRAINTS) {
  const limit = c.maxWidthCm;
  const ws = chair.widths || [];
  if (!ws.length) {
    return { status: 'mancante', value: null, text: 'Larghezza d\'ingombro non documentata' };
  }
  // Una stella non supera mai il proprio diametro: un diametro ≤ limite è già un
  // limite superiore documentato della base. Solo oltre il limite serve la derivazione.
  const documented = ws.filter((w) => w.kind !== 'base-diametro' || w.v <= limit).map((w) => (w.kind === 'base-diametro' ? { ...w, kind: 'base' } : w));
  const diameters = ws.filter((w) => w.kind === 'base-diametro' && w.v > limit);
  const maxDoc = documented.length ? Math.max(...documented.map((w) => w.v)) : null;
  const derived = diameters.map((w) => ({ ...w, span: round1(starSpanWorst(w.v)) }));
  const maxDer = derived.length ? Math.max(...derived.map((w) => w.span)) : null;
  const hasArms = chair.arms?.type !== 'nessuno';
  const coversArms = !hasArms || documented.some((w) => w.kind === 'ingombro' || w.kind === 'braccioli');
  const coversBase = documented.some((w) => w.kind === 'ingombro' || w.kind === 'base');
  const value = Math.max(maxDoc ?? -Infinity, maxDer ?? -Infinity);
  const upper = ws.filter((w) => w.kind === 'base-diametro' && w.v <= limit);
  const calc = [
    ...derived.map((w) => `base Φ ${w.v} cm × sin 72° = ${w.span} cm (ingombro massimo di una stella a 5 razze)`),
    ...upper.map((w) => `base Φ ${w.v} cm ≤ ${limit} cm: una base a stella non supera mai il proprio diametro`),
  ].join('; ') || null;

  if (maxDoc !== null && maxDoc > limit) {
    return { status: 'incompatibile', value: maxDoc, margin: round1(limit - maxDoc), text: `Larghezza dichiarata ${maxDoc} cm > ${limit} cm`, calc };
  }
  if (maxDer !== null && maxDer > limit) {
    return { status: 'incompatibile', value: maxDer, margin: round1(limit - maxDer), derived: true, text: `Ingombro derivato ${maxDer} cm > ${limit} cm`, calc };
  }
  if (coversArms && coversBase) {
    return { status: 'ok', value, margin: round1(limit - value), derived: maxDer !== null && maxDer > (maxDoc ?? 0), text: `${value} cm documentati (margine ${round1(limit - value)} cm)`, calc };
  }
  if (coversArms && derived.length) {
    return { status: 'derivata', value, margin: round1(limit - value), derived: true, text: `Base nota solo come diametro: ingombro derivato ${maxDer} cm`, calc };
  }
  const missing = !coversArms ? 'larghezza ai braccioli non documentata' : 'ingombro della base non documentato';
  return { status: 'parziale', value, margin: round1(limit - value), text: `${value} cm noti, ma ${missing}`, calc };
}

// status: ok | compromesso | incerta | mancante | incompatibile
function assessArmsRaw(chair, c = DEFAULT_CONSTRAINTS) {
  const limit = c.maxArmHeightCm;
  const a = chair.arms;
  if (!a || !a.type) return { status: 'mancante', text: 'Braccioli non descritti' };
  if (a.type === 'nessuno') return { status: 'ok', value: null, text: 'Senza braccioli' };
  const flip = a.type.startsWith('ribaltabili');
  const upperBound = a.min == null && a.single != null;
  const min = a.min ?? a.single ?? null;
  const calc = a.derived || (upperBound ? `Valore unico dichiarato ${a.single} cm: a seduta minima i braccioli non possono superarlo` : null);

  if (min === null) {
    return flip
      ? { status: 'compromesso', value: null, text: 'Altezza da abbassati non documentata: entra sotto il piano solo con i braccioli sollevati', calc }
      : { status: 'mancante', value: null, text: 'Altezza dei braccioli da terra non documentata', calc };
  }
  if (min <= limit) {
    if (a.refUncertain) {
      return { status: 'incerta', value: min, margin: round1(limit - min), text: `${min} cm, ma con riferimento di misura incerto`, calc };
    }
    return { status: 'ok', value: min, margin: round1(limit - min), derived: Boolean(a.derived), text: `${min} cm da terra a seduta minima (margine ${round1(limit - min)} cm)`, calc };
  }
  if (a.refUncertain) {
    return flip
      ? { status: 'compromesso', value: min, text: `${min} cm (riferimento incerto): sicuro solo con i braccioli sollevati`, calc }
      : { status: 'incerta', value: min, text: `${min} cm con riferimento incerto: potrebbe superare ${limit} cm`, calc };
  }
  return flip
    ? { status: 'compromesso', value: min, text: `Da abbassati ${min} cm > ${limit} cm: entra solo con i braccioli sollevati`, calc }
    : { status: 'incompatibile', value: min, margin: round1(limit - min), text: `Braccioli fissi a ${min} cm > ${limit} cm`, calc };
}

// status: verificato | verificato-ritiro | probabile | fuori
function assessBudgetRaw(chair, c = DEFAULT_CONSTRAINTS) {
  const s = chair.shipping || { status: 'sconosciuta' };
  const price = chair.price;
  const budget = c.budgetEur;
  let total = null;
  let totalMin = null;
  let status;
  let text;
  switch (s.status) {
    case 'gratuita':
      total = price; status = 'verificato'; text = 'Spedizione gratuita indicata in scheda';
      break;
    case 'fissa':
      total = round2(price + s.cost); status = 'verificato'; text = `Spedizione ${fmt(s.cost)} inclusa`;
      break;
    case 'intervallo':
      totalMin = round2(price + s.cost); total = round2(price + s.max); status = 'verificato';
      text = `Spedizione tra ${fmt(s.cost)} e ${fmt(s.max)}: totale calcolato sul caso peggiore`;
      break;
    case 'ritiro-gratuito':
      total = price; status = 'verificato-ritiro'; text = 'Totale valido con ritiro gratuito in negozio; consegna a domicilio da quotare';
      break;
    case 'primo-ordine':
      total = null; status = 'probabile'; text = 'Spedizione gratuita solo sul primo ordine: altrimenti costo non visibile';
      break;
    default:
      total = null; status = 'probabile'; text = 'Costo di spedizione non verificato';
  }
  if (price > budget) {
    return { status: 'fuori', total: total ?? price, totalMin, margin: round2(budget - price), text: `Prezzo ${fmt(price)} oltre il budget di ${fmt(budget)}` };
  }
  if (total !== null && total > budget) {
    return { status: 'fuori', total, totalMin, margin: round2(budget - total), text: `Totale ${fmt(total)} oltre il budget` };
  }
  const margin = round2(budget - (total ?? price));
  return { status, total, totalMin, margin, text };
}

const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => `${n.toFixed(2).replace('.', ',')} €`;

// Le tre categorie richieste: verificata / probabile / incompatibile.
export function dimensionCategory(w, a) {
  if (w.status === 'incompatibile' || a.status === 'incompatibile') return 'incompatibile';
  if (w.status === 'ok' && a.status === 'ok') return 'verificata';
  return 'probabile';
}

// Esito complessivo: idonea | da-verificare | esclusa (+ motivi).
export function assessChair(chair, c = DEFAULT_CONSTRAINTS) {
  const width = assessWidth(chair, c);
  const arms = assessArms(chair, c);
  const budget = assessBudget(chair, c);
  const dims = dimensionCategory(width, arms);
  const reasons = [];
  let status;

  if (chair.exclude) reasons.push(chair.exclude.reason);
  if (budget.status === 'fuori') reasons.push(budget.text);
  if (width.status === 'incompatibile') reasons.push(width.text);
  if (arms.status === 'incompatibile') reasons.push(arms.text);

  if (reasons.length) {
    status = 'esclusa';
  } else if (dims === 'verificata' && (budget.status === 'verificato' || budget.status === 'verificato-ritiro')) {
    status = 'idonea';
  } else {
    status = 'da-verificare';
    if (width.status !== 'ok') reasons.push(`Larghezza: ${width.text}`);
    if (arms.status !== 'ok') reasons.push(`Braccioli: ${arms.text}`);
    if (budget.status === 'probabile') reasons.push(`Budget: ${budget.text}`);
    if (chair.availability && /da verificare/i.test(chair.availability)) reasons.push(`Disponibilità: ${chair.availability}`);
  }
  if (status === 'idonea' && chair.availability && /da verificare/i.test(chair.availability)) {
    status = 'da-verificare';
    reasons.push(`Disponibilità: ${chair.availability}`);
  }
  return { status, reasons, width, arms, budget, dims };
}

// Sconto rispetto a un riferimento affidabile (non il «prezzo consigliato»).
export function verifiedDiscount(chair) {
  const ref = chair.priceRef;
  if (!ref || !ref.v || ref.v <= chair.price) return null;
  const reliable = ['mediano', 'minimo-30gg', 'precedente'].includes(ref.kind);
  return { pct: Math.round((1 - chair.price / ref.v) * 100), amount: round2(ref.v - chair.price), ref, reliable };
}
