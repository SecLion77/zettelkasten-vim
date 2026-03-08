// ── NoteEditor ────────────────────────────────────────────────────────────────
// Variable module. Wraps VimEditor met titel-input en toolbar.
// Open/Closed: uitbreidbaar via props (spellcheck, completion) zonder interface te breken.
// Props: note, allTags, allNotesText, llmModel, isMobile, goyoMode,
//        onSave(updatedNote), onClose(), onDelete(), onToggleGoyo(),
//        onEditorRef(ref), onInsertLink(text)

const NoteEditor = ({
  note,
  allTags = [],
  allNotesText = "",
  llmModel = "",
  isMobile = false,
  goyoMode = false,
  onSave,
  onClose,
  onDelete,
  onToggleGoyo,
  onEditorRef,
  // link-dropdown state — omhoog gelift naar NotesTab (ISP)
  showLinkMenu = false,
  onToggleLinkMenu,
  linkMenuContent = null,
}) => {
  const { useState, useRef, useEffect } = React;

  const [editTitle,   setEditTitle]   = useState(note?.title   || "");
  const [editContent, setEditContent] = useState(note?.content || "");
  const [editTags,    setEditTags]    = useState(note?.tags    || []);

  const titleRef   = useRef(null);
  const contentRef = useRef(null);

  // Sync als een ander zettel wordt geopend
  useEffect(() => {
    setEditTitle(note?.title   || "");
    setEditContent(note?.content || "");
    setEditTags(note?.tags    || []);
  }, [note?.id]);

  const handleSave = () => {
    if (!note) return;
    const updated = {
      ...note,
      title:   editTitle,
      content: editContent,
      tags:    [...new Set([...editTags, ...extractTags(editContent)])],
      modified: new Date().toISOString(),
    };
    onSave?.(updated);
  };

  // ── Toolbar ────────────────────────────────────────────────────────────────
  const toolbar = React.createElement("div", {
    style: { background: W.bg2, borderBottom: `1px solid ${W.splitBg}`,
             padding: "6px 10px", display: "flex",
             alignItems: "center", gap: "6px", flexShrink: 0,
             flexWrap: isMobile ? "wrap" : "nowrap" }
  },
    // Titel input
    React.createElement("input", {
      ref: titleRef,
      value: editTitle,
      onChange: e => setEditTitle(e.target.value),
      placeholder: "Titel… (Enter = naar tekstveld)",
      onKeyDown: e => {
        if (e.key === "Enter") {
          e.preventDefault();
          setTimeout(() => { contentRef.current?.setCursor?.(2, 0); }, 40);
        }
        if (e.key === "Escape") { onClose?.(); }
      },
      style: { flex: 1, minWidth: "120px", background: "transparent",
               border: "none", color: W.statusFg,
               fontSize: isMobile ? "15px" : "16px",
               fontWeight: "bold", outline: "none", WebkitAppearance: "none" }
    }),

    // Actie-knoppen
    ...[
      { label: "◎ focus", show: true,        onClick: onToggleGoyo,
        active: goyoMode, color: goyoMode ? W.comment : W.fgMuted },
      { label: "✓ opslaan", show: true,       onClick: () => { handleSave(); onClose?.(); },
        color: W.comment, fgColor: W.bg, bold: true },
      { label: "✕ sluiten", show: true,       onClick: onClose,     color: W.fgMuted },
      { label: "🗑 del",    show: !isMobile,  onClick: onDelete,    color: W.orange },
    ].filter(b => b.show).map((b, i) => React.createElement("button", {
      key: i, onClick: b.onClick,
      style: { border: `1px solid ${b.bg || W.splitBg}`, borderRadius: "6px",
               padding: isMobile ? "7px 12px" : "4px 10px",
               color: b.fgColor || b.color,
               fontSize: isMobile ? "13px" : "11px", cursor: "pointer",
               fontWeight: b.bold ? "bold" : "normal",
               background: b.bg || (b.active ? "rgba(159,202,86,0.15)" : "none"),
               flexShrink: 0, WebkitTapHighlightColor: "transparent" }
    }, b.label)),

    // Link-dropdown slot (geleverd door NotesTab — ISP)
    linkMenuContent && React.createElement("div", {
      style: { position: "relative", flexShrink: 0 },
      onClick: e => e.stopPropagation(),
    },
      React.createElement("button", {
        onClick: onToggleLinkMenu,
        title: "Link invoegen: notitie, PDF of afbeelding",
        style: { background: showLinkMenu ? "rgba(138,198,242,0.15)" : "none",
                 border: `1px solid ${showLinkMenu ? "rgba(138,198,242,0.4)" : W.splitBg}`,
                 borderRadius: "6px", padding: isMobile ? "7px 12px" : "4px 10px",
                 color: showLinkMenu ? W.blue : W.fgMuted,
                 fontSize: isMobile ? "13px" : "11px", cursor: "pointer", flexShrink: 0 }
      }, "🔗 koppelen"),
      showLinkMenu && linkMenuContent
    )
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return React.createElement("div", {
    className: goyoMode ? "goyo-mode" : "",
    style: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }
  },
    !goyoMode && toolbar,
    React.createElement(VimEditor, {
      key:          note?.id,
      value:        editContent,
      onChange:     setEditContent,
      onSave:       handleSave,
      onEscape:     onClose,
      noteTags:     editTags,
      onTagsChange: setEditTags,
      allTags,
      goyoMode,
      onToggleGoyo,
      onEditorRef:  ref => {
        contentRef.current = ref;
        onEditorRef?.(ref);
      },
      llmModel,
      allNotesText,
    })
  );
};
