// ── MermaidCanvas + MermaidEditor + MindMap + LLMNotebook + MarkdownWithMermaid + FuzzySearch
// Deps: W, api, genId, VimEditor, renderMd, TagPill, TagEditor, ONLINE_MODELS

const MermaidCanvas = ({ text, width, height, interactive=false }) => {
  const cvRef   = React.useRef(null);
  const stateRef = React.useRef({ pan:{x:0,y:0}, zoom:1, dragging:false,
                                   lastX:0, lastY:0 });

  const render = React.useCallback(() => {
    const cv = cvRef.current;
    if (!cv || !text) return;
    const ctx   = cv.getContext("2d");
    const dpr   = window.devicePixelRatio || 1;
    const W_px  = width;
    const H_px  = height;
    cv.width    = W_px * dpr;
    cv.height   = H_px * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W_px, H_px);
    ctx.fillStyle = W.bg;
    ctx.fillRect(0, 0, W_px, H_px);

    const allNodes = parseMermaidMindmap(text);
    if (!allNodes.length) {
      ctx.fillStyle = W.fgMuted;
      ctx.font = "12px 'Hack','Courier New',monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Typ een mindmap om de preview te zien…", W_px/2, H_px/2);
      return;
    }

    const PALETTE = [W.blue, W.comment, W.orange, W.purple,
                     W.string, W.type, W.keyword, "#e8d44d"];

    // ── Bereken tekstbreedte ─────────────────────────────────────────────────
    const FONT_ROOT = "bold 13px 'Hack','Courier New',monospace";
    const FONT_L1   = "bold 12px 'Hack','Courier New',monospace";
    const FONT_L2   = "11px 'Hack','Courier New',monospace";
    const FONT_L3   = "10px 'Hack','Courier New',monospace";
    const getFont  = (d) => d===0 ? FONT_ROOT : d===1 ? FONT_L1 : d===2 ? FONT_L2 : FONT_L3;
    const NODE_PAD_X = 14, NODE_H = 26;

    const measured = {};
    allNodes.forEach(n => {
      ctx.font = getFont(n.depth);
      const tw = ctx.measureText(n.label).width;
      measured[n.id] = { tw, nw: Math.max(tw + NODE_PAD_X*2, 60), nh: n.depth===0?32:NODE_H };
    });

    // ── Tree layout: Reingold-Tilford stijl ──────────────────────────────────
    // We doen een horizontale boom: root links, kinderen rechts.
    const byParent = {};
    allNodes.forEach(n => { byParent[n.id] = []; });
    allNodes.forEach(n => { if (n.parentId) byParent[n.parentId].push(n); });

    const LEVEL_W  = 180;   // horizontale afstand per diepte-niveau
    const MIN_GAP  = 10;    // minimale verticale ruimte tussen nodes

    // Post-order: bereken benodigde hoogte per node
    const subtreeH = {};
    const calcH = (id) => {
      const ch = byParent[id] || [];
      if (!ch.length) { subtreeH[id] = measured[id]?.nh || NODE_H; return; }
      ch.forEach(c => calcH(c.id));
      const total = ch.reduce((s,c) => s + subtreeH[c.id], 0) + (ch.length-1)*MIN_GAP;
      subtreeH[id] = Math.max(measured[id]?.nh || NODE_H, total);
    };
    const root = allNodes[0];
    calcH(root.id);

    // Pre-order: wijs y-posities toe
    const pos = {};
    const assignPos = (id, x, topY) => {
      const ch = byParent[id] || [];
      const totalH = subtreeH[id];
      const cy = topY + totalH / 2;
      pos[id] = { x, y: cy };

      let curY = topY;
      ch.forEach(c => {
        assignPos(c.id, x + LEVEL_W, curY);
        curY += subtreeH[c.id] + MIN_GAP;
      });
    };
    assignPos(root.id, 0, -subtreeH[root.id]/2);

    // ── Auto-fit: schaal + centreer op canvas ────────────────────────────────
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    allNodes.forEach(n => {
      const p = pos[n.id]; if (!p) return;
      const m = measured[n.id] || {nw:60};
      minX = Math.min(minX, p.x - m.nw/2);
      maxX = Math.max(maxX, p.x + m.nw/2);
      minY = Math.min(minY, p.y - NODE_H/2);
      maxY = Math.max(maxY, p.y + NODE_H/2);
    });
    const treeW = maxX - minX + 40;
    const treeH = maxY - minY + 40;
    const fitZoom = Math.min(1.2, Math.min((W_px-20)/treeW, (H_px-20)/treeH));

    const s = stateRef.current;
    // Bij eerste render of als niet interactief: reset zoom/pan
    if (!interactive || (s.zoom === 1 && s.pan.x === 0 && s.pan.y === 0)) {
      s.zoom = fitZoom;
      s.pan  = {
        x: W_px/2 - (minX + treeW/2) * fitZoom,
        y: H_px/2 - (minY + treeH/2) * fitZoom
      };
    }

    ctx.save();
    ctx.translate(s.pan.x, s.pan.y);
    ctx.scale(s.zoom, s.zoom);

    // ── Kleur per tak (gebaseerd op eerste-niveau kind) ──────────────────────
    const nodeColor = {};
    nodeColor[root.id] = W.blue;
    (byParent[root.id]||[]).forEach((c,i) => {
      const col = PALETTE[i % PALETTE.length];
      const paint = (id, col) => {
        nodeColor[id] = col;
        (byParent[id]||[]).forEach(ch => paint(ch.id, col));
      };
      paint(c.id, col);
    });

    // ── Edges ────────────────────────────────────────────────────────────────
    allNodes.forEach(n => {
      if (!n.parentId) return;
      const f = pos[n.id], t = pos[n.parentId];
      if (!f || !t) return;
      const col = nodeColor[n.id] || W.fgMuted;
      const fm  = measured[n.id]  || {nw:60};
      const tm  = measured[n.parentId] || {nw:60};

      ctx.beginPath();
      const x1 = t.x + tm.nw/2;     // rechterkant parent
      const y1 = t.y;
      const x2 = f.x - fm.nw/2;     // linkerkant kind
      const y2 = f.y;
      const mx = (x1+x2)/2;
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
      ctx.strokeStyle = col + "70";
      ctx.lineWidth   = n.depth <= 1 ? 2.5 : 1.5;
      ctx.stroke();
    });

    // ── Nodes ────────────────────────────────────────────────────────────────
    allNodes.forEach(n => {
      const p   = pos[n.id]; if (!p) return;
      const m   = measured[n.id] || {nw:60, nh:NODE_H};
      const col = nodeColor[n.id] || W.fgMuted;
      const isRoot = n.depth === 0;
      const nx  = p.x - m.nw/2;
      const ny  = p.y - m.nh/2;

      // Schaduw
      ctx.shadowColor   = col + "40";
      ctx.shadowBlur    = isRoot ? 12 : 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      // Achtergrond
      ctx.beginPath();
      if (isRoot) {
        const r = m.nh / 2;
        ctx.roundRect(nx, ny, m.nw, m.nh, r);
      } else {
        ctx.roundRect(nx, ny, m.nw, m.nh, 5);
      }
      ctx.fillStyle   = isRoot ? col + "35" : col + "18";
      ctx.strokeStyle = col + (isRoot ? "ee" : "99");
      ctx.lineWidth   = isRoot ? 2 : 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Tekst
      ctx.font        = getFont(n.depth);
      ctx.fillStyle   = isRoot ? W.statusFg : col;
      ctx.textAlign   = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.label, p.x, p.y);
    });

    ctx.restore();

    // Hint bij interactieve modus
    if (interactive) {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = "9px 'Hack','Courier New',monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("scroll=zoom · sleep=pan", W_px-8, H_px-6);
    }
  }, [text, width, height, interactive]);

  React.useEffect(() => { render(); }, [render]);

  // Pan & zoom handlers (alleen als interactive)
  const onWheel = (e) => {
    if (!interactive) return;
    e.preventDefault();
    const s = stateRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    const rect = cvRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    s.pan.x = mx - (mx - s.pan.x) * factor;
    s.pan.y = my - (my - s.pan.y) * factor;
    s.zoom *= factor;
    render();
  };
  const onMouseDown = (e) => {
    if (!interactive) return;
    const s = stateRef.current;
    s.dragging = true; s.lastX = e.clientX; s.lastY = e.clientY;
  };
  const onMouseMove = (e) => {
    const s = stateRef.current;
    if (!s.dragging) return;
    s.pan.x += e.clientX - s.lastX;
    s.pan.y += e.clientY - s.lastY;
    s.lastX = e.clientX; s.lastY = e.clientY;
    render();
  };
  const onMouseUp = () => { stateRef.current.dragging = false; };

  return React.createElement("canvas", {
    ref: cvRef,
    style: { display:"block", width:"100%", height:"100%",
             cursor: interactive ? "grab" : "default" },
    onWheel, onMouseDown, onMouseMove, onMouseUp,
    onMouseLeave: onMouseUp,
  });
};

// ── Mermaid inline preview blok (in note-viewer) ──────────────────────────────
// Vervangt het klikbare code-blok met een echte canvas render + knoppen.
const MermaidPreviewBlock = ({ code, onEdit }) => {
  const containerRef = React.useRef(null);
  const [size, setSize]       = React.useState({w:600, h:320});
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => {
      const r = e[0].contentRect;
      setSize({ w: r.width||600, h: expanded ? 520 : 320 });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [expanded]);

  return React.createElement("div", {
    style:{ margin:"14px 0", border:`1px solid rgba(159,202,86,0.35)`,
            borderRadius:"8px", overflow:"hidden",
            background:"rgba(0,0,0,0.2)" }
  },
    // Header
    React.createElement("div",{style:{
      display:"flex", alignItems:"center", gap:"8px",
      padding:"6px 12px",
      background:"rgba(159,202,86,0.06)",
      borderBottom:`1px solid rgba(159,202,86,0.2)`
    }},
      React.createElement("span",{style:{fontSize:"14px",color:W.comment,
        fontWeight:"600",letterSpacing:"1px"}},"🌿 MINDMAP"),
      React.createElement("div",{style:{flex:1}}),
      React.createElement("button",{
        onClick:()=>setExpanded(v=>!v),
        style:{background:"none",border:"none",color:W.fgMuted,
               fontSize:"14px",cursor:"pointer",padding:"2px 6px"}
      }, expanded ? "⊟ inklappen" : "⊞ uitvouwen"),
      onEdit && React.createElement("button",{
        onClick: onEdit,
        style:{background:"rgba(138,198,242,0.1)",
               border:"1px solid rgba(138,198,242,0.3)",
               color:W.blue,borderRadius:"4px",fontSize:"14px",
               cursor:"pointer",padding:"2px 8px"}
      }, "✏ bewerken")
    ),
    // Canvas
    React.createElement("div",{
      ref:containerRef,
      style:{ height: expanded ? "520px" : "320px",
              transition:"height 0.2s", position:"relative" }
    },
      React.createElement(MermaidCanvas,{
        text:code, width:size.w, height:size.h, interactive:true
      })
    )
  );
};

// ── MermaidCodeEditor — canvas-based editor, identiek gedrag aan VimEditor ────
// Volledig VIM-modes (INSERT/NORMAL/COMMAND/SEARCH), cursorline+cursorcolumn,
// syntax highlighting per regel via canvas drawLine, statusbalk met mode-badge.
const MermaidCodeEditor = ({ value, onChange, editorRef, noteTags=[], onTagsChange=()=>{}, allTags=[], onModeChange=()=>{} }) => {
  const { useState, useEffect, useRef, useCallback } = React;

  const FONT_SZ = 13;
  const LINE_H2 = 22;
  const PAD_L   = 6;

  // ── PALETTE voor syntax kleuring (zelfde als highlight()-functie hierboven) ─
  const MM_PALETTE = [W.blue, W.comment, W.orange, W.purple,
                      W.string, W.type, W.keyword, "#e8d44d"];

  // ── React state (alleen voor statusbalk re-render) ────────────────────────
  const [mode,      setModeState] = useState("INSERT");
  const [cmdBuf,    setCmdBuf]    = useState("");
  const [statusMsg, setStatus]    = useState("");

  // ── Alle editor-staat in één ref ─────────────────────────────────────────
  const S = useRef({
    lines:   value.split("\n"),
    cur:     {row:0, col:0},
    scroll:  0,
    mode:    "INSERT",
    cmdBuf:  "",
    undo:    [value.split("\n")],
    undoIdx: 0,
    yank:    "",
    search:  "",
    matches: [],
    matchIdx:0,
    charW:   7.8,
    visRows: 20,
  });

  const cvRef      = useRef(null);
  const inputRef   = useRef(null);
  const rafRef     = useRef(null);
  const blinkRef   = useRef(null);
  const blinkOn    = useRef(true);
  const undoTimer  = useRef(null);
  const prevValue  = useRef(value);

  const setMode = useCallback((m) => {
    S.current.mode = m;
    setModeState(m);
    blinkOn.current = true;
  }, []);

  // ── Externe value sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      S.current.lines = value.split("\n");
      clamp();
      draw();
    }
  }, [value]);

  // ── editorRef API (focus + insertAtCursor + triggerInsert) ──────────────
  useEffect(() => {
    if (!editorRef) return;
    editorRef.current = {
      focus: () => inputRef.current?.focus(),
      // Zet editor in INSERT mode en geef focus — voor "✏ bewerken" knop
      triggerInsert: () => {
        setMode("INSERT");
        draw();
        inputRef.current?.focus();
      },
      insertAtCursor: (text) => {
        const s = S.current;
        setMode("INSERT");
        text.split("\n").forEach((part, i) => {
          for (const ch of part) insertChar(s, ch);
          if (i < text.split("\n").length - 1) {
            const {row,col} = s.cur;
            const before = s.lines[row].slice(0,col);
            const after  = s.lines[row].slice(col);
            s.lines[row] = before;
            s.lines.splice(row+1, 0, after);
            s.cur.row++; s.cur.col=0;
          }
        });
        emit(s); scrollToCursor(s); draw();
        inputRef.current?.focus();
      },
    };
  });

  // ── Canvas setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const cv  = cvRef.current;
    const inp = inputRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    ctx.font  = `${FONT_SZ}px 'Hack','Courier New',monospace`;
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
      S.current.visRows = Math.floor((ph - LINE_H2) / LINE_H2);
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv.parentElement);

    blinkRef.current = setInterval(() => { blinkOn.current = !blinkOn.current; draw(); }, 530);

    // Auto-focus bij mount zodat toetsenbord direct werkt (ook bij tab-navigatie)
    requestAnimationFrame(() => inp.focus());

    const focusInput = () => inp.focus();

    const onMouseDown = (e) => {
      const r  = cv.getBoundingClientRect();
      const s  = S.current;
      const cw = s.charW;
      const row = Math.min(s.lines.length-1, Math.max(0, Math.floor((e.clientY-r.top)/LINE_H2)+s.scroll));
      const col = Math.min(s.lines[row].length, Math.max(0, Math.round((e.clientX-r.left-PAD_L)/cw)));
      s.cur = {row,col};
      setMode("INSERT");
      scrollToCursor(s);
      inp.focus();
      draw();
    };
    cv.addEventListener("mousedown", onMouseDown);
    // Canvas focus-event → stuur door naar hidden input
    cv.addEventListener("focus", focusInput);

    const onWheel = (e) => {
      e.preventDefault();
      const s = S.current;
      s.scroll = Math.max(0, Math.min(s.lines.length-1, s.scroll + (e.deltaY>0?3:-3)));
      draw();
    };
    cv.addEventListener("wheel", onWheel, {passive:false});

    return () => {
      ro.disconnect();
      clearInterval(blinkRef.current);
      cancelAnimationFrame(rafRef.current);
      cv.removeEventListener("mousedown", onMouseDown);
      cv.removeEventListener("focus", focusInput);
      cv.removeEventListener("wheel", onWheel);
    };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const clamp = () => {
    const s = S.current;
    s.cur.row = Math.max(0, Math.min(s.lines.length-1, s.cur.row));
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
    const cut = s.undo.slice(0, s.undoIdx+1);
    cut.push(s.lines.slice());
    s.undo = cut; s.undoIdx = cut.length-1;
  };
  const scheduleUndo = (s) => {
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(()=>pushUndo(s), 600);
  };
  const insertChar = (s, ch) => {
    const {row,col} = s.cur;
    s.lines[row] = s.lines[row].slice(0,col) + ch + s.lines[row].slice(col);
    s.cur.col += ch.length;
  };

  // ── Zoeken ────────────────────────────────────────────────────────────────
  const buildMatches = (s, term) => {
    s.search=term; s.matches=[]; s.matchIdx=0;
    if (!term) return;
    s.lines.forEach((line,r)=>{
      let i=0;
      while((i=line.indexOf(term,i))>=0){ s.matches.push({row:r,col:i}); i+=term.length; }
    });
  };
  const jumpMatch = (s, dir) => {
    if (!s.matches.length) return;
    s.matchIdx=((s.matchIdx+dir)+s.matches.length)%s.matches.length;
    const m=s.matches[s.matchIdx]; s.cur={row:m.row,col:m.col}; scrollToCursor(s);
  };

  // ── Command handler (incl. :tag) ──────────────────────────────────────────
  const runCmd = useCallback((s, cmd) => {
    cmd = cmd.trim();
    if (/^tag\+/.test(cmd))  { const t=cmd.replace(/^tag\+\s*/,"").replace(/^#/,"").trim(); if(t) onTagsChange([...new Set([...noteTags,t])]); setStatus(`+tag: ${t}`); return; }
    if (/^tag-/.test(cmd))   { const t=cmd.replace(/^tag-\s*/,"").replace(/^#/,"").trim(); onTagsChange(noteTags.filter(x=>x!==t)); setStatus(`-tag: ${t}`); return; }
    if (/^tag\s/.test(cmd))  { const ts=cmd.slice(4).split(/[\s,]+/).map(t=>t.replace(/^#/,"")).filter(Boolean); onTagsChange([...new Set(ts)]); setStatus("tags: "+ts.join(" ")); return; }
    if (cmd==="tags")         { setStatus("tags: "+noteTags.join(" ")); return; }
    if (cmd==="w")            { setStatus("✓ gebruik '💾 opslaan' in toolbar"); return; }
    setStatus(`onbekend: :${cmd}`);
  }, [noteTags, onTagsChange]);

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKey = useCallback((e) => {
    const s = S.current;
    const m = s.mode;

    // ── INSERT ───────────────────────────────────────────────────────────────
    if (m === "INSERT") {
      if (e.key === "Escape") { e.preventDefault(); setMode("NORMAL"); setStatus(""); draw(); return; }
      if (e.ctrlKey && e.key==="s") { e.preventDefault(); setStatus("gebruik '💾 opslaan' in toolbar"); draw(); return; }

      if (e.key==="ArrowLeft")  { e.preventDefault(); s.cur.col=Math.max(0,s.cur.col-1); scrollToCursor(s); draw(); return; }
      if (e.key==="ArrowRight") { e.preventDefault(); s.cur.col=Math.min(s.lines[s.cur.row].length,s.cur.col+1); scrollToCursor(s); draw(); return; }
      if (e.key==="ArrowUp")    { e.preventDefault(); if(s.cur.row>0){s.cur.row--;s.cur.col=Math.min(s.cur.col,s.lines[s.cur.row].length);} scrollToCursor(s); draw(); return; }
      if (e.key==="ArrowDown")  { e.preventDefault(); if(s.cur.row<s.lines.length-1){s.cur.row++;s.cur.col=Math.min(s.cur.col,s.lines[s.cur.row].length);} scrollToCursor(s); draw(); return; }
      if (e.key==="Home")       { e.preventDefault(); s.cur.col=0; draw(); return; }
      if (e.key==="End")        { e.preventDefault(); s.cur.col=s.lines[s.cur.row].length; draw(); return; }

      if (e.key==="Tab") {
        e.preventDefault();
        insertChar(s,"  "); emit(s); scrollToCursor(s); draw(); return;
      }
      if (e.key==="Enter") {
        e.preventDefault();
        const {row,col}=s.cur; const line=s.lines[row];
        // Behoud inspringing (belangrijk voor mermaid-hiërachie)
        const indent=line.match(/^( *)/)[1];
        const after=line.slice(col);
        s.lines[row]=line.slice(0,col);
        s.lines.splice(row+1,0,indent+after);
        s.cur.row++; s.cur.col=indent.length;
        scheduleUndo(s); emit(s); scrollToCursor(s); draw(); return;
      }
      if (e.key==="Backspace") {
        e.preventDefault();
        const {row,col}=s.cur;
        if (col>0){ s.lines[row]=s.lines[row].slice(0,col-1)+s.lines[row].slice(col); s.cur.col--; }
        else if (row>0){ const prev=s.lines[row-1]; s.cur.col=prev.length; s.lines[row-1]=prev+s.lines[row]; s.lines.splice(row,1); s.cur.row--; }
        scheduleUndo(s); emit(s); scrollToCursor(s); draw(); return;
      }
      if (e.key==="Delete") {
        e.preventDefault();
        const {row,col}=s.cur;
        if(col<s.lines[row].length){ s.lines[row]=s.lines[row].slice(0,col)+s.lines[row].slice(col+1); }
        else if(row<s.lines.length-1){ s.lines[row]=s.lines[row]+s.lines[row+1]; s.lines.splice(row+1,1); }
        scheduleUndo(s); emit(s); draw(); return;
      }
      if (e.key.length===1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        insertChar(s,e.key); scheduleUndo(s); emit(s); scrollToCursor(s); draw(); return;
      }
      return;
    }

    // ── COMMAND ──────────────────────────────────────────────────────────────
    if (m==="COMMAND") {
      e.preventDefault();
      if (e.key==="Escape") { setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); setStatus(""); draw(); return; }
      if (e.key==="Enter")  { runCmd(s,s.cmdBuf); setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); draw(); return; }
      if (e.key==="Backspace"){ s.cmdBuf=s.cmdBuf.slice(0,-1); setCmdBuf(s.cmdBuf); draw(); return; }
      if (e.key==="Tab") {
        const tm=s.cmdBuf.match(/^(tag[+-]?\s+)(\S*)$/);
        if(tm){ const p=tm[2].replace(/^#/,""); const hit=allTags.find(t=>t.startsWith(p)&&t!==p); if(hit){s.cmdBuf=tm[1]+hit; setCmdBuf(s.cmdBuf);} }
        draw(); return;
      }
      if (e.key.length===1){ s.cmdBuf+=e.key; setCmdBuf(s.cmdBuf); draw(); return; }
      return;
    }

    // ── SEARCH ───────────────────────────────────────────────────────────────
    if (m==="SEARCH") {
      e.preventDefault();
      if (e.key==="Escape") { setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); buildMatches(s,""); draw(); return; }
      if (e.key==="Enter")  { buildMatches(s,s.cmdBuf); jumpMatch(s,0); setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); draw(); return; }
      if (e.key==="Backspace"){ s.cmdBuf=s.cmdBuf.slice(0,-1); setCmdBuf(s.cmdBuf); draw(); return; }
      if (e.key.length===1)   { s.cmdBuf+=e.key; setCmdBuf(s.cmdBuf); draw(); return; }
      return;
    }

    // ── NORMAL ───────────────────────────────────────────────────────────────
    e.preventDefault();
    const {row,col}=s.cur; const line=s.lines[row];

    switch(e.key) {
      case "i": setMode("INSERT"); break;
      case "I": setMode("INSERT"); s.cur.col=0; break;
      case "a": setMode("INSERT"); s.cur.col=Math.min(col+1,line.length); break;
      case "A": setMode("INSERT"); s.cur.col=line.length; break;
      case "o": s.lines.splice(row+1,0,"  ".repeat(Math.floor((line.match(/^( *)/)[1].length)/2))); s.cur.row++; s.cur.col=s.lines[s.cur.row].length; setMode("INSERT"); break;
      case "O": s.lines.splice(row,0,"  ".repeat(Math.floor((line.match(/^( *)/)[1].length)/2))); s.cur.col=s.lines[row].length; setMode("INSERT"); break;
      case ":": setMode("COMMAND"); s.cmdBuf=""; setCmdBuf(""); break;
      case "/": setMode("SEARCH");  s.cmdBuf=""; setCmdBuf(""); break;
      case "h": case "ArrowLeft":  s.cur.col=Math.max(0,col-1); break;
      case "l": case "ArrowRight": s.cur.col=Math.min(line.length,col+1); break;
      case "j": case "ArrowDown":  if(row<s.lines.length-1){s.cur.row++;s.cur.col=Math.min(col,s.lines[s.cur.row].length);} break;
      case "k": case "ArrowUp":    if(row>0){s.cur.row--;s.cur.col=Math.min(col,s.lines[s.cur.row].length);} break;
      case "w": { const rest=line.slice(col+1); const m2=rest.search(/\b\w/); if(m2>=0)s.cur.col=col+1+m2; else if(row<s.lines.length-1){s.cur.row++;s.cur.col=0;} break; }
      case "b": { const before=line.slice(0,col); const m2=before.search(/\w+$/); if(m2>=0)s.cur.col=m2; else if(row>0){s.cur.row--;s.cur.col=s.lines[s.cur.row].length;} break; }
      case "0": s.cur.col=0; break;
      case "$": s.cur.col=line.length; break;
      case "g": s.cur.row=0; s.cur.col=0; break;
      case "G": s.cur.row=s.lines.length-1; s.cur.col=0; break;
      case "n": jumpMatch(s,1); break;
      case "N": jumpMatch(s,-1); break;
      // Tab in NORMAL: inspringen (mermaid-specifiek)
      case "Tab":
        { const ind=line.match(/^( *)/)[1]; s.lines[row]="  "+line; s.cur.col+=2; scheduleUndo(s); emit(s); break; }
      // Shift+Tab: uitspringen
      case "S":
        if(e.shiftKey){ const ind=line.slice(0,2)==="  "?line.slice(2):line; s.lines[row]=ind; s.cur.col=Math.max(0,col-2); scheduleUndo(s); emit(s); } break;
      case "x": if(col<line.length){s.yank=line[col]; pushUndo(s); s.lines[row]=line.slice(0,col)+line.slice(col+1); emit(s);} break;
      case "d": s.yank=line; pushUndo(s); s.lines.splice(row,1); if(s.lines.length===0)s.lines=[""]; clamp(); emit(s); break;
      case "D": pushUndo(s); s.lines[row]=line.slice(0,col); emit(s); break;
      case "y": s.yank=line; setStatus("gekopieerd"); break;
      case "p": pushUndo(s); s.lines.splice(row+1,0,s.yank); s.cur.row++; s.cur.col=0; emit(s); break;
      case "P": pushUndo(s); s.lines.splice(row,0,s.yank); s.cur.col=0; emit(s); break;
      case "u": if(s.undoIdx>0){s.undoIdx--;s.lines=s.undo[s.undoIdx].slice();clamp();emit(s);setStatus("undo");} break;
      case "r": if(e.ctrlKey&&s.undoIdx<s.undo.length-1){s.undoIdx++;s.lines=s.undo[s.undoIdx].slice();clamp();emit(s);setStatus("redo");} break;
      case " ": setStatus(""); buildMatches(s,""); break;
      case "Escape": setStatus(""); break;
    }
    clamp(); scrollToCursor(s); draw();
  }, [allTags, noteTags, onTagsChange, runCmd]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const s=S.current; if(s.mode!=="INSERT") return;
    const text=e.clipboardData.getData("text");
    text.split("\n").forEach((ln,i)=>{
      if(i===0){ insertChar(s,ln); }
      else {
        const {row,col}=s.cur; const rest=s.lines[row].slice(col);
        s.lines[row]=s.lines[row].slice(0,col); s.lines.splice(row+1,0,ln);
        s.cur.row++; s.cur.col=ln.length;
        if(i===text.split("\n").length-1) s.lines[s.cur.row]+=rest;
      }
    });
    scheduleUndo(s); emit(s); scrollToCursor(s); draw();
  }, []);

  // ── Draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  // Bouw per-regel kleurinformatie (tak-index) voor canvas drawLine
  const buildLineColors = (lines) => {
    let bi=0, bd=null; const lbi=[];
    lines.forEach(line=>{
      const t=line.trimEnd();
      if(!t||t.toLowerCase().startsWith("mindmap")){lbi.push(-2);return;}
      const depth=Math.floor((line.match(/^( *)/)[1].length)/2);
      if(depth===1){lbi.push(-1);bi=0;bd=null;}
      else if(depth===2){if(bd!==null)bi++;bd=2;lbi.push(bi);}
      else{lbi.push(bd!==null?bi:0);}
    });
    return lbi;
  };

  // Teken één regel met syntax kleuring op canvas
  const drawMermaidLine = (ctx, line, x, y, cw, isCur, branchIdx, lineColors) => {
    if (!line) return;
    const depth  = Math.floor((line.match(/^( *)/)[1].length)/2);
    const rest   = line.slice(depth*2);
    const idx    = branchIdx;

    // Indent guides — verticale lijnen (zelfde logica als highlight())
    for (let lvl=0; lvl<depth; lvl++) {
      const isLast = lvl===depth-1;
      const branchCol = idx>=0 ? MM_PALETTE[idx%MM_PALETTE.length] : W.fgMuted;
      const lineCol = isLast ? branchCol+"99" : "rgba(255,255,255,0.08)";
      ctx.fillStyle = lineCol;
      ctx.fillRect(x + lvl*2*cw, y, 1, LINE_H2);
    }

    const drawSpan = (text, color, bold=false, sx) => {
      ctx.fillStyle = color;
      ctx.font = bold ? `bold ${FONT_SZ}px 'Hack','Courier New',monospace`
                      : `${FONT_SZ}px 'Hack','Courier New',monospace`;
      ctx.fillText(text, sx, y+4);
      ctx.font = `${FONT_SZ}px 'Hack','Courier New',monospace`;
    };

    const tx = x + depth*2*cw; // tekst-x na inspring

    if (idx===-2) {
      // mindmap header
      drawSpan(line, W.fgMuted, false, x);
      return;
    }
    if (idx===-1) {
      // root node
      const rootM = rest.match(/^(root)(\(\()(.*)(\)\))(.*)$/);
      if (rootM) {
        let cx = tx;
        drawSpan(rootM[1], W.fgMuted, false, cx); cx+=rootM[1].length*cw;
        drawSpan(rootM[2], "rgba(255,255,255,0.3)", false, cx); cx+=rootM[2].length*cw;
        drawSpan(rootM[3], W.blue, true, cx); cx+=rootM[3].length*cw;
        drawSpan(rootM[4], "rgba(255,255,255,0.3)", false, cx); cx+=rootM[4].length*cw;
        if(rootM[5]) drawSpan(rootM[5], W.fg, false, cx);
      } else {
        drawSpan(rest, W.blue, true, tx);
      }
      return;
    }

    // tak/sub-node
    const col = MM_PALETTE[idx%MM_PALETTE.length];
    const opHex = depth===2?"ff":depth===3?"cc":depth===4?"99":"77";
    const finalCol = col+opHex;

    const bracM = rest.match(/^(\(\()(.*)(\)\))(.*)$/) ||
                  rest.match(/^(\()(.*)(\))(.*)$/)      ||
                  rest.match(/^(\[)(.*)(\])(.*)$/);
    if (bracM) {
      let cx=tx;
      drawSpan(bracM[1], "rgba(255,255,255,0.3)", false, cx); cx+=bracM[1].length*cw;
      drawSpan(bracM[2], finalCol, depth<=2, cx); cx+=bracM[2].length*cw;
      drawSpan(bracM[3], "rgba(255,255,255,0.3)", false, cx); cx+=bracM[3].length*cw;
      if(bracM[4]) drawSpan(bracM[4], W.fgDim, false, cx);
    } else {
      drawSpan(rest, finalCol, depth<=2, tx);
    }
  };

  const drawFrame = useCallback(() => {
    const cv=cvRef.current; if(!cv) return;
    const ctx=cv.getContext("2d");
    const dpr=window.devicePixelRatio||1;
    const CW=cv.width/dpr; const CH=cv.height/dpr;
    const s=S.current;
    const cw=s.charW;
    const {row:curRow,col:curCol}=s.cur;

    ctx.font=`${FONT_SZ}px 'Hack','Courier New',monospace`;
    ctx.textBaseline="top";

    // Achtergrond
    ctx.fillStyle=W.bg; ctx.fillRect(0,0,CW,CH);

    // ── Cursorline (horizontaal) + cursorcolumn (verticaal) ────────────────
    const cyPos=(curRow-s.scroll)*LINE_H2;
    const cxPos=PAD_L+curCol*cw;
    if(curRow>=s.scroll && curRow<s.scroll+s.visRows+1){
      ctx.fillStyle="rgba(255,255,255,0.055)";
      ctx.fillRect(0, cyPos, CW, LINE_H2);
    }
    ctx.fillStyle="rgba(255,255,255,0.035)";
    ctx.fillRect(cxPos, 0, cw, CH-LINE_H2);

    // ── Regels ────────────────────────────────────────────────────────────
    const lineColors = buildLineColors(s.lines);
    for(let i=0; i<=s.visRows; i++){
      const li=i+s.scroll;
      if(li>=s.lines.length) break;
      const y=i*LINE_H2;
      const line=s.lines[li];

      // Zoek-highlights
      if(s.search && s.matches.length){
        s.matches.filter(m=>m.row===li).forEach((m,mi)=>{
          const isActive=mi===s.matchIdx&&s.matches[s.matchIdx].row===li;
          ctx.fillStyle=isActive?"rgba(234,231,136,0.5)":"rgba(138,198,242,0.2)";
          ctx.fillRect(PAD_L+m.col*cw, y, s.search.length*cw, LINE_H2);
        });
      }

      drawMermaidLine(ctx, line, PAD_L, y, cw, li===curRow, lineColors[li], lineColors);
    }

    // ── Cursor ─────────────────────────────────────────────────────────────
    if(curRow>=s.scroll && curRow<s.scroll+s.visRows+1){
      const cx=PAD_L+curCol*cw;
      const cy=(curRow-s.scroll)*LINE_H2;
      if(s.mode==="INSERT"){
        if(blinkOn.current){ ctx.fillStyle=W.cursorBg; ctx.fillRect(cx-1,cy+2,2,LINE_H2-4); }
      } else {
        const bColor=s.mode==="COMMAND"?W.orange:s.mode==="SEARCH"?W.purple:W.cursorBg;
        ctx.globalAlpha=blinkOn.current?0.9:0.4;
        ctx.fillStyle=bColor; ctx.fillRect(cx,cy,cw,LINE_H2);
        ctx.globalAlpha=1;
        const ch=(s.lines[curRow]||"")[curCol]||" ";
        ctx.fillStyle=W.bg; ctx.fillText(ch,cx,cy+4);
      }
    }

    // ── Statusbalk — identiek aan VimEditor ───────────────────────────────
    const sbY=CH-LINE_H2;
    ctx.fillStyle=W.statusBg; ctx.fillRect(0,sbY,CW,LINE_H2);

    const modeLabel=` ${s.mode} `;
    const modeColor=s.mode==="INSERT"?W.comment:s.mode==="COMMAND"?W.orange:s.mode==="SEARCH"?W.purple:W.blue;
    const badgeW=modeLabel.length*cw+4;
    ctx.fillStyle=modeColor; ctx.fillRect(0,sbY,badgeW,LINE_H2);
    ctx.fillStyle=W.bg;
    ctx.font=`bold ${FONT_SZ}px 'Hack','Courier New',monospace`;
    ctx.fillText(modeLabel,2,sbY+4);
    ctx.font=`${FONT_SZ}px 'Hack','Courier New',monospace`;

    let stxt="";
    if(s.mode==="COMMAND") stxt=":"+s.cmdBuf+"█";
    else if(s.mode==="SEARCH") stxt="/"+s.cmdBuf+"█";
    else if(statusMsg) stxt="  "+statusMsg;
    else if(s.mode==="INSERT") stxt="  -- INSERT --  Esc=NORMAL  Tab=inspringing  Enter=nieuwe regel";
    else stxt=`  ${s.lines.length}L  |  i=INSERT  :tag+=naam  :tag-=naam  /=zoeken  dd=delete  u=undo`;

    ctx.fillStyle=W.fgMuted; ctx.fillText(stxt,badgeW+6,sbY+4);
    const posStr=`${curRow+1}:${curCol+1}`;
    ctx.textAlign="right"; ctx.fillStyle=W.fgDim; ctx.fillText(posStr,CW-6,sbY+4);
    ctx.textAlign="left";
  }, [statusMsg]);

  return React.createElement("div",{
    style:{flex:1, position:"relative", overflow:"hidden", background:W.bg},
    // Klik op de container (ook buiten canvas) → focus naar hidden input
    onClick: () => inputRef.current?.focus(),
    onFocus: () => inputRef.current?.focus(),
    tabIndex: -1,
  },
    React.createElement("canvas",{
      ref:cvRef,
      style:{display:"block", outline:"none"},
      tabIndex: 0,
      // Canvas focus → stuur door naar input
      onFocus: () => inputRef.current?.focus(),
    }),
    React.createElement("input",{
      ref:inputRef, onKeyDown:handleKey, onPaste:handlePaste,
      readOnly:true,
      style:{position:"absolute",top:0,left:0,width:"1px",height:"1px",
             opacity:0,border:"none",outline:"none",padding:0,
             fontSize:"1px"},
      tabIndex: -1,
    })
  );
};

// ── Mermaid Mindmap Editor (split: code | preview) ───────────────────────────
const MermaidEditor = ({ initialText="", onSave, onCancel, notes=[], serverPdfs=[], serverImages=[] }) => {
  const DEFAULT = `mindmap\n  root((Mijn Mindmap))\n    Tak A\n      Sub A1\n      Sub A2\n    Tak B\n      Sub B1\n    Tak C`;
  const [code, setCode]               = React.useState(initialText || DEFAULT);
  const [title, setTitle]             = React.useState("");
  const [tags, setTags]               = React.useState(["mindmap"]);
  const [saving, setSaving]           = React.useState(false);
  const [saveMsg, setSaveMsg]         = React.useState("");
  const [showLink, setShowLink]       = React.useState(false);
  const [linkSearch, setLinkSearch]   = React.useState("");
  const [linkType, setLinkType]       = React.useState("all");
  const containerRef                  = React.useRef(null);
  const editorRef                     = React.useRef(null);   // {insertAtCursor}
  const [previewSize, setPreviewSize] = React.useState({w:400, h:400});

  // Sluit link-dropdown bij klik buiten
  React.useEffect(() => {
    if (!showLink) return;
    const h = () => { setShowLink(false); setLinkSearch(""); };
    setTimeout(() => document.addEventListener("click", h), 0);
    return () => document.removeEventListener("click", h);
  }, [showLink]);

  // Resize observer preview canvas
  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => {
      const r = e[0];
      if (r) setPreviewSize({w: r.contentRect.width, h: r.contentRect.height});
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
    const ns = parseMermaidMindmap(code);
    const noteTitle = title || "Mindmap — " + (ns[0]?.label || "mindmap");
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

  // Voeg link in op huidige cursorpositie in de code-editor
  const insertLink = (linkText) => {
    editorRef.current?.insertAtCursor(linkText);
    setShowLink(false);
    setLinkSearch("");
  };

  // ── Preview toggle + nieuw mindmap state (voor linkDropdown) ───────────────
  const [showPreview, setShowPreview] = React.useState(true);
  const [editorMode, setEditorMode]   = React.useState("INSERT");

  const enterInsert = () => {
    editorRef.current?.focus();
    editorRef.current?.triggerInsert?.();
  };

  const newMindmap = () => {
    const NW = `mindmap\n  root((Nieuwe Mindmap))\n    Tak A\n      Sub A1\n    Tak B`;
    setCode(NW);
    setTitle("");
    setTimeout(() => { editorRef.current?.focus(); editorRef.current?.triggerInsert?.(); }, 60);
  };

  // ── Link dropdown (identiek aan notitie-editor) ───────────────────────────
  const linkDropdown = showLink && React.createElement("div",{
    style:{position:"absolute", top:"calc(100% + 4px)", right:0, zIndex:210,
           background:W.bg2, border:`1px solid ${W.splitBg}`, borderRadius:"8px",
           width:"300px", maxHeight:"420px", display:"flex", flexDirection:"column",
           boxShadow:"0 8px 32px rgba(0,0,0,0.75)"}
  },
    // Type-filter tabs
    React.createElement("div",{style:{display:"flex",borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}},
      [["all","Alles"],["notes","📝 Notities"],["pdf","📄 PDF"],["images","🖼 Plaatjes"]].map(([id,lbl])=>
        React.createElement("button",{key:id, onClick:()=>setLinkType(id),
          style:{flex:1, background:linkType===id?"rgba(138,198,242,0.12)":"none",
                 border:"none", borderBottom:linkType===id?`2px solid ${W.blue}`:"2px solid transparent",
                 color:linkType===id?W.blue:W.fgMuted,
                 fontSize:"9px", padding:"7px 2px", cursor:"pointer", letterSpacing:"0.3px"}
        }, lbl)
      )
    ),
    // Zoekbalk
    React.createElement("div",{style:{padding:"7px 10px",borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}},
      React.createElement("input",{
        autoFocus:true, value:linkSearch,
        onChange:e=>setLinkSearch(e.target.value),
        placeholder:"Zoeken…",
        style:{width:"100%", background:"rgba(255,255,255,0.06)",
               border:`1px solid ${W.splitBg}`, borderRadius:"5px",
               padding:"5px 9px", color:W.fg, fontSize:"14px",
               outline:"none", fontFamily:"inherit"}
      })
    ),
    // Resultatenlijst
    React.createElement("div",{style:{overflowY:"auto",flex:1}},
      // Notities
      (linkType==="all"||linkType==="notes") && (() => {
        const ns = notes.filter(n =>
          !linkSearch || n.title?.toLowerCase().includes(linkSearch.toLowerCase()) ||
          (n.tags||[]).some(t=>t.includes(linkSearch.toLowerCase()))
        ).slice(0,20);
        if (!ns.length) return null;
        return React.createElement(React.Fragment,null,
          linkType==="all" && React.createElement("div",{style:{
            padding:"5px 12px 3px", fontSize:"9px", color:W.fgMuted,
            letterSpacing:"1.5px", background:"rgba(0,0,0,0.2)"
          }},"NOTITIES"),
          ns.map(n => React.createElement("div",{key:n.id,
            onMouseDown: e => { e.preventDefault(); insertLink("[["+n.title+"]]"); },
            style:{padding:"7px 12px", cursor:"pointer",
                   borderBottom:`1px solid rgba(255,255,255,0.03)`,
                   display:"flex", flexDirection:"column", gap:"1px"}
          },
            React.createElement("span",{style:{fontSize:"14px",color:W.fg,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},n.title),
            (n.tags||[]).length>0 && React.createElement("div",{
              style:{display:"flex",gap:"3px",flexWrap:"wrap",marginTop:"2px"}},
              (n.tags||[]).slice(0,4).map(t=>React.createElement("span",{key:t,style:{
                fontSize:"11px",color:"#b8e06a",fontWeight:"500",
                background:"rgba(159,202,86,0.13)",
                border:"1px solid rgba(159,202,86,0.35)",
                borderRadius:"4px",padding:"1px 6px",lineHeight:"1.3",
              }},"#"+t)))
          ))
        );
      })(),
      // PDFs
      (linkType==="all"||linkType==="pdf") && (() => {
        const ps = serverPdfs.filter(p =>
          !linkSearch || p.name.toLowerCase().includes(linkSearch.toLowerCase())
        ).slice(0,15);
        if (!ps.length) return null;
        return React.createElement(React.Fragment,null,
          linkType==="all" && React.createElement("div",{style:{
            padding:"5px 12px 4px", fontSize:"11px", color:W.orange,
            letterSpacing:"1.2px", fontWeight:"600", background:"rgba(0,0,0,0.2)"
          }},"PDF"),
          ps.map(p => React.createElement("div",{key:p.name,
            onMouseDown: e => { e.preventDefault(); insertLink("[[pdf:"+p.name+"]]"); },
            style:{padding:"7px 12px", cursor:"pointer",
                   borderBottom:`1px solid rgba(255,255,255,0.03)`,
                   display:"flex", alignItems:"center", gap:"8px"}
          },
            React.createElement("span",{style:{fontSize:"14px"}},"📄"),
            React.createElement("span",{style:{fontSize:"14px",color:W.fgDim,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}},p.name)
          ))
        );
      })(),
      // Afbeeldingen
      (linkType==="all"||linkType==="images") && (() => {
        const imgs = serverImages.filter(i =>
          !linkSearch || i.name.toLowerCase().includes(linkSearch.toLowerCase())
        ).slice(0,15);
        if (!imgs.length) return null;
        return React.createElement(React.Fragment,null,
          linkType==="all" && React.createElement("div",{style:{
            padding:"5px 12px 4px", fontSize:"11px", color:W.blue,
            letterSpacing:"1.2px", fontWeight:"600", background:"rgba(0,0,0,0.2)"
          }},"AFBEELDINGEN"),
          imgs.map(img => React.createElement("div",{key:img.name,
            onMouseDown: e => { e.preventDefault(); insertLink("![[img:"+img.name+"]]"); },
            style:{padding:"7px 12px", cursor:"pointer",
                   borderBottom:`1px solid rgba(255,255,255,0.03)`,
                   display:"flex", alignItems:"center", gap:"8px"}
          },
            React.createElement("span",{style:{fontSize:"14px"}},"🖼"),
            React.createElement("span",{style:{fontSize:"14px",color:W.fgDim,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}},img.name)
          ))
        );
      })(),
      // Lege staat
      [notes, serverPdfs, serverImages].every(arr =>
        !arr.filter(x => !linkSearch || (x.title||x.name||"").toLowerCase().includes(linkSearch.toLowerCase())).length
      ) && React.createElement("div",{style:{padding:"20px",color:W.fgMuted,
        fontSize:"14px",textAlign:"center"}},"Geen resultaten")
    )
  );

  return React.createElement("div",{style:{
    display:"flex", flexDirection:"column", width:"100%", height:"100%", overflow:"hidden",
    background:W.bg
  }},

    // ── Toolbar — identiek aan notitie-editor ────────────────────────────────
    React.createElement("div",{style:{
      background:W.bg2, borderBottom:`1px solid ${W.splitBg}`,
      padding:"6px 10px", display:"flex",
      alignItems:"center", gap:"6px", flexShrink:0,
    }},
      // Titel
      React.createElement("input",{
        value:title, onChange:e=>setTitle(e.target.value),
        placeholder:"Mindmap titel…",
        onKeyDown:e=>{ if(e.key==="Enter"){ e.preventDefault(); editorRef.current?.focus(); editorRef.current?.triggerInsert?.(); } },
        style:{
          flex:1, minWidth:"120px", background:"transparent",
          border:"none", color:W.statusFg,
          fontSize:"16px", fontWeight:"bold", outline:"none",
          WebkitAppearance:"none",
        }
      }),
      // Tags
      React.createElement(SmartTagEditor,{tags, onChange:setTags, allTags:["mindmap","ai","overzicht"]}),

      // ── Knoppen — zelfde stijl/volgorde als notitie-editor ──────────────
      // ✏ bewerken — brengt editor naar INSERT mode; licht op als INSERT actief
      React.createElement("button",{
        onClick: enterInsert,
        title: "Klik om te bewerken (INSERT mode) — of druk 'i' in de editor",
        style:{
          background: editorMode==="INSERT" ? "rgba(159,202,86,0.12)" : "none",
          border: `1px solid ${editorMode==="INSERT" ? W.comment : W.splitBg}`,
          borderRadius:"6px", padding:"4px 10px",
          color: editorMode==="INSERT" ? W.comment : W.fgMuted,
          fontSize:"14px", cursor:"pointer", flexShrink:0,
        }
      }, "✏ bewerken"),

      // 🔗 koppelen
      React.createElement("div",{style:{position:"relative",flexShrink:0}, onClick:e=>e.stopPropagation()},
        React.createElement("button",{
          onClick:()=>{ setShowLink(v=>!v); setLinkSearch(""); setLinkType("all"); },
          title:"Link invoegen op cursorpositie",
          style:{
            background: showLink?"rgba(138,198,242,0.15)":"none",
            border:`1px solid ${showLink?"rgba(138,198,242,0.4)":W.splitBg}`,
            borderRadius:"6px", padding:"4px 10px",
            color: showLink?W.blue:W.fgMuted,
            fontSize:"14px", cursor:"pointer", flexShrink:0,
          }
        }, "🔗 koppelen"),
        linkDropdown
      ),

      // ⊞/⊟ preview
      React.createElement("button",{
        onClick:()=>setShowPreview(v=>!v),
        title: showPreview ? "Preview verbergen" : "Preview tonen",
        style:{
          background: showPreview?"rgba(138,198,242,0.1)":"none",
          border:`1px solid ${showPreview?"rgba(138,198,242,0.35)":W.splitBg}`,
          borderRadius:"6px", padding:"4px 10px",
          color: showPreview?W.blue:W.fgMuted,
          fontSize:"14px", cursor:"pointer", flexShrink:0,
        }
      }, showPreview ? "⊟ preview" : "⊞ preview"),

      // ✓ opslaan
      React.createElement("button",{
        onClick:handleSave, disabled:saving,
        style:{
          background:W.comment, border:`1px solid ${W.comment}`,
          borderRadius:"6px", padding:"4px 10px",
          color:W.bg, fontSize:"14px", fontWeight:"bold",
          cursor:saving?"default":"pointer", flexShrink:0,
        }
      }, saving ? "⏳…" : "✓ opslaan"),

      saveMsg && React.createElement("span",{style:{
        fontSize:"14px", flexShrink:0,
        color:saveMsg.startsWith("✓")?W.comment:W.orange,
      }}, saveMsg),

      // ✕ sluiten
      onCancel && React.createElement("button",{
        onClick:onCancel,
        style:{
          background:"none", border:`1px solid ${W.splitBg}`,
          borderRadius:"6px", padding:"4px 10px",
          color:W.fgMuted, fontSize:"14px",
          cursor:"pointer", flexShrink:0,
        }
      }, "✕ sluiten"),
    ),

    // ── Split: editor | preview ──────────────────────────────────────────────
    React.createElement("div",{style:{flex:1, display:"flex", overflow:"hidden"}},

      // Code editor (neemt volledige breedte als preview verborgen)
      React.createElement("div",{style:{
        width: showPreview ? "42%" : "100%",
        flexShrink:0, display:"flex", flexDirection:"column",
        borderRight: showPreview ? `1px solid ${W.splitBg}` : "none",
        transition:"width 0.2s",
      }},
        React.createElement(MermaidCodeEditor, {
          value: code,
          onChange: setCode,
          editorRef,
          noteTags: tags,
          onTagsChange: setTags,
          allTags: ["mindmap","ai","overzicht","notitie","pdf","import"],
          onModeChange: setEditorMode,
        })
      ),

      // Preview canvas — verborgen als showPreview false
      showPreview && React.createElement("div",{
        ref:containerRef,
        style:{flex:1, position:"relative", background:W.bg, overflow:"hidden"}
      },
        React.createElement(MermaidCanvas,{
          text:code, width:previewSize.w||400, height:previewSize.h||400,
          interactive:true
        })
      )
    )
  );
};

const MindMap = ({notes, allTags, onSelectNote, aiMindmap, onAddNote, serverPdfs=[], serverImages=[]}) => {
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
  const mmCentredRef = useRef(false); // centrering al gedaan voor huidige layout

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
    const dpr = window.devicePixelRatio||1;
    const CW = cv.clientWidth  || cv.width/dpr  || 800;
    const CH = cv.clientHeight || cv.height/dpr || 600;
    const cx = CW / 2, cy = CH / 2;

    const visibleTags = tagFilter ? [tagFilter]
      : (showTags ? allTags : []);

    const newNodes = [];
    const newEdges = [];

    // Root node
    const root = {id:"root", label:"Zettelkasten", fullLabel:"Zettelkasten", type:"root",
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
          id: "tag-"+tag, label:"#"+tag, fullLabel:tag, type:"tag",
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
        const tagNode = {id:"tag-"+tag, label:"#"+tag, fullLabel:tag, type:"tag",
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
    mmCentredRef.current = false; // volgende resize centreert opnieuw
    setZoom(0.85);
  }, [notes, allTags, tagFilter, showTags, showNotes, layout, tagColorMap]);

  useEffect(() => { buildLayout(); }, [buildLayout]);

  // Na elke layout-rebuild: centreer opnieuw zodra canvas klaar is
  useEffect(() => {
    if (!nodes.length) return;
    const cv = cvRef.current; if (!cv) return;
    const attempt = (tries = 0) => {
      const p = cv.parentElement; if (!p) return;
      const w = p.offsetWidth || p.clientWidth || p.getBoundingClientRect().width;
      const h = p.offsetHeight || p.clientHeight || p.getBoundingClientRect().height;
      if (!w || !h) {
        if (tries < 10) setTimeout(() => attempt(tries + 1), 50);
        return;
      }
      const root = nodesRef.current.find(n => n.id === "root");
      if (!root) return;
      const z = 0.85;
      setPan({ x: w/2 - root.x * z, y: h/2 - root.y * z });
    };
    setTimeout(attempt, 0);
  }, [nodes]);

  // ── AI mindmap layout (3-laags: root → tak → subtopic → detail) ───────────
  const buildAiLayout = useCallback(() => {
    if (!aiMindmap || !cvRef.current) return;
    const cv = cvRef.current;
    const dpr = window.devicePixelRatio||1;
    const CW = cv.clientWidth  || cv.width/dpr  || 800;
    const CH = cv.clientHeight || cv.height/dpr || 600;
    const cx = CW/2, cy = CH/2;

    const newNodes = [];
    const newEdges = [];
    const branches = aiMindmap.branches || [];

    newNodes.push({id:"root", label: aiMindmap.root||"Overzicht",
                   fullLabel: aiMindmap.root||"Overzicht",
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
        newNodes.push({id:bId, label:b.label, fullLabel:b.label, type:"branch",
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
          newNodes.push({id:sId, label:cLabel, fullLabel:cLabel, type:"sub", x:sx, y:sy, color, parentId:bId});
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
        newNodes.push({id:bId, label:b.label, fullLabel:b.label, type:"branch",
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
          newNodes.push({id:sId, label:cLabel, fullLabel:cLabel, type:"sub", x:sx, y:sy, color, parentId:bId});
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
    mmCentredRef.current = false; // volgende resize centreert opnieuw
    // Pan wordt gezet door de canvas resize zodra echte afmetingen bekend zijn
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

    const centredRef = mmCentredRef; // gedeelde ref zodat layout-reset ook centrering reset
    const resize = () => {
      const p = cv.parentElement;
      const w = p.offsetWidth  || p.clientWidth  || p.getBoundingClientRect().width;
      const h = p.offsetHeight || p.clientHeight || p.getBoundingClientRect().height;
      if (!w || !h) return;
      cv.style.flex = "none"; // verwijder flex:1 na eerste meting
      cv.width  = w * dpr;
      cv.height = h * dpr;
      cv.style.width  = w + "px";
      cv.style.height = h + "px";
      ctx.scale(dpr, dpr);
      // Eerste keer dat we echte afmetingen hebben: centreer de root-node
      if (!centredRef.current) {
        centredRef.current = true;
        const ns = nodesRef.current;
        const root = ns.find(n => n.id === "root");
        if (root) {
          const z = 0.85;
          setPan({ x: w/2 - root.x * z, y: h/2 - root.y * z });
          setZoom(z);
        }
      }
    };
    requestAnimationFrame(()=>{ requestAnimationFrame(()=>{
      resize();
      setTimeout(resize, 100); // iOS Safari fallback
    }); });
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
    if (e.button === 1 || e.button === 2 || (e.button===0 && e.altKey)) {
      // Middelklik, rechterknop of Alt+klik = pannen
      e.preventDefault();
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

  // ── Mindmap nodes → Mermaid syntax ────────────────────────────────────────
  const nodesToMermaid = useCallback(() => {
    const ns = nodes;
    if (!ns.length) return "mindmap\n  root((Mindmap))";

    const childrenOf = {};
    ns.forEach(n => { childrenOf[n.id] = []; });
    edges.forEach(e => {
      if (childrenOf[e.from] !== undefined) childrenOf[e.from].push(e.to);
    });

    const root = ns.find(n => n.type === "root" || n.id === "root");
    if (!root) return "mindmap\n  root((Mindmap))";

    const lines = ["mindmap"];

    const walk = (nodeId, depth) => {
      const node = ns.find(n => n.id === nodeId);
      if (!node) return;
      const indent = "  ".repeat(depth);
      // fullLabel heeft altijd de onafgekapte tekst
      const label = (node.fullLabel || node.label || "")
        .replace(/…$/, "")   // strip visuele truncatie
        .trim();

      if (depth === 1) {
        lines.push(`${indent}root((${label}))`);
      } else {
        lines.push(`${indent}${label}`);
      }

      const children = (childrenOf[nodeId] || [])
        .map(cid => ns.find(n => n.id === cid))
        .filter(Boolean)
        .sort((a, b) => (a.y || 0) - (b.y || 0));

      children.forEach(child => walk(child.id, depth + 1));
    };

    walk(root.id, 1);
    return lines.join("\n");
  }, [nodes, edges]);

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
      notes,
      serverPdfs,
      serverImages,
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
    style:{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden",position:"relative"}
  },

    // Canvas
    React.createElement("canvas", {
      ref: cvRef,
      style:{flex:1,cursor: (dragRef.current||panRef.current)?"grabbing":"crosshair"},
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

      // ✦ Nieuwe lege mindmap — boven de tabs
      React.createElement("button",{
        onClick:()=>{ setMmView("mermaid"); setEditMermaid(null); },
        title:"Nieuwe lege mindmap openen in editor",
        style:{
          width:"100%", padding:"6px 10px",
          background:"rgba(138,198,242,0.07)",
          border:`1px solid rgba(138,198,242,0.3)`,
          borderRadius:"6px", color:W.blue,
          fontSize:"14px", fontWeight:"600",
          cursor:"pointer", marginBottom:"4px",
          display:"flex", alignItems:"center",
          justifyContent:"center", gap:"6px",
          transition:"all 0.12s",
        },
        onMouseEnter:e=>{
          e.currentTarget.style.background="rgba(138,198,242,0.15)";
          e.currentTarget.style.borderColor="rgba(138,198,242,0.55)";
        },
        onMouseLeave:e=>{
          e.currentTarget.style.background="rgba(138,198,242,0.07)";
          e.currentTarget.style.borderColor="rgba(138,198,242,0.3)";
        },
      },
        React.createElement("span",null,"✦"),
        "Nieuwe mindmap"
      ),

      // AI/Vault/Mermaid toggle — onder de nieuwe-knop
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
              if (opt.id==="mermaid") { setMmView("mermaid"); setEditMermaid(nodesToMermaid()); }
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
              borderRadius:"4px",padding:"3px 6px",fontSize:"14px",cursor:"pointer"
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
            fontSize:"14px", fontWeight:"600", cursor:saving?"default":"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:"5px",
            transition:"all 0.15s",
          }
        },
          saving
            ? React.createElement(React.Fragment,null,
                React.createElement("span",{style:{fontSize:"14px"}},"⏳"),
                "Opslaan…")
            : React.createElement(React.Fragment,null,
                React.createElement("span",{style:{fontSize:"14px"}},"💾"),
                "Opslaan als notitie")
        ),
        saveMsg && React.createElement("div",{style:{
          marginTop:"5px", fontSize:"14px", textAlign:"center",
          color: saveMsg.startsWith("✓") ? W.comment : W.orange,
        }}, saveMsg)
      ),
      React.createElement("div",{style:{display:"flex",gap:"5px",alignItems:"center"}},
        React.createElement("span",{style:{fontSize:"9px",color:"rgba(138,198,242,0.5)",
          letterSpacing:"1.5px",flex:1}},"MODUS"),
        [{id:"view",label:"👁 bekijk"},{id:"edit",label:"✏ bewerk"}].map(m=>
          React.createElement("button",{key:m.id, onClick:()=>setMode(m.id),
            style:{background:mode===m.id?"rgba(138,198,242,0.18)":"none",
                   border:`1px solid ${mode===m.id?"rgba(138,198,242,0.5)":W.splitBg}`,
                   color:mode===m.id?"#a8d8f0":W.fgMuted,
                   borderRadius:"4px",padding:"2px 8px",fontSize:"14px",cursor:"pointer"}
          },m.label))
      ),

      // Layout + weergave — in vault-modus ook tag-filter
      React.createElement(React.Fragment,null,
        // Layout
        React.createElement("div",{style:{display:"flex",gap:"5px",alignItems:"center"}},
          React.createElement("span",{style:{fontSize:"9px",color:"rgba(138,198,242,0.5)",
            letterSpacing:"1.5px",flex:1}},"LAYOUT"),
          [{id:"radial",label:"⊙"},{id:"tree",label:"⊤"}].map(l=>
            React.createElement("button",{key:l.id, onClick:()=>setLayout(l.id),
              style:{background:layout===l.id?"rgba(138,198,242,0.18)":"none",
                     border:`1px solid ${layout===l.id?"rgba(138,198,242,0.5)":W.splitBg}`,
                     color:layout===l.id?"#a8d8f0":W.fgMuted,
                     borderRadius:"4px",padding:"2px 10px",fontSize:"14px",cursor:"pointer"}
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
                     borderRadius:"4px",padding:"2px 9px",fontSize:"14px",cursor:"pointer"}
            },val?"✓ "+label:"○ "+label))
        ),
        // Tag filter: alleen in vault-modus
        !aiMode && allTags.length>0 && React.createElement("div",null,
          React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
            letterSpacing:"1.5px",marginBottom:"4px"}},"TAG FILTER"),
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
                 fontSize:"14px",cursor:"pointer"}
        },"+ knoop"),
        selId&&selId!=="root"&&React.createElement("button",{onClick:deleteSelected,
          style:{background:"rgba(229,120,109,0.08)",border:`1px solid rgba(229,120,109,0.25)`,
                 color:W.orange,borderRadius:"4px",padding:"3px 9px",
                 fontSize:"14px",cursor:"pointer"}
        },"✕ verwijder"),
        React.createElement("button",{onClick:()=>aiMode?buildAiLayout():buildLayout(),
          style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                 borderRadius:"4px",padding:"3px 9px",fontSize:"14px",cursor:"pointer"}
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
        style:{fontSize:"14px",color:W.fgMuted,cursor:"pointer",minWidth:"38px",textAlign:"center"}
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
      React.createElement("div",{style:{fontSize:"14px",color:selNode.color||W.fgMuted,
        letterSpacing:"1px",marginBottom:"4px"}},
        selNode.type==="root"?"ROOT":selNode.type==="tag"?"TAG":"NOTITIE"),
      React.createElement("div",{style:{fontSize:"14px",color:W.fg,
        fontWeight:"bold",wordBreak:"break-word",marginBottom:"6px"}},
        selNode.fullLabel||selNode.label),
      selNode.type==="note"&&selNode.noteId&&React.createElement("button",{
        onClick:()=>onSelectNote?.(selNode.noteId),
        style:{background:"rgba(138,198,242,0.1)",border:"1px solid rgba(138,198,242,0.3)",
               color:"#a8d8f0",borderRadius:"4px",padding:"4px 10px",
               fontSize:"14px",cursor:"pointer",width:"100%"}
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
        React.createElement("div",{style:{fontSize:"14px",color:"rgba(138,198,242,0.6)",
          letterSpacing:"1.5px"}},"LABEL BEWERKEN"),
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
                   fontSize:"14px",cursor:"pointer",fontWeight:"bold"}
          },"✓ opslaan"),
          React.createElement("button",{onClick:()=>setEditingId(null),
            style:{background:"none",border:`1px solid ${W.splitBg}`,
                   color:W.fgMuted,borderRadius:"5px",padding:"6px 12px",
                   fontSize:"14px",cursor:"pointer"}
          },"Esc")
        )
      )
    ),

    // ── Legenda onderin ────────────────────────────────────────────────────────
    React.createElement("div",{
      style:{position:"absolute",bottom:"14px",left:"50%",transform:"translateX(-50%)",
             background:"rgba(28,28,28,0.85)",border:`1px solid ${W.splitBg}`,
             borderRadius:"6px",padding:"5px 14px",fontSize:"14px",color:W.fgMuted,
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

const LLMNotebook = ({notes, pdfNotes, serverPdfs, serverImages, allTags, onAddNote, llmModel, setLlmModel, onMindmapReady, onPasteToNote=null}) => {
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // sidebar standaard ingeklapt
  const [showInstall,   setShowInstall]  = useState(false);
  const [tagFilter,     setTagFilter]    = useState(null);
  const [savingNote,    setSavingNote]   = useState(false);
  const [mmPending,     setMmPending]    = useState(false);   // mindmap genereren
  const [graphRagMode,  setGraphRagMode] = useState(true);   // GraphRAG standaard aan
  const [graphRagInfo,  setGraphRagInfo] = useState(null);   // info over de query
  const [socraticMode,  setSocraticMode] = useState(false);  // Socratische vragen i.p.v. antwoorden

  const [ctxExtPdfs,    setCtxExtPdfs]   = useState([]);   // absolute paden
  const [extPdfFiles,   setExtPdfFiles]  = useState([]);   // {name,path,dir,size}
  const [extPdfDirs,    setExtPdfDirs]   = useState([]);   // geconfigureerde mappen
  const [newExtDir,     setNewExtDir]    = useState("");
  const [showExtPdfs,   setShowExtPdfs]  = useState(true);
  const [extPdfLoading, setExtPdfLoading]= useState(false);
  const [extPdfSearch,  setExtPdfSearch]  = useState("");
  const [showExtPanel,  setShowExtPanel]  = useState(false);
  const [browseItems,   setBrowseItems]   = useState([]);
  const [browsePath,    setBrowsePath]    = useState("");
  const [browseParent,  setBrowseParent]  = useState("");
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError,   setBrowseError]   = useState("");
  const [browseMode,    setBrowseMode]    = useState("dirs");  // "dirs" | "browser"
  const [selectedDirs,  setSelectedDirs]  = useState(new Set());

  const chatEndRef  = useRef(null);
  const inputRef    = useRef(null);
  const abortRef    = useRef(null);  // AbortController voor streaming
  const browseCacheRef = useRef({});  // pad → items cache
  const chatAreaRef = useRef(null);   // ref op het scroll-gebied voor selectie-detectie

  // ── Tekst-selectie detectie voor "plak selectie" knop ────────────────────────
  const [selectionPopup, setSelectionPopup] = useState(null); // {text, x, y}

  const handleChatMouseUp = useCallback(() => {
    if (!onPasteToNote) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setSelectionPopup(null); return; }
    const text = sel.toString().trim();
    if (!text || text.length < 10) { setSelectionPopup(null); return; }
    // Controleer dat de selectie binnen het chat-gebied valt
    const range = sel.getRangeAt(0);
    const rect  = range.getBoundingClientRect();
    const area  = chatAreaRef.current?.getBoundingClientRect();
    if (!area) return;
    setSelectionPopup({ text, x: rect.left - area.left + rect.width / 2, y: rect.top - area.top - 8 });
  }, [onPasteToNote]);

  // Sluit popup bij klik buiten
  useEffect(() => {
    const hide = () => setSelectionPopup(null);
    document.addEventListener("selectionchange", () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setSelectionPopup(null);
    });
  }, []);

  // ── Plak helper ──────────────────────────────────────────────────────────────
  const pasteToNote = useCallback((text, label = "Notebook AI") => {
    if (!onPasteToNote) return;
    onPasteToNote({ text, source: label, page: null, url: null, type: "ai" });
    setSelectionPopup(null);
  }, [onPasteToNote]);

  // ── Model sync: statusbalk → Notebook (eenrichtingsverkeer) ─────────────────
  // llmModel is de bron van waarheid (statusbalk ModelPicker).
  // Notebook toont het actieve model, wijzigen gaat via de statusbalk.
  useEffect(()=>{ if(llmModel) setModel(llmModel); },[llmModel]);

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

  const browseTo = useCallback(async (path) => {
    const key = path==null ? "" : path;

    // Toon gecachede inhoud direct — geen laadvertraging
    if (browseCacheRef.current[key]) {
      const cached = browseCacheRef.current[key];
      setBrowseItems(cached.items);
      setBrowsePath(cached.path);
      setBrowseParent(cached.parent);
      setBrowseError("");
      // Haal op de achtergrond toch vers op (stille refresh)
    } else {
      setBrowseLoading(true);
    }

    setBrowseError("");
    try {
      const r = await fetch("/api/browse?path="+encodeURIComponent(key));
      if (!r.ok) throw new Error("HTTP "+r.status);
      const d = await r.json();
      if (d.error) {
        setBrowseError(d.error);
        setBrowseItems([]);
      } else {
        const result = {
          items:  d.items||[],
          path:   d.path||"",
          parent: d.parent!=null ? d.parent : ""
        };
        browseCacheRef.current[key] = result;
        setBrowseItems(result.items);
        setBrowsePath(result.path);
        setBrowseParent(result.parent);
      }
    } catch(e) {
      if (!browseCacheRef.current[key])  // alleen fout tonen als er geen cache is
        setBrowseError("Verbindingsfout: "+e.message);
    }
    setBrowseLoading(false);
  }, []);

  const loadExtPdfs = useCallback(async () => {
    setExtPdfLoading(true);
    try {
      const r = await fetch("/api/ext-pdfs");
      const d = await r.json();
      setExtPdfDirs(d.dirs || []);
      setExtPdfFiles(d.files || []);
    } catch(e) {}
    setExtPdfLoading(false);
  }, []);

  useEffect(() => { loadExtPdfs(); }, []);

  const saveExtDirs = async (dirs) => {
    setExtPdfDirs(dirs);
    await fetch("/api/ext-pdfs", {method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({dirs})});
    await loadExtPdfs();
  };

  // ── Auto-scroll naar onderste bericht ────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Context samenvatting ──────────────────────────────────────────────────
  const contextSummary = useMemo(() => {
    const nCount = ctxNotes.length;
    const pCount = ctxPdfs.length;
    const iCount = ctxImages.length;
    const eCount = ctxExtPdfs.length;
    if (!nCount && !pCount && !iCount && !eCount) return null;
    const parts = [];
    if (nCount) parts.push(nCount+" notitie"+(nCount>1?"s":""));
    if (pCount) parts.push(pCount+" PDF"+(pCount>1?"'s":""));
    if (eCount) parts.push(eCount+" extern PDF"+(eCount>1?"'s":""));
    if (iCount) parts.push(iCount+" afb.");
    return parts.join(" + ");
  }, [ctxNotes, ctxPdfs, ctxImages, ctxExtPdfs]);

  // ── Gefilterde notities voor context-selector ─────────────────────────────
  const filteredNotes = useMemo(() => {
    if (!tagFilter) return notes;
    return notes.filter(n => (n.tags||[]).includes(tagFilter));
  }, [notes, tagFilter]);

  // ── Altijd alle (gefilterde) notities meenemen ───────────────────────────
  useEffect(() => {
    setCtxNotes(filteredNotes.map(n => n.id));
  }, [filteredNotes]);

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
      let endpoint, body;
      if (graphRagMode) {
        // GraphRAG: stuur vraag + model → server bouwt graaf-context
        endpoint = "/api/llm/graphrag";
        body = JSON.stringify({ question: text, model, top_n: 5 });
      } else {
        endpoint = "/api/llm/chat";
        const socraticSystem = socraticMode
          ? `Je bent een Socratische leercoach. Je helpt de gebruiker hun eigen inzichten te ontdekken.
REGELS:
- Geef NOOIT direct het antwoord, ook niet als er expliciet om gevraagd wordt.
- Stel altijd een verduidelijkende of verdiepende tegenvraag.
- Wijs op tegenstrijdigheden of aannames in de redenering van de gebruiker.
- Als de gebruiker het antwoord al bijna heeft, bevestig dan wat klopt en stel één scherpe vervolgvraag.
- Maximaal 3 zinnen per reactie. Eindig altijd met een vraag.
- Begin elke respons met "Interessant. " of "Wat bedoel je met..." of een andere Socratische opener.`
          : null;
        body = JSON.stringify({
          model,
          messages: history.map(m => ({ role: m.role, content: m.content })),
          context_notes:    ctxNotes,
          context_pdfs:     ctxPdfs,
          context_images:   ctxImages,
          context_ext_pdfs: ctxExtPdfs,
          ...(socraticSystem ? { system: socraticSystem } : {}),
        });
      }

      const resp = await fetch(endpoint, {
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

  // ── Hiaat-analyse: vraagt AI om kennisleemtes te detecteren ─────────────────
  const runHiaatAnalyse = useCallback(async () => {
    const userMsg = {
      role:"user",
      content:"Analyseer mijn Zettelkasten knowledge graph grondig. Identificeer:\n"
             +"1. **Kennishiaten** — onderwerpen die aangestipt worden maar nauwelijks uitgewerkt zijn\n"
             +"2. **Zwakke bruggen** — notities die communities verbinden maar zelf weinig inhoud hebben\n"
             +"3. **Eiland-clusters** — groepen notities die geïsoleerd zijn van de rest\n"
             +"4. **Ontbrekende verbindingen** — ideeën die logisch verwant zijn maar niet gelinkt\n"
             +"5. **Aanbevelingen** — concrete volgende stappen om het kennisnetwerk te versterken\n\n"
             +"Wees specifiek en verwijs naar echte notitietitels uit de context."
    };
    setMessages(prev=>[...prev,userMsg,{role:"assistant",content:"",streaming:true}]);
    setStreaming(true);
    try {
      const resp = await fetch("/api/llm/graphrag",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          question:userMsg.content,
          model,
          top_n:8,
        }),
      });
      const reader=resp.body.getReader();
      const dec=new TextDecoder();
      let buf="",full="";
      while(true){
        const {done,value}=await reader.read();
        if(done) break;
        buf+=dec.decode(value,{stream:true});
        const lines=buf.split("\n"); buf=lines.pop()||"";
        for(const line of lines){
          if(!line.startsWith("data: ")) continue;
          try{
            const evt=JSON.parse(line.slice(6));
            if(evt.error) throw new Error(evt.error);
            if(evt.delta){ full+=evt.delta; setMessages(prev=>{const u=[...prev];u[u.length-1]={role:"assistant",content:full,streaming:true};return u;}); }
          }catch(e){ if(e.message&&!e.message.includes("JSON")) throw e; }
        }
      }
      setMessages(prev=>{const u=[...prev];u[u.length-1]={role:"assistant",content:full};return u;});
    } catch(e){
      setMessages(prev=>{const u=[...prev];u[u.length-1]={role:"assistant",content:"Fout: "+e.message};return u;});
    } finally { setStreaming(false); }
  }, [model]);

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
  const isMobileView = window.innerWidth < 1200;  // tablet én mobile behandelen als "compact"

  return React.createElement("div", {
    style:{ display:"flex", flex:1, minHeight:0, background:W.bg, overflow:"hidden", position:"relative" }
  },

    // ── Context zijpaneel (inklapbaar) ──────────────────────────────────────
    React.createElement("div", {
      style:{
        width: sidebarCollapsed ? "40px" : (isMobileView ? "280px" : "260px"),
        flexShrink:0,
        background:W.bg2,
        borderRight:`1px solid ${W.splitBg}`,
        display:"flex", flexDirection:"column",
        // Op compact: overlay over de chat maar NIET over de topbar
        position: isMobileView && !sidebarCollapsed ? "absolute" : "relative",
        top:    isMobileView && !sidebarCollapsed ? 0 : "auto",
        left:   isMobileView && !sidebarCollapsed ? 0 : "auto",
        bottom: isMobileView && !sidebarCollapsed ? 0 : "auto",
        zIndex: isMobileView && !sidebarCollapsed ? 50 : "auto",
        transition:"width 0.18s ease",
        overflow:"hidden",
        boxShadow: isMobileView && !sidebarCollapsed ? "4px 0 20px rgba(0,0,0,0.5)" : "none",
      }
    },

      // ── Ingeklapte rail ────────────────────────────────────────────────────
      sidebarCollapsed
        ? React.createElement("div", {
            style:{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:"10px",gap:"10px"}
          },
            // Uitklap-knop
            React.createElement("button", {
              onClick:()=>setSidebarCollapsed(false),
              title:"Filter notities",
              style:{background:"none",border:"none",cursor:"pointer",
                     color:W.fgMuted,fontSize:"16px",padding:"4px",
                     display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"}
            },
              React.createElement("span",null,"▶"),
              // teller badge
              React.createElement("span",{style:{
                fontSize:"10px",background:"rgba(138,198,242,0.15)",
                color:"#a8d8f0",borderRadius:"8px",padding:"1px 5px",
                border:"1px solid rgba(138,198,242,0.25)",lineHeight:"1.4",
                whiteSpace:"nowrap",
              }}, ctxNotes.length),
              tagFilter && React.createElement("span",{style:{
                fontSize:"9px",background:"rgba(159,202,86,0.2)",
                color:W.green,borderRadius:"8px",padding:"1px 4px",
                border:"1px solid rgba(159,202,86,0.35)",
              }},"F")
            )
          )

        // ── Uitgeklapte sidebar ──────────────────────────────────────────────
        : React.createElement(React.Fragment, null,
            // Header
            React.createElement("div", {
              style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,
                     padding:"10px 12px",flexShrink:0}
            },
              React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}},
                React.createElement("span", {style:{fontSize:"13px",fontWeight:"bold",
                  color:W.statusFg,letterSpacing:"1.5px",flex:1}}, "FILTER NOTITIES"),
                React.createElement("button", {
                  onClick:()=>setSidebarCollapsed(true),
                  title:"Sidebar inklappen",
                  style:{background:"none",border:"none",color:W.fgMuted,
                         fontSize:"14px",cursor:"pointer",padding:"2px 4px",lineHeight:1}
                }, "◀")
              ),
              // Context teller
              React.createElement("div",{style:{fontSize:"12px",color:"#a8d8f0",marginBottom:"8px",
                background:"rgba(138,198,242,0.08)",borderRadius:"4px",padding:"4px 8px",
                border:"1px solid rgba(138,198,242,0.2)"}},
                `📚 ${ctxNotes.length} notitie${ctxNotes.length!==1?"s":""} in context`
                + (tagFilter ? ` · filter: #${tagFilter}` : " · alle")
              ),
              // Tag-filter
              allNoteTags.length > 0 && React.createElement("div",null,
                React.createElement("span",{style:{fontSize:"9px",color:W.fgMuted,display:"block",
                  marginBottom:"4px",letterSpacing:"1px"}},"FILTER OP TAG:"),
                React.createElement(TagFilterBar,{tags:allNoteTags,activeTag:tagFilter,
                  onChange:setTagFilter,compact:true,maxVisible:6})
              )
            ),

            // Notities lijst
            React.createElement("div", {style:{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch", minHeight:0,}},

        // Notities sectie
        React.createElement("div", {
          style:{padding:"8px 10px 4px",fontSize:"11px",fontWeight:"600",color:"rgba(138,198,242,0.75)",
                 letterSpacing:"1.5px",borderBottom:`1px solid ${W.splitBg}`,
                 display:"flex",alignItems:"center",gap:"6px",background:W.bg}
        },
          React.createElement("span",null,"NOTITIES"),
          React.createElement("span",{style:{background:W.blue,color:W.bg,borderRadius:"8px",
            padding:"1px 6px",fontSize:"11px",fontWeight:"500",borderRadius:"4px",background:"rgba(138,198,242,0.1)"}},ctxNotes.length+"/"+filteredNotes.length)
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
              React.createElement("div",{style:{fontSize:"14px",color:sel?W.fg:W.fgDim,
                lineHeight:"1.3",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}, n.title),
              (n.tags||[]).length>0 && React.createElement("div",{style:{marginTop:"3px",display:"flex",gap:"3px",flexWrap:"wrap"}},
                (n.tags||[]).slice(0,3).map(t=>React.createElement("span",{key:t,
                  style:{fontSize:"11px",color:"#b8e06a",fontWeight:"500",
                         background:"rgba(159,202,86,0.12)",
                         borderRadius:"4px",padding:"1px 6px",lineHeight:"1.3",
                         border:"1px solid rgba(159,202,86,0.35)"}
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
                   letterSpacing:"1.5px",borderBottom:`1px solid ${W.splitBg}`,
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
              React.createElement("div",{style:{minWidth:0,fontSize:"14px",
                color:sel?W.fg:W.fgDim,overflow:"hidden",
                textOverflow:"ellipsis",whiteSpace:"nowrap"}},img.name)
            );
          })
        ),

        // PDF's sectie — alle PDFs tonen, ook zonder annotaties
        pdfsWithAnnots.length > 0 && React.createElement(React.Fragment, null,
          React.createElement("div", {
            style:{padding:"8px 10px 4px",fontSize:"9px",color:"rgba(229,120,109,0.6)",
                   letterSpacing:"1.5px",borderBottom:`1px solid ${W.splitBg}`,
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
                React.createElement("div",{style:{fontSize:"14px",color:sel?W.fg:W.fgDim,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}, "📄 "+p.name),
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,marginTop:"2px"}},
                  p.annotCount > 0
                    ? p.annotCount+" annotatie"+(p.annotCount!==1?"s":"")
                    : "geen annotaties — tekst via AI")
              )
            );
          })
        ),
      )   // einde notities-lijst div
    )     // einde React.Fragment (uitgeklapt)
    ),    // einde sidebar-div

    // ── Hoofd chat kolom ─────────────────────────────────────────────────────
    React.createElement("div", {
      style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0,minHeight:0}
    },

      // Chat toolbar
      React.createElement("div", {
        style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,
               padding:"6px 12px",display:"flex",alignItems:"center",
               gap:"8px",flexShrink:0,flexWrap:"wrap"}
      },
        // Filter-sidebar toggle (vervangt oude context-toggle)
        React.createElement("button", {
          onClick:()=>setSidebarCollapsed(p=>!p),
          title: sidebarCollapsed ? "Filter notities op tag" : "Sidebar inklappen",
          style:{background:!sidebarCollapsed?"rgba(138,198,242,0.15)":"rgba(255,255,255,0.04)",
                 border:`1px solid ${!sidebarCollapsed?"rgba(138,198,242,0.4)":W.splitBg}`,
                 color:!sidebarCollapsed?"#a8d8f0":W.fgMuted,
                 borderRadius:"5px",padding:"4px 10px",fontSize:"14px",cursor:"pointer",
                 display:"flex",alignItems:"center",gap:"6px"}
        },
          React.createElement("span",null, sidebarCollapsed ? "▶" : "◀"),
          React.createElement("span",null, "filter"),
          tagFilter && React.createElement("span",{style:{
            fontSize:"11px",background:"rgba(159,202,86,0.2)",color:W.green,
            borderRadius:"8px",padding:"1px 6px",border:"1px solid rgba(159,202,86,0.35)"
          }}, "#"+tagFilter)
        ),

        // Context badge — altijd zichtbaar
        React.createElement("span", {
          style:{fontSize:"14px",color:"#a8d8f0",background:"rgba(138,198,242,0.08)",
                 border:"1px solid rgba(138,198,242,0.2)",borderRadius:"10px",
                 padding:"2px 8px"}
        }, `📚 ${ctxNotes.length} notitie${ctxNotes.length!==1?"s":""}` +
           (ctxPdfs.length ? ` + ${ctxPdfs.length} PDF` : "") +
           (ctxExtPdfs.length ? ` + ${ctxExtPdfs.length} ext.` : "") +
           (tagFilter ? ` · #${tagFilter}` : "")
        ),

        // Externe PDF's knop
        React.createElement("button", {
          onClick:()=>{ setShowExtPanel(p=>!p); if(!showExtPanel) browseTo(""); },
          style:{background:showExtPanel?"rgba(180,140,255,0.2)":"none",
                 border:`1px solid ${showExtPanel?"rgba(180,140,255,0.5)":W.splitBg}`,
                 color:showExtPanel?"rgba(180,140,255,0.9)":W.fgMuted,
                 borderRadius:"5px",padding:"4px 10px",fontSize:"14px",cursor:"pointer",
                 display:"flex",alignItems:"center",gap:"5px"}
        },
          React.createElement("span",null,"📂"),
          "ext. PDF's",
          ctxExtPdfs.length>0 && React.createElement("span",{style:{
            background:"rgba(180,140,255,0.3)",borderRadius:"8px",
            padding:"0 5px",fontSize:"9px",color:"rgba(180,140,255,0.9)"}},
            ctxExtPdfs.length)
        ),

        React.createElement("div",{style:{flex:1}}),

        // Model badge — toont actief model (wijzigen via statusbalk)
        React.createElement("div",{
          style:{display:"flex",alignItems:"center",gap:"6px",
                 background:"rgba(255,255,255,0.04)",
                 border:`1px solid ${W.splitBg}`,
                 borderRadius:"6px",padding:"3px 10px",fontSize:"13px"}
        },
          React.createElement("div",{style:{width:"7px",height:"7px",borderRadius:"50%",
            background:statusDot.color,flexShrink:0,cursor:"pointer"},
            onClick:checkOllama,title:"Klik om opnieuw te verbinden"}),
          React.createElement("span",{style:{color:W.fgMuted}}, MODEL_LABEL(model) || model),
        ),

        // Install button als Ollama niet bereikbaar
        (ollamaStatus==="fout"||ollamaStatus==="geen-modellen") && React.createElement("button",{
          onClick:()=>setShowInstall(p=>!p),
          style:{background:"none",border:`1px solid ${W.orange}`,color:W.orange,
                 borderRadius:"4px",padding:"3px 8px",fontSize:"14px",cursor:"pointer"}
        },"? installatie"),

        // GraphRAG toggle
        React.createElement("button", {
          onClick:()=>setGraphRagMode(p=>!p),
          title: graphRagMode
            ? "GraphRAG actief — klik om uit te zetten"
            : "GraphRAG uit — klik om aan te zetten (AI gebruikt graaf-structuur als context)",
          style:{
            background: graphRagMode?"rgba(234,231,136,0.15)":"rgba(255,255,255,0.04)",
            border:`1px solid ${graphRagMode?"rgba(234,231,136,0.5)":W.splitBg}`,
            color: graphRagMode?W.yellow:W.fgMuted,
            borderRadius:"4px",padding:"3px 10px",fontSize:"14px",cursor:"pointer",
            display:"flex",alignItems:"center",gap:"5px",
            boxShadow: graphRagMode?"0 0 8px rgba(234,231,136,0.15)":"none",
            transition:"all 0.15s",
          }
        },
          React.createElement("span",{style:{fontSize:"13px"}},"🕸"),
          graphRagMode?"GraphRAG ✓":"GraphRAG"
        ),

        // Socratische modus toggle
        !graphRagMode && React.createElement("button", {
          onClick: () => setSocraticMode(p => !p),
          title: socraticMode
            ? "Socratische modus actief — AI stelt vragen i.p.v. antwoorden. Klik om uit te zetten."
            : "Zet Socratische modus aan — AI begeleidt je als leercoach (Feynman-techniek)",
          style: {
            background: socraticMode ? "rgba(215,135,255,0.15)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${socraticMode ? "rgba(215,135,255,0.5)" : W.splitBg}`,
            color: socraticMode ? W.purple : W.fgMuted,
            borderRadius: "4px", padding: "3px 10px", fontSize: "14px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "5px",
            boxShadow: socraticMode ? "0 0 8px rgba(215,135,255,0.15)" : "none",
            transition: "all 0.15s",
          }
        },
          React.createElement("span", {style:{fontSize:"13px"}}, "🏛"),
          socraticMode ? "Socratisch ✓" : "Socratisch"
        ),

        // Mindmap knop
        ctxNotes.length>0 && React.createElement("button", {
          onClick:generateMindmap, disabled:mmPending,
          style:{background:"rgba(138,198,242,0.08)",
                 border:"1px solid rgba(138,198,242,0.25)",
                 color:mmPending?W.fgMuted:"#a8d8f0",
                 borderRadius:"4px",padding:"3px 10px",fontSize:"14px",cursor:"pointer"}
        }, mmPending?"🗺 genereren…":"🗺 mindmap"),

        // Hiaat-analyse knop
        React.createElement("button", {
          onClick: runHiaatAnalyse,
          disabled: streaming,
          title:"Analyseer kennishiaten en zwakke verbindingen in je Zettelkasten",
          style:{
            background:"rgba(229,120,109,0.08)",
            border:"1px solid rgba(229,120,109,0.25)",
            color: streaming?W.fgMuted:W.orange,
            borderRadius:"4px",padding:"3px 10px",fontSize:"14px",cursor:"pointer",
            display:"flex",alignItems:"center",gap:"5px",
          }
        },
          React.createElement("span",{style:{fontSize:"13px"}},"🔍"),
          "hiaten"
        ),

        // Analyse → notitie
        messages.length>0 && onAddNote && React.createElement("button", {
          onClick:saveAnalysisAsNote, disabled:savingNote,
          style:{background:"rgba(159,202,86,0.08)",
                 border:"1px solid rgba(159,202,86,0.25)",
                 color:savingNote?W.fgMuted:W.comment,
                 borderRadius:"4px",padding:"3px 10px",fontSize:"14px",cursor:"pointer"}
        }, savingNote?"💾 opslaan…":"💾 → notitie"),

        // Clear
        messages.length > 0 && React.createElement("button", {
          onClick:clearChat,
          style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                 borderRadius:"4px",padding:"3px 8px",fontSize:"14px",cursor:"pointer"}
        }, "✕ wis chat")
      ),

      // Installatie instructies
      showInstall && React.createElement("div", {
        style:{background:"rgba(229,120,109,0.06)",borderBottom:`1px solid rgba(229,120,109,0.2)`,
               padding:"14px 16px",fontSize:"14px",flexShrink:0}
      },
        React.createElement("div",{style:{color:W.orange,fontWeight:"bold",marginBottom:"10px",
          fontSize:"14px"}},"Ollama installatie"),
        React.createElement("div",{style:{color:W.fgDim,marginBottom:"10px",lineHeight:"1.7"}},
          "Ollama draait lokale LLM modellen op je eigen machine. Geen internet vereist, volledig privé."
        ),
        // Stappen
        [
          { label:"1. Installeer Ollama", code:"curl -fsSL https://ollama.com/install.sh | sh" },
          { label:"2. Start de server",   code:"ollama serve" },
          { label:"3. Download een model (kies één):", code:null },
        ].map(({label,code},i) => React.createElement("div",{key:i,style:{marginBottom:"8px"}},
          React.createElement("div",{style:{fontSize:"14px",color:W.fgMuted,marginBottom:"3px"}},label),
          code && React.createElement("code",{style:{display:"block",background:"#1a1a1a",
            color:"#cae682",padding:"6px 10px",borderRadius:"4px",fontFamily:"'Hack',monospace",fontSize:"14px"}},code)
        )),
        // Model opties
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"6px",marginTop:"8px"}},
          SUGGESTED_MODELS.map(m => React.createElement("div",{key:m.id,
            style:{background:"rgba(0,0,0,0.2)",border:`1px solid ${W.splitBg}`,
                   borderRadius:"5px",padding:"7px 10px"}},
            React.createElement("code",{style:{color:"#cae682",fontSize:"14px",fontFamily:"'Hack',monospace"}},
              "ollama pull "+m.id),
            React.createElement("div",{style:{fontSize:"14px",color:W.fgMuted,marginTop:"3px"}},m.label+" — "+m.desc)
          ))
        ),
        React.createElement("button",{
          onClick:checkOllama,
          style:{marginTop:"12px",background:W.blue,color:W.bg,border:"none",
                 borderRadius:"5px",padding:"6px 16px",fontSize:"14px",cursor:"pointer",fontWeight:"bold"}
        },"🔄 Opnieuw verbinden")
      ),

      // Socratische modus indicator
      socraticMode && !graphRagMode && React.createElement("div", {
        style: {
          background: "rgba(215,135,255,0.06)",
          borderBottom: `1px solid rgba(215,135,255,0.2)`,
          padding: "7px 16px", flexShrink: 0,
          fontSize: "11px", color: W.purple,
          display: "flex", alignItems: "center", gap: "6px",
        }
      },
        "🏛 Socratische modus — de AI stelt vragen i.p.v. antwoorden te geven (Feynman-techniek)",
        React.createElement("button", {
          onClick: () => setSocraticMode(false),
          style: { marginLeft: "auto", background: "none", border: "none",
                   color: W.purple, cursor: "pointer", fontSize: "13px" }
        }, "×")
      ),

      // ── Chat berichten ──────────────────────────────────────────────────────
      React.createElement("div", {
        ref: chatAreaRef,
        onMouseUp: handleChatMouseUp,
        style:{flex:1,overflowY:"auto",padding:"16px",
               display:"flex",flexDirection:"column",gap:"12px",
               WebkitOverflowScrolling:"touch",
               position:"relative", minHeight:0,}
      },
        // Selectie-popup: zweeft boven geselecteerde tekst
        selectionPopup && React.createElement("div",{
          style:{
            position:"fixed",
            left: (chatAreaRef.current?.getBoundingClientRect().left||0) + selectionPopup.x,
            top:  (chatAreaRef.current?.getBoundingClientRect().top||0)  + selectionPopup.y,
            transform:"translate(-50%, -100%)",
            zIndex:200,
            background:W.bg3,
            border:`1px solid ${W.comment}`,
            borderRadius:"8px",
            boxShadow:"0 4px 16px rgba(0,0,0,0.5)",
            display:"flex",
            overflow:"hidden",
          }
        },
          React.createElement("button",{
            onMouseDown: e => { e.preventDefault(); pasteToNote(selectionPopup.text, MODEL_LABEL(model)||model); },
            style:{
              background:"none", border:"none",
              color:W.comment, padding:"7px 14px",
              fontSize:"13px", cursor:"pointer", fontWeight:"bold",
              display:"flex", alignItems:"center", gap:"6px",
              whiteSpace:"nowrap",
            }
          },
            React.createElement("span",null,"↙"),
            "plak selectie in notitie"
          ),
          React.createElement("div",{style:{width:"1px",background:W.splitBg}}),
          React.createElement("button",{
            onMouseDown: e => { e.preventDefault(); setSelectionPopup(null); window.getSelection()?.removeAllRanges(); },
            style:{background:"none",border:"none",color:W.fgDim,padding:"7px 10px",fontSize:"14px",cursor:"pointer"}
          },"✕")
        ),
        // Welkomstbericht als er geen berichten zijn
        messages.length === 0 && React.createElement("div", {
          style:{display:"flex",flexDirection:"column",alignItems:"center",
                 justifyContent:"center",height:"100%",gap:"16px",
                 color:W.fgMuted,textAlign:"center",padding:"0 24px"}
        },
          React.createElement("div",{style:{fontSize:"48px"}},"🧠"),
          React.createElement("div",{style:{fontSize:"16px",color:W.fgDim,fontWeight:"bold"}},
            "Notebook LLM"),
          React.createElement("div",{style:{fontSize:"14px",maxWidth:"420px",lineHeight:"1.8"}},
            "Stel vragen over je notities en PDF-annotaties. " +
            "Selecteer context in het linkerpaneel om de LLM kennis te geven over je zettelkasten."
          ),
          // Split-modus tip als onPasteToNote beschikbaar is
          onPasteToNote && React.createElement("div",{
            style:{display:"flex",alignItems:"center",gap:"10px",
                   background:"rgba(159,202,86,0.08)",
                   border:"1px solid rgba(159,202,86,0.25)",
                   borderRadius:"10px",padding:"10px 16px",
                   fontSize:"13px",color:W.comment,maxWidth:"420px"}
          },
            React.createElement("span",{style:{fontSize:"20px",flexShrink:0}},"↙"),
            React.createElement("span",null,
              "Split-modus actief — hover over een antwoord en klik ",
              React.createElement("strong",null,"↙ plak in notitie"),
              ", of selecteer tekst voor een gedeeltelijk citaat."
            )
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
                     fontSize:"14px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}
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
          // Bericht bubble + plak-knop wrapper
          React.createElement("div",{
            style:{maxWidth:"85%", position:"relative"},
            className:"chat-msg-wrap",
          },
            // Bericht bubble
            React.createElement("div",{style:{
              background: msg.role==="user"
                ? "rgba(138,198,242,0.12)"
                : msg.error ? "rgba(229,120,109,0.1)" : W.bg2,
              border: msg.role==="user"
                ? "1px solid rgba(138,198,242,0.25)"
                : msg.error ? "1px solid rgba(229,120,109,0.3)" : `1px solid ${W.splitBg}`,
              borderRadius: msg.role==="user" ? "12px 12px 3px 12px" : "3px 12px 12px 12px",
              padding:"10px 14px",
              fontSize:"14px",
              lineHeight:"1.7",
              color: msg.error ? W.orange : W.fg,
            }},
              msg.error
                ? React.createElement("div",null,
                    React.createElement("div",{style:{fontWeight:"bold",marginBottom:"5px"}},"⚠ Fout"),
                    React.createElement("div",{style:{fontSize:"14px"}},msg.error),
                    React.createElement("button",{onClick:checkOllama,
                      style:{marginTop:"8px",background:"none",border:`1px solid ${W.orange}`,
                             color:W.orange,borderRadius:"4px",padding:"3px 8px",
                             fontSize:"14px",cursor:"pointer"}},"Ollama status controleren")
                  )
                : msg.role==="user"
                  ? React.createElement("div",null,msg.content)
                  : React.createElement("div",{
                      dangerouslySetInnerHTML:{__html:renderMsg(msg.content)+(msg.streaming?"<span style='color:#8ac6f2;animation:blink 1s infinite'>▊</span>":"")}
                    })
            ),
            // Plak-knop — alleen voor assistant berichten als onPasteToNote beschikbaar + niet streaming
            onPasteToNote && msg.role==="assistant" && !msg.streaming && msg.content && React.createElement("div",{
              className:"chat-paste-btn",
              style:{
                position:"absolute", bottom:"-1px", right:"-1px",
                opacity:0, transition:"opacity 0.15s",
                display:"flex", gap:"4px",
              }
            },
              // Plak volledig bericht
              React.createElement("button",{
                onClick:()=>pasteToNote(msg.content, MODEL_LABEL(model)||model),
                title:"Plak volledig antwoord in de actieve notitie",
                style:{
                  background:W.bg3, border:`1px solid ${W.splitBg}`,
                  color:W.comment, borderRadius:"0 0 10px 6px",
                  padding:"3px 10px", fontSize:"12px", cursor:"pointer",
                  display:"flex", alignItems:"center", gap:"4px",
                  whiteSpace:"nowrap",
                }
              },
                React.createElement("span",null,"↙"),
                "plak in notitie"
              )
            )
          )
        )),
        React.createElement("div",{ref:chatEndRef})
      ),

      // ── Invoerbalk ─────────────────────────────────────────────────────────
      React.createElement("div", {
        style:{borderTop:`1px solid ${graphRagMode?"rgba(234,231,136,0.3)":W.splitBg}`,
               padding:"12px", background:W.bg, flexShrink:0,
               boxShadow: graphRagMode?"0 -2px 12px rgba(234,231,136,0.06)":"none",
               transition:"all 0.2s"}
      },
        // GraphRAG actief-banner
        graphRagMode && React.createElement("div",{
          style:{display:"flex",alignItems:"center",gap:"8px",
                 marginBottom:"8px",padding:"6px 10px",
                 background:"rgba(234,231,136,0.07)",
                 border:"1px solid rgba(234,231,136,0.2)",
                 borderRadius:"6px",fontSize:"12px",color:W.yellow}
        },
          React.createElement("span",null,"🕸"),
          React.createElement("span",null,
            "GraphRAG actief — je vraag gebruikt de volledige kennisgraaf als context"
          ),
          React.createElement("span",{
            onClick:()=>setGraphRagMode(false),
            style:{marginLeft:"auto",cursor:"pointer",color:W.fgDim,fontSize:"14px"}
          },"✕")
        ),
        React.createElement("div",{style:{display:"flex",gap:"8px",alignItems:"flex-end"}},
          React.createElement("textarea",{
            ref:inputRef,
            value:input,
            onChange:e=>setInput(e.target.value),
            onKeyDown:handleKeyDown,
            placeholder: graphRagMode
              ? "Stel een vraag over je volledige kennisbasis… (GraphRAG)"
              : ollamaStatus==="ok"
                ? "Stel een vraag… (Enter=verstuur · Shift+Enter=nieuwe regel)"
                : "Start Ollama om vragen te stellen…",
            disabled: streaming || ollamaStatus==="laden",
            rows:1,
            style:{
              flex:1,background:W.bg2,
              border:`1px solid ${graphRagMode?"rgba(234,231,136,0.35)":W.splitBg}`,
              borderRadius:"8px",padding:"10px 14px",color:W.fg,
              fontSize:"14px",outline:"none",resize:"none",
              lineHeight:"1.5",maxHeight:"120px",overflowY:"auto",
              WebkitAppearance:"none",
              opacity: (streaming||ollamaStatus==="laden") ? 0.6 : 1,
              transition:"border-color 0.2s",
            },
            onInput:(e)=>{
              e.target.style.height="auto";
              e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";
            }
          }),
          React.createElement("button",{
            onClick: streaming ? ()=>{} : send,
            disabled: !input.trim() || (ollamaStatus!=="ok" && !graphRagMode),
            style:{
              background: streaming ? W.fgMuted : graphRagMode ? W.yellow : W.blue,
              color: graphRagMode ? W.bg : W.bg,
              border:"none",borderRadius:"8px",
              padding:"10px 16px",fontSize:"14px",cursor: streaming?"not-allowed":"pointer",
              fontWeight:"bold",flexShrink:0,alignSelf:"flex-end",
              height:"40px",minWidth:"64px",
              opacity: (!input.trim()) ? 0.5 : 1,
              transition:"background 0.2s",
            }
          }, streaming ? "⏳" : graphRagMode ? "🕸 Ask" : "↑ Send")
        ),
        // Context hint — altijd tonen
        React.createElement("div",{
          style:{marginTop:"6px",fontSize:"11px",color:graphRagMode?W.yellow:W.fgMuted,
                 display:"flex",alignItems:"center",gap:"6px"}
        },
          React.createElement("span",null,
            graphRagMode
              ? `🕸 GraphRAG · ${ctxNotes.length} notitie${ctxNotes.length!==1?"s":""} + graafstructuur`
              : `📚 ${ctxNotes.length} notitie${ctxNotes.length!==1?"s":""}` +
                (ctxPdfs.length?` + ${ctxPdfs.length} PDF`:"") +
                (ctxExtPdfs.length?` + ${ctxExtPdfs.length} ext.`:"") +
                " meegestuurd" +
                (tagFilter?` · filter: #${tagFilter}`:"")
          )
        )
      )
    ),

    // ── Rechter zijbalk: Externe PDF's ──────────────────────────────────────
    showExtPanel && React.createElement("div", {
      style:{
        width:"300px", flexShrink:0, background:W.bg2,
        borderLeft:`1px solid ${W.splitBg}`,
        display:"flex", flexDirection:"column", overflow:"hidden",
      }
    },

      // Header
      React.createElement("div",{style:{
        padding:"10px 12px", borderBottom:`1px solid ${W.splitBg}`,
        flexShrink:0, background:W.bg2
      }},
        React.createElement("div",{style:{display:"flex",alignItems:"center",marginBottom:"8px"}},
          React.createElement("span",{style:{
            fontSize:"14px",fontWeight:"bold",color:"rgba(180,140,255,0.9)",
            letterSpacing:"1.5px",flex:1
          }},"📂 EXTERNE PDF'S"),
          React.createElement("button",{
            onClick:()=>setShowExtPanel(false),
            style:{background:"none",border:"none",color:W.fgMuted,
                   fontSize:"18px",cursor:"pointer",padding:"0 2px",lineHeight:1}
          },"×")
        ),
        // Modus tabs
        React.createElement("div",{style:{display:"flex",gap:"4px",marginBottom:"8px"}},
          ["dirs","browser"].map(m=>
            React.createElement("button",{key:m,
              onClick:()=>{ setBrowseMode(m); if(m==="browser") browseTo(browsePath||""); },
              style:{flex:1,background:browseMode===m?"rgba(180,140,255,0.15)":"none",
                     border:`1px solid ${browseMode===m?"rgba(180,140,255,0.4)":W.splitBg}`,
                     borderRadius:"4px",padding:"4px 0",fontSize:"11px",cursor:"pointer",
                     color:browseMode===m?"rgba(180,140,255,0.9)":W.fgMuted}
            }, m==="dirs" ? "📋 Mijn mappen" : "🗂 Bladeren")
          )
        ),

        // Geselecteerde teller + wis
        ctxExtPdfs.length > 0 && React.createElement("div",{style:{
          display:"flex",alignItems:"center",gap:"6px",
          background:"rgba(180,140,255,0.08)",border:"1px solid rgba(180,140,255,0.2)",
          borderRadius:"5px",padding:"4px 8px"
        }},
          React.createElement("span",{style:{fontSize:"11px",color:"rgba(180,140,255,0.8)",flex:1}},
            ctxExtPdfs.length+" PDF"+(ctxExtPdfs.length>1?"'s":"")+" geselecteerd"),
          React.createElement("button",{
            onClick:()=>setCtxExtPdfs([]),
            style:{background:"none",border:"none",color:W.orange,
                   fontSize:"11px",cursor:"pointer",padding:0}
          },"× wis")
        )
      ),

      // ── MODUS: Mijn mappen ──────────────────────────────────────────────
      browseMode==="dirs" && React.createElement("div",{
        style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}
      },
        // Pad toevoegen
        React.createElement("div",{style:{padding:"8px 10px",borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}},
          React.createElement("div",{style:{fontSize:"9px",color:"rgba(180,140,255,0.5)",
            letterSpacing:"1px",marginBottom:"5px"}},"MAP TOEVOEGEN"),
          React.createElement("div",{style:{display:"flex",gap:"4px"}},
            React.createElement("input",{
              value:newExtDir, onChange:e=>setNewExtDir(e.target.value),
              placeholder:"/pad/naar/map",
              onKeyDown:e=>{ if(e.key==="Enter"&&newExtDir.trim()){
                saveExtDirs([...extPdfDirs,newExtDir.trim()]); setNewExtDir("");
              }},
              style:{flex:1,background:W.bg,border:`1px solid rgba(180,140,255,0.3)`,
                     borderRadius:"4px",padding:"5px 7px",color:"rgba(180,140,255,0.8)",
                     fontSize:"11px",outline:"none",fontFamily:"'Hack',monospace"}
            }),
            React.createElement("button",{
              onClick:()=>{ if(!newExtDir.trim()) return;
                saveExtDirs([...extPdfDirs,newExtDir.trim()]); setNewExtDir(""); },
              style:{background:"rgba(180,140,255,0.15)",border:"1px solid rgba(180,140,255,0.3)",
                     borderRadius:"4px",padding:"5px 10px",color:"rgba(180,140,255,0.8)",
                     fontSize:"13px",cursor:"pointer"}
            },"+"),
            React.createElement("button",{
              onClick:loadExtPdfs, disabled:extPdfLoading,
              title:"Vernieuwen",
              style:{background:"none",border:`1px solid ${W.splitBg}`,
                     borderRadius:"4px",padding:"5px 7px",color:W.fgMuted,
                     fontSize:"11px",cursor:"pointer"}
            }, extPdfLoading?"…":"↻")
          )
        ),

        // Geconfigureerde mappen
        extPdfDirs.length > 0 && React.createElement("div",{
          style:{padding:"6px 10px",borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}
        },
          extPdfDirs.map((d,i)=>
            React.createElement("div",{key:i,style:{display:"flex",alignItems:"center",
              gap:"5px",padding:"3px 0",borderBottom:`1px solid rgba(255,255,255,0.03)`}},
              React.createElement("span",{
                onClick:()=>{ setBrowseMode("browser"); browseTo(d); },
                style:{flex:1,fontSize:"10px",color:"rgba(180,140,255,0.7)",
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                  fontFamily:"'Hack',monospace",cursor:"pointer",
                  padding:"2px 0",
                  textDecoration:"underline",textDecorationColor:"rgba(180,140,255,0.3)"}
              }, "📁 "+d),
              React.createElement("button",{
                onClick:()=>saveExtDirs(extPdfDirs.filter((_,j)=>j!==i)),
                style:{background:"none",border:"none",color:W.orange,
                       fontSize:"12px",cursor:"pointer",padding:"0 2px",flexShrink:0}
              },"×")
            )
          )
        ),

        // Zoekbalk
        React.createElement("div",{style:{padding:"6px 10px",borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}},
          React.createElement("input",{
            value:extPdfSearch, onChange:e=>setExtPdfSearch(e.target.value),
            placeholder:"🔍 PDF zoeken in mappen…",
            style:{width:"100%",background:W.bg,
                   border:`1px solid ${extPdfSearch?"rgba(180,140,255,0.5)":W.splitBg}`,
                   borderRadius:"4px",padding:"5px 8px",color:W.fg,
                   fontSize:"11px",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}
          })
        ),

        // PDF-lijst
        React.createElement("div",{style:{flex:1,overflowY:"auto", minHeight:0, WebkitOverflowScrolling:"touch",}},
          (() => {
            const filtered = extPdfFiles.filter(f=>
              !extPdfSearch||f.name.toLowerCase().includes(extPdfSearch.toLowerCase()));
            if(filtered.length===0) return React.createElement("div",{style:{
              padding:"20px",fontSize:"11px",color:W.fgMuted,textAlign:"center",lineHeight:"1.8"}},
              extPdfDirs.length===0 ? "Voeg een map toe\nom PDF's te laden"
              : extPdfLoading ? "Laden…"
              : extPdfSearch ? "Geen resultaten"
              : "Geen PDF's gevonden");
            return filtered.map(f => {
              const sel = ctxExtPdfs.includes(f.path);
              return React.createElement("div",{key:f.path,
                onClick:()=>setCtxExtPdfs(prev=>sel?prev.filter(x=>x!==f.path):[...prev,f.path]),
                style:{padding:"7px 12px",borderBottom:`1px solid rgba(255,255,255,0.03)`,
                       cursor:"pointer",display:"flex",alignItems:"flex-start",gap:"8px",
                       background:sel?"rgba(180,140,255,0.1)":"transparent",
                       borderLeft:`3px solid ${sel?"rgba(180,140,255,0.6)":"transparent"}`}
              },
                React.createElement("div",{style:{width:"15px",height:"15px",borderRadius:"3px",
                  flexShrink:0,marginTop:"1px",
                  background:sel?"rgba(180,140,255,0.3)":"transparent",
                  border:`1.5px solid ${sel?"rgba(180,140,255,0.7)":"rgba(255,255,255,0.15)"}`,
                  display:"flex",alignItems:"center",justifyContent:"center"}},
                  sel&&React.createElement("span",{style:{fontSize:"10px",
                    color:"rgba(180,140,255,1)",lineHeight:1,fontWeight:"bold"}},"✓")),
                React.createElement("div",{style:{minWidth:0,flex:1}},
                  React.createElement("div",{style:{fontSize:"12px",
                    color:sel?"rgba(180,140,255,0.95)":W.fgDim,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
                    "📄 "+f.name),
                  React.createElement("div",{style:{fontSize:"9px",color:"rgba(180,140,255,0.35)",
                    marginTop:"1px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                    fontFamily:"'Hack',monospace"}},
                    f.path.replace(f.name,""))
                )
              );
            });
          })()
        )
      ),

      // ── MODUS: Bladeren ─────────────────────────────────────────────────
      browseMode==="browser" && React.createElement("div",{
        style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}
      },
        // Pad-broodkruimel + terug
        React.createElement("div",{style:{
          padding:"6px 10px",borderBottom:`1px solid ${W.splitBg}`,
          flexShrink:0,display:"flex",alignItems:"center",gap:"6px"
        }},
          browseParent !== "" && React.createElement("button",{
            onClick:()=>browseTo(browseParent),
            style:{background:"none",border:`1px solid ${W.splitBg}`,borderRadius:"4px",
                   padding:"3px 8px",color:W.fgMuted,fontSize:"13px",cursor:"pointer",
                   flexShrink:0}
          },"← terug"),
          browsePath==="" && React.createElement("button",{
            onClick:()=>browseTo(""),
            style:{background:"none",border:`1px solid ${W.splitBg}`,borderRadius:"4px",
                   padding:"3px 8px",color:W.fgMuted,fontSize:"13px",cursor:"pointer"}
          },"🏠 roots"),
          React.createElement("span",{style:{
            fontSize:"10px",color:"rgba(180,140,255,0.5)",overflow:"hidden",
            textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,
            fontFamily:"'Hack',monospace"
          }}, browsePath||"Kies een map"),
          browseLoading && React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted}},"⏳")
        ),

        // Selecteer hele map als PDF-bron
        browsePath && React.createElement("div",{style:{
          padding:"5px 10px",borderBottom:`1px solid ${W.splitBg}`,
          flexShrink:0,display:"flex",gap:"6px"
        }},
          React.createElement("button",{
            onClick:()=>{
              if(!extPdfDirs.includes(browsePath))
                saveExtDirs([...extPdfDirs, browsePath]);
            },
            disabled:extPdfDirs.includes(browsePath),
            style:{flex:1,background:"rgba(180,140,255,0.1)",
                   border:"1px solid rgba(180,140,255,0.3)",borderRadius:"4px",
                   padding:"4px 0",fontSize:"10px",
                   color:extPdfDirs.includes(browsePath)?"rgba(180,140,255,0.35)":"rgba(180,140,255,0.8)",
                   cursor:extPdfDirs.includes(browsePath)?"default":"pointer"}
          }, extPdfDirs.includes(browsePath)?"✓ Map al toegevoegd":"＋ Voeg map toe als bron")
        ),

        // Foutmelding
        browseError && React.createElement("div",{style:{
          margin:"8px 10px",padding:"8px 10px",
          background:"rgba(229,120,109,0.1)",border:"1px solid rgba(229,120,109,0.3)",
          borderRadius:"5px",fontSize:"11px",color:W.orange,lineHeight:"1.5"
        }}, "⚠ "+browseError),

        // Bestanden & mappen lijst
        React.createElement("div",{style:{flex:1,overflowY:"auto", minHeight:0, WebkitOverflowScrolling:"touch",}},
          browseLoading
            ? React.createElement("div",{style:{padding:"20px",fontSize:"11px",
                color:W.fgMuted,textAlign:"center"}},"⏳ Laden…")
            : browseItems.length===0 && !browseError
              ? React.createElement("div",{style:{padding:"20px",fontSize:"11px",
                  color:W.fgMuted,textAlign:"center",lineHeight:"1.8"}},
                  "Klik op een map om te bladeren,\nof klik 🏠 om te starten")
              : browseItems.map((item,i)=>{
                  const isPdf = item.type==="pdf";
                  const isDir = item.type==="dir";
                  const sel   = isPdf && ctxExtPdfs.includes(item.path);
                  return React.createElement("div",{key:item.path+i,
                    onClick:()=>{
                      if(isDir) browseTo(item.path);
                      else if(isPdf)
                        setCtxExtPdfs(prev=>sel?prev.filter(x=>x!==item.path):[...prev,item.path]);
                    },
                    style:{padding:"7px 12px",
                           borderBottom:`1px solid rgba(255,255,255,0.03)`,
                           cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",
                           background:sel?"rgba(180,140,255,0.1)":"transparent",
                           borderLeft:`3px solid ${sel?"rgba(180,140,255,0.6)":"transparent"}`,
                    }
                  },
                    // Checkbox voor PDFs, map-icon voor dirs
                    isPdf
                      ? React.createElement("div",{style:{width:"15px",height:"15px",
                          borderRadius:"3px",flexShrink:0,
                          background:sel?"rgba(180,140,255,0.3)":"transparent",
                          border:`1.5px solid ${sel?"rgba(180,140,255,0.7)":"rgba(255,255,255,0.15)"}`,
                          display:"flex",alignItems:"center",justifyContent:"center"}},
                          sel&&React.createElement("span",{style:{fontSize:"10px",
                            color:"rgba(180,140,255,1)",lineHeight:1,fontWeight:"bold"}},"✓"))
                      : React.createElement("span",{style:{fontSize:"15px",flexShrink:0}},"📁"),

                    React.createElement("div",{style:{minWidth:0,flex:1}},
                      React.createElement("div",{style:{
                        fontSize:"12px",
                        color: sel?"rgba(180,140,255,0.95)":isDir?W.fg:W.fgDim,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                        fontWeight:isDir?"500":"normal"
                      }}, item.name),
                      React.createElement("div",{style:{fontSize:"9px",
                        color:"rgba(180,140,255,0.35)",marginTop:"1px"}},
                        isPdf && item.size ? Math.round(item.size/1024)+" KB" : "")
                    ),
                    isDir && React.createElement("span",{style:{color:W.fgMuted,fontSize:"13px",
                      flexShrink:0}}, "›")
                  );
                })
        )
      )
    )
  );
};


// Streaming cursor animatie
if(!document.getElementById("llm-css")){
  const s=document.createElement("style");
  s.id="llm-css";
  s.textContent=`
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    .chat-msg-wrap:hover .chat-paste-btn { opacity: 1 !important; }
    .chat-paste-btn button:hover { background: rgba(159,202,86,0.15) !important; color: #9fca56 !important; }
  `;
  document.head.appendChild(s);
}

// ── MarkdownWithMermaid ───────────────────────────────────────────────────────
// Rendert markdown maar vervangt mermaid-mindmap blokken door MermaidPreviewBlock.
const MarkdownWithMermaid = ({ content, notes, renderMode, isMobile, onClick, onEditMermaid }) => {
  const html = renderMd(content, notes);

  // Splits HTML op mermaid placeholders
  const MARKER = /<div class="mermaid-mindmap-block" data-mermaid="([^"]+)"><\/div>/g;
  const parts  = [];
  let last = 0, m;
  while ((m = MARKER.exec(html)) !== null) {
    if (m.index > last)
      parts.push({ type:"html", html: html.slice(last, m.index) });
    const code = m[1]
      .replace(/&amp;/g,"&")
      .replace(/&quot;/g,'"')
      .replace(/&#10;/g,"\n");
    parts.push({ type:"mermaid", code });
    last = m.index + m[0].length;
  }
  if (last < html.length) parts.push({ type:"html", html: html.slice(last) });

  const mdStyle = {
    fontSize:   renderMode==="rich" ? (isMobile?"17px":"15px") : (isMobile?"15px":"13px"),
    lineHeight: renderMode==="rich" ? "2.0" : (isMobile?"1.9":"1.85"),
    maxWidth:   renderMode==="rich" ? "720px" : "none",
    margin:     renderMode==="rich" ? "0 auto" : "0",
    fontFamily: renderMode==="rich" ? "'Georgia','Times New Roman',serif" : "inherit",
  };

  return React.createElement("div", { style: mdStyle, onClick },
    parts.map((p, i) => {
      if (p.type === "mermaid") {
        return React.createElement(MermaidPreviewBlock, {
          key: i,
          code: p.code,
          onEdit: onEditMermaid ? () => onEditMermaid(p.code) : null,
        });
      }
      return React.createElement("div", {
        key: i,
        className: renderMode==="rich" ? "mdv mdv-rich" : "mdv",
        dangerouslySetInnerHTML: { __html: p.html },
      });
    })
  );
};

// ── FuzzySearch ────────────────────────────────────────────────────────────────
// FZF-stijl zoeken over notities én vault-PDFs (per pagina + regelnummer).
// Resultaten zijn inline bewerkbaar en opslaan als Zettelkasten notitie.

// ── SearchViewer ───────────────────────────────────────────────────────────────
// Canvas-gebaseerde viewer voor zoekresultaten.
// Features: regelnummers (relatief), zoekterm highlight, vim-navigatie,
//           tekstselectie, kopiëren naar clipboard.

const SearchViewer = ({ content="", query="", onPasteToNote=null, noteName="", initialRow=0 }) => {
  const { useRef, useEffect, useState, useCallback } = React;
  const cvRef    = useRef(null);
  const stateRef = useRef({
    lines:    [],
    scroll:   0,
    curRow:   0,
    selA:     null,  // {row,col}
    selB:     null,  // {row,col}
    selecting:false,
    charW:    7.8,
    visRows:  30,
  });
  const blinkRef = useRef(null);
  const blinkOn  = useRef(true);
  const rafRef   = useRef(null);
  const [status, setStatus] = useState("");
  const [relNums, setRelNums] = useState(true);

  const FONT  = 13;
  const LH    = 20;
  const PAD   = 6;
  const NW    = 42; // regelnummer breedte

  // Bouw match-posities op
  const buildMatches = useCallback((lines, q) => {
    if (!q.trim()) return [];
    const term = q.toLowerCase();
    const out  = [];
    lines.forEach((line, row) => {
      let i = 0, lc = line.toLowerCase();
      while ((i = lc.indexOf(term, i)) >= 0) {
        out.push({ row, col: i, len: term.length });
        i += term.length;
      }
    });
    return out;
  }, []);

  const draw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const cv = cvRef.current; if (!cv) return;
      const ctx = cv.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const CW  = cv.width / dpr;
      const CH  = cv.height / dpr;
      const s   = stateRef.current;
      const { lines, scroll, curRow, selA, selB } = s;

      ctx.font         = `${FONT}px 'Hack','Courier New',monospace`;
      ctx.textBaseline = "top";

      // Achtergrond
      ctx.fillStyle = W.bg;
      ctx.fillRect(0, 0, CW, CH);

      // Cursorline
      const cyPos = (curRow - scroll) * LH;
      if (curRow >= scroll && curRow < scroll + s.visRows) {
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        ctx.fillRect(0, cyPos, CW, LH);
      }

      // Regelnummer achtergrond
      ctx.fillStyle = W.lineNrBg;
      ctx.fillRect(0, 0, NW, CH);
      ctx.fillStyle = W.splitBg;
      ctx.fillRect(NW, 0, 1, CH);

      // Match-posities
      const matches = buildMatches(lines, query);
      const matchSet = {};
      matches.forEach(m => {
        const k = `${m.row}`;
        if (!matchSet[k]) matchSet[k] = [];
        matchSet[k].push(m);
      });

      // Selectie bereik normaliseren
      let selStart = null, selEnd = null;
      if (selA && selB) {
        const aRow = selA.row, bRow = selB.row;
        if (aRow < bRow || (aRow === bRow && selA.col <= selB.col)) {
          selStart = selA; selEnd = selB;
        } else {
          selStart = selB; selEnd = selA;
        }
      }

      // Regels tekenen
      for (let i = 0; i <= s.visRows && scroll + i < lines.length; i++) {
        const li   = scroll + i;
        const y    = i * LH;
        const line = lines[li];
        const isCur = li === curRow;

        // Regelnummer
        ctx.textAlign = "right";
        ctx.fillStyle = isCur ? W.yellow : W.fgMuted;
        ctx.font      = isCur
          ? `bold ${FONT}px 'Hack','Courier New',monospace`
          : `${FONT}px 'Hack','Courier New',monospace`;
        const nr = relNums && !isCur ? Math.abs(li - curRow) : li + 1;
        ctx.fillText(String(nr), NW - 4, y + 4);
        ctx.textAlign = "left";
        ctx.font      = `${FONT}px 'Hack','Courier New',monospace`;

        // Selectie highlight
        if (selStart && selEnd) {
          const inSel = (li > selStart.row && li < selEnd.row) ||
            (li === selStart.row && li === selEnd.row) ||
            (li === selStart.row && li !== selEnd.row) ||
            (li === selEnd.row && li !== selStart.row);
          if (inSel) {
            let sc = 0, ec = line.length;
            if (li === selStart.row) sc = selStart.col;
            if (li === selEnd.row)   ec = selEnd.col;
            if (li === selStart.row && li === selEnd.row) { sc = selStart.col; ec = selEnd.col; }
            ctx.fillStyle = "rgba(85,77,75,0.7)";
            ctx.fillRect(NW + PAD + sc * s.charW, y, (ec - sc) * s.charW, LH);
          }
        }

        // Zoekterm highlights
        if (matchSet[li]) {
          matchSet[li].forEach(m => {
            ctx.fillStyle = "rgba(234,231,136,0.35)";
            ctx.fillRect(NW + PAD + m.col * s.charW, y + 2, m.len * s.charW, LH - 4);
          });
        }

        // Tekst
        ctx.fillStyle = isCur ? W.fg : W.fgDim;
        ctx.fillText(line, NW + PAD, y + 4);
      }

      // Cursor (blinkend streepje)
      if (curRow >= scroll && curRow < scroll + s.visRows && blinkOn.current) {
        ctx.fillStyle = W.yellow;
        ctx.fillRect(NW + PAD - 2, (curRow - scroll) * LH + 2, 2, LH - 4);
      }
    });
  }, [query, relNums, buildMatches]);

  // Setup canvas
  useEffect(() => {
    const cv  = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    ctx.font  = `${FONT}px 'Hack','Courier New',monospace`;
    stateRef.current.charW = ctx.measureText("M").width;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const p   = cv.parentElement;
      cv.width  = p.offsetWidth  * dpr;
      cv.height = p.offsetHeight * dpr;
      cv.style.width  = p.offsetWidth  + "px";
      cv.style.height = p.offsetHeight + "px";
      ctx.scale(dpr, dpr);
      stateRef.current.visRows = Math.floor(p.offsetHeight / LH) - 1;
      draw();
    };
    const ro = new ResizeObserver(() => { ctx.scale(1,1); resize(); });
    ro.observe(cv.parentElement);
    requestAnimationFrame(resize);

    blinkRef.current = setInterval(() => { blinkOn.current = !blinkOn.current; draw(); }, 530);

    // Muisselectie
    const onMouseDown = (e) => {
      const r   = cv.getBoundingClientRect();
      const s   = stateRef.current;
      const row = Math.min(s.lines.length-1,
        Math.max(0, Math.floor((e.clientY - r.top) / LH) + s.scroll));
      const col = Math.max(0,
        Math.round((e.clientX - r.left - NW - PAD) / s.charW));
      s.curRow   = row;
      s.selA     = {row, col};
      s.selB     = {row, col};
      s.selecting = true;
      scrollToCur(s);
      draw();
    };
    const onMouseMove = (e) => {
      const s = stateRef.current;
      if (!s.selecting) return;
      const r   = cv.getBoundingClientRect();
      const row = Math.min(s.lines.length-1,
        Math.max(0, Math.floor((e.clientY - r.top) / LH) + s.scroll));
      const col = Math.max(0,
        Math.round((e.clientX - r.left - NW - PAD) / s.charW));
      s.selB = {row, col};
      draw();
    };
    const onMouseUp = () => { stateRef.current.selecting = false; };

    cv.addEventListener("mousedown", onMouseDown);
    cv.addEventListener("mousemove", onMouseMove);
    cv.addEventListener("mouseup",   onMouseUp);
    cv.setAttribute("tabIndex", 0);

    return () => {
      ro.disconnect();
      clearInterval(blinkRef.current);
      cancelAnimationFrame(rafRef.current);
      cv.removeEventListener("mousedown", onMouseDown);
      cv.removeEventListener("mousemove", onMouseMove);
      cv.removeEventListener("mouseup",   onMouseUp);
    };
  }, [draw]);

  // Update lines als content verandert — spring naar eerste zoekterm match
  useEffect(() => {
    const lines = content.split("\n");
    stateRef.current.lines  = lines;
    stateRef.current.selA   = null;
    stateRef.current.selB   = null;
    // Spring naar eerste treffer als er een zoekopdracht is
    if (query.trim()) {
      const term = query.toLowerCase();
      let firstMatch = initialRow;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(term)) { firstMatch = i; break; }
      }
      stateRef.current.curRow = firstMatch;
      stateRef.current.scroll = Math.max(0, firstMatch - 3);
    } else {
      stateRef.current.curRow = initialRow;
      stateRef.current.scroll = Math.max(0, initialRow - 3);
    }
    draw();
  }, [content, query, initialRow, draw]);

  const scrollToCur = (s) => {
    if (s.curRow < s.scroll) s.scroll = s.curRow;
    if (s.curRow >= s.scroll + s.visRows) s.scroll = s.curRow - s.visRows + 1;
    s.scroll = Math.max(0, s.scroll);
  };

  // Vim navigatie + match springing
  const handleKey = useCallback((e) => {
    const s = stateRef.current;
    const matches = buildMatches(s.lines, query);

    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      if (s.curRow < s.lines.length - 1) s.curRow++;
      scrollToCur(s); draw(); return;
    }
    if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      if (s.curRow > 0) s.curRow--;
      scrollToCur(s); draw(); return;
    }
    if (e.key === "g") { e.preventDefault(); s.curRow = 0; s.scroll = 0; draw(); return; }
    if (e.key === "G") { e.preventDefault(); s.curRow = s.lines.length-1; scrollToCur(s); draw(); return; }
    if (e.key === "n" && matches.length) {
      e.preventDefault();
      const next = matches.find(m => m.row > s.curRow) || matches[0];
      s.curRow = next.row; scrollToCur(s);
      setStatus(`treffer ${matches.indexOf(next)+1}/${matches.length}`);
      draw(); return;
    }
    if (e.key === "N" && matches.length) {
      e.preventDefault();
      const prev = [...matches].reverse().find(m => m.row < s.curRow) || matches[matches.length-1];
      s.curRow = prev.row; scrollToCur(s);
      setStatus(`treffer ${matches.indexOf(prev)+1}/${matches.length}`);
      draw(); return;
    }
    if ((e.key === "y" || (e.ctrlKey && e.key === "c")) && s.selA && s.selB) {
      e.preventDefault();
      // Kopieer geselecteerde tekst
      let selStart = s.selA, selEnd = s.selB;
      if (selStart.row > selEnd.row || (selStart.row === selEnd.row && selStart.col > selEnd.col)) {
        [selStart, selEnd] = [selEnd, selStart];
      }
      let text = "";
      for (let r = selStart.row; r <= selEnd.row; r++) {
        const line = s.lines[r];
        if (r === selStart.row && r === selEnd.row) text += line.slice(selStart.col, selEnd.col);
        else if (r === selStart.row) text += line.slice(selStart.col) + "\n";
        else if (r === selEnd.row)   text += line.slice(0, selEnd.col);
        else text += line + "\n";
      }
      navigator.clipboard.writeText(text).then(() => {
        setStatus(`✓ gekopieerd (${text.split("\n").length} regels)`);
        setTimeout(() => setStatus(""), 2000);
      });
      return;
    }
    // yy: kopieer huidige regel
    if (e.key === "Y") {
      e.preventDefault();
      const line = s.lines[s.curRow] || "";
      navigator.clipboard.writeText(line).then(() => {
        setStatus(`✓ regel gekopieerd`);
        setTimeout(() => setStatus(""), 2000);
      });
      return;
    }
    if (e.key === "PageDown") {
      e.preventDefault();
      s.curRow = Math.min(s.lines.length-1, s.curRow + s.visRows);
      scrollToCur(s); draw(); return;
    }
    if (e.key === "PageUp") {
      e.preventDefault();
      s.curRow = Math.max(0, s.curRow - s.visRows);
      scrollToCur(s); draw(); return;
    }
    // Ctrl+D / Ctrl+U halve pagina
    if (e.ctrlKey && e.key === "d") {
      e.preventDefault();
      s.curRow = Math.min(s.lines.length-1, s.curRow + Math.floor(s.visRows/2));
      scrollToCur(s); draw(); return;
    }
    if (e.ctrlKey && e.key === "u") {
      e.preventDefault();
      s.curRow = Math.max(0, s.curRow - Math.floor(s.visRows/2));
      scrollToCur(s); draw(); return;
    }
  }, [draw, query, buildMatches]);

  // Wheel scrollen
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const s = stateRef.current;
    s.scroll = Math.max(0, Math.min(
      s.lines.length - s.visRows,
      s.scroll + (e.deltaY > 0 ? 3 : -3)
    ));
    draw();
  }, [draw]);

  // Matches tellen voor statusbalk
  const matches = buildMatches(stateRef.current.lines, query);
  const matchCount = matches.length;
  const lineCount  = stateRef.current.lines.length;

  return React.createElement("div", {
    style: { display:"flex", flexDirection:"column", flex:1, minHeight:0 }
  },
    // Toolbar
    React.createElement("div", {
      style: { display:"flex", alignItems:"center", gap:"8px", padding:"4px 10px",
               background:W.bg2, borderBottom:`1px solid ${W.splitBg}`,
               fontSize:"11px", flexShrink:0, flexWrap:"wrap" }
    },
      React.createElement("span", { style:{color:W.fgMuted} },
        `${lineCount} regels · ${matchCount} treffer${matchCount!==1?"s":""}`),
      matchCount > 0 && React.createElement("span", {
        style:{color:W.yellow, background:"rgba(234,231,136,0.1)",
               borderRadius:"3px", padding:"1px 6px"}
      }, `⚡ n/N = volgende/vorige treffer`),
      React.createElement("span", {
        style:{marginLeft:"auto", color:W.fgMuted}
      }, "j/k=navigeer  y=kopieer selectie  Y=kopieer regel"),
      React.createElement("button", {
        onClick: () => setRelNums(v => !v),
        title: "Toggle relatieve regelnummers",
        style: { background: relNums?"rgba(138,198,242,0.15)":"none",
                 border:`1px solid ${relNums?W.blue:W.splitBg}`,
                 borderRadius:"3px", color:relNums?W.blue:W.fgMuted,
                 fontSize:"10px", cursor:"pointer", padding:"1px 6px" }
      }, relNums ? "rel#" : "abs#"),
      status && React.createElement("span", {
        style:{color:W.comment, fontWeight:"600", marginLeft:"4px"}
      }, status),
      onPasteToNote && stateRef.current.selA && stateRef.current.selB &&
        React.createElement("button", {
          onClick: () => {
            const s = stateRef.current;
            let selStart = s.selA, selEnd = s.selB;
            if (selStart.row > selEnd.row || (selStart.row === selEnd.row && selStart.col > selEnd.col))
              [selStart, selEnd] = [selEnd, selStart];
            let text = "";
            for (let r = selStart.row; r <= selEnd.row; r++) {
              const line = s.lines[r];
              if (r === selStart.row && r === selEnd.row) text += line.slice(selStart.col, selEnd.col);
              else if (r === selStart.row) text += line.slice(selStart.col) + "\n";
              else if (r === selEnd.row)   text += line.slice(0, selEnd.col);
              else text += line + "\n";
            }
            onPasteToNote({ text, source: noteName });
          },
          style: { background:"rgba(138,198,242,0.15)", border:`1px solid rgba(138,198,242,0.4)`,
                   borderRadius:"4px", color:W.blue, fontSize:"11px", cursor:"pointer",
                   padding:"2px 8px" }
        }, "◀ Plak selectie links")
    ),
    // Canvas
    React.createElement("div", {
      style: { flex:1, minHeight:0, position:"relative" }
    },
      React.createElement("canvas", {
        ref: cvRef,
        tabIndex: 0,
        style: { display:"block", outline:"none", cursor:"text" },
        onKeyDown:  handleKey,
        onWheel:    handleWheel,
      })
    )
  );
};

const FuzzySearch = ({ notes, allTags, onOpenNote, onAddNote, onUpdateNote, onPasteToNote=null, focusTrigger=0, openLabel="→ Open in editor" }) => {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  const [query,      setQuery]      = useState("");
  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [selIdx,     setSelIdx]     = useState(null);   // welk resultaat geselecteerd
  const [editState,  setEditState]  = useState({});     // {id → {title, content, tags, dirty}}
  const [saving,     setSaving]     = useState({});     // {id → bool}
  const [saved,      setSaved]      = useState({});     // {id → bool}  (groen vinkje)
  const [tagInput,   setTagInput]   = useState({});     // {id → string}
  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "note" | "pdf"
  const [searchMode, setSearchMode] = useState("fuzzy"); // "fuzzy" | "fulltext"
  const inputRef = useRef(null);
  const debRef   = useRef(null);

  // Focust bij mount én elke keer dat focusTrigger omhoog gaat (split-wissel)
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (focusTrigger > 0) inputRef.current?.focus(); }, [focusTrigger]);

  // Gefilterde resultaten op basis van typeFilter
  const filteredResults = useMemo(() =>
    typeFilter === "all" ? results : results.filter(r => r.type === typeFilter),
    [results, typeFilter]
  );

  // Debounced zoekfunctie — fuzzy of fulltext
  const doSearch = useCallback((q, mode) => {
    const m = mode || searchMode;
    if (!q.trim()) { setResults([]); setSelIdx(null); setError(null); return; }
    setLoading(true); setError(null);
    const endpoint = m === "fulltext" ? "/api/fulltext" : "/api/search";
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setResults([]); }
        else {
          setResults(d.results || []);
          setSelIdx(d.results?.length ? 0 : null);
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [searchMode]);

  const handleQueryChange = (q) => {
    setQuery(q);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => doSearch(q, searchMode), 280);
  };

  const handleModeChange = (mode) => {
    setSearchMode(mode);
    setResults([]);
    if (query.trim()) {
      clearTimeout(debRef.current);
      debRef.current = setTimeout(() => doSearch(query, mode), 100);
    }
  };

  // Toetsenbord navigatie (pijl op/neer, Enter opent)
  // Edit state initialiseren voor een resultaat
  const openEdit = (r, idx) => {
    const key = resultKey(r, idx);
    setSelIdx(idx);
    if (!editState[key]) {
      setEditState(s => ({ ...s, [key]: {
        title:   r.type === "note" ? r.title : suggestTitle(r),
        content: r.type === "note" ? (r.content||"") : suggestContent(r),
        tags:    r.type === "note" ? (r.tags||[]) : suggestTags(r),
        dirty:   false,
        isNew:   r.type !== "note",  // PDF-hits worden nieuwe notities
      }}));
    }
  };

  const resultKey = (r, idx) => r.type === "note" ? ("note-"+r.id) : ("pdf-"+idx);

  const suggestTitle = (r) =>
    r.source ? `Aantekening — ${r.source} p.${r.page}` : r.title;

  const suggestContent = (r) => {
    const bron = r.type === "pdf"
      ? `📄 **Bron:** [[pdf:${r.source}]]  —  pagina ${r.page}, regel ${r.line}\n\n`
      : "";
    return bron + (r.excerpt || "");
  };

  const suggestTags = (r) =>
    r.type === "pdf" ? ["pdf", "excerpt"] : (r.tags || []);

  // Highlight zoektermen in tekst
  const highlight = (text, q) => {
    if (!q.trim() || !text) return text;
    const tokens = q.trim().split(/\s+/).filter(Boolean);
    // Escape regex special chars
    const pattern = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const re = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(re);
    return parts.map((p, i) =>
      re.test(p)
        ? React.createElement("mark", {
            key: i,
            style: { background: W.yellow+"44", color: W.fg, borderRadius: "2px",
                     padding: "0 1px", fontWeight: "bold" }
          }, p)
        : p
    );
  };

  // Opslaan — bijwerken of nieuw aanmaken
  const handleSave = async (r, idx) => {
    const key = resultKey(r, idx);
    const es  = editState[key];
    if (!es) return;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const noteData = {
        title:    es.title,
        content:  es.content,
        tags:     es.tags,
        modified: new Date().toISOString(),
      };
      if (!es.isNew && r.type === "note" && r.id) {
        // Bijwerken bestaande notitie
        await onUpdateNote({ ...noteData, id: r.id });
      } else {
        // Nieuwe notitie aanmaken
        const created = { ...noteData, id: genId(), created: new Date().toISOString() };
        await onAddNote(created);
      }
      setEditState(s => ({ ...s, [key]: { ...es, dirty: false, isNew: false } }));
      setSaved(s => ({ ...s, [key]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2200);
    } catch(e) {
      alert("Opslaan mislukt: " + e.message);
    }
    setSaving(s => ({ ...s, [key]: false }));
  };

  // Tag toevoegen vanuit tagInput
  const addTag = (key, tag) => {
    const t = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!t) return;
    setEditState(s => {
      const es = s[key]; if (!es) return s;
      if (es.tags.includes(t)) return s;
      return { ...s, [key]: { ...es, tags: [...es.tags, t], dirty: true } };
    });
    setTagInput(s => ({ ...s, [key]: "" }));
  };

  const removeTag = (key, tag) => {
    setEditState(s => {
      const es = s[key]; if (!es) return s;
      return { ...s, [key]: { ...es, tags: es.tags.filter(t=>t!==tag), dirty: true } };
    });
  };

  // ── Stijlen ───────────────────────────────────────────────────────────────
  const css = {
    root:   { display:"flex", flexDirection:"column", flex:1, minHeight:0, background:W.bg,
               fontFamily:"'Hack', monospace, sans-serif", overflow:"hidden" },
    header: { padding:"12px 16px 10px", borderBottom:`1px solid ${W.splitBg}`,
               background:W.bg2, flexShrink:0 },
    searchRow: { display:"flex", gap:"8px", alignItems:"center" },
    input:  { flex:1, background:W.bg, border:`2px solid ${W.blue}`, borderRadius:"6px",
               color:W.fg, padding:"8px 14px", fontSize:"15px", outline:"none",
               fontFamily:"inherit", letterSpacing:"0.3px" },
    meta:   { fontSize:"12px", color:W.fgMuted, marginTop:"6px" },
    body:   { display:"flex", flex:1, overflow:"hidden" },
    // Resultatenlijst links
    list:   { width:"340px", flexShrink:0, overflowY:"auto", borderRight:`1px solid ${W.splitBg}` },
    item:   (selected, type) => ({
      padding:"10px 14px", cursor:"pointer", borderBottom:`1px solid ${W.splitBg}`,
      background: selected ? (type==="note"?W.bg2+"ee":"rgba(230,180,0,0.08)") : "transparent",
      borderLeft: selected ? `3px solid ${type==="note"?W.blue:W.yellow}` : "3px solid transparent",
      transition:"background 0.1s",
    }),
    itemTitle: { fontSize:"13px", fontWeight:"bold", color:W.fg,
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
    itemMeta:  { fontSize:"11px", color:W.fgMuted, marginTop:"3px" },
    itemExcerpt: { fontSize:"11px", color:W.fgDim, marginTop:"4px",
                    lineHeight:"1.5", display:"-webkit-box",
                    WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" },
    badge: (type) => ({
      display:"inline-block", fontSize:"10px", padding:"1px 6px", borderRadius:"10px",
      marginRight:"5px", fontWeight:"bold",
      background: type==="note" ? W.blue+"33" : W.yellow+"33",
      color:       type==="note" ? W.blue      : W.yellow,
      border: `1px solid ${type==="note" ? W.blue+"66" : W.yellow+"66"}`,
    }),
    // Editor rechts
    editor: { flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 },
    editorInner: { overflowY:"auto", padding:"12px 16px", flexShrink:0 },
    editorViewer: { flex:1, minHeight:0, display:"flex", flexDirection:"column",
                    borderTop:`1px solid ${W.splitBg}` },
    editorEmpty: { flex:1, display:"flex", alignItems:"center", justifyContent:"center",
                    flexDirection:"column", gap:"12px", color:W.fgMuted },
    fieldLabel: { fontSize:"11px", color:W.fgMuted, letterSpacing:"1px",
                   textTransform:"uppercase", marginBottom:"4px" },
    titleInput: { width:"100%", background:W.bg2, border:`1px solid ${W.splitBg}`,
                   borderRadius:"4px", color:W.fg, padding:"6px 10px",
                   fontSize:"15px", fontWeight:"bold", outline:"none", boxSizing:"border-box",
                   fontFamily:"inherit" },
    textarea: { width:"100%", background:W.bg, border:`1px solid ${W.splitBg}`,
                 borderRadius:"4px", color:W.fg, padding:"8px 10px",
                 fontSize:"13px", outline:"none", boxSizing:"border-box",
                 fontFamily:"'Hack', monospace", lineHeight:"1.65", resize:"vertical" },
    tagPill: { display:"inline-flex", alignItems:"center", gap:"4px",
                background:W.bg2, border:`1px solid ${W.splitBg}`, borderRadius:"12px",
                padding:"2px 8px", fontSize:"12px", color:W.comment },
    tagX: { cursor:"pointer", color:W.fgMuted, marginLeft:"2px" },
    saveBar: { padding:"10px 16px", borderTop:`1px solid ${W.splitBg}`,
                background:W.bg2, display:"flex", alignItems:"center", gap:"10px",
                flexShrink:0 },
    saveBtn: (s) => ({
      padding:"6px 18px", borderRadius:"5px", border:"none", cursor:"pointer",
      fontWeight:"bold", fontSize:"13px", fontFamily:"inherit",
      background: s ? W.green : W.blue, color: W.bg,
      opacity: s ? 0.7 : 1,
    }),
    openBtn: { padding:"6px 14px", borderRadius:"5px", border:`1px solid ${W.blue}`,
                cursor:"pointer", fontSize:"13px", fontFamily:"inherit",
                background:"transparent", color:W.blue },
    sourceBox: { background:W.bg2, borderLeft:`3px solid ${W.yellow}`,
                  padding:"8px 12px", borderRadius:"0 4px 4px 0",
                  fontSize:"12px", color:W.yellow, marginBottom:"14px" },
    excerptBox: { background:W.bg, border:`1px solid ${W.splitBg}`, borderRadius:"4px",
                   padding:"8px 12px", fontSize:"12px", color:W.fgDim,
                   fontFamily:"'Hack', monospace", lineHeight:"1.6", marginBottom:"14px",
                   whiteSpace:"pre-wrap" },
  };

  // ── Render resultatenlijst ────────────────────────────────────────────────
  // Score → kleur (groen=hoog, geel=midden, grijs=laag)
  const scoreColor = (sc) => sc > 300 ? W.green : sc > 100 ? W.yellow : W.fgMuted;
  const maxScore   = useMemo(() => results.reduce((m,r) => Math.max(m, r.score||0), 1), [results]);

  const renderList = () => {
    if (loading) return React.createElement("div", { style:{padding:"20px",color:W.fgMuted,fontSize:"13px"} },
      "⏳ Zoeken in notities en PDFs…");
    if (error)  return React.createElement("div", { style:{padding:"20px",color:W.red,fontSize:"13px"} },
      "⚠️ " + error);
    if (!query.trim()) return React.createElement("div", { style:{padding:"20px",color:W.fgMuted,fontSize:"13px"} },
      React.createElement("div",{style:{fontSize:"32px",marginBottom:"12px"}},"🔍"),
      React.createElement("div",{style:{fontWeight:"bold",marginBottom:"8px",color:W.fg}},"FZF Zoeken"),
      React.createElement("div",null,"Doorzoek alle notities en volledige PDF-inhoud."),
      React.createElement("div",{style:{marginTop:"10px",display:"flex",flexDirection:"column",gap:"5px"}}),
      React.createElement("div",{style:{color:W.fgDim,marginTop:"8px"}},"• Spatie = AND  (meerdere woorden)"),
      React.createElement("div",{style:{color:W.fgDim}},"• ↑↓ navigeert resultaten  ·  Enter opent"),
      React.createElement("div",{style:{color:W.fgDim}},"• Fuzzy: typ letters in volgorde, geen exacte match nodig"),
      React.createElement("div",{style:{color:W.fgDim}},"• PDF-hits tonen pagina + regelnummer")
    );
    if (!filteredResults.length) return React.createElement("div",{style:{padding:"20px",color:W.fgMuted,fontSize:"13px"}},
      results.length
        ? `Geen ${typeFilter === "note" ? "notitie" : "PDF"}-resultaten — ${results.length} resultaten totaal`
        : `Geen resultaten voor "${query}"`
    );

    // Full-text modus: toon alle matches per notitie
    if (searchMode === "fulltext") {
      return filteredResults.map((r, idx) => {
        const sel = selIdx === idx;
        const mc  = r.match_count || 0;
        return React.createElement("div", {
          key: r.id || idx,
          style: { ...css.item(sel, "note"), cursor: "pointer" },
          onClick: () => openEdit(r, idx),
        },
          // Kop
          React.createElement("div", { style:{display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px"} },
            r.title_match && React.createElement("span",{style:{fontSize:"10px",color:W.yellow,background:"rgba(234,231,136,0.15)",borderRadius:"3px",padding:"1px 5px"}},"titel"),
            React.createElement("span", { style: css.itemTitle }, r.title || "(geen titel)"),
            React.createElement("span",{style:{marginLeft:"auto",fontSize:"10px",color:W.blue,flexShrink:0,background:"rgba(138,198,242,0.1)",borderRadius:"10px",padding:"1px 7px"}},
              mc + "×"
            ),
          ),
          // Tags
          r.tags?.length > 0 && React.createElement("div",{style:{display:"flex",gap:"3px",flexWrap:"wrap",marginBottom:"5px"}},
            r.tags.slice(0,4).map(t => React.createElement(TagPill,{key:t,tag:t,small:true}))
          ),
          // Match-snippets (max 3 tonen)
          React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"3px"}},
            (r.matches||[]).slice(0,3).map((m,i) =>
              React.createElement("div",{key:i,style:{
                fontSize:"11px",color:W.fgDim,lineHeight:"1.5",
                background:"rgba(255,255,255,0.03)",borderRadius:"3px",
                padding:"3px 6px",borderLeft:`2px solid rgba(138,198,242,0.3)`,
              }},
                React.createElement("span",{style:{color:W.fgMuted,marginRight:"5px",fontSize:"10px"}},
                  `r.${m.line_no}`
                ),
                highlight(m.line, query)
              )
            ),
            mc > 3 && React.createElement("div",{style:{fontSize:"10px",color:W.fgMuted,padding:"2px 6px"}},
              `+ ${mc-3} meer treffer${mc-3>1?"s":""}…`
            )
          )
        );
      });
    }

    return filteredResults.map((r, idx) => {
      const key = resultKey(r, idx);
      const sel = selIdx === idx;
      const es  = editState[key];
      const isNote = r.type === "note";
      const sc  = r.score || 0;
      const barW = Math.round((sc / maxScore) * 100);

      return React.createElement("div", {
        key, style: css.item(sel, r.type),
        onClick: () => openEdit(r, idx),
      },
        // Titel rij: badge + titel
        React.createElement("div", { style:{ display:"flex", alignItems:"flex-start", gap:"6px", marginBottom:"3px" } },
          React.createElement("span", { style: css.badge(r.type) },
            isNote ? "📝" : "📄"
          ),
          React.createElement("div", { style: css.itemTitle },
            isNote ? highlight(r.title, query) : highlight(r.source, query)
          )
        ),
        // Meta-regel: bron + pagina/regel
        React.createElement("div", { style: css.itemMeta },
          isNote
            ? React.createElement("span", null,
                (r.tags||[]).slice(0,4).map(t =>
                  React.createElement("span",{key:t,style:{
                    fontSize:"11px",color:"#b8e06a",fontWeight:"500",
                    background:"rgba(159,202,86,0.12)",border:"1px solid rgba(159,202,86,0.35)",
                    borderRadius:"4px",padding:"1px 6px",marginRight:"3px",lineHeight:"1.3",
                  }},"#"+t)
                ),
                r.line > 1 && React.createElement("span",{style:{color:W.fgDim}},` · regel ${r.line}`)
              )
            : React.createElement("span", null,
                React.createElement("span",{style:{color:W.yellow,fontWeight:"bold"}},"p."+r.page),
                React.createElement("span",{style:{color:W.fgDim}},`  ·  r.${r.line}  ·  `),
                React.createElement("span",{style:{color:W.fgMuted}}, r.source.length>28 ? "…"+r.source.slice(-26) : r.source)
              )
        ),
        // Score-balk
        React.createElement("div",{style:{height:"2px",background:W.splitBg,borderRadius:"1px",margin:"4px 0",overflow:"hidden"}},
          React.createElement("div",{style:{height:"100%",width:barW+"%",background:scoreColor(sc),borderRadius:"1px",transition:"width 0.2s"}})
        ),
        // Excerpt
        r.excerpt && React.createElement("div", { style: css.itemExcerpt },
          highlight(r.excerpt, query)
        ),
        // Bewerkingsindicator
        es?.dirty && React.createElement("div", { style:{fontSize:"10px",color:W.yellow,marginTop:"4px"} },
          "● gewijzigd"
        )
      );
    });
  };

  // ── Render editor rechts ──────────────────────────────────────────────────
  const renderEditor = () => {
    if (selIdx === null || !filteredResults[selIdx]) return React.createElement("div", { style: css.editorEmpty },
      React.createElement("div",{style:{fontSize:"48px"}},"🔍"),
      React.createElement("div",{style:{fontSize:"14px"}},"Selecteer een resultaat om te bewerken")
    );

    const r   = filteredResults[selIdx];
    const key = resultKey(r, selIdx);
    const es  = editState[key];
    const isSaving = saving[key];
    const isSaved  = saved[key];

    if (!es) return React.createElement("div", { style: css.editorEmpty },
      React.createElement("div",null,"Klik op een resultaat om te openen")
    );

    const fieldSep = React.createElement("div", { style:{marginBottom:"14px"} });

    return React.createElement(React.Fragment, null,
      // ── Compacte header: bron, titel, tags ───────────────────────────────
      React.createElement("div", { style: css.editorInner },

        // Bron + acties op één regel
        React.createElement("div", { style:{display:"flex",alignItems:"center",gap:"8px",
          marginBottom:"8px",flexWrap:"wrap"} },
          React.createElement("div", { style:{...css.sourceBox, marginBottom:0, flex:1} },
            r.type === "pdf"
              ? `📄 ${r.source}  ·  p.${r.page}  ·  r.${r.line}`
              : `📝 ${r.title || "Notitie"}`
          ),
          onPasteToNote && React.createElement("button", {
            onClick: () => onPasteToNote({
              text: r.excerpt || es.content || "",
              source: r.type === "pdf" ? r.source : (r.title || "Notitie"),
              page: r.type === "pdf" ? r.page : null, url: null,
            }),
            style: { background:"rgba(138,198,242,0.12)", border:`1px solid rgba(138,198,242,0.35)`,
                     borderRadius:"4px", color:"#8ac6f2", fontSize:"11px", cursor:"pointer",
                     padding:"3px 10px", whiteSpace:"nowrap" }
          }, "📋 Plak in notitie"),
        ),

        // Titel
        React.createElement("div", { style: css.fieldLabel }, "Titel"),
        React.createElement("input", {
          style: {...css.titleInput, marginBottom:"8px"},
          value: es.title,
          onChange: e => setEditState(s => ({ ...s, [key]: { ...s[key], title: e.target.value, dirty: true } })),
          placeholder: "Notitie-titel…",
        }),

        // Tags compact
        React.createElement("div", { style:{display:"flex",flexWrap:"wrap",gap:"4px",alignItems:"center"} },
          (es.tags||[]).map(tag =>
            React.createElement("span", { key: tag, style: css.tagPill },
              "#" + tag,
              React.createElement("span", { style: css.tagX, onClick: () => removeTag(key, tag) }, "×")
            )
          ),
          React.createElement("input", {
            style: { background:"transparent", border:`1px dashed ${W.splitBg}`, borderRadius:"10px",
                     color:W.fgMuted, padding:"1px 8px", fontSize:"11px", outline:"none",
                     width:"110px", fontFamily:"inherit" },
            value:  tagInput[key] || "",
            placeholder: "+ tag…",
            onChange: e => setTagInput(s => ({ ...s, [key]: e.target.value })),
            onKeyDown: e => {
              if (["Enter","Tab",","," "].includes(e.key)) { e.preventDefault(); addTag(key, tagInput[key]||""); }
            }
          }),
        ),

        // Zettelkasten-info (alleen voor nieuwe notities)
        es.isNew && React.createElement("div", {
          style:{ background:W.bg2, border:`1px solid ${W.green}44`, borderRadius:"6px",
                  padding:"8px 12px", fontSize:"11px", color:W.comment,
                  display:"flex", gap:"8px", alignItems:"center", marginTop:"8px" }
        },
          React.createElement("span",null,"💡"),
          "Dit fragment wordt een nieuwe notitie met bronverwijzing."
        ),
      ),

      // ── SearchViewer: vult de rest van de ruimte ─────────────────────────
      !es.isNew
        ? React.createElement("div", { style: css.editorViewer },
            React.createElement(SearchViewer, {
              content: es.content || "",
              query,
              onPasteToNote,
              noteName: r.title || "",
              initialRow: r.line > 1 ? r.line - 1 : 0,
            })
          )
        : React.createElement("div", { style:{padding:"0 16px 12px", flex:1} },
            React.createElement("textarea", {
              style: { ...css.textarea, width:"100%", height:"100%", minHeight:"200px", boxSizing:"border-box" },
              value: es.content, rows: 14,
              onChange: e => setEditState(s => ({ ...s, [key]: { ...s[key], content: e.target.value, dirty: true } })),
              placeholder: "Notitie-inhoud (Markdown)…",
            })
          ),

      // Save-balk
      React.createElement("div", { style: css.saveBar },
        React.createElement("button", {
          style: css.saveBtn(isSaved),
          disabled: isSaving,
          onClick: () => handleSave(r, selIdx),
        }, isSaving ? "⏳ opslaan…" : isSaved ? "✓ opgeslagen" : es.isNew ? "＋ Opslaan als notitie" : "💾 Wijzigingen opslaan"),

        !es.isNew && r.type === "note" && r.id && onOpenNote &&
          React.createElement("button", {
            title: "Open deze notitie ook in de linker editor (je blijft hier zoeken)",
            style: {...css.openBtn, fontSize:"12px"},
            onClick: () => onOpenNote(r.id),
          }, openLabel),

        es.dirty && React.createElement("span", { style:{fontSize:"12px",color:W.yellow} },
          "● Niet opgeslagen"
        ),
        isSaved && React.createElement("span", { style:{fontSize:"12px",color:W.green} },
          "✓ Opgeslagen in vault"
        ),
      )
    );
  };

  // ── Hoofd render ──────────────────────────────────────────────────────────
  // Keyboard nav werkt op filteredResults
  const handleKeyDown = (e) => {
    if (!filteredResults.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx(i => Math.min((i??-1)+1, filteredResults.length-1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelIdx(i => Math.max((i??1)-1, 0)); }
    if (e.key === "Enter" && selIdx !== null) {
      const r = filteredResults[selIdx];
      if (r) openEdit(r, selIdx);
    }
  };

  const nNotes = results.filter(r=>r.type==="note").length;
  const nPdfs  = results.filter(r=>r.type==="pdf").length;

  const filterBtnStyle = (active) => ({
    padding:"3px 12px", borderRadius:"12px", fontSize:"11px", fontWeight:"bold",
    cursor:"pointer", border:"none", fontFamily:"inherit",
    background: active ? W.blue : W.bg,
    color:       active ? W.bg   : W.fgMuted,
    transition:"all 0.15s",
  });

  return React.createElement("div", { style: css.root },

    // Zoekbalk header
    React.createElement("div", { style: css.header },
      React.createElement("div", { style: css.searchRow },
        React.createElement("span", { style:{fontSize:"18px"} }, "🔍"),
        React.createElement("input", {
          ref: inputRef,
          style: css.input,
          value: query,
          placeholder: "Fuzzy zoeken in notities en PDFs…  (spatie = AND, volgorde telt)",
          onChange: e => handleQueryChange(e.target.value),
          onKeyDown: handleKeyDown,
          autoFocus: true,
          spellCheck: false,
        }),
        loading && React.createElement("span", { style:{color:W.fgMuted,fontSize:"13px",marginLeft:"4px"} }, "⏳"),
        query && React.createElement("span", {
          style:{cursor:"pointer",color:W.fgMuted,fontSize:"16px",marginLeft:"4px",padding:"0 4px"},
          onClick:()=>{ setQuery(""); setResults([]); setSelIdx(null); inputRef.current?.focus(); }
        }, "×"),
      ),
      // Mode-toggle: fuzzy vs full-text
      React.createElement("div", { style:{display:"flex",alignItems:"center",gap:"6px",marginTop:"8px",flexWrap:"wrap"} },
        // Zoek-modus
        React.createElement("div", { style:{display:"flex",background:W.bg3,borderRadius:"8px",padding:"2px",gap:"2px",flexShrink:0} },
          React.createElement("button", {
            onClick: () => handleModeChange("fuzzy"),
            style:{ padding:"3px 12px", borderRadius:"6px", fontSize:"11px", fontWeight:"bold",
                    cursor:"pointer", border:"none", fontFamily:"inherit", transition:"all 0.15s",
                    background: searchMode==="fuzzy" ? W.blue : "transparent",
                    color:       searchMode==="fuzzy" ? W.bg   : W.fgMuted }
          }, "⚡ Fuzzy"),
          React.createElement("button", {
            onClick: () => handleModeChange("fulltext"),
            style:{ padding:"3px 12px", borderRadius:"6px", fontSize:"11px", fontWeight:"bold",
                    cursor:"pointer", border:"none", fontFamily:"inherit", transition:"all 0.15s",
                    background: searchMode==="fulltext" ? W.yellow : "transparent",
                    color:       searchMode==="fulltext" ? W.bg     : W.fgMuted }
          }, "🔎 Volledig"),
        ),
        // Type-filters
        React.createElement("button", { style:filterBtnStyle(typeFilter==="all"), onClick:()=>setTypeFilter("all") },
          `Alles${results.length ? " ("+results.length+")" : ""}`),
        searchMode === "fuzzy" && React.createElement("button", {
          style:{...filterBtnStyle(typeFilter==="pdf"), background:typeFilter==="pdf"?W.yellow:W.bg, color:typeFilter==="pdf"?W.bg:W.fgMuted},
          onClick:()=>setTypeFilter(typeFilter==="pdf" ? "all" : "pdf")
        }, `📄 PDF${nPdfs ? " ("+nPdfs+")" : ""}`),
        results.length > 0 && React.createElement("span",{style:{fontSize:"11px",color:W.fgDim,marginLeft:"4px"}},
          `${filteredResults.length} gevonden`
        ),
      ),
    ),

    // Body: lijst + editor
    React.createElement("div", { style: css.body },
      React.createElement("div", { style: css.list }, renderList()),
      React.createElement("div", { style: css.editor }, renderEditor())
    )
  );
};

// ── ModelPicker — statusbalk badge + dropdown ─────────────────────────────────
