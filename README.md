# 🗃️ Zettelkasten VIM

> Zelfstandige Python desktop-app voor kennisbeheer. Notities als Markdown op schijf, PDF-bibliotheek met annotaties, afbeeldingenbeheer, Obsidian-stijl kennisgraaf, canvas VIM-editor, split-screen modus, interactieve mindmap (visueel én Mermaid-syntax), web-importer, Gmail-import vanuit Thunderbird, spellcheck (NL + EN), en een lokale AI notebook via Ollama — volledig offline, geen cloud.

---

## 🚀 Installatie

### Vereisten

| Vereiste | Versie | Verplicht |
|----------|--------|-----------|
| Python | 3.8+ | ✅ Ja |
| Moderne browser | Chrome / Firefox / Safari | ✅ Ja |
| Ollama | nieuwste | ⚪ Optioneel (AI-functies) |
| Thunderbird | nieuwste | ⚪ Optioneel (Gmail-import) |

> Python gebruikt **alleen de standaardbibliotheek** — geen `pip install` nodig.

---

### Stap 1 — Bestanden neerzetten

```
~/Apps/zettelkasten-python-app/
├── server.py
├── README.md
└── static/
    ├── index.html
    ├── app.js
    ├── modules/
    │   ├── NoteEditor.js
    │   ├── NotesTab.js
    │   └── ...
    └── vendor/              ← alleen nodig voor offline modus
        └── download-vendors.sh
```

---

### Stap 2 — Server starten

```bash
cd ~/Apps/zettelkasten-python-app

python3 server.py                                        # standaard (~/Zettelkasten, poort 7842)
python3 server.py --vault ~/Documenten/MijnNotities     # eigen vault map
python3 server.py --port 8080                            # andere poort
python3 server.py --host 0.0.0.0                        # bereikbaar op iPad / netwerk
python3 server.py --vault ~/Notes --port 8080 --verbose  # combineren
```

De browser opent automatisch op **http://localhost:7842**  
Bij `--host 0.0.0.0` toont het opstartbericht ook het netwerk-IP, bijv. `http://192.168.1.42:7842`

---

### Stap 3 — AI instellen (optioneel)

Voor samenvattingen, beschrijvingen, chat en mindmap-generatie is **Ollama** nodig:

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows → https://ollama.com/download

# Start de Ollama daemon
ollama serve

# Download het aanbevolen model (tekst + beeld, ~8 GB)
ollama pull llama3.2-vision
```

> Ollama op een ander apparaat in het netwerk?
> ```bash
> OLLAMA_URL=http://192.168.1.10:11434 python3 server.py
> ```

---

## 📡 Offline modus

Standaard laadt de app React, PDF.js en de fonts van CDN (internet vereist bij eerste open).  
Met `--offline` worden alle bestanden lokaal geserveerd — **geen internet nodig**.

```bash
# Eenmalige setup (met internet)
cd ~/Apps/zettelkasten-python-app/static/vendor
bash download-vendors.sh

# Daarna opstarten zonder internet
python3 server.py --offline
```

> **Let op:** de web-importer (URL → notitie) heeft altijd internet nodig.

---

## 📁 Vault Structuur

```
~/Zettelkasten/
├── notes/
│   └── 20240315143022.md       ← elke notitie = één .md bestand
├── pdfs/
├── annotations/
│   ├── artikel_pdf.json        ← PDF-annotaties per bestand als JSON
│   └── _image_annotations.json ← afbeelding pin-annotaties
├── images/
└── config.json
```

Vault wisselen via CLI: `python3 server.py --vault /pad/naar/vault`  
Of in de app: ⚙ Instellingen → voer nieuw pad in.

---

## 🗂️ Tabbladen

| Tab | Icoon | Inhoud |
|-----|-------|--------|
| Notities | 📝 | Notities schrijven, bekijken, doorzoeken |
| Graaf | 🕸 | Kennisgraaf van alle verbindingen |
| PDF | 📄 | PDF-bibliotheek met annotaties |
| Plaatjes | 🖼 | Afbeeldingen met AI-beschrijving en pin-annotaties |
| Mindmap | 🗺 | Visuele vault-mindmap, AI-mindmap of Mermaid-editor |
| Notebook | 🧠 | LLM-chat over notities, PDFs en afbeeldingen |
| Import | 🌐 | Webpagina's importeren als notitie + Gmail-import |
| Zoeken | 🔍 | FZF-stijl zoeken over notities én PDF-pagina's |

---

## ↔️ Split-screen modus

Notities naast een tweede tabblad (PDF, afbeeldingen, zoeken) open houden.

**Activeren:** klik de split-knop in de toolbar, of typ `:vs` in COMMAND mode.

### Navigeren tussen panelen

| Toets | Actie |
|-------|-------|
| `Ctrl+H` of `Ctrl+K` | Focus → linker paneel (editor) |
| `Ctrl+L` of `Ctrl+J` | Focus → rechter paneel |

Bij focus op het rechter paneel springt de cursor automatisch in de zoekbalk.  
Bij focus terug naar links staat de cursor direct in de editor, op de plek waar hij stond.

---

## ⌨️ VIM Editor

Canvas-gebaseerde editor — Escape werkt altijd, geen browser-interferentie.

### Modes
| Mode | Activeer | Beschrijving |
|------|----------|--------------|
| INSERT | `i` / `a` | Tekst schrijven |
| NORMAL | `Esc` | Navigatie & commando's |
| COMMAND | `:` | Ex-commando's |
| SEARCH | `/` | Zoeken in document |

### Navigatie (NORMAL)
| Toets | Actie |
|-------|-------|
| `h j k l` | Karakter / regel |
| `w` / `b` | Woord vooruit / achteruit |
| `0` / `$` | Begin / einde regel |
| `gg` / `G` | Begin / einde document |

### Bewerken (NORMAL)
| Toets | Actie |
|-------|-------|
| `i` / `a` | INSERT voor / na cursor |
| `o` / `O` | Nieuwe regel onder / boven |
| `dd` | Verwijder regel |
| `yy` / `p` | Kopieer / plak regel |
| `x` | Verwijder karakter |
| `u` / `Ctrl+r` | Undo / Redo |

### Ex-commando's (`:`)
| Commando | Actie |
|----------|-------|
| `:w` / `:wq` | Opslaan / opslaan+sluiten |
| `:q!` | Sluiten zonder opslaan |
| `:vs` | Split-screen openen |
| `:only` | Split-screen sluiten |
| `:tag rust async` | Tags vervangen |
| `:tag+ nieuw` | Tag toevoegen |
| `:tag- oud` | Tag verwijderen |
| `:goyo` | Toggle focusmodus |
| `:spell` | Spellcheck: nl → en → uit |

### Snippets (`Ctrl+J` of `Tab` in INSERT)
| Trigger | Expandeert naar |
|---------|-----------------|
| `h1` | `# Titel` |
| `h2` | `## Sectie` |
| `link` | `[[notitie]]` |
| `code` | Codeblok |
| `table` | Markdowntabel |
| `todo` | `- [ ] taak` |
| `date` | Huidige datum |
| `bold` | `**vetgedrukt**` |

---

## ✏️ Spellcheck

Live spellcheck met gekleurde onderstrepingen in de editor.

**Taal wisselen:** `:spell` in COMMAND mode — wisselt tussen Nederlands, Engels en uit.

Optioneel: installeer Hunspell-woordenboeken voor betere dekking:
```bash
cd static/vendor/dict
bash download-dictionaries.sh
```

---

## 🔗 Notitie Links & Media

```markdown
[[Andere Notitie]]       ← bidirectionele notitie-link
[[pdf:rapport.pdf]]      ← klikbare PDF-link
![[img:foto.png]]        ← ingesloten afbeelding
```

Backlinks worden automatisch onderaan elke notitie getoond.  
Links invoegen via **🔗 koppelen** in de toolbar: zoek op titel of tag → klik → ingevoegd op cursorpositie.

---

## 🌐 Web-import

Importeer webpagina's als Zettelkasten-notitie.

1. Ga naar **Import** → tab **🌐 URL import**
2. Plak een URL → klik **→ Importeren**
3. Bewerk titel, tags en inhoud → **✓ Opslaan als notitie**

---

## 📬 Gmail-import vanuit Thunderbird

Importeer mails rechtstreeks vanuit je lokale Thunderbird Gmail-inbox — geen inloggen vereist, alles lokaal.

### Hoe het werkt

1. Ga naar **Import** → tab **📬 Thunderbird / Gmail**
2. Klik **📂 Laden**
3. De server zoekt automatisch je Thunderbird-profiel en toont live voortgang:
   - welke profielen gevonden worden
   - welke Gmail INBOX-bestanden gelezen worden
   - hoeveel mails per inbox gevonden zijn
4. Alleen de **Gmail INBOX** wordt getoond, **gesorteerd op datum nieuwste bovenaan**
5. Alleen mails **met een URL in de berichttekst** worden weergegeven — tracking-links worden automatisch gefilterd
6. Vink interessante mails aan → klik **📥 Importeren**  
   Elke URL wordt via de web-import flow direct opgeslagen als notitie met tags `import`, `gmail` en de domeinnaam

### Thunderbird niet gevonden?

Voer het pad handmatig in, bijv.:
```
~/.thunderbird/xxxxxxxx.default-release
```

Het scanlogboek toont precies welke paden geprobeerd zijn.

---

## 🗺️ Mindmap

### Visuele mindmap
- Radiale boom: root in midden, takken per tag, notities als bladeren
- Klik node om te hernoemen of verwijderen
- Sleep om te herpositioneren

### Mermaid-editor

```
mindmap
  root((Hoofdonderwerp))
    Tak A
      Sub A1
    Tak B
```

- VIM-editor met live preview
- **Tab** = inspringing, **Enter** behoudt indentniveau
- **⊟ preview** klapt de preview in voor meer editorruimte

---

## 🧠 Notebook LLM

| Model | Commando | Grootte | Gebruik |
|-------|----------|---------|---------|
| **Llama 3.2 Vision 11B** | `ollama pull llama3.2-vision` | ~8 GB | **Standaard** — tekst + beeld |
| Llama 3 8B | `ollama pull llama3` | ~5 GB | Snel, goed Nederlands |
| Mistral 7B | `ollama pull mistral` | ~4 GB | Snel, EU-talen |
| Phi-3 Medium 14B | `ollama pull phi3:medium` | ~9 GB | Analyse & redeneren |
| Gemma 2 9B | `ollama pull gemma2` | ~6 GB | Lange context |

---

## 📦 Projectstructuur

```
zettelkasten-python-app/
├── server.py                  ← Python backend, puur stdlib
├── README.md
└── static/
    ├── index.html
    ├── app.js                 ← React frontend
    ├── modules/               ← SOLID-modules
    │   ├── NoteEditor.js
    │   ├── NotesTab.js
    │   ├── NoteList.js
    │   ├── NotePreview.js
    │   ├── NotesMeta.js
    │   ├── noteApi.js
    │   ├── noteStore.js
    │   ├── pdfService.js
    │   └── annotationStore.js
    └── vendor/
        ├── download-vendors.sh
        ├── react.production.min.js
        ├── react-dom.production.min.js
        ├── pdf.min.js + pdf.worker.min.js
        ├── hack.css + dm-sans.css
        ├── fonts/
        └── dict/              ← Hunspell woordenboeken (optioneel)
```

---

## 💡 Tips

- **Meerdere vaults:** start meerdere servers op verschillende poorten
- **Git backup:** de vault map is gewone tekst — perfect voor git
- **Obsidian-compatibel:** notities zijn standaard Markdown, direct bruikbaar in Obsidian
- **Privacy:** alle AI draait lokaal via Ollama, geen data naar buiten
- **iPad:** start met `--host 0.0.0.0`, open het getoonde IP in Safari
- **Volledig offline:** eenmalig `bash static/vendor/download-vendors.sh`, daarna `python3 server.py --offline`
- **Gmail snel importeren:** stuur jezelf interessante URLs → Thunderbird → Import-tab → Laden → aanvinken → Importeren
