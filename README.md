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

# Voor offline/PWA-gebruik op de iPad: HTTPS vereist (eenmalige setup,
# zie certs/README.md) — start daarna met:
python3 server.py --host 0.0.0.0 --port 8888 --https

# Vendor-bestanden downloaden (eenmalig, voor offline gebruik)
cd static/vendor && bash download-vendors.sh

# Ollama modellen installeren
ollama pull gemma3:12b        # generatief model (aanbevolen)
ollama pull nomic-embed-text  # embedding model voor semantisch zoeken
```

Open de app via `http://localhost:8888` (laptop) of `https://<IP-adres>:8888` (iPad, na de HTTPS-setup — zie [`certs/README.md`](certs/README.md)).

---

## Architectuur

```
zettelkasten-vim/
├── server.py              # Python HTTP-server (geen frameworks)
├── static/
│   ├── index.html         # App shell — laadt React + alle modules
│   ├── app.js             # Hoofd-app: state, routing, navigatie
│   ├── service-worker.js  # PWA offline caching
│   └── modules/           # React-componenten
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
- **AI:** Ollama (lokaal) + cloud-modellen (OpenAI, Anthropic, Mistral, Jan) — met per-taak modelkeuze (zie [Instellingen](#-instellingen))
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
- **✎ Snelle notitie** — maak in één stap een losstaande, zelfstandige notitie aan (titel + Enter) — anders dan de bullets hieronder, die aan de dagnotitie zelf toevoegen
- **SR-reviews** — overzicht notities die vandaag herhaald moeten worden (rechterkolom op brede schermen)
- **Responsieve twee-kolom layout** — dagnotitie links, SR-reviews rechts op bredere schermen; past zich live aan bij het draaien van de iPad of in/uit split-view-multitasking
- **Statistieken** — notities totaal, reviews vandaag, in SR-systeem, openstaande taken
- **📋 Nieuwe ADR** — Architecture Decision Record met vooraf ingevuld sjabloon (context, beslissing, alternatieven, consequenties, betrokkenen, status-geschiedenis)
- **Recente activiteit** — notities van de afgelopen 7 dagen met +SR knop

---

### 📝 Schrijven — Notitie-editor

- **VIM-editor** — volledige VIM-keybindings (normaal/insert/visual mode, `:w` opslaan)
  - **Muisondersteuning** — klik om de cursor te positioneren (werkt in élke mode), sleep om tekst te selecteren (start automatisch VISUAL-mode)
  - **Regelnummers** — relatieve nummering standaard aan (`:set nornu` om uit te zetten)
  - **Uitgebreid hulpscherm** (`?`) — overzicht van alle sneltoetsen: navigatie, bewerken, text objects, visual, folds, marks/macro's, links (`[[`), bron-markering (`\b`/`\k`/`\e`), AI-tekstverbetering en muisacties
  - **AI-tekstverbetering** (Cmd/Ctrl+I, of `\a` na een selectie) — selecteer tekst (of laat leeg voor de huidige alinea) en kies Verbeteren / Korter / Uitgebreider / Andere toon / een eigen instructie. Het voorstel wordt altijd eerst getoond — nooit automatisch toegepast
- **Markdown-editor** — rijke teksteditor met syntaxmarkering
- **Live preview** — split-view editor + gerenderde preview
- **Outline-editor** — hiërarchische bullets voor notulen en plannen; standaard actief op touch-apparaten, met een altijd-zichtbare toggle naar VIM-mode
- **Bionic Reading** — vetgedrukte fixatiepunten per woord (toggle in toolbar, opgeslagen voorkeur)
- **Spellcheck** — Nederlandse en Engelse spellingcontrole
- **Slimme links** — automatische backlink-suggesties naar verwante notities
- **Object Fields** — gestructureerde YAML-velden per notitie
- **Tags** — vrije tagging met autocomplete, multi-select filteren waar van toepassing
- **Notitietypen** — fleeting, literature, permanent, structure, ADR, boek
- **AI-samenvatting** — samenvatting via gekozen Ollama-model
- **Leestijd** — geschatte leestijd in de toolbar

---

### 🎨 Canvas — Whiteboard

- Vrij tekenen (pen, markeerstift, gum, vormen)
- Notities als sticky notes op het canvas, in zes herkenbare kleuren (geel/blauw/rood/groen/paars/grijs)
- **Radiaal actiemenu** — rechtsklik op een kaart voor Bewerken/Verbinden/Notitie/Graaf/Dupliceren/Verwijderen, en een verkenmenu naar gerelateerde notities
- Mermaid-diagrammen en mindmaps inbedden
- Exporteren als PNG

---

### 📚 Bibliotheek

#### 📄 PDF-bibliotheek (geïntegreerde hub)

- **Gecombineerd overzicht** — alle PDFs op één plek (upload, lezen, annoteren, status)
- **Filter-pills** — Alle / Ongelezen / Gelezen / Offline
- **Herziene toolbar** — gegroepeerd (navigatie · markeren · panelen · bestand), met consistente iconen; op smallere schermen (iPad) blijven alleen de knoppen zichtbaar die je tijdens het lezen steeds nodig hebt, de rest verhuist naar een "meer"-menu met grotere tikdoelen
- **Markeren** — drie modi (Markeer / Markeer+notitie / Notitie) als duidelijke segmented control, vijf kleuren met elk hun eigen laag-betekenis (bron/kritisch/eigen)
- **Betrouwbare meerdere-regels-selectie** — tekst selecteren over meerdere regels breekt niet meer af tijdens het lezen
- **Nette highlight-markeringen** — doorlopende regel-balken in plaats van gefragmenteerde stukjes
- **Verwante notities tijdens het lezen** — zijpaneel toont relevante notities op basis van je actieve selectie, zonder dat je naar Notebook hoeft te wisselen
- **Annotatieteller** — gele badge (✦ n) per PDF in de lijstweergave
- **Gelezen-status** — toggle per PDF, zichtbaar in de lijst
- **Offline caching** — sla PDF op voor gebruik zonder server (⬇ Offline)
- **AI-samenvatting** — automatische samenvatting van de PDF-inhoud (optioneel eigen model, zie Instellingen)

#### 🖼 Plaatjes

- Galerie van alle afbeeldingen in de vault
- **Pin-annotaties** — klik op een afbeelding om een pin te plaatsen, met notitie, tags en kleur
- AI-beeldherkenning (optioneel eigen model, zie Instellingen)

#### 📖 Leeslijst

- Geïmporteerde web-artikelen met leestijd, status en samenvatting
- Filter ongelezen/gelezen/duplicaten

#### 🔁 Review — Spaced Repetition (FSRS)

- **FSRS-algoritme** — modern, wiskundig optimaal herhaalschema, opvolger van SM-2
- **4 beoordelingsniveaus** — 😕 Vergeten / 😐 Moeite / 🙂 Goed / 😄 Gemakkelijk
- **Interval-preview** — volgende reviewdatum per knop zichtbaar vóór beoordeling
- **AI recall-vraag** — Ollama genereert een contextgerichte vraag voor actief ophalen
- **Integratie Vandaag** — geplande reviews verschijnen automatisch in het dagscherm

#### ✓ Taken

- `- [ ]` checkboxen over alle notities verzameld in één paneel
- Afvinken zonder de notitie te openen
- Filter op tag, sorteren nieuw→oud of oud→nieuw

#### ✦ Annotaties

- Overzicht alle annotaties over alle PDFs en afbeeldingen
- Filter per bestand, kleur of datum

#### 📚 Boeken

- Boekencatalogus met auteur, status, rating
- **"📖 Lees"-knop** — springt direct naar het gekoppelde PDF om verder te lezen/highlighten (automatisch gekoppeld op titelovereenkomst)
- Leesnotities per boek koppelen aan Zettelkasten

---

### 🔍 Ontdekken

#### 🔍 Zoeken

- Fuzzy full-text zoekopdrachten over alle notities
- Regelnummers, context per treffer

#### 🧠 Semantisch zoeken

- **Lokale embeddings** via Ollama (`nomic-embed-text`, 84MB) — of een eigen embedding-model, zie Instellingen
- Vindt notities op *betekenis* — ook zonder exacte trefwoorden
- **Index bouwen** — indexeer notities in batches; index opgeslagen in `.zettelkasten_embeddings.json`
- **Hybride zoeken** — combineert BM25-tekstzoeken met embeddings
- **Score-weergave** — resultaten met % overeenkomst
- Beschikbaar in het hoofd-scherm én in de split-balk

#### 🕸 Graaf

- Interactief kennisnetwerk van alle notities en verbindingen
- Zoom, filter op tag (multi-select) of notitietype
- **Typed links** — verbindingen met een betekenis (inspireert, weerlegt, bouwt-voort-op, zie-ook, verwijst-naar), zichtbaar als kleur in de graaf
- **Opschonen** — gebroken links opruimen, lege of "wees"-notities (zonder enige link) verwijderen, vault-opschoning — alles vanuit het zijpaneel

#### 🗺 Mindmap

- Automatisch gegenereerde mindmap vanuit notitie-inhoud
- **Als Mermaid** — bekijk/exporteer de huidige mindmap als Mermaid-code
- **Opslaan als notitie** — bewaar de volledige mindmap als Markdown-notitie

#### 🧠 Notebook — AI-assistent

- Vrije chat met gekozen model over de kennisbase
- **GraphRAG** — antwoorden op basis van de graafstructuur
- Contextvenster: selecteer welke notities meegestuurd worden, met multi-tag-filter
- **Gesprek blijft behouden** bij het wisselen tussen tabs — ook binnen split-scherm
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
- **Thema** — Dark, Gruvbox, Nord, Forest, **Zomerlicht** (crème, hoog-contrast — WCAG AAA, geoptimaliseerd voor buiten/felle zon), en meer
- **API-sleutels** — OpenAI, Anthropic, Mistral
- **Modellen**
  - Overzicht en beheer van eigen (OpenAI-compatibele) modellen
  - **Model per taak** — optioneel een ander model dan je hoofdmodel instellen voor Afbeeldingen, Semantisch zoeken en Tekstverbetering. Leeg = automatisch (val terug op het hoofdmodel, of bij Semantisch zoeken direct op een embedding-model). Toont of het standaardmodel voor die taak al lokaal geïnstalleerd is
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
Notebook behoudt zijn gesprek ook in de split-rechts-positie, los van de hoofdweergave.

---

## Offline gebruik iPad

> **Vereist HTTPS.** Service Workers (nodig voor offline/PWA) werken niet
> over een gewoon `http://`-adres naar het netwerk-IP van de laptop —
> alleen `https://` of `http://localhost` gelden als "secure context".
> Zie **[`certs/README.md`](certs/README.md)** voor het eenmalig aanmaken
> en op de iPad vertrouwen van een lokaal certificaat, en start de server
> daarna met `--https`. Zonder dit werkt de app op de iPad prima zolang er
> verbinding is, maar niet offline.

1. Open de app op de iPad (via `https://`, zie hierboven) terwijl de laptop bereikbaar is (Service Worker installeert)
2. Deel-icoon → **"Zet op beginscherm"** voor standalone PWA
3. Per PDF: **⬇ Offline** in de PDF-bibliotheek voor offline caching
4. **Werkt offline:**
   - Notities lezen en bewerken (IndexedDB sync-queue)
   - Gecachede PDFs lezen en annoteren
   - Reviews doen
   - Dagnotitie schrijven
5. Wijzigingen worden automatisch gesynchroniseerd bij herverbinding
6. Layout past zich responsief aan bij het draaien van de iPad of split-view-multitasking

> **Let op:** de standalone PWA (beginscherm-icoon) heeft een aparte opslagcontext van Safari. Cache wissen in Safari-instellingen heeft geen invloed op de PWA.

---

## Vereisten

| Component | Versie | Doel |
|-----------|--------|------|
| Python | ≥ 3.10 | Server |
| Ollama | latest | Lokale AI |
| nomic-embed-text | via Ollama | Semantisch zoeken (standaard) |
| gemma3:12b | via Ollama | Aanbevolen generatief hoofdmodel |
| llama3.2-vision | via Ollama | Afbeeldingen (standaard) |
| Chrome / Safari / Firefox | modern | Frontend |

**Optionele cloud-modellen:**
- `OPENAI_API_KEY` — OpenAI GPT-modellen
- `ANTHROPIC_API_KEY` — Anthropic Claude
- Mistral API-sleutel

---

*Gebouwd in 30+ sessies als lokaal, privacy-first alternatief voor Obsidian / Logseq / Notion.*
*Geen vendor lock-in. Geen abonnement. Alle data in plain Markdown.*
