# Zettelkasten — Project Briefing

## Stack
- Vanilla JS + React (via CDN, geen bundler)
- PDF.js voor PDF-weergave
- Taal: Nederlands UI, code in Engels

## Bestandsstructuur
```
index.html          ← root, laadt alles
app.js              ← hoofdapp: W(), TagPill, VimEditor, genId, App component
modules/
  noteApi.js        ← data laag (CRUD notities)
  noteStore.js      ← state management
  pdfService.js     ← PDF verwerking
  annotationStore.js← annotaties opslag
  NoteList.js       ← notitie-lijst sidebar
  NoteEditor.js     ← editor (VimEditor)
  NotePreview.js    ← markdown preview
  NotesMeta.js      ← meta-panel (tags, links)
  TagManager.js     ← tag beheer
  NotesTab.js       ← hoofd-tab notities
  LinksSidebar.js   ← backlinks / outlinks
  SmartLinkSuggester.js ← [[wiki-link]] suggesties
  WebImporter.js    ← URL → notitie importeren
  ReadingList.js    ← leeslijst
  StatsPanel.js     ← statistieken
  ReviewPanel.js    ← spaced repetition review
```

## Design tokens (CSS)
| Kleur       | Gebruik                  |
|-------------|--------------------------|
| `#1c1c1c`   | achtergrond              |
| `#e3e0d7`   | primaire tekst           |
| `#ffffd7`   | koppen / accent          |
| `#cae682`   | h2 / code highlight      |
| `#9fca56`   | tags / primaire actie    |
| `#8ac6f2`   | links / info             |
| `#e5786d`   | danger / broken links    |
| `#3a4046`   | borders                  |
| `#857b6f`   | secundaire tekst         |

## Globale helpers (gedefinieerd in app.js)
- `W(tag, props, ...children)` — mini h()-functie voor React elementen
- `genId()` — unieke ID generator
- `TagPill` — herbruikbare tag component
- `VimEditor` — textarea met Vim-mode

## CSS klassen (gedefinieerd in index.html)
- `.mdv` — markdown preview styling
- `.btn-wombat` — knop stijl (modifiers: `.primary`, `.danger`, `.active-blue`, `.active-green`)
- `.note-item` — notitie-lijst item (`.selected`)
- `.tag-pill` — tag chip
- `.topbar-tab` — navigatie tab (`.active`)
- `.zlink` — wiki-link (`[[...]]`) in preview (`.broken`)
- `.wombat-dropdown` — dropdown menu
- `.goyo-mode` — afleidingsvrij schrijven
- `.limelight-mode` — focus op huidige alinea

## Werkwijze tips voor nieuwe chats
1. Plak deze PROJECT.md bovenaan
2. Vermeld welke module je aanpast: "ik werk aan NoteEditor.js"
3. Stuur alleen de relevante module mee, niet alles
4. Sluit af met: "update PROJECT.md als er iets veranderd is"
