// ── ReadingList ───────────────────────────────────────────────────────────────
// Toont alle geïmporteerde notities (URL, docx, PDF) als leeslijst.
// Velden per notitie: [✓] datum | titel | leestijd
// Props: notes, onSelectNote, onUpdateNote

const ReadingList = ({ notes = [], onSelectNote, onUpdateNote, onDeleteNote }) => {
  const { useState, useMemo, useCallback } = React;
  const [filter, setFilter] = useState("unread");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date"); // "date" | "readtime_asc" | "readtime_desc"
  const [view, setView] = useState("list");    // "list" | "dupes"
  const [dupSel, setDupSel] = useState({});    // { groupKey: noteId_to_keep }
  const [dupDone, setDupDone] = useState(false);

  // ── URL normalisatie ─────────────────────────────────────────────────────────
  const normUrl = useCallback((u) => {
    if (!u) return "";
    try {
      const p = new URL(u);
      ["utm_source","utm_medium","utm_campaign","utm_term","utm_content",
       "fbclid","gclid","ref","source","si"].forEach(k=>p.searchParams.delete(k));
      return (p.origin + p.pathname.replace(/\/$/,"") + (p.search||"")).toLowerCase();
    } catch { return u.replace(/\/$/,"").toLowerCase(); }
  }, []);

  // ── Duplicaten detectie ──────────────────────────────────────────────────────
  const dupGroups = useMemo(() => {
    const groups = {};

    notes.forEach(n => {
      // Sleutel 1: genormaliseerde sourceUrl
      if (n.sourceUrl) {
        const key = "url:" + normUrl(n.sourceUrl);
        if (!groups[key]) groups[key] = [];
        groups[key].push(n);
        return;
      }
      // Sleutel 2: genormaliseerde titel (lowercase, geen leestekens)
      if (n.title) {
        const key = "title:" + n.title.toLowerCase()
          .replace(/[^\w\s]/g,"").replace(/\s+/g," ").trim();
        if (!groups[key]) groups[key] = [];
        groups[key].push(n);
      }
    });

    // Alleen groepen met meer dan 1 notitie
    return Object.entries(groups)
      .filter(([,g]) => g.length > 1)
      .map(([key, g]) => ({
        key,
        notes: [...g].sort((a,b) =>
          new Date(b.importedAt||b.created) - new Date(a.importedAt||a.created)
        )
      }));
  }, [notes, normUrl]);

  // Initialiseer selectie: bewaar standaard de nieuwste
  const initSel = useCallback(() => {
    const sel = {};
    dupGroups.forEach(({key, notes:g}) => { sel[key] = g[0].id; });
    setDupSel(sel);
    setDupDone(false);
  }, [dupGroups]);

  // Verwijder duplicaten — bewaar de geselecteerde per groep
  const doMerge = useCallback(async () => {
    const toDelete = [];
    dupGroups.forEach(({key, notes:g}) => {
      const keepId = dupSel[key] || g[0].id;
      g.forEach(n => { if (n.id !== keepId) toDelete.push(n.id); });
    });
    if (!toDelete.length) return;
    // Verwijder alle IDs in één batch — onDeleteNote ontvangt id-string
    await onDeleteNote?.(toDelete);
    setDupDone(true);
  }, [dupGroups, dupSel, onDeleteNote]);

  // ── Leestijd berekenen (200 woorden/min) ────────────────────────────────────
  const readingTime = (content = "") => {
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const mins  = Math.max(1, Math.round(words / 200));
    return mins;
  };

  // ── Filter: alleen geïmporteerde notities ───────────────────────────────────
  // Een notitie is "geïmporteerd" als hij importedAt heeft (nieuw),
  // of als de content-patronen van URL/Word/PDF-import aanwezig zijn (bestaande notities).
  const isImported = n =>
    !!n.importedAt ||
    /Automatisch gegenereerd door/.test(n.content||"") ||
    /\*Samenvatting:\*/.test(n.content||"") ||
    ((n.tags||[]).includes("samenvatting") && (n.tags||[]).includes("pdf"));

  const items = useMemo(() => {
    let list = notes
      .filter(isImported)
      .map(n => ({ ...n, _mins: readingTime(n.content) }));

    // Filter
    if (filter === "read")   list = list.filter(n => n.isRead);
    if (filter === "unread") list = list.filter(n => !n.isRead);

    // Zoek
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        (n.title||"").toLowerCase().includes(q) ||
        (n.content||"").toLowerCase().includes(q)
      );
    }

    // Sorteren
    if (sortBy === "date") {
      list.sort((a,b) => new Date(b.importedAt||b.created) - new Date(a.importedAt||a.created));
    } else if (sortBy === "readtime_asc") {
      list.sort((a,b) => a._mins - b._mins);
    } else if (sortBy === "readtime_desc") {
      list.sort((a,b) => b._mins - a._mins);
    }

    return list;
  }, [notes, filter, search, sortBy]);

  const readCount   = items.filter(n => n.isRead).length;
  const unreadCount = items.filter(n => !n.isRead).length;

  const toggleRead = async (note) => {
    const updated = { ...note, isRead: !note.isRead, modified: new Date().toISOString() };
    await onUpdateNote(updated);
  };

  const fmtDate = iso => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("nl-NL", { day:"2-digit", month:"2-digit", year:"numeric" });
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const S = {
    wrap:   { display:"flex", flexDirection:"column", flex:1, minHeight:0, overflow:"hidden", background:W.bg },
    header: { padding:"12px 20px 10px", background:W.bg2, borderBottom:`1px solid ${W.splitBg}`,
              flexShrink:0 },
    bar:    { display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap", marginTop:"10px" },
    pill:   (active) => ({
              background: active ? W.yellow : "rgba(255,255,255,0.05)",
              color:      active ? W.bg     : W.fgMuted,
              border:     active ? "none"   : `1px solid ${W.splitBg}`,
              borderRadius:"20px", padding:"3px 12px", fontSize:"13px",
              cursor:"pointer", fontWeight: active ? "700" : "400",
            }),
    search: { flex:1, minWidth:"160px", maxWidth:"320px",
              background:W.bg3, border:`1px solid ${W.splitBg}`,
              borderRadius:"6px", padding:"5px 10px",
              color:W.fg, fontSize:"13px", outline:"none" },
    table:  { flex:1, overflowY:"auto", padding:"0 0 24px" },
    th:     { padding:"8px 12px", fontSize:"11px", color:W.fgMuted,
              letterSpacing:"1px", fontWeight:"600", textAlign:"left",
              borderBottom:`1px solid ${W.splitBg}`,
              position:"sticky", top:0, background:W.bg2, zIndex:1 },
    tr:     (read, hover) => ({
              display:"grid",
              gridTemplateColumns:"36px 100px 1fr 80px",
              alignItems:"center",
              borderBottom:`1px solid rgba(255,255,255,0.04)`,
              background: hover ? "rgba(255,255,255,0.04)"
                        : read  ? "transparent" : "rgba(138,198,242,0.03)",
              cursor:"pointer",
              opacity: read ? 0.6 : 1,
              transition:"background 0.12s",
            }),
    td:     { padding:"9px 12px", fontSize:"13px", color:W.fg,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
    empty:  { display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", flex:1, gap:"12px",
              color:W.fgMuted, fontSize:"14px" },
  };

  const [hovered, setHovered] = useState(null);

  return React.createElement("div", { style:S.wrap },

    // ── Header ─────────────────────────────────────────────────────────────────
    React.createElement("div", { style:S.header },
      React.createElement("div", { style:{ display:"flex", alignItems:"baseline", gap:"12px" } },
        React.createElement("span", { style:{ fontSize:"15px", fontWeight:"700",
          color:W.statusFg, letterSpacing:"0.5px" } }, "📚 Leeslijst"),
        React.createElement("span", { style:{ fontSize:"13px", color:W.fgMuted } },
          `${readCount} gelezen · ${unreadCount} ongelezen`),
        dupGroups.length > 0 && React.createElement("span", {
          style:{ fontSize:"12px", color:W.orange,
            background:"rgba(229,120,109,0.12)", border:"1px solid rgba(229,120,109,0.3)",
            borderRadius:"10px", padding:"1px 8px", cursor:"pointer" },
          onClick:()=>{ setView("dupes"); initSel(); }
        }, `⚠ ${dupGroups.length} dubbel${dupGroups.length!==1?"en":""}`)
      ),
      React.createElement("div", { style:S.bar },
        // View-tabs
        React.createElement("button", {
          style:S.pill(view==="list"),
          onClick:()=>setView("list")
        }, "📋 Lijst"),
        React.createElement("button", {
          style:{...S.pill(view==="dupes"),
            color: view!=="dupes" && dupGroups.length>0 ? W.orange : undefined},
          onClick:()=>{ setView("dupes"); initSel(); }
        }, `🔍 Duplicaten${dupGroups.length>0?" ("+dupGroups.length+")":""}`),

        view==="list" && React.createElement(React.Fragment, null,
          React.createElement("div",{style:{width:"1px",height:"18px",
            background:W.splitBg,margin:"0 4px"}}),
          // Filter-pills
          React.createElement("button", { style:S.pill(filter==="all"),
            onClick:()=>setFilter("all") }, "Alles"),
          React.createElement("button", { style:S.pill(filter==="unread"),
            onClick:()=>setFilter("unread") }, "📖 Ongelezen"),
          React.createElement("button", { style:S.pill(filter==="read"),
            onClick:()=>setFilter("read") }, "✓ Gelezen"),

          React.createElement("div",{style:{flex:1}}),

          // Sortering
          React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted,
            letterSpacing:"0.5px",marginRight:"4px"}},"SORTEER:"),
          React.createElement("button",{
            onClick:()=>setSortBy("date"),
            style:S.pill(sortBy==="date")
          },"📅 Datum"),
          React.createElement("button",{
            onClick:()=>setSortBy(sortBy==="readtime_asc"?"readtime_desc":"readtime_asc"),
            style:S.pill(sortBy==="readtime_asc"||sortBy==="readtime_desc"),
            title:"Klik opnieuw om volgorde om te draaien"
          }, sortBy==="readtime_desc" ? "⏱ Leestijd ↑" : "⏱ Leestijd ↓"),

          // Zoekbalk
          React.createElement("input", {
            value:search, onChange:e=>setSearch(e.target.value),
            placeholder:"Zoeken…", style:S.search,
          })
        )
      )
    ),

    // ── Duplicaten-paneel ───────────────────────────────────────────────────────
    view === "dupes" && React.createElement("div", {
      style:{ flex:1, overflowY:"auto", padding:"16px 20px",
        WebkitOverflowScrolling:"touch" }
    },
      dupGroups.length === 0
        ? React.createElement("div", { style:{ textAlign:"center", padding:"48px 0",
            color:W.fgMuted } },
            React.createElement("div",{style:{fontSize:"40px",marginBottom:"12px"}},"✓"),
            React.createElement("div",{style:{fontSize:"15px",fontWeight:"600",
              color:W.comment}},"Geen duplicaten gevonden"),
            React.createElement("div",{style:{fontSize:"13px",marginTop:"6px"}},
              "Alle geïmporteerde notities zijn uniek.")
          )
        : React.createElement(React.Fragment, null,
            // Uitleg + actieknop
            React.createElement("div",{style:{
              display:"flex", alignItems:"center", gap:"12px",
              marginBottom:"16px", padding:"10px 14px",
              background:"rgba(229,120,109,0.08)",
              border:"1px solid rgba(229,120,109,0.25)",
              borderRadius:"8px"
            }},
              React.createElement("div",{style:{flex:1}},
                React.createElement("div",{style:{fontSize:"13px",fontWeight:"600",
                  color:W.orange,marginBottom:"2px"}},
                  `${dupGroups.length} groep${dupGroups.length!==1?"en":""} met duplicaten`),
                React.createElement("div",{style:{fontSize:"12px",color:W.fgMuted}},
                  "Selecteer per groep welke notitie je wilt bewaren. De rest wordt verwijderd.")
              ),
              dupDone
                ? React.createElement("span",{style:{color:W.comment,fontSize:"13px",
                    fontWeight:"600"}}, "✓ Klaar!")
                : React.createElement("button",{
                    onClick: doMerge,
                    disabled: Object.keys(dupSel).length === 0,
                    style:{
                      background: W.orange, color: W.bg,
                      border:"none", borderRadius:"6px",
                      padding:"7px 16px", fontSize:"13px",
                      fontWeight:"700", cursor:"pointer", flexShrink:0,
                      opacity: Object.keys(dupSel).length===0 ? 0.5 : 1,
                    }
                  }, `🗑 Verwijder duplicaten`)
            ),

            // Groepen
            ...dupGroups.map(({key, notes:g}) =>
              React.createElement("div",{key,style:{
                marginBottom:"12px", border:`1px solid ${W.splitBg}`,
                borderRadius:"8px", overflow:"hidden"
              }},
                // Groep-header
                React.createElement("div",{style:{
                  background:W.bg2, padding:"7px 12px",
                  fontSize:"11px", color:W.fgMuted,
                  letterSpacing:"0.8px", borderBottom:`1px solid ${W.splitBg}`,
                  display:"flex", alignItems:"center", gap:"8px"
                }},
                  React.createElement("span",null,
                    key.startsWith("url:") ? "🔗 Zelfde URL" : "📝 Zelfde titel"),
                  React.createElement("span",{style:{
                    background:"rgba(229,120,109,0.15)",
                    color:W.orange, borderRadius:"8px",
                    padding:"1px 7px", fontSize:"11px"
                  }}, `${g.length}×`)
                ),

                // Notities in groep
                ...g.map(n => {
                  const isKeep = dupSel[key] === n.id;
                  const date = new Date(n.importedAt||n.created)
                    .toLocaleDateString("nl-NL",{day:"numeric",month:"short",year:"numeric"});
                  return React.createElement("div",{
                    key:n.id,
                    onClick:()=>setDupSel(p=>({...p,[key]:n.id})),
                    style:{
                      display:"flex", alignItems:"center", gap:"10px",
                      padding:"9px 12px", cursor:"pointer",
                      background: isKeep
                        ? "rgba(159,202,86,0.08)" : "transparent",
                      borderBottom:`1px solid ${W.splitBg}`,
                      transition:"background 0.1s",
                    }
                  },
                    // Radio-knop
                    React.createElement("div",{style:{
                      width:"16px", height:"16px", borderRadius:"50%", flexShrink:0,
                      border:`2px solid ${isKeep ? W.comment : W.fgMuted}`,
                      background: isKeep ? W.comment : "transparent",
                      display:"flex", alignItems:"center", justifyContent:"center",
                    }},
                      isKeep && React.createElement("div",{style:{
                        width:"6px",height:"6px",borderRadius:"50%",background:W.bg
                      }})
                    ),
                    // Info
                    React.createElement("div",{style:{flex:1, minWidth:0}},
                      React.createElement("div",{style:{
                        fontSize:"13px", fontWeight: isKeep?"600":"400",
                        color: isKeep ? W.fg : W.fgMuted,
                        whiteSpace:"nowrap", overflow:"hidden",
                        textOverflow:"ellipsis"
                      }}, n.title || "(zonder titel)"),
                      React.createElement("div",{style:{
                        fontSize:"11px", color:W.fgDim, marginTop:"2px",
                        display:"flex", gap:"8px"
                      }},
                        React.createElement("span",null, date),
                        n.sourceUrl && React.createElement("span",{style:{
                          overflow:"hidden", textOverflow:"ellipsis",
                          whiteSpace:"nowrap", maxWidth:"240px"
                        }}, n.sourceUrl)
                      )
                    ),
                    // Label
                    React.createElement("div",{style:{
                      fontSize:"11px", flexShrink:0,
                      color: isKeep ? W.comment : W.orange,
                      fontWeight:"600"
                    }}, isKeep ? "✓ bewaren" : "× verwijderen"),
                    // Open-knop
                    React.createElement("button",{
                      onClick:e=>{ e.stopPropagation(); onSelectNote?.(n.id); },
                      style:{ background:"none", border:`1px solid ${W.splitBg}`,
                        color:W.fgMuted, borderRadius:"4px",
                        padding:"2px 8px", fontSize:"11px",
                        cursor:"pointer", flexShrink:0 }
                    }, "→")
                  );
                })
              )
            )
          )
    ),

    // ── Tabel (alleen in lijst-weergave) ────────────────────────────────────────
    view === "list" && (items.length === 0
      ? React.createElement("div", { style:S.empty },
          React.createElement("div", { style:{ fontSize:"40px" } }, "📭"),
          React.createElement("div", null, filter !== "all"
            ? "Geen notities voor dit filter"
            : "Nog geen geïmporteerde notities"),
          filter !== "all" && React.createElement("button", {
            onClick:()=>setFilter("all"),
            style:{ background:"none", border:`1px solid ${W.splitBg}`,
                    color:W.fgMuted, borderRadius:"5px", padding:"4px 12px",
                    fontSize:"13px", cursor:"pointer" }
          }, "Toon alles")
        )
      : React.createElement("div", { style:S.table },
          // Tabel-header
          React.createElement("div", { style:{
            display:"grid", gridTemplateColumns:"36px 100px 1fr 80px",
          } },
            React.createElement("div", { style:S.th }, ""),
            React.createElement("div", {
              style:{...S.th, cursor:"pointer", userSelect:"none"},
              onClick:()=>setSortBy("date"),
              title:"Sorteer op datum"
            }, sortBy==="date" ? "DATUM ↓" : "DATUM"),
            React.createElement("div", { style:S.th }, "TITEL"),
            React.createElement("div", {
              style:{...S.th, cursor:"pointer", userSelect:"none"},
              onClick:()=>setSortBy(sortBy==="readtime_asc"?"readtime_desc":"readtime_asc"),
              title:"Sorteer op leestijd"
            }, sortBy==="readtime_desc" ? "LEESTIJD ↑" : sortBy==="readtime_asc" ? "LEESTIJD ↓" : "LEESTIJD"),
          ),

          // Rijen
          items.map(note =>
            React.createElement("div", {
              key: note.id,
              style: S.tr(note.isRead, hovered===note.id),
              onMouseEnter: ()=>setHovered(note.id),
              onMouseLeave: ()=>setHovered(null),
              onClick: ()=>onSelectNote(note.id),
            },

              // Cel 1 — checkbox
              React.createElement("div", {
                style:{ ...S.td, display:"flex", alignItems:"center",
                        justifyContent:"center", padding:"9px 6px" },
                onClick: e => { e.stopPropagation(); toggleRead(note); }
              },
                React.createElement("div", {
                  title: note.isRead ? "Markeer als ongelezen" : "Markeer als gelezen",
                  style:{
                    width:"18px", height:"18px", borderRadius:"4px",
                    border:`2px solid ${note.isRead ? W.comment : W.splitBg}`,
                    background: note.isRead ? W.comment : "transparent",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    flexShrink:0, transition:"all 0.12s",
                  }
                },
                  note.isRead && React.createElement("span", {
                    style:{ color:W.bg, fontSize:"11px", fontWeight:"bold", lineHeight:1 }
                  }, "✓")
                )
              ),

              // Cel 2 — datum
              React.createElement("div", { style:{ ...S.td, color:W.fgMuted, fontSize:"12px" } },
                fmtDate(note.importedAt || note.created)
              ),

              // Cel 3 — titel
              React.createElement("div", { style:{ ...S.td, color:note.isRead?W.fgMuted:W.fg,
                fontWeight: note.isRead ? "400" : "500" } },
                note.isRead && React.createElement("span", {
                  style:{ marginRight:"6px", fontSize:"11px", color:W.comment }
                }, "✓"),
                note.title || "(zonder titel)"
              ),

              // Cel 4 — leestijd
              React.createElement("div", { style:{ ...S.td, color:W.fgDim,
                fontSize:"12px", textAlign:"right", paddingRight:"16px" } },
                `${note._mins} min`
              )
            )
          )
        )
    )
  );
};
