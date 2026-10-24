// Esportazione CSV pensata per Excel in italiano: separatore «;», virgola
// decimale e BOM UTF-8 (altrimenti le lettere accentate si rovinano).

const cell = (v) => {
  if (v == null) return '';
  const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(columns, rows) {
  const lines = [columns.map((c) => cell(c.label)).join(';')];
  for (const r of rows) lines.push(columns.map((c) => cell(c.get(r))).join(';'));
  return `﻿${lines.join('\r\n')}\r\n`;
}
