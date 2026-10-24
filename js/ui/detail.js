import { state, toggleIn } from '@app/js/state.js';
import { esc, productImage, wireImageFallbacks, badge, toast } from '@app/js/ui/dom.js';
import { euro, cm, range, int, STATUS_LABEL, DIM_LABEL, WIDTH_LABEL, ARMS_LABEL, BUDGET_LABEL, SHIP_LABEL, REF_LABEL, DISCOUNT_STATUS } from '@app/js/logic/format.js';
import { resolveChairGeometry, roomFromParams, layout, defaultPose } from '@app/js/logic/geometry.js';
import { WEIGHT_LABELS } from '@app/js/logic/score.js';
import { giftCardOutlay } from '@app/js/logic/giftcard.js';

const cls = (s) => ({ ok: 'ok', verificato: 'ok', 'verificato-ritiro': 'ok', derivata: 'warn', parziale: 'warn', mancante: 'warn', compromesso: 'warn', incerta: 'warn', probabile: 'warn', incompatibile: 'bad', fuori: 'bad' }[s] || 'neutral');

const TILT = { nessuna: 'Nessuna', 'non-dichiarata': 'Non dichiarata', oscillante: 'Oscillante', 'oscillante-tensione': 'Oscillante con tensione regolabile', bloccabile: 'Bloccabile' };

export function render(root, ctx, [id]) {
  const e = ctx.byId.get(id);
  if (!e) {
    root.innerHTML = '<div class="panel"><h2>Sedia non trovata</h2><p><a href="#/catalogo">Torna al catalogo</a></p></div>';
    return;
  }
  const c = e.chair;
  const a = e.assess;
  const g = resolveChairGeometry(c);
  const room = roomFromParams({ ...ctx.data.room.params, ...state.roomParams });
  const insert = room.insertUnder;
  const L = layout(g, room, { ...defaultPose(g), frontZ: -insert });
  const fav = state.favorites.includes(c.id);
  const inCmp = state.compare.includes(c.id);
  const conv = c.convention ? ctx.data.conventions.items.find((x) => x.id === 'home24-giftcard') : null;
  const gift = conv && a.budget.total != null ? giftCardOutlay(a.budget.total, conv.giftCard) : null;

  const discounts = (c.discounts || []).map((d) => `<li>${badge(cls(d.status === 'verificato' ? 'ok' : d.status === 'non-applicabile' ? 'fuori' : 'probabile'), DISCOUNT_STATUS[d.status] || d.status)} <strong>${esc(d.label)}</strong>${d.expires ? ` <span class="muted small">(scadenza ${esc(d.expires.split('-').reverse().join('/'))})</span>` : ''}${d.conditions ? `<div class="small muted">${esc(d.conditions)}</div>` : ''}</li>`).join('');
  const armsTxt = c.arms?.type === 'nessuno' ? 'Nessuno' : `${esc(c.arms.type.replace('-', ' e '))}${c.arms.min != null ? ` · ${range({ min: c.arms.min, max: c.arms.max })} da terra` : c.arms.single != null ? ` · ${cm(c.arms.single)} (valore unico)` : ' · altezza non documentata'}`;

  root.innerHTML = `
    <div class="breadcrumb"><a href="#/catalogo">← Catalogo</a></div>
    <div class="detail">
      <div>
        <div class="hero">${productImage(c)}</div>
        <p class="small muted">Immagine caricata dal sito del negozio (${esc(c.store)}); se non compare, apri la scheda originale.</p>
        <div class="btn-row">
          <a class="btn primary" href="#/stanza/${encodeURIComponent(c.id)}">Vedi nella stanza</a>
          <button class="btn ${inCmp ? 'on' : ''}" id="cmp">${inCmp ? '✓ In confronto' : 'Aggiungi al confronto'}</button>
          <button class="btn" id="fav" aria-pressed="${fav}">${fav ? '♥ Preferita' : '♡ Preferiti'}</button>
          <a class="btn" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Scheda del negozio ↗</a>
        </div>
      </div>
      <div>
        <div class="panel">
          <div class="btn-row" style="margin-bottom:6px">${badge(a.status, STATUS_LABEL[a.status])} ${badge(a.dims, DIM_LABEL[a.dims])} ${badge(cls(a.budget.status), BUDGET_LABEL[a.budget.status])}</div>
          <h1>${esc(c.name)}</h1>
          <p class="muted">${esc(c.brand)} · modello ${esc(c.model)} · ${esc(c.code)} · variante analizzata: ${esc(c.variant || '—')}</p>
          ${a.reasons.length ? `<ul class="tight">${a.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : '<p>Tutti i vincoli risultano rispettati con dati documentati.</p>'}
          <p class="small muted">Verifica: ${esc(ctx.data.catalog.checkWindow)}. Prezzi e disponibilità non si aggiornano da soli.</p>
        </div>

        <div class="two" style="margin-top:14px">
          <div class="panel">
            <h2>Prezzo e budget</h2>
            <dl class="kv">
              <dt>Negozio / venditore</dt><dd>${esc(c.store)} · ${esc(c.seller)}${c.shipper && c.shipper !== c.seller ? ` (spedito da ${esc(c.shipper)})` : ''}</dd>
              <dt>Prezzo rilevato</dt><dd><strong>${euro(c.price)}</strong>${c.priceRef ? ` <span class="muted small">(${esc(REF_LABEL[c.priceRef.kind] || c.priceRef.kind)}: ${euro(c.priceRef.v)}${e.discount && !e.discount.reliable ? ' — riferimento debole' : ''})</span>` : ''}</dd>
              <dt>Spedizione</dt><dd>${esc(SHIP_LABEL[c.shipping.status])}${c.shipping.cost != null ? ` · ${euro(c.shipping.cost)}${c.shipping.max != null ? `–${euro(c.shipping.max)}` : ''}` : ''}${c.shipping.note ? `<div class="small muted">${esc(c.shipping.note)}</div>` : ''}</dd>
              <dt>Totale effettivo</dt><dd><strong>${a.budget.total != null ? euro(a.budget.total) : 'non determinabile'}</strong>${a.budget.totalMin != null ? ` <span class="muted small">(minimo ${euro(a.budget.totalMin)})</span>` : ''}<div class="small muted">${esc(a.budget.text)}</div></dd>
              <dt>Margine sul budget</dt><dd>${a.budget.margin != null ? euro(a.budget.margin) : '—'}</dd>
              <dt>Disponibilità</dt><dd>${esc(c.availability || 'non rilevata')}${c.delivery ? ` · ${esc(c.delivery)}` : ''}</dd>
              <dt>Reso / garanzia</dt><dd>${esc(c.returns || 'non rilevato')} · ${esc(c.warranty || 'garanzia commerciale non indicata')}</dd>
            </dl>
            ${discounts ? `<h3 style="margin-top:12px">Sconti e coupon</h3><ul class="tight">${discounts}</ul><p class="small muted">Solo gli sconti verificati entrano nel totale.</p>` : ''}
            ${gift ? `<h3 style="margin-top:12px">Convenzione home24 Gift Card 12,5% (da verificare nel portale)</h3>
              <p class="small">Risparmio teorico: ${euro(gift.theoretical)}. ${gift.scenarios.map((s) => `${esc(s.label)}: carte per ${euro(s.face)} (${s.cards.map((x) => euro(x)).join(' + ')}) → esborso ${euro(s.outlay)}, credito residuo ${euro(s.leftover)}, risparmio reale ${euro(s.realSaving)}`).join('; ')}.</p>` : ''}
          </div>
          <div class="panel">
            <h2>Compatibilità con la postazione</h2>
            <dl class="kv">
              <dt>Larghezza (≤ ${ctx.constraints.maxWidthCm} cm)</dt><dd>${badge(cls(a.width.status), WIDTH_LABEL[a.width.status])} ${esc(a.width.text)}${a.width.calc ? `<div class="calc">${esc(a.width.calc)}</div>` : ''}<div class="small muted">${(c.widths || []).map((w) => `${cm(w.v)} ${esc(w.kind)} — ${esc(w.src || '')}`).join('<br>')}</div></dd>
              <dt>Braccioli (≤ ${ctx.constraints.maxArmHeightCm} cm da terra)</dt><dd>${badge(cls(a.arms.status), ARMS_LABEL[a.arms.status])} ${esc(a.arms.text)}${a.arms.calc ? `<div class="calc">Calcolo: ${esc(a.arms.calc)}</div>` : ''}${c.arms?.src ? `<div class="small muted">Fonte: ${esc(c.arms.src)}</div>` : ''}</dd>
              <dt>Spazio di 90 cm</dt><dd>Con la sedia ${insert} cm sotto il piano: spazio residuo dietro ${cm(L.residual)} ${L.standUpOk ? badge('ok', 'sufficiente per alzarsi (ipotesi 25 cm)') : badge('warn', 'stretto per alzarsi')}<div class="small muted">Profondità usata: ${cm(g.depth)}${c.depth?.v ? '' : ' (indicativa)'}. Verifica geometrica indicativa, non di comfort: regola i parametri nella stanza 3D.</div></dd>
            </dl>
          </div>
        </div>

        <div class="two" style="margin-top:14px">
          <div class="panel">
            <h2>Caratteristiche documentate</h2>
            <dl class="kv">
              <dt>Ingombro (P × A)</dt><dd>${c.depth?.v ? cm(c.depth.v) : '—'} × ${range(c.height)}</dd>
              <dt>Altezza seduta</dt><dd>${range(c.seatHeight)}${c.seatHeight?.note ? `<div class="small muted">${esc(c.seatHeight.note)}</div>` : ''}</dd>
              <dt>Seduta (L × P)</dt><dd>${c.seat?.w ? cm(c.seat.w) : '—'} × ${c.seat?.d ? cm(c.seat.d) : '—'}</dd>
              <dt>Schienale (L × A)</dt><dd>${c.back?.w ? cm(c.back.w) : '—'} × ${c.back?.h ? cm(c.back.h) : '—'}</dd>
              <dt>Braccioli</dt><dd>${armsTxt}</dd>
              <dt>Supporto lombare</dt><dd>${esc(c.lumbar || 'non dichiarato')}</dd>
              <dt>Poggiatesta</dt><dd>${esc(c.headrest || 'non dichiarato')}</dd>
              <dt>Inclinazione</dt><dd>${esc(TILT[c.tilt?.kind] || 'non dichiarata')}${c.tilt?.range ? ` · ${esc(c.tilt.range)}` : ''}</dd>
              ${c.special ? `<dt>Particolarità</dt><dd>${esc(c.special)}</dd>` : ''}
              <dt>Materiali</dt><dd>${esc(c.materials || '—')}</dd>
              <dt>Portata dichiarata</dt><dd>${c.maxLoad?.v ? `${c.maxLoad.v} kg` : '—'}${c.maxLoad?.note ? `<div class="small muted">${esc(c.maxLoad.note)}</div>` : ''}</dd>
              ${c.certifications ? `<dt>Certificazioni</dt><dd>${esc(c.certifications)}</dd>` : ''}
            </dl>
            <p class="small muted">Nessun beneficio ergonomico o sanitario è dedotto dalle descrizioni commerciali: qui sono riportate solo le regolazioni dichiarate.</p>
          </div>
          <div class="panel">
            <h2>Recensioni</h2>
            ${c.rating ? `<p><strong>★ ${String(c.rating.v).replace('.', ',')}</strong> su ${int(c.rating.n)} valutazioni · ${esc(c.rating.platform)}${e.score.bayes ? ` · media ponderata ${String(e.score.bayes).replace('.', ',')}` : ''}</p>${c.rating.dist ? `<p class="small muted">${esc(c.rating.dist)}</p>` : ''}` : '<p class="muted">Nessuna recensione rilevata.</p>'}
            ${c.pros?.length ? `<h3>Punti apprezzati</h3><ul class="tight">${c.pros.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
            ${c.cons?.length ? `<h3>Criticità ricorrenti</h3><ul class="tight">${c.cons.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
            <p class="small muted">Per Amazon: riepilogo «I clienti dicono» generato dal negozio e conteggi di menzioni positive/negative per aspetto. Il totale delle valutazioni può includere altre varianti di colore della stessa inserzione.</p>
            <h3>Punteggio editoriale: ${String(e.score.value).replace('.', ',')}/100</h3>
            <ul class="tight small">${Object.entries(e.score.parts).map(([k, v]) => `<li>${esc(WEIGHT_LABELS[k])}: ${Math.round(v * 100)}%</li>`).join('')}</ul>
          </div>
        </div>

        <div class="panel" style="margin-top:14px">
          <h2>Dati mancanti, contraddittori o da confermare</h2>
          ${(c.issues || []).length || g.flags.length ? `<ul class="tight">${(c.issues || []).map((i) => `<li>${esc(i)}</li>`).join('')}${g.flags.map((f) => `<li class="muted">Modello 3D: ${esc(f)}</li>`).join('')}</ul>` : '<p class="muted">Nessuna discrepanza registrata.</p>'}
          <h3>Fonti</h3>
          <ul class="tight">${c.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a></li>`).join('')}</ul>
        </div>
      </div>
    </div>`;

  wireImageFallbacks(root);
  root.querySelector('#cmp').addEventListener('click', () => {
    if (!toggleIn('compare', c.id, 4)) toast('Massimo 4 sedie in confronto.');
    render(root, ctx, [id]);
    ctx.updateCounts();
  });
  root.querySelector('#fav').addEventListener('click', () => { toggleIn('favorites', c.id); render(root, ctx, [id]); });
}
