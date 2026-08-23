// ── SemanticSearch ────────────────────────────────────────────────────────────
// Zoekt notities op betekenis via lokale Ollama embeddings (nomic-embed-text).
// Bouwt een index op en bewaart die in de vault als .zettelkasten_embeddings.json

const SemanticSearch = ({ notes = [], onOpenNote, onOpenPdf, llmModel = "", taskLlmModel = "" }) => {
  const { useState, useEffect, useCallback, useMemo, useRef } = React;

  const [query,       setQuery]       = useState("");
  const [results,     setResults]     = useState([]);
  const [pdfResults,  setPdfResults]  = useState([]);
  const [searching,   setSearching]   = useState(false);
  const [indexStatus, setIndexStatus] = useState(null); // {indexed, total}
  const [pdfIndexStatus, setPdfIndexStatus] = useState(null); // {indexed, total}
  const [indexing,    setIndexing]    = useState(false);
  const [pdfIndexing, setPdfIndexing] = useState(false);
  const [indexPct,    setIndexPct]    = useState(0);
  const [pdfIndexPct, setPdfIndexPct] = useState(0);
  const [error,       setError]       = useState("");
  const [embedModel,  setEmbedModel]  = useState(taskLlmModel || "nomic-embed-text");
  const [ollamaModels,setOllamaModels]= useState([]);

  // Model per taak (VaultSettings → Modellen), anders direct nomic-embed-text
  // — NIET het hoofdmodel: semantisch zoeken heeft een embedding-model
  // nodig, en het hoofdmodel is vrijwel altijd een gewoon chat-model
  // (bv. gemma3:12b), dat Ollama's embeddings-endpoint niet kan bedienen.
  // Alleen zolang de gebruiker deze sessie niet zelf iets anders koos
  // in de dropdown hieronder.
  const userPickedModelRef = useRef(false);
  useEffect(() => {
    if (userPickedModelRef.current) return;
    setEmbedModel(taskLlmModel || "nomic-embed-text");
  }, [taskLlmModel]);

  // ── Laad status bij mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/semantic/status", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}) })
      .then(r => r.json())
      .then(d => {
        setIndexStatus({ indexed: d.indexed || 0, total: notes.length });
        setPdfIndexStatus({ indexed: d.pdf_indexed || 0, total: d.pdf_total_pages || 0 });
      })
      .catch(() => {});
    // Haal beschikbare Ollama modellen op
    fetch("/api/ollama-models", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      .then(r => r.json())
      .then(d => {
        const emb = (d.models || []).filter(m =>
          m.includes("embed") || m.includes("nomic") || m.includes("mxbai")
        );
        if (emb.length > 0) {
          setOllamaModels(emb);
          // Automatisch kiezen alleen als er geen ingestelde taak-voorkeur is
          // (VaultSettings → Modellen) en de gebruiker deze sessie nog niets
          // zelf koos — anders overschrijft dit stilzwijgend een bewuste
          // instelling. Geen check op llmModel meer: het hoofdmodel is geen
          // geldige fallback voor embeddings, dus die telt hier niet mee.
          if (!taskLlmModel && !userPickedModelRef.current) {
            setEmbedModel(emb[0]);
          }
        }
      })
      .catch(() => {});
  }, [notes.length]);

  // ── PDF-index bouwen / bijwerken ─────────────────────────────────────────
  // Anders dan buildIndex() hierboven: de server bepaalt zelf welke
  // pagina-chunks nog ontbreken (via _iter_pdf_chunks() tegen de opgeslagen
  // embeddings) — de client hoeft dus geen lijst mee te sturen, alleen te
  // blijven aanroepen tot "remaining" op 0 staat.
  const buildPdfIndex = useCallback(async () => {
    setPdfIndexing(true); setError(""); setPdfIndexPct(0);
    try {
      let remaining = 1, totalToDo = null, done = 0;
      while (remaining > 0) {
        const resp = await fetch("/api/semantic/embed-pdfs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: embedModel, batch_size: 5 }),
        });
        const d = await resp.json();
        if (!d.ok) {
          setError(d.error + (d.hint ? `\n💡 ${d.hint}` : ""));
          setPdfIndexing(false); return;
        }
        remaining = d.remaining || 0;
        if (totalToDo === null) totalToDo = d.updated + remaining;
        done += d.updated;
        setPdfIndexPct(totalToDo > 0 ? Math.round((done / totalToDo) * 100) : 100);
        setPdfIndexStatus(p => ({ indexed: d.total, total: p?.total || 0 }));
        if (d.updated === 0 && remaining > 0) break; // voorkom oneindige lus bij een hardnekkige fout per item
      }
    } catch(e) {
      setError(`PDF-index fout: ${e.message}`);
    }
    setPdfIndexing(false);
  }, [embedModel]);

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
    setSearching(true); setError(""); setResults([]); setPdfResults([]);
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
      setPdfResults((d.pdf_results || []).filter(r => r.score > 0.3));
    } catch(e) {
      setError(`Zoekfout: ${e.message}`);
    }
    setSearching(false);
  }, [query, notes, embedModel]);

  const W = window.THEME_VARS || {};

  const covered = indexStatus
    ? Math.round((indexStatus.indexed / Math.max(indexStatus.total, 1)) * 100)
    : 0;
  const pdfCovered = pdfIndexStatus && pdfIndexStatus.total > 0
    ? Math.round((pdfIndexStatus.indexed / pdfIndexStatus.total) * 100)
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
      React.createElement("div", { style:{fontWeight:"700",fontSize:"15px",color:W.fg,display:"flex",alignItems:"center",gap:"8px"} },
        "🔍 Semantisch zoeken",
        // Indicator: een ander model dan het hoofdmodel is ingesteld voor
        // deze taak (VaultSettings → Modellen → "Model per taak")
        taskLlmModel && React.createElement("span",{
          title:`Deze tab gebruikt een eigen model (${taskLlmModel}) i.p.v. het hoofdmodel — instelbaar bij Instellingen → Modellen`,
          style:{
            display:"flex",alignItems:"center",gap:"4px",
            fontSize:"11px",fontWeight:"400",color:"#a8d8f0",
            background:"rgba(138,198,242,0.1)",
            border:"1px solid rgba(138,198,242,0.3)",
            borderRadius:"10px",padding:"2px 9px",
          }
        }, "🧠 ", taskLlmModel)
      ),
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
                   fontSize:"13px", fontWeight:"700",
                   opacity: searching ? 0.7 : 1 }
        }, searching ? "⏳" : "Zoek")
      ),

      // Index status + model keuze
      React.createElement("div", {
        style:{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}
      },
        // Model selector (toon alleen als er embedding-modellen zijn)
        ollamaModels.length > 1 && React.createElement("select", {
          value: embedModel, onChange: e => { userPickedModelRef.current = true; setEmbedModel(e.target.value); },
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
          style: {
            background: indexing ? "rgba(138,198,242,0.1)" : "rgba(255,255,255,0.07)",
            border: `1px solid ${W.blue}`,
            color: W.blue,
            borderRadius:"6px", padding:"4px 12px",
            fontSize:"12px", fontWeight:"600",
            cursor: indexing ? "wait" : "pointer",
            opacity: indexing ? 0.7 : 1,
          }
        }, indexing ? `⏳ ${indexPct}%` : "↻ Index bijwerken"),

        covered < 100 && !indexing && React.createElement("button", {
          onClick: () => buildIndex(false),
          title: "Herindexeer alle notities",
          style: {
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${W.splitBg}`,
            color: W.fg,
            borderRadius:"6px", padding:"4px 10px",
            fontSize:"12px", fontWeight:"500",
            cursor:"pointer",
          }
        }, "Alles herindexeren"),
      ),

      // PDF-index status + knop — zelfde patroon als notities hierboven
      pdfIndexStatus && pdfIndexStatus.total > 0 && React.createElement("div", {
        style:{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap"}
      },
        React.createElement("div", {style:{fontSize:"11px",color:W.fgMuted,flex:1}},
          `📄 ${pdfIndexStatus.indexed}/${pdfIndexStatus.total} PDF-pagina's geïndexeerd (${pdfCovered}%)`
        ),
        React.createElement("div",{
          style:{width:"80px",height:"4px",background:W.splitBg,
                 borderRadius:"2px",overflow:"hidden"}},
          React.createElement("div",{style:{
            height:"100%",borderRadius:"2px",
            background: pdfCovered===100 ? "#72b660" : W.blue,
            width:`${pdfCovered}%`, transition:"width .3s"
          }})
        ),
        pdfCovered < 100 && React.createElement("button", {
          onClick: buildPdfIndex,
          disabled: pdfIndexing,
          title: "Indexeer PDF-pagina's voor semantisch zoeken",
          style: {
            background: pdfIndexing ? "rgba(138,198,242,0.1)" : "rgba(255,255,255,0.07)",
            border: `1px solid ${W.blue}`,
            color: W.blue,
            borderRadius:"6px", padding:"4px 12px",
            fontSize:"12px", fontWeight:"600",
            cursor: pdfIndexing ? "wait" : "pointer",
            opacity: pdfIndexing ? 0.7 : 1,
          }
        }, pdfIndexing ? `⏳ ${pdfIndexPct}%` : "↻ PDF's indexeren"),
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
      results.length === 0 && pdfResults.length === 0 && !searching && query && !error &&
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
      results.length === 0 && pdfResults.length === 0 && !query &&
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
              borderRadius:"8px",fontSize:"12px",color:W.yellow
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
          const color = pct > 80 ? "#72b660"
            : pct > 60 ? (W.blue)
            : (W.fgMuted);
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
              background:(()=>{ try { const h=color.replace("#",""); const [r,g,b]=h.match(/../g).map(x=>parseInt(x,16)); return `rgba(${r},${g},${b},0.12)`; } catch { return "rgba(128,128,128,0.12)"; } })(),
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
      ),

      // PDF-resultatenlijst — apart blok, want andere brontype (bestand+pagina
      // i.p.v. notitie), maar visueel in dezelfde stijl
      pdfResults.length > 0 && React.createElement("div",{style:{
        display:"flex",flexDirection:"column",gap:"2px",
        marginTop: results.length > 0 ? "18px" : "0"
      }},
        React.createElement("div",{style:{
          fontSize:"12px",color:W.fgMuted,marginBottom:"10px"
        }},
          `${pdfResults.length} PDF-resultaten gevonden voor "${query}"`),
        pdfResults.map((hit, i) => {
          const pct   = Math.round(hit.score * 100);
          const color = pct > 80 ? "#72b660"
            : pct > 60 ? (W.blue)
            : (W.fgMuted);

          return React.createElement("div",{
            key: hit.key,
            onClick: () => onOpenPdf?.(hit.file, hit.page),
            style:{
              display:"flex",alignItems:"flex-start",gap:"12px",
              padding:"10px 14px",borderRadius:"8px",
              background:"transparent",
              border:"1px solid transparent",
              cursor: onOpenPdf ? "pointer" : "default",
              transition:"background .1s",
            },
            onMouseEnter: e => e.currentTarget.style.background = W.bg2,
            onMouseLeave: e => e.currentTarget.style.background = "transparent",
          },
            // Similarity score
            React.createElement("div",{style:{
              width:"42px",height:"42px",borderRadius:"50%",flexShrink:0,
              background:(()=>{ try { const h=color.replace("#",""); const [r,g,b]=h.match(/../g).map(x=>parseInt(x,16)); return `rgba(${r},${g},${b},0.12)`; } catch { return "rgba(128,128,128,0.12)"; } })(),
              border:`2px solid ${color}`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:"11px",fontWeight:"700",color
            }}, `${pct}%`),
            // PDF info
            React.createElement("div",{style:{flex:1,minWidth:0}},
              React.createElement("div",{style:{
                fontSize:"14px",color:W.fg,fontWeight:"600",
                display:"flex",alignItems:"center",gap:"6px",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"
              }},
                React.createElement("span",{style:{flexShrink:0}},"📄"),
                React.createElement("span",{style:{overflow:"hidden",textOverflow:"ellipsis"}},
                  hit.file || "(onbekend bestand)"),
                React.createElement("span",{style:{color:W.fgMuted,fontWeight:"400",flexShrink:0}},
                  `— p.${hit.page}`)
              ),
              React.createElement("div",{style:{
                fontSize:"12px",color:W.fgMuted,marginTop:"3px",
                overflow:"hidden",display:"-webkit-box",
                WebkitLineClamp:"2",WebkitBoxOrient:"vertical"
              }}, hit.excerpt || "")
            )
          );
        })
      )
    )
  );
};
