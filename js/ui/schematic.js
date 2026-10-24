// Schema 2D degli ingombri (alternativa al 3D): vista dall'alto e laterale,
// generate dalla stessa funzione layout() usata per le verifiche.

const f1 = (n) => Math.round(n * 10) / 10;
const RED = '#d64532';
const INK = '#1d2430';
const ACC = '#0f6e6a';

export function schematicSVG(g, room, pose, L) {
  const fail = new Set(L.checks.filter((c) => !c.ok).map((c) => c.id));
  const W = room.tableWidth;
  const rot = (x, z) => {
    const a = pose.rotDeg * Math.PI / 180;
    const c = Math.cos(a); const s = Math.sin(a);
    return [L.cx + x * c + z * s, L.cz - x * s + z * c];
  };
  const poly = (pts, attrs) => `<polygon points="${pts.map((p) => p.map(f1).join(',')).join(' ')}" ${attrs}/>`;
  const rectPts = (x0, z0, x1, z1) => [rot(x0, z0), rot(x1, z0), rot(x1, z1), rot(x0, z1)];

  // Vista dall'alto: x orizzontale, z verso il basso (muro in basso).
  const zTop = L.edgeZ - 55;
  const zBot = L.wallZ + 25;
  const xL = L.sideWallX - 10;
  const xR = W / 2 + 80;
  const top = [];
  top.push(`<rect x="${-W / 2}" y="${zTop}" width="${W}" height="${L.edgeZ - zTop}" fill="#0b0c0e" fill-opacity=".12" stroke="${INK}" stroke-width=".6"/>`);
  for (const l of L.legs) top.push(`<rect x="${l.x0}" y="${l.z0}" width="${l.x1 - l.x0}" height="${l.z1 - l.z0}" fill="${INK}"/>`);
  if (room.tableShift > 0) top.push(`<rect x="${-W / 2}" y="${zTop}" width="${W}" height="${-zTop}" fill="none" stroke="#888" stroke-dasharray="2 2" stroke-width=".5"/>`);
  top.push(`<line x1="${xL}" y1="${L.wallZ}" x2="${xR}" y2="${L.wallZ}" stroke="${INK}" stroke-width="2"/><text x="${xR - 2}" y="${L.wallZ + 6}" font-size="7" text-anchor="end">muro / penisola</text>`);
  top.push(`<line x1="${L.sideWallX}" y1="${zTop}" x2="${L.sideWallX}" y2="${zBot}" stroke="${INK}" stroke-width="2"/>`);
  for (const c of L.casters) {
    top.push(`<line x1="${f1(L.cx)}" y1="${f1(L.cz)}" x2="${f1(c.x)}" y2="${f1(c.z)}" stroke="${fail.has('base-legs') ? RED : '#555'}" stroke-width="2"/>`);
    top.push(`<circle cx="${f1(c.x)}" cy="${f1(c.z)}" r="2.5" fill="${fail.has('base-legs') ? RED : '#333'}"/>`);
  }
  top.push(poly(rectPts(-g.seatW / 2, -g.seatD / 2, g.seatW / 2, g.seatD / 2), `fill="${ACC}" fill-opacity=".25" stroke="${fail.has('seat-apron') ? RED : ACC}" stroke-width=".8"`));
  top.push(poly(rectPts(-g.backW / 2, g.seatD / 2, g.backW / 2, g.seatD / 2 + 4), `fill="${fail.has('wall') ? RED : '#444'}"`));
  if (g.hasArms && !pose.armsUp) {
    const armBad = fail.has('arms-apron') || fail.has('arms-legs');
    for (const sx of [-1, 1]) {
      const x = sx * (g.armOuter / 2 - 3);
      top.push(poly(rectPts(x - 3, -g.seatD / 2 + 6, x + 3, -g.seatD / 2 + 32), `fill="${armBad ? RED : '#222'}"`));
    }
  }
  const dx = W / 2 + 20;
  top.push(`<line x1="${dx}" y1="${L.edgeZ}" x2="${dx}" y2="${L.wallZ}" stroke="${ACC}" stroke-width=".6" marker-start="url(#a)" marker-end="url(#a)"/><text x="${dx + 2}" y="${(L.edgeZ + L.wallZ) / 2}" font-size="7" fill="${ACC}">${f1(L.wallZ - L.edgeZ)} cm</text>`);
  top.push(`<line x1="${dx + 12}" y1="${f1(L.rearZ)}" x2="${dx + 12}" y2="${L.wallZ}" stroke="${L.residual >= 0 ? '#1e6b3a' : RED}" stroke-width=".6"/><text x="${dx + 14}" y="${f1((L.rearZ + L.wallZ) / 2)}" font-size="7" fill="${L.residual >= 0 ? '#1e6b3a' : RED}">residuo ${f1(L.residual)}</text>`);
  top.push(`<text x="0" y="${zTop + 6}" font-size="7" text-anchor="middle" fill="${INK}">tavolo (luce gambe ${room.legClear} cm)</text>`);

  // Vista laterale: z orizzontale, y verso l'alto (invertito).
  const sy = (y) => 140 - y;
  const side = [];
  const zl = L.edgeZ - 55;
  side.push(`<rect x="${zl}" y="${sy(room.tableHeight)}" width="${L.edgeZ - zl}" height="${room.tableHeight - room.apronBottom}" fill="#0b0c0e" fill-opacity=".85"/>`);
  side.push(`<rect x="${L.edgeZ - room.legSize}" y="${sy(room.apronBottom)}" width="${room.legSize}" height="${room.apronBottom}" fill="${INK}" fill-opacity=".5"/>`);
  side.push(`<line x1="${L.edgeZ}" y1="${sy(room.apronBottom)}" x2="${L.wallZ}" y2="${sy(room.apronBottom)}" stroke="${ACC}" stroke-dasharray="2 2" stroke-width=".5"/><text x="${L.edgeZ + 2}" y="${sy(room.apronBottom) - 2}" font-size="7" fill="${ACC}">luce sotto il piano ${room.apronBottom} cm</text>`);
  side.push(`<rect x="${L.wallZ}" y="${sy(room.peninsulaHeight)}" width="20" height="${room.peninsulaHeight}" fill="#ddd" stroke="${INK}" stroke-width=".6"/>`);
  side.push(`<line x1="${zl}" y1="${sy(0)}" x2="${L.wallZ + 20}" y2="${sy(0)}" stroke="${INK}" stroke-width=".8"/>`);
  const R = g.baseD / 2;
  side.push(`<line x1="${f1(L.cz - R)}" y1="${sy(6)}" x2="${f1(L.cz + R)}" y2="${sy(6)}" stroke="${fail.has('base-legs') ? RED : '#333'}" stroke-width="3"/>`);
  side.push(`<line x1="${f1(L.cz)}" y1="${sy(6)}" x2="${f1(L.cz)}" y2="${sy(pose.seatH - 6)}" stroke="#777" stroke-width="3"/>`);
  side.push(`<rect x="${f1(L.cz - g.seatD / 2)}" y="${sy(pose.seatH)}" width="${g.seatD}" height="6" fill="${fail.has('seat-apron') ? RED : ACC}" fill-opacity=".6"/>`);
  const bz = L.cz + g.seatD / 2;
  const by = pose.seatH + 2;
  const ang = pose.recline ? g.reclineDeg * Math.PI / 180 : 0;
  side.push(`<line x1="${f1(bz)}" y1="${sy(by)}" x2="${f1(bz + Math.sin(ang) * g.backH)}" y2="${sy(by + Math.cos(ang) * g.backH)}" stroke="${fail.has('wall') ? RED : '#333'}" stroke-width="4"/>`);
  if (g.hasArms && L.armTop != null) {
    const armBad = fail.has('arms-apron');
    if (pose.armsUp) side.push(`<line x1="${f1(bz - 3)}" y1="${sy(L.armTop - 4)}" x2="${f1(bz - 3)}" y2="${sy(L.armTop + 22)}" stroke="#222" stroke-width="3"/>`);
    else side.push(`<line x1="${f1(L.armFrontZ)}" y1="${sy(L.armTop)}" x2="${f1(L.armBackZ)}" y2="${sy(L.armTop)}" stroke="${armBad ? RED : '#222'}" stroke-width="3"/><text x="${f1(L.armFrontZ)}" y="${sy(L.armTop) - 3}" font-size="7" fill="${armBad ? RED : INK}">braccioli ${f1(L.armTop)} cm</text>`);
  }

  const vbTop = `${xL} ${zTop} ${xR - xL} ${zBot - zTop}`;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;height:100%;padding:10px;overflow:auto;align-content:start">
    <figure style="margin:0"><figcaption class="small muted">Vista dall'alto (cm)</figcaption>
      <svg class="schema" viewBox="${vbTop}" role="img" aria-label="Schema dall'alto della postazione"><defs><marker id="a" viewBox="0 0 4 4" refX="2" refY="2" markerWidth="4" markerHeight="4"><circle cx="2" cy="2" r="1.2" fill="${ACC}"/></marker></defs>${top.join('')}</svg></figure>
    <figure style="margin:0"><figcaption class="small muted">Vista laterale (cm)</figcaption>
      <svg class="schema" viewBox="${zl} 0 ${L.wallZ + 25 - zl} 145" role="img" aria-label="Schema laterale della postazione">${side.join('')}</svg></figure>
  </div>`;
}
