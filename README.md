# 🗃️ Zettelkasten VIM

> Zelfstandige Python desktop-app voor kennisbeheer. Notities als Markdown op schijf, PDF-bibliotheek met annotaties, afbeeldingenbeheer, Obsidian-stijl kennisgraaf, canvas VIM-editor, split-screen modus, interactieve mindmap, web-importer, Markdown- en Word-import, **PDF persoonlijk gebruik met DRM-bypass**, **leeslijst met leestijd**, semantische kennisverrijking (TF-IDF + GraphRAG), **SmartTagEditor met automatische AI-suggesties**, en een lokale AI-notebook via Ollama én cloud-modellen — optioneel volledig offline.

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
│   └── _image_annotations.json
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
| Plaatjes | 🖼 | Afbeeldingen met AI-beschrijving en pin-annotaties |
| Zoeken | 🔍 | FZF-stijl zoeken over notities én PDF-pagina's |
| Import | 🌐 | URL-, Markdown- en Word-import |
| Leeslijst | 📚 | Overzicht van alle geïmporteerde notities |
| Mindmap | 🗺 | Visuele mindmap, AI-mindmap of Mermaid-editor |
| Notebook | 🧠 | LLM-chat over notities, PDFs en afbeeldingen |
| Tags | 🏷 | Tag-beheer, samenvoegen, statistieken |

---

## 📚 Leeslijst

Toont alle geïmporteerde notities (URL, Word, PDF-samenvattingen) in tabelvorm, standaard gefilterd op **ongelezen**.

### Kolommen

| # | Kolom | Beschrijving |
|---|-------|--------------|
| 1 | ✓ | Vinkje — klik om als gelezen/ongelezen te markeren |
| 2 | Datum | Importdatum (nieuwste bovenaan) |
| 3 | Titel | Naam van de notitie |
| 4 | Leestijd | Geschatte leestijd (200 woorden/min) |

### Sorteren

- Knoppen **📅 Datum** en **⏱ Leestijd ↓/↑** in de header
- Of klik de kolomkoppen **DATUM** / **LEESTIJD** — opnieuw klikken draait de volgorde om

### Filteren en zoeken

Pills: **Alles** · **📖 Ongelezen** · **✓ Gelezen** + zoekbalk rechts

### Gelezen-indicator in de notitie

Bij geïmporteerde notities toont de notitie-toolbar een klikbare badge naast de leestijd:

```
○ ongelezen  |  ⏱ 17 min        ← niet gelezen
● gelezen    |  ⏱ 17 min        ← gelezen (groen)
```

Één klik togglet de status. Wordt permanent opgeslagen in de frontmatter — overleeft een serverherstart.

---

## 🌐 Import

### URL-import

1. **Import** → tab **🌐 URL** → plak URL → **→ Importeren**
2. AI verwijdert navigatie en rommel (Instapaper-stijl)
3. Tags worden **automatisch gesuggereerd** op basis van inhoud én bestaande vault-tags
4. Bewerk titel, tags en samenvatting → **✓ Opslaan**

Dubbele URL's worden herkend met een waarschuwing en "Toch importeren" optie.

### Markdown-import

1. **Import** → tab **📝 Markdown** → kies `.md` / `.markdown` / `.txt`
2. Stel tags in via SmartTagEditor → **✓ Opslaan als notitie**

### Word-import (.docx)

1. **Import** → tab **📄 Word** → kies `.docx`
2. Conversie naar Markdown gebeurt volledig lokaal
3. Koppen, bullets en tabellen worden correct omgezet
4. AI genereert samenvatting en suggereert tags automatisch
5. Bewerk → **✓ Opslaan als notitie**

> Gebruikt `python-docx` als dat beschikbaar is, anders ingebouwde XML-fallback.

---

## 📄 PDF-bibliotheek

### Persoonlijk gebruik (DRM-bypass)

Voor eigen beveiligde PDF's (rapporten, e-books waarvoor je een licentie hebt):

1. ⚙ **Instellingen → PDF**
2. Schakel **Persoonlijk gebruik** in
3. Voer je e-mailadres in

De server probeert DRM te omzeilen via `pikepdf` en `qpdf`. Watermerken en persoonlijk-gebruik disclaimers worden automatisch gefilterd uit samenvattingen.

### Samenvatting genereren

Open een PDF → **🧠 Samenvatten** in de toolbar. Werkt met alle AI-modellen (lokaal én cloud). De samenvatting verschijnt als losse notitie met tags `samenvatting` en `pdf`.

### Annotaties

Selecteer tekst in een PDF → annotatiepopup → voeg notitie en kleur toe.
Op iOS: tik **✏ Annoteren** onder de tekstselectie.

---

## 🏷️ Tag-systeem

### SmartTagEditor

Aanwezig in notitie-editor, import-preview en Word/Markdown-import.

**Automatisch bij import** — na elke URL- of Word-import worden tags direct gesuggereerd. Je ziet "✦ tags worden gesuggereerd…" tijdens het laden.

**Slimme suggesties** — de AI gebruikt:
- Alle vault-tags gesorteerd op gebruiksfrequentie (meest hergebruikt = meest relevant)
- Directe tekstovereenkomsten: tags die letterlijk in de tekst voorkomen krijgen prioriteit
- Max. 2 nieuwe tags — de rest hergebruikt bestaande tags voor betere onderlinge verbinding

**Handmatig:**
- Typ → autocomplete-dropdown op frequentie
- `Enter` / `Tab` / `,` bevestigt · `Backspace` verwijdert laatste tag
- Typo-detectie met vervang-optie

**VIM-commando's:**

| Commando | Actie |
|----------|-------|
| `:tag rust async` | Tags vervangen |
| `:tag+ nieuw` | Tag toevoegen |
| `:tag- oud` | Tag verwijderen |
| `:tags` | Toon huidige tags |
| `:retag` | Sync met #hashtags in tekst |

---

## 🧠 Notebook LLM

### Lokale modellen

| Model | Pull-commando | Grootte |
|-------|--------------|---------|
| **Llama 3.2 Vision** | `ollama pull llama3.2-vision` | ~8 GB |
| Llama 3 8B | `ollama pull llama3` | ~5 GB |
| Mistral 7B | `ollama pull mistral` | ~4 GB |
| Phi-3 Medium | `ollama pull phi3:medium` | ~9 GB |
| Gemma 2 9B | `ollama pull gemma2` | ~6 GB |

Model kiezen: klik de **modelnaam in de statusbalk** onderin de app.

### Kennisverrijking

- **🕸 GraphRAG** — verrijkt vragen met semantisch relevante notities + graafburen + community-samenvatting
- **🔍 Hiaten** — analyseert kennishiaten, zwakke bruggen en ontbrekende verbindingen
- **Semantische graaf** — gestippelde lijnen tonen verwantschap zonder expliciete `[[link]]`
- **Verwante notities** — TF-IDF gerelateerde notities onderaan elke notitie, direct te koppelen

### Antwoorden plakken (split-modus)

- **Heel bericht:** zweef over AI-antwoord → **↙ plak in notitie**
- **Selectie:** selecteer tekst → popup → **↙ plak selectie**

Ingeplakt als callout:
```markdown
> [!ai]
> 🧠 **AI** · llama3.2-vision
> [antwoordtekst]
```

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
| `u` / `Ctrl+r` | Undo / Redo |

### Ex-commando's (`:`)

| Commando | Actie |
|----------|-------|
| `:w` / `:wq` | Opslaan / opslaan+sluiten |
| `:q!` | Sluiten zonder opslaan |
| `:vs` | Split-screen openen |
| `:only` | Split-screen sluiten |
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

## ↔️ Split-screen

Activeren: split-knop in toolbar of `:vs`.

| Toets | Actie |
|-------|-------|
| `Ctrl+H` of `Ctrl+K` | Focus → linker paneel |
| `Ctrl+L` of `Ctrl+J` | Focus → rechter paneel |

---

## 🔗 Notitie-links & media

```markdown
[[Andere Notitie]]       ← bidirectionele notitie-link
[[pdf:rapport.pdf]]      ← klikbare PDF-link
![[img:foto.png]]        ← ingesloten afbeelding
```

---

## ✏️ Spellcheck

Live spellcheck met gekleurde onderstrepingen. Taal wisselen: `:spell` in COMMAND mode (nl → en → uit).

```bash
# Optioneel: betere Hunspell-woordenboeken
cd static/vendor/dict && bash download-dictionaries.sh
```

---

## 📦 Projectstructuur

```
zettelkasten-python-app/
├── server.py                  ← Python backend
├── README.md
└── static/
    ├── index.html
    ├── app.js                 ← React frontend + hoofdcomponenten
    └── modules/
        ├── NoteEditor.js      ← VIM canvas editor
        ├── NotePreview.js     ← preview + backlinks + leestijd/gelezen badge
        ├── NotesTab.js        ← orkestratielaag notities-tab
        ├── NoteList.js        ← notitie-lijst met filter
        ├── NotesMeta.js       ← metadata-zijpaneel
        ├── TagManager.js      ← SmartTagEditor + TagManagerPanel
        ├── WebImporter.js     ← URL-, Markdown- en Word-import
        ├── ReadingList.js     ← leeslijst met sortering en gelezen-status
        ├── pdfService.js      ← PDF API-client
        ├── noteApi.js         ← notities API-client
        ├── noteStore.js       ← in-memory notities store
        └── annotationStore.js ← PDF-annotaties store
```

---

## 💡 Tips

- **Leeslijst** — opent standaard op ongelezen, direct overzicht van wat nog gelezen moet worden
- **Gelezen togglen** — klik de badge in de notitie-toolbar of het vinkje in de leeslijst
- **Word-import** — koppen, bullets en tabellen worden correct omgezet naar Markdown
- **DRM-PDF's** — schakel "Persoonlijk gebruik" in via Instellingen → PDF voor eigen documenten
- **Automatische tags** — bij elke import worden tags direct gesuggereerd op basis van vault-context
- **Mistral en Kimi** — stel API-sleutel in via Instellingen → API-sleutels, kies in statusbalk
- **Meerdere vaults** — start meerdere servers op verschillende poorten
- **Git backup** — de vault map is gewone tekst, perfect voor git
- **Obsidian-compatibel** — notities zijn standaard Markdown
- **iPad** — start met `--host 0.0.0.0`, open het getoonde IP in Safari
- **Volledig offline** — `bash static/vendor/download-vendors.sh` → `python3 server.py --offline`
- **GraphRAG** — Notebook → 🕸 GraphRAG → stel vragen met graafcontext
- **Kennishiaten** — Notebook → 🔍 hiaten → analyseert je volledige kennisbasis
- **Split + plakken** — zweef over AI-antwoord → ↙ plak in notitie
