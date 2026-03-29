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
  { id:"claude-opus-4-20250514",      label:"Claude Opus 4",       provider:"anthropic",  group:"Anthropic",  icon:"⚡" },
  { id:"claude-sonnet-4-20250514",    label:"Claude Sonnet 4",     provider:"anthropic",  group:"Anthropic",  icon:"⚡" },
  { id:"claude-haiku-4-5-20251001",   label:"Claude Haiku 4.5",    provider:"anthropic",  group:"Anthropic",  icon:"⚡" },
  // ── Google ─────────────────────────────────────────────────────────────────
  { id:"gemini-2.5-pro",              label:"Gemini 2.5 Pro",      provider:"google",     group:"Google",     icon:"🔷" },
  { id:"gemini-2.0-flash",            label:"Gemini 2.0 Flash",    provider:"google",     group:"Google",     icon:"🔷" },
  // ── OpenAI ─────────────────────────────────────────────────────────────────
  { id:"gpt-4.1",                     label:"GPT-4.1",             provider:"openai",     group:"OpenAI",     icon:"🟢" },
  { id:"gpt-4.1-mini",                label:"GPT-4.1 mini",        provider:"openai",     group:"OpenAI",     icon:"🟢" },
  { id:"o4-mini",                     label:"o4-mini (redeneren)", provider:"openai",     group:"OpenAI",     icon:"🟢" },
  // ── Mistral (direct) ───────────────────────────────────────────────────────
  { id:"mistral-medium-latest",       label:"Mistral Medium 3",    provider:"mistral",    group:"Mistral",    icon:"🌬" },
  { id:"mistral-small-latest",        label:"Mistral Small 3.1",   provider:"mistral",    group:"Mistral",    icon:"🌬" },
  { id:"magistral-medium-latest",     label:"Magistral Medium",    provider:"mistral",    group:"Mistral",    icon:"🌬" },
  // ── Open Source via OpenRouter ─────────────────────────────────────────────
  { id:"moonshotai/kimi-k2.5",        label:"Kimi K2.5",           provider:"openrouter", group:"Open source",icon:"🌙" },
  { id:"moonshotai/kimi-k2",          label:"Kimi K2",             provider:"openrouter", group:"Open source",icon:"🌙" },
  { id:"meta-llama/llama-4-maverick", label:"Llama 4 Maverick",    provider:"openrouter", group:"Open source",icon:"🦙" },
  { id:"meta-llama/llama-4-scout",    label:"Llama 4 Scout",       provider:"openrouter", group:"Open source",icon:"🦙" },
  { id:"google/gemma-3-27b-it",       label:"Gemma 3 27B",         provider:"openrouter", group:"Open source",icon:"💎" },
  { id:"mistralai/mistral-small-3.1", label:"Mistral Small (OR)",  provider:"openrouter", group:"Open source",icon:"🌬" },
  { id:"deepseek/deepseek-r1",        label:"DeepSeek R1",         provider:"openrouter", group:"Open source",icon:"🔍" },
  { id:"qwen/qwen3-30b-a3b",          label:"Qwen3 30B",           provider:"openrouter", group:"Open source",icon:"🐉" },
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

// ── PDFUploadPanel — upload + AI tags + notitietype ──────────────────────────
const PDFUploadPanel = ({ serverPdfs=[], onRefreshPdfs, onOpenPdf, llmModel,
                          allTags=[], notes=[], onAddNote, addJob, updateJob }) => {
  const { useState, useRef, useCallback } = React;
  const [dragOver,   setDragOver]   = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState(null);
  const fileRef = useRef(null);

  // Preview fase na upload
  const [preview,    setPreview]    = useState(null); // {name, text}
  const [pdfTags,    setPdfTags]    = useState([]);
  const [pdfType,    setPdfType]    = useState("literature");
  const [tagsLoading, setTagsLoading] = useState(false);
  const [typeLoading, setTypeLoading] = useState(false);
  const [suggestedType, setSuggestedType] = useState(null);
  const [noteSaved,  setNoteSaved]  = useState(false);

  const TYPE_META = {
    fleeting:   { label: "Vluchtig",   color: "#e8a44a" },
    literature: { label: "Literatuur", color: W.blue    },
    permanent:  { label: "Permanent",  color: W.comment },
    index:      { label: "Index",      color: W.purple  },
  };

  const resetPreview = () => {
    setPreview(null); setPdfTags([]); setPdfType("literature");
    setTagsLoading(false); setTypeLoading(false);
    setSuggestedType(null); setNoteSaved(false);
  };

  const doUpload = useCallback(async (files) => {
    const pdfs = [...files].filter(f => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) return;
    setUploading(true); setError(null);
    try {
      const file = pdfs[0]; // eerste PDF — preview per stuk
      const jid = addJob?.({ id: Math.random().toString(36).slice(2),
        type: "pdf", label: "📄 " + file.name.slice(0, 30) + "…" });
      const res = await PDFService.uploadPdf(file);
      const name = res?.name || file.name;
      updateJob?.(jid, { status: "done", result: "Geüpload" });
      await onRefreshPdfs?.();

      // Extraheer tekst voor AI analyse
      let pdfText = "";
      try {
        const tr = await fetch("/api/pdf-text/" + encodeURIComponent(name));
        const td = await tr.json();
        pdfText = td.text || "";
      } catch {}

      setPreview({ name, text: pdfText });

      // Parallel: AI tags + notitietype
      if (llmModel && pdfText) {
        setTagsLoading(true); setTypeLoading(true);

        _aiTagSuggest(pdfText.slice(0, 4000), [], allTags, llmModel)
          .then(t => { if (t.length) setPdfTags(t); })
          .catch(() => {})
          .finally(() => setTagsLoading(false));

        fetch("/api/llm/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: llmModel,
            messages: [{ role: "user", content:
              "Analyseer dit document en geef het beste Zettelkasten-notitietype. " +
              "Kies ALLEEN: fleeting, literature, permanent, index\n\n" +
              pdfText.slice(0, 800)
            }],
            system: "Geef ALLEEN één woord: fleeting, literature, permanent of index.",
          }),
        }).then(r => r.json()).then(d => {
          const raw = (d.content || d.response || "").trim().toLowerCase();
          const match = ["fleeting","literature","permanent","index"].find(v => raw.includes(v));
          if (match) { setSuggestedType(match); setPdfType(match); }
        }).catch(() => {}).finally(() => setTypeLoading(false));
      }

      // Upload meerdere PDFs stil op de achtergrond
      for (const extra of pdfs.slice(1)) {
        const ej = addJob?.({ id: Math.random().toString(36).slice(2),
          type: "pdf", label: "📄 " + extra.name.slice(0, 30) + "…" });
        await PDFService.uploadPdf(extra);
        updateJob?.(ej, { status: "done", result: "Geüpload" });
      }
      if (pdfs.length > 1) await onRefreshPdfs?.();

    } catch(e) {
      setError(e.message);
    }
    setUploading(false);
  }, [onRefreshPdfs, addJob, updateJob, allTags, llmModel]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    doUpload(e.dataTransfer.files);
  }, [doUpload]);

  // ── Preview fase ──────────────────────────────────────────────────────────
  if (preview) return React.createElement("div", {
    style: { flex: 1, display: "flex", flexDirection: "column",
             overflow: "hidden", minHeight: 0, background: W.bg }
  },
    // Header
    React.createElement("div", {
      style: { background: W.bg2, borderBottom: `1px solid ${W.splitBg}`,
               padding: "12px 16px", flexShrink: 0,
               overflow: "visible", position: "relative", zIndex: 10 }
    },
      React.createElement("div", {
        style: { fontSize: "14px", fontWeight: "600", color: W.statusFg,
                 marginBottom: "8px", display: "flex", alignItems: "center",
                 gap: "8px" }
      },
        React.createElement("span", null, "📄"),
        React.createElement("span", {
          style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                   flex: 1 }
        }, preview.name),
        React.createElement("button", {
          onClick: () => { onOpenPdf?.(preview.name); resetPreview(); },
          style: { background: "rgba(125,216,198,0.1)",
                   border: `1px solid rgba(125,216,198,0.3)`,
                   borderRadius: "5px", color: W.blue,
                   padding: "3px 10px", fontSize: "11px", cursor: "pointer",
                   flexShrink: 0 }
        }, "→ Open PDF")
      ),

      // Notitietype
      React.createElement("div", {
        style: { display: "flex", gap: "4px", alignItems: "center",
                 marginBottom: "8px", flexWrap: "wrap" }
      },
        React.createElement("span", {
          style: { fontSize: "9px", color: W.fgMuted, textTransform: "uppercase",
                   letterSpacing: "0.5px", marginRight: "2px" }
        }, typeLoading ? "✦ type…" : "Type:"),
        ["fleeting","literature","permanent","index"].map(id => {
          const m = TYPE_META[id];
          const isActive = pdfType === id;
          const isSugg = suggestedType === id;
          return React.createElement("button", {
            key: id, onClick: () => setPdfType(id),
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
                   letterSpacing: "0.5px" }
        }, tagsLoading ? "✦ tags laden…" : "Tags:"),
      ),
      React.createElement(SmartTagEditor, {
        tags: pdfTags, onChange: setPdfTags,
        allTags, content: preview.text?.slice(0, 4000) || "", llmModel,
      })
    ),

    // Acties
    React.createElement("div", {
      style: { padding: "10px 16px", borderBottom: `1px solid ${W.splitBg}`,
               flexShrink: 0, display: "flex", gap: "8px", alignItems: "center" }
    },
      React.createElement("div", {
        style: { fontSize: "11px", color: W.fgMuted, flex: 1 }
      },
        noteSaved
          ? React.createElement("span", { style: { color: W.comment } },
              "✓ Literatuurnotitie aangemaakt")
          : "Maak een literatuurnotitie aan die naar deze PDF linkt"
      ),
      !noteSaved && React.createElement("button", {
        onClick: () => resetPreview(),
        style: { background: "none", border: `1px solid ${W.splitBg}`,
                 color: W.fgMuted, borderRadius: "5px",
                 padding: "5px 10px", fontSize: "12px", cursor: "pointer" }
      }, "Sla over"),
      !noteSaved && React.createElement("button", {
        onClick: async () => {
          const now = new Date().toISOString();
          const stem = preview.name.replace(/\.pdf$/i, "");
          const content =
            `📎 **Bron:** [[pdf:${preview.name}]]\n\n` +
            `---\n\n` +
            `## Aantekeningen\n\n` +
            `_Voeg hier je eigen samenvatting en inzichten toe._\n\n` +
            `---\n📄 *Geïmporteerd: ${preview.name}*`;
          await onAddNote?.({
            id: typeof genId === "function" ? genId() :
                Math.random().toString(36).slice(2),
            title: stem,
            content,
            tags: pdfTags,
            noteType: pdfType,
            importedAt: now, created: now, modified: now,
          });
          setNoteSaved(true);
          setTimeout(() => resetPreview(), 1500);
        },
        style: {
          background: "rgba(125,216,198,0.15)",
          border: `1px solid rgba(125,216,198,0.4)`,
          borderRadius: "5px", color: W.blue,
          padding: "5px 16px", fontSize: "12px",
          cursor: "pointer", fontWeight: "600",
        }
      }, "✎ Maak notitie")
    ),

    // PDF lijst (compact)
    React.createElement("div", {
      style: { flex: 1, overflowY: "auto", padding: "8px 0" }
    },
      serverPdfs.map((pdf, i) => {
        const pdfName = typeof pdf === "string" ? pdf : pdf.name;
        return React.createElement("div", {
          key: i,
          style: { display: "flex", alignItems: "center", gap: "8px",
                   padding: "6px 16px", cursor: "pointer",
                   borderBottom: `1px solid ${W.splitBg}` },
          onClick: () => onOpenPdf?.(pdfName),
          onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.03)",
          onMouseLeave: e => e.currentTarget.style.background = "transparent",
        },
          React.createElement("span", { style: { fontSize: "12px" } }, "📄"),
          React.createElement("span", {
            style: { flex: 1, fontSize: "12px", color: W.fg,
                     overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
          }, pdfName)
        );
      })
    )
  );

  // ── Upload fase ────────────────────────────────────────────────────────────
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

      // Vault bibliotheek
      serverPdfs.length > 0 && React.createElement("div", null,
        React.createElement("div", {
          style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                   marginBottom: "8px", fontWeight: "600" }
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
      )
    ),

    React.createElement("input", {
      ref: fileRef, type: "file", accept: ".pdf",
      multiple: true, style: { display: "none" },
      onChange: e => { doUpload(e.target.files); e.target.value = ""; }
    })
  );
};

const PDFViewer = ({pdfNotes, setPdfNotes, allTags, serverPdfs, onRefreshPdfs, onAutoSummarize, onDeletePdf, onPasteToNote=null, onAddNote=null, notes=[], isTablet=false}) => {
  const [pdfDoc,     setPdfDoc]     = useState(null);
  const [pdfFile,    setPdfFile]    = useState(null);
  const [pageNum,    setPageNum]    = useState(1);   // huidige zichtbare pagina (voor annotaties)
  const [numPages,   setNumPages]   = useState(0);
  const [scale,      setScale]      = useState(1.4);
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
  const [summarizing,   setSummarizing]   = useState(false);
  const [summarizeErr,  setSummarizeErr]  = useState(null);
  const [renderedPages, setRenderedPages] = useState([]);  // [{num, canvas, textLayer}]

  const canvasRef   = useRef(null);    // enkel canvas (legacy, voor annotatie-hit-test)
  const textLayerRef= useRef(null);
  const wrapRef     = useRef(null);
  const scrollRef   = useRef(null);
  const fileRef     = useRef(null);
  const renderRef   = useRef(null);
  const tlRenderRef = useRef(null);
  const pinchRef    = useRef({active:false, dist0:0, scale0:1.4});
  const pageRefs    = useRef({});      // {pageNum: domNode} voor scroll-to-page
  const renderingRef= useRef(false);
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
  // Tijdens een muisknop-drag zetten we userSelect op de hele container zodat
  // de browser de selectie niet reset als de cursor de text-layer van één pagina verlaat.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onDown = (e) => {
      // Alleen linker muisknop, niet op de popup
      if (e.button !== 0) return;
      if (e.target.closest?.('[data-annot-popup]')) return;
      isSelectingRef.current = true;
      // Zet userSelect op de wrapper zodat selectie door gaat over pagina-grenzen
      if (wrapRef.current) {
        wrapRef.current.style.userSelect = "text";
        wrapRef.current.style.webkitUserSelect = "text";
      }
    };

    const onUp = () => {
      if (!isSelectingRef.current) return;
      isSelectingRef.current = false;
      // Reset na de selectie (tryOpenAnnotPopup leest de selectie al)
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
  const renderAllPages = useCallback(async (doc, sc) => {
    if (!doc || renderingRef.current) return;
    renderingRef.current = true;
    setRenderedPages([]);
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      try {
        const page = await doc.getPage(i);
        const vp   = page.getViewport({scale: sc});
        const canvas = document.createElement("canvas");
        canvas.width  = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.display = "block";
        const ctx = canvas.getContext("2d");
        await page.render({canvasContext: ctx, viewport: vp}).promise;

        // Tekst-laag div
        const tl = document.createElement("div");
        tl.className = "textLayer";
        tl.style.width  = Math.floor(vp.width)  + "px";
        tl.style.height = Math.floor(vp.height) + "px";
        const tc = await page.getTextContent();
        try {
          await window.pdfjsLib.renderTextLayer({
            textContentSource: tc, container: tl, viewport: vp, textDivs: []
          }).promise;
        } catch {}

        pages.push({num: i, canvas, textLayer: tl,
                    width: Math.floor(vp.width), height: Math.floor(vp.height)});
        // Progressief renderen: toon pagina's zodra ze klaar zijn
        setRenderedPages(prev => [...prev, {num:i, canvas, textLayer:tl,
                                             width:Math.floor(vp.width), height:Math.floor(vp.height)}]);
      } catch(e) { console.warn("Pagina "+i+" render fout:", e); }
    }
    renderingRef.current = false;
  }, []);

  useEffect(() => {
    if (pdfDoc) renderAllPages(pdfDoc, scale);
  }, [pdfDoc, scale, renderAllPages]);

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
      setPdfDoc(doc); setNumPages(doc.numPages); setPageNum(1);
      setPdfFile({name});
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
  const [iosAnnotBtn, setIosAnnotBtn] = useState(null);

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
  }, []);

  // iOS selectionchange → zweefknop
  useEffect(() => {
    if (navigator.maxTouchPoints < 1) return;
    let t = null;
    const fn = () => {
      clearTimeout(t);
      t = setTimeout(() => {
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
      }, 400);
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
    console.log("[PDF] saveHighlight: page=",hlPage,"rects=",pendingRectsRef.current.length);
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
          React.createElement("button",{onClick:()=>{ const p=Math.max(1,pageNum-1); setPageNum(p); scrollToPage(p); },style:{background:"none",border:"none",color:W.fg,cursor:"pointer",fontSize:"16px",padding:"0 3px"}},"◀"),
          React.createElement("span",{style:{color:W.statusFg,minWidth:"60px",textAlign:"center"}},pageNum," / ",numPages),
          React.createElement("button",{onClick:()=>{ const p=Math.min(numPages,pageNum+1); setPageNum(p); scrollToPage(p); },style:{background:"none",border:"none",color:W.fg,cursor:"pointer",fontSize:"16px",padding:"0 3px"}},"▶"),
          React.createElement("span",{style:{color:W.fgMuted}},"│"),
          React.createElement("button",{onClick:()=>setScale(s=>Math.max(0.5,+(s-0.2).toFixed(1))),style:{background:"none",border:"none",color:W.fg,cursor:"pointer",padding:"0 4px",fontSize:"16px"}},"−"),
          React.createElement("span",{style:{color:W.fgMuted,minWidth:"40px",textAlign:"center"}},Math.round(scale*100),"%"),
          React.createElement("button",{onClick:()=>setScale(s=>Math.min(3,+(s+0.2).toFixed(1))),style:{background:"none",border:"none",color:W.fg,cursor:"pointer",padding:"0 4px",fontSize:"16px"}},"+"),
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
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
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
                    height: "160px", background: thumb ? "transparent" : "rgba(138,198,242,0.05)",
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
          // ── LIJSTWEERGAVE — volledig, geen thumbnail ──────────────────────────
          return React.createElement("div", { style: { width: "100%" } },
            filtered.map(p => {
              const annotCount = (AnnotationStore.getAll() || []).filter(a => a.file === p.name).length;
              const sizeKb = Math.round((p.size || 0) / 1024);
              const isOpen = pdfFile?.name === p.name;
              const stem = p.name.replace(/\.pdf$/i, "");
              const readMins = Math.max(1, Math.round(sizeKb / 50));

              return React.createElement("div", {
                key: p.name,
                style: {
                  display: "flex", alignItems: "center", gap: "0",
                  borderBottom: `1px solid ${W.splitBg}`,
                  background: isOpen ? "rgba(125,216,198,0.05)" : "transparent",
                  transition: "background 0.1s",
                },
                onMouseEnter: e => { if (!isOpen) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; },
                onMouseLeave: e => { e.currentTarget.style.background = isOpen ? "rgba(125,216,198,0.05)" : "transparent"; },
              },
                // Klikbaar info-gedeelte — neemt alle ruimte
                React.createElement("div", {
                  style: { flex: 1, minWidth: 0, padding: "11px 20px", cursor: "pointer" },
                  onClick: () => openFromServer(p.name),
                },
                  // Naam
                  React.createElement("div", { style: {
                    fontSize: "14px", fontWeight: isOpen ? "600" : "400",
                    color: isOpen ? W.blue : W.fg,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    marginBottom: "3px",
                  }}, stem),
                  // Meta-rij
                  React.createElement("div", { style: {
                    display: "flex", gap: "14px",
                    fontSize: "11px", color: W.fgMuted, alignItems: "center",
                  }},
                    React.createElement("span", null,
                      sizeKb > 1024 ? `${(sizeKb/1024).toFixed(1)} MB` : `${sizeKb} KB`),
                    React.createElement("span", null, `~${readMins} min`),
                    annotCount > 0 && React.createElement("span", {
                      style: { color: W.comment }
                    }, `✏ ${annotCount}`),
                    isOpen && React.createElement("span", {
                      style: { color: W.blue, fontSize: "10px",
                               background: "rgba(125,216,198,0.12)",
                               borderRadius: "3px", padding: "1px 6px" }
                    }, "open")
                  )
                ),

                // Acties — rechts, flexShrink:0
                React.createElement("div", {
                  style: { display: "flex", alignItems: "center",
                           gap: "4px", padding: "0 12px", flexShrink: 0 }
                },
                  React.createElement("button", {
                    onClick: e => { e.stopPropagation(); openFromServer(p.name); },
                    style: {
                      background: "rgba(125,216,198,0.08)",
                      border: `1px solid rgba(125,216,198,0.22)`,
                      color: W.blue, borderRadius: "5px",
                      padding: "4px 14px", fontSize: "12px",
                      cursor: "pointer", fontWeight: "600",
                    }
                  }, "Open"),
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
                    style: {
                      background: "none", border: "none",
                      color: W.fgMuted, borderRadius: "4px",
                      padding: "4px 7px", fontSize: "14px", cursor: "pointer",
                    },
                    onMouseEnter: e => { e.currentTarget.style.color = W.orange; e.currentTarget.style.background = "rgba(245,169,127,0.1)"; },
                    onMouseLeave: e => { e.currentTarget.style.color = W.fgMuted; e.currentTarget.style.background = "none"; },
                  }, "×")
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
      ),

      // ── Scroll area: alle pagina's doorlopend ───────────────────────────────
      // Wrapper: flex:1 + position:relative — bewezen iOS Safari patroon (zelfde als NotePreview)
      React.createElement("div",{style:{flex:1, position:"relative", minHeight:0, overflow:"hidden"}},
      React.createElement("div",{
        ref:scrollRef,
        style:{
          position:"absolute", inset:0, overflow:"auto", background:W.lineNrBg,
          WebkitOverflowScrolling:"touch",
          touchAction:"pan-y",
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
        !pdfDoc&&!isLoading&&React.createElement("div",{style:{display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",height:"100%",gap:"16px",color:W.fgMuted}},
          React.createElement("div",{style:{fontSize:"56px"}},"📄"),
          React.createElement("div",{style:{fontSize:"14px",color:W.fgDim}},"PDF laden…"),
        ),

        // Alle pagina's als doorlopende kolom
        pdfDoc && React.createElement("div",{
          ref:wrapRef,
          style:{
            display:"flex", flexDirection:"column", alignItems:"center",
            padding:"20px 0 40px", gap:0,
            userSelect:"text", WebkitUserSelect:"text",
          }
        },
          renderedPages.map(pg =>
            React.createElement("div",{
              key:pg.num,
              "data-page":pg.num,
              ref:el=>{ pageRefs.current[pg.num]=el; },
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
          renderedPages.length < numPages && renderedPages.length > 0 &&
            React.createElement("div",{style:{
              color:W.fgMuted,fontSize:"14px",padding:"16px",
              display:"flex",alignItems:"center",gap:"8px"
            }},
              React.createElement("span",{style:{animation:"ai-pulse 1.4s ease-in-out infinite"}},
                "⏳"),
              `Pagina ${renderedPages.length+1} van ${numPages} laden…`
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
            background:W.bg3,
            borderBottom:`2px solid ${activeColor.border}`,
            borderLeft:`3px solid ${activeColor.border}`,
            padding:"10px 14px",
            zIndex:9999,
            boxShadow:"0 4px 24px rgba(0,0,0,0.7)",
            display:"flex", flexDirection:"column", gap:"8px",
          },
          onMouseDown:e=>e.stopPropagation(),
          onMouseUp:e=>e.stopPropagation(),
          onTouchStart:e=>e.stopPropagation(),
        },
          // Rij 1: citaat + sluiten
          React.createElement("div",{style:{display:"flex",gap:"10px",alignItems:"flex-start"}},
            React.createElement("div",{style:{
              flex:1, fontSize:"13px", color:W.fgDim,
              padding:"5px 9px", background:activeColor.bg, borderRadius:"4px",
              fontStyle:"italic", lineHeight:"1.5",
              borderLeft:`3px solid ${activeColor.border}`,
              overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis",
            }},
              '"',pendingSel.substring(0,100),pendingSel.length>100?"…":"",'"'
            ),
            React.createElement("button",{
              onClick:()=>{
                const savedTop = scrollRef.current?.scrollTop||0;
                const savedLeft = scrollRef.current?.scrollLeft||0;
                setPendingSel(null); window.getSelection()?.removeAllRanges();
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
              style:{background:activeColor.border,color:W.bg,border:"none",
                     borderRadius:"4px",padding:"5px 14px",fontSize:"13px",
                     cursor:"pointer",fontWeight:"bold"}},"✓ Opslaan"),
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
    // Annotatiepaneel — knop om te openen (alleen als PDF open is)
    pdfFile && React.createElement("button",{
      onClick:()=>setShowAnnotPanel(p=>!p),
      title: showAnnotPanel ? "Annotaties verbergen" : "Annotaties tonen",
      style:{
        position:"absolute", right:(showAnnotPanel && !isTablet)?286:0, top:"50%",
        transform:"translateY(-50%)",
        background:W.bg2, border:`1px solid ${W.splitBg}`,
        borderRight:showAnnotPanel?"none":"1px solid "+W.splitBg,
        borderRadius:showAnnotPanel?"4px 0 0 4px":"0 4px 4px 0",
        color:W.fgMuted, fontSize:"14px", cursor:"pointer",
        padding:"8px 5px", zIndex:10, lineHeight:1,
        writingMode:"vertical-rl",
      }
    }, showAnnotPanel ? "▶" : "◀ " + (fileHl.length > 0 ? fileHl.length : "")),

    // Annotations panel
    pdfFile && showAnnotPanel&&React.createElement("div",{style:{
      width:"280px",flexShrink:0,background:W.bg2,
      borderLeft:`1px solid ${W.splitBg}`,
      display:"flex",flexDirection:"column",
      // Op mobile/tablet als absolute overlay
      ...(isTablet ? {
        position:"absolute",right:0,top:0,bottom:0,zIndex:20,
        boxShadow:"-4px 0 20px rgba(0,0,0,0.5)"
      } : {}),
    }},
      React.createElement("div",{style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,padding:"6px 10px",display:"flex",alignItems:"center",gap:"6px",flexShrink:0}},
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"1px",flex:1}},
          React.createElement("span",{style:{fontSize:"14px",color:W.statusFg,letterSpacing:"1px"}},"ANNOTATIES"),
          pdfFile&&React.createElement("span",{style:{fontSize:"11px",color:"#c8c0b4",maxWidth:"180px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},pdfFile.name)
        ),
        React.createElement("span",{style:{background:W.blue,color:W.bg,borderRadius:"10px",padding:"0 6px",fontSize:"14px"}},fileHl.length),
        React.createElement("div",{style:{flex:1}}),
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
                React.createElement("div",{style:{fontSize:"14px",color:W.string,fontStyle:"italic",lineHeight:"1.5",marginBottom:"3px"}},'"',h.text.substring(0,70),h.text.length>70?"…":"",'"'),
                h.note&&!isEditing&&React.createElement("div",{style:{fontSize:"14px",color:W.fg,lineHeight:"1.4",marginBottom:"4px"}},h.note.substring(0,60),h.note.length>60?"…":""),
                React.createElement("div",{style:{display:"flex",gap:"3px",flexWrap:"wrap",alignItems:"center"}},
                  ...(h.tags||[]).map(t=>React.createElement(TagPill,{key:t,tag:t,small:true})),
                  React.createElement("span",{style:{fontSize:"9px",color:W.fgMuted,marginLeft:"auto"}},"p.",h.page),
                  React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted}},isEditing?"▲":"▼")
                )
              ),
              isEditing&&React.createElement("div",{style:{padding:"0 10px 12px",borderTop:`1px solid ${W.splitBg}`}},
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,margin:"8px 0 4px",letterSpacing:"1px"}},"NOTITIE"),
                React.createElement("textarea",{value:h.note||"",onChange:e=>updateHighlight(h.id,{note:e.target.value}),rows:3,style:{width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"4px",padding:"6px 8px",color:W.fg,fontSize:"14px",outline:"none",resize:"vertical"},placeholder:"Notitie toevoegen…"}),
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,margin:"8px 0 4px",letterSpacing:"1px"}},"TAGS"),
                React.createElement(SmartTagEditor,{tags:h.tags||[],onChange:tags=>updateHighlight(h.id,{tags}),allTags:[...allTags,...allAnnotTags]}),
                React.createElement("div",{style:{display:"flex",gap:"5px",margin:"8px 0"}},...HCOLORS.map(c=>React.createElement("button",{key:c.id,onClick:()=>updateHighlight(h.id,{colorId:c.id}),style:{width:"18px",height:"18px",borderRadius:"3px",background:c.bg,border:`2px solid ${h.colorId===c.id?c.border:W.splitBg}`,cursor:"pointer",padding:0}}))),
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

