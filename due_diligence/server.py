"""Interface locale avec régénération des livrables après correction humaine."""
import argparse
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import urlparse
from due_diligence.review import build
from due_diligence.exports import export_html, export_office


def publish(room, case, out, previous=None):
    data = build(room, case, previous)
    data['office_exports'] = True
    data['local_server'] = True
    out.mkdir(parents=True, exist_ok=True)
    # Préparer tous les formats avant de remplacer les livrables existants.
    with TemporaryDirectory(dir=out) as tmp:
        stage = Path(tmp)
        export_office(data, stage)
        export_html(data, stage)
        (stage/'review.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        for path in stage.iterdir():
            path.replace(out/path.name)
    return data


def handler(room, case_path, out, state):
    class Handler(BaseHTTPRequestHandler):
        def respond(self, code, payload):
            raw = json.dumps(payload, ensure_ascii=False).encode()
            self.send_response(code); self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)

        def do_GET(self):
            if self.headers.get('Host') != f'127.0.0.1:{self.server.server_port}':
                self.respond(403, {'error':'Hôte refusé'}); return
            name = {'/':'revue.html', '/revue.html':'revue.html', '/rapport.docx':'rapport.docx', '/tableaux.xlsx':'tableaux.xlsx'}.get(urlparse(self.path).path)
            if not name or not (out/name).exists():
                self.respond(404, {'error':'Fichier introuvable'}); return
            raw=(out/name).read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8' if name.endswith('.html') else 'application/octet-stream')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            if not name.endswith('.html'):
                self.send_header('Content-Disposition', f'attachment; filename="{name}"')
            self.send_header('Content-Length', str(len(raw))); self.end_headers(); self.wfile.write(raw)

        def do_POST(self):
            allowed_origin=f'http://{self.headers.get("Host", "")}'
            if self.headers.get('Host') != f'127.0.0.1:{self.server.server_port}' or self.path != '/api/review' or self.headers.get('Origin') != allowed_origin or not self.headers.get('Content-Type','').startswith('application/json'):
                self.respond(403, {'error':'Requête refusée'}); return
            try:
                size=int(self.headers.get('Content-Length','0'))
                if not 0 < size <= 2_000_000:
                    raise ValueError('Taille du dossier invalide')
                payload=json.loads(self.rfile.read(size))
                if payload.get('revision') != state['data']['generated_at']:
                    self.respond(409, {'error':'Le dossier a changé. Rechargez la page avant de modifier.'}); return
                case=payload['case']
                data=publish(room, case, out, state['data'])
                case_path.write_text(json.dumps(case, ensure_ascii=False, indent=2), encoding='utf-8')
                state['data']=data
                self.respond(200, {'ok':True})
            except (ValueError, KeyError, TypeError) as exc:
                self.respond(422, {'error':str(exc)})
            except Exception:
                self.respond(500, {'error':'Échec de génération des livrables. Vérifiez le dossier et les dépendances.'})
    return Handler


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--room', type=Path, required=True)
    p.add_argument('--case', type=Path, required=True)
    p.add_argument('--out', type=Path, required=True)
    p.add_argument('--port', type=int, default=8765)
    a=p.parse_args()
    if not a.room.is_dir() or a.out.resolve().is_relative_to(a.room.resolve()) or a.case.resolve().is_relative_to(a.room.resolve()):
        p.error('Les sorties et le dossier de travail doivent être extérieurs à la data room existante.')
    previous_path = a.out / 'review.json'
    previous = json.loads(previous_path.read_text()) if previous_path.exists() else None
    state={'data':publish(a.room,json.loads(a.case.read_text()),a.out,previous)}
    server=HTTPServer(('127.0.0.1',a.port), handler(a.room,a.case,a.out,state))
    print(f'Revue locale : http://127.0.0.1:{a.port}',flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()

if __name__=='__main__': main()
