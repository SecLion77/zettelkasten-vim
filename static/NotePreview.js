// ── NotePreview ───────────────────────────────────────────────────────────────
// Variable module. Pure read-only presentatie van een notitie.
// Geen state, geen API-aanroepen. Ontvangt alles via props.
// Props: note, notes, renderMode, isMobile,
//        onEdit(), onDelete(), onRenderModeChange(mode),
//        onTagRemove(tag), onLinkClick(e), onEditMermaid(code)

// ── SimilarPanel — semantische suggesties via TF-IDF server-side ──────────────
const SimilarPanel = ({ noteId, note, onSelect, onAddLink }) => {
  const [similar,  setSimilar]  = React.useState(null);
  const [expanded, setExpanded] = React.useState(true);
  const [adding,   setAdding]   = React.useState(null); // id van notitie die we toevoegen

  React.useEffect(() => {
    if (!noteId) return;
    setSimilar(null);
    fetch("/api/llm/similar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note_id: noteId, top_n: 6 }),
    })
      .then(r => r.json())
      .then(d => setSimilar(d.similar || []))
      .catch(() => setSimilar([]));
  }, [noteId]);

  if (similar !== null && similar.length === 0) return null;

  // Check of een notitie al expliciet gelinkt is vanuit huidige notitie
  const alreadyLinked = (targetId) => {
    if (!note?.content) return false;
    return note.content.includes("[[" + targetId + "]]") ||
           note.content.includes("[[" + targetId);
  };

  const strengthBar = (score) => {
    const pct = Math.round(score * 100);
    const fill = Math.min(100, pct * 3);
    return React.createElement("div", {
      style: { display:"flex", alignItems:"center", gap:"6px", marginTop:"3px" }
    },
      React.createElement("div", {
        style: { flex:1, height:"2px", background:"rgba(255,255,255,0.07)", borderRadius:"1px" }
      },
        React.createElement("div", {
          style: { width:`${fill}%`, height:"100%",
                   background:`rgba(215,135,255,${0.3+score*0.7})`, borderRadius:"1px" }
        })
      ),
      React.createElement("span", { style:{ fontSize:"10px", color:W.fgDim, flexShrink:0 } }, `${pct}%`)
    );
  };

  return React.createElement("div", { style:{ borderBottom:`1px solid ${W.splitBg}` } },
    React.createElement("div", {
      onClick: () => setExpanded(p => !p),
      style:{ display:"flex", alignItems:"center", gap:"8px",
              padding:"10px 16px", cursor:"pointer",
              background:"rgba(215,135,255,0.04)", userSelect:"none" }
    },
      React.createElement("span", { style:{ color:W.purple, fontSize:"13px" } }, "≈"),
      React.createElement("span", {
        style:{ color:W.blue, fontSize:"13px", fontWeight:"bold", letterSpacing:"0.6px" }
      }, similar === null ? "VERWANT LADEN…" : `${similar.length} SEMANTISCH VERWANT`),
      React.createElement("span", {
        style:{ marginLeft:"6px", fontSize:"11px", color:W.fgDim }
      }, "TF-IDF"),
      React.createElement("span", { style:{ marginLeft:"auto", color:W.fgDim, fontSize:"11px" } },
        expanded ? "▲" : "▼")
    ),

    expanded && similar !== null && React.createElement("div", { style:{ padding:"4px 0 4px" } },
      similar.map(n => {
        const linked = alreadyLinked(n.id);
        return React.createElement("div", {
          key: n.id,
          style:{ padding:"7px 16px 9px", borderBottom:`1px solid ${W.splitBg}`,
                  opacity: linked ? 0.6 : 1 },
        },
          React.createElement("div", {
            style:{ display:"flex", alignItems:"center", gap:"8px" }
          },
            React.createElement("div", {
              onClick: () => onSelect?.(n.id),
              style:{ fontSize:"14px", color:W.blue, cursor:"pointer", flex:1,
                      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
              onMouseEnter: e => e.currentTarget.style.textDecoration="underline",
              onMouseLeave: e => e.currentTarget.style.textDecoration="none",
            }, "≈ ", n.title),

            linked
              ? React.createElement("span", {
                  style:{ fontSize:"11px", color:W.comment, flexShrink:0,
                          background:"rgba(159,202,86,0.1)",
                          border:"1px solid rgba(159,202,86,0.2)",
                          borderRadius:"4px", padding:"1px 6px" }
                }, "✓ gelinkt")
              : onAddLink && React.createElement("button", {
                  onClick: async () => {
                    setAdding(n.id);
                    await onAddLink?.(n.id, n.title);
                    setAdding(null);
                  },
                  disabled: adding === n.id,
                  title: `Voeg [[${n.title}]] toe aan huidige notitie`,
                  style:{ fontSize:"11px", color:W.fgMuted, flexShrink:0, cursor:"pointer",
                          background:"rgba(138,198,242,0.08)",
                          border:"1px solid rgba(138,198,242,0.2)",
                          borderRadius:"4px", padding:"1px 6px",
                          transition:"all 0.1s" },
                  onMouseEnter: e=>{ e.currentTarget.style.color=W.blue; e.currentTarget.style.borderColor="rgba(138,198,242,0.5)"; },
                  onMouseLeave: e=>{ e.currentTarget.style.color=W.fgMuted; e.currentTarget.style.borderColor="rgba(215,135,255,0.2)"; },
                }, adding===n.id ? "…" : "+ link")
          ),
          strengthBar(n.score)
        );
      })
    ),

    expanded && similar === null && React.createElement("div", {
      style:{ padding:"10px 16px", fontSize:"13px", color:W.fgDim }
    }, "berekenen…")
  );
};

const NotePreview = ({
  note,
  notes = [],
  renderMode = "plain",
  isMobile = false,
  onEdit,
  onDelete,
  onRenderModeChange,
  onTagRemove,
  onLinkClick,
  onEditMermaid,
  backlinks = [],
  onBacklinkSelect,
  onAddLink,
  onToggleRead,   // (note) => void — toggle isRead
}) => {
  const scrollRef = React.useRef(null);

  // iOS Safari fix: zet hoogte expliciet via JS zodat overflow:auto werkt
  React.useEffect(() => {
    const el = scrollRef.current;
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
  if (!note) return React.createElement("div", {
    style: { flex: 1, display: "flex", alignItems: "center",
             justifyContent: "center", color: W.fgMuted, fontSize: "14px",
             flexDirection: "column", gap: "12px" }
  },
    React.createElement("div", { style: { fontSize: "32px" } }, "📝"),
    React.createElement("div", null, "Selecteer een zettel"),
    React.createElement("button", {
      onClick: onEdit,
      style: { marginTop: "8px", background: W.blue, color: W.bg,
               border: "none", borderRadius: "8px", padding: "10px 24px",
               fontSize: "14px", cursor: "pointer", fontWeight: "bold" }
    }, "+ nieuw zettel")
  );

  // ── Leestijd ───────────────────────────────────────────────────────────────
  const readingMins = Math.max(1, Math.round(
    (note.content||"").trim().split(/\s+/).filter(Boolean).length / 200
  ));

  // Herken imports: expliciete timestamp (nieuw) of content-patroon (bestaande notities)
  const isImported = note.importedAt ||
    /Automatisch gegenereerd door/.test(note.content||"") ||
    /\*Samenvatting:\*/.test(note.content||"") ||
    (note.tags||[]).includes("samenvatting");

  // ── Toolbar ────────────────────────────────────────────────────────────────
  const toolbar = React.createElement("div", {
    style: { display: "flex", gap: "6px", marginBottom: "16px",
             paddingBottom: "10px", borderBottom: `1px solid ${W.splitBg}`,
             alignItems: "center", flexWrap: "wrap" }
  },
    React.createElement("span", { style: { fontSize: "14px", color: W.fgMuted } }, note.id),
    ...(note.tags || []).map(t => React.createElement(TagPill, {
      key: t, tag: t,
      onRemove: () => onTagRemove?.(t),
    })),
    React.createElement("div", { style: { flex: 1 } }),

    // ── Leestijd + gelezen — gecombineerde klikbare balk (alleen bij imports) ──
    isImported
      ? React.createElement("button", {
          onClick: () => onToggleRead?.(note),
          title: note.isRead ? "Klik om als ongelezen te markeren" : "Klik om als gelezen te markeren",
          style: {
            display:"flex", alignItems:"center", gap:"6px",
            background: note.isRead ? "rgba(159,202,86,0.10)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${note.isRead ? "rgba(159,202,86,0.35)" : W.splitBg}`,
            borderRadius:"10px", padding:"3px 10px",
            cursor:"pointer", fontSize:"11px", whiteSpace:"nowrap",
            transition:"all 0.15s",
          }
        },
          // Vinkje-cirkel
          React.createElement("div", { style:{
            width:"14px", height:"14px", borderRadius:"50%", flexShrink:0,
            border:`2px solid ${note.isRead ? W.comment : W.fgMuted}`,
            background: note.isRead ? W.comment : "transparent",
            display:"flex", alignItems:"center", justifyContent:"center",
            transition:"all 0.15s",
          }},
            note.isRead && React.createElement("span",{
              style:{color:W.bg,fontSize:"9px",fontWeight:"bold",lineHeight:1}
            },"✓")
          ),
          React.createElement("span",{style:{color: note.isRead ? W.comment : W.fgMuted}},
            note.isRead ? "gelezen" : "ongelezen"
          ),
          React.createElement("span",{style:{
            color:W.fgDim,
            borderLeft:`1px solid ${W.splitBg}`,
            paddingLeft:"6px",marginLeft:"2px"
          }}, `⏱ ${readingMins} min`)
        )
      // Gewone leestijd-badge voor niet-imports
      : React.createElement("span", {
          title:`Geschatte leestijd: ${readingMins} minuut${readingMins!==1?"en":""}`,
          style:{ fontSize:"11px", color:W.fgDim, padding:"3px 8px",
                  borderRadius:"10px", border:`1px solid ${W.splitBg}`,
                  whiteSpace:"nowrap" }
        }, `⏱ ${readingMins} min`),
    React.createElement("button", {
      onClick: () => onRenderModeChange?.(renderMode === "rich" ? "plain" : "rich"),
      title: "Wisselen tussen plain en rijke markdown weergave",
      style: { background: renderMode === "rich" ? "rgba(138,198,242,0.12)" : "none",
               color:      renderMode === "rich" ? W.blue : W.fgMuted,
               border: `1px solid ${renderMode === "rich" ? "rgba(138,198,242,0.35)" : W.splitBg}`,
               borderRadius: "6px",
               padding: isMobile ? "8px 14px" : "5px 10px",
               fontSize: isMobile ? "13px" : "11px",
               cursor: "pointer", WebkitTapHighlightColor: "transparent" }
    }, renderMode === "rich" ? "📄 plain" : "🎨 render"),
    React.createElement("button", {
      onClick: onEdit,
      style: { background: "none", color: W.blue,
               border: "1px solid rgba(138,198,242,0.3)",
               borderRadius: "6px",
               padding: isMobile ? "8px 16px" : "5px 12px",
               fontSize: isMobile ? "14px" : "11px",
               cursor: "pointer", WebkitTapHighlightColor: "transparent" }
    }, "✏ bewerken"),
    !isMobile && React.createElement("button", {
      onClick: onDelete,
      style: { background: "none", color: W.orange,
               border: "1px solid rgba(229,120,109,0.2)",
               borderRadius: "6px", padding: "5px 10px",
               fontSize: "14px", cursor: "pointer" }
    }, "🗑 del")
  );

  // ── Backlinks + Outlinks + Graaf-statistieken ─────────────────────────────
  // Hulp: extraheer de zin(nen) rondom een [[link]] in een notitie als context-snippet
  const getSnippet = (content, targetId) => {
    if (!content) return null;
    const lines = content.split("\n");
    for (const line of lines) {
      if (line.includes("[[" + targetId + "]]") || line.includes("[[" + targetId)) {
        const clean = line
          .replace(/^\s*[#>\-\*]+\s*/, "")  // strip markdown prefix
          .replace(/!?\[\[([^\]]+)\]\]/g, (_, t) => t.split("|")[0]); // [[x]] → x
        return clean.trim().slice(0, 120) || null;
      }
    }
    return null;
  };

  // Outlinks: notities waarnaar deze notitie verwijst
  const outlinks = React.useMemo(() => {
    if (!note) return [];
    const ids = extractLinks(note.content);
    return ids
      .map(id => notes.find(n => n.id === id))
      .filter(Boolean);
  }, [note, notes]);

  // Statistieken
  const wordCount = React.useMemo(() => {
    if (!note?.content) return 0;
    return note.content.trim().split(/\s+/).filter(Boolean).length;
  }, [note]);

  const [blExpanded, setBlExpanded] = React.useState(true);
  const [olExpanded, setOlExpanded] = React.useState(true);

  const backlinkSection = React.createElement("div", {
    style: { marginTop: "48px", borderTop: `2px solid ${W.splitBg}`, paddingTop: "0" }
  },

    // ── Statistieken strip ────────────────────────────────────────────────────
    React.createElement("div", {
      style: { display: "flex", gap: "0", borderBottom: `1px solid ${W.splitBg}`,
               marginBottom: "0", fontSize: "12px" }
    },
      [
        { label: "woorden",   val: wordCount,          color: W.fgMuted },
        { label: "backlinks", val: backlinks.length,   color: backlinks.length  > 0 ? W.blue    : W.fgMuted },
        { label: "outlinks",  val: outlinks.length,    color: outlinks.length   > 0 ? W.comment : W.fgMuted },
        { label: "tags",      val: (note?.tags||[]).length, color: (note?.tags||[]).length > 0 ? W.comment : W.fgMuted },
      ].map(({ label, val, color }) =>
        React.createElement("div", {
          key: label,
          style: { flex: 1, padding: "10px 0", textAlign: "center",
                   borderRight: `1px solid ${W.splitBg}` }
        },
          React.createElement("div", { style: { fontSize: "20px", fontWeight: "bold", color, lineHeight: 1 } }, val),
          React.createElement("div", { style: { fontSize: "11px", color: "#c8c0b4", marginTop: "4px", letterSpacing: "0.4px" } }, label)
        )
      )
    ),

    // ── Backlinks sectie ──────────────────────────────────────────────────────
    backlinks.length > 0 && React.createElement("div", {
      style: { borderBottom: `1px solid ${W.splitBg}` }
    },
      React.createElement("div", {
        onClick: () => setBlExpanded(p => !p),
        style: { display: "flex", alignItems: "center", gap: "8px",
                 padding: "10px 16px", cursor: "pointer",
                 background: "rgba(138,198,242,0.04)",
                 userSelect: "none" }
      },
        React.createElement("span", { style: { color: W.blue, fontSize: "14px" } }, "←"),
        React.createElement("span", { style: { color: W.blue, fontSize: "13px", fontWeight: "bold",
                                                letterSpacing: "0.5px" } },
          `${backlinks.length} BACKLINK${backlinks.length !== 1 ? "S" : ""}`),
        React.createElement("span", { style: { marginLeft: "auto", color: W.fgDim, fontSize: "11px" } },
          blExpanded ? "▲" : "▼")
      ),
      blExpanded && React.createElement("div", { style: { padding: "6px 0 2px" } },
        backlinks.map(n => {
          const snippet = getSnippet(n.content, note.id);
          return React.createElement("div", {
            key: n.id,
            onClick: () => onBacklinkSelect?.(n.id),
            style: { padding: "8px 16px 10px", cursor: "pointer",
                     borderBottom: `1px solid ${W.splitBg}`,
                     transition: "background 0.1s",
                     WebkitTapHighlightColor: "transparent" },
            onMouseEnter: e => e.currentTarget.style.background = "rgba(138,198,242,0.07)",
            onMouseLeave: e => e.currentTarget.style.background = "transparent",
          },
            React.createElement("div", {
              style: { fontSize: "14px", color: W.blue, marginBottom: snippet ? "4px" : "0" }
            }, "← ", n.title || n.id),
            snippet && React.createElement("div", {
              style: { fontSize: "12px", color: W.fgMuted, lineHeight: "1.5",
                       fontStyle: "italic",
                       borderLeft: `2px solid rgba(138,198,242,0.25)`,
                       paddingLeft: "8px" }
            }, "…", snippet, "…")
          );
        })
      )
    ),

    // ── Outlinks sectie ───────────────────────────────────────────────────────
    outlinks.length > 0 && React.createElement("div", null,
      React.createElement("div", {
        onClick: () => setOlExpanded(p => !p),
        style: { display: "flex", alignItems: "center", gap: "8px",
                 padding: "10px 16px", cursor: "pointer",
                 background: "rgba(159,202,86,0.04)",
                 userSelect: "none" }
      },
        React.createElement("span", { style: { color: W.comment, fontSize: "14px" } }, "→"),
        React.createElement("span", { style: { color: W.comment, fontSize: "13px", fontWeight: "bold",
                                                letterSpacing: "0.5px" } },
          `${outlinks.length} OUTLINK${outlinks.length !== 1 ? "S" : ""}`),
        React.createElement("span", { style: { marginLeft: "auto", color: W.fgDim, fontSize: "11px" } },
          olExpanded ? "▲" : "▼")
      ),
      olExpanded && React.createElement("div", { style: { padding: "6px 0 2px" } },
        outlinks.map(n => {
          const snippet = getSnippet(note.content, n.id);
          return React.createElement("div", {
            key: n.id,
            onClick: () => onBacklinkSelect?.(n.id),
            style: { padding: "8px 16px 10px", cursor: "pointer",
                     borderBottom: `1px solid ${W.splitBg}`,
                     WebkitTapHighlightColor: "transparent" },
            onMouseEnter: e => e.currentTarget.style.background = "rgba(159,202,86,0.07)",
            onMouseLeave: e => e.currentTarget.style.background = "transparent",
          },
            React.createElement("div", {
              style: { fontSize: "14px", color: W.comment, marginBottom: snippet ? "4px" : "0" }
            }, "→ ", n.title || n.id),
            snippet && React.createElement("div", {
              style: { fontSize: "12px", color: W.fgMuted, lineHeight: "1.5",
                       fontStyle: "italic",
                       borderLeft: `2px solid rgba(159,202,86,0.25)`,
                       paddingLeft: "8px" }
            }, "…", snippet, "…")
          );
        })
      )
    )
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return React.createElement("div", {
    ref: scrollRef,
    style: { position: "absolute", inset: 0,
             overflowY: "auto",
             WebkitOverflowScrolling: "touch",
             padding: isMobile ? "16px" : "24px 32px" }
  },
    toolbar,
    React.createElement(MarkdownWithMermaid, {
      content:      note.content,
      notes,
      renderMode,
      isMobile,
      onClick:      onLinkClick,
      onEditMermaid,
    }),
    backlinkSection,
    note && React.createElement(SimilarPanel, {
      noteId: note.id,
      note: note,
      onSelect: onBacklinkSelect,
      onAddLink: onAddLink,
    })
  );
};
