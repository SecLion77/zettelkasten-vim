# UX-onderzoek — natuurlijke workflow & cross-device (laptop + iPad)

*Augustus 2026 — vervolg op de eerdere analyse, dit keer gebaseerd op daadwerkelijke
inspectie van `VimEditor.js`, `PDFViewer.js`, `BookLibrary.js`, `AnnotationsPanel.js`,
`OutlineEditor.js` en `NoteEditor.js`, niet op documentatie of aannames.*

---

## 0. Uitgangspunt van dit onderzoek

Jouw kernvraag: is er een **natuurlijke workflow** rond drie activiteiten —
1. **Schrijven** — makkelijk een notitie kunnen maken
2. **Onderzoeken** — zoeken/verbinden binnen de kennisdatabase terwijl je schrijft
3. **Lezen & highlighten** — met name op de iPad, maar hetzelfde moet ook op laptop kunnen

— en dat alles **volledig lokaal**, laptop + iPad via wifi naar dezelfde server, geen cloud.

Dit is geen speculatief stuk: elke bevinding hieronder is terug te voeren op een
specifieke regel code. Waar ik iets niet kon verifiëren zonder een aanname te
maken, staat dat expliciet als open vraag aan het eind.

---

## 1. Schrijven: VimEditor

### 1.1 Wat je hebt gebouwd
`VimEditor.js` is geen "vim-achtige sfeer" — het is een **volledig modale
Vim-implementatie** op canvas: NORMAL/INSERT/COMMAND/SEARCH-modi, `hjkl`-achtige
navigatie, `:w`/`:wq`, visual mode, undo-stack, macro's. Dat is een indrukwekkende
hoeveelheid zelfgebouwde editor-techniek — en voor jou als Vim-gebruiker op de
laptop waarschijnlijk precies waarom schrijven al soepel aanvoelt.

### 1.2 Wat al goed is opgevangen voor touch
Dit verraste me positief: de touch-handling is **niet** een vergeten bijzaak.
- Bij een **tap** op canvas gaat de editor altijd direct naar INSERT-mode
  (`onTouchStart` → `setMode("INSERT")` onvoorwaardelijk) — heel anders dan bij
  een muisklik, waar alleen een dubbelklik dat doet. Dat is precies de juiste
  aanpassing: op iPad verwacht niemand dat "modaal typen" eerst een `i` vereist.
- Er zit een verborgen `<input>`-laag boven de canvas, specifiek getuned voor
  iOS-eigenaardigheden: niet `readOnly` (want iOS weigert dan het toetsenbord),
  `opacity:0.001` (niet 0, want iOS negeert volledig onzichtbare inputs),
  `fontSize:16px` (voorkomt iOS auto-zoom), en een `onCompositionEnd`-handler
  voor IME/autocorrect-tekst. Dit is doelbewust engineering, geen toeval.

### 1.3 Waar de modale aard tóch wringt op iPad
- Er is **geen enkele on-screen knop** om van INSERT terug naar NORMAL te gaan
  (geen `Escape`-equivalent in de UI). Op een laptop druk je Esc; op een kaal
  scherm-toetsenbord bestaat die toets niet. Praktisch gevolg: zodra je op de
  iPad via een tap in INSERT-mode zit, kun je vim-commando's (zoeken met `/`,
  `dd`, macro's, `:`-commando's) niet meer bereiken tenzij je een fysiek
  toetsenbord aansluit (Magic Keyboard/Smart Keyboard hébben wél een Esc-route).
  **Zonder fysiek toetsenbord ben je op de iPad dus effectief altijd in
  INSERT-mode** — dat is voor kale tekst-invoer prima, maar de kracht van de
  Vim-laag (waar duidelijk veel in geïnvesteerd is) is dan onbereikbaar.
- Conclusie: dit is waarschijnlijk **geen bug maar een bewuste asymmetrie** —
  laptop = volledige Vim-kracht, iPad = vereenvoudigde tekst-invoer. Dat is een
  redelijke afweging, maar het is de moeite waard om het exp­liciet te maken
  i.p.v. impliciet te laten (zie voorstel 1 hieronder).

### 1.4 OutlineEditor als touch-vriendelijk alternatief
`OutlineEditor.js` (aan te zetten via de "☰ outline"-knop) is een gewone
`<textarea>` met Tab/Shift+Tab-indentatie en auto-bullet op Enter — dit is
al **niet** modaal en dus meteen prettig op touch. Dit bestaat dus al als
ontsnappingsroute uit Vim-modaliteit, maar het is een verstopte knop in de
toolbar, niet iets dat de app je aanbiedt als je op een touch-apparaat zit.

---

## 2. Onderzoeken: verbinden tijdens het schrijven

Dit deel is dit najaar al flink versterkt (vorige sessies): `SmartLinkSuggester`
+ `LinksSidebar` geven live verwante notities tijdens het schrijven, met
getypeerde links; hybride zoeken (BM25+embeddings) vindt ook exacte termen die
embeddings zouden missen. Dat deel van de workflow is inmiddels sterk.

**Wat hier nog ontbreekt, gezien je iPad-scenario:** deze "onderzoeksfunctie"
zit in de note-editor-flow. Terwijl je een PDF **leest** op de iPad (waar veel
van het echte denkwerk gebeurt — een passage lezen en meteen willen weten of
je hier al iets over hebt), is er **geen toegang tot SmartLinkSuggester of
zoeken in je eigen notities** vanuit `PDFViewer.js` — zie §3.3.

---

## 3. Lezen & highlighten: PDFViewer

### 3.1 Wat al goed werkt, cross-device
- Tekstselectie → highlight is voor **beide** platforms apart geïmplementeerd:
  desktop leunt op het normale `mouseup`-event na selectie; voor iOS is er een
  losse `selectionchange`-listener die een zwevende actieknop toont (want
  Safari op iOS vuurt `mouseup` niet betrouwbaar na een tekstselectie). Dat is
  weer bewuste, correcte platform-specifieke engineering, geen toeval.
- **Vijf highlight-kleuren met ingebouwde betekenis**: geel=citaat,
  blauw=**bron**, rood=**kritisch**, groen=**eigen**, paars=vraag. Die drie
  vetgedrukte labels zijn exact de drie lagen die `AnnotationsPanel.js`
  verwacht (`[tekst]{.bron}` etc.) — de kleurkeuze bij het highlighten draagt
  dus al precies de juiste betekenis in zich.
- Highlights zijn **per stuk** (niet alleen in bulk) om te zetten naar een
  volwaardige notitie via een "+ notitie"-knop, mét automatische backlink naar
  de bron-PDF (`[[bestandsnaam]]`). Er is ook een bulk-knop "⬆ Alle highlights
  als notitie". Dat is een prettige, lichte workflow.

### 3.2 De ontbrekende schakel: kleur draagt betekenis, maar die betekenis gaat verloren bij export
Dit is de meest concrete bevinding uit dit onderzoek. Elke highlight-kleur
heeft al een `layer`-veld (`"bron"`/`"kritisch"`/`"eigen"`/`null`) klaarstaand
in de data. Maar de code die een highlight omzet naar notitie-inhoud gebruikt
dat veld **niet**:

```js
content: "> " + (h.text||"") + (h.note?"\n"+h.note:"") +
         "\n\n---\n*Bron: [[" + stem + "]], p." + h.page + "*"
```

Dit is een platte blockquote — geen `[tekst]{.bron}`-markup. Het gevolg: een
notitie die ontstaat uit een blauw (bron-)highlight of een rood
(kritisch-)highlight verschijnt **nooit** in `AnnotationsPanel.js`, ook al is
de betekenis (welke laag) op het moment van highlighten al bekend. De
drie-lagen-annotatiefunctie die je hebt gebouwd voor reflectie (bron vs.
kritiek vs. eigen inzicht) is dus **niet verbonden** met de plek waar die
lagen in de praktijk ontstaan: tijdens het lezen.

Dit is een kleine, goed afgebakende fix (zie voorstel 2) — de data is er al,
er hoeft alleen een `[...]${layer}`-wrapper omheen bij het genereren van de
notitie-inhoud.

### 3.3 Geen toegang tot je kennisbank tijdens het lezen
Terwijl je een PDF leest, is er geen manier om te zien of een gemarkeerde
passage al raakt aan bestaande notities — geen geïntegreerde zoekfunctie of
`SmartLinkSuggester`-achtig paneel binnen `PDFViewer.js`. Dat past bij "de
essentie is schrijven waarbij je makkelijk kunt onderzoeken" — nu geldt dat
alleen tijdens het schrijven, niet tijdens het lezen, terwijl lezen vaak het
moment is waarop een verband ontstaat.

### 3.4 Bibliotheek en PDF-hub zijn twee losse werelden
`BookLibrary.js` (de "Bibliotheek"-tab) heeft als enige interactie
`onOpenNote?.(book.id)` — een boek openen betekent een **notitie** openen
(metadata: titel, auteur, cover, status), niet het bijbehorende PDF-bestand.
`PDFViewer.js` zit in een andere tab en heeft geen enkele referentie naar
`BookLibrary`. Er is dus geen "lees dit boek"-knop die je van de
bibliotheekkaart naar de daadwerkelijke, highlightbare PDF brengt — je moet
zelf onthouden welk PDF-bestand bij welk boek hoort en er apart naartoe
navigeren. Voor het expliciete doel "lezen en highlighten" is dit een reële
frictie, met name op iPad waar tab-wisselen en zoeken naar het juiste bestand
omslachtiger is dan op laptop.

---

## 4. Cross-device: laptop + iPad via wifi, volledig lokaal

Dit is het punt waar ik het meest kritische, nog niet eerder besproken risico
vond.

### 4.1 Service worker en secure context
Browsers (inclusief Safari/iOS) staan `serviceWorker.register()` alleen toe
op een **secure context**: HTTPS, of het speciale geval `localhost`. Een
gewoon lokaal IP-adres over wifi (bv. `http://192.168.1.23:8888`) is **geen**
secure context. In `index.html` staat geen enkele check hierop — de
registratie wordt onvoorwaardelijk geprobeerd:

```js
if ("serviceWorker" in navigator) {
  const reg = await navigator.serviceWorker.register("/service-worker.js", { scope: "/" });
  ...
}
```

`"serviceWorker" in navigator` is *altijd* waar (de API bestaat), maar de
`register()`-aanroep zelf faalt stil (met een `SecurityError`, waarschijnlijk
opgevangen door een try/catch verderop) zodra de iPad de app laadt via het
LAN-IP van je laptop in plaats van via `localhost`.

**Concreet gevolg als dit zich voordoet**: alle service-worker-gebaseerde
functionaliteit werkt niet op de iPad wanneer die er via wifi bij komt —
inclusief alle cache/offline-fixes van de vorige sessies (die zijn allemaal
voor niets als de SW daar nooit registreert), en mogelijk een minder
robuuste/geen "Add to Home Screen"-installatie-ervaring.

**Ik weet niet zeker of dit bij jou daadwerkelijk optreedt** — je gaf aan de
app al als PWA op de iPad te gebruiken, dus mogelijk gebruik je al een
work-around (bv. een reverse proxy met een self-signed certificaat, of
Tailscale/een ander mechanisme dat wél HTTPS of een `localhost`-achtige
context biedt). Zie de vraag onderaan dit document — dit wil ik eerst helder
hebben voordat ik hier iets aan bouw, want de juiste oplossing hangt volledig
af van hoe je nu verbindt.

### 4.2 Wat al wél robuust is voor het wifi-scenario
- De server luistert al op `--host 0.0.0.0`, dus is al bereikbaar vanaf andere
  apparaten op hetzelfde wifi-netwerk — het basisprincipe klopt.
- `_send_nocache` op alle module-bestanden en de nieuwe network-first
  SW-strategie zorgen dat *als* de SW werkt, wijzigingen betrouwbaar doorkomen
  op elk apparaat dat verbindt.

---

## 5. Verbetervoorstellen (geprioriteerd)

| # | Voorstel | Waarom | Type werk |
|---|---|---|---|
| 1 | **Highlight-kleur → laag-markup bij export.** Bij "+ notitie" en "alle highlights als notitie": wrap de tekst in `[tekst]{.bron}` / `{.kritisch}` / `{.eigen}` op basis van `hc.layer`, i.p.v. een platte blockquote. | Sluit de PDF→AnnotationsPanel-lus die nu al bijna bestaat — kleinste moeite, grootste directe winst voor "onderzoek in de kennisdatabase". | Klein, server niet nodig, alleen `PDFViewer.js` |
| 2 | **Bevestig het secure-context-risico (§4.1) vóór er verder gebouwd wordt.** | Als dit zich voordoet, zijn eerdere SW-fixes voor de iPad zonder effect — dit moet eerst helder zijn. | Verificatie, geen code |
| 3 | **"Lees dit boek"-knop op de bibliotheekkaart** die naar het bijbehorende PDF in de PDF-hub springt (matchen op bestandsnaam/titel). | Sluit de Bibliotheek↔PDF-hub-kloof (§3.4) — direct relevant voor "lezen op iPad". | Middel — vereist een match-strategie tussen boek-notitie en PDF-bestand |
| 4 | **Verwante-notities-paneel (SmartLinkSuggester) ook beschikbaar tijdens lezen in PDFViewer**, bijvoorbeeld getriggerd op de geselecteerde highlight-tekst. | Brengt "onderzoeken" ook naar het leesmoment, niet alleen het schrijfmoment. | Middel — hergebruikt bestaande component/endpoint |
| 5 | **Maak de VimEditor/OutlineEditor-keuze expliciet op touch-apparaten** — bv. standaard OutlineEditor tonen op `isTouch`, met een duidelijke "wissel naar Vim (toetsenbord vereist)"-knop, i.p.v. impliciet altijd met VimEditor te starten. | Maakt een bewuste architectuurkeuze (laptop = vim-kracht, iPad = eenvoud) zichtbaar i.p.v. verstopt achter een kleine toolbar-knop. | Klein — UI-keuze in `NoteEditor.js` |

Bewust **niet** opgenomen: MCP-server (liet je vervallen).

---

## 6. Verduidelijkingsvragen

1. **Secure context (§4.1)** — hoe opent de iPad de app precies: `http://<laptop-lan-ip>:poort`, een `.local`-hostname, of loopt er al iets als Tailscale/een reverse proxy met HTTPS voor? Dit bepaalt volledig of voorstel 2 uberhaupt een probleem is, en zo ja, wat de juiste oplossing is (self-signed cert + `NSAllowsArbitraryLoads`-equivalent voor Safari bestaat niet echt — meestal is een lokale HTTPS-terminatie of een tool als Tailscale/Caddy de gangbare route).
2. **Voorstel 3 (bibliotheek↔PDF-koppeling)** — worden boek-notities en PDF-bestanden nu al consistent op titel/bestandsnaam benoemd, of zou matchen onbetrouwbaar zijn? Zo nee, dan is een expliciet koppelveld (bv. `pdfFile` in de boek-notitie) misschien nodig i.p.v. automatisch matchen.
3. Wil je dat ik **eerst voorstel 1** (highlight-laag-export) bouw — die is klein, op zichzelf staand, en direct meetbaar — en de rest later oppak, of liever in de volgorde van de tabel?
