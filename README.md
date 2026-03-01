# 🗃️ Zettelkasten VIM

> Een Zettelkasten notitie-app met Wombat kleurschema, volledige VIM keybindings, PDF annotaties en een interactieve kennisgraaf.

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Font](https://img.shields.io/badge/Font-Hack-green?style=flat-square)
![Theme](https://img.shields.io/badge/Theme-Wombat-orange?style=flat-square)
![PDF.js](https://img.shields.io/badge/PDF.js-3.11-red?style=flat-square)

---

## 🚀 De app draaien

### Optie 1 — Claude.ai (geen installatie nodig)

De makkelijkste manier: open de app direct in Claude.ai als artifact.

1. Ga naar [claude.ai](https://claude.ai)
2. Upload het bestand `zettelkasten-vim.jsx`
3. Vraag Claude: _"Draai dit React component"_
4. De app opent direct in het preview venster

> **Voordeel:** Geen installatie, werkt meteen, data wordt opgeslagen via `window.storage`.

---

### Optie 2 — Lokaal draaien met Vite (aanbevolen voor eigen gebruik)

**Vereisten:** Node.js 18+ en npm

```bash
# 1. Maak een nieuw React project aan
npm create vite@latest mijn-zettelkasten -- --template react
cd mijn-zettelkasten

# 2. Installeer dependencies
npm install

# 3. Kopieer de app
cp /pad/naar/zettelkasten-vim.jsx src/App.jsx
```

Vervang daarna `src/main.jsx` met de volgende inhoud:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Polyfill voor window.storage (lokaal gebruik)
window.storage = {
  _data: JSON.parse(localStorage.getItem('zk-storage') || '{}'),
  _save() { localStorage.setItem('zk-storage', JSON.stringify(this._data)); },
  async get(key) {
    return this._data[key] ? { key, value: this._data[key] } : null;
  },
  async set(key, value) {
    this._data[key] = value; this._save();
    return { key, value };
  },
  async delete(key) {
    delete this._data[key]; this._save();
    return { key, deleted: true };
  },
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />)
```

```bash
# 4. Start de development server
npm run dev
# App draait op http://localhost:5173
```

---

### Optie 3 — Bouwen voor productie

```bash
npm run build
# De dist/ map bevat de statische bestanden
# Upload naar Netlify, Vercel, GitHub Pages, of eigen server

# Lokaal bekijken:
npm run preview
```

**GitHub Pages:**
```bash
npm run build
cp -r dist/* docs/
git add docs && git commit -m "deploy" && git push
# Zet GitHub Pages in op de docs/ map in je repo settings
```

---

### Optie 4 — Docker

Maak een `Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
RUN npm create vite@latest . -- --template react --yes
COPY zettelkasten-vim.jsx src/App.jsx
COPY main.jsx src/main.jsx
RUN npm install && npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
```

```bash
docker build -t zettelkasten .
docker run -p 8080:80 zettelkasten
# Open http://localhost:8080
```

---

## 💾 Opslag & Vaults

### Hoe data wordt opgeslagen

De app slaat alle data op in de browser (`window.storage` in Claude.ai, `localStorage` lokaal). Er worden geen bestanden aangemaakt op je schijf — tenzij je expliciet exporteert.

### Vaults — meerdere opslaglocaties

Een **vault** is een benoemde, volledig gescheiden opslaglocatie. Handig voor werk vs. privé, of meerdere projecten.

**Vault wisselen:**
1. Klik op de **`:set`** knop rechtsboven in de app
2. Typ een naam onder "Vault — Opslaglocatie" (bijv. `werk`, `studie`, `privé`)
3. Klik **Opslaan**

De actieve vault naam is altijd zichtbaar in de topbalk.

Storage sleutels per vault:
```
zk-v3-notes-{vault}       ← notities
zk-v3-pdfnotes-{vault}    ← PDF annotaties
zk-vault                   ← actieve vault naam
```

### Exporteren & Importeren

Via het **`:set`** paneel:

| Actie | Formaat | Inhoud |
|-------|---------|--------|
| **Alles exporteren** | `.json` | Notities + PDF annotaties + vault naam |
| **Exporteer als Markdown** | `.md` | Elke notitie als apart bestand met YAML frontmatter |
| **Importeren** | `.json` | Eerder geëxporteerde backup (vervangt huidige data) |

**Markdown export formaat:**
```markdown
---
id: 20240315143022
title: Mijn notitie
tags: [rust, async, vim]
created: 2024-03-15T14:30:22.000Z
modified: 2024-03-15T15:00:00.000Z
---

# Mijn notitie

Inhoud hier...
```

---

## ✨ Features

### 📝 Zettelkasten notities
- Bidirectionele links via `[[ID]]` of `[[Titel]]` syntax
- Automatische backlinks per notitie
- Markdown rendering met live preview
- Tag-systeem via `#hash` in tekst of VIM commando's

### ⌨️ VIM editor

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
| `i` | INSERT mode |
| `dd` | Verwijder regel |
| `yy` / `p` | Kopieer / plak |
| `u` / `Ctrl+r` | Undo / redo |

**Tag commando's**

| Commando | Actie |
|----------|-------|
| `:tag rust async` | Vervang alle tags |
| `:tag+ nieuw` | Voeg tag toe |
| `:tag- oud` | Verwijder tag |
| `:retag` | Herbereken uit `#hash` |
| `Tab` | Autocomplete |

### 📄 PDF viewer
- Laad lokale PDF bestanden
- Selecteer tekst → popup verschijnt automatisch
- 5 highlight kleuren + notities + tags per highlight

### 🕸️ Kennisgraaf
- Force-directed graph van notities, PDF annotaties en tags
- Klikken op node opent de notitie

---

## 🎨 Wombat kleurschema

Gebaseerd op `wombat.vim` door Lars H. Nielsen.

---

## 🛠️ Technologie

- **React 18** — UI framework
- **PDF.js 3.11** — PDF rendering en tekst selectie
- **Canvas API** — kennisgraaf fysica
- **Hack font** — monospace lettertype via CDN
- **window.storage / localStorage** — persistente opslag

---

## 📜 Licentie

MIT

---

*Gebouwd met [Claude](https://claude.ai)*
