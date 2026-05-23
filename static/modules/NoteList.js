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
  layerFilter = null,
  onLayerFilterChange,
  onSelect,
  onNew,
  onDailyNote,
  onSearchChange,
  onTagFilterChange,
  dateFilter = "",
  onDateFilterChange,
  isMobile = false,
  onCloseSidebar,
  onToggleRead,           // (note) => void — toggle gelezen-status offline-robuust
}) => {
  const { useMemo, useRef, useEffect, useState, useCallback } = React;
  const listRef    = useRef(null);
  const hoverTimer = useRef(null);
  const [sortBy,    setSortBy]    = useState("modified");
  const [showCalendar, setShowCalendar] = useState(false);
  const [canvasSel, setCanvasSel] = useState(null); // null = uit, Set = selectiemodus aan
  const setDateFilter = onDateFilterChange || (() => {});
  const [hoverNote, setHoverNote] = useState(null); // {note, rect} voor peek-tooltip
  const [pinnedIds, setPinnedIds] = useState(() => {
    // Laad direct uit localStorage voor snelle eerste render
    try { return JSON.parse(localStorage.getItem("zk_pins") || "[]"); }
    catch { return []; }
  });

  // Laad pins van server bij mount — synchroniseert iPad ↔ laptop
  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const serverPins = d?.config?.pins;
        if (Array.isArray(serverPins)) {
          setPinnedIds(serverPins);
          try { localStorage.setItem("zk_pins", JSON.stringify(serverPins)); } catch {}
        }
      })
      .catch(() => {}); // offline: blijf localStorage gebruiken
  }, []);

  const togglePin = (id, e) => {
    e.stopPropagation();
    setPinnedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [id, ...prev];
      // Sla op in localStorage (instant) én server (sync naar iPad)
      try { localStorage.setItem("zk_pins", JSON.stringify(next)); } catch {}
      fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pins: next }),
      }).catch(() => {}); // stil falen als offline
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
    const q       = (search || "").toLowerCase().trim();
    const now     = Date.now();
    const DAY     = 86400000;
    const cutoffs = { today: DAY, week: 7*DAY, month: 30*DAY };
    const cutoff  = dateFilter ? cutoffs[dateFilter] : null;
    const list = notes.filter(n => {
      // 1. Datum filter — gebruik created datum (modified kan file-sync datum zijn)
      if (cutoff !== null) {
        const d = n.created || n.modified || "";
        const t = d ? new Date(d).getTime() : NaN;
        if (!d || isNaN(t) || (now - t) > cutoff) return false;
      }
      // 2. Zoekterm
      if (q) {
        const inTitle   = (n.title   || "").toLowerCase().includes(q);
        const inContent = (n.content || "").toLowerCase().includes(q);
        const inTags    = (n.tags    || []).some(t => t.toLowerCase().includes(q));
        if (!inTitle && !inContent && !inTags) return false;
      }
      // 3. Tag filter
      if (tagFilter && !(n.tags || []).includes(tagFilter)) return false;
      // 4. Type filter
      if (typeFilter && (n.noteType || "") !== typeFilter) return false;
      // 5. Layer filter
      if (layerFilter && (n.layer || "") !== layerFilter) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === "title")
        return (a.title || "").localeCompare(b.title || "", "nl", {sensitivity:"base"});
      if (sortBy === "created")
        return new Date(b.created || 0) - new Date(a.created || 0);
      return new Date(b.modified || b.created || 0) - new Date(a.modified || a.created || 0);
    });
  }, [notes, search, tagFilter, typeFilter, layerFilter, sortBy, dateFilter]);

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
          className: "tag-pill small",
          style: { cursor: "default" }
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
        // Kalender-toggle
        onDailyNote && React.createElement("button", {
          onClick: () => setShowCalendar(p => !p),
          title: showCalendar ? "Sluit kalender" : "Open kalender",
          style: { background: showCalendar ? W.blueBg2 : W.yellowBg,
                   color: showCalendar ? W.blue : W.yellow,
                   border: `1px solid ${showCalendar ? W.blueBorder : W.yellowBorder}`,
                   borderRadius: "6px", padding: "8px 10px", fontSize: "14px",
                   cursor: "pointer", flexShrink: 0,
                   display: "flex", alignItems: "center",
                   touchAction: "manipulation", transition: "all 0.12s" }
        }, "📅"),
        // Vandaag knop
        onDailyNote && React.createElement("button", {
          onClick: onDailyNote,
          title: "Open of maak de dagnotitie van vandaag",
          style: { background: W.yellowBg,
                   color: W.yellow, border: `1px solid rgba(234,231,136,0.25)`,
                   borderRadius: "6px", padding: "8px 6px", fontSize: "11px",
                   cursor: "pointer", flexShrink: 0,
                   display: "flex", alignItems: "center",
                   touchAction: "manipulation" }
        }, "vandaag")
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

    // ── Kalender widget ─────────────────────────────────────────────────────
    showCalendar && React.createElement(CalendarWidget, {
      notes,
      onDailyNote: (dateStr) => {
        // Zoek bestaande dagnotitie voor die datum of maak een nieuwe
        const [yr, mo, dy] = dateStr.split("-");
        const title = `${["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"][new Date(dateStr).getDay()]} ${parseInt(dy)}-${parseInt(mo)}-${yr}`;
        const existing = notes.find(n => n.tags?.includes("dagnotitie") && n.title === title);
        if (existing) {
          onSelect?.(existing.id);
        } else {
          onDailyNote?.();  // fallback naar vandaag als datum niet overeenkomt
        }
        setShowCalendar(false);
      },
      onClose: () => setShowCalendar(false),
    }),

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
          onClick: () => onTypeFilterChange?.(isActive ? null : id),
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
    (tagFilter || typeFilter || layerFilter || search) && React.createElement("div", {
      style: { padding: "3px 8px", borderBottom: `1px solid ${W.splitBg}`,
               background: W.commentBg3, flexShrink: 0,
               display: "flex", gap: "5px", alignItems: "center", flexWrap: "wrap" }
    },
      React.createElement("span", { style: { fontSize: "9px", color: W.fgMuted } },
        filtered.length + " resultaten"),
      tagFilter && React.createElement("button", {
        onClick: () => onTagFilterChange?.(null),
        className: "tag-pill", style: { fontSize: "9px",
                 padding: "1px 6px", cursor: "pointer" }
      }, "#", tagFilter, " ×"),
      typeFilter && React.createElement("button", {
        onClick: () => onTypeFilterChange?.(null),
        style: { fontSize: "9px", background: W.blueBg, color: W.blue,
                 border: "1px solid rgba(138,198,242,0.3)", borderRadius: "3px",
                 padding: "1px 6px", cursor: "pointer" }
      }, typeFilter, " ×"),
      layerFilter && React.createElement("button", {
        onClick: () => onLayerFilterChange?.(null),
        style: { fontSize: "9px",
                 background: layerFilter==="bron" ? W.blueBg
                           : layerFilter==="kritisch" ? "rgba(229,120,109,0.12)"
                           : W.commentBg,
                 color: layerFilter==="bron" ? "#8ac6f2"
                      : layerFilter==="kritisch" ? "#e5786d" : "#9fca56",
                 border: "1px solid currentColor", borderRadius: "3px",
                 padding: "1px 6px", cursor: "pointer" }
      }, layerFilter==="bron" ? "🔵" : layerFilter==="kritisch" ? "🔴" : "🟢",
         " ", layerFilter, " ×"),
      React.createElement("button", {
        onClick: () => { onSearchChange?.(""); onTagFilterChange?.(null); onTypeFilterChange?.(null); onLayerFilterChange?.(null); },
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
            background: sortBy === id ? W.blueBg2 : "none",
            color:      sortBy === id ? W.blue : W.fgMuted,
            border:    `1px solid ${sortBy === id ? "rgba(138,198,242,0.35)" : "transparent"}`,
            borderRadius: "4px", padding: "2px 7px",
            fontSize: "10px", cursor: "pointer",
            fontWeight: sortBy === id ? "600" : "400",
            transition: "all 0.12s",
          }
        }, label)
      ),
      React.createElement("button", {
        onClick: () => setCanvasSel(s => s !== null ? null : new Set()),
        title: canvasSel !== null ? "Klik op notities om te selecteren, dan → Canvas" : "Selecteer meerdere notities voor het canvas",
        style:{
          background: canvasSel !== null ? (W.tagBg||"rgba(159,202,86,0.12)") : "none",
          border: canvasSel !== null
            ? `1px solid ${W.tagBorder||"rgba(159,202,86,0.4)"}`
            : `1px solid ${W.splitBg}`,
          borderRadius:"5px", marginLeft:"auto",
          color: canvasSel !== null ? (W.tagColor||"#9fca56") : W.fgMuted,
          cursor:"pointer", fontSize:"12px", padding:"3px 8px", lineHeight:1,
          fontWeight: canvasSel !== null ? "600" : "400",
          display:"flex", alignItems:"center", gap:"4px",
        }
      },
        React.createElement("span",null, canvasSel !== null ? "☑" : "☐"),
        React.createElement("span",{style:{fontSize:"11px"}}, "Canvas"))
    ),

    // ── Datum-filter balk ───────────────────────────────────────────────────
    React.createElement("div", {
      style: { display: "flex", alignItems: "center", gap: "2px",
               padding: "3px 6px", borderBottom: `1px solid ${W.splitBg}`,
               background: W.bg, flexShrink: 0 }
    },
      React.createElement("span", {
        style: { fontSize: "9px", color: W.fgMuted, marginRight: "3px",
                 letterSpacing: "0.5px" }
      }, "📅"),
      ...[
        { id: "",       label: "alle" },
        { id: "today",  label: "vandaag" },
        { id: "week",   label: "week" },
        { id: "month",  label: "maand" },
      ].map(({ id, label }) =>
        React.createElement("button", {
          key: id,
          onClick: () => setDateFilter(id),
          style: {
            background: dateFilter === id && id !== "" ? "rgba(232,200,122,0.15)" : "none",
            color:      dateFilter === id && id !== "" ? W.yellow
                      : id === "" && dateFilter === "" ? W.blue : W.fgMuted,
            border:    `1px solid ${dateFilter === id && id !== "" ? "rgba(232,200,122,0.35)" : "transparent"}`,
            borderRadius: "4px", padding: "2px 7px",
            fontSize: "10px", cursor: "pointer",
            fontWeight: dateFilter === id ? "600" : "400",
            transition: "all 0.12s",
          }
        }, label)
      )
    ),

    // ── Canvas selectie balk ──────────────────────────────────────────────────
    canvasSel !== null && React.createElement("div", {
      style:{display:"flex",alignItems:"center",gap:"8px",padding:"7px 10px",
             background: W.tagBg||W.commentBg||"rgba(159,202,86,0.08)",
             borderBottom:`1px solid ${W.tagBorder||W.commentBorder||"rgba(159,202,86,0.25)"}`,
             flexShrink:0, minHeight:"36px"}
    },
      (canvasSel?.size ?? 0) === 0
        ? React.createElement("span",{style:{fontSize:"12px",color:W.fgMuted,flex:1,fontStyle:"italic"}},
            "Tik op notities om te selecteren…")
        : React.createElement("span",{style:{fontSize:"12px",color:W.tagColor||W.comment||"#9fca56",flex:1,fontWeight:"500"}},
            (canvasSel?.size ?? 0)+" notitie"+((canvasSel?.size ?? 0)===1?"":"s")+" geselecteerd"),
      (canvasSel?.size ?? 0) > 0 && React.createElement("button",{
        onClick:()=>{
          if(window._sendToCanvas) window._sendToCanvas([...canvasSel]);
          setCanvasSel(null);
        },
        style:{fontSize:"12px",padding:"4px 12px",borderRadius:"5px",
               background:W.tagBg||W.commentBg||"rgba(159,202,86,0.15)",
               color:W.tagColor||W.comment||"#9fca56",
               border:`1px solid ${W.tagBorder||W.commentBorder||"rgba(159,202,86,0.35)"}`,
               cursor:"pointer",fontWeight:"600",whiteSpace:"nowrap"}
      },"📋 → Canvas"),
      React.createElement("button",{
        onClick:()=>setCanvasSel(null),
        title:"Selectiemodus uit",
        style:{fontSize:"16px",padding:"0 4px",borderRadius:"4px",background:"none",
               color:W.fgMuted,border:"none",cursor:"pointer",lineHeight:1}
      },"×")
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
              onClick: () => { if(canvasSel === null) onSelect(n.id); },
              onContextMenu: onToggleRead ? (e) => {
                // Rechtsklik = snel gelezen/ongelezen wisselen
                e.preventDefault();
                onToggleRead(n);
              } : undefined,
              style: {
                padding: canvasSel !== null ? "10px 12px 9px 34px" : "10px 12px 9px",
                position: "relative",
                borderBottom: `1px solid rgba(58,64,70,0.5)`,
                cursor: "pointer",
                background: sel ? W.blueBg : "transparent",
                borderLeft: `3px solid ${sel ? W.yellow : "transparent"}`,
                transition: "background 0.1s",
              }
            },
              // Multi-select checkbox
              canvasSel !== null && React.createElement("input", {
                type: "checkbox",
                checked: canvasSel !== null && canvasSel.has(n.id),
                onChange: e => {
                  e.stopPropagation();
                  setCanvasSel(prev => {
                    const next = new Set(prev);
                    next.has(n.id) ? next.delete(n.id) : next.add(n.id);
                    return next;
                  });
                },
                onClick: e => e.stopPropagation(),
                style:{position:"absolute",left:"10px",top:"50%",transform:"translateY(-50%)",
                       cursor:"pointer",width:"15px",height:"15px",
                       accentColor:W.tagColor||"#9fca56"}
              }),
              // Titel + datum + pin op één rij
              React.createElement("div", {
                style: { display: "flex", alignItems: "center",
                         gap: "4px", marginBottom: "3px" }
              },
                // Offline-pending indicator
                (window.OfflineStore?.isPending?.(n.id) || n._pending) &&
                  React.createElement("span", {
                    title: "Offline opgeslagen — wordt gesynchroniseerd zodra de server bereikbaar is",
                    style: { fontSize: "11px", flexShrink: 0, opacity: 0.7 }
                  }, "⏳"),
                // Gelezen-indicator — ook bij pending offline-state
                n.isRead && React.createElement("span", {
                  title: n._pending ? "Gelezen (wordt gesynchroniseerd)" : "Gelezen",
                  style: {
                    fontSize: "10px", flexShrink: 0,
                    color: n._pending ? W.fgMuted : (W.tagColor||"#9fca56"),
                    background: n._pending
                      ? "rgba(255,255,255,.05)"
                      : (W.tagBg||"rgba(159,202,86,.08)"),
                    border: `1px solid ${n._pending
                      ? W.splitBg
                      : (W.tagBorder||"rgba(159,202,86,.25)")}`,
                    borderRadius: "8px", padding: "0 5px", lineHeight: "16px",
                    opacity: n._pending ? 0.6 : 1,
                  }
                }, n._pending ? "✓…" : "✓"),
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
