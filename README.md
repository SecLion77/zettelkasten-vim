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
    ├── BookLibrary.js      ← boeken-bibliotheek met Bol.com cover-ophalen
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
ollama pull gemma3:12b     # aanbevolen standaard (16 GB RAM)
ollama pull qwen3:8b       # alternatief (8 GB RAM, sterk NL/EN)
ollama pull llama3.3:8b    # stabiele allrounder (8 GB RAM)
```

> Ollama op een ander apparaat?
> ```bash
> OLLAMA_URL=http://192.168.1.10:11434 python3 server.py
> ```

#### Lokaal via Jan.ai (privé, geen kosten)

Jan.ai is een alternatief voor Ollama met een eigen desktop-interface.

1. Download Jan op [jan.ai](https://jan.ai)
2. Settings → Local API Server → stel een API-key in → **Start Server**
3. Zorg dat **CORS ingeschakeld** is
4. In Zettelkasten: ⚙ Instellingen → API-sleutels → **Jan.ai (lokaal)** → vul de key en URL in

Jan-modellen verschijnen automatisch onder **JAN.AI** in de modelpicker (🪐 icoon).

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
layer: bron                                ← bron | kritisch | eigen  (optioneel)
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
📚 Bibliotheek     → PDF | Plaatjes | Leeslijst | Review | Taken | ✦ Annotaties | 📚 Boeken
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
| Type-filter | Vluchtig / Literatuur / Permanent / Index (klik opnieuw om te wissen) |
| Laag-filter | 🔵 Bron / 🔴 Kritisch / 🟢 Eigen — filtert op `layer:` frontmatter |
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
| **Info** | Notitietype, laag, tags, ID, datums |

**Info-tab details:**
- **Notitietype** — stel in als Vluchtig / Literatuur / Permanent / Index
- **Laag** — stel in als 🔵 Bron / 🔴 Kritisch / 🟢 Eigen (slaat `layer:` op in frontmatter)
- **Tags** — direct bewerken met autocomplete (AI-tags via de editor-toolbar)

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

- **📝 Notities** (standaard, groen) — zoekt alleen in notities, direct snel
- **📝+📄 Alles** — zoekt ook in geïndexeerde PDFs

### PDF-zoekindex
PDFs worden geïndexeerd via `pdf_indexer.py` als apart proces — de server blijft altijd responsief. De index (`./zettelkasten_pdf_index.json`) wordt incrementeel bijgehouden op basis van bestandsdatum.

```bash
# Handmatig indexeren (na nieuwe PDFs toevoegen)
python3 pdf_indexer.py --vault /pad/naar/vault

# Volledige herindexering
python3 pdf_indexer.py --vault /pad/naar/vault --rebuild
```

Vereist: `pip3 install pdfminer.six --break-system-packages` (of `pypdf` als fallback).

In de zoekbalk zie je `📄 N PDFs geïndexeerd` en een `↺ herindex` knop als PDF-zoeken actief is.

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

**Linker paneel**: 📝 Notities of 🎨 Canvas (wisselbaar via tab-strip)

**Rechter tabs**: Zoeken · Graaf · Mindmap · Notebook · Canvas · Taken · ✦ Annotaties · Query · PDF · Plaatjes

### Workflow: links werken, rechts zoeken

Klik je rechts op een zoekresultaat of notitie uit Query/Taken, dan opent die notitie als **preview-overlay** in het rechter paneel — het linker paneel blijft onaangeraakt. De preview heeft twee knoppen:

- **←** — sluit preview, terug naar zoeken/query
- **✏ Open links** — laad de notitie in de linker editor

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

### Statistieken

Het zijpaneel toont live graafstatistieken: aantal notities, tags, links, wees-nodes, clusters en de meest gelinkte hub-notitie.

### Peek-panel

Dubbelklik op een node → slide-in preview rechts met markdown, navigeerbare wiki-links, ◎ Focus, 📖 Open en **🕸 Notebook** knoppen.

### Graph → Notebook koppeling

Vanuit de graaf kun je direct naar de Notebook navigeren met rijke context:

- **Peek-panel** → 🕸 Notebook — stuurt de geselecteerde notitie + buren + community mee als GraphRAG-context
- **Verrassingspanel** → 🕸 Notebook — stuurt beide notities + verbindingsredenen mee voor diepere analyse

---

## 📄 PDF-bibliotheek

- Volledig scherm als geen PDF open
- Zoeken op naam en inhoud (via PDF-zoekindex)
- **⬆ PDF importeren** altijd beschikbaar

### Annotaties

Selecteer tekst → annotatiepopup met notitieveld, tags (**AI-suggesties**) en kleurkiezer.

**Kleurcodering — gekoppeld aan drie-lagen:**

| Kleur | Label | Gebruik |
|-------|-------|---------|
| 🟡 Geel | Citaat | Letterlijke aanhalingen |
| 🔵 Blauw | Bron | Info uit externe bron → `{.bron}` |
| 🔴 Rood | Kritisch | Sleutelbegrippen / actie → `{.kritisch}` |
| 🟢 Groen | Eigen | Eigen interpretatie → `{.eigen}` |
| 🟣 Paars | Vraag | Onduidelijk / open vraag |

### ✏ Leesnotitie-zijpaneel

Klik **◀✏** rechts van de PDF voor een apart notitiepad naast de PDF:

- Schrijf vrijuit in Markdown terwijl je leest
- **+ p.12** — voegt `## Pagina 12` koptekst in
- **+ citaat** — voegt geselecteerde tekst in als `> blockquote`
- **✓ Opslaan** — slaat op als Zettelkasten-notitie met tag `leesnotitie`
- Bij heropenen van dezelfde PDF laadt de bestaande notitie automatisch

### ⬆ Exporteer alle annotaties

Knop in het annotaties-paneel header. Bundelt alle highlights + notities als één literatuurnotitie:
- Gegroepeerd per pagina
- Highlights als `> citaat` blockquotes
- Blauw/Rood/Groen markeringen automatisch als `{.bron/.kritisch/.eigen}`
- Leesnotitie wordt onderaan toegevoegd

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

### GraphRAG

Schakel **GraphRAG ✓** in (standaard aan) om elke vraag te verrijken met relevante notities uit je kennisgraaf. De server zoekt automatisch de meest relevante notities op via TF-IDF + graafstructuur en stuurt die als context mee.

**Snelknoppen** (zichtbaar als GraphRAG aan staat):

| Knop | Vraag |
|------|-------|
| 🗺 Overzicht vault | Welke thema's en clusters zie je? |
| 🔍 Kennishiaten | Wat ontbreekt of moet uitgewerkt worden? |
| 💡 Verrassende links | Welke verbanden heb ik nog niet gelegd? |
| 📈 Sterke notities | Welke notities zijn het meest verbonden? |
| ⚡ Vluchtig → Permanent | Welke notities zijn rijp om te promoveren? |

Klikken vult het inputveld — je kunt de vraag nog aanpassen voor je verzendt.

**Gebruikte notities** — na elk GraphRAG-antwoord zie je onderaan welke notities de server heeft geraadpleegd (gele balk).

### Vanuit de graaf

Gebruik de **🕸 Notebook** knop in het peek-panel of verrassingspanel om direct met de geselecteerde notities als context te beginnen. De geselecteerde node-IDs worden automatisch meegestuurd zodat GraphRAG de juiste inhoud prioriteit geeft.

### Overige functies

- **Socratische modus** — AI stelt tegenvragen in plaats van antwoorden te geven
- Lopende taken zichtbaar via klokicoontje (met ✕ stop knop)
- **Plak in notitie** — selecteer tekst in het antwoord voor een plak-knop

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

## 🔵🔴🟢 Drie-lagen annotatiesysteem

Markeer tekst in drie informatielagen voor systematisch bronbeheer.

### Lagen

| Laag | Kleur | Betekenis |
|------|-------|-----------|
| **bron** | Blauw | Letterlijke info uit een externe bron |
| **kritisch** | Rood | Sleutelbegrippen, actiepunten, prioriteiten |
| **eigen** | Groen | Eigen interpretatie, verbanden, vragen |

### Inline syntax

```markdown
[Dit is een citaat]{.bron}
[Dit is belangrijk]{.kritisch}
[Mijn eigen gedachte]{.eigen}
```

### Bloksyntax

```markdown
:::bron
Meerdere regels uit een externe bron.
:::

:::kritisch
Iets wat ik absoluut moet onthouden.
:::

:::eigen
Mijn eigen analyse en verbanden.
:::
```

### VIM sneltoetsen (NORMAL modus)

| Toets | Actie |
|-------|-------|
| `` | Wrap woord/selectie in `[...]{.bron}` |
| `\k` | Wrap in `[...]{.kritisch}` |
| `\e` | Wrap in `[...]{.eigen}` |

Druk `\` in NORMAL modus → statusbalk toont de beschikbare combinaties.

### Filteren op laag

In de notitieslijst kun je filteren op het `layer:` frontmatter-veld. Stel de laag in via de **Info-tab** in de rechter zijbalk.

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

## 📚 Boeken-bibliotheek (Bibliotheek → Boeken)

Persoonlijke boekencollectie met coverafbeeldingen en voortgang bijhouden.

### Nieuw boek toevoegen

1. Klik **+ Boek toevoegen**
2. Plak een Bol.com URL → klik **Cover ophalen** — haalt cover, titel en auteur automatisch op
3. Vul type (🌳 Fysiek / 📱 Ebook), taal (🇳🇱 / 🇬🇧) en status in
4. Optioneel: Bitly URL voor een korte deellink

### Weergave en filters

| Element | Werking |
|---------|---------|
| **⊞ Grid** / **☰ Lijst** | Wissel tussen cover-raster en lijstweergave |
| **Alle / Bezig / Nog lezen / Uit** | Filter op status |
| Status-badge klikken | Wisselt status door (Nog lezen → Bezig → Uit) |
| ✏ icoontje | Bewerk boekgegevens |

### Opslag
Elk boek wordt opgeslagen als gewone notitie met tag `boek` en type `literature` — doorzoekbaar via de graaf en het zoekvenster.

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
- **Drie lagen** — `[tekst]{.bron/kritisch/eigen}` of `:::bron ... :::` voor annotaties; `\b/\k/\e` in VIM
- **Jan.ai** — alternatief voor Ollama; sluit aan via ⚙ Instellingen → Jan.ai (lokaal) → Start Server in Jan
- **GraphRAG snelknoppen** — klik 🗺/🔍/💡/📈/⚡ boven het inputveld voor directe vault-analyse
- **Graph → Notebook** — klik 🕸 Notebook in het peek-panel om een notitie met graafcontext te analyseren
- **Laag-filter** — filter notities op 🔵 Bron / 🔴 Kritisch / 🟢 Eigen via de type-filterbalk
- **Leesnotitie** — ◀✏ knop in PDF-viewer opent notitiepad naast de PDF; automatisch gekoppeld aan de PDF
- **PDF annotaties exporteren** — ⬆ exporteer in annotaties-paneel maakt één literatuurnotitie van alle highlights
- **Boeken** — Bibliotheek → Boeken voor je persoonlijke collectie met Bol.com cover-ophalen
- **PDF zoekindex** — 📝+📄 Alles in de zoekbalk om ook in PDFs te zoeken; ↺ herindex na nieuwe PDFs
- **Split preview** — klik een resultaat rechts → preview-overlay zonder linker editor te verstoren
