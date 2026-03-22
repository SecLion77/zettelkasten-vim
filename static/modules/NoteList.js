// ── NoteList ──────────────────────────────────────────────────────────────────
// Variable module. Pure presentatie: toont een gefilterde lijst van notities.
// Weet niets van opslaan, de editor, of de server.
// Props: notes[], selectedId, search, tagFilter, onSelect(id), onNew()

const NoteList = ({
  notes = [],
  selectedId = null,
  search = "",
  tagFilter = null,
  onSelect,
  onNew,
  onDailyNote,
  onSearchChange,
  onTagFilterChange,
  isMobile = false,
  onCloseSidebar,
}) => {
  const { useMemo, useRef, useEffect, useState } = React;
  const listRef = useRef(null);
  const [sortBy, setSortBy] = useState("modified"); // "modified" | "created" | "title"

  // iOS Safari fix: zet hoogte expliciet zodat overflow:auto werkt
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const setH = () => {
      const parent = el.parentElement;
      if (!parent) return;
      const h = parent.offsetHeight || parent.clientHeight;
      if (h > 0) el.style.height = h + "px";
    };
    setH();
    const ro = new ResizeObserver(setH);
    ro.observe(el.parentElement || document.body);
    return () => ro.disconnect();
  }, []);

  // ── Filtering + sortering ────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = notes.filter(n =>
      (!q || n.title?.toLowerCase().includes(q)
          || n.content?.toLowerCase().includes(q)
          || (n.tags || []).some(t => t.includes(q)))
      && (!tagFilter || (n.tags || []).includes(tagFilter))
    );
    // Sorteren
    return [...list].sort((a, b) => {
      if (sortBy === "title") {
        return (a.title || "").localeCompare(b.title || "", "nl", {sensitivity: "base"});
      }
      if (sortBy === "created") {
        return new Date(b.created || 0) - new Date(a.created || 0);
      }
      // standaard: modified (meest recent boven)
      return new Date(b.modified || b.created || 0) - new Date(a.modified || a.created || 0);
    });
  }, [notes, search, tagFilter, sortBy]);

  const sidebarTags = useMemo(() =>
    [...new Set(notes.flatMap(n => n.tags || []))],
  [notes]);

  return React.createElement("div", {
    style: { display: "flex", flexDirection: "column", height: "100%", background: W.bg2 }
  },

    // ── Header ─────────────────────────────────────────────────────────────
    React.createElement("div", {
      style: { padding: "8px 10px 6px", background: W.statusBg,
               borderBottom: `1px solid ${W.splitBg}`, flexShrink: 0 }
    },
      !isMobile ? null : React.createElement("div", {
        style: { display: "flex", justifyContent: "space-between",
                 alignItems: "center", marginBottom: "6px" }
      },
        React.createElement("span", {
          style: { fontSize: "14px", fontWeight: "bold",
                   letterSpacing: "1.5px", color: W.statusFg }
        }, "NOTITIES"),
        React.createElement("button", {
          onClick: onCloseSidebar,
          style: { background: "none", border: "none", color: W.fgMuted,
                   fontSize: "18px", cursor: "pointer", padding: "0 4px", lineHeight: 1 }
        }, "×")
      ),

      // Knoppen rij: nieuw zettel + dagnotitie
      React.createElement("div", { style: { display: "flex", gap: "6px", marginBottom: "7px" } },
        React.createElement("button", {
          onClick: onNew,
          style: { flex: 1, background: W.blue, color: W.bg, border: "none",
                   borderRadius: "6px", padding: "8px 10px", fontSize: "14px",
                   cursor: "pointer", fontWeight: "bold",
                   display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }
        },
          React.createElement("span", { style: { fontSize: "16px", lineHeight: 1 } }, "＋"),
          "nieuw zettel"
        ),
        React.createElement("button", {
          onClick: onDailyNote,
          title: "Open of maak de dagnotitie van vandaag",
          style: { background: "rgba(234,231,136,0.12)",
                   color: W.yellow, border: `1px solid rgba(234,231,136,0.3)`,
                   borderRadius: "6px", padding: "8px 10px", fontSize: "14px",
                   cursor: "pointer", fontWeight: "bold", flexShrink: 0,
                   display: "flex", alignItems: "center", gap: "4px",
                   touchAction: "manipulation" }
        },
          "📅"
        )
      ),

      // Zoekbalk
      React.createElement("input", {
        value: search,
        onChange: e => onSearchChange?.(e.target.value),
        placeholder: "🔍 zoeken…",
        style: { width: "100%", background: W.bg,
                 border: `1px solid ${search ? W.blue : W.splitBg}`,
                 borderRadius: "6px", padding: "6px 9px", color: W.fg,
                 fontSize: "14px", outline: "none",
                 WebkitAppearance: "none", transition: "border-color 0.15s",
                 boxSizing: "border-box" }
      })
    ),

    // ── Tag-filterbalk ──────────────────────────────────────────────────────
    sidebarTags.length > 0 && React.createElement("div", {
      style: { padding: "5px 8px", borderBottom: `1px solid ${W.splitBg}`,
               background: "rgba(0,0,0,0.1)", flexShrink: 0 }
    },
      React.createElement(TagFilterBar, {
        tags: sidebarTags, activeTag: tagFilter,
        onChange: onTagFilterChange, compact: true, maxVisible: 10,
      })
    ),

    // ── Actieve filter badge ────────────────────────────────────────────────
    (tagFilter || search) && React.createElement("div", {
      style: { padding: "3px 8px", borderBottom: `1px solid ${W.splitBg}`,
               background: "rgba(159,202,86,0.04)", flexShrink: 0,
               display: "flex", gap: "5px", alignItems: "center", flexWrap: "wrap" }
    },
      React.createElement("span", { style: { fontSize: "9px", color: W.fgMuted } },
        filtered.length + " resultaten"),
      tagFilter && React.createElement("button", {
        onClick: () => onTagFilterChange?.(null),
        style: { fontSize: "9px", background: "rgba(159,202,86,0.15)", color: W.comment,
                 border: "1px solid rgba(159,202,86,0.3)", borderRadius: "3px",
                 padding: "1px 6px", cursor: "pointer" }
      }, "#", tagFilter, " ×"),
      React.createElement("button", {
        onClick: () => { onSearchChange?.(""); onTagFilterChange?.(null); },
        style: { fontSize: "9px", background: "none", color: W.fgMuted,
                 border: "none", cursor: "pointer", marginLeft: "auto", padding: "1px 4px" }
      }, "× wis")
    ),

    // ── Sorteer-balk ─────────────────────────────────────────────────────────
    React.createElement("div", {
      style: { display: "flex", alignItems: "center", gap: "2px",
               padding: "3px 6px", borderBottom: `1px solid ${W.splitBg}`,
               background: W.bg2, flexShrink: 0 }
    },
      React.createElement("span", {
        style: { fontSize: "9px", color: W.fgMuted, marginRight: "3px",
                 letterSpacing: "0.5px" }
      }, "↕"),
      ...[
        { id: "modified", label: "recent" },
        { id: "created",  label: "nieuw" },
        { id: "title",    label: "A–Z" },
      ].map(({ id, label }) =>
        React.createElement("button", {
          key: id,
          onClick: () => setSortBy(id),
          style: {
            background: sortBy === id ? "rgba(138,198,242,0.15)" : "none",
            color:      sortBy === id ? W.blue : W.fgMuted,
            border:    `1px solid ${sortBy === id ? "rgba(138,198,242,0.35)" : "transparent"}`,
            borderRadius: "4px", padding: "2px 7px",
            fontSize: "10px", cursor: "pointer",
            fontWeight: sortBy === id ? "600" : "400",
            transition: "all 0.12s",
          }
        }, label)
      )
    ),

    // ── Lijst ───────────────────────────────────────────────────────────────
    React.createElement("div", {
      ref: listRef,
      style: { flex: 1, minHeight: 0,
               overflowY: "auto",
               WebkitOverflowScrolling: "touch" }
    },
      filtered.length === 0
        ? React.createElement("div", {
            style: { padding: "24px 12px", color: W.fgMuted,
                     fontSize: "14px", textAlign: "center", lineHeight: "1.8" }
          }, search || tagFilter ? "Geen resultaten" : "Nog geen notities")
        : filtered.map(n => {
            const sel = n.id === selectedId;
            // Datum hint: toon relatief of kort formaat
            const dateVal = sortBy === "created" ? n.created : (n.modified || n.created);
            const dateHint = (() => {
              if (!dateVal) return null;
              const d   = new Date(dateVal);
              const now = new Date();
              const diffMs  = now - d;
              const diffMin = Math.floor(diffMs / 60000);
              const diffH   = Math.floor(diffMs / 3600000);
              const diffD   = Math.floor(diffMs / 86400000);
              if (diffMin < 2)  return "zojuist";
              if (diffMin < 60) return `${diffMin}m`;
              if (diffH   < 24) return `${diffH}u`;
              if (diffD   < 7)  return `${diffD}d`;
              return d.toLocaleDateString("nl-NL", { day:"numeric", month:"short" });
            })();
            return React.createElement("div", {
              key: n.id,
              onClick: () => onSelect?.(n.id),
              style: { padding: "9px 12px", borderBottom: `1px solid ${W.splitBg}`,
                       cursor: "pointer", background: sel ? W.visualBg : "transparent",
                       borderLeft: `3px solid ${sel ? W.yellow : "transparent"}`,
                       minHeight: "46px" }
            },
              // Titel + datum op één rij
              React.createElement("div", {
                style: { display: "flex", alignItems: "baseline",
                         gap: "6px", marginBottom: "3px" }
              },
                React.createElement("div", {
                  style: { fontSize: "14px", color: sel ? W.statusFg : W.fg,
                           lineHeight: "1.35", flex: 1,
                           fontWeight: sel ? "bold" : "normal",
                           overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
                }, n.title || "–"),
                dateHint && React.createElement("span", {
                  style: { fontSize: "10px", color: W.fgMuted,
                           flexShrink: 0, letterSpacing: "0.2px" }
                }, dateHint)
              ),
              n.tags?.length > 0 && React.createElement("div", {
                style: { display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "2px" }
              }, (n.tags || []).slice(0, 3).map(t =>
                React.createElement(TagPill, { key: t, tag: t, small: true })
              ))
            );
          })
    ),


  );
};
