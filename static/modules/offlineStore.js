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


  // ── PATCH 1: fetch interceptor — vangt 202, 503 én netwerkfouten op ─────────
  (() => {
    const _orig = window.fetch.bind(window);

    const _makeOfflineResponse = (init, status) => {
      // Bouw een nep-200-response voor de offline case
      let body = {};
      try { body = JSON.parse(init?.body || "{}"); } catch {}
      // Zorg voor een lokaal ID als het een nieuwe notitie is (POST zonder id)
      if (!body.id) {
        body.id = "offline_" + Date.now() + "_" + Math.random().toString(36).slice(2,7);
      }
      body._offline = true;
      body._pending = true;
      _addPending(String(body.id));
      return new Response(JSON.stringify(body), {
        status:  200,
        headers: { "Content-Type": "application/json", "X-Offline-Queued": "true" },
      });
    };

    window.fetch = async (input, init = {}) => {
      const url     = typeof input === "string" ? input : (input?.url || "");
      const method  = (init?.method || "GET").toUpperCase();
      const isMut   = ["POST","PUT","PATCH","DELETE"].includes(method);
      const isNotes = /\/api\/notes/.test(url);

      let resp;
      try {
        resp = await _orig(input, init);
      } catch (networkErr) {
        // Netwerkfout — server onbereikbaar, SW niet actief
        if (isNotes && isMut) {
          return _makeOfflineResponse(init, 0);
        }
        throw networkErr; // niet-API fouten doorlaten
      }

      // 202 = SW heeft de mutatie in de queue gezet
      if (isNotes && isMut && resp.status === 202) {
        const bodyText = await resp.text();
        let id;
        try { id = JSON.parse(bodyText)?.id; } catch {}
        if (id) _addPending(String(id));
        return new Response(bodyText, {
          status: 200,
          headers: { "Content-Type": "application/json", "X-Offline-Queued": "true" },
        });
      }

      // 503 = server weg, geen SW
      if (isNotes && isMut && resp.status === 503) {
        return _makeOfflineResponse(init, 503);
      }

      return resp;
    };
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
          return cached;
        }
        throw err;
      }
    };
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
      });
    }, 800);
  });


  // ── SW-onafhankelijke sync queue ──────────────────────────────────────────
  // Slaat mislukte requests op in localStorage en herprobeert bij reconnect
  const LS_QUEUE = "zk_sync_queue_v1";

  const _getQueue = () => {
    try { return JSON.parse(localStorage.getItem(LS_QUEUE) || "[]"); } catch { return []; }
  };
  const _saveQueue = (q) => {
    try { localStorage.setItem(LS_QUEUE, JSON.stringify(q)); } catch {}
  };

  const _enqueue = (entry) => {
    const q = _getQueue();
    q.push({ ...entry, id: Date.now() + "_" + Math.random().toString(36).slice(2,6) });
    _saveQueue(q);
    window.dispatchEvent(new CustomEvent("zk-pending-change", { detail: { count: _getPending().size } }));
  };

  const _syncQueue = async () => {
    const q = _getQueue();
    if (!q.length) return { processed: 0, failed: 0 };

    const _origFetchDirect = window.__zkOrigFetch || fetch;
    let processed = 0, failed = 0;
    const remaining = [];

    for (const item of q) {
      try {
        const r = await _origFetchDirect(item.url, {
          method:  item.method,
          headers: { "Content-Type": "application/json" },
          body:    item.body ? JSON.stringify(item.body) : undefined,
        });
        if (r.ok || r.status === 200 || r.status === 201) {
          processed++;
          _removePending(item.body?.id);
        } else {
          remaining.push(item);
          failed++;
        }
      } catch {
        // Nog steeds offline
        remaining.push(item);
        break;
      }
    }

    _saveQueue(remaining);
    if (processed > 0) {
      window.dispatchEvent(new CustomEvent("zk-sync-complete", { detail: { processed, failed } }));
    }
    return { processed, failed };
  };

  // Bewaar de originele fetch voor directe server-communicatie
  window.__zkOrigFetch = window.fetch;

  // Upgrade de fetch interceptor: sla mislukte requests ook op in localStorage queue
  const _currentFetch = window.fetch;
  window.fetch = async (input, init = {}) => {
    const url    = typeof input === "string" ? input : (input?.url || "");
    const method = (init?.method || "GET").toUpperCase();
    const isMut  = ["POST","PUT","PATCH","DELETE"].includes(method);
    const isNotes = /\/api\/notes/.test(url);

    // GET requests nooit intercepten — anders cachet de SW hash-checks
    if (!isMut) return _currentFetch(input, init);

    if (isNotes && isMut) {
      try {
        const resp = await _currentFetch(input, init);
        if (resp.ok) return resp;
        // Server-fout: sla op in queue
        throw new Error("Server error: " + resp.status);
      } catch (err) {
        // Netwerkfout of server-fout — sla op in SW-onafhankelijke queue
        let body = {};
        try { body = JSON.parse(init?.body || "{}"); } catch {}
        if (!body.id) body.id = "offline_" + Date.now();
        _enqueue({ url, method, body });
        _addPending(String(body.id));
        return new Response(JSON.stringify({ ...body, _offline: true, _pending: true }), {
          status: 200, headers: { "Content-Type": "application/json" }
        });
      }
    }
    return _currentFetch(input, init);
  };

  // Sync bij reconnect
  window.addEventListener("online", () => {
    setTimeout(() => {
      _syncQueue().then(r => {
      });
      // Probeer ook de SW queue als die er is
      window._zkSW?.syncNow?.();
    }, 1000);
  });

  window.addEventListener("zk-sync-complete", ({ detail = {} }) => {
    if ((detail.processed || 0) > 0) {
      _clearPending();
      if (typeof NoteStore !== "undefined") NoteStore.load().catch(() => {});
    }
  });

  // Maak syncQueue globaal beschikbaar zodat de app hem kan aanroepen
  window._zkSyncQueue = _syncQueue;


  // ── Publieke API ───────────────────────────────────────────────────────────
  return {
    isPending:    (id) => _getPending().has(String(id)),
    pendingCount: ()   => _getPending().size,
    isOnline:     ()   => navigator.onLine,
    clearPending: _clearPending,
    getCached:    ()   => _idbAll(NOTES_STORE),
    cache:        (n)  => _idbPut(NOTES_STORE, n),
    syncQueue:    ()   => _syncQueue(),
    status: async () => ({
      online:  navigator.onLine,
      pending: _getPending().size,
      cached:  (await _idbAll(NOTES_STORE)).length,
      queued:  _getQueue().length,
    }),
  };
})();
