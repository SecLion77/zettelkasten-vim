// ─── WOMBAT COLOR SCHEME ────────────────────────────────────────────────────────
const W = {
  bg:"#242424",bg2:"#1c1c1c",bg3:"#2d2d2d",
  statusBg:"#444444",visualBg:"#554d4b",cursorBg:"#eae788",
  splitBg:"#3a4046",lineNrBg:"#303030",
  fg:"#e3e0d7",fgMuted:"#857b6f",fgDim:"#a0a8b0",
  statusFg:"#ffffd7",
  comment:"#9fca56",string:"#cae682",keyword:"#8ac6f2",
  type:"#92b5dc",special:"#e5786d",
  orange:"#e5786d",purple:"#d787ff",green:"#9fca56",
  yellow:"#eae788",blue:"#8ac6f2",
};

const HCOLORS = [
  {id:"yellow",label:"Geel",  bg:"rgba(234,231,136,0.45)",border:"#eae788"},
  {id:"green", label:"Groen", bg:"rgba(159,202,86,0.40)", border:"#9fca56"},
  {id:"blue",  label:"Blauw", bg:"rgba(138,198,242,0.40)",border:"#8ac6f2"},
  {id:"orange",label:"Oranje",bg:"rgba(229,120,109,0.40)",border:"#e5786d"},
  {id:"purple",label:"Paars", bg:"rgba(215,135,255,0.40)",border:"#d787ff"},
];

// ── Markdown snippets (UltiSnips-stijl, geactiveerd met Tab) ──────────────────
const MD_SNIPPETS = {
  "h1":    "# ${1:Titel}\n\n${0}",
  "h2":    "## ${1:Sectie}\n\n${0}",
  "h3":    "### ${1:Subsectie}\n\n${0}",
  "link":  "[[${1:notitie}]]${0}",
  "tag":   "#${1:tag} ${0}",
  "code":  "```${1:taal}\n${2:code}\n```\n${0}",
  "table": "| ${1:Kolom 1} | ${2:Kolom 2} |\n|---|---|\n| ${3:} | ${4:} |\n${0}",
  "quote": "> ${1:citaat}\n\n${0}",
  "todo":  "- [ ] ${1:taak}\n${0}",
  "date":  new Date().toISOString().slice(0,10),
  "id":    () => genId(),
  "hr":    "---\n\n${0}",
  "bold":  "**${1:tekst}**${0}",
  "em":    "*${1:tekst}*${0}",
};

// Auto-bracket pairs (uit vimrc: inoremap ( ()<esc>i etc.)
const AUTO_PAIRS = {"(":")", "[":"]", "{":"}", '"':'"', "'":"'"};

// ── API ────────────────────────────────────────────────────────────────────────
// Relatief pad: werkt altijd ongeacht poort of OS
const API = "/api";

const api = {
  async get(path)        { const r=await fetch(API+path); return r.json(); },
  async post(path,body)  { const r=await fetch(API+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); return r.json(); },
  async put(path,body)   { const r=await fetch(API+path,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); return r.json(); },
  async del(path)        { const r=await fetch(API+path,{method:"DELETE"}); return r.json(); },
  async uploadPdf(file)  {
    const fd=new FormData(); fd.append("file",file,file.name);
    const r=await fetch(API+"/pdfs",{method:"POST",body:fd});
    return r.json();
  },
  async fetchPdfBlob(name) {
    const r=await fetch(API+"/pdf/"+encodeURIComponent(name));
    return r.arrayBuffer();
  },
};

// ── Utils ──────────────────────────────────────────────────────────────────────
const genId = () => {
  const n=new Date();
  return [n.getFullYear(),String(n.getMonth()+1).padStart(2,"0"),
    String(n.getDate()).padStart(2,"0"),String(n.getHours()).padStart(2,"0"),
    String(n.getMinutes()).padStart(2,"0"),String(n.getSeconds()).padStart(2,"0"),
    String(Math.floor(Math.random()*99)).padStart(2,"0")].join("");
};
const extractLinks = (c="")=>[...new Set([...c.matchAll(/\[\[([^\]]+)\]\]/g)].map(m=>m[1]))];
const extractTags  = (c="")=>[...new Set([...c.matchAll(/#(\w+)/g)].map(m=>m[1]))];

// ── Enhanced Markdown renderer ─────────────────────────────────────────────────
const renderMd = (text, notes=[]) => {
  if (!text) return "";
  let h = text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  // Code blocks first (prevent interference)
  const codeBlocks = [];
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const i = codeBlocks.length;
    codeBlocks.push(`<pre><code class="lang-${lang}">${code}</code></pre>`);
    return `%%CODE${i}%%`;
  });

  // Tables
  h = h.replace(/(\|.+\|\n)+/g, tableStr => {
    const rows = tableStr.trim().split("\n");
    if (rows.length < 2) return tableStr;
    const header = rows[0].split("|").filter(Boolean).map(c=>`<th>${c.trim()}</th>`).join("");
    const body   = rows.slice(2).map(r=>`<tr>${r.split("|").filter(Boolean).map(c=>`<td>${c.trim()}</td>`).join("")}</tr>`).join("");
    return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  });

  // Blockquotes
  h = h.replace(/^&gt;\s(.+)$/gm, "<blockquote>$1</blockquote>");
  h = h.replace(/<\/blockquote>\n<blockquote>/g, "\n");

  // Headings
  h = h.replace(/^#{1}\s(.+)$/gm,"<h1>$1</h1>");
  h = h.replace(/^#{2}\s(.+)$/gm,"<h2>$1</h2>");
  h = h.replace(/^#{3}\s(.+)$/gm,"<h3>$1</h3>");

  // HR
  h = h.replace(/^---$/gm,"<hr>");

  // Inline formatting
  h = h.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  h = h.replace(/\*(.+?)\*/g,"<em>$1</em>");
  h = h.replace(/`(.+?)`/g,"<code>$1</code>");
  h = h.replace(/~~(.+?)~~/g,"<del>$1</del>");

  // Checkboxes
  h = h.replace(/^- \[ \] (.+)$/gm,'<li class="todo">☐ $1</li>');
  h = h.replace(/^- \[x\] (.+)$/gm,'<li class="todo done">☑ $1</li>');

  // Lists
  h = h.replace(/^[-*] (.+)$/gm,"<li>$1</li>");
  h = h.replace(/^\d+\. (.+)$/gm,"<li>$1</li>");
  h = h.replace(/(<li>[\s\S]*?<\/li>\n?)+/g,"<ul>$&</ul>");

  // Zettelkasten links
  h = h.replace(/\[\[([^\]]+)\]\]/g,(_,id)=>{
    const n=notes.find(x=>x.id===id||x.title===id);
    return `<span class="zlink" data-id="${id}">${n?n.title:id}</span>`;
  });

  // Tags
  h = h.replace(/#(\w+)/g,'<span class="taghl">#$1</span>');

  // Restore code blocks
  codeBlocks.forEach((blk,i) => { h=h.replace(`%%CODE${i}%%`,blk); });

  // Paragraphs
  return h.split(/\n\n+/).map(b=>{
    if (/^<(h[123]|ul|ol|li|table|pre|blockquote|hr)/.test(b)) return b;
    return `<p>${b.replace(/\n/g,"<br>")}</p>`;
  }).join("\n");
};

// ── Tag Pill ───────────────────────────────────────────────────────────────────
const TagPill = ({tag, onRemove, small, onClick}) => (
  React.createElement("span",{
    onClick:onClick,
    style:{
      display:"inline-flex",alignItems:"center",gap:"3px",
      background:`rgba(159,202,86,${small?0.12:0.15})`,
      color:W.comment,border:`1px solid rgba(159,202,86,${small?0.25:0.35})`,
      borderRadius:"3px",padding:small?"0 4px":"1px 6px",
      fontSize:small?"9px":"10px",cursor:onClick?"pointer":"default",
      userSelect:"none",
    }
  },
    "#"+tag,
    onRemove && React.createElement("span",{
      onClick:e=>{e.stopPropagation();onRemove(tag);},
      style:{cursor:"pointer",color:W.fgMuted,marginLeft:"1px",fontSize:"11px",lineHeight:1}
    },"×")
  )
);

// ── Tag Editor ─────────────────────────────────────────────────────────────────
const TagEditor = ({tags=[], onChange, allTags=[]}) => {
  const [input,setInput] = React.useState("");
  const [open, setOpen]  = React.useState(false);
  const inputRef = React.useRef(null);

  const suggestions = allTags
    .filter(t=>t.toLowerCase().includes(input.toLowerCase())&&!tags.includes(t))
    .slice(0,8);

  const add = (t) => {
    t = t.trim().replace(/^#/,"").replace(/\s+/g,"_");
    if (t && !tags.includes(t)) onChange([...tags,t]);
    setInput(""); setOpen(false);
  };

  const onKey = (e) => {
    if (["Enter","Tab",","," "].includes(e.key)) { e.preventDefault(); if(input) add(input); }
    else if (e.key==="Backspace" && !input && tags.length) onChange(tags.slice(0,-1));
    else if (e.key==="Escape") setOpen(false);
  };

  return React.createElement("div",{style:{position:"relative"}},
    React.createElement("div",{
      style:{display:"flex",flexWrap:"wrap",gap:"3px",padding:"4px 6px",
        background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"4px",
        cursor:"text",minHeight:"28px"},
      onClick:()=>inputRef.current?.focus()
    },
      ...tags.map(t=>React.createElement(TagPill,{key:t,tag:t,onRemove:t=>onChange(tags.filter(x=>x!==t)),small:true})),
      React.createElement("input",{
        ref:inputRef,value:input,
        onChange:e=>{setInput(e.target.value);setOpen(true);},
        onKeyDown:onKey,onFocus:()=>setOpen(true),
        onBlur:()=>setTimeout(()=>setOpen(false),150),
        placeholder:tags.length?"":"tag toevoegen…",
        style:{border:"none",background:"transparent",outline:"none",
          fontSize:"10px",color:W.fg,minWidth:"80px",flex:1}
      })
    ),
    open && (suggestions.length>0||input) && React.createElement("div",{
      style:{position:"absolute",top:"100%",left:0,right:0,background:W.bg3,
        border:`1px solid ${W.splitBg}`,borderRadius:"4px",zIndex:200,
        boxShadow:"0 4px 16px rgba(0,0,0,0.5)",marginTop:"2px",overflow:"hidden"}
    },
      input && React.createElement("div",{
        onMouseDown:e=>{e.preventDefault();add(input);},
        style:{padding:"5px 10px",fontSize:"10px",color:W.blue,cursor:"pointer",
          borderBottom:`1px solid ${W.splitBg}`}
      },"+ \"",input,"\" toevoegen"),
      ...suggestions.map(t=>React.createElement("div",{
        key:t,onMouseDown:e=>{e.preventDefault();add(t);},
        style:{padding:"4px 10px",fontSize:"10px",color:W.fg,cursor:"pointer"}
      },"#"+t))
    )
  );
};

// ── VIM Editor met Pencil+Goyo+snippets features ───────────────────────────────
const { useState, useEffect, useRef, useCallback, useMemo } = React;


// ── Canvas-gebaseerde VIM Editor ───────────────────────────────────────────────
// Geen <textarea>: volledige controle over keyboard, cursor en rendering.
// Features:
//   • Escape werkt altijd — browser kan het niet meer onderscheppen
//   • Cursor-kruis: cursorline (horizontaal) + cursorcolumn (vertikaal)
//   • Regelnum­mers perfect uitgelijnd met canvas
//   • Wombat kleurschema, syntax-highlighting
//   • VIM modes: NORMAL / INSERT / COMMAND / SEARCH
//   • Snippets, auto-pairs, undo/redo, zoeken

const FONT_SIZE = 13;
const LINE_H    = 22;   // vaste regelhoogte in pixels
const PAD_LEFT  = 8;    // tekst-padding links van content

const VimEditor = ({value, onChange, onSave, onEscape, noteTags=[], onTagsChange,
                    allTags=[], goyoMode=false, onToggleGoyo, onEditorRef}) => {

  const { useState, useEffect, useRef, useCallback } = React;

  // ── React state (alleen voor re-render van statusbalk/tags) ────────────────
  const [mode,     setModeState] = useState("INSERT");
  const [cmdBuf,   setCmdBuf]    = useState("");
  const [statusMsg,setStatus]    = useState("");
  const [spellLang,setSpell]     = useState("off");
  const spellCycle = ["off","en","nl"];

  // ── Alle editor-staat in één ref → nooit stale in event-handlers ──────────
  const S = useRef({
    lines:     value.split("\n"),
    cur:       {row:0, col:0},  // cursor positie
    scroll:    0,               // eerste zichtbare regel
    mode:      "INSERT",
    cmdBuf:    "",
    undo:      [value.split("\n")],
    undoIdx:   0,
    yank:      "",
    search:    "",
    matches:   [],
    matchIdx:  0,
    charW:     7.8,             // wordt gemeten na mount
    numCols:   4,               // breedte regelnummer-kolom (in tekens)
    visRows:   30,
    selecting: false,
    selA:      null,
    selB:      null,
  });

  const cvRef      = useRef(null);  // canvas
  const inputRef   = useRef(null);  // onzichtbaar <input> voor toetsafvang
  const rafRef     = useRef(null);
  const blinkRef   = useRef(null);
  const blinkOn    = useRef(true);
  const undoTimer  = useRef(null);
  const prevValue  = useRef(value);

  // ── setMode: update zowel ref als React state ─────────────────────────────
  const setMode = useCallback((m) => {
    S.current.mode = m;
    setModeState(m);
    blinkOn.current = true;
  }, []);

  // ── Externe value sync ────────────────────────────────────────────────────
  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      S.current.lines = value.split("\n");
      clamp();
      draw();
    }
  }, [value]);

  // Geef inputRef door zodat parent kan focussen
  useEffect(() => {
    if (onEditorRef) onEditorRef(inputRef.current);
  }, [onEditorRef]);

  // ── Canvas setup & resize ─────────────────────────────────────────────────
  useEffect(() => {
    const cv  = cvRef.current;
    const inp = inputRef.current;
    if (!cv) return;

    // Meet exacte tekenbreedte met Hack font
    const ctx = cv.getContext("2d");
    ctx.font  = `${FONT_SIZE}px 'Hack','Courier New',monospace`;
    S.current.charW = ctx.measureText("M").width;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const pw  = cv.parentElement.clientWidth;
      const ph  = cv.parentElement.clientHeight;
      cv.width  = pw * dpr;
      cv.height = ph * dpr;
      cv.style.width  = pw + "px";
      cv.style.height = ph + "px";
      ctx.scale(dpr, dpr);
      // herbereken numCols op basis van regelaantal
      const s = S.current;
      s.numCols  = String(s.lines.length).length + 1;
      s.visRows  = Math.floor((ph - LINE_H) / LINE_H); // -1 voor statusbalk
      draw();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv.parentElement);

    // Knipperende cursor — 530ms zoals vim default
    blinkRef.current = setInterval(() => {
      blinkOn.current = !blinkOn.current;
      draw();
    }, 530);

    // Muisklik → cursor plaatsen + focus
    const onMouseDown = (e) => {
      const r   = cv.getBoundingClientRect();
      const s   = S.current;
      const cw  = s.charW;
      const nw  = (s.numCols + 1) * cw + PAD_LEFT; // breedte regelnummer-gebied
      const row = Math.min(s.lines.length - 1,
                  Math.max(0, Math.floor((e.clientY - r.top) / LINE_H) + s.scroll));
      const col = Math.min(s.lines[row].length,
                  Math.max(0, Math.round((e.clientX - r.left - nw) / cw)));
      s.cur = {row, col};
      setMode("INSERT");
      scrollToCursor(s);
      inp.focus();
      draw();
    };
    cv.addEventListener("mousedown", onMouseDown);

    // Touch support (iPad/iPhone)
    const onTouchStart = (e) => {
      e.preventDefault(); // voorkom browser scroll tijdens editen
      const t   = e.touches[0];
      const r   = cv.getBoundingClientRect();
      const s   = S.current;
      const cw  = s.charW;
      const nw  = numColsWidth(s);
      const row = Math.min(s.lines.length-1,
                  Math.max(0, Math.floor((t.clientY-r.top)/LINE_H)+s.scroll));
      const col = Math.min(s.lines[row].length,
                  Math.max(0, Math.round((t.clientX-r.left-nw)/cw)));
      s.cur = {row,col};
      setMode("INSERT");
      scrollToCursor(s);
      inputRef.current?.focus();
      draw();
    };
    cv.addEventListener("touchstart", onTouchStart, {passive:false});

    return () => {
      ro.disconnect();
      clearInterval(blinkRef.current);
      cancelAnimationFrame(rafRef.current);
      cv.removeEventListener("mousedown", onMouseDown);
      cv.removeEventListener("touchstart", onTouchStart);
    };
  }, []);

  // ── Hulpfuncties ──────────────────────────────────────────────────────────
  const clamp = () => {
    const s = S.current;
    s.cur.row = Math.max(0, Math.min(s.lines.length - 1, s.cur.row));
    s.cur.col = Math.max(0, Math.min(s.lines[s.cur.row].length, s.cur.col));
  };

  const scrollToCursor = (s) => {
    if (s.cur.row < s.scroll) s.scroll = s.cur.row;
    if (s.cur.row >= s.scroll + s.visRows) s.scroll = s.cur.row - s.visRows + 1;
    s.scroll = Math.max(0, s.scroll);
  };

  const emit = (s) => {
    const v = s.lines.join("\n");
    prevValue.current = v;
    onChange(v);
  };

  const pushUndo = (s) => {
    const cut = s.undo.slice(0, s.undoIdx + 1);
    cut.push(s.lines.slice());
    s.undo    = cut;
    s.undoIdx = cut.length - 1;
  };

  const scheduleUndo = (s) => {
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => pushUndo(s), 600);
  };

  const insertChar = (s, ch) => {
    const {row, col} = s.cur;
    s.lines[row] = s.lines[row].slice(0, col) + ch + s.lines[row].slice(col);
    s.cur.col += ch.length;
  };

  const numColsWidth = (s) => (s.numCols + 1) * s.charW + PAD_LEFT;

  // ── Zoeken ────────────────────────────────────────────────────────────────
  const buildMatches = (s, term) => {
    s.search   = term;
    s.matches  = [];
    s.matchIdx = 0;
    if (!term) return;
    s.lines.forEach((line, r) => {
      let i = 0;
      while ((i = line.indexOf(term, i)) >= 0) {
        s.matches.push({row: r, col: i});
        i += term.length;
      }
    });
  };

  const jumpMatch = (s, dir) => {
    if (!s.matches.length) return;
    s.matchIdx = ((s.matchIdx + dir) + s.matches.length) % s.matches.length;
    const m = s.matches[s.matchIdx];
    s.cur = {row: m.row, col: m.col};
    scrollToCursor(s);
  };

  // ── Snippets ──────────────────────────────────────────────────────────────
  const expandSnippet = (s) => {
    const {row, col} = s.cur;
    const before = s.lines[row].slice(0, col);
    const word   = before.split(/[\s]/).pop();
    if (!word) return false;
    let tmpl = MD_SNIPPETS[word];
    if (!tmpl) return false;
    if (typeof tmpl === "function") tmpl = tmpl();
    const expanded = tmpl.replace(/\$\{?\d+:?([^}]*)\}?/g, "$1").replace(/\$0/g, "");
    const expLines = expanded.split("\n");
    s.lines[row] = before.slice(0, -word.length) + expLines[0] + s.lines[row].slice(col);
    if (expLines.length > 1) {
      s.lines.splice(row + 1, 0, ...expLines.slice(1));
      s.cur.row += expLines.length - 1;
      s.cur.col  = expLines[expLines.length - 1].length;
    } else {
      s.cur.col = col - word.length + expLines[0].length;
    }
    setStatus(`snippet: ${word}`);
    scheduleUndo(s);
    emit(s);
    scrollToCursor(s);
    return true;
  };

  // ── Command uitvoeren ─────────────────────────────────────────────────────
  const runCmd = useCallback((s, cmd) => {
    cmd = cmd.trim();
    if (/^tag\+/.test(cmd))  { const t=cmd.replace(/^tag\+\s*/,"").replace(/^#/,"").trim(); if(t) onTagsChange([...new Set([...noteTags,t])]); setStatus(`+tag: ${t}`); return; }
    if (/^tag-/.test(cmd))   { const t=cmd.replace(/^tag-\s*/,"").replace(/^#/,"").trim(); onTagsChange(noteTags.filter(x=>x!==t)); setStatus(`-tag: ${t}`); return; }
    if (/^tag\s/.test(cmd))  { const ts=cmd.slice(4).split(/[\s,]+/).map(t=>t.replace(/^#/,"")).filter(Boolean); onTagsChange([...new Set(ts)]); setStatus("tags: "+ts.join(" ")); return; }
    if (cmd==="tags")         { setStatus("tags: "+noteTags.join(" ")); return; }
    if (cmd==="retag")        { const ts=[...new Set([...noteTags,...extractTags(s.lines.join("\n"))])]; onTagsChange(ts); setStatus("retag: "+ts.join(" ")); return; }
    if (cmd==="w")            { onSave(); setStatus("opgeslagen ✓"); return; }
    if (cmd==="wq")           { onSave(); onEscape(); return; }
    if (cmd==="q!")           { onEscape(); return; }
    if (cmd==="goyo")         { onToggleGoyo?.(); return; }
    if (cmd==="spell"||cmd==="sp") { const i=(spellCycle.indexOf(spellLang)+1)%3; setSpell(spellCycle[i]); setStatus(`spell: ${spellCycle[i]}`); return; }
    if (cmd==="wrap")         { setStatus("wrap: aan (standaard)"); return; }
    setStatus(`onbekend: :${cmd}`);
  }, [noteTags, onTagsChange, onSave, onEscape, onToggleGoyo, spellLang]);

  // ── Keyboard handler — ALLES hier, geen browser-escape meer ──────────────
  const handleKey = useCallback((e) => {
    const s = S.current;
    const m = s.mode;

    // ────────────────────────── INSERT ──────────────────────────────────────
    if (m === "INSERT") {
      // Escape — altijd onderscheppen, preventDefault, eigen afhandeling
      if (e.key === "Escape") {
        e.preventDefault();
        setMode("NORMAL");
        setStatus("");
        draw();
        return;
      }

      if (e.ctrlKey && e.key === "s") { e.preventDefault(); onSave(); setStatus("opgeslagen ✓"); draw(); return; }
      if (e.ctrlKey && e.key === "j") { e.preventDefault(); if (!expandSnippet(s)) setStatus("geen snippet"); draw(); return; }

      // Pijltjes
      if (e.key === "ArrowLeft")  { e.preventDefault(); s.cur.col = Math.max(0, s.cur.col-1); scrollToCursor(s); draw(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); s.cur.col = Math.min(s.lines[s.cur.row].length, s.cur.col+1); scrollToCursor(s); draw(); return; }
      if (e.key === "ArrowUp")    { e.preventDefault(); if(s.cur.row>0){s.cur.row--;s.cur.col=Math.min(s.cur.col,s.lines[s.cur.row].length);} scrollToCursor(s); draw(); return; }
      if (e.key === "ArrowDown")  { e.preventDefault(); if(s.cur.row<s.lines.length-1){s.cur.row++;s.cur.col=Math.min(s.cur.col,s.lines[s.cur.row].length);} scrollToCursor(s); draw(); return; }
      if (e.key === "Home")       { e.preventDefault(); s.cur.col=0; draw(); return; }
      if (e.key === "End")        { e.preventDefault(); s.cur.col=s.lines[s.cur.row].length; draw(); return; }

      if (e.key === "Tab") {
        e.preventDefault();
        if (!expandSnippet(s)) { insertChar(s,"    "); emit(s); }
        draw(); return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const {row,col} = s.cur;
        const line   = s.lines[row];
        const indent = line.match(/^(\s*)/)[1];
        const listM  = line.match(/^(\s*)([-*]|\d+\.)\s/);
        const extra  = listM ? listM[2] + " " : "";
        const after  = line.slice(col);
        s.lines[row] = line.slice(0, col);
        s.lines.splice(row+1, 0, indent + extra + after);
        s.cur.row++;
        s.cur.col = indent.length + extra.length;
        scheduleUndo(s); emit(s); scrollToCursor(s); draw(); return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        const {row,col} = s.cur;
        if (col > 0) {
          s.lines[row] = s.lines[row].slice(0,col-1) + s.lines[row].slice(col);
          s.cur.col--;
        } else if (row > 0) {
          const prev = s.lines[row-1];
          s.cur.col  = prev.length;
          s.lines[row-1] = prev + s.lines[row];
          s.lines.splice(row, 1);
          s.cur.row--;
        }
        scheduleUndo(s); emit(s); scrollToCursor(s); draw(); return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        const {row,col} = s.cur;
        if (col < s.lines[row].length) {
          s.lines[row] = s.lines[row].slice(0,col) + s.lines[row].slice(col+1);
        } else if (row < s.lines.length-1) {
          s.lines[row] = s.lines[row] + s.lines[row+1];
          s.lines.splice(row+1, 1);
        }
        scheduleUndo(s); emit(s); draw(); return;
      }

      // Auto-pairs
      const closer = AUTO_PAIRS[e.key];
      if (closer && !e.ctrlKey) {
        e.preventDefault();
        insertChar(s, e.key + closer);
        s.cur.col--;
        scheduleUndo(s); emit(s); draw(); return;
      }

      // Gewone tekens
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        insertChar(s, e.key);
        scheduleUndo(s); emit(s); scrollToCursor(s); draw(); return;
      }
      return;
    }

    // ────────────────────────── COMMAND ─────────────────────────────────────
    if (m === "COMMAND") {
      e.preventDefault();
      if (e.key === "Escape")    { setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); setStatus(""); draw(); return; }
      if (e.key === "Enter")     { runCmd(s, s.cmdBuf); setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); draw(); return; }
      if (e.key === "Backspace") { s.cmdBuf=s.cmdBuf.slice(0,-1); setCmdBuf(s.cmdBuf); draw(); return; }
      if (e.key === "Tab") {
        const tm = s.cmdBuf.match(/^(tag[+-]?\s+)(\S*)$/);
        if (tm) { const p=tm[2].replace(/^#/,""); const hit=allTags.find(t=>t.startsWith(p)&&t!==p); if(hit){s.cmdBuf=tm[1]+hit; setCmdBuf(s.cmdBuf);} }
        draw(); return;
      }
      if (e.key.length === 1) { s.cmdBuf+=e.key; setCmdBuf(s.cmdBuf); draw(); return; }
      return;
    }

    // ────────────────────────── SEARCH ──────────────────────────────────────
    if (m === "SEARCH") {
      e.preventDefault();
      if (e.key === "Escape")    { setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); buildMatches(s,""); draw(); return; }
      if (e.key === "Enter")     { buildMatches(s, s.cmdBuf); jumpMatch(s,0); setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); draw(); return; }
      if (e.key === "Backspace") { s.cmdBuf=s.cmdBuf.slice(0,-1); setCmdBuf(s.cmdBuf); draw(); return; }
      if (e.key.length === 1)    { s.cmdBuf+=e.key; setCmdBuf(s.cmdBuf); draw(); return; }
      return;
    }

    // ────────────────────────── NORMAL ──────────────────────────────────────
    e.preventDefault();
    const {row,col} = s.cur;
    const line = s.lines[row];

    switch (e.key) {
      // Mode wissels
      case "i": setMode("INSERT"); break;
      case "I": setMode("INSERT"); s.cur.col=0; break;
      case "a": setMode("INSERT"); s.cur.col=Math.min(col+1,line.length); break;
      case "A": setMode("INSERT"); s.cur.col=line.length; break;
      case "o":
        s.lines.splice(row+1,0,"");
        s.cur.row++; s.cur.col=0;
        setMode("INSERT"); break;
      case "O":
        s.lines.splice(row,0,"");
        s.cur.col=0;
        setMode("INSERT"); break;
      case ":": setMode("COMMAND"); s.cmdBuf=""; setCmdBuf(""); break;
      case "/": setMode("SEARCH");  s.cmdBuf=""; setCmdBuf(""); break;

      // Navigatie — h j k l
      case "h": case "ArrowLeft":
        s.cur.col = Math.max(0, col-1); break;
      case "l": case "ArrowRight":
        s.cur.col = Math.min(line.length, col+1); break;
      case "j": case "ArrowDown":
        if (row < s.lines.length-1) { s.cur.row++; s.cur.col=Math.min(col,s.lines[s.cur.row].length); } break;
      case "k": case "ArrowUp":
        if (row > 0) { s.cur.row--; s.cur.col=Math.min(col,s.lines[s.cur.row].length); } break;
      case "w": {
        // voorwaartse woordsprong
        const rest = line.slice(col+1);
        const m2   = rest.search(/\b\w/);
        if (m2>=0) s.cur.col=col+1+m2;
        else if (row<s.lines.length-1){ s.cur.row++; s.cur.col=0; }
        break;
      }
      case "b": {
        // achterwaartse woordsprong
        const before = line.slice(0, col);
        const m2 = before.search(/\w+$/);
        if (m2>=0) s.cur.col=m2;
        else if (row>0){ s.cur.row--; s.cur.col=s.lines[s.cur.row].length; }
        break;
      }
      case "0": s.cur.col=0; break;
      case "$": s.cur.col=line.length; break;
      case "^": { const m2=line.search(/\S/); s.cur.col=m2>=0?m2:0; break; }
      case "g": s.cur.row=0; s.cur.col=0; break;
      case "G": s.cur.row=s.lines.length-1; s.cur.col=0; break;
      case "PageUp":   s.cur.row=Math.max(0,row-s.visRows); break;
      case "PageDown": s.cur.row=Math.min(s.lines.length-1,row+s.visRows); break;

      // Zoeken
      case "n": jumpMatch(s,  1); break;
      case "N": jumpMatch(s, -1); break;

      // Bewerken
      case "x":
        if (col<line.length){ s.yank=line[col]; pushUndo(s); s.lines[row]=line.slice(0,col)+line.slice(col+1); emit(s); }
        break;
      case "d": // dd
        s.yank=line; pushUndo(s);
        s.lines.splice(row,1);
        if (s.lines.length===0) s.lines=[""];
        clamp(); emit(s);
        break;
      case "D":
        pushUndo(s); s.lines[row]=line.slice(0,col); emit(s);
        break;
      case "y": s.yank=line; setStatus("gekopieerd"); break;
      case "p":
        pushUndo(s);
        s.lines.splice(row+1,0,s.yank);
        s.cur.row++; s.cur.col=0;
        emit(s); break;
      case "P":
        pushUndo(s);
        s.lines.splice(row,0,s.yank);
        s.cur.col=0;
        emit(s); break;
      case "u":
        if (s.undoIdx>0){ s.undoIdx--; s.lines=s.undo[s.undoIdx].slice(); clamp(); emit(s); setStatus("undo"); }
        break;
      case "r":
        if (e.ctrlKey && s.undoIdx<s.undo.length-1){ s.undoIdx++; s.lines=s.undo[s.undoIdx].slice(); clamp(); emit(s); setStatus("redo"); }
        break;
      case "J": // join regels
        if (row<s.lines.length-1){ pushUndo(s); s.lines[row]+=" "+s.lines[row+1].trim(); s.lines.splice(row+1,1); emit(s); }
        break;
      case " ": setStatus(""); buildMatches(s,""); break; // nohlsearch
      case "Escape": setStatus(""); break;
    }

    clamp();
    scrollToCursor(s);
    draw();
  }, [allTags, noteTags, onTagsChange, onSave, onEscape, runCmd]);

  // Paste
  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const s = S.current;
    if (s.mode !== "INSERT") return;
    const text = e.clipboardData.getData("text");
    text.split("\n").forEach((ln, i) => {
      if (i === 0) {
        insertChar(s, ln);
      } else {
        const {row,col} = s.cur;
        const rest = s.lines[row].slice(col);
        s.lines[row] = s.lines[row].slice(0, col);
        s.lines.splice(row+1, 0, ln);
        s.cur.row++; s.cur.col = ln.length;
        // re-attach rest to last line
        if (i === text.split("\n").length-1) s.lines[s.cur.row] += rest;
      }
    });
    scheduleUndo(s); emit(s); scrollToCursor(s); draw();
  }, []);

  // ── Draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  const drawFrame = useCallback(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const CW  = cv.width / dpr;
    const CH  = cv.height / dpr;
    const s   = S.current;
    const cw  = s.charW;
    const nw  = numColsWidth(s);  // breedte regelnummer-gebied
    const {row: curRow, col: curCol} = s.cur;

    ctx.font         = `${FONT_SIZE}px 'Hack','Courier New',monospace`;
    ctx.textBaseline = "top";

    // ── Achtergrond ───────────────────────────────────────────────────────
    ctx.fillStyle = W.bg;
    ctx.fillRect(0, 0, CW, CH);

    // ── Cursor-kruis ──────────────────────────────────────────────────────
    const cxPos = nw + curCol * cw;
    const cyPos = (curRow - s.scroll) * LINE_H;

    // Cursorline (horizontaal) — hele breedte
    if (curRow >= s.scroll && curRow < s.scroll + s.visRows + 1) {
      ctx.fillStyle = "rgba(255,255,255,0.055)";
      ctx.fillRect(0, cyPos, CW, LINE_H);
    }
    // Cursorcolumn (vertikaal) — hele hoogte
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fillRect(cxPos, 0, cw, CH - LINE_H);

    // ── Regelnummer-kolom ─────────────────────────────────────────────────
    ctx.fillStyle = W.lineNrBg;
    ctx.fillRect(0, 0, nw - 2, CH - LINE_H);
    // scheidingslijn
    ctx.fillStyle = W.splitBg;
    ctx.fillRect(nw - 2, 0, 1, CH - LINE_H);

    // ── Regels tekenen ────────────────────────────────────────────────────
    for (let i = 0; i <= s.visRows; i++) {
      const li  = i + s.scroll;
      if (li >= s.lines.length) break;
      const y    = i * LINE_H;
      const line = s.lines[li];
      const isCur = li === curRow;

      // Regelnummer — rechts uitgelijnd in de kolom
      ctx.textAlign = "right";
      ctx.fillStyle = isCur ? W.statusFg : W.fgMuted;
      ctx.font      = isCur
        ? `bold ${FONT_SIZE}px 'Hack','Courier New',monospace`
        : `${FONT_SIZE}px 'Hack','Courier New',monospace`;
      ctx.fillText(String(li + 1), nw - PAD_LEFT, y + 4);
      ctx.textAlign = "left";
      ctx.font      = `${FONT_SIZE}px 'Hack','Courier New',monospace`;

      // Zoek-highlights
      if (s.search && s.matches.length) {
        s.matches.filter(m => m.row === li).forEach((m, mi) => {
          const isActive = mi === s.matchIdx && s.matches[s.matchIdx].row === li;
          ctx.fillStyle = isActive ? "rgba(234,231,136,0.5)" : "rgba(138,198,242,0.2)";
          ctx.fillRect(nw + m.col * cw, y, s.search.length * cw, LINE_H);
        });
      }

      // Tekst — met basis syntaxiskleuring
      drawLine(ctx, line, nw, y, cw, isCur);
    }

    // ── Cursor ────────────────────────────────────────────────────────────
    if (curRow >= s.scroll && curRow < s.scroll + s.visRows + 1) {
      const cx = nw + curCol * cw;
      const cy = (curRow - s.scroll) * LINE_H;
      const m  = s.mode;

      if (m === "INSERT") {
        // Smalle blinkende lijn (| cursor)
        if (blinkOn.current) {
          ctx.fillStyle = W.cursorBg;
          ctx.fillRect(cx - 1, cy + 2, 2, LINE_H - 4);
        }
      } else {
        // Blok cursor voor NORMAL / COMMAND / SEARCH
        const bColor = m === "COMMAND" ? W.orange
                     : m === "SEARCH"  ? W.purple
                     : W.cursorBg;
        ctx.globalAlpha = blinkOn.current ? 0.9 : 0.4;
        ctx.fillStyle   = bColor;
        ctx.fillRect(cx, cy, cw, LINE_H);
        ctx.globalAlpha = 1;
        // Teken karakter ónder blok in donkere kleur
        const ch = (s.lines[curRow] || "")[curCol] || " ";
        ctx.fillStyle = W.bg;
        ctx.fillText(ch, cx, cy + 4);
      }
    }

    // ── Statusbalk ────────────────────────────────────────────────────────
    const sbY  = CH - LINE_H;
    ctx.fillStyle = W.statusBg;
    ctx.fillRect(0, sbY, CW, LINE_H);

    // Mode badge
    const modeLabel  = ` ${s.mode} `;
    const modeColor  = s.mode==="INSERT"  ? W.comment
                     : s.mode==="COMMAND" ? W.orange
                     : s.mode==="SEARCH"  ? W.purple
                     : W.blue;
    const badgeW = modeLabel.length * cw + 4;
    ctx.fillStyle = modeColor;
    ctx.fillRect(0, sbY, badgeW, LINE_H);
    ctx.fillStyle = W.bg;
    ctx.font      = `bold ${FONT_SIZE}px 'Hack','Courier New',monospace`;
    ctx.fillText(modeLabel, 2, sbY + 4);
    ctx.font      = `${FONT_SIZE}px 'Hack','Courier New',monospace`;

    // Statusbericht of hint
    let stxt = "";
    if (s.mode === "COMMAND") stxt = ":" + s.cmdBuf + "█";
    else if (s.mode === "SEARCH") stxt = "/" + s.cmdBuf + "█";
    else if (statusMsg) stxt = "  " + statusMsg;
    else if (s.mode === "INSERT")
      stxt = "  -- INSERT --  Esc=NORMAL  Ctrl+J=snippet  Ctrl+S=opslaan";
    else
      stxt = `  ${s.lines.length}L  |  i=INSERT  :w=opslaan  :wq=sluiten  /=zoeken  n/N=volgende`;

    ctx.fillStyle = W.fgMuted;
    ctx.fillText(stxt, badgeW + 6, sbY + 4);

    // Positie rechts (ln:col)
    const posStr = `${curRow+1}:${curCol+1}`;
    ctx.textAlign = "right";
    ctx.fillStyle = W.fgDim;
    ctx.fillText(posStr, CW - 6, sbY + 4);
    ctx.textAlign = "left";
  }, [statusMsg]);

  // ── Syntaxiskleuring per regel ─────────────────────────────────────────
  const drawLine = (ctx, line, x, y, cw, isCur) => {
    if (!line) return;

    // Heading
    const hm = line.match(/^(#{1,3})\s/);
    if (hm) {
      ctx.fillStyle = hm[1].length===1 ? W.statusFg
                    : hm[1].length===2 ? W.string
                    : W.fg;
      ctx.fillText(line, x, y + 4);
      return;
    }

    // Teken basiskleur
    ctx.fillStyle = isCur ? W.fg : W.fgDim;
    ctx.fillText(line, x, y + 4);

    // Overlay gekleurde segmenten
    const paint = (start, end, color) => {
      const seg = line.slice(start, end);
      const sx  = x + start * cw;
      ctx.fillStyle = W.bg;
      // herstel achtergrond (rekening houdend met cursorline)
      if (isCur) {
        ctx.fillStyle = "rgba(255,255,255,0.055)";
        ctx.fillRect(sx, y, (end-start)*cw, LINE_H);
        ctx.fillStyle = W.bg;
      }
      ctx.fillStyle = color;
      ctx.fillText(seg, sx, y + 4);
    };

    let i = 0;
    while (i < line.length) {
      // #tag
      if (line[i]==='#' && (i===0||/\W/.test(line[i-1]))) {
        const tm = line.slice(i).match(/^#\w+/);
        if (tm) { paint(i, i+tm[0].length, W.comment); i+=tm[0].length; continue; }
      }
      // [[link]]
      if (line[i]==='[' && line[i+1]==='[') {
        const end = line.indexOf(']]', i+2);
        if (end>=0) { paint(i, end+2, W.keyword); i=end+2; continue; }
      }
      // **vet**
      if (line[i]==='*' && line[i+1]==='*') {
        const end = line.indexOf('**', i+2);
        if (end>=0) { paint(i, end+2, W.statusFg); i=end+2; continue; }
      }
      // *cursief*
      if (line[i]==='*' && line[i+1]!=='*') {
        const end = line.indexOf('*', i+1);
        if (end>=0) { paint(i, end+1, W.fgDim); i=end+1; continue; }
      }
      // `code`
      if (line[i]==='`') {
        const end = line.indexOf('`', i+1);
        if (end>=0) { paint(i, end+1, W.string); i=end+1; continue; }
      }
      i++;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const modeColor = mode==="INSERT" ? W.comment : mode==="COMMAND" ? W.orange : mode==="SEARCH" ? W.purple : W.blue;

  return React.createElement("div", {
    style: {display:"flex", flexDirection:"column", height:"100%", background:W.bg}
  },
    // Tags strip
    noteTags.length > 0 && React.createElement("div", {
      style: {padding:"4px 10px", background:W.lineNrBg,
              borderBottom:`1px solid ${W.splitBg}`,
              display:"flex", flexWrap:"wrap", gap:"3px",
              alignItems:"center", flexShrink:0}
    },
      React.createElement("span", {style:{fontSize:"9px",color:W.fgMuted,marginRight:"4px"}}, "TAGS:"),
      ...noteTags.map(t => React.createElement(TagPill, {
        key:t, tag:t, small:true,
        onRemove: t => onTagsChange(noteTags.filter(x => x!==t))
      }))
    ),
    // Canvas-gebied
    React.createElement("div", {
      style: {flex:1, position:"relative", overflow:"hidden"},
      onClick: () => inputRef.current?.focus(),
    },
      React.createElement("canvas", {ref:cvRef, style:{display:"block"}}),
      // Onzichtbaar input-element — vangt ALLES af, inclusief Escape
      // readOnly + size=1 → browser toont niks, maar events komen wél binnen
      React.createElement("input", {
        ref:      inputRef,
        onKeyDown:handleKey,
        onPaste:  handlePaste,
        readOnly: true,
        style: {
          position:"absolute", top:0, left:0,
          width:"1px", height:"1px", opacity:0,
          border:"none", outline:"none", padding:0,
          fontSize:"1px", pointerEvents:"none",
        },
        tabIndex: 0,
      })
    )
  );
};



// ── Obsidian-stijl Knowledge Graph ────────────────────────────────────────────
const Graph = ({notes, pdfNotes, onSelect, selectedId, localMode=false}) => {
  const cvRef    = useRef(null);
  const nodesRef = useRef([]);
  const afRef    = useRef(null);
  const dragging = useRef(null);
  const hovering = useRef(null);
  const [filterTag, setFilterTag] = useState(null);
  const [showLocal, setShowLocal] = useState(false);
  const [orphansOnly, setOrphansOnly] = useState(false);
  const [depthLimit, setDepthLimit] = useState(3);

  // Kleur per tag-groep (Obsidian-stijl)
  const tagColors = useMemo(()=>{
    const allTagsArr=[...new Set(notes.flatMap(n=>n.tags||[]))];
    const palette=[W.blue,W.comment,W.orange,W.purple,W.string,W.type];
    const map={};
    allTagsArr.forEach((t,i)=>{ map[t]=palette[i%palette.length]; });
    return map;
  },[notes]);

  const build = useCallback(()=>{
    const cv=cvRef.current; if(!cv) return;
    const CW=cv.clientWidth, CH=cv.clientHeight;

    let allNotes=notes;
    // Orphan filter
    if(orphansOnly) allNotes=notes.filter(n=>extractLinks(n.content).length===0&&!notes.some(x=>extractLinks(x.content).includes(n.id)));

    // Lokale graaf: alleen geselecteerd + directe buren
    if(showLocal && selectedId) {
      const directLinks=notes.find(n=>n.id===selectedId);
      const neighbors=directLinks?extractLinks(directLinks.content):[];
      const backNeighbors=notes.filter(n=>extractLinks(n.content).includes(selectedId)).map(n=>n.id);
      const keep=new Set([selectedId,...neighbors,...backNeighbors]);
      allNotes=notes.filter(n=>keep.has(n.id));
    }

    const tagNodes=[...new Set(allNotes.flatMap(n=>n.tags||[]))].map(t=>({id:"tag-"+t,title:"#"+t,links:[],tags:[t],type:"tag",color:tagColors[t]||W.comment}));
    const pdfTagNodes=[...new Set(pdfNotes.flatMap(p=>p.tags||[]))].filter(t=>!allNotes.flatMap(n=>n.tags||[]).includes(t)).map(t=>({id:"tag-"+t,title:"#"+t,links:[],tags:[t],type:"tag",color:tagColors[t]||W.fgMuted}));

    const all=[
      ...allNotes.map(n=>({
        id:n.id,title:n.title,
        links:extractLinks(n.content),
        tags:n.tags||[],type:"note",
        linkCount:extractLinks(n.content).length,
        backCount:notes.filter(x=>extractLinks(x.content).includes(n.id)).length,
      })),
      ...pdfNotes.slice(0,20).map(p=>({id:"pdf-"+p.id,title:"📄 "+p.text?.substring(0,20),links:[],tags:p.tags||[],type:"pdf",linkCount:0,backCount:0})),
      ...tagNodes,...pdfTagNodes,
    ];

    nodesRef.current=all.map(n=>{
      const ex=nodesRef.current.find(x=>x.id===n.id);
      if(ex) return {...ex,...n};
      const angle=(all.indexOf(n)/all.length)*Math.PI*2;
      const r=Math.min(CW,CH)*0.28;
      return {...n,x:CW/2+r*Math.cos(angle)+(Math.random()-.5)*80,y:CH/2+r*Math.sin(angle)+(Math.random()-.5)*80,vx:0,vy:0};
    });
    nodesRef.current.forEach(n=>{
      n.tagLinks=(n.tags||[]).map(t=>"tag-"+t).filter(tid=>nodesRef.current.find(x=>x.id===tid));
    });
  },[notes,pdfNotes,selectedId,showLocal,orphansOnly,tagColors]);

  useEffect(()=>{
    const cv=cvRef.current; if(!cv) return;
    const dpr=window.devicePixelRatio||1;
    const resize=()=>{
      const p=cv.parentElement;
      cv.width=p.clientWidth*dpr; cv.height=p.clientHeight*dpr;
      cv.style.width=p.clientWidth+"px"; cv.style.height=p.clientHeight+"px";
      cv.getContext("2d").scale(dpr,dpr); build();
    };
    resize();
    const ro=new ResizeObserver(resize); ro.observe(cv.parentElement);
    return()=>ro.disconnect();
  },[build]);

  useEffect(()=>{build();},[notes,pdfNotes,build,showLocal,orphansOnly]);

  useEffect(()=>{
    const cv=cvRef.current; if(!cv) return;
    const ctx=cv.getContext("2d");
    const dpr=window.devicePixelRatio||1;
    const CW=()=>cv.width/dpr, CH=()=>cv.height/dpr;

    const tick=()=>{
      const nodes=nodesRef.current;
      if(!nodes.length){afRef.current=requestAnimationFrame(tick);return;}

      // Forces
      for(let i=0;i<nodes.length;i++){
        for(let j=i+1;j<nodes.length;j++){
          const dx=nodes[j].x-nodes[i].x,dy=nodes[j].y-nodes[i].y;
          const d=Math.sqrt(dx*dx+dy*dy)||1;
          const f=2000/(d*d);
          nodes[i].vx-=(dx/d)*f; nodes[i].vy-=(dy/d)*f;
          nodes[j].vx+=(dx/d)*f; nodes[j].vy+=(dy/d)*f;
        }
      }
      nodes.forEach(n=>{
        const att=(id,str)=>{
          const t=nodes.find(x=>x.id===id); if(!t)return;
          const dx=t.x-n.x,dy=t.y-n.y,d=Math.sqrt(dx*dx+dy*dy)||1;
          const f=str*d;
          n.vx+=(dx/d)*f; n.vy+=(dy/d)*f;
          t.vx-=(dx/d)*f; t.vy-=(dy/d)*f;
        };
        n.links.forEach(l=>att(l,0.03));
        (n.tagLinks||[]).forEach(l=>att(l,0.015));
        if(n===dragging.current)return;
        n.vx+=(CW()/2-n.x)*0.001; n.vy+=(CH()/2-n.y)*0.001;
        n.vx*=0.83; n.vy*=0.83;
        n.x=Math.max(60,Math.min(CW()-60,n.x+n.vx));
        n.y=Math.max(40,Math.min(CH()-40,n.y+n.vy));
      });

      ctx.clearRect(0,0,CW(),CH());
      ctx.fillStyle=W.bg; ctx.fillRect(0,0,CW(),CH());

      // Grid
      ctx.strokeStyle="rgba(255,255,255,0.02)"; ctx.lineWidth=1;
      for(let x=0;x<CW();x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,CH());ctx.stroke();}
      for(let y=0;y<CH();y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(CW(),y);ctx.stroke();}

      // Edges
      nodes.forEach(n=>{
        const drawEdge=(id,col,dashed,thick)=>{
          const t=nodes.find(x=>x.id===id); if(!t) return;
          const sel=n.id===selectedId||t.id===selectedId||n.id===hovering.current?.id||t.id===hovering.current?.id;
          ctx.beginPath(); ctx.moveTo(n.x,n.y); ctx.lineTo(t.x,t.y);
          ctx.setLineDash(dashed?[3,5]:[]);
          ctx.strokeStyle=sel?col:col+"30";
          ctx.lineWidth=sel?(thick||1.8):0.6;
          ctx.stroke(); ctx.setLineDash([]);
        };
        n.links.forEach(l=>drawEdge(l,W.blue,false));
        (n.tagLinks||[]).forEach(l=>drawEdge(l,n.color||W.comment,true,1.2));
      });

      // Nodes
      nodes.forEach(n=>{
        const sel   = n.id===selectedId;
        const hov   = n.id===hovering.current?.id;
        const isTag = n.type==="tag";
        const totalLinks = (n.linkCount||0)+(n.backCount||0)+(n.tagLinks||[]).length;

        // Obsidian-stijl: radius gebaseerd op verbindingen
        const r = isTag ? 5 : Math.max(6, Math.min(18, 7 + totalLinks * 1.5));

        // Glow voor selected
        if(sel){
          ctx.beginPath(); ctx.arc(n.x,n.y,r+12,0,Math.PI*2);
          const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,r+12);
          g.addColorStop(0,"rgba(234,231,136,0.3)"); g.addColorStop(1,"rgba(234,231,136,0)");
          ctx.fillStyle=g; ctx.fill();
        }

        // Hover glow
        if(hov && !sel){
          ctx.beginPath(); ctx.arc(n.x,n.y,r+6,0,Math.PI*2);
          ctx.fillStyle="rgba(255,255,255,0.06)"; ctx.fill();
        }

        // Node kleur: per tag-groep of type
        let color = W.keyword;
        if(isTag) color = n.color||W.comment;
        else if(n.type==="pdf") color = W.orange;
        else if(n.tags?.length) color = tagColors[n.tags[0]]||W.keyword;
        if(sel) color = W.yellow;

        ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2);
        ctx.fillStyle=color; ctx.fill();
        ctx.strokeStyle=sel?W.cursorBg:hov?"rgba(255,255,255,0.4)":"rgba(140,198,242,0.15)";
        ctx.lineWidth=sel?2:hov?1.5:0.8; ctx.stroke();

        // Label — 2px groter dan voorheen
        const label=n.title?.length>24?n.title.substring(0,22)+"…":n.title||"";
        ctx.fillStyle=sel?W.statusFg:hov?W.fg:isTag?"#a8d8f0":W.fgDim;
        ctx.font=`${sel||hov?"bold ":""}${isTag?11:12}px 'Courier New'`;
        ctx.textAlign="center";
        ctx.fillText(label,n.x,n.y+r+15);

        // Hover tooltip
        if(hov){
          const ttW=Math.min(200,label.length*7+20);
          ctx.fillStyle="rgba(28,28,28,0.92)";
          ctx.fillRect(n.x-ttW/2,n.y-r-32,ttW,22);
          ctx.fillStyle=W.statusFg; ctx.font="11px 'Courier New'";
          ctx.fillText(n.title?.substring(0,30)||"",n.x,n.y-r-16);
          if(n.tags?.length){
            ctx.fillStyle=W.comment; ctx.font="9px 'Courier New'";
            ctx.fillText(n.tags.map(t=>"#"+t).join(" ").substring(0,35),n.x,n.y-r-38);
          }
        }
      });

      afRef.current=requestAnimationFrame(tick);
    };
    afRef.current=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(afRef.current);
  },[notes,pdfNotes,selectedId,tagColors]);

  const nodeAt=(x,y)=>nodesRef.current.find(n=>{
    const dx=n.x-x,dy=n.y-y,r=n.type==="tag"?5:Math.max(6,Math.min(18,7+((n.linkCount||0)+(n.backCount||0))*1.5));
    return Math.sqrt(dx*dx+dy*dy)<r+8;
  });

  const allGraphTags=[...new Set(notes.flatMap(n=>n.tags||[]))];

  return React.createElement("div",{style:{position:"relative",width:"100%",height:"100%"}},
    // Controls panel — linksbovenin
    React.createElement("div",{style:{
      position:"absolute",top:"10px",left:"10px",zIndex:10,
      display:"flex",flexDirection:"column",gap:"6px",
      background:"rgba(28,28,28,0.82)",borderRadius:"8px",
      border:"1px solid rgba(255,255,255,0.07)",
      padding:"10px 12px",backdropFilter:"blur(6px)",
      maxWidth:"260px",
    }},
      // Label
      React.createElement("div",{style:{fontSize:"9px",color:"rgba(138,198,242,0.5)",
        letterSpacing:"2px",marginBottom:"2px"}},"FILTER OP TAG"),
      // Tag pills
      allGraphTags.length===0
        ? React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted}},"geen tags")
        : React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:"5px"}},
            allGraphTags.map(t=>React.createElement("span",{
              key:t,
              onClick:()=>setFilterTag(filterTag===t?null:t),
              style:{
                fontSize:"11px",padding:"3px 8px",borderRadius:"5px",
                cursor:"pointer",userSelect:"none",fontWeight:"500",
                background:filterTag===t
                  ? (tagColors[t]||W.blue)+"35"
                  : "rgba(138,198,242,0.08)",
                color:filterTag===t
                  ? (tagColors[t]||W.blue)
                  : "#a8d8f0",
                border:`1px solid ${filterTag===t
                  ? (tagColors[t]||W.blue)+"70"
                  : "rgba(138,198,242,0.22)"}`,
                boxShadow:filterTag===t?`0 0 8px ${(tagColors[t]||W.blue)}40`:"none",
              }
            },"#"+t))
          ),
      // Divider
      React.createElement("div",{style:{height:"1px",background:"rgba(255,255,255,0.06)",margin:"2px 0"}}),
      // Weergave-opties
      React.createElement("div",{style:{fontSize:"9px",color:"rgba(138,198,242,0.5)",
        letterSpacing:"2px",marginBottom:"2px"}},"WEERGAVE"),
      React.createElement("div",{style:{display:"flex",gap:"5px",flexWrap:"wrap"}},
        [{label:"lokaal",val:showLocal,set:setShowLocal},
         {label:"orphans",val:orphansOnly,set:setOrphansOnly}]
        .map(({label,val,set})=>React.createElement("button",{
          key:label,onClick:()=>set(!val),
          style:{
            background:val?"rgba(138,198,242,0.18)":"rgba(0,0,0,0.4)",
            border:`1px solid ${val?"rgba(138,198,242,0.5)":"rgba(255,255,255,0.1)"}`,
            color:val?"#a8d8f0":W.fgMuted,
            borderRadius:"4px",padding:"3px 10px",
            fontSize:"11px",cursor:"pointer",fontWeight:val?"600":"400",
          }
        },label))
      ),
      // Actief filter tonen + wis knop
      filterTag && React.createElement("div",{style:{
        display:"flex",alignItems:"center",gap:"6px",
        marginTop:"2px",paddingTop:"6px",
        borderTop:"1px solid rgba(255,255,255,0.06)"
      }},
        React.createElement("span",{style:{fontSize:"11px",color:"#a8d8f0"}},"filter: #"+filterTag),
        React.createElement("button",{onClick:()=>setFilterTag(null),style:{
          background:"none",border:"none",color:W.fgMuted,
          fontSize:"13px",cursor:"pointer",padding:"0 2px",lineHeight:1
        }},"×")
      )
    ),
    React.createElement("canvas",{
      ref:cvRef,
      style:{width:"100%",height:"100%",cursor:"crosshair"},
      onMouseDown:e=>{
        const r=cvRef.current.getBoundingClientRect();
        const n=nodeAt(e.clientX-r.left,e.clientY-r.top);
        if(n)dragging.current=n;
      },
      onMouseMove:e=>{
        const r=cvRef.current.getBoundingClientRect();
        const n=nodeAt(e.clientX-r.left,e.clientY-r.top);
        hovering.current=n||null;
        if(dragging.current){
          dragging.current.x=e.clientX-r.left;
          dragging.current.y=e.clientY-r.top;
          dragging.current.vx=0; dragging.current.vy=0;
        }
      },
      onMouseUp:e=>{
        const r=cvRef.current.getBoundingClientRect();
        const n=nodeAt(e.clientX-r.left,e.clientY-r.top);
        if(n&&!dragging.current?.moved&&(n.type==="note"||n.type==="pdf"))onSelect(n.id);
        dragging.current=null;
      },
      onMouseLeave:()=>{hovering.current=null;dragging.current=null;}
    }),
    // Legend
    React.createElement("div",{style:{
      position:"absolute",bottom:"12px",left:"50%",transform:"translateX(-50%)",
      background:"rgba(28,28,28,0.92)",border:`1px solid ${W.splitBg}`,
      borderRadius:"6px",padding:"5px 14px",fontSize:"10px",color:W.fgMuted,
      display:"flex",gap:"12px",backdropFilter:"blur(8px)",
    }},
      React.createElement("span",null,React.createElement("span",{style:{color:W.yellow}},"● "),selectedId?"geselecteerd":""),
      React.createElement("span",null,React.createElement("span",{style:{color:W.keyword}},"● "),"notitie"),
      React.createElement("span",null,React.createElement("span",{style:{color:W.orange}},"● "),"pdf"),
      React.createElement("span",null,React.createElement("span",{style:{color:W.comment}},"● "),"tag"),
      React.createElement("span",null,"groter = meer links")
    )
  );
};


// ── PDF Viewer ─────────────────────────────────────────────────────────────────
const PDFViewer = ({pdfNotes, setPdfNotes, allTags, serverPdfs, onRefreshPdfs}) => {
  const [pdfDoc,     setPdfDoc]     = useState(null);
  const [pdfFile,    setPdfFile]    = useState(null);
  const [pageNum,    setPageNum]    = useState(1);
  const [numPages,   setNumPages]   = useState(0);
  const [scale,      setScale]      = useState(1.4);
  const [highlights, setHighlights] = useState(pdfNotes||[]);
  const [pendingSel, setPendingSel] = useState(null);
  const [selPos,     setSelPos]     = useState({x:0,y:0});
  const [editingId,  setEditingId]  = useState(null);
  const [isLoading,  setIsLoading]  = useState(false);
  const [pdfjsReady, setPdfjsReady] = useState(false);
  const [activeColor,setActiveColor]= useState(HCOLORS[0]);
  const [filterTag,  setFilterTag]  = useState(null);
  const [quickNote,  setQuickNote]  = useState("");
  const [quickTags,  setQuickTags]  = useState([]);
  const [showLibrary,   setShowLibrary]   = useState(false);
  const [showAnnotPanel,setShowAnnotPanel]= useState(true);   // wegklapbaar

  const canvasRef   = useRef(null);
  const textLayerRef= useRef(null);
  const wrapRef     = useRef(null);
  const scrollRef   = useRef(null);
  const fileRef     = useRef(null);
  const renderRef   = useRef(null);
  const tlRenderRef = useRef(null);
  const pinchRef    = useRef({active:false, dist0:0, scale0:1.4});

  useEffect(()=>{
    if(!window.pdfjsLib){
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
    } else { setPdfjsReady(true); }
  },[]);

  const renderPage=useCallback(async(doc,num,sc)=>{
    if(!doc||!canvasRef.current||!textLayerRef.current)return;
    if(renderRef.current){try{renderRef.current.cancel();}catch{}}
    if(tlRenderRef.current){try{tlRenderRef.current.cancel();}catch{}}
    const page=await doc.getPage(num);
    const vp=page.getViewport({scale:sc});
    const canvas=canvasRef.current;
    const ctx=canvas.getContext("2d");
    canvas.width=Math.floor(vp.width); canvas.height=Math.floor(vp.height);
    canvas.style.width=Math.floor(vp.width)+"px"; canvas.style.height=Math.floor(vp.height)+"px";
    const task=page.render({canvasContext:ctx,viewport:vp});
    renderRef.current=task;
    try{await task.promise;}catch{}
    const tl=textLayerRef.current;
    tl.innerHTML=""; tl.className="textLayer";
    tl.style.width=Math.floor(vp.width)+"px"; tl.style.height=Math.floor(vp.height)+"px";
    const tc=await page.getTextContent();
    const tlTask=window.pdfjsLib.renderTextLayer({textContentSource:tc,container:tl,viewport:vp,textDivs:[]});
    tlRenderRef.current=tlTask;
    try{await tlTask.promise;}catch{}
  },[]);

  useEffect(()=>{if(pdfDoc)renderPage(pdfDoc,pageNum,scale);},[pdfDoc,pageNum,scale,renderPage]);

  const loadPdf=async(arrayBuffer,name)=>{
    setIsLoading(true);
    try{
      const doc=await window.pdfjsLib.getDocument({data:arrayBuffer}).promise;
      setPdfDoc(doc); setNumPages(doc.numPages); setPageNum(1);
      setPdfFile({name});
    }catch(err){console.error(err);}
    setIsLoading(false);
  };

  const onFileInput=async(e)=>{
    const file=e.target.files[0]; if(!file||!pdfjsReady)return;
    // Upload to server
    try{ await api.uploadPdf(file); onRefreshPdfs?.(); }catch{}
    const ab=await file.arrayBuffer();
    await loadPdf(ab,file.name);
  };

  const openFromServer=async(name)=>{
    setShowLibrary(false); setIsLoading(true);
    try{
      const ab=await api.fetchPdfBlob(name);
      await loadPdf(ab,name);
    }catch(err){console.error(err);}
    setIsLoading(false);
  };

  // Bewaar selectie-rects voor visuele highlight overlay
  const pendingRectsRef = useRef([]);

  const showSelectionPopup = useCallback(() => {
    const sel = window.getSelection();
    const txt = sel?.toString().trim();
    if (!txt || txt.length < 2) return;
    const tl = textLayerRef.current; if (!tl) return;
    try {
      const range = sel.getRangeAt(0);
      if (!tl.contains(range.commonAncestorContainer)) return;

      // Verzamel alle client-rects (meerdere regels mogelijk)
      const tlRect = tl.getBoundingClientRect();
      const rects = Array.from(range.getClientRects()).map(r => ({
        x: r.left - tlRect.left,
        y: r.top  - tlRect.top,
        w: r.width,
        h: r.height,
      })).filter(r => r.w > 1 && r.h > 1);
      pendingRectsRef.current = rects;

      const scrollEl = scrollRef.current;
      const sRect = range.getBoundingClientRect();
      const cRect = scrollEl.getBoundingClientRect();
      const isMobileView = window.innerWidth < 768;
      const popupW = isMobileView ? Math.min(window.innerWidth - 24, 340) : 360;
      // Op iPad: popup boven selectie, anders valt hij achter het toetsenbord
      const yOffset = isMobileView ? -(popupW * 0.85) : 12;
      setPendingSel(txt);
      setSelPos({
        x: Math.max(8, Math.min(sRect.left - cRect.left + scrollEl.scrollLeft, cRect.width - popupW - 8)),
        y: Math.max(8, sRect.bottom - cRect.top + scrollEl.scrollTop + yOffset),
      });
      setQuickNote(""); setQuickTags([]);
    } catch(err) {}
  }, []);

  const handleMouseUp = useCallback((e) => {
    // Kleine vertraging zodat browser de selectie kan afronden
    setTimeout(showSelectionPopup, 30);
  }, [showSelectionPopup]);

  // iOS Safari: toon "Annoteren"-knop zodra er tekst geselecteerd is.
  // We gebruiken een zwevende knop ipv automatische popup omdat iOS
  // de selectionchange event ook vuurt tijdens het slepen van de handvaatjes.
  const [iosAnnotBtn, setIosAnnotBtn] = useState(null); // {x,y} of null
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
    if (!isIOS) return; // alleen op iOS/iPadOS

    const onSelChange = () => {
      const sel = window.getSelection();
      const txt = sel?.toString().trim();
      if (!txt || txt.length < 2) { setIosAnnotBtn(null); return; }
      const tl = textLayerRef.current; if (!tl) return;
      try {
        const range = sel.getRangeAt(0);
        if (!tl.contains(range.commonAncestorContainer)) { setIosAnnotBtn(null); return; }
        // Positie van de knop: boven het midden van de selectie
        const sRect = range.getBoundingClientRect();
        const scrollEl = scrollRef.current;
        const cRect = scrollEl.getBoundingClientRect();
        setIosAnnotBtn({
          x: (sRect.left + sRect.right) / 2 - cRect.left + scrollEl.scrollLeft,
          y: sRect.top - cRect.top + scrollEl.scrollTop - 44,
        });
      } catch(e) { setIosAnnotBtn(null); }
    };

    // kleine vertraging: laat iOS de handvaatjes stabiliseren
    let timer;
    const debounced = () => { clearTimeout(timer); timer = setTimeout(onSelChange, 400); };
    document.addEventListener("selectionchange", debounced);
    return () => {
      document.removeEventListener("selectionchange", debounced);
      clearTimeout(timer);
    };
  }, [showSelectionPopup]);

  const saveHighlight=async()=>{
    if(!pendingSel)return;
    // Bewaar rects als fractie van de canvas-afmeting zodat ze schaalbaar zijn
    const cv = canvasRef.current;
    const cw = cv ? cv.offsetWidth  : 1;
    const ch = cv ? cv.offsetHeight : 1;
    const rects = pendingRectsRef.current.map(r=>({
      x: r.x/cw, y: r.y/ch, w: r.w/cw, h: r.h/ch,
    }));
    const h={id:genId(),text:pendingSel,note:quickNote,tags:quickTags,
             page:pageNum,file:pdfFile?.name||"PDF",
             colorId:activeColor.id,rects,
             created:new Date().toISOString()};
    const updated=[...highlights,h];
    setHighlights(updated);
    setPdfNotes(updated);
    await api.post("/annotations",updated);
    setPendingSel(null); setQuickNote(""); setQuickTags([]);
    pendingRectsRef.current=[];
    window.getSelection()?.removeAllRanges();
  };

  const updateHighlight=async(id,patch)=>{
    const updated=highlights.map(h=>h.id===id?{...h,...patch}:h);
    setHighlights(updated); setPdfNotes(updated);
    await api.post("/annotations",updated);
  };

  const removeHighlight=async(id)=>{
    const updated=highlights.filter(h=>h.id!==id);
    setHighlights(updated); setPdfNotes(updated);
    await api.post("/annotations",updated);
    if(editingId===id)setEditingId(null);
  };

  const allAnnotTags=[...new Set(highlights.flatMap(h=>h.tags||[]))];
  const panelHl=filterTag?highlights.filter(h=>(h.tags||[]).includes(filterTag)):highlights;

  return React.createElement("div",{style:{display:"flex",height:"100%",background:W.bg,position:"relative"}},
    // Main PDF column
    React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}},
      // Toolbar
      React.createElement("div",{style:{background:W.statusBg,borderBottom:`1px solid ${W.splitBg}`,padding:"5px 10px",display:"flex",alignItems:"center",gap:"8px",fontSize:"12px",flexShrink:0,flexWrap:"wrap"}},
        React.createElement("button",{onClick:()=>fileRef.current.click(),style:{background:W.blue,color:W.bg,border:"none",borderRadius:"4px",padding:"4px 10px",fontSize:"11px",cursor:"pointer",fontWeight:"bold"}},":open PDF"),
        React.createElement("button",{onClick:()=>setShowLibrary(!showLibrary),style:{background:showLibrary?W.comment:"none",color:showLibrary?W.bg:W.fgMuted,border:`1px solid ${showLibrary?W.comment:W.splitBg}`,borderRadius:"4px",padding:"4px 10px",fontSize:"11px",cursor:"pointer"}},`📚 bibliotheek (${serverPdfs?.length||0})`),
        React.createElement("input",{ref:fileRef,type:"file",accept:".pdf",style:{display:"none"},onChange:onFileInput}),
        !pdfjsReady&&React.createElement("span",{style:{color:W.orange,fontSize:"10px"}},"pdf.js laden…"),
        pdfDoc&&React.createElement(React.Fragment,null,
          React.createElement("span",{style:{color:W.fgMuted}},"│"),
          React.createElement("button",{onClick:()=>setPageNum(p=>Math.max(1,p-1)),style:{background:"none",border:"none",color:W.fg,cursor:"pointer",fontSize:"16px",padding:"0 3px"}},"◀"),
          React.createElement("span",{style:{color:W.statusFg,minWidth:"60px",textAlign:"center"}},pageNum," / ",numPages),
          React.createElement("button",{onClick:()=>setPageNum(p=>Math.min(numPages,p+1)),style:{background:"none",border:"none",color:W.fg,cursor:"pointer",fontSize:"16px",padding:"0 3px"}},"▶"),
          React.createElement("span",{style:{color:W.fgMuted}},"│"),
          React.createElement("button",{onClick:()=>setScale(s=>Math.max(0.5,+(s-0.2).toFixed(1))),style:{background:"none",border:"none",color:W.fg,cursor:"pointer",padding:"0 4px",fontSize:"16px"}},"−"),
          React.createElement("span",{style:{color:W.fgMuted,minWidth:"40px",textAlign:"center"}},Math.round(scale*100),"%"),
          React.createElement("button",{onClick:()=>setScale(s=>Math.min(3,+(s+0.2).toFixed(1))),style:{background:"none",border:"none",color:W.fg,cursor:"pointer",padding:"0 4px",fontSize:"16px"}},"+"),
          React.createElement("span",{style:{color:W.fgMuted}},"│"),
          ...HCOLORS.map(c=>React.createElement("button",{key:c.id,onClick:()=>setActiveColor(c),title:c.label,style:{width:"18px",height:"18px",borderRadius:"4px",background:c.bg,border:`2px solid ${activeColor.id===c.id?c.border:"transparent"}`,cursor:"pointer",padding:0,boxShadow:activeColor.id===c.id?`0 0 6px ${c.border}`:"none"}})),
          React.createElement("span",{style:{color:W.fgMuted,fontSize:"10px",marginLeft:"4px",maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},pdfFile?.name)
        ),
        React.createElement("div",{style:{flex:1}}),
        pdfDoc&&React.createElement("span",{style:{color:W.comment,fontSize:"10px"}},"① selecteer tekst  ② popup  ③ opslaan")
      ),

      // PDF library dropdown
      showLibrary&&React.createElement("div",{style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,padding:"8px 12px",maxHeight:"160px",overflowY:"auto",flexShrink:0}},
        serverPdfs?.length===0
          ? React.createElement("div",{style:{color:W.fgMuted,fontSize:"11px",padding:"8px"}},"Nog geen PDF's opgeslagen. Open een PDF om te beginnen.")
          : (serverPdfs||[]).map(p=>React.createElement("div",{
              key:p.name,
              onClick:()=>openFromServer(p.name),
              style:{padding:"5px 8px",cursor:"pointer",borderRadius:"3px",fontSize:"11px",color:W.fg,display:"flex",justifyContent:"space-between",alignItems:"center"}
            },
              React.createElement("span",null,"📄 ",p.name),
              React.createElement("span",{style:{color:W.fgMuted,fontSize:"9px"}},Math.round(p.size/1024),"KB")
            ))
      ),

      // Scroll area
      React.createElement("div",{
        ref:scrollRef,
        style:{flex:1,overflow:"auto",background:W.lineNrBg,position:"relative",cursor:"text"},
        onMouseUp:handleMouseUp,
        onTouchStart:(e)=>{
          if(e.touches.length===2){
            // Pinch start
            const dx=e.touches[0].clientX-e.touches[1].clientX;
            const dy=e.touches[0].clientY-e.touches[1].clientY;
            pinchRef.current={active:true, dist0:Math.hypot(dx,dy), scale0:scale};
            e.preventDefault();
          }
        },
        onTouchMove:(e)=>{
          if(!pinchRef.current.active||e.touches.length!==2)return;
          e.preventDefault();
          const dx=e.touches[0].clientX-e.touches[1].clientX;
          const dy=e.touches[0].clientY-e.touches[1].clientY;
          const dist=Math.hypot(dx,dy);
          const ratio=dist/pinchRef.current.dist0;
          const newScale=Math.min(4, Math.max(0.5,
            +(pinchRef.current.scale0*ratio).toFixed(2)));
          setScale(newScale);
        },
        onTouchEnd:()=>{ pinchRef.current.active=false; },
      },
        isLoading&&React.createElement("div",{style:{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}},
          React.createElement("span",{style:{color:W.blue,fontSize:"14px"}},"laden…")
        ),
        !pdfDoc&&!isLoading&&React.createElement("div",{style:{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:"16px",color:W.fgMuted}},
          React.createElement("div",{style:{fontSize:"56px"}},"📄"),
          React.createElement("div",{style:{fontSize:"14px",color:W.fgDim}},":open PDF of kies uit bibliotheek"),
          React.createElement("div",{style:{fontSize:"11px",color:W.splitBg,maxWidth:"300px",textAlign:"center",lineHeight:"1.8"}},"PDF's worden opgeslagen in je vault map.\nSelecteer tekst om te annoteren.")
        ),
        pdfDoc&&React.createElement("div",{ref:wrapRef,style:{position:"relative",margin:"24px auto",width:"fit-content"}},
          React.createElement("canvas",{ref:canvasRef,style:{display:"block",boxShadow:"0 4px 32px rgba(0,0,0,0.7)"}}),
          // Highlight overlay — getekend als gekleurde rechthoeken ONDER de textLayer
          React.createElement("svg",{
            style:{position:"absolute",top:0,left:0,pointerEvents:"none",overflow:"visible"},
            width:canvasRef.current?.offsetWidth||0,
            height:canvasRef.current?.offsetHeight||0,
          },
            highlights.filter(h=>h.page===pageNum&&h.file===pdfFile?.name&&h.rects?.length).flatMap((h,hi)=>{
              const col=HCOLORS.find(c=>c.id===h.colorId)||HCOLORS[0];
              const cw=canvasRef.current?.offsetWidth||1;
              const ch=canvasRef.current?.offsetHeight||1;
              const isActive=editingId===h.id;
              return h.rects.map((r,ri)=>React.createElement("rect",{
                key:`${hi}-${ri}`,
                x:r.x*cw, y:r.y*ch,
                width:r.w*cw, height:r.h*ch,
                fill:col.bg,
                stroke:isActive?col.border:"none",
                strokeWidth:isActive?1.5:0,
                rx:2,
                style:{cursor:"pointer",pointerEvents:"all"},
                onClick:()=>setEditingId(h.id===editingId?null:h.id),
                title:h.text.substring(0,60),
              }));
            })
          ),
          React.createElement("div",{ref:textLayerRef,className:"textLayer",style:{position:"absolute",top:0,left:0,overflow:"hidden",lineHeight:1,userSelect:"text",WebkitUserSelect:"text",MozUserSelect:"text",cursor:"text",touchAction:"auto",WebkitTouchCallout:"default"}}),
          // iOS Annoteren-knop: zweeft boven de selectie
          iosAnnotBtn&&!pendingSel&&React.createElement("button",{
            onTouchStart:e=>{ e.preventDefault(); showSelectionPopup(); setIosAnnotBtn(null); },
            onClick:()=>{ showSelectionPopup(); setIosAnnotBtn(null); },
            style:{
              position:"absolute",
              left: Math.max(4, iosAnnotBtn.x - 60),
              top:  Math.max(4, iosAnnotBtn.y),
              zIndex:600,
              background:W.blue,color:W.bg,
              border:"none",borderRadius:"20px",
              padding:"8px 18px",fontSize:"14px",
              fontWeight:"bold",cursor:"pointer",
              boxShadow:"0 3px 16px rgba(0,0,0,0.6)",
              WebkitTapHighlightColor:"transparent",
            }
          },"✏ Annoteren"),
          // Selection popup
          pendingSel&&React.createElement("div",{style:{position:"absolute",left:selPos.x,top:selPos.y,background:W.bg3,border:`2px solid ${activeColor.border}`,borderRadius:"8px",padding:"14px 16px",zIndex:500,width:"350px",boxShadow:`0 8px 32px rgba(0,0,0,0.8)`},onMouseUp:e=>e.stopPropagation()},
            React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,marginBottom:"10px",padding:"7px 10px",background:activeColor.bg,borderRadius:"4px",fontStyle:"italic",lineHeight:"1.6",borderLeft:`4px solid ${activeColor.border}`}},'"',pendingSel.substring(0,100),pendingSel.length>100?"…":"",'"'),
            React.createElement("div",{style:{display:"flex",gap:"6px",marginBottom:"10px",alignItems:"center"}},
              React.createElement("span",{style:{fontSize:"10px",color:W.fgMuted,marginRight:"2px"}},"kleur:"),
              ...HCOLORS.map(c=>React.createElement("button",{key:c.id,onClick:()=>setActiveColor(c),style:{width:"22px",height:"22px",borderRadius:"4px",background:c.bg,border:`2px solid ${activeColor.id===c.id?c.border:W.splitBg}`,cursor:"pointer",padding:0}}))
            ),
            React.createElement("textarea",{autoFocus:true,value:quickNote,onChange:e=>setQuickNote(e.target.value),onKeyDown:e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();saveHighlight();}if(e.key==="Escape"){setPendingSel(null);window.getSelection()?.removeAllRanges();}},placeholder:"Notitie — Enter=opslaan · Shift+Enter=nieuwe regel · Esc=sluiten",rows:2,style:{width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"4px",padding:"8px 10px",color:W.fg,fontSize:"12px",outline:"none",resize:"none",marginBottom:"8px"}}),
            React.createElement("div",{style:{marginBottom:"12px"}},
              React.createElement("div",{style:{fontSize:"10px",color:W.fgMuted,marginBottom:"4px"}},"tags:"),
              React.createElement(TagEditor,{tags:quickTags,onChange:setQuickTags,allTags:[...allTags,...allAnnotTags]})
            ),
            React.createElement("div",{style:{display:"flex",gap:"8px"}},
              React.createElement("button",{onClick:saveHighlight,style:{background:activeColor.border,color:W.bg,border:"none",borderRadius:"4px",padding:"6px 16px",fontSize:"11px",cursor:"pointer",fontWeight:"bold"}},"✓ Opslaan"),
              React.createElement("button",{onClick:()=>{setPendingSel(null);window.getSelection()?.removeAllRanges();},style:{background:"none",color:W.fgMuted,border:`1px solid ${W.splitBg}`,borderRadius:"4px",padding:"6px 12px",fontSize:"11px",cursor:"pointer"}},"Esc")
            )
          )
        )
      )
    ),
    // Annotatiepaneel — knop om te openen (altijd zichtbaar)
    React.createElement("button",{
      onClick:()=>setShowAnnotPanel(p=>!p),
      title: showAnnotPanel ? "Annotaties verbergen" : "Annotaties tonen",
      style:{
        position:"absolute", right:showAnnotPanel?286:0, top:"50%",
        transform:"translateY(-50%)",
        background:W.bg2, border:`1px solid ${W.splitBg}`,
        borderRight:showAnnotPanel?"none":"1px solid "+W.splitBg,
        borderRadius:showAnnotPanel?"4px 0 0 4px":"0 4px 4px 0",
        color:W.fgMuted, fontSize:"14px", cursor:"pointer",
        padding:"8px 5px", zIndex:10, lineHeight:1,
        writingMode:"vertical-rl",
      }
    }, showAnnotPanel ? "▶" : "◀ " + (highlights.length > 0 ? highlights.length : "")),

    // Annotations panel
    showAnnotPanel&&React.createElement("div",{style:{
      width:"280px",flexShrink:0,background:W.bg2,
      borderLeft:`1px solid ${W.splitBg}`,
      display:"flex",flexDirection:"column",
      // Op mobile als absolute overlay
      ...(window.innerWidth<768 ? {
        position:"absolute",right:0,top:0,bottom:0,zIndex:20,
        boxShadow:"-4px 0 20px rgba(0,0,0,0.5)"
      } : {}),
    }},
      React.createElement("div",{style:{background:W.statusBg,borderBottom:`1px solid ${W.splitBg}`,padding:"6px 10px",display:"flex",alignItems:"center",gap:"6px",flexShrink:0}},
        React.createElement("span",{style:{fontSize:"11px",color:W.statusFg,letterSpacing:"1px"}},"ANNOTATIES"),
        React.createElement("span",{style:{background:W.blue,color:W.bg,borderRadius:"10px",padding:"0 6px",fontSize:"10px"}},highlights.length),
        React.createElement("div",{style:{flex:1}}),
        filterTag&&React.createElement("button",{onClick:()=>setFilterTag(null),style:{background:"rgba(159,202,86,0.15)",color:W.comment,border:`1px solid rgba(159,202,86,0.3)`,borderRadius:"3px",fontSize:"10px",padding:"1px 6px",cursor:"pointer"}},"#",filterTag," ×"),
        React.createElement("button",{onClick:()=>setShowAnnotPanel(false),style:{background:"none",border:"none",color:W.fgMuted,fontSize:"16px",cursor:"pointer",padding:"0 2px",lineHeight:1}}, "×")
      ),
      allAnnotTags.length>0&&React.createElement("div",{style:{padding:"5px 8px",borderBottom:`1px solid ${W.splitBg}`,display:"flex",gap:"3px",flexWrap:"wrap",background:"rgba(0,0,0,0.15)"}},
        allAnnotTags.map(t=>React.createElement("span",{key:t,onClick:()=>setFilterTag(filterTag===t?null:t),style:{fontSize:"9px",padding:"1px 5px",borderRadius:"3px",cursor:"pointer",background:filterTag===t?"rgba(159,202,86,0.3)":"rgba(159,202,86,0.08)",color:W.comment,border:`1px solid rgba(159,202,86,${filterTag===t?0.5:0.15})`}},"#",t))
      ),
      React.createElement("div",{style:{flex:1,overflow:"auto"}},
        panelHl.length===0
          ?React.createElement("div",{style:{padding:"28px 14px",color:W.fgMuted,fontSize:"11px",textAlign:"center",lineHeight:"1.9"}},filterTag?`Geen annotaties met #${filterTag}`:"Selecteer tekst in de PDF")
          :panelHl.map(h=>{
            const col=HCOLORS.find(c=>c.id===h.colorId)||HCOLORS[0];
            const isEditing=editingId===h.id;
            return React.createElement("div",{key:h.id,style:{borderBottom:`1px solid ${W.splitBg}`,borderLeft:`3px solid ${col.border}`,background:isEditing?"rgba(255,255,255,0.025)":"transparent"}},
              React.createElement("div",{style:{padding:"8px 10px",cursor:"pointer"},onClick:()=>setEditingId(isEditing?null:h.id)},
                React.createElement("div",{style:{fontSize:"11px",color:W.string,fontStyle:"italic",lineHeight:"1.5",marginBottom:"3px"}},'"',h.text.substring(0,70),h.text.length>70?"…":"",'"'),
                h.note&&!isEditing&&React.createElement("div",{style:{fontSize:"11px",color:W.fg,lineHeight:"1.4",marginBottom:"4px"}},h.note.substring(0,60),h.note.length>60?"…":""),
                React.createElement("div",{style:{display:"flex",gap:"3px",flexWrap:"wrap",alignItems:"center"}},
                  ...(h.tags||[]).map(t=>React.createElement(TagPill,{key:t,tag:t,small:true})),
                  React.createElement("span",{style:{fontSize:"9px",color:W.fgMuted,marginLeft:"auto"}},"p.",h.page),
                  React.createElement("span",{style:{fontSize:"9px",color:W.splitBg}},isEditing?"▲":"▼")
                )
              ),
              isEditing&&React.createElement("div",{style:{padding:"0 10px 12px",borderTop:`1px solid ${W.splitBg}`}},
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,margin:"8px 0 4px",letterSpacing:"1px"}},"NOTITIE"),
                React.createElement("textarea",{value:h.note||"",onChange:e=>updateHighlight(h.id,{note:e.target.value}),rows:3,style:{width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"4px",padding:"6px 8px",color:W.fg,fontSize:"11px",outline:"none",resize:"vertical"},placeholder:"Notitie toevoegen…"}),
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,margin:"8px 0 4px",letterSpacing:"1px"}},"TAGS"),
                React.createElement(TagEditor,{tags:h.tags||[],onChange:tags=>updateHighlight(h.id,{tags}),allTags:[...allTags,...allAnnotTags]}),
                React.createElement("div",{style:{display:"flex",gap:"5px",margin:"8px 0"}},...HCOLORS.map(c=>React.createElement("button",{key:c.id,onClick:()=>updateHighlight(h.id,{colorId:c.id}),style:{width:"18px",height:"18px",borderRadius:"3px",background:c.bg,border:`2px solid ${h.colorId===c.id?c.border:W.splitBg}`,cursor:"pointer",padding:0}}))),
                React.createElement("div",{style:{display:"flex",gap:"6px"}},
                  React.createElement("button",{onClick:()=>setEditingId(null),style:{background:W.comment,color:W.bg,border:"none",borderRadius:"3px",padding:"3px 10px",fontSize:"10px",cursor:"pointer",fontWeight:"bold"}},"✓ klaar"),
                  React.createElement("button",{onClick:()=>removeHighlight(h.id),style:{background:"none",color:W.orange,border:`1px solid rgba(229,120,109,0.3)`,borderRadius:"3px",padding:"3px 8px",fontSize:"10px",cursor:"pointer"}},":del")
                )
              )
            );
          })
      )
    )
  );
};


// ── Vault Settings Panel ───────────────────────────────────────────────────────
const VaultSettings = ({vaultPath, onChangeVault, onClose}) => {
  const [newPath, setNewPath] = useState(vaultPath);
  const [msg,     setMsg]     = useState("");

  const apply = async () => {
    if (!newPath.trim()) return;
    try {
      const r = await api.post("/vault", {path: newPath.trim()});
      setMsg("✓ Vault gewijzigd naar: " + r.vault_path + " — herlaad de pagina");
      onChangeVault(r.vault_path);
    } catch(e) { setMsg("✗ Fout: " + e.message); }
  };

  return React.createElement("div",{
    style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000}
  ,onClick:e=>{if(e.target===e.currentTarget)onClose();}},
    React.createElement("div",{style:{background:W.bg2,border:`1px solid ${W.splitBg}`,borderRadius:"8px",width:"500px",overflow:"hidden",boxShadow:"0 16px 64px rgba(0,0,0,0.8)"}},
      React.createElement("div",{style:{background:W.statusBg,borderBottom:`1px solid ${W.splitBg}`,padding:"10px 16px",display:"flex",alignItems:"center"}},
        React.createElement("span",{style:{color:W.statusFg,fontSize:"12px",letterSpacing:"2px",fontWeight:"bold"}},":VAULT INSTELLINGEN"),
        React.createElement("div",{style:{flex:1}}),
        React.createElement("button",{onClick:onClose,style:{background:"none",border:"none",color:W.fgMuted,fontSize:"18px",cursor:"pointer"}},"×")
      ),
      React.createElement("div",{style:{padding:"20px"}},
        React.createElement("div",{style:{fontSize:"10px",color:W.comment,letterSpacing:"2px",marginBottom:"8px"}},"📁 VAULT MAP"),
        React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,lineHeight:"1.7",marginBottom:"12px"}},
          "De vault map bevat alle notities (.md), PDF bestanden en annotaties.\nVerander het pad om een andere vault te gebruiken."
        ),
        React.createElement("div",{style:{background:"rgba(0,0,0,0.25)",borderRadius:"4px",padding:"10px 12px",marginBottom:"12px",fontSize:"11px"}},
          React.createElement("div",{style:{color:W.fgMuted,marginBottom:"4px"}},"Huidige vault:"),
          React.createElement("div",{style:{color:W.yellow,wordBreak:"break-all"}},vaultPath),
          React.createElement("div",{style:{color:W.fgMuted,fontSize:"10px",marginTop:"6px"}},"Structuur:"),
          React.createElement("div",{style:{color:W.fgDim,fontSize:"10px",lineHeight:"1.8",marginTop:"2px"}},
            vaultPath+"/notes/      ← markdown notities\n"+
            vaultPath+"/pdfs/       ← pdf bestanden\n"+
            vaultPath+"/annotations/ ← pdf annotaties\n"+
            vaultPath+"/config.json  ← vault configuratie"
          )
        ),
        React.createElement("div",{style:{fontSize:"10px",color:W.comment,letterSpacing:"2px",marginBottom:"8px"}},"📂 NIEUW PAD"),
        React.createElement("div",{style:{display:"flex",gap:"8px",marginBottom:"10px"}},
          React.createElement("input",{
            value:newPath,onChange:e=>setNewPath(e.target.value),
            placeholder:"/pad/naar/vault of ~/Zettelkasten",
            style:{flex:1,background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"4px",padding:"7px 10px",color:W.fg,fontSize:"12px",outline:"none"}
          }),
          React.createElement("button",{onClick:apply,style:{background:W.blue,color:W.bg,border:"none",borderRadius:"4px",padding:"7px 16px",fontSize:"11px",cursor:"pointer",fontWeight:"bold"}},"Toepassen")
        ),
        msg&&React.createElement("div",{style:{fontSize:"11px",padding:"6px 10px",background:msg.startsWith("✓")?"rgba(159,202,86,0.1)":"rgba(229,120,109,0.1)",borderRadius:"3px",color:msg.startsWith("✓")?W.comment:W.orange}},msg),
        React.createElement("div",{style:{marginTop:"16px",fontSize:"10px",color:W.fgMuted,lineHeight:"1.8",background:"rgba(0,0,0,0.15)",borderRadius:"4px",padding:"8px 12px"}},
          "💡 Tip: start de server met een ander vault pad:",React.createElement("br"),
          React.createElement("code",{style:{color:W.string}},"python3 server.py --vault /pad/naar/andere/vault"),
          React.createElement("br"),"of laat de gebruiker de locatie instellen via dit paneel."
        )
      )
    )
  );
};

// ── Main App ───────────────────────────────────────────────────────────────────

// ── Responsive App ─────────────────────────────────────────────────────────────
// Breakpoints:
//   mobile  < 768px  : bottom nav + slide-in drawer
//   tablet  768–1200 : inklapbare sidebar met toggle
//   desktop > 1200px : volledige 3-kolom layout

const useWindowSize = () => {
  const [size, setSize] = React.useState({w: window.innerWidth, h: window.innerHeight});
  React.useEffect(() => {
    const fn = () => setSize({w: window.innerWidth, h: window.innerHeight});
    window.addEventListener("resize", fn);
    window.addEventListener("orientationchange", fn);
    return () => { window.removeEventListener("resize", fn); window.removeEventListener("orientationchange", fn); };
  }, []);
  return size;
};

const App = () => {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  const [notes,        setNotes]       = useState([]);
  const [selId,        setSelId]       = useState(null);
  const [vimMode,      setVimMode]     = useState(false);
  const [editTitle,    setEditTitle]   = useState("");
  const [editContent,  setEditContent] = useState("");
  const [editTags,     setEditTags]    = useState([]);
  const [tab,          setTab]         = useState("notes");
  const [search,       setSearch]      = useState("");
  const [pdfNotes,     setPdfNotes]    = useState([]);
  const [serverPdfs,   setServerPdfs]  = useState([]);
  const [tagFilter,    setTagFilter]   = useState(null);
  const [showSettings, setShowSettings]= useState(false);
  const [vaultPath,    setVaultPath]   = useState("…");
  const [goyoMode,     setGoyoMode]    = useState(false);
  const [loaded,       setLoaded]      = useState(false);
  const [error,        setError]       = useState(null);
  const [sidebarOpen,  setSidebarOpen] = useState(false); // mobile/tablet drawer

  const {w: winW} = useWindowSize();
  const isMobile  = winW < 768;
  const isTablet  = winW >= 768 && winW < 1200;
  const isDesktop = winW >= 1200;

  // Op desktop sidebar altijd open; tablet/mobile via toggle
  const showSidebar  = isDesktop || sidebarOpen;
  const sidebarW     = isMobile ? Math.min(winW - 40, 320) : 240;
  const showMeta     = isDesktop && !goyoMode;

  // ── Data laden ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [ns,as,ps,cfg] = await Promise.all([
          api.get("/notes"), api.get("/annotations"),
          api.get("/pdfs"),  api.get("/config"),
        ]);
        setNotes(ns); setPdfNotes(as); setServerPdfs(ps);
        setVaultPath(cfg.vault_path || "…");
        if (ns.length > 0) setSelId(ns[0].id);
        setLoaded(true);
      } catch(e) {
        setError("Kan server niet bereiken.\nStart de server met: python3 server.py");
      }
    };
    load();
  }, []);

  const refreshPdfs = async () => { setServerPdfs(await api.get("/pdfs")); };

  // ── Note helpers ──────────────────────────────────────────────────────────
  const selNote    = notes.find(n => n.id === selId);
  const allTags    = useMemo(() => [...new Set([
    ...notes.flatMap(n => n.tags||[]),
    ...pdfNotes.flatMap(p => p.tags||[])
  ])], [notes, pdfNotes]);
  const sidebarTags = useMemo(() => [...new Set(notes.flatMap(n => n.tags||[]))], [notes]);
  const filtered    = useMemo(() => {
    const base = search
      ? notes.filter(n => n.title?.toLowerCase().includes(search.toLowerCase())
          || n.content?.toLowerCase().includes(search.toLowerCase())
          || n.tags?.some(t => t.includes(search.toLowerCase())))
      : notes;
    return tagFilter ? base.filter(n => (n.tags||[]).includes(tagFilter)) : base;
  }, [notes, search, tagFilter]);

  const titleRef   = useRef(null);
  const contentRef = useRef(null);

  const todayHeader = () => {
    const d   = new Date();
    const dag = ["zondag","maandag","dinsdag","woensdag","donderdag","vrijdag","zaterdag"][d.getDay()];
    return `${dag} ${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}-${d.getFullYear()}`;
  };

  const newNote = async () => {
    const id      = genId();
    const content = `# Nieuw zettel\n\n*${todayHeader()}*\n\n`;
    const n = {id, title:"Nieuw zettel", content, tags:[],
               created: new Date().toISOString(), modified: new Date().toISOString()};
    const saved = await api.post("/notes", n);
    setNotes(p => [saved,...p]); setSelId(id);
    setEditTitle(""); setEditContent(content); setEditTags([]);
    setVimMode(true);
    setSidebarOpen(false); // sluit drawer op mobile na aanmaken
    setTimeout(() => { titleRef.current?.focus(); titleRef.current?.select(); }, 80);
  };

  const openEdit = () => {
    if (!selNote) return;
    setEditTitle(selNote.title);
    setEditContent(selNote.content);
    setEditTags(selNote.tags || []);
    setVimMode(true);
    setSidebarOpen(false);
    setTimeout(() => { contentRef.current?.focus(); }, 80);
  };

  const save = async () => {
    const updated = {...selNote, title:editTitle, content:editContent,
      tags:[...new Set([...editTags,...extractTags(editContent)])]};
    const saved = await api.put("/notes/"+selId, updated);
    setNotes(prev => prev.map(n => n.id===selId ? saved : n));
  };

  const closeEdit = () => setVimMode(false);

  const del = async () => {
    if (!selNote || !window.confirm("Verwijder dit zettel?")) return;
    await api.del("/notes/"+selId);
    const rest = notes.filter(n => n.id !== selId);
    setNotes(rest); setSelId(rest[0]?.id || null); setVimMode(false);
  };

  const backlinks = useMemo(() =>
    selId ? notes.filter(n => extractLinks(n.content).includes(selId)) : [],
  [notes, selId]);

  const handleLink = e => {
    const el = e.target.closest(".zlink"); if (!el) return;
    const n  = notes.find(x => x.id===el.dataset.id || x.title===el.dataset.id);
    if (n) { setSelId(n.id); setVimMode(false); }
  };

  const selectNote = (id) => {
    setSelId(id);
    setVimMode(false);
    if (!isDesktop) setSidebarOpen(false); // sluit drawer na selectie
  };

  // ── Error / loading ───────────────────────────────────────────────────────
  if (error) return React.createElement("div", {
    style:{display:"flex",alignItems:"center",justifyContent:"center",
           height:"100vh",background:W.bg,color:W.fg,
           flexDirection:"column",gap:"16px",padding:"32px",textAlign:"center"}
  },
    React.createElement("div", {style:{fontSize:"36px"}}, "⚠️"),
    React.createElement("div", {style:{fontSize:"15px",color:W.orange}}, "Server niet bereikbaar"),
    React.createElement("pre", {style:{fontSize:"12px",color:W.fgMuted,
      background:W.bg2,padding:"16px",borderRadius:"8px",
      border:`1px solid ${W.splitBg}`,lineHeight:"1.8",maxWidth:"400px",
      whiteSpace:"pre-wrap",textAlign:"left"}}, error),
    React.createElement("div", {style:{fontSize:"11px",color:W.fgDim}},
      "Zorg dat server.py draait, ververs dan de pagina.")
  );

  if (!loaded) return React.createElement("div", {
    style:{display:"flex",alignItems:"center",justifyContent:"center",
           height:"100vh",background:W.bg,color:W.blue,fontSize:"14px"}
  }, "Zettelkasten laden…");

  // ── Sidebar inhoud ────────────────────────────────────────────────────────
  const sidebarContent = React.createElement("div", {
    style:{display:"flex",flexDirection:"column",height:"100%",background:W.bg2}
  },
    // Header
    React.createElement("div", {
      style:{padding:"10px 10px 8px",background:W.statusBg,
             borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}
    },
      // Sluit-knop op mobile/tablet
      !isDesktop && React.createElement("div", {
        style:{display:"flex",justifyContent:"space-between",
               alignItems:"center",marginBottom:"8px"}
      },
        React.createElement("span", {
          style:{fontSize:"11px",fontWeight:"bold",
                 letterSpacing:"2px",color:W.statusFg}
        }, "NOTITIES"),
        React.createElement("button", {
          onClick: () => setSidebarOpen(false),
          style:{background:"none",border:"none",color:W.fgMuted,
                 fontSize:"18px",cursor:"pointer",padding:"0 4px",lineHeight:1}
        }, "×")
      ),
      React.createElement("button", {
        onClick: newNote,
        style:{background:W.blue,color:W.bg,border:"none",
               borderRadius:"6px",padding:"8px",fontSize:"12px",
               cursor:"pointer",fontWeight:"bold",letterSpacing:"1px",
               width:"100%",marginBottom:"6px"}
      }, "+ nieuw zettel"),
      React.createElement("input", {
        value:search, onChange:e=>setSearch(e.target.value),
        placeholder:"/zoeken…",
        style:{background:W.bg,border:`1px solid ${W.splitBg}`,
               borderRadius:"6px",padding:"7px 10px",color:W.fg,
               fontSize:"13px",outline:"none",width:"100%",
               WebkitAppearance:"none"} // iOS styling reset
      })
    ),
    // Tags filter
    sidebarTags.length > 0 && React.createElement("div", {
      style:{padding:"6px 8px",borderBottom:`1px solid ${W.splitBg}`,
             display:"flex",gap:"4px",flexWrap:"wrap",
             background:"rgba(0,0,0,0.1)",flexShrink:0}
    },
      sidebarTags.map(t => React.createElement("span", {
        key:t, onClick:()=>setTagFilter(tagFilter===t?null:t),
        style:{fontSize:"10px",padding:"2px 6px",borderRadius:"4px",
               cursor:"pointer",userSelect:"none",
               background:tagFilter===t?"rgba(159,202,86,0.3)":"rgba(159,202,86,0.08)",
               color:W.comment,
               border:`1px solid rgba(159,202,86,${tagFilter===t?0.5:0.15})`}
      }, "#", t))
    ),
    // Lijst
    React.createElement("div", {style:{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch"}},
      filtered.map(n => {
        const sel = n.id === selId;
        return React.createElement("div", {
          key: n.id,
          onClick: () => selectNote(n.id),
          style:{padding:"10px 12px",borderBottom:`1px solid ${W.splitBg}`,
                 cursor:"pointer",background:sel?W.visualBg:"transparent",
                 borderLeft:`3px solid ${sel?W.yellow:"transparent"}`,
                 // grotere tap-targets op touch
                 minHeight:"52px"}
        },
          React.createElement("div", {
            style:{fontSize:"13px",color:sel?W.statusFg:W.fg,
                   lineHeight:"1.35",marginBottom:"3px",fontWeight:sel?"bold":"normal"}
          }, n.title),
          React.createElement("div", {
            style:{fontSize:"10px",color:W.fgMuted,marginBottom:"4px"}
          }, n.id?.substring(0,12)),
          n.tags?.length > 0 && React.createElement("div", {
            style:{display:"flex",flexWrap:"wrap",gap:"3px"}
          }, n.tags.slice(0,3).map(t =>
            React.createElement(TagPill, {key:t,tag:t,small:true})
          ))
        );
      })
    )
  );

  // ── Tab bar (gedeeld tussen top en bottom nav) ────────────────────────────
  const tabs = [
    {id:"notes", icon:"📝", label:"Notities"},
    {id:"graph", icon:"🕸",  label:"Graaf"},
    {id:"pdf",   icon:"📄", label:"PDF"},
  ];

  // ── Top bar (desktop/tablet) ──────────────────────────────────────────────
  const topBar = !isMobile && React.createElement("div", {
    style:{height:"44px",background:W.statusBg,
           borderBottom:`1px solid ${W.splitBg}`,
           display:"flex",alignItems:"center",flexShrink:0,gap:0}
  },
    // Logo
    React.createElement("div", {
      style:{background:W.blue,color:W.bg,padding:"0 16px",
             height:"100%",display:"flex",alignItems:"center",
             fontWeight:"bold",fontSize:"12px",letterSpacing:"2px",
             flexShrink:0}
    }, "ZETTELKASTEN"),
    // Sidebar toggle op tablet
    isTablet && React.createElement("button", {
      onClick: () => setSidebarOpen(p => !p),
      style:{background:sidebarOpen?"rgba(138,198,242,0.15)":"none",
             border:"none",borderRight:`1px solid ${W.splitBg}`,
             color:sidebarOpen?W.blue:W.fgMuted,
             padding:"0 14px",height:"100%",
             fontSize:"16px",cursor:"pointer"}
    }, "☰"),
    // Tabs
    tabs.map(({id,label}) => React.createElement("button", {
      key:id, onClick:()=>setTab(id),
      style:{background:tab===id?W.bg:"transparent",
             color:tab===id?W.statusFg:W.fgMuted,
             border:"none",borderRight:`1px solid ${W.splitBg}`,
             padding:"0 18px",height:"100%",fontSize:"12px",
             cursor:"pointer",letterSpacing:"1px",
             borderBottom:tab===id?`2px solid ${W.yellow}`:"2px solid transparent"}
    }, label)),
    React.createElement("div", {style:{flex:1}}),
    // Stats
    React.createElement("div", {
      style:{padding:"0 10px",fontSize:"10px",color:W.fgMuted,
             display:"flex",gap:"10px",alignItems:"center"}
    },
      React.createElement("span", null, notes.length, " zettels"),
      React.createElement("span", null, allTags.length, " tags"),
      React.createElement("span", {style:{color:W.splitBg}}, "│"),
      React.createElement("span", {
        style:{color:W.fgDim,maxWidth:"180px",overflow:"hidden",
               textOverflow:"ellipsis",whiteSpace:"nowrap",
               fontSize:"9px",cursor:"pointer"},
        onClick:()=>setShowSettings(true),
        title:vaultPath
      }, "📁 ", vaultPath.split("/").slice(-2).join("/"))
    ),
    React.createElement("button", {
      onClick:()=>setShowSettings(true),
      style:{background:"none",border:`1px solid ${W.splitBg}`,
             borderRadius:"4px",padding:"4px 12px",color:W.fgMuted,
             fontSize:"11px",cursor:"pointer",margin:"0 10px",
             letterSpacing:"1px"}
    }, "⚙ instellingen")
  );

  // ── Mobile top bar ────────────────────────────────────────────────────────
  const mobileTopBar = isMobile && React.createElement("div", {
    style:{height:"48px",background:W.statusBg,
           borderBottom:`1px solid ${W.splitBg}`,
           display:"flex",alignItems:"center",
           padding:"0 12px",flexShrink:0,gap:"8px"}
  },
    React.createElement("button", {
      onClick:()=>setSidebarOpen(p=>!p),
      style:{background:"none",border:`1px solid ${W.splitBg}`,
             borderRadius:"6px",color:W.fgMuted,
             fontSize:"18px",padding:"4px 10px",cursor:"pointer"}
    }, "☰"),
    React.createElement("div", {
      style:{flex:1,fontWeight:"bold",fontSize:"13px",
             letterSpacing:"2px",color:W.statusFg}
    }, "ZETTELKASTEN"),
    React.createElement("button", {
      onClick:()=>setShowSettings(true),
      style:{background:"none",border:"none",color:W.fgMuted,
             fontSize:"18px",cursor:"pointer",padding:"4px"}
    }, "⚙")
  );

  // ── Bottom nav (mobile) ───────────────────────────────────────────────────
  const bottomNav = isMobile && React.createElement("div", {
    style:{height:"56px",background:W.statusBg,
           borderTop:`1px solid ${W.splitBg}`,
           display:"flex",flexShrink:0,
           // Safe area voor iPhone home indicator
           paddingBottom:"env(safe-area-inset-bottom,0px)"}
  },
    tabs.map(({id,icon,label}) => React.createElement("button", {
      key:id, onClick:()=>setTab(id),
      style:{flex:1,background:"none",border:"none",
             borderTop:tab===id?`2px solid ${W.yellow}`:"2px solid transparent",
             color:tab===id?W.yellow:W.fgMuted,
             display:"flex",flexDirection:"column",
             alignItems:"center",justifyContent:"center",
             gap:"2px",cursor:"pointer",fontSize:"18px",
             paddingTop:"6px"}
    },
      React.createElement("span", null, icon),
      React.createElement("span", {style:{fontSize:"10px",letterSpacing:"0.5px"}}, label)
    ))
  );

  // ── Sidebar overlay (mobile/tablet drawer) ────────────────────────────────
  const sidebarOverlay = !isDesktop && sidebarOpen && React.createElement(React.Fragment, null,
    // Backdrop
    React.createElement("div", {
      onClick:()=>setSidebarOpen(false),
      style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",
             zIndex:100,backdropFilter:"blur(2px)"}
    }),
    // Drawer
    React.createElement("div", {
      style:{position:"fixed",top:0,left:0,bottom:0,
             width:`${sidebarW}px`,zIndex:101,
             boxShadow:"4px 0 20px rgba(0,0,0,0.5)",
             display:"flex",flexDirection:"column"}
    }, sidebarContent)
  );

  // ── Editor toolbar ────────────────────────────────────────────────────────
  const editorToolbar = React.createElement("div", {
    style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,
           padding:"6px 10px",display:"flex",
           alignItems:"center",gap:"6px",flexShrink:0,
           flexWrap: isMobile ? "wrap" : "nowrap"}
  },
    React.createElement("input", {
      ref:titleRef, value:editTitle,
      onChange:e=>setEditTitle(e.target.value),
      placeholder:"Titel… (Enter = naar tekstveld)",
      onKeyDown:e=>{
        if(e.key==="Enter"){ e.preventDefault(); contentRef.current?.focus(); }
        if(e.key==="Escape"){ closeEdit(); }
      },
      style:{flex:1,minWidth:"120px",background:"transparent",
             border:"none",color:W.statusFg,
             fontSize: isMobile ? "15px" : "16px",
             fontWeight:"bold",outline:"none",
             WebkitAppearance:"none"}
    }),
    // Knoppen — groter op touch
    ...[
      {label:"◎ focus", show:true, onClick:()=>setGoyoMode(!goyoMode),
       active:goyoMode, color:goyoMode?W.comment:W.fgMuted},
      {label:"✓ opslaan", show:true, onClick:()=>{save();closeEdit();},
       color:W.comment, bg:W.comment, fgColor:W.bg, bold:true},
      {label:"✕ sluiten", show:true, onClick:closeEdit, color:W.fgMuted},
      {label:"🗑 del", show:!isMobile, onClick:del, color:W.orange},
    ].filter(b=>b.show).map((b,i) => React.createElement("button", {
      key:i, onClick:b.onClick,
      style:{background:b.bg?"none":"none",
             border:`1px solid ${b.bg||W.splitBg}`,
             borderRadius:"6px",
             padding: isMobile ? "7px 12px" : "4px 10px",
             color: b.fgColor || b.color,
             fontSize: isMobile ? "13px" : "11px",
             cursor:"pointer",
             fontWeight:b.bold?"bold":"normal",
             background: b.bg || (b.active?"rgba(159,202,86,0.15)":"none"),
             flexShrink:0,
             WebkitTapHighlightColor:"transparent"}
    }, b.label))
  );

  // ── Preview toolbar ───────────────────────────────────────────────────────
  const previewToolbar = React.createElement("div", {
    style:{display:"flex",gap:"6px",marginBottom:"16px",
           paddingBottom:"10px",borderBottom:`1px solid ${W.splitBg}`,
           alignItems:"center",flexWrap:"wrap"}
  },
    React.createElement("span", {
      style:{fontSize:"10px",color:W.fgMuted}
    }, selNote.id),
    ...(selNote.tags||[]).map(t => React.createElement(TagPill, {
      key:t, tag:t,
      onRemove: async t => {
        const updated = {...selNote, tags:(selNote.tags||[]).filter(x=>x!==t)};
        const saved   = await api.put("/notes/"+selId, updated);
        setNotes(prev => prev.map(n => n.id===selId ? saved : n));
      }
    })),
    React.createElement("div", {style:{flex:1}}),
    React.createElement("button", {
      onClick:openEdit,
      style:{background:"none",color:W.blue,
             border:`1px solid rgba(138,198,242,0.3)`,
             borderRadius:"6px",
             padding: isMobile ? "8px 16px" : "5px 12px",
             fontSize: isMobile ? "14px" : "11px",
             cursor:"pointer",
             WebkitTapHighlightColor:"transparent"}
    }, "✏ bewerken"),
    !isMobile && React.createElement("button", {
      onClick:del,
      style:{background:"none",color:W.orange,
             border:`1px solid rgba(229,120,109,0.2)`,
             borderRadius:"6px",padding:"5px 10px",
             fontSize:"11px",cursor:"pointer"}
    }, "🗑 del")
  );

  // ── Meta panel ────────────────────────────────────────────────────────────
  const metaPanel = showMeta && React.createElement("div", {
    className:"meta-panel",
    style:{width:"180px",flexShrink:0,background:W.bg2,
           borderLeft:`1px solid ${W.splitBg}`,
           padding:"14px 12px",fontSize:"11px",overflowY:"auto"}
  },
    React.createElement("div",{style:{color:W.fgMuted,fontSize:"9px",marginBottom:"4px",letterSpacing:"1px"}},"ID"),
    React.createElement("div",{style:{color:W.comment,wordBreak:"break-all",marginBottom:"14px",fontSize:"10px"}},selNote.id),
    React.createElement("div",{style:{color:W.fgMuted,fontSize:"9px",marginBottom:"6px",letterSpacing:"1px"}},"TAGS"),
    React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:"4px",marginBottom:"10px"}},
      ...(selNote.tags||[]).map(t => React.createElement(TagPill,{key:t,tag:t,
        onRemove:async t=>{
          const updated={...selNote,tags:(selNote.tags||[]).filter(x=>x!==t)};
          const saved=await api.put("/notes/"+selId,updated);
          setNotes(prev=>prev.map(n=>n.id===selId?saved:n));
        }})),
      !(selNote.tags||[]).length && React.createElement("span",{style:{fontSize:"10px",color:W.splitBg}},"geen")
    ),
    React.createElement("div",{style:{fontSize:"9px",color:W.splitBg,lineHeight:"2",marginBottom:"14px",padding:"6px 8px",background:"rgba(0,0,0,0.2)",borderRadius:"3px"}},
      [":tag naam1 naam2",":tag+ naam",":tag- naam",":goyo focus",":spell en/nl","Ctrl+J snippet"].map((t,i)=>
        React.createElement("div",{key:i,style:{color:W.fgMuted}},t))
    ),
    extractLinks(selNote.content).length>0 && React.createElement(React.Fragment,null,
      React.createElement("div",{style:{color:W.fgMuted,fontSize:"9px",marginBottom:"6px",letterSpacing:"1px"}},"LINKS →"),
      extractLinks(selNote.content).map(id=>{
        const n=notes.find(x=>x.id===id);
        return React.createElement("div",{key:id,onClick:()=>n&&setSelId(n.id),
          style:{fontSize:"10px",color:n?W.keyword:W.fgMuted,cursor:n?"pointer":"default",
                 padding:"3px 0",borderBottom:`1px solid ${W.splitBg}`,marginBottom:"2px"}
        },"→ ",n?n.title:id);
      })
    ),
    React.createElement("div",{style:{marginTop:"14px",color:W.fgMuted,fontSize:"9px",letterSpacing:"1px",marginBottom:"4px"}},"GEWIJZIGD"),
    React.createElement("div",{style:{fontSize:"10px",color:W.fgDim}},
      selNote.modified?new Date(selNote.modified).toLocaleString("nl-NL"):"—")
  );

  // ── Notes tab content ─────────────────────────────────────────────────────
  const notesContent = React.createElement("div", {
    style:{flex:1,display:"flex",overflow:"hidden"}
  },
    // Desktop sidebar (inline, niet als overlay)
    isDesktop && React.createElement("div", {
      className:"sidebar",
      style:{width:`${sidebarW}px`,flexShrink:0,
             borderRight:`1px solid ${W.splitBg}`,
             display:"flex",flexDirection:"column"}
    }, sidebarContent),

    // Hoofd area
    React.createElement("div", {
      style:{flex:1,display:"flex",flexDirection:"column",
             overflow:"hidden",minWidth:0}
    },
      selNote ? (
        vimMode
          // ── EDITOR modus ──────────────────────────────────────────────
          ? React.createElement("div", {
              className: goyoMode ? "goyo-mode" : "",
              style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}
            },
              !goyoMode && editorToolbar,
              React.createElement(VimEditor, {
                value:editContent, onChange:setEditContent,
                onSave:save, onEscape:closeEdit,
                noteTags:editTags, onTagsChange:setEditTags,
                allTags, goyoMode,
                onToggleGoyo:()=>setGoyoMode(!goyoMode),
                onEditorRef:ref=>{ contentRef.current=ref; },
              })
            )
          // ── PREVIEW modus ─────────────────────────────────────────────
          : React.createElement("div", {
              style:{flex:1,display:"flex",overflow:"hidden"}
            },
              React.createElement("div", {
                style:{flex:1,overflowY:"auto",
                       padding: isMobile ? "16px" : "24px 32px",
                       WebkitOverflowScrolling:"touch"}
              },
                previewToolbar,
                React.createElement("div", {
                  className:"mdv",
                  style:{fontSize: isMobile ? "15px" : "13px",
                         lineHeight: isMobile ? "1.9" : "1.85"},
                  dangerouslySetInnerHTML:{__html:renderMd(selNote.content,notes)},
                  onClick:handleLink
                }),
                backlinks.length>0 && React.createElement("div",{
                  style:{marginTop:"40px",paddingTop:"14px",
                         borderTop:`1px solid ${W.splitBg}`}
                },
                  React.createElement("div",{style:{fontSize:"10px",color:W.fgMuted,letterSpacing:"2px",marginBottom:"8px"}},"BACKLINKS"),
                  backlinks.map(n=>React.createElement("div",{key:n.id,
                    onClick:()=>setSelId(n.id),
                    style:{padding:"8px 10px",cursor:"pointer",
                           background:"rgba(138,198,242,0.06)",
                           border:`1px solid rgba(138,198,242,0.12)`,
                           borderRadius:"6px",marginBottom:"6px",
                           fontSize:"13px",color:W.keyword,
                           WebkitTapHighlightColor:"transparent"}},"← ",n.title))
                )
              ),
              metaPanel
            )
      ) : React.createElement("div", {
        style:{flex:1,display:"flex",alignItems:"center",
               justifyContent:"center",color:W.fgMuted,fontSize:"14px",
               flexDirection:"column",gap:"12px"}
      },
        React.createElement("div",{style:{fontSize:"32px"}},"📝"),
        React.createElement("div",null,"Selecteer een zettel"),
        React.createElement("button",{
          onClick:newNote,
          style:{marginTop:"8px",background:W.blue,color:W.bg,
                 border:"none",borderRadius:"8px",padding:"10px 24px",
                 fontSize:"14px",cursor:"pointer",fontWeight:"bold"}
        },"+ nieuw zettel")
      )
    )
  );

  // ── Hoofd render ──────────────────────────────────────────────────────────
  return React.createElement("div", {
    style:{display:"flex",flexDirection:"column",height:"100vh",
           // Safe area insets voor notches / home indicator
           paddingTop:"env(safe-area-inset-top,0px)",
           paddingLeft:"env(safe-area-inset-left,0px)",
           paddingRight:"env(safe-area-inset-right,0px)",
           background:W.bg,color:W.fg,overflow:"hidden"}
  },
    mobileTopBar,
    topBar,
    showSettings && React.createElement(VaultSettings, {
      vaultPath, onChangeVault:setVaultPath, onClose:()=>setShowSettings(false)
    }),
    sidebarOverlay,

    // Content
    React.createElement("div", {style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}},
      tab==="graph" ? React.createElement("div",{style:{flex:1,overflow:"hidden"}},
        React.createElement(Graph,{notes,pdfNotes,
          onSelect:id=>{setSelId(id);setTab("notes");},
          selectedId:selId})
      )
      : tab==="pdf" ? React.createElement("div",{style:{flex:1,overflow:"hidden"}},
        React.createElement(PDFViewer,{pdfNotes,setPdfNotes,allTags,serverPdfs,onRefreshPdfs:refreshPdfs})
      )
      : notesContent
    ),

    bottomNav
  );
};



// ── Mount ──────────────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));

