// ── Service Worker registratie + offline indicator ──────────────────────────
// Plak dit bovenaan app.js, vóór de App component definitie.

// ── 1. Registreer de Service Worker ─────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/service-worker.js", {
        scope: "/",
      });
      console.log("[ZK] Service Worker geregistreerd:", reg.scope);

      // Luister naar updates (nieuwe versie beschikbaar)
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        newWorker?.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // Nieuwe versie klaar — toon melding aan gebruiker
            console.log("[ZK] Nieuwe app-versie beschikbaar — herlaad om bij te werken");
            window._zkSwUpdateReady = true;
            window.dispatchEvent(new CustomEvent("zk-sw-update"));
          }
        });
      });

      // Zet globale helpers beschikbaar voor de app
      window._zkSW = {

        // Vraag de status van de offline queue op
        getStatus: () => new Promise((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (e) => resolve(e.data);
          navigator.serviceWorker.controller?.postMessage(
            { type: "GET_QUEUE_STATUS" }, [channel.port2]
          );
        }),

        // Verwerk de queue nu (roep aan zodra de app online is)
        syncNow: () => new Promise((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (e) => resolve(e.data);
          navigator.serviceWorker.controller?.postMessage(
            { type: "SYNC_NOW" }, [channel.port2]
          );
        }),

        // Wis alle offline data
        clearOffline: () => new Promise((resolve) => {
          const channel = new MessageChannel();
          channel.port1.onmessage = (e) => resolve(e.data);
          navigator.serviceWorker.controller?.postMessage(
            { type: "CLEAR_OFFLINE" }, [channel.port2]
          );
        }),
      };

    } catch (err) {
      console.warn("[ZK] Service Worker registratie mislukt:", err);
    }
  });

  // Luister naar sync-resultaten van de SW
  navigator.serviceWorker.addEventListener("message", (event) => {
    const { type, processed, failed } = event.data || {};
    if (type === "SYNC_COMPLETE" && processed > 0) {
      console.log(`[ZK] Sync voltooid: ${processed} verwerkt, ${failed} mislukt`);
      window.dispatchEvent(new CustomEvent("zk-sync-complete", {
        detail: { processed, failed }
      }));
    }
  });
}

// ── 2. Online/offline detectie ───────────────────────────────────────────────
window._zkOffline = !navigator.onLine;

window.addEventListener("online", async () => {
  window._zkOffline = false;
  window.dispatchEvent(new CustomEvent("zk-online"));
  console.log("[ZK] Verbinding hersteld — sync starten");
  // Verwerk de queue automatisch bij herverbinding
  if (window._zkSW?.syncNow) {
    const result = await window._zkSW.syncNow();
    console.log("[ZK] Auto-sync resultaat:", result);
  }
});

window.addEventListener("offline", () => {
  window._zkOffline = true;
  window.dispatchEvent(new CustomEvent("zk-offline"));
  console.log("[ZK] Verbinding verbroken — offline modus");
});

// ── 3. Verbindingsindicator component ────────────────────────────────────────
// Voeg dit toe in de App render, rechtsboven in de topbalk.
//
// const OfflineBadge = () => {
//   const [offline, setOffline] = React.useState(!navigator.onLine);
//   const [queued,  setQueued]  = React.useState(0);
//   const [syncing, setSyncing] = React.useState(false);
//
//   React.useEffect(() => {
//     const onOnline  = () => { setOffline(false); setSyncing(true); setTimeout(() => setSyncing(false), 3000); };
//     const onOffline = () => setOffline(true);
//     const onSync    = (e) => { setQueued(0); setSyncing(false); };
//     window.addEventListener("zk-online",        onOnline);
//     window.addEventListener("zk-offline",       onOffline);
//     window.addEventListener("zk-sync-complete", onSync);
//     // Check queue grootte bij mount
//     window._zkSW?.getStatus?.().then(s => setQueued(s?.queued || 0));
//     return () => {
//       window.removeEventListener("zk-online",        onOnline);
//       window.removeEventListener("zk-offline",       onOffline);
//       window.removeEventListener("zk-sync-complete", onSync);
//     };
//   }, []);
//
//   if (!offline && !syncing && queued === 0) return null; // verborgen als alles goed
//
//   return React.createElement("div", {
//     title: offline
//       ? "Offline — wijzigingen worden opgeslagen en gesynchroniseerd zodra de verbinding terugkeert"
//       : syncing ? "Synchroniseren…" : `${queued} wijzigingen wachten op synchronisatie`,
//     style: {
//       padding: "2px 10px", borderRadius: "10px", fontSize: "12px",
//       fontWeight: "500", cursor: "default", flexShrink: 0,
//       background: offline
//         ? "rgba(229,120,109,0.15)"
//         : syncing ? "rgba(138,198,242,0.15)" : "rgba(234,231,136,0.15)",
//       color:  offline ? "#e5786d" : syncing ? "#8ac6f2" : "#eae788",
//       border: `1px solid ${offline ? "rgba(229,120,109,0.35)" : syncing ? "rgba(138,198,242,0.35)" : "rgba(234,231,136,0.35)"}`,
//       animation: syncing ? "ai-pulse 1.5s ease-in-out infinite" : "none",
//     }
//   },
//     offline ? "⚡ Offline" : syncing ? "⟳ Synchroniseren…" : `⏳ ${queued} in wachtrij`
//   );
// };
