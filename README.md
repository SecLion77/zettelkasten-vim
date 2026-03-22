# 🗃️ Zettelkasten VIM

> Zelfstandige Python desktop-app voor kennisbeheer. Notities als Markdown op schijf, PDF-bibliotheek met annotaties, afbeeldingenbeheer, Obsidian-stijl kennisgraaf, canvas VIM-editor, split-screen modus, interactieve mindmap, web-importer, Markdown- en Word-import, **bidirectionele links met rechter linkszijbalk**, **dagelijkse notitie**, **full-text én fuzzy zoeken**, **leeslijst met leestijd**, semantische kennisverrijking (TF-IDF + GraphRAG), **SmartTagEditor met automatische AI-suggesties**, en een lokale AI-notebook via Ollama én cloud-modellen — optioneel volledig offline.

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
    ├── app.js
    └── modules/
        ├── LinksSidebar.js    ← links-zijbalk
        ├── NoteEditor.js
        ├── NotePreview.js
        ├── NotesTab.js
        ├── NoteList.js
        ├── NotesMeta.js
        ├── TagManager.js
        ├── WebImporter.js
        ├── ReadingList.js
        ├── pdfService.js
        ├── noteApi.js
        ├── noteStore.js
        └── annotationStore.js
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

De browser opent automatisch op **http://localhost:7842**.
Bij `--host 0.0.0.0` toont het opstartbericht ook het netwerk-IP, bijv. `http://192.168.1.42:7842`.

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
| OpenRouter | Llama 4, Kimi K2.5, Kimi K2, DeepSeek R1, Qwen3, Gemma 3 | openrouter.ai |

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

Aan de rechterkant van elke notitie staat een inklapbare **🔗 Links** zijbalk:

| Tab | Inhoud |
|-----|--------|
| **← In** | Backlinks — alle notities die naar deze notitie linken |
| **→ Uit** | Outlinks — alle `[[links]]` in deze notitie |
| **+ Link** | Handmatig linken met slimme zoekfunctie |

**+ Link tab:**
- Toont automatisch suggesties op basis van gedeelde tags (zonder te typen)
- Zoekfunctie scoort op titelmatch, gedeelde tags, recentheid en contentovereenkomst
- Toont een snippet als de zoekterm in de content gevonden wordt
- Werkt voor notities, PDF's en afbeeldingen
- Al gelinkte items worden grijs gemarkeerd met `✓`

**Op iPad:** de zijbalk start ingeklapt (24px strook met 🔗). Tik om uit te klappen, `◀` om in te klappen.

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
- Resultaten inline bewerkbaar en opslaan als notitie

### 🔎 Full-text zoeken
Exacte zoekopdracht door alle notitie-content.
- Toont **alle** treffers per notitie met regelnummer en context-snippet
- `N×` teller toont het aantal treffers per notitie
- Titelmatches apart gemarkeerd
- Klikken opent de notitie direct

---

## 📚 Leeslijst

Toont alle geïmporteerde notities in tabelvorm, standaard gefilterd op **ongelezen**.

| Kolom | Beschrijving |
|-------|-------------|
| ✓ | Vinkje — klik om als gelezen/ongelezen te markeren |
| Datum | Importdatum (nieuwste bovenaan) |
| Titel | Naam van de notitie |
| Leestijd | Geschatte leestijd (200 woorden/min) |

Bij geïmporteerde notities toont de toolbar een klikbare badge:
```
○ ongelezen  |  ⏱ 17 min
● gelezen    |  ⏱ 17 min   ← groen
```

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

---

## ⌨️ VIM Editor

| Mode | Activeer |
|------|----------|
| INSERT | `i` / `a` |
| NORMAL | `Esc` |
| COMMAND | `:` |
| SEARCH | `/` |

| Ex-commando | Actie |
|-------------|-------|
| `:w` / `:wq` | Opslaan / opslaan+sluiten |
| `:q!` | Sluiten zonder opslaan |
| `:vs` | Split-screen |
| `:goyo` | Focusmodus |
| `:spell` | Spellcheck: nl → en → uit |

| Snippet | Expandeert naar |
|---------|-----------------|
| `link` | `[[notitie]]` |
| `todo` | `- [ ] taak` |
| `date` | Huidige datum |
| `h1` `h2` | Heading |
| `code` `table` `bold` | Opmaak |

---

## 📦 Projectstructuur

```
zettelkasten-python-app/
├── server.py                  ← Python backend (puur stdlib)
├── README.md
└── static/
    ├── index.html
    ├── app.js                 ← React frontend + renderMd + hoofdcomponenten
    └── modules/
        ├── LinksSidebar.js    ← 🔗 links-zijbalk (backlinks, outlinks, handmatig linken)
        ├── NoteEditor.js      ← VIM canvas editor
        ├── NotePreview.js     ← preview + semantisch verwant paneel
        ├── NotesTab.js        ← orkestratielaag + dagnotitie
        ├── NoteList.js        ← notitie-lijst + 📅 dagnotitie knop
        ├── NotesMeta.js       ← metadata-zijpaneel
        ├── TagManager.js      ← SmartTagEditor + TagManagerPanel
        ├── WebImporter.js     ← URL-, Markdown- en Word-import
        ├── ReadingList.js     ← leeslijst
        ├── pdfService.js      ← PDF API-client
        ├── noteApi.js         ← notities API-client
        ├── noteStore.js       ← in-memory notities store
        └── annotationStore.js ← PDF-annotaties store
```

---

## 💡 Tips

- **Dagnotitie** — klik 📅 naast "nieuw zettel" voor de notitie van vandaag
- **Full-text zoeken** — schakel naar 🔎 Volledig in de Zoeken-tab voor exacte treffers met regelnummer
- **Links-zijbalk** — + Link tab toont automatisch notities met gedeelde tags als suggesties
- **Kapotte links** — `✗` icoon in pill-stijl geeft direct aan welke verbindingen verbroken zijn
- **Afbeeldingen importeren** — beschrijving wordt pas gegenereerd ná opslaan, alleen voor geselecteerde afbeeldingen
- **Leeslijst** — opent standaard op ongelezen
- **DRM-PDF's** — schakel "Persoonlijk gebruik" in via Instellingen → PDF
- **Meerdere vaults** — start meerdere servers op verschillende poorten
- **Git backup** — vault map is gewone tekst, perfect voor git
- **Obsidian-compatibel** — notities zijn standaard Markdown
- **iPad** — start met `--host 0.0.0.0`, open het getoonde IP in Safari
- **Volledig offline** — `bash static/vendor/download-vendors.sh` → `python3 server.py --offline`
- **GraphRAG** — Notebook → 🕸 GraphRAG → stel vragen met graafcontext
- **Split + plakken** — zweef over AI-antwoord → ↙ plak in notitie
