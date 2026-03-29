// ── PDFService ────────────────────────────────────────────────────────────────
// Stable module. Enige plek die /api/pdfs en /api/annotations aanroept.
// Geen UI-kennis. Mag nooit importeren uit Variable modules.

const PDFService = (() => {
  const BASE = "/api";

  const _json = async (method, path, body, signal) => {
    const opts = { method, headers: { "Content-Type": "application/json" } };
    if (body !== undefined) opts.body = JSON.stringify(body);
    if (signal) opts.signal = signal;
    const r = await fetch(BASE + path, opts);
    if (!r.ok) throw new Error(`PDFService ${method} ${path} → ${r.status}`);
    return r.json();
  };

  return {
    /** Haal lijst van opgeslagen PDFs op */
    listPdfs: () => _json("GET", "/pdfs"),

    /** Upload een PDF-bestand */
    uploadPdf: async (file) => {
      const fd = new FormData();
      fd.append("file", file, file.name);
      const r = await fetch(BASE + "/pdfs", { method: "POST", body: fd });
      if (!r.ok) throw new Error(`PDFService upload → ${r.status}`);
      return r.json();
    },

    /** Verwijder een PDF */
    deletePdf: async (name) => {
      const r = await fetch(BASE + "/pdfs/" + encodeURIComponent(name), { method: "DELETE" });
      return r.json();
    },

    /** Haal PDF als ArrayBuffer op (voor rendering) */
    fetchPdfBlob: async (name) => {
      const r = await fetch(BASE + "/pdf/" + encodeURIComponent(name));
      if (!r.ok) throw new Error(`PDFService fetch blob → ${r.status}`);
      return r.arrayBuffer();
    },

    /** Laad alle annotaties */
    getAnnotations: () => _json("GET", "/annotations"),

    /** Sla alle annotaties op (volledige lijst) */
    saveAnnotations: (annotations) => _json("POST", "/annotations", annotations),

    /** Start AI-samenvatting — signal is optioneel (AbortController.signal) */
    summarizePdf: (filename, model, signal) =>
      _json("POST", "/llm/summarize-pdf", { filename, model }, signal),
  };
})();
