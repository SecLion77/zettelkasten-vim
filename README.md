# Zettelkasten VIM — Persoonlijk Kennisbeheersysteem

Een lokale, privacy-first PKM-applicatie (Personal Knowledge Management) gebouwd als Progressive Web App. Draait volledig op de eigen machine — geen cloud, geen abonnement, geen advertenties.

---

## Inhoudsopgave

1. [Installatie & opstarten](#installatie--opstarten)
2. [Architectuur](#architectuur)
3. [Functies per module](#functies-per-module)
4. [Navigatiestructuur](#navigatiestructuur)
5. [Offline gebruik iPad](#offline-gebruik-ipad)
6. [Vereisten](#vereisten)

---

## Installatie & opstarten

```bash
# Server starten (lokaal netwerk — ook bereikbaar via iPad)
cd /Users/hj/Applications/zettelkasten-vim
python3 server.py --host 0.0.0.0 --port 8888

# Vendor-bestanden downloaden (eenmalig, voor offline gebruik)
cd static/vendor && bash download-vendors.sh

# Ollama modellen installeren
ollama pull gemma3:12b        # generatief model (aanbevolen)
ollama pull nomic-embed-text  # embedding model voor semantisch zoeken
```

Open de app via `http://localhost:8888` of via het IP-adres van de laptop op de iPad.

---

## Architectuur

```
zettelkasten-vim/
├── server.py              # Python HTTP-server (geen frameworks)
├── static/
│   ├── index.html         # App shell — laadt React + alle modules
│   ├── app.js             # Hoofd-app: state, routing, navigatie
│   ├── service-worker.js  # PWA offline caching (zk-sw-v22)
│   └── modules/           # 35 React-componenten
└── vault/                 # Alle gebruikersdata (Markdown-bestanden)
    ├── notes/             # Zettelkasten-notities (*.md)
    ├── pdfs/              # Geüploade PDF-bestanden
    ├── annotations/       # PDF-annotaties (JSON)
    ├── dagboek/           # Dagnotities (YYYY-MM-DD.md)
    └── images/            # Afbeeldingen
```

**Technische stack:**
- **Backend:** Python 3.14, standaardbibliotheek only
- **Frontend:** React 18 (UMD), vanilla JS modules
- **AI:** Ollama (lokaal) + cloud-modellen (OpenAI, Anthropic, Mistral, Jan)
- **PDF:** PDF.js 3.11
- **Opslag:** Markdown-bestanden — direct bewerkbaar in elke editor

---

## Functies per module

### ⚡ Vandaag — Dagelijks startscherm

Het startscherm dat elke sessie richting geeft:

- **Dagnotitie** — persistente journaalentry per datum (`dagboek/YYYY-MM-DD.md`)
- **Datumnavigatie** — blader met ‹ › door eerdere dagen; klik op datum voor terug naar vandaag
- **Auto-save** — dagnotitie wordt automatisch bewaard na 1,5 seconden stilte
- **Markdown preview** — dagnotitie gerenderd als rijke tekst, klik om te bewerken
- **Fragment → Zettelkasten** — selecteer tekst in de dagnotitie → popup → maak er een permanente notitie van; fragment wordt in de dagnotitie gemarkeerd als `~~tekst~~ ([[Notitietitel]])`
- **SR-reviews** — overzicht notities die vandaag herhaald moeten worden (rechterkolom op brede schermen)
- **Twee-kolom layout** — dagnotitie links, SR-reviews rechts op schermen ≥ 900px
- **Statistieken** — notities totaal, reviews vandaag, in SR-systeem, openstaande taken
- **⚡ Snel vastleggen** — maak direct een capture-notitie aan
- **📋 Nieuwe ADR** — Architecture Decision Record met vooraf ingevuld sjabloon (context, beslissing, alternatieven, consequenties, betrokkenen, status-geschiedenis)
- **Recente activiteit** — notities van de afgelopen 7 dagen met +SR knop

---

### 📝 Schrijven — Notitie-editor

- **VIM-editor** — volledige VIM-keybindings (normaal/insert/visual mode, `:w` opslaan)
- **Markdown-editor** — rijke teksteditor met syntaxmarkering
- **Live preview** — split-view editor + gerenderde preview
- **Outline-editor** — hiërarchische bullets voor notulen en plannen
- **Bionic Reading** — vetgedrukte fixatiepunten per woord (toggle in toolbar, opgeslagen voorkeur)
- **Spellcheck** — Nederlandse en Engelse spellingcontrole
- **Slimme links** — automatische backlink-suggesties naar verwante notities
- **Object Fields** — gestructureerde YAML-velden per notitie
- **Tags** — vrije tagging met autocomplete
- **Notitietypen** — fleeting, literature, permanent, structure, ADR, boek
- **AI-samenvatting** — samenvatting via gekozen Ollama-model
- **Leestijd** — geschatte leestijd in de toolbar

---

### 🎨 Canvas — Whiteboard

- Vrij tekenen (pen, markeerstift, gum, vormen)
- Notities als sticky notes op het canvas
- Mermaid-diagrammen en mindmaps inbedden
- Exporteren als PNG

---

### 📚 Bibliotheek

#### 📄 PDF-bibliotheek (geïntegreerde hub)

- **Gecombineerd overzicht** — alle PDFs op één plek (upload, lezen, annoteren, status)
- **Filter-pills** — Alle / Ongelezen / Gelezen / Offline
- **Annotaties** — markeer tekst, voeg notities toe per pagina, vijf annotatieklassen
- **Annotatieteller** — gele badge (✦ n) per PDF in de lijstweergave
- **Gelezen-status** — toggle per PDF, zichtbaar in de lijst
- **Offline caching** — sla PDF op voor gebruik zonder server (⬇ Offline)
- **AI-samenvatting** — automatische samenvatting van de PDF-inhoud

#### 🖼 Plaatjes

- Galerie van alle afbeeldingen in de vault
- Annotaties op afbeeldingen

#### 📖 Leeslijst

- Geïmporteerde web-artikelen met leestijd, status en samenvatting
- Filter ongelezen/gelezen/duplicaten

#### 🔁 Review — Spaced Repetition (SM-2)

- **SuperMemo-2 algoritme** — wiskundig optimale herhaalschema's
- **4 beoordelingsniveaus** — 😕 Vergeten / 😐 Moeite / 🙂 Goed / 😄 Gemakkelijk
- **Interval-preview** — volgende reviewdatum per knop zichtbaar vóór beoordeling
- **Ease-factor** — individuele moeilijkheidsgraad per notitie
- **AI recall-vraag** — Ollama genereert een contextgerichte vraag voor actief ophalen
- **Integratie Vandaag** — geplande reviews verschijnen automatisch in het dagscherm

#### ✓ Taken

- `- [ ]` checkboxen over alle notities verzameld in één paneel
- Afvinken zonder de notitie te openen

#### ✦ Annotaties

- Overzicht alle annotaties over alle PDFs en afbeeldingen
- Filter per bestand, kleur of datum

#### 📚 Boeken

- Boekencatalogus met auteur, status, rating
- Leesnotities per boek koppelen aan Zettelkasten

---

### 🔍 Ontdekken

#### 🔍 Zoeken

- Fuzzy full-text zoekopdrachten over alle notities
- Regelnummers, context per treffer

#### 🧠 Semantisch zoeken

- **Lokale embeddings** via Ollama (`nomic-embed-text`, 84MB)
- Vindt notities op *betekenis* — ook zonder exacte trefwoorden
- **Index bouwen** — indexeer notities in batches; index opgeslagen in `.zettelkasten_embeddings.json`
- **Score-weergave** — resultaten met % overeenkomst
- Beschikbaar in het hoofd-scherm én in de split-balk

#### 🕸 Graaf

- Interactief kennisnetwerk van alle notities en verbindingen
- Zoom, filter op tag of notitietype

#### 🗺 Mindmap

- Automatisch gegenereerde mindmap vanuit notitie-inhoud

#### 🧠 Notebook — AI-assistent

- Vrije chat met gekozen model over de kennisbase
- **GraphRAG** — antwoorden op basis van de graafstructuur
- Contextvenster: selecteer welke notities meegestuurd worden
- **Modelselectie** — lokaal (Ollama) of cloud (OpenAI, Anthropic, Mistral, Jan)
- Embedding-modellen automatisch gefilterd uit de selectie

#### 🔎 Query

- Geavanceerde filtervragen op tag, type, datum en inhoud

#### 🏷 Tags

- Tags samenvoegen, hernoemen, verwijderen
- Statistieken per tag

---

### 🌐 Invoer

#### 🌐 URL / Word

- Web-artikelen importeren als Markdown-notitie
- AI-samenvatting en automatische tagging bij import
- Word-documenten (.docx) importeren

#### 📊 Statistieken

- Vault-statistieken: notities per dag, tag, type
- Activiteitenkalender

---

### ⚙ Instellingen

- **Vault** — pad instellen, structuuroverzicht
- **Thema** — Dark, Gruvbox, Zomer, Neon en meer
- **API-sleutels** — OpenAI, Anthropic, Mistral
- **Modellen** — overzicht beschikbare Ollama-modellen
- **PDF** — standaard annotatiekleur, pagina-weergave
- **Weergave** — lettergrootte, regelafstand
- **Offline** — opslaggebruik per categorie, PDF-limiet (50–500MB)
- **Versienummer** — App build-hash en SW-versie, herladen-knop

---

## Navigatiestructuur

```
⚡ Vandaag
📝 Schrijven
🎨 Canvas
📚 Bibliotheek
  ├── 📄 PDF
  ├── 🖼 Plaatjes
  ├── 📖 Leeslijst
  ├── 🔁 Review
  ├── ✓ Taken
  ├── ✦ Annotaties
  └── 📚 Boeken
🔍 Ontdekken
  ├── 🔍 Zoeken
  ├── 🧠 Semantisch
  ├── 🕸 Graaf
  ├── 🗺 Mindmap
  ├── 🧠 Notebook
  ├── 🔎 Query
  └── 🏷 Tags
🌐 Invoer
  ├── 🌐 URL / Word
  └── 📊 Statistieken
```

**Split-scherm** — elk scherm naast een notitie. Rechterbalk (scrollbaar met ‹ ›):
`Notities · Semantisch · Taken · Annotaties · Query · PDF · Plaatjes · Zoeken · Graaf · Mindmap · Notebook · Canvas`

---

## Offline gebruik iPad

1. Open de app op de iPad terwijl de laptop bereikbaar is (SW v22 installeert)
2. Deel-icoon → **"Zet op beginscherm"** voor standalone PWA
3. Per PDF: **⬇ Offline** in de PDF-bibliotheek voor offline caching
4. **Werkt offline:**
   - Notities lezen en bewerken (IndexedDB sync-queue)
   - Gecachede PDFs lezen en annoteren
   - SM-2 reviews doen
   - Dagnotitie schrijven
5. Wijzigingen worden automatisch gesynchroniseerd bij herverbinding

> **Let op:** de standalone PWA (beginscherm-icoon) heeft een aparte opslagcontext van Safari. Cache wissen in Safari-instellingen heeft geen invloed op de PWA.

---

## Vereisten

| Component | Versie | Doel |
|-----------|--------|------|
| Python | ≥ 3.10 | Server |
| Ollama | latest | Lokale AI |
| nomic-embed-text | via Ollama | Semantisch zoeken |
| gemma3:12b | via Ollama | Aanbevolen generatief model |
| Chrome / Safari / Firefox | modern | Frontend |

**Optionele cloud-modellen:**
- `OPENAI_API_KEY` — OpenAI GPT-modellen
- `ANTHROPIC_API_KEY` — Anthropic Claude
- Mistral API-sleutel

---

*Gebouwd in 30+ sessies als lokaal, privacy-first alternatief voor Obsidian / Logseq / Notion.*
*Geen vendor lock-in. Geen abonnement. Alle data in plain Markdown.*
