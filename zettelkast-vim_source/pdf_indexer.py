#!/usr/bin/env python3
"""
pdf_indexer.py — Standalone PDF indexeerder voor Zettelkasten.
Draait als apart proces, blokkeert de server NOOIT.
Schrijft index naar .zettelkasten_pdf_index.json in de vault.

Gebruik:
    python3 pdf_indexer.py --vault /pad/naar/vault
    python3 pdf_indexer.py --vault /pad/naar/vault --rebuild
"""
import argparse, json, os, sys, pathlib, time

def extract_text_from_pdf(pdf_path: pathlib.Path) -> list:
    """Extraheer tekst per pagina via pdfminer of pypdf als fallback."""
    pages = []
    
    # Probeer pdfminer.six (beste kwaliteit)
    try:
        from pdfminer.high_level import extract_pages
        from pdfminer.layout import LTTextContainer
        for page_num, layout in enumerate(extract_pages(str(pdf_path)), 1):
            lines = []
            for element in layout:
                if isinstance(element, LTTextContainer):
                    for line in element.get_text().splitlines():
                        line = line.strip()
                        if line:
                            lines.append(line)
            if lines:
                pages.append({"page": page_num, "lines": lines})
        if pages:
            return pages
    except ImportError:
        pass
    except Exception as e:
        print(f"[indexer] pdfminer fout: {e}", flush=True)

    # Fallback: pypdf
    try:
        import pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        for page_num, page in enumerate(reader.pages, 1):
            text = page.extract_text() or ""
            lines = [l.strip() for l in text.splitlines() if l.strip()]
            if lines:
                pages.append({"page": page_num, "lines": lines})
        return pages
    except ImportError:
        pass
    except Exception as e:
        print(f"[indexer] pypdf fout: {e}", flush=True)

    return []


def find_pdfs(vault: pathlib.Path) -> list:
    """Zoek alle PDFs in vault/pdfs/."""
    pdf_dir = vault / "pdfs"
    if not pdf_dir.exists():
        return []
    return sorted(pdf_dir.glob("*.pdf"), key=lambda p: p.stat().st_mtime, reverse=True)


def build_index(vault: pathlib.Path, rebuild: bool = False):
    index_path = vault / ".zettelkasten_pdf_index.json"
    
    # Laad bestaande index
    idx = {}
    if not rebuild and index_path.exists():
        try:
            idx = json.loads(index_path.read_text(encoding="utf-8"))
            print(f"[indexer] Bestaande index geladen: {len(idx)} PDFs", flush=True)
        except Exception:
            idx = {}

    pdfs = find_pdfs(vault)
    if not pdfs:
        print("[indexer] Geen PDFs gevonden.", flush=True)
        return

    print(f"[indexer] {len(pdfs)} PDF(s) gevonden. Start indexering…", flush=True)
    changed = False

    for pdf_path in pdfs:
        fname = pdf_path.name
        try:
            mtime = round(pdf_path.stat().st_mtime, 2)
        except OSError:
            continue

        if idx.get(fname, {}).get("mtime") == mtime:
            print(f"[indexer] Ongewijzigd, sla over: {fname}", flush=True)
            continue

        print(f"[indexer] Indexeer: {fname} …", flush=True)
        t0 = time.time()
        pages = extract_text_from_pdf(pdf_path)
        elapsed = round(time.time() - t0, 1)
        idx[fname] = {
            "mtime": mtime,
            "pages": pages,
        }
        changed = True
        print(f"[indexer] Klaar: {fname} — {len(pages)} pagina's in {elapsed}s", flush=True)

        # Schrijf na elke PDF zodat gedeeltelijke index al bruikbaar is
        try:
            index_path.write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")
        except Exception as e:
            print(f"[indexer] Schrijffout: {e}", flush=True)

    # Opruimen: verwijder verdwenen PDFs
    pdf_names = {p.name for p in pdfs}
    stale = [k for k in idx if k not in pdf_names]
    for k in stale:
        del idx[k]
        changed = True
        print(f"[indexer] Verwijderd uit index: {k}", flush=True)

    if changed:
        index_path.write_text(json.dumps(idx, ensure_ascii=False), encoding="utf-8")

    print(f"[indexer] Klaar. {len(idx)} PDFs geïndexeerd.", flush=True)


def main():
    parser = argparse.ArgumentParser(description="Zettelkasten PDF indexeerder")
    parser.add_argument("--vault",   required=True, help="Pad naar de vault")
    parser.add_argument("--rebuild", action="store_true", help="Volledige herindexering")
    args = parser.parse_args()

    vault = pathlib.Path(args.vault).expanduser().resolve()
    if not vault.exists():
        print(f"[indexer] Vault niet gevonden: {vault}", file=sys.stderr)
        sys.exit(1)

    build_index(vault, rebuild=args.rebuild)


if __name__ == "__main__":
    main()
