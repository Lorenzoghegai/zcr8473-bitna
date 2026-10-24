"""Genera Sedie-120.html: l'app in un unico file (dati, CSS, codice e Three.js
incorporati) che si apre con doppio clic, senza server.

Uso:  python tools/build_standalone.py [--check]

  --check  non scrive nulla: esce con codice 1 se Sedie-120.html non è
           allineato ai sorgenti (utile prima di un commit).

Va rieseguito dopo ogni modifica a dati, CSS o codice.
"""
import base64
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'Sedie-120.html'

# Moduli di terze parti: nome nell'import map -> file locale.
VENDOR = [
    ('three', 'vendor/three/three.module.min.js'),
    ('three/addons/OrbitControls.js', 'vendor/three/addons/OrbitControls.js'),
    ('three/addons/CSS2DRenderer.js', 'vendor/three/addons/CSS2DRenderer.js'),
]


def data_url(path: Path) -> str:
    return 'data:text/javascript;base64,' + base64.b64encode(path.read_bytes()).decode('ascii')


def read_json(rel: str):
    return json.loads((ROOT / 'data' / rel).read_text(encoding='utf-8'))


def build() -> str:
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = (ROOT / 'css' / 'style.css').read_text(encoding='utf-8')

    # Ogni modulo dell'app diventa una voce dell'import map con URL «data:»;
    # gli import usano il prefisso @app/ proprio perché i percorsi relativi
    # non funzionano dentro un URL «data:».
    imports = {}
    for path in sorted((ROOT / 'js').rglob('*.js')):
        imports['@app/' + path.relative_to(ROOT).as_posix()] = data_url(path)
    for name, rel in VENDOR:
        imports[name] = data_url(ROOT / rel)

    catalog = read_json('catalog.json')
    data = {
        'catalog': catalog,
        'conventions': read_json('conventions.json'),
        'room': read_json('room.json'),
        'sources': {f: read_json(f) for f in catalog['files']},
    }
    # «</» chiuderebbe il tag <script>: viene scritto come «<\/» (JSON valido).
    data_js = json.dumps(data, ensure_ascii=False).replace('</', '<\\/')

    html, n_css = re.subn(r'  <link rel="stylesheet" href="css/style.css">\n',
                          lambda _: f'  <style>\n{css}</style>\n', html)
    html, n_map = re.subn(r'  <script type="importmap">.*?</script>\n',
                          lambda _: f'  <script type="importmap">{json.dumps({"imports": imports})}</script>\n', html, flags=re.S)
    html, n_main = re.subn(r'(  <script type="module">import \'@app/js/main.js\';</script>\n)',
                           lambda m: f'  <script>window.__SEDIE_DATA__ = {data_js};</script>\n{m.group(1)}', html)
    if (n_css, n_map, n_main) != (1, 1, 1):
        raise SystemExit(f'index.html non ha la struttura attesa (css={n_css}, importmap={n_map}, main={n_main})')
    return html


def main() -> int:
    html = build()
    if '--check' in sys.argv:
        current = OUT.read_text(encoding='utf-8') if OUT.exists() else ''
        if current != html:
            print('Sedie-120.html NON è allineato ai sorgenti: esegui python tools/build_standalone.py')
            return 1
        print('Sedie-120.html è allineato ai sorgenti.')
        return 0
    OUT.write_text(html, encoding='utf-8', newline='\n')
    print(f'Scritto {OUT.name} ({OUT.stat().st_size / 1024:.0f} KB)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
