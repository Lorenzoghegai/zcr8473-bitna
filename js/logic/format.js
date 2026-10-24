export const euro = (n) => (n == null || Number.isNaN(n) ? '—' : `${Number(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`);

export const cm = (n) => (n == null ? '—' : `${String(Math.round(n * 10) / 10).replace('.', ',')} cm`);

export const range = (o, unit = 'cm') => {
  if (!o) return '—';
  const f = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  if (o.min != null && o.max != null) return `${f(o.min)}–${f(o.max)} ${unit}`;
  if (o.max != null) return `max ${f(o.max)} ${unit}`;
  if (o.min != null) return `min ${f(o.min)} ${unit}`;
  return '—';
};

export const int = (n) => (n == null ? '—' : String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'));

export const STATUS_LABEL = { idonea: 'Idonea', 'da-verificare': 'Da verificare', esclusa: 'Esclusa' };

export const DIM_LABEL = { verificata: 'Compatibilità verificata', probabile: 'Probabile, da confermare', incompatibile: 'Incompatibile' };

export const WIDTH_LABEL = {
  ok: 'Verificata',
  derivata: 'Derivata (da confermare)',
  parziale: 'Parziale',
  mancante: 'Non documentata',
  incompatibile: 'Incompatibile',
};

export const ARMS_LABEL = {
  ok: 'Verificata',
  compromesso: 'Solo con braccioli sollevati',
  incerta: 'Riferimento incerto',
  mancante: 'Non documentata',
  incompatibile: 'Incompatibile',
};

export const BUDGET_LABEL = {
  verificato: 'Entro budget (verificato)',
  'verificato-ritiro': 'Entro budget con ritiro in negozio',
  probabile: 'Probabile (spedizione da confermare)',
  fuori: 'Fuori budget',
};

export const SHIP_LABEL = {
  gratuita: 'Spedizione gratuita',
  fissa: 'Spedizione a pagamento',
  intervallo: 'Spedizione variabile',
  'ritiro-gratuito': 'Ritiro gratuito',
  'primo-ordine': 'Gratis solo 1° ordine',
  sconosciuta: 'Spedizione da verificare',
};

export const REF_LABEL = {
  consigliato: 'prezzo consigliato',
  mediano: 'prezzo mediano Amazon',
  'minimo-30gg': 'prezzo più basso 30 giorni',
  precedente: 'prezzo precedente',
  listino: 'prezzo di listino',
};

export const DISCOUNT_STATUS = {
  verificato: 'Verificato e applicato',
  pubblicizzato: 'Pubblicizzato, non verificato al checkout',
  'non-verificato': 'Non verificato',
  'non-applicabile': 'Non applicabile',
};
