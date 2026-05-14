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

// Provider-kleuren
const PROVIDER_COLOR = {
  anthropic:  "#d787ff",
  google:     "#8ac6f2",
  openai:     "#9fca56",
  openrouter: "#e5786d",
  mistral:    "#eae788",
};

const MODEL_LABEL = (m) => {
  const o = ONLINE_MODELS.find(x => x.id === m);
  if (o) return o.icon + " " + o.label;
  if (!m) return "geen model";
  return "🖥 " + (m.split(":")[0] || m);
};

const MODEL_COLOR = (m) => {
  const o = ONLINE_MODELS.find(x => x.id === m);
  return o ? (PROVIDER_COLOR[o.provider] || "#e3e0d7") : "#9fca56";
};

// ── PDFUploadPanel — clean upload-paneel voor Invoer → PDF tab ───────────────
const PDFUploadPanel = ({ serverPdfs=[], onRefreshPdfs, onOpenPdf, llmModel,
                          allTags=[], notes=[], onAddNote, addJob, updateJob }) => {
  const { useState, useRef, useCallback } = React;
  const [dragOver,   setDragOver]   = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [uploaded,   setUploaded]   = useState([]);   // [{name, isNew}]
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
          const pdfSize = pdf.size ? ` · ${(pdf.size/1024/1024).toFixed(1)} MB` : "";
          return React.createElement("div", {
            key: i,
            style: { display: "flex", alignItems: "center", gap: "10px",
                     padding: "7px 12px", borderRadius: "5px",
                     borderBottom: `1px solid ${W.splitBg}`,
                     cursor: "pointer" },
            onClick: () => onOpenPdf?.(pdfName),
            onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.03)",
            onMouseLeave: e => e.currentTarget.style.background = "transparent",
          },
            React.createElement("span", { style: { fontSize: "14px", flexShrink: 0 } }, "📄"),
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              React.createElement("div", {
                style: { fontSize: "13px", color: W.fg,
                         overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
              }, pdfName),
              pdfSize && React.createElement("div", {
                style: { fontSize: "10px", color: W.fgMuted, marginTop: "1px" }
              }, pdfSize)
            ),
            React.createElement("span", {
              style: { fontSize: "11px", color: W.blue, flexShrink: 0 }
            }, "→ open")
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

const PDFViewer = ({pdfNotes, setPdfNotes, allTags, serverPdfs, onRefreshPdfs, onAutoSummarize, onDeletePdf, onPasteToNote=null, onAddNote=null, notes=[], isTablet=false}) => {
  const [pdfDoc,     setPdfDoc]     = useState(null);
  const [pdfFile,    setPdfFile]    = useState(null);
  const [pageNum,    setPageNum]    = useState(1);   // huidige zichtbare pagina (voor annotaties)
  const pageNumRef      = useRef(1);      // ref-versie: altijd actueel zonder closure-problemen
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
  const dragSelRef       = useRef(null);   // {startX, startY, el} voor sleep-selectie
  const [selRect,        setSelRect]       = useState(null);  // visuele rechthoek
  // highlights gespiegeld vanuit AnnotationStore
  const [highlights, setHighlights] = useState(AnnotationStore.getAll());
  const [pendingSel, setPendingSel] = useState(null);
  const [selPos,     setSelPos]     = useState({x:0,y:0});
  const [editingId,  setEditingId]  = useState(null);
  const [isLoading,  setIsLoading]  = useState(false);
  const [pdfjsReady, setPdfjsReady] = useState(false);
  const [activeColor,setActiveColor]= useState(HCOLORS[0]);
  const [filterTag,  setFilterTag]  = useState(null);
  const [quickNote,  setQuickNote]  = useState("");
  const [quickTags,  setQuickTags]  = useState([]);
  const [showLibrary,   setShowLibrary]   = useState(true);
  const [libSearch,     setLibSearch]     = useState("");
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
  const pageRefs    = useRef({});      // {pageNum: domNode} voor scroll-to-page
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
    node.scrollIntoView({behavior: "smooth", block: "start"});
    // Reset de vlag zodra de scroll-animatie klaar kan zijn (~700ms)
    setTimeout(() => { userNavRef.current = false; }, 700);
  }, []);

  // Sync pageNumRef — altijd up-to-date zonder closure problemen
  React.useEffect(() => { pageNumRef.current = pageNum; }, [pageNum]);
  // Registreer scrollToPage in ref zodat renderVirtual hem kan aanroepen zonder dep
  React.useEffect(() => { scrollToPageRef.current = scrollToPage; }, [scrollToPage]);

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

  const loadPdf=async(arrayBuffer,name)=>{
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
      // Herstel opgeslagen pagina (na korte delay zodat render klaar is)
      if (savedPage > 1) {
        setPageNum(savedPage);
        setTimeout(() => scrollToPage(savedPage), 600);
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

  const openFromServer=async(name)=>{
    setShowLibrary(false); setIsLoading(true);
    try{
      const ab=await PDFService.fetchPdfBlob(name);
      await loadPdf(ab,name);
    }catch(err){console.error(err);}
    setIsLoading(false);
  };

  // Bewaar selectie-rects voor visuele highlight overlay
  const pendingRectsRef = useRef([]);
  const pendingPageRef  = useRef(1);  // pagina van de actieve selectie — los van pageNum state
  const [iosAnnotBtn,  setIosAnnotBtn]  = useState(null);
  const [hlMode,       setHlMode]       = useState("annot");
  const [showHlPanel,  setShowHlPanel]  = useState(false);     // highlights-overzicht

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
      const rects = Array.from(range.getClientRects())
        .map(r => ({ x: r.left - refRect.left, y: r.top - refRect.top, w: r.width, h: r.height }))
        .filter(r => r.w > 1 && r.h > 1);

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
          text: txt, note: "", color: activeColor.id,
          rects: rects.length ? rects : [], tags: [],
          createdAt: new Date().toISOString(), hlOnly: true,
        });
        setHighlights(AnnotationStore.getAll());
        window.getSelection()?.removeAllRanges();
        return;
      }

      // "hl+annot" of "annot": toon de popup
      setQuickNote('');
      setQuickTags([]);
      setPendingSel(txt);

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
    const normRects = result.rects.map(r=>({
      x: r.x/cw, y: r.y/ch, w: r.w/cw, h: r.h/ch,
    })).filter(r=>r.w>0&&r.h>0);

    pendingRectsRef.current = result.rects;  // origineel voor saveHighlight
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
      setQuickNote(""); setQuickTags([]); setPendingSel(result.text);
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
    if(!pendingSel)return;
    // Gebruik de pagina van de selectie (ref), niet de huidige scroll-pagina
    const hlPage = pendingPageRef.current;
    zklog("[PDF] saveHighlight: page=",hlPage,"rects=",pendingRectsRef.current.length);
    const pgWrap = pageRefs.current[hlPage];
    const cw = pgWrap ? pgWrap.offsetWidth  : (renderedPages.find(p=>p.num===hlPage)?.width  || 1);
    const ch = pgWrap ? pgWrap.offsetHeight : (renderedPages.find(p=>p.num===hlPage)?.height || 1);
    const rects = pendingRectsRef.current.map(r=>({
      x: r.x/cw, y: r.y/ch, w: r.w/cw, h: r.h/ch,
    })).filter(r => r.w>0 && r.h>0);
    const fname = pdfFile?.name||"PDF";
    const hid = genId();
    const h={id:hid, text:pendingSel, note:quickNote, tags:quickTags,
             page:hlPage, file:fname,
             colorId:activeColor.id, rects,
             created:new Date().toISOString()};
    await AnnotationStore.add(h);
    // Maak ook een Zettelkasten-notitie aan
    if (onAddNote) {
      const stem = fname.replace(/\.pdf$/i,"");
      const lines = [
        `> ${pendingSel}`,
        "",
        ...(quickNote ? [quickNote, ""] : []),
        `---`,
        `📄 **Bron:** [[pdf:${fname}]] · pagina ${hlPage}`,
        `🏷 annotatie-id: ${hid}`,
      ];
      await onAddNote({
        id: genId(),
        title: `📌 ${pendingSel.slice(0,60)}${pendingSel.length>60?"…":""}`,
        content: lines.join("\n"),
        tags: [...new Set(["highlight","pdf",stem,...(quickTags||[])])],
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      });
    }
    const savedTop  = scrollRef.current?.scrollTop  || 0;
    const savedLeft = scrollRef.current?.scrollLeft || 0;

    setPendingSel(null); setQuickNote(""); setQuickTags([]);
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
      React.createElement("div",{style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,padding:"5px 10px",display:"flex",alignItems:"center",gap:"8px",fontSize:"14px",flexShrink:0,flexWrap:"wrap"}},
        // Importeer-knop alleen zichtbaar als PDF open is (bibliotheek heeft eigen knop)
        pdfDoc && React.createElement("button",{onClick:()=>fileRef.current.click(),style:{background:W.blue,color:W.bg,border:"none",borderRadius:"4px",padding:"4px 10px",fontSize:"14px",cursor:"pointer",fontWeight:"bold"}},"⬆ Importeer PDF"),
        !pdfDoc && React.createElement("button",{
          onClick:()=>{ setShowLibrary(!showLibrary); },
          style:{background:showLibrary?W.comment:"none",color:showLibrary?W.bg:W.fgMuted,
                 border:`1px solid ${showLibrary?W.comment:W.splitBg}`,
                 borderRadius:"4px",padding:"4px 10px",fontSize:"14px",cursor:"pointer"}
        },`📚 Bibliotheek (${serverPdfs?.length||0})`),
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
        pdfDoc&&React.createElement(React.Fragment,null,
          React.createElement("span",{style:{color:W.fgMuted}},"│"),
          React.createElement("button",{onClick:()=>{ const p=Math.max(1,pageNum-1); setPageNum(p); scrollToPage(p); if(pdfDoc) renderNearby(pdfDoc,scale,rotation,p); },style:{background:"none",border:"none",color:W.fg,cursor:"pointer",fontSize:"16px",padding:"0 3px"}},"◀"),
          React.createElement("span",{style:{color:W.statusFg,minWidth:"60px",textAlign:"center"}},pageNum," / ",numPages),
          React.createElement("button",{onClick:()=>{ const p=Math.min(numPages,pageNum+1); setPageNum(p); scrollToPage(p); if(pdfDoc) renderNearby(pdfDoc,scale,rotation,p); },style:{background:"none",border:"none",color:W.fg,cursor:"pointer",fontSize:"16px",padding:"0 3px"}},"▶"),
          React.createElement("span",{style:{color:W.fgMuted}},"│"),
          React.createElement("button",{onClick:()=>{ setFitWidth(false); userScaleRef.current=Math.max(0.5,+(scale-0.2).toFixed(1)); setScale(userScaleRef.current); },style:{background:"none",border:"none",color:W.fg,cursor:"pointer",padding:"0 4px",fontSize:"16px"}},"−"),
          React.createElement("span",{style:{color:W.fgMuted,minWidth:"40px",textAlign:"center"}},Math.round(scale*100),"%"),
          React.createElement("button",{onClick:()=>{ setFitWidth(false); userScaleRef.current=Math.min(3,+(scale+0.2).toFixed(1)); setScale(userScaleRef.current); },style:{background:"none",border:"none",color:W.fg,cursor:"pointer",padding:"0 4px",fontSize:"16px"}},"+"),
          React.createElement("span",{style:{color:W.fgMuted}},"│"),
          // ── Terug naar begin ────────────────────────────────────────────
          pdfFile && pageNum > 1 && React.createElement("button",{
            onClick:()=>{ savePdfPage(pdfFile.name, 0); setPageNum(1); scrollToPage(1); },
            title:"Terug naar begin (vergeet opgeslagen positie)",
            style:{background:"none",border:"none",color:W.fgMuted,
                   cursor:"pointer",padding:"2px 6px",fontSize:"13px",lineHeight:1},
          }, "⏮"),
          // ── A: Selectiemodus knop (iPad/vinger) ─────────────────────────────
          isTablet && React.createElement("button",{
            onClick:()=>setSelectMode(m=>!m),
            title: selectMode ? "Selectiemodus aan — klik om scrollen te herstellen" : isTablet ? "Selectiemodus: schakel in om met vinger/pencil tekst te selecteren" : "Selectiemodus (iPad) — op desktop: klik en sleep direct over de tekst",
            style:{
              background: selectMode ? (W.yellow+"22"||"rgba(234,231,136,.2)") : "none",
              border: selectMode ? `1px solid ${W.yellow}` : "1px solid transparent",
              borderRadius:"6px",
              color: selectMode ? W.yellow : W.fgMuted,
              cursor:"pointer", padding:"3px 8px", fontSize:"14px", lineHeight:1,
              fontWeight: selectMode ? "600" : "400",
              position:"relative",
            }
          },
            selectMode ? "🖐 Selecteer" : "🖐",
            // Puls-indicator als selectMode aan is
            selectMode && React.createElement("span",{style:{
              position:"absolute", top:"-3px", right:"-3px",
              width:"8px", height:"8px", borderRadius:"50%",
              background:W.yellow, display:"block",
            }})
          ),
          React.createElement("span",{style:{color:W.splitBg}},"|"),
          // ── Highlight modus ─────────────────────────────────────────────
          React.createElement("span",{style:{color:W.fgMuted,fontSize:"11px",marginRight:"2px",flexShrink:0}},"✎:"),
          ...[
            {id:"hl",      icon:"🖍",  title:"Alleen markeren — geen popup"},
            {id:"hl+annot",icon:"🖍✎", title:"Markeren + annotatie"},
            {id:"annot",   icon:"✎",   title:"Alleen annotatie (huidige modus)"},
          ].map(m => React.createElement("button",{
            key:m.id,
            onClick:()=>setHlMode(m.id),
            title:m.title,
            style:{
              background: hlMode===m.id ? W.blueBg2  : "none",
              border:     hlMode===m.id ? `1px solid ${W.blueBorder}` : "1px solid transparent",
              borderRadius:"4px", color: hlMode===m.id ? W.blue : W.fgMuted,
              cursor:"pointer", padding:"2px 6px", fontSize:"13px", lineHeight:1,
            }
          }, m.icon)),
          React.createElement("span",{style:{color:W.splitBg}},"|"),
          // Highlights-overzicht knop
          pdfFile && React.createElement("button",{
            onClick:()=>setShowHlPanel(p=>!p),
            title:"Highlights overzicht",
            style:{
              background: showHlPanel ? W.yellowBg||"rgba(234,231,136,.1)" : "none",
              border: showHlPanel ? `1px solid ${W.yellow}` : "1px solid transparent",
              borderRadius:"4px", color: showHlPanel ? W.yellow : W.fgMuted,
              cursor:"pointer", padding:"2px 6px", fontSize:"13px", lineHeight:1,
            }
          }, "📋"),
          // ── Fit-width ─────────────────────────────────────────────────
          React.createElement("button",{
            onClick: async () => {
              if (fitWidth) {
                // Uitzetten: terug naar opgeslagen handmatige scale
                setFitWidth(false);
                setScale(userScaleRef.current);
              } else {
                // Aanzetten: onthoud huidige scale en bereken fit-width
                userScaleRef.current = scale;
                // Bereken de scale DIRECT (niet via state) zodat setScale meteen de juiste waarde krijgt
                if (pdfDoc && scrollRef.current) {
                  const targetPg = Math.min(pageNum, pdfDoc.numPages);
                  const page = await pdfDoc.getPage(targetPg);
                  const naturalVp = page.getViewport({ scale: 1 });
                  const totalRot  = (rotation + (page.rotate || 0)) % 360;
                  const pageW = (totalRot === 90 || totalRot === 270) ? naturalVp.height : naturalVp.width;
                  let cw = scrollRef.current.clientWidth;
                  if (cw < 50) { await new Promise(r => requestAnimationFrame(r)); cw = scrollRef.current.clientWidth; }
                  const sc = Math.max(0.3, Math.min(4, (cw - 32) / pageW));
                  setFitWidth(true);
                  setScale(sc);
                } else {
                  setFitWidth(true);
                }
              }
            },
            title: fitWidth ? "Fit-breedte uit — terug naar handmatige zoom" : "Pas breedte aan op scherm",
            style:{
              background: fitWidth ? `${W.blue}22` : "none",
              border: fitWidth ? `1px solid ${W.blue}55` : "1px solid transparent",
              borderRadius:"4px",
              color: fitWidth ? W.blue : W.fgMuted,
              cursor:"pointer", padding:"2px 7px", fontSize:"15px", lineHeight:1,
              transition:"all 0.12s",
            },
          }, "⟺"),
          // ── Paginalay-out toggle ──────────────────────────────────────
          React.createElement("button",{
            onClick:()=>setPageLayout(l=>l==="scroll"?"single":"scroll"),
            title: pageLayout==="scroll" ? "Schakel naar één-paginamodus" : "Schakel naar scrollmodus",
            style:{background:pageLayout==="single"?`${W.blue}18`:"none",
                   border:pageLayout==="single"?`1px solid ${W.blue}44`:"1px solid transparent",
                   borderRadius:"4px",color:pageLayout==="single"?W.blue:W.fgMuted,
                   cursor:"pointer",padding:"2px 6px",fontSize:"15px",lineHeight:1},
          }, pageLayout==="single" ? "⧉" : "⬚"),
          // ── Roteren ──────────────────────────────────────────────────
          React.createElement("button",{
            onClick:()=>setRotation(r=>(r+90)%360),
            title:"Roteer 90° rechtsom",
            style:{background:"none",border:"none",color:W.fgMuted,
                   cursor:"pointer",padding:"2px 6px",fontSize:"15px",lineHeight:1},
          }, "↻"),
          // ── Zoeken in PDF ─────────────────────────────────────────────
          React.createElement("button",{
            onClick:()=>{ setPdfSearchOpen(o=>!o); if(pdfSearchOpen){ setPdfSearch(""); setSearchHits([]); searchIdRef.current++; scrollRef.current?.querySelectorAll(".zk-search-hl").forEach(el=>{el.style.background="";el.style.outline="";el.classList.remove("zk-search-hl");}); } },
            title:"Zoeken in PDF",
            style:{background:pdfSearchOpen?`${W.yellow}18`:"none",
                   border:pdfSearchOpen?`1px solid ${W.yellow}44`:"1px solid transparent",
                   borderRadius:"4px",color:pdfSearchOpen?W.yellow:W.fgMuted,
                   cursor:"pointer",padding:"2px 6px",fontSize:"15px",lineHeight:1},
          }, "🔍"),
          React.createElement("span",{style:{color:W.fgMuted}},"│"),
          ...HCOLORS.map(c=>React.createElement("button",{key:c.id,onClick:()=>setActiveColor(c),title:c.label,style:{width:"18px",height:"18px",borderRadius:"4px",background:c.bg,border:`2px solid ${activeColor.id===c.id?c.border:"transparent"}`,cursor:"pointer",padding:0,boxShadow:activeColor.id===c.id?`0 0 6px ${c.border}`:"none"}})),
          React.createElement("span",{style:{color:W.fgMuted,fontSize:"14px",marginLeft:"4px",maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},pdfFile?.name),
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
            style:{background:"rgba(138,198,242,0.08)",
                   border:"1px solid rgba(138,198,242,0.25)",
                   color:summarizing?"#666":"#a8d8f0",
                   borderRadius:"4px",padding:"3px 9px",
                   fontSize:"14px",cursor:summarizing?"not-allowed":"pointer",
                   marginLeft:"6px",flexShrink:0,opacity:summarizing?0.5:1}
          }, summarizing ? "⏳…" : "🧠 samenvatten"),
          pdfFile&&React.createElement("button",{
            title:"Verwijder deze PDF + annotaties",
            onClick:async()=>{
              if(!confirm(`Verwijder "${pdfFile.name}" en alle annotaties?`)) return;
              const name=pdfFile.name;
              await PDFService.deletePdf(name);
              setPdfDoc(null); setPdfFile(null);
              onRefreshPdfs?.();
              onDeletePdf?.(name);
            },
            style:{background:"rgba(229,120,109,0.1)",border:"1px solid rgba(229,120,109,0.25)",
                   color:W.orange,borderRadius:"4px",padding:"3px 9px",
                   fontSize:"14px",cursor:"pointer",marginLeft:"6px",flexShrink:0}
          },"🗑 verwijder")
        ),
        React.createElement("div",{style:{flex:1}}),
        pdfDoc&&React.createElement("span",{style:{color:W.comment,fontSize:"14px"}},"① selecteer tekst  ② popup  ③ opslaan")
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
          const filtered = q
            ? (serverPdfs || []).filter(p =>
                p.name.toLowerCase().includes(q) ||
                p.name.replace(/_/g," ").toLowerCase().includes(q)
              )
            : (serverPdfs || []);

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
          onTouchStart:e=>{ e.preventDefault(); tryOpenAnnotPopup(); setIosAnnotBtn(null); },
          onClick:()=>{ tryOpenAnnotPopup(); setIosAnnotBtn(null); },
          style:{
            position:"fixed", left:iosAnnotBtn.x, top:iosAnnotBtn.y,
            zIndex:9998, background:W.blue, color:W.bg,
            border:"none", borderRadius:"20px", padding:"8px 18px",
            fontSize:"14px", fontWeight:"bold", cursor:"pointer",
            boxShadow:"0 3px 16px rgba(0,0,0,0.6)",
            WebkitTapHighlightColor:"transparent",
          }
        },"✏ Annoteren"),
        // Annotatie-popup — fixed onder de menubalk
        pendingSel&&React.createElement("div",{
          "data-annot-popup":"1",
          style:{
            position:"fixed", top:"80px", left:0, right:0,
            background:W.bg2,
            borderTop:`3px solid ${activeColor.border}`,
            borderBottom:`1px solid ${W.splitBg}`,
            padding:"12px 16px",
            zIndex:9999,
            boxShadow:"0 8px 32px rgba(0,0,0,0.8)",
            display:"flex", flexDirection:"column", gap:"10px",
          },
          onMouseDown:e=>e.stopPropagation(),
          onMouseUp:e=>e.stopPropagation(),
          onTouchStart:e=>e.stopPropagation(),
        },
          // Rij 1: citaat + sluiten
          React.createElement("div",{style:{display:"flex",gap:"10px",alignItems:"flex-start"}},
            React.createElement("div",{style:{
              flex:1, fontSize:"13px", color:W.fg,
              padding:"6px 10px", background:W.bg, borderRadius:"4px",
              fontStyle:"italic", lineHeight:"1.6",
              borderLeft:`4px solid ${activeColor.border}`,
              overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis",
              boxShadow:"inset 0 0 0 1px rgba(255,255,255,0.06)",
            }},
              React.createElement("span",{style:{
                background:activeColor.bg, padding:"1px 3px", borderRadius:"2px",
              }}, '"', pendingSel.substring(0,120), pendingSel.length>120?"…":"", '"')
            ),
            React.createElement("button",{
              onClick:()=>{
                const savedTop = scrollRef.current?.scrollTop||0;
                const savedLeft = scrollRef.current?.scrollLeft||0;
                setPendingSel(null); window.getSelection()?.removeAllRanges();
                // Als selectMode uit is, herstel scroll na sluiten
                if (!selectMode) _setTextLayerTouch("pan-y");
                requestAnimationFrame(()=>{
                  if(scrollRef.current){ scrollRef.current.scrollTop=savedTop; scrollRef.current.scrollLeft=savedLeft; }
                });
              },
              style:{background:"none",border:"none",color:W.fgMuted,
                     fontSize:"18px",cursor:"pointer",lineHeight:1,flexShrink:0,padding:"2px 4px"}
            },"×")
          ),

          // Rij 2: notitieveld + kleurkiezer naast elkaar
          React.createElement("div",{style:{display:"flex",gap:"8px",alignItems:"flex-start"}},
            React.createElement("textarea",{
              value:quickNote,
              onChange:e=>setQuickNote(e.target.value),
              onKeyDown:e=>{
                if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();saveHighlight();}
                if(e.key==="Escape"){
                  const savedTop = scrollRef.current?.scrollTop||0;
                  const savedLeft = scrollRef.current?.scrollLeft||0;
                  setPendingSel(null); window.getSelection()?.removeAllRanges();
                  requestAnimationFrame(()=>{
                    if(scrollRef.current){ scrollRef.current.scrollTop=savedTop; scrollRef.current.scrollLeft=savedLeft; }
                  });
                }
              },
              placeholder:"Notitie… (Enter=opslaan · Shift+Enter=nieuwe regel · Esc=sluiten)",
              rows:2,
              autoFocus:true,
              style:{flex:1,background:W.bg,border:`1px solid ${W.splitBg}`,
                     borderRadius:"4px",padding:"6px 9px",color:W.fg,
                     fontSize:"13px",outline:"none",resize:"none",
                     boxSizing:"border-box"},
            }),
            // Kleurkiezer verticaal
            React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"4px",flexShrink:0}},
              ...HCOLORS.map(c=>React.createElement("button",{key:c.id,
                onClick:()=>setActiveColor(c),
                title:c.id,
                style:{width:"18px",height:"18px",borderRadius:"3px",background:c.bg,
                       border:`2px solid ${activeColor.id===c.id?c.border:W.splitBg}`,
                       cursor:"pointer",padding:0}}))
            )
          ),

          // Rij 3: tags
          React.createElement("div",{style:{display:"flex",gap:"8px",alignItems:"center"}},
            React.createElement("span",{style:{fontSize:"12px",color:W.fgMuted,flexShrink:0}},"tags:"),
            React.createElement("div",{style:{flex:1}},
              React.createElement(SmartTagEditor,{tags:quickTags,onChange:setQuickTags,allTags:[...allTags,...allAnnotTags]})
            )
          ),

          // Rij 4: knoppen
          React.createElement("div",{style:{display:"flex",gap:"6px",flexWrap:"wrap"}},
            React.createElement("button",{onClick:saveHighlight,
              style:{background:activeColor.border,color:"#fff",border:"none",
                     borderRadius:"4px",padding:"6px 16px",fontSize:"13px",
                     cursor:"pointer",fontWeight:"600",flexShrink:0}},"✓ Opslaan"),
            React.createElement("button",{
              title:"Selectie aanpassen — teken opnieuw",
              onClick:()=>{
                setPendingSel(null);
                window.getSelection()?.removeAllRanges();
                // Activeer selectiemodus zodat gebruiker opnieuw kan slepen
                if(!selectMode) setSelectMode(true);
              },
              style:{background:W.bg2,color:W.fgMuted,border:`1px solid ${W.splitBg}`,
                     borderRadius:"4px",padding:"6px 12px",fontSize:"13px",
                     cursor:"pointer",flexShrink:0}},"✏ Opnieuw"),
            onPasteToNote&&React.createElement("button",{
              onClick:()=>{
                onPasteToNote({text:pendingSel,source:pdfFile?.name||"PDF",page:pageNum,url:null});
                setPendingSel(null); window.getSelection()?.removeAllRanges();
              },
              style:{background:"rgba(159,202,86,0.15)",color:W.comment,
                     border:"1px solid rgba(159,202,86,0.3)",borderRadius:"4px",
                     padding:"5px 11px",fontSize:"13px",cursor:"pointer"}
            },"📋 → notitie"),
            React.createElement("button",{
              onClick:()=>{setPendingSel(null);window.getSelection()?.removeAllRanges();},
              style:{background:"none",color:W.fgMuted,border:`1px solid ${W.splitBg}`,
                     borderRadius:"4px",padding:"5px 11px",fontSize:"13px",cursor:"pointer"}
            },"Annuleren")
          )
        )
      ))
    ),
    // Notitie-paneel knop
    pdfFile && React.createElement("button",{
      onClick:()=>{ setShowNotePanel(p=>!p); if(showAnnotPanel) setShowAnnotPanel(false); },
      title: showNotePanel ? "Sluit leesnotitie" : "Leesnotitie openen",
      style:{
        position:"absolute",
        right: showNotePanel ? 322 : (showAnnotPanel && !isTablet) ? (annotWidth+14) : 8,
        top:"38%",
        transform:"translateY(-50%)",
        background: showNotePanel ? "rgba(159,202,86,0.15)" : W.bg2,
        border:`1px solid ${showNotePanel ? W.comment+"55" : W.splitBg}`,
        borderRadius:"4px 0 0 4px",
        color: showNotePanel ? W.comment : W.fgMuted,
        fontSize:"13px", cursor:"pointer",
        padding:"7px 5px", zIndex:10, lineHeight:1,
        writingMode:"vertical-rl", transition:"all 0.15s",
      }
    }, showNotePanel ? "✏▶" : "◀✏"),

    // Annotatiepaneel — knop om te openen (alleen als PDF open is)
    pdfFile && React.createElement("button",{
      onClick:()=>{ setShowAnnotPanel(p=>!p); if(showNotePanel) setShowNotePanel(false); },
      title: showAnnotPanel ? "Annotaties verbergen" : "Annotaties tonen",
      style:{
        position:"absolute", right:(showAnnotPanel && !isTablet)?(annotWidth+6):0, top:"62%",
        transform:"translateY(-50%)",
        background:W.bg2, border:`1px solid ${W.splitBg}`,
        borderRight:showAnnotPanel?"none":"1px solid "+W.splitBg,
        borderRadius:showAnnotPanel?"4px 0 0 4px":"0 4px 4px 0",
        color:W.fgMuted, fontSize:"14px", cursor:"pointer",
        padding:"8px 5px", zIndex:10, lineHeight:1,
        writingMode:"vertical-rl",
      }
    }, showAnnotPanel ? "▶" : "◀ " + (fileHl.length > 0 ? fileHl.length : "")),

    // ── Notitie-zijpaneel ───────────────────────────────────────────────────
    pdfFile && showNotePanel && React.createElement("div",{style:{
      width:"320px", flexShrink:0, background:W.bg2,
      borderLeft:`1px solid ${W.splitBg}`,
      display:"flex", flexDirection:"column",
      ...(isTablet ? { position:"absolute",right:0,top:0,bottom:0,zIndex:20,boxShadow:"-4px 0 20px rgba(0,0,0,0.5)" } : {}),
    }},
      // Header
      React.createElement("div",{style:{
        padding:"8px 12px", borderBottom:`1px solid ${W.splitBg}`,
        background:W.bg2, flexShrink:0,
        display:"flex", alignItems:"center", gap:"8px",
      }},
        React.createElement("div",{style:{flex:1}},
          React.createElement("div",{style:{fontSize:"13px",fontWeight:"700",color:W.statusFg}},
            "✏ Leesnotitie"),
          React.createElement("div",{style:{fontSize:"10px",color:W.fgDim,marginTop:"1px",
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"220px"}},
            pdfFile?.name)
        ),
        React.createElement("button",{
          onClick:()=>setShowNotePanel(false),
          style:{background:"none",border:"none",color:W.fgMuted,cursor:"pointer",fontSize:"16px",padding:"0 4px"}
        },"×")
      ),

      // Hint: pagina invoegen
      React.createElement("div",{style:{
        padding:"5px 12px",
        borderBottom:`1px solid ${W.splitBg}`,
        background:"rgba(159,202,86,0.04)",
        flexShrink:0,
        display:"flex", gap:"6px", alignItems:"center",
      }},
        React.createElement("span",{style:{fontSize:"10px",color:W.fgDim}},
          `Pagina ${pageNum} open`),
        React.createElement("button",{
          onClick:()=>setNoteContent(c => c + (c && !c.endsWith("\n") ? "\n" : "") + `\n## Pagina ${pageNum}\n`),
          style:{fontSize:"10px",padding:"2px 7px",borderRadius:"4px",cursor:"pointer",
                 background:"rgba(159,202,86,0.1)",border:`1px solid ${W.comment}44`,
                 color:W.comment},
        },"+ p."+pageNum),
        React.createElement("button",{
          onClick:()=>{
            const sel = window.getSelection()?.toString().trim();
            if (sel) setNoteContent(c => c + (c && !c.endsWith("\n") ? "\n" : "") + `\n> ${sel}\n> — p.${pageNum}\n`);
          },
          title:"Voeg geselecteerde tekst in als citaat",
          style:{fontSize:"10px",padding:"2px 7px",borderRadius:"4px",cursor:"pointer",
                 background:"rgba(138,198,242,0.1)",border:`1px solid ${W.blue}44`,
                 color:W.blue},
        },"+ citaat")
      ),

      // Textarea
      React.createElement("textarea",{
        value:noteContent,
        onChange:e=>setNoteContent(e.target.value),
        placeholder:`Notities bij ${pdfFile?.name||"dit PDF"}...\n\nTips:\n- ## voor een sectiekopregel\n- > voor citaat\n- [[link]] voor wiki-link`,
        style:{
          flex:1, background:"transparent", border:"none", outline:"none",
          color:W.fg, fontSize:"13px", lineHeight:"1.7",
          padding:"12px 14px", resize:"none",
          fontFamily:"'DM Sans',system-ui,sans-serif",
          caretColor:W.yellow,
        }
      }),

      // Footer: opslaan
      React.createElement("div",{style:{
        padding:"8px 12px", borderTop:`1px solid ${W.splitBg}`,
        background:W.bg2, flexShrink:0,
        display:"flex", gap:"6px", alignItems:"center",
      }},
        React.createElement("span",{style:{flex:1,fontSize:"10px",color:W.fgDim}},
          noteContent.split("\n").length + " regels · " + noteContent.split(/\s+/).filter(Boolean).length + " woorden"),
        React.createElement("button",{
          onClick:saveNotePanel,
          disabled:noteSaving||!noteContent.trim(),
          style:{
            padding:"5px 14px", borderRadius:"5px", fontSize:"12px",
            cursor:noteContent.trim()?"pointer":"default",
            background:noteContent.trim()?"rgba(159,202,86,0.15)":"transparent",
            border:`1px solid ${noteContent.trim()?W.comment+"55":W.splitBg}`,
            color:noteContent.trim()?W.comment:W.fgDim,
            fontWeight:"600",
          }
        }, noteSaving ? "⟳ Opslaan…" : "✓ Opslaan")
      )
    ),

    // Annotations panel
    // ── Highlights-overzicht paneel ──────────────────────────────────────────
    showHlPanel && pdfFile && React.createElement("div",{style:{
      width: "320px", flexShrink:0, background:W.bg2,
      borderLeft:`1px solid ${W.splitBg}`,
      display:"flex", flexDirection:"column", minHeight:0,
    }},
      // Header
      React.createElement("div",{style:{
        padding:"10px 14px", borderBottom:`1px solid ${W.splitBg}`,
        display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0,
      }},
        React.createElement("span",{style:{fontWeight:"600",color:W.fg,fontSize:"14px"}},"📋 Highlights"),
        React.createElement("button",{
          onClick:()=>setShowHlPanel(false),
          style:{background:"none",border:"none",color:W.fgMuted,cursor:"pointer",fontSize:"18px",padding:"0 2px"}
        },"×")
      ),
      // Inhoud — gegroepeerd per pagina
      React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"8px 0"}},
        (() => {
          const hlItems = fileHl.filter(h => h.rects?.length > 0 || h.hlOnly);
          if (!hlItems.length) return React.createElement("div",{
            style:{padding:"20px",textAlign:"center",color:W.fgMuted,fontSize:"13px"}
          },"Geen highlights — selecteer tekst en kies 🖍 of 🖍✎");

          // Groepeer per pagina
          const byPage = {};
          hlItems.forEach(h => { (byPage[h.page] = byPage[h.page]||[]).push(h); });

          return Object.keys(byPage).sort((a,b)=>+a-+b).map(pg =>
            React.createElement("div",{key:pg},
              // Pagina-header
              React.createElement("div",{style:{
                padding:"4px 14px", fontSize:"10px", letterSpacing:"0.8px",
                color:W.fgMuted, fontWeight:"600", textTransform:"uppercase",
                borderBottom:`1px solid ${W.splitBg}22`, marginBottom:"2px",
                display:"flex", justifyContent:"space-between", alignItems:"center",
              }},
                React.createElement("span",null,"PAGINA "+pg),
                React.createElement("button",{
                  onClick:()=>{ setPageNum(+pg); scrollToPage(+pg); setShowHlPanel(false); },
                  style:{background:"none",border:"none",color:W.blue,cursor:"pointer",fontSize:"11px",padding:"0 2px"}
                },"→ ga naar")
              ),
              // Highlight items
              ...byPage[pg].map(h => {
                const hColor = HCOLORS.find(c=>c.id===h.color)||HCOLORS[0];
                return React.createElement("div",{key:h.id,style:{
                  margin:"4px 10px", padding:"8px 10px",
                  background:W.bg3, borderRadius:"6px",
                  borderLeft:`3px solid ${hColor.border}`,
                }},
                  // Geciteerde tekst
                  React.createElement("div",{style:{
                    fontSize:"12px", color:W.fg, lineHeight:"1.5",
                    fontStyle:"italic", marginBottom:h.note?"6px":"0",
                  }},
                    h.hlOnly
                      ? React.createElement("span",{style:{color:W.fgMuted,fontSize:"10px"}},"🖍 ") : null,
                    '"'+( h.text?.length>120 ? h.text.slice(0,120)+"…" : h.text||"")+'"'
                  ),
                  // Notitie (indien aanwezig)
                  h.note && React.createElement("div",{style:{
                    fontSize:"12px", color:W.fgDim, padding:"4px 6px",
                    background:hColor.bg, borderRadius:"3px",
                  }}, h.note),
                  // Acties
                  React.createElement("div",{style:{display:"flex",gap:"6px",marginTop:"6px",flexWrap:"wrap"}},
                    // Voeg toe als notitie
                    React.createElement("button",{
                      title:"Voeg toe als losse notitie met link naar PDF",
                      onClick:()=>{
                        const stem = pdfFile.name.replace(/\.pdf$/i,"");
                        const noteContent = [
                          `> ${h.text}`,
                          h.note ? `\n${h.note}` : "",
                          `\n\n---`,
                          `*Bron: [[${stem}]], p.${h.page}*`,
                        ].join("\n");
                        if (onSaveNote) onSaveNote({
                          title: (h.text?.slice(0,50)||"Highlight")+" (p."+h.page+")",
                          content: noteContent,
                          tags: ["highlight","pdf",stem.toLowerCase().replace(/\s+/g,"-")],
                          noteType: "literature",
                          fields: { bron: stem, pagina: String(h.page) },
                        });
                        alert("✓ Notitie aangemaakt met link naar de PDF");
                      },
                      style:{fontSize:"11px",padding:"2px 8px",borderRadius:"4px",
                             background:W.commentBg||"rgba(159,202,86,.1)",color:W.tagColor||W.comment,
                             border:`1px solid ${W.tagBorder||"rgba(159,202,86,.28)"}`,cursor:"pointer"}
                    },"+ notitie"),
                    // Verwijder highlight
                    React.createElement("button",{
                      onClick:()=>{
                        AnnotationStore.remove(h.id);
                        setHighlights(AnnotationStore.getAll());
                      },
                      style:{fontSize:"11px",padding:"2px 8px",borderRadius:"4px",
                             background:"none",color:W.fgMuted,
                             border:`1px solid ${W.splitBg}`,cursor:"pointer"}
                    },"× wis")
                  )
                );
              })
            )
          );
        })()
      ),
      // Footer: alles als notitie exporteren
      React.createElement("div",{style:{
        padding:"10px 14px",borderTop:`1px solid ${W.splitBg}`,flexShrink:0,
      }},
        React.createElement("button",{
          onClick:()=>{
            const hlItems = fileHl.filter(h=>h.rects?.length>0||h.hlOnly);
            if (!hlItems.length) return;
            const stem = pdfFile.name.replace(/\.pdf$/i,"");
            const byPage = {};
            hlItems.forEach(h=>{(byPage[h.page]=byPage[h.page]||[]).push(h);});
            const lines = [
              `# Highlights — ${stem}`,
              `\n*[[${stem}]]*`,
              ...Object.keys(byPage).sort((a,b)=>+a-+b).flatMap(pg=>[
                `\n## Pagina ${pg}`,
                ...byPage[pg].map(h=>`\n> ${h.text}${h.note?"\n\n"+h.note:""}`)
              ]),
              `\n---`,
              `*Geëxporteerd: ${new Date().toLocaleDateString("nl")}*`
            ];
            if (onSaveNote) onSaveNote({
              title: `Highlights — ${stem}`,
              content: lines.join("\n"),
              tags: ["highlights","pdf",stem.toLowerCase().replace(/\s+/g,"-")],
              noteType: "literature",
              importedAt: new Date().toISOString(),
            });
            alert("✓ Alle highlights als notitie opgeslagen");
          },
          style:{width:"100%",padding:"7px",borderRadius:"6px",
                 background:W.blueBg||"rgba(138,198,242,.12)",color:W.blue,
                 border:`1px solid ${W.blueBorder||"rgba(138,198,242,.3)"}`,
                 cursor:"pointer",fontSize:"13px",fontWeight:"600"}
        },"⬆ Alle highlights als notitie")
      )
    ),

    pdfFile && showAnnotPanel&&React.createElement("div",{style:{
      width: isTablet ? "280px" : annotWidth+"px",
      flexShrink:0, background:W.bg2,
      borderLeft:`1px solid ${W.splitBg}`,
      display:"flex", flexDirection:"column",
      position:"relative",
      // Op mobile/tablet als absolute overlay
      ...(isTablet ? {
        position:"absolute",right:0,top:0,bottom:0,zIndex:20,
        boxShadow:"-4px 0 20px rgba(0,0,0,0.5)"
      } : {}),
    }},
      // ── Drag-handle (linkerrand) ─────────────────────────────────────────
      !isTablet && React.createElement("div",{
        style:{
          position:"absolute", left:0, top:0, bottom:0, width:"5px",
          cursor:"ew-resize", zIndex:10,
          background:"transparent",
          transition:"background 0.15s",
        },
        title:"Sleep om de breedte aan te passen",
        onMouseEnter: e => { e.currentTarget.style.background = W.blue+"55"; },
        onMouseLeave: e => { e.currentTarget.style.background = "transparent"; },
        onMouseDown: e => {
          e.preventDefault();
          annotDragRef.current = { startX: e.clientX, startW: annotWidth };
          const onMove = ev => {
            const dx  = annotDragRef.current.startX - ev.clientX; // sleep naar links = groter
            const newW = Math.max(280, annotDragRef.current.startW + dx);
            setAnnotWidth(newW);
          };
          const onUp = () => {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup",  onUp);
            annotDragRef.current = null;
          };
          document.addEventListener("mousemove", onMove);
          document.addEventListener("mouseup",   onUp);
        },
      }),
      React.createElement("div",{style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,padding:"6px 10px",display:"flex",alignItems:"center",gap:"6px",flexShrink:0}},
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"1px",flex:1}},
          React.createElement("span",{style:{fontSize:"14px",color:W.statusFg,letterSpacing:"1px"}},"ANNOTATIES"),
          pdfFile&&React.createElement("span",{style:{fontSize:"11px",color:"#c8c0b4",maxWidth:"180px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},pdfFile.name)
        ),
        React.createElement("span",{style:{background:W.blue,color:W.bg,borderRadius:"10px",padding:"0 6px",fontSize:"14px"}},fileHl.length),
        React.createElement("div",{style:{flex:1}}),
        // Export alle annotaties als literatuurnotitie
        fileHl.length > 0 && React.createElement("button",{
          onClick: exportAllAnnotations,
          title: "Exporteer alle annotaties als één literatuurnotitie",
          style:{
            background:"rgba(234,231,136,0.1)",
            border:`1px solid rgba(234,231,136,0.3)`,
            borderRadius:"4px", color:W.yellow,
            padding:"3px 8px", fontSize:"10px",
            cursor:"pointer", fontWeight:"600",
            display:"flex", alignItems:"center", gap:"4px",
          }
        },"⬆ exporteer"),
        filterTag&&React.createElement("button",{
          onClick:()=>setFilterTag(null),
          style:{background:"rgba(159,202,86,0.16)",color:"#b8e06a",
                 border:"1px solid rgba(159,202,86,0.45)",
                 borderRadius:"5px",fontSize:"12px",fontWeight:"600",
                 padding:"3px 9px",cursor:"pointer",
                 display:"flex",alignItems:"center",gap:"4px"}
        },
          React.createElement("span",{style:{fontSize:"10px",opacity:0.7}},"#"),
          filterTag,
          React.createElement("span",{style:{marginLeft:"3px",fontSize:"13px",opacity:0.7}},"×")
        ),
        React.createElement("button",{onClick:()=>setShowAnnotPanel(false),style:{background:"none",border:"none",color:W.fgMuted,fontSize:"16px",cursor:"pointer",padding:"0 2px",lineHeight:1}}, "×")
      ),
      allAnnotTags.length>0&&React.createElement("div",{style:{padding:"5px 8px",borderBottom:`1px solid ${W.splitBg}`,background:"rgba(0,0,0,0.15)",flexShrink:0}},
        React.createElement(TagFilterBar,{tags:allAnnotTags,activeTag:filterTag,onChange:setFilterTag,compact:true,maxVisible:5})
      ),
      React.createElement("div",{style:{flex:1,overflow:"auto"}},
        panelHl.length===0
          ?React.createElement("div",{style:{padding:"24px 14px",color:W.fgMuted,fontSize:"14px",textAlign:"center",lineHeight:"2"}},
              !pdfFile
              ? React.createElement(React.Fragment,null,
                  React.createElement("div",{style:{fontSize:"28px",marginBottom:"8px"}},"📄"),
                  React.createElement("div",{style:{color:W.fgDim,marginBottom:"4px"}},"Geen PDF geopend"),
                  React.createElement("div",{style:{fontSize:"14px",color:W.splitBg,lineHeight:"1.7"}},
                    "Open een PDF via de toolbar.","\n","Annotaties worden hier getoond.")
                )
              : filterTag
                ? `Geen annotaties met #${filterTag}`
                : React.createElement(React.Fragment,null,
                    React.createElement("div",{style:{fontSize:"20px",marginBottom:"8px"}},"✏"),
                    React.createElement("div",{style:{color:W.fgDim}},"Nog geen annotaties"),
                    React.createElement("div",{style:{fontSize:"14px",color:W.splitBg,lineHeight:"1.7",marginTop:"4px"}},
                      "Selecteer tekst in de PDF","\n","om een annotatie te maken.")
                  ))
          :panelHl.map(h=>{
            const col=HCOLORS.find(c=>c.id===h.colorId)||HCOLORS[0];
            const isEditing=editingId===h.id;
            return React.createElement("div",{key:h.id,style:{borderBottom:`1px solid ${W.splitBg}`,borderLeft:`3px solid ${col.border}`,background:isEditing?"rgba(255,255,255,0.025)":"transparent"}},
              React.createElement("div",{style:{padding:"8px 10px",cursor:"pointer"},onClick:()=>setEditingId(isEditing?null:h.id)},
                React.createElement("div",{style:{display:"flex",alignItems:"flex-start",gap:"6px",marginBottom:"3px"}},
                  React.createElement("div",{style:{fontSize:"14px",color:W.string,fontStyle:"italic",lineHeight:"1.5",flex:1}},'"',h.text.substring(0,70),h.text.length>70?"…":"",'"'),
                ),
                h.note&&!isEditing&&React.createElement("div",{style:{fontSize:"14px",color:W.fg,lineHeight:"1.4",marginBottom:"4px"}},h.note.substring(0,60),h.note.length>60?"…":""),
                React.createElement("div",{style:{display:"flex",gap:"3px",flexWrap:"wrap",alignItems:"center"}},
                  ...(h.tags||[]).map(t=>React.createElement(TagPill,{key:t,tag:t,small:true})),
                  React.createElement("span",{
                    onClick:e=>{e.stopPropagation();setPageNum(h.page);scrollToPage(h.page);},
                    title:`Ga naar pagina ${h.page}`,
                    style:{
                      fontSize:"11px", fontWeight:"600",
                      color:col.border,
                      background:col.bg,
                      border:`1px solid ${col.border}55`,
                      borderRadius:"10px",
                      padding:"1px 7px",
                      marginLeft:"auto",
                      cursor:"pointer",
                      flexShrink:0,
                    }
                  },"p.",h.page),
                  React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted}},isEditing?"▲":"▼")
                )
              ),
              isEditing&&React.createElement("div",{style:{padding:"0 10px 12px",borderTop:`1px solid ${W.splitBg}`}},
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,margin:"8px 0 4px",letterSpacing:"1px"}},"NOTITIE"),
                React.createElement("textarea",{value:h.note||"",onChange:e=>updateHighlight(h.id,{note:e.target.value}),rows:3,style:{width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"4px",padding:"6px 8px",color:W.fg,fontSize:"14px",outline:"none",resize:"vertical"},placeholder:"Notitie toevoegen…"}),
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,margin:"8px 0 4px",letterSpacing:"1px"}},"TAGS"),
                React.createElement(SmartTagEditor,{tags:h.tags||[],onChange:tags=>updateHighlight(h.id,{tags}),allTags:[...allTags,...allAnnotTags]}),
                React.createElement("div",{style:{display:"flex",gap:"4px",margin:"8px 0",flexWrap:"wrap",alignItems:"center"}},
                ...HCOLORS.map(c=>React.createElement("button",{
                  key:c.id,
                  onClick:()=>updateHighlight(h.id,{colorId:c.id}),
                  title:c.label + (c.desc ? " — " + c.desc : ""),
                  style:{
                    display:"flex",alignItems:"center",gap:"3px",
                    padding:"2px 6px",borderRadius:"10px",
                    background:h.colorId===c.id?c.bg:"transparent",
                    border:`1px solid ${h.colorId===c.id?c.border:W.splitBg}`,
                    cursor:"pointer",fontSize:"9px",color:h.colorId===c.id?c.border:W.fgDim,
                    fontWeight:h.colorId===c.id?"700":"400",
                  }
                },
                  React.createElement("span",{style:{width:"8px",height:"8px",borderRadius:"50%",background:c.border,flexShrink:0}}),
                  c.label.split(" · ")[0]
                ))),
                React.createElement("div",{style:{display:"flex",gap:"6px"}},
                  React.createElement("button",{onClick:()=>setEditingId(null),style:{background:W.comment,color:W.bg,border:"none",borderRadius:"3px",padding:"3px 10px",fontSize:"14px",cursor:"pointer",fontWeight:"bold"}},"✓ klaar"),
                  React.createElement("button",{onClick:()=>removeHighlight(h.id),style:{background:"none",color:W.orange,border:`1px solid rgba(229,120,109,0.3)`,borderRadius:"3px",padding:"3px 8px",fontSize:"14px",cursor:"pointer"}},":del")
                )
              )
            );
          })
      )
    )
  );
};


// ── Vault Settings Panel ───────────────────────────────────────────────────────
