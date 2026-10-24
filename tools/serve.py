"""Server locale per sviluppo e test (i moduli ES e i file JSON non si caricano da file://).

Uso:  python tools/serve.py [--port 8765] [--open]

  --open  apre il browser sull'app; i test sono su http://localhost:<porta>/tests/
"""
import argparse
import http.server
import socketserver
import webbrowser
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    # Su Windows il registro può associare .js a text/plain e il browser
    # rifiuterebbe i moduli: i tipi vengono fissati qui.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.json': 'application/json',
        '.css': 'text/css',
        '.html': 'text/html',
        '.svg': 'image/svg+xml',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, fmt, *args):
        if args and str(args[1]).startswith(('4', '5')):
            super().log_message(fmt, *args)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=8765)
    ap.add_argument('--open', action='store_true')
    args = ap.parse_args()
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT))) as httpd:
        url = f'http://localhost:{args.port}/'
        print(f'App:  {url}\nTest: {url}tests/\nCtrl+C per fermare.')
        if args.open:
            webbrowser.open(url)
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
