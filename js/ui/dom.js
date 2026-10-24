import { state } from '@app/js/state.js';

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => MAP[c]);

// Immagine del negozio caricata dal suo indirizzo originale; se non disponibile
// (o se l'utente disattiva le immagini esterne) viene mostrato un segnaposto dichiarato.
export function productImage(chair, cls = '') {
  const ph = `<div class="placeholder-img ${cls}" role="img" aria-label="Immagine non disponibile"><span>Immagine non disponibile</span><span>vedi la scheda del negozio</span></div>`;
  if (!state.showImages || !chair.image) return ph;
  return `<img class="${cls}" src="${esc(chair.image)}" alt="${esc(chair.brand)} ${esc(chair.model)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-ph="1">`;
}

// Sostituisce le immagini che non si caricano con il segnaposto.
export function wireImageFallbacks(root) {
  root.querySelectorAll('img[data-ph]').forEach((img) => {
    const swap = () => {
      const div = document.createElement('div');
      div.className = `placeholder-img ${img.className}`;
      div.setAttribute('role', 'img');
      div.innerHTML = '<span>Immagine non caricata</span><span>vedi la scheda del negozio</span>';
      img.replaceWith(div);
    };
    if (img.complete && img.naturalWidth === 0) swap();
    else img.addEventListener('error', swap, { once: true });
  });
}

export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1d2430;color:#fff;padding:10px 14px;border-radius:10px;z-index:100;max-width:90vw;font-size:.9rem;box-shadow:0 4px 16px rgba(0,0,0,.25)';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 3200);
}

export function badge(status, label) {
  return `<span class="badge ${esc(status)}">${esc(label)}</span>`;
}
