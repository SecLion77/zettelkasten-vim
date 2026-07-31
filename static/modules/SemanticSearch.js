// ── SemanticSearch ────────────────────────────────────────────────────────────
// Zoekt notities op betekenis via lokale Ollama embeddings (nomic-embed-text).
// Bouwt een index op en bewaart die in de vault als .zettelkasten_embeddings.json

const SemanticSearch = ({ notes = [], onOpenNote, llmModel = "" }) => {
  const { useState, useEffect, useCallback, useMemo } = React;

  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [indexStatus, setIndexStatus] = useState(null); // {indexed, total}
  const [indexing,    setIndexing]    = useState(false);
  const [indexPct,    setIndexPct]    = useState(0);
  const [error,       setError]       = useState("");
  const [embedModel,  setEmbedModel]  = useState("nomic-embed-text");
  const [ollamaModels,setOllamaModels]= useState([]);

  // ── Laad status bij mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/semantic/status", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}) })
      .then(r => r.json())
      .then(d => setIndexStatus({ indexed: d.indexed || 0, total: notes.length }))
      .catch(() => {});
    // Haal beschikbare Ollama modellen op
    fetch("/api/ollama-models", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      .then(r => r.json())
      .then(d => {
        const emb = (d.models || []).filter(m =>
          m.includes("embed") || m.includes("nomic") || m.includes("mxbai")
        );
        if (emb.length > 0) { setOllamaModels(emb); setEmbedModel(emb[0]); }
      })
      .catch(() => {});
  }, [notes.length]);

  // ── Index bouwen / bijwerken ─────────────────────────────────────────────
  const buildIndex = useCallback(async (onlyMissing = true) => {
    setIndexing(true); setError(""); setIndexPct(0);
    try {
      // Haal huidige status op
      const statusResp = await fetch("/api/semantic/status", { method:"POST",
        headers:{"Content-Type":"application/json"}, body:JSON.stringify({}) });
      const status = await statusResp.json();
      const indexed = new Set(Object.keys(status.ids || {}));

      // Bepaal welke notities geïndexeerd moeten worden
      const toIndex = onlyMissing
        ? notes.filter(n => !indexed.has(n.id))
        : notes;

      if (toIndex.length === 0) {
        setIndexStatus({ indexed: status.indexed, total: notes.length });
        setIndexing(false); return;
      }

      // Batch verwerken (5 per keer)
      const BATCH = 5;
      let done = 0;
      for (let i = 0; i < toIndex.length; i += BATCH) {
        const batch = toIndex.slice(i, i + BATCH).map(n => ({
          id:   n.id,
          text: `${n.title || ""}\n\n${(n.content || "")
            .replace(/^---[\s\S]*?---/, "")
            .replace(/#{1,6}\s/g, "")
            .trim()
            .slice(0, 1500)}`,
        }));
        const resp = await fetch("/api/semantic/embed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ texts: batch, model: embedModel }),
        });
        const d = await resp.json();
        if (!d.ok) {
          setError(d.error + (d.hint ? `\n💡 ${d.hint}` : ""));
          setIndexing(false); return;
        }
        done += batch.length;
        setIndexPct(Math.round((done / toIndex.length) * 100));
        setIndexStatus({ indexed: d.total, total: notes.length });
      }
    } catch(e) {
      setError(`Index fout: ${e.message}`);
    }
    setIndexing(false);
  }, [notes, embedModel]);

  // ── Semantisch zoeken ─────────────────────────────────────────────────────
  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true); setError(""); setResults([]);
    try {
      const resp = await fetch("/api/semantic/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), model: embedModel, limit: 12 }),
      });
      const d = await resp.json();
      if (!d.ok) {
        setError(d.error + (d.hint ? `\n💡 ${d.hint}` : ""));
        setSearching(false); return;
      }
      // Koppel scores aan notities
      const noteMap = Object.fromEntries(notes.map(n => [n.id, n]));
      const hits = (d.results || [])
        .map(r => ({ ...r, note: noteMap[r.id] }))
        .filter(r => r.note && r.score > 0.3);
      setResults(hits);
    } catch(e) {
      setError(`Zoekfout: ${e.message}`);
    }
    setSearching(false);
  }, [query, notes, embedModel]);

  const W = window.THEME_VARS || {};

  const covered = indexStatus
    ? Math.round((indexStatus.indexed / Math.max(indexStatus.total, 1)) * 100)
    : 0;

  return React.createElement("div", {
    style: { flex:1, display:"flex", flexDirection:"column",
             overflow:"hidden", minHeight:0 }
  },

    // ── Header ───────────────────────────────────────────────────────────────
    React.createElement("div", {
      style: { padding:"16px 20px", borderBottom:`1px solid ${W.splitBg}`,
               display:"flex", flexDirection:"column", gap:"10px" }
    },
      React.createElement("div", { style:{fontWeight:"700",fontSize:"15px",color:W.fg} },
        "🔍 Semantisch zoeken"),
      React.createElement("div", { style:{fontSize:"12px",color:W.fgMuted} },
        "Zoekt op betekenis via lokale Ollama embeddings — vindt ook zonder exacte woorden."),

      // Zoekbalk
      React.createElement("div", { style:{display:"flex",gap:"8px"} },
        React.createElement("input", {
          value: query, onChange: e => setQuery(e.target.value),
          onKeyDown: e => e.key === "Enter" && doSearch(),
          placeholder: "Zoek op concept… bijv. 'API governance principes'",
          style: { flex:1, background:W.bg, border:`1px solid ${W.blue}`,
                   borderRadius:"7px", padding:"9px 14px",
                   color:W.fg, fontSize:"14px", outline:"none" }
        }),
        React.createElement("button", {
          onClick: doSearch, disabled: searching || !query.trim(),
          style: { background:W.blue, color:W.bg, border:"none",
                   borderRadius:"7px", padding:"9px 18px",
                   cursor: searching ? "wait" : "pointer",
                   fontSize:"13px", fontWeight:"600",
                   opacity: searching ? 0.7 : 1 }
        }, searching ? "⏳" : "Zoek")
      ),

      // Index status + model keuze
      React.createElement("div", {
        style:{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}
      },
        // Model selector (toon alleen als er embedding-modellen zijn)
        ollamaModels.length > 1 && React.createElement("select", {
          value: embedModel, onChange: e => setEmbedModel(e.target.value),
          style: { background:W.bg2, border:`1px solid ${W.splitBg}`,
                   color:W.fg, borderRadius:"5px", padding:"3px 8px",
                   fontSize:"11px", cursor:"pointer" }
        }, ollamaModels.map(m =>
          React.createElement("option", {key:m, value:m}, m)
        )),

        // Index voortgang
        React.createElement("div", {style:{fontSize:"11px",color:W.fgMuted,flex:1}},
          indexStatus
            ? `${indexStatus.indexed}/${indexStatus.total} notities geïndexeerd (${covered}%)`
            : "Index status laden…"
        ),

        // Voortgangsbalk
        indexStatus && React.createElement("div",{
          style:{width:"80px",height:"4px",background:W.splitBg,
                 borderRadius:"2px",overflow:"hidden"}},
          React.createElement("div",{style:{
            height:"100%",borderRadius:"2px",
            background: covered===100 ? "#72b660" : W.blue,
            width:`${covered}%`, transition:"width .3s"
          }})
        ),

        // Index-knop
        React.createElement("button", {
          onClick: () => buildIndex(true),
          disabled: indexing,
          title: "Indexeer ontbrekende notities (nieuwe + gewijzigde)",
          style: { background:"none", border:`1px solid ${W.splitBg}`,
                   color:W.fgMuted, borderRadius:"5px",
                   padding:"3px 10px", fontSize:"11px",
                   cursor: indexing ? "wait" : "pointer" }
        }, indexing ? `⏳ ${indexPct}%` : "↻ Index bijwerken"),

        covered < 100 && !indexing && React.createElement("button", {
          onClick: () => buildIndex(false),
          title: "Herindexeer alle notities",
          style: { background:"none", border:`1px solid ${W.splitBg}`,
                   color:W.fgDim, borderRadius:"5px",
                   padding:"3px 8px", fontSize:"11px", cursor:"pointer" }
        }, "Alles herindexeren"),
      ),

      // Foutmelding
      error && React.createElement("div", {
        style: { background:"rgba(229,120,109,0.08)",
                 border:"1px solid rgba(229,120,109,0.3)",
                 borderRadius:"6px", padding:"10px 14px",
                 fontSize:"12px", color:"#e5786d", whiteSpace:"pre-line" }
      }, error)
    ),

    // ── Resultaten ────────────────────────────────────────────────────────────
    React.createElement("div", {
      style:{ flex:1, overflowY:"auto", padding:"12px 20px" }
    },
      // Geen resultaten na zoeken
      results.length === 0 && !searching && query && !error &&
        React.createElement("div",{
          style:{textAlign:"center",padding:"40px 0",color:W.fgMuted,fontSize:"13px"}
        },
          React.createElement("div",{style:{fontSize:"24px",marginBottom:"8px"}},"🔍"),
          "Geen resultaten gevonden boven drempelwaarde (0.30).",
          React.createElement("div",{style:{fontSize:"11px",marginTop:"8px",color:W.fgDim}},
            covered < 50
              ? "Tip: indexeer meer notities voor betere resultaten."
              : "Probeer een andere formulering of zorg dat nomic-embed-text is geïnstalleerd.")
        ),

      // Startscherm
      results.length === 0 && !query &&
        React.createElement("div",{
          style:{textAlign:"center",padding:"40px 20px",color:W.fgMuted}
        },
          React.createElement("div",{style:{fontSize:"32px",marginBottom:"12px"}},"🧠"),
          React.createElement("div",{style:{fontSize:"14px",fontWeight:"600",color:W.fg,marginBottom:"8px"}},
            "Zoeken op betekenis"),
          React.createElement("div",{style:{fontSize:"13px",lineHeight:"1.7",maxWidth:"400px",margin:"0 auto"}},
            "Stel een vraag of beschrijf een concept. Het systeem zoekt notities die ",
            React.createElement("em",null,"inhoudelijk"),
            " overeenkomen — ook als de exacte woorden niet voorkomen."),
          React.createElement("div",{style:{
            marginTop:"20px",padding:"14px 20px",
            background:W.bg2, border:`1px solid ${W.splitBg}`,
            borderRadius:"8px", textAlign:"left", fontSize:"12px", color:W.fgDim
          }},
            React.createElement("div",{style:{fontWeight:"600",color:W.fgMuted,marginBottom:"8px"}},"Voorbeelden:"),
            ["Wat zijn de principes rond API governance?",
             "Hoe verhouden Conway's Law en microservices zich?",
             "Welke beslissingen zijn gemaakt over data-architectuur?",
            ].map((ex, i) =>
              React.createElement("div",{
                key:i, style:{padding:"5px 0",cursor:"pointer",
                  borderBottom:i<2?`1px solid ${W.splitBg}`:"none"},
                onClick:()=>{ setQuery(ex); setTimeout(doSearch, 100); }
              },
                React.createElement("span",{style:{color:W.blue}},"→ "),
                React.createElement("em",null, ex)
              )
            )
          ),
          // Setup instructie als index leeg is
          (!indexStatus || indexStatus.indexed === 0) &&
            React.createElement("div",{style:{
              marginTop:"16px",padding:"12px 16px",
              background:"rgba(234,196,53,0.08)",
              border:"1px solid rgba(234,196,53,0.25)",
              borderRadius:"8px",fontSize:"12px",color:W.yellow||"#eac435"
            }},
              "⚠ Index is leeg. Klik '↻ Index bijwerken' om te starten.",
              React.createElement("br"),
              "Vereist: ",
              React.createElement("code",{style:{fontSize:"11px"}},"ollama pull nomic-embed-text")
            )
        ),

      // Resultatenlijst
      results.length > 0 && React.createElement("div",{style:{
        display:"flex",flexDirection:"column",gap:"2px"
      }},
        React.createElement("div",{style:{
          fontSize:"12px",color:W.fgMuted,marginBottom:"10px"
        }},
          `${results.length} resultaten gevonden voor "${query}"`),
        results.map((hit, i) => {
          const pct   = Math.round(hit.score * 100);
          const color = pct > 80 ? "#72b660" : pct > 60 ? W.blue : W.fgMuted;
          const excerpt = (hit.note.content || "")
            .replace(/^---[\s\S]*?---/, "").replace(/#{1,6}\s/g, "")
            .trim().slice(0, 160);

          return React.createElement("div",{
            key: hit.id,
            onClick: () => onOpenNote?.(hit.id),
            style:{
              display:"flex",alignItems:"flex-start",gap:"12px",
              padding:"10px 14px",borderRadius:"8px",
              background: i===0 ? `rgba(138,198,242,0.06)` : "transparent",
              border:`1px solid ${i===0 ? "rgba(138,198,242,0.2)" : "transparent"}`,
              cursor:"pointer",transition:"background .1s",
            },
            onMouseEnter: e => e.currentTarget.style.background = W.bg2,
            onMouseLeave: e => e.currentTarget.style.background = i===0?"rgba(138,198,242,0.06)":"transparent",
          },
            // Similarity score
            React.createElement("div",{style:{
              width:"42px",height:"42px",borderRadius:"50%",flexShrink:0,
              background:`rgba(${color.replace("#","").match(/../g)?.map(h=>parseInt(h,16)).join(",")},0.12)`,
              border:`2px solid ${color}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:"11px",fontWeight:"700",color
            }}, `${pct}%`),
            // Notitie info
            React.createElement("div",{style:{flex:1,minWidth:0}},
              React.createElement("div",{style:{
                fontSize:"14px",color:W.fg,fontWeight:"600",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"
              }}, hit.note.title || "(Naamloos)"),
              React.createElement("div",{style:{
                fontSize:"12px",color:W.fgMuted,marginTop:"3px",
                overflow:"hidden",display:"-webkit-box",
                WebkitLineClamp:"2",WebkitBoxOrient:"vertical"
              }}, excerpt || ""),
              hit.note.tags?.length > 0 &&
                React.createElement("div",{style:{marginTop:"5px",display:"flex",gap:"4px",flexWrap:"wrap"}},
                  hit.note.tags.slice(0,4).map(t =>
                    React.createElement("span",{key:t,style:{
                      fontSize:"10px",background:W.bg2,
                      border:`1px solid ${W.splitBg}`,
                      borderRadius:"8px",padding:"1px 7px",color:W.fgMuted
                    }},t)
                  )
                )
            )
          );
        })
      )
    )
  );
};
