// ── NoteEditor ────────────────────────────────────────────────────────────────
// Variable module. Wraps VimEditor met titel-input, SmartTagEditor en toolbar.
// Open/Closed: uitbreidbaar via props (spellcheck, completion) zonder interface te breken.
// Props: note, allTags, allNotesText, llmModel, isMobile, goyoMode,
//        onSave(updatedNote), onClose(), onDelete(), onToggleGoyo(),
//        onEditorRef(ref), onInsertLink(text)

const NoteEditor = ({
  note,
  allTags = [],
  allNotesText = "",
  llmModel = "",
  taskLlmModels = {},
  isMobile = false,
  goyoMode = false,
  onSave,
  onClose,
  onDelete,
  onToggleGoyo,
  onEditorRef,
  notes = [],           // voor [[ autocomplete + promoveer
  showLinkMenu = false,
  onToggleLinkMenu,
  linkMenuContent = null,
  onSplitCmd = null,
}) => {
  const { useState, useRef, useEffect } = React;

  const [editTitle,   setEditTitle]   = useState(note?.title   || "");
  const [editContent, setEditContent] = useState(note?.content || "");
  const [editTags,    setEditTags]    = useState(note?.tags    || []);

  // iPad/iOS: detecteer touch-apparaat voor native textarea modus
  const isTouch = typeof window !== "undefined" &&
    ("ontouchstart" in window || navigator.maxTouchPoints > 0);

  // Op touch-apparaten: start expliciet in OutlineEditor (gewone textarea,
  // geen modale Vim-toetsen nodig) i.p.v. impliciet met VimEditor te starten
  // en de gebruiker zelf de kleine toolbar-knop te laten vinden. VimEditor
  // blijft één klik weg voor wie een toetsenbord heeft aangesloten.
  const [outlineMode, setOutlineMode] = useState(isTouch);

  const titleRef   = useRef(null);
  const contentRef = useRef(null);
  const touchAreaRef = useRef(null); // voor iPad textarea

  // Promoveer-suggestie: toon als notitie rijp is
  const promoteSuggestion = React.useMemo(() => {
    if (!note || note.noteType !== "fleeting") return null;
    const ageMs = Date.now() - new Date(note.created || note.modified || 0).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    // Tel links in content
    const linkCount = (note.content || "").match(/\[\[/g)?.length || 0;
    if (ageDays >= 2 || linkCount >= 2) {
      return {
        reason: ageDays >= 2
          ? `${Math.floor(ageDays)} dagen oud`
          : `${linkCount} wiki-links`,
      };
    }
    return null;
  }, [note?.id, note?.noteType, note?.created, note?.content]);

  // Sync als een ander zettel wordt geopend
  useEffect(() => {
    setEditTitle(note?.title   || "");
    setEditContent(note?.content || "");
    setEditTags(note?.tags    || []);

    if (!note) return;
    if (!note.title) {
      // Nieuwe notitie: autoFocus attribuut regelt focus synchroon.
      // Hier extra select() zodat een eventuele placeholder verdwijnt.
      // Kleine delay OK want select() is niet gevoelig voor iOS focus-restrictie.
      setTimeout(() => { titleRef.current?.select(); }, 60);
    } else {
      // Bestaande notitie: cursor naar onderste regel in editor
      setTimeout(() => {
        const ref = contentRef.current;
        if (ref?.setCursor) {
          const lines = (note.content || "").split("\n");
          ref.setCursor(lines.length - 1, lines[lines.length - 1].length);
        }
      }, 80);
    }
  }, [note?.id]);

  const [titleError, setTitleError] = React.useState(false);

  // Verwijder foutmelding zodra de gebruiker begint te typen
  const onTitleChange = (e) => {
    setEditTitle(e.target.value);
    if (e.target.value.trim()) setTitleError(false);
  };

  const handleSave = () => {
    if (!note) return false;
    if (!editTitle.trim()) {
      // Blokkeer opslaan — toon foutmelding, zet focus op titel
      setTitleError(true);
      setTimeout(() => titleRef.current?.focus(), 50);
      return false; // geeft false terug zodat onClose NIET aangroepen wordt
    }
    setTitleError(false);
    const updated = {
      ...note,
      title:   editTitle,
      content: editContent,
      tags:    [...new Set([...editTags, ...extractTags(editContent)])],
      modified: new Date().toISOString(),
    };
    onSave?.(updated);
    return true;
  };

  // ── Toolbar ────────────────────────────────────────────────────────────────
  const toolbar = React.createElement("div", {
    style: { background: W.bg2, borderBottom: `1px solid ${W.splitBg}`,
             padding: "6px 10px", display: "flex",
             alignItems: "center", gap: "6px", flexShrink: 0,
             flexWrap: isMobile ? "wrap" : "nowrap" }
  },
    // Titel input — autoFocus als de titel leeg is (nieuwe notitie)
    React.createElement("input", {
      ref: titleRef,
      value: editTitle,
      autoFocus: !note?.title,
      onChange: onTitleChange,
      placeholder: note?._draft ? "Titel verplicht om op te slaan…" : "Titel…",
      style: { flex: 1, minWidth: "120px", background: "transparent",
               border: titleError ? `1px solid ${W.orange}` : "none",
               borderRadius: titleError ? "4px" : "0",
               color: titleError ? W.orange : W.statusFg,
               fontSize: isMobile ? "15px" : "16px",
               fontWeight: "bold", outline: "none", WebkitAppearance: "none",
               padding: titleError ? "2px 6px" : "0",
               transition: "border .15s, color .15s" },
      onKeyDown: e => {
        if (e.key === "Enter") {
          e.preventDefault();
          setTimeout(() => { contentRef.current?.setCursor?.(2, 0); }, 40);
        }
        if (e.key === "Escape") { onClose?.(); }
      },
      style: { flex: 1, minWidth: "120px", background: "transparent",
               border: titleError ? `1px solid ${W.orange}` : "none",
               borderRadius: titleError ? "4px" : "0",
               color: titleError ? W.orange : W.statusFg,
               fontSize: isMobile ? "15px" : "16px",
               fontWeight: "bold", outline: "none", WebkitAppearance: "none",
               padding: titleError ? "2px 6px" : "0",
               transition: "border .15s, color .15s" },
    }),

    // Actie-knoppen
    ...[
      { label: "◎ focus", show: true,        onClick: onToggleGoyo,
        active: goyoMode, color: goyoMode ? W.comment : W.fgMuted },
      // Altijd zichtbaar op touch (ongeacht isMobile, dat puur op vensterbreedte
      // let en in iPad-split-view/kleinere iPads al snel "mobiel" aangeeft) —
      // anders is er geen zichtbare uitweg uit modale Vim op zo'n scherm.
      { label: outlineMode ? "⌨ Vim" : "☰ Outline", show: !isMobile || isTouch,
        onClick: () => setOutlineMode(p => !p),
        title: outlineMode
          ? "Wissel naar Vim-editor (toetsenbord aanbevolen)"
          : "Wissel naar eenvoudige outline-editor (geen toetsenbord-commando's nodig)",
        active: outlineMode, color: outlineMode ? W.purple : W.fgMuted },
      { label: "✓ opslaan", show: true,       onClick: () => { if (handleSave()) onClose?.(); },
        color: W.bg, fgColor: W.bg, bg: "rgba(159,202,86,0.85)", bold: true },
      { label: "✕ sluiten", show: true,       onClick: onClose,     color: W.fgMuted },
      { label: "🗑 del",    show: !isMobile,  onClick: onDelete,    color: W.orange },
    ].filter(b => b.show).map((b, i) => React.createElement("button", {
      key: i, onClick: b.onClick, title: b.title,
      style: { border: `1px solid ${b.bg || W.splitBg}`, borderRadius: "6px",
               padding: isMobile ? "7px 12px" : "4px 10px",
               color: b.fgColor || b.color,
               fontSize: isMobile ? "13px" : "11px", cursor: "pointer",
               fontWeight: b.bold ? "bold" : "normal",
               background: b.bg || (b.active ? W.commentBg2 : "none"),
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
        style: { background: showLinkMenu ? W.blueBg2 : "none",
                 border: `1px solid ${showLinkMenu ? W.blueBorder : W.splitBg}`,
                 borderRadius: "6px", padding: isMobile ? "7px 12px" : "4px 10px",
                 color: showLinkMenu ? W.blue : W.fgMuted,
                 fontSize: isMobile ? "13px" : "11px", cursor: "pointer", flexShrink: 0 }
      }, "🔗 koppelen"),
      showLinkMenu && linkMenuContent
    )
  );

  // ── Tag strip ──────────────────────────────────────────────────────────────
  const tagStrip = !goyoMode && React.createElement("div", {
    style: {
      background: W.bg,
      borderBottom: `1px solid ${W.splitBg}`,
      padding: "5px 10px",
      flexShrink: 0,
    }
  },
    React.createElement(SmartTagEditor, {
      tags:     editTags,
      onChange: setEditTags,
      allTags,
      content:  editContent,
      llmModel,
    })
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  const titleErrorBanner = titleError && React.createElement("div", {
    style: {
      background: "rgba(229,120,109,.12)",
      borderBottom: "1px solid rgba(229,120,109,.3)",
      padding: "6px 14px", fontSize: "12px",
      color: W.orange,
      display: "flex", alignItems: "center", gap: "6px",
      flexShrink: 0, animation: "fadeIn .15s ease-out",
    }
  },
    React.createElement("span", null, "⚠"),
    React.createElement("span", null, "Vul eerst een titel in om op te slaan")
  );

  return React.createElement("div", {
    className: goyoMode ? "goyo-mode" : "",
    style: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }
  },
    !goyoMode && toolbar,
    titleErrorBanner,
    tagStrip,
    // Promoveer-suggestie banner
    promoteSuggestion && !goyoMode && React.createElement("div", {
      style: {
        background: "rgba(232,200,122,0.07)",
        borderBottom: `1px solid rgba(232,200,122,0.2)`,
        padding: "6px 12px",
        display: "flex", alignItems: "center", gap: "10px",
        flexShrink: 0,
      }
    },
      React.createElement("span", { style: { fontSize: "13px" } }, "✨"),
      React.createElement("span", {
        style: { flex: 1, fontSize: "11px", color: "#e8c87a", lineHeight: "1.4" }
      }, `Deze notitie is rijp (${promoteSuggestion.reason}) — promoveer naar Permanent?`),
      React.createElement("button", {
        onClick: () => {
          if (!note) return;
          const updated = { ...note, title: editTitle, content: editContent,
                            tags: editTags, noteType: "permanent",
                            modified: new Date().toISOString() };
          onSave?.(updated);
        },
        style: {
          background: "rgba(166,209,137,0.15)",
          border: "1px solid rgba(166,209,137,0.35)",
          borderRadius: "5px", color: "#a6d189",
          padding: "3px 10px", fontSize: "11px",
          cursor: "pointer", fontWeight: "600", flexShrink: 0,
        }
      }, "→ Permanent"),
      React.createElement("button", {
        onClick: () => {
          if (!note) return;
          const updated = { ...note, noteType: "literature",
                            modified: new Date().toISOString() };
          onSave?.(updated);
        },
        style: {
          background: "none", border: "1px solid rgba(125,216,198,0.3)",
          borderRadius: "5px", color: W.blue,
          padding: "3px 10px", fontSize: "11px",
          cursor: "pointer", flexShrink: 0,
        }
      }, "→ Literatuur")
    ),

    outlineMode
      ? React.createElement(OutlineEditor, {
          value:    editContent,
          onChange: setEditContent,
          notes:    notes || [],
          noteId:   note?.id || "",
          onSave:   handleSave,
        })
      : React.createElement(VimEditor, {
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
      taskLlmModel: taskLlmModels?.textImprove || "",
      allNotesText,
      onSplitCmd,
      noteId:       note?.id,
      hideTagStrip: true,
      notes,        // voor [[ wiki-link autocomplete
    })
  );
};
