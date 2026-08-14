// ── BookLibrary ────────────────────────────────────────────────────────────────
// Boeken-bibliotheek met Bol.com cover-ophalen.
// Boeken worden opgeslagen als notities met tag "boek" en noteType "literature".
// Props: notes, onNotesChange, onOpenNote

// ── Smart Book Cover Crop ──────────────────────────────────────────────────
// Detecteert de boekomslag in een foto via Canvas edge-analyse.
// Strategie: analyseer randen van de afbeelding → vind het rechthoekige gebied
// met de meeste kleurcontrast (de omslag) → crop naar 2:3 verhouding.
const smartCropBookCover = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    URL.revokeObjectURL(url);
    const W = img.naturalWidth, H = img.naturalHeight;

    // ── Stap 1: Analyseer kleurcontrast langs randen ─────────────────────────
    const canvas = document.createElement("canvas");
    const SAMPLE = 400; // werkt op verkleind canvas voor snelheid
    const scale  = Math.min(1, SAMPLE / Math.max(W, H));
    canvas.width  = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const sw = canvas.width, sh = canvas.height;

    const luma = (x, y) => {
      const i = (y * sw + x) * 4;
      return 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
    };

    // Zoek de meeste contrastrijke horizontale band (bovenkant omslag)
    const rowContrast = [];
    for (let y = 1; y < sh-1; y++) {
      let c = 0;
      for (let x = 1; x < sw-1; x++) c += Math.abs(luma(x,y) - luma(x,y-1));
      rowContrast.push(c / sw);
    }

    const colContrast = [];
    for (let x = 1; x < sw-1; x++) {
      let c = 0;
      for (let y = 1; y < sh-1; y++) c += Math.abs(luma(x,y) - luma(x-1,y));
      colContrast.push(c / sh);
    }

    // Vind de meest waarschijnlijke omslag-grenzen (piek-contrast)
    const smooth = (arr, w=3) => arr.map((_,i) =>
      arr.slice(Math.max(0,i-w), i+w+1).reduce((a,b)=>a+b,0) / Math.min(arr.length, 2*w+1)
    );
    const sr = smooth(rowContrast), sc = smooth(colContrast);
    const maxR = Math.max(...sr), maxC = Math.max(...sc);
    const threshold = 0.25;

    let top=0, bottom=sh, left=0, right=sw;

    // Zoek eerste significante rij-overgang (boven → omslag)
    for (let y=0; y<sh/2; y++) { if(sr[y] > maxR*threshold) { top=y; break; } }
    // Zoek laatste significante rij-overgang (omslag → onder)
    for (let y=sh-1; y>sh/2; y--) { if(sr[y-1] > maxR*threshold) { bottom=y; break; } }
    // Links en rechts
    for (let x=0; x<sw/2; x++) { if(sc[x] > maxC*threshold) { left=x; break; } }
    for (let x=sw-1; x>sw/2; x--) { if(sc[x-1] > maxC*threshold) { right=x; break; } }

    // Als detectie mislukt of te klein: gebruik center-crop
    const detected = (bottom-top)/sh > 0.25 && (right-left)/sw > 0.25;
    if (!detected) {
      // Fallback: center-crop naar 2:3 verhouding
      const ratio = 2/3;
      const cH = H, cW = Math.round(H * ratio);
      const cx = Math.max(0, Math.round((W-cW)/2));
      top=0; bottom=sh; left=Math.round(cx*scale); right=Math.round((cx+cW)*scale);
    }

    // ── Stap 2: Crop naar gevonden rechthoek, output als 2:3 JPEG ───────────
    const cropX = Math.round(left / scale);
    const cropY = Math.round(top  / scale);
    const cropW = Math.round((right-left) / scale);
    const cropH = Math.round((bottom-top) / scale);

    // Pas aan naar exacte 2:3 verhouding (boekstandaard)
    const TARGET_RATIO = 2/3;
    let finalX=cropX, finalY=cropY, finalW=cropW, finalH=cropH;
    if (cropW/cropH > TARGET_RATIO) {
      finalW = Math.round(cropH * TARGET_RATIO);
      finalX = cropX + Math.round((cropW-finalW)/2);
    } else {
      finalH = Math.round(cropW / TARGET_RATIO);
      finalY = cropY + Math.round((cropH-finalH)/2);
    }
    finalX = Math.max(0, Math.min(W-finalW, finalX));
    finalY = Math.max(0, Math.min(H-finalH, finalY));

    const out = document.createElement("canvas");
    out.width  = 300; // standaard cover output
    out.height = 450;
    const octx = out.getContext("2d");
    octx.drawImage(img, finalX, finalY, finalW, finalH, 0, 0, 300, 450);
    resolve({ dataUrl: out.toDataURL("image/jpeg", 0.9), cropBox: {finalX,finalY,finalW,finalH} });
  };
  img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Afbeelding laden mislukt")); };
  img.src = url;
});

const BookLibrary = (
{ notes = [], onNotesChange, onOpenNote, serverPdfs = [], onReadBook }) => {
  const { useState, useMemo, useCallback } = React;

  // ── State ──────────────────────────────────────────────────────────────────
  const [showModal,  setShowModal]  = useState(false);
  const [editBook,   setEditBook]   = useState(null);   // null = nieuw, object = bewerken
  const [filter,     setFilter]     = useState("all");  // all | bezig | nog-lezen | uit
  const [search,     setSearch]     = useState("");
  const [sortBy,     setSortBy]     = useState("added"); // added | title | author
  const [viewMode,   setViewMode]   = useState("grid"); // grid | list | detail

  // Formulier state
  const EMPTY_FORM = {
    bolUrl: "", titel: "", auteur: "", kenIkPersoonlijk: false,
    type: "fysiek", taal: "nl", status: "nog-lezen",
    bitlyUrl: "", coverUrl: "", coverLoading: false, coverError: "", cropLoading: false,
  };
  const [form, setForm] = useState(EMPTY_FORM);

  // ── Boeken uit notities halen ──────────────────────────────────────────────
  const books = useMemo(() => {
    return notes
      .filter(n => (n.tags || []).includes("boek"))
      .map(n => {
        const fields = n.fields || {};
        return {
          id:        n.id,
          titel:     n.title || "",
          auteur:    fields.author || "",
          type:      fields.bookType || "fysiek",
          taal:      fields.language || "nl",
          status:    fields.status || "nog-lezen",
          coverUrl:  fields.coverUrl || "",
          bitlyUrl:  fields.bitlyUrl || "",
          bolUrl:    fields.bolUrl || "",
          kenIkPersoonlijk: fields.kenIkPersoonlijk === "true",
          created:   n.created || n.modified || "",
          isRead:    n.isRead === true || fields.status === "uit",
          importedAt: n.importedAt || "",
        };
      });
  }, [notes]);

  // ── Filter en sortering ────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = books;
    if (filter === "gelezen") list = list.filter(b => b.isRead);
    else if (filter !== "all") list = list.filter(b => b.status === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b =>
        b.titel.toLowerCase().includes(q) ||
        b.auteur.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "title")  return a.titel.localeCompare(b.titel, "nl");
      if (sortBy === "author") return a.auteur.localeCompare(b.auteur, "nl");
      return new Date(b.created || 0) - new Date(a.created || 0);
    });
  }, [books, filter, search, sortBy]);

  const counts = useMemo(() => ({
    all:       books.length,
    bezig:     books.filter(b => b.status === "bezig").length,
    "nog-lezen": books.filter(b => b.status === "nog-lezen").length,
    uit:       books.filter(b => b.status === "uit").length,
    gelezen:   books.filter(b => b.isRead).length,
  }), [books]);

  // ── Bol.com cover ophalen ──────────────────────────────────────────────────
  const handleCoverUpload = async (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setForm(f => ({ ...f, cropLoading: true, coverError: "" }));
    try {
      const { dataUrl } = await smartCropBookCover(file);
      setForm(f => ({ ...f, coverUrl: dataUrl, cropLoading: false }));
    } catch {
      const reader = new FileReader();
      reader.onload = ev => setForm(f => ({ ...f, coverUrl: ev.target.result, cropLoading: false }));
      reader.onerror = () => setForm(f => ({ ...f, cropLoading: false, coverError: "Laden mislukt" }));
      reader.readAsDataURL(file);
    }
  };

  const fetchBolCover = useCallback(async () => {
    if (!form.bolUrl.includes("bol.com")) {
      setForm(f => ({ ...f, coverError: "Geen geldige Bol.com URL" }));
      return;
    }
    setForm(f => ({ ...f, coverLoading: true, coverError: "" }));
    try {
      const resp = await fetch("/api/bol-cover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.bolUrl }),
      });
      const data = await resp.json();
      if (data.cover) {
        setForm(f => ({ ...f, coverUrl: data.cover, coverLoading: false,
                         titel:  f.titel  || data.title  || "",
                         auteur: f.auteur || data.author || "" }));
      } else {
        setForm(f => ({ ...f, coverLoading: false, coverError: data.error || "Geen cover gevonden" }));
      }
    } catch (e) {
      setForm(f => ({ ...f, coverLoading: false, coverError: "Fout: " + e.message }));
    }
  }, [form.bolUrl]);

  // ── Boek opslaan als notitie ───────────────────────────────────────────────
  const saveBook = useCallback(async () => {
    if (!form.titel.trim()) return;
    const isNew = !editBook;
    const now   = new Date().toISOString();

    const content = [
      `# ${form.titel}`,
      `**Auteur:** ${form.auteur || "—"}`,
      form.kenIkPersoonlijk ? `**Persoonlijk bekend:** ja` : "",
      `**Type:** ${form.type === "fysiek" ? "🌳 Fysiek" : "📱 Ebook"}`,
      `**Taal:** ${form.taal === "nl" ? "🇳🇱 Nederlands" : "🇬🇧 Engels"}`,
      `**Status:** ${form.status}`,
      form.bitlyUrl ? `**Link:** [${form.bitlyUrl}](${form.bitlyUrl})` : "",
      form.bolUrl   ? `**Bol.com:** [bekijk](${form.bolUrl})` : "",
    ].filter(Boolean).join("\n");

    const note = {
      id:       editBook?.id || String(Date.now()),
      title:    form.titel,
      content,
      tags:     ["boek"],
      noteType: "literature",
      created:  editBook?.created || now,
      modified: now,
      fields: {
        author:           form.auteur,
        bookType:         form.type,
        language:         form.taal,
        status:           form.status,
        coverUrl:         form.coverUrl,
        bitlyUrl:         form.bitlyUrl,
        bolUrl:           form.bolUrl,
        kenIkPersoonlijk: String(form.kenIkPersoonlijk),
      },
    };

    await onNotesChange?.([note]);
    setShowModal(false);
    setEditBook(null);
    setForm(EMPTY_FORM);
  }, [form, editBook, onNotesChange]);

  // ── Boek bewerken ─────────────────────────────────────────────────────────
  const openEdit = useCallback((book) => {
    setEditBook(book);
    setForm({
      bolUrl:           book.bolUrl || "",
      titel:            book.titel,
      auteur:           book.auteur,
      kenIkPersoonlijk: book.kenIkPersoonlijk,
      type:             book.type,
      taal:             book.taal,
      status:           book.status,
      bitlyUrl:         book.bitlyUrl || "",
      coverUrl:         book.coverUrl || "",
      coverLoading:     false,
      coverError:       "",
      cropLoading:      false,
    });
    setShowModal(true);
    // Scroll naar boven van modal
    setTimeout(() => document.querySelector(".book-modal-body")?.scrollTo(0,0), 50);
  }, []);

  // ── Status snel wisselen ──────────────────────────────────────────────────
  const cycleStatus = useCallback(async (book) => {
    const cycle = ["nog-lezen", "bezig", "uit"];
    const next  = cycle[(cycle.indexOf(book.status) + 1) % cycle.length];
    const note  = notes.find(n => n.id === book.id);
    if (!note) return;
    const updated = {
      ...note,
      isRead:   next === "uit",
      fields:   { ...(note.fields || {}), status: next },
      modified: new Date().toISOString(),
    };
    await onNotesChange?.([updated]);
  }, [notes, onNotesChange]);

  // ── Status badge ──────────────────────────────────────────────────────────
  const STATUS_STYLE = {
    "bezig":     { bg: "rgba(138,198,242,0.15)", color: "#8ac6f2", label: "Bezig" },
    "nog-lezen": { bg: "rgba(234,231,136,0.12)", color: "#eae788", label: "Nog lezen" },
    "uit":       { bg: "rgba(159,202,86,0.15)",  color: "#9fca56", label: "Uit ✓" },
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const S = {
    container: { display:"flex", flexDirection:"column", height:"100%", background:W.bg, overflow:"hidden" },
    header:    { padding:"10px 16px 8px", borderBottom:`1px solid ${W.splitBg}`, background:W.bg2, flexShrink:0 },
    toolbar:   { display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap", marginBottom:"6px" },
    filterBtn: (active, color="#8ac6f2") => ({
      padding:"3px 10px", borderRadius:"10px", fontSize:"12px", cursor:"pointer",
      border:`1px solid ${active ? color+"55" : W.splitBg}`,
      background: active ? color+"18" : "transparent",
      color: active ? color : W.fgMuted, transition:"all 0.12s",
    }),
    search: { flex:1, minWidth:"130px", background:W.bg, border:`1px solid ${W.splitBg}`,
              borderRadius:"6px", padding:"4px 10px", color:W.fg, fontSize:"13px", outline:"none" },
    addBtn: { padding:"5px 14px", borderRadius:"6px", fontSize:"13px", cursor:"pointer",
              background:"rgba(159,202,86,0.15)", border:"1px solid rgba(159,202,86,0.4)",
              color:W.comment, fontWeight:"600", flexShrink:0, transition:"all 0.12s" },
    scroll: { flex:1, overflowY:"auto", padding:"12px 16px", WebkitOverflowScrolling:"touch" },
    grid:   { display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))", gap:"12px" },

    // Kaart in grid
    card:   { borderRadius:"8px", overflow:"hidden", cursor:"pointer",
              border:`1px solid ${W.splitBg}`, background:W.bg2,
              transition:"all 0.15s", display:"flex", flexDirection:"column" },
    cover:  { width:"100%", aspectRatio:"2/3", objectFit:"cover", background:W.bg3,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"32px", color:W.fgDim },
    cardBody: { padding:"8px", flex:1, display:"flex", flexDirection:"column", gap:"3px" },
    cardTitle: { fontSize:"12px", fontWeight:"600", color:W.fg, lineHeight:"1.3",
                 overflow:"hidden", display:"-webkit-box",
                 WebkitLineClamp:2, WebkitBoxOrient:"vertical" },
    cardAuthor: { fontSize:"10px", color:W.fgMuted, overflow:"hidden",
                  textOverflow:"ellipsis", whiteSpace:"nowrap" },

    // Lijst-rij
    row:   { display:"flex", alignItems:"center", gap:"10px", padding:"8px 0",
             borderBottom:`1px solid ${W.splitBg}22`, cursor:"pointer" },
    rowCover: { width:"36px", height:"54px", borderRadius:"3px", objectFit:"cover",
                background:W.bg3, flexShrink:0, display:"flex", alignItems:"center",
                justifyContent:"center", fontSize:"18px", color:W.fgDim },
  };

  const statusBadge = (status, onClick) => {
    const st = STATUS_STYLE[status] || STATUS_STYLE["nog-lezen"];
    return React.createElement("span", {
      onClick: e => { e.stopPropagation(); onClick && onClick(); },
      style:{ fontSize:"9px", padding:"2px 6px", borderRadius:"10px",
              background:st.bg, color:st.color, cursor:onClick?"pointer":"default",
              border:`1px solid ${st.color}44`, fontWeight:"600", flexShrink:0 }
    }, st.label);
  };

  return React.createElement("div", { style:S.container },
    // ── Header ──────────────────────────────────────────────────────────────
    React.createElement("div", { style:S.header },
      React.createElement("div", { style:S.toolbar },
        // Filter knoppen
        ...[
          { id:"all",       label:`Alle (${counts.all})`,              color:W.blue },
          { id:"bezig",     label:`Bezig (${counts.bezig})`,           color:W.blue },
          { id:"nog-lezen", label:`Nog lezen (${counts["nog-lezen"]})`, color:W.yellow },
          { id:"uit",       label:`Uit (${counts.uit})`,               color:W.comment },
          { id:"gelezen",   label:`✓ Gelezen (${counts.gelezen})`,     color:W.comment },
        ].map(f => React.createElement("button", {
          key:f.id, onClick:()=>setFilter(f.id),
          style:S.filterBtn(filter===f.id, f.color)
        }, f.label)),
        React.createElement("div",{style:{marginLeft:"auto",display:"flex",gap:"5px"}},
          // Weergave toggles
          ...[
            {id:"grid",   icon:"⊞", title:"Grid"},
            {id:"list",   icon:"☰", title:"Lijst"},
            {id:"detail", icon:"≡", title:"Details"},
          ].map(v => React.createElement("button",{
            key:v.id,
            onClick:()=>setViewMode(v.id),
            title:v.title,
            style:{...S.filterBtn(viewMode===v.id),padding:"4px 9px",fontSize:"13px"}
          }, v.icon)),
          // Nieuw boek
          React.createElement("button",{
            onClick:()=>{ setEditBook(null); setForm(EMPTY_FORM); setShowModal(true); },
            style:S.addBtn
          }, "+ Boek toevoegen")
        )
      ),
      // Zoek + sortering
      React.createElement("div",{style:{display:"flex",gap:"6px",alignItems:"center"}},
        React.createElement("input",{
          value:search, onChange:e=>setSearch(e.target.value),
          placeholder:"Zoek op titel of auteur…", style:S.search,
        }),
        React.createElement("select",{
          value:sortBy, onChange:e=>setSortBy(e.target.value),
          style:{background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"5px",
                 color:W.fg,fontSize:"12px",padding:"4px 6px",outline:"none"}
        },
          React.createElement("option",{value:"added"},"Toegevoegd"),
          React.createElement("option",{value:"title"},"Titel"),
          React.createElement("option",{value:"author"},"Auteur"),
        )
      )
    ),

    // ── Boeken ──────────────────────────────────────────────────────────────
    filtered.length === 0
      ? React.createElement("div",{
          style:{flex:1,display:"flex",alignItems:"center",justifyContent:"center",
                 flexDirection:"column",gap:"8px",color:W.fgMuted}
        },
          React.createElement("div",{style:{fontSize:"32px"}},"📚"),
          React.createElement("div",null, books.length===0 ? "Nog geen boeken" : "Geen boeken gevonden"),
          books.length===0 && React.createElement("button",{
            onClick:()=>{ setEditBook(null); setForm(EMPTY_FORM); setShowModal(true); },
            style:{...S.addBtn,marginTop:"8px"}
          },"+ Eerste boek toevoegen")
        )
      : React.createElement("div",{style:S.scroll},
          viewMode==="grid"
            ? React.createElement("div",{style:S.grid},
                filtered.map(book =>
                  React.createElement("div",{
                    key:book.id,
                    style:S.card,
                    onMouseEnter:e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.borderColor=W.blue+"55";},
                    onMouseLeave:e=>{e.currentTarget.style.transform="";e.currentTarget.style.borderColor=W.splitBg;},
                    onClick:()=>onOpenNote?.(book.id),
                  },
                    // Cover met gelezen-indicator
                    React.createElement("div",{style:{position:"relative"}},
                      book.coverUrl
                        ? React.createElement("img",{src:book.coverUrl,alt:book.titel,style:S.cover,onError:e=>{e.target.style.display="none";}})
                        : React.createElement("div",{style:S.cover},"📖"),
                      book.isRead && React.createElement("div",{
                        style:{
                          position:"absolute",top:"6px",right:"6px",
                          width:"22px",height:"22px",borderRadius:"50%",
                          background:"rgba(159,202,86,0.95)",
                          display:"flex",alignItems:"center",justifyContent:"center",
                          fontSize:"12px",boxShadow:"0 2px 6px rgba(0,0,0,0.4)",
                        }
                      },"✓")
                    ),
                    // Info
                    React.createElement("div",{style:S.cardBody},
                      React.createElement("div",{style:S.cardTitle},book.titel),
                      React.createElement("div",{style:S.cardAuthor},book.auteur||"—"),
                      React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:"auto",paddingTop:"4px",gap:"4px"}},
                        statusBadge(book.status, ()=>cycleStatus(book)),
                        React.createElement("div",{style:{display:"flex",gap:"4px"}},
                          book.type==="ebook" && React.createElement("button",{
                            onClick:e=>{e.stopPropagation();onReadBook?.(book);},
                            title:"Open bijbehorend PDF om te lezen/highlighten",
                            style:{background:"rgba(159,202,86,0.12)",border:`1px solid ${W.comment||"#9fca56"}`,
                              color:W.comment||"#9fca56",cursor:"pointer",fontSize:"12px",
                              borderRadius:"5px",padding:"2px 8px",fontWeight:"600"}
                          },"📖 Lees"),
                          React.createElement("button",{
                            onClick:e=>{e.stopPropagation();openEdit(book);},
                            style:{background:"rgba(138,198,242,0.12)",border:`1px solid ${W.blue||"#7aa8c8"}`,
                              color:W.blue||"#7aa8c8",cursor:"pointer",fontSize:"12px",
                              borderRadius:"5px",padding:"2px 8px",fontWeight:"600"}
                          },"✏ Bewerken")
                        )
                      )
                    )
                  )
                )
              )
            : React.createElement("div",null,
                filtered.map(book =>
                  React.createElement("div",{
                    key:book.id, style:S.row,
                    onClick:()=>onOpenNote?.(book.id),
                    onMouseEnter:e=>e.currentTarget.style.background="rgba(255,255,255,0.04)",
                    onMouseLeave:e=>e.currentTarget.style.background="transparent",
                  },
                    React.createElement("div",{style:{position:"relative",flexShrink:0}},
                      book.coverUrl
                        ? React.createElement("img",{src:book.coverUrl,alt:book.titel,style:S.rowCover,onError:e=>{e.target.style.display="none";}})
                        : React.createElement("div",{style:S.rowCover},"📖"),
                      book.isRead && React.createElement("div",{
                        style:{position:"absolute",bottom:"-3px",right:"-3px",
                          width:"16px",height:"16px",borderRadius:"50%",
                          background:W.comment,display:"flex",alignItems:"center",
                          justifyContent:"center",fontSize:"9px",
                          boxShadow:"0 1px 4px rgba(0,0,0,0.4)"}
                      },"✓")
                    ),
                    React.createElement("div",{style:{flex:1,minWidth:0}},
                      React.createElement("div",{style:{fontSize:"13px",fontWeight:"600",color:W.fg,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},book.titel),
                      React.createElement("div",{style:{fontSize:"11px",color:W.fgMuted}},
                        book.auteur || "—",
                        book.taal==="en" ? " · 🇬🇧" : " · 🇳🇱",
                        book.type==="ebook" ? " · 📱" : " · 🌳",
                      )
                    ),
                    statusBadge(book.status, ()=>cycleStatus(book)),
                    book.type==="ebook" && React.createElement("button",{
                      onClick:e=>{e.stopPropagation();onReadBook?.(book);},
                      title:"Open bijbehorend PDF om te lezen/highlighten",
                      style:{background:"none",border:"none",color:W.comment||"#9fca56",cursor:"pointer",fontSize:"13px",padding:"0 4px"}
                    },"📖 Lees"),
                    React.createElement("button",{
                      onClick:e=>{e.stopPropagation();openEdit(book);},
                      style:{background:"none",border:"none",color:W.fgDim,cursor:"pointer",fontSize:"13px",padding:"0 4px"}
                    },"✏ Bewerken")
                  )
                )
              )
        ),

    // ── Detail-weergave ─────────────────────────────────────────────────────
    viewMode==="detail" && React.createElement("div",{style:S.scroll},
      React.createElement("table",{style:{width:"100%",borderCollapse:"collapse",fontSize:"13px"}},
        React.createElement("thead",null,
          React.createElement("tr",{style:{borderBottom:`2px solid ${W.splitBg}`}},
            ...["Cover","Titel","Auteur","Type","Taal","Status","Gelezen",""].map(h =>
              React.createElement("th",{key:h,style:{
                padding:"7px 10px",textAlign:"left",fontSize:"10px",
                letterSpacing:"0.5px",color:W.fgMuted,fontWeight:"600",
                textTransform:"uppercase",whiteSpace:"nowrap",
              }},h)
            )
          )
        ),
        React.createElement("tbody",null,
          filtered.map((book, ri) => React.createElement("tr",{
            key:book.id,
            style:{
              borderBottom:`1px solid ${W.splitBg}22`,
              background: ri%2===0 ? "transparent" : `${W.bg2}55`,
              transition:"background 0.1s",cursor:"pointer",
            },
            onClick:()=>onOpenNote?.(book.id),
            onMouseEnter:e=>e.currentTarget.style.background="rgba(255,255,255,0.04)",
            onMouseLeave:e=>e.currentTarget.style.background=ri%2===0?"transparent":`${W.bg2}55`,
          },
            // Cover
            React.createElement("td",{style:{padding:"6px 10px",width:"48px"}},
              book.coverUrl
                ? React.createElement("img",{src:book.coverUrl,alt:book.titel,
                    style:{width:"32px",height:"48px",objectFit:"cover",
                           borderRadius:"3px",display:"block"},
                    onError:e=>{e.target.style.display="none";}})
                : React.createElement("div",{style:{width:"32px",height:"48px",
                    background:W.bg3,borderRadius:"3px",display:"flex",
                    alignItems:"center",justifyContent:"center",fontSize:"16px"}},"📖")
            ),
            // Titel
            React.createElement("td",{style:{padding:"6px 10px",maxWidth:"220px"}},
              React.createElement("div",{style:{fontWeight:"600",color:W.fg,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
                book.titel),
              book.bitlyUrl && React.createElement("a",{
                href:book.bitlyUrl,target:"_blank",
                onClick:e=>e.stopPropagation(),
                style:{fontSize:"10px",color:W.blue,textDecoration:"none"}
              },book.bitlyUrl)
            ),
            // Auteur
            React.createElement("td",{style:{padding:"6px 10px",color:W.fgMuted,
              maxWidth:"140px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
              book.auteur || "—",
              book.kenIkPersoonlijk && React.createElement("span",{
                title:"Ken ik persoonlijk",style:{marginLeft:"5px",fontSize:"11px"}},"🤝")
            ),
            // Type
            React.createElement("td",{style:{padding:"6px 10px",whiteSpace:"nowrap"}},
              React.createElement("span",{style:{fontSize:"11px",color:W.fgDim}},
                book.type==="ebook" ? "📱 Ebook" : "🌳 Fysiek")
            ),
            // Taal
            React.createElement("td",{style:{padding:"6px 10px",whiteSpace:"nowrap"}},
              book.taal==="en" ? "🇬🇧" : "🇳🇱"
            ),
            // Status
            React.createElement("td",{style:{padding:"6px 10px"}},
              statusBadge(book.status, (e)=>{e?.stopPropagation();cycleStatus(book);})
            ),
            // Gelezen
            React.createElement("td",{style:{padding:"6px 10px",textAlign:"center"}},
              React.createElement("span",{
                title:book.isRead?"Gelezen":"Nog niet gelezen",
                style:{fontSize:"16px",cursor:"pointer"},
                onClick:e=>{e.stopPropagation();cycleStatus(book);}
              }, book.isRead ? "✅" : "⬜")
            ),
            // Bewerken
            React.createElement("td",{style:{padding:"6px 10px",textAlign:"right",whiteSpace:"nowrap"}},
              book.type==="ebook" && React.createElement("button",{
                onClick:e=>{e.stopPropagation();onReadBook?.(book);},
                title:"Open bijbehorend PDF om te lezen/highlighten",
                style:{background:"none",border:"none",color:W.comment||"#9fca56",
                       cursor:"pointer",fontSize:"13px",padding:"0 4px"}
              },"📖 Lees"),
              React.createElement("button",{
                onClick:e=>{e.stopPropagation();openEdit(book);},
                style:{background:"none",border:"none",color:W.fgDim,
                       cursor:"pointer",fontSize:"13px",padding:"0 4px"}
              },"✏ Bewerken")
            )
          ))
        )
      )
    ),

    // ── Modal ────────────────────────────────────────────────────────────────
    showModal && React.createElement("div",{
      style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",
             display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000},
      onClick:e=>{ if(e.target===e.currentTarget){setShowModal(false);setEditBook(null);} }
    },
      React.createElement("div",{
        style:{background:"#fff",borderRadius:"12px",padding:"28px",
               width:"min(520px,95vw)",maxHeight:"90vh",overflowY:"auto",
               color:"#1a1a1a",boxShadow:"0 20px 60px rgba(0,0,0,0.5)"}
      },
        // Modal header
        React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px"}},
          React.createElement("h2",{style:{fontSize:"18px",fontWeight:"700",margin:0}},
            editBook ? "Boek bewerken" : "Nieuw boek toevoegen"),
          React.createElement("button",{
            onClick:()=>{setShowModal(false);setEditBook(null);},
            style:{background:"none",border:"none",fontSize:"20px",cursor:"pointer",color:"#666",lineHeight:1}
          },"×")
        ),

        // ── Bol.com URL ──────────────────────────────────────────────────────
        React.createElement("div",{style:{marginBottom:"14px"}},
          React.createElement("label",{style:{fontSize:"13px",fontWeight:"600",display:"block",marginBottom:"5px"}},"Bol.com URL"),
          React.createElement("input",{
            value:form.bolUrl, onChange:e=>setForm(f=>({...f,bolUrl:e.target.value})),
            placeholder:"https://www.bol.com/nl/nl/p/...",
            style:{width:"100%",padding:"8px 10px",borderRadius:"6px",border:"1px solid #ddd",
                   fontSize:"13px",outline:"none",boxSizing:"border-box"}
          }),
          React.createElement("button",{
            onClick:fetchBolCover,
            disabled:form.coverLoading||!form.bolUrl.includes("bol.com"),
            style:{marginTop:"6px",padding:"5px 14px",borderRadius:"6px",fontSize:"12px",
                   cursor:"pointer",background:"#f0f0f0",border:"1px solid #ccc",color:"#333"}
          }, form.coverLoading ? "⟳ Ophalen…" : "Cover ophalen"),
          form.coverError && React.createElement("div",{style:{fontSize:"11px",color:"#e5786d",marginTop:"4px"}},form.coverError),
          // Preview huidig cover
          form.coverUrl && React.createElement("img",{src:form.coverUrl,alt:"cover",
            style:{marginTop:"8px",height:"90px",borderRadius:"4px",border:"1px solid #ccc",
              boxShadow:"0 2px 8px rgba(0,0,0,0.15)"}})
        ),

        // ── Handmatige cover upload ─────────────────────────────────────────
        React.createElement("div",{style:{marginBottom:"14px"}},
          React.createElement("label",{style:{fontSize:"13px",fontWeight:"600",display:"block",marginBottom:"6px"}},
            "📷 Foto van cover uploaden"),
          React.createElement("div",{
            style:{
              border:"2px dashed #ccc",borderRadius:"8px",
              padding:"14px",textAlign:"center",cursor:"pointer",
              background:"#fafafa",transition:"border-color .15s",
            },
            onClick:()=>document.getElementById("cover-file-input").click(),
            onDragOver:e=>{ e.preventDefault(); e.currentTarget.style.borderColor="#7aa8c8"; },
            onDragLeave:e=>{ e.currentTarget.style.borderColor="#ccc"; },
            onDrop:e=>{ e.preventDefault(); e.currentTarget.style.borderColor="#ccc";
              handleCoverUpload(e.dataTransfer.files[0]); },
          },
            form.cropLoading
              ? React.createElement("span",{style:{fontSize:"13px",color:"#666"}},"⏳ Cover detecteren…")
              : React.createElement("div",null,
                  React.createElement("div",{style:{fontSize:"22px",marginBottom:"4px"}},"🖼"),
                  React.createElement("div",{style:{fontSize:"12px",color:"#666"}},
                    "Sleep een foto hierheen of klik om te kiezen"),
                  React.createElement("div",{style:{fontSize:"11px",color:"#999",marginTop:"3px"}},
                    "De boekomslag wordt automatisch herkend en bijgesneden")
                )
          ),
          React.createElement("input",{
            id:"cover-file-input", type:"file",
            accept:"image/*", style:{display:"none"},
            onChange:e=>handleCoverUpload(e.target.files[0]),
          })
        ),

        // ── Titel ────────────────────────────────────────────────────────────
        React.createElement("div",{style:{marginBottom:"12px"}},
          React.createElement("label",{style:{fontSize:"13px",fontWeight:"600",display:"block",marginBottom:"5px"}},
            "Titel ", React.createElement("span",{style:{color:"#e5786d"}},"*")),
          React.createElement("input",{
            value:form.titel, onChange:e=>setForm(f=>({...f,titel:e.target.value})),
            placeholder:"Creative Quest",
            style:{width:"100%",padding:"8px 10px",borderRadius:"6px",border:"1px solid #ddd",
                   fontSize:"13px",outline:"none",boxSizing:"border-box"}
          })
        ),

        // ── Auteur ────────────────────────────────────────────────────────────
        React.createElement("div",{style:{marginBottom:"12px"}},
          React.createElement("label",{style:{fontSize:"13px",fontWeight:"600",display:"block",marginBottom:"5px"}},
            "Auteur ", React.createElement("span",{style:{color:"#e5786d"}},"*")),
          React.createElement("input",{
            value:form.auteur, onChange:e=>setForm(f=>({...f,auteur:e.target.value})),
            placeholder:"Questlove",
            style:{width:"100%",padding:"8px 10px",borderRadius:"6px",border:"1px solid #ddd",
                   fontSize:"13px",outline:"none",boxSizing:"border-box"}
          }),
          React.createElement("label",{style:{display:"flex",alignItems:"center",gap:"6px",fontSize:"12px",marginTop:"6px",cursor:"pointer"}},
            React.createElement("input",{type:"checkbox",checked:form.kenIkPersoonlijk,
              onChange:e=>setForm(f=>({...f,kenIkPersoonlijk:e.target.checked}))}),
            "Ken ik persoonlijk"
          )
        ),

        // ── Type ──────────────────────────────────────────────────────────────
        React.createElement("div",{style:{marginBottom:"12px"}},
          React.createElement("label",{style:{fontSize:"13px",fontWeight:"600",display:"block",marginBottom:"5px"}},"Type"),
          React.createElement("div",{style:{display:"flex",gap:"16px"}},
            ...[{id:"fysiek",label:"🌳 Fysiek"},{id:"ebook",label:"📱 Ebook"}].map(t=>
              React.createElement("label",{key:t.id,style:{display:"flex",alignItems:"center",gap:"5px",fontSize:"13px",cursor:"pointer"}},
                React.createElement("input",{type:"radio",name:"type",value:t.id,checked:form.type===t.id,
                  onChange:()=>setForm(f=>({...f,type:t.id}))}),
                t.label
              )
            )
          )
        ),

        // ── Taal ──────────────────────────────────────────────────────────────
        React.createElement("div",{style:{marginBottom:"12px"}},
          React.createElement("label",{style:{fontSize:"13px",fontWeight:"600",display:"block",marginBottom:"5px"}},"Taal"),
          React.createElement("div",{style:{display:"flex",gap:"16px"}},
            ...[{id:"nl",label:"🇳🇱 Nederlands"},{id:"en",label:"🇬🇧 Engels"}].map(t=>
              React.createElement("label",{key:t.id,style:{display:"flex",alignItems:"center",gap:"5px",fontSize:"13px",cursor:"pointer"}},
                React.createElement("input",{type:"radio",name:"taal",value:t.id,checked:form.taal===t.id,
                  onChange:()=>setForm(f=>({...f,taal:t.id}))}),
                t.label
              )
            )
          )
        ),

        // ── Status ────────────────────────────────────────────────────────────
        React.createElement("div",{style:{marginBottom:"12px"}},
          React.createElement("label",{style:{fontSize:"13px",fontWeight:"600",display:"block",marginBottom:"5px"}},"Status"),
          React.createElement("div",{style:{display:"flex",gap:"16px"}},
            ...[{id:"bezig",label:"Bezig"},{id:"nog-lezen",label:"Nog lezen"},{id:"uit",label:"Uit"}].map(s=>
              React.createElement("label",{key:s.id,style:{display:"flex",alignItems:"center",gap:"5px",fontSize:"13px",cursor:"pointer"}},
                React.createElement("input",{type:"radio",name:"status",value:s.id,checked:form.status===s.id,
                  onChange:()=>setForm(f=>({...f,status:s.id}))}),
                s.label
              )
            )
          )
        ),

        // ── Bitly URL ─────────────────────────────────────────────────────────
        React.createElement("div",{style:{marginBottom:"20px"}},
          React.createElement("label",{style:{fontSize:"13px",fontWeight:"600",display:"block",marginBottom:"5px"}},"Bitly URL (optioneel)"),
          React.createElement("input",{
            value:form.bitlyUrl, onChange:e=>setForm(f=>({...f,bitlyUrl:e.target.value})),
            placeholder:"https://bit.ly/...",
            style:{width:"100%",padding:"8px 10px",borderRadius:"6px",border:"1px solid #ddd",
                   fontSize:"13px",outline:"none",boxSizing:"border-box"}
          })
        ),

        // ── Knoppen ───────────────────────────────────────────────────────────
        React.createElement("div",{style:{display:"flex",gap:"10px",justifyContent:"flex-end"}},
          React.createElement("button",{
            onClick:()=>{setShowModal(false);setEditBook(null);},
            style:{padding:"8px 20px",borderRadius:"6px",fontSize:"13px",cursor:"pointer",
                   background:"#f0f0f0",border:"1px solid #ddd",color:"#333"}
          },"Annuleren"),
          React.createElement("button",{
            onClick:saveBook,
            disabled:!form.titel.trim(),
            style:{padding:"8px 24px",borderRadius:"6px",fontSize:"13px",cursor:"pointer",
                   fontWeight:"600",background:form.titel.trim()?"#0066cc":"#ccc",
                   border:"none",color:"#fff"}
          },"Opslaan")
        )
      )
    )
  );
};
