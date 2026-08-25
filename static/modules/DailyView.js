// ── DailyView ─────────────────────────────────────────────────────────────────
// Dagelijks startscherm: dagnotitie, SR-reviews, quick capture, ADR-aanmaken.
// Deps: SRS (gedeelde FSRS-engine, zie modules/SRS.js — laadt vóór deze module)

// SM2 blijft als naam bestaan (in plaats van elke aanroep in dit bestand te
// hernoemen) maar wijst nu naar de gedeelde FSRS-engine. Dezelfde store
// (sr_data in vault/config.json) wordt nu ook door ReviewPanel.js gebruikt —
// zie SRS.js voor de eenmalige migratie van het oude, losstaande review_data.
const SM2 = SRS;


// ── ADR Template ──────────────────────────────────────────────────────────────
const ADR_TEMPLATE = (titel="") => `---
titel: ${titel||"Architectuurbeslissing"}
type: adr
status: concept
datum: ${new Date().toISOString().slice(0,10)}
---

## Context

*Beschrijf het probleem of de situatie die aanleiding geeft tot deze beslissing.*

## Beslissing

*Wat is de gekozen aanpak?*

## Alternatieven overwogen

- **Optie A** → Afgewezen omdat …
- **Optie B** → Afgewezen omdat …

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

## Status-geschiedenis

| Datum | Status | Door |
|-------|--------|------|
| ${new Date().toISOString().slice(0,10)} | concept | |
`;

// ── DailyView component ───────────────────────────────────────────────────────
// ── QuickEntryBar — Parchment-stijl inline capture ──────────────────────────
// Alles landt direct in de dagnotitie. Geen aparte "capture" notitie.
// Types: · notitie  ☐ taak  💡 idee
const QuickEntryBar = ({ dayContent, onDayChange, W }) => {
  const [qInput, setQInput] = React.useState("");
  const [qType,  setQType]  = React.useState("note");
  const inputRef = React.useRef(null);

  const append = React.useCallback(() => {
    if (!qInput.trim()) return;
    const prefix = qType==="task" ? "- [ ] " : qType==="idea" ? "💡 " : "- ";
    const line   = prefix + qInput.trim();
    onDayChange(dayContent ? dayContent + "\n" + line : line);
    setQInput("");
    inputRef.current?.focus();
  }, [qInput, qType, dayContent, onDayChange]);

  const types = [
    {id:"note", icon:"·", title:"Notitie / observatie"},
    {id:"task", icon:"☐", title:"Taak (wordt - [ ] item)"},
    {id:"idea", icon:"💡",title:"Idee"},
  ];

  return React.createElement("div",{
    style:{display:"flex",gap:"6px",alignItems:"center",
      marginBottom:"10px",padding:"6px 8px",
      background:"rgba(255,255,255,0.03)",
      borderRadius:"8px",border:`1px solid ${W.splitBg}`}
  },
    // Type-toggle knoppen — altijd een zichtbare rand/achtergrond (ook
    // inactief), zelfde stijlpatroon als filterBtn in TasksPanel.js, zodat
    // alle drie er als knoppen van dezelfde familie uitzien i.p.v. de
    // inactieve twee die eerst als kale tekens zonder vorm oogden.
    ...types.map(t => React.createElement("button",{
      key:t.id, onClick:()=>setQType(t.id), title:t.title,
      style:{
        background:qType===t.id?"rgba(138,198,242,0.18)":"rgba(255,255,255,0.03)",
        border:`1px solid ${qType===t.id?(W.blue):(W.splitBg)}`,
        borderRadius:"5px",padding:"3px 8px",cursor:"pointer",
        fontSize:"13px",color:qType===t.id?(W.blue):(W.fgMuted),
        fontWeight:qType===t.id?"700":"400",
        transition:"all .12s",
      }
    },t.icon)),
    // Input veld
    React.createElement("input",{
      ref:inputRef,
      value:qInput, onChange:e=>setQInput(e.target.value),
      onKeyDown:e=>{if(e.key==="Enter")append(); if(e.key==="Escape")setQInput("");},
      placeholder:qType==="task"?"Nieuwe taak…":qType==="idea"?"Idee vastleggen…":"Gedachte, observatie…",
      style:{
        flex:1, background:"none", border:"none",
        color:W.fg, fontSize:"13px", outline:"none",
        padding:"2px 0",
      }
    }),
    // Toevoegen knop
    qInput.trim() && React.createElement("button",{
      onClick:append,
      style:{
        background:`rgba(138,198,242,0.15)`,
        border:`1px solid ${W.blue}`,
        borderRadius:"5px",padding:"3px 10px",
        cursor:"pointer",color:W.blue,
        fontSize:"12px",fontWeight:"600",flexShrink:0,
      }
    },"+ Voeg toe")
  );
};

// ── InboxProcessor — toont dagnotitie bullets met expliciete → ZK knop ────────
// Parseert onverwerkte regels uit de dagnotitie en biedt per regel een knop.
const InboxProcessor = ({ dayContent, onDayChange, onAddNote, viewDate, today, W, notes=[] }) => {
  const [promoting, setPromoting] = React.useState(null); // {line, index, title}

  // Stopwoorden voor de instant tag-suggesties (zelfde aanpak als
  // SmartLinkSuggester's instant-laag: woordoverlap + letterlijke match).
  const STOPWORDS = React.useMemo(() => new Set([
    "de","het","een","van","voor","met","dat","die","zijn","the","and","for","that","with",
    "aan","als","bij","dan","dit","door","hun","kan","maar","naar","niet","nog","ook","tot","wel","wordt"
  ]), []);

  // ── Tag-suggesties: hergebruikt de al geladen notities+tags als index ────
  // Geen server-call — scoort bestaande tags op woordoverlap met de tekst
  // van het item, plus een bonus als de tag letterlijk voorkomt.
  const tagSuggestions = React.useMemo(() => {
    if (!promoting) return [];
    const text = `${promoting.title} ${promoting.clean}`.toLowerCase();
    const words = new Set((text.match(/[a-z\u00c0-\u024f]{3,}/g) || [])
      .filter(w => !STOPWORDS.has(w)));
    const already = new Set((promoting.tagsInput || "").split(",")
      .map(t => t.trim().toLowerCase()).filter(Boolean));
    const scores = {};
    notes.forEach(n => {
      if (!n.tags?.length) return;
      const titleWords = (n.title || "").toLowerCase().match(/[a-z\u00c0-\u024f]{3,}/g) || [];
      const overlap = titleWords.filter(w => words.has(w)).length;
      n.tags.forEach(t => {
        const tl = t.toLowerCase();
        if (already.has(tl)) return;
        let score = overlap;
        if (text.includes(tl)) score += 5; // tag letterlijk in de tekst = sterk signaal
        if (score > 0) scores[t] = (scores[t] || 0) + score;
      });
    });
    return Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
  }, [promoting, notes, STOPWORDS]);

  const addSuggestedTag = (tag) => {
    setPromoting(p => {
      const cur = (p.tagsInput || "").split(",").map(t => t.trim()).filter(Boolean);
      if (cur.some(t => t.toLowerCase() === tag.toLowerCase())) return p;
      return { ...p, tagsInput: [...cur, tag].join(", ") };
    });
  };

  // Parseer onverwerkte regels (geen ~~doorstreping~~, geen lege regels)
  const lines = React.useMemo(() => {
    if (!dayContent) return [];
    return dayContent.split("\n")
      .map((line, i) => ({ raw: line, index: i }))
      .filter(({ raw }) => {
        const t = raw.trim();
        if (!t) return false;
        if (t.startsWith("~~") && t.includes("~~")) return false; // al verwerkt
        if (t.startsWith("#")) return false; // kopteksten, geen bullets
        if (t.startsWith(">")) return false; // citaten
        return t.startsWith("- ") || t.startsWith("· ") || t.startsWith("💡");
      })
      .map(({ raw, index }) => {
        const clean = raw.trim()
          .replace(/^- \[[ x]\] /, "") // strip checkbox
          .replace(/^- /, "")
          .replace(/^· /, "")
          .replace(/^💡 /, "")
          .trim();
        const isTask = raw.trim().startsWith("- [ ]") || raw.trim().startsWith("- [x]");
        const isIdea = raw.trim().startsWith("💡");
        return { raw, index, clean, isTask, isIdea };
      });
  }, [dayContent]);

  if (!lines.length) return null;

  const promoteToZK = () => {
    if (!promoting || !promoting.title.trim()) return;
    // Herstel de juiste opmaak per type
    const contentLine = promoting.isTask
      ? `- [ ] ${promoting.clean}`   // taak blijft een checkbox
      : promoting.isIdea
      ? `💡 ${promoting.clean}`      // idee blijft een idee
      : `- ${promoting.clean}`;      // notitie blijft een bullet
    const content = [
      `> [!bron]\n> 📓 Dagnotitie ${viewDate}`,
      "",
      contentLine,
    ].join("\n");
    // Tags: handmatig ingevoerd + automatisch type-tag
    const autoTag  = promoting.isTask ? "taak" : promoting.isIdea ? "idee" : "dagnotitie";
    const manTags  = (promoting.tagsInput||"").split(",").map(t=>t.trim().toLowerCase()).filter(Boolean);
    const allTags  = [...new Set([autoTag, ...manTags])];
    onAddNote?.({ title: promoting.title.trim(), content,
      tags: allTags,
      created: viewDate, modified: today });
    // Markeer de originele regel als verwerkt
    const newLines = dayContent.split("\n").map((line, i) => {
      if (i !== promoting.index) return line;
      return line.replace(promoting.clean, `~~${promoting.clean}~~ ([[${promoting.title.trim()}]])`);
    });
    onDayChange(newLines.join("\n"));
    setPromoting(null);
  };

  return React.createElement("div", {
    style: { marginTop: "12px", borderTop: `1px solid ${W.splitBg}`, paddingTop: "10px" }
  },
    React.createElement("div", {
      style: { fontSize: "11px", color: W.fgDim, letterSpacing: "0.8px", marginBottom: "8px" }
    }, `INBOX — ${lines.length} item${lines.length !== 1 ? "s" : ""} te verwerken`),

    // Lijst met items + ZK knop
    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "4px" } },
      lines.map(({ raw, index, clean, isTask, isIdea }) =>
        React.createElement("div", {
          key: index,
          style: {
            display: "flex", alignItems: "center", gap: "8px",
            padding: "5px 8px", borderRadius: "6px",
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${W.splitBg}`,
          }
        },
          // Type-icoon
          React.createElement("span", { style: { fontSize: "12px", flexShrink: 0, opacity: 0.7 } },
            isTask ? "☐" : isIdea ? "💡" : "·"
          ),
          // Tekst
          React.createElement("span", {
            style: { flex: 1, fontSize: "13px", color: W.fg, overflow: "hidden",
                     textOverflow: "ellipsis", whiteSpace: "nowrap" }
          }, clean),
          // Acties: → ZK en × verwijder
          React.createElement("div",{style:{display:"flex",gap:"4px",flexShrink:0}},
            React.createElement("button", {
              onClick: () => setPromoting({ raw, index, clean, isTask, isIdea, title: clean.slice(0, 60) }),
              title: "Maak een permanente Zettelkasten-notitie van dit item",
              style: {
                background: "rgba(114,182,96,0.1)",
                border: "1px solid rgba(114,182,96,0.5)",
                borderRadius: "5px", padding: "3px 8px",
                cursor: "pointer", fontSize: "11px",
                color: "#72b660", fontWeight: "600",
                whiteSpace: "nowrap",
              }
            }, "→ ZK"),
            React.createElement("button", {
              onClick: () => {
                // Verwijder de regel direct uit de dagnotitie
                const newLines = dayContent.split("\n")
                  .filter((_, i) => i !== index);
                onDayChange(newLines.join("\n"));
              },
              title: "Verwijder dit item uit de dagnotitie",
              style: {
                background: "none",
                border: "1px solid transparent",
                borderRadius: "5px", padding: "3px 6px",
                cursor: "pointer", fontSize: "13px",
                color: W.fgDim,
                lineHeight: 1,
                transition: "all .12s",
              },
              onMouseEnter: e => { e.currentTarget.style.color="#e5786d"; e.currentTarget.style.borderColor="rgba(229,120,109,0.4)"; e.currentTarget.style.background="rgba(229,120,109,0.08)"; },
              onMouseLeave: e => { e.currentTarget.style.color=W.fgDim; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.background="none"; },
            }, "×")
          )
        )
      )
    ),

    // Promotie-dialog — overlay + modal
    promoting && React.createElement(React.Fragment, null,
      // Donkere overlay — klikt om te sluiten
      React.createElement("div", {
        onClick: () => setPromoting(null),
        style: {
          position: "fixed", inset: 0, zIndex: 1999,
          background: "rgba(0,0,0,0.7)",
          backdropFilter: "blur(2px)",
        }
      }),
      // Modal
      React.createElement("div", {
        onClick: e => e.stopPropagation(),
        style: {
          position: "fixed", top: "50%", left: "50%",
          transform: "translate(-50%,-50%)", zIndex: 2000,
          width: "min(520px,92vw)",
          background: W.bg2,
          border: `2px solid ${W.blue}`,
          borderRadius: "14px", padding: "24px 28px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
        }
      },
      // Header
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}},
        React.createElement("div",{style:{fontSize:"16px",fontWeight:"800",color:W.fg}},
          "📝 Inbox → Zettelkasten"),
        React.createElement("button",{onClick:()=>setPromoting(null),
          style:{background:"none",border:"none",color:W.fgMuted,
            cursor:"pointer",fontSize:"18px",lineHeight:1,padding:"0 4px"}},"×")
      ),
      // Preview fragment
      React.createElement("div",{style:{
        background:W.bg, border:`1px solid ${W.splitBg}`,
        borderRadius:"6px", padding:"8px 12px",
        fontSize:"13px", color:W.fg,
        marginBottom:"16px", fontStyle:"italic", lineHeight:"1.5",
        maxHeight:"60px", overflow:"hidden",
        borderLeft:`3px solid ${W.blue}`,
      }},
        `"${promoting.clean.slice(0,140)}${promoting.clean.length>140?"…":""}"`
      ),
      // Titel
      React.createElement("div",{style:{fontSize:"11px",color:W.blue,
        fontWeight:"700",letterSpacing:"1px",marginBottom:"6px"}},"TITEL"),
      React.createElement("input",{
        autoFocus:true,
        value:promoting.title,
        onChange:e=>setPromoting(p=>({...p,title:e.target.value})),
        onKeyDown:e=>{if(e.key==="Enter"&&!e.shiftKey)promoteToZK();if(e.key==="Escape")setPromoting(null);},
        placeholder:"Geef de notitie een duidelijke titel…",
        style:{
          width:"100%",background:W.bg,
          border:`2px solid ${W.blue}`,
          borderRadius:"7px",padding:"9px 13px",
          color:W.fg,fontSize:"15px",fontWeight:"500",
          outline:"none",boxSizing:"border-box",marginBottom:"14px",
        }
      }),
      // Tags invoer
      React.createElement("div",{style:{fontSize:"11px",color:W.blue,
        fontWeight:"700",letterSpacing:"1px",marginBottom:"6px"}},"TAGS"),
      React.createElement("div",{style:{position:"relative"}},
        React.createElement("input",{
          value:promoting.tagsInput||"",
          onChange:e=>setPromoting(p=>({...p,tagsInput:e.target.value})),
          onKeyDown:e=>{if(e.key==="Enter")e.preventDefault();},
          placeholder:`${promoting.isTask?"taak":"dagnotitie"}, architectuur, ea …`,
          style:{
            width:"100%",background:W.bg,
            border:`1px solid ${W.splitBg}`,
            borderRadius:"7px",padding:"7px 13px",
            color:W.fg,fontSize:"13px",
            outline:"none",boxSizing:"border-box",
          }
        }),
        React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,marginTop:"4px"}},
          "Scheid tags met komma's. Automatisch toegevoegd: ",
          React.createElement("span",{style:{color:W.fgMuted}},
            promoting.isTask?"taak":promoting.isIdea?"idee":"dagnotitie")
        ),
        tagSuggestions.length > 0 && React.createElement("div",{
          style:{display:"flex",gap:"5px",flexWrap:"wrap",marginTop:"8px"}
        },
          tagSuggestions.map(tag =>
            React.createElement("span",{
              key: tag,
              onClick: () => addSuggestedTag(tag),
              title: "Klik om toe te voegen",
              style:{
                fontSize:"11px", padding:"2px 10px", borderRadius:"10px",
                background:"rgba(138,198,242,0.08)",
                border:`1px solid rgba(138,198,242,0.3)`,
                color:W.blue, cursor:"pointer",
              }
            }, `+ ${tag}`)
          )
        )
      ),
      // Actie-knoppen
      React.createElement("div",{style:{display:"flex",gap:"10px",marginTop:"18px",justifyContent:"flex-end"}},
        React.createElement("button",{
          onClick:()=>setPromoting(null),
          style:{
            background:"rgba(255,255,255,0.05)",
            border:`1px solid ${W.splitBg}`,
            color:W.fg,
            borderRadius:"7px",padding:"8px 18px",
            cursor:"pointer",fontSize:"13px",fontWeight:"500",
          }
        },"Annuleren"),
        React.createElement("button",{
          onClick:promoteToZK,
          disabled:!promoting.title.trim(),
          style:{
            background:promoting.title.trim()?"#72b660":"rgba(114,182,96,0.3)",
            color:promoting.title.trim()?"#fff":"rgba(255,255,255,0.5)",
            border:"none",borderRadius:"7px",padding:"8px 20px",
            cursor:promoting.title.trim()?"pointer":"not-allowed",
            fontSize:"14px",fontWeight:"700",
            transition:"all .15s",
          }
        },"✓ Maak Zettelkasten-notitie")
      )
    ) // einde modal
    ) // einde Fragment
  );
};

// ── OpenTasksPanel — overzicht openstaande taken met filter ─────────────────
const OpenTasksPanel = ({ notes, onOpenNote, W }) => {
  const [sortOrder,  setSortOrder]  = React.useState("new"); // "new"|"old"
  const [filterTag,  setFilterTag]  = React.useState("");
  const [collapsed,  setCollapsed]  = React.useState(false);
  const [checkingId, setCheckingId] = React.useState(null);
  const [doneIds,    setDoneIds]    = React.useState(new Set());

  const checkTask = React.useCallback(async (task) => {
    if (doneIds.has(task.id)) return;
    setCheckingId(task.id);
    try {
      // Zoek de notitie op en vervang de taak-regel
      const note = notes.find(n => n.id === task.noteId);
      if (!note) return;
      const lines = (note.content || "").split("\n");
      lines[task.lineIdx] = lines[task.lineIdx].replace("- [ ] ", "- [x] ");
      const updated = { ...note, content: lines.join("\n"),
        modified: new Date().toISOString().slice(0,10) };
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      setDoneIds(d => new Set([...d, task.id]));
    } catch(e) {
      console.error("[Tasks] Afvinken mislukt:", e);
    } finally {
      setCheckingId(null);
    }
  }, [notes, doneIds]);

  // Parseer alle open taken uit alle notities
  const allTasks = React.useMemo(() => {
    const tasks = [];
    notes.forEach(note => {
      const lines = (note.content || "").split("\n");
      lines.forEach((line, li) => {
        if (!line.match(/^- \[ \] .+/)) return;
        const text = line.replace(/^- \[ \] /, "").trim();
        if (!text) return;
        // Detecteer datum-tag in tekst bijv. 📅 2026-08-10
        const dateMatch = text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
        tasks.push({
          id:       `${note.id}::${li}`,
          noteId:   note.id,
          noteTitle:note.title || "(Naamloos)",
          text,
          date:     note.modified || note.created || "",
          dueDate:  dateMatch ? dateMatch[1] : null,
          tags:     note.tags || [],
          lineIdx:  li,
        });
      });
    });
    return tasks;
  }, [notes]);

  // Filter + sortering
  const filtered = React.useMemo(() => {
    let list = allTasks;
    if (filterTag) list = list.filter(t => t.tags.some(g => g.toLowerCase().includes(filterTag.toLowerCase())));
    list = [...list].sort((a, b) => {
      const da = a.dueDate || a.date;
      const db = b.dueDate || b.date;
      return sortOrder === "new" ? db.localeCompare(da) : da.localeCompare(db);
    });
    return list;
  }, [allTasks, filterTag, sortOrder]);

  if (!allTasks.length) return null;

  const sortBtn = (id, label) => React.createElement("button", {
    key: id, onClick: () => setSortOrder(id),
    style: {
      background: sortOrder===id ? "rgba(138,198,242,0.15)" : "none",
      border: `1px solid ${sortOrder===id ? (W.blue) : W.splitBg}`,
      color: sortOrder===id ? (W.blue) : W.fgMuted,
      borderRadius:"5px", padding:"3px 9px", cursor:"pointer",
      fontSize:"11px", fontWeight: sortOrder===id ? "700" : "400",
    }
  }, label);

  return React.createElement("div", {
    style: {
      marginTop:"12px",
      border: `1px solid ${W.splitBg}`,
      borderRadius:"10px", overflow:"hidden",
      gridColumn:"1 / -1",
    }
  },
    // ── Header met filter controls ──────────────────────────────────────────
    React.createElement("div", {
      style: {
        display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap",
        padding:"10px 14px",
        background:"rgba(255,255,255,0.03)",
        borderBottom: collapsed ? "none" : `1px solid ${W.splitBg}`,
        cursor:"pointer",
      },
      onClick: () => setCollapsed(c => !c),
    },
      React.createElement("span",{style:{fontSize:"13px",fontWeight:"700",color:W.fg}},
        `✓ Openstaande taken (${filtered.length}${filterTag?` · ${filterTag}`:""})`),
      React.createElement("span",{style:{fontSize:"11px",color:W.fgDim,marginLeft:"auto"}},
        collapsed ? "▾ toon" : "▴ verberg"),
    ),

    // ── Filter + sort bar ───────────────────────────────────────────────────
    !collapsed && React.createElement("div",{
      style:{display:"flex",alignItems:"center",gap:"8px",padding:"8px 14px",
        borderBottom:`1px solid ${W.splitBg}`,flexWrap:"wrap"}},
      // Sortering
      React.createElement("div",{style:{display:"flex",gap:"4px"}},
        sortBtn("new","Nieuw → Oud"),
        sortBtn("old","Oud → Nieuw"),
      ),
      // Tag filter
      React.createElement("input",{
        value:filterTag, onChange:e=>{e.stopPropagation();setFilterTag(e.target.value);},
        onClick:e=>e.stopPropagation(),
        placeholder:"Filter op tag…",
        style:{
          background:W.bg, border:`1px solid ${W.splitBg}`,
          borderRadius:"5px", padding:"3px 10px", color:W.fg,
          fontSize:"11px", outline:"none", width:"140px",
        }
      }),
      filterTag && React.createElement("button",{
        onClick:e=>{e.stopPropagation();setFilterTag("");},
        style:{background:"none",border:"none",color:W.fgMuted,
          cursor:"pointer",fontSize:"13px",padding:"0 2px"}},"×"),
      React.createElement("span",{style:{fontSize:"11px",color:W.fgDim,marginLeft:"auto"}},
        `${filtered.length} van ${allTasks.length}`),
    ),

    // ── Takenlijst ──────────────────────────────────────────────────────────
    !collapsed && React.createElement("div",{
      style:{maxHeight:"280px",overflowY:"auto"}},
      filtered.slice(0,50).map(task =>
        React.createElement("div",{
          key:task.id,
          style:{
            display:"flex", alignItems:"flex-start", gap:"10px",
            padding:"8px 14px",
            borderBottom:`1px solid ${W.splitBg}22`,
            transition:"all .3s",
            opacity: doneIds.has(task.id) ? 0.35 : 1,
            textDecoration: doneIds.has(task.id) ? "line-through" : "none",
          },
          onMouseEnter:e=>{ if(!doneIds.has(task.id)) e.currentTarget.style.background="rgba(255,255,255,0.03)"; },
          onMouseLeave:e=>e.currentTarget.style.background="transparent",
        },
          // Klikbare checkbox
          React.createElement("button",{
            onClick:e=>{e.stopPropagation();checkTask(task);},
            disabled:checkingId===task.id||doneIds.has(task.id),
            title:"Taak afvinken",
            style:{
              background:"none",border:"none",padding:"0 2px",
              cursor:doneIds.has(task.id)?"default":"pointer",
              fontSize:"16px",flexShrink:0,marginTop:"1px",
              color:doneIds.has(task.id)?"#72b660":(W.fgMuted),
              transition:"color .15s",
            }
          },
            checkingId===task.id ? "⏳"
              : doneIds.has(task.id) ? "☑"
              : "☐"
          ),
          // Taak tekst
          React.createElement("div",{style:{flex:1,minWidth:0}},
            React.createElement("div",{
              style:{fontSize:"13px",color:W.fg,lineHeight:"1.4",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}
            },task.text.replace(/📅\s*\d{4}-\d{2}-\d{2}/,"").trim()),
            React.createElement("div",{
              style:{display:"flex",gap:"6px",alignItems:"center",marginTop:"3px",flexWrap:"wrap"}},
              // Notitie-bron
              React.createElement("span",{
                onClick:e=>{e.stopPropagation();onOpenNote?.(task.noteId);},
                title:"Open notitie",
                style:{
                  fontSize:"10px",color:W.blue,
                  cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",
                  whiteSpace:"nowrap",maxWidth:"160px",
                  textDecoration:"underline",textDecorationColor:"rgba(138,198,242,0.4)",
                }
              },task.noteTitle),
              // Datum
              React.createElement("span",{
                style:{fontSize:"10px",color:W.fgDim,flexShrink:0}
              }, task.dueDate
                ? `📅 ${task.dueDate}`
                : task.date ? task.date.slice(0,10) : ""),
              // Tags
              task.tags.slice(0,2).map(t=>
                React.createElement("span",{key:t,
                  style:{fontSize:"9px",background:W.bg2,
                    border:`1px solid ${W.splitBg}`,
                    borderRadius:"6px",padding:"1px 5px",
                    color:W.fgMuted,cursor:"pointer",flexShrink:0},
                  onClick:e=>{e.stopPropagation();setFilterTag(t);}
                },t)
              ),
            )
          ),
          // Open notitie pijl
          React.createElement("button",{
            onClick:e=>{e.stopPropagation();onOpenNote?.(task.noteId);},
            title:"Open notitie met deze taak",
            style:{
              background:"none",border:`1px solid ${W.splitBg}`,
              color:W.fgMuted,borderRadius:"5px",
              padding:"2px 7px",cursor:"pointer",
              fontSize:"11px",flexShrink:0,
            }
          },"→")
        )
      ),
      filtered.length > 50 && React.createElement("div",{
        style:{padding:"8px 14px",fontSize:"11px",color:W.fgDim,textAlign:"center"}},
        `+ ${filtered.length-50} meer taken — gebruik filter om te verfijnen`)
    )
  );
};

const DailyView = ({ notes=[], onOpenNote, onAddNote, llmModel="" }) => {
  const { useState, useEffect, useCallback, useMemo } = React;

  // today EERST — vóór alle useState
  const today = new Date().toISOString().slice(0,10);

  // ── State ─────────────────────────────────────────────────────────────────
  const [srData,      setSrData]      = useState({});
  const [loading,     setLoading]     = useState(true);
  const [reviewing,   setReviewing]   = useState(null);
  const [qLoading,    setQLoading]    = useState(false);
  const [answer,      setAnswer]      = useState("");
  const [revealed,    setRevealed]    = useState(false);
  const [sessionDone, setSessionDone] = useState({});
  const [viewDate,    setViewDate]    = useState(() => new Date().toISOString().slice(0,10));
  const [dayContent,  setDayContent]  = useState("");
  const [dayLoading,  setDayLoading]  = useState(false);
  const [daySaved,    setDaySaved]    = useState(true);
  const [dayDates,    setDayDates]    = useState([]);
  const [editingDay,  setEditingDay]  = useState(true);  // Parchment: altijd direct schrijven
  const [fragment,    setFragment]    = useState(null);
  const [fragPos,     setFragPos]     = useState({x:0,y:0});
  const [fragTitle,   setFragTitle]   = useState("");
  const [fragDialog,  setFragDialog]  = useState(false);
  const [quickTitle,  setQuickTitle]  = useState("");
  const [quickCapt,   setQuickCapt]   = useState(false);
  const [adrTitle,    setAdrTitle]    = useState("");
  const [adrOpen,     setAdrOpen]     = useState(false);

  const dayRef    = React.useRef(null);
  const saveTimer = React.useRef(null);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    SM2.load().then(d=>{ setSrData(d); setLoading(false); });
    fetch("/api/daily/list",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({})})
      .then(r=>r.json()).then(d=>setDayDates(d.dates||[])).catch(()=>{});
  }, []);

  useEffect(() => {
    setDayLoading(true); setEditingDay(false);
    fetch("/api/daily",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date:viewDate})})
      .then(r=>r.json()).then(d=>{ setDayContent(d.content||""); setDaySaved(true); })
      .catch(()=>setDayContent("")).finally(()=>setDayLoading(false));
  }, [viewDate]);

  // ── Callbacks ─────────────────────────────────────────────────────────────
  const saveDayNote = useCallback(async (content, date) => {
    try {
      await fetch("/api/daily/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({date,content})});
      setDaySaved(true);
      setDayDates(dd=>dd.includes(date)?dd:[date,...dd].sort().reverse());
    } catch {}
  }, []);

  const onDayChange = useCallback((val) => {
    setDayContent(val); setDaySaved(false);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(()=>saveDayNote(val,viewDate), 1500);
  }, [viewDate, saveDayNote]);

  const onTextSelect = useCallback((e) => {
    const sel = window.getSelection?.()?.toString().trim();
    if (sel && sel.length > 10) {
      setFragment(sel);
      setFragTitle(sel.split("\n")[0].slice(0,60));
      setFragPos({x:e.clientX||0, y:e.clientY||0});
    } else { setFragment(null); }
  }, []);

  const createNoteFromFragment = useCallback(async () => {
    if (!fragment || !fragTitle.trim()) return;
    const content = [`> [!bron]\n> 📓 Dagnotitie ${viewDate}`, "", fragment].join("\n");
    await onAddNote?.({ title:fragTitle.trim(), content, tags:["dagnotitie","inbox"], created:viewDate, modified:today });
    const marked = dayContent.replace(fragment, `~~${fragment}~~ ([[${fragTitle.trim()}]])`);
    onDayChange(marked);
    setFragment(null); setFragDialog(false); setFragTitle("");
  }, [fragment, fragTitle, viewDate, today, onAddNote, dayContent, onDayChange]);

  const goDay = useCallback((delta) => {
    const d=new Date(viewDate); d.setDate(d.getDate()+delta);
    const nd=d.toISOString().slice(0,10);
    if (nd>today) return;
    clearTimeout(saveTimer.current);
    if (!daySaved) saveDayNote(dayContent,viewDate);
    setViewDate(nd);
  }, [viewDate, today, daySaved, dayContent, saveDayNote]);

  const startReview = useCallback(async (note) => {
    setReviewing({note}); setAnswer(""); setRevealed(false);
    if (!llmModel) return;
    setQLoading(true);
    try {
      const excerpt=(note.content||"").replace(/^---[\s\S]*?---/,"").trim().slice(0,500);
      const resp=await fetch("/api/llm/chat",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:llmModel,messages:[{role:"user",content:`Genereer ÉÉN recall-vraag voor:\nTitel: ${note.title}\n${excerpt}`}],system:"Geef alleen de vraag."})});
      const d=await resp.json();
      const q=(d.content||d.response||"").trim();
      setReviewing(rv=>({...rv, question:q||`Wat is de kerngedachte van "${note.title}"?`}));
    } catch { setReviewing(rv=>({...rv, question:`Wat is de kerngedachte van "${note.title}"?`})); }
    setQLoading(false);
  }, [llmModel]);

  const rateNote = useCallback(async (note, rating) => {
    const next=SM2.next(srData[note.id]||{},rating);
    const updated={...srData,[note.id]:next};
    setSrData(updated); setSessionDone(s=>({...s,[note.id]:rating})); setReviewing(null);
    await SM2.save(updated);
  }, [srData]);

  const addToSR = useCallback(async (noteId) => {
    const updated={...srData,[noteId]:SM2.next({},3)};
    setSrData(updated); await SM2.save(updated);
  }, [srData]);

  const doQuickCapture = useCallback(async () => {
    if (!quickTitle.trim()) return;
    await onAddNote?.({title:quickTitle.trim(),content:"",tags:["capture"],created:today,modified:today});
    setQuickTitle(""); setQuickCapt(false);
  }, [quickTitle, onAddNote, today]);

  const doCreateADR = useCallback(async () => {
    if (!adrTitle.trim()) return;
    await onAddNote?.({title:adrTitle.trim(),content:ADR_TEMPLATE(adrTitle.trim()),tags:["adr","architectuur"],noteType:"adr",created:today,modified:today});
    setAdrTitle(""); setAdrOpen(false);
  }, [adrTitle, onAddNote, today]);

  // ── Afgeleide waarden ─────────────────────────────────────────────────────
  const dueNotes = useMemo(() =>
    viewDate===today ? SM2.dueToday(notes,srData).filter(n=>!sessionDone[n.id]) : [],
    [notes,srData,sessionDone,viewDate,today]);

  const recentNotes = useMemo(() => {
    const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-7);
    const c=cutoff.toISOString().slice(0,10);
    return [...notes].filter(n=>n.modified>=c||n.created>=c)
      .sort((a,b)=>(b.modified||b.created||"").localeCompare(a.modified||a.created||""))
      .slice(0,8);
  }, [notes]);

  const openTasks = useMemo(()=>notes.reduce((a,n)=>a+((n.content||"").match(/^- \[ \] .+/gm)||[]).length,0),[notes]);
  const totalSR   = useMemo(()=>notes.filter(n=>srData[n.id]).length,[notes,srData]);

  const dayLabel = new Date().toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long"});
  const doneToday = Object.keys(sessionDone).length;
  const totalDue  = dueNotes.length + doneToday;
  const pct       = totalDue>0 ? Math.round((doneToday/totalDue)*100) : 100;
  // Was: const isWide = window.innerWidth >= 900 — één keer gelezen bij
  // render, reageerde niet op het draaien van de iPad of andere
  // resize-momenten (split-view, on-screen toetsenbord). Nu reactief.
  const [isWide, setIsWide] = useState(() => window.innerWidth >= 900);
  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 900);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  // W komt uit de gedeelde, globale `let W` in app.js — zie toelichting
  // in SemanticSearch.js voor de exacte bug die hier zat (lokale
  // schaduwing door een nooit-gevuld window.THEME_VARS).
  const card = {background:W.bg2,border:`1px solid ${W.splitBg}`,borderRadius:"10px",padding:"16px 20px"};

  // ── Review scherm ─────────────────────────────────────────────────────────
  if (reviewing) {
    const {note,question} = reviewing;
    return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",
      padding:"20px",maxWidth:"700px",margin:"0 auto",gap:"16px",overflowY:"auto"}},
      React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"12px"}},
        React.createElement("button",{onClick:()=>setReviewing(null),
          style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
            borderRadius:"5px",padding:"4px 10px",cursor:"pointer",fontSize:"13px"}
        },"← Terug"),
        React.createElement("span",{style:{fontSize:"13px",color:W.fgMuted}},
          `Review ${doneToday+1} van ${totalDue}`)
      ),
      React.createElement("div",{style:{...card,borderLeft:`3px solid ${W.blue}`}},
        React.createElement("div",{style:{fontSize:"11px",color:W.blue,letterSpacing:"1px",marginBottom:"10px"}},"RECALL-VRAAG"),
        React.createElement("div",{style:{fontSize:"16px",color:W.fg,lineHeight:"1.6",fontWeight:"500"}},
          qLoading?"🧠 Vraag genereren…":(question||`Wat is de kerngedachte van "${note.title}"?`)),
        !revealed && React.createElement("textarea",{value:answer,onChange:e=>setAnswer(e.target.value),
          placeholder:"Schrijf je antwoord…",rows:4,
          style:{width:"100%",marginTop:"14px",background:W.bg,border:`1px solid ${W.splitBg}`,
            borderRadius:"6px",padding:"10px",color:W.fg,fontSize:"13px",resize:"vertical",outline:"none",boxSizing:"border-box"}}),
        !revealed && React.createElement("button",{onClick:()=>setRevealed(true),
          style:{marginTop:"10px",background:W.blue,color:W.bg,border:"none",borderRadius:"6px",
            padding:"8px 20px",cursor:"pointer",fontSize:"13px",fontWeight:"600"}},"Toon notitie →")
      ),
      revealed && React.createElement("div",{style:{...card,maxHeight:"320px",overflowY:"auto"}},
        React.createElement("div",{style:{fontSize:"11px",color:W.fgMuted,letterSpacing:"1px",marginBottom:"8px"}},note.title.toUpperCase()),
        React.createElement("div",{style:{fontSize:"13px",color:W.fg,lineHeight:"1.7",whiteSpace:"pre-wrap"},
          dangerouslySetInnerHTML:{__html:renderMd?(renderMd((note.content||"").replace(/^---[\s\S]*?---/,"").trim().slice(0,800))):(note.content||"").slice(0,600)+"…"}})
      ),
      revealed && React.createElement("div",{style:card},
        React.createElement("div",{style:{fontSize:"12px",color:W.fgMuted,marginBottom:"12px"}},"Hoe goed kon je de inhoud terugbrengen?"),
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:"8px"}},
          [{label:"😕 Vergeten",r:1,col:"#e5786d",next:SM2.previewLabel(srData[note.id]||{},1)},
           {label:"😐 Moeite",r:2,col:W.orange,next:SM2.previewLabel(srData[note.id]||{},2)},
           {label:"🙂 Goed",r:3,col:W.blue,next:SM2.previewLabel(srData[note.id]||{},3)},
           {label:"😄 Makkelijk",r:4,col:"#72b660",next:SM2.previewLabel(srData[note.id]||{},4)},
          ].map(({label,r,col,next})=>
            React.createElement("button",{key:r,onClick:()=>rateNote(note,r),
              style:{background:`rgba(128,128,128,0.1)`,border:`1px solid ${col}`,
                borderRadius:"8px",padding:"10px 8px",color:col,cursor:"pointer",
                fontSize:"12px",fontWeight:"600",lineHeight:"1.4",textAlign:"center"}},
              React.createElement("div",null,label),
              React.createElement("div",{style:{fontSize:"10px",opacity:0.7,marginTop:"3px"}},`→ ${next}`)
            )
          )
        )
      ),
      revealed && React.createElement("button",{onClick:()=>{onOpenNote?.(note.id);setReviewing(null);},
        style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,borderRadius:"5px",
          padding:"8px 16px",cursor:"pointer",fontSize:"13px",alignSelf:"flex-start"}},"✏ Open in editor")
    );
  }

  // ── Hoofd dashboard ───────────────────────────────────────────────────────
  return React.createElement("div",{style:{
    flex:1,overflowY:"auto",padding:"16px 20px",
    display:"grid",
    // minmax(0,1fr) i.p.v. kale "1fr": een grid-track zonder expliciete
    // minimum-breedte mag nog steeds breder worden dan de beschikbare
    // ruimte zodra een geneste element een grotere intrinsieke
    // inhoudsbreedte heeft — zelfs als dat element zelf al correct
    // minWidth:0 + ellipsis-afkapping heeft (zoals hier bij de taken- en
    // recente-activiteit-lijst). Bij smalle (portrait-iPad) breedtes
    // duwde dit de hele pagina breder dan het scherm, waardoor lange
    // tekst buiten beeld liep i.p.v. netjes af te kappen met "…".
    gridTemplateColumns:isWide?"minmax(0,1fr) 340px":"minmax(0,1fr)",
    gridAutoRows:"min-content",gap:"14px",alignItems:"start",
    maxWidth:"1200px",margin:"0 auto",width:"100%",boxSizing:"border-box",
  }},

    // ── Koptekst ─────────────────────────────────────────────────────── volle breedte
    React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"flex-start",
      flexWrap:"wrap",gap:"12px",gridColumn:"1 / -1"}},
      React.createElement("div",null,
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}},
          // ‹ vorige dag
          React.createElement("button",{onClick:()=>goDay(-1),title:"Vorige dag",
            style:{
              background:"rgba(255,255,255,0.06)",
              border:`1px solid ${W.splitBg}`,
              color:W.fg,
              borderRadius:"7px",width:"30px",height:"30px",
              cursor:"pointer",fontSize:"18px",lineHeight:1,
              display:"flex",alignItems:"center",justifyContent:"center",
              flexShrink:0,fontWeight:"300",
            }},"‹"),
          React.createElement("h2",{style:{margin:0,fontSize:"20px",color:W.fg,fontWeight:"700",
            textTransform:"capitalize",cursor:"pointer",userSelect:"none"},
            onClick:()=>setViewDate(today),title:"Klik voor vandaag"},
            viewDate===today ? dayLabel
              : new Date(viewDate+"T12:00:00").toLocaleDateString("nl-NL",{weekday:"long",day:"numeric",month:"long"})
          ),
          // › volgende dag (alleen tonen als niet vandaag)
          React.createElement("button",{onClick:()=>goDay(1),title:"Volgende dag",
            disabled:viewDate>=today,
            style:{
              background: viewDate>=today ? "none" : "rgba(255,255,255,0.06)",
              border:`1px solid ${viewDate>=today ? "transparent" : W.splitBg}`,
              color: viewDate>=today ? "transparent" : W.fg,
              borderRadius:"7px",width:"30px",height:"30px",
              cursor: viewDate>=today ? "default" : "pointer",
              fontSize:"18px",lineHeight:1,
              display:"flex",alignItems:"center",justifyContent:"center",
              flexShrink:0,fontWeight:"300",
            }},"›"),
          viewDate<today && React.createElement("button",{onClick:()=>setViewDate(today),
            style:{
              background:"rgba(138,198,242,0.12)",
              border:"1px solid rgba(138,198,242,0.4)",
              color:W.blue,
              borderRadius:"10px",padding:"3px 10px",
              cursor:"pointer",fontSize:"11px",fontWeight:"600",
            }},"vandaag")
        ),
        React.createElement("div",{style:{fontSize:"13px",color:W.fgMuted}},
          `${notes.length} notities · ${totalSR} in SR · ${openTasks} taken`)
      ),
      React.createElement("div",{style:{display:"flex",gap:"8px",flexWrap:"wrap"}},
        React.createElement("button",{onClick:()=>setQuickCapt(c=>!c),
          style:{background:quickCapt?"rgba(138,198,242,0.15)":"rgba(255,255,255,0.05)",
            border:`1px solid ${quickCapt?"rgba(138,198,242,0.6)":W.splitBg}`,
            borderRadius:"6px",padding:"6px 14px",fontSize:"13px",cursor:"pointer",
            color:quickCapt?W.blue:(W.fg),
            fontWeight:"500"}},"✎ Snelle notitie"),
        React.createElement("button",{onClick:()=>setAdrOpen(a=>!a),
          style:{background:adrOpen?"rgba(114,182,96,0.15)":"rgba(255,255,255,0.05)",
            border:`1px solid ${adrOpen?"rgba(114,182,96,0.6)":W.splitBg}`,
            borderRadius:"6px",padding:"6px 14px",fontSize:"13px",cursor:"pointer",
            color:adrOpen?"#72b660":(W.fg),
            fontWeight:"500"}},"📋 Nieuwe ADR")
      )
    ),

    // ── Snelle notitie aanmaken ────────────────────────────────── volle breedte
    // Was voorheen alleen als functie aanwezig (doQuickCapture, incl.
    // quickTitle/quickCapt-state), zonder knop die 'm opende — in
    // tegenstelling tot QuickEntryBar (die aan de dagnotitie toevoegt)
    // maakt dit een losse, zelfstandige notitie aan.
    quickCapt && React.createElement("div",{style:{...card,borderLeft:"3px solid "+(W.blue),gridColumn:"1 / -1"}},
      React.createElement("div",{style:{fontSize:"12px",color:W.blue,letterSpacing:"1px",marginBottom:"10px"}},"NIEUWE LOSSE NOTITIE"),
      React.createElement("div",{style:{display:"flex",gap:"8px"}},
        React.createElement("input",{autoFocus:true,value:quickTitle,onChange:e=>setQuickTitle(e.target.value),
          onKeyDown:e=>{if(e.key==="Enter")doQuickCapture();if(e.key==="Escape")setQuickCapt(false);},
          placeholder:"Titel…",
          style:{flex:1,background:W.bg,border:`1px solid ${W.blue}`,borderRadius:"6px",
            padding:"8px 12px",color:W.fg,fontSize:"13px",outline:"none"}}),
        React.createElement("button",{onClick:doQuickCapture,
          style:{background:W.blue,color:W.bg,border:"none",borderRadius:"6px",
            padding:"8px 16px",cursor:"pointer",fontSize:"13px",fontWeight:"600"}},"Aanmaken")
      )
    ),

    // ── ADR aanmaken ─────────────────────────────────────────── volle breedte
    adrOpen && React.createElement("div",{style:{...card,borderLeft:"3px solid #72b660",gridColumn:"1 / -1"}},
      React.createElement("div",{style:{fontSize:"12px",color:"#72b660",letterSpacing:"1px",marginBottom:"10px"}},"NIEUW ARCHITECTUURBESLISSINGSRECORD"),
      React.createElement("div",{style:{display:"flex",gap:"8px"}},
        React.createElement("input",{autoFocus:true,value:adrTitle,onChange:e=>setAdrTitle(e.target.value),
          onKeyDown:e=>{if(e.key==="Enter")doCreateADR();if(e.key==="Escape")setAdrOpen(false);},
          placeholder:"Titel beslissing…",
          style:{flex:1,background:W.bg,border:"1px solid #72b660",borderRadius:"6px",
            padding:"8px 12px",color:W.fg,fontSize:"13px",outline:"none"}}),
        React.createElement("button",{onClick:doCreateADR,
          style:{background:"#72b660",color:W.bg,border:"none",borderRadius:"6px",
            padding:"8px 16px",cursor:"pointer",fontSize:"13px",fontWeight:"600"}},"Aanmaken")
      )
    ),

    // ── Dagnotitie ──────────────────────────── linker kolom (r3, span 2)
    React.createElement("div",{style:{...card,
      borderLeft:`3px solid ${viewDate===today?"#72b660":W.blue}`,
      gridColumn:"1",gridRow:isWide?"3 / span 2":undefined}},
      // ── Parchment-stijl header: compact + quick-entry bar ──────────────────
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between",
        alignItems:"center",marginBottom:"8px"}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"8px"}},
          React.createElement("span",{style:{fontSize:"13px",fontWeight:"700",color:W.fg}},
            viewDate===today?"📓 Vandaag":
              "📓 "+new Date(viewDate+"T12:00:00").toLocaleDateString("nl-NL",{weekday:"short",day:"numeric",month:"short"})),
          (() => {
            // Tel onverwerkte bullets (zonder doorstreping)
            const bullets = (dayContent.match(/^- (?!\[[ x]\] )(?!~~).+/gm)||[]).length;
            const tasks   = (dayContent.match(/^- \[ \] .+/gm)||[]).length;
            return bullets+tasks > 0
              ? React.createElement("span",{title:"Onverwerkte items in inbox",
                  style:{fontSize:"10px",background:"rgba(212,185,124,0.2)",
                    color:"#d4b97c",borderRadius:"8px",padding:"1px 6px"}},
                  `${bullets+tasks} inbox`)
              : (daySaved&&dayContent&&React.createElement("span",{style:{fontSize:"10px",color:"#72b660"}},"✓"))
          })()
        ),
        // Eerdere dagen als snelkoppeling
        React.createElement("div",{style:{display:"flex",gap:"4px"}},
          dayDates.slice(0,3).filter(d=>d!==viewDate).map(d=>
            React.createElement("button",{key:d,onClick:()=>setViewDate(d),
              style:{background:"rgba(255,255,255,0.06)",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                borderRadius:"4px",padding:"1px 6px",fontSize:"10px",cursor:"pointer",fontWeight:"400",
                fontFamily:"inherit",outline:"none",boxShadow:"none",
                WebkitAppearance:"none",appearance:"none"}},d.slice(5))
          )
        )
      ),
      // ── Quick-entry bar (Parchment-kern: alles landt in dagnotitie) ──────────
      React.createElement(QuickEntryBar, { dayContent, onDayChange, W }),
      editingDay
        ? React.createElement("div",{style:{position:"relative"}},
            React.createElement("textarea",{ref:dayRef,value:dayContent,
              onChange:e=>onDayChange(e.target.value),
              onMouseUp:onTextSelect, onKeyUp:onTextSelect,
              placeholder:`Hoe was ${viewDate===today?"vandaag":"deze dag"}?\n\nTip: selecteer tekst → maak Zettelkasten-notitie`,
              rows:8,
              style:{width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,
                borderRadius:"6px",padding:"10px 12px",color:W.fg,fontSize:"14px",
                lineHeight:"1.7",resize:"vertical",outline:"none",
                boxSizing:"border-box",fontFamily:"inherit"}}),
            fragment&&!fragDialog&&React.createElement("div",{style:{
              position:"fixed",left:`${fragPos.x}px`,top:`${fragPos.y+20}px`,zIndex:1000,
              background:W.bg2,border:`1px solid ${W.blue}`,borderRadius:"7px",
              padding:"6px",display:"flex",gap:"6px",boxShadow:"0 4px 16px rgba(0,0,0,0.3)"}},
              React.createElement("button",{onClick:()=>setFragDialog(true),
                style:{background:"rgba(114,182,96,0.12)",border:"1px solid rgba(114,182,96,0.4)",
                  borderRadius:"5px",padding:"4px 10px",color:"#72b660",cursor:"pointer",
                  fontSize:"12px",fontWeight:"600",whiteSpace:"nowrap"}},"📝 → Zettelkasten"),
              React.createElement("button",{onClick:()=>setFragment(null),
                style:{background:"none",border:"none",color:W.fgMuted,cursor:"pointer",fontSize:"14px"}
              },"×")
            ),
            fragDialog&&React.createElement("div",{style:{
              position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
              zIndex:2000,width:"min(500px,90vw)",background:W.bg2,
              border:`1px solid ${W.splitBg}`,borderRadius:"12px",padding:"20px 24px",
              boxShadow:"0 8px 40px rgba(0,0,0,0.5)"}},
              React.createElement("div",{style:{fontSize:"14px",fontWeight:"700",color:W.fg,marginBottom:"12px"}},
                "📝 Fragment → Zettelkasten-notitie"),
              React.createElement("div",{style:{background:W.bg,border:`1px solid ${W.splitBg}`,
                borderRadius:"6px",padding:"8px 12px",fontSize:"13px",color:W.fgMuted,
                marginBottom:"12px",maxHeight:"80px",overflow:"hidden",fontStyle:"italic"}},
                `"${fragment?.slice(0,120)}${(fragment?.length||0)>120?"…":""}"`),
              React.createElement("input",{autoFocus:true,value:fragTitle,
                onChange:e=>setFragTitle(e.target.value),
                onKeyDown:e=>{if(e.key==="Enter")createNoteFromFragment();if(e.key==="Escape")setFragDialog(false);},
                placeholder:"Titel van de notitie…",
                style:{width:"100%",background:W.bg,border:`1px solid ${W.blue}`,
                  borderRadius:"6px",padding:"8px 12px",color:W.fg,fontSize:"14px",
                  outline:"none",boxSizing:"border-box"}}),
              React.createElement("div",{style:{display:"flex",gap:"8px",marginTop:"14px",justifyContent:"flex-end"}},
                React.createElement("button",{onClick:()=>{setFragDialog(false);setFragment(null);},
                  style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                    borderRadius:"6px",padding:"6px 14px",cursor:"pointer",fontSize:"13px"}},"Annuleren"),
                React.createElement("button",{onClick:createNoteFromFragment,disabled:!fragTitle.trim(),
                  style:{background:"#72b660",color:W.bg,border:"none",borderRadius:"6px",
                    padding:"6px 16px",cursor:fragTitle.trim()?"pointer":"not-allowed",
                    fontSize:"13px",fontWeight:"600",opacity:fragTitle.trim()?1:0.5}},"Aanmaken")
              )
            )
          )
        : React.createElement("div",{onClick:()=>setEditingDay(true),
            style:{minHeight:"80px",cursor:"text",fontSize:"14px",lineHeight:"1.7",color:W.fg}},
            dayContent
              ? React.createElement("div",{
                  dangerouslySetInnerHTML:{__html:
                    renderMd ? renderMd(dayContent) : dayContent.replace(/&/g,"&amp;").replace(/</g,"&lt;")
                  }
                })
              : React.createElement("div",{style:{color:W.fgDim,fontSize:"13px",lineHeight:"1.8"}},
                  React.createElement("div",{style:{fontStyle:"italic",marginBottom:"8px"}},
                    "Klik om te schrijven, of gebruik de balk hierboven…"),
                  React.createElement("div",{style:{fontSize:"12px",opacity:0.7}},
                    "💡 Tip: selecteer tekst → 📝 → Zettelkasten om een permanente notitie te maken")
                )
          )
    ),
    // ── InboxProcessor: bullets → ZK knoppen ─────────────────────────────────
    React.createElement("div",{style:{gridColumn:"1",gridRow:isWide?"5":undefined}},
      React.createElement(InboxProcessor,{dayContent,onDayChange,onAddNote,viewDate,today,W,notes})
    ),

    // ── SR Review wachtrij ─────────────── rechter kolom
    React.createElement("div",{style:{...card,gridColumn:isWide?"2":"1",gridRow:isWide?"3":undefined}},
      React.createElement("div",{style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}},
        React.createElement("div",null,
          React.createElement("div",{style:{fontSize:"13px",fontWeight:"700",color:W.fg}},"🔁 Reviews vandaag"),
          React.createElement("div",{style:{fontSize:"12px",color:W.fgMuted,marginTop:"2px"}},
            totalDue===0?"Geen reviews gepland"
              :doneToday===totalDue?`✓ Alle ${totalDue} reviews klaar`
              :`${doneToday}/${totalDue} afgerond`)
        ),
        totalDue>0&&React.createElement("div",{style:{textAlign:"right"}},
          React.createElement("div",{style:{fontSize:"22px",fontWeight:"700",color:W.blue}},`${pct}%`),
          React.createElement("div",{style:{width:"60px",height:"4px",background:W.splitBg,borderRadius:"2px",marginTop:"4px",overflow:"hidden"}},
            React.createElement("div",{style:{width:`${pct}%`,height:"100%",background:W.blue,borderRadius:"2px",transition:"width .3s"}}))
        )
      ),
      dueNotes.slice(0,5).map(n=>{
        const d=srData[n.id]||{};
        const days=Math.round((new Date(today)-new Date(d.due||today))/86400000);
        return React.createElement("div",{key:n.id,
          style:{display:"flex",alignItems:"center",gap:"8px",padding:"7px 10px",
            background:W.bg,borderRadius:"7px",border:`1px solid ${W.splitBg}`,
            cursor:"pointer",marginBottom:"6px",transition:"border-color .12s"},
          onClick:()=>startReview(n),
          onMouseEnter:e=>e.currentTarget.style.borderColor=W.blue,
          onMouseLeave:e=>e.currentTarget.style.borderColor=W.splitBg},
          React.createElement("div",{style:{flex:1,minWidth:0}},
            React.createElement("div",{style:{fontSize:"13px",color:W.fg,fontWeight:"500",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},n.title),
            React.createElement("div",{style:{fontSize:"11px",color:W.fgMuted,marginTop:"1px"}},
              d.reps?`${d.reps}× herhaald`:"Eerste review")
          ),
          days>0&&React.createElement("span",{style:{fontSize:"10px",background:"rgba(229,120,109,0.15)",
            color:"#e5786d",borderRadius:"8px",padding:"2px 6px",flexShrink:0}},`${days}d`),
          React.createElement("button",{onClick:e=>{e.stopPropagation();startReview(n);},
            style:{background:W.blue,color:W.bg,border:"none",borderRadius:"5px",
              padding:"3px 10px",cursor:"pointer",fontSize:"11px",fontWeight:"600",flexShrink:0}},"→")
        );
      }),
      dueNotes.length===0&&doneToday===0&&React.createElement("div",{style:{fontSize:"12px",color:W.fgDim,fontStyle:"italic",textAlign:"center",padding:"12px 0"}},
        "Geen reviews vandaag"),
      viewDate===today&&doneToday===0&&(()=>{
        const untracked=notes.filter(n=>!srData[n.id]&&n.title&&!n.title.startsWith("Afbeelding"));
        if(!untracked.length) return null;
        const pick=untracked[Math.floor(Math.random()*Math.min(5,untracked.length))];
        return React.createElement("div",{style:{marginTop:"8px",display:"flex",flexDirection:"column",gap:"5px"}},
          React.createElement("div",{style:{fontSize:"11px",color:W.fgDim}},
            `${untracked.length} notities nog niet in SR:`),
          React.createElement("button",{
            onClick:()=>addToSR(pick.id),
            style:{background:"rgba(114,182,96,0.1)",border:"1px solid rgba(114,182,96,0.5)",
              color:"#72b660",borderRadius:"6px",padding:"7px 12px",
              cursor:"pointer",fontSize:"12px",fontWeight:"600",textAlign:"left"}
          },`+ "${pick.title?.slice(0,35)}" → SR`)
        );
      })()
    ),

    // ── Statistieken ──────────────────────────────────────────── volle breedte
    React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))",gap:"10px",gridColumn:"1 / -1"}},
      [{label:"Notities",value:notes.length,icon:"📝",col:W.blue},
       {label:"Reviews",value:totalDue,icon:"🔁",col:"#d4b97c"},
       {label:"SR-systeem",value:totalSR,icon:"🧠",col:"#72b660"},
       {label:"Open taken",value:openTasks,icon:"✓",col:W.orange},
      ].map(({label,value,icon,col})=>
        React.createElement("div",{key:label,style:{
          background:W.bg2,border:`1px solid ${W.splitBg}`,
          borderRadius:"8px",padding:"14px 12px",textAlign:"center",
          borderTop:`3px solid ${col}`,
        }},
          React.createElement("div",{style:{fontSize:"22px",marginBottom:"4px"}},icon),
          React.createElement("div",{style:{
            fontSize:"26px",fontWeight:"800",color:W.fg,lineHeight:1
          }},value),
          React.createElement("div",{style:{
            fontSize:"11px",fontWeight:"600",color:col,marginTop:"4px"
          }},label)
        )
      )
    ),

    // ── Openstaande taken ─────────────────────────────────────── volle breedte
    React.createElement("div",{style:{gridColumn:"1 / -1"}},
      React.createElement(OpenTasksPanel,{notes,onOpenNote,W})
    ),

    // ── Recente notities ──────────────────────────────────────── volle breedte
    recentNotes.length>0&&React.createElement("div",{style:{...card,gridColumn:"1 / -1"}},
      React.createElement("div",{style:{fontSize:"13px",fontWeight:"700",color:W.fg,marginBottom:"10px"}},"🕐 Recente activiteit (7 dagen)"),
      recentNotes.map(n=>{
        const inSR=!!srData[n.id];
        return React.createElement("div",{key:n.id,
          style:{display:"flex",alignItems:"center",gap:"10px",padding:"5px 8px",
            borderRadius:"6px",cursor:"pointer",transition:"background .1s"},
          onClick:()=>onOpenNote?.(n.id),
          onMouseEnter:e=>e.currentTarget.style.background=W.bg,
          onMouseLeave:e=>e.currentTarget.style.background="transparent"},
          React.createElement("div",{style:{flex:1,minWidth:0}},
            React.createElement("div",{style:{fontSize:"13px",color:W.fg,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},n.title||"(Naamloos)"),
            React.createElement("div",{style:{fontSize:"10px",color:W.fgDim,marginTop:"1px"}},n.tags?.slice(0,3).join(" · ")||"")
          ),
          React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted,flexShrink:0,minWidth:"55px",textAlign:"right",fontVariantNumeric:"tabular-nums"}},
            (n.modified||n.created||"").slice(5)),
          !inSR&&React.createElement("button",{title:"Toevoegen aan SR",
            onClick:e=>{e.stopPropagation();addToSR(n.id);},
            style:{background:`rgba(138,198,242,0.1)`,border:`1px solid ${W.blue}`,color:W.blue,
              borderRadius:"4px",padding:"2px 7px",cursor:"pointer",fontSize:"10px",flexShrink:0,fontWeight:"600"}},"+SR"),
          inSR&&React.createElement("span",{style:{fontSize:"10px",color:"#72b660",flexShrink:0}},"🧠")
        );
      })
    )
  );
};
