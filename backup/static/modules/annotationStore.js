// ── AnnotationStore ───────────────────────────────────────────────────────────
// Stable module. Enige bron van waarheid voor PDF-annotaties (highlights).
// Synchroniseert met PDFService. Mag nooit importeren uit Variable modules.

const AnnotationStore = (() => {
  let _annotations = [];         // alle annotaties, alle bestanden
  let _listeners   = new Set();

  const _notify = () => _listeners.forEach(fn => fn(_annotations));

  return {
    /** Laad alle annotaties van de server */
    async load() {
      _annotations = await PDFService.getAnnotations() || [];
      _notify();
      return _annotations;
    },

    /** Voeg een annotatie toe en persisteer */
    async add(annotation) {
      _annotations = [..._annotations, annotation];
      _notify();
      await PDFService.saveAnnotations(_annotations);
      return annotation;
    },

    /** Update een bestaande annotatie (patch) */
    async update(id, patch) {
      _annotations = _annotations.map(h => h.id === id ? { ...h, ...patch } : h);
      _notify();
      await PDFService.saveAnnotations(_annotations);
    },

    /** Verwijder een annotatie */
    async remove(id) {
      _annotations = _annotations.filter(h => h.id !== id);
      _notify();
      await PDFService.saveAnnotations(_annotations);
    },

    /** Vervang de volledige lijst (voor bulk-operaties) */
    async setAll(annotations) {
      _annotations = annotations;
      _notify();
      await PDFService.saveAnnotations(_annotations);
    },

    /** Haal alle annotaties op (synchroon) */
    getAll: () => _annotations,

    /** Haal annotaties op voor één bestand */
    getForFile: (filename) => _annotations.filter(h => h.file === filename),

    /**
     * Subscribe op wijzigingen.
     * @param {function(Annotation[]): void} fn
     * @returns {function} unsubscribe
     */
    subscribe(fn) {
      _listeners.add(fn);
      return () => _listeners.delete(fn);
    },
  };
})();
