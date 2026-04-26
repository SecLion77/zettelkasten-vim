// ── OutlineEditor ──────────────────────────────────────────────────────────────
// Simpele outline editor: elke regel is een bullet, Tab/Shift+Tab voor indenteren.
// Converteert markdown bullets naar bewerkbare regels en terug.
// Props: value, onChange, onSave, notes, noteId

const OutlineEditor = ({ value = "", onChange, onSave, notes = [], noteId = "" }) => {
  const { useState, useEffect, useRef, useCallback } = React;

  // ── Interne state: gewoon een textarea met slimme keyboard handling ────────
  // We renderen één grote textarea ipv losse inputs per bullet —
  // dat vermijdt alle sync-problemen volledig.
  const taRef = useRef(null);
  const [content, setContent] = useState(value);
  const isInternalChange = useRef(false);

  // Sync van buiten: alleen als noteId verandert
  const lastNoteId = useRef(noteId);
  useEffect(() => {
    if (noteId !== lastNoteId.current) {
      lastNoteId.current = noteId;
      setContent(value);
    }
  }, [noteId, value]);

  // Stuur wijzigingen naar parent
  const handleChange = useCallback((e) => {
    const val = e.target.value;
    setContent(val);
    onChange?.(val);
  }, [onChange]);

  // Slimme keyboard shortcuts
  const handleKeyDown = useCallback((e) => {
    const ta = taRef.current;
    if (!ta) return;

    const val   = ta.value;
    const start = ta.selectionStart;
    const end   = ta.selectionEnd;

    // Ctrl/Cmd+S → opslaan
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      onSave?.();
      return;
    }

    // Tab → indenteren (voeg 2 spaties toe aan begin van huidige regel)
    if (e.key === "Tab") {
      e.preventDefault();
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      const lineEnd   = val.indexOf("\n", start);
      const line      = val.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);

      if (!e.shiftKey) {
        // Indenteren: voeg 2 spaties toe
        const newVal = val.slice(0, lineStart) + "  " + val.slice(lineStart);
        setContent(newVal);
        onChange?.(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      } else {
        // Uitrukken: verwijder 2 spaties als die er staan
        if (line.startsWith("  ")) {
          const newVal = val.slice(0, lineStart) + line.slice(2) + val.slice(lineStart + line.length);
          setContent(newVal);
          onChange?.(newVal);
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = Math.max(lineStart, start - 2);
          });
        }
      }
      return;
    }

    // Enter → auto-bullet: kopieer prefix van huidige regel
    if (e.key === "Enter" && !e.shiftKey) {
      const lineStart = val.lastIndexOf("\n", start - 1) + 1;
      const line      = val.slice(lineStart, start);
      // Detecteer bullet prefix: "  - " of "- " of "* "
      const prefixMatch = line.match(/^(\s*(?:[-*]\s+|\d+\.\s+))/);
      if (prefixMatch) {
        e.preventDefault();
        const prefix  = prefixMatch[1];
        const insert  = "\n" + prefix;
        const newVal  = val.slice(0, start) + insert + val.slice(end);
        setContent(newVal);
        onChange?.(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + insert.length;
        });
      }
      // Anders: normaal Enter gedrag
      return;
    }
  }, [onSave, onChange]);

  // Auto-resize de textarea mee met de inhoud
  const autoResize = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, []);

  useEffect(() => { autoResize(); }, [content]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return React.createElement("div", {
    style: { flex: 1, display: "flex", flexDirection: "column",
             overflow: "hidden", minHeight: 0, position: "relative" }
  },
    // Toolbar hint
    React.createElement("div", {
      style: { padding: "4px 16px", borderBottom: `1px solid ${W.splitBg}`,
               fontSize: "10px", color: W.fgMuted, flexShrink: 0,
               display: "flex", gap: "12px", background: W.bg2 }
    },
      React.createElement("span", null, "Tab = indenteren"),
      React.createElement("span", null, "Shift+Tab = uitrukken"),
      React.createElement("span", null, "Enter na bullet = doorgaan"),
      React.createElement("span", null, "Ctrl+S = opslaan"),
    ),

    // De editor — gewone textarea met outline-styling
    React.createElement("div", {
      style: { flex: 1, overflowY: "auto", padding: "16px 20px",
               WebkitOverflowScrolling: "touch" }
    },
      React.createElement("textarea", {
        ref: taRef,
        value: content,
        onChange: handleChange,
        onKeyDown: handleKeyDown,
        onInput: autoResize,
        spellCheck: true,
        autoFocus: false,
        style: {
          width: "100%",
          minHeight: "200px",
          background: "transparent",
          border: "none",
          outline: "none",
          color: W.fg,
          fontSize: "14px",
          lineHeight: "1.8",
          fontFamily: "'DM Sans', system-ui, sans-serif",
          resize: "none",
          caretColor: W.yellow,
          overflowY: "hidden", // auto-resize doet de rest
        }
      })
    )
  );
};
