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
  const [adding,   setAdding]   = React.useState(null);

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

  const alreadyLinked = (targetId) => {
    if (!note?.content) return false;
    return note.content.includes("[[" + targetId + "]]") ||
           note.content.includes("[[" + targetId);
  };

  return React.createElement("div", {
    style: {
      margin: "24px 0 8px",
      borderRadius: "8px",
      border: `1px solid rgba(215,135,255,0.15)`,
      overflow: "hidden",
    }
  },
    // Header
    React.createElement("div", {
      onClick: () => setExpanded(p => !p),
      style: {
        display: "flex", alignItems: "center", gap: "8px",
        padding: "8px 14px", cursor: "pointer",
        background: "rgba(215,135,255,0.06)",
        borderBottom: expanded ? `1px solid rgba(215,135,255,0.12)` : "none",
        userSelect: "none",
      }
    },
      React.createElement("span", { style: { fontSize: "13px" } }, "≈"),
      React.createElement("span", {
        style: { fontSize: "11px", fontWeight: "700", color: W.purple,
                 letterSpacing: "1px" }
      }, similar === null ? "VERWANT LADEN…" : `${similar.length} SEMANTISCH VERWANT`),
      React.createElement("span", {
        style: { fontSize: "10px", color: W.fgMuted,
                 background: "rgba(255,255,255,0.05)",
                 border: `1px solid ${W.splitBg}`,
                 borderRadius: "4px", padding: "1px 5px", marginLeft: "2px" }
      }, "TF-IDF"),
      React.createElement("span", {
        style: { marginLeft: "auto", color: W.fgDim, fontSize: "11px" }
      }, expanded ? "▲" : "▼")
    ),

    // Items
    expanded && similar !== null && React.createElement("div", null,
      similar.map((n, i) => {
        const linked = alreadyLinked(n.id);
        const pct    = Math.min(100, Math.round(n.score * 300));
        return React.createElement("div", {
          key: n.id,
          style: {
            display: "flex", alignItems: "center", gap: "10px",
            padding: "8px 14px",
            borderBottom: i < similar.length - 1
              ? `1px solid rgba(215,135,255,0.08)` : "none",
            background: "transparent",
            transition: "background 0.1s",
          },
          onMouseEnter: e => e.currentTarget.style.background = "rgba(215,135,255,0.04)",
          onMouseLeave: e => e.currentTarget.style.background = "transparent",
        },
          // Sterkte-balk links
          React.createElement("div", {
            style: { width: "3px", alignSelf: "stretch", flexShrink: 0,
                     borderRadius: "2px", minHeight: "20px",
                     background: `rgba(215,135,255,${0.2 + n.score * 0.8})` }
          }),
          // Titel + score
          React.createElement("div", {
            style: { flex: 1, minWidth: 0 }
          },
            React.createElement("div", {
              onClick: () => onSelect?.(n.id),
              style: { fontSize: "13px", color: W.fg, cursor: "pointer",
                       overflow: "hidden", textOverflow: "ellipsis",
                       whiteSpace: "nowrap", lineHeight: "1.4" },
              onMouseEnter: e => e.currentTarget.style.color = W.blue,
              onMouseLeave: e => e.currentTarget.style.color = W.fg,
            }, n.title),
            React.createElement("div", {
              style: { display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }
            },
              // Mini voortgangsbalk
              React.createElement("div", {
                style: { flex: 1, height: "2px", maxWidth: "80px",
                         background: "rgba(255,255,255,0.07)", borderRadius: "1px" }
              },
                React.createElement("div", {
                  style: { width: `${pct}%`, height: "100%", borderRadius: "1px",
                           background: `rgba(215,135,255,${0.4 + n.score * 0.6})` }
                })
              ),
              React.createElement("span", {
                style: { fontSize: "10px", color: W.fgDim }
              }, `${Math.round(n.score * 100)}%`)
            )
          ),
          // Badge of knop
          linked
            ? React.createElement("span", {
                style: { fontSize: "10px", color: W.comment, flexShrink: 0,
                         background: "rgba(159,202,86,0.08)",
                         border: "1px solid rgba(159,202,86,0.2)",
                         borderRadius: "4px", padding: "2px 7px" }
              }, "✓ gelinkt")
            : onAddLink && React.createElement("button", {
                onClick: async () => {
                  setAdding(n.id);
                  await onAddLink?.(n.id, n.title);
                  setAdding(null);
                },
                disabled: adding === n.id,
                title: `Voeg [[${n.title}]] toe`,
                style: { fontSize: "11px", color: W.fgMuted, flexShrink: 0,
                         cursor: "pointer",
                         background: "rgba(138,198,242,0.06)",
                         border: `1px solid rgba(138,198,242,0.2)`,
                         borderRadius: "4px", padding: "2px 8px",
                         transition: "all 0.15s" },
                onMouseEnter: e => { e.currentTarget.style.color = W.blue;
                  e.currentTarget.style.background = "rgba(138,198,242,0.12)"; },
                onMouseLeave: e => { e.currentTarget.style.color = W.fgMuted;
                  e.currentTarget.style.background = "rgba(138,198,242,0.06)"; },
              }, adding === n.id ? "…" : "+ link")
        );
      })
    ),

    expanded && similar === null && React.createElement("div", {
      style: { padding: "10px 14px", fontSize: "12px", color: W.fgDim,
               display: "flex", alignItems: "center", gap: "8px" }
    },
      React.createElement("span", {
        style: { display: "inline-block", animation: "ai-pulse 1.2s ease-in-out infinite" }
      }, "≈"),
      "semantische verwantschap berekenen…"
    )
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
  onSummarize,    // async (note) => void — voeg samenvatting toe aan notitie
  onAddSmartLinks, // async (note, links[]) => void — voeg slimme links toe aan notitie
  onToggleReview, // (noteId) => void — markeer voor review
  reviewData = {}, // { noteId: {...} }
  llmModel = "",
  allNotes = [],
}) => {
  const scrollRef = React.useRef(null);
  const [summarizing,     setSummarizing]     = React.useState(false);
  const [sumError,        setSumError]        = React.useState(null);
  const [showLinkPanel,   setShowLinkPanel]   = React.useState(false);

  const doSummarize = React.useCallback(async () => {
    if (!note || summarizing) return;
    setSummarizing(true); setSumError(null);
    try {
      const resp = await fetch("/api/llm/summarize-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_id: note.id, model: llmModel }),
      });
      const data = await resp.json();
      if (data.ok && data.summary) {
        await onSummarize?.(note, data.summary);
      } else {
        setSumError(data.error || "Geen samenvatting ontvangen");
      }
    } catch(e) {
      setSumError(e.message);
    } finally {
      setSummarizing(false);
    }
  }, [note, llmModel, onSummarize, summarizing]);

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

    // ── Samenvatten knop ─────────────────────────────────────────────────────
    llmModel && React.createElement("button", {
      onClick: doSummarize,
      disabled: summarizing,
      title: summarizing ? "Samenvatting genereren…" : "Voeg AI-samenvatting toe bovenaan de notitie",
      style: {
        background: summarizing ? "rgba(159,202,86,0.08)" : "none",
        color: summarizing ? W.comment : W.fgMuted,
        border: `1px solid ${summarizing ? "rgba(159,202,86,0.35)" : W.splitBg}`,
        borderRadius: "6px",
        padding: isMobile ? "8px 14px" : "5px 10px",
        fontSize: isMobile ? "13px" : "11px",
        cursor: summarizing ? "not-allowed" : "pointer",
        opacity: summarizing ? 0.7 : 1,
        WebkitTapHighlightColor: "transparent",
        animation: summarizing ? "ai-pulse 1.4s ease-in-out infinite" : "none",
      }
    }, summarizing ? "⏳ samenvatten…" : "🧠 samenvatten"),
    sumError && React.createElement("span", {
      title: sumError,
      onClick: () => setSumError(null),
      style: { fontSize: "11px", color: W.orange, cursor: "pointer" }
    }, "⚠"),
    // Slimme links knop
    llmModel && note && React.createElement("button", {
      onClick: () => setShowLinkPanel(p => !p),
      style: {
        background: showLinkPanel ? "rgba(159,202,86,0.12)" : "none",
        color: showLinkPanel ? W.comment : W.fgMuted,
        border: `1px solid ${showLinkPanel ? "rgba(159,202,86,0.35)" : W.splitBg}`,
        borderRadius: "6px",
        padding: isMobile ? "8px 14px" : "5px 10px",
        fontSize: isMobile ? "13px" : "11px",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
      }
    }, "🔗 links"),
    // Review-knop — altijd zichtbaar als onToggleReview beschikbaar is
    note && React.createElement("button", {
      onClick: () => onToggleReview?.(note.id),
      title: reviewData[note?.id]
        ? "Staat in review-lijst — klik om te verwijderen"
        : "Markeer voor review",
      style: {
        background: reviewData[note?.id]
          ? "rgba(234,231,136,0.15)" : "rgba(255,255,255,0.03)",
        color: reviewData[note?.id] ? W.yellow : W.fgMuted,
        border: `1px solid ${reviewData[note?.id]
          ? "rgba(234,231,136,0.35)" : W.splitBg}`,
        borderRadius: "5px",
        padding: isMobile ? "8px 12px" : "5px 9px",
        fontSize: isMobile ? "13px" : "11px",
        cursor: "pointer", touchAction: "manipulation",
        display: "flex", alignItems: "center", gap: "4px",
        transition: "all 0.15s",
      }
    },
      "🔁",
      !isMobile && React.createElement("span", null,
        reviewData[note?.id] ? "in review" : "review"
      )
    ),
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


  // ── Render ─────────────────────────────────────────────────────────────────
  // Wrapper: flex-column zodat toolbar vast staat en content scrollt
  return React.createElement("div", {
    style: { position: "absolute", inset: 0,
             display: "flex", flexDirection: "column", overflow: "hidden" }
  },
    // Vaste toolbar — scrollt NIET mee
    React.createElement("div", {
      style: { flexShrink: 0,
               padding: isMobile ? "10px 16px" : "14px 32px 0",
               borderBottom: `1px solid ${W.splitBg}`,
               background: W.bg }
    }, toolbar),

    // Scrollbare content
    React.createElement("div", {
      ref: scrollRef,
      style: { flex: 1, overflowY: "auto",
               WebkitOverflowScrolling: "touch",
               padding: isMobile ? "16px" : "24px 32px" }
    },
    React.createElement(MarkdownWithMermaid, {
      content:      note.content,
      notes,
      renderMode,
      isMobile,
      onClick:      onLinkClick,
      onEditMermaid,
    }),
    note && React.createElement(SimilarPanel, {
      noteId: note.id,
      note: note,
      onSelect: onBacklinkSelect,
      onAddLink: onAddLink,
    }),
    // Slimme links paneel (inline, onder de notitie)
    showLinkPanel && note && React.createElement("div", {
      style: {
        margin: "24px 0 8px",
        borderRadius: "8px",
        border: `1px solid rgba(159,202,86,0.2)`,
        overflow: "hidden",
      }
    },
      React.createElement("div", {
        style: { background: "rgba(159,202,86,0.06)", padding: "8px 14px",
                 borderBottom: `1px solid rgba(159,202,86,0.12)`,
                 fontSize: "11px", fontWeight: "700", color: W.comment,
                 letterSpacing: "1px", display: "flex", alignItems: "center",
                 justifyContent: "space-between" }
      },
        "🔗 SLIMME LINKS",
        React.createElement("button", {
          onClick: () => setShowLinkPanel(false),
          style: { background: "none", border: "none", color: W.fgMuted,
                   cursor: "pointer", fontSize: "14px", lineHeight: 1 }
        }, "×")
      ),
      React.createElement("div", { style: { padding: "10px" } },
        React.createElement(SmartLinkSuggester, {
          content:      note.content || "",
          noteId:       note.id,
          allNotes,
          llmModel,
          onInsertLink: (linkText) => onAddSmartLinks?.(note, [linkText]),
          compact:      false,
          autoLoad:     true,
        })
      )
    )
    )  // sluit scroll-container
  );   // sluit outer wrapper
};
