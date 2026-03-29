// ── LinksSidebar ──────────────────────────────────────────────────────────────
// Rechter zijbalk voor links bij notities.
// Tabs: Backlinks (← wie linkt naar deze notitie)
//       Outlinks  (→ waar linkt deze notitie naartoe)
//       Linken    (+ handmatig linken met slimme zoekfunctie)

const LinksSidebar = ({
  note,
  allNotes = [],
  serverPdfs = [],
  serverImages = [],
  onSelect,
  onInsertLink,
  onTagRemove,
  onNoteTypeChange,
  isTablet = false,
  splitMode = false,
}) => {
  const { useState, useMemo, useEffect } = React;
  const [tab, setTab]           = useState("back");

  // Kleurcodering gebaseerd op Luhmann/Ahrens workflow:
  // Amber = vluchtig (warm, tijdelijk), blauw = literatuur (bron),
  // groen = permanent (stabiel, kern), paars = index (structuur/meta)
  const NOTE_TYPES = [
    { id: "",           label: "—",           color: W.fgMuted,   desc: "Geen type" },
    { id: "fleeting",   label: "Vluchtig",    color: "#e8a44a",   desc: "Snelle capture — verwerk binnen 1-2 dagen" },
    { id: "literature", label: "Literatuur",  color: W.blue,      desc: "Brongebonden — eigen woorden, verwijst naar bron" },
    { id: "permanent",  label: "Permanent",   color: W.comment,   desc: "Eigen inzicht — atomair, zelfstandig begrijpelijk" },
    { id: "index",      label: "Index",       color: W.purple,    desc: "Structuurnotitie — navigatie en overzicht" },
  ];
  // Op tablet standaard ingeklapt; ook inklappen bij split modus
  const [open, setOpen]         = useState(!isTablet && !splitMode);

  // Auto-collapse bij split modus aan/uit
  useEffect(() => {
    if (splitMode) setOpen(false);
    else if (!isTablet) setOpen(true);
  }, [splitMode, isTablet]);

  // ── Outlinks: [[...]] patronen in content ────────────────────────────────────
  const outlinks = useMemo(() => {
    if (!note?.content) return [];
    const matches = [...note.content.matchAll(/\[\[([^\]]+)\]\]/g)];
    const titles  = [...new Set(matches.map(m => m[1]
      .replace(/^pdf:/,"").replace(/^img:/,"")))];
    return titles.map(t => {
      const found = allNotes.find(n =>
        n.title === t || n.id === t ||
        n.title?.toLowerCase() === t.toLowerCase()
      );
      const isPdf = note.content.includes(`[[pdf:${t}]]`);
      const isImg = note.content.includes(`![[img:${t}]]`) ||
                    note.content.includes(`[[img:${t}]]`);
      return { title: t, note: found || null, isPdf, isImg };
    });
  }, [note, allNotes]);

  // ── Backlinks: notities die naar deze notitie linken ─────────────────────────
  const backlinks = useMemo(() => {
    if (!note) return [];
    const id    = note.id;
    const title = note.title || "";
    return allNotes.filter(n =>
      n.id !== id && n.content &&
      (n.content.includes(`[[${title}]]`) ||
       n.content.includes(`[[${id}]]`))
    );
  }, [note, allNotes]);

  // ── Slimme zoekfunctie ───────────────────────────────────────────────────────
  // Score op basis van:
  //   1. Exacte titel-match (hoogste)

  // ── Stijlen ──────────────────────────────────────────────────────────────────
  const S = {
    root: {
      width: "220px", flexShrink: 0,
      borderLeft: `1px solid ${W.splitBg}`,
      background: W.bg2,
      display: "flex", flexDirection: "column",
      minHeight: 0, overflow: "hidden",
    },
    header: {
      padding: "8px 10px 4px",
      borderBottom: `1px solid ${W.splitBg}`,
      flexShrink: 0,
    },
    title: {
      fontSize: "10px", color: W.fgMuted,
      letterSpacing: "1px", fontWeight: "600",
      marginBottom: "5px",
    },
    tabs: {
      display: "flex", gap: "2px",
    },
    tab: (active) => ({
      flex: 1, background: active ? "rgba(138,198,242,0.08)" : "none",
      border: "none",
      borderBottom: `2px solid ${active ? W.blue : "transparent"}`,
      color: active ? W.blue : W.fgMuted,
      padding: "5px 4px", fontSize: "11px", cursor: "pointer",
      fontWeight: active ? "600" : "400",
      borderRadius: "3px 3px 0 0",
      transition: "color .12s, background .12s",
    }),
    scroll: {
      flex: 1, overflowY: "auto",
      WebkitOverflowScrolling: "touch",
    },
    item: (clickable) => ({
      padding: "7px 10px",
      borderBottom: `1px solid ${W.splitBg}`,
      cursor: clickable ? "pointer" : "default",
      display: "flex", alignItems: "flex-start", gap: "6px",
    }),
    empty: {
      padding: "12px 10px",
      fontSize: "12px", color: W.fgMuted,
      fontStyle: "italic", lineHeight: "1.5",
    },
  };

  const tabBtn = (id, label, count) =>
    React.createElement("button", {
      key: id, onClick: () => setTab(id),
      style: S.tab(tab === id),
    }, count !== undefined ? `${label} ${count}` : label);



  // Ingeklapt: smalle rand met gecentreerde toggle knop
  if (!open) {
    return React.createElement("div", {
      style: {
        width: "16px", flexShrink: 0,
        borderLeft: `1px solid ${W.splitBg}`,
        background: W.bg2,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }
    },
      React.createElement("button", {
        onClick: () => setOpen(true),
        title: "Links uitklappen",
        className: "sidebar-toggle-btn",
        style: {
          background: "none",
          border: `1px solid ${W.splitBg}`,
          borderRight: "none",
          borderRadius: "5px 0 0 5px",
          color: W.fgMuted, cursor: "pointer",
          width: "16px", height: "52px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "10px", padding: 0,
          touchAction: "manipulation",
          transition: "background 0.15s, color 0.15s",
        }
      }, "‹")
    );
  }

  return React.createElement("div", { style: S.root },

    // Header
    React.createElement("div", { style: S.header },
      React.createElement("div", {
        style: { display: "flex", alignItems: "center", justifyContent: "space-between" }
      },
        React.createElement("div", { style: S.title }, "Links"),
        React.createElement("button", {
          onClick: () => setOpen(false),
          title: "Links inklappen",
          className: "sidebar-toggle-btn",
          style: {
            background: "none",
            border: `1px solid ${W.splitBg}`,
            borderRight: "none",
            borderRadius: "5px 0 0 5px",
            color: W.fgMuted, cursor: "pointer",
            width: "16px", height: "36px",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "10px", padding: 0,
            touchAction: "manipulation",
            transition: "background 0.15s, color 0.15s",
            marginRight: "-1px",
          }
        }, "›")
      ),
      React.createElement("div", { style: S.tabs },
        tabBtn("back", `← In ${backlinks.length}`),
        tabBtn("out",  `→ Uit ${outlinks.length}`),
        tabBtn("add",  "+ Link"),
        tabBtn("info", "Info"),
      )
    ),

    // ── Tab: Backlinks ────────────────────────────────────────────────────────
    tab === "back" && React.createElement("div", { style: S.scroll },
      backlinks.length === 0
        ? React.createElement("div", { style: S.empty },
            "Geen notities linken naar deze notitie.\n\nVoeg [[links]] toe in andere notities om verbindingen te maken."
          )
        : backlinks.map(n =>
            React.createElement("div", {
              key: n.id,
              onClick: () => onSelect?.(n.id),
              style: S.item(true),
            },
              React.createElement("span", {
                style: { color: W.blue, fontSize: "12px", marginTop: "1px", flexShrink: 0 }
              }, "←"),
              React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                React.createElement("div", {
                  style: { fontSize: "13px", color: W.fg, fontWeight: "500",
                           overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
                }, n.title || n.id),
                n.tags?.length > 0 && React.createElement("div", {
                  style: { display: "flex", gap: "3px", marginTop: "3px", flexWrap: "wrap" }
                }, (n.tags||[]).slice(0,3).map(t =>
                  React.createElement(TagPill, { key: t, tag: t, small: true })
                ))
              )
            )
          )
    ),

    // ── Tab: Outlinks ─────────────────────────────────────────────────────────
    tab === "out" && React.createElement("div", { style: S.scroll },
      outlinks.length === 0
        ? React.createElement("div", { style: S.empty },
            "Geen [[links]] in deze notitie.\n\nGebruik de + Link tab om verbindingen te maken."
          )
        : outlinks.map((o, i) =>
            React.createElement("div", {
              key: i,
              onClick: () => o.note && onSelect?.(o.note.id),
              style: S.item(!!o.note),
            },
              React.createElement("span", {
                style: {
                  fontSize: "12px", marginTop: "1px", flexShrink: 0,
                  color: o.isPdf ? W.orange : o.isImg ? W.comment : (o.note ? W.comment : W.fgMuted),
                }
              }, o.isPdf ? "📄" : o.isImg ? "🖼" : "→"),
              React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                React.createElement("div", {
                  style: {
                    fontSize: "13px",
                    color: o.note ? W.fg : W.fgMuted,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    textDecoration: o.note ? "none" : "line-through",
                  }
                }, o.title),
                !o.note && !o.isPdf && !o.isImg && React.createElement("div", {
                  style: { fontSize: "10px", color: W.orange, marginTop: "2px" }
                }, "Notitie niet gevonden")
              )
            )
          )
    ),

    // ── Tab: Slimme links ────────────────────────────────────────────────────
    tab === "add" && React.createElement("div", {
      style: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch",
               padding: "8px" }
    },
      React.createElement(SmartLinkSuggester, {
        content:      note?.content || "",
        noteId:       note?.id || "",
        allNotes,
        llmModel:     null,   // geen LLM in de smalle zijbalk
        onInsertLink: (linkText, title) => {
          onInsertLink?.(linkText);
        },
        compact: true,
        autoLoad: false,
      })
    ),
    tab === "info" && note && React.createElement("div", { style: S.scroll },

      React.createElement("div", {
        style: { padding: "10px 12px", display: "flex", flexDirection: "column", gap: "12px" }
      },

        // ── Notitietype selector ─────────────────────────────────────────
        React.createElement("div", null,
          React.createElement("div", {
            style: { fontSize: "9px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "7px", textTransform: "uppercase" }
          }, "Notitietype"),
          // Type knoppen: elk als een volledige rij met dot + label + beschrijving
          NOTE_TYPES.map(({ id, label, color, desc }) => {
            const isActive = (note.noteType || "") === id;
            return React.createElement("button", {
              key: id,
              onClick: () => onNoteTypeChange?.(id),
              title: desc,
              style: {
                display: "flex", alignItems: "center", gap: "8px",
                width: "100%", padding: "6px 8px",
                background: isActive ? `${color}18` : "transparent",
                border: `1px solid ${isActive ? color : "transparent"}`,
                borderRadius: "5px",
                cursor: "pointer", transition: "all 0.1s",
                marginBottom: "2px", textAlign: "left",
              },
              onMouseEnter: e => { if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; },
              onMouseLeave: e => { if (!isActive) e.currentTarget.style.background = "transparent"; },
            },
              // Gekleurde dot
              React.createElement("div", {
                style: {
                  width: "8px", height: "8px", borderRadius: "50%",
                  background: id === "" ? "#333" : color,
                  border: isActive ? `1px solid ${color}` : "1px solid #444",
                  flexShrink: 0, transition: "all 0.1s",
                }
              }),
              React.createElement("div", { style: { flex: 1 } },
                React.createElement("div", {
                  style: { fontSize: "11px",
                           color: isActive ? color : W.fgMuted,
                           fontWeight: isActive ? "600" : "400",
                           lineHeight: "1.2" }
                }, label),
                desc && !isActive && React.createElement("div", {
                  style: { fontSize: "9px", color: W.fgMuted, marginTop: "1px",
                           opacity: 0.7, lineHeight: "1.3" }
                }, desc)
              ),
              isActive && React.createElement("span", {
                style: { fontSize: "11px", color: color, flexShrink: 0 }
              }, "✓")
            );
          })
        ),

        // Tags
        React.createElement("div", null,
          React.createElement("div", {
            style: { fontSize: "9px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "6px", textTransform: "uppercase" }
          }, "Tags"),
          React.createElement("div", {
            style: { display: "flex", flexWrap: "wrap", gap: "4px" }
          },
            ...(note.tags || []).map(t =>
              React.createElement(TagPill, { key: t, tag: t, onRemove: () => onTagRemove?.(t) })
            ),
            !(note.tags || []).length && React.createElement("span", {
              style: { fontSize: "12px", color: W.splitBg }
            }, "geen")
          )
        ),

        // Metadata
        React.createElement("div", {
          style: { display: "flex", flexDirection: "column", gap: "8px" }
        },
          React.createElement("div", null,
            React.createElement("div", {
              style: { fontSize: "9px", color: W.fgMuted, letterSpacing: "1px",
                       marginBottom: "2px", textTransform: "uppercase" }
            }, "ID"),
            React.createElement("div", {
              style: { fontSize: "11px", color: W.comment,
                       wordBreak: "break-all", fontFamily: "'Hack', monospace" }
            }, note.id)
          ),
          note.modified && React.createElement("div", null,
            React.createElement("div", {
              style: { fontSize: "9px", color: W.fgMuted, letterSpacing: "1px",
                       marginBottom: "2px", textTransform: "uppercase" }
            }, "Gewijzigd"),
            React.createElement("div", {
              style: { fontSize: "11px", color: W.fgDim }
            }, new Date(note.modified).toLocaleString("nl-NL"))
          ),
          note.created && React.createElement("div", null,
            React.createElement("div", {
              style: { fontSize: "9px", color: W.fgMuted, letterSpacing: "1px",
                       marginBottom: "2px", textTransform: "uppercase" }
            }, "Aangemaakt"),
            React.createElement("div", {
              style: { fontSize: "11px", color: W.fgDim }
            }, new Date(note.created).toLocaleString("nl-NL"))
          )
        ),

        // VIM sneltoetsen
        React.createElement("div", {
          style: { background: "rgba(0,0,0,0.15)", borderRadius: "4px",
                   padding: "8px 10px" }
        },
          React.createElement("div", {
            style: { fontSize: "9px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "5px", textTransform: "uppercase" }
          }, "VIM-sneltoetsen"),
          [":tag naam1 naam2", ":tag+ naam", ":tag- naam",
           ":template type", ":spell en/nl", ":rnu", ":goyo"
          ].map((t, i) => React.createElement("div", {
            key: i,
            style: { fontSize: "10px", color: W.fgMuted, lineHeight: "1.9",
                     fontFamily: "'Hack', monospace" }
          }, t))
        )
      )
    ),

  );
};
