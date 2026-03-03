# 🗃️ Zettelkasten VIM

> Zelfstandige Python desktop app voor kennisbeheer. Notities als Markdown op schijf, PDF bibliotheek met annotaties, Obsidian-stijl kennisgraaf, canvas VIM-editor, en een lokale AI notebook via Ollama — volledig offline, geen cloud.

---

## 🚀 Installatie & Starten

### Vereisten
- **Python 3.8+** — geen pip packages, alleen stdlib
- Moderne browser (Chrome, Firefox, Safari, of iPad Safari)

### Starten

```bash
cd zettelkasten-python-app/

# Standaard vault (~/Zettelkasten)
python3 server.py

# Eigen vault map
python3 server.py --vault ~/Documenten/MijnNotities

# Andere poort
python3 server.py --port 8080

# Bereikbaar op iPad / andere apparaten op hetzelfde wifi
python3 server.py --host 0.0.0.0
# → het opstartbericht toont het netwerk-IP, bijv. http://192.168.1.42:7842

# Verbose logging (toont HTTP requests in terminal)
python3 server.py --verbose

# Combineren
python3 server.py --vault ~/Notes --port 8080 --verbose
```

De browser opent automatisch op **http://localhost:7842**

---

## 📁 Vault Structuur

```
~/Zettelkasten/
├── notes/
│   ├── 20240315143022.md      ← elke notitie = één .md bestand
│   └── ...
├── pdfs/
│   └── artikel.pdf
├── annotations/
│   └── artikel_pdf.json       ← annotaties per PDF als JSON
└── config.json
```

**Vault wisselen**
- CLI: `python3 server.py --vault /pad/naar/vault`
- In app: ⚙ Instellingen → voer nieuw pad in

---

## ⌨️ VIM Editor

De editor is volledig canvas-gebaseerd — Escape werkt altijd, geen browser-interferentie.

### Modes
| Mode    | Activeer   | Beschrijving           |
|---------|------------|------------------------|
| INSERT  | `i` / `a`  | Tekst schrijven        |
| NORMAL  | `Esc`      | Navigatie & commando's |
| COMMAND | `:`        | Ex-commando's          |
| SEARCH  | `/`        | Zoeken in document     |

### Navigatie (NORMAL)
| Toets       | Actie                      |
|-------------|----------------------------|
| `h j k l`   | Karakter / regel           |
| `w` / `b`   | Woord vooruit / achteruit  |
| `0` / `$`   | Begin / einde regel        |
| `gg` / `G`  | Begin / einde document     |
| `Ctrl+d/u`  | Halve pagina omlaag/omhoog |

### Bewerken (NORMAL)
| Toets      | Actie                          |
|------------|--------------------------------|
| `i` / `a`  | INSERT voor / na cursor        |
| `o` / `O`  | Nieuwe regel onder / boven     |
| `dd`       | Verwijder regel                |
| `yy` / `p` | Kopieer / plak regel           |
| `x`        | Verwijder karakter             |
| `u`        | Undo                           |
| `Ctrl+r`   | Redo                           |
| `J`        | Voeg volgende regel samen      |

### Ex-commando's (`:`)
| Commando          | Actie                        |
|-------------------|------------------------------|
| `:w`              | Opslaan                      |
| `:wq`             | Opslaan en sluiten           |
| `:q!`             | Sluiten zonder opslaan       |
| `:tag rust async` | Alle tags vervangen          |
| `:tag+ nieuw`     | Tag toevoegen                |
| `:tag- oud`       | Tag verwijderen              |
| `:tags`           | Toon huidige tags            |
| `:goyo`           | Toggle focusmodus            |
| `:spell`          | Spellcheck: off → en → nl    |

### Snippets (`Ctrl+J` of `Tab` in INSERT)
| Trigger | Expandeert naar          |
|---------|--------------------------|
| `h1`    | `# Titel`                |
| `h2`    | `## Sectie`              |
| `link`  | `[[notitie]]`            |
| `code`  | Codeblok                 |
| `table` | Markdowntabel            |
| `todo`  | `- [ ] taak`             |
| `date`  | Huidige datum            |
| `bold`  | `**vetgedrukt**`         |

### Nieuwe notitie — flow
1. Klik **+ nieuw zettel** → titelinput krijgt focus
2. Typ de titel → druk **Enter**
3. Cursor staat direct op **regel 3**, klaar om te schrijven

De content bij een nieuwe notitie:
```
*maandag 03-03-2025*     ← regel 1: datum (automatisch)
                         ← regel 2: leeg
█                        ← regel 3: cursor hier
```

---

## 🕸️ Kennisgraaf

Force-directed graaf in Obsidian-stijl.

| Actie           | Effect                          |
|-----------------|---------------------------------|
| Klik node       | Opent de notitie                |
| Sleep node      | Herpositioneer                  |
| Hover           | Tooltip met titel en tags       |
| Tag klikken     | Filtert graaf op die tag        |
| "lokaal" knop   | Toont alleen directe buren      |
| "orphans" knop  | Notities zonder verbindingen    |

Node-grootte is gebaseerd op aantal verbindingen. Kleur per tag-groep.

---

## 📄 PDF Viewer

### PDF's laden
1. **Nieuw:** klik `:open PDF` → bestand wordt opgeslagen in `vault/pdfs/`
2. **Bibliotheek:** klik `📚 bibliotheek` → kies eerder geopend bestand

### Annoteren
- **Desktop:** selecteer tekst → popup verschijnt automatisch
- **iPad:** selecteer tekst met handvaatjes → tik **✏ Annoteren**
- Kies kleur, voeg notitie en tags toe → Enter of **✓ Opslaan**

### Schalen
- **Desktop:** `−` en `+` knoppen in de toolbar
- **iPad:** pinch-to-zoom (twee vingers uiteen/samen)

### Highlights
Opgeslagen annotaties zijn zichtbaar als gekleurde markeringen in de PDF-tekst. Klik op een markering om de annotatie te bewerken. Het annotatiepaneel toont alleen de annotaties van de **huidig geopende PDF**.

---

## 🧠 Notebook LLM

Stel vragen over je notities en PDF-annotaties via een lokale AI. Volledig offline — je data verlaat je machine nooit.

### Ollama installeren

```bash
# 1. Installeer Ollama (macOS / Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Windows: download installer op https://ollama.com/download

# 2. Start de Ollama server
ollama serve
```

### Model downloaden

| Commando                  | Model               | Grootte | Aanbevolen voor              |
|---------------------------|---------------------|---------|------------------------------|
| `ollama pull llama3`      | Meta Llama 3 8B     | ~5 GB   | Algemeen, goed Nederlands    |
| `ollama pull mistral`     | Mistral 7B          | ~4 GB   | Snel, goed voor EU-talen     |
| `ollama pull phi3:medium` | Microsoft Phi-3 14B | ~9 GB   | Analyse & redeneren          |
| `ollama pull gemma2`      | Google Gemma 2 9B   | ~6 GB   | Lange context                |
| `ollama pull deepseek-r1` | DeepSeek-R1 7B      | ~5 GB   | Chain-of-thought redeneren   |

**Aanbeveling:** begin met `llama3` (stabiel, goed Nederlands) of `mistral` (sneller op oudere hardware).

### Gebruik

1. Open het **🧠 Notebook** tab
2. Selecteer in het linkerpaneel welke **notities** en **PDF-annotaties** als context meegestuurd worden — filter op tag
3. Stel een vraag — het model antwoordt op basis van jouw geselecteerde kennis

De geselecteerde context wordt als systeem-prompt meegestuurd. Antwoorden streamen in real-time.

**Voorbeeldvragen:**
- *"Geef een overzicht van mijn notities over [onderwerp]"*
- *"Welke verbanden zie je tussen deze notities?"*
- *"Maak een samenvatting van de gemarkeerde PDF-passages"*
- *"Welke thema's komen het meest voor?"*
- *"Stel verdiepende vragen op basis van dit materiaal"*

### Ollama URL aanpassen

Standaard verwacht de server Ollama op `http://localhost:11434`. Aanpassen via omgevingsvariabele:

```bash
OLLAMA_URL=http://192.168.1.10:11434 python3 server.py
```

---

## 📱 iPad / Mobiel

De app werkt volledig op iPad (Safari).

| Schermgrootte | Layout                                  |
|---------------|-----------------------------------------|
| > 1200px      | Volledige 3-kolom layout               |
| 768–1200px    | Sidebar via ☰ toggle                   |
| < 768px       | Bottom navigation, sidebar als drawer  |

- **Tekst selecteren in PDF:** sleep handvaatjes → tik ✏ Annoteren
- **Zoomen in PDF:** pinch-to-zoom
- **Navigeren:** bottom nav bar (📝 / 🕸 / 📄 / 🧠)
- **Netwerktoegang:** start server met `--host 0.0.0.0`, open het getoonde netwerk-IP in Safari

---

## 🔗 Zettelkasten Links

```markdown
Gebruik [[ID]] of [[Titel]] voor bidirectionele links.
Backlinks worden automatisch getoond onderaan elke notitie.
```

---

## 📦 Projectstructuur

```
zettelkasten-python-app/
├── server.py          ← Python backend (geen externe dependencies)
├── README.md
└── static/
    ├── index.html     ← HTML shell + CSS
    └── app.js         ← React frontend (canvas VIM, graaf, PDF, LLM)
```

---

## 💡 Tips

- **Meerdere vaults:** start meerdere servers op verschillende poorten
- **Git backup:** de vault map is gewone tekst — perfect voor git
- **Obsidian-compatibel:** notities zijn standaard Markdown
- **Privacy:** de Notebook LLM draait volledig lokaal, geen data naar buiten
- **Zoeken:** `/zoekterm` in de sidebar, of `/` in NORMAL mode in de editor
