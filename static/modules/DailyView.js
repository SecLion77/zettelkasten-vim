// ── DailyView ─────────────────────────────────────────────────────────────────
// Het dagelijkse startscherm: SR-reviews, recente activiteit, taken, quick capture.

// ── SM-2 Spaced Repetition Engine ────────────────────────────────────────────
// Gebaseerd op SuperMemo-2 (Woźniak, 1987) — het meest onderzochte SR-algoritme.
// rating: 0=Vergeten, 1=Zwaar, 2=Moeite, 3=Goed, 4=Gemakkelijk, 5=Triviaal
const SM2 = {
  DEFAULT_EASE: 2.5,
  MIN_EASE:     1.3,

  // Bereken de volgende reviewdatum na een beoordeling
  next(current, rating) {
    const r = Math.max(0, Math.min(5, rating));
    let { interval = 0, repetitions = 0, ease = SM2.DEFAULT_EASE } = current || {};

    if (r < 3) {
      // Vergeten of moeite → reset naar morgen
      interval    = 1;
      repetitions = 0;
    } else {
      // Begrepen → interval verhogen
      if (repetitions === 0)      interval = 1;
      else if (repetitions === 1) interval = 6;
      else interval = Math.round(interval * ease);
      repetitions++;
    }

    // Ease-factor aanpassen (SM-2 formule)
    ease = ease + (0.1 - (5 - r) * (0.08 + (5 - r) * 0.02));
    if (ease < SM2.MIN_EASE) ease = SM2.MIN_EASE;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + interval);
    const due = dueDate.toISOString().slice(0, 10);

    return {
      interval,
      repetitions,
      ease: Math.round(ease * 1000) / 1000,
      due,
      lastReview: new Date().toISOString().slice(0, 10),
      lastRating: r,
    };
  },

  // Laad SR-data uit config
  async load() {
    try {
      const d = await fetch("/api/config").then(r => r.json());
      return d.config?.sr_data || {};
    } catch { return {}; }
  },

  // Sla SR-data op in config
  async save(srData) {
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sr_data: srData }),
      });
    } catch(e) { console.error("[SR] Opslaan mislukt:", e); }
  },

  // Notities die vandaag (of eerder) reviewd moeten worden
  dueToday(notes, srData) {
    const today = new Date().toISOString().slice(0, 10);
    return notes.filter(n => {
      const d = srData[n.id];
      return d?.due && d.due <= today;
    }).sort((a, b) => {
      // Langst uitgestelde notities eerst
      const da = srData[a.id]?.due || "";
      const db = srData[b.id]?.due || "";
      return da.localeCompare(db);
    });
  },

  // Beschrijving van de volgende interval
  intervalLabel(days) {
    if (!days) return "";
    if (days === 1) return "morgen";
    if (days < 7)  return `${days} dagen`;
    if (days < 14) return "1 week";
    if (days < 30) return `${Math.round(days/7)} weken`;
    return `${Math.round(days/30)} maanden`;
  },
};

// ── ADR Template helper ───────────────────────────────────────────────────────
const ADR_TEMPLATE = (titel = "") => `---
titel: ${titel || "Architectuurbeslissing"}
type: adr
status: concept
datum: ${new Date().toISOString().slice(0,10)}
---

## Context

*Beschrijf het probleem of de situatie die aanleiding geeft tot deze beslissing.*

## Beslissing

*Wat is de gekozen aanpak?*

## Alternatieven overwogen

- **Optie A** — *beschrijving* → Afgewezen omdat …
- **Optie B** — *beschrijving* → Afgewezen omdat …

## Consequenties

### Positief
- …

### Negatief / Risico's
- …

## Betrokkenen

| Rol | Persoon/team |
|-----|-------------|
| Beslisser | |
| Reviewers | |
| Impact | |

## Status-geschiedenis

| Datum | Status | Door |
|-------|--------|------|
| ${new Date().toISOString().slice(0,10)} | concept | |
`;

// ── DailyView component ───────────────────────────────────────────────────────
const DailyView = ({ notes = [], onOpenNote, onAddNote, llmModel = "" }) => {
  const { useState, useEffect, useMemo, useCallback } = React;

  const [srData,      setSrData]      = useState({});
  const [loading,     setLoading]     = useState(true);
  const [reviewing,   setReviewing]   = useState(null);   // { note, question }
  const [qLoading,    setQLoading]    = useState(false);
  const [answer,      setAnswer]      = useState("");
  const [revealed,    setRevealed]    = useState(false);
  const [sessionDone, setSessionDone] = useState({});     // id → rating
  const [quickTitle,  setQuickTitle]  = useState("");
  const [quickCapt,   setQuickCapt]   = useState(false);
  const [adrTitle,    setAdrTitle]    = useState("");
  const [adrOpen,     setAdrOpen]     = useState(false);

  const today     = new Date().toISOString().slice(0, 10);
  const dayLabel  = new Date().toLocaleDateString("nl-NL", {
    weekday:"long", day:"numeric", month:"long"
  });

  // ── Laden ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    SM2.load().then(d => { setSrData(d); setLoading(false); });
  }, []);

  // ── Afgeleide data ────────────────────────────────────────────────────────────
  const dueNotes = useMemo(() =>
    SM2.dueToday(notes, srData).filter(n => !sessionDone[n.id]),
    [notes, srData, sessionDone]
  );

  const recentNotes = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const cutoff  = weekAgo.toISOString().slice(0, 10);
    return [...notes]
      .filter(n => n.modified >= cutoff || n.created >= cutoff)
      .sort((a, b) => (b.modified || b.created || "").localeCompare(a.modified || a.created || ""))
      .slice(0, 8);
  }, [notes]);

  const openTasks = useMemo(() =>
    notes.reduce((acc, n) => {
      const matches = (n.content || "").match(/^- \[ \] .+/gm) || [];
      return acc + matches.length;
    }, 0),
    [notes]
  );

  const totalSR = useMemo(() =>
    notes.filter(n => srData[n.id]).length,
    [notes, srData]
  );

  // ── SR-review functies ────────────────────────────────────────────────────────
  const startReview = useCallback(async (note) => {
    setReviewing({ note });
    setAnswer(""); setRevealed(false);
    if (!llmModel) return;
    setQLoading(true);
    try {
      const excerpt = (note.content || "").replace(/^---[\s\S]*?---/, "").trim().slice(0, 500);
      const resp    = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: llmModel,
          messages: [{ role: "user", content:
            `Genereer ÉÉN scherpe recall-vraag voor deze notitie. Geen ja/nee.\n` +
            `Alleen de vraag, geen inleiding.\n\nTitel: ${note.title}\n\nFragment:\n${excerpt}`
          }],
          system: "Geef alleen de vraag. Geen uitleg.",
        }),
      });
      const d = await resp.json();
      const q = (d.content || d.response || "").trim();
      setReviewing(rv => ({ ...rv, question: q || `Wat is de kerngedachte van "${note.title}"?` }));
    } catch {
      setReviewing(rv => ({ ...rv, question: `Wat is de kerngedachte van "${note.title}"?` }));
    }
    setQLoading(false);
  }, [llmModel]);

  const rateNote = useCallback(async (note, rating) => {
    const current = srData[note.id] || {};
    const next    = SM2.next(current, rating);
    const updated = { ...srData, [note.id]: next };
    setSrData(updated);
    setSessionDone(s => ({ ...s, [note.id]: rating }));
    setReviewing(null);
    await SM2.save(updated);
  }, [srData]);

  const addToSR = useCallback(async (noteId) => {
    const updated = {
      ...srData,
      [noteId]: SM2.next({}, 3), // start als "goed"
    };
    setSrData(updated);
    await SM2.save(updated);
  }, [srData]);

  const removeFromSR = useCallback(async (noteId) => {
    const updated = { ...srData };
    delete updated[noteId];
    setSrData(updated);
    await SM2.save(updated);
  }, [srData]);

  // ── Quick capture ─────────────────────────────────────────────────────────────
  const doQuickCapture = useCallback(async () => {
    if (!quickTitle.trim()) return;
    await onAddNote?.({
      title:   quickTitle.trim(),
      content: "",
      tags:    ["capture"],
      created: today, modified: today,
    });
    setQuickTitle(""); setQuickCapt(false);
  }, [quickTitle, onAddNote, today]);

  const doCreateADR = useCallback(async () => {
    if (!adrTitle.trim()) return;
    await onAddNote?.({
      title:   adrTitle.trim(),
      content: ADR_TEMPLATE(adrTitle.trim()),
      tags:    ["adr", "architectuur"],
      noteType:"adr",
      created: today, modified: today,
    });
    setAdrTitle(""); setAdrOpen(false);
  }, [adrTitle, onAddNote, today]);

  // ─────────────────────────────────────────────────────────────────────────────
  const W   = window.THEME_VARS || {};
  const btnBase = (active, color = W.blue) => ({
    background: active ? `rgba(${color},0.15)` : "none",
    border:     `1px solid ${active ? color : W.splitBg}`,
    borderRadius:"6px", padding:"4px 14px",
    color:      active ? color : W.fgMuted,
    cursor:"pointer", fontSize:"12px", fontWeight: active?"600":"400",
    transition:"all .12s",
  });

  const card = {
    background: W.bg2, border:`1px solid ${W.splitBg}`,
    borderRadius:"10px", padding:"16px 20px",
  };

  // ── Review modal ─────────────────────────────────────────────────────────────
  if (reviewing) {
    const { note, question } = reviewing;
    return React.createElement("div", {
      style:{ flex:1, display:"flex", flexDirection:"column", padding:"20px",
        maxWidth:"700px", margin:"0 auto", gap:"16px", overflowY:"auto" }
    },
      // Header
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"12px"}},
        React.createElement("button",{
          onClick:()=>setReviewing(null),
          style:{...btnBase(false),padding:"4px 10px",fontSize:"13px"}
        },"← Terug"),
        React.createElement("span",{style:{fontSize:"13px",color:W.fgMuted}},
          `Review ${Object.keys(sessionDone).length + 1} van ${dueNotes.length + Object.keys(sessionDone).length}`)
      ),

      // Vraag
      React.createElement("div",{style:{...card,borderLeft:`3px solid ${W.blue}`}},
        React.createElement("div",{style:{fontSize:"11px",color:W.blue,letterSpacing:"1px",marginBottom:"10px"}},
          "RECALL-VRAAG"),
        React.createElement("div",{style:{fontSize:"16px",color:W.fg,lineHeight:"1.6",fontWeight:"500"}},
          qLoading ? "🧠 Vraag genereren…" : (question || `Wat is de kerngedachte van "${note.title}"?`)
        ),

        // Antwoord invoer
        !revealed && React.createElement("textarea",{
          value: answer, onChange:e=>setAnswer(e.target.value),
          placeholder: "Schrijf je antwoord hier voordat je de notitie bekijkt…",
          rows: 4,
          style:{ width:"100%", marginTop:"14px", background:W.bg,
            border:`1px solid ${W.splitBg}`, borderRadius:"6px",
            padding:"10px", color:W.fg, fontSize:"13px",
            resize:"vertical", outline:"none", boxSizing:"border-box" }
        }),

        !revealed && React.createElement("button",{
          onClick:()=>setRevealed(true),
          style:{ marginTop:"10px", background:W.blue, color:W.bg,
            border:"none", borderRadius:"6px", padding:"8px 20px",
            cursor:"pointer", fontSize:"13px", fontWeight:"600" }
        },"Toon notitie →")
      ),

      // Notitie-inhoud (alleen na reveal)
      revealed && React.createElement("div",{style:{...card,maxHeight:"320px",overflowY:"auto"}},
        React.createElement("div",{style:{fontSize:"11px",color:W.fgMuted,letterSpacing:"1px",marginBottom:"8px"}},
          note.title.toUpperCase()),
        React.createElement("div",{
          style:{fontSize:"13px",color:W.fg,lineHeight:"1.7",whiteSpace:"pre-wrap"},
          dangerouslySetInnerHTML:{ __html: renderMd
            ? renderMd((note.content||"").replace(/^---[\s\S]*?---/,"").trim().slice(0,800))
            : (note.content||"").slice(0,600)+"…"
          }
        })
      ),

      // Beoordeling (alleen na reveal)
      revealed && React.createElement("div",{style:{...card}},
        React.createElement("div",{style:{fontSize:"12px",color:W.fgMuted,marginBottom:"12px"}},
          "Hoe goed kon je de inhoud terugbrengen?"),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"8px"}},
          [
            {label:"😕 Vergeten",  rating:1, color:"#e5786d", next:"morgen"},
            {label:"😐 Moeite",    rating:2, color:W.orange||"#d4b97c", next:"1 dag"},
            {label:"🙂 Goed",      rating:4, color:W.blue, next:SM2.intervalLabel(SM2.next(srData[note.id]||{}, 4).interval)},
            {label:"😄 Gemakkelijk",rating:5, color:"#72b660", next:SM2.intervalLabel(SM2.next(srData[note.id]||{}, 5).interval)},
          ].map(({label, rating, color, next}) =>
            React.createElement("button",{
              key:rating,
              onClick:()=>rateNote(note, rating),
              style:{
                background:`rgba(${color.replace("#","")
                  .match(/../g)?.map(h=>parseInt(h,16)).join(",") || "128,128,128"},0.1)`,
                border:`1px solid ${color}`,
                borderRadius:"8px", padding:"10px 8px",
                color, cursor:"pointer", fontSize:"12px",
                fontWeight:"600", lineHeight:"1.4", textAlign:"center",
              }
            },
              React.createElement("div",null, label),
              React.createElement("div",{style:{fontSize:"10px",opacity:0.7,marginTop:"3px"}},
                `→ ${next}`)
            )
          )
        )
      ),

      // Open in editor knop
      revealed && React.createElement("button",{
        onClick:()=>{ onOpenNote?.(note.id); setReviewing(null); },
        style:{...btnBase(false),padding:"8px 16px",fontSize:"13px",alignSelf:"flex-start"}
      },"✏ Open in editor")
    );
  }

  // ── Hoofd dashboard ───────────────────────────────────────────────────────────
  const doneToday   = Object.keys(sessionDone).length;
  const totalDue    = dueNotes.length + doneToday;
  const pct         = totalDue > 0 ? Math.round((doneToday/totalDue)*100) : 100;

  return React.createElement("div",{
    style:{ flex:1, overflowY:"auto", padding:"20px 24px",
      display:"flex", flexDirection:"column", gap:"20px",
      maxWidth:"900px", margin:"0 auto", width:"100%",
    }
  },

    // ── Koptekst ─────────────────────────────────────────────────────────────────
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:"12px"}},
      React.createElement("div",null,
        React.createElement("h2",{style:{margin:0,fontSize:"22px",color:W.fg,fontWeight:"700",
          textTransform:"capitalize"}}, dayLabel),
        React.createElement("div",{style:{fontSize:"13px",color:W.fgMuted,marginTop:"4px"}},
          `${notes.length} notities · ${totalSR} in SR-systeem · ${openTasks} openstaande taken`)
      ),
      // Quick capture knoppen
      React.createElement("div",{style:{display:"flex",gap:"8px",flexWrap:"wrap"}},
        React.createElement("button",{
          onClick:()=>setQuickCapt(q=>!q),
          style:{...btnBase(quickCapt),padding:"6px 14px",fontSize:"13px"}
        },"⚡ Snel vastleggen"),
        React.createElement("button",{
          onClick:()=>setAdrOpen(a=>!a),
          style:{...btnBase(adrOpen,"#72b660"),padding:"6px 14px",fontSize:"13px"}
        },"📋 Nieuwe ADR")
      )
    ),

    // ── Quick capture input ───────────────────────────────────────────────────────
    quickCapt && React.createElement("div",{style:{...card,display:"flex",gap:"8px"}},
      React.createElement("input",{
        autoFocus: true,
        value: quickTitle, onChange:e=>setQuickTitle(e.target.value),
        onKeyDown: e=>{ if(e.key==="Enter") doQuickCapture(); if(e.key==="Escape") setQuickCapt(false); },
        placeholder:"Titel van de notitie… (Enter om op te slaan)",
        style:{ flex:1, background:W.bg, border:`1px solid ${W.blue}`,
          borderRadius:"6px", padding:"8px 12px", color:W.fg, fontSize:"14px", outline:"none" }
      }),
      React.createElement("button",{
        onClick:doQuickCapture,
        style:{background:W.blue,color:W.bg,border:"none",borderRadius:"6px",
          padding:"8px 16px",cursor:"pointer",fontSize:"13px",fontWeight:"600"}
      },"Opslaan")
    ),

    // ── ADR aanmaken ─────────────────────────────────────────────────────────────
    adrOpen && React.createElement("div",{style:{...card,borderLeft:"3px solid #72b660"}},
      React.createElement("div",{style:{fontSize:"12px",color:"#72b660",letterSpacing:"1px",marginBottom:"10px"}},"NIEUW ARCHITECTUURBESLISSINGSRECORD"),
      React.createElement("div",{style:{display:"flex",gap:"8px"}},
        React.createElement("input",{
          autoFocus: true,
          value: adrTitle, onChange:e=>setAdrTitle(e.target.value),
          onKeyDown: e=>{ if(e.key==="Enter") doCreateADR(); if(e.key==="Escape") setAdrOpen(false); },
          placeholder:"Titel van de beslissing… bijv. 'API Gateway als centrale toegangspoort'",
          style:{ flex:1, background:W.bg, border:`1px solid #72b660`,
            borderRadius:"6px", padding:"8px 12px", color:W.fg, fontSize:"13px", outline:"none" }
        }),
        React.createElement("button",{
          onClick:doCreateADR,
          style:{background:"#72b660",color:W.bg,border:"none",borderRadius:"6px",
            padding:"8px 16px",cursor:"pointer",fontSize:"13px",fontWeight:"600"}
        },"Aanmaken")
      ),
      React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,marginTop:"8px"}},
        "Maakt een notitie aan met het ADR-sjabloon: context, beslissing, alternatieven, consequenties en betrokkenen.")
    ),

    // ── SR Review wachtrij ────────────────────────────────────────────────────────
    React.createElement("div",{style:card},
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}},
        React.createElement("div",null,
          React.createElement("div",{style:{fontSize:"13px",fontWeight:"700",color:W.fg}},
            "🔁 Reviews vandaag"),
          React.createElement("div",{style:{fontSize:"12px",color:W.fgMuted,marginTop:"2px"}},
            totalDue === 0
              ? "Geen reviews gepland — voeg notities toe aan het systeem"
              : doneToday === totalDue
              ? `✓ Alle ${totalDue} reviews afgerond voor vandaag`
              : `${doneToday}/${totalDue} afgerond`)
        ),
        totalDue > 0 && React.createElement("div",{style:{textAlign:"right"}},
          React.createElement("div",{style:{fontSize:"22px",fontWeight:"700",color:W.blue}},
            `${pct}%`),
          React.createElement("div",{style:{
            width:"80px",height:"4px",background:W.splitBg,borderRadius:"2px",
            marginTop:"4px",overflow:"hidden"}},
            React.createElement("div",{style:{
              width:`${pct}%`,height:"100%",background:W.blue,
              borderRadius:"2px",transition:"width .3s"}})
          )
        )
      ),

      // Review-items
      dueNotes.length > 0 && React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"6px"}},
        dueNotes.slice(0,5).map(n => {
          const d    = srData[n.id] || {};
          const days = Math.round((new Date(today) - new Date(d.due || today)) / 86400000);
          return React.createElement("div",{
            key:n.id,
            style:{
              display:"flex",alignItems:"center",gap:"10px",padding:"8px 12px",
              background:W.bg,borderRadius:"7px",border:`1px solid ${W.splitBg}`,
              cursor:"pointer",transition:"border-color .12s",
            },
            onClick:()=>startReview(n),
            onMouseEnter:e=>e.currentTarget.style.borderColor=W.blue,
            onMouseLeave:e=>e.currentTarget.style.borderColor=W.splitBg,
          },
            React.createElement("div",{style:{flex:1,minWidth:0}},
              React.createElement("div",{style:{fontSize:"13px",color:W.fg,fontWeight:"500",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
                n.title),
              React.createElement("div",{style:{fontSize:"11px",color:W.fgMuted,marginTop:"2px"}},
                d.repetitions ? `${d.repetitions}× herhaald · interval ${d.interval}d` : "Eerste review")
            ),
            days > 0 && React.createElement("span",{style:{
              fontSize:"10px",background:"rgba(229,120,109,0.15)",
              color:"#e5786d",borderRadius:"8px",padding:"2px 7px",flexShrink:0}},
              `${days}d verlaat`),
            React.createElement("button",{
              onClick:e=>{e.stopPropagation();startReview(n);},
              style:{background:W.blue,color:W.bg,border:"none",borderRadius:"5px",
                padding:"4px 12px",cursor:"pointer",fontSize:"12px",fontWeight:"600",flexShrink:0}
            },"Review →")
          );
        }),
        dueNotes.length > 5 && React.createElement("div",{
          style:{fontSize:"12px",color:W.fgMuted,textAlign:"center",padding:"4px"}},
          `+ ${dueNotes.length - 5} meer`)
      ),

      // Afgeronde reviews
      doneToday > 0 && React.createElement("div",{style:{marginTop:"10px"}},
        Object.entries(sessionDone).map(([id, rating]) => {
          const n    = notes.find(n => n.id === id);
          const next = SM2.intervalLabel(srData[id]?.interval);
          const col  = rating >= 4 ? "#72b660" : rating >= 3 ? W.blue : "#e5786d";
          return n ? React.createElement("div",{key:id,
            style:{display:"flex",alignItems:"center",gap:"8px",padding:"4px 0",
              fontSize:"12px",color:W.fgDim}},
            React.createElement("span",{style:{color:col}},
              rating>=4?"✓":rating>=3?"✓":"↺"),
            React.createElement("span",{style:{flex:1}},n.title),
            React.createElement("span",{style:{color:W.fgDim}},`→ ${next}`)
          ) : null;
        })
      ),

      dueNotes.length === 0 && doneToday === 0 && React.createElement("div",{
        style:{fontSize:"13px",color:W.fgDim,textAlign:"center",padding:"16px 0",fontStyle:"italic"}},
        "Voeg notities toe aan spaced repetition via het ⟳ Review-paneel")
    ),

    // ── Statistieken ─────────────────────────────────────────────────────────────
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:"12px"}},
      [
        { label:"Notities",       value:notes.length,      icon:"📝", color:W.blue },
        { label:"Reviews vandaag",value:totalDue,           icon:"🔁", color:"#d4b97c" },
        { label:"SR-systeem",     value:totalSR,            icon:"🧠", color:"#72b660" },
        { label:"Open taken",     value:openTasks,          icon:"✓",  color:W.orange||"#d4b97c" },
      ].map(({label,value,icon,color}) =>
        React.createElement("div",{key:label,style:{
          ...card, textAlign:"center",
          borderTop:`3px solid ${color}`,
        }},
          React.createElement("div",{style:{fontSize:"24px",marginBottom:"4px"}},icon),
          React.createElement("div",{style:{fontSize:"24px",fontWeight:"700",color}},""+value),
          React.createElement("div",{style:{fontSize:"11px",color:W.fgMuted,marginTop:"2px"}},label)
        )
      )
    ),

    // ── Recente notities ──────────────────────────────────────────────────────────
    recentNotes.length > 0 && React.createElement("div",{style:card},
      React.createElement("div",{style:{fontSize:"13px",fontWeight:"700",color:W.fg,marginBottom:"12px"}},
        "🕐 Recente activiteit (7 dagen)"),
      React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"4px"}},
        recentNotes.map(n => {
          const inSR = !!srData[n.id];
          return React.createElement("div",{
            key:n.id,
            style:{display:"flex",alignItems:"center",gap:"10px",padding:"6px 10px",
              borderRadius:"6px",cursor:"pointer",transition:"background .1s"},
            onClick:()=>onOpenNote?.(n.id),
            onMouseEnter:e=>e.currentTarget.style.background=W.bg,
            onMouseLeave:e=>e.currentTarget.style.background="transparent",
          },
            React.createElement("div",{style:{flex:1,minWidth:0}},
              React.createElement("div",{style:{fontSize:"13px",color:W.fg,
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
                n.title || "(Naamloos)"),
              React.createElement("div",{style:{fontSize:"10px",color:W.fgDim,marginTop:"1px"}},
                n.tags?.slice(0,3).join(" · ") || "")
            ),
            React.createElement("span",{
              style:{fontSize:"10px",color:W.fgMuted,flexShrink:0,minWidth:"60px",textAlign:"right"}},
              n.modified?.slice(5) || n.created?.slice(5) || ""),
            !inSR && React.createElement("button",{
              title:"Toevoegen aan spaced repetition",
              onClick:e=>{ e.stopPropagation(); addToSR(n.id); },
              style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgDim,
                borderRadius:"4px",padding:"2px 6px",cursor:"pointer",fontSize:"10px",flexShrink:0}
            },"+ SR"),
            inSR && React.createElement("span",{
              title:"In SR-systeem", style:{fontSize:"10px",color:"#72b660",flexShrink:0}},
              "🧠 SR")
          );
        })
      )
    )
  );
};
