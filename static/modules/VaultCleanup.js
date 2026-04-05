// ── VaultCleanup ──────────────────────────────────────────────────────────────
// Beheer → Opschonen tab
// Centraliseert alle vault-onderhoudsfuncties op één logische plek.
// Props: notes, onUpdateNote, onDeleteNote, onNotesChange

const VaultCleanup = ({ notes = [], onUpdateNote, onDeleteNote, onNotesChange }) => {
  const { useState, useCallback } = React;

  const [brokenMsg,  setBrokenMsg]  = useState("");
  const [emptyMsg,   setEmptyMsg]   = useState("");
  const [orphanMsg,  setOrphanMsg]  = useState("");
  const [cssMsg,     setCssMsg]     = useState("");
  const [dailyMsg,   setDailyMsg]   = useState("");

  // ── Helpers ────────────────────────────────────────────────────────────────
  const flash = (setter, msg, ms = 4000) => {
    setter(msg);
    setTimeout(() => setter(""), ms);
  };

  const extractLinks = (content) => {
    const matches = [];
    const re = /\[\[([^\]]+)\]\]/g;
    let m;
    while ((m = re.exec(content)) !== null) matches.push(m[1]);
    return matches;
  };

  // ── 1. Gebroken links opruimen ─────────────────────────────────────────────
  const cleanupBrokenLinks = useCallback(async () => {
    if (!onUpdateNote) return;
    const noteIds = new Set(notes.map(n => n.id));
    let fixed = 0;
    for (const note of notes) {
      const links = extractLinks(note.content || "");
      const broken = links.filter(lid => !noteIds.has(lid));
      if (!broken.length) continue;
      let newContent = note.content;
      broken.forEach(lid => {
        newContent = newContent.replace(new RegExp(`\\[\\[${lid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\]`, 'g'), '');
      });
      await onUpdateNote({ ...note, content: newContent, modified: new Date().toISOString() });
      fixed += broken.length;
    }
    flash(setBrokenMsg, fixed > 0 ? `✓ ${fixed} gebroken link${fixed !== 1 ? "s" : ""} verwijderd` : "✓ Geen gebroken links gevonden");
  }, [notes, onUpdateNote]);

  // ── 2. Lege notities verwijderen ───────────────────────────────────────────
  const cleanupEmptyNotes = useCallback(async () => {
    if (!onDeleteNote) return;
    const isEmpty = n => {
      const t = (n.title || "").trim();
      const c = (n.content || "").replace(/^[-\s*#]+$/gm, "").trim();
      return !t && !c;
    };
    const empty = notes.filter(isEmpty);
    if (!empty.length) { flash(setEmptyMsg, "✓ Geen lege notities gevonden"); return; }
    if (!emptyMsg.startsWith("⚠")) {
      setEmptyMsg(`⚠ ${empty.length} lege notitie${empty.length !== 1 ? "s" : ""} — klik nogmaals om te verwijderen`);
      return;
    }
    let deleted = 0;
    for (const note of empty) {
      try {
        await fetch(`/api/notes/${encodeURIComponent(note.id)}`, { method: "DELETE" });
        onDeleteNote?.(note.id);
        deleted++;
      } catch {}
    }
    flash(setEmptyMsg, `✓ ${deleted} lege notitie${deleted !== 1 ? "s" : ""} verwijderd`);
    onNotesChange?.();
  }, [notes, emptyMsg, onDeleteNote, onNotesChange]);

  // ── 3. Wezen-notities verwijderen ──────────────────────────────────────────
  const cleanupOrphans = useCallback(async () => {
    if (!onDeleteNote) return;
    const noteIds   = new Set(notes.map(n => n.id));
    const linkedIds = new Set(notes.flatMap(n => extractLinks(n.content || "").filter(id => noteIds.has(id))));
    const orphans   = notes.filter(n =>
      extractLinks(n.content || "").filter(id => noteIds.has(id)).length === 0 &&
      !linkedIds.has(n.id)
    );
    if (!orphans.length) { flash(setOrphanMsg, "✓ Geen wezen-notities gevonden"); return; }
    if (!orphanMsg.startsWith("⚠")) {
      setOrphanMsg(`⚠ ${orphans.length} wezen-notitie${orphans.length !== 1 ? "s" : ""} — klik nogmaals`);
      return;
    }
    let deleted = 0;
    for (const note of orphans) {
      try {
        await fetch(`/api/notes/${encodeURIComponent(note.id)}`, { method: "DELETE" });
        onDeleteNote?.(note.id);
        deleted++;
      } catch {}
    }
    flash(setOrphanMsg, `✓ ${deleted} wezen-notitie${deleted !== 1 ? "s" : ""} verwijderd`);
    onNotesChange?.();
  }, [notes, orphanMsg, onDeleteNote, onNotesChange]);

  // ── 4. CSS-rommel opschonen ────────────────────────────────────────────────
  const cleanupCss = useCallback(async () => {
    setCssMsg("⏳ Bezig…");
    try {
      const res  = await fetch("/api/cleanup-vault", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await res.json();
      if (data.ok) {
        const n = data.cleaned || 0;
        flash(setCssMsg, n > 0 ? `✓ ${n} notitie${n !== 1 ? "s" : ""} opgeschoond` : "✓ Geen CSS-rommel gevonden", 5000);
        if (n > 0) onNotesChange?.();
      } else {
        flash(setCssMsg, "⚠ " + (data.error || "Mislukt"));
      }
    } catch (e) {
      flash(setCssMsg, "⚠ Verbindingsfout: " + e.message);
    }
  }, [onNotesChange]);

  // ── 5. Dubbele dagnotities samenvoegen ─────────────────────────────────────
  const cleanupDuplicateDailyNotes = useCallback(async () => {
    const dailyNotes = notes.filter(n => (n.tags || []).includes("dagnotitie") || (n.tags || []).includes("daily"));
    // Groepeer op datum (eerste 10 tekens van created of title)
    const byDate = {};
    dailyNotes.forEach(n => {
      const key = (n.title || "").slice(0, 20) || (n.created || "").slice(0, 10);
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(n);
    });
    const dupes = Object.values(byDate).filter(g => g.length > 1);
    if (!dupes.length) { flash(setDailyMsg, "✓ Geen dubbele dagnotities"); return; }
    flash(setDailyMsg, `ℹ ${dupes.length} dag${dupes.length !== 1 ? "en" : ""} met meerdere notities — bekijk ze handmatig`);
  }, [notes]);

  // ── UI helper ─────────────────────────────────────────────────────────────
  const CleanupRow = ({ icon, title, desc, msg, onClick, danger = true }) => {
    const isOk   = msg.startsWith("✓");
    const isWarn = msg.startsWith("⚠") || msg.startsWith("ℹ");
    const isBusy = msg.startsWith("⏳");
    return React.createElement("div", {
      style: {
        background: W.bg2, border: `1px solid ${W.splitBg}`,
        borderRadius: "8px", padding: "14px 16px",
      }
    },
      React.createElement("div", {
        style: { display: "flex", alignItems: "flex-start", gap: "12px" }
      },
        // Icoon
        React.createElement("div", {
          style: { fontSize: "20px", flexShrink: 0, marginTop: "1px" }
        }, icon),

        // Tekst
        React.createElement("div", { style: { flex: 1, minWidth: 0 } },
          React.createElement("div", {
            style: { fontSize: "13px", fontWeight: "600", color: W.fg, marginBottom: "3px" }
          }, title),
          React.createElement("div", {
            style: { fontSize: "11px", color: W.fgMuted, lineHeight: "1.6", marginBottom: msg ? "8px" : "0" }
          }, desc),
          msg && React.createElement("div", {
            style: {
              fontSize: "12px", fontWeight: "500",
              color: isOk ? W.comment : isWarn ? W.yellow : W.blue,
            }
          }, msg)
        ),

        // Knop
        React.createElement("button", {
          onClick, disabled: isBusy,
          style: {
            flexShrink: 0,
            background: isOk
              ? "rgba(166,209,137,0.1)"
              : danger ? "rgba(229,120,109,0.1)" : "rgba(125,216,198,0.1)",
            border: `1px solid ${isOk
              ? "rgba(166,209,137,0.3)"
              : danger ? "rgba(229,120,109,0.3)" : "rgba(125,216,198,0.3)"}`,
            borderRadius: "6px",
            color: isOk ? W.comment : danger ? W.orange : W.blue,
            padding: "6px 14px", fontSize: "12px",
            cursor: isBusy ? "default" : "pointer",
            fontWeight: "600", opacity: isBusy ? 0.6 : 1,
            transition: "all .12s",
          }
        }, isBusy ? "⏳ Bezig…" : isWarn ? "Bevestigen" : "Uitvoeren")
      )
    );
  };

  // ── Statistieken bovenaan ──────────────────────────────────────────────────
  const noteIds   = new Set(notes.map(n => n.id));
  const linkedIds = new Set(notes.flatMap(n => extractLinks(n.content || "").filter(id => noteIds.has(id))));
  const orphanCount = notes.filter(n =>
    extractLinks(n.content || "").filter(id => noteIds.has(id)).length === 0 &&
    !linkedIds.has(n.id)
  ).length;
  const emptyCount = notes.filter(n =>
    !(n.title || "").trim() && !(n.content || "").replace(/^[-\s*#]+$/gm, "").trim()
  ).length;
  const brokenCount = notes.reduce((acc, n) => {
    return acc + extractLinks(n.content || "").filter(lid => !noteIds.has(lid)).length;
  }, 0);

  return React.createElement("div", {
    style: { flex: 1, overflowY: "auto", padding: "20px", WebkitOverflowScrolling: "touch" }
  },

    // Samenvatting chips
    React.createElement("div", {
      style: { display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }
    },
      [
        { label: "Notities", value: notes.length, color: W.blue },
        { label: "Gebroken links", value: brokenCount, color: brokenCount > 0 ? W.orange : W.comment },
        { label: "Leeg", value: emptyCount, color: emptyCount > 0 ? W.orange : W.comment },
        { label: "Wezen", value: orphanCount, color: orphanCount > 0 ? W.yellow : W.comment },
      ].map(({ label, value, color }) =>
        React.createElement("div", {
          key: label,
          style: {
            background: W.bg2, border: `1px solid ${W.splitBg}`,
            borderRadius: "6px", padding: "8px 14px",
            display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
            minWidth: "80px",
          }
        },
          React.createElement("div", {
            style: { fontSize: "18px", fontWeight: "700", color, lineHeight: 1 }
          }, value),
          React.createElement("div", {
            style: { fontSize: "10px", color: W.fgMuted, textTransform: "uppercase",
                     letterSpacing: "0.5px" }
          }, label)
        )
      )
    ),

    // Actie-kaarten
    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },

      React.createElement(CleanupRow, {
        icon: "✨",
        title: "CSS-rommel opschonen",
        desc: "Verwijdert inline stijlen en HTML-rommel die AI-modellen soms in notities schrijven (font-weight, color, etc.).",
        msg: cssMsg,
        onClick: cleanupCss,
        danger: false,
      }),

      React.createElement(CleanupRow, {
        icon: "🔗",
        title: "Gebroken links opruimen",
        desc: `Verwijdert [[links]] die verwijzen naar niet-bestaande notities.${brokenCount > 0 ? ` ${brokenCount} gevonden.` : ""}`,
        msg: brokenMsg,
        onClick: cleanupBrokenLinks,
      }),

      React.createElement(CleanupRow, {
        icon: "🗑",
        title: "Lege notities verwijderen",
        desc: `Verwijdert notities zonder titel én zonder inhoud.${emptyCount > 0 ? ` ${emptyCount} gevonden.` : ""}`,
        msg: emptyMsg,
        onClick: cleanupEmptyNotes,
      }),

      React.createElement(CleanupRow, {
        icon: "🔍",
        title: "Wezen-notities verwijderen",
        desc: `Verwijdert notities die nergens naar linken en waarnaartoe ook niet gelinkt wordt.${orphanCount > 0 ? ` ${orphanCount} gevonden.` : ""} Let op: dagnotities zonder links zijn ook wezen.`,
        msg: orphanMsg,
        onClick: cleanupOrphans,
      }),

      React.createElement(CleanupRow, {
        icon: "📅",
        title: "Dubbele dagnotities controleren",
        desc: "Controleert of er meerdere dagnotities bestaan voor dezelfde datum.",
        msg: dailyMsg,
        onClick: cleanupDuplicateDailyNotes,
        danger: false,
      })
    ),

    // Info onderaan
    React.createElement("div", {
      style: { marginTop: "20px", padding: "12px 14px",
               background: "rgba(125,216,198,0.04)",
               border: `1px solid ${W.splitBg}`,
               borderRadius: "6px", fontSize: "11px",
               color: W.fgMuted, lineHeight: "1.7" }
    },
      React.createElement("span", { style: { color: W.blue, fontWeight: "600" } }, "Tip: "),
      "Lege en wezen-notities worden in twee klikken verwijderd — de eerste klik toont een bevestiging."
    )
  );
};
