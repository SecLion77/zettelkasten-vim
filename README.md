# 🗃️ Zettelkasten VIM

> Zelfstandige Python desktop-app voor kennisbeheer. Notities als Markdown op schijf, PDF-bibliotheek met annotaties, afbeeldingenbeheer, Obsidian-stijl kennisgraaf, canvas VIM-editor, split-screen modus, interactieve mindmap, web-importer, Markdown- en Word-import, **bidirectionele links met rechter linkszijbalk**, **dagelijkse notitie**, **full-text én fuzzy zoeken met canvas viewer**, **leeslijst met leestijd**, semantische kennisverrijking (TF-IDF + GraphRAG), **SmartTagEditor met automatische AI-suggesties**, en een lokale AI-notebook via Ollama én cloud-modellen — optioneel volledig offline.

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
~/Apps/zettelkasten-python-app/
├── server.py
├── README.md
└── static/
    ├── index.html
    ├── app.js                  ← globals, constants, api, TagPill
    └── modules/
        ├── SpellEngine.js      ← spellcheck + completion engine
        ├── VimEditor.js        ← canvas VIM editor
        ├── TagFilterBar.js     ← tag-filter balk (graaf)
        ├── Graph.js            ← kennisgraaf
        ├── PDFViewer.js        ← PDF viewer + canvas mounters
        ├── VaultSettings.js    ← instellingen modal
        ├── ImagesGallery.js    ← afbeeldingen gallerij
        ├── MermaidEditor.js    ← Mermaid, MindMap, LLMNotebook, FuzzySearch
        ├── ModelPicker.js      ← model selector
        ├── LinksSidebar.js     ← links-zijbalk (backlinks, outlinks, linken)
        ├── NoteEditor.js       ← notitie editor wrapper
        ├── NotePreview.js      ← preview + semantisch verwant paneel
        ├── NotesTab.js         ← orkestratielaag + dagnotitie
        ├── NoteList.js         ← notitie-lijst + 📅 dagnotitie knop
        ├── NotesMeta.js        ← metadata-zijpaneel
        ├── TagManager.js       ← SmartTagEditor + TagManagerPanel
        ├── WebImporter.js      ← URL-, Markdown- en Word-import
        ├── ReadingList.js      ← leeslijst
        ├── StatsPanel.js       ← statistieken + schijfruimte
        ├── ReviewPanel.js      ← spaced repetition review
        ├── pdfService.js       ← PDF API-client
        ├── noteApi.js          ← notities API-client
        ├── noteStore.js        ← in-memory notities store
        └── annotationStore.js  ← PDF-annotaties store
```

---

### Stap 2 — Server starten

```bash
cd ~/Apps/zettelkasten-python-app

python3 server.py                                        # standaard (~/Zettelkasten, poort 7842)
python3 server.py --vault ~/Documenten/MijnNotities     # eigen vault map
python3 server.py --port 8080                            # andere poort
python3 server.py --host 0.0.0.0                         # bereikbaar op iPad / netwerk
python3 server.py --vault ~/Notes --port 8080 --verbose  # combineren
```

De browser opent automatisch op **http://localhost:7842**.
Bij `--host 0.0.0.0` toont het opstartbericht ook het netwerk-IP, bijv. `http://192.168.1.42:7842`.

De **server status indicator** in de topbar (groen ● online / rood ● offline) toont live of de server bereikbaar is.

---

### Stap 3 — AI instellen

#### Lokaal via Ollama (privé, geen kosten)

```bash
# macOS / Linux
curl -fsSL https://ollama.com/install.sh | sh

# Windows → https://ollama.com/download

ollama serve
ollama pull llama3.2-vision      # aanbevolen (tekst + beeld, ~8 GB)
```

> Ollama op een ander apparaat in het netwerk?
> ```bash
> OLLAMA_URL=http://192.168.1.10:11434 python3 server.py
> ```

#### Cloud-modellen (API-sleutel vereist)

Voeg sleutels toe via ⚙ **Instellingen → API-sleutels** (accordion — één provider tegelijk).

| Provider | Modellen | Sleutel aanmaken |
|----------|----------|-----------------|
| Anthropic | Claude Opus 4, Sonnet 4, Haiku 4.5 | console.anthropic.com |
| OpenAI | GPT-4.1, GPT-4.1 mini, o4-mini | platform.openai.com |
| Google | Gemini 2.5 Pro, 2.0 Flash | aistudio.google.com |
| Mistral AI | Mistral Medium 3, Small 3.1, Magistral Medium | console.mistral.ai |
| OpenRouter | Llama 4, Kimi K2.5, DeepSeek R1, Qwen3, Gemma 3 | openrouter.ai |

---

## 📡 Offline modus

```bash
# Eenmalige setup (met internet)
cd ~/Apps/zettelkasten-python-app/static/vendor
bash download-vendors.sh

# Daarna opstarten zonder internet
python3 server.py --offline
```

> De web-importer (URL → notitie) heeft altijd internet nodig.

---

## 📁 Vault structuur

```
~/Zettelkasten/
├── notes/
│   └── 20240315143022.md       ← elke notitie = één .md bestand
├── pdfs/
├── annotations/
│   ├── rapport.json            ← PDF-annotaties per bestand
│   └── _image_annotations.json ← afbeelding-beschrijvingen
├── images/
└── config.json                 ← instellingen, API-sleutels, PDF-opties
```

### Notitie-frontmatter

```yaml
---
id: 20240315143022
title: Mijn notitie
tags: ["kennisbeheer", "zettelkasten"]
created: 2024-03-15T14:30:22
modified: 2024-03-15T14:30:22
importedAt: 2024-03-15T14:30:22   ← alleen bij geïmporteerde notities
isRead: false                      ← leeslijst status
---
```

---

## 🗂️ Tabbladen

| Tab | Icoon | Inhoud |
|-----|-------|--------|
| Notities | 📝 | Schrijven, bekijken, doorzoeken |
| Graaf | 🕸 | Kennisgraaf van alle verbindingen |
| PDF | 📄 | PDF-bibliotheek met annotaties |
| Plaatjes | 🖼 | Afbeeldingen met AI-beschrijving |
| Zoeken | 🔍 | Fuzzy én full-text zoeken over notities én PDFs |
| Import | 🌐 | URL-, Markdown- en Word-import |
| Leeslijst | 📚 | Overzicht van alle geïmporteerde notities |
| Mindmap | 🗺 | Visuele mindmap, AI-mindmap of Mermaid-editor |
| Notebook | 🧠 | LLM-chat over notities, PDFs en afbeeldingen |
| Tags | 🏷 | Tag-beheer, samenvoegen, statistieken |
| Statistieken | 📊 | Vault-statistieken inclusief schijfruimte |

---

## 🔤 Weergave-instellingen

Via ⚙ **Instellingen → 🔤 Weergave**:

- **Tekstgrootte** — slider van 10 tot 14 px, ook via snelknoppen (10/11/12/13/14)
- Live preview toont direct hoe de gekozen grootte eruitziet
- Instelling wordt opgeslagen en hersteld bij herstart

Het hoofdlettertype is **Hack** (monospace). Code-blokken in Markdown gebruiken ook Hack.

---

## 🔗 Links-systeem

### Bidirectionele links

```markdown
[[Andere Notitie]]       ← bidirectionele notitie-link (pill-stijl)
[[pdf:rapport.pdf]]      ← klikbare PDF-link
![[img:foto.png]]        ← ingesloten afbeelding
```

Links worden weergegeven als **pills** met `[[` en `]]` aanduiding. Kapotte links krijgen een rood `✗`-icoon.

### Links-zijbalk (rechts)

Aan de rechterkant van elke notitie staat een inklapbare **🔗 Links** zijbalk met een ▶ knop om in te klappen en een 🔗 strook om weer uit te klappen.

| Tab | Inhoud |
|-----|--------|
| **← In** | Backlinks — alle notities die naar deze notitie linken |
| **→ Uit** | Outlinks — alle `[[links]]` in deze notitie |
| **+ Link** | Handmatig linken met slimme zoekfunctie |

**Op iPad:** de zijbalk start ingeklapt (24px strook met 🔗). Tik om uit te klappen.

---

## 📅 Dagelijkse notitie

De **📅** knop naast "＋ nieuw zettel" opent de dagnotitie van vandaag.

```markdown
# maandag 22-03-2026

## 📥 Inbox

## 💡 Ideeën

## ✓ Taken

- [ ]
```

- Dagnotities krijgen automatisch de tag `dagnotitie`
- Opnieuw klikken op 📅 opent altijd de bestaande notitie (geen duplicaten)
- Herkenbaar ID: `2026-03-22000000`

---

## 🔍 Zoeken

De Zoeken-tab heeft twee modi, wisselbaar via de toggle bovenaan:

### ⚡ Fuzzy zoeken
FZF-stijl zoeken over notities én vault-PDFs. Tolereert typefouten en volgorde.
- Spatie = AND (meerdere woorden)
- ↑↓ navigeert resultaten · Enter opent
- PDF-hits tonen pagina + regelnummer

### 🔎 Full-text zoeken
Exacte zoekopdracht door alle notitie-content.
- Toont **alle** treffers per notitie met regelnummer en context-snippet
- `N×` teller toont het aantal treffers per notitie
- Titelmatches apart gemarkeerd

### Resultaat-viewer (beide modi)
Klikken op een resultaat laadt de notitie in de **canvas SearchViewer** rechts:
- **Vim-navigatie**: `j`/`k` scrollen, `n`/`N` naar volgende/vorige treffer, `g`/`G` begin/einde
- **Zoekterm-highlighting**: alle treffers zijn geel gemarkeerd, viewer springt automatisch naar de eerste match
- **Tekstselectie**: sleep met de muis om tekst te selecteren
- **Kopiëren**: `y` of `Ctrl+C` kopieert selectie, `Y` kopieert huidige regel
- **Regelnummers**: standaard relatief (rel#), klikbaar naar absoluut (abs#)
- **Plakken**: in split modus toont de toolbar een **◀ Plak selectie links** knop
- **"◀ Open links"** knop (split modus): opent notitie in linker editor zonder zoekinterface te verlaten

---

## ⊞ Split-screen modus

Activeer via de **⊞ split** knop in de topbar of `:vs` in de editor.

- Bij activeren: beide sidebars klappen automatisch in voor maximale ruimte
- Rechter paneel opent standaard op **🧠 Notebook**
- Rechter tabs: ✏️ Schrijven · 🔍 Zoeken · 🕸 Graaf · 🗺 Mindmap · 🧠 Notebook · 📄 PDF · 🖼 Plaatjes

### Focus wisselen

| Toets | Actie |
|-------|-------|
| `Ctrl+W Ctrl+W` | Toggle focus links ↔ rechts |
| `Ctrl+H` | Focus naar links |
| `Ctrl+L` | Focus naar rechts |

### Inklapbare sidebars

| Actie | Resultaat |
|-------|-----------|
| ◀/▶ knop op linkerrand | Linker notitieslijst in/uitklappen |
| `Ctrl+B` | Linker notitieslijst in/uitklappen |
| ▶ knop in Links-header | Rechter linkszijbalk inklappen |
| 🔗 strook | Rechter linkszijbalk uitklappen |

---

## 🕸️ Kennisgraaf

### Navigatie

| Actie | Werking |
|-------|---------|
| Scrollen | Zoom in/uit |
| Alt+slepen | Pannen |
| Klikken | Notitie selecteren / pad-ankerpunt instellen |
| Dubbelklikken | Notitie vastzetten (pin) |
| Rechtsklikken | Contextmenu |

### Knoppen

| Knop | Werking |
|------|---------|
| ⊞ fit | Alle nodes in beeld |
| 1:1 | Reset zoom |
| 💥 uiteen | Spreid alle nodes uiteen (of geselecteerde bij lasso) |
| ↺ herstart | Reset layout naar cirkel |

### Lasso-selectie

**Shift + sleep** op leeg canvas tekent een selectievak. Nodes in het vak worden geselecteerd en automatisch uiteen gespreid. De 💥 uiteen knop toont daarna `💥 spreid N`.

### Weergavemodi

| Modus | Beschrijving |
|-------|-------------|
| lokaal | Alleen omgeving van geselecteerde node |
| orphans | Alleen niet-verbonden notities |
| hubs 🔥 | Kleur op verbindingsdichtheid |
| community | Automatisch gedetecteerde clusters |
| pad 🔍 | Pad-finder tussen twee nodes |
| ≈ sem. | Semantisch verwante verbindingen |

### Pad-finder

1. Zet **pad 🔍** aan
2. Klik op een startnode (ook tag-nodes mogelijk)
3. Klik op een eindnode → kortste pad wordt berekend
4. **● alleen pad** — verberg alle andere nodes en edges
5. **◎ toon alles** — terug naar volledig beeld

---

## 📚 Leeslijst

Toont alle geïmporteerde notities in tabelvorm, standaard gefilterd op **ongelezen**.

| Kolom | Beschrijving |
|-------|-------------|
| ✓ | Vinkje — klik om als gelezen/ongelezen te markeren |
| Datum | Importdatum (nieuwste bovenaan) |
| Titel | Naam van de notitie |
| Leestijd | Geschatte leestijd (200 woorden/min) |

---

## 🌐 Import

### URL-import

1. **Import** → tab **🌐 URL** → plak URL → **→ Importeren**
2. AI verwijdert navigatie en rommel (Instapaper-stijl)
3. Tags worden **automatisch gesuggereerd**
4. Selecteer afbeeldingen die je wilt meenemen
5. Bewerk titel, tags en samenvatting → **✓ Opslaan**

Geselecteerde afbeeldingen krijgen **na opslaan** automatisch een AI-beschrijving.

### Markdown-import

**Import** → tab **📝 Markdown** → kies `.md` / `.markdown` / `.txt` → **✓ Opslaan als notitie**

### Word-import (.docx)

**Import** → tab **📄 Word** → kies `.docx` → AI genereert samenvatting en tags → **✓ Opslaan als notitie**

---

## 🖼 Afbeeldingen

- Upload via drag & drop of **+ upload**
- **🧠 Beschrijven** — AI genereert een beschrijving
- **📝 → notitie** — maakt een notitie met afbeelding én beschrijving, of navigeert naar bestaande
- Beschrijving-badge: groen `✓ beschrijving` / grijs `geen beschrijving`
- Zoek op naam én beschrijving via de zoekbalk

---

## 📄 PDF-bibliotheek

### Persoonlijk gebruik (DRM-bypass)

1. ⚙ **Instellingen → PDF** → schakel **Persoonlijk gebruik** in → voer e-mailadres in

### Samenvatting genereren

Open een PDF → **🧠 Samenvatten**. Samenvatting verschijnt als losse notitie met tags `samenvatting` en `pdf`.

### Annotaties

Selecteer tekst → annotatiepopup → voeg notitie en kleur toe. Op iOS: tik **✏ Annoteren**.

---

## 📊 Statistieken & Schijfruimte

De **Statistieken**-tab toont vault-analyse in vier subtabs:

| Tab | Inhoud |
|-----|--------|
| Overzicht | Notities, PDFs, afbeeldingen, woorden, verbindingen, kwaliteitsbalken |
| Groei | Aanmaak per week (8 weken), dagnotities |
| Tags | Top tags met relatieve balkjes |
| Top notities | Meest gelinkte, langste, eilanden |
| 💾 Opslag | Vault-gebruik per categorie + systeemschijfruimte |

**💾 Opslag** toont:
- Totale vault-grootte uitgesplitst naar 📝 Notities / 📄 PDFs / 🖼 Afbeeldingen / 📌 Annotaties
- Systeemschijf: totaal / gebruikt / vrij + gebruiksbalk (oranje bij >70%, rood bij >90%)
- ↻ Vernieuwen knop

---

## 🏷️ Tag-systeem

**SmartTagEditor** — aanwezig in editor, import-preview en Word/Markdown-import.

- Max. 2 nieuwe tags per import — de rest hergebruikt bestaande vault-tags
- Typo-detectie met vervang-optie
- `Enter` / `Tab` / `,` bevestigt · `Backspace` verwijdert

| VIM-commando | Actie |
|-------------|-------|
| `:tag rust async` | Tags vervangen |
| `:tag+ nieuw` | Tag toevoegen |
| `:tag- oud` | Tag verwijderen |
| `:tags` | Toon huidige tags |
| `:retag` | Sync met #hashtags in tekst |

---

## 🧠 Notebook LLM

| Model | Pull-commando | Grootte |
|-------|--------------|---------|
| **Llama 3.2 Vision** | `ollama pull llama3.2-vision` | ~8 GB |
| Llama 3 8B | `ollama pull llama3` | ~5 GB |
| Mistral 7B | `ollama pull mistral` | ~4 GB |
| Phi-3 Medium | `ollama pull phi3:medium` | ~9 GB |
| Gemma 2 9B | `ollama pull gemma2` | ~6 GB |

Model kiezen: klik de **modelnaam in de statusbalk** onderin.

- **🕸 GraphRAG** — verrijkt vragen met semantisch relevante notities + graafburen
- **🔍 Hiaten** — analyseert kennishiaten en ontbrekende verbindingen
- **Verwante notities** — TF-IDF panel onderaan elke notitie

### Achtergrondtaken

Lopende AI-taken (samenvatten, beschrijven, importeren) zijn zichtbaar via het klokicoontje in de topbar. Elke draaiende taak heeft een **✕ stop** knop om de taak te annuleren.

---

## ⌨️ VIM Editor

### Modi

| Mode | Activeer |
|------|----------|
| INSERT | `i` / `a` / `o` |
| NORMAL | `Esc` |
| VISUAL | `v` (char) / `V` (regel) |
| COMMAND | `:` |
| SEARCH | `/` |

### Navigatie

| Toets | Actie |
|-------|-------|
| `h j k l` | Cursor bewegen |
| `w` / `b` | Woord voor/achteruit |
| `0` / `$` | Begin/einde regel |
| `gg` / `G` | Begin/einde bestand |
| `%` | Spring naar matchende bracket `( [ {` |
| `'a` | Spring naar mark `a` |
| `Ctrl+D` / `Ctrl+U` | Halve pagina omlaag/omhoog |

### Bewerken

| Toets | Actie |
|-------|-------|
| `r{teken}` | Vervang karakter onder cursor |
| `x` | Verwijder karakter |
| `dd` / `yy` | Verwijder/kopieer regel |
| `D` | Verwijder tot einde regel |
| `p` / `P` | Plak na/voor cursor |
| `u` / `Ctrl+R` | Undo/redo (persistent per notitie) |
| `J` | Voeg regels samen |
| `.` | Herhaal laatste actie |

### Visual mode

| Toets | Actie |
|-------|-------|
| `v` | Char-wise selectie |
| `V` | Linewise selectie |
| `d` / `y` / `c` | Verwijder / kopieer / vervang selectie |

### Text objects

| Toets | Actie |
|-------|-------|
| `ci"` / `ca(` | Verander inhoud/inclusief `"..."` / `(...)` |
| `di{` / `da[` | Verwijder inhoud/inclusief `{...}` / `[...]` |
| `yi'` / `ya\`` | Kopieer inhoud/inclusief `'...'` / `` `...` `` |
| `b` / `B` / `r` | Aliassen voor `(` / `{` / `[` |

### Folds (markdown headers)

| Toets | Actie |
|-------|-------|
| `za` | Toggle fold op header |
| `zo` / `zc` | Open / sluit fold |
| `zR` / `zM` | Alle folds open / dicht |

Gevouwen headers tonen een geel `▸ N regels` pill.

### Marks & Macros

| Toets | Actie |
|-------|-------|
| `m{a-z}` | Zet mark op huidige positie |
| `'{a-z}` | Spring naar mark |
| `q{a-z}` | Start/stop macro-opname |
| `@{a-z}` | Speel macro af |

### Ex-commando's

| Commando | Actie |
|----------|-------|
| `:w` / `:wq` | Opslaan / opslaan+sluiten |
| `:q!` | Sluiten zonder opslaan |
| `:vs` | Split-screen openen |
| `:goyo` | Focusmodus |
| `:spell` / `:sp` | Spellcheck: nl → en → uit |
| `:rnu` / `:set rnu` | Toggle relatieve regelnummers |
| `:tag+ #naam` | Tag toevoegen |
| `:template naam` | Notitie-template laden |
| `:?` of `:help` | Keyboard shortcuts overzicht |

### Keyboard shortcuts overzicht

Druk **`?`** in NORMAL mode of typ **`:help`** voor een volledig overzicht van alle sneltoetsen, gegroepeerd per categorie.

### Notitie-templates

| Template | Inhoud |
|----------|--------|
| `dagnotitie` | Datum, inbox, ideeën, taken |
| `meeting` | Deelnemers, agenda, beslissingen, actiepunten |
| `literatuur` | Auteur, bron, samenvatting, citaten, eigen gedachten |
| `project` | Status, doel, taken, aantekeningen |
| `vraag` | Context, hypothese, antwoord |

Gebruik: `:template dagnotitie`

### Snippets

| Snippet | Expandeert naar |
|---------|-----------------|
| `link` | `[[notitie]]` |
| `todo` | `- [ ] taak` |
| `date` | Huidige datum |
| `h1` `h2` `h3` | Heading |
| `code` `table` `bold` `em` | Opmaak |
| `hr` `quote` | Scheiding / citaat |

---

## 📦 Projectstructuur

```
zettelkasten-python-app/
├── server.py                  ← Python backend (puur stdlib, routing via dict)
├── README.md
└── static/
    ├── index.html
    ├── app.js                 ← globals, constants, api, renderMd, TagPill
    └── modules/
        ├── SpellEngine.js     ← spellcheck (incrementeel) + completion
        ├── VimEditor.js       ← canvas VIM editor
        ├── TagFilterBar.js    ← tag-filter balk
        ├── Graph.js           ← kennisgraaf (O(1) nodeMap lookup)
        ├── PDFViewer.js       ← PDF viewer + canvas mounters
        ├── VaultSettings.js   ← instellingen modal
        ├── ImagesGallery.js   ← afbeeldingen gallerij
        ├── MermaidEditor.js   ← Mermaid + MindMap + LLMNotebook + FuzzySearch + SearchViewer
        ├── ModelPicker.js     ← model selector
        ├── LinksSidebar.js    ← 🔗 links-zijbalk
        ├── NoteEditor.js      ← notitie editor wrapper
        ├── NotePreview.js     ← preview + semantisch verwant paneel
        ├── NotesTab.js        ← orkestratielaag + dagnotitie + sidebar-logica
        ├── NoteList.js        ← notitie-lijst
        ├── NotesMeta.js       ← metadata-zijpaneel
        ├── TagManager.js      ← SmartTagEditor + TagManagerPanel
        ├── WebImporter.js     ← URL-, Markdown- en Word-import
        ├── ReadingList.js     ← leeslijst
        ├── StatsPanel.js      ← statistieken + 💾 schijfruimte
        ├── ReviewPanel.js     ← spaced repetition review
        ├── pdfService.js      ← PDF API-client
        ├── noteApi.js         ← notities API-client
        ├── noteStore.js       ← in-memory notities store
        └── annotationStore.js ← PDF-annotaties store
```

---

## 💡 Tips

- **Dagnotitie** — klik 📅 naast "nieuw zettel" voor de notitie van vandaag
- **Full-text zoeken** — schakel naar 🔎 Volledig; gebruik `n`/`N` om door treffers te navigeren in de viewer
- **Selecteren & plakken** — sleep in de zoekviewer om tekst te selecteren, gebruik "◀ Plak selectie links" in split modus
- **Split modus** — sidebars klappen automatisch in; rechter paneel start op Notebook
- **Lasso** — Shift+sleep in de graaf om een groep nodes te selecteren en uiteen te spreiden
- **Links-zijbalk** — + Link tab toont automatisch notities met gedeelde tags als suggesties
- **Kapotte links** — `✗` icoon in pill-stijl geeft direct aan welke verbindingen verbroken zijn
- **Afbeeldingen importeren** — beschrijving wordt pas gegenereerd ná opslaan
- **Leeslijst** — opent standaard op ongelezen
- **DRM-PDF's** — schakel "Persoonlijk gebruik" in via Instellingen → PDF
- **Meerdere vaults** — start meerdere servers op verschillende poorten
- **Git backup** — vault map is gewone tekst, perfect voor git
- **Obsidian-compatibel** — notities zijn standaard Markdown
- **iPad** — start met `--host 0.0.0.0`, open het getoonde IP in Safari
- **Volledig offline** — `bash static/vendor/download-vendors.sh` → `python3 server.py --offline`
- **GraphRAG** — Notebook → 🕸 GraphRAG → stel vragen met graafcontext
- **Tekstgrootte** — aanpasbaar via ⚙ Instellingen → Weergave (10–14 px, opgeslagen)
- **Undo history** — bewaard per notitie in localStorage, hersteld bij heropenen (max 40 stappen, 24u)
- **Shortcuts overzicht** — druk `?` in de editor voor alle toetscombinaties
