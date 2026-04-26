// ── AnnotationsPanel ──────────────────────────────────────────────────────────
// Aanbeveling 4: verzamelt alle drie-lagen annotaties (bron/kritisch/eigen)
// uit alle notities — vergelijkbaar met Readwise highlights.
// Props: notes, onOpenNote(id)

const AnnotationsPanel = ({ notes = [], onOpenNote }) => {
  const { useState, useMemo } = React;
  const [layer,  setLayer]  = useState("all");  // all | bron | kritisch | eigen
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("note"); // note | layer | recent

  // Regex voor inline markeringen: [tekst]{.laag}
  const INLINE_RE = /\[([^\]]+)\]\{\.([a-z]+)\}/g;
  // Regex voor blokmarkeringen: :::laag\n...\n:::
  const BLOCK_RE  = /^:::(bron|kritisch|eigen)\s*\n([\s\S]*?)^:::\s*$/gm;

  const LAYER_COLOR = {
    bron:     "#8ac6f2",
    kritisch: "#e5786d",
    eigen:    "#9fca56",
  };
  const LAYER_ICON = { bron: "🔵", kritisch: "🔴", eigen: "🟢" };
  const LAYER_LABEL = { bron: "Bron", kritisch: "Kritisch", eigen: "Eigen" };

  // Extraheer alle annotaties uit alle notities
  const allAnnotations = useMemo(() => {
    const items = [];
    for (const note of notes) {
      const content = note.content || "";
      // Inline
      let m;
      const inlineRe = new RegExp(INLINE_RE.source, "g");
      while ((m = inlineRe.exec(content)) !== null) {
        const laag = m[2];
        if (!["bron","kritisch","eigen"].includes(laag)) continue;
        items.push({
          id: `${note.id}-i-${m.index}`,
          noteId: note.id,
          noteTitle: note.title || note.id,
          text: m[1].trim(),
          layer: laag,
          type: "inline",
          modified: note.modified || note.created || "",
        });
      }
      // Blok
      const blockRe = new RegExp(BLOCK_RE.source, "gm");
      while ((m = blockRe.exec(content)) !== null) {
        const laag = m[1];
        const body = m[2].trim();
        if (!body) continue;
        items.push({
          id: `${note.id}-b-${m.index}`,
          noteId: note.id,
          noteTitle: note.title || note.id,
          text: body.replace(/\n/g, " ").slice(0, 300),
          layer: laag,
          type: "block",
          modified: note.modified || note.created || "",
        });
      }
    }
    return items;
  }, [notes]);

  // Filter en sorteer
  const filtered = useMemo(() => {
    let list = allAnnotations;
    if (layer !== "all") list = list.filter(a => a.layer === layer);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.text.toLowerCase().includes(q) ||
        a.noteTitle.toLowerCase().includes(q)
      );
    }
    if (sortBy === "layer") {
      list = [...list].sort((a,b) => a.layer.localeCompare(b.layer));
    } else if (sortBy === "recent") {
      list = [...list].sort((a,b) => new Date(b.modified||0) - new Date(a.modified||0));
    }
    return list;
  }, [allAnnotations, layer, search, sortBy]);

  // Groepeer op notitie
  const grouped = useMemo(() => {
    if (sortBy === "layer") {
      // Groepeer op laag
      const map = new Map();
      for (const a of filtered) {
        if (!map.has(a.layer)) map.set(a.layer, { key: a.layer, label: LAYER_LABEL[a.layer], items: [] });
        map.get(a.layer).items.push(a);
      }
      return [...map.values()];
    }
    // Groepeer op notitie
    const map = new Map();
    for (const a of filtered) {
      if (!map.has(a.noteId)) map.set(a.noteId, { key: a.noteId, label: a.noteTitle, items: [] });
      map.get(a.noteId).items.push(a);
    }
    return [...map.values()];
  }, [filtered, sortBy]);

  // Tellingen
  const counts = useMemo(() => ({
    bron:     allAnnotations.filter(a => a.layer==="bron").length,
    kritisch: allAnnotations.filter(a => a.layer==="kritisch").length,
    eigen:    allAnnotations.filter(a => a.layer==="eigen").length,
  }), [allAnnotations]);

  const S = {
    container: { display:"flex", flexDirection:"column", height:"100%", background:W.bg, overflow:"hidden" },
    header:    { padding:"12px 16px 10px", borderBottom:`1px solid ${W.splitBg}`, background:W.bg2, flexShrink:0 },
    title:     { fontSize:"16px", fontWeight:"700", color:W.statusFg, marginBottom:"8px" },
    toolbar:   { display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap" },
    filterBtn: (active, color) => ({
      padding:"3px 10px", borderRadius:"10px", fontSize:"12px", cursor:"pointer",
      border:`1px solid ${active ? color+"55" : W.splitBg}`,
      background: active ? color+"18" : "transparent",
      color: active ? color : W.fgMuted,
      transition:"all 0.12s",
    }),
    search: { flex:1, minWidth:"120px", background:W.bg, border:`1px solid ${W.splitBg}`,
              borderRadius:"6px", padding:"4px 10px", color:W.fg, fontSize:"13px", outline:"none" },
    scroll: { flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", padding:"8px 0" },
    groupHeader: { padding:"6px 16px 3px", display:"flex", alignItems:"center", gap:"6px" },
    groupLabel:  { fontSize:"11px", color:W.fgMuted, fontWeight:"600", flex:1,
                   overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
    annotRow: { padding:"6px 16px 6px 24px", cursor:"pointer", transition:"background 0.1s",
                borderBottom:`1px solid ${W.splitBg}11` },
    layerBadge: (color) => ({
      display:"inline-flex", alignItems:"center", gap:"3px",
      fontSize:"9px", fontWeight:"700", letterSpacing:"0.5px",
      color: color, background: color+"15",
      border:`1px solid ${color}35`, borderRadius:"3px",
      padding:"1px 5px", marginBottom:"3px",
    }),
    annotText: (color) => ({
      fontSize:"13px", color:W.fg, lineHeight:"1.55",
      borderLeft:`2px solid ${color}55`, paddingLeft:"8px",
    }),
    blockTag: { fontSize:"9px", color:W.fgDim, marginTop:"2px" },
    empty:    { padding:"40px 16px", textAlign:"center", color:W.fgMuted, fontSize:"14px" },
  };

  return React.createElement("div", { style:S.container },
    // Header
    React.createElement("div", { style:S.header },
      React.createElement("div", { style:S.title }, "✦ Annotaties"),
      React.createElement("div", { style:S.toolbar },
        // Laag filters
        React.createElement("button", {
          onClick:()=>setLayer("all"),
          style:S.filterBtn(layer==="all", W.fg)
        }, `Alle (${allAnnotations.length})`),
        ...[
          { id:"bron",     color:"#8ac6f2" },
          { id:"kritisch", color:"#e5786d" },
          { id:"eigen",    color:"#9fca56" },
        ].map(l => React.createElement("button", {
          key:l.id, onClick:()=>setLayer(l.id),
          style:S.filterBtn(layer===l.id, l.color)
        }, `${LAYER_ICON[l.id]} ${LAYER_LABEL[l.id]} (${counts[l.id]})`)),
      ),
      React.createElement("div", { style:{display:"flex",gap:"6px",marginTop:"6px",alignItems:"center"} },
        React.createElement("input", {
          value:search, onChange:e=>setSearch(e.target.value),
          placeholder:"Zoek in annotaties…", style:S.search,
        }),
        React.createElement("select", {
          value:sortBy, onChange:e=>setSortBy(e.target.value),
          style:{ background:W.bg, border:`1px solid ${W.splitBg}`, borderRadius:"5px",
                  color:W.fg, fontSize:"12px", padding:"4px 6px", outline:"none" }
        },
          React.createElement("option",{value:"note"},   "Groep: notitie"),
          React.createElement("option",{value:"layer"},  "Groep: laag"),
          React.createElement("option",{value:"recent"}, "Groep: recent"),
        ),
      )
    ),

    // Annotaties
    filtered.length === 0
      ? React.createElement("div", { style:S.empty },
          allAnnotations.length === 0
            ? React.createElement("div", null,
                React.createElement("div", {style:{fontSize:"24px",marginBottom:"8px"}}, "✦"),
                React.createElement("div", {style:{marginBottom:"6px"}}, "Nog geen annotaties."),
                React.createElement("div", {style:{fontSize:"12px",color:W.fgDim}},
                  "Gebruik [tekst]{.bron}, [tekst]{.kritisch} of [tekst]{.eigen} in je notities.")
              )
            : "Geen annotaties gevonden met deze filters."
        )
      : React.createElement("div", { style:S.scroll },
          grouped.map(group =>
            React.createElement("div", { key:group.key },
              // Groepheader
              React.createElement("div", {
                style:S.groupHeader,
                onClick:()=>sortBy==="note" && onOpenNote?.(group.key),
                title: sortBy==="note" ? `Open notitie: ${group.label}` : "",
              },
                React.createElement("span", {style:{fontSize:"11px"}},
                  sortBy==="note" ? "📝" : LAYER_ICON[group.key] || ""),
                React.createElement("span", {style:S.groupLabel}, group.label),
                React.createElement("span", {style:{fontSize:"10px",color:W.fgDim,flexShrink:0}},
                  group.items.length),
              ),
              // Annotaties
              ...group.items.map(a => {
                const color = LAYER_COLOR[a.layer];
                return React.createElement("div", {
                  key: a.id,
                  style: S.annotRow,
                  onClick: () => onOpenNote?.(a.noteId),
                  onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.04)",
                  onMouseLeave: e => e.currentTarget.style.background = "transparent",
                },
                  React.createElement("div", { style:S.layerBadge(color) },
                    LAYER_ICON[a.layer], " ", LAYER_LABEL[a.layer],
                    a.type === "block" && " · BLOK"
                  ),
                  React.createElement("div", { style:S.annotText(color) }, a.text),
                  sortBy !== "note" && React.createElement("div", {
                    style:{ fontSize:"10px", color:W.fgDim, marginTop:"3px" }
                  }, "📝 ", a.noteTitle)
                );
              })
            )
          )
        )
  );
};
