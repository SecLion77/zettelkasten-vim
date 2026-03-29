// ── NoteList ──────────────────────────────────────────────────────────────────
// Variable module. Pure presentatie: toont een gefilterde lijst van notities.
// Weet niets van opslaan, de editor, of de server.
// Props: notes[], selectedId, search, tagFilter, onSelect(id), onNew()

const NoteList = ({
  notes = [],
  selectedId = null,
  search = "",
  tagFilter = null,
  typeFilter = null,
  onTypeFilterChange,
  onSelect,
  onNew,
  onDailyNote,
  onSearchChange,
  onTagFilterChange,
  isMobile = false,
  onCloseSidebar,
}) => {
  const { useMemo, useRef, useEffect, useState, useCallback } = React;
  const listRef    = useRef(null);
  const hoverTimer = useRef(null);
  const [sortBy,    setSortBy]    = useState("modified");
  const [hoverNote, setHoverNote] = useState(null); // {note, rect} voor peek-tooltip
  const [pinnedIds, setPinnedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem("zk_pins") || "[]"); }
    catch { return []; }
  });
  const togglePin = (id, e) => {
    e.stopPropagation();
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev];
      try { localStorage.setItem("zk_pins", JSON.stringify(next)); } catch {}
      return next;
    });
  };

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
      && (!tagFilter  || (n.tags || []).includes(tagFilter))
      && (!typeFilter || (n.noteType || "") === typeFilter)
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
  }, [notes, search, tagFilter, typeFilter, sortBy]);

  // Gepinde notities bovenaan
  const displayNotes = React.useMemo(() => {
    const pinned   = filtered.filter(n => pinnedIds.includes(n.id));
    const unpinned = filtered.filter(n => !pinnedIds.includes(n.id));
    return [...pinned, ...unpinned];
  }, [filtered, pinnedIds]);

  const sidebarTags = useMemo(() =>
    [...new Set(notes.flatMap(n => n.tags || []))],
  [notes]);

  // Peek tooltip: toont eerste regels content bij hover
  const peekTooltip = hoverNote && (() => {
    const { note, rect } = hoverNote;
    const lines = (note.content || "")
      .replace(/^---[\s\S]*?---/, "")
      .replace(/^#{1,6}\s.*$/mg, "")
      .replace(/!?\[\[[^\]]*\]\]/g, "")
      .replace(/[*_`#>]/g, "")
      .trim().split("\n").filter(l => l.trim()).slice(0, 4);
    if (!lines.length) return null;
    const viewH = window.innerHeight;
    const spaceBelow = viewH - rect.bottom;
    const topPx = spaceBelow > 140 ? rect.bottom + 4 : rect.top - 4;
    const tfm   = spaceBelow > 140 ? "translateY(0)" : "translateY(-100%)";
    return React.createElement("div", {
      style: {
        position: "fixed", top: topPx+"px", left: (rect.right+8)+"px",
        transform: tfm, zIndex: 9999,
        background: W.bg2, border: "1px solid "+W.splitBg, borderRadius: "6px",
        padding: "10px 14px", maxWidth: "280px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)", pointerEvents: "none",
      }
    },
      React.createElement("div", {
        style: { fontSize: "12px", fontWeight: "600", color: W.statusFg,
                 marginBottom: "6px", lineHeight: "1.3" }
      }, note.title || "–"),
      lines.map((l, i) => React.createElement("div", {
        key: i,
        style: { fontSize: "11px", color: W.fgMuted, lineHeight: "1.6",
                 fontFamily: "'DM Sans', system-ui, sans-serif",
                 overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
      }, l)),
      note.tags && note.tags.length > 0 && React.createElement("div", {
        style: { marginTop: "6px", display: "flex", gap: "4px", flexWrap: "wrap" }
      }, note.tags.slice(0,4).map(t =>
        React.createElement("span", {
          key: t,
          style: { fontSize: "10px", color: W.comment, background: "rgba(159,202,86,0.1)",
                   borderRadius: "3px", padding: "1px 5px" }
        }, "#"+t)
      ))
    );
  })();

  return React.createElement("div", {
    style: { display: "flex", flexDirection: "column", height: "100%", background: W.bg2 }
  },
    peekTooltip,

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

    // ── Type-filterbalk ─────────────────────────────────────────────────────
    React.createElement("div", {
      style: { padding: "5px 8px 4px", borderBottom: `1px solid ${W.splitBg}`,
               background: "rgba(0,0,0,0.08)", flexShrink: 0,
               display: "flex", gap: "3px", alignItems: "center", flexWrap: "wrap" }
    },
      React.createElement("span", {
        style: { fontSize: "9px", color: W.fgMuted, marginRight: "2px",
                 letterSpacing: "0.5px", flexShrink: 0 }
      }, "type:"),
      [
        { id: null,         label: "alle",        color: W.fgMuted,  dot: null },
        { id: "fleeting",   label: "vluchtig",    color: "#e8a44a",  dot: "#e8a44a" },
        { id: "literature", label: "literatuur",  color: W.blue,     dot: W.blue },
        { id: "permanent",  label: "permanent",   color: W.comment,  dot: W.comment },
        { id: "index",      label: "index",       color: W.purple,   dot: W.purple },
      ].map(({ id, label, color, dot }) => {
        const isActive = typeFilter === id;
        return React.createElement("button", {
          key: label,
          onClick: () => onTypeFilterChange?.(id),
          style: {
            display: "flex", alignItems: "center", gap: "4px",
            padding: "2px 7px", fontSize: "10px", cursor: "pointer",
            background: isActive ? `${color}20` : "transparent",
            border: `1px solid ${isActive ? color : "transparent"}`,
            borderRadius: "10px",
            color: isActive ? color : W.fgMuted,
            fontWeight: isActive ? "600" : "400",
            transition: "all .1s",
          }
        },
          dot && React.createElement("div", {
            style: { width: "6px", height: "6px", borderRadius: "50%",
                     background: dot, flexShrink: 0 }
          }),
          label
        );
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
    (tagFilter || typeFilter || search) && React.createElement("div", {
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
      typeFilter && React.createElement("button", {
        onClick: () => onTypeFilterChange?.(null),
        style: { fontSize: "9px", background: "rgba(138,198,242,0.12)", color: W.blue,
                 border: "1px solid rgba(138,198,242,0.3)", borderRadius: "3px",
                 padding: "1px 6px", cursor: "pointer" }
      }, typeFilter, " ×"),
      React.createElement("button", {
        onClick: () => { onSearchChange?.(""); onTagFilterChange?.(null); onTypeFilterChange?.(null); },
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
        : displayNotes.map(n => {
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
              onMouseEnter: (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                clearTimeout(hoverTimer.current);
                hoverTimer.current = setTimeout(() => {
                  setHoverNote({ note: n, rect });
                }, 600);
              },
              onMouseLeave: () => {
                clearTimeout(hoverTimer.current);
                setHoverNote(null);
              },
              className: "note-item" + (sel ? " selected" : ""),
              style: {
                padding: "10px 12px 9px",
                borderBottom: `1px solid rgba(58,64,70,0.5)`,
                cursor: "pointer",
                background: sel ? "rgba(138,198,242,0.08)" : "transparent",
                borderLeft: `3px solid ${sel ? W.yellow : "transparent"}`,
                transition: "background 0.1s",
              }
            },
              // Titel + datum + pin op één rij
              React.createElement("div", {
                style: { display: "flex", alignItems: "center",
                         gap: "4px", marginBottom: "3px" }
              },
                pinnedIds.includes(n.id) && React.createElement("span", {
                  title: "Gepind — klik om te ontkoppelen",
                  onClick: (e) => togglePin(n.id, e),
                  style: { fontSize: "10px", opacity: 0.7, flexShrink: 0,
                           cursor: "pointer", color: W.yellow }
                }, "📌"),
                n.noteType && React.createElement("span", {
                  title: { fleeting: "Vluchtig", literature: "Literatuur",
                           permanent: "Permanent", index: "Index" }[n.noteType] || n.noteType,
                  style: {
                    width: "6px", height: "6px", borderRadius: "50%", flexShrink: 0,
                    marginRight: "2px", alignSelf: "center",
                    background: {
                      fleeting:   W.orange,
                      literature: W.blue,
                      permanent:  W.comment,
                      index:      W.purple,
                    }[n.noteType] || W.fgMuted,
                    display: "inline-block",
                  }
                }),
                React.createElement("div", {
                  style: {
                    fontSize: "14px",
                    color: sel ? W.statusFg : W.fg,
                    lineHeight: "1.35", flex: 1,
                    fontWeight: sel ? "600" : "500",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    letterSpacing: sel ? "0" : "0.1px",
                  }
                }, n.title || "–"),
                dateHint && React.createElement("span", {
                  style: { fontSize: "10px", color: "#9a9187",
                           flexShrink: 0, letterSpacing: "0.2px" }
                }, dateHint),
                React.createElement("span", {
                  title: pinnedIds.includes(n.id) ? "Ontkoppelen" : "Bovenaan pinnen",
                  onClick: (e) => togglePin(n.id, e),
                  className: "pin-btn",
                  style: {
                    fontSize: "10px", flexShrink: 0, cursor: "pointer",
                    opacity: pinnedIds.includes(n.id) ? 0.7 : 0,
                    color: pinnedIds.includes(n.id) ? W.yellow : W.fgMuted,
                    transition: "opacity 0.1s",
                    padding: "0 2px",
                  }
                }, "📌")
              ),
              n.tags?.length > 0 && React.createElement("div", {
                style: { display: "flex", flexWrap: "wrap", gap: "3px", marginTop: "3px" }
              }, (n.tags || []).slice(0, 3).map(t =>
                React.createElement(TagPill, { key: t, tag: t, small: true })
              ))
            );
          })
    ),


  );
};
