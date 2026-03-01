# 🗃️ Zettelkasten VIM

> Een Zettelkasten notitie-app met Wombat kleurschema, volledige VIM keybindings, PDF annotaties en een interactieve kennisgraaf.

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Font](https://img.shields.io/badge/Font-Hack-green?style=flat-square)
![Theme](https://img.shields.io/badge/Theme-Wombat-orange?style=flat-square)
![PDF.js](https://img.shields.io/badge/PDF.js-3.11-red?style=flat-square)

---

## ✨ Features

### 📝 Zettelkasten notities
- Bidirectionele links via `[[ID]]` of `[[Titel]]` syntax
- Automatische backlinks per notitie
- Markdown rendering met live preview
- Tag-systeem via `#hash` in tekst of VIM commando's
- Persistent opgeslagen via `window.storage`

### ⌨️ VIM editor
Volledige modal editor met Wombat kleurschema (exact overgenomen uit `wombat.vim` door Lars H. Nielsen).

**Navigatie**
| Toets | Actie |
|-------|-------|
| `h j k l` | Karakter/regel navigatie |
| `w` / `b` | Woord vooruit / achteruit |
| `0` / `$` | Begin / einde regel |
| `gg` / `G` | Begin / einde document |

**Bewerken**
| Toets | Actie |
|-------|-------|
| `i` | INSERT mode op cursor |
| `a` | Append na cursor |
| `o` / `O` | Nieuwe regel onder / boven |
| `dd` | Verwijder regel |
| `yy` | Kopieer regel |
| `p` | Plak onder huidige regel |
| `x` | Verwijder karakter |
| `u` / `Ctrl+r` | Undo / redo |

**Commando's**
| Commando | Actie |
|----------|-------|
| `:w` | Opslaan |
| `:wq` | Opslaan en sluiten |
| `:q!` | Sluiten zonder opslaan |
| `/term` | Zoeken in document |

**Tag commando's**
| Commando | Actie |
|----------|-------|
| `:tag rust async` | Vervang alle tags |
| `:tag+ nieuw` | Voeg één tag toe |
| `:tag- oud` | Verwijder een tag |
| `:tags` | Toon huidige tags |
| `:retag` | Herbereken tags uit `#hash` in tekst |
| `:tagsug` | Toon alle beschikbare tags |
| `Tab` | Autocomplete tagnaam |

### 📄 PDF viewer
- Laad lokale PDF bestanden
- Selecteer tekst → popup verschijnt automatisch
- **5 highlight kleuren:** geel, groen, blauw, oranje, paars
- Notitie en tags toevoegen per highlight
- Annotaties bewerkbaar via zijpaneel
- Filteren op tag in annotatiepaneel

### 🕸️ Kennisgraaf
- Force-directed graph van alle notities
- PDF annotaties als oranje nodes
- Tags als groene nodes verbonden via stippellijnen
- Klikken op node opent de notitie
- Slepen herpositioneert nodes

---

## 🎨 Wombat kleurschema

Exact overgenomen uit `wombat.vim` door Lars H. Nielsen:

| Element | Kleur | Hex |
|---------|-------|-----|
| Achtergrond | Donkergrijs | `#242424` |
| Tekst | Warm wit | `#e3e0d7` |
| Keywords | Blauw | `#8ac6f2` |
| Strings | Geelgroen | `#cae682` |
| Comments | Groen | `#9fca56` |
| Special | Zalm | `#e5786d` |
| Cursor | Geel | `#eae788` |

---

## 🚀 Gebruik

### Als standalone React component

```jsx
// Kopieer zettelkasten-vim.jsx naar je project
import App from './zettelkasten-vim';

export default function MyApp() {
  return <App />;
}
```

### Vereisten
- React 18+
- `window.storage` API (beschikbaar in Claude.ai artifacts)
- Internetverbinding voor CDN-resources:
  - [Hack font](https://cdn.jsdelivr.net/npm/hack-font@3)
  - [PDF.js 3.11](https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/)

---

## 📁 Projectstructuur

```
zettelkasten-vim/
├── zettelkasten-vim.jsx   # Volledige app (single-file React component)
└── README.md
```

---

## 🔗 Links en syntax

### Notitielinks
```
Zie ook [[20240101000001]] of [[Andere Notitie]]
```

### Tags
```
#onderwerp #categorie #project
```

### Zettelkasten ID formaat
```
YYYYMMDDHHMMSSxx  →  bijv. 20240315143022
```

---

## 📖 Zettelkasten methode

De Zettelkasten methode (Duits voor "notitiebox") is een kennisbeheersysteem ontwikkeld door socioloog Niklas Luhmann. Kernprincipes:

1. **Atomaire notities** — één idee per notitie
2. **Unieke ID's** — elke notitie heeft een tijdstempel als identifier
3. **Bidirectionele links** — notities verwijzen naar elkaar
4. **Emergente structuur** — verbindingen ontstaan organisch

---

## 🛠️ Technologie

- **React** — UI framework met hooks
- **PDF.js** — PDF rendering en tekst layer
- **Canvas API** — force-directed kennisgraaf
- **Hack font** — monospace lettertype
- **Wombat vim colorscheme** — kleurpalet

---

## 📜 Licentie

MIT — vrij te gebruiken en aan te passen.

---

*Gebouwd met [Claude](https://claude.ai)*
