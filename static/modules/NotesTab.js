// ── NotesTab ──────────────────────────────────────────────────────────────────
// Variable module. Orkestratielaag voor de notities-tab.
// Combineert NoteList, NoteEditor, NotePreview, NotesMeta.
// App.jsx hoeft niet te weten hoe notities intern werken — alleen deze interface:
//
// Props: notes[], allTags, selectedId, onSelectNote(id), onNotesChange(notes[])
//        serverPdfs[], serverImages[], llmModel, isMobile, isDesktop, isTablet
//        sidebarOpen, onSidebarToggle, goyoMode, onGoyoChange(bool)

const NotesTab = ({
  notes = [],
  allTags = [],
  selectedId = null,
  onSelectNote,
  onNotesChange,
  serverPdfs = [],
  serverImages = [],
  llmModel = "",
  isMobile = false,
  isDesktop = false,
  isTablet = false,
  sidebarOpen = false,
  onSidebarToggle,
  goyoMode = false,
  onGoyoChange,
  onSplitCmd = null,       // doorgeven aan NoteEditor → VimEditor
  pasteQueue = [],         // blokken klaar om in de editor te plakken
  onPasteConsumed = null,  // () => void — na verwerking
  editorFocusTrigger = 0, // verhoog om editor-canvas te focussen (split-wissel)
}) => {
  const { useState, useRef, useMemo, useCallback, useEffect } = React;

  // Verwerk paste-queue: plak eerste blok in open editor
  useEffect(() => {
    if (!pasteQueue.length) return;
    const block = pasteQueue[0];
    const ref = contentRef.current;
    if (ref?.insertAtCursor) {
      ref.insertAtCursor(block);
    }
    onPasteConsumed?.();
  }, [pasteQueue]);

  // Split-focus terug naar editor: focust canvas op de plek waar de cursor stond
  useEffect(() => {
    if (editorFocusTrigger > 0) {
      setTimeout(() => contentRef.current?.focus(), 30);
    }
  }, [editorFocusTrigger]);

  // ── Lokale UI-state (behoort alleen tot NotesTab) ─────────────────────────
  const [vimMode,       setVimMode]       = useState(false);
  const [search,        setSearch]        = useState("");
  const [tagFilter,     setTagFilter]     = useState(null);
  const [renderMode,    setRenderMode]    = useState("plain");
  const [showMeta,      setShowMeta]      = useState(false);
  const [showLinkMenu,  setShowLinkMenu]  = useState(false);
  const [linkSearch,    setLinkSearch]    = useState("");
  const [linkTypeFilter,setLinkTypeFilter]= useState("all");
  const [mermaidEdit,   setMermaidEdit]   = useState(null); // {noteId, code}

  const contentRef = useRef(null);
  const sidebarW   = isMobile ? Math.min(320, window.innerWidth - 40) : 240;
  const [tabletSidebarOpen, setTabletSidebarOpen] = useState(true);

  const selNote = useMemo(() =>
    notes.find(n => n.id === selectedId) || null,
  [notes, selectedId]);

  const backlinks = useMemo(() =>
    selectedId ? notes.filter(n => extractLinks(n.content).includes(selectedId)) : [],
  [notes, selectedId]);

  const allNotesText = useMemo(() =>
    notes.map(n => (n.title || "") + " " + (n.content || "")).join("\n"),
  [notes]);

  // Sluit link-dropdown bij klik buiten
  useEffect(() => {
    if (!showLinkMenu) return;
    const h = () => { setShowLinkMenu(false); setLinkSearch(""); };
    setTimeout(() => document.addEventListener("click", h), 0);
    return () => document.removeEventListener("click", h);
  }, [showLinkMenu]);

  // ── Note-acties (praten via NoteStore) ────────────────────────────────────
  const todayHeader = () => {
    const d   = new Date();
    const dag = ["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"][d.getDay()];
    return `${dag} ${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
  };

  const handleNew = useCallback(async () => {
    const id      = genId();
    const content = `*${todayHeader()}*\n\n`;
    const note    = { id, title: "", content, tags: [],
                      created:  new Date().toISOString(),
                      modified: new Date().toISOString() };
    setVimMode(true);
    if (!isDesktop && !isTablet) onSidebarToggle?.(false);
    const saved = await NoteStore.save(note);
    onNotesChange(NoteStore.getAll());
    onSelectNote(saved.id);
  }, [isDesktop, isTablet]);

  const handleSelect = useCallback((id) => {
    onSelectNote(id);
    setVimMode(false);
    if (!isDesktop && !isTablet) onSidebarToggle?.(false);
  }, [isDesktop, isTablet]);

  const handleSave = useCallback(async (updatedNote) => {
    await NoteStore.save(updatedNote);
    onNotesChange(NoteStore.getAll());
  }, []);

  const handleSaveAndClose = useCallback(async (updatedNote) => {
    await handleSave(updatedNote);
    setVimMode(false);
  }, [handleSave]);

  // ── Link toevoegen vanuit SimilarPanel ────────────────────────────────────
  const handleAddLink = useCallback(async (targetId, targetTitle) => {
    if (!selNote) return;
    const linkText = `\n\n[[${targetId}]]`;
    const updated = { ...selNote, content: (selNote.content || "") + linkText };
    await handleSave(updated);
  }, [selNote, handleSave]);

  const handleDelete = useCallback(async () => {
    if (!selNote || !window.confirm("Verwijder dit zettel?")) return;
    await NoteStore.remove(selNote.id);
    const rest = NoteStore.getAll();
    onNotesChange(rest);
    onSelectNote(rest[0]?.id || null);
    setVimMode(false);
  }, [selNote]);

  const handleTagRemove = useCallback(async (tag) => {
    if (!selNote) return;
    const updated = { ...selNote, tags: (selNote.tags || []).filter(t => t !== tag) };
    await NoteStore.save(updated);
    onNotesChange(NoteStore.getAll());
  }, [selNote]);

  const handleLinkClick = useCallback(e => {
    const mm = e.target.closest(".mermaid-mindmap-block");
    if (mm) {
      const code = mm.dataset.mermaid?.replace(/&#10;/g, "\n").replace(/&quot;/g, '"') || "";
      setMermaidEdit({ noteId: selectedId, code });
      return;
    }
    const el = e.target.closest(".zlink");
    if (!el) return;
    const n = notes.find(x => x.id === el.dataset.id || x.title === el.dataset.id);
    if (n) { onSelectNote(n.id); setVimMode(false); }
  }, [notes, selectedId]);

  const handleMermaidSave = useCallback(async ({ title, content, tags }) => {
    if (!mermaidEdit) return;
    const note = notes.find(n => n.id === mermaidEdit.noteId);
    if (note) {
      const updated = { ...note, content, title: title || note.title,
                        modified: new Date().toISOString() };
      await NoteStore.save(updated);
      onNotesChange(NoteStore.getAll());
    }
    setMermaidEdit(null);
  }, [mermaidEdit, notes]);

  // ── Link-dropdown content (doorgegeven aan NoteEditor) ────────────────────
  const buildLinkDropdown = () => {
    const insert = (text) => {
      contentRef.current?.insertAtCursor
        ? contentRef.current.insertAtCursor(text)
        : null;
      setShowLinkMenu(false);
    };

    const matchNotes = notes.filter(n =>
      n.id !== selectedId &&
      (!linkSearch || n.title?.toLowerCase().includes(linkSearch.toLowerCase()) ||
       (n.tags || []).some(t => t.includes(linkSearch.toLowerCase())))
    ).slice(0, 20);

    const matchPdfs = (serverPdfs || []).filter(p =>
      !linkSearch || p.name.toLowerCase().includes(linkSearch.toLowerCase())
    ).slice(0, 15);

    const matchImgs = (serverImages || []).filter(i =>
      !linkSearch || i.name.toLowerCase().includes(linkSearch.toLowerCase())
    ).slice(0, 15);

    return React.createElement("div", {
      style: { position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 210,
               background: W.bg2, border: `1px solid ${W.splitBg}`, borderRadius: "8px",
               width: "300px", maxHeight: "420px", display: "flex", flexDirection: "column",
               boxShadow: "0 8px 32px rgba(0,0,0,0.75)" }
    },
      // Type-filter tabs
      React.createElement("div", { style: { display: "flex", borderBottom: `1px solid ${W.splitBg}`, flexShrink: 0 } },
        [["all","Alles"],["notes","📝 Notities"],["pdf","📄 PDF"],["images","🖼 Plaatjes"]].map(([id,lbl]) =>
          React.createElement("button", {
            key: id, onClick: () => setLinkTypeFilter(id),
            style: { flex: 1,
                     background: linkTypeFilter === id ? "rgba(138,198,242,0.12)" : "none",
                     border: "none",
                     borderBottom: linkTypeFilter === id ? `2px solid ${W.blue}` : "2px solid transparent",
                     color: linkTypeFilter === id ? W.blue : "#c8c0b4",
                     fontSize: "12px", padding: "8px 2px", cursor: "pointer", letterSpacing: "0.2px",
                     fontWeight: linkTypeFilter === id ? "600" : "400" }
          }, lbl)
        )
      ),
      // Zoekbalk
      React.createElement("div", { style: { padding: "7px 10px", borderBottom: `1px solid ${W.splitBg}`, flexShrink: 0 } },
        React.createElement("input", {
          autoFocus: true, value: linkSearch,
          onChange: e => setLinkSearch(e.target.value),
          placeholder: "Zoeken…",
          style: { width: "100%", background: "rgba(255,255,255,0.06)",
                   border: `1px solid ${W.splitBg}`, borderRadius: "5px",
                   padding: "5px 9px", color: W.fg, fontSize: "14px",
                   outline: "none", fontFamily: "inherit" }
        })
      ),
      // Resultaten
      React.createElement("div", { style: { overflowY: "auto", flex: 1 } },
        // Notities
        (linkTypeFilter === "all" || linkTypeFilter === "notes") && matchNotes.length > 0 &&
          React.createElement(React.Fragment, null,
            linkTypeFilter === "all" && React.createElement("div", {
              style: { padding: "5px 12px 4px", fontSize: "11px", color: "#c8c0b4",
                       letterSpacing: "1.2px", fontWeight: "600", background: "rgba(0,0,0,0.2)", flexShrink: 0 }
            }, "NOTITIES"),
            matchNotes.map(n => React.createElement("div", {
              key: n.id,
              onMouseDown: e => { e.preventDefault(); insert("[[" + n.title + "]]"); },
              style: { padding: "7px 12px", cursor: "pointer",
                       borderBottom: "1px solid rgba(255,255,255,0.03)",
                       display: "flex", flexDirection: "column", gap: "1px" }
            },
              React.createElement("span", {
                style: { fontSize: "14px", color: W.fg,
                         overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
              }, n.title),
              (n.tags || []).length > 0 && React.createElement("div", {
                style: { display:"flex", gap:"3px", flexWrap:"wrap", marginTop:"2px" }
              }, (n.tags || []).slice(0,4).map(t => React.createElement("span", {
                key:t, style:{
                  fontSize:"11px", color:"#b8e06a", fontWeight:"500",
                  background:"rgba(159,202,86,0.12)", border:"1px solid rgba(159,202,86,0.35)",
                  borderRadius:"4px", padding:"1px 6px", lineHeight:"1.3",
                }
              }, "#" + t)))
            ))
          ),
        // PDFs
        (linkTypeFilter === "all" || linkTypeFilter === "pdf") && matchPdfs.length > 0 &&
          React.createElement(React.Fragment, null,
            linkTypeFilter === "all" && React.createElement("div", {
              style: { padding: "5px 12px 4px", fontSize: "11px", color: W.orange,
                       letterSpacing: "1.2px", fontWeight: "600", background: "rgba(0,0,0,0.2)" }
            }, "PDF"),
            matchPdfs.map(p => React.createElement("div", {
              key: p.name,
              onMouseDown: e => { e.preventDefault(); insert("\n\n> 📄 **PDF:** [[pdf:" + p.name + "]]\n"); },
              style: { padding: "7px 12px", cursor: "pointer",
                       borderBottom: "1px solid rgba(255,255,255,0.03)",
                       display: "flex", alignItems: "center", gap: "8px" }
            },
              React.createElement("span", { style: { fontSize: "14px" } }, "📄"),
              React.createElement("span", {
                style: { fontSize: "14px", color: W.fgDim,
                         overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }
              }, p.name)
            ))
          ),
        // Afbeeldingen
        (linkTypeFilter === "all" || linkTypeFilter === "images") && matchImgs.length > 0 &&
          React.createElement(React.Fragment, null,
            linkTypeFilter === "all" && React.createElement("div", {
              style: { padding: "5px 12px 4px", fontSize: "11px", color: W.blue,
                       letterSpacing: "1.2px", fontWeight: "600", background: "rgba(0,0,0,0.2)" }
            }, "AFBEELDINGEN"),
            matchImgs.map(img => React.createElement("div", {
              key: img.name,
              onMouseDown: e => { e.preventDefault(); insert("\n\n![[img:" + img.name + "]]\n"); },
              style: { padding: "7px 12px", cursor: "pointer",
                       borderBottom: "1px solid rgba(255,255,255,0.03)",
                       display: "flex", alignItems: "center", gap: "8px" }
            },
              React.createElement("span", { style: { fontSize: "14px" } }, "🖼"),
              React.createElement("span", {
                style: { fontSize: "14px", color: W.fgDim,
                         overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }
              }, img.name)
            ))
          ),
        // Lege staat
        matchNotes.length === 0 && matchPdfs.length === 0 && matchImgs.length === 0 &&
          React.createElement("div", {
            style: { padding: "20px", color: W.fgMuted, fontSize: "14px", textAlign: "center" }
          }, "Geen resultaten")
      )
    );
  };

  // ── Sidebar inhoud ────────────────────────────────────────────────────────
  const sidebar = React.createElement(NoteList, {
    notes,
    selectedId,
    search,
    tagFilter,
    onSelect:          handleSelect,
    onNew:             handleNew,
    onSearchChange:    setSearch,
    onTagFilterChange: setTagFilter,
    isMobile,
    onCloseSidebar:    () => onSidebarToggle?.(false),
  });

  // ── Hoofd content (editor of preview) ────────────────────────────────────
  const mainContent = selNote && vimMode
    ? React.createElement(NoteEditor, {
        note:             selNote,
        allTags,
        allNotesText,
        llmModel,
        isMobile,
        goyoMode,
        onSave:           handleSaveAndClose,
        onClose:          () => setVimMode(false),
        onDelete:         handleDelete,
        onToggleGoyo:     () => onGoyoChange?.(!goyoMode),
        onEditorRef:      ref => { contentRef.current = ref; },
        showLinkMenu,
        onToggleLinkMenu: () => { setShowLinkMenu(v => !v); setLinkSearch(""); setLinkTypeFilter("all"); },
        linkMenuContent:  showLinkMenu ? buildLinkDropdown() : null,
        onSplitCmd,
      })
    : React.createElement("div", { style: { flex: 1, position: "relative", minHeight: 0, overflow: "hidden" } },
        React.createElement(NotePreview, {
          note:               selNote,
          notes,
          renderMode,
          isMobile,
          onEdit:             () => {
            if (selNote) { setVimMode(true); if (!isDesktop && !isTablet) onSidebarToggle?.(false); }
            else handleNew();
          },
          onDelete:           handleDelete,
          onRenderModeChange: setRenderMode,
          onTagRemove:        handleTagRemove,
          onLinkClick:        handleLinkClick,
          onEditMermaid:      code => setMermaidEdit({ noteId: selectedId, code }),
          backlinks,
          onBacklinkSelect:   id => { onSelectNote(id); setVimMode(false); },
          onAddLink:          handleAddLink,
          onToggleRead:       async (note) => {
            const updated = { ...note, isRead: !note.isRead, modified: new Date().toISOString() };
            await NoteStore.save(updated);
            onNotesChange(NoteStore.getAll());
          },
        }),
        isDesktop && !goyoMode && React.createElement(NotesMeta, {
          note:          selNote,
          notes,
          showPanel:     showMeta,
          onTogglePanel: () => setShowMeta(p => !p),
          onSelectNote:  id => onSelectNote(id),
          onTagRemove:   handleTagRemove,
        })
      );

  // ── Mermaid editor overlay ────────────────────────────────────────────────
  const mermaidOverlay = mermaidEdit && React.createElement("div", {
    style: { position: "fixed", inset: 0, zIndex: 500,
             background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "stretch" }
  },
    React.createElement("div", {
      style: { flex: 1, margin: "24px", borderRadius: "10px", overflow: "hidden",
               border: `1px solid ${W.splitBg}`, boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
               display: "flex", flexDirection: "column" }
    },
      React.createElement(MermaidEditor, {
        initialText: mermaidEdit.code,
        notes, serverPdfs, serverImages,
        onSave:   handleMermaidSave,
        onCancel: () => setMermaidEdit(null),
      })
    )
  );

  // ── Render ────────────────────────────────────────────────────────────────
  const tabletToggleBtn = isTablet && React.createElement("button", {
    onClick: () => setTabletSidebarOpen(p => !p),
    title: tabletSidebarOpen ? "Lijst inklappen" : "Lijst uitklappen",
    style: {
      background: "none", border: "none",
      borderRight: `1px solid ${W.splitBg}`,
      color: tabletSidebarOpen ? W.blue : W.fgMuted,
      padding: "0 10px", height: "100%",
      fontSize: "16px", cursor: "pointer", flexShrink: 0,
    }
  }, tabletSidebarOpen ? "◀" : "▶");

  return React.createElement("div", {
    style: { flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }
  },
    mermaidOverlay,

    // Sidebar — desktop altijd zichtbaar, tablet inklapbaar
    (isDesktop || (isTablet && tabletSidebarOpen)) && React.createElement("div", {
      className: "sidebar",
      style: {
        width: isTablet ? "200px" : `${sidebarW}px`, flexShrink: 0,
        borderRight: `1px solid ${W.splitBg}`,
        display: "flex", flexDirection: "column",
        minHeight: 0, overflow: "hidden",
        transition: isTablet ? "width 0.2s ease" : "none",
      }
    }, sidebar),

    // Hoofd area
    React.createElement("div", {
      style: { flex: 1, display: "flex", flexDirection: "column",
               overflow: "hidden", minWidth: 0, minHeight: 0 }
    },
      // Tablet toggle-knop bovenaan de editor-balk injecteren
      isTablet && React.createElement("div", {
        style: {
          display: "flex", alignItems: "center",
          background: W.bg2, borderBottom: `1px solid ${W.splitBg}`,
          flexShrink: 0, height: "34px",
        }
      },
        tabletToggleBtn,
        React.createElement("span", {
          style: { fontSize: "12px", color: W.fgMuted, paddingLeft: "8px" }
        }, tabletSidebarOpen ? "Lijst" : "▶ Lijst tonen")
      ),
      mainContent
    )
  );
};
