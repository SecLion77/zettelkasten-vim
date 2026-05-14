// ── TasksPanel ─────────────────────────────────────────────────────────────────
// Taken-overzicht: verzamelt alle - [ ] en - [x] items uit alle notities.
// Props: notes, onOpenNote(id)

const TasksPanel = ({ notes = [], onOpenNote }) => {
  const { useState, useMemo } = React;
  const [filter, setFilter]   = useState("open");   // "open" | "done" | "all"
  const [search, setSearch]   = useState("");
  const [sortBy, setSortBy]   = useState("note");   // "note" | "created"

  // Extraheer alle taken uit alle notities
  const allTasks = useMemo(() => {
    const tasks = [];
    for (const note of notes) {
      const lines = (note.content || "").split("\n");
      lines.forEach((line, idx) => {
        const openMatch = line.match(/^(\s*)-\s+\[\s+\]\s+(.+)$/);
        const doneMatch = line.match(/^(\s*)-\s+\[x\]\s+(.+)$/i);
        if (openMatch || doneMatch) {
          const done = !!doneMatch;
          const text = (doneMatch || openMatch)[2].trim();
          const indent = ((doneMatch || openMatch)[1] || "").length;
          tasks.push({ noteId: note.id, noteTitle: note.title || note.id,
                       text, done, lineIdx: idx, indent,
                       created: note.created || note.modified || "" });
        }
      });
    }
    return tasks;
  }, [notes]);

  // Gefilterde taken
  const filtered = useMemo(() => {
    let list = allTasks;
    if (filter === "open") list = list.filter(t => !t.done);
    if (filter === "done") list = list.filter(t => t.done);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.text.toLowerCase().includes(q) ||
        t.noteTitle.toLowerCase().includes(q)
      );
    }
    if (sortBy === "created") {
      list = [...list].sort((a,b) =>
        new Date(b.created||0) - new Date(a.created||0));
    }
    return list;
  }, [allTasks, filter, search, sortBy]);

  // Groepeer op notitie
  const grouped = useMemo(() => {
    const map = new Map();
    for (const t of filtered) {
      if (!map.has(t.noteId)) map.set(t.noteId, { noteId: t.noteId, noteTitle: t.noteTitle, tasks: [] });
      map.get(t.noteId).tasks.push(t);
    }
    return [...map.values()];
  }, [filtered]);

  // Toggle taak aan/uit in notitie
  const toggleTask = async (task) => {
    const note = notes.find(n => n.id === task.noteId);
    if (!note) return;
    const lines = (note.content || "").split("\n");
    const line = lines[task.lineIdx];
    if (!line) return;
    lines[task.lineIdx] = task.done
      ? line.replace(/^(\s*-\s+)\[x\]/i, "$1[ ]")
      : line.replace(/^(\s*-\s+)\[\s+\]/, "$1[x]");
    const updated = { ...note, content: lines.join("\n"), modified: new Date().toISOString() };
    await NoteStore.save(updated);
    // Ververs notes via store
    if (window._zkRefreshNotes) window._zkRefreshNotes();
  };

  const openCount = allTasks.filter(t => !t.done).length;
  const doneCount = allTasks.filter(t => t.done).length;

  const S = {
    container: { display:"flex", flexDirection:"column", height:"100%", background:W.bg, overflow:"hidden" },
    header: { padding:"12px 16px 10px", borderBottom:`1px solid ${W.splitBg}`,
               background:W.bg2, flexShrink:0 },
    title: { fontSize:"16px", fontWeight:"700", color:W.statusFg, marginBottom:"8px" },
    toolbar: { display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap" },
    filterBtn: (active) => ({
      padding:"3px 10px", borderRadius:"10px", fontSize:"12px", cursor:"pointer",
      border:`1px solid ${active ? W.blue+"55" : W.splitBg}`,
      background: active ? `${W.blue}18` : "transparent",
      color: active ? W.blue : W.fgMuted, fontWeight: active ? "600" : "400",
      transition:"all 0.12s",
    }),
    search: { flex:1, minWidth:"120px", background:W.bg, border:`1px solid ${W.splitBg}`,
               borderRadius:"6px", padding:"4px 10px", color:W.fg,
               fontSize:"13px", outline:"none" },
    scroll: { flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", padding:"8px 0" },
    group: { marginBottom:"4px" },
    groupHeader: { padding:"6px 16px 4px", display:"flex", alignItems:"center", gap:"8px",
                   cursor:"pointer" },
    groupTitle: { fontSize:"12px", color:W.blue, fontWeight:"600",
                  overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 },
    taskRow: (done) => ({
      display:"flex", alignItems:"flex-start", gap:"8px",
      padding:"5px 16px", cursor:"pointer",
      transition:"background 0.1s",
    }),
    checkbox: (done) => ({
      width:"15px", height:"15px", borderRadius:"3px", flexShrink:0, marginTop:"2px",
      border:`1.5px solid ${done ? W.comment : W.fgMuted}`,
      background: done ? `${W.comment}30` : "transparent",
      display:"flex", alignItems:"center", justifyContent:"center",
      cursor:"pointer", fontSize:"10px", color:W.comment,
    }),
    taskText: (done) => ({
      fontSize:"13px", color: done ? W.fgMuted : W.fg,
      textDecoration: done ? "line-through" : "none",
      lineHeight:"1.5", flex:1,
    }),
    empty: { padding:"40px 16px", textAlign:"center", color:W.fgMuted, fontSize:"14px" },
    stats: { fontSize:"11px", color:W.fgDim },
  };

  return React.createElement("div", { style:S.container },
    // Header
    React.createElement("div", { style:S.header },
      React.createElement("div", { style:S.title }, "✓ Taken"),
      React.createElement("div", { style:S.toolbar },
        ...[
          { id:"open", label:`Open (${openCount})` },
          { id:"done", label:`Gedaan (${doneCount})` },
          { id:"all",  label:`Alle (${allTasks.length})` },
        ].map(f => React.createElement("button", {
          key:f.id, onClick:()=>setFilter(f.id),
          style:S.filterBtn(filter===f.id)
        }, f.label)),
        React.createElement("input", {
          value:search, onChange:e=>setSearch(e.target.value),
          placeholder:"Zoek taken…",
          style:S.search,
        }),
      )
    ),

    // Takenlijst
    filtered.length === 0
      ? React.createElement("div", { style:S.empty },
          filter==="open" ? "🎉 Geen openstaande taken!" :
          filter==="done" ? "Nog niets afgevinkt." : "Geen taken gevonden.")
      : React.createElement("div", { style:S.scroll },
          grouped.map(group =>
            React.createElement("div", { key:group.noteId, style:S.group },
              // Notitie-header
              React.createElement("div", {
                style:S.groupHeader,
                onClick:()=>onOpenNote?.(group.noteId),
                title:`Open notitie: ${group.noteTitle}`,
              },
                React.createElement("span", {style:{fontSize:"11px",color:W.fgDim}},"📝"),
                React.createElement("span", {style:S.groupTitle}, group.noteTitle),
                React.createElement("span", {
                  style:{fontSize:"10px",color:W.fgDim,flexShrink:0}
                }, `${group.tasks.filter(t=>!t.done).length} open`)
              ),
              // Taken
              ...group.tasks.map((task, i) =>
                React.createElement("div", {
                  key:i,
                  style:S.taskRow(task.done),
                  onMouseEnter:e=>e.currentTarget.style.background="rgba(255,255,255,0.04)",
                  onMouseLeave:e=>e.currentTarget.style.background="transparent",
                },
                  // Checkbox
                  React.createElement("div", {
                    style:S.checkbox(task.done),
                    onClick:()=>toggleTask(task),
                    title: task.done ? "Markeer als open" : "Markeer als gedaan",
                  }, task.done ? "✓" : ""),
                  // Tekst — klik opent notitie
                  React.createElement("div", {
                    style:S.taskText(task.done),
                    onClick:()=>onOpenNote?.(task.noteId),
                  }, task.text)
                )
              )
            )
          )
        )
  );
};
