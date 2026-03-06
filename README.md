# 🗃️ Zettelkasten VIM

> Zelfstandige Python desktop-app voor kennisbeheer. Notities als Markdown op schijf, PDF bibliotheek met annotaties, afbeeldingenbeheer, Obsidian-stijl kennisgraaf, canvas VIM-editor, interactieve mindmap (visueel én Mermaid-syntax), web-importer, en een lokale AI notebook via Ollama — volledig offline, geen cloud, geen pip-packages vereist.

---

## 🚀 Installatie & Starten

### Vereisten
- **Python 3.8+** — geen pip-packages nodig, puur stdlib
- Moderne browser (Chrome, Firefox, Safari, of iPad Safari)
- **Ollama** (optioneel) — voor AI-functies: samenvatting, beschrijving, chat, mindmap, web-import

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
| Mode    | Activeer       | Beschrijving           |
|---------|----------------|------------------------|
| INSERT  | `i` / `a`      | Tekst schrijven        |
| NORMAL  | `Esc`          | Navigatie & commando's |
| COMMAND | `:`            | Ex-commando's          |
| SEARCH  | `/`            | Zoeken in document     |

### Navigatie (NORMAL)
| Toets       | Actie                      |
|-------------|----------------------------|
| `h j k l`   | Karakter / regel           |
| `w` / `b`   | Woord vooruit / achteruit  |
| `0` / `$`   | Begin / einde regel        |
| `gg` / `G`  | Begin / einde document     |
| `Ctrl+d/u`  | Halve pagina omlaag/omhoog |

### Bewerken (NORMAL)
| Toets          | Actie                          |
|----------------|--------------------------------|
| `i` / `a`      | INSERT voor / na cursor        |
| `o` / `O`      | Nieuwe regel onder / boven     |
| `dd`           | Verwijder regel                |
| `yy` / `p`     | Kopieer / plak regel           |
| `x`            | Verwijder karakter             |
| `u` / `Ctrl+r` | Undo / Redo                    |

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

### Muiswiel scrollen
In de canvas-editor scroll je met het muiswiel door lange notities (3 regels per notch).

---

## 🔗 Notitie Links & Media

### Links invoegen via 🔗 koppelen knop
De editor heeft een gecombineerde **🔗 koppelen** dropdown voor notities, PDFs én afbeeldingen:

1. Open een notitie in de editor
2. Klik **🔗 koppelen** → dropdown met zoekbalk (autofocus) en type-filter
3. Zoek op titel of tag → klik item → link wordt ingevoegd **op de cursorpositie**

> De dropdown gebruikt `onMouseDown` + `preventDefault` zodat de editorvocus niet verloren gaat en de cursorpositie behouden blijft.

Syntax die wordt ingevoegd:
```markdown
[[Andere Notitie]]           ← bidirectionele notitie-link
[[pdf:rapport.pdf]]          ← klikbare PDF-link
![[img:foto.png]]            ← ingesloten afbeelding
```

Backlinks worden automatisch onderaan elke notitie getoond.

---

## 📄 Notitie Preview

Notities worden weergegeven in **plain** of **🎨 render** modus (wisselknop rechtsboven).

### Render modus
- `##` koppen, **vet**, *cursief*, `code`, tabellen
- `[[links]]` klikbaar → springt naar die notitie
- `![[img:naam]]` → ingesloten afbeelding
- `[[pdf:naam]]` → klikbare PDF-link
- ` ```mindmap ` blokken → **interactieve canvas-preview** (zie Mermaid Mindmap)

### Meta-paneel (desktop)
Klik de smalle strip aan de rechterkant van een notitie om het meta-paneel te openen/sluiten. Toont aanmaakdatum, wijzigingsdatum, aantal woorden, gekoppelde bestanden, en tags.

---

## 🏷️ Tags & Filteren

### Tag Filter Bar
Elke tab met notities of annotaties heeft een **inklapbare tag-filterbalk**:

- Klik **▶ TAGS** om uit te klappen → zoekbalk verschijnt (autofocus)
- Typ om tags te doorzoeken
- Klik een tag om te filteren; klik opnieuw of `×` om te wissen
- Scrollbaar bij veel tags (max 180px hoog)
- Teller toont `X van Y tags`
- Badge toont actief filter of totaal aantal tags

Het aantal zichtbare tags vóór inklappen verschilt per context:

| Context | Max zichtbaar |
|---------|--------------|
| Sidebar | 10 |
| Graaf, Mindmap, Notebook | 6 |
| PDF, Afbeelding annotaties | 5 |

---

## 🕸️ Kennisgraaf

Force-directed graaf in Obsidian-stijl.

| Actie          | Effect                        |
|----------------|-------------------------------|
| Klik node      | Opent de notitie              |
| Sleep node     | Herpositioneer                |
| Hover          | Tooltip met titel en tags     |
| Tag klikken    | Filtert graaf op die tag      |
| "lokaal" knop  | Toont alleen directe buren    |
| "orphans" knop | Notities zonder verbindingen  |

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
- Samenvatting opgeslagen als notitie met tags `#samenvatting #pdf` en een bronlink
- **Handmatig:** klik **🧠 samenvatten** naast de bestandsnaam

### Annoteren
- **Desktop:** selecteer tekst → popup verschijnt automatisch
- **iPad:** selecteer tekst met handvaatjes → tik **✏ Annoteren**
- Kies kleur, voeg notitie en tags toe → **✓ Opslaan**
- Annotatiepaneel toont **alleen annotaties van de geopende PDF**

### PDF verwijderen
Via de 🗑 knop in de bibliotheeklijst of toolbar:
- Verwijdert het PDF-bestand
- Verwijdert alle annotaties van die PDF
- Verwijdert gekoppelde samenvatting-notities automatisch

---

## 🖼️ Afbeeldingen

### Uploaden & automatische beschrijving
1. Open **🖼 Plaatjes** tab
2. Sleep een afbeelding of klik **+ upload**
3. `llama3.2-vision` genereert automatisch een beschrijving
4. Een notitie wordt aangemaakt met `![[img:naam]]` en de beschrijving

### Pin-annotaties op afbeeldingen
Identiek aan PDF-annotaties:
1. Klik op een afbeelding → plaatst een gekleurde pin
2. Popup: voer notitietekst en tags in, kies kleur → **✓ Opslaan**
3. Annotatiepaneel rechts toont alle pins van de geselecteerde afbeelding
4. Opgeslagen in `vault/annotations/_image_annotations.json`
5. Automatisch verwijderd bij verwijderen van de afbeelding

### Afbeelding verwijderen
Klik 🗑 op een afbeeldingskaart:
- Toont bevestiging met lijst van gekoppelde notities
- Verwijdert de afbeelding, alle pin-annotaties én gekoppelde notities

---

## 🗺️ Mindmap

De mindmap-tab heeft drie modi, schakelbaar bovenin het controls-paneel.

### 🕸 Vault Mindmap
Automatische visuele mindmap van alle notities en tags.
- Layout: **radiaal** (cirkel) of **boom** (horizontaal)
- Zoom/pan met muis; klik node om notitie te openen
- Tag-filter om alleen een deelboom te tonen
- Knop **💾 Opslaan als notitie** → slaat de structuur op als Markdown-notitie

### 🧠 AI Mindmap
Gegenereerd via het LLM Notebook:
1. Open **🧠 Notebook** → selecteer context → klik **🗺 mindmap**
2. Bekijk het resultaat in de **🗺 Mindmap** tab via de **🧠 AI** knop
- 3-laags hiërarchie: root → takken → subtopics → details
- Layout: radiaal of boom

### 🌿 Mermaid Mindmap
Schrijf mindmaps in Mermaid-syntax met **live split-screen preview**.

**Syntax:**
```
mindmap
  root((Hoofdonderwerp))
    Tak A
      Sub A1
        Detail
      Sub A2
    Tak B
      Sub B1
```

**Mogelijkheden:**
- **Syntax highlighting** in de editor: kleuren identiek aan de canvas-preview
  - `mindmap` header → grijs/cursief
  - `root((…))` → blauw, vet
  - Elke tak + alle kinderen → eigen kleur (blauw, groen, oranje, paars…)
  - Diepere nodes → zelfde kleur, lichtere opaciteit
- **Live canvas-preview** rechts: Reingold-Tilford tree layout, nooit overlappende nodes
- **Tab-toets** voegt 2 spaties in voor inspringing
- **Pan & zoom** in de preview (scroll = zoomen, sleep = verschuiven)
- **Opslaan als notitie** met eigen titel en tags

**Automatisch omzetten:** klik op 🌿 Mermaid → de huidige vault- of AI-mindmap wordt direct omgezet naar Mermaid-syntax als startpunt. Alle labels worden volledig (onafgekapt) overgenomen.

**Bewerken na opslaan:** Mermaid-notities tonen in de preview een interactief canvas met knoppen:
- **⊞ uitvouwen** — vergroot canvas van 320px naar 520px hoog
- **✏ bewerken** — opent de split-editor overlay met de bestaande code
- Na opslaan wordt de notitie direct bijgewerkt

---

## 🌐 Web Importer

Importeer webpagina's als Markdown-notitie (Instapaper-stijl).

1. Open **🌐 Import** tab
2. Plak een URL → klik **Importeren**
3. De server haalt paginatekst op, downloadt afbeeldingen (max 20, min 2 KB, geen iconen/trackers), en laat het LLM de tekst opschonen naar nette Markdown
4. Preview: bewerkbare Markdown links, metadata + afbeeldinggrid rechts
5. **Afbeeldingen selecteren:** klik thumbnails aan/uit — alleen de aangevinkte worden in de notitie ingevoegd; alle afbeeldingen worden sowieso opgeslagen in Plaatjes
6. Pas titel en tags aan → **✓ Opslaan als notitie**

> Afbeeldingen worden **nooit** automatisch in de markdown ingevoegd — altijd bewuste keuze via de thumbnailgrid.

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

| Model                    | Commando                         | Grootte | Gebruik                       |
|--------------------------|----------------------------------|---------|-------------------------------|
| **Llama 3.2 Vision 11B** | `ollama pull llama3.2-vision`    | ~8 GB   | **Standaard** — tekst + beeld |
| Llama 3 8B               | `ollama pull llama3`             | ~5 GB   | Snel, goed Nederlands         |
| Mistral 7B               | `ollama pull mistral`            | ~4 GB   | Snel, EU-talen                |
| Phi-3 Medium 14B         | `ollama pull phi3:medium`        | ~9 GB   | Analyse & redeneren           |
| Gemma 2 9B               | `ollama pull gemma2`             | ~6 GB   | Lange context                 |

`llama3.2-vision` is het standaardmodel voor alle AI-taken: PDF samenvatten, afbeelding beschrijven, chat, mindmap genereren, en web-import opschonen. Voor gescande PDFs wordt automatisch de eerste pagina visueel geanalyseerd.

### Context selecteren (linkerpaneel)
- **Notities** — vink aan, filter op tag
- **PDFs** — alle PDFs selecteerbaar, ook zonder annotaties (server extraheert tekst automatisch)
- **Afbeeldingen** — voor visuele analyse

### AI-indicator menubalk
Wanneer een AI-taak actief is verschijnt rechts in de menubalk een pulserend blauw bolletje:
```
● Samenvatten: rapport.pdf…
● AI beschrijft: foto.png…
```

### Ollama op ander apparaat

```bash
OLLAMA_URL=http://192.168.1.10:11434 python3 server.py
```

---

## 📊 Menubalk Statistieken

De menubalk toont live statistieken van de vault als prominente badges:

| Badge       | Betekenis               |
|-------------|-------------------------|
| **N** ZETTEL | Aantal notities        |
| **N** TAGS   | Aantal unieke tags     |
| **N** PDF    | Aantal PDF-bestanden   |
| **N** IMG    | Aantal afbeeldingen    |

---

## 📱 iPad / Mobiel

| Schermgrootte | Layout                                  |
|---------------|-----------------------------------------|
| > 1200px      | Volledige 3-kolom layout               |
| 768–1200px    | Sidebar via ☰ toggle                   |
| < 768px       | Bottom navigation, sidebar als drawer  |

- **Tekst selecteren in PDF:** sleep handvaatjes → tik ✏ Annoteren
- **Zoomen in PDF:** pinch-to-zoom
- **Navigeren:** bottom nav bar (📝 / 🕸 / 📄 / 🖼 / 🗺 / 🧠 / 🌐)
- **Netwerktoegang:** start met `--host 0.0.0.0`, open het getoonde IP in Safari

---

## 📦 Projectstructuur

```
zettelkasten-python-app/
├── server.py          ← Python backend, puur stdlib (~900 regels)
├── README.md
└── static/
    ├── index.html     ← HTML shell + PDF.js initialisatie
    └── app.js         ← React frontend (~6800 regels)
```

---

## 🔧 Technische Details

### PDF tekst extractie — geen pip nodig
Pure Python stdlib implementatie (`zlib` + `re`). Fallback-volgorde:
1. Pure stdlib extractie (FlateDecode streams + `BT...ET` tekstblokken)
2. `pypdf` (als geïnstalleerd)
3. `pdfminer` (als geïnstalleerd)
4. Visuele analyse via `llama3.2-vision` + `pdftoppm` (voor gescande PDFs)

### PDF.js initialisatie
`GlobalWorkerOptions.workerSrc` wordt direct na het laden in `index.html` ingesteld — voorkomt race-conditions en "Load failed" fouten.

### Mermaid Canvas Renderer
Zelfgebouwde canvas-renderer zonder externe libraries:
- **Tree layout** (Reingold-Tilford-achtig): post-order berekening van subtree-hoogte per node, pre-order toewijzing van y-posities → nodes overlappen nooit
- **Auto-fit**: boom wordt altijd ingepast in het canvas met `fitZoom`
- **Kleur per tak**: alle kinderen erven de kleur van hun eerste-niveau bovenliggende tak
- **Pan & zoom**: scroll = zoomen gecentreerd op muislocatie, sleep = verschuiven
- **Bezier-curves**: van rechterkant parent naar linkerkant kind

### Mermaid Syntax Highlighting
Overlay-techniek: transparante `textarea` zweeft boven een `div` met gekleurde `<span>`-elementen:
- Diepte bepaald door inspringing (2 spaties = 1 niveau)
- Tak-index telt op bij elke diepte-2 node, wordt geërfd door alle kinderen
- Opaciteit daalt per diepteniveau (`ff` → `cc` → `99` → `77`) voor visuele hiërarchie
- `((…))`, `(…)`, `[…]` node-syntaxis apart gekleurd: haakjes grijs, label in takkleur
- Scroll gesynchroniseerd tussen textarea en backdrop

### Mindmap → Mermaid conversie
Bij wisselen naar Mermaid-modus wordt de huidige mindmap (vault of AI) omgezet:
- Alle nodes hebben altijd `fullLabel` (onafgekapt) naast het visueel afgekapte `label`
- `nodesToMermaid()` wandelt de boom recursief, schrijft `root((…))` voor de rootnode en gewone inspringing voor kinderen
- Sorteert kinderen op y-positie (top→bottom) voor een logische leesvolgorde

### Web Importer
- Pure stdlib HTTP-client (`urllib`) — geen pip nodig
- HTML-parser (`html.parser`) extraheert artikeltekst en afbeelding-URLs
- Skip-filters voor iconen/logo's/trackers (URL-patronen + min. 2 KB bestandsgrootte)
- Afbeeldingen opgeslagen in `vault/images/` met domein-prefix voor uniciteit
- LLM schoont de tekst op — afbeeldingen worden **nooit** automatisch ingevoegd in de markdown

---

## 💡 Tips

- **Meerdere vaults:** start meerdere servers op verschillende poorten
- **Git backup:** de vault map is gewone tekst — perfect voor git
- **Obsidian-compatibel:** notities zijn standaard Markdown
- **Privacy:** alle AI draait lokaal via Ollama, geen data naar buiten
- **Zoeken:** typ in de zoekbalk bovenin de sidebar, of `/` in NORMAL mode in de editor
- **Samenvatting opnieuw:** klik 🧠 samenvatten in de PDF-toolbar
- **Mermaid snel starten:** klik 🌿 Mermaid — de huidige vault-structuur wordt direct als startpunt omgezet
- **Afbeeldingen in import:** selecteer bewust via de thumbnailgrid; niet-geselecteerde worden wél in Plaatjes opgeslagen maar niet in de notitie gevoegd
- **Mermaid bewerken:** klik het groene canvas-blok in een notitie-preview om de editor te openen
