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

const WebImporter = ({llmModel, allTags, onAddNote, onRefreshImages, onDescribeImages, addJob, updateJob,
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
      .replace(/#?[0-9a-fA-F]{0,8};?(?:[\w-]+:[^;">\n]{1,60};?){1,10}"?>/g, "")
      .replace(/<[^>]{0,300}>/g, "")
      .replace(/={2,}\s*(?:SAMENVATTING|ARTIKEL|SUMMARY|ARTICLE)\s*={2,}/gi, "")
      .replace(/^#+\s*$/gm, "")
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
      const textForTags = (summary + " " + md).slice(0, 4000);
      _aiTagSuggest(textForTags, newTags, allTags, llmModel)
        .then(suggested => {
          if (suggested.length > 0) setTags(prev => {
            const combined = [...new Set([...prev, ...suggested])];
            return combined;
          });
        })
        .catch(() => {})
        .finally(() => setAiTagsLoading(false));
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
    content += editMd;
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
    await onAddNote({
      id: genId(), title: editTitle, content, tags,
      sourceUrl: importPreview.url,
      importedAt: new Date().toISOString(),
      created: new Date().toISOString(), modified: new Date().toISOString(),
    });
    // Beschrijf alleen de geselecteerde afbeeldingen, pas na opslaan
    if (selectedImages.size > 0 && onDescribeImages) {
      onDescribeImages([...selectedImages]);
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
    setTimeout(()=>urlRef.current?.focus(), 50);
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
  );
};
