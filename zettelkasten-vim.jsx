import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── WOMBAT COLOR SCHEME (exact from wombat.vim by Lars H. Nielsen) ────────────
const W = {
  // Core backgrounds
  bg:        "#242424",   // Normal guibg
  bg2:       "#1c1c1c",   // slightly darker
  bg3:       "#2d2d2d",   // lighter panel
  statusBg:  "#444444",   // StatusLine guibg
  visualBg:  "#554d4b",   // Visual guibg
  cursorBg:  "#eae788",   // Cursor guibg (yellow)
  splitBg:   "#3a4046",   // Folded guibg
  searchBg:  "#636066",   // Search guibg
  lineNrBg:  "#303030",   // VisualNOS guibg

  // Foregrounds
  fg:        "#e3e0d7",   // Normal guifg
  fgMuted:   "#857b6f",   // StatusLineNC guifg
  fgDim:     "#a0a8b0",   // Folded guifg
  cursorFg:  "#242424",   // Cursor guifg
  statusFg:  "#ffffd7",   // StatusLine guifg (bright yellow-white)
  visualFg:  "#c3c6ca",   // Visual guifg
  searchFg:  "#d787ff",   // Search guifg (purple)

  // Syntax colors
  comment:   "#9fca56",   // Comment — green (wombat uses muted green)
  string:    "#cae682",   // String — yellow-green
  keyword:   "#8ac6f2",   // Statement — blue
  type:      "#92b5dc",   // Type — light blue
  special:   "#e5786d",   // Special — salmon/red
  number:    "#e5786d",   // Number
  preproc:   "#e5786d",   // PreProc
  func:      "#cae682",   // Function
  identifier: "#c3c6ca",  // Identifier

  // Extra semantic
  orange:    "#e5786d",   // errors/warnings
  purple:    "#d787ff",   // search/links
  green:     "#9fca56",   // insert mode/ok
  yellow:    "#eae788",   // cursor/highlight
  blue:      "#8ac6f2",   // keywords
};

// ─── Storage keys ──────────────────────────────────────────────────────────────
const NOTES_KEY    = "zk-vim-notes-v2";
const PDFNOTES_KEY = "zk-vim-pdfnotes-v2";

// ─── Seed notes ────────────────────────────────────────────────────────────────
const SEED = [
  {
    id: "20240101000001",
    title: "Zettelkasten — Begin hier",
    content: `# Zettelkasten\n\n*Elke notitie is een atoom van kennis.*\n\n## VIM toetsen\n\nIn **NORMAL** mode:\n- \`h j k l\` — bewegen\n- \`i\` — INSERT mode\n- \`a\` — append\n- \`o\` — nieuwe regel onder\n- \`O\` — nieuwe regel boven\n- \`w\` / \`b\` — woord voor/achteruit\n- \`0\` / \`$\` — begin/einde regel\n- \`gg\` / \`G\` — begin/einde document\n- \`dd\` — verwijder regel\n- \`yy\` — kopieer regel\n- \`p\` — plak\n- \`u\` — undo\n- \`Ctrl+r\` — redo\n- \`/\` — zoeken\n- \`:w\` — opslaan\n- \`ESC\` — terug naar NORMAL\n\nZie ook [[20240101000002]] voor Zettelkasten links.`,
    tags: ["meta", "vim"],
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
  },
  {
    id: "20240101000002",
    title: "Links en Verbindingen",
    content: `# Links en Verbindingen\n\nDe kracht van Zettelkasten zit in **bidirectionele links**.\n\n## Syntax\n\nGebruik \`[[ID]]\` of \`[[Titel]]\` om te verwijzen:\n\nTerug naar [[20240101000001]] — de beginnotitie.\n\n## Waarom werkt dit?\n\nVerbindingen onthullen verborgen patronen in je kennis.\n#methode #links`,
    tags: ["methode", "links"],
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
  },
];

// ─── Utils ─────────────────────────────────────────────────────────────────────
const genId = () => {
  const n = new Date();
  return [
    n.getFullYear(),
    String(n.getMonth()+1).padStart(2,"0"),
    String(n.getDate()).padStart(2,"0"),
    String(n.getHours()).padStart(2,"0"),
    String(n.getMinutes()).padStart(2,"0"),
    String(n.getSeconds()).padStart(2,"0"),
    String(Math.floor(Math.random()*99)).padStart(2,"0"),
  ].join("");
};

const extractLinks = (c="") => [...new Set([...c.matchAll(/\[\[([^\]]+)\]\]/g)].map(m=>m[1]))];
const extractTags  = (c="") => [...new Set([...c.matchAll(/#(\w+)/g)].map(m=>m[1]))];

// ─── Markdown renderer ─────────────────────────────────────────────────────────
const renderMd = (text, notes) => {
  if (!text) return "";
  let h = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  h = h.replace(/^### (.+)$/gm,"<h3>$1</h3>");
  h = h.replace(/^## (.+)$/gm,"<h2>$1</h2>");
  h = h.replace(/^# (.+)$/gm,"<h1>$1</h1>");
  h = h.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  h = h.replace(/\*(.+?)\*/g,"<em>$1</em>");
  h = h.replace(/`(.+?)`/g,"<code>$1</code>");
  h = h.replace(/\[\[([^\]]+)\]\]/g,(_,id)=>{
    const n=notes.find(x=>x.id===id||x.title===id);
    return `<span class="zlink" data-id="${id}">${n?n.title:id}</span>`;
  });
  h = h.replace(/#(\w+)/g,'<span class="taghl">#$1</span>');
  h = h.replace(/^[-*] (.+)$/gm,"<li>$1</li>");
  h = h.replace(/(<li>[\s\S]*?<\/li>\n?)+/g,"<ul>$&</ul>");
  return h.split(/\n\n+/).map(b=>{
    if(/^<(h[123]|ul|li)/.test(b)) return b;
    return `<p>${b.replace(/\n/g,"<br>")}</p>`;
  }).join("\n");
};

// ─── VIM Editor ───────────────────────────────────────────────────────────────
const VimEditor = ({ value, onChange, onSave, onEscape }) => {
  const [mode, setMode] = useState("NORMAL"); // NORMAL | INSERT | VISUAL | COMMAND
  const [cmdBuf, setCmdBuf] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [cursor, setCursor] = useState({ line: 0, col: 0 });
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [clipboard, setClipboard] = useState("");
  const [undoStack, setUndoStack] = useState([value]);
  const [undoIdx, setUndoIdx] = useState(0);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);
  const [pendingG, setPendingG] = useState(false);
  const [pendingD, setPendingD] = useState(false);
  const [pendingY, setPendingY] = useState(false);

  const pushUndo = useCallback((newVal) => {
    setUndoStack(prev => {
      const stack = prev.slice(0, undoIdx + 1);
      return [...stack, newVal];
    });
    setUndoIdx(prev => prev + 1);
  }, [undoIdx]);

  const lines = value.split("\n");

  // Get cursor position from textarea selectionStart
  const syncCursor = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const pos = ta.selectionStart;
    const before = value.substring(0, pos);
    const lineIdx = (before.match(/\n/g)||[]).length;
    const colIdx = pos - before.lastIndexOf("\n") - 1;
    setCursor({ line: lineIdx, col: Math.max(0, colIdx) });
  };

  // Move textarea cursor to given line/col
  const moveTo = (lineIdx, colIdx) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const ls = value.split("\n");
    let pos = 0;
    for (let i = 0; i < Math.min(lineIdx, ls.length - 1); i++) pos += ls[i].length + 1;
    pos += Math.min(colIdx, (ls[lineIdx]||"").length);
    ta.setSelectionRange(pos, pos);
    syncCursor();
  };

  const insertMode = () => {
    setMode("INSERT");
    setStatusMsg("");
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const normalMode = () => {
    setMode("NORMAL");
    setCmdBuf("");
    setPendingG(false);
    setPendingD(false);
    setPendingY(false);
    setStatusMsg("");
    setTimeout(() => containerRef.current?.focus(), 0);
  };

  // Run VIM command (after :)
  const runCommand = (cmd) => {
    const t = cmd.trim();
    if (t === "w" || t === "write") { onSave(); setStatusMsg('"[saved]" written'); }
    else if (t === "q" || t === "quit") { onEscape(); }
    else if (t === "wq") { onSave(); onEscape(); }
    else if (t === "q!") { onEscape(); }
    else setStatusMsg(`E492: Not an editor command: ${t}`);
    setMode("NORMAL");
    setCmdBuf("");
  };

  // NORMAL mode key handler
  const handleNormalKey = (e) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const k = e.key;
    const ctrl = e.ctrlKey;

    // Command mode
    if (mode === "COMMAND") {
      if (k === "Enter") { runCommand(cmdBuf); return; }
      if (k === "Escape") { setMode("NORMAL"); setCmdBuf(""); return; }
      if (k === "Backspace") { setCmdBuf(p => p.slice(0,-1)); return; }
      setCmdBuf(p => p + k);
      return;
    }

    // Search mode
    if (mode === "SEARCH") {
      if (k === "Enter") {
        setSearchTerm(searchInput);
        setStatusMsg(`/${searchInput}`);
        setMode("NORMAL");
        setSearchInput("");
        return;
      }
      if (k === "Escape") { setMode("NORMAL"); setSearchInput(""); return; }
      if (k === "Backspace") { setSearchInput(p=>p.slice(0,-1)); return; }
      if (k.length === 1) setSearchInput(p=>p+k);
      return;
    }

    e.preventDefault();

    // Two-key sequences
    if (pendingG) {
      setPendingG(false);
      if (k === "g") { ta.setSelectionRange(0,0); syncCursor(); return; }
    }
    if (pendingD) {
      setPendingD(false);
      if (k === "d") {
        // Delete line
        const ls = value.split("\n");
        const cur = cursor.line;
        setClipboard(ls[cur]);
        ls.splice(cur, 1);
        const nv = ls.join("\n") || "";
        pushUndo(nv); onChange(nv);
        setTimeout(() => moveTo(Math.min(cur, ls.length-1), 0), 0);
        return;
      }
    }
    if (pendingY) {
      setPendingY(false);
      if (k === "y") {
        const ls = value.split("\n");
        setClipboard(ls[cursor.line]);
        setStatusMsg("1 line yanked");
        return;
      }
    }

    switch (k) {
      // Enter insert modes
      case "i": insertMode(); break;
      case "I": {
        const ls=value.split("\n");
        const lineStart = value.split("\n").slice(0,cursor.line).join("\n").length + (cursor.line>0?1:0);
        ta.setSelectionRange(lineStart,lineStart);
        insertMode(); break;
      }
      case "a": {
        const pos = (ta.selectionStart||0)+1;
        ta.setSelectionRange(pos,pos);
        insertMode(); break;
      }
      case "A": {
        const ls=value.split("\n");
        const lineEnd = value.split("\n").slice(0,cursor.line+1).join("\n").length;
        ta.setSelectionRange(lineEnd,lineEnd);
        insertMode(); break;
      }
      case "o": {
        // New line below
        const ls=value.split("\n");
        const pos=value.split("\n").slice(0,cursor.line+1).join("\n").length;
        const nv=value.substring(0,pos)+"\n"+value.substring(pos);
        pushUndo(nv); onChange(nv);
        setTimeout(()=>{ ta.setSelectionRange(pos+1,pos+1); insertMode(); },0);
        break;
      }
      case "O": {
        // New line above
        const lineStart = value.split("\n").slice(0,cursor.line).join("\n").length + (cursor.line>0?1:0);
        const nv=value.substring(0,lineStart)+"\n"+value.substring(lineStart);
        pushUndo(nv); onChange(nv);
        setTimeout(()=>{ ta.setSelectionRange(lineStart,lineStart); insertMode(); },0);
        break;
      }

      // Movement
      case "h": { const p=Math.max(0,(ta.selectionStart||1)-1); ta.setSelectionRange(p,p); syncCursor(); break; }
      case "l": { const p=(ta.selectionStart||0)+1; ta.setSelectionRange(p,p); syncCursor(); break; }
      case "j": {
        const ls=value.split("\n");
        const nextLine=Math.min(cursor.line+1,ls.length-1);
        moveTo(nextLine,cursor.col); break;
      }
      case "k": {
        const prevLine=Math.max(0,cursor.line-1);
        moveTo(prevLine,cursor.col); break;
      }
      case "w": {
        // Forward word
        let p=ta.selectionStart||0;
        while(p<value.length && !/\s/.test(value[p])) p++;
        while(p<value.length && /\s/.test(value[p])) p++;
        ta.setSelectionRange(p,p); syncCursor(); break;
      }
      case "b": {
        let p=Math.max(0,(ta.selectionStart||1)-1);
        while(p>0 && /\s/.test(value[p])) p--;
        while(p>0 && !/\s/.test(value[p-1])) p--;
        ta.setSelectionRange(p,p); syncCursor(); break;
      }
      case "0": { moveTo(cursor.line,0); break; }
      case "$": { moveTo(cursor.line, (value.split("\n")[cursor.line]||"").length); break; }
      case "G": {
        const end=value.length;
        ta.setSelectionRange(end,end); syncCursor(); break;
      }
      case "g": { setPendingG(true); break; }

      // Edit operations
      case "d": { setPendingD(true); break; }
      case "y": { setPendingY(true); break; }
      case "p": {
        if (!clipboard) break;
        const ls=value.split("\n");
        const pos=value.split("\n").slice(0,cursor.line+1).join("\n").length;
        const nv=value.substring(0,pos)+"\n"+clipboard+value.substring(pos);
        pushUndo(nv); onChange(nv); break;
      }
      case "x": {
        const p=ta.selectionStart||0;
        if(p<value.length){
          const nv=value.substring(0,p)+value.substring(p+1);
          pushUndo(nv); onChange(nv);
          ta.setSelectionRange(p,p); syncCursor();
        }
        break;
      }
      case "u": {
        if(undoIdx>0){
          const ni=undoIdx-1;
          setUndoIdx(ni);
          onChange(undoStack[ni]);
          setStatusMsg("-- undo --");
        }
        break;
      }

      // Ctrl combos
      case "r": if(ctrl){ if(undoIdx<undoStack.length-1){ const ni=undoIdx+1; setUndoIdx(ni); onChange(undoStack[ni]); setStatusMsg("-- redo --"); } } break;

      // Command and search
      case ":": { setMode("COMMAND"); setCmdBuf(""); break; }
      case "/": { setMode("SEARCH"); setSearchInput(""); break; }

      // Escape
      case "Escape": onEscape(); break;
    }
  };

  const handleInsertKey = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      pushUndo(value);
      normalMode();
    }
    // Let all other keys pass through naturally to textarea
  };

  useEffect(() => {
    if (mode === "NORMAL" || mode === "COMMAND" || mode === "SEARCH") {
      containerRef.current?.focus();
    }
  }, [mode]);

  const modeColor = {
    NORMAL:  W.blue,
    INSERT:  W.green,
    VISUAL:  W.purple,
    COMMAND: W.orange,
    SEARCH:  W.yellow,
  };
  const modeLabel = {
    NORMAL:  "-- NORMAL --",
    INSERT:  "-- INSERT --",
    VISUAL:  "-- VISUAL --",
    COMMAND: ":",
    SEARCH:  "/",
  };

  const searchHighlight = searchTerm
    ? value.split(searchTerm).length - 1
    : 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", background:W.bg, fontFamily:"'Courier New', Courier, monospace" }}>
      {/* Line numbers + editor area */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative" }}>

        {/* Line numbers */}
        <div style={{
          width:"48px", background:W.bg2, borderRight:`1px solid ${W.splitBg}`,
          paddingTop:"4px", overflowY:"hidden", flexShrink:0,
          userSelect:"none",
        }}>
          {lines.map((_,i) => (
            <div key={i} style={{
              height:"21px", lineHeight:"21px",
              textAlign:"right", paddingRight:"8px",
              fontSize:"12px",
              color: i===cursor.line ? W.statusFg : W.fgMuted,
              background: i===cursor.line ? W.splitBg : "transparent",
              fontWeight: i===cursor.line ? "bold" : "normal",
            }}>
              {i+1}
            </div>
          ))}
        </div>

        {/* NORMAL/COMMAND mode invisible capture layer */}
        {mode !== "INSERT" && (
          <div
            ref={containerRef}
            tabIndex={0}
            onKeyDown={handleNormalKey}
            style={{
              position:"absolute", inset:0, zIndex:10,
              outline:"none", cursor:"text",
              // Invisible but captures keys
              background:"transparent",
            }}
          />
        )}

        {/* The actual textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => {
            if (mode === "INSERT") {
              onChange(e.target.value);
              syncCursor();
            }
          }}
          onKeyDown={mode==="INSERT" ? handleInsertKey : undefined}
          onSelect={syncCursor}
          onClick={() => { if(mode==="NORMAL") syncCursor(); }}
          readOnly={mode !== "INSERT"}
          spellCheck={false}
          style={{
            flex:1,
            background:W.bg,
            color: mode==="INSERT" ? W.fg : W.fg,
            border:"none",
            outline:"none",
            resize:"none",
            padding:"4px 12px",
            fontSize:"13px",
            lineHeight:"21px",
            fontFamily:"'Courier New', Courier, monospace",
            caretColor: mode==="INSERT" ? W.cursorBg : "transparent",
            // Highlight current line background via gradient (CSS trick)
          }}
        />

        {/* Cursor line highlight overlay (NORMAL mode) */}
        {mode === "NORMAL" && (
          <div style={{
            position:"absolute",
            top: `${cursor.line * 21 + 4}px`,
            left:"48px", right:0,
            height:"21px",
            background:"rgba(85,77,75,0.35)",
            pointerEvents:"none",
            borderLeft:`2px solid ${W.visualBg}`,
          }} />
        )}
      </div>

      {/* Status bar — like VIM's statusline */}
      <div style={{
        height:"22px",
        background:W.statusBg,
        display:"flex", alignItems:"center",
        padding:"0 8px",
        gap:"12px",
        fontSize:"12px",
        flexShrink:0,
        borderTop:`1px solid #333`,
      }}>
        <span style={{
          background: modeColor[mode] || W.blue,
          color: "#1c1c1c",
          padding:"0 8px",
          fontWeight:"bold",
          fontSize:"11px",
          letterSpacing:"1px",
          height:"100%",
          display:"flex", alignItems:"center",
        }}>
          {modeLabel[mode]}
        </span>

        {mode === "COMMAND" && (
          <span style={{ color:W.statusFg, fontSize:"12px" }}>:{cmdBuf}<span style={{ background:W.statusFg, color:W.bg, width:"8px", display:"inline-block" }}> </span></span>
        )}
        {mode === "SEARCH" && (
          <span style={{ color:W.yellow, fontSize:"12px" }}>/{searchInput}<span style={{ background:W.yellow, color:W.bg, width:"8px", display:"inline-block" }}> </span></span>
        )}
        {mode === "NORMAL" && pendingG && <span style={{ color:W.fgMuted }}>g</span>}
        {mode === "NORMAL" && pendingD && <span style={{ color:W.fgMuted }}>d</span>}
        {mode === "NORMAL" && pendingY && <span style={{ color:W.fgMuted }}>y</span>}

        <div style={{ flex:1 }} />

        {statusMsg && <span style={{ color:W.string, fontSize:"11px" }}>{statusMsg}</span>}
        {searchTerm && <span style={{ color:W.purple, fontSize:"11px" }}>/{searchTerm} ({searchHighlight})</span>}

        <span style={{ color:W.fgMuted, fontSize:"11px" }}>
          {cursor.line+1}:{cursor.col+1}
        </span>
        <span style={{ color:W.fgDim, fontSize:"11px" }}>
          {Math.round(((cursor.line+1)/lines.length)*100)}%
        </span>
      </div>

      {/* VIM cheatsheet (NORMAL mode) */}
      {mode === "NORMAL" && (
        <div style={{
          background:W.bg2, borderTop:`1px solid ${W.splitBg}`,
          padding:"2px 12px",
          fontSize:"10px", color:W.fgMuted,
          letterSpacing:"0.5px",
          display:"flex", gap:"16px", flexWrap:"wrap",
        }}>
          {[
            ["i","insert"],["a","append"],["o","new↓"],["O","new↑"],
            ["hjkl","move"],["w/b","word"],["dd","del line"],["yy","yank"],
            ["p","paste"],["u","undo"],["C-r","redo"],[":w","save"],[":q","quit"],
          ].map(([k,v])=>(
            <span key={k}>
              <span style={{ color:W.blue, fontWeight:"bold" }}>{k}</span>
              <span style={{ color:W.fgMuted }}> {v}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── PDF Viewer with real highlight annotations ────────────────────────────────
const PDFViewer = ({ pdfNotes, setPdfNotes }) => {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.4);
  const [highlights, setHighlights] = useState(pdfNotes || []);
  const [pendingSel, setPendingSel] = useState(null);
  const [noteInput, setNoteInput] = useState("");
  const [showNoteBox, setShowNoteBox] = useState(false);
  const [noteBoxPos, setNoteBoxPos] = useState({ x:0, y:0 });
  const [isLoading, setIsLoading] = useState(false);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const fileInputRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Load PDF.js from CDN
  useEffect(() => {
    if (window.pdfjsLib) { setPdfjsLoaded(true); return; }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      setPdfjsLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // Render PDF page to canvas
  const renderPage = useCallback(async (doc, num, sc) => {
    if (!doc || !canvasRef.current) return;
    if (renderTaskRef.current) { try { renderTaskRef.current.cancel(); } catch {} }
    const page = await doc.getPage(num);
    const vp = page.getViewport({ scale: sc });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    canvas.height = vp.height;
    canvas.width = vp.width;
    canvas.style.width = vp.width + "px";
    canvas.style.height = vp.height + "px";
    const task = page.render({ canvasContext: ctx, viewport: vp });
    renderTaskRef.current = task;
    try { await task.promise; } catch {}
  }, []);

  useEffect(() => { if (pdfDoc) renderPage(pdfDoc, pageNum, scale); }, [pdfDoc, pageNum, scale, renderPage]);

  const loadPDF = async (e) => {
    const file = e.target.files[0];
    if (!file || !pdfjsLoaded) return;
    setPdfFile(file);
    setIsLoading(true);
    try {
      const ab = await file.arrayBuffer();
      const doc = await window.pdfjsLib.getDocument({ data: ab }).promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setPageNum(1);
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  const handleMouseUp = (e) => {
    const sel = window.getSelection();
    const txt = sel?.toString().trim();
    if (!txt || txt.length < 2) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const selRect = sel.getRangeAt(0).getBoundingClientRect();
    setPendingSel(txt);
    setNoteBoxPos({
      x: selRect.left - rect.left,
      y: selRect.bottom - rect.top + 8,
    });
    setShowNoteBox(true);
    setNoteInput("");
  };

  const saveHighlight = () => {
    if (!pendingSel) return;
    const h = {
      id: genId(),
      text: pendingSel,
      note: noteInput,
      page: pageNum,
      file: pdfFile?.name || "PDF",
      color: W.yellow,
      created: new Date().toISOString(),
    };
    const updated = [...highlights, h];
    setHighlights(updated);
    setPdfNotes(updated);
    setShowNoteBox(false);
    setPendingSel(null);
    setNoteInput("");
    window.getSelection()?.removeAllRanges();
  };

  const removeHighlight = (id) => {
    const updated = highlights.filter(h => h.id !== id);
    setHighlights(updated);
    setPdfNotes(updated);
  };

  const pageHighlights = highlights.filter(h => h.page === pageNum && h.file === pdfFile?.name);

  return (
    <div style={{ display:"flex", height:"100%", fontFamily:"'Courier New',monospace", background:W.bg }}>

      {/* Left: PDF canvas area */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

        {/* PDF toolbar */}
        <div style={{
          background:W.statusBg, borderBottom:`1px solid ${W.splitBg}`,
          padding:"6px 12px", display:"flex", alignItems:"center", gap:"10px",
          fontSize:"12px", flexShrink:0,
        }}>
          <button
            onClick={() => fileInputRef.current.click()}
            style={{
              background:W.blue, color:W.bg, border:"none",
              borderRadius:"4px", padding:"5px 12px",
              fontSize:"11px", fontFamily:"inherit",
              cursor:"pointer", fontWeight:"bold", letterSpacing:"1px",
            }}
          >:open PDF</button>

          {!pdfjsLoaded && <span style={{ color:W.orange, fontSize:"11px" }}>laden pdf.js…</span>}

          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display:"none" }} onChange={loadPDF} />

          {pdfDoc && (<>
            <span style={{ color:W.fgMuted }}>|</span>
            <button onClick={()=>setPageNum(p=>Math.max(1,p-1))}
              style={{ background:"none", border:"none", color:W.fg, cursor:"pointer", fontSize:"16px", padding:"0 4px" }}>←</button>
            <span style={{ color:W.statusFg }}>
              {pageNum} / {numPages}
            </span>
            <button onClick={()=>setPageNum(p=>Math.min(numPages,p+1))}
              style={{ background:"none", border:"none", color:W.fg, cursor:"pointer", fontSize:"16px", padding:"0 4px" }}>→</button>

            <span style={{ color:W.fgMuted }}>|</span>

            <button onClick={()=>setScale(s=>Math.max(0.5,s-0.2))}
              style={{ background:"none", border:"none", color:W.fg, cursor:"pointer", fontSize:"14px" }}>−</button>
            <span style={{ color:W.fgMuted }}>{Math.round(scale*100)}%</span>
            <button onClick={()=>setScale(s=>Math.min(3,s+0.2))}
              style={{ background:"none", border:"none", color:W.fg, cursor:"pointer", fontSize:"14px" }}>+</button>

            <span style={{ color:W.fgMuted, fontSize:"11px" }}>│ {pdfFile?.name}</span>
          </>)}

          <div style={{ flex:1 }} />

          {pdfDoc && <span style={{ color:W.comment, fontSize:"10px" }}>Selecteer tekst → highlight</span>}
        </div>

        {/* Canvas scroll area */}
        <div style={{ flex:1, overflow:"auto", background:W.lineNrBg, position:"relative" }}>
          {isLoading && (
            <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ color:W.blue, fontSize:"14px" }}>laden…</span>
            </div>
          )}

          {!pdfDoc && !isLoading && (
            <div style={{
              display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", height:"100%", gap:"16px",
              color:W.fgMuted,
            }}>
              <div style={{ fontSize:"56px", filter:"grayscale(0.3)" }}>📄</div>
              <div style={{ fontSize:"14px", color:W.fgDim }}>:open PDF om te beginnen</div>
              <div style={{ fontSize:"11px", color:W.splitBg, maxWidth:"260px", textAlign:"center", lineHeight:"1.6" }}>
                Selecteer tekst om te highlighten en notities toe te voegen. Alles verschijnt in de kennisgraaf.
              </div>
            </div>
          )}

          {pdfDoc && (
            <div
              ref={overlayRef}
              style={{ position:"relative", display:"inline-block", margin:"20px auto", display:"block", width:"fit-content", margin:"20px auto" }}
              onMouseUp={handleMouseUp}
            >
              <canvas ref={canvasRef} style={{ display:"block", boxShadow:"0 4px 24px rgba(0,0,0,0.6)" }} />

              {/* Highlight note popup */}
              {showNoteBox && (
                <div style={{
                  position:"absolute",
                  left: Math.min(noteBoxPos.x, 400),
                  top: noteBoxPos.y,
                  background:W.bg3,
                  border:`1px solid ${W.yellow}`,
                  borderRadius:"6px",
                  padding:"12px",
                  zIndex:100,
                  width:"320px",
                  boxShadow:`0 4px 20px rgba(0,0,0,0.5)`,
                }}>
                  <div style={{ fontSize:"11px", color:W.fgMuted, marginBottom:"8px", fontFamily:"inherit" }}>
                    ✎ highlight: "{pendingSel?.substring(0,60)}{pendingSel?.length>60?"…":""}"
                  </div>
                  <textarea
                    autoFocus
                    value={noteInput}
                    onChange={e=>setNoteInput(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();saveHighlight();} if(e.key==="Escape"){setShowNoteBox(false);setPendingSel(null);} }}
                    placeholder="Notitie (optioneel) — Enter om op te slaan, Shift+Enter nieuwe regel, Esc annuleer"
                    rows={3}
                    style={{
                      width:"100%", boxSizing:"border-box",
                      background:W.bg, border:`1px solid ${W.splitBg}`,
                      borderRadius:"4px", padding:"8px",
                      color:W.fg, fontSize:"12px",
                      fontFamily:"'Courier New',monospace",
                      outline:"none", resize:"vertical",
                    }}
                  />
                  <div style={{ display:"flex", gap:"8px", marginTop:"8px" }}>
                    <button onClick={saveHighlight} style={{
                      background:W.yellow, color:W.bg,
                      border:"none", borderRadius:"4px",
                      padding:"5px 12px", fontSize:"11px",
                      fontFamily:"inherit", cursor:"pointer", fontWeight:"bold",
                    }}>Opslaan :w</button>
                    <button onClick={()=>{setShowNoteBox(false);setPendingSel(null);window.getSelection()?.removeAllRanges();}} style={{
                      background:"none", color:W.fgMuted,
                      border:`1px solid ${W.splitBg}`, borderRadius:"4px",
                      padding:"5px 12px", fontSize:"11px",
                      fontFamily:"inherit", cursor:"pointer",
                    }}>Esc</button>
                  </div>
                </div>
              )}

              {/* Page highlights overlay indicator dots */}
              {pageHighlights.map((h,i) => (
                <div key={h.id} style={{
                  position:"absolute",
                  top:`${20 + i*28}px`, right:"-200px",
                  background:W.bg3,
                  border:`1px solid ${W.yellow}`,
                  borderLeft:`3px solid ${W.yellow}`,
                  borderRadius:"0 4px 4px 0",
                  padding:"4px 8px",
                  fontSize:"10px",
                  color:W.fgMuted,
                  maxWidth:"180px",
                  lineHeight:"1.4",
                  zIndex:10,
                }}>
                  <span style={{ color:W.yellow }}>▸</span> "{h.text.substring(0,30)}…"
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: Annotations panel */}
      <div style={{
        width:"280px", flexShrink:0,
        background:W.bg2, borderLeft:`1px solid ${W.splitBg}`,
        display:"flex", flexDirection:"column",
      }}>
        <div style={{
          padding:"8px 12px",
          borderBottom:`1px solid ${W.splitBg}`,
          background:W.statusBg,
          fontSize:"11px", color:W.statusFg,
          letterSpacing:"2px",
          display:"flex", alignItems:"center", gap:"8px",
        }}>
          <span>ANNOTATIES</span>
          <span style={{ background:W.blue, color:W.bg, borderRadius:"10px", padding:"0 6px", fontSize:"10px" }}>
            {highlights.length}
          </span>
        </div>

        <div style={{ flex:1, overflow:"auto" }}>
          {highlights.length === 0 ? (
            <div style={{
              padding:"24px 12px", color:W.fgMuted,
              fontSize:"11px", textAlign:"center", lineHeight:"1.8",
            }}>
              Selecteer tekst in de PDF<br/>om een annotatie te maken.
            </div>
          ) : highlights.map(h => (
            <div key={h.id} style={{
              borderBottom:`1px solid ${W.splitBg}`,
              padding:"10px 12px",
            }}>
              <div style={{
                fontSize:"11px", color:W.string,
                marginBottom:"4px",
                fontStyle:"italic",
                lineHeight:"1.5",
              }}>
                "{h.text.substring(0,100)}{h.text.length>100?"…":""}"
              </div>
              {h.note && (
                <div style={{
                  fontSize:"11px", color:W.fg,
                  background:W.bg3, borderRadius:"4px",
                  padding:"6px 8px", marginTop:"6px",
                  borderLeft:`2px solid ${W.yellow}`,
                  lineHeight:"1.5",
                }}>
                  {h.note}
                </div>
              )}
              <div style={{
                display:"flex", gap:"8px", marginTop:"6px",
                alignItems:"center",
              }}>
                <span style={{ fontSize:"10px", color:W.fgMuted }}>
                  p.{h.page} · {new Date(h.created).toLocaleDateString("nl-NL")}
                </span>
                <div style={{ flex:1 }} />
                <button
                  onClick={()=>removeHighlight(h.id)}
                  style={{
                    background:"none", border:"none",
                    color:W.orange, cursor:"pointer",
                    fontSize:"10px", fontFamily:"inherit",
                    padding:"0",
                  }}
                >:del</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Knowledge Graph ───────────────────────────────────────────────────────────
const Graph = ({ notes, pdfNotes, onSelect, selectedId }) => {
  const cvRef = useRef(null);
  const nodesRef = useRef([]);
  const afRef = useRef(null);
  const dragging = useRef(null);

  const build = useCallback(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const W2 = cv.clientWidth, H2 = cv.clientHeight;
    const all = [
      ...notes.map((n,i) => ({ id:n.id, title:n.title, links:extractLinks(n.content), type:"note" })),
      ...pdfNotes.slice(0,20).map((p,i) => ({ id:"pdf-"+p.id, title:"📄 "+p.text.substring(0,25), links:[], type:"pdf" })),
    ];
    nodesRef.current = all.map((n,i) => {
      const existing = nodesRef.current.find(x=>x.id===n.id);
      if (existing) return { ...existing, ...n };
      const angle = (i/all.length)*Math.PI*2;
      const r = Math.min(W2,H2)*0.28;
      return { ...n, x:W2/2+r*Math.cos(angle)+(Math.random()-0.5)*80, y:H2/2+r*Math.sin(angle)+(Math.random()-0.5)*80, vx:0, vy:0 };
    });
  }, [notes, pdfNotes]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio||1;
    const resize = () => {
      const p = cv.parentElement;
      cv.width = p.clientWidth*dpr; cv.height = p.clientHeight*dpr;
      cv.style.width = p.clientWidth+"px"; cv.style.height = p.clientHeight+"px";
      const ctx = cv.getContext("2d"); ctx.scale(dpr,dpr);
      build();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv.parentElement);
    return () => ro.disconnect();
  }, [build]);

  useEffect(() => { build(); }, [notes, pdfNotes, build]);

  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio||1;
    const CW = ()=>cv.width/dpr, CH=()=>cv.height/dpr;

    const tick = () => {
      const nodes = nodesRef.current;
      if (!nodes.length) { afRef.current=requestAnimationFrame(tick); return; }

      // Physics
      for(let i=0;i<nodes.length;i++){
        for(let j=i+1;j<nodes.length;j++){
          const dx=nodes[j].x-nodes[i].x, dy=nodes[j].y-nodes[i].y;
          const d=Math.sqrt(dx*dx+dy*dy)||1;
          const f=1800/(d*d);
          nodes[i].vx-=(dx/d)*f; nodes[i].vy-=(dy/d)*f;
          nodes[j].vx+=(dx/d)*f; nodes[j].vy+=(dy/d)*f;
        }
      }
      nodes.forEach(n => {
        n.links.forEach(lid => {
          const t=nodes.find(x=>x.id===lid); if(!t) return;
          const dx=t.x-n.x,dy=t.y-n.y,d=Math.sqrt(dx*dx+dy*dy)||1;
          const f=0.025*d;
          n.vx+=(dx/d)*f; n.vy+=(dy/d)*f;
          t.vx-=(dx/d)*f; t.vy-=(dy/d)*f;
        });
        if(n===dragging.current) return;
        n.vx+=(CW()/2-n.x)*0.0008; n.vy+=(CH()/2-n.y)*0.0008;
        n.vx*=0.82; n.vy*=0.82;
        n.x=Math.max(50,Math.min(CW()-50,n.x+n.vx));
        n.y=Math.max(36,Math.min(CH()-36,n.y+n.vy));
      });

      // Draw
      ctx.clearRect(0,0,CW(),CH());
      // Background
      ctx.fillStyle=W.bg; ctx.fillRect(0,0,CW(),CH());
      // Grid
      ctx.strokeStyle="rgba(255,255,255,0.03)"; ctx.lineWidth=1;
      for(let x=0;x<CW();x+=32){ ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,CH());ctx.stroke(); }
      for(let y=0;y<CH();y+=32){ ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(CW(),y);ctx.stroke(); }

      // Edges
      nodes.forEach(n => {
        n.links.forEach(lid => {
          const t=nodes.find(x=>x.id===lid); if(!t) return;
          const sel=n.id===selectedId||t.id===selectedId;
          ctx.beginPath(); ctx.moveTo(n.x,n.y); ctx.lineTo(t.x,t.y);
          ctx.strokeStyle=sel?W.blue:"rgba(136,198,242,0.18)";
          ctx.lineWidth=sel?2:1; ctx.stroke();
        });
      });

      // Nodes
      nodes.forEach(n => {
        const sel=n.id===selectedId;
        const r=8+n.links.length*3;
        if(sel){
          ctx.beginPath(); ctx.arc(n.x,n.y,r+8,0,Math.PI*2);
          const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,r+8);
          g.addColorStop(0,"rgba(234,231,136,0.35)"); g.addColorStop(1,"rgba(234,231,136,0)");
          ctx.fillStyle=g; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2);
        const col=n.type==="pdf"?W.orange:sel?W.yellow:W.keyword;
        ctx.fillStyle=col; ctx.fill();
        ctx.strokeStyle=sel?W.cursorBg:"rgba(140,198,242,0.3)";
        ctx.lineWidth=sel?2:1; ctx.stroke();
        // Label
        ctx.fillStyle=sel?W.statusFg:W.fgDim;
        ctx.font=`${sel?"bold ":""}11px 'Courier New'`;
        ctx.textAlign="center";
        const lbl=n.title.length>20?n.title.substring(0,18)+"…":n.title;
        ctx.fillText(lbl,n.x,n.y+r+13);
      });

      afRef.current=requestAnimationFrame(tick);
    };
    afRef.current=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(afRef.current);
  }, [notes, pdfNotes, selectedId]);

  const nodeAt=(x,y)=>nodesRef.current.find(n=>{
    const dx=n.x-x,dy=n.y-y,r=8+n.links.length*3;
    return Math.sqrt(dx*dx+dy*dy)<r+6;
  });

  return (
    <div style={{ position:"relative", width:"100%", height:"100%" }}>
      <canvas ref={cvRef}
        style={{ width:"100%", height:"100%", cursor:"crosshair" }}
        onMouseDown={e=>{
          const r=cvRef.current.getBoundingClientRect();
          const n=nodeAt(e.clientX-r.left,e.clientY-r.top);
          if(n){dragging.current=n;}
        }}
        onMouseMove={e=>{
          if(!dragging.current)return;
          const r=cvRef.current.getBoundingClientRect();
          dragging.current.x=e.clientX-r.left;
          dragging.current.y=e.clientY-r.top;
          dragging.current.vx=0; dragging.current.vy=0;
        }}
        onMouseUp={e=>{
          const r=cvRef.current.getBoundingClientRect();
          const n=nodeAt(e.clientX-r.left,e.clientY-r.top);
          if(n&&!n.id.startsWith("pdf-")) onSelect(n.id);
          dragging.current=null;
        }}
      />
      {/* Legend */}
      <div style={{
        position:"absolute", bottom:"16px", left:"50%", transform:"translateX(-50%)",
        background:"rgba(28,28,28,0.88)",
        border:`1px solid ${W.splitBg}`,
        borderRadius:"6px", padding:"6px 16px",
        fontSize:"10px", color:W.fgMuted,
        display:"flex", gap:"16px", backdropFilter:"blur(8px)",
        fontFamily:"'Courier New',monospace", letterSpacing:"0.5px",
      }}>
        <span><span style={{ color:W.yellow }}>●</span> geselecteerd</span>
        <span><span style={{ color:W.blue }}>●</span> notitie</span>
        <span><span style={{ color:W.orange }}>●</span> pdf-annotatie</span>
        <span style={{ color:W.splitBg }}>│</span>
        <span>klik = open · sleep = bewegen</span>
      </div>
    </div>
  );
};

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [notes, setNotes]           = useState(SEED);
  const [selId, setSelId]           = useState(SEED[0].id);
  const [vimMode, setVimMode]       = useState(false);
  const [editTitle, setEditTitle]   = useState("");
  const [editContent, setEditContent] = useState("");
  const [tab, setTab]               = useState("notes");
  const [search, setSearch]         = useState("");
  const [pdfNotes, setPdfNotes]     = useState([]);
  const [loaded, setLoaded]         = useState(false);

  // Persist
  useEffect(()=>{
    const load=async()=>{
      try{
        const r=await window.storage.get(NOTES_KEY);
        if(r?.value) setNotes(JSON.parse(r.value));
        const rp=await window.storage.get(PDFNOTES_KEY);
        if(rp?.value) setPdfNotes(JSON.parse(rp.value));
      } catch{}
      setLoaded(true);
    };
    load();
  },[]);

  useEffect(()=>{ if(!loaded)return; window.storage.set(NOTES_KEY,JSON.stringify(notes)).catch(()=>{}); },[notes,loaded]);
  useEffect(()=>{ if(!loaded)return; window.storage.set(PDFNOTES_KEY,JSON.stringify(pdfNotes)).catch(()=>{}); },[pdfNotes,loaded]);

  const selNote = notes.find(n=>n.id===selId);

  const filtered = useMemo(()=>{
    if(!search) return notes;
    const q=search.toLowerCase();
    return notes.filter(n=>n.title.toLowerCase().includes(q)||n.content.toLowerCase().includes(q)||n.tags?.some(t=>t.includes(q)));
  },[notes,search]);

  const newNote = () => {
    const id=genId();
    const n={ id, title:"Nieuw zettel", content:`# Nieuw zettel\n\n`, tags:[], created:new Date().toISOString(), modified:new Date().toISOString() };
    setNotes(p=>[n,...p]);
    setSelId(id);
    setEditTitle(n.title);
    setEditContent(n.content);
    setVimMode(true);
  };

  const openEdit = () => {
    if(!selNote)return;
    setEditTitle(selNote.title);
    setEditContent(selNote.content);
    setVimMode(true);
  };

  const save = () => {
    setNotes(prev=>prev.map(n=>n.id===selId?{
      ...n, title:editTitle, content:editContent,
      tags:extractTags(editContent),
      modified:new Date().toISOString(),
    }:n));
  };

  const closeEdit = () => setVimMode(false);

  const del = () => {
    if(!selNote||!window.confirm("Verwijder dit zettel?")) return;
    const rest=notes.filter(n=>n.id!==selId);
    setNotes(rest);
    setSelId(rest[0]?.id||null);
    setVimMode(false);
  };

  const backlinks = useMemo(()=>{
    if(!selId) return [];
    return notes.filter(n=>extractLinks(n.content).includes(selId));
  },[notes,selId]);

  const handleLink = e => {
    const el=e.target.closest(".zlink");
    if(!el) return;
    const id=el.dataset.id;
    const n=notes.find(x=>x.id===id||x.title===id);
    if(n) setSelId(n.id);
  };

  return (
    <div style={{
      display:"flex", flexDirection:"column", height:"100vh",
      background:W.bg, color:W.fg,
      fontFamily:"'Courier New',Courier,monospace",
      overflow:"hidden",
    }}>

      {/* ── Top bar (VIM-style status) ── */}
      <div style={{
        height:"40px", background:W.statusBg,
        borderBottom:`1px solid ${W.splitBg}`,
        display:"flex", alignItems:"center",
        padding:"0 0 0 12px", gap:"0", flexShrink:0,
      }}>
        {/* Mode indicator block */}
        <div style={{
          background:W.blue, color:W.bg,
          padding:"0 14px", height:"100%",
          display:"flex", alignItems:"center",
          fontWeight:"bold", fontSize:"12px",
          letterSpacing:"2px",
        }}>
          ZETTELKASTEN
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", height:"100%" }}>
          {[
            { id:"notes", label:"notities" },
            { id:"graph", label:"graaf" },
            { id:"pdf",   label:"pdf" },
          ].map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              background: tab===t.id ? W.bg : "transparent",
              color: tab===t.id ? W.statusFg : W.fgMuted,
              border:"none",
              borderRight:`1px solid ${W.splitBg}`,
              padding:"0 18px",
              fontSize:"12px", fontFamily:"inherit",
              cursor:"pointer", letterSpacing:"1px",
              borderBottom: tab===t.id ? `2px solid ${W.yellow}` : "2px solid transparent",
            }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex:1 }} />

        <div style={{ padding:"0 12px", fontSize:"11px", color:W.fgMuted, display:"flex", gap:"16px" }}>
          <span>{notes.length} zettels</span>
          <span>{pdfNotes.length} annotaties</span>
        </div>
      </div>

      {/* ── Content ── */}
      {tab==="graph" ? (
        <div style={{ flex:1, overflow:"hidden" }}>
          <Graph notes={notes} pdfNotes={pdfNotes} onSelect={id=>{setSelId(id);setTab("notes");}} selectedId={selId} />
        </div>
      ) : tab==="pdf" ? (
        <div style={{ flex:1, overflow:"hidden" }}>
          <PDFViewer pdfNotes={pdfNotes} setPdfNotes={setPdfNotes} />
        </div>
      ) : (
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* ── Sidebar ── */}
          <div style={{
            width:"224px", flexShrink:0,
            background:W.bg2, borderRight:`1px solid ${W.splitBg}`,
            display:"flex", flexDirection:"column",
          }}>
            <div style={{
              padding:"8px",
              borderBottom:`1px solid ${W.splitBg}`,
              background:W.statusBg,
              display:"flex", flexDirection:"column", gap:"6px",
            }}>
              <button onClick={newNote} style={{
                background:W.blue, color:W.bg,
                border:"none", borderRadius:"4px",
                padding:"6px", fontSize:"11px",
                fontFamily:"inherit", cursor:"pointer",
                fontWeight:"bold", letterSpacing:"1px",
              }}>:new zettel</button>
              <input
                value={search}
                onChange={e=>setSearch(e.target.value)}
                placeholder="/zoeken…"
                style={{
                  background:W.bg, border:`1px solid ${W.splitBg}`,
                  borderRadius:"4px", padding:"5px 8px",
                  color:W.fg, fontSize:"12px",
                  fontFamily:"inherit", outline:"none", width:"100%",
                  boxSizing:"border-box",
                }}
              />
            </div>

            <div style={{ flex:1, overflow:"auto" }}>
              {filtered.map(n=>{
                const sel=n.id===selId;
                return (
                  <div key={n.id}
                    onClick={()=>{ setSelId(n.id); setVimMode(false); }}
                    style={{
                      padding:"8px 10px",
                      borderBottom:`1px solid ${W.splitBg}`,
                      cursor:"pointer",
                      background:sel?W.visualBg:"transparent",
                      borderLeft:`3px solid ${sel?W.yellow:"transparent"}`,
                    }}
                  >
                    <div style={{ fontSize:"12px", color:sel?W.statusFg:W.fg, lineHeight:"1.3", marginBottom:"2px" }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize:"10px", color:W.fgMuted }}>
                      {n.id.substring(0,12)}
                    </div>
                    {n.tags?.length>0 && (
                      <div style={{ marginTop:"3px", display:"flex", flexWrap:"wrap", gap:"3px" }}>
                        {n.tags.slice(0,3).map(t=>(
                          <span key={t} style={{
                            fontSize:"9px", background:"rgba(159,202,86,0.15)",
                            color:W.comment, padding:"1px 4px",
                            borderRadius:"3px", border:`1px solid rgba(159,202,86,0.2)`,
                          }}># {t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Main area ── */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            {selNote ? (
              vimMode ? (
                /* VIM editor */
                <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
                  {/* Title bar */}
                  <div style={{
                    background:W.bg2, borderBottom:`1px solid ${W.splitBg}`,
                    padding:"6px 12px", display:"flex", alignItems:"center", gap:"8px", flexShrink:0,
                  }}>
                    <input
                      value={editTitle}
                      onChange={e=>setEditTitle(e.target.value)}
                      placeholder="Titel…"
                      style={{
                        flex:1, background:"transparent", border:"none",
                        color:W.statusFg, fontSize:"15px",
                        fontFamily:"inherit", fontWeight:"bold",
                        outline:"none",
                      }}
                    />
                    <button onClick={()=>{save();closeEdit();}} style={{
                      background:W.comment, color:W.bg,
                      border:"none", borderRadius:"4px",
                      padding:"4px 12px", fontSize:"11px",
                      fontFamily:"inherit", cursor:"pointer", fontWeight:"bold",
                    }}>:wq</button>
                    <button onClick={closeEdit} style={{
                      background:"none", color:W.fgMuted,
                      border:`1px solid ${W.splitBg}`, borderRadius:"4px",
                      padding:"4px 10px", fontSize:"11px",
                      fontFamily:"inherit", cursor:"pointer",
                    }}>:q</button>
                    <button onClick={del} style={{
                      background:"none", color:W.orange,
                      border:`1px solid rgba(229,120,109,0.3)`, borderRadius:"4px",
                      padding:"4px 10px", fontSize:"11px",
                      fontFamily:"inherit", cursor:"pointer",
                    }}>:del</button>
                  </div>

                  <VimEditor
                    value={editContent}
                    onChange={setEditContent}
                    onSave={save}
                    onEscape={closeEdit}
                  />
                </div>
              ) : (
                /* Preview */
                <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
                  <div style={{ flex:1, overflow:"auto", padding:"24px 32px" }}>
                    {/* Toolbar */}
                    <div style={{
                      display:"flex", gap:"8px", marginBottom:"20px",
                      paddingBottom:"12px", borderBottom:`1px solid ${W.splitBg}`,
                      alignItems:"center",
                    }}>
                      <span style={{ fontSize:"11px", color:W.fgMuted }}>{selNote.id}</span>
                      <div style={{ flex:1 }} />
                      <button onClick={openEdit} style={{
                        background:"none", color:W.blue,
                        border:`1px solid rgba(138,198,242,0.3)`, borderRadius:"4px",
                        padding:"4px 12px", fontSize:"11px",
                        fontFamily:"inherit", cursor:"pointer",
                      }}>i — bewerken</button>
                      <button onClick={del} style={{
                        background:"none", color:W.orange,
                        border:`1px solid rgba(229,120,109,0.2)`, borderRadius:"4px",
                        padding:"4px 10px", fontSize:"11px",
                        fontFamily:"inherit", cursor:"pointer",
                      }}>:del</button>
                    </div>

                    {/* Rendered markdown */}
                    <div className="mdv" dangerouslySetInnerHTML={{ __html:renderMd(selNote.content,notes) }} onClick={handleLink} />

                    {/* Backlinks */}
                    {backlinks.length>0 && (
                      <div style={{ marginTop:"40px", paddingTop:"16px", borderTop:`1px solid ${W.splitBg}` }}>
                        <div style={{ fontSize:"10px", color:W.fgMuted, letterSpacing:"2px", marginBottom:"10px" }}>BACKLINKS</div>
                        {backlinks.map(n=>(
                          <div key={n.id} onClick={()=>setSelId(n.id)}
                            style={{
                              padding:"6px 10px", cursor:"pointer",
                              background:"rgba(138,198,242,0.07)",
                              border:`1px solid rgba(138,198,242,0.15)`,
                              borderRadius:"4px", marginBottom:"6px",
                              fontSize:"12px", color:W.keyword,
                            }}
                          >
                            ← {n.title} <span style={{ color:W.fgMuted, fontSize:"10px" }}>{n.id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Meta sidebar */}
                  <div style={{
                    width:"180px", flexShrink:0,
                    background:W.bg2, borderLeft:`1px solid ${W.splitBg}`,
                    padding:"16px 12px",
                    fontSize:"11px", overflow:"auto",
                  }}>
                    <div style={{ color:W.fgMuted, letterSpacing:"1px", fontSize:"9px", marginBottom:"4px", textTransform:"uppercase" }}>ID</div>
                    <div style={{ color:W.comment, wordBreak:"break-all", marginBottom:"14px", fontSize:"10px" }}>{selNote.id}</div>

                    {selNote.tags?.length>0 && (<>
                      <div style={{ color:W.fgMuted, letterSpacing:"1px", fontSize:"9px", marginBottom:"6px", textTransform:"uppercase" }}>Tags</div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"4px", marginBottom:"14px" }}>
                        {selNote.tags.map(t=>(
                          <span key={t} style={{
                            fontSize:"10px", background:"rgba(159,202,86,0.12)",
                            color:W.comment, padding:"2px 6px",
                            borderRadius:"3px", border:`1px solid rgba(159,202,86,0.2)`,
                          }}>#{t}</span>
                        ))}
                      </div>
                    </>)}

                    {extractLinks(selNote.content).length>0 && (<>
                      <div style={{ color:W.fgMuted, letterSpacing:"1px", fontSize:"9px", marginBottom:"6px", textTransform:"uppercase" }}>Links →</div>
                      {extractLinks(selNote.content).map(id=>{
                        const n=notes.find(x=>x.id===id);
                        return (
                          <div key={id} onClick={()=>n&&setSelId(n.id)}
                            style={{
                              fontSize:"10px", color:n?W.keyword:W.fgMuted,
                              cursor:n?"pointer":"default",
                              padding:"3px 0",
                              borderBottom:`1px solid ${W.splitBg}`,
                              marginBottom:"2px",
                            }}
                          >→ {n?n.title:id}</div>
                        );
                      })}
                    </>)}

                    <div style={{ marginTop:"14px", color:W.fgMuted, fontSize:"9px", letterSpacing:"1px", textTransform:"uppercase", marginBottom:"4px" }}>Gewijzigd</div>
                    <div style={{ fontSize:"10px", color:W.fgDim }}>{new Date(selNote.modified).toLocaleString("nl-NL")}</div>
                  </div>
                </div>
              )
            ) : (
              <div style={{
                flex:1, display:"flex", alignItems:"center", justifyContent:"center",
                color:W.fgMuted, fontSize:"13px",
              }}>
                Selecteer een zettel
              </div>
            )}
          </div>
        </div>
      )}

      {/* Global styles */}
      <style>{`
        .mdv h1 { font-size:20px; color:${W.statusFg}; margin:0 0 14px; border-bottom:1px solid ${W.splitBg}; padding-bottom:6px; font-family:inherit; }
        .mdv h2 { font-size:16px; color:${W.string}; margin:18px 0 8px; font-family:inherit; }
        .mdv h3 { font-size:13px; color:${W.fg}; margin:14px 0 6px; font-family:inherit; }
        .mdv p  { color:${W.fg}; line-height:1.85; margin:0 0 10px; font-size:13px; }
        .mdv ul { padding-left:20px; margin:6px 0 10px; }
        .mdv li { color:${W.fg}; line-height:1.8; font-size:13px; margin-bottom:3px; }
        .mdv strong { color:${W.statusFg}; }
        .mdv em { color:${W.fgDim}; font-style:italic; }
        .mdv code { background:rgba(255,255,255,0.07); padding:1px 5px; border-radius:3px; font-family:'Courier New',monospace; font-size:12px; color:${W.string}; }
        .zlink { color:${W.keyword}; cursor:pointer; text-decoration:underline; text-decoration-color:rgba(138,198,242,0.4); font-size:13px; }
        .zlink:hover { color:${W.statusFg}; }
        .taghl { color:${W.comment}; font-size:13px; }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:${W.splitBg}; border-radius:3px; }
        ::-webkit-scrollbar-thumb:hover { background:${W.statusBg}; }
        textarea::placeholder, input::placeholder { color:${W.fgMuted}; }
        * { box-sizing:border-box; }
      `}</style>
    </div>
  );
}
