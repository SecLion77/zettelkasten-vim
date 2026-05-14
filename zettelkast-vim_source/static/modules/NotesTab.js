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
  onSplitCmd = null,
  pasteQueue = [],
  onPasteConsumed = null,
  editorFocusTrigger = 0,
  splitMode = false,       // split-scherm actief — inklappen sidebars
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
  const [reviewData,    setReviewData]    = useState({});
  // Laad review-data bij mount
  React.useEffect(() => {
    fetch("/api/config").then(r=>r.json())
      .then(d => setReviewData(d.config?.review_data || {}))
      .catch(()=>{});
  }, []);
  const handleToggleReview = React.useCallback(async (noteId) => {
    const today = new Date().toISOString().slice(0,10);
    const d = new Date(); d.setDate(d.getDate()+1);
    const updated = { ...reviewData };
    if (updated[noteId]) { delete updated[noteId]; }
    else { updated[noteId] = { lastReview: today, interval: 1, due: d.toISOString().slice(0,10) }; }
    setReviewData(updated);
    try {
      await fetch("/api/config", { method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ review_data: updated }) });
    } catch(e) { console.error(e); }
  }, [reviewData]);
  const [search,        setSearch]        = useState("");
  const [tagFilter,     setTagFilter]     = useState(null);
  const [typeFilter,    setTypeFilter]    = useState(null);
  const [layerFilter,   setLayerFilter]   = useState(null);
  const [renderMode,    setRenderMode]    = useState("plain");
  const [showMeta,      setShowMeta]      = useState(false);
  const [showLinkMenu,  setShowLinkMenu]  = useState(false);
  const [linkSearch,    setLinkSearch]    = useState("");
  const [linkTypeFilter,setLinkTypeFilter]= useState("all");
  const [mermaidEdit,   setMermaidEdit]   = useState(null); // {noteId, code}

  const contentRef = useRef(null);
  const sidebarW   = isMobile ? Math.min(320, window.innerWidth - 40) : 240;
  const [tabletSidebarOpen, setTabletSidebarOpen] = useState(true);
  const [dateFilter,        setDateFilter]         = useState("");
  // Desktop linker sidebar inklapbaar
  const [leftOpen, setLeftOpen] = useState(true);
  // Rechter sidebar inklapbaar (doorgegeven aan LinksSidebar)
  const [rightOpen, setRightOpen] = useState(true);

  // Auto-collapse bij split-mode activeren
  useEffect(() => {
    if (splitMode) { setLeftOpen(false); setRightOpen(false); }
  }, [splitMode]);

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

  // Vandaag-datum als notitie-ID prefix (YYYY-MM-DD)
  const todayId = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };

  const handleDailyNote = useCallback(async () => {
    const today   = todayId();
    const title   = todayHeader();
    // Zoek bestaande dagnotitie
    const existing = NoteStore.getAll().find(n =>
      n.tags?.includes("dagnotitie") && n.title === title
    );
    if (existing) {
      // Open bestaande — meteen in schrijfmodus
      onSelectNote(existing.id);
      setVimMode(true);
      if (!isDesktop && !isTablet) onSidebarToggle?.(false);
      return;
    }
    // Maak nieuwe dagnotitie
    const id = today + "000000";  // herkenbaar ID
    const content = `# ${title}\n\n## 📥 Inbox\n\n\n\n## 💡 Ideeën\n\n\n\n## ✓ Taken\n\n- [ ] \n`;
    const note = {
      id, title,
      content,
      tags: ["dagnotitie"],
      created:  new Date().toISOString(),
      modified: new Date().toISOString(),
    };
    const saved = await NoteStore.save(note);
    onNotesChange(NoteStore.getAll());
    onSelectNote(saved.id);
    setVimMode(true);
    if (!isDesktop && !isTablet) onSidebarToggle?.(false);
  }, [isDesktop, isTablet]);

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

  // Voeg meerdere slimme links tegelijk toe aan de notitie
  const handleAddSmartLinks = useCallback(async (note, linkTexts) => {
    if (!note || !linkTexts?.length) return;
    const addition = linkTexts.join("\n");
    const updated  = {
      ...note,
      content:  (note.content || "") + "\n\n" + addition,
      modified: new Date().toISOString(),
    };
    await handleSave(updated);
  }, [handleSave]);

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
                     background: linkTypeFilter === id ? W.blueBg : "none",
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
                  background:W.commentBg, border:"1px solid rgba(159,202,86,0.35)",
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
    key: "main-notelist",  // stabiele key voorkomt unmount bij re-render
    notes,
    selectedId,
    search,
    tagFilter,
    typeFilter,
    layerFilter,
    dateFilter,
    onDateFilterChange:  setDateFilter,
    onSelect:            handleSelect,
    onNew:               handleNew,
    onDailyNote:         handleDailyNote,
    onSearchChange:      setSearch,
    onTagFilterChange:   setTagFilter,
    onTypeFilterChange:  setTypeFilter,
    onLayerFilterChange: setLayerFilter,
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
        notes,
        showLinkMenu,
        onToggleLinkMenu: () => { setShowLinkMenu(v => !v); setLinkSearch(""); setLinkTypeFilter("all"); },
        linkMenuContent:  showLinkMenu ? buildLinkDropdown() : null,
        onSplitCmd,
      })
    : React.createElement(React.Fragment, null,
        // NotePreview — flex:1 vult beschikbare breedte
        React.createElement("div", { style: { flex: 1, position: "relative", minHeight: 0, overflow: "hidden" } },
          React.createElement(NotePreview, {
            note:               selNote,
            notes,
            renderMode,
            isMobile,
            llmModel,
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
          onAddSmartLinks:    handleAddSmartLinks,
          allNotes:           notes,
            onToggleRead:       async (note) => {
              const updated = { ...note, isRead: !note.isRead, modified: new Date().toISOString() };
              await NoteStore.save(updated);
              onNotesChange(NoteStore.getAll());
            },
            onToggleReview: handleToggleReview,
          reviewData,
          onSummarize: async (note, summary) => {
              const clean = summary
                .replace(/<[^>]*>/g, '')
                .replace(/#?[0-9a-fA-F]{3,8};[\w-]+:[^;\n]{1,80}(?:;[\w-]+:[^;\n]{1,80})*/g, '')
                .replace(/[\w-]+:[\w\s#.,%()]+;(?:[\w-]+:[\w\s#.,%()]+;?)*/g, '')
                .replace(/\*{0,2}(?:SAMENVATTING|Samenvatting|SUMMARY|Summary)\*{0,2}\s*[:\n]/g, '')
                .replace(/={2,}\w+={2,}\s*/g, '')
                .replace(/^>\s*\[!.*?\]\s*/gm, '')
                .replace(/^>\s*/gm, '')
                .replace(/[ \t]{2,}/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
              const block = `> [!samenvatting]\n> 📋 **Samenvatting**\n> ${clean.replace(/\n/g, "\n> ")}\n\n`;
              const updated = {
                ...note,
                content: block + note.content,
                modified: new Date().toISOString(),
              };
              await NoteStore.save(updated);
              onNotesChange(NoteStore.getAll());
            },
          })
        ),
        // ── Links-zijbalk rechts — sibling van NotePreview in flex-row ────────
        !isMobile && !goyoMode && selNote && React.createElement(LinksSidebar, {
          note:        selNote,
          allNotes:    notes,
          serverPdfs,
          serverImages,
          isTablet,
          splitMode,
          externalOpen: rightOpen,
          onExternalToggle: () => setRightOpen(p => !p),
          onSelect:    id => { onSelectNote(id); setVimMode(false); },
          onNoteTypeChange: async (newType) => {
            if (!selNote) return;
            const updated = { ...selNote, noteType: newType,
                              modified: new Date().toISOString() };
            await handleSave(updated);
          },
          onLayerChange: async (newLayer) => {
            if (!selNote) return;
            const updated = { ...selNote, layer: newLayer,
                              modified: new Date().toISOString() };
            await handleSave(updated);
          },
          onSaveNote: async (updatedNote) => {
            await handleSave(updatedNote);
          },
          onTagRemove: handleTagRemove,
          onTagsChange: async (newTags) => {
            if (!selNote) return;
            const updated = { ...selNote, tags: newTags,
                              modified: new Date().toISOString() };
            await handleSave(updated);
          },
          llmModel,
          onInsertLink: async (linkText) => {
            const updated = {
              ...selNote,
              content: (selNote.content || "") + "\n\n" + linkText,
              modified: new Date().toISOString(),
            };
            await handleSave(updated);
          },
        }),
        // NotesMeta verwijderd — inhoud zit nu in LinksSidebar → Info tab
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
      padding: "0 14px", height: "34px", minWidth: "44px",
      fontSize: "18px", cursor: "pointer", flexShrink: 0,
      touchAction: "manipulation",  // geen 300ms tap-vertraging op iOS
      display: "flex", alignItems: "center", justifyContent: "center",
    }
  }, tabletSidebarOpen ? "◀" : "▶");

  // ── Sidebar breedte berekening ────────────────────────────────────────────
  const leftW = isDesktop
    ? (leftOpen ? sidebarW : 20)
    : isTablet
    ? (tabletSidebarOpen ? 200 : 0)
    : sidebarW;

  return React.createElement("div", {
    style: { flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }
  },
    mermaidOverlay,

    // ── Linker sidebar met inklapknop ──────────────────────────────────────
    !isMobile && React.createElement("div", {
      className: "sidebar",
      style: {
        width: `${leftW}px`,
        flexShrink: 0,
        borderRight: `1px solid ${W.splitBg}`,
        display: "flex", flexDirection: "column",
        minHeight: 0, overflow: "hidden",
        transition: "width 0.18s ease",
        position: "relative",
        background: W.bg2,
      }
    },
      // Ingeklapt: smalle rand met toggle knop gecentreerd (zelfde stijl als rechts)
      isDesktop && !leftOpen && React.createElement("div", {
        style: {
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          flex: 1,
        }
      },
        React.createElement("div", {
          onClick: () => setLeftOpen(true),
          title: "Notities uitklappen",
          style: {
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: "6px", padding: "10px 0",
            cursor: "pointer", borderRadius: "0 6px 6px 0",
            width: "20px", transition: "background 0.12s",
          },
          onMouseEnter: e => e.currentTarget.style.background = "rgba(125,216,198,0.08)",
          onMouseLeave: e => e.currentTarget.style.background = "transparent",
        },
          React.createElement("span", {
            style: { fontSize: "10px", color: W.fgMuted, lineHeight: 1 }
          }, "›"),
          React.createElement("span", {
            style: {
              fontSize: "8px", color: W.fgDim,
              letterSpacing: "1.2px", textTransform: "uppercase",
              writingMode: "vertical-rl", userSelect: "none",
              lineHeight: 1.2,
            }
          }, "Notities"),
          notes.length > 0 && React.createElement("span", {
            style: {
              fontSize: "8px", color: "var(--zk-tag-pill-color)",
              background: `${W.comment}18`,
              border: "1px solid var(--zk-tag-pill-border)",
              borderRadius: "6px", padding: "1px 3px",
              lineHeight: 1, minWidth: "12px", textAlign: "center",
            }
          }, notes.length > 99 ? "99+" : String(notes.length))
        )
      ),

      // Uitgeklapt: volledige sidebar inhoud
      (isDesktop ? leftOpen : (isTablet ? tabletSidebarOpen : true)) && React.createElement(React.Fragment, null,
        React.createElement(React.Fragment, null,
          // Inklap-knop in een smalle strip bovenaan — altijd zichtbaar
          isDesktop && React.createElement("div", {
            style: {
              display: "flex", alignItems: "center", justifyContent: "flex-end",
              padding: "4px 6px", flexShrink: 0,
              borderBottom: `1px solid ${W.splitBg}`,
              background: W.bg2,
            }
          },
            React.createElement("button", {
              onClick: () => setLeftOpen(false),
              title: "Notities inklappen",
              style: {
                background: "none",
                border: `1px solid transparent`,
                borderRadius: "4px",
                color: W.fgMuted, cursor: "pointer",
                width: "22px", height: "22px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", lineHeight: 1,
                transition: "all 0.12s",
              },
              onMouseEnter: e => {
                e.currentTarget.style.color = W.blue;
                e.currentTarget.style.borderColor = `${W.blue}44`;
                e.currentTarget.style.background = `${W.blue}10`;
              },
              onMouseLeave: e => {
                e.currentTarget.style.color = W.fgMuted;
                e.currentTarget.style.borderColor = "transparent";
                e.currentTarget.style.background = "none";
              },
            }, "‹")
          ),
          sidebar
        )
      ),

      // Tablet: aparte toggle (was al aanwezig)
      isTablet && !tabletSidebarOpen && React.createElement("div", null)
    ),

    // ── Hoofd area ────────────────────────────────────────────────────────
    React.createElement("div", {
      style: { flex: 1, display: "flex", flexDirection: "column",
               overflow: "hidden", minWidth: 0, minHeight: 0 }
    },
      // Tablet toggle
      isTablet && React.createElement("div", {
        style: {
          display: "flex", alignItems: "center",
          background: W.bg2, borderBottom: `1px solid ${W.splitBg}`,
          flexShrink: 0, height: "34px", position: "relative", zIndex: 10,
        }
      },
        tabletToggleBtn,
        React.createElement("span", {
          onClick: () => setTabletSidebarOpen(p => !p),
          style: { fontSize: "12px", color: W.fgMuted, paddingLeft: "8px",
                   cursor: "pointer", touchAction: "manipulation" }
        }, tabletSidebarOpen ? "Lijst" : "▶ Lijst tonen")
      ),
      // Flex-row: NotePreview + LinksSidebar + NotesMeta
      React.createElement("div", {
        style: { flex: 1, display: "flex", flexDirection: "row",
                 overflow: "hidden", minHeight: 0 }
      }, mainContent)
    )
  );
};
