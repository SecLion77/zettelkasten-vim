#!/usr/bin/env python3
"""
Zettelkasten VIM — Python Backend
Bestandsgebaseerde opslag: notities als .md, PDF annotaties als .json
"""

import os, sys, json, shutil, glob, hashlib, mimetypes, threading, webbrowser
import urllib.request, urllib.error
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, unquote
import argparse

# ── Standaard vault locatie ────────────────────────────────────────────────────
DEFAULT_VAULT = Path.home() / "Zettelkasten"
STATIC_DIR = Path(__file__).parent / "static"

class VaultManager:
    """Beheert lezen/schrijven van notities en PDF-annotaties op schijf."""

    def __init__(self, vault_path: Path):
        self.vault = vault_path
        self.notes_dir  = vault_path / "notes"
        self.pdf_dir    = vault_path / "pdfs"
        self.annot_dir  = vault_path / "annotations"
        self.config_file = vault_path / "config.json"
        self._init_dirs()

    def _init_dirs(self):
        for d in [self.vault, self.notes_dir, self.pdf_dir, self.annot_dir]:
            d.mkdir(parents=True, exist_ok=True)
        if not self.config_file.exists():
            self._write_json(self.config_file, {
                "vault_name": self.vault.name,
                "created": datetime.now().isoformat(),
                "version": 3
            })
        # Seed zettel als vault leeg is
        if not list(self.notes_dir.glob("*.md")):
            self._create_seed()

    def _create_seed(self):
        seed = {
            "id": "20240101000001",
            "title": "Zettelkasten — Begin hier",
            "content": "# Zettelkasten\n\n*Elke notitie is een atoom van kennis.*\n\n## VIM commando's\n\n- `:tag rust async` — vervang alle tags\n- `:tag+ newtag` — voeg één tag toe\n- `:tag- rust` — verwijder een tag\n- `:retag` — herbereken tags uit #hash in tekst\n\n## Navigatie\n\n- `h j k l` — bewegen · `w/b` — woord\n- `gg / G` — begin/einde\n- `dd` — verwijder · `yy` — kopieer · `p` — plak\n- `u` — undo · `Ctrl+r` — redo\n\nZie ook [[20240101000002]] voor links.\n\n#meta #vim #start",
            "tags": ["meta", "vim", "start"],
            "created": datetime.now().isoformat(),
            "modified": datetime.now().isoformat(),
        }
        seed2 = {
            "id": "20240101000002",
            "title": "Links en Verbindingen",
            "content": "# Links en Verbindingen\n\nGebruik `[[ID]]` of `[[Titel]]` voor links.\n\nTerug naar [[20240101000001]].\n\n## Obsidian-stijl links\n\nDe kennisgraaf toont alle verbindingen tussen notities.\nNodes met meer links zijn groter.\n\n#methode #links",
            "tags": ["methode", "links"],
            "created": datetime.now().isoformat(),
            "modified": datetime.now().isoformat(),
        }
        self.save_note(seed)
        self.save_note(seed2)

    # ── Notes ──────────────────────────────────────────────────────────────────

    def _note_path(self, note_id: str) -> Path:
        return self.notes_dir / f"{note_id}.md"

    def _serialize_note(self, note: dict) -> str:
        """Schrijf notitie als Markdown met YAML frontmatter."""
        tags = json.dumps(note.get("tags", []))
        fm = (
            f"---\n"
            f"id: {note['id']}\n"
            f"title: {note['title']}\n"
            f"tags: {tags}\n"
            f"created: {note.get('created', datetime.now().isoformat())}\n"
            f"modified: {note.get('modified', datetime.now().isoformat())}\n"
            f"---\n\n"
        )
        return fm + note.get("content", "")

    def _parse_note(self, path: Path):
        try:
            text = path.read_text(encoding="utf-8")
        except Exception:
            return None
        note = {"id": path.stem, "title": path.stem, "tags": [], "content": "", "created": "", "modified": ""}
        if text.startswith("---"):
            parts = text.split("---", 2)
            if len(parts) >= 3:
                fm_raw = parts[1]
                note["content"] = parts[2].lstrip("\n")
                for line in fm_raw.strip().splitlines():
                    if line.startswith("id:"):
                        note["id"] = line[3:].strip()
                    elif line.startswith("title:"):
                        note["title"] = line[6:].strip()
                    elif line.startswith("tags:"):
                        try:
                            note["tags"] = json.loads(line[5:].strip())
                        except Exception:
                            note["tags"] = []
                    elif line.startswith("created:"):
                        note["created"] = line[8:].strip()
                    elif line.startswith("modified:"):
                        note["modified"] = line[9:].strip()
        else:
            note["content"] = text
        note["file"] = str(path)
        return note

    def load_notes(self):
        notes = []
        for p in sorted(self.notes_dir.glob("*.md"), key=lambda x: x.stat().st_mtime, reverse=True):
            n = self._parse_note(p)
            if n:
                notes.append(n)
        return notes

    def save_note(self, note: dict):
        note["modified"] = datetime.now().isoformat()
        if not note.get("created"):
            note["created"] = note["modified"]
        path = self._note_path(note["id"])
        path.write_text(self._serialize_note(note), encoding="utf-8")
        return note

    def delete_note(self, note_id: str):
        path = self._note_path(note_id)
        if path.exists():
            path.unlink()
            return True
        return False

    # ── PDF Annotaties ─────────────────────────────────────────────────────────

    def _annot_path(self, pdf_name: str) -> Path:
        safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in pdf_name)
        return self.annot_dir / f"{safe}.json"

    def load_annotations(self):
        all_annots = []
        for p in self.annot_dir.glob("*.json"):
            try:
                data = json.loads(p.read_text(encoding="utf-8"))
                if isinstance(data, list):
                    all_annots.extend(data)
            except Exception:
                pass
        return all_annots

    def save_annotations(self, annotations: list):
        # Groepeer per PDF bestand
        by_pdf = {}
        for a in annotations:
            key = a.get("file", "unknown")
            by_pdf.setdefault(key, []).append(a)
        for pdf_name, annots in by_pdf.items():
            path = self._annot_path(pdf_name)
            path.write_text(json.dumps(annots, ensure_ascii=False, indent=2), encoding="utf-8")

    # ── PDF Bestanden ──────────────────────────────────────────────────────────

    def list_pdfs(self):
        return [
            {
                "name": p.name,
                "size": p.stat().st_size,
                "modified": datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
                "path": str(p),
            }
            for p in sorted(self.pdf_dir.glob("*.pdf"), key=lambda x: x.stat().st_mtime, reverse=True)
        ]

    def save_pdf(self, filename: str, data: bytes):
        safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in filename)
        dest = self.pdf_dir / safe
        dest.write_bytes(data)
        return safe

    def get_pdf_path(self, filename: str):
        p = self.pdf_dir / filename
        return p if p.exists() else None

    # ── Config ─────────────────────────────────────────────────────────────────

    def get_config(self):
        try:
            return json.loads(self.config_file.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def _write_json(self, path: Path, data):
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    @property
    def path_str(self) -> str:
        return str(self.vault)


# ── HTTP Handler ───────────────────────────────────────────────────────────────

class ZKHandler(BaseHTTPRequestHandler):
    vault:   VaultManager = None   # ingesteld door main()
    verbose: bool         = False  # ingesteld door main() via --verbose

    def log_message(self, fmt, *args):
        if self.verbose:
            status = args[1] if len(args) > 1 else "???"
            print(f"  {self.command:<7} {status}  {self.path}", flush=True)

    def _send(self, code: int, body, content_type="application/json"):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode("utf-8")
        elif isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def _raw_body(self):
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length) if length else b""

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path   = parsed.path.rstrip("/") or "/"

        # ── API ──
        if path == "/api/notes":
            return self._send(200, self.vault.load_notes())

        if path == "/api/annotations":
            return self._send(200, self.vault.load_annotations())

        if path == "/api/pdfs":
            return self._send(200, self.vault.list_pdfs())

        if path == "/api/config":
            return self._send(200, {
                "vault_path": self.vault.path_str,
                "config": self.vault.get_config(),
            })

        if path.startswith("/api/pdf/"):
            fname = unquote(path[9:])
            p = self.vault.get_pdf_path(fname)
            if p:
                data = p.read_bytes()
                return self._send(200, data, "application/pdf")
            return self._send(404, {"error": "PDF niet gevonden"})

        # ── Statische bestanden ──
        static_map = {
            "/": STATIC_DIR / "index.html",
            "/app.js": STATIC_DIR / "app.js",
        }
        file_path = static_map.get(path)
        if file_path and file_path.exists():
            mime = "text/html" if str(file_path).endswith(".html") else "application/javascript"
            return self._send(200, file_path.read_bytes(), mime)

        # LLM model list
        if path == "/api/llm/models":
            return self._llm_models()

        return self._send(404, {"error": "Niet gevonden"})

    def _llm_models(self):
        """Haal beschikbare Ollama modellen op."""
        ollama = os.environ.get("OLLAMA_URL", "http://localhost:11434")
        try:
            req = urllib.request.urlopen(f"{ollama}/api/tags", timeout=3)
            data = json.loads(req.read())
            models = [m["name"] for m in data.get("models", [])]
            return self._send(200, {"models": models, "ollama_url": ollama, "ok": True})
        except Exception as e:
            return self._send(200, {"models": [], "ok": False, "error": str(e),
                                    "ollama_url": ollama})

    def do_POST(self):
        parsed = urlparse(self.path)
        path   = parsed.path.rstrip("/")

        if path == "/api/notes":
            note = self._body()
            saved = self.vault.save_note(note)
            return self._send(200, saved)

        if path == "/api/annotations":
            annots = self._body()
            if isinstance(annots, list):
                self.vault.save_annotations(annots)
                return self._send(200, {"ok": True})
            return self._send(400, {"error": "Verwacht een lijst"})

        if path == "/api/pdfs":
            ct = self.headers.get("Content-Type", "")
            if "multipart" in ct:
                # Eenvoudige multipart parser
                boundary = ct.split("boundary=")[-1].encode()
                raw = self._raw_body()
                parts = raw.split(b"--" + boundary)
                for part in parts:
                    if b"filename=" in part:
                        header, _, body = part.partition(b"\r\n\r\n")
                        fname = header.split(b"filename=")[1].split(b'"')[1].decode()
                        saved_name = self.vault.save_pdf(fname, body.rstrip(b"\r\n--"))
                        return self._send(200, {"name": saved_name})
            return self._send(400, {"error": "Multipart vereist"})

        if path == "/api/llm/chat":
            return self._llm_chat()

        if path == "/api/vault":
            body = self._body()
            new_path = body.get("path", "").strip()
            if not new_path:
                return self._send(400, {"error": "Pad vereist"})
            ZKHandler.vault = VaultManager(Path(new_path))
            return self._send(200, {"vault_path": ZKHandler.vault.path_str})

        return self._send(404, {"error": "Niet gevonden"})

    def _llm_chat(self):
        """Proxy naar Ollama /api/chat met streaming via Server-Sent Events."""
        body = self._body()
        ollama = os.environ.get("OLLAMA_URL", "http://localhost:11434")
        model  = body.get("model", "llama3")
        messages = body.get("messages", [])

        # Bouw system prompt op met vault context
        context_ids  = body.get("context_notes", [])   # lijst note IDs
        context_pdfs = body.get("context_pdfs",  [])   # lijst PDF namen

        context_parts = []
        if context_ids:
            notes = self.vault.load_notes()
            selected = [n for n in notes if n["id"] in context_ids]
            for n in selected[:8]:  # max 8 notities
                context_parts.append("## Notitie: " + n["title"] + "\n" + n["content"][:3000])

        if context_pdfs:
            annots = self.vault.load_annotations()
            for pdf_name in context_pdfs[:4]:
                pdf_annots = [a for a in annots if a.get("file") == pdf_name]
                if pdf_annots:
                    lines = []
                    for a in pdf_annots[:30]:
                        line = '- "' + a["text"] + '"'
                        if a.get("note"):
                            line += "\n  Noot: " + a["note"]
                        lines.append(line)
                    context_parts.append("## PDF annotaties: " + pdf_name + "\n" + "\n".join(lines))

        system = (
            "Je bent een behulpzame kennisassistent die helpt met het analyseren van "
            "notities en PDF-annotaties uit een Zettelkasten kennisbank. "
            "Antwoord in de taal van de gebruiker (Nederlands of Engels). "
            "Wees precies, analytisch en verwijs naar specifieke notities als dat relevant is."
        )
        if context_parts:
            system += "\n\n# Beschikbare kenniscontext:\n\n" + "\n\n---\n\n".join(context_parts)

        ollama_body = json.dumps({
            "model": model,
            "messages": [{"role": "system", "content": system}] + messages,
            "stream": True,
        }).encode("utf-8")

        try:
            req = urllib.request.Request(
                f"{ollama}/api/chat",
                data=ollama_body,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            # SSE streaming response
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()

            with urllib.request.urlopen(req, timeout=120) as resp:
                for line in resp:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        chunk = json.loads(line)
                        delta = chunk.get("message", {}).get("content", "")
                        done  = chunk.get("done", False)
                        evt   = json.dumps({"delta": delta, "done": done})
                        self.wfile.write(("data: " + evt + "\n\n").encode("utf-8"))
                        self.wfile.flush()
                        if done:
                            break
                    except Exception:
                        pass

        except urllib.error.URLError as e:
            err = json.dumps({"error": "Ollama niet bereikbaar: " + str(e) + ". Start Ollama met: ollama serve"})
            self.wfile.write(("data: " + err + "\n\n").encode("utf-8"))
            self.wfile.flush()
        except Exception as e:
            err = json.dumps({"error": str(e)})
            try:
                self.wfile.write(("data: " + err + "\n\n").encode("utf-8"))
                self.wfile.flush()
            except Exception:
                pass

    def do_PUT(self):
        parsed = urlparse(self.path)
        path   = parsed.path.rstrip("/")

        if path.startswith("/api/notes/"):
            note_id = unquote(path[11:])
            note = self._body()
            note["id"] = note_id
            saved = self.vault.save_note(note)
            return self._send(200, saved)

        return self._send(404, {"error": "Niet gevonden"})

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path   = parsed.path.rstrip("/")

        if path.startswith("/api/notes/"):
            note_id = unquote(path[11:])
            ok = self.vault.delete_note(note_id)
            return self._send(200, {"deleted": ok})

        return self._send(404, {"error": "Niet gevonden"})


def get_local_ip() -> str:
    """Detecteer het lokale IPv4-adres (niet 127.0.0.1)."""
    import socket
    try:
        # Verbind naar extern adres — geen echt verkeer, alleen voor routing-info
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "onbekend"


def main():
    parser = argparse.ArgumentParser(description="Zettelkasten VIM — Python App")
    parser.add_argument("--vault",      default=str(DEFAULT_VAULT), help="Pad naar vault map")
    parser.add_argument("--port",       type=int, default=7842,     help="Poort (standaard: 7842)")
    parser.add_argument("--no-browser", action="store_true",        help="Open browser niet automatisch")
    parser.add_argument("--verbose",    action="store_true",        help="Toon HTTP requests in terminal")
    parser.add_argument("--host",       default="0.0.0.0",          help="Bind adres (standaard: 0.0.0.0)")
    args = parser.parse_args()

    vault_path = Path(args.vault).expanduser().resolve()
    ZKHandler.vault   = VaultManager(vault_path)
    ZKHandler.verbose = args.verbose

    server  = HTTPServer((args.host, args.port), ZKHandler)
    local_ip = get_local_ip()
    url_local = f"http://localhost:{args.port}"
    url_net   = f"http://{local_ip}:{args.port}"

    print(f"""
╔══════════════════════════════════════════════════════╗
║          ZETTELKASTEN VIM  —  Python Server          ║
╚══════════════════════════════════════════════════════╝
  Vault   : {vault_path}
  Lokaal  : {url_local}
  Netwerk : {url_net}
  Logging : {"aan (--verbose)" if args.verbose else "uit  (gebruik --verbose om aan te zetten)"}
  Stop    : Ctrl+C
""")

    if not args.no_browser:
        threading.Timer(0.8, lambda: webbrowser.open(url_local)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer gestopt.")


if __name__ == "__main__":
    main()
