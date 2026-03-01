# 🗃️ Zettelkasten VIM — Python App

> Zelfstandige Python desktop app: notities als Markdown op schijf, PDF bibliotheek, Obsidian-stijl kennisgraaf, VIM editor met Goyo/Limelight/Pencil/Snippets.

---

## 🚀 Installatie & Starten

### Vereisten
- **Python 3.8+** (geen pip packages nodig — alleen stdlib)
- Moderne browser (Chrome, Firefox, Edge)

### Starten

```bash
# Clone of download de bestanden
cd zettelkasten-app/

# Start met standaard vault (~./Zettelkasten)
python3 server.py

# Of kies zelf een vault map
python3 server.py --vault ~/Documenten/MijnNotities

# Andere poort
python3 server.py --vault ~/Notes --port 8080

# Zonder automatisch browser openen
python3 server.py --no-browser
```

De browser opent automatisch op **http://localhost:7842**

---

## 📁 Vault Structuur

Een vault is een gewone map op je schijf:

```
~/Zettelkasten/
├── notes/
│   ├── 20240315143022.md      ← elke notitie = één .md bestand
│   ├── 20240316091500.md
│   └── ...
├── pdfs/
│   ├── artikel.pdf            ← PDF bestanden
│   └── boek.pdf
├── annotations/
│   ├── artikel_pdf.json       ← annotaties per PDF
│   └── boek_pdf.json
└── config.json                ← vault configuratie
```

### Vault wisselen
- **Via CLI:** `python3 server.py --vault /pad/naar/andere/vault`
- **In de app:** klik `:set` rechtsboven → voer nieuw pad in

### Notitie formaat (.md)
```markdown
---
id: 20240315143022
title: Mijn Notitie
tags: ["rust", "async", "vim"]
created: 2024-03-15T14:30:22.000000
modified: 2024-03-15T15:00:00.000000
---

# Mijn Notitie

Inhoud hier, met [[links]] en #tags.
```

---

## ⌨️ VIM Editor

### Modes
| Mode    | Activeer     | Beschrijving              |
|---------|-------------|---------------------------|
| NORMAL  | `Esc`       | Navigatie & commando's    |
| INSERT  | `i` / `a`   | Tekst schrijven           |
| COMMAND | `:`         | Ex-commando's             |
| SEARCH  | `/`         | Zoeken in document        |

### Navigatie (NORMAL)
| Toets   | Actie                        |
|---------|------------------------------|
| `h j k l` | Karakter / regel           |
| `w` / `b` | Woord vooruit / achteruit  |
| `0` / `$` | Begin / einde regel        |
| `gg` / `G` | Begin / einde document    |

### Bewerken (NORMAL)
| Toets | Actie                    |
|-------|--------------------------|
| `i`   | INSERT voor cursor       |
| `a`   | INSERT na cursor         |
| `o`   | Nieuwe regel onder       |
| `O`   | Nieuwe regel boven       |
| `dd`  | Verwijder regel          |
| `yy`  | Kopieer regel            |
| `p`   | Plak                     |
| `x`   | Verwijder karakter       |
| `u`   | Undo                     |
| `Ctrl+r` | Redo                  |

### Ex-commando's (`:`)
| Commando       | Actie                           |
|---------------|---------------------------------|
| `:w`          | Opslaan                         |
| `:wq`         | Opslaan en sluiten              |
| `:q!`         | Sluiten zonder opslaan          |
| `:tag rust async` | Alle tags vervangen         |
| `:tag+ nieuw` | Tag toevoegen                   |
| `:tag- oud`   | Tag verwijderen                 |
| `:tags`       | Toon huidige tags               |
| `:retag`      | Herbereken tags uit #hash       |
| `:goyo`       | Toggle focusmodus               |
| `:spell`      | Spellcheck off → en → nl        |
| `:wrap`       | Tekstomloop aan                 |
| `:nowrap`     | Tekstomloop uit                 |
| `Tab`         | Tag autocomplete in commando    |

### Snippets (INSERT mode, `Ctrl+J` of `Tab`)
Gebaseerd op UltiSnips uit vimrc:

| Trigger | Expandeert naar          |
|---------|--------------------------|
| `h1`    | `# Titel`                |
| `h2`    | `## Sectie`              |
| `h3`    | `### Subsectie`          |
| `link`  | `[[notitie]]`            |
| `tag`   | `#tag`                   |
| `code`  | Codeblok met taal        |
| `table` | Markdowntabel 2 kolommen |
| `quote` | Blockquote               |
| `todo`  | Checkbox taak            |
| `date`  | Huidige datum            |
| `hr`    | Horizontale lijn         |
| `bold`  | **vetgedrukt**           |
| `em`    | *cursief*                |

### Auto-pairs (INSERT mode)
Gebaseerd op vimrc `inoremap`:

`(` → `()` · `[` → `[]` · `{` → `{}` · `"` → `""` · `'` → `''`

### Focusmodus (Goyo + Limelight)
Gebaseerd op de Goyo/Limelight plugins uit vimrc:
- `:goyo` of knop ◎ in editor toolbar
- Verbergt sidebar, meta-panel en navigatietabs
- Maximale schrijfruimte, minimale afleiding
- `Esc` of klik ◎ om te verlaten

### Spellcheck (F7 of `:spell`)
Gebaseerd op ToggleSpell() functie uit vimrc:
- Cycleert: **uit** → **Engels** → **Nederlands** → uit
- Spelfouten worden onderstreept door de browser

---

## 🕸️ Kennisgraaf (Obsidian-stijl)

### Features
- **Force-directed layout** — nodes bewegen naar stabiele positie
- **Nodegrootte** gebaseerd op aantal verbindingen (meer links = groter)
- **Kleur per tag-groep** — elke tag krijgt eigen kleur (zoals Obsidian)
- **Hover tooltip** — preview van notitietitel en tags
- **Lokale graaf** — toon alleen geselecteerde notitie + directe buren
- **Orphan filter** — toon alleen notities zonder links
- **Tag filter** — klik op tag om graaf te filteren

### Interactie
| Actie         | Effect                          |
|---------------|---------------------------------|
| Klikken       | Opent de notitie                |
| Slepen        | Herpositioneert node            |
| Hoveren       | Toont tooltip                   |
| Tag klikken   | Filtert graaf op die tag        |
| "lokaal" knop | Toont alleen directe buren      |
| "orphans"     | Toont notities zonder verbinding|

### Node types
| Kleur  | Type         |
|--------|--------------|
| 🟡 Geel | Geselecteerde notitie |
| 🔵 Blauw | Notitie (kleur per tag-groep) |
| 🟠 Oranje | PDF annotatie |
| 🟢 Groen | Tag-node |

---

## 📄 PDF Viewer

### PDF's laden
1. **Nieuw bestand:** klik `:open PDF` → kies bestand → wordt opgeslagen in vault/pdfs/
2. **Uit bibliotheek:** klik `📚 bibliotheek` → kies eerder geopend PDF

### Annoteren
1. Selecteer tekst met de muis
2. Popup verschijnt automatisch
3. Kies kleur, voeg notitie en tags toe
4. Enter of klik **✓ Opslaan**

Annotaties worden opgeslagen in `vault/annotations/` als JSON.

---

## 🔗 Zettelkasten Links

```
Gebruik [[ID]] of [[Titel]] voor bidirectionele links.
Backlinks worden automatisch getoond onderaan elke notitie.
```

---

## 📦 Bestanden

```
zettelkasten-app/
├── server.py          ← Python backend (geen dependencies!)
├── README.md
└── static/
    ├── index.html     ← HTML shell
    └── app.js         ← React frontend
```

---

## 💡 Tips

- **Meerdere vaults:** start meerdere servers op verschillende poorten
- **Git backup:** de vault map is gewone tekst → perfect voor git
- **Obsidian compatibel:** notities zijn standaard Markdown, te openen in Obsidian
- **Zoeken:** gebruik `/zoekterm` in de sidebar of `/` in NORMAL mode

