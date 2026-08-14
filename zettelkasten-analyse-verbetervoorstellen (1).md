# Analyse & verbetervoorstellen — Zettelkasten VIM app

*Stand van zaken augustus 2026 — gebaseerd op de ontwikkelhistorie tot en met sessie 30+*

---

## 1. Uitgangspunt

De app heeft zich ontwikkeld van een basale notitie-tool naar een volwaardig persoonlijk kennissysteem: dagnotities met quick-entry, een inbox-naar-Zettelkasten workflow, spaced repetition (SM-2), semantisch zoeken via lokale embeddings, een PDF/annotatie-hub, een boekenbibliotheek, en een LLM-notebook op Ollama. Dat is een breed en samenhangend feature-landschap — precies het punt waarop het de moeite waard is om niet alleen door te bouwen, maar ook terug te kijken: sluiten de onderdelen op elkaar aan, of zijn het losse eilandjes die toevallig in dezelfde vault leven?

Deze analyse bekijkt drie lagen — UI/UX, workflow-integratie, en functionaliteit — en sluit af met een literatuuronderzoek naar wat er in 2026 speelt in de PKM/Zettelkasten-wereld, met concrete aanknopingspunten voor de app.

---

## 2. UI/UX-analyse

### 2.1 Wat sterk staat
- De QuickEntryBar (·/☐/💡) verlaagt de frictie van vastleggen tot bijna nul — dat is precies waar de meeste PKM-systemen op stuklopen (zie §5.2).
- Het Graphite-thema is recent bijgesteld voor WCAG AA-contrast — een teken dat toegankelijkheid al meeweegt.
- Bionic reading is als optionele modus geïmplementeerd, niet afgedwongen — dat is verstandig gegeven wat het onderzoek laat zien (§5.4).

### 2.2 Knelpunten en voorstellen

**a. Versnipperde entry points naar dezelfde informatie**
Er zijn nu los van elkaar: DailyView, InboxProcessor, OpenTasksPanel, ReviewPanel, PDF-hub, BookLibrary en LLMNotebook. Elk is voor zich goed ontworpen, maar er lijkt geen centrale "vandaag"-of "start hier"-view te zijn die samenvat: openstaande taken, vervallen reviews, ongereviewede inbox-items, en recente activiteit. Voorstel: een **Dashboard/Command Center**-tabblad dat deze vier signalen samenvoegt tot een enkele ochtend-checklist. Dit is ook waar veel 2026-PKM-tools (Atlas, Notion AI-agent) naartoe bewegen — niet meer "zoek het zelf bij elkaar", maar een systeem dat proactief samenvat wat aandacht nodig heeft.

**b. Promotie-dialoog (inbox → ZK) als enige frictiepunt in een verder frictieloze keten**
De inbox-promotie vraagt om tags via een overlay-dialoog. Dat is precies het moment waar mensen afhaken (het bekende "ik zet het wel later om"-effect). Voorstel: tag-suggesties automatisch voorstellen op basis van de semantische index (die er al is voor SemanticSearch) — de gebruiker hoeft dan alleen te bevestigen, niet te bedenken.

**c. Graph-achtige navigatie ontbreekt (of is niet in de sessielog terug te vinden)**
Er is geen vermelding van een visuele link-graaf. Voor een Zettelkasten is dat een gemis: juist het zien van clusters en onverwachte verbindingen is de kern van de methode. Zie §5.3 voor een kanttekening: een kale node-graaf zoals Obsidian's heeft een bewezen plafond rond ~500 notities. Het is de moeite waard dit meteen goed te doen in plaats van een simpele graaf te bouwen die later vervangen moet worden.

**d. Modelkeuzes en instellingen (ModelPicker, timeouts) zijn systeeminstellingen die in de gebruikersflow zichtbaar zijn**
600s timeouts en modelfilters zijn terecht technisch opgelost, maar het is de vraag of een gebruiker dit ooit hoeft te zien. Voorstel: een "Eenvoudig/Geavanceerd"-toggle in VaultSettings, zodat de LLM/embedding-configuratie standaard wegvalt.

---

## 3. Workflow-analyse

### 3.1 De centrale workflow-vraag
Luhmann's originele Zettelkasten had één cruciale eigenschap: het was niet alleen een opslagplaats, het was een **denkpartner** — het slip-box dwong hem voortdurend om nieuwe notities te relateren aan bestaande. De huidige app heeft de bouwstenen daarvoor (SemanticSearch, LLMNotebook, ReviewPanel) maar ze staan nog vooral naast elkaar in plaats van in elkaars verlengde.

### 3.2 Voorstellen

**a. "Verwante notities" als permanent zij-paneel tijdens het schrijven**
Op dit moment is SemanticSearch een aparte actie. Voorstel: laat het semantische-zoek-mechanisme continu meelopen terwijl je een permanente notitie schrijft of promoveert, en toon 3–5 verwante bestaande notities live. Dit is precies het CEQRC-patroon (Capture → Explain → Question → Refine → **Connect**) dat in actuele AI-Zettelkasten-implementaties opduikt — het verbinden wordt een ingebakken stap in plaats van een losse zoekactie achteraf.

**b. Van "review losse feiten" naar "review + herschrijf-suggestie"**
De ReviewPanel toont nu SM-2-kaarten met vier antwoordknoppen. Een rijkere workflow: wanneer een notitie na meerdere reviews stabiel blijkt (weinig "Again"), stel voor om hem te **verdichten tot een permanente notitie** of te linken aan een cluster — spaced repetition als signaal voor rijpheid van een idee, niet alleen als geheugentraining.

**c. Dagnotitie ↔ permanente notities: de brug is er, maar eenrichtingsverkeer**
Inbox → ZK werkt één kant op. Andersom — vanuit een permanente notitie terug een taak of vervolgvraag in de dagnotitie van vandaag zetten — lijkt niet aanwezig. Dat is een veelvoorkomend gat: goede PKM-workflows zijn round-trip (capture → distill → **express/act** → nieuwe capture).

**d. PDF-annotaties en Zettelkasten-notities zijn twee werelden**
De PDF-hub heeft een annotatie-teller, maar het is onduidelijk of annotaties zelf promoveerbaar zijn tot permanente notities zoals inbox-bullets dat zijn. Als dat nog niet zo is: dezelfde promotieflow (→ ZK-knop) hergebruiken voor annotaties zou de twee subsystemen laten samenvallen in plaats van parallel te bestaan.

---

## 4. Functionaliteit & integratie

**a. Typed links in plaats van alleen ongetypeerde links**
Zie het literatuuronderzoek (§5.3): platte graafweergaves lopen tegen een plafond aan omdat een link geen betekenis draagt. Een klein maar krachtig verschil: sta toe dat een link een type krijgt (bijv. *ondersteunt*, *weerspreekt*, *is voorbeeld van*, *vervolg op* — zoals in het `links: [{to, type}]`-patroon dat in actuele AI-Zettelkasten-projecten wordt gebruikt). Dat maakt latere queries mogelijk ("toon alle notities die dit weerspreken") zonder dat het een aparte database wordt.

**b. Hybride zoeken (semantisch + trefwoord) in plaats van alleen embeddings**
De huidige SemanticSearch-server rankt op TF-IDF voor context — dat is eigenlijk al een klassieke stap richting hybride zoeken. Voorstel om dit expliciet te maken: combineer de nomic-embed-text-vectorscore met een BM25/trefwoord-score (reciprocal rank fusion). Dat lost het bekende zwakke punt van pure vector-search op: exacte termen (een ADR-nummer, een productcode, een specifieke naam) die semantisch "wegzakken" tussen vergelijkbare tekst.

**c. Embedding-model heroverwegen**
`nomic-embed-text` is nog steeds een solide, lichte standaardkeuze, maar sinds begin 2026 zijn er sterkere lokale alternatieven met vergelijkbare voetafdruk: `bge-m3` (native hybride dense+sparse, multilingual, sterk voor Nederlands) en `qwen3-embedding` (flexibele dimensies). Voor een Nederlandstalige vault is `bge-m3` het overwegen waard, juist omdat het hybride zoeken (b) al in één model bakt.

**d. LLMNotebook koppelen aan MCP**
De app draait al lokaal via Ollama. Het Model Context Protocol is in 2026 het de-facto lichte protocol geworden om een lokale kennisbank aan een AI-assistent te koppelen. Een minimale MCP-server bovenop de bestaande `/api`-laag (read-only: zoeken, notitie ophalen) zou de vault ook bruikbaar maken vanuit andere tools (bijv. Claude Code) zonder dat de Zettelkasten-app zelf iets hoeft te kopiëren.

**e. Contextvenster-instelling expliciet zetten**
Een veelvoorkomende, makkelijk te missen bug in Ollama-gebaseerde RAG: het model-contextvenster staat standaard op 2048 tokens, ook als het onderliggende model (zoals nomic-embed-text) tot 8192 tokens aankan. Als LLMNotebook grotere contextchunks stuurt, is het de moeite waard `num_ctx` expliciet te controleren — een stille bottleneck die niet als foutmelding zichtbaar wordt, alleen als kwaliteitsverlies.

---

## 5. Literatuuronderzoek: relevante ontwikkelingen 2026

### 5.1 FSRS als opvolger van SM-2
De app gebruikt nu SM-2 voor spaced repetition. Sinds 2023 is **FSRS** (Free Spaced Repetition Scheduler, Jarrett Ye) de facto standaard geworden in de flashcard-wereld — Anki heeft het sinds versie 23.12 als default voor nieuwe profielen, en RemNote heeft het native ingebouwd. Het kernverschil: SM-2 werkt met één ease-factor per kaart die vooral omlaag kan bewegen (een kaart die eenmaal moeilijk was blijft vaak te vaak terugkomen); FSRS modelleert per notitie drie variabelen (*stability*, *difficulty*, *retrievability*) en voorspelt wanneer de kans op correcte herinnering onder een streefwaarde (bijv. 90%) zakt. Onafhankelijke analyses over honderden miljoenen reviews laten 20–30% minder reviews zien bij gelijke retentie. Voor de app betekent dit concreet: minder ReviewPanel-sessies voor hetzelfde effect, en betere intervallen voor notities die je aanvankelijk lastig vond maar inmiddels beheerst. FSRS is complexer en minder handmatig te tunen dan SM-2, maar er zijn compacte open-source implementaties (`py-fsrs`) die zich direct laten inpluggen op het bestaande `sr_data`-veld.

### 5.2 PKM-landschap 2026: van retrieval naar verbinding
De brede consensus in recente PKM-literatuur (medio 2026) is dat AI het *terugvinden* van notities vrijwel gratis heeft gemaakt — de schaarse waarde is verschoven naar het **verbinden** van ideeën. Dat is precies waar een Zettelkasten van oudsher sterk in is, en het verklaart waarom Zettelkasten-achtige structuur (atomaire notities + expliciete links) in 2026 weer aan populariteit wint, ook binnen AI-natievere tools. Een concreet patroon dat opduikt: **CEQRC** (Capture → Explain → Question → Refine → Connect) als expliciete AI-begeleide workflow rond het schrijven van een notitie — de LLM helpt niet alleen bij het opslaan, maar actief bij het verfijnen (Feynman-techniek) en verbinden. Dat sluit direct aan bij voorstel 3.2a.

Een tweede patroon: agentic gebruik van de eigen kennisbank via **MCP**, zodat een AI-assistent de vault kan doorzoeken zoals hij het open web doorzoekt — zie voorstel 4d.

### 5.3 Graafweergave: nuttig, maar met een bekend plafond
Onderzoek en praktijkervaring rond Obsidian's graph view (het meest gebruikte voorbeeld) laten een consistent patroon zien: de weergave is een correcte visualisatie van *welke notities naar welke linken*, maar draagt geen betekenis — er is geen "type" aan een link, en boven ruwweg 500 notities wordt de weergave visueel druk zonder informatiever te worden. De aanbeveling die daaruit voortkomt is niet "geen graaf bouwen", maar: bouw een graaf die query's ondersteunt (bijv. "toon alleen notities van type X die notitie Y ondersteunen") in plaats van alleen een force-directed plaatje. Dat is precies waarom voorstel 4a (typed links) hier direct aan vastzit — het is de investering die een latere graafweergave pas echt waardevol maakt.

### 5.4 Bionic reading: zwak onderbouwd, houd het optioneel
Onafhankelijk, gecontroleerd onderzoek (Snell, 2024, *Acta Psychologica*; Readwise, 2022, n>2000) vindt **geen significant effect** van bionic reading op leessnelheid of begrip — de eye-tracking data laat zien dat het oog nog steeds het hele woord verwerkt, ook als alleen het begin vetgedrukt is. Er is wel aanhoudende anekdotische steun van gebruikers met ADHD/dyslexie, mogelijk deels placebo, mogelijk omdat het een ankerpunt biedt bij visuele trackingproblemen. Conclusie voor de app: de huidige implementatie als **optionele** modus is de juiste keuze — er is geen reden om het uit te breiden of als standaard aan te zetten, en het is de moeite waard dit in de documentatie/instellingen ook eerlijk te framen ("kan helpen, bewijs is zwak") in plaats van het te verkopen als leesversneller.

### 5.5 Lokale RAG: hybride zoeken is inmiddels de standaardaanbeveling
De actuele consensus (2026) voor lokale RAG-stacks op Ollama is: combineer dense (embedding) search met sparse (BM25/trefwoord) search via reciprocal rank fusion — pure vectorzoektocht mist exacte termen (foutcodes, namen, ADR-nummers) die semantisch niet naast vergelijkbare tekst staan. Voor embeddingmodellen is `nomic-embed-text` nog steeds de meest gebruikte lichte standaard (het meest gepulde embedding-model op Ollama), maar `bge-m3` wordt nu vaak aanbevolen wanneer hybride dense+sparse uit één model gewenst is, en is sterk multilingual — relevant voor een Nederlandstalige vault. Dit onderbouwt voorstel 4b/4c direct.

---

## 6. Prioritering (voorstel)

| Prioriteit | Voorstel | Type werk |
|---|---|---|
| Hoog | Tag-suggesties bij inbox-promotie (2.2b) | Kleine uitbreiding, hergebruikt bestaande index |
| Hoog | Hybride zoeken: BM25 + embeddings via RRF (4b) | Server-side, geen nieuwe UI nodig |
| Hoog | FSRS naast/in plaats van SM-2 (5.1) | Losse module, `sr_data`-schema blijft grotendeels intact |
| Middel | Typed links in het notitie-schema (4a) | Schemawijziging, backwards-compatible te maken |
| Middel | "Verwante notities"-zijpaneel tijdens schrijven (3.2a) | UI + hergebruik SemanticSearch |
| Middel | Dashboard/Command Center-tabblad (2.2a) | Nieuwe view, aggregeert bestaande data |
| Laag | Graafweergave (bouw pas ná typed links) (2.2c) | Grotere UI-investering |
| Laag | MCP-server bovenop `/api` (4d) | Nieuw, geen directe UI-impact |
| Laag | `num_ctx`-check in LLMNotebook (4e) | Kleine fix, laag risico maar makkelijk te vergeten |

---

## Bronnen (literatuuronderzoek)
- Migaku — *Spaced Repetition in 2026: How It Actually Works*
- Expertium — *FSRS/SM-2 Benchmark*
- Glasp — *Personal Knowledge Management (PKM): Complete Guide*
- Storyflow — *What Is Personal Knowledge Management (PKM)? (2026)*
- GitHub (joshylchen) — *zettelkasten: AI-powered CEQRC workflow*
- Snell, J. (2024) — *No, Bionic Reading does not work*, ResearchGate/Acta Psychologica
- Readwise Blog (2022) — *Does Bionic Reading actually work?*
- KnodeGraph — *8 Obsidian Graph View Alternatives, Compared (2026)*
- D-Central — *Best Local Embedding Models for RAG (2026)*
- Morphllm — *Ollama RAG: Build a Private Retrieval Pipeline (2026)*
- Markaicode — *Ollama Hybrid Retrieval Architecture (2026)*
