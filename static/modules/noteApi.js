// ── NoteAPI ─────────────────────────────────────────────────────────────────
// Stable module. Enige plek die /api/notes aanroept.
// Heeft geen kennis van UI, state, of andere modules.
// Mag nooit importeren uit Variable modules (NoteEditor, NotesTab, etc.)

const NoteAPI = (() => {
  const BASE = "/api";

  // Veilige velden die gestuurd mogen worden — voorkomt circular refs door DOM/React objecten
  const _sanitize = (note) => {
    if (!note || typeof note !== "object") return note;
    const safe = [
      "id","title","content","tags","created","modified",
      "sourceUrl","importedAt","isRead"
    ];
    const out = {};
    for (const k of safe) {
      if (note[k] !== undefined) {
        // Zorg dat tags altijd een array van strings is
        if (k === "tags") {
          out[k] = Array.isArray(note[k])
            ? note[k].filter(t => typeof t === "string")
            : [];
        } else {
          out[k] = note[k];
        }
      }
    }
    return out;
  };

  const _safeStr = (obj) => {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, val) => {
      if (val && typeof val === "object") {
        if (seen.has(val)) return "[Circular]";
        seen.add(val);
        if (val instanceof Node || val instanceof Element) return "[DOM]";
      }
      return val;
    });
  };

  const _json = async (method, path, body) => {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body !== undefined) {
      const payload = (method === "POST" || method === "PUT") ? _sanitize(body) : body;
      opts.body = _safeStr(payload);
    }
    const r = await fetch(BASE + path, opts);
    if (!r.ok) throw new Error(`NoteAPI ${method} ${path} → ${r.status}`);
    return r.json();
  };

  return {
    /** Laad alle notities */
    getAll: () => _json("GET", "/notes"),

    /** Maak een nieuwe notitie aan */
    create: (note) => _json("POST", "/notes", note),

    /** Update een bestaande notitie */
    update: (id, note) => _json("PUT", "/notes/" + id, note),

    /** Verwijder een notitie */
    remove: (id) => _json("DELETE", "/notes/" + id),
  };
})();
