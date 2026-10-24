import { esc, productImage, wireImageFallbacks, badge } from '@app/js/ui/dom.js';
import { euro, cm, int, STATUS_LABEL, REF_LABEL } from '@app/js/logic/format.js';
import { state } from '@app/js/state.js';
import { DEFAULT_WEIGHTS, WEIGHT_LABELS, rankingStability } from '@app/js/logic/score.js';

function facts(e) {
  const c = e.chair;
  const a = e.assess;
  const out = [];
  out.push(`totale ${a.budget.total != null ? euro(a.budget.total) : `${euro(c.price)} + spedizione`}${a.budget.status === 'verificato-ritiro' ? ' con ritiro gratuito in negozio' : ''}`);
  if (a.width.value != null) out.push(`larghezza ${cm(a.width.value)} (margine ${cm(a.width.margin)})`);
  if (c.arms?.type === 'nessuno') out.push('senza braccioli');
  else if (a.arms.value != null) out.push(`braccioli ${cm(a.arms.value)} da terra a seduta minima${c.arms.derived ? ' (dato derivato)' : ''}`);
  if (e.score.adjustments.length) out.push(`regolazioni: ${e.score.adjustments.join(', ')}`);
  if (c.rating) out.push(`★ ${String(c.rating.v).replace('.', ',')} su ${int(c.rating.n)} valutazioni (${c.rating.platform.split(' ')[0]})`);
  if (c.maxLoad?.v) out.push(`portata ${c.maxLoad.v} kg`);
  const v = (n, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',');
  const epp = e.score.quality > 0 ? (a.budget.total ?? c.price) / e.score.quality : null;
  out.push(`indice di qualità ${v(e.score.quality)}/100${epp != null ? ` (${v(epp, 2)} € a punto)` : ''}`);
  return out;
}

function pickCard(kicker, e, why) {
  if (!e) return `<div class="card pick"><div><div class="kicker">${esc(kicker)}</div><p class="muted">Nessuna sedia idonea soddisfa il criterio.</p></div></div>`;
  const c = e.chair;
  return `<article class="card pick">
    <a href="#/sedia/${encodeURIComponent(c.id)}">${productImage(c)}</a>
    <div>
      <div class="kicker">${esc(kicker)}</div>
      <h3><a href="#/sedia/${encodeURIComponent(c.id)}">${esc(c.brand)} ${esc(c.model)}</a></h3>
      <div class="small muted">${esc(c.store)} · ${esc(c.seller)} · punteggio ${String(e.score.value).replace('.', ',')}</div>
      ${why ? `<p class="small">${why}</p>` : ''}
      <ul class="tight small">${facts(e).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
      ${(c.cons || []).length ? `<p class="small muted">Attenzione: ${esc(c.cons[0])}</p>` : ''}
      <div class="btn-row"><a class="btn" href="#/sedia/${encodeURIComponent(c.id)}">Scheda</a><a class="btn primary" href="#/stanza/${encodeURIComponent(c.id)}">Stanza 3D</a></div>
    </div>
  </article>`;
}

export function render(root, ctx) {
  const p = ctx.picks;
  const custom = JSON.stringify(state.weights) !== JSON.stringify(DEFAULT_WEIGHTS);
  const deal = p.bestDeal;
  const bv = p.bestValue ? p.value.byId.get(p.bestValue.chair.id) : null;
  root.innerHTML = `
    <h1>Scelte per la tua postazione</h1>
    <p class="muted">Calcolate tra le <strong>${p.eligibleCount}</strong> sedie idonee (vincoli di larghezza, braccioli e budget verificati). I vincoli vengono prima del punteggio: una sedia esclusa o da verificare non può comparire qui. ${custom ? '<strong>Stai usando pesi personalizzati</strong> (vedi Metodo).' : 'Pesi predefiniti (modificabili in «Metodo e fonti»).'}</p>
    <div class="picks">
      ${pickCard('Migliore scelta complessiva', p.bestOverall, 'Miglior punteggio editoriale tra le idonee.')}
      ${pickCard('Miglior rapporto qualità-prezzo', p.bestValue, bv ? `Meno euro per punto di qualità tra le idonee: ${String(bv.eurPerPoint.toFixed(2)).replace('.', ',')} € a punto. ${bv.onFrontier ? 'È sulla frontiera qualità-prezzo.' : ''} <a href="#/valore">Grafico e frontiera</a>` : '')}
      ${pickCard('Migliore per spazio ridotto', p.smallSpace, 'Minore profondità documentata tra le idonee: lascia più spazio nei 90 cm alle spalle.')}
      ${pickCard('Migliore per regolazioni documentate', p.adjust, 'Più regolazioni dichiarate dal venditore tra le idonee.')}
      ${pickCard('Migliore offerta verificata', deal, deal ? `Prezzo ${euro(deal.chair.price)}, −${deal.discount.pct}% rispetto al ${esc(REF_LABEL[deal.discount.ref.kind])} di ${euro(deal.discount.ref.v)} (riferimento affidabile; il «prezzo consigliato» non è considerato).` : '')}
    </div>
    ${stabilityPanel(ctx)}
    <h2 style="margin-top:22px">Alternative</h2>
    <div class="picks">${p.alternatives.map((e, i) => pickCard(`Alternativa ${i + 1}`, e)).join('')}</div>
    <h2 style="margin-top:22px">Promettenti ma da verificare</h2>
    <p class="muted small">Non sono raccomandate finché non confermi i punti indicati (misure, spedizione o disponibilità).</p>
    <div class="picks">${p.toVerify.map((e) => `<article class="card pick">
        <a href="#/sedia/${encodeURIComponent(e.chair.id)}">${productImage(e.chair)}</a>
        <div><div class="kicker">${badge('da-verificare', STATUS_LABEL['da-verificare'])}</div>
        <h3><a href="#/sedia/${encodeURIComponent(e.chair.id)}">${esc(e.chair.brand)} ${esc(e.chair.model)}</a></h3>
        <div class="small muted">${esc(e.chair.store)} · ${euro(e.chair.price)} · punteggio ${String(e.score.value).replace('.', ',')}</div>
        <ul class="tight small">${e.assess.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div></article>`).join('')}</div>
    <div class="panel" style="margin-top:22px">
      <h2>Come leggere queste scelte</h2>
      <p class="small">Fatti verificati (misure, prezzi, condizioni) e valutazioni (punteggio) sono separati: il punteggio è un ordinamento editoriale con pesi dichiarati, non una misura scientifica né una garanzia di comfort. Le recensioni sono riassunti del negozio e conteggi di menzioni, non test indipendenti. Le misure «derivate» sono calcolate da quote documentate e mostrate con il calcolo nella scheda.</p>
    </div>`;
  wireImageFallbacks(root);
}

// Quanto dipende la prima scelta dai pesi: margine sulla seconda e varianti ±50%.
function stabilityPanel(ctx) {
  const p = ctx.picks;
  if (!p.bestOverall) return '';
  const st = rankingStability(ctx.data.chairs, state.weights, ctx.constraints);
  const second = p.alternatives[0];
  const gap = second ? Math.round((p.bestOverall.score.value - second.score.value) * 10) / 10 : null;
  const label = (id) => { const e = ctx.byId.get(id); return e ? `${esc(e.chair.brand)} ${esc(e.chair.model.replace(/\s*[(«].*$/, ''))}` : esc(id); };
  const solid = st.kept === st.total;
  const pct = (f) => `${f < 1 ? '−' : '+'}${Math.round(Math.abs(f - 1) * 100)}%`;
  return `<div class="panel" style="margin-top:14px">
    <h2>Quanto è solida la prima scelta? ${badge(solid ? 'ok' : st.kept * 2 >= st.total ? 'warn' : 'bad', solid ? 'solida' : 'sensibile ai pesi')}</h2>
    <p class="small">${second ? `Margine sulla seconda (${label(second.chair.id)}): <strong>${String(gap).replace('.', ',')} punti</strong>. ` : ''}Variando un peso alla volta del −50% e del +50%, ${label(st.id)} resta prima in <strong>${st.kept} casi su ${st.total}</strong>.</p>
    ${st.rivals.length ? `<ul class="tight small">${st.rivals.map((r) => `<li>Vince <a href="#/sedia/${encodeURIComponent(r.id)}">${label(r.id)}</a> con: ${r.variants.map((v) => `${esc(WEIGHT_LABELS[v.key].toLowerCase())} ${pct(v.factor)}`).join(', ')}</li>`).join('')}</ul>
    <p class="small muted">La prima posizione dipende da come pesi i criteri: confronta le sedie in gioco (pagina Confronto) e regola i pesi in «Metodo e fonti» secondo le tue priorità.</p>` : ''}
  </div>`;
}
