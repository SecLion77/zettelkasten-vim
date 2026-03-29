// ── NotesMeta ─────────────────────────────────────────────────────────────────
// Variable module. Read-only metapaneel: ID, tags, links, datum.
// Leest van NoteStore (via props), schrijft niet zelf.
// Props: note, notes, showPanel, onTogglePanel, onSelectNote, onTagRemove

const NotesMeta = ({
  note,
  notes = [],
  showPanel = false,
  onTogglePanel,
  onSelectNote,
  onTagRemove,
  onNoteTypeChange,
}) => {

  // Notitietypen: vluchtig → literatuur → permanent
  const NOTE_TYPES = [
    { id: "",           label: "Geen type",   color: W.fgMuted,  desc: "" },
    { id: "fleeting",   label: "Vluchtig",    color: W.orange,   desc: "Snelle capture, nog verwerken" },
    { id: "literature", label: "Literatuur",  color: W.blue,     desc: "Brongebonden, eigen woorden" },
    { id: "permanent",  label: "Permanent",   color: W.comment,  desc: "Eigen inzicht, atomair" },
    { id: "index",      label: "Index",       color: W.purple,   desc: "Structuurnotitie, navigatie" },
  ];
  if (!note) return null;

  const outLinks = extractLinks(note.content).map(id => {
    const n = notes.find(x => x.id === id || x.title === id);
    return { id, note: n };
  });

  return React.createElement(React.Fragment, null,

    // Smalle toggle-strip
    React.createElement("button", {
      onClick: onTogglePanel,
      title: showPanel ? "Info verbergen" : "Info tonen",
      style: { width: "18px", flexShrink: 0, background: W.bg2,
               borderLeft: `1px solid ${W.splitBg}`,
               border: "none", cursor: "pointer", color: W.fgMuted,
               fontSize: "14px", padding: 0,
               display: "flex", alignItems: "center", justifyContent: "center",
               writingMode: "vertical-rl", letterSpacing: "1px" }
    }, showPanel ? "▶" : "◀"),

    // Paneel inhoud
    showPanel && React.createElement("div", {
      className: "meta-panel",
      style: { width: "178px", flexShrink: 0, background: W.bg2,
               borderLeft: `1px solid ${W.splitBg}`,
               padding: "14px 12px", fontSize: "14px", overflowY: "auto" }
    },
      // ID
      React.createElement("div", {
        style: { color: W.fgMuted, fontSize: "9px", marginBottom: "4px", letterSpacing: "1px" }
      }, "ID"),
      React.createElement("div", {
        style: { color: W.comment, wordBreak: "break-all",
                 marginBottom: "14px", fontSize: "14px" }
      }, note.id),

      // Notitietype
      React.createElement("div", {
        style: { color: W.fgMuted, fontSize: "9px", marginBottom: "6px", letterSpacing: "1px" }
      }, "TYPE"),
      React.createElement("div", {
        style: { display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "14px" }
      },
        NOTE_TYPES.map(({ id, label, color }) =>
          React.createElement("button", {
            key: id,
            onClick: () => onNoteTypeChange?.(id),
            title: NOTE_TYPES.find(t => t.id === id)?.desc || "",
            style: {
              background: (note.noteType || "") === id
                ? `rgba(${color === W.orange ? "229,120,109" : color === W.blue ? "138,198,242" : color === W.comment ? "159,202,86" : color === W.purple ? "215,135,255" : "152,144,135"},0.18)`
                : "transparent",
              border: `1px solid ${(note.noteType || "") === id ? color : W.splitBg}`,
              borderRadius: "4px",
              color: (note.noteType || "") === id ? color : W.fgMuted,
              padding: "3px 8px", fontSize: "10px",
              cursor: "pointer", transition: "all 0.12s",
              fontWeight: (note.noteType || "") === id ? "600" : "400",
            }
          }, label)
        )
      ),

      // Tags
      React.createElement("div", {
        style: { color: W.fgMuted, fontSize: "9px", marginBottom: "6px", letterSpacing: "1px" }
      }, "TAGS"),
      React.createElement("div", {
        style: { display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "10px" }
      },
        ...(note.tags || []).map(t => React.createElement(TagPill, {
          key: t, tag: t,
          onRemove: () => onTagRemove?.(t),
        })),
        !(note.tags || []).length && React.createElement("span", {
          style: { fontSize: "14px", color: W.splitBg }
        }, "geen")
      ),

      // VimEditor sneltoetsen-hint
      React.createElement("div", {
        style: { fontSize: "9px", color: W.splitBg, lineHeight: "2",
                 marginBottom: "14px", padding: "6px 8px",
                 background: "rgba(0,0,0,0.2)", borderRadius: "3px" }
      },
        [":tag naam1 naam2", ":tag+ naam", ":tag- naam",
         ":goyo focus", ":spell en/nl", "Ctrl+J snippet"
        ].map((t, i) => React.createElement("div", {
          key: i, style: { color: W.fgMuted }
        }, t))
      ),

      // Uitgaande links
      outLinks.length > 0 && React.createElement(React.Fragment, null,
        React.createElement("div", {
          style: { color: W.fgMuted, fontSize: "9px",
                   marginBottom: "6px", letterSpacing: "1px" }
        }, "LINKS →"),
        outLinks.map(({ id, note: n }) =>
          React.createElement("div", {
            key: id,
            onClick: () => n && onSelectNote?.(n.id),
            style: { fontSize: "14px",
                     color: n ? W.keyword : W.fgMuted,
                     cursor: n ? "pointer" : "default",
                     padding: "3px 0",
                     borderBottom: `1px solid ${W.splitBg}`,
                     marginBottom: "2px" }
          }, "→ ", n ? n.title : id)
        )
      ),

      // Gewijzigd
      React.createElement("div", {
        style: { marginTop: "14px", color: W.fgMuted,
                 fontSize: "9px", letterSpacing: "1px", marginBottom: "4px" }
      }, "GEWIJZIGD"),
      React.createElement("div", { style: { fontSize: "14px", color: W.fgDim } },
        note.modified
          ? new Date(note.modified).toLocaleString("nl-NL")
          : "—"
      )
    )
  );
};
