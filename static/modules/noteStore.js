// ── NoteStore ────────────────────────────────────────────────────────────────
// Stable module. Enige bron van waarheid voor notities.
// Beheert de in-memory lijst en synchroniseert met NoteAPI.
// Mag nooit importeren uit Variable modules.

const NoteStore = (() => {
  // ── Private state ──────────────────────────────────────────────────────────
  let _notes    = [];                  // [{ id, title, content, tags, created, modified }]
  let _listeners = new Set();          // subscribers die onChange ontvangen

  // ── Private helpers ────────────────────────────────────────────────────────
  const _notify = () => _listeners.forEach(fn => fn(_notes));

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    /**
     * Laad alle notities van de server en vervang de lokale lijst.
     * @returns {Promise<Note[]>}
     */
    async load() {
      _notes = await NoteAPI.getAll();
      _notify();
      return _notes;
    },

    /**
     * Sla een notitie op (nieuw of bestaand).
     * Werkt optimistisch: update eerst lokaal, dan naar server.
     * @param {Note} note
     * @returns {Promise<Note>} de door de server bevestigde versie
     */
    async save(note) {
      const isNew = !_notes.find(n => n.id === note.id);
      if (isNew) {
        // Optimistisch toevoegen vóór server-response
        _notes = [note, ..._notes];
        _notify();
        const saved = await NoteAPI.create(note);
        // Vervang het optimistische exemplaar door de server-versie
        _notes = _notes.map(n => n.id === note.id ? saved : n);
        _notify();
        return saved;
      } else {
        const saved = await NoteAPI.update(note.id, note);
        _notes = _notes.map(n => n.id === note.id ? saved : n);
        _notify();
        return saved;
      }
    },

    /**
     * Verwijder een notitie.
     * @param {string} id
     */
    async remove(id) {
      await NoteAPI.remove(id);
      _notes = _notes.filter(n => n.id !== id);
      _notify();
    },

    /** Haal de huidige lijst op (synchroon). */
    getAll: () => _notes,

    /** Zoek één notitie op id. */
    getById: (id) => _notes.find(n => n.id === id) || null,

    /**
     * Subscribe op wijzigingen.
     * @param {function(Note[]): void} fn
     * @returns {function} unsubscribe
     */
    subscribe(fn) {
      _listeners.add(fn);
      return () => _listeners.delete(fn);
    },
  };
})();
