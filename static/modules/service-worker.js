// ── Zettelkasten Service Worker ────────────────────────────────────────────
// Versie: verhoog bij elke deploy om de cache te vernieuwen
const SW_VERSION  = "zk-sw-v22";  // v3 → wist v2 cache inclusief modules
const SHELL_CACHE  = `${SW_VERSION}-shell`;   // statische bestanden
const API_CACHE    = `${SW_VERSION}-api`;      // gecachede API-responses
const IDB_NAME     = "zettelkasten-offline";
const IDB_VERSION  = 4;
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
  "/modules/offlineStore.js",
  "/modules/SemanticSearch.js",
  "/modules/DailyView.js",
  "/modules/DailyView.js",
  // Vendor-bestanden: React/PDF.js lokaal cachen zodat de app ook werkt
  // zonder internetverbinding (niet alleen zonder de eigen server)
  "/vendor/react.production.min.js",
  "/vendor/react-dom.production.min.js",
  "/vendor/pdf.min.js",
  "/vendor/pdf.worker.min.js",
  "/vendor/hack.css",
  "/vendor/dm-sans.css",
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
      // Alle stores in één handler (versie 4)
      for (const [store, key] of [
        [NOTES_STORE, "id"],
        [QUEUE_STORE, "id"],
        ["pdfMeta",   "key"],
        ["annotCache","_idbKey"],
      ]) {
        if (!db.objectStoreNames.contains(store)) {
          const opts = store === QUEUE_STORE
            ? { keyPath: "id", autoIncrement: true }
            : { keyPath: key };
          db.createObjectStore(store, opts);
        }
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
    })
    .then(() => self.skipWaiting())   // activeer meteen, wacht niet op sluiting tabs
  );
});


// ── Activate: verwijder oude caches ─────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== API_CACHE
                    && k !== PDF_CACHE)  // PDF offline cache NOOIT wissen
          .map(k => caches.delete(k))
      )
    )
    .then(() => self.clients.claim())
  );
});

// ── Versie-check: controleer bij elke fetch of server een update heeft ───────
let _lastVersionCheck = 0;
const VERSION_CHECK_INTERVAL = 5 * 60 * 1000; // max 1x per 5 minuten checken

async function checkForUpdate() {
  const now = Date.now();
  if (now - _lastVersionCheck < VERSION_CHECK_INTERVAL) return;
  _lastVersionCheck = now;

  try {
    const resp = await fetch("/api/version", { cache: "no-store" });
    if (!resp.ok) return;
    const data = await resp.json();
    const serverHash = data?.hash;
    const cachedHash = await caches.match("/__zk_build_hash__")
      .then(r => r?.text()).catch(() => null);

    if (cachedHash && cachedHash !== serverHash) {
      // Server heeft een nieuwe build — stuur update-signaal naar alle tabs
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach(c => c.postMessage({ type: "BUILD_UPDATE", hash: serverHash }));
    }

    // Sla de huidige server-hash op
    const cache = await caches.open(API_CACHE);
    cache.put("/__zk_build_hash__", new Response(serverHash));
  } catch {
    // Offline of server niet bereikbaar — stil mislukken
  }
}


// ── Fetch: centrale verkeersleider ──────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Versie-check op de achtergrond (asynchroon, blokkeert fetch niet)
  if (req.method === "GET" && url.pathname !== "/api/version") {
    checkForUpdate().catch(() => {});
  }

  // Mutaties: alleen /api/notes* via de sync-queue
  // /api/llm/*, /api/import/*, etc. NOOIT onderscheppen — die hebben lange timeouts nodig
  // Notes + annotaties + img-annotaties → offline queue
  const isSyncable = MUTATION_METHODS.includes(req.method) && (
    url.pathname.startsWith("/api/notes") ||
    url.pathname === "/api/notes" ||
    url.pathname === "/api/annotations" ||
    url.pathname === "/api/img-annotations" ||
    url.pathname === "/api/pdf-read-toggle"
  );
  if (isSyncable) {
    event.respondWith(handleMutation(req));
    return;
  }
  // Alle andere POST/PUT/DELETE (llm, import, pdf, etc.): direct doorgeven
  if (MUTATION_METHODS.includes(req.method)) {
    return; // service worker doet niks — browser handelt direct af
  }

  // GET: LLM/import routes → NOOIT intercepteren (streaming + lange responses)
  const isLLMorImport = url.pathname.startsWith("/api/llm")
    || url.pathname.startsWith("/api/import")
    || url.pathname.startsWith("/api/pdf-index") // zware indexering nooit cachen
    || url.pathname.startsWith("/api/images/");  // image uploads nooit cachen
  // NB: /api/images (lijst) wél intercepteren voor offline defaults
  if (req.method === "GET" && isLLMorImport) {
    return; // direct doorgeven aan browser
  }
  // PDF-bestanden: cache bij eerste bezoek voor offline lezen
  if (req.method === "GET" && url.pathname.startsWith("/api/pdf/")) {
    event.respondWith(cachePdfFile(req));
    return;
  }
  // PDF-lijst, annotaties en config: netwerk eerst, cache als fallback
  if (req.method === "GET" && (
      url.pathname === "/api/pdfs" ||
      url.pathname === "/api/annotations" ||
      url.pathname === "/api/config" ||
      url.pathname === "/api/version" ||
      url.pathname === "/api/images-list")) {
    event.respondWith(networkFirstApiCache(req));
    return;
  }
  // GET: overige /api/ routes (notes, tags, version) → Network First
  if (req.method === "GET" && url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirstNoCache(req));
    return;
  }

  // Navigatie (index.html): cache-first met network-update
  if (req.method === "GET" && req.mode === "navigate") {
    event.respondWith(serveAppShell(req));
    return;
  }
  // JS/CSS modules: cache-first (NOOIT wachten op netwerk offline)
  if (req.method === "GET" && (
      url.pathname.endsWith(".js") ||
      url.pathname.endsWith(".css") ||
      url.pathname === "/" ||
      url.pathname.endsWith(".html"))) {
    event.respondWith(cacheFirstWithNetwork(req));
    return;
  }
  if (req.method === "GET") {
    event.respondWith(cacheFirstWithNetwork(req));
    return;
  }
});


// Bestanden die altijd vers van de server gehaald worden (niet Cache First)
const NETWORK_FIRST_PATHS = ["/app.js", "/modules/"];

// ── Strategie 0: App Shell — cache-first, netwerkupdate op achtergrond ──────
async function serveAppShell(req) {
  const cache  = await caches.open(SHELL_CACHE);
  const cached = await cache.match(req)
              || await cache.match("/index.html")
              || await cache.match("/");
  if (cached) {
    // Stuur gecachede versie direct — update cache op achtergrond
    fetch(req, { signal: AbortSignal.timeout(3000) })
      .then(res => { if (res.ok) cache.put(req, res); })
      .catch(() => {});
    return cached;
  }
  // Niet gecached: probeer netwerk (eerste bezoek)
  try {
    const res = await fetch(req, { signal: AbortSignal.timeout(8000) });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response(
      "<h2 style='font-family:sans-serif;padding:20px'>Offline — open de app eerst terwijl de server bereikbaar is.</h2>",
      { status: 503, headers: { "Content-Type": "text/html" } }
    );
  }
}

// ── Strategie 1: Cache First voor statische assets, Network First voor app-code ──
async function cacheFirstWithNetwork(req) {
  const url  = new URL(req.url);
  const path = url.pathname;

  // app.js en modules: cache-first met snelle achtergrond-update
  // KRITIEK: korte timeout — anders hangt de app offline (zwart scherm)
  const isAppCode = NETWORK_FIRST_PATHS.some(p => path.startsWith(p));
  if (isAppCode) {
    const cachedAppCode = await caches.match(req);
    if (cachedAppCode) {
      // Direct teruggeven, update op de achtergrond (niet wachten)
      fetch(req, { cache: "no-store", signal: AbortSignal.timeout(2500) })
        .then(res => { if (res.ok) caches.open(SHELL_CACHE).then(c => c.put(req, res)); })
        .catch(() => {});
      return cachedAppCode;
    }
    // Niets gecached: probeer netwerk met timeout
    try {
      const res = await fetch(req, { cache: "no-store", signal: AbortSignal.timeout(2500) });
      if (res.ok) {
        const cache = await caches.open(SHELL_CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch {
      return new Response(
        "// Module niet beschikbaar offline: " + path,
        { status: 503, headers: { "Content-Type": "application/javascript" } }
      );
    }
  }

  // Alle andere assets: Cache First
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
    const fallback = await caches.match("/index.html");
    return fallback || new Response("Offline — app niet gecached", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}


// ── Strategie 1b: Network First zonder caching (API routes) ─────────────────
// Alle /api/ routes komen hier — nooit gecached, altijd vers van server
async function networkFirstNoCache(req) {
  try {
    const res = await fetch(req.clone(), { signal: AbortSignal.timeout(10000) });
    if (res.ok && /^\/api\/notes$/.test(new URL(req.url).pathname)) {
      // Sla /api/notes op in IDB (voor offline fallback)
      const data = await res.clone().json().catch(() => null);
      if (Array.isArray(data)) {
        await idbClear(NOTES_STORE);
        await Promise.allSettled(data.map(n => idbPut(NOTES_STORE, n)));
      }
    }
    return res;
  } catch {
    // Offline — probeer IDB voor notities
    if (/^\/api\/notes$/.test(new URL(req.url).pathname)) {
      const notes = await idbGetAll(NOTES_STORE);
      return new Response(JSON.stringify(notes), {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Served-By": "zk-sw-idb" },
      });
    }
    // Geef lege defaults terug voor niet-kritieke endpoints
    const pathname = new URL(req.url).pathname;
    const emptyDefaults = {
      "/api/config":           JSON.stringify({}),
      "/api/version":          JSON.stringify({version:"offline",sw:"zk-sw-v14"}),
      "/api/pdfs":             JSON.stringify([]),
      "/api/annotations":      JSON.stringify([]),
      "/api/images":           JSON.stringify([]),
      "/api/images-list":      JSON.stringify([]),
      "/api/img-annotations":  JSON.stringify([]),
      "/api/tags":             JSON.stringify([]),
      "/api/version":          JSON.stringify({version:"offline"}),
    };
    const fallback = emptyDefaults[pathname];
    if (fallback) {
      return new Response(fallback, {
        status: 200,
        headers: { "Content-Type": "application/json", "X-Offline-Default": "true" },
      });
    }
    return new Response(JSON.stringify({ error: "Offline", offline: true }), {
      status: 503, headers: { "Content-Type": "application/json" },
    });
  }
}

// ── Strategie 2: Network First (API GET) ────────────────────────────────────
async function networkFirstApiCache(req) {
  try {
    const res = await fetch(req.clone(), { signal: AbortSignal.timeout(4000) }); // 4s voor lezen
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
        }
      }
    }
    return res;
  } catch (err) {
    // Offline: probeer IDB of API cache

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


// ── Strategie 4: PDF-bestanden — cache bij eerste open, offline beschikbaar ──
const PDF_CACHE    = "zk-pdfs-v1";   // versie-onafhankelijk: blijft bij SW updates
const PDF_MAX_MB   = 150;            // maximale opslag voor PDFs in MB
// ── PDF metadata via IDB (localStorage niet beschikbaar in SW) ───────────────
const PDF_META_STORE = "pdfMeta";

async function getPdfMeta() {
  try {
    const db      = await openIDB();
    const entries = await new Promise((res, rej) => {
      const tx  = db.transaction(PDF_META_STORE, "readonly");
      const req = tx.objectStore(PDF_META_STORE).getAll();
      req.onsuccess = () => res(req.result);
      req.onerror   = () => rej(req.error);
    });
    return Object.fromEntries(entries.map(e => [e.key, e]));
  } catch { return {}; }
}

async function savePdfMeta(meta) {
  try {
    const db = await openIDB();
    const tx = db.transaction(PDF_META_STORE, "readwrite");
    const st = tx.objectStore(PDF_META_STORE);
    for (const [k, v] of Object.entries(meta)) {
      st.put({ ...v, key: k });
    }
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch {}
}

async function deletePdfMeta(key) {
  try {
    const db = await openIDB();
    const tx = db.transaction(PDF_META_STORE, "readwrite");
    tx.objectStore(PDF_META_STORE).delete(key);
    return new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });
  } catch {}
}

function getTotalPdfSizeMb(meta) {
  return Object.values(meta).reduce((s, m) => s + (m.size || 0), 0) / (1024 * 1024);
}

// ── A: Serve from cache only, NOOIT automatisch cachen ───────────────────────
async function cachePdfFile(req) {
  const cache  = await caches.open(PDF_CACHE);
  const cached = await cache.match(req);
  if (cached) {
    // Update lastAccessed asynchroon (niet wachten)
    const key = new URL(req.url).pathname;
    getPdfMeta().then(meta => {
      if (meta[key]) savePdfMeta({ [key]: { ...meta[key], lastAccessed: Date.now() } });
    }).catch(() => {});
    return cached;
  }
  // Niet gecached: gewoon van server ophalen (zonder opslaan)
  try {
    return await fetch(req.clone(), { signal: AbortSignal.timeout(30000) });
  } catch {
    return new Response(
      JSON.stringify({ error: "PDF niet beschikbaar (voeg toe via ⬇ Offline knop)", offline: true }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ── B: Expliciet cachen op verzoek van app (met LRU-evictie) ─────────────────
async function cacheOfflinePdf(pdfUrl, pdfName) {
  const cache = await caches.open(PDF_CACHE);
  const meta  = await getPdfMeta();
  const key   = new URL(pdfUrl, self.location.origin).pathname;

  // Al gecached? (check ook met absolute URL)
  const absUrl = pdfUrl.startsWith("http") ? pdfUrl
    : new URL(pdfUrl, self.location.origin).href;
  if (await cache.match(absUrl)) {
    return { ok: true, cached: true, size: meta[key]?.size || 0 };
  }

  // Download
  let res;
  try {
    res = await fetch(absUrl, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error("HTTP " + res.status);
  } catch(e) {
    return { ok: false, error: e.message };
  }

  const blob = await res.clone().arrayBuffer();
  const sizeMb = blob.byteLength / (1024 * 1024);

  // B: LRU-evictie als limiet bereikt wordt
  let totalMb = getTotalPdfSizeMb(meta) + sizeMb;
  if (totalMb > PDF_MAX_MB) {
    const sorted = Object.entries(meta)
      .sort((a, b) => (a[1].lastAccessed || 0) - (b[1].lastAccessed || 0));
    for (const [evictKey, evictMeta] of sorted) {
      if (totalMb <= PDF_MAX_MB * 0.8) break;
      await cache.delete(evictKey);
      await deletePdfMeta(evictKey);
      totalMb -= (evictMeta.size || 0) / (1024 * 1024);
      console.log("[SW] LRU evicted:", evictKey);
    }
  }

  await cache.put(absUrl, res);
  const newMeta = { key, name: pdfName, size: blob.byteLength,
                    cachedAt: Date.now(), lastAccessed: Date.now() };
  await savePdfMeta({ [key]: newMeta });
  return { ok: true, cached: false, size: blob.byteLength, sizeMb };
}

async function removePdfFromCache(pdfUrl) {
  const cache  = await caches.open(PDF_CACHE);
  const absUrl = pdfUrl.startsWith("http") ? pdfUrl
    : new URL(pdfUrl, self.location.origin).href;
  const key    = new URL(absUrl).pathname;
  await cache.delete(absUrl);
  await cache.delete(pdfUrl); // ook relatieve URL proberen
  await deletePdfMeta(key);
  return { ok: true };
}

async function getStorageInfo() {
  const meta     = await getPdfMeta();
  const pdfTotalMb = getTotalPdfSizeMb(meta);
  let storageEst = null;
  try {
    const est = await navigator.storage.estimate();
    storageEst = { used: est.usage, quota: est.quota };
  } catch {}
  return {
    pdfs: Object.entries(meta).map(([k, v]) => ({
      key:          k,
      name:         v.name || decodeURIComponent(k.split("/").pop()),
      size:         v.size || 0,
      cachedAt:     v.cachedAt,
      lastAccessed: v.lastAccessed,
    })),
    pdfTotalMb,
    pdfMaxMb: PDF_MAX_MB,
    storage:  storageEst,
  };
}

// ── Strategie 3: Mutaties → sync-queue als offline ──────────────────────────
async function handleMutation(req) {
  let body = null;
  try { body = await req.clone().json(); } catch { body = null; }

  try {
    // Probeer de server te bereiken
    const res = await fetch(req.clone(), { signal: AbortSignal.timeout(8000) }); // 8s voor notities-mutaties

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
      } else {
        // Server-fout: bewaar item maar rapporteer
        console.warn(`[ZK-SW] Queue item ${item.id} server error:`, res.status);
        failed++;
      }
    } catch {
      // Nog steeds offline: stop en probeer later
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
  const { type, url, name } = event.data || {};

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (type === "GET_VERSION") {
    event.ports[0]?.postMessage({ type: "VERSION", version: SW_VERSION });
    return;
  }

  if (type === "CACHE_PDF") {
    const result = await cacheOfflinePdf(url, name || url.split("/").pop());
    event.ports[0]?.postMessage({ type: "CACHE_PDF_RESULT", ...result });
    return;
  }
  if (type === "REMOVE_PDF") {
    const result = await removePdfFromCache(url);
    event.ports[0]?.postMessage({ type: "REMOVE_PDF_RESULT", ...result });
    return;
  }
  if (type === "GET_STORAGE_INFO") {
    const info = await getStorageInfo();
    event.ports[0]?.postMessage({ type: "STORAGE_INFO", ...info });
    return;
  }
  // bestaande handlers volgen...

  const { type: msgType, payload } = event.data || {};

  // App vraagt: hoeveel offline items staan er in de queue?
  if (msgType === "GET_QUEUE_STATUS") {
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
  if (msgType === "SYNC_NOW") {
    const result = await processSyncQueue();
    event.ports[0]?.postMessage({ type: "SYNC_RESULT", ...result });

    // Stuur update naar alle open tabs
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(c => c.postMessage({ type: "SYNC_COMPLETE", ...result }));
    return;
  }

  // App vraagt: update de shell-cache (na deploy)
  if (msgType === "UPDATE_SHELL") {
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
