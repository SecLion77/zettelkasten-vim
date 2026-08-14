# Integratiehandleiding — typed links (afgerond)

## Wat er is gebeurd t.o.v. de vorige levering

Met `Graph.js`, `LinksSidebar.js`, `SmartLinkSuggester.js`, `TasksPanel.js`,
`NoteEditor.js`, `NotesTab.js`, `app.js` en `index.html` in beeld bleek dat
drie van de vier oorspronkelijke voorstellen **al bestonden**:

| Voorstel | Status |
|---|---|
| Typed links (4a) | Bestond half: `extractTypedLinks`/`LINK_TYPES` stonden al dood in `app.js`, nooit gebruikt. **Nu afgemaakt.** |
| Verwante notities tijdens schrijven (3.2a) | Bestond al volledig (`SmartLinkSuggester.js` + `LinksSidebar.js`). Uitgebreid met type-invoeging. |
| Dashboard/Command Center (2.2a) | **Bestond al volledig** — de "Vandaag"-tab (`DailyView.js`) toont al Inbox, Openstaande taken én Reviews-vandaag in één grid. Geen wijziging nodig. |
| Graafweergave met typed links (2.2c) | `Graph.js` bestond al (canvas-based, zeer uitgebreid). **Uitgebreid** met typed-edge-kleuring en legenda. |

De losse bestanden uit de vorige levering (`RelatedNotesPanel.js`, `Dashboard.js`,
`GraphView.js`, oude `server.py.diff`) zijn **vervallen** — die hadden bestaande
functionaliteit gedupliceerd. Gebruik uitsluitend de bestanden in deze levering.

## Wat je moet doen

**Simpel: vervang deze 5 bestanden door de versies hieronder, herstart de server.**
Geen andere stappen — alle wiring (tabs, props, scripts) bestond al en is intact
gelaten. `DailyView.js`, `NoteEditor.js`, `TasksPanel.js`, `ReviewPanel.js`,
`NotesTab.js`, `TagManager.js` en `index.html` zijn **niet gewijzigd**.

| Bestand | Wijziging |
|---|---|
| `server.py` | Typed-links backend (`extract_typed_links`, `get_typed_graph`, `/api/graph-data`), `LINK_TYPES` afgestemd op de 5 al bestaande client-side types |
| `app.js` | **1 regel**: `extractLinks` negeert nu `\|type`-suffix (was stuk voor getypeerde links) |
| `Graph.js` | Typed links resolven naar edges, gekleurd/gestippeld volgens `LINK_TYPES`, legenda uitgebreid |
| `LinksSidebar.js` | Outlinks/backlinks herkennen getypeerde links (waren stuk), type-badge in Outlinks-tab |
| `SmartLinkSuggester.js` | "▾"-knop bij elke suggestie opent type-kiezer → voegt `[[titel\|type]]` in |

Zie de losse `.diff`-bestanden voor het exacte verschil per bestand, ter controle.

## Getest

- `server.py`: `py_compile` + functionele test (typed graph met ID- en titel-links, alle 5 linktypes)
- `app.js`, `Graph.js`, `LinksSidebar.js`, `SmartLinkSuggester.js`: `node --check` + een
  end-to-end test van de hele keten (invoegen → `extractLinks` → `extractTypedLinks`)
  bevestigt dat een getypeerde link zowel gewoon resolvet (backlinks, graafedges)
  als zijn type correct teruggeeft.

## Hoe het werkt voor jou als gebruiker

1. Open een notitie, klik **🔗 koppelen** (of de Linken-tab in de rechter zijbalk).
2. Bij elke suggestie: klik **+ link** voor een gewone link, of **▾** om een type te
   kiezen (inspireert / weerlegt / bouwt voort op / zie ook / verwijst naar).
3. In de **Graaf**-tab worden getypeerde links nu automatisch gekleurd getekend
   (doorgetrokken of gestippeld, per type), met een legenda onderaan.
4. In de **rechter zijbalk → Uit**-tab zie je bij elke uitgaande link het type terug.

## Twee dingen die ik tegenkwam, los van je vraag

- **`/api/graph-data`** (de nieuwe server-route) wordt momenteel door niets in de
  UI aangeroepen — `Graph.js` bouwt zijn graaf zelf, client-side, uit `notes`.
  Ik heb de route toch laten staan: hij is nu een herbruikbare, kant-en-klare
  API voor toekomstig gebruik (bijv. een MCP-server, exportscript, of externe
  tool) zonder dat er iets in de huidige UI van afhangt.

---

## Update: FSRS + consolidatie van de twee SR-systemen

De twee parallelle spaced-repetition-systemen (`DailyView.js` met `sr_data`,
`ReviewPanel.js` met `review_data`) zijn samengevoegd tot één systeem, en het
onderliggende algoritme is vervangen door **FSRS-4.5** (in plaats van de twee
bijna-identieke SM-2-implementaties).

### Nieuw bestand

| Bestand | Wat |
|---|---|
| `SRS.js` | Nieuwe, gedeelde module — de FSRS-4.5-engine + opslag + eenmalige migratie. Moet naar `modules/SRS.js`. |

### Gewijzigde bestanden (deze ronde)

| Bestand | Wijziging |
|---|---|
| `index.html` | 1 regel: `<script src="modules/SRS.js">` toegevoegd, vóór `DailyView.js` |
| `DailyView.js` | Eigen `SM2`-object vervangen door `const SM2 = SRS;` (alias — geen enkele aanroep elders in het bestand hoeft aangepast). Review-knoppen gebruiken nu cijfers 1-4 (was 1,2,4,5) en `SM2.previewLabel(...)` i.p.v. `SM2.intervalLabel(SM2.next(...).interval)`. `d.repetitions` → `d.reps`. |
| `ReviewPanel.js` | Eigen `sm2Next`/`review_data`-opslag volledig verwijderd, gebruikt nu `SRS.load()`/`SRS.save()`/`SRS.next()` op `sr_data`. Review-knoppen: cijfers 1-4 i.p.v. 1,2,4,5. Dode code (`sm2Label`, `tomorrow()`) opgeruimd. |

**Belangrijk voor het kopiëren:** dit zijn nu de bestanden die vervangen/toegevoegd
moeten worden (bovenop de eerdere 5): `SRS.js` (nieuw), `index.html`,
`DailyView.js`, `ReviewPanel.js`.

### Hoe de migratie werkt

Bij de eerste keer laden na de update leest `SRS.load()`:
1. De bestaande `sr_data` (van `DailyView`).
2. De bestaande `review_data` (van `ReviewPanel`) — elke notitie die daar
   gemarkeerd stond maar nog niet in `sr_data` voorkomt, wordt overgenomen.
3. Alle kaarten (oud-SM-2-vormig) worden omgezet naar het FSRS-schema, met
   behoud van de bestaande `due`-datum — er wordt dus geen enkele review
   vervroegd of verlaat door de omzetting. `stability` wordt geschat uit het
   oude `interval`, `difficulty` uit de oude `ease`-factor.
4. Het resultaat wordt teruggeschreven naar `sr_data`. `review_data` blijft
   ongebruikt in `config.json` staan (onschadelijk, niet meer gelezen) —
   kun je desgewenst later handmatig opschonen.

Dit gebeurt automatisch, zowel bij het openen van de "Vandaag"-tab als de
"Review"-tab — welke van de twee de gebruiker het eerst opent, migreert.

### sr_data-schema: wat blijft, wat verandert

| Veld | Status |
|---|---|
| `due`, `lastReview`, `lastRating` | **Blijft** (zelfde naam, zelfde formaat) — hier leunt `SM2.dueToday()`/de "Reviews vandaag"-kaart op, dus die code hoefde niet aangepast |
| `interval`, `ease`, `repetitions` | **Vervangen** door `stability`, `difficulty`, `reps` (FSRS-model) |
| `algo` | **Nieuw** — `"fsrs-4.5"`, migratiemarkering |
| `lapses` | **Nieuw** — aantal keer "vergeten" |

### Cijferschaal veranderd: 1-5 (met gat bij 3) → 1-4

De oude UI's gebruikten cijfers 1, 2, 4, 5 (skipten 3). FSRS werkt met een
standaard 4-punts schaal: 1=Vergeten, 2=Moeite, 3=Goed, 4=Makkelijk. Beide
review-schermen (in `DailyView.js` en `ReviewPanel.js`) zijn aangepast naar
deze schaal — puur een labelverandering aan de knoppen, de gebruiker ziet
verder hetzelfde "😕 😐 🙂 😄"-rijtje.

### Getest

- FSRS-kernformules (retrievability, stability-update bij succes/falen,
  difficulty-update) geverifieerd tegen de publieke FSRS-4.5-specificatie
  en default-parameters.
- Groeipatroon van intervallen bij herhaald "Goed" beoordelen: `3, 13, 42,
  122, 322, 792` dagen — dezelfde exponentiële groei als het gepubliceerde
  referentievoorbeeld (`0, 4, 14, 44, 125, 328`); klein verschil is
  verwacht doordat dat voorbeeld illustratief is, niet een exacte testvector
  (de bron zelf vermeldt dat er geen officiële testvectoren voor FSRS bestaan).
- Falen (grade 1) laat stabiliteit nooit toenemen — geverifieerd.
- Migratie van een oude kaart behoudt de `due`-datum — geverifieerd.
- End-to-end: een kaart uit `sr_data` én een kaart uit `review_data`
  tegelijk aanwezig → na `SRS.load()` staan beide, correct gemigreerd, in
  één samengevoegde `sr_data` — geverifieerd.
- Alle vier bestanden: `node --check` geslaagd.


---

## Update: Tag-suggesties bij inbox-promotie (2.2b) + Hybride zoeken (4b)

### Tag-suggesties bij inbox-promotie (2.2b)

**Gewijzigd:** alleen `DailyView.js` (`InboxProcessor`-component).

Bij het promoveren van een inbox-item (→ ZK-knop) toont het TAGS-veld nu tot
6 aanklikbare tag-suggesties, direct onder de bestaande uitleg-tekst. Klikken
voegt de tag toe aan het tags-invoerveld — geen typen nodig voor tags die al
in de vault bestaan.

Geen nieuwe server-call: de suggesties worden client-side berekend uit de
notities die de "Vandaag"-tab toch al geladen heeft (`notes`-prop, nu ook
doorgegeven aan `InboxProcessor`). Score = woordoverlap tussen de titel van
bestaande notities en de tekst van het item, plus een bonus als de tag
letterlijk in de tekst voorkomt — dezelfde soort instant-scoring die
`SmartLinkSuggester.js` al gebruikt voor linksuggesties, nu toegepast op tags.

Getest met een voorbeeldscenario (item over "governance"/"EA Board"/"SAFe" →
suggereert correct `governance`, `EA`, `safe`; een ongerelateerde tag als
`recept` wordt niet gesuggereerd).

### Hybride zoeken: BM25 + embeddings via RRF (4b)

**Gewijzigd:** alleen `server.py` (`/api/semantic/search`-route). Geen
front-end wijziging — `SemanticSearch.js` blijft ongewijzigd werken.

Toegevoegd aan de `ZKHandler`-klasse:
- `_bm25_scores(query, docs_by_id)` — standaard Okapi BM25 (k1=1.5, b=0.75),
  geen externe dependencies.
- `_rrf_fuse(rankings, k=60)` — Reciprocal Rank Fusion: combineert de
  cosine-ranking (embeddings) en de BM25-ranking (trefwoorden) op **rang**
  i.p.v. op ruwe score, omdat de twee signalen op totaal verschillende
  schalen leven (cosine ~0–1, BM25 ongebonden) en los optellen dus het ene
  signaal het andere zou laten overstemmen.

`/api/semantic/search` combineert nu beide signalen. Belangrijk voor
compatibiliteit: het `score`-veld dat wordt teruggestuurd blijft primair de
cosine-similarity (zoals voorheen) — `SemanticSearch.js` filtert namelijk al
op `score > 0.3` en toont `score` direct als percentage. Een notitie die
alleen via BM25 gevonden wordt (bv. een exact ADR-nummer of productcode dat
embeddings niet als "semantisch gelijk" herkennen) krijgt een vloerwaarde
zodat hij niet alsnog wordt weggefilterd. Bonus: als Ollama niet bereikbaar
is of het embeddingmodel ontbreekt, valt zoeken nu terug op BM25-only in
plaats van helemaal te falen.

**Getest:**
- BM25 vindt correct alleen de notities die de exacte term bevatten.
- Realistisch scenario: een notitie met een exact ADR-nummer die *volledig
  afwezig* is in de cosine-ranking (embeddings misten hem compleet) staat na
  RRF-fusie wél tussen de top-resultaten.
- Score-compatibiliteit: een pure embedding-hit behoudt exact zijn oude
  cosine-score; een BM25-teruggehaalde hit krijgt een score die de
  bestaande 0.3-drempel in `SemanticSearch.js` haalt.
- `py_compile` geslaagd.

### Wat te kopiëren

| Bestand | Reden |
|---|---|
| `DailyView.js` | Tag-suggesties bij inbox-promotie |
| `server.py` | Hybride zoeken (bovenop de eerdere typed-links-wijzigingen) |

Geen andere bestanden nodig voor deze twee punten.

---

## Update: num_ctx-fix (4e)

**Gewijzigd:** alleen `server.py`.

Ollama's eigen default voor `num_ctx` (het context-window) is 2048 tokens —
ook voor modellen die veel meer aankunnen. Geen van de Ollama-aanroepen in
`server.py` zette dit expliciet, dus grote prompts (bv. LLMNotebook met
meerdere notities als context, of `nomic-embed-text`-embeddings van lange
notitie-chunks) werden stil afgekapt zonder foutmelding — precies het risico
uit het oorspronkelijke voorstel.

**Fix:** een centrale `_num_ctx()`-helper (default 8192, overschrijfbaar via
de `OLLAMA_NUM_CTX`-omgevingsvariabele) die op vier plekken wordt toegepast:

1. `_ollama_post()` — de centrale functie die de meeste `/api/generate`- en
   `/api/embeddings`-aanroepen afhandelt: injecteert `num_ctx` automatisch,
   maar **overschrijft nooit** een `num_ctx` die de aanroeper zelf al meegaf.
   `/api/tags`-aanroepen (geen prompt, geen context) worden overgeslagen.
2. `_stream_ollama()` — de streaming chat-functie (had helemaal geen
   `options`-dict) — dit is vermoedelijk het pad dat LLMNotebook's
   chatgesprekken gebruikt.
3-4. Twee losse, directe `/api/chat`-aanroepen (tekstverbetering en
   linksuggesties) die niet via `_ollama_post` liepen — `num_ctx` toegevoegd
   naast hun bestaande `temperature`/`num_predict`.

**Getest:** een aanroep zonder eigen `options` krijgt `num_ctx:8192`; een
aanroep die zelf al `num_ctx` meegeeft wordt niet overschreven; `/api/tags`
blijft ongemoeid; de `OLLAMA_NUM_CTX`-env-var werkt.

**Losstaande observatie (niet gefixt, buiten scope van deze vraag):** de
tekstverbeteringsfunctie (rond de eerste `/api/chat`-aanroep) gebruikt een
hardgecodeerde `http://localhost:11434` in plaats van `self._ollama()` — als
je `OLLAMA_URL` instelt op iets anders dan localhost, werkt die ene functie
niet mee. Zeg het als je wilt dat ik dat ook gelijktrek.

### Wat te kopiëren

Alleen `server.py` (bovenop de eerdere wijzigingen).

---

## Update: audit — gevonden en gefixte bugs

Op verzoek de complete deze-sessie-code doorgelopen op onvolledige/niet-
werkende stukken. Drie echte bugs gevonden en gefixt, allemaal klein maar
elk met een reëel effect als ze onopgemerkt waren gebleven:

| # | Bestand | Bug | Fix |
|---|---|---|---|
| 1 | `server.py` | Bij een volledig lege hybride zoekopdracht (geen embeddings, geen BM25-treffers) werd `ok:true` teruggegeven mét een `hint`-veld — maar `SemanticSearch.js` toont `hint` alleen als `ok:false`. De hint ("installeer nomic-embed-text") verscheen dus **nooit**, precies in het scenario waar hij het hardst nodig is. | Alleen `ok:false` + hint teruggeven als de embedding écht faalde én BM25 niets vond; een legitiem lege zoekopdracht (embeddings werken, gewoon geen match) blijft `ok:true` met een lege lijst. |
| 2 | `LinksSidebar.js` | Een getypeerde link naar een PDF of afbeelding (`[[pdf:naam\|bron-van]]`) werd niet herkend als pdf/img — de check was een letterlijke substring-vergelijking (`.includes("[[pdf:naam]]")`) die breekt zodra er een `\|type`-suffix bijkomt. Zo'n link kreeg het verkeerde icoon en de melding "Notitie niet gevonden". | Vervangen door een regex die het optionele `\|type`-suffix expliciet toestaat. |
| 3 | `SRS.js` | Twee kleine robuustheidsgaten: (a) een gemigreerde kaart zonder `due`-datum (corrupte/handmatig bewerkte `config.json`) zou stil uit de review-wachtrij verdwijnen; (b) een kaart met wél `stability` maar geen `difficulty` liet `NaN` doorsijpelen in de FSRS-berekening. | (a) valt terug op vandaag als `due` ontbreekt; (b) valt terug op een neutrale difficulty (grade 3) als die ontbreekt. |

**Verder gecontroleerd, geen problemen gevonden:**
- Geen dubbele methode- of functiedefinities in `server.py`/`ZKHandler`
  geïntroduceerd door mijn wijzigingen (de al bestaande dubbele
  `_tfidf_vectors`/`_cosine` in `VaultManager` vs. `ZKHandler` was al zo in
  het origineel — geen actie ondernomen, niet gevraagd).
- Script-laadvolgorde in `index.html` klopt: `app.js` (met `LINK_TYPES`,
  `extractLinks`, `extractTypedLinks`, globale `W`) laadt vóór alle modules
  die daarvan afhankelijk zijn (`Graph.js`, `SmartLinkSuggester.js`,
  `LinksSidebar.js`, `SRS.js` vóór `DailyView.js`).
- Alle `renderActions`/click-handlers in `SmartLinkSuggester.js` gebruiken
  correct `stopPropagation()` — geen dubbele link-invoeging bij klikken op
  de type-kiezer.
- `typedLinkMap`-resolutie in `Graph.js` overleeft de orphan-filter-stap
  (dezelfde object-referenties, geen data-verlies).
- FSRS-migratie slaat een kaart die al `algo:"fsrs-4.5"` heeft correct over
  (geen onnodige herschrijving of oneindige migratie-loop).
- Alle bestanden opnieuw gecompileerd/gesyntax-checkt na de fixes:
  `server.py` (`py_compile`), `SRS.js`, `LinksSidebar.js`, `DailyView.js`,
  `ReviewPanel.js`, `Graph.js`, `SmartLinkSuggester.js`, `app.js`
  (`node --check`) — allemaal geslaagd, plus gerichte functionele tests per
  fix.

### Wat te kopiëren

`server.py`, `LinksSidebar.js`, `SRS.js` (bovenop wat er al lag).

---

## Update: QuickEntryBar-knoppen visueel gelijkgetrokken

**Gewijzigd:** alleen `DailyView.js` (`QuickEntryBar`).

De drie type-knoppen (·/☐/💡) hadden alleen een rand/achtergrond als ze
actief waren; de twee inactieve knoppen hadden `border:"transparent"` en
`background:"none"` — daardoor oogden ze als kale tekens zonder knopvorm,
terwijl de actieve knop wél een duidelijk blauw kader had.

Gelijkgetrokken met het bestaande knop-patroon uit `TasksPanel.js`
(`filterBtn`): elke knop heeft nu altijd een zichtbare rand en subtiele
achtergrond — neutraal grijs als inactief, blauw als actief — zodat alle
drie er als knoppen van dezelfde familie uitzien.

### Wat te kopiëren

Alleen `DailyView.js`.

---

## Update: service-worker.js — echte oorzaak van "wijziging niet zichtbaar"

**Gewijzigd:** `service-worker.js` (nieuw bestand in deze levering — was nog
niet eerder gezien/aangepast).

### De bug

`app.js`/`modules/*.js` staan in `NETWORK_FIRST_PATHS` — de naam belooft dat
ze altijd vers van de server gehaald worden. De implementatie deed echter het
tegenovergestelde: **eerst de gecachede (oude) versie teruggeven**, en pas
op de achtergrond een verse versie ophalen voor de **volgende** keer laden.
Resultaat: elke code-wijziging werd pas zichtbaar na **twee** herladingen —
precies het gedrag dat je meldde na de knoppen-fix. Een serverherstart maakt
hier geen verschil in, want dit speelt zich volledig af in de
service-worker-cache van de browser, los van de Python-server.

### De fix

`cacheFirstWithNetwork()` voor `app.js`/`modules/*` doet nu écht
network-first: eerst het netwerk proberen (met dezelfde korte timeout van
2,5s als voorheen, dus offline blijft de app even snel), en **alleen** bij
een mislukte of trage aanvraag terugvallen op de cache. Zo zie je een
wijziging altijd al bij de eerstvolgende herlading, en blijft de app
offline-bruikbaar precies zoals bedoeld.

Ook `SW_VERSION` opgehoogd (v23 → v24) — dat staat letterlijk in de eigen
kopcommentaar van het bestand ("verhoog bij elke deploy") en zorgt dat de
nieuwe service worker zichzelf als nieuwe versie herkent, oude
cache-namespaces opruimt, en de al bestaande auto-reload-melding in
`index.html` triggert. Verder klein: een dubbele `"/modules/DailyView.js"`-
regel in `SHELL_ASSETS` opgeruimd (onschadelijk, maar overbodig).

### Wat je nu moet doen

1. Vervang `service-worker.js`.
2. Herstart de server (nodig omdat `/api/version`'s hash ook `server.py`-
   afhankelijke bestanden meeweegt, en voor de zekerheid).
3. **Voor déze ene overgang** raad ik aan om één keer handmatig te forceren
   dat de oude (v23) service worker plaatsmaakt: DevTools → Application →
   Service Workers → Unregister, dan herladen. Daarna hoeft dat niet meer —
   de bug die veroorzaakte dat wijzigingen bleven hangen is nu gefixt, dus
   toekomstige updates komen vanzelf door bij de eerstvolgende herlading.

### Wat te kopiëren

Alleen `service-worker.js`.

---

## Update: datumknop ("08-11") — native button-styling gefixt

**Gewijzigd:** alleen `DailyView.js`.

De "eerdere dag"-snelkoppelingsknop (rechtsboven in de "Vandaag"-kaart, toont
bv. "08-11") had een platte inline-stijl, maar rendert met een 3D/bevel-
effect — dat is native browser-knop-chrome die doorschemert op Safari/WebKit
(o.a. iPad), omdat nergens in de app `-webkit-appearance: none` gezet wordt
op knoppen. Dit is niet uniek voor deze knop — het treft potentieel elke
knop in de app op WebKit — maar hier het meest zichtbaar door de kleine,
geïsoleerde vorm.

**Fix:** `WebkitAppearance:"none"`, `appearance:"none"`, `outline:"none"`,
`boxShadow:"none"` en `fontFamily:"inherit"` toegevoegd, plus een subtiele
achtergrond (i.p.v. volledig transparant) zodat de knop als "chip" leest,
consistent met de knoppen elders in de app (QuickEntryBar, TasksPanel).

**Let op:** als er bij jou nog méér knoppen met dit bevel-effect opduiken
(vooral op iPad/Safari), is de kans groot dat het dezelfde oorzaak heeft.
Zeg het dan even — dan zet ik `WebkitAppearance:"none"` in één keer breder
door in plaats van steeds los per knop.

### Wat te kopiëren

Alleen `DailyView.js`.

---

## Update: contrast datumknop verbeterd

**Gewijzigd:** alleen `DailyView.js` (zelfde knop als de vorige fix).

Na de WebkitAppearance-fix (bevel weg) bleek de tekstkleur te laag contrast:
`W.fgDim` is in bijna alle thema's van deze app juist de **donkerste/minst
leesbare** variant (donkerder dan `fgMuted`, ondanks de naam die het
tegenovergestelde doet vermoeden — bv. in het standaardthema is
`fgDim:"#777777"` vs `fgMuted:"#999999"`).

**Fix:** tekstkleur naar `W.fgMuted` (merkbaar hoger contrast), achtergrond
iets steviger (`rgba(255,255,255,0.06)` i.p.v. `0.03`), plus `fontWeight:600`
voor extra leesbaarheid op de kleine 10px-tekst.

### Wat te kopiëren

Alleen `DailyView.js`.

---

## Update: datumknop — fontWeight teruggedraaid (te zwart/fel)

**Gewijzigd:** alleen `DailyView.js` (zelfde knop, derde iteratie).

Na de contrastfix (kleur → `fgMuted`) voelde de tekst in beide thema's te
zwart/fel aan. Oorzaak: `fontWeight:"600"` (vetgedrukt) op 10px-tekst oogt
al snel "zwaar", ongeacht de kleur zelf. Teruggezet naar `fontWeight:"400"`
(normaal), kleur blijft `W.fgMuted` — dat was zelf niet het probleem.

### Wat te kopiëren

Alleen `DailyView.js`.

---

## Update: UX-onderzoek doorgevoerd — voorstellen 1, 3, 4, 5

Vervolg op `ux-onderzoek-workflow.md`. Voorstel 2 (secure-context-risico bij
iPad-via-wifi) is bewust **niet** aangepakt — vergt eerst verificatie van hoe
je iPad daadwerkelijk verbindt.

### Voorstel 1 — Highlight-kleur → laag-markup bij export
**`PDFViewer.js`.** Nieuwe helper `layerWrap(text, colorId)`: wrapt tekst in
`[tekst]{.bron}` / `{.kritisch}` / `{.eigen}` op basis van de highlight-kleur
(`HCOLORS[...].layer`, al aanwezig in `app.js`), zowel bij de per-highlight
"+ notitie"-knop als bij "⬆ Alle highlights als notitie". Zo verschijnen
notities die uit een gekleurde highlight ontstaan nu ook in
`AnnotationsPanel.js` — dat gebeurde voorheen nooit, ook al was de laag-
informatie op het moment van highlighten al bekend.

**Bijvangst (bug, niet door mij veroorzaakt maar wel geraakt):** `onSaveNote`
werd in `PDFViewer.js` op drie plekken gebruikt maar stond niet in de
props-destructuring van de component — dit zou een `ReferenceError` hebben
gegeven zodra iemand op "+ notitie" klikte. Gefixt door `onSaveNote=null`
toe te voegen aan de destructuring, en `app.js` geeft 'm nu ook daadwerkelijk
door (voorheen ontbrak de prop ook aan de aanroep-kant).

### Voorstel 3 — "Lees dit boek" → springt naar het PDF in de PDF-hub
**`BookLibrary.js`, `PDFViewer.js`, `app.js`.**
- `app.js`: nieuwe helper `findPdfForBook(book, serverPdfs)` — matcht op
  woordoverlap tussen boektitel en PDF-bestandsnaam (diakrieten genormaliseerd,
  woorden ≤2 tekens genegeerd), vereist ≥60% overlap om een valse-positieve
  match te voorkomen. Er is geen apart koppelveld in het boek-schema, dus dit
  is bewust best-effort — zie de open vraag in `ux-onderzoek-workflow.md`.
- `BookLibrary.js`: een "📖 Lees"-knop op elke boekkaart (alleen bij
  `type==="ebook"` — fysieke boeken hebben geen PDF), in alle drie
  weergaven (grid/lijst/detail-tabel).
- `PDFViewer.js`: nieuwe props `openPdfName`/`onOpenPdfConsumed` + een
  `useEffect` die bij een inkomend verzoek het PDF opent via de bestaande
  `openFromServer()`-functie (dezelfde weg als een gewone klik in de
  PDF-lijst) en zichzelf daarna laat "consumeren" door de ouder.

**Getest:** de matching-functie met drie scenario's (goede match op exacte
titel, goede match op titel-met-spelling-in-bestandsnaam, geen match bij een
niet-gerelateerd boek/lege titel) — alle drie correct.

### Voorstel 4 — Verwante notities tijdens het lezen
**`PDFViewer.js`, `app.js`.** Nieuw paneel (🔗-knop in de PDF-toolbar,
zelfde plek/stijl als het bestaande Highlights-paneel): hergebruikt
`/api/suggest-links` — dezelfde TF-IDF/tag-scoring die `SmartLinkSuggester`
ook gebruikt tijdens het schrijven — nu toegepast op de laatst
geselecteerde/gehighlighte tekst in het PDF (debounced, 500ms, minimaal 12
tekens). Een klik op een suggestie opent die notitie (respecteert
split-view, net als de andere tabs). Dit brengt "onderzoeken in de
kennisdatabase" ook naar het leesmoment, niet alleen naar het schrijfmoment.

### Voorstel 5 — Expliciete Vim/Outline-keuze op touch
**`NoteEditor.js`.** `OutlineEditor` (gewone textarea, geen modale
toetsenbord-commando's) is nu de **default** op touch-apparaten i.p.v.
impliciet VimEditor. Belangrijkere bijvangst: de toggle-knop tussen beide was
volledig verborgen zodra `isMobile` (`winW<768`, puur breedte-gebaseerd) waar
was — in iPad-splitview of op kleinere iPads dus zonder zichtbare uitweg uit
modale Vim. De knop is nu altijd zichtbaar op touch-apparaten, met een
duidelijker label (⌨ Vim / ☰ Outline) en tooltip die uitlegt wat wisselen
betekent.

### Getest
- Alle vier bestanden: `node --check` geslaagd.
- Kruiscontrole: elke nieuwe prop die een component verwacht wordt ook
  daadwerkelijk door `app.js` doorgegeven (geen stille no-ops).
- `layerWrap` en `findPdfForBook`: losse functionele tests, zie boven.

### Wat te kopiëren

`PDFViewer.js`, `BookLibrary.js`, `NoteEditor.js`, `app.js`.
