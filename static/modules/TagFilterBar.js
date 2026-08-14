// ── TagFilterBar ─────────────────────────────────────────────────────────────
// Deps: W, genId

// Parseer hiërarchische tags: "ea/governance" → parent "ea", child "governance"
const parseTagHierarchy = (tags) => {
  const tree = {};
  tags.forEach(tag => {
    const parts = tag.split('/');
    if (parts.length > 1) {
      const parent = parts[0];
      if (!tree[parent]) tree[parent] = { children: [], isParent: true };
      tree[parent].children.push(tag);
    } else {
      if (!tree[tag]) tree[tag] = { children: [], isParent: false };
    }
  });
  return tree;
};

const TagFilterBar = ({tags=[], activeTag, onChange, compact=false, tagColors={}, maxVisible=8}) => {
  const [open,      setOpen]      = React.useState(false);
  const [search,    setSearch]    = React.useState("");
  const searchRef = React.useRef(null);

  if (!tags.length) return null;

  const sz  = compact ? "12px" : "13px";
  const pad = compact ? "3px 8px" : "4px 11px";
  const rad = "5px";
  const gap = compact ? "4px"  : "5px";

  // Filter op zoekopdracht
  const filtered = search
    ? tags.filter(t => t.toLowerCase().includes(search.toLowerCase()))
    : tags;

  // Eerste N tags als "preview" (altijd zichtbaar als ingeklapt)
  const previewTags = filtered.slice(0, maxVisible);
  const hiddenCount = filtered.length - maxVisible;
  const hasMore     = hiddenCount > 0;

  // activeTag kan een string zijn (enkelvoudig, bestaand gedrag — Graph.js,
  // PDFViewer.js) of een Set (multi-select — bv. LLMNotebook). Alle logica
  // hieronder werkt voor beide, zonder dat bestaande aanroepers iets hoeven
  // te veranderen.
  const isActive   = (t) => activeTag instanceof Set ? activeTag.has(t) : activeTag === t;
  const hasFilter  = activeTag instanceof Set ? activeTag.size > 0 : !!activeTag;
  // Reset naar het "lege" filter in hetzelfde type als het huidige gebruik
  // (lege Set voor multi-select, null voor enkelvoudig) — zo hoeft een
  // multi-select-aanroeper na het wissen niet zelf te herstellen naar een Set.
  const clearFilter = () => onChange(activeTag instanceof Set ? new Set() : null);
  const toggleTag = (t) => {
    if (activeTag instanceof Set) {
      const next = new Set(activeTag);
      next.has(t) ? next.delete(t) : next.add(t);
      onChange(next);
    } else {
      onChange(activeTag === t ? null : t);
    }
  };

  // chipStyle: geef alleen layout terug — kleur komt via CSS klasse .zk-chip
  const chipStyle = (t, active) => ({
    fontSize:sz, padding:pad, borderRadius:rad,
    cursor:"pointer", userSelect:"none",
    fontWeight: active ? "600" : "400",
    transition:"background 0.12s, color 0.12s, border 0.12s",
    whiteSpace:"nowrap", letterSpacing:"0.1px", lineHeight:"1.3",
    maxWidth:"100%", overflow:"hidden", textOverflow:"ellipsis",
    display:"inline-block",
  });

  const toggleOpen = () => {
    setOpen(o => {
      if (!o) setTimeout(() => searchRef.current?.focus(), 60);
      else setSearch("");
      return !o;
    });
  };

  // Header-rij: "TAGS" label + actief filter + inklapknop
  const header = React.createElement("div",{
    style:{display:"flex", alignItems:"center", gap:"5px",
           marginBottom: open||hasFilter ? "5px" : "0"}
  },
    // Inklapknop + label
    React.createElement("span",{
      onClick: toggleOpen,
      style:{
        fontSize:"11px", letterSpacing:"1.2px",
        color: open ? W.blue : W.fgMuted,
        cursor:"pointer", userSelect:"none",
        display:"flex", alignItems:"center", gap:"4px",
        fontWeight: open ? "700" : "600",
        transition:"color 0.12s",
      }
    },
      React.createElement("span",{style:{
        fontSize:"9px", display:"inline-block",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition:"transform 0.15s", lineHeight:1
      }}, "▶"),
      "TAGS"
    ),
    // Badge: aantal tags + actief filter indicator
    React.createElement("span",{style:{
      fontSize:"11px", padding:"2px 7px", borderRadius:"4px",
      background: hasFilter ? (W.tagBg||"rgba(159,202,86,0.14)") : (W.commentBg3||"rgba(255,255,255,0.07)"),
      color: hasFilter ? (W.tagColor||W.comment) : W.fgMuted,
      border:`1px solid ${hasFilter ? (W.tagBorder||"rgba(159,202,86,0.45)") : (W.splitBg||"rgba(255,255,255,0.14)")}`,
      fontWeight: hasFilter ? "600" : "400",
      cursor:"default",
    }},
      activeTag instanceof Set
        ? (activeTag.size === 0 ? `${tags.length}`
           : activeTag.size <= 3 ? [...activeTag].map(t=>"#"+t).join(", ")
           : `${activeTag.size} tags`)
        : activeTag ? `#${activeTag}` : `${tags.length}`
    ),
    // "× wis filter" knopje als er een actief filter is
    hasFilter && React.createElement("span",{
      onClick: clearFilter,
      title:"Filter wissen",
      style:{
        fontSize:"12px", color:W.orange, cursor:"pointer",
        padding:"2px 7px", borderRadius:"4px",
        border:`1px solid rgba(229,120,109,0.4)`,
        background:"rgba(229,120,109,0.1)",
        fontWeight:"600",
        lineHeight:"1.3",
      }
    }, "× wis")
  );

  // Ingeklapte staat: toon preview-chips + "… N meer" knop
  if (!open) {
    const visibleTags = search ? filtered : previewTags;
    return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"3px"}},
      header,
      React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap,alignItems:"center",minWidth:0}},
        React.createElement("span",{
          onClick: clearFilter,
          className: "zk-chip" + (!hasFilter ? " zk-chip-active" : ""),
          style: chipStyle(null, !hasFilter)
        }, "alles"),
        ...visibleTags.map(t => React.createElement("span",{
          key:t, onClick:()=>toggleTag(t),
          className: "zk-chip" + (isActive(t) ? " zk-chip-active" : ""),
          style: chipStyle(t, isActive(t)),
          title:"#"+t,
        }, "#"+t)),
        // "… N meer" knop
        !search && hasMore && React.createElement("span",{
          onClick: toggleOpen,
          style:{
            fontSize:sz, padding:pad, borderRadius:rad,
            cursor:"pointer", userSelect:"none",
            background: W.blueBg || "rgba(138,198,242,0.07)",
            color: W.blue,
            border:`1px solid ${W.blueBorder||"rgba(138,198,242,0.18)"}`,
            fontStyle:"italic",
          }
        }, `+${hiddenCount} meer…`)
      )
    );
  }

  // Uitgeklapte staat: zoekbalk + scrollbare lijst van alle gefilterde tags
  return React.createElement("div",{
    style:{display:"flex",flexDirection:"column",gap:"4px"}
  },
    header,

    // Zoekbalk
    React.createElement("div",{style:{position:"relative"}},
      React.createElement("input",{
        ref: searchRef,
        value: search,
        onChange: e => setSearch(e.target.value),
        placeholder: "tag zoeken…",
        style:{
          width:"100%", boxSizing:"border-box",
          background: W.bg3 || "rgba(0,0,0,0.3)",
          border:`1px solid ${search ? W.blue : W.splitBg}`,
          borderRadius:"4px", padding:"4px 22px 4px 7px",
          color:W.fg, fontSize:"13px", outline:"none",
          transition:"border-color 0.12s",
        }
      }),
      search && React.createElement("span",{
        onClick:()=>{ setSearch(""); searchRef.current?.focus(); },
        style:{
          position:"absolute", right:"5px", top:"50%",
          transform:"translateY(-50%)",
          fontSize:"14px", color:W.fgMuted, cursor:"pointer",
          lineHeight:1,
        }
      }, "×")
    ),

    // Scrollbare tag-lijst
    React.createElement("div",{style:{
      maxHeight:"180px", overflowY:"auto",
      display:"flex", flexWrap:"wrap", gap,
      alignItems:"flex-start", alignContent:"flex-start",
      padding:"3px 1px",
      // Subtiel scrollbar
      scrollbarWidth:"thin",
      scrollbarColor:`${W.splitBg} transparent`,
    }},
      // "alles" chip altijd bovenaan
      React.createElement("span",{
        onClick: clearFilter, style:chipStyle(null, !hasFilter)
      }, "alles"),
      filtered.length === 0
        ? React.createElement("span",{style:{fontSize:"12px",color:W.fgMuted,fontStyle:"italic"}},
            "geen tags gevonden")
        : filtered.map(t => React.createElement("span",{
            key:t,
            onClick:()=>toggleTag(t),
            className: "zk-chip" + (isActive(t) ? " zk-chip-active" : ""),
            style: chipStyle(t, isActive(t))
          }, "#"+t))
    ),

    // Footer: teller
    React.createElement("div",{style:{
      fontSize:"11px", color:W.fgMuted, textAlign:"right",
      paddingRight:"2px",
    }},
      filtered.length < tags.length
        ? `${filtered.length} van ${tags.length} tags`
        : `${tags.length} tags totaal`
    )
  );
};


// ── Obsidian-stijl Knowledge Graph ────────────────────────────────────────────
