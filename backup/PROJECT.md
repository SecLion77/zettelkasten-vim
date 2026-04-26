# Zettelkasten VIM — PROJECT.md

Canoniek briefingdocument voor nieuwe chatsessies. Altijd meesturen als context.

---

## Stack & paden

| Onderdeel | Waarde |
|-----------|--------|
| Frontend | Vanilla JS + React (CDN), geen build-stap |
| Backend | Python 3, `server.py` op poort `8080` |
| Vault | `/Users/hj/Documents/Zettelkast/notes/` |
| Project | `/Users/hj/Downloads/zettelkasten-vim/` |
| Fonts | Hack (editor), DM Sans (UI) |
| Kleurschema | Void Cyan (`W`-object in `app.js`) |
| AI lokaal | Ollama op `localhost:11434` |
| AI online | OpenRouter, Anthropic, Google, Mistral, OpenAI |

---

## Navigatiestructuur (MAIN_TABS)

```
📝 Schrijven       ← NotesTab (hoofd)
📚 Bibliotheek     → PDF | Plaatjes | Leeslijst | Review
🔍 Ontdekken       → Zoeken | Graaf | Mindmap | Notebook | Canvas
🌐 Invoer          → URL/Word | PDF
⚙  Beheer          → Tags | Statistieken | Opschonen
```

**Split-mode tabs** (vaste volgorde): Zoeken → Graaf → Mindmap → Notebook → Canvas → PDF → Plaatjes

Split-mode opent altijd op de Zoeken tab.

---

## Module laadvolgorde (index.html)

Kritisch — modules mogen alleen afhankelijkheden gebruiken die eerder geladen zijn:

1. PDF.js, React, ReactDOM
2. `noteApi.js`, `noteStore.js`, `pdfService.js`, `annotationStore.js` (stable)
3. `app.js` — definieert `W`, `TagPill`, `VimEditor`, `genId`, `ZK_DEBUG`, `zklog`
4. UI-modules (NoteList, NoteEditor, etc.)
5. `Whiteboard.js`, `VaultCleanup.js`
6. Bootstrap: `ReactDOM.createRoot(...).render(React.createElement(App))`

---

## Architectuurprincipes

**State management**
- `notes` array leeft in `App` (app.js), doorgegeven als props
- `NoteStore` is de in-memory cache, `NoteAPI` is de enige server-fetch laag
- `dateFilter`, `search`, `tagFilter` zijn gehesen naar `NotesTab` (stabiel over re-renders)
- `sidebar` const in `NotesTab` heeft `key="main-notelist"` om unmount te voorkomen

**Datums**
- `created` = echte aanmaakdatum (uit frontmatter of `st_birthtime` op macOS)
- `modified` = laatste opslagdatum (altijd overschreven bij save)
- `created` wordt NOOIT overschreven bij save — server leest bestaande waarde
- Datumfilter filtert op `created`, sorteer-knoppen sorteren op `modified`

**AI / SSE streaming**
- SSE lezen via `resp.body.getReader()`, nooit `r.json()`
- Qwen3 modellen krijgen `enable_thinking: False` via `extra_body`
- `reasoning_content` tokens worden ook doorgestuurd als fallback

**Server routing (model → provider)**
- `claude-*` → Anthropic
- `gemini-*` → Google
- `gpt-*` / `o1-*` / `o3-*` / `o4-*` → OpenAI
- `org/model` (bevat `/`) → OpenRouter (incl. Qwen3, Llama4)
- `mistral-*` / `magistral-*` → Mistral
- overig → Ollama lokaal

**noteApi.js sanitize whitelist**
Bevat: `id`, `title`, `content`, `tags`, `created`, `modified`, `sourceUrl`, `importedAt`, `isRead`, `noteType`.
Nieuwe velden toevoegen aan deze lijst bij uitbreiding.

---

## Bekende patronen & valkuilen

| Patroon | Oplossing |
|---------|-----------|
| Stale closure in canvas/draw loop | `useRef` + dep array goed bijhouden |
| NoteList reset state bij re-render | `key="main-notelist"` op het NoteList element |
| SSE wordt als JSON gelezen | Gebruik `ReadableStream` reader |
| macOS bash 3.2 syntax | Geen `${var,,}` — gebruik lowercase literals |
| Props niet doorgegeven | Altijd expliciet doorgeven door de hele keten |
| `modified` altijd vandaag door file-sync | Filter op `created`, niet `modified` |
| `fileRef.current` is null | Hidden `<input>` altijd in DOM, los van conditionele toolbar |
| Config key werkt niet | Voeg toe aan server-side allowlist in `server.py` |
| AI-knop disabled | Check `llmModel` prop én `content` prop (min 5 tekens) |

---

## Huidige features

### Notities & editor
- VIM-stijl editor met `:commando`'s (`:tag`, `:goyo`, `:spell`, `:vs`)
- `[[wiki-link]]` autocomplete bij typen `[[`
- Inline tag-extractie (`#tag` in tekst)
- Promoveer-suggestie banner (vluchtig → permanent/literatuur)
- Daily Notes knop (📅 in notitieslijst header)
- Inbox-badge voor vluchtige notities >2 dagen oud

### Notitieslijst (NoteList)
- Zoeken op titel/inhoud/tags
- Filter op notitietype + tag
- Sorteren: recent (modified) / nieuw (created) / A–Z
- Datumfilter: alle / vandaag / week / maand (op `created` datum)
- Gepinde notities bovenaan

### Preview (NotePreview)
- Titel zichtbaar in toolbar (met ID en tags)
- Export MD knop (⬇ export md) — YAML frontmatter + bronverwijzingen
- Markdown rich/plain toggle
- Backlinks, outlinks, leestijd
- Review markering
- Tekst gecentreerd met `maxWidth: 780px`

### Rechterzijbalk (LinksSidebar)
- Tabs: ← In | → Uit | + Link | Info
- Info tab: notitietype selector, SmartTagEditor (met AI), metadata (ID/datum)
- Inklapbaar — toggle knop gecentreerd in smalle rand
- Props: `llmModel`, `onTagsChange`, `onNoteTypeChange`, `onTagRemove`

### Linker sidebar (NoteList in NotesTab)
- Inklapbaar via ‹ knop bovenaan
- Uitklapbaar via › knop in smalle rand

### PDF bibliotheek (PDFViewer)
- Volledig scherm als geen PDF open
- Hidden `<input>` altijd in DOM (import knop werkt altijd)
- Annotaties: tekst, tags, kleuren, AI-tags
- AI samenvatten via LLM

### AI-features
- SmartTagEditor met AI-suggesties (editor, sidebar, PDF annotaties)
- Slimme link suggesties (SmartLinkSuggester)
- Graaf: verrassende verbinding + AI-analyse via SSE
- Debug via `ZK_DEBUG` — zie sectie Debug

### Canvas / Whiteboard
- Vrij canvas met kaarten en verbindingen
- Kaarten omzetten naar notities
- Opslag via `/api/config` (whiteboard_* keys)
- Beschikbaar als hoofd-tab én in split-mode

---

## Installatie (alles in één keer)

```bash
PROJ=/Users/hj/Downloads/zettelkasten-vim

cp ~/Downloads/app.js        $PROJ/app.js
cp ~/Downloads/index.html    $PROJ/index.html
cp ~/Downloads/server.py     $PROJ/server.py

for f in NoteList NoteEditor NotePreview NotesTab LinksSidebar \
          VimEditor Graph PDFViewer VaultCleanup VaultSettings \
          StatsPanel SmartLinkSuggester TagManager Whiteboard noteApi; do
  cp ~/Downloads/modules/$f.js $PROJ/modules/$f.js
done
```

Server herstarten:
```bash
pkill -f "python.*server.py"
cd /Users/hj/Downloads/zettelkasten-vim && python3 server.py &
```

---

## Debug

```javascript
// Browser console — aan:
localStorage.setItem('zk_debug', '1')
// Uit:
localStorage.removeItem('zk_debug')
// Of via URL:
// http://localhost:8080/?debug
```

`console.error` en `console.warn` zijn altijd zichtbaar. Alleen `zklog()` calls zijn aan/uit te zetten.

---

## Open punten

- **Datumfilter**: werkt alleen correct voor notities met een echte `created` datum. Notities die vóór de server-fix opgeslagen zijn kunnen `created = vandaag` hebben. De server overschrijft `created` nu nooit meer bij save en gebruikt `st_birthtime` als fallback.
- **CSS-garbage**: double-escaping in `renderMd` is deels opgelost via `/api/cleanup-vault`. Volledig oplossen vereist sanitisatie bij save-time.
