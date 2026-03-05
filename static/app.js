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
  async uploadImage(file) {
    const fd=new FormData(); fd.append("file",file,file.name);
    const r=await fetch(API+"/images",{method:"POST",body:fd});
    return r.json();
  },
  async deleteImage(name) {
    const r=await fetch(API+"/images/"+encodeURIComponent(name),{method:"DELETE"});
    return r.json();
  },
  async deletePdf(name) {
    const r=await fetch(API+"/pdfs/"+encodeURIComponent(name),{method:"DELETE"});
    return r.json();
  },
  async llmSummarizePdf(filename,model) {
    const r=await fetch(API+"/llm/summarize-pdf",{method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({filename,model})});
    return r.json();
  },
  async llmDescribeImage(filename,model) {
    const r=await fetch(API+"/llm/describe-image",{method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({filename,model})});
    return r.json();
  },
  async llmMindmap(payload) {
    const r=await fetch(API+"/llm/mindmap",{method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)});
    return r.json();
  },
  async getImgAnnotations()        { const r=await fetch(API+"/img-annotations"); return r.json(); },
  async saveImgAnnotations(annots) { const r=await fetch(API+"/img-annotations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(annots)}); return r.json(); },
  async importUrl(payload)         { const r=await fetch(API+"/import-url",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}); return r.json(); },
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

  // Extraheer media-embeds EERST als placeholders (vóór HTML-escaping)
  const mediaBlocks = [];
  let h = text
    .replace(/!\[\[img:([^\]]+)\]\]/g, (_, name) => {
      const i = mediaBlocks.length;
      const safe = encodeURIComponent(name);
      mediaBlocks.push(
        `<div style="margin:12px 0"><img src="/api/image/${safe}" ` +
        `alt="${name.replace(/"/g,"&quot;")}" ` +
        `style="max-width:100%;border-radius:6px;border:1px solid #3a4046" /></div>`
      );
      return `%%MEDIA${i}%%`;
    })
    .replace(/\[\[pdf:([^\]]+)\]\]/g, (_, name) => {
      const i = mediaBlocks.length;
      const safe = encodeURIComponent(name);
      mediaBlocks.push(
        `<a href="/api/pdf/${safe}" target="_blank" ` +
        `style="color:#8ac6f2;text-decoration:underline">📄 ${name}</a>`
      );
      return `%%MEDIA${i}%%`;
    });

  // Nu HTML-escapen (raakt placeholders niet)
  h = h.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  // Code blocks first (prevent interference) — mermaid mindmap apart behandelen
  const codeBlocks = [];
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const i = codeBlocks.length;
    if (lang === "mindmap") {
      // Mermaid mindmap: toon als speciaal blok met data attribuut
      const escaped = code.replace(/"/g, "&quot;").replace(/\n/g, "&#10;");
      codeBlocks.push(
        `<div class="mermaid-mindmap-block" data-mermaid="${escaped}" ` +
        `style="background:rgba(0,0,0,0.25);border:1px solid rgba(159,202,86,0.3);` +
        `border-radius:8px;padding:12px;margin:10px 0;cursor:pointer" ` +
        `title="Klik om te bewerken">` +
        `<div style="font-size:9px;color:rgba(159,202,86,0.7);letter-spacing:2px;margin-bottom:8px">` +
        `🌿 MERMAID MINDMAP · klik om te bewerken</div>` +
        `<pre style="font-size:11px;color:rgba(159,202,86,0.85);line-height:1.6;margin:0;` +
        `overflow:auto;max-height:120px;background:transparent;border:none;padding:0">` +
        `${code.replace(/</g,"&lt;").replace(/>/g,"&gt;")}</pre></div>`
      );
    } else {
      codeBlocks.push(`<pre><code class="lang-${lang}">${code}</code></pre>`);
    }
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
  mediaBlocks.forEach((blk,i) => { h=h.replace(`%%MEDIA${i}%%`,blk); });

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
      style:{display:"flex",flexWrap:"wrap",gap:"3px",padding:"4px 6px 6px",
        background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"4px",
        cursor:"text",minHeight:"28px",maxHeight:"120px",
        overflow:"auto",
        // Schaalbaar met de muis via resize-handle rechtsonder
        resize:"vertical",
      },
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

  // Geef een object terug met focus() + setCursor(row,col) + insertAtCursor(text)
  useEffect(() => {
    if (onEditorRef) onEditorRef({
      focus: () => inputRef.current?.focus(),
      setCursor: (row, col) => {
        const s = S.current;
        s.cur.row = Math.max(0, Math.min(row, s.lines.length - 1));
        s.cur.col = Math.max(0, Math.min(col, (s.lines[s.cur.row]||"").length));
        scrollToCursor(s);
        inputRef.current?.focus();
        draw();
      },
      insertAtCursor: (text) => {
        const s = S.current;
        // Zorg dat we in INSERT mode zijn
        setMode("INSERT");
        // Voeg elke karakter in (ondersteunt ook newlines via meerdere regels)
        const parts = text.split("\n");
        parts.forEach((part, i) => {
          for (const ch of part) insertChar(s, ch);
          if (i < parts.length - 1) {
            // Newline: splits huidige regel
            const {row, col} = s.cur;
            const before = s.lines[row].slice(0, col);
            const after  = s.lines[row].slice(col);
            s.lines[row] = before;
            s.lines.splice(row + 1, 0, after);
            s.cur.row = row + 1;
            s.cur.col = 0;
          }
        });
        emit(s);
        scrollToCursor(s);
        draw();
        inputRef.current?.focus();
      },
    });
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
      onWheel: (e) => {
        e.preventDefault();
        const s = S.current;
        const lines = e.deltaY > 0 ? 3 : -3;
        s.scroll = Math.max(0, Math.min(s.lines.length - 1, s.scroll + lines));
        draw();
      },
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



// ── Gedeelde TagFilterBar ─────────────────────────────────────────────────────
// Inklapbaar, doorzoekbaar en scrollbaar tag-filter component.
// Props:
//   tags        – array van beschikbare tag-strings
//   activeTag   – huidig actieve tag (null = alles)
//   onChange    – callback(tag|null)
//   compact     – bool, kleinere weergave (default false)
//   tagColors   – optioneel object {tag: kleur}
//   maxVisible  – aantal direct zichtbare tags voor inklappping (default 8)
const TagFilterBar = ({tags=[], activeTag, onChange, compact=false, tagColors={}, maxVisible=8}) => {
  const [open,      setOpen]      = React.useState(false);
  const [search,    setSearch]    = React.useState("");
  const searchRef = React.useRef(null);

  if (!tags.length) return null;

  const sz  = compact ? "9px"  : "10px";
  const pad = compact ? "2px 5px" : "3px 8px";
  const rad = compact ? "3px"  : "5px";
  const gap = compact ? "3px"  : "4px";

  // Filter op zoekopdracht
  const filtered = search
    ? tags.filter(t => t.toLowerCase().includes(search.toLowerCase()))
    : tags;

  // Eerste N tags als "preview" (altijd zichtbaar als ingeklapt)
  const previewTags = filtered.slice(0, maxVisible);
  const hiddenCount = filtered.length - maxVisible;
  const hasMore     = hiddenCount > 0;

  const chipStyle = (t) => {
    const active = t ? activeTag===t : !activeTag;
    const col    = t ? (tagColors[t] || W.comment) : W.blue;
    return {
      fontSize:sz, padding:pad, borderRadius:rad,
      cursor:"pointer", userSelect:"none",
      background: active ? col+"28" : "rgba(255,255,255,0.04)",
      color:      active ? col      : W.fgMuted,
      border:    `1px solid ${active ? col+"60" : W.splitBg}`,
      fontWeight: active ? "600"    : "400",
      transition:"background 0.12s, color 0.12s, border 0.12s",
      whiteSpace:"nowrap",
    };
  };

  const toggleOpen = () => {
    setOpen(o => {
      if (!o) setTimeout(() => searchRef.current?.focus(), 60);
      else setSearch("");
      return !o;
    });
  };

  // Header-rij: "TAGS" label + actief filter + inklapknop
  const header = React.createElement("div",{
    style:{display:"flex", alignItems:"center", gap:"5px",
           marginBottom: open||activeTag ? "5px" : "0"}
  },
    // Inklapknop + label
    React.createElement("span",{
      onClick: toggleOpen,
      style:{
        fontSize:"9px", letterSpacing:"1.5px",
        color: open ? W.blue : W.fgMuted,
        cursor:"pointer", userSelect:"none",
        display:"flex", alignItems:"center", gap:"3px",
        fontWeight: open ? "600" : "400",
        transition:"color 0.12s",
      }
    },
      React.createElement("span",{style:{
        fontSize:"8px", display:"inline-block",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition:"transform 0.15s", lineHeight:1
      }}, "▶"),
      "TAGS"
    ),
    // Badge: aantal tags + actief filter indicator
    React.createElement("span",{style:{
      fontSize:"9px", padding:"1px 5px", borderRadius:"3px",
      background:"rgba(255,255,255,0.05)",
      color: activeTag ? W.comment : W.fgMuted,
      border:`1px solid ${activeTag ? "rgba(159,202,86,0.35)" : W.splitBg}`,
      cursor:"default",
    }},
      activeTag ? `#${activeTag}` : `${tags.length}`
    ),
    // "× wis filter" knopje als er een actief filter is
    activeTag && React.createElement("span",{
      onClick:()=>onChange(null),
      title:"Filter wissen",
      style:{
        fontSize:"9px", color:W.orange, cursor:"pointer",
        padding:"1px 4px", borderRadius:"3px",
        border:`1px solid rgba(229,120,109,0.3)`,
        background:"rgba(229,120,109,0.07)",
        lineHeight:"1.4",
      }
    }, "×")
  );

  // Ingeklapte staat: toon preview-chips + "… N meer" knop
  if (!open) {
    const visibleTags = search ? filtered : previewTags;
    return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"3px"}},
      header,
      React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap,alignItems:"center"}},
        React.createElement("span",{
          onClick:()=>onChange(null), style:chipStyle(null)
        }, "alles"),
        ...visibleTags.map(t => React.createElement("span",{
          key:t, onClick:()=>onChange(activeTag===t ? null : t), style:chipStyle(t)
        }, "#"+t)),
        // "… N meer" knop
        !search && hasMore && React.createElement("span",{
          onClick: toggleOpen,
          style:{
            fontSize:sz, padding:pad, borderRadius:rad,
            cursor:"pointer", userSelect:"none",
            background:"rgba(138,198,242,0.07)",
            color:"rgba(138,198,242,0.55)",
            border:`1px solid rgba(138,198,242,0.18)`,
            fontStyle:"italic",
          }
        }, `+${hiddenCount} meer…`)
      )
    );
  }

  // Uitgeklapte staat: zoekbalk + scrollbare lijst van alle gefilterde tags
  return React.createElement("div",{
    style:{display:"flex",flexDirection:"column",gap:"4px"}
  },
    header,

    // Zoekbalk
    React.createElement("div",{style:{position:"relative"}},
      React.createElement("input",{
        ref: searchRef,
        value: search,
        onChange: e => setSearch(e.target.value),
        placeholder: "tag zoeken…",
        style:{
          width:"100%", boxSizing:"border-box",
          background:"rgba(0,0,0,0.3)",
          border:`1px solid ${search ? W.blue : W.splitBg}`,
          borderRadius:"4px", padding:"4px 22px 4px 7px",
          color:W.fg, fontSize:sz, outline:"none",
          transition:"border-color 0.12s",
        }
      }),
      search && React.createElement("span",{
        onClick:()=>{ setSearch(""); searchRef.current?.focus(); },
        style:{
          position:"absolute", right:"5px", top:"50%",
          transform:"translateY(-50%)",
          fontSize:"10px", color:W.fgMuted, cursor:"pointer",
          lineHeight:1,
        }
      }, "×")
    ),

    // Scrollbare tag-lijst
    React.createElement("div",{style:{
      maxHeight:"180px", overflowY:"auto",
      display:"flex", flexWrap:"wrap", gap,
      alignItems:"flex-start", alignContent:"flex-start",
      padding:"3px 1px",
      // Subtiel scrollbar
      scrollbarWidth:"thin",
      scrollbarColor:`${W.splitBg} transparent`,
    }},
      // "alles" chip altijd bovenaan
      React.createElement("span",{
        onClick:()=>onChange(null), style:chipStyle(null)
      }, "alles"),
      filtered.length === 0
        ? React.createElement("span",{style:{fontSize:sz,color:W.fgMuted,fontStyle:"italic"}},
            "geen tags gevonden")
        : filtered.map(t => React.createElement("span",{
            key:t,
            onClick:()=>onChange(activeTag===t ? null : t),
            style:chipStyle(t)
          }, "#"+t))
    ),

    // Footer: teller
    React.createElement("div",{style:{
      fontSize:"9px", color:W.fgMuted, textAlign:"right",
      paddingRight:"2px",
    }},
      filtered.length < tags.length
        ? `${filtered.length} van ${tags.length} tags`
        : `${tags.length} tags totaal`
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
      React.createElement("div",{style:{fontSize:"9px",color:"rgba(138,198,242,0.5)",
        letterSpacing:"2px",marginBottom:"2px"}},"FILTER OP TAG"),
      React.createElement(TagFilterBar,{
        tags:allGraphTags, activeTag:filterTag,
        onChange:setFilterTag, tagColors, compact:true, maxVisible:6
      }),
      React.createElement("div",{style:{height:"1px",background:"rgba(255,255,255,0.06)",margin:"2px 0"}}),
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
const PDFViewer = ({pdfNotes, setPdfNotes, allTags, serverPdfs, onRefreshPdfs, onAutoSummarize, onDeletePdf}) => {
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
  const [summarizing,   setSummarizing]   = useState(false);  // AI samenvatten bezig
  const [summarizeErr,  setSummarizeErr]  = useState(null);   // foutmelding samenvatten

  const canvasRef   = useRef(null);
  const textLayerRef= useRef(null);
  const wrapRef     = useRef(null);
  const scrollRef   = useRef(null);
  const fileRef     = useRef(null);
  const renderRef   = useRef(null);
  const tlRenderRef = useRef(null);
  const pinchRef    = useRef({active:false, dist0:0, scale0:1.4});

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
      if(!window.pdfjsLib) throw new Error("PDF.js nog niet geladen — herlaad de pagina");
      // Zorg dat workerSrc altijd gezet is
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
    let savedName=file.name;
    setSummarizeErr(null);
    try{
      const res=await api.uploadPdf(file);
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

  // Alleen annotaties van de actief geopende PDF tonen
  const fileHl = pdfFile ? highlights.filter(h=>h.file===pdfFile.name) : [];
  const allAnnotTags=[...new Set(fileHl.flatMap(h=>h.tags||[]))];
  const panelHl = (filterTag ? fileHl.filter(h=>(h.tags||[]).includes(filterTag)) : fileHl)
    .sort((a,b)=>a.page-b.page);  // gesorteerd op pagina

  return React.createElement("div",{style:{display:"flex",height:"100%",background:W.bg,position:"relative"}},
    // Main PDF column
    React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}},
      // Toolbar
      React.createElement("div",{style:{background:W.statusBg,borderBottom:`1px solid ${W.splitBg}`,padding:"5px 10px",display:"flex",alignItems:"center",gap:"8px",fontSize:"12px",flexShrink:0,flexWrap:"wrap"}},
        React.createElement("button",{onClick:()=>fileRef.current.click(),style:{background:W.blue,color:W.bg,border:"none",borderRadius:"4px",padding:"4px 10px",fontSize:"11px",cursor:"pointer",fontWeight:"bold"}},":open PDF"),
        React.createElement("button",{onClick:()=>setShowLibrary(!showLibrary),style:{background:showLibrary?W.comment:"none",color:showLibrary?W.bg:W.fgMuted,border:`1px solid ${showLibrary?W.comment:W.splitBg}`,borderRadius:"4px",padding:"4px 10px",fontSize:"11px",cursor:"pointer"}},`📚 bibliotheek (${serverPdfs?.length||0})`),
        React.createElement("input",{ref:fileRef,type:"file",accept:".pdf",style:{display:"none"},onChange:onFileInput}),
        !pdfjsReady&&React.createElement("span",{style:{color:W.orange,fontSize:"10px"}},"pdf.js laden…"),
        // AI samenvatten indicator
        summarizing && React.createElement("div",{
          style:{display:"flex",alignItems:"center",gap:"5px",
                 background:"rgba(138,198,242,0.08)",
                 border:"1px solid rgba(138,198,242,0.25)",
                 borderRadius:"10px",padding:"2px 10px",
                 color:"#a8d8f0",fontSize:"10px",
                 animation:"ai-pulse 1.4s ease-in-out infinite"}
        },
          React.createElement("span",{style:{
            display:"inline-block",width:"6px",height:"6px",borderRadius:"50%",
            background:"#a8d8f0",animation:"ai-dot 1.4s ease-in-out infinite"}}),
          "Samenvatten…"
        ),
        // Foutmelding samenvatting
        summarizeErr && React.createElement("span",{
          style:{color:W.orange,fontSize:"10px",cursor:"pointer"},
          title:summarizeErr,
          onClick:()=>setSummarizeErr(null)
        },"⚠ samenvatten mislukt ×"),
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
          React.createElement("span",{style:{color:W.fgMuted,fontSize:"10px",marginLeft:"4px",maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},pdfFile?.name),
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
                   fontSize:"10px",cursor:summarizing?"not-allowed":"pointer",
                   marginLeft:"6px",flexShrink:0,opacity:summarizing?0.5:1}
          }, summarizing ? "⏳…" : "🧠 samenvatten"),
          pdfFile&&React.createElement("button",{
            title:"Verwijder deze PDF + annotaties",
            onClick:async()=>{
              if(!confirm(`Verwijder "${pdfFile.name}" en alle annotaties?`)) return;
              const name=pdfFile.name;
              await api.deletePdf(name);
              setPdfDoc(null); setPdfFile(null);
              onRefreshPdfs?.();
              onDeletePdf?.(name);
            },
            style:{background:"rgba(229,120,109,0.1)",border:"1px solid rgba(229,120,109,0.25)",
                   color:W.orange,borderRadius:"4px",padding:"3px 9px",
                   fontSize:"10px",cursor:"pointer",marginLeft:"6px",flexShrink:0}
          },"🗑 verwijder")
        ),
        React.createElement("div",{style:{flex:1}}),
        pdfDoc&&React.createElement("span",{style:{color:W.comment,fontSize:"10px"}},"① selecteer tekst  ② popup  ③ opslaan")
      ),

      // PDF library dropdown
      showLibrary&&React.createElement("div",{style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,padding:"8px 12px",maxHeight:"200px",overflowY:"auto",flexShrink:0}},
        serverPdfs?.length===0
          ? React.createElement("div",{style:{color:W.fgMuted,fontSize:"11px",padding:"8px"}},"Nog geen PDF's opgeslagen. Open een PDF om te beginnen.")
          : (serverPdfs||[]).map(p=>React.createElement("div",{
              key:p.name,
              style:{padding:"5px 8px",borderRadius:"3px",fontSize:"11px",color:W.fg,
                     display:"flex",alignItems:"center",gap:"6px",
                     borderBottom:`1px solid rgba(255,255,255,0.03)`}
            },
              React.createElement("span",{
                onClick:()=>openFromServer(p.name),
                style:{flex:1,cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",
                       whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"5px"}
              },
                React.createElement("span",null,"📄"),
                React.createElement("span",null,p.name)
              ),
              React.createElement("span",{style:{color:W.fgMuted,fontSize:"9px",flexShrink:0}},
                Math.round(p.size/1024),"KB"),
              React.createElement("button",{
                title:"Verwijder PDF + annotaties",
                onClick:async(e)=>{
                  e.stopPropagation();
                  if(!confirm(`Verwijder "${p.name}" en alle annotaties?`)) return;
                  await api.deletePdf(p.name);
                  onRefreshPdfs?.();
                  onDeletePdf?.(p.name);
                  // Als deze PDF open is, sluit dan de viewer
                  if(pdfFile?.name===p.name){ setPdfDoc(null); setPdfFile(null); }
                },
                style:{background:"rgba(229,120,109,0.1)",border:"1px solid rgba(229,120,109,0.25)",
                       color:W.orange,borderRadius:"3px",padding:"2px 7px",
                       fontSize:"10px",cursor:"pointer",flexShrink:0}
              },"🗑")
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
    // Annotatiepaneel — knop om te openen (alleen als PDF open is)
    pdfFile && React.createElement("button",{
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
    }, showAnnotPanel ? "▶" : "◀ " + (fileHl.length > 0 ? fileHl.length : "")),

    // Annotations panel
    pdfFile && showAnnotPanel&&React.createElement("div",{style:{
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
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"1px",flex:1}},
          React.createElement("span",{style:{fontSize:"11px",color:W.statusFg,letterSpacing:"1px"}},"ANNOTATIES"),
          pdfFile&&React.createElement("span",{style:{fontSize:"9px",color:W.fgMuted,maxWidth:"180px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},pdfFile.name)
        ),
        React.createElement("span",{style:{background:W.blue,color:W.bg,borderRadius:"10px",padding:"0 6px",fontSize:"10px"}},fileHl.length),
        React.createElement("div",{style:{flex:1}}),
        filterTag&&React.createElement("button",{onClick:()=>setFilterTag(null),style:{background:"rgba(159,202,86,0.15)",color:W.comment,border:`1px solid rgba(159,202,86,0.3)`,borderRadius:"3px",fontSize:"10px",padding:"1px 6px",cursor:"pointer"}},"#",filterTag," ×"),
        React.createElement("button",{onClick:()=>setShowAnnotPanel(false),style:{background:"none",border:"none",color:W.fgMuted,fontSize:"16px",cursor:"pointer",padding:"0 2px",lineHeight:1}}, "×")
      ),
      allAnnotTags.length>0&&React.createElement("div",{style:{padding:"5px 8px",borderBottom:`1px solid ${W.splitBg}`,background:"rgba(0,0,0,0.15)",flexShrink:0}},
        React.createElement(TagFilterBar,{tags:allAnnotTags,activeTag:filterTag,onChange:setFilterTag,compact:true,maxVisible:5})
      ),
      React.createElement("div",{style:{flex:1,overflow:"auto"}},
        panelHl.length===0
          ?React.createElement("div",{style:{padding:"24px 14px",color:W.fgMuted,fontSize:"11px",textAlign:"center",lineHeight:"2"}},
              !pdfFile
              ? React.createElement(React.Fragment,null,
                  React.createElement("div",{style:{fontSize:"28px",marginBottom:"8px"}},"📄"),
                  React.createElement("div",{style:{color:W.fgDim,marginBottom:"4px"}},"Geen PDF geopend"),
                  React.createElement("div",{style:{fontSize:"10px",color:W.splitBg,lineHeight:"1.7"}},
                    "Open een PDF via de toolbar.","\n","Annotaties worden hier getoond.")
                )
              : filterTag
                ? `Geen annotaties met #${filterTag}`
                : React.createElement(React.Fragment,null,
                    React.createElement("div",{style:{fontSize:"20px",marginBottom:"8px"}},"✏"),
                    React.createElement("div",{style:{color:W.fgDim}},"Nog geen annotaties"),
                    React.createElement("div",{style:{fontSize:"10px",color:W.splitBg,lineHeight:"1.7",marginTop:"4px"}},
                      "Selecteer tekst in de PDF","\n","om een annotatie te maken.")
                  ))
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

// ── ImagesGallery ───────────────────────────────────────────────────────────────
// Tab voor afbeeldingen: upload, AI-beschrijving, notitie aanmaken.
// Annotaties via klikpunt op afbeelding — zelfde methodiek als PDF annotaties.

const ImagesGallery = ({serverImages, onRefresh, llmModel, onAddNote, setAiStatus,
                        notes, onDeleteNote, imgNotes, setImgNotes, allTags}) => {
  const { useState, useRef, useCallback, useEffect, useMemo } = React;

  const [busy,          setBusy]         = useState(null);
  const [descriptions,  setDescs]        = useState({});
  const [lightbox,      setLightbox]     = useState(null);
  const [dragOver,      setDragOver]     = useState(false);

  // Annotatie state — identiek aan PDF
  const [annotations,   setAnnotations]  = useState(imgNotes||[]);
  const [activeImg,     setActiveImg]    = useState(null);    // fname van geselecteerde afbeelding
  const [pendingPin,    setPendingPin]   = useState(null);    // {x,y} fractie van afbeelding
  const [quickNote,     setQuickNote]    = useState("");
  const [quickTags,     setQuickTags]    = useState([]);
  const [activeColor,   setActiveColor]  = useState(HCOLORS[0]);
  const [editingId,     setEditingId]    = useState(null);
  const [showAnnotPanel,setShowAnnotPanel] = useState(true);
  const [filterTag,     setFilterTag]   = useState(null);

  const fileRef   = useRef(null);
  const imgRef    = useRef(null);   // ref naar actieve afbeelding in annotatiemodus

  // Sync imgNotes → lokale state
  useEffect(() => { setAnnotations(imgNotes||[]); }, [imgNotes]);

  const saveAnnotations = useCallback(async (updated) => {
    setAnnotations(updated);
    setImgNotes?.(updated);
    await api.saveImgAnnotations(updated);
  }, [setImgNotes]);

  const addAnnotation = useCallback(async () => {
    if (!pendingPin || !activeImg) return;
    const a = {
      id:      genId(),
      text:    quickNote || "(pin)",
      note:    quickNote,
      tags:    quickTags,
      file:    activeImg,
      x:       pendingPin.x,   // fractie 0–1
      y:       pendingPin.y,
      colorId: activeColor.id,
      created: new Date().toISOString(),
    };
    await saveAnnotations([...annotations, a]);
    setPendingPin(null); setQuickNote(""); setQuickTags([]);
  }, [pendingPin, activeImg, quickNote, quickTags, activeColor, annotations, saveAnnotations]);

  const updateAnnotation = useCallback(async (id, patch) => {
    await saveAnnotations(annotations.map(a => a.id===id ? {...a,...patch} : a));
  }, [annotations, saveAnnotations]);

  const removeAnnotation = useCallback(async (id) => {
    await saveAnnotations(annotations.filter(a => a.id!==id));
    if (editingId===id) setEditingId(null);
  }, [annotations, saveAnnotations, editingId]);

  // Annotaties voor de actieve afbeelding
  const fileAnnots = useMemo(() =>
    activeImg ? annotations.filter(a => a.file===activeImg) : [],
  [annotations, activeImg]);

  const allAnnotTags = useMemo(() =>
    [...new Set(fileAnnots.flatMap(a => a.tags||[]))],
  [fileAnnots]);

  const panelAnnots = (filterTag
    ? fileAnnots.filter(a => (a.tags||[]).includes(filterTag))
    : fileAnnots
  ).sort((a,b) => new Date(a.created) - new Date(b.created));

  // Klik op afbeelding in annotatiemodus → pin plaatsen
  const handleImgClick = useCallback((e) => {
    if (!activeImg) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top)  / rect.height;
    setPendingPin({x, y});
    setQuickNote(""); setQuickTags([]);
    setShowAnnotPanel(true);  // sidebar altijd zichtbaar bij nieuwe pin
  }, [activeImg]);

  const upload = useCallback(async (files) => {
    for (const f of Array.from(files)) {
      if (!f.type.startsWith("image/")) continue;
      setBusy(f.name);
      setAiStatus?.("Uploaden: "+f.name.slice(0,24)+"…");
      try {
        const res = await api.uploadImage(f);
        if (res?.name) {
          await onRefresh();
          describeImage(res.name);
        }
      } catch(e) { console.error("upload:", e); setAiStatus?.(null); }
      setBusy(null);
    }
  }, [onRefresh]);

  const describeImage = useCallback(async (fname) => {
    setBusy(fname);
    const stem = fname.replace(/\.[^.]+$/,"");
    setAiStatus?.("AI beschrijft: "+stem.slice(0,22)+"…");
    try {
      const model = llmModel || "llama3.2-vision";
      const res   = await api.llmDescribeImage(fname, model);
      if (res?.description) {
        setDescs(p=>({...p, [fname]: res.description}));
        if (onAddNote) {
          await onAddNote({
            id: genId(), title: "Afbeelding — "+stem,
            content: "*Automatisch gegenereerd*\n\n![[img:"+fname+"]]\n\n## Beschrijving\n\n"+res.description,
            tags: ["afbeelding","media"],
            created: new Date().toISOString(), modified: new Date().toISOString(),
          });
        }
      } else {
        setDescs(p=>({...p, [fname]: "⚠ Beschrijving niet beschikbaar (ollama pull llama3.2-vision)"}));
      }
    } catch(e) {
      setDescs(p=>({...p, [fname]: "⚠ "+e.message}));
    } finally { setBusy(null); setAiStatus?.(null); }
  }, [llmModel, onAddNote]);

  const deleteImg = useCallback(async (fname) => {
    const linked = (notes||[]).filter(n =>
      n.content?.includes(`![[img:${fname}]]`) ||
      n.title?.includes(fname.replace(/\.[^.]+$/,""))
    );
    const imgAnnotCount = annotations.filter(a => a.file===fname).length;
    const parts = [];
    if (linked.length) parts.push(`${linked.length} notitie(s):\n`+linked.map(n=>"• "+n.title).join("\n"));
    if (imgAnnotCount) parts.push(`${imgAnnotCount} annotatie(s)`);
    const msg = parts.length
      ? `Verwijder "${fname}" én:\n${parts.join("\n")}?`
      : `Verwijder "${fname}"?`;
    if (!confirm(msg)) return;
    await api.deleteImage(fname);
    for (const n of linked) { await api.del("/notes/"+n.id); onDeleteNote?.(n.id); }
    // Verwijder ook annotaties van dit bestand
    if (imgAnnotCount) await saveAnnotations(annotations.filter(a => a.file!==fname));
    setDescs(p=>{ const q={...p}; delete q[fname]; return q; });
    if (activeImg===fname) setActiveImg(null);
    await onRefresh();
  }, [onRefresh, notes, onDeleteNote, annotations, saveAnnotations, activeImg]);

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); };

  const imgs = serverImages || [];

  return React.createElement("div", {
    style:{display:"flex",height:"100%",overflow:"hidden",position:"relative"}
  },

    // ── Hoofdkolom: toolbar + galerij ────────────────────────────────────────
    React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}},

      // Toolbar
      React.createElement("div",{
        style:{background:W.statusBg,borderBottom:`1px solid ${W.splitBg}`,
               padding:"8px 14px",display:"flex",alignItems:"center",
               gap:"10px",flexShrink:0,flexWrap:"wrap"}
      },
        React.createElement("span",{style:{fontSize:"11px",color:W.statusFg,
          letterSpacing:"2px",fontWeight:"bold"}},"AFBEELDINGEN"),
        React.createElement("span",{style:{background:W.blue,color:W.bg,
          borderRadius:"10px",padding:"0 7px",fontSize:"10px"}}, imgs.length),
        activeImg && React.createElement("span",{
          style:{fontSize:"10px",color:W.comment,background:"rgba(159,202,86,0.1)",
                 border:"1px solid rgba(159,202,86,0.3)",borderRadius:"4px",
                 padding:"2px 8px",maxWidth:"180px",overflow:"hidden",
                 textOverflow:"ellipsis",whiteSpace:"nowrap"}
        },"✏ "+activeImg),
        activeImg && React.createElement("button",{
          onClick:()=>{ setActiveImg(null); setPendingPin(null); },
          style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                 borderRadius:"4px",padding:"2px 8px",fontSize:"10px",cursor:"pointer"}
        },"× sluiten"),
        React.createElement("div",{style:{flex:1}}),
        React.createElement("span",{style:{fontSize:"10px",color:W.fgMuted}},
          activeImg ? "klik op afbeelding om een annotatie te plaatsen" : "klik ✏ om te annoteren"),
        React.createElement("button",{
          onClick:()=>fileRef.current?.click(),
          style:{background:W.blue,color:W.bg,border:"none",borderRadius:"6px",
                 padding:"6px 14px",fontSize:"11px",cursor:"pointer",fontWeight:"bold"}
        },"+ upload"),
        React.createElement("input",{
          ref:fileRef, type:"file", multiple:true, accept:"image/*",
          style:{display:"none"},
          onChange:e=>{ upload(e.target.files); e.target.value=""; }
        })
      ),

      // Galerij / annotatie-view
      React.createElement("div",{
        style:{flex:1,overflowY:"auto",padding:"16px",
               background: dragOver?"rgba(138,198,242,0.05)":W.bg,
               WebkitOverflowScrolling:"touch"},
        onDragOver:e=>{ e.preventDefault(); setDragOver(true); },
        onDragLeave:()=>setDragOver(false),
        onDrop,
      },

        // Lege staat
        imgs.length===0 && React.createElement("div",{
          style:{display:"flex",flexDirection:"column",alignItems:"center",
                 justifyContent:"center",height:"60%",gap:"14px",color:W.fgMuted,
                 border:`2px dashed ${dragOver?"rgba(138,198,242,0.5)":W.splitBg}`,
                 borderRadius:"12px",margin:"20px",padding:"40px"}
        },
          React.createElement("div",{style:{fontSize:"48px"}},"🖼"),
          React.createElement("div",{style:{fontSize:"15px",color:W.fgDim}},"Nog geen afbeeldingen"),
          React.createElement("div",{style:{fontSize:"12px",textAlign:"center",lineHeight:"1.7"}},
            "Sleep afbeeldingen hierheen of klik '+ upload'.\n",
            React.createElement("br"),
            "De AI maakt automatisch een beschrijving en een notitie aan."
          ),
          React.createElement("button",{
            onClick:()=>fileRef.current?.click(),
            style:{marginTop:"8px",background:"rgba(138,198,242,0.1)",
                   border:"1px solid rgba(138,198,242,0.3)",color:"#a8d8f0",
                   borderRadius:"8px",padding:"10px 24px",fontSize:"13px",cursor:"pointer"}
          },"+ afbeelding kiezen")
        ),

        // Annotatiemodus: grote weergave met klikbare afbeelding + pinnen
        activeImg && React.createElement("div",{style:{position:"relative",display:"inline-block",maxWidth:"100%"}},
          React.createElement("img",{
            ref:imgRef,
            src:"/api/image/"+encodeURIComponent(activeImg),
            alt:activeImg,
            onClick:handleImgClick,
            style:{maxWidth:"100%",maxHeight:"calc(100vh - 140px)",objectFit:"contain",
                   display:"block",cursor:"crosshair",borderRadius:"6px",
                   boxShadow:"0 4px 24px rgba(0,0,0,0.5)",
                   border:`2px solid ${W.splitBg}`}
          }),

          // Bestaande pins
          ...fileAnnots.map(a => {
            const col = HCOLORS.find(c=>c.id===a.colorId)||HCOLORS[0];
            const isEditing = editingId===a.id;
            return React.createElement("div",{
              key:a.id,
              onClick:e=>{ e.stopPropagation(); setEditingId(isEditing?null:a.id); setPendingPin(null); },
              style:{position:"absolute",
                     left:`calc(${a.x*100}% - 10px)`,
                     top:`calc(${a.y*100}% - 20px)`,
                     zIndex: isEditing ? 20 : 10,
                     cursor:"pointer"}
            },
              // Pin symbool
              React.createElement("div",{style:{
                width:"20px",height:"20px",borderRadius:"50% 50% 50% 0",
                background:col.border,border:"2px solid white",
                transform:"rotate(-45deg)",
                boxShadow:`0 2px 8px rgba(0,0,0,0.6)`,
                transition:"transform 0.1s",
              }}),
              // Tooltip / edit popup boven de pin
              isEditing && React.createElement("div",{
                onClick:e=>e.stopPropagation(),
                style:{position:"absolute",bottom:"28px",left:"-160px",
                       width:"300px",background:W.bg3,
                       border:`2px solid ${col.border}`,borderRadius:"8px",
                       padding:"12px 14px",zIndex:500,
                       boxShadow:"0 8px 32px rgba(0,0,0,0.8)"}
              },
                // Notitietekst
                React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,
                  marginBottom:"8px",padding:"6px 8px",background:col.bg,
                  borderRadius:"4px",fontStyle:"italic",lineHeight:"1.5",
                  borderLeft:`4px solid ${col.border}`}},
                  a.note||"(geen notitie)"),
                // Notitie bewerken
                React.createElement("textarea",{
                  value:a.note||"",
                  onChange:e=>updateAnnotation(a.id,{note:e.target.value}),
                  onKeyDown:e=>{ if(e.key==="Escape") setEditingId(null); },
                  rows:2,
                  placeholder:"Notitie…",
                  style:{width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,
                         borderRadius:"4px",padding:"6px 8px",color:W.fg,
                         fontSize:"11px",outline:"none",resize:"none",marginBottom:"6px"}
                }),
                // Tags
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
                  marginBottom:"4px",letterSpacing:"1px"}},"TAGS"),
                React.createElement(TagEditor,{tags:a.tags||[],
                  onChange:tags=>updateAnnotation(a.id,{tags}),
                  allTags:[...(allTags||[]),...allAnnotTags]}),
                // Kleur
                React.createElement("div",{style:{display:"flex",gap:"5px",margin:"8px 0"}},
                  ...HCOLORS.map(c=>React.createElement("button",{key:c.id,
                    onClick:()=>updateAnnotation(a.id,{colorId:c.id}),
                    style:{width:"18px",height:"18px",borderRadius:"3px",background:c.bg,
                           border:`2px solid ${a.colorId===c.id?c.border:W.splitBg}`,
                           cursor:"pointer",padding:0}}))
                ),
                // Acties
                React.createElement("div",{style:{display:"flex",gap:"6px",marginTop:"4px"}},
                  React.createElement("button",{
                    onClick:()=>setEditingId(null),
                    style:{background:W.comment,color:W.bg,border:"none",borderRadius:"3px",
                           padding:"3px 10px",fontSize:"10px",cursor:"pointer",fontWeight:"bold"}
                  },"✓ klaar"),
                  React.createElement("button",{
                    onClick:()=>removeAnnotation(a.id),
                    style:{background:"none",color:W.orange,
                           border:`1px solid rgba(229,120,109,0.3)`,
                           borderRadius:"3px",padding:"3px 8px",fontSize:"10px",cursor:"pointer"}
                  },":del")
                )
              )
            );
          }),

          // Pending pin: visuele indicator op de afbeelding (invoer loopt via sidebar)
          pendingPin && React.createElement("div",{
            style:{position:"absolute",
                   left:`calc(${pendingPin.x*100}% - 10px)`,
                   top:`calc(${pendingPin.y*100}% - 20px)`,
                   zIndex:30, pointerEvents:"none"}
          },
            React.createElement("div",{style:{
              width:"20px",height:"20px",borderRadius:"50% 50% 50% 0",
              background:activeColor.border,border:"2px solid white",
              transform:"rotate(-45deg)",
              animation:"ai-pulse 0.8s ease-in-out infinite",
            }})
          )
        ),

        // Galerij grid (als geen activeImg)
        !activeImg && imgs.length>0 && React.createElement("div",{
          style:{display:"grid",
                 gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",
                 gap:"14px"}
        },
          imgs.map(img => {
            const desc       = descriptions[img.name];
            const isBusy     = busy===img.name;
            const annotCount = annotations.filter(a=>a.file===img.name).length;
            return React.createElement("div",{
              key:img.name,
              style:{background:W.bg2,border:`1px solid ${W.splitBg}`,
                     borderRadius:"8px",overflow:"hidden",
                     display:"flex",flexDirection:"column",
                     boxShadow:isBusy?"0 0 0 2px rgba(138,198,242,0.4)":"none",
                     transition:"box-shadow 0.2s"}
            },
              // Thumbnail
              React.createElement("div",{
                style:{position:"relative",paddingTop:"60%",background:W.bg,cursor:"pointer"},
                onClick:()=>setLightbox(img.name)
              },
                React.createElement("img",{
                  src:"/api/image/"+encodeURIComponent(img.name),
                  alt:img.name, loading:"lazy",
                  style:{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}
                }),
                isBusy && React.createElement("div",{
                  style:{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",
                         display:"flex",alignItems:"center",justifyContent:"center",
                         color:"#a8d8f0",fontSize:"12px",gap:"6px"}
                },"⏳ AI verwerkt…"),
                // Annotatie-teller badge
                annotCount>0 && React.createElement("div",{
                  style:{position:"absolute",top:"6px",right:"6px",
                         background:"rgba(229,120,109,0.85)",color:"white",
                         borderRadius:"10px",padding:"1px 7px",fontSize:"10px",
                         fontWeight:"bold",backdropFilter:"blur(4px)"}
                },"📌 "+annotCount)
              ),
              // Info
              React.createElement("div",{style:{padding:"10px 12px",flex:1,
                display:"flex",flexDirection:"column",gap:"6px"}},
                React.createElement("div",{style:{fontSize:"11px",color:W.fg,
                  fontWeight:"bold",overflow:"hidden",textOverflow:"ellipsis",
                  whiteSpace:"nowrap"}}, img.name),
                desc
                  ? React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,
                      lineHeight:"1.55",flex:1}}, desc)
                  : React.createElement("button",{
                      onClick:()=>describeImage(img.name), disabled:!!busy,
                      style:{background:"rgba(138,198,242,0.07)",
                             border:"1px solid rgba(138,198,242,0.2)",color:"#a8d8f0",
                             borderRadius:"4px",padding:"4px 10px",fontSize:"10px",
                             cursor:busy?"not-allowed":"pointer",opacity:busy?0.5:1}
                    },"🧠 AI beschrijving genereren"),
                // Acties
                React.createElement("div",{style:{display:"flex",gap:"5px",marginTop:"4px"}},
                  React.createElement("button",{
                    onClick:()=>setLightbox(img.name),
                    style:{flex:1,background:"none",border:`1px solid ${W.splitBg}`,
                           color:W.fgMuted,borderRadius:"4px",padding:"4px",
                           fontSize:"10px",cursor:"pointer"}
                  },"🔍"),
                  React.createElement("button",{
                    onClick:()=>{ setActiveImg(img.name); setPendingPin(null); setEditingId(null); setFilterTag(null); },
                    style:{flex:1,background:"rgba(229,120,109,0.08)",
                           border:`1px solid rgba(229,120,109,0.2)`,
                           color:W.orange,borderRadius:"4px",padding:"4px",
                           fontSize:"10px",cursor:"pointer"}
                  },"✏ "+(annotCount>0?annotCount+" ann.":"annoteren")),
                  desc && onAddNote && React.createElement("button",{
                    onClick:async()=>{
                      const stem=img.name.replace(/\.[^.]+$/,"");
                      await onAddNote({
                        id:genId(),title:"Afbeelding — "+stem,
                        content:"*Automatisch gegenereerd*\n\n![[img:"+img.name+"]]\n\n## Beschrijving\n\n"+desc,
                        tags:["afbeelding","media"],
                        created:new Date().toISOString(),modified:new Date().toISOString()
                      });
                    },
                    style:{flex:1,background:"rgba(138,198,242,0.08)",
                           border:"1px solid rgba(138,198,242,0.2)",color:"#a8d8f0",
                           borderRadius:"4px",padding:"4px",fontSize:"10px",cursor:"pointer"}
                  },"📝"),
                  React.createElement("button",{
                    onClick:()=>deleteImg(img.name),
                    style:{background:"rgba(229,120,109,0.08)",
                           border:"1px solid rgba(229,120,109,0.2)",color:W.orange,
                           borderRadius:"4px",padding:"4px 8px",fontSize:"10px",cursor:"pointer"}
                  },"🗑")
                )
              )
            );
          })
        )
      )
    ),

    // ── Annotatiepaneel rechts — identiek aan PDF ─────────────────────────────
    activeImg && React.createElement("button",{
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
    }, showAnnotPanel ? "▶" : "◀ " + (fileAnnots.length > 0 ? fileAnnots.length : "")),

    activeImg && showAnnotPanel && React.createElement("div",{style:{
      width:"280px",flexShrink:0,background:W.bg2,
      borderLeft:`1px solid ${W.splitBg}`,
      display:"flex",flexDirection:"column",
      ...(window.innerWidth<768 ? {
        position:"absolute",right:0,top:0,bottom:0,zIndex:20,
        boxShadow:"-4px 0 20px rgba(0,0,0,0.5)"
      } : {}),
    }},
      // Paneel header
      React.createElement("div",{style:{background:W.statusBg,
        borderBottom:`1px solid ${W.splitBg}`,padding:"6px 10px",
        display:"flex",alignItems:"center",gap:"6px",flexShrink:0}},
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"1px",flex:1}},
          React.createElement("span",{style:{fontSize:"11px",color:W.statusFg,
            letterSpacing:"1px"}},"ANNOTATIES"),
          React.createElement("span",{style:{fontSize:"9px",color:W.fgMuted,
            maxWidth:"180px",overflow:"hidden",textOverflow:"ellipsis",
            whiteSpace:"nowrap"}}, activeImg)
        ),
        React.createElement("span",{style:{background:W.blue,color:W.bg,
          borderRadius:"10px",padding:"0 6px",fontSize:"10px"}}, fileAnnots.length),
        React.createElement("div",{style:{flex:1}}),
        filterTag && React.createElement("button",{
          onClick:()=>setFilterTag(null),
          style:{background:"rgba(159,202,86,0.15)",color:W.comment,
                 border:`1px solid rgba(159,202,86,0.3)`,
                 borderRadius:"3px",fontSize:"10px",padding:"1px 6px",cursor:"pointer"}
        },"#",filterTag," ×"),
        React.createElement("button",{
          onClick:()=>setShowAnnotPanel(false),
          style:{background:"none",border:"none",color:W.fgMuted,
                 fontSize:"16px",cursor:"pointer",padding:"0 2px",lineHeight:1}
        },"×")
      ),
      // Pending pin invoerformulier bovenaan de sidebar
      pendingPin && React.createElement("div",{style:{
        padding:"12px 12px 10px",
        borderBottom:`2px solid ${activeColor.border}`,
        background: activeColor.bg,
        flexShrink:0,
      }},
        React.createElement("div",{style:{fontSize:"9px",color:activeColor.border,
          letterSpacing:"1px",marginBottom:"8px",fontWeight:"bold"}},"📌 NIEUWE ANNOTATIE"),
        React.createElement("div",{style:{display:"flex",gap:"5px",
          marginBottom:"8px",alignItems:"center"}},
          React.createElement("span",{style:{fontSize:"10px",color:W.fgMuted,
            marginRight:"2px"}},"kleur:"),
          ...HCOLORS.map(c=>React.createElement("button",{key:c.id,
            onClick:()=>setActiveColor(c),
            style:{width:"20px",height:"20px",borderRadius:"3px",background:c.bg,
                   border:`2px solid ${activeColor.id===c.id?c.border:W.splitBg}`,
                   cursor:"pointer",padding:0}}))
        ),
        React.createElement("textarea",{
          autoFocus:true,
          value:quickNote,
          onChange:e=>setQuickNote(e.target.value),
          onKeyDown:e=>{
            if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();addAnnotation();}
            if(e.key==="Escape"){setPendingPin(null);}
          },
          placeholder:"Notitie… (Enter=opslaan · Esc=annuleren)",
          rows:2,
          style:{width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,
                 borderRadius:"4px",padding:"6px 8px",color:W.fg,
                 fontSize:"11px",outline:"none",resize:"none",marginBottom:"6px"}
        }),
        React.createElement(TagEditor,{tags:quickTags,onChange:setQuickTags,
          allTags:[...(allTags||[]),...allAnnotTags]}),
        React.createElement("div",{style:{display:"flex",gap:"6px",marginTop:"8px"}},
          React.createElement("button",{
            onClick:addAnnotation,
            style:{background:activeColor.border,color:W.bg,border:"none",
                   borderRadius:"4px",padding:"5px 14px",fontSize:"11px",
                   cursor:"pointer",fontWeight:"bold"}
          },"✓ Opslaan"),
          React.createElement("button",{
            onClick:()=>setPendingPin(null),
            style:{background:"none",color:W.fgMuted,border:`1px solid ${W.splitBg}`,
                   borderRadius:"4px",padding:"5px 10px",fontSize:"11px",cursor:"pointer"}
          },"✕ Annuleren")
        )
      ),
      // Tag filter
      allAnnotTags.length>0 && React.createElement("div",{style:{padding:"5px 8px",borderBottom:`1px solid ${W.splitBg}`,background:"rgba(0,0,0,0.15)",flexShrink:0}},
        React.createElement(TagFilterBar,{tags:allAnnotTags,activeTag:filterTag,onChange:setFilterTag,compact:true,maxVisible:5})
      ),
      // Annotatielijst
      React.createElement("div",{style:{flex:1,overflow:"auto"}},
        panelAnnots.length===0
          ? React.createElement("div",{style:{padding:"24px 14px",color:W.fgMuted,
              fontSize:"11px",textAlign:"center",lineHeight:"2"}},
              filterTag
                ? `Geen annotaties met #${filterTag}`
                : React.createElement(React.Fragment,null,
                    React.createElement("div",{style:{fontSize:"20px",marginBottom:"8px"}},"📌"),
                    React.createElement("div",{style:{color:W.fgDim}},"Nog geen annotaties"),
                    React.createElement("div",{style:{fontSize:"10px",color:W.splitBg,
                      lineHeight:"1.7",marginTop:"4px"}},
                      "Klik op de afbeelding\nom een pin te plaatsen.")
                  ))
          : panelAnnots.map(a => {
              const col = HCOLORS.find(c=>c.id===a.colorId)||HCOLORS[0];
              const isEditing = editingId===a.id;
              return React.createElement("div",{key:a.id,style:{
                borderBottom:`1px solid ${W.splitBg}`,
                borderLeft:`3px solid ${col.border}`,
                background:isEditing?"rgba(255,255,255,0.025)":"transparent"
              }},
                React.createElement("div",{
                  style:{padding:"8px 10px",cursor:"pointer"},
                  onClick:()=>setEditingId(isEditing?null:a.id)
                },
                  React.createElement("div",{style:{fontSize:"11px",color:W.fg,
                    lineHeight:"1.5",marginBottom:"3px"}},
                    a.note||(React.createElement("span",{style:{color:W.fgMuted,fontStyle:"italic"}},"(geen notitie)"))),
                  React.createElement("div",{style:{display:"flex",gap:"3px",
                    flexWrap:"wrap",alignItems:"center"}},
                    ...(a.tags||[]).map(t=>React.createElement(TagPill,{key:t,tag:t,small:true})),
                    React.createElement("span",{style:{fontSize:"9px",color:W.fgMuted,marginLeft:"auto"}},
                      `${Math.round(a.x*100)}%,${Math.round(a.y*100)}%`),
                    React.createElement("span",{style:{fontSize:"9px",color:W.splitBg}},
                      isEditing?"▲":"▼")
                  )
                ),
                isEditing && React.createElement("div",{style:{
                  padding:"0 10px 12px",borderTop:`1px solid ${W.splitBg}`}},
                  React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
                    margin:"8px 0 4px",letterSpacing:"1px"}},"NOTITIE"),
                  React.createElement("textarea",{
                    value:a.note||"",
                    onChange:e=>updateAnnotation(a.id,{note:e.target.value}),
                    rows:3,
                    style:{width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,
                           borderRadius:"4px",padding:"6px 8px",color:W.fg,
                           fontSize:"11px",outline:"none",resize:"vertical"},
                    placeholder:"Notitie toevoegen…"
                  }),
                  React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
                    margin:"8px 0 4px",letterSpacing:"1px"}},"TAGS"),
                  React.createElement(TagEditor,{tags:a.tags||[],
                    onChange:tags=>updateAnnotation(a.id,{tags}),
                    allTags:[...(allTags||[]),...allAnnotTags]}),
                  React.createElement("div",{style:{display:"flex",gap:"5px",margin:"8px 0"}},
                    ...HCOLORS.map(c=>React.createElement("button",{key:c.id,
                      onClick:()=>updateAnnotation(a.id,{colorId:c.id}),
                      style:{width:"18px",height:"18px",borderRadius:"3px",background:c.bg,
                             border:`2px solid ${a.colorId===c.id?c.border:W.splitBg}`,
                             cursor:"pointer",padding:0}}))
                  ),
                  React.createElement("div",{style:{display:"flex",gap:"6px"}},
                    React.createElement("button",{
                      onClick:()=>setEditingId(null),
                      style:{background:W.comment,color:W.bg,border:"none",borderRadius:"3px",
                             padding:"3px 10px",fontSize:"10px",cursor:"pointer",fontWeight:"bold"}
                    },"✓ klaar"),
                    React.createElement("button",{
                      onClick:()=>removeAnnotation(a.id),
                      style:{background:"none",color:W.orange,
                             border:`1px solid rgba(229,120,109,0.3)`,
                             borderRadius:"3px",padding:"3px 8px",fontSize:"10px",cursor:"pointer"}
                    },":del")
                  )
                )
              );
            })
      )
    ),

    // ── Lightbox ─────────────────────────────────────────────────────────────
    lightbox && React.createElement("div",{
      onClick:()=>setLightbox(null),
      style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1000,
             display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out"}
    },
      React.createElement("img",{
        src:"/api/image/"+encodeURIComponent(lightbox), alt:lightbox,
        onClick:e=>e.stopPropagation(),
        style:{maxWidth:"92vw",maxHeight:"88vh",objectFit:"contain",
               borderRadius:"8px",boxShadow:"0 16px 64px rgba(0,0,0,0.8)"}
      }),
      React.createElement("button",{
        onClick:()=>setLightbox(null),
        style:{position:"absolute",top:"16px",right:"20px",background:"rgba(0,0,0,0.5)",
               border:"1px solid rgba(255,255,255,0.2)",color:"white",
               borderRadius:"50%",width:"36px",height:"36px",fontSize:"18px",
               cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}
      },"×"),
      React.createElement("div",{
        style:{position:"absolute",bottom:"16px",left:"50%",
               transform:"translateX(-50%)",color:"rgba(255,255,255,0.7)",
               fontSize:"12px",background:"rgba(0,0,0,0.5)",padding:"4px 12px",
               borderRadius:"12px"}
      }, lightbox)
    )
  );
};



// ── WebImporter ────────────────────────────────────────────────────────────────
// Instapaper-stijl: URL opgeven → inhoud ophalen → opschonen → Zettelkasten-notitie

const WebImporter = ({llmModel, allTags, onAddNote, onRefreshImages}) => {
  const { useState, useRef, useCallback } = React;

  const [url,        setUrl]       = useState("");
  const [busy,       setBusy]      = useState(false);
  const [error,      setError]     = useState(null);
  const [preview,    setPreview]   = useState(null);   // {title, url, markdown, images}
  const [editMd,     setEditMd]    = useState("");
  const [editTitle,  setEditTitle] = useState("");
  const [tags,       setTags]      = useState([]);
  const [saved,      setSaved]     = useState(false);
  const [selectedImages, setSelectedImages] = useState(new Set()); // geselecteerde afbeeldingen
  const urlRef = useRef(null);

  const doImport = useCallback(async () => {
    const u = url.trim();
    if (!u) return;
    setBusy(true); setError(null); setPreview(null); setSaved(false); setSelectedImages(new Set());
    try {
      const res = await api.importUrl({url: u, model: llmModel||"llama3.2-vision"});
      if (res?.ok) {
        setPreview(res);
        setEditMd(res.markdown);
        setEditTitle(res.title);
        const domain = new URL(res.url).hostname.replace("www.","");
        setTags(["import", domain.split(".")[0]].filter(Boolean));
        // Ververs plaatjes-tab als er afbeeldingen zijn gedownload
        if (res.images?.length && onRefreshImages) onRefreshImages();
      } else {
        setError(res?.error || "Import mislukt");
      }
    } catch(e) {
      setError(e.message);
    }
    setBusy(false);
  }, [url, llmModel, onRefreshImages]);

  const saveNote = useCallback(async () => {
    if (!preview) return;
    // Bouw content: bewerkbare Markdown + geselecteerde afbeeldingen inbedden
    let content = editMd;
    if (selectedImages.size > 0 && preview.images?.length) {
      const pickedLinks = preview.images
        .filter(img => selectedImages.has(img.name))
        .map(img => `![[img:${img.name}]]`)
        .join("\n\n");
      content += "\n\n" + pickedLinks;
    }
    content += "\n\n---\n🌐 **Bron:** [" + preview.url + "](" + preview.url + ")";
    await onAddNote({
      id:      genId(),
      title:   editTitle,
      content,
      tags,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
    });
    setSaved(true);
  }, [preview, editTitle, editMd, tags, selectedImages, onAddNote]);

  const reset = () => {
    setUrl(""); setPreview(null); setEditMd(""); setEditTitle("");
    setTags([]); setError(null); setSaved(false); setSelectedImages(new Set());
    setTimeout(()=>urlRef.current?.focus(), 50);
  };

  return React.createElement("div",{
    style:{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}
  },

    // ── Toolbar ──────────────────────────────────────────────────────────────
    React.createElement("div",{style:{
      background:W.statusBg, borderBottom:`1px solid ${W.splitBg}`,
      padding:"10px 16px", display:"flex", alignItems:"center",
      gap:"10px", flexShrink:0, flexWrap:"wrap"
    }},
      React.createElement("span",{style:{fontSize:"11px",color:W.statusFg,
        letterSpacing:"2px",fontWeight:"bold"}},"🌐 WEB IMPORT"),
      React.createElement("span",{style:{fontSize:"10px",color:W.fgMuted}}),
      React.createElement("div",{style:{flex:1}}),
      preview && !saved && React.createElement("button",{
        onClick:reset,
        style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
               borderRadius:"4px",padding:"4px 10px",fontSize:"10px",cursor:"pointer"}
      },"+ nieuwe import")
    ),

    // ── URL invoer ───────────────────────────────────────────────────────────
    !preview && React.createElement("div",{style:{
      flex:1, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      padding:"32px 24px", gap:"20px"
    }},
      React.createElement("div",{style:{fontSize:"48px",lineHeight:1}},"🌐"),
      React.createElement("div",{style:{fontSize:"15px",color:W.fgDim,
        textAlign:"center",lineHeight:"1.6",maxWidth:"460px"}},
        "Plak een URL om de inhoud te importeren als Zettelkasten-notitie.",
        React.createElement("br"),
        React.createElement("span",{style:{fontSize:"12px",color:W.fgMuted}},
          "De AI verwijdert navigatie, advertenties en rommel — zoals Instapaper.")),

      // URL invoer
      React.createElement("div",{style:{
        display:"flex", gap:"10px", width:"100%", maxWidth:"560px"
      }},
        React.createElement("input",{
          ref:urlRef,
          type:"url",
          value:url,
          autoFocus:true,
          onChange:e=>setUrl(e.target.value),
          onKeyDown:e=>{ if(e.key==="Enter") doImport(); },
          placeholder:"https://example.com/artikel",
          style:{flex:1, background:W.bg2, border:`1px solid ${W.splitBg}`,
                 borderRadius:"6px", padding:"10px 14px", color:W.fg,
                 fontSize:"14px", outline:"none",
                 boxShadow: url ? `0 0 0 2px rgba(138,198,242,0.25)` : "none"}
        }),
        React.createElement("button",{
          onClick:doImport,
          disabled:busy||!url.trim(),
          style:{background:W.blue, color:W.bg, border:"none",
                 borderRadius:"6px", padding:"10px 22px",
                 fontSize:"13px", fontWeight:"bold", cursor:"pointer",
                 opacity:busy||!url.trim()?0.5:1, whiteSpace:"nowrap"}
        }, busy ? "⏳ ophalen…" : "→ Importeren")
      ),

      error && React.createElement("div",{style:{
        color:W.orange, fontSize:"12px", background:"rgba(229,120,109,0.08)",
        border:`1px solid rgba(229,120,109,0.25)`, borderRadius:"6px",
        padding:"10px 16px", maxWidth:"560px", width:"100%"
      }}, "⚠ "+error)
    ),

    // ── Preview & bewerken ───────────────────────────────────────────────────
    preview && !saved && React.createElement("div",{style:{
      flex:1, display:"flex", gap:0, overflow:"hidden"
    }},

      // Linker kolom: bewerken
      React.createElement("div",{style:{
        flex:1, display:"flex", flexDirection:"column",
        borderRight:`1px solid ${W.splitBg}`, overflow:"hidden"
      }},
        // Meta-balk
        React.createElement("div",{style:{
          padding:"10px 14px", borderBottom:`1px solid ${W.splitBg}`,
          background:"rgba(0,0,0,0.15)", flexShrink:0, display:"flex",
          flexDirection:"column", gap:"6px"
        }},
          React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
            letterSpacing:"1px"}},"TITEL"),
          React.createElement("input",{
            value:editTitle,
            onChange:e=>setEditTitle(e.target.value),
            style:{background:W.bg, border:`1px solid ${W.splitBg}`,
                   borderRadius:"4px", padding:"6px 10px", color:W.fg,
                   fontSize:"13px", outline:"none", fontWeight:"bold"}
          }),
          React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
            letterSpacing:"1px",marginTop:"4px"}},"TAGS"),
          React.createElement(TagEditor,{tags, onChange:setTags,
            allTags:[...(allTags||[]),"import","artikel","onderzoek","referentie"]})
        ),
        // Markdown editor
        React.createElement("div",{style:{
          flex:1, display:"flex", flexDirection:"column", overflow:"hidden"
        }},
          React.createElement("div",{style:{
            fontSize:"9px",color:W.fgMuted,letterSpacing:"1px",
            padding:"6px 14px 4px",borderBottom:`1px solid ${W.splitBg}`,
            background:"rgba(0,0,0,0.1)", flexShrink:0
          }},"INHOUD (bewerkbaar)"),
          React.createElement("textarea",{
            value:editMd,
            onChange:e=>setEditMd(e.target.value),
            spellCheck:false,
            style:{flex:1, background:W.bg, border:"none", padding:"14px 16px",
                   color:W.fg, fontSize:"12px", lineHeight:"1.7",
                   outline:"none", resize:"none", fontFamily:"'Hack','Courier New',monospace"}
          })
        )
      ),

      // Rechter kolom: metadata + opslaan
      React.createElement("div",{style:{
        width:"260px", flexShrink:0, display:"flex",
        flexDirection:"column", background:W.bg2,
        padding:"16px", gap:"14px", overflowY:"auto"
      }},
        React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
          letterSpacing:"1px"}},"BRON"),
        React.createElement("div",{style:{fontSize:"11px",color:W.blue,
          wordBreak:"break-all",lineHeight:"1.5"}}, preview.url),

        // Afbeeldingen selecteren
        preview.images?.length > 0 && React.createElement(React.Fragment, null,
          React.createElement("div",{style:{borderTop:`1px solid ${W.splitBg}`,paddingTop:"10px"}}),
          React.createElement("div",{style:{
            display:"flex", alignItems:"center", justifyContent:"space-between",
            marginBottom:"8px"
          }},
            React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,letterSpacing:"1px"}},
              "🖼 AFBEELDINGEN",
              React.createElement("span",{style:{
                marginLeft:"6px", fontSize:"9px",
                color: selectedImages.size>0 ? W.comment : W.fgMuted
              }}, selectedImages.size>0 ? `(${selectedImages.size} geselecteerd)` : "(geen geselecteerd)")
            ),
            selectedImages.size > 0 && React.createElement("button",{
              onClick:()=>setSelectedImages(new Set()),
              style:{background:"none",border:"none",color:W.fgMuted,
                     fontSize:"9px",cursor:"pointer",padding:"0",textDecoration:"underline"}
            },"wis alles")
          ),
          // Grid van klikbare thumbnails
          React.createElement("div",{style:{
            display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:"5px"
          }},
            preview.images.map(img => {
              const sel = selectedImages.has(img.name);
              return React.createElement("div",{
                key:img.name,
                onClick:()=>{
                  setSelectedImages(prev => {
                    const next = new Set(prev);
                    sel ? next.delete(img.name) : next.add(img.name);
                    return next;
                  });
                },
                title: img.name,
                style:{
                  position:"relative", cursor:"pointer",
                  borderRadius:"5px", overflow:"hidden",
                  border:`2px solid ${sel ? W.comment : "transparent"}`,
                  boxShadow: sel ? `0 0 0 1px ${W.comment}` : "none",
                  transition:"border 0.12s, box-shadow 0.12s",
                  aspectRatio:"1",
                }
              },
                React.createElement("img",{
                  src:"/api/image/"+encodeURIComponent(img.name),
                  style:{width:"100%",height:"100%",objectFit:"cover",display:"block"}
                }),
                // Checkmark overlay bij selectie
                sel && React.createElement("div",{style:{
                  position:"absolute",inset:0,
                  background:"rgba(159,202,86,0.25)",
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:"18px",
                }},"✓"),
                // Donkere overlay als niet geselecteerd (subtiel)
                !sel && React.createElement("div",{style:{
                  position:"absolute",inset:0,
                  background:"rgba(0,0,0,0.35)",
                }})
              );
            })
          ),
          React.createElement("div",{style:{
            fontSize:"9px",color:W.fgMuted,marginTop:"5px",lineHeight:"1.5"
          }}, "Klik op een afbeelding om deze mee te nemen in de notitie. Alle afbeeldingen staan al in de Plaatjes tab.")
        ),

        React.createElement("div",{style:{borderTop:`1px solid ${W.splitBg}`,paddingTop:"12px"}}),

        React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
          letterSpacing:"1px"}},"STATISTIEKEN"),
        React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,lineHeight:"1.8"}},
          "📝 "+editMd.length+" tekens",
          React.createElement("br"),
          "📄 "+editMd.split("\n").filter(Boolean).length+" regels",
          React.createElement("br"),
          "🏷 "+tags.length+" tags"
        ),

        React.createElement("div",{style:{borderTop:`1px solid ${W.splitBg}`,paddingTop:"12px"}}),

        React.createElement("button",{
          onClick:saveNote,
          style:{background:W.comment, color:W.bg, border:"none",
                 borderRadius:"6px", padding:"10px 0", fontSize:"12px",
                 fontWeight:"bold", cursor:"pointer", width:"100%"}
        },"✓ Opslaan als notitie"),

        React.createElement("button",{
          onClick:reset,
          style:{background:"none", color:W.fgMuted,
                 border:`1px solid ${W.splitBg}`,
                 borderRadius:"6px", padding:"8px 0", fontSize:"11px",
                 cursor:"pointer", width:"100%"}
        },"✕ Annuleren")
      )
    ),

    // ── Opgeslagen bevestiging ────────────────────────────────────────────────
    saved && React.createElement("div",{style:{
      flex:1, display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"center",
      gap:"16px", color:W.fgMuted
    }},
      React.createElement("div",{style:{fontSize:"48px"}},"✓"),
      React.createElement("div",{style:{fontSize:"16px",color:W.comment,fontWeight:"bold"}},
        "Opgeslagen als notitie"),
      React.createElement("div",{style:{fontSize:"12px",color:W.fgDim}},
        editTitle),
      React.createElement("div",{style:{display:"flex",gap:"10px",marginTop:"8px"}},
        React.createElement("button",{
          onClick:reset,
          style:{background:W.blue,color:W.bg,border:"none",borderRadius:"6px",
                 padding:"8px 20px",fontSize:"12px",fontWeight:"bold",cursor:"pointer"}
        },"+ nieuw importeren")
      )
    )
  );
};


// ── Mindmap ────────────────────────────────────────────────────────────────────
// Interactieve mindmap op basis van notities en tags.
// Layout: radiale boom — root in midden, takken per tag, notities als bladeren.
// Editor: klik node om te hernoemen/verwijderen, sleep om te herpositioneren.
// Exporteerbaar als JSON (opgeslagen in vault).

const MM_NODE_W  = 130;
const MM_NODE_H  = 32;
const MM_RADIUS  = 200;  // afstand root→tag
const MM_LEAF_R  = 140;  // afstand tag→notitie

// ── Mermaid Mindmap Parser & Canvas Renderer ─────────────────────────────────
// Parseert mermaid mindmap-syntax en rendert het op een canvas.
// Syntax:
//   mindmap
//     root((Titel))
//       Tak A
//         Sub A1
//         Sub A2
//       Tak B

const parseMermaidMindmap = (text) => {
  // Verwijder "mindmap" header en lege regels
  const raw = text.replace(/^\s*mindmap\s*/i, "");
  const lines = raw.split("\n").filter(l => l.trimEnd());

  const getDepth = (line) => {
    const m = line.match(/^(\s*)/);
    return m ? Math.floor(m[1].length / 2) : 0;
  };

  const cleanLabel = (s) => s.trim()
    .replace(/^root\(\((.+?)\)\)/, "$1")  // root((label))
    .replace(/^\(\((.+?)\)\)/, "$1")      // ((label)) = round
    .replace(/^\((.+?)\)/, "$1")          // (label)
    .replace(/^\[(.+?)\]/, "$1")          // [label]
    .replace(/^::icon\([^)]*\)/, "")      // icon directives
    .replace(/^\s*/, "");

  const nodes = [];
  const stack = [];  // {id, depth}
  let idCounter = 0;

  lines.forEach(line => {
    if (!line.trim()) return;
    const depth = getDepth(line);
    const label = cleanLabel(line);
    if (!label) return;

    const id = "mm_" + (idCounter++);
    const parentId = stack.filter(s => s.depth < depth).slice(-1)[0]?.id || null;

    nodes.push({ id, label, depth, parentId });

    // Update stack: verwijder alles op zelfde/diepere depth
    while (stack.length && stack[stack.length-1].depth >= depth) stack.pop();
    stack.push({ id, depth });
  });

  return nodes;
};

const MermaidCanvas = ({ text, width, height }) => {
  const cvRef = React.useRef(null);

  React.useEffect(() => {
    const cv = cvRef.current;
    if (!cv || !text) return;
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    cv.width  = width  * dpr;
    cv.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = W.bg;
    ctx.fillRect(0, 0, width, height);

    const nodes = parseMermaidMindmap(text);
    if (!nodes.length) {
      ctx.fillStyle = W.fgMuted;
      ctx.font = "13px 'Hack','Courier New',monospace";
      ctx.textAlign = "center";
      ctx.fillText("Typ een mindmap…", width/2, height/2);
      return;
    }

    // ── Layout: radiale boom vanuit midden ───────────────────────────────────
    const NODE_W = 120, NODE_H = 28, LEVEL_GAP = 160, SIBLING_GAP = 36;
    const PALETTE = [W.blue, W.comment, W.orange, W.purple,
                     W.string, W.type, W.keyword, "#e8d44d"];

    // Bereken posities per niveau
    const byParent = {};
    nodes.forEach(n => {
      const p = n.parentId || "__root";
      if (!byParent[p]) byParent[p] = [];
      byParent[p].push(n);
    });

    const positions = {};
    const root = nodes[0];
    if (!root) return;

    // Root in midden
    positions[root.id] = { x: width/2, y: height/2 };

    // BFS layout
    const queue = [root.id];
    const visited = new Set([root.id]);
    const childColorIdx = {};

    while (queue.length) {
      const pid = queue.shift();
      const children = byParent[pid] || [];
      if (!children.length) continue;

      const parentPos = positions[pid];
      const parentNode = nodes.find(n => n.id === pid);
      const isRoot = pid === root.id;

      // Verdeel kinderen radiaal (of horizontaal voor diepere niveaus)
      const n = children.length;
      children.forEach((child, i) => {
        if (!visited.has(child.id)) {
          visited.add(child.id);
          let x, y;
          if (isRoot) {
            // Eerste niveau: radiaal verdeeld
            const angle = (2 * Math.PI * i / n) - Math.PI / 2;
            x = parentPos.x + Math.cos(angle) * LEVEL_GAP * 1.6;
            y = parentPos.y + Math.sin(angle) * LEVEL_GAP * 1.1;
            childColorIdx[child.id] = i % PALETTE.length;
          } else {
            // Diepere niveaus: horizontaal rechts, verticaal gestapeld
            const colIdx = childColorIdx[pid] ?? (i % PALETTE.length);
            childColorIdx[child.id] = colIdx;
            x = parentPos.x + LEVEL_GAP;
            y = parentPos.y + (i - (n-1)/2) * SIBLING_GAP;
          }
          positions[child.id] = { x, y };
          queue.push(child.id);
        }
      });
    }

    // ── Teken edges ──────────────────────────────────────────────────────────
    nodes.forEach(node => {
      if (!node.parentId) return;
      const from = positions[node.id];
      const to   = positions[node.parentId];
      if (!from || !to) return;
      const col = PALETTE[childColorIdx[node.id] ?? 0];
      ctx.beginPath();
      ctx.moveTo(to.x, to.y);
      // Bezier curve
      const mx = (from.x + to.x) / 2;
      ctx.bezierCurveTo(mx, to.y, mx, from.y, from.x, from.y);
      ctx.strokeStyle = col + "66";
      ctx.lineWidth = node.depth === 1 ? 2 : 1.5;
      ctx.stroke();
    });

    // ── Teken nodes ──────────────────────────────────────────────────────────
    nodes.forEach(node => {
      const pos = positions[node.id];
      if (!pos) return;
      const isRoot = node.id === root.id;
      const col = isRoot ? W.blue : (PALETTE[childColorIdx[node.id] ?? 0]);

      const label = node.label;
      ctx.font = `${isRoot ? "bold " : ""}${isRoot ? 13 : node.depth===1 ? 12 : 11}px 'Hack','Courier New',monospace`;
      const tw = ctx.measureText(label).width;
      const nw = isRoot ? Math.max(tw + 24, 70) : Math.max(tw + 20, NODE_W * 0.55);
      const nh = isRoot ? 34 : NODE_H;
      const nx = pos.x - nw/2;
      const ny = pos.y - nh/2;
      const r  = isRoot ? nh/2 : 5;

      // Achtergrond
      ctx.beginPath();
      if (isRoot) {
        ctx.arc(pos.x, pos.y, nw/2, 0, Math.PI*2);
      } else {
        ctx.roundRect(nx, ny, nw, nh, r);
      }
      ctx.fillStyle   = col + (isRoot ? "30" : "20");
      ctx.strokeStyle = col + (isRoot ? "cc" : "88");
      ctx.lineWidth   = isRoot ? 2 : 1.5;
      ctx.fill();
      ctx.stroke();

      // Label
      ctx.fillStyle  = isRoot ? W.statusFg : col;
      ctx.font       = `${isRoot ? "bold " : ""}${isRoot ? 13 : node.depth===1 ? 12 : 11}px 'Hack','Courier New',monospace`;
      ctx.textAlign  = "center";
      ctx.textBaseline = "middle";
      // Truncate bij overflow
      let lbl = label;
      while (ctx.measureText(lbl).width > nw - 12 && lbl.length > 3)
        lbl = lbl.slice(0, -2) + "…";
      ctx.fillText(lbl, pos.x, pos.y);
    });

  }, [text, width, height]);

  return React.createElement("canvas", {
    ref: cvRef,
    style: { display:"block", width:"100%", height:"100%", borderRadius:"6px" }
  });
};

// ── Mermaid Mindmap Editor (split: code | preview) ───────────────────────────
const MermaidEditor = ({ initialText="", onSave, onCancel }) => {
  const DEFAULT = `mindmap\n  root((Mijn Mindmap))\n    Tak A\n      Sub A1\n      Sub A2\n    Tak B\n      Sub B1\n    Tak C`;
  const [code, setCode]         = React.useState(initialText || DEFAULT);
  const [title, setTitle]       = React.useState("");
  const [tags, setTags]         = React.useState(["mindmap"]);
  const [saving, setSaving]     = React.useState(false);
  const [saveMsg, setSaveMsg]   = React.useState("");
  const containerRef            = React.useRef(null);
  const [previewSize, setPreviewSize] = React.useState({w:400, h:400});

  // Resize observer voor preview canvas
  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const e = entries[0];
      if (e) setPreviewSize({w: e.contentRect.width, h: e.contentRect.height});
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Automatisch titel afleiden uit root-node
  React.useEffect(() => {
    const nodes = parseMermaidMindmap(code);
    if (nodes[0] && !title) setTitle("Mindmap — " + nodes[0].label);
  }, []);

  const handleSave = async () => {
    if (!onSave || saving) return;
    setSaving(true);
    const nodes = parseMermaidMindmap(code);
    const rootLabel = nodes[0]?.label || "mindmap";
    const noteTitle = title || "Mindmap — " + rootLabel;
    // Sla op als notitie met mermaid code block erin
    const content = `\`\`\`mindmap\n${code}\n\`\`\``;
    try {
      await onSave({ title: noteTitle, content, tags });
      setSaveMsg("✓ Opgeslagen");
      setTimeout(() => { setSaveMsg(""); if(onCancel) onCancel(); }, 1200);
    } catch(e) {
      setSaveMsg("⚠ " + e.message);
    }
    setSaving(false);
  };

  return React.createElement("div",{style:{
    display:"flex", flexDirection:"column", height:"100%", overflow:"hidden"
  }},
    // Toolbar
    React.createElement("div",{style:{
      display:"flex", alignItems:"center", gap:"8px",
      padding:"8px 12px", background:W.statusBg,
      borderBottom:`1px solid ${W.splitBg}`, flexShrink:0
    }},
      React.createElement("span",{style:{
        fontSize:"11px", color:W.statusFg, letterSpacing:"2px", fontWeight:"bold"
      }}, "🌿 MERMAID MINDMAP"),
      React.createElement("div",{style:{flex:1}}),
      // Titel invoer
      React.createElement("input",{
        value:title, onChange:e=>setTitle(e.target.value),
        placeholder:"Notitie-titel…",
        style:{background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"4px",
               padding:"4px 8px",color:W.fg,fontSize:"12px",outline:"none",
               width:"200px"}
      }),
      // Tags
      React.createElement(TagEditor,{tags, onChange:setTags, allTags:["mindmap","ai","overzicht"]}),
      // Knoppen
      React.createElement("button",{
        onClick:handleSave, disabled:saving,
        style:{background:"linear-gradient(135deg,rgba(159,202,86,0.25),rgba(159,202,86,0.12))",
               border:"1px solid rgba(159,202,86,0.5)",color:W.comment,
               borderRadius:"5px",padding:"5px 14px",fontSize:"11px",fontWeight:"600",
               cursor:saving?"default":"pointer"}
      }, saving ? "⏳ Opslaan…" : "💾 Opslaan als notitie"),
      saveMsg && React.createElement("span",{style:{fontSize:"10px",
        color:saveMsg.startsWith("✓")?W.comment:W.orange}}, saveMsg),
      onCancel && React.createElement("button",{
        onClick:onCancel,
        style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
               borderRadius:"5px",padding:"5px 10px",fontSize:"11px",cursor:"pointer"}
      }, "← terug")
    ),

    // Split: editor links | preview rechts
    React.createElement("div",{style:{flex:1,display:"flex",overflow:"hidden"}},

      // Code editor
      React.createElement("div",{style:{
        width:"42%", flexShrink:0, display:"flex", flexDirection:"column",
        borderRight:`1px solid ${W.splitBg}`
      }},
        React.createElement("div",{style:{
          padding:"5px 10px",fontSize:"9px",color:W.fgMuted,
          letterSpacing:"1.5px",background:"rgba(0,0,0,0.15)",
          borderBottom:`1px solid ${W.splitBg}`, flexShrink:0,
          display:"flex", alignItems:"center", gap:"6px"
        }},
          "MERMAID SYNTAX",
          React.createElement("span",{style:{fontSize:"9px",color:W.fgDim,fontStyle:"italic",fontWeight:"normal"}},
            "root((Label)) · Tak · " + "  Sub")
        ),
        React.createElement("textarea",{
          value:code, onChange:e=>setCode(e.target.value),
          spellCheck:false, autoCapitalize:"off", autoCorrect:"off",
          style:{
            flex:1, background:W.bg, border:"none", outline:"none",
            padding:"12px 14px", color:W.fg, fontSize:"12px",
            fontFamily:"'Hack','Courier New',monospace",
            lineHeight:"1.7", resize:"none",
            tabSize:2,
          },
          onKeyDown: e => {
            // Tab → 2 spaties invoegen
            if (e.key === "Tab") {
              e.preventDefault();
              const ta = e.target;
              const s = ta.selectionStart, end = ta.selectionEnd;
              const newVal = code.slice(0,s) + "  " + code.slice(end);
              setCode(newVal);
              requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = s+2; });
            }
          }
        })
      ),

      // Preview canvas
      React.createElement("div",{
        ref:containerRef,
        style:{flex:1, position:"relative", background:W.bg, overflow:"hidden"}
      },
        React.createElement("div",{style:{
          position:"absolute",top:"8px",right:"10px",
          fontSize:"9px",color:W.fgMuted,letterSpacing:"1.5px",
          zIndex:2, pointerEvents:"none"
        }}, "PREVIEW"),
        React.createElement(MermaidCanvas,{
          text:code,
          width:previewSize.w||400,
          height:previewSize.h||400
        })
      )
    )
  );
};

const MindMap = ({notes, allTags, onSelectNote, aiMindmap, onAddNote}) => {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  // ── Node state ────────────────────────────────────────────────────────────
  // Elke node: {id, label, type:'root'|'tag'|'note'|'branch'|'sub'|'detail', x, y, parentId, noteId?, color?}
  const [nodes,      setNodes]     = useState([]);
  const [edges,      setEdges]     = useState([]);
  const [selId,      setSelId]     = useState(null);
  const [editingId,  setEditingId] = useState(null);
  const [editLabel,  setEditLabel] = useState("");
  const [zoom,       setZoom]      = useState(1);
  const [pan,        setPan]       = useState({x:0, y:0});
  const [mode,       setMode]      = useState("view");
  const [layout,     setLayout]    = useState("radial");
  const [showTags,   setShowTags]  = useState(true);
  const [showNotes,  setShowNotes] = useState(true);
  const [tagFilter,  setTagFilter] = useState(null);
  const [aiMode,     setAiMode]    = useState(false);  // toon AI mindmap ipv vault
  const [mmView,     setMmView]    = useState("canvas"); // "canvas" | "mermaid"
  const [editMermaid,setEditMermaid]=useState(null);   // null = nieuw, string = bestaande code

  const cvRef     = useRef(null);
  const dragRef   = useRef(null);   // {nodeId, startX, startY, origX, origY}
  const panRef    = useRef(null);   // {startX, startY, origPanX, origPanY}
  const afRef     = useRef(null);
  const editRef   = useRef(null);
  const nodesRef  = useRef([]);     // voor canvas rendering
  const edgesRef  = useRef([]);
  const selRef    = useRef(null);

  // Sync refs
  nodesRef.current = nodes;
  edgesRef.current = edges;
  selRef.current   = selId;

  // ── Tag kleur palet ───────────────────────────────────────────────────────
  const tagColorMap = useMemo(() => {
    const palette = [W.blue, W.comment, W.orange, W.purple,
                     W.string, W.type, W.keyword, "#e8d44d"];
    const map = {};
    allTags.forEach((t,i) => { map[t] = palette[i % palette.length]; });
    return map;
  }, [allTags]);

  // ── Bouw mindmap op basis van notities + tags ─────────────────────────────
  const buildLayout = useCallback(() => {
    const cv = cvRef.current; if (!cv) return;
    const CW = cv.clientWidth, CH = cv.clientHeight;
    const cx = CW / 2, cy = CH / 2;

    const visibleTags = tagFilter ? [tagFilter]
      : (showTags ? allTags : []);

    const newNodes = [];
    const newEdges = [];

    // Root node
    const root = {id:"root", label:"Zettelkasten", type:"root",
                  x:cx, y:cy, fixed:true};
    newNodes.push(root);

    if (layout === "radial") {
      // Radiale layout: tags als eerste ring, notities als tweede ring
      const tagCount = visibleTags.length;
      visibleTags.forEach((tag, ti) => {
        const angle = (ti / tagCount) * Math.PI * 2 - Math.PI/2;
        const tx = cx + MM_RADIUS * Math.cos(angle);
        const ty = cy + MM_RADIUS * Math.sin(angle);
        const tagNode = {
          id: "tag-"+tag, label:"#"+tag, type:"tag",
          x: tx, y: ty, color: tagColorMap[tag]||W.comment,
          parentId:"root"
        };
        newNodes.push(tagNode);
        newEdges.push({from:"root", to:"tag-"+tag});

        if (showNotes) {
          const tagNotes = notes.filter(n => (n.tags||[]).includes(tag));
          const nCount   = tagNotes.length;
          tagNotes.forEach((note, ni) => {
            const spread  = Math.min(Math.PI * 0.8, (nCount * 0.35));
            const leafAngle = angle - spread/2 + (nCount>1 ? (ni/(nCount-1))*spread : 0);
            // Al toegevoegd? Gebruik bestaande positie
            const existingNode = newNodes.find(n => n.id === "note-"+note.id);
            if (!existingNode) {
              newNodes.push({
                id:      "note-"+note.id,
                label:   note.title?.length > 20 ? note.title.slice(0,18)+"…" : (note.title||"–"),
                fullLabel: note.title || "–",
                type:    "note",
                x:       tx + MM_LEAF_R * Math.cos(leafAngle),
                y:       ty + MM_LEAF_R * Math.sin(leafAngle),
                noteId:  note.id,
                color:   tagColorMap[tag]||W.keyword,
                parentId:"tag-"+tag,
              });
              newEdges.push({from:"tag-"+tag, to:"note-"+note.id});
            } else {
              // Extra edge van andere tag naar dezelfde notitie
              newEdges.push({from:"tag-"+tag, to:"note-"+note.id, secondary:true});
            }
          });
        }
      });

      // Notities zonder tags
      if (showNotes) {
        const untagged = notes.filter(n => !(n.tags||[]).length ||
          !(n.tags||[]).some(t => visibleTags.includes(t)));
        if (untagged.length > 0) {
          const utAngle = tagCount > 0 ? (tagCount/(tagCount+1)) * Math.PI*2 - Math.PI/2
                                       : 0;
          const utNode = {id:"untagged", label:"zonder tag", type:"tag",
                          x: cx + MM_RADIUS * Math.cos(utAngle),
                          y: cy + MM_RADIUS * Math.sin(utAngle),
                          color: W.fgMuted, parentId:"root"};
          newNodes.push(utNode);
          newEdges.push({from:"root", to:"untagged"});
          untagged.slice(0,15).forEach((note,ni) => {
            const spread = Math.min(Math.PI*0.8, untagged.length*0.3);
            const la = utAngle - spread/2 + (untagged.length>1?(ni/(untagged.length-1))*spread:0);
            newNodes.push({
              id:"note-"+note.id, label:note.title?.slice(0,18)||(note.title||"–"),
              fullLabel:note.title||"–", type:"note",
              x:utNode.x + MM_LEAF_R*Math.cos(la),
              y:utNode.y + MM_LEAF_R*Math.sin(la),
              noteId:note.id, color:W.fgDim, parentId:"untagged"
            });
            newEdges.push({from:"untagged", to:"note-"+note.id});
          });
        }
      }
    } else if (layout === "tree") {
      // Horizontale boom naar rechts: root links, tags als kolom, notities rechts
      const tagCount = visibleTags.length;
      const rootX  = 80;
      const tagX   = 260;
      const noteX  = 440;
      const tGap   = Math.min(80, (CH - 80) / Math.max(tagCount, 1));
      const tStartY = cy - ((tagCount-1)/2) * tGap;

      // Root naar links
      newNodes[0].x = rootX;
      newNodes[0].y = cy;

      visibleTags.forEach((tag, ti) => {
        const ty = tStartY + ti * tGap;
        const tagNode = {id:"tag-"+tag, label:"#"+tag, type:"tag",
                         x:tagX, y:ty, color:tagColorMap[tag]||W.comment, parentId:"root"};
        newNodes.push(tagNode);
        newEdges.push({from:"root", to:"tag-"+tag});

        if (showNotes) {
          const tagNotes = notes.filter(n=>(n.tags||[]).includes(tag));
          const nGap = Math.min(55, tGap / Math.max(tagNotes.length, 1));
          const nStartY = ty - ((tagNotes.length-1)/2) * nGap;
          tagNotes.forEach((note, ni) => {
            if (newNodes.find(n=>n.id==="note-"+note.id)) {
              newEdges.push({from:"tag-"+tag, to:"note-"+note.id, secondary:true});
              return;
            }
            newNodes.push({
              id:"note-"+note.id, label:note.title?.slice(0,18)||"–",
              fullLabel:note.title||"–", type:"note",
              x: noteX, y: nStartY + ni * nGap,
              noteId:note.id, color:tagColorMap[tag]||W.keyword, parentId:"tag-"+tag
            });
            newEdges.push({from:"tag-"+tag, to:"note-"+note.id});
          });
        }
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
  }, [notes, allTags, tagFilter, showTags, showNotes, layout, tagColorMap]);

  useEffect(() => { buildLayout(); }, [buildLayout]);

  // ── AI mindmap layout (3-laags: root → tak → subtopic → detail) ───────────
  const buildAiLayout = useCallback(() => {
    if (!aiMindmap || !cvRef.current) return;
    const cv = cvRef.current;
    const CW = cv.clientWidth, CH = cv.clientHeight;
    const cx = CW/2, cy = CH/2;

    const newNodes = [];
    const newEdges = [];
    const branches = aiMindmap.branches || [];

    newNodes.push({id:"root", label: aiMindmap.root||"Overzicht",
                   type:"root", x:cx, y:cy, fixed:true});

    const BRANCH_R  = Math.min(220, CW*0.28);
    const SUB_R     = 130;
    const DETAIL_R  = 90;
    const PALETTE   = ["#8ac6f2","#9fcf56","#e5786d","#d4a4f7","#e8d44d","#f4bf75","#a8d8a0","#f097c0"];

    if (layout === "tree") {
      // Horizontale boom naar rechts: root links, takken als rij rechts, subtopics verder rechts
      const bCount = branches.length;
      const LEVEL1_X = 220;   // root → tak
      const LEVEL2_X = 420;   // tak → subtopic
      const LEVEL3_X = 580;   // subtopic → detail
      const rootX    = 80;

      // Overschrijf root x-positie naar links
      newNodes[0].x = rootX;
      newNodes[0].y = cy;

      // Verdeel takken verticaal
      const bGap = Math.min(90, (CH - 80) / Math.max(bCount, 1));
      const bStartY = cy - ((bCount-1)/2) * bGap;

      branches.forEach((b, bi) => {
        const color = b.color || PALETTE[bi % PALETTE.length];
        const bx = LEVEL1_X;
        const by = bStartY + bi * bGap;
        const bId = "branch-"+bi;
        newNodes.push({id:bId, label:b.label, type:"branch",
                       x:bx, y:by, color, parentId:"root", important:b.importance==="high"});
        newEdges.push({from:"root", to:bId, weight: b.importance==="high"?3:1.5});

        const children = b.children || [];
        const cGap = Math.min(70, bGap / Math.max(children.length, 1));
        const cStartY = by - ((children.length-1)/2) * cGap;

        children.forEach((c, ci) => {
          const cLabel = typeof c==="string" ? c : c.label;
          const cDetails = typeof c==="string" ? [] : (c.details||[]);
          const sx = LEVEL2_X;
          const sy = cStartY + ci * cGap;
          const sId = "sub-"+bi+"-"+ci;
          newNodes.push({id:sId, label:cLabel, type:"sub", x:sx, y:sy, color, parentId:bId});
          newEdges.push({from:bId, to:sId});

          const dGap = Math.min(50, cGap / Math.max(cDetails.length, 1));
          const dStartY = sy - ((Math.min(cDetails.length,3)-1)/2) * dGap;
          cDetails.slice(0,3).forEach((d, di) => {
            const dId = "detail-"+bi+"-"+ci+"-"+di;
            newNodes.push({id:dId, label: d.length>28?d.slice(0,26)+"…":d,
                           fullLabel:d, type:"detail",
                           x: LEVEL3_X,
                           y: dStartY + di * dGap,
                           color: color+"99", parentId:sId});
            newEdges.push({from:sId, to:dId, detail:true});
          });
        });
      });
    } else {
      // Radiaal (standaard)
      branches.forEach((b, bi) => {
        const angle = (bi / branches.length) * Math.PI*2 - Math.PI/2;
        const bx = cx + BRANCH_R * Math.cos(angle);
        const by = cy + BRANCH_R * Math.sin(angle);
        const color = b.color || PALETTE[bi % PALETTE.length];
        const bId = "branch-"+bi;
        newNodes.push({id:bId, label:b.label, type:"branch",
                       x:bx, y:by, color, parentId:"root", important:b.importance==="high"});
        newEdges.push({from:"root", to:bId, weight: b.importance==="high"?3:1.5});

        const children = b.children || [];
        children.forEach((c, ci) => {
          const cLabel = typeof c==="string" ? c : c.label;
          const cDetails = typeof c==="string" ? [] : (c.details||[]);
          const spread = Math.min(Math.PI*0.7, children.length*0.28);
          const cAngle = angle - spread/2 + (children.length>1?(ci/(children.length-1))*spread:0);
          const sx = bx + SUB_R * Math.cos(cAngle);
          const sy = by + SUB_R * Math.sin(cAngle);
          const sId = "sub-"+bi+"-"+ci;
          newNodes.push({id:sId, label:cLabel, type:"sub", x:sx, y:sy, color, parentId:bId});
          newEdges.push({from:bId, to:sId});

          cDetails.slice(0,3).forEach((d, di) => {
            const detailSpread = Math.min(Math.PI*0.4, cDetails.length*0.2);
            const dAngle = cAngle - detailSpread/2 +
                           (cDetails.length>1?(di/(cDetails.length-1))*detailSpread:0);
            const dId = "detail-"+bi+"-"+ci+"-"+di;
            newNodes.push({id:dId, label: d.length>28?d.slice(0,26)+"…":d,
                           fullLabel:d, type:"detail",
                           x: sx + DETAIL_R*Math.cos(dAngle),
                           y: sy + DETAIL_R*Math.sin(dAngle),
                           color: color+"99", parentId:sId});
            newEdges.push({from:sId, to:dId, detail:true});
          });
        });
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
    setPan({x:0,y:0});
    setZoom(0.85);
  }, [aiMindmap, layout]);

  // Schakel automatisch naar AI-modus als nieuwe mindmap binnenkomt
  useEffect(() => {
    if (aiMindmap) {
      setAiMode(true);
      setTimeout(()=>buildAiLayout(), 60);
    }
  }, [aiMindmap, buildAiLayout]);

  useEffect(() => {
    if (!aiMode) buildLayout();
    else buildAiLayout();
  }, [aiMode, buildLayout, buildAiLayout]);

  // ── Canvas rendering ──────────────────────────────────────────────────────
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio||1;

    const resize = () => {
      const p = cv.parentElement;
      cv.width  = p.clientWidth  * dpr;
      cv.height = p.clientHeight * dpr;
      cv.style.width  = p.clientWidth  + "px";
      cv.style.height = p.clientHeight + "px";
      ctx.scale(dpr, dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv.parentElement);

    const draw = () => {
      const CW = cv.clientWidth, CH = cv.clientHeight;
      ctx.clearRect(0,0,CW,CH);
      ctx.fillStyle = W.bg;
      ctx.fillRect(0,0,CW,CH);

      // Lichte grid
      ctx.strokeStyle = "rgba(255,255,255,0.02)";
      ctx.lineWidth = 1;
      for (let x=0; x<CW; x+=40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CH); ctx.stroke(); }
      for (let y=0; y<CH; y+=40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CW,y); ctx.stroke(); }

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      const ns = nodesRef.current;
      const es = edgesRef.current;
      const sel = selRef.current;

      // Edges
      es.forEach(e => {
        const from = ns.find(n=>n.id===e.from);
        const to   = ns.find(n=>n.id===e.to);
        if (!from||!to) return;
        ctx.beginPath();
        const mx = (from.x+to.x)/2;
        const my = (from.y+to.y)/2;
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(mx, my, to.x, to.y);
        ctx.strokeStyle = e.secondary
          ? "rgba(255,255,255,0.06)"
          : e.detail
            ? (to.color||W.splitBg)+"30"
            : (to.color||W.splitBg)+"55";
        ctx.lineWidth = e.secondary ? 0.5
          : e.detail ? 0.6
          : e.weight ? e.weight
          : (from.type==="root" ? 2 : 1);
        ctx.setLineDash(e.secondary?[3,5]:e.detail?[2,4]:[]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Nodes
      ns.forEach(n => {
        const isSel = n.id === sel;
        const color = n.color || W.fgMuted;

        if (n.type === "root") {
          // Root: grote cirkel
          const r = 38;
          if (isSel) {
            ctx.beginPath(); ctx.arc(n.x,n.y,r+8,0,Math.PI*2);
            const g = ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,r+8);
            g.addColorStop(0,"rgba(138,198,242,0.25)"); g.addColorStop(1,"rgba(138,198,242,0)");
            ctx.fillStyle=g; ctx.fill();
          }
          ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2);
          ctx.fillStyle   = isSel?"rgba(138,198,242,0.25)":"rgba(138,198,242,0.1)";
          ctx.strokeStyle = isSel?"rgba(138,198,242,0.9)":"rgba(138,198,242,0.4)";
          ctx.lineWidth   = isSel ? 2.5 : 1.5;
          ctx.fill(); ctx.stroke();
          ctx.fillStyle  = isSel ? W.statusFg : W.fg;
          ctx.font       = `bold 13px 'Hack','Courier New',monospace`;
          ctx.textAlign  = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n.label, n.x, n.y);

        } else if (n.type === "tag") {
          // Tag: afgeronde pill
          const pw = 100, ph = 26, pr = 13;
          const lx = n.x - pw/2, ly = n.y - ph/2;
          if (isSel) {
            ctx.shadowBlur = 12; ctx.shadowColor = color+"80";
          }
          ctx.beginPath();
          ctx.roundRect(lx,ly,pw,ph,pr);
          ctx.fillStyle   = color+"28";
          ctx.strokeStyle = isSel ? color : color+"70";
          ctx.lineWidth   = isSel ? 2 : 1.2;
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur  = 0;
          ctx.fillStyle   = isSel ? W.statusFg : color;
          ctx.font        = `${isSel?"bold ":""}11px 'Hack','Courier New',monospace`;
          ctx.textAlign   = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n.label, n.x, n.y);

        } else if (n.type === "branch") {
          // AI Hoofdtak: hexagon-achtige pill, groter dan tag
          const pw = 140, ph = 32, pr = 16;
          const lx = n.x - pw/2, ly = n.y - ph/2;
          if (isSel || n.important) {
            ctx.shadowBlur = 16; ctx.shadowColor = color+"90";
          }
          ctx.beginPath(); ctx.roundRect(lx,ly,pw,ph,pr);
          ctx.fillStyle   = color+"35";
          ctx.strokeStyle = isSel ? color : color+"90";
          ctx.lineWidth   = isSel ? 2.5 : (n.important ? 2 : 1.5);
          ctx.fill(); ctx.stroke();
          if (n.important) {
            // Ster icoontje voor high-importance
            ctx.fillStyle = color;
            ctx.font = "10px sans-serif";
            ctx.textAlign = "right"; ctx.textBaseline = "middle";
            ctx.fillText("⭐", n.x + pw/2 - 5, n.y);
          }
          ctx.shadowBlur = 0;
          ctx.fillStyle  = isSel ? W.statusFg : color;
          ctx.font       = `bold 11px 'Hack','Courier New',monospace`;
          ctx.textAlign  = "center"; ctx.textBaseline = "middle";
          ctx.fillText(n.label.length>20?n.label.slice(0,18)+"…":n.label, n.x, n.y);

        } else if (n.type === "sub") {
          // AI Subtopic: afgeronde pill, medium
          const pw = 110, ph = 24, pr = 12;
          const lx = n.x - pw/2, ly = n.y - ph/2;
          if (isSel) { ctx.shadowBlur=8; ctx.shadowColor=color+"60"; }
          ctx.beginPath(); ctx.roundRect(lx,ly,pw,ph,pr);
          ctx.fillStyle   = isSel ? color+"28" : color+"18";
          ctx.strokeStyle = isSel ? color       : color+"55";
          ctx.lineWidth   = isSel ? 1.8 : 1;
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur  = 0;
          ctx.fillStyle   = isSel ? W.statusFg : W.fg;
          ctx.font        = `${isSel?"bold ":""}10px 'Hack','Courier New',monospace`;
          ctx.textAlign   = "center"; ctx.textBaseline = "middle";
          ctx.fillText(n.label.length>18?n.label.slice(0,16)+"…":n.label, n.x, n.y);

        } else if (n.type === "detail") {
          // AI Detail: klein, subtiel
          const pw = 86, ph = 18, pr = 9;
          const lx = n.x - pw/2, ly = n.y - ph/2;
          ctx.beginPath(); ctx.roundRect(lx,ly,pw,ph,pr);
          ctx.fillStyle   = isSel ? color+"25" : "transparent";
          ctx.strokeStyle = isSel ? color       : color+"40";
          ctx.lineWidth   = isSel ? 1.5 : 0.8;
          ctx.fill(); ctx.stroke();
          ctx.fillStyle  = isSel ? W.statusFg : W.fgMuted;
          ctx.font       = `9px 'Hack','Courier New',monospace`;
          ctx.textAlign  = "center"; ctx.textBaseline = "middle";
          ctx.fillText(n.label, n.x, n.y);

        } else {
          // Notitie (vault): rechthoekje
          const nw = 124, nh = 28, nr = 5;
          const lx = n.x - nw/2, ly = n.y - nh/2;
          if (isSel) { ctx.shadowBlur=10; ctx.shadowColor=color+"60"; }
          ctx.beginPath(); ctx.roundRect(lx,ly,nw,nh,nr);
          ctx.fillStyle   = isSel ? color+"30" : W.bg2;
          ctx.strokeStyle = isSel ? color       : color+"45";
          ctx.lineWidth   = isSel ? 2 : 0.8;
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur  = 0;
          ctx.fillStyle   = isSel ? W.statusFg : W.fgDim;
          ctx.font        = `${isSel?"bold ":""}10px 'Hack','Courier New',monospace`;
          ctx.textAlign   = "center"; ctx.textBaseline = "middle";
          ctx.fillText(n.label, n.x, n.y);
        }
      });

      ctx.restore();
      afRef.current = requestAnimationFrame(draw);
    };

    afRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(afRef.current);
      ro.disconnect();
    };
  }, [nodes, edges, selId, zoom, pan]);

  // ── Muis/touch interactie ─────────────────────────────────────────────────
  const worldPos = useCallback((clientX, clientY) => {
    const r = cvRef.current.getBoundingClientRect();
    return {
      x: (clientX - r.left - pan.x) / zoom,
      y: (clientY - r.top  - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const nodeAt = useCallback((wx, wy) => {
    return nodesRef.current.find(n => {
      const dx = n.x - wx, dy = n.y - wy;
      const hitR = n.type==="root" ? 38 : n.type==="tag" ? 55 : 65;
      return Math.sqrt(dx*dx+dy*dy) < hitR/2 + 8;
    });
  }, []);

  const onMouseDown = useCallback((e) => {
    if (e.button === 1 || (e.button===0 && e.altKey)) {
      // Middelklik of Alt+klik = pannen
      panRef.current = {startX:e.clientX, startY:e.clientY,
                        origPanX:pan.x, origPanY:pan.y};
      return;
    }
    const {x,y} = worldPos(e.clientX, e.clientY);
    const n = nodeAt(x,y);
    if (n) {
      dragRef.current = {nodeId:n.id, startX:e.clientX, startY:e.clientY,
                         origX:n.x, origY:n.y, moved:false};
      setSelId(n.id);
    } else {
      setSelId(null);
      panRef.current = {startX:e.clientX, startY:e.clientY,
                        origPanX:pan.x, origPanY:pan.y};
    }
  }, [worldPos, nodeAt, pan]);

  const onMouseMove = useCallback((e) => {
    if (panRef.current) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setPan({x: panRef.current.origPanX+dx, y: panRef.current.origPanY+dy});
      return;
    }
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx)>3||Math.abs(dy)>3) dragRef.current.moved = true;
    const nx = dragRef.current.origX + dx/zoom;
    const ny = dragRef.current.origY + dy/zoom;
    setNodes(prev => prev.map(n =>
      n.id===dragRef.current.nodeId ? {...n,x:nx,y:ny} : n
    ));
  }, [zoom]);

  const onMouseUp = useCallback((e) => {
    if (panRef.current) { panRef.current=null; return; }
    if (!dragRef.current) return;
    const {nodeId, moved} = dragRef.current;
    dragRef.current = null;
    if (!moved) {
      // Klik zonder bewegen
      const n = nodesRef.current.find(x=>x.id===nodeId);
      if (!n) return;
      if (n.type==="note" && n.noteId) {
        onSelectNote?.(n.noteId);
      }
    }
  }, [onSelectNote]);

  const onDblClick = useCallback((e) => {
    const {x,y} = worldPos(e.clientX, e.clientY);
    const n = nodeAt(x,y);
    if (n && mode==="edit") {
      setEditingId(n.id);
      setEditLabel(n.fullLabel||n.label);
      setTimeout(()=>editRef.current?.focus(),30);
    }
  }, [worldPos, nodeAt, mode]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(z => Math.max(0.2, Math.min(3, z*factor)));
  }, []);

  // ── Nieuwe custom node toevoegen ──────────────────────────────────────────
  const addCustomNode = () => {
    const sel = nodesRef.current.find(n=>n.id===selId);
    const parentId = sel?.id || "root";
    const parent   = nodesRef.current.find(n=>n.id===parentId);
    const angle    = Math.random() * Math.PI*2;
    const dist     = 120;
    const newNode  = {
      id: "custom-"+Date.now(), label:"Nieuw", fullLabel:"Nieuw",
      type: "custom", color: W.yellow,
      x: (parent?.x||300) + dist*Math.cos(angle),
      y: (parent?.y||300) + dist*Math.sin(angle),
      parentId,
    };
    setNodes(p=>[...p, newNode]);
    setEdges(p=>[...p,{from:parentId, to:newNode.id}]);
    setSelId(newNode.id);
    setEditingId(newNode.id);
    setEditLabel("Nieuw");
    setMode("edit");
    setTimeout(()=>editRef.current?.focus(),30);
  };

  const deleteSelected = () => {
    if (!selId || selId==="root") return;
    setNodes(p=>p.filter(n=>n.id!==selId));
    setEdges(p=>p.filter(e=>e.from!==selId&&e.to!==selId));
    setSelId(null);
  };

  const commitEdit = () => {
    if (!editingId) return;
    setNodes(p=>p.map(n=>n.id===editingId
      ?{...n, label:editLabel.slice(0,22)+(editLabel.length>22?"…":""),
               fullLabel:editLabel} : n));
    setEditingId(null);
  };

  const selNode = nodes.find(n=>n.id===selId);

  // ── Mindmap → Markdown boomstructuur ──────────────────────────────────────
  // Bouwt een hiërarchische markdown-string uit de huidige nodes+edges.
  const nodesToMarkdown = useCallback(() => {
    const ns = nodes;
    if (!ns.length) return "";

    // Bouw parent→children map
    const childrenOf = {};
    ns.forEach(n => { childrenOf[n.id] = []; });
    edges.forEach(e => {
      if (childrenOf[e.from] !== undefined) childrenOf[e.from].push(e.to);
    });

    const root = ns.find(n => n.type === "root" || n.id === "root");
    if (!root) return "";

    const title = root.fullLabel || root.label;
    const lines = [`# ${title}`, ""];

    // Recursief de boom afdrukken
    const walk = (nodeId, depth) => {
      const children = (childrenOf[nodeId] || [])
        .map(cid => ns.find(n => n.id === cid))
        .filter(Boolean)
        .sort((a, b) => (a.y || 0) - (b.y || 0));  // volgorde top→bottom

      children.forEach(child => {
        const label = child.fullLabel || child.label;
        if (depth === 1) {
          // Hoofd-takken als ## sectie
          lines.push(`## ${label}`);
          lines.push("");
        } else if (depth === 2) {
          lines.push(`### ${label}`);
          lines.push("");
        } else {
          // Dieper: geneste bullet
          const indent = "  ".repeat(depth - 3);
          lines.push(`${indent}- **${label}**`);
        }
        walk(child.id, depth + 1);
      });
    };

    walk(root.id, 1);

    // Voeg footer toe
    const modeLabel = aiMode ? "AI-mindmap" : "Vault-mindmap";
    lines.push("");
    lines.push("---");
    lines.push(`*Gegenereerd vanuit ${modeLabel} op ${new Date().toLocaleDateString("nl-NL")}*`);

    return lines.join("\n");
  }, [nodes, edges, aiMode]);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const saveAsNote = useCallback(async () => {
    if (!onAddNote || saving) return;
    setSaving(true);
    const root = nodes.find(n => n.type==="root" || n.id==="root");
    const md = nodesToMarkdown();
    const title = "Mindmap — " + (root?.fullLabel || root?.label || "overzicht");
    try {
      await onAddNote({
        id:       genId(),
        title,
        content:  md,
        tags:     ["mindmap", aiMode ? "ai" : "vault"],
        created:  new Date().toISOString(),
        modified: new Date().toISOString(),
      });
      setSaveMsg("✓ Opgeslagen als notitie");
      setTimeout(() => setSaveMsg(""), 2500);
    } catch(e) {
      setSaveMsg("⚠ Fout bij opslaan");
      setTimeout(() => setSaveMsg(""), 2500);
    }
    setSaving(false);
  }, [nodes, edges, aiMode, onAddNote, nodesToMarkdown, saving]);

  // ── Render ────────────────────────────────────────────────────────────────
  // Mermaid editor modus
  if (mmView === "mermaid") {
    return React.createElement(MermaidEditor, {
      initialText: editMermaid,
      onSave: async ({title, content, tags}) => {
        if (!onAddNote) return;
        await onAddNote({
          id:       genId(),
          title,
          content,
          tags,
          created:  new Date().toISOString(),
          modified: new Date().toISOString(),
        });
      },
      onCancel: () => { setMmView("canvas"); setEditMermaid(null); }
    });
  }

  return React.createElement("div", {
    style:{position:"relative",width:"100%",height:"100%",overflow:"hidden"}
  },

    // Canvas
    React.createElement("canvas", {
      ref: cvRef,
      style:{width:"100%",height:"100%",cursor: dragRef.current?"grabbing":"crosshair"},
      onMouseDown, onMouseMove, onMouseUp, onDblClick,
      onWheel,
      onContextMenu: e=>e.preventDefault(),
    }),

    // ── Controls panel linksboven ────────────────────────────────────────────
    React.createElement("div", {
      style:{position:"absolute",top:"10px",left:"10px",zIndex:10,
             background:"rgba(28,28,28,0.88)",border:`1px solid ${W.splitBg}`,
             borderRadius:"8px",padding:"10px 12px",backdropFilter:"blur(6px)",
             display:"flex",flexDirection:"column",gap:"7px",minWidth:"210px"}
    },

      // AI/Vault/Mermaid toggle — bovenaan
      React.createElement("div",{
        style:{display:"flex",gap:"4px",background:"rgba(0,0,0,0.3)",
               borderRadius:"6px",padding:"3px",marginBottom:"2px"}
      },
        [
          ...(aiMindmap ? [{id:"ai",label:"🧠 AI"},{id:"vault",label:"🕸 Vault"}] : [{id:"vault",label:"🕸 Vault"}]),
          {id:"mermaid",label:"🌿 Mermaid"},
        ].map(opt =>
          React.createElement("button",{key:opt.id,
            onClick:()=>{
              if (opt.id==="mermaid") { setMmView("mermaid"); setEditMermaid(null); }
              else { setAiMode(opt.id==="ai"); }
            },
            style:{
              flex:1,
              background: (opt.id==="mermaid" ? mmView==="mermaid"
                          : opt.id==="ai" ? (aiMode&&mmView==="canvas")
                          : (!aiMode&&mmView==="canvas"))
                ? "rgba(138,198,242,0.2)" : "none",
              border:`1px solid ${
                (opt.id==="mermaid" ? mmView==="mermaid"
                : opt.id==="ai" ? (aiMode&&mmView==="canvas")
                : (!aiMode&&mmView==="canvas"))
                ? "rgba(138,198,242,0.5)" : "transparent"}`,
              color: (opt.id==="mermaid" ? mmView==="mermaid"
                     : opt.id==="ai" ? (aiMode&&mmView==="canvas")
                     : (!aiMode&&mmView==="canvas"))
                ? "#a8d8f0" : W.fgMuted,
              borderRadius:"4px",padding:"3px 6px",fontSize:"10px",cursor:"pointer"
            }
          },opt.label)
        )
      ),

      // AI mindmap info
      aiMode && aiMindmap && React.createElement("div",{
        style:{fontSize:"9px",color:W.comment,padding:"3px 6px",
               background:"rgba(159,202,86,0.08)",borderRadius:"4px",
               borderLeft:"2px solid rgba(159,202,86,0.4)"}
      },
        "📄 ",aiMindmap.root,
        React.createElement("br"),
        `${aiMindmap.branches?.length||0} takken · `,
        `${aiMindmap.branches?.reduce((a,b)=>(a+(b.children?.length||0)),0)||0} subtopics`
      ),

      // ── Opslaan als notitie ──────────────────────────────────────────────
      onAddNote && nodes.length > 1 && React.createElement("div",{
        style:{borderTop:`1px solid ${W.splitBg}`,paddingTop:"7px"}
      },
        React.createElement("button",{
          onClick: saveAsNote,
          disabled: saving,
          style:{
            width:"100%", padding:"6px 10px",
            background: saving
              ? "rgba(159,202,86,0.08)"
              : "linear-gradient(135deg,rgba(159,202,86,0.22),rgba(159,202,86,0.12))",
            border:`1px solid rgba(159,202,86,${saving?0.15:0.45})`,
            borderRadius:"5px", color:saving?W.fgMuted:W.comment,
            fontSize:"11px", fontWeight:"600", cursor:saving?"default":"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:"5px",
            transition:"all 0.15s",
          }
        },
          saving
            ? React.createElement(React.Fragment,null,
                React.createElement("span",{style:{fontSize:"12px"}},"⏳"),
                "Opslaan…")
            : React.createElement(React.Fragment,null,
                React.createElement("span",{style:{fontSize:"12px"}},"💾"),
                "Opslaan als notitie")
        ),
        saveMsg && React.createElement("div",{style:{
          marginTop:"5px", fontSize:"10px", textAlign:"center",
          color: saveMsg.startsWith("✓") ? W.comment : W.orange,
        }}, saveMsg)
      ),
      React.createElement("div",{style:{display:"flex",gap:"5px",alignItems:"center"}},
        React.createElement("span",{style:{fontSize:"9px",color:"rgba(138,198,242,0.5)",
          letterSpacing:"2px",flex:1}},"MODUS"),
        [{id:"view",label:"👁 bekijk"},{id:"edit",label:"✏ bewerk"}].map(m=>
          React.createElement("button",{key:m.id, onClick:()=>setMode(m.id),
            style:{background:mode===m.id?"rgba(138,198,242,0.18)":"none",
                   border:`1px solid ${mode===m.id?"rgba(138,198,242,0.5)":W.splitBg}`,
                   color:mode===m.id?"#a8d8f0":W.fgMuted,
                   borderRadius:"4px",padding:"2px 8px",fontSize:"10px",cursor:"pointer"}
          },m.label))
      ),

      // Layout + weergave — in vault-modus ook tag-filter
      React.createElement(React.Fragment,null,
        // Layout
        React.createElement("div",{style:{display:"flex",gap:"5px",alignItems:"center"}},
          React.createElement("span",{style:{fontSize:"9px",color:"rgba(138,198,242,0.5)",
            letterSpacing:"2px",flex:1}},"LAYOUT"),
          [{id:"radial",label:"⊙"},{id:"tree",label:"⊤"}].map(l=>
            React.createElement("button",{key:l.id, onClick:()=>setLayout(l.id),
              style:{background:layout===l.id?"rgba(138,198,242,0.18)":"none",
                     border:`1px solid ${layout===l.id?"rgba(138,198,242,0.5)":W.splitBg}`,
                     color:layout===l.id?"#a8d8f0":W.fgMuted,
                     borderRadius:"4px",padding:"2px 10px",fontSize:"12px",cursor:"pointer"}
            },l.label))
        ),
        // Weergave (tags/notities toggle alleen zinvol in vault-modus)
        !aiMode && React.createElement("div",{style:{display:"flex",gap:"5px",flexWrap:"wrap"}},
          [{label:"tags",val:showTags,set:setShowTags},
           {label:"notities",val:showNotes,set:setShowNotes}].map(({label,val,set})=>
            React.createElement("button",{key:label,onClick:()=>set(v=>!v),
              style:{background:val?"rgba(138,198,242,0.12)":"none",
                     border:`1px solid ${val?"rgba(138,198,242,0.4)":W.splitBg}`,
                     color:val?"#a8d8f0":W.fgMuted,
                     borderRadius:"4px",padding:"2px 9px",fontSize:"10px",cursor:"pointer"}
            },val?"✓ "+label:"○ "+label))
        ),
        // Tag filter: alleen in vault-modus
        !aiMode && allTags.length>0 && React.createElement("div",null,
          React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
            letterSpacing:"2px",marginBottom:"4px"}},"TAG FILTER"),
          React.createElement(TagFilterBar,{tags:allTags,activeTag:tagFilter,onChange:setTagFilter,compact:true,tagColors:tagColorMap,maxVisible:6})
        )
      ),

      // Edit-modus acties — beschikbaar in beide modi
      mode==="edit" && React.createElement("div",{
        style:{borderTop:`1px solid ${W.splitBg}`,paddingTop:"7px",
               display:"flex",gap:"5px",flexWrap:"wrap"}
      },
        React.createElement("button",{onClick:addCustomNode,
          style:{background:"rgba(138,198,242,0.1)",border:`1px solid rgba(138,198,242,0.3)`,
                 color:"#a8d8f0",borderRadius:"4px",padding:"3px 9px",
                 fontSize:"10px",cursor:"pointer"}
        },"+ knoop"),
        selId&&selId!=="root"&&React.createElement("button",{onClick:deleteSelected,
          style:{background:"rgba(229,120,109,0.08)",border:`1px solid rgba(229,120,109,0.25)`,
                 color:W.orange,borderRadius:"4px",padding:"3px 9px",
                 fontSize:"10px",cursor:"pointer"}
        },"✕ verwijder"),
        React.createElement("button",{onClick:()=>aiMode?buildAiLayout():buildLayout(),
          style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                 borderRadius:"4px",padding:"3px 9px",fontSize:"10px",cursor:"pointer"}
        },"↺ reset"),
        React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
          width:"100%",marginTop:"2px"}},"dubbelklik = hernoemen · sleep = verplaatsen")
      )
    ),

    // ── Zoom controls rechtsonder ─────────────────────────────────────────────
    React.createElement("div",{
      style:{position:"absolute",bottom:"14px",right:"14px",zIndex:10,
             display:"flex",gap:"5px",alignItems:"center"}
    },
      React.createElement("button",{onClick:()=>setZoom(z=>Math.max(0.2,z/1.2)),
        style:{background:W.bg2,border:`1px solid ${W.splitBg}`,color:W.fg,
               borderRadius:"4px",padding:"4px 10px",fontSize:"16px",cursor:"pointer"}
      },"−"),
      React.createElement("span",{
        onClick:()=>{setZoom(1);setPan({x:0,y:0});},
        style:{fontSize:"10px",color:W.fgMuted,cursor:"pointer",minWidth:"38px",textAlign:"center"}
      },Math.round(zoom*100)+"%"),
      React.createElement("button",{onClick:()=>setZoom(z=>Math.min(3,z*1.2)),
        style:{background:W.bg2,border:`1px solid ${W.splitBg}`,color:W.fg,
               borderRadius:"4px",padding:"4px 10px",fontSize:"16px",cursor:"pointer"}
      },"＋")
    ),

    // ── Geselecteerde node info rechtsbovenin ─────────────────────────────────
    selNode && React.createElement("div",{
      style:{position:"absolute",top:"10px",right:"10px",zIndex:10,
             background:"rgba(28,28,28,0.9)",border:`1px solid ${selNode.color||W.splitBg}40`,
             borderRadius:"8px",padding:"10px 14px",maxWidth:"220px",
             backdropFilter:"blur(6px)"}
    },
      React.createElement("div",{style:{fontSize:"10px",color:selNode.color||W.fgMuted,
        letterSpacing:"1px",marginBottom:"4px"}},
        selNode.type==="root"?"ROOT":selNode.type==="tag"?"TAG":"NOTITIE"),
      React.createElement("div",{style:{fontSize:"12px",color:W.fg,
        fontWeight:"bold",wordBreak:"break-word",marginBottom:"6px"}},
        selNode.fullLabel||selNode.label),
      selNode.type==="note"&&selNode.noteId&&React.createElement("button",{
        onClick:()=>onSelectNote?.(selNode.noteId),
        style:{background:"rgba(138,198,242,0.1)",border:"1px solid rgba(138,198,242,0.3)",
               color:"#a8d8f0",borderRadius:"4px",padding:"4px 10px",
               fontSize:"10px",cursor:"pointer",width:"100%"}
      },"→ open notitie")
    ),

    // ── Inline label-editor (bij dubbelklik in edit-modus) ────────────────────
    editingId && React.createElement("div",{
      style:{position:"absolute",inset:0,zIndex:50,
             display:"flex",alignItems:"center",justifyContent:"center",
             background:"rgba(0,0,0,0.3)"},
      onClick:commitEdit,
    },
      React.createElement("div",{
        onClick:e=>e.stopPropagation(),
        style:{background:W.bg2,border:`2px solid rgba(138,198,242,0.5)`,
               borderRadius:"8px",padding:"16px 20px",
               display:"flex",flexDirection:"column",gap:"10px",
               minWidth:"260px",boxShadow:"0 8px 32px rgba(0,0,0,0.7)"}
      },
        React.createElement("div",{style:{fontSize:"11px",color:"rgba(138,198,242,0.6)",
          letterSpacing:"2px"}},"LABEL BEWERKEN"),
        React.createElement("input",{
          ref:editRef,
          value:editLabel,
          onChange:e=>setEditLabel(e.target.value),
          onKeyDown:e=>{
            if(e.key==="Enter"){ e.preventDefault(); commitEdit(); }
            if(e.key==="Escape"){ setEditingId(null); }
          },
          style:{background:W.bg,border:`1px solid rgba(138,198,242,0.4)`,
                 borderRadius:"5px",padding:"8px 12px",color:W.fg,
                 fontSize:"14px",outline:"none"}
        }),
        React.createElement("div",{style:{display:"flex",gap:"8px"}},
          React.createElement("button",{onClick:commitEdit,
            style:{flex:1,background:"rgba(138,198,242,0.15)",
                   border:"1px solid rgba(138,198,242,0.4)",
                   color:"#a8d8f0",borderRadius:"5px",padding:"6px",
                   fontSize:"12px",cursor:"pointer",fontWeight:"bold"}
          },"✓ opslaan"),
          React.createElement("button",{onClick:()=>setEditingId(null),
            style:{background:"none",border:`1px solid ${W.splitBg}`,
                   color:W.fgMuted,borderRadius:"5px",padding:"6px 12px",
                   fontSize:"12px",cursor:"pointer"}
          },"Esc")
        )
      )
    ),

    // ── Legenda onderin ────────────────────────────────────────────────────────
    React.createElement("div",{
      style:{position:"absolute",bottom:"14px",left:"50%",transform:"translateX(-50%)",
             background:"rgba(28,28,28,0.85)",border:`1px solid ${W.splitBg}`,
             borderRadius:"6px",padding:"5px 14px",fontSize:"10px",color:W.fgMuted,
             display:"flex",gap:"14px",backdropFilter:"blur(8px)"}
    },
      React.createElement("span",null,"⊙ root"),
      React.createElement("span",{style:{color:"#a8d8f0"}},"▬ tag"),
      React.createElement("span",{style:{color:W.fgDim}},"□ notitie"),
      React.createElement("span",null,"scroll = zoom"),
      React.createElement("span",null,"sleep = pannen/verplaatsen"),
      mode==="edit"&&React.createElement("span",{style:{color:W.yellow}},"✏ dubbelklik = bewerken")
    )
  );
};



// ── LLM Notebook ───────────────────────────────────────────────────────────────
// Notebook-stijl chat interface tegen lokale Ollama LLM.
// Context: selecteer notities en/of PDF-annotaties als kennisbasis.
// Aanbevolen modellen: llama3, mistral, phi3, gemma2
//
// Installatie Ollama:
//   curl -fsSL https://ollama.com/install.sh | sh
//   ollama pull llama3          (8B, goede balans kwaliteit/snelheid)
//   ollama pull mistral         (7B, snel, goed voor Europese talen)
//   ollama pull phi3:medium     (14B, sterk voor analyse)
//   ollama serve                (start de server op poort 11434)

const SUGGESTED_MODELS = [
  { id:"llama3.2-vision", label:"Llama 3.2 Vision 11B", desc:"Meta · tekst + afbeeldingen, aanbevolen" },
  { id:"llama3",          label:"Llama 3 8B",            desc:"Meta · snel, goed algemeen gebruik" },
  { id:"mistral",         label:"Mistral 7B",             desc:"Mistral AI · snel, goed voor EU-talen" },
  { id:"phi3:medium",     label:"Phi-3 Medium 14B",      desc:"Microsoft · sterk in redeneren & analyse" },
  { id:"gemma2",          label:"Gemma 2 9B",             desc:"Google · modern, goed voor lange context" },
];

const LLMNotebook = ({notes, pdfNotes, serverPdfs, serverImages, allTags, onAddNote, llmModel, setLlmModel, onMindmapReady}) => {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  // ── State ─────────────────────────────────────────────────────────────────
  const [messages,      setMessages]     = useState([]);
  const [input,         setInput]        = useState("");
  const [streaming,     setStreaming]    = useState(false);
  const [model,         setModel]        = useState("llama3.2-vision");
  const [availModels,   setAvailModels]  = useState([]);
  const [ollamaStatus,  setOllamaStatus] = useState("onbekend"); // ok / fout / laden
  const [ollamaUrl,     setOllamaUrl]    = useState("http://localhost:11434");
  const [ctxNotes,      setCtxNotes]     = useState([]);
  const [ctxPdfs,       setCtxPdfs]      = useState([]);
  const [ctxImages,     setCtxImages]    = useState([]);
  const [showContext,   setShowContext]  = useState(true);
  const [showInstall,   setShowInstall]  = useState(false);
  const [tagFilter,     setTagFilter]    = useState(null);
  const [savingNote,    setSavingNote]   = useState(false);
  const [mmPending,     setMmPending]    = useState(false);   // mindmap genereren

  const chatEndRef  = useRef(null);
  const inputRef    = useRef(null);
  const abortRef    = useRef(null);  // AbortController voor streaming

  // ── Ollama status check ───────────────────────────────────────────────────
  // Sync model met parent (gedeeld llmModel)
  useEffect(()=>{ if(llmModel) setModel(llmModel); },[llmModel]);
  useEffect(()=>{ if(setLlmModel && model) setLlmModel(model); },[model]);

  const checkOllama = useCallback(async () => {
    setOllamaStatus("laden");
    try {
      const r = await fetch("/api/llm/models");
      const d = await r.json();
      setOllamaUrl(d.ollama_url);
      if (d.ok && d.models.length > 0) {
        setAvailModels(d.models);
        setOllamaStatus("ok");
        if (!d.models.includes(model)) setModel(d.models[0]);
      } else if (d.ok) {
        setAvailModels([]);
        setOllamaStatus("geen-modellen");
      } else {
        setOllamaStatus("fout");
      }
    } catch(e) {
      setOllamaStatus("fout");
    }
  }, [model]);

  useEffect(() => { checkOllama(); }, []);

  // ── Auto-scroll naar onderste bericht ────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Context samenvatting ──────────────────────────────────────────────────
  const contextSummary = useMemo(() => {
    const nCount = ctxNotes.length;
    const pCount = ctxPdfs.length;
    const iCount = ctxImages.length;
    if (!nCount && !pCount && !iCount) return null;
    const parts = [];
    if (nCount) parts.push(nCount+" notitie"+(nCount>1?"s":""));
    if (pCount) parts.push(pCount+" PDF"+(pCount>1?"'s":""));
    if (iCount) parts.push(iCount+" afb.");
    return parts.join(" + ");
  }, [ctxNotes, ctxPdfs, ctxImages]);

  // ── Gefilterde notities voor context-selector ─────────────────────────────
  const filteredNotes = useMemo(() => {
    if (!tagFilter) return notes;
    return notes.filter(n => (n.tags||[]).includes(tagFilter));
  }, [notes, tagFilter]);

  // ── Alle beschikbare PDF's (met annotaties) ───────────────────────────────
  const pdfsWithAnnots = useMemo(() => {
    // Alle PDFs tonen in de context-selector, ook die zonder annotaties
    return (serverPdfs||[]).map(p => ({
      ...p,
      annotCount: pdfNotes.filter(a => a.file === p.name).length,
    }));
  }, [serverPdfs, pdfNotes]);

  // ── Selecteer alles / niets ────────────────────────────────────────────────
  const selectAllNotes = () => setCtxNotes(filteredNotes.map(n => n.id));
  const selectNone     = () => { setCtxNotes([]); setCtxPdfs([]); };

  // ── Verstuur bericht ──────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setStreaming(true);

    // Placeholder assistent bericht
    const assistantPlaceholder = { role: "assistant", content: "", streaming: true };
    setMessages([...history, assistantPlaceholder]);

    try {
      const body = JSON.stringify({
        model,
        messages: history.map(m => ({ role: m.role, content: m.content })),
        context_notes:  ctxNotes,
        context_pdfs:   ctxPdfs,
        context_images: ctxImages,
      });

      const resp = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const dec    = new TextDecoder();
      let   buf    = "";
      let   full   = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.error) throw new Error(evt.error);
            if (evt.delta) {
              full += evt.delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant", content: full, streaming: true
                };
                return updated;
              });
            }
            if (evt.done) break;
          } catch(e) {
            if (e.message && !e.message.includes("JSON")) throw e;
          }
        }
      }

      // Finaliseer bericht
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: full };
        return updated;
      });

    } catch(e) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "",
          error: e.message || "Onbekende fout",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, messages, model, ctxNotes, ctxPdfs, streaming]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearChat = () => { setMessages([]); setInput(""); };

  // ── Analyse → nieuwe notitie ─────────────────────────────────────────────
  const saveAnalysisAsNote = useCallback(async () => {
    if (!messages.length || !onAddNote) return;
    setSavingNote(true);
    try {
      const assistantMsgs = messages.filter(m=>m.role==="assistant"&&m.content);
      const content = assistantMsgs.map(m=>m.content).join("\n\n---\n\n");
      const date    = new Date().toLocaleDateString("nl-NL");
      const ctxLabel= ctxNotes.length||ctxPdfs.length
        ? " (" + [...ctxNotes.slice(0,2), ...ctxPdfs.slice(0,2)].join(", ") + ")"
        : "";
      const note = {
        id: genId(),
        title: "Analyse " + date + ctxLabel,
        content: "# Notebook LLM Analyse\n\n*" + date + "*\n\n" + content,
        tags: ["analyse","llm"],
        created: new Date().toISOString(), modified: new Date().toISOString(),
      };
      await onAddNote(note);
    } catch(e){ console.error(e); }
    setSavingNote(false);
  }, [messages, ctxNotes, ctxPdfs, onAddNote]);

  // ── Mindmap genereren op basis van context ────────────────────────────────
  const generateMindmap = useCallback(async () => {
    const hasContext = ctxNotes.length || ctxPdfs.length;
    if (!hasContext) {
      setMessages(p=>[...p,{role:"assistant",
        content:"⚠ Selecteer eerst notities of PDF's in het contextpaneel (links) om een mindmap te genereren."}]);
      return;
    }
    setMmPending(true);
    try {
      const res = await api.llmMindmap({
        model, context_notes: ctxNotes, context_pdfs: ctxPdfs
      });
      if (res?.ok && res.mindmap) {
        const mm = res.mindmap;
        // Stuur naar visuele MindMap tab
        onMindmapReady?.(mm);
        // Toon ook tekstsamenvatting in chat
        let md = "## 🗺 Mindmap gegenereerd: **" + (mm.root||"Overzicht") + "**\n\n";
        md += `*${mm.branches?.length||0} hoofdtakken — bekijk de visuele weergave in het 🗺 Mindmap tab*\n\n`;
        (mm.branches||[]).forEach(b=>{
          md += "**" + b.label + "**";
          if (b.importance==="high") md += " ⭐";
          md += "\n";
          (b.children||[]).forEach(c=>{
            const lbl = typeof c==="string" ? c : c.label;
            md += "  - " + lbl + "\n";
            if (c.details?.length) {
              c.details.forEach(d=>{ md += "    · " + d + "\n"; });
            }
          });
          md += "\n";
        });
        setMessages(p=>[...p,{role:"assistant",content:md}]);
      } else {
        setMessages(p=>[...p,{role:"assistant",
          content:"⚠ Mindmap genereren mislukt: "+(res?.error||"geen JSON response van model")+
          (res?.raw ? "\n\n```\n"+res.raw.slice(0,300)+"\n```" : "")}]);
      }
    } catch(e){
      setMessages(p=>[...p,{role:"assistant",content:"⚠ "+e.message}]);
    }
    setMmPending(false);
  }, [model, ctxNotes, ctxPdfs, onMindmapReady]);

  // ── Render markdown in chat (eenvoudig) ───────────────────────────────────
  const renderMsg = (content) => {
    if (!content) return "";
    // Code blocks
    let html = content
      .replace(/```(\w*)\n?([\s\S]*?)```/g, (_,lang,code) =>
        `<pre style="background:#1a1a1a;border:1px solid #3a4046;border-radius:6px;padding:12px;overflow-x:auto;font-size:12px;line-height:1.5;margin:8px 0"><code style="color:#cae682;font-family:'Hack','Courier New',monospace">${code.trim().replace(/</g,"&lt;")}</code></pre>`)
      // Inline code
      .replace(/`([^`]+)`/g, `<code style="background:#1a1a1a;color:#cae682;padding:1px 5px;border-radius:3px;font-family:'Hack',monospace;font-size:12px">$1</code>`)
      // Bold
      .replace(/\*\*(.+?)\*\*/g, `<strong style="color:#ffffd7">$1</strong>`)
      // Headers
      .replace(/^### (.+)$/gm, `<div style="color:#8ac6f2;font-weight:bold;margin:10px 0 4px;font-size:13px">$1</div>`)
      .replace(/^## (.+)$/gm,  `<div style="color:#ffffd7;font-weight:bold;margin:12px 0 5px;font-size:14px">$1</div>`)
      .replace(/^# (.+)$/gm,   `<div style="color:#ffffd7;font-weight:bold;margin:14px 0 6px;font-size:15px">$1</div>`)
      // Lists
      .replace(/^[-*] (.+)$/gm, `<div style="margin:2px 0;padding-left:14px">• $1</div>`)
      .replace(/^\d+\. (.+)$/gm, (_,t,i) => `<div style="margin:2px 0;padding-left:14px">${_}</div>`)
      // Line breaks
      .replace(/\n\n/g, `<div style="height:8px"></div>`)
      .replace(/\n/g, `<br>`);
    return html;
  };

  // ── Status indicator ──────────────────────────────────────────────────────
  const statusDot = {
    ok:           { color: W.comment,  label: `Ollama actief · ${availModels.length} model${availModels.length!==1?"s":""}` },
    fout:         { color: W.orange,   label: "Ollama niet bereikbaar" },
    laden:        { color: W.blue,     label: "Verbinden…" },
    "geen-modellen": { color: W.yellow, label: "Ollama actief maar geen modellen" },
    onbekend:     { color: W.fgMuted,  label: "Status onbekend" },
  }[ollamaStatus] || { color: W.fgMuted, label: ollamaStatus };

  // ── Tags voor context filter ──────────────────────────────────────────────
  const allNoteTags = useMemo(() => [...new Set(notes.flatMap(n=>n.tags||[]))], [notes]);

  // ── Render ────────────────────────────────────────────────────────────────
  const isMobileView = window.innerWidth < 768;

  return React.createElement("div", {
    style:{ display:"flex", height:"100%", background:W.bg, overflow:"hidden" }
  },

    // ── Context zijpaneel ────────────────────────────────────────────────────
    showContext && React.createElement("div", {
      style:{
        width: isMobileView ? "100%" : "280px",
        flexShrink:0,
        background:W.bg2,
        borderRight:`1px solid ${W.splitBg}`,
        display:"flex", flexDirection:"column",
        position: isMobileView ? "absolute" : "relative",
        inset: isMobileView ? 0 : "auto",
        zIndex: isMobileView ? 50 : "auto",
      }
    },
      // Context header
      React.createElement("div", {
        style:{background:W.statusBg,borderBottom:`1px solid ${W.splitBg}`,
               padding:"10px 12px",flexShrink:0}
      },
        React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}},
          React.createElement("span", {style:{fontSize:"11px",fontWeight:"bold",
            color:W.statusFg,letterSpacing:"2px",flex:1}}, "KENNISCONTEXT"),
          isMobileView && React.createElement("button", {
            onClick:()=>setShowContext(false),
            style:{background:"none",border:"none",color:W.fgMuted,fontSize:"18px",cursor:"pointer"}
          }, "×")
        ),
        // Selectie-knoppen
        React.createElement("div", {style:{display:"flex",gap:"5px",flexWrap:"wrap"}},
          React.createElement("button", {
            onClick:selectAllNotes,
            style:{background:"rgba(138,198,242,0.1)",border:`1px solid rgba(138,198,242,0.25)`,
                   color:"#a8d8f0",borderRadius:"4px",padding:"3px 8px",fontSize:"10px",cursor:"pointer"}
          }, "✓ alle notities"),
          React.createElement("button", {
            onClick:selectNone,
            style:{background:"rgba(229,120,109,0.08)",border:`1px solid rgba(229,120,109,0.2)`,
                   color:W.orange,borderRadius:"4px",padding:"3px 8px",fontSize:"10px",cursor:"pointer"}
          }, "✕ wis alles")
        ),
        allNoteTags.length > 0 && React.createElement("div",{style:{marginTop:"8px"}},
          React.createElement("span",{style:{fontSize:"9px",color:W.fgMuted,display:"block",marginBottom:"4px",letterSpacing:"1px"}},"FILTER:"),
          React.createElement(TagFilterBar,{tags:allNoteTags,activeTag:tagFilter,onChange:setTagFilter,compact:true,maxVisible:6})
        )
      ),

      // Context inhoud: tabs notities/PDFs
      React.createElement("div", {style:{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch"}},

        // Notities sectie
        React.createElement("div", {
          style:{padding:"8px 10px 4px",fontSize:"9px",color:"rgba(138,198,242,0.5)",
                 letterSpacing:"2px",borderBottom:`1px solid ${W.splitBg}`,
                 display:"flex",alignItems:"center",gap:"6px",background:W.bg}
        },
          React.createElement("span",null,"NOTITIES"),
          React.createElement("span",{style:{background:W.blue,color:W.bg,borderRadius:"8px",
            padding:"0 5px",fontSize:"9px"}},ctxNotes.length+"/"+filteredNotes.length)
        ),
        filteredNotes.map(n => {
          const sel = ctxNotes.includes(n.id);
          return React.createElement("div", {
            key:n.id,
            onClick:()=>setCtxNotes(p=>sel?p.filter(x=>x!==n.id):[...p,n.id]),
            style:{
              padding:"7px 12px",borderBottom:`1px solid rgba(255,255,255,0.03)`,
              cursor:"pointer",display:"flex",alignItems:"flex-start",gap:"8px",
              background:sel?"rgba(138,198,242,0.08)":"transparent",
              borderLeft:`3px solid ${sel?"rgba(138,198,242,0.6)":"transparent"}`,
            }
          },
            React.createElement("div", {
              style:{width:"14px",height:"14px",borderRadius:"3px",flexShrink:0,marginTop:"1px",
                     background:sel?"rgba(138,198,242,0.3)":"transparent",
                     border:`1.5px solid ${sel?"rgba(138,198,242,0.7)":"rgba(255,255,255,0.15)"}`,
                     display:"flex",alignItems:"center",justifyContent:"center"}
            }, sel && React.createElement("span",{style:{fontSize:"9px",color:"#a8d8f0",lineHeight:1}},"✓")),
            React.createElement("div", {style:{minWidth:0}},
              React.createElement("div",{style:{fontSize:"11px",color:sel?W.fg:W.fgDim,
                lineHeight:"1.3",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}, n.title),
              (n.tags||[]).length>0 && React.createElement("div",{style:{marginTop:"2px",display:"flex",gap:"3px",flexWrap:"wrap"}},
                (n.tags||[]).slice(0,3).map(t=>React.createElement("span",{key:t,
                  style:{fontSize:"9px",color:"rgba(138,198,240,0.6)",padding:"0 3px",
                         background:"rgba(138,198,242,0.06)",borderRadius:"3px",border:"1px solid rgba(138,198,242,0.15)"}
                },"#"+t))
              )
            )
          );
        }),

        // Afbeeldingen sectie
        (serverImages||[]).length > 0 && React.createElement(React.Fragment, null,
          React.createElement("div", {
            style:{padding:"8px 10px 4px",fontSize:"9px",
                   color:"rgba(229,193,120,0.6)",
                   letterSpacing:"2px",borderBottom:`1px solid ${W.splitBg}`,
                   display:"flex",alignItems:"center",gap:"6px",background:W.bg}
          },
            React.createElement("span",null,"AFBEELDINGEN"),
            React.createElement("span",{style:{background:W.yellow,color:W.bg,borderRadius:"8px",
              padding:"0 5px",fontSize:"9px"}},ctxImages.length+"/"+(serverImages||[]).length)
          ),
          (serverImages||[]).map(img => {
            const sel = ctxImages.includes(img.name);
            return React.createElement("div", {
              key:img.name,
              onClick:()=>setCtxImages(p=>sel?p.filter(x=>x!==img.name):[...p,img.name]),
              style:{
                padding:"7px 12px",borderBottom:`1px solid rgba(255,255,255,0.03)`,
                cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",
                background:sel?"rgba(229,193,120,0.07)":"transparent",
                borderLeft:`3px solid ${sel?"rgba(229,193,120,0.5)":"transparent"}`,
              }
            },
              React.createElement("div", {
                style:{width:"14px",height:"14px",borderRadius:"3px",flexShrink:0,
                       background:sel?"rgba(229,193,120,0.25)":"transparent",
                       border:`1.5px solid ${sel?"rgba(229,193,120,0.6)":"rgba(255,255,255,0.15)"}`,
                       display:"flex",alignItems:"center",justifyContent:"center"}
              }, sel&&React.createElement("span",{style:{fontSize:"9px",color:W.yellow,lineHeight:1}},"✓")),
              React.createElement("img",{src:img.url,alt:img.name,
                style:{width:"28px",height:"28px",objectFit:"cover",borderRadius:"3px",
                       flexShrink:0,background:W.lineNrBg}}),
              React.createElement("div",{style:{minWidth:0,fontSize:"11px",
                color:sel?W.fg:W.fgDim,overflow:"hidden",
                textOverflow:"ellipsis",whiteSpace:"nowrap"}},img.name)
            );
          })
        ),

        // PDF's sectie — alle PDFs tonen, ook zonder annotaties
        pdfsWithAnnots.length > 0 && React.createElement(React.Fragment, null,
          React.createElement("div", {
            style:{padding:"8px 10px 4px",fontSize:"9px",color:"rgba(229,120,109,0.6)",
                   letterSpacing:"2px",borderBottom:`1px solid ${W.splitBg}`,
                   display:"flex",alignItems:"center",gap:"6px",background:W.bg}
          },
            React.createElement("span",null,"PDF'S"),
            React.createElement("span",{style:{background:W.orange,color:W.bg,borderRadius:"8px",
              padding:"0 5px",fontSize:"9px"}},ctxPdfs.length+"/"+pdfsWithAnnots.length)
          ),
          pdfsWithAnnots.map(p => {
            const sel = ctxPdfs.includes(p.name);
            return React.createElement("div", {
              key:p.name,
              onClick:()=>setCtxPdfs(prev=>sel?prev.filter(x=>x!==p.name):[...prev,p.name]),
              style:{
                padding:"7px 12px",borderBottom:`1px solid rgba(255,255,255,0.03)`,
                cursor:"pointer",display:"flex",alignItems:"flex-start",gap:"8px",
                background:sel?"rgba(229,120,109,0.07)":"transparent",
                borderLeft:`3px solid ${sel?"rgba(229,120,109,0.5)":"transparent"}`,
              }
            },
              React.createElement("div", {
                style:{width:"14px",height:"14px",borderRadius:"3px",flexShrink:0,marginTop:"1px",
                       background:sel?"rgba(229,120,109,0.25)":"transparent",
                       border:`1.5px solid ${sel?"rgba(229,120,109,0.6)":"rgba(255,255,255,0.15)"}`,
                       display:"flex",alignItems:"center",justifyContent:"center"}
              }, sel && React.createElement("span",{style:{fontSize:"9px",color:W.orange,lineHeight:1}},"✓")),
              React.createElement("div",{style:{minWidth:0}},
                React.createElement("div",{style:{fontSize:"11px",color:sel?W.fg:W.fgDim,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}, "📄 "+p.name),
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,marginTop:"2px"}},
                  p.annotCount > 0
                    ? p.annotCount+" annotatie"+(p.annotCount!==1?"s":"")
                    : "geen annotaties — tekst via AI")
              )
            );
          })
        )
      )
    ),

    // ── Hoofd chat kolom ─────────────────────────────────────────────────────
    React.createElement("div", {
      style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}
    },

      // Chat toolbar
      React.createElement("div", {
        style:{background:W.statusBg,borderBottom:`1px solid ${W.splitBg}`,
               padding:"6px 12px",display:"flex",alignItems:"center",
               gap:"8px",flexShrink:0,flexWrap:"wrap"}
      },
        // Context toggle
        React.createElement("button", {
          onClick:()=>setShowContext(p=>!p),
          style:{background:showContext?"rgba(138,198,242,0.15)":"none",
                 border:`1px solid ${showContext?"rgba(138,198,242,0.4)":W.splitBg}`,
                 color:showContext?"#a8d8f0":W.fgMuted,
                 borderRadius:"5px",padding:"4px 10px",fontSize:"11px",cursor:"pointer"}
        }, showContext ? "◀ context" : "▶ context"),

        // Context badge
        contextSummary && React.createElement("span", {
          style:{fontSize:"10px",color:"#a8d8f0",background:"rgba(138,198,242,0.1)",
                 border:"1px solid rgba(138,198,242,0.25)",borderRadius:"10px",
                 padding:"2px 8px"}
        }, "📚 "+contextSummary),
        !contextSummary && React.createElement("span",{
          style:{fontSize:"10px",color:W.fgMuted}
        },"geen context geselecteerd"),

        React.createElement("div",{style:{flex:1}}),

        // Model selectie
        ollamaStatus === "ok"
          ? React.createElement("select", {
              value:model, onChange:e=>setModel(e.target.value),
              style:{background:W.bg,color:W.fg,border:`1px solid ${W.splitBg}`,
                     borderRadius:"4px",padding:"3px 6px",fontSize:"11px",cursor:"pointer"}
            },
              availModels.map(m => React.createElement("option",{key:m,value:m},m))
            )
          : React.createElement("input", {
              value:model, onChange:e=>setModel(e.target.value),
              placeholder:"model naam (bijv. llama3)",
              style:{background:W.bg,color:W.fg,border:`1px solid ${W.splitBg}`,
                     borderRadius:"4px",padding:"3px 8px",fontSize:"11px",width:"140px",outline:"none"}
            }),

        // Ollama status
        React.createElement("div", {
          style:{display:"flex",alignItems:"center",gap:"5px",cursor:"pointer"},
          onClick:checkOllama,
          title:"Klik om opnieuw te verbinden"
        },
          React.createElement("div",{style:{width:"7px",height:"7px",borderRadius:"50%",
            background:statusDot.color,flexShrink:0}}),
          React.createElement("span",{style:{fontSize:"10px",color:W.fgMuted}}, statusDot.label)
        ),

        // Install button als Ollama niet bereikbaar
        (ollamaStatus==="fout"||ollamaStatus==="geen-modellen") && React.createElement("button",{
          onClick:()=>setShowInstall(p=>!p),
          style:{background:"none",border:`1px solid ${W.orange}`,color:W.orange,
                 borderRadius:"4px",padding:"3px 8px",fontSize:"10px",cursor:"pointer"}
        },"? installatie"),

        // Mindmap knop
        (ctxNotes.length>0||ctxPdfs.length>0) && React.createElement("button", {
          onClick:generateMindmap, disabled:mmPending,
          style:{background:"rgba(138,198,242,0.08)",
                 border:"1px solid rgba(138,198,242,0.25)",
                 color:mmPending?W.fgMuted:"#a8d8f0",
                 borderRadius:"4px",padding:"3px 10px",fontSize:"10px",cursor:"pointer"}
        }, mmPending?"🗺 genereren…":"🗺 mindmap"),

        // Analyse → notitie
        messages.length>0 && onAddNote && React.createElement("button", {
          onClick:saveAnalysisAsNote, disabled:savingNote,
          style:{background:"rgba(159,202,86,0.08)",
                 border:"1px solid rgba(159,202,86,0.25)",
                 color:savingNote?W.fgMuted:W.comment,
                 borderRadius:"4px",padding:"3px 10px",fontSize:"10px",cursor:"pointer"}
        }, savingNote?"💾 opslaan…":"💾 → notitie"),

        // Clear
        messages.length > 0 && React.createElement("button", {
          onClick:clearChat,
          style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                 borderRadius:"4px",padding:"3px 8px",fontSize:"10px",cursor:"pointer"}
        }, "✕ wis chat")
      ),

      // Installatie instructies
      showInstall && React.createElement("div", {
        style:{background:"rgba(229,120,109,0.06)",borderBottom:`1px solid rgba(229,120,109,0.2)`,
               padding:"14px 16px",fontSize:"12px",flexShrink:0}
      },
        React.createElement("div",{style:{color:W.orange,fontWeight:"bold",marginBottom:"10px",
          fontSize:"13px"}},"Ollama installatie"),
        React.createElement("div",{style:{color:W.fgDim,marginBottom:"10px",lineHeight:"1.7"}},
          "Ollama draait lokale LLM modellen op je eigen machine. Geen internet vereist, volledig privé."
        ),
        // Stappen
        [
          { label:"1. Installeer Ollama", code:"curl -fsSL https://ollama.com/install.sh | sh" },
          { label:"2. Start de server",   code:"ollama serve" },
          { label:"3. Download een model (kies één):", code:null },
        ].map(({label,code},i) => React.createElement("div",{key:i,style:{marginBottom:"8px"}},
          React.createElement("div",{style:{fontSize:"11px",color:W.fgMuted,marginBottom:"3px"}},label),
          code && React.createElement("code",{style:{display:"block",background:"#1a1a1a",
            color:"#cae682",padding:"6px 10px",borderRadius:"4px",fontFamily:"'Hack',monospace",fontSize:"11px"}},code)
        )),
        // Model opties
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"6px",marginTop:"8px"}},
          SUGGESTED_MODELS.map(m => React.createElement("div",{key:m.id,
            style:{background:"rgba(0,0,0,0.2)",border:`1px solid ${W.splitBg}`,
                   borderRadius:"5px",padding:"7px 10px"}},
            React.createElement("code",{style:{color:"#cae682",fontSize:"11px",fontFamily:"'Hack',monospace"}},
              "ollama pull "+m.id),
            React.createElement("div",{style:{fontSize:"10px",color:W.fgMuted,marginTop:"3px"}},m.label+" — "+m.desc)
          ))
        ),
        React.createElement("button",{
          onClick:checkOllama,
          style:{marginTop:"12px",background:W.blue,color:W.bg,border:"none",
                 borderRadius:"5px",padding:"6px 16px",fontSize:"11px",cursor:"pointer",fontWeight:"bold"}
        },"🔄 Opnieuw verbinden")
      ),

      // ── Chat berichten ──────────────────────────────────────────────────────
      React.createElement("div", {
        style:{flex:1,overflowY:"auto",padding:"16px",
               display:"flex",flexDirection:"column",gap:"12px",
               WebkitOverflowScrolling:"touch"}
      },
        // Welkomstbericht als er geen berichten zijn
        messages.length === 0 && React.createElement("div", {
          style:{display:"flex",flexDirection:"column",alignItems:"center",
                 justifyContent:"center",height:"100%",gap:"16px",
                 color:W.fgMuted,textAlign:"center"}
        },
          React.createElement("div",{style:{fontSize:"48px"}},"🧠"),
          React.createElement("div",{style:{fontSize:"16px",color:W.fgDim,fontWeight:"bold"}},
            "Notebook LLM"),
          React.createElement("div",{style:{fontSize:"13px",maxWidth:"420px",lineHeight:"1.8"}},
            "Stel vragen over je notities en PDF-annotaties. " +
            "Selecteer context in het linkerpaneel om de LLM kennis te geven over je zettelkasten."
          ),
          // Suggesties
          React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:"8px",justifyContent:"center",maxWidth:"520px"}},
            [
              "Geef een overzicht van mijn notities",
              "Welke verbanden zie je tussen de notities?",
              "Maak een samenvatting van de geselecteerde PDF-annotaties",
              "Welke thema's komen het meest voor?",
              "Stel verdiepende vragen over dit onderwerp",
            ].map(s => React.createElement("button",{key:s,
              onClick:()=>{ setInput(s); setTimeout(()=>inputRef.current?.focus(),0); },
              style:{background:"rgba(138,198,242,0.07)",border:"1px solid rgba(138,198,242,0.2)",
                     color:"rgba(168,216,240,0.8)",borderRadius:"16px",padding:"6px 14px",
                     fontSize:"11px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}
            },s))
          )
        ),

        // Berichten
        messages.map((msg, i) => React.createElement("div", {
          key:i,
          style:{
            display:"flex",
            flexDirection:"column",
            alignItems: msg.role==="user" ? "flex-end" : "flex-start",
            gap:"4px",
          }
        },
          // Rol label
          React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,letterSpacing:"1px",
            marginBottom:"2px",paddingLeft: msg.role==="user"?"0":"4px"}},
            msg.role==="user" ? "JIJ" : model.toUpperCase()
          ),
          // Bericht bubble
          React.createElement("div",{style:{
            maxWidth:"85%",
            background: msg.role==="user"
              ? "rgba(138,198,242,0.12)"
              : msg.error ? "rgba(229,120,109,0.1)" : W.bg2,
            border: msg.role==="user"
              ? "1px solid rgba(138,198,242,0.25)"
              : msg.error ? "1px solid rgba(229,120,109,0.3)" : `1px solid ${W.splitBg}`,
            borderRadius: msg.role==="user" ? "12px 12px 3px 12px" : "3px 12px 12px 12px",
            padding:"10px 14px",
            fontSize:"13px",
            lineHeight:"1.7",
            color: msg.error ? W.orange : W.fg,
          }},
            msg.error
              ? React.createElement("div",null,
                  React.createElement("div",{style:{fontWeight:"bold",marginBottom:"5px"}},"⚠ Fout"),
                  React.createElement("div",{style:{fontSize:"12px"}},msg.error),
                  React.createElement("button",{onClick:checkOllama,
                    style:{marginTop:"8px",background:"none",border:`1px solid ${W.orange}`,
                           color:W.orange,borderRadius:"4px",padding:"3px 8px",
                           fontSize:"10px",cursor:"pointer"}},"Ollama status controleren")
                )
              : msg.role==="user"
                ? React.createElement("div",null,msg.content)
                : React.createElement("div",{
                    dangerouslySetInnerHTML:{__html:renderMsg(msg.content)+(msg.streaming?"<span style='color:#8ac6f2;animation:blink 1s infinite'>▊</span>":"")}
                  })
          )
        )),
        React.createElement("div",{ref:chatEndRef})
      ),

      // ── Invoerbalk ─────────────────────────────────────────────────────────
      React.createElement("div", {
        style:{borderTop:`1px solid ${W.splitBg}`,padding:"12px",
               background:W.bg,flexShrink:0}
      },
        React.createElement("div",{style:{display:"flex",gap:"8px",alignItems:"flex-end"}},
          React.createElement("textarea",{
            ref:inputRef,
            value:input,
            onChange:e=>setInput(e.target.value),
            onKeyDown:handleKeyDown,
            placeholder: ollamaStatus==="ok"
              ? "Stel een vraag… (Enter=verstuur · Shift+Enter=nieuwe regel)"
              : "Start Ollama om vragen te stellen…",
            disabled: streaming || ollamaStatus==="laden",
            rows:1,
            style:{
              flex:1,background:W.bg2,border:`1px solid ${W.splitBg}`,
              borderRadius:"8px",padding:"10px 14px",color:W.fg,
              fontSize:"13px",outline:"none",resize:"none",
              lineHeight:"1.5",maxHeight:"120px",overflowY:"auto",
              WebkitAppearance:"none",
              opacity: (streaming||ollamaStatus==="laden") ? 0.6 : 1,
            },
            onInput:(e)=>{
              // Auto-resize
              e.target.style.height="auto";
              e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";
            }
          }),
          React.createElement("button",{
            onClick: streaming ? ()=>{} : send,
            disabled: !input.trim() || ollamaStatus!=="ok",
            style:{
              background: streaming ? W.fgMuted : W.blue,
              color:W.bg,border:"none",borderRadius:"8px",
              padding:"10px 16px",fontSize:"13px",cursor: streaming?"not-allowed":"pointer",
              fontWeight:"bold",flexShrink:0,alignSelf:"flex-end",
              height:"40px",minWidth:"64px",
              opacity: (!input.trim()||ollamaStatus!=="ok") ? 0.5 : 1,
            }
          }, streaming ? "⏳" : "↑ Send")
        ),
        // Token hint
        (ctxNotes.length > 0 || ctxPdfs.length > 0) && React.createElement("div",{
          style:{marginTop:"6px",fontSize:"9px",color:W.fgMuted}
        },
          `Context: ${ctxNotes.length} notitie(s) + ${ctxPdfs.length} PDF(s) meegestuurd als systeem-prompt`
        )
      )
    )
  );
};


// Streaming cursor animatie
if(!document.getElementById("llm-css")){
  const s=document.createElement("style");
  s.id="llm-css";
  s.textContent="@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}";
  document.head.appendChild(s);
}

const App = () => {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  const [notes,        setNotes]       = useState([]);
  const [selId,        setSelId]       = useState(null);
  const [vimMode,      setVimMode]     = useState(false);
  const [editTitle,    setEditTitle]   = useState("");
  const [editContent,  setEditContent] = useState("");
  const [editTags,     setEditTags]    = useState([]);
  const [tab,          setTab]         = useState("notes");
  const [splitMode,    setSplitMode]   = useState(false);   // split screen aan/uit
  const [splitTab,     setSplitTab]    = useState("pdf");   // tab in rechter helft
  const [search,       setSearch]      = useState("");
  const [typeFilter,   setTypeFilter]  = useState("all");   // all|notes|pdf|images
  const [pdfNotes,     setPdfNotes]    = useState([]);
  const [imgNotes,     setImgNotes]    = useState([]);
  const [serverPdfs,   setServerPdfs]  = useState([]);
  const [serverImages, setServerImages]= useState([]);
  const [llmModel,     setLlmModel]    = useState("llama3.2-vision");
  const [aiMindmap,    setAiMindmap]   = useState(null);
  const [tagFilter,    setTagFilter]   = useState(null);
  const [showSettings, setShowSettings]= useState(false);
  const [vaultPath,    setVaultPath]   = useState("…");
  const [goyoMode,     setGoyoMode]    = useState(false);
  const [showMetaPanel,setShowMetaPanel]= useState(false); // meta-paneel rechts, standaard ingeklapt
  const [loaded,       setLoaded]      = useState(false);
  const [error,        setError]       = useState(null);
  const [sidebarOpen,  setSidebarOpen] = useState(false);
  const [renderMode,    setRenderMode]  = useState("plain");
  const [aiStatus,      setAiStatus]    = useState(null);
  const [showLinkMenu,  setShowLinkMenu] = useState(false);  // gecombineerde link-dropdown
  const [linkSearch,    setLinkSearch]   = useState("");     // zoekterm in link-dropdown
  const [linkTypeFilter,setLinkTypeFilter]= useState("all"); // all|notes|pdf|images

  // Sluit link-dropdown bij klik buiten
  React.useEffect(()=>{
    if(!showLinkMenu) return;
    const h=()=>{ setShowLinkMenu(false); setLinkSearch(""); };
    setTimeout(()=>document.addEventListener("click",h),0);
    return ()=>document.removeEventListener("click",h);
  },[showLinkMenu]);

  const {w: winW} = useWindowSize();
  const isMobile  = winW < 768;
  const isTablet  = winW >= 768 && winW < 1200;
  const isDesktop = winW >= 1200;

  // Op desktop sidebar altijd open; tablet/mobile via toggle
  const showSidebar  = isDesktop || sidebarOpen;
  const sidebarW     = isMobile ? Math.min(winW - 40, 320) : 240;
  const showMeta     = isDesktop && !goyoMode && showMetaPanel;

  // ── CSS animaties voor AI indicator ──────────────────────────────────────
  React.useEffect(()=>{
    if(document.getElementById("zk-ai-css")) return;
    const s=document.createElement("style");
    s.id="zk-ai-css";
    s.textContent=`
      @keyframes ai-pulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
      @keyframes ai-dot    { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.6);opacity:0.7} }
    `;
    document.head.appendChild(s);
  },[]);

  // ── Data laden ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [ns,as,ias,ps,imgs,cfg] = await Promise.all([
          api.get("/notes"), api.get("/annotations"), api.get("/img-annotations"),
          api.get("/pdfs"),  api.get("/images"), api.get("/config"),
        ]);
        setNotes(ns); setPdfNotes(as); setImgNotes(ias||[]); setServerPdfs(ps); setServerImages(imgs||[]);
        setVaultPath(cfg.vault_path || "…");
        if (ns.length > 0) setSelId(ns[0].id);
        setLoaded(true);
      } catch(e) {
        setError("Kan server niet bereiken.\nStart de server met: python3 server.py");
      }
    };
    load();
  }, []);

  const refreshPdfs   = async () => { setServerPdfs(await api.get("/pdfs")); };
  const refreshImages = async () => { setServerImages(await api.get("/images")||[]); };

  // ── Note helpers ──────────────────────────────────────────────────────────
  const selNote    = notes.find(n => n.id === selId);
  const allTags    = useMemo(() => [...new Set([
    ...notes.flatMap(n => n.tags||[]),
    ...pdfNotes.flatMap(p => p.tags||[])
  ])], [notes, pdfNotes]);
  const sidebarTags = useMemo(() =>
    [...new Set(notes.flatMap(n => n.tags||[]))],
  [notes]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return notes.filter(n =>
      (!q || n.title?.toLowerCase().includes(q)
          || n.content?.toLowerCase().includes(q)
          || (n.tags||[]).some(t => t.includes(q)))
      && (!tagFilter || (n.tags||[]).includes(tagFilter))
    );
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
    // Regel 1: datum  |  Regel 2: leeg  |  Regel 3: cursor begint hier
    const content = `*${todayHeader()}*\n\n`;
    const n = {id, title:"", content, tags:[],
               created: new Date().toISOString(), modified: new Date().toISOString()};
    const saved = await api.post("/notes", n);
    setNotes(p => [saved,...p]); setSelId(id);
    setEditTitle(""); setEditContent(content); setEditTags([]);
    setVimMode(true);
    setSidebarOpen(false);
    // Focus titelinput — Enter springt naar regel 3 van de editor
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

  const [mermaidEditNote, setMermaidEditNote] = React.useState(null); // {noteId, code}

  const handleLink = e => {
    // Mermaid mindmap blok klik → open editor
    const mm = e.target.closest(".mermaid-mindmap-block");
    if (mm) {
      const code = mm.dataset.mermaid?.replace(/&#10;/g,"\n").replace(/&quot;/g,'"') || "";
      setMermaidEditNote({ noteId: selId, code });
      return;
    }
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
      style:{padding:"8px 10px 6px",background:W.statusBg,
             borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}
    },
      !isDesktop && React.createElement("div", {
        style:{display:"flex",justifyContent:"space-between",
               alignItems:"center",marginBottom:"6px"}
      },
        React.createElement("span", {style:{fontSize:"11px",fontWeight:"bold",
          letterSpacing:"2px",color:W.statusFg}}, "NOTITIES"),
        React.createElement("button", {
          onClick:()=>setSidebarOpen(false),
          style:{background:"none",border:"none",color:W.fgMuted,
                 fontSize:"18px",cursor:"pointer",padding:"0 4px",lineHeight:1}
        }, "×")
      ),
      // Nieuw zettel — volle breedte, boven zoekbalk
      React.createElement("button", {
        onClick:newNote,
        style:{background:W.blue,color:W.bg,border:"none",
               borderRadius:"6px",padding:"8px 12px",fontSize:"12px",
               cursor:"pointer",fontWeight:"bold",letterSpacing:"0.5px",
               width:"100%",marginBottom:"7px",
               display:"flex",alignItems:"center",justifyContent:"center",gap:"6px"}
      },
        React.createElement("span",{style:{fontSize:"16px",lineHeight:1}},"＋"),
        "nieuw zettel"
      ),
      // Zoekbalk
      React.createElement("input", {
        value:search, onChange:e=>setSearch(e.target.value),
        placeholder:"🔍 zoeken…",
        style:{width:"100%",background:W.bg,
               border:`1px solid ${search?W.blue:W.splitBg}`,
               borderRadius:"6px",padding:"6px 9px",color:W.fg,
               fontSize:"12px",outline:"none",
               WebkitAppearance:"none",transition:"border-color 0.15s",
               boxSizing:"border-box"}
      })
    ),
    sidebarTags.length > 0 && React.createElement("div", {
      style:{padding:"5px 8px",borderBottom:`1px solid ${W.splitBg}`,
             background:"rgba(0,0,0,0.1)",flexShrink:0}
    },
      React.createElement(TagFilterBar,{tags:sidebarTags,activeTag:tagFilter,onChange:setTagFilter,compact:true,maxVisible:10})
    ),
    // Actieve filter badge
    (tagFilter||search) && React.createElement("div",{style:{
      padding:"3px 8px",borderBottom:`1px solid ${W.splitBg}`,
      background:"rgba(159,202,86,0.04)",flexShrink:0,
      display:"flex",gap:"5px",alignItems:"center",flexWrap:"wrap"
    }},
      React.createElement("span",{style:{fontSize:"9px",color:W.fgMuted}},
        filtered.length+" resultaten"),
      tagFilter && React.createElement("button",{
        onClick:()=>setTagFilter(null),
        style:{fontSize:"9px",background:"rgba(159,202,86,0.15)",color:W.comment,
               border:"1px solid rgba(159,202,86,0.3)",borderRadius:"3px",
               padding:"1px 6px",cursor:"pointer"}
      },"#",tagFilter," ×"),
      React.createElement("button",{
        onClick:()=>{ setSearch(""); setTagFilter(null); },
        style:{fontSize:"9px",background:"none",color:W.fgMuted,
               border:"none",cursor:"pointer",marginLeft:"auto",padding:"1px 4px"}
      },"× wis")
    ),
    // Notities-lijst
    React.createElement("div", {style:{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch"}},
      filtered.length===0
        ? React.createElement("div",{style:{padding:"24px 12px",color:W.fgMuted,
            fontSize:"11px",textAlign:"center",lineHeight:"1.8"}},
            search||tagFilter ? "Geen resultaten" : "Nog geen notities")
        : filtered.map(n => {
            const sel = n.id === selId;
            return React.createElement("div", {
              key:n.id,
              onClick:()=>selectNote(n.id),
              style:{padding:"9px 12px",borderBottom:`1px solid ${W.splitBg}`,
                     cursor:"pointer",background:sel?W.visualBg:"transparent",
                     borderLeft:`3px solid ${sel?W.yellow:"transparent"}`,
                     minHeight:"46px"}
            },
              React.createElement("div", {
                style:{fontSize:"12px",color:sel?W.statusFg:W.fg,
                       lineHeight:"1.35",marginBottom:"3px",fontWeight:sel?"bold":"normal",
                       overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}
              }, n.title || "–"),
              n.tags?.length > 0 && React.createElement("div", {
                style:{display:"flex",flexWrap:"wrap",gap:"3px",marginTop:"2px"}
              }, (n.tags||[]).slice(0,3).map(t =>
                React.createElement(TagPill, {key:t,tag:t,small:true})
              ))
            );
          })
    )
  );

  // ── Tab bar (gedeeld tussen top en bottom nav) ────────────────────────────
  const tabs = [
    {id:"notes",   icon:"📝", label:"Notities"},
    {id:"graph",   icon:"🕸",  label:"Graaf"},
    {id:"pdf",     icon:"📄", label:"PDF"},
    {id:"images",  icon:"🖼",  label:"Plaatjes"},
    {id:"import",  icon:"🌐", label:"Import"},
    {id:"mindmap", icon:"🗺",  label:"Mindmap"},
    {id:"llm",     icon:"🧠", label:"Notebook"},
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
    // Tabs met icoon + label
    tabs.map(({id, icon, label}) => React.createElement("button", {
      key:id, onClick:()=>setTab(id),
      style:{
        background: tab===id ? "rgba(255,255,255,0.07)" : "transparent",
        color: tab===id ? W.statusFg : W.fgMuted,
        border: "none",
        borderBottom: tab===id ? `2px solid ${W.yellow}` : "2px solid transparent",
        borderRight: `1px solid ${W.splitBg}`,
        padding: "0 16px",
        height: "100%",
        fontSize: "11px",
        cursor: "pointer",
        letterSpacing: "0.5px",
        display: "flex", alignItems: "center", gap: "5px",
        flexShrink: 0,
        transition: "color 0.12s, background 0.12s",
      }
    },
      React.createElement("span", {style:{fontSize:"14px", lineHeight:1}}, icon),
      React.createElement("span", null, label)
    )),
    React.createElement("div", {style:{flex:1}}),
    // Stats
    React.createElement("div", {
      style:{padding:"0 6px", display:"flex", gap:"4px", alignItems:"center"}
    },
      // AI-status indicator
      aiStatus && React.createElement("div", {
        style:{display:"flex",alignItems:"center",gap:"5px",
               background:"rgba(138,198,242,0.1)",
               border:"1px solid rgba(138,198,242,0.3)",
               borderRadius:"20px",padding:"3px 11px",
               color:"#a8d8f0",fontSize:"10px",
               animation:"ai-pulse 1.4s ease-in-out infinite",
               marginRight:"4px"}
      },
        React.createElement("span",{style:{
          display:"inline-block",width:"6px",height:"6px",
          borderRadius:"50%",background:"#a8d8f0",flexShrink:0,
          animation:"ai-dot 1.4s ease-in-out infinite"}}),
        aiStatus
      ),
      // Zettels badge
      React.createElement("div",{style:{
        display:"flex", alignItems:"baseline", gap:"3px",
        background:"rgba(229,192,123,0.13)",
        border:"1px solid rgba(229,192,123,0.32)",
        borderRadius:"6px", padding:"4px 10px",
      }},
        React.createElement("span",{style:{
          fontSize:"14px", fontWeight:"700",
          color:W.yellow, letterSpacing:"-0.5px", lineHeight:1
        }}, notes.length),
        React.createElement("span",{style:{
          fontSize:"9px", color:"rgba(229,192,123,0.7)",
          letterSpacing:"0.8px", textTransform:"uppercase"
        }}, "zettels")
      ),
      // Tags badge
      React.createElement("div",{style:{
        display:"flex", alignItems:"baseline", gap:"3px",
        background:"rgba(159,202,86,0.13)",
        border:"1px solid rgba(159,202,86,0.32)",
        borderRadius:"6px", padding:"4px 10px",
      }},
        React.createElement("span",{style:{
          fontSize:"14px", fontWeight:"700",
          color:W.comment, letterSpacing:"-0.5px", lineHeight:1
        }}, allTags.length),
        React.createElement("span",{style:{
          fontSize:"9px", color:"rgba(159,202,86,0.7)",
          letterSpacing:"0.8px", textTransform:"uppercase"
        }}, "tags")
      ),
      // Scheidingslijn
      React.createElement("div",{style:{
        width:"1px", height:"20px",
        background:W.splitBg, margin:"0 4px"
      }}),
      // Vault pad
      React.createElement("div",{
        onClick:()=>setShowSettings(true),
        title:vaultPath,
        style:{
          display:"flex", alignItems:"center", gap:"5px",
          background:"rgba(138,198,242,0.07)",
          border:"1px solid rgba(138,198,242,0.18)",
          borderRadius:"6px", padding:"4px 10px",
          cursor:"pointer", maxWidth:"170px",
          transition:"background 0.12s, border 0.12s",
        }
      },
        React.createElement("span",{style:{fontSize:"12px",lineHeight:1,flexShrink:0}},"📁"),
        React.createElement("span",{style:{
          fontSize:"10px", color:"rgba(138,198,242,0.75)",
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
          letterSpacing:"0.2px", fontWeight:"500"
        }}, vaultPath.split("/").slice(-2).join("/"))
      )
    ),
    // Split-scherm knop
    React.createElement("button", {
      onClick:()=>setSplitMode(p=>!p),
      title: splitMode ? "Split-scherm sluiten" : "Split-scherm openen",
      style:{
        background: splitMode
          ? "linear-gradient(135deg,rgba(138,198,242,0.25),rgba(138,198,242,0.12))"
          : "rgba(255,255,255,0.04)",
        border: `1px solid ${splitMode ? "rgba(138,198,242,0.55)" : W.splitBg}`,
        borderRadius: "6px",
        padding: "5px 13px",
        color: splitMode ? W.blue : W.fgMuted,
        fontSize: "11px", cursor: "pointer",
        margin: "0 4px 0 8px",
        display: "flex", alignItems: "center", gap: "5px",
        letterSpacing: "0.4px",
        boxShadow: splitMode ? "0 0 8px rgba(138,198,242,0.2)" : "none",
        transition: "all 0.15s",
      }
    },
      React.createElement("span",{style:{fontSize:"13px"}}, splitMode ? "⊟" : "⊞"),
      "split"
    ),
    // Instellingen knop
    React.createElement("button", {
      onClick:()=>setShowSettings(true),
      style:{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${W.splitBg}`,
        borderRadius: "6px",
        padding: "5px 13px",
        color: W.fgMuted,
        fontSize: "11px", cursor: "pointer",
        margin: "0 10px 0 0",
        display: "flex", alignItems: "center", gap: "5px",
        letterSpacing: "0.4px",
        transition: "all 0.15s",
      }
    },
      React.createElement("span",{style:{fontSize:"13px"}},"⚙"),
      "instellingen"
    )
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
    aiStatus && React.createElement("div",{
      style:{fontSize:"10px",color:"#a8d8f0",
             background:"rgba(138,198,242,0.1)",
             border:"1px solid rgba(138,198,242,0.2)",
             borderRadius:"10px",padding:"2px 8px",
             animation:"ai-pulse 1.4s ease-in-out infinite"}
    },"⏳ ",aiStatus),
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
        if(e.key==="Enter"){
          e.preventDefault();
          // Zet cursor direct op regel 3 (index 2), kolom 0 — na datum + lege regel
          setTimeout(()=>{ contentRef.current?.setCursor(2, 0); }, 40);
        }
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
    }, b.label)),
    // ── 🔗 Gecombineerde link/koppelen dropdown ───────────────────────────────
    React.createElement("div",{style:{position:"relative",flexShrink:0},
      onClick:e=>e.stopPropagation()},
      React.createElement("button",{
        onClick:()=>{ setShowLinkMenu(v=>!v); setLinkSearch(""); setLinkTypeFilter("all"); },
        title:"Link invoegen: notitie, PDF of afbeelding",
        style:{background:showLinkMenu?"rgba(138,198,242,0.15)":"none",
               border:`1px solid ${showLinkMenu?"rgba(138,198,242,0.4)":W.splitBg}`,
               borderRadius:"6px",padding:isMobile?"7px 12px":"4px 10px",
               color:showLinkMenu?W.blue:W.fgMuted,
               fontSize:isMobile?"13px":"11px",cursor:"pointer",flexShrink:0}
      },"🔗 koppelen"),
      showLinkMenu && React.createElement("div",{
        style:{position:"absolute",top:"calc(100% + 4px)",right:0,zIndex:210,
               background:W.bg2,border:`1px solid ${W.splitBg}`,borderRadius:"8px",
               width:"300px",maxHeight:"420px",display:"flex",flexDirection:"column",
               boxShadow:"0 8px 32px rgba(0,0,0,0.75)"}
      },
        // Type-filter tabs
        React.createElement("div",{style:{display:"flex",borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}},
          [["all","Alles"],["notes","📝 Notities"],["pdf","📄 PDF"],["images","🖼 Plaatjes"]].map(([id,lbl])=>
            React.createElement("button",{key:id,
              onClick:()=>setLinkTypeFilter(id),
              style:{flex:1,background:linkTypeFilter===id?"rgba(138,198,242,0.12)":"none",
                     border:"none",borderBottom:linkTypeFilter===id?`2px solid ${W.blue}`:"2px solid transparent",
                     color:linkTypeFilter===id?W.blue:W.fgMuted,
                     fontSize:"9px",padding:"7px 2px",cursor:"pointer",letterSpacing:"0.3px"}
            },lbl)
          )
        ),
        // Zoekbalk
        React.createElement("div",{style:{padding:"7px 10px",borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}},
          React.createElement("input",{
            autoFocus:true,
            value:linkSearch,
            onChange:e=>setLinkSearch(e.target.value),
            placeholder:"Zoeken…",
            style:{width:"100%",background:"rgba(255,255,255,0.06)",
                   border:`1px solid ${W.splitBg}`,borderRadius:"5px",
                   padding:"5px 9px",color:W.fg,fontSize:"12px",outline:"none",fontFamily:"inherit"}
          })
        ),
        // Resultatenlijst
        React.createElement("div",{style:{overflowY:"auto",flex:1}},
          // Notities
          (linkTypeFilter==="all"||linkTypeFilter==="notes") && (() => {
            const ns = notes.filter(n=>n.id!==selId&&(
              !linkSearch||n.title?.toLowerCase().includes(linkSearch.toLowerCase())||
              (n.tags||[]).some(t=>t.includes(linkSearch.toLowerCase()))
            )).slice(0,20);
            if(!ns.length) return null;
            return React.createElement(React.Fragment,null,
              linkTypeFilter==="all"&&React.createElement("div",{style:{
                padding:"5px 12px 3px",fontSize:"9px",color:W.fgMuted,
                letterSpacing:"2px",background:"rgba(0,0,0,0.2)",flexShrink:0
              }},"NOTITIES"),
              ns.map(n=>React.createElement("div",{key:n.id,
                onMouseDown:(e)=>{
                  e.preventDefault(); // voorkom blur van editor → cursor blijft behouden
                  const link="[["+n.title+"]]";
                  contentRef.current?.insertAtCursor?contentRef.current.insertAtCursor(link):setEditContent(c=>c+link);
                  setShowLinkMenu(false);
                },
                style:{padding:"7px 12px",cursor:"pointer",
                       borderBottom:`1px solid rgba(255,255,255,0.03)`,
                       display:"flex",flexDirection:"column",gap:"1px"}
              },
                React.createElement("span",{style:{fontSize:"12px",color:W.fg,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},n.title),
                (n.tags||[]).length>0&&React.createElement("span",{
                  style:{fontSize:"9px",color:W.comment}},(n.tags||[]).map(t=>"#"+t).join("  "))
              ))
            );
          })(),
          // PDFs
          (linkTypeFilter==="all"||linkTypeFilter==="pdf") && (() => {
            const ps = (serverPdfs||[]).filter(p=>
              !linkSearch||p.name.toLowerCase().includes(linkSearch.toLowerCase())
            ).slice(0,15);
            if(!ps.length) return null;
            return React.createElement(React.Fragment,null,
              linkTypeFilter==="all"&&React.createElement("div",{style:{
                padding:"5px 12px 3px",fontSize:"9px",color:W.orange,
                letterSpacing:"2px",background:"rgba(0,0,0,0.2)"
              }},"PDF"),
              ps.map(p=>React.createElement("div",{key:p.name,
                onMouseDown:(e)=>{
                  e.preventDefault();
                  const link="\n\n> 📄 **PDF:** [[pdf:"+p.name+"]]\n";
                  contentRef.current?.insertAtCursor?contentRef.current.insertAtCursor(link):setEditContent(c=>c+link);
                  setShowLinkMenu(false);
                },
                style:{padding:"7px 12px",cursor:"pointer",
                       borderBottom:`1px solid rgba(255,255,255,0.03)`,
                       display:"flex",alignItems:"center",gap:"8px"}
              },
                React.createElement("span",{style:{fontSize:"13px"}},"📄"),
                React.createElement("span",{style:{fontSize:"12px",color:W.fgDim,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}},p.name)
              ))
            );
          })(),
          // Afbeeldingen
          (linkTypeFilter==="all"||linkTypeFilter==="images") && (() => {
            const imgs = (serverImages||[]).filter(i=>
              !linkSearch||i.name.toLowerCase().includes(linkSearch.toLowerCase())
            ).slice(0,15);
            if(!imgs.length) return null;
            return React.createElement(React.Fragment,null,
              linkTypeFilter==="all"&&React.createElement("div",{style:{
                padding:"5px 12px 3px",fontSize:"9px",color:W.blue,
                letterSpacing:"2px",background:"rgba(0,0,0,0.2)"
              }},"AFBEELDINGEN"),
              imgs.map(img=>React.createElement("div",{key:img.name,
                onMouseDown:(e)=>{
                  e.preventDefault();
                  const link="\n\n![[img:"+img.name+"]]\n";
                  contentRef.current?.insertAtCursor?contentRef.current.insertAtCursor(link):setEditContent(c=>c+link);
                  setShowLinkMenu(false);
                },
                style:{padding:"7px 12px",cursor:"pointer",
                       borderBottom:`1px solid rgba(255,255,255,0.03)`,
                       display:"flex",alignItems:"center",gap:"8px"}
              },
                React.createElement("span",{style:{fontSize:"13px"}},"🖼"),
                React.createElement("span",{style:{fontSize:"12px",color:W.fgDim,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}},img.name)
              ))
            );
          })(),
          // Lege staat
          [notes.filter(n=>n.id!==selId&&(!linkSearch||n.title?.toLowerCase().includes(linkSearch.toLowerCase()))).length,
           (serverPdfs||[]).filter(p=>!linkSearch||p.name.toLowerCase().includes(linkSearch.toLowerCase())).length,
           (serverImages||[]).filter(i=>!linkSearch||i.name.toLowerCase().includes(linkSearch.toLowerCase())).length
          ].every(c=>c===0) && React.createElement("div",{style:{padding:"20px",color:W.fgMuted,
            fontSize:"11px",textAlign:"center"}},"Geen resultaten")
        )
      )
    )
  );
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
      onClick:()=>setRenderMode(v=>v==="rich"?"plain":"rich"),
      title:"Wisselen tussen plain en rijke markdown weergave",
      style:{background:renderMode==="rich"?"rgba(138,198,242,0.12)":"none",
             color:renderMode==="rich"?W.blue:W.fgMuted,
             border:`1px solid ${renderMode==="rich"?"rgba(138,198,242,0.35)":W.splitBg}`,
             borderRadius:"6px",
             padding: isMobile ? "8px 14px" : "5px 10px",
             fontSize: isMobile ? "13px" : "11px",
             cursor:"pointer", WebkitTapHighlightColor:"transparent"}
    }, renderMode==="rich" ? "📄 plain" : "🎨 render"),
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
  const metaPanel = isDesktop && !goyoMode && React.createElement(React.Fragment, null,
    // Smalle toggle-strip aan de rechterkant — altijd zichtbaar
    React.createElement("button", {
      onClick:()=>setShowMetaPanel(p=>!p),
      title: showMetaPanel ? "Info verbergen" : "Info tonen",
      style:{
        width:"18px", flexShrink:0, background:W.bg2,
        borderLeft:`1px solid ${W.splitBg}`,
        border:"none", cursor:"pointer", color:W.fgMuted,
        fontSize:"10px", padding:0, display:"flex",
        alignItems:"center", justifyContent:"center",
        writingMode:"vertical-rl",
        letterSpacing:"1px",
      }
    }, showMetaPanel ? "▶" : "◀"),

    // Paneel inhoud — alleen als open
    showMetaPanel && React.createElement("div", {
      className:"meta-panel",
      style:{width:"178px",flexShrink:0,background:W.bg2,
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
    )
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
                  className: renderMode==="rich" ? "mdv mdv-rich" : "mdv",
                  style:{
                    fontSize:   renderMode==="rich" ? (isMobile?"17px":"15px") : (isMobile?"15px":"13px"),
                    lineHeight: renderMode==="rich" ? "2.0" : (isMobile?"1.9":"1.85"),
                    maxWidth:   renderMode==="rich" ? "720px" : "none",
                    margin:     renderMode==="rich" ? "0 auto" : "0",
                    fontFamily: renderMode==="rich"
                      ? "'Georgia','Times New Roman',serif"
                      : "inherit",
                  },
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

    // Mermaid editor overlay (vanuit note preview klik)
    mermaidEditNote && React.createElement("div",{style:{
      position:"fixed",inset:0,zIndex:500,
      background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"stretch",
    }},
      React.createElement("div",{style:{
        flex:1,margin:"24px",borderRadius:"10px",overflow:"hidden",
        border:`1px solid ${W.splitBg}`,boxShadow:"0 20px 60px rgba(0,0,0,0.7)",
        display:"flex",flexDirection:"column"
      }},
        React.createElement(MermaidEditor,{
          initialText: mermaidEditNote.code,
          onSave: async ({title, content, tags}) => {
            // Update de bestaande notitie
            const noteId = mermaidEditNote.noteId;
            const note = notes.find(n => n.id === noteId);
            if (note) {
              const updated = {...note, content, title: title||note.title,
                               modified: new Date().toISOString()};
              const saved = await api.put("/notes/"+noteId, updated);
              setNotes(p => p.map(n => n.id===noteId ? saved : n));
            }
            setMermaidEditNote(null);
          },
          onCancel: () => setMermaidEditNote(null)
        })
      )
    ),

    // Content
    React.createElement("div", {style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}},
      (() => {
        // Render een tab naar een React element
        const renderTab = (t) => {
          if(t==="graph") return React.createElement("div",{style:{flex:1,overflow:"hidden"}},
            React.createElement(Graph,{notes,pdfNotes,
              onSelect:id=>{setSelId(id);setTab("notes");},selectedId:selId}));
          if(t==="pdf") return React.createElement("div",{style:{flex:1,overflow:"hidden"}},
            React.createElement(PDFViewer,{pdfNotes,setPdfNotes,allTags,serverPdfs,
              onRefreshPdfs:refreshPdfs,
              onDeletePdf:async(fname)=>{
                const stem=fname.replace(/\.pdf$/i,"");
                const linked=notes.filter(n=>n.tags?.includes("samenvatting")&&(n.title?.includes(stem)||n.content?.includes(fname)));
                for(const n of linked){ await api.del("/notes/"+n.id); }
                if(linked.length) setNotes(p=>p.filter(n=>!linked.find(l=>l.id===n.id)));
                setPdfNotes(p=>p.filter(a=>a.file!==fname));
              },
              onAutoSummarize:async(fname)=>{
                const stem=fname.replace(/\.pdf$/i,"");
                setAiStatus("🧠 Samenvatten: "+stem.slice(0,20)+"…");
                try{
                  const res=await api.llmSummarizePdf(fname,llmModel);
                  if(res?.ok && res.summary){
                    const note={id:genId(),title:"Samenvatting — "+stem,
                      content:"*Automatisch gegenereerd door Notebook LLM*\n\n"+res.summary+"\n\n---\n📄 **Bron:** [[pdf:"+fname+"]]",
                      tags:["samenvatting","pdf"],created:new Date().toISOString(),modified:new Date().toISOString()};
                    const saved=await api.post("/notes",note);
                    setNotes(p=>[saved,...p]);
                  } else if(res&&!res.ok){ throw new Error(res.error||"Samenvatten mislukt"); }
                } finally { setAiStatus(null); }
              }}));
          if(t==="images") return React.createElement("div",{style:{flex:1,overflow:"hidden"}},
            React.createElement(ImagesGallery,{serverImages,onRefresh:refreshImages,llmModel,setAiStatus,notes,imgNotes,setImgNotes,allTags,
              onDeleteNote:id=>setNotes(p=>p.filter(n=>n.id!==id)),
              onAddNote:async(note)=>{ const saved=await api.post("/notes",note); setNotes(p=>[saved,...p]); }}));
          if(t==="import") return React.createElement("div",{style:{flex:1,overflow:"hidden"}},
            React.createElement(WebImporter,{llmModel,allTags,
              onRefreshImages: refreshImages,
              onAddNote:async(note)=>{ const saved=await api.post("/notes",note); setNotes(p=>[saved,...p]); setSelId(saved.id); setTab("notes"); }}));
          if(t==="mindmap") return React.createElement("div",{style:{flex:1,overflow:"hidden"}},
            React.createElement(MindMap,{notes,allTags,aiMindmap,
              onSelectNote:id=>{ setSelId(id); setTab("notes"); },
              onAddNote:async(note)=>{ const saved=await api.post("/notes",note); setNotes(p=>[saved,...p]); setSelId(saved.id); setTab("notes"); }}));
          if(t==="llm") return React.createElement("div",{style:{flex:1,overflow:"hidden"}},
            React.createElement(LLMNotebook,{notes,pdfNotes,serverPdfs,serverImages,allTags,llmModel,setLlmModel,
              onMindmapReady:(mm)=>{ setAiMindmap(mm); setTab("mindmap"); },
              onAddNote:async(note)=>{ const saved=await api.post("/notes",note); setNotes(p=>[saved,...p]); setSelId(saved.id); setTab("notes"); }}));
          return notesContent; // default = notes
        };

        // Split-screen modus: links notities, rechts andere tab
        if(splitMode && isDesktop) {
          const splitTabs = tabs.filter(t=>t.id!=="notes");
          return React.createElement("div",{style:{flex:1,display:"flex",overflow:"hidden"}},
            // Linker helft: altijd notities
            React.createElement("div",{style:{flex:1,display:"flex",overflow:"hidden",
              borderRight:`2px solid ${W.splitBg}`,minWidth:0}},
              notesContent
            ),
            // Rechter helft: selecteerbare tab
            React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}},
              // Tab-kiezer voor rechter paneel
              React.createElement("div",{style:{
                background:W.statusBg,borderBottom:`1px solid ${W.splitBg}`,
                padding:"0",display:"flex",alignItems:"center",flexShrink:0,height:"36px"
              }},
                splitTabs.map(({id,icon,label})=>React.createElement("button",{
                  key:id, onClick:()=>setSplitTab(id),
                  style:{background:splitTab===id?W.bg:"none",
                         border:"none",borderBottom:splitTab===id?`2px solid ${W.yellow}`:"2px solid transparent",
                         color:splitTab===id?W.statusFg:W.fgMuted,
                         padding:"0 14px",height:"100%",fontSize:"11px",
                         cursor:"pointer",letterSpacing:"0.5px",flexShrink:0}
                },icon," ",label))
              ),
              renderTab(splitTab)
            )
          );
        }

        // Normale modus
        if(tab==="notes") return notesContent;
        return renderTab(tab);
      })()
    ),

    bottomNav
  );
};






// ── Mount ──────────────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(React.createElement(App));

