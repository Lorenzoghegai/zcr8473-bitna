import { esc, badge } from '@app/js/ui/dom.js';
import { euro } from '@app/js/logic/format.js';
import { giftCardOutlay } from '@app/js/logic/giftcard.js';

const ST = {
  'da-verificare': ['da-verificare', 'Da verificare nel portale'],
  'non-utile': ['esclusa', 'Non utile'],
  'non-pertinente': ['neutral', 'Non pertinente'],
};
const PS = { verificato: 'ok', pubblicizzato: 'warn', 'non-verificato': 'warn', 'non-applicabile': 'bad' };

function giftTable(total, gc) {
  const r = giftCardOutlay(total, gc);
  return `<p class="small">Totale da pagare: <strong>${euro(total)}</strong> · risparmio teorico al 12,5%: ${euro(r.theoretical)}</p>
    <table class="compare" style="min-width:0"><thead><tr><th>Scenario</th><td><strong>Carte</strong></td><td><strong>Esborso</strong></td><td><strong>Credito residuo</strong></td><td><strong>Risparmio reale</strong></td></tr></thead>
    <tbody>${r.scenarios.map((s) => `<tr><th>${esc(s.label)}</th><td>${s.cards.map(euro).join(' + ')}</td><td>${euro(s.outlay)}</td><td>${euro(s.leftover)}</td><td>${euro(s.realSaving)}<div class="small muted">${euro(s.fullSaving)} se usi il residuo</div></td></tr>`).join('')}</tbody></table>
    <p class="small muted">Sul sito home24 le carte di uno stesso ordine devono avere lo stesso valore: combinazioni di tagli diversi richiedono ordini separati. Le regole del portale aziendale vanno verificate.</p>`;
}

export function render(root, ctx) {
  const conv = ctx.data.conventions;
  const gc = conv.items.find((i) => i.id === 'home24-giftcard').giftCard;
  const h24 = ctx.evaluated.filter((e) => e.chair.convention === 'home24' && e.assess.status !== 'esclusa');
  root.innerHTML = `
    <div class="prose">
      <h1>Convenzioni aziendali e promozioni</h1>
      <p class="muted">Lo screenshot del portale è un punto di partenza: le condizioni sono state verificate solo dove pubblicamente accessibili. Nessuna convenzione è stata applicata ai totali del catalogo. Non vengono richieste né mostrate credenziali o codici riservati.</p>
      ${conv.items.map((i) => `<div class="panel">
        <div class="btn-row">${badge(...(ST[i.status] || ['neutral', i.status]))}<span class="badge neutral">Portale: ${esc(i.portalValue)}</span></div>
        <h2 style="margin-top:8px">${esc(i.name)}</h2>
        <p>${esc(i.summary)}</p>
        ${i.verifiedFacts ? `<h3>Condizioni verificate sui siti pubblici</h3><ul class="tight small">${i.verifiedFacts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
        ${i.userMustCheck ? `<h3>Da verificare tu nel portale</h3><ul class="tight small">${i.userMustCheck.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
        ${i.sources ? `<p class="small">${i.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.label)}</a>`).join(' · ')}</p>` : ''}
        ${i.id === 'home24-giftcard' ? `<h3>Calcolatore esborso reale</h3>
          <label class="small">Sedia home24 <select id="gcsel">${h24.map((e) => `<option value="${e.assess.budget.total}">${esc(e.chair.model)} — ${euro(e.assess.budget.total)} (spedizione inclusa)</option>`).join('')}<option value="custom">Altro importo…</option></select></label>
          <input type="number" id="gcamt" min="5" max="250" step="0.01" placeholder="Importo €" style="display:none;margin-left:6px;padding:6px;border:1px solid var(--line);border-radius:6px">
          <div id="gcout"></div>` : ''}
      </div>`).join('')}
      <div class="panel">
        <h2>Promozioni pubbliche rilevate</h2>
        <ul class="tight">${conv.publicPromos.map((p) => `<li>${badge(PS[p.status] || 'neutral', p.status)} <strong>${esc(p.store)}</strong>: ${esc(p.label)}<div class="small muted">${esc(p.note)}</div></li>`).join('')}</ul>
      </div>
    </div>`;

  const sel = root.querySelector('#gcsel');
  const amt = root.querySelector('#gcamt');
  const out = root.querySelector('#gcout');
  const update = () => {
    const v = sel.value === 'custom' ? parseFloat(amt.value) : parseFloat(sel.value);
    amt.style.display = sel.value === 'custom' ? 'inline-block' : 'none';
    out.innerHTML = Number.isFinite(v) && v >= 5 && v <= 250 ? giftTable(v, gc) : '<p class="small muted">Inserisci un importo tra 5 e 250 €.</p>';
  };
  if (sel) { sel.addEventListener('change', update); amt.addEventListener('input', update); update(); }
}
