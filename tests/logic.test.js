// Test della logica pura (vincoli, punteggio, qualità-prezzo, geometria,
// gift card, CSV) e invarianti sui dati reali. Girano nel browser e in Node.
import { assert, eq, near } from './harness.js';
import { assessWidth, assessArms, assessBudget, assessChair, verifiedDiscount, DEFAULT_CONSTRAINTS } from '../js/logic/compat.js';
import { evaluate, picks, scoreChair, reviewScore, priceScore, rankingStability, DEFAULT_WEIGHTS } from '../js/logic/score.js';
import { qualityIndex, dominates, paretoFrontier, analyzeValue, eurPerPoint, alternativesFor } from '../js/logic/value.js';
import { starSpanWorst, starSpanAt, parseRecline, resolveChairGeometry, roomFromParams, layout, defaultPose, STAR_BEST_FACTOR, STAR_WORST_FACTOR } from '../js/logic/geometry.js';
import { bestDenominationMix, giftCardOutlay } from '../js/logic/giftcard.js';
import { toCSV } from '../js/logic/csv.js';

const C = DEFAULT_CONSTRAINTS;
const chair = (o) => ({ id: 'x', price: 60, shipping: { status: 'gratuita', cost: 0 }, widths: [], arms: { type: 'nessuno' }, ...o });

export function defineLogicTests(test, data) {
  // ── Vincoli ────────────────────────────────────────────────────────────
  test('larghezza: base Φ > 69 cm → ingombro derivato Φ·sin 72°, da confermare', () => {
    const r = assessWidth(chair({ widths: [{ v: 72, kind: 'base-diametro' }] }), C);
    eq(r.status, 'derivata');
    near(r.value, 68.5, 0.05);
    assert(/sin 72°/.test(r.calc), 'il calcolo va mostrato');
  });

  test('larghezza: base Φ ≤ 69 cm vale come limite superiore documentato', () => {
    const r = assessWidth(chair({ widths: [{ v: 65, kind: 'base-diametro' }, { v: 60, kind: 'braccioli' }], arms: { type: 'fissi', min: 60 } }), C);
    eq([r.status, r.value, r.margin], ['ok', 65, 4]);
  });

  test('larghezza: dichiarata oltre il limite → incompatibile; assente → mancante', () => {
    eq(assessWidth(chair({ widths: [{ v: 70, kind: 'ingombro' }] }), C).status, 'incompatibile');
    eq(assessWidth(chair({ widths: [] }), C).status, 'mancante');
  });

  test('larghezza: con braccioli serve la quota ai braccioli o l\'ingombro', () => {
    eq(assessWidth(chair({ widths: [{ v: 60, kind: 'base' }], arms: { type: 'fissi', min: 60 } }), C).status, 'parziale');
  });

  test('testi in italiano con la virgola decimale', () => {
    const r = assessWidth(chair({ widths: [{ v: 67.5, kind: 'ingombro' }] }), C);
    assert(r.text.includes('67,5'), r.text);
  });

  test('braccioli: valore unico ≤ 69 vale come limite superiore', () => {
    const r = assessArms(chair({ arms: { type: 'fissi', single: 67 } }), C);
    eq([r.status, r.value, r.margin], ['ok', 67, 2]);
    assert(/Valore unico/.test(r.calc));
  });

  test('braccioli: ribaltabili oltre il limite = compromesso, fissi oltre = esclusi', () => {
    eq(assessArms(chair({ arms: { type: 'ribaltabili', min: 70 } }), C).status, 'compromesso');
    eq(assessArms(chair({ arms: { type: 'fissi', min: 72 } }), C).status, 'incompatibile');
    eq(assessArms(chair({ arms: { type: 'fissi', min: 66, refUncertain: true } }), C).status, 'incerta');
  });

  test('budget: spedizione a intervallo → caso peggiore, verificato', () => {
    const r = assessBudget(chair({ price: 79.95, shipping: { status: 'intervallo', cost: 5, max: 29 } }), C);
    eq([r.status, r.total, r.totalMin], ['verificato', 108.95, 84.95]);
  });

  test('budget: gratis solo al primo ordine → probabile, totale non determinabile', () => {
    const r = assessBudget(chair({ shipping: { status: 'primo-ordine', cost: 0 } }), C);
    eq([r.status, r.total], ['probabile', null]);
  });

  test('budget: oltre 120 € (anche solo con la spedizione) → fuori', () => {
    eq(assessBudget(chair({ price: 121.99 }), C).status, 'fuori');
    eq(assessBudget(chair({ price: 115, shipping: { status: 'fissa', cost: 9.99 } }), C).status, 'fuori');
  });

  test('esito: esclusione dichiarata prevale; ritiro gratuito vale come verificato', () => {
    eq(assessChair(chair({ exclude: { reason: 'non disponibile' } }), C).status, 'esclusa');
    const ok = chair({ widths: [{ v: 60, kind: 'ingombro' }], shipping: { status: 'ritiro-gratuito', cost: 0 } });
    eq(assessChair(ok, C).status, 'idonea');
  });

  test('sconto: il «prezzo consigliato» non è un riferimento affidabile', () => {
    eq(verifiedDiscount(chair({ priceRef: { v: 80, kind: 'consigliato' } })).reliable, false);
    const d = verifiedDiscount(chair({ price: 64.79, priceRef: { v: 71.99, kind: 'mediano' } }));
    eq([d.reliable, d.pct], [true, 10]);
  });

  // ── Punteggio ──────────────────────────────────────────────────────────
  test('recensioni: 4,8 su 11 non supera 4,4 su 8.000 (media bayesiana)', () => {
    assert(reviewScore({ rating: { v: 4.8, n: 11 } }).bayes < reviewScore({ rating: { v: 4.4, n: 8000 } }).bayes);
  });

  test('prezzo: 50 € vale 1, 120 € vale 0', () => {
    eq([priceScore(50, 120), priceScore(120, 120), priceScore(130, 120)], [1, 0, 0]);
  });

  test('pesi normalizzati: raddoppiarli tutti non cambia il punteggio', () => {
    const c = data.chairs.find((x) => x.id === 'amz-yaheetech-yp136n');
    const double = Object.fromEntries(Object.entries(DEFAULT_WEIGHTS).map(([k, v]) => [k, v * 2]));
    eq(scoreChair(c, double, C).value, scoreChair(c, DEFAULT_WEIGHTS, C).value);
  });

  // ── Qualità-prezzo ─────────────────────────────────────────────────────
  test('indice di qualità: il peso del prezzo non lo cambia', () => {
    const parts = { regolazioni: 0.5, recensioni: 0.8, robustezza: 0.2, prezzo: 1, margini: 1, completezza: 1 };
    eq(qualityIndex(parts, { ...DEFAULT_WEIGHTS, prezzo: 0 }), qualityIndex(parts, { ...DEFAULT_WEIGHTS, prezzo: 50 }));
    eq(qualityIndex(parts, { regolazioni: 30, recensioni: 20, robustezza: 10 }), 55); // (0,5·30 + 0,8·20 + 0,2·10) / 60
  });

  test('indice di qualità: con i tre pesi a zero le componenti contano uguale', () => {
    eq(qualityIndex({ regolazioni: 0.3, recensioni: 0.6, robustezza: 0.9 }, { regolazioni: 0, recensioni: 0, robustezza: 0 }), 60);
  });

  test('frontiera di Pareto su punti sintetici (con pari merito)', () => {
    const P = (id, total, q) => ({ id, total, q });
    const pts = [P('a', 50, 40), P('b', 60, 50), P('c', 60, 45), P('d', 70, 45), P('e', 80, 60), P('f', 80, 60)];
    assert(dominates(pts[1], pts[2]) && dominates(pts[1], pts[3]) && !dominates(pts[4], pts[5]));
    eq(paretoFrontier(pts).map((p) => p.id), ['a', 'b', 'e', 'f']);
  });

  test('€ per punto: nullo con indice zero', () => {
    eq([eurPerPoint(60, 50), eurPerPoint(60, 0)], [1.2, null]);
  });

  // ── Geometria ──────────────────────────────────────────────────────────
  test('stella a 5 razze: ingombro tra 0,905·Φ e 0,951·Φ in ogni rotazione', () => {
    near(starSpanWorst(60), 57.06, 0.01);
    for (let r = 0; r < 72; r += 3) {
      const s = starSpanAt(60, r);
      assert(s >= 60 * STAR_BEST_FACTOR - 1e-9 && s <= 60 * STAR_WORST_FACTOR + 1e-9, `rotazione ${r}°: ${s}`);
    }
  });

  test('reclinazione letta dai testi delle schede', () => {
    eq([parseRecline({ kind: 'oscillante', range: '90–105°' }), parseRecline({ kind: 'oscillante', range: '15° (inclinazione libera)' }),
      parseRecline({ kind: 'nessuna' }), parseRecline({ kind: 'bloccabile' })], [15, 15, 0, 12]);
  });

  test('stanza: spostare il tavolo di 10 cm aumenta di 10 cm lo spazio dietro la sedia', () => {
    const g = resolveChairGeometry(data.chairs.find((x) => x.id === 'amz-yaheetech-yp136n'));
    const room = roomFromParams(data.room.params);
    const pose = { ...defaultPose(g), frontZ: -room.insertUnder };
    near(layout(g, { ...room, tableShift: 10 }, pose).residual - layout(g, room, pose).residual, 10, 1e-9);
  });

  test('stanza: YP-136N in posizione di lavoro senza interferenze', () => {
    const g = resolveChairGeometry(data.chairs.find((x) => x.id === 'amz-yaheetech-yp136n'));
    const room = roomFromParams(data.room.params);
    const L = layout(g, room, { ...defaultPose(g), frontZ: -room.insertUnder });
    assert(!L.interference, L.checks.filter((c) => !c.ok).map((c) => c.label).join(', '));
  });

  // ── Gift card e CSV ────────────────────────────────────────────────────
  test('gift card: combinazione di tagli minima che copre il totale', () => {
    const mix = bestDenominationMix(80.98, [15, 25, 50, 100, 150, 250]);
    eq(mix.face, 85);
    near(mix.cards.reduce((a, b) => a + b, 0), 85, 1e-9);
    eq(mix.cards.length, 5);
  });

  test('gift card: importo libero, esborso e risparmio reale', () => {
    const s = giftCardOutlay(80.98, { rate: 0.125, denominations: [15, 25, 50], customMin: 5, customMax: 250 }).scenarios[0];
    eq([s.face, s.outlay, s.leftover, s.realSaving], [81, 70.88, 0.02, 10.1]);
  });

  test('CSV per Excel: BOM, «;», virgola decimale e virgolette', () => {
    const out = toCSV([{ label: 'Nome', get: (r) => r.n }, { label: 'Prezzo €', get: (r) => r.p }], [{ n: 'Sedia "A"; nera', p: 64.79 }, { n: 'B', p: null }]);
    eq(out, '﻿Nome;Prezzo €\r\n"Sedia ""A""; nera";64,79\r\nB;\r\n');
  });

  // ── Invarianti sui dati rilevati ──────────────────────────────────────
  const ev = () => evaluate(data.chairs, DEFAULT_WEIGHTS, C);

  test('dati: 66 modelli distinti per negozio come nel report', () => {
    eq(data.chairs.length, 66);
    const by = data.chairs.reduce((m, c) => ((m[c.store] = (m[c.store] || 0) + 1), m), {});
    eq([by['Amazon.it'], by.JYSK, by['IKEA Italia'], by.home24], [43, 11, 5, 4]);
    eq(new Set(data.chairs.map((c) => c.id)).size, 66);
  });

  test('dati: esiti 15 idonee, 30 da verificare, 21 escluse', () => {
    const n = ev().reduce((m, e) => ((m[e.assess.status] = (m[e.assess.status] || 0) + 1), m), {});
    eq([n.idonea, n['da-verificare'], n.esclusa], [15, 30, 21]);
  });

  test('dati: nessuna idonea viola un vincolo', () => {
    for (const e of ev().filter((x) => x.assess.status === 'idonea')) {
      assert(e.assess.width.value <= 69, `${e.chair.id} larghezza`);
      assert(e.chair.arms.type === 'nessuno' || e.assess.arms.value <= 69, `${e.chair.id} braccioli`);
      assert(e.assess.budget.total != null && e.assess.budget.total <= 120, `${e.chair.id} totale`);
    }
  });

  test('scelte con i pesi predefiniti', () => {
    const p = picks(ev());
    eq([p.bestOverall.chair.id, p.smallSpace.chair.id, p.adjust.chair.id, p.bestDeal.chair.id],
      ['amz-yaheetech-yp136n', 'ikea-huvudspelare', 'amz-songmics-obn37bk', 'amz-songmics-obn22bk']);
    eq(p.bestOverall.assess.budget.total, 69.99);
  });

  test('qualità-prezzo: frontiera di 5 idonee e miglior rapporto JYSK NIMTOFTE', () => {
    const p = picks(ev());
    eq(p.value.frontier.map((i) => i.id), ['jysk-nimtofte', 'amz-songmics-obn22bk', 'amz-yaheetech-yp136n', 'amz-songmics-obn37bk', 'amz-holludle-folder1']);
    eq(p.bestValue.chair.id, 'jysk-nimtofte');
    for (const i of p.value.items) assert(i.onFrontier === (i.dominatedBy.length === 0), `${i.id}: fuori frontiera ⇔ battuta`);
  });

  test('qualità-prezzo: frontiera e miglior rapporto stabili con pesi ±50%', () => {
    const base = picks(ev()).value.frontier.map((i) => i.id).join();
    for (const k of ['regolazioni', 'recensioni', 'robustezza', 'prezzo', 'margini', 'completezza']) {
      for (const f of [0.5, 1.5]) {
        const p = picks(evaluate(data.chairs, { ...DEFAULT_WEIGHTS, [k]: DEFAULT_WEIGHTS[k] * f }, C));
        eq(p.bestValue.chair.id, 'jysk-nimtofte', `${k} ×${f}`);
        if (k !== 'regolazioni' && k !== 'recensioni' && k !== 'robustezza') eq(p.value.frontier.map((i) => i.id).join(), base, `${k} ×${f}`);
      }
    }
  });

  test('solidità: YP-136N resta prima in 8 varianti dei pesi su 12 (altrimenti NIMTOFTE)', () => {
    const st = rankingStability(data.chairs, DEFAULT_WEIGHTS, C);
    eq([st.id, st.kept, st.total], ['amz-yaheetech-yp136n', 8, 12]);
    eq(st.rivals.map((r) => r.id), ['jysk-nimtofte']);
  });

  test('alternative per una sedia da verificare: confronto con le idonee', () => {
    const all = ev();
    const idonee = all.filter((e) => e.assess.status === 'idonea');
    const alts = alternativesFor(all.find((e) => e.chair.id === 'jysk-folby'), idonee);
    assert(alts.length > 0 && alts.every((a) => a.saving >= 0 && a.gain >= 0));
  });

  test('analisi qualità-prezzo vuota senza errori', () => {
    const v = analyzeValue([]);
    eq([v.items.length, v.frontier.length, v.ranked.length], [0, 0, 0]);
  });
}
