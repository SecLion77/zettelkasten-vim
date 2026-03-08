// ── NoteAPI ─────────────────────────────────────────────────────────────────
// Stable module. Enige plek die /api/notes aanroept.
// Heeft geen kennis van UI, state, of andere modules.
// Mag nooit importeren uit Variable modules (NoteEditor, NotesTab, etc.)

const NoteAPI = (() => {
  const BASE = "/api";

  const _json = async (method, path, body) => {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body !== undefined) opts.body = JSON.stringify(body);
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
