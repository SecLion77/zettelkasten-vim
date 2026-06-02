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
  const currentUrlRef  = React.useRef("");
  const doImportRef    = React.useRef(null); // altijd de laatste doImport
  const prevAiLoading  = React.useRef(false);
  React.useEffect(() => {
    const isLoading = importPreview?.aiLoading;
    if (isLoading) {
      // Start timer
      setAiElapsed(0); setAiError(null);
      aiTimerRef.current = setInterval(() => setAiElapsed(s => s + 1), 1000);
    } else {
      clearInterval(aiTimerRef.current);
      if (prevAiLoading.current) {
        // AI net klaar: scroll naar samenvatting
        setTimeout(() => summaryRef.current?.scrollIntoView({behavior:"smooth", block:"nearest"}), 200);
      }
    }
    prevAiLoading.current = !!isLoading;
    return () => clearInterval(aiTimerRef.current);
  }, [importPreview?.aiLoading]);
  const [busy,           setBusy]           = useState(false);
  const [importing,      setImporting]      = useState(false);
  const [importStep,     setImportStep]     = useState(0);
  const [importElapsed,  setImportElapsed]  = useState(0);
  const [jinaLoading,    setJinaLoading]    = useState(false);
  const summaryRef  = React.useRef(null);
  const [aiElapsed,   setAiElapsed]   = useState(0);  // seconden AI bezig
  const [aiError,     setAiError]     = useState(null); // {error, hint} als AI mislukt
  const aiTimerRef  = React.useRef(null);
  const [saveWarning, setSaveWarning]  = useState(""); // waarschuwing bij leeg veld
  const importTimerRef = React.useRef(null);
  const [error,          setError]          = useState(null);
  const [editMd,         setEditMd]         = useState("");
  const [editTitle,      setEditTitle]      = useState("");
  const [editSummary,    setEditSummary]    = useState("");
  const [tags,           setTags]           = useState([]);
  const [saved,          setSaved]          = useState(false);
  const [selectedImages, setSelectedImages] = useState(new Set());
  const [aiTagsLoading,  setAiTagsLoading]  = useState(false);
  const [suggestedType,  setSuggestedType]  = useState(null);
  const [selectedType,   setSelectedType]   = useState("");
  const [editAuthor,     setEditAuthor]     = useState("");    // auteur van de bron
  const [extractedAuthor,setExtractedAuthor]= useState("");    // automatisch gevonden auteur
  const [dupNote,        setDupNote]        = useState(null);
  const urlRef      = useRef(null);
  const prevPreview    = useRef(importPreview);
  const prevPreviewUrl = React.useRef("");

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
  const [mdType,         setMdType]         = useState("");
  const [docxType,       setDocxType]       = useState("");
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
  // ── Import voortgangstimer ───────────────────────────────────────────────
  React.useEffect(() => {
    if (!importing) {
      clearInterval(importTimerRef.current);
      setImportStep(0);
      setImportElapsed(0);
      return;
    }
    let elapsed = 0;
    setImportElapsed(0);
    setImportStep(0);
    importTimerRef.current = setInterval(() => {
      elapsed += 1;
      setImportElapsed(elapsed);
      // Stap op basis van gemiddelde tijden:
      // 0-3s = duplicaat check, 3-28s = website ophalen,
      // 28-35s = verwerken, 35+ = AI samenvatting
      if      (elapsed < 3)  setImportStep(0);
      else if (elapsed < 28) setImportStep(1);
      else if (elapsed < 35) setImportStep(2);
      else                   setImportStep(3);
    }, 1000);
    return () => clearInterval(importTimerRef.current);
  }, [importing]);

  // ── Jina AI import (handmatige fallback) ────────────────────────────────
  const doJinaImport = React.useCallback(async () => {
    if (!url.trim() || importing) return;
    // Gebruik dezelfde importing/stap flow als normale import
    setImporting(true); setError(null); setImportPreview(null);
    setImportStep(1); // direct naar "Website ophalen" stap
    const jid = genId();
    addJob && addJob({id:jid, type:"import", label:"🔗 Jina AI: "+url.replace(/^https?:\/\//,"").slice(0,35)+"…"});
    try {
      // ── Fase 1: Jina haalt artikel op ─────────────────────────────────────
      const r = await fetch("/api/import-jina", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({url: url.trim(), model: llmModel||"llama3.2-vision"}),
      });
      const res = await r.json();
      if (!res?.ok) {
        setError(res?.error || "Jina AI kon de URL niet ophalen");
        setImporting(false);
        updateJob && updateJob(jid, {status:"error", error:res?.error||""});
        return;
      }

      // Fase 1 klaar — toon preview direct
      setImportStep(3); // spring naar AI-stap
      setImportPreview({...res, url: url.trim(), aiLoading: true});
      updateJob && updateJob(jid, {status:"running", result:"Jina OK — AI samenvatting…"});

      // ── Fase 2: AI samenvatting ────────────────────────────────────────────
      try {
        const ctrl = new AbortController();
        const t    = setTimeout(() => ctrl.abort(), 150_000);
        const r2   = await fetch("/api/import-ai", {
          method: "POST", headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            text:  res.text || res.markdown || "",
            url:   url.trim(),
            title: res.title || "",
            model: llmModel || "llama3.2-vision",
          }),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        const ai = await r2.json();
        if (ai?.ok) {
          setImportPreview(p => ({...p, aiLoading: false,
            summary:  ai.summary  || p.summary,
            noteType: ai.noteType || p.noteType,
            author:   ai.author   || p.author || "",
          }));
          if (ai.noteType) { setSelectedType(ai.noteType); setSuggestedType(ai.noteType); }
          if (ai.author)   { setExtractedAuthor(ai.author); setEditAuthor(a => a || ai.author); }
        } else {
          setImportPreview(p => p ? {...p, aiLoading: false} : p);
          if (aiRes) setAiError({error: aiRes.error||"Geen samenvatting", hint: aiRes.hint||""});
        }
      } catch(_e) {
        setImportPreview(p => p ? {...p, aiLoading: false} : p);
        setAiError({
          error: _e.name==="AbortError" ? "Timeout (>150s)" : (_e.message||"onbekend"),
          hint:  _e.name==="AbortError"
            ? "Ollama laadt het model. Probeer opnieuw of kies een kleiner model."
            : "Controleer of Ollama draait of een API-sleutel is ingesteld.",
        });
      }

      updateJob && updateJob(jid, {status:"done", result:res.title?.slice(0,44)||"Klaar"});
    } catch(e) {
      setError("Jina AI mislukt: "+(e.message||"onbekend"));
      updateJob && updateJob(jid, {status:"error", error:e.message});
    } finally {
      setImporting(false);
    }
  }, [url, llmModel, addJob, updateJob, importing]);

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
    const isNewImport = importPreview.url !== prevPreviewUrl.current;
    prevPreviewUrl.current = importPreview.url;

    if (isNewImport) {
      // Nieuwe import: alles resetten
      setEditMd(sanitizeText(md)); setEditTitle(title);
      setEditSummary(sanitizeText(summary)); setTags(newTags);
      setSaved(false); setImporting(false);
    } else {
      // AI-update van dezelfde import: alleen samenvatting bijwerken
      // NIET de tags/type resetten — AI heeft die al ingesteld
      if (summary) setEditSummary(s => s || sanitizeText(summary));
      return; // geen tag-suggestie opnieuw starten
    }

    // Automatische tag-suggestie — alleen bij nieuwe import
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
    let u = url.trim();
    if (!u) return;
    // Voeg https:// toe als schema ontbreekt
    if (u && !u.startsWith("http://") && !u.startsWith("https://")) {
      u = "https://" + u;
      setUrl(u); // update ook het invoerveld
    }

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

    currentUrlRef.current = url; // altijd bijhouden voor retry
    setBusy(true); setError(null); setImporting(true);
    setImportPreview(null); setSaved(false);
    setTimeout(() => setBusy(false), 400);
    const jid = genId();
    const shortUrl = u.replace(/^https?:\/\//,"").slice(0,38);
    addJob && addJob({id:jid, type:"import", label:"🌐 Importeren: "+shortUrl+"…"});
    (async () => {
      // ── Fase 1: website ophalen — snel (2-8s) ──────────────────────────
      let fetchRes = null;
      try {
        const ctrl1 = new AbortController();
        const t1    = setTimeout(() => ctrl1.abort(), 30_000);
        const r1    = await fetch("/api/fetch-url?url="+encodeURIComponent(u),
                        {signal: ctrl1.signal});
        clearTimeout(t1);
        fetchRes = await r1.json();
      } catch(e1) {
        const msg = e1.name==="AbortError"
          ? "⏱ Website niet bereikbaar binnen 30 seconden. Controleer de URL."
          : "Ophalen mislukt: "+(e1.message||"");
        setError(msg); setImporting(false);
        updateJob && updateJob(jid,{status:"error",error:msg}); return;
      }

      if (!fetchRes?.ok) {
        if (fetchRes?.duplicate) {
          setDupNote({id:fetchRes.duplicate_id,title:fetchRes.duplicate_title});
          setImporting(false);
          updateJob && updateJob(jid,{status:"done",result:"Al aanwezig"}); return;
        }
        const msg = fetchRes?.error || "Website kon niet geladen worden";
        setError(msg); setImporting(false);
        updateJob && updateJob(jid,{status:"error",error:msg}); return;
      }

      // Fase 1 klaar — controleer inhoud
      let fetchedText = fetchRes.markdown || fetchRes.text || "";

      // Stap 2a: als server leeg terugkwam, laat browser het proberen
      if (fetchedText.trim().length < 30) {
        setImportStep(1);
        try {
          // Browser heeft echte cookies, TLS-fingerprint en sessie
          const bResp = await fetch(u, {mode: "cors", credentials: "include"});
          if (bResp.ok) {
            const html = await bResp.text();
            // Server verwerkt de HTML die de browser al heeft
            const pr = await fetch("/api/process-html", {
              method: "POST", headers: {"Content-Type": "application/json"},
              body: JSON.stringify({html, url: u}),
            });
            const parsed = await pr.json();
            if (parsed?.ok && (parsed.text || "").length > 100) {
              fetchedText = parsed.text || "";
              if (!fetchRes.title && parsed.title) fetchRes.title = parsed.title;
            }
          }
        } catch(_corsErr) {
          // Site blokkeert CORS — beide methoden mislukten
        }
      }

      // Stap 2b: beide methoden mislukten
      if (fetchedText.trim().length < 30) {
        setError("jina_option");
        setImporting(false);
        updateJob && updateJob(jid, {status: "error", error: "Site blokkeert ophalen"});
        return;
      }

      const preview = {
        ok:true, url:u, aiLoading:true,
        title:    fetchRes.title || u.replace(/^https?:\/\//,"").slice(0,60),
        markdown: fetchedText,
        images:   fetchRes.images  || [],
        summary:  "",
        author:   fetchRes.author  || "",
      };
      setImportPreview(preview);
      // Auteur pre-invullen vanuit HTML meta-tags
      if (fetchRes.author) { setEditAuthor(fetchRes.author); setExtractedAuthor(fetchRes.author); }
      setImportStep(3); // spring naar AI-stap in de voortgangsindicator
      updateJob && updateJob(jid,{status:"running",result:"Artikel geladen — AI start…"});

      // ── Fase 2: AI samenvatting — traag, niet-blokkerend ────────────────
      try {
        const ctrl2 = new AbortController();
        const t2    = setTimeout(() => ctrl2.abort(), 150_000);
        const r2    = await fetch("/api/import-ai",{
          method:"POST", headers:{"Content-Type":"application/json"},
          body: JSON.stringify({
            text:  fetchRes.text||fetchRes.markdown||"",
            url:   u, title: fetchRes.title||"",
            model: llmModel||"llama3.2-vision",
          }),
          signal: ctrl2.signal,
        });
        clearTimeout(t2);
        const aiRes = await r2.json();
        if (aiRes?.ok) {
          setImportPreview(p => ({
            ...p, aiLoading:false,
            summary:  aiRes.summary  || p.summary,
            noteType: aiRes.noteType || p.noteType,
          }));
          if (aiRes.noteType) { setSelectedType(aiRes.noteType); setSuggestedType(aiRes.noteType); }
        } else {
          setImportPreview(p => p ? {...p, aiLoading:false} : p);
        }
      } catch(e2) {
        // AI mislukt = niet fataal, preview met tekst blijft
        setImportPreview(p => p ? {...p, aiLoading:false} : p);
      }

      if (fetchRes.images?.length && onRefreshImages) onRefreshImages();
      setImporting(false);
      updateJob && updateJob(jid,{status:"done",result:fetchRes.title?.slice(0,44)||"Klaar"});
    })();
  }, [url, llmModel, onRefreshImages, addJob, updateJob, findDuplicateUrl]);
  doImportRef.current = doImport; // altijd bijwerken na elke render

  const saveNote = useCallback(async () => {
    if (!importPreview) return;
    if (importPreview?.aiLoading) {
      setSaveWarning("⏳ Wacht even — de AI is nog bezig met de samenvatting.");
      return;
    }
    if (!editTitle.trim()) {
      setSaveWarning("✏ Vul eerst een titel in.");
      return;
    }
    if (!editSummary.trim() && saveWarning !== "confirm_no_summary") {
      setSaveWarning("confirm_no_summary");
      summaryRef.current?.scrollIntoView({behavior:"smooth", block:"nearest"});
      return;
    }
    setSaveWarning("");
    setAiError(null); setAiElapsed(0);
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
      fields: editAuthor ? {author: editAuthor} : undefined,
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
  }, [importPreview, editTitle, editMd, editSummary, tags, selectedImages, selectedType, onAddNote, saveWarning]);

  const reset = () => {
    setUrl(""); setImportPreview(null);
    setEditMd(""); setEditTitle(""); setEditSummary("");
    setTags([]); setError(null); setSaved(false); setImporting(false);
    setSelectedImages(new Set()); setDupNote(null);
    setSuggestedType(null); setSelectedType("");
    setEditAuthor(""); setExtractedAuthor("");
    setSaveWarning("");
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
          ? (() => {
              const STAPPEN = [
                { icon:"🔍", label:"Controleren op duplicaten",    max:3  },
                { icon:"🌐", label:"Website ophalen",               max:12 },
                { icon:"📄", label:"Artikel extraheren",            max:16 },
                { icon:"🧠", label:"AI samenvatting (lokaal)",      max:180},
              ];
              const step  = importStep;
              const sec   = importElapsed;
              const pct   = Math.min(100, step===3
                ? 75 + Math.min(24, (sec-35)/2.5)
                : (sec / STAPPEN[step].max) * [25,50,75,100][step]);
              return React.createElement(React.Fragment, null,
                // Stap-icoon
                React.createElement("div", {style:{fontSize:"44px",lineHeight:1,animation:"ai-pulse 1.4s ease-in-out infinite"}},
                  STAPPEN[step].icon),
                // Stap-naam + URL
                React.createElement("div", {style:{textAlign:"center",lineHeight:"1.7"}},
                  React.createElement("div",{style:{fontSize:"16px",color:W.fg,fontWeight:"600"}},
                    STAPPEN[step].label,"…"),
                  React.createElement("div",{style:{fontSize:"13px",color:W.fgMuted,marginTop:"4px"}},
                    url.replace(/^https?:\/\//,"").slice(0,55)+(url.length>60?"…":""))
                ),
                // Stap-balk
                React.createElement("div",{style:{width:"340px",display:"flex",flexDirection:"column",gap:"10px"}},
                  STAPPEN.map((s,i) =>
                    React.createElement("div",{key:i,style:{
                      display:"flex",alignItems:"center",gap:"10px",
                      opacity: i < step ? 0.45 : i === step ? 1 : 0.25,
                      transition:"opacity .4s"
                    }},
                      React.createElement("span",{style:{fontSize:"16px",minWidth:"22px"}},
                        i < step ? "✓" : s.icon),
                      React.createElement("div",{style:{flex:1}},
                        React.createElement("div",{style:{
                          fontSize:"13px",color:i===step?W.fg:W.fgMuted,
                          fontWeight:i===step?"600":"400",marginBottom:"3px"
                        }}, s.label),
                        i===step && React.createElement("div",{style:{
                          height:"3px",borderRadius:"2px",
                          background:W.splitBg||"rgba(255,255,255,0.08)",
                          overflow:"hidden"
                        }},
                          React.createElement("div",{style:{
                            height:"100%",width:`${pct}%`,
                            background:W.blue,borderRadius:"2px",
                            transition:"width .9s ease-out"
                          }})
                        )
                      ),
                      i===step && React.createElement("span",{style:{fontSize:"12px",color:W.fgMuted,minWidth:"30px",textAlign:"right"}},
                        sec+"s")
                    )
                  )
                ),
                // Annuleer
                React.createElement("button",{
                  onClick:()=>{setImporting(false);setError(null);},
                  style:{background:"none",border:`1px solid ${W.splitBg}`,
                    color:W.fgMuted,borderRadius:"6px",padding:"5px 16px",
                    fontSize:"13px",cursor:"pointer",marginTop:"4px"}
                },"× Annuleren")
              );
            })()
          : React.createElement(React.Fragment, null,
              React.createElement("div", {style:{fontSize:"48px",lineHeight:1}}, "🌐"),
              React.createElement("div", {style:{fontSize:"15px",color:W.fgDim,textAlign:"center",lineHeight:"1.6",maxWidth:"460px"}},
                "Plak een URL om de inhoud te importeren als Zettelkasten-notitie.", React.createElement("br"),
                React.createElement("span", {style:{fontSize:"14px",color:W.fgMuted}},
                  "De AI verwijdert navigatie, advertenties en rommel — zoals Instapaper.")),
              React.createElement("div", {style:{display:"flex",gap:"10px",width:"100%",maxWidth:"560px"}},
                React.createElement("input", {
                  ref:urlRef, type:"url", value:url, autoFocus:true,
                  onChange:e=>{ setUrl(e.target.value); currentUrlRef.current=e.target.value; },
                  onKeyDown:e=>{ currentUrlRef.current=url; if(e.key==="Enter") doImport(); },
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
              importing && React.createElement("div",{style:{fontSize:"12px",color:W.fgMuted,marginTop:"4px",maxWidth:"560px",width:"100%"}},
                "⏳ Even geduld — website wordt opgehaald en samengevat (30–120 sec.)…"),
              error && error === "jina_option"
              ? React.createElement("div",{style:{
                  background:W.bg3||"rgba(255,255,255,0.04)",
                  border:`1px solid ${W.splitBg}`,
                  borderRadius:"8px",padding:"14px 16px",
                  maxWidth:"560px",width:"100%",
                  display:"flex",flexDirection:"column",gap:"10px"
                }},
                React.createElement("div",{style:{color:W.orange,fontSize:"13px",fontWeight:"600"}},
                  "⚠ Automatisch ophalen geblokkeerd door deze site"),
                React.createElement("div",{style:{fontSize:"12px",color:W.fgMuted,lineHeight:"1.6"}},
                  "Kies een alternatieve methode:"),
                React.createElement("div",{style:{display:"flex",gap:"8px",flexWrap:"wrap"}},
                  React.createElement("button",{
                    onClick:()=>{setError(null);doJinaImport();},
                    disabled:jinaLoading,
                    style:{padding:"7px 14px",borderRadius:"6px",fontSize:"13px",
                      background:W.blueBg||"rgba(138,198,242,0.1)",
                      border:`1px solid ${W.blueBorder||"rgba(138,198,242,0.3)"}`,
                      color:W.blue,cursor:"pointer",fontWeight:"600",
                      opacity:jinaLoading?0.6:1}
                  }, jinaLoading?"⏳ Jina AI bezig…":"🔗 Probeer via Jina AI"),
                  React.createElement("button",{
                    onClick:()=>{
                      setError(null);
                      setDupNote(null);
                      setImportPreview(null);
                      // Roep altijd de meest recente doImport aan via ref
                      if (doImportRef.current) doImportRef.current(true);
                    },
                    style:{padding:"7px 14px",borderRadius:"6px",fontSize:"13px",
                      background:"none",border:`1px solid ${W.splitBg}`,
                      color:W.fgMuted,cursor:"pointer"}
                  },"↻ Toch opnieuw proberen")
                ),
                React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,
                  borderTop:`1px solid ${W.splitBg}`,paddingTop:"8px",lineHeight:"1.5"}},
                  "Of: open de URL in de browser → selecteer alles (Ctrl+A) → ",
                  "kopieer (Ctrl+C) → plak in de 'Markdown' tab hierboven."
                )
              )
              : error && React.createElement("div", {style:{color:W.orange,fontSize:"14px",
                background:"rgba(229,120,109,0.08)",border:`1px solid rgba(229,120,109,0.25)`,
                borderRadius:"6px",padding:"10px 16px",maxWidth:"560px",width:"100%",
                display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px"}},
                React.createElement("span",null,"⚠ "+error),
                (error.includes("Timeout")||error.includes("timeout")||error.includes("reageerde niet")) &&
                  React.createElement("button",{
                    onClick:()=>{setError(null);doImport(true);},
                    style:{padding:"4px 12px",borderRadius:"5px",fontSize:"13px",flexShrink:0,
                      background:"rgba(229,120,109,0.2)",border:"1px solid rgba(229,120,109,0.5)",
                      color:W.orange||"#e5786d",cursor:"pointer",fontWeight:"600"}
                  },"↻ Opnieuw proberen")
              ),

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
                  onClick: importPreview?.aiLoading ? null : saveNote,
                  disabled: importPreview?.aiLoading || saved,
                  title: importPreview?.aiLoading
                    ? "Wacht tot de AI klaar is met verwerken"
                    : "Opslaan als Zettelkasten-notitie",
                  style:{
                    background: importPreview?.aiLoading ? W.splitBg : W.comment,
                    color: importPreview?.aiLoading ? W.fgMuted : W.bg,
                    border:"none", borderRadius:"5px",
                    padding:"6px 18px", fontSize:"13px",
                    cursor: importPreview?.aiLoading ? "not-allowed" : "pointer",
                    fontWeight:"700", whiteSpace:"nowrap", flexShrink:0,
                    transition:"all .3s", opacity: importPreview?.aiLoading ? 0.6 : 1,
                  }
                }, importPreview?.aiLoading ? "⏳ AI bezig…" : "✓ Opslaan"),
                React.createElement("button", {
                  onClick: reset,
                  style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                         borderRadius:"5px",padding:"6px 10px",fontSize:"13px",
                         cursor:"pointer",flexShrink:0}
                }, "✕")
              ),
              // Waarschuwing / bevestiging
              saveWarning && React.createElement("div", {style:{
                fontSize:"12px", padding:"7px 12px", borderRadius:"6px", marginTop:"4px",
                background: saveWarning==="confirm_no_summary"
                  ? "rgba(234,196,53,0.12)" : "rgba(229,120,109,0.10)",
                border: `1px solid ${
                  saveWarning==="confirm_no_summary"
                  ? "rgba(234,196,53,0.35)" : "rgba(229,120,109,0.3)"}`,
                color: saveWarning==="confirm_no_summary" ? W.yellow : W.orange,
                display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px",
              }},
                React.createElement("span", null,
                  saveWarning==="confirm_no_summary"
                  ? "⚠ Geen samenvatting — klik nogmaals om toch op te slaan"
                  : saveWarning),
                saveWarning==="confirm_no_summary" && React.createElement("button", {
                  onClick: saveNote,
                  style:{background:"none",border:"none",
                    color:W.yellow,cursor:"pointer",fontSize:"12px",fontWeight:"600"}
                }, "Toch opslaan →")
              )
        ),

        // ── Scrollbaar inhoudspaneel ─────────────────────────────────────────
        React.createElement("div", {style:{
          flex:1, overflowY:"auto", padding:"16px 20px",
          display:"flex", flexDirection:"column", gap:"14px", minHeight:0, WebkitOverflowScrolling:"touch",}},

          // ── AI Resultaten banner (toont status + scroll-hint) ────────────────
          // ── AI voortgangsindicator ─────────────────────────────────────────────
          !saved && (() => {
            const isLoading = importPreview?.aiLoading;
            const hasSummary = !!(importPreview?.summary);
            const hint = aiElapsed > 60
              ? "Ollama laadt het model — bijna klaar of verhoog timeout"
              : aiElapsed > 30
              ? "Ollama verwerkt de tekst…"
              : null;

            if (isLoading) return React.createElement("div", {style:{
              background:W.bg3||"rgba(138,198,242,0.05)",
              border:`1px solid ${W.blueBorder||"rgba(138,198,242,0.2)"}`,
              borderRadius:"7px", padding:"10px 14px",
            }},
              React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}},
                React.createElement("span",{style:{animation:"ai-pulse 1.2s ease-in-out infinite"}},"🧠"),
                React.createElement("div",{style:{flex:1}},
                  React.createElement("div",{style:{fontSize:"13px",color:W.blue,fontWeight:"600",display:"flex",justifyContent:"space-between"}},
                    React.createElement("span",null,"AI samenvatting genereren…"),
                    React.createElement("span",{style:{fontWeight:"400",fontVariantNumeric:"tabular-nums"}},aiElapsed+"s")
                  ),
                  hint && React.createElement("div",{style:{fontSize:"11px",color:W.fgMuted,marginTop:"2px"}},hint)
                )
              ),
              // Voortgangsbalk op basis van tijd (0-120s)
              React.createElement("div",{style:{height:"3px",background:W.splitBg,borderRadius:"2px",overflow:"hidden"}},
                React.createElement("div",{style:{
                  height:"100%",borderRadius:"2px",background:W.blue,
                  width: aiElapsed < 5 ? "5%"
                    : aiElapsed < 30  ? `${5 + (aiElapsed/30)*40}%`
                    : aiElapsed < 90  ? `${45 + ((aiElapsed-30)/60)*40}%`
                    : "92%",
                  transition:"width 1s linear",
                }})
              )
            );

            if (aiError) return React.createElement("div",{style:{
              background:"rgba(229,120,109,0.07)",
              border:"1px solid rgba(229,120,109,0.25)",
              borderRadius:"7px", padding:"10px 14px",
            }},
              React.createElement("div",{style:{fontSize:"13px",color:W.orange,fontWeight:"600",marginBottom:"4px"}},
                "⚠ AI samenvatting mislukt — "+aiError.error),
              aiError.hint && React.createElement("div",{style:{fontSize:"12px",color:W.fgMuted}},
                "💡 ",aiError.hint),
              React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,marginTop:"6px"}},
                "Je kunt de samenvatting zelf invullen in het veld hieronder en dan opslaan.")
            );

            if (hasSummary) return React.createElement("div",{style:{
              background:"rgba(114,182,96,0.07)",
              border:"1px solid rgba(114,182,96,0.25)",
              borderRadius:"7px", padding:"9px 14px",
              fontSize:"12px", color:W.comment||"#72b660",
              display:"flex", alignItems:"center", gap:"8px",
            }},
              "✓ AI klaar — controleer de samenvatting hieronder en sla op"
            );
            return null;
          })(),

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

          // ── Auteur-veld (alleen bij literatuur notitietype) ──────────────────
          selectedType === "literature" && !saved && React.createElement("div", {style:{
            background:W.bg2, border:`1px solid ${W.blueBorder||"rgba(138,198,242,0.3)"}`,
            borderRadius:"7px", padding:"10px 14px",
          }},
            React.createElement("div", {style:{
              fontSize:"11px", color:W.blue||"#8ac6f2",
              letterSpacing:"1.2px", marginBottom:"8px", fontWeight:"600",
              display:"flex", alignItems:"center", gap:"8px",
            }},
              "AUTEUR",
              extractedAuthor && editAuthor === extractedAuthor &&
                React.createElement("span", {style:{
                  fontSize:"10px", color:W.fgMuted, fontWeight:"400",
                  letterSpacing:0, background:W.bg3, borderRadius:"3px",
                  padding:"1px 6px",
                }}, "✦ automatisch gevonden")
            ),
            React.createElement("input", {
              type:"text", value:editAuthor,
              onChange:e=>setEditAuthor(e.target.value),
              placeholder:"Voornaam Achternaam",
              style:{
                width:"100%", background:W.bg,
                border:`1px solid ${editAuthor
                  ? (W.blueBorder||"rgba(138,198,242,0.4)")
                  : W.splitBg}`,
                borderRadius:"6px", color:W.fg, fontSize:"13px",
                padding:"7px 11px", outline:"none", boxSizing:"border-box",
              }
            }),
            React.createElement("div", {style:{fontSize:"11px",color:W.fgDim,marginTop:"5px"}},
              "Opgeslagen als fields.author — zichtbaar in Bibliotheek → Boeken"
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
            React.createElement("div", {
              ref: summaryRef,
              style:{
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
                noteType: mdType || "",
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

React.createElement("div", {style:{
            background:W.bg2, border:`1px solid ${W.splitBg}`,
            borderRadius:"7px", padding:"10px 14px",
          }},
            React.createElement("div", {style:{
              fontSize:"11px",color:"rgba(138,198,242,0.6)",
              letterSpacing:"1.2px",marginBottom:"8px",fontWeight:"600"
            }}, "NOTITIETYPE"),
            React.createElement("div", {style:{display:"flex",gap:"6px",flexWrap:"wrap"}},
              React.createElement("button", {
                onClick:()=>setMdType(""),
                style:{padding:"4px 10px",fontSize:"11px",borderRadius:"5px",cursor:"pointer",
                  background:mdType===""?"rgba(133,123,111,0.2)":"transparent",
                  border:`1px solid ${mdType===""?"#857b6f":W.splitBg}`,
                  color:W.fgMuted, transition:"all .1s"}
              }, "— geen"),
              Object.entries(TYPE_META).map(([tid,{label,color}]) =>
                React.createElement("button", {
                  key:tid, onClick:()=>setMdType(mdType===tid?"":tid),
                  style:{padding:"4px 10px",fontSize:"11px",borderRadius:"5px",cursor:"pointer",
                    background:mdType===tid?`${color}20`:"transparent",
                    border:`1px solid ${mdType===tid?color:W.splitBg}`,
                    color:mdType===tid?color:W.fgMuted,
                    fontWeight:mdType===tid?"600":"400", transition:"all .1s"}
                }, label)
              )
            )
          ),

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
                      noteType: docxType || "",
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
