// ── QueryPanel ─────────────────────────────────────────────────────────────────
// Dataview-achtige query interface: filter notities op type, tags, datum, links.
// Props: notes, allTags, onOpenNote(id)

const QueryPanel = ({ notes = [], allTags = [], onOpenNote }) => {
  const { useState, useMemo } = React;
  const [type,       setType]       = useState("");
  const [tags,       setTags]       = useState([]);
  const [tagInput,   setTagInput]   = useState("");
  const [dateFrom,   setDateFrom]   = useState("");
  const [dateTo,     setDateTo]     = useState("");
  const [hasLinks,   setHasLinks]   = useState(false);
  const [noLinks,    setNoLinks]    = useState(false);
  const [minWords,   setMinWords]   = useState("");
  const [sortBy,     setSortBy]     = useState("modified");
  const [sortDir,    setSortDir]    = useState("desc");
  const [showQuery,  setShowQuery]  = useState(true);

  const NOTE_TYPES = [
    {id:"",          label:"Alle typen"},
    {id:"fleeting",  label:"Vluchtig",   color:"#857b6f"},
    {id:"literature",label:"Literatuur", color:"#8ac6f2"},
    {id:"permanent", label:"Permanent",  color:"#9fca56"},
    {id:"index",     label:"Index",      color:"#e5786d"},
  ];

  const extractLinks = (content) =>
    [...(content||"").matchAll(/\[\[([^\]]+)\]\]/g)].map(m=>m[1]);

  const wordCount = (content) =>
    (content||"").trim().split(/\s+/).filter(Boolean).length;

  // Query uitvoeren
  const results = useMemo(() => {
    let list = notes;

    if (type)       list = list.filter(n => (n.noteType||"") === type);
    if (tags.length) list = list.filter(n => tags.every(t => (n.tags||[]).includes(t)));
    if (hasLinks)   list = list.filter(n => extractLinks(n.content).length > 0);
    if (noLinks)    list = list.filter(n => extractLinks(n.content).length === 0);
    if (minWords)   list = list.filter(n => wordCount(n.content) >= parseInt(minWords)||0);

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter(n => {
        const d = new Date(n.created||n.modified||0).getTime();
        return !isNaN(d) && d >= from;
      });
    }
    if (dateTo) {
      const to = new Date(dateTo).getTime() + 86400000;
      list = list.filter(n => {
        const d = new Date(n.created||n.modified||0).getTime();
        return !isNaN(d) && d <= to;
      });
    }

    // Sorteren
    list = [...list].sort((a,b) => {
      let va, vb;
      if (sortBy === "title")   { va = a.title||""; vb = b.title||""; return sortDir==="asc"?va.localeCompare(vb,"nl"):vb.localeCompare(va,"nl"); }
      if (sortBy === "words")   { va = wordCount(a.content); vb = wordCount(b.content); }
      if (sortBy === "links")   { va = extractLinks(a.content).length; vb = extractLinks(b.content).length; }
      else                      { va = new Date(a[sortBy]||a.created||0); vb = new Date(b[sortBy]||b.created||0); }
      return sortDir==="asc" ? va-vb : vb-va;
    });

    return list;
  }, [notes, type, tags, hasLinks, noLinks, minWords, dateFrom, dateTo, sortBy, sortDir]);

  const addTag = (t) => { if (t && !tags.includes(t)) setTags([...tags, t]); setTagInput(""); };
  const removeTag = (t) => setTags(tags.filter(x=>x!==t));
  const reset = () => { setType(""); setTags([]); setDateFrom(""); setDateTo("");
                        setHasLinks(false); setNoLinks(false); setMinWords(""); };

  const suggestedTags = tagInput
    ? allTags.filter(t => t.includes(tagInput.toLowerCase()) && !tags.includes(t)).slice(0,6)
    : [];

  const S = {
    container: { display:"flex", flexDirection:"column", height:"100%", background:W.bg, overflow:"hidden" },
    header: { padding:"10px 16px 8px", borderBottom:`1px solid ${W.splitBg}`, background:W.bg2, flexShrink:0 },
    titleRow: { display:"flex", alignItems:"center", gap:"8px", marginBottom:"6px" },
    title: { fontSize:"16px", fontWeight:"700", color:W.statusFg, flex:1 },
    queryPanel: { padding:"10px 16px", borderBottom:`1px solid ${W.splitBg}`,
                  background:W.bg3, flexShrink:0, display:"flex", flexDirection:"column", gap:"8px" },
    row: { display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" },
    label: { fontSize:"10px", color:W.fgMuted, letterSpacing:"0.5px", textTransform:"uppercase",
              minWidth:"60px", flexShrink:0 },
    select: { background:W.bg, border:`1px solid ${W.splitBg}`, borderRadius:"5px",
               color:W.fg, fontSize:"12px", padding:"3px 6px", cursor:"pointer", outline:"none" },
    input: { background:W.bg, border:`1px solid ${W.splitBg}`, borderRadius:"5px",
              color:W.fg, fontSize:"12px", padding:"3px 8px", outline:"none", width:"110px" },
    checkBtn: (active) => ({
      padding:"2px 8px", borderRadius:"10px", fontSize:"11px", cursor:"pointer",
      border:`1px solid ${active?W.comment+"55":W.splitBg}`,
      background:active?`${W.comment}18`:"transparent",
      color:active?W.comment:W.fgMuted, transition:"all 0.12s",
    }),
    resultHeader: { padding:"6px 16px", borderBottom:`1px solid ${W.splitBg}`,
                    display:"flex", alignItems:"center", gap:"8px",
                    background:W.bg2, flexShrink:0 },
    scroll: { flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch" },
    noteRow: { padding:"7px 16px", cursor:"pointer", borderBottom:`1px solid ${W.splitBg}22`,
               display:"flex", alignItems:"center", gap:"10px", transition:"background 0.1s" },
    noteTitle: { fontSize:"13px", color:W.fg, fontWeight:"500", flex:1,
                 overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
    noteMeta: { fontSize:"10px", color:W.fgDim, whiteSpace:"nowrap" },
  };

  const TYPE_COLOR = {fleeting:"#857b6f",literature:"#8ac6f2",permanent:"#9fca56",index:"#e5786d"};

  return React.createElement("div", {style:S.container},
    // Header
    React.createElement("div", {style:S.header},
      React.createElement("div", {style:S.titleRow},
        React.createElement("span", {style:S.title}, "🔎 Query"),
        React.createElement("button", {
          onClick:reset,
          style:{...S.checkBtn(false), fontSize:"11px"}
        }, "× wis filters"),
        React.createElement("button", {
          onClick:()=>setShowQuery(p=>!p),
          style:{...S.checkBtn(false)}
        }, showQuery?"▲ verberg":"▼ filters"),
      )
    ),

    // Query formulier
    showQuery && React.createElement("div", {style:S.queryPanel},
      // Notitietype
      React.createElement("div", {style:S.row},
        React.createElement("span", {style:S.label}, "Type"),
        React.createElement("select", {value:type, onChange:e=>setType(e.target.value), style:S.select},
          NOTE_TYPES.map(t => React.createElement("option",{key:t.id,value:t.id},t.label))
        )
      ),

      // Tags
      React.createElement("div", {style:S.row},
        React.createElement("span", {style:S.label}, "Tags"),
        React.createElement("div", {style:{position:"relative", flex:1}},
          React.createElement("input", {
            value:tagInput, onChange:e=>setTagInput(e.target.value),
            onKeyDown:e=>{if(e.key==="Enter"||e.key===","||e.key===" "){e.preventDefault();addTag(tagInput.trim());}},
            placeholder:"tag toevoegen…",
            style:{...S.input, width:"130px"},
          }),
          suggestedTags.length > 0 && React.createElement("div", {
            style:{position:"absolute",top:"100%",left:0,background:W.bg3,
                   border:`1px solid ${W.splitBg}`,borderRadius:"5px",zIndex:50,
                   minWidth:"130px",boxShadow:"0 4px 12px rgba(0,0,0,0.5)"}
          },
            suggestedTags.map(t => React.createElement("div",{
              key:t, onClick:()=>addTag(t),
              style:{padding:"4px 10px",fontSize:"12px",cursor:"pointer",color:W.fg}
            }, "#"+t))
          )
        ),
        ...tags.map(t => React.createElement("span", {
          key:t,
          style:{background:`${W.comment}18`,border:`1px solid ${W.comment}44`,
                 borderRadius:"10px",padding:"2px 6px",fontSize:"11px",color:W.comment,
                 cursor:"pointer",display:"flex",alignItems:"center",gap:"4px"},
          onClick:()=>removeTag(t),
        }, "#"+t, " ×"))
      ),

      // Datum
      React.createElement("div", {style:S.row},
        React.createElement("span", {style:S.label}, "Datum"),
        React.createElement("input", {
          type:"date", value:dateFrom, onChange:e=>setDateFrom(e.target.value),
          style:S.input, title:"Aangemaakt vanaf"
        }),
        React.createElement("span", {style:{fontSize:"11px",color:W.fgMuted}},"t/m"),
        React.createElement("input", {
          type:"date", value:dateTo, onChange:e=>setDateTo(e.target.value),
          style:S.input, title:"Aangemaakt tot"
        }),
      ),

      // Extra filters
      React.createElement("div", {style:S.row},
        React.createElement("span", {style:S.label}, "Extra"),
        React.createElement("button", {onClick:()=>{setHasLinks(p=>!p);setNoLinks(false);},
          style:S.checkBtn(hasLinks)}, "heeft links"),
        React.createElement("button", {onClick:()=>{setNoLinks(p=>!p);setHasLinks(false);},
          style:S.checkBtn(noLinks)}, "geen links"),
        React.createElement("input", {
          type:"number", value:minWords, onChange:e=>setMinWords(e.target.value),
          placeholder:"min. woorden", style:{...S.input, width:"110px"}
        }),
      ),

      // Sortering
      React.createElement("div", {style:S.row},
        React.createElement("span", {style:S.label}, "Sorteren"),
        React.createElement("select", {value:sortBy, onChange:e=>setSortBy(e.target.value), style:S.select},
          [{id:"modified",label:"Gewijzigd"},{id:"created",label:"Aangemaakt"},
           {id:"title",label:"Titel"},{id:"words",label:"Woorden"},{id:"links",label:"Links"}]
            .map(s=>React.createElement("option",{key:s.id,value:s.id},s.label))
        ),
        React.createElement("button", {
          onClick:()=>setSortDir(d=>d==="asc"?"desc":"asc"),
          style:{...S.checkBtn(false), minWidth:"40px"}
        }, sortDir==="desc"?"↓":"↑"),
      ),
    ),

    // Resultaten header
    React.createElement("div", {style:S.resultHeader},
      React.createElement("span", {style:{fontSize:"12px",color:W.fgMuted}},
        `${results.length} notities`),
    ),

    // Resultatenlijst
    React.createElement("div", {style:S.scroll},
      results.length === 0
        ? React.createElement("div", {style:{padding:"32px",textAlign:"center",color:W.fgMuted,fontSize:"13px"}},
            "Geen notities gevonden met deze filters.")
        : results.map(note => {
            const typeColor = TYPE_COLOR[note.noteType] || W.fgDim;
            const wc = wordCount(note.content);
            const lc = extractLinks(note.content).length;
            return React.createElement("div", {
              key:note.id,
              style:S.noteRow,
              onClick:()=>onOpenNote?.(note.id),
              onMouseEnter:e=>e.currentTarget.style.background="rgba(255,255,255,0.04)",
              onMouseLeave:e=>e.currentTarget.style.background="transparent",
            },
              note.noteType && React.createElement("div",{
                style:{width:"6px",height:"6px",borderRadius:"50%",
                       background:typeColor,flexShrink:0,marginTop:"3px"}
              }),
              React.createElement("div",{style:S.noteTitle}, note.title||note.id),
              React.createElement("div",{style:{display:"flex",gap:"8px",alignItems:"center",flexShrink:0}},
                ...(note.tags||[]).slice(0,2).map(t=>
                  React.createElement("span",{key:t,style:{fontSize:"10px",color:W.comment}},"#"+t)
                ),
                React.createElement("span",{style:S.noteMeta}, `${wc}w · ${lc}🔗`),
                React.createElement("span",{style:S.noteMeta},
                  note.created ? new Date(note.created).toLocaleDateString("nl-NL") : "")
              )
            );
          })
    )
  );
};
