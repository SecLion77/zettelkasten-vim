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

  // Gmail INBOX
  const [inboxes,        setInboxes]        = useState([]);
  const [mailLoading,    setMailLoading]    = useState(false);
  const [mailError,      setMailError]      = useState(null);
  const [mailSelected,   setMailSelected]   = useState(new Set());
  const [mailImporting,  setMailImporting]  = useState(false);
  const [mailImportProg, setMailImportProg] = useState(null);
  const [mailResults,    setMailResults]    = useState([]);
  const [mailLog,        setMailLog]        = useState([]);
  const [mailDays,       setMailDays]       = useState(7);    // dagfilter
  const [expandedMail,   setExpandedMail]   = useState(null); // uitgeklapte mail-id
  const [urlOnly,        setUrlOnly]        = useState(false); // filter: alleen mails met URL

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
    setMailSelected(new Set()); setMailLog([]);

    const addLog = (line, type="info") =>
      setMailLog(prev => [...prev, {line, type, ts: Date.now()}]);

    try {
      const params = new URLSearchParams({ max: "100" });
      params.set("url_only", urlOnly ? "1" : "0");
      params.set("days", String(mailDays));

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
            if (evt.msg) addLog(evt.msg, evt.type === "error" ? "error"
                                       : evt.type === "inbox"  ? "success" : "info");
            if (evt.type === "done") {
              setInboxes(evt.inboxes || []);
              setMailLoading(false);
            } else if (evt.type === "error") {
              setMailError(evt.msg);
              setMailLoading(false);
            }
          } catch(e) { /* ongeldige JSON-regel — skip */ }
        }
      }
    } catch(e) {
      setMailError(e.message);
      setMailLoading(false);
    }
  }, [urlOnly, mailDays]);

  // ── Mail-selectie helpers ──────────────────────────────────────────────────
  const allMails = React.useMemo(() => {
    const cutoff = mailDays > 0
      ? new Date(Date.now() - mailDays * 86400000).toISOString()
      : null;
    return inboxes
      .flatMap(b => b.mails)
      .filter(m => !cutoff || (m.date && m.date >= cutoff))
      .filter(m => !urlOnly || (m.urls && m.urls.length > 0))
      .sort((a, b) => (b.date||"").localeCompare(a.date||""));
  }, [inboxes, mailDays, urlOnly]);

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
            content: (data.markdown||"") + "\n\n---\n🌐 **Bron:** ["+u+"]("+u+")\n📬 *Geïmporteerd uit Thunderbird*",
            tags: ["import","thunderbird",domain].filter(Boolean),
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
      tabBtn("mail", "📬", "Gmail INBOX"),
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
    // Tab: Gmail INBOX via IMAP
    // ══════════════════════════════════════════════════════════════════════════
    importMode === "mail" && React.createElement(React.Fragment, null,

      // ── Credentials balk ───────────────────────────────────────────────────
      React.createElement(GmailCredsBar, {
        onLoaded: ({email, hasPw}) => {
          // Als creds al ingesteld zijn, toon dat
        }
      }),

      // ── Laad-toolbar ───────────────────────────────────────────────────────
      React.createElement("div", {style:{
        background:W.bg2, borderBottom:`1px solid ${W.splitBg}`,
        padding:"7px 14px", display:"flex", alignItems:"center",
        gap:"8px", flexShrink:0, flexWrap:"wrap",
      }},
        // Dagfilter
        React.createElement("select", {
          value: mailDays,
          onChange: e => setMailDays(Number(e.target.value)),
          style:{background:W.bg3,border:`1px solid ${W.splitBg}`,color:W.fg,
                 borderRadius:"4px",padding:"5px 8px",fontSize:"13px",outline:"none"}
        },
          React.createElement("option",{value:3},"Laatste 3 dagen"),
          React.createElement("option",{value:7},"Laatste 7 dagen"),
          React.createElement("option",{value:14},"Laatste 14 dagen"),
          React.createElement("option",{value:30},"Laatste 30 dagen"),
          React.createElement("option",{value:90},"Laatste 3 maanden"),
        ),
        // URL-filter toggle
        React.createElement("button", {
          onClick: () => setUrlOnly(v => !v),
          style:{
            background: urlOnly ? "rgba(159,202,86,0.15)" : "none",
            border: `1px solid ${urlOnly ? W.comment : W.splitBg}`,
            color: urlOnly ? W.comment : W.fgMuted,
            borderRadius:"4px", padding:"5px 12px", fontSize:"13px", cursor:"pointer",
          }
        }, urlOnly ? "🔗 Alleen met URL ✓" : "🔗 Alleen met URL"),

        React.createElement("div",{style:{flex:1}}),

        // Laden knop
        React.createElement("button", {
          onClick: loadMailbox,
          disabled: mailLoading,
          style:{
            background: mailLoading ? "rgba(138,198,242,0.08)" : "rgba(138,198,242,0.15)",
            border: `1px solid ${W.blue}`,
            color: W.blue, borderRadius:"5px",
            padding:"5px 16px", fontSize:"13px",
            cursor: mailLoading ? "default" : "pointer",
            fontWeight:"600", whiteSpace:"nowrap",
          }
        }, mailLoading ? "⏳ Laden…" : "📬 Inbox laden")
      ),

      // ── Fout ───────────────────────────────────────────────────────────────
      mailError && React.createElement("div", {style:{
        margin:"10px 14px", padding:"12px 14px",
        background:"rgba(229,120,109,0.08)",
        border:"1px solid rgba(229,120,109,0.3)",
        borderRadius:"6px", fontSize:"13px", color:"#e5786d",
        whiteSpace:"pre-wrap", lineHeight:"1.7",
      }}, mailError),

      // ── Log tijdens laden ───────────────────────────────────────────────────
      mailLoading && mailLog.length > 0 && React.createElement("div", {style:{
        margin:"8px 14px", padding:"8px 12px",
        background:"rgba(0,0,0,0.3)", borderRadius:"5px",
        fontSize:"12px", color:W.fgMuted,
        maxHeight:"80px", overflowY:"auto",
        fontFamily:"monospace",
      }},
        ...mailLog.slice(-6).map((l,i) => React.createElement("div",{key:i,
          style:{color: l.type==="error"?"#e5786d":l.type==="success"?"#9fca56":W.fgDim}
        }, l.line))
      ),

      // ── Maillijst ──────────────────────────────────────────────────────────
      React.createElement("div", {style:{
        flex:1, overflowY:"auto", display:"flex", flexDirection:"column",
      }},
        // Lege staat
        !mailLoading && inboxes.length === 0 && !mailError &&
          React.createElement("div", {style:{
            flex:1, display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center",
            color:W.fgMuted, fontSize:"13px", gap:"8px", padding:"32px",
            textAlign:"center",
          }},
            React.createElement("span",{style:{fontSize:"32px"}},"📬"),
            React.createElement("span",null,"Klik 'Inbox laden' om je Gmail-inbox te openen."),
            React.createElement("span",{style:{fontSize:"12px",color:W.fgDim}},
              "Vul eerst je e-mailadres en App Password in via het paneel hierboven.")
          ),

        // Selectie-actiebalk (sticky bovenaan als mails geladen zijn)
        inboxes.length > 0 && React.createElement("div", {style:{
          position:"sticky", top:0, zIndex:5,
          background:W.bg2, borderBottom:`1px solid ${W.splitBg}`,
          padding:"6px 14px", display:"flex",
          alignItems:"center", gap:"8px", flexWrap:"wrap",
        }},
          React.createElement("span",{style:{fontSize:"12px",color:W.fgMuted}},
            `${allMails.length} mails`
            + (urlOnly ? " met URL" : "")
          ),
          React.createElement("button",{
            onClick: () => setMailSelected(new Set(allMails.map(m=>m.id))),
            style:{background:"none",border:`1px solid ${W.splitBg}`,borderRadius:"4px",
                   color:W.fgMuted,padding:"3px 10px",fontSize:"12px",cursor:"pointer"}
          },"Alles"),
          React.createElement("button",{
            onClick: () => setMailSelected(new Set()),
            style:{background:"none",border:`1px solid ${W.splitBg}`,borderRadius:"4px",
                   color:W.fgMuted,padding:"3px 10px",fontSize:"12px",cursor:"pointer"}
          },"Geen"),
          // Alleen mails met URL selecteren
          React.createElement("button",{
            onClick: () => setMailSelected(new Set(
              allMails.filter(m=>(m.urls||[]).length>0).map(m=>m.id)
            )),
            style:{background:"none",border:`1px solid ${W.splitBg}`,borderRadius:"4px",
                   color:W.comment,padding:"3px 10px",fontSize:"12px",cursor:"pointer"}
          },"Met URL"),
          React.createElement("div",{style:{flex:1}}),
          mailSelected.size > 0 && React.createElement("span",{
            style:{fontSize:"12px",fontWeight:"600",color:W.blue}
          }, `${mailSelected.size} geselecteerd · ${selectedUrls.length} URL${selectedUrls.length!==1?"s":""}`),
          mailSelected.size > 0 && selectedUrls.length > 0 &&
            React.createElement("button",{
              onClick: doMailImport,
              disabled: mailImporting,
              style:{
                background: mailImporting?"rgba(159,202,86,0.1)":"rgba(159,202,86,0.18)",
                border:"1px solid rgba(159,202,86,0.4)",
                color:W.comment, borderRadius:"5px",
                padding:"5px 14px", fontSize:"13px",
                cursor: mailImporting?"default":"pointer", fontWeight:"600",
              }
            }, mailImporting
              ? `⏳ ${mailImportProg||"…"}`
              : `⬇ Importeer ${selectedUrls.length} URL${selectedUrls.length!==1?"s":""}`)
        ),

        // Mails
        ...allMails.map(mail => {
          const sel = mailSelected.has(mail.id);
          const hasUrls = (mail.urls||[]).length > 0;
          const expanded = expandedMail === mail.id;
          return React.createElement("div", {
            key: mail.id,
            onClick: () => {
              // Klik = selecteren/deselecteren
              setMailSelected(prev => {
                const n = new Set(prev);
                n.has(mail.id) ? n.delete(mail.id) : n.add(mail.id);
                return n;
              });
            },
            style:{
              padding:"9px 14px",
              borderBottom:`1px solid rgba(255,255,255,0.04)`,
              background: sel
                ? "rgba(138,198,242,0.09)"
                : "transparent",
              cursor:"pointer",
              display:"flex", flexDirection:"column", gap:"3px",
            },
          },
            // Rij 1: checkbox + onderwerp + datum
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"8px"}},
              React.createElement("input",{
                type:"checkbox", checked:sel,
                onChange:e=>{ e.stopPropagation();
                  setMailSelected(prev=>{const n=new Set(prev);n.has(mail.id)?n.delete(mail.id):n.add(mail.id);return n;});
                },
                style:{accentColor:W.blue,cursor:"pointer",flexShrink:0},
                onClick:e=>e.stopPropagation(),
              }),
              React.createElement("span",{style:{
                flex:1, fontSize:"13px", fontWeight:"500",
                color: sel ? W.statusFg : W.fg,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              }}, mail.subject||"(geen onderwerp)"),
              React.createElement("span",{style:{
                fontSize:"11px", color:W.fgDim, flexShrink:0,
              }}, mail.date_display||""),
            ),
            // Rij 2: afzender + URL-badges
            React.createElement("div",{style:{
              display:"flex", alignItems:"center", gap:"8px",
              paddingLeft:"26px",
            }},
              React.createElement("span",{style:{
                fontSize:"12px", color:W.fgMuted, flex:1,
                overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
              }}, mail.from||""),
              hasUrls && React.createElement("span",{style:{
                fontSize:"11px", fontWeight:"600",
                color:W.comment,
                background:"rgba(159,202,86,0.12)",
                border:"1px solid rgba(159,202,86,0.3)",
                borderRadius:"8px", padding:"1px 8px", flexShrink:0,
              }}, `🔗 ${mail.urls.length} URL${mail.urls.length!==1?"s":""}`),
              !hasUrls && React.createElement("span",{style:{
                fontSize:"11px",color:W.fgDim,opacity:0.5,flexShrink:0,
              }},"geen URL"),
              // Uitklap-knop
              React.createElement("button",{
                onClick:e=>{e.stopPropagation();setExpandedMail(expanded?null:mail.id);},
                style:{background:"none",border:"none",color:W.fgMuted,
                       cursor:"pointer",fontSize:"13px",padding:"0 4px",flexShrink:0}
              }, expanded ? "▲" : "▼"),
            ),
            // Uitgeklapt: snippet + klikbare URLs
            expanded && React.createElement("div",{
              style:{paddingLeft:"26px",marginTop:"4px"},
              onClick:e=>e.stopPropagation(),
            },
              mail.snippet && React.createElement("div",{style:{
                fontSize:"12px", color:W.fgMuted, lineHeight:"1.6",
                marginBottom:"8px", maxHeight:"80px", overflowY:"auto",
                borderLeft:`2px solid ${W.splitBg}`, paddingLeft:"8px",
              }}, mail.snippet),
              (mail.urls||[]).length > 0 && React.createElement("div",{
                style:{display:"flex",flexDirection:"column",gap:"4px"},
              },
                ...mail.urls.map((u,i) => {
                  let domain="";
                  try{domain=new URL(u).hostname.replace("www.","");}catch{}
                  return React.createElement("div",{key:i,
                    style:{display:"flex",alignItems:"center",gap:"6px"}},
                    React.createElement("a",{
                      href:u, target:"_blank", rel:"noopener",
                      onClick:e=>e.stopPropagation(),
                      style:{
                        fontSize:"12px", color:W.blue,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                        flex:1, maxWidth:"340px",
                      }
                    }, domain||u.slice(0,60)),
                    React.createElement("button",{
                      onClick:e=>{
                        e.stopPropagation();
                        // Direct importeren vanuit URL-rij
                        (async()=>{
                          try{
                            const res=await fetch("/api/import-url",{
                              method:"POST",headers:{"Content-Type":"application/json"},
                              body:JSON.stringify({url:u,model:llmModel||""})});
                            const data=await res.json();
                            if(data.ok){
                              let dom="";try{dom=new URL(u).hostname.replace("www.","").split(".")[0];}catch{}
                              await onAddNote({
                                id:genId(),title:data.title||dom||u.slice(0,50),
                                content:(data.markdown||"")+"\n\n---\n🌐 **Bron:** ["+u+"]("+u+")\n📬 *Geïmporteerd uit Gmail*",
                                tags:["import","gmail",dom].filter(Boolean),
                                created:new Date().toISOString(),modified:new Date().toISOString(),
                              });
                              setMailResults(p=>[...p,{url:u,ok:true,title:data.title||u.slice(0,50)}]);
                            }
                          }catch(e){setMailResults(p=>[...p,{url:u,ok:false,error:e.message}]);}
                        })();
                      },
                      style:{
                        background:"rgba(159,202,86,0.12)",border:"1px solid rgba(159,202,86,0.3)",
                        color:W.comment,borderRadius:"4px",padding:"2px 9px",
                        fontSize:"11px",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap",
                      }
                    },"⬇ importeer")
                  );
                })
              )
            )
          );
        }),

        // Importresultaten
        mailResults.length > 0 && React.createElement("div",{style:{
          margin:"10px 14px",padding:"10px 14px",
          background:"rgba(0,0,0,0.3)",borderRadius:"6px",
        }},
          React.createElement("div",{style:{
            fontSize:"12px",fontWeight:"600",color:W.comment,marginBottom:"6px"
          }},"Import resultaten:"),
          ...mailResults.map((r,i)=>React.createElement("div",{key:i,style:{
            fontSize:"12px",
            color:r.ok?"#9fca56":"#e5786d",
            padding:"2px 0",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
          }},
            (r.ok?"✓ ":"✗ ")+(r.title||r.url).slice(0,60)
          )),
          React.createElement("button",{
            onClick:()=>setMailResults([]),
            style:{marginTop:"8px",background:"none",border:`1px solid ${W.splitBg}`,
                   color:W.fgMuted,borderRadius:"4px",padding:"3px 10px",
                   fontSize:"12px",cursor:"pointer"}
          },"Sluiten")
        )
      )
    )
  );
};


// ── GmailOAuthBar — OAuth2 verbindingspaneel ──────────────────────────────────
const GmailCredsBar = ({ onLoaded }) => {
  const { useState, useEffect } = React;
  const [status,   setStatus]   = useState(null);
  const [clientId, setClientId] = useState("");
  const [clientSec,setClientSec]= useState("");
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState("");
  const [open,     setOpen]     = useState(false);

  const W2 = typeof W !== "undefined" ? W
    : {bg:"#242424",bg2:"#1c1c1c",bg3:"#2a2a2a",fg:"#e3e0d7",
       fgMuted:"#857b6f",fgDim:"#a0a8b0",blue:"#8ac6f2",comment:"#9fca56",
       orange:"#e5786d",yellow:"#eae788",splitBg:"#3a3a3a",statusFg:"#ffffd7"};

  const load = () =>
    fetch("/api/mail/oauth-status").then(r=>r.json()).then(d=>{
      setStatus(d);
      onLoaded && onLoaded({email:d.email, hasPw:d.connected});
    }).catch(()=>setStatus({connected:false, email:"", has_client:false}));

  useEffect(()=>{ load(); }, []);

  const saveClient = async () => {
    if (!clientId.trim()) return;
    if (!clientSec.trim() && !status.has_client) return;
    setSaving(true); setMsg("");
    try {
      const body = {client_id: clientId.trim()};
      if (clientSec.trim()) body.client_secret = clientSec.trim();
      const r = await fetch("/api/mail/oauth-save-client", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.ok) {
        // Meteen has_client updaten zodat knop oplicht
        setStatus(s => ({...s, has_client: true}));
        setMsg("✓ Opgeslagen — klik nu op 'Verbinden met Google'");
        setClientSec(""); // wis wachtwoordveld
        await load();
      } else {
        setMsg("✗ " + (d.error||"mislukt"));
      }
    } catch(e) { setMsg("✗ " + e.message); }
    setSaving(false);
  };

  const startOAuth = async () => {
    setMsg("");
    try {
      const r = await fetch("/api/mail/oauth-start");
      const d = await r.json();
      if (d.error) { setMsg("✗ " + d.error); setOpen(true); return; }
      const popup = window.open(d.auth_url, "gmail_oauth",
        "width=540,height=660,left=200,top=80,menubar=no,toolbar=no");
      if (!popup) { setMsg("✗ Popup geblokkeerd — sta popups toe voor deze pagina"); return; }
      const timer = setInterval(async () => {
        if (popup.closed) {
          clearInterval(timer);
          await load();
        }
      }, 600);
    } catch(e) { setMsg("✗ " + e.message); }
  };

  const disconnect = async () => {
    await fetch("/api/mail/oauth-disconnect", {method:"POST"});
    await load();
  };

  // Nog laden
  if (!status) return React.createElement("div",{style:{
    padding:"8px 14px", fontSize:"12px", color:W2.fgDim,
    background:W2.bg2, borderBottom:`1px solid ${W2.splitBg}`, flexShrink:0,
  }}, "Gmail-status laden…");

  return React.createElement("div",{style:{
    background:W2.bg2, borderBottom:`1px solid ${W2.splitBg}`, flexShrink:0,
  }},

    // ── Altijd zichtbare balk ────────────────────────────────────────────────
    React.createElement("div",{style:{
      padding:"8px 14px", display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap",
    }},

      // Status tekst
      React.createElement("span",{style:{
        fontSize:"12px", fontWeight:"600",
        color: status.connected ? W2.comment : W2.orange,
      }},
        status.connected ? "● Verbonden — " + status.email : "● Niet verbonden met Gmail"
      ),

      React.createElement("div",{style:{flex:1}}),

      // ALTIJD: "Verbinden met Google" knop (prominentst als niet verbonden)
      !status.connected && React.createElement("button",{
        onClick: status.has_client ? startOAuth : ()=>setOpen(o=>!o),
        style:{
          background:"rgba(138,198,242,0.18)",
          border:`2px solid ${W2.blue}`,
          color:W2.blue, borderRadius:"6px",
          padding:"5px 16px", fontSize:"13px",
          cursor:"pointer", fontWeight:"700",
          display:"flex", alignItems:"center", gap:"6px",
        }
      },
        React.createElement("span",{style:{fontSize:"16px"}},"G"),
        status.has_client ? "Verbinden met Google" : "Instellen & Verbinden"
      ),

      // Als verbonden: herverbinden + disconnect
      status.connected && React.createElement("button",{
        onClick: startOAuth,
        style:{background:"none",border:`1px solid ${W2.splitBg}`,
               color:W2.fgMuted,borderRadius:"4px",
               padding:"4px 11px",fontSize:"12px",cursor:"pointer"}
      },"↻ Ander account"),

      status.connected && React.createElement("button",{
        onClick: disconnect,
        style:{background:"none",border:"none",color:W2.fgMuted,
               fontSize:"13px",cursor:"pointer",padding:"4px 6px"}
      },"✕ Verbreken"),

      // Instellingen toggle
      React.createElement("button",{
        onClick:()=>setOpen(o=>!o),
        style:{background:"none",border:`1px solid ${W2.splitBg}`,
               color:W2.fgMuted,borderRadius:"4px",
               padding:"4px 10px",fontSize:"12px",cursor:"pointer"}
      }, open ? "▲" : "⚙"),
    ),

    // Fout/succes melding
    msg && React.createElement("div",{style:{
      padding:"5px 14px 0", fontSize:"12px",
      color: msg.startsWith("✓") ? W2.comment : W2.orange,
    }}, msg),

    // ── Uitklapbare setup ─────────────────────────────────────────────────────
    open && React.createElement("div",{style:{
      borderTop:`1px solid ${W2.splitBg}`,
      padding:"12px 14px 14px",
      display:"flex", flexDirection:"column", gap:"10px",
    }},

      // Uitleg
      React.createElement("div",{style:{
        fontSize:"12px", color:W2.fgMuted, lineHeight:"1.8",
        padding:"10px 12px",
        background:"rgba(138,198,242,0.05)",
        border:`1px solid rgba(138,198,242,0.15)`,
        borderRadius:"6px",
      }},
        React.createElement("strong",{style:{color:W2.blue,display:"block",marginBottom:"6px"}},
          "Eenmalige instelling — Google Cloud Console"),
        React.createElement("ol",{style:{margin:0,paddingLeft:"16px",display:"flex",flexDirection:"column",gap:"3px"}},
          React.createElement("li",null,"Ga naar ",
            React.createElement("a",{href:"https://console.cloud.google.com/apis/credentials",
              target:"_blank",style:{color:W2.blue}},
              "console.cloud.google.com/apis/credentials")),
          React.createElement("li",null,"Nieuw project of bestaand selecteren"),
          React.createElement("li",null,"Activeer de ",
            React.createElement("a",{
              href:"https://console.cloud.google.com/apis/library/gmail.googleapis.com",
              target:"_blank",style:{color:W2.blue}},"Gmail API")),
          React.createElement("li",null,"Maak OAuth 2.0 Client ID → type: Webapplicatie"),
          React.createElement("li",null,
            "Redirect-URI toevoegen: ",
            React.createElement("code",{style:{
              background:"rgba(0,0,0,0.35)",padding:"2px 7px",borderRadius:"3px",
              fontSize:"11px",color:W2.yellow,userSelect:"all",
            }},"http://localhost:8899/api/mail/oauth-callback")),
          React.createElement("li",null,"Client ID en Secret hieronder plakken → Opslaan")
        )
      ),

      // Invoervelden
      React.createElement("div",{style:{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"flex-start"}},
        React.createElement("input",{
          value:clientId, onChange:e=>setClientId(e.target.value),
          placeholder:"Client ID  (xxxx.apps.googleusercontent.com)",
          style:{flex:3,minWidth:"260px",background:W2.bg3,
                 border:`1px solid ${W2.splitBg}`,borderRadius:"4px",
                 color:W2.fg,padding:"7px 10px",fontSize:"12px",outline:"none"}
        }),
        React.createElement("input",{
          value:clientSec, onChange:e=>setClientSec(e.target.value),
          placeholder: status.has_client ? "●●●● (opgeslagen — laat leeg om te behouden)" : "Client Secret",
          type:"password",
          style:{flex:2,minWidth:"180px",background:W2.bg3,
                 border:`1px solid ${W2.splitBg}`,borderRadius:"4px",
                 color:W2.fg,padding:"7px 10px",fontSize:"12px",outline:"none"}
        }),
        React.createElement("button",{
          onClick:saveClient,
          disabled:saving||!clientId.trim()||(!clientSec.trim()&&!status.has_client),
          style:{
            background:"rgba(138,198,242,0.15)",
            border:`1px solid ${W2.blue}`,
            color:W2.blue,borderRadius:"5px",
            padding:"7px 16px",fontSize:"13px",
            cursor:"pointer",fontWeight:"600",whiteSpace:"nowrap",
            opacity:(saving||!clientId.trim()||(!clientSec.trim()&&!status.has_client))?0.4:1,
          }
        }, saving ? "Opslaan…" : "Opslaan")
      ),

      // Verbinden-knop (groot, altijd zichtbaar in setup)
      React.createElement("button",{
        onClick:()=>{ setOpen(false); startOAuth(); },
        disabled:!status.has_client,
        style:{
          background: status.has_client
            ? "rgba(159,202,86,0.18)"
            : "rgba(255,255,255,0.04)",
          border:`2px solid ${status.has_client?"rgba(159,202,86,0.5)":W2.splitBg}`,
          color: status.has_client ? W2.comment : W2.fgMuted,
          borderRadius:"6px", padding:"8px 22px",
          fontSize:"14px", cursor: status.has_client?"pointer":"default",
          fontWeight:"700", alignSelf:"flex-start",
          opacity: status.has_client ? 1 : 0.4,
        }
      },
        status.has_client
          ? "→ Verbinden met Google"
          : "Sla eerst Client ID en Secret op"
      )
    )
  );
};
