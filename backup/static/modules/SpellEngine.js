// ── SpellEngine + CompletionEngine ─────────────────────────────────────────
// Deps: (geen — zelfstandige engines)

const SpellEngine = (() => {
  // Cache: word → {ok: bool, checked: bool}
  const _cache   = new Map();
  const _learned = new Set();   // gebruiker-toegevoegde woorden
  let   _ta      = null;        // verborgen textarea voor native spellcheck

  // Bouw een verborgen textarea die de browser laat spellchecken
  const _getTa = (lang) => {
    if (!_ta) {
      _ta = document.createElement("textarea");
      _ta.setAttribute("spellcheck","true");
      Object.assign(_ta.style, {
        position:"fixed", top:"-9999px", left:"-9999px",
        width:"200px", height:"50px", opacity:0,
      });
      document.body.appendChild(_ta);
    }
    _ta.lang = lang === "nl" ? "nl" : "en";
    return _ta;
  };

  // Synchrone check via execCommand("insertText") + getComputedStyle trick.
  // Browser-spellcheck is inherent asynchroon/niet-programmeerbaar,
  // dus gebruiken we een robuustere aanpak: woordenlijst-gebaseerd.
  // Kleine ingebakken lijst van veelgemaakte fouten + Hunspell-achtige regels.

  // Basis-patroon: woord is OK als het overeenkomt met bekende patronen
  const _okPatterns = [
    /^\d+([.,]\d+)?$/,                  // getallen
    /^[A-Z]{2,}$/,                       // afkortingen
    /^[a-z]{1,2}$/,                      // korte lidwoorden etc
    /^https?:\/\//,                      // URLs
    /^[\w.-]+@[\w.-]+\.\w+$/,           // emails
    /^\[\[.*\]\]$/,                      // wiki-links
  ];

  // We doen een check via het browser-spellcheck API op een verborgen input.
  // Dit werkt in moderne browsers die 'spellcheck' ondersteunen.
  const _checkViaInput = (() => {
    const inp = document.createElement("input");
    inp.setAttribute("spellcheck","true");
    inp.type = "text";
    Object.assign(inp.style, {position:"fixed",top:"-9999px",left:"-9999px",width:"1px"});
    let _mounted = false;
    return { el: inp, mount() { if(!_mounted){document.body.appendChild(inp);_mounted=true;} } };
  })();

  return {
    learnWord(w) { _learned.add(w.toLowerCase()); _cache.set(w.toLowerCase(), true); },
    isLearned(w) { return _learned.has(w.toLowerCase()); },

    // Snelle heuristieke check — geen async, werkt per karakter
    check(word, lang) {
      if (!word || word.length < 2) return true;
      const lw = word.toLowerCase();
      if (_learned.has(lw)) return true;
      if (_cache.has(lw)) return _cache.get(lw);

      // Patroon-checks
      for (const p of _okPatterns) if (p.test(word)) { _cache.set(lw, true); return true; }

      // Cijfer-woord combo (bijv "20px", "H2O")
      if (/\d/.test(word)) { _cache.set(lw, true); return true; }

      // Apostrof-vormen
      if (/'\w{1,3}$/.test(word)) { const base=word.split("'")[0]; return this.check(base,lang); }

      // Browser native check via een tijdelijke trick:
      // Zet het woord in een textarea met spellcheck=true en kijk of er
      // een markering op zit. Helaas is dit NIET synchroon beschikbaar.
      // Terugvaloptie: markeer woorden die NIET in onze vault-woordenlijst zitten.
      // (Vault-woordenlijst wordt extern gevuld door VimEditor)
      return null; // null = onbekend (niet markeren)
    },

    // Vault-woorden instellen (alle woorden uit de notities)
    setVaultWords(words) {
      for (const w of words) _learned.add(w.toLowerCase());
    },
  };
})();

// ── Completion Engine — Trie + AI ─────────────────────────────────────────────
// Verzamelt woorden uit alle notities en biedt prefix-zoeken.
const CompletionEngine = (() => {
  // Eenvoudige gesorteerde lijst voor prefix-matching (snel genoeg tot 100k woorden)
  let   _words    = [];  // gesorteerde unieke woorden
  let   _built    = false;
  const _MIN_LEN  = 3;   // minimale woordlengte om in de lijst op te nemen

  const _tokenize = (text) =>
    (text.match(/[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F'-]{3,}/g) || [])
      .map(w => w.replace(/^'+|'+$/g,"").toLowerCase())
      .filter(w => w.length >= _MIN_LEN);

  return {
    build(notesText) {
      const freq = new Map();
      for (const w of _tokenize(notesText)) freq.set(w, (freq.get(w)||0)+1);
      // Sorteer op frequentie desc, dan alfabetisch
      _words = [...freq.entries()]
        .sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
        .map(([w])=>w);
      _built = true;
    },

    // Voeg woorden toe van de huidige buffer (live bijhouden)
    addFromBuffer(text) {
      const news = _tokenize(text).filter(w => !_words.includes(w));
      if (news.length) _words = [...new Set([..._words, ...news])];
    },

    // Prefix-zoeken → top-N suggesties
    suggest(prefix, n=8) {
      if (!prefix || prefix.length < 2) return [];
      const lp = prefix.toLowerCase();
      const out = [];
      for (const w of _words) {
        if (w.startsWith(lp) && w !== lp) {
          out.push(w);
          if (out.length >= n) break;
        }
      }
      return out;
    },

    isBuilt() { return _built; },
  };
})();



