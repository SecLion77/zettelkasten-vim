# 🗃️ Zettelkasten VIM

> Zelfstandige Python desktop-app voor kennisbeheer. Notities als Markdown op schijf, PDF-bibliotheek met annotaties, afbeeldingenbeheer, Obsidian-stijl kennisgraaf, canvas VIM-editor, split-screen modus, interactieve mindmap, web-importer, Markdown- en Word-import, **bidirectionele links met rechter linkszijbalk**, **dagelijkse notitie**, **full-text én fuzzy zoeken**, **leeslijst met leestijd**, semantische kennisverrijking (TF-IDF + GraphRAG), **SmartTagEditor met automatische AI-suggesties**, **vrij canvas/whiteboard**, **datum-filter op notities**, **export naar Markdown met bronverwijzingen**, en een lokale AI-notebook via Ollama én cloud-modellen — optioneel volledig offline.

---

## 🚀 Installatie

### Vereisten

| Vereiste | Versie | Verplicht |
|----------|--------|-----------|
| Python | 3.11+ | ✅ Ja |
| Moderne browser | Chrome / Firefox / Safari | ✅ Ja |
| Ollama | nieuwste | ⚪ Optioneel (lokale AI) |

> Bij het eerste opstarten installeert de server automatisch de benodigde Python-pakketten:
> `pypdf`, `pikepdf`, `pdfminer.six`, `python-docx`
> Lukt het niet automatisch:
> ```bash
> pip install pypdf pikepdf pdfminer.six python-docx
> ```

---

### Stap 1 — Bestanden neerzetten

```
~/Downloads/zettelkasten-vim/
├── server.py
├── README.md
├── PROJECT.md              ← ontwikkelaarsdocumentatie
├── index.html
├── app.js
└── modules/
    ├── SpellEngine.js      ← spellcheck + completion engine
    ├── VimEditor.js        ← canvas VIM editor
    ├── TagFilterBar.js     ← tag-filter balk (graaf)
    ├── Graph.js            ← kennisgraaf
    ├── PDFViewer.js        ← PDF bibliotheek + viewer + annotaties
    ├── VaultSettings.js    ← instellingen modal
    ├── ImagesGallery.js    ← afbeeldingen gallerij
    ├── MermaidEditor.js    ← Mermaid, MindMap, LLMNotebook, FuzzySearch
    ├── ModelPicker.js      ← model selector
    ├── LinksSidebar.js     ← rechter zijbalk (backlinks, outlinks, info)
    ├── NoteEditor.js       ← notitie editor wrapper
    ├── NotePreview.js      ← preview + toolbar + export
    ├── NotesTab.js         ← orkestratielaag + sidebar-logica
    ├── NoteList.js         ← notitie-lijst + filters + datumfilter
    ├── TagManager.js       ← SmartTagEditor + TagManagerPanel
    ├── WebImporter.js      ← URL-, Markdown-, Word- en PPTX-import
    ├── ReadingList.js      ← leeslijst
    ├── StatsPanel.js       ← statistieken + schijfruimte
    ├── ReviewPanel.js      ← spaced repetition review
    ├── VaultCleanup.js     ← opschonen: CSS-rommel, gebroken links, wezen
    ├── Whiteboard.js       ← vrij canvas met kaarten en verbindingen
    ├── SmartLinkSuggester.js ← slimme linkvoorstellen
    ├── OutlineEditor.js    ← outline/bullet editor
    ├── TasksPanel.js       ← taken-overzicht
    ├── QueryPanel.js       ← dataview query interface
    ├── CalendarWidget.js   ← mini-kalender bij dagnotities
    ├── pdfService.js       ← PDF API-client
    ├── noteApi.js          ← notities API-client
    ├── noteStore.js        ← in-memory notities store
    └── annotationStore.js  ← PDF-annotaties store
```

---

### Stap 2 — Server starten

```bash
cd ~/Downloads/zettelkasten-vim

python3 server.py                                        # standaard (poort 8080)
python3 server.py --vault ~/Documenten/MijnNotities     # eigen vault map
python3 server.py --port 8080                            # andere poort
python3 server.py --host 0.0.0.0                         # bereikbaar op iPad / netwerk
python3 server.py --vault ~/Notes --port 8080 --verbose  # combineren
```

De browser opent automatisch op **http://localhost:8080**.

---

### Stap 3 — AI instellen

#### Lokaal via Ollama (privé, geen kosten)

```bash
curl -fsSL https://ollama.com/install.sh | sh

ollama serve
ollama pull llama3.2-vision      # aanbevolen (tekst + beeld, ~8 GB)
```

> Ollama op een ander apparaat?
> ```bash
> OLLAMA_URL=http://192.168.1.10:11434 python3 server.py
> ```

#### Cloud-modellen (API-sleutel vereist)

Voeg sleutels toe via ⚙ **Instellingen → API-sleutels**.

| Provider | Modellen | Sleutel aanmaken |
|----------|----------|-----------------|
| Anthropic | Claude Opus 4, Sonnet 4, Haiku 4.5 | console.anthropic.com |
| OpenAI | GPT-4.1, o4-mini | platform.openai.com |
| Google | Gemini 2.5 Pro, 2.5 Flash | aistudio.google.com |
| Mistral AI | Mistral Medium 3, Magistral Medium | console.mistral.ai |
| OpenRouter | Llama 4 Maverick, Qwen3 235B, DeepSeek R1, Kimi K2 | openrouter.ai |

> **Verbinding testen** — klik ⚡ naast een provider om direct te controleren of de sleutel werkt.

---

## 📁 Vault structuur

```
~/Documents/Zettelkast/
├── notes/
│   └── 20240315143022.md       ← elke notitie = één .md bestand
├── pdfs/
├── annotations/
├── images/
└── config.json
```

### Notitie-frontmatter

```yaml
---
id: 20240315143022
title: Mijn notitie
tags: ["kennisbeheer", "zettelkasten"]
noteType: permanent                        ← fleeting | literature | permanent | index
created: 2024-03-15T14:30:22              ← aanmaakdatum, nooit overschreven
modified: 2024-03-15T14:30:22             ← laatste opslagdatum
importedAt: 2024-03-15T14:30:22           ← alleen bij geïmporteerde notities
isRead: false                              ← leeslijst status
---
```

---

## 🗂️ Navigatiestructuur

```
📝 Schrijven       ← notities schrijven en bekijken
📚 Bibliotheek     → PDF | Plaatjes | Leeslijst | Review | Taken
🔍 Ontdekken       → Zoeken | Graaf | Mindmap | Notebook | Canvas | Query
🌐 Invoer          → URL/Word | PDF
⚙  Beheer          → Tags | Statistieken | Opschonen
```

---

## 📝 Notities

### Sidebars

De **linker sidebar** (notitieslijst) en **rechter sidebar** (links/info) zijn beide inklapbaar. De toggle-knop staat gecentreerd in de smalle rand aan de zijkant.

### Notitieslijst — filters en sortering

| Filter | Werking |
|--------|---------|
| Zoekbalk | Zoekt op titel, inhoud en tags |
| Type-filter | Vluchtig / Literatuur / Permanent / Index |
| Tag-filter | Filter op één specifieke tag |
| Sorteren ↕ | **recent** (gewijzigd) · **nieuw** (aangemaakt) · **A–Z** |
| Datumfilter 📅 | **alle** · **vandaag** · **week** · **maand** |

> Het datumfilter werkt op de `created` datum (aanmaakmoment), niet op de bestandsdatum.

### Notitietypen

| Type | Kleur | Gebruik |
|------|-------|---------|
| Vluchtig | Grijs | Snelle gedachte, tijdelijk |
| Literatuur | Blauw | Bronnotitie, referentie |
| Permanent | Groen | Uitgewerkt idee |
| Index | Oranje | Overzichtsnotitie, MOC |

### Rechter zijbalk (LinksSidebar)

| Tab | Inhoud |
|-----|--------|
| **← In** | Backlinks — notities die naar deze notitie linken |
| **→ Uit** | Outlinks — `[[links]]` in deze notitie |
| **+ Link** | Slimme zoekfunctie om links toe te voegen |
| **Info** | Notitietype, tags met AI-suggesties, ID, datums |

### Preview toolbar

De preview toont bovenaan de **notitietitel** (vetgedrukt), ID en tags.

| Knop | Actie |
|------|-------|
| ⬇ export md | Download Markdown met YAML frontmatter + bronverwijzingen |
| ✏ bewerken | Open in VIM-editor |
| 🔁 review | Markeer voor spaced repetition |
| 🔗 links | Slimme links paneel |
| 🧠 samenvatten | AI-samenvatting genereren |
| 🗑 del | Verwijderen |

### Promoveer-suggestie

Als een vluchtige notitie ouder is dan 2 dagen of 2+ wiki-links heeft, verschijnt een banner met **→ Permanent** of **→ Literatuur**.

---

## 📅 Dagelijkse notitie

In de notitieslijst staan twee knoppen voor dagnotities:

| Knop | Actie |
|------|-------|
| **📅** | Opent een mini-kalender — zie welke dagen notities hebben |
| **vandaag** | Opent of maakt direct de dagnotitie van vandaag |

### Mini-kalender
- Dagen met een dagnotitie zijn **groen** gemarkeerd
- Vandaag is **blauw**
- Klik op een dag → opent bestaande dagnotitie of maakt een nieuwe
- Navigeer tussen maanden met ‹ en ›

### Dagnotitie eigenschappen
- Dagnotities krijgen automatisch de tag `dagnotitie`
- Opnieuw klikken opent altijd de bestaande notitie (geen duplicaten)
- **Inbox-badge** — amber badge op de Schrijven-tab als er vluchtige notities >2 dagen wachten

---

## 📤 Export naar Markdown

Klik **⬇ export md** in de preview toolbar. Het bestand bevat YAML frontmatter (titel, type, tags, datums), de volledige inhoud met `[[links]]` omgezet naar echte titels, en een genummerde bronnenlijst onderaan.

---

## 🔍 Zoeken

### ⚡ Fuzzy zoeken
FZF-stijl zoeken over notities én vault-PDFs. Tolereert typefouten.

### 🔎 Full-text zoeken
Exacte zoekopdracht door alle notitie-content met regelnummer en context.

### Resultaat-viewer
- **Vim-navigatie**: `j`/`k` scrollen, `n`/`N` naar volgende/vorige treffer
- **Plakken**: in split modus → **◀ Plak selectie links**

---

## ⊞ Split-screen modus

Activeer via **⊞ split** knop of `:vs` in de editor.

- Opent altijd op **🔍 Zoeken**
- Sidebars klappen automatisch in

**Rechter tabs**: Zoeken · Graaf · Mindmap · Notebook · Canvas · **Taken** · **Query** · PDF · Plaatjes

| Toets | Actie |
|-------|-------|
| `Ctrl+W Ctrl+W` | Toggle focus links ↔ rechts |
| `Ctrl+H` / `Ctrl+L` | Focus naar links / rechts |

---

## 🎨 Canvas (Whiteboard)

Vrij canvas voor divergent denken.

- Kaarten aanmaken, verplaatsen, kleuren en verbinden
- Kaarten omzetten naar notities
- Beschikbaar als hoofd-tab én in split-mode
- Opslag automatisch in vault

---

## 🕸️ Kennisgraaf

### Knoppen

| Knop | Werking |
|------|---------|
| ⊞ fit | Alle nodes in beeld |
| 1:1 | Reset zoom |
| 💥 uiteen | Spreid nodes uiteen |
| 🎲 Verrassing | Onverwachte verbinding + AI-analyse |

### Weergavemodi

lokaal · orphans · hubs 🔥 · community · pad 🔍 · ≈ sem.

### Peek-panel

Dubbelklik op een node → slide-in preview rechts met markdown, navigeerbare wiki-links, ◎ Focus en 📖 Open knoppen.

---

## 📄 PDF-bibliotheek

- Volledig scherm als geen PDF open
- Zoeken op naam en inhoud
- **⬆ PDF importeren** altijd beschikbaar

### Annotaties

Selecteer tekst → annotatiepopup met notitieveld (schaalbaar), tags (**AI-suggesties**) en kleurkiezer.

### Samenvatting genereren

Open een PDF → **🧠 samenvatten** → verschijnt als losse notitie.

---

## 🌐 Import

| Type | Werking |
|------|---------|
| URL | AI verwijdert rommel, suggereert tags automatisch |
| Markdown | Direct importeren als notitie |
| Word (.docx) | AI genereert samenvatting en tags |
| PowerPoint (.pptx) | Omgezet naar PDF + samenvatting-notitie met slides |

---

## 🔗 Links-systeem

```markdown
[[Andere Notitie]]       ← bidirectionele notitie-link
[[pdf:rapport.pdf]]      ← klikbare PDF-link
![[img:foto.png]]        ← ingesloten afbeelding
```

**`[[` autocomplete** — typ `[[` in de editor voor een dropdown met notitietitels.

---

## 🏷️ Tag-systeem

**SmartTagEditor** aanwezig in editor, zijbalk, import en PDF-annotaties.

- **✦ AI-tags** — AI analyseert de inhoud en stelt relevante tags voor
- Typo-detectie met vervang-optie

| VIM-commando | Actie |
|-------------|-------|
| `:tag rust async` | Tags vervangen |
| `:tag+ nieuw` | Tag toevoegen |
| `:tag- oud` | Tag verwijderen |

---

## 🧠 Notebook LLM

- **🕸 GraphRAG** — verrijkt vragen met semantisch relevante notities
- **🔍 Hiaten** — analyseert kennishiaten
- Lopende taken zichtbaar via klokicoontje (met ✕ stop knop)

Model kiezen: klik de **modelnaam in de statusbalk** onderin.

---

## 🧹 Opschonen (Beheer → Opschonen)

| Actie | Werking |
|-------|---------|
| CSS-rommel | Verwijdert HTML-garbage uit notities |
| Gebroken links | Verwijdert `[[links]]` naar niet-bestaande notities |
| Lege notities | Verwijdert notities zonder titel én inhoud |
| Wezen-notities | Verwijdert notities zonder in- of outlinks |

Destructieve acties vereisen twee klikken (bevestiging).

---

## ✓ Taken (Bibliotheek → Taken)

Verzamelt alle `- [ ]` en `- [x]` items uit **alle notities** in één overzicht.

| Element | Werking |
|---------|---------|
| Filter | Open / Gedaan / Alle |
| Zoekbalk | Zoekt op taaknaam of notitietitel |
| Checkbox | Klik om taak direct aan/uit te vinken in de notitie |
| Notitietitel | Klik om de notitie te openen |
| Groepering | Taken zijn gegroepeerd per notitie |

> Taken worden ook herkend in split-modus (rechter paneel → Taken).

---

## 🔎 Query (Ontdekken → Query)

Dataview-achtige filterinterface om notities te bevragen op combinaties van eigenschappen.

### Beschikbare filters

| Filter | Opties |
|--------|--------|
| Type | Vluchtig / Literatuur / Permanent / Index |
| Tags | Meerdere tags tegelijk (AND-logica), met autocomplete |
| Datum | Van–tot (op aanmaakdatum) |
| Links | Heeft links / Geen links |
| Min. woorden | Numerieke drempel |
| Sorteren | Gewijzigd · Aangemaakt · Titel · Woorden · Links · ↑↓ |

Resultaten tonen type-kleur, tags, woordaantal, linkcount en datum. Klik op een notitie om hem te openen.

---

## ☰ Outline-editor

Schakel in de editor toolbar via **☰ outline** om van VIM-modus naar outline-modus te wisselen (en terug). De inhoud wordt automatisch vertaald tussen Markdown en bullets — geen data verlies bij wisselen.

### Shortcuts

| Toets | Actie |
|-------|-------|
| `Enter` | Nieuw bullet op zelfde niveau |
| `Shift+Enter` | Nieuwe lege regel (geen bullet) |
| `Tab` | Indenteren (één niveau dieper) |
| `Shift+Tab` | Uitrukken (één niveau omhoog) |
| `Backspace` op lege regel | Regel verwijderen |
| `↑` / `↓` | Navigeer tussen bullets |
| `Ctrl+S` | Opslaan |

### Auto-formatting
- Typ `- ` (streepje + spatie) → wordt automatisch een bullet
- Typ `# ` → wordt een koptekst (H1)
- Checkboxes: `- [ ]` en `- [x]` worden klikbare checkboxen

---

## ⌨️ VIM Editor

### Modi

| Mode | Activeer |
|------|----------|
| INSERT | `i` / `a` / `o` |
| NORMAL | `Esc` |
| VISUAL | `v` / `V` |
| COMMAND | `:` |

### Navigatie

| Toets | Actie |
|-------|-------|
| `h j k l` | Cursor bewegen |
| `w` / `b` | Woord voor/achteruit |
| `gg` / `G` | Begin/einde bestand |
| `Ctrl+D` / `Ctrl+U` | Halve pagina omlaag/omhoog |

### Ex-commando's

| Commando | Actie |
|----------|-------|
| `:w` / `:wq` | Opslaan / opslaan+sluiten |
| `:vs` | Split-screen openen |
| `:goyo` | Focusmodus |
| `:spell` | Spellcheck: nl → en → uit |
| `:tag+ naam` | Tag toevoegen |
| `:template naam` | Notitie-template laden |
| `:?` | Keyboard shortcuts overzicht |

### Templates

`dagnotitie` · `meeting` · `literatuur` · `project` · `vraag`

---

## 🐛 Debug

```javascript
// Browser console — aan:
localStorage.setItem('zk_debug', '1')
// Uit:
localStorage.removeItem('zk_debug')
// Of via URL: http://localhost:8080/?debug
```

---

## 💡 Tips

- **Datumfilter** — gebruik vandaag/week/maand om recente notities snel te vinden
- **Dagnotitie** — 📅 naast "nieuw zettel" voor de notitie van vandaag
- **Inbox-badge** — amber badge = vluchtige notities wachten op verwerking
- **Export** — ⬇ export md maakt een kant-en-klaar bestand met bronnenlijst
- **Split modus** — opent altijd op Zoeken; Canvas ook beschikbaar rechts
- **AI-tags** — werkt in editor, zijbalk én PDF-annotaties
- **Verbinding testen** — ⚡ in Instellingen test de API-sleutel direct
- **Graaf verrassing** — 🎲 vindt onverwachte verbindingen met AI-analyse
- **Lasso** — Shift+sleep in de graaf om een groep nodes te selecteren
- **Git backup** — vault is gewone tekst, perfect voor git
- **Obsidian-compatibel** — notities zijn standaard Markdown
- **iPad** — start met `--host 0.0.0.0`, open het getoonde IP in Safari
- **Shortcuts** — druk `?` in de editor voor alle toetscombinaties
- **Taken bijhouden** — gebruik `- [ ]` in notities, zie alle taken via Bibliotheek → Taken
- **Query** — filter notities op type+tags+datum+woorden via Ontdekken → Query
- **Outline** — schakel met ☰ outline in de editor toolbar; Tab/Shift+Tab voor indenteren
- **Embed** — `![[Notitietitel]]` in de editor om de inhoud van een notitie inline te tonen
- **Kalender** — 📅 in de notitieslijst toont welke dagen een dagnotitie hebben (groen)
