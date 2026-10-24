// Caricamento dei dati: il catalogo elenca i file per negozio, così ogni
// fonte si aggiorna separatamente senza toccare il codice.

async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Impossibile caricare ${url} (HTTP ${res.status})`);
  return res.json();
}

export async function loadAll(base = './data/') {
  // Versione a file unico (Sedie-120.html): i dati sono incorporati nella pagina,
  // così funziona anche aperta con doppio clic, senza server.
  const embedded = typeof window !== 'undefined' ? window.__SEDIE_DATA__ : null;
  const [catalog, conventions, room] = embedded
    ? [embedded.catalog, embedded.conventions, embedded.room]
    : await Promise.all([
      getJSON(`${base}catalog.json`),
      getJSON(`${base}conventions.json`),
      getJSON(`${base}room.json`),
    ]);
  const lists = embedded
    ? catalog.files.map((f) => embedded.sources[f])
    : await Promise.all(catalog.files.map((f) => getJSON(`${base}${f}`)));
  const chairs = lists.flat().map((c) => ({ checked: catalog.checkedDate, ...c }));
  const ids = new Set();
  for (const c of chairs) {
    if (ids.has(c.id)) throw new Error(`Identificativo duplicato nel catalogo: ${c.id}`);
    ids.add(c.id);
  }
  return { catalog, chairs, conventions, room };
}
