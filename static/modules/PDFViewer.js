// ── CanvasMount + TextLayerMount + PDFViewer ────────────────────────────────
// Deps: W, api, genId, PDFService, AnnotationStore, NoteStore, HCOLORS

const CanvasMount = ({canvas, width, height}) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && canvas) {
      ref.current.innerHTML = "";
      ref.current.appendChild(canvas);
    }
  }, [canvas]);
  return React.createElement("div", {
    ref, style:{width:width+"px", height:height+"px", display:"block", lineHeight:0}
  });
};

const TextLayerMount = ({textLayer, width, height}) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && textLayer) {
      ref.current.innerHTML = "";
      textLayer.style.position        = "absolute";
      textLayer.style.top             = "0";
      textLayer.style.left            = "0";
      textLayer.style.pointerEvents   = "auto";
      // touchAction "pan-y": staat verticaal scrollen toe via parent,
      // maar behoudt tekst-selectie. "none" blokkeerde scrollen op iPad.
      // touchAction wordt dynamisch gezet via selectMode/pencilActiveRef
      textLayer.style.touchAction     = "pan-y";
      textLayer.style.userSelect      = "text";
      textLayer.style.webkitUserSelect= "text";
      ref.current.appendChild(textLayer);
    }
  }, [textLayer]);
  return React.createElement("div", {
    ref,
    style:{
      position:"absolute", top:0, left:0,
      width:width+"px", height:height+"px",
      pointerEvents:"auto",
      overflow:"visible",
      touchAction:"pan-y",
      userSelect:"text", WebkitUserSelect:"text",
    }
  });
};

// ── PDF Viewer ─────────────────────────────────────────────────────────────────

// Online modellen gegroepeerd per provider
const ONLINE_MODELS = [
  // ── Anthropic ──────────────────────────────────────────────────────────────
  { id:"claude-opus-4-20250514",      label:"Claude Opus 4",        provider:"anthropic",  group:"Anthropic",   icon:"⚡" },
  { id:"claude-sonnet-4-20250514",    label:"Claude Sonnet 4",      provider:"anthropic",  group:"Anthropic",   icon:"⚡" },
  { id:"claude-haiku-4-5-20251001",   label:"Claude Haiku 4.5",     provider:"anthropic",  group:"Anthropic",   icon:"⚡" },
  // ── Google ─────────────────────────────────────────────────────────────────
  { id:"gemini-2.5-pro",              label:"Gemini 2.5 Pro",       provider:"google",     group:"Google",      icon:"🔷" },
  { id:"gemini-2.5-flash-preview-04-17", label:"Gemini 2.5 Flash", provider:"google",     group:"Google",      icon:"🔷" },
  { id:"gemini-2.0-flash",            label:"Gemini 2.0 Flash",     provider:"google",     group:"Google",      icon:"🔷" },
  // ── OpenAI ─────────────────────────────────────────────────────────────────
  { id:"gpt-4.1",                     label:"GPT-4.1",              provider:"openai",     group:"OpenAI",      icon:"🟢" },
  { id:"gpt-4.1-mini",                label:"GPT-4.1 mini",         provider:"openai",     group:"OpenAI",      icon:"🟢" },
  { id:"o4-mini",                     label:"o4-mini (redeneren)",  provider:"openai",     group:"OpenAI",      icon:"🟢" },
  // ── Mistral (direct) ───────────────────────────────────────────────────────
  { id:"mistral-medium-latest",       label:"Mistral Medium 3",     provider:"mistral",    group:"Mistral",     icon:"🌬" },
  { id:"mistral-small-latest",        label:"Mistral Small 3.1",    provider:"mistral",    group:"Mistral",     icon:"🌬" },
  { id:"magistral-medium-latest",     label:"Magistral Medium",     provider:"mistral",    group:"Mistral",     icon:"🌬" },
  // ── Open Source via OpenRouter ─────────────────────────────────────────────
  { id:"moonshotai/kimi-k2.5",        label:"Kimi K2.5",            provider:"openrouter", group:"Open source", icon:"🌙" },
  { id:"moonshotai/kimi-k2",          label:"Kimi K2",              provider:"openrouter", group:"Open source", icon:"🌙" },
  { id:"meta-llama/llama-4-maverick", label:"Llama 4 Maverick ⭐",  provider:"openrouter", group:"Open source", icon:"🦙" },
  { id:"meta-llama/llama-4-scout",    label:"Llama 4 Scout",        provider:"openrouter", group:"Open source", icon:"🦙" },
  { id:"qwen/qwen3-235b-a22b",        label:"Qwen3 235B",           provider:"openrouter", group:"Open source", icon:"🐉" },
  { id:"qwen/qwen3-30b-a3b",          label:"Qwen3 30B (snel)",     provider:"openrouter", group:"Open source", icon:"🐉" },
  { id:"deepseek/deepseek-r1",        label:"DeepSeek R1",          provider:"openrouter", group:"Open source", icon:"🔍" },
  { id:"google/gemma-3-27b-it",       label:"Gemma 3 27B",          provider:"openrouter", group:"Open source", icon:"💎" },
  { id:"mistralai/mistral-small-3.1", label:"Mistral Small (OR)",   provider:"openrouter", group:"Open source", icon:"🌬" },
];

// Provider-kleuren — licht/verzadigd voor donkere thema's (springt er dan
// goed uit), duidelijk donkerder equivalent voor lichte thema's (anders
// contrast <2:1 op crème — vrijwel onleesbaar, zoals bij het zomerlicht-
// thema werd gemeld). Zelfde herkenbare kleurtoon per provider, alleen de
// helderheid past zich aan. Elke lichte variant ≥7:1 op #F2EAD0 (AAA).
const PROVIDER_COLOR_DARK = {
  anthropic:  "#d787ff",
  google:     "#8ac6f2",
  openai:     "#9fca56",
  openrouter: "#e5786d",
  mistral:    "#eae788",
};
const PROVIDER_COLOR_LIGHT = {
  anthropic:  "#633E75",
  google:     "#374F61",
  openai:     "#405122",
  openrouter: "#703B35",
  mistral:    "#49482A",
};
const PROVIDER_COLOR = (providerId) =>
  (W.dark === false ? PROVIDER_COLOR_LIGHT : PROVIDER_COLOR_DARK)[providerId];

const MODEL_LABEL = (m) => {
  const o = ONLINE_MODELS.find(x => x.id === m);
  if (o) return o.icon + " " + o.label;
  if (!m) return "geen model";
  return "🖥 " + (m.split(":")[0] || m);
};

const MODEL_COLOR = (m) => {
  const o = ONLINE_MODELS.find(x => x.id === m);
  const fallback = W.dark === false ? "#405122" : "#9fca56"; // lokale (Ollama) modellen
  return o ? (PROVIDER_COLOR(o.provider) || W.fg) : fallback;
};

// ── PDFUploadPanel — clean upload-paneel voor Invoer → PDF tab ───────────────
// ── Offline helper: communiceert met SW via MessageChannel ────────────────────
async function swRequest(data) {
  // Wacht tot SW actief is — max 3s in stappen van 100ms
  if (!navigator.serviceWorker?.controller) {
    for (let i = 0; i < 30 && !navigator.serviceWorker?.controller; i++) {
      await new Promise(res => setTimeout(res, 100));
    }
  }
  return new Promise((resolve, reject) => {
    const ctrl = navigator.serviceWorker?.controller;
    if (!ctrl) { reject(new Error("Service Worker niet actief. Sluit de app en open opnieuw.")); return; }
    const ch = new MessageChannel();
    ch.port1.onmessage = e => resolve(e.data);
    ctrl.postMessage(data, [ch.port2]);
    setTimeout(() => reject(new Error("SW timeout na 60s")), 60000);
  });
}
async function cachePdfOffline(pdfName) {
  const url = `/api/pdf/${encodeURIComponent(pdfName)}`;
  return swRequest({ type: "CACHE_PDF", url, name: pdfName });
}
async function removePdfOffline(pdfName) {
  const url = `/api/pdf/${encodeURIComponent(pdfName)}`;
  return swRequest({ type: "REMOVE_PDF", url });
}
async function getStorageInfo() {
  return swRequest({ type: "GET_STORAGE_INFO" });
}

const PDFUploadPanel = ({ serverPdfs=[], onRefreshPdfs, onOpenPdf, onTogglePdfRead=null, llmModel,
                          allTags=[], notes=[], onAddNote, addJob, updateJob }) => {
  const { useState, useRef, useCallback } = React;
  const [dragOver,   setDragOver]   = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [uploaded,   setUploaded]   = useState([]);   // [{name, isNew}]
  const [offlinePdfs,setOfflinePdfs]= React.useState(new Set());

  // Laad welke PDFs offline beschikbaar zijn bij elke serverPdfs update
  React.useEffect(() => {
    getStorageInfo().then(info => {
      if (info?.pdfs) setOfflinePdfs(new Set(
        info.pdfs.map(p => decodeURIComponent((p.key||"").split("/").pop()))
      ));
    }).catch(()=>{});
  }, [serverPdfs.length]);

  const [error,      setError]      = useState(null);
  const fileRef = useRef(null);

  const doUpload = useCallback(async (files) => {
    const pdfs = [...files].filter(f => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) return;
    setUploading(true); setError(null);
    const added = [];
    for (const file of pdfs) {
      try {
        const jid = addJob?.({ id: Math.random().toString(36).slice(2),
          type: "pdf", label: "📄 Uploaden: " + file.name.slice(0,30) + "…" });
        const res = await PDFService.uploadPdf(file);
        const name = res?.name || file.name;
        added.push({ name });
        updateJob?.(jid, { status: "done", result: "Geüpload" });
      } catch(e) {
        setError(e.message);
      }
    }
    await onRefreshPdfs?.();
    setUploaded(prev => [...added, ...prev]);
    setUploading(false);
  }, [onRefreshPdfs, addJob, updateJob]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    doUpload(e.dataTransfer.files);
  }, [doUpload]);

  return React.createElement("div", {
    style: { flex: 1, display: "flex", flexDirection: "column",
             overflow: "hidden", minHeight: 0, background: W.bg }
  },
    // Header
    React.createElement("div", {
      style: { background: W.bg2, borderBottom: `1px solid ${W.splitBg}`,
               padding: "10px 16px", flexShrink: 0,
               display: "flex", alignItems: "center", gap: "12px" }
    },
      React.createElement("span", {
        style: { fontSize: "13px", color: W.statusFg, fontWeight: "700",
                 letterSpacing: "1.5px" }
      }, "PDF IMPORTEREN"),
      React.createElement("span", {
        style: { background: W.blue, color: W.bg,
                 borderRadius: "10px", padding: "0 8px", fontSize: "13px" }
      }, serverPdfs.length),
      React.createElement("button", {
        onClick: () => fileRef.current?.click(),
        style: { marginLeft: "auto", background: W.blue, color: W.bg,
                 border: "none", borderRadius: "6px",
                 padding: "6px 14px", fontSize: "13px",
                 cursor: "pointer", fontWeight: "bold" }
      }, uploading ? "⏳ Bezig…" : "+ Kies bestand(en)")
    ),

    // Scroll-gebied
    React.createElement("div", {
      style: { flex: 1, overflowY: "auto", padding: "20px",
               WebkitOverflowScrolling: "touch" }
    },
      // Drop-zone
      React.createElement("div", {
        style: {
          border: `2px dashed ${dragOver ? W.blue : W.splitBg}`,
          borderRadius: "12px",
          background: dragOver ? "rgba(138,198,242,0.06)" : "rgba(255,255,255,0.02)",
          padding: "40px 20px", textAlign: "center",
          cursor: "pointer", marginBottom: "20px",
          transition: "all 0.15s",
        },
        onClick: () => fileRef.current?.click(),
        onDragOver: e => { e.preventDefault(); setDragOver(true); },
        onDragLeave: () => setDragOver(false),
        onDrop,
      },
        React.createElement("div", { style: { fontSize: "40px", marginBottom: "10px" } }, "📄"),
        React.createElement("div", {
          style: { fontSize: "15px", color: W.fg, fontWeight: "500", marginBottom: "6px" }
        }, "Sleep PDF-bestanden hierheen"),
        React.createElement("div", {
          style: { fontSize: "13px", color: W.fgMuted }
        }, "of klik om te bladeren · Meerdere bestanden tegelijk mogelijk"),
        error && React.createElement("div", {
          style: { marginTop: "10px", fontSize: "13px", color: W.orange }
        }, "⚠ " + error)
      ),

      // Recent geüpload
      uploaded.length > 0 && React.createElement("div", null,
        React.createElement("div", {
          style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                   marginBottom: "8px", fontWeight: "600" }
        }, "ZOJUIST GEÜPLOAD"),
        ...uploaded.map((u, i) =>
          React.createElement("div", {
            key: i,
            style: { display: "flex", alignItems: "center", gap: "10px",
                     padding: "8px 12px", borderRadius: "6px",
                     background: "rgba(159,202,86,0.06)",
                     border: `1px solid rgba(159,202,86,0.2)`,
                     marginBottom: "6px" }
          },
            React.createElement("span", { style: { fontSize: "16px" } }, "📄"),
            React.createElement("span", {
              style: { flex: 1, fontSize: "13px", color: W.fg,
                       overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            }, u.name),
            React.createElement("button", {
              onClick: () => onOpenPdf?.(u.name),
              style: { background: "rgba(138,198,242,0.1)",
                       border: `1px solid rgba(138,198,242,0.3)`,
                       borderRadius: "5px", color: W.blue,
                       padding: "3px 10px", fontSize: "12px", cursor: "pointer" }
            }, "→ Openen")
          )
        )
      ),

      // Vault bibliotheek overzicht
      serverPdfs.length > 0 && React.createElement("div", null,
        React.createElement("div", {
          style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                   marginBottom: "8px", fontWeight: "600", marginTop: uploaded.length ? "20px" : "0" }
        }, `IN VAULT (${serverPdfs.length})`),
        ...serverPdfs.map((pdf, i) => {
          const pdfName = typeof pdf === "string" ? pdf : pdf.name;
          const pdfSize = pdf.size ? (pdf.size > 1048576
            ? (pdf.size/1048576).toFixed(1)+" MB"
            : Math.round(pdf.size/1024)+" KB") : "";
          const isOfl   = offlinePdfs.has(pdfName);
          return React.createElement("div", {
            key: pdfName,
            style: {
              display:"flex", alignItems:"center", gap:"10px",
              padding:"8px 12px", cursor:"pointer",
              borderBottom:`1px solid ${W.splitBg}`,
              background: i%2===0 ? "transparent" : "rgba(255,255,255,0.01)",
            },
            onClick: () => onOpenPdf(pdfName),
          },
            // Gelezen checkbox
            React.createElement("div", {
              onClick: e => { e.stopPropagation(); onTogglePdfRead?.(pdfName); },
              style:{
                width:"18px", height:"18px", borderRadius:"4px", flexShrink:0,
                border:`2px solid ${pdf.isRead ? "#72b660" : W.splitBg}`,
                background: pdf.isRead ? "#72b660" : "transparent",
                display:"flex", alignItems:"center", justifyContent:"center",
                cursor:"pointer", transition:"all .15s",
              }
            },
              pdf.isRead && React.createElement("span",{
                style:{color:W.bg,fontSize:"11px",fontWeight:"bold"}
              },"✓")
            ),
            // Naam + info
            React.createElement("div", { style:{ flex:1, minWidth:0 } },
              React.createElement("div", {
                style:{ fontSize:"13px", color:W.fg,
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }
              }, pdfName),
              React.createElement("div", {style:{display:"flex",gap:"6px",marginTop:"2px",alignItems:"center"}},
                pdfSize && React.createElement("span",{style:{fontSize:"10px",color:W.fgMuted}}, pdfSize),
                pdf.estimatedMinutes > 0 && React.createElement("span",{style:{fontSize:"10px",color:W.fgDim}},
                  `· ${pdf.estimatedMinutes} min`),
                pdf.isRead && React.createElement("span",{style:{fontSize:"10px",color:"#72b660",fontWeight:"600"}},
                  "· ✓ gelezen"),
                annotCount > 0 && React.createElement("span",{style:{
                  fontSize:"10px",color:W.yellow,
                  background:"rgba(234,196,53,0.08)",border:"1px solid rgba(234,196,53,0.2)",
                  borderRadius:"8px",padding:"1px 6px",
                }}, `✦ ${annotCount}`)
              )
            ),
            // Offline knop
            React.createElement("button", {
              onClick: async e => {
                e.stopPropagation();
                const btn = e.currentTarget;
                btn.disabled = true;
                btn.textContent = "⏳";
                try {
                  if (isOfl) {
                    await removePdfOffline(pdfName);
                    setOfflinePdfs(s => { const n=new Set(s); n.delete(pdfName); return n; });
                  } else {
                    await cachePdfOffline(pdfName);
                    setOfflinePdfs(s => new Set([...s, pdfName]));
                  }
                } catch(err) {
                  btn.title = err.message || "Fout";
                  btn.textContent = "⚠ Fout";
                  btn.style.color = "#e5786d";
                }
                btn.disabled = false;
              },
              title: isOfl ? "Verwijder offline kopie" : "Bewaar voor offline gebruik",
              style:{
                fontSize:"10px", padding:"2px 7px", borderRadius:"4px",
                border:`1px solid ${isOfl ? "rgba(114,182,96,0.5)" : W.splitBg}`,
                background: isOfl ? "rgba(114,182,96,0.1)" : "none",
                color: isOfl ? "#72b660" : W.fgDim,
                cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
              }
            }, isOfl ? "✓ Offline" : "⬇ Offline"),
            // Pagina-badge
            (() => {
              try {
                const saved = parseInt(localStorage.getItem("zk_pdf_page_"+pdfName));
                if (saved > 1) return React.createElement("span",{
                  style:{fontSize:"11px",color:W.blue,flexShrink:0,
                    background:W.blueBg||"rgba(138,198,242,.1)",
                    border:`1px solid ${W.blueBorder||"rgba(138,198,242,.25)"}`,
                    borderRadius:"8px",padding:"2px 8px"},
                  title:"Verder lezen op pagina "+saved,
                },"p."+saved+" →");
              } catch {}
              return React.createElement("span",{
                style:{fontSize:"11px",color:W.fgMuted,flexShrink:0}
              },"→ open");
            })()
          );
        })
      ),

      serverPdfs.length === 0 && uploaded.length === 0 &&
        React.createElement("div", {
          style: { textAlign: "center", color: W.fgMuted, fontSize: "13px",
                   marginTop: "20px" }
        }, "Nog geen PDFs in de vault.")
    ),

    React.createElement("input", {
      ref: fileRef, type: "file", multiple: true, accept: ".pdf",
      style: { display: "none" },
      onChange: e => { doUpload(e.target.files); e.target.value = ""; }
    })
  );
};

// ── Toolbar-iconen ────────────────────────────────────────────────────────
// Losse, ingebouwde SVG's i.p.v. emoji (renderen consistent op elk platform,
// geen externe icon-font nodig — de app blijft volledig lokaal werkbaar) en
// i.p.v. een CDN-icon-library (zou een internetafhankelijkheid toevoegen).
// Elke path is 24×24 viewBox, stroke-based, "currentColor" — schaalt en kleurt
// vanzelf mee met de knop.
const PDF_ICON_PATHS = {
  chevronLeft:  "M15 6l-6 6l6 6",
  chevronRight: "M9 6l6 6l-6 6",
  minus:        "M5 12l14 0",
  plus:         "M12 5l0 14M5 12l14 0",
  search:       "M10 3a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM21 21l-6-6",
  highlighter:  "M7 21h10M11.5 15.5l-6.5 -6.5l4-4l6.5 6.5M13 6l3-3l4 4l-3 3M9.5 4.5l6.5 6.5",
  note:         "M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9zM14 4v5h5M9 13h6M9 17h4",
  listDetails:  "M4 6h4M4 12h4M4 18h4M12 6h8M12 12h8M12 18h8",
  link:         "M9 15l6-6M8 8l1.5-1.5a4 4 0 0 1 5.5 5.5L14 13M16 16l-1.5 1.5a4 4 0 0 1-5.5-5.5L10 11",
  edit:         "M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z",
  fitWidth:     "M4 12h16M4 12l3-3M4 12l3 3M20 12l-3-3M20 12l-3 3",
  layoutSingle: "M4 4h16v16H4z",
  layoutScroll: "M4 4h16v7H4zM4 13h16v7H4z",
  rotate:       "M4 12a8 8 0 1 0 3-6.2M4 4v4h4",
  dots:         "M6 12a1 1 0 1 0 2 0a1 1 0 0 0-2 0M11 12a1 1 0 1 0 2 0a1 1 0 0 0-2 0M16 12a1 1 0 1 0 2 0a1 1 0 0 0-2 0",
  sparkles:     "M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5zM19 15l.7 2.3L22 18l-2.3.7-.7 2.3-.7-2.3L16 18l2.3-.7z",
  trash:        "M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3",
  upload:       "M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 9l5-5l5 5M12 4v12",
  circle:       "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0",
  circleCheck:  "M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0M9 12l2 2l4-4",
  skipBack:     "M20 5v14L9 12zM5 5v14",
  hand:         "M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-2a1.5 1.5 0 0 1 3 0V12M14 10.5a1.5 1.5 0 0 1 3 0V12M17 11.5a1.5 1.5 0 0 1 3 0V13a6 6 0 0 1-6 6h-2c-2 0-3.5-1-4.5-2.5L4.5 12.5a1.5 1.5 0 0 1 2.5-1.7",
};
const PdfIcon = ({ name, size = 15 }) => React.createElement("svg", {
  width: size, height: size, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round",
  style: { display: "block", flexShrink: 0 },
}, React.createElement("path", { d: PDF_ICON_PATHS[name] || "" }));

// Verticale scheidingslijn tussen toolbar-groepen
const PdfToolbarDivider = ({ W }) => React.createElement("span", {
  style: { width: "1px", alignSelf: "stretch", background: W.splitBg, flexShrink: 0, margin: "0 2px" }
});

const PDFViewer = ({pdfNotes, setPdfNotes, allTags, serverPdfs, onRefreshPdfs, onAutoSummarize, onDeletePdf, onPasteToNote=null, onAddNote=null, onSaveNote=null, onOpenNote=null, notes=[], isTablet=false, onTogglePdfRead=null, pdfAnnotations=[], openPdfName=null, openPdfPage=null, onOpenPdfConsumed=null}) => {
  const [pdfDoc,     setPdfDoc]     = useState(null);
  const [pdfFile,    setPdfFile]    = useState(null);
  const [pageNum,    setPageNum]    = useState(1);   // huidige zichtbare pagina (voor annotaties)
  const pageNumRef      = useRef(1);      // ref-versie: altijd actueel zonder closure-problemen
  const pdfDocRef        = useRef(null);
  const scaleRef         = useRef(1.4);
  const rotationRef      = useRef(0);
  const scrollToPageRef  = useRef(null);   // ref naar scrollToPage — vermijdt circular dependency
  const searchIdRef      = useRef(0);      // annuleer lopende zoekopdracht bij nieuwe query
  const [isSearching,  setIsSearching]  = useState(false);
  const [numPages,   setNumPages]   = useState(0);
  const [scale,      setScale]      = useState(1.4);
  const [rotation,   setRotation]   = useState(0);      // 0 | 90 | 180 | 270
  const [fitWidth,   setFitWidth]   = useState(false);  // fit-width modus aan/uit
  const userScaleRef = useRef(1.4);  // onthoudt handmatige scale als fitWidth uit gaat
  const [pageLayout, setPageLayout] = useState("scroll"); // "scroll" | "single"
  const [pdfSearch,  setPdfSearch]  = useState("");      // zoekterm in PDF
  const [pdfSearchOpen, setPdfSearchOpen] = useState(false);
  const [searchHits, setSearchHits]  = useState([]);    // [{page, idx, text}]
  const [searchHitIdx, setSearchHitIdx] = useState(0);
  const [selectMode,   setSelectMode]   = useState(false);  // A: selectiemodus (vinger)
  const pencilActiveRef  = useRef(false);  // B: Apple Pencil auto-detectie
  const pendingColorRef  = useRef(null);   // kleur voor directe floatBar opslag
  const dragSelRef       = useRef(null);   // {startX, startY, el} voor sleep-selectie
  const [selRect,        setSelRect]       = useState(null);  // visuele rechthoek
  // highlights gespiegeld vanuit AnnotationStore
  const [highlights, setHighlights] = useState(AnnotationStore.getAll());
  const [pendingSel, setPendingSel] = useState(null);

  // Extern verzoek om een specifiek PDF te openen (bv. "Lees dit boek" vanuit
  // BookLibrary). Eenmalig verwerken via dezelfde openFromServer-functie die
  // ook de PDF-lijst gebruikt (fetch + laden + renderen), en daarna via
  // onOpenPdfConsumed laten wissen door de ouder, zodat later terugkeren naar
  // dit tabblad niet steeds hetzelfde bestand heropent.
  useEffect(() => {
    if (!openPdfName) return;
    openFromServer(openPdfName, openPdfPage);
    onOpenPdfConsumed?.();
  }, [openPdfName, openPdfPage]);

  const [floatBar,   setFloatBar]   = useState(null);  // {x,y,text,above} zwevende toolbar
  const [floatNote,  setFloatNote]  = useState("");    // inline notitie in toolbar
  const [floatOpen,  setFloatOpen]  = useState(false); // notitie-veld zichtbaar
  const [selPos,     setSelPos]     = useState({x:0,y:0});
  const [editingId,  setEditingId]  = useState(null);
  const [isLoading,  setIsLoading]  = useState(false);
  const [pdfjsReady, setPdfjsReady] = useState(false);
  const [activeColor,setActiveColor]= useState(HCOLORS[0]);

  // Wrap highlight-tekst in [tekst]{.laag}-markup als de highlight-kleur een
  // laag draagt (bron/kritisch/eigen — zie HCOLORS in app.js). Zo herkent
  // AnnotationsPanel.js notities die uit een gekleurde highlight ontstaan,
  // i.p.v. dat de laag-informatie verloren gaat bij het exporteren.
  const layerWrap = (text, colorId) => {
    const hc = HCOLORS.find(c => c.id === colorId);
    return (hc && hc.layer) ? `[${text}]{.${hc.layer}}` : text;
  };

  const [filterTag,  setFilterTag]  = useState(null);
  const [quickNote,  setQuickNote]  = useState("");
  const [quickTags,  setQuickTags]  = useState([]);
  const [showLibrary,   setShowLibrary]   = useState(true);
  const [libSearch,     setLibSearch]     = useState("");
  const [libFilter,     setLibFilter]     = useState("all");
  const [libView,       setLibView]       = useState("grid"); // "grid" | "list"
  const [thumbCache,    setThumbCache]    = useState({});  // {pdfName: dataURL}
  const [showAnnotPanel,setShowAnnotPanel]= useState(!isTablet);
  const [annotWidth,   setAnnotWidth]    = useState(280);  // min 280px = huidige breedte
  const annotDragRef  = useRef(null);   // {startX, startW} tijdens drag
  const [showNotePanel, setShowNotePanel]  = useState(false);  // leesnotitie zijpaneel
  const [noteContent,   setNoteContent]    = useState("");     // inhoud leesnotitie
  const [noteSaving,    setNoteSaving]     = useState(false);  // opslaan bezig
  const [summarizing,   setSummarizing]   = useState(false);
  const [summarizeErr,  setSummarizeErr]  = useState(null);
  const [renderedPages, setRenderedPages] = useState([]);  // [{num, canvas, textLayer}]
  const pageCacheRef   = useRef(new Map()); // {pageNum → {canvas, textLayer, w, h}} — virtueel

  // ── Laad bestaande leesnotitie als PDF wisselt ──────────────────────────────
  React.useEffect(() => {
    if (!pdfFile || !notes) return;
    const stem = pdfFile.name.replace(/\.pdf$/i, "");
    const existing = notes.find(n =>
      (n.tags||[]).includes("leesnotitie") && (n.tags||[]).includes(stem)
    );
    setNoteContent(existing?.content || "");
  }, [pdfFile, notes]);

  // ── Paginageheugen: onthoudt laatste pagina per PDF ──────────────────────
  const PDF_MEM_KEY = (name) => "zk_pdf_page_" + name;
  const savePdfPage = React.useCallback((name, page) => {
    if (!name || page <= 1) { try { localStorage.removeItem(PDF_MEM_KEY(name)); } catch {} return; }
    try { localStorage.setItem(PDF_MEM_KEY(name), String(page)); } catch {}
  }, []);
  const loadPdfPage = React.useCallback((name) => {
    try { const p = parseInt(localStorage.getItem(PDF_MEM_KEY(name))); return (p > 1 ? p : 1); } catch { return 1; }
  }, []);
  const pageHeightsRef = useRef(new Map()); // {pageNum → hoogte in px} — voor placeholders
  const RENDER_WINDOW  = 3;  // pagina's voor/na huidige pagina in geheugen houden

  const canvasRef   = useRef(null);    // enkel canvas (legacy, voor annotatie-hit-test)
  const textLayerRef= useRef(null);
  const wrapRef     = useRef(null);
  const scrollRef   = useRef(null);
  const fileRef     = useRef(null);
  const renderRef   = useRef(null);
  const tlRenderRef = useRef(null);
  const pinchRef    = useRef({active:false, dist0:0, scale0:1.4});
  const pageRefs        = useRef({});  // {pageNum: domNode} voor scroll-to-page
  const pendingScrollRef = useRef(null); // pagina om naar te scrollen zodra die gerenderd is
  const _swipeStart = useRef(0);        // iPad swipe navigatie in single-page modus
  const renderingRef= useRef(false);
  const renderIdRef = useRef(0);  // elke nieuwe render krijgt een uniek ID — annuleert de vorige
  const libRef      = useRef(null);    // bibliotheek scroll-container

  // ── Thumbnail: render eerste pagina als klein preview-plaatje ─────────────
  const generateThumb = React.useCallback(async (pdfName) => {
    if (thumbCache[pdfName]) return;
    try {
      const buf = await PDFService.fetchPdfBlob(pdfName);
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      const page = await doc.getPage(1);
      const vp = page.getViewport({ scale: 0.35 });
      const canvas = document.createElement("canvas");
      canvas.width  = vp.width;
      canvas.height = vp.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport: vp }).promise;
      setThumbCache(prev => ({ ...prev, [pdfName]: canvas.toDataURL("image/jpeg", 0.7) }));
    } catch(e) { /* stil falen */ }
  }, [thumbCache]);

  // Genereer thumbnails voor alle PDFs zodra de bibliotheek zichtbaar is
  // Check welke PDFs offline beschikbaar zijn
  const [offlinePdfs, setOfflinePdfs] = React.useState(new Set());
  React.useEffect(() => {
    getStorageInfo().then(info => {
      if (info?.pdfs) setOfflinePdfs(new Set(
        info.pdfs.map(p => decodeURIComponent((p.key||"").split("/").pop()))
      ));
    }).catch(()=>{});
  }, []);

  React.useEffect(() => {
    if (!showLibrary || !pdfDoc === false) return;
    (serverPdfs || []).forEach(p => {
      if (!thumbCache[p.name]) generateThumb(p.name);
    });
  }, [showLibrary, serverPdfs]);

  // iOS Safari fix: stel hoogte expliciet in zodat overflow:auto werkt
  // Werkt voor zowel de PDF scroll-area als de bibliotheek
  const _iosScrollFix = React.useCallback((el) => {
    if (!el) return () => {};
    // Verwijder de _iosScrollFix — we gebruiken het NotePreview patroon:
    // De scroll-container zelf heeft flex:1 + overflow:auto
    // iOS Safari werkt dan correct als de parent overflow:hidden heeft
    return () => {};
  }, []);

  React.useEffect(() => _iosScrollFix(scrollRef.current), [pdfDoc, renderedPages, _iosScrollFix]);
  React.useEffect(() => _iosScrollFix(libRef.current),    [pdfDoc, _iosScrollFix]);
  const isSelectingRef = useRef(false); // true terwijl muisknop ingedrukt is in PDF

  // ── Fix: selectie over pagina-grenzen heen ───────────────────────────────
  // Hulpfunctie: zet touchAction op alle tekst-lagen
  const _setTextLayerTouch = (action) => {
    if (scrollRef.current) {
      scrollRef.current.querySelectorAll(".textLayer").forEach(el => {
        el.style.touchAction = action;
      });
      // Ook de scroll container zelf
      if (wrapRef.current) wrapRef.current.style.touchAction = action;
    }
  };

  // ── Muis-drag: behoud selectie over pagina-grenzen ───────────────────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onDown = (e) => {
      if (e.button !== 0) return;
      if (e.target.closest?.('[data-annot-popup]')) return;
      isSelectingRef.current = true;
      if (wrapRef.current) {
        wrapRef.current.style.userSelect = "text";
        wrapRef.current.style.webkitUserSelect = "text";
      }
    };

    const onUp = () => {
      if (!isSelectingRef.current) return;
      isSelectingRef.current = false;
      if (wrapRef.current) {
        wrapRef.current.style.userSelect = "";
        wrapRef.current.style.webkitUserSelect = "";
      }
      // Selectie losgelaten: eventueel uitgestelde cache-opschoning
      // (zie renderNearby) alsnog laten plaatsvinden.
      if (pdfDocRef.current) renderNearby(pdfDocRef.current, scaleRef.current, rotationRef.current, pageNumRef.current);
    };

    el.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);



  useEffect(()=>{
    // PDF.js en workerSrc worden al ingesteld in index.html
    // Hier alleen wachten tot de library beschikbaar is
    const check = () => {
      if(window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions?.workerSrc){
        setPdfjsReady(true);
      } else if(window.pdfjsLib) {
        // Worker nog niet gezet — stel alsnog in
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        setPdfjsReady(true);
      } else {
        // Library nog niet geladen — laad hem dynamisch
        const s=document.createElement("script");
        s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload=()=>{
          window.pdfjsLib.GlobalWorkerOptions.workerSrc=
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          if(!document.getElementById("pdfjsCss")){
            const l=document.createElement("link");
            l.id="pdfjsCss"; l.rel="stylesheet";
            l.href="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.css";
            document.head.appendChild(l);
          }
          setPdfjsReady(true);
        };
        document.head.appendChild(s);
      }
    };
    // Kleine vertraging zodat index.html scripts zeker klaar zijn
    setTimeout(check, 50);
  },[]);

  // Render alle pagina's in de scroll-container
  // ── Render één pagina en sla op in cache ────────────────────────────────
  const renderOnePage = useCallback(async (doc, pageNum, sc, rot, myId) => {
    if (!doc || renderIdRef.current !== myId) return null;
    if (pageCacheRef.current.has(pageNum)) return pageCacheRef.current.get(pageNum);
    try {
      const page   = await doc.getPage(pageNum);
      if (renderIdRef.current !== myId) return null;
      const vp     = page.getViewport({scale: sc, rotation: rot || 0});
      const w = Math.floor(vp.width), h = Math.floor(vp.height);
      pageHeightsRef.current.set(pageNum, h);

      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.style.display = "block";
      await page.render({canvasContext: canvas.getContext("2d"), viewport: vp}).promise;
      if (renderIdRef.current !== myId) return null;

      const tl = document.createElement("div");
      tl.className = "textLayer";
      tl.style.width = w+"px"; tl.style.height = h+"px";
      const tc = await page.getTextContent();
      if (renderIdRef.current !== myId) return null;
      try {
        await window.pdfjsLib.renderTextLayer({
          textContentSource: tc, container: tl, viewport: vp, textDivs: []
        }).promise;
      } catch {}

      const entry = {num: pageNum, canvas, textLayer: tl, width: w, height: h};
      pageCacheRef.current.set(pageNum, entry);
      return entry;
    } catch(e) {
      console.warn("Render fout p."+pageNum+":", e);
      return null;
    }
  }, []);

  // ── Virtuele render: laad alleen pagina's nabij de huidige ───────────────
  const renderVirtual = useCallback(async (doc, sc, rot, centerPage) => {
    if (!doc) return;
    const myId = ++renderIdRef.current;
    renderingRef.current = true;

    // Leeg cache als scale of rotatie verandert (nieuwe render-ronde)
    pageCacheRef.current = new Map();
    pageHeightsRef.current = new Map();
    setRenderedPages([]);

    // Render eerst pagina 1 voor hoogte-schatting (placeholder hoogte)
    const firstEntry = await renderOnePage(doc, 1, sc, rot, myId);
    if (!firstEntry || renderIdRef.current !== myId) return;
    const estH = firstEntry.height;
    pageHeightsRef.current.set(1, estH);

    // Zet alle pagina's als placeholder (worden gevuld zodra bezocht)
    const all = [];
    for (let i = 1; i <= doc.numPages; i++) {
      all.push(i === 1 ? firstEntry : {num:i, canvas:null, textLayer:null,
                                        width: firstEntry.width, height: estH});
    }
    setRenderedPages([...all]);

    // Render vervolgens de pagina's rondom de startpagina
    const start = Math.max(1, centerPage - RENDER_WINDOW);
    const end   = Math.min(doc.numPages, centerPage + RENDER_WINDOW);
    for (let i = start; i <= end; i++) {
      if (renderIdRef.current !== myId) return;
      if (i === 1) continue; // al gedaan
      const entry = await renderOnePage(doc, i, sc, rot, myId);
      if (!entry || renderIdRef.current !== myId) return;
      setRenderedPages(prev => prev.map(p => p.num === i ? entry : p));
    }
    if (renderIdRef.current === myId) {
      renderingRef.current = false;
      // Scroll terug naar de pagina waar de gebruiker was (na scale/rotatie wijziging)
      if (centerPage && centerPage > 1) {
        setTimeout(() => {
          if (renderIdRef.current === myId && scrollToPageRef.current) {
            scrollToPageRef.current(centerPage);
          }
        }, 80);
      }
    }
  }, [renderOnePage]);  // scrollToPage via ref — geen dep nodig

  // ── Laad nabije pagina's bij paginawisseling ──────────────────────────────
  const renderNearby = useCallback(async (doc, sc, rot, centerPage) => {
    if (!doc) return;
    // Tijdens een actieve sleep-selectie (muis): niets aan de gerenderde
    // pagina's wijzigen — dat zou de tekst-DOM onder de cursor vervangen en
    // de lopende browser-selectie afbreken. onUp() roept renderNearby()
    // hierna alsnog aan om bij te werken.
    if (isSelectingRef.current) return;
    const myId = renderIdRef.current; // gebruik huidig ID — geen nieuwe render-ronde
    const start = Math.max(1, centerPage - RENDER_WINDOW);
    const end   = Math.min(doc.numPages, centerPage + RENDER_WINDOW);

    // Verwijder pagina's die te ver weg zijn uit de cache (geheugen vrijgeven)
    for (const [pNum] of pageCacheRef.current) {
      if (pNum < start - RENDER_WINDOW || pNum > end + RENDER_WINDOW) {
        pageCacheRef.current.delete(pNum);
      }
    }

    for (let i = start; i <= end; i++) {
      if (renderIdRef.current !== myId) return;
      if (isSelectingRef.current) return; // ook mid-lus afbreken als selectie start
      if (pageCacheRef.current.has(i)) continue;
      const entry = await renderOnePage(doc, i, sc, rot, myId);
      if (!entry || renderIdRef.current !== myId) return;
      setRenderedPages(prev => prev.map(p => p.num === i ? entry : p));
    }
  }, [renderOnePage]);

  // Alias voor bestaande aanroepen
  const renderAllPages = renderVirtual;

  useEffect(() => {
    if (pdfDoc) renderAllPages(pdfDoc, scale, rotation, pageNumRef.current);
  }, [pdfDoc, scale, rotation, renderAllPages]);
  // pageNum bewust NIET in deps — anders re-rendert bij elke scroll

  // Scroll naar pagina via knoppen ◀/▶ — alleen als het een GEBRUIKER-actie is
  // (niet elke keer dat pageNum wijzigt via de observer, anders loop)
  const userNavRef = useRef(false);   // true = knop-klik, false = scroll
  const scrollToPage = useCallback((n) => {
    const node = pageRefs.current[n];
    if (!node) return;
    userNavRef.current = true;
    node.scrollIntoView({behavior: "instant", block: "start"}); // instant op iPad, smooth kan mislopen
    if (pendingScrollRef.current === n) pendingScrollRef.current = null;
    setTimeout(() => { userNavRef.current = false; }, 700);
  }, []);

  // Sync pageNumRef — altijd up-to-date zonder closure problemen
  React.useEffect(() => { pageNumRef.current = pageNum; }, [pageNum]);
  React.useEffect(() => { pdfDocRef.current = pdfDoc; }, [pdfDoc]);
  React.useEffect(() => { scaleRef.current = scale; }, [scale]);
  React.useEffect(() => { rotationRef.current = rotation; }, [rotation]);
  // Registreer scrollToPage in ref zodat renderVirtual hem kan aanroepen zonder dep
  React.useEffect(() => { scrollToPageRef.current = scrollToPage; }, [scrollToPage]);

  // Scroll naar pending pagina zodra die node in de DOM bestaat
  React.useEffect(() => {
    const target = pendingScrollRef.current;
    if (!target) return;
    // Probeer direct te scrollen; als het lukt, wis de pending
    const node = pageRefs.current[target];
    if (node) {
      // Kleine delay zodat iOS Safari de layout heeft afgerond
      setTimeout(() => {
        const n2 = pageRefs.current[target];
        if (n2) {
          n2.scrollIntoView({ behavior: "instant", block: "start" });
          pendingScrollRef.current = null;
          console.log("[PDF] Hersteld naar pagina", target);
        }
      }, 120);
    }
  }); // elke render — stopt zichzelf via pendingScrollRef = null

  // Laad nabije pagina's + sla huidige pagina op als pageNum verandert
  React.useEffect(() => {
    if (pdfDoc && pageNum) {
      const t = setTimeout(() => renderNearby(pdfDoc, scale, rotation, pageNum), 200);
      // Sla pagina op voor dit PDF (met debounce — niet bij elke micro-scroll)
      if (pdfFile?.name) savePdfPage(pdfFile.name, pageNum);
      return () => clearTimeout(t);
    }
  }, [pageNum, pdfDoc, scale, rotation, renderNearby, pdfFile?.name, savePdfPage]);

  // Intersection observer: update pageNum ALLEEN bij vrij scrollen (niet bij knop-navigatie)
  useEffect(() => {
    if (!scrollRef.current || renderedPages.length === 0) return;
    const obs = new IntersectionObserver(entries => {
      if (userNavRef.current) return;   // negeer tijdens programmatisch scrollen
      let best = null, bestRatio = 0;
      entries.forEach(e => {
        if (e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio;
          best = e.target;
        }
      });
      if (best) {
        const n = parseInt(best.dataset.page);
        if (n) setPageNum(n);
      }
    }, {root: scrollRef.current, threshold: [0.1, 0.3, 0.5, 0.7, 0.9]});
    Object.values(pageRefs.current).forEach(el => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [renderedPages]);

  const loadPdf=async(arrayBuffer,name,targetPage=null)=>{
    setIsLoading(true);
    setRenderedPages([]);          // wis oude pagina's bij nieuw PDF
    renderingRef.current = false;
    pageRefs.current = {};
    try{
      if(!window.pdfjsLib) throw new Error("PDF.js nog niet geladen — herlaad de pagina");
      if(!window.pdfjsLib.GlobalWorkerOptions.workerSrc){
        window.pdfjsLib.GlobalWorkerOptions.workerSrc=
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      const doc=await window.pdfjsLib.getDocument({data:arrayBuffer}).promise;
      const savedPage = loadPdfPage(name);
      setPdfDoc(doc); setNumPages(doc.numPages);
      setPdfFile({name});
      // Een expliciet meegegeven doelpagina (bv. vanuit een semantisch-
      // zoeken-resultaat) krijgt voorrang boven "waar was ik gebleven" —
      // je klikte bewust op een specifieke pagina, dus die wil je zien.
      if (targetPage && targetPage >= 1 && targetPage <= doc.numPages) {
        pendingScrollRef.current = targetPage;
        setPageNum(targetPage);
      } else if (savedPage > 1) {
        pendingScrollRef.current = savedPage; // renderer scrollt zodra pagina in DOM is
        setPageNum(savedPage);
      } else {
        setPageNum(1);
      }
    }catch(err){
      console.error("loadPdf:",err);
      setSummarizeErr("PDF laden mislukt: "+err.message);
    }
    setIsLoading(false);
  };

  const onFileInput=async(e)=>{
    const file=e.target.files[0]; if(!file||!pdfjsReady) return;
    e.target.value = ""; // reset zodat hetzelfde bestand opnieuw geselecteerd kan worden

    // Duplicate check: kijk of bestandsnaam al in een notitie voorkomt
    const fname = file.name;
    const dupNote = notes.find(n =>
      n.content && (
        n.content.includes(`[[pdf:${fname}]]`) ||
        n.content.includes(`📄 **Bron:** [[pdf:${fname}]]`)
      )
    );
    if (dupNote) {
      const ok = window.confirm(
        `"${fname}" is al eerder geïmporteerd in notitie:\n"${dupNote.title||dupNote.id}"\n\nToch opnieuw uploaden?`
      );
      if (!ok) return;
    }

    let savedName=file.name;
    setSummarizeErr(null);
    try{
      const res=await PDFService.uploadPdf(file);
      if(res?.name) savedName=res.name;
      onRefreshPdfs?.();
    }catch(err){ console.error("upload:",err); }

    // PDF in browser laden (arrayBuffer vóór async samenvatten, anders is file al verbruikt)
    try{
      const ab=await file.arrayBuffer();
      await loadPdf(ab,file.name);
    }catch(err){ console.error("loadPdf:",err); }

    // Samenvatting starten NA het laden — fire and forget met indicator
    if(onAutoSummarize){
      setSummarizing(true);
      try{
        await onAutoSummarize(savedName);
      }catch(err){
        setSummarizeErr(err?.message||"Samenvatten mislukt");
      }finally{
        setSummarizing(false);
      }
    }
  };

  const openFromServer=async(name,targetPage=null)=>{
    setShowLibrary(false); setIsLoading(true);
    try{
      const ab=await PDFService.fetchPdfBlob(name);
      await loadPdf(ab,name,targetPage);
    }catch(err){console.error(err);}
    setIsLoading(false);
  };

  // Bewaar selectie-rects voor visuele highlight overlay
  const pendingRectsRef = useRef([]);
  const pendingPageRef  = useRef(1);  // pagina van de actieve selectie — los van pageNum state
  const [iosAnnotBtn,  setIosAnnotBtn]  = useState(null);
  const [hlMode,       setHlMode]       = useState("annot");
  const [showHlPanel,  setShowHlPanel]  = useState(false);     // highlights-overzicht

  // ── Verwante notities tijdens het lezen (voorstel 4) ────────────────────
  // Hergebruikt /api/suggest-links (dezelfde TF-IDF/tag-scoring die
  // SmartLinkSuggester ook gebruikt tijdens het schrijven) — nu toegepast op
  // de laatst geselecteerde/gehighlighte tekst, zodat "onderzoeken" ook
  // tijdens het lezen werkt, niet alleen tijdens het schrijven.
  const [showRelated,      setShowRelated]      = useState(false);
  const [toolbarMoreOpen,  setToolbarMoreOpen]   = useState(false); // "meer"-menu op tablet
  const [relatedFor,       setRelatedFor]        = useState("");   // tekst waarop laatst gezocht is
  const [relatedSuggestions, setRelatedSuggestions] = useState([]);
  const [relatedLoading,   setRelatedLoading]    = useState(false);
  const relatedDebRef = useRef(null);

  const fetchRelated = useCallback((text) => {
    clearTimeout(relatedDebRef.current);
    const q = (text || "").trim();
    if (q.length < 12) { setRelatedSuggestions([]); setRelatedFor(""); return; }
    relatedDebRef.current = setTimeout(async () => {
      setRelatedLoading(true);
      try {
        const res = await fetch("/api/suggest-links", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: q.slice(0, 2000), note_id: "", top_n: 6 }),
        });
        const d = await res.json();
        setRelatedSuggestions(d.suggestions || []);
        setRelatedFor(q);
      } catch { setRelatedSuggestions([]); }
      setRelatedLoading(false);
    }, 500);
  }, []);

  // Zodra het paneel open staat: zoek op de tekst van de actieve selectie/
  // highlight-popup (floatBar) zo gauw die verandert.
  useEffect(() => {
    if (!showRelated) return;
    fetchRelated(floatBar?.text || "");
  }, [showRelated, floatBar?.text, fetchRelated]);


  // ── mergeRectsByLine ────────────────────────────────────────────────────
  // range.getClientRects() geeft vaak meerdere kleine deel-rechthoeken per
  // zichtbare regel (één per tekstlaag-span-grens), met soms een paar pixels
  // tussenruimte — vooral bij PDF's met lettertype-substitutie (zie console-
  // warnings elders). Los getekend levert dat een grillig, "gaten"-patroon
  // op i.p.v. een nette doorlopende markering. Groepeer daarom rects die
  // verticaal overlappen (dezelfde regel) tot één rechthoek per regel, zoals
  // gangbare PDF-lezers (Adobe, Preview) dat ook doen.
  const mergeRectsByLine = (rects) => {
    if (!rects.length) return rects;
    const sorted = [...rects].sort((a, b) => a.y - b.y);
    const lines = [];
    for (const r of sorted) {
      let line = lines.find(l => r.y < l.y + l.h && r.y + r.h > l.y); // verticale overlap
      if (!line) { line = { y: r.y, h: r.h, items: [] }; lines.push(line); }
      const minY = Math.min(line.y, r.y);
      const maxYH = Math.max(line.y + line.h, r.y + r.h);
      line.y = minY; line.h = maxYH - minY;
      line.items.push(r);
    }
    // Binnen elke "regel"-groep: splits alsnog als er een grote horizontale
    // sprong tussen twee fragmenten zit (bv. de tussenruimte tussen twee
    // kolommen) — dat is geen tekstlaag-spangat maar een echte kolomgrens.
    const out = [];
    for (const line of lines) {
      const items = [...line.items].sort((a, b) => a.x - b.x);
      let cluster = [items[0]];
      const flush = () => {
        const minX = Math.min(...cluster.map(r => r.x));
        const maxX = Math.max(...cluster.map(r => r.x + r.w));
        const minY = Math.min(...cluster.map(r => r.y));
        const maxYH = Math.max(...cluster.map(r => r.y + r.h));
        out.push({ x: minX, y: minY, w: maxX - minX, h: maxYH - minY });
      };
      for (let i = 1; i < items.length; i++) {
        const prevEnd = cluster[cluster.length - 1].x + cluster[cluster.length - 1].w;
        const gap = items[i].x - prevEnd;
        if (gap > line.h * 3) { flush(); cluster = [items[i]]; } // gutter, niet een spangat
        else cluster.push(items[i]);
      }
      flush();
    }
    return out;
  };

  // ── tryOpenAnnotPopup ──────────────────────────────────────────────────────
  // Wordt aangeroepen na mouseup (desktop) of via iOS-knop.
  // Leest altijd live state via closure — geen stale refs nodig.
  const tryOpenAnnotPopup = useCallback(() => {
    const sel = window.getSelection();
    const txt = sel?.toString().trim();
    if (!txt || txt.length < 2) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    try {
      const range = sel.getRangeAt(0);
      if (!scrollEl.contains(range.commonAncestorContainer)) return;

      // Zoek omhoog naar een element met data-page
      let node = range.commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentElement; // tekstnode → element
      while (node && node !== scrollEl) {
        if (node.dataset && node.dataset.page) break;
        node = node.parentElement;
      }
      const foundPage = node && node !== scrollEl && node.dataset && node.dataset.page;
      const detectedPage = foundPage ? parseInt(node.dataset.page, 10) : null;

      // Rects relatief aan pagina-wrapper
      const refEl = (foundPage && node) ? node : scrollEl;
      const refRect = refEl.getBoundingClientRect();
      const rawRects = Array.from(range.getClientRects())
        .map(r => ({ x: r.left - refRect.left, y: r.top - refRect.top, w: r.width, h: r.height }))
        .filter(r => r.w > 1 && r.h > 1);
      const rects = mergeRectsByLine(rawRects);

      pendingRectsRef.current = rects;
      // Sla de pagina op in een ref — NIET via setPageNum, anders scrollt de viewer
      pendingPageRef.current = detectedPage || pageNum;

      // Sla de huidige scroll-positie op zodat we die na de state-update kunnen herstellen
      const scrollEl2 = scrollRef.current;
      const savedTop  = scrollEl2 ? scrollEl2.scrollTop  : 0;
      const savedLeft = scrollEl2 ? scrollEl2.scrollLeft : 0;

      // Modus "hl only": direct opslaan als pure highlight, geen popup
      if (hlMode === "hl") {
        // Sla op als highlight zonder notitietekst
        const hid = "hl_" + Date.now() + "_" + Math.random().toString(36).slice(2,6);
        const pg  = detectedPage || pageNum;
        AnnotationStore.add({
          id: hid, file: pdfFile?.name || "", page: pg,
          text: txt, note: "", colorId: activeColor.id,
          rects: rects.length ? rects : [], tags: [],
          createdAt: new Date().toISOString(), hlOnly: true,
        });
        setHighlights(AnnotationStore.getAll());
        window.getSelection()?.removeAllRanges();
        return;
      }

      // Bereken positie van de selectie voor de zwevende toolbar
      // Gebruik de al bestaande `sel` variabele van boven in de functie
      let bx = 0, by = 0, above = true;
      if (sel && sel.rangeCount > 0) {
        const br = sel.getRangeAt(0).getBoundingClientRect();
        bx = br.left + br.width / 2;
        by = br.top - 12;
        if (by < 80) { by = br.bottom + 12; above = false; }
      }
      setFloatNote("");
      setFloatOpen(false);
      setFloatBar({ x: bx, y: by, text: txt, above });

      // Herstel scroll-positie na React re-render (rAF = na paint)
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop  = savedTop;
          scrollRef.current.scrollLeft = savedLeft;
        }
      });
    } catch(e) { console.warn('[PDF] tryOpenAnnotPopup:', e); }
  }, [hlMode, pdfFile, pageNum, activeColor]);  // hlMode in deps — anders stale closure


  // ── Sleep-rechthoek selectie ─────────────────────────────────────────────
  const collectTextInRect = useCallback((x1,y1,x2,y2) => {
    const scrollEl = scrollRef.current; if (!scrollEl) return null;
    const left=Math.min(x1,x2), top=Math.min(y1,y2), right=Math.max(x1,x2), bottom=Math.max(y1,y2);
    if (right-left<8 || bottom-top<8) return null;
    const matched=[], rects=[];
    scrollEl.querySelectorAll(".textLayer span").forEach(span => {
      const sr = span.getBoundingClientRect();
      if (sr.right>=left && sr.left<=right && sr.bottom>=top && sr.top<=bottom && span.textContent?.trim()) {
        matched.push(span.textContent);
        let pEl=span; while(pEl&&!pEl.dataset?.page) pEl=pEl.parentElement;
        const pr = pEl ? pEl.getBoundingClientRect() : sr;
        rects.push({x:sr.left-pr.left, y:sr.top-pr.top, w:sr.width, h:sr.height});
      }
    });
    if (!matched.length) return null;
    // Paginanummer van eerste gevonden span
    const first = scrollEl.querySelector(".textLayer span");
    let pg = pageNum;
    scrollEl.querySelectorAll(".textLayer span").forEach(span => {
      const sr=span.getBoundingClientRect();
      if (sr.right>=left&&sr.left<=right&&sr.bottom>=top&&sr.top<=bottom) {
        let el=span; while(el&&!el.dataset?.page) el=el.parentElement;
        if(el&&el.dataset?.page) { pg=parseInt(el.dataset.page,10); return; }
      }
    });
    return { text: matched.join(" ").replace(/\s+/g," ").trim(), rects, page:pg };
  }, [pageNum]);

  const finalizeDragSel = useCallback((x1,y1,x2,y2) => {
    setSelRect(null);
    const result = collectTextInRect(x1,y1,x2,y2);
    if (!result||result.text.length<2) return;

    // Normaliseer rects relatief aan de pagina-wrapper
    const pgWrap = pageRefs.current[result.page];
    const cw = pgWrap ? pgWrap.offsetWidth  : (renderedPages.find(p=>p.num===result.page)?.width  || 1);
    const ch = pgWrap ? pgWrap.offsetHeight : (renderedPages.find(p=>p.num===result.page)?.height || 1);
    const mergedRects = mergeRectsByLine(result.rects);
    const normRects = mergedRects.map(r=>({
      x: r.x/cw, y: r.y/ch, w: r.w/cw, h: r.h/ch,
    })).filter(r=>r.w>0&&r.h>0);

    pendingRectsRef.current = mergedRects;  // origineel voor saveHighlight
    pendingPageRef.current  = result.page;

    if (hlMode==="hl") {
      // Direct opslaan als pure highlight — colorId (niet color)
      const hid="hl_"+Date.now()+"_"+Math.random().toString(36).slice(2,6);
      AnnotationStore.add({
        id:hid, file:pdfFile?.name||"", page:result.page,
        text:result.text, note:"", colorId:activeColor.id,
        rects:normRects, tags:[], createdAt:new Date().toISOString(), hlOnly:true,
      });
      setHighlights(AnnotationStore.getAll());
    } else {
      // Toon popup voor annotatie
      // Bereken toolbar-positie vanuit dragSelRect
      const cx = (Math.min(selRect?.x1||0,selRect?.x2||0) + Math.abs((selRect?.x2||0)-(selRect?.x1||0))/2) || window.innerWidth/2;
      const cy = Math.min(selRect?.y1||0,selRect?.y2||0) - 12;
      setFloatNote(""); setFloatOpen(false);
      setFloatBar({ x: cx, y: Math.max(80, cy), text: result.text, above: cy > 80 });
    }
  }, [hlMode, pdfFile, activeColor, collectTextInRect, renderedPages]);


  // ── B: Apple Pencil + A: SelectMode — sleep-rechthoek selectie ──────────
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onDown = (e) => {
      const isPen   = e.pointerType === "pen";
      const isTouch = e.pointerType === "touch";
      const isMouse = e.pointerType === "mouse" || e.pointerType === "";

      // Muis: native browser-selectie — GEEN rechthoek, geen preventDefault
      // Browser doet dit zelf via window.getSelection(), mouseup → tryOpenAnnotPopup
      if (isMouse) return;

      // Pencil: altijd rechthoek-modus
      // Touch: alleen als selectMode aan staat
      if (!isPen && !isTouch) return;
      if (isTouch && !selectMode) return;
      if (e.target.closest?.('[data-annot-popup]')) return;
      e.preventDefault();  // blokkeer scroll alleen voor touch/pencil

      pencilActiveRef.current = isPen;
      const x = e.clientX, y = e.clientY;
      dragSelRef.current = { startX:x, startY:y, endX:x, endY:y };
      setSelRect({ x1:x, y1:y, x2:x, y2:y });
    };

    const onMove = (e) => {
      if (!dragSelRef.current) return;
      if (e.pointerType === "mouse") return;  // muis gebruikt native selectie
      e.preventDefault();
      dragSelRef.current.endX = e.clientX;
      dragSelRef.current.endY = e.clientY;
      setSelRect({ x1:dragSelRef.current.startX, y1:dragSelRef.current.startY,
                   x2:e.clientX, y2:e.clientY });
    };

    const onUp = (e) => {
      if (e.pointerType === "mouse") return;  // muis: mouseup handler doet dit al
      if (!dragSelRef.current) return;
      const {startX,startY,endX,endY} = dragSelRef.current;
      dragSelRef.current = null;
      pencilActiveRef.current = false;
      finalizeDragSel(startX,startY,endX||e.clientX,endY||e.clientY);
    };

    el.addEventListener("pointerdown",  onDown);
    el.addEventListener("pointermove",  onMove);
    el.addEventListener("pointerup",    onUp);
    el.addEventListener("pointercancel",onUp);
    return () => {
      el.removeEventListener("pointerdown",  onDown);
      el.removeEventListener("pointermove",  onMove);
      el.removeEventListener("pointerup",    onUp);
      el.removeEventListener("pointercancel",onUp);
    };
  }, [selectMode, finalizeDragSel]);

  // ── A: Selectiemodus: pas touchAction aan bij toggle ─────────────────────
  useEffect(() => {
    if (!scrollRef.current) return;
    const action = selectMode ? "none" : "pan-y";
    _setTextLayerTouch(action);
  }, [selectMode]);

  // iOS selectionchange → zweefknop
  useEffect(() => {
    if (navigator.maxTouchPoints < 1) return;
    let t = null;
    const fn = () => {
      clearTimeout(t);
      t = setTimeout(() => {  // was 400ms, nu sneller
        const sel = window.getSelection();
        const txt = sel?.toString().trim();
        if (!txt || txt.length < 2) { setIosAnnotBtn(null); return; }
        const scrollEl = scrollRef.current; if (!scrollEl) return;
        try {
          const range = sel.getRangeAt(0);
          if (!scrollEl.contains(range.commonAncestorContainer)) { setIosAnnotBtn(null); return; }
          const r = range.getBoundingClientRect();
          const viewH = window.innerHeight;
          // Plaats de knop ONDER de selectie zodat hij niet overlapt met de iOS copy/paste balk
          const btnY = r.bottom + 12;
          // Als de knop te laag zou komen, toch boven plaatsen (maar dan ver genoeg: +60px)
          const y = btnY + 48 < viewH ? btnY : Math.max(8, r.top - 60);
          const x = Math.max(8, Math.min((r.left+r.right)/2 - 60, window.innerWidth - 128));
          setIosAnnotBtn({ x, y });
        } catch(e) { setIosAnnotBtn(null); }
      }, 100);
    };
    document.addEventListener('selectionchange', fn);
    return () => { document.removeEventListener('selectionchange', fn); clearTimeout(t); };
  }, []);

  // Subscribe op AnnotationStore — blijft in sync met andere tabs
  React.useEffect(() => {
    const unsub = AnnotationStore.subscribe(all => {
      setHighlights([...all]);
      setPdfNotes([...all]);
    });
    return unsub;
  }, []);

  const saveHighlight=async()=>{
    const _pendingTxt = floatBar?.text || pendingSel;
    if(!_pendingTxt)return;
    // Gebruik de pagina van de selectie (ref), niet de huidige scroll-pagina
    const hlPage = pendingPageRef.current;
    zklog("[PDF] saveHighlight: page=",hlPage,"rects=",pendingRectsRef.current.length);
    const pgWrap = pageRefs.current[hlPage];
    const cw = pgWrap ? pgWrap.offsetWidth  : (renderedPages.find(p=>p.num===hlPage)?.width  || 1);
    const ch = pgWrap ? pgWrap.offsetHeight : (renderedPages.find(p=>p.num===hlPage)?.height || 1);
    const rects = mergeRectsByLine(pendingRectsRef.current).map(r=>({
      x: r.x/cw, y: r.y/ch, w: r.w/cw, h: r.h/ch,
    })).filter(r => r.w>0 && r.h>0);
    const fname = pdfFile?.name||"PDF";
    const hid = genId();
    const chosenColor = pendingColorRef.current || activeColor;
    const h={id:hid, text:_pendingTxt, note:floatNote, tags:quickTags,
             page:hlPage, file:fname,
             colorId:chosenColor.id, rects,
             created:new Date().toISOString()};
    await AnnotationStore.add(h);
    // Maak ook een Zettelkasten-notitie aan
    if (onAddNote) {
      const stem = fname.replace(/\.pdf$/i,"");
      const lines = [
        `> ${_pendingTxt}`,
        "",
        ...(floatNote ? [floatNote, ""] : []),
        `---`,
        `📄 **Bron:** [[pdf:${fname}]] · pagina ${hlPage}`,
        `🏷 annotatie-id: ${hid}`,
      ];
      await onAddNote({
        id: genId(),
        title: `📌 ${_pendingTxt.slice(0,60)}${_pendingTxt.length>60?"…":""}`,
        content: lines.join("\n"),
        tags: [...new Set(["highlight","pdf",stem,...(quickTags||[])])],
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      });
    }
    const savedTop  = scrollRef.current?.scrollTop  || 0;
    const savedLeft = scrollRef.current?.scrollLeft || 0;

    setPendingSel(null); setFloatBar(null); setFloatNote(""); setFloatOpen(false); setQuickNote(""); setQuickTags([]);
    pendingRectsRef.current=[];
    pendingPageRef.current=1;
    window.getSelection()?.removeAllRanges();

    // Herstel scroll-positie na re-render
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop  = savedTop;
        scrollRef.current.scrollLeft = savedLeft;
      }
    });
  };

  // ── Leesnotitie opslaan ─────────────────────────────────────────────────────
  const saveNotePanel = async () => {
    if (!pdfFile || !noteContent.trim()) return;
    setNoteSaving(true);
    const stem    = pdfFile.name.replace(/\.pdf$/i, "");
    const existing = notes.find(n =>
      (n.tags||[]).includes("leesnotitie") && (n.tags||[]).includes(stem)
    );
    const note = {
      id:       existing?.id || genId(),
      title:    `Leesnotitie: ${stem}`,
      content:  noteContent,
      tags:     ["leesnotitie", stem],
      noteType: "literature",
      created:  existing?.created || new Date().toISOString(),
      modified: new Date().toISOString(),
    };
    if (onAddNote) await onAddNote(note);
    setNoteSaving(false);
    // Bevestigings-animatie: kort groen
    setTimeout(() => setNoteContent(prev => prev), 100);
  };

  // ── Feature 3: Exporteer alle annotaties als één literatuurnotitie ──────────
  const exportAllAnnotations = async () => {
    if (!pdfFile || fileHl.length === 0) return;
    const stem  = pdfFile.name.replace(/\.pdf$/i, "");
    const lines = [
      `# Annotaties: ${stem}`,
      ``,
      `📄 **Bron:** [[pdf:${pdfFile.name}]]`,
      `**Geëxporteerd:** ${new Date().toLocaleDateString("nl-NL")}`,
      `**Aantal annotaties:** ${fileHl.length}`,
      ``,
    ];

    // Groepeer op pagina
    const byPage = {};
    for (const h of [...fileHl].sort((a,b)=>a.page-b.page)) {
      if (!byPage[h.page]) byPage[h.page] = [];
      byPage[h.page].push(h);
    }

    for (const [page, annots] of Object.entries(byPage)) {
      lines.push(`## Pagina ${page}`, ``);
      for (const h of annots) {
        const col = HCOLORS.find(c=>c.id===h.colorId)||HCOLORS[0];
        // Highlight tekst met kleur-label
        if (h.text) {
          lines.push(`> ${h.text}`);
          lines.push(`> — *${col.label}* · p.${h.page}`);
          // Als kleur een laag-koppeling heeft, voeg inline markering toe
          if (col.layer) {
            lines.push(``, `[${h.text.slice(0,120)}]{.${col.layer}}`);
          }
        }
        // Bijbehorende notitie
        if (h.note?.trim()) {
          lines.push(``, `**Notitie:** ${h.note}`, ``);
        } else {
          lines.push(``);
        }
      }
    }

    // Voeg leesnotitie toe als die bestaat
    if (noteContent.trim()) {
      lines.push(`---`, `## Leesnotitie`, ``, noteContent);
    }

    const note = {
      id:       genId(),
      title:    `Annotaties: ${stem}`,
      content:  lines.join("\n"),
      tags:     ["annotaties", "pdf", stem],
      noteType: "literature",
      created:  new Date().toISOString(),
      modified: new Date().toISOString(),
    };
    if (onAddNote) await onAddNote(note);
  };

  // ── Fit-width berekening ─────────────────────────────────────────────────
  const calcFitWidthScale = React.useCallback(async () => {
    if (!pdfDoc) return null;
    // Wacht tot de container een breedte heeft
    let containerW = scrollRef.current ? scrollRef.current.clientWidth : 0;
    if (containerW < 50) {
      await new Promise(r => requestAnimationFrame(r));
      containerW = scrollRef.current ? scrollRef.current.clientWidth : 0;
    }
    if (containerW < 50) return null;

    // Gebruik de huidige pagina — niet altijd pagina 1
    // Sommige PDFs hebben een afwijkend formaat op de eerste pagina
    const targetPage = Math.min(pageNum, pdfDoc.numPages);
    const page = await pdfDoc.getPage(targetPage);

    // Houd rekening met de ingebouwde PDF-rotatie (page.rotate)
    // PDF.js telt onze rotation op bij page.rotate intern
    // getViewport zonder rotation geeft de 'natural' afmetingen na page.rotate
    const naturalVp = page.getViewport({ scale: 1 });
    // Tel onze handmatige rotatie erbij op
    const totalRotation = (rotation + (page.rotate || 0)) % 360;
    // Bij 90° of 270° zijn breedte en hoogte omgewisseld
    const pageW = (totalRotation === 90 || totalRotation === 270)
      ? naturalVp.height   // geroteerd: hoogte wordt de breedte
      : naturalVp.width;

    const fitScale = (containerW - 32) / pageW;
    return Math.max(0.3, Math.min(4, fitScale));
  }, [pdfDoc, rotation, pageNum]);

  const applyFitWidth = React.useCallback(async () => {
    const sc = await calcFitWidthScale();
    if (sc !== null && sc !== scale) {
      setScale(sc);
    }
  }, [calcFitWidthScale, scale]);

  // Re-apply fit-width bij resize via ResizeObserver (met debounce)
  React.useEffect(() => {
    if (!fitWidth || !scrollRef.current) return;
    let timer;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => applyFitWidth(), 100);
    });
    observer.observe(scrollRef.current);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, [fitWidth, applyFitWidth]);

  // Re-apply fit-width bij rotatie of nieuw PDF-document
  React.useEffect(() => {
    if (fitWidth && pdfDoc) {
      // Kleine vertraging zodat PDF.js de pagina al heeft geladen
      const t = setTimeout(() => applyFitWidth(), 150);
      return () => clearTimeout(t);
    }
  }, [rotation, fitWidth, pdfDoc]);

  // ── Zoeken in PDF ────────────────────────────────────────────────────────
  // Markeer gevonden tekst visueel in de textLayer
  const _highlightSearchInDom = React.useCallback((query) => {
    if (!scrollRef.current || !query) return;
    scrollRef.current.querySelectorAll(".zk-search-hl").forEach(el => {
      el.style.background = ""; el.style.outline = "";
      el.classList.remove("zk-search-hl");
    });
    if (!query.trim()) return;
    const q = query.toLowerCase();
    scrollRef.current.querySelectorAll(".textLayer span").forEach(span => {
      if (span.textContent.toLowerCase().includes(q)) {
        span.style.background   = "rgba(234,231,136,0.75)";
        span.style.outline      = "2px solid rgba(200,160,0,0.8)";
        span.style.borderRadius = "2px";
        span.classList.add("zk-search-hl");
      }
    });
  }, []);

  const _clearSearchHl = React.useCallback(() => {
    scrollRef.current?.querySelectorAll(".zk-search-hl").forEach(el => {
      el.style.background=""; el.style.outline="";
      el.classList.remove("zk-search-hl");
    });
  }, []);

  const searchInPdf = React.useCallback(async (query) => {
    if (!pdfDoc || !query.trim()) {
      setSearchHits([]); setSearchHitIdx(0); setIsSearching(false);
      _clearSearchHl();
      return;
    }

    const myId = ++searchIdRef.current;
    setIsSearching(true);
    setSearchHits([]);
    setSearchHitIdx(0);
    _clearSearchHl();

    const hits = [];
    const q    = query.toLowerCase();

    for (let p = 1; p <= pdfDoc.numPages; p++) {
      if (searchIdRef.current !== myId) { setIsSearching(false); return; }
      try {
        const page = await pdfDoc.getPage(p);
        if (searchIdRef.current !== myId) { setIsSearching(false); return; }
        const tc   = await page.getTextContent();
        if (searchIdRef.current !== myId) { setIsSearching(false); return; }

        // Bouw pagina-tekst correct op: houd EOL-informatie in acht
        let text = "";
        for (const item of tc.items) {
          if (item.str) text += item.str;
          // Voeg spatie toe als er een significante horizontale gap is
          if (item.hasEOL) text += " ";
          else if (item.width && item.width > 0) text += " ";
        }

        const lower = text.toLowerCase();
        let idx = lower.indexOf(q);
        while (idx !== -1) {
          hits.push({
            page: p,
            idx,
            text: text.slice(Math.max(0, idx-25), idx+query.length+25).trim(),
          });
          idx = lower.indexOf(q, idx + 1);
        }
      } catch(e) { /* sla over */ }
    }

    if (searchIdRef.current !== myId) { setIsSearching(false); return; }

    // Één state-update aan het einde — geen tussentijdse updates die scroll resetten
    setSearchHits([...hits]);
    setSearchHitIdx(0);
    setIsSearching(false);

    if (hits.length > 0) {
      const pg = hits[0].page;
      setPageNum(pg);
      if (scrollToPageRef.current) scrollToPageRef.current(pg);
      if (pdfDoc) renderNearby(pdfDoc, scale, rotation, pg);
      setTimeout(() => {
        if (searchIdRef.current === myId) _highlightSearchInDom(query);
      }, 500);
    }
  }, [pdfDoc, scale, rotation, renderNearby, _highlightSearchInDom, _clearSearchHl]);



  const nextSearchHit = React.useCallback(() => {
    if (!searchHits.length) return;
    const next = (searchHitIdx + 1) % searchHits.length;
    setSearchHitIdx(next);
    const pg = searchHits[next].page;
    setPageNum(pg);
    if (scrollToPageRef.current) scrollToPageRef.current(pg);
    if (pdfDoc) renderNearby(pdfDoc, scale, rotation, pg);
    setTimeout(() => _highlightSearchInDom(pdfSearch), 350);
  }, [searchHits, searchHitIdx, pdfDoc, scale, rotation, renderNearby, _highlightSearchInDom, pdfSearch]);

  const prevSearchHit = React.useCallback(() => {
    if (!searchHits.length) return;
    const prev = (searchHitIdx - 1 + searchHits.length) % searchHits.length;
    setSearchHitIdx(prev);
    const pg = searchHits[prev].page;
    setPageNum(pg);
    if (scrollToPageRef.current) scrollToPageRef.current(pg);
    if (pdfDoc) renderNearby(pdfDoc, scale, rotation, pg);
    setTimeout(() => _highlightSearchInDom(pdfSearch), 350);
  }, [searchHits, searchHitIdx, pdfDoc, scale, rotation, renderNearby, _highlightSearchInDom, pdfSearch]);

  const updateHighlight=async(id,patch)=>{
    await AnnotationStore.update(id, patch);
  };

  const removeHighlight=async(id)=>{
    await AnnotationStore.remove(id);
    if(editingId===id)setEditingId(null);
  };

  // Alleen annotaties van de actief geopende PDF tonen
  const fileHl = pdfFile ? highlights.filter(h=>h.file===pdfFile.name) : [];
  const allAnnotTags=[...new Set(fileHl.flatMap(h=>h.tags||[]))];
  const panelHl = (filterTag ? fileHl.filter(h=>(h.tags||[]).includes(filterTag)) : fileHl)
    .sort((a,b)=>a.page-b.page);  // gesorteerd op pagina

  return React.createElement("div",{style:{display:"flex",flex:1,minHeight:0,background:W.bg,overflow:"hidden",position:"relative"}},
    // Main PDF column
    React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0,minHeight:0}},
      // Toolbar
      React.createElement("div",{style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,padding:"6px 10px",display:"flex",alignItems:"center",gap:"6px",fontSize:"14px",flexShrink:0,flexWrap:"wrap"}},

        // ── Bestand ──────────────────────────────────────────────────────
        pdfDoc && React.createElement("button",{onClick:()=>fileRef.current.click(),
          title:"Importeer PDF",
          style:{display:"flex",alignItems:"center",gap:"5px",background:W.blue,color:W.bg,border:"none",borderRadius:"4px",padding:"5px 10px",fontSize:"13px",cursor:"pointer",fontWeight:"bold"}
        }, React.createElement(PdfIcon,{name:"upload"}), "Importeer"),
        !pdfDoc && React.createElement("button",{
          onClick:()=>{ setShowLibrary(!showLibrary); },
          style:{display:"flex",alignItems:"center",gap:"6px",background:showLibrary?W.comment:"none",color:showLibrary?W.bg:W.fgMuted,
                 border:`1px solid ${showLibrary?W.comment:W.splitBg}`,
                 borderRadius:"4px",padding:"5px 10px",fontSize:"14px",cursor:"pointer"}
        }, `📚 Bibliotheek (${serverPdfs?.length||0})`),
        React.createElement("input",{ref:fileRef,type:"file",accept:".pdf",style:{display:"none"},onChange:onFileInput}),
        !pdfjsReady&&React.createElement("span",{style:{color:W.orange,fontSize:"14px"}},"pdf.js laden…"),

        // AI samenvatten indicator
        summarizing && React.createElement("div",{
          style:{display:"flex",alignItems:"center",gap:"5px",
                 background:"rgba(138,198,242,0.08)",
                 border:"1px solid rgba(138,198,242,0.25)",
                 borderRadius:"10px",padding:"2px 10px",
                 color:"#a8d8f0",fontSize:"14px",
                 animation:"ai-pulse 1.4s ease-in-out infinite"}
        },
          React.createElement("span",{style:{
            display:"inline-block",width:"6px",height:"6px",borderRadius:"50%",
            background:"#a8d8f0",animation:"ai-dot 1.4s ease-in-out infinite"}}),
          "Samenvatten…"
        ),
        // Foutmelding samenvatting
        summarizeErr && React.createElement("span",{
          style:{color:W.orange,fontSize:"14px",cursor:"pointer"},
          title:summarizeErr,
          onClick:()=>setSummarizeErr(null)
        },"⚠ samenvatten mislukt ×"),

        pdfDoc && React.createElement(React.Fragment,null,
          React.createElement(PdfToolbarDivider,{W}),

          // ── Groep: navigatie ───────────────────────────────────────────
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"2px"}},
            React.createElement("button",{onClick:()=>{ const p=Math.max(1,pageNum-1); setPageNum(p); scrollToPage(p); if(pdfDoc) renderNearby(pdfDoc,scale,rotation,p); },
              title:"Vorige pagina",
              style:{display:"flex",background:"none",border:"none",color:W.fg,cursor:"pointer",padding: isTablet?"7px":"4px"}
            }, React.createElement(PdfIcon,{name:"chevronLeft",size:isTablet?18:15})),
            React.createElement("span",{style:{color:W.statusFg,minWidth:"55px",textAlign:"center",fontSize:"13px"}},pageNum," / ",numPages),
            React.createElement("button",{onClick:()=>{ const p=Math.min(numPages,pageNum+1); setPageNum(p); scrollToPage(p); if(pdfDoc) renderNearby(pdfDoc,scale,rotation,p); },
              title:"Volgende pagina",
              style:{display:"flex",background:"none",border:"none",color:W.fg,cursor:"pointer",padding: isTablet?"7px":"4px"}
            }, React.createElement(PdfIcon,{name:"chevronRight",size:isTablet?18:15})),
          ),

          React.createElement(PdfToolbarDivider,{W}),

          // ── Groep: zoom + zoeken ───────────────────────────────────────
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"2px"}},
            React.createElement("button",{onClick:()=>{ setFitWidth(false); userScaleRef.current=Math.max(0.5,+(scale-0.2).toFixed(1)); setScale(userScaleRef.current); },
              title:"Uitzoomen",
              style:{display:"flex",background:"none",border:"none",color:W.fg,cursor:"pointer",padding: isTablet?"7px":"4px"}
            }, React.createElement(PdfIcon,{name:"minus",size:isTablet?18:15})),
            React.createElement("span",{style:{color:W.fgMuted,minWidth:"36px",textAlign:"center",fontSize:"13px"}},Math.round(scale*100),"%"),
            React.createElement("button",{onClick:()=>{ setFitWidth(false); userScaleRef.current=Math.min(3,+(scale+0.2).toFixed(1)); setScale(userScaleRef.current); },
              title:"Inzoomen",
              style:{display:"flex",background:"none",border:"none",color:W.fg,cursor:"pointer",padding: isTablet?"7px":"4px"}
            }, React.createElement(PdfIcon,{name:"plus",size:isTablet?18:15})),
            React.createElement("button",{
              onClick:()=>{ setPdfSearchOpen(o=>!o); if(pdfSearchOpen){ setPdfSearch(""); setSearchHits([]); searchIdRef.current++; scrollRef.current?.querySelectorAll(".zk-search-hl").forEach(el=>{el.style.background="";el.style.outline="";el.classList.remove("zk-search-hl");}); } },
              title:"Zoeken in PDF",
              style:{display:"flex",background:pdfSearchOpen?`${W.yellow}18`:"none",
                     border:pdfSearchOpen?`1px solid ${W.yellow}44`:"1px solid transparent",
                     borderRadius:"4px",color:pdfSearchOpen?W.yellow:W.fgMuted,
                     cursor:"pointer",padding: isTablet?"7px":"4px", marginLeft:"2px"},
            }, React.createElement(PdfIcon,{name:"search",size:isTablet?18:15})),
          ),

          // ── Groep: selectiemodus (alleen tablet/iPad) ───────────────────
          isTablet && React.createElement(React.Fragment,null,
            React.createElement(PdfToolbarDivider,{W}),
            React.createElement("button",{
              onClick:()=>setSelectMode(m=>!m),
              title: selectMode ? "Selectiemodus aan — tik om scrollen te herstellen" : "Selectiemodus: schakel in om met vinger/pencil tekst te selecteren",
              style:{
                display:"flex", alignItems:"center", gap:"5px",
                background: selectMode ? (W.yellow+"22"||"rgba(234,231,136,.2)") : "none",
                border: selectMode ? `1px solid ${W.yellow}` : "1px solid transparent",
                borderRadius:"6px",
                color: selectMode ? W.yellow : W.fgMuted,
                cursor:"pointer", padding:"7px 9px", lineHeight:1,
                fontWeight: selectMode ? "600" : "400",
                position:"relative",
              }
            },
              React.createElement(PdfIcon,{name:"hand",size:18}),
              selectMode && "Selecteer",
              selectMode && React.createElement("span",{style:{
                position:"absolute", top:"-3px", right:"-3px",
                width:"8px", height:"8px", borderRadius:"50%",
                background:W.yellow, display:"block",
              }})
            )
          ),

          React.createElement(PdfToolbarDivider,{W}),

          // ── Groep: markeren ──────────────────────────────────────────────
          // Eén samenhangende segmented control i.p.v. drie losse, bijna
          // identieke potlood-emoji — de tekstlabels maken op desktop meteen
          // duidelijk wat elke modus doet; op tablet blijft alleen het icoon
          // over (ruimtegebrek), maar de tooltip legt het nog steeds uit.
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"7px"}},
            React.createElement("div",{style:{display:"flex",border:`1px solid ${W.splitBg}`,borderRadius:"6px",overflow:"hidden"}},
              ...[
                {id:"hl",      icon:"highlighter", label:"Markeer",         title:"Alleen markeren — geen popup"},
                {id:"hl+annot",icon:"highlighter", label:"Markeer+notitie", title:"Markeren + annotatie"},
                {id:"annot",   icon:"note",         label:"Notitie",        title:"Alleen annotatie"},
              ].map((m,i) => React.createElement("button",{
                key:m.id,
                onClick:()=>setHlMode(m.id),
                title:m.title,
                style:{
                  display:"flex",alignItems:"center",gap:"5px",
                  background: hlMode===m.id ? (W.blueBg2||"rgba(138,198,242,.15)")  : "none",
                  border:"none", borderLeft: i>0?`1px solid ${W.splitBg}`:"none",
                  borderRadius:0, color: hlMode===m.id ? W.blue : W.fgMuted,
                  cursor:"pointer", padding: isTablet?"7px 9px":"5px 9px", fontSize:"12px",
                  fontWeight: hlMode===m.id?"600":"400",
                }
              },
                React.createElement(PdfIcon,{name:m.icon,size:14}),
                !isTablet && m.label
              ))
            ),
            React.createElement("div",{style:{display:"flex",gap:"4px"}},
              ...HCOLORS.map(c=>React.createElement("button",{key:c.id,onClick:()=>setActiveColor(c),title:c.label,
                style:{width: isTablet?"22px":"18px",height: isTablet?"22px":"18px",borderRadius:"4px",background:c.bg,
                       border:`2px solid ${activeColor.id===c.id?c.border:"transparent"}`,cursor:"pointer",padding:0,
                       boxShadow:activeColor.id===c.id?`0 0 6px ${c.border}`:"none"}})),
            ),
          ),

          React.createElement(PdfToolbarDivider,{W}),

          // ── Groep: panelen ───────────────────────────────────────────────
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"2px"}},
            pdfFile && React.createElement("button",{
              onClick:()=>setShowHlPanel(p=>!p),
              title:"Highlights overzicht",
              style:{display:"flex",
                background: showHlPanel ? W.yellowBg||"rgba(234,231,136,.1)" : "none",
                border: showHlPanel ? `1px solid ${W.yellow}` : "1px solid transparent",
                borderRadius:"4px", color: showHlPanel ? W.yellow : W.fgMuted,
                cursor:"pointer", padding: isTablet?"7px":"4px",
              }
            }, React.createElement(PdfIcon,{name:"listDetails",size:isTablet?18:15})),
            pdfFile && React.createElement("button",{
              onClick:()=>setShowRelated(p=>!p),
              title:"Verwante notities (op basis van geselecteerde/gehighlighte tekst)",
              style:{display:"flex",
                background: showRelated ? W.blueBg2 : "none",
                border: showRelated ? `1px solid ${W.blueBorder||"rgba(138,198,242,.3)"}` : "1px solid transparent",
                borderRadius:"4px", color: showRelated ? W.blue : W.fgMuted,
                cursor:"pointer", padding: isTablet?"7px":"4px",
              }
            }, React.createElement(PdfIcon,{name:"link",size:isTablet?18:15})),
            pdfFile && React.createElement("button",{
              onClick:()=>{
                setShowNotePanel(p=>!p);
                if(!showNotePanel) setShowAnnotPanel(false);
              },
              title:"Leesnotitie (per-pagina aantekeningen)",
              style:{display:"flex",
                background: showNotePanel ? W.commentBg||"rgba(159,202,86,.1)" : "none",
                border: showNotePanel ? `1px solid ${W.commentBorder||"rgba(159,202,86,.3)"}` : "1px solid transparent",
                borderRadius:"4px", color: showNotePanel ? W.comment : W.fgMuted,
                cursor:"pointer", padding: isTablet?"7px":"4px",
              }
            }, React.createElement(PdfIcon,{name:"edit",size:isTablet?18:15})),
          ),

          React.createElement(PdfToolbarDivider,{W}),

          // ── Groep: overig ────────────────────────────────────────────────
          // Op tablet/smal scherm achter een "meer"-knop, want dit zijn
          // incidentele acties, niet iets dat je continu tijdens lezen nodig
          // hebt — op desktop is er ruimte genoeg om ze gewoon te tonen.
          (() => {
            const items = [
              { key:"fit", icon:"fitWidth", label: fitWidth ? "Fit-breedte uit" : "Pas breedte aan op scherm", active: fitWidth,
                onClick: async () => {
                  if (fitWidth) { setFitWidth(false); setScale(userScaleRef.current); }
                  else {
                    userScaleRef.current = scale;
                    if (pdfDoc && scrollRef.current) {
                      const targetPg = Math.min(pageNum, pdfDoc.numPages);
                      const page = await pdfDoc.getPage(targetPg);
                      const naturalVp = page.getViewport({ scale: 1 });
                      const totalRot  = (rotation + (page.rotate || 0)) % 360;
                      const pageW = (totalRot === 90 || totalRot === 270) ? naturalVp.height : naturalVp.width;
                      let cw = scrollRef.current.clientWidth;
                      if (cw < 50) { await new Promise(r => requestAnimationFrame(r)); cw = scrollRef.current.clientWidth; }
                      const sc = Math.max(0.3, Math.min(4, (cw - 32) / pageW));
                      setFitWidth(true); setScale(sc);
                    } else setFitWidth(true);
                  }
                } },
              { key:"layout", icon: pageLayout==="single" ? "layoutSingle" : "layoutScroll",
                label: pageLayout==="scroll" ? "Schakel naar één-paginamodus" : "Schakel naar scrollmodus", active: pageLayout==="single",
                onClick: () => setPageLayout(l=>l==="scroll"?"single":"scroll") },
              { key:"rotate", icon:"rotate", label:"Roteer 90° rechtsom", active:false,
                onClick: () => setRotation(r=>(r+90)%360) },
              onTogglePdfRead && { key:"read", icon: "circleCheck",
                label: (() => { const c=(serverPdfs||[]).find(p=>(p.name||p)===pdfFile?.name); return c?.isRead ? "Markeer als ongelezen" : "Markeer als gelezen"; })(),
                active: (serverPdfs||[]).find(p=>(p.name||p)===pdfFile?.name)?.isRead || false,
                onClick: () => onTogglePdfRead(pdfFile?.name) },
              pageNum > 1 && { key:"tobegin", icon:"skipBack", label:"Terug naar begin (vergeet opgeslagen positie)", active:false,
                onClick: () => { savePdfPage(pdfFile.name, 0); setPageNum(1); scrollToPage(1); } },
            ].filter(Boolean);

            if (!isTablet) {
              return React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"2px"}},
                ...items.map(it => React.createElement("button",{
                  key:it.key, onClick:it.onClick, title:it.label,
                  style:{display:"flex",
                    background: it.active ? `${W.blue}22` : "none",
                    border: it.active ? `1px solid ${W.blue}55` : "1px solid transparent",
                    borderRadius:"4px", color: it.active ? W.blue : W.fgMuted,
                    cursor:"pointer", padding:"4px",
                  }
                }, React.createElement(PdfIcon,{name:it.icon,size:15})))
              );
            }
            // Tablet: achter een "meer"-knop met een uitklapmenu van tekstregels
            return React.createElement("div",{style:{position:"relative"}},
              React.createElement("button",{
                onClick:()=>setToolbarMoreOpen(o=>!o),
                title:"Meer opties",
                style:{display:"flex",
                  background: toolbarMoreOpen ? `${W.blue}18` : "none",
                  border: toolbarMoreOpen ? `1px solid ${W.blue}44` : "1px solid transparent",
                  borderRadius:"4px", color: toolbarMoreOpen ? W.blue : W.fgMuted,
                  cursor:"pointer", padding:"7px",
                }
              }, React.createElement(PdfIcon,{name:"dots",size:18})),
              toolbarMoreOpen && React.createElement("div",{
                style:{position:"absolute",top:"100%",right:0,marginTop:"4px",
                  background:W.bg2,border:`1px solid ${W.splitBg}`,borderRadius:"8px",
                  boxShadow:"0 4px 16px rgba(0,0,0,0.3)",padding:"4px",zIndex:50,minWidth:"220px"}
              },
                ...items.map(it => React.createElement("button",{
                  key:it.key,
                  onClick:()=>{ it.onClick(); setToolbarMoreOpen(false); },
                  style:{display:"flex",alignItems:"center",gap:"10px",width:"100%",
                    background: it.active ? `${W.blue}15` : "none", border:"none",
                    borderRadius:"5px", color: it.active ? W.blue : W.fg,
                    cursor:"pointer", padding:"9px 10px", fontSize:"13px", textAlign:"left",
                  }
                }, React.createElement(PdfIcon,{name:it.icon,size:16}), it.label)),
                pdfFile && React.createElement("button",{
                  onClick:async()=>{
                    setToolbarMoreOpen(false);
                    if(!confirm(`Verwijder "${pdfFile.name}" en alle annotaties?`)) return;
                    const name=pdfFile.name;
                    await PDFService.deletePdf(name);
                    setPdfDoc(null); setPdfFile(null);
                    onRefreshPdfs?.(); onDeletePdf?.(name);
                  },
                  style:{display:"flex",alignItems:"center",gap:"10px",width:"100%",
                    background:"none", border:"none", borderTop:`1px solid ${W.splitBg}`,
                    borderRadius:"5px", color: W.orange,
                    cursor:"pointer", padding:"9px 10px", fontSize:"13px", textAlign:"left", marginTop:"2px",
                  }
                }, React.createElement(PdfIcon,{name:"trash",size:16}), "Verwijder PDF + annotaties")
              )
            );
          })(),

          React.createElement(PdfToolbarDivider,{W}),

          // ── Bestandsnaam + samenvatten (+ verwijderen op desktop) ────────
          React.createElement("span",{style:{color:W.fgMuted,fontSize:"13px",maxWidth: isTablet?"90px":"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},pdfFile?.name),
          pdfFile && onAutoSummarize && React.createElement("button",{
            title:"Maak nu een samenvatting van deze PDF",
            disabled:summarizing,
            onClick:async()=>{
              setSummarizeErr(null);
              setSummarizing(true);
              try{ await onAutoSummarize(pdfFile.name); }
              catch(err){ setSummarizeErr(err?.message||"Samenvatten mislukt"); }
              finally{ setSummarizing(false); }
            },
            style:{display:"flex",alignItems:"center",gap:"5px",background:"rgba(138,198,242,0.08)",
                   border:"1px solid rgba(138,198,242,0.25)",
                   color:summarizing?"#666":"#a8d8f0",
                   borderRadius:"4px",padding: isTablet?"7px 9px":"4px 9px",
                   fontSize:"13px",cursor:summarizing?"not-allowed":"pointer",
                   marginLeft:"2px",flexShrink:0,opacity:summarizing?0.5:1}
          }, React.createElement(PdfIcon,{name:"sparkles",size:14}), !isTablet && (summarizing ? "…" : "Samenvatten")),
          pdfFile && !isTablet && React.createElement("button",{
            onClick:async()=>{
              if(!confirm(`Verwijder "${pdfFile.name}" en alle annotaties?`)) return;
              const name=pdfFile.name;
              await PDFService.deletePdf(name);
              setPdfDoc(null); setPdfFile(null);
              onRefreshPdfs?.();
              onDeletePdf?.(name);
            },
            style:{display:"flex",alignItems:"center",gap:"5px",background:"rgba(229,120,109,0.1)",border:"1px solid rgba(229,120,109,0.25)",
                   color:W.orange,borderRadius:"4px",padding:"4px 9px",
                   fontSize:"13px",cursor:"pointer",marginLeft:"4px",flexShrink:0}
          }, React.createElement(PdfIcon,{name:"trash",size:14}), "Verwijder"),
        ),
        React.createElement("div",{style:{flex:1}}),
        pdfDoc && !isTablet && React.createElement("span",{style:{color:W.comment,fontSize:"13px"}},"① selecteer tekst  ② popup  ③ opslaan")
      ),

      // ── Bibliotheek — volledig scherm als geen PDF open is ─────────────────
      (showLibrary || !pdfDoc) && !pdfDoc && React.createElement("div", { ref: libRef, style: {
        flex: 1, overflowY: "auto", background: W.bg,
        display: "flex", flexDirection: "column", minHeight: 0, WebkitOverflowScrolling: "touch",
      }},

        // ── Header ──────────────────────────────────────────────────────────
        React.createElement("div", { style: {
          padding: "16px 20px 12px",
          borderBottom: `1px solid ${W.splitBg}`,
          display: "flex", flexDirection: "column", gap: "10px",
        }},
          // Titel + import-knop
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "12px" }},
            React.createElement("div", null,
              React.createElement("div", { style: { fontSize: "17px", fontWeight: "700", color: W.statusFg, letterSpacing: "0.3px" }},
                "📚 PDF-bibliotheek"),
              React.createElement("div", { style: { fontSize: "12px", color: W.fgMuted, marginTop: "2px" }},
                `${(serverPdfs||[]).length} document${(serverPdfs||[]).length !== 1 ? "en" : ""} in vault`)
            ),
            React.createElement("div", { style: { flex: 1 }}),
            // Weergave-toggle: grid / lijst
            React.createElement("div", { style: { display: "flex", borderRadius: "6px", overflow: "hidden", border: `1px solid ${W.splitBg}` }},
              ...[["grid","⊞"],["list","☰"]].map(([mode, icon]) =>
                React.createElement("button", {
                  key: mode,
                  onClick: () => setLibView(mode),
                  title: mode === "grid" ? "Rasterweergave" : "Lijstweergave",
                  style: {
                    background: libView === mode ? "rgba(138,198,242,0.15)" : "transparent",
                    color:      libView === mode ? W.blue : W.fgMuted,
                    border: "none", padding: "5px 11px", cursor: "pointer",
                    fontSize: "14px", transition: "all 0.12s",
                  }
                }, icon)
              )
            ),
            React.createElement("button", {
              onClick: () => fileRef.current.click(),
              style: { background: W.blue, color: W.bg, border: "none", borderRadius: "6px",
                       padding: "7px 16px", fontSize: "13px", cursor: "pointer", fontWeight: "700", flexShrink: 0 }
            }, "⬆ PDF importeren")
          ),

          // Zoekbalk
          React.createElement("div", { style: { position: "relative" }},
            React.createElement("span", { style: {
              position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)",
              fontSize: "14px", opacity: 0.4, pointerEvents: "none",
            }}, "🔍"),
            React.createElement("input", {
              value: libSearch,
              onChange: e => setLibSearch(e.target.value),
              placeholder: "Zoek op naam of inhoud…",
              style: {
                width: "100%", background: W.bg2,
                border: `1px solid ${libSearch ? W.blue : W.splitBg}`,
                borderRadius: "7px", padding: "7px 10px 7px 32px",
                color: W.fg, fontSize: "13px", outline: "none",
                transition: "border-color 0.15s", boxSizing: "border-box",
              }
            }),
            libSearch && React.createElement("button", {
              onClick: () => setLibSearch(""),
              style: {
                position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: W.fgMuted,
                cursor: "pointer", fontSize: "14px", lineHeight: 1, padding: "2px 4px",
              }
            }, "×")
          ),

          // ── Status filter-pills ────────────────────────────────────────────
          React.createElement("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" }},
            (() => {
              const all    = serverPdfs || [];
              const unread = all.filter(p => !p.isRead).length;
              const read   = all.filter(p =>  p.isRead).length;
              const offl   = all.filter(p => offlinePdfs.has(p.name)).length;
              return [
                { id:"all",     label:`Alle (${all.length})` },
                { id:"unread",  label:`Ongelezen (${unread})` },
                { id:"read",    label:`Gelezen (${read})` },
                { id:"offline", label:`Offline (${offl})` },
              ].map(f =>
                React.createElement("button", {
                  key: f.id,
                  onClick: () => setLibFilter(f.id),
                  style: {
                    padding: "3px 10px", borderRadius: "12px", fontSize: "11px",
                    cursor: "pointer", border: "none",
                    background: libFilter === f.id ? "rgba(138,198,242,0.18)" : W.bg2,
                    color:      libFilter === f.id ? W.blue : W.fgMuted,
                    fontWeight: libFilter === f.id ? "600" : "400",
                    outline: libFilter === f.id ? `1px solid rgba(138,198,242,0.35)` : "none",
                  }
                }, f.label)
              );
            })()
          )
        ),

        // ── Leeg ──────────────────────────────────────────────────────────────
        (!serverPdfs || serverPdfs.length === 0) && React.createElement("div", { style: {
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: "14px", color: W.fgMuted, padding: "40px",
        }},
          React.createElement("div", { style: { fontSize: "56px" }}, "📄"),
          React.createElement("div", { style: { fontSize: "15px", color: W.fgDim, fontWeight: "600" }},
            "Nog geen PDF's in je bibliotheek"),
          React.createElement("div", { style: { fontSize: "13px", color: W.fgDim, textAlign: "center", maxWidth: "320px", lineHeight: "1.8" }},
            "Klik op '⬆ PDF importeren' om je eerste document toe te voegen."),
          React.createElement("button", {
            onClick: () => fileRef.current.click(),
            style: { background: "rgba(138,198,242,0.15)", border: `1px solid ${W.blue}`,
                     color: W.blue, borderRadius: "6px", padding: "8px 20px",
                     fontSize: "14px", cursor: "pointer", fontWeight: "600" }
          }, "⬆ Importeer eerste PDF")
        ),

        // ── Inhoud: gefilterde lijst ───────────────────────────────────────
        serverPdfs && serverPdfs.length > 0 && (() => {
          const q = libSearch.toLowerCase().trim();
          const filtered = (serverPdfs || []).filter(p => {
            if (q && !p.name.toLowerCase().includes(q) &&
                !p.name.replace(/_/g," ").toLowerCase().includes(q)) return false;
            if (libFilter === "unread"  && p.isRead) return false;
            if (libFilter === "read"    && !p.isRead) return false;
            if (libFilter === "offline" && !offlinePdfs.has(p.name)) return false;
            return true;
          });

          if (filtered.length === 0) return React.createElement("div", { style: {
            padding: "48px 20px", textAlign: "center", color: W.fgMuted, fontSize: "13px",
          }}, `Geen PDF's gevonden voor "${libSearch}"`);

          // ── RASTERWEERGAVE ──────────────────────────────────────────────
          if (libView === "grid") return React.createElement("div", { style: {
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
            gap: "14px", padding: "18px 20px",
          }},
            ...filtered.map(p => {
              const annotCount = (AnnotationStore.getAll() || []).filter(a => a.file === p.name).length;
              const sizeKb = Math.round((p.size || 0) / 1024);
              const isOpen = pdfFile?.name === p.name;
              const stem = p.name.replace(/\.pdf$/i, "");
              const thumb = thumbCache[p.name];
              // Leestijd: ~2 min per 10 KB (ruwe schatting voor gescande PDF)
              const readMins = Math.max(1, Math.round(sizeKb / 50));

              return React.createElement("div", {
                key: p.name,
                style: {
                  background: W.bg2,
                  border: `1px solid ${isOpen ? W.blue : W.splitBg}`,
                  borderRadius: "10px", overflow: "hidden",
                  display: "flex", flexDirection: "column",
                  transition: "border-color 0.15s, box-shadow 0.15s",
                  cursor: "pointer",
                },
                onMouseEnter: e => {
                  e.currentTarget.style.borderColor = W.blue;
                  e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.35)";
                },
                onMouseLeave: e => {
                  e.currentTarget.style.borderColor = isOpen ? W.blue : W.splitBg;
                  e.currentTarget.style.boxShadow = "none";
                },
              },
                // Thumbnail
                React.createElement("div", {
                  onClick: () => openFromServer(p.name),
                  style: {
                    height: "130px", background: thumb ? "transparent" : "rgba(138,198,242,0.05)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    borderBottom: `1px solid ${W.splitBg}`, position: "relative", flexShrink: 0,
                    overflow: "hidden",
                  }
                },
                  thumb
                    ? React.createElement("img", {
                        src: thumb, alt: stem,
                        style: { width: "100%", height: "100%", objectFit: "cover", display: "block" }
                      })
                    : React.createElement("span", { style: { fontSize: "40px", opacity: 0.5 }}, "📄"),
                  annotCount > 0 && React.createElement("div", { style: {
                    position: "absolute", top: "7px", right: "7px",
                    background: "rgba(159,202,86,0.2)", border: "1px solid rgba(159,202,86,0.4)",
                    borderRadius: "10px", padding: "1px 7px",
                    fontSize: "10px", color: W.comment, fontWeight: "700",
                  }}, `${annotCount} ✏`),
                  // Leestijd badge
                  React.createElement("div", { style: {
                    position: "absolute", bottom: "6px", left: "7px",
                    background: "rgba(0,0,0,0.55)", borderRadius: "4px",
                    padding: "1px 6px", fontSize: "10px", color: "rgba(255,255,255,0.7)",
                  }}, `~${readMins} min`)
                ),

                // Info
                React.createElement("div", { style: { padding: "9px 11px", flex: 1, display: "flex", flexDirection: "column", gap: "3px" }},
                  React.createElement("div", {
                    onClick: () => openFromServer(p.name),
                    style: {
                      fontSize: "13px", fontWeight: "600", color: W.fg, lineHeight: "1.35",
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }
                  }, stem),
                  React.createElement("div", { style: { fontSize: "11px", color: W.fgDim, marginTop: "1px" }},
                    sizeKb > 1024 ? `${(sizeKb/1024).toFixed(1)} MB` : `${sizeKb} KB`,
                    annotCount > 0 ? ` · ${annotCount} annotatie${annotCount !== 1 ? "s" : ""}` : ""
                  )
                ),

                // Footer
                React.createElement("div", { style: {
                  padding: "7px 9px", borderTop: `1px solid ${W.splitBg}`,
                  display: "flex", gap: "5px",
                }},
                  React.createElement("button", {
                    onClick: () => openFromServer(p.name),
                    style: { flex: 1, background: "rgba(138,198,242,0.1)", border: `1px solid rgba(138,198,242,0.25)`,
                             color: W.blue, borderRadius: "5px", padding: "4px 0",
                             fontSize: "12px", cursor: "pointer", fontWeight: "600" }
                  }, "📖 Openen"),
                  (() => {
                    const isOfl = offlinePdfs.has(p.name);
                    return React.createElement("button", {
                      title: isOfl ? "Verwijder offline kopie" : "Bewaar voor offline gebruik (iPad zonder verbinding)",
                      onClick: async e => {
                        e.stopPropagation();
                        const btn = e.currentTarget;
                        btn.disabled = true;
                        const oldTxt = btn.textContent;
                        btn.textContent = "⏳";
                        try {
                          if (isOfl) {
                            await removePdfOffline(p.name);
                            setOfflinePdfs(s => { const n = new Set(s); n.delete(p.name); return n; });
                          } else {
                            // BUG (gevonden + gefixt): het resultaat van
                            // cachePdfOffline() werd nooit gecontroleerd —
                            // de knop toonde altijd "✓" zodra de aanroep
                            // terugkwam, ook als de service worker
                            // {ok:false, error:...} teruggaf (bv. PDF was
                            // te groot, netwerkfout tijdens downloaden).
                            // Resultaat: de knop léék gelukt, maar de PDF
                            // stond niet echt in de cache — pas zichtbaar
                            // zodra je daadwerkelijk offline ging.
                            const result = await cachePdfOffline(p.name);
                            if (!result?.ok) {
                              throw new Error(result?.error || "Cachen mislukt — onbekende fout");
                            }
                            setOfflinePdfs(s => new Set([...s, p.name]));
                          }
                        } catch (err) {
                          btn.title = err.message || "Fout bij offline opslaan";
                          btn.textContent = "⚠";
                          btn.disabled = false;
                          return;
                        }
                        btn.disabled = false;
                      },
                      style: { background: isOfl ? "rgba(114,182,96,0.12)" : "none",
                               border: `1px solid ${isOfl ? "rgba(114,182,96,0.5)" : W.splitBg}`,
                               color: isOfl ? "#72b660" : W.fgDim, borderRadius: "5px", padding: "4px 8px",
                               fontSize: "12px", cursor: "pointer" }
                    }, isOfl ? "✓" : "⬇");
                  })(),
                  React.createElement("button", {
                    title: "Verwijder PDF + annotaties",
                    onClick: async e => {
                      e.stopPropagation();
                      if (!confirm(`Verwijder "${p.name}" en alle annotaties?`)) return;
                      await PDFService.deletePdf(p.name);
                      onRefreshPdfs?.();
                      onDeletePdf?.(p.name);
                      if (pdfFile?.name === p.name) { setPdfDoc(null); setPdfFile(null); }
                    },
                    style: { background: "rgba(229,120,109,0.08)", border: "1px solid rgba(229,120,109,0.2)",
                             color: W.orange, borderRadius: "5px", padding: "4px 8px",
                             fontSize: "12px", cursor: "pointer" }
                  }, "🗑")
                )
              );
            })
          );

          // ── LIJSTWEERGAVE ───────────────────────────────────────────────
          return React.createElement("div", { style: { padding: "8px 0" }},
            filtered.map(p => {
              const annotCount = (AnnotationStore.getAll() || []).filter(a => a.file === p.name).length;
              const sizeKb = Math.round((p.size || 0) / 1024);
              const isOpen = pdfFile?.name === p.name;
              const stem = p.name.replace(/\.pdf$/i, "");
              const thumb = thumbCache[p.name];
              const readMins = Math.max(1, Math.round(sizeKb / 50));


  return React.createElement("div", {
                key: p.name,
                style: {
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "9px 20px",
                  borderBottom: `1px solid ${W.splitBg}`,
                  background: isOpen ? "rgba(138,198,242,0.06)" : "transparent",
                  cursor: "pointer", transition: "background 0.1s",
                },
                onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.04)",
                onMouseLeave: e => e.currentTarget.style.background = isOpen ? "rgba(138,198,242,0.06)" : "transparent",
                onClick: () => openFromServer(p.name),
              },
                // Mini-thumbnail
                React.createElement("div", { style: {
                  width: "44px", height: "58px", flexShrink: 0,
                  background: thumb ? "transparent" : "rgba(138,198,242,0.07)",
                  borderRadius: "4px", overflow: "hidden",
                  border: `1px solid ${W.splitBg}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }},
                  thumb
                    ? React.createElement("img", {
                        src: thumb, alt: stem,
                        style: { width: "100%", height: "100%", objectFit: "cover" }
                      })
                    : React.createElement("span", { style: { fontSize: "20px", opacity: 0.5 }}, "📄")
                ),

                // Info
                React.createElement("div", { style: { flex: 1, minWidth: 0 }},
                  React.createElement("div", { style: {
                    fontSize: "14px", fontWeight: "500", color: isOpen ? W.blue : W.fg,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}, stem),
                  React.createElement("div", { style: {
                    display: "flex", gap: "10px", marginTop: "3px",
                    fontSize: "11px", color: W.fgMuted, flexWrap: "wrap",
                  }},
                    React.createElement("span", null,
                      sizeKb > 1024 ? `${(sizeKb/1024).toFixed(1)} MB` : `${sizeKb} KB`),
                    React.createElement("span", { style: { color: W.fgDim }}, `~${readMins} min lezen`),
                    annotCount > 0 && React.createElement("span", { style: { color: W.comment }},
                      `${annotCount} annotatie${annotCount !== 1 ? "s" : ""}`),
                    isOpen && React.createElement("span", { style: {
                      color: W.blue, background: "rgba(138,198,242,0.12)",
                      borderRadius: "4px", padding: "0 5px",
                    }}, "open")
                  )
                ),

                // Acties
                React.createElement("div", { style: { display: "flex", gap: "5px", flexShrink: 0 }},
                  React.createElement("button", {
                    onClick: e => { e.stopPropagation(); openFromServer(p.name); },
                    style: { background: "rgba(138,198,242,0.1)", border: `1px solid rgba(138,198,242,0.25)`,
                             color: W.blue, borderRadius: "5px", padding: "4px 12px",
                             fontSize: "12px", cursor: "pointer", fontWeight: "600" }
                  }, "📖 Open"),
                  (() => {
                    const isOfl = offlinePdfs.has(p.name);
                    return React.createElement("button", {
                      title: isOfl ? "Verwijder offline kopie" : "Bewaar voor offline gebruik (iPad zonder verbinding)",
                      onClick: async e => {
                        e.stopPropagation();
                        const btn = e.currentTarget;
                        btn.disabled = true;
                        btn.textContent = "⏳";
                        try {
                          if (isOfl) {
                            await removePdfOffline(p.name);
                            setOfflinePdfs(s => { const n = new Set(s); n.delete(p.name); return n; });
                          } else {
                            const result = await cachePdfOffline(p.name);
                            if (!result?.ok) {
                              throw new Error(result?.error || "Cachen mislukt — onbekende fout");
                            }
                            setOfflinePdfs(s => new Set([...s, p.name]));
                          }
                        } catch (err) {
                          btn.title = err.message || "Fout bij offline opslaan";
                          btn.textContent = "⚠";
                          btn.disabled = false;
                          return;
                        }
                        btn.disabled = false;
                      },
                      style: { background: isOfl ? "rgba(114,182,96,0.12)" : "none",
                               border: `1px solid ${isOfl ? "rgba(114,182,96,0.5)" : W.splitBg}`,
                               color: isOfl ? "#72b660" : W.fgDim, borderRadius: "5px", padding: "4px 8px",
                               fontSize: "12px", cursor: "pointer" }
                    }, isOfl ? "✓ Offline" : "⬇ Offline");
                  })(),
                  React.createElement("button", {
                    title: "Verwijder",
                    onClick: async e => {
                      e.stopPropagation();
                      if (!confirm(`Verwijder "${p.name}" en alle annotaties?`)) return;
                      await PDFService.deletePdf(p.name);
                      onRefreshPdfs?.();
                      onDeletePdf?.(p.name);
                      if (pdfFile?.name === p.name) { setPdfDoc(null); setPdfFile(null); }
                    },
                    style: { background: "rgba(229,120,109,0.08)", border: "1px solid rgba(229,120,109,0.2)",
                             color: W.orange, borderRadius: "5px", padding: "4px 8px",
                             fontSize: "12px", cursor: "pointer" }
                  }, "🗑")
                )
              );
            })
          );
        })()
      ),

      // ── Scroll area: PDF-viewer (alleen zichtbaar als PDF open is) ──────────
      pdfDoc && React.createElement("div",{style:{
        padding:"4px 12px",background:W.bg2,
        borderBottom:`1px solid ${W.splitBg}`,
        display:"flex",alignItems:"center",gap:"6px",
        fontSize:"13px",flexShrink:0,
      }},
        React.createElement("button",{
          onClick:()=>{ setPdfDoc(null); setPdfFile(null); setShowLibrary(true); },
          style:{background:"none",border:`1px solid ${W.splitBg}`,
                 color:W.fgMuted,borderRadius:"4px",padding:"2px 9px",
                 fontSize:"12px",cursor:"pointer"}
        },"◀ Bibliotheek"),
        React.createElement("span",{style:{color:W.fgMuted}},"│"),
        React.createElement("span",{style:{color:W.fg,maxWidth:"200px",overflow:"hidden",
          textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:"13px"}},
          pdfFile?.name?.replace(/\.pdf$/i,"")||""),
        // "Verder lezen" badge als we niet op pagina 1 staan
        // Selectiemodus indicator
        selectMode && React.createElement("span",{
          style:{
            fontSize:"11px", padding:"2px 8px", borderRadius:"10px",
            background: W.yellow+"22", color:W.yellow,
            border:`1px solid ${W.yellow}55`, flexShrink:0,
            animation:"ai-pulse 2s ease-in-out infinite",
          }
        }, "🖐 Selecteer tekst"),
        pdfFile && pageNum > 1 && React.createElement("span",{
          title:`Opgeslagen positie: pagina ${pageNum}`,
          style:{
            fontSize:"10px", padding:"2px 7px", borderRadius:"10px",
            background: W.blueBg, border:`1px solid ${W.blueBorder}`,
            color: W.blue, flexShrink: 0,
          }
        }, `p.${pageNum} / ${numPages}`),
      ),

      // ── PDF zoekbalk ──────────────────────────────────────────────────────
      pdfDoc && pdfSearchOpen && React.createElement("div",{style:{
          display:"flex", alignItems:"center", gap:"6px",
          padding:"5px 12px", flexShrink:0,
          background:W.bg2, borderBottom:`1px solid ${W.splitBg}`,
        }},
          React.createElement("input",{
            autoFocus:true,
            value:pdfSearch,
            onChange:e=>setPdfSearch(e.target.value),
            onKeyDown:e=>{
              if(e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); searchHits.length ? nextSearchHit() : searchInPdf(pdfSearch); }
              if(e.key==="Enter"&&e.shiftKey)  { e.preventDefault(); prevSearchHit(); }
              if(e.key==="Escape") {
                searchIdRef.current++; setIsSearching(false);
                setPdfSearchOpen(false); setPdfSearch(""); setSearchHits([]);
                _clearSearchHl();
              }
            },
            placeholder:"Zoekterm… dan Enter om te zoeken",
            style:{flex:1,background:W.bg,border:`1px solid ${W.splitBg}`,
                   borderRadius:"5px",padding:"5px 10px",color:W.fg,
                   fontSize:"13px",outline:"none"},
          }),
          React.createElement("button",{
            onClick:()=>searchInPdf(pdfSearch),
            disabled:!pdfSearch.trim(),
            style:{background:`${W.blue}18`,border:`1px solid ${W.blue}44`,
                   borderRadius:"5px",color:W.blue,padding:"4px 12px",
                   fontSize:"12px",cursor:"pointer",fontWeight:"600",flexShrink:0,
                   opacity:pdfSearch.trim()?1:0.4}
          },"Zoek"),
          searchHits.length > 0 && React.createElement(React.Fragment,null,
            React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted,flexShrink:0}},
              `${searchHitIdx+1} / ${searchHits.length}`),
            React.createElement("button",{onClick:prevSearchHit,
              style:{background:"none",border:"none",color:W.fgMuted,cursor:"pointer",fontSize:"16px",padding:"0 4px"}}
            ,"▲"),
            React.createElement("button",{onClick:nextSearchHit,
              style:{background:"none",border:"none",color:W.fgMuted,cursor:"pointer",fontSize:"16px",padding:"0 4px"}}
            ,"▼"),
          ),
          isSearching && React.createElement("span",{
            style:{fontSize:"11px",color:W.blue,flexShrink:0,
                   animation:"ai-pulse 1.4s ease-in-out infinite"}
          }, "⏳ Zoeken…"),
          !isSearching && searchHits.length===0 && pdfSearch && React.createElement("span",{
            style:{fontSize:"11px",color:W.orange,flexShrink:0}
          }, "Niet gevonden"),
          React.createElement("button",{
            onClick:()=>{
              searchIdRef.current++; setIsSearching(false);
              setPdfSearchOpen(false); setPdfSearch(""); setSearchHits([]);
              _clearSearchHl();
            },
            style:{background:"none",border:"none",color:W.fgMuted,cursor:"pointer",fontSize:"16px",padding:"0 4px",flexShrink:0}
          },"×"),
        ),

      // ── Scroll area: alle pagina's doorlopend (alleen als PDF open is) ────────
      pdfDoc && React.createElement("div",{style:{flex:1, position:"relative", minHeight:0, overflow:"hidden"}},
      React.createElement("div",{
        ref:scrollRef,
        style:{
          position:"absolute", inset:0, overflow:"auto", background:W.lineNrBg,
          WebkitOverflowScrolling:"touch",
          touchAction: selectMode ? "none" : "pan-y",
          // iOS Safari: expliciete hoogte zodat overflow:auto weet hoe groot te scrollen
          height:"100%", width:"100%",
        },
        onMouseUp: e => {
          if (e.target.closest && e.target.closest('[data-annot-popup]')) return;
          setTimeout(() => tryOpenAnnotPopup(), 80);
        },
        onTouchStart:(e)=>{
          if(e.touches.length===2){
            const dx=e.touches[0].clientX-e.touches[1].clientX;
            const dy=e.touches[0].clientY-e.touches[1].clientY;
            pinchRef.current={active:true, dist0:Math.hypot(dx,dy), scale0:scale};
            // Geen preventDefault hier — dat blokkeert iOS single-finger scroll
          }
        },
        onTouchMove:(e)=>{
          // Alleen blokkeren bij 2-vinger pinch, nooit bij 1-vinger scroll
          if(!pinchRef.current.active||e.touches.length!==2)return;
          e.preventDefault();
          const dx=e.touches[0].clientX-e.touches[1].clientX;
          const dy=e.touches[0].clientY-e.touches[1].clientY;
          const dist=Math.hypot(dx,dy);
          const ratio=dist/pinchRef.current.dist0;
          const newScale=Math.min(4,Math.max(0.5,+(pinchRef.current.scale0*ratio).toFixed(2)));
          setScale(newScale);
        },
        onTouchEnd:()=>{ pinchRef.current.active=false; },
      },
        isLoading&&React.createElement("div",{style:{display:"flex",alignItems:"center",
          justifyContent:"center",height:"200px"}},
          React.createElement("span",{style:{color:W.blue,fontSize:"14px"}},"laden…")
        ),
        // Visuele sleep-selectie rechthoek met afmetings-hint
        selRect && React.createElement("div",{
          style:{
            position:"fixed",
            left:   Math.min(selRect.x1,selRect.x2),
            top:    Math.min(selRect.y1,selRect.y2),
            width:  Math.abs(selRect.x2-selRect.x1),
            height: Math.abs(selRect.y2-selRect.y1),
            background: `${activeColor.bg}cc`,
            border:     `2px dashed ${activeColor.border}`,
            borderRadius: "3px",
            pointerEvents:"none",
            zIndex:9000,
            display:"flex", alignItems:"flex-end", justifyContent:"flex-end",
          }
        },
          Math.abs(selRect.x2-selRect.x1) > 60 && Math.abs(selRect.y2-selRect.y1) > 20 &&
          React.createElement("span",{style:{
            fontSize:"10px", background:activeColor.border, color:"#fff",
            padding:"1px 5px", borderRadius:"2px 0 0 0", opacity:0.9,
          }}, "sleep om te selecteren")
        ),


        // Alle pagina's als doorlopende kolom
        pdfDoc && React.createElement("div",{
          ref:wrapRef,
          style:{
            display:"flex", flexDirection:"column", alignItems:"center",
            padding:"20px 0 40px", gap:0,
            touchAction: selectMode ? "none" : "pan-y",
            userSelect:"text", WebkitUserSelect:"text",
          }
        },
          (pageLayout==="single" ? renderedPages.filter(pg=>pg.num===pageNum) : renderedPages).map(pg => {
            // Placeholder: pagina nog niet gerenderd — toon lege div met juiste hoogte
            if (!pg.canvas) return React.createElement("div",{
              key:pg.num,
              "data-page":pg.num,
              ref:el=>{ pageRefs.current[pg.num]=el; },
              style:{
                position:"relative", margin:"0 auto 8px",
                width: pg.width+"px", height: pg.height+"px",
                background:W.bg3, display:"flex",
                alignItems:"center", justifyContent:"center",
                color:W.fgDim, fontSize:"13px", borderRadius:"2px",
              }
            }, "p."+pg.num);
            return pg;
          }).filter(Boolean).map(pg => (typeof pg === "number" ? null : pg)).filter(pg => pg && pg.canvas).map(pg =>
            React.createElement("div",{
              key:pg.num,
              "data-page":pg.num,
              ref:el=>{ pageRefs.current[pg.num]=el; },
              onTouchStart: pageLayout==="single" ? e => { _swipeStart.current = e.touches[0].clientX; } : undefined,
              onTouchEnd: pageLayout==="single" ? e => {
                const dx = e.changedTouches[0].clientX - (_swipeStart.current||0);
                if (Math.abs(dx) > 60) {
                  const p = dx < 0 ? Math.min(numPages,pageNum+1) : Math.max(1,pageNum-1);
                  setPageNum(p);
                  setTimeout(()=>scrollToPage(p),50);
                }
              } : undefined,
              style:{
                position:"relative", flexShrink:0,
                boxShadow:"0 4px 20px rgba(0,0,0,0.6)",
                marginBottom:"16px",
                userSelect:"text", WebkitUserSelect:"text",
                // touchAction:"pan-y" zodat iOS verticaal scrollen doorgeeft
                // aan de scroll-container, maar pinch-zoom ook werkt
                touchAction:"pan-y",
              }
            },
              // Canvas als img-achtige container
              React.createElement(CanvasMount,{canvas:pg.canvas,width:pg.width,height:pg.height}),
              // Highlight overlay SVG
              React.createElement("svg",{
                style:{position:"absolute",top:0,left:0,pointerEvents:"none",overflow:"visible"},
                width:pg.width, height:pg.height,
              },
                highlights.filter(h=>h.page===pg.num&&h.file===pdfFile?.name&&h.rects?.length)
                  .flatMap((h,hi)=>{
                    const col=HCOLORS.find(c=>c.id===h.colorId)||HCOLORS[0];
                    const colLabel = col.label.includes("·") ? col.label.split(" · ")[1] : col.label;
                    const isActive=editingId===h.id;
                    return h.rects.map((r,ri)=>React.createElement("rect",{
                      key:`${hi}-${ri}`,
                      x:r.x*pg.width, y:r.y*pg.height,
                      width:r.w*pg.width, height:r.h*pg.height,
                      fill:col.bg, stroke:isActive?col.border:"none",
                      strokeWidth:isActive?1.5:0, rx:2,
                      style:{cursor:"pointer",pointerEvents:"all"},
                      onClick:()=>setEditingId(h.id===editingId?null:h.id),
                      title:h.text.substring(0,60),
                    }));
                  })
              ),
              // Tekst-laag
              React.createElement(TextLayerMount,{textLayer:pg.textLayer,width:pg.width,height:pg.height}),
              // Pagina-nummer badge
              React.createElement("div",{style:{
                position:"absolute",bottom:"6px",right:"8px",
                background:"rgba(0,0,0,0.55)",borderRadius:"10px",
                padding:"2px 8px",fontSize:"12px",color:"rgba(255,255,255,0.5)",
                pointerEvents:"none",userSelect:"none"
              }}, pg.num, " / ", numPages)
            )
          ),
          // Laad-indicator voor nog-te-renderen pagina's
          renderedPages.length > 0 && !renderedPages.find(p=>p.num===pageNum&&p.canvas) &&
            React.createElement("div",{style:{
              color:W.fgMuted,fontSize:"13px",padding:"12px 16px",
              display:"flex",alignItems:"center",gap:"8px"
            }},
              React.createElement("span",{style:{animation:"ai-pulse 1.4s ease-in-out infinite"}},"⏳"),
              "Pagina "+pageNum+" laden…"
            )
        ),

        // iOS Annoteren-knop (position:fixed — staat buiten scroll-container)
        iosAnnotBtn&&!pendingSel&&React.createElement("button",{
          onClick:()=>{ setIosAnnotBtn(null); tryOpenAnnotPopup(); },
          style:{position:"fixed",
            left:iosAnnotBtn?iosAnnotBtn.x:window.innerWidth/2-50,
            top:iosAnnotBtn?iosAnnotBtn.y:200,
            zIndex:9998, background:W.blue, color:W.bg,
            border:"none", borderRadius:"20px", padding:"8px 18px",
            fontSize:"14px", fontWeight:"bold", cursor:"pointer",
            boxShadow:"0 3px 16px rgba(0,0,0,0.6)",
          }
        },"✏ Annoteren"),
        // Zwevende toolbar bij selectie (position:fixed)
        floatBar && React.createElement("div",{
          "data-annot-popup":"1",
          style:{
            position:"fixed",
            left:Math.max(10,Math.min((floatBar.x||window.innerWidth/2)-140,window.innerWidth-300)),
            top:floatBar.above?(floatBar.y||100)-52:(floatBar.y||100),
            zIndex:10000, background:W.bg2, border:`1px solid ${W.splitBg}`,
            borderRadius:"12px", boxShadow:"0 8px 32px rgba(0,0,0,0.7)",
            padding:"8px 10px", display:"flex", flexDirection:"column", gap:"6px",
            minWidth:"280px", maxWidth:"320px",
          }
        },
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"6px"}},
            ...HCOLORS.map(col=>React.createElement("button",{
              key:col.id, title:col.label,
              onClick:()=>{
                setActiveColor(col); pendingColorRef.current=col;
                setTimeout(()=>{saveHighlight();pendingColorRef.current=null;},0);
              },
              style:{width:"28px",height:"28px",borderRadius:"50%",
                background:col.bg,border:`2px solid ${col.border}`,cursor:"pointer",flexShrink:0},
              onMouseEnter:e=>e.target.style.transform="scale(1.2)",
              onMouseLeave:e=>e.target.style.transform="scale(1)",
            })),
            React.createElement("div",{style:{width:"1px",height:"20px",background:W.splitBg,margin:"0 2px"}}),
            React.createElement("button",{
              onClick:()=>setFloatOpen(o=>!o),
              title:"Voeg annotatie toe",
              style:{background:floatOpen?W.blueBg||"rgba(138,198,242,.12)":"none",
                border:`1px solid ${floatOpen?W.blue:W.splitBg}`,borderRadius:"6px",
                color:floatOpen?W.blue:W.fgMuted,cursor:"pointer",padding:"4px 8px",fontSize:"12px",flexShrink:0}
            },"✎"),
            React.createElement("button",{
              title:"Voeg toe als citaat in leesnotitie (◀✏)",
              onClick:()=>{
                const txt = floatBar.text||"";
                const pg  = floatBar.page || pageNum;
                const quote = (noteContent&&!noteContent.endsWith("\n")?"\n":"")+
                  "### p."+pg+"\n> "+txt+"\n";
                setNoteContent(c=>c+quote);
                setShowNotePanel(true);
                setFloatBar(null); setFloatNote(""); setFloatOpen(false);
                window.getSelection()?.removeAllRanges();
              },
              style:{background:W.commentBg||"rgba(159,202,86,.08)",
                border:`1px solid ${W.tagBorder||"rgba(159,202,86,.28)"}`,borderRadius:"6px",
                color:W.tagColor||W.comment,cursor:"pointer",padding:"4px 8px",fontSize:"12px",flexShrink:0}
            },"❝"),
            React.createElement("button",{
              onClick:()=>{setFloatBar(null);setFloatNote("");setFloatOpen(false);window.getSelection()?.removeAllRanges();},
              style:{marginLeft:"auto",background:"none",border:"none",color:W.fgMuted,cursor:"pointer",fontSize:"18px",lineHeight:1}
            },"×")
          ),
          React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,lineHeight:"1.4",
            maxHeight:"40px",overflow:"hidden",borderLeft:`2px solid ${W.splitBg}`,paddingLeft:"6px"}},
            '"',(floatBar.text||"").substring(0,100),floatBar.text&&floatBar.text.length>100?"...":"",'"'),
          floatOpen&&React.createElement(React.Fragment,null,
            React.createElement("textarea",{autoFocus:true,value:floatNote,onChange:e=>setFloatNote(e.target.value),
              onKeyDown:e=>{if(e.key==="Escape")setFloatOpen(false);if(e.key==="Enter"&&(e.ctrlKey||e.metaKey))saveHighlight();},
              placeholder:"Notitie… (Ctrl+Enter)",rows:3,
              style:{width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"6px",
                color:W.fg,fontSize:"12px",padding:"6px 8px",resize:"none",outline:"none",fontFamily:"inherit"}}),
            React.createElement("button",{onClick:saveHighlight,
              style:{width:"100%",padding:"6px",borderRadius:"6px",background:W.blue,color:W.bg,
                border:"none",cursor:"pointer",fontSize:"12px",fontWeight:"600"}},"✓ Opslaan")
          )
        )
      )),  // sluit: scrollRef-div + scroll-outer-div (pdfDoc &&)

    ),  // sluit: main column div

    // ── Highlights paneel (naast main column) ─────────────────────────────
    showHlPanel && pdfFile && React.createElement("div",{style:{
      width:"320px", flexShrink:0, background:W.bg2,
      borderLeft:`1px solid ${W.splitBg}`,
      display:"flex", flexDirection:"column", minHeight:0,
    }},
      React.createElement("div",{style:{padding:"10px 14px",borderBottom:`1px solid ${W.splitBg}`,
        display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}},
        React.createElement("span",{style:{fontWeight:"600",color:W.fg,fontSize:"14px"}},"📋 Highlights"),
        React.createElement("button",{onClick:()=>setShowHlPanel(false),
          style:{background:"none",border:"none",color:W.fgMuted,cursor:"pointer",fontSize:"18px"}},"×")
      ),
      React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"8px 0"}},
        (()=>{
          const hlItems=fileHl.filter(h=>h.rects&&h.rects.length||h.hlOnly);
          if(!hlItems.length) return React.createElement("div",{
            style:{padding:"20px",textAlign:"center",color:W.fgMuted,fontSize:"13px"}
          },"Selecteer tekst en kies een kleur");
          const byPage={};
          hlItems.forEach(h=>{(byPage[h.page]=byPage[h.page]||[]).push(h);});
          return Object.keys(byPage).sort((a,b)=>+a-+b).map(pg=>
            React.createElement("div",{key:pg},
              React.createElement("div",{style:{padding:"4px 14px",fontSize:"10px",letterSpacing:"0.8px",
                color:W.fgMuted,fontWeight:"600",textTransform:"uppercase",
                display:"flex",justifyContent:"space-between",alignItems:"center"}},
                React.createElement("span",null,"PAGINA "+pg),
                React.createElement("button",{onClick:()=>{setPageNum(+pg);scrollToPage(+pg);setShowHlPanel(false);},
                  style:{background:"none",border:"none",color:W.blue,cursor:"pointer",fontSize:"11px"}},"→ ga naar")
              ),
              ...byPage[pg].map(h=>{
                const hc=HCOLORS.find(c=>c.id===h.colorId)||HCOLORS[0];
                return React.createElement("div",{key:h.id,style:{margin:"4px 10px",padding:"8px 10px",
                  background:W.bg3,borderRadius:"6px",borderLeft:`3px solid ${hc.border}`}},
                  React.createElement("div",{style:{fontSize:"12px",color:W.fg,lineHeight:"1.5",fontStyle:"italic"}},
                    '"'+(h.text?h.text.length>120?h.text.slice(0,120)+"...":h.text:"")+'"'),
                  h.note&&React.createElement("div",{style:{fontSize:"12px",color:W.fgDim,padding:"4px 6px",
                    background:hc.bg,borderRadius:"3px",marginTop:"4px"}},h.note),
                  React.createElement("div",{style:{display:"flex",gap:"6px",marginTop:"6px"}},
                    React.createElement("button",{onClick:()=>{
                        const stem=pdfFile.name.replace(/\.pdf$/i,"");
                        if(onSaveNote) onSaveNote({
                          title:(h.text?h.text.slice(0,50):"HL")+" (p."+h.page+")",
                          content:"> "+layerWrap(h.text||"",h.colorId)+(h.note?"\n"+h.note:"")+"\n\n---\n*Bron: [["+stem+"]], p."+h.page+"*",
                          tags:["highlight","pdf"],noteType:"literature"});
                      },
                      style:{fontSize:"11px",padding:"2px 8px",borderRadius:"4px",
                        background:W.commentBg||"rgba(159,202,86,.1)",color:W.tagColor||W.comment,
                        border:`1px solid ${W.tagBorder||"rgba(159,202,86,.28)"}`,cursor:"pointer"}
                    },"+ notitie"),
                    React.createElement("button",{onClick:()=>{AnnotationStore.remove(h.id);setHighlights(AnnotationStore.getAll());},
                      style:{fontSize:"11px",padding:"2px 8px",borderRadius:"4px",background:"none",
                        color:W.fgMuted,border:`1px solid ${W.splitBg}`,cursor:"pointer"}},"× wis")
                  )
                );
              })
            )
          );
        })()
      ),
      React.createElement("div",{style:{padding:"10px 14px",borderTop:`1px solid ${W.splitBg}`,flexShrink:0}},
        React.createElement("button",{onClick:()=>{
            const hlItems=fileHl.filter(h=>h.rects&&h.rects.length||h.hlOnly);
            if(!hlItems.length)return;
            const stem=pdfFile.name.replace(/\.pdf$/i,"");
            const byPage={};hlItems.forEach(h=>{(byPage[h.page]=byPage[h.page]||[]).push(h);});
            const body=["# Highlights — "+stem,"*[["+stem+"]]*",
              ...Object.keys(byPage).sort((a,b)=>+a-+b).flatMap(pg=>
                ["\n## Pagina "+pg,...byPage[pg].map(h=>"> "+layerWrap(h.text||"",h.colorId)+(h.note?"\n\n"+h.note:""))]
              )].join("\n");
            if(onSaveNote) onSaveNote({title:"Highlights — "+stem,content:body,
              tags:["highlights","pdf"],noteType:"literature",importedAt:new Date().toISOString()});
          },
          style:{width:"100%",padding:"7px",borderRadius:"6px",
            background:W.blueBg||"rgba(138,198,242,.12)",color:W.blue,
            border:`1px solid ${W.blueBorder||"rgba(138,198,242,.3)"}`,
            cursor:"pointer",fontSize:"13px",fontWeight:"600"}},"⬆ Alle highlights als notitie")
      )
    ),

    // ── Verwante-notities-paneel (naast main column) ────────────────────────
    // Toont notities die raken aan de laatst geselecteerde/gehighlighte
    // tekst — brengt "onderzoeken in de kennisdatabase" ook naar het
    // leesmoment, niet alleen naar het schrijfmoment (SmartLinkSuggester).
    showRelated && pdfFile && React.createElement("div",{style:{
      width:"320px", flexShrink:0, background:W.bg2,
      borderLeft:`1px solid ${W.splitBg}`,
      display:"flex", flexDirection:"column", minHeight:0,
    }},
      React.createElement("div",{style:{padding:"10px 14px",borderBottom:`1px solid ${W.splitBg}`,
        display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}},
        React.createElement("span",{style:{fontWeight:"600",color:W.fg,fontSize:"14px"}},"🔗 Verwante notities"),
        React.createElement("button",{onClick:()=>setShowRelated(false),
          style:{background:"none",border:"none",color:W.fgMuted,cursor:"pointer",fontSize:"18px"}},"×")
      ),
      React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"10px 14px"}},
        !relatedFor && !relatedLoading && React.createElement("div",{
          style:{fontSize:"12.5px",color:W.fgMuted,lineHeight:"1.5"}
        },"Selecteer of highlight tekst in het PDF — verwante notities uit je vault verschijnen hier automatisch."),
        relatedLoading && React.createElement("div",{
          style:{fontSize:"12px",color:W.fgMuted}
        },"⏳ Zoeken…"),
        relatedFor && !relatedLoading && React.createElement("div",{
          style:{fontSize:"10.5px",color:W.fgDim,marginBottom:"8px",lineHeight:"1.4",
                 borderLeft:`2px solid ${W.splitBg}`,paddingLeft:"6px"}
        },'Op basis van: "'+relatedFor.slice(0,90)+(relatedFor.length>90?"…":"")+'"'),
        relatedFor && !relatedLoading && relatedSuggestions.length===0 && React.createElement("div",{
          style:{fontSize:"12.5px",color:W.fgMuted,fontStyle:"italic"}
        },"Geen duidelijk verwante notities gevonden."),
        relatedSuggestions.map(sug =>
          React.createElement("div",{
            key:sug.id,
            onClick:()=>onOpenNote?.(sug.id),
            style:{marginBottom:"6px",padding:"8px 10px",borderRadius:"7px",
              border:`1px solid ${W.splitBg}`,cursor:"pointer"},
            onMouseEnter:e=>e.currentTarget.style.background="rgba(255,255,255,0.04)",
            onMouseLeave:e=>e.currentTarget.style.background="transparent",
          },
            React.createElement("div",{style:{fontSize:"12.5px",fontWeight:"600",color:W.fg,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},sug.title),
            sug.reasons?.length>0 && React.createElement("div",{
              style:{fontSize:"10.5px",color:W.fgDim,marginTop:"3px"}
            },sug.reasons.join(" · "))
          )
        )
      )
    ),

    // ── Toggle knop annotatie-zijbalk ──────────────────────────────────────
    pdfFile && React.createElement("button",{
      onClick:()=>{setShowAnnotPanel(p=>!p);if(showNotePanel)setShowNotePanel(false);},
      title:showAnnotPanel?"Annotaties verbergen":"Annotaties tonen ("+fileHl.length+")",
      style:{
        position:"absolute",right:(showAnnotPanel&&!isTablet)?(annotWidth+6):0,top:"62%",
        transform:"translateY(-50%)",background:W.bg2,border:`1px solid ${W.splitBg}`,
        borderRight:showAnnotPanel&&!isTablet?"none":`1px solid ${W.splitBg}`,
        borderRadius:showAnnotPanel?"4px 0 0 4px":"0 4px 4px 0",
        color:showAnnotPanel?W.blue:W.fgMuted,fontSize:"14px",cursor:"pointer",
        padding:"8px 5px",zIndex:isTablet&&showAnnotPanel?30:10,lineHeight:1,writingMode:"vertical-rl",
      }
    },showAnnotPanel?"▶":"◀ "+(fileHl.length>0?fileHl.length:"")),

    // ── Leesnotitie paneel (per pagina notities) ─────────────────────────
    pdfFile && showNotePanel && React.createElement("div",{style:{
      width: isTablet ? "100%" : "340px",
      flexShrink:0, background:W.bg2,
      borderLeft: isTablet ? "none" : `1px solid ${W.splitBg}`,
      borderTop: isTablet ? `1px solid ${W.splitBg}` : "none",
      display:"flex", flexDirection:"column", minHeight:0,
      position: isTablet ? "absolute" : "relative",
      bottom: isTablet ? 0 : "auto",
      left: isTablet ? 0 : "auto",
      right: isTablet ? 0 : "auto",
      height: isTablet ? "60%" : "auto",
      zIndex: isTablet ? 50 : 1,
      boxShadow: isTablet ? "0 -4px 20px rgba(0,0,0,0.3)" : "none",
    }},
      // Header
      React.createElement("div",{style:{
        padding:"10px 14px", borderBottom:`1px solid ${W.splitBg}`,
        display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0,
      }},
        React.createElement("span",{style:{fontWeight:"600",color:W.fg,fontSize:"14px"}},
          "◀✏ Leesnotitie"),
        React.createElement("button",{
          onClick:()=>setShowNotePanel(false),
          style:{background:"none",border:"none",color:W.fgMuted,cursor:"pointer",fontSize:"18px"}}
        ,"×")
      ),
      // Subtitel: huidige PDF + pagina
      React.createElement("div",{style:{
        padding:"6px 14px", borderBottom:`1px solid ${W.splitBg}22`,
        fontSize:"11px", color:W.fgMuted, flexShrink:0,
        display:"flex", alignItems:"center", gap:"8px",
      }},
        React.createElement("span",null, pdfFile ? pdfFile.name.replace(/\.pdf$/i,"") : "Geen PDF"),
        React.createElement("span",{style:{
          background:W.tagBg||"rgba(159,202,86,.1)",
          color:W.tagColor||W.comment,
          border:`1px solid ${W.tagBorder||"rgba(159,202,86,.28)"}`,
          borderRadius:"10px", padding:"1px 8px", fontSize:"11px",
        }}, "p."+pageNum)
      ),
      // Textarea
      React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",padding:"10px 12px",gap:"8px",minHeight:0}},
        React.createElement("textarea",{
          value:noteContent,
          onChange:e=>setNoteContent(e.target.value),
          placeholder:"Schrijf je notities hier…\n\nTips:\n- + p." + pageNum + " voor een paginaverwijzing\n- **vetgedrukt**, *cursief*, [[wiki-link]]",
          style:{
            flex:1, width:"100%", background:W.bg,
            border:`1px solid ${W.splitBg}`,
            borderRadius:"6px", color:W.fg, fontSize:"13px",
            padding:"10px 12px", resize:"none", outline:"none",
            fontFamily:"'Hack', monospace", lineHeight:1.7,
            minHeight:"200px",
          }
        }),
        // Snelknoppen
        React.createElement("div",{style:{display:"flex",gap:"6px",flexWrap:"wrap",flexShrink:0}},
          React.createElement("button",{
            title:"Voeg paginaverwijzing in",
            onClick:()=>setNoteContent(c=>c+(c&&!c.endsWith("\n")?"\n":"")+"### p."+pageNum+"\n"),
            style:{fontSize:"12px",padding:"4px 10px",borderRadius:"5px",
              background:W.bg3,border:`1px solid ${W.splitBg}`,
              color:W.fgMuted,cursor:"pointer"}
          },"+ p."+pageNum),
          React.createElement("button",{
            title:"Voeg geselecteerde tekst als citaat in",
            onClick:()=>{
              const sel=window.getSelection()?.toString().trim();
              if(sel) setNoteContent(c=>c+(c&&!c.endsWith("\n")?"\n":"")+"> "+sel+"\n");
            },
            style:{fontSize:"12px",padding:"4px 10px",borderRadius:"5px",
              background:W.bg3,border:`1px solid ${W.splitBg}`,
              color:W.fgMuted,cursor:"pointer"}
          },"+ citaat"),
          React.createElement("button",{
            title:"Voeg link naar PDF in",
            onClick:()=>{
              const stem=pdfFile?.name?.replace(/\.pdf$/i,"")||"PDF";
              setNoteContent(c=>c+(c&&!c.endsWith("\n")?"\n":"")+"[[" +stem+"]]\n");
            },
            style:{fontSize:"12px",padding:"4px 10px",borderRadius:"5px",
              background:W.bg3,border:`1px solid ${W.splitBg}`,
              color:W.blue,cursor:"pointer"}
          },"+ link")
        ),
        // Opslaan knop
        React.createElement("button",{
          onClick:saveNotePanel,
          disabled:!noteContent.trim()||noteSaving,
          style:{
            padding:"8px", borderRadius:"6px", fontWeight:"600", fontSize:"13px",
            background:noteContent.trim()?(W.comment):(W.fgMuted),
            color:W.bg, border:"none", cursor:noteContent.trim()?"pointer":"not-allowed",
            opacity:noteSaving?0.6:1, flexShrink:0,
          }
        }, noteSaving?"Opslaan…":"✓ Opslaan als notitie"),
        // Info tekst
        React.createElement("div",{style:{fontSize:"11px",color:W.fgMuted,lineHeight:"1.5",flexShrink:0}},
          "Wordt opgeslagen als notitie met tags [",
          React.createElement("span",{style:{color:W.tagColor||W.comment}},"leesnotitie"),
          ", ",
          React.createElement("span",{style:{color:W.tagColor||W.comment}},
            pdfFile?pdfFile.name.replace(/\.pdf$/i,""):"pdf"),
          "]")
      )
    ),

    // ── Annotatie-zijbalk ──────────────────────────────────────────────────
    pdfFile&&showAnnotPanel&&isTablet&&React.createElement("div",{
      onClick:()=>setShowAnnotPanel(false),
      style:{position:"absolute",inset:0,zIndex:19,background:"rgba(0,0,0,0.25)"}
    }),
    pdfFile&&showAnnotPanel&&React.createElement("div",{
      onClick:e=>e.stopPropagation(),
      style:{
        width:isTablet?"300px":annotWidth+"px",flexShrink:0,background:W.bg2,
        borderLeft:`1px solid ${W.splitBg}`,display:"flex",flexDirection:"column",
        position:"relative",
        ...(isTablet?{position:"absolute",right:0,top:0,bottom:0,zIndex:25,
          boxShadow:"-4px 0 24px rgba(0,0,0,0.6)"}:{}),
      }
    },
      !isTablet&&React.createElement("div",{
        style:{position:"absolute",left:0,top:0,bottom:0,width:"5px",cursor:"ew-resize",zIndex:10},
        onMouseDown:e=>{
          e.preventDefault();const sx=e.clientX,sw=annotWidth;
          const m=ev=>setAnnotWidth(Math.max(280,sw+(sx-ev.clientX)));
          const u=()=>{document.removeEventListener("mousemove",m);document.removeEventListener("mouseup",u);};
          document.addEventListener("mousemove",m);document.addEventListener("mouseup",u);
        }
      }),
      React.createElement("div",{style:{padding:"8px 10px",borderBottom:`1px solid ${W.splitBg}`,
        display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}},
        React.createElement("span",{style:{fontSize:"12px",fontWeight:"600",color:W.fgMuted}},"ANNOTATIES"),
        React.createElement("div",{style:{display:"flex",gap:"4px",alignItems:"center"}},
          filterTag&&React.createElement("button",{onClick:()=>setFilterTag(null),
            style:{fontSize:"11px",padding:"2px 7px",borderRadius:"10px",
              background:W.commentBg||"rgba(159,202,86,.1)",color:W.tagColor||W.comment,
              border:`1px solid ${W.tagBorder||"rgba(159,202,86,.3)"}`,cursor:"pointer"}},
            filterTag," ×"),
          React.createElement("button",{onClick:()=>setShowAnnotPanel(false),
            style:{background:isTablet?W.bg3:"none",border:isTablet?`1px solid ${W.splitBg}`:"none",
              borderRadius:"6px",color:W.fgMuted,fontSize:isTablet?"18px":"16px",
              cursor:"pointer",padding:isTablet?"4px 10px":"0 2px",lineHeight:1}},
            isTablet?"✕ Sluit":"×")
        )
      ),
      allAnnotTags.length>0&&React.createElement("div",{style:{padding:"5px 8px",borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}},
        React.createElement(TagFilterBar,{tags:allAnnotTags,activeTag:filterTag,onChange:setFilterTag,compact:true,maxVisible:5})
      ),
      React.createElement("div",{style:{flex:1,overflow:"auto",padding:"4px 0"}},
        panelHl.length===0
          ?React.createElement("div",{style:{padding:"24px 14px",color:W.fgMuted,fontSize:"13px",textAlign:"center"}},
            !pdfFile
              ?React.createElement("div",null,
                React.createElement("div",{style:{fontSize:"28px",marginBottom:"8px"}},"📄"),
                React.createElement("div",null,"Geen PDF geopend"))
              :React.createElement("div",null,
                React.createElement("div",{style:{fontSize:"24px",marginBottom:"8px"}},"✏️"),
                React.createElement("div",null,"Selecteer tekst en kies een kleur"))
          )
          :panelHl.map(h=>{
            const col=HCOLORS.find(c=>c.id===h.colorId)||HCOLORS[0];
            const isEditing=editingId===h.id;
            return React.createElement("div",{key:h.id,style:{borderBottom:`1px solid ${W.splitBg}22`,padding:"8px 10px"}},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px",cursor:"pointer"},
                onClick:()=>setEditingId(isEditing?null:h.id)},
                React.createElement("div",{style:{width:"10px",height:"10px",borderRadius:"50%",background:col.border,flexShrink:0}}),
                React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted,flex:1}},col.label),
                React.createElement("span",{onClick:e=>{e.stopPropagation();setPageNum(h.page);scrollToPage(h.page);},
                  style:{fontSize:"11px",fontWeight:"600",color:col.border,background:col.bg,
                    border:`1px solid ${col.border}55`,borderRadius:"10px",padding:"1px 7px",
                    marginLeft:"auto",cursor:"pointer",flexShrink:0}},"p.",h.page),
                React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted}},isEditing?"▲":"▼")
              ),
              React.createElement("div",{style:{fontSize:"12px",color:W.fg,fontStyle:"italic",lineHeight:"1.5",
                borderLeft:`3px solid ${col.border}`,paddingLeft:"6px",marginBottom:"4px"}},
                '"',h.text&&h.text.substring(0,80),h.text&&h.text.length>80?"...":"",'"'),
              h.note&&!isEditing&&React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,
                padding:"3px 6px",background:col.bg,borderRadius:"3px",marginBottom:"4px"}},h.note),
              isEditing&&React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"4px",marginTop:"4px"}},
                React.createElement("textarea",{value:h.note||"",rows:3,placeholder:"Notitie...",
                  onChange:e=>updateHighlight(h.id,{note:e.target.value}),
                  style:{width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,
                    borderRadius:"4px",color:W.fg,fontSize:"12px",padding:"4px 6px",resize:"none"}}),
                React.createElement("div",{style:{display:"flex",gap:"4px"}},
                  React.createElement("button",{onClick:()=>setEditingId(null),
                    style:{flex:1,padding:"3px",borderRadius:"4px",background:W.bg3,
                      border:`1px solid ${W.splitBg}`,color:W.fgMuted,cursor:"pointer",fontSize:"11px"}},"✓ Klaar"),
                  React.createElement("button",{onClick:()=>{AnnotationStore.remove(h.id);setHighlights(AnnotationStore.getAll());setEditingId(null);},
                    style:{padding:"3px 8px",borderRadius:"4px",background:"none",
                      border:`1px solid ${W.orange}44`,color:W.orange,cursor:"pointer",fontSize:"11px"}},"× Wis")
                )
              )
            );
          })
      ),
      React.createElement("div",{style:{padding:"8px 10px",borderTop:`1px solid ${W.splitBg}`,flexShrink:0,display:"flex",gap:"6px"}},
        React.createElement("button",{onClick:()=>{
            const stem=pdfFile?.name?.replace(/\.pdf$/i,"")||"PDF";
            const body=["# Annotaties — "+stem,...fileHl.map(h=>{
              const col=HCOLORS.find(c=>c.id===h.colorId)||HCOLORS[0];
              return "\n## p."+h.page+" — "+col.label+"\n> "+(h.text||"")+(h.note?"\n\n"+h.note:"");
            })].join("\n");
            if(onSaveNote) onSaveNote({title:"Annotaties — "+stem,content:body,
              tags:["annotaties","literatuur"],noteType:"literature",
              importedAt:new Date().toISOString()});
          },
          style:{flex:1,padding:"5px",borderRadius:"5px",
            background:W.blueBg||"rgba(138,198,242,.1)",color:W.blue,
            border:`1px solid ${W.blueBorder||"rgba(138,198,242,.3)"}`,
            cursor:"pointer",fontSize:"12px",fontWeight:"600"}},"⬆ Exporteer")
      )
    )
  );

};
