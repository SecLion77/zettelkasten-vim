// ── StatsPanel ────────────────────────────────────────────────────────────────
// Statistieken-dashboard voor de vault.
// Props: notes[], serverPdfs[], serverImages[]

const StatsPanel = ({ notes = [], serverPdfs = [], serverImages = [] }) => {
  const { useMemo, useState, useEffect } = React;
  const [tab, setTab] = useState("overzicht");
  const [cleanupMsg, setCleanupMsg] = useState("");
  const [disk, setDisk] = useState(null);

  // Laad disk-gebruik bij openen
  useEffect(() => {
    fetch("/api/disk-usage")
      .then(r => r.json())
      .then(d => { if (d.ok) setDisk(d); })
      .catch(() => {});
  }, []);

  const fmtBytes = (b) => {
    if (b === undefined || b === null) return "–";
    if (b < 1024)           return b + " B";
    if (b < 1024 * 1024)    return (b / 1024).toFixed(1) + " KB";
    if (b < 1024**3)        return (b / 1024**2).toFixed(1) + " MB";
    return (b / 1024**3).toFixed(2) + " GB";
  };

  const stats = useMemo(() => {
    const now     = Date.now();
    const dayMs   = 86400000;
    const weekMs  = 7 * dayMs;
    const monthMs = 30 * dayMs;

    // Basistellingen
    const total       = notes.length;
    const withLinks   = notes.filter(n => /\[\[/.test(n.content||"")).length;
    const orphans     = notes.filter(n => {
      const hasOut = /\[\[/.test(n.content||"");
      const hasIn  = notes.some(m => m.id !== n.id &&
        (m.content||"").includes(`[[${n.title}]]`));
      return !hasOut && !hasIn;
    }).length;
    const withTags    = notes.filter(n => (n.tags||[]).length > 0).length;
    const imported    = notes.filter(n => n.importedAt).length;
    const dailyNotes  = notes.filter(n => (n.tags||[]).includes("dagnotitie")).length;

    // Woorden totaal
    const totalWords  = notes.reduce((sum, n) =>
      sum + ((n.content||"").trim().split(/\s+/).filter(Boolean).length), 0);

    // Groei per periode
    const createdThisWeek  = notes.filter(n =>
      now - new Date(n.created||0).getTime() < weekMs).length;
    const createdThisMonth = notes.filter(n =>
      now - new Date(n.created||0).getTime() < monthMs).length;

    // Notities per week (laatste 8 weken)
    const weeklyData = Array.from({length: 8}, (_, i) => {
      const weekStart = now - (i + 1) * weekMs;
      const weekEnd   = now - i * weekMs;
      const count = notes.filter(n => {
        const t = new Date(n.created||0).getTime();
        return t >= weekStart && t < weekEnd;
      }).length;
      const d = new Date(now - i * weekMs);
      const label = `${String(d.getDate()).padStart(2,"0")}-${String(d.getMonth()+1).padStart(2,"0")}`;
      return { label, count };
    }).reverse();

    // Top tags
    const tagCounts = {};
    notes.forEach(n => (n.tags||[]).forEach(t => {
      tagCounts[t] = (tagCounts[t]||0) + 1;
    }));
    const topTags = Object.entries(tagCounts)
      .sort((a,b) => b[1]-a[1])
      .slice(0, 12);

    // Langste notities
    const longest = [...notes]
      .map(n => ({ ...n, wc: (n.content||"").trim().split(/\s+/).filter(Boolean).length }))
      .sort((a,b) => b.wc - a.wc)
      .slice(0, 5);

    // Meest gelinkte notities (meeste backlinks)
    const linkCounts = {};
    notes.forEach(n => {
      const matches = [...(n.content||"").matchAll(/\[\[([^\]]+)\]\]/g)];
      matches.forEach(m => {
        const target = notes.find(x => x.title === m[1] || x.id === m[1]);
        if (target) linkCounts[target.id] = (linkCounts[target.id]||0) + 1;
      });
    });
    const mostLinked = Object.entries(linkCounts)
      .sort((a,b) => b[1]-a[1])
      .slice(0,5)
      .map(([id, cnt]) => ({ note: notes.find(n=>n.id===id), cnt }))
      .filter(x => x.note);

    return {
      total, withLinks, orphans, withTags, imported, dailyNotes,
      totalWords, createdThisWeek, createdThisMonth,
      weeklyData, topTags, longest, mostLinked,
      pdfCount: serverPdfs.length,
      imgCount: serverImages.length,
      linkPct: total ? Math.round(withLinks/total*100) : 0,
      tagPct:  total ? Math.round(withTags/total*100)  : 0,
    };
  }, [notes, serverPdfs, serverImages]);

  // ── Stijlen ──────────────────────────────────────────────────────────────
  const card = (children, style={}) =>
    React.createElement("div", {
      style: {
        background: W.bg2, border: `1px solid ${W.splitBg}`,
        borderRadius: "8px", padding: "14px 16px",
        ...style
      }
    }, ...children);

  const statNum = (val, label, color=W.blue, sub=null) =>
    React.createElement("div", {
      style: { textAlign: "center", padding: "8px 4px" }
    },
      React.createElement("div", {
        style: { fontSize: "28px", fontWeight: "bold", color, lineHeight: 1 }
      }, val),
      React.createElement("div", {
        style: { fontSize: "11px", color: W.fgMuted, marginTop: "4px",
                 letterSpacing: "0.5px" }
      }, label),
      sub && React.createElement("div", {
        style: { fontSize: "10px", color: W.fgDim, marginTop: "2px" }
      }, sub)
    );

  const tabBtn = (id, label) =>
    React.createElement("button", {
      onClick: () => setTab(id),
      style: {
        padding: "5px 14px", borderRadius: "6px", fontSize: "12px",
        border: "none", cursor: "pointer", fontWeight: tab===id ? "700" : "400",
        background: tab===id ? W.blue : "transparent",
        color:       tab===id ? W.bg   : W.fgMuted,
        transition: "all 0.15s",
      }
    }, label);

  // Mini staafdiagram
  const barChart = (data, colorFn) => {
    const max = Math.max(...data.map(d => d.count), 1);
    return React.createElement("div", {
      style: { display: "flex", alignItems: "flex-end", gap: "4px",
               height: "60px", padding: "0 4px" }
    },
      data.map((d, i) =>
        React.createElement("div", { key: i, style: { flex: 1, display: "flex",
          flexDirection: "column", alignItems: "center", gap: "2px" } },
          React.createElement("div", {
            title: `${d.label}: ${d.count}`,
            style: {
              width: "100%",
              height: `${Math.max(2, Math.round(d.count/max*52))}px`,
              background: colorFn ? colorFn(d, i) : W.blue,
              borderRadius: "2px 2px 0 0",
              transition: "height 0.3s",
            }
          }),
          React.createElement("div", {
            style: { fontSize: "8px", color: W.fgDim, transform: "rotate(-45deg)",
                     transformOrigin: "top center", marginTop: "4px",
                     whiteSpace: "nowrap" }
          }, d.label)
        )
      )
    );
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────
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
      React.createElement("span", { style: { fontSize: "18px" } }, "📊"),
      React.createElement("span", {
        style: { fontSize: "13px", fontWeight: "700", color: W.statusFg,
                 letterSpacing: "1px" }
      }, "VAULT STATISTIEKEN"),
      React.createElement("div", { style: { flex: 1 } }),
      tabBtn("overzicht", "Overzicht"),
      tabBtn("groei",     "Groei"),
      tabBtn("tags",      "Tags"),
      tabBtn("top",       "Top notities"),
      tabBtn("opslag",    "💾 Opslag"),
    ),

    // Scroll body
    React.createElement("div", {
      style: { flex: 1, overflowY: "auto", padding: "16px",
               WebkitOverflowScrolling: "touch" }
    },

      // ── Overzicht tab ────────────────────────────────────────────────────
      tab === "overzicht" && React.createElement("div", {
        style: { display: "flex", flexDirection: "column", gap: "12px" }
      },
        // Grote nummers
        card([
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "10px", fontWeight: "600" }
          }, "INHOUD"),
          React.createElement("div", {
            style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }
          },
            statNum(stats.total,     "notities",    W.blue),
            statNum(stats.pdfCount,  "PDFs",         W.yellow),
            statNum(stats.imgCount,  "afbeeldingen", W.comment),
            statNum(Math.round(stats.totalWords/1000)+"K", "woorden", W.purple),
          )
        ]),

        // Verbindingen
        card([
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "10px", fontWeight: "600" }
          }, "VERBINDINGEN"),
          React.createElement("div", {
            style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }
          },
            statNum(stats.withLinks, "gelinkt",      W.blue,    `${stats.linkPct}%`),
            statNum(stats.orphans,   "eilanden",      W.orange,  "geen links"),
            statNum(stats.withTags,  "met tags",      W.comment, `${stats.tagPct}%`),
            statNum(stats.imported,  "geïmporteerd",  W.purple),
          )
        ]),

        // Voortgangsbalkjes
        card([
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "12px", fontWeight: "600" }
          }, "KWALITEIT"),
          ...[
            { label: "Notities met links",     pct: stats.linkPct, color: W.blue },
            { label: "Notities met tags",      pct: stats.tagPct,  color: W.comment },
            { label: "Gedocumenteerde vault",  pct: Math.round((1 - stats.orphans/Math.max(stats.total,1))*100), color: W.purple },
          ].map(({ label, pct, color }) =>
            React.createElement("div", { key: label, style: { marginBottom: "10px" } },
              React.createElement("div", {
                style: { display: "flex", justifyContent: "space-between",
                         fontSize: "12px", marginBottom: "4px" }
              },
                React.createElement("span", { style: { color: W.fg } }, label),
                React.createElement("span", { style: { color, fontWeight: "bold" } }, pct + "%")
              ),
              React.createElement("div", {
                style: { height: "6px", background: "rgba(255,255,255,0.07)",
                         borderRadius: "3px", overflow: "hidden" }
              },
                React.createElement("div", {
                  style: { width: pct + "%", height: "100%", background: color,
                           borderRadius: "3px", transition: "width 0.6s ease" }
                })
              )
            )
          )
        ])
        ,

        // ── Vault opschonen ─────────────────────────────────────────────────
        React.createElement("div", {
          style: { background: W.bg2, borderRadius: "8px", padding: "16px",
                   border: `1px solid ${W.splitBg}` }
        },
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "10px", fontWeight: "600" }
          }, "🧹 VAULT OPSCHONEN"),
          React.createElement("div", {
            style: { fontSize: "12px", color: W.fgMuted, marginBottom: "12px", lineHeight: "1.6" }
          }, "Verwijdert CSS-opmaakrommel uit bestaande notities."),
          cleanupMsg ? React.createElement("div", {
            style: { fontSize: "13px", marginBottom: "8px",
                     color: cleanupMsg.startsWith("✓") ? W.comment : W.orange }
          }, cleanupMsg) : null,
          React.createElement("button", {
            onClick: async () => {
              setCleanupMsg("⏳ Bezig…");
              try {
                const res = await fetch("/api/cleanup-vault", {
                  method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
                const d = await res.json();
                if (d.ok) setCleanupMsg("✓ " + d.cleaned + " opgeschoond, " + d.skipped + " al schoon");
                else setCleanupMsg("✗ " + (d.error || "onbekend"));
              } catch(e) { setCleanupMsg("✗ Verbindingsfout"); }
            },
            disabled: cleanupMsg === "⏳ Bezig…",
            style: { padding: "8px 18px", borderRadius: "6px", border: "none",
                     background: "rgba(229,120,109,0.15)", color: W.orange,
                     cursor: "pointer", fontSize: "13px", fontWeight: "600" }
          }, "🧹 Vault opschonen")
        )
      ),

      // ── Groei tab ────────────────────────────────────────────────────────
      tab === "groei" && React.createElement("div", {
        style: { display: "flex", flexDirection: "column", gap: "12px" }
      },
        card([
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "10px", fontWeight: "600" }
          }, "AANGEMAAKT"),
          React.createElement("div", {
            style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
                     marginBottom: "16px" }
          },
            statNum(stats.createdThisWeek,  "deze week",  W.comment),
            statNum(stats.createdThisMonth, "deze maand", W.blue),
          ),
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "8px" }
          }, "NOTITIES PER WEEK (laatste 8 weken)"),
          barChart(stats.weeklyData, (d) =>
            d.count === 0 ? "rgba(255,255,255,0.06)"
            : `rgba(138,198,242,${0.3 + Math.min(1, d.count/5) * 0.7})`
          ),
        ]),
        card([
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "10px", fontWeight: "600" }
          }, "DAGNOTITIES"),
          statNum(stats.dailyNotes, "dagnotities aangemaakt", W.yellow),
        ]),
      ),

      // ── Tags tab ─────────────────────────────────────────────────────────
      tab === "tags" && card([
        React.createElement("div", {
          style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                   marginBottom: "12px", fontWeight: "600" }
        }, `TOP ${stats.topTags.length} TAGS`),
        ...stats.topTags.map(([tag, cnt], i) => {
          const maxCnt = stats.topTags[0]?.[1] || 1;
          const pct    = Math.round(cnt / maxCnt * 100);
          const colors = [W.blue, W.comment, W.purple, W.yellow, W.orange];
          const color  = colors[i % colors.length];
          return React.createElement("div", {
            key: tag,
            style: { display: "flex", alignItems: "center", gap: "10px",
                     marginBottom: "8px" }
          },
            React.createElement("span", {
              style: { fontSize: "12px", color: W.comment,
                       background: "rgba(159,202,86,0.1)",
                       borderRadius: "3px", padding: "1px 6px",
                       minWidth: "100px", textAlign: "right" }
            }, "#" + tag),
            React.createElement("div", {
              style: { flex: 1, height: "8px", background: "rgba(255,255,255,0.06)",
                       borderRadius: "4px", overflow: "hidden" }
            },
              React.createElement("div", {
                style: { width: pct + "%", height: "100%",
                         background: color, borderRadius: "4px",
                         transition: "width 0.5s ease" }
              })
            ),
            React.createElement("span", {
              style: { fontSize: "12px", color: W.fgMuted,
                       minWidth: "24px", textAlign: "right" }
            }, cnt)
          );
        })
      ]),

      // ── Top notities tab ─────────────────────────────────────────────────
      tab === "top" && React.createElement("div", {
        style: { display: "flex", flexDirection: "column", gap: "12px" }
      },
        card([
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "10px", fontWeight: "600" }
          }, "MEEST GELINKT (backlinks)"),
          ...stats.mostLinked.map(({ note, cnt }) =>
            React.createElement("div", { key: note.id,
              style: { display: "flex", alignItems: "center", gap: "8px",
                       padding: "6px 0", borderBottom: `1px solid ${W.splitBg}` }
            },
              React.createElement("span", {
                style: { fontSize: "10px", color: W.blue,
                         background: "rgba(138,198,242,0.12)",
                         borderRadius: "10px", padding: "1px 8px",
                         flexShrink: 0, fontWeight: "bold" }
              }, cnt + "×"),
              React.createElement("span", {
                style: { fontSize: "13px", color: W.fg,
                         overflow: "hidden", textOverflow: "ellipsis",
                         whiteSpace: "nowrap" }
              }, note.title || note.id)
            )
          )
        ]),
        card([
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "10px", fontWeight: "600" }
          }, "LANGSTE NOTITIES"),
          ...stats.longest.map((n) =>
            React.createElement("div", { key: n.id,
              style: { display: "flex", alignItems: "center", gap: "8px",
                       padding: "6px 0", borderBottom: `1px solid ${W.splitBg}` }
            },
              React.createElement("span", {
                style: { fontSize: "10px", color: W.purple,
                         background: "rgba(215,135,255,0.12)",
                         borderRadius: "10px", padding: "1px 8px",
                         flexShrink: 0, fontWeight: "bold" }
              }, n.wc + " w"),
              React.createElement("span", {
                style: { fontSize: "13px", color: W.fg,
                         overflow: "hidden", textOverflow: "ellipsis",
                         whiteSpace: "nowrap" }
              }, n.title || n.id)
            )
          )
        ]),
        card([
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "10px", fontWeight: "600" }
          }, `${stats.orphans} EILANDEN (geen in- of uitlinks)`),
          stats.orphans === 0
            ? React.createElement("div", {
                style: { fontSize: "13px", color: W.comment }
              }, "✓ Alle notities zijn verbonden!")
            : React.createElement("div", {
                style: { fontSize: "12px", color: W.orange }
              }, `${stats.orphans} notities hebben nog geen links. Gebruik de Links-sidebar om ze te verbinden.`)
        ]),

        // ── Vault opschonen ───────────────────────────────────────────────────
        card([
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "10px", fontWeight: "600" }
          }, "🧹 VAULT OPSCHONEN"),
          React.createElement("div", {
            style: { fontSize: "12px", color: W.fgMuted, marginBottom: "12px", lineHeight: "1.6" }
          }, "Verwijdert CSS-rommel (inline stijlen) die door lokale AI-modellen in notities zijn ingevoegd. " +
             "Bestaande notitie-inhoud blijft ongewijzigd."),
          cleanupMsg
            ? React.createElement("div", {
                style: { fontSize: "13px",
                         color: cleanupMsg.startsWith("✓") ? W.comment : W.orange,
                         marginBottom: "8px" }
              }, cleanupMsg)
            : null,
          React.createElement("button", {
            onClick: async () => {
              setCleanupMsg("⏳ Bezig…");
              try {
                const r = await fetch("/api/cleanup-vault", { method: "POST",
                  headers: { "Content-Type": "application/json" }, body: "{}" });
                const d = await r.json();
                if (d.ok) {
                  setCleanupMsg(`✓ ${d.cleaned} notities opgeschoond, ${d.skipped} al schoon`);
                } else {
                  setCleanupMsg("✗ Fout: " + (d.error || "onbekend"));
                }
              } catch(e) { setCleanupMsg("✗ Verbindingsfout"); }
            },
            disabled: cleanupMsg === "⏳ Bezig…",
            style: {
              padding: "8px 18px", borderRadius: "6px", border: "none",
              background: "rgba(229,120,109,0.15)", color: W.orange,
              cursor: "pointer", fontSize: "13px", fontWeight: "600"
            }
          }, "🧹 Vault opschonen")
        ])
      )
,

      // ── Opslag tab ──────────────────────────────────────────────────────────
      tab === "opslag" && React.createElement("div", {
        style: { display: "flex", flexDirection: "column", gap: "12px" }
      },

        // Vault breakdown
        card([
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "14px", fontWeight: "600" }
          }, "💾 VAULT OPSLAG"),

          disk === null
            ? React.createElement("div", {
                style: { fontSize: "13px", color: W.fgMuted, padding: "8px 0" }
              }, "⏳ Laden…")
            : React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },

                // Totaal vault
                React.createElement("div", {
                  style: { display: "flex", justifyContent: "space-between",
                           alignItems: "center", padding: "6px 0",
                           borderBottom: `1px solid ${W.splitBg}` }
                },
                  React.createElement("span", { style: { fontSize: "13px", color: W.fg, fontWeight: "600" } },
                    "Totaal vault"),
                  React.createElement("span", { style: { fontSize: "15px", fontWeight: "700", color: W.blue } },
                    fmtBytes(disk.vault_total))
                ),

                // Per categorie met balk
                ...[
                  { label: "📝 Notities",     bytes: disk.notes,       color: W.blue    },
                  { label: "📄 PDFs",          bytes: disk.pdfs,        color: W.yellow  },
                  { label: "🖼 Afbeeldingen",  bytes: disk.images,      color: W.comment },
                  { label: "📌 Annotaties",    bytes: disk.annotations, color: W.purple  },
                ].map(({ label, bytes, color }) => {
                  const pct = disk.vault_total > 0
                    ? Math.round(bytes / disk.vault_total * 100) : 0;
                  return React.createElement("div", { key: label },
                    React.createElement("div", {
                      style: { display: "flex", justifyContent: "space-between",
                               fontSize: "12px", marginBottom: "4px" }
                    },
                      React.createElement("span", { style: { color: W.fg } }, label),
                      React.createElement("span", { style: { color, fontWeight: "600" } },
                        fmtBytes(bytes) + "  " + pct + "%")
                    ),
                    React.createElement("div", {
                      style: { height: "5px", background: "rgba(255,255,255,0.07)",
                               borderRadius: "3px", overflow: "hidden" }
                    },
                      React.createElement("div", {
                        style: { width: pct + "%", height: "100%", background: color,
                                 borderRadius: "3px", transition: "width 0.5s ease" }
                      })
                    )
                  );
                })
              )
        ]),

        // Schijfruimte systeem
        disk && disk.disk_total > 0 && card([
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                     marginBottom: "14px", fontWeight: "600" }
          }, "💿 SCHIJFRUIMTE"),

          React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } },

            // Grote getallen
            React.createElement("div", {
              style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px",
                       marginBottom: "12px" }
            },
              statNum(fmtBytes(disk.disk_total), "totaal",    W.fgMuted),
              statNum(fmtBytes(disk.disk_used),  "gebruikt",  W.orange),
              statNum(fmtBytes(disk.disk_free),  "vrij",      W.comment),
            ),

            // Gebruik balk
            React.createElement("div", null,
              React.createElement("div", {
                style: { display: "flex", justifyContent: "space-between",
                         fontSize: "11px", color: W.fgMuted, marginBottom: "5px" }
              },
                React.createElement("span", null, "Schijfgebruik"),
                React.createElement("span", { style: { color: W.orange, fontWeight: "600" } },
                  Math.round(disk.disk_used / disk.disk_total * 100) + "%")
              ),
              React.createElement("div", {
                style: { height: "8px", background: "rgba(255,255,255,0.07)",
                         borderRadius: "4px", overflow: "hidden" }
              },
                React.createElement("div", {
                  style: {
                    width: Math.round(disk.disk_used / disk.disk_total * 100) + "%",
                    height: "100%",
                    background: disk.disk_used / disk.disk_total > 0.9 ? W.orange
                              : disk.disk_used / disk.disk_total > 0.7 ? W.yellow : W.comment,
                    borderRadius: "4px",
                    transition: "width 0.6s ease"
                  }
                })
              )
            ),

            // Vault als % van totale schijf
            React.createElement("div", {
              style: { fontSize: "11px", color: W.fgDim, marginTop: "4px",
                       textAlign: "right", fontStyle: "italic" }
            },
              `Vault gebruikt ${((disk.vault_total / disk.disk_total) * 100).toFixed(3)}% van de schijf`)
          )
        ]),

        // Refresh knop
        React.createElement("button", {
          onClick: () => {
            setDisk(null);
            fetch("/api/disk-usage").then(r=>r.json())
              .then(d => { if(d.ok) setDisk(d); }).catch(()=>{});
          },
          style: {
            alignSelf: "flex-start", padding: "6px 16px",
            background: "rgba(138,198,242,0.08)",
            border: "1px solid rgba(138,198,242,0.2)",
            color: W.blue, borderRadius: "6px",
            fontSize: "12px", cursor: "pointer"
          }
        }, "↻ Vernieuwen")
      )
    )
  );
};
