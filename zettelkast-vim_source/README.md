# 🗃️ Zettelkasten VIM

> Zelfstandige Python desktop-app voor kennisbeheer. Notities als Markdown op schijf, PDF-bibliotheek met annotaties, afbeeldingenbeheer, Obsidian-stijl kennisgraaf, canvas VIM-editor, split-screen modus, interactieve mindmap, web-importer, bidirectionele links, dagelijkse notitie, full-text én fuzzy zoeken, leeslijst, semantische kennisverrijking (TF-IDF + GraphRAG), SmartTagEditor, canvas/whiteboard, boeken-bibliotheek, **8 kleurenthema's** (donker + licht), **virtuele PDF-rendering** voor grote documenten, **paginageheugen per PDF**, en een lokale AI-notebook via Ollama én cloud-modellen — optioneel volledig offline.

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

### Stap 1 — Bestanden neerzetten

```
~/Downloads/zettelkasten-vim/
├── server.py
├── pdf_indexer.py          ← achtergrond PDF-zoekindexer
├── README.md
├── index.html
├── app.js
└── modules/
    ├── TagFilterBar.js     ← tag-filter balk
    ├── Graph.js            ← kennisgraaf
    ├── PDFViewer.js        ← PDF viewer + annotaties
    ├── VaultSettings.js    ← instellingen + thema-kiezer
    ├── BookLibrary.js      ← boeken-bibliotheek
    ├── NoteList.js         ← notitie-lijst
    ├── OutlineEditor.js    ← outline editor
    ├── ... (overige modules)
```

### Stap 2 — Server starten

```bash
cd ~/Downloads/zettelkasten-vim
python3 server.py                          # standaard (poort 8080)
python3 server.py --host 0.0.0.0           # bereikbaar op iPad / netwerk
python3 server.py --vault ~/Notes --port 8080
```

**iPad / iOS**: start met `--host 0.0.0.0` en open het getoonde IP-adres in Safari.

---

## 🎨 Kleurenthema's

Wissel via **⚙ Instellingen → 🎨 Thema**. Direct actief, opgeslagen voor volgende sessie.

### Donkere thema's

| Thema | Karakter |
|-------|----------|
| **Void Cyan** | Standaard · donker met cyaan accenten |
| **Nord** | Arctisch blauw · rustig |
| **Forest Night** | Diep bosgroen · organisch |
| **Graphite** | Puur grijs · maximale focus |

### Lichte thema's (ergonomisch)

| Thema | Achtergrond | Karakter |
|-------|-------------|----------|
| **Perkament** | `#F5F0E4` | Ivoor · warm · ideaal voor lange sessies |
| **Ghost White** | `#F8F8FF` | Koel blauwgrijs · modern · focus |
| **Honingdauw** | `#F0FFF0` | Zeer lichtgroen · meest oogvriendelijk |
| **Beige Klassiek** | `#F5F5DC` | Klassiek beige · ergonomisch bewezen |

> De lichte thema's zijn gebaseerd op kleuronderzoek: off-white achtergronden reduceren oogvermoeidheid t.o.v. puur wit (`#ffffff`).

### Technische werking

Het thema-systeem werkt via twee lagen die **direct** updaten zonder herstart:

1. **CSS custom properties** op `document.documentElement` — achtergronden, basiskleuren
2. **Dynamische `<style id="zk-theme">`** — injecteert CSS-regels met `!important` voor tag-chips, note-items, markdown, links. Werkt zonder React re-render.

---

## 📄 PDF-viewer

### Toolbar

| Knop | Functie |
|------|---------|
| `−` / `+` | Zoom uit/in |
| `⟺` | **Fit-width** — vult beschikbare breedte exact |
| `⬚` / `⧉` | Scroll-modus ↔ één-pagina modus |
| `↻` | Roteer 90° rechtsom |
| `🔍` | Zoeken in PDF-tekst |
| `⏮` | Terug naar pagina 1 |

### Fit-width (⟺)

- Berekent schaal op basis van huidige pagina (niet altijd p.1)
- Houdt rekening met ingebouwde PDF-rotatie (`page.rotate`)
- Past zich automatisch aan bij venstergrootte via `ResizeObserver`
- Handmatig zoomen schakelt fit-width uit

### Paginageheugen

- Laatste gelezen pagina per PDF opgeslagen in `localStorage`
- Automatisch hersteld bij heropenen — ook na server-herstart
- Badge `p.47 / 422` toont huidige positie
- `⏮` wist opgeslagen positie

### Virtueel renderen (grote PDFs)

- Max **7 pagina's** tegelijk in geheugen (huidige ± 3)
- Rest zijn lege placeholders met correcte afmetingen
- Voorkomt geheugen-crash op iPad (422 pagina's = ~7MB i.p.v. ~400MB)
- Render-annulering via ID: nieuwe zoom annuleert lopende render direct

### Één-pagina modus (iPad)

Klik `⬚` → navigeer met ◀ ▶ of **swipe** links/rechts.

### PDF zoeken

Klik `🔍` → typ zoekterm → `Enter` (volgende) / `Shift+Enter` (vorige). Toont `3 / 12`.

### Annotaties

| Kleur | Betekenis |
|-------|-----------|
| 🟡 Geel | Letterlijk citaat |
| 🔵 Blauw | Bron `{.bron}` |
| 🔴 Rood | Kritisch `{.kritisch}` |
| 🟢 Groen | Eigen `{.eigen}` |
| 🟣 Paars | Open vraag |

**Zijbalk**: versleepbaar via linkerrand (min 280px).
**Leesnotitie** (◀✏): schrijf Markdown naast de PDF. `+ p.12` voegt paginakoptekst in.
**Exporteer** (⬆): alle highlights → één literatuurnotitie.

---

## 📚 Boeken-bibliotheek

### Boek toevoegen

1. Klik **+ Boek toevoegen**
2. Plak Bol.com URL → **Cover ophalen**
3. Vul type, taal en status in

### Weergaven

| Knop | Modus |
|------|-------|
| **⊞** | Grid — covers in raster |
| **☰** | Lijst — compacte rijen |
| **≡** | Details — volledige tabel |

### Filters & status

**Alle · Bezig · Nog lezen · Uit · ✓ Gelezen**

Status klikken wisselt door: Nog lezen → Bezig → Uit. "Uit" toont groen ✓ badge op de cover. Elk boek verschijnt automatisch in de **Leeslijst**.

---

## 🤖 AI-integratie

### Lokaal (privé, gratis)

| Provider | Modellen |
|----------|---------|
| **Ollama** | `gemma3:12b`, `qwen3:8b`, `llama3.3:8b` |
| **Jan.ai** | Alle Jan-modellen (poort 1337) |

### Cloud

| Provider | Modellen |
|----------|---------|
| Anthropic | `claude-sonnet-4`, `claude-opus-4` |
| Google | `gemini-2.5-flash`, `gemini-2.5-pro` |
| OpenAI | `gpt-4o`, `o1`, `o3` |
| OpenRouter | 400+ modellen |
| Mistral | `mistral-large` |

API-sleutels via **⚙ Instellingen → API-sleutels**.

### GraphRAG Notebook

1. Stel vraag in Notebook (Ontdekken → Notebook)
2. Server zoekt top-8 notities via TF-IDF + graafstructuur
3. Nodes + buren + community als context → AI antwoordt

**Snelknoppen**: 🗺 Overzicht · 🔍 Kennishiaten · 💡 Verrassende links · 📈 Sterke notities · ⚡ Snelle analyse

---

## ✏️ Drie-lagen annotaties

| Laag | Inline | VIM |
|------|--------|-----|
| **Bron** | `[tekst]{.bron}` | `\b` |
| **Kritisch** | `[tekst]{.kritisch}` | `\k` |
| **Eigen** | `[tekst]{.eigen}` | `\e` |

Filter op laag via de type-filterbalk in de notitieslijst.

---

## ⌨️ VIM Editor

### Modi

| Mode | Activeer |
|------|----------|
| INSERT | `i` / `a` / `o` |
| NORMAL | `Esc` |
| VISUAL | `v` / `V` |
| COMMAND | `:` |

### Ex-commando's

| Commando | Actie |
|----------|-------|
| `:w` / `:wq` | Opslaan / opslaan+sluiten |
| `:vs` | Split-screen |
| `:goyo` | Focusmodus |
| `:spell` | Spellcheck: nl → en → uit |
| `:tag+ naam` | Tag toevoegen |
| `:template naam` | Template laden |
| `:?` | Alle shortcuts |

**Templates**: `dagnotitie` · `meeting` · `literatuur` · `project` · `vraag`

---

## 💡 Tips

**Thema's**
- Thema wisselen → ⚙ Instellingen → 🎨 Thema — direct actief
- Perkament of Beige voor lange lees-/schrijfsessies
- Ghost White voor maximale focus en helder contrast

**PDF**
- `⟺` fit-width past zich aan bij paneel-resize (ResizeObserver)
- Paginageheugen werkt ook na server-herstart
- Grote PDFs op iPad: virtueel renderen voorkomt crash
- Één-pagina modus + swipe voor comfortabel iPad-lezen
- Annotatie-zijbalk: sleep linkerrand voor meer breedte

**Notities**
- Dagnotitie: 📅 naast "nieuw zettel"
- Inbox-badge: amber = vluchtige notities wachten op verwerking
- Embed: `![[Notitietitel]]` voor inline inhoud
- Outline: ☰ in editor toolbar; Tab/Shift+Tab voor indenteren
- Taken: `- [ ]` in notities → Bibliotheek → Taken
- Query: Ontdekken → Query voor filter op type+tags+datum

**AI & Graaf**
- GraphRAG snelknoppen: 🗺/🔍/💡/📈/⚡
- Graph → Notebook: 🕸 in peek-panel
- Lasso: Shift+sleep in graaf
- Graaf verrassing: 🎲

**Overig**
- Git backup: vault is standaard Markdown, Obsidian-compatibel
- Split preview: klik resultaat rechts → overlay zonder editor te storen
- PDF zoekindex: 📝+📄 Alles voor zoeken in PDF-inhoud
- Jan.ai: ⚙ Instellingen → Jan.ai (lokaal)
