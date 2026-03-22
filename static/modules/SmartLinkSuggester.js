// ── SmartLinkSuggester ────────────────────────────────────────────────────────
// Herbruikbaar component voor slimme link-suggesties.
// Combineert 3 signalen: gedeelde tags (instant) + TF-IDF server + LLM (optioneel).
//
// Props:
//   content      — tekst van de huidige notitie
//   noteId       — ID van de huidige notitie (om zichzelf te skippen)
//   allNotes     — alle notities (voor instant tag-score)
//   llmModel     — actief model (optioneel, voor LLM-laag)
//   onInsertLink — (linkText, title) => void
//   compact      — boolean, compacte weergave voor zijbalk
//   autoLoad     — boolean, laad suggesties direct bij mount

const SmartLinkSuggester = ({
  content = "",
  noteId  = "",
  allNotes = [],
  llmModel = "",
  onInsertLink,
  compact = false,
  autoLoad = false,
}) => {
  const { useState, useEffect, useCallback, useMemo, useRef } = React;

  const [suggestions,  setSuggestions]  = useState([]);   // server-resultaten
  const [loading,      setLoading]      = useState(false);
  const [llmLoading,   setLlmLoading]   = useState(false);
  const [llmDone,      setLlmDone]      = useState(false);
  const [justLinked,   setJustLinked]   = useState(null);
  const [error,        setError]        = useState(null);
  const [loaded,       setLoaded]       = useState(false);
  const debRef = useRef(null);

  // ── Laag 1: instant client-side score op gedeelde tags ────────────────────
  const instantScored = useMemo(() => {
    if (!content.trim() || allNotes.length < 2) return [];
    const contentLow = content.toLowerCase();
    const contentWords = new Set(
      (contentLow.match(/[a-z\u00c0-\u024f]{3,}/g) || [])
        .filter(w => !["de","het","een","van","voor","met","dat","die","zijn","the","and","for","that","with"].includes(w))
    );
    return allNotes
      .filter(n => n.id !== noteId && n.title)
      .map(n => {
        let score = 0;
        const reasons = [];
        // Gedeelde tags
        const sharedTags = (n.tags||[]).filter(t => contentLow.includes(t));
        if (sharedTags.length) {
          score += sharedTags.length * 12;
          reasons.push(`tag: ${sharedTags.slice(0,2).join(", ")}`);
        }
        // Titel-woorden in content
        const titleWords = (n.title.toLowerCase().match(/[a-z\u00c0-\u024f]{3,}/g)||[])
          .filter(w => !["de","het","een","van","the","and"].includes(w));
        const titleHits = titleWords.filter(w => contentWords.has(w));
        if (titleHits.length) {
          score += titleHits.length * 10;
          reasons.push(`woord: ${titleHits.slice(0,2).join(", ")}`);
        }
        return score > 0 ? { ...n, score, reasons, source: "instant" } : null;
      })
      .filter(Boolean)
      .sort((a,b) => b.score - a.score)
      .slice(0, 5);
  }, [content, noteId, allNotes]);

  // ── Laag 2: Server TF-IDF + entiteiten ────────────────────────────────────
  const loadServerSuggestions = useCallback(async () => {
    if (!content.trim() || loading) return;
    setLoading(true);
    setError(null);
    setLlmDone(false);
    try {
      const res = await fetch("/api/suggest-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.slice(0, 6000), note_id: noteId, top_n: 12 }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSuggestions(data.suggestions || []);
      setLoaded(true);
    } catch(e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [content, noteId]);

  // ── Laag 3: LLM verrijking — dedicated endpoint ─────────────────────────
  const loadLlmReasons = useCallback(async (sug) => {
    if (!llmModel || !sug.length) return;
    setLlmLoading(true);
    try {
      const candidates = sug.slice(0, 8).map(s => ({
        id: s.id, title: s.title, tags: s.tags || []
      }));
      const res = await fetch("/api/llm/link-reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.slice(0, 1500),
          candidates,
          model: llmModel,
        }),
      });
      const data = await res.json();
      if (data.reasons?.length) {
        const reasonMap = {};
        data.reasons.forEach(r => { if (r.relevant) reasonMap[r.id] = r.reason; });
        setSuggestions(prev => prev.map(s => {
          const llmReason = reasonMap[s.id];
          if (!llmReason) return s;
          return { ...s, llmReason, reasons: [llmReason, ...(s.reasons||[]).slice(0,1)] };
        }));
        setLlmDone(true);
      }
    } catch(e) {
      // LLM-verrijking is optioneel — stille fout
    } finally {
      setLlmLoading(false);
    }
  }, [llmModel, content]);

  // Auto-load bij mount als gevraagd
  useEffect(() => {
    if (autoLoad && content.trim().length > 100) {
      loadServerSuggestions().then(() => {});
    }
  }, []);

  // Combineer instant + server suggesties (server overschrijft instant voor overlappende IDs)
  const combined = useMemo(() => {
    if (suggestions.length) return suggestions;
    return instantScored;
  }, [suggestions, instantScored]);

  // Welke zijn al gelinkt?
  const alreadyLinked = useMemo(() => {
    const pattern = /\[\[([^\]]+)\]\]/g;
    const linked = new Set();
    let m;
    while ((m = pattern.exec(content)) !== null) linked.add(m[1].toLowerCase());
    return linked;
  }, [content]);

  const handleLink = (title) => {
    onInsertLink?.(`[[${title}]]`, title);
    setJustLinked(title);
    setTimeout(() => setJustLinked(null), 2000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const S = {
    root: { display: "flex", flexDirection: "column", gap: compact ? "0" : "6px" },
    loadBtn: {
      display: "flex", alignItems: "center", gap: "6px",
      background: "rgba(138,198,242,0.08)",
      border: `1px solid rgba(138,198,242,0.25)`,
      borderRadius: "6px", padding: compact ? "5px 10px" : "7px 14px",
      color: W.blue, fontSize: "12px", cursor: "pointer",
      fontFamily: "inherit", width: "100%", justifyContent: "center",
      transition: "all 0.15s",
    },
    item: (isLinked) => ({
      display: "flex", alignItems: "flex-start", gap: "8px",
      padding: compact ? "6px 8px" : "8px 12px",
      borderRadius: "6px",
      background: isLinked ? "transparent" : "rgba(255,255,255,0.02)",
      border: `1px solid ${isLinked ? W.splitBg : "rgba(138,198,242,0.12)"}`,
      opacity: isLinked ? 0.5 : 1,
      cursor: isLinked ? "default" : "pointer",
      transition: "all 0.12s",
    }),
    scoreBar: (score) => ({
      width: "3px", alignSelf: "stretch", borderRadius: "2px", flexShrink: 0,
      minHeight: "16px",
      background: score > 40
        ? `rgba(159,202,86,0.7)` : score > 20
        ? `rgba(138,198,242,0.6)` : `rgba(160,168,176,0.4)`,
    }),
    title: { fontSize: compact ? "12px" : "13px", color: W.fg, fontWeight: "500",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
    reasons: { display: "flex", gap: "4px", flexWrap: "wrap", marginTop: "3px" },
    reasonPill: {
      fontSize: "10px", color: W.fgMuted,
      background: "rgba(255,255,255,0.05)",
      border: `1px solid ${W.splitBg}`,
      borderRadius: "10px", padding: "1px 6px",
    },
    linkBtn: {
      marginLeft: "auto", flexShrink: 0, fontSize: "10px",
      background: "rgba(138,198,242,0.1)",
      border: `1px solid rgba(138,198,242,0.3)`,
      borderRadius: "4px", padding: "2px 8px",
      color: W.blue, cursor: "pointer", fontFamily: "inherit",
    },
  };

  return React.createElement("div", { style: S.root },

    // Laad-knop + status
    React.createElement("div", { style: { display: "flex", gap: "6px", alignItems: "center" } },
      React.createElement("button", {
        style: { ...S.loadBtn, flex: 1 },
        onClick: () => loadServerSuggestions().then(d => d !== undefined && loadLlmReasons(suggestions)),
        disabled: loading,
        onMouseEnter: e => e.currentTarget.style.background = "rgba(138,198,242,0.14)",
        onMouseLeave: e => e.currentTarget.style.background = "rgba(138,198,242,0.08)",
      },
        loading
          ? React.createElement("span", { style: { animation: "ai-pulse 1.2s ease-in-out infinite" } }, "⏳")
          : "🔗",
        loading ? "Analyseren…" : loaded ? "↺ Heranalyseer" : "Slimme links zoeken"
      ),
      llmModel && loaded && !llmDone && React.createElement("button", {
        style: { ...S.loadBtn, flex: "0 0 auto", padding: "5px 10px", fontSize: "11px",
                 background: "rgba(215,135,255,0.08)", borderColor: "rgba(215,135,255,0.25)",
                 color: W.purple },
        onClick: () => loadLlmReasons(suggestions),
        disabled: llmLoading,
        title: "Laat het AI-model de links beoordelen en een reden geven",
      },
        llmLoading
          ? React.createElement("span", { style: { animation: "ai-pulse 1.2s ease-in-out infinite" } }, "🧠")
          : "🧠 AI"
      ),
    ),

    // Foutmelding
    error && React.createElement("div", {
      style: { fontSize: "11px", color: W.orange, padding: "4px 8px" }
    }, "⚠ " + error),

    // Instant suggesties (voor laden)
    !loaded && !loading && instantScored.length > 0 && React.createElement("div", null,
      React.createElement("div", {
        style: { fontSize: "10px", color: W.fgMuted, padding: "4px 0 6px",
                 letterSpacing: "0.8px" }
      }, "DIRECT — gedeelde tags & titels"),
      instantScored.map((n, i) => {
        const linked = alreadyLinked.has(n.title.toLowerCase());
        return React.createElement("div", {
          key: n.id,
          style: S.item(linked),
          onClick: () => !linked && handleLink(n.title),
          onMouseEnter: e => { if(!linked) e.currentTarget.style.background = "rgba(138,198,242,0.06)"; },
          onMouseLeave: e => { e.currentTarget.style.background = linked ? "transparent" : "rgba(255,255,255,0.02)"; },
        },
          React.createElement("div", { style: S.scoreBar(n.score) }),
          React.createElement("div", { style: { flex: 1, minWidth: 0 } },
            React.createElement("div", { style: S.title }, n.title),
            n.reasons?.length > 0 && React.createElement("div", { style: S.reasons },
              n.reasons.map((r,j) =>
                React.createElement("span", { key: j, style: S.reasonPill }, r)
              )
            )
          ),
          React.createElement("span", {
            style: { ...S.linkBtn, color: linked ? W.comment : W.blue }
          }, linked ? "✓" : justLinked === n.title ? "✓" : "+ link")
        );
      })
    ),

    // Server + LLM resultaten
    loaded && combined.length === 0 && React.createElement("div", {
      style: { fontSize: "12px", color: W.fgMuted, padding: "8px", fontStyle: "italic" }
    }, "Geen geschikte links gevonden."),

    loaded && combined.map((n, i) => {
      const linked = alreadyLinked.has((n.title||"").toLowerCase()) ||
                     justLinked === n.title;
      const scoreColor = n.score > 40 ? W.comment : n.score > 20 ? W.blue : W.fgMuted;
      return React.createElement("div", {
        key: n.id || i,
        style: S.item(linked),
        onClick: () => !linked && handleLink(n.title),
        onMouseEnter: e => { if(!linked) e.currentTarget.style.background = "rgba(138,198,242,0.06)"; },
        onMouseLeave: e => { e.currentTarget.style.background = linked ? "transparent" : "rgba(255,255,255,0.02)"; },
      },
        React.createElement("div", { style: S.scoreBar(n.score) }),
        React.createElement("div", { style: { flex: 1, minWidth: 0 } },
          // Titel + LLM-badge
          React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "5px" } },
            React.createElement("div", { style: S.title }, n.title),
            n.llmReason && React.createElement("span", {
              style: { fontSize: "9px", color: W.purple,
                       background: "rgba(215,135,255,0.1)",
                       borderRadius: "3px", padding: "1px 4px", flexShrink: 0 }
            }, "AI")
          ),
          // Redenen
          (n.reasons||[]).length > 0 && React.createElement("div", { style: S.reasons },
            n.reasons.map((r, j) =>
              React.createElement("span", { key: j, style: {
                ...S.reasonPill,
                color: j === 0 && n.llmReason ? W.purple : W.fgMuted,
                borderColor: j === 0 && n.llmReason ? "rgba(215,135,255,0.3)" : W.splitBg,
              }}, r)
            )
          ),
          // Tags
          n.tags?.length > 0 && React.createElement("div", {
            style: { display: "flex", gap: "3px", marginTop: "3px", flexWrap: "wrap" }
          }, (n.tags||[]).slice(0,3).map(t =>
            React.createElement(TagPill, { key: t, tag: t, small: true })
          ))
        ),
        React.createElement("div", { style: { display: "flex", flexDirection: "column",
                                               alignItems: "flex-end", gap: "4px", flexShrink: 0 } },
          React.createElement("span", {
            style: { ...S.linkBtn, color: linked ? W.comment : W.blue }
          }, linked ? "✓" : justLinked === n.title ? "✓" : "+ link"),
          React.createElement("span", {
            style: { fontSize: "9px", color: scoreColor }
          }, Math.round(n.score))
        )
      );
    })
  );
};
