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

const WebImporter = ({llmModel, allTags, onAddNote, onRefreshImages, addJob, updateJob,
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
  const [dupNote,        setDupNote]        = useState(null); // bestaande notitie met zelfde URL
  const urlRef      = useRef(null);
  const prevPreview = useRef(importPreview);

  // ── Duplicate-check helper ─────────────────────────────────────────────────
  const findDuplicateUrl = useCallback((checkUrl) => {
    if (!checkUrl) return null;
    // Normaliseer: verwijder trailing slash en utm-parameters
    const norm = u => {
      try {
        const p = new URL(u);
        // Verwijder tracking-parameters
        ["utm_source","utm_medium","utm_campaign","utm_term","utm_content",
         "fbclid","gclid","ref","source"].forEach(k => p.searchParams.delete(k));
        return p.origin + p.pathname.replace(/\/$/,"") + (p.search||"");
      } catch { return u.replace(/\/$/,""); }
    };
    const target = norm(checkUrl);
    return notes.find(n => n.content && norm(
      (n.content.match(/\]\((https?:\/\/[^)]+)\)/) || [])[1] || ""
    ) === target) || null;
  }, [notes]);


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
    setEditMd(md); setEditTitle(title); setEditSummary(summary); setTags(newTags);
    setSaved(false); setImporting(false);
  }, [importPreview]);





  const doImport = useCallback((force=false) => {
    const u = url.trim();
    if (!u) return;

    // Duplicate check vóór de import (overslaan als force=true)
    if (!force) {
      const dup = findDuplicateUrl(u);
      if (dup) { setDupNote(dup); setError(null); return; }
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
        const res = await api.importUrl({url: u, model: llmModel||"llama3.2-vision"});
        if (res?.ok) {
          setImportPreview(res);
          if (res.images?.length && onRefreshImages) onRefreshImages();
          updateJob && updateJob(jid,{status:"done", result: res.title?.slice(0,44)||"Klaar", importResult: res});
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
    // Bouw content op: samenvatting bovenaan, dan originele tekst
    let content = "";
    if (editSummary.trim()) {
      content += `> **Samenvatting:** ${editSummary.trim()}\n\n---\n\n`;
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
      created: new Date().toISOString(), modified: new Date().toISOString(),
    });
    setSaved(true);
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
    style:{display:"flex", flexDirection:"column", height:"100%", overflow:"hidden"}
  },

    // Tab-bar
    React.createElement("div", {style:{
      background:W.statusBg, borderBottom:`1px solid ${W.splitBg}`,
      display:"flex", alignItems:"center", flexShrink:0, height:"44px", gap:0,
    }},
      tabBtn("url",  "🌐", "URL import"),
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
          display:"flex", flexDirection:"column", gap:"14px",
        }},

          // ── Tags (SmartTagEditor) ───────────────────────────────────────────
          !saved && React.createElement("div", {style:{
            background:W.bg2, border:`1px solid ${W.splitBg}`,
            borderRadius:"7px", padding:"10px 14px",
          }},
            React.createElement("div", {style:{
              fontSize:"11px",color:"rgba(138,198,242,0.6)",
              letterSpacing:"1.2px",marginBottom:"6px",fontWeight:"600",
            }}, "TAGS"),
            React.createElement(SmartTagEditor, {
              tags,
              onChange: setTags,
              allTags,
              content: (editSummary + " " + editMd).slice(0, 1500),
              llmModel,
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
              "✦ SAMENVATTING"
            ),
            React.createElement("textarea", {
              value: editSummary,
              onChange: e => setEditSummary(e.target.value),
              placeholder: editSummary ? "" : "Geen samenvatting gegenereerd — voeg zelf toe…",
              rows: 3,
              style:{
                width:"100%", background:"transparent",
                border:"none", outline:"none",
                color:W.fg, fontSize:"14px", lineHeight:"1.7",
                resize:"vertical", fontFamily:"inherit",
                boxSizing:"border-box",
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
  );
};
