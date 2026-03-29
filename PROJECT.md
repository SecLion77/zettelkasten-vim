# PROJECT.md — Zettelkasten VIM Briefing

> Plak dit bestand aan het begin van elke nieuwe chatsessie.
> Vertel ook welke module je wilt werken: Graph, VimEditor, PDFViewer etc.

---

## Wat is dit project?

Zelfstandige Python desktop-app voor kennisbeheer (Zettelkasten). Notities als Markdown op schijf. Geen bundler, geen framework — vanilla JS + React via CDN.

**Stack:**
- Frontend: Vanilla JS + React (CDN, geen bundler)
- Backend: Python 3.11+ (puur stdlib, geen Flask)
- AI: Lokale Ollama modellen + cloud (Anthropic, OpenAI, Google, Mistral, OpenRouter)
- PDF rendering: PDF.js
- Font: Hack (monospace), hoofdfont voor de hele UI

---

## Bestandslocaties

```
/Users/hj/Downloads/zettelkasten-vim/
├── server.py              ← Python backend
├── index.html             ← HTML shell + module laadvolgorde
├── app.js                 ← Globals, constants, api object, TagPill, TagEditor
└── modules/
    ├── SpellEngine.js     ← SpellEngine + CompletionEngine
    ├── VimEditor.js       ← Canvas VIM editor (grootste module, ~2100 regels)
    ├── TagFilterBar.js    ← Tag-filter balk voor graaf
    ├── Graph.js           ← Kennisgraaf (~1460 regels)
    ├── PDFViewer.js       ← PDF viewer + CanvasMount + TextLayerMount
    ├── VaultSettings.js   ← Instellingen modal (vault, API-sleutels, PDF, weergave)
    ├── ImagesGallery.js   ← Afbeeldingen gallerij
    ├── MermaidEditor.js   ← Mermaid + MindMap + LLMNotebook + FuzzySearch + SearchViewer
    ├── ModelPicker.js     ← Model selector dropdown
    ├── LinksSidebar.js    ← Rechter links-zijbalk (backlinks/outlinks/linken)
    ├── NoteEditor.js      ← Notitie editor wrapper
    ├── NotePreview.js     ← Preview + semantisch verwant paneel
    ├── NotesTab.js        ← Orkestratielaag: NoteList + NoteEditor + LinksSidebar
    ├── NoteList.js        ← Notitie-lijst + dagnotitie knop
    ├── NotesMeta.js       ← Metadata-zijpaneel
    ├── TagManager.js      ← SmartTagEditor + TagManagerPanel
    ├── WebImporter.js     ← URL/Markdown/Word import
    ├── ReadingList.js     ← Leeslijst
    ├── StatsPanel.js      ← Statistieken + 💾 schijfruimte tab
    ├── ReviewPanel.js     ← Spaced repetition review
    ├── pdfService.js      ← PDF API-client (ondersteunt AbortController signal)
    ├── noteApi.js         ← Notities API-client
    ├── noteStore.js       ← In-memory notities store
    └── annotationStore.js ← PDF-annotaties store

Vault: /Users/hj/Documents/Zettelkast/
Server draait op poort 8080.
```

---

## Module laadvolgorde (index.html)

Volgorde is kritiek — elke module verwacht vorige modules beschikbaar:

```
PDF.js → React → ReactDOM
→ noteApi, noteStore, pdfService, annotationStore  (data-modules)
→ app.js          (globals: W, api, genId, renderMd, TagPill, TagEditor, FONT_SIZE, etc.)
→ SpellEngine.js  (SpellEngine, CompletionEngine)
→ VimEditor.js    (gebruikt SpellEngine + CompletionEngine)
→ TagFilterBar.js
→ Graph.js        (gebruikt TagFilterBar)
→ PDFViewer.js    (definieert ook ONLINE_MODELS, MODEL_*, useWindowSize)
→ VaultSettings.js
→ ImagesGallery.js
→ MermaidEditor.js (gebruikt VimEditor; definieert LLMNotebook, MindMap, FuzzySearch, SearchViewer)
→ ModelPicker.js  (gebruikt ONLINE_MODELS uit PDFViewer)
→ NoteList, SmartLinkSuggester, LinksSidebar, NoteEditor, NotePreview,
   NotesMeta, TagManager, NotesTab, WebImporter, ReadingList, StatsPanel, ReviewPanel
→ Bootstrap: ReactDOM.createRoot(#root).render(App)
```

---

## Belangrijke globals (gedefinieerd in app.js)

```javascript
W                  // Wombat kleurpalet: W.bg, W.fg, W.blue, W.yellow, W.orange, W.comment etc.
api                // HTTP client: api.get(), api.post(), api.put(), api.del()
genId()            // Genereer unieke notitie-ID
extractLinks(text) // Haal [[links]] uit tekst
extractTags(text)  // Haal #tags uit tekst
renderMd(text, notes, onLink)  // Markdown → HTML met zlink pills
TagPill            // React component voor tag weergave
TagEditor          // React component voor tag invoer
FONT_SIZE          // Editor font grootte (pixels)
LINE_H             // Editor regel hoogte (pixels)
PAD_LEFT           // Editor linker padding
```

---

## App component (app.js) — key state

```javascript
// Tabs
tab, setTab          // actieve subtab: "notes"|"search"|"graph"|"pdf"|"images"|"llm"|...
splitMode            // split-screen aan/uit
splitTab             // rechter split tab (default: "llm")
splitFocus           // "left"|"right"

// Notities
notes, setNotes      // gespiegeld vanuit NoteStore
selId, setSelId      // geselecteerde notitie-ID

// Jobs (achtergrondtaken)
jobs, setJobs        // [{id, type, label, status, result, error}]
addJob(job)          // job.controller = AbortController voor annulering
updateJob(id, patch)
cancelJob(id)        // abort + markeer als geannuleerd

// Server status
serverOnline         // bool — elke 10s gepollt via /api/health
```

---

## VimEditor — architectuur

Canvas-gebaseerde editor. Alle editor-staat in `S = useRef({...})` — nooit stale in event handlers.

**Key state in S.current:**
```javascript
lines[]      // regelarray
cur          // {row, col}
scroll       // eerste zichtbare regel
mode         // "INSERT"|"NORMAL"|"COMMAND"|"SEARCH"|"VISUAL"
visual       // bool
visualLine   // bool (V mode)
visualStart  // {row, col}
folds        // {row → eindRow} — gevouwen secties
marks        // {a-z → {row, col}}
macros       // {a-z → [keys]}
macroRec     // null of register letter
lastAction   // {type, ...} voor dot repeat
pendingOp    // 'c'|'d'|'y' wacht op text object
relativeNumbers // bool
```

**Vim features geïmplementeerd:**
- INSERT/NORMAL/VISUAL/COMMAND/SEARCH modes
- Visual mode: v (char), V (linewise) — d/y/c op selectie
- Text objects: ci"/di(/ya{ etc. — inner/around voor " ' \` ( [ { <
- % bracket matching (multi-regel)
- Folds: za/zo/zc/zR/zM voor markdown headers — fold header pill zichtbaar
- Marks: ma/'a
- Macros: qq...q / @q
- Dot repeat: . herhaalt insert/delete/replace
- r replace-char (ook herhaalbaar via .)
- Relative line numbers: :rnu
- Persistente undo: localStorage per noteId, max 40 stappen, 24u TTL
- Incrementele spellcheck: alleen gewijzigde regels
- Notitie-templates: :template dagnotitie/meeting/literatuur/project/vraag
- Keyboard shortcuts: ? of :help → overlay

**Props:**
```javascript
value, onChange, onSave, onEscape
noteTags, onTagsChange, allTags
noteId           // voor persistente undo
llmModel
allNotesText     // voor completion engine
onSplitCmd       // split navigatie callbacks
onEditorRef      // geeft {focus, setCursor, insertAtCursor} terug
```

---

## Graph — architectuur

Canvas-gebaseerde graaf in `Graph.js`.

**Key refs:**
```javascript
nodesRef.current   // array van nodes
alphaRef.current   // simulatie cooling (1.0 = heet, 0 = gestabiliseerd)
dirtyRef.current   // true = herteken nodig
lassoRef.current   // {active, x1,y1,x2,y2}
```

**Tick loop:** bouwt `nodeMap = new Map(nodes.map(n=>[n.id,n]))` per frame voor O(1) lookups.
Simulatie stopt automatisch als `maxV < 0.3` — geen CPU gebruik na stabilisatie.

**Features:**
- Arrowheads op edges
- Lasso selectie (Shift+sleep)
- 💥 uiteen / ↺ herstart knoppen
- Pad-finder (ook via tag-nodes), pathOnly toggle
- Safari: controls paneel gebruikt `top+bottom` anchoring

---

## Split modus

```
┌─────────────────────┬─────────────────────┐
│  Linker editor      │  Rechter paneel      │
│  (NotesTab)         │  Tab-balk:           │
│                     │  ✏️ Zoeken Graaf      │
│  Ctrl+W Ctrl+W →   │  Mindmap Notebook    │
│  toggle focus       │  PDF Plaatjes        │
└─────────────────────┴─────────────────────┘
```

Bij activeren:
- Linker sidebar (notitieslijst) klapt automatisch in
- Rechter linkszijbalk klapt automatisch in
- Standaard tab rechts: "llm" (Notebook)

Focus wisselen: Ctrl+W Ctrl+W, Ctrl+H (links), Ctrl+L (rechts)
Sidebar toggle: Ctrl+B (links), ▶ knop (rechts)

---

## Zoeken / SearchViewer

`FuzzySearch` (in MermaidEditor.js) heeft twee modi:
- **fuzzy**: `/api/search` — FZF-stijl
- **fulltext**: `/api/fulltext` — exacte zoekterm

Beide modi: klikken op resultaat → laadt in **SearchViewer** rechts (niet direct openen).

**SearchViewer** (canvas-based, in MermaidEditor.js):
- Vim-navigatie: j/k, n/N (treffers), g/G, Ctrl+D/U
- Zoekterm highlight (geel)
- Muisselectie → y of Ctrl+C om te kopiëren
- Y = kopieer huidige regel
- Relatieve/absolute regelnummers (rel# knop)
- initialRow: springt naar de gevonden regel
- "◀ Plak selectie links" in split modus

---

## Server (server.py)

Puur Python stdlib — geen Flask. HTTP via `BaseHTTPRequestHandler`.

**Routing:**
```python
def _get_routes(self):   # GET endpoints als dict
def _post_routes(self):  # POST endpoints als dict
# Complexe handlers als aparte methoden: _get_disk_usage(), _get_api_keys(), etc.
```

**Endpoints (selectie):**
```
GET  /api/health          → {"ok": true}  (server status check)
GET  /api/notes           → alle notities
GET  /api/disk-usage      → vault + schijf statistieken
POST /api/search          → fuzzy zoeken
POST /api/fulltext        → full-text zoeken
POST /api/spellcheck      → spell + grammar check (incrementeel via dirty_rows)
POST /api/llm/chat        → LLM chat
POST /api/llm/summarize-pdf    → PDF samenvatting (ondersteunt AbortController)
POST /api/llm/describe-image   → afbeelding beschrijven (ondersteunt AbortController)
POST /api/import-url      → URL importeren (ondersteunt AbortController)
```

---

## Bekende patronen & valkuilen

**Safari/iOS:**
- Graph controls: gebruik `top + bottom` anchoring, NIET `height: calc(100vh - X)`
- Scroll containers: `position: absolute; inset: 0; overflow: auto` met expliciete `height: 100%`
- `overflowY: scroll` werkt betrouwbaarder dan `auto` in absolute elementen
- PDF scroll: `touchAction: "pan-y"` op TextLayerMount (NIET "none")

**React patterns:**
- `S = useRef({...})` in VimEditor — alle editor state, nooit stale
- `dirtyRef.current = true` bij ALLE interacties die hertekening vereisen
- `nodeMap = new Map(...)` per frame in Graph tick — O(1) lookup

**CSS-rommel van LLM:**
- `_sanitize_llm_text()` in server.py sanitiseert voor opslag
- `renderMd` in app.js: callout HTML als `%%MEDIA%%` placeholder opslaan vóór taghl regex

**Syntaxis checken:**
```bash
node --check modules/VimEditor.js
python3 -c "import ast; ast.parse(open('server.py').read())"
```

---

## Huidige openstaande punten

- Niets kritiek bekend op moment van schrijven
- Safari graaf: knoppen zichtbaar na scroll in controls paneel ✓
- iPad PDF scroll: touchAction pan-y fix ✓
- Server offline indicator: /api/health endpoint ✓

---

## Werkwijze

- Lever alleen **gewijzigde bestanden** (geen volledige ZIPs tenzij gevraagd)
- Syntaxischeck altijd vóór levering: `node --check` en `ast.parse`
- UI-taal: **Nederlands**
- Code-taal: **Engels**
- Bij grote wijzigingen: werk per module in aparte bestanden
