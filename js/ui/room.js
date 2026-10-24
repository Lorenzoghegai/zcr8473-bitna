import { state, save } from '@app/js/state.js';
import { esc, badge, toast } from '@app/js/ui/dom.js';
import { euro, cm, STATUS_LABEL, DIM_LABEL } from '@app/js/logic/format.js';
import { resolveChairGeometry, roomFromParams, layout, defaultPose, starSpanAt } from '@app/js/logic/geometry.js';
import { schematicSVG } from '@app/js/ui/schematic.js';

let scene = null;
let sceneFailed = false;
let creating = null;
let generation = 0;

export function cleanup() {
  generation += 1;
  creating = null;
  if (scene) { scene.dispose(); scene = null; }
}

const STATUS_ORDER = ['idonea', 'da-verificare', 'esclusa'];
const VIEWS = [['persp', 'Prospettiva'], ['top', 'Dall\'alto'], ['side', 'Laterale'], ['schema', 'Schema 2D']];

function roomParams(ctx) {
  const base = ctx.data.room.params;
  const merged = {};
  for (const [k, p] of Object.entries(base)) merged[k] = { ...p, v: state.roomParams[k] ?? p.v };
  return merged;
}

export function render(root, ctx, [paramId]) {
  cleanup();
  const startId = (paramId && ctx.byId.has(paramId) && paramId) || (ctx.byId.has(state.room.chairId) && state.room.chairId) || ctx.picks.bestOverall?.chair.id || ctx.evaluated[0].chair.id;
  if (state.room.chairId !== startId && state.room.pose) {
    delete state.room.pose.seatH;
    state.room.pose.armsUp = false;
    state.room.pose.recline = false;
  }
  state.room.chairId = startId;
  const groups = STATUS_ORDER.map((s) => [s, ctx.evaluated.filter((e) => e.assess.status === s).sort((a, b) => b.score.value - a.score.value)]);

  root.innerHTML = `
    <div class="toolbar">
      <div><h1>Stanza 3D</h1><p class="muted small" style="margin:0">Ricostruzione parametrica della postazione: le misure fornite (90 cm, 69 cm, 69 cm) sono fisse, le altre sono stime modificabili. Trascina la sedia o usa i comandi.</p></div>
      <label class="small chairpick">Sedia selezionata
        <select id="chairSel">${groups.map(([s, list]) => `<optgroup label="${esc(STATUS_LABEL[s])} (${list.length})">${list.map((e) => `<option value="${esc(e.chair.id)}" ${e.chair.id === startId ? 'selected' : ''}>${esc(e.chair.brand)} ${esc(e.chair.model)} — ${e.assess.budget.total != null ? euro(e.assess.budget.total) : euro(e.chair.price)}</option>`).join('')}</optgroup>`).join('')}</select>
      </label>
    </div>
    <div class="room">
      <div>
        <div class="btn-row viewbar" role="toolbar" aria-label="Vista">${VIEWS.map(([v, l]) => `<button class="btn ${state.room.view === v ? 'on' : ''}" data-view="${v}">${l}</button>`).join('')}
          <button class="btn ${state.room.mode === 'box' ? 'on' : ''}" id="modeBtn" title="Alterna ricostruzione e semplice ingombro">${state.room.mode === 'box' ? 'Mostra: ingombro' : 'Mostra: modello'}</button></div>
        <div class="viewer" id="viewer">
          <div id="canvas" style="position:absolute;inset:0"></div>
        </div>
        <p class="small muted" id="note" style="margin:6px 2px 0"></p>
        <div class="panel" id="results" style="margin-top:12px"></div>
      </div>
      <aside class="panel controls" id="controls"></aside>
    </div>`;

  const canvas = root.querySelector('#canvas');
  const note = root.querySelector('#note');
  const getEntry = () => ctx.byId.get(state.room.chairId);

  function currentPose(g) {
    const saved = state.room.pose || {};
    const p = { ...defaultPose(g), frontZ: -(roomParams(ctx).insertUnderTableCm.v), ...saved };
    p.seatH = Math.min(g.seatMax, Math.max(g.seatMin, saved.seatH ?? g.seatMin));
    if (!g.armFlip) p.armsUp = false;
    return p;
  }

  function compute() {
    const e = getEntry();
    const g = resolveChairGeometry(e.chair);
    const params = roomParams(ctx);
    const r = roomFromParams(params);
    const pose = currentPose(g);
    const L = layout(g, r, pose);
    const L0 = r.tableShift > 0 ? layout(g, { ...r, tableShift: 0 }, pose) : null;
    return { e, g, r, pose, L, L0, params };
  }

  function draw() {
    const m = compute();
    const { e, g, r, pose, L } = m;
    const view = state.room.view;
    if (view === 'schema' || sceneFailed) {
      if (scene) cleanup();
      canvas.innerHTML = schematicSVG(g, r, pose, L);
    } else {
      if (!scene) {
        if (creating) return renderResults(m);
        canvas.innerHTML = '';
        const gen = generation;
        creating = import('@app/js/three/scene3d.js').then((mod) => {
          if (gen !== generation) return;
          if (!mod.webglAvailable()) throw new Error('WebGL non disponibile');
          scene = mod.createScene(canvas, { onDrag: (patch) => { state.room.pose = { ...currentPose(resolveChairGeometry(getEntry().chair)), ...patch }; save(); syncControls(); draw(); } });
          scene.setView(state.room.view === 'schema' ? 'persp' : state.room.view);
          creating = null;
          draw();
        }).catch((err) => {
          if (gen !== generation) return;
          creating = null;
          sceneFailed = true;
          draw();
          note.textContent = `3D non disponibile (${err.message}): viene mostrato lo schema 2D degli ingombri.`;
        });
      } else {
        scene.update({ room: r, g, pose, L, mode: state.room.mode, ghost: state.room.ghost });
      }
    }
    const kind = state.room.mode === 'box' ? 'Solo ingombro dimensionale' : 'Ricostruzione approssimata, non è il modello reale del prodotto';
    note.innerHTML = `${esc(kind)} · ${g.flags.length ? `<strong>${g.flags.length} valori indicativi</strong> (dati mancanti)` : 'misure principali documentate'} · verifiche geometriche, non di comfort.`;
    renderResults(m);
    window.__room = { chairId: e.chair.id, checks: L.checks, residual: L.residual, pose, flags: g.flags };
  }

  function renderResults({ e, g, r, pose, L, L0 }) {
    const a = e.assess;
    const thigh = r.apronBottom - pose.seatH;
    root.querySelector('#results').innerHTML = `
      <div class="btn-row">${badge(a.status, STATUS_LABEL[a.status])}${badge(a.dims, DIM_LABEL[a.dims])}<a class="btn" href="#/sedia/${encodeURIComponent(e.chair.id)}">Scheda prodotto</a></div>
      <h2 style="margin-top:10px">Verifiche geometriche ${L.interference ? badge('bad', 'interferenze') : badge('ok', 'nessuna interferenza')}</h2>
      <ul class="checks">${L.checks.map((c) => `<li class="${c.ok ? (c.warn ? 'warn' : 'ok') : 'ko'}"><strong>${c.ok ? '✓' : '✗'} ${esc(c.label)}</strong><div class="small">${esc(c.detail)}</div></li>`).join('')}</ul>
      <div class="two">
        <div><h3>Spazio di 90 cm</h3><ul class="tight small">
          <li>Spazio tra bordo tavolo e muro: <strong>${cm(L.wallZ - L.edgeZ)}</strong>${r.tableShift ? ` (90 + ${cm(r.tableShift)} di spostamento)` : ''}</li>
          <li>Residuo dietro la sedia in questa posizione: <strong>${cm(L.residual)}</strong> ${L.standUpOk ? badge('ok', `≥ ${r.standUp} cm per alzarsi`) : badge('warn', `< ${r.standUp} cm ipotizzati per alzarsi`)}</li>
          ${L.reclineBack ? `<li>Con schienale reclinato la sommità arretra di ${cm(L.reclineBack)}</li>` : ''}
          ${L0 ? `<li>Confronto: con il tavolo nella posizione attuale il residuo sarebbe ${cm(L0.residual)} (${L0.interference ? 'con' : 'senza'} interferenze)</li>` : ''}
          <li>Spazio verticale tra seduta e telaio: ${cm(thigh)} (dato geometrico)</li>
        </ul></div>
        <div><h3>Dati usati per la sedia</h3><ul class="tight small">
          <li>Base Φ ${cm(g.baseD)} → ingombro in questa rotazione ${cm(starSpanAt(g.baseD, pose.baseRotDeg + pose.rotDeg))}</li>
          <li>Seduta ${cm(g.seatW)} × ${cm(g.seatD)}, altezza ${cm(pose.seatH)} (intervallo ${cm(g.seatMin)}–${cm(g.seatMax)})</li>
          ${g.hasArms ? `<li>Braccioli ${esc(g.armType)}: larghezza ${cm(g.armOuter)}, altezza ${L.armTop != null ? cm(L.armTop) : '—'}</li>` : '<li>Senza braccioli</li>'}
          <li>Profondità ${cm(g.depth)}, altezza max ${cm(g.heightMax)}</li>
          ${g.flags.map((f) => `<li class="muted">Indicativo: ${esc(f)}</li>`).join('')}
        </ul></div>
      </div>`;
  }

  const controls = root.querySelector('#controls');
  function syncControls() {
    const { g, pose, params } = compute();
    const rangeRow = (id, label, min, max, step, val, fmt) => `<div class="row"><label for="${id}">${label}</label><output id="${id}-o">${fmt(val)}</output><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
    const sign = (v) => `${v > 0 ? '+' : ''}${String(v).replace('.', ',')} cm`;
    controls.innerHTML = `
      <h2>Sedia</h2>
      ${rangeRow('frontZ', 'Fronte sedia rispetto al bordo del tavolo', -45, 70, 1, pose.frontZ, (v) => `${sign(v)}${v < 0 ? ' (sotto)' : ''}`)}
      ${rangeRow('offsetX', 'Spostamento laterale', -25, 25, 1, pose.offsetX, sign)}
      ${rangeRow('rotDeg', 'Rotazione sedia', -45, 45, 1, pose.rotDeg, (v) => `${v}°`)}
      ${rangeRow('baseRotDeg', 'Rotazione della base a stella', 0, 71, 1, pose.baseRotDeg, (v) => `${v}°`)}
      ${rangeRow('seatH', 'Altezza seduta', g.seatMin, g.seatMax, 0.5, pose.seatH, (v) => cm(+v))}
      <label><input type="checkbox" id="armsUp" ${pose.armsUp ? 'checked' : ''} ${g.armFlip ? '' : 'disabled'}> Braccioli sollevati ${g.armFlip ? '' : '<span class="muted small">(non ribaltabili)</span>'}</label>
      <label><input type="checkbox" id="recline" ${pose.recline ? 'checked' : ''} ${g.reclineDeg ? '' : 'disabled'}> Schienale reclinato (${g.reclineDeg ? `${Math.round(g.reclineDeg)}°` : 'non dichiarato'})</label>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn" data-preset="work">Posizione di lavoro</button>
        <button class="btn" data-preset="stand">Per alzarsi</button>
        <button class="btn" data-preset="best">Base orientata al meglio</button>
      </div>
      <h2 style="margin-top:16px">Tavolo</h2>
      ${rangeRow('tableShift', 'Sposta il tavolo lontano dal muro', 0, 30, 1, params.tableShiftCm.v, (v) => cm(+v))}
      <label><input type="checkbox" id="ghost" ${state.room.ghost ? 'checked' : ''}> Mostra la posizione attuale del tavolo</label>
      <details style="margin-top:14px"><summary>Misure della stanza</summary>
        <p class="small muted">Etichette: <span class="tag fornito">fornito</span> da te, <span class="tag derivato">derivato</span> dai tuoi vincoli, <span class="tag stimato">stimato</span> dalle foto, <span class="tag ipotesi">ipotesi</span> di lavoro.</p>
        ${Object.entries(params).filter(([k]) => k !== 'tableShiftCm').map(([k, p]) => `<div class="param"><label for="p-${k}">${esc(p.label)} <span class="tag ${esc(p.status)}">${esc(p.status)}</span></label><input type="number" id="p-${k}" data-param="${k}" value="${p.v}" step="1" ${p.status === 'fornito' ? 'title="Misura fornita: modificala solo se è cambiata"' : ''}></div>`).join('')}
        <button class="btn" id="resetRoom">Ripristina misure</button>
      </details>
      <h2 style="margin-top:16px">Configurazione</h2>
      <p class="small muted">Sedia, posizione e misure vengono salvate automaticamente in questo browser (nessun invio esterno).</p>
      <div class="btn-row"><button class="btn" id="saveCfg">Salva ora</button><button class="btn" id="resetCfg">Ripristina posizione</button></div>`;

    const setPose = (patch) => { state.room.pose = { ...currentPose(resolveChairGeometry(getEntry().chair)), ...patch }; save(); draw(); };
    for (const id of ['frontZ', 'offsetX', 'rotDeg', 'baseRotDeg', 'seatH']) {
      const inp = controls.querySelector(`#${id}`);
      inp.addEventListener('input', () => {
        const v = +inp.value;
        controls.querySelector(`#${id}-o`).textContent = id === 'seatH' ? cm(v) : id.includes('Deg') ? `${v}°` : `${sign(v)}${id === 'frontZ' && v < 0 ? ' (sotto)' : ''}`;
        setPose({ [id]: v });
      });
    }
    controls.querySelector('#armsUp').addEventListener('change', (ev) => setPose({ armsUp: ev.target.checked }));
    controls.querySelector('#recline').addEventListener('change', (ev) => setPose({ recline: ev.target.checked }));
    controls.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
      const p = roomParams(ctx);
      if (b.dataset.preset === 'work') setPose({ frontZ: -p.insertUnderTableCm.v });
      if (b.dataset.preset === 'stand') setPose({ frontZ: -p.insertUnderTableCm.v + p.standUpClearanceCm.v });
      if (b.dataset.preset === 'best') setPose({ baseRotDeg: (18 - compute().pose.rotDeg + 720) % 72 });
      syncControls();
    }));
    const shift = controls.querySelector('#tableShift');
    shift.addEventListener('input', () => { controls.querySelector('#tableShift-o').textContent = cm(+shift.value); state.roomParams.tableShiftCm = +shift.value; save(); draw(); });
    controls.querySelector('#ghost').addEventListener('change', (ev) => { state.room.ghost = ev.target.checked; save(); draw(); });
    controls.querySelectorAll('[data-param]').forEach((inp) => inp.addEventListener('change', () => {
      const v = parseFloat(inp.value);
      if (!Number.isFinite(v) || v <= 0 || v > 400) { toast('Valore non valido'); inp.value = roomParams(ctx)[inp.dataset.param].v; return; }
      state.roomParams[inp.dataset.param] = v; save(); draw();
    }));
    controls.querySelector('#resetRoom').addEventListener('click', () => { state.roomParams = {}; save(); syncControls(); draw(); });
    controls.querySelector('#saveCfg').addEventListener('click', () => { save(); toast('Configurazione salvata in questo browser'); });
    controls.querySelector('#resetCfg').addEventListener('click', () => { state.room.pose = null; save(); syncControls(); draw(); });
  }

  root.querySelector('#chairSel').addEventListener('change', (ev) => {
    state.room.chairId = ev.target.value;
    // Nuova sedia: seduta alla minima e braccioli abbassati (configurazione per entrare sotto il piano).
    if (state.room.pose) { delete state.room.pose.seatH; state.room.pose.armsUp = false; state.room.pose.recline = false; }
    save();
    history.replaceState(null, '', `#/stanza/${encodeURIComponent(ev.target.value)}`);
    syncControls();
    draw();
  });
  root.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    state.room.view = b.dataset.view; save();
    root.querySelectorAll('[data-view]').forEach((x) => x.classList.toggle('on', x === b));
    if (scene && b.dataset.view !== 'schema') scene.setView(b.dataset.view);
    if (!scene && b.dataset.view !== 'schema') canvas.innerHTML = '';
    draw();
  }));
  root.querySelector('#modeBtn').addEventListener('click', (ev) => {
    state.room.mode = state.room.mode === 'box' ? 'model' : 'box'; save();
    ev.target.textContent = state.room.mode === 'box' ? 'Mostra: ingombro' : 'Mostra: modello';
    ev.target.classList.toggle('on', state.room.mode === 'box');
    draw();
  });

  save();
  syncControls();
  draw();
}
