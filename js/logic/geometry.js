// Geometria della postazione e della sedia (unità: centimetri).
// Funzioni pure: usate dalla scena 3D, dallo schema 2D e dai test.
//
// Sistema di riferimento della stanza:
//   x → destra stando seduti al tavolo, y → alto, z → verso il muro alle spalle.
//   Il bordo del tavolo (posizione originale) è a z = 0; il muro a z = spaceBehind.

const DEG = Math.PI / 180;
const it = (n) => n.toFixed(1).replace('.', ',');

// Una base a stella a 5 razze di diametro D occupa lateralmente tra
// D·(1+cos36°)/2 ≈ 0,905·D e D·sin72° ≈ 0,951·D, secondo l'orientamento.
export const STAR_WORST_FACTOR = Math.sin(72 * DEG);
export const STAR_BEST_FACTOR = (1 + Math.cos(36 * DEG)) / 2;

export function starSpanWorst(diameter) {
  return diameter * STAR_WORST_FACTOR;
}

// Ingombro laterale (asse x) della stella ruotata di rotDeg (0° = una razza in avanti).
export function starSpanAt(diameter, rotDeg) {
  const r = diameter / 2;
  const xs = [];
  for (let k = 0; k < 5; k++) xs.push(r * Math.sin((rotDeg + k * 72) * DEG));
  return Math.max(...xs) - Math.min(...xs);
}

const STYLE_BACK = { 'mesh-high': 68, 'mesh-mid': 50, gaming: 72, executive: 70, tub: 32, armless: 42 };

function firstNum(...vals) {
  for (const v of vals) if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

// Angolo massimo di reclinazione oltre la verticale, letto da testi come «90–105°».
export function parseRecline(tilt) {
  if (!tilt || ['nessuna', 'non-dichiarata'].includes(tilt.kind)) return 0;
  const nums = String(tilt.range || '').match(/\d+(?:[.,]\d+)?/g);
  if (nums) {
    const angles = nums.map((n) => parseFloat(n.replace(',', '.'))).filter((n) => n >= 90 && n <= 180);
    if (angles.length) return Math.max(...angles) - 90;
    const small = nums.map((n) => parseFloat(n.replace(',', '.'))).filter((n) => n > 0 && n < 45);
    if (small.length && /°/.test(tilt.range)) return Math.max(...small);
  }
  return 12;
}

// Trasforma i dati del catalogo in misure utilizzabili dal modello,
// segnalando ogni valore indicativo (non documentato).
export function resolveChairGeometry(chair) {
  const flags = [];
  const widths = chair.widths || [];
  const of = (kind) => widths.filter((w) => w.kind === kind).map((w) => w.v);
  const baseDia = firstNum(Math.max(...of('base-diametro'), -Infinity), Math.max(...of('base'), -Infinity));
  const armsW = of('braccioli').length ? Math.max(...of('braccioli')) : null;
  const ingombro = of('ingombro').length ? Math.max(...of('ingombro')) : null;
  const armType = chair.arms?.type || 'non-dichiarato';
  const hasArms = armType !== 'nessuno';

  let baseD = baseDia !== null && baseDia > 0 ? baseDia : null;
  if (baseD === null && ingombro !== null) {
    baseD = ingombro;
    flags.push('Diametro della base assunto pari all\'ingombro dichiarato');
  }
  if (baseD === null) {
    baseD = 62;
    flags.push('Base indicativa (62 cm): larghezza non documentata');
  }

  const seatW = firstNum(chair.seat?.w) ?? (flags.push('Larghezza seduta indicativa'), 48);
  const seatD = firstNum(chair.seat?.d) ?? (flags.push('Profondità seduta indicativa'), 46);
  let seatMin = firstNum(chair.seatHeight?.min);
  let seatMax = firstNum(chair.seatHeight?.max);
  if (seatMin === null && seatMax === null) {
    seatMin = 45; seatMax = 55;
    flags.push('Altezza seduta indicativa (45–55 cm)');
  } else if (seatMin === null) {
    seatMin = seatMax - 10;
    flags.push('Altezza seduta minima indicativa');
  } else if (seatMax === null) {
    seatMax = seatMin + 10;
  }

  const backH = firstNum(chair.back?.h) ?? (flags.push('Altezza schienale indicativa'), STYLE_BACK[chair.model3d] ?? 50);
  const backW = firstNum(chair.back?.w) ?? Math.max(36, seatW - 4);

  let armOuter = null;
  let armMin = null;
  if (hasArms) {
    armOuter = armsW ?? (ingombro !== null && ingombro <= seatW + 22 && ingombro > seatW ? ingombro : null);
    if (armOuter === null) {
      armOuter = seatW + 12;
      flags.push('Larghezza ai braccioli indicativa');
    }
    armMin = firstNum(chair.arms?.min, chair.arms?.single);
    if (armMin === null) {
      armMin = seatMin + 20;
      flags.push('Altezza braccioli indicativa (seduta + 20 cm)');
    }
  }

  const depth = firstNum(chair.depth?.v) ?? (flags.push('Profondità assunta pari al diametro della base'), baseD);
  const heightMax = firstNum(chair.height?.max) ?? seatMax + backH + 8;
  const headrest = /regolabile|integrato|fisso|sì|visibile/i.test(chair.headrest || '') && !/^nessuno/i.test(chair.headrest || '');

  return {
    style: chair.model3d || 'mesh-mid',
    baseD, seatW, seatD, seatMin, seatMax, backH, backW,
    armType, hasArms, armOuter, armMin,
    armFlip: armType.startsWith('ribaltabili'),
    armRise: hasArms && chair.arms?.max && chair.arms?.min ? chair.arms.max - chair.arms.min : seatMax - seatMin,
    depth, heightMax, headrest,
    reclineDeg: parseRecline(chair.tilt),
    flags,
  };
}

export function roomFromParams(params) {
  const v = (k) => params[k]?.v ?? params[k];
  const legClear = v('legClearCm');
  const legSize = v('legSizeCm');
  return {
    space: v('spaceBehindCm'),
    legClear,
    legSize,
    tableWidth: legClear + 2 * legSize,
    tableLength: v('tableLengthCm'),
    tableHeight: v('tableHeightCm'),
    apronBottom: v('apronBottomCm'),
    sideGap: v('sideWallGapCm'),
    peninsulaHeight: v('peninsulaHeightCm'),
    insertUnder: v('insertUnderTableCm'),
    standUp: v('standUpClearanceCm'),
    tableShift: v('tableShiftCm'),
  };
}

function rot2(x, z, deg) {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [x * c + z * s, -x * s + z * c];
}

function circleHitsRect(cx, cz, r, rect) {
  const nx = Math.max(rect.x0, Math.min(cx, rect.x1));
  const nz = Math.max(rect.z0, Math.min(cz, rect.z1));
  return (cx - nx) ** 2 + (cz - nz) ** 2 <= r * r;
}

// Posa di default: fronte della sedia a filo con il bordo del tavolo.
export function defaultPose(g) {
  return { offsetX: 0, frontZ: 0, rotDeg: 0, baseRotDeg: 36, seatH: g.seatMin, armsUp: false, recline: false };
}

// Calcola la disposizione della sedia nella stanza e le verifiche geometriche.
// pose.frontZ: posizione del fronte della sedia rispetto al bordo del tavolo
// (negativo = sotto il piano). Il bordo del tavolo si sposta di -tableShift.
export function layout(g, room, pose) {
  const edgeZ = -room.tableShift;
  const wallZ = room.space;
  const baseR = g.baseD / 2;
  const frontExt = Math.max(baseR, g.seatD / 2);
  const cz = edgeZ + pose.frontZ + frontExt;
  const cx = pose.offsetX;
  const seatRaise = pose.seatH - g.seatMin;
  const armTop = g.hasArms ? g.armMin + seatRaise : null;
  const reclineBack = pose.recline ? g.backH * Math.sin(g.reclineDeg * DEG) : 0;
  const rearZ = cz - frontExt + g.depth;
  const rearTopZ = rearZ + reclineBack;

  const legs = [-1, 1].flatMap((side) => {
    const x0 = side < 0 ? -room.legClear / 2 - room.legSize : room.legClear / 2;
    return [
      { name: side < 0 ? 'gamba anteriore sinistra' : 'gamba anteriore destra', x0, x1: x0 + room.legSize, z0: edgeZ - room.legSize, z1: edgeZ },
      { name: side < 0 ? 'gamba posteriore sinistra' : 'gamba posteriore destra', x0, x1: x0 + room.legSize, z0: edgeZ - room.tableLength, z1: edgeZ - room.tableLength + room.legSize },
    ];
  });

  // Rotelle: centro a (R − 2,5 cm), raggio 2,5 cm; razze campionate ogni 3 cm.
  const casters = [];
  const spokes = [];
  for (let k = 0; k < 5; k++) {
    const a = (pose.baseRotDeg + k * 72) * DEG;
    const lx = Math.sin(a);
    const lz = -Math.cos(a);
    const [wx, wz] = rot2(lx, lz, pose.rotDeg);
    casters.push({ x: cx + wx * (baseR - 2.5), z: cz + wz * (baseR - 2.5), r: 2.5 });
    for (let d = 3; d < baseR - 2.5; d += 3) spokes.push({ x: cx + wx * d, z: cz + wz * d, r: 1.5 });
  }

  const checks = [];
  const baseHits = [...casters, ...spokes].flatMap((p) => legs.filter((l) => circleHitsRect(p.x, p.z, p.r, l)).map((l) => l.name));
  checks.push({
    id: 'base-legs',
    label: 'Base con ruote tra le gambe del tavolo',
    ok: baseHits.length === 0,
    detail: baseHits.length
      ? `Interferenza con ${[...new Set(baseHits)].join(', ')}`
      : `Ingombro laterale della base in questa rotazione: ${it(starSpanAt(g.baseD, pose.baseRotDeg + pose.rotDeg))} cm su ${room.legClear} cm di luce`,
  });

  // Braccioli: imbottitura dal fronte seduta + 6 cm per 26 cm.
  const armFrontZ = cz - g.seatD / 2 + 6;
  const armBackZ = armFrontZ + 26;
  if (g.hasArms && !pose.armsUp) {
    const underTable = armFrontZ < edgeZ;
    const tooHigh = armTop > room.apronBottom;
    checks.push({
      id: 'arms-apron',
      label: 'Braccioli sotto il piano del tavolo',
      ok: !(underTable && tooHigh),
      detail: underTable
        ? `Braccioli a ${it(armTop)} cm da terra, luce sotto il piano ${room.apronBottom} cm`
        : `Braccioli fuori dal piano (fronte braccioli ${it((armFrontZ - edgeZ))} cm davanti al bordo); altezza ${it(armTop)} cm`,
      warn: !underTable && tooHigh,
    });
    const armX = g.armOuter / 2;
    const zOverlap = armFrontZ < edgeZ && armBackZ > edgeZ - room.legSize;
    const lateralHit = zOverlap && (cx + armX > room.legClear / 2 || cx - armX < -room.legClear / 2) && armTop > 0;
    checks.push({
      id: 'arms-legs',
      label: 'Braccioli tra le gambe del tavolo',
      ok: !lateralHit,
      detail: `Larghezza ai braccioli ${it(g.armOuter)} cm su ${room.legClear} cm di luce`,
    });
  } else if (g.hasArms && pose.armsUp) {
    checks.push({ id: 'arms-apron', label: 'Braccioli sotto il piano del tavolo', ok: true, detail: 'Braccioli sollevati: non entrano sotto il piano (compromesso: non utilizzabili in questa posizione)' });
  }

  const seatFrontZ = cz - g.seatD / 2;
  const seatUnder = seatFrontZ < edgeZ;
  checks.push({
    id: 'seat-apron',
    label: 'Seduta sotto il piano',
    ok: !(seatUnder && pose.seatH > room.apronBottom),
    detail: `Spazio tra seduta e telaio: ${it((room.apronBottom - pose.seatH))} cm (verifica geometrica, non di comfort)`,
  });

  checks.push({
    id: 'wall',
    label: 'Ingombro posteriore rispetto al muro',
    ok: rearTopZ <= wallZ,
    detail: `Spazio residuo dietro la sedia: ${it((wallZ - rearZ))} cm${reclineBack ? `; con schienale reclinato ${it((wallZ - rearTopZ))} cm in alto` : ''}`,
  });

  const sideWallX = -(room.tableWidth / 2 + room.sideGap);
  const leftExt = cx - Math.max(baseR, g.hasArms ? g.armOuter / 2 : g.seatW / 2);
  checks.push({
    id: 'side-wall',
    label: 'Distanza dalla parete con termosifone',
    ok: leftExt >= sideWallX,
    detail: `Margine laterale sinistro: ${it((leftExt - sideWallX))} cm (posizione della parete stimata)`,
  });

  const residual = wallZ - rearZ;
  return {
    edgeZ, wallZ, cx, cz, frontExt, armTop, armFrontZ, armBackZ, seatFrontZ, rearZ, rearTopZ, reclineBack,
    legs, casters, sideWallX, residual,
    standUpOk: residual >= room.standUp,
    checks,
    interference: checks.some((c) => !c.ok),
  };
}
