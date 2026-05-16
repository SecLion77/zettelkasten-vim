// ── Zettelkasten Service Worker ────────────────────────────────────────────
// Versie: verhoog bij elke deploy om de cache te vernieuwen
const SW_VERSION   = "zk-sw-v1";
const SHELL_CACHE  = `${SW_VERSION}-shell`;   // statische bestanden
const API_CACHE    = `${SW_VERSION}-api`;      // gecachede API-responses
const IDB_NAME     = "zettelkasten-offline";
const IDB_VERSION  = 1;
const QUEUE_STORE  = "syncQueue";              // offline mutaties
const NOTES_STORE  = "notesCache";            // volledige notities-mirror

// ── App Shell: alle bestanden die de app nodig heeft zonder netwerk ─────────
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/app.js",
  "/modules/noteApi.js",
  "/modules/noteStore.js",
  "/modules/pdfService.js",
  "/modules/annotationStore.js",
  "/modules/OutlineEditor.js",
  "/modules/Whiteboard.js",
  "/modules/VaultCleanup.js",
  "/modules/TasksPanel.js",
  "/modules/AnnotationsPanel.js",
  "/modules/QueryPanel.js",
  "/modules/CalendarWidget.js",
  "/modules/SpellEngine.js",
  "/modules/VimEditor.js",
  "/modules/TagFilterBar.js",
  "/modules/Graph.js",
  "/modules/PDFViewer.js",
  "/modules/VaultSettings.js",
  "/modules/ImagesGallery.js",
  "/modules/MermaidEditor.js",
  "/modules/ModelPicker.js",
  "/modules/NoteList.js",
  "/modules/SmartLinkSuggester.js",
  "/modules/LinksSidebar.js",
  "/modules/NoteEditor.js",
  "/modules/NotePreview.js",
  "/modules/NotesMeta.js",
  "/modules/TagManager.js",
  "/modules/NotesTab.js",
  "/modules/WebImporter.js",
  "/modules/ReadingList.js",
  "/modules/StatsPanel.js",
  "/modules/ReviewPanel.js",
  "/modules/BookLibrary.js",
  "/modules/ObjectFields.js",
];

// API-routes die we cachen voor offline lezen
const CACHE_API_PATTERNS = [
  /^\/api\/notes$/,
  /^\/api\/notes\//,
  /^\/api\/tags$/,
  /^\/api\/pdf-list$/,
  /^\/api\/images$/,
];

// Mutatieve routes die in de sync-queue gaan als we offline zijn
const MUTATION_METHODS = ["POST", "PUT", "PATCH", "DELETE"];


// ── IndexedDB helpers ───────────────────────────────────────────────────────
function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const qs = db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
        qs.createIndex("createdAt", "createdAt");
      }
      if (!db.objectStoreNames.contains(NOTES_STORE)) {
        db.createObjectStore(NOTES_STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbGet(store, key) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbGetAll(store) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

async function idbPut(store, value) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbDelete(store, key) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

async function idbClear(store) {
  const db = await openIDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(store, "readwrite");
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}


// ── Install: cache de app shell ─────────────────────────────────────────────
self.addEventListener("install", (event) => {
  console.log("[ZK-SW] Install", SW_VERSION);
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async (cache) => {
      // Probeer elk bestand afzonderlijk — sla missende over (hoeft niet te crashen)
      const results = await Promise.allSettled(
        SHELL_ASSETS.map(url =>
          cache.add(url).catch(err => console.warn("[ZK-SW] Cache skip:", url, err.message))
        )
      );
      const ok  = results.filter(r => r.status === "fulfilled").length;
      const nok = results.filter(r => r.status === "rejected").length;
      console.log(`[ZK-SW] Shell cached: ${ok} ok, ${nok} overgeslagen`);
    })
    .then(() => self.skipWaiting())   // activeer meteen, wacht niet op sluiting tabs
  );
});


// ── Activate: verwijder oude caches ─────────────────────────────────────────
self.addEventListener("activate", (event) => {
  console.log("[ZK-SW] Activate", SW_VERSION);
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== API_CACHE)
          .map(k => {
            console.log("[ZK-SW] Verwijder oude cache:", k);
            return caches.delete(k);
          })
      )
    )
    .then(() => self.clients.claim())  // neem controle over alle open tabs
  );
});


// ── Fetch: centrale verkeersleider ──────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Sla non-GET mutaties op in de sync-queue als we offline zijn
  if (MUTATION_METHODS.includes(req.method) && url.pathname.startsWith("/api/")) {
    event.respondWith(handleMutation(req));
    return;
  }

  // GET: API-routes → Network First met cache fallback
  if (req.method === "GET" && isApiRoute(url.pathname)) {
    event.respondWith(networkFirstWithCache(req));
    return;
  }

  // GET: App Shell → Cache First
  if (req.method === "GET") {
    event.respondWith(cacheFirstWithNetwork(req));
    return;
  }
});


// ── Strategie 1: Cache First (statische assets) ─────────────────────────────
async function cacheFirstWithNetwork(req) {
  const cached = await caches.match(req);
  if (cached) return cached;

  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch {
    // Offline én niet gecached: stuur de index.html terug (SPA fallback)
    const fallback = await caches.match("/index.html");
    return fallback || new Response("Offline — app niet gecached", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}


// ── Strategie 2: Network First (API GET) ────────────────────────────────────
async function networkFirstWithCache(req) {
  try {
    const res = await fetch(req.clone(), { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      // Update API cache én update de IndexedDB notities-mirror
      const cache = await caches.open(API_CACHE);
      cache.put(req, res.clone());

      // Sla notities op in IDB als het een notes-endpoint is
      if (/\/api\/notes$/.test(req.url)) {
        const data = await res.clone().json().catch(() => null);
        if (Array.isArray(data)) {
          await idbClear(NOTES_STORE);
          await Promise.allSettled(data.map(n => idbPut(NOTES_STORE, n)));
          console.log(`[ZK-SW] IDB: ${data.length} notities gesynchroniseerd`);
        }
      }
    }
    return res;
  } catch (err) {
    // Offline: probeer IDB of API cache
    console.log("[ZK-SW] Offline, gebruik cache voor:", req.url);

    if (/\/api\/notes$/.test(req.url)) {
      const notes = await idbGetAll(NOTES_STORE);
      return new Response(JSON.stringify(notes), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Served-By": "zk-sw-idb" },
      });
    }

    const cached = await caches.match(req);
    if (cached) return cached;

    return new Response(JSON.stringify({ error: "Offline", offline: true }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}


// ── Strategie 3: Mutaties → sync-queue als offline ──────────────────────────
async function handleMutation(req) {
  let body = null;
  try { body = await req.clone().json(); } catch { body = null; }

  try {
    // Probeer de server te bereiken
    const res = await fetch(req.clone(), { signal: AbortSignal.timeout(8000) });

    if (res.ok && req.method !== "DELETE") {
      // Update IDB-mirror na succesvolle server-write
      const data = await res.clone().json().catch(() => null);
      if (data?.id) await idbPut(NOTES_STORE, data);
    }
    if (res.ok && req.method === "DELETE") {
      const url   = new URL(req.url);
      const parts = url.pathname.split("/");
      const id    = parts[parts.length - 1];
      if (id) await idbDelete(NOTES_STORE, id);
    }

    return res;
  } catch {
    // Offline: zet mutatie in wachtrij
    console.log("[ZK-SW] Offline mutatie in queue:", req.method, req.url);
    const url = new URL(req.url);

    await idbPut(QUEUE_STORE, {
      method:    req.method,
      url:       req.url,
      pathname:  url.pathname,
      body:      body,
      headers:   Object.fromEntries(req.headers.entries()),
      createdAt: Date.now(),
    });

    // Optimistisch antwoord: doe alsof het gelukt is
    const optimisticNote = body ? { ...body, _offline: true, _queued: true } : { _offline: true };
    return new Response(JSON.stringify(optimisticNote), {
      status: 202,    // 202 Accepted: server zal het verwerken
      headers: {
        "Content-Type": "application/json",
        "X-Offline-Queued": "true",
      },
    });
  }
}


// ── Sync-queue verwerken (bij verbinding) ────────────────────────────────────
// Wordt aangeroepen vanuit de app via postMessage
async function processSyncQueue() {
  const queue = await idbGetAll(QUEUE_STORE);
  if (!queue.length) return { processed: 0, failed: 0 };

  console.log(`[ZK-SW] Sync queue: ${queue.length} items verwerken`);
  let processed = 0, failed = 0;

  for (const item of queue.sort((a, b) => a.createdAt - b.createdAt)) {
    try {
      const res = await fetch(item.url, {
        method:  item.method,
        headers: { "Content-Type": "application/json", ...item.headers },
        body:    item.body ? JSON.stringify(item.body) : undefined,
      });

      if (res.ok) {
        await idbDelete(QUEUE_STORE, item.id);
        processed++;
        console.log(`[ZK-SW] Queue item ${item.id} gesynchroniseerd`);
      } else {
        // Server-fout: bewaar item maar rapporteer
        console.warn(`[ZK-SW] Queue item ${item.id} server error:`, res.status);
        failed++;
      }
    } catch {
      // Nog steeds offline: stop en probeer later
      console.log("[ZK-SW] Sync gestopt: nog offline");
      break;
    }
  }

  // Herlaad notities-mirror na sync
  if (processed > 0) {
    try {
      const res = await fetch("/api/notes");
      if (res.ok) {
        const data = await res.json();
        await idbClear(NOTES_STORE);
        await Promise.allSettled(data.map(n => idbPut(NOTES_STORE, n)));
      }
    } catch { /* Server nog niet bereikbaar */ }
  }

  return { processed, failed, remaining: queue.length - processed };
}


// ── Messages van de app ontvangen ────────────────────────────────────────────
self.addEventListener("message", async (event) => {
  const { type, payload } = event.data || {};

  // App vraagt: hoeveel offline items staan er in de queue?
  if (type === "GET_QUEUE_STATUS") {
    const queue = await idbGetAll(QUEUE_STORE);
    const notes = await idbGetAll(NOTES_STORE);
    event.ports[0]?.postMessage({
      type:   "QUEUE_STATUS",
      queued: queue.length,
      cached: notes.length,
      version: SW_VERSION,
    });
    return;
  }

  // App vraagt: verwerk de sync-queue nu (gebruiker is terug online)
  if (type === "SYNC_NOW") {
    const result = await processSyncQueue();
    event.ports[0]?.postMessage({ type: "SYNC_RESULT", ...result });

    // Stuur update naar alle open tabs
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(c => c.postMessage({ type: "SYNC_COMPLETE", ...result }));
    return;
  }

  // App vraagt: update de shell-cache (na deploy)
  if (type === "UPDATE_SHELL") {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.allSettled(SHELL_ASSETS.map(url => cache.add(url)));
    event.ports[0]?.postMessage({ type: "SHELL_UPDATED", version: SW_VERSION });
    return;
  }

  // App vraagt: verwijder alle offline data (factory reset)
  if (type === "CLEAR_OFFLINE") {
    await idbClear(QUEUE_STORE);
    await idbClear(NOTES_STORE);
    await caches.delete(SHELL_CACHE);
    await caches.delete(API_CACHE);
    event.ports[0]?.postMessage({ type: "OFFLINE_CLEARED" });
    return;
  }
});


// ── Helpers ──────────────────────────────────────────────────────────────────
function isApiRoute(pathname) {
  return CACHE_API_PATTERNS.some(pattern => pattern.test(pathname));
}
