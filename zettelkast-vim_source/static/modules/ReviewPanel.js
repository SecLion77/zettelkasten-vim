// ── ReviewPanel ───────────────────────────────────────────────────────────────
// Lichte spaced repetition: markeer notities voor review, zie ze terug op tijd.
// Geen flashcard-systeem — gewoon "revisit" vlaggen op notities.
// Opslag in vault/config.json via /api/config

const ReviewPanel = ({ notes = [], onOpenNote, onUpdateNote, llmModel = "" }) => {
  const { useState, useEffect, useMemo } = React;
  const [reviewData, setReviewData] = useState({}); // { noteId: { lastReview, interval, due } }
  const [loading, setLoading]       = useState(true);
  const [current, setCurrent]       = useState(null); // huidige notitie in review
  const [done, setDone]             = useState({});   // { id: bool } — al behandeld in sessie
  // Actieve recall state
  const [recallQ,    setRecallQ]    = useState(null);  // AI-gegenereerde vraag
  const [recallAns,  setRecallAns]  = useState("");   // gebruikers antwoord
  const [recallDone, setRecallDone] = useState(false); // vraag beantwoord → toon notitie
  const [recallLoad, setRecallLoad] = useState(false); // vraag laden
  const [panelTab,   setPanelTab]   = useState("overview"); // "overview" | "learn"
  const [sortBy,     setSortBy]     = useState("due");      // "due" | "title" | "interval"
  const [filterText, setFilterText] = useState("");

  // Laad review-data uit config — cleanup verwijderde notities
  useEffect(() => {
    fetch("/api/config")
      .then(r => r.json())
      .then(d => {
        const raw = d.config?.review_data || {};
        const noteIds = new Set(notes.map(n => n.id));
        // Verwijder entries van notities die niet meer bestaan
        const cleaned = Object.fromEntries(
          Object.entries(raw).filter(([id]) => noteIds.has(id))
        );
        setReviewData(cleaned);
        // Sla gecleande data terug op als er entries verwijderd zijn
        if (Object.keys(cleaned).length < Object.keys(raw).length) {
          fetch("/api/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ review_data: cleaned }),
          }).catch(() => {});
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [notes]);

  const saveReviewData = async (updated) => {
    setReviewData(updated);
    try {
      await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_data: updated }),
      });
    } catch(e) { console.error("Review opslaan mislukt", e); }
  };

  // Genereer een actieve recall-vraag voor een notitie
  const generateRecallQuestion = async (note) => {
    setRecallLoad(true); setRecallQ(null); setRecallAns(""); setRecallDone(false);
    const model = llmModel || "";
    if (!model) {
      // Geen model: toon generieke vraag
      setRecallQ(`Wat is de kerngedachte van "${note.title}"? Beschrijf het in 2-3 zinnen zonder de notitie te lezen.`);
      setRecallLoad(false); return;
    }
    try {
      const excerpt = (note.content || "")
        .replace(/^---[\s\S]*?---/, "").trim().slice(0, 600);
      const resp = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content:
            `Je bent een Socratische leercoach. Genereer ÉÉN scherpe recall-vraag voor deze notitie.\n` +
            `De vraag moet testen of de lezer de kerngedachte echt begrijpt, niet alleen kan herkennen.\n` +
            `Geen ja/nee-vragen. Geen vragen die de titel herhalen.\n` +
            `Geef ALLEEN de vraag, geen inleiding.\n\n` +
            `Titel: ${note.title}\n\nFragment:\n${excerpt}`
          }],
          system: "Geef alleen de vraag. Geen uitleg, geen inleiding, geen aanhalingstekens."
        }),
      });
      const data = await resp.json();
      const q = data.content || data.response || data.message || "";
      setRecallQ(q.trim() || `Wat is de kerngedachte van "${note.title}"?`);
    } catch {
      setRecallQ(`Wat is de kerngedachte van "${note.title}"? Beschrijf het zonder de notitie te lezen.`);
    }
    setRecallLoad(false);
  };

  const today = new Date().toISOString().slice(0, 10);

  // Notities die vandaag aan de beurt zijn
  const dueNotes = useMemo(() => {
    return notes.filter(n => {
      const rd = reviewData[n.id];
      if (!rd) return false; // niet gemarkeerd
      // Alleen als er expliciet een due datum is én die <= vandaag
      return rd.due && rd.due <= today;
    }).filter(n => !done[n.id]);
  }, [notes, reviewData, today, done]);

  // Alle gemarkeerde notities
  const markedNotes = useMemo(() =>
    notes.filter(n => reviewData[n.id]),
    [notes, reviewData]
  );

  // Gesorteerde en gefilterde lijst — MOET vóór early return staan (React hooks rule)
  const sortedMarked = useMemo(() => {
    let list = markedNotes.filter(n =>
      !filterText || n.title?.toLowerCase().includes(filterText.toLowerCase())
    );
    if (sortBy === "due") {
      list = [...list].sort((a, b) => {
        const da = reviewData[a.id]?.due || "0";
        const db = reviewData[b.id]?.due || "0";
        return da.localeCompare(db);
      });
    } else if (sortBy === "title") {
      list = [...list].sort((a, b) =>
        (a.title || "").localeCompare(b.title || "", "nl", {sensitivity: "base"})
      );
    } else if (sortBy === "interval") {
      list = [...list].sort((a, b) =>
        (reviewData[b.id]?.interval || 0) - (reviewData[a.id]?.interval || 0)
      );
    }
    return list;
  }, [markedNotes, reviewData, sortBy, filterText]);

  const handleMark = async (noteId) => {
    const updated = {
      ...reviewData,
      [noteId]: {
        lastReview: today,
        interval: 1,
        due: tomorrow(),
      }
    };
    await saveReviewData(updated);
  };

  const handleUnmark = async (noteId) => {
    const updated = { ...reviewData };
    delete updated[noteId];
    await saveReviewData(updated);
  };

  // Na review: pas interval aan (simpel: 1 → 3 → 7 → 14 → 30 dagen)
  const handleReviewed = async (noteId, easy) => {
    const rd = reviewData[noteId] || { interval: 1 };
    const intervals = [1, 3, 7, 14, 30];
    const curIdx    = intervals.indexOf(rd.interval);
    const newInterval = easy
      ? intervals[Math.min(curIdx + 1, intervals.length - 1)]
      : 1; // moeilijk → terug naar begin
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + newInterval);
    const updated = {
      ...reviewData,
      [noteId]: {
        lastReview: today,
        interval: newInterval,
        due: dueDate.toISOString().slice(0, 10),
      }
    };
    await saveReviewData(updated);
    setDone(d => ({ ...d, [noteId]: true }));
    setCurrent(null);
    setRecallQ(null); setRecallAns(""); setRecallDone(false);
  };

  function tomorrow() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  function daysUntil(dateStr) {
    if (!dateStr) return 0;
    const diff = new Date(dateStr) - new Date(today);
    return Math.ceil(diff / 86400000);
  }

  if (loading) return React.createElement("div", {
    style: { flex: 1, display: "flex", alignItems: "center",
             justifyContent: "center", color: W.fgMuted }
  }, "Laden…");

  // ── Review-sessie ─────────────────────────────────────────────────────────
  if (current) {
    const note = notes.find(n => n.id === current);
    if (!note) { setCurrent(null); return null; }
    // Genereer vraag bij eerste keer openen
    if (recallQ === null && !recallLoad) { generateRecallQuestion(note); }
    const wc = (note.content||"").trim().split(/\s+/).filter(Boolean).length;

    return React.createElement("div", {
      style: { flex: 1, display: "flex", flexDirection: "column",
               overflow: "hidden", minHeight: 0 }
    },
      // Toolbar
      React.createElement("div", {
        style: { background: W.bg2, borderBottom: `1px solid ${W.splitBg}`,
                 padding: "10px 16px", flexShrink: 0,
                 display: "flex", alignItems: "center", gap: "10px" }
      },
        React.createElement("button", {
          onClick: () => { setCurrent(null); setRecallQ(null); setRecallDone(false); },
          style: { background: "none", border: "none", color: W.fgMuted,
                   cursor: "pointer", fontSize: "16px", padding: "0 4px" }
        }, "←"),
        React.createElement("span", {
          style: { fontSize: "13px", color: W.fgMuted }
        }, `Review ${dueNotes.indexOf(note) + 1} / ${dueNotes.length + Object.keys(done).length}`),
        React.createElement("div", { style: { flex: 1 } }),
        recallDone && React.createElement("button", {
          onClick: () => onOpenNote?.(note.id),
          style: { background: "none", border: `1px solid ${W.splitBg}`,
                   borderRadius: "5px", color: W.blue,
                   cursor: "pointer", fontSize: "12px", padding: "4px 10px" }
        }, "→ Open in editor"),
      ),

      // Fase 1: Recall-vraag (notitie nog verborgen)
      !recallDone && React.createElement("div", {
        style: { flex: 1, display: "flex", flexDirection: "column",
                 padding: "24px", overflowY: "auto" }
      },
        React.createElement("div", {
          style: { fontSize: "10px", letterSpacing: "1px", color: W.fgMuted,
                   marginBottom: "16px", textTransform: "uppercase" }
        }, "Actieve recall — beantwoord vóór de notitie te zien"),

        // Vraag
        React.createElement("div", {
          style: { background: "rgba(138,198,242,0.06)",
                   border: `1px solid rgba(138,198,242,0.2)`,
                   borderRadius: "8px", padding: "16px 18px",
                   fontSize: "15px", color: W.fg, lineHeight: "1.7",
                   marginBottom: "20px", minHeight: "60px" }
        }, recallLoad
          ? React.createElement("span", { style: { color: W.fgMuted } }, "Vraag genereren…")
          : (recallQ || "")),

        // Antwoord invoerveld
        !recallLoad && React.createElement(React.Fragment, null,
          React.createElement("textarea", {
            placeholder: "Jouw antwoord… (Enter om door te gaan)",
            value: recallAns,
            onChange: e => setRecallAns(e.target.value),
            onKeyDown: e => {
              if (e.key === "Enter" && !e.shiftKey && recallAns.trim()) {
                e.preventDefault(); setRecallDone(true);
              }
            },
            autoFocus: true,
            style: {
              width: "100%", minHeight: "100px", background: W.bg,
              border: `1px solid ${W.splitBg}`, borderRadius: "6px",
              color: W.fg, padding: "12px", fontSize: "14px",
              fontFamily: "'DM Sans', system-ui, sans-serif",
              lineHeight: "1.7", resize: "vertical", outline: "none",
              boxSizing: "border-box", marginBottom: "12px",
            }
          }),
          React.createElement("div", {
            style: { display: "flex", gap: "8px", alignItems: "center" }
          },
            React.createElement("button", {
              disabled: !recallAns.trim(),
              onClick: () => setRecallDone(true),
              style: {
                background: recallAns.trim() ? "rgba(159,202,86,0.15)" : "transparent",
                border: `1px solid ${recallAns.trim() ? W.comment : W.splitBg}`,
                borderRadius: "6px", color: recallAns.trim() ? W.comment : W.fgMuted,
                padding: "8px 20px", fontSize: "13px", cursor: recallAns.trim() ? "pointer" : "default",
                fontWeight: "600", transition: "all 0.15s",
              }
            }, "Toon notitie →"),
            React.createElement("button", {
              onClick: () => setRecallDone(true),
              style: { background: "none", border: "none", color: W.fgMuted,
                       fontSize: "12px", cursor: "pointer" }
            }, "overslaan")
          )
        )
      ),

      // Fase 2: Notitie-inhoud (na beantwoording)
      recallDone && React.createElement("div", {
        style: { flex: 1, overflowY: "auto", padding: "20px 24px",
                 WebkitOverflowScrolling: "touch" }
      },
        // Toon het eigen antwoord ter vergelijking
        recallAns.trim() && React.createElement("div", {
          style: { background: "rgba(234,231,136,0.06)",
                   border: `1px solid rgba(234,231,136,0.2)`,
                   borderRadius: "6px", padding: "10px 14px",
                   marginBottom: "16px" }
        },
          React.createElement("div", {
            style: { fontSize: "9px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "4px", textTransform: "uppercase" }
          }, "Jouw antwoord"),
          React.createElement("div", {
            style: { fontSize: "13px", color: W.fgDim, lineHeight: "1.6",
                     fontFamily: "'DM Sans', system-ui, sans-serif" }
          }, recallAns)
        ),
        React.createElement("h2", {
          style: { color: W.statusFg, marginBottom: "8px", fontSize: "18px" }
        }, note.title || "(geen titel)"),
        (note.tags||[]).length > 0 && React.createElement("div", {
          style: { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" }
        },
          (note.tags||[]).map(t =>
            React.createElement(TagPill, { key: t, tag: t, small: true })
          )
        ),
        React.createElement("div", {
          style: { fontSize: "13px", color: W.fgMuted, marginBottom: "16px" }
        }, `${wc} woorden`),
        React.createElement("div", {
          style: { fontSize: "14px", color: W.fg, lineHeight: "1.8",
                   whiteSpace: "pre-wrap", fontFamily: "'DM Sans', system-ui, sans-serif" }
        }, (note.content||"").slice(0, 1000) + (note.content?.length > 1000 ? "\n\n…" : ""))
      ),
      // Review knoppen
      React.createElement("div", {
        style: { background: W.bg2, borderTop: `1px solid ${W.splitBg}`,
                 padding: "12px 16px", flexShrink: 0,
                 display: "flex", gap: "10px", justifyContent: "center" }
      },
        React.createElement("button", {
          onClick: () => handleReviewed(note.id, false),
          style: { flex: 1, maxWidth: "160px",
                   background: "rgba(229,120,109,0.12)",
                   border: "1px solid rgba(229,120,109,0.3)",
                   color: W.orange, borderRadius: "8px", padding: "10px",
                   fontSize: "13px", cursor: "pointer", fontWeight: "600" }
        }, "😓 Moeilijk\n+1 dag"),
        React.createElement("button", {
          onClick: () => handleReviewed(note.id, true),
          style: { flex: 1, maxWidth: "160px",
                   background: "rgba(159,202,86,0.12)",
                   border: "1px solid rgba(159,202,86,0.3)",
                   color: W.comment, borderRadius: "8px", padding: "10px",
                   fontSize: "13px", cursor: "pointer", fontWeight: "600" }
        }, "😊 Makkelijk\n+" + (reviewData[note.id]?.interval > 1
            ? [1,3,7,14,30][[1,3,7,14,30].indexOf(reviewData[note.id]?.interval)+1] || 30
            : 3) + " dagen"),
      )
    );
  }

  // ── Hoofd overzicht ───────────────────────────────────────────────────────
  return React.createElement("div", {
    style: { flex: 1, display: "flex", flexDirection: "column",
             overflow: "hidden", minHeight: 0, background: W.bg }
  },
    // Header met tabs
    React.createElement("div", {
      style: { background: W.bg2, borderBottom: `1px solid ${W.splitBg}`,
               flexShrink: 0 }
    },
      // Titelbalk
      React.createElement("div", {
        style: { padding: "10px 16px 0", display: "flex",
                 alignItems: "center", gap: "8px" }
      },
        React.createElement("span", { style: { fontSize: "16px" } }, "🔁"),
        React.createElement("span", {
          style: { fontSize: "13px", fontWeight: "700", color: W.statusFg,
                   letterSpacing: "1px", flex: 1 }
        }, "SPACED REPETITION"),
        // Stats chips
        React.createElement("span", {
          style: { fontSize: "11px", color: W.fgMuted }
        }, `${markedNotes.length} notities`),
        dueNotes.length > 0 && React.createElement("span", {
          style: { background: W.orange, color: W.bg, borderRadius: "10px",
                   padding: "1px 8px", fontSize: "11px", fontWeight: "bold",
                   marginLeft: "4px" }
        }, `${dueNotes.length} vandaag`),
      ),
      // Tabs
      React.createElement("div", {
        style: { display: "flex", gap: "0", marginTop: "8px" }
      },
        [
          { id: "overview", label: "📋 Overzicht" },
          { id: "learn",    label: "▶ Leren" + (dueNotes.length > 0 ? ` (${dueNotes.length})` : "") },
        ].map(t => React.createElement("button", {
          key: t.id,
          onClick: () => setPanelTab(t.id),
          style: {
            background: "none", border: "none",
            borderBottom: `2px solid ${panelTab === t.id ? W.blue : "transparent"}`,
            color: panelTab === t.id ? W.blue : W.fgMuted,
            padding: "6px 16px", fontSize: "12px", cursor: "pointer",
            fontWeight: panelTab === t.id ? "600" : "400",
            transition: "all .1s",
          }
        }, t.label))
      )
    ),

    // ── Tab inhoud ──────────────────────────────────────────────────────────

    // ── OVERZICHT TAB ────────────────────────────────────────────────────────
    panelTab === "overview" && React.createElement("div", {
      style: { flex: 1, display: "flex", flexDirection: "column",
               overflow: "hidden", minHeight: 0 }
    },
      // Zoek + sorteer balk
      React.createElement("div", {
        style: { padding: "10px 14px", borderBottom: `1px solid ${W.splitBg}`,
                 flexShrink: 0, display: "flex", gap: "8px", alignItems: "center" }
      },
        // Zoekbalk
        React.createElement("input", {
          placeholder: "Filter notities…",
          value: filterText,
          onChange: e => setFilterText(e.target.value),
          style: {
            flex: 1, background: W.bg2, border: `1px solid ${W.splitBg}`,
            borderRadius: "5px", color: W.fg, padding: "5px 10px",
            fontSize: "12px", outline: "none",
          }
        }),
        // Sorteer dropdown
        React.createElement("select", {
          value: sortBy,
          onChange: e => setSortBy(e.target.value),
          style: {
            background: W.bg2, border: `1px solid ${W.splitBg}`,
            borderRadius: "5px", color: W.fgDim, padding: "5px 8px",
            fontSize: "11px", cursor: "pointer", outline: "none",
          }
        },
          React.createElement("option", {value:"due"},      "Sorteer: datum"),
          React.createElement("option", {value:"title"},    "Sorteer: titel"),
          React.createElement("option", {value:"interval"}, "Sorteer: interval")
        )
      ),

      // Lijst
      React.createElement("div", {
        style: { flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" }
      },
        sortedMarked.length === 0
          ? React.createElement("div", {
              style: { padding: "40px 20px", textAlign: "center",
                       color: W.fgMuted, fontSize: "13px", fontStyle: "italic" }
            },
              filterText
                ? `Geen resultaten voor "${filterText}"`
                : "Nog geen notities in de review-lijst. Open een notitie en klik 🔁 in de toolbar."
            )
          : sortedMarked.map(n => {
              const rd = reviewData[n.id];
              const days = daysUntil(rd?.due);
              const isDue = days <= 0;
              const isNew = !rd?.lastReview;
              return React.createElement("div", {
                key: n.id,
                style: {
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "10px 14px",
                  borderBottom: `1px solid ${W.splitBg}`,
                  background: isDue ? "rgba(232,200,122,0.03)" : "transparent",
                  transition: "background .1s",
                },
                onMouseEnter: e => e.currentTarget.style.background = isDue
                  ? "rgba(232,200,122,0.06)" : "rgba(255,255,255,0.03)",
                onMouseLeave: e => e.currentTarget.style.background = isDue
                  ? "rgba(232,200,122,0.03)" : "transparent",
              },
                // Status dot
                React.createElement("div", {
                  style: {
                    width: "8px", height: "8px", borderRadius: "50%",
                    flexShrink: 0,
                    background: isDue ? W.yellow : W.comment,
                    opacity: isDue ? 1 : 0.5,
                  }
                }),

                // Tekst
                React.createElement("div", {
                  style: { flex: 1, minWidth: 0, cursor: "pointer" },
                  onClick: () => onOpenNote?.(n.id),
                },
                  React.createElement("div", {
                    style: { fontSize: "13px", color: isDue ? W.statusFg : W.fg,
                             fontWeight: isDue ? "500" : "400",
                             overflow: "hidden", textOverflow: "ellipsis",
                             whiteSpace: "nowrap" }
                  }, n.title || n.id),
                  React.createElement("div", {
                    style: { fontSize: "10px", color: W.fgMuted, marginTop: "2px",
                             display: "flex", gap: "8px" }
                  },
                    isNew
                      ? React.createElement("span", {style:{color:W.blue}}, "nieuw")
                      : React.createElement("span", null, `laatste: ${rd.lastReview}`),
                    !isNew && React.createElement("span", null,
                      `interval: ${rd.interval}d`),
                    (n.tags||[]).length > 0 && React.createElement("span", {
                      style:{color:W.comment}
                    }, (n.tags||[]).slice(0,2).map(t=>"#"+t).join(" "))
                  )
                ),

                // Datum badge
                React.createElement("span", {
                  style: {
                    fontSize: "10px", flexShrink: 0,
                    borderRadius: "10px", padding: "2px 8px",
                    fontWeight: "600",
                    background: isDue
                      ? "rgba(232,200,122,0.18)"
                      : "rgba(166,209,137,0.1)",
                    color: isDue ? W.yellow : W.comment,
                    border: `1px solid ${isDue
                      ? "rgba(232,200,122,0.3)"
                      : "rgba(166,209,137,0.2)"}`,
                  }
                }, isDue ? "vandaag" : `+${days}d`),

                // Verwijder knop
                React.createElement("button", {
                  onClick: e => { e.stopPropagation(); handleUnmark(n.id); },
                  title: "Verwijder uit review-lijst",
                  style: {
                    background: "none",
                    border: `1px solid transparent`,
                    borderRadius: "4px",
                    color: W.fgMuted, cursor: "pointer",
                    fontSize: "13px", padding: "2px 6px",
                    flexShrink: 0, transition: "all .1s",
                  },
                  onMouseEnter: e => {
                    e.currentTarget.style.color = W.orange;
                    e.currentTarget.style.borderColor = "rgba(245,169,127,0.3)";
                    e.currentTarget.style.background = "rgba(245,169,127,0.08)";
                  },
                  onMouseLeave: e => {
                    e.currentTarget.style.color = W.fgMuted;
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.background = "none";
                  },
                }, "× uit lijst")
              );
            })
      ),

      // Footer: start-knop
      markedNotes.length > 0 && React.createElement("div", {
        style: { padding: "10px 14px", borderTop: `1px solid ${W.splitBg}`,
                 flexShrink: 0, display: "flex", gap: "8px", alignItems: "center" }
      },
        React.createElement("button", {
          onClick: () => { setPanelTab("learn"); setCurrent(dueNotes[0]?.id || markedNotes[0]?.id); },
          style: {
            flex: 1, padding: "9px 0",
            background: dueNotes.length > 0
              ? "rgba(232,200,122,0.15)" : "rgba(125,216,198,0.1)",
            border: `1px solid ${dueNotes.length > 0
              ? "rgba(232,200,122,0.35)" : "rgba(125,216,198,0.25)"}`,
            borderRadius: "6px",
            color: dueNotes.length > 0 ? W.yellow : W.blue,
            fontSize: "13px", cursor: "pointer", fontWeight: "600",
          }
        },
          dueNotes.length > 0
            ? `▶ Start review — ${dueNotes.length} vandaag`
            : `▶ Nu oefenen — ${markedNotes.length} notities`
        )
      )
    ),

    // ── LEREN TAB ────────────────────────────────────────────────────────────
    panelTab === "learn" && React.createElement("div", {
      style: { flex: 1, overflowY: "auto", padding: "16px",
               WebkitOverflowScrolling: "touch" }
    },
      // Vandaag te reviewen
      dueNotes.length > 0 && React.createElement("div", {
        style: { background: "rgba(232,200,122,0.07)",
                 border: `1px solid rgba(232,200,122,0.2)`,
                 borderRadius: "8px", padding: "14px 16px", marginBottom: "16px" }
      },
        React.createElement("div", {
          style: { fontSize: "11px", color: W.yellow, letterSpacing: "1px",
                   fontWeight: "600", marginBottom: "10px" }
        }, `📅 VANDAAG TE REVIEWEN — ${dueNotes.length} notities`),
        React.createElement("div", { style: { marginBottom: "10px" } },
          React.createElement("button", {
            onClick: () => setCurrent(dueNotes[0]?.id),
            style: { background: W.yellow, color: W.bg, border: "none",
                     borderRadius: "7px", padding: "10px 24px",
                     fontSize: "14px", cursor: "pointer", fontWeight: "bold",
                     width: "100%", marginBottom: "6px" }
          }, `▶ Start — ${dueNotes.length} notities`),
          React.createElement("div", {
            style: { fontSize: "10px", color: W.fgMuted, textAlign: "center" }
          }, "De AI stelt eerst een vraag per notitie (actieve recall).")
        ),
        dueNotes.map(n =>
          React.createElement("div", {
            key: n.id,
            style: { display: "flex", alignItems: "center", gap: "8px",
                     padding: "6px 0", borderBottom: `1px solid ${W.splitBg}`,
                     cursor: "pointer" },
            onClick: () => setCurrent(n.id),
          },
            React.createElement("span", { style: { color: W.yellow, fontSize: "12px" } }, "●"),
            React.createElement("span", {
              style: { fontSize: "13px", color: W.fg, flex: 1,
                       overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            }, n.title || n.id)
          )
        )
      ),

      // Alle gemarkeerde notities
      React.createElement("div", {
        style: { background: W.bg2, border: `1px solid ${W.splitBg}`,
                 borderRadius: "8px", padding: "14px 16px" }
      },
        React.createElement("div", {
          style: { display: "flex", alignItems: "center",
                   justifyContent: "space-between", marginBottom: "10px" }
        },
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     fontWeight: "600" }
          }, `GEMARKEERD — ${markedNotes.length} notities`),
          markedNotes.length > 0 && dueNotes.length === 0 && React.createElement("button", {
            onClick: () => setCurrent(markedNotes[0]?.id),
            style: {
              background: "rgba(125,216,198,0.12)",
              border: `1px solid rgba(125,216,198,0.3)`,
              borderRadius: "5px", padding: "4px 12px",
              fontSize: "11px", color: W.blue,
              cursor: "pointer", fontWeight: "600",
            }
          }, "▶ Nu starten")
        ),
        markedNotes.length === 0
          ? React.createElement("div", {
              style: { fontSize: "13px", color: W.fgMuted, fontStyle: "italic" }
            }, "Nog geen notities gemarkeerd. Open een notitie en klik 🔁 in de toolbar.")
          : markedNotes.map(n => {
              const rd = reviewData[n.id];
              const days = daysUntil(rd?.due);
              return React.createElement("div", {
                key: n.id,
                style: { display: "flex", alignItems: "center", gap: "8px",
                         padding: "7px 0", borderBottom: `1px solid ${W.splitBg}` }
              },
                React.createElement("div", { style: { flex: 1, minWidth: 0 } },
                  React.createElement("div", {
                    style: { fontSize: "13px", color: W.fg,
                             overflow: "hidden", textOverflow: "ellipsis",
                             whiteSpace: "nowrap" }
                  }, n.title || n.id),
                  React.createElement("div", {
                    style: { fontSize: "10px", color: W.fgMuted, marginTop: "2px" }
                  }, rd?.lastReview
                    ? `Laatste: ${rd.lastReview} · interval: ${rd.interval}d`
                    : "Nieuw")
                ),
                React.createElement("span", {
                  style: { fontSize: "10px", flexShrink: 0, borderRadius: "10px",
                           padding: "2px 7px", fontWeight: "bold",
                           background: days <= 0
                             ? "rgba(229,120,109,0.15)" : "rgba(159,202,86,0.12)",
                           color: days <= 0 ? W.orange : W.comment }
                }, days <= 0 ? "vandaag" : `+${days}d`),
                React.createElement("button", {
                  onClick: () => handleUnmark(n.id),
                  title: "Verwijder uit review-lijst",
                  style: { background: "none", border: "none", color: W.fgMuted,
                           cursor: "pointer", fontSize: "14px", padding: "0 2px",
                           flexShrink: 0 }
                }, "×")
              );
            })
      )
    )
  );
};
