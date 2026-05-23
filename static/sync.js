// ── Zettelkasten Live Sync ────────────────────────────────────────────────────
// Zelfstandig script — werkt onafhankelijk van app.js versie.
// Laadt via index.html. Gebruikt NoteStore (altijd beschikbaar).

(function() {
  'use strict';

  var lastHash  = null;
  var toastEl   = null;
  var toastTimer = null;

  function showToast(text) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      Object.assign(toastEl.style, {
        position: 'fixed', bottom: '24px', left: '50%',
        transform: 'translateX(-50%)',
        padding: '8px 20px', borderRadius: '20px',
        background: 'rgba(138,198,242,.18)',
        border: '1px solid rgba(138,198,242,.4)',
        color: '#8ac6f2', fontSize: '13px', fontWeight: '500',
        backdropFilter: 'blur(8px)', zIndex: '9999',
        pointerEvents: 'none', whiteSpace: 'nowrap',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        transition: 'opacity .4s',
      });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() {
      if (toastEl) toastEl.style.opacity = '0';
    }, 3500);
  }

  function reloadNotes() {
    // Optie 1: nieuwe app.js heeft _zkHardRefresh
    if (typeof window._zkHardRefresh === 'function') {
      window._zkHardRefresh();
      return;
    }
    // Optie 2: NoteStore.load() + subscriber triggert setNotes in App
    if (typeof NoteStore !== 'undefined' && typeof NoteStore.load === 'function') {
      NoteStore.load().then(function() {
        // _zkRefreshNotes zit in de originele app.js
        if (typeof window._zkRefreshNotes === 'function') {
          window._zkRefreshNotes();
        }
        console.log('[Sync] NoteStore hergeladen via NoteStore.load()');
      }).catch(function(e) {
        console.warn('[Sync] NoteStore.load fout:', e);
      });
      return;
    }
    // Optie 3: pagina herladen (laatste redmiddel)
    console.warn('[Sync] Geen reload methode — pagina herladen');
    window.location.reload();
  }

  function poll() {
    console.log('[Sync] Poll…', new Date().toLocaleTimeString());

    fetch('/api/notes-version', { cache: 'no-store' })
      .then(function(r) {
        if (!r.ok) {
          console.warn('[Sync] notes-version status:', r.status);
          return null;
        }
        return r.json();
      })
      .then(function(data) {
        if (!data) return;
        var hash = data.hash;
        if (!hash) { console.warn('[Sync] Geen hash:', data); return; }

        console.log('[Sync] Hash:', hash, '| Vorige:', lastHash);

        if (lastHash === null) {
          lastHash = hash;
          console.log('[Sync] Eerste hash opgeslagen');
          return;
        }
        if (hash === lastHash) {
          console.log('[Sync] Geen wijziging');
          return;
        }

        console.log('[Sync] ✓ Wijziging! Notities herladen…');
        lastHash = hash;
        reloadNotes();
        showToast('↺ Notities bijgewerkt');
      })
      .catch(function(e) {
        console.warn('[Sync] Poll fout:', e.message);
      });
  }

  function start() {
    console.log('[Sync] Gestart');
    poll();
    setInterval(poll, 15000);
    window.addEventListener('focus', poll);
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') poll();
    });
  }

  // Start na React mount
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(start, 2000);
    });
  } else {
    setTimeout(start, 2000);
  }

})();
