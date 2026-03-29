// ── VimEditor ───────────────────────────────────────────────────────────────
// Deps: W, FONT_SIZE, LINE_H, PAD_LEFT, MD_SNIPPETS, AUTO_PAIRS,
//       SpellEngine, CompletionEngine, genId, extractTags

const VimEditor = ({value, onChange, onSave, onEscape, noteTags=[], onTagsChange,
                    allTags=[], goyoMode=false, onToggleGoyo, onEditorRef, onModeChange=()=>{},
                    llmModel="", allNotesText="",
                    onSplitCmd=null,    // (cmd) => void  — :vs/:sp/Ctrl+W-navigatie
                    onPasteBlock=null,  // (block) => void — plak geciteerd blok in editor
                    hideTagStrip=false, // verberg ingebouwde tag-strip (als SmartTagEditor al zichtbaar is)
                    noteId="",          // voor persistente undo per notitie
                    }) => {

  const { useState, useEffect, useRef, useCallback } = React;

  // ── Notitie templates ─────────────────────────────────────────────────────
  const TEMPLATES = {
    dagnotitie: () => {
      const d = new Date();
      const datum = d.toLocaleDateString("nl-NL", {weekday:"long",year:"numeric",month:"long",day:"numeric"});
      return `# Dagnotitie — ${datum}\n\n## Vandaag\n\n- \n\n## Notities\n\n\n\n## Morgen\n\n- \n\n#dagnotitie`;
    },
    meeting: () => {
      const d = new Date().toISOString().slice(0,10);
      return `# Meeting — ${d}\n\n**Deelnemers:** \n**Doel:** \n\n## Agenda\n\n1. \n\n## Beslissingen\n\n- \n\n## Actiepunten\n\n- [ ] \n\n#meeting`;
    },
    literatuur: `# \n\n**Auteur:** \n**Jaar:** \n**Bron:** \n\n## Samenvatting\n\n\n\n## Citaten\n\n> \n\n## Eigen gedachten\n\n\n\n#literatuur #bron`,
    project:    `# Project: \n\n**Status:** actief\n**Doel:** \n\n## Achtergrond\n\n\n\n## Taken\n\n- [ ] \n\n## Aantekeningen\n\n\n\n#project`,
    vraag:      `# Vraag: \n\n## Context\n\n\n\n## Hypothese\n\n\n\n## Antwoord\n\n\n\n#vraag #onderzoek`,
  };

  // ── React state ────────────────────────────────────────────────────────────
  const [helpOpen,   setHelpOpen]  = useState(false);
  const [mode,       setModeState] = useState("INSERT");
  const [cmdBuf,     setCmdBuf]    = useState("");
  const [visualSel,  setVisualSel] = useState(null); // {start:{row,col}, end:{row,col}, line:bool}
  const [statusMsg,  setStatus]    = useState("");
  const [spellLang,  setSpell]     = useState("nl");    // standaard Nederlands
  const spellCycle = ["nl","en","off"];

  // Completion popup state
  const [compList,   setCompList]  = useState([]);   // [{word, source}]
  const [compIdx,    setCompIdx]   = useState(0);

  // Scroll geselecteerd completion-item in beeld na pijltjesnavigatie
  React.useEffect(() => {
    const list = document.querySelector("[data-comp-list]");
    if (!list) return;
    const items = list.querySelectorAll("[data-comp-item]");
    if (items[compIdx]) items[compIdx].scrollIntoView({ block: "nearest" });
  }, [compIdx]);    // geselecteerde index
  const [compOpen,   setCompOpen]  = useState(false);
  const [compPos,    setCompPos]   = useState({x:0, y:0}); // popup positie in px
  const [aiLoading,  setAiLoading] = useState(false);

  // AI taalverbetering state
  const [aiImprove,    setAiImprove]    = useState(null);   // {original, improved} of null
  const [aiImproving,  setAiImproving]  = useState(false);  // bezig met verbeteren
  const [aiImproveLang,setAiImproveLang]= useState("nl");  // "nl"|"en"|"auto"
  const compRef    = useRef({list:[], idx:0, open:false});

  // Spell check state — set van {row, col, len} fout-posities
  const spellErrors    = useRef(new Map()); // row → [{col,len,word}]
  const spellTimer     = useRef(null);
  const spellDirtyRows = useRef(new Set()); // rijen gewijzigd sinds laatste check
  const spellLastLines = useRef([]);        // snapshot voor diff

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
    yankedLines: [],             // voor linewise yank (V mode)
    search:    "",
    matches:   [],
    matchIdx:  0,
    charW:     7.8,             // wordt gemeten na mount
    numCols:   4,               // breedte regelnummer-kolom (in tekens)
    visRows:   30,
    selecting: false,
    selA:      null,
    selB:      null,
    // Visual mode
    visual:    false,           // is visual mode actief?
    visualLine:false,           // V (linewise) mode
    visualStart:{row:0,col:0},  // ankerpunt
    // Dot repeat
    lastAction: null,           // {type, payload} — herhaalbaar via '.'
    // Pending operator (voor text objects: d/c/y + motion/object)
    pendingOp: null,            // 'c'|'d'|'y' — wacht op beweging/object
    // Folds
    folds: {},                  // row → true als gevouwen
    // Marks: a-z → {row, col}
    marks: {},
    // Macros: register a-z → array van keys
    macros: {},
    macroRec: null,             // null of 'a'-'z' (opname-register)
    macroKeys: [],              // gebufferde toetsen tijdens opname
    // Relative line numbers
    relativeNumbers: false,
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
    onModeChange(m);
  }, [onModeChange]);

  // ── Externe value sync + persistente undo laden ─────────────────────────
  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      const s = S.current;
      s.lines = value.split("\n");
      // Laad bewaarde undo-history voor deze notitie
      const saved = UNDO_LOAD(noteId);
      if (saved && saved.stack.length > 1) {
        // Controleer of de opgeslagen state nog overeenkomt met de huidige content
        const lastSaved = saved.stack[saved.idx]?.join("\n");
        if (lastSaved === value || saved.stack[saved.stack.length-1]?.join("\n") === value) {
          s.undo    = saved.stack;
          s.undoIdx = saved.idx;
          setStatus("↺ undo-history hersteld");
          setTimeout(() => setStatus(""), 1500);
        } else {
          s.undo = [s.lines.slice()]; s.undoIdx = 0;
        }
      } else {
        s.undo = [s.lines.slice()]; s.undoIdx = 0;
      }
      clamp();
      draw();
      scheduleSpellCheck();
    }
  }, [value, noteId]);

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
      const p   = cv.parentElement;
      const pw  = p.offsetWidth  || p.clientWidth  || p.getBoundingClientRect().width;
      const ph  = p.offsetHeight || p.clientHeight || p.getBoundingClientRect().height;
      if (!pw || !ph) return; // wacht tot layout klaar is
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

    requestAnimationFrame(()=>{ requestAnimationFrame(()=>{
      resize();
      setTimeout(resize, 150); // iOS Safari: layout soms nog niet klaar
    }); });
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

  // ── Persistente undo (localStorage per notitie) ─────────────────────────
  const UNDO_KEY    = (id) => `zk_undo_${id}`;
  const UNDO_MAX    = 40;   // max stappen bewaren
  const UNDO_STORE  = (id, stack, idx) => {
    if (!id) return;
    try {
      localStorage.setItem(UNDO_KEY(id), JSON.stringify({
        stack: stack.slice(-UNDO_MAX),
        idx:   Math.min(idx, UNDO_MAX - 1),
        ts:    Date.now(),
      }));
    } catch {}
  };
  const UNDO_LOAD = (id) => {
    if (!id) return null;
    try {
      const raw = localStorage.getItem(UNDO_KEY(id));
      if (!raw) return null;
      const d = JSON.parse(raw);
      // Verlopen na 24 uur
      if (Date.now() - d.ts > 86400000) { localStorage.removeItem(UNDO_KEY(id)); return null; }
      return d;
    } catch { return null; }
  };

  const pushUndo = (s) => {
    const cut = s.undo.slice(0, s.undoIdx + 1);
    cut.push(s.lines.slice());
    if (cut.length > UNDO_MAX) cut.shift();
    s.undo    = cut;
    s.undoIdx = cut.length - 1;
    UNDO_STORE(noteId, s.undo, s.undoIdx);
  };

  const scheduleUndo = (s) => {
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => pushUndo(s), 600);
  };

  const insertChar = (s, ch) => {
    const {row, col} = s.cur;
    s.lines[row] = s.lines[row].slice(0, col) + ch + s.lines[row].slice(col);
    s.cur.col += ch.length;
    // Track voor dot repeat
    if (s._insertText !== undefined) s._insertText += ch;
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

  // ── Visual mode helpers ──────────────────────────────────────────────────
  const getVisualRange = (s) => {
    if (!s.visual) return null;
    const a = s.visualStart, b = s.cur;
    const startRow = Math.min(a.row, b.row);
    const endRow   = Math.max(a.row, b.row);
    if (s.visualLine) {
      return { startRow, endRow, startCol: 0, endCol: s.lines[endRow].length, line: true };
    }
    // Char-wise: zorg voor correcte richting
    const forward = a.row < b.row || (a.row === b.row && a.col <= b.col);
    return {
      startRow: forward ? a.row : b.row,
      startCol: forward ? a.col : b.col,
      endRow:   forward ? b.row : a.row,
      endCol:   forward ? b.col : a.col,
      line: false,
    };
  };

  const getVisualText = (s) => {
    const r = getVisualRange(s); if (!r) return "";
    if (r.line) {
      return s.lines.slice(r.startRow, r.endRow + 1).join("\n");
    }
    if (r.startRow === r.endRow) {
      return s.lines[r.startRow].slice(r.startCol, r.endCol + 1);
    }
    const parts = [s.lines[r.startRow].slice(r.startCol)];
    for (let i = r.startRow + 1; i < r.endRow; i++) parts.push(s.lines[i]);
    parts.push(s.lines[r.endRow].slice(0, r.endCol + 1));
    return parts.join("\n");
  };

  const deleteVisualRange = (s) => {
    const r = getVisualRange(s); if (!r) return;
    pushUndo(s);
    s.yank = getVisualText(s);
    s.yankedLines = r.line;
    if (r.line) {
      s.lines.splice(r.startRow, r.endRow - r.startRow + 1);
      if (s.lines.length === 0) s.lines = [""];
      s.cur.row = Math.min(r.startRow, s.lines.length - 1);
      s.cur.col = 0;
    } else if (r.startRow === r.endRow) {
      s.lines[r.startRow] = s.lines[r.startRow].slice(0, r.startCol) +
                             s.lines[r.startRow].slice(r.endCol + 1);
      s.cur.row = r.startRow;
      s.cur.col = r.startCol;
    } else {
      const before = s.lines[r.startRow].slice(0, r.startCol);
      const after  = s.lines[r.endRow].slice(r.endCol + 1);
      s.lines.splice(r.startRow, r.endRow - r.startRow + 1, before + after);
      s.cur.row = r.startRow;
      s.cur.col = r.startCol;
    }
    s.visual = false; s.visualLine = false;
    setVisualSel(null);
    emit(s);
  };

  const exitVisual = (s) => {
    s.visual = false; s.visualLine = false;
    setVisualSel(null);
  };

  // ── Dot repeat ───────────────────────────────────────────────────────────
  const repeatLastAction = (s) => {
    const a = s.lastAction; if (!a) return;
    if (a.type === "insert") {
      // Herhaal ingevoegde tekst op huidige cursorpositie
      pushUndo(s);
      for (const ch of a.text) {
        if (ch === "\n") {
          const {row, col} = s.cur;
          const before = s.lines[row].slice(0, col);
          const after  = s.lines[row].slice(col);
          s.lines[row] = before;
          s.lines.splice(row + 1, 0, after);
          s.cur.row = row + 1; s.cur.col = 0;
        } else {
          insertChar(s, ch);
        }
      }
      emit(s);
    } else if (a.type === "delete-line") {
      s.yank = s.lines[s.cur.row];
      pushUndo(s);
      s.lines.splice(s.cur.row, 1);
      if (s.lines.length === 0) s.lines = [""];
      clamp(); emit(s);
    } else if (a.type === 'replace-char') {
      const {row, col} = s.cur;
      const line = s.lines[row];
      if (col < line.length) {
        pushUndo(s);
        s.lines[row] = line.slice(0, col) + a.ch + line.slice(col + 1);
        emit(s);
      }
    } else if (a.type === "delete-char") {
      const {row, col} = s.cur;
      const line = s.lines[row];
      if (col < line.length) {
        pushUndo(s);
        s.lines[row] = line.slice(0, col) + line.slice(col + 1);
        emit(s);
      }
    }
    setStatus(".");
  };

  // ── Text objects ─────────────────────────────────────────────────────────
  // Geeft {start, end} terug als col-indices in de huidige regel
  // inner=true → ci" stijl (zonder delimiters), inner=false → ca" (met delimiters)
  const findTextObject = (s, char, inner) => {
    const line = s.lines[s.cur.row];
    const col  = s.cur.col;

    // Pairs: ( [ { < en quotes " ' `
    const pairs   = { '(':')', '[':']', '{':'}', '<':'>' };
    const closing = { ')':'(', ']':'[', '}':'{', '>':'<' };
    const quotes  = new Set(['"', "'", '`']);

    if (quotes.has(char)) {
      // Zoek dichtstbijzijnde paar rond cursor
      let left = -1, right = -1;
      for (let i = col; i >= 0; i--)  if (line[i] === char) { left  = i; break; }
      for (let i = col; i < line.length; i++) if (line[i] === char) { right = i; break; }
      // Als cursor op het quote-teken staat, zoek ook rechts voor left
      if (left === col) {
        for (let i = col - 1; i >= 0; i--) if (line[i] === char) { left = i; break; }
      }
      if (left < 0 || right < 0 || left === right) return null;
      return inner
        ? { start: left + 1, end: right - 1 }
        : { start: left,     end: right };
    }

    // Bracket pairs — zoek genest
    const open  = pairs[char]   ? char : closing[char] ? closing[char] : null;
    const close = open ? pairs[open] : null;
    if (!open || !close) return null;

    let depth = 0, left = -1, right = -1;
    // Scan links voor open bracket
    for (let i = col; i >= 0; i--) {
      if (line[i] === close && i < col) depth++;
      if (line[i] === open)  {
        if (depth === 0) { left = i; break; }
        else depth--;
      }
    }
    if (left < 0) return null;
    // Scan rechts voor close bracket
    depth = 0;
    for (let i = left + 1; i < line.length; i++) {
      if (line[i] === open)  depth++;
      if (line[i] === close) {
        if (depth === 0) { right = i; break; }
        else depth--;
      }
    }
    if (right < 0) return null;
    return inner
      ? { start: left + 1, end: right - 1 }
      : { start: left,     end: right };
  };

  // Voer een text object operatie uit: op='d'|'c'|'y', char='"'|'('|etc., inner=bool
  const applyTextObject = (s, op, char, inner) => {
    const range = findTextObject(s, char, inner);
    if (!range) { setStatus(`Geen ${char} gevonden`); return; }
    const { start, end } = range;
    if (start > end) { setStatus(`Leeg`); return; }
    const row = s.cur.row;
    const text = s.lines[row].slice(start, end + 1);
    pushUndo(s);
    s.yank = text;
    if (op === 'y') {
      setStatus(`gekopieerd: ${text.slice(0,20)}${text.length>20?'…':''}`);
      s.cur.col = start;
      return;
    }
    // d of c: verwijder de tekst
    s.lines[row] = s.lines[row].slice(0, start) + s.lines[row].slice(end + 1);
    s.cur.col = start;
    emit(s);
    if (op === 'c') setMode('INSERT');
    else setStatus(`verwijderd: ${text.slice(0,20)}${text.length>20?'…':''}`);
  };

  // ── % navigatie ───────────────────────────────────────────────────────────
  const jumpToMatch = (s) => {
    const line = s.lines[s.cur.row];
    const col  = s.cur.col;
    const opens  = '([{';
    const closes = ')]}';
    const ch = line[col] || '';

    let searchOpen, searchClose, dir;
    const oi = opens.indexOf(ch);
    const ci = closes.indexOf(ch);
    if (oi >= 0)      { searchOpen = ch; searchClose = closes[oi]; dir =  1; }
    else if (ci >= 0) { searchOpen = opens[ci]; searchClose = ch;   dir = -1; }
    else {
      // Zoek dichtstbijzijnde bracket op de regel
      for (let i = col; i < line.length; i++) {
        if (opens.includes(line[i])) {
          const ni = opens.indexOf(line[i]);
          searchOpen = line[i]; searchClose = closes[ni]; dir = 1;
          s.cur.col = i; break;
        }
      }
      if (!searchOpen) { setStatus('Geen bracket gevonden'); return; }
    }

    // Zoek matchende bracket (multi-regel)
    let depth = 0;
    const startRow = s.cur.row;
    const startCol = s.cur.col;
    const rowStep  = dir;
    let r = startRow, c = startCol;

    outer: for (let ri = startRow; ri >= 0 && ri < s.lines.length; ri += rowStep || 1) {
      const ln = s.lines[ri];
      const cStart = ri === startRow ? (dir > 0 ? startCol : ln.length - 1) : (dir > 0 ? 0 : ln.length - 1);
      const cEnd   = dir > 0 ? ln.length - 1 : 0;
      for (let ci2 = cStart; dir > 0 ? ci2 <= cEnd : ci2 >= cEnd; ci2 += dir) {
        if (ln[ci2] === searchOpen)  depth++;
        if (ln[ci2] === searchClose) depth--;
        if (depth === 0) { r = ri; c = ci2; break outer; }
      }
    }

    if (depth !== 0) { setStatus('Geen match gevonden'); return; }
    s.cur.row = r; s.cur.col = c;
    scrollToCursor(s);
    setStatus('');
  };

  // ── Folds (zo/zc/za voor markdown headers) ───────────────────────────────
  const toggleFold = (s, forceOpen) => {
    const row = s.cur.row;
    const line = s.lines[row];
    const m = line.match(/^(#{1,6})\s/);
    if (!m) { setStatus('Geen header op deze regel'); return; }
    const level = m[1].length;

    // Vind het bereik van deze sectie
    let end = row + 1;
    while (end < s.lines.length) {
      const ml = s.lines[end].match(/^(#{1,6})\s/);
      if (ml && ml[1].length <= level) break;
      end++;
    }
    if (end === row + 1) { setStatus('Lege sectie'); return; }

    const key = row;
    if (forceOpen === true || (forceOpen === undefined && s.folds[key])) {
      // Openklappen
      delete s.folds[key];
      setStatus(`▾ ${line.slice(0, 30)}`);
    } else {
      // Dichtvouwen
      s.folds[key] = end - 1; // sla eindlijn op
      // Cursor naar header als die verborgen zou zijn
      if (s.cur.row > row && s.cur.row < end) s.cur.row = row;
      setStatus(`▸ ${line.slice(0, 30)} [${end - row - 1} regels verborgen]`);
    }
  };

  const openAllFolds = (s) => { s.folds = {}; setStatus('Alle folds open'); };
  const closeAllFolds = (s) => {
    s.folds = {};
    s.lines.forEach((line, i) => {
      if (/^#{1,6}\s/.test(line)) {
        const level = line.match(/^(#{1,6})/)[1].length;
        let end = i + 1;
        while (end < s.lines.length) {
          const ml = s.lines[end].match(/^(#{1,6})\s/);
          if (ml && ml[1].length <= level) break;
          end++;
        }
        if (end > i + 1) s.folds[i] = end - 1;
      }
    });
    setStatus('Alle headers dichtgevouwen');
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
    if (cmd==="help"||cmd==="?") { setHelpOpen(true); return; }
    if (cmd==="template"||cmd.startsWith("template ")) {
      const tmplName = cmd.slice(9).trim() || "dagnotitie";
      const tmpl = TEMPLATES[tmplName];
      if (tmpl) {
        pushUndo(s);
        const text = typeof tmpl === "function" ? tmpl() : tmpl;
        s.lines = text.split("\n");
        s.cur = {row:0,col:0};
        emit(s); clamp(); draw();
        setStatus(`template: ${tmplName}`);
      } else {
        setStatus(`Onbekend template: ${tmplName}. Beschikbaar: ${Object.keys(TEMPLATES).join(", ")}`);
      }
      return;
    }
    if (cmd==="w")            { onSave(); setStatus("opgeslagen ✓"); return; }
    if (cmd==="wq")           { onSave(); onEscape(); return; }
    if (cmd==="q!")           { onEscape(); return; }
    if (cmd==="goyo")         { onToggleGoyo?.(); return; }
    if (cmd==="spell"||cmd==="sp") { const i=(spellCycle.indexOf(spellLang)+1)%3; setSpell(spellCycle[i]); setStatus(`spell: ${spellCycle[i]}`); return; }
    if (cmd==="wrap")         { setStatus("wrap: aan (standaard)"); return; }
    if (cmd==="rnu"||cmd==="relativenumber") {
      s.relativeNumbers = !s.relativeNumbers;
      setStatus(`relatieve regelnummers: ${s.relativeNumbers?"aan":"uit"}`);
      draw(); return;
    }
    if (cmd==="set rnu")  { s.relativeNumbers=true;  setStatus("relatieve nummers aan"); draw(); return; }
    if (cmd==="set nornu"){ s.relativeNumbers=false; setStatus("relatieve nummers uit"); draw(); return; }
    // Spell: :spell+ voegt huidig woord toe aan geleerde woorden
    if (cmd==="spell+" || cmd==="sp+") {
      const s2 = S.current;
      const {row,col} = s2.cur;
      const before = s2.lines[row].slice(0, col);
      const wm = before.match(/([a-zA-ZÀ-ÿ'-]+)$/);
      if (wm) { SpellEngine.learnWord(wm[1]); scheduleSpellCheck(); setStatus(`geleerd: ${wm[1]}`); }
      return;
    }
    // ── Split-navigatie (delegeer aan parent via onSplitCmd) ─────────────────
    if (cmd==="vs" || cmd==="vsp")   { onSplitCmd?.("vs"); setStatus("split: verticaal"); return; }
    if (cmd==="sp" || cmd==="split") { onSplitCmd?.("sp"); setStatus("split: horizontaal"); return; }
    if (cmd==="q" || cmd==="close")  { onSplitCmd?.("close"); return; }
    if (cmd==="only")                { onSplitCmd?.("only"); setStatus("split gesloten"); return; }
    if (/^e\s+/.test(cmd))           { onSplitCmd?.("edit:"+cmd.slice(2).trim()); return; }
    if (/^vsp\s+/.test(cmd))         { onSplitCmd?.("vs:"+cmd.slice(4).trim()); return; }
    setStatus(`onbekend: :${cmd}`);
  }, [noteTags, onTagsChange, onSave, onEscape, onToggleGoyo, spellLang, onSplitCmd]);

  // ── Spell check engine ────────────────────────────────────────────────────
  // Detecteert taal automatisch op basis van tekenfrequentie.
  // Gebruikt de browser-native spellcheck via een verborgen <div contenteditable>.

  // Verborgen contenteditable voor native spellcheck (eenmalig aangemaakt)
  const spellDiv = useRef(null);
  const getSpellDiv = useCallback((lang) => {
    if (!spellDiv.current) {
      const d = document.createElement("div");
      d.contentEditable = "true";
      d.setAttribute("spellcheck","true");
      Object.assign(d.style, {
        position:"fixed",top:"-9999px",left:"-9999px",
        width:"600px",fontSize:"16px",lineHeight:"1.5",
        background:"white",color:"black",padding:"4px",
        whiteSpace:"pre-wrap",opacity:"0",pointerEvents:"none",
      });
      document.body.appendChild(d);
      spellDiv.current = d;
    }
    spellDiv.current.lang = lang === "nl" ? "nl" : "en";
    return spellDiv.current;
  }, []);

  // Detecteer taal automatisch: NL heeft 'ij','aa','oo','ee','uu','sch','ng' hoog;
  // EN heeft 'th','wh','ing','tion','ed' hoog.
  const detectLang = useCallback((text) => {
    const lc = text.toLowerCase();
    const nlScore = (lc.match(/\b(de|het|een|en|in|van|te|dat|dit|met|ik|je|we|ze|ook|aan|er|maar|om|nog|al|wel|geen|meer|op|uit)\b/g)||[]).length;
    const enScore = (lc.match(/\b(the|and|for|that|with|this|are|was|have|from|they|will|been|not|can|but|what|all|your|which|their|would|there|about|can|more|also|into|some|than|then)\b/g)||[]).length;
    return nlScore > enScore ? "nl" : "en";
  }, []);

  // Spellcheck één regel — geeft terug: [{col, len, word}]
  const checkLine = useCallback((line, lang) => {
    if (!line.trim()) return [];
    const errors = [];
    // Splits op woordgrenzen
    const wordRe = /[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F'-]{2,}/g;
    let m;
    while ((m = wordRe.exec(line)) !== null) {
      const word = m[0].replace(/^'+|'+$/g, "");
      if (word.length < 2) continue;
      // Skip: getallen, afkortingen, links, code
      if (/\d/.test(word)) continue;
      if (/^[A-Z]{2,}$/.test(word)) continue;           // afkorting
      if (SpellEngine.isLearned(word)) continue;
      // Gebruik gecachede check
      const ok = SpellEngine.check(word, lang);
      if (ok === false) errors.push({col: m.index, len: word.length, word});
    }
    return errors;
  }, []);

  // Plan een spellcheck voor de hele buffer (gespreid over frames)
  // Grammaticafouten: row → [{col,len,msg,type}]
  const grammarErrors = useRef(new Map());

  const scheduleSpellCheck = useCallback((changedRows = null) => {
    if (spellLang === "off") {
      spellErrors.current.clear();
      grammarErrors.current.clear();
      draw();
      return;
    }
    // Registreer welke rijen gewijzigd zijn voor incrementele check
    if (changedRows) {
      changedRows.forEach(r => spellDirtyRows.current.add(r));
    } else {
      // Volledige hercheck — markeer alles dirty
      spellDirtyRows.current = null; // null = alles
    }
    clearTimeout(spellTimer.current);
    spellTimer.current = setTimeout(async () => {
      const s    = S.current;
      const lang = spellLang;

      // ── Stap 1: bepaal welke regels gecheckt moeten worden ────────────
      const dirty = spellDirtyRows.current; // null = alles, Set = specifieke rijen
      spellDirtyRows.current = new Set();   // reset voor volgende ronde

      // Bereken diff voor incrementele check
      const lastLines = spellLastLines.current;
      const dirtySet  = new Set();
      if (dirty === null) {
        // Volledige check
        s.lines.forEach((_, i) => dirtySet.add(i));
      } else {
        // Alleen gewijzigde + aangrenzende rijen
        dirty.forEach(r => {
          dirtySet.add(r);
          if (r > 0) dirtySet.add(r - 1);
          if (r < s.lines.length - 1) dirtySet.add(r + 1);
        });
        // Ook rijen die van lengte veranderd zijn
        s.lines.forEach((line, i) => {
          if (line !== lastLines[i]) dirtySet.add(i);
        });
      }
      spellLastLines.current = s.lines.slice();

      if (dirtySet.size === 0) return; // niets te doen

      // ── Stap 2: verzamel woorden uit dirty regels ────────────────────
      const allWords = new Set();
      for (const row of dirtySet) {
        const line = s.lines[row] || "";
        const re = /[a-zA-ZÀ-ÿ'-]{3,}/g;
        let m;
        while ((m = re.exec(line)) !== null) {
          const w = m[0].replace(/^'+|'+$/g, "");
          if (w.length >= 3) allWords.add(w);
        }
      }

      // ── Stap 2: server spellcheck ─────────────────────────────────────
      let spellRes = {}, grammarRes = [], detectedLang = lang;
      try {
        const resp = await fetch("/api/spellcheck", {
          method:  "POST",
          headers: {"Content-Type": "application/json"},
          body:    JSON.stringify({
            words: [...allWords],
            lines: s.lines,
            dirty_rows: [...dirtySet],
            lang
          }),
        });
        const data = await resp.json();
        spellRes   = data.spell   || {};
        grammarRes = data.grammar || [];
        detectedLang = data.lang  || lang;
      } catch(e) {
        console.warn("[spell] server fout:", e.message);
      }

      // ── Stap 3: fouten per regel markeren (alleen dirty rijen) ────────
      const newSpell = new Map(spellErrors.current); // start van bestaande cache
      // Wis oude fouten voor dirty rijen
      dirtySet.forEach(r => newSpell.delete(r));
      // Check alleen dirty rijen
      [...dirtySet].forEach(row => {
        const line = s.lines[row] || "";
        const errs = [];
        // Nieuwe regex per regel — KRITIEK: voorkomt lastIndex-bug
        const re = /[a-zA-ZÀ-ÿ'-]{3,}/g;
        let m;
        while ((m = re.exec(line)) !== null) {
          const raw  = m[0];
          const word = raw.replace(/^'+|'+$/g, "");
          if (word.length < 3) continue;
          if (/\d/.test(word)) continue;
          if (/^[A-Z]{2,}$/.test(word)) continue;   // afkorting
          if (SpellEngine.isLearned(word)) continue;
          // Server indexeert op raw EN lowercase — probeer beide
          const entry = spellRes[raw] ?? spellRes[raw.toLowerCase()]
                     ?? spellRes[word] ?? spellRes[word.toLowerCase()];
          if (entry && entry.spell === false) {
            errs.push({ col: m.index, len: raw.length, word: raw,
                        type: "spell", suggestions: entry.suggestions || [] });
          }
        }
        if (errs.length) newSpell.set(row, errs);
      });
      spellErrors.current = newSpell;

      // ── Stap 4: grammaticafouten — merge met bestaande cache ─────────
      const newGrammar = new Map(grammarErrors.current);
      dirtySet.forEach(r => newGrammar.delete(r)); // wis dirty
      for (const err of grammarRes) {
        if (!dirtySet.has(err.row)) continue; // skip niet-dirty
        if (!newGrammar.has(err.row)) newGrammar.set(err.row, []);
        newGrammar.get(err.row).push(err);
      }
      grammarErrors.current = newGrammar;

      if (lang === "auto" && detectedLang !== "auto")
        setStatus(`spell: auto → ${detectedLang}`);

      draw();
    }, 400);
  }, [spellLang]);


  // Spellcheck opnieuw plannen bij taalwissel of tekstwijziging
  useEffect(() => {
    if (spellLang !== "off") {
      // Leer alle vault-woorden zodat ze niet als fout worden gemarkeerd
      if (allNotesText) {
        const vaultWords = (allNotesText.match(/[a-zA-ZÀ-ÿ'-]{3,}/g) || []);
        SpellEngine.setVaultWords(vaultWords);
      }
      scheduleSpellCheck();
    } else {
      spellErrors.current.clear();
    }
  }, [spellLang, scheduleSpellCheck]);

  // Bouw completion engine — gethrottled: max 1x per 5 sec, niet bij elke keystroke
  const buildTimerRef = useRef(null);
  const lastBuiltText = useRef("");
  useEffect(() => {
    if (!allNotesText) return;
    // Skip als tekst nauwelijks veranderd is (minder dan 200 tekens verschil)
    if (Math.abs(allNotesText.length - lastBuiltText.current.length) < 200) return;
    clearTimeout(buildTimerRef.current);
    buildTimerRef.current = setTimeout(() => {
      CompletionEngine.build(allNotesText);
      lastBuiltText.current = allNotesText;
    }, 5000); // 5 sec debounce
    return () => clearTimeout(buildTimerRef.current);
  }, [allNotesText]);

  // ── Completion helpers ────────────────────────────────────────────────────
  // Haal het woord links van de cursor op
  const getWordBeforeCursor = (s) => {
    const line = s.lines[s.cur.row];
    const before = line.slice(0, s.cur.col);
    const m = before.match(/[a-zA-ZÀ-ÿ'-]{2,}$/);
    return m ? m[0] : "";
  };

  // Sluit de completion popup
  const closeCompletion = useCallback(() => {
    compRef.current = {list:[], idx:0, open:false};
    setCompList([]); setCompOpen(false);
  }, []);

  // Accepteer de geselecteerde suggestie
  const acceptCompletion = useCallback((s, idx) => {
    const list = compRef.current.list;
    if (!list.length) return;
    const chosen = list[idx ?? compRef.current.idx];
    if (!chosen) return;
    const prefix = getWordBeforeCursor(s);
    const suffix = chosen.word.slice(prefix.length);
    if (suffix) {
      for (const ch of suffix) insertChar(s, ch);
      emit(s); scrollToCursor(s); draw();
    }
    closeCompletion();
  }, [closeCompletion]);

  // Trigger lokale completion
  const triggerLocalCompletion = useCallback((s) => {
    const prefix = getWordBeforeCursor(s);
    if (prefix.length < 2) { closeCompletion(); return; }
    // Bouw ook uit huidige buffer
    CompletionEngine.addFromBuffer(s.lines.join("\n"));
    const suggestions = CompletionEngine.suggest(prefix, 8)
      .map(w => ({word: w, source: "local"}));
    if (!suggestions.length) { closeCompletion(); return; }
    compRef.current = {list: suggestions, idx: 0, open: true};
    setCompList(suggestions); setCompIdx(0); setCompOpen(true);
    // Update popup positie direct bij openen
    const cv = cvRef.current;
    if (cv) {
      const rect = cv.getBoundingClientRect();
      const nw   = numColsWidth(s);
      const x = rect.left + nw + s.cur.col * s.charW;
      const y = rect.top  + (s.cur.row - s.scroll + 1) * LINE_H + 4;
      setCompPos({x: Math.min(x, window.innerWidth - 260), y});
    }
  }, [closeCompletion]);

  // Trigger AI completion via Ollama
  const triggerAICompletion = useCallback(async (s) => {
    if (!llmModel) { setStatus("Geen AI model ingesteld (zie Notebook tab)"); return; }
    const prefix = getWordBeforeCursor(s);
    const line   = s.lines[s.cur.row];
    const ctx    = s.lines.slice(Math.max(0, s.cur.row-3), s.cur.row+1).join("\n");
    setAiLoading(true);
    setStatus("🤖 AI suggesties…");
    try {
      const resp = await fetch("/api/llm/chat", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          model: llmModel,
          messages: [{
            role: "user",
            content: `Je bent een tekst-completion assistent. Geef 5 korte woordsuggesties voor de volgende tekst. De cursor staat na het woord "${prefix}". Context:\n\n${ctx}\n\nGeef ALLEEN de 5 woorden/korte zinsdelen, elk op een eigen regel, zonder nummering, zonder uitleg. Suggesties moeten logisch aansluiten op de context en dezelfde taal gebruiken als de tekst.`
          }],
          stream: false,
          options: {temperature: 0.3, num_predict: 60}
        })
      });
      const data = await resp.json();
      const text = data.message?.content || data.response || "";
      const aiWords = text.split("\n")
        .map(w => w.trim().replace(/^[-•*]\s*/, "").replace(/^\d+\.\s*/, ""))
        .filter(w => w.length > 0 && w.length < 60)
        .slice(0,5)
        .map(w => ({word: w, source: "ai"}));
      if (aiWords.length) {
        compRef.current = {list: aiWords, idx: 0, open: true};
        setCompList(aiWords); setCompIdx(0); setCompOpen(true);
        const cv2 = cvRef.current;
        if (cv2) {
          const rect2 = cv2.getBoundingClientRect();
          const nw2   = numColsWidth(S.current);
          const x2 = rect2.left + nw2 + S.current.cur.col * S.current.charW;
          const y2 = rect2.top  + (S.current.cur.row - S.current.scroll + 1) * LINE_H + 4;
          setCompPos({x: Math.min(x2, window.innerWidth - 260), y: y2});
        }
        setStatus("");
      } else {
        setStatus("Geen AI suggesties");
      }
    } catch(e) {
      setStatus("AI fout: " + e.message.slice(0,40));
    }
    setAiLoading(false);
  }, [llmModel]);

  // ── AI taalverbetering ────────────────────────────────────────────────────
  const triggerImprove = React.useCallback(async () => {
    if (!llmModel) { setStatus("Geen AI model — stel in via Notebook tab"); return; }
    const s = S.current;
    const text = s.lines.join("\n").trim();
    if (!text) { setStatus("Geen tekst om te verbeteren"); return; }
    const lang = aiImproveLang === "auto"
      ? (/\b(de|het|een|en|van|in|is|dat|dit|met|ik|je|we)\b/i.test(text) ? "nl" : "en")
      : aiImproveLang;
    setAiImproving(true);
    setStatus("\u{1F916} AI taalverbetering\u2026");
    try {
      const resp = await fetch("/api/llm/improve-text", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ text, lang, model: llmModel }),
      });
      const data = await resp.json();
      if (data.improved) {
        setAiImprove({ original: text, improved: data.improved });
        setStatus("\u2713 AI suggestie klaar \u2014 bekijk onderaan");
      } else {
        setStatus("AI fout: " + (data.error || "onbekend"));
      }
    } catch(e) {
      setStatus("AI fout: " + e.message.slice(0, 50));
    }
    setAiImproving(false);
  }, [llmModel, aiImproveLang]);

  const acceptImprove = React.useCallback(() => {
    if (!aiImprove) return;
    const s = S.current;
    pushUndo(s);
    s.lines = aiImprove.improved.split("\n");
    clamp(); emit(s); draw();
    setAiImprove(null);
    setStatus("\u2713 Tekst vervangen door AI-verbetering");
  }, [aiImprove]);


  // ── Keyboard handler — ALLES hier, geen browser-escape meer ──────────────
  const handleKey = useCallback((e) => {
    const s = S.current;
    const m = s.mode;

    // ────────────────────────── INSERT ──────────────────────────────────────
    if (m === "INSERT") {
      // Completion popup navigatie — heeft prioriteit
      if (compRef.current.open) {
        if (e.key === "Escape") {
          e.preventDefault(); closeCompletion(); draw(); return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          const ni = Math.min(compRef.current.idx+1, compRef.current.list.length-1);
          compRef.current.idx = ni; setCompIdx(ni); draw(); return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          const ni = Math.max(compRef.current.idx-1, 0);
          compRef.current.idx = ni; setCompIdx(ni); draw(); return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault(); acceptCompletion(s); return;
        }
        // Andere toetsen: sluit popup en handel normaal af
        if (!e.ctrlKey && !e.metaKey && (e.key.length === 1 || e.key === "Backspace")) {
          closeCompletion();
          // doorval naar normale afhandeling hieronder
        }
      }

      // Escape — altijd onderscheppen, preventDefault, eigen afhandeling
      if (e.key === "Escape") {
        e.preventDefault();
        if (helpOpen) { setHelpOpen(false); draw(); return; }
        closeCompletion();
        // Sla ingevoegde tekst op voor dot repeat
        if (s._insertStart !== undefined) {
          const inserted = s.lines.slice(s._insertStart.row)
            .join("\n")
            .slice(s._insertStart.col);
          // Simpelere aanpak: sla de diff op via snapshot
          if (s._insertSnapshot) {
            const before = s._insertSnapshot.join("\n");
            const after  = s.lines.join("\n");
            if (before !== after) {
              s.lastAction = { type: "insert", text: s._insertText || "" };
            }
          }
          delete s._insertStart; delete s._insertSnapshot; delete s._insertText;
        }
        setMode("NORMAL");
        setStatus("");
        draw();
        return;
      }

      if (e.ctrlKey && e.key === "s") { e.preventDefault(); onSave(); setStatus("opgeslagen ✓"); draw(); return; }
      // Ctrl+H/J/K/L — split-venster navigatie (nnoremap <C-H> <C-W><C-H> etc. uit vimrc)
      if (e.ctrlKey && e.key === "h") { e.preventDefault(); onSplitCmd?.("focus-left");  setStatus("◀ notities"); draw(); return; }
      if (e.ctrlKey && e.key === "l") { e.preventDefault(); onSplitCmd?.("focus-right"); setStatus("▶ split");    draw(); return; }
      if (e.ctrlKey && e.key === "w") {
        e.preventDefault();
        // Ctrl+W Ctrl+W: toggle focus tussen splits
        // Ctrl+W h/l: focus links/rechts (via tweede toets)
        if (!S.current._ctrlWPending) {
          S.current._ctrlWPending = true;
          setStatus("Ctrl+W...");
          setTimeout(() => { if (S.current._ctrlWPending) { S.current._ctrlWPending = false; setStatus(""); draw(); } }, 1500);
        } else {
          S.current._ctrlWPending = false;
          onSplitCmd?.("focus-toggle");
          setStatus("⇄ split");
        }
        draw(); return;
      }
      if (e.ctrlKey && e.key === "j") { e.preventDefault();
        // Ctrl+J: als split open → focus rechts, anders snippet-expand
        if (onSplitCmd) { onSplitCmd("focus-right"); setStatus("▶ split"); }
        else if (!expandSnippet(s)) setStatus("geen snippet");
        draw(); return; }
      if (e.ctrlKey && e.key === "k") { e.preventDefault(); onSplitCmd?.("focus-left");  setStatus("◀ notities"); draw(); return; }

      // Ctrl+N / Ctrl+P — lokale completion (vim-stijl)
      if (e.ctrlKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        if (compRef.current.open) {
          const ni = (compRef.current.idx + 1) % compRef.current.list.length;
          compRef.current.idx = ni; setCompIdx(ni); draw();
        } else {
          triggerLocalCompletion(s);
        }
        return;
      }
      if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        if (compRef.current.open) {
          const ni = (compRef.current.idx - 1 + compRef.current.list.length) % compRef.current.list.length;
          compRef.current.idx = ni; setCompIdx(ni); draw();
        } else {
          triggerLocalCompletion(s);
        }
        return;
      }

      // Ctrl+Space — AI completion
      if (e.ctrlKey && e.key === " ") {
        e.preventDefault();
        triggerAICompletion(s);
        return;
      }

      // Pijltjes — sluit completion als open, dan navigeren
      if (e.key === "ArrowLeft")  { e.preventDefault(); closeCompletion(); s.cur.col = Math.max(0, s.cur.col-1); scrollToCursor(s); draw(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); closeCompletion(); s.cur.col = Math.min(s.lines[s.cur.row].length, s.cur.col+1); scrollToCursor(s); draw(); return; }
      if (e.key === "ArrowUp")    { e.preventDefault(); closeCompletion(); if(s.cur.row>0){s.cur.row--;s.cur.col=Math.min(s.cur.col,s.lines[s.cur.row].length);} scrollToCursor(s); draw(); return; }
      if (e.key === "ArrowDown")  { e.preventDefault(); closeCompletion(); if(s.cur.row<s.lines.length-1){s.cur.row++;s.cur.col=Math.min(s.cur.col,s.lines[s.cur.row].length);} scrollToCursor(s); draw(); return; }
      if (e.key === "Home")       { e.preventDefault(); closeCompletion(); s.cur.col=0; draw(); return; }
      if (e.key === "End")        { e.preventDefault(); closeCompletion(); s.cur.col=s.lines[s.cur.row].length; draw(); return; }

      if (e.key === "Tab") {
        e.preventDefault();
        if (!compRef.current.open) {
          if (!expandSnippet(s)) { insertChar(s,"    "); emit(s); }
        }
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
        closeCompletion();
        scheduleUndo(s); emit(s); scrollToCursor(s);
        if (spellLang !== "off") scheduleSpellCheck();
        draw(); return;
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
        // Update completion na delete
        if (compRef.current.open) triggerLocalCompletion(s);
        if (spellLang !== "off") scheduleSpellCheck();
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
        if (spellLang !== "off") scheduleSpellCheck();
        scheduleUndo(s); emit(s); draw(); return;
      }

      // Auto-pairs
      const closer = AUTO_PAIRS[e.key];
      if (closer && !e.ctrlKey) {
        e.preventDefault();
        insertChar(s, e.key + closer);
        s.cur.col--;
        closeCompletion();
        scheduleUndo(s); emit(s); draw(); return;
      }

      // Gewone tekens — trigger completion na woordtekens + markdown-triggers
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        insertChar(s, e.key);
        scheduleUndo(s); emit(s); scrollToCursor(s);
        // Spellcheck plannen na elk teken
        if (spellLang !== "off") scheduleSpellCheck();  // na elk teken
        // Completion: bij alfabetische tekens lokale suggesties
        if (/[a-zA-ZÀ-ÿ']/.test(e.key)) {
          const prefix = getWordBeforeCursor(s);
          if (prefix.length >= 3) {
            triggerLocalCompletion(s);
          } else if (prefix.length < 2) {
            closeCompletion();
          }
        } else {
          // Sluit word-completion bij scheidingstekens,
          // maar toon markdown-snippet hints bij triggers
          closeCompletion();
          const line   = s.lines[s.cur.row];
          const before = line.slice(0, s.cur.col);
          // Toon hint-popup voor markdown-snippets
          const mdTriggers = [
            { re: /\[\[$/, hint: "[[notitie]]  — link invoegen" },
            { re: /#{1,3} $/, hint: "## Sectie  — kop (h1/h2/h3 + Tab)" },
            { re: /\*\*$/, hint: "**tekst**  — bold (bold + Tab)" },
            { re: /\*[^*]?$/, hint: "*tekst*  — cursief (em + Tab)" },
            { re: /^> /, hint: "> citaat  (quote + Tab)" },
            { re: /^- \[ \]/, hint: "- [ ] taak  (todo + Tab)" },
            { re: /```$/, hint: "```taal … \`\`\`  (code + Tab)" },
          ];
          const hit = mdTriggers.find(t => t.re.test(before));
          if (hit) {
            const hint = [{word: hit.hint, source: "md"}];
            compRef.current = {list: hint, idx: 0, open: true};
            setCompList(hint); setCompIdx(0); setCompOpen(true);
          }
        }
        draw(); return;
      }
      return;
    }


      // ── Spelnavigatie: ]s volgende fout, [s vorige fout, z= suggesties ──────
      // ]s — spring naar volgende spelfout
      if (!e.ctrlKey && e.key==="]" && s.mode==="NORMAL") {
        // wacht op volgende toets 's'
        S.current._pendingSpellNav = "next";
        setStatus("]");
        draw(); return;
      }
      if (!e.ctrlKey && e.key==="[" && s.mode==="NORMAL") {
        S.current._pendingSpellNav = "prev";
        setStatus("[");
        draw(); return;
      }
      // Verwerk ]s / [s na pending
      if (S.current._pendingSpellNav && e.key === "s") {
        e.preventDefault();
        const dir = S.current._pendingSpellNav;
        S.current._pendingSpellNav = null;
        setStatus("");
        // Verzamel alle spellfouten gesorteerd op (row, col)
        const errs = [];
        spellErrors.current.forEach((rowErrs, row) =>
          rowErrs.forEach(err => errs.push({row, col: err.col, len: err.len, word: err.word}))
        );
        errs.sort((a,b) => a.row!==b.row ? a.row-b.row : a.col-b.col);
        if (!errs.length) { setStatus("Geen spelfouten"); draw(); return; }
        const {row: cr, col: cc} = s.cur;
        let target = null;
        if (dir === "next") {
          target = errs.find(e => e.row > cr || (e.row===cr && e.col > cc));
          if (!target) target = errs[0]; // wrap
        } else {
          const before = errs.filter(e => e.row < cr || (e.row===cr && e.col < cc));
          target = before.length ? before[before.length-1] : errs[errs.length-1];
        }
        s.cur.row = target.row;
        s.cur.col = target.col;
        scrollToCursor(s);
        setStatus(`Spelfout: '${target.word}'  z= voor suggesties`);
        draw(); return;
      }
      S.current._pendingSpellNav = null;

      // z= — spelsuggesties voor woord onder cursor
      if (!e.ctrlKey && e.key==="z" && s.mode==="NORMAL") {
        S.current._pendingZ = true;
        draw(); return;
      }
      if (S.current._pendingZ && e.key==="=") {
        e.preventDefault();
        S.current._pendingZ = false;
        // Haal woord onder cursor op
        const line = s.lines[s.cur.row];
        const wordRe2 = /[a-zA-ZÀ-ÿ'-]{2,}/g;
        let hit2 = null;
        let m3;
        wordRe2.lastIndex = 0;
        while ((m3 = wordRe2.exec(line)) !== null) {
          if (m3.index <= s.cur.col && s.cur.col <= m3.index + m3[0].length) {
            hit2 = {word: m3[0], col: m3.index, len: m3[0].length};
            break;
          }
        }
        if (!hit2) { setStatus("Geen woord onder cursor"); draw(); return; }
        // Vraag suggesties op via server
        setStatus(`z= suggesties voor '${hit2.word}'…`);
        fetch("/api/spellcheck", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({words:[hit2.word], lines:s.lines, lang: spellLang==="off"?"en":spellLang}),
        }).then(r=>r.json()).then(data => {
          const sug = data.suggestions?.[hit2.word] || data.spell?.[hit2.word]?.suggestions || [];
          if (!sug.length) { setStatus(`Geen suggesties voor '${hit2.word}'  (:spell+ om te leren)`); draw(); return; }
          // Toon suggesties als completion popup
          const items = sug.slice(0,8).map(w=>({word:w, source:"spell"}));
          compRef.current = {list:items, idx:0, open:true, replaceWord: hit2};
          setCompList(items); setCompIdx(0); setCompOpen(true);
          const cv3 = cvRef.current;
          if (cv3) {
            const rect3 = cv3.getBoundingClientRect();
            const nw3   = numColsWidth(s);
            const x3 = rect3.left + nw3 + hit2.col * s.charW;
            const y3 = rect3.top  + (s.cur.row - s.scroll + 1) * LINE_H + 4;
            setCompPos({x: Math.min(x3, window.innerWidth - 260), y: y3});
          }
          setStatus(`z= '${hit2.word}' — Tab/Enter=accepteer  Esc=sluiten`);
          draw();
        }).catch(()=>setStatus("Server niet bereikbaar"));
        draw(); return;
      }
      S.current._pendingZ = false;
    // ────────────────────────── COMMAND ─────────────────────────────────────
    if (m === "COMMAND") {
      e.preventDefault();
      if (e.key === "Escape")    { setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); setStatus(""); draw(); return; }
      if (e.key === "Enter")     { runCmd(s, s.cmdBuf); setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); draw(); return; }
      if (e.key === "Backspace") { s.cmdBuf=s.cmdBuf.slice(0,-1); setCmdBuf(s.cmdBuf); draw(); return; }
      if (e.key === "Tab") {
        // :tag completion
        const tm = s.cmdBuf.match(/^(tag[+-]?\s+)(\S*)$/);
        if (tm) {
          const p=tm[2].replace(/^#/,"");
          const hit=allTags.find(t=>t.startsWith(p)&&t!==p);
          if(hit){s.cmdBuf=tm[1]+hit; setCmdBuf(s.cmdBuf);}
          draw(); return;
        }
        // :e notitietitel completion via allNotesText heuristic
        const em = s.cmdBuf.match(/^(e\s+)(.*)$/);
        if (em && allNotesText) {
          const q = em[2].toLowerCase().trim();
          // Zoek notitietitels in allNotesText (formaat: "--- title: XYZ ---")
          const titleMatches = [];
          const re = /title:\s*(.+)/g;
          let mt;
          while ((mt = re.exec(allNotesText)) !== null && titleMatches.length < 8) {
            const t = mt[1].trim();
            if (q === "" || t.toLowerCase().includes(q)) titleMatches.push(t);
          }
          if (titleMatches.length === 1) {
            // Unieke match: vul direct aan
            s.cmdBuf = em[1] + titleMatches[0];
            setCmdBuf(s.cmdBuf);
            setStatus("e: " + titleMatches[0]);
          } else if (titleMatches.length > 1) {
            // Meerdere matches: toon als status
            setStatus(titleMatches.slice(0,5).join("  |  ") + (titleMatches.length>5 ? " +" : ""));
          }
          draw(); return;
        }
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

    // Completion popup open? Dan pijltjes + Tab/Enter onderscheppen
    if (compRef.current.open) {
      if (e.key === "Escape") {
        e.preventDefault(); closeCompletion(); draw(); return;
      }
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault(); e.stopPropagation();
        const ni = Math.min(compRef.current.idx + 1, compRef.current.list.length - 1);
        compRef.current.idx = ni; setCompIdx(ni); draw(); return;
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault(); e.stopPropagation();
        const ni = Math.max(compRef.current.idx - 1, 0);
        compRef.current.idx = ni; setCompIdx(ni); draw(); return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault(); acceptCompletion(s); draw(); return;
      }
    }

    e.preventDefault();
    const {row,col} = s.cur;
    const line = s.lines[row];

    // ── Marks afhandeling ────────────────────────────────────────────────
    if (s._markPending) {
      s._markPending = false;
      if (/^[a-z]$/.test(e.key)) {
        s.marks[e.key] = { row: s.cur.row, col: s.cur.col };
        setStatus(`Mark '${e.key}' gezet`);
      } else { setStatus(''); }
      clamp(); draw(); return;
    }
    if (s._jumpMarkPending) {
      s._jumpMarkPending = false;
      if (/^[a-z]$/.test(e.key)) {
        const mark = s.marks[e.key];
        if (mark) {
          s.cur.row = Math.min(mark.row, s.lines.length - 1);
          s.cur.col = Math.min(mark.col, s.lines[s.cur.row].length);
          scrollToCursor(s);
          setStatus(`'${e.key}`);
        } else { setStatus(`Mark '${e.key}' niet gevonden`); }
      } else { setStatus(''); }
      clamp(); draw(); return;
    }
    // ── Macro start/stop ──────────────────────────────────────────────────
    if (s._qPending) {
      s._qPending = false;
      if (/^[a-z]$/.test(e.key)) {
        s.macroRec = e.key; s.macroKeys = [];
        setStatus(`⏺ Opname macro '${e.key}'… (q om te stoppen)`);
      } else { setStatus(''); }
      clamp(); draw(); return;
    }
    if (s._atPending) {
      s._atPending = false;
      if (/^[a-z]$/.test(e.key)) {
        const keys = s.macros[e.key];
        if (keys && keys.length) {
          setStatus(`▶ Macro '${e.key}' (${keys.length} toetsen)`);
          // Speel macro af door fake key events te simuleren
          keys.forEach(k => {
            const fake = new KeyboardEvent('keydown', { key: k, bubbles: false });
            handleKey(fake);
          });
        } else { setStatus(`Macro '${e.key}' leeg of niet gevonden`); }
      } else { setStatus(''); }
      clamp(); draw(); return;
    }

    // ── r: vervang karakter ──────────────────────────────────────────────
    if (s._replacePending && !e.ctrlKey && e.key.length === 1) {
      s._replacePending = false;
      if (col < line.length) {
        pushUndo(s);
        s.lines[row] = line.slice(0, col) + e.key + line.slice(col + 1);
        s.lastAction  = { type: 'replace-char', ch: e.key };
        emit(s);
        setStatus(`r → '${e.key}'`);
      }
      clamp(); scrollToCursor(s); draw(); return;
    }
    if (s._replacePending && e.key === 'Escape') {
      s._replacePending = false; setStatus(''); draw(); return;
    }

    // ── Pending operator + text object ────────────────────────────────────
    // Patroon: d/c/y gevolgd door i/a + object-char
    // Bijv: diw, ci", da(, ya{
    if (s.pendingOp && (e.key === 'i' || e.key === 'a')) {
      const inner = e.key === 'i';
      const op    = s.pendingOp;
      s.pendingOp = null;
      // Wacht op één meer toets (het object-teken)
      s._awaitObj = { op, inner };
      setStatus(`${op}${e.key}...`);
      clamp(); scrollToCursor(s); draw();
      return;
    }
    if (s._awaitObj) {
      const { op, inner } = s._awaitObj;
      s._awaitObj = null;
      // e.key is nu het object-teken: " ' ` ( [ { < ) ] } >
      const objMap = { 'b':'(', 'B':'{', 'r':'[' }; // aliassen
      const ch = objMap[e.key] || e.key;
      applyTextObject(s, op, ch, inner);
      clamp(); scrollToCursor(s); draw();
      return;
    }
    // Als pending op en GEEN i/a: bijv dd, cc, yy (zelfde key)
    if (s.pendingOp) {
      const op = s.pendingOp;
      s.pendingOp = null;
      if (e.key === op) {
        // dd / cc / yy
        if (op === 'd') { s.yank=line; s.lastAction={type:'delete-line'}; pushUndo(s); s.lines.splice(row,1); if(!s.lines.length)s.lines=['']; clamp(); emit(s); setStatus('dd'); }
        if (op === 'y') { s.yank=line; s.yankedLines=true; setStatus('yy: regel gekopieerd'); }
        if (op === 'c') { s.yank=line; pushUndo(s); s.lines[row]=''; s.cur.col=0; emit(s); setMode('INSERT'); setStatus('cc'); }
        clamp(); scrollToCursor(s); draw(); return;
      }
      setStatus(''); // annuleer pending op
    }

    // ── Macro opname buffer ────────────────────────────────────────────────
    if (s.macroRec !== null && e.key !== "q") {
      s.macroKeys.push(e.key);
    }

    switch (e.key) {
      // Mode wissels
      case "i": exitVisual(s); setMode("INSERT");
        s._insertSnapshot=s.lines.slice(); s._insertText=""; break;
      case "I": exitVisual(s); setMode("INSERT"); s.cur.col=0;
        s._insertSnapshot=s.lines.slice(); s._insertText=""; break;
      case "a": exitVisual(s); setMode("INSERT"); s.cur.col=Math.min(col+1,line.length);
        s._insertSnapshot=s.lines.slice(); s._insertText=""; break;
      case "A": exitVisual(s); setMode("INSERT"); s.cur.col=line.length;
        s._insertSnapshot=s.lines.slice(); s._insertText=""; break;

      // Visual mode
      case "v":
        if (s.visual && !s.visualLine) { exitVisual(s); break; } // toggle uit
        s.visual=true; s.visualLine=false;
        s.visualStart={row:s.cur.row, col:s.cur.col};
        setVisualSel({...s.visualStart});
        setMode("VISUAL"); break;
      case "V":
        if (s.visual && s.visualLine) { exitVisual(s); setMode("NORMAL"); break; }
        s.visual=true; s.visualLine=true;
        s.visualStart={row:s.cur.row, col:0};
        s.cur.col=0;
        setVisualSel({...s.visualStart});
        setMode("VISUAL"); break;
      case "o":
        s.lines.splice(row+1,0,"");
        s.cur.row++; s.cur.col=0;
        s._insertSnapshot=s.lines.slice(); s._insertText="\n";
        setMode("INSERT"); break;
      case "O":
        s.lines.splice(row,0,"");
        s.cur.col=0;
        s._insertSnapshot=s.lines.slice(); s._insertText="\n";
        setMode("INSERT"); break;
      case ":": setMode("COMMAND"); s.cmdBuf=""; setCmdBuf(""); break;
      case "/": setMode("SEARCH");  s.cmdBuf=""; setCmdBuf(""); break;
      case "?": setHelpOpen(true); break;

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
        if (col<line.length){ s.yank=line[col]; s.lastAction={type:"delete-char"}; pushUndo(s); s.lines[row]=line.slice(0,col)+line.slice(col+1); emit(s); }
        break;
      case "D":
        pushUndo(s); s.lines[row]=line.slice(0,col); emit(s);
        break;
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
        if (e.ctrlKey && s.undoIdx<s.undo.length-1){
          s.undoIdx++; s.lines=s.undo[s.undoIdx].slice(); clamp(); emit(s); setStatus("redo");
        } else if (!e.ctrlKey) {
          // r zonder Ctrl = wacht op vervang-teken
          s._replacePending = true; setStatus("r...");
        }
        break;
      case "J": // join regels
        if (row<s.lines.length-1){ pushUndo(s); s.lines[row]+=" "+s.lines[row+1].trim(); s.lines.splice(row+1,1); emit(s); }
        break;
      case ".": repeatLastAction(s); break; // dot repeat
      case " ": setStatus(""); buildMatches(s,""); break; // nohlsearch
      case "Escape":
        if (s.visual) { exitVisual(s); setMode("NORMAL"); }
        else if (s.pendingOp || s._awaitObj || s._zPending) {
          s.pendingOp = null; s._awaitObj = null; s._zPending = false;
          setStatus("");
        }
        else setStatus("");
        break;

      // Visual mode acties (d, y, c werken op selectie als visual actief)
      case "d":
        if (s.visual) { deleteVisualRange(s); setMode("NORMAL"); setStatus("verwijderd"); break; }
        // Eerste d → pending; dd wordt afgehandeld in pending-blok hierboven
        if (!s.pendingOp) { s.pendingOp='d'; setStatus('d...'); }
        break;
      case "y":
        if (s.visual) {
          s.yank=getVisualText(s); s.yankedLines=s.visualLine;
          setStatus(`gekopieerd (${s.yank.split("\n").length} regels)`);
          exitVisual(s); setMode("NORMAL"); break;
        }
        // y → pending voor text objects
        if (!s.pendingOp) { s.pendingOp='y'; setStatus('y...'); }
        break;
      case "c":
        if (s.visual) { deleteVisualRange(s); setMode("INSERT"); break; }
        // Sla op als pending operator voor text object
        s.pendingOp = s.pendingOp === 'c' ? null : 'c';
        if (s.pendingOp) { setStatus('c...'); } break;

      // Pending operator: d, y (tweede d/y = regel, anders wacht op object)
      // d is al verwerkt als case "d" hierboven voor visual+dd
      // Hier voegen we second-key handling toe vóór de switch via pendingOp

      // % — spring naar matchende bracket
      case "%": jumpToMatch(s); break;

      // ── Marks: m{a-z} zet mark, '{a-z} spring naar mark ──────────────
      case "m":
        s._markPending = true; setStatus("m..."); break;
      case "'":
      case "`":
        s._jumpMarkPending = true; setStatus(`${e.key}...`); break;

      // ── Macro opname: q{a-z} start/stop, @{a-z} afspelen ─────────────
      case "q":
        if (s.macroRec !== null) {
          // Stop opname — verwijder de 'q' die we net bufferd hebben
          s.macroKeys.pop();
          s.macros[s.macroRec] = [...s.macroKeys];
          setStatus(`Macro '${s.macroRec}' opgenomen (${s.macroKeys.length} toetsen)`);
          s.macroRec = null; s.macroKeys = [];
        } else {
          s._qPending = true; setStatus("q...");
        }
        break;
      case "@":
        s._atPending = true; setStatus("@..."); break;

      // ── Relative line numbers: :set rnu toggle ────────────────────────
      // (ook via :rnu command, zie runCmd)

      // z — fold commando's
      case "z":
        s._zPending = true;
        setStatus('z...');
        break;

      // Ctrl+H/J/K/L worden al afgevangen vóór de switch — zie boven
    }

    // ── Pending z-commando's ────────────────────────────────────────────────
    if (s._zPending && e.key !== 'z') {
      s._zPending = false;
      if (e.key === 'o') { toggleFold(s, true);  clamp(); scrollToCursor(s); draw(); return; }
      if (e.key === 'c') { toggleFold(s, false); clamp(); scrollToCursor(s); draw(); return; }
      if (e.key === 'a') { toggleFold(s);        clamp(); scrollToCursor(s); draw(); return; }
      if (e.key === 'R') { openAllFolds(s);      draw(); return; }
      if (e.key === 'M') { closeAllFolds(s);     draw(); return; }
      setStatus('');
    }

    clamp();
    scrollToCursor(s);
    // Update visual selectie state voor hertekening
    if (s.visual) setVisualSel({row:s.cur.row, col:s.cur.col});
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
    // Bereken visuele y-positie van cursor rekening houdend met folds
    const hiddenAboveCursor = [];
    Object.entries(s.folds).forEach(([startStr, endRow]) => {
      const start = parseInt(startStr);
      for (let r = start + 1; r <= endRow && r < curRow; r++) hiddenAboveCursor.push(r);
    });
    const visibleCurRow = curRow - new Set(hiddenAboveCursor).size;

    const cxPos = nw + curCol * cw;
    const cyPos = (visibleCurRow - s.scroll) * LINE_H;

    // Cursorline (horizontaal) — geel tint voor gevouwen header
    if (visibleCurRow >= s.scroll && visibleCurRow < s.scroll + s.visRows + 1) {
      const isCurFolded = s.folds[curRow] !== undefined;
      ctx.fillStyle = isCurFolded ? "rgba(234,231,136,0.06)" : "rgba(255,255,255,0.055)";
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

    // ── Visual selectie achtergrond ─────────────────────────────────────────
    if (s.visual) {
      const vr = getVisualRange(s);
      if (vr) {
        ctx.fillStyle = "rgba(85,77,75,0.6)";
        for (let vi = vr.startRow; vi <= vr.endRow; vi++) {
          const vy = (vi - s.scroll) * LINE_H;
          if (vi < s.scroll || vi > s.scroll + s.visRows) continue;
          const vline = s.lines[vi] || "";
          if (vr.line) {
            ctx.fillRect(nw, vy, CW - nw, LINE_H);
          } else if (vi === vr.startRow && vi === vr.endRow) {
            ctx.fillRect(nw + vr.startCol * cw, vy, (vr.endCol - vr.startCol + 1) * cw, LINE_H);
          } else if (vi === vr.startRow) {
            ctx.fillRect(nw + vr.startCol * cw, vy, (vline.length - vr.startCol + 1) * cw, LINE_H);
          } else if (vi === vr.endRow) {
            ctx.fillRect(nw, vy, (vr.endCol + 1) * cw, LINE_H);
          } else {
            ctx.fillRect(nw, vy, Math.max(1, vline.length) * cw, LINE_H);
          }
        }
      }
    }

    // ── Regels tekenen ────────────────────────────────────────────────────
    // Bouw fold-skip set: welke regels zijn verborgen?
    const hiddenRows = new Set();
    Object.entries(s.folds).forEach(([startStr, endRow]) => {
      const start = parseInt(startStr);
      for (let r = start + 1; r <= endRow; r++) hiddenRows.add(r);
    });

    let visLine = 0;
    for (let li = s.scroll; li < s.lines.length && visLine <= s.visRows; li++) {
      if (hiddenRows.has(li)) continue; // sla gevouwen regels over
      const i    = visLine++;
      const y    = i * LINE_H;
      const line = s.lines[li];
      const isCur = li === curRow;
      const isFolded = s.folds[li] !== undefined; // header van gevouwen sectie

      // Regelnummer — rechts uitgelijnd, relatief of absoluut
      ctx.textAlign = "right";
      ctx.fillStyle = isCur ? W.statusFg : W.fgMuted;
      ctx.font      = isCur
        ? `bold ${FONT_SIZE}px 'Hack','Courier New',monospace`
        : `${FONT_SIZE}px 'Hack','Courier New',monospace`;
      const lineNrStr = s.relativeNumbers && !isCur
        ? String(Math.abs(li - curRow))   // relatief
        : String(li + 1);                 // absoluut
      ctx.fillText(lineNrStr, nw - PAD_LEFT, y + 4);
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

      // Fold header: teken een compacte balk na de header-tekst
      if (isFolded) {
        const endRow   = s.folds[li];
        const hidden   = endRow - li;
        const foldLabel = ` ▸ ${hidden} regel${hidden !== 1 ? 's' : ''}`;

        // Meet breedte van de header-tekst voor positionering
        ctx.font = `bold ${FONT_SIZE}px 'Hack','Courier New',monospace`;
        const headerW = ctx.measureText(line).width;
        ctx.font = `${FONT_SIZE}px 'Hack','Courier New',monospace`;

        const pillX = nw + headerW + 10;
        const pillY = y + 3;
        const pillH = LINE_H - 6;

        // Meet pill-breedte
        ctx.font = `${Math.max(9, FONT_SIZE - 1)}px 'Hack','Courier New',monospace`;
        const pillW = ctx.measureText(foldLabel).width + 10;

        // Achtergrond pill
        ctx.fillStyle = "rgba(234,231,136,0.12)";
        ctx.beginPath();
        ctx.roundRect
          ? ctx.roundRect(pillX, pillY, pillW, pillH, 3)
          : ctx.rect(pillX, pillY, pillW, pillH);
        ctx.fill();

        // Rand
        ctx.strokeStyle = "rgba(234,231,136,0.35)";
        ctx.lineWidth   = 1;
        ctx.beginPath();
        ctx.roundRect
          ? ctx.roundRect(pillX, pillY, pillW, pillH, 3)
          : ctx.rect(pillX, pillY, pillW, pillH);
        ctx.stroke();

        // Label
        ctx.fillStyle = W.yellow;
        ctx.textAlign = "left";
        ctx.fillText(foldLabel, pillX + 5, pillY + 3);
        ctx.font = `${FONT_SIZE}px 'Hack','Courier New',monospace`;

        // Gestippelde lijn tot einde scherm
        const lineEnd = pillX + pillW + 6;
        if (lineEnd < CW - 10) {
          ctx.strokeStyle = "rgba(234,231,136,0.15)";
          ctx.lineWidth   = 1;
          ctx.setLineDash([3, 5]);
          ctx.beginPath();
          ctx.moveTo(lineEnd, y + LINE_H / 2);
          ctx.lineTo(CW - 4, y + LINE_H / 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      if (spellLang !== "off") {
        // Helper: teken squiggly lijn
        const squiggly = (ex, ey, ew, color) => {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth   = 1.5;
          const amp = 1.8, freq = 4;
          ctx.moveTo(ex, ey);
          for (let px = 0; px <= ew; px += freq / 2) {
            ctx.lineTo(ex + px, ey + Math.sin(px / (freq / (2 * Math.PI))) * amp);
          }
          ctx.stroke();
        };

        ctx.save();
        // ── Spellfouten: rode golvende lijn ───────────────────────────────
        if (spellErrors.current.has(li)) {
          for (const err of spellErrors.current.get(li)) {
            squiggly(
              nw + err.col * cw,
              y + LINE_H - 3,
              err.len * cw,
              "rgba(239,68,68,0.90)"   // rood
            );
          }
        }
        // ── Grammaticafouten: oranje dubbele lijn ─────────────────────────
        if (grammarErrors.current.has(li)) {
          for (const err of grammarErrors.current.get(li)) {
            const color = err.type === "style"
              ? "rgba(156,163,175,0.75)"   // grijs voor stijltips
              : "rgba(245,158,11,0.90)";   // oranje voor grammaticafouten
            squiggly(nw + err.col * cw, y + LINE_H - 3, err.len * cw, color);
            squiggly(nw + err.col * cw, y + LINE_H - 1, err.len * cw, color);
          }
        }
        ctx.restore();
      }
    }

    // ── Cursor ────────────────────────────────────────────────────────────
    if (visibleCurRow >= s.scroll && visibleCurRow < s.scroll + s.visRows + 1) {
      const cx = nw + curCol * cw;
      const cy = cyPos;
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
                     : m === "VISUAL"  ? W.visualBg
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
    let stxtColor = W.fgMuted;

    if (s.mode === "COMMAND") stxt = ":" + s.cmdBuf + "█";
    else if (s.mode === "SEARCH") stxt = "/" + s.cmdBuf + "█";
    else if (statusMsg) stxt = "  " + statusMsg;
    else {
      // Kijk of cursor op een spell/grammaticafout staat → toon foutmelding
      const curSpell   = spellErrors.current.get(curRow)   || [];
      const curGrammar = grammarErrors.current.get(curRow) || [];
      const spellHit   = curSpell.find(e => curCol >= e.col && curCol < e.col + e.len);
      const gramHit    = curGrammar.find(e => curCol >= e.col && curCol < e.col + e.len);

      if (gramHit) {
        stxt      = `  ⚠ ${gramHit.msg}`;
        stxtColor = gramHit.type === "style" ? W.fgMuted : W.orange;
      } else if (spellHit) {
        stxt      = `  ✗ Onbekend woord: '${spellHit.word}'  (:spell+ om te leren)`;
        stxtColor = "rgba(239,68,68,0.9)";
      } else if (s.mode === "INSERT") {
        stxt = "  -- INSERT --  Ctrl+N=completion  Ctrl+Space=AI  :spell en/nl/auto/off";
      } else {
        stxt = `  ${s.lines.length}L  |  i=INSERT  :w=opslaan  :wq=sluiten  /=zoeken`;
      }
    }

    ctx.fillStyle = stxtColor;
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

  // Bereken cursor-pixelpositie voor de completion popup
  const getCursorPx = () => {
    const s   = S.current;
    const cv  = cvRef.current;
    if (!cv) return {x:0,y:0};
    const rect = cv.getBoundingClientRect();
    const nw   = numColsWidth(s);
    const x    = rect.left + nw + s.cur.col * s.charW;
    const y    = rect.top  + (s.cur.row - s.scroll + 1) * LINE_H;
    return {x, y};
  };

  // ── Help overlay ──────────────────────────────────────────────────────────
  const helpOverlay = helpOpen && React.createElement("div", {
    onClick: () => setHelpOpen(false),
    style: {
      position:"fixed", inset:0, zIndex:9999,
      background:"rgba(0,0,0,0.75)", display:"flex",
      alignItems:"center", justifyContent:"center",
      backdropFilter:"blur(4px)",
    }
  },
    React.createElement("div", {
      onClick: e => e.stopPropagation(),
      style: {
        background:W.bg2, border:`1px solid ${W.splitBg}`, borderRadius:"10px",
        padding:"20px 28px", maxWidth:"560px", maxHeight:"80vh",
        overflowY:"auto", color:W.fg, fontSize:"13px",
        boxShadow:"0 20px 60px rgba(0,0,0,0.8)",
        WebkitOverflowScrolling:"touch",
      }
    },
      React.createElement("div", {style:{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}},
        React.createElement("span", {style:{fontSize:"15px",fontWeight:"700",color:W.yellow,letterSpacing:"1px"}}, "\u2328 SNELTOETSEN"),
        React.createElement("button", {onClick:()=>setHelpOpen(false),
          style:{background:"none",border:"none",color:W.fgMuted,fontSize:"18px",cursor:"pointer"}}, "\u00d7")
      ),
      ...[
        ["NAVIGATIE", W.blue, [
          ["h j k l",      "Beweeg cursor"],
          ["w / b",         "Woord voor/achteruit"],
          ["0 / $",         "Begin/einde regel"],
          ["gg / G",        "Begin/einde bestand"],
          ["%",             "Spring naar matchende bracket"],
          ["\u2018a",      "Spring naar mark a"],
        ]],
        ["BEWERKEN", W.comment, [
          ["i / a / o",     "INSERT mode (voor/na/nieuwe regel)"],
          ["r{teken}",      "Vervang karakter onder cursor"],
          ["x / dd / yy",   "Verwijder karakter / regel / kopieer regel"],
          ["p / P",         "Plak na/voor cursor"],
          ["u / Ctrl+R",    "Undo/redo"],
          [".",             "Herhaal laatste actie"],
          ["J",             "Voeg regels samen"],
        ]],
        ["TEXT OBJECTS", W.purple, [
          ["ci\" / ca(",   "Wijzig/verwijder binnen/inclusief \"...\"/\"(...)\""],
          ["di{ / da[",     "Verwijder binnen/inclusief {...}/[...]"],
          ["yi\` / ya\'", "Kopieer binnen/inclusief \`...\`/\'...\'"],
        ]],
        ["VISUAL", W.orange, [
          ["v / V",         "Char-wise / Linewise visual selectie"],
          ["d / y / c",     "Verwijder / kopieer / vervang selectie"],
        ]],
        ["FOLDS", W.yellow, [
          ["za / zo / zc",  "Toggle / open / sluit fold op header"],
          ["zR / zM",       "Alle folds open / dicht"],
        ]],
        ["MARKS & MACROS", W.fgMuted, [
          ["m{a-z}",        "Zet mark op huidige positie"],
          ["\u2018{a-z}",  "Spring naar mark"],
          ["q{a-z}",        "Start/stop macro-opname"],
          ["@{a-z}",        "Speel macro af"],
        ]],
        ["COMMANDO\u2019S (:)", W.fgDim, [
          [":w / :wq",      "Opslaan / opslaan+sluiten"],
          [":spell / :rnu", "Toggle spellcheck / relatieve regelnummers"],
          [":tag+ #naam",   "Voeg tag toe"],
          [":template naam","Laad template (dagnotitie/meeting/...)"],
          [":goyo",         "Toggle focusmodus"],
          [":vs / :sp",     "Verticaal / horizontaal splitsen"],
          [":? of :help",   "Dit scherm"],
        ]],
      ].map(([titel, kleur, items]) =>
        React.createElement("div", {key:titel, style:{marginBottom:"14px"}},
          React.createElement("div", {style:{
            fontSize:"10px", fontWeight:"700", color:kleur,
            letterSpacing:"1.5px", marginBottom:"6px"
          }}, titel),
          React.createElement("div", {style:{display:"grid", gridTemplateColumns:"1fr 1.5fr", gap:"3px 12px"}},
            ...items.flatMap(([key, desc]) => [
              React.createElement("div", {key:key, style:{
                color:W.yellow, fontFamily:"'Hack',monospace",
                fontSize:"12px", padding:"2px 0", opacity:0.9
              }}, key),
              React.createElement("div", {key:key+"d", style:{
                color:W.fgMuted, fontSize:"12px", padding:"2px 0"
              }}, desc),
            ])
          )
        )
      ),
      React.createElement("div", {style:{
        marginTop:"12px", paddingTop:"10px",
        borderTop:`1px solid ${W.splitBg}`,
        fontSize:"11px", color:W.fgDim, textAlign:"center"
      }}, "Klik buiten of druk Escape om te sluiten")
    )
  );

  return React.createElement("div", {
    style: {display:"flex", flexDirection:"column", flex:1, minHeight:0, background:W.bg}
  },
    helpOverlay,
    // Tags strip (verborgen als SmartTagEditor al zichtbaar is boven de editor)
    !hideTagStrip && noteTags.length > 0 && React.createElement("div", {
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
    // Canvas-gebied + completion popup overlay
    React.createElement("div", {
      style: {flex:1, position:"relative", overflow:"hidden", minHeight:0},
      tabIndex: -1,
      onClick: () => inputRef.current?.focus(),
      onKeyDown: (e) => {
        // Onderschep pijltjestoetsen op wrapper-niveau als popup open is
        // zodat de browser ze niet voor scrollen gebruikt
        if (compRef.current.open &&
            (e.key === "ArrowDown" || e.key === "ArrowUp" ||
             e.key === "Tab" || e.key === "Enter")) {
          e.preventDefault();
          e.stopPropagation();
          inputRef.current?.dispatchEvent(new KeyboardEvent("keydown", {
            key: e.key, bubbles: false,
            ctrlKey: e.ctrlKey, shiftKey: e.shiftKey,
          }));
        }
      },
      onWheel: (e) => {
        e.preventDefault();
        const s = S.current;
        const lines = e.deltaY > 0 ? 3 : -3;
        s.scroll = Math.max(0, Math.min(s.lines.length - 1, s.scroll + lines));
        draw();
      },
    },
      React.createElement("canvas", {ref:cvRef, style:{display:"block"}}),

      // ── Completion popup ──────────────────────────────────────────────────
      compOpen && compList.length > 0 && React.createElement("div", {
        "data-comp-list": "1",
        style: {
          position: "fixed",
          left: compPos.x + "px",
          top:  compPos.y + "px",
          zIndex: 9999,
          background: W.bg2,
          border: `1px solid ${W.blue}`,
          borderRadius: "5px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          minWidth: "200px",
          maxWidth: "340px",
          overflowY: "auto",
          maxHeight: "240px",
          pointerEvents: "none",  // toetsafvang blijft bij het canvas
        }
      },
        // Popup header
        React.createElement("div", {
          style: {
            padding: "3px 10px",
            background: W.lineNrBg,
            borderBottom: `1px solid ${W.splitBg}`,
            fontSize: "10px", color: W.fgMuted,
            display: "flex", justifyContent: "space-between",
          }
        },
          React.createElement("span", null, aiLoading ? "🤖 AI…" : "💡 Completion"),
          React.createElement("span", null, "↑↓ Tab=accepteer  Esc=sluiten")
        ),
        // Suggesties
        ...compList.map((item, idx) =>
          React.createElement("div", {
            key: idx,
            "data-comp-item": idx,
            style: {
              padding: "5px 12px",
              background: idx === compIdx ? W.blue+"22" : "transparent",
              borderLeft: idx === compIdx ? `3px solid ${W.blue}` : "3px solid transparent",
              fontSize: "13px",
              color: idx === compIdx ? W.fg : W.fgDim,
              fontFamily: "'Hack','Courier New',monospace",
              display: "flex", alignItems: "center", gap: "8px",
              borderBottom: idx < compList.length-1 ? `1px solid ${W.splitBg}` : "none",
            }
          },
            // Bron-badge
            React.createElement("span", {
              style: {
                fontSize: "9px", padding: "1px 5px", borderRadius: "8px",
                background: item.source === "ai" ? W.purple+"33" : item.source === "md" ? W.orange+"33" : W.comment+"33",
                color:      item.source === "ai" ? W.purple      : item.source === "md" ? W.orange      : W.comment,
                flexShrink: 0,
              }
            }, item.source === "ai" ? "AI" : item.source === "md" ? "md" : "↩"),
            // Woord
            React.createElement("span", {style:{flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}},
              item.word
            )
          )
        )
      ),

      // ── Spell-indicator (rechts boven in editor) ─────────────────────────
      spellLang !== "off" && React.createElement("div", {
        style: {
          position: "absolute", top: "6px", right: "8px",
          fontSize: "10px", color: W.fgMuted,
          background: W.bg2 + "cc", borderRadius: "4px",
          padding: "2px 6px", letterSpacing: "0.5px",
          border: `1px solid ${W.splitBg}`,
          pointerEvents: "none",
        }
      }, `spell:${spellLang}  :spell+ = woord leren`),

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
    ),

    // ── AI taalverbeterbalk — vaste smalle balk onderaan ─────────────────────
    React.createElement("div", {
      style: {
        flexShrink: 0,
        borderTop: `1px solid ${W.splitBg}`,
        background: W.bg2,
        display: "flex", alignItems: "center", gap: "6px",
        padding: "4px 10px",
        position: "relative",   // anker voor het overlay-venster
      }
    },
      React.createElement("span", {style:{fontSize:"11px", color: W.fgMuted, whiteSpace:"nowrap"}}, "🤖 AI:"),

      // Taal selector
      ["auto","nl","en"].map(l =>
        React.createElement("button", {
          key: l,
          onClick: () => setAiImproveLang(l),
          style: {
            background: aiImproveLang === l ? "rgba(138,198,242,0.2)" : "none",
            border: `1px solid ${aiImproveLang === l ? W.blue : W.splitBg}`,
            borderRadius: "4px", padding: "1px 7px",
            color: aiImproveLang === l ? W.blue : W.fgMuted,
            fontSize: "11px", cursor: "pointer",
          }
        }, l)
      ),

      // Verbeter-knop
      React.createElement("button", {
        onClick: triggerImprove,
        disabled: aiImproving,
        style: {
          background: aiImproving ? "none" : "rgba(138,198,242,0.12)",
          border: `1px solid ${aiImproving ? W.splitBg : "rgba(138,198,242,0.4)"}`,
          borderRadius: "4px", padding: "2px 10px",
          color: aiImproving ? W.fgMuted : "#a8d8f0",
          fontSize: "11px", cursor: aiImproving ? "not-allowed" : "pointer",
        }
      }, aiImproving ? "⏳ bezig…" : "✨ verbeter"),

      // Sluit-knop (alleen als suggestie open is)
      aiImprove && React.createElement("button", {
        onClick: () => setAiImprove(null),
        style: {
          background: "none", border: "none",
          color: W.fgMuted, fontSize: "13px",
          cursor: "pointer", marginLeft: "auto", lineHeight: 1,
        }
      }, "×"),

      // ── Resultaatvenster als overlay BOVEN de balk ──────────────────────────
      aiImprove && React.createElement("div", {
        style: {
          position: "absolute",
          bottom: "100%",        // direkt boven de balk
          left: 0, right: 0,
          background: W.bg2,
          border: `1px solid rgba(138,198,242,0.35)`,
          borderBottom: "none",
          borderRadius: "6px 6px 0 0",
          boxShadow: "0 -4px 16px rgba(0,0,0,0.4)",
          zIndex: 200,
          maxHeight: "260px",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }
      },
        // Header-balk
        React.createElement("div", {
          style: {
            padding: "6px 12px",
            background: "rgba(138,198,242,0.08)",
            borderBottom: `1px solid rgba(138,198,242,0.18)`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }
        },
          React.createElement("span", {
            style:{fontSize:"11px", color:"#a8d8f0", letterSpacing:"0.5px"}
          }, "AI SUGGESTIE — verbeterde versie"),
          React.createElement("div", {style:{display:"flex", gap:"6px"}},
            React.createElement("button", {
              onClick: acceptImprove,
              style: {
                background: "rgba(159,202,86,0.2)",
                border: `1px solid rgba(159,202,86,0.4)`,
                borderRadius: "4px", padding: "2px 10px",
                color: W.comment, fontSize: "12px",
                cursor: "pointer", fontWeight: "bold",
              }
            }, "✓ overnemen"),
            React.createElement("button", {
              onClick: () => setAiImprove(null),
              style: {
                background: "none", border: `1px solid ${W.splitBg}`,
                borderRadius: "4px", padding: "2px 8px",
                color: W.fgMuted, fontSize: "12px", cursor: "pointer",
              }
            }, "negeren")
          )
        ),
        // Verbeterde tekst — scrollbaar
        React.createElement("div", {
          style: {
            padding: "8px 12px",
            fontSize: "13px", color: W.fg,
            lineHeight: "1.6",
            overflowY: "auto",
            fontFamily: "'Hack','Courier New',monospace",
            whiteSpace: "pre-wrap",
          }
        }, aiImprove.improved)
      )
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
