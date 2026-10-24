"""Controlla la coerenza dei dati in data/ prima di pubblicarli.

Uso:  python tools/validate_data.py

Errori  = dati che romperebbero l'app o i calcoli (codice di uscita 1).
Avvisi  = dati plausibili ma da ricontrollare (non bloccano).
Non verifica che prezzi e misure siano veri: quello si fa sulle schede dei negozi.
"""
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data'

ENUMS = {
    'type': {'rete', 'imbottita', 'design', 'tessuto', 'gaming'},
    'model3d': {'mesh-mid', 'mesh-high', 'tub', 'executive', 'gaming', 'armless'},
    'shipping.status': {'gratuita', 'fissa', 'intervallo', 'ritiro-gratuito', 'primo-ordine', 'sconosciuta'},
    'arms.type': {'nessuno', 'fissi', 'integrati', 'ribaltabili', 'regolabili', 'ribaltabili-regolabili'},
    'widths.kind': {'ingombro', 'base', 'base-diametro', 'braccioli'},
    'priceRef.kind': {'consigliato', 'mediano', 'minimo-30gg', 'precedente', 'listino'},
    'tilt.kind': {'nessuna', 'non-dichiarata', 'oscillante', 'oscillante-tensione', 'bloccabile'},
    'discounts.status': {'verificato', 'pubblicizzato', 'non-verificato', 'non-applicabile'},
}
REQUIRED = ['id', 'name', 'brand', 'model', 'code', 'store', 'seller', 'url', 'type', 'model3d', 'price', 'shipping', 'widths', 'arms', 'sources']
ROOM_STATUS = {'fornito', 'derivato', 'stimato', 'ipotesi', 'scelta'}


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, where, msg):
        self.errors.append(f'{where}: {msg}')

    def warn(self, where, msg):
        self.warnings.append(f'{where}: {msg}')


def is_num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool)


def check_range(rep, where, obj, name, lo, hi):
    if obj is None:
        return
    for k in ('min', 'max'):
        v = obj.get(k)
        if v is not None and (not is_num(v) or not lo <= v <= hi):
            rep.err(where, f'{name}.{k} fuori scala ({v})')
    if is_num(obj.get('min')) and is_num(obj.get('max')) and obj['min'] > obj['max']:
        rep.err(where, f'{name}: min {obj["min"]} > max {obj["max"]}')


def check_chair(rep, c, where):
    for k in REQUIRED:
        if k not in c:
            rep.err(where, f'campo obbligatorio mancante: {k}')
    if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', str(c.get('id', ''))):
        rep.err(where, f'id non valido: {c.get("id")!r} (minuscole, cifre e trattini)')
    for key, allowed in ENUMS.items():
        head, _, tail = key.partition('.')
        val = c.get(head)
        if not tail:
            if val not in allowed:
                rep.err(where, f'{key} sconosciuto: {val!r}')
            continue
        items = val if isinstance(val, list) else [val] if isinstance(val, dict) else []
        for it in items:
            if it.get(tail) not in allowed:
                rep.err(where, f'{key} sconosciuto: {it.get(tail)!r}')

    price = c.get('price')
    if not is_num(price) or price <= 0:
        rep.err(where, f'prezzo non valido: {price!r}')

    s = c.get('shipping') or {}
    st = s.get('status')
    if st in ('gratuita', 'ritiro-gratuito') and s.get('cost') not in (0, None):
        rep.err(where, f'spedizione «{st}» con costo {s.get("cost")}')
    if st == 'fissa' and not is_num(s.get('cost')):
        rep.err(where, 'spedizione fissa senza costo numerico')
    if st == 'intervallo':
        if not (is_num(s.get('cost')) and is_num(s.get('max')) and s['cost'] <= s['max']):
            rep.err(where, 'spedizione a intervallo: servono cost ≤ max numerici')

    ref = c.get('priceRef')
    if ref is not None:
        if not is_num(ref.get('v')) or ref['v'] <= 0:
            rep.err(where, f'priceRef.v non valido: {ref.get("v")!r}')
        elif is_num(price) and ref['v'] < price:
            rep.warn(where, f'prezzo di riferimento {ref["v"]} inferiore al prezzo {price}')

    for w in c.get('widths') or []:
        if not is_num(w.get('v')) or not 30 <= w['v'] <= 120:
            rep.err(where, f'larghezza fuori scala: {w.get("v")!r}')
        if not w.get('src'):
            rep.warn(where, f'larghezza {w.get("v")} senza fonte (src)')

    a = c.get('arms') or {}
    for k in ('min', 'max', 'single'):
        if a.get(k) is not None and (not is_num(a[k]) or not 40 <= a[k] <= 100):
            rep.err(where, f'arms.{k} fuori scala ({a[k]})')
    check_range(rep, where, a if 'min' in a or 'max' in a else None, 'arms', 40, 100)
    if a.get('type') == 'nessuno' and any(a.get(k) is not None for k in ('min', 'max', 'single')):
        rep.err(where, 'senza braccioli ma con altezza braccioli')

    check_range(rep, where, c.get('seatHeight'), 'seatHeight', 30, 90)
    check_range(rep, where, c.get('height'), 'height', 50, 160)
    for k in ('depth', 'maxLoad'):
        v = (c.get(k) or {}).get('v')
        if v is not None and not is_num(v):
            rep.err(where, f'{k}.v non numerico')

    r = c.get('rating')
    if r is not None:
        if not (is_num(r.get('v')) and 1 <= r['v'] <= 5):
            rep.err(where, f'rating.v fuori scala: {r.get("v")!r}')
        if not (isinstance(r.get('n'), int) and r['n'] >= 1):
            rep.err(where, f'rating.n non valido: {r.get("n")!r}')
        if not r.get('platform'):
            rep.err(where, 'rating senza piattaforma')

    urls = [c.get('url')] + [x.get('url') for x in c.get('sources') or []] + ([c['image']] if c.get('image') else [])
    for u in urls:
        if not isinstance(u, str) or not u.startswith('https://'):
            rep.err(where, f'URL non https: {u!r}')
    if not c.get('sources'):
        rep.err(where, 'nessuna fonte')

    if c.get('exclude') and not c['exclude'].get('reason'):
        rep.err(where, 'exclude senza motivo')
    if c.get('convention') and c['convention'] != 'home24':
        rep.warn(where, f'convenzione non gestita dal calcolatore: {c["convention"]}')


def main() -> int:
    rep = Report()
    catalog = json.loads((DATA / 'catalog.json').read_text(encoding='utf-8'))
    try:
        date.fromisoformat(catalog['checkedDate'])
    except (KeyError, ValueError):
        rep.err('catalog.json', 'checkedDate mancante o non in formato AAAA-MM-GG')
    for k in ('maxWidthCm', 'maxArmHeightCm', 'spaceBehindTableCm'):
        if not is_num(catalog.get('constraints', {}).get(k)):
            rep.err('catalog.json', f'constraints.{k} mancante')
    if not is_num(catalog.get('budgetEur')):
        rep.err('catalog.json', 'budgetEur mancante')

    ids, count = {}, 0
    for f in catalog.get('files', []):
        path = DATA / f
        if not path.exists():
            rep.err('catalog.json', f'file elencato inesistente: {f}')
            continue
        chairs = json.loads(path.read_text(encoding='utf-8'))
        for i, c in enumerate(chairs):
            where = f'{f}[{i}] {c.get("id", "?")}'
            count += 1
            if c.get('id') in ids:
                rep.err(where, f'id duplicato (già in {ids[c["id"]]})')
            ids[c.get('id')] = f
            if c.get('store') not in catalog.get('stores', {}) and not str(c.get('store', '')).startswith('Leroy Merlin'):
                rep.warn(where, f'negozio senza condizioni in catalog.json: {c.get("store")}')
            check_chair(rep, c, where)

    conv = json.loads((DATA / 'conventions.json').read_text(encoding='utf-8'))
    gc = next((i for i in conv.get('items', []) if i.get('id') == 'home24-giftcard'), None)
    if not gc or not gc.get('giftCard', {}).get('denominations'):
        rep.err('conventions.json', 'manca home24-giftcard con i tagli (usato dal calcolatore)')
    elif not 0 < gc['giftCard'].get('rate', 0) < 1:
        rep.err('conventions.json', 'giftCard.rate deve essere tra 0 e 1')

    room = json.loads((DATA / 'room.json').read_text(encoding='utf-8'))
    needed = ['spaceBehindCm', 'legClearCm', 'apronBottomCm', 'tableHeightCm', 'legSizeCm', 'tableLengthCm',
              'sideWallGapCm', 'peninsulaHeightCm', 'insertUnderTableCm', 'standUpClearanceCm', 'tableShiftCm']
    for k in needed:
        p = room.get('params', {}).get(k)
        if not p or not is_num(p.get('v')):
            rep.err('room.json', f'parametro mancante o non numerico: {k}')
        elif p.get('status') not in ROOM_STATUS:
            rep.err('room.json', f'{k}: stato sconosciuto {p.get("status")!r}')

    for w in rep.warnings:
        print(f'AVVISO  {w}')
    for e in rep.errors:
        print(f'ERRORE  {e}')
    print(f'{count} schede, {len(rep.errors)} errori, {len(rep.warnings)} avvisi.' if rep.errors or rep.warnings
          else f'{count} schede, nessun errore.')
    return 1 if rep.errors else 0


if __name__ == '__main__':
    sys.exit(main())
