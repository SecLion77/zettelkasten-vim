// ── OfflineStore ─────────────────────────────────────────────────────────────
// Maakt NoteStore + NoteAPI offline-aware.
//
// Fixes t.o.v. versie 1:
//  1. window.NoteAPI bestaat niet — gebruikt nu directe referentie
//  2. Pending state in localStorage — overleeft refresh en tab-switch
//  3. fetch() interceptor vangt 202 op voor NoteAPI gooit

const OfflineStore = (() => {

  const IDB_NAME    = "zettelkasten-offline";
  const IDB_VERSION = 1;
  const NOTES_STORE = "notesCache";
  const QUEUE_STORE = "syncQueue";
  const LS_PENDING  = "zk_offline_pending";  // localStorage key

  // ── Pending IDs in localStorage (persistent over refresh) ─────────────────
  const _getPending = () => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_PENDING) || "[]")); }
    catch { return new Set(); }
  };
  const _setPending = (set) => {
    try { localStorage.setItem(LS_PENDING, JSON.stringify([...set])); } catch {}
    window.dispatchEvent(new CustomEvent("zk-pending-change", { detail: { count: set.size } }));
  };
  const _addPending    = (id) => { if (!id) return; const s = _getPending(); s.add(String(id));    _setPending(s); };
  const _removePending = (id) => { if (!id) return; const s = _getPending(); s.delete(String(id)); _setPending(s); };
  const _clearPending  = ()   => _setPending(new Set());


  // ── IndexedDB helpers ──────────────────────────────────────────────────────
  let _db = null;
  const _openDB = () => {
    if (_db) return Promise.resolve(_db);
    return new Promise((ok, err) => {
      const r = indexedDB.open(IDB_NAME, IDB_VERSION);
      r.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(QUEUE_STORE))
          db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains(NOTES_STORE))
          db.createObjectStore(NOTES_STORE, { keyPath: "id" });
      };
      r.onsuccess = () => { _db = r.result; ok(_db); };
      r.onerror   = () => err(r.error);
    });
  };
  const _idbAll = async (store) => {
    const db = await _openDB();
    return new Promise((ok, err) => {
      const r = db.transaction(store,"readonly").objectStore(store).getAll();
      r.onsuccess = () => ok(r.result || []);
      r.onerror   = () => err(r.error);
    });
  };
  const _idbPut = async (store, val) => {
    const db = await _openDB();
    return new Promise((ok, err) => {
      const r = db.transaction(store,"readwrite").objectStore(store).put(val);
      r.onsuccess = () => ok();
      r.onerror   = () => err(r.error);
    });
  };


  // ── PATCH 1: fetch interceptor — vangt 202 op voor NoteAPI ────────────────
  (() => {
    const _orig = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const url    = typeof input === "string" ? input : (input?.url || "");
      const method = (init?.method || "GET").toUpperCase();
      const isMut  = ["POST","PUT","PATCH","DELETE"].includes(method);
      const isNotes = /\/api\/notes/.test(url);

      const resp = await _orig(input, init);

      if (isNotes && isMut && resp.status === 202) {
        // SW heeft de mutatie in de queue gezet
        const clone = resp.clone();
        clone.json().then(d => { if (d?.id) _addPending(String(d.id)); }).catch(() => {});
        // Geef een 200 terug zodat NoteAPI niet faalt
        const bodyText = await resp.text();
        return new Response(bodyText, {
          status: 200,
          headers: { "Content-Type": "application/json", "X-Offline-Queued": "true" },
        });
      }

      if (isNotes && isMut && resp.status === 503) {
        // Geen SW, server echt weg — stuur ook 200 terug met offline-flag
        let bodyData = {};
        try {
          const b = typeof init?.body === "string" ? JSON.parse(init.body) : {};
          bodyData = { ...b, _offline: true, _pending: true };
          _addPending(String(bodyData.id || ""));
        } catch {}
        return new Response(JSON.stringify(bodyData), {
          status: 200,
          headers: { "Content-Type": "application/json", "X-Offline-Queued": "true" },
        });
      }

      return resp;
    };
    console.log("[OfflineStore] fetch interceptor actief");
  })();


  // ── PATCH 2: NoteStore.load — IDB fallback ─────────────────────────────────
  (() => {
    if (typeof NoteStore === "undefined") {
      console.warn("[OfflineStore] NoteStore niet gevonden");
      return;
    }
    const _orig = NoteStore.load.bind(NoteStore);
    NoteStore.load = async function () {
      try {
        const notes = await _orig();
        // Online: update IDB mirror op de achtergrond
        if (Array.isArray(notes) && notes.length) {
          Promise.allSettled(notes.map(n => _idbPut(NOTES_STORE, n))).catch(() => {});
        }
        return notes;
      } catch (err) {
        console.warn("[OfflineStore] load mislukt → IDB fallback:", err.message);
        const cached = await _idbAll(NOTES_STORE);
        if (cached.length) {
          console.log(`[OfflineStore] ${cached.length} notities uit IDB geladen`);
          return cached;
        }
        throw err;
      }
    };
    console.log("[OfflineStore] NoteStore.load patch actief");
  })();


  // ── PATCH 3: NoteStore.save — pending tracking + IDB update ───────────────
  (() => {
    if (typeof NoteStore === "undefined") return;
    const _orig = NoteStore.save.bind(NoteStore);
    NoteStore.save = async function (note) {
      try {
        const saved = await _orig(note);
        // Offline of pending response?
        if (saved?._offline || saved?._pending ||
            saved?.["x-offline-queued"] ||
            (saved && Object.keys(saved).length === 0)) {
          const local = { ...note, _pending: true };
          _idbPut(NOTES_STORE, local).catch(() => {});
          _addPending(String(note.id));
          return local;
        }
        // Online geslaagd
        _removePending(String(note.id));
        _idbPut(NOTES_STORE, saved).catch(() => {});
        return saved;
      } catch (err) {
        const local = { ...note, _pending: true };
        _idbPut(NOTES_STORE, local).catch(() => {});
        _addPending(String(note.id));
        console.warn("[OfflineStore] save → offline:", err.message);
        return local;
      }
    };
    console.log("[OfflineStore] NoteStore.save patch actief");
  })();


  // ── Sync events ────────────────────────────────────────────────────────────
  window.addEventListener("zk-sync-complete", ({ detail = {} }) => {
    if ((detail.processed || 0) > 0) {
      _clearPending();
      if (typeof NoteStore !== "undefined") NoteStore.load().catch(() => {});
    }
  });

  window.addEventListener("zk-online", () => {
    setTimeout(() => {
      window._zkSW?.syncNow?.().then(r => {
        if (r?.processed > 0) console.log("[OfflineStore] Auto-sync:", r);
      });
    }, 800);
  });


  // ── Publieke API ───────────────────────────────────────────────────────────
  return {
    isPending:    (id) => _getPending().has(String(id)),
    pendingCount: ()   => _getPending().size,
    isOnline:     ()   => navigator.onLine,
    clearPending: _clearPending,
    getCached:    ()   => _idbAll(NOTES_STORE),
    cache:        (n)  => _idbPut(NOTES_STORE, n),
    status: async () => ({
      online:  navigator.onLine,
      pending: _getPending().size,
      cached:  (await _idbAll(NOTES_STORE)).length,
      queued:  (await _idbAll(QUEUE_STORE)).length,
    }),
  };
})();
