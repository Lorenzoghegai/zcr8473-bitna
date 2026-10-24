// Stato dell'interfaccia salvato solo in locale (localStorage del browser).
import { DEFAULT_WEIGHTS } from '@app/js/logic/score.js';

// La pagina dei test usa una chiave propria per non toccare le impostazioni salvate.
const KEY = globalThis.__SEDIE_STATE_KEY__ || 'sedie120:v1';

const defaults = () => ({
  weights: { ...DEFAULT_WEIGHTS },
  favorites: [],
  compare: [],
  showImages: true,
  filters: null,
  sort: 'score',
  roomParams: {},
  room: { chairId: null, pose: null, view: 'persp', mode: 'model', ghost: true },
});

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const parsed = JSON.parse(raw);
    return { ...defaults(), ...parsed, room: { ...defaults().room, ...(parsed.room || {}) } };
  } catch {
    return defaults();
  }
}

export const state = read();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* archiviazione non disponibile */ }
}

export function resetState(part) {
  const d = defaults();
  if (part) state[part] = d[part]; else Object.assign(state, d);
  save();
}

export function toggleIn(listName, id, max) {
  const list = state[listName];
  const i = list.indexOf(id);
  if (i >= 0) list.splice(i, 1);
  else {
    if (max && list.length >= max) return false;
    list.push(id);
  }
  save();
  return true;
}
