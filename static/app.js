const ZK_VERSION = "sessie12-thema-fix";
// ─── DEBUG FLAG ─────────────────────────────────────────────────────────────────
// Activeer via URL: ?debug  of via console: localStorage.setItem('zk_debug','1')
const ZK_DEBUG = new URLSearchParams(window.location.search).has('debug')
              || localStorage.getItem('zk_debug') === '1';
const zklog = (...a) => ZK_DEBUG && console.log('[ZK]', ...a);

// ─── WOMBAT COLOR SCHEME ────────────────────────────────────────────────────────
// ── Kleurenschema's ──────────────────────────────────────────────────────────
const THEMES = {
  "void-cyan": {
    label: "Void Cyan", dark: true,
    bg:"#1c1c1c", bg2:"#252525", bg3:"#2e2e2e",
    statusBg:"#252525", visualBg:"#554d4b", cursorBg:"#eae788",
    splitBg:"#3a4046", lineNrBg:"#1a1a1a",
    fg:"#e3e0d7", fgMuted:"#857b6f", fgDim:"#a0a8b0",
    statusFg:"#ffffd7",
    comment:"#9fca56", string:"#cae682", keyword:"#8ac6f2",
    type:"#92b5dc", special:"#e5786d",
    orange:"#e5786d", purple:"#d787ff", green:"#9fca56",
    yellow:"#eae788", blue:"#8ac6f2",
  },
  "nord": {
    label: "Nord", dark: true,
    bg:"#2e3440", bg2:"#3b4252", bg3:"#434c5e",
    statusBg:"#3b4252", visualBg:"#4c566a", cursorBg:"#ebcb8b",
    splitBg:"#434c5e", lineNrBg:"#2e3440",
    fg:"#eceff4", fgMuted:"#4c566a", fgDim:"#616e88",
    statusFg:"#e5e9f0",
    comment:"#a3be8c", string:"#a3be8c", keyword:"#88c0d0",
    type:"#81a1c1", special:"#bf616a",
    orange:"#d08770", purple:"#b48ead", green:"#a3be8c",
    yellow:"#ebcb8b", blue:"#88c0d0",
  },

  "forest-night": {
    label: "Forest Night", dark: true,
    bg:"#1a2319", bg2:"#212d20", bg3:"#2a3829",
    statusBg:"#212d20", visualBg:"#3a5038", cursorBg:"#e8c86a",
    splitBg:"#2f4030", lineNrBg:"#181f18",
    fg:"#d4e8c8", fgMuted:"#4a6040", fgDim:"#6a8060",
    statusFg:"#e4f4d8",
    comment:"#78be5a", string:"#78be5a", keyword:"#5ab4a0",
    type:"#80a8c0", special:"#e87858",
    orange:"#e87858", purple:"#a878d8", green:"#78be5a",
    yellow:"#e8c86a", blue:"#5ab4a0",
  },
  "graphite": {
    label: "Graphite", dark: true,
    bg:"#1a1a1a", bg2:"#222222", bg3:"#2a2a2a",
    statusBg:"#222222", visualBg:"#444444", cursorBg:"#d4d4d4",
    splitBg:"#333333", lineNrBg:"#1a1a1a",
    fg:"#d4d4d4", fgMuted:"#999999", fgDim:"#777777",
    statusFg:"#eeeeee",
    comment:"#909090", string:"#b8b8b8", keyword:"#d4d4d4",
    type:"#808080", special:"#a0a0a0",
    orange:"#c8a060", purple:"#9090c8", green:"#78a878",
    yellow:"#c8b860", blue:"#7aa8c8",
    // Uitgebreide kleuren voor UI-componenten
    blueBg:"rgba(122,168,200,0.12)", blueBorder:"rgba(122,168,200,0.35)", blueBg2:"rgba(122,168,200,0.06)",
    commentBg:"rgba(144,144,144,0.1)", tagBg:"rgba(120,168,120,0.1)", tagBorder:"rgba(120,168,120,0.3)", tagColor:"#78a878",
  },

  "perkament": {
    label: "Perkament", dark: false,
    bg:"#F5F0E4", bg2:"#EDE8DC", bg3:"#E4DDD0",
    statusBg:"#DDD8CC", visualBg:"#C0A87A", cursorBg:"#1E3A5F",
    splitBg:"#D8D0C0", lineNrBg:"#EDE8DC",
    fg:"#1E1810", fgMuted:"#6A5C4A", fgDim:"#8A7A68",
    statusFg:"#0E0C08",
    comment:"#3D6B3A", string:"#3D6B3A", keyword:"#1E3A5F",
    type:"#5A3A7A", special:"#8A2A2A",
    orange:"#8A4A18", purple:"#5A3A7A", green:"#3D6B3A",
    yellow:"#8A6A1A", blue:"#1E3A5F",
  },
  "ghost-white": {
    label: "Ghost White", dark: false,
    bg:"#F8F8FF", bg2:"#F0F0FA", bg3:"#E8E8F4",
    statusBg:"#E0E0EE", visualBg:"#B0B0D0", cursorBg:"#284696",
    splitBg:"#D8D8EE", lineNrBg:"#F0F0FA",
    fg:"#1A1A2E", fgMuted:"#606080", fgDim:"#808098",
    statusFg:"#0E0E1E",
    comment:"#286048", string:"#286048", keyword:"#284696",
    type:"#542878", special:"#882828",
    orange:"#886020", purple:"#542878", green:"#286048",
    yellow:"#886020", blue:"#284696",
  },
  "honingdauw": {
    label: "Honingdauw", dark: false,
    bg:"#F0FFF0", bg2:"#E4F8E4", bg3:"#D8F0D8",
    statusBg:"#CCEAD0", visualBg:"#90C890", cursorBg:"#1A5050",
    splitBg:"#C8E8C8", lineNrBg:"#E4F8E4",
    fg:"#142014", fgMuted:"#4A6A4A", fgDim:"#6A8A6A",
    statusFg:"#0A140A",
    comment:"#1E5030", string:"#1E5030", keyword:"#1A5050",
    type:"#482878", special:"#782020",
    orange:"#785020", purple:"#482878", green:"#1E5030",
    yellow:"#786020", blue:"#1A5050",
  },
  "zomerlicht": {
    label: "Zomerlicht ☀", dark: false,
    // Warm crème — niet puur wit (te veel glare), niet geel (te opvallend)
    // Vergelijkbaar met kwaliteitspapier in de zon: #FAF3E0
    bg:       "#FAF3E0",   // warm crème — papier in zonlicht
    bg2:      "#F2EAD0",   // iets donkerder — zijbalk, kaarten
    bg3:      "#E8DFC4",   // nog donkerder — geselecteerde items
    statusBg: "#DDD4B8",   // statusbalk — duidelijk gescheiden van inhoud
    visualBg: "#C8A870",   // selectie — warm amberbruin, goed zichtbaar
    cursorBg: "#1A3A6A",   // cursor — marineblauw, maximaal contrast
    splitBg:  "#CCC4A8",   // scheidingslijnen — warm maar subtiel
    lineNrBg: "#F2EAD0",
    // Tekst — extra donker voor maximaal buiten-contrast
    fg:       "#120E08",   // bijna-zwart, warm (contrast >14:1 op bg)
    fgMuted:  "#4A3E2C",   // gedimde tekst — donkerbruin, NIET grijs (grijs wast uit)
    fgDim:    "#6A5E4A",   // zeer gedimde tekst — nog steeds leesbaar buiten
    statusFg: "#0A0804",
    // Accentkleuren — krachtig en verzadigd voor leesbaarheid in zonlicht
    // Getest: >4.5:1 op #FAF3E0 achtergrond
    comment:  "#2A5E28",   // donker bosgroen (contrast ~7:1)
    string:   "#2A5E28",
    keyword:  "#1A3A6A",   // marineblauw (contrast ~9:1)
    type:     "#5A2878",   // dieppaars (contrast ~8:1)
    special:  "#8A2020",   // donkerrood (contrast ~6:1)
    orange:   "#8A3E10",   // verbrand sienna — warm en zichtbaar
    purple:   "#5A2878",
    green:    "#2A5E28",
    yellow:   "#8A6200",   // amberokker — niet geel (wast uit), wel warm
    blue:     "#1A3A6A",
    // Tags: amberbruin voor leesbaarheid op crème
    tagColor: "#7A3A0A",              // verbrand sienna — warm & leesbaar
    tagBg:    "rgba(122,58,10,0.10)", // lichte ambergloed
    tagBorder:"rgba(122,58,10,0.28)", // zichtbare warme rand
  },

  "beige": {
    label: "Beige Klassiek", dark: false,
    bg:"#F5F5DC", bg2:"#ECECD0", bg3:"#E2E2C0",
    statusBg:"#D8D8B4", visualBg:"#B4B490", cursorBg:"#283C64",
    splitBg:"#D4D4B0", lineNrBg:"#ECECD0",
    fg:"#1C1810", fgMuted:"#6A6048", fgDim:"#7A7458",
    statusFg:"#100E08",
    comment:"#3A5C38", string:"#3A5C38", keyword:"#283C64",
    type:"#503070", special:"#783828",
    orange:"#7A6020", purple:"#503070", green:"#3A5C38",
    yellow:"#7A6020", blue:"#283C64",
  },
};

// Maak THEMES global beschikbaar voor VaultSettings
window.THEMES = THEMES;

// Pas CSS variabelen direct toe bij laden (voor het geval van een opgeslagen licht thema)
// Bereken thema-afhankelijke hulpkleuren en voeg toe aan het thema-object
const _applyThemeExtended = (t) => {
  const dark = t.dark !== false;
  if (dark) {
    t.commentBg     = "rgba(159,202,86,0.10)";
    t.commentBg2    = "rgba(159,202,86,0.15)";
    t.commentBg3    = "rgba(159,202,86,0.04)";
    t.commentBorder = "rgba(159,202,86,0.30)";
    t.blueBg        = "rgba(138,198,242,0.12)";
    t.blueBg2       = "rgba(138,198,242,0.15)";
    t.blueBorder    = "rgba(138,198,242,0.30)";
    t.yellowBg      = "rgba(234,231,136,0.08)";
    t.yellowBorder  = "rgba(234,231,136,0.25)";
    t.splitAlpha    = "rgba(58,64,70,0.5)";
    // Tags: groen zoals gebruikelijk in donker thema
    t.tagColor      = t.comment;
    t.tagBg         = "rgba(159,202,86,0.10)";
    t.tagBorder     = "rgba(159,202,86,0.28)";
  } else {
    // Lichte thema's: gebruik donkere blauwtint voor tags — beter leesbaar
    const b = t.blue, s = t.splitBg;
    t.commentBg     = "rgba(0,0,0,0.05)";
    t.commentBg2    = "rgba(0,0,0,0.08)";
    t.commentBg3    = "rgba(0,0,0,0.02)";
    t.commentBorder = b + "44";
    t.blueBg        = b + "18";
    t.blueBg2       = b + "28";
    t.blueBorder    = b + "55";
    t.yellowBg      = t.keyword + "15";
    t.yellowBorder  = t.keyword + "35";
    t.splitAlpha    = s + "88";
    // Tags: gebruik de blauwkleur van het thema — duidelijk leesbaar op licht
    // Alleen overschrijven als het thema geen eigen tagColor heeft
    if (!t.tagColor) {
      t.tagColor  = t.keyword;       // donkerblauw/teal per thema
      t.tagBg     = b + "14";
      t.tagBorder = b + "40";
    }
  }
};

const _applyThemeCss = (t) => {
  const dark = t.dark !== false;
  const el = document.documentElement;

  // Basis CSS variabelen
  el.style.setProperty("--zk-bg",    t.bg);
  el.style.setProperty("--zk-fg",    t.fg);
  el.style.setProperty("--zk-muted", t.fgMuted);
  el.style.setProperty("--zk-split", t.splitBg);
  el.style.setProperty("--zk-blue",  t.blue);
  el.style.setProperty("--zk-special",t.special);
  el.style.setProperty("--zk-green", t.comment);
  el.style.setProperty("--zk-h1",    t.statusFg);
  el.style.setProperty("--zk-h2",    t.keyword);
  el.style.setProperty("--zk-p",     t.fg);
  el.style.setProperty("--zk-em",    t.fgDim);
  el.style.setProperty("--zk-code",  t.string);
  el.style.setProperty("--zk-code-bg",dark ? "rgba(255,255,255,.07)" : t.bg3);
  el.style.setProperty("--zk-pre-bg", dark ? "rgba(0,0,0,.35)"       : t.bg3);
  el.style.setProperty("--zk-quote-bg",dark? "rgba(229,120,109,.07)" : t.bg3);
  el.style.setProperty("--zk-th-bg", dark ? "rgba(255,255,255,.06)"  : t.bg2);
  el.style.setProperty("--zk-tr-bg", dark ? "rgba(255,255,255,.02)"  : t.bg3+"88");
  el.style.setProperty("--zk-link-dec",      dark?"rgba(138,198,242,.3)":t.blue+"55");
  el.style.setProperty("--zk-link-hover-dec",dark?"rgba(255,255,215,.4)":t.blue+"99");
  // Tag pill CSS variabelen — worden gebruikt in index.html .tag-pill definitie
  const _tc  = t.tagColor  || (dark ? t.comment  : t.keyword);
  const _tbg = t.tagBg     || (dark ? "rgba(159,202,86,.10)" : t.blue+"18");
  const _tbd = t.tagBorder || (dark ? "rgba(159,202,86,.28)" : t.blue+"44");
  const _th  = t.commentBg2|| (dark ? "rgba(159,202,86,.16)" : t.blue+"28");
  el.style.setProperty("--zk-tag-pill-color",  _tc);
  el.style.setProperty("--zk-tag-pill-bg",     _tbg);
  el.style.setProperty("--zk-tag-pill-border", _tbd);
  el.style.setProperty("--zk-tag-pill-hover",  _th);

  // Injecteer dynamische <style> — werkt direct, geen React re-render nodig
  let s = document.getElementById("zk-theme");
  if (!s) { s = document.createElement("style"); s.id = "zk-theme"; document.head.appendChild(s); }

  const tc  = t.tagColor  || (dark ? t.comment  : t.keyword);
  const tbg = t.tagBg     || (dark ? "rgba(159,202,86,.10)" : t.blue+"18");
  const tbd = t.tagBorder || (dark ? "rgba(159,202,86,.28)" : t.blue+"44");
  const th  = t.commentBg2|| (dark ? "rgba(159,202,86,.16)" : t.blue+"28");
  const ih  = dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)";
  const is_ = dark ? "rgba(138,198,242,.09)" : t.blue+"18";
  const ib  = dark ? "rgba(138,198,242,.18)" : t.blue+"44";
  const lbg = dark ? "rgba(138,198,242,.08)" : t.blue+"12";
  const lbd = dark ? "rgba(138,198,242,.20)" : t.blue+"40";
  const cb  = dark ? "rgba(255,255,255,.07)" : t.bg3;
  const pb  = dark ? "rgba(0,0,0,.35)"       : t.bg3;

  s.textContent =
    ".tag-pill{color:"+tc+"!important;background:"+tbg+"!important;border-color:"+tbd+"!important}" +
    ".tag-pill:hover{background:"+th+"!important}" +
    ".taghl{color:"+tc+"!important;background:"+tbg+"!important}" +
    "html{--zk-tag-pill-color:"+tc+";--zk-tag-pill-bg:"+tbg+";--zk-tag-pill-border:"+tbd+";--zk-tag-pill-hover:"+th+"}" +
    ".note-item:hover{background:"+ih+"!important}" +
    ".note-item.selected{background:"+is_+"!important;border-color:"+ib+"!important}" +
    ".zlink{color:"+t.blue+"!important;background:"+lbg+"!important;border-color:"+lbd+"!important}" +
    ".mdv h1{color:"+t.statusFg+"!important;border-color:"+t.splitBg+"!important}" +
    ".mdv h2{color:"+t.keyword+"!important}" +
    ".mdv h3,.mdv p,.mdv li{color:"+t.fg+"!important}" +
    ".mdv strong{color:"+t.statusFg+"!important}" +
    ".mdv em{color:"+t.fgDim+"!important}" +
    ".mdv code{color:"+t.string+"!important;background:"+cb+"!important;border-color:"+t.splitBg+"!important}" +
    ".mdv pre{background:"+pb+"!important;border-color:"+t.splitBg+"!important}" +
    ".mdv pre code{background:none!important}" +
    ".mdv a,.mdv a:visited{color:"+t.blue+"!important}" +
    ".mdv th{color:"+t.blue+"!important;border-color:"+t.splitBg+"!important}" +
    ".mdv td{border-color:"+t.splitBg+"!important}" +
    ".mdv hr{border-color:"+t.splitBg+"!important}" +
    "*::-webkit-scrollbar-thumb{background:"+t.fgMuted+"!important}" +
    ".zk-chip{color:"+t.fgMuted+"!important;background:"+t.commentBg3+"!important;border:1px solid "+t.splitBg+"!important;border-radius:5px!important}" +
    ".zk-chip.zk-chip-active{color:"+tc+"!important;background:"+tbg+"!important;border:1px solid "+tbd+"!important;font-weight:600!important}" +
    ".zk-chip:hover{background:"+th+"!important;color:"+tc+"!important}";
};

// Actief thema ophalen uit localStorage of standaard
const _savedTheme = (() => { try { return localStorage.getItem("zk_theme") || "void-cyan"; } catch { return "void-cyan"; } })();
let W = { ...THEMES[_savedTheme] || THEMES["void-cyan"] };
_applyThemeExtended(W); _applyThemeCss(W); // CSS vars direct toepassen bij laden

// Thema wisselen — roep dit aan vanuit de instellingen
window._setTheme = (id) => {
  if (!THEMES[id]) return;
  try { localStorage.setItem("zk_theme", id); } catch {}
  const t = THEMES[id];
  _applyThemeExtended(t);
  Object.assign(W, t);
  _applyThemeCss(t);
  document.body.style.background = t.bg;
  if (window._zkForceUpdate) window._zkForceUpdate();

  // Failsafe: pas stijlen direct toe op ALLE tag-achtige elementen
  const _doApplyTagColors = () => {
    const dark = t.dark !== false;
    const tagC  = t.tagColor  || (dark ? t.comment  : t.keyword);
    const tagB  = t.tagBg     || (dark ? "rgba(159,202,86,.10)" : t.blue+"18");
    const tagBd = t.tagBorder || (dark ? "rgba(159,202,86,.28)" : t.blue+"44");
    const tagI  = t.commentBg3|| (dark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.03)");
    let n = 0;
    // 1. Elementen met CSS klasse (nieuwe versie modules)
    document.querySelectorAll(".zk-chip").forEach(el => {
      const active = el.classList.contains("zk-chip-active");
      el.style.setProperty("color",      active ? tagC : t.fgMuted, "important");
      el.style.setProperty("background", active ? tagB : tagI,      "important");
      el.style.setProperty("border-color", active ? tagBd : t.splitBg, "important");
      n++;
    });
    document.querySelectorAll(".tag-pill").forEach(el => {
      el.style.setProperty("color",      tagC,  "important");
      el.style.setProperty("background", tagB,  "important");
      el.style.setProperty("border-color", tagBd, "important");
      n++;
    });
    document.querySelectorAll(".taghl").forEach(el => {
      el.style.setProperty("color",      tagC, "important");
      el.style.setProperty("background", tagB, "important");
      n++;
    });
    // 2. BREDE FALLBACK: alle spans met groene inline kleur (ook na browser-normalisatie)
    // Browser converteert #9fca56 → rgb(159, 202, 86) MET spaties na komma's
    const _isGreen = (str) =>
      str.includes("159, 202") ||   // rgb(159, 202, 86) — genormaliseerd
      str.includes("159,202")  ||   // soms zonder spatie
      str.includes("184, 224") ||   // rgb(184, 224, 106)
      str.includes("184,224");      // soms zonder spatie

    document.querySelectorAll("span").forEach(el => {
      const s  = el.style;
      // Gebruik cssText — bevat de volledige inline stijl als string
      const css = s.cssText || "";
      if (_isGreen(css) || _isGreen(s.color || "") || _isGreen(s.background || "")) {
        s.setProperty("color",        tagC,  "important");
        s.setProperty("background",   tagB,  "important");
        s.setProperty("border-color", tagBd, "important");
        n++;
      }
    });
  };
  requestAnimationFrame(() => {
    _doApplyTagColors();
    // Tweede pass na React re-render (microtask delay)
    setTimeout(_doApplyTagColors, 50);
    setTimeout(_doApplyTagColors, 200);
  });
};
window._currentTheme = () => {
  try { return localStorage.getItem("zk_theme") || "void-cyan"; } catch { return "void-cyan"; }
};

const HCOLORS = [
  {id:"yellow",  label:"Geel · Citaat",    desc:"Letterlijk citaat",     layer:null,
   bg:"rgba(234,231,136,0.45)", border:"#eae788"},
  {id:"blue",    label:"Blauw · Bron",     desc:"Info uit externe bron", layer:"bron",
   bg:"rgba(138,198,242,0.40)", border:"#8ac6f2"},
  {id:"orange",  label:"Rood · Kritisch",  desc:"Sleutelbegrip / actie", layer:"kritisch",
   bg:"rgba(229,120,109,0.40)", border:"#e5786d"},
  {id:"green",   label:"Groen · Eigen",    desc:"Eigen interpretatie",   layer:"eigen",
   bg:"rgba(159,202,86,0.40)",  border:"#9fca56"},
  {id:"purple",  label:"Paars · Vraag",    desc:"Vraag / onduidelijk",   layer:null,
   bg:"rgba(215,135,255,0.40)", border:"#d787ff"},
];

// ── Boek ↔ PDF matching (voor "Lees dit boek" in BookLibrary) ────────────────
// Geen apart koppelveld in het boek-schema — best-effort matchen op
// woordoverlap tussen boektitel en PDF-bestandsnaam. Alleen een match
// teruggeven bij voldoende overlap (voorkomt valse positieven bij generieke
// titels/bestandsnamen).
const _normalizeForPdfMatch = (s) => (s || "")
  .toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // diakrieten weg
  .replace(/\.pdf$/i, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

const findPdfForBook = (book, pdfs) => {
  const bt = _normalizeForPdfMatch(book?.titel);
  const btWords = bt.split(" ").filter(w => w.length > 2);
  if (!btWords.length || !pdfs?.length) return null;
  let best = null, bestScore = 0;
  pdfs.forEach(p => {
    const pn = _normalizeForPdfMatch(p.name);
    const hits = btWords.filter(w => pn.includes(w)).length;
    const score = hits / btWords.length;
    if (score > bestScore) { bestScore = score; best = p; }
  });
  return (best && bestScore >= 0.6) ? best : null;
};

// ── Markdown snippets (UltiSnips-stijl, geactiveerd met Tab) ──────────────────
const MD_SNIPPETS = {
  "h1":    "# ${1:Titel}\n\n${0}",
  "h2":    "## ${1:Sectie}\n\n${0}",
  "h3":    "### ${1:Subsectie}\n\n${0}",
  "link":  "[[${1:notitie}]]${0}",
  "tag":   "#${1:tag} ${0}",
  "code":  "```${1:taal}\n${2:code}\n```\n${0}",
  "table": "| ${1:Kolom 1} | ${2:Kolom 2} |\n|---|---|\n| ${3:} | ${4:} |\n${0}",
  "quote": "> ${1:citaat}\n\n${0}",
  "todo":  "- [ ] ${1:taak}\n${0}",
  "date":  new Date().toISOString().slice(0,10),
  "id":    () => genId(),
  "hr":    "---\n\n${0}",
  "bold":  "**${1:tekst}**${0}",
  "em":    "*${1:tekst}*${0}",
};

// Auto-bracket pairs (uit vimrc: inoremap ( ()<esc>i etc.)
const AUTO_PAIRS = {"(":")", "[":"]", "{":"}", '"':'"', "'":"'"};

// ── API ────────────────────────────────────────────────────────────────────────
// Relatief pad: werkt altijd ongeacht poort of OS
const API = "/api";

// Veilige JSON serializer — gooit een duidelijke fout als er een circular ref is
const _safeStringify = (obj) => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, val) => {
    if (val && typeof val === "object") {
      if (seen.has(val)) return "[Circular]";
      seen.add(val);
      // Gooi DOM-nodes eruit — die horen nooit in API-calls
      if (val instanceof Node || val instanceof Element) return "[DOM]";
    }
    return val;
  });
};

const api = {
  async get(path)        { const r=await fetch(API+path); return r.json(); },
  async post(path,body)  { const r=await fetch(API+path,{method:"POST",headers:{"Content-Type":"application/json"},body:_safeStringify(body)}); return r.json(); },
  async put(path,body)   { const r=await fetch(API+path,{method:"PUT",headers:{"Content-Type":"application/json"},body:_safeStringify(body)}); return r.json(); },
  async del(path)        { const r=await fetch(API+path,{method:"DELETE"}); return r.json(); },
  async uploadPdf(file)  {
    const fd=new FormData(); fd.append("file",file,file.name);
    const r=await fetch(API+"/pdfs",{method:"POST",body:fd});
    return r.json();
  },
  async fetchPdfBlob(name) {
    const r=await fetch(API+"/pdf/"+encodeURIComponent(name));
    return r.arrayBuffer();
  },
  async uploadImage(file) {
    const fd=new FormData(); fd.append("file",file,file.name);
    const r=await fetch(API+"/images",{method:"POST",body:fd});
    return r.json();
  },
  async deleteImage(name) {
    const r=await fetch(API+"/images/"+encodeURIComponent(name),{method:"DELETE"});
    return r.json();
  },
  async deletePdf(name) {
    const r=await fetch(API+"/pdfs/"+encodeURIComponent(name),{method:"DELETE"});
    return r.json();
  },
  async llmSummarizePdf(filename,model,signal) {
    const r=await fetch(API+"/llm/summarize-pdf",{method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({filename,model}),
      signal});
    return r.json();
  },
  async llmDescribeImage(filename,model,signal) {
    const opts={method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({filename,model})};
    if(signal) opts.signal=signal;
    const r=await fetch(API+"/llm/describe-image",opts);
    return r.json();
  },
  async llmMindmap(payload) {
    const r=await fetch(API+"/llm/mindmap",{method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)});
    return r.json();
  },
  async getImgAnnotations()        { const r=await fetch(API+"/img-annotations"); return r.json(); },
  async saveImgAnnotations(annots) { const r=await fetch(API+"/img-annotations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(annots)}); return r.json(); },
  async importUrl(payload, signal) {
    const safe = { url: String(payload.url||""), model: String(payload.model||""), force: Boolean(payload.force) };
    // Gebruik meegegeven signal OF maak een eigen 90s timeout
    const ctrl    = signal ? null : new AbortController();
    const timer   = ctrl ? setTimeout(() => ctrl.abort(), 180_000) : null;
    const opts    = {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(safe),
      signal: signal || ctrl?.signal,
    };
    try {
      const r = await fetch(API+"/import-url", opts);
      return r.json();
    } catch(e) {
      // Zet AbortError om naar leesbare boodschap
      if (e.name === "AbortError") throw new Error("Timeout na 3 minuten. Probeer opnieuw — de server was nog bezig.");
      throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
  },
};

// ── Utils ──────────────────────────────────────────────────────────────────────
const genId = () => {
  const n=new Date();
  return [n.getFullYear(),String(n.getMonth()+1).padStart(2,"0"),
    String(n.getDate()).padStart(2,"0"),String(n.getHours()).padStart(2,"0"),
    String(n.getMinutes()).padStart(2,"0"),String(n.getSeconds()).padStart(2,"0"),
    String(Math.floor(Math.random()*99)).padStart(2,"0")].join("");
};
const extractLinks = (c="")=>[...new Set([...c.matchAll(/\[\[([^\]]+)\]\]/g)].map(m=>m[1].split("|")[0].trim()))];
const extractTags  = (c="")=>[...new Set([...c.matchAll(/#(\w+)/g)].map(m=>m[1]))];
// Extracts typed links: [[target|type]] → {target, type}
// Types: inspireert, weerlegt, bouwt-voort-op, zie-ook, verwijst-naar
const LINK_TYPES = {
  "inspireert":      { color: "#9fca56", label: "inspireert",      dash: false },
  "weerlegt":        { color: "#e5786d", label: "weerlegt",         dash: false },
  "bouwt-voort-op":  { color: "#8ac6f2", label: "bouwt voort op",  dash: false },
  "zie-ook":         { color: "#d787ff", label: "zie ook",          dash: true  },
  "verwijst-naar":   { color: "#eae788", label: "verwijst naar",   dash: true  },
};
const extractTypedLinks = (c="") => [
  ...new Set(
    [...c.matchAll(/\[\[([^\]|]+)\|([^\]]+)\]\]/g)]
    .map(m => ({ target: m[1].trim(), type: m[2].trim().toLowerCase() }))
  )
];

// ── Enhanced Markdown renderer ─────────────────────────────────────────────────
const renderMd = (text, notes=[]) => {
  if (!text) return "";

  // Extraheer media-embeds EERST als placeholders (vóór HTML-escaping)
  const mediaBlocks = [];
  let h = text
    // ![[notitie-titel of id]] — embed de inhoud van een andere notitie
    .replace(/!\[\[(?!img:|pdf:)([^\]]+)\]\]/g, (_, ref) => {
      const i = mediaBlocks.length;
      const found = notes.find(n => n.id === ref || n.title === ref);
      if (!found) {
        mediaBlocks.push(
          '<div style="border-left:3px solid #e5786d;padding:6px 12px;margin:8px 0;' +
          'background:rgba(229,120,109,0.06);border-radius:0 4px 4px 0;font-size:13px;color:#857b6f">' +
          '⚠ Embed niet gevonden: <em>' + ref + '</em></div>'
        );
        return '%%MEDIA' + i + '%%';
      }
      const preview = (found.content || '').slice(0, 600);
      const hasMore = (found.content || '').length > 600;
      mediaBlocks.push(
        '<div style="border:1px solid #3a4046;border-radius:6px;margin:10px 0;overflow:hidden;background:rgba(255,255,255,0.02)">' +
        '<div style="padding:6px 12px;border-bottom:1px solid #3a4046;font-size:11px;color:#8ac6f2;font-weight:600;">⬡ ' +
        (found.title || found.id) + '</div>' +
        '<div class="mdv" style="padding:10px 14px;font-size:13px;max-height:320px;overflow-y:auto;">' +
        renderMd(preview, notes.filter(n => n.id !== found.id)) +
        (hasMore ? '<div style="color:#857b6f;font-size:11px;margin-top:4px;">… (ingekort)</div>' : '') +
        '</div></div>'
      );
      return '%%MEDIA' + i + '%%';
    })
    .replace(/!\[\[img:([^\]]+)\]\]/g, (_, name) => {
      const i = mediaBlocks.length;
      const safe = encodeURIComponent(name);
      mediaBlocks.push(
        `<div style="margin:12px 0;text-align:center"><img src="/api/image/${safe}" ` +
        `alt="${name.replace(/"/g,"&quot;")}" ` +
        `style="max-width:100%;max-height:480px;width:auto;height:auto;` +
        `border-radius:6px;border:1px solid #3a4046;` +
        `object-fit:contain;display:inline-block" /></div>`
      );
      return `%%MEDIA${i}%%`;
    })
    .replace(/\[\[pdf:([^\]]+)\]\]/g, (_, name) => {
      const i = mediaBlocks.length;
      const safe = encodeURIComponent(name);
      mediaBlocks.push(
        `<a href="/api/pdf/${safe}" target="_blank" ` +
        `style="color:#8ac6f2;text-decoration:underline">📄 ${name}</a>`
      );
      return `%%MEDIA${i}%%`;
    });

  // Markdown links [tekst](url) → placeholder VÓÓR html-escaping
  // (zodat & in URLs niet als &amp; geescaped wordt)
  h = h.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
    const i = mediaBlocks.length;
    mediaBlocks.push(
      `<a href="${url}" target="_blank" rel="noopener noreferrer" ` +
      `style="color:#8ac6f2;text-decoration:underline;text-decoration-color:rgba(138,198,242,0.4)">${label}</a>`
    );
    return `%%MEDIA${i}%%`;
  });

  // Naakte URLs → placeholder VÓÓR html-escaping
  h = h.replace(/(https?:\/\/[-\w@:%._+~#=/?&]+(?<![.,;:!?"'\s]))/g, url => {
    const i = mediaBlocks.length;
    mediaBlocks.push(
      `<a href="${url}" target="_blank" rel="noopener noreferrer" ` +
      `style="color:#8ac6f2;text-decoration:underline;text-decoration-color:rgba(138,198,242,0.4);word-break:break-all">${url}</a>`
    );
    return `%%MEDIA${i}%%`;
  });

  // Pre-sanitering: strip alle HTML-tags die het LLM soms produceert
  // Iteratief: ook geneste tags (<div style="color:<span>..."> worden volledig gestript
  let _prev = '';
  while (_prev !== h) { _prev = h; h = h.replace(/<[^<>]*>/g, ''); }
  // CSS-rommel zonder tags: "#hex;prop:val"> en "prop:val">
  h = h.replace(/(?:[\w-]+:)?#[0-9a-fA-F]{3,8};(?:[\w-]+:[^;\">\\n]{1,80};?){1,12}\"?>\s*/g, '');
  h = h.replace(/(?:[\w-]+:[^;\">\n]{1,80};)*[\w-]+:[^;\">\n]{1,80}\"?>\s*/g, '');
  // Verwijder lege koppen (# alleen op een regel)
  h = h.replace(/^#+\s*$/gm, '');
  h = h.replace(/\n{3,}/g, '\n\n');

  // Nu HTML-escapen (raakt placeholders niet)
  h = h.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

  // Post-escape sanitering: CSS-rommel inclusief &gt; variant
  // Dekt alle patronen: "#hex;prop:val;prop:val"&gt;" en "prop:val">"
  h = h.replace(/(?:[\w-]+:)?#[0-9a-fA-F]{3,8};(?:[\w-]+:[^\n\"<>&]{1,80};?){1,12}\"?\s*(?:&gt;|>)\s*/g, '');
  h = h.replace(/(?:[\w-]+:[^\n"<>&]{1,80};)*[\w-]+:[^\n"<>&]{1,80}"?\s*(?:&gt;|>)\s*/g, '');
  // Strip ook losse label-regels "📋 SAMENVATTING" op eigen regel
  h = h.replace(/^[📋🗒️✍️\s]*(?:SAMENVATTING|SUMMARY)\s*$/gim, '');

  // Blok laag-markeringen: :::bron/kritisch/eigen ... :::
  // Verwerkt vóór code blocks zodat ``` binnen blokken niet interfereert
  h = h.replace(/^:::bron\s*\n([\s\S]*?)^:::\s*$/gm, (_, body) => {
    const i = mediaBlocks.length;
    mediaBlocks.push(
      '<div class="laag-blok laag-blok-bron">' +
      '<span class="laag-blok-label">BRON</span>' +
      '<div class="laag-blok-body">' + body.trim() + '</div></div>'
    );
    return '%%MEDIA' + i + '%%';
  });
  h = h.replace(/^:::kritisch\s*\n([\s\S]*?)^:::\s*$/gm, (_, body) => {
    const i = mediaBlocks.length;
    mediaBlocks.push(
      '<div class="laag-blok laag-blok-kritisch">' +
      '<span class="laag-blok-label">KRITISCH</span>' +
      '<div class="laag-blok-body">' + body.trim() + '</div></div>'
    );
    return '%%MEDIA' + i + '%%';
  });
  h = h.replace(/^:::eigen\s*\n([\s\S]*?)^:::\s*$/gm, (_, body) => {
    const i = mediaBlocks.length;
    mediaBlocks.push(
      '<div class="laag-blok laag-blok-eigen">' +
      '<span class="laag-blok-label">EIGEN</span>' +
      '<div class="laag-blok-body">' + body.trim() + '</div></div>'
    );
    return '%%MEDIA' + i + '%%';
  });

  // Code blocks first (prevent interference) — mermaid mindmap apart behandelen
  const codeBlocks = [];
  h = h.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const i = codeBlocks.length;
    if (lang === "mindmap") {
      // Mermaid mindmap: placeholder met data — React vervangt dit met MermaidPreviewBlock
      const escaped = code.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/\n/g,"&#10;");
      codeBlocks.push(
        `<div class="mermaid-mindmap-block" data-mermaid="${escaped}"></div>`
      );
    } else {
      codeBlocks.push(`<pre><code class="lang-${lang}">${code}</code></pre>`);
    }
    return `%%CODE${i}%%`;
  });

  // Tables
  h = h.replace(/(\|.+\|\n)+/g, tableStr => {
    const rows = tableStr.trim().split("\n");
    if (rows.length < 2) return tableStr;
    const header = rows[0].split("|").filter(Boolean).map(c=>`<th>${c.trim()}</th>`).join("");
    const body   = rows.slice(2).map(r=>`<tr>${r.split("|").filter(Boolean).map(c=>`<td>${c.trim()}</td>`).join("")}</tr>`).join("");
    return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
  });

  // Blockquotes — met callout-herkenning [!cite], [!ai], [!note], [!warning]
  const calloutMeta = {
    "cite":    { icon:"📎", color:"#8ac6f2", bg:"rgba(138,198,242,0.07)", border:"rgba(138,198,242,0.25)" },
    "ai":      { icon:"🧠", color:"#d787ff", bg:"rgba(215,135,255,0.07)", border:"rgba(215,135,255,0.3)"  },
    "note":    { icon:"📝", color:"#eae788", bg:W.yellowBg, border:W.yellowBorder },
    "warning": { icon:"⚠",  color:"#e5786d", bg:"rgba(229,120,109,0.07)", border:"rgba(229,120,109,0.25)" },
    "idea":        { icon:"💡", color:"#9fca56", bg:"rgba(159,202,86,0.07)",  border:"rgba(159,202,86,0.25)"  },
    "samenvatting":{ icon:"📋", color:W.keyword||"#8ac6f2", bg:W.dark?"rgba(138,198,242,0.07)":"rgba(138,198,242,0.10)", border:W.blueBorder  },
  };
  h = h.replace(/^(&gt;.*\n?)+/gm, block => {
    const lines = block.split("\n").filter(l => l.trim());
    const cleaned = lines.map(l => l.replace(/^&gt;\s?/,""));
    // Check of eerste regel een callout-marker is: [!type] of [!type] Title
    const firstClean = cleaned[0]?.trim() || "";
    const calloutMatch = firstClean.match(/^\[!(\w+)\](.*)$/i);
    if (calloutMatch) {
      const type  = calloutMatch[1].toLowerCase();
      const title = calloutMatch[2].trim();
      const meta  = calloutMeta[type] || { icon:"💬", color:W.fgMuted||"#a0a8b0", bg:W.dark?"rgba(255,255,255,0.04)":"rgba(0,0,0,0.04)", border:W.splitBg||"rgba(255,255,255,0.12)" };
      // Saniteer body: verwijder CSS-rommel die lokale modellen soms toevoegen
      const rawBody = cleaned.slice(1).join("\n").replace(/^&gt;\s?/gm,"").trim();
      const body = rawBody
        // HTML-tags verwijderen
        .replace(/&lt;[^&]*&gt;/g, "")
        // CSS-stijl fragmenten: #hexkleur;eigenschap:waarde;...
        .replace(/#?[0-9a-fA-F]{3,8};[\w-]+:[^;\n<]{1,80}(?:;[\w-]+:[^;\n<]{1,80})*/g, "")
        // CSS property:value; patronen
        .replace(/\b[\w-]+:[\w\s#.,%()]+;(?:[\w-]+:[\w\s#.,%()]+;?)*/g, "")
        // Losse > tekens die overblijven
        .replace(/^[\s>]+/gm, "")
        // Samenvatting-labels die het model toevoegt
        .replace(/\*{0,2}(?:SAMENVATTING|Samenvatting|SUMMARY|Summary)\*{0,2}\s*[:\n]/g, "")
        // Meerdere lege regels
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        // Losse puntkomma's die overblijven na CSS-strip
        .replace(/^;\s*/gm, "")
        .replace(/<br>;\s*/g, "<br>")
        // Regels samenvoegen voor weergave
        .replace(/\n/g, "<br>");
      // Sla callout op als placeholder zodat taghl de #hex in style-attrs niet beschadigt
      const calloutHtml =
             `<div style="border-left:3px solid ${meta.border};background:${meta.bg};border-radius:0 6px 6px 0;padding:10px 14px;margin:10px 0">` +
             `<div style="color:${meta.color};font-weight:bold;font-size:13px;margin-bottom:${body?"6px":"0"}">${meta.icon} ${type.toUpperCase()}${title?" — "+title:""}</div>` +
             (body ? `<div style="color:${W.fg};font-size:14px;line-height:1.7">${body}</div>` : "") +
             `</div>`;
      const ci = mediaBlocks.length;
      mediaBlocks.push(calloutHtml);
      return `%%MEDIA${ci}%%`;
    }
    // Gewone blockquote ook als placeholder
    const bqHtml = `<blockquote style="color:${W.fg}">${cleaned.join("<br>")}</blockquote>`;
    const bi = mediaBlocks.length;
    mediaBlocks.push(bqHtml);
    return `%%MEDIA${bi}%%`;
  });

  // Headings
  h = h.replace(/^#{1}\s(.+)$/gm,"<h1>$1</h1>");
  h = h.replace(/^#{2}\s(.+)$/gm,"<h2>$1</h2>");
  h = h.replace(/^#{3}\s(.+)$/gm,"<h3>$1</h3>");

  // HR
  h = h.replace(/^---$/gm,"<hr>");

  // Inline formatting
  h = h.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  h = h.replace(/\*(.+?)\*/g,"<em>$1</em>");
  h = h.replace(/`(.+?)`/g,"<code>$1</code>");
  h = h.replace(/~~(.+?)~~/g,"<del>$1</del>");
  // Inline laag-markeringen: [tekst]{.bron}, [tekst]{.kritisch}, [tekst]{.eigen}
  h = h.replace(/\[([^\]]+)\]\{\.bron\}/g,    '<span class="laag-bron">$1</span>');
  h = h.replace(/\[([^\]]+)\]\{\.kritisch\}/g, '<span class="laag-kritisch">$1</span>');
  h = h.replace(/\[([^\]]+)\]\{\.eigen\}/g,   '<span class="laag-eigen">$1</span>');

  // Checkboxes
  h = h.replace(/^- \[ \] (.+)$/gm,'<li class="todo">☐ $1</li>');
  h = h.replace(/^- \[x\] (.+)$/gm,'<li class="todo done">☑ $1</li>');

  // Lists
  h = h.replace(/^[-*] (.+)$/gm,"<li>$1</li>");
  h = h.replace(/^\d+\. (.+)$/gm,"<li>$1</li>");
  h = h.replace(/(<li>[\s\S]*?<\/li>\n?)+/g,"<ul>$&</ul>");

  // Block-referenties ((blok-id)) — inline blok-citaat
  h = h.replace(/\(\(([a-z0-9]{4,12})\)\)/g, (_, refId) => {
    const BLOCK_ID_RE = /\s*\^\^([a-z0-9]+)\^\^$/;
    let found = null;
    for (const n of notes) {
      for (const line of (n.content || "").split("\n")) {
        const m = line.match(BLOCK_ID_RE);
        if (m && m[1] === refId) {
          found = { text: line.replace(BLOCK_ID_RE, "").replace(/^\s*[-*]\s?/, "").trim(),
                    noteTitle: n.title || n.id };
          break;
        }
      }
      if (found) break;
    }
    if (!found) return '<span style="color:#e5786d;font-size:12px;border:1px solid rgba(229,120,109,0.3);border-radius:3px;padding:1px 5px">⚠ blok: ' + refId + '</span>';
    const txt = found.text.slice(0, 60) + (found.text.length > 60 ? '…' : '');
    return '<span style="background:rgba(138,198,242,0.1);border:1px solid rgba(138,198,242,0.25);border-radius:3px;padding:1px 6px;font-size:13px;color:#8ac6f2" title="Uit: ' + found.noteTitle + '">⬡ ' + txt + '</span>';
  });

  // Zettelkasten links — pill-stijl, broken links gemarkeerd
  h = h.replace(/\[\[([^\]]+)\]\]/g,(_,id)=>{
    const n=notes.find(x=>x.id===id||x.title===id);
    if (n) return `<span class="zlink" data-id="${id}">${n.title}</span>`;
    // Broken link: notitie bestaat niet
    return `<span class="zlink broken" data-id="${id}">${id}</span>`;
  });

  // Tags
  h = h.replace(/#(\w+)/g,'<span class="taghl">#$1</span>');

  // Restore code blocks
  codeBlocks.forEach((blk,i) => { h=h.replace(`%%CODE${i}%%`,blk); });
  mediaBlocks.forEach((blk,i) => { h=h.replace(`%%MEDIA${i}%%`,blk); });

  // Paragraphs
  return h.split(/\n\n+/).map(b=>{
    if (/^<(h[123]|ul|ol|li|table|pre|blockquote|hr)/.test(b)) return b;
    return `<p>${b.replace(/\n/g,"<br>")}</p>`;
  }).join("\n");
};

// ── Tag Pill ───────────────────────────────────────────────────────────────────
const TagPill = ({tag, onRemove, small, onClick}) => {
  // Gebruik W direct — betrouwbaarder dan CSS variabelen
  // W.dark !== false = donker thema; expliciet false = licht thema (Zomerlicht etc.)
  const isLight = W.dark === false;
  const tColor  = W.tagColor  || (isLight ? "#7A3A0A"              : "#9fca56");
  const tBg     = W.tagBg     || (isLight ? "rgba(122,58,10,0.12)" : "rgba(159,202,86,0.12)");
  const tBorder = W.tagBorder || (isLight ? "rgba(122,58,10,0.32)" : "rgba(159,202,86,0.38)");
  return React.createElement("span",{
    onClick:onClick,
    title:"#"+tag,
    className:"tag-pill" + (small?" small":""),
    style:{
      display:"inline-flex",alignItems:"center",gap:"4px",
      background:  tBg,
      color:       tColor,
      border:      `1px solid ${tBorder}`,
      borderRadius:"5px",
      padding: small ? "2px 7px" : "3px 9px",
      fontSize: small ? "11px" : "12px",
      fontWeight:"500",
      cursor:onClick?"pointer":"default",
      userSelect:"none",
      letterSpacing:"0.2px",
      lineHeight:"1.3",
      maxWidth:"100%",
      overflow:"hidden",
    }
  },
    React.createElement("span",{style:{
      overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
    }}, "#"+tag),
    onRemove && React.createElement("span",{
      onClick:e=>{e.stopPropagation();onRemove(tag);},
      style:{cursor:"pointer",color:tColor,opacity:0.65,marginLeft:"2px",
             fontSize:"13px",lineHeight:1,fontWeight:"bold",flexShrink:0}
    },"×")
  );
};

// ── Tag Editor ─────────────────────────────────────────────────────────────────
const TagEditor = ({tags=[], onChange, allTags=[]}) => {
  const [input,setInput] = React.useState("");
  const [open, setOpen]  = React.useState(false);
  const inputRef = React.useRef(null);

  const suggestions = allTags
    .filter(t=>t.toLowerCase().includes(input.toLowerCase())&&!tags.includes(t))
    .slice(0,8);

  const add = (t) => {
    t = t.trim().replace(/^#/,"").replace(/\s+/g,"_");
    if (t && !tags.includes(t)) onChange([...tags,t]);
    setInput(""); setOpen(false);
  };

  const onKey = (e) => {
    if (["Enter","Tab",","," "].includes(e.key)) { e.preventDefault(); if(input) add(input); }
    else if (e.key==="Backspace" && !input && tags.length) onChange(tags.slice(0,-1));
    else if (e.key==="Escape") setOpen(false);
  };

  return React.createElement("div",{style:{position:"relative"}},
    React.createElement("div",{
      style:{display:"flex",flexWrap:"wrap",gap:"3px",padding:"4px 6px 6px",
        background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"4px",
        cursor:"text",minHeight:"28px",maxHeight:"120px",
        overflow:"auto",
        // Schaalbaar met de muis via resize-handle rechtsonder
        resize:"vertical",
      },
      onClick:()=>inputRef.current?.focus()
    },
      ...tags.map(t=>React.createElement(TagPill,{key:t,tag:t,onRemove:t=>onChange(tags.filter(x=>x!==t)),small:true})),
      React.createElement("input",{
        ref:inputRef,value:input,
        onChange:e=>{setInput(e.target.value);setOpen(true);},
        onKeyDown:onKey,onFocus:()=>setOpen(true),
        onBlur:()=>setTimeout(()=>setOpen(false),150),
        placeholder:tags.length?"":"tag toevoegen…",
        style:{border:"none",background:"transparent",outline:"none",
          fontSize:"14px",color:W.fg,minWidth:"80px",flex:1}
      })
    ),
    open && (suggestions.length>0||input) && React.createElement("div",{
      style:{position:"absolute",top:"100%",left:0,right:0,background:W.bg3,
        border:`1px solid ${W.splitBg}`,borderRadius:"4px",zIndex:200,
        boxShadow:"0 4px 16px rgba(0,0,0,0.5)",marginTop:"2px",overflow:"hidden"}
    },
      input && React.createElement("div",{
        onMouseDown:e=>{e.preventDefault();add(input);},
        style:{padding:"5px 10px",fontSize:"14px",color:W.blue,cursor:"pointer",
          borderBottom:`1px solid ${W.splitBg}`}
      },"+ \"",input,"\" toevoegen"),
      ...suggestions.map(t=>React.createElement("div",{
        key:t,onMouseDown:e=>{e.preventDefault();add(t);},
        style:{padding:"4px 10px",fontSize:"14px",color:W.fg,cursor:"pointer"}
      },"#"+t))
    )
  );
};

// ── VIM Editor met Pencil+Goyo+snippets features ───────────────────────────────
const { useState, useEffect, useRef, useCallback, useMemo } = React;


// ── Canvas-gebaseerde VIM Editor ───────────────────────────────────────────────
// Geen <textarea>: volledige controle over keyboard, cursor en rendering.
// Features:
//   • Escape werkt altijd — browser kan het niet meer onderscheppen
//   • Cursor-kruis: cursorline (horizontaal) + cursorcolumn (vertikaal)
//   • Regelnum­mers perfect uitgelijnd met canvas
//   • Wombat kleurschema, syntax-highlighting
//   • VIM modes: NORMAL / INSERT / COMMAND / SEARCH
//   • Snippets, auto-pairs, undo/redo, zoeken

const FONT_SIZE = 13;
const LINE_H    = 22;   // vaste regelhoogte in pixels
const PAD_LEFT  = 8;    // tekst-padding links van content

// ── Spellcheck woordenlijst (basiswoordenboek EN + NL ingebakken) ─────────────
// We gebruiken de browser-native spellcheck via een verborgen <textarea> techniek:
// woorden worden gecheckt door tijdelijk in een spellcheck-enabled element te plaatsen.
// Daarnaast houden we een eigen "learned words" set bij (per sessie + vault-woorden).

// ── App (zie modules/ voor componenten) ─────────────────────────────────────

// ── Offline badge component ────────────────────────────────────────────────
const OfflineBadge = () => {
  const [state,  setState]  = React.useState(() =>
    navigator.onLine ? "online" : "offline"
  );
  const [queued, setQueued] = React.useState(() => {
    // Laad pending count direct uit localStorage — werkt ook na refresh
    try { return JSON.parse(localStorage.getItem("zk_offline_pending") || "[]").length; }
    catch { return 0; }
  });

  React.useEffect(() => {
    // Herstel offline-staat als we al offline zijn bij mount
    if (!navigator.onLine) setState("offline");

    const onOnline  = () => {
      setState("syncing");
      setTimeout(() => { if (navigator.onLine) setState("online"); }, 4000);
    };
    const onOffline = () => setState("offline");
    const onSync    = (e) => {
      const { processed = 0 } = e.detail || {};
      setQueued(0);
      if (processed > 0) {
        setState("syncing");
        setTimeout(() => setState("online"), 3000);
      } else {
        setState("online");
      }
    };
    const onUpdate  = () => setState("update");
    // OfflineStore stuurt dit event bij elke pending-wijziging
    const onPending = (e) => {
      const count = e.detail?.count ?? 0;
      setQueued(count);
      if (count > 0 && navigator.onLine) setState("queued");
      if (count === 0 && state !== "syncing") setState("online");
    };

    window.addEventListener("zk-online",         onOnline);
    window.addEventListener("zk-offline",        onOffline);
    window.addEventListener("zk-sync-complete",  onSync);
    window.addEventListener("zk-sw-update",      onUpdate);
    window.addEventListener("zk-pending-change", onPending);
    return () => {
      window.removeEventListener("zk-online",         onOnline);
      window.removeEventListener("zk-offline",        onOffline);
      window.removeEventListener("zk-sync-complete",  onSync);
      window.removeEventListener("zk-sw-update",      onUpdate);
      window.removeEventListener("zk-pending-change", onPending);
    };
  }, [state]);

  // Verborgen als alles normaal is
  if (state === "online") return null;

  const cfg = {
    offline:  { bg:"rgba(229,120,109,.15)", border:"rgba(229,120,109,.35)", color:"#e5786d", label:"⚡ Offline",         pulse:false },
    syncing:  { bg:"rgba(138,198,242,.15)", border:"rgba(138,198,242,.35)", color:"#8ac6f2", label:"⟳ Synchroniseren…", pulse:true  },
    queued:   { bg:"rgba(234,231,136,.12)", border:"rgba(234,231,136,.3)",  color:"#eae788",
                label:`⏳ ${queued} in wachtrij — tik om te synchroniseren`, pulse:false },
    update:   { bg:"rgba(159,202,86,.12)",  border:"rgba(159,202,86,.35)",  color:"#9fca56", label:"↑ Update beschikbaar", pulse:false },
  }[state] || {};

  const handleClick = async () => {
    if (state === "update") {
      // Forceer SW-update vóór herladen (belangrijk op iOS)
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        await reg?.update();
        if (reg?.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      } catch {}
      window.location.reload();
      return;
    }
    if (state === "queued") {
      setState("syncing");
      // Probeer SW-sync én directe queue sync
      Promise.all([
        window._zkSW?.syncNow?.() || Promise.resolve(),
        window._zkSyncQueue?.()   || Promise.resolve(),
      ]).then(() => setState("online"));
    }
  };

  return React.createElement("div", {
    title: state === "offline"
      ? "Offline — wijzigingen worden bewaard en gesynchroniseerd zodra de verbinding terugkeert"
      : state === "queued"
      ? `${queued} wijziging(en) wachten — klik om direct te synchroniseren`
      : state === "update"
      ? "Klik om de nieuwe versie te laden"
      : "Bezig met synchroniseren…",
    onClick: handleClick,
    style:{
      padding:"2px 10px", borderRadius:"10px", fontSize:"12px", fontWeight:"500",
      flexShrink:0, cursor: state === "update" ? "pointer" : "default",
      background:  cfg.bg,
      color:       cfg.color,
      border:      `1px solid ${cfg.border}`,
      animation:   cfg.pulse ? "ai-pulse 1.5s ease-in-out infinite" : "none",
      userSelect:  "none",
    }
  }, cfg.label);
};

// ── LiveSync — poll elke 30s of andere apparaten wijzigingen hebben gemaakt ──
const App = () => {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  // ── Notities-state (gedelegeerd aan NoteStore + NotesTab) ───────────────────
  const [notes,    setNotes]   = useState([]);   // gespiegeld vanuit NoteStore
  const [syncToast, setSyncToast] = useState(null); // "↺ Notities bijgewerkt" melding
  const [canvasPendingNotes, setCanvasPendingNotes] = useState(null); // noteIds wachten op canvas
  const [goyoMode, setGoyoMode] = useState(false); // App-level: beïnvloedt topbar
  const [splitMode,  setSplitMode]  = useState(false);
  const [splitTab,   setSplitTab]   = useState("daily");
  const splitBarRef = React.useRef(null); // tabbar scroll ref
  const [splitFocus, setSplitFocus] = useState("left");  // "left" | "right"
  const [splitLeft,  setSplitLeft]  = useState("notes"); // "notes" | "whiteboard"
  // Tellers om focus te triggeren bij split-wissel
  const [editorFocusTrigger, setEditorFocusTrigger] = React.useState(0);
  const [searchFocusTrigger, setSearchFocusTrigger] = React.useState(0);

  // Stuur focus naar het juiste paneel bij elke split-wissel
  React.useEffect(() => {
    if (!splitMode) return;
    if (splitFocus === "left")  setEditorFocusTrigger(n => n + 1);
    if (splitFocus === "right" && splitTab === "search") setSearchFocusTrigger(n => n + 1);
  }, [splitFocus, splitMode]);
  // Queue van blokken die in de linker notitie geplakt moeten worden
  // {text, source, page, url} — afkomstig van PDF/search/images rechter paneel
  const [pasteQueue, setPasteQueue] = useState([]);

  // Verwerk VIM split-commando's vanuit VimEditor
  const handleSplitCmd = React.useCallback((cmd) => {
    if (cmd === "vs") { setSplitMode(true); setSplitFocus("right"); }
    else if (cmd === "close" || cmd === "only") { setSplitMode(false); setSplitFocus("left"); }
    else if (cmd === "focus-right") { if (splitMode) setSplitFocus("right"); }
    else if (cmd === "focus-left")  { setSplitFocus("left"); }
    else if (cmd.startsWith("edit:")) {
      // :e notitienaam — open notitie in huidige focus
      const title = cmd.slice(5).trim();
      const found = notes.find(n => n.title?.toLowerCase() === title.toLowerCase());
      if (found) setSelId(found.id);
    }
  }, [splitMode, notes]);

  // Plak een blok (uit rechter paneel) in de actieve notitie links
  const handlePasteToNote = React.useCallback((block) => {
    // block = {text, source, page, url, type?}
    // type "ai" → [!ai] callout, anders [!cite]
    const isAI = block.type === "ai" || (!block.page && !block.url && block.source && !block.source.match(/\.pdf$/i));
    const callout = isAI ? "[!ai]" : "[!cite]";
    const lines = [];
    lines.push("");
    lines.push(`> ${callout}`);
    if (block.source) lines.push(`> **${isAI ? "Model" : "Bron"}:** ${block.source}`);
    if (block.page)   lines.push(`> **Pagina:** ${block.page}`);
    if (block.url)    lines.push(`> **URL:** ${block.url}`);
    lines.push(">");
    block.text.split("\n").forEach(l => lines.push("> " + l));
    lines.push("");
    setPasteQueue(q => [...q, lines.join("\n")]);
  }, []);
  const [selId,    setSelId]   = useState(null);
  const [splitSelId, setSplitSelId] = useState(null); // rechter paneel notitie-preview
  const [tab,      setTab]     = useState("today");
  const [pdfNotes,     setPdfNotes]    = useState([]);
  const [imgNotes,     setImgNotes]    = useState([]);
  const [serverPdfs,   setServerPdfs]  = useState([]);
  // Voor "Lees dit boek" vanuit BookLibrary: welk PDF-bestand moet de
  // PDF-hub bij het volgende bezoek automatisch openen.
  const [openPdfName,  setOpenPdfName] = useState(null);
  const [isOffline,    setIsOffline]   = useState(!navigator.onLine);
  const [serverImages, setServerImages]= useState([]);
  // Verwijder embedding-modellen uit opgeslagen model
  const _savedModel = localStorage.getItem("zk_model") || "gemma3:12b";
  const EMBED_PATS = ["embed","nomic","mxbai","bge","e5-"];
  const _cleanModel = EMBED_PATS.some(p=>_savedModel.toLowerCase().includes(p))
    ? "gemma3:12b" : _savedModel;
  const [llmModel,     setLlmModel]    = useState(_cleanModel);
  const [aiMindmap,    setAiMindmap]   = useState(null);
  const [showSettings, setShowSettings]= useState(false);
  const [vaultPath,    setVaultPath]   = useState("…");
  const [loaded,       setLoaded]      = useState(false);
  const [error,        setError]       = useState(null);
  const [sidebarOpen,  setSidebarOpen] = useState(false);
  const [aiStatus,      setAiStatus]    = useState(null);  // legacy (enkele taak)
  const [jobs,          setJobs]         = useState([]);    // [{id,type,label,status,result,error}]
  const [jobsPanelOpen, setJobsPanelOpen] = useState(false);
  const abortControllers = React.useRef(new Map()); // jobId → AbortController
  const [importPreview, setImportPreview] = useState(null); // resultaat URL-import (overleeft tab-wissel)
  const [serverOnline, setServerOnline] = useState(true);   // server bereikbaar?
  const serverCheckRef = React.useRef(null);

  // ── Server health check ─────────────────────────────────────────────────
  React.useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("/api/notes", {method:"HEAD", signal: AbortSignal.timeout(3000)});
        setServerOnline(r.ok || r.status < 500);
      } catch {
        setServerOnline(false);
      }
    };
    check(); // direct bij start
    serverCheckRef.current = setInterval(check, 10000);
    return () => clearInterval(serverCheckRef.current);
  }, []);

  // ── Live sync: poll voor wijzigingen van andere apparaten ─────────────────
  React.useEffect(() => {
    let lastHash = null;
    let toastTimer = null;

    let buildTs = null; // bijhouden van app-versie

    const poll = async () => {
      try {
        // ── Check 1: app-versie (detecteert nieuwe deployments) ─────────────
        const bv = await fetch("/api/build-version", { cache: "no-store" })
          .then(r => r.ok ? r.json() : null).catch(() => null);
        if (bv?.ts) {
          if (buildTs === null) {
            buildTs = bv.ts;
          } else if (bv.ts !== buildTs) {
            buildTs = bv.ts;
            window._zkSwUpdateReady = true;
            window.dispatchEvent(new CustomEvent("zk-sw-update"));
          }
        }

        // ── Check 2: notitie-wijzigingen van andere apparaten ──────────────
        const r = await fetch("/api/notes-version", { cache: "no-store" });
        if (!r.ok) { return; }
        const data = await r.json();
        const hash = data?.hash;
        if (!hash) return;

        if (lastHash === null) { lastHash = hash; return; }
        if (hash === lastHash) return;

        // Hash veranderd: herlaad notities
        lastHash = hash;
        const r2 = await fetch("/api/notes", { cache: "no-store" });
        if (!r2.ok) return;
        const fresh = await r2.json();
        if (Array.isArray(fresh) && fresh.length > 0) {
          setNotes(fresh);
          setSyncToast("↺ Notities bijgewerkt");
          clearTimeout(toastTimer);
          toastTimer = setTimeout(() => setSyncToast(null), 3500);
        }
      } catch(e) { /* server niet bereikbaar */ }
    };

    const onFocus   = () => poll();
    const onVisible = () => { if (document.visibilityState === "visible") poll(); };

    window.addEventListener("focus",            onFocus);
    window.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(poll, 15_000);
    poll(); // eerste check meteen

    return () => {
      clearInterval(interval);
      clearTimeout(toastTimer);
      window.removeEventListener("focus",            onFocus);
      window.removeEventListener("visibilitychange", onVisible);
    };
  }, []); // stabiel — geen dependencies

  // Jobs API — te gebruiken vanuit child-componenten
  const addJob = React.useCallback((job) => {
    // job = {id, type, label, signal?}  → status wordt "running"
    // Als job een AbortController meestuurt, registreer hem
    if (job.controller) {
      abortControllers.current.set(job.id, job.controller);
    }
    const { controller, ...safeJob } = job;
    setJobs(prev => [...prev, {...safeJob, status:"running", ts: Date.now()}]);
  }, []);
  const updateJob = React.useCallback((id, patch) => {
    // Als de job klaar is, verwijder de AbortController
    if (patch.status && patch.status !== "running") {
      abortControllers.current.delete(id);
    }
    setJobs(prev => prev.map(j => j.id===id ? {...j,...patch} : j));
  }, []);
  const removeJob = React.useCallback((id) => {
    abortControllers.current.delete(id);
    setJobs(prev => prev.filter(j => j.id!==id));
  }, []);
  const cancelJob = React.useCallback((id) => {
    // Abort de fetch én markeer als geannuleerd in de UI
    const ctrl = abortControllers.current.get(id);
    if (ctrl) { ctrl.abort(); abortControllers.current.delete(id); }
    setJobs(prev => prev.map(j => j.id===id
      ? {...j, status:"error", error:"Geannuleerd door gebruiker"}
      : j));
  }, []);
  const clearDoneJobs = React.useCallback(() => {
    setJobs(prev => prev.filter(j => j.status==="running"));
  }, []);

  const runningJobs = jobs.filter(j => j.status==="running");
  const doneJobs    = jobs.filter(j => j.status!=="running");

  // Sluit job-panel bij klik buiten
  React.useEffect(()=>{
    if(!jobsPanelOpen) return;
    const h=()=>setJobsPanelOpen(false);
    setTimeout(()=>document.addEventListener("click",h),0);
    return ()=>document.removeEventListener("click",h);
  },[jobsPanelOpen]);

  const {w: winW} = useWindowSize();
  const isMobile  = winW < 768;
  const isTablet  = winW >= 768 && winW < 1200;
  const isDesktop = winW >= 1200;

  // Op desktop sidebar altijd open; tablet/mobile via toggle
  const showSidebar  = isDesktop || sidebarOpen;
  const sidebarW     = isMobile ? Math.min(winW - 40, 320) : 240;

  // ── CSS animaties voor AI indicator ──────────────────────────────────────
  React.useEffect(()=>{
    if(document.getElementById("zk-ai-css")) return;
    const s=document.createElement("style");
    s.id="zk-ai-css";
    s.textContent=`
      @keyframes ai-pulse       { 0%,100%{opacity:1} 50%{opacity:0.45} }
      @keyframes ai-dot         { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.6);opacity:0.7} }
      @keyframes progress-slide { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }
      @keyframes fadeIn         { from{opacity:0;transform:translateY(-3px)} to{opacity:1;transform:translateY(0)} }
    `;
    document.head.appendChild(s);
  },[]);

  // ── Data laden ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        // NoteStore + AnnotationStore laden data — App spiegelt via subscribe
        // Promise.allSettled: start ook bij gedeeltelijk offline
        const results = await Promise.allSettled([
          NoteStore.load(),           // 0: notities
          AnnotationStore.load(),     // 1: pdf-annotaties
          api.get("/img-annotations"),// 2: afbeelding-annotaties
          api.get("/pdfs"),           // 3: pdf-lijst
          api.get("/images"),         // 4: afbeeldingen
          api.get("/config"),         // 5: config
        ]);
        const ok  = v => v?.status === "fulfilled" ? v.value : null;
        const ns  = ok(results[0]) || [];
        const as  = ok(results[1]) || [];
        const ias = ok(results[2]) || [];
        const ps  = ok(results[3]) || [];
        const imgs= ok(results[4]) || [];
        const cfg = ok(results[5]) || {};
        const anyOffline = results.some(r => r.status === "rejected");
        if (anyOffline) setIsOffline(true);
        setNotes(ns); setPdfNotes(as); setImgNotes(ias||[]); setServerPdfs(ps); setServerImages(imgs||[]);
        setVaultPath(cfg.vault_path || "…");
        if (ns.length > 0) setSelId(ns[0].id);
        setLoaded(true);
      } catch(e) {
        // Onverwachte fout (bijv. SW nog niet actief bij eerste bezoek)
        setIsOffline(!navigator.onLine);
        setError(
          navigator.onLine
            ? "Kan server niet bereiken.\nStart de server met: python3 server.py"
            : "Offline — notities laden zodra verbinding hersteld is."
        );
        // Probeer toch notities te laden uit SW-cache
        try {
          const ns = await NoteStore.load().catch(()=>[]);
          if ((ns||[]).length) {
            setNotes(ns); setSelId(ns[0].id);
            setError(null); setLoaded(true);
          } else {
            // Cache leeg — nog nooit verbonden geweest
            setError(
              "📲 Offline — nog geen data gecached.\n\n"
              + "Open de app eerst terwijl de laptop bereikbaar is.\n"
              + "Daarna werkt offline-modus automatisch."
            );
          }
        } catch {}
      }
    };
    // Subscribe: NoteStore of AnnotationStore wijzigt → App-state bijwerken
    const unsubNotes  = NoteStore.subscribe(ns => setNotes([...ns]));
    const unsubAnnots = AnnotationStore.subscribe(as => setPdfNotes([...as]));
    load();
    return () => { unsubNotes(); unsubAnnots(); };
  }, []);

  const refreshPdfs   = async () => { setServerPdfs(await PDFService.listPdfs()); };

  // ── Online/offline detectie ───────────────────────────────────────────
  React.useEffect(() => {
    const goOnline = async () => {
      setIsOffline(false);
      window.dispatchEvent(new CustomEvent("zk-online"));
    };
    const goOffline = () => {
      setIsOffline(true);
      window.dispatchEvent(new CustomEvent("zk-offline"));
    };
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  const refreshImages = async () => { setServerImages(await api.get("/images")||[]); };

  // ── Note helpers (allTags is nog nodig voor andere tabs) ─────────────────
  const allTags = useMemo(() => [...new Set([
    ...notes.flatMap(n => n.tags||[]),
    ...pdfNotes.flatMap(p => p.tags||[])
  ])], [notes, pdfNotes]);

  // ── Tag-beheer functies ───────────────────────────────────────────────────
  const handleMergeTags = useCallback(async (fromTags, toTag) => {
    // Vervang alle fromTags door toTag in alle notities
    const toSlug = toTag.trim().toLowerCase().replace(/\s+/g,"_").replace(/^#/,"");
    const updated = NoteStore.getAll().map(n => {
      const tags = n.tags || [];
      if (!fromTags.some(f => tags.includes(f))) return n;
      const newTags = [...new Set(tags.map(t => fromTags.includes(t) ? toSlug : t))];
      return {...n, tags: newTags, modified: new Date().toISOString()};
    });
    for (const n of updated) await NoteStore.save(n);
    setNotes([...NoteStore.getAll()]);
  }, []);

  const handleRenameTag = useCallback(async (oldTag, newTag) => {
    const toSlug = newTag.trim().toLowerCase().replace(/\s+/g,"_").replace(/^#/,"");
    if (!toSlug || toSlug === oldTag) return;
    await handleMergeTags([oldTag], toSlug);
  }, [handleMergeTags]);

  const handleDeleteTag = useCallback(async (tag) => {
    const updated = NoteStore.getAll().map(n => {
      if (!(n.tags||[]).includes(tag)) return n;
      return {...n, tags:(n.tags||[]).filter(t=>t!==tag), modified:new Date().toISOString()};
    });
    for (const n of updated) await NoteStore.save(n);
    setNotes([...NoteStore.getAll()]);
  }, []);

  // ── Error / loading ───────────────────────────────────────────────────────
  if (error) return React.createElement("div", {
    style:{display:"flex",alignItems:"center",justifyContent:"center",
           height:"100vh",background:W.bg,color:W.fg,
           flexDirection:"column",gap:"16px",padding:"32px",textAlign:"center"}
  },
    React.createElement("div", {style:{fontSize:"36px"}}, "⚠️"),
    React.createElement("div", {style:{fontSize:"15px",color:W.orange}}, "Server niet bereikbaar"),
    React.createElement("pre", {style:{fontSize:"14px",color:W.fgMuted,
      background:W.bg2,padding:"16px",borderRadius:"8px",
      border:`1px solid ${W.splitBg}`,lineHeight:"1.8",maxWidth:"400px",
      whiteSpace:"pre-wrap",textAlign:"left"}}, error),
    React.createElement("div", {style:{fontSize:"14px",color:W.fgDim}},
      "Zorg dat server.py draait, ververs dan de pagina.")
  );

  const MAIN_TABS = [
    { id:"today",      icon:"⚡", label:"Vandaag",     sub: null },
    { id:"notes",      icon:"📝", label:"Schrijven",   sub: null },
    { id:"whiteboard", icon:"🎨", label:"Canvas",      sub: null },
    { id:"library",    icon:"📚", label:"Bibliotheek", sub: [
        {id:"pdf",          icon:"📄", label:"PDF"},
        {id:"images",       icon:"🖼",  label:"Plaatjes"},
        {id:"reading",      icon:"📖", label:"Leeslijst"},
        {id:"review",       icon:"🔁", label:"Review"},
        {id:"tasks",        icon:"✓",  label:"Taken"},
        {id:"annotations",  icon:"✦",  label:"Annotaties"},
        {id:"books",        icon:"📚", label:"Boeken"},
    ]},
    { id:"discover",   icon:"🔍", label:"Ontdekken",   sub: [
        {id:"search",   icon:"🔍", label:"Zoeken"},
        {id:"semantic", icon:"🧠", label:"Semantisch"},
        {id:"graph",    icon:"🕸",  label:"Graaf"},
        {id:"mindmap",  icon:"🗺",  label:"Mindmap"},
        {id:"llm",      icon:"🧠", label:"Notebook"},
        {id:"query",    icon:"🔎", label:"Query"},
        {id:"tags",     icon:"🏷",  label:"Tags"},
    ]},
    { id:"input",      icon:"🌐", label:"Invoer",      sub: [
        {id:"import",    icon:"🌐", label:"URL / Word"},
        {id:"stats",     icon:"📊", label:"Statistieken"},
    ]},
];

  // Bepaal welke hoofdtab actief is op basis van de huidige subtab
  const activeMain = React.useMemo(() => {
    for (const mt of MAIN_TABS) {
      if (mt.id === tab) return mt.id;              // standalone tab
      if (mt.sub?.some(s => s.id === tab)) return mt.id;  // subtab
    }
    return "notes";
  }, [tab]);

  // Haal subtabs op voor actieve hoofdtab
  const activeSubs = React.useMemo(() => {
    const mt = MAIN_TABS.find(m => m.id === activeMain);
    return mt?.sub || null;
  }, [activeMain]);

  // Globale hooks — moeten vóór conditionele return staan
  const [, _forceRender] = React.useState(0);
  React.useEffect(() => {
    window._zkForceUpdate   = () => _forceRender(n => n + 1);
    window._zkRefreshNotes  = () => setNotes([...NoteStore.getAll()]);
    window._zkHardRefresh   = async () => {
      // Herlaad notities ECHT van de server (niet uit cache)
      try {
        const r = await fetch("/api/notes", { cache: "no-store" });
        if (!r.ok) return;
        const fresh = await r.json();
        if (Array.isArray(fresh)) {
          setNotes(fresh);
          // Sync ook naar NoteStore intern
          NoteStore.load().catch(() => {});
        }
      } catch { /* offline */ }
    };
    window._sendToCanvas = (noteIds) => { setCanvasPendingNotes(noteIds); setTab("whiteboard"); };
    window._showInGraph  = (noteId)  => { setTab("graph"); setTimeout(()=>window._graphCenterNode?.(noteId),200); };
    window._sendToCanvas = (noteIds) => { setCanvasPendingNotes(noteIds); setTab("whiteboard"); };
    window._showInGraph  = (noteId)  => { setTab("graph"); setTimeout(()=>window._graphCenterNode?.(noteId),200); };
    // _switchToTab: vanuit Whiteboard/Graph naar een tab navigeren
    window._switchToTab = (tabId) => setTab(tabId);
    // _graphToNotebook: vanuit Graaf een context-bericht naar Notebook sturen
    window._graphToNotebook = (msg) => {
      window._notebookPrefill = msg;
      setTab("llm");
    };
    // Pas body-achtergrond aan op het actieve thema
    document.body.style.background = W.bg;
    document.documentElement.style.setProperty("--zk-bg", W.bg);
    document.documentElement.style.setProperty("--zk-fg", W.fg);
    return () => {
      window._zkRefreshNotes  = null;
      window._zkHardRefresh   = null;
      window._sendToCanvas    = null;
      window._showInGraph     = null;
      window._sendToCanvas    = null;
      window._showInGraph     = null;
      window._sendToCanvas    = null;
      window._showInGraph     = null;
      window._zkForceUpdate   = null;
      window._switchToTab     = null;
      window._graphToNotebook = null;
    };
  }, []);

  if (!loaded) return React.createElement("div", {
    style:{display:"flex",alignItems:"center",justifyContent:"center",
           height:"100vh",background:W.bg,color:W.blue,fontSize:"14px"}
  }, "Zettelkasten laden…");

  // ── NotesTab: vervangt sidebar, editor, preview, meta, mermaid-overlay ─────
  // Alle notitie-logica is gedelegeerd aan NotesTab (SOLID stap 1).
  const notesTabEl = React.createElement(NotesTab, {
    notes,
    allTags,
    selectedId:     selId,
    onSelectNote:   id => setSelId(id),
    onNotesChange:  async (updated) => { if(updated?.length) { for(const n of updated) await NoteStore.save(n); } setNotes([...NoteStore.getAll()]); },
    serverPdfs,
    serverImages,
    llmModel,
    isMobile,
    isDesktop,
    isTablet,
    splitMode,
    sidebarOpen,
    onSidebarToggle: open => setSidebarOpen(typeof open === "boolean" ? open : p => !p),
    goyoMode,
    onGoyoChange:   setGoyoMode,
    onSplitCmd:     handleSplitCmd,
    pasteQueue,
    onPasteConsumed: () => setPasteQueue(q => q.slice(1)),
    editorFocusTrigger,
  });

  // Houd sidebarOverlay hier — het is App-layout, niet notitie-logica
  // Alleen op mobiel (niet tablet) — tablet heeft eigen inklapbare sidebar in NotesTab
  const sidebarOverlay = isMobile && sidebarOpen && React.createElement(React.Fragment, null,
    React.createElement("div", {
      onClick: () => setSidebarOpen(false),
      style: { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)",
               zIndex:100, backdropFilter:"blur(2px)" }
    }),
    React.createElement("div", {
      style: { position:"fixed", top:0, left:0, bottom:0,
               width:`${sidebarW}px`, zIndex:101,
               boxShadow:"4px 0 20px rgba(0,0,0,0.5)",
               display:"flex", flexDirection:"column" }
    },
      // NoteList sidebar-inhoud via NotesTab (doorgeven als ref is niet nodig — NotesTab
      // beheert de lijst zelf intern; de overlay toont gewoon de nesting)
      React.createElement(NotesTab, {
        notes, allTags, selectedId: selId,
        onSelectNote:   id => setSelId(id),
        onNotesChange:  async (updated) => { if(updated?.length) { for(const n of updated) await NoteStore.save(n); } setNotes([...NoteStore.getAll()]); },
        serverPdfs, serverImages, llmModel,
        isMobile: true, isDesktop: false, isTablet: false,
        sidebarOpen: true,
        onSidebarToggle: () => setSidebarOpen(false),
        goyoMode, onGoyoChange: setGoyoMode,
      })
    )
  );

  // ── Tab definitie ────────────────────────────────────────────────────────
  // ── Hoofd-tabs met subtab-structuur ─────────────────────────────────────────
  // Elke hoofdtab heeft een standaard subtab (eerste kind)
  // Bij klikken op hoofdtab: open de eerste subtab (of notes direct)
  const handleMainTab = (mainId) => {
    const mt = MAIN_TABS.find(m => m.id === mainId);
    if (!mt) return;
    if (!mt.sub) { setTab(mainId); return; }  // standalone tab (bijv. Canvas)
    if (mt.sub.some(s => s.id === tab)) return;
    setTab(mt.sub[0].id);
  };

  // Mobile tabs = alleen de hoofdtabs
  const tabs = MAIN_TABS;

  // ── Top bar (desktop/tablet) ──────────────────────────────────────────────
  const topBar = !isMobile && React.createElement("div", {
    style:{height:"44px",background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,
           display:"flex",alignItems:"center",flexShrink:0,gap:0,
           overflow:"visible",  // nooit knippen — anders verdwijnt de jobs-dropdown
           position:"relative", zIndex:200}  // zorg dat dropdown boven content zweeft
  },
    // Logo — op tablet compacter
    React.createElement("div", {
      style:{background:"transparent",color:W.statusFg,
             padding: isTablet ? "0 10px" : "0 20px",
             height:"100%",display:"flex",alignItems:"center",
             fontWeight:"700",fontSize: isTablet ? "12px" : "14px",
             letterSpacing: isTablet ? "1px" : "3px",
             flexShrink:0,borderRight:`1px solid ${W.splitBg}`}
    }, isTablet ? "ZK" : "ZETTELKASTEN"),
    isTablet && React.createElement("button", {
      onClick: () => setSidebarOpen(p => !p),
      style:{background:sidebarOpen?W.blueBg2:"none",
             border:"none",borderRight:`1px solid ${W.splitBg}`,
             color:sidebarOpen?W.blue:W.fgMuted,
             padding:"0 10px",height:"100%",
             fontSize:"16px",cursor:"pointer",flexShrink:0}
    }, "☰"),
    // Scrollbare tab-strip — krijgt zo veel mogelijk ruimte
    React.createElement("div", {
      className: "tab-scroll-strip",
      style:{
        display:"flex", alignItems:"center", flex:1, minWidth:0,
        overflowX:"auto", overflowY:"hidden",
        WebkitOverflowScrolling:"touch",
        height:"100%",
      },
    },
      // Hoofdtab-knoppen
      MAIN_TABS.map(({id, icon, label}) => {
        const isActive = activeMain === id;
        return React.createElement("button", {
          key:id,
          onClick: () => handleMainTab(id),
          className: `topbar-tab${isActive?" active":""}`,
          style:{
            borderRight: `1px solid ${W.splitBg}`,
            flexShrink: 0,
            whiteSpace: "nowrap",
            borderBottom: isActive ? `2px solid ${W.yellow}` : "2px solid transparent",
            padding: isTablet ? "0 10px" : undefined,
            fontSize: isTablet ? "18px" : undefined,
            gap: isTablet ? "0" : undefined,
          }
        },
          React.createElement("span", {style:{fontSize: isTablet ? "18px" : "14px", lineHeight:1}}, icon),
          !isTablet && React.createElement("span", null, label)
        );
      })
    ),
    // Rechter knoppen — op tablet sterk ingekort
    React.createElement("div", {style:{
      padding:"0 4px", display:"flex", gap:"3px",
      alignItems:"center", flexShrink:0,
    }},
      // Offline/sync badge
      React.createElement(OfflineBadge, null),
      // Jobs indicator
      (jobs.length > 0) && React.createElement("div",{style:{position:"relative"}},
        React.createElement("button",{
          onClick: e => { e.stopPropagation(); setJobsPanelOpen(p=>!p); },
          style:{
            display:"flex", alignItems:"center", gap:"4px",
            background: runningJobs.length>0
              ? (W.dark?"rgba(138,198,242,0.1)":W.blueBg||"rgba(26,58,106,0.10)")
              : W.commentBg,
            border: `1px solid ${runningJobs.length>0
              ? (W.blueBorder||"rgba(138,198,242,0.35)")
              : (W.commentBorder||"rgba(159,202,86,0.35)")}`,
            borderRadius:"20px",
            padding: isTablet ? "3px 8px" : "3px 11px",
            cursor:"pointer",
            color: runningJobs.length>0 ? (W.blue||"#8ac6f2") : W.comment,
            fontSize:"14px",
            animation: runningJobs.length>0 ? "ai-pulse 1.4s ease-in-out infinite" : "none",
          }
        },
          runningJobs.length>0
            ? React.createElement("span",{style:{display:"inline-block",width:"7px",height:"7px",
                borderRadius:"50%",background:W.blue||"#8ac6f2",flexShrink:0,
                animation:"ai-dot 1.4s ease-in-out infinite"}})
            : React.createElement("span",null,"✓"),
          // Op tablet: alleen getal, geen label
          isTablet
            ? (runningJobs.length>0 ? runningJobs.length : doneJobs.length)
            : (runningJobs.length>0
                ? (runningJobs.length===1 ? runningJobs[0].label : runningJobs.length+" taken actief")
                : doneJobs.length+" klaar")
        ),
        jobsPanelOpen && React.createElement("div",{
          onClick: e=>e.stopPropagation(),
          style:{position:"absolute",top:"calc(100% + 8px)",right:0,width:"320px",
                 background:W.bg2,border:`1px solid ${W.splitBg}`,borderRadius:"10px",
                 boxShadow:"0 12px 40px rgba(0,0,0,0.7)",zIndex:2000,overflow:"hidden",
                 animation:"fadeIn 0.14s ease-out"}
        },
          React.createElement("div",{style:{padding:"10px 14px",borderBottom:`1px solid ${W.splitBg}`,
            display:"flex",alignItems:"center",justifyContent:"space-between"}},
            React.createElement("span",{style:{fontSize:"14px",color:W.fgMuted,letterSpacing:"1px"}},"ACHTERGRONDTAKEN"),
            React.createElement("div",{style:{display:"flex",gap:"6px",alignItems:"center"}},
              doneJobs.length>0 && React.createElement("button",{onClick:clearDoneJobs,
                style:{background:"none",border:"none",color:W.fgMuted,fontSize:"14px",cursor:"pointer",textDecoration:"underline",padding:"0"}},"wis klaar"),
              React.createElement("button",{onClick:()=>setJobsPanelOpen(false),
                style:{background:"none",border:"none",color:W.fgMuted,fontSize:"16px",cursor:"pointer",padding:"0 2px",lineHeight:1}},"×")
            )
          ),
          React.createElement("div",{style:{maxHeight:"340px",overflowY:"auto"}},
            jobs.length===0
              ? React.createElement("div",{style:{padding:"20px",color:W.fgMuted,fontSize:"14px",textAlign:"center"}},"Geen taken")
              : [...jobs].reverse().map(job =>
                  React.createElement("div",{key:job.id,
                    style:{padding:"10px 14px",borderBottom:`1px solid ${W.splitBg||"rgba(255,255,255,0.04)"}`,
                           display:"flex",alignItems:"flex-start",gap:"10px"}},
                    React.createElement("span",{style:{fontSize:"14px",marginTop:"1px",flexShrink:0,
                      animation:job.status==="running"?"ai-dot 1.4s ease-in-out infinite":"none"}},
                      job.status==="running"?"⏳":job.status==="done"?"✓":"✕"),
                    React.createElement("div",{style:{flex:1,minWidth:0}},
                      React.createElement("div",{style:{fontSize:"14px",
                        color:job.status==="running"?W.fg:job.status==="done"?W.comment:W.orange,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},job.label),
                      job.status==="running" && React.createElement("div",{style:{marginTop:"5px",height:"2px",
                        borderRadius:"1px",background:"rgba(255,255,255,0.08)",overflow:"hidden"}},
                        React.createElement("div",{style:{height:"100%",width:"40%",borderRadius:"1px",
                          background:W.blue,animation:"progress-slide 1.4s ease-in-out infinite"}})),
                      job.error && React.createElement("div",{style:{fontSize:"13px",color:W.orange,
                        marginTop:"3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},job.error),
                      job.result && React.createElement("div",{style:{fontSize:"13px",color:W.fgMuted,
                        marginTop:"3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},job.result),
                      job.type==="import" && job.status==="done" && job.importResult &&
                        React.createElement("button",{
                          onClick:()=>{setImportPreview(job.importResult);setTab("import");setJobsPanelOpen(false);},
                          style:{marginTop:"5px",background:"rgba(138,198,242,0.1)",
                                 border:"1px solid rgba(138,198,242,0.35)",borderRadius:"5px",
                                 padding:"3px 10px",color:"#a8d8f0",fontSize:"13px",
                                 cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"4px"}
                        },"→ bekijk & bewerk")
                    ),
                    job.status==="running"
                      ? React.createElement("button",{
                          onClick:()=>cancelJob(job.id),
                          title:"Annuleer deze taak",
                          style:{background:"rgba(229,120,109,0.12)",
                                 border:"1px solid rgba(229,120,109,0.3)",
                                 color:W.orange,borderRadius:"4px",
                                 fontSize:"11px",cursor:"pointer",
                                 padding:"2px 7px",flexShrink:0,
                                 lineHeight:1.4,whiteSpace:"nowrap"}},"✕ stop")
                      : React.createElement("button",{
                          onClick:()=>removeJob(job.id),
                          style:{background:"none",border:"none",color:W.fgMuted,
                                 fontSize:"14px",cursor:"pointer",padding:"0",flexShrink:0}},"×")
                  ))
          )
        )
      ),
      // Stats badges — alleen op desktop
      !isTablet && React.createElement("div",{style:{display:"flex",alignItems:"baseline",gap:"3px",
        background:"rgba(229,192,123,0.13)",border:"1px solid rgba(229,192,123,0.32)",
        borderRadius:"6px",padding:"4px 10px"}},
        React.createElement("span",{style:{fontSize:"14px",fontWeight:"700",color:W.yellow,
          letterSpacing:"-0.5px",lineHeight:1}},notes.length),
        React.createElement("span",{style:{fontSize:"9px",color:"rgba(229,192,123,0.7)",
          letterSpacing:"0.8px",textTransform:"uppercase"}},"zettels")
      ),
      !isTablet && React.createElement("div",{style:{display:"flex",alignItems:"baseline",gap:"3px",
        background:"rgba(159,202,86,0.13)",border:"1px solid rgba(159,202,86,0.32)",
        borderRadius:"6px",padding:"4px 10px"}},
        React.createElement("span",{style:{fontSize:"14px",fontWeight:"700",color:W.comment,
          letterSpacing:"-0.5px",lineHeight:1}},allTags.length),
        React.createElement("span",{style:{fontSize:"9px",color:"rgba(159,202,86,0.7)",
          letterSpacing:"0.8px",textTransform:"uppercase"}},"tags")
      ),
    ),
    // Split-knop — tablet: alleen icoon
    React.createElement("button", {
      onClick:()=>setSplitMode(p=>!p),
      title: splitMode ? "Split-scherm sluiten" : "Split-scherm openen",
      style:{background:splitMode?"linear-gradient(135deg,rgba(138,198,242,0.25),rgba(138,198,242,0.12))":"rgba(255,255,255,0.04)",
             border:`1px solid ${splitMode?"rgba(138,198,242,0.55)":W.splitBg}`,
             borderRadius:"6px",
             padding: isTablet ? "5px 8px" : "5px 13px",
             color:splitMode?W.blue:W.fgMuted,
             fontSize:"11px",cursor:"pointer",
             margin: isTablet ? "0 2px" : "0 4px 0 8px",
             display:"flex",alignItems:"center",gap:"5px",letterSpacing:"0.4px",
             boxShadow:splitMode?"0 0 8px rgba(138,198,242,0.2)":"none",transition:"all 0.15s",
             flexShrink:0}
    },
      React.createElement("span",{style:{fontSize:"14px"}},splitMode?"⊟":"⊞"),
      !isTablet && "split"
    ),
    React.createElement(ModelPicker, {llmModel, setLlmModel, compact: isTablet}),
    // ── Server status indicator ─────────────────────────────────────────────
    React.createElement("div", {
      title: serverOnline ? "Server bereikbaar" : "Server niet bereikbaar — herstart server.py",
      style: {
        display: "flex", alignItems: "center", gap: "5px",
        padding: "4px 10px", borderRadius: "6px",
        background: serverOnline ? "rgba(159,202,86,0.08)" : "rgba(229,120,109,0.12)",
        border: `1px solid ${serverOnline ? W.commentBorder : "rgba(229,120,109,0.4)"}`,
        cursor: "default", flexShrink: 0, transition: "all 0.4s ease",
      }
    },
      React.createElement("div", {style:{
        width:"7px", height:"7px", borderRadius:"50%", flexShrink:0,
        background: serverOnline ? "#9fca56" : "#e5786d",
        boxShadow: serverOnline ? "0 0 6px rgba(159,202,86,0.6)" : "0 0 6px rgba(229,120,109,0.6)",
        animation: serverOnline ? "none" : "ai-pulse 1.4s ease-in-out infinite",
      }}),
      !isTablet && React.createElement("span", {style:{
        fontSize:"11px",
        color: serverOnline ? "#9fca56" : "#e5786d",
        letterSpacing:"0.3px",
      }}, serverOnline ? "online" : "offline")
    ),
    React.createElement("button", {
      onClick:()=>setShowSettings(true),
      style:{background:"rgba(255,255,255,0.04)",border:`1px solid ${W.splitBg}`,
             borderRadius:"6px",padding:"5px 13px",color:W.fgMuted,
             fontSize:"11px",cursor:"pointer",margin:"0 10px 0 0",
             display:"flex",alignItems:"center",gap:"5px",letterSpacing:"0.4px",transition:"all 0.15s"}
    },
      React.createElement("span",{style:{fontSize:"14px"}},"⚙"),
      "instellingen"
    )
  );

  // ── Mobile top bar ────────────────────────────────────────────────────────
  const mobileTopBar = isMobile && React.createElement("div", {
    style:{height:"48px",background:W.statusBg,borderBottom:`1px solid ${W.splitBg}`,
           display:"flex",alignItems:"center",padding:"0 12px",flexShrink:0,gap:"8px"}
  },
    React.createElement("button", {
      onClick:()=>setSidebarOpen(p=>!p),
      style:{background:"none",border:`1px solid ${W.splitBg}`,borderRadius:"6px",
             color:W.fgMuted,fontSize:"18px",padding:"4px 10px",cursor:"pointer"}
    }, "☰"),
    React.createElement("div", {
      style:{flex:1,fontWeight:"bold",fontSize:"14px",letterSpacing:"1.5px",color:W.statusFg}
    }, "ZETTELKASTEN"),
    aiStatus && React.createElement("div",{
      style:{fontSize:"14px",color:"#a8d8f0",background:"rgba(138,198,242,0.1)",
             border:"1px solid rgba(138,198,242,0.2)",borderRadius:"10px",padding:"2px 8px",
             animation:"ai-pulse 1.4s ease-in-out infinite"}},"⏳ ",aiStatus),
    React.createElement(ModelPicker, {llmModel, setLlmModel}),
    React.createElement("button", {
      onClick:()=>setShowSettings(true),
      style:{background:"none",border:"none",color:W.fgMuted,fontSize:"18px",cursor:"pointer",padding:"4px"}
    }, "⚙")
  );

  // ── Bottom nav (mobile) — toont hoofdtabs ───────────────────────────────────
  const bottomNav = isMobile && React.createElement("div", {
    style:{background:W.statusBg,borderTop:`1px solid ${W.splitBg}`,
           display:"flex",flexDirection:"column",flexShrink:0,
           paddingBottom:"env(safe-area-inset-bottom,0px)"}
  },
    // Subtabs (als actieve hoofdtab subtabs heeft)
    activeSubs && React.createElement("div", {
      style:{display:"flex",borderBottom:`1px solid ${W.splitBg}`,
             background:W.bg2, height:"34px"}
    },
      activeSubs.map(s => React.createElement("button", {
        key:s.id, onClick:()=>setTab(s.id),
        style:{flex:1,background:"none",border:"none",
               borderBottom:tab===s.id?`2px solid ${W.blue}`:"2px solid transparent",
               color:tab===s.id?W.blue:W.fgMuted,
               fontSize:"11px",cursor:"pointer",padding:"0 4px",letterSpacing:"0.3px"}
      }, s.icon+" "+s.label))
    ),
    // Hoofdtabs
    React.createElement("div", {style:{display:"flex",height:"52px"}},
      MAIN_TABS.map(({id,icon,label}) => React.createElement("button", {
        key:id, onClick:()=>handleMainTab(id),
        style:{flex:1,background:"none",border:"none",
               borderTop:activeMain===id?`2px solid ${W.yellow}`:"2px solid transparent",
               color:activeMain===id?W.yellow:W.fgMuted,
               display:"flex",flexDirection:"column",alignItems:"center",
               justifyContent:"center",gap:"2px",cursor:"pointer",fontSize:"18px",paddingTop:"6px"}
      },
        React.createElement("span", null, icon),
        React.createElement("span", {style:{fontSize:"9px",letterSpacing:"0.5px"}}, label)
      ))
    )
  );


    // ── Hoofd render ──────────────────────────────────────────────────────────
  return React.createElement("div", {
    style:{display:"flex", flexDirection:"column",
           height:"100%", overflow:"hidden",
           paddingTop:"env(safe-area-inset-top,0px)",
           paddingLeft:"env(safe-area-inset-left,0px)",
           paddingRight:"env(safe-area-inset-right,0px)",
           background:W.bg, color:W.fg}
  },
    mobileTopBar,
    topBar,
    // Sync-melding
    syncToast && React.createElement("div", {
      style: {
        position:"fixed", bottom:"24px", left:"50%",
        transform:"translateX(-50%)", zIndex:9999,
        padding:"8px 18px", borderRadius:"20px",
        background:"rgba(138,198,242,.15)",
        border:"1px solid rgba(138,198,242,.35)",
        color:"#8ac6f2", fontSize:"13px", fontWeight:"500",
        backdropFilter:"blur(8px)", pointerEvents:"none",
        animation:"fadeIn .2s ease-out", whiteSpace:"nowrap",
      }
    }, syncToast),


    // ── Subtab-balk (desktop+tablet, alleen als actieve hoofdtab subtabs heeft) ──
    !isMobile && activeSubs && React.createElement("div", {
      style:{
        height: "34px", flexShrink: 0,
        background: W.bg2,
        borderBottom: `1px solid ${W.splitBg}`,
        display: "flex", alignItems: "stretch",
        paddingLeft: isTablet ? "8px" : "16px",
        gap: "0",
      }
    },
      activeSubs.map(s => React.createElement("button", {
        key: s.id,
        onClick: () => setTab(s.id),
        style:{
          background: "none", border: "none",
          borderBottom: tab===s.id ? `2px solid ${W.blue}` : "2px solid transparent",
          color: tab===s.id ? W.blue : W.fgMuted,
          padding: isTablet ? "0 12px" : "0 16px",
          fontSize: "12px", cursor: "pointer",
          fontWeight: tab===s.id ? "600" : "400",
          letterSpacing: "0.3px",
          display: "flex", alignItems: "center", gap: "5px",
          transition: "all 0.12s",
          whiteSpace: "nowrap",
        },
        onMouseEnter: e => { if(tab!==s.id) e.currentTarget.style.color=W.fg; },
        onMouseLeave: e => { if(tab!==s.id) e.currentTarget.style.color=W.fgMuted; },
      },
        React.createElement("span", {style:{fontSize:"14px"}}, s.icon),
        s.label
      ))
    ),

    showSettings && React.createElement(VaultSettings, {
      vaultPath, onChangeVault:setVaultPath, onClose:()=>setShowSettings(false)
    }),
    sidebarOverlay,

    // Content
    React.createElement("div", {
      style:{flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0}},

      // NotesTab altijd in DOM — display:none bewaart scroll + VIM-state
      React.createElement("div", {
        key:"notes-always",
        style:{
          flex:1, display:(tab==="notes"&&!splitMode)?"flex":"none",
          flexDirection:"row", overflow:"hidden", minHeight:0
        }
      }, notesTabEl),

      // Andere tabs: alleen renderen als actief
      (tab!=="notes"||splitMode) && (() => {
        const renderTab = (t, isSplitRight=false) => {
          if(t==="search") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(FuzzySearch,{
              onPasteToNote: selId ? handlePasteToNote : null,
              notes, allTags,
              onOpenNote: (id) => {
                if (isSplitRight) { setSplitSelId(id); }
                else { setSelId(id); setTab("notes"); }
              },
              onAddNote:  async(note) => {
                const saved = await NoteStore.save(note);
                setNotes([...NoteStore.getAll()]); setSelId(saved.id); setTab("notes");
              },
              onUpdateNote: async(note) => {
                await NoteStore.save(note);
                setNotes([...NoteStore.getAll()]);
              },
            }));
          if(t==="graph") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(Graph,{notes,
              onSelect:id=>{setSelId(id);setTab("notes");},selectedId:selId,
              onUpdateNote:async(note)=>{ await NoteStore.save(note); setNotes([...NoteStore.getAll()]); },
              onDeleteNote:(id)=>{ NoteStore.remove(id).then(()=>setNotes([...NoteStore.getAll()])); }}));
          if(t==="daily") return React.createElement(DailyView, {
            notes, llmModel,
            onOpenNote: id => { setSelId(id); setTab("notes"); },
            onAddNote:  async note => {
              const saved = await NoteStore.save(note);
              setNotes([...NoteStore.getAll()]);
              if(saved?.id){ setSelId(saved.id); setTab("notes"); }
            },
          });
          if(t==="pdf") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(PDFViewer,{pdfNotes,setPdfNotes,allTags,serverPdfs,
              notes,isTablet,
              llmModel,
              onSaveNote:async(note)=>{ await NoteStore.save({...note,id:note.id||genId(),created:note.created||new Date().toISOString(),modified:new Date().toISOString()}); setNotes([...NoteStore.getAll()]); },
              onOpenNote: (id) => {
                if (isSplitRight) { setSplitSelId(id); }
                else { setSelId(id); setTab("notes"); }
              },
              openPdfName,
              onOpenPdfConsumed: () => setOpenPdfName(null),
              onRefreshPdfs:refreshPdfs,
              pdfAnnotations: pdfNotes,
              onTogglePdfRead: async name => {
                await fetch("/api/pdf-read-toggle",{
                  method:"POST", headers:{"Content-Type":"application/json"},
                  body:JSON.stringify({name}),
                });
                setServerPdfs(await PDFService.listPdfs());
              },
              onPasteToNote: selId ? handlePasteToNote : null,
              onAddNote:async(note)=>{ await NoteStore.save(note); setNotes([...NoteStore.getAll()]); },
              onSaveNote:async(note)=>{ await NoteStore.save({...note,id:note.id||genId(),created:note.created||new Date().toISOString(),modified:new Date().toISOString()}); setNotes([...NoteStore.getAll()]); },
              onDeletePdf:async(fname)=>{
                const stem=fname.replace(/\.pdf$/i,"");
                const linked=notes.filter(n=>n.tags?.includes("samenvatting")&&(n.title?.includes(stem)||n.content?.includes(fname)));
                for(const n of linked){ await NoteStore.remove(n.id); }
                if(linked.length) setNotes([...NoteStore.getAll()]);
                // Verwijder annotaties voor dit bestand via AnnotationStore
                const remaining = AnnotationStore.getAll().filter(a => a.file !== fname);
                await AnnotationStore.setAll(remaining);
              },
              onAutoSummarize:(fname)=>{
                const stem=fname.replace(/\.pdf$/i,"");
                const jid=genId();
                const ctrl=new AbortController();
                addJob({id:jid, type:"summarize", label:"🧠 Samenvatten: "+stem.slice(0,26)+"…", controller:ctrl});
                // Return Promise zodat PDFViewer fouten kan tonen in de eigen balk
                return (async()=>{
                  try {
                  const res=await PDFService.summarizePdf(fname,llmModel,ctrl.signal);
                  if(res?.ok && res.summary){
                    // Zoek notities die deze PDF al citeren via [[pdf:fname]]
                    const citingNotes = NoteStore.getAll().filter(n =>
                      (n.content||"").includes("[[pdf:"+fname+"]]")
                    );
                    // Bouw linksectie naar citerende notities
                    const linkedSection = citingNotes.length > 0
                      ? "\n\n---\n🔗 **Gelinkte notities:**\n" +
                        citingNotes.map(n => "- [["+n.id+"]]").join("\n")
                      : "";

                    const noteId = genId();
                    const note={id:noteId, title:"Samenvatting — "+stem,
                      content:"*Automatisch gegenereerd door Notebook LLM*\n\n"+res.summary
                        +"\n\n---\n📄 **Bron:** [[pdf:"+fname+"]]"
                        +linkedSection,
                      tags:["samenvatting","pdf"],created:new Date().toISOString(),
                      modified:new Date().toISOString(),importedAt:new Date().toISOString()};
                    const saved=await NoteStore.save(note);

                    // Voeg teruglink toe aan elke citerende notitie
                    for (const cn of citingNotes) {
                      const alreadyLinked = (cn.content||"").includes("[["+noteId+"]]");
                      if (!alreadyLinked) {
                        const updated = {...cn,
                          content: cn.content + "\n\n📎 **Samenvatting:** [["+noteId+"]]",
                          modified: new Date().toISOString()
                        };
                        await NoteStore.save(updated);
                      }
                    }

                    setNotes([...NoteStore.getAll()]);
                    const linkMsg = citingNotes.length > 0
                      ? " ("+citingNotes.length+" notitie"+(citingNotes.length>1?"s":"")+" gelinkt)"
                      : "";
                    updateJob(jid,{status:"done",result:"Opgeslagen als: Samenvatting — "+stem.slice(0,22)+linkMsg});
                  } else {
                    const msg = res?.error || "Samenvatten mislukt";
                    updateJob(jid,{status:"error",error:msg});
                    throw new Error(msg);
                  }
                  } catch(e) {
                    if (e.name==="AbortError") {
                      updateJob(jid,{status:"error",error:"Geannuleerd"});
                    } else {
                      updateJob(jid,{status:"error",error:e.message});
                      throw e;
                    }
                  }
                })();
              }}));
          if(t==="images") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden"}},
            React.createElement(ImagesGallery,{serverImages,onRefresh:refreshImages,llmModel,setAiStatus,notes,imgNotes,setImgNotes,allTags,
              addJob, updateJob,
              onPasteToNote: selId ? handlePasteToNote : null,
              onDeleteNote: id => { NoteStore.remove(id).then(() => setNotes([...NoteStore.getAll()])); },
              onAddNote: async(note) => {
                // _navigate: ga naar bestaande notitie zonder aanmaken
                if (note._navigate) {
                  setSelId(note._navigate);
                  setTab("notes");
                  return;
                }
                const saved = await NoteStore.save(note);
                setNotes([...NoteStore.getAll()]);
                // Navigeer naar de notitie na aanmaken
                setSelId(saved.id);
                setTab("notes");
              }}));
          
          if(t==="import") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(WebImporter,{llmModel,allTags,
              notes,
              onRefreshImages: refreshImages,
              onDescribeImages: (fnames, importNoteId, importNoteTitle) => {
                // Beschrijf elke afbeelding, sla op als annotatie + notitie,
                // en voeg een [[link]] toe aan de import-notitie
                fnames.forEach(async fname => {
                  const jid = genId();
                  const stem = fname.replace(/\.[^.]+$/,"");
                  addJob({id:jid, type:"describe", label:"🖼 Beschrijven: "+stem.slice(0,26)+"…"});
                  try {
                    const res = await fetch("/api/llm/describe-image", {
                      method:"POST",
                      headers:{"Content-Type":"application/json"},
                      body: JSON.stringify({filename:fname, model:llmModel})
                    }).then(r=>r.json());

                    if (res.ok && res.description) {
                      // 1. Sla op als annotatie (voor plaatjes-tab)
                      const current = await api.getImgAnnotations();
                      const annots = (current||[]).filter(a=>!(a.file===fname && !a.x));
                      annots.push({file:fname, description:res.description, pins:[]});
                      await api.saveImgAnnotations(annots);
                      setImgNotes?.([...annots]);

                      // 2. Maak een afbeelding-notitie aan
                      const imgNoteId = genId();
                      const imgNote = {
                        id: imgNoteId,
                        title: "Afbeelding — " + stem,
                        content: "![[img:"+fname+"]]\n\n## Beschrijving\n\n"+res.description
                          + (importNoteId ? "\n\n---\n🔗 Geïmporteerd via [["+importNoteId+"]]" : ""),
                        tags: ["afbeelding","media"],
                        created: new Date().toISOString(),
                        modified: new Date().toISOString(),
                      };
                      await NoteStore.save(imgNote);

                      // 3. Voeg link naar afbeelding-notitie toe aan import-notitie
                      if (importNoteId) {
                        const importNote = NoteStore.getById(importNoteId);
                        if (importNote) {
                          const linkLine = "\n\n📎 **Afbeelding:** [["+imgNoteId+"]] — ![[img:"+fname+"]]";
                          const updated = {...importNote,
                            content: importNote.content + linkLine,
                            modified: new Date().toISOString()
                          };
                          await NoteStore.save(updated);
                        }
                      }

                      setNotes([...NoteStore.getAll()]);
                      updateJob(jid,{status:"done", result:"Gelinkt aan import-notitie"});
                    } else {
                      updateJob(jid,{status:"error", error:"Geen beschrijving ontvangen"});
                    }
                  } catch(e) {
                    updateJob(jid,{status:"error", error:e.message});
                  }
                });
              },
              addJob, updateJob,
              importPreview, setImportPreview,
              onAddNote:async(note)=>{
                // Voeg importedAt toe zodat leeslijst hem herkent
                const withImport = {...note, importedAt: new Date().toISOString()};
                const saved=await NoteStore.save(withImport);
                setNotes([...NoteStore.getAll()]);
                // Navigeer pas NA de WebImporter reset (setTimeout geeft component tijd om op te ruimen)
                setTimeout(() => { setSelId(saved.id); setTab("notes"); }, 1600);
                return saved;  // zodat onDescribeImages de id heeft
              }}));
          if(t==="reading") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(ReadingList,{
              notes,
              serverPdfs,
              onSelectNote: id=>{ setSelId(id); setTab("notes"); },
              onOpenPdf: name=>{ setTab("pdfs"); },
              onTogglePdfRead: async name => {
                await fetch("/api/pdf-read-toggle",{
                  method:"POST",
                  headers:{"Content-Type":"application/json"},
                  body:JSON.stringify({name}),
                });
                const pdfs = await fetch("/api/pdfs").then(r=>r.json());
                setServerPdfs(pdfs);
              },
              onUpdateNote: async note=>{
                await NoteStore.save(note);
                setNotes([...NoteStore.getAll()]);
              },
              onDeleteNote: async ids => {
                const arr = Array.isArray(ids) ? ids : [ids];
                for (const id of arr) {
                  await NoteStore.remove(id);
                }
                setNotes([...NoteStore.getAll()]);
              },
            }));
          if(t==="mindmap") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(MindMap,{notes,allTags,aiMindmap,serverPdfs,serverImages,
              onSelectNote:id=>{ setSelId(id); setTab("notes"); },
              onAddNote:async(note)=>{
                const saved=await NoteStore.save(note);
                setNotes([...NoteStore.getAll()]); setSelId(saved.id); setTab("notes");
              }}));
          if(t==="llm") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(LLMNotebook,{notes,pdfNotes,serverPdfs,serverImages,allTags,llmModel,setLlmModel,
              onMindmapReady:(mm)=>{ setAiMindmap(mm); setTab("mindmap"); },
              onAddNote:async(note)=>{
                const saved=await NoteStore.save(note);
                setNotes([...NoteStore.getAll()]); setSelId(saved.id); setTab("notes");
              },
              onPasteToNote: selId ? handlePasteToNote : null,
              prefillMsg: window._notebookPrefill || null,
            }));
          if(t==="semantic") return React.createElement(SemanticSearch,{
            notes,
            llmModel,
            onOpenNote: id => {
              if (isSplitRight) { setSplitSelId(id); }
              else { setSelId(id); setTab("notes"); }
            },
          });
          if(t==="tags") return React.createElement("div",
{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(TagManagerPanel,{
              allTags, notes,
              llmModel,
              onMergeTags: handleMergeTags,
              onRenameTag: handleRenameTag,
              onDeleteTag: handleDeleteTag,
            }));
          if(t==="tasks") return React.createElement(TasksPanel,{
            notes,
            onOpenNote: id => {
              if (isSplitRight) { setSplitSelId(id); }
              else { setSelId(id); setTab("notes"); }
            },
          });
          if(t==="annotations") return React.createElement(AnnotationsPanel,{
            notes,
            onOpenNote: id => {
              if (isSplitRight) { setSplitSelId(id); }
              else { setSelId(id); setTab("notes"); }
            },
          });
          if(t==="books") return React.createElement(BookLibrary,{
            notes,
            onNotesChange: async(updated) => {
              for(const n of updated) await NoteStore.save(n);
              setNotes([...NoteStore.getAll()]);
            },
            onOpenNote: id => {
              if (isSplitRight) { setSplitSelId(id); }
              else { setSelId(id); setTab("notes"); }
            },
            serverPdfs,
            onReadBook: (book) => {
              const match = findPdfForBook(book, serverPdfs);
              if (match) setOpenPdfName(match.name);
              setTab("pdf");
            },
          });
          if(t==="today" || t==="daily") return React.createElement(DailyView,{
            notes,
            llmModel,
            onOpenNote: id => { setSelId(id); setTab("notes"); },
            onAddNote:  async note => {
              const saved = await NoteStore.save(note);
              setNotes([...NoteStore.getAll()]);
              setSelId(saved.id); setTab("notes");
            },
          });
          if(t==="notes") return React.createElement("div",{
            style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}
          },
            React.createElement(NotesTab,{
              notes, pdfNotes, serverPdfs, serverImages, allTags,
              selId: isSplitRight ? splitSelId : selId,
              onSelectNote: id => {
                if (isSplitRight) { setSplitSelId(id); }
                else { setSelId(id); }
              },
              llmModel, isTablet, isDesktop,
              onAddNote: async note => {
                const saved = await NoteStore.save(note);
                setNotes([...NoteStore.getAll()]);
                if (!isSplitRight) setSelId(saved.id);
              },
              onUpdateNote: async note => {
                await NoteStore.save(note); setNotes([...NoteStore.getAll()]);
              },
              onDeleteNote: async id => {
                await NoteStore.remove(id); setNotes([...NoteStore.getAll()]);
                if (isSplitRight && splitSelId===id) setSplitSelId(null);
              },
            })
          );
          if(t==="query") return React.createElement(QueryPanel,{
            notes, allTags,
            onOpenNote: id => {
              if (isSplitRight) { setSplitSelId(id); }
              else { setSelId(id); setTab("notes"); }
            },
          });
          if(t==="whiteboard") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(Whiteboard,{notes,
              onAddNote: async(note)=>{ await NoteStore.save(note); setNotes([...NoteStore.getAll()]); },
              onSelectNote: id=>{ setSelId(id); setTab("notes"); },
              llmModel,
              pendingNotes: canvasPendingNotes,
              onClearPending: ()=>setCanvasPendingNotes(null),
              onShowInGraph: (noteId)=>{ setTab("graph"); setTimeout(()=>window._graphCenterNode?.(noteId),150); },
            }));
          if(t==="cleanup") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(VaultCleanup,{notes,
              onUpdateNote: async(note)=>{ await NoteStore.save(note); setNotes([...NoteStore.getAll()]); },
              onDeleteNote: async(id)=>{ await NoteStore.remove(id); setNotes([...NoteStore.getAll()]); },
            }));
          if(t==="stats") return React.createElement(StatsPanel,{
            notes, serverPdfs, serverImages,
          });
          if(t==="review") return React.createElement(ReviewPanel,{
            notes,
            onOpenNote: id => { setSelId(id); setTab("notes"); },
            onUpdateNote: async note => { await NoteStore.save(note); setNotes([...NoteStore.getAll()]); },
          });
        };

        // Split-screen
        if(splitMode && isDesktop) {
          const focusL = splitFocus==="left";
          const bL = focusL?`2px solid ${W.blue}`:`2px solid ${W.splitBg}`;
          const bR = !focusL?`2px solid ${W.blue}`:`2px solid ${W.splitBg}`;
          return React.createElement("div",{
            style:{flex:1,display:"flex",overflow:"hidden",minHeight:0}
          },
            React.createElement("div",{
              onClick:()=>setSplitFocus("left"),
              style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",
                borderRight:bL,minWidth:0,minHeight:0,outline:"none",transition:"border-color 0.15s"}
            },
              // Linker tab-strip: Notities of Canvas
              React.createElement("div",{
                style:{display:"flex",alignItems:"center",flexShrink:0,height:"36px",
                  background:W.bg2, borderBottom:`1px solid ${W.splitBg}`}
              },
                ...[
                  {id:"notes",      icon:"📝", label:"Notities"},
                  {id:"whiteboard", icon:"🎨", label:"Canvas"},
                ].map(({id,icon,label}) => React.createElement("button",{
                  key:id,
                  onClick:e=>{e.stopPropagation();setSplitLeft(id);setSplitFocus("left");},
                  style:{
                    background: splitLeft===id ? W.bg : "none",
                    border:"none",
                    borderBottom: splitLeft===id ? `2px solid ${W.yellow}` : "2px solid transparent",
                    color: splitLeft===id ? W.statusFg : W.fgMuted,
                    padding:"0 14px", height:"100%", fontSize:"13px",
                    cursor:"pointer", flexShrink:0,
                    display:"flex", alignItems:"center", gap:"5px",
                  }
                },
                  React.createElement("span",{style:{fontSize:"14px"}}, icon),
                  label
                ))
              ),
              // Linker content
              splitLeft === "notes"
                ? notesTabEl
                : React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
                    React.createElement(Whiteboard,{notes,
                      onAddNote: async(note)=>{ await NoteStore.save(note); setNotes([...NoteStore.getAll()]); },
                      onSelectNote: id=>{ setSelId(id); setSplitLeft("notes"); },
                      llmModel,
                    }))
            ),
            React.createElement("div",{
              onClick:()=>setSplitFocus("right"),
              style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",
                borderLeft:bR,minWidth:0,minHeight:0,transition:"border-color 0.15s",
                position:"relative"}
            },
              (() => {
                const scrollBar = (dir) => {
                  const el = splitBarRef.current;
                  if (el) el.scrollBy({ left: dir * 120, behavior: "smooth" });
                };
                const SPLIT_TABS = [
                  {id:"notes",       icon:"📝", label:"Notities"},
                  {id:"semantic",    icon:"🧠", label:"Semantisch"},
                  {id:"tasks",       icon:"✓",  label:"Taken"},
                  {id:"annotations", icon:"✦",  label:"Annotaties"},
                  {id:"query",       icon:"🔎", label:"Query"},
                  {id:"pdf",         icon:"📄", label:"PDF"},
                  {id:"images",      icon:"🖼",  label:"Plaatjes"},
                  {id:"search",      icon:"🔍", label:"Zoeken"},
                  {id:"graph",       icon:"🕸",  label:"Graaf"},
                  {id:"mindmap",     icon:"🗺",  label:"Mindmap"},
                  {id:"llm",         icon:"🧠", label:"Notebook"},
                  {id:"whiteboard",  icon:"🎨", label:"Canvas"},
                ];
                const scrollBtn = (dir, label) => React.createElement("button", {
                  onClick: e => { e.stopPropagation(); scrollBar(dir); },
                  style: {
                    background: W.bg2, border: "none",
                    borderBottom: "2px solid transparent",
                    color: W.fgMuted, cursor: "pointer",
                    padding: "0 6px", height: "100%",
                    fontSize: "12px", flexShrink: 0,
                    display: "flex", alignItems: "center",
                    borderRight: dir < 0 ? `1px solid ${W.splitBg}` : "none",
                    borderLeft:  dir > 0 ? `1px solid ${W.splitBg}` : "none",
                  }
                }, label);
                return React.createElement("div", {
                  style: {
                    background: W.bg2, borderBottom: `1px solid ${W.splitBg}`,
                    display: "flex", alignItems: "center",
                    flexShrink: 0, height: "36px",
                  }
                },
                  scrollBtn(-1, "‹"),
                  React.createElement("div", {
                    ref: splitBarRef,
                    style: {
                      display: "flex", alignItems: "center",
                      flex: 1, overflowX: "auto", overflowY: "hidden",
                      scrollbarWidth: "none", height: "100%",
                      WebkitOverflowScrolling: "touch",
                    }
                  },
                    SPLIT_TABS.map(({id,icon,label}) =>
                      React.createElement("button", {
                        key: id,
                        onClick: e => { e.stopPropagation(); setSplitTab(id); setSplitSelId(null); },
                        style: {
                          background: splitTab===id ? W.bg : "none",
                          border: "none",
                          borderBottom: splitTab===id ? `2px solid ${W.yellow}` : "2px solid transparent",
                          color: splitTab===id ? W.statusFg : W.fgMuted,
                          padding: "0 10px", height: "100%", fontSize: "13px",
                          cursor: "pointer", flexShrink: 0,
                          display: "flex", alignItems: "center", gap: "4px",
                          whiteSpace: "nowrap",
                        }
                      },
                        React.createElement("span", {style:{fontSize:"14px"}}, icon),
                        label
                      )
                    )
                  ),
                  scrollBtn(1, "›")
                );
              })()
            ,
              renderTab(splitTab, true),
              // ── Preview overlay in rechter paneel ──────────────────────────
              // Toont gevonden notitie als preview zonder de linker notitie te verstoren
              splitSelId && (() => {
                const previewNote = notes.find(n => n.id === splitSelId);
                if (!previewNote) return null;
                return React.createElement("div",{
                  style:{
                    position:"absolute", inset:0, zIndex:10,
                    display:"flex", flexDirection:"column",
                    background:W.bg, overflow:"hidden",
                  }
                },
                  // Preview header met sluitknop en open-in-editor
                  React.createElement("div",{
                    style:{
                      display:"flex", alignItems:"center", gap:"8px",
                      padding:"6px 12px", borderBottom:`1px solid ${W.splitBg}`,
                      background:W.bg2, flexShrink:0,
                    }
                  },
                    React.createElement("button",{
                      onClick: e => { e.stopPropagation(); setSplitSelId(null); },
                      title:"Sluit preview",
                      style:{ background:"none", border:"none", color:W.fgMuted,
                               cursor:"pointer", fontSize:"16px", lineHeight:1, padding:"0 4px" }
                    }, "←"),
                    React.createElement("span",{
                      style:{ flex:1, fontSize:"13px", fontWeight:"600",
                               color:W.statusFg, overflow:"hidden",
                               textOverflow:"ellipsis", whiteSpace:"nowrap" }
                    }, previewNote.title || "(geen titel)"),
                    React.createElement("button",{
                      onClick: e => {
                        e.stopPropagation();
                        setSelId(splitSelId);
                        setSplitSelId(null);
                      },
                      title:"Open in linker editor",
                      style:{ background:W.blueBg,
                               border:`1px solid rgba(138,198,242,0.3)`,
                               borderRadius:"5px", color:W.blue,
                               padding:"3px 10px", fontSize:"11px",
                               cursor:"pointer", flexShrink:0 }
                    }, "✏ Open links")
                  ),
                  // Preview content
                  React.createElement("div",{
                    style:{ flex:1, overflowY:"auto", padding:"16px 20px",
                             WebkitOverflowScrolling:"touch" }
                  },
                    React.createElement("div",{
                      className:"mdv",
                      dangerouslySetInnerHTML:{ __html: renderMd(previewNote.content || "", notes) }
                    })
                  )
                );
              })()
            )
          );
        }

        return renderTab(tab);
      })()
    ),

    bottomNav
  );
};