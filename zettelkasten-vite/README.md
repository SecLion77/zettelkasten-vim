# Zettelkasten — Vite + shadcn/ui Setup

Dit project bevat de **Vite build toolchain** voor de Zettelkasten app.
Het bouwt een `wombat.css` CSS-bundle met Tailwind + shadcn/ui die de app moderniseert.

## Mapstructuur

```
zettelkasten-vite/        ← Vite project (deze map)
  src/
    index.css             ← Tailwind + globale stijlen (Wombat thema)
    lib/utils.js          ← shadcn cn() utility
    components/ui/
      button.jsx          ← shadcn Button (Wombat variant)
      input.jsx           ← shadcn Input
      badge.jsx           ← shadcn Badge (voor tags)
      separator.jsx       ← shadcn Separator
      scroll-area.jsx     ← shadcn ScrollArea

../static/                ← Python backend static bestanden
  index.html              ← Moderne HTML (laadt DM Sans + Hack font)
  app.js                  ← Bestaande React app (ongewijzigd)
  wombat.css              ← 🔨 Gebouwd door Vite (na npm run build)
```

## Aan de slag

```bash
cd zettelkasten-vite
npm install
npm run build
```

Dit bouwt `../static/wombat.css` — de app pikt hem automatisch op.

## Ontwikkeling

```bash
npm run dev   # Vite dev server op :5173 met proxy naar Python :5000
```

## Kleurenschema

Het **Wombat** thema is volledig beschikbaar als Tailwind tokens:

| Token                    | Waarde    | Gebruik                     |
|--------------------------|-----------|-----------------------------|
| `wombat-bg`              | `#242424` | Editor achtergrond          |
| `wombat-bg2`             | `#1c1c1c` | Sidebar, toolbar            |
| `wombat-splitBg`         | `#3a4046` | Borders, dividers           |
| `wombat-blue` / `keyword`| `#8ac6f2` | Primaire accentkleur        |
| `wombat-comment`         | `#9fca56` | Groen (opslaan, tags)       |
| `wombat-orange`          | `#e5786d` | Destructieve acties         |
| `wombat-yellow`          | `#eae788` | Cursor, active tab          |
| `wombat-fgMuted`         | `#857b6f` | Secundaire tekst            |

## Font

- **DM Sans** — UI font (modern, leesbaar)
- **Hack** — Monospace (editor, code, statusbalk)
