# 🗃️ Zettelkasten VIM

> Zelfstandige Python desktop-app voor kennisbeheer. Notities als Markdown op schijf, PDF-bibliotheek met annotaties, afbeeldingenbeheer, Obsidian-stijl kennisgraaf, **visueel onderzoekscanvas**, VIM-editor, split-screen modus, interactieve mindmap, web-importer, Markdown- en Word-import, bidirectionele links, dagelijkse notitie, full-text én fuzzy zoeken, leeslijst, semantische kennisverrijking (TF-IDF + GraphRAG), SmartTagEditor met AI-suggesties, en een lokale AI-notebook via Ollama én cloud-modellen — optioneel volledig offline.

---

## 🚀 Installatie

### Vereisten

| Vereiste | Versie | Verplicht |
|----------|--------|-----------|
| Python | 3.11+ | ✅ Ja |
| Moderne browser | Chrome / Firefox / Safari | ✅ Ja |
| Ollama | nieuwste | ⚪ Optioneel (lokale AI) |

> Bij het eerste opstarten installeert de server automatisch: `pypdf`, `pikepdf`, `pdfminer.six`, `python-docx`

### Stap 1 — Bestanden neerzetten

```
~/Apps/zettelkasten-vim/
├── server.py
├── service-worker.js      ← PWA offline + sync
├── README.md
└── static/
    ├── index.html
    ├── app.js             ← globals, W(), TagPill, genId, live sync
    └── modules/
        ├── Whiteboard.js  ← canvas + radial menu + touch
        ├── offlineStore.js
        ├── SpellEngine.js
        ├── VimEditor.js
        ├── TagFilterBar.js
        ├── Graph.js
        ├── PDFViewer.js
        ├── MermaidEditor.js   ← Mermaid, MindMap, LLMNotebook, FuzzySearch
        ├── NoteEditor.js
        ├── NotePreview.js
        ├── NotesTab.js
        ├── NoteList.js
        ├── NotesMeta.js
        ├── TagManager.js
        ├── WebImporter.js
        ├── ReadingList.js
        ├── StatsPanel.js
        ├── ReviewPanel.js
        ├── pdfService.js
        ├── noteApi.js
        ├── noteStore.js
        └── annotationStore.js
```

### Stap 2 — Server starten

```bash
cd ~/Apps/zettelkasten-vim

python3 server.py                                        # standaard (~/Zettelkasten, poort 7842)
python3 server.py --vault ~/Documenten/MijnNotities     # eigen vault map
python3 server.py --port 8080                            # andere poort
python3 server.py --host 0.0.0.0                         # bereikbaar op iPad / netwerk
```

De browser opent automatisch. Bij `--host 0.0.0.0` toont het opstartbericht ook het netwerk-IP.

### Stap 3 — AI instellen

#### Lokaal via Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama serve
ollama pull llama3.2-vision      # aanbevolen (~8 GB)
```

#### Cloud-modellen

Voeg sleutels toe via ⚙ **Instellingen → API-sleutels**.

| Provider | Modellen |
|----------|----------|
| Anthropic | Claude Opus 4, Sonnet 4, Haiku 4.5 |
| OpenAI | GPT-4.1, GPT-4.1 mini, o4-mini |
| Google | Gemini 2.5 Pro, 2.0 Flash |
| Mistral AI | Mistral Medium 3, Small 3.1 |
| OpenRouter | Llama 4, DeepSeek R1, Qwen3 |

---

## 📡 Offline & Live Sync

### PWA installeren (iPad / iPhone)

1. Open de app in Safari op het netwerk-IP (bijv. `http://192.168.1.42:8080`)
2. Tik op **Delen → Zet op beginscherm**
3. De app werkt nu als native app, ook offline

### Live sync (laptop ↔ iPad)

- Wijzigingen zijn binnen 15 seconden zichtbaar op andere apparaten
- Bij focus-wisseling (tik op iPad) wordt direct gecontroleerd
- Toast `↺ Notities bijgewerkt` verschijnt bij een wijziging

### Offline werken

- Notities lezen, schrijven en aanmaken werkt altijd offline
- Mutaties worden automatisch gesynchroniseerd zodra de verbinding hersteld is
- Serverstatus: groen ● online / rood ● offline (zichtbaar in de topbar)

---

## 🗂️ Tabbladen

| Tab | Icoon | Inhoud |
|-----|-------|--------|
| **Schrijven** | 📝 | Notities schrijven, bekijken, doorzoeken |
| **Canvas** | 🎨 | Visueel onderzoekscanvas met kaarten en verbindingen |
| **Bibliotheek** | 📚 | PDF · Plaatjes · Leeslijst · Review · Taken · Annotaties · Boeken |
| **Ontdekken** | 🔍 | Zoeken · Graaf · Mindmap · Notebook · Query |
| **Invoer** | 🌐 | URL / Word · PDF · Statistieken |

---

## 🎨 Canvas

Het canvas is de visuele onderzoeksruimte: plaats notities als kaarten, trek verbindingen, en verken relaties.

### Navigatie

| Actie (muis) | Werking |
|--------------|---------|
| Slepen op leeg vlak | Pannen |
| Scroll | Zoomen |
| Alt + slepen | Pannen (alternatief) |
| Dubbelklikken op kaart | Tekst bewerken |
| Rechtsklikken | Radiaal contextmenu |

| Gebaar (touch — iPad) | Werking |
|-----------------------|---------|
| Één vinger op kaart slepen | Kaart verplaatsen |
| Één vinger op leeg vlak | Pannen |
| Twee vingers pinch | In-/uitzoomen |
| Dubbeltikken op kaart | Bewerken |
| Lang indrukken (500 ms) | Radiaal contextmenu |
| Apple Pencil | Identiek aan vinger |

### Kaarttypen en kleuren

| Kleur | Betekenis | Noottype |
|-------|-----------|----------|
| 🟡 Geel | Idee / vluchtig | `fleeting` |
| 🔵 Blauw | Bron / notitie | `literature` |
| 🔴 Rood | Vraag / spanning | — |
| 🟢 Groen | Conclusie / inzicht | `permanent` |
| 🟣 Paars | Onbekend / onderzoek | `index` |
| ⬜ Grijs | Neutraal / overig | — |

Kleur wijzigen: selecteer kaart → klik een kleurkring in de toolbar (hover = beschrijving + betekenis).
Nieuw toegevoegde kaarten krijgen automatisch de kleur die past bij het noottype.

### Radiaal contextmenu

Rechtsklikken (of lang indrukken) opent een SVG arc-menu:

**Binnenring — kaartacties:**
✎ Bewerken · ⤳ Verbinden · ⬡ Notitie openen · 🕸 Graaf · ⊞ Dupliceer · ✕ Verwijder

**Buitenringen — buurtnetwerk (4 niveaus diep):**
- **Ring 1**: directe verbonden notities van de kaart
- **Ring 2–4**: hover op een node (160 ms) om een niveau dieper te gaan
- Bij hover verschijnt een **preview-kaart** naast het menu: type, titel, inhoud (200 tekens), tags
- Klikken voegt de notitie toe aan het canvas met verbindingslijn en correct gewicht

**Navigatiegedrag:**
- Preview verschijnt direct bij hover
- Ring klapt uit na 160 ms (geen flikker bij snel langs bewegen)
- Ring blijft open bij overgang naar de volgende ring (400 ms sluit-vertraging)

**Kleurcodering in de ringen:**
- Blauw streepje = wiki-link · Geel streepje = backlink
- Kleine gekleurde dot = noottype (vluchtig / literatuur / permanent / index)

### Verbindingen

- **Tekenen**: ⤳ Verbinden in contextmenu → klik op twee kaarten
- **Gewicht**: automatisch berekend (wiki-links +3, backlinks +2, gedeelde tags +1 per tag)
  - Lijndikte schaalt met het gewicht (1–10)
  - Gewichtsgetal in een pill op het midden van de lijn
- **Label toevoegen**: klik op het ✏ icoon op het midden van een lijn → typ → Enter of klik buiten
- **Ego Radial Layout**: contextmenu → plaatst alle verbonden notities in een cirkel rondom de kaart

---

## 📝 Notities schrijven

Titel is verplicht — opslaan zonder titel toont een oranje banner en zet focus op het titelveld.

### Links

```markdown
[[Andere Notitie]]    ← bidirectionele notitie-link (pill-stijl)
[[pdf:rapport.pdf]]   ← klikbare PDF-link
![[img:foto.png]]     ← ingesloten afbeelding
```

### Links-zijbalk (rechts)

| Tab | Inhoud |
|-----|--------|
| ← In | Backlinks — notities die naar deze linken |
| → Uit | Outlinks — `[[links]]` in deze notitie |
| + Link | Handmatig linken met zoekfunctie |

---

## ⊞ Split-screen modus

Activeer via **⊞ split** of `:vs` in de editor.

| Toets | Actie |
|-------|-------|
| `Ctrl+W Ctrl+W` | Toggle focus links ↔ rechts |
| `Ctrl+H` / `Ctrl+L` | Focus naar links / rechts |
| `Ctrl+B` | Linker notitieslijst in/uitklappen |

---

## 🕸️ Kennisgraaf

| Actie | Werking |
|-------|---------|
| Scrollen | Zoom |
| Alt+slepen | Pannen |
| Shift+sleep | Lasso-selectie |
| Dubbelklikken | Vastzetten (pin) |

**Weergavemodi:** lokaal · orphans · hubs 🔥 · community · pad 🔍 · ≈ sem.

**Pad-finder:** zet "pad 🔍" aan → klik startnode → klik eindnode.

---

## 🧠 Notebook LLM

- **🕸 GraphRAG** — vragen met semantisch relevante notities + graafburen als context
- **🔍 Hiaten** — analyseert kennishiaten en ontbrekende verbindingen
- Context selecteren: notities, PDFs en afbeeldingen combineerbaar

---

## ⌨️ VIM Editor

### Ex-commando's

| Commando | Actie |
|----------|-------|
| `:w` / `:wq` | Opslaan / opslaan+sluiten |
| `:vs` | Split-screen openen |
| `:goyo` | Focusmodus |
| `:spell` | Spellcheck: nl → en → uit |
| `:tag+ naam` | Tag toevoegen |
| `:template naam` | Template laden |
| `:?` | Alle shortcuts tonen |

Druk **`?`** in NORMAL mode voor een volledig overzicht van alle sneltoetsen.

---

## 📁 Vault structuur

```
~/Zettelkasten/
├── notes/
│   └── 20240315143022.md
├── pdfs/
├── annotations/
├── images/
└── config.json
```

---

## 💡 Tips

- **Canvas touch** — werkt volledig met vingers en Apple Pencil op iPad
- **Radial menu preview** — hover 160 ms op een buitenring-node voor de volledige preview-kaart
- **Verbindingslabel** — klik op het ✏ icoon op een lijn om een label in te typen
- **Kaartkleur** — hover over een kleurknopje voor de beschrijving; kleur blijft na opslaan
- **Ego Radial** — contextmenu → plaatst alle verbonden notities als cirkel
- **Live sync iPad** — start server met `--host 0.0.0.0` en open het IP in Safari
- **PWA installeren** — Safari → Delen → Zet op beginscherm voor offline gebruik
- **Dagnotitie** — klik 📅 naast "nieuw zettel" voor de notitie van vandaag
- **Lasso** — Shift+sleep in de graaf om nodes te selecteren
- **Meerdere vaults** — start meerdere servers op verschillende poorten
- **Git backup** — vault is gewone Markdown, perfect voor git
- **Shortcuts** — druk `?` in de editor voor alle toetscombinaties
