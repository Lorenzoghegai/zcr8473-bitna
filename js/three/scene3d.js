// Scena 3D parametrica (unità: cm). La stanza viene costruita una volta e
// ricostruita solo se cambiano i suoi parametri; cambiare sedia sostituisce
// soltanto il gruppo della sedia.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/CSS2DRenderer.js';

const RED = 0xd64532;
const DEG = Math.PI / 180;

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

function canvasTexture(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

const tiles = () => canvasTexture(128, 128, (g, w) => {
  g.fillStyle = '#c99a6e'; g.fillRect(0, 0, w, w);
  g.fillStyle = '#b98a5f'; g.fillRect(4, 4, w - 8, w - 8);
  g.strokeStyle = '#e8dccb'; g.lineWidth = 4; g.strokeRect(0, 0, w, w);
}, [12, 12]);

const mosaic = (dark) => canvasTexture(64, 64, (g, w) => {
  const s = 8;
  for (let y = 0; y < w; y += s) for (let x = 0; x < w; x += s) {
    g.fillStyle = dark ? ((x + y) / s % 3 === 0 ? '#2d2f33' : '#16181b') : ((x / s + y / s) % 2 ? '#111' : '#f4f4f4');
    g.fillRect(x + 1, y + 1, s - 2, s - 2);
  }
}, [4, 4]);

const lattice = () => canvasTexture(64, 64, (g, w) => {
  g.fillStyle = '#f7f7f2'; g.fillRect(0, 0, w, w);
  g.strokeStyle = '#c9c9c0'; g.lineWidth = 6;
  for (let i = 0; i <= w; i += 21) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, w); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
}, [2, 5]);

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

function label(text, cls = '') {
  const div = document.createElement('div');
  div.className = `label3d ${cls}`;
  div.textContent = text;
  return new CSS2DObject(div);
}

function dimLine(a, b, color = 0x0f6e6a) {
  const g = new THREE.BufferGeometry().setFromPoints([a, b]);
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color }));
}

function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    if (o.isCSS2DObject) o.element.remove();
  });
  group.clear();
}

export function createScene(container, { onDrag } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  const labels = new CSS2DRenderer();
  labels.domElement.style.position = 'absolute';
  labels.domElement.style.inset = '0';
  labels.domElement.style.pointerEvents = 'none';
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xeef0f2);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 1.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(120, 260, 160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 10, far: 600 });
  scene.add(sun);

  const persp = new THREE.PerspectiveCamera(45, 1, 1, 3000);
  // Vista di tre quarti dal lato destro: tavolo, sedia e muro alle spalle nello stesso colpo d'occhio.
  persp.position.set(210, 150, -70);
  const ortho = new THREE.OrthographicCamera(-100, 100, 100, -100, -1000, 3000);
  let camera = persp;
  let view = 'persp';
  const controls = new OrbitControls(persp, renderer.domElement);
  controls.target.set(0, 45, 35);
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 60; controls.maxDistance = 700;
  controls.update();

  const roomGroup = new THREE.Group();
  const chairGroup = new THREE.Group();
  const helperGroup = new THREE.Group();
  scene.add(roomGroup, chairGroup, helperGroup);
  let roomKey = '';
  let lastArgs = null;

  const matBlack = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.45, metalness: 0.2 });

  function buildRoom(r, edgeZ) {
    disposeGroup(roomGroup);
    const W = r.tableWidth;
    const wallX = -(W / 2 + r.sideGap);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: tiles(), roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(40, 0, 0); floor.receiveShadow = true;
    roomGroup.add(floor);

    // Tavolo: piano in vetro nero, telaio, gambe agli angoli.
    const glass = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.08, metalness: 0.3 });
    const zc = edgeZ - r.tableLength / 2;
    roomGroup.add(box(W, 1.2, r.tableLength, glass, 0, r.tableHeight - 0.6, zc));
    const apronH = r.tableHeight - 1.2 - r.apronBottom;
    if (apronH > 0.2) {
      roomGroup.add(box(W, apronH, 2, matBlack, 0, r.apronBottom + apronH / 2, edgeZ - 1));
      roomGroup.add(box(W, apronH, 2, matBlack, 0, r.apronBottom + apronH / 2, edgeZ - r.tableLength + 1));
      roomGroup.add(box(2, apronH, r.tableLength, matBlack, -W / 2 + 1, r.apronBottom + apronH / 2, zc));
      roomGroup.add(box(2, apronH, r.tableLength, matBlack, W / 2 - 1, r.apronBottom + apronH / 2, zc));
    }
    for (const sx of [-1, 1]) for (const zz of [edgeZ - r.legSize / 2, edgeZ - r.tableLength + r.legSize / 2]) {
      const x = sx * (r.legClear / 2 + r.legSize / 2);
      const leg = box(r.legSize, r.tableHeight - 1.2, r.legSize, matBlack, x, (r.tableHeight - 1.2) / 2, zz);
      leg.name = 'leg';
      roomGroup.add(leg);
    }

    // Penisola alle spalle (stima dalle foto), parete con termosifone a sinistra, colonna luminosa.
    const white = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.9 });
    const penW = 150;
    roomGroup.add(box(penW, r.peninsulaHeight - 4, 60, white, wallX + penW / 2, (r.peninsulaHeight - 4) / 2, r.space + 30));
    const top = mosaic(true);
    top.repeat.set(penW / 16, 64 / 16);
    roomGroup.add(box(penW + 4, 4, 64, new THREE.MeshStandardMaterial({ map: top, roughness: 0.5 }), wallX + penW / 2, r.peninsulaHeight - 2, r.space + 30));
    const pl = label('penisola alle spalle (forma stimata)'); pl.position.set(wallX + penW / 2, r.peninsulaHeight + 8, r.space + 30); helperFixed.push(pl);
    const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(r.space + r.tableLength + 160, 150), new THREE.MeshStandardMaterial({ color: 0xf7f6f1, roughness: 1, side: THREE.DoubleSide }));
    sideWall.rotation.y = Math.PI / 2;
    sideWall.position.set(wallX, 75, (r.space - r.tableLength) / 2 + 10);
    roomGroup.add(sideWall);
    const rad = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    for (let i = 0; i < 9; i++) roomGroup.add(box(7, 60, 6, rad, wallX + 5, 45, -30 - i * 8.5));
    roomGroup.add(box(24, 120, 24, new THREE.MeshStandardMaterial({ map: lattice(), roughness: 0.8 }), wallX + 14, 60, r.space - 14));

    // Quote fisse: luce tra le gambe e luce sotto il piano.
    const zLeg = edgeZ - r.legSize / 2;
    helperFixed.push(dimLine(new THREE.Vector3(-r.legClear / 2, 25, zLeg), new THREE.Vector3(r.legClear / 2, 25, zLeg)));
    const l1 = label(`luce gambe ${r.legClear} cm`); l1.position.set(0, 27, zLeg); helperFixed.push(l1);
    helperFixed.push(dimLine(new THREE.Vector3(W / 2 + 4, 0, edgeZ), new THREE.Vector3(W / 2 + 4, r.apronBottom, edgeZ)));
    const l2 = label(`sotto il piano ${r.apronBottom} cm`); l2.position.set(W / 2 + 6, r.apronBottom / 2, edgeZ); helperFixed.push(l2);
    helperFixed.forEach((o) => roomGroup.add(o));
    helperFixed.length = 0;
  }
  const helperFixed = [];

  function partMat(color, bad, opts = {}) {
    return new THREE.MeshStandardMaterial({ color: bad ? RED : color, roughness: 0.7, emissive: bad ? 0x5a0d05 : 0x000000, transparent: opts.opacity != null, opacity: opts.opacity ?? 1 });
  }

  function buildChair(g, pose, L, failing, mode) {
    disposeGroup(chairGroup);
    const root = new THREE.Group();
    root.position.set(L.cx, 0, L.cz);
    // Stessa convenzione di rot2() in geometry.js, così verifiche e disegno coincidono.
    root.rotation.y = pose.rotDeg * DEG;
    chairGroup.add(root);
    const palette = { 'mesh-mid': 0x56606f, 'mesh-high': 0x56606f, gaming: 0x3a3e47, executive: 0x3b3b40, tub: 0xb8ad9c, armless: 0x7b8088 };
    const body = palette[g.style] ?? 0x56606f;
    const R = g.baseD / 2;

    if (mode === 'box') {
      const width = Math.max(g.baseD * Math.sin(72 * DEG), g.hasArms ? g.armOuter : g.seatW);
      const h = g.heightMax - g.seatMin + pose.seatH;
      const b = new THREE.Mesh(new THREE.BoxGeometry(width, h, g.depth), new THREE.MeshStandardMaterial({ color: failing.size ? RED : 0x0f6e6a, transparent: true, opacity: 0.25 }));
      b.position.set(0, h / 2, -L.frontExt + g.depth / 2);
      root.add(b);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), new THREE.LineBasicMaterial({ color: failing.size ? RED : 0x0f6e6a }));
      edges.position.copy(b.position);
      root.add(edges);
      if (g.hasArms) {
        const armY = g.armMin + (pose.seatH - g.seatMin);
        root.add(dimLine(new THREE.Vector3(-width / 2, armY, -L.frontExt), new THREE.Vector3(width / 2, armY, -L.frontExt), failing.has('arms') ? RED : 0x0f6e6a));
      }
    }

    // Base a stella con rotelle.
    const baseBad = failing.has('base');
    const baseMat = partMat(mode === 'box' ? 0x0f6e6a : 0x22252b, baseBad, mode === 'box' ? { opacity: 0.6 } : {});
    const star = new THREE.Group();
    star.rotation.y = -pose.baseRotDeg * DEG;
    for (let k = 0; k < 5; k++) {
      const arm = new THREE.Group();
      arm.rotation.y = -k * 72 * DEG;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(4, 3, R - 2.5), baseMat);
      spoke.position.set(0, 8, -(R - 2.5) / 2);
      spoke.castShadow = true;
      arm.add(spoke);
      const caster = new THREE.Mesh(new THREE.SphereGeometry(2.5, 12, 8), baseMat);
      caster.position.set(0, 2.5, -(R - 2.5));
      arm.add(caster);
      star.add(arm);
    }
    root.add(star);
    if (mode === 'box') return;

    const seatTop = pose.seatH;
    const isTub = g.style === 'tub';
    const column = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, seatTop - 18, 16), partMat(0x8b9099, false));
    column.position.set(0, 9 + (seatTop - 18) / 2, 0);
    root.add(column);
    const seatThick = g.style === 'executive' || g.style === 'gaming' ? 10 : 7;
    const seat = box(g.seatW, seatThick, g.seatD, partMat(body, failing.has('seat')), 0, seatTop - seatThick / 2, 0);
    root.add(seat);

    // Schienale con perno sul retro della seduta (reclinazione attorno all'asse x).
    const back = new THREE.Group();
    back.position.set(0, seatTop + 2, g.seatD / 2);
    back.rotation.x = pose.recline ? -g.reclineDeg * DEG : 0;
    const backBad = failing.has('wall');
    if (isTub) {
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(g.seatW / 2 + 2, g.seatW / 2, g.backH + 14, 24, 1, true, Math.PI * 0.55, Math.PI * 0.9), partMat(body, backBad));
      shell.material.side = THREE.DoubleSide;
      shell.position.set(0, (g.backH + 14) / 2 - 12, -g.seatD / 2 + 4);
      back.add(shell);
    } else {
      const bm = partMat(body, backBad, g.style.startsWith('mesh') ? { opacity: 0.88 } : {});
      back.add(box(g.backW, g.backH, 4, bm, 0, 6 + g.backH / 2, 2));
      if (g.style === 'gaming') back.add(box(g.backW + 8, 18, 6, bm, 0, g.backH - 8, 3));
      if (g.headrest) back.add(box(Math.min(32, g.backW - 6), 14, 5, bm, 0, g.backH + 14, 2));
    }
    root.add(back);

    // Braccioli: imbottitura da fronte seduta + 6 cm per 26 cm; ribaltabili sollevati = verticali.
    if (g.hasArms && !isTub) {
      const armY = g.armMin + (pose.seatH - g.seatMin);
      const armBad = failing.has('arms');
      const am = partMat(0x2c6e8f, armBad);
      for (const sx of [-1, 1]) {
        const x = sx * (g.armOuter / 2 - 3);
        if (pose.armsUp && g.armFlip) {
          root.add(box(6, 26, 3, am, x, armY + 10, g.seatD / 2 - 4));
        } else {
          root.add(box(6, 3, 26, am, x, armY - 1.5, -g.seatD / 2 + 6 + 13));
        }
        const postH = Math.max(4, armY - 3 - seatTop + 4);
        root.add(box(3, postH, 4, am, x, seatTop - 4 + postH / 2, pose.armsUp && g.armFlip ? g.seatD / 2 - 6 : 2));
      }
      const lbl = label(`braccioli ${armY.toFixed(1).replace('.', ',')} cm`, armBad ? 'bad' : 'ok');
      lbl.position.set(g.armOuter / 2 + 6, armY + 4, -g.seatD / 2 + 10);
      root.add(lbl);
    } else if (isTub && g.hasArms) {
      const armY = g.armMin + (pose.seatH - g.seatMin);
      const lbl = label(`braccioli ${armY.toFixed(1).replace('.', ',')} cm`, failing.has('arms') ? 'bad' : 'ok');
      lbl.position.set(g.seatW / 2 + 6, armY + 4, 0);
      root.add(lbl);
    }
  }

  function buildHelpers(r, L, g) {
    disposeGroup(helperGroup);
    const W = r.tableWidth;
    const x = W / 2 + 18;
    helperGroup.add(dimLine(new THREE.Vector3(x, 1, L.edgeZ), new THREE.Vector3(x, 1, L.wallZ)));
    const l = label(`spazio ${(L.wallZ - L.edgeZ).toFixed(0)} cm`); l.position.set(x + 2, 4, (L.edgeZ + L.wallZ) / 2); helperGroup.add(l);
    const ok = L.residual >= 0;
    helperGroup.add(dimLine(new THREE.Vector3(x - 8, 2, L.rearZ), new THREE.Vector3(x - 8, 2, L.wallZ), ok ? 0x1e6b3a : RED));
    const l2 = label(`residuo ${L.residual.toFixed(1).replace('.', ',')} cm`, ok && L.standUpOk ? 'ok' : 'bad'); l2.position.set(x - 6, 12, (L.rearZ + L.wallZ) / 2); helperGroup.add(l2);
    const span = g.hasArms ? Math.max(g.armOuter, g.baseD * Math.sin(72 * DEG)) : g.baseD * Math.sin(72 * DEG);
    const lw = label(`sedia ≈ ${span.toFixed(1).replace('.', ',')} cm`); lw.position.set(L.cx, g.heightMax + 10, L.cz); helperGroup.add(lw);
    if (r.tableShift > 0 && lastArgs?.ghost) {
      const ghost = new THREE.Mesh(new THREE.BoxGeometry(W, r.tableHeight, r.tableLength), new THREE.MeshBasicMaterial({ color: 0x888888, wireframe: true, transparent: true, opacity: 0.35 }));
      ghost.position.set(0, r.tableHeight / 2, -r.tableLength / 2);
      helperGroup.add(ghost);
      const lg = label('posizione attuale del tavolo'); lg.position.set(0, r.tableHeight + 6, 0); helperGroup.add(lg);
    }
  }

  function sizeOrtho() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    const a = w / Math.max(1, h);
    if (view === 'top') {
      const span = 150;
      ortho.left = -span * a; ortho.right = span * a; ortho.top = span; ortho.bottom = -span;
      ortho.position.set(15, 600, 10); ortho.up.set(0, 0, -1); ortho.lookAt(15, 0, 10);
    } else {
      const span = 95;
      ortho.left = -span * a; ortho.right = span * a; ortho.top = span; ortho.bottom = -span;
      ortho.position.set(600, 70, 0); ortho.up.set(0, 1, 0); ortho.lookAt(0, 70, 0);
    }
    ortho.zoom = 1;
    ortho.updateProjectionMatrix();
  }

  function render() {
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }

  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    renderer.setSize(w, h);
    labels.setSize(w, h);
    persp.aspect = w / Math.max(1, h);
    persp.updateProjectionMatrix();
    if (camera === ortho) sizeOrtho();
    render();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  controls.addEventListener('change', render);

  // Trascinamento della sedia sul pavimento.
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let drag = null;
  const ndc = (ev) => {
    const r = renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  };
  renderer.domElement.addEventListener('pointerdown', (ev) => {
    ray.setFromCamera(ndc(ev), camera);
    if (!ray.intersectObject(chairGroup, true).length || !lastArgs) return;
    const hit = new THREE.Vector3();
    ray.ray.intersectPlane(plane, hit);
    drag = { start: hit.clone(), pose: { ...lastArgs.pose } };
    controls.enabled = false;
    renderer.domElement.setPointerCapture(ev.pointerId);
  });
  renderer.domElement.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    ray.setFromCamera(ndc(ev), camera);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return;
    onDrag?.({ offsetX: Math.round(drag.pose.offsetX + hit.x - drag.start.x), frontZ: Math.round(drag.pose.frontZ + hit.z - drag.start.z) });
  });
  const endDrag = () => { drag = null; controls.enabled = true; };
  renderer.domElement.addEventListener('pointerup', endDrag);
  renderer.domElement.addEventListener('pointercancel', endDrag);

  return {
    update(args) {
      lastArgs = args;
      const { room: r, g, pose, L, mode } = args;
      const key = JSON.stringify(r);
      if (key !== roomKey) { buildRoom(r, L.edgeZ); roomKey = key; }
      const failing = new Set();
      for (const c of L.checks) if (!c.ok) {
        if (c.id === 'base-legs') failing.add('base');
        if (c.id.startsWith('arms')) failing.add('arms');
        if (c.id === 'seat-apron') failing.add('seat');
        if (c.id === 'wall') failing.add('wall');
        if (c.id === 'side-wall') { failing.add('base'); failing.add('arms'); }
      }
      buildChair(g, pose, L, failing, mode);
      buildHelpers(r, L, g);
      render();
    },
    setView(v) {
      view = v;
      if (v === 'persp') { camera = persp; controls.object = persp; controls.enableRotate = true; }
      else { camera = ortho; controls.object = ortho; controls.enableRotate = false; sizeOrtho(); }
      if (v === 'persp') { persp.position.set(210, 150, -70); persp.up.set(0, 1, 0); }
      controls.target.set(v === 'top' ? 15 : 0, v === 'top' ? 0 : v === 'side' ? 70 : 45, v === 'top' ? 10 : v === 'side' ? 0 : 35);
      controls.update();
      render();
    },
    snapshot() { render(); return renderer.domElement.toDataURL('image/png'); },
    dispose() {
      ro.disconnect();
      controls.dispose();
      disposeGroup(roomGroup); disposeGroup(chairGroup); disposeGroup(helperGroup);
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
}
