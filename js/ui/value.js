import { state, save } from '@app/js/state.js';
import { esc, badge } from '@app/js/ui/dom.js';
import { euro, STATUS_LABEL } from '@app/js/logic/format.js';
import { analyzeValue, QUALITY_KEYS } from '@app/js/logic/value.js';
import { WEIGHT_LABELS } from '@app/js/logic/score.js';

let resizeObs = null;

export function cleanup() {
  if (resizeObs) { resizeObs.disconnect(); resizeObs = null; }
}

const dec = (n, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',');
// Nome senza le note tra parentesi del modello (es. «(collezione Kime)»).
const name = (c) => `${c.brand.replace(/\s*\(.*\)$/, '')} ${c.model.replace(/\s*[(«].*$/, '')}`;
// Etichetta breve per il grafico: modello senza note tra parentesi.
const shortLabel = (c) => {
  const m = c.model.replace(/\s*[(«].*$/, '');
  return m.length > 14 ? `${m.slice(0, 13)}…` : m;
};
const totalTxt = (i) => (i.lowerBound ? `≥ ${euro(i.total)}` : euro(i.total));
const eppTxt = (i) => (i.eurPerPoint != null ? `${dec(i.eurPerPoint, 2)} €` : '—');
const partial = (e) => !e.chair.rating || e.score.parts.completezza < 0.6;
const altStatus = (e) => (e.assess.status === 'idonea' ? '' : ` (${STATUS_LABEL[e.assess.status].toLowerCase()})`);

export function render(root, ctx) {
  cleanup();
  const withCheck = Boolean(state.valueWithCheck);
  const pool = ctx.evaluated.filter((e) => e.assess.status === 'idonea' || (withCheck && e.assess.status === 'da-verificare'));
  const v = withCheck ? analyzeValue(pool) : ctx.picks.value;
  const best = v.ranked[0];
  const top = [...v.items].sort((a, b) => b.q - a.q || a.total - b.total)[0];
  const dominated = v.items.filter((i) => !i.onFrontier).sort((a, b) => a.total - b.total);
  const wsum = QUALITY_KEYS.reduce((a, k) => a + state.weights[k], 0);
  const share = (k) => (wsum > 0 ? Math.round(state.weights[k] / wsum * 100) : Math.round(100 / QUALITY_KEYS.length));

  root.innerHTML = `
    <div class="toolbar">
      <div><h1>Rapporto qualità-prezzo</h1>
        <p class="muted small" style="margin:0">Quanta qualità documentata si ottiene per ogni euro, tra le sedie che rispettano i vincoli. Indice di qualità = ${QUALITY_KEYS.map((k) => `${esc(WEIGHT_LABELS[k].toLowerCase())} ${share(k)}%`).join(', ')} (pesi di «Metodo e fonti»); il prezzo è escluso dall'indice.</p></div>
      <label class="small"><input type="checkbox" id="withCheck" ${withCheck ? 'checked' : ''}> Includi le «da verificare»</label>
    </div>

    <div class="stat-row">
      <div class="stat"><div class="stat-label">Sulla frontiera</div><div class="stat-value">${v.frontier.length} <small>su ${v.items.length}</small></div><div class="small muted">nessun'altra sedia è insieme migliore e meno cara</div></div>
      ${best ? `<div class="stat"><div class="stat-label">Meno euro per punto di qualità</div><div class="stat-value">${dec(best.eurPerPoint, 2)} € <small>a punto</small></div><div class="small"><a href="#/sedia/${encodeURIComponent(best.id)}">${esc(name(best.e.chair))}</a> · ${totalTxt(best)}</div></div>` : ''}
      ${top ? `<div class="stat"><div class="stat-label">Qualità più alta</div><div class="stat-value">${dec(top.q)} <small>/ 100</small></div><div class="small"><a href="#/sedia/${encodeURIComponent(top.id)}">${esc(name(top.e.chair))}</a> · ${totalTxt(top)}</div></div>` : ''}
    </div>

    <div class="panel" style="margin-top:14px">
      <div class="legend chart-legend" aria-hidden="true">
        <span><svg width="14" height="14"><circle cx="7" cy="7" r="5" class="pt-ok"/></svg> Idonea</span>
        ${withCheck ? '<span><svg width="14" height="14"><circle cx="7" cy="7" r="4.5" class="pt-check"/></svg> Da verificare</span>' : ''}
        <span><svg width="22" height="14"><path d="M1 11H11V3H21" class="frontier-line"/></svg> Frontiera qualità-prezzo</span>
      </div>
      <div class="chart-wrap" id="chart"></div>
      <p class="small muted" style="margin:6px 0 0">Ogni punto è una sedia: più a sinistra costa meno, più in alto ha un indice di qualità maggiore. Le sedie sotto e a destra della linea sono battute da almeno una sedia sulla frontiera. ${withCheck ? 'Per le «da verificare» con spedizione non nota la posizione usa il solo prezzo (limite inferiore).' : ''} Passa sopra un punto per i dettagli, toccalo per aprire la scheda.</p>
    </div>

    <div class="panel" style="margin-top:14px">
      <h2>Frontiera: le scelte non battute</h2>
      <p class="small muted">In ordine di prezzo. L'ultima colonna dice quanto costa ogni punto di qualità in più passando dalla sedia precedente: è il modo più diretto per decidere fin dove conviene salire di prezzo.</p>
      <div class="compare-wrap"><table class="vtable">
        <thead><tr><th>Sedia</th><th>Esito</th><th class="num">Totale</th><th class="num">Qualità</th><th class="num">€ per punto</th><th>Rispetto alla precedente</th></tr></thead>
        <tbody>${v.frontier.map((i) => `<tr>
          <td><a href="#/sedia/${encodeURIComponent(i.id)}">${esc(name(i.e.chair))}</a><div class="small muted">${esc(i.e.chair.store)}${partial(i.e) ? ' · dati parziali' : ''}</div></td>
          <td>${badge(i.e.assess.status, STATUS_LABEL[i.e.assess.status])}</td>
          <td class="num">${totalTxt(i)}</td><td class="num">${dec(i.q)}</td><td class="num">${eppTxt(i)}</td>
          <td class="small">${i.step ? `+${euro(i.step.dEur)} per +${dec(i.step.dQ)} punti${i.step.eurPerExtraPoint != null ? ` → <strong>${dec(i.step.eurPerExtraPoint, 2)} €</strong> a punto` : ''}` : 'la più economica della frontiera'}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>

    <div class="panel" style="margin-top:14px">
      <h2>Battute da un'alternativa migliore e meno cara</h2>
      <p class="small muted">Per ognuna c'è almeno una sedia ${withCheck ? 'dell\'insieme' : 'idonea'} che costa non di più e ha un indice di qualità non inferiore. Può comunque avere un motivo per essere scelta (estetica, profondità, negozio): l'indice non misura tutto.</p>
      ${dominated.length ? `<div class="compare-wrap"><table class="vtable">
        <thead><tr><th>Sedia</th><th class="num">Totale</th><th class="num">Qualità</th><th>Alternativa migliore e meno cara</th></tr></thead>
        <tbody>${dominated.map((i) => {
    const alt = i.dominatedBy[0];
    return `<tr>
          <td><a href="#/sedia/${encodeURIComponent(i.id)}">${esc(name(i.e.chair))}</a><div class="small muted">${badge(i.e.assess.status, STATUS_LABEL[i.e.assess.status])}${partial(i.e) ? ' dati parziali' : ''}</div></td>
          <td class="num">${totalTxt(i)}</td><td class="num">${dec(i.q)}</td>
          <td><a href="#/sedia/${encodeURIComponent(alt.id)}">${esc(name(alt.e.chair))}</a>${esc(altStatus(alt.e))}<div class="small muted">${alt.saving > 0 ? `${euro(alt.saving)} in meno` : 'stesso prezzo'}, ${alt.gain > 0 ? `+${dec(alt.gain)} punti` : 'stessa qualità'}${i.dominatedBy.length > 1 ? ` · altre ${i.dominatedBy.length - 1}` : ''}</div></td>
        </tr>`;
  }).join('')}</tbody>
      </table></div>` : '<p class="muted">Nessuna: tutte le sedie dell\'insieme sono sulla frontiera.</p>'}
    </div>

    <div class="panel" style="margin-top:14px">
      <h2>Come leggere l'indice</h2>
      <ul class="tight small">
        <li><strong>Indice di qualità (0–100)</strong>: media pesata di regolazioni dichiarate, recensioni (media bayesiana) e robustezza (portata, garanzia, resi), con i pesi correnti di «Metodo e fonti». Prezzo, margini sui vincoli e completezza dei dati non entrano.</li>
        <li><strong>€ per punto</strong>: totale con spedizione diviso per l'indice. Favorisce le sedie economiche: per questo conta anche il costo dei punti in più lungo la frontiera.</li>
        <li><strong>Frontiera</strong>: una sedia ci sta se nessun'altra dell'insieme costa non di più e ha un indice non inferiore (con almeno una delle due differenze strettamente migliore).</li>
        <li><strong>Dati parziali</strong>: senza recensioni o con pochi dati chiave l'indice è prudente (il dato mancante vale zero), quindi può sottostimare la sedia.</li>
        <li>L'indice ordina dati documentati: non misura comfort, durata o postura.</li>
      </ul>
    </div>`;

  root.querySelector('#withCheck').addEventListener('change', (ev) => { state.valueWithCheck = ev.target.checked; save(); render(root, ctx); });

  const chartEl = root.querySelector('#chart');
  let lastW = 0;
  const draw = () => {
    const w = chartEl.clientWidth;
    if (!w || w === lastW) return;
    lastW = w;
    drawChart(chartEl, v, ctx.constraints.budgetEur);
  };
  draw();
  if (typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(() => requestAnimationFrame(draw));
    resizeObs.observe(chartEl);
  }
}

let measureCtx = null;
function textWidth(text) {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  if (!measureCtx) return text.length * 7;
  measureCtx.font = '600 12px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  return measureCtx.measureText(text).width;
}

const overlaps = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

// Etichette solo per i punti della frontiera; posizione scelta tra quattro
// candidate evitando altre etichette e punti, altrimenti l'etichetta si omette
// (il valore resta nel tooltip e nella tabella).
function placeLabels(frontier, all, plot) {
  const placed = [];
  const dots = all.map((p) => ({ x0: p.px - p.r - 1, x1: p.px + p.r + 1, y0: p.py - p.r - 1, y1: p.py + p.r + 1, id: p.id }));
  const out = [];
  for (const p of frontier) {
    const text = shortLabel(p.e.chair);
    const w = textWidth(text);
    const cands = [
      { x: p.px + 9, y: p.py - 8, anchor: 'start' },
      { x: p.px - 9, y: p.py - 8, anchor: 'end' },
      { x: p.px + 9, y: p.py + 17, anchor: 'start' },
      { x: p.px - 9, y: p.py + 17, anchor: 'end' },
      { x: p.px, y: p.py - 13, anchor: 'middle' },
    ];
    const boxOf = (c) => {
      const x0 = c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - w : c.x - w / 2;
      return { x0: x0 - 2, x1: x0 + w + 2, y0: c.y - 12, y1: c.y + 3 };
    };
    const inside = (b) => b.x0 >= plot.x0 && b.x1 <= plot.x1 + 14 && b.y0 >= plot.y0 - 14 && b.y1 <= plot.y1;
    const free = (b, strict) => inside(b) && !placed.some((o) => overlaps(o, b)) && (!strict || !dots.some((d) => d.id !== p.id && overlaps(d, b)));
    const pick = cands.find((c) => free(boxOf(c), true)) || cands.find((c) => free(boxOf(c), false));
    if (!pick) continue;
    placed.push(boxOf(pick));
    out.push({ ...pick, text });
  }
  return out;
}

function niceStep(span, target) {
  const raw = span / target;
  return [5, 10, 20, 25, 50].find((s) => s >= raw) || 50;
}

function drawChart(el, v, budget) {
  const W = el.clientWidth;
  const H = Math.max(280, Math.min(460, Math.round(W * 0.56)));
  const m = { l: 40, r: 16, t: 30, b: 40 };
  const items = v.items;
  const totals = items.map((i) => i.total);
  const xMin = Math.floor((Math.min(...totals) - 4) / 10) * 10;
  const xMax = Math.max(budget, Math.ceil(Math.max(...totals) / 10) * 10) + 5;
  const yMax = Math.min(100, Math.ceil((Math.max(...items.map((i) => i.q)) + 6) / 10) * 10);
  const x = (t) => m.l + (t - xMin) / (xMax - xMin) * (W - m.l - m.r);
  const y = (q) => H - m.b - q / yMax * (H - m.t - m.b);
  const plot = { x0: m.l, x1: W - m.r, y0: m.t, y1: H - m.b };
  const xStep = niceStep(xMax - xMin, W < 480 ? 4 : 8);
  const yStep = niceStep(yMax, H < 340 ? 4 : 6);
  const xTicks = [];
  for (let t = Math.ceil(xMin / xStep) * xStep; t <= xMax; t += xStep) xTicks.push(t);
  const yTicks = [];
  for (let q = 0; q <= yMax; q += yStep) yTicks.push(q);

  const frontierIds = new Set(v.frontier.map((i) => i.id));
  const pts = items.map((i) => ({ ...i, px: x(i.total), py: y(i.q), r: frontierIds.has(i.id) ? 6.5 : 5, ok: i.e.assess.status === 'idonea' }));
  const byId = new Map(pts.map((p) => [p.id, p]));
  const fr = v.frontier.map((i) => byId.get(i.id));
  // Gradini: da ogni punto orizzontale fino al prezzo del successivo, poi in verticale.
  const stair = fr.length ? `M${fr[0].px},${fr[0].py}${fr.slice(1).map((p) => `H${p.px}V${p.py}`).join('')}` : '';
  const labels = placeLabels(fr, pts, plot);
  // Ordine di disegno: da verificare, idonee, frontiera (in primo piano).
  const order = [...pts].sort((a, b) => (a.ok - b.ok) || (frontierIds.has(a.id) - frontierIds.has(b.id)));
  const aria = (p) => `${name(p.e.chair)}: totale ${p.lowerBound ? 'almeno ' : ''}${euro(p.total)}, qualità ${dec(p.q)} su 100${p.eurPerPoint != null ? `, ${dec(p.eurPerPoint, 2)} euro per punto` : ''}${frontierIds.has(p.id) ? ', sulla frontiera' : ''}`;

  el.innerHTML = `<svg class="vchart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="group" aria-label="Grafico qualità-prezzo: ${pts.length} sedie">
    <text class="axis-title" x="0" y="13">Indice di qualità</text>
    ${yTicks.map((q) => `<line class="grid" x1="${m.l}" x2="${W - m.r}" y1="${y(q)}" y2="${y(q)}"/><text class="tick" x="${m.l - 6}" y="${y(q) + 4}" text-anchor="end">${q}</text>`).join('')}
    ${xTicks.map((t) => `<text class="tick" x="${x(t)}" y="${H - m.b + 16}" text-anchor="middle">${t} €</text>`).join('')}
    <text class="axis-title" x="${W - m.r}" y="${H - 4}" text-anchor="end">Totale con spedizione</text>
    ${budget <= xMax ? `<line class="budget" x1="${x(budget)}" x2="${x(budget)}" y1="${m.t - 6}" y2="${H - m.b}"/><text class="tick" x="${x(budget) - 4}" y="${m.t - 10}" text-anchor="end">budget ${budget} €</text>` : ''}
    ${stair ? `<path class="frontier-line" d="${stair}"/>` : ''}
    ${order.map((p) => `<a href="#/sedia/${encodeURIComponent(p.id)}" data-id="${esc(p.id)}" aria-label="${esc(aria(p))}"><circle cx="${p.px}" cy="${p.py}" r="${p.r}" class="${p.ok ? 'pt-ok' : 'pt-check'}"/></a>`).join('')}
    ${labels.map((l) => `<text class="plabel" x="${l.x}" y="${l.y}" text-anchor="${l.anchor}">${esc(l.text)}</text>`).join('')}
  </svg><div class="tip" hidden></div>`;

  const svg = el.querySelector('svg');
  const tip = el.querySelector('.tip');
  let active = null;
  const show = (p) => {
    if (active === p) return;
    svg.querySelectorAll('a.hover').forEach((a) => a.classList.remove('hover'));
    active = p;
    if (!p) { tip.hidden = true; return; }
    svg.querySelector(`a[data-id="${CSS.escape(p.id)}"]`)?.classList.add('hover');
    const alt = p.dominatedBy[0];
    tip.innerHTML = `<strong>${esc(name(p.e.chair))}</strong><div class="muted">${esc(p.e.chair.store)} · ${esc(STATUS_LABEL[p.e.assess.status])}</div>
      <div>Totale ${p.lowerBound ? `≥ ${euro(p.total)} <span class="muted">(spedizione non verificata)</span>` : euro(p.total)}</div>
      <div>Qualità ${dec(p.q)}/100 · ${p.eurPerPoint != null ? `${dec(p.eurPerPoint, 2)} € a punto` : '—'}</div>
      <div class="muted">${frontierIds.has(p.id) ? 'Sulla frontiera' : alt ? `Battuta da ${esc(name(alt.e.chair) + altStatus(alt.e))}` : ''}</div>`;
    tip.hidden = false;
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    let left = p.px + 14;
    if (left + tw > W) left = p.px - 14 - tw;
    tip.style.left = `${Math.max(0, left)}px`;
    tip.style.top = `${Math.max(0, Math.min(H - th, p.py - th / 2))}px`;
  };
  // Punto più vicino entro 24 px: niente bersagli minuscoli da centrare.
  const nearest = (ev) => {
    const r = svg.getBoundingClientRect();
    const mx = ev.clientX - r.left;
    const my = ev.clientY - r.top;
    let best = null;
    let bd = 24 * 24;
    for (const p of pts) {
      const d = (p.px - mx) ** 2 + (p.py - my) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  };
  svg.addEventListener('pointermove', (ev) => show(nearest(ev)));
  svg.addEventListener('pointerleave', () => show(null));
  svg.addEventListener('click', (ev) => {
    const p = nearest(ev);
    if (!p) return;
    ev.preventDefault();
    location.hash = `#/sedia/${encodeURIComponent(p.id)}`;
  });
  svg.querySelectorAll('a[data-id]').forEach((a) => {
    a.addEventListener('focus', () => show(byId.get(a.dataset.id)));
    a.addEventListener('blur', () => show(null));
  });
}
