# 🗃️ Zettelkasten VIM

> Zelfstandige Python desktop app voor kennisbeheer. Notities als Markdown op schijf, PDF bibliotheek met annotaties, afbeeldingenbeheer, Obsidian-stijl kennisgraaf, canvas VIM-editor, mindmap generator, en een lokale AI notebook via Ollama — volledig offline, geen cloud, geen pip-packages vereist.

---

## 🚀 Installatie & Starten

### Vereisten
- **Python 3.8+** — geen pip-packages nodig, puur stdlib
- Moderne browser (Chrome, Firefox, Safari, of iPad Safari)
- **Ollama** (optioneel) — voor AI-functies: samenvatting, beschrijving, chat, mindmap

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

# Verbose logging
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
├── images/
│   └── foto.png
└── config.json
```

**Vault wisselen**
- CLI: `python3 server.py --vault /pad/naar/vault`
- In app: ⚙ Instellingen → voer nieuw pad in

---

## ⌨️ VIM Editor

Canvas-gebaseerde editor — Escape werkt altijd, geen browser-interferentie.

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
| `u` / `Ctrl+r` | Undo / Redo               |

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

### Links invoegen via 🔗 link knop
De editor heeft een **🔗 link** knop in de toolbar voor het snel koppelen van notities:

1. Open een notitie in de editor
2. Klik **🔗 link** → dropdown opent met zoekbalk (autofocus)
3. Typ een zoekterm — lijst filtert live op titel én tags
4. Klik op een notitie → `[[Notitie Titel]]` wordt ingevoegd

### Media koppelen via 📎 koppelen knop
1. Klik **📎 koppelen** → dropdown met alle PDFs en afbeeldingen
2. Klik een item → syntax wordt ingevoegd:
   - PDF: `> 📄 **PDF:** [[pdf:bestand.pdf]]`
   - Afbeelding: `![[img:foto.png]]`

### Syntax overzicht
```markdown
[[Andere Notitie]]        ← bidirectionele notitie-link
[[pdf:rapport.pdf]]       ← klikbare PDF-link
![[img:foto.png]]         ← ingesloten afbeelding
```

Backlinks worden automatisch getoond onderaan elke notitie.

---

## 🕸️ Kennisgraaf

Force-directed graaf in Obsidian-stijl.

| Actie          | Effect                       |
|----------------|------------------------------|
| Klik node      | Opent de notitie             |
| Sleep node     | Herpositioneer               |
| Hover          | Tooltip met titel en tags    |
| Tag klikken    | Filtert graaf op die tag     |
| "lokaal" knop  | Toont alleen directe buren   |
| "orphans" knop | Notities zonder verbindingen |

Node-grootte = aantal verbindingen. Kleur per tag-groep.

---

## 📄 PDF Viewer

### PDF's laden
1. **Nieuw:** klik `:open PDF` → opgeslagen in `vault/pdfs/`
2. **Bibliotheek:** klik `📚 bibliotheek` → kies eerder geopend bestand

### Automatische samenvatting
Bij elke upload start automatisch een AI-samenvatting op de achtergrond:
- Pulserend **"Samenvatten…"** icoontje in de PDF-toolbar
- Globale AI-indicator in de menubalk toont de voortgang
- Samenvatting wordt opgeslagen als notitie met tags `#samenvatting #pdf`
- **Handmatig:** klik **🧠 samenvatten** naast de bestandsnaam (ook voor bestaande PDFs)

### Annoteren
- **Desktop:** selecteer tekst → popup verschijnt automatisch
- **iPad:** selecteer tekst met handvaatjes → tik **✏ Annoteren**
- Kies kleur, voeg notitie en tags toe → **✓ Opslaan**
- Het annotatiepaneel toont **alleen annotaties van de geopende PDF** — is geen PDF open, dan is het paneel leeg

### PDF verwijderen
Via de 🗑 knop in de bibliotheeklijst of in de toolbar:
- Verwijdert het PDF-bestand
- Verwijdert alle annotaties van die PDF
- Verwijdert gekoppelde samenvatting-notities automatisch

### Schalen
- Desktop: `−` / `+` knoppen in toolbar
- iPad: pinch-to-zoom

---

## 🖼️ Afbeeldingen

### Uploaden & automatische beschrijving
1. Open **🖼 Plaatjes** tab
2. Sleep een afbeelding of klik **+ upload**
3. `llama3.2-vision` genereert automatisch een beschrijving
4. Een notitie wordt aangemaakt met `![[img:naam]]` en de beschrijving

### Afbeelding verwijderen
Klik 🗑 op een afbeeldingskaart:
- Toont een bevestiging met de lijst van gekoppelde notities die mee worden verwijderd
- Verwijdert de afbeelding én alle gekoppelde notities

---

## 🗺️ Mindmap

Genereer een visuele mindmap vanuit notities én/of PDFs:

1. Open **🧠 Notebook** tab
2. Selecteer notities en/of PDFs in het contextpaneel links
3. Klik **🗺 mindmap**
4. Bekijk de visuele weergave in het **🗺 Mindmap** tab

**Alle PDFs zijn selecteerbaar** — ook zonder annotaties. De server extraheert dan automatisch de tekst. Subheader toont: *"geen annotaties — tekst via AI"*.

Layout-opties: radiaal of boom | zoom/pan | klik node om notitie te openen.

---

## 🧠 Notebook LLM

Stel vragen over notities, PDFs en afbeeldingen via een lokale AI. Volledig offline.

### Ollama installeren

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows: https://ollama.com/download

ollama serve
ollama pull llama3.2-vision    # aanbevolen standaardmodel
```

### Modellen

| Model                    | Commando                         | Grootte | Gebruik                      |
|--------------------------|----------------------------------|---------|------------------------------|
| **Llama 3.2 Vision 11B** | `ollama pull llama3.2-vision`    | ~8 GB   | **Standaard** — tekst + beeld |
| Llama 3 8B               | `ollama pull llama3`             | ~5 GB   | Snel, goed Nederlands        |
| Mistral 7B               | `ollama pull mistral`            | ~4 GB   | Snel, EU-talen               |
| Phi-3 Medium 14B         | `ollama pull phi3:medium`        | ~9 GB   | Analyse & redeneren          |
| Gemma 2 9B               | `ollama pull gemma2`             | ~6 GB   | Lange context                |

`llama3.2-vision` is het standaardmodel voor alle AI-taken: PDF samenvatten, afbeelding beschrijven, chat en mindmap. Voor gescande PDFs zonder tekst wordt automatisch de eerste pagina visueel geanalyseerd.

### AI-indicator in menubalk

Wanneer een AI-taak actief is verschijnt rechts in de menubalk een pulserend blauw bolletje:

```
● Samenvatten: rapport.pdf…
● AI beschrijft: foto.png…
```

### Context selecteren (linkerpaneel)

- **Notities** — vink aan, filter op tag
- **PDFs** — alle PDFs selecteerbaar, ook zonder annotaties
- **Afbeeldingen** — voor visuele analyse

### Voorbeeldvragen
- *"Geef een overzicht van mijn notities over [onderwerp]"*
- *"Welke verbanden zie je tussen deze notities?"*
- *"Maak een samenvatting van de PDF-passages"*
- *"Welke thema's komen het meest voor?"*

### Ollama op ander apparaat

```bash
OLLAMA_URL=http://192.168.1.10:11434 python3 server.py
```

---

## 📱 iPad / Mobiel

| Schermgrootte | Layout                                 |
|---------------|----------------------------------------|
| > 1200px      | Volledige 3-kolom layout              |
| 768–1200px    | Sidebar via ☰ toggle                  |
| < 768px       | Bottom navigation, sidebar als drawer |

- **Tekst selecteren in PDF:** sleep handvaatjes → tik ✏ Annoteren
- **Zoomen in PDF:** pinch-to-zoom
- **Navigeren:** bottom nav bar (📝 / 🕸 / 📄 / 🖼 / 🗺 / 🧠)
- **Netwerktoegang:** start met `--host 0.0.0.0`, open het getoonde IP in Safari

---

## 📦 Projectstructuur

```
zettelkasten-python-app/
├── server.py          ← Python backend, puur stdlib (~648 regels)
├── README.md
└── static/
    ├── index.html     ← HTML shell + PDF.js initialisatie
    └── app.js         ← React frontend (~4636 regels)
```

---

## 🔧 Technische details

### PDF tekst extractie — geen pip nodig
Pure Python stdlib implementatie (`zlib` + `re`) decompresteert FlateDecode streams en parseert `BT...ET` tekstblokken. Werkt voor de meeste tekst-PDFs zonder externe packages. Fallback-volgorde:
1. Pure stdlib extractie
2. `pypdf` (als geïnstalleerd)
3. `pdfminer` (als geïnstalleerd)
4. Visuele analyse via `llama3.2-vision` + `pdftoppm` (voor gescande PDFs)

### PDF.js initialisatie
De `GlobalWorkerOptions.workerSrc` wordt direct na het laden in `index.html` ingesteld, zodat er geen race-condition ontstaat en PDFs altijd correct laden zonder "Load failed" fout.

---

## 💡 Tips

- **Meerdere vaults:** start meerdere servers op verschillende poorten
- **Git backup:** de vault map is gewone tekst — perfect voor git
- **Obsidian-compatibel:** notities zijn standaard Markdown
- **Privacy:** alle AI draait lokaal via Ollama, geen data naar buiten
- **Zoeken:** `/zoekterm` in de sidebar, of `/` in NORMAL mode in de editor
- **Samenvatting opnieuw:** klik 🧠 samenvatten in de PDF-toolbar
