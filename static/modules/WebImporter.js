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
                      importPreview, setImportPreview}) => {
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
  const [tags,           setTags]           = useState([]);
  const [saved,          setSaved]          = useState(false);
  const [renderMode,     setRenderMode]     = useState(true);
  const [selectedImages, setSelectedImages] = useState(new Set());
  const urlRef      = useRef(null);
  const prevPreview = useRef(importPreview);

  // Thunderbird / Gmail
  const [inboxes,        setInboxes]        = useState([]);
  const [mailLoading,    setMailLoading]    = useState(false);
  const [mailError,      setMailError]      = useState(null);
  const [mailSelected,   setMailSelected]   = useState(new Set());
  const [mailPath,       setMailPath]       = useState("");
  const [mailImporting,  setMailImporting]  = useState(false);
  const [mailImportProg, setMailImportProg] = useState(null);
  const [mailResults,    setMailResults]    = useState([]);
  const [collapsedBoxes, setCollapsedBoxes] = useState(new Set());
  const [mailLog,        setMailLog]        = useState([]);
  const [mailDebug,      setMailDebug]      = useState(null);

  // ── initFromPreview helper ─────────────────────────────────────────────────
  const initFromPreview = (p) => {
    if (!p) return { md: "", title: "", tags: [] };
    let domain = "";
    try { domain = new URL(p.url).hostname.replace("www.","").split(".")[0]; } catch {}
    return { md: p.markdown||"", title: p.title||"", tags: ["import",domain].filter(Boolean) };
  };

  // Sync editMd/editTitle/tags wanneer importPreview van buiten wijzigt
  useEffect(() => {
    if (importPreview === prevPreview.current) return;
    prevPreview.current = importPreview;
    if (!importPreview) return;
    const {md, title, tags: newTags} = initFromPreview(importPreview);
    setEditMd(md); setEditTitle(title); setTags(newTags);
    setSaved(false); setImporting(false);
  }, [importPreview]);

  // ── Gmail inbox laden via SSE-stream ───────────────────────────────────────
  const loadMailbox = useCallback(async () => {
    setMailLoading(true); setMailError(null); setInboxes([]);
    setMailSelected(new Set()); setMailDebug(null); setMailLog([]);

    const addLog = (line, type="info") =>
      setMailLog(prev => [...prev, {line, type, ts: Date.now()}]);

    try {
      const params = new URLSearchParams({ max: "300" });
      if (mailPath.trim()) params.set("path", mailPath.trim());

      const res = await fetch(`/api/mail/inbox-stream?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let   buf    = "";

      while (true) {
        const {value, done} = await reader.read();
        if (done) break;
        buf += dec.decode(value, {stream: true});
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            const logType = evt.type === "inbox"   ? "success"
                          : evt.type === "error"   ? "error"
                          : evt.type === "done"    ? "done"
                          : evt.type === "file"    ? "file"
                          : evt.type === "profile" ? "profile"
                          : "info";
            if (evt.msg) addLog(evt.msg, logType);
            if (evt.type === "done") {
              setInboxes(evt.inboxes || []);
              if (!evt.total) addLog("Geen mails met URLs gevonden.", "warn");
              setMailLoading(false);
            } else if (evt.type === "error") {
              setMailError(evt.msg);
              if (evt.paths_tried) setMailDebug(evt.paths_tried);
              setMailLoading(false);
            }
          } catch(e) { /* ongeldige JSON-regel — skip */ }
        }
      }
    } catch(e) {
      setMailError(e.message);
      setMailLoading(false);
    }
  }, [mailPath]);

  // ── Mail-selectie helpers ──────────────────────────────────────────────────
  const allMails = React.useMemo(() => inboxes.flatMap(b => b.mails), [inboxes]);

  const toggleMailSelect = (id) =>
    setMailSelected(prev => { const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

  const selectInbox   = (inbox) =>
    setMailSelected(prev => { const n=new Set(prev); inbox.mails.forEach(m=>n.add(m.id)); return n; });

  const deselectInbox = (inbox) =>
    setMailSelected(prev => { const n=new Set(prev); inbox.mails.forEach(m=>n.delete(m.id)); return n; });

  const selectAll   = () => setMailSelected(new Set(allMails.map(m=>m.id)));
  const deselectAll = () => setMailSelected(new Set());

  const toggleBox = (name) => setCollapsedBoxes(prev => {
    const n = new Set(prev); n.has(name)?n.delete(name):n.add(name); return n;
  });

  const selectedUrls = React.useMemo(() => {
    const urls=[]; const seen=new Set();
    for (const m of allMails) {
      if (!mailSelected.has(m.id)) continue;
      for (const u of (m.urls||[])) { if (!seen.has(u)){seen.add(u);urls.push(u);} }
    }
    return urls;
  }, [allMails, mailSelected]);

  // ── Gmail-import: geselecteerde URLs importeren ────────────────────────────
  const doMailImport = useCallback(async () => {
    if (!selectedUrls.length) return;
    setMailImporting(true); setMailResults([]);
    const results = [];
    for (let i = 0; i < selectedUrls.length; i++) {
      setMailImportProg(`${i+1}/${selectedUrls.length}`);
      const u = selectedUrls[i];
      try {
        const res = await fetch("/api/import-url", {
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({url:u, model:llmModel||"llama3.2-vision"}),
        });
        const data = await res.json();
        if (data.ok) {
          let domain=""; try{domain=new URL(u).hostname.replace("www.","").split(".")[0];}catch{}
          await onAddNote({
            id: genId(), title: data.title||domain||u.slice(0,50),
            content: (data.markdown||"") + "\n\n---\n🌐 **Bron:** ["+u+"]("+u+")\n📬 *Geïmporteerd uit Gmail*",
            tags: ["import","gmail",domain].filter(Boolean),
            created: new Date().toISOString(), modified: new Date().toISOString(),
          });
          if (data.images?.length && onRefreshImages) onRefreshImages();
          results.push({url:u, ok:true, title:data.title||u.slice(0,50)});
          addJob && addJob({id:genId(),type:"import",label:"📬 "+u.slice(0,40)+"…",
            status:"done",result:data.title||u.slice(0,40)});
        } else { results.push({url:u,ok:false,error:data.error||"mislukt"}); }
      } catch(e) { results.push({url:u,ok:false,error:e.message}); }
    }
    setMailResults(results); setMailImporting(false); setMailImportProg(null);
  }, [selectedUrls, llmModel, onAddNote, onRefreshImages, addJob]);

  const doImport = useCallback(() => {
    const u = url.trim();
    if (!u) return;
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
  }, [url, llmModel, onRefreshImages, addJob, updateJob]);

  const saveNote = useCallback(async () => {
    if (!importPreview) return;
    let content = editMd;
    if (selectedImages.size > 0 && importPreview.images?.length) {
      const pickedLinks = importPreview.images
        .filter(img => selectedImages.has(img.name))
        .map(img => `![[img:${img.name}]]`).join("\n\n");
      content += "\n\n" + pickedLinks;
    }
    content += "\n\n---\n🌐 **Bron:** [" + importPreview.url + "](" + importPreview.url + ")";
    await onAddNote({
      id: genId(), title: editTitle, content, tags,
      created: new Date().toISOString(), modified: new Date().toISOString(),
    });
    setSaved(true);
  }, [importPreview, editTitle, editMd, tags, selectedImages, onAddNote]);

  const reset = () => {
    setUrl(""); setImportPreview(null); setEditMd(""); setEditTitle("");
    setTags([]); setError(null); setSaved(false); setImporting(false);
    setSelectedImages(new Set());
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
      tabBtn("mail", "📬", "Thunderbird / Gmail"),
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
                "⚠ "+error))
      )
    ),

    // ══════════════════════════════════════════════════════════════════════════
    // Tab: Thunderbird / Gmail inbox
    // ══════════════════════════════════════════════════════════════════════════
    importMode === "mail" && React.createElement("div", {
      style:{flex:1, display:"flex", flexDirection:"column", overflow:"hidden"}
    },

      // Sub-toolbar
      React.createElement("div", {style:{
        background:W.bg2, borderBottom:`1px solid ${W.splitBg}`,
        padding:"8px 14px", display:"flex", alignItems:"center",
        gap:"8px", flexShrink:0, flexWrap:"wrap"
      }},
        React.createElement("span", {style:{fontSize:"13px",color:W.fgMuted,flexShrink:0}},
          "📬 Thunderbird inbox"),
        React.createElement("input", {
          value:mailPath,
          onChange:e=>setMailPath(e.target.value),
          placeholder:"Pad optioneel — leeg = automatisch zoeken",
          style:{flex:1,minWidth:"200px",background:W.bg3,border:`1px solid ${W.splitBg}`,
                 borderRadius:"4px",color:W.fg,padding:"5px 10px",fontSize:"13px",outline:"none"}
        }),
        React.createElement("button", {
          onClick:loadMailbox, disabled:mailLoading,
          style:{background:W.blue,color:W.bg,border:"none",borderRadius:"5px",
                 padding:"6px 16px",fontSize:"14px",fontWeight:"bold",cursor:"pointer",
                 opacity:mailLoading?0.5:1,whiteSpace:"nowrap"}
        }, mailLoading ? "⏳ Laden…" : "📂 Laden"),
        inboxes.length > 0 && React.createElement(React.Fragment, null,
          React.createElement("span", {style:{fontSize:"13px",color:W.fgMuted,flexShrink:0}},
            `${allMails.length} mails ·`),
          React.createElement("button", {onClick:selectAll,
            style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgDim,
                   borderRadius:"4px",padding:"3px 8px",fontSize:"13px",cursor:"pointer"}
          }, "✓ alles"),
          React.createElement("button", {onClick:deselectAll,
            style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgDim,
                   borderRadius:"4px",padding:"3px 8px",fontSize:"13px",cursor:"pointer"}
          }, "× geen"),
          React.createElement("button", {
            onClick:doMailImport, disabled:mailImporting||mailSelected.size===0,
            style:{background:mailSelected.size>0?"rgba(159,202,86,0.85)":"rgba(159,202,86,0.2)",
                   color:W.bg,border:"none",borderRadius:"5px",padding:"6px 18px",
                   fontSize:"14px",fontWeight:"bold",cursor:"pointer",
                   opacity:mailSelected.size===0||mailImporting?0.5:1,
                   whiteSpace:"nowrap",transition:"all 0.15s"}
          }, mailImporting
              ? `⏳ ${mailImportProg||"…"}`
              : `📥 Importeer ${mailSelected.size||""}${mailSelected.size===1?" mail":" mails"}`)
        )
      ),

      // Foutmelding
      mailError && React.createElement("div", {style:{
        padding:"10px 16px",color:W.orange,background:"rgba(229,120,109,0.08)",
        borderBottom:`1px solid rgba(229,120,109,0.2)`,fontSize:"14px",flexShrink:0
      }},
        "⚠ ", mailError,
        mailDebug && React.createElement("div", {style:{marginTop:"6px",fontSize:"12px",color:W.fgMuted}},
          "Gezocht in:",
          mailDebug.map((p,i)=>React.createElement("div", {key:i, style:{
            fontFamily:"monospace",fontSize:"11px",color:W.fgDim,paddingLeft:"8px"
          }}, p)),
          React.createElement("div", {style:{marginTop:"4px",color:W.fgMuted}},
            "Tip: voer het volledige pad naar je .thunderbird profiel in, bijv: ",
            React.createElement("code", {style:{color:W.comment,fontSize:"11px"}},
              "~/.thunderbird/xxxxxxxx.default"))
        )
      ),

      // Import-resultaten
      mailResults.length > 0 && React.createElement("div", {style:{
        padding:"8px 14px",background:"rgba(159,202,86,0.06)",
        borderBottom:`1px solid rgba(159,202,86,0.15)`,
        display:"flex",flexWrap:"wrap",gap:"6px",flexShrink:0,alignItems:"center"
      }},
        React.createElement("span", {style:{fontSize:"13px",color:W.comment,fontWeight:"bold"}},
          `✓ ${mailResults.filter(r=>r.ok).length}/${mailResults.length} geïmporteerd`),
        mailResults.map((r,i)=>React.createElement("span", {key:i, style:{
          fontSize:"12px",padding:"2px 8px",borderRadius:"10px",
          background:r.ok?"rgba(159,202,86,0.15)":"rgba(229,120,109,0.15)",
          color:r.ok?W.comment:W.orange,
          maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"
        }}, r.ok?"✓ "+(r.title||"").slice(0,28):"✗ "+(r.error||"").slice(0,28)))
      ),

      // Live scan-log
      (mailLoading || (mailLog.length > 0 && inboxes.length === 0)) &&
        React.createElement("div", {style:{
          background:W.bg2, borderBottom:`1px solid ${W.splitBg}`,
          padding:"12px 16px", flexShrink:0,
          maxHeight: mailLoading ? "220px" : "140px",
          overflowY:"auto", fontFamily:"monospace", fontSize:"13px",
          transition:"max-height 0.3s"
        }},
          mailLog.map((entry, i) => {
            const col = entry.type==="success" ? W.comment
                      : entry.type==="error"   ? W.orange
                      : entry.type==="done"    ? W.comment
                      : entry.type==="warn"    ? W.yellow
                      : entry.type==="file"    ? W.blue
                      : entry.type==="profile" ? (W.purple||"#d787ff")
                      : W.fgMuted;
            return React.createElement("div", {key:i, style:{
              color:col, lineHeight:"1.8", whiteSpace:"pre-wrap", wordBreak:"break-all"
            }}, entry.line);
          }),
          mailLoading && React.createElement("div", {style:{
            color:W.fgMuted, display:"flex", alignItems:"center", gap:"8px", marginTop:"4px"
          }},
            React.createElement("span", {style:{animation:"ai-pulse 1.2s ease-in-out infinite"}}, "⏳"),
            "bezig…"
          )
        ),

      // Lege beginstand
      inboxes.length === 0 && !mailLoading && !mailError && mailLog.length === 0 &&
        React.createElement("div", {style:{
          display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
          flex:1,gap:"14px",color:W.fgMuted,padding:"32px",textAlign:"center"
        }},
          React.createElement("div", {style:{fontSize:"48px"}}, "📬"),
          React.createElement("div", {style:{fontSize:"15px",maxWidth:"400px",lineHeight:"1.7"}},
            "Klik 'Laden' om je Gmail-inbox te lezen.",
            React.createElement("br"),
            React.createElement("span", {style:{fontSize:"13px",color:W.fgMuted}},
              "Alleen mails met URLs worden getoond, nieuwste bovenaan.")
          )
        ),

      // Inbox-lijsten
      React.createElement("div", {style:{flex:1,overflowY:"auto"}},
        inboxes.map(inbox => {
          const isCollapsed = collapsedBoxes.has(inbox.name);
          const allSel  = inbox.mails.every(m => mailSelected.has(m.id));
          const someSel = inbox.mails.some(m => mailSelected.has(m.id));

          return React.createElement("div", {key:inbox.name,
            style:{borderBottom:`2px solid ${W.bg3}`}
          },
            // Inbox-header
            React.createElement("div", {style:{
              display:"flex",alignItems:"center",gap:"8px",
              padding:"7px 14px",background:W.bg3,
              borderBottom:`1px solid ${W.splitBg}`,
              position:"sticky",top:0,zIndex:2,cursor:"pointer"
            }, onClick:()=>toggleBox(inbox.name)},
              React.createElement("span", {style:{fontSize:"13px",color:W.fgMuted}},
                isCollapsed?"▶":"▼"),
              React.createElement("span", {style:{
                fontSize:"13px",fontWeight:"bold",color:W.statusFg,flex:1,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"
              }}, inbox.name),
              React.createElement("span", {style:{
                fontSize:"12px",color:W.fgMuted,background:W.bg2,
                borderRadius:"10px",padding:"1px 8px",flexShrink:0
              }}, inbox.count),
              React.createElement("button", {
                onClick:e=>{e.stopPropagation();allSel?deselectInbox(inbox):selectInbox(inbox);},
                style:{
                  border:`1px solid ${W.splitBg}`,
                  color:allSel?W.comment:W.fgDim,borderRadius:"4px",
                  padding:"2px 8px",fontSize:"12px",cursor:"pointer",flexShrink:0,
                  background:allSel?"rgba(159,202,86,0.15)":"none",
                }
              }, allSel?"✓ alles geselecteerd":"+ selecteer inbox")
            ),

            // Mail-rijen
            !isCollapsed && inbox.mails.map(mail => {
              const isSel = mailSelected.has(mail.id);
              return React.createElement("div", {
                key:mail.id,
                onClick:()=>toggleMailSelect(mail.id),
                style:{
                  display:"grid",
                  gridTemplateColumns:"22px 1fr",
                  gridTemplateRows:"auto auto auto",
                  gap:"0 10px",
                  padding:"9px 14px 9px 12px",
                  borderBottom:`1px solid ${W.splitBg}`,
                  background:isSel?"rgba(159,202,86,0.07)":"transparent",
                  cursor:"pointer",
                  transition:"background 0.1s",
                }
              },
                // Checkbox
                React.createElement("div", {style:{
                  gridRow:"1/4",gridColumn:"1",
                  width:"16px",height:"16px",borderRadius:"3px",marginTop:"3px",
                  border:`2px solid ${isSel?W.comment:W.splitBg}`,
                  background:isSel?"rgba(159,202,86,0.85)":"transparent",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  color:W.bg,fontSize:"11px",flexShrink:0,transition:"all 0.1s"
                }}, isSel&&"✓"),

                // Onderwerp
                React.createElement("div", {style:{
                  gridRow:"1",gridColumn:"2",
                  fontSize:"14px",fontWeight:"600",
                  color:isSel?W.statusFg:W.fg,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                  lineHeight:"1.4"
                }}, mail.subject||"(geen onderwerp)"),

                // Snippet + URL-chips
                React.createElement("div", {style:{
                  gridRow:"2",gridColumn:"2",
                  fontSize:"13px",color:W.fgDim,lineHeight:"1.5",marginTop:"3px"
                }},
                  mail.snippet && React.createElement("span", {style:{color:W.fgMuted,marginRight:"6px"}},
                    mail.snippet.slice(0,120).replace(/\s+/g," ")+"…"),
                  (mail.urls||[]).map((u,i)=>{
                    let domain=""; try{domain=new URL(u).hostname.replace("www.","");}catch{}
                    return React.createElement("a", {
                      key:i, href:u, target:"_blank", rel:"noopener",
                      onClick:e=>e.stopPropagation(),
                      style:{
                        display:"inline-block",fontSize:"12px",
                        background:"rgba(138,198,242,0.1)",
                        border:"1px solid rgba(138,198,242,0.25)",
                        borderRadius:"3px",padding:"1px 7px",
                        color:"#8ac6f2",marginRight:"4px",marginTop:"3px",
                        maxWidth:"220px",overflow:"hidden",
                        textOverflow:"ellipsis",whiteSpace:"nowrap",
                        verticalAlign:"middle",textDecoration:"none",
                      }
                    }, domain||u.slice(0,40));
                  })
                ),

                // Datum
                React.createElement("div", {style:{
                  gridRow:"3",gridColumn:"2",
                  fontSize:"12px",color:W.fgMuted,marginTop:"4px",lineHeight:"1.2"
                }}, mail.date_display||"")
              );
            })
          );
        })
      )
    )
  );
};
