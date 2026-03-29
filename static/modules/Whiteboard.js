// ── Whiteboard ────────────────────────────────────────────────────────────────
// Vrij canvas voor divergent denken: kaarten, verbindingen, kleuren.
// Opslag: vault/whiteboard_<id>.json via /api/config
// Workflow: schets ideeën → verbind ze → zet om naar notities
// Wetenschappelijk: ruimtelijk denken ondersteunt creatief probleemoplossen
// (Schon & Wiggins 1992: "zie, beweeg, zie opnieuw")

const Whiteboard = ({ notes = [], onCreateNote, llmModel = "", serverImages = [] }) => {
  const { useState, useEffect, useRef, useCallback } = React;

  // ── State ────────────────────────────────────────────────────────────────
  const [cards, setCards]         = useState([]);
  const [connections, setCons]    = useState([]);
  const [selected, setSelected]   = useState(null);   // card id
  const [editingId, setEditingId] = useState(null);   // card in tekst-edit
  const [tool, setTool]           = useState("select"); // select | connect | text | note
  const [boards, setBoards]       = useState([]);     // beschikbare bord-IDs
  const [boardNames, setBoardNames] = useState({default: "Standaard"}); // id→naam
  const [activeBoard, setActiveBoard] = useState("default");
  const [boardName, setBoardName] = useState("Whiteboard");
  const [showBoardMenu, setShowBoardMenu] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [connectFrom, setConnectFrom] = useState(null); // kaart-id bij verbinden
  const [showNoteLink, setShowNoteLink] = useState(false);
  const [noteLinkSearch, setNoteLinkSearch] = useState("");
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [sidebarTab, setSidebarTab]     = useState("search"); // "search" | "notes"
  const [sidebarQuery, setSidebarQuery] = useState("");
  const [searchMode, setSearchMode]     = useState("fuzzy"); // "fuzzy" | "exact"
  const [activeTagFilters, setActiveTagFilters] = useState(new Set());
  const [ctxMenu, setCtxMenu]           = useState(null);  // {x,y, cardId|null}
  const ctxMenuRef                      = useRef(null);
  const [renamingBoard, setRenamingBoard] = useState(null); // bid tijdens hernoemen
  const [peekNoteId, setPeekNoteId]     = useState(null); // notitie peek panel
  const imgCache                        = useRef({});    // url→HTMLImageElement
  const [aiPanel, setAiPanel]           = useState(false); // AI analyse panel
  const [aiMode, setAiMode]             = useState("analyse"); // analyse | synthese | chat
  const [aiResult, setAiResult]         = useState("");
  const [aiStreaming, setAiStreaming]    = useState(false);
  const [aiChatInput, setAiChatInput]   = useState("");
  const [aiHistory, setAiHistory]       = useState([]); // [{role,content}]

  // Canvas
  const cvRef     = useRef(null);
  const viewRef   = useRef({ ox: 0, oy: 0, scale: 1 });
  const dirtyRef  = useRef(true);
  const isPanning = useRef(false);
  const panStart  = useRef(null);
  const dragging  = useRef(null);   // { id, startX, startY, startCX, startCY }
  const afRef     = useRef(null);
  const stateRef  = useRef({ cards: [], connections: [] });

  // Kleuren voor kaarten (Wombat-palette)
  const COLORS = [
    { bg: "#2a2a1e", border: "#9fca56", text: "#ffffd7", name: "geel" },
    { bg: "#1e242a", border: "#8ac6f2", text: "#e3e0d7", name: "blauw" },
    { bg: "#2a1e1e", border: "#e5786d", text: "#ffe0dc", name: "rood" },
    { bg: "#1e2a1e", border: "#95e454", text: "#e3e0d7", name: "groen" },
    { bg: "#261e2a", border: "#d7a0ff", text: "#f0e3ff", name: "paars" },
    { bg: "#2a2a2a", border: "#857b6f", text: "#e3e0d7", name: "grijs" },
  ];

  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

  // Sluit contextmenu bij klik buiten
  React.useEffect(() => {
    if (!ctxMenu) return;
    const close = (e) => {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target)) setCtxMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [ctxMenu]);

  // Esc sluit peek panel
  React.useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { setPeekNoteId(null); setCtxMenu(null); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── Opslag ───────────────────────────────────────────────────────────────
  // activeBoardRef zodat saveBoard altijd de juiste board-id pakt
  const activeBoardRef = useRef(activeBoard);
  const boardNameRef   = useRef(boardName);
  const boardsRef      = useRef(boards);
  React.useEffect(() => { activeBoardRef.current = activeBoard; }, [activeBoard]);
  React.useEffect(() => { boardNameRef.current   = boardName;   }, [boardName]);
  React.useEffect(() => { boardsRef.current      = boards;      }, [boards]);

  // saveBoard leest altijd uit refs — nooit stale closures
  const saveBoard = useCallback((cardList, conList, bId, bName) => {
    const id   = bId  || activeBoardRef.current;
    const nm   = bName || boardNameRef.current;
    const bds  = boardsRef.current;
    // Gebruik opgegeven lijsten OF (als undefined) de stateRef als fallback
    const cls  = cardList  !== undefined ? cardList  : stateRef.current.cards;
    const cnls = conList   !== undefined ? conList   : stateRef.current.connections;
    const data = { name: nm, cards: cls, connections: cnls };
    // 1. Direct naar localStorage — instant, overleeft tab-wissel
    try { localStorage.setItem("wb_" + id, JSON.stringify(data)); } catch(e) {}
    // 2. Debounced naar server — voorkomt spam bij slepen
    clearTimeout(saveBoard._t);
    saveBoard._t = setTimeout(async () => {
      try {
        await fetch("/api/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            [`whiteboard_${id}`]: data,
            whiteboard_boards: [...new Set([...(bds.includes(id) ? bds : [...bds, id])])],
          }),
        });
      } catch(e) { console.error("Whiteboard server-opslag mislukt:", e); }
    }, 800);
  }, []);  // lege deps — leest alles uit refs

  const loadBoard = useCallback(async (bId) => {
    try {
      // 1. localStorage eerst — instant tonen, geen leeg canvas bij tab-wissel
      const cached = localStorage.getItem("wb_" + bId);
      if (cached) {
        const bd = JSON.parse(cached);
        const cls  = bd.cards || [];
        const cnls = bd.connections || [];
        setCards(cls); setCons(cnls);
        setBoardName(bd.name || "Whiteboard");
        stateRef.current = { cards: cls, connections: cnls };
        dirtyRef.current = true;
      }
      // 2. Server ophalen — alleen toepassen als localStorage leeg was
      //    (anders verlies je kaarten die net gesleept zijn maar nog niet gesynchet)
      const d = await fetch("/api/config").then(r => r.json());
      const cfg = d.config || {};
      const serverBd = cfg[`whiteboard_${bId}`];
      const bds = cfg.whiteboard_boards || ["default"];
      setBoards(bds);
      // Bouw naam-mapping uit gecachte data
      const names = {};
      for (const id of bds) {
        const lc = localStorage.getItem("wb_" + id);
        if (lc) { try { names[id] = JSON.parse(lc).name || id; } catch {} }
        if (!names[id] && cfg[`whiteboard_${id}`]) {
          names[id] = cfg[`whiteboard_${id}`].name || id;
        }
        if (!names[id]) names[id] = id === "default" ? "Standaard" : id;
      }
      setBoardNames(names);
      if (!cached && serverBd) {
        // Geen cache: laad van server
        const cls  = serverBd.cards || [];
        const cnls = serverBd.connections || [];
        setCards(cls); setCons(cnls);
        setBoardName(serverBd.name || "Whiteboard");
        stateRef.current = { cards: cls, connections: cnls };
        dirtyRef.current = true;
      } else if (!cached && !serverBd) {
        // Nieuw bord — leeg canvas
        setCards([]); setCons([]);
        stateRef.current = { cards: [], connections: [] };
        dirtyRef.current = true;
      }
      // cached && serverBd: localStorage wint — recentere staat
    } catch(e) { console.error("Whiteboard laden:", e); }
  }, []);

  useEffect(() => { loadBoard(activeBoard); }, [activeBoard]);

  // Canvas hertekenen als state wijzigt
  useEffect(() => { dirtyRef.current = true; }, [cards, connections]);

  // ── Canvas coordinaten ───────────────────────────────────────────────────
  const toWorld = (sx, sy) => {
    const v = viewRef.current;
    return { x: (sx - v.ox) / v.scale, y: (sy - v.oy) / v.scale };
  };
  const toScreen = (wx, wy) => {
    const v = viewRef.current;
    return { x: wx * v.scale + v.ox, y: wy * v.scale + v.oy };
  };

  const cardAt = (sx, sy) => {
    const { x, y } = toWorld(sx, sy);
    const cds = stateRef.current.cards;
    // Zoek van achter naar voren (bovenste kaart eerst)
    for (let i = cds.length - 1; i >= 0; i--) {
      const c = cds[i];
      if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
    }
    return null;
  };

  // ── Canvas render ─────────────────────────────────────────────────────────
  useEffect(() => {
    const cv = cvRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const r = cv.parentElement.getBoundingClientRect();
      cv.width  = r.width  * dpr;
      cv.height = r.height * dpr;
      cv.style.width  = r.width  + "px";
      cv.style.height = r.height + "px";
      ctx.scale(dpr, dpr);
      dirtyRef.current = true;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv.parentElement);

    const tick = () => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        const CW = cv.width / dpr, CH = cv.height / dpr;
        const v  = viewRef.current;
        const { cards: cds, connections: cons } = stateRef.current;

        ctx.clearRect(0, 0, CW, CH);

        // Raster (fijn, Notion-stijl)
        const gridSize = 24 * v.scale;
        const offX = ((v.ox % gridSize) + gridSize) % gridSize;
        const offY = ((v.oy % gridSize) + gridSize) % gridSize;
        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.lineWidth = 0.5;
        for (let x = offX; x < CW; x += gridSize) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke();
        }
        for (let y = offY; y < CH; y += gridSize) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
        }

        // Verbindingen
        cons.forEach(con => {
          const a = cds.find(c => c.id === con.from);
          const b = cds.find(c => c.id === con.to);
          if (!a || !b) return;
          const ax = toScreen(a.x + a.w/2, a.y + a.h/2);
          const bx = toScreen(b.x + b.w/2, b.y + b.h/2);
          ctx.beginPath();
          ctx.strokeStyle = con.color || "rgba(138,198,242,0.4)";
          ctx.lineWidth = (1.5 * v.scale);
          ctx.setLineDash([]);
          // Gebogen lijn
          const mx = (ax.x + bx.x) / 2, my = (ax.y + bx.y) / 2 - 20 * v.scale;
          ctx.moveTo(ax.x, ax.y);
          ctx.quadraticCurveTo(mx, my, bx.x, bx.y);
          ctx.stroke();
          // Pijlpunt
          const angle = Math.atan2(bx.y - my, bx.x - mx);
          const hs = 8 * v.scale;
          ctx.fillStyle = con.color || "rgba(138,198,242,0.6)";
          ctx.beginPath();
          ctx.moveTo(bx.x, bx.y);
          ctx.lineTo(bx.x - hs * Math.cos(angle - 0.4), bx.y - hs * Math.sin(angle - 0.4));
          ctx.lineTo(bx.x - hs * Math.cos(angle + 0.4), bx.y - hs * Math.sin(angle + 0.4));
          ctx.closePath();
          ctx.fill();
          // Label
          if (con.label) {
            ctx.font = `${11 * v.scale}px 'DM Sans', sans-serif`;
            ctx.fillStyle = "rgba(200,190,180,0.8)";
            ctx.textAlign = "center";
            ctx.fillText(con.label, (ax.x + bx.x)/2, (ax.y + bx.y)/2 - 6 * v.scale);
          }
        });

        // Kaarten
        cds.forEach(c => {
          const sx = toScreen(c.x, c.y);
          const sw = c.w * v.scale, sh = c.h * v.scale;
          const col = COLORS[c.colorIdx || 0];
          const isSel = c.id === selected;

          // Afbeelding-kaart
          if (c.imgUrl) {
            if (!imgCache.current[c.imgUrl]) {
              const img = new Image();
              img.onload = () => { imgCache.current[c.imgUrl] = img; dirtyRef.current = true; };
              img.src = c.imgUrl;
              imgCache.current[c.imgUrl] = null;
            }
            const img = imgCache.current[c.imgUrl];
            const sw = c.w * v.scale, sh = c.h * v.scale;
            ctx.strokeStyle = isSel ? "#7dd8c6" : "#2a3a40";
            ctx.lineWidth   = isSel ? 2.5 : 1;
            roundRect(ctx, sx.x, sx.y, sw, sh, 6 * v.scale); ctx.stroke();
            if (img) {
              ctx.save();
              roundRect(ctx, sx.x, sx.y, sw, sh, 6 * v.scale); ctx.clip();
              const ir = img.width / img.height, cr = sw / sh;
              let dx=0,dy=0,dw=sw,dh=sh;
              if (ir > cr) { dw = sh * ir; dx = (sw - dw) / 2; }
              else         { dh = sw / ir; dy = (sh - dh) / 2; }
              ctx.drawImage(img, sx.x + dx, sx.y + dy, dw, dh);
              ctx.restore();
            } else {
              ctx.fillStyle = "#0f1518";
              roundRect(ctx, sx.x, sx.y, sw, sh, 6*v.scale); ctx.fill();
              ctx.fillStyle = "#4e6a70"; ctx.font = `${14*v.scale}px sans-serif`;
              ctx.textAlign = "center"; ctx.textBaseline = "middle";
              ctx.fillText("⏳", sx.x + sw/2, sx.y + sh/2);
            }
            if (isSel) {
              ctx.strokeStyle = "#7dd8c6"; ctx.lineWidth = 2.5;
              roundRect(ctx, sx.x-1, sx.y-1, sw+2, sh+2, 7*v.scale); ctx.stroke();
            }
            return; // forEach: skip rest van kaart-render
          }

          // Schaduw voor geselecteerde kaart
          if (isSel) {
            ctx.shadowColor = col.border;
            ctx.shadowBlur  = 12 * v.scale;
          }

          // Achtergrond
          ctx.fillStyle = c.noteId ? "rgba(138,198,242,0.08)" : col.bg;
          ctx.strokeStyle = isSel ? col.border : (c.noteId ? "#8ac6f2" : col.border + "80");
          ctx.lineWidth = isSel ? 1.5 : 0.8;
          roundRect(ctx, sx.x, sx.y, sw, sh, 6 * v.scale);
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0; ctx.shadowColor = "transparent";

          // Notitie-indicator
          if (c.noteId) {
            ctx.fillStyle = "#8ac6f2";
            ctx.font = `${9 * v.scale}px 'DM Sans', sans-serif`;
            ctx.textAlign = "left";
            ctx.fillText("⬡ notitie", sx.x + 6 * v.scale, sx.y + 11 * v.scale);
          }

          // Tekst
          const textY = c.noteId ? sx.y + 18 * v.scale : sx.y + 10 * v.scale;
          ctx.fillStyle = col.text;
          ctx.textAlign = "left";
          const fontSize = Math.max(9, Math.min(14, 13 * v.scale));
          ctx.font = `${fontSize}px 'DM Sans', sans-serif`;

          // Tekst wrappen
          const maxW = sw - 12 * v.scale;
          const lineH = fontSize * 1.45;
          const lines = wrapText(ctx, c.text || "", maxW);
          const maxLines = Math.floor((sh - (textY - sx.y) - 8 * v.scale) / lineH);
          lines.slice(0, maxLines).forEach((ln, i) => {
            if (i === maxLines - 1 && lines.length > maxLines) ln = ln.slice(0,-2) + "…";
            ctx.fillText(ln, sx.x + 6 * v.scale, textY + i * lineH + fontSize);
          });

          // Verbind-hint als tool === connect en hover
          if (tool === "connect" && c.id === connectFrom) {
            ctx.strokeStyle = col.border;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 3]);
            roundRect(ctx, sx.x - 2, sx.y - 2, sw + 4, sh + 4, 8 * v.scale);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        });

        ctx.setLineDash([]);
      }
      afRef.current = requestAnimationFrame(tick);
    };
    afRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(afRef.current); ro.disconnect(); };
  }, [selected, tool, connectFrom]);

  // ── Hulpfuncties ──────────────────────────────────────────────────────────
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function wrapText(ctx, text, maxWidth) {
    if (!text) return [""];
    const words = text.split(" ");
    const lines = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width > maxWidth && cur) {
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }

  // ── Kaarten aanmaken ─────────────────────────────────────────────────────
  // Alle mutaties gaan via stateRef — nooit stale closure-state
  const addCard = useCallback((wx, wy, text = "", colorIdx = 0, noteId = null) => {
    const card = { id: genId(), x: wx - 80, y: wy - 40, w: 160, h: 80, text, colorIdx, noteId };
    const next = [...stateRef.current.cards, card];
    stateRef.current = { ...stateRef.current, cards: next };
    setCards(next);
    saveBoard(next, stateRef.current.connections);
    return card;
  }, [saveBoard]);

  const updateCard = useCallback((id, patch) => {
    const next = stateRef.current.cards.map(c => c.id === id ? { ...c, ...patch } : c);
    stateRef.current = { ...stateRef.current, cards: next };
    setCards(next);
    saveBoard(next, stateRef.current.connections);
  }, [saveBoard]);

  const deleteCard = useCallback((id) => {
    const nextCards = stateRef.current.cards.filter(c => c.id !== id);
    const nextCons  = stateRef.current.connections.filter(c => c.from !== id && c.to !== id);
    stateRef.current = { cards: nextCards, connections: nextCons };
    setCards(nextCards); setCons(nextCons); setSelected(null);
    saveBoard(nextCards, nextCons);
  }, [saveBoard]);

  const addConnection = useCallback((fromId, toId) => {
    if (fromId === toId) return;
    const existing = stateRef.current.connections;
    if (existing.find(c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId))) return;
    const next = [...existing, { id: genId(), from: fromId, to: toId }];
    stateRef.current = { ...stateRef.current, connections: next };
    setCons(next);
    saveBoard(stateRef.current.cards, next);
  }, [saveBoard]);

  // ── Kaart → notitie ────────────────────────────────────────────────────────
  const cardToNote = async (card) => {
    if (!onCreateNote || !card.text) return;
    const note = await onCreateNote({ title: card.text.split("\n")[0].slice(0, 80), content: card.text });
    if (note?.id) {
      updateCard(card.id, { noteId: note.id, colorIdx: 1 });
    }
  };

  // ── Canvas context bouwen voor AI ─────────────────────────────────────────
  const buildCanvasContext = () => {
    const typeLabels = { fleeting: "vluchtig", literature: "literatuur",
                         permanent: "permanent", index: "index" };
    const cardLines = cards.map(c => {
      const type = c.noteType ? ` [${typeLabels[c.noteType] || c.noteType}]` : "";
      const linked = c.noteId ? " [gekoppeld aan notitie]" : "";
      return `- "${c.text || "(leeg)"}"${type}${linked}`;
    });
    const conLines = connections.map(c => {
      const from = cards.find(x => x.id === c.from)?.text || "?";
      const to   = cards.find(x => x.id === c.to)?.text   || "?";
      return `  "${from}" → "${to}"`;
    });
    let ctx = `Canvas: ${boardName}\nKaarten (${cards.length}):\n${cardLines.join("\n")}`;
    if (conLines.length) ctx += `\nVerbindingen:\n${conLines.join("\n")}`;
    return ctx;
  };

  // ── AI: analyseer canvas ──────────────────────────────────────────────────
  const runAiAnalyse = async () => {
    if (!llmModel || cards.length < 2) return;
    setAiStreaming(true); setAiResult("");
    const context = buildCanvasContext();
    try {
      const resp = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: llmModel,
          messages: [{ role: "user", content:
            `Analyseer dit canvas en geef een scherpe analyse:\n\n${context}\n\n` +
            `Beantwoord kort:\n` +
            `1. Wat is het centrale thema of de kernvraag?\n` +
            `2. Welke clusters of spanningsvelden zie je?\n` +
            `3. Welke verbindingen ontbreken of zijn verrassend?\n` +
            `4. Wat is de volgende logische stap in dit denken?`
          }],
          system: "Je bent een Socratische onderzoekspartner. Denk hardop mee. Maximaal 200 woorden. Schrijf in lopende tekst, geen genummerde lijsten."
        }),
      });
      const data = await resp.json();
      setAiResult(data.content || data.response || "Geen analyse ontvangen.");
    } catch(e) { setAiResult("Fout bij AI-analyse."); }
    setAiStreaming(false);
  };

  // ── AI: synthese → notitie ────────────────────────────────────────────────
  const runAiSynthese = async () => {
    if (!llmModel || cards.length < 2) return;
    setAiStreaming(true); setAiResult("");
    const context = buildCanvasContext();
    try {
      const resp = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: llmModel,
          messages: [{ role: "user", content:
            `Schrijf een samenhangende notitie op basis van dit canvas.\n\n${context}\n\n` +
            `De notitie moet:\n` +
            `- Beginnen met een sterke openingszin die de kerngedachte vat\n` +
            `- De verbanden tussen de kaarten uitleggen in lopende tekst\n` +
            `- Eindigen met een open vraag of vervolgrichting\n` +
            `- Maximaal 300 woorden zijn\n` +
            `- In markdown geschreven zijn (# voor titel, ## voor secties indien nodig)`
          }],
          system: "Je schrijft helder, compact en in eigen woorden. Geen bullet-lijsten — alleen lopende tekst."
        }),
      });
      const data = await resp.json();
      setAiResult(data.content || data.response || "Geen synthese ontvangen.");
    } catch(e) { setAiResult("Fout bij synthese."); }
    setAiStreaming(false);
  };

  // ── AI: stel vraag over canvas ────────────────────────────────────────────
  const runAiChat = async (userMsg) => {
    if (!llmModel || !userMsg.trim()) return;
    const context = buildCanvasContext();
    const systemPrompt =
      `Je bent een Socratische denkpartner. De gebruiker werkt op dit canvas:\n\n${context}\n\n` +
      `Beantwoord vragen over dit canvas. Stel ook tegenvragen. Maximaal 150 woorden per antwoord.`;
    const newHistory = [...aiHistory, { role: "user", content: userMsg }];
    setAiHistory(newHistory);
    setAiChatInput(""); setAiStreaming(true);
    try {
      const resp = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: llmModel,
          messages: newHistory,
          system: systemPrompt,
        }),
      });
      const data = await resp.json();
      const reply = data.content || data.response || "";
      setAiHistory([...newHistory, { role: "assistant", content: reply }]);
    } catch(e) { setAiHistory([...newHistory, { role: "assistant", content: "Fout bij verzoek." }]); }
    setAiStreaming(false);
  };

  // ── Stuur synthese naar notitie ────────────────────────────────────────────
  const saveResultAsNote = async () => {
    if (!aiResult || !onCreateNote) return;
    const firstLine = aiResult.replace(/^#+ /, "").split("\n")[0].slice(0, 80);
    const note = await onCreateNote({
      title: firstLine || `Canvas — ${boardName}`,
      content: aiResult,
    });
    if (note?.id) {
      // Voeg ook een kaart toe die verwijst naar de nieuwe notitie
      const cv = cvRef.current;
      const dpr = window.devicePixelRatio || 1;
      const CW  = cv ? cv.width / dpr : 600;
      const CH  = cv ? cv.height / dpr : 400;
      const { x, y } = toWorld(CW / 2, CH - 60);
      addCard(x, y, firstLine, 3, note.id); // groen = conclusie/permanent
    }
  };

  // ── Stuur naar Notebook ────────────────────────────────────────────────────
  const sendToNotebook = () => {
    const context = buildCanvasContext();
    const msg = `Ik werk op dit canvas en wil er verder over nadenken:\n\n${context}`;
    // Gebruik window.postMessage om de Notebook tab te openen met context
    window._whiteboardToNotebook = msg;
    // Tab wisselen naar llm (Notebook)
    window._switchToTab?.("llm");
  };

  // Verouderd — vervangen door aiPanel
  const aiSuggestClusters = () => { setAiPanel(true); setAiMode("analyse"); runAiAnalyse(); };

  // ── Mouse/touch handlers ─────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (editingId) return;
    const cv = cvRef.current;
    const r  = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;

    // Panning: middenknop of alt+klik (NIET rechtermuisknop — die is voor contextmenu)
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      panStart.current  = { x: sx, y: sy, ox: viewRef.current.ox, oy: viewRef.current.oy };
      e.preventDefault(); return;
    }
    // Rechtermuisknop: geen panning, contextmenu via onContextMenu
    if (e.button === 2) { e.preventDefault(); return; }

    const card = cardAt(sx, sy);

    if (tool === "connect") {
      if (card) {
        if (!connectFrom) {
          setConnectFrom(card.id);
        } else {
          addConnection(connectFrom, card.id);
          setConnectFrom(null);
          setTool("select");
        }
      }
      return;
    }

    if (tool === "text" || tool === "note") {
      if (!card) {
        const { x, y } = toWorld(sx, sy);
        const newCard = addCard(x, y, "", tool === "note" ? 1 : 0);
        setEditingId(newCard.id);
        setSelected(newCard.id);
        setTool("select");
      }
      return;
    }

    // Select tool
    if (card) {
      setSelected(card.id);
      dragging.current = {
        id: card.id,
        startX: sx, startY: sy,
        startCX: card.x, startCY: card.y,
      };
    } else {
      setSelected(null);
      setConnectFrom(null);
    }
  }, [tool, connectFrom, editingId, cards, connections]);

  const handleMouseMove = useCallback((e) => {
    const cv = cvRef.current;
    const r  = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;

    if (isPanning.current) {
      const ps = panStart.current;
      viewRef.current = { ...viewRef.current, ox: ps.ox + (sx - ps.x), oy: ps.oy + (sy - ps.y) };
      dirtyRef.current = true; return;
    }
    if (dragging.current) {
      const dx = (sx - dragging.current.startX) / viewRef.current.scale;
      const dy = (sy - dragging.current.startY) / viewRef.current.scale;
      const next = cards.map(c =>
        c.id === dragging.current.id
          ? { ...c, x: dragging.current.startCX + dx, y: dragging.current.startCY + dy }
          : c
      );
      setCards(next);
      stateRef.current = { ...stateRef.current, cards: next };
      dirtyRef.current = true;
    }
  }, [cards]);

  const handleMouseUp = useCallback((e) => {
    if (dragging.current) {
      saveBoard(stateRef.current.cards, stateRef.current.connections);
      dragging.current = null;
    }
    isPanning.current = false;
  }, []);

  const handleDblClick = useCallback((e) => {
    const cv = cvRef.current;
    const r  = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const card = cardAt(sx, sy);
    if (card) setEditingId(card.id);
  }, [cards]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const cv = cvRef.current;
    const r  = cv.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const v  = viewRef.current;
    const nx = sx - (sx - v.ox) * factor;
    const ny = sy - (sy - v.oy) * factor;
    viewRef.current = { scale: Math.min(3, Math.max(0.2, v.scale * factor)), ox: nx, oy: ny };
    dirtyRef.current = true;
  }, []);

  // ── Geselecteerde kaart ──────────────────────────────────────────────────
  const selCard = cards.find(c => c.id === selected);

  // ── Render ────────────────────────────────────────────────────────────────
  // ── Sidebar filter: tag-filters + fuzzy/exact ───────────────────────────
  const allSidebarTags = React.useMemo(() => {
    const counts = {};
    notes.forEach(n => (n.tags||[]).forEach(t => { counts[t] = (counts[t]||0) + 1; }));
    return Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0, 30).map(([t]) => t);
  }, [notes]);

  const fuzzyMatch = (text, query) => {
    // Fuzzy: elke letter van query moet in volgorde voorkomen in text
    let ti = 0;
    for (let qi = 0; qi < query.length; qi++) {
      while (ti < text.length && text[ti] !== query[qi]) ti++;
      if (ti >= text.length) return false;
      ti++;
    }
    return true;
  };

  const sidebarNotes = React.useMemo(() => {
    const q = sidebarQuery.toLowerCase().trim();
    let results = notes;

    // Tag-filter eerst
    if (activeTagFilters.size > 0) {
      results = results.filter(n =>
        [...activeTagFilters].every(ft => (n.tags||[]).includes(ft))
      );
    }

    // Tekstzoekopdracht
    if (q) {
      if (searchMode === "exact") {
        results = results.filter(n =>
          n.title?.toLowerCase().includes(q) ||
          n.content?.toLowerCase().includes(q) ||
          (n.tags||[]).some(t => t.toLowerCase().includes(q))
        );
      } else {
        // Fuzzy: scoor op titel (hoogste gewicht), tags, content
        results = results
          .map(n => {
            const title   = (n.title||"").toLowerCase();
            const content = (n.content||"").toLowerCase().slice(0, 500);
            const tags    = (n.tags||[]).join(" ").toLowerCase();
            const titleMatch   = title.includes(q)   ? 3 : fuzzyMatch(title, q)   ? 2 : 0;
            const tagMatch     = tags.includes(q)    ? 2 : fuzzyMatch(tags, q)    ? 1 : 0;
            const contentMatch = content.includes(q) ? 1 : 0;
            const score = titleMatch * 10 + tagMatch * 5 + contentMatch;
            return { note: n, score };
          })
          .filter(({ score }) => score > 0)
          .sort((a, b) => b.score - a.score)
          .map(({ note }) => note);
      }
    }

    return results.slice(0, 80);
  }, [notes, sidebarQuery, searchMode, activeTagFilters]);

  return React.createElement("div", {
    style: { flex: 1, display: "flex", flexDirection: "row",
             overflow: "hidden", minHeight: 0 }
  },

    // ── Sidebar ────────────────────────────────────────────────────────────
    React.createElement("div", {
      style: {
        width: sidebarOpen ? "260px" : "28px",
        flexShrink: 0,
        background: W.bg2,
        borderRight: `1px solid #2a2a2a`,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.15s",
        overflow: "hidden",
        minHeight: 0,
      }
    },
      // Sidebar toggle knop
      React.createElement("div", {
        style: { display: "flex", alignItems: "center", justifyContent: "space-between",
                 padding: "6px 8px", borderBottom: `1px solid #2a2a2a`, flexShrink: 0 }
      },
        sidebarOpen && React.createElement("div", {
          style: { display: "flex", gap: "2px" }
        },
          ["search", "notes", "images"].map(t =>
            React.createElement("button", {
              key: t,
              onClick: () => setSidebarTab(t),
              style: {
                background: sidebarTab === t ? "rgba(125,216,198,0.1)" : "transparent",
                border: `1px solid ${sidebarTab === t ? "rgba(125,216,198,0.3)" : "transparent"}`,
                borderRadius: "4px", color: sidebarTab === t ? W.blue : W.fgMuted,
                padding: "3px 8px", fontSize: "11px", cursor: "pointer",
              }
            }, t === "search" ? "🔍 Zoeken" : t === "notes" ? "📋 Notities" : "🖼 Plaatjes")
          )
        ),
        React.createElement("button", {
          onClick: () => setSidebarOpen(p => !p),
          title: sidebarOpen ? "Sidebar inklappen" : "Sidebar uitklappen",
          style: { background: "none", border: "none", color: W.fgMuted,
                   cursor: "pointer", fontSize: "14px", padding: "2px 4px",
                   marginLeft: "auto" }
        }, sidebarOpen ? "‹" : "›")
      ),

      // Sidebar inhoud
      sidebarOpen && React.createElement("div", {
        style: { flex: 1, display: "flex", flexDirection: "column",
                 overflow: "hidden", minHeight: 0 }
      },
        // Zoekbalk + mode toggle
        React.createElement("div", {
          style: { padding: "8px 8px 6px", borderBottom: `1px solid #2a2a2a`, flexShrink: 0 }
        },
          // Zoek input
          React.createElement("div", {
            style: { position: "relative", marginBottom: "5px" }
          },
            React.createElement("input", {
              placeholder: sidebarTab === "images" ? "Filter plaatjes…" : "Zoek in vault…",
              value: sidebarQuery,
              onChange: e => setSidebarQuery(e.target.value),
              style: {
                width: "100%", background: "#1a1a1a",
                border: `1px solid #2a2a2a`, borderRadius: "5px",
                color: W.fg, padding: "5px 8px 5px 26px", fontSize: "12px",
                outline: "none", boxSizing: "border-box",
              }
            }),
            React.createElement("span", {
              style: { position: "absolute", left: "8px", top: "5px",
                       fontSize: "12px", color: W.fgMuted, pointerEvents: "none" }
            }, "🔍")
          ),
          // Fuzzy / Exact toggle
          React.createElement("div", {
            style: { display: "flex", gap: "3px", marginBottom: "5px" }
          },
            ["fuzzy", "exact"].map(mode =>
              React.createElement("button", {
                key: mode,
                onClick: () => setSearchMode(mode),
                title: mode === "fuzzy" ? "Fuzzy: vindt ook gedeeltelijke matches" : "Exact: alleen exacte woordmatches",
                style: {
                  flex: 1, padding: "2px 0", fontSize: "10px", cursor: "pointer",
                  background: searchMode === mode ? "rgba(138,198,242,0.12)" : "transparent",
                  border: `1px solid ${searchMode === mode ? "rgba(138,198,242,0.3)" : "#2a2a2a"}`,
                  borderRadius: "4px",
                  color: searchMode === mode ? W.blue : W.fgMuted,
                }
              }, mode === "fuzzy" ? "≈ Fuzzy" : "= Exact")
            )
          ),
          // Tag-filters
          allSidebarTags.length > 0 && React.createElement("div", {
            style: { display: "flex", flexWrap: "wrap", gap: "3px", maxHeight: "72px", overflowY: "auto" }
          },
            allSidebarTags.map(tag =>
              React.createElement("button", {
                key: tag,
                onClick: () => setActiveTagFilters(prev => {
                  const next = new Set(prev);
                  next.has(tag) ? next.delete(tag) : next.add(tag);
                  return next;
                }),
                style: {
                  fontSize: "10px", padding: "2px 6px", borderRadius: "10px",
                  cursor: "pointer", transition: "all .1s",
                  background: activeTagFilters.has(tag) ? "rgba(159,202,86,0.2)" : "rgba(159,202,86,0.06)",
                  border: `1px solid ${activeTagFilters.has(tag) ? "rgba(159,202,86,0.6)" : "rgba(159,202,86,0.2)"}`,
                  color: activeTagFilters.has(tag) ? W.comment : W.fgMuted,
                  fontWeight: activeTagFilters.has(tag) ? "600" : "400",
                }
              }, "#" + tag)
            )
          ),
          // Actieve filters tonen
          activeTagFilters.size > 0 && React.createElement("div", {
            style: { marginTop: "4px", display: "flex", alignItems: "center",
                     gap: "4px", fontSize: "10px", color: W.fgMuted }
          },
            `${sidebarNotes.length} resultaten`,
            React.createElement("button", {
              onClick: () => setActiveTagFilters(new Set()),
              style: { background: "none", border: "none", color: W.orange,
                       cursor: "pointer", fontSize: "10px", padding: "0 2px" }
            }, "× wis filters")
          )
        ),

        // Resultaten
        React.createElement("div", {
          style: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }
        },
          // ── Afbeeldingen tab ──────────────────────────────────────────────
          sidebarTab === "images" && (() => {
            const q = sidebarQuery.toLowerCase();
            // serverImages is array van {name, url, size, ...} objecten
            const imgs = serverImages.filter(img =>
              !q || (img.name || "").toLowerCase().includes(q)
            ).slice(0, 40);
            if (!imgs.length) return React.createElement("div", {
              style: { padding: "20px 12px", fontSize: "12px",
                       color: W.fgMuted, textAlign: "center" }
            }, "Geen afbeeldingen gevonden");
            return React.createElement("div", {
              style: { display: "grid", gridTemplateColumns: "1fr 1fr",
                       gap: "6px", padding: "8px" }
            },
              imgs.map(imgObj => {
                const fname = imgObj.name || "";
                const imgUrl = imgObj.url || ("/api/images/" + fname);
                const label = fname.replace(/\.[^.]+$/, "");
                return React.createElement("div", {
                  key: fname,
                  style: { position: "relative", cursor: "pointer",
                           borderRadius: "5px", overflow: "hidden",
                           border: "1px solid #1a2428",
                           aspectRatio: "4/3", background: "#0a0e10" },
                  title: fname,
                  onClick: () => {
                    const cv = cvRef.current;
                    const dpr = window.devicePixelRatio || 1;
                    const CW = cv ? cv.width/dpr : 600;
                    const CH = cv ? cv.height/dpr : 400;
                    const {x,y} = toWorld(
                      CW/2 + (Math.random()-0.5)*200,
                      CH/2 + (Math.random()-0.5)*150
                    );
                    const el = new Image();
                    el.onload = () => {
                      const aspect = el.width / el.height;
                      const cardW = 200;
                      const cardH = Math.round(cardW / aspect);
                      const card = {
                        id: genId(),
                        x: x - cardW/2, y: y - cardH/2,
                        w: cardW, h: cardH,
                        text: label,
                        colorIdx: 0,
                        noteId: null,
                        imgUrl: imgUrl,
                      };
                      const next = [...stateRef.current.cards, card];
                      stateRef.current = { ...stateRef.current, cards: next };
                      setCards(next);
                      saveBoard(next, stateRef.current.connections);
                    };
                    el.src = imgUrl;
                  }
                },
                  React.createElement("img", {
                    src: imgUrl,
                    style: { width: "100%", height: "100%",
                             objectFit: "cover", display: "block" },
                    loading: "lazy",
                  }),
                  React.createElement("div", {
                    style: {
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      background: "rgba(0,0,0,0.6)",
                      padding: "2px 4px", fontSize: "8px", color: "#9db8b4",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }
                  }, label)
                );
              })
            );
          })(),

          // ── Notities / Zoeken tab ─────────────────────────────────────────
          sidebarTab !== "images" && (sidebarNotes.length === 0
            ? React.createElement("div", {
                style: { padding: "20px 12px", fontSize: "12px",
                         color: W.fgMuted, textAlign: "center" }
              }, "Geen resultaten")
            : sidebarNotes.map(n =>
                React.createElement("div", {
                  key: n.id,
                  style: {
                    padding: "8px 10px",
                    borderBottom: `1px solid #222`,
                    cursor: "pointer",
                    transition: "background .1s",
                  },
                  onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.04)",
                  onMouseLeave: e => e.currentTarget.style.background = "transparent",
                },
                  // Titel
                  React.createElement("div", {
                    style: { fontSize: "12px", color: W.fg, fontWeight: "500",
                             overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                             marginBottom: "2px" }
                  }, n.title || "(geen titel)"),
                  // Tags
                  (n.tags||[]).length > 0 && React.createElement("div", {
                    style: { display: "flex", gap: "3px", flexWrap: "wrap", marginBottom: "4px" }
                  },
                    (n.tags||[]).slice(0,3).map(t =>
                      React.createElement("span", {
                        key: t,
                        style: { fontSize: "9px", color: W.comment,
                                 background: "rgba(159,202,86,0.1)",
                                 borderRadius: "3px", padding: "1px 4px" }
                      }, "#"+t)
                    )
                  ),
                  // Knopjes
                  React.createElement("div", {
                    style: { display: "flex", gap: "4px" }
                  },
                    React.createElement("button", {
                      onClick: (e) => {
                        e.stopPropagation();
                        // Voeg toe als kaart op het canvas (midden)
                        const cv = cvRef.current;
                        const dpr = window.devicePixelRatio || 1;
                        const CW = cv ? cv.width / dpr : 600;
                        const CH = cv ? cv.height / dpr : 400;
                        const { x, y } = toWorld(
                          CW/2 + (Math.random()-0.5)*200,
                          CH/2 + (Math.random()-0.5)*150
                        );
                        addCard(x, y, n.title, 1, n.id);
                      },
                      style: {
                        fontSize: "10px", padding: "2px 7px",
                        background: "rgba(138,198,242,0.08)",
                        border: `1px solid rgba(138,198,242,0.2)`,
                        borderRadius: "3px", color: W.blue, cursor: "pointer",
                      }
                    }, "+ canvas"),
                    // Snippet van content
                    n.content && React.createElement("span", {
                      title: n.content.slice(0, 200),
                      style: { fontSize: "10px", color: W.fgMuted,
                               overflow: "hidden", textOverflow: "ellipsis",
                               whiteSpace: "nowrap", flex: 1,
                               alignSelf: "center" }
                    }, n.content.replace(/^---[\s\S]*?---/, "").trim().slice(0, 60))
                  )
                )
              )
        ),

        // ── Legenda ────────────────────────────────────────────────────────
        React.createElement("div", {
          style: {
            flexShrink: 0,
            borderTop: `1px solid #2a2a2a`,
            padding: "10px 10px 8px",
            background: "#161616",
          }
        },
          React.createElement("div", {
            style: { fontSize: "9px", color: W.fgMuted, letterSpacing: "1px",
                     textTransform: "uppercase", marginBottom: "7px" }
          }, "Kleurlegenda"),
          COLORS.map((col, i) => React.createElement("div", {
            key: i,
            style: { display: "flex", alignItems: "center", gap: "7px",
                     marginBottom: "4px" }
          },
            React.createElement("div", {
              style: { width: "10px", height: "10px", borderRadius: "50%",
                       background: col.border, flexShrink: 0 }
            }),
            React.createElement("span", {
              style: { fontSize: "11px", color: W.fgMuted }
            }, [
              "Idee / vluchtig",
              "Bron / notitie",
              "Vraag / spanning",
              "Conclusie / inzicht",
              "Onbekend / onderzoeken",
              "Neutraal / overig",
            ][i])
          )),
          React.createElement("div", {
            style: { borderTop: `1px solid #2a2a2a`, marginTop: "8px",
                     paddingTop: "7px" }
          },
            React.createElement("div", {
              style: { fontSize: "9px", color: W.fgMuted, letterSpacing: "1px",
                       textTransform: "uppercase", marginBottom: "5px" }
            }, "Bediening"),
            [
              ["Klik", "selecteer kaart"],
              ["Dubbelklik", "bewerk tekst"],
              ["Alt + sleep", "pan canvas"],
              ["Scroll", "zoom in/uit"],
              ["Rechts­klik", "contextmenu"],
            ].map(([key, val]) => React.createElement("div", {
              key,
              style: { display: "flex", justifyContent: "space-between",
                       fontSize: "10px", marginBottom: "2px" }
            },
              React.createElement("span", {
                style: { color: "#4a4a4a", fontFamily: "'Hack', monospace",
                         background: "#222", padding: "0 4px",
                         borderRadius: "3px", fontSize: "9px" }
              }, key),
              React.createElement("span", {
                style: { color: W.fgMuted }
              }, val)
            ))
          )
        )
      )
    )   // sluit sidebarOpen-inhoud
  ),    // sluit sidebar div

    // ── Hoofd canvas kolom ──────────────────────────────────────────────────
    React.createElement("div", {
      style: { flex: 1, display: "flex", flexDirection: "column",
               overflow: "hidden", minHeight: 0, background: "#181818",
               position: "relative" }
    },

    // ── Toolbar ────────────────────────────────────────────────────────────
    React.createElement("div", {
      style: { background: W.bg2, borderBottom: `1px solid #2a2a2a`,
               padding: "6px 12px", display: "flex", alignItems: "center",
               gap: "6px", flexShrink: 0, flexWrap: "wrap" }
    },

      // Bord naam + menu
      React.createElement("div", { style: { position: "relative" } },
        React.createElement("button", {
          onClick: () => setShowBoardMenu(p => !p),
          style: { background: "none", border: `1px solid #2a2a2a`, borderRadius: "5px",
                   color: W.fg, padding: "3px 10px", fontSize: "12px", cursor: "pointer",
                   display: "flex", alignItems: "center", gap: "5px" }
        }, boardName, React.createElement("span", { style: { opacity: .5, fontSize: "10px" } }, "▾")),
        showBoardMenu && React.createElement("div", {
          style: { position: "absolute", top: "calc(100% + 4px)", left: 0,
                   background: W.bg2, border: `1px solid ${W.splitBg}`,
                   borderRadius: "8px", zIndex: 100, minWidth: "220px",
                   boxShadow: "0 8px 32px rgba(0,0,0,0.7)", overflow: "hidden" }
        },
          // Header
          React.createElement("div", {
            style: { padding: "8px 12px 6px", fontSize: "9px", color: W.fgMuted,
                     letterSpacing: "1px", textTransform: "uppercase",
                     borderBottom: `1px solid ${W.splitBg}` }
          }, `Whiteboards (${boards.length})`),

          // Board lijst
          React.createElement("div", {
            style: { maxHeight: "260px", overflowY: "auto" }
          },
            boards.map(bid => {
              const name = boardNames[bid] || (bid === "default" ? "Standaard" : bid);
              const isActive = bid === activeBoard;
              const cardCount = (() => {
                try {
                  const cached = localStorage.getItem("wb_" + bid);
                  if (cached) return JSON.parse(cached).cards?.length || 0;
                } catch {}
                return 0;
              })();

              return React.createElement("div", {
                key: bid,
                style: {
                  display: "flex", alignItems: "center",
                  borderBottom: `1px solid ${W.splitBg}`,
                  background: isActive ? "rgba(232,200,122,0.06)" : "transparent",
                  transition: "background .1s",
                }
              },
                // Klik om te selecteren
                React.createElement("div", {
                  onClick: () => { setActiveBoard(bid); setShowBoardMenu(false); },
                  style: {
                    flex: 1, padding: "9px 12px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "8px", minWidth: 0,
                  },
                  onMouseEnter: e => { if (!isActive) e.currentTarget.parentElement.style.background = "rgba(255,255,255,0.04)"; },
                  onMouseLeave: e => { if (!isActive) e.currentTarget.parentElement.style.background = "transparent"; },
                },
                  // Actief icoon
                  React.createElement("div", {
                    style: {
                      width: "6px", height: "6px", borderRadius: "50%",
                      background: isActive ? W.yellow : "#333",
                      flexShrink: 0,
                    }
                  }),
                  // Naam
                  renamingBoard === bid
                    ? React.createElement("input", {
                        autoFocus: true,
                        defaultValue: name,
                        onClick: e => e.stopPropagation(),
                        onKeyDown: e => {
                          if (e.key === "Enter") {
                            const newName = e.target.value.trim() || name;
                            setBoardNames(p => ({...p, [bid]: newName}));
                            if (bid === activeBoard) setBoardName(newName);
                            saveBoard(
                              stateRef.current.cards,
                              stateRef.current.connections,
                              bid, newName
                            );
                            setRenamingBoard(null);
                          }
                          if (e.key === "Escape") setRenamingBoard(null);
                        },
                        onBlur: e => {
                          const newName = e.target.value.trim() || name;
                          setBoardNames(p => ({...p, [bid]: newName}));
                          if (bid === activeBoard) setBoardName(newName);
                          saveBoard(stateRef.current.cards, stateRef.current.connections, bid, newName);
                          setRenamingBoard(null);
                        },
                        style: {
                          flex: 1, background: "#111", color: W.fg,
                          border: `1px solid ${W.blue}`, borderRadius: "3px",
                          padding: "1px 5px", fontSize: "12px", outline: "none",
                        }
                      })
                    : React.createElement("span", {
                        style: {
                          fontSize: "12px",
                          color: isActive ? W.yellow : W.fg,
                          fontWeight: isActive ? "600" : "400",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          flex: 1,
                        }
                      }, name),
                  // Kaarten-badge
                  cardCount > 0 && React.createElement("span", {
                    style: {
                      fontSize: "9px", color: W.fgMuted,
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: "8px", padding: "1px 5px", flexShrink: 0,
                    }
                  }, cardCount)
                ),

                // Acties (hernoem + verwijder)
                React.createElement("div", {
                  style: { display: "flex", gap: "2px", padding: "0 6px", flexShrink: 0 }
                },
                  // Hernoem
                  React.createElement("button", {
                    onClick: e => {
                      e.stopPropagation();
                      setRenamingBoard(bid);
                    },
                    title: "Hernoem bord",
                    style: {
                      background: "none", border: "none", color: W.fgMuted,
                      cursor: "pointer", fontSize: "11px", padding: "3px 5px",
                      borderRadius: "3px",
                    },
                    onMouseEnter: e => { e.currentTarget.style.color = W.fg; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; },
                    onMouseLeave: e => { e.currentTarget.style.color = W.fgMuted; e.currentTarget.style.background = "none"; },
                  }, "✎"),

                  // Verwijder (niet voor default of enig overgebleven bord)
                  boards.length > 1 && React.createElement("button", {
                    onClick: e => {
                      e.stopPropagation();
                      if (!confirm(`Bord "${name}" verwijderen? Alle kaarten gaan verloren.`)) return;
                      const updated = boards.filter(b => b !== bid);
                      setBoards(updated);
                      setBoardNames(p => { const n = {...p}; delete n[bid]; return n; });
                      // Verwijder uit localStorage
                      try { localStorage.removeItem("wb_" + bid); } catch {}
                      // Verwijder van server
                      fetch("/api/config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          [`whiteboard_${bid}`]: null,
                          whiteboard_boards: updated,
                        }),
                      }).catch(() => {});
                      // Switch naar ander bord als huidig verwijderd
                      if (bid === activeBoard) {
                        const next = updated[0] || "default";
                        setActiveBoard(next);
                      }
                      setShowBoardMenu(false);
                    },
                    title: "Verwijder bord",
                    style: {
                      background: "none", border: "none", color: W.fgMuted,
                      cursor: "pointer", fontSize: "13px", padding: "3px 5px",
                      borderRadius: "3px",
                    },
                    onMouseEnter: e => { e.currentTarget.style.color = W.orange; e.currentTarget.style.background = "rgba(245,169,127,0.1)"; },
                    onMouseLeave: e => { e.currentTarget.style.color = W.fgMuted; e.currentTarget.style.background = "none"; },
                  }, "×")
                )
              );
            })
          ),

          // Nieuw bord
          React.createElement("div", {
            style: { borderTop: `1px solid ${W.splitBg}` }
          },
            React.createElement("div", {
              onClick: () => {
                const nm = prompt("Naam nieuw bord:");
                if (!nm?.trim()) return;
                const bid = genId();
                setBoards(p => [...p, bid]);
                setBoardNames(p => ({...p, [bid]: nm.trim()}));
                setActiveBoard(bid);
                setBoardName(nm.trim());
                setCards([]); setCons([]);
                stateRef.current = { cards: [], connections: [] };
                saveBoard([], [], bid, nm.trim());
                setShowBoardMenu(false);
              },
              style: {
                padding: "9px 14px", fontSize: "12px", cursor: "pointer",
                color: W.blue, display: "flex", alignItems: "center", gap: "6px",
                transition: "background .1s",
              },
              onMouseEnter: e => e.currentTarget.style.background = "rgba(125,216,198,0.06)",
              onMouseLeave: e => e.currentTarget.style.background = "transparent",
            },
              React.createElement("span", {style:{fontSize:"14px"}}, "+"),
              "Nieuw bord"
            )
          )
        )
      ),

      React.createElement("div", { style: { width: "1px", height: "20px", background: "#2a2a2a" } }),

      // Tool knoppen
      ...[
        { id: "select",  label: "↖ selecteer", title: "Selecteren en slepen" },
        { id: "text",    label: "✎ kaart",      title: "Klik om nieuwe kaart te plaatsen" },
        { id: "connect", label: "⤳ verbind",    title: "Klik twee kaarten om te verbinden" },
      ].map(t =>
        React.createElement("button", {
          key: t.id,
          onClick: () => { setTool(t.id); setConnectFrom(null); },
          title: t.title,
          style: {
            background: tool === t.id ? "rgba(138,198,242,0.12)" : "transparent",
            border: `1px solid ${tool === t.id ? "rgba(138,198,242,0.3)" : "transparent"}`,
            borderRadius: "5px", color: tool === t.id ? W.blue : W.fgMuted,
            padding: "3px 10px", fontSize: "12px", cursor: "pointer",
            transition: "all .12s",
          }
        }, t.label)
      ),

      React.createElement("div", { style: { flex: 1 } }),

      // Kleur picker voor geselecteerde kaart
      selCard && React.createElement("div", {
        style: { display: "flex", gap: "4px", alignItems: "center" }
      },
        COLORS.map((col, i) =>
          React.createElement("button", {
            key: i,
            onClick: () => updateCard(selCard.id, { colorIdx: i }),
            title: col.name,
            style: {
              width: "14px", height: "14px", borderRadius: "50%",
              background: col.border,
              border: selCard.colorIdx === i ? `2px solid white` : "1.5px solid transparent",
              cursor: "pointer", padding: 0,
              opacity: selCard.colorIdx === i ? 1 : 0.55,
              transition: "all .1s",
            }
          })
        ),
        React.createElement("div", { style: { width: "1px", height: "16px", background: "#2a2a2a", margin: "0 2px" } })
      ),

      // Geselecteerde kaart acties
      selCard && React.createElement(React.Fragment, null,
        React.createElement("button", {
          onClick: () => setEditingId(selCard.id),
          title: "Tekst bewerken",
          style: { background: "transparent", border: `1px solid transparent`,
                   borderRadius: "5px", color: W.fgMuted,
                   padding: "3px 9px", fontSize: "12px", cursor: "pointer" }
        }, "✎ bewerk"),
        !selCard.noteId && React.createElement("button", {
          onClick: () => cardToNote(selCard),
          title: "Zet om naar notitie in de vault",
          style: { background: "rgba(159,202,86,0.1)", border: `1px solid rgba(159,202,86,0.3)`,
                   borderRadius: "5px", color: W.comment,
                   padding: "3px 9px", fontSize: "12px", cursor: "pointer" }
        }, "→ notitie"),
        React.createElement("button", {
          onClick: () => deleteCard(selCard.id),
          title: "Verwijder kaart",
          style: { background: "transparent", border: `1px solid transparent`,
                   borderRadius: "5px", color: W.orange,
                   padding: "3px 9px", fontSize: "12px", cursor: "pointer" }
        }, "✕"),
      ),

      React.createElement("div", { style: { width: "1px", height: "20px", background: "#2a2a2a" } }),

      // AI analyse knop
      llmModel && React.createElement("button", {
        onClick: () => { setAiPanel(p => !p); if (!aiPanel) { setAiMode("analyse"); } },
        title: "AI-analyse van het canvas",
        style: {
          background: aiPanel ? "rgba(215,135,255,0.12)" : "transparent",
          border: `1px solid ${aiPanel ? "rgba(215,135,255,0.3)" : "transparent"}`,
          borderRadius: "5px",
          color: aiPanel ? W.purple : W.fgMuted,
          padding: "3px 10px", fontSize: "12px", cursor: "pointer",
          opacity: cards.length < 2 ? 0.4 : 1,
          transition: "all .12s",
          display: "flex", alignItems: "center", gap: "4px",
        }
      },
        React.createElement("span", { style: { fontSize: "13px" } }, "✦"),
        "AI"
      ),

      // Notities koppelen
      React.createElement("button", {
        onClick: () => setShowNoteLink(p => !p),
        title: "Sleep een bestaande notitie als kaart op het bord",
        style: { background: showNoteLink ? "rgba(138,198,242,0.1)" : "transparent",
                 border: `1px solid ${showNoteLink ? "rgba(138,198,242,0.3)" : "transparent"}`,
                 borderRadius: "5px", color: showNoteLink ? W.blue : W.fgMuted,
                 padding: "3px 10px", fontSize: "12px", cursor: "pointer" }
      }, "⬡ notitie"),

      // Zoom reset
      React.createElement("button", {
        onClick: () => { viewRef.current = { ox: 0, oy: 0, scale: 1 }; dirtyRef.current = true; },
        title: "Zoom resetten (100%)",
        style: { background: "transparent", border: "none", color: W.fgMuted,
                 padding: "3px 8px", fontSize: "11px", cursor: "pointer" }
      }, "⊙ reset"),
    ),

    // ── Notitie-koppel paneel ────────────────────────────────────────────────
    showNoteLink && React.createElement("div", {
      style: { background: W.bg2, borderBottom: `1px solid #2a2a2a`,
               padding: "8px 12px", flexShrink: 0 }
    },
      React.createElement("div", {
        style: { fontSize: "11px", color: W.fgMuted, marginBottom: "6px" }
      }, "Klik op een notitie om hem als kaart toe te voegen:"),
      React.createElement("input", {
        placeholder: "Notitie zoeken…",
        value: noteLinkSearch,
        onChange: e => setNoteLinkSearch(e.target.value),
        style: { background: W.bg, border: `1px solid ${W.splitBg}`, borderRadius: "4px",
                 color: W.fg, padding: "4px 8px", fontSize: "12px",
                 width: "100%", outline: "none", marginBottom: "6px" }
      }),
      React.createElement("div", {
        style: { display: "flex", flexWrap: "wrap", gap: "4px", maxHeight: "80px", overflowY: "auto" }
      },
        notes
          .filter(n => !noteLinkSearch || n.title.toLowerCase().includes(noteLinkSearch.toLowerCase()))
          .slice(0, 20)
          .map(n =>
            React.createElement("button", {
              key: n.id,
              onClick: () => {
                const { x, y } = toWorld(200 + Math.random() * 300, 150 + Math.random() * 200);
                addCard(x, y, n.title, 1, n.id);
                setShowNoteLink(false);
              },
              style: { background: "rgba(138,198,242,0.08)", border: `1px solid rgba(138,198,242,0.2)`,
                       borderRadius: "4px", color: W.blue, padding: "3px 8px",
                       fontSize: "11px", cursor: "pointer" }
            }, n.title.slice(0, 30))
          )
      )
    ),

    // ── Canvas + edit overlay ───────────────────────────────────────────────
    React.createElement("div", {
      style: { flex: 1, position: "relative", overflow: "hidden", minHeight: 0 }
    },
      React.createElement("canvas", {
        ref: cvRef,
        style: {
          display: "block",
          cursor: tool === "connect" ? "crosshair"
                : tool === "text"    ? "cell"
                : isPanning.current  ? "grabbing" : "default",
        },
        onMouseDown:  handleMouseDown,
        onMouseMove:  handleMouseMove,
        onMouseUp:    handleMouseUp,
        onDoubleClick: handleDblClick,
        onWheel:      handleWheel,
        onContextMenu: (e) => {
          e.preventDefault();
          const cv = cvRef.current;
          const r  = cv.getBoundingClientRect();
          const sx = e.clientX - r.left, sy = e.clientY - r.top;
          const card = cardAt(sx, sy);
          setCtxMenu({
            screenX: e.clientX, screenY: e.clientY,
            canvasX: sx, canvasY: sy,
            cardId: card?.id || null,
          });
        },
      }),

      // Inline tekst-editor (zweeft boven canvas op kaartpositie)
      editingId && (() => {
        const card = cards.find(c => c.id === editingId);
        if (!card) return null;
        const s = toScreen(card.x, card.y);
        const sw = card.w * viewRef.current.scale;
        const sh = card.h * viewRef.current.scale;
        return React.createElement("textarea", {
          autoFocus: true,
          defaultValue: card.text || "",
          onBlur: e => {
            updateCard(editingId, { text: e.target.value });
            setEditingId(null);
          },
          onKeyDown: e => {
            if (e.key === "Escape") {
              updateCard(editingId, { text: e.target.value });
              setEditingId(null);
            }
          },
          style: {
            position: "absolute",
            left: s.x + "px", top: s.y + "px",
            width: sw + "px", height: sh + "px",
            background: COLORS[card.colorIdx || 0].bg,
            border: `2px solid ${COLORS[card.colorIdx || 0].border}`,
            borderRadius: "6px",
            color: COLORS[card.colorIdx || 0].text,
            padding: "6px",
            fontSize: "13px",
            fontFamily: "'DM Sans', system-ui, sans-serif",
            lineHeight: "1.5",
            resize: "none",
            outline: "none",
            zIndex: 50,
          }
        });
      })(),

      // Lege staat hint
      cards.length === 0 && React.createElement("div", {
        style: { position: "absolute", inset: 0, display: "flex",
                 flexDirection: "column", alignItems: "center", justifyContent: "center",
                 pointerEvents: "none" }
      },
        React.createElement("div", {
          style: { textAlign: "center", color: W.fgMuted, fontSize: "14px", lineHeight: "2" }
        },
          React.createElement("div", { style: { fontSize: "32px", marginBottom: "12px", opacity: .3 } }, "⬜"),
          React.createElement("div", { style: { fontWeight: "500", color: W.fgDim } }, "Leeg canvas"),
          React.createElement("div", { style: { fontSize: "12px", opacity: .6 } }, "Klik ✎ kaart in de toolbar, dan klik op het canvas"),
          React.createElement("div", { style: { fontSize: "12px", opacity: .5 } }, "Dubbelklik op een kaart om te bewerken · Alt+sleep om te pannen"),
          React.createElement("div", { style: { fontSize: "12px", opacity: .4 } }, "Scroll om in/uit te zoomen · → notitie om op te slaan in vault")
        )
      ),

      // Verbind-modus hint
      tool === "connect" && connectFrom && React.createElement("div", {
        style: { position: "absolute", bottom: "12px", left: "50%",
                 transform: "translateX(-50%)",
                 background: "rgba(138,198,242,0.15)",
                 border: `1px solid rgba(138,198,242,0.3)`,
                 borderRadius: "20px", padding: "5px 16px",
                 fontSize: "12px", color: W.blue, pointerEvents: "none" }
      }, "Klik nu op de tweede kaart om te verbinden — of Escape om te annuleren"),

      // ── Contextmenu ────────────────────────────────────────────────────────
      ctxMenu && React.createElement("div", {
        ref: ctxMenuRef,
        style: {
          position: "absolute",
          left: Math.min(ctxMenu.screenX - (cvRef.current?.getBoundingClientRect().left||0), (cvRef.current?.offsetWidth||600) - 200),
          top:  Math.min(ctxMenu.screenY - (cvRef.current?.getBoundingClientRect().top||0),  (cvRef.current?.offsetHeight||400) - 320),
          background: "#1e1e1e",
          border: "1px solid #333",
          borderRadius: "8px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
          zIndex: 200,
          minWidth: "188px",
          overflow: "hidden",
          animation: "fadeIn .1s ease-out",
          paddingBottom: "4px",
        }
      },
        // Header
        React.createElement("div", {
          style: { padding: "7px 12px 6px", fontSize: "10px", color: W.fgMuted,
                   letterSpacing: "1px", textTransform: "uppercase",
                   borderBottom: "1px solid #2a2a2a", marginBottom: "4px" }
        }, ctxMenu.cardId ? "Kaart" : "Canvas"),

        // ── KAART-specifieke acties ─────────────────────────────────────────
        ctxMenu.cardId && (() => {
          const card = cards.find(c => c.id === ctxMenu.cardId);
          if (!card) return null;
          const menuItems = [
            {
              label: "✎  Bewerken",
              key: "edit",
              action: () => { setEditingId(card.id); setSelected(card.id); setCtxMenu(null); }
            },
            {
              label: "⤳  Verbinden met…",
              key: "connect",
              action: () => { setTool("connect"); setConnectFrom(card.id); setCtxMenu(null); }
            },
            {
              label: "⬡  → Notitie maken",
              key: "tonote",
              hidden: !!card.noteId,
              action: () => { cardToNote(card); setCtxMenu(null); }
            },
            {
              label: "⬡  Notitie openen",
              key: "opennote",
              hidden: !card.noteId,
              color: W.blue,
              action: () => {
                if (card.noteId) setPeekNoteId(card.noteId);
                setCtxMenu(null);
              }
            },
            { separator: true, key: "sep1" },
            {
              label: "Kleur:",
              key: "colors",
              isColorPicker: true,
            },
            { separator: true, key: "sep2" },
            {
              label: "⊞  Dupliceren",
              key: "dup",
              action: () => {
                const { x, y } = toWorld(ctxMenu.canvasX + 20, ctxMenu.canvasY + 20);
                addCard(x + 20, y + 20, card.text, card.colorIdx, null);
                setCtxMenu(null);
              }
            },
            {
              label: "✕  Verwijderen",
              key: "delete",
              color: W.orange,
              action: () => { deleteCard(card.id); setCtxMenu(null); }
            },
          ];

          return menuItems.map(item => {
            if (item.hidden) return null;
            if (item.separator) return React.createElement("div", {
              key: item.key,
              style: { height: "1px", background: "#2a2a2a", margin: "3px 0" }
            });
            if (item.isColorPicker) return React.createElement("div", {
              key: item.key,
              style: { padding: "3px 12px 5px", display: "flex", alignItems: "center", gap: "6px" }
            },
              React.createElement("span", { style: { fontSize: "11px", color: W.fgMuted } }, "Kleur:"),
              COLORS.map((col, i) =>
                React.createElement("button", {
                  key: i,
                  onClick: () => { updateCard(card.id, { colorIdx: i }); setCtxMenu(null); },
                  title: col.name,
                  style: {
                    width: "14px", height: "14px", borderRadius: "50%",
                    background: col.border, border: card.colorIdx === i ? "2px solid white" : "1.5px solid transparent",
                    cursor: "pointer", padding: 0,
                    opacity: card.colorIdx === i ? 1 : 0.6,
                  }
                })
              )
            );
            return React.createElement("div", {
              key: item.key,
              onClick: item.action,
              style: {
                padding: "7px 12px",
                fontSize: "12px",
                color: item.color || W.fg,
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px",
                transition: "background .08s",
              },
              onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.06)",
              onMouseLeave: e => e.currentTarget.style.background = "transparent",
            }, item.label);
          });
        })(),

        // ── CANVAS-level acties (geen kaart geklikt) ────────────────────────
        !ctxMenu.cardId && (() => {
          const { x, y } = toWorld(ctxMenu.canvasX, ctxMenu.canvasY);
          const canvasItems = [
            {
              label: "✎  Nieuwe kaart hier",
              key: "new",
              action: () => {
                const card = addCard(x, y, "", 0);
                setEditingId(card.id); setSelected(card.id);
                setCtxMenu(null);
              }
            },
            {
              label: "📋  Notitie als kaart",
              key: "notepaste",
              action: () => { setSidebarOpen(true); setSidebarTab("notes"); setCtxMenu(null); }
            },
            { separator: true, key: "sep1" },
            {
              label: "🎨  Gele kaart",
              key: "yellow",
              action: () => { addCard(x, y, "", 0); setCtxMenu(null); }
            },
            {
              label: "🎨  Blauwe kaart",
              key: "blue",
              action: () => { addCard(x, y, "", 1); setCtxMenu(null); }
            },
            {
              label: "🎨  Rode kaart (vraag)",
              key: "red",
              action: () => { addCard(x, y, "", 2); setCtxMenu(null); }
            },
            {
              label: "🎨  Groene kaart (conclusie)",
              key: "green",
              action: () => { addCard(x, y, "", 3); setCtxMenu(null); }
            },
            { separator: true, key: "sep2" },
            {
              label: "⊙  Zoom resetten",
              key: "reset",
              action: () => { viewRef.current = { ox: 0, oy: 0, scale: 1 }; dirtyRef.current = true; setCtxMenu(null); }
            },
            {
              label: "🗑  Alles verwijderen",
              key: "clear",
              color: W.orange,
              action: () => {
                if (confirm("Weet je zeker dat je alle kaarten wilt verwijderen?")) {
                  setCards([]); setCons([]); saveBoard([], []);
                }
                setCtxMenu(null);
              }
            },
          ];

          return canvasItems.map(item => {
            if (item.separator) return React.createElement("div", {
              key: item.key,
              style: { height: "1px", background: "#2a2a2a", margin: "3px 0" }
            });
            return React.createElement("div", {
              key: item.key,
              onClick: item.action,
              style: {
                padding: "7px 12px",
                fontSize: "12px",
                color: item.color || W.fg,
                cursor: "pointer",
                transition: "background .08s",
              },
              onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.06)",
              onMouseLeave: e => e.currentTarget.style.background = "transparent",
            }, item.label);
          });
        })()
      ),
    )
    ),  // sluit hoofd canvas kolom

    // ── AI analyse panel — slide-in rechts ──────────────────────────────
    aiPanel && llmModel && React.createElement("div", {
      style: {
        position: "absolute", top: 0, right: peekNoteId ? "360px" : 0,
        bottom: 0, width: "340px",
        background: "#1a1a1a",
        borderLeft: "1px solid #2a2a2a",
        display: "flex", flexDirection: "column",
        zIndex: 290,
        boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
        animation: "slideInRight .18s ease-out",
      }
    },
      // Header met modi
      React.createElement("div", {
        style: { padding: "8px 12px", borderBottom: "1px solid #2a2a2a",
                 flexShrink: 0 }
      },
        React.createElement("div", {
          style: { display: "flex", alignItems: "center",
                   justifyContent: "space-between", marginBottom: "6px" }
        },
          React.createElement("span", {
            style: { fontSize: "10px", color: W.purple, fontWeight: "600",
                     letterSpacing: "1px", textTransform: "uppercase" }
          }, "✦ AI Canvas"),
          React.createElement("button", {
            onClick: () => setAiPanel(false),
            style: { background: "none", border: "none", color: W.fgMuted,
                     cursor: "pointer", fontSize: "16px", padding: 0 }
          }, "×")
        ),
        // Modi tabs
        React.createElement("div", {
          style: { display: "flex", gap: "3px" }
        },
          [
            { id: "analyse",  label: "Analyseer" },
            { id: "synthese", label: "Synthese"  },
            { id: "chat",     label: "Chat"      },
          ].map(({ id, label }) =>
            React.createElement("button", {
              key: id,
              onClick: () => { setAiMode(id); setAiResult(""); setAiHistory([]); },
              style: {
                flex: 1, padding: "4px 0", fontSize: "11px", cursor: "pointer",
                background: aiMode === id ? "rgba(215,135,255,0.12)" : "transparent",
                border: `1px solid ${aiMode === id ? "rgba(215,135,255,0.4)" : "#2a2a2a"}`,
                borderRadius: "4px",
                color: aiMode === id ? W.purple : W.fgMuted,
                fontWeight: aiMode === id ? "600" : "400",
                transition: "all .1s",
              }
            }, label)
          )
        )
      ),

      // Modus-beschrijving
      React.createElement("div", {
        style: { padding: "8px 12px 6px", flexShrink: 0,
                 borderBottom: "1px solid #1e1e1e" }
      },
        React.createElement("div", {
          style: { fontSize: "10px", color: W.fgMuted, lineHeight: "1.5" }
        }, {
          analyse:  "Wat zijn de clusters, spanningsvelden en ontbrekende verbindingen op dit canvas?",
          synthese: "Verwerk de kaarten tot één samenhangende notitie die direct in de vault past.",
          chat:     "Stel vragen over het canvas. De AI kent de inhoud van alle kaarten.",
        }[aiMode])
      ),

      // Resultaat / chat gebied
      React.createElement("div", {
        style: { flex: 1, overflowY: "auto", padding: "10px 12px",
                 WebkitOverflowScrolling: "touch" }
      },
        // Chat modus
        aiMode === "chat" && aiHistory.map((msg, i) =>
          React.createElement("div", {
            key: i,
            style: {
              marginBottom: "10px",
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }
          },
            React.createElement("div", {
              style: {
                maxWidth: "85%", padding: "7px 10px",
                fontSize: "12px", lineHeight: "1.6",
                borderRadius: msg.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                background: msg.role === "user"
                  ? "rgba(215,135,255,0.15)"
                  : "rgba(255,255,255,0.05)",
                color: msg.role === "user" ? W.purple : W.fg,
                border: `1px solid ${msg.role === "user" ? "rgba(215,135,255,0.3)" : "#2a2a2a"}`,
              }
            }, msg.content)
          )
        ),

        // Analyse / synthese resultaat
        aiMode !== "chat" && aiResult && React.createElement("div", {
          style: { fontSize: "12px", color: W.fg, lineHeight: "1.75",
                   whiteSpace: "pre-wrap", fontFamily: "'DM Sans', system-ui, sans-serif" }
        }, aiResult),

        // Laden indicator
        aiStreaming && React.createElement("div", {
          style: { display: "flex", gap: "4px", alignItems: "center",
                   color: W.purple, fontSize: "12px", padding: "6px 0",
                   animation: "ai-pulse 1.4s ease-in-out infinite" }
        }, "✦ denken…"),

        // Lege staat
        !aiResult && !aiStreaming && aiMode !== "chat" && cards.length >= 2 &&
          React.createElement("div", {
            style: { color: W.fgMuted, fontSize: "12px", fontStyle: "italic",
                     padding: "10px 0" }
          }, "Klik op de knop hieronder om te starten.")
      ),

      // Footer met acties
      React.createElement("div", {
        style: { borderTop: "1px solid #2a2a2a", padding: "8px 10px",
                 flexShrink: 0, display: "flex", flexDirection: "column", gap: "6px" }
      },
        // Chat input
        aiMode === "chat" && React.createElement("div", {
          style: { display: "flex", gap: "5px" }
        },
          React.createElement("input", {
            placeholder: "Stel een vraag over het canvas…",
            value: aiChatInput,
            onChange: e => setAiChatInput(e.target.value),
            onKeyDown: e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runAiChat(aiChatInput); } },
            disabled: aiStreaming,
            style: {
              flex: 1, background: "#111", border: "1px solid #2a2a2a",
              borderRadius: "5px", color: W.fg, padding: "5px 8px",
              fontSize: "12px", outline: "none",
            }
          }),
          React.createElement("button", {
            onClick: () => runAiChat(aiChatInput),
            disabled: !aiChatInput.trim() || aiStreaming,
            style: {
              background: "rgba(215,135,255,0.12)",
              border: "1px solid rgba(215,135,255,0.3)",
              borderRadius: "5px", color: W.purple,
              padding: "5px 10px", fontSize: "12px", cursor: "pointer",
              opacity: (!aiChatInput.trim() || aiStreaming) ? 0.4 : 1,
            }
          }, "→")
        ),

        // Analyse / Synthese start knop
        aiMode !== "chat" && React.createElement("button", {
          onClick: aiMode === "analyse" ? runAiAnalyse : runAiSynthese,
          disabled: aiStreaming || cards.length < 2,
          style: {
            background: "rgba(215,135,255,0.1)",
            border: "1px solid rgba(215,135,255,0.3)",
            borderRadius: "5px", color: W.purple,
            padding: "6px", fontSize: "12px", cursor: "pointer",
            opacity: (aiStreaming || cards.length < 2) ? 0.5 : 1,
            transition: "all .12s",
            animation: aiStreaming ? "ai-pulse 1.4s ease-in-out infinite" : "none",
          }
        }, aiStreaming ? "✦ bezig…" : aiMode === "analyse" ? "✦ Analyseer canvas" : "✦ Genereer notitie"),

        // Resultaat-acties (alleen als er een resultaat is)
        aiResult && !aiStreaming && React.createElement("div", {
          style: { display: "flex", gap: "5px" }
        },
          // Sla op als notitie
          onCreateNote && React.createElement("button", {
            onClick: saveResultAsNote,
            title: "Sla analyse/synthese op als notitie in de vault",
            style: {
              flex: 1, fontSize: "11px", padding: "5px",
              background: "rgba(159,202,86,0.1)",
              border: "1px solid rgba(159,202,86,0.3)",
              borderRadius: "5px", color: W.comment, cursor: "pointer",
            }
          }, "→ vault"),
          // Kopieer naar klembord
          React.createElement("button", {
            onClick: () => {
              navigator.clipboard?.writeText(aiResult);
            },
            title: "Kopieer naar klembord",
            style: {
              fontSize: "11px", padding: "5px 10px",
              background: "transparent",
              border: "1px solid #2a2a2a",
              borderRadius: "5px", color: W.fgMuted, cursor: "pointer",
            }
          }, "📋"),
          // Wis resultaat
          React.createElement("button", {
            onClick: () => setAiResult(""),
            title: "Wis resultaat",
            style: {
              fontSize: "11px", padding: "5px 8px",
              background: "transparent", border: "none",
              color: W.fgMuted, cursor: "pointer",
            }
          }, "×")
        )
      )
    ),

    // ── Notitie peek panel — slide-in rechts ─────────────────────────────
    peekNoteId && (() => {
      const peekNote = notes.find(n => n.id === peekNoteId);
      const typeColors = {
        fleeting: "#e8a44a", literature: W.blue,
        permanent: W.comment, index: W.purple,
      };
      const typeLabels = {
        fleeting: "Vluchtig", literature: "Literatuur",
        permanent: "Permanent", index: "Index",
      };
      return React.createElement("div", {
        style: {
          position: "absolute", top: 0, right: 0, bottom: 0,
          width: "360px",
          background: W.bg2,
          borderLeft: "1px solid #2a2a2a",
          display: "flex", flexDirection: "column",
          zIndex: 300,
          boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
          animation: "slideInRight .18s ease-out",
        }
      },
        // Header
        React.createElement("div", {
          style: {
            padding: "10px 14px 8px",
            borderBottom: "1px solid #2a2a2a",
            flexShrink: 0,
            display: "flex", alignItems: "flex-start", gap: "8px",
          }
        },
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            peekNote?.noteType && React.createElement("div", {
              style: {
                display: "inline-flex", alignItems: "center", gap: "4px",
                fontSize: "9px", color: typeColors[peekNote.noteType] || W.fgMuted,
                background: `${typeColors[peekNote.noteType] || W.fgMuted}18`,
                border: `1px solid ${typeColors[peekNote.noteType] || W.fgMuted}40`,
                borderRadius: "3px", padding: "1px 6px", marginBottom: "5px",
                textTransform: "uppercase", letterSpacing: "0.5px",
              }
            },
              React.createElement("div", {
                style: { width: "5px", height: "5px", borderRadius: "50%",
                         background: typeColors[peekNote.noteType], flexShrink: 0 }
              }),
              typeLabels[peekNote.noteType]
            ),
            React.createElement("div", {
              style: { fontSize: "14px", fontWeight: "600", color: W.statusFg,
                       lineHeight: "1.3" }
            }, peekNote ? peekNote.title : "Niet gevonden"),
            peekNote?.tags?.length > 0 && React.createElement("div", {
              style: { display: "flex", gap: "3px", flexWrap: "wrap", marginTop: "5px" }
            },
              peekNote.tags.map(t => React.createElement("span", {
                key: t,
                style: {
                  fontSize: "9px", color: W.comment,
                  background: "rgba(159,202,86,0.1)",
                  border: "1px solid rgba(159,202,86,0.2)",
                  borderRadius: "3px", padding: "1px 5px",
                }
              }, "#" + t))
            )
          ),
          React.createElement("button", {
            onClick: () => setPeekNoteId(null),
            title: "Sluiten",
            style: {
              background: "none", border: "none", color: W.fgMuted,
              cursor: "pointer", fontSize: "18px", padding: "0 2px",
              lineHeight: 1, flexShrink: 0,
            },
            onMouseEnter: e => e.currentTarget.style.color = W.fg,
            onMouseLeave: e => e.currentTarget.style.color = W.fgMuted,
          }, "×")
        ),

        // Inhoud
        React.createElement("div", {
          style: {
            flex: 1, overflowY: "auto", padding: "16px 18px",
            WebkitOverflowScrolling: "touch",
          }
        },
          peekNote
            ? React.createElement("div", { className: "mdv" },
                React.createElement(MarkdownWithMermaid, {
                  content: peekNote.content || "",
                  notes, renderMode: "rich", isMobile: false,
                  onClick: (id) => {
                    const linked = notes.find(n => n.id === id || n.title === id);
                    if (linked) setPeekNoteId(linked.id);
                  },
                })
              )
            : React.createElement("div", {
                style: { color: W.fgMuted, fontSize: "13px", fontStyle: "italic" }
              }, "Notitie niet gevonden.")
        ),

        // Footer
        peekNote && React.createElement("div", {
          style: {
            borderTop: "1px solid #2a2a2a", padding: "8px 14px",
            flexShrink: 0, display: "flex", alignItems: "center", gap: "8px",
          }
        },
          peekNote.modified && React.createElement("span", {
            style: { fontSize: "10px", color: W.fgMuted }
          }, new Date(peekNote.modified).toLocaleDateString("nl-NL")),
          React.createElement("div", { style: { flex: 1 } }),
          !cards.find(c => c.noteId === peekNote.id) &&
            React.createElement("button", {
              onClick: () => {
                const cv = cvRef.current;
                const dpr = window.devicePixelRatio || 1;
                const CW = cv ? cv.width / dpr : 600;
                const CH = cv ? cv.height / dpr : 400;
                const { x, y } = toWorld(
                  CW/2 + (Math.random()-0.5)*200,
                  CH/2 + (Math.random()-0.5)*150
                );
                addCard(x, y, peekNote.title, 1, peekNote.id);
                setPeekNoteId(null);
              },
              style: {
                fontSize: "10px", padding: "3px 10px",
                background: "rgba(138,198,242,0.08)",
                border: "1px solid rgba(138,198,242,0.25)",
                borderRadius: "4px", color: W.blue, cursor: "pointer",
              }
            }, "+ op canvas")
        )
      );
    })()
  );
};