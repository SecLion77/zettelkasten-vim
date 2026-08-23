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

---

## Update: horizontaal meeschuiven in VimEditor + multi-tag filter in Notebook

### 1. "Tekst wrap" in VimEditor (Spil-mode + gewone mode)

**Belangrijk — lees dit voor je verwacht dat regels nu breken:** ik heb géén
echte regel-wrap gebouwd. `VimEditor.js` is een canvas-getekende editor waar
cursor, klik-positie, scroll en folding allemaal uitgaan van "1 regel = 1
zichtbare rij" — dat overal ombouwen naar "1 regel kan over meerdere rijen
lopen" is een grote, riskante operatie in een dicht 2700-regels bestand dat
ik niet interactief kan testen (alleen syntax, geen visuele/cursor-controle).

In plaats daarvan: **horizontaal automatisch meeschuiven**. Zodra de cursor
voorbij de rechterrand zou lopen, schuift de hele weergave mee zodat de
cursor zichtbaar blijft — in zowel gewone als split-mode, want het zit op
het niveau van de editor zelf. Dit lost het gemelde probleem ("tekst loopt
uit het zichtbare veld") op zonder de cursor/klik/scroll-logica overal aan
te raken.

**Wat er is gewijzigd (`VimEditor.js`):**
- Nieuwe state `scrollX`/`canvasW` op de editor.
- `scrollToCursor()` schuift nu ook horizontaal mee (zelfde functie die al
  overal aangeroepen wordt voor verticaal scrollen — geen nieuwe aanroepen
  nodig door de rest van het bestand).
- Klik/tap-naar-cursor-positie houdt rekening met de huidige horizontale
  scroll.
- Alle tekentekens die een x-positie op basis van kolom berekenen (tekst,
  cursor, visuele selectie, zoek-highlights, spelling/grammatica-onderstreping,
  fold-labels, autocomplete-popup-positie) zijn verschoven met `-scrollX`,
  met een canvas-clip zodat niets over de regelnummer-kolom heen tekent.

**Getest:** een gesimuleerde lange-regel-typesessie (kolom 0→200) laat zien
dat de cursor zichtbaar blijft; teruggaan naar kolom 0 herstelt `scrollX`
naar 0; een korte regel veroorzaakt geen onnodige scroll.

**Als je liever échte regel-wrap wilt** (regels breken visueel af i.p.v.
horizontaal scrollen): dat kan, maar is een apart, groter traject — zeg het
als je daar alsnog voor wilt gaan.

### 2. Multi-tag filter (LLMNotebook)

**3 bestanden, kernstuk zat in een gedeeld component:**

- **`TagFilterBar.js`** (gedeeld door `Graph.js`, `PDFViewer.js` én
  `LLMNotebook`) had al **halfafgemaakte** multi-select-ondersteuning: de
  header-badge verwerkte al `activeTag instanceof Set`, maar de tag-chips
  zelf werkten nog steeds enkelvoudig (klikken verving het filter i.p.v. toe
  te voegen), en er zat een echte bug in (`isActive` riep zichzelf oneindig
  aan — ongebruikt, dus onschadelijk, maar wel stuk). Afgemaakt:
  `toggleTag()`/`clearFilter()`/`isActive()`/`hasFilter()` werken nu correct
  voor **beide** vormen — een gewone string (bestaand gedrag, ongewijzigd
  voor `Graph.js` en `PDFViewer.js`) of een `Set` (nieuw, multi-select).
  Geen enkele aanroeper hoeft aangepast te worden tenzij die multi-select wil.
- **`MermaidEditor.js`** (bevat `LLMNotebook`, zie hieronder): `tagFilter`
  is nu een `Set` i.p.v. een string; de filterlogica gebruikt OR-semantiek
  (een notitie matcht als hij minstens één geselecteerde tag heeft); alle
  weergaveplekken (badges, tellers, statusregel) zijn bijgewerkt.

**Waar dit bestand daadwerkelijk staat:** er is geen apart `LLMNotebook.js`
— het zit samen met `MindMap` en `FuzzySearch` in `MermaidEditor.js` (zie de
comment erboven in `index.html`: "Mermaid, MindMap, LLMNotebook,
FuzzySearch"). Toeval dat dit meteen nuttig was: `MindMap`, verderop in
hetzelfde bestand, had *al* een volledig werkend multi-select tagfilter
(`tagFilters`, meervoud) — mijn aanpak voor `LLMNotebook` volgt exact
hetzelfde patroon, dus het bestand is nu qua tag-filtering intern consistent.

**Getest:**
- Regressie: enkelvoudig gedrag (`Graph.js`/`PDFViewer.js`-stijl) exact
  hetzelfde vóór en na de wijziging.
- Multi-select: tags toevoegen/verwijderen/wissen behoudt het juiste type.
- `hasFilter` op een lege Set geeft nu correct `false` (was een latente bug:
  een lege Set is als object altijd "truthy" in JS).
- End-to-end filterlogica in `LLMNotebook`: leeg filter toont alles, één tag
  filtert correct, twee tags samen breidt uit (OR), niet-bestaande tag geeft
  niets terug.
- Alle drie bestanden: `node --check` geslaagd.

### Wat te kopiëren

`VimEditor.js`, `TagFilterBar.js`, `MermaidEditor.js`.

---

## Update: dode opschoon-functies in Graph.js aangesloten

**Gewijzigd:** alleen `Graph.js`.

Vier complete, werkende functies (`cleanupBrokenLinks`, `cleanupEmptyNotes`,
`deleteOrphans`, `cleanupCssGarbage`) hadden geen enkele knop die ze
aanriep, en hun statusberichten (`cleanupMsg`/`emptyMsg`/`orphanMsg`/
`cssCleanMsg`) werden nergens gerenderd — puur dode UI-koppeling, de
functies zelf waren altijd al correct.

Nieuwe sectie **"OPSCHONEN"** onderaan het Graaf-zijpaneel, na de bestaande
tip-regel: vier knoppen, elk met hun statusbericht direct ernaast
(groen bij succes, geel bij een bevestigingsvraag, rood bij een fout):

| Knop | Doet |
|---|---|
| gebroken links | Verwijdert `[[links]]` die naar niet-bestaande notities wijzen |
| lege notities | Verwijdert notities zonder titel én zonder inhoud — **klik 2×** (eerste klik toont aantal, tweede bevestigt) |
| wees-notities | Verwijdert notities zonder enige inkomende/uitgaande link — **klik 2×** |
| vault-opschoning | Server-side opschoning via het al bestaande `/api/cleanup-vault` |

**Getest:** de drie client-side detectie-algoritmes (gebroken links, lege
notities, wees-notities) met een klein voorbeeldscenario — alle drie vonden
precies de juiste notities. `/api/cleanup-vault` bestond al server-side,
niet gewijzigd.

**Let op — dit zijn destructieve acties** (verwijderen van links/notities).
De twee-staps-bevestiging (klik 2× voor "lege notities" en "wees-notities")
bestond al in de functies zelf; ik heb daar niets aan veranderd, alleen de
ontbrekende UI eromheen gebouwd.

### Wat te kopiëren

Alleen `Graph.js`.

---

## Update: vraagteken-conflict opgelost (help-popup vs. letterlijk typen)

**Gewijzigd:** alleen `VimEditor.js`.

Een losse, mode-onafhankelijke `?`-afvanger op wrapper-niveau (bedoeld om de
help-popup ook te tonen vóórdat je in de editor geklikt hebt) onderschepte
élke `?`-toetsaanslag, ook tijdens actief typen in INSERT-mode — een
letterlijk vraagteken in je tekst typen was daardoor onmogelijk.

**Fix:** de afvanger checkt nu of de daadwerkelijk-actieve mode (niet
INSERT) dat rechtvaardigt. Belangrijk detail: gecontroleerd via
`S.current.mode` (de ref die elke toetsaanslag echt routeert) i.p.v. de
React-weergavestate `mode` — die twee lopen namelijk niet synchroon vóór de
eerste interactie (de ref start correct op `"NORMAL"`, de React-state start
op `"INSERT"`). Bij de React-state was de "werkt ook zonder focus"-belofte
uit de originele code per ongeluk gebroken; met `S.current.mode` klopt het
in alle vier geteste scenario's: direct na laden, actief in NORMAL-mode,
tijdens typen in INSERT-mode, en in COMMAND-mode.

### Wat te kopiëren

Alleen `VimEditor.js`.

---

## Update: PDF-toolbar herontworpen

**Gewijzigd:** alleen `PDFViewer.js`.

Volledige herstructurering van de PDF-toolbar (was 25+ ongegroepeerde
emoji-knoppen in één platte rij — zie het eerdere onderzoek).

### Wat er veranderd is

1. **Eigen SVG-iconenset i.p.v. emoji.** 22 losse, ingebouwde SVG-paths
   (`PDF_ICON_PATHS` + een `PdfIcon`-component), stroke-based,
   `currentColor` — schalen en kleuren automatisch mee met de knop.
   **Bewust geen CDN-icon-font** (bv. Tabler): dat zou een
   internetafhankelijkheid toevoegen aan een app die volledig lokaal moet
   blijven werken.
2. **Groepering met scheidingslijnen** (`PdfToolbarDivider`): navigatie →
   zoom+zoeken → selectiemodus (tablet) → markeren+kleuren → panelen →
   overig → bestand+acties. Was: alles achter elkaar, geen enkele
   groepsindeling.
3. **Markeer-modus als één samenhangende segmented control** met
   tekstlabels op desktop (icoon-only op tablet, ruimtegebrek) — i.p.v. drie
   losse, bijna-identieke potlood-emoji zonder zichtbaar verband.
4. **Responsief, niet identiek op laptop/iPad**: op `isTablet` (dezelfde
   breedte-based prop die al overal in de app gebruikt wordt) verhuizen
   fit-breedte, paginalayout, roteren, gelezen-toggle, terug-naar-begin en
   verwijderen naar een "meer"-menu (`⋯`) met tekstregels i.p.v. kleine
   iconen — en worden de overgebleven knoppen groter (7-9px padding i.p.v.
   2-4px, dichter bij het aanbevolen 40px-tikdoel).
5. **Eén "gelezen"-indicator i.p.v. twee.** Er stonden origineel twee losse
   UI-elementen die beide "gelezen" konden tonen (een read-only banner én
   een interactieve toggle-knop) — kon dus dubbel verschijnen. De
   read-only banner is verwijderd; de interactieve toggle (nu met
   duidelijk label in het "meer"-menu op tablet, of als icoon-knop op
   desktop) is de enige.

### Getest

- Icon-systeem geïsoleerd getest (alle 22 paths aanwezig en niet leeg, alle
  in de toolbar gebruikte iconnamen — inclusief dynamisch bepaalde, zoals
  de layout- en gelezen-status-iconen — bestaan daadwerkelijk).
- Opbouw van de "meer"-menu-items getest voor meerdere scenario's (met/
  zonder `onTogglePdfRead`, wel/niet gelezen, wel/niet op pagina 1) — filtert
  en labelt correct.
- Alle bestaande event-handlers en state-variabelen zijn 1-op-1 hergebruikt
  (niet herschreven) — alleen de visuele indeling/groepering is nieuw.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `PDFViewer.js`.

---

## Update: tekstselectie over meerdere regels gefixt

**Gewijzigd:** alleen `PDFViewer.js`.

### De oorzaak

`renderNearby` (lazy-laden van pagina's rond de huidige positie) verwijdert
actief pagina's uit de cache die buiten het "rendervenster" vallen, en
herbouwt ze bij hernieuwde vraag vanaf nul — nieuwe canvas, nieuwe
tekstlaag-DOM-elementen. Deze functie wordt 200ms na elke wijziging van
`pageNum` aangeroepen, en `pageNum` wordt op zijn beurt bijgewerkt door een
`IntersectionObserver` zodra je scrolt — óók het kleine beetje scrollen dat
vanzelf gebeurt tijdens het slepen van een selectie over meerdere regels.

Gebeurt die her-render **terwijl de muisknop nog ingedrukt is**, dan worden
de tekst-DOM-elementen waar de browser's actieve selectie op "vastzit"
vervangen — en breekt de selectie meteen af. Één woord of regel selecteren
gaat snel genoeg om dit venster te missen; meerdere regels selecteren duurt
langer en vergroot de kans dat dit ertussen gebeurt.

### De fix

Er bleek al een `isSelectingRef` te bestaan (eerdere fix voor "selectie over
paginagrenzen heen") die exact bijhoudt of de muisknop ingedrukt is tijdens
het slepen. Die hergebruikt — geen dubbele state nodig:
- `renderNearby` controleert nu `isSelectingRef.current` bij binnenkomst én
  halverwege de render-lus, en doet dan **niets** (geen cache-opschoning,
  geen herbouw) zolang er een actieve sleep-selectie loopt.
- Zodra de muisknop loslaat (bestaande `mouseup`-handler), wordt
  `renderNearby` alsnog één keer aangeroepen — zodat de cache-opschoning
  niet permanent wordt overgeslagen, alleen uitgesteld tot na de selectie.
- Voor dat laatste zijn vier nieuwe refs toegevoegd (`pdfDocRef`, `scaleRef`,
  `rotationRef` — naast de al bestaande `pageNumRef`) zodat de aanroep
  altijd de actuele waarden gebruikt zonder de bestaande `useEffect`
  (met lege dependency-array) te hoeven herstructureren.

### Getest

- Kernlogica van de guard los getest: tijdens een gesimuleerde actieve
  selectie blijft de cache exact ongewijzigd; direct na het "loslaten"
  wordt de opschoning alsnog correct uitgevoerd.
- `node --check` geslaagd.

**Kanttekening:** dit lost de meest waarschijnlijke oorzaak op die uit de
code naar voren kwam. Ik kon dit niet interactief in een browser testen —
laat het weten of het merkbaar beter aanvoelt, of dat er nog steeds haperingen
zijn bij langere selecties.

### Wat te kopiëren

Alleen `PDFViewer.js`.

---

## Update: grillige/onderbroken highlights gefixt

**Gewijzigd:** alleen `PDFViewer.js`.

### De oorzaak

Elke highlight bestaat uit een lijst `rects` (rechthoeken), rechtstreeks
afkomstig van `range.getClientRects()`. Die geeft vaak **meerdere kleine
deel-rechthoeken per zichtbare regel** terug (één per tekstlaag-span-grens),
met soms een paar pixels tussenruimte — met name bij PDF's met
lettertype-substitutie-problemen (zoals de `invalid font name`-waarschuwingen
die we eerder al zagen bij dit specifieke bestand). Elk deel-rechthoekje werd
apart getekend, dus een selectie over meerdere regels werd zichtbaar als een
grillig, onderbroken blok in plaats van nette doorlopende regel-balken.

**Bijgevangen, gerelateerde bug:** de snelle "alleen markeren"-opslag bij
muisselectie sloeg de kleur op onder de verkeerde veldnaam (`color` i.p.v.
`colorId`) — de weergavecode leest `colorId`, dus zo'n highlight verscheen
altijd geel, ongeacht de daadwerkelijk gekozen kleur. (De vergelijkbare
pencil/touch-snelopslag deed dit al wel goed.)

### De fix

Nieuwe gedeelde functie `mergeRectsByLine()`: groepeert rechthoekjes die
verticaal overlappen (dezelfde regel) tot één doorlopende balk per regel —
precies zoals gangbare PDF-lezers (Adobe, Preview) highlights tekenen. Met
een ingebouwde veiligheidsklep: als er binnen zo'n "regel" een grote
horizontale sprong zit (groter dan 3× de regelhoogte), wordt dat gezien als
een echte kolomgrens en **niet** samengevoegd — belangrijk bij dit soort
twee-koloms-documenten.

Toegepast op alle drie de plekken waar rects definitief worden voordat ze
opgeslagen worden (muis-selectie snelopslag, pencil/touch-sleeprechthoek
snelopslag, en de gedeelde `saveHighlight()` voor de popup-flow), plus de
`color`→`colorId`-veldnaam gefixt.

### Getest

- Gefragmenteerde regel (kleine tussenruimtes) → correct samengevoegd tot
  één doorlopende balk.
- Twee kolommen op dezelfde hoogte (grote horizontale sprong) → correct
  **niet** samengevoegd, blijven twee aparte balken.
- `node --check` geslaagd.

**Kanttekening:** ook dit kon ik niet interactief in een browser
verifiëren — de kernlogica is los getest en gedraagt zich zoals bedoeld,
maar laat weten hoe het er in de praktijk uitziet.

### Wat te kopiëren

Alleen `PDFViewer.js`.

---

## Update: Notebook-state blijft behouden bij tabwissel

**Gewijzigd:** alleen `app.js`.

### De oorzaak

Tabs werden gerenderd via een lange `if(t===...) return React.createElement(...)`-
keten: zodra je van tab wisselde, veranderde de teruggegeven React-boom
volledig, waardoor React de vorige tab-component **volledig afbreekt**
(unmount) — inclusief alle interne state (chatgeschiedenis,
zoekresultaten, tag-filter, contextselectie). Terugkomen op de Notebook-tab
betekende dus altijd bij nul beginnen.

### De fix

Precies hetzelfde patroon toegepast dat al bestond voor de Notities-tab
(`NotesTab` — "altijd in DOM, display:none bewaart scroll + VIM-state"):
`LLMNotebook` wordt nu **één keer** aangemaakt als vaste `llmTabEl`, in een
altijd-gemonteerde wrapper-`div` die alleen met `display:none` verborgen
wordt als een andere tab actief is — in plaats van steeds opnieuw aangemaakt
en afgebroken te worden. De oude `if(t==="llm")`-branch in de tab-render-
keten is verwijderd (zat er nu dubbel in).

**De "opnieuw beginnen"-knop bestond al**: de "✕ wis chat"-knop in
`LLMNotebook` zelf (zichtbaar zodra er berichten zijn) reset het gesprek —
die wordt nu juist nuttiger, want zonder expliciete klik daarop blijft
alles nu bewaard.

### Kanttekening

Dit dekt het scenario waar je vroeg om: heen-en-weer wisselen tussen
Notebook en een andere tab in de normale weergave. Split-view met Notebook
in het rechterpaneel was al niet aan de orde (`renderTab` wordt alleen met
de hoofdtab aangeroepen, nooit als split-rechts-variant) — dat verandert
hier dus niets aan.

### Getest

- `node --check` geslaagd.
- Gecontroleerd dat `LLMNotebook` nu op precies één plek geïnstantieerd
  wordt (geen dubbele render).
- Structuur van de twee altijd-gemonteerde wrappers (notities + notebook)
  vergeleken — identiek patroon, alleen de zichtbaarheidsvoorwaarde
  verschilt.

### Wat te kopiëren

Alleen `app.js`.

---

## Update: tijdelijke diagnose-logging voor het "2e document"-probleem

**Gewijzigd:** alleen `PDFViewer.js`.

### Status van het onderzoek

Twee gemelde problemen:
1. **Highlighting nog steeds hetzelfde effect, wel beter bij 2 regels** —
   de `mergeRectsByLine`-fix van de vorige ronde helpt dus deels, maar er
   blijft kennelijk een restprobleem over (mogelijk bij >2 regels, of een
   ander scenario). Nog niet verder onderzocht — eerst het 2e-document-
   probleem oplossen, dat kan namelijk gerelateerd zijn.
2. **Markeren werkt niet meer bij het tweede geopende document** — de
   highlight-popup verschijnt dan zelfs niet meer. Console toont geen
   enkele foutmelding (alleen bekende `pdf.js`-warnings over lettertypen).

Ik heb vier hypotheses onderzocht en **verworpen** op basis van de code en
de aangeleverde `annotationStore.js`:
- state-reset bij documentwissel — nee, `AnnotationStore` is niet
  document-specifiek
- verouderde event-listener door een remount van de scroll-container — nee,
  `pdfDoc` wordt nooit `null` tussen documenten, dus die container
  wordt nooit opnieuw gemount
- een race condition in de opslag-store — nee, `annotationStore.js` is
  schoon en synchroon consistent
- een gooiende exception — nee, console toont geen enkele fout

Omdat er geen foutmelding is, moet het een **stille, vroegtijdige `return`**
zijn ergens in de selectie-keten — en dat kan ik met alleen code lezen niet
meer isoleren zonder de app het zelf te laten "vertellen".

### Wat er nu in de code staat

Tijdelijke `console.log("[DIAG] ...")`-regels op elk mogelijk stopmoment in
`tryOpenAnnotPopup` én in de `onMouseUp`-handler eromheen — **niet** achter
de bestaande `?debug`-vlag (die staat standaard uit), dus deze loggen altijd
mee tot ze weer verwijderd worden.

**Vraag:** vervang `PDFViewer.js`, herstart, open twee documenten na elkaar,
en stuur me de `[DIAG]`-regels uit de console bij de mislukte selectiepoging
op het tweede document. Daarmee kan ik precies zien welke regel de laatste
is die verschijnt (= waar het stopt) en ga ik de logging weer verwijderen
zodra we de oorzaak hebben.

### Wat te kopiëren

Alleen `PDFViewer.js` — let op: bevat tijdelijke debug-logging, nog niet
de definitieve fix.

---

## Update: split-mode Notebook (zwart scherm) gefixt

**Gewijzigd:** alleen `app.js`. Regressie van de vorige "Notebook-state
blijft behouden"-fix.

### De oorzaak

Split-mode heeft een **apart** renderpad voor het rechterpaneel
(`renderTab(splitTab, true)`), los van de hoofdweergave. Toen ik vorige keer
`LLMNotebook` naar een altijd-gemonteerde wrapper verplaatste, heb ik de
`if(t==="llm")`-branch uit `renderTab` verwijderd — die was toen alleen nog
nodig leek voor de hoofdweergave. Maar split-mode's rechterpaneel-lijst
(`SPLIT_TABS`) bevat "Notebook" gewoon als keuze, en riep nog steeds diezelfde
(nu verwijderde) branch aan — vandaar het zwarte scherm zonder foutmelding:
`renderTab("llm", true)` gaf simpelweg niets terug.

### De fix

Bij de split-rechts-render: als `splitTab==="llm"`, gebruik dan dezelfde
persistente `llmTabEl`-instantie (die toch al bestaat voor de hoofdweergave)
in plaats van 'm via `renderTab` opnieuw te laten aanmaken. Geen extra
wrapper nodig — `LLMNotebook`'s eigen root-element heeft zelf al
`flex:1, display:"flex", overflow:"hidden"`, dus die past direct in de
split-rechts-container.

**Kanttekening:** dit herstelt het split-mode-gedrag naar hoe het al die
tijd al werkte (functioneel, niet zwart) — het geeft split-mode geen
*extra* state-behoud bovenop wat er al was. Overstappen tussen normale
weergave en split-mode terwijl Notebook actief is, kan de state nog steeds
resetten (React kan een component niet "verplaatsen" naar een andere
positie in de boom zonder 'm opnieuw te monteren) — dat is een fundamentele
React-beperking, geen bug. Het originele verzoek ging over wisselen tussen
tabs in de normale weergave, en dat blijft nu gewoon werken zoals bedoeld.

### Getest

- `node --check` geslaagd.
- Alle plekken die de Notebook-tab renderen opnieuw doorzocht — twee
  plekken in totaal (hoofdweergave + split-rechts), beide nu correct
  verbonden aan dezelfde `llmTabEl`.

### Wat te kopiëren

Alleen `app.js`.

---

## Update: Notebook-inhoud blijft nu ook behouden binnen split-mode

**Gewijzigd:** alleen `app.js`. Vervolg op de vorige twee fixes.

### Wat er nog steeds mis was

De vorige fix loste alleen het **zwarte scherm** op (door `llmTabEl`
te hergebruiken in de split-rechts-positie in plaats van niets terug te
geven), maar loste niet het achterliggende probleem op: React monteert een
component af zodra de boompositie van TYPE verandert. Zodra je in
split-mode van "Notebook" naar een andere rechter-tab wisselde (bijv. om
iets op te zoeken) en weer terug, veranderde die positie steeds van type
(LLMNotebook → FuzzySearch → LLMNotebook, etc.) — en dus brak React 'm elke
keer af en weer opnieuw op, met een lege state tot gevolg. Precies het
scenario dat je beschrijft: even iets opzoeken in een andere tab, terug naar
Notebook, en de al opgebouwde reacties zijn weg.

### De fix

Dezelfde "altijd-gemonteerd, alleen `display` wisselt"-aanpak nu **ook**
toegepast binnen de split-rechts-positie zelf — niet door `llmTabEl`
(de hoofdweergave-instantie) te hergebruiken (dat kan niet: één React-
element kan niet op twee boomposities tegelijk gemonteerd blijven, dat
resulteert alsnog in twee losse mounts), maar met een **eigen, tweede**
persistente instantie `llmTabElSplit`, in zijn eigen altijd-aanwezige
wrapper-`div` binnen het rechterpaneel. Die wrapper-positie verandert nu
nooit meer van type — alleen zijn `display` (flex/none) wisselt al naar
gelang `splitTab`. De overige rechter-tabs (zoeken, taken, etc.) worden nog
gewoon conditioneel gerenderd zoals voorheen — alleen Notebook is nu
persistent, in zowel de hoofdweergave als split-rechts.

**Gevolg:** de hoofdweergave-Notebook en de split-rechts-Notebook zijn nu
twee **losse** gesprekken/instanties (elk met hun eigen state) — dat is een
bewuste, redelijke keuze: het zijn architecturaal ook echt twee
verschillende posities in de UI, en dit dekt precies het scenario dat je
beschreef (binnen split-mode heen-en-weer wisselen).

### Getest

- `node --check` geslaagd.
- Display-logica voor beide posities los gesimuleerd over een reeks
  tab-wisselingen (search→llm→search→llm binnen split-mode) — de
  wrapper-positie voor Notebook verandert nooit van type, alleen van
  zichtbaarheid, dus React heeft geen aanleiding meer om 'm af te breken.

### Wat te kopiëren

Alleen `app.js`.

---

## Update: model per taak (afbeeldingen, semantisch zoeken)

**Gewijzigd:** `VaultSettings.js`, `server.py`, `app.js`, `ImagesGallery.js`,
`SemanticSearch.js`.

### Vondst onderweg

`VaultSettings.js` had al een lege "🤖 Modellen"-tabknop zonder inhoud —
weer een halfafgemaakt stukje uit eerdere sessies. Ik heb de nieuwe
per-taak-instellingen dáár ingebouwd, samen met de al bestaande
custom-model-functionaliteit in diezelfde tab.

### Hoe het werkt

- **Instellingen → Modellen → "Model per taak"**: twee keuzelijsten
  (Afbeeldingen, Semantisch zoeken), elk standaard op "— Gebruik
  hoofdmodel —". Kiest dezelfde modellijst als de hoofd-`ModelPicker`
  (online providers + aanbevolen lokale modellen + je eigen aangepaste
  modellen).
- **Val-terug-volgorde** (overal hetzelfde patroon):
  taak-specifiek model → hoofdmodel (dat je bovenin kiest) → een
  hardgecodeerde laatste redmiddel (`llama3.2-vision` voor afbeeldingen,
  `nomic-embed-text` voor semantisch zoeken).
- **Zichtbare indicator**: op zowel de Afbeeldingen- als de
  Semantisch-zoeken-tab verschijnt een klein "🧠 modelnaam"-label zodra
  daar een ánder model dan het hoofdmodel actief is, met een tooltip die
  uitlegt waar dat is ingesteld.
- Wijzigingen in de instellingen werken **direct** door, geen page-reload
  nodig (`VaultSettings` meldt de wijziging terug aan `app.js`).

### Kanttekening: semantisch zoeken + hoofdmodel-fallback

Zoals gevraagd valt semantisch zoeken terug op het hoofdmodel als er geen
taak-specifiek model is ingesteld. Let op: semantisch zoeken heeft
specifiek een **embedding-model** nodig (zoals `nomic-embed-text`), geen
gewoon chat-model. Als je hoofdmodel een chat-model is (bijv. `gemma3:12b`,
wat de meest logische keuze voor een hoofdmodel is), zal Ollama's
embeddings-endpoint daar vermoedelijk een fout op geven zodra semantisch
zoeken die probeert te gebruiken. Kortom: dit werkt zoals gevraagd, maar in
de praktijk is het waarschijnlijk beter om voor "Semantisch zoeken" altijd
expliciet een echt embedding-model in te stellen, in plaats van op de
hoofdmodel-fallback te vertrouwen. Zeg het als je wilt dat ik dit anders
aanpak (bijv. de fallback naar hoofdmodel overslaan specifiek voor
semantisch zoeken, en direct naar `nomic-embed-text` gaan).

Ook gefixt terwijl ik hier toch was: `SemanticSearch.js` had een aparte,
niet aan instellingen gekoppelde automatische modelkeuze (koos altijd het
eerst-gevonden lokale embedding-model) die een bewust ingestelde
taak-specifieke voorkeur stilzwijgend zou hebben overschreven — nu
respecteert die automatische keuze de instelling, en overschrijft niets
zodra je zelf iets kiest in de dropdown.

### Getest

- Val-terug-prioriteit (taak-specifiek → hoofdmodel → hardcoded default)
  voor drie scenario's.
- Late config-sync (instelling komt pas ná de eerste render binnen) werkt
  correct door.
- Een handmatige modelkeuze door de gebruiker wordt niet overschreven door
  latere config-syncs.
- Alle vijf bestanden: `node --check`/`py_compile` geslaagd.

### Wat te kopiëren

`VaultSettings.js`, `server.py`, `app.js`, `ImagesGallery.js`,
`SemanticSearch.js`.

---

## Update: semantisch zoeken valt niet meer terug op het hoofdmodel

**Gewijzigd:** `SemanticSearch.js`, `VaultSettings.js`.

Zoals besproken: de fallback-keten voor semantisch zoeken is vereenvoudigd
van `taak-model → hoofdmodel → nomic-embed-text` naar gewoon
`taak-model → nomic-embed-text` — het hoofdmodel wordt nu volledig
overgeslagen, want dat is vrijwel altijd een chat-model en geen
embedding-model.

Ook de automatische detectie van lokaal geïnstalleerde embedding-modellen
(die bij het openen van de tab draait) checkte voorheen ook op "is er geen
hoofdmodel", wat niet meer relevant is nu het hoofdmodel toch nooit als
fallback dient — die check is verwijderd, dus de auto-detectie werkt nu
zuiver op basis van: is er een taak-instelling, heeft de gebruiker deze
sessie al zelf iets gekozen.

De hint-tekst in Instellingen → Modellen is iets explicieter gemaakt
("bewust NIET op het hoofdmodel, want dat is meestal een chat-model").

**Getest:** de vereenvoudigde fallback-functie voor beide scenario's (geen
instelling → nomic-embed-text; wel ingesteld → dat model), hoofdmodel komt
in geen van beide nog voor. `node --check` geslaagd op beide bestanden.

### Wat te kopiëren

`SemanticSearch.js`, `VaultSettings.js`.

---

## Update: hoofdmodel-persistentie gefixt + beschikbaarheid taak-modellen zichtbaar

**Gewijzigd:** `app.js`, `VaultSettings.js`.

### 1. Hoofdmodel werd nooit opgeslagen (echte bug, apart van het vorige probleem)

`localStorage.getItem("zk_model")` werd bij het opstarten uitgelezen, maar
er stond **nergens** een `localStorage.setItem("zk_model", ...)` — elke
modelkeuze via de hoofd-`ModelPicker` leefde dus alleen in React-state en
verdween zodra je de pagina herlaadde of de server herstartte. Simpele fix:
een `useEffect` die `llmModel` synchroon naar `localStorage` schrijft bij
elke wijziging.

**Getest:** gesimuleerde localStorage — model kiezen, "herstart" (nieuwe
leesronde), model blijft behouden.

### 2. Beschikbaarheid van taak-modellen nu zichtbaar

**Instellingen → Modellen → "Model per taak"** haalt nu ook de lijst
lokaal-geïnstalleerde Ollama-modellen op (`/api/ollama-models`, dezelfde
aanroep die `SemanticSearch.js` en `ModelPicker.js` ook al gebruiken) en
toont per taak of het standaardmodel daadwerkelijk beschikbaar is:

- **Wel geïnstalleerd**: de standaard-optie toont
  "— Standaard: nomic-embed-text ✓ geïnstalleerd —".
- **Niet geïnstalleerd**: "— Standaard: nomic-embed-text ⚠ niet
  geïnstalleerd —", plus een oranje waarschuwing eronder met het exacte
  `ollama pull …`-commando, én een oranje randkleur op de keuzelijst zelf.
- Elke optie in de "Lokaal (Ollama)"-groep toont ook een "✓" of "— niet
  geïnstalleerd"-suffix, zodat je in één oogopslag ziet welke van de
  aanbevolen modellen je al hebt.

Dit dekt letterlijk beide dingen die je vroeg: automatisch tonen als het
er al is (✓-indicator, geen verrassingen), en duidelijk laten zien als het
ontbreekt (⚠ + concrete installatie-instructie) — zonder de onderliggende
"leeg = gebruik het juiste standaardmodel"-opslaglogica te veranderen, die
werkte al correct.

**Getest:** matching-logica voor 5 scenario's (met/zonder `:tag`, nog aan
het laden, en een fout-positief-randgeval met een gelijkende modelnaam die
terecht niet matcht).

### Wat te kopiëren

`app.js`, `VaultSettings.js`.

---

## Update: model-per-taak-dropdowns vereenvoudigd (voelden aan als kapot)

**Gewijzigd:** alleen `VaultSettings.js`.

De vorige "beschikbaarheid tonen"-versie was te druk: elke optie in de lijst
kreeg een "✓"/"niet geïnstalleerd"-suffix, en de standaard-optie plus een
losse waarschuwingsbox riepen prominent "⚠ niet geïnstalleerd" — dat voelde
aan als "deze taak is niet bruikbaar", terwijl je gewoon nog steeds elk
model uit de lijst kon kiezen. Niets was functioneel verwijderd, maar het
zag er zo uit.

**Vereenvoudigd naar wat je vroeg:**
- Als het standaardmodel voor een taak (llama3.2-vision / nomic-embed-text)
  lokaal geïnstalleerd is: die staat nu **automatisch als geselecteerd**
  getoond in de dropdown (`— Automatisch (nomic-embed-text) —` i.p.v. een
  lege placeholder) — geen actie nodig, precies het model dat er anders
  toch gebruikt wordt.
- Is het niet geïnstalleerd: gewoon een neutrale `— Automatisch —`-optie,
  geen waarschuwingskleur, geen blokkerende box — alleen een rustige, kleine
  toelichtingsregel die het installatie-commando noemt, zonder de suggestie
  dat er iets kapot is.
- De "✓ / niet geïnstalleerd"-suffixes per optie zijn weg — de volledige
  lijst (online, lokaal, aangepast) is weer gewoon altijd 100% kiesbaar,
  zoals in de oorspronkelijke versie.
- Kies je zelf expliciet iets anders, dan wint die keuze altijd, ongeacht
  wat er automatisch gedetecteerd is.

**Getest:** de auto-fill-logica voor drie scenario's — standaardmodel
geïnstalleerd (toont automatisch), niet geïnstalleerd (neutrale placeholder,
niets geblokkeerd), en een expliciete gebruikerskeuze (wint altijd).

### Wat te kopiëren

Alleen `VaultSettings.js`.

---

## Update: markeer-uitdaging afgesloten — diagnose-logging verwijderd

**Gewijzigd:** alleen `PDFViewer.js`.

De `[DIAG]`-console-logs die waren toegevoegd om het "2e-document"-probleem
te isoleren, hebben hun werk gedaan: de meegestuurde console-output liet een
**volledig geslaagde** selectie→popup→opslaan-flow zien (43 ruwe
rect-fragmenten → 22 samengevoegde regel-balken, popup verscheen, klikken
kwamen correct aan) — en je bevestigde dat de highlight ook echt zichtbaar
verscheen. Het onderliggende probleem is dus niet meer aanwezig
(vermoedelijk als bijeffect van een van de tussentijdse fixes, met name de
`onSaveNote`-destructuring-bug of de `mergeRectsByLine`-wijziging).

Nu de oorzaak gevonden is (of in elk geval: het probleem weg is), zijn alle
tijdelijke `console.log("[DIAG] ...")`-regels verwijderd — zowel in
`tryOpenAnnotPopup` als in de `onMouseUp`-handler eromheen. Functioneel is
er niets veranderd t.o.v. de vorige levering, alleen de debug-ruis is weg.

### Wat te kopiëren

Alleen `PDFViewer.js`.

---

## Update: pin-annotatie op afbeeldingen afgemaakt

**Gewijzigd:** alleen `ImagesGallery.js`.

De functie was voor de helft gebouwd: klikken op een afbeelding plaatste
een pulserende pin-marker, maar de belofte in de code ("invoer loopt via
sidebar") was nooit ingelost — die zijbalk bestond niet, en `addAnnotation`
(de functie die de pin daadwerkelijk zou opslaan) werd nergens aangeroepen.
De pin bleef dus oneindig knipperen zonder manier om 'm af te ronden of te
annuleren.

**Fix:** een invoer-popup toegevoegd, direct bij de pin — in exact dezelfde
stijl als de al bestaande bewerk-popup voor bestaande pins (dezelfde
positionering, dezelfde `SmartTagEditor`, dezelfde kleurenkeuze), zodat het
naadloos aansluit bij wat er al werkte:

- Notitieveld (Escape = annuleren, Cmd/Ctrl+Enter = opslaan)
- Tags via `SmartTagEditor`
- Kleurkeuze (dezelfde 5 kleuren als highlights)
- "✓ opslaan" (roept nu eindelijk `addAnnotation` aan) / "× annuleren"

**Bijvangst:** `setShowAnnotPanel(true)` — een verwijzing naar de nooit
gebouwde sidebar-state — was de laatste plek die deze dode state nog
aanraakte. Zowel die aanroep als de state-declaratie zelf zijn opgeruimd.

**Getest:** de volledige flow (pin plaatsen → notitie/tags invullen →
opslaan) end-to-end gesimuleerd — de annotatie komt er correct uit, met
alle velden op hun plek.

### Wat te kopiëren

Alleen `ImagesGallery.js`.

---

## Update: resterende onafgemaakte functies uit de audit afgerond

**Gewijzigd:** `MermaidEditor.js`, `DailyView.js`.

Vervolg op de code-audit — de twee minder duidelijke kandidaten (geen
zichtbaar kapotte UI zoals bij de afbeeldingen-pins, maar wel volledig
gebouwde functies zonder enige trigger) alsnog aangesloten.

### 1. Mindmap: "als Mermaid bekijken" en "opslaan als notitie"

Twee complete, geteste functies (`nodesToMermaid`, `saveAsNote` — inclusief
foutafhandeling en een statusbericht) hadden geen enkele knop die ze
aanriep:

- **"📐 Als Mermaid"** (nieuwe knop, naast de bestaande "✦ Nieuw") — opent
  de Mermaid-editor nu gevuld met de **huidige mindmap** omgezet naar
  Mermaid-syntax, in plaats van dat "✦ Nieuw" de enige optie was (die opent
  bewust een lege tekening — dat gedrag liet ik ongemoeid).
- **"💾 Opslaan als notitie"** (nieuwe knop) — slaat de volledige mindmap op
  als een Markdown-notitie, met het al bestaande statusbericht
  (`saveMsg`) nu ook echt zichtbaar.

### 2. DailyView: "Snelle notitie" — een losse notitie i.p.v. een dagnotitie-bullet

`doQuickCapture` (+ de bijbehorende `quickTitle`/`quickCapt`-state) maakt
een **zelfstandige, losse notitie** aan — een ander soort vastleggen dan de
bestaande QuickEntryBar (·/☐/💡), die juist een regel toevoegt aan de
dagnotitie zelf. Er was geen knop om dit te starten. Nieuwe knop **"✎
Snelle notitie"** toegevoegd naast de bestaande "📋 Nieuwe ADR"-knop, met
een identiek dialoogpatroon (titel invullen, Enter/knop om aan te maken,
Escape om te annuleren) zodat het meteen vertrouwd aanvoelt.

### Getest

- `doQuickCapture`: lege titel → geen aanmaak; geldige titel → correct
  notitie-object.
- De Mindmap-knoppen zijn pure UI-koppelingen van functies die al eerder
  correct werkten (geen nieuwe logica, dus geen aparte functionele test
  nodig) — wel `node --check` op beide bestanden geslaagd.

### Wat te kopiëren

`MermaidEditor.js`, `DailyView.js`.

---

## Update: zomerlicht-thema opnieuw op contrast doorgerekend + systemische appearance-fix

**Gewijzigd:** `app.js`, `index.html`.

### Onderzoek

Kort literatuuronderzoek naar buiten-/zonlicht-leesbaarheid bevestigt: bij
fel omgevingslicht daalt de *waargenomen* contrastratio doordat het zwart-
niveau van het scherm effectief omhoog gaat — de gangbare aanbeveling is
dan ook om WCAG **AAA (7:1)** aan te houden i.p.v. het gebruikelijke AA
(4.5:1), en om terughoudend te zijn met subtiele/gedimde kleurvariaties
(die vallen buiten juist het eerst weg).

### Bevinding 1: het thema zelf zat al dichtbij, maar niet overal AAA

Het `zomerlicht`-thema in `app.js` had al zorgvuldige commentaren met
beweerde contrastwaarden. Ik heb die **daadwerkelijk nagerekend** met de
officiële WCAG-relatieve-luminantie-formule (niet op het oog geschat) tegen
**beide** achtergrondtinten die het thema gebruikt (`bg` en het iets
donkerdere `bg2`, waar kaarten/zijbalken op staan). Vier kleuren zaten net
onder AAA: `fgDim` (5.72–7.26), `comment`/`green` (6.95–7.35), `orange`
(6.83–7.20), `yellow` (4.95 — deze zat het verst weg). Alle vier
lichtjes bijgesteld (zelfde kleurtoon, iets donkerder) tot ze **op beide
achtergronden** minimaal 7:1 halen — geverifieerd met een script, niet
handmatig.

### Bevinding 2: een systemisch gat, geen thema-bug — de zwarte "Filter op tag"-invoer

Dit bleek dezelfde onderliggende oorzaak als de eerder gevonden
datumknop-bevel (die sessie apart gepatcht): geen enkel `<input>`/`<button>`
in de hele app heeft `-webkit-appearance: none`, waardoor de browser/het OS
in bepaalde gevallen zijn eigen (vaak donkere) systeemstyling laat
doorschemeren, ongeacht wat de JS-inline-stijl voorschrijft — de code zelf
gebruikte hier al correct `W.bg` (crème), maar de browser negeerde dat.

**Fix:** één globale CSS-regel in `index.html` i.p.v. steeds opnieuw
per-element patchen zodra het ergens opduikt:
```css
button, input, textarea { -webkit-appearance: none; appearance: none; font-family: inherit; }
```
Bewust **niet** ook `background`/`border`/`color` hierin meegenomen — dat
zet vrijwel elk element al zelf, en dit zou elementen die daar toevallig
op leunen onbedoeld onzichtbaar kunnen maken. `<select>` is bewust
**uitgesloten** — die verliest anders zijn dropdown-pijltje, en niet elke
`<select>` in de app tekent daar zelf een vervangende pijl voor.

### Getest

- Alle thema-kleuren opnieuw doorgerekend na aanpassing: alles ≥7:1 op
  zowel `bg` als `bg2` — script-uitvoer bijgevoegd in de sessie, niet op
  het oog beoordeeld.
- `node --check` op `app.js`, HTML-structuurcheck (gebalanceerde
  `<style>`-tags) op `index.html`.

**Kanttekening:** ik kon de "Filter op tag"-fix niet interactief in een
browser verifiëren. Gegeven het exact matchende patroon met de eerder al
bevestigde en opgeloste datumknop-bevel-bug ben ik er vrij zeker van, maar
laat het weten als de invoer na deze update nog steeds donker oogt — dan
moet er iets anders spelen en ga ik gerichter zoeken.

### Wat te kopiëren

`app.js`, `index.html`.

---

## Update: contrast-nasleep zomerlicht-thema — twee dieperliggende oorzaken gevonden

**Gewijzigd:** `DailyView.js`, `app.js`, `Graph.js`, `PDFViewer.js`,
`BookLibrary.js`, `NoteEditor.js`, `MermaidEditor.js`, `TagManager.js`,
`SemanticSearch.js`, `ModelPicker.js`.

De vorige ronde loste de theme-tokens zelf op, maar de gemelde "zwarte
vlakken" en vage teksten kwamen niet daarvandaan — twee andere,
structurele oorzaken gevonden:

### Oorzaak 1: `W.xxx || "#donkere-kleur"` — risicovolle fallbacks, overal

84 stuks in `DailyView.js` alleen al (in totaal ruim 110 over alle
bestanden): overal in de app staat een patroon als
`color:W.fgMuted||"#999"` of `background:W.bg2||"#222"` — een fallback
die alleen bedoeld was voor het geval `W` ontbreekt, maar in de praktijk
nooit hoort te ontbreken. Dit was de directe oorzaak van de "Filter op
tag"-invoer en de "dagnotitie"-badge die zwart bleven: die twee specifieke
plekken kregen om een niet volledig te herleiden reden de fallback-waarde
i.p.v. de correcte thema-waarde. In plaats van dit element voor element te
blijven opsporen: **alle 110+ van dit exacte patroon verwijderd** (in
`DailyView.js`, `app.js`, `Graph.js`, `PDFViewer.js`, `BookLibrary.js`,
`NoteEditor.js`, `MermaidEditor.js`, `TagManager.js` — daar heette het
`W2` i.p.v. `W` —, `SemanticSearch.js`). `W` is overal een verplichte,
altijd-aanwezige prop/global in deze codebase, dus dit verwijdert alleen
risico, geen functionaliteit.

### Oorzaak 2: provider-/status-kleuren die nooit naar het thema keken

Losstaand hardgecodeerde kleuren (niet via `W`, dus door de vorige ronde
niet geraakt) — gemaakt voor donkere thema's, met desastreus lage
contrastwaarden op crème (sommige tot **1.07:1**, praktisch onzichtbaar):
- De "294 ZETTELS" / "169 TAGS"-onderschriften in de topbalk (`app.js`) —
  hardgecodeerde `rgba(...,0.7)` op een kleur die op donker prima werkt,
  op crème bijna wegvalt.
- De "online"/"offline"-serverindicator (`app.js`) — nu gekoppeld aan
  `W.comment`/`W.orange` i.p.v. vaste hexwaarden.
- **`PROVIDER_COLOR`/`MODEL_COLOR`** (`PDFViewer.js`, gedeeld met
  `ModelPicker.js`) — de kleuren die elke AI-provider (Anthropic, Google,
  OpenAI, OpenRouter, Mistral) herkenbaar maken, incl. de "qwen2.5"-badge
  in de topbalk. Dit is nu een **echte thema-bewuste functie** geworden:
  dezelfde herkenbare kleurtoon per provider, maar met een apart,
  aanzienlijk donkerder kleurenpalet specifiek voor lichte thema's
  (`W.dark===false`), elk geverifieerd ≥7:1 op crème. Ook de Jan.ai-sectie
  in de modelkiezer meegenomen.

### Getest

- Script-matige AAA-verificatie van alle nieuwe provider-kleuren tegen de
  strengste zomerlicht-achtergrond — allemaal ≥7:1.
- `node --check` op alle tien bestanden geslaagd.
- Steekproef op de fallback-verwijdering: de "Filter op tag"-invoer en de
  tag-badge-regel expliciet nagekeken — staan er nu zonder de risicovolle
  fallback, gebruiken direct de (correcte) thema-waarde.

**Kanttekening:** ik kon dit niet interactief verifiëren. Voor de twee
specifiek gemelde zwarte vlakken heb ik geen 100%-sluitende verklaring
kunnen vinden voor *waarom* precies die twee de fallback raakten terwijl
de rest van de pagina goed ging — wel een robuuste, brede fix die de hele
risicocategorie wegneemt. Laat het weten als er na deze update nog ergens
iets donker/onleesbaar oogt, dan ga ik gerichter op dát specifieke element
zoeken.

### Wat te kopiëren

Alle tien: `DailyView.js`, `app.js`, `Graph.js`, `PDFViewer.js`,
`BookLibrary.js`, `NoteEditor.js`, `MermaidEditor.js`, `TagManager.js`,
`SemanticSearch.js`, `ModelPicker.js`.

---

## Update: uitgaande links tonen nu leesbare titels + tags (net als inkomende)

**Gewijzigd:** alleen `LinksSidebar.js`.

### De oorzaak

De "Uit"-tab (uitgaande links) toonde de **ruwe linktekst** zoals die
letterlijk tussen `[[...]]` staat — inclusief interne note-ID's zoals
`note_1779560214726_sl0...` wanneer een link ooit via ID i.p.v. titel is
aangemaakt. De code zocht daarbij wél al de bijbehorende notitie op
(`o.note`), maar gebruikte die vervolgens niet om de titel te tonen — puur
een rendering-omissie, de opzoeklogica zelf werkte al correct. De "In"-tab
(inkomende links) had dit probleem niet, want die itereert al over echte
notitie-objecten en toont dus altijd vanzelf `n.title`.

### De fix

`o.title` (ruwe tekst) vervangen door `o.note ? (o.note.title || o.note.id) : o.title`
— toont de leesbare titel zodra de notitie gevonden is, valt alleen terug
op de ruwe tekst bij een echt gebroken link (of een PDF-/afbeeldings-
referentie, die geen notitie-object heeft — dat gedrag blijft ongewijzigd
correct). Voor volledige gelijkenis met de "In"-tab ook de tag-pills
toegevoegd onder elke gevonden notitie (max. 3, zelfde `TagPill`-component
die de "In"-tab al gebruikte).

### Getest

- Vier scenario's los doorgerekend: ID-link met gevonden notitie (het
  gemelde probleem) → toont nu de titel; titel-link met gevonden notitie →
  ongewijzigd correct; écht gebroken link → valt terecht terug op de ruwe
  tekst; PDF-referentie → ongewijzigd, toont de bestandsnaam.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `LinksSidebar.js`.

---

## Update: relatieve nummering standaard aan + hulpscherm uitgebreid

**Gewijzigd:** alleen `VimEditor.js`.

### 1. Relatieve regelnummering

Bestond al volledig (renderlogica, `:set rnu`/`:set nornu`-commando's) maar
stond standaard **uit** (`relativeNumbers: false`) — geen bug in de
weergave zelf, gewoon de verkeerde default. Nu standaard **aan**, zoals
gevraagd (nog steeds uit te zetten met `:set nornu`).

### 2. Hulpscherm (`?`) uitgebreid

Twee bestaande, maar nergens gedocumenteerde functies toegevoegd:

- **LINKS & VERWIJZINGEN** — `[[` typen opent automatisch de
  notitie-dropdown; verder typen filtert die lijst. Bestond al, stond
  nergens uitgelegd.
- **BRON-MARKERING (`\`)** — de leader-toets `\` gevolgd door `b`/`k`/`e`
  markeert het woord (of de visuele selectie) als bron/kritische
  noot/eigen gedachte (`[tekst]{.bron}` e.d.). Dit is dezelfde
  laag-markering die bij het exporteren van PDF-highlights wordt herkend
  (bron/kritisch/eigen — zie de eerdere PDF-highlight-verbeteringen deze
  sessie). Met een korte toelichtingsregel erbij die dat verband uitlegt.

Ook de bestaande `:template naam`-regel bijgewerkt met de vijf echte
templatenamen (dagnotitie/meeting/literatuur/project/vraag) i.p.v. de
vage "...".

**Bijvangst:** de kleuren van de twee nieuwe secties gebruiken bewust
`W.type`/`W.orange` (thema-tokens) i.p.v. losse hex-waarden — anders had ik
hier precies dezelfde theme-onbewuste-kleur-bug geïntroduceerd die ik deze
sessie net overal aan het opruimen was.

### Getest

- `node --check` geslaagd.
- De render-functie voor hulpscherm-secties (nu met optionele vierde
  subtitel-waarde) los getest voor zowel 3- als 4-elementen — beide vormen
  werken correct naast elkaar.

### Wat te kopiëren

Alleen `VimEditor.js`.

---

## Update: regelnummers onzichtbaar — echte oorzaak gevonden (geen kleurenkwestie)

**Gewijzigd:** alleen `VimEditor.js`.

### De oorzaak — een regressie van de eerdere horizontaal-scroll-fix

Niet gerelateerd aan thema-kleuren (die klopten al, zoals eerder
nagerekend). De horizontale auto-scroll-fix van eerder deze sessie (voor
"tekst loopt uit het zichtbare veld") stelt een canvas-clip-regio in die
begint bij `x = nw` (de breedte van de regelnummer-kolom) — bedoeld om te
voorkomen dat lange, weggeschoven regels over de regelnummers heen tekenen.

Het regelnummer zelf wordt echter getekend op `x = nw - PAD_LEFT` — dus
**binnen** dat net-afgeknipte gebied. Een canvas voert tekenopdrachten
buiten de actieve clip-regio stilzwijgend niet uit: geen foutmelding, gewoon
niets zichtbaars. Dit trof alle regelnummers, in elk thema — vandaar
"meerdere thema's" en niet een specifiek kleurprobleem.

### De fix

De regelnummer-tekening losgetrokken uit de bestaande, afgeknipte
per-regel-doorloop en verplaatst naar een eigen doorloop **vóór** de
`ctx.clip()`-instelling — buiten het afgeknipte gebied, dus altijd
zichtbaar. De `hiddenRows`-berekening (welke regels door een fold verborgen
zijn) is mee naar voren verhuisd, want beide doorlopen hebben 'm nodig.

### Getest

- De clip-grens-logica los gesimuleerd: bevestigt dat x=32 (regelnummer)
  bij de oude volgorde buiten x=40 (clip-start) viel — exact het
  mechanisme achter de bug.
- Gecontroleerd dat `hiddenRows` precies één keer gedeclareerd wordt en
  door beide doorlopen correct hergebruikt wordt.
- `ctx.save()`/`ctx.clip()`/`ctx.restore()` opnieuw in balans geverifieerd.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `VimEditor.js`.

---

## Update: startscherm schaalt nu mee op iPad

**Gewijzigd:** alleen `DailyView.js`.

### De oorzaak

`isWide` (bepaalt of de layout 2 kolommen naast elkaar toont of alles
onder elkaar) werd berekend als `window.innerWidth >= 900` — **één keer**
gelezen op het moment van renderen, zonder resize-listener. Draaide je de
iPad (portrait ↔ landscape), ging in/uit split-view-multitasking, of
verscheen/verdween het schermtoetsenbord, dan bleef de layout vastzitten
in de oude stand totdat er om een andere reden toevallig een her-render
plaatsvond.

De hoofdstatistieken-grid (Notities/Reviews/SR-systeem/Open taken) bleek al
responsief (`auto-fit`/`minmax`) — dat was dus niet het probleem. Wel nog
gevonden: de 4 beoordelingsknoppen tijdens een actieve review-sessie
(Vergeten/Moeite/Goed/Makkelijk) stonden nog vast op 4 gelijke kolommen.

### De fix

- `isWide` nu React-state, bijgewerkt via een `resize`- én
  `orientationchange`-listener — reageert meteen op elke schermverandering.
- De review-beoordelingsknoppen naar hetzelfde `auto-fit`/`minmax`-patroon
  gebracht dat de hoofdstatistieken al gebruikten.

### Getest

- De 900px-drempel doorgerekend voor zeven realistische scenario's (iPad
  mini/Air/Pro, portrait/landscape, én een split-view-helft) — logisch
  resultaat in alle gevallen: portrait en split-view-helften krijgen 1
  kolom, volledige landscape-breedtes krijgen 2 kolommen.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `DailyView.js`.

---

## Update: donkere popups in de Graaf gefixt voor zomerlicht (en alle lichte thema's)

**Gewijzigd:** alleen `Graph.js`.

### De oorzaak

Het hoofd-canvas van de Graaf gebruikte al correct `W.bg` (thema-bewust) —
dit was dus geen bewuste "altijd donker"-keuze. Maar een hele reeks
**overlay-elementen** (rechtsklik-menu, hover-tooltip, minimap, focus-
filter-badge, de "verrassende verbinding"-banner, en een aantal subtiele
hover-highlights/scheidingslijnen) hadden hun achtergrond hardgecodeerd op
bijna-zwart (`rgba(22,22,22,0.9x)` e.d.), terwijl hun tekst al wél
`W.fg`/`W.statusFg` gebruikte — in het zomerlicht-thema is dat bijna-zwarte
tekst. Zwart-op-zwart dus: het rechtsklik-menu had daardoor een gemeten
contrast van **1.06:1** (WCAG-minimum is 4.5:1).

In totaal ~15 plekken gevonden en gefixt:
- Rechtsklik-menu (achtergrond, rand, divider, hover-highlight)
- Hover-tooltip op canvas-nodes
- Minimap-achtergrond
- Focus-filter-badge
- "Verrassende verbinding"-banner (incl. de losse reden-items daarbinnen)
- Diverse subtiele scheidingslijnen/hover-highlights in het instellingen-
  paneel, plus de scrollbar-kleur
- 11 stuks van hetzelfde `W.xxx||"rgba(...)"`-risicopatroon dat de vorige
  opschoonronde miste (die zocht alleen naar `||"#hex"`, niet naar
  `||"rgba(...)"`)

Voor canvas-elementen (tooltip, minimap) gebruikt via de nieuwe `W.bg3`
(solide, altijd gedefinieerd). Voor subtiele hover-tinten die zowel in
donkere als lichte thema's moeten werken: `W.dark===false ? "rgba(0,0,0,x)" : "rgba(255,255,255,x)"`.

### Getest

- Rechtsklik-menu-contrast concreet doorgerekend: van 1.06:1 (oud, bijna
  onleesbaar) naar 14.45:1 (nieuw, ruim boven AAA) op het zomerlicht-thema.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `Graph.js`.

---

## Update: Canvas (Whiteboard) donker in zomerlicht — zelfde patroon, andere plek

**Gewijzigd:** alleen `Whiteboard.js`.

### De oorzaak

De **hoofd-canvas-kolom** zelf had een hardgecodeerde donkere achtergrond
(`background:"#181818"`) — dit is de kernoorzaak van het gemelde probleem.
Net als bij de graaf: de tekst erbovenop gebruikte al wél `W.fg`
(thema-bewust, dus bijna-zwart in zomerlicht), op een achtergrond die dat
nooit meekreeg. Contrast: **1.08:1** — vrijwel onleesbaar.

Daarnaast dezelfde ronde bugs als bij de graaf gevonden: 30 stuks van het
`W.xxx||"..."`-risicopatroon, plus losse hardgecodeerde donkere
UI-elementen (een zoekveld, een kleurlegenda-paneel, meerdere
toolbar-scheidingslijnen, een afbeeldingstegel-achtergrond, de
labelbadge/tekst op canvas-verbindingslijnen, en de fijne rasterlijnen van
het canvas zelf).

**Bewust ongewijzigd gelaten:** het kaartkleur-palet (5 selecteerbare
kaartkleuren: geel/blauw/rood/groen/paars/grijs) — dat is inhoud-kleur
(zoals fysieke sticky notes in vaste kleuren), geen UI-chrome die met het
thema moet meebewegen. Ook alle `boxShadow`-waarden en de fotobijschrift-
overlay (donkere sluier + lichte tekst bovenop een foto — universeel
patroon, ongeacht app-thema) blijven ongemoeid.

### Getest

- Canvas-achtergrond-contrast concreet doorgerekend: van 1.08:1 (oud,
  vrijwel onleesbaar) naar 17.36:1 (nieuw) op het zomerlicht-thema.
- `node --check` geslaagd.
- Handmatige eindinventarisatie van alle resterende donkere hex/rgba-
  waarden — elk beoordeeld en bewust behouden (kaartkleuren, schaduwen,
  foto-overlay) of gefixt.

### Wat te kopiëren

Alleen `Whiteboard.js`.

---

## Update: kaartkleuren + radiaal popup-menu in Canvas nu écht thema-bewust

**Gewijzigd:** alleen `Whiteboard.js`.

### 1. Kaartkleuren (het probleem uit de screenshot)

Mijn vorige beoordeling was fout: ik dacht dat het 6-kleurenpalet voor
kaarten (geel/blauw/rood/groen/paars/grijs) "inhoud-kleur" was zoals
fysieke sticky notes, en liet het bewust ongewijzigd. Bij nader onderzoek
bleken alle zes achtergrondkleuren zeer donkere, subtiel getinte
varianten te zijn — specifiek afgestemd op de oude, altijd-donkere canvas,
niet op "vaste papierkleur". Notitie-gekoppelde kaarten (zoals in de
screenshot) krijgen bovendien standaard kleur-index 1 ("blauw").

**Fix:** het palet is nu een `W.dark===false`-vertakking: dezelfde zes
herkenbare kleurtonen, maar met een lichte, pastelachtige achtergrond +
donkere tekst voor lichte thema's, en de originele donkere variant voor
donkere thema's. Randkleuren zijn zo gekozen dat ze op beide varianten
minimaal 3:1 zichtbaar blijven (niet-tekstuele WCAG-eis).

### 2. Het radiale popup-menu ("verken meer info")

Dit is het booggebaseerde pie-menu dat opent bij een rechtsklik op een
kaart — grotendeels al thema-bewust opgezet, maar met een paar
**hardgecodeerde hover-kleuren** die nooit meebewogen: zodra je over een
menu-item of een gerelateerde-notitie-node hovert (= precies het moment
waarop je "verkent wat er nog meer aan info is"), sprong de tekstkleur
naar een vast lichtgeel/wit (`#ffffd7`/`#fff`) — leesbaar op de oude
donkere achtergrond, maar op een licht thema vrijwel onzichtbaar. Vandaar
"lastig ongeacht het kleurthema": dit ene detail bewoog al die tijd nooit
mee, wat je ook instelde.

Drie plekken gefixt (binnenring-iconen, binnenring-labels,
buitenring-node-labels): bij hover nu `W.fg` op lichte thema's i.p.v.
het hardgecodeerde lichtgeel/wit.

### Getest

- Alle zes lichte kaartkleuren: tekst-op-achtergrond-contrast 6.55–9.91:1
  (ruim AA, meeste ook AAA).
- Hover-tekst in het pie-menu: van 1.21:1 (oud, onleesbaar) naar 15.5:1
  (nieuw) op een licht-getinte hover-achtergrond.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `Whiteboard.js`.

---

## Update: popup-menu — resterende tekst-leesbaarheid gefixt

**Gewijzigd:** alleen `Whiteboard.js`.

Vervolg op de vorige ronde (die de hover-status al fixte). Twee resterende
plekken gevonden waar tekst nog steeds te weinig contrast had, ditmaal in
de **standaard (niet-hover) status** en op een apart, nog niet eerder
bekeken onderdeel:

1. **Ring-labels rondom de ring** (bv. "Hoofd EA - Chi...", "Capabilities
   I..."): gebruikten `W.fgMuted` met een alpha-transparantie-suffix
   (bedoeld als subtiel "gloei-effect" op de oude donkere achtergrond).
   Die transparantie drukte het toch al zorgvuldig afgestemde contrast
   van 9.4:1 terug naar 5.4:1 op het lichte thema. Nu: geen
   alpha-verzwakking meer op lichte thema's, puur het thema-getinte
   `W.fgMuted` — terug naar 9.4:1.

2. **Notitietype-badge in het info-kaartje** (het kleine label met stipje
   dat aangeeft of een notitie "vluchtig"/"literatuur"/"permanent"/"index"
   is): gebruikte de rauwe, lichte pastelkleur rechtstreeks als tekstkleur
   op een bijna-crème badge-achtergrond — contrast rond de **1.5–1.8:1**,
   voor alle vier de types. Nu een aparte, donkere variant per type
   specifiek voor lichte thema's, elk geverifieerd ≥7:1 (AAA).

### Getest

- Beide fixes concreet doorgerekend: ring-labels van 5.4:1 naar 9.4:1;
  notitietype-badges van ~1.5-1.8:1 naar 7.08–7.52:1 voor alle vier de
  types.
- Bredere eindcontrole op het hele popup-menu-codeblok: geen overgebleven
  hardgecodeerde tekstkleuren meer gevonden — alles gebruikt nu direct de
  thema-variabelen of een expliciete licht/donker-vertakking.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `Whiteboard.js`.

---

## Update: popup-menu — segment-achtergronden zelf waren de kern van het probleem

**Gewijzigd:** alleen `Whiteboard.js`.

### Onderzoek

Kort literatuuronderzoek naar radiale-menu/pie-chart-leesbaarheid bevestigt
de kernregel: labeltekst moet minimaal 4.5:1 contrast hebben tegen **het
segment waar hij op staat** — niet (alleen) tegen de paginaeachtergrond.
Dat bleek precies waar de vorige twee rondes nog niet aan toekwamen.

### De echte oorzaak

De ring-segmenten (alle niveaus: binnenring-knoppen én de buitenste
diepte-ringen) gebruikten als vulkleur de **donkere, tekst-geoptimaliseerde**
thema-kleuren (`W.blue`, `W.tagColor`, `W.orange`, `W.purple` — bewust
donker gemaakt in een eerdere ronde, specifiek zodat ze als tekst goed
lezen op een lichte achtergrond). Diezelfde donkere kleuren als
**achtergrond** gebruiken, met de al even donkere labeltekst (`W.fgMuted`)
erbovenop, gaf donker-op-donker: gemeten **3.46–3.84:1**, onder de
tekst-minimum van 4.5:1. Vandaar dat het "in alle uitklap-niveaus" bleef
terugkomen, ongeacht welke eerdere tekst-fix ik al had toegepast — het echte
probleem zat in de achtergrond, niet (alleen) in de tekst.

Ook een dode `isDark`-vertakking gevonden bij `RING_COLORS` die in beide
takken identieke waarden teruggaf — leek een eerdere, nooit afgemaakte
poging tot precies deze fix.

### De fix

Twee gescheiden kleursets geïntroduceerd: de bestaande donkere kleuren
blijven gebruikt voor tekst/iconen/randen (ongewijzigd, correct), en een
**nieuwe, aparte lichte pastelbasis** (`segBlueRgb`/`segGreenRgb`/
`segOrangeRgb`/`segPurpleRgb`) specifiek voor segment-achtergronden op
lichte thema's — dezelfde herkenbare kleurtoon, alleen omgekeerde
helderheid. Toegepast op alle binnenring-knoppen (Bewerken, Verbinden,
Notitie, Graaf, Dupliceer, Verwijder) én de vier buitenste diepte-ringen.

De losse "ring 0"-verbindingstype-kleuren (blauw/geel/groen voor
inkomende/uitgaande/geen link) bleken toevallig al licht genoeg gekozen —
6.45–8.91:1, geen aanpassing nodig.

### Getest

- Slechtste-geval-doorrekening over alle 4 segmentkleuren × het volledige
  gewicht-afhankelijke alpha-bereik (0.20–0.62): minimaal 6.07:1 — ruim
  boven de 4.5:1-tekstminimum, ook in het zwaarste geval.
- Volledige herscan van het hele menu-codeblok op resterende
  hardgecodeerde rgba-patronen — niets onbeoordeeld overgebleven.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `Whiteboard.js`.

---

## Update: cursor met de muis positioneren — font-load-race-condition gefixt

**Gewijzigd:** alleen `VimEditor.js`.

### De oorzaak

Klik-naar-cursor-positionering was al volledig geïmplementeerd (rij/kolom
correct berekend, cursor gezet, scroll gecorrigeerd) — het probleem zat
in de **tekenbreedte-meting** waar die berekening op leunt. "Hack" is een
webfont die asynchroon laadt; de meting (`ctx.measureText("M").width`)
gebeurde één keer bij het opstarten, mogelijk vóórdat het lettertype klaar
was — dan meet de browser de fallback-breedte (Courier New), die net
anders is dan Hack. Die verkeerde breedte werd daarna nooit meer
herberekend, ook niet nadat Hack alsnog geladen was en de tekst daar
correct mee ging renderen. Gevolg: de berekende kolom bij een klik wijkt
steeds verder af naarmate je verder naar rechts klikt — voelt aan als
"de cursor gaat niet naar waar ik klik".

### De fix

`document.fonts.ready` toegevoegd: zodra het lettertype daadwerkelijk
klaar is, wordt de tekenbreedte opnieuw gemeten en (als die afwijkt)
direct bijgewerkt plus een her-render getriggerd — geen wachten op een
toevallige volgende render meer nodig.

### Getest

- Gesimuleerd scenario met een verkeerde (fallback-)breedte: een klik die
  eigenlijk op kolom 30 hoort te landen, kwam uit op kolom 25 — na
  correctie via de gesimuleerde `fonts.ready`-afhandeling weer exact op 30.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `VimEditor.js`.

---

## Update: AI-tekstverbetering — "model per taak" afgerond (Tekstverbetering-slot)

**Gewijzigd:** `server.py`, `app.js`, `NotesTab.js`, `NoteEditor.js`,
`VimEditor.js`, `VaultSettings.js`.

Vervolg op de vorige levering (de kernfunctie AI-tekstverbetering + de
cursor-positionering-fix waren toen al klaar). Dit rondt het optionele
"model per taak"-onderdeel af: een derde, losse modelkeuze specifiek voor
tekstverbetering, naast Afbeeldingen en Semantisch zoeken.

### De hele keten

`server.py` (nieuwe config-sleutel `text_improve_llm_model`) → `app.js`
(state, laden bij opstarten, doorgeven aan drie renderplekken van
`NotesTab`) → `NotesTab.js` (ontvangt `taskLlmModels`, geeft door aan
`NoteEditor`) → `NoteEditor.js` (pakt er `.textImprove` uit, geeft door als
`taskLlmModel`) → `VimEditor.js` (val-terug-logica:
`modelOverride || taskLlmModel || llmModel`) → `VaultSettings.js` (de
instellingen-UI zelf, derde rij in "Model per taak").

**Bewust andere val-terug-tekst dan bij Afbeeldingen/Semantisch zoeken**:
die twee vallen NIET terug op het hoofdmodel (om goede redenen, eerder
toegelicht). Tekstverbetering valt wél terug op het hoofdmodel — logisch,
want elk chat-model kan tekst herschrijven, in tegenstelling tot
vision-taken of embeddings. De instellingen-UI toont daarom
"— Automatisch (hoofdmodel) —" i.p.v. een specifiek lokaal standaardmodel.

### Bijgevangen tijdens het doortrekken van de keten

Twee keer per ongeluk een prop weggehaald bij een `str_replace`
(`isMobile`/`isDesktop`/`isTablet`/`splitMode` in zowel `app.js` als
`NotesTab.js`) — beide direct opgemerkt en hersteld.

### Getest

- Volledige keten-verificatie: elke schakel (config-sleutel → state →
  doorgeven → ontvangen → val-terug-logica → UI-rij) expliciet nagelopen
  met `grep`, klopt op elk niveau.
- `node --check`/`py_compile` op alle zes bestanden geslaagd.
- Regelaantal-vergelijking met de originele bestanden: alle verschillen
  positief en verklaarbaar (nieuwe code), geen tekenen van onbedoeld
  verwijderde stukken.

### Wat te kopiëren

Alle zes: `server.py`, `app.js`, `NotesTab.js`, `NoteEditor.js`,
`VimEditor.js`, `VaultSettings.js`.

---

## Update: AI-tekstverbetering werkt nu ook in INSERT-mode

**Gewijzigd:** alleen `VimEditor.js`.

### Bevestigd probleem

`\a` bleek inderdaad alleen te werken in NORMAL/VISUAL-mode — INSERT-mode
heeft een eigen, apart afgehandeld toetsenbord-blok dat altijd eerder
`return`t, en `\` moet daar natuurlijk gewoon een letterlijk backslash-teken
kunnen typen (kan dus nooit een commando-toets zijn zolang je aan het typen
bent).

### De fix

Nieuwe sneltoets **Cmd/Ctrl+I** ("Improve"), afgehandeld nog vóór de
mode-specifieke blokken — werkt dus in NORMAL, VISUAL én INSERT.
- Met een actieve selectie: gebruikt die.
- Zonder selectie: valt automatisch terug op de **huidige alinea**
  (contiguë niet-lege regels rond de cursor) — zodat je gewoon kunt
  doortypen en meteen AI-hulp kunt vragen zonder eerst naar VISUAL-mode te
  hoeven.

`\a` blijft gewoon bestaan als alternatief voor wie liever vanuit
NORMAL/VISUAL werkt.

**Onderweg gevonden en vermeden:** de aanvankelijk voorgestelde combinatie
Cmd/Ctrl+K bleek al bezet (split-scherm-navigatie, "focus-left") — had
die functie stilzwijgend gebroken. Volledige inventarisatie van alle
bestaande Ctrl-toetscombinaties gedaan voor ik een echt vrije koos.

**Bijgevangen:** de sectie-header in het hulpscherm gebruikte nog een
hardgecodeerde lichte kleur (`#a8d8f0`) — hetzelfde categorie contrast-bug
die ik eerder dit gesprek in andere bestanden fixte. Nu `W.blue`
(thema-bewust).

### Getest

- `getCurrentParagraphRange`: 6 scenario's (midden van een alinea,
  enkele-regel-alinea, document-begin, document-einde, lege regel) — alle
  grenzen kloppen exact.
- Volledige inventarisatie van bestaande Ctrl/Cmd-toetscombinaties in het
  bestand — bevestigd dat Cmd/Ctrl+I nergens anders gebruikt wordt.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `VimEditor.js`.

---

## Update: AI-menu-contrast gefixt + muis-sleep-selectie toegevoegd

**Gewijzigd:** alleen `VimEditor.js`.

### 1. Lichtblauw contrast in het AI-actiemenu

Zelfde categorie bug als eerder deze sessie in `Graph.js`/`Whiteboard.js`
gevonden, maar hier nog niet toegepast op de nieuw gebouwde AI-menu-UI.
Concreet nagerekend: de tekstkleur `#a8d8f0` gaf op de popup-achtergrond
maar **1.07–1.21:1** contrast (de achtergrond zelf was prima licht genoeg
— dat was dus niet het probleem). Alle 5 instanties vervangen door
`W.blue` (thema-bewuste donkere tint) → nu **7.94–8.96:1**.

Ook de randen van het menu waren te vaag (1.14–1.18:1 tegen de norm van
3:1 voor niet-tekstuele elementen) — nu een gedeelde, thema-bewuste
`aiBorder`/`aiBorderSoft` ingevoerd en overal in het AI-menu + de
onderste AI-balk toegepast (6.9:1+ op crème).

### 2. Muis-sleep-selectie (nieuw)

Bevestigd: deze editor had inderdaad geen enkele vorm van sleep-om-te-
selecteren — alleen `v` + toetsenbord-bewegingen in NORMAL-mode. Nu
toegevoegd: sleep met de muis (in élke mode, ook INSERT) start automatisch
een VISUAL-mode-selectie, die live meebeweegt terwijl je sleept. Een kleine
bewegingsdrempel (4px) voorkomt dat een gewone, licht trillende klik al
per ongeluk een selectie start. Na het loslaten blijft de selectie actief
— meteen te gebruiken voor Cmd/Ctrl+I (AI-hulp), `\a`, kopiëren, etc.,
want het hergebruikt volledig de al bestaande VISUAL-mode-infrastructuur.

**Over "cursor plaatsen werkt niet in INSERT-mode":** de code bevestigt dat
dit onvoorwaardelijk werkt, ongeacht mode (geen wijziging nodig). Vermoeden:
dit werd getest terwijl het AI-menu nog open stond — de full-screen
achtergrond daarvan onderschept dan een klik om het menu te sluiten (bedoeld
gedrag voor een modal), niet om de cursor te verplaatsen. Laat het weten als
het probleem zich ook vóórdoet met het menu dicht.

### Getest

- Contrastberekening vóór/na voor zowel tekst (1.07→8.96:1) als rand
  (1.18→3.36:1 bij 60% dekking).
- Sleep-drempel-logica: 4 scenario's (kleine trilling, bewuste sleep, exact
  op de grens, ruim eronder) — allemaal correct.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `VimEditor.js`.

---

## Update: muisklikken werkten helemaal niet in de editor — écht gevonden

**Gewijzigd:** alleen `VimEditor.js`.

### De oorzaak — een ontwerp-conflict, geen toevallige bug

De diagnose-logging bevestigde het meteen: **elke** klik landde op een
`<input>`-element, nooit op de canvas — ongeacht de kliklocatie. Dat
onzichtbare invoerveld (vangt toetsaanslagen af, want een canvas kan geen
native toetsenbord-focus krijgen) ligt met opzet **bovenop de volledige
canvas** (`width:100%, height:100%, position:absolute, zIndex:1,
pointerEvents:"auto"`) — de code-comment zegt letterlijk waarom: *"boven de
canvas zodat taps de input bereiken"*. Dit is een bewuste iOS-workaround
(sommige mobiele browsers tonen het toetsenbord alleen bij een groot,
daadwerkelijk tikbaar invoerveld) — maar op desktop betekent het dat dit
veld **elke muisklik onderschept** vóór die de canvas kan bereiken. Muis-
cursor-positionering en de net gebouwde sleep-selectie waren dus al deze
hele tijd structureel onbereikbaar, los van alle eerdere fixes.

### De fix

Dezelfde klik-afhandeling nu **ook** rechtstreeks op het invoerveld zelf
gekoppeld — niet als vervanging, als aanvulling. Werkt correct ongeacht
welk van de twee overlappende elementen de klik daadwerkelijk ontvangt: de
positieberekening gebruikt toch al `canvas.getBoundingClientRect()`, en
canvas + invoerveld beslaan exact hetzelfde vlak. Canvas en invoerveld zijn
bovendien broers/zussen (geen ouder-kind-relatie), dus er is geen risico op
dubbele afvuring van dezelfde klik.

### Getest

- Diagnose-logging (nu weer verwijderd) bevestigde exact de oorzaak: elke
  klik consequent op `INPUT`, nooit op de canvas.
- DOM-structuur nagelopen: canvas en invoerveld zijn directe kinderen van
  dezelfde wrapper — bevestigd geen ouder-kind-relatie, dus geen dubbele
  afvuring mogelijk.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `VimEditor.js`.

---

## Update: semantisch zoeken in PDF's (onderzoek + implementatie, deel 1 van het voorstel)

**Gewijzigd:** `server.py`, `app.js`, `SemanticSearch.js`, `PDFViewer.js`.

Bouwt voort op de onderzoeksfase (chunking-strategieën nagezocht — o.a.
NVIDIA's 2024-benchmark, die pagina-niveau-chunking als sterke default
voor gepagineerde documenten aanwijst). Hergebruikt bewust de al bestaande
PDF-tekst-extractie (`pdf_indexer.py` → `.zettelkasten_pdf_index.json`) en
de al bestaande embedding-infrastructuur (Ollama `/api/embeddings`,
hybride cosine+BM25+RRF-fusie) — geen nieuwe extractie-pijplijn nodig.

### Server (`server.py`)

- Nieuwe opslag: `.zettelkasten_pdf_embeddings.json`, los van notitie-
  embeddings (andere sleutelvorm: `bestand::pagina::chunk-index`)
- `_chunk_pdf_page()` — pagina-niveau als basis, alleen ongebruikelijk
  lange pagina's verder gesplitst (recursief op regelgrenzen, met overlap)
- `_iter_pdf_chunks()` — gedeelde helper zodat opbouwen én doorzoeken
  exact dezelfde chunk-indeling gebruiken
- Nieuwe endpoint `/api/semantic/embed-pdfs` — batch-gewijs, server bepaalt
  zelf wat ontbreekt (client hoeft niks bij te houden)
- `/api/semantic/search` uitgebreid met hetzelfde hybride cosine+BM25+RRF-
  patroon over PDF-chunks, met deduplicatie per pagina
- `/api/semantic/status` uitgebreid met PDF-indexeringscijfers

### Client (`SemanticSearch.js`, `app.js`, `PDFViewer.js`)

- Nieuwe "📄 PDF's indexeren"-sectie naast de bestaande notitie-index-UI
- Zoekresultaten tonen nu een aparte PDF-sectie (bestandsnaam + pagina +
  fragment), naast de bestaande notitie-resultaten
- Klikken op een PDF-resultaat opent het PDF direct op de juiste pagina —
  hergebruikt het bestaande `pendingScrollRef`-scroll-mechanisme
  (`openPdfName`/`openPdfPage` als nieuwe, parallelle state in `app.js`)

### Bijgevangen (niet stilzwijgend meegefixt, hier gemeld)

- **Bestaande bug in de notitie-indexering**: `buildIndex()` in
  `SemanticSearch.js` leest `status.ids`, maar `/api/semantic/status`
  stuurt dat veld nooit mee — "alleen ontbrekende indexeren" werkt
  daardoor in de praktijk niet (behandelt alles als ontbrekend). De nieuwe
  PDF-indexering heeft dit probleem niet (server bepaalt het verschil
  zelf), maar de bestaande notitie-versie is dus nog steeds gebrekkig.
- **Bestaande bug in `ReadingList`'s `onOpenPdf`**: navigeert naar tab-id
  `"pdfs"` (meervoud), terwijl de daadwerkelijke tab-id `"pdf"` is
  (enkelvoud, bevestigd bij de tab-definitie) — "PDF openen" vanuit de
  Leeslijst doet vermoedelijk niets.

### Getest

- `_chunk_pdf_page()`: 4 scenario's (normale/lege/lange pagina met
  overlap-check, geen regels)
- RRF-fusie + per-pagina-deduplicatie: los gesimuleerd, correcte
  volgorde en geen dubbele pagina's
- Page-key-type-consistentie gefixt (str vs int bij niet-geëmbedde chunks)
- Volledige end-to-end-simulatie: chunk-detectie → todo-bepaling voor de
  index-opbouw, inclusief het correct overslaan van lege pagina's
- Keten-verificatie door alle vier bestanden (prop-doorgifte van
  `SemanticSearch` tot in `PDFViewer`'s `loadPdf`)
- `py_compile`/`node --check` op alle vier bestanden geslaagd

### Wat te kopiëren

Alle vier: `server.py`, `app.js`, `SemanticSearch.js`, `PDFViewer.js`.

---

## Update: ReadingList's "PDF openen"-bug gefixt

**Gewijzigd:** alleen `app.js`.

De eerder gemelde bug bleek dubbel gebroken: `onOpenPdf: name=>{ setTab("pdfs"); }`
navigeerde niet alleen naar een niet-bestaande tab-id (`"pdfs"`, moet
`"pdf"` zijn), maar gebruikte de meegegeven `name` (welk PDF-bestand)
ook helemaal niet — er werd alleen van tab gewisseld, zonder ooit het
specifieke PDF te openen.

**Fix:** hergebruikt hetzelfde `openPdfName`-mechanisme dat al voor
BookLibrary en de nieuwe semantische-PDF-zoekresultaten gebruikt wordt —
`onOpenPdf: name=>{ setOpenPdfName(name); setTab("pdf"); }`. Lost beide
problemen in één keer op: juiste tab-id, én het aangeklikte PDF wordt ook
daadwerkelijk geopend.

### Getest

- Bevestigd dat `setOpenPdfName` binnen dezelfde `App`-component valt als
  waar de fix staat (closure-toegang correct).
- Nagegaan dat `openPdfPage` hierbij bewust niet wordt aangeraakt — zelfde
  patroon als de al bestaande, werkende BookLibrary-aanroep; `onOpenPdfConsumed`
  zet die waarde na elke PDF-opening altijd terug naar `null`, dus geen
  risico op een verouderde paginawaarde vanuit een eerder semantisch-
  zoeken-resultaat.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `app.js`.

---

## Update: laatste openstaande bug gefixt — "Index bijwerken" indexeerde altijd alles

**Gewijzigd:** alleen `server.py`.

De client-code (`SemanticSearch.js`) was hier zelf al correct geschreven —
`const indexed = new Set(Object.keys(status.ids || {}))` filtert prima
áls het veld er is. Het probleem zat puur aan de serverkant:
`/api/semantic/status` stuurde `ids` nooit mee, dus dat veld was altijd
`undefined` → lege Set → elke notitie werd als "ontbrekend" gezien, ook
notities die al lang geïndexeerd waren.

**Fix:** `ids` toegevoegd aan de status-respons, als **object** (niet als
lijst) — `{k: 1 for k in store}` — belangrijk, want de client leest dit
met `Object.keys()`, wat op een JSON-array de indices (0,1,2…) zou
teruggeven in plaats van de echte notitie-ID's.

### Getest

- Concreet gesimuleerd: vóór de fix gaf een 5-notities-vault met 3 al
  geïndexeerd altijd "5 te indexeren" terug; na de fix correct "2 te
  indexeren" (alleen de echt nieuwe).
- `py_compile` geslaagd.

### Wat te kopiëren

Alleen `server.py`.

---

**Status: alle in deze sessie gevonden bugs zijn nu opgelost.**

---

## Update: offline-knop bleek onbereikbaar — nu echt in de zichtbare bibliotheek

**Gewijzigd:** alleen `PDFViewer.js`.

### De oorzaak — mijn eigen eerdere antwoord was fout

Ik had eerder de `⬇ Offline`-knop en `cachePdfOffline()`/`removePdfOffline()`
gevonden en beschreven als bestaande functionaliteit — zonder te
controleren of het component waar die knop in zit (`PDFUploadPanel`) ook
daadwerkelijk ergens gerenderd wordt. Bleek van niet: `PDFUploadPanel`
wordt in de hele codebase nooit aangeroepen — dode code. De écht
zichtbare bibliotheek (grid- en lijstweergave) had alleen een
"Offline"-**filterpil** (om te filteren op wat al offline stond), maar
geen enkele knop om een PDF daadwerkelijk offline te zétten. Vandaar dat
de knop niet te vinden was — hij bestond simpelweg niet in de zichtbare UI.

### De fix

De knop toegevoegd aan de **echte, actieve** `PDFViewer`-component — in
zowel de grid- als de lijstweergave, naast de bestaande Open/Verwijder-
knoppen. Hergebruikt de al correct geïmplementeerde
`cachePdfOffline()`/`removePdfOffline()`-functies en de al bestaande,
actieve `offlinePdfs`-state (regel 578) — dus geen nieuwe logica, alleen
het zichtbaar maken van wat er al (correct) achter de schermen stond.

**Bijgevangen:** `PDFUploadPanel` blijft als dode code in het bestand
staan (niet verwijderd — dat was niet gevraagd en buiten scope van deze
fix) — het is verder onschadelijk zolang het nooit gerenderd wordt, maar
wel iets om op te ruimen bij een volgende opschoonronde.

### Getest

- Bevestigd dat de nieuwe knoppen binnen de juiste component vallen (de
  actieve `PDFViewer`, regel 445+, niet de dode `PDFUploadPanel`) —
  geen naamconflict met diens eigen, ongebruikte `offlinePdfs`-state.
- Knop-label en tooltip voor alle 4 combinaties (grid/lijst ×
  offline/niet-offline) los doorgerekend — correct.
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `PDFViewer.js`.

---

## Update: app startte niet op zonder serververbinding — écht gevonden en gefixt

**Gewijzigd:** alleen `service-worker.js`.

### De oorzaak

`index.html` laadt `app.js` en alle `/modules/*.js`-bestanden met een
cache-busting-querystring (`?v=<timestamp>`, bv.
`app.js?v=1786475863`). De service worker cachet deze bestanden bij
installatie echter onder hun **kale pad** (zonder querystring). De Cache
API matcht standaard op de **volledige URL inclusief querystring** — dus
`caches.match(req)` voor een aanvraag mét `?v=...` vond de precachede
kale-pad-versie nooit.

Concreet gevolg: zodra de server onbereikbaar is, faalt de netwerk-
aanvraag (bedoeld, met een timeout van 2,5s als vangnet), maar de
daaropvolgende cache-fallback sloeg altijd mis — voor zowel `app.js` als
élke losse module. Dat betekent: de kern-app-code laadt dan helemaal niet,
wat precies verklaart waarom de app niet opstartte zonder
serververbinding.

Onderweg ook nog gevonden: `SRS.js` (het FSRS-herhaalalgoritme) werd door
`index.html` geladen maar stond niet in de precache-lijst — apart van de
querystring-bug, gewoon een ontbrekende regel.

### De fix

Cache-sleutel genormaliseerd naar het kale pad (zonder querystring) bij
zowel het **opslaan** als het **opzoeken** in de app-code-tak van
`cacheFirstWithNetwork()`. Los voordeel: dit voorkomt ook dat er bij elke
nieuwe deploy een nieuwe, nooit-opgeruimde cache-entry bijkomt onder de
nieuwe timestamp — er blijft nu steeds precies één, actuele entry per
bestand bestaan.

`SRS.js` toegevoegd aan de precache-lijst. SW-versie opgehoogd naar v25
zodat bestaande installaties de gefixte worker ook daadwerkelijk oppikken.

### Getest

- Kruisvergelijking tussen alle modules die `index.html` laadt en de
  service-worker-precache-lijst — bevestigde `SRS.js` als enige echte
  ontbrekende regel.
- Bevestigd dat vendor-bestanden (React, PDF.js) dit probleem niet hadden
  — die worden server-side zonder querystring gesubstitueerd.
- Bevestigd dat `serveAppShell()` (voor de HTML-navigatie zelf) dit
  probleem ook niet had — geen cache-busting-querystring op
  navigatie-aanvragen.
- URL-matching-logica concreet gesimuleerd: vóór de fix nooit een match
  tussen precache-sleutel en een aanvraag mét querystring; na de fix
  altijd een match, én bevestigd dat twee verschillende deploy-timestamps
  na normalisatie dezelfde cache-sleutel delen (geen cache-opeenhoping).
- `node --check` geslaagd.

### Wat te kopiëren

Alleen `service-worker.js`. **Let op:** gebruikers moeten de pagina
minimaal één keer laden terwijl de server bereikbaar is, zodat de nieuwe
service worker (v25) zich kan installeren en de app-code onder de
gecorrigeerde cache-sleutel opnieuw kan opslaan — pas daarna werkt volledig
offline opstarten.

### Wat nog niet gecontroleerd is

Deze fix lost de kern-oorzaak op die het meest overeenkomt met "app start
niet op". Ik heb niet elk denkbaar offline-scenario end-to-end getest (dat
vereist een échte browser/Service-Worker-omgeving, die ik hier niet heb).
Mocht de app na deze fix nog steeds niet volledig offline werken, hoor ik
dat graag — dan zoek ik gericht verder.

---

## Update: PDF-offline-knop toonde altijd succes, ook bij een mislukte download

**Gewijzigd:** alleen `PDFViewer.js`.

### Onderzoek

Eerst het hele mechanisme nagetrokken: knop → `cachePdfOffline()` →
service-worker-bericht `CACHE_PDF` → `cacheOfflinePdf()` (download +
opslag in de `PDF_CACHE`) → en apart de leesroute bij het openen van een
PDF (`PDFService.fetchPdfBlob()` → SW-fetch-handler → `cachePdfFile()`,
die de cache checkt vóór een netwerkaanvraag).

**URL-consistentie bevestigd, geen mismatch-bug** (zoals eerder bij
`app.js`/modules): `pdfService.js`'s `fetchPdfBlob()` gebruikt exact
dezelfde URL-constructie (`/api/pdf/${encodeURIComponent(name)}`) als
`cachePdfOffline()` — dit deel van de keten was dus al correct.

### De echte oorzaak

De knop zelf (die ik in een eerdere sessie toevoegde) deed
`await cachePdfOffline(p.name)` en toonde daarna **altijd** "✓ Offline" —
zonder ooit te controleren of het resultaat `{ok: true}` of `{ok: false,
error: ...}` was. Bij een mislukte download (bv. een netwerkhapering
tijdens het downloaden, of de server die net op dat moment niet
bereikbaar was) gaf de service worker netjes `{ok: false, error: "..."}`
terug — maar de `await` gooide daar geen fout op (het is een normale
resolve, geen reject), dus de `catch`-blok werd nooit aangeroepen en de
knop toonde ten onrechte succes. Precies dit verklaart "ik dacht dat er
iets gebeurde" — de PDF stond in werkelijkheid nooit in de cache.

### De fix

Het resultaat van `cachePdfOffline()` wordt nu expliciet gecontroleerd
(`if (!result?.ok) throw new Error(...)`) — bij een mislukking verschijnt
nu een eerlijke ⚠-foutmelding met de daadwerkelijke reden, in plaats van
een vals ✓. Gefixt op beide plekken waar de knop staat (raster- en
lijstweergave).

### Getest

- URL-constructie van `fetchPdfBlob()` (leesroute) vergeleken met
  `cachePdfOffline()` (schrijfroute) — identiek, dus geen mismatch-bug
  zoals bij `app.js`.
- Beide scenario's (mislukte download / geslaagde download) concreet
  gesimuleerd: vóór de fix toonde de knop in beide gevallen ✓, na de fix
  correct onderscheid tussen ✓ (echt gelukt) en ⚠ met foutmelding
  (mislukt).
- `node --check` geslaagd.

### Wat te doen

Vervang `PDFViewer.js`. **Belangrijk:** PDF's die je met de oude,
gebrekkige knop "offline" leken te hebben gezet, staan waarschijnlijk niet
echt in de cache — zet ze na deze update opnieuw offline terwijl je
verbinding hebt, en let nu op een eventuele ⚠-foutmelding.

### Wat te kopiëren

Alleen `PDFViewer.js`.
