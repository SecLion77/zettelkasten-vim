#!/usr/bin/env python3
"""Zettelkasten VIM — Backend v4"""

import os, sys, json, base64, threading, webbrowser
import urllib.request, urllib.error, re
from pathlib import Path
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from urllib.parse import urlparse, unquote
import argparse

DEFAULT_VAULT = Path.home() / "Zettelkasten"
STATIC_DIR    = Path(__file__).parent / "static"
VENDOR_DIR    = STATIC_DIR / "vendor"
IMAGE_EXTS    = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}

# CDN-URLs (online modus)
CDN = {
    "FONT_LINKS": (
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '  <link href="https://cdn.jsdelivr.net/npm/hack-font@3/build/web/hack.css" rel="stylesheet">\n'
        '  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,300&display=swap" rel="stylesheet">'
    ),
    "PDFJS_SRC":     "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
    "PDFJS_WORKER":  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
    "REACT_SRC":     "https://unpkg.com/react@18/umd/react.production.min.js",
    "REACT_DOM_SRC": "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
}

# Lokale paden (offline modus)
LOCAL = {
    "FONT_LINKS": (
        '<link href="/vendor/hack.css" rel="stylesheet">\n'
        '  <link href="/vendor/dm-sans.css" rel="stylesheet">'
    ),
    "PDFJS_SRC":     "/vendor/pdf.min.js",
    "PDFJS_WORKER":  "/vendor/pdf.worker.min.js",
    "REACT_SRC":     "/vendor/react.production.min.js",
    "REACT_DOM_SRC": "/vendor/react-dom.production.min.js",
}

def render_index(offline: bool) -> bytes:
    """Laad index.html en vul @@PLACEHOLDER@@ variabelen in op basis van modus."""
    tpl = (STATIC_DIR / "index.html").read_text(encoding="utf-8")
    values = LOCAL if offline else CDN
    for key, val in values.items():
        tpl = tpl.replace(f"@@{key}@@", val)
    return tpl.encode("utf-8")
IMAGE_MIME    = {".jpg":"image/jpeg",".jpeg":"image/jpeg",".png":"image/png",
                 ".gif":"image/gif",".webp":"image/webp",".svg":"image/svg+xml"}

class VaultManager:
    def __init__(self, vault_path):
        self.vault      = vault_path
        self.notes_dir  = vault_path / "notes"
        self.pdf_dir    = vault_path / "pdfs"
        self.annot_dir  = vault_path / "annotations"
        self.images_dir = vault_path / "images"
        self.img_annot_file = vault_path / "annotations" / "_image_annotations.json"
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
            if p.name.startswith("_"): continue   # sla interne bestanden over
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

    def load_img_annotations(self):
        try:
            if self.img_annot_file.exists():
                d = json.loads(self.img_annot_file.read_text(encoding="utf-8"))
                return d if isinstance(d, list) else []
        except: pass
        return []

    def save_img_annotations(self, annotations):
        self.img_annot_file.write_text(
            json.dumps(annotations, ensure_ascii=False, indent=2), encoding="utf-8")

    # PDFs
    def list_pdfs(self):
        return [{"name":p.name,"size":p.stat().st_size,
                 "modified":datetime.fromtimestamp(p.stat().st_mtime).isoformat()}
                for p in sorted(self.pdf_dir.glob("*.pdf"),key=lambda x:x.stat().st_mtime,reverse=True)]
    def save_pdf(self, filename, data):
        safe="".join(c if c.isalnum() or c in "-_." else "_" for c in filename)
        (self.pdf_dir/safe).write_bytes(data); return safe
    def delete_pdf(self, filename):
        """Verwijder PDF-bestand + annotatie-bestand voor deze PDF."""
        deleted = {"pdf": False, "annotations": False}
        p = self.get_pdf_path(filename)
        if p and p.exists():
            p.unlink(); deleted["pdf"] = True
        annot_file = self._annot_path(filename)
        if annot_file.exists():
            annot_file.unlink(); deleted["annotations"] = True
        # Verwijder ook uit gecombineerde annotaties (andere PDF-bestanden)
        all_annots = self.load_annotations()
        filtered   = [a for a in all_annots if a.get("file") != filename]
        if len(filtered) != len(all_annots):
            self.save_annotations(filtered)
            deleted["annotations"] = True
        return deleted
    def get_pdf_path(self, filename):
        p=self.pdf_dir/filename; return p if p.exists() else None
    def extract_pdf_text(self, filename, max_chars=12000):
        """Extraheer tekst uit PDF — eerst puur stdlib, dan optionele packages."""
        p=self.get_pdf_path(filename)
        if not p: return ""

        # ── Methode 1: pure stdlib (zlib + struct) ────────────────────────────
        try:
            text = self._extract_pdf_stdlib(p.read_bytes(), max_chars)
            if len(text.strip()) > 100:
                return text
        except Exception: pass

        # ── Methode 2: pypdf (optioneel) ──────────────────────────────────────
        try:
            import pypdf
            reader=pypdf.PdfReader(str(p))
            text="\n\n".join(page.extract_text() or "" for page in reader.pages[:30])
            if len(text.strip())>100: return text[:max_chars]
        except Exception: pass

        # ── Methode 3: pdfminer (optioneel) ───────────────────────────────────
        try:
            from pdfminer.high_level import extract_text as pm
            return (pm(str(p),maxpages=20) or "")[:max_chars]
        except Exception: pass
        return ""

    def _extract_pdf_stdlib(self, data: bytes, max_chars=12000) -> str:
        """Verbeterde pure-Python PDF tekst extractie — geen externe packages nodig.
        Ondersteunt FlateDecode streams, Tj/TJ operatoren, ToUnicode CMap, UTF-16BE."""
        import zlib, re as _re

        def decode_str(raw):
            buf, i = [], 0
            while i < len(raw):
                if raw[i] == chr(92) and i+1 < len(raw):
                    c = raw[i+1]
                    if c.isdigit():
                        j = i+1
                        while j < i+4 and j < len(raw) and raw[j].isdigit(): j += 1
                        buf.append(chr(int(raw[i+1:j], 8) & 0xFF)); i = j; continue
                    buf.append({'n':'\n','r':'\r','t':'\t','b':'\x08','f':'\x0c',
                                '(':')',')':")",'\\\\':chr(92)}.get(c, c))
                    i += 2
                else:
                    buf.append(raw[i]); i += 1
            s = ''.join(buf)
            if len(s) >= 2 and s[0] == chr(0xFE) and s[1] == chr(0xFF):
                try: return s[2:].encode('latin-1').decode('utf-16-be', errors='replace')
                except: pass
            try:
                b = s.encode('latin-1')
                try: return b.decode('utf-8')
                except: return b.decode('latin-1', errors='replace')
            except: return s

        def inflate(raw):
            for w in (15, -15, 47):
                try: return zlib.decompress(raw, w)
                except: pass
            return raw

        def parse_cmap(txt):
            m = {}
            for blk in _re.findall(r'beginbfchar(.*?)endbfchar', txt, _re.DOTALL):
                for x in _re.finditer(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', blk):
                    try: m[int(x.group(1),16)] = chr(int(x.group(2),16))
                    except: pass
            for blk in _re.findall(r'beginbfrange(.*?)endbfrange', txt, _re.DOTALL):
                for x in _re.finditer(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', blk):
                    try:
                        s,e,u = int(x.group(1),16),int(x.group(2),16),int(x.group(3),16)
                        for o in range(e-s+1): m[s+o] = chr(u+o)
                    except: pass
            return m

        def apply_cmap(s, cm):
            if not cm: return s
            out, i = [], 0
            while i < len(s):
                if i+1 < len(s):
                    c2 = (ord(s[i]) << 8) | ord(s[i+1])
                    if c2 in cm: out.append(cm[c2]); i += 2; continue
                c = ord(s[i])
                out.append(cm.get(c, s[i] if (32 <= c < 127 or c > 160) else ''))
                i += 1
            return ''.join(out)

        obj_re    = _re.compile(rb'(\d+)\s+\d+\s+obj\s*(.*?)\s*endobj', _re.DOTALL)
        stream_re = _re.compile(rb'stream\r?\n(.*?)\r?\nendstream', _re.DOTALL)
        objs = list(obj_re.finditer(data))

        # Pass 1 — CMap objecten verzamelen
        cmaps = {}
        for m in objs:
            ob = m.group(2); sm = stream_re.search(ob)
            if not sm: continue
            raw = sm.group(1)
            if b'FlateDecode' in ob[:sm.start()]: raw = inflate(raw)
            try: txt = raw.decode('latin-1', errors='replace')
            except: continue
            if 'beginbfchar' in txt or 'beginbfrange' in txt:
                cmaps[int(m.group(1))] = parse_cmap(txt)
        cmap0 = next(iter(cmaps.values())) if cmaps else {}

        # Pass 2 — tekst extraheren
        parts = []
        for m in objs:
            ob = m.group(2); sm = stream_re.search(ob)
            if not sm: continue
            raw = sm.group(1)
            if b'FlateDecode' in ob[:sm.start()]: raw = inflate(raw)
            try: dec = raw.decode('latin-1', errors='replace')
            except: continue
            for bt in _re.findall(r'BT(.*?)ET', dec, _re.DOTALL):
                bp = []
                for tj in _re.finditer(r'\(([^)]*(?:\\.[^)]*)*)\)\s*(?:Tj|\'|")', bt):
                    s = apply_cmap(decode_str(tj.group(1)), cmap0)
                    if s.strip(): bp.append(s)
                for tj in _re.finditer(r'\[(.*?)\]\s*TJ', bt, _re.DOTALL):
                    seg = []
                    for p in _re.finditer(r'\(([^)]*(?:\\.[^)]*)*)\)', tj.group(1)):
                        s = apply_cmap(decode_str(p.group(1)), cmap0)
                        if s.strip(): seg.append(s)
                        nums = _re.findall(r'(-?\d+\.?\d*)', tj.group(1)[p.end():p.end()+8])
                        if nums and float(nums[0]) < -100: seg.append(' ')
                    bp.append(''.join(seg))
                if bp: parts.append(' '.join(bp))
            parts.append('\n')
            if sum(len(x) for x in parts) > max_chars * 2: break

        result = '\n'.join(parts)
        result = _re.sub(r'[ \t]{3,}', '  ', result)
        result = _re.sub(r'\n{4,}', '\n\n\n', result)
        return result.strip()[:max_chars]

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
        if p and p.exists(): p.unlink()
        # Verwijder ook annotaties van deze afbeelding
        current = self.load_img_annotations()
        filtered = [a for a in current if a.get("file") != filename]
        if len(filtered) != len(current):
            self.save_img_annotations(filtered)
        return True
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
    def save_config(self, data):
        cfg = self.get_config(); cfg.update(data)
        self._write_json(self.config_file, cfg)

    # Externe PDF-mappen (opgeslagen in config)
    def get_ext_pdf_dirs(self):
        return self.get_config().get("ext_pdf_dirs", [])
    def set_ext_pdf_dirs(self, dirs):
        self.save_config({"ext_pdf_dirs": [str(d) for d in dirs]})

    def scan_ext_pdfs(self):
        """Geeft lijst van alle PDF-bestanden in de geconfigureerde externe mappen."""
        result = []
        for d in self.get_ext_pdf_dirs():
            p = Path(d)
            if not p.is_dir(): continue
            for pdf in sorted(p.rglob("*.pdf"))[:200]:  # max 200 per map
                result.append({"name": pdf.name, "path": str(pdf),
                                "dir": str(p), "size": pdf.stat().st_size})
        return result

    def extract_pdf_text_from_path(self, abs_path: str, max_chars=8000) -> str:
        """Extraheer tekst uit een PDF op een absoluut pad (buiten de vault)."""
        p = Path(abs_path)
        if not p.exists() or not p.is_file(): return ""
        try:
            text = self._extract_pdf_stdlib(p.read_bytes(), max_chars)
            if len(text.strip()) > 100: return text
        except Exception: pass
        try:
            import pypdf
            reader = pypdf.PdfReader(str(p))
            text = "\n\n".join(page.extract_text() or "" for page in reader.pages[:30])
            if len(text.strip()) > 100: return text[:max_chars]
        except Exception: pass
        try:
            from pdfminer.high_level import extract_text as pm
            return (pm(str(p), maxpages=20) or "")[:max_chars]
        except Exception: pass
        return ""

    def extract_pdf_pages(self, filename) -> list:
        """Extraheer tekst per pagina uit vault-PDF. Geeft lijst van {page, lines, text}."""
        p = self.get_pdf_path(filename)
        if not p: return []
        data = p.read_bytes()
        return self._parse_pdf_pages(data)

    def extract_pdf_pages_from_path(self, abs_path: str) -> list:
        """Extraheer tekst per pagina uit een PDF op absoluut pad."""
        p = Path(abs_path)
        if not p.exists(): return []
        data = p.read_bytes()
        return self._parse_pdf_pages(data)

    def _parse_pdf_pages(self, data: bytes) -> list:
        """Pure-stdlib per-pagina PDF extractie. Geeft [{page, text, lines:[str]}]."""
        import zlib, re as _re

        def decode_str(raw):
            buf, i = [], 0
            while i < len(raw):
                if raw[i] == chr(92) and i+1 < len(raw):
                    c = raw[i+1]
                    if c.isdigit():
                        j = i+1
                        while j < i+4 and j < len(raw) and raw[j].isdigit(): j += 1
                        buf.append(chr(int(raw[i+1:j], 8) & 0xFF)); i = j; continue
                    buf.append({'n':'\n','r':'\r','t':'\t','b':'\x08','f':'\x0c',
                                '(':')',')':")",'\\\\':chr(92)}.get(c, c))
                    i += 2
                else:
                    buf.append(raw[i]); i += 1
            s = ''.join(buf)
            if len(s) >= 2 and s[0] == chr(0xFE) and s[1] == chr(0xFF):
                try: return s[2:].encode('latin-1').decode('utf-16-be', errors='replace')
                except: pass
            try:
                b = s.encode('latin-1')
                try: return b.decode('utf-8')
                except: return b.decode('latin-1', errors='replace')
            except: return s

        def inflate(raw):
            for w in (15, -15, 47):
                try: return zlib.decompress(raw, w)
                except: pass
            return raw

        def parse_cmap(txt):
            m = {}
            for blk in _re.findall(r'beginbfchar(.*?)endbfchar', txt, _re.DOTALL):
                for x in _re.finditer(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', blk):
                    try: m[int(x.group(1),16)] = chr(int(x.group(2),16))
                    except: pass
            for blk in _re.findall(r'beginbfrange(.*?)endbfrange', txt, _re.DOTALL):
                for x in _re.finditer(r'<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>', blk):
                    try:
                        s,e,u = int(x.group(1),16),int(x.group(2),16),int(x.group(3),16)
                        for o in range(e-s+1): m[s+o] = chr(u+o)
                    except: pass
            return m

        def apply_cmap(s, cm):
            if not cm: return s
            out, i = [], 0
            while i < len(s):
                if i+1 < len(s):
                    c2 = (ord(s[i]) << 8) | ord(s[i+1])
                    if c2 in cm: out.append(cm[c2]); i += 2; continue
                c = ord(s[i])
                out.append(cm.get(c, s[i] if (32 <= c < 127 or c > 160) else ''))
                i += 1
            return ''.join(out)

        obj_re    = _re.compile(rb'(\d+)\s+\d+\s+obj\s*(.*?)\s*endobj', _re.DOTALL)
        stream_re = _re.compile(rb'stream\r?\n(.*?)\r?\nendstream', _re.DOTALL)
        page_re   = _re.compile(rb'/Type\s*/Page\b')
        objs = list(obj_re.finditer(data))

        # Pass 1 — CMap
        cmaps = {}
        for m in objs:
            ob = m.group(2); sm = stream_re.search(ob)
            if not sm: continue
            raw = sm.group(1)
            if b'FlateDecode' in ob[:sm.start()]: raw = inflate(raw)
            try: txt = raw.decode('latin-1', errors='replace')
            except: continue
            if 'beginbfchar' in txt or 'beginbfrange' in txt:
                cmaps[int(m.group(1))] = parse_cmap(txt)
        cmap0 = next(iter(cmaps.values())) if cmaps else {}

        # Pass 2 — per-pagina tekst. We groeperen content-streams op /Page objecten.
        # Simpele heuristiek: elke 'q...Q' of 'BT...ET' blok die een significante
        # tekstsprong heeft (Td/TD/Tm reset) telt als nieuwe sectie.
        # Voor pagina-toewijzing: tel /Type /Page objecten in volgorde en
        # wijs opeenvolgende content-streams toe.
        page_obj_ids = []
        for m in objs:
            ob = m.group(2)
            if page_re.search(ob[:512]):
                page_obj_ids.append(int(m.group(1)))

        # Fallback: als geen /Page objecten gevonden → alles als pagina 1
        if not page_obj_ids:
            all_text = []
            for m in objs:
                ob = m.group(2); sm = stream_re.search(ob)
                if not sm: continue
                raw = sm.group(1)
                if b'FlateDecode' in ob[:sm.start()]: raw = inflate(raw)
                try: dec = raw.decode('latin-1', errors='replace')
                except: continue
                for bt in _re.findall(r'BT(.*?)ET', dec, _re.DOTALL):
                    bp = []
                    for tj in _re.finditer(r'\(([^)]*(?:\\.[^)]*)*)\)\s*(?:Tj|\'|")', bt):
                        s2 = apply_cmap(decode_str(tj.group(1)), cmap0)
                        if s2.strip(): bp.append(s2)
                    for tj in _re.finditer(r'\[(.*?)\]\s*TJ', bt, _re.DOTALL):
                        seg = []
                        for pp in _re.finditer(r'\(([^)]*(?:\\.[^)]*)*)\)', tj.group(1)):
                            s2 = apply_cmap(decode_str(pp.group(1)), cmap0)
                            if s2.strip(): seg.append(s2)
                        bp.append(''.join(seg))
                    if bp: all_text.extend(bp)
            txt = ' '.join(all_text)
            lines = [l.strip() for l in txt.splitlines() if l.strip()]
            return [{"page":1,"text":txt,"lines":lines}]

        # Haal /Contents referenties op per Page object
        contents_re = _re.compile(rb'/Contents\s*\[([^\]]+)\]|/Contents\s+(\d+)\s+\d+\s+R')
        obj_by_id = {int(m.group(1)): m for m in objs}

        def stream_text(obj_id):
            m = obj_by_id.get(obj_id)
            if not m: return ""
            ob = m.group(2); sm = stream_re.search(ob)
            if not sm: return ""
            raw = sm.group(1)
            if b'FlateDecode' in ob[:sm.start()]: raw = inflate(raw)
            try: dec = raw.decode('latin-1', errors='replace')
            except: return ""
            parts2 = []
            for bt in _re.findall(r'BT(.*?)ET', dec, _re.DOTALL):
                bp = []
                for tj in _re.finditer(r'\(([^)]*(?:\\.[^)]*)*)\)\s*(?:Tj|\'|")', bt):
                    s2 = apply_cmap(decode_str(tj.group(1)), cmap0)
                    if s2.strip(): bp.append(s2)
                for tj in _re.finditer(r'\[(.*?)\]\s*TJ', bt, _re.DOTALL):
                    seg = []
                    for pp in _re.finditer(r'\(([^)]*(?:\\.[^)]*)*)\)', tj.group(1)):
                        s2 = apply_cmap(decode_str(pp.group(1)), cmap0)
                        if s2.strip(): seg.append(s2)
                        nums2 = _re.findall(r'(-?\d+\.?\d*)', tj.group(1)[pp.end():pp.end()+8])
                        if nums2 and float(nums2[0]) < -100: seg.append(' ')
                    bp.append(''.join(seg))
                if bp: parts2.extend(bp)
            return ' '.join(parts2)

        pages = []
        for page_num, pid in enumerate(page_obj_ids, 1):
            m = obj_by_id.get(pid)
            if not m:
                pages.append({"page": page_num, "text": "", "lines": []}); continue
            ob = m.group(2)
            cm = contents_re.search(ob)
            page_text = ""
            if cm:
                if cm.group(1):  # array
                    ids = [int(x) for x in _re.findall(rb'(\d+)\s+\d+\s+R', cm.group(1))]
                    page_text = ' '.join(stream_text(i) for i in ids)
                elif cm.group(2):
                    page_text = stream_text(int(cm.group(2)))
            if not page_text.strip():
                # Fallback: neem object erna als content
                page_text = stream_text(pid + 1)
            page_text = _re.sub(r'[ \t]{3,}', '  ', page_text)
            page_text = _re.sub(r'\n{3,}', '\n\n', page_text)
            lines = [l.strip() for l in page_text.splitlines() if l.strip()]
            pages.append({"page": page_num, "text": page_text.strip(), "lines": lines})

        return pages

    # ── PDF-tekst cache (per server-sessie) ─────────────────────────────────
    _pdf_page_cache: dict = {}

    def _cached_pdf_pages(self, fname: str) -> list:
        """extract_pdf_pages met mtime-gebaseerde cache."""
        pdf_path = self.get_pdf_path(fname)
        if not pdf_path:
            return []
        try:
            mtime = pdf_path.stat().st_mtime
        except OSError:
            return []
        key = (fname, mtime)
        if key not in VaultManager._pdf_page_cache:
            try:
                VaultManager._pdf_page_cache[key] = self.extract_pdf_pages(fname)
            except Exception:
                VaultManager._pdf_page_cache[key] = []
            # Houdt cache klein: max 30 PDFs
            if len(VaultManager._pdf_page_cache) > 30:
                oldest = next(iter(VaultManager._pdf_page_cache))
                del VaultManager._pdf_page_cache[oldest]
        return VaultManager._pdf_page_cache[key]

    def fuzzy_search(self, query: str, max_results=80) -> list:
        """FZF-stijl fuzzy zoeken over notities én vault-PDFs.

        Scoring (hoog = beter):
          500+ exacte phrase in titel
          300+ exacte phrase in body/paginalijn
          200   alle tokens aaneengesloten aanwezig
          100+  fuzzy karakter-voor-karakter volgorde match (bonus voor contiguïteit)
           50   tagmatch
        Resultaten: gesorteerd op score, PDF-hits gededupliceerd per (bestand, pagina).
        """
        import re as _re

        q = query.strip().lower()
        if not q:
            return []

        # Splits op spaties: elk token moet matchen (AND-logica)
        tokens = [t for t in q.split() if t]

        # ── Fuzzy-score voor één token op één regel ──────────────────────────
        def fuzzy_score_token(tok: str, line: str) -> int:
            """Geeft score >= 0 als tok fuzzy matcht in line, anders -1.
            Hogere score = betere match (exacte substring >> fuzzy spread).
            """
            if not tok:
                return 0
            # Exacte substring
            idx = line.find(tok)
            if idx >= 0:
                return 300 + max(0, 100 - idx)   # vroeg in de regel = bonus
            # Fuzzy: elk karakter van tok moet in volgorde in line voorkomen
            ti, li = 0, 0
            first_match = -1
            last_match  = -1
            consecutive = 0
            prev_match  = -1
            while ti < len(tok) and li < len(line):
                if tok[ti] == line[li]:
                    if first_match < 0:
                        first_match = li
                    if prev_match >= 0 and li == prev_match + 1:
                        consecutive += 1
                    last_match = li
                    prev_match = li
                    ti += 1
                li += 1
            if ti < len(tok):
                return -1   # niet alle chars gevonden
            spread = last_match - first_match + 1
            # Score: beloon korte spread + vroege positie + aaneengesloten
            score = max(0, 80 - spread) + max(0, 40 - first_match) + consecutive * 10
            return score if score > 0 else 1

        def score_text(text: str, toks: list) -> int:
            """Score een stuk tekst (1 regel of titel). -1 = geen match."""
            ll = text.lower()
            # Alle tokens moeten matchen
            token_scores = []
            for tok in toks:
                ts = fuzzy_score_token(tok, ll)
                if ts < 0:
                    return -1
                token_scores.append(ts)
            # Bonus voor exacte volledige phrase
            phrase = ' '.join(toks)
            phrase_bonus = 200 if phrase in ll else 0
            return sum(token_scores) + phrase_bonus

        results = []

        # ── 1. Notities ───────────────────────────────────────────────────────
        for note in self.load_notes():
            title   = note.get("title", "") or ""
            content = note.get("content", "") or ""
            tags    = note.get("tags", []) or []
            lines   = (title + "\n" + content).splitlines()

            best_score   = -1
            best_line_no = 0
            best_excerpt = ""

            # Titel krijgt extra gewicht
            title_score = score_text(title, tokens)
            if title_score >= 0:
                best_score   = title_score + 200   # titel-bonus
                best_line_no = 1
                best_excerpt = title

            # Tag-match
            tag_str = " ".join(tags)
            tag_score = score_text(tag_str, tokens) if tags else -1
            if tag_score >= 0 and tag_score + 50 > best_score:
                best_score   = tag_score + 50
                best_line_no = 1
                best_excerpt = "Tags: " + ", ".join(tags)

            # Doorzoek regels
            for ln_idx, line in enumerate(lines, 1):
                if not line.strip():
                    continue
                sc = score_text(line, tokens)
                if sc > best_score:
                    best_score   = sc
                    best_line_no = ln_idx
                    ctx_s = max(0, ln_idx - 2)
                    ctx_e = min(len(lines), ln_idx + 2)
                    best_excerpt = '\n'.join(l for l in lines[ctx_s:ctx_e] if l.strip())

            if best_score >= 0:
                results.append({
                    "type":    "note",
                    "id":      note.get("id"),
                    "title":   title or "(geen titel)",
                    "tags":    tags,
                    "score":   best_score,
                    "line":    best_line_no,
                    "excerpt": best_excerpt[:300],
                    "content": content,
                })

        # ── 2. Vault PDFs (met cache) ─────────────────────────────────────────
        for pdf_info in self.list_pdfs():
            fname = pdf_info["name"]
            pages = self._cached_pdf_pages(fname)

            # Beste hit per (bestand, pagina) voor deduplicatie
            best_per_page: dict = {}

            for pg in pages:
                page_num = pg["page"]
                pg_lines = pg.get("lines", [])

                for ln_idx, line in enumerate(pg_lines, 1):
                    if not line.strip():
                        continue
                    sc = score_text(line, tokens)
                    if sc < 0:
                        continue
                    pg_key = (fname, page_num)
                    if pg_key not in best_per_page or sc > best_per_page[pg_key]["score"]:
                        ctx_s   = max(0, ln_idx - 2)
                        ctx_e   = min(len(pg_lines), ln_idx + 2)
                        excerpt = '\n'.join(
                            l for l in pg_lines[ctx_s:ctx_e] if l.strip()
                        )
                        best_per_page[pg_key] = {
                            "type":    "pdf",
                            "source":  fname,
                            "score":   sc,
                            "page":    page_num,
                            "line":    ln_idx,
                            "excerpt": excerpt[:300],
                            "title":   f"{fname}  —  p.{page_num}",
                        }

            results.extend(best_per_page.values())

        results.sort(key=lambda x: -x["score"])
        return results[:max_results]

    # ── Spell engine (singleton, lazy-loaded per taal) ──────────────────────────
    _spell_cache: dict = {}     # {"en": set(...), "nl": set(...)}
    _spell_lock = None

    @classmethod
    def _get_lock(cls):
        import threading
        if cls._spell_lock is None:
            cls._spell_lock = threading.Lock()
        return cls._spell_lock

    @classmethod
    def _load_hunspell(cls, dic_path: str, aff_path: str) -> set:
        """Laad een Hunspell .dic/.aff bestand en genereer alle woordvormen via suffix-regels."""
        import re as _re
        sfx = {}
        try:
            with open(aff_path, encoding="utf-8", errors="replace") as f:
                lines = f.readlines()
            i = 0
            while i < len(lines):
                m = _re.match(r"^(SFX)\s+(\S+)\s+[YN]\s+(\d+)", lines[i].strip())
                if m:
                    flag, n = m.group(2), int(m.group(3))
                    rules = []
                    for j in range(1, n + 1):
                        if i + j < len(lines):
                            rm = _re.match(r"^SFX\s+\S+\s+(\S+)\s+(\S+)\s+(\S+)",
                                           lines[i + j].strip())
                            if rm:
                                s, a, c = rm.group(1), rm.group(2), rm.group(3)
                                rules.append(("" if s == "0" else s,
                                              "" if a == "0" else a, c))
                    sfx[flag] = rules
                    i += n + 1; continue
                i += 1
        except Exception:
            pass
        words = set()
        try:
            with open(dic_path, encoding="utf-8", errors="replace") as f:
                next(f, None)
                for line in f:
                    line = line.strip()
                    if not line: continue
                    word  = line.split("/")[0].lower()
                    flags = line.split("/")[1] if "/" in line else ""
                    words.add(word)
                    for flag in flags:
                        for s, a, c in sfx.get(flag, []):
                            try:
                                check = word[:-len(s)] if s and word.endswith(s) else word
                                if not check: continue
                                if c == "." or _re.search(c + "$", check):
                                    words.add(check + a)
                            except Exception:
                                pass
        except Exception:
            pass
        return words

    @classmethod
    def _nl_builtin_words(cls) -> set:
        """Ingebakken Nederlandse basiswoordenlijst met morfologie-expansie."""
        import re as _re
        BASE = (
            "aan aanbieden aanbod aandacht aandeel aanpak aanpassen aanwezig aard achter "
            "achtergrond actie actueel adres afbeelding afdeling afgelopen afhangen afmaken "
            "afstand afstemmen agenda algoritme algemeen alleen ander anders antwoord argument "
            "aspect augustus automatisch auto avond baan bedoeling beeld begrijpen belang "
            "belangrijk beleid bereiken beschikbaar beschrijven bespreken bestand bestuur "
            "betrekking bewust bijdrage bijlage bijzonder boek bron buiten bureau "
            "categorie code combinatie commercieel communicatie component conclusie conditie "
            "configuratie context contract controle dagelijks data datum december definitie "
            "detail digitaal doel document doorlopend duidelijk effect effectief efficient "
            "element evaluatie factor fout framework functie gebruik gebruiken gedachte gelijk "
            "gevaar gegevens gezond goed groep groot hardware historisch hoofd hypothese idee "
            "implementatie informatie integratie intern inzicht jaar januari juli juni kennis "
            "keuze kiezen koppeling kwaliteit later leven link loopt maand manier maart meer "
            "mensen methode middel minder model module moment naam netwerk niveau normaal "
            "november object observatie oktober omgeving ondersteuning ontwerp ontwikkelen "
            "oplossing organisatie overzicht pagina parameter periode perspectief plan positief "
            "prioriteit principe probleem proces programma protocol punt recente realiseren "
            "resultaat richting rol samenwerking schema scope sectie server situatie sleutel "
            "soort specifiek sport start structuur systeem taak technisch tekst termijn "
            "theorie tijd toelichting toepassing type uitvoeren uiteindelijk validatie "
            "versie verwachting via voorstel voorbeeld vraag waarde werkwijze wetenschap "
            "zoekopdracht "
            "de het een en van in is dat dit met op aan voor uit door ook naar toe zo nu ja nee "
            "ik je jij hij zij ze we hen hun hem zijn haar ons onze jullie "
            "aan bij door in met na naar om op over te tegen tot voor via zonder "
            "achter beneden binnen boven buiten langs naast "
            "die welke waar wanneer hoe wie wat waarom waardoor waarvoor "
            "dan als of want omdat zodat tenzij totdat voordat nadat hoewel "
            "maar toch ook wel nog altijd nooit soms even zeker misschien echter bovendien "
            "al erg heel zeer vrij nogal bijna reeds toen thans steeds dus "
            "gaan gaat ging gegaan komen komt kwam worden wordt werd hebben heeft had "
            "kunnen kan kon moeten moet moest mogen mag mocht willen wil wilde "
            "zullen zal zou laten laat liet zien ziet zag doen doet deed "
            "nemen neemt nam geven geeft gaf staan staat stond liggen ligt lag "
            "lopen loopt liep werken werkt werkte schrijven schrijft schreef "
            "lezen leest las spreken spreekt sprak beginnen begint begon "
            "stoppen stopt vragen vraagt vroeg antwoorden helpen helpt hielp "
            "zoeken zoekt zocht vinden vindt vond kennen kent weten weet denken denkt "
            "hopen hoopt verwachten probeert gebruiken maakt bouwen bouwt kiezen "
            "groot goede slechte nieuwe oude eerste tweede laatste volgende "
            "hoge lage lange korte brede dikke zware lichte snelle langzame "
            "mooie sterke harde zachte warme koude rustige stille vrolijke "
            "academisch administratief beschikbaar complex digitaal effectief "
            "extern functioneel historisch informatief intern logisch operationeel "
            "organisatorisch technisch transparant verantwoordelijk wetenschappelijk"
        )
        base_words = set(w.strip(",.;:!?()-").lower() for w in BASE.split() if len(w.strip()) >= 2)
        expanded = set(base_words)
        sfxs = ["en", "s", "de", "te", "je", "lijk", "heid", "ing", "er", "e", "ste", "jes"]
        for w in list(base_words):
            if len(w) >= 3:
                for a in sfxs:
                    expanded.add(w + a)
                if w.endswith("e"):
                    for a in sfxs:
                        expanded.add(w[:-1] + a)
                if w.endswith("en"):
                    expanded.add(w[:-2] + "de")
                    expanded.add(w[:-2] + "te")
                    expanded.add(w[:-2] + "er")
        return expanded

    @classmethod
    def _ensure_spell(cls, lang: str, vault_dir=None):
        """Laad en cache woordenlijst voor taal (eenmalig per server-run).

        Zoekpaden per taal — in volgorde van prioriteit:
          0. static/vendor/dict/   — ingebakken in de app (via download-dictionaries.sh)
          1. vault_dir/<lang>.dic  — eigen woordenlijst in vault
          2. /opt/homebrew/share/hunspell/
          3. LibreOffice bundled   — /Applications/LibreOffice.app/...
          4. /usr/share/hunspell/  — Linux systeem
          5. /usr/share/myspell/   — oudere Linux distro's
          6. Ingebakken fallback   — _nl_builtin_words() (alleen NL)
        """
        with cls._get_lock():
            if lang in cls._spell_cache:
                return
            from pathlib import Path as _P
            import glob as _glob

            # ── Pad naar static/vendor/dict/ (naast server.py) ──────────────
            _server_dir = _P(__file__).parent
            _vendor_dict = _server_dir / "static" / "vendor" / "dict"

            words = set()
            if lang == "en":
                candidates = [
                    str(_vendor_dict / "en_US.dic"),          # 0. ingebakken in app
                    "/opt/homebrew/share/hunspell/en_US.dic", # 2. Homebrew
                    "/usr/share/hunspell/en_US.dic",          # 4. Linux
                    "/usr/share/myspell/en_US.dic",           # 5. oudere Linux
                ]
                for lo in _glob.glob("/Applications/LibreOffice*.app/Contents/Resources/extensions/dict-en/*/en_US.dic"):
                    candidates.insert(2, lo)                  # 3. LibreOffice Mac
                if vault_dir:
                    candidates.insert(1, str(_P(vault_dir) / "en_US.dic"))  # 1. vault
                for dic in candidates:
                    aff = dic.replace(".dic", ".aff")
                    if _P(dic).exists() and _P(aff).exists():
                        words = cls._load_hunspell(dic, aff)
                        print(f"[spell] EN geladen: {dic} ({len(words)} woorden)", flush=True)
                        break

            elif lang == "nl":
                candidates = [
                    str(_vendor_dict / "nl_NL.dic"),          # 0. ingebakken in app
                    "/opt/homebrew/share/hunspell/nl_NL.dic", # 2. Homebrew
                    str(_P.home() / "Library/Spelling/nl_NL.dic"),  # macOS user
                    "/Library/Spelling/nl_NL.dic",            # macOS systeem
                    "/usr/share/hunspell/nl_NL.dic",          # 4. Linux
                    "/usr/share/myspell/nl_NL.dic",           # 5. oudere Linux
                ]
                for lo in _glob.glob("/Applications/LibreOffice*.app/Contents/Resources/extensions/dict-nl/*/nl_NL.dic"):
                    candidates.insert(2, lo)                  # 3. LibreOffice Mac
                if vault_dir:
                    candidates.insert(1, str(_P(vault_dir) / "nl_NL.dic"))  # 1. vault
                loaded = False
                for dic in candidates:
                    aff = dic.replace(".dic", ".aff")
                    if _P(dic).exists() and _P(aff).exists():
                        words = cls._load_hunspell(dic, aff)
                        print(f"[spell] NL geladen: {dic} ({len(words)} woorden)", flush=True)
                        loaded = True
                        break
                if not loaded:
                    words = cls._nl_builtin_words()
                    print(
                        f"[spell] NL: geen woordenboek gevonden — gebruik ingebakken fallback "
                        f"({len(words)} woorden).\n"
                        f"         Tip: voer uit: cd static/vendor && bash download-dictionaries.sh",
                        flush=True
                    )
            cls._spell_cache[lang] = words

    @classmethod
    def _suggest(cls, word: str, wordset: set, max_n: int = 8) -> list:
        """Genereer spellingssuggesties via edit-distance 1 en 2."""
        import re as _re
        alphabet = "abcdefghijklmnopqrstuvwxyz"
        def edits1(w):
            splits  = [(w[:i], w[i:]) for i in range(len(w)+1)]
            deletes = [L+R[1:]       for L,R in splits if R]
            transposes=[L+R[1]+R[0]+R[2:] for L,R in splits if len(R)>1]
            replaces= [L+c+R[1:]    for L,R in splits if R for c in alphabet]
            inserts = [L+c+R        for L,R in splits       for c in alphabet]
            return set(deletes+transposes+replaces+inserts)
        candidates = edits1(word) & wordset
        if len(candidates) < max_n:
            for e1 in edits1(word):
                candidates |= edits1(e1) & wordset
        # Sorteer op overeenkomst met origineel (langere gemeenschappelijke prefix eerst)
        def score(c):
            common = sum(1 for a,b in zip(word,c) if a==b)
            return (-common, abs(len(c)-len(word)))
        return sorted(candidates, key=score)[:max_n]

    def spellcheck_words(self, words: list, lang: str = "en") -> dict:
        """Spellcheck via geladen Hunspell-woordenboek.
        Geeft {word: {"spell": bool, "grammar": None}}."""
        import re as _re
        VaultManager._ensure_spell(lang, vault_dir=str(self.vault))
        known = VaultManager._spell_cache.get(lang, set())
        # Vault-woorden zijn altijd correct (eigen termen, afkortingen)
        vault_ok: set = set()
        for note in self.load_notes():
            text = (note.get("title","") + " " + note.get("content","")).lower()
            for w in _re.findall(r"[a-zA-ZÀ-ɏ'\-]{2,}", text):
                vault_ok.add(w.strip("'-"))
        always_ok = _re.compile(
            r"^\d"
            r"|^[A-Z]{2,}$"
            r"|^[a-z]{1,2}$"
            r"|https?://"
            r"|\[\["
            r"|^@\w"
        )
        results = {}
        for raw in words:
            w = raw.strip("'-.,:!?;\"()[]{}").lower()
            if not w or len(w) < 2:
                results[raw] = {"spell": True, "grammar": None}; continue
            if always_ok.search(raw):
                results[raw] = {"spell": True, "grammar": None}; continue
            if any(c.isdigit() for c in w):
                results[raw] = {"spell": True, "grammar": None}; continue
            if raw[0].isupper():
                results[raw] = {"spell": True, "grammar": None}; continue
            if w in vault_ok or w in known:
                results[raw] = {"spell": True, "grammar": None}; continue
            # Fout: genereer suggesties via edit-distance
            sug = VaultManager._suggest(w, known | vault_ok, max_n=8)
            results[raw] = {"spell": False, "grammar": None, "suggestions": sug}
        return results


    def grammar_check_lines(self, lines: list, lang: str = "en") -> list:
        """Grammaticacontrole per regel via patroonherkenning.
        Geeft [{row, col, len, msg, type}] met type 'grammar' of 'style'."""
        import re as _re
        errors = []
        if lang == "en":
            patterns = [
                (r"\b(\w+)\s+\1\b",
                 "dubbel woord", "grammar"),
                (r"\ba ([aeiouAEIOU]\w)",
                 "gebruik \'an\' voor klinkerwoorden (a \u2192 an)", "grammar"),
                (r"\ban ([bcdfghjklmnpqrstvwxyzBCDFGHJKLMNPQRSTVWXYZ]\w)",
                 "gebruik \'a\' voor medeklinkerwoorden (an \u2192 a)", "grammar"),
                (r"\b(more|less|greater|fewer|better|worse|higher|lower)\s+then\b",
                 "\'then\' is tijdsvolgorde; bedoel je \'than\' (vergelijking)?", "grammar"),
                (r"\byour\s+(are|were|going|coming|doing|getting|being)\b",
                 "\'your\' is bezittelijk; bedoel je \'you\'re\' (you are)?", "grammar"),
                (r"\bits\s+(a|an|the|very|quite|really|so|too)\b",
                 "\'its\' is bezittelijk; bedoel je \'it\'s\' (it is)?", "grammar"),
                (r"\btheir\s+(is|are|was|were|will|would)\b",
                 "bedoel je \'there\' of \'they\'re\'?", "grammar"),
                (r"\b(he|she|it)\s+(have|do|go|come|run|make|take|get)\b",
                 "derde persoon enkelvoud mist -s (has/does/goes/comes...)", "grammar"),
                (r"\bcould of\b|\bwould of\b|\bshould of\b",
                 "gebruik \'could/would/should have\', niet \'of\'", "grammar"),
            ]
        else:  # nl
            patterns = [
                (r"\b(\w+)\s+\1\b",
                 "dubbel woord", "grammar"),
                (r"\b(hij|zij|ze|het|jij|u)\s+(word|vind|houd|gebruik|verwacht|krijg|stop|begin)\b",
                 "dt-fout: derde persoon enkelvoud vereist -t (wordt/vindt/houdt\u2026)", "grammar"),
                (r"\bword\s+(door|niet|ook|wel|snel|vaak|al|nu|dan|hier|daar)\b",
                 "dt-fout: \'word\' \u2192 \'wordt\' (derde persoon enkelvoud)", "grammar"),
                (r"\bhun\s+(is|zijn|heeft|hebben|was|waren|loopt|werkt|gaat|doet|zegt)\b",
                 "\'hun\' als onderwerp is incorrect; gebruik \'zij\'", "grammar"),
                (r"\bhen\s+(is|zijn|heeft|hebben|was|waren)\b",
                 "\'hen\' als onderwerp is incorrect; gebruik \'zij\'", "grammar"),
                (r"\bhet\s+(man|vrouw|jongen|tafel|stoel|straat|stad|dag|nacht|school|kerk)\b",
                 "lidwoordfout: waarschijnlijk \'de\' in plaats van \'het\'", "grammar"),
                (r"\bde\s+(kind|boek|huis|woord|ding|getal|deel|recht|systeem|begin|einde|doel)\b",
                 "lidwoordfout: waarschijnlijk \'het\' in plaats van \'de\'", "grammar"),
                (r"\b(niet|nooit|niemand|nergens|niets)\b.{1,40}\b(niet|nooit|niemand|nergens|niets)\b",
                 "mogelijke dubbele ontkenning", "grammar"),
                (r"\bals\b.{1,40}\bals\b",
                 "tip: gebruik \'als\u2026dan\' bij voorwaardelijke zinnen", "style"),
            ]
        for row, line in enumerate(lines):
            for pat, msg, etype in patterns:
                for m in _re.finditer(pat, line, _re.IGNORECASE):
                    errors.append({
                        "row": row, "col": m.start(),
                        "len": m.end() - m.start(),
                        "msg": msg, "type": etype,
                    })
        return errors

    def _write_json(self, path, data):
        path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
    @property
    def path_str(self): return str(self.vault)


class ZKHandler(BaseHTTPRequestHandler):
    vault:   VaultManager = None
    verbose: bool         = False
    offline: bool         = False

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
        if p=="/api/notes":            return self._send(200,self.vault.load_notes())
        if p=="/api/annotations":      return self._send(200,self.vault.load_annotations())
        if p=="/api/img-annotations":  return self._send(200,self.vault.load_img_annotations())
        if p=="/api/pdfs":             return self._send(200,self.vault.list_pdfs())
        if p=="/api/images":           return self._send(200,self.vault.list_images())
        if p=="/api/llm/models":  return self._llm_models()
        if p=="/api/config":      return self._send(200,{"vault_path":self.vault.path_str,"config":self.vault.get_config()})
        if p=="/api/ext-pdfs":     return self._send(200,{"dirs":self.vault.get_ext_pdf_dirs(),"files":self.vault.scan_ext_pdfs()})
        if p.startswith("/api/browse"):
            from urllib.parse import parse_qs, urlparse as _up
            qs = parse_qs(_up(self.path).query)
            dir_path = qs.get("path",[""])[0].strip()
            return self._send(200, self._browse(dir_path))
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
        # Statische bestanden — index.html via template (online/offline)
        if p == "/":
            return self._send(200, render_index(self.offline), "text/html")
        if p == "/app.js":
            fp = STATIC_DIR / "app.js"
            if fp.exists(): return self._send(200, fp.read_bytes(), "application/javascript")
        # Modules-bestanden (SOLID refactor — stap 1+)
        if p.startswith("/modules/"):
            rel = p[9:]  # strip /modules/
            fp = STATIC_DIR / "modules" / rel
            if fp.exists() and fp.suffix == ".js":
                return self._send(200, fp.read_bytes(), "application/javascript")
        # Vendor-bestanden (alleen beschikbaar in offline modus)
        if p.startswith("/vendor/"):
            rel = p[8:]  # strip /vendor/
            fp = VENDOR_DIR / rel
            if fp.exists():
                ext = fp.suffix.lower()
                mime = {"js":"application/javascript","css":"text/css",
                        "woff2":"font/woff2","woff":"font/woff"}.get(ext.lstrip("."), "application/octet-stream")
                return self._send(200, fp.read_bytes(), mime)
        return self._send(404,{"error":"Niet gevonden"})

    def do_POST(self):
        p=urlparse(self.path).path.rstrip("/")
        if p=="/api/search":
            body = self._body()
            q    = body.get("query","").strip()
            if not q: return self._send(200, {"results":[],"query":q})
            try:
                results = self.vault.fuzzy_search(q, max_results=80)
                return self._send(200, {"results": results, "query": q})
            except Exception as e:
                return self._send(500, {"error": str(e), "results": []})
        if p=="/api/spellcheck":
            # Accepteert {words:[str], lines:[str], lang:"en"|"nl"|"auto"}
            # Geeft terug: {spell:{word:{spell,grammar}}, grammar:[{row,col,len,msg,type}]}
            body  = self._body()
            words = body.get("words", [])
            lines = body.get("lines", [])
            lang  = body.get("lang", "en")
            if lang == "auto":
                # Automatische taaldetectie op basis van stopwoorden
                import re as _re
                text = " ".join(lines).lower()
                nl_score = len(_re.findall(r"\b(de|het|een|en|van|in|is|dat|dit|met|ik|je|we|ze|ook|aan|maar|voor|niet)\b", text))
                en_score = len(_re.findall(r"\b(the|and|for|that|with|this|are|was|have|from|they|will|been|not|can|but)\b", text))
                lang = "nl" if nl_score > en_score else "en"
            spell_results  = self.vault.spellcheck_words(words, lang)
            grammar_errors = self.vault.grammar_check_lines(lines, lang) if lines else []
            return self._send(200, {
                "spell":   spell_results,
                "grammar": grammar_errors,
                "lang":    lang,
            })
        if p=="/api/notes":
            return self._send(200,self.vault.save_note(self._body()))
        if p=="/api/annotations":
            a=self._body()
            if isinstance(a,list): self.vault.save_annotations(a); return self._send(200,{"ok":True})
            return self._send(400,{"error":"Verwacht een lijst"})
        if p=="/api/img-annotations":
            a=self._body()
            if isinstance(a,list): self.vault.save_img_annotations(a); return self._send(200,{"ok":True})
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
        if p=="/api/llm/improve-text":   return self._llm_improve_text()
        if p=="/api/llm/chat":           return self._llm_chat()
        if p=="/api/llm/summarize-pdf":  return self._llm_summarize_pdf()
        if p=="/api/llm/describe-image": return self._llm_describe_image()
        if p=="/api/llm/mindmap":        return self._llm_mindmap()
        if p=="/api/import-url":         return self._import_url()
        if p=="/api/ext-pdfs":
            dirs = self._body().get("dirs", [])
            self.vault.set_ext_pdf_dirs(dirs)
            return self._send(200, {"ok": True, "dirs": dirs})
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
        if p.startswith("/api/pdfs/"):
            fname=unquote(p[10:])
            result=self.vault.delete_pdf(fname)
            return self._send(200,{"ok":True,"filename":fname,**result})
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

    def _browse(self, path):
        """Bestandsverkenner: geeft inhoud van een map terug."""
        import os, platform
        if not path:
            # Roots: home + schijven afhankelijk van OS
            roots = []
            home = Path.home()
            roots.append({"name": "🏠 "+home.name, "path": str(home), "type": "dir"})
            if platform.system() == "Darwin":  # macOS
                volumes = Path("/Volumes")
                if volumes.exists():
                    for v in sorted(volumes.iterdir()):
                        if not v.name.startswith("."):
                            roots.append({"name": "💿 "+v.name, "path": str(v), "type": "dir"})
            elif platform.system() == "Linux":
                for r in ["/", "/mnt", "/media", "/home"]:
                    rp = Path(r)
                    if rp.exists() and str(rp) != str(home.parent):
                        roots.append({"name": "🖴 "+r, "path": r, "type": "dir"})
            elif platform.system() == "Windows":
                import string
                for letter in string.ascii_uppercase:
                    drive = Path(letter+":\\")
                    if drive.exists():
                        roots.append({"name": "💾 "+letter+":\\", "path": str(drive), "type": "dir"})
            return {"path": "", "parent": "", "items": roots, "is_root": True}

        p = Path(path)
        if not p.exists() or not p.is_dir():
            return {"error": "Pad niet gevonden: "+str(path), "path": path, "items": []}
        items = []
        try:
            import os, signal

            dirs, pdfs = [], []
            # Harde limiet: max 2 seconden, max 500 entries
            deadline = __import__("time").time() + 2.0
            with os.scandir(str(p)) as it:
                for e in it:
                    if __import__("time").time() > deadline:
                        break                        # stop bij timeout
                    if e.name.startswith("."): continue
                    try:
                        if e.is_dir(follow_symlinks=False):
                            dirs.append({"name": e.name, "path": e.path, "type": "dir"})
                        elif e.name.lower().endswith(".pdf"):
                            try: sz = e.stat(follow_symlinks=False).st_size
                            except: sz = 0
                            pdfs.append({"name": e.name, "path": e.path,
                                         "type": "pdf", "size": sz})
                    except (PermissionError, OSError):
                        pass
                    if len(dirs) + len(pdfs) >= 500:
                        break

            dirs.sort(key=lambda x: x["name"].lower())
            pdfs.sort(key=lambda x: x["name"].lower())
            items = dirs + pdfs

        except (PermissionError, OSError) as ex:
            return {"error": "Geen toegang: "+str(ex), "path": path, "items": []}
        parent = str(p.parent) if p.parent != p else ""
        return {"path": str(p), "parent": parent, "items": items}

    def _llm_improve_text(self):
        """Stuur tekst naar LLM voor taalverbetering."""
        body  = self._body()
        text  = body.get("text", "").strip()
        lang  = body.get("lang", "nl")
        model = body.get("model", "")
        if not text or not model:
            return self._send(400, {"error": "text en model zijn vereist"})
        lang_label = "Nederlands" if lang == "nl" else "English"
        prompt = (
            f"Je bent een taalkundige redacteur. Verbeter de volgende tekst in het {lang_label}. "
            f"Geef ALLEEN de verbeterde tekst terug, zonder uitleg, zonder commentaar, "
            f"zonder markdown-opmaak rondom de tekst zelf. "
            f"Behoud de oorspronkelijke structuur en alinea-indeling.\n\n"
            f"Originele tekst:\n{text}"
        )
        try:
            import urllib.request as _req, json as _json
            payload = _json.dumps({
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 800}
            }).encode()
            req = _req.Request(
                "http://localhost:11434/api/chat",
                data=payload, headers={"Content-Type": "application/json"}, method="POST"
            )
            with _req.urlopen(req, timeout=60) as r:
                data = _json.loads(r.read())
            improved = (data.get("message", {}).get("content", "") or "").strip()
            if not improved:
                return self._send(500, {"error": "Geen respons van LLM"})
            return self._send(200, {"improved": improved, "original": text})
        except Exception as e:
            return self._send(500, {"error": str(e)})

    def _llm_chat(self):
        body=self._body()
        model=body.get("model","llama3.2-vision")
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
        ctx_ext=body.get("context_ext_pdfs",[])
        if ctx_ext:
            for ep in ctx_ext[:6]:
                txt=self.vault.extract_pdf_text_from_path(ep,6000)
                name=Path(ep).name
                if txt.strip(): parts.append("## Extern PDF: "+name+"\n"+txt)
                else: parts.append("## Extern PDF: "+name+"\n(geen tekst extraheerbaar)")
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
        fname=body.get("filename",""); model=body.get("model","llama3.2-vision")
        if not fname: return self._send(400,{"error":"filename vereist"})

        # Probeer eerst tekstextractie
        text=self.vault.extract_pdf_text(fname,10000)

        # Als tekst beschikbaar: stuur als tekst-prompt
        if text.strip():
            prompt=("Maak een uitgebreide Nederlandstalige samenvatting in Markdown. "
                    "Gebruik headers (##), bullets (-) en bold (**tekst**). "
                    "Structuur: 1) Kernpunten, 2) Hoofdonderwerpen, 3) Conclusies.\n\n"
                    "--- PDF ---\n"+text+"\n--- EINDE ---")
            try:
                r=self._ollama_post("/api/generate",{"model":model,"prompt":prompt,"stream":False},180)
                return self._send(200,{"ok":True,"summary":r.get("response","").strip(),"filename":fname})
            except Exception as e:
                # Fallback: probeer zonder vision
                try:
                    r=self._ollama_post("/api/generate",{"model":"llama3.2-vision","prompt":prompt,"stream":False},180)
                    return self._send(200,{"ok":True,"summary":r.get("response","").strip(),"filename":fname})
                except Exception as e2:
                    return self._send(200,{"ok":False,"error":str(e2),"summary":""})

        # Geen tekst: probeer visuele samenvatting met eerste pagina als afbeelding
        img_data = self._pdf_first_page_image(fname)
        if img_data:
            prompt=("Dit is de eerste pagina van een PDF. "
                    "Maak een Nederlandstalige samenvatting in Markdown van wat je ziet. "
                    "Gebruik headers (##) en bullets (-).")
            try:
                r=self._ollama_post("/api/generate",
                    {"model":model,"prompt":prompt,"images":[img_data],"stream":False},120)
                return self._send(200,{"ok":True,"summary":r.get("response","").strip(),
                                       "filename":fname,"method":"vision"})
            except Exception as e:
                return self._send(200,{"ok":False,
                    "error":"Geen tekst extraheerbaar en vision mislukt: "+str(e),"summary":""})

        return self._send(200,{"ok":False,
            "error":"Geen tekst extraheerbaar uit dit PDF (mogelijk gescand/beveiligd)","summary":""})

    def _pdf_first_page_image(self, filename):
        """Render eerste PDF-pagina naar base64 PNG via stdlib (zonder PIL)."""
        try:
            import subprocess, tempfile, os
            pdf_path = self.get_pdf_path(filename)
            if not pdf_path: return None
            # Probeer pdftoppm (poppler, vaak aanwezig)
            with tempfile.TemporaryDirectory() as td:
                out = os.path.join(td, "page")
                r = subprocess.run(
                    ["pdftoppm","-r","120","-l","1","-png",str(pdf_path),out],
                    capture_output=True, timeout=15)
                if r.returncode == 0:
                    imgs = sorted([f for f in os.listdir(td) if f.endswith(".png")])
                    if imgs:
                        import base64
                        return base64.b64encode(open(os.path.join(td,imgs[0]),"rb").read()).decode()
        except Exception: pass
        return None

    def _llm_describe_image(self):
        body=self._body()
        fname=body.get("filename",""); model=body.get("model","llama3.2-vision")
        if not fname: return self._send(400,{"error":"filename vereist"})
        img=self.vault.image_as_base64(fname)
        if not img: return self._send(404,{"error":"Afbeelding niet gevonden"})
        prompt=("Beschrijf deze afbeelding in 3-5 zinnen Nederlands. "
                "Vermeld: wat er te zien is, kleuren, sfeer, eventuele tekst of symbolen.")
        try:
            r=self._ollama_post("/api/generate",{"model":model,"prompt":prompt,"images":[img["data"]],"stream":False},120)
            return self._send(200,{"ok":True,"description":r.get("response","").strip(),"filename":fname})
        except Exception as e:
            # Fallback naar llava
            try:
                r=self._ollama_post("/api/generate",{"model":"llava","prompt":prompt,"images":[img["data"]],"stream":False},120)
                return self._send(200,{"ok":True,"description":r.get("response","").strip(),"filename":fname})
            except Exception as e2:
                return self._send(200,{"ok":True,
                    "description":"Afbeelding: "+fname+" (vision model niet beschikbaar — ollama pull llama3.2-vision)",
                    "filename":fname,"warning":str(e2)})

    def _llm_mindmap(self):
        body=self._body()
        model=body.get("model","llama3.2-vision")
        ctx_notes=body.get("context_notes",[])
        ctx_pdfs=body.get("context_pdfs",[])
        parts=[]
        source_type="notes"  # "notes" | "pdf" | "mixed"

        if ctx_notes:
            for n in [x for x in self.vault.load_notes() if x["id"] in ctx_notes][:5]:
                parts.append("## "+n["title"]+"\n"+n["content"][:2000])
        if ctx_pdfs:
            source_type = "pdf" if not ctx_notes else "mixed"
            for pn in ctx_pdfs[:3]:
                txt=self.vault.extract_pdf_text(pn, 8000)
                if txt.strip():
                    parts.append("=== DOCUMENT: "+pn+" ===\n"+txt)

        if not parts: return self._send(400,{"error":"Geen context"})

        if source_type in ("pdf","mixed"):
            prompt = (
                'Analyseer dit document grondig en maak een gedetailleerde mindmap die laat zien:\n'
                '1. Hoe het document is opgebouwd (structuur, hoofdstukken, secties)\n'
                '2. Wat de kernthema\'s en belangrijkste concepten zijn\n'
                '3. Hoe details, voorbeelden en argumenten zich vertalen in de boom\n'
                '4. Verbanden tussen onderdelen\n\n'
                'Geef ALLEEN geldige JSON terug (geen uitleg, geen backticks, geen markdown).\n'
                'Verplicht formaat met 3 niveaus:\n'
                '{\n'
                '  "root": "Documenttitel of kernthema",\n'
                '  "branches": [\n'
                '    {\n'
                '      "label": "Hoofdtak (sectie of thema)",\n'
                '      "color": "#hex",\n'
                '      "importance": "high|medium|low",\n'
                '      "children": [\n'
                '        {\n'
                '          "label": "Subtopic",\n'
                '          "details": ["detail1", "detail2"]\n'
                '        }\n'
                '      ]\n'
                '    }\n'
                '  ]\n'
                '}\n\n'
                'Gebruik 4-7 hoofdtakken. Elke tak heeft 2-5 subtopics. '
                'Elk subtopic heeft 1-3 details. '
                'Kies kleuren die de categorie weergeven: '
                '#8ac6f2 voor structuur/opbouw, #9fcf56 voor kernconcepten, '
                '#e5786d voor conclusies/bevindingen, #d4a4f7 voor methodes, '
                '#e8d44d voor voorbeelden, #f4bf75 voor aanbevelingen.\n\n'
                + "\n\n".join(parts)
            )
        else:
            prompt = (
                'Analyseer de notities en maak een mindmap van de kennisstructuur.\n'
                'Geef ALLEEN geldige JSON terug (geen uitleg, geen backticks).\n'
                'Formaat:\n'
                '{"root":"Overzicht","branches":[{"label":"Tak","color":"#hex",'
                '"importance":"high","children":[{"label":"Sub","details":["detail"]}]}]}\n'
                'Gebruik 3-6 takken met elk 2-4 subtopics.\n\n'
                + "\n\n".join(parts)
            )

        try:
            r=self._ollama_post("/api/generate",{"model":model,"prompt":prompt,"stream":False},180)
            raw=r.get("response","").strip()
            # Extracteer JSON — ook als model er tekst omheen zet
            m=re.search(r'\{[\s\S]*\}',raw)
            if m:
                mm=json.loads(m.group(0))
                # Normaliseer naar consistent formaat
                if "branches" not in mm: mm["branches"]=[]
                for b in mm["branches"]:
                    if "children" not in b: b["children"]=[]
                    for c in b["children"]:
                        if isinstance(c,str):
                            # Oud formaat: string kinderen
                            b["children"]=[{"label":ch,"details":[]} if isinstance(ch,str) else ch
                                           for ch in b["children"]]
                            break
                        if "details" not in c: c["details"]=[]
                return self._send(200,{"ok":True,"mindmap":mm,"source_type":source_type})
            return self._send(200,{"ok":False,"error":"Model gaf geen geldige JSON terug","raw":raw[:800]})
        except json.JSONDecodeError as e:
            return self._send(200,{"ok":False,"error":"JSON parse fout: "+str(e),"raw":raw[:400] if 'raw' in dir() else ""})
        except Exception as e:
            return self._send(200,{"ok":False,"error":str(e)})

    def _import_url(self):
        """Haal inhoud van een URL op en converteer naar Markdown — Instapaper-stijl.
        Downloadt ook afbeeldingen en slaat ze op in de vault/images map."""
        body   = self._body()
        url    = body.get("url","").strip()
        model  = body.get("model","llama3.2-vision")
        if not url:
            return self._send(400,{"error":"url vereist"})
        if not url.startswith(("http://","https://")):
            url = "https://" + url

        parsed_base = urlparse(url)
        base_url    = f"{parsed_base.scheme}://{parsed_base.netloc}"

        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; Zettelkasten/1.0)",
                "Accept": "text/html,application/xhtml+xml",
                "Accept-Language": "nl,en;q=0.9",
            })
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw_bytes = resp.read(500_000)
                charset   = "utf-8"
                ct = resp.headers.get("Content-Type","")
                if "charset=" in ct:
                    charset = ct.split("charset=")[-1].split(";")[0].strip()
                html = raw_bytes.decode(charset, errors="replace")
        except Exception as e:
            return self._send(200,{"ok":False,"error":"URL ophalen mislukt: "+str(e)})

        # ── HTML → tekst + afbeelding-URLs via stdlib html.parser ────────────
        from html.parser import HTMLParser

        class ArticleExtractor(HTMLParser):
            SKIP_TAGS = {"script","style","nav","footer","header","aside",
                         "noscript","form","button","svg","iframe","ads"}
            BLOCK_TAGS = {"p","h1","h2","h3","h4","li","blockquote","pre","td","th","figcaption"}

            def __init__(self):
                super().__init__()
                self.skip_depth  = 0
                self.text_chunks = []
                self.title       = ""
                self._in_title   = False
                self.img_srcs    = []   # alle gevonden afbeelding-URLs (gededupliceerd)
                self._img_seen   = set()
                self.og_image    = ""   # Open Graph hoofdafbeelding

            def _add_img(self, src):
                """Voeg src toe als het geldig en nog niet gezien is."""
                if not src or src.startswith("data:") or src in self._img_seen:
                    return
                self._img_seen.add(src)
                self.img_srcs.append(src)

            def handle_starttag(self, tag, attrs):
                attr_d = dict(attrs)
                if tag == "title": self._in_title = True
                if tag in self.SKIP_TAGS: self.skip_depth += 1
                if tag in self.BLOCK_TAGS and self.text_chunks:
                    self.text_chunks.append("\n")

                # Open Graph afbeelding (staat vaak in <head> buiten artikel)
                if tag == "meta":
                    prop = attr_d.get("property","") or attr_d.get("name","")
                    if prop in ("og:image","og:image:secure_url","twitter:image"):
                        content = attr_d.get("content","").strip()
                        if content and not content.startswith("data:"):
                            self.og_image = content

                # Alle <img> tags — ook binnen nav/header voor volledigheid,
                # want redactionele afbeeldingen zitten soms in "article > header"
                if tag == "img":
                    # Prioriteit: src → data-src → data-lazy-src → data-original
                    # → data-src-medium → data-full-url → srcset (eerste URL)
                    candidates = [
                        attr_d.get("src",""),
                        attr_d.get("data-src",""),
                        attr_d.get("data-lazy-src",""),
                        attr_d.get("data-original",""),
                        attr_d.get("data-original-src",""),
                        attr_d.get("data-full-url",""),
                        attr_d.get("data-hi-res-src",""),
                        attr_d.get("data-src-medium",""),
                        attr_d.get("data-echo",""),
                    ]
                    for c in candidates:
                        if c and not c.startswith("data:"):
                            self._add_img(c)
                            break   # eerste geldige volstaat
                    # srcset: pak de hoogste-resolutie URL (laatste in lijst)
                    srcset = attr_d.get("srcset","") or attr_d.get("data-srcset","")
                    if srcset:
                        parts = [p.strip().split()[0] for p in srcset.split(",") if p.strip()]
                        if parts:
                            self._add_img(parts[-1])  # hoogste resolutie

                # <source> binnen <picture>
                if tag == "source":
                    srcset = attr_d.get("srcset","") or attr_d.get("data-srcset","")
                    if srcset:
                        parts = [p.strip().split()[0] for p in srcset.split(",") if p.strip()]
                        if parts:
                            self._add_img(parts[-1])

            def handle_endtag(self, tag):
                if tag == "title": self._in_title = False
                if tag in self.SKIP_TAGS and self.skip_depth > 0:
                    self.skip_depth -= 1

            def handle_data(self, data):
                if self._in_title:
                    self.title += data
                    return
                if self.skip_depth > 0: return
                t = data.strip()
                if t: self.text_chunks.append(t)

        parser = ArticleExtractor()
        parser.feed(html)

        page_title = parser.title.strip() or url
        raw_text   = " ".join(parser.text_chunks)
        raw_text   = re.sub(r'\s{3,}', ' ', raw_text)[:12000]

        if len(raw_text) < 100:
            return self._send(200,{"ok":False,
                "error":"Pagina bevat te weinig leesbare tekst (mogelijk JavaScript-only of betaalmuur)"})

        # ── Afbeeldingen downloaden ───────────────────────────────────────────
        IMAGE_MIME_TYPES = {"image/jpeg","image/png","image/gif","image/webp","image/svg+xml"}
        SKIP_PATTERNS    = ("logo","icon","avatar","badge","pixel","tracking","1x1",
                            "spacer","blank","transparent","spinner","loading")
        saved_images = []   # [{name, url_path}]

        # Voeg og:image toe als eerste (meest representatieve afbeelding van pagina)
        all_img_srcs = []
        if parser.og_image:
            all_img_srcs.append(parser.og_image)
        for s in parser.img_srcs:
            if s != parser.og_image:
                all_img_srcs.append(s)

        for raw_src in all_img_srcs[:40]:  # max 40 proberen (na filtering blijven er minder over)
            try:
                # Maak absolute URL
                if raw_src.startswith("//"):
                    img_url = parsed_base.scheme + ":" + raw_src
                elif raw_src.startswith("/"):
                    img_url = base_url + raw_src
                elif not raw_src.startswith("http"):
                    img_url = url.rsplit("/",1)[0] + "/" + raw_src
                else:
                    img_url = raw_src

                # Sla over als URL al een bekende tracker/icon is
                low = img_url.lower()
                if any(p in low for p in SKIP_PATTERNS):
                    continue

                # Download
                img_req = urllib.request.Request(img_url, headers={
                    "User-Agent":"Mozilla/5.0","Referer":url
                })
                with urllib.request.urlopen(img_req, timeout=10) as ir:
                    img_bytes = ir.read(5_000_000)  # max 5 MB
                    img_ct    = ir.headers.get("Content-Type","").split(";")[0].strip()

                # Filter op MIME
                if img_ct not in IMAGE_MIME_TYPES and not img_ct.startswith("image/"):
                    continue
                if len(img_bytes) < 800:    # kleiner dan 800 bytes = waarschijnlijk icon
                    continue

                # Bestandsnaam
                ext_map = {"image/jpeg":".jpg","image/png":".png","image/gif":".gif",
                           "image/webp":".webp","image/svg+xml":".svg"}
                ext = ext_map.get(img_ct, ".jpg")
                raw_name = img_url.split("?")[0].rsplit("/",1)[-1]
                if "." not in raw_name[-5:]:
                    raw_name = raw_name + ext
                # Prefix met domein voor uniciteit
                domain_prefix = parsed_base.netloc.replace("www.","").replace(".","_")
                fname = domain_prefix + "_" + raw_name[:60]

                saved = self.vault.save_image(fname, img_bytes)
                saved_images.append({"name": saved["name"], "url": saved["url"]})
            except Exception:
                continue  # sla mislukte downloads stilletjes over

        # ── Laat LLM opschonen en structureren als Markdown ──────────────────
        # Geen afbeeldingen in de markdown — die kiest de gebruiker zelf via de selectie-UI
        prompt = (
            "Converteer de onderstaande webpagina-tekst naar goed gestructureerde Markdown, "
            "als een leesbaar artikel (Instapaper-stijl). "
            "Volg deze opmaakregels precies:\n"
            "- Begin met # Titel (de paginatitel)\n"
            "- Schrijf direct daarna 2-3 zinnen als inleidende samenvatting\n"
            "- Gebruik ## voor hoofdsecties, ### voor subsecties\n"
            "- Gebruik **vetgedrukt** voor kernbegrippen en sleutelcijfers\n"
            "- Gebruik *cursief* voor definities en technische termen\n"
            "- Gebruik - voor opsommingen, 1. voor genummerde stappen\n"
            "- Gebruik > voor citaten en uitspraken\n"
            "- Gebruik --- als scheiding tussen grote secties\n"
            "- Sluit af met een ## Conclusie of ## Samenvatting sectie als de tekst dat toelaat\n"
            "Verwijder navigatie, advertenties, cookieteksten en herhalingen. "
            "Geef ALLEEN de Markdown terug, geen uitleg, geen ```markdown blokken.\n\n"
            f"TITEL: {page_title}\nURL: {url}\n\n"
            "TEKST:\n" + raw_text
        )
        try:
            r = self._ollama_post("/api/generate",
                {"model":model,"prompt":prompt,"stream":False}, 120)
            md = r.get("response","").strip()
            if not md:
                md = f"# {page_title}\n\n{raw_text[:4000]}"
        except Exception:
            md = f"# {page_title}\n\n{raw_text[:4000]}"

        return self._send(200,{
            "ok":     True,
            "title":  page_title,
            "url":    url,
            "markdown": md,
            "images": saved_images,   # beschikbaar voor selectie in de UI
        })


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
    parser.add_argument("--offline",    action="store_true",
                        help="Gebruik lokale vendor-bestanden i.p.v. CDN (geen internet vereist)")
    args=parser.parse_args()

    # Controleer vendor-bestanden bij --offline
    if args.offline:
        missing = [f for f in ["react.production.min.js","react-dom.production.min.js",
                                "pdf.min.js","pdf.worker.min.js"]
                   if not (VENDOR_DIR / f).exists()]
        if missing:
            print(f"\n⚠ Offline modus: ontbrekende vendor-bestanden in static/vendor/:")
            for m in missing: print(f"   - {m}")
            print(f"\n  Voer eerst uit:  cd static/vendor && bash download-vendors.sh\n")
            sys.exit(1)

    vault_path=Path(args.vault).expanduser().resolve()
    ZKHandler.vault=VaultManager(vault_path)
    ZKHandler.verbose=args.verbose
    ZKHandler.offline=args.offline
    class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
        daemon_threads = True
    server=ThreadingHTTPServer((args.host,args.port),ZKHandler)
    local_ip=get_local_ip()
    offline_label = "JA (vendor/)" if args.offline else "nee (CDN)"
    print(f"""
╔══════════════════════════════════════════════════════╗
║        ZETTELKASTEN VIM  —  Python Server v4         ║
╚══════════════════════════════════════════════════════╝
  Vault   : {vault_path}
  Lokaal  : http://localhost:{args.port}
  Netwerk : http://{local_ip}:{args.port}
  Logging : {"aan" if args.verbose else "uit  (--verbose)"}
  Offline : {offline_label}
  LLM     : ollama serve  +  ollama pull llama3.2-vision
  Stop    : Ctrl+C
""")
    if not args.no_browser:
        threading.Timer(0.8,lambda:webbrowser.open(f"http://localhost:{args.port}")).start()
    try: server.serve_forever()
    except KeyboardInterrupt: print("\nServer gestopt.")

if __name__=="__main__": main()
