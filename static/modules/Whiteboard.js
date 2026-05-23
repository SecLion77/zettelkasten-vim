// ── Whiteboard ────────────────────────────────────────────────────────────────
// Vrij canvas voor divergent denken: kaarten, verbindingen, kleuren.
// Opslag: vault/whiteboard_<id>.json via /api/config
// Workflow: schets ideeën → verbind ze → zet om naar notities
// Wetenschappelijk: ruimtelijk denken ondersteunt creatief probleemoplossen
// (Schon & Wiggins 1992: "zie, beweeg, zie opnieuw")

// ── Buurtnetwerk: bereken verbindingsgewichten voor een notitie ──────────────
function buildNeighborhood(noteId, notes, maxLevel = 2) {
  if (!noteId || !notes?.length) return [];

  // Bouw opzoektabel: id → note
  const byId = {};
  notes.forEach(n => { byId[n.id] = n; });

  // Extraheer wiki-links uit inhoud
  const extractLinks = (content = "") => {
    const m = content.match(/\[\[([^\]]+)\]\]/g) || [];
    return m.map(s => s.slice(2, -2).split("|")[0].trim());
  };

  // Bereken gewicht tussen ego en een kandidaat-note
  const calcWeight = (ego, other) => {
    let w = 0;
    const egoLinks  = extractLinks(ego.content);
    const otherLinks = extractLinks(other.content);
    // Wiki-link van ego naar other
    if (egoLinks.includes(other.id))   w += 3;
    // Backlink: other linkt naar ego
    if (otherLinks.includes(ego.id))   w += 2;
    // Gedeelde tags
    const egoTags   = new Set(ego.tags   || []);
    const otherTags = new Set(other.tags  || []);
    egoTags.forEach(t => { if (otherTags.has(t)) w += 1; });
    return w;
  };

  const ego = byId[noteId];
  if (!ego) return [];

  // 1e niveau
  const level1 = notes
    .filter(n => n.id !== noteId)
    .map(n => ({ note: n, weight: calcWeight(ego, n), level: 1 }))
    .filter(x => x.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 8);

  if (maxLevel < 2) return level1;

  // 2e niveau: buren van buren, nog niet in 1e niveau
  const seen = new Set([noteId, ...level1.map(x => x.note.id)]);
  const level2 = [];
  level1.slice(0, 3).forEach(({ note: neighbor }) => {
    notes
      .filter(n => !seen.has(n.id))
      .map(n => ({ note: n, weight: calcWeight(neighbor, n), level: 2, via: neighbor.title }))
      .filter(x => x.weight > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 2)
      .forEach(x => {
        if (!seen.has(x.note.id)) {
          seen.add(x.note.id);
          level2.push(x);
        }
      });
  });

  return [...level1, ...level2.sort((a,b) => b.weight - a.weight).slice(0,4)];
}

const Whiteboard = ({ notes = [], onCreateNote, onAddNote, llmModel = "", serverImages = [], pendingNotes = null, onClearPending, onShowInGraph }) => {
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
  const [showLevel2, setShowLevel2]     = useState(false);
  const [editingCon, setEditingCon]     = useState(null);
  const [hoveredItem, setHoveredItem]   = useState(null); // radial menu hover
  // ringPath[i] = {noteId, idx, a0, a1} voor elk uitgevouwen ringniveau
  const [ringPath, setRingPath]           = useState([]);
  const [hoverPreview, setHoverPreview]   = useState(null);
  const ringTimerRef  = React.useRef(null);   // debounce ring-expansie
  const svgLeaveTimer = React.useRef(null);   // vertraagd sluiten
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
  const pendingRef = useRef(null); // noteIds die op canvas moeten komen
  const dirtyRef      = useRef(true);
  const touchRef      = useRef(null);
  const pinchRef      = useRef(null);
  const longPressRef  = useRef(null);
  const lastTapRef    = useRef(0);
  const isPanning = useRef(false);
  const panStart  = useRef(null);
  const dragging  = useRef(null);   // { id, startX, startY, startCX, startCY }
  const afRef     = useRef(null);
  const stateRef  = useRef({ cards: [], connections: [] });

  // Strip markdown voor plain-text preview
  const stripMd = (t = "") => t
    .replace(/\*\*(.+?)\*\*/g, "$1")   // bold
    .replace(/\*(.+?)\*/g, "$1")         // italic
    .replace(/\[\[.+?\]\]/g, "")       // wiki-links
    .replace(/^#+\s+/gm, "")             // headers
    .replace(/^[-*]\s+/gm, "")           // lijstitems
    .replace(/`[^`]+`/g, "")             // code
    .replace(/\n{2,}/g, "\n")           // dubbele newlines
    .trim();

  // Kleuren voor kaarten (Wombat-palette)
  const COLORS = [
    { bg: "#2a2a1e", border: "#9fca56", text: "#ffffd7", name: "geel",
      label: "Idee / vluchtig",    desc: "Nieuwe gedachten, vluchtige notities" },
    { bg: "#1e242a", border: "#8ac6f2", text: "#e3e0d7", name: "blauw",
      label: "Bron / notitie",     desc: "Literatuur, bronnen, gelinkte notities" },
    { bg: "#2a1e1e", border: "#e5786d", text: "#ffe0dc", name: "rood",
      label: "Vraag / spanning",   desc: "Openstaande vragen, tegenstrijdigheden" },
    { bg: "#1e2a1e", border: "#95e454", text: "#e3e0d7", name: "groen",
      label: "Conclusie / inzicht", desc: "Eigen inzichten, permanente kennis" },
    { bg: "#261e2a", border: "#d7a0ff", text: "#f0e3ff", name: "paars",
      label: "Onbekend / onderzoek", desc: "Te onderzoeken, hypotheses" },
    { bg: "#2a2a2a", border: "#857b6f", text: "#e3e0d7", name: "grijs",
      label: "Neutraal / overig",  desc: "Structuur, containers, vrije kaarten" },
  ];

  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

  // Sluit contextmenu bij klik buiten
  // Injecteer animatie-CSS voor het radiale menu
  React.useEffect(() => {
    if (document.getElementById("zk-radial-css")) return;
    const s = document.createElement("style");
    s.id = "zk-radial-css";
    s.textContent = `
      @keyframes zk-radial-in {
        from { opacity:0; transform:scale(0.55) rotate(-8deg); }
        to   { opacity:1; transform:scale(1)   rotate(0deg);  }
      }
    `;
    document.head.appendChild(s);
  }, []);

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
      if (e.key === "Escape") { setPeekNoteId(null); setCtxMenu(null); setRingPath([]); setHoverPreview(null); }
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
          const wt = Math.min(Math.max(con.weight || 1, 1), 10);
          const lw = (0.8 + (wt / 10) * 3.2) * v.scale;
          ctx.beginPath();
          ctx.strokeStyle = con.color || "rgba(138,198,242,0.55)";
          ctx.lineWidth = lw;
          ctx.setLineDash([]);
          const mx = (ax.x + bx.x) / 2, my = (ax.y + bx.y) / 2 - 20 * v.scale;
          ctx.moveTo(ax.x, ax.y);
          ctx.quadraticCurveTo(mx, my, bx.x, bx.y);
          ctx.stroke();
          const angle = Math.atan2(bx.y - my, bx.x - mx);
          const hs = (5 + wt * 0.5) * v.scale;
          ctx.fillStyle = con.color || "rgba(138,198,242,0.7)";
          ctx.beginPath();
          ctx.moveTo(bx.x, bx.y);
          ctx.lineTo(bx.x - hs * Math.cos(angle - 0.4), bx.y - hs * Math.sin(angle - 0.4));
          ctx.lineTo(bx.x - hs * Math.cos(angle + 0.4), bx.y - hs * Math.sin(angle + 0.4));
          ctx.closePath();
          ctx.fill();
          const conMX = (ax.x + bx.x) / 2;
          const conMY = (ax.y + bx.y) / 2 - 10 * v.scale;
          if (con.weight && con.weight > 1) {
            const wStr = String(con.weight);
            ctx.font = `${9 * v.scale}px 'DM Sans', sans-serif`;
            ctx.textAlign = "center";
            const pw = ctx.measureText(wStr).width + 7 * v.scale;
            ctx.fillStyle = "rgba(18,18,22,0.82)";
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(conMX-pw/2,conMY-8*v.scale,pw,13*v.scale,4*v.scale);
            else ctx.rect(conMX-pw/2,conMY-8*v.scale,pw,13*v.scale);
            ctx.fill();
            ctx.fillStyle = con.color || "rgba(138,198,242,0.9)";
            ctx.fillText(wStr, conMX, conMY + 3 * v.scale);
          }
          // Klikbare-zone indicator: potlood-pill bij midpunt
          if (!con.label) {
            const pSize = 11 * v.scale;
            // Achtergrond pill
            ctx.fillStyle = 'rgba(18,18,22,0.65)';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(conMX - pSize, conMY - pSize*0.7, pSize*2, pSize*1.4, pSize*0.5);
            else ctx.rect(conMX - pSize, conMY - pSize*0.7, pSize*2, pSize*1.4);
            ctx.fill();
            // Rand
            ctx.strokeStyle = 'rgba(138,198,242,0.45)';
            ctx.lineWidth = 0.8;
            ctx.stroke();
            // Icoon
            ctx.font = `${Math.round(pSize * 0.85)}px 'DM Sans', sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(138,198,242,0.75)';
            ctx.fillText('✏', conMX, conMY + pSize * 0.35);
          }
          if (con.label) {
            const lbY = conMY + ((con.weight && con.weight>1) ? 15:2)*v.scale;
            ctx.font = `${12 * v.scale}px 'DM Sans', sans-serif`;
            const tlw = ctx.measureText(con.label).width + 12*v.scale;
            // Achtergrond pill met border
            ctx.fillStyle = "rgba(14,14,18,0.85)";
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(conMX-tlw/2,lbY-9*v.scale,tlw,17*v.scale,5*v.scale);
            else ctx.rect(conMX-tlw/2,lbY-9*v.scale,tlw,17*v.scale);
            ctx.fill();
            ctx.strokeStyle = "rgba(138,198,242,0.35)";
            ctx.lineWidth = 0.8;
            ctx.stroke();
            // Tekst
            ctx.fillStyle = "rgba(227,224,215,0.95)";
            ctx.fillText(con.label, conMX, lbY + 4*v.scale);
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

          // Achtergrond — gebruik altijd de colorIdx van de kaart
          // (noteId-kaarten tonen een klein blauw icoon ipv een vaste blauwe kleur)
          ctx.fillStyle = col.bg;
          ctx.strokeStyle = isSel ? col.border : col.border + "80";
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

          // Tekst wrappen — gebruik actuele notitietitel als kaart gekoppeld is
          const maxW = sw - 12 * v.scale;
          const lineH = fontSize * 1.45;
          // Live notitietitel ophalen als de kaart een noteId heeft
          const displayText = c.noteId
            ? (notes.find(n => n.id === c.noteId)?.title || c.text || c.noteId)
            : (c.text || "");
          const lines = wrapText(ctx, displayText, maxW);
          const topPad = textY - sx.y;
          const neededH = topPad + lines.length * lineH + 10 * v.scale;

          // Als tekst groter is dan kaart: teken de kaart groter (alleen visueel)
          if (neededH > sh) {
            ctx.fillStyle = c.noteId ? "rgba(138,198,242,0.08)" : col.bg;
            ctx.strokeStyle = isSel ? col.border : (c.noteId ? "#8ac6f2" : col.border + "80");
            ctx.lineWidth = isSel ? 1.5 : 0.8;
            roundRect(ctx, sx.x, sx.y, sw, neededH, 6 * v.scale);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = col.text;
            ctx.font = `${fontSize}px 'DM Sans', sans-serif`;
          }

          lines.forEach((ln, i) => {
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
    const card = { id: genId(), x: wx - 90, y: wy - 45, w: 180, h: 90, text, colorIdx, noteId };
    const next = [...stateRef.current.cards, card];
    stateRef.current = { ...stateRef.current, cards: next };
    setCards(next);
    saveBoard(next, stateRef.current.connections);
    return card;
  }, [saveBoard]);

  // ── Verwerk notities vanuit andere tabs ────────────────────────────────────
  // Sla pending noteIds op in ref (stabiel, geen timing-problemen)
  React.useEffect(() => {
    if (pendingNotes && pendingNotes.length) {
      pendingRef.current = pendingNotes;
      if (onClearPending) onClearPending();
    }
  }, [pendingNotes]);

  // Verwerk pendingRef nadat board geladen is (via cards state)
  const pendingProcessedRef = useRef(false);
  React.useEffect(() => {
    if (!pendingRef.current || pendingProcessedRef.current) return;
    const ids = pendingRef.current;
    pendingProcessedRef.current = true;
    pendingRef.current = null;
    const cols = 3, colW = 290, rowH = 170;
    let added = 0;
    // Kleine delay zodat board zeker geladen is
    setTimeout(() => {
      ids.forEach((noteId, i) => {
        const note = notes.find(n => n.id === noteId);
        if (!note) return;
        const col = i % cols, row = Math.floor(i / cols);
        addCard(80 + col * colW, 80 + row * rowH,
                note.title || (note.content || '').slice(0, 60) || 'Notitie', 1, noteId);
        added++;
      });
      if (added > 0) {
        // Reset viewport naar linksboven zodat kaarten zichtbaar zijn
        viewRef.current = { ox: 30, oy: 30, scale: 1 };
      }
      pendingProcessedRef.current = false;
    }, 200);
  }, [cards]); // fires na elke cards-update, maar pendingRef guards dubbele verwerking


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
  // ── SSE streaming helper voor canvas AI ─────────────────────────────────
  const streamAiChat = async (messages, system) => {
    setAiStreaming(true); setAiResult("");
    try {
      const resp = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: llmModel, messages, system }),
      });
      if (!resp.ok) throw new Error(`Server fout: ${resp.status}`);
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "", result = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.error) { setAiResult("Fout: " + ev.error); setAiStreaming(false); return; }
            if (ev.delta) { result += ev.delta; setAiResult(result); }
            if (ev.done) { setAiStreaming(false); return; }
          } catch {}
        }
      }
    } catch(e) {
      setAiResult("Fout: " + (e.message || "Verbinding mislukt"));
    }
    setAiStreaming(false);
  };

  const runAiAnalyse = () => {
    if (!llmModel || cards.length < 2) return;
    const context = buildCanvasContext();
    streamAiChat(
      [{ role: "user", content:
        `Analyseer dit canvas en geef een scherpe analyse:\n\n${context}\n\n` +
        `Beantwoord kort:\n` +
        `1. Wat is het centrale thema of de kernvraag?\n` +
        `2. Welke clusters of spanningsvelden zie je?\n` +
        `3. Welke verbindingen ontbreken of zijn verrassend?\n` +
        `4. Wat is de volgende logische stap in dit denken?`
      }],
      "Je bent een Socratische onderzoekspartner. Denk hardop mee. Maximaal 200 woorden. Schrijf in lopende tekst, geen genummerde lijsten."
    );
  };

  const runAiSynthese = () => {
    if (!llmModel || cards.length < 2) return;
    const context = buildCanvasContext();
    streamAiChat(
      [{ role: "user", content:
        `Schrijf een samenhangende notitie op basis van dit canvas.\n\n${context}\n\n` +
        `De notitie moet:\n` +
        `- Beginnen met een sterke openingszin die de kerngedachte vat\n` +
        `- De verbanden tussen de kaarten uitleggen in lopende tekst\n` +
        `- Eindigen met een open vraag of vervolgrichting\n` +
        `- Maximaal 300 woorden zijn\n` +
        `- In markdown geschreven zijn (# voor titel, ## voor secties indien nodig)`
      }],
      "Je schrijft helder, compact en in eigen woorden. Geen bullet-lijsten — alleen lopende tekst."
    );
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
        body: JSON.stringify({ model: llmModel, messages: newHistory, system: systemPrompt }),
      });
      if (!resp.ok) throw new Error(`Server fout: ${resp.status}`);
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "", reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.error) { reply = "Fout: " + ev.error; break; }
            if (ev.delta) reply += ev.delta;
            if (ev.done) break;
          } catch {}
        }
      }
      setAiHistory([...newHistory, { role: "assistant", content: reply || "Geen antwoord." }]);
    } catch(e) {
      setAiHistory([...newHistory, { role: "assistant", content: "Fout: " + (e.message||"Verbinding mislukt") }]);
    }
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

    // Klik op verbindingslijn midpunt → label bewerken
    if (!card) {
      const v2 = viewRef.current;
      const conList = stateRef.current?.connections || connections;
      const clickedCon = conList.find(co => {
        const ca = cards.find(cd => cd.id === co.from);
        const cb = cards.find(cd => cd.id === co.to);
        if (!ca || !cb) return false;
        const cmx = ((ca.x+ca.w/2)+(cb.x+cb.w/2))/2*v2.scale+v2.ox;
        const cmy = ((ca.y+ca.h/2)+(cb.y+cb.h/2))/2*v2.scale+v2.oy-10*v2.scale; // match tekening
        return Math.abs(sx-cmx)<52 && Math.abs(sy-cmy)<38;
      });
      if (clickedCon) {
        const ca = cards.find(cd=>cd.id===clickedCon.from);
        const cb = cards.find(cd=>cd.id===clickedCon.to);
        const v2 = viewRef.current; // v2 al gedeclareerd hierboven
        const scx = ((ca.x+ca.w/2)+(cb.x+cb.w/2))/2*v2.scale+v2.ox;
        const scy = ((ca.y+ca.h/2)+(cb.y+cb.h/2))/2*v2.scale+v2.oy-10*v2.scale;
        const cvRect = cvRef.current?.getBoundingClientRect();
        setEditingCon({ conId:clickedCon.id, label:clickedCon.label||'',
          x: scx+(cvRect?.left||0), y: scy+(cvRect?.top||0) });
        return;
      }
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
      // Sla label op als editor open was (klik buiten = bevestigen)
      if (editingCon) {
        const nextCons = stateRef.current.connections.map(c =>
          c.id === editingCon.conId ? { ...c, label: editingCon.label } : c
        );
        stateRef.current = { ...stateRef.current, connections: nextCons };
        setCons(nextCons);
        saveBoard(stateRef.current.cards, nextCons);
        dirtyRef.current = true;
        setEditingCon(null);
      }
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

  // ── Touch: één vinger → drag/pan | twee vingers → pinch+pan ─────────────────
  const handleTouchStart = useCallback((e) => {
    if (editingId) return;
    const cv  = cvRef.current;
    const r   = cv.getBoundingClientRect();
    const now = Date.now();

    if (e.touches.length === 2) {
      // Annuleer lang-indrukken en start pinch
      clearTimeout(longPressRef.current);
      touchRef.current = null;
      const t0 = e.touches[0], t1 = e.touches[1];
      const d0 = Math.hypot(t1.clientX-t0.clientX, t1.clientY-t0.clientY);
      const mx = (t0.clientX+t1.clientX)/2 - r.left;
      const my = (t0.clientY+t1.clientY)/2 - r.top;
      pinchRef.current = { d0, scale0: viewRef.current.scale, mx, my,
                           ox0: viewRef.current.ox, oy0: viewRef.current.oy };
      e.preventDefault(); return;
    }

    if (e.touches.length !== 1) return;
    const t   = e.touches[0];
    const sx  = t.clientX - r.left, sy = t.clientY - r.top;
    const card = cardAt(sx, sy);

    // Dubbeltik detectie
    if (now - lastTapRef.current < 300 && card) {
      clearTimeout(longPressRef.current);
      setEditingId(card.id);
      lastTapRef.current = 0;
      e.preventDefault(); return;
    }
    lastTapRef.current = now;

    // Lang-indrukken → contextmenu (alleen op lege canvas of kaart)
    longPressRef.current = setTimeout(() => {
      const cv2 = cvRef.current;
      const r2  = cv2.getBoundingClientRect();
      const lx  = t.clientX - r2.left, ly = t.clientY - r2.top;
      const c2  = cardAt(lx, ly);
      setCtxMenu({
        canvasX: lx, canvasY: ly,
        screenX: t.clientX, screenY: t.clientY,
        cardId: c2?.id || null,
      });
      touchRef.current = null;
    }, 500);

    touchRef.current = {
      id: t.identifier, sx, sy,
      ox: viewRef.current.ox, oy: viewRef.current.oy,
      cardId: card?.id || null,
      startCX: card?.x ?? 0, startCY: card?.y ?? 0,
      moved: false, t0: now,
    };
    e.preventDefault();
  }, [editingId, cards]);

  const handleTouchMove = useCallback((e) => {
    if (e.touches.length === 2 && pinchRef.current) {
      const cv = cvRef.current;
      const r  = cv.getBoundingClientRect();
      const t0 = e.touches[0], t1 = e.touches[1];
      const d  = Math.hypot(t1.clientX-t0.clientX, t1.clientY-t0.clientY);
      const pr = pinchRef.current;
      const mx = (t0.clientX+t1.clientX)/2 - r.left;
      const my = (t0.clientY+t1.clientY)/2 - r.top;
      const newScale = Math.max(0.15, Math.min(4, pr.scale0 * (d / pr.d0)));
      // Zoom op het midpunt
      const ds = newScale - pr.scale0;
      const ox = pr.ox0 - pr.mx * ds / pr.scale0 * newScale / newScale;
      const oy = pr.oy0 - pr.my * ds / pr.scale0 * newScale / newScale;
      // Pan mee met beweging van het midpunt
      const panX = mx - pr.mx;
      const panY = my - pr.my;
      viewRef.current = {
        ...viewRef.current,
        scale: newScale,
        ox: pr.ox0 + panX - (pr.mx) * (newScale/pr.scale0 - 1),
        oy: pr.oy0 + panY - (pr.my) * (newScale/pr.scale0 - 1),
      };
      dirtyRef.current = true;
      e.preventDefault(); return;
    }

    if (!touchRef.current || e.touches.length !== 1) return;
    const cv = cvRef.current;
    const r  = cv.getBoundingClientRect();
    const t  = e.touches[0];
    const sx = t.clientX - r.left, sy = t.clientY - r.top;
    const tr = touchRef.current;

    const dx = sx - tr.sx, dy = sy - tr.sy;
    if (!tr.moved && Math.hypot(dx, dy) > 6) {
      clearTimeout(longPressRef.current); // niet lang-indrukken
      tr.moved = true;
    }
    if (!tr.moved) return;

    if (tr.cardId) {
      // Kaart verslepen
      const wdx = dx / viewRef.current.scale;
      const wdy = dy / viewRef.current.scale;
      const next = cards.map(c =>
        c.id === tr.cardId
          ? { ...c, x: tr.startCX + wdx, y: tr.startCY + wdy }
          : c
      );
      setCards(next);
      stateRef.current = { ...stateRef.current, cards: next };
      dirtyRef.current = true;
    } else {
      // Canvas panning
      viewRef.current = { ...viewRef.current, ox: tr.ox + dx, oy: tr.oy + dy };
      dirtyRef.current = true;
    }
    e.preventDefault();
  }, [cards]);

  const handleTouchEnd = useCallback((e) => {
    clearTimeout(longPressRef.current);
    pinchRef.current = null;

    if (touchRef.current?.cardId && !touchRef.current.moved) {
      // Kaart aantikken → selecteren
      setSelected(touchRef.current.cardId);
    }
    if (touchRef.current?.cardId) {
      saveBoard(stateRef.current.cards, stateRef.current.connections);
    }
    touchRef.current = null;
    e.preventDefault();
  }, []);

  const handleTouchCancel = useCallback(() => {
    clearTimeout(longPressRef.current);
    pinchRef.current = null;
    touchRef.current = null;
  }, []);

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
            React.createElement("div", { style: { display:"flex", flexDirection:"column", gap:"1px" } },
              React.createElement("span", {
                style: { fontSize: "11px", color: W.fg || "#e3e0d7" }
              }, col.label),
              React.createElement("span", {
                style: { fontSize: "9px", color: W.fgMuted, lineHeight: 1.3 }
              }, col.desc)
            )
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
        style: { display: "flex", gap: "5px", alignItems: "center" }
      },
        COLORS.map((col, i) => {
          const isActive = (selCard.colorIdx || 0) === i;
          return React.createElement("button", {
            key: i,
            // Kleur wijzigen + dirtyRef markeren zodat canvas direct herlaadt
            onClick: (e) => {
              e.stopPropagation();
              updateCard(selCard.id, { colorIdx: i });
              dirtyRef.current = true; // forceer directe hertekening
            },
            title: `${col.label}\n${col.desc}`,
            style: {
              width: isActive ? "18px" : "14px",
              height: isActive ? "18px" : "14px",
              borderRadius: "50%",
              background: col.border,
              border: isActive ? `2px solid white` : `1.5px solid rgba(255,255,255,0.2)`,
              cursor: "pointer", padding: 0,
              opacity: isActive ? 1 : 0.6,
              transition: "all .15s",
              boxShadow: isActive ? `0 0 6px ${col.border}` : "none",
              outline: "none",
            }
          });
        }),
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
        selCard.noteId && onShowInGraph && React.createElement("button", {
          onClick: () => onShowInGraph(selCard.noteId),
          title: "Toon in kennisgraaf",
          style: { background: W.blueBg||"rgba(122,168,200,0.15)",
                   border: `1px solid ${W.blueBorder||"rgba(122,168,200,0.4)"}`,
                   borderRadius: "5px", color: W.blue||"#7aa8c8",
                   padding: "3px 9px", fontSize: "12px", cursor: "pointer",
                   fontWeight: "500" }
        }, "🕸 Graaf"),
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
        onTouchStart: handleTouchStart,
        onTouchMove:  handleTouchMove,
        onTouchEnd:   handleTouchEnd,
        onTouchCancel:handleTouchCancel,
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
      // ── Verbindingslabel editor ────────────────────────────────────────────
      editingCon && React.createElement("div", {
        style: {
          position: "fixed",
          left: Math.max(8, editingCon.x - 130),
          top:  Math.max(8, editingCon.y - 22),
          zIndex: 9999,
          background: W.bg2 || "#1a1a1a",
          border: "1px solid " + (W.blue || "#8ac6f2"),
          borderRadius: "10px",
          padding: "8px 12px",
          display: "flex",
          gap: "8px",
          alignItems: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
          minWidth: "280px",
        }
      },
        React.createElement("span", {
          style: { fontSize: "13px", color: W.fgMuted || "#857b6f", flexShrink: 0 }
        }, "✏"),
        React.createElement("input", {
          autoFocus: true,
          value: editingCon.label,
          placeholder: "Label voor deze verbinding…",
          onChange: function(e) {
            setEditingCon(function(p) { return Object.assign({}, p, { label: e.target.value }); });
          },
          onKeyDown: function(e) {
            if (e.key === "Enter") {
              var nextCons = stateRef.current.connections.map(function(c) {
                return c.id === editingCon.conId ? Object.assign({}, c, { label: editingCon.label }) : c;
              });
              stateRef.current = Object.assign({}, stateRef.current, { connections: nextCons });
              setCons(nextCons);
              saveBoard(stateRef.current.cards, nextCons);
              dirtyRef.current = true;
              setEditingCon(null);
            }
            if (e.key === "Escape") {
              setEditingCon(null);
            }
          },
          style: {
            flex: 1,
            background: "transparent",
            border: "none",
            borderBottom: "1px solid " + (W.splitBg || "#444"),
            color: W.fg || "#e3e0d7",
            fontSize: "14px",
            outline: "none",
            fontFamily: "'DM Sans', sans-serif",
            paddingBottom: "2px",
          }
        }),
        React.createElement("button", {
          onClick: function() {
            var nextCons = stateRef.current.connections.map(function(c) {
              return c.id === editingCon.conId ? Object.assign({}, c, { label: editingCon.label }) : c;
            });
            stateRef.current = Object.assign({}, stateRef.current, { connections: nextCons });
            setCons(nextCons);
            saveBoard(stateRef.current.cards, nextCons);
            dirtyRef.current = true;
            setEditingCon(null);
          },
          style: {
            background: "transparent", border: "none",
            color: W.blue || "#8ac6f2", fontSize: "16px", cursor: "pointer",
          }
        }, "✓"),
        editingCon.label && React.createElement("button", {
          title: "Wis label",
          onClick: function() {
            var nextCons = stateRef.current.connections.map(function(c) {
              return c.id === editingCon.conId ? Object.assign({}, c, { label: "" }) : c;
            });
            stateRef.current = Object.assign({}, stateRef.current, { connections: nextCons });
            setCons(nextCons);
            saveBoard(stateRef.current.cards, nextCons);
            dirtyRef.current = true;
            setEditingCon(null);
          },
          style: {
            background: "transparent", border: "none",
            color: W.fgMuted || "#857b6f", fontSize: "13px", cursor: "pointer",
          }
        }, "✕")
      ),

      // ── Radiaal menu (SVG arc) — thema-bewust + recursief ──────────────────
      ctxMenu && (() => {
        const cx   = ctxMenu.canvasX;
        const cy   = ctxMenu.canvasY;
        const card = ctxMenu.cardId ? cards.find(c => c.id === ctxMenu.cardId) : null;

        // Thema-kleuren
        const isDark = W.dark !== false;
        const bg0  = W.bg2  || "rgba(22,22,28,0.97)";
        const sep = isDark
          ? (W.splitBg || "rgba(255,255,255,0.10)")
          : (W.splitBg || "rgba(0,0,0,0.15)");
        const blue = W.blue || "#8ac6f2";
        const green= W.tagColor || "#9fca56";
        const orange=W.orange || "#e5786d";
        const mut  = W.fgMuted || "#857b6f";
        const fg   = W.fg || "#e3e0d7";
        // RGB helpers voor rgba() constructie
        const _h2r = (hex) => { try {
          const h=(hex||"#8ac6f2").replace("#","");
          return `${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)}`;
        } catch{return "138,198,242";} };
        const blueRgb   = _h2r(blue);
        const greenRgb  = _h2r(green);
        const orangeRgb = _h2r(orange);
        const purpleRgb = _h2r(W.purple || "#d787ff");
        const ring0rgb  = blueRgb;
        const ring1rgb  = greenRgb;

        // ── Arc-pad helpers ───────────────────────────────────────────────
        const arc = (r1, r2, a0d, a1d, gap=2.8) => {
          const s=(a0d+gap)*Math.PI/180, e=(a1d-gap)*Math.PI/180;
          const lg=(a1d-a0d-gap*2)>180?1:0;
          const px=(r,a)=>({x:r*Math.cos(a),y:r*Math.sin(a)});
          const p1=px(r2,s),p2=px(r2,e),p3=px(r1,e),p4=px(r1,s);
          return `M${p1.x},${p1.y} A${r2},${r2} 0 ${lg} 1 ${p2.x},${p2.y} L${p3.x},${p3.y} A${r1},${r1} 0 ${lg} 0 ${p4.x},${p4.y}Z`;
        };
        const mid=(r1,r2,a0,a1)=>{
          const a=((a0+a1)/2)*Math.PI/180, r=(r1+r2)/2;
          return {x:r*Math.cos(a),y:r*Math.sin(a),a};
        };

        // ── Binnenring acties ─────────────────────────────────────────────
        const innerItems = card ? [
          {key:"edit", icon:"✎",label:"Bewerken",
           bg:isDark?`rgba(${blueRgb},0.18)`:`rgba(${blueRgb},0.22)`,
           hbg:isDark?`rgba(${blueRgb},0.38)`:`rgba(${blueRgb},0.45)`,ic:blue,
           action:()=>{setEditingId(card.id);setSelected(card.id);setCtxMenu(null);}},
          {key:"conn", icon:"⤳",label:"Verbinden",
           bg:isDark?`rgba(${blueRgb},0.12)`:`rgba(${blueRgb},0.16)`,
           hbg:isDark?`rgba(${blueRgb},0.28)`:`rgba(${blueRgb},0.38)`,ic:blue,
           action:()=>{setTool("connect");setConnectFrom(card.id);setCtxMenu(null);}},
          {key:"note", icon:"⬡",label:card.noteId?"Notitie":"→ Notitie",
           bg:isDark?"rgba(159,202,86,0.15)":"rgba(42,94,40,0.14)",
           hbg:isDark?"rgba(159,202,86,0.32)":"rgba(42,94,40,0.30)",ic:green,
           action:()=>{card.noteId?setPeekNoteId(card.noteId):cardToNote(card);setCtxMenu(null);}},
          {key:"graph",icon:"🕸",label:"Graaf",
           bg:isDark?"rgba(138,198,242,0.12)":"rgba(26,58,106,0.12)",
           hbg:isDark?"rgba(138,198,242,0.28)":"rgba(26,58,106,0.28)",ic:blue,
           hidden:!card.noteId,
           action:()=>{if(card.noteId&&onShowInGraph)onShowInGraph(card.noteId);setCtxMenu(null);}},
          {key:"dup",  icon:"⊞",label:"Dupliceer",
           bg:isDark?"rgba(159,202,86,0.10)":"rgba(42,94,40,0.10)",
           hbg:isDark?"rgba(159,202,86,0.22)":"rgba(42,94,40,0.24)",ic:green,
           action:()=>{const{x,y}=toWorld(cx+20,cy+20);addCard(x+20,y+20,card.text,card.colorIdx,null);setCtxMenu(null);}},
          {key:"del",  icon:"✕",label:"Verwijder",
           bg:"rgba(229,120,109,0.18)",hbg:"rgba(229,120,109,0.38)",ic:orange,
           action:()=>{deleteCard(card.id);setCtxMenu(null);}},
        ].filter(x=>!x.hidden) : [
          {key:"new",icon:"+",label:"Nieuwe kaart",
           bg:`rgba(${ring1rgb},0.15)`,hbg:`rgba(${ring1rgb},0.32)`,ic:green,
           action:()=>{const{x,y}=toWorld(cx,cy);const c=addCard(x,y,"",0);setEditingId(c.id);setSelected(c.id);setCtxMenu(null);}},
          {key:"fit",icon:"⊡",label:"Alles zichtbaar",
           bg:`rgba(${ring0rgb},0.12)`,hbg:`rgba(${ring0rgb},0.28)`,ic:blue,
           action:()=>{setCtxMenu(null);}},
        ];
        const filteredInner=innerItems.filter(x=>!x.hidden);
        const innerN=filteredInner.length, innerSpan=360/innerN;

        // ── Ring-data (4 niveaus) ─────────────────────────────────────────
        const MAX_DEPTH = 4;
        const RING_RADII = [[125,205],[210,285],[290,365],[370,445]];
        const RING_COLORS = isDark ? [
          [`rgba(${blueRgb},`,  `rgba(${blueRgb},`],
          [`rgba(${greenRgb},`, `rgba(${greenRgb},`],
          [`rgba(${orangeRgb},`,`rgba(${orangeRgb},`],
          [`rgba(${purpleRgb},`,`rgba(${purpleRgb},`],
        ] : [
          // Lichte thema: hogere opacity zodat slices zichtbaar zijn op crème
          [`rgba(${blueRgb},`,  `rgba(${blueRgb},`],
          [`rgba(${greenRgb},`, `rgba(${greenRgb},`],
          [`rgba(${orangeRgb},`,`rgba(${orangeRgb},`],
          [`rgba(${purpleRgb},`,`rgba(${purpleRgb},`],
        ];

        // Bouw de nodes per ring op basis van ringPath
        const egoNoteId = card?.noteId || null;
        const ringNodes = []; // ringNodes[0] = lvl1 nodes, etc.
        const seenIds   = new Set([egoNoteId].filter(Boolean));

        for (let depth = 0; depth < MAX_DEPTH; depth++) {
          const parentNoteId = depth === 0
            ? egoNoteId
            : ringPath[depth-1]?.noteId;
          if (!parentNoteId) { ringNodes.push([]); continue; }
          // Toon ring als dit niveau op het pad zit (depth>0) of het niveau 0 is
          if (depth > 0 && !ringPath[depth-1]) { ringNodes.push([]); continue; }
          const nbrs = buildNeighborhood(parentNoteId, notes, 1)
            .filter(x => !seenIds.has(x.note.id))
            .slice(0, 8);
          nbrs.forEach(x => seenIds.add(x.note.id));
          ringNodes.push(nbrs);
        }

        // Buitenring: ook tonen als ring 1 heeft items
        const outerN      = ringNodes[0].length;
        const outerTotal  = outerN > 0 ? Math.min(outerN*42,270) : 0;
        const outerStart  = -90 - outerTotal/2;
        const outerSpan   = outerN > 0 ? outerTotal/outerN : 0;

        // Geef elke ring zijn eigen boog-parameters (gecentreerd op het pad)
        const ringArcs = ringNodes.map((nodes, depth) => {
          if (!nodes.length) return {start:0,span:0,total:0};
          if (depth === 0) return {start:outerStart, span:outerSpan, total:outerTotal};
          const parent = ringPath[depth-1];
          if (!parent) return {start:0,span:0,total:0};
          const total = Math.min(nodes.length*40, 180);
          const span  = nodes.length > 0 ? total/nodes.length : 0;
          const start = (parent.a0+parent.a1)/2 - total/2;
          return {start, span, total};
        });

        const maxW = ringNodes.map(nodes =>
          nodes.length ? Math.max(...nodes.map(x=>x.weight),1) : 1
        );

        const svgSize = 500;
        const half    = svgSize/2;

        const typeColorIdx2 = {fleeting:0,literature:1,permanent:3,index:4};
        const typeColorMap2 = {fleeting:"#e8a44a",literature:"#8ac6f2",permanent:"#9fca56",index:"#d7a0ff"};
        const typeLabels2   = {fleeting:"Vluchtig",literature:"Literatuur",permanent:"Permanent",index:"Index"};

        const addNeighbor = (nb, weight, fromCardId) => {
          const curCards = stateRef.current.cards;
          const existing = curCards.find(c=>c.noteId===nb.id);
          const{x:wx,y:wy}=toWorld(cx+(Math.random()-0.5)*80+180,cy+(Math.random()-0.5)*80);
          const nbColorIdx = typeColorIdx2[nb.noteType] ?? 1;
          // addCard geeft direct de nieuwe kaart terug — geen setTimeout nodig
          const targetCard = existing || addCard(wx, wy, nb.title||nb.id, nbColorIdx, nb.id);
          if (targetCard && fromCardId && targetCard.id !== fromCardId) {
            const con = {id:genId(), from:fromCardId, to:targetCard.id, weight};
            const alreadyLinked = stateRef.current.connections.some(
              c=>(c.from===fromCardId&&c.to===targetCard.id)||(c.from===targetCard.id&&c.to===fromCardId)
            );
            if (!alreadyLinked) {
              const nextCons = [...stateRef.current.connections, con];
              stateRef.current = {...stateRef.current, connections: nextCons};
              setCons(nextCons);
              saveBoard(stateRef.current.cards, nextCons);
            }
          }
          dirtyRef.current = true;
          setCtxMenu(null); setRingPath([]); setHoverPreview(null);
        };

        return React.createElement("div", {
          style:{position:"absolute",left:cx-half,top:cy-half,
                 width:svgSize,height:svgSize,pointerEvents:"none",zIndex:250}
        },
          // ── Preview kaart ──────────────────────────────────────────────
          hoverPreview && (() => {
            const nb   = hoverPreview.note;
            const ang  = (hoverPreview.sliceAngle%360+360)%360;
            const preview = stripMd(nb.content||"").slice(0,200);
            const tags    = (nb.tags||[]).slice(0,6);
            const tCol    = typeColorMap2[nb.noteType]||null;
            const showRight = ang>90&&ang<270;
            return React.createElement("div",{
              style:{
                position:"absolute", left:showRight?-(300+20):svgSize+8, top:half-160,
                width:"298px", background:W.bg2||"#1e1e24",
                border:`1px solid ${W.splitBg||"#2a2a2a"}`,
                borderRadius:"10px", boxShadow:"0 8px 32px rgba(0,0,0,0.75)",
                overflow:"hidden", pointerEvents:"none",
                animation:"fadeIn .15s ease-out", zIndex:260,
              }
            },
              // Kleur-balk bovenaan
              React.createElement("div",{style:{height:"3px",background:tCol
                ?`linear-gradient(90deg,${tCol},${tCol}44)`
                :`linear-gradient(90deg,${blue},transparent)`}}),
              // Header
              React.createElement("div",{style:{padding:"10px 12px 6px",borderBottom:`1px solid ${W.splitBg||"#2a2a2a"}`}},
                tCol&&React.createElement("div",{style:{display:"inline-flex",alignItems:"center",gap:"4px",
                  fontSize:"11px",color:tCol,background:`${tCol}18`,border:`1px solid ${tCol}40`,
                  borderRadius:"3px",padding:"1px 6px",marginBottom:"5px"}},
                  React.createElement("span",{style:{width:"6px",height:"6px",borderRadius:"50%",background:tCol,flexShrink:0}}),
                  typeLabels2[nb.noteType]||nb.noteType
                ),
                React.createElement("div",{style:{fontSize:"15px",fontWeight:600,color:fg,lineHeight:1.3,
                  overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}},
                  nb.title||"(zonder titel)")
              ),
              preview&&React.createElement("div",{style:{padding:"8px 12px",fontSize:"12.5px",color:mut,
                lineHeight:1.7,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:5,WebkitBoxOrient:"vertical",
                borderBottom:tags.length?`1px solid ${W.splitBg||"#2a2a2a"}`:"none"}},
                preview+(nb.content?.length>200?"…":"")),
              tags.length>0&&React.createElement("div",{style:{padding:"6px 10px",display:"flex",flexWrap:"wrap",gap:"4px"}},
                ...tags.map(t=>React.createElement("span",{key:t,style:{fontSize:"11px",padding:"2px 7px",
                  borderRadius:"10px",background:"rgba(159,202,86,0.1)",border:"1px solid rgba(159,202,86,0.25)",
                  color:green}},`#${t}`))
              ),
              React.createElement("div",{style:{padding:"4px 12px 8px"}},
                React.createElement("span",{style:{fontSize:"11px",color:mut,fontStyle:"italic"}},
                  "Klik → canvas  |  Hover → verder verkennen"))
            );
          })(),

          React.createElement("svg",{
            width:svgSize,height:svgSize,
            style:{
              overflow:"visible",
              filter:"drop-shadow(0 16px 48px rgba(0,0,0,0.85)) drop-shadow(0 4px 16px rgba(0,0,0,0.6))",
              animation:"zk-radial-in 0.25s cubic-bezier(0.34,1.56,0.64,1)",
              transformOrigin:"50% 50%",
            },
            // Verlaat SVG → wacht 400ms voor sluiten (zodat gebruiker
            // de muis kan bewegen van ring N naar ring N+1 zonder collapse)
            onMouseLeave:()=>{
              clearTimeout(ringTimerRef.current);
              svgLeaveTimer.current = setTimeout(()=>{
                setRingPath([]);
                setHoverPreview(null);
              }, 400);
            },
            onMouseEnter:()=>{
              // Gebruiker keert terug: annuleer het sluiten
              clearTimeout(svgLeaveTimer.current);
            }
          },
            React.createElement("defs",null,
              // Glow filter voor hover-effect
              React.createElement("filter",{id:"zk-glow",x:"-40%",y:"-40%",width:"180%",height:"180%"},
                React.createElement("feGaussianBlur",{in:"SourceGraphic",stdDeviation:"6",result:"blur"}),
                React.createElement("feMerge",null,
                  React.createElement("feMergeNode",{in:"blur"}),
                  React.createElement("feMergeNode",{in:"SourceGraphic"})
                )
              ),
              // Zachte schaduw voor het midden
              React.createElement("filter",{id:"zk-shadow",x:"-20%",y:"-20%",width:"140%",height:"140%"},
                React.createElement("feDropShadow",{dx:"0",dy:"2",stdDeviation:"8",floodOpacity:"0.5"})
              ),
              // Radiaal verloop voor binnenring slices
              React.createElement("radialGradient",{id:"zk-rg-in",cx:"50%",cy:"50%",r:"80%"},
                React.createElement("stop",{offset:"0%",stopColor:"rgba(255,255,255,0.12)"}),
                React.createElement("stop",{offset:"100%",stopColor:"rgba(0,0,0,0.25)"})
              ),
              // Overlay voor outer ringen
              React.createElement("radialGradient",{id:"zk-rg-out",cx:"30%",cy:"30%",r:"80%"},
                React.createElement("stop",{offset:"0%",stopColor:"rgba(255,255,255,0.08)"}),
                React.createElement("stop",{offset:"100%",stopColor:"rgba(0,0,0,0.18)"})
              ),
              // Clip voor de hele SVG (voor animatie)
              React.createElement("clipPath",{id:"zk-center-clip"},
                React.createElement("circle",{cx:"0",cy:"0",r:"480"})
              )
            ),
            React.createElement("g",{transform:`translate(${half},${half})`},

              // ── Ringen 1 t/m 4 ──────────────────────────────────────
              ...ringNodes.slice().reverse().map((nodes, revDepth) => {
                const depth = (MAX_DEPTH - 1) - revDepth; // render diepe ringen eerst (achtergrond)
                if (!nodes.length) return null;
                const [r1,r2] = RING_RADII[depth];
                const [baseC, hovC] = RING_COLORS[depth];
                const {start, span} = ringArcs[depth];
                const mxW = maxW[depth];
                const egoNote = notes.find(n=>n.id===egoNoteId);

                return nodes.map(({note:nb, weight}, i) => {
                  const a0 = start + i*span;
                  const a1 = a0 + span;
                  const m  = mid(r1, r2, a0, a1);
                  const isActive  = ringPath[depth]?.noteId === nb.id;
                  const isHovered = hoverPreview?.note?.id === nb.id;
                  const baseAlpha = isDark ? 0.20 : 0.38;
                  const alpha = baseAlpha + (weight/mxW)*(isDark?0.40:0.24);

                  // Verbindingstype kleuren voor ring 0
                  let baseR=100,baseG=150,baseB=200;
                  if (depth===0) {
                    const egoLinks = ((egoNote?.content||"").match(/\[\[([^\]]+)\]\]/g)||[]).map(s=>s.slice(2,-2).split("|")[0].trim());
                    const nbLinks  = ((nb.content||"").match(/\[\[([^\]]+)\]\]/g)||[]).map(s=>s.slice(2,-2).split("|")[0].trim());
                    if (egoLinks.includes(nb.id))        {baseR=138;baseG=198;baseB=242;}
                    else if (nbLinks.includes(egoNoteId)){baseR=234;baseG=231;baseB=136;}
                    else                                  {baseR=159;baseG=202;baseB=86;}
                  }

                  const tCol2 = typeColorMap2[nb.noteType]||null;

                  const enterHandler = () => {
                    // Preview: direct tonen (geen vertraging)
                    setHoverPreview({note:nb, sliceAngle:(a0+a1)/2});
                    // Annuleer SVG-leave timer (gebruiker is weer in het menu)
                    clearTimeout(svgLeaveTimer.current);
                    // Debounce: pas na 160ms het pad bijwerken
                    // Dit voorkomt flikker bij snel langs opties bewegen
                    clearTimeout(ringTimerRef.current);
                    ringTimerRef.current = setTimeout(() => {
                      setRingPath(prev => {
                        const next = prev.slice(0, depth);
                        next[depth] = {noteId:nb.id, idx:i, a0, a1};
                        return next;
                      });
                    }, 160);
                  };

                  return React.createElement("g",{
                    key:`ring${depth}_${nb.id}`,
                    style:{pointerEvents:"all",cursor:"pointer"},
                    onMouseEnter: enterHandler,
                    onClick: e=>{e.stopPropagation(); addNeighbor(nb, weight, card.id);}
                  },
                    // Slice achtergrond met gradient
                    React.createElement("path",{
                      d:arc(r1,r2,a0,a1),
                      fill: depth===0
                        ? isHovered||isActive
                          ? `rgba(${baseR},${baseG},${baseB},${isDark?0.65:0.72})`
                          : `rgba(${Math.round(baseR*(isDark?.28:.55))},${Math.round(baseG*(isDark?.28:.55))},${Math.round(baseB*(isDark?.28:.55))},${alpha})`
                        : isHovered||isActive
                          ? `${hovC}${isDark?0.60:0.72})`
                          : `${baseC}${alpha})`,
                      stroke: isHovered||isActive
                        ? `rgba(${baseR},${baseG},${baseB},0.55)` : sep,
                      strokeWidth: isHovered||isActive ? 1.5 : 0.8,
                      style:{transition:"fill .2s, stroke .2s",
                             filter:isHovered?"url(#zk-glow)":""}
                    }),
                    // Gradient sheen overlay
                    React.createElement("path",{
                      d:arc(r1,r2,a0,a1),
                      fill:"url(#zk-rg-out)",style:{pointerEvents:"none"}
                    }),
                    // Noot-type streepje (binnenrand)
                    tCol2 && React.createElement("path",{
                      d:arc(r1, r1+5, a0+1, a1-1),
                      fill:`${tCol2}cc`, style:{pointerEvents:"none",
                        filter:isHovered?"url(#zk-glow)":""}
                    }),
                    // Icoon achtergrond cirkel
                    React.createElement("circle",{
                      cx:m.x,cy:m.y,r:isHovered?19:16,
                      fill:isHovered
                        ? `rgba(${baseR},${baseG},${baseB},0.35)`
                        : `rgba(${Math.round(baseR*.4)},${Math.round(baseG*.4)},${Math.round(baseB*.4)},0.5)`,
                      stroke:`rgba(${baseR},${baseG},${baseB},${isHovered?0.7:0.25})`,
                      strokeWidth:isHovered?2:1,
                      style:{transition:"all .18s"}
                    }),
                    // Gewicht getal
                    React.createElement("text",{
                      x:m.x,y:m.y,textAnchor:"middle",dominantBaseline:"middle",
                      fontSize:isHovered?13:11,fontWeight:"700",
                      fill:isHovered?"#ffffd7":fg,
                      fontFamily:"'DM Sans',sans-serif",
                      style:{pointerEvents:"none",transition:"font-size .18s"}
                    },weight),
                    // Titel label
                    React.createElement("text",{
                      x:m.x*(1+24/Math.max(1,Math.hypot(m.x,m.y))),
                      y:m.y*(1+24/Math.max(1,Math.hypot(m.x,m.y)))+12,
                      textAnchor:m.x>15?"start":m.x<-15?"end":"middle",
                      fontSize:isHovered?11:10,fontWeight:isHovered?"600":"400",
                      fill:isHovered?"#ffffd7":`${mut}cc`,
                      fontFamily:"'DM Sans',sans-serif",
                      style:{pointerEvents:"none",transition:"all .18s"}
                    },(nb.title||nb.id).slice(0,14)+((nb.title||nb.id).length>14?"…":""))
                  );
                });
              }),

              // ── Binnenring acties ────────────────────────────────────
              ...filteredInner.map((item,i)=>{
                const a0=i*innerSpan-90, a1=a0+innerSpan;
                const m=mid(56,118,a0,a1);
                const isH=hoveredItem===item.key;
                return React.createElement("g",{
                  key:item.key,style:{pointerEvents:"all",cursor:"pointer"},
                  onMouseEnter:()=>setHoveredItem(item.key),
                  onMouseLeave:()=>setHoveredItem(null),
                  onClick:e=>{e.stopPropagation();item.action();}
                },
                  // Slice bg + glow bij hover
                  React.createElement("path",{d:arc(56,118,a0,a1),
                    fill:isH?item.hbg:item.bg,
                    stroke:isH?`${item.ic}70`:`${item.ic}25`,strokeWidth:isH?1.5:0.8,
                    style:{transition:"fill .18s,stroke .18s",filter:isH?"url(#zk-glow)":""}}),
                  // Gradient sheen
                  React.createElement("path",{d:arc(56,118,a0,a1),
                    fill:"url(#zk-rg-in)",style:{pointerEvents:"none"}}),
                  // Icoon ring
                  React.createElement("circle",{cx:m.x,cy:m.y,r:isH?18:15,
                    fill:isH?`${item.ic}28`:"rgba(255,255,255,0.07)",
                    stroke:item.ic,strokeWidth:isH?2:1,
                    style:{transition:"all .18s"}}),
                  React.createElement("text",{x:m.x,y:m.y,textAnchor:"middle",
                    dominantBaseline:"middle",fontSize:isH?16:14,fill:isH?"#fff":item.ic,
                    fontFamily:"'DM Sans',sans-serif",
                    style:{pointerEvents:"none",userSelect:"none",transition:"font-size .18s"}},
                    item.icon),
                  // Label
                  React.createElement("text",{
                    x:m.x*(1+28/Math.max(1,Math.hypot(m.x,m.y))),
                    y:m.y*(1+28/Math.max(1,Math.hypot(m.x,m.y)))+(m.y>0?10:-10),
                    textAnchor:m.x>12?"start":m.x<-12?"end":"middle",
                    fontSize:isH?10.5:9.5,fontWeight:isH?"600":"400",
                    fill:isH?"#ffffd7":`${mut}dd`,
                    fontFamily:"'DM Sans',sans-serif",style:{pointerEvents:"none",transition:"all .18s"}},
                    item.label)
                );
              }),

              // ── Middenstuk: glassmorphism ─────────────────────────────
              // Buitenste glow ring
              React.createElement("circle",{cx:0,cy:0,r:56,
                fill:"none",stroke:W.dark?"rgba(255,255,255,0.05)":"rgba(0,0,0,0.04)",strokeWidth:9,
                style:{pointerEvents:"none"}}),
              // Hoofd cirkel
              React.createElement("circle",{cx:0,cy:0,r:50,
                fill:W.dark?"rgba(10,10,14,0.90)":`${W.bg2||"rgba(240,234,220,0.96)"}`,
                stroke:W.splitBg||"rgba(255,255,255,0.14)",strokeWidth:1.5,
                filter:"url(#zk-shadow)",
                style:{pointerEvents:"all",cursor:"pointer"},
                onClick:e=>{e.stopPropagation();setCtxMenu(null);setRingPath([]);setHoverPreview(null);}}),
              // Subtiele highlight (licht van boven-links)
              React.createElement("ellipse",{cx:-8,cy:-12,rx:28,ry:20,
                fill:W.dark?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.35)",style:{pointerEvents:"none"}}),
              // × icoon
              React.createElement("text",{x:0,y:card?7:3,textAnchor:"middle",dominantBaseline:"middle",
                fontSize:22,fill:W.dark?"rgba(255,255,255,0.28)":"rgba(0,0,0,0.28)",fontFamily:"'DM Sans',sans-serif",
                style:{pointerEvents:"none"}},"×"),
              // Kaarttitel
              card&&React.createElement("text",{x:0,y:-13,textAnchor:"middle",
                fontSize:9,fontWeight:"500",fill:W.dark?"rgba(255,255,255,0.22)":W.fgMuted+"80",
                fontFamily:"'DM Sans',sans-serif",style:{pointerEvents:"none"}},
                (card.text||"").slice(0,16)+(card.text?.length>16?"…":""))
            )
          )
        );
      })()
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