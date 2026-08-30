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
├── certs/                 # Lokaal HTTPS-certificaat (voor offline/PWA op iPad — zie certs/README.md)
│   ├── generate-cert.sh    # Genereert server.crt/server.key voor localhost + LAN-IP
│   └── README.md           # Stap-voor-stap: genereren, downloaden, vertrouwen op iPad
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
- **📤 Delen vanuit andere Android-apps** — via het native "Delen"-menu (Google Tasks, Keep, browser, WhatsApp, wat dan ook) rechtstreeks een taak/notitie vastleggen in de dagnotitie van vandaag, met een bevestigingsscherm voordat het opgeslagen wordt. Vereist dat de app als PWA op het beginscherm staat — zie [Offline gebruik](#offline-gebruik-ipad)
- **📋 Google Tasks** (optioneel, zie [hieronder](#google-tasks-koppelen)) — openstaande taken selecteren en overnemen

---

### 📝 Schrijven — Notitie-editor

- **VIM-editor** — volledige VIM-keybindings (normaal/insert/visual mode, `:w` opslaan)
  - **Muisondersteuning** — klik om de cursor te positioneren (werkt in élke mode), sleep om tekst te selecteren (start automatisch VISUAL-mode)
  - **Regelnummers** — relatieve nummering standaard aan (`:set nornu` om uit te zetten)
  - **Uitgebreid hulpscherm** (`?`) — overzicht van alle sneltoetsen: navigatie, bewerken, text objects, visual, folds, marks/macro's, links (`[[`), bron-markering (`\b`/`\k`/`\e`), AI-tekstverbetering en muisacties
  - **AI-tekstverbetering** (Cmd/Ctrl+I, of `\a` na een selectie) — selecteer tekst (of laat leeg voor de huidige alinea) en kies Verbeteren / Korter / Uitgebreider / Andere toon / een eigen instructie. Het voorstel wordt altijd eerst getoond — nooit automatisch toegepast
  - **→ Dagnotitie** (`\d`) — de tegenhanger van Fragment→Zettelkasten: stuurt selectie (of de huidige alinea) als taak naar de dagnotitie van vandaag, met een terugverwijzing naar de bronnotitie
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
- **Offline caching** — sla PDF op voor gebruik zonder server (⬇ Offline, in zowel de raster- als lijstweergave); toont een duidelijke foutmelding als het cachen mislukt, i.p.v. altijd "gelukt" te tonen
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
- **Ook PDF's doorzoekbaar op betekenis** — aparte "PDF's indexeren"-sectie; doorzoekt de PDF-tekst die de PDF-index toch al per pagina bijhoudt, op paginaniveau gechunkt. Resultaten tonen bestand + paginanummer + fragment, en openen het PDF direct op de juiste pagina. Index opgeslagen in `.zettelkasten_pdf_embeddings.json`
- **Hybride zoeken** — combineert BM25-tekstzoeken met embeddings (reciprocal rank fusion), voor zowel notities als PDF's — vindt ook exacte termen (ADR-nummers, productcodes) die pure embeddings zouden missen
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
  - **Model per taak** — optioneel een ander model dan je hoofdmodel instellen voor Afbeeldingen, Semantisch zoeken en Tekstverbetering. Leeg = automatisch (val terug op het hoofdmodel, of bij Semantisch zoeken direct op een embedding-model — `bge-m3` staat er als meertalig alternatief bij, aanbevolen voor niet-Engelstalige vaults). Toont of het standaardmodel voor die taak al lokaal geïnstalleerd is
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

### Delen vanuit andere apps (Android)

Met de app als PWA op het beginscherm (zelfde "Zet op beginscherm"-stap
als hierboven, via het deelmenu van je eigen browser op Android) verschijnt
**"Zettelkasten"** voortaan ook als optie in het native **Delen**-menu van
elke andere app — Google Tasks, Keep, de browser, WhatsApp, wat dan ook.
Tik op de gedeelde tekst → toont een bevestigingsscherm → **"→ Toevoegen
aan dagnotitie"**.

> **Let op:** na het bijwerken van de app moet de PWA eenmalig **verwijderd
> en opnieuw** op het beginscherm gezet worden — Android cachet de
> deel-registratie hardnekkig bij een gewone update.

> **Let op:** de standalone PWA (beginscherm-icoon) heeft een aparte opslagcontext van Safari. Cache wissen in Safari-instellingen heeft geen invloed op de PWA.

---

## Vereisten

| Component | Versie | Doel |
|-----------|--------|------|
| Python | ≥ 3.10 | Server |
| Ollama | latest | Lokale AI |
| nomic-embed-text | via Ollama | Semantisch zoeken (standaard) |
| bge-m3 | via Ollama | Semantisch zoeken — optioneel alternatief, native meertalig (100+ talen), vaak nauwkeuriger voor niet-Engelse vaults. Instelbaar via Instellingen → Modellen → Model per taak. Na het wisselen: "Volledig herindexeren" gebruiken, niet "bijwerken" |
| gemma3:12b | via Ollama | Aanbevolen generatief hoofdmodel |
| llama3.2-vision | via Ollama | Afbeeldingen (standaard) |
| Chrome / Safari / Firefox | modern | Frontend |

**Optionele cloud-modellen:**
- `OPENAI_API_KEY` — OpenAI GPT-modellen
- `ANTHROPIC_API_KEY` — Anthropic Claude
- Mistral API-sleutel

---

## Google Tasks koppelen

Toont je openstaande Google Tasks op het "⚡ Vandaag"-scherm, zodat je ze
kunt selecteren en met één klik overnemen als taak in je dagnotitie. **Puur
lezen** — de app schrijft nooit terug naar Google Tasks.

> **Waarom niet Google Keep?** Onderzocht, maar Google Keep heeft geen
> officiële API voor persoonlijke Gmail-accounts (alleen voor zakelijke
> Workspace-accounts, via een beheerder) — de enige programmatische toegang
> zou via een niet-officiële bibliotheek moeten, met een hoog-risico
> "master token" die volledige accounttoegang geeft. Dat past niet bij het
> privacy-first uitgangspunt van deze app. Google Tasks heeft wél een
> gewone, officiële API met standaard OAuth — vandaar de keuze.

Er is geen gedeelde app-sleutel — je maakt eenmalig je **eigen, gratis**
Google Cloud-project aan, alleen voor je eigen gebruik. Duurt ~5 minuten,
eenmalig.

### Stap 1 — Google Cloud-project aanmaken

1. Ga naar [console.cloud.google.com](https://console.cloud.google.com) en log in met hetzelfde Google-account waar je Google Tasks op gebruikt
2. Bovenin: **project selecteren → Nieuw project**
3. Geef een naam (bv. "Zettelkasten") → **Aanmaken**

### Stap 2 — Google Tasks API inschakelen

1. Zoek in de bovenste zoekbalk naar **"Google Tasks API"**
2. Open het resultaat → **Inschakelen**

### Stap 3 — OAuth-toestemmingsscherm instellen

1. Menu (☰) → **API's en services → OAuth-toestemmingsscherm**
2. Kies **Extern** (External) → **Aanmaken**
3. Vul een app-naam in (bv. "Zettelkasten Tasks-koppeling"), je eigen e-mailadres bij "Ondersteuning" en onderaan bij "Contactgegevens ontwikkelaar" → **Opslaan en doorgaan**
4. Bij "Scopes": niets toevoegen nodig, gewoon **Opslaan en doorgaan**
5. Bij "Testgebruikers": **+ Add users** → voer je eigen Gmail-adres in → **Toevoegen** → **Opslaan en doorgaan**

Dit laatste stapje is belangrijk: zolang de app in **"Testing"**-status
staat (de standaard, en voor eigen gebruik hoef je dat nooit te wijzigen),
werkt de koppeling alleen voor de e-mailadressen die je hier expliciet als
testgebruiker toevoegt — dat is precies wat je wilt, en voorkomt dat je
door Google's uitgebreide verificatieproces voor publieke apps hoeft.

### Stap 4 — OAuth-credentials aanmaken

1. Menu (☰) → **API's en services → Inloggegevens**
2. **+ Inloggegevens maken → OAuth-client-ID**
3. Applicatietype: **Webtoepassing**
4. Bij **"Geautoriseerde omleidings-URI's"** → **+ URI toevoegen**, voer exact in
   (pas de poort aan als je de server niet op 8888 draait):
   ```
   http://localhost:8888/api/google-tasks/callback
   ```
5. **Maken** — je krijgt nu een **Client-ID** en **Clientgeheim** te zien. Kopieer beide.

### Stap 5 — Koppelen in de app

1. Open de app → **⚙ Instellingen → API-sleutels**, scroll naar **"📋 Google Tasks"**
2. Plak de Client-ID en het Clientgeheim uit stap 4 → **💾 Opslaan**
3. Klik **🔗 Verbind met Google** — er opent een nieuw tabblad met Google's toestemmingsscherm
4. Log in (met het account dat je als testgebruiker toevoegde) en geef toestemming
5. Je ziet een bevestigingspagina ("✓ Gekoppeld") — dat tabblad kun je sluiten
6. Terug in de app: klik **↻** naast de knoppen om de status te verversen — er verschijnt nu "✓ Verbonden"

Ga naar het "⚡ Vandaag"-scherm: je openstaande Google Tasks staan er nu,
aanvinkbaar, met een **"→ Opnemen"**-knop die de geselecteerde taken direct
aan de dagnotitie van vandaag toevoegt.

**Loskoppelen** kan altijd via dezelfde instellingenpagina.

---

## Een bewuste keuze: geen plugin-systeem

Deze app heeft, anders dan Obsidian (2000+ community-plugins) of Logseq,
geen plugin-architectuur — en dat is geen ontbrekende functie, maar een
expliciete afweging.

**Wat je daarmee wint:** diepte in plaats van breedte. Een highlight-kleur
tijdens het lezen draagt zijn betekenis (bron/kritisch/eigen) daadwerkelijk
door tot in de uiteindelijke notitie; spaced repetition (FSRS) werkt tegen
hetzelfde datamodel als de Zettelkasten-structuur zelf; semantisch zoeken
bestrijkt notities én PDF's via één en dezelfde index. Bij een
plugin-ecosysteem is de gebruiker zelf de lijm tussen zulke losse
functies — hier zit die lijm al ingebakken.

**Wat je daarvoor inlevert:** elke uitbreiding vereist een wijziging in de
hoofd-codebase, niet een los te installeren plugin. Voor een persoonlijk
systeem (één gebruiker, één onderhouder) is dat een aanvaardbare
afweging — maar het is een reëel plafond mocht deze app ooit breder
gedeeld worden dan dat.

---

*Gebouwd in 30+ sessies als lokaal, privacy-first alternatief voor Obsidian / Logseq / Notion.*
*Geen vendor lock-in. Geen abonnement. Alle data in plain Markdown.*
