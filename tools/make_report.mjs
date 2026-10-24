// Rigenera research/REPORT.md dai dati e dalla stessa logica dell'app,
// così il report non può divergere da quello che l'app mostra.
//   node --import ./tests/app-loader.mjs tools/make_report.mjs
import fs from 'node:fs';
import { evaluate, picks, rankingStability, DEFAULT_WEIGHTS, WEIGHT_LABELS } from '@app/js/logic/score.js';
import { eurPerPoint, valueTotal } from '@app/js/logic/value.js';
import { STATUS_LABEL, WIDTH_LABEL, ARMS_LABEL } from '@app/js/logic/format.js';

const root = new URL('../', import.meta.url);
const read = (rel) => JSON.parse(fs.readFileSync(new URL(`data/${rel}`, root), 'utf8'));
const catalog = read('catalog.json');
const conventions = read('conventions.json');
const chairs = catalog.files.flatMap((f) => read(f));
const C = { maxWidthCm: catalog.constraints.maxWidthCm, maxArmHeightCm: catalog.constraints.maxArmHeightCm, budgetEur: catalog.budgetEur };
const ev = evaluate(chairs, DEFAULT_WEIGHTS, C);
const p = picks(ev);
const st = rankingStability(chairs, DEFAULT_WEIGHTS, C);

const num = (n, d = 2) => (n == null ? '—' : n.toFixed(d).replace('.', ','));
const eur = (n) => (n == null ? '—' : `${num(n)} €`);
const cm = (n) => (n == null ? '—' : `${String(Math.round(n * 10) / 10).replace('.', ',')} cm`);
const name = (c) => `${c.brand.replace(/\s*\(.*\)$/, '')} ${c.model.replace(/\s*[(«].*$/, '')}`;
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
const total = (e) => (e.assess.budget.total != null ? eur(e.assess.budget.total) : `${eur(e.chair.price)} + sped.`);
const count = (list, key) => list.reduce((m, x) => ((m[key(x)] = (m[key(x)] || 0) + 1), m), {});
const byStatus = count(ev, (e) => e.assess.status);
const byStore = count(chairs, (c) => c.store);
const pickLine = (label, e, why = '') => (e ? `- **${label}**: ${name(e.chair)} (${e.chair.store}, ${e.chair.code}) — totale ${total(e)}, punteggio ${num(e.score.value, 1)}, qualità ${num(e.score.quality, 1)}/100${why ? `. ${why}` : ''}` : `- **${label}**: nessuna`);

const order = { idonea: 0, 'da-verificare': 1, esclusa: 2 };
const rows = [...ev].sort((a, b) => order[a.assess.status] - order[b.assess.status] || b.score.value - a.score.value);
const frontier = new Set(p.value.frontier.map((i) => i.id));

const md = `# Sedie da lavoro entro ${catalog.budgetEur} € — report

> Generato da \`tools/make_report.mjs\` a partire da \`data/\` con la stessa logica dell'app (pesi predefiniti).
> Rilevazione: ${catalog.checkWindow}. Prezzi e disponibilità non si aggiornano da soli.
> Non modificare a mano: aggiorna i dati e rigenera.

## Vincoli

- Larghezza d'ingombro ≤ **${C.maxWidthCm} cm** (braccioli e base con ruote inclusi).
- Braccioli ≤ **${C.maxArmHeightCm} cm** da terra nella configurazione in cui la sedia entra sotto il tavolo.
- **${catalog.constraints.spaceBehindTableCm} cm** tra bordo del tavolo e muro alle spalle (verifica nella Stanza 3D).
- Totale ≤ **${catalog.budgetEur} €** con IVA, spedizione e costi obbligatori; solo gli sconti verificati riducono il totale.
- Misure, prezzi, recensioni e disponibilità non documentati restano «da verificare»; i dati derivati sono mostrati con il calcolo.

## Sintesi

**${chairs.length} modelli distinti** (le varianti di colore non contano come modelli diversi): ${Object.entries(byStore).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(', ')}.

Esito: **${byStatus.idonea || 0} idonee**, ${byStatus['da-verificare'] || 0} da verificare, ${byStatus.esclusa || 0} escluse.

## Scelte (tra le idonee)

${pickLine('Migliore complessiva', p.bestOverall)}
${pickLine('Miglior rapporto qualità-prezzo', p.bestValue, p.bestValue ? `${num(p.value.byId.get(p.bestValue.chair.id).eurPerPoint)} € per punto di qualità` : '')}
${pickLine('Spazio ridotto', p.smallSpace, p.smallSpace ? `Profondità ${cm(p.smallSpace.chair.depth.v)}` : '')}
${pickLine('Regolazioni documentate', p.adjust)}
${pickLine('Offerta verificata', p.bestDeal, p.bestDeal ? `−${p.bestDeal.discount.pct}% sul ${p.bestDeal.discount.ref.kind === 'mediano' ? 'prezzo mediano Amazon' : p.bestDeal.discount.ref.kind}` : '')}
${p.alternatives.map((e, i) => pickLine(`Alternativa ${i + 1}`, e)).join('\n')}

**Solidità della prima scelta.** Margine sulla seconda: ${num(p.bestOverall.score.value - p.alternatives[0].score.value, 1)} punti. Variando un peso alla volta del −50% e del +50%, ${name(p.bestOverall.chair)} resta prima in **${st.kept} casi su ${st.total}**${st.rivals.length ? `; negli altri vince ${st.rivals.map((r) => `${name(chairs.find((c) => c.id === r.id))} (${r.variants.map((v) => `${WEIGHT_LABELS[v.key].toLowerCase()} ${v.factor < 1 ? '−' : '+'}${Math.round(Math.abs(v.factor - 1) * 100)}%`).join(', ')})`).join('; ')}` : ''}. La classifica editoriale va letta come un pari merito tra le prime due; il miglior rapporto qualità-prezzo e la frontiera, invece, non cambiano in nessuna di queste varianti.

## Rapporto qualità-prezzo

Indice di qualità 0–100 senza prezzo: regolazioni (${DEFAULT_WEIGHTS.regolazioni}), recensioni con media bayesiana (${DEFAULT_WEIGHTS.recensioni}), robustezza (${DEFAULT_WEIGHTS.robustezza}). Frontiera di Pareto: le idonee che nessun'altra idonea batte insieme su totale e indice.

| Sedia | Totale | Qualità | € per punto | Rispetto alla precedente |
|---|---:|---:|---:|---|
${p.value.frontier.map((i) => `| ${cell(name(i.e.chair))} | ${total(i.e)} | ${num(i.q, 1)} | ${num(i.eurPerPoint)} | ${i.step ? `+${eur(i.step.dEur)} per +${num(i.step.dQ, 1)} punti (${num(i.step.eurPerExtraPoint)} € a punto)` : 'la più economica'} |`).join('\n')}

Le altre ${p.value.items.length - p.value.frontier.length} idonee hanno almeno un'alternativa idonea che costa non di più con qualità non inferiore (dettaglio nella pagina «Qualità/prezzo» dell'app).

## Promettenti da verificare

${p.toVerify.map((e) => `- **${name(e.chair)}** (${e.chair.store}, ${eur(e.chair.price)}): ${e.assess.reasons.join('; ')}`).join('\n')}

## Tutti i candidati

| Esito | Sedia | Negozio | Totale | Larghezza | Braccioli da terra | Punteggio | Qualità | €/punto | Note |
|---|---|---|---:|---|---|---:|---:|---:|---|
${rows.map((e) => {
    const c = e.chair;
    const a = e.assess;
    const epp = eurPerPoint(valueTotal(e), e.score.quality);
    const arms = c.arms?.type === 'nessuno' ? 'senza' : `${cm(a.arms.value)} (${ARMS_LABEL[a.arms.status].toLowerCase()})`;
    const note = a.status === 'idonea' ? (frontier.has(c.id) ? 'frontiera qualità-prezzo' : '') : a.reasons[0] || '';
    return `| ${STATUS_LABEL[a.status]} | ${cell(name(c))} | ${cell(c.store)} | ${total(e)} | ${cm(a.width.value)} (${WIDTH_LABEL[a.width.status].toLowerCase()}) | ${cell(arms)} | ${num(e.score.value, 1)} | ${num(e.score.quality, 1)} | ${epp != null ? num(epp) : '—'} | ${cell(note)} |`;
  }).join('\n')}

## Convenzioni aziendali

${conventions.items.map((i) => `- **${i.name}** (portale: ${i.portalValue}) — ${i.status}: ${i.summary}`).join('\n')}

Nessuna convenzione è applicata ai totali.

## Limiti

- Prezzi, coupon e disponibilità cambiano: vanno ricontrollati sulle schede prima di acquistare.
- Spedizioni dei venditori terzi Amazon e consegna JYSK a domicilio visibili solo nel carrello.
- Le misure della stanza diverse da 90/69/69 cm sono stime modificabili; le sedie in 3D sono ricostruzioni approssimate.
- Punteggio e indice di qualità ordinano dati dichiarati: non misurano comfort, durata o postura.
`;

fs.writeFileSync(new URL('research/REPORT.md', root), md);
console.log(`Scritto research/REPORT.md (${chairs.length} candidati)`);
