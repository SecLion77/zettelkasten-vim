// ── WebImporter ────────────────────────────────────────────────────────────────
// Import-tab met twee modi:
//   "url"  — Instapaper-stijl webpagina → Zettelkasten-notitie
//   "mail" — Thunderbird Gmail INBOX → URL-import flow
//
// Props:
//   llmModel          string
//   allTags           string[]
//   onAddNote(note)   async fn
//   onRefreshImages() fn
//   addJob(job)       fn
//   updateJob(id,upd) fn
//   importPreview     object | null   (vanuit jobs-panel)
//   setImportPreview  fn

const WebImporter = ({llmModel, allTags, onAddNote, onRefreshImages, onRefreshPdfs, onDescribeImages, addJob, updateJob,
                      importPreview, setImportPreview, notes=[]}) => {
  const { useState, useRef, useCallback, useEffect } = React;

  // ── Alle state bovenaan (hooks volgorde mag niet variëren) ────────────────
  const [importMode,     setImportMode]     = useState("url");

  // URL-import
  const [url,            setUrl]            = useState("");
  const [busy,           setBusy]           = useState(false);
  const [importing,      setImporting]      = useState(false);
  const [error,          setError]          = useState(null);
  const [editMd,         setEditMd]         = useState("");
  const [editTitle,      setEditTitle]      = useState("");
  const [editSummary,    setEditSummary]    = useState("");
  const [tags,           setTags]           = useState([]);
  const [saved,          setSaved]          = useState(false);
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [aiTagsLoading,  setAiTagsLoading]  = useState(false);
  const [suggestedType,  setSuggestedType]  = useState(null);  // AI-suggestie voor notitietype
  const [selectedType,   setSelectedType]   = useState("");    // gekozen notitietype
  const [dupNote,        setDupNote]        = useState(null);
  const urlRef      = useRef(null);
  const prevPreview = useRef(importPreview);

  // Markdown-import state
  const [mdFile,         setMdFile]         = useState(null);
  const [mdContent,      setMdContent]      = useState("");
  const [mdTitle,        setMdTitle]        = useState("");
  const [mdTags,         setMdTags]         = useState([]);
  const [mdSaved,        setMdSaved]        = useState(false);
  const [mdError,        setMdError]        = useState(null);
  const mdInputRef = useRef(null);

  // Word-import state (hergebruikt URL-preview flow)
  const [docxBusy,       setDocxBusy]       = useState(false);
  const [docxError,      setDocxError]      = useState(null);
  const [docxPreview,    setDocxPreview]    = useState(null); // eigen state, niet gedeeld met URL
  const [docxTitle,      setDocxTitle]      = useState("");
  const [docxSummary,    setDocxSummary]    = useState("");
  const [docxMd,         setDocxMd]         = useState("");
  const [docxTags,       setDocxTags]       = useState([]);
  const [docxSaved,      setDocxSaved]      = useState(false);
  const [docxStatus,     setDocxStatus]     = useState(""); // voortgangsmelding
  const docxInputRef = useRef(null);

  // ── PPTX state ────────────────────────────────────────────────────────────
  const [pptxBusy,       setPptxBusy]       = useState(false);
  const [pptxError,      setPptxError]      = useState(null);
  const [pptxData,       setPptxData]       = useState(null);
  const [pptxSlides,     setPptxSlides]     = useState([]);
  const [pptxImportMode, setPptxImportMode] = useState("hybrid");
  const [pptxSaved,      setPptxSaved]      = useState(false);
  const [pptxTags,       setPptxTags]       = useState([]);
  const [pptxType,       setPptxType]       = useState("literature");
  const [pptxTagsLoading, setPptxTagsLoading] = useState(false);
  const [pptxTypeLoading, setPptxTypeLoading] = useState(false);
  const [pptxSuggestedType, setPptxSuggestedType] = useState(null);
  const [pptxIncludeImages, setPptxIncludeImages] = useState(true);
  const pptxInputRef = useRef(null);

  const resetPptx = () => {
    setPptxBusy(false); setPptxError(null); setPptxData(null);
    setPptxSlides([]); setPptxSaved(false); setPptxTags([]); setPptxType("literature");
    setPptxTagsLoading(false); setPptxTypeLoading(false);
    setPptxSuggestedType(null); setPptxIncludeImages(true);
  };

  const resetDocx = () => {
    setDocxPreview(null); setDocxTitle(""); setDocxSummary("");
    setDocxMd(""); setDocxTags([]); setDocxSaved(false);
    setDocxError(null); setDocxStatus("");
  };

  // ── Duplicate-check helper ─────────────────────────────────────────────────
  const findDuplicateUrl = useCallback((checkUrl) => {
    if (!checkUrl) return null;
    // Normaliseer: verwijder trailing slash en tracking-parameters
    const norm = u => {
      try {
        const p = new URL(u);
        ["utm_source","utm_medium","utm_campaign","utm_term","utm_content",
         "fbclid","gclid","ref","source","si"].forEach(k => p.searchParams.delete(k));
        return p.origin + p.pathname.replace(/\/$/,"") + (p.search||"");
      } catch { return u.replace(/\/$/,""); }
    };
    const target = norm(checkUrl);
    return notes.find(n => {
      // Check 1: sourceUrl frontmatter-veld (nieuwste notities)
      if (n.sourceUrl && norm(n.sourceUrl) === target) return true;
      // Check 2: bron-link aan het einde van de content (oudere notities)
      if (n.content) {
        const matches = [...n.content.matchAll(/\]\((https?:\/\/[^)]+)\)/g)];
        if (matches.some(m => norm(m[1]) === target)) return true;
      }
      return false;
    }) || null;
  }, [notes]);


  // ── Saniteer tekst: verwijder CSS-rommel die modellen soms toevoegen ────────
  const sanitizeText = (text) => {
    if (!text) return "";
    return text
      // CSS-rommel (inline stijlen van lokale modellen)
      .replace(/#?[0-9a-fA-F]{0,8};?(?:[\w-]+:[^;">\n]{1,60};?){1,10}"?>/g, "")
      // HTML tags die overblijven na CSS-strip
      .replace(/<[^>]{0,300}>/g, "")
      // ===SAMENVATTING=== / ===ARTIKEL=== markers
      .replace(/={2,}\s*(?:SAMENVATTING|ARTIKEL|SUMMARY|ARTICLE)\s*={2,}/gi, "")
      // Losse label-regels: "📋 SAMENVATTING" of "ARTIKEL" op eigen regel
      .replace(/^[📋🗒️✍️\s]*(?:SAMENVATTING|SUMMARY|ARTIKEL|ARTICLE)\s*$/gim, "")
      // Overtollige emoji aan het begin van de tekst
      .replace(/^[📋🗒️✍️]\s*/m, "")
      // Lege koppen (# alleen op een regel)
      .replace(/^#+\s*$/gm, "")
      // Max 2 lege regels
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  // ── initFromPreview helper ─────────────────────────────────────────────────
  const initFromPreview = (p) => {
    if (!p) return { md: "", title: "", summary: "", tags: [] };
    let domain = "";
    try { domain = new URL(p.url).hostname.replace("www.","").split(".")[0]; } catch {}
    return {
      md:      p.markdown||"",
      title:   p.title||"",
      summary: p.summary||"",
      tags:    ["import", domain].filter(Boolean),
    };
  };

  // Sync wanneer importPreview van buiten wijzigt
  useEffect(() => {
    if (importPreview === prevPreview.current) return;
    prevPreview.current = importPreview;
    if (!importPreview) return;
    const {md, title, summary, tags: newTags} = initFromPreview(importPreview);
    setEditMd(sanitizeText(md)); setEditTitle(title); setEditSummary(sanitizeText(summary)); setTags(newTags);
    setSaved(false); setImporting(false);

    // Automatische tag-suggestie direct na import
    if (llmModel && (md || summary)) {
      setAiTagsLoading(true);
      setSuggestedType(null); setSelectedType("");
      const textForTags = (summary + " " + md).slice(0, 4000);

      // Tag-suggestie
      _aiTagSuggest(textForTags, newTags, allTags, llmModel)
        .then(suggested => {
          if (suggested.length > 0) setTags(prev => [...new Set([...prev, ...suggested])]);
        })
        .catch(() => {})
        .finally(() => setAiTagsLoading(false));

      // Notitietype-suggestie (parallel)
      fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: llmModel,
          messages: [{ role: "user", content:
            `Analyseer deze tekst en bepaal het beste notitietype voor een Zettelkasten.\n\n` +
            `Kies precies één van de volgende opties en geef ALLEEN dat woord terug:\n` +
            `- fleeting  (vluchtige gedachte, idee, nog te verwerken)\n` +
            `- literature  (brongebonden, samenvatting van artikel/boek/video)\n` +
            `- permanent  (eigen inzicht, atomair, zelfstandig begrijpelijk)\n` +
            `- index  (structuurnotitie, overzicht van andere notities)\n\n` +
            `Tekst (eerste 800 tekens):\n${textForTags.slice(0, 800)}`
          }],
          system: "Geef ALLEEN één woord terug: fleeting, literature, permanent, of index. Geen uitleg."
        }),
      })
        .then(r => r.json())
        .then(d => {
          const raw = (d.content || d.response || "").trim().toLowerCase();
          const valid = ["fleeting", "literature", "permanent", "index"];
          const match = valid.find(v => raw.includes(v));
          if (match) { setSuggestedType(match); setSelectedType(match); }
        })
        .catch(() => {});
    }
  }, [importPreview]);





  const doImport = useCallback((force=false) => {
    const u = url.trim();
    if (!u) return;

    // Client-side duplicate check (snel, op basis van al geladen notities)
    if (!force) {
      const dup = findDuplicateUrl(u);
      if (dup) {
        setDupNote(dup);
        setError(null);
        setBusy(false);
        setImporting(false);
        return;
      }
    }
    setDupNote(null);

    setBusy(true); setError(null); setImporting(true);
    setImportPreview(null); setSaved(false);
    setTimeout(() => setBusy(false), 400);
    const jid = genId();
    const shortUrl = u.replace(/^https?:\/\//,"").slice(0,38);
    addJob && addJob({id:jid, type:"import", label:"🌐 Importeren: "+shortUrl+"…"});
    (async () => {
      try {
        const res = await api.importUrl({url: u, model: llmModel||"llama3.2-vision", force});
        if (res?.duplicate) {
          // Server meldt duplicate — toon waarschuwing met "Toch importeren" optie
          setDupNote({ id: res.duplicate_id, title: res.duplicate_title });
          setImporting(false);
          updateJob && updateJob(jid,{status:"done", result:"Al aanwezig"});
        } else if (res?.ok) {
          setImportPreview(res);
          if (res.images?.length && onRefreshImages) {
            onRefreshImages();
            // Beschrijving pas na opslaan — niet automatisch hier
          }
          // Sla alleen veilige scalaire velden op in job (geen circulaire refs)
          const safeResult = {
            title: res.title||"", url: res.url||"",
            summary: res.summary||"", markdown: res.markdown||"",
            images: (res.images||[]).map(i => ({name: i.name, url: i.url})),
          };
          updateJob && updateJob(jid,{status:"done", result: res.title?.slice(0,44)||"Klaar", importResult: safeResult});
        } else {
          const msg = res?.error || "Import mislukt";
          setError(msg); setImporting(false);
          updateJob && updateJob(jid,{status:"error", error:msg});
        }
      } catch(e) {
        setError(e.message); setImporting(false);
        updateJob && updateJob(jid,{status:"error", error:e.message});
      }
    })();
  }, [url, llmModel, onRefreshImages, addJob, updateJob, findDuplicateUrl]);

  const saveNote = useCallback(async () => {
    if (!importPreview) return;
    // Bouw content op: samenvatting bovenaan als callout, dan originele tekst
    let content = "";
    if (editSummary.trim()) {
      const cleanSummary = sanitizeText(editSummary);
      const summaryLines = cleanSummary.replace(/\n/g, "\n> ");
      content += `> [!samenvatting]\n> 📋 **Samenvatting**\n> ${summaryLines}\n\n---\n\n`;
    }
    content += sanitizeText(editMd);
    if (selectedImages.size > 0 && importPreview.images?.length) {
      const pickedLinks = importPreview.images
        .filter(img => selectedImages.has(img.name))
        .map(img => `![[img:${img.name}]]`).join("\n\n");
      content += "\n\n" + pickedLinks;
    }
    // Bronlink: korte leesbare label (domein) in plaats van volledige URL
    let bronLabel = importPreview.url;
    try {
      const u = new URL(importPreview.url);
      bronLabel = u.hostname.replace("www.","") + (u.pathname.length > 1 ? u.pathname.slice(0,40) + (u.pathname.length > 40 ? "…" : "") : "");
    } catch {}
    content += `\n\n---\n🌐 **Bron:** [${bronLabel}](${importPreview.url})`;
    const savedNote = await onAddNote({
      id: genId(), title: editTitle, content, tags,
      noteType: selectedType || "",
      sourceUrl: importPreview.url,
      importedAt: new Date().toISOString(),
      created: new Date().toISOString(), modified: new Date().toISOString(),
    });
    // Beschrijf alleen de geselecteerde afbeeldingen, pas na opslaan
    // Geef ook het id van de import-notitie mee zodat de link terug kan worden toegevoegd
    if (selectedImages.size > 0 && onDescribeImages) {
      onDescribeImages([...selectedImages], savedNote?.id, editTitle);
    }
    setSaved(true);
    // Na 1.5s automatisch terug naar het invoerscherm
    setTimeout(() => reset(), 1500);
  }, [importPreview, editTitle, editMd, editSummary, tags, selectedImages, onAddNote]);

  const reset = () => {
    setUrl(""); setImportPreview(null);
    setEditMd(""); setEditTitle(""); setEditSummary("");
    setTags([]); setError(null); setSaved(false); setImporting(false);
    setSelectedImages(new Set()); setDupNote(null);
    setSuggestedType(null); setSelectedType("");
    setTimeout(()=>urlRef.current?.focus(), 50);
  };

  // ── Notitietype metadata ────────────────────────────────────────────────────
  const TYPE_META = {
    fleeting:   { label: "Vluchtig",    color: "#e8a44a", desc: "Snelle capture — verwerk binnen 1-2 dagen" },
    literature: { label: "Literatuur",  color: W.blue,    desc: "Brongebonden — samenvatting van bron" },
    permanent:  { label: "Permanent",   color: W.comment, desc: "Eigen inzicht — atomair, zelfstandig" },
    index:      { label: "Index",       color: W.purple,  desc: "Structuurnotitie — navigatie" },
  };

  const PPTX_TYPE_META = {
    fleeting:   { label: "Vluchtig",   color: "#e8a44a", desc: "Snelle capture" },
    literature: { label: "Literatuur", color: W.blue,    desc: "Brongebonden" },
    permanent:  { label: "Permanent",  color: W.comment, desc: "Eigen inzicht" },
    index:      { label: "Index",      color: W.purple,  desc: "Structuurnotitie" },
  };
  // ── Tab-knop helper ────────────────────────────────────────────────────────
  const tabBtn = (id, icon, label) => React.createElement("button", {
    key: id, onClick: () => setImportMode(id),
    style: {
      background: "none",
      border: "none",
      borderBottom: importMode===id ? `2px solid ${W.yellow}` : "2px solid transparent",
      color: importMode===id ? W.statusFg : W.fgMuted,
      padding: "0 18px", height: "100%", fontSize: "14px",
      cursor: "pointer", letterSpacing: "0.4px",
      display:"flex", alignItems:"center", gap:"6px", flexShrink:0,
    }
  }, icon, " ", label);

  // ── Render ─────────────────────────────────────────────────────────────────
  return React.createElement("div", {
    style:{display:"flex", flexDirection:"column", flex:1, minHeight:0, overflow:"hidden"}
  },

    // Tab-bar
    React.createElement("div", {style:{
      background:W.statusBg, borderBottom:`1px solid ${W.splitBg}`,
      display:"flex", alignItems:"center", flexShrink:0, height:"44px", gap:0,
    }},
      tabBtn("url",  "🌐", "URL"),
      tabBtn("md",   "📝", "Markdown"),
      tabBtn("docx", "📄", "Word"),
      tabBtn("pptx", "📊", "PowerPoint"),
      React.createElement("div", {style:{flex:1}}),
      importMode==="url" && importPreview && !saved && React.createElement("button", {
        onClick: reset,
        style:{background:"none", border:`1px solid ${W.splitBg}`, color:W.fgMuted,
               borderRadius:"4px", padding:"4px 10px", fontSize:"14px", cursor:"pointer",
               marginRight:"12px"}
      }, "+ nieuwe import")
    ),

    // ══════════════════════════════════════════════════════════════════════════
    // Tab: URL import
    // ══════════════════════════════════════════════════════════════════════════
    importMode === "url" && React.createElement(React.Fragment, null,

      // ── Geen preview: invoerscherm ──────────────────────────────────────────
      !importPreview && React.createElement("div", {style:{
        flex:1, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:"32px 24px", gap:"20px"
      }},
        importing
          ? React.createElement(React.Fragment, null,
              React.createElement("div", {style:{fontSize:"48px",lineHeight:1,animation:"ai-pulse 1.4s ease-in-out infinite"}}, "🌐"),
              React.createElement("div", {style:{fontSize:"15px",color:W.fgDim,textAlign:"center",lineHeight:"1.7",maxWidth:"460px"}},
                "Bezig met importeren…", React.createElement("br"),
                React.createElement("span", {style:{fontSize:"14px",color:W.fgMuted}}, url.replace(/^https?:\/\//,"").slice(0,60))),
              React.createElement("div", {style:{width:"320px",height:"3px",borderRadius:"2px",background:"rgba(255,255,255,0.08)",overflow:"hidden"}},
                React.createElement("div", {style:{height:"100%",width:"35%",borderRadius:"2px",background:W.blue,animation:"progress-slide 1.4s ease-in-out infinite"}})),
              React.createElement("div", {style:{fontSize:"14px",color:W.fgMuted,textAlign:"center",maxWidth:"420px",lineHeight:"1.6"}},
                "Je kunt de app gewoon blijven gebruiken. De import verschijnt hier zodra hij klaar is."),
              React.createElement("button", {
                onClick:()=>{setImporting(false);setError(null);},
                style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,borderRadius:"6px",padding:"6px 16px",fontSize:"14px",cursor:"pointer"}
              }, "× annuleer"))
          : React.createElement(React.Fragment, null,
              React.createElement("div", {style:{fontSize:"48px",lineHeight:1}}, "🌐"),
              React.createElement("div", {style:{fontSize:"15px",color:W.fgDim,textAlign:"center",lineHeight:"1.6",maxWidth:"460px"}},
                "Plak een URL om de inhoud te importeren als Zettelkasten-notitie.", React.createElement("br"),
                React.createElement("span", {style:{fontSize:"14px",color:W.fgMuted}},
                  "De AI verwijdert navigatie, advertenties en rommel — zoals Instapaper.")),
              React.createElement("div", {style:{display:"flex",gap:"10px",width:"100%",maxWidth:"560px"}},
                React.createElement("input", {
                  ref:urlRef, type:"url", value:url, autoFocus:true,
                  onChange:e=>setUrl(e.target.value),
                  onKeyDown:e=>{ if(e.key==="Enter") doImport(); },
                  placeholder:"https://example.com/artikel",
                  style:{flex:1,background:W.bg2,border:`1px solid ${W.splitBg}`,borderRadius:"6px",
                         padding:"10px 14px",color:W.fg,fontSize:"14px",outline:"none",
                         boxShadow:url?`0 0 0 2px rgba(138,198,242,0.25)`:"none"}
                }),
                React.createElement("button", {
                  onClick:doImport, disabled:busy||!url.trim(),
                  style:{background:W.blue,color:W.bg,border:"none",borderRadius:"6px",
                         padding:"10px 22px",fontSize:"14px",fontWeight:"bold",cursor:"pointer",
                         opacity:busy||!url.trim()?0.5:1,whiteSpace:"nowrap"}
                }, "→ Importeren")),
              error && React.createElement("div", {style:{color:W.orange,fontSize:"14px",
                background:"rgba(229,120,109,0.08)",border:`1px solid rgba(229,120,109,0.25)`,
                borderRadius:"6px",padding:"10px 16px",maxWidth:"560px",width:"100%"}},
                "⚠ "+error),

              // Duplicate-melding
              dupNote && React.createElement("div", {style:{
                maxWidth:"560px", width:"100%",
                background:"rgba(234,231,136,0.07)",
                border:"1px solid rgba(234,231,136,0.3)",
                borderRadius:"6px", padding:"12px 16px",
                display:"flex", flexDirection:"column", gap:"8px",
              }},
                React.createElement("div", {style:{fontSize:"14px",color:W.yellow,fontWeight:"600"}},
                  "⚠ Al geïmporteerd"),
                React.createElement("div", {style:{fontSize:"13px",color:W.fgMuted}},
                  "Deze URL staat al in notitie: ",
                  React.createElement("strong", {style:{color:W.fg}}, dupNote.title||dupNote.id)
                ),
                React.createElement("div", {style:{display:"flex",gap:"8px",flexWrap:"wrap"}},
                  React.createElement("button", {
                    onClick: () => { setDupNote(null); doImport(true); },
                    style:{background:"rgba(234,231,136,0.12)",border:"1px solid rgba(234,231,136,0.3)",
                           color:W.yellow,borderRadius:"5px",padding:"5px 14px",
                           fontSize:"13px",cursor:"pointer"}
                  }, "↺ Toch opnieuw importeren"),
                  React.createElement("button", {
                    onClick: () => setDupNote(null),
                    style:{background:"none",border:`1px solid ${W.splitBg}`,
                           color:W.fgMuted,borderRadius:"5px",padding:"5px 12px",
                           fontSize:"13px",cursor:"pointer"}
                  }, "Annuleren")
                )
              ))
      ),

      // ── Preview na succesvolle import ───────────────────────────────────────
      importPreview && React.createElement("div", {style:{
        flex:1, display:"flex", flexDirection:"column", overflow:"hidden",
      }},

        // ── Actiebalk ────────────────────────────────────────────────────────
        React.createElement("div", {style:{
          padding:"8px 14px", background:W.bg2,
          borderBottom:`1px solid ${W.splitBg}`,
          display:"flex", alignItems:"center", gap:"8px",
          flexShrink:0, flexWrap:"wrap",
        }},
          saved
            ? React.createElement(React.Fragment, null,
                React.createElement("span", {style:{color:W.comment,fontWeight:"600",fontSize:"14px"}},
                  "✓ Notitie opgeslagen"),
                React.createElement("button", {
                  onClick: reset,
                  style:{background:"rgba(138,198,242,0.12)",border:`1px solid ${W.blue}`,
                         color:W.blue,borderRadius:"5px",padding:"5px 14px",
                         fontSize:"13px",cursor:"pointer",fontWeight:"600"}
                }, "+ Nieuwe import"))
            : React.createElement(React.Fragment, null,
                // Titel
                React.createElement("input", {
                  value: editTitle,
                  onChange: e => setEditTitle(e.target.value),
                  placeholder: "Titel…",
                  style:{flex:1,minWidth:"180px",background:W.bg3,
                         border:`1px solid ${W.splitBg}`,borderRadius:"5px",
                         color:W.statusFg,padding:"5px 10px",
                         fontSize:"14px",fontWeight:"600",outline:"none",
                         boxSizing:"border-box"}
                }),
                React.createElement("button", {
                  onClick: saveNote,
                  style:{background:W.comment,color:W.bg,border:"none",
                         borderRadius:"5px",padding:"6px 18px",fontSize:"13px",
                         cursor:"pointer",fontWeight:"700",whiteSpace:"nowrap",flexShrink:0}
                }, "✓ Opslaan"),
                React.createElement("button", {
                  onClick: reset,
                  style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                         borderRadius:"5px",padding:"6px 10px",fontSize:"13px",
                         cursor:"pointer",flexShrink:0}
                }, "✕")
              )
        ),

        // ── Scrollbaar inhoudspaneel ─────────────────────────────────────────
        React.createElement("div", {style:{
          flex:1, overflowY:"auto", padding:"16px 20px",
          display:"flex", flexDirection:"column", gap:"14px", minHeight:0, WebkitOverflowScrolling:"touch",}},

          // ── Notitietype ─────────────────────────────────────────────────────
          !saved && React.createElement("div", {style:{
            background:W.bg2, border:`1px solid ${W.splitBg}`,
            borderRadius:"7px", padding:"10px 14px",
          }},
            React.createElement("div", {style:{
              fontSize:"11px", color:"rgba(138,198,242,0.6)",
              letterSpacing:"1.2px", marginBottom:"8px", fontWeight:"600",
              display:"flex", alignItems:"center", gap:"8px",
            }},
              "NOTITIETYPE",
              suggestedType && React.createElement("span", {style:{
                fontSize:"10px", color:W.yellow, fontWeight:"400",
                letterSpacing:0, animation:"none",
                background:"rgba(234,231,136,0.1)", borderRadius:"3px", padding:"1px 6px"
              }}, `✦ AI suggereert: ${TYPE_META[suggestedType]?.label}`)
            ),
            React.createElement("div", {style:{ display:"flex", gap:"5px", flexWrap:"wrap" }},
              // Geen type optie
              React.createElement("button", {
                onClick: () => setSelectedType(""),
                style: {
                  padding:"5px 10px", fontSize:"11px", borderRadius:"5px",
                  cursor:"pointer", transition:"all .1s",
                  background: selectedType === "" ? "rgba(152,144,135,0.2)" : "transparent",
                  border: `1px solid ${selectedType === "" ? "#857b6f" : W.splitBg}`,
                  color: selectedType === "" ? W.fgMuted : W.fgMuted,
                }
              }, "—  geen"),
              // Type knoppen
              Object.entries(TYPE_META).map(([id, {label, color, desc}]) => {
                const isSelected = selectedType === id;
                const isSuggested = suggestedType === id;
                return React.createElement("button", {
                  key: id,
                  onClick: () => setSelectedType(isSelected ? "" : id),
                  title: desc,
                  style: {
                    padding:"5px 10px", fontSize:"11px", borderRadius:"5px",
                    cursor:"pointer", transition:"all .1s",
                    background: isSelected ? `${color}20` : "transparent",
                    border: `1px solid ${isSelected ? color : isSuggested ? color + "80" : W.splitBg}`,
                    color: isSelected ? color : isSuggested ? color : W.fgMuted,
                    fontWeight: isSelected ? "600" : "400",
                    display:"flex", alignItems:"center", gap:"5px",
                    position:"relative",
                  }
                },
                  React.createElement("div", {style:{
                    width:"7px", height:"7px", borderRadius:"50%",
                    background: color, flexShrink:0, opacity: isSelected ? 1 : 0.5,
                  }}),
                  label,
                  isSuggested && !isSelected && React.createElement("span", {
                    style:{ fontSize:"8px", color:W.yellow, marginLeft:"1px" }
                  }, "✦")
                );
              })
            )
          ),

          // ── Tags (SmartTagEditor) ───────────────────────────────────────────
          !saved && React.createElement("div", {style:{
            background:W.bg2, border:`1px solid ${W.splitBg}`,
            borderRadius:"7px", padding:"10px 14px",
          }},
            React.createElement("div", {style:{
              fontSize:"11px",color:"rgba(138,198,242,0.6)",
              letterSpacing:"1.2px",marginBottom:"6px",fontWeight:"600",
              display:"flex", alignItems:"center", gap:"8px",
            }},
              "TAGS",
              aiTagsLoading && React.createElement("span", {style:{
                fontSize:"11px", color:W.yellow, fontWeight:"400",
                letterSpacing:0, animation:"ai-pulse 1.4s ease-in-out infinite"
              }}, "✦ tags worden gesuggereerd…")
            ),
            React.createElement(SmartTagEditor, {
              tags,
              onChange: setTags,
              allTags,
              content: (editSummary + " " + editMd).slice(0, 4000),
              llmModel,
            })
          ),

          // ── Slimme links ─────────────────────────────────────────────────
          !saved && React.createElement("div", {style:{
            background:W.bg2, border:`1px solid ${W.splitBg}`,
            borderRadius:"7px", padding:"10px 14px",
          }},
            React.createElement("div", {style:{
              fontSize:"11px",color:"rgba(159,202,86,0.7)",
              letterSpacing:"1.2px",marginBottom:"8px",fontWeight:"600",
            }}, "🔗 SLIMME LINKS"),
            React.createElement(SmartLinkSuggester, {
              content:      (editSummary + "\n\n" + editMd).slice(0, 6000),
              noteId:       "",   // nieuw — geen bestaande notitie
              allNotes:     notes || [],
              llmModel,
              onInsertLink: (linkText) => {
                // Voeg link toe aan het einde van editMd
                setEditMd(prev => prev + "\n\n" + linkText);
              },
              compact:  false,
              autoLoad: true,   // laad direct bij tonen
            })
          ),

          // ── Samenvatting ────────────────────────────────────────────────────
          React.createElement("div", {style:{
            background:"rgba(138,198,242,0.06)",
            border:`1px solid rgba(138,198,242,0.2)`,
            borderLeft:`3px solid ${W.blue}`,
            borderRadius:"6px", padding:"12px 16px",
          }},
            React.createElement("div", {style:{
              fontSize:"11px",color:W.blue,letterSpacing:"1.2px",
              fontWeight:"600",marginBottom:"8px",
              display:"flex",alignItems:"center",gap:"6px",
            }},
              "📋 SAMENVATTING",
              React.createElement("span",{style:{
                fontSize:"10px",color:W.fgMuted,fontWeight:"400",
                letterSpacing:"0",marginLeft:"4px"
              }},"— wordt als callout bovenaan de notitie geplaatst")
            ),
            React.createElement("textarea",{
              value: editSummary,
              onChange: e => setEditSummary(e.target.value),
              placeholder: "Geen samenvatting gegenereerd — typ hier zelf een samenvatting, of controleer of het AI-model is ingesteld.",
              rows: Math.max(3, (editSummary||"").split("\n").length + 1),
              style:{
                width:"100%", background:"transparent",
                border:"none", outline:"none",
                color: editSummary ? W.fg : W.fgMuted,
                fontSize:"14px", lineHeight:"1.75",
                resize:"vertical", fontFamily:"inherit",
                boxSizing:"border-box",
                fontStyle: editSummary ? "normal" : "italic",
              }
            })
          ),

          // ── Afbeeldingen selectie ───────────────────────────────────────────
          importPreview.images?.length > 0 && !saved &&
            React.createElement("div", {style:{
              background:W.bg2, border:`1px solid ${W.splitBg}`,
              borderRadius:"7px", padding:"10px 14px",
            }},
              React.createElement("div", {style:{
                fontSize:"11px",color:"rgba(159,202,86,0.7)",
                letterSpacing:"1.2px",marginBottom:"8px",fontWeight:"600",
                display:"flex",alignItems:"center",gap:"8px",
              }},
                "AFBEELDINGEN",
                React.createElement("span",{style:{color:W.fgDim,fontWeight:"400",letterSpacing:0}},
                  `${selectedImages.size} van ${importPreview.images.length} geselecteerd`)
              ),
              React.createElement("div", {style:{
                display:"flex", flexWrap:"wrap", gap:"8px",
              }},
                ...importPreview.images.map(img => {
                  const sel = selectedImages.has(img.name);
                  return React.createElement("div", {
                    key: img.name,
                    onClick: () => setSelectedImages(prev => {
                      const n = new Set(prev);
                      sel ? n.delete(img.name) : n.add(img.name);
                      return n;
                    }),
                    style:{
                      position:"relative", cursor:"pointer",
                      border:`2px solid ${sel ? W.comment : "rgba(255,255,255,0.1)"}`,
                      borderRadius:"5px", overflow:"hidden",
                      width:"90px", height:"65px", flexShrink:0,
                      background:W.bg3,
                    }
                  },
                    React.createElement("img", {
                      src: img.url, alt: img.name,
                      style:{width:"100%",height:"100%",objectFit:"cover",display:"block"}
                    }),
                    sel && React.createElement("div", {style:{
                      position:"absolute",top:"3px",right:"3px",
                      background:W.comment,color:W.bg,
                      borderRadius:"50%",width:"18px",height:"18px",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      fontSize:"11px",fontWeight:"bold",
                    }}, "✓")
                  );
                })
              )
            ),

          // ── Scheiding ───────────────────────────────────────────────────────
          React.createElement("div", {style:{
            display:"flex", alignItems:"center", gap:"10px",
          }},
            React.createElement("div", {style:{
              flex:1, height:"1px", background:`rgba(255,255,255,0.08)`
            }}),
            React.createElement("span", {style:{
              fontSize:"11px", color:W.fgDim, letterSpacing:"1.5px",
            }}, "ORIGINELE TEKST"),
            React.createElement("div", {style:{
              flex:1, height:"1px", background:`rgba(255,255,255,0.08)`
            }})
          ),

          // ── Originele tekst als Markdown ────────────────────────────────────
          React.createElement("div", {style:{
            background:W.bg2, border:`1px solid ${W.splitBg}`,
            borderRadius:"6px", padding:"16px 18px",
            fontSize:"13px", color:W.fg, lineHeight:"1.8",
            whiteSpace:"pre-wrap",
            fontFamily:"'Courier New', monospace",
          }}, editMd || "(geen tekst geïmporteerd)"),

          // Bron-link
          React.createElement("div", {style:{
            fontSize:"12px", color:W.fgDim,
            display:"flex", alignItems:"center", gap:"6px",
          }},
            React.createElement("span", null, "🌐"),
            React.createElement("a", {
              href: importPreview.url, target:"_blank", rel:"noopener",
              style:{color:W.blue, overflow:"hidden",
                     textOverflow:"ellipsis", whiteSpace:"nowrap"}
            }, importPreview.url)
          )
        )
      )
    ),
    // ══════════════════════════════════════════════════════════════════════════
    // Tab: Markdown import
    // ══════════════════════════════════════════════════════════════════════════
    importMode === "md" && React.createElement("div", {style:{
      flex:1, display:"flex", flexDirection:"column", overflow:"hidden"
    }},

      // ── Nog geen bestand geladen ──────────────────────────────────────────
      !mdContent && React.createElement("div", {style:{
        flex:1, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:"32px 24px", gap:"20px"
      }},
        React.createElement("div", {style:{fontSize:"48px",lineHeight:1}}, "📝"),
        React.createElement("div", {style:{fontSize:"15px",color:W.fgDim,textAlign:"center",
          lineHeight:"1.6",maxWidth:"460px"}},
          "Importeer een Markdown-bestand als Zettelkasten-notitie.", React.createElement("br"),
          React.createElement("span", {style:{fontSize:"14px",color:W.fgMuted}},
            "Het bestand wordt direct als notitie opgeslagen — je kiest eerst de tags.")
        ),
        React.createElement("input", {
          ref: mdInputRef, type:"file", accept:".md,.markdown,.txt",
          style:{display:"none"},
          onChange: e => {
            const file = e.target.files[0];
            if (!file) return;
            setMdError(null); setMdSaved(false); setMdTags([]);
            setMdTitle(file.name.replace(/\.(md|markdown|txt)$/i,""));
            const reader = new FileReader();
            reader.onload = ev => setMdContent(ev.target.result || "");
            reader.readAsText(file, "utf-8");
          }
        }),
        React.createElement("button", {
          onClick: () => mdInputRef.current?.click(),
          style:{background:W.blue,color:W.bg,border:"none",borderRadius:"6px",
                 padding:"10px 28px",fontSize:"15px",fontWeight:"bold",cursor:"pointer"}
        }, "📂 Kies Markdown-bestand"),
        mdError && React.createElement("div", {style:{color:W.orange,fontSize:"14px"}}, "⚠ "+mdError)
      ),

      // ── Bestand geladen: tags + preview ──────────────────────────────────
      mdContent && !mdSaved && React.createElement(React.Fragment, null,
        // Actiebalk
        React.createElement("div", {style:{
          padding:"8px 14px", background:W.bg2,
          borderBottom:`1px solid ${W.splitBg}`,
          display:"flex", alignItems:"center", gap:"8px",
          flexShrink:0, flexWrap:"wrap",
        }},
          React.createElement("input", {
            value: mdTitle,
            onChange: e => setMdTitle(e.target.value),
            placeholder:"Titel…",
            style:{flex:1,minWidth:"180px",background:W.bg3,
                   border:`1px solid ${W.splitBg}`,borderRadius:"5px",
                   color:W.statusFg,padding:"5px 10px",
                   fontSize:"14px",fontWeight:"600",outline:"none",boxSizing:"border-box"}
          }),
          React.createElement("button", {
            onClick: async () => {
              if (!mdTitle.trim()) { setMdError("Geef een titel op"); return; }
              const note = {
                id: "note_" + Date.now() + "_" + Math.random().toString(36).slice(2,7),
                title: mdTitle.trim(),
                content: mdContent,
                tags: mdTags,
                created: new Date().toISOString(),
                modified: new Date().toISOString(),
              };
              await onAddNote(note);
              setMdSaved(true);
            },
            style:{background:W.comment,color:W.bg,border:"none",borderRadius:"5px",
                   padding:"6px 18px",fontSize:"13px",cursor:"pointer",
                   fontWeight:"700",whiteSpace:"nowrap",flexShrink:0}
          }, "✓ Opslaan als notitie"),
          React.createElement("button", {
            onClick: () => { setMdContent(""); setMdTitle(""); setMdTags([]); setMdError(null); },
            style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                   borderRadius:"5px",padding:"6px 10px",fontSize:"13px",cursor:"pointer",flexShrink:0}
          }, "✕")
        ),

        // Tags + preview
        React.createElement("div", {style:{flex:1,overflowY:"auto",padding:"16px 20px",
          display:"flex",flexDirection:"column",gap:"14px", minHeight:0, WebkitOverflowScrolling:"touch",}},

          // Tags — SmartTagEditor
          React.createElement("div", {style:{
            background:W.bg2, border:`1px solid ${W.splitBg}`,
            borderRadius:"7px", padding:"10px 14px",
          }},
            React.createElement("div", {style:{
              fontSize:"11px",color:"rgba(138,198,242,0.6)",
              letterSpacing:"1.2px",marginBottom:"6px",fontWeight:"600"
            }}, "TAGS — kies tags voor deze notitie"),
            React.createElement(SmartTagEditor, {
              tags: mdTags,
              onChange: setMdTags,
              allTags,
              content: mdContent.slice(0, 1500),
              llmModel,
            })
          ),

          // Preview van de markdown-inhoud
          React.createElement("div", {style:{
            background:W.bg2, border:`1px solid ${W.splitBg}`,
            borderRadius:"6px", padding:"16px 18px",
            fontSize:"13px", color:W.fg, lineHeight:"1.8",
            whiteSpace:"pre-wrap", fontFamily:"'Courier New', monospace",
            maxHeight:"400px", overflowY:"auto",
          }}, mdContent.slice(0, 3000) + (mdContent.length > 3000 ? "\n\n…" : ""))
        )
      ),

      // ── Opgeslagen ───────────────────────────────────────────────────────
      mdSaved && React.createElement("div", {style:{
        flex:1, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center", gap:"16px"
      }},
        React.createElement("div", {style:{fontSize:"48px"}},"✓"),
        React.createElement("div", {style:{fontSize:"16px",color:W.comment,fontWeight:"600"}},
          "Notitie opgeslagen"),
        React.createElement("button", {
          onClick: () => { setMdContent(""); setMdTitle(""); setMdTags([]); setMdSaved(false); setMdError(null); },
          style:{background:"rgba(138,198,242,0.12)",border:`1px solid ${W.blue}`,
                 color:W.blue,borderRadius:"5px",padding:"8px 20px",
                 fontSize:"14px",cursor:"pointer",fontWeight:"600"}
        }, "+ Nieuw Markdown-bestand")
      )
    ),

    // ══════════════════════════════════════════════════════════════════════════
    // Tab: Word import
    // ══════════════════════════════════════════════════════════════════════════
    importMode === "docx" && React.createElement("div", {style:{
      flex:1, display:"flex", flexDirection:"column", overflow:"hidden"
    }},

      // ── Invoerscherm ───────────────────────────────────────────────────────
      !docxPreview && React.createElement("div", {style:{
        flex:1, display:"flex", flexDirection:"column",
        alignItems:"center", justifyContent:"center",
        padding:"32px 24px", gap:"20px"
      }},
        // Verborgen file-input
        React.createElement("input", {
          ref: docxInputRef, type:"file", accept:".docx,.doc",
          style:{display:"none"},
          onChange: async e => {
            const file = e.target.files[0];
            if (!file) return;
            resetDocx();
            setDocxBusy(true);
            setDocxStatus("📄 Word-document converteren naar Markdown…");
            try {
              const fd = new FormData();
              fd.append("file", file, file.name);
              const resp = await fetch(
                `/api/import-docx?model=${encodeURIComponent(llmModel)}`,
                { method:"POST", body:fd }
              );
              if (!resp.ok) throw new Error(`Server fout: ${resp.status}`);
              const data = await resp.json();
              if (!data.ok) throw new Error(data.error || "Conversie mislukt");

              setDocxMd(data.md || "");
              setDocxTitle(data.title || file.name.replace(/\.docx?$/i,""));
              setDocxSummary(data.summary || "");
              setDocxPreview({ filename: file.name });
              setDocxStatus("");

              // Automatische tag-suggestie
              if (llmModel && data.md) {
                const textForTags = ((data.summary||"") + " " + data.md).slice(0, 4000);
                _aiTagSuggest(textForTags, [], allTags, llmModel)
                  .then(suggested => { if (suggested.length) setDocxTags(suggested); })
                  .catch(() => {});
              }
            } catch(err) {
              setDocxError(err.message);
              setDocxStatus("");
            } finally {
              setDocxBusy(false);
              e.target.value = "";
            }
          }
        }),

        docxBusy
          ? React.createElement(React.Fragment, null,
              React.createElement("div", {style:{fontSize:"48px",
                animation:"ai-pulse 1.4s ease-in-out infinite"}}, "📄"),
              React.createElement("div", {style:{fontSize:"15px",color:W.fgDim,
                textAlign:"center"}}, docxStatus || "Bezig…"),
              React.createElement("div", {style:{
                width:"280px",height:"3px",borderRadius:"2px",
                background:"rgba(255,255,255,0.08)",overflow:"hidden",marginTop:"4px"
              }},
                React.createElement("div", {style:{
                  height:"100%",width:"40%",borderRadius:"2px",
                  background:W.yellow,
                  animation:"progress-slide 1.4s ease-in-out infinite"
                }}))
            )
          : React.createElement(React.Fragment, null,
              React.createElement("div", {style:{fontSize:"48px",lineHeight:1}}, "📄"),
              React.createElement("div", {style:{fontSize:"15px",color:W.fgDim,
                textAlign:"center",lineHeight:"1.6",maxWidth:"460px"}},
                "Importeer een Word-document (.docx) als Zettelkasten-notitie.",
                React.createElement("br"),
                React.createElement("span", {style:{fontSize:"14px",color:W.fgMuted}},
                  "Het document wordt geconverteerd naar Markdown. Je kunt daarna tags kiezen en eventueel de tekst bewerken.")
              ),
              React.createElement("button", {
                onClick: () => docxInputRef.current?.click(),
                style:{background:W.yellow,color:W.bg,border:"none",borderRadius:"6px",
                       padding:"10px 28px",fontSize:"15px",fontWeight:"bold",cursor:"pointer"}
              }, "📂 Kies Word-bestand (.docx)"),
              docxError && React.createElement("div", {style:{
                color:W.orange,fontSize:"14px",maxWidth:"460px",textAlign:"center",
                background:"rgba(229,120,109,0.08)",border:"1px solid rgba(229,120,109,0.25)",
                borderRadius:"6px",padding:"10px 16px",
              }}, "⚠ "+docxError)
            )
      ),

      // ── Preview ─────────────────────────────────────────────────────────────
      docxPreview && React.createElement(React.Fragment, null,

        // Actiebalk
        React.createElement("div", {style:{
          padding:"8px 14px", background:W.bg2,
          borderBottom:`1px solid ${W.splitBg}`,
          display:"flex", alignItems:"center", gap:"8px",
          flexShrink:0, flexWrap:"wrap",
        }},
          docxSaved
            ? React.createElement(React.Fragment, null,
                React.createElement("span", {style:{color:W.comment,fontWeight:"600",
                  fontSize:"14px"}}, "✓ Notitie opgeslagen"),
                React.createElement("button", {
                  onClick: resetDocx,
                  style:{background:"rgba(138,198,242,0.12)",border:`1px solid ${W.blue}`,
                         color:W.blue,borderRadius:"5px",padding:"5px 14px",
                         fontSize:"13px",cursor:"pointer",fontWeight:"600"}
                }, "+ Nieuw Word-document")
              )
            : React.createElement(React.Fragment, null,
                React.createElement("input", {
                  value: docxTitle,
                  onChange: e => setDocxTitle(e.target.value),
                  placeholder:"Titel…",
                  style:{flex:1,minWidth:"180px",background:W.bg3,
                         border:`1px solid ${W.splitBg}`,borderRadius:"5px",
                         color:W.statusFg,padding:"5px 10px",
                         fontSize:"14px",fontWeight:"600",outline:"none",
                         boxSizing:"border-box"}
                }),
                // Samenvatting-indicator in actiebalk
                docxStatus && React.createElement("span", {style:{
                  fontSize:"13px",color:W.yellow,
                  animation:"ai-pulse 1.4s ease-in-out infinite",
                  flexShrink:0,
                }}, docxStatus),
                React.createElement("button", {
                  onClick: async () => {
                    if (!docxTitle.trim()) return;
                    const note = {
                      id: "note_"+Date.now()+"_"+Math.random().toString(36).slice(2,7),
                      title: docxTitle.trim(),
                      content: (docxSummary
                        ? `*Samenvatting:* ${docxSummary}\n\n---\n\n` : "")
                        + docxMd,
                      tags: docxTags,
                      created: new Date().toISOString(),
                      modified: new Date().toISOString(),
                    };
                    await onAddNote(note);
                    setDocxSaved(true);
                  },
                  style:{background:W.comment,color:W.bg,border:"none",borderRadius:"5px",
                         padding:"6px 18px",fontSize:"13px",cursor:"pointer",
                         fontWeight:"700",whiteSpace:"nowrap",flexShrink:0}
                }, "✓ Opslaan als notitie"),
                React.createElement("button", {
                  onClick: resetDocx,
                  style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                         borderRadius:"5px",padding:"6px 10px",fontSize:"13px",
                         cursor:"pointer",flexShrink:0}
                }, "✕")
              )
        ),

        // Scrollbaar paneel
        React.createElement("div", {style:{flex:1,overflowY:"auto",padding:"16px 20px",
          display:"flex",flexDirection:"column",gap:"14px", minHeight:0, WebkitOverflowScrolling:"touch",}},

          // Tags
          !docxSaved && React.createElement("div", {style:{
            background:W.bg2, border:`1px solid ${W.splitBg}`,
            borderRadius:"7px", padding:"10px 14px",
          }},
            React.createElement("div", {style:{fontSize:"11px",
              color:"rgba(138,198,242,0.6)",letterSpacing:"1.2px",
              marginBottom:"6px",fontWeight:"600"}}, "TAGS"),
            React.createElement(SmartTagEditor, {
              tags: docxTags, onChange: setDocxTags, allTags,
              content: (docxSummary+" "+docxMd).slice(0,1500), llmModel,
            })
          ),

          // Samenvatting — toont spinner als nog bezig
          React.createElement("div", {style:{
            background:"rgba(138,198,242,0.06)",
            border:`1px solid rgba(138,198,242,0.2)`,
            borderLeft:`3px solid ${W.blue}`,
            borderRadius:"6px", padding:"12px 16px",
          }},
            React.createElement("div", {style:{fontSize:"11px",color:W.blue,
              letterSpacing:"1.2px",fontWeight:"600",marginBottom:"8px",
              display:"flex",alignItems:"center",gap:"8px"}},
              "✦ SAMENVATTING",
              docxStatus && React.createElement("span", {style:{
                fontSize:"12px",color:W.yellow,fontWeight:"400",
                animation:"ai-pulse 1.4s ease-in-out infinite",letterSpacing:0,
              }}, docxStatus)
            ),
            docxSummary
              ? React.createElement("textarea", {
                  value: docxSummary,
                  onChange: e => setDocxSummary(e.target.value),
                  rows: 4,
                  style:{width:"100%",background:"transparent",border:"none",
                         outline:"none",color:W.fg,fontSize:"14px",lineHeight:"1.7",
                         resize:"vertical",fontFamily:"inherit",boxSizing:"border-box"}
                })
              : React.createElement("div", {style:{fontSize:"14px",color:W.fgMuted,
                  fontStyle:"italic"}},
                  docxStatus ? "Bezig met genereren…" : "Geen samenvatting beschikbaar"
                )
          ),

          // Markdown-tekst
          React.createElement("div", null,
            React.createElement("div", {style:{fontSize:"11px",color:W.fgDim,
              letterSpacing:"1.2px",marginBottom:"8px",fontWeight:"600"}},
              "DOCUMENT TEKST"),
            React.createElement("div", {style:{
              background:W.bg2, border:`1px solid ${W.splitBg}`,
              borderRadius:"6px", padding:"16px 18px",
              fontSize:"13px", color:W.fg, lineHeight:"1.8",
              whiteSpace:"pre-wrap", fontFamily:"'Courier New', monospace",
              maxHeight:"400px", overflowY:"auto",
            }}, docxMd || "(geen tekst geëxtraheerd)"),
          ),

          // Bestandsnaam
          React.createElement("div", {style:{fontSize:"12px",color:W.fgDim,
            display:"flex",alignItems:"center",gap:"6px"}},
            "📄 ", React.createElement("span",{style:{color:W.fgMuted}},
              docxPreview.filename))
        )
      )
    ),

    // ── PowerPoint import tab ─────────────────────────────────────────────────
    importMode === "pptx" && React.createElement("div", {
      style: { flex: 1, display: "flex", flexDirection: "column",
               overflow: "hidden", minHeight: 0 }
    },

      // ── Upload fase ────────────────────────────────────────────────────────
      !pptxData && React.createElement("div", {
        style: { flex: 1, display: "flex", flexDirection: "column",
                 alignItems: "center", justifyContent: "center",
                 gap: "14px", padding: "32px 20px" }
      },
        React.createElement("input", {
          ref: pptxInputRef, type: "file", accept: ".pptx,.ppt",
          style: { display: "none" },
          onChange: async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            e.target.value = "";
            setPptxBusy(true); setPptxError(null); setPptxData(null);
            setPptxSaved(false); setPptxTagsLoading(true); setPptxTypeLoading(true);
            const fd = new FormData();
            fd.append("file", file, file.name);
            try {
              const resp = await fetch(
                `/api/import-pptx?model=${encodeURIComponent(llmModel || "")}`,
                { method: "POST", body: fd }
              );
              const data = await resp.json();
              if (!data.ok) { setPptxError(data.error || "Fout"); setPptxBusy(false); return; }
              setPptxData(data);

              // Parallel: tags + type suggestie
              if (llmModel && data.full_text) {
                _aiTagSuggest(data.full_text.slice(0, 4000), [], allTags, llmModel)
                  .then(t => { if (t.length) setPptxTags(t); })
                  .catch(() => {})
                  .finally(() => setPptxTagsLoading(false));

                fetch("/api/llm/chat", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: llmModel,
                    messages: [{ role: "user", content:
                      "Analyseer en geef het Zettelkasten-notitietype. " +
                      "Kies ALLEEN: fleeting, literature, permanent, index\n\n" +
                      data.full_text.slice(0, 800)
                    }],
                    system: "Geef ALLEEN één woord: fleeting, literature, permanent of index.",
                  }),
                }).then(r => r.json()).then(d => {
                  const raw = (d.content || d.response || "").trim().toLowerCase();
                  const match = ["fleeting","literature","permanent","index"].find(v => raw.includes(v));
                  if (match) { setPptxSuggestedType(match); setPptxType(match); }
                }).catch(() => {}).finally(() => setPptxTypeLoading(false));
              } else {
                setPptxTagsLoading(false); setPptxTypeLoading(false);
              }
            } catch(e) { setPptxError(e.message); setPptxTagsLoading(false); setPptxTypeLoading(false); }
            setPptxBusy(false);
          }
        }),

        pptxBusy
          ? React.createElement("div", {
              style: { color: W.purple, fontSize: "14px",
                       animation: "ai-pulse 1.4s ease-in-out infinite",
                       display: "flex", flexDirection: "column",
                       alignItems: "center", gap: "8px" }
            },
              React.createElement("div", { style: { fontSize: "32px" } }, "📊"),
              "Presentatie verwerken + PDF aanmaken…"
            )
          : React.createElement("div", {
              style: { display: "flex", flexDirection: "column",
                       alignItems: "center", gap: "12px" }
            },
              React.createElement("div", { style: { fontSize: "48px", opacity: .6 } }, "📊"),
              React.createElement("div", {
                style: { fontSize: "14px", color: W.fg, fontWeight: "500" }
              }, "PowerPoint importeren"),
              React.createElement("div", {
                style: { fontSize: "12px", color: W.fgMuted, textAlign: "center",
                         maxWidth: "300px", lineHeight: "1.7" }
              },
                "De presentatie wordt opgeslagen als PDF (inclusief annotaties) ",
                "en verwerkt tot één doorzoekbare samenvatting-notitie."
              ),
              React.createElement("button", {
                onClick: () => pptxInputRef.current?.click(),
                style: {
                  background: "rgba(125,216,198,0.1)",
                  border: `1px solid rgba(125,216,198,0.3)`,
                  borderRadius: "6px", color: W.blue,
                  padding: "9px 22px", fontSize: "13px", cursor: "pointer",
                }
              }, "📂 Kies .pptx bestand"),
              pptxError && React.createElement("div", {
                style: { color: W.orange, fontSize: "12px", textAlign: "center",
                         maxWidth: "280px" }
              }, pptxError)
            )
      ),

      // ── Preview fase ───────────────────────────────────────────────────────
      pptxData && !pptxSaved && React.createElement("div", {
        style: { flex: 1, display: "flex", flexDirection: "column",
                 overflow: "hidden", minHeight: 0 }
      },

        // Header — overflow:visible zodat SmartTagEditor dropdown niet geclipped wordt
        React.createElement("div", {
          style: { padding: "12px 14px 10px", borderBottom: `1px solid ${W.splitBg}`,
                   flexShrink: 0, overflow: "visible", position: "relative", zIndex: 10 }
        },
          // Titel
          React.createElement("div", {
            style: { fontSize: "14px", fontWeight: "600",
                     color: W.statusFg, marginBottom: "4px" }
          }, pptxData.title),

          // PDF status
          React.createElement("div", {
            style: { fontSize: "11px", marginBottom: "8px",
                     display: "flex", alignItems: "center", gap: "6px" }
          },
            pptxData.pdf_saved
              ? React.createElement("span", { style: { color: W.comment } },
                  `✓ PDF opgeslagen: ${pptxData.pdf_name}`)
              : React.createElement("span", { style: { color: W.orange } },
                  "⚠ PDF kon niet worden opgeslagen — alleen tekst-notitie")
          ),

          // Notitietype
          React.createElement("div", {
            style: { display: "flex", gap: "4px", alignItems: "center",
                     marginBottom: "8px", flexWrap: "wrap" }
          },
            React.createElement("span", {
              style: { fontSize: "9px", color: W.fgMuted, textTransform: "uppercase",
                       letterSpacing: "0.5px", marginRight: "2px" }
            }, pptxTypeLoading ? "✦ type…" : "Type:"),
            ["fleeting","literature","permanent","index"].map(id => {
              const m = PPTX_TYPE_META[id];
              const isActive = pptxType === id;
              const isSugg   = pptxSuggestedType === id;
              return React.createElement("button", {
                key: id, onClick: () => setPptxType(id), title: m.desc,
                style: {
                  padding: "2px 8px", fontSize: "10px", cursor: "pointer",
                  background: isActive ? `${m.color}20` : "transparent",
                  border: `1px solid ${isActive ? m.color : isSugg ? m.color+"60" : W.splitBg}`,
                  borderRadius: "4px",
                  color: isActive ? m.color : isSugg ? m.color : W.fgMuted,
                  fontWeight: isActive ? "600" : "400",
                  display: "flex", alignItems: "center", gap: "4px",
                }
              },
                React.createElement("div", {
                  style: { width: "6px", height: "6px", borderRadius: "50%",
                           background: m.color, opacity: isActive ? 1 : 0.4 }
                }),
                m.label,
                isSugg && !isActive && React.createElement("span", {
                  style: { fontSize: "8px", color: W.yellow }
                }, "✦")
              );
            })
          ),

          // Tags
          React.createElement("div", {
            style: { display: "flex", alignItems: "center", gap: "6px",
                     marginBottom: "4px" }
          },
            React.createElement("span", {
              style: { fontSize: "9px", color: W.fgMuted, textTransform: "uppercase",
                       letterSpacing: "0.5px", flexShrink: 0 }
            }, pptxTagsLoading ? "✦ tags…" : "Tags:"),
          ),
          React.createElement(SmartTagEditor, {
            tags: pptxTags, onChange: setPptxTags,
            allTags, content: pptxData.full_text?.slice(0, 4000) || "", llmModel,
          })
        ),

        // AI samenvatting
        pptxData.summary && React.createElement("div", {
          style: { padding: "8px 14px", borderBottom: `1px solid ${W.splitBg}`,
                   background: "rgba(125,216,198,0.03)", flexShrink: 0 }
        },
          React.createElement("div", {
            style: { fontSize: "9px", color: W.blue, letterSpacing: "1px",
                     textTransform: "uppercase", marginBottom: "4px" }
          }, "✦ AI samenvatting"),
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgDim, lineHeight: "1.6" }
          }, pptxData.summary)
        ),

        // Slide-overzicht (compact, read-only)
        React.createElement("div", {
          style: { flex: 1, overflowY: "auto", padding: "8px 0" }
        },
          React.createElement("div", {
            style: { padding: "4px 14px 6px", fontSize: "9px", color: W.fgMuted,
                     letterSpacing: "1px", textTransform: "uppercase" }
          }, `${pptxData.slides.length} slides`),
          pptxData.slides.map(s =>
            React.createElement("div", {
              key: s.index,
              style: { padding: "6px 14px",
                       borderBottom: `1px solid ${W.splitBg}` }
            },
              React.createElement("div", {
                style: { fontSize: "12px", color: W.fg, fontWeight: "500",
                         marginBottom: s.body ? "3px" : 0 }
              }, `${s.index}. ${s.title}`),
              s.body && React.createElement("div", {
                style: { fontSize: "10px", color: W.fgMuted, lineHeight: "1.5",
                         overflow: "hidden", maxHeight: "32px" }
              }, s.body.slice(0, 100)),
              s.notes && React.createElement("div", {
                style: { fontSize: "9px", color: W.fgDim, fontStyle: "italic",
                         marginTop: "2px" }
              }, `🗣 ${s.notes.slice(0, 80)}`)
            )
          )
        ),

        // Import knop
        React.createElement("div", {
          style: { padding: "10px 14px", borderTop: `1px solid ${W.splitBg}`,
                   flexShrink: 0, display: "flex", gap: "8px", alignItems: "center" }
        },
          React.createElement("div", { style: { flex: 1 } },
            React.createElement("div", {
              style: { fontSize: "10px", color: W.fgMuted }
            },
              pptxData.pdf_saved
                ? `PDF in bibliotheek + samenvatting-notitie`
                : `Samenvatting-notitie (geen PDF)`
            )
          ),
          React.createElement("button", {
            onClick: () => resetPptx(),
            style: { background: "none", border: `1px solid ${W.splitBg}`,
                     color: W.fgMuted, borderRadius: "5px",
                     padding: "5px 10px", fontSize: "12px", cursor: "pointer" }
          }, "Annuleer"),
          React.createElement("button", {
            onClick: async () => {
              const now  = new Date().toISOString();
              const tags = pptxTags;
              const noteType = pptxType;

              // Bouw de samenvatting-notitie
              let content = "";

              // AI samenvatting als callout
              if (pptxData.summary) {
                content += `> 📋 **Samenvatting**\n> ${pptxData.summary}\n\n---\n\n`;
              }

              // Link naar de PDF
              if (pptxData.pdf_saved) {
                content += `📎 **Presentatie:** [[pdf:${pptxData.pdf_name}]]\n\n---\n\n`;
              }

              // Slides sectie
              content += `## Inhoud\n\n`;
              for (const s of pptxData.slides) {
                content += `### ${s.index}. ${s.title}\n`;
                if (s.body)  content += s.body + "\n";
                if (s.notes) content += `\n> 🗣 *${s.notes}*\n`;
                content += "\n";
              }

              content += `---\n📊 *Geïmporteerd uit: ${pptxData.filename}*`;

              await onAddNote({
                id: genId(), title: pptxData.title,
                content, tags, noteType,
                importedAt: now, created: now, modified: now,
              });

              // Ververs PDF-bibliotheek zodat de nieuwe PDF zichtbaar is
              if (pptxData.pdf_saved && onRefreshPdfs) onRefreshPdfs();

              setPptxSaved(true);
              setTimeout(() => resetPptx(), 1800);
            },
            style: {
              background: "rgba(125,216,198,0.15)",
              border: `1px solid rgba(125,216,198,0.4)`,
              borderRadius: "5px", color: W.blue,
              padding: "5px 16px", fontSize: "12px",
              cursor: "pointer", fontWeight: "600",
            }
          }, "Importeer →")
        )
      ),

      // Succes
      pptxSaved && React.createElement("div", {
        style: { flex: 1, display: "flex", alignItems: "center",
                 justifyContent: "center", flexDirection: "column", gap: "10px" }
      },
        React.createElement("div", { style: { fontSize: "32px" } }, "✓"),
        React.createElement("div", {
          style: { fontSize: "14px", color: W.comment, fontWeight: "600" }
        }, "Geïmporteerd!"),
        React.createElement("div", {
          style: { fontSize: "12px", color: W.fgMuted }
        }, pptxData?.pdf_saved ? "PDF + notitie opgeslagen" : "Notitie opgeslagen")
      )
    ),

  );
};
