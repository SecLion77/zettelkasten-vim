// ── ImagesGallery ────────────────────────────────────────────────────────────
// Deps: W, api, genId, renderMd

const ImagesGallery = ({serverImages, onRefresh, llmModel, onAddNote, setAiStatus,
                        notes, onDeleteNote, imgNotes, setImgNotes, allTags,
                        addJob, updateJob, onPasteToNote=null}) => {
  const { useState, useRef, useCallback, useEffect, useMemo } = React;

  const [busy,          setBusy]         = useState(null);
  const [descriptions,  setDescs]        = useState({});
  const [lightbox,      setLightbox]     = useState(null);
  const [imgView,       setImgView]      = useState("grid"); // "grid" | "list"
  const [dragOver,      setDragOver]     = useState(false);
  const [descFilter,    setDescFilter]   = useState("");  // zoek in beschrijvingen
  const [ageFilter,     setAgeFilter]    = useState("alle"); // "alle"|"week"|"maand"|"jaar"
  const [orphanFilter,  setOrphanFilter] = useState(false);  // geen notitie-link
  const [noDescFilter,  setNoDescFilter] = useState(false);  // geen beschrijving
  const [cleanupMsg,    setCleanupMsg]   = useState("");
  const [selected,      setSelected]     = useState(new Set()); // voor bulk-delete
  const galleryRef = React.useRef(null);
  const toolbarRef  = React.useRef(null);

  // Annotatie state — identiek aan PDF
  const [annotations,   setAnnotations]  = useState(imgNotes||[]);
  const [activeImg,     setActiveImg]    = useState(null);    // fname van geselecteerde afbeelding
  const [pendingPin,    setPendingPin]   = useState(null);    // {x,y} fractie van afbeelding
  const [quickNote,     setQuickNote]    = useState("");
  const [quickTags,     setQuickTags]    = useState([]);
  const [activeColor,   setActiveColor]  = useState(HCOLORS[0]);
  const [editingId,     setEditingId]    = useState(null);
  const [showAnnotPanel,setShowAnnotPanel] = useState(true);
  const [filterTag,     setFilterTag]   = useState(null);

  const fileRef   = useRef(null);
  const imgRef    = useRef(null);   // ref naar actieve afbeelding in annotatiemodus

  // Sync imgNotes → lokale state + herstel descriptions
  useEffect(() => {
    const imgAnnots = imgNotes||[];
    setAnnotations(imgAnnots);
    const descMap = {};
    // Primair: uit img-annotations (meest betrouwbaar)
    imgAnnots.forEach(n => { if (n.file && n.description) descMap[n.file] = n.description; });
    setDescs(p => ({...p, ...descMap}));
  }, [imgNotes]);

  // Fallback: haal beschrijvingen uit notities (voor afbeeldingen via WebImporter)
  // Pakt de LANGSTE beschrijving als er meerdere notities voor dezelfde afbeelding zijn
  useEffect(() => {
    if (!notes?.length) return;
    const descMap = {};  // fname → langste beschrijving gevonden
    notes.forEach(n => {
      // Alle img-referenties in deze notitie ophalen
      const imgMatches = [...(n.content || "").matchAll(/!\[\[img:([^\]]+)\]\]/g)];
      imgMatches.forEach(imgMatch => {
        const fname = imgMatch[1];
        const content = n.content || "";
        const descIdx = content.indexOf("## Beschrijving");
        if (descIdx < 0) return;
        const afterHeader = content.slice(descIdx + 15).replace(/^\s+/, "");
        const endIdx = afterHeader.search(/\n##|\n---|\n\[\[/);
        const desc = (endIdx >= 0 ? afterHeader.slice(0, endIdx) : afterHeader).trim();
        // Bewaar de langste beschrijving (meest gedetailleerd)
        if (desc && desc.length > 5) {
          if (!descMap[fname] || desc.length > descMap[fname].length) {
            descMap[fname] = desc;
          }
        }
      });
    });
    if (Object.keys(descMap).length > 0) {
      setDescs(p => ({...p, ...descMap}));
      // Synchroniseer: schrijf ontbrekende beschrijvingen terug naar img-annotations
      // zodat ze de volgende keer direct zichtbaar zijn (zonder notes-scan nodig)
      const currentAnnots = annotations || [];
      const missing = Object.entries(descMap).filter(([fname, desc]) =>
        !currentAnnots.some(a => a.file === fname && a.description)
      );
      if (missing.length > 0) {
        const updated = [...currentAnnots];
        missing.forEach(([fname, desc]) => {
          const idx = updated.findIndex(a => a.file === fname && !a.x);
          if (idx >= 0) {
            updated[idx] = { ...updated[idx], description: desc };
          } else {
            updated.push({ file: fname, description: desc, pins: [] });
          }
        });
        api.saveImgAnnotations(updated).catch(() => {});
        setImgNotes?.([...updated]);
      }
    }
  }, [notes]);

  const saveAnnotations = useCallback(async (updated) => {
    setAnnotations(updated);
    setImgNotes?.(updated);
    await api.saveImgAnnotations(updated);
  }, [setImgNotes]);

  const addAnnotation = useCallback(async () => {
    if (!pendingPin || !activeImg) return;
    const a = {
      id:      genId(),
      text:    quickNote || "(pin)",
      note:    quickNote,
      tags:    quickTags,
      file:    activeImg,
      x:       pendingPin.x,   // fractie 0–1
      y:       pendingPin.y,
      colorId: activeColor.id,
      created: new Date().toISOString(),
    };
    await saveAnnotations([...annotations, a]);
    setPendingPin(null); setQuickNote(""); setQuickTags([]);
  }, [pendingPin, activeImg, quickNote, quickTags, activeColor, annotations, saveAnnotations]);

  const updateAnnotation = useCallback(async (id, patch) => {
    await saveAnnotations(annotations.map(a => a.id===id ? {...a,...patch} : a));
  }, [annotations, saveAnnotations]);

  const removeAnnotation = useCallback(async (id) => {
    await saveAnnotations(annotations.filter(a => a.id!==id));
    if (editingId===id) setEditingId(null);
  }, [annotations, saveAnnotations, editingId]);

  // Annotaties voor de actieve afbeelding
  const fileAnnots = useMemo(() =>
    activeImg ? annotations.filter(a => a.file===activeImg) : [],
  [annotations, activeImg]);

  const allAnnotTags = useMemo(() =>
    [...new Set(fileAnnots.flatMap(a => a.tags||[]))],
  [fileAnnots]);

  const panelAnnots = (filterTag
    ? fileAnnots.filter(a => (a.tags||[]).includes(filterTag))
    : fileAnnots
  ).sort((a,b) => new Date(a.created) - new Date(b.created));

  // Klik op afbeelding in annotatiemodus → pin plaatsen
  const handleImgClick = useCallback((e) => {
    if (!activeImg) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top)  / rect.height;
    setPendingPin({x, y});
    setQuickNote(""); setQuickTags([]);
    setShowAnnotPanel(true);  // sidebar altijd zichtbaar bij nieuwe pin
  }, [activeImg]);

  const upload = useCallback((files) => {
    const imgFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!imgFiles.length) return;
    // Alle bestanden parallel uploaden + beschrijven
    imgFiles.forEach(f => {
      const jid = genId();
      const shortName = f.name.slice(0, 26);
      addJob && addJob({id: jid, type: "upload", label: "📤 Uploaden: " + shortName});
      setBusy(f.name);
      (async () => {
        try {
          const res = await api.uploadImage(f);
          if (res?.name) {
            await onRefresh();
            updateJob && updateJob(jid, {status: "done", result: "Geüpload → beschrijven…"});
            describeImage(res.name);
          } else {
            updateJob && updateJob(jid, {status: "error", error: "Upload mislukt"});
          }
        } catch(e) {
          console.error("upload:", e);
          updateJob && updateJob(jid, {status: "error", error: e.message});
        } finally {
          setBusy(null);
        }
      })();
    });
  }, [onRefresh, addJob, updateJob]);

  const describeImage = useCallback((fname) => {
    setBusy(fname);
    const stem = fname.replace(/\.[^.]+$/,"");
    const jid = genId();
    const ctrl = new AbortController();
    addJob && addJob({id:jid, type:"describe", label:"🖼 Beschrijven: "+stem.slice(0,26)+"…", controller:ctrl});
    // Achtergrond — UI blijft vrij
    (async () => {
      try {
        const model = llmModel || "llama3.2-vision";
        const res   = await api.llmDescribeImage(fname, model, ctrl.signal);
        if (res?.description) {
          // Sla beschrijving op in setDescs (live UI)
          setDescs(p=>({...p, [fname]: res.description}));
          // Sla ook op in imgNotes voor persistentie + badge na herlaad
          const current = await api.getImgAnnotations();
          const updated = (current||[]).filter(a=>!(a.file===fname && !a.x));
          updated.push({file:fname, description:res.description});
          await api.saveImgAnnotations(updated);
          setImgNotes?.([...updated]);
          // Maak notitie aan
          if (onAddNote) {
            await onAddNote({
              id: genId(), title: "Afbeelding — "+stem,
              content: "![[img:"+fname+"]]\n\n## Beschrijving\n\n"+res.description,
              tags: ["afbeelding","media"],
              created: new Date().toISOString(), modified: new Date().toISOString(),
            });
          }
          updateJob && updateJob(jid,{status:"done", result:"Opgeslagen als notitie"});
        } else {
          setDescs(p=>({...p, [fname]: "⚠ Beschrijving niet beschikbaar (ollama pull llama3.2-vision)"}));
          updateJob && updateJob(jid,{status:"error", error:"Geen beschrijving ontvangen"});
        }
      } catch(e) {
        if (e.name === "AbortError") {
          updateJob && updateJob(jid,{status:"error", error:"Geannuleerd"});
        } else {
          setDescs(p=>({...p, [fname]: "⚠ "+e.message}));
          updateJob && updateJob(jid,{status:"error", error:e.message});
        }
      } finally { setBusy(null); }
    })();
  }, [llmModel, onAddNote, addJob, updateJob, setImgNotes]);

  const deleteImg = useCallback(async (fname) => {
    const linked = (notes||[]).filter(n =>
      n.content?.includes(`![[img:${fname}]]`) ||
      n.title?.includes(fname.replace(/\.[^.]+$/,""))
    );
    const imgAnnotCount = annotations.filter(a => a.file===fname).length;
    const parts = [];
    if (linked.length) parts.push(`${linked.length} notitie(s):\n`+linked.map(n=>"• "+n.title).join("\n"));
    if (imgAnnotCount) parts.push(`${imgAnnotCount} annotatie(s)`);
    const msg = parts.length
      ? `Verwijder "${fname}" én:\n${parts.join("\n")}?`
      : `Verwijder "${fname}"?`;
    if (!confirm(msg)) return;
    await api.deleteImage(fname);
    for (const n of linked) { await api.del("/notes/"+n.id); onDeleteNote?.(n.id); }
    // Verwijder ook annotaties van dit bestand
    if (imgAnnotCount) await saveAnnotations(annotations.filter(a => a.file!==fname));
    setDescs(p=>{ const q={...p}; delete q[fname]; return q; });
    if (activeImg===fname) setActiveImg(null);
    await onRefresh();
  }, [onRefresh, notes, onDeleteNote, annotations, saveAnnotations, activeImg]);

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); };

  // Filter logica
  const imgs = (serverImages || []).filter(img => {
    // Tekstzoek op naam of beschrijving
    if (descFilter.trim()) {
      const q = descFilter.toLowerCase();
      const desc = descriptions[img.name] || "";
      if (!img.name.toLowerCase().includes(q) && !desc.toLowerCase().includes(q)) return false;
    }
    // Ouderdomsfilter — gebruik modified datum van serverImage of naam-timestamp
    if (ageFilter !== "alle") {
      const now = Date.now();
      const limits = { week: 7, maand: 30, jaar: 365 };
      const days = limits[ageFilter] || 9999;
      const cutoff = now - days * 86400000;
      // Probeer datum uit img.modified of uit naam (bijv. timestamp prefix)
      const ts = img.modified ? new Date(img.modified).getTime()
               : (parseInt(img.name) > 1e12 ? parseInt(img.name) : null);
      if (ts && ts < cutoff) return false;
    }
    // Wees-filter: geen notitie die naar dit plaatje linkt of het bevat
    if (orphanFilter) {
      const allNotes = notes || [];
      const linked = allNotes.some(n =>
        (n.content || "").includes("img:" + img.name) ||
        (n.content || "").includes(img.name)
      );
      if (linked) return false;
    }
    // Geen-beschrijving filter
    if (noDescFilter) {
      const desc = descriptions[img.name] || "";
      const annotDesc = annotations.find(a => a.file === img.name)?.description || "";
      if (desc || annotDesc) return false;
    }
    return true;
  });

  return React.createElement("div", {
    style:{display:"flex",flex:1,minHeight:0,overflow:"hidden"}
  },

    // ── Hoofdkolom: toolbar + galerij ────────────────────────────────────────
    React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0,minHeight:0}},

      // Toolbar
      React.createElement("div",{
        ref: toolbarRef,
        style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,
               padding:"8px 14px",display:"flex",alignItems:"center",
               gap:"10px",flexShrink:0,flexWrap:"wrap"}
      },
        React.createElement("span",{style:{fontSize:"14px",color:W.statusFg,
          letterSpacing:"1.5px",fontWeight:"bold"}},"AFBEELDINGEN"),
        React.createElement("span",{style:{background:W.blue,color:W.bg,
          borderRadius:"10px",padding:"0 7px",fontSize:"14px"}}, imgs.length),
        React.createElement("div",{style:{flex:1}}),
        // Zoekbalk
        React.createElement("input",{
          value: descFilter,
          onChange: e => setDescFilter(e.target.value),
          placeholder: "zoek naam of beschrijving…",
          style:{background:W.bg3,border:`1px solid ${descFilter?W.blue:W.splitBg}`,
                 borderRadius:"5px",color:W.fg,padding:"4px 10px",fontSize:"13px",
                 width:"160px",outline:"none"}
        }),

        // Ouderdomsfilter
        React.createElement("select",{
          value: ageFilter,
          onChange: e => setAgeFilter(e.target.value),
          title: "Filter op importdatum",
          style:{background:W.bg3,border:`1px solid ${ageFilter!=="alle"?W.blue:W.splitBg}`,
                 borderRadius:"5px",color:ageFilter!=="alle"?W.blue:W.fgMuted,
                 padding:"4px 8px",fontSize:"12px",outline:"none",cursor:"pointer"}
        },
          React.createElement("option",{value:"alle"},"📅 alle"),
          React.createElement("option",{value:"week"},"📅 < 1 week"),
          React.createElement("option",{value:"maand"},"📅 < 1 maand"),
          React.createElement("option",{value:"jaar"},"📅 < 1 jaar"),
        ),

        // Filter: geen notitie-link
        React.createElement("button",{
          onClick: () => { setOrphanFilter(p=>!p); setSelected(new Set()); },
          title: "Toon alleen afbeeldingen zonder link naar een notitie",
          style:{background:orphanFilter?"rgba(229,120,109,0.15)":"rgba(255,255,255,0.04)",
                 color:orphanFilter?W.orange:W.fgMuted,
                 border:`1px solid ${orphanFilter?"rgba(229,120,109,0.4)":W.splitBg}`,
                 borderRadius:"5px",padding:"4px 10px",fontSize:"12px",cursor:"pointer",
                 fontWeight:orphanFilter?"600":"400",whiteSpace:"nowrap"}
        }, orphanFilter?"⚠ geen notitie ×":"geen notitie"),

        // Filter: geen beschrijving
        React.createElement("button",{
          onClick: () => { setNoDescFilter(p=>!p); setSelected(new Set()); },
          title: "Toon alleen afbeeldingen zonder AI-beschrijving",
          style:{background:noDescFilter?"rgba(234,231,136,0.15)":"rgba(255,255,255,0.04)",
                 color:noDescFilter?W.yellow:W.fgMuted,
                 border:`1px solid ${noDescFilter?"rgba(234,231,136,0.4)":W.splitBg}`,
                 borderRadius:"5px",padding:"4px 10px",fontSize:"12px",cursor:"pointer",
                 fontWeight:noDescFilter?"600":"400",whiteSpace:"nowrap"}
        }, noDescFilter?"⚠ geen beschrijving ×":"geen beschrijving"),

        // Selecteer alle zichtbare afbeeldingen
        imgs.length > 0 && React.createElement("button",{
          onClick: () => {
            if (selected.size === imgs.length) setSelected(new Set());
            else setSelected(new Set(imgs.map(i=>i.name)));
          },
          style:{background:"rgba(255,255,255,0.04)",color:W.fgMuted,
                 border:`1px solid ${W.splitBg}`,borderRadius:"5px",
                 padding:"4px 10px",fontSize:"12px",cursor:"pointer",whiteSpace:"nowrap"}
        }, selected.size===imgs.length && imgs.length>0 ? "☑ deselecteer":"☐ selecteer alle"),

        // Bulk-delete
        selected.size > 0 && React.createElement("button",{
          onClick: async () => {
            const n = selected.size;
            if (!confirm(`${n} afbeelding${n>1?"en":""} permanent verwijderen?`)) return;
            for (const fname of selected) {
              try { await fetch("/api/images/"+encodeURIComponent(fname),{method:"DELETE"}); }
              catch(e) {}
            }
            setSelected(new Set());
            setCleanupMsg("✓ "+n+" verwijderd");
            setTimeout(()=>setCleanupMsg(""),3000);
            await onRefresh();
          },
          style:{background:"rgba(229,120,109,0.15)",color:W.orange,
                 border:"1px solid rgba(229,120,109,0.4)",borderRadius:"5px",
                 padding:"4px 10px",fontSize:"12px",cursor:"pointer",fontWeight:"600",
                 whiteSpace:"nowrap"}
        }, "🗑 "+selected.size+" verwijderen"),

        cleanupMsg && React.createElement("span",{
          style:{fontSize:"12px",color:W.comment,whiteSpace:"nowrap"}
        }, cleanupMsg),

        React.createElement("div",{style:{flex:1}}),
        // Weergave-toggle: grid / lijst
        React.createElement("div",{style:{display:"flex",borderRadius:"6px",overflow:"hidden",border:`1px solid ${W.splitBg}`,flexShrink:0}},
          ...[["grid","⊞"],["list","☰"]].map(([mode,icon])=>
            React.createElement("button",{
              key:mode,
              onClick:()=>setImgView(mode),
              title:mode==="grid"?"Rasterweergave":"Lijstweergave",
              style:{background:imgView===mode?"rgba(138,198,242,0.15)":"transparent",
                     color:imgView===mode?W.blue:W.fgMuted,
                     border:"none",padding:"4px 10px",cursor:"pointer",
                     fontSize:"13px",transition:"all 0.12s"}
            },icon)
          )
        ),
        React.createElement("button",{
          onClick:()=>fileRef.current?.click(),
          style:{background:W.blue,color:W.bg,border:"none",borderRadius:"6px",
                 padding:"6px 14px",fontSize:"14px",cursor:"pointer",fontWeight:"bold"}
        },"+ upload"),
        React.createElement("input",{
          ref:fileRef, type:"file", multiple:true, accept:"image/*",
          style:{display:"none"},
          onChange:e=>{ upload(e.target.files); e.target.value=""; }
        })
      ),

      // Galerij / annotatie-view
      React.createElement("div",{
        ref: galleryRef,
        style:{flex:1, overflowY:"auto", padding:"16px", minHeight:0,
               background: dragOver?"rgba(138,198,242,0.05)":W.bg,
               WebkitOverflowScrolling:"touch"},
        onDragOver:e=>{ e.preventDefault(); setDragOver(true); },
        onDragLeave:()=>setDragOver(false),
        onDrop,
      },

        // Lege staat
        imgs.length===0 && React.createElement("div",{
          style:{display:"flex",flexDirection:"column",alignItems:"center",
                 justifyContent:"center",height:"60%",gap:"14px",color:W.fgMuted,
                 border:`2px dashed ${dragOver?"rgba(138,198,242,0.5)":W.splitBg}`,
                 borderRadius:"12px",margin:"20px",padding:"40px"}
        },
          React.createElement("div",{style:{fontSize:"48px"}},"🖼"),
          React.createElement("div",{style:{fontSize:"15px",color:W.fgDim}},"Nog geen afbeeldingen"),
          React.createElement("div",{style:{fontSize:"14px",textAlign:"center",lineHeight:"1.7"}},
            "Sleep afbeeldingen hierheen of klik '+ upload'.\n",
            React.createElement("br"),
            "De AI maakt automatisch een beschrijving en een notitie aan."
          ),
          React.createElement("button",{
            onClick:()=>fileRef.current?.click(),
            style:{marginTop:"8px",background:"rgba(138,198,242,0.1)",
                   border:"1px solid rgba(138,198,242,0.3)",color:"#a8d8f0",
                   borderRadius:"8px",padding:"10px 24px",fontSize:"14px",cursor:"pointer"}
          },"+ afbeelding kiezen")
        ),

        // Annotatiemodus: grote weergave met klikbare afbeelding + pinnen
        activeImg && React.createElement("div",{style:{position:"relative",display:"inline-block",maxWidth:"100%"}},
          React.createElement("img",{
            ref:imgRef,
            src:"/api/image/"+encodeURIComponent(activeImg),
            alt:activeImg,
            onClick:handleImgClick,
            style:{maxWidth:"100%",maxHeight:"calc(100vh - 140px)",objectFit:"contain",
                   display:"block",cursor:"crosshair",borderRadius:"6px",
                   boxShadow:"0 4px 24px rgba(0,0,0,0.5)",
                   border:`2px solid ${W.splitBg}`}
          }),

          // Bestaande pins
          ...fileAnnots.map(a => {
            const col = HCOLORS.find(c=>c.id===a.colorId)||HCOLORS[0];
            const isEditing = editingId===a.id;
            return React.createElement("div",{
              key:a.id,
              onClick:e=>{ e.stopPropagation(); setEditingId(isEditing?null:a.id); setPendingPin(null); },
              style:{position:"absolute",
                     left:`calc(${a.x*100}% - 10px)`,
                     top:`calc(${a.y*100}% - 20px)`,
                     zIndex: isEditing ? 20 : 10,
                     cursor:"pointer"}
            },
              // Pin symbool
              React.createElement("div",{style:{
                width:"20px",height:"20px",borderRadius:"50% 50% 50% 0",
                background:col.border,border:"2px solid white",
                transform:"rotate(-45deg)",
                boxShadow:`0 2px 8px rgba(0,0,0,0.6)`,
                transition:"transform 0.1s",
              }}),
              // Tooltip / edit popup boven de pin
              isEditing && React.createElement("div",{
                onClick:e=>e.stopPropagation(),
                style:{position:"absolute",bottom:"28px",left:"-160px",
                       width:"300px",background:W.bg3,
                       border:`2px solid ${col.border}`,borderRadius:"8px",
                       padding:"12px 14px",zIndex:500,
                       boxShadow:"0 8px 32px rgba(0,0,0,0.8)"}
              },
                // Notitietekst
                React.createElement("div",{style:{fontSize:"14px",color:W.fgDim,
                  marginBottom:"8px",padding:"6px 8px",background:col.bg,
                  borderRadius:"4px",fontStyle:"italic",lineHeight:"1.5",
                  borderLeft:`4px solid ${col.border}`}},
                  a.note||"(geen notitie)"),
                // Notitie bewerken
                React.createElement("textarea",{
                  value:a.note||"",
                  onChange:e=>updateAnnotation(a.id,{note:e.target.value}),
                  onKeyDown:e=>{ if(e.key==="Escape") setEditingId(null); },
                  rows:2,
                  placeholder:"Notitie…",
                  style:{width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,
                         borderRadius:"4px",padding:"6px 8px",color:W.fg,
                         fontSize:"14px",outline:"none",resize:"none",marginBottom:"6px"}
                }),
                // Tags
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
                  marginBottom:"4px",letterSpacing:"1px"}},"TAGS"),
                React.createElement(SmartTagEditor,{tags:a.tags||[],
                  onChange:tags=>updateAnnotation(a.id,{tags}),
                  allTags:[...(allTags||[]),...allAnnotTags]}),
                // Kleur
                React.createElement("div",{style:{display:"flex",gap:"5px",margin:"8px 0"}},
                  ...HCOLORS.map(c=>React.createElement("button",{key:c.id,
                    onClick:()=>updateAnnotation(a.id,{colorId:c.id}),
                    style:{width:"18px",height:"18px",borderRadius:"3px",background:c.bg,
                           border:`2px solid ${a.colorId===c.id?c.border:W.splitBg}`,
                           cursor:"pointer",padding:0}}))
                ),
                // Acties
                React.createElement("div",{style:{display:"flex",gap:"6px",marginTop:"4px"}},
                  React.createElement("button",{
                    onClick:()=>setEditingId(null),
                    style:{background:W.comment,color:W.bg,border:"none",borderRadius:"3px",
                           padding:"3px 10px",fontSize:"14px",cursor:"pointer",fontWeight:"bold"}
                  },"✓ klaar"),
                  React.createElement("button",{
                    onClick:()=>removeAnnotation(a.id),
                    style:{background:"none",color:W.orange,
                           border:`1px solid rgba(229,120,109,0.3)`,
                           borderRadius:"3px",padding:"3px 8px",fontSize:"14px",cursor:"pointer"}
                  },":del")
                )
              )
            );
          }),

          // Pending pin: visuele indicator op de afbeelding (invoer loopt via sidebar)
          pendingPin && React.createElement("div",{
            style:{position:"absolute",
                   left:`calc(${pendingPin.x*100}% - 10px)`,
                   top:`calc(${pendingPin.y*100}% - 20px)`,
                   zIndex:30, pointerEvents:"none"}
          },
            React.createElement("div",{style:{
              width:"20px",height:"20px",borderRadius:"50% 50% 50% 0",
              background:activeColor.border,border:"2px solid white",
              transform:"rotate(-45deg)",
              animation:"ai-pulse 0.8s ease-in-out infinite",
            }})
          )
        ),

        // Galerij grid of lijst (als geen activeImg)
        !activeImg && imgs.length > 0 && (imgView === "grid"

          // ── RASTERWEERGAVE ──────────────────────────────────────────────
          ? React.createElement("div", {
              style: { display: "grid",
                       gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
                       gap: "14px" }
            },
              imgs.map(img => {
                const desc       = descriptions[img.name];
                const isBusy     = busy === img.name;
                const annotCount = annotations.filter(a => a.file === img.name).length;
                const isSel      = selected.has(img.name);
                return React.createElement("div", {
                  key: img.name,
                  style: { background: W.bg2,
                           border: `2px solid ${isSel ? W.orange : isBusy ? "rgba(138,198,242,0.4)" : W.splitBg}`,
                           borderRadius: "8px", overflow: "hidden",
                           display: "flex", flexDirection: "column",
                           position: "relative", transition: "border-color 0.15s",
                           opacity: isSel ? 0.85 : 1 }
                },
                  // Selectie-checkbox overlay
                  React.createElement("div", {
                    onClick: e => { e.stopPropagation();
                      setSelected(p => { const n = new Set(p);
                        isSel ? n.delete(img.name) : n.add(img.name); return n; }); },
                    style: { position: "absolute", top: "6px", right: "6px", zIndex: 10,
                             width: "20px", height: "20px", borderRadius: "4px", cursor: "pointer",
                             background: isSel ? W.orange : "rgba(0,0,0,0.5)",
                             border: `2px solid ${isSel ? W.orange : "rgba(255,255,255,0.3)"}`,
                             display: "flex", alignItems: "center", justifyContent: "center",
                             fontSize: "12px", color: W.bg, fontWeight: "bold", flexShrink: 0 }
                  }, isSel ? "✓" : ""),
                  // Thumbnail
                  React.createElement("div", {
                    style: { position: "relative", paddingTop: "65%", background: W.bg, cursor: "pointer" },
                    onClick: () => setLightbox(img.name)
                  },
                    React.createElement("img", {
                      src: "/api/image/" + encodeURIComponent(img.name),
                      alt: img.name, loading: "lazy",
                      style: { position: "absolute", inset: 0, width: "100%", height: "100%",
                               objectFit: "contain", padding: "4px" }
                    }),
                    isBusy && React.createElement("div", {
                      style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)",
                               display: "flex", alignItems: "center", justifyContent: "center",
                               color: "#a8d8f0", fontSize: "14px", gap: "6px" }
                    }, "⏳ AI verwerkt…"),
                    React.createElement("div", {
                      style: { position: "absolute", top: "6px", left: "6px",
                               background: desc ? "rgba(159,202,86,0.88)" : "rgba(80,80,90,0.75)",
                               color: "white", borderRadius: "10px",
                               padding: "1px 8px", fontSize: "11px",
                               fontWeight: "600", backdropFilter: "blur(4px)" }
                    }, desc ? "✓ beschrijving" : "geen beschrijving")
                  ),
                  // Info
                  React.createElement("div", { style: { padding: "10px 12px", flex: 1,
                    display: "flex", flexDirection: "column", gap: "6px" }},
                    React.createElement("div", { style: { fontSize: "13px", color: W.fg,
                      fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: "nowrap" }}, img.name),
                    desc
                      ? React.createElement("div", { style: { fontSize: "13px", color: W.fgDim,
                          lineHeight: "1.5", flex: 1, display: "-webkit-box",
                          WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}, desc)
                      : React.createElement("button", {
                          onClick: () => describeImage(img.name), disabled: !!busy,
                          style: { background: "rgba(138,198,242,0.07)",
                                   border: "1px solid rgba(138,198,242,0.2)", color: "#a8d8f0",
                                   borderRadius: "4px", padding: "4px 10px", fontSize: "13px",
                                   cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1,
                                   textAlign: "left" }
                        }, "🧠 Beschrijving genereren"),
                    // Acties
                    React.createElement("div", { style: { display: "flex", gap: "5px", marginTop: "4px" }},
                      React.createElement("button", {
                        onClick: () => setLightbox(img.name), title: "Vergroot",
                        style: { flex: 1, background: "none", border: `1px solid ${W.splitBg}`,
                                 color: W.fgMuted, borderRadius: "4px", padding: "4px",
                                 fontSize: "14px", cursor: "pointer" }
                      }, "🔍"),
                      onAddNote && React.createElement("button", {
                        onClick: async () => {
                          const stem = img.name.replace(/\.[^.]+$/, "");
                          const existing = (notes || []).find(n =>
                            n.content?.includes(`![[img:${img.name}]]`) || n.title === "Afbeelding — " + stem);
                          if (existing) { await onAddNote({ _navigate: existing.id }); }
                          else { await onAddNote({ id: genId(), title: "Afbeelding — " + stem,
                            content: "![[img:" + img.name + "]]" + (desc ? "\n\n## Beschrijving\n\n" + desc : ""),
                            tags: ["afbeelding", "media"], created: new Date().toISOString(),
                            modified: new Date().toISOString() }); }
                        },
                        style: { flex: 2, background: desc ? "rgba(138,198,242,0.08)" : "rgba(138,198,242,0.04)",
                                 border: "1px solid rgba(138,198,242,0.2)", color: "#a8d8f0",
                                 borderRadius: "4px", padding: "4px", fontSize: "13px", cursor: "pointer" }
                      }, desc ? "📝 → notitie" : "📝 notitie"),
                      onPasteToNote && React.createElement("button", {
                        onClick: () => onPasteToNote({ text: desc ? `![[img:${img.name}]]\n\n${desc}` : `![[img:${img.name}]]`,
                          source: img.name, page: null, url: `/api/image/${encodeURIComponent(img.name)}` }),
                        title: "Plak in open notitie",
                        style: { flex: 1, background: "rgba(159,202,86,0.08)",
                                 border: "1px solid rgba(159,202,86,0.25)", color: W.comment,
                                 borderRadius: "4px", padding: "4px", fontSize: "14px", cursor: "pointer" }
                      }, "📋"),
                      React.createElement("button", {
                        onClick: () => deleteImg(img.name), title: "Verwijder afbeelding",
                        style: { background: "rgba(229,120,109,0.08)",
                                 border: "1px solid rgba(229,120,109,0.2)", color: W.orange,
                                 borderRadius: "4px", padding: "4px 8px", fontSize: "14px", cursor: "pointer" }
                      }, "🗑")
                    )
                  )
                );
              })
            )

          // ── LIJSTWEERGAVE ────────────────────────────────────────────────
          : React.createElement("div", { style: { padding: "4px 0" }},
              imgs.map(img => {
                const desc       = descriptions[img.name];
                const isBusy     = busy === img.name;
                const annotCount = annotations.filter(a => a.file === img.name).length;
                const isSel      = selected.has(img.name);
                const sizeKb     = img.size ? Math.round(img.size / 1024) : null;

                return React.createElement("div", {
                  key: img.name,
                  style: {
                    display: "flex", alignItems: "center", gap: "12px",
                    padding: "8px 16px",
                    borderBottom: `1px solid ${W.splitBg}`,
                    background: isSel ? "rgba(229,120,109,0.07)" : isBusy ? "rgba(138,198,242,0.04)" : "transparent",
                    transition: "background 0.1s",
                  },
                  onMouseEnter: e => { if (!isSel) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; },
                  onMouseLeave: e => { e.currentTarget.style.background = isSel ? "rgba(229,120,109,0.07)" : isBusy ? "rgba(138,198,242,0.04)" : "transparent"; },
                },
                  // Selectie checkbox
                  React.createElement("div", {
                    onClick: () => setSelected(p => { const n = new Set(p);
                      isSel ? n.delete(img.name) : n.add(img.name); return n; }),
                    style: { width: "18px", height: "18px", borderRadius: "4px", flexShrink: 0,
                             cursor: "pointer",
                             background: isSel ? W.orange : "transparent",
                             border: `2px solid ${isSel ? W.orange : W.splitBg}`,
                             display: "flex", alignItems: "center", justifyContent: "center",
                             fontSize: "11px", color: W.bg, fontWeight: "bold" }
                  }, isSel ? "✓" : ""),

                  // Mini thumbnail
                  React.createElement("div", {
                    onClick: () => setLightbox(img.name),
                    style: { width: "52px", height: "52px", flexShrink: 0,
                             borderRadius: "5px", overflow: "hidden",
                             border: `1px solid ${W.splitBg}`, cursor: "pointer",
                             background: W.bg2, position: "relative" }
                  },
                    React.createElement("img", {
                      src: "/api/image/" + encodeURIComponent(img.name),
                      alt: img.name, loading: "lazy",
                      style: { width: "100%", height: "100%", objectFit: "cover" }
                    }),
                    isBusy && React.createElement("div", { style: {
                      position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "16px" }}, "⏳")
                  ),

                  // Info
                  React.createElement("div", { style: { flex: 1, minWidth: 0 }},
                    React.createElement("div", { style: {
                      fontSize: "13px", fontWeight: "500", color: W.fg,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}, img.name),
                    React.createElement("div", { style: {
                      display: "flex", gap: "8px", marginTop: "3px",
                      fontSize: "11px", color: W.fgMuted, flexWrap: "wrap", alignItems: "center",
                    }},
                      desc
                        ? React.createElement("span", { style: {
                            color: W.comment, background: "rgba(159,202,86,0.1)",
                            borderRadius: "4px", padding: "0 5px" }}, "✓ beschrijving")
                        : React.createElement("span", { style: { color: W.fgDim }}, "geen beschrijving"),
                      annotCount > 0 && React.createElement("span", null,
                        `${annotCount} pin${annotCount !== 1 ? "s" : ""}`),
                      sizeKb && React.createElement("span", null,
                        sizeKb > 1024 ? `${(sizeKb/1024).toFixed(1)} MB` : `${sizeKb} KB`)
                    ),
                    desc && React.createElement("div", { style: {
                      fontSize: "12px", color: W.fgDim, marginTop: "3px",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}, desc)
                  ),

                  // Acties
                  React.createElement("div", { style: { display: "flex", gap: "5px", flexShrink: 0 }},
                    React.createElement("button", {
                      onClick: () => setLightbox(img.name), title: "Vergroot",
                      style: { background: "none", border: `1px solid ${W.splitBg}`,
                               color: W.fgMuted, borderRadius: "4px", padding: "4px 8px",
                               fontSize: "13px", cursor: "pointer" }
                    }, "🔍"),
                    !desc && React.createElement("button", {
                      onClick: () => describeImage(img.name), disabled: !!busy,
                      title: "Genereer AI-beschrijving",
                      style: { background: "rgba(138,198,242,0.07)", border: "1px solid rgba(138,198,242,0.2)",
                               color: "#a8d8f0", borderRadius: "4px", padding: "4px 8px",
                               fontSize: "12px", cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1 }
                    }, "🧠"),
                    onAddNote && React.createElement("button", {
                      onClick: async () => {
                        const stem = img.name.replace(/\.[^.]+$/, "");
                        const existing = (notes || []).find(n =>
                          n.content?.includes(`![[img:${img.name}]]`) || n.title === "Afbeelding — " + stem);
                        if (existing) { await onAddNote({ _navigate: existing.id }); }
                        else { await onAddNote({ id: genId(), title: "Afbeelding — " + stem,
                          content: "![[img:" + img.name + "]]" + (desc ? "\n\n## Beschrijving\n\n" + desc : ""),
                          tags: ["afbeelding", "media"], created: new Date().toISOString(),
                          modified: new Date().toISOString() }); }
                      },
                      style: { background: "rgba(138,198,242,0.08)", border: "1px solid rgba(138,198,242,0.2)",
                               color: "#a8d8f0", borderRadius: "4px", padding: "4px 10px",
                               fontSize: "12px", cursor: "pointer" }
                    }, "📝"),
                    onPasteToNote && React.createElement("button", {
                      onClick: () => onPasteToNote({ text: desc ? `![[img:${img.name}]]\n\n${desc}` : `![[img:${img.name}]]`,
                        source: img.name, page: null, url: `/api/image/${encodeURIComponent(img.name)}` }),
                      title: "Plak in open notitie",
                      style: { background: "rgba(159,202,86,0.08)", border: "1px solid rgba(159,202,86,0.25)",
                               color: W.comment, borderRadius: "4px", padding: "4px 8px",
                               fontSize: "12px", cursor: "pointer" }
                    }, "📋"),
                    React.createElement("button", {
                      onClick: () => deleteImg(img.name), title: "Verwijder",
                      style: { background: "rgba(229,120,109,0.08)", border: "1px solid rgba(229,120,109,0.2)",
                               color: W.orange, borderRadius: "4px", padding: "4px 8px",
                               fontSize: "12px", cursor: "pointer" }
                    }, "🗑")
                  )
                );
              })
            )
        )
      )
    ),



    // ── Lightbox ─────────────────────────────────────────────────────────────
    lightbox && React.createElement("div",{
      onClick:()=>setLightbox(null),
      style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1000,
             display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out"}
    },
      React.createElement("img",{
        src:"/api/image/"+encodeURIComponent(lightbox), alt:lightbox,
        onClick:e=>e.stopPropagation(),
        style:{maxWidth:"92vw",maxHeight:"88vh",objectFit:"contain",
               borderRadius:"8px",boxShadow:"0 16px 64px rgba(0,0,0,0.8)"}
      }),
      React.createElement("button",{
        onClick:()=>setLightbox(null),
        style:{position:"absolute",top:"16px",right:"20px",background:"rgba(0,0,0,0.5)",
               border:"1px solid rgba(255,255,255,0.2)",color:"white",
               borderRadius:"50%",width:"36px",height:"36px",fontSize:"18px",
               cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}
      },"×"),
      React.createElement("div",{
        style:{position:"absolute",bottom:"16px",left:"50%",
               transform:"translateX(-50%)",color:"rgba(255,255,255,0.7)",
               fontSize:"14px",background:"rgba(0,0,0,0.5)",padding:"4px 12px",
               borderRadius:"12px"}
      }, lightbox)
    )
  );
};





// ── Mindmap ────────────────────────────────────────────────────────────────────
// Interactieve mindmap op basis van notities en tags.
// Layout: radiale boom — root in midden, takken per tag, notities als bladeren.
// Editor: klik node om te hernoemen/verwijderen, sleep om te herpositioneren.
// Exporteerbaar als JSON (opgeslagen in vault).

const MM_NODE_W  = 130;
const MM_NODE_H  = 32;
const MM_RADIUS  = 200;  // afstand root→tag
const MM_LEAF_R  = 140;  // afstand tag→notitie

// ── Mermaid Mindmap Parser & Canvas Renderer ─────────────────────────────────
// Parseert mermaid mindmap-syntax en rendert het op een canvas.
// Syntax:
//   mindmap
//     root((Titel))
//       Tak A
//         Sub A1
//         Sub A2
//       Tak B

const parseMermaidMindmap = (text) => {
  // Verwijder "mindmap" header en lege regels
  const raw = text.replace(/^\s*mindmap\s*/i, "");
  const lines = raw.split("\n").filter(l => l.trimEnd());

  const getDepth = (line) => {
    const m = line.match(/^(\s*)/);
    return m ? Math.floor(m[1].length / 2) : 0;
  };

  const cleanLabel = (s) => s.trim()
    .replace(/^root\(\((.+?)\)\)/, "$1")  // root((label))
    .replace(/^\(\((.+?)\)\)/, "$1")      // ((label)) = round
    .replace(/^\((.+?)\)/, "$1")          // (label)
    .replace(/^\[(.+?)\]/, "$1")          // [label]
    .replace(/^::icon\([^)]*\)/, "")      // icon directives
    .replace(/^\s*/, "");

  const nodes = [];
  const stack = [];  // {id, depth}
  let idCounter = 0;

  lines.forEach(line => {
    if (!line.trim()) return;
    const depth = getDepth(line);
    const label = cleanLabel(line);
    if (!label) return;

    const id = "mm_" + (idCounter++);
    const parentId = stack.filter(s => s.depth < depth).slice(-1)[0]?.id || null;

    nodes.push({ id, label, depth, parentId });

    // Update stack: verwijder alles op zelfde/diepere depth
    while (stack.length && stack[stack.length-1].depth >= depth) stack.pop();
    stack.push({ id, depth });
  });

  return nodes;
};

