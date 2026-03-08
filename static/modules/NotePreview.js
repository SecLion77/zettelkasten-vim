// ── NotePreview ───────────────────────────────────────────────────────────────
// Variable module. Pure read-only presentatie van een notitie.
// Geen state, geen API-aanroepen. Ontvangt alles via props.
// Props: note, notes, renderMode, isMobile,
//        onEdit(), onDelete(), onRenderModeChange(mode),
//        onTagRemove(tag), onLinkClick(e), onEditMermaid(code)

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
}) => {
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

  // ── Backlinks ──────────────────────────────────────────────────────────────
  const backlinkSection = backlinks.length > 0 && React.createElement("div", {
    style: { marginTop: "40px", paddingTop: "14px",
             borderTop: `1px solid ${W.splitBg}` }
  },
    React.createElement("div", {
      style: { fontSize: "14px", color: W.fgMuted,
               letterSpacing: "1.5px", marginBottom: "8px" }
    }, "BACKLINKS"),
    backlinks.map(n => React.createElement("div", {
      key: n.id,
      onClick: () => onBacklinkSelect?.(n.id),
      style: { padding: "8px 10px", cursor: "pointer",
               background: "rgba(138,198,242,0.06)",
               border: "1px solid rgba(138,198,242,0.12)",
               borderRadius: "6px", marginBottom: "6px",
               fontSize: "14px", color: W.keyword,
               WebkitTapHighlightColor: "transparent" }
    }, "← ", n.title))
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return React.createElement("div", {
    style: { flex: 1, overflowY: "auto",
             padding: isMobile ? "16px" : "24px 32px",
             WebkitOverflowScrolling: "touch" }
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
    backlinkSection
  );
};
