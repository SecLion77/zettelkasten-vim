#!/usr/bin/env python3
"""Zettelkasten VIM — Backend v4"""

import os, sys, json, base64, threading, webbrowser
import urllib.request, urllib.error, re
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, unquote
import argparse

DEFAULT_VAULT = Path.home() / "Zettelkasten"
STATIC_DIR    = Path(__file__).parent / "static"
IMAGE_EXTS    = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
IMAGE_MIME    = {".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",
                 ".gif":"image/gif",".webp":"image/webp",".svg":"image/svg+xml"}

class VaultManager:
    def __init__(self, vault_path):
        self.vault      = vault_path
        self.notes_dir  = vault_path / "notes"
        self.pdf_dir    = vault_path / "pdfs"
        self.annot_dir  = vault_path / "annotations"
        self.images_dir = vault_path / "images"
        self.config_file = vault_path / "config.json"
        self._init_dirs()

    def _init_dirs(self):
        for d in [self.vault, self.notes_dir, self.pdf_dir,
                  self.annot_dir, self.images_dir]:
            d.mkdir(parents=True, exist_ok=True)
        if not self.config_file.exists():
            self._write_json(self.config_file,
                {"vault_name":self.vault.name,"created":datetime.now().isoformat(),"version":4})
        if not list(self.notes_dir.glob("*.md")):
            self._create_seed()

    def _create_seed(self):
        self.save_note({"id":"20240101000001","title":"Zettelkasten — Begin hier",
            "content":"# Zettelkasten\n\n*Elke notitie is een atoom van kennis.*\n\nZie ook [[20240101000002]].\n\n#meta #start",
            "tags":["meta","start"],"created":datetime.now().isoformat(),"modified":datetime.now().isoformat()})
        self.save_note({"id":"20240101000002","title":"Links en Verbindingen",
            "content":"# Links\n\nGebruik `[[ID]]` of `[[Titel]]` voor links.\n\n#methode #links",
            "tags":["methode","links"],"created":datetime.now().isoformat(),"modified":datetime.now().isoformat()})

    # Notes
    def _note_path(self, nid): return self.notes_dir / f"{nid}.md"
    def _serialize_note(self, note):
        tags = json.dumps(note.get("tags",[]))
        return (f"---\nid: {note['id']}\ntitle: {note['title']}\ntags: {tags}\n"
                f"created: {note.get('created',datetime.now().isoformat())}\n"
                f"modified: {note.get('modified',datetime.now().isoformat())}\n---\n\n"
                + note.get("content",""))
    def _parse_note(self, path):
        try: text = path.read_text(encoding="utf-8")
        except: return None
        note = {"id":path.stem,"title":path.stem,"tags":[],"content":"","created":"","modified":""}
        if text.startswith("---"):
            parts = text.split("---",2)
            if len(parts)>=3:
                note["content"] = parts[2].lstrip("\n")
                for line in parts[1].strip().splitlines():
                    if   line.startswith("id:"):       note["id"]      = line[3:].strip()
                    elif line.startswith("title:"):    note["title"]   = line[6:].strip()
                    elif line.startswith("tags:"):
                        try: note["tags"] = json.loads(line[5:].strip())
                        except: note["tags"] = []
                    elif line.startswith("created:"):  note["created"] = line[8:].strip()
                    elif line.startswith("modified:"): note["modified"]= line[9:].strip()
        else: note["content"] = text
        return note
    def load_notes(self):
        return [n for n in (self._parse_note(p) for p in
                sorted(self.notes_dir.glob("*.md"),key=lambda x:x.stat().st_mtime,reverse=True)) if n]
    def save_note(self, note):
        note["modified"] = datetime.now().isoformat()
        if not note.get("created"): note["created"] = note["modified"]
        self._note_path(note["id"]).write_text(self._serialize_note(note), encoding="utf-8")
        return note
    def delete_note(self, nid):
        p = self._note_path(nid)
        if p.exists(): p.unlink(); return True
        return False

    # Annotations
    def _annot_path(self, pdf_name):
        safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in pdf_name)
        return self.annot_dir / f"{safe}.json"
    def load_annotations(self):
        r=[]
        for p in self.annot_dir.glob("*.json"):
            try:
                d=json.loads(p.read_text(encoding="utf-8"))
                if isinstance(d,list): r.extend(d)
            except: pass
        return r
    def save_annotations(self, annotations):
        by_pdf={}
        for a in annotations: by_pdf.setdefault(a.get("file","unknown"),[]).append(a)
        for pdf_name,annots in by_pdf.items():
            self._annot_path(pdf_name).write_text(
                json.dumps(annots,ensure_ascii=False,indent=2),encoding="utf-8")

    # PDFs
    def list_pdfs(self):
        return [{"name":p.name,"size":p.stat().st_size,
                 "modified":datetime.fromtimestamp(p.stat().st_mtime).isoformat()}
                for p in sorted(self.pdf_dir.glob("*.pdf"),key=lambda x:x.stat().st_mtime,reverse=True)]
    def save_pdf(self, filename, data):
        safe="".join(c if c.isalnum() or c in "-_." else "_" for c in filename)
        (self.pdf_dir/safe).write_bytes(data); return safe
    def get_pdf_path(self, filename):
        p=self.pdf_dir/filename; return p if p.exists() else None
    def extract_pdf_text(self, filename, max_chars=12000):
        p=self.get_pdf_path(filename)
        if not p: return ""
        try:
            import pypdf
            reader=pypdf.PdfReader(str(p))
            text="\n\n".join(page.extract_text() or "" for page in reader.pages[:30])
            if len(text.strip())>100: return text[:max_chars]
        except: pass
        try:
            from pdfminer.high_level import extract_text as pm
            return (pm(str(p),maxpages=20) or "")[:max_chars]
        except: pass
        return ""

    # Images
    def list_images(self):
        imgs=[]
        for ext in IMAGE_EXTS:
            for p in self.images_dir.glob(f"*{ext}"):
                imgs.append({"name":p.name,"size":p.stat().st_size,
                    "modified":datetime.fromtimestamp(p.stat().st_mtime).isoformat(),
                    "mime":IMAGE_MIME.get(ext,"image/jpeg"),
                    "url":f"/api/image/{p.name}"})
        imgs.sort(key=lambda x:x["modified"],reverse=True); return imgs
    def save_image(self, filename, data):
        safe="".join(c if c.isalnum() or c in "-_." else "_" for c in filename)
        dest=self.images_dir/safe; dest.write_bytes(data)
        return {"name":safe,"url":f"/api/image/{safe}","size":len(data),
                "modified":datetime.now().isoformat()}
    def get_image_path(self, filename):
        p=self.images_dir/filename; return p if p.exists() else None
    def delete_image(self, filename):
        p=self.get_image_path(filename)
        if p and p.exists(): p.unlink(); return True
        return False
    def image_as_base64(self, filename):
        p=self.get_image_path(filename)
        if not p: return None
        ext=p.suffix.lower()
        return {"data":base64.b64encode(p.read_bytes()).decode("ascii"),
                "mime":IMAGE_MIME.get(ext,"image/jpeg")}

    # Config
    def get_config(self):
        try: return json.loads(self.config_file.read_text(encoding="utf-8"))
        except: return {}
    def _write_json(self, path, data):
        path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
    @property
    def path_str(self): return str(self.vault)


class ZKHandler(BaseHTTPRequestHandler):
    vault:   VaultManager = None
    verbose: bool         = False

    def log_message(self, fmt, *args):
        if self.verbose:
            print(f"  {self.command:<7} {args[1] if len(args)>1 else '???'}  {self.path}", flush=True)

    def _send(self, code, body, ct="application/json"):
        if isinstance(body,(dict,list)): body=json.dumps(body,ensure_ascii=False).encode("utf-8")
        elif isinstance(body,str):       body=body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type",ct)
        self.send_header("Content-Length",len(body))
        self.send_header("Access-Control-Allow-Origin","*")
        self.end_headers(); self.wfile.write(body)

    def _body(self):
        l=int(self.headers.get("Content-Length",0))
        return json.loads(self.rfile.read(l)) if l else {}

    def _raw_body(self):
        l=int(self.headers.get("Content-Length",0))
        return self.rfile.read(l) if l else b""

    def do_OPTIONS(self):
        self.send_response(200)
        for h,v in [("Access-Control-Allow-Origin","*"),
                    ("Access-Control-Allow-Methods","GET,POST,PUT,DELETE,OPTIONS"),
                    ("Access-Control-Allow-Headers","Content-Type")]:
            self.send_header(h,v)
        self.end_headers()

    def do_GET(self):
        p = urlparse(self.path).path.rstrip("/") or "/"
        if p=="/api/notes":       return self._send(200,self.vault.load_notes())
        if p=="/api/annotations": return self._send(200,self.vault.load_annotations())
        if p=="/api/pdfs":        return self._send(200,self.vault.list_pdfs())
        if p=="/api/images":      return self._send(200,self.vault.list_images())
        if p=="/api/llm/models":  return self._llm_models()
        if p=="/api/config":      return self._send(200,{"vault_path":self.vault.path_str,"config":self.vault.get_config()})
        if p.startswith("/api/pdf/"):
            fname=unquote(p[9:])
            fp=self.vault.get_pdf_path(fname)
            if fp: return self._send(200,fp.read_bytes(),"application/pdf")
            return self._send(404,{"error":"PDF niet gevonden"})
        if p.startswith("/api/image/"):
            fname=unquote(p[11:])
            fp=self.vault.get_image_path(fname)
            if fp:
                ext=fp.suffix.lower()
                return self._send(200,fp.read_bytes(),IMAGE_MIME.get(ext,"image/jpeg"))
            return self._send(404,{"error":"Afbeelding niet gevonden"})
        sm={"/":STATIC_DIR/"index.html","/app.js":STATIC_DIR/"app.js"}
        fp=sm.get(p)
        if fp and fp.exists():
            return self._send(200,fp.read_bytes(),"text/html" if str(fp).endswith(".html") else "application/javascript")
        return self._send(404,{"error":"Niet gevonden"})

    def do_POST(self):
        p=urlparse(self.path).path.rstrip("/")
        if p=="/api/notes":
            return self._send(200,self.vault.save_note(self._body()))
        if p=="/api/annotations":
            a=self._body()
            if isinstance(a,list): self.vault.save_annotations(a); return self._send(200,{"ok":True})
            return self._send(400,{"error":"Verwacht een lijst"})
        if p=="/api/pdfs":
            ct=self.headers.get("Content-Type","")
            if "multipart" in ct:
                boundary=ct.split("boundary=")[-1].encode()
                for part in self._raw_body().split(b"--"+boundary):
                    if b"filename=" in part:
                        hdr,_,body=part.partition(b"\r\n\r\n")
                        fname=hdr.split(b"filename=")[1].split(b'"')[1].decode()
                        saved=self.vault.save_pdf(fname,body.rstrip(b"\r\n--"))
                        return self._send(200,{"name":saved})
            return self._send(400,{"error":"Multipart vereist"})
        if p=="/api/images":
            ct=self.headers.get("Content-Type","")
            if "multipart" in ct:
                boundary=ct.split("boundary=")[-1].encode()
                for part in self._raw_body().split(b"--"+boundary):
                    if b"filename=" in part:
                        hdr,_,body=part.partition(b"\r\n\r\n")
                        fname=hdr.split(b"filename=")[1].split(b'"')[1].decode()
                        return self._send(200,self.vault.save_image(fname,body.rstrip(b"\r\n--")))
            return self._send(400,{"error":"Multipart vereist"})
        if p=="/api/llm/chat":           return self._llm_chat()
        if p=="/api/llm/summarize-pdf":  return self._llm_summarize_pdf()
        if p=="/api/llm/describe-image": return self._llm_describe_image()
        if p=="/api/llm/mindmap":        return self._llm_mindmap()
        if p=="/api/vault":
            body=self._body()
            np=body.get("path","").strip()
            if not np: return self._send(400,{"error":"Pad vereist"})
            ZKHandler.vault=VaultManager(Path(np))
            return self._send(200,{"vault_path":ZKHandler.vault.path_str})
        return self._send(404,{"error":"Niet gevonden"})

    def do_PUT(self):
        p=urlparse(self.path).path.rstrip("/")
        if p.startswith("/api/notes/"):
            note=self._body(); note["id"]=unquote(p[11:])
            return self._send(200,self.vault.save_note(note))
        return self._send(404,{"error":"Niet gevonden"})

    def do_DELETE(self):
        p=urlparse(self.path).path.rstrip("/")
        if p.startswith("/api/notes/"):
            return self._send(200,{"deleted":self.vault.delete_note(unquote(p[11:]))})
        if p.startswith("/api/images/"):
            return self._send(200,{"deleted":self.vault.delete_image(unquote(p[12:]))})
        return self._send(404,{"error":"Niet gevonden"})

    # ── LLM ────────────────────────────────────────────────────────────────────
    def _ollama(self): return os.environ.get("OLLAMA_URL","http://localhost:11434")

    def _ollama_post(self, endpoint, payload, timeout=180):
        req=urllib.request.Request(self._ollama()+endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type":"application/json"},method="POST")
        with urllib.request.urlopen(req,timeout=timeout) as r:
            return json.loads(r.read())

    def _llm_models(self):
        try:
            r=urllib.request.urlopen(self._ollama()+"/api/tags",timeout=3)
            d=json.loads(r.read())
            return self._send(200,{"models":[m["name"] for m in d.get("models",[])],"ok":True,"ollama_url":self._ollama()})
        except Exception as e:
            return self._send(200,{"models":[],"ok":False,"error":str(e),"ollama_url":self._ollama()})

    def _llm_chat(self):
        body=self._body()
        model=body.get("model","llama3")
        messages=body.get("messages",[])
        ctx_notes=body.get("context_notes",[])
        ctx_pdfs=body.get("context_pdfs",[])
        ctx_imgs=body.get("context_images",[])

        parts=[]
        if ctx_notes:
            for n in [x for x in self.vault.load_notes() if x["id"] in ctx_notes][:8]:
                parts.append("## Notitie: "+n["title"]+"\n"+n["content"][:3000])
        if ctx_pdfs:
            annots=self.vault.load_annotations()
            for pn in ctx_pdfs[:4]:
                pa=[a for a in annots if a.get("file")==pn]
                if pa:
                    lines=['- "'+a["text"]+'"'+("\n  Noot: "+a["note"] if a.get("note") else "") for a in pa[:30]]
                    parts.append("## PDF annotaties: "+pn+"\n"+"\n".join(lines))
                txt=self.vault.extract_pdf_text(pn,6000)
                if txt.strip(): parts.append("## PDF tekst: "+pn+"\n"+txt)
        if ctx_imgs:
            img_lines=[f"- {n}" for n in ctx_imgs[:6]]
            if img_lines: parts.append("## Afbeeldingen:\n"+"\n".join(img_lines))

        system=("Je bent een behulpzame kennisassistent voor een Zettelkasten. "
                "Antwoord in de taal van de gebruiker. Wees analytisch en precies.")
        if parts: system+="\n\n# Kenniscontext:\n\n"+"\n\n---\n\n".join(parts)

        payload={"model":model,"messages":[{"role":"system","content":system}]+messages,"stream":True}
        try:
            req=urllib.request.Request(self._ollama()+"/api/chat",
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type":"application/json"},method="POST")
            self.send_response(200)
            self.send_header("Content-Type","text/event-stream")
            self.send_header("Cache-Control","no-cache")
            self.send_header("Access-Control-Allow-Origin","*")
            self.end_headers()
            with urllib.request.urlopen(req,timeout=180) as resp:
                for line in resp:
                    line=line.strip()
                    if not line: continue
                    try:
                        c=json.loads(line)
                        d=c.get("message",{}).get("content","")
                        done=c.get("done",False)
                        self.wfile.write(("data: "+json.dumps({"delta":d,"done":done})+"\n\n").encode("utf-8"))
                        self.wfile.flush()
                        if done: break
                    except: pass
        except urllib.error.URLError as e:
            try: self.wfile.write(("data: "+json.dumps({"error":"Ollama niet bereikbaar: "+str(e)})+"\n\n").encode()); self.wfile.flush()
            except: pass
        except Exception as e:
            try: self.wfile.write(("data: "+json.dumps({"error":str(e)})+"\n\n").encode()); self.wfile.flush()
            except: pass

    def _llm_summarize_pdf(self):
        body=self._body()
        fname=body.get("filename",""); model=body.get("model","llama3")
        if not fname: return self._send(400,{"error":"filename vereist"})
        text=self.vault.extract_pdf_text(fname,10000)
        if not text.strip():
            return self._send(200,{"ok":False,"error":"Geen tekst extraheerbaar. Installeer pypdf: pip install pypdf","summary":""})
        prompt=("Maak een uitgebreide Nederlandstalige samenvatting in Markdown. "
                "Gebruik headers (##), bullets (-) en bold (**tekst**). "
                "Structuur: 1) Kernpunten, 2) Hoofdonderwerpen, 3) Conclusies.\n\n"
                "--- PDF ---\n"+text+"\n--- EINDE ---")
        try:
            r=self._ollama_post("/api/generate",{"model":model,"prompt":prompt,"stream":False},180)
            return self._send(200,{"ok":True,"summary":r.get("response","").strip(),"filename":fname})
        except Exception as e:
            return self._send(200,{"ok":False,"error":str(e),"summary":""})

    def _llm_describe_image(self):
        body=self._body()
        fname=body.get("filename",""); model=body.get("model","llava")
        if not fname: return self._send(400,{"error":"filename vereist"})
        img=self.vault.image_as_base64(fname)
        if not img: return self._send(404,{"error":"Afbeelding niet gevonden"})
        prompt=("Beschrijf deze afbeelding in 3-5 zinnen Nederlands. "
                "Vermeld: wat er te zien is, kleuren, sfeer, eventuele tekst of symbolen.")
        try:
            r=self._ollama_post("/api/generate",{"model":model,"prompt":prompt,"images":[img["data"]],"stream":False},120)
            return self._send(200,{"ok":True,"description":r.get("response","").strip(),"filename":fname})
        except Exception as e:
            return self._send(200,{"ok":True,"description":"Afbeelding: "+fname+" (llava niet beschikbaar — ollama pull llava)",
                                   "filename":fname,"warning":str(e)})

    def _llm_mindmap(self):
        body=self._body()
        model=body.get("model","llama3")
        ctx_notes=body.get("context_notes",[])
        ctx_pdfs=body.get("context_pdfs",[])
        parts=[]
        if ctx_notes:
            for n in [x for x in self.vault.load_notes() if x["id"] in ctx_notes][:5]:
                parts.append("## "+n["title"]+"\n"+n["content"][:2000])
        if ctx_pdfs:
            for pn in ctx_pdfs[:2]:
                txt=self.vault.extract_pdf_text(pn,4000)
                if txt.strip(): parts.append("## "+pn+"\n"+txt)
        if not parts: return self._send(400,{"error":"Geen context"})
        prompt=('Analyseer de tekst en geef ALLEEN geldige JSON terug (geen uitleg, geen backticks).\n'
                'Formaat: {"root":"Titel","branches":[{"label":"Tak","children":["Blad1","Blad2"]}]}\n'
                'Gebruik 3-6 takken, elk 2-5 bladeren.\n\n'+"\n\n".join(parts))
        try:
            r=self._ollama_post("/api/generate",{"model":model,"prompt":prompt,"stream":False},120)
            raw=r.get("response","").strip()
            m=re.search(r'\{[\s\S]*\}',raw)
            if m:
                mm=json.loads(m.group(0))
                return self._send(200,{"ok":True,"mindmap":mm})
            return self._send(200,{"ok":False,"error":"Geen JSON in response","raw":raw[:500]})
        except Exception as e:
            return self._send(200,{"ok":False,"error":str(e)})


def get_local_ip():
    import socket
    try:
        s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.connect(("8.8.8.8",80))
        ip=s.getsockname()[0]; s.close(); return ip
    except: return "onbekend"


def main():
    parser=argparse.ArgumentParser(description="Zettelkasten VIM v4")
    parser.add_argument("--vault",      default=str(DEFAULT_VAULT))
    parser.add_argument("--port",       type=int,default=7842)
    parser.add_argument("--no-browser", action="store_true")
    parser.add_argument("--verbose",    action="store_true")
    parser.add_argument("--host",       default="0.0.0.0")
    args=parser.parse_args()
    vault_path=Path(args.vault).expanduser().resolve()
    ZKHandler.vault=VaultManager(vault_path); ZKHandler.verbose=args.verbose
    server=HTTPServer((args.host,args.port),ZKHandler)
    local_ip=get_local_ip()
    print(f"""
╔══════════════════════════════════════════════════════╗
║        ZETTELKASTEN VIM  —  Python Server v4         ║
╚══════════════════════════════════════════════════════╝
  Vault   : {vault_path}
  Lokaal  : http://localhost:{args.port}
  Netwerk : http://{local_ip}:{args.port}
  Logging : {"aan" if args.verbose else "uit  (--verbose)"}
  LLM     : ollama serve  +  ollama pull llama3  +  ollama pull llava
  Stop    : Ctrl+C
""")
    if not args.no_browser:
        threading.Timer(0.8,lambda:webbrowser.open(f"http://localhost:{args.port}")).start()
    try: server.serve_forever()
    except KeyboardInterrupt: print("\nServer gestopt.")

if __name__=="__main__": main()
