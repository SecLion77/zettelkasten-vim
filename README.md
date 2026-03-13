# 🗃️ Zettelkasten VIM

> Zelfstandige Python desktop-app voor kennisbeheer. Notities als Markdown op schijf, PDF-bibliotheek met annotaties, afbeeldingenbeheer, Obsidian-stijl kennisgraaf, canvas VIM-editor, split-screen modus, interactieve mindmap (visueel én Mermaid-syntax), web-importer, Gmail-import vanuit Thunderbird, spellcheck (NL + EN), **semantische kennisverrijking (TF-IDF + GraphRAG)**, **SmartTagEditor met AI-suggesties** en een lokale AI notebook via Ollama — volledig offline, geen cloud.

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
    │   ├── TagManager.js
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

Voor samenvattingen, chat, AI-tag-suggesties en GraphRAG is **Ollama** nodig:

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

## 🏷️ Tag-systeem

### SmartTagEditor in de notitie-editor

De **SmartTagEditor** is een vaste balk direct onder de toolbar — zichtbaar bij zowel nieuwe als bestaande notities. Hij combineert handmatige invoer, autocomplete en AI-suggesties in één interface.

```
┌─────────────────────────────────────────────┐  ┌─────────────┐
│  #python  #ai  #notities  [tag toevoegen…]  │  │  ✦ AI-tags  │
└─────────────────────────────────────────────┘  └─────────────┘
```

**Handmatig tags toevoegen:**
- Begin met typen → autocomplete-dropdown met bestaande tags, gesorteerd op gebruiksfrequentie
- `Enter` / `Tab` / `,` bevestigt de invoer · `Backspace` verwijdert de laatste tag
- Typo-detectie: lijkt de nieuwe tag op een bestaande? → waarschuwing met vervang-optie

**AI-tag-suggesties:**
- Klik **✦ AI-tags** → het actieve model analyseert de volledige notitie-inhoud
- Suggesties verschijnen als klikbare pills direct onder het invoerveld:
  - Klik een pill om de tag toe te voegen (pill toont ＋ of ✓ als al toegevoegd)
  - Klik **＋ voeg alle nieuwe toe** om in één keer alles toe te voegen
- De knop is gedimmed als er geen model geselecteerd is of de notitie nog te kort is; de tooltip legt uit wat er ontbreekt
- Model instellen via de **modelnaam in de statusbalk** onderin de app

**Tag-filter per tab:**
Elke tab (Notities, Graaf, PDF, Zoeken) heeft een **TagFilterBar** met:
- Klikbare tag-chips (groene pills met duidelijk contrast)
- Ingebouwde zoekbalk voor grote tag-collecties
- Actief-filter badge + snelle **× wis** knop

**Tags via VIM-commando's:**

| Commando | Actie |
|----------|-------|
| `:tag rust async` | Tags vervangen |
| `:tag+ nieuw` | Tag toevoegen |
| `:tag- oud` | Tag verwijderen |
| `:tags` | Toon huidige tags in statusbalk |
| `:retag` | Sync tags met #hashtags in de tekst |

---

## 🧠 Laag 3 — Semantische kennisverrijking

### Verwante notities

In het notitie-voorbeeldpaneel toont het **Verwante notities** vak automatisch tot 6 semantisch gerelateerde notities — berekend met TF-IDF, zonder internet of AI-model.

- Paarse sterkte-balk toont de mate van overeenkomst
- **✓ gelinkt** badge als er al een `[[link]]` bestaat · **+ link** voegt de koppeling direct toe

### Semantische graaf

Kennisgraaf → **≈ semantisch**: gestippelde paarse lijnen tonen semantische verwantschap, ook zonder expliciete `[[link]]`. Legenda toont het aantal gevonden relaties en de sterkste paren.

### GraphRAG Notebook

- **🕸 GraphRAG** — activeert context-verrijkte vraagstelling: semantisch relevante notities + directe buren + community-samenvatting worden als rijke systeem-prompt meegestuurd
- **🔍 hiaten** — analyseert kennishiaten, zwakke bruggen, eiland-clusters en ontbrekende verbindingen in je vault

---

## ↔️ Split-screen modus

Notities naast een tweede tabblad (PDF, afbeeldingen, zoeken, AI Notebook) open houden.

**Activeren:** klik de split-knop in de toolbar, of typ `:vs` in COMMAND mode.

### Navigeren tussen panelen

| Toets | Actie |
|-------|-------|
| `Ctrl+H` of `Ctrl+K` | Focus → linker paneel (editor) |
| `Ctrl+L` of `Ctrl+J` | Focus → rechter paneel |

### AI-antwoorden plakken in notitie

In split-modus kun je AI-antwoorden uit het Notebook direct in je actieve notitie plakken:

- **Heel bericht:** zweef over een AI-antwoord → klik **↙ plak in notitie**
- **Selectie:** selecteer tekst in het chatvenster → popup met **↙ plak selectie in notitie**

Geplakte inhoud wordt opgemaakt als callout:
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
| `:tags` | Toon huidige tags in statusbalk |
| `:retag` | Sync tags met #hashtags in tekst |
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
Links invoegen via **🔗 koppelen** in de toolbar.

---

## 🌐 Web-import

1. Ga naar **Import** → tab **🌐 URL import**
2. Plak een URL → klik **→ Importeren**
3. Bewerk titel, tags en inhoud → **✓ Opslaan als notitie**

---

## 📬 Gmail-import vanuit Thunderbird

1. Ga naar **Import** → tab **📬 Thunderbird / Gmail**
2. Klik **📂 Laden** — de server zoekt automatisch je profiel
3. Vink interessante mails aan → klik **📥 Importeren**

Thunderbird niet gevonden? Voer het pad handmatig in, bijv. `~/.thunderbird/xxxxxxxx.default-release`

---

## 🗺️ Mindmap

- **Visuele mindmap:** radiale boom, sleep nodes, klik om te hernoemen
- **Mermaid-editor:** VIM-editor met live preview, Tab voor inspringing
- **AI-mindmap:** laat het model een mindmap genereren op basis van een notitie

---

## 🧠 Notebook LLM

| Model | Commando | Grootte | Gebruik |
|-------|----------|---------|---------|
| **Llama 3.2 Vision 11B** | `ollama pull llama3.2-vision` | ~8 GB | **Standaard** — tekst + beeld |
| Llama 3 8B | `ollama pull llama3` | ~5 GB | Snel, goed Nederlands |
| Mistral 7B | `ollama pull mistral` | ~4 GB | Snel, EU-talen |
| Phi-3 Medium 14B | `ollama pull phi3:medium` | ~9 GB | Analyse & redeneren |
| Gemma 2 9B | `ollama pull gemma2` | ~6 GB | Lange context |

Online modellen (API-sleutel vereist): Claude (Anthropic), GPT-4o (OpenAI), Gemini (Google), OpenRouter.

Model kiezen: klik de **modelnaam in de statusbalk** onderin de app.

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
    │   ├── NoteEditor.js      ← editor + SmartTagEditor integratie
    │   ├── NotesTab.js
    │   ├── NoteList.js
    │   ├── NotePreview.js     ← preview + backlinks + semantisch panel
    │   ├── NotesMeta.js
    │   ├── TagManager.js      ← SmartTagEditor + TagManagerPanel
    │   ├── WebImporter.js
    │   ├── pdfService.js
    │   ├── noteApi.js
    │   ├── noteStore.js
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
- **AI-tags bij nieuw:** schrijf de inhoud, klik dan **✦ AI-tags** — direct relevante tags voorgesteld
- **Alle tags in één klik:** na AI-suggesties → **＋ voeg alle nieuwe toe**
- **Kennishiaten vinden:** Notebook → 🔍 hiaten → analyseert je volledige kennisbasis
- **Semantische graaf:** Graaf-tab → ≈ semantisch → ontdek verborgen verbanden
- **GraphRAG:** Notebook → 🕸 GraphRAG → stel vragen met graafcontext
- **Split + plakken:** in split-modus zweef over AI-antwoord → ↙ plak in notitie
- **Tags filteren:** klik een tag-chip in de TagFilterBar → actief filter + × wis knop
