# 🗃️ Zettelkasten VIM

> Zelfstandige Python desktop-app voor kennisbeheer. Notities als Markdown op schijf, PDF bibliotheek met annotaties, afbeeldingenbeheer, Obsidian-stijl kennisgraaf, canvas VIM-editor, interactieve mindmap (visueel én Mermaid-syntax), web-importer, en een lokale AI notebook via Ollama — volledig offline, geen cloud.

---

## 🚀 Installatie

### Vereisten

| Vereiste | Versie | Verplicht |
|----------|--------|-----------|
| Python | 3.8+ | ✅ Ja |
| Node.js + npm | 18+ | ✅ Ja (voor UI-build) |
| Ollama | nieuwste | ⚪ Optioneel (AI-functies) |
| Moderne browser | Chrome / Firefox / Safari | ✅ Ja |

> Python gebruikt **alleen de standaardbibliotheek** — geen `pip install` nodig.

---

### Stap 1 — Bestanden neerzetten

Zet de projectmap ergens neer, bijv.:

```
~/Apps/zettelkasten-python-app/
├── server.py
├── README.md
├── static/
│   ├── index.html
│   └── app.js
└── zettelkasten-vite/       ← Vite project voor de UI-build
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── index.css
        ├── main.jsx
        ├── lib/utils.js
        └── components/ui/
            ├── button.jsx
            ├── input.jsx
            ├── badge.jsx
            ├── separator.jsx
            └── scroll-area.jsx
```

---

### Stap 2 — UI bouwen (Vite + Tailwind)

De UI gebruikt **DM Sans** als interfacefont en het **Wombat** kleurenschema via Tailwind. Bouw de CSS eenmalig:

```bash
cd ~/Apps/zettelkasten-python-app/zettelkasten-vite

npm install        # installeert Vite, Tailwind, PostCSS (~30 sec)
npm run build      # bouwt → ../static/wombat.css
```

✅ Als het gelukt is staat er een `wombat.css` in de `static/` map.

> **Alleen nodig bij eerste installatie of na wijzigingen aan de UI-stijlen.**  
> De app werkt ook zónder deze stap — dan valt hij terug op de ingebakken stijlen in `index.html`.

---

### Stap 3 — Server starten

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

### Stap 4 — AI instellen (optioneel)

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

### Samenvatting in één keer

```bash
# Eenmalige setup
cd ~/Apps/zettelkasten-python-app/zettelkasten-vite
npm install && npm run build

# Daarna altijd opstarten met:
cd ~/Apps/zettelkasten-python-app
python3 server.py
```

---

## 📁 Vault Structuur

```
~/Zettelkasten/
├── notes/
│   ├── 20240315143022.md       ← elke notitie = één .md bestand
│   └── ...
├── pdfs/
│   └── artikel.pdf
├── annotations/
│   ├── artikel_pdf.json        ← PDF-annotaties per bestand als JSON
│   └── _image_annotations.json ← afbeelding pin-annotaties
├── images/
│   └── foto.png
└── config.json
```

**Vault wisselen**
- CLI: `python3 server.py --vault /pad/naar/vault`
- In app: ⚙ Instellingen → voer nieuw pad in

---

## 🗂️ Tabbladen

| Tab | Icoon | Inhoud |
|-----|-------|--------|
| Notities | 📝 | Notities schrijven, bekijken, doorzoeken |
| Graaf | 🕸 | Kennisgraaf van alle verbindingen |
| PDF | 📄 | PDF-bibliotheek met annotaties |
| Plaatjes | 🖼 | Afbeeldingen met AI-beschrijving en pin-annotaties |
| Mindmap | 🗺 | Visuele vault-mindmap of AI-mindmap of Mermaid-editor |
| Notebook | 🧠 | LLM-chat over notities, PDFs en afbeeldingen |
| Import | 🌐 | Webpagina's importeren als notitie |

**Split-screen modus** (desktop): klik de split-knop in de toolbar om notities naast een ander tabblad te tonen.

---

## ⌨️ VIM Editor

Canvas-gebaseerde editor — Escape werkt altijd, geen browser-interferentie.

### Modes
| Mode    | Activeer  | Beschrijving           |
|---------|-----------|------------------------|
| INSERT  | `i` / `a` | Tekst schrijven        |
| NORMAL  | `Esc`     | Navigatie & commando's |
| COMMAND | `:`       | Ex-commando's          |
| SEARCH  | `/`       | Zoeken in document     |

### Navigatie (NORMAL)
| Toets      | Actie                     |
|------------|---------------------------|
| `h j k l`  | Karakter / regel          |
| `w` / `b`  | Woord vooruit / achteruit |
| `0` / `$`  | Begin / einde regel       |
| `gg` / `G` | Begin / einde document    |

### Bewerken (NORMAL)
| Toets          | Actie                      |
|----------------|----------------------------|
| `i` / `a`      | INSERT voor / na cursor    |
| `o` / `O`      | Nieuwe regel onder / boven |
| `dd`           | Verwijder regel            |
| `yy` / `p`     | Kopieer / plak regel       |
| `x`            | Verwijder karakter         |
| `u` / `Ctrl+r` | Undo / Redo                |

### Ex-commando's (`:`)
| Commando          | Actie                     |
|-------------------|---------------------------|
| `:w` / `:wq`      | Opslaan / opslaan+sluiten |
| `:q!`             | Sluiten zonder opslaan    |
| `:tag rust async` | Tags vervangen            |
| `:tag+ nieuw`     | Tag toevoegen             |
| `:tag- oud`       | Tag verwijderen           |
| `:goyo`           | Toggle focusmodus         |
| `:spell`          | Spellcheck: off → en → nl |

### Snippets (`Ctrl+J` of `Tab` in INSERT)
| Trigger | Expandeert naar  |
|---------|------------------|
| `h1`    | `# Titel`        |
| `h2`    | `## Sectie`      |
| `link`  | `[[notitie]]`    |
| `code`  | Codeblok         |
| `table` | Markdowntabel    |
| `todo`  | `- [ ] taak`     |
| `date`  | Huidige datum    |
| `bold`  | `**vetgedrukt**` |

---

## 🔗 Notitie Links & Media

### Links invoegen via 🔗 koppelen knop
1. Open een notitie in de editor
2. Klik **🔗 koppelen** → dropdown met zoekbalk en type-filter
3. Zoek op titel of tag → klik item → link ingevoegd op cursorpositie

```markdown
[[Andere Notitie]]           ← bidirectionele notitie-link
[[pdf:rapport.pdf]]          ← klikbare PDF-link
![[img:foto.png]]            ← ingesloten afbeelding
```

Backlinks worden automatisch onderaan elke notitie getoond.

---

## 🗺️ Mermaid Mindmap Editor

```
mindmap
  root((Hoofdonderwerp))
    Tak A
      Sub A1
      Sub A2
    Tak B
      Sub B1
```

- **VIM-editor** met INSERT / NORMAL / COMMAND / SEARCH modes
- **Live preview** rechts: Reingold-Tilford tree layout
- **Syntax highlighting**: kleuren identiek aan de canvas-preview
- **Tab** = inspringing, **Enter** behoudt indentniveau
- **`:tag+`** / **`:tag-`** voor tags vanuit NORMAL mode
- **⊟ preview** klapt de preview in voor meer editorruimte
- **✦ nieuw** start een lege mindmap

---

## 🧠 Notebook LLM

### Modellen

| Model                    | Commando                      | Grootte | Gebruik                       |
|--------------------------|-------------------------------|---------|-------------------------------|
| **Llama 3.2 Vision 11B** | `ollama pull llama3.2-vision` | ~8 GB   | **Standaard** — tekst + beeld |
| Llama 3 8B               | `ollama pull llama3`          | ~5 GB   | Snel, goed Nederlands         |
| Mistral 7B               | `ollama pull mistral`         | ~4 GB   | Snel, EU-talen                |
| Phi-3 Medium 14B         | `ollama pull phi3:medium`     | ~9 GB   | Analyse & redeneren           |
| Gemma 2 9B               | `ollama pull gemma2`          | ~6 GB   | Lange context                 |

---

## 📦 Projectstructuur

```
zettelkasten-python-app/
├── server.py                  ← Python backend, puur stdlib
├── README.md
├── static/
│   ├── index.html             ← HTML shell
│   ├── app.js                 ← React frontend (~7400 regels)
│   └── wombat.css             ← 🔨 Gebouwd door Vite (na npm run build)
└── zettelkasten-vite/         ← Vite + Tailwind + shadcn/ui
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── index.css          ← Tailwind + Wombat globals
        ├── main.jsx           ← Entry point
        ├── lib/utils.js       ← shadcn cn() utility
        └── components/ui/     ← shadcn componenten (Wombat-gestyled)
```

---

## 💡 Tips

- **Meerdere vaults:** start meerdere servers op verschillende poorten
- **Git backup:** de vault map is gewone tekst — perfect voor git
- **Obsidian-compatibel:** notities zijn standaard Markdown, direct bruikbaar in Obsidian
- **Privacy:** alle AI draait lokaal via Ollama, geen data naar buiten
- **iPad:** start met `--host 0.0.0.0`, open het getoonde IP in Safari
- **Zoeken:** typ in de zoekbalk in de sidebar, of `/` in NORMAL mode in de editor
