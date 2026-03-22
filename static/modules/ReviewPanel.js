// ── ReviewPanel ───────────────────────────────────────────────────────────────
// Lichte spaced repetition: markeer notities voor review, zie ze terug op tijd.
// Geen flashcard-systeem — gewoon "revisit" vlaggen op notities.
// Opslag in vault/config.json via /api/config

const ReviewPanel = ({ notes = [], onOpenNote, onUpdateNote }) => {
  const { useState, useEffect, useMemo } = React;
  const [reviewData, setReviewData] = useState({}); // { noteId: { lastReview, interval, due } }
  const [loading, setLoading]       = useState(true);
  const [current, setCurrent]       = useState(null); // huidige notitie in review
  const [done, setDone]             = useState({});   // { id: bool } — al behandeld in sessie

  // Laad review-data uit config
  useEffect(() => {
    fetch("/api/config")
      .then(r => r.json())
      .then(d => {
        setReviewData(d.config?.review_data || {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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

  const today = new Date().toISOString().slice(0, 10);

  // Notities die vandaag aan de beurt zijn
  const dueNotes = useMemo(() => {
    return notes.filter(n => {
      const rd = reviewData[n.id];
      if (!rd) return false; // niet gemarkeerd
      return !rd.due || rd.due <= today;
    }).filter(n => !done[n.id]);
  }, [notes, reviewData, today, done]);

  // Alle gemarkeerde notities
  const markedNotes = useMemo(() =>
    notes.filter(n => reviewData[n.id]),
    [notes, reviewData]
  );

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
          onClick: () => setCurrent(null),
          style: { background: "none", border: "none", color: W.fgMuted,
                   cursor: "pointer", fontSize: "16px", padding: "0 4px" }
        }, "←"),
        React.createElement("span", {
          style: { fontSize: "13px", color: W.fgMuted }
        }, `Review ${dueNotes.indexOf(note) + 1} / ${dueNotes.length + Object.keys(done).length}`),
        React.createElement("div", { style: { flex: 1 } }),
        React.createElement("button", {
          onClick: () => onOpenNote?.(note.id),
          style: { background: "none", border: `1px solid ${W.splitBg}`,
                   borderRadius: "5px", color: W.blue,
                   cursor: "pointer", fontSize: "12px", padding: "4px 10px" }
        }, "→ Open in editor"),
      ),
      // Notitie-inhoud
      React.createElement("div", {
        style: { flex: 1, overflowY: "auto", padding: "20px 24px",
                 WebkitOverflowScrolling: "touch" }
      },
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
                   whiteSpace: "pre-wrap", fontFamily: "inherit" }
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
    // Header
    React.createElement("div", {
      style: { background: W.bg2, borderBottom: `1px solid ${W.splitBg}`,
               padding: "10px 16px", flexShrink: 0,
               display: "flex", alignItems: "center", gap: "8px" }
    },
      React.createElement("span", { style: { fontSize: "18px" } }, "🔁"),
      React.createElement("span", {
        style: { fontSize: "13px", fontWeight: "700", color: W.statusFg,
                 letterSpacing: "1px" }
      }, "REVIEW"),
      dueNotes.length > 0 && React.createElement("span", {
        style: { background: W.orange, color: W.bg, borderRadius: "10px",
                 padding: "1px 8px", fontSize: "12px", fontWeight: "bold" }
      }, dueNotes.length),
    ),

    React.createElement("div", {
      style: { flex: 1, overflowY: "auto", padding: "16px",
               WebkitOverflowScrolling: "touch" }
    },

      // Vandaag te reviewen
      dueNotes.length > 0 && React.createElement("div", {
        style: { background: "rgba(234,231,136,0.07)",
                 border: `1px solid rgba(234,231,136,0.2)`,
                 borderRadius: "8px", padding: "14px 16px", marginBottom: "16px" }
      },
        React.createElement("div", {
          style: { fontSize: "11px", color: W.yellow, letterSpacing: "1px",
                   fontWeight: "600", marginBottom: "10px" }
        }, `📅 VANDAAG TE REVIEWEN — ${dueNotes.length} notities`),
        React.createElement("button", {
          onClick: () => setCurrent(dueNotes[0]?.id),
          style: { background: W.yellow, color: W.bg, border: "none",
                   borderRadius: "7px", padding: "10px 24px",
                   fontSize: "14px", cursor: "pointer", fontWeight: "bold",
                   width: "100%", marginBottom: "10px" }
        }, `▶ Start review sessie`),
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
          style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                   fontWeight: "600", marginBottom: "10px" }
        }, `GEMARKEERD VOOR REVIEW — ${markedNotes.length} notities`),
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
                             overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
                  }, n.title || n.id),
                  React.createElement("div", {
                    style: { fontSize: "10px", color: W.fgMuted, marginTop: "2px" }
                  }, rd?.lastReview ? `Laatste review: ${rd.lastReview} · interval: ${rd.interval}d` : "Nieuw")
                ),
                React.createElement("span", {
                  style: { fontSize: "10px", flexShrink: 0, borderRadius: "10px",
                           padding: "2px 7px", fontWeight: "bold",
                           background: days <= 0 ? "rgba(229,120,109,0.15)" : "rgba(159,202,86,0.12)",
                           color:       days <= 0 ? W.orange : W.comment }
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
