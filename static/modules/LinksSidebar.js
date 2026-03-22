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
  isTablet = false,
}) => {
  const { useState, useMemo } = React;
  const [tab, setTab]           = useState("back");
  // Op tablet standaard ingeklapt voor meer leesruimte
  const [open, setOpen]         = useState(!isTablet);

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
      flex: 1, background: "none", border: "none",
      borderBottom: `2px solid ${active ? W.blue : "transparent"}`,
      color: active ? W.blue : W.fgMuted,
      padding: "4px 2px", fontSize: "11px", cursor: "pointer",
      fontWeight: active ? "600" : "400",
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



  // Ingeklapt: toon alleen een smalle knop-strook
  if (!open) {
    return React.createElement("div", {
      style: {
        width: "24px", flexShrink: 0,
        borderLeft: `1px solid ${W.splitBg}`,
        background: W.bg2,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "flex-start",
        paddingTop: "8px",
      }
    },
      React.createElement("button", {
        onClick: () => setOpen(true),
        title: "Links tonen",
        style: {
          background: "none", border: "none",
          color: W.fgMuted, cursor: "pointer",
          fontSize: "14px", padding: "6px 0",
          writingMode: "vertical-rl",
          touchAction: "manipulation",
          letterSpacing: "1px",
        }
      }, "🔗")
    );
  }

  return React.createElement("div", { style: S.root },

    // Header
    React.createElement("div", { style: S.header },
      React.createElement("div", {
        style: { display: "flex", alignItems: "center", justifyContent: "space-between" }
      },
        React.createElement("div", { style: S.title }, "🔗 LINKS"),
        isTablet && React.createElement("button", {
          onClick: () => setOpen(false),
          title: "Sidebar inklappen",
          style: {
            background: "none", border: "none",
            color: W.fgMuted, cursor: "pointer",
            fontSize: "14px", padding: "0 2px", lineHeight: 1,
            touchAction: "manipulation",
          }
        }, "◀")
      ),
      React.createElement("div", { style: S.tabs },
        tabBtn("back", "← In", backlinks.length),
        tabBtn("out",  "→ Uit", outlinks.length),
        tabBtn("add",  "+ Link"),
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
    )
  );
};
