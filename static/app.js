// ─── WOMBAT COLOR SCHEME ────────────────────────────────────────────────────────
const W = {
  bg:"#242424",bg2:"#1c1c1c",bg3:"#2a2a2a",
  statusBg:"#2a2a2a",visualBg:"#554d4b",cursorBg:"#eae788",
  splitBg:"#3a4046",lineNrBg:"#222222",
  fg:"#e3e0d7",fgMuted:"#857b6f",fgDim:"#a0a8b0",
  statusFg:"#ffffd7",
  comment:"#9fca56",string:"#cae682",keyword:"#8ac6f2",
  type:"#92b5dc",special:"#e5786d",
  orange:"#e5786d",purple:"#d787ff",green:"#9fca56",
  yellow:"#eae788",blue:"#8ac6f2",
};

const HCOLORS = [
  {id:"yellow",label:"Geel",  bg:"rgba(234,231,136,0.45)",border:"#eae788"},
  {id:"green", label:"Groen", bg:"rgba(159,202,86,0.40)", border:"#9fca56"},
  {id:"blue",  label:"Blauw", bg:"rgba(138,198,242,0.40)",border:"#8ac6f2"},
  {id:"orange",label:"Oranje",bg:"rgba(229,120,109,0.40)",border:"#e5786d"},
  {id:"purple",label:"Paars", bg:"rgba(215,135,255,0.40)",border:"#d787ff"},
];

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
  async llmSummarizePdf(filename,model) {
    const r=await fetch(API+"/llm/summarize-pdf",{method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({filename,model})});
    return r.json();
  },
  async llmDescribeImage(filename,model) {
    const r=await fetch(API+"/llm/describe-image",{method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({filename,model})});
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
  async importUrl(payload) {
    // Sanitize payload om circular refs te voorkomen
    const safe = {
      url:   String(payload.url   || ""),
      model: String(payload.model || ""),
      force: Boolean(payload.force),
    };
    const r = await fetch(API+"/import-url", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(safe),
    });
    return r.json();
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
const extractLinks = (c="")=>[...new Set([...c.matchAll(/\[\[([^\]]+)\]\]/g)].map(m=>m[1]))];
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
    "note":    { icon:"📝", color:"#eae788", bg:"rgba(234,231,136,0.07)", border:"rgba(234,231,136,0.25)" },
    "warning": { icon:"⚠",  color:"#e5786d", bg:"rgba(229,120,109,0.07)", border:"rgba(229,120,109,0.25)" },
    "idea":        { icon:"💡", color:"#9fca56", bg:"rgba(159,202,86,0.07)",  border:"rgba(159,202,86,0.25)"  },
    "samenvatting":{ icon:"📋", color:"#8ac6f2", bg:"rgba(138,198,242,0.07)", border:"rgba(138,198,242,0.3)"  },
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
      const meta  = calloutMeta[type] || { icon:"💬", color:"#a0a8b0", bg:"rgba(255,255,255,0.04)", border:"rgba(255,255,255,0.12)" };
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
             (body ? `<div style="color:#e3e0d7;font-size:14px;line-height:1.7">${body}</div>` : "") +
             `</div>`;
      const ci = mediaBlocks.length;
      mediaBlocks.push(calloutHtml);
      return `%%MEDIA${ci}%%`;
    }
    // Gewone blockquote ook als placeholder
    const bqHtml = `<blockquote>${cleaned.join("<br>")}</blockquote>`;
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

  // Checkboxes
  h = h.replace(/^- \[ \] (.+)$/gm,'<li class="todo">☐ $1</li>');
  h = h.replace(/^- \[x\] (.+)$/gm,'<li class="todo done">☑ $1</li>');

  // Lists
  h = h.replace(/^[-*] (.+)$/gm,"<li>$1</li>");
  h = h.replace(/^\d+\. (.+)$/gm,"<li>$1</li>");
  h = h.replace(/(<li>[\s\S]*?<\/li>\n?)+/g,"<ul>$&</ul>");

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
const TagPill = ({tag, onRemove, small, onClick}) => (
  React.createElement("span",{
    onClick:onClick,
    title:"#"+tag,
    style:{
      display:"inline-flex",alignItems:"center",gap:"4px",
      background: small ? "rgba(159,202,86,0.14)" : "rgba(159,202,86,0.18)",
      color:"#b8e06a",
      border:"1px solid rgba(159,202,86,0.45)",
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
      style:{cursor:"pointer",color:"rgba(159,202,86,0.6)",marginLeft:"2px",
             fontSize:"13px",lineHeight:1,fontWeight:"bold",flexShrink:0}
    },"×")
  )
);

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



const VimEditor = ({value, onChange, onSave, onEscape, noteTags=[], onTagsChange,
                    allTags=[], goyoMode=false, onToggleGoyo, onEditorRef, onModeChange=()=>{},
                    llmModel="", allNotesText="",
                    onSplitCmd=null,    // (cmd) => void  — :vs/:sp/Ctrl+W-navigatie
                    onPasteBlock=null,  // (block) => void — plak geciteerd blok in editor
                    hideTagStrip=false, // verberg ingebouwde tag-strip (als SmartTagEditor al zichtbaar is)
                    }) => {

  const { useState, useEffect, useRef, useCallback } = React;

  // ── React state (alleen voor re-render van statusbalk/tags) ────────────────
  const [mode,       setModeState] = useState("INSERT");
  const [cmdBuf,     setCmdBuf]    = useState("");
  const [statusMsg,  setStatus]    = useState("");
  const [spellLang,  setSpell]     = useState("nl");    // standaard Nederlands
  const spellCycle = ["nl","en","off"];

  // Completion popup state
  const [compList,   setCompList]  = useState([]);   // [{word, source}]
  const [compIdx,    setCompIdx]   = useState(0);

  // Scroll geselecteerd completion-item in beeld na pijltjesnavigatie
  React.useEffect(() => {
    const list = document.querySelector("[data-comp-list]");
    if (!list) return;
    const items = list.querySelectorAll("[data-comp-item]");
    if (items[compIdx]) items[compIdx].scrollIntoView({ block: "nearest" });
  }, [compIdx]);    // geselecteerde index
  const [compOpen,   setCompOpen]  = useState(false);
  const [compPos,    setCompPos]   = useState({x:0, y:0}); // popup positie in px
  const [aiLoading,  setAiLoading] = useState(false);

  // AI taalverbetering state
  const [aiImprove,    setAiImprove]    = useState(null);   // {original, improved} of null
  const [aiImproving,  setAiImproving]  = useState(false);  // bezig met verbeteren
  const [aiImproveLang,setAiImproveLang]= useState("nl");  // "nl"|"en"|"auto"
  const compRef    = useRef({list:[], idx:0, open:false});

  // Spell check state — set van {row, col, len} fout-posities
  const spellErrors = useRef(new Map()); // row → [{col,len,word}]
  const spellTimer  = useRef(null);

  // ── Alle editor-staat in één ref → nooit stale in event-handlers ──────────
  const S = useRef({
    lines:     value.split("\n"),
    cur:       {row:0, col:0},  // cursor positie
    scroll:    0,               // eerste zichtbare regel
    mode:      "INSERT",
    cmdBuf:    "",
    undo:      [value.split("\n")],
    undoIdx:   0,
    yank:      "",
    search:    "",
    matches:   [],
    matchIdx:  0,
    charW:     7.8,             // wordt gemeten na mount
    numCols:   4,               // breedte regelnummer-kolom (in tekens)
    visRows:   30,
    selecting: false,
    selA:      null,
    selB:      null,
  });

  const cvRef      = useRef(null);  // canvas
  const inputRef   = useRef(null);  // onzichtbaar <input> voor toetsafvang
  const rafRef     = useRef(null);
  const blinkRef   = useRef(null);
  const blinkOn    = useRef(true);
  const undoTimer  = useRef(null);
  const prevValue  = useRef(value);

  // ── setMode: update zowel ref als React state ─────────────────────────────
  const setMode = useCallback((m) => {
    S.current.mode = m;
    setModeState(m);
    blinkOn.current = true;
    onModeChange(m);
  }, [onModeChange]);

  // ── Externe value sync ────────────────────────────────────────────────────
  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      S.current.lines = value.split("\n");
      clamp();
      draw();
      scheduleSpellCheck();  // spellcheck bij wisselen/laden van notitie
    }
  }, [value]);

  // Geef een object terug met focus() + setCursor(row,col) + insertAtCursor(text)
  useEffect(() => {
    if (onEditorRef) onEditorRef({
      focus: () => inputRef.current?.focus(),
      setCursor: (row, col) => {
        const s = S.current;
        s.cur.row = Math.max(0, Math.min(row, s.lines.length - 1));
        s.cur.col = Math.max(0, Math.min(col, (s.lines[s.cur.row]||"").length));
        scrollToCursor(s);
        inputRef.current?.focus();
        draw();
      },
      insertAtCursor: (text) => {
        const s = S.current;
        // Zorg dat we in INSERT mode zijn
        setMode("INSERT");
        // Voeg elke karakter in (ondersteunt ook newlines via meerdere regels)
        const parts = text.split("\n");
        parts.forEach((part, i) => {
          for (const ch of part) insertChar(s, ch);
          if (i < parts.length - 1) {
            // Newline: splits huidige regel
            const {row, col} = s.cur;
            const before = s.lines[row].slice(0, col);
            const after  = s.lines[row].slice(col);
            s.lines[row] = before;
            s.lines.splice(row + 1, 0, after);
            s.cur.row = row + 1;
            s.cur.col = 0;
          }
        });
        emit(s);
        scrollToCursor(s);
        draw();
        inputRef.current?.focus();
      },
    });
  }, [onEditorRef]);

  // ── Canvas setup & resize ─────────────────────────────────────────────────
  useEffect(() => {
    const cv  = cvRef.current;
    const inp = inputRef.current;
    if (!cv) return;

    // Meet exacte tekenbreedte met Hack font
    const ctx = cv.getContext("2d");
    ctx.font  = `${FONT_SIZE}px 'Hack','Courier New',monospace`;
    S.current.charW = ctx.measureText("M").width;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const p   = cv.parentElement;
      const pw  = p.offsetWidth  || p.clientWidth  || p.getBoundingClientRect().width;
      const ph  = p.offsetHeight || p.clientHeight || p.getBoundingClientRect().height;
      if (!pw || !ph) return; // wacht tot layout klaar is
      cv.width  = pw * dpr;
      cv.height = ph * dpr;
      cv.style.width  = pw + "px";
      cv.style.height = ph + "px";
      ctx.scale(dpr, dpr);
      // herbereken numCols op basis van regelaantal
      const s = S.current;
      s.numCols  = String(s.lines.length).length + 1;
      s.visRows  = Math.floor((ph - LINE_H) / LINE_H); // -1 voor statusbalk
      draw();
    };

    requestAnimationFrame(()=>{ requestAnimationFrame(()=>{
      resize();
      setTimeout(resize, 150); // iOS Safari: layout soms nog niet klaar
    }); });
    const ro = new ResizeObserver(resize);
    ro.observe(cv.parentElement);

    // Knipperende cursor — 530ms zoals vim default
    blinkRef.current = setInterval(() => {
      blinkOn.current = !blinkOn.current;
      draw();
    }, 530);

    // Muisklik → cursor plaatsen + focus
    const onMouseDown = (e) => {
      const r   = cv.getBoundingClientRect();
      const s   = S.current;
      const cw  = s.charW;
      const nw  = (s.numCols + 1) * cw + PAD_LEFT; // breedte regelnummer-gebied
      const row = Math.min(s.lines.length - 1,
                  Math.max(0, Math.floor((e.clientY - r.top) / LINE_H) + s.scroll));
      const col = Math.min(s.lines[row].length,
                  Math.max(0, Math.round((e.clientX - r.left - nw) / cw)));
      s.cur = {row, col};
      setMode("INSERT");
      scrollToCursor(s);
      inp.focus();
      draw();
    };
    cv.addEventListener("mousedown", onMouseDown);

    // Touch support (iPad/iPhone)
    const onTouchStart = (e) => {
      e.preventDefault(); // voorkom browser scroll tijdens editen
      const t   = e.touches[0];
      const r   = cv.getBoundingClientRect();
      const s   = S.current;
      const cw  = s.charW;
      const nw  = numColsWidth(s);
      const row = Math.min(s.lines.length-1,
                  Math.max(0, Math.floor((t.clientY-r.top)/LINE_H)+s.scroll));
      const col = Math.min(s.lines[row].length,
                  Math.max(0, Math.round((t.clientX-r.left-nw)/cw)));
      s.cur = {row,col};
      setMode("INSERT");
      scrollToCursor(s);
      inputRef.current?.focus();
      draw();
    };
    cv.addEventListener("touchstart", onTouchStart, {passive:false});

    return () => {
      ro.disconnect();
      clearInterval(blinkRef.current);
      cancelAnimationFrame(rafRef.current);
      cv.removeEventListener("mousedown", onMouseDown);
      cv.removeEventListener("touchstart", onTouchStart);
    };
  }, []);

  // ── Hulpfuncties ──────────────────────────────────────────────────────────
  const clamp = () => {
    const s = S.current;
    s.cur.row = Math.max(0, Math.min(s.lines.length - 1, s.cur.row));
    s.cur.col = Math.max(0, Math.min(s.lines[s.cur.row].length, s.cur.col));
  };

  const scrollToCursor = (s) => {
    if (s.cur.row < s.scroll) s.scroll = s.cur.row;
    if (s.cur.row >= s.scroll + s.visRows) s.scroll = s.cur.row - s.visRows + 1;
    s.scroll = Math.max(0, s.scroll);
  };

  const emit = (s) => {
    const v = s.lines.join("\n");
    prevValue.current = v;
    onChange(v);
  };

  const pushUndo = (s) => {
    const cut = s.undo.slice(0, s.undoIdx + 1);
    cut.push(s.lines.slice());
    s.undo    = cut;
    s.undoIdx = cut.length - 1;
  };

  const scheduleUndo = (s) => {
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => pushUndo(s), 600);
  };

  const insertChar = (s, ch) => {
    const {row, col} = s.cur;
    s.lines[row] = s.lines[row].slice(0, col) + ch + s.lines[row].slice(col);
    s.cur.col += ch.length;
  };

  const numColsWidth = (s) => (s.numCols + 1) * s.charW + PAD_LEFT;

  // ── Zoeken ────────────────────────────────────────────────────────────────
  const buildMatches = (s, term) => {
    s.search   = term;
    s.matches  = [];
    s.matchIdx = 0;
    if (!term) return;
    s.lines.forEach((line, r) => {
      let i = 0;
      while ((i = line.indexOf(term, i)) >= 0) {
        s.matches.push({row: r, col: i});
        i += term.length;
      }
    });
  };

  const jumpMatch = (s, dir) => {
    if (!s.matches.length) return;
    s.matchIdx = ((s.matchIdx + dir) + s.matches.length) % s.matches.length;
    const m = s.matches[s.matchIdx];
    s.cur = {row: m.row, col: m.col};
    scrollToCursor(s);
  };

  // ── Snippets ──────────────────────────────────────────────────────────────
  const expandSnippet = (s) => {
    const {row, col} = s.cur;
    const before = s.lines[row].slice(0, col);
    const word   = before.split(/[\s]/).pop();
    if (!word) return false;
    let tmpl = MD_SNIPPETS[word];
    if (!tmpl) return false;
    if (typeof tmpl === "function") tmpl = tmpl();
    const expanded = tmpl.replace(/\$\{?\d+:?([^}]*)\}?/g, "$1").replace(/\$0/g, "");
    const expLines = expanded.split("\n");
    s.lines[row] = before.slice(0, -word.length) + expLines[0] + s.lines[row].slice(col);
    if (expLines.length > 1) {
      s.lines.splice(row + 1, 0, ...expLines.slice(1));
      s.cur.row += expLines.length - 1;
      s.cur.col  = expLines[expLines.length - 1].length;
    } else {
      s.cur.col = col - word.length + expLines[0].length;
    }
    setStatus(`snippet: ${word}`);
    scheduleUndo(s);
    emit(s);
    scrollToCursor(s);
    return true;
  };

  // ── Command uitvoeren ─────────────────────────────────────────────────────
  const runCmd = useCallback((s, cmd) => {
    cmd = cmd.trim();
    if (/^tag\+/.test(cmd))  { const t=cmd.replace(/^tag\+\s*/,"").replace(/^#/,"").trim(); if(t) onTagsChange([...new Set([...noteTags,t])]); setStatus(`+tag: ${t}`); return; }
    if (/^tag-/.test(cmd))   { const t=cmd.replace(/^tag-\s*/,"").replace(/^#/,"").trim(); onTagsChange(noteTags.filter(x=>x!==t)); setStatus(`-tag: ${t}`); return; }
    if (/^tag\s/.test(cmd))  { const ts=cmd.slice(4).split(/[\s,]+/).map(t=>t.replace(/^#/,"")).filter(Boolean); onTagsChange([...new Set(ts)]); setStatus("tags: "+ts.join(" ")); return; }
    if (cmd==="tags")         { setStatus("tags: "+noteTags.join(" ")); return; }
    if (cmd==="retag")        { const ts=[...new Set([...noteTags,...extractTags(s.lines.join("\n"))])]; onTagsChange(ts); setStatus("retag: "+ts.join(" ")); return; }
    if (cmd==="w")            { onSave(); setStatus("opgeslagen ✓"); return; }
    if (cmd==="wq")           { onSave(); onEscape(); return; }
    if (cmd==="q!")           { onEscape(); return; }
    if (cmd==="goyo")         { onToggleGoyo?.(); return; }
    if (cmd==="spell"||cmd==="sp") { const i=(spellCycle.indexOf(spellLang)+1)%3; setSpell(spellCycle[i]); setStatus(`spell: ${spellCycle[i]}`); return; }
    if (cmd==="wrap")         { setStatus("wrap: aan (standaard)"); return; }
    // Spell: :spell+ voegt huidig woord toe aan geleerde woorden
    if (cmd==="spell+" || cmd==="sp+") {
      const s2 = S.current;
      const {row,col} = s2.cur;
      const before = s2.lines[row].slice(0, col);
      const wm = before.match(/([a-zA-ZÀ-ÿ'-]+)$/);
      if (wm) { SpellEngine.learnWord(wm[1]); scheduleSpellCheck(); setStatus(`geleerd: ${wm[1]}`); }
      return;
    }
    // ── Split-navigatie (delegeer aan parent via onSplitCmd) ─────────────────
    if (cmd==="vs" || cmd==="vsp")   { onSplitCmd?.("vs"); setStatus("split: verticaal"); return; }
    if (cmd==="sp" || cmd==="split") { onSplitCmd?.("sp"); setStatus("split: horizontaal"); return; }
    if (cmd==="q" || cmd==="close")  { onSplitCmd?.("close"); return; }
    if (cmd==="only")                { onSplitCmd?.("only"); setStatus("split gesloten"); return; }
    if (/^e\s+/.test(cmd))           { onSplitCmd?.("edit:"+cmd.slice(2).trim()); return; }
    if (/^vsp\s+/.test(cmd))         { onSplitCmd?.("vs:"+cmd.slice(4).trim()); return; }
    setStatus(`onbekend: :${cmd}`);
  }, [noteTags, onTagsChange, onSave, onEscape, onToggleGoyo, spellLang, onSplitCmd]);

  // ── Spell check engine ────────────────────────────────────────────────────
  // Detecteert taal automatisch op basis van tekenfrequentie.
  // Gebruikt de browser-native spellcheck via een verborgen <div contenteditable>.

  // Verborgen contenteditable voor native spellcheck (eenmalig aangemaakt)
  const spellDiv = useRef(null);
  const getSpellDiv = useCallback((lang) => {
    if (!spellDiv.current) {
      const d = document.createElement("div");
      d.contentEditable = "true";
      d.setAttribute("spellcheck","true");
      Object.assign(d.style, {
        position:"fixed",top:"-9999px",left:"-9999px",
        width:"600px",fontSize:"16px",lineHeight:"1.5",
        background:"white",color:"black",padding:"4px",
        whiteSpace:"pre-wrap",opacity:"0",pointerEvents:"none",
      });
      document.body.appendChild(d);
      spellDiv.current = d;
    }
    spellDiv.current.lang = lang === "nl" ? "nl" : "en";
    return spellDiv.current;
  }, []);

  // Detecteer taal automatisch: NL heeft 'ij','aa','oo','ee','uu','sch','ng' hoog;
  // EN heeft 'th','wh','ing','tion','ed' hoog.
  const detectLang = useCallback((text) => {
    const lc = text.toLowerCase();
    const nlScore = (lc.match(/\b(de|het|een|en|in|van|te|dat|dit|met|ik|je|we|ze|ook|aan|er|maar|om|nog|al|wel|geen|meer|op|uit)\b/g)||[]).length;
    const enScore = (lc.match(/\b(the|and|for|that|with|this|are|was|have|from|they|will|been|not|can|but|what|all|your|which|their|would|there|about|can|more|also|into|some|than|then)\b/g)||[]).length;
    return nlScore > enScore ? "nl" : "en";
  }, []);

  // Spellcheck één regel — geeft terug: [{col, len, word}]
  const checkLine = useCallback((line, lang) => {
    if (!line.trim()) return [];
    const errors = [];
    // Splits op woordgrenzen
    const wordRe = /[a-zA-ZÀ-ÿ\u0100-\u017F\u0180-\u024F'-]{2,}/g;
    let m;
    while ((m = wordRe.exec(line)) !== null) {
      const word = m[0].replace(/^'+|'+$/g, "");
      if (word.length < 2) continue;
      // Skip: getallen, afkortingen, links, code
      if (/\d/.test(word)) continue;
      if (/^[A-Z]{2,}$/.test(word)) continue;           // afkorting
      if (SpellEngine.isLearned(word)) continue;
      // Gebruik gecachede check
      const ok = SpellEngine.check(word, lang);
      if (ok === false) errors.push({col: m.index, len: word.length, word});
    }
    return errors;
  }, []);

  // Plan een spellcheck voor de hele buffer (gespreid over frames)
  // Grammaticafouten: row → [{col,len,msg,type}]
  const grammarErrors = useRef(new Map());

  const scheduleSpellCheck = useCallback(() => {
    if (spellLang === "off") {
      spellErrors.current.clear();
      grammarErrors.current.clear();
      draw();
      return;
    }
    clearTimeout(spellTimer.current);
    spellTimer.current = setTimeout(async () => {
      const s    = S.current;
      const lang = spellLang;

      // ── Stap 1: verzamel unieke woorden uit buffer ────────────────────
      const allWords = new Set();
      for (const line of s.lines) {
        const re = /[a-zA-ZÀ-ÿ'-]{3,}/g;
        let m;
        while ((m = re.exec(line)) !== null) {
          const w = m[0].replace(/^'+|'+$/g, "");
          if (w.length >= 3) allWords.add(w);
        }
      }

      // ── Stap 2: server spellcheck ─────────────────────────────────────
      let spellRes = {}, grammarRes = [], detectedLang = lang;
      try {
        const resp = await fetch("/api/spellcheck", {
          method:  "POST",
          headers: {"Content-Type": "application/json"},
          body:    JSON.stringify({ words: [...allWords], lines: s.lines, lang }),
        });
        const data = await resp.json();
        spellRes   = data.spell   || {};
        grammarRes = data.grammar || [];
        detectedLang = data.lang  || lang;
      } catch(e) {
        console.warn("[spell] server fout:", e.message);
      }

      // ── Stap 3: fouten per regel markeren ────────────────────────────
      const newSpell = new Map();
      s.lines.forEach((line, row) => {
        const errs = [];
        // Nieuwe regex per regel — KRITIEK: voorkomt lastIndex-bug
        const re = /[a-zA-ZÀ-ÿ'-]{3,}/g;
        let m;
        while ((m = re.exec(line)) !== null) {
          const raw  = m[0];
          const word = raw.replace(/^'+|'+$/g, "");
          if (word.length < 3) continue;
          if (/\d/.test(word)) continue;
          if (/^[A-Z]{2,}$/.test(word)) continue;   // afkorting
          if (SpellEngine.isLearned(word)) continue;
          // Server indexeert op raw EN lowercase — probeer beide
          const entry = spellRes[raw] ?? spellRes[raw.toLowerCase()]
                     ?? spellRes[word] ?? spellRes[word.toLowerCase()];
          if (entry && entry.spell === false) {
            errs.push({ col: m.index, len: raw.length, word: raw,
                        type: "spell", suggestions: entry.suggestions || [] });
          }
        }
        if (errs.length) newSpell.set(row, errs);
      });
      spellErrors.current = newSpell;

      // ── Stap 4: grammaticafouten per regel ───────────────────────────
      const newGrammar = new Map();
      for (const err of grammarRes) {
        if (!newGrammar.has(err.row)) newGrammar.set(err.row, []);
        newGrammar.get(err.row).push(err);
      }
      grammarErrors.current = newGrammar;

      if (lang === "auto" && detectedLang !== "auto")
        setStatus(`spell: auto → ${detectedLang}`);

      draw();
    }, 400);
  }, [spellLang]);


  // Spellcheck opnieuw plannen bij taalwissel of tekstwijziging
  useEffect(() => {
    if (spellLang !== "off") {
      // Leer alle vault-woorden zodat ze niet als fout worden gemarkeerd
      if (allNotesText) {
        const vaultWords = (allNotesText.match(/[a-zA-ZÀ-ÿ'-]{3,}/g) || []);
        SpellEngine.setVaultWords(vaultWords);
      }
      scheduleSpellCheck();
    } else {
      spellErrors.current.clear();
    }
  }, [spellLang, scheduleSpellCheck]);

  // Bouw completion engine bij mount + als allNotesText verandert
  useEffect(() => {
    if (allNotesText) CompletionEngine.build(allNotesText);
  }, [allNotesText]);

  // ── Completion helpers ────────────────────────────────────────────────────
  // Haal het woord links van de cursor op
  const getWordBeforeCursor = (s) => {
    const line = s.lines[s.cur.row];
    const before = line.slice(0, s.cur.col);
    const m = before.match(/[a-zA-ZÀ-ÿ'-]{2,}$/);
    return m ? m[0] : "";
  };

  // Sluit de completion popup
  const closeCompletion = useCallback(() => {
    compRef.current = {list:[], idx:0, open:false};
    setCompList([]); setCompOpen(false);
  }, []);

  // Accepteer de geselecteerde suggestie
  const acceptCompletion = useCallback((s, idx) => {
    const list = compRef.current.list;
    if (!list.length) return;
    const chosen = list[idx ?? compRef.current.idx];
    if (!chosen) return;
    const prefix = getWordBeforeCursor(s);
    const suffix = chosen.word.slice(prefix.length);
    if (suffix) {
      for (const ch of suffix) insertChar(s, ch);
      emit(s); scrollToCursor(s); draw();
    }
    closeCompletion();
  }, [closeCompletion]);

  // Trigger lokale completion
  const triggerLocalCompletion = useCallback((s) => {
    const prefix = getWordBeforeCursor(s);
    if (prefix.length < 2) { closeCompletion(); return; }
    // Bouw ook uit huidige buffer
    CompletionEngine.addFromBuffer(s.lines.join("\n"));
    const suggestions = CompletionEngine.suggest(prefix, 8)
      .map(w => ({word: w, source: "local"}));
    if (!suggestions.length) { closeCompletion(); return; }
    compRef.current = {list: suggestions, idx: 0, open: true};
    setCompList(suggestions); setCompIdx(0); setCompOpen(true);
    // Update popup positie direct bij openen
    const cv = cvRef.current;
    if (cv) {
      const rect = cv.getBoundingClientRect();
      const nw   = numColsWidth(s);
      const x = rect.left + nw + s.cur.col * s.charW;
      const y = rect.top  + (s.cur.row - s.scroll + 1) * LINE_H + 4;
      setCompPos({x: Math.min(x, window.innerWidth - 260), y});
    }
  }, [closeCompletion]);

  // Trigger AI completion via Ollama
  const triggerAICompletion = useCallback(async (s) => {
    if (!llmModel) { setStatus("Geen AI model ingesteld (zie Notebook tab)"); return; }
    const prefix = getWordBeforeCursor(s);
    const line   = s.lines[s.cur.row];
    const ctx    = s.lines.slice(Math.max(0, s.cur.row-3), s.cur.row+1).join("\n");
    setAiLoading(true);
    setStatus("🤖 AI suggesties…");
    try {
      const resp = await fetch("/api/llm/chat", {
        method: "POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({
          model: llmModel,
          messages: [{
            role: "user",
            content: `Je bent een tekst-completion assistent. Geef 5 korte woordsuggesties voor de volgende tekst. De cursor staat na het woord "${prefix}". Context:\n\n${ctx}\n\nGeef ALLEEN de 5 woorden/korte zinsdelen, elk op een eigen regel, zonder nummering, zonder uitleg. Suggesties moeten logisch aansluiten op de context en dezelfde taal gebruiken als de tekst.`
          }],
          stream: false,
          options: {temperature: 0.3, num_predict: 60}
        })
      });
      const data = await resp.json();
      const text = data.message?.content || data.response || "";
      const aiWords = text.split("\n")
        .map(w => w.trim().replace(/^[-•*]\s*/, "").replace(/^\d+\.\s*/, ""))
        .filter(w => w.length > 0 && w.length < 60)
        .slice(0,5)
        .map(w => ({word: w, source: "ai"}));
      if (aiWords.length) {
        compRef.current = {list: aiWords, idx: 0, open: true};
        setCompList(aiWords); setCompIdx(0); setCompOpen(true);
        const cv2 = cvRef.current;
        if (cv2) {
          const rect2 = cv2.getBoundingClientRect();
          const nw2   = numColsWidth(S.current);
          const x2 = rect2.left + nw2 + S.current.cur.col * S.current.charW;
          const y2 = rect2.top  + (S.current.cur.row - S.current.scroll + 1) * LINE_H + 4;
          setCompPos({x: Math.min(x2, window.innerWidth - 260), y: y2});
        }
        setStatus("");
      } else {
        setStatus("Geen AI suggesties");
      }
    } catch(e) {
      setStatus("AI fout: " + e.message.slice(0,40));
    }
    setAiLoading(false);
  }, [llmModel]);

  // ── AI taalverbetering ────────────────────────────────────────────────────
  const triggerImprove = React.useCallback(async () => {
    if (!llmModel) { setStatus("Geen AI model — stel in via Notebook tab"); return; }
    const s = S.current;
    const text = s.lines.join("\n").trim();
    if (!text) { setStatus("Geen tekst om te verbeteren"); return; }
    const lang = aiImproveLang === "auto"
      ? (/\b(de|het|een|en|van|in|is|dat|dit|met|ik|je|we)\b/i.test(text) ? "nl" : "en")
      : aiImproveLang;
    setAiImproving(true);
    setStatus("\u{1F916} AI taalverbetering\u2026");
    try {
      const resp = await fetch("/api/llm/improve-text", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ text, lang, model: llmModel }),
      });
      const data = await resp.json();
      if (data.improved) {
        setAiImprove({ original: text, improved: data.improved });
        setStatus("\u2713 AI suggestie klaar \u2014 bekijk onderaan");
      } else {
        setStatus("AI fout: " + (data.error || "onbekend"));
      }
    } catch(e) {
      setStatus("AI fout: " + e.message.slice(0, 50));
    }
    setAiImproving(false);
  }, [llmModel, aiImproveLang]);

  const acceptImprove = React.useCallback(() => {
    if (!aiImprove) return;
    const s = S.current;
    pushUndo(s);
    s.lines = aiImprove.improved.split("\n");
    clamp(); emit(s); draw();
    setAiImprove(null);
    setStatus("\u2713 Tekst vervangen door AI-verbetering");
  }, [aiImprove]);


  // ── Keyboard handler — ALLES hier, geen browser-escape meer ──────────────
  const handleKey = useCallback((e) => {
    const s = S.current;
    const m = s.mode;

    // ────────────────────────── INSERT ──────────────────────────────────────
    if (m === "INSERT") {
      // Completion popup navigatie — heeft prioriteit
      if (compRef.current.open) {
        if (e.key === "Escape") {
          e.preventDefault(); closeCompletion(); draw(); return;
        }
        if (e.key === "ArrowDown") {
          e.preventDefault();
          e.stopPropagation();
          const ni = Math.min(compRef.current.idx+1, compRef.current.list.length-1);
          compRef.current.idx = ni; setCompIdx(ni); draw(); return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          const ni = Math.max(compRef.current.idx-1, 0);
          compRef.current.idx = ni; setCompIdx(ni); draw(); return;
        }
        if (e.key === "Tab" || e.key === "Enter") {
          e.preventDefault(); acceptCompletion(s); return;
        }
        // Andere toetsen: sluit popup en handel normaal af
        if (!e.ctrlKey && !e.metaKey && (e.key.length === 1 || e.key === "Backspace")) {
          closeCompletion();
          // doorval naar normale afhandeling hieronder
        }
      }

      // Escape — altijd onderscheppen, preventDefault, eigen afhandeling
      if (e.key === "Escape") {
        e.preventDefault();
        closeCompletion();
        setMode("NORMAL");
        setStatus("");
        draw();
        return;
      }

      if (e.ctrlKey && e.key === "s") { e.preventDefault(); onSave(); setStatus("opgeslagen ✓"); draw(); return; }
      // Ctrl+H/J/K/L — split-venster navigatie (nnoremap <C-H> <C-W><C-H> etc. uit vimrc)
      if (e.ctrlKey && e.key === "h") { e.preventDefault(); onSplitCmd?.("focus-left");  setStatus("◀ notities"); draw(); return; }
      if (e.ctrlKey && e.key === "l") { e.preventDefault(); onSplitCmd?.("focus-right"); setStatus("▶ split");    draw(); return; }
      if (e.ctrlKey && e.key === "j") { e.preventDefault();
        // Ctrl+J: als split open → focus rechts, anders snippet-expand
        if (onSplitCmd) { onSplitCmd("focus-right"); setStatus("▶ split"); }
        else if (!expandSnippet(s)) setStatus("geen snippet");
        draw(); return; }
      if (e.ctrlKey && e.key === "k") { e.preventDefault(); onSplitCmd?.("focus-left");  setStatus("◀ notities"); draw(); return; }

      // Ctrl+N / Ctrl+P — lokale completion (vim-stijl)
      if (e.ctrlKey && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        if (compRef.current.open) {
          const ni = (compRef.current.idx + 1) % compRef.current.list.length;
          compRef.current.idx = ni; setCompIdx(ni); draw();
        } else {
          triggerLocalCompletion(s);
        }
        return;
      }
      if (e.ctrlKey && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        if (compRef.current.open) {
          const ni = (compRef.current.idx - 1 + compRef.current.list.length) % compRef.current.list.length;
          compRef.current.idx = ni; setCompIdx(ni); draw();
        } else {
          triggerLocalCompletion(s);
        }
        return;
      }

      // Ctrl+Space — AI completion
      if (e.ctrlKey && e.key === " ") {
        e.preventDefault();
        triggerAICompletion(s);
        return;
      }

      // Pijltjes — sluit completion als open, dan navigeren
      if (e.key === "ArrowLeft")  { e.preventDefault(); closeCompletion(); s.cur.col = Math.max(0, s.cur.col-1); scrollToCursor(s); draw(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); closeCompletion(); s.cur.col = Math.min(s.lines[s.cur.row].length, s.cur.col+1); scrollToCursor(s); draw(); return; }
      if (e.key === "ArrowUp")    { e.preventDefault(); closeCompletion(); if(s.cur.row>0){s.cur.row--;s.cur.col=Math.min(s.cur.col,s.lines[s.cur.row].length);} scrollToCursor(s); draw(); return; }
      if (e.key === "ArrowDown")  { e.preventDefault(); closeCompletion(); if(s.cur.row<s.lines.length-1){s.cur.row++;s.cur.col=Math.min(s.cur.col,s.lines[s.cur.row].length);} scrollToCursor(s); draw(); return; }
      if (e.key === "Home")       { e.preventDefault(); closeCompletion(); s.cur.col=0; draw(); return; }
      if (e.key === "End")        { e.preventDefault(); closeCompletion(); s.cur.col=s.lines[s.cur.row].length; draw(); return; }

      if (e.key === "Tab") {
        e.preventDefault();
        if (!compRef.current.open) {
          if (!expandSnippet(s)) { insertChar(s,"    "); emit(s); }
        }
        draw(); return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const {row,col} = s.cur;
        const line   = s.lines[row];
        const indent = line.match(/^(\s*)/)[1];
        const listM  = line.match(/^(\s*)([-*]|\d+\.)\s/);
        const extra  = listM ? listM[2] + " " : "";
        const after  = line.slice(col);
        s.lines[row] = line.slice(0, col);
        s.lines.splice(row+1, 0, indent + extra + after);
        s.cur.row++;
        s.cur.col = indent.length + extra.length;
        closeCompletion();
        scheduleUndo(s); emit(s); scrollToCursor(s);
        if (spellLang !== "off") scheduleSpellCheck();
        draw(); return;
      }

      if (e.key === "Backspace") {
        e.preventDefault();
        const {row,col} = s.cur;
        if (col > 0) {
          s.lines[row] = s.lines[row].slice(0,col-1) + s.lines[row].slice(col);
          s.cur.col--;
        } else if (row > 0) {
          const prev = s.lines[row-1];
          s.cur.col  = prev.length;
          s.lines[row-1] = prev + s.lines[row];
          s.lines.splice(row, 1);
          s.cur.row--;
        }
        // Update completion na delete
        if (compRef.current.open) triggerLocalCompletion(s);
        if (spellLang !== "off") scheduleSpellCheck();
        scheduleUndo(s); emit(s); scrollToCursor(s); draw(); return;
      }

      if (e.key === "Delete") {
        e.preventDefault();
        const {row,col} = s.cur;
        if (col < s.lines[row].length) {
          s.lines[row] = s.lines[row].slice(0,col) + s.lines[row].slice(col+1);
        } else if (row < s.lines.length-1) {
          s.lines[row] = s.lines[row] + s.lines[row+1];
          s.lines.splice(row+1, 1);
        }
        if (spellLang !== "off") scheduleSpellCheck();
        scheduleUndo(s); emit(s); draw(); return;
      }

      // Auto-pairs
      const closer = AUTO_PAIRS[e.key];
      if (closer && !e.ctrlKey) {
        e.preventDefault();
        insertChar(s, e.key + closer);
        s.cur.col--;
        closeCompletion();
        scheduleUndo(s); emit(s); draw(); return;
      }

      // Gewone tekens — trigger completion na woordtekens + markdown-triggers
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        insertChar(s, e.key);
        scheduleUndo(s); emit(s); scrollToCursor(s);
        // Spellcheck plannen na elk teken
        if (spellLang !== "off") scheduleSpellCheck();  // na elk teken
        // Completion: bij alfabetische tekens lokale suggesties
        if (/[a-zA-ZÀ-ÿ']/.test(e.key)) {
          const prefix = getWordBeforeCursor(s);
          if (prefix.length >= 3) {
            triggerLocalCompletion(s);
          } else if (prefix.length < 2) {
            closeCompletion();
          }
        } else {
          // Sluit word-completion bij scheidingstekens,
          // maar toon markdown-snippet hints bij triggers
          closeCompletion();
          const line   = s.lines[s.cur.row];
          const before = line.slice(0, s.cur.col);
          // Toon hint-popup voor markdown-snippets
          const mdTriggers = [
            { re: /\[\[$/, hint: "[[notitie]]  — link invoegen" },
            { re: /#{1,3} $/, hint: "## Sectie  — kop (h1/h2/h3 + Tab)" },
            { re: /\*\*$/, hint: "**tekst**  — bold (bold + Tab)" },
            { re: /\*[^*]?$/, hint: "*tekst*  — cursief (em + Tab)" },
            { re: /^> /, hint: "> citaat  (quote + Tab)" },
            { re: /^- \[ \]/, hint: "- [ ] taak  (todo + Tab)" },
            { re: /```$/, hint: "```taal … \`\`\`  (code + Tab)" },
          ];
          const hit = mdTriggers.find(t => t.re.test(before));
          if (hit) {
            const hint = [{word: hit.hint, source: "md"}];
            compRef.current = {list: hint, idx: 0, open: true};
            setCompList(hint); setCompIdx(0); setCompOpen(true);
          }
        }
        draw(); return;
      }
      return;
    }


      // ── Spelnavigatie: ]s volgende fout, [s vorige fout, z= suggesties ──────
      // ]s — spring naar volgende spelfout
      if (!e.ctrlKey && e.key==="]" && s.mode==="NORMAL") {
        // wacht op volgende toets 's'
        S.current._pendingSpellNav = "next";
        setStatus("]");
        draw(); return;
      }
      if (!e.ctrlKey && e.key==="[" && s.mode==="NORMAL") {
        S.current._pendingSpellNav = "prev";
        setStatus("[");
        draw(); return;
      }
      // Verwerk ]s / [s na pending
      if (S.current._pendingSpellNav && e.key === "s") {
        e.preventDefault();
        const dir = S.current._pendingSpellNav;
        S.current._pendingSpellNav = null;
        setStatus("");
        // Verzamel alle spellfouten gesorteerd op (row, col)
        const errs = [];
        spellErrors.current.forEach((rowErrs, row) =>
          rowErrs.forEach(err => errs.push({row, col: err.col, len: err.len, word: err.word}))
        );
        errs.sort((a,b) => a.row!==b.row ? a.row-b.row : a.col-b.col);
        if (!errs.length) { setStatus("Geen spelfouten"); draw(); return; }
        const {row: cr, col: cc} = s.cur;
        let target = null;
        if (dir === "next") {
          target = errs.find(e => e.row > cr || (e.row===cr && e.col > cc));
          if (!target) target = errs[0]; // wrap
        } else {
          const before = errs.filter(e => e.row < cr || (e.row===cr && e.col < cc));
          target = before.length ? before[before.length-1] : errs[errs.length-1];
        }
        s.cur.row = target.row;
        s.cur.col = target.col;
        scrollToCursor(s);
        setStatus(`Spelfout: '${target.word}'  z= voor suggesties`);
        draw(); return;
      }
      S.current._pendingSpellNav = null;

      // z= — spelsuggesties voor woord onder cursor
      if (!e.ctrlKey && e.key==="z" && s.mode==="NORMAL") {
        S.current._pendingZ = true;
        draw(); return;
      }
      if (S.current._pendingZ && e.key==="=") {
        e.preventDefault();
        S.current._pendingZ = false;
        // Haal woord onder cursor op
        const line = s.lines[s.cur.row];
        const wordRe2 = /[a-zA-ZÀ-ÿ'-]{2,}/g;
        let hit2 = null;
        let m3;
        wordRe2.lastIndex = 0;
        while ((m3 = wordRe2.exec(line)) !== null) {
          if (m3.index <= s.cur.col && s.cur.col <= m3.index + m3[0].length) {
            hit2 = {word: m3[0], col: m3.index, len: m3[0].length};
            break;
          }
        }
        if (!hit2) { setStatus("Geen woord onder cursor"); draw(); return; }
        // Vraag suggesties op via server
        setStatus(`z= suggesties voor '${hit2.word}'…`);
        fetch("/api/spellcheck", {
          method: "POST",
          headers: {"Content-Type":"application/json"},
          body: JSON.stringify({words:[hit2.word], lines:s.lines, lang: spellLang==="off"?"en":spellLang}),
        }).then(r=>r.json()).then(data => {
          const sug = data.suggestions?.[hit2.word] || data.spell?.[hit2.word]?.suggestions || [];
          if (!sug.length) { setStatus(`Geen suggesties voor '${hit2.word}'  (:spell+ om te leren)`); draw(); return; }
          // Toon suggesties als completion popup
          const items = sug.slice(0,8).map(w=>({word:w, source:"spell"}));
          compRef.current = {list:items, idx:0, open:true, replaceWord: hit2};
          setCompList(items); setCompIdx(0); setCompOpen(true);
          const cv3 = cvRef.current;
          if (cv3) {
            const rect3 = cv3.getBoundingClientRect();
            const nw3   = numColsWidth(s);
            const x3 = rect3.left + nw3 + hit2.col * s.charW;
            const y3 = rect3.top  + (s.cur.row - s.scroll + 1) * LINE_H + 4;
            setCompPos({x: Math.min(x3, window.innerWidth - 260), y: y3});
          }
          setStatus(`z= '${hit2.word}' — Tab/Enter=accepteer  Esc=sluiten`);
          draw();
        }).catch(()=>setStatus("Server niet bereikbaar"));
        draw(); return;
      }
      S.current._pendingZ = false;
    // ────────────────────────── COMMAND ─────────────────────────────────────
    if (m === "COMMAND") {
      e.preventDefault();
      if (e.key === "Escape")    { setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); setStatus(""); draw(); return; }
      if (e.key === "Enter")     { runCmd(s, s.cmdBuf); setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); draw(); return; }
      if (e.key === "Backspace") { s.cmdBuf=s.cmdBuf.slice(0,-1); setCmdBuf(s.cmdBuf); draw(); return; }
      if (e.key === "Tab") {
        const tm = s.cmdBuf.match(/^(tag[+-]?\s+)(\S*)$/);
        if (tm) { const p=tm[2].replace(/^#/,""); const hit=allTags.find(t=>t.startsWith(p)&&t!==p); if(hit){s.cmdBuf=tm[1]+hit; setCmdBuf(s.cmdBuf);} }
        draw(); return;
      }
      if (e.key.length === 1) { s.cmdBuf+=e.key; setCmdBuf(s.cmdBuf); draw(); return; }
      return;
    }

    // ────────────────────────── SEARCH ──────────────────────────────────────
    if (m === "SEARCH") {
      e.preventDefault();
      if (e.key === "Escape")    { setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); buildMatches(s,""); draw(); return; }
      if (e.key === "Enter")     { buildMatches(s, s.cmdBuf); jumpMatch(s,0); setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); draw(); return; }
      if (e.key === "Backspace") { s.cmdBuf=s.cmdBuf.slice(0,-1); setCmdBuf(s.cmdBuf); draw(); return; }
      if (e.key.length === 1)    { s.cmdBuf+=e.key; setCmdBuf(s.cmdBuf); draw(); return; }
      return;
    }

    // ────────────────────────── NORMAL ──────────────────────────────────────

    // Completion popup open? Dan pijltjes + Tab/Enter onderscheppen
    if (compRef.current.open) {
      if (e.key === "Escape") {
        e.preventDefault(); closeCompletion(); draw(); return;
      }
      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault(); e.stopPropagation();
        const ni = Math.min(compRef.current.idx + 1, compRef.current.list.length - 1);
        compRef.current.idx = ni; setCompIdx(ni); draw(); return;
      }
      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault(); e.stopPropagation();
        const ni = Math.max(compRef.current.idx - 1, 0);
        compRef.current.idx = ni; setCompIdx(ni); draw(); return;
      }
      if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault(); acceptCompletion(s); draw(); return;
      }
    }

    e.preventDefault();
    const {row,col} = s.cur;
    const line = s.lines[row];

    switch (e.key) {
      // Mode wissels
      case "i": setMode("INSERT"); break;
      case "I": setMode("INSERT"); s.cur.col=0; break;
      case "a": setMode("INSERT"); s.cur.col=Math.min(col+1,line.length); break;
      case "A": setMode("INSERT"); s.cur.col=line.length; break;
      case "o":
        s.lines.splice(row+1,0,"");
        s.cur.row++; s.cur.col=0;
        setMode("INSERT"); break;
      case "O":
        s.lines.splice(row,0,"");
        s.cur.col=0;
        setMode("INSERT"); break;
      case ":": setMode("COMMAND"); s.cmdBuf=""; setCmdBuf(""); break;
      case "/": setMode("SEARCH");  s.cmdBuf=""; setCmdBuf(""); break;

      // Navigatie — h j k l
      case "h": case "ArrowLeft":
        s.cur.col = Math.max(0, col-1); break;
      case "l": case "ArrowRight":
        s.cur.col = Math.min(line.length, col+1); break;
      case "j": case "ArrowDown":
        if (row < s.lines.length-1) { s.cur.row++; s.cur.col=Math.min(col,s.lines[s.cur.row].length); } break;
      case "k": case "ArrowUp":
        if (row > 0) { s.cur.row--; s.cur.col=Math.min(col,s.lines[s.cur.row].length); } break;
      case "w": {
        // voorwaartse woordsprong
        const rest = line.slice(col+1);
        const m2   = rest.search(/\b\w/);
        if (m2>=0) s.cur.col=col+1+m2;
        else if (row<s.lines.length-1){ s.cur.row++; s.cur.col=0; }
        break;
      }
      case "b": {
        // achterwaartse woordsprong
        const before = line.slice(0, col);
        const m2 = before.search(/\w+$/);
        if (m2>=0) s.cur.col=m2;
        else if (row>0){ s.cur.row--; s.cur.col=s.lines[s.cur.row].length; }
        break;
      }
      case "0": s.cur.col=0; break;
      case "$": s.cur.col=line.length; break;
      case "^": { const m2=line.search(/\S/); s.cur.col=m2>=0?m2:0; break; }
      case "g": s.cur.row=0; s.cur.col=0; break;
      case "G": s.cur.row=s.lines.length-1; s.cur.col=0; break;
      case "PageUp":   s.cur.row=Math.max(0,row-s.visRows); break;
      case "PageDown": s.cur.row=Math.min(s.lines.length-1,row+s.visRows); break;

      // Zoeken
      case "n": jumpMatch(s,  1); break;
      case "N": jumpMatch(s, -1); break;

      // Bewerken
      case "x":
        if (col<line.length){ s.yank=line[col]; pushUndo(s); s.lines[row]=line.slice(0,col)+line.slice(col+1); emit(s); }
        break;
      case "d": // dd
        s.yank=line; pushUndo(s);
        s.lines.splice(row,1);
        if (s.lines.length===0) s.lines=[""];
        clamp(); emit(s);
        break;
      case "D":
        pushUndo(s); s.lines[row]=line.slice(0,col); emit(s);
        break;
      case "y": s.yank=line; setStatus("gekopieerd"); break;
      case "p":
        pushUndo(s);
        s.lines.splice(row+1,0,s.yank);
        s.cur.row++; s.cur.col=0;
        emit(s); break;
      case "P":
        pushUndo(s);
        s.lines.splice(row,0,s.yank);
        s.cur.col=0;
        emit(s); break;
      case "u":
        if (s.undoIdx>0){ s.undoIdx--; s.lines=s.undo[s.undoIdx].slice(); clamp(); emit(s); setStatus("undo"); }
        break;
      case "r":
        if (e.ctrlKey && s.undoIdx<s.undo.length-1){ s.undoIdx++; s.lines=s.undo[s.undoIdx].slice(); clamp(); emit(s); setStatus("redo"); }
        break;
      case "J": // join regels
        if (row<s.lines.length-1){ pushUndo(s); s.lines[row]+=" "+s.lines[row+1].trim(); s.lines.splice(row+1,1); emit(s); }
        break;
      case " ": setStatus(""); buildMatches(s,""); break; // nohlsearch
      case "Escape": setStatus(""); break;
      // Ctrl+H/J/K/L worden al afgevangen vóór de switch — zie boven
    }

    clamp();
    scrollToCursor(s);
    draw();
  }, [allTags, noteTags, onTagsChange, onSave, onEscape, runCmd]);

  // Paste
  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const s = S.current;
    if (s.mode !== "INSERT") return;
    const text = e.clipboardData.getData("text");
    text.split("\n").forEach((ln, i) => {
      if (i === 0) {
        insertChar(s, ln);
      } else {
        const {row,col} = s.cur;
        const rest = s.lines[row].slice(col);
        s.lines[row] = s.lines[row].slice(0, col);
        s.lines.splice(row+1, 0, ln);
        s.cur.row++; s.cur.col = ln.length;
        // re-attach rest to last line
        if (i === text.split("\n").length-1) s.lines[s.cur.row] += rest;
      }
    });
    scheduleUndo(s); emit(s); scrollToCursor(s); draw();
  }, []);

  // ── Draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  const drawFrame = useCallback(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const CW  = cv.width / dpr;
    const CH  = cv.height / dpr;
    const s   = S.current;
    const cw  = s.charW;
    const nw  = numColsWidth(s);  // breedte regelnummer-gebied
    const {row: curRow, col: curCol} = s.cur;

    ctx.font         = `${FONT_SIZE}px 'Hack','Courier New',monospace`;
    ctx.textBaseline = "top";

    // ── Achtergrond ───────────────────────────────────────────────────────
    ctx.fillStyle = W.bg;
    ctx.fillRect(0, 0, CW, CH);

    // ── Cursor-kruis ──────────────────────────────────────────────────────
    const cxPos = nw + curCol * cw;
    const cyPos = (curRow - s.scroll) * LINE_H;

    // Cursorline (horizontaal) — hele breedte
    if (curRow >= s.scroll && curRow < s.scroll + s.visRows + 1) {
      ctx.fillStyle = "rgba(255,255,255,0.055)";
      ctx.fillRect(0, cyPos, CW, LINE_H);
    }
    // Cursorcolumn (vertikaal) — hele hoogte
    ctx.fillStyle = "rgba(255,255,255,0.035)";
    ctx.fillRect(cxPos, 0, cw, CH - LINE_H);

    // ── Regelnummer-kolom ─────────────────────────────────────────────────
    ctx.fillStyle = W.lineNrBg;
    ctx.fillRect(0, 0, nw - 2, CH - LINE_H);
    // scheidingslijn
    ctx.fillStyle = W.splitBg;
    ctx.fillRect(nw - 2, 0, 1, CH - LINE_H);

    // ── Regels tekenen ────────────────────────────────────────────────────
    for (let i = 0; i <= s.visRows; i++) {
      const li  = i + s.scroll;
      if (li >= s.lines.length) break;
      const y    = i * LINE_H;
      const line = s.lines[li];
      const isCur = li === curRow;

      // Regelnummer — rechts uitgelijnd in de kolom
      ctx.textAlign = "right";
      ctx.fillStyle = isCur ? W.statusFg : W.fgMuted;
      ctx.font      = isCur
        ? `bold ${FONT_SIZE}px 'Hack','Courier New',monospace`
        : `${FONT_SIZE}px 'Hack','Courier New',monospace`;
      ctx.fillText(String(li + 1), nw - PAD_LEFT, y + 4);
      ctx.textAlign = "left";
      ctx.font      = `${FONT_SIZE}px 'Hack','Courier New',monospace`;

      // Zoek-highlights
      if (s.search && s.matches.length) {
        s.matches.filter(m => m.row === li).forEach((m, mi) => {
          const isActive = mi === s.matchIdx && s.matches[s.matchIdx].row === li;
          ctx.fillStyle = isActive ? "rgba(234,231,136,0.5)" : "rgba(138,198,242,0.2)";
          ctx.fillRect(nw + m.col * cw, y, s.search.length * cw, LINE_H);
        });
      }

      // Tekst — met basis syntaxiskleuring
      drawLine(ctx, line, nw, y, cw, isCur);

      if (spellLang !== "off") {
        // Helper: teken squiggly lijn
        const squiggly = (ex, ey, ew, color) => {
          ctx.beginPath();
          ctx.strokeStyle = color;
          ctx.lineWidth   = 1.5;
          const amp = 1.8, freq = 4;
          ctx.moveTo(ex, ey);
          for (let px = 0; px <= ew; px += freq / 2) {
            ctx.lineTo(ex + px, ey + Math.sin(px / (freq / (2 * Math.PI))) * amp);
          }
          ctx.stroke();
        };

        ctx.save();
        // ── Spellfouten: rode golvende lijn ───────────────────────────────
        if (spellErrors.current.has(li)) {
          for (const err of spellErrors.current.get(li)) {
            squiggly(
              nw + err.col * cw,
              y + LINE_H - 3,
              err.len * cw,
              "rgba(239,68,68,0.90)"   // rood
            );
          }
        }
        // ── Grammaticafouten: oranje dubbele lijn ─────────────────────────
        if (grammarErrors.current.has(li)) {
          for (const err of grammarErrors.current.get(li)) {
            const color = err.type === "style"
              ? "rgba(156,163,175,0.75)"   // grijs voor stijltips
              : "rgba(245,158,11,0.90)";   // oranje voor grammaticafouten
            squiggly(nw + err.col * cw, y + LINE_H - 3, err.len * cw, color);
            squiggly(nw + err.col * cw, y + LINE_H - 1, err.len * cw, color);
          }
        }
        ctx.restore();
      }
    }

    // ── Cursor ────────────────────────────────────────────────────────────
    if (curRow >= s.scroll && curRow < s.scroll + s.visRows + 1) {
      const cx = nw + curCol * cw;

      const cy = (curRow - s.scroll) * LINE_H;
      const m  = s.mode;

      if (m === "INSERT") {
        // Smalle blinkende lijn (| cursor)
        if (blinkOn.current) {
          ctx.fillStyle = W.cursorBg;
          ctx.fillRect(cx - 1, cy + 2, 2, LINE_H - 4);
        }
      } else {
        // Blok cursor voor NORMAL / COMMAND / SEARCH
        const bColor = m === "COMMAND" ? W.orange
                     : m === "SEARCH"  ? W.purple
                     : W.cursorBg;
        ctx.globalAlpha = blinkOn.current ? 0.9 : 0.4;
        ctx.fillStyle   = bColor;
        ctx.fillRect(cx, cy, cw, LINE_H);
        ctx.globalAlpha = 1;
        // Teken karakter ónder blok in donkere kleur
        const ch = (s.lines[curRow] || "")[curCol] || " ";
        ctx.fillStyle = W.bg;
        ctx.fillText(ch, cx, cy + 4);
      }
    }

    // ── Statusbalk ────────────────────────────────────────────────────────
    const sbY  = CH - LINE_H;
    ctx.fillStyle = W.statusBg;
    ctx.fillRect(0, sbY, CW, LINE_H);

    // Mode badge
    const modeLabel  = ` ${s.mode} `;
    const modeColor  = s.mode==="INSERT"  ? W.comment
                     : s.mode==="COMMAND" ? W.orange
                     : s.mode==="SEARCH"  ? W.purple
                     : W.blue;
    const badgeW = modeLabel.length * cw + 4;
    ctx.fillStyle = modeColor;
    ctx.fillRect(0, sbY, badgeW, LINE_H);
    ctx.fillStyle = W.bg;
    ctx.font      = `bold ${FONT_SIZE}px 'Hack','Courier New',monospace`;
    ctx.fillText(modeLabel, 2, sbY + 4);
    ctx.font      = `${FONT_SIZE}px 'Hack','Courier New',monospace`;

    // Statusbericht of hint
    let stxt = "";
    let stxtColor = W.fgMuted;

    if (s.mode === "COMMAND") stxt = ":" + s.cmdBuf + "█";
    else if (s.mode === "SEARCH") stxt = "/" + s.cmdBuf + "█";
    else if (statusMsg) stxt = "  " + statusMsg;
    else {
      // Kijk of cursor op een spell/grammaticafout staat → toon foutmelding
      const curSpell   = spellErrors.current.get(curRow)   || [];
      const curGrammar = grammarErrors.current.get(curRow) || [];
      const spellHit   = curSpell.find(e => curCol >= e.col && curCol < e.col + e.len);
      const gramHit    = curGrammar.find(e => curCol >= e.col && curCol < e.col + e.len);

      if (gramHit) {
        stxt      = `  ⚠ ${gramHit.msg}`;
        stxtColor = gramHit.type === "style" ? W.fgMuted : W.orange;
      } else if (spellHit) {
        stxt      = `  ✗ Onbekend woord: '${spellHit.word}'  (:spell+ om te leren)`;
        stxtColor = "rgba(239,68,68,0.9)";
      } else if (s.mode === "INSERT") {
        stxt = "  -- INSERT --  Ctrl+N=completion  Ctrl+Space=AI  :spell en/nl/auto/off";
      } else {
        stxt = `  ${s.lines.length}L  |  i=INSERT  :w=opslaan  :wq=sluiten  /=zoeken`;
      }
    }

    ctx.fillStyle = stxtColor;
    ctx.fillText(stxt, badgeW + 6, sbY + 4);


    // Positie rechts (ln:col)
    const posStr = `${curRow+1}:${curCol+1}`;
    ctx.textAlign = "right";
    ctx.fillStyle = W.fgDim;
    ctx.fillText(posStr, CW - 6, sbY + 4);
    ctx.textAlign = "left";
  }, [statusMsg]);

  // ── Syntaxiskleuring per regel ─────────────────────────────────────────
  const drawLine = (ctx, line, x, y, cw, isCur) => {
    if (!line) return;

    // Heading
    const hm = line.match(/^(#{1,3})\s/);
    if (hm) {
      ctx.fillStyle = hm[1].length===1 ? W.statusFg
                    : hm[1].length===2 ? W.string
                    : W.fg;
      ctx.fillText(line, x, y + 4);
      return;
    }

    // Teken basiskleur
    ctx.fillStyle = isCur ? W.fg : W.fgDim;
    ctx.fillText(line, x, y + 4);

    // Overlay gekleurde segmenten
    const paint = (start, end, color) => {
      const seg = line.slice(start, end);
      const sx  = x + start * cw;
      ctx.fillStyle = W.bg;
      // herstel achtergrond (rekening houdend met cursorline)
      if (isCur) {
        ctx.fillStyle = "rgba(255,255,255,0.055)";
        ctx.fillRect(sx, y, (end-start)*cw, LINE_H);
        ctx.fillStyle = W.bg;
      }
      ctx.fillStyle = color;
      ctx.fillText(seg, sx, y + 4);
    };

    let i = 0;
    while (i < line.length) {
      // #tag
      if (line[i]==='#' && (i===0||/\W/.test(line[i-1]))) {
        const tm = line.slice(i).match(/^#\w+/);
        if (tm) { paint(i, i+tm[0].length, W.comment); i+=tm[0].length; continue; }
      }
      // [[link]]
      if (line[i]==='[' && line[i+1]==='[') {
        const end = line.indexOf(']]', i+2);
        if (end>=0) { paint(i, end+2, W.keyword); i=end+2; continue; }
      }
      // **vet**
      if (line[i]==='*' && line[i+1]==='*') {
        const end = line.indexOf('**', i+2);
        if (end>=0) { paint(i, end+2, W.statusFg); i=end+2; continue; }
      }
      // *cursief*
      if (line[i]==='*' && line[i+1]!=='*') {
        const end = line.indexOf('*', i+1);
        if (end>=0) { paint(i, end+1, W.fgDim); i=end+1; continue; }
      }
      // `code`
      if (line[i]==='`') {
        const end = line.indexOf('`', i+1);
        if (end>=0) { paint(i, end+1, W.string); i=end+1; continue; }
      }
      i++;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const modeColor = mode==="INSERT" ? W.comment : mode==="COMMAND" ? W.orange : mode==="SEARCH" ? W.purple : W.blue;

  // Bereken cursor-pixelpositie voor de completion popup
  const getCursorPx = () => {
    const s   = S.current;
    const cv  = cvRef.current;
    if (!cv) return {x:0,y:0};
    const rect = cv.getBoundingClientRect();
    const nw   = numColsWidth(s);
    const x    = rect.left + nw + s.cur.col * s.charW;
    const y    = rect.top  + (s.cur.row - s.scroll + 1) * LINE_H;
    return {x, y};
  };

  return React.createElement("div", {
    style: {display:"flex", flexDirection:"column", flex:1, minHeight:0, background:W.bg}
  },
    // Tags strip (verborgen als SmartTagEditor al zichtbaar is boven de editor)
    !hideTagStrip && noteTags.length > 0 && React.createElement("div", {
      style: {padding:"4px 10px", background:W.lineNrBg,
              borderBottom:`1px solid ${W.splitBg}`,
              display:"flex", flexWrap:"wrap", gap:"3px",
              alignItems:"center", flexShrink:0}
    },
      React.createElement("span", {style:{fontSize:"9px",color:W.fgMuted,marginRight:"4px"}}, "TAGS:"),
      ...noteTags.map(t => React.createElement(TagPill, {
        key:t, tag:t, small:true,
        onRemove: t => onTagsChange(noteTags.filter(x => x!==t))
      }))
    ),
    // Canvas-gebied + completion popup overlay
    React.createElement("div", {
      style: {flex:1, position:"relative", overflow:"hidden", minHeight:0},
      tabIndex: -1,
      onClick: () => inputRef.current?.focus(),
      onKeyDown: (e) => {
        // Onderschep pijltjestoetsen op wrapper-niveau als popup open is
        // zodat de browser ze niet voor scrollen gebruikt
        if (compRef.current.open &&
            (e.key === "ArrowDown" || e.key === "ArrowUp" ||
             e.key === "Tab" || e.key === "Enter")) {
          e.preventDefault();
          e.stopPropagation();
          inputRef.current?.dispatchEvent(new KeyboardEvent("keydown", {
            key: e.key, bubbles: false,
            ctrlKey: e.ctrlKey, shiftKey: e.shiftKey,
          }));
        }
      },
      onWheel: (e) => {
        e.preventDefault();
        const s = S.current;
        const lines = e.deltaY > 0 ? 3 : -3;
        s.scroll = Math.max(0, Math.min(s.lines.length - 1, s.scroll + lines));
        draw();
      },
    },
      React.createElement("canvas", {ref:cvRef, style:{display:"block"}}),

      // ── Completion popup ──────────────────────────────────────────────────
      compOpen && compList.length > 0 && React.createElement("div", {
        "data-comp-list": "1",
        style: {
          position: "fixed",
          left: compPos.x + "px",
          top:  compPos.y + "px",
          zIndex: 9999,
          background: W.bg2,
          border: `1px solid ${W.blue}`,
          borderRadius: "5px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
          minWidth: "200px",
          maxWidth: "340px",
          overflowY: "auto",
          maxHeight: "240px",
          pointerEvents: "none",  // toetsafvang blijft bij het canvas
        }
      },
        // Popup header
        React.createElement("div", {
          style: {
            padding: "3px 10px",
            background: W.lineNrBg,
            borderBottom: `1px solid ${W.splitBg}`,
            fontSize: "10px", color: W.fgMuted,
            display: "flex", justifyContent: "space-between",
          }
        },
          React.createElement("span", null, aiLoading ? "🤖 AI…" : "💡 Completion"),
          React.createElement("span", null, "↑↓ Tab=accepteer  Esc=sluiten")
        ),
        // Suggesties
        ...compList.map((item, idx) =>
          React.createElement("div", {
            key: idx,
            "data-comp-item": idx,
            style: {
              padding: "5px 12px",
              background: idx === compIdx ? W.blue+"22" : "transparent",
              borderLeft: idx === compIdx ? `3px solid ${W.blue}` : "3px solid transparent",
              fontSize: "13px",
              color: idx === compIdx ? W.fg : W.fgDim,
              fontFamily: "'Hack','Courier New',monospace",
              display: "flex", alignItems: "center", gap: "8px",
              borderBottom: idx < compList.length-1 ? `1px solid ${W.splitBg}` : "none",
            }
          },
            // Bron-badge
            React.createElement("span", {
              style: {
                fontSize: "9px", padding: "1px 5px", borderRadius: "8px",
                background: item.source === "ai" ? W.purple+"33" : item.source === "md" ? W.orange+"33" : W.comment+"33",
                color:      item.source === "ai" ? W.purple      : item.source === "md" ? W.orange      : W.comment,
                flexShrink: 0,
              }
            }, item.source === "ai" ? "AI" : item.source === "md" ? "md" : "↩"),
            // Woord
            React.createElement("span", {style:{flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}},
              item.word
            )
          )
        )
      ),

      // ── Spell-indicator (rechts boven in editor) ─────────────────────────
      spellLang !== "off" && React.createElement("div", {
        style: {
          position: "absolute", top: "6px", right: "8px",
          fontSize: "10px", color: W.fgMuted,
          background: W.bg2 + "cc", borderRadius: "4px",
          padding: "2px 6px", letterSpacing: "0.5px",
          border: `1px solid ${W.splitBg}`,
          pointerEvents: "none",
        }
      }, `spell:${spellLang}  :spell+ = woord leren`),

      // Onzichtbaar input-element — vangt ALLES af, inclusief Escape
      // readOnly + size=1 → browser toont niks, maar events komen wél binnen
      React.createElement("input", {
        ref:      inputRef,
        onKeyDown:handleKey,
        onPaste:  handlePaste,
        readOnly: true,
        style: {
          position:"absolute", top:0, left:0,
          width:"1px", height:"1px", opacity:0,
          border:"none", outline:"none", padding:0,
          fontSize:"1px", pointerEvents:"none",
        },
        tabIndex: 0,
      })
    ),

    // ── AI taalverbeterbalk — vaste smalle balk onderaan ─────────────────────
    React.createElement("div", {
      style: {
        flexShrink: 0,
        borderTop: `1px solid ${W.splitBg}`,
        background: W.bg2,
        display: "flex", alignItems: "center", gap: "6px",
        padding: "4px 10px",
        position: "relative",   // anker voor het overlay-venster
      }
    },
      React.createElement("span", {style:{fontSize:"11px", color: W.fgMuted, whiteSpace:"nowrap"}}, "🤖 AI:"),

      // Taal selector
      ["auto","nl","en"].map(l =>
        React.createElement("button", {
          key: l,
          onClick: () => setAiImproveLang(l),
          style: {
            background: aiImproveLang === l ? "rgba(138,198,242,0.2)" : "none",
            border: `1px solid ${aiImproveLang === l ? W.blue : W.splitBg}`,
            borderRadius: "4px", padding: "1px 7px",
            color: aiImproveLang === l ? W.blue : W.fgMuted,
            fontSize: "11px", cursor: "pointer",
          }
        }, l)
      ),

      // Verbeter-knop
      React.createElement("button", {
        onClick: triggerImprove,
        disabled: aiImproving,
        style: {
          background: aiImproving ? "none" : "rgba(138,198,242,0.12)",
          border: `1px solid ${aiImproving ? W.splitBg : "rgba(138,198,242,0.4)"}`,
          borderRadius: "4px", padding: "2px 10px",
          color: aiImproving ? W.fgMuted : "#a8d8f0",
          fontSize: "11px", cursor: aiImproving ? "not-allowed" : "pointer",
        }
      }, aiImproving ? "⏳ bezig…" : "✨ verbeter"),

      // Sluit-knop (alleen als suggestie open is)
      aiImprove && React.createElement("button", {
        onClick: () => setAiImprove(null),
        style: {
          background: "none", border: "none",
          color: W.fgMuted, fontSize: "13px",
          cursor: "pointer", marginLeft: "auto", lineHeight: 1,
        }
      }, "×"),

      // ── Resultaatvenster als overlay BOVEN de balk ──────────────────────────
      aiImprove && React.createElement("div", {
        style: {
          position: "absolute",
          bottom: "100%",        // direkt boven de balk
          left: 0, right: 0,
          background: W.bg2,
          border: `1px solid rgba(138,198,242,0.35)`,
          borderBottom: "none",
          borderRadius: "6px 6px 0 0",
          boxShadow: "0 -4px 16px rgba(0,0,0,0.4)",
          zIndex: 200,
          maxHeight: "260px",
          display: "flex", flexDirection: "column",
          overflow: "hidden",
        }
      },
        // Header-balk
        React.createElement("div", {
          style: {
            padding: "6px 12px",
            background: "rgba(138,198,242,0.08)",
            borderBottom: `1px solid rgba(138,198,242,0.18)`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }
        },
          React.createElement("span", {
            style:{fontSize:"11px", color:"#a8d8f0", letterSpacing:"0.5px"}
          }, "AI SUGGESTIE — verbeterde versie"),
          React.createElement("div", {style:{display:"flex", gap:"6px"}},
            React.createElement("button", {
              onClick: acceptImprove,
              style: {
                background: "rgba(159,202,86,0.2)",
                border: `1px solid rgba(159,202,86,0.4)`,
                borderRadius: "4px", padding: "2px 10px",
                color: W.comment, fontSize: "12px",
                cursor: "pointer", fontWeight: "bold",
              }
            }, "✓ overnemen"),
            React.createElement("button", {
              onClick: () => setAiImprove(null),
              style: {
                background: "none", border: `1px solid ${W.splitBg}`,
                borderRadius: "4px", padding: "2px 8px",
                color: W.fgMuted, fontSize: "12px", cursor: "pointer",
              }
            }, "negeren")
          )
        ),
        // Verbeterde tekst — scrollbaar
        React.createElement("div", {
          style: {
            padding: "8px 12px",
            fontSize: "13px", color: W.fg,
            lineHeight: "1.6",
            overflowY: "auto",
            fontFamily: "'Hack','Courier New',monospace",
            whiteSpace: "pre-wrap",
          }
        }, aiImprove.improved)
      )
    )
  );
};



// ── Gedeelde TagFilterBar ─────────────────────────────────────────────────────
// Inklapbaar, doorzoekbaar en scrollbaar tag-filter component.
// Props:
//   tags        – array van beschikbare tag-strings
//   activeTag   – huidig actieve tag (null = alles)
//   onChange    – callback(tag|null)
//   compact     – bool, kleinere weergave (default false)
//   tagColors   – optioneel object {tag: kleur}
//   maxVisible  – aantal direct zichtbare tags voor inklappping (default 8)
const TagFilterBar = ({tags=[], activeTag, onChange, compact=false, tagColors={}, maxVisible=8}) => {
  const [open,      setOpen]      = React.useState(false);
  const [search,    setSearch]    = React.useState("");
  const searchRef = React.useRef(null);

  if (!tags.length) return null;

  const sz  = compact ? "12px" : "13px";
  const pad = compact ? "3px 8px" : "4px 11px";
  const rad = "5px";
  const gap = compact ? "4px"  : "5px";

  // Filter op zoekopdracht
  const filtered = search
    ? tags.filter(t => t.toLowerCase().includes(search.toLowerCase()))
    : tags;

  // Eerste N tags als "preview" (altijd zichtbaar als ingeklapt)
  const previewTags = filtered.slice(0, maxVisible);
  const hiddenCount = filtered.length - maxVisible;
  const hasMore     = hiddenCount > 0;

  const chipStyle = (t) => {
    const active = t ? activeTag===t : !activeTag;
    const col    = t ? (tagColors[t] || "#b8e06a") : W.blue;
    return {
      fontSize:sz, padding:pad, borderRadius:rad,
      cursor:"pointer", userSelect:"none",
      background: active
        ? (t ? "rgba(184,224,106,0.18)" : "rgba(138,198,242,0.18)")
        : "rgba(255,255,255,0.06)",
      color:      active ? col : "#c8c0b4",
      border:    `1px solid ${active ? col+"80" : "rgba(255,255,255,0.14)"}`,
      fontWeight: active ? "600" : "400",
      transition:"background 0.12s, color 0.12s, border 0.12s",
      whiteSpace:"nowrap",
      letterSpacing:"0.1px",
      lineHeight:"1.3",
      maxWidth:"100%",
      overflow:"hidden",
      textOverflow:"ellipsis",
      display:"inline-block",
    };
  };

  const toggleOpen = () => {
    setOpen(o => {
      if (!o) setTimeout(() => searchRef.current?.focus(), 60);
      else setSearch("");
      return !o;
    });
  };

  // Header-rij: "TAGS" label + actief filter + inklapknop
  const header = React.createElement("div",{
    style:{display:"flex", alignItems:"center", gap:"5px",
           marginBottom: open||activeTag ? "5px" : "0"}
  },
    // Inklapknop + label
    React.createElement("span",{
      onClick: toggleOpen,
      style:{
        fontSize:"11px", letterSpacing:"1.2px",
        color: open ? W.blue : "#c8c0b4",
        cursor:"pointer", userSelect:"none",
        display:"flex", alignItems:"center", gap:"4px",
        fontWeight: open ? "700" : "600",
        transition:"color 0.12s",
      }
    },
      React.createElement("span",{style:{
        fontSize:"9px", display:"inline-block",
        transform: open ? "rotate(90deg)" : "rotate(0deg)",
        transition:"transform 0.15s", lineHeight:1
      }}, "▶"),
      "TAGS"
    ),
    // Badge: aantal tags + actief filter indicator
    React.createElement("span",{style:{
      fontSize:"11px", padding:"2px 7px", borderRadius:"4px",
      background: activeTag ? "rgba(159,202,86,0.14)" : "rgba(255,255,255,0.07)",
      color: activeTag ? "#b8e06a" : "#c8c0b4",
      border:`1px solid ${activeTag ? "rgba(159,202,86,0.45)" : "rgba(255,255,255,0.14)"}`,
      fontWeight: activeTag ? "600" : "400",
      cursor:"default",
    }},
      activeTag ? `#${activeTag}` : `${tags.length}`
    ),
    // "× wis filter" knopje als er een actief filter is
    activeTag && React.createElement("span",{
      onClick:()=>onChange(null),
      title:"Filter wissen",
      style:{
        fontSize:"12px", color:W.orange, cursor:"pointer",
        padding:"2px 7px", borderRadius:"4px",
        border:`1px solid rgba(229,120,109,0.4)`,
        background:"rgba(229,120,109,0.1)",
        fontWeight:"600",
        lineHeight:"1.3",
      }
    }, "× wis")
  );

  // Ingeklapte staat: toon preview-chips + "… N meer" knop
  if (!open) {
    const visibleTags = search ? filtered : previewTags;
    return React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"3px"}},
      header,
      React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap,alignItems:"center",minWidth:0}},
        React.createElement("span",{
          onClick:()=>onChange(null), style:chipStyle(null)
        }, "alles"),
        ...visibleTags.map(t => React.createElement("span",{
          key:t, onClick:()=>onChange(activeTag===t ? null : t),
          style:{...chipStyle(t), maxWidth:"100%"},
          title:"#"+t,   // tooltip toont volledige naam bij hover
        }, "#"+t)),
        // "… N meer" knop
        !search && hasMore && React.createElement("span",{
          onClick: toggleOpen,
          style:{
            fontSize:sz, padding:pad, borderRadius:rad,
            cursor:"pointer", userSelect:"none",
            background:"rgba(138,198,242,0.07)",
            color:"rgba(138,198,242,0.55)",
            border:`1px solid rgba(138,198,242,0.18)`,
            fontStyle:"italic",
          }
        }, `+${hiddenCount} meer…`)
      )
    );
  }

  // Uitgeklapte staat: zoekbalk + scrollbare lijst van alle gefilterde tags
  return React.createElement("div",{
    style:{display:"flex",flexDirection:"column",gap:"4px"}
  },
    header,

    // Zoekbalk
    React.createElement("div",{style:{position:"relative"}},
      React.createElement("input",{
        ref: searchRef,
        value: search,
        onChange: e => setSearch(e.target.value),
        placeholder: "tag zoeken…",
        style:{
          width:"100%", boxSizing:"border-box",
          background:"rgba(0,0,0,0.3)",
          border:`1px solid ${search ? W.blue : W.splitBg}`,
          borderRadius:"4px", padding:"4px 22px 4px 7px",
          color:W.fg, fontSize:"13px", outline:"none",
          transition:"border-color 0.12s",
        }
      }),
      search && React.createElement("span",{
        onClick:()=>{ setSearch(""); searchRef.current?.focus(); },
        style:{
          position:"absolute", right:"5px", top:"50%",
          transform:"translateY(-50%)",
          fontSize:"14px", color:W.fgMuted, cursor:"pointer",
          lineHeight:1,
        }
      }, "×")
    ),

    // Scrollbare tag-lijst
    React.createElement("div",{style:{
      maxHeight:"180px", overflowY:"auto",
      display:"flex", flexWrap:"wrap", gap,
      alignItems:"flex-start", alignContent:"flex-start",
      padding:"3px 1px",
      // Subtiel scrollbar
      scrollbarWidth:"thin",
      scrollbarColor:`${W.splitBg} transparent`,
    }},
      // "alles" chip altijd bovenaan
      React.createElement("span",{
        onClick:()=>onChange(null), style:chipStyle(null)
      }, "alles"),
      filtered.length === 0
        ? React.createElement("span",{style:{fontSize:"12px",color:W.fgMuted,fontStyle:"italic"}},
            "geen tags gevonden")
        : filtered.map(t => React.createElement("span",{
            key:t,
            onClick:()=>onChange(activeTag===t ? null : t),
            style:chipStyle(t)
          }, "#"+t))
    ),

    // Footer: teller
    React.createElement("div",{style:{
      fontSize:"11px", color:W.fgMuted, textAlign:"right",
      paddingRight:"2px",
    }},
      filtered.length < tags.length
        ? `${filtered.length} van ${tags.length} tags`
        : `${tags.length} tags totaal`
    )
  );
};


// ── Obsidian-stijl Knowledge Graph ────────────────────────────────────────────
const Graph = ({notes, onSelect, selectedId, localMode=false, onUpdateNote, onDeleteNote}) => {
  const { useState, useRef, useCallback, useMemo, useEffect } = React;

  const cvRef      = useRef(null);
  const nodesRef   = useRef([]);
  const afRef      = useRef(null);
  const fitDoneRef = useRef(false); // voorkomt herhaald fitten
  const dragging   = useRef(null);
  const hovering   = useRef(null);
  const isPanning  = useRef(false);
  const panStart   = useRef({x:0,y:0,ox:0,oy:0});
  const viewRef    = useRef({scale:1, ox:0, oy:0});

  // ── Filter & weergave state ───────────────────────────────────────────────
  const [filterTag,    setFilterTag]   = useState(null);
  const [depthLimit,   setDepthLimit]  = useState(0);
  const [searchQ,      setSearchQ]     = useState("");
  const [showLocal,    setShowLocal]   = useState(false);
  const [orphansOnly,  setOrphansOnly] = useState(false);
  const [hubMode,      setHubMode]     = useState(false);
  const [communityMode,setCommunityMode]= useState(false);
  const [pathMode,     setPathMode]    = useState(false);
  const [semanticMode, setSemanticMode]= useState(false);
  const [semanticEdges,setSemanticEdges]=useState([]);
  const [semLoading,   setSemLoading]  = useState(false);
  const [pathFrom,     setPathFrom]    = useState(null);
  const [pathTo,       setPathTo]      = useState(null);
  const [pathResult,   setPathResult]  = useState(null);
  const [ctxMenu,      setCtxMenu]     = useState(null);
  const [pinnedIds,    setPinnedIds]   = useState(new Set());
  const [scale,        setScale]       = useState(1);
  const pathRef    = useRef(null);
  const semEdgesRef= useRef([]);
  const pinnedRef  = useRef(new Set());

  useEffect(()=>{ pathRef.current    = pathResult; }, [pathResult]);
  useEffect(()=>{ semEdgesRef.current= semanticEdges; }, [semanticEdges]);
  useEffect(()=>{ pinnedRef.current  = pinnedIds; }, [pinnedIds]);

  // ── Cleanup: verwijder broken links uit alle notities ─────────────────────
  const [cleanupMsg,   setCleanupMsg]  = useState("");
  const [emptyMsg,     setEmptyMsg]    = useState("");
  const [orphanMsg,    setOrphanMsg]   = useState("");
  const [cssCleanMsg,  setCssCleanMsg] = useState("");

  const cleanupBrokenLinks = useCallback(async () => {
    if (!onUpdateNote) return;
    const noteIds = new Set(notes.map(n => n.id));
    let fixed = 0;
    for (const note of notes) {
      const links = extractLinks(note.content||"");
      const broken = links.filter(lid => !noteIds.has(lid));
      if (broken.length === 0) continue;
      let newContent = note.content;
      broken.forEach(lid => {
        newContent = newContent.replace(new RegExp(`\\[\\[${lid}\\]\\]`, 'g'), '');
      });
      await onUpdateNote({...note, content: newContent, modified: new Date().toISOString()});
      fixed += broken.length;
    }
    setCleanupMsg(fixed > 0 ? `✓ ${fixed} link${fixed!==1?"s":""} verwijderd` : "✓ Geen gebroken links");
    setTimeout(() => setCleanupMsg(""), 4000);
  }, [notes, onUpdateNote]);

  const cleanupEmptyNotes = useCallback(async () => {
    if (!onUpdateNote) return;
    // Een notitie is "leeg" als titel én content na trim() leeg of alleen whitespace/streepjes zijn
    const isEmpty = n => {
      const t = (n.title||"").trim();
      const c = (n.content||"").replace(/^[-\s*#]+$/gm,"").trim();
      return !t && !c;
    };
    const empty = notes.filter(isEmpty);
    if (!empty.length) {
      setEmptyMsg("✓ Geen lege notities");
      setTimeout(() => setEmptyMsg(""), 3000);
      return;
    }
    // Toon bevestiging via msg, tweede klik verwijdert
    if (!emptyMsg.startsWith("⚠")) {
      setEmptyMsg(`⚠ ${empty.length} lege notitie${empty.length!==1?"s":""} — klik nogmaals`);
      return;
    }
    // Tweede klik: verwijder via server
    let deleted = 0;
    for (const note of empty) {
      try {
        await fetch(`/api/notes/${encodeURIComponent(note.id)}`, {method:"DELETE"});
        onDeleteNote?.(note.id);
        deleted++;
      } catch {}
    }
    setEmptyMsg(`✓ ${deleted} lege notitie${deleted!==1?"s":""} verwijderd`);
    setTimeout(() => setEmptyMsg(""), 4000);
  }, [notes, emptyMsg, onUpdateNote, onDeleteNote]);

  const deleteOrphans = useCallback(async () => {
    if (!onUpdateNote) return;
    // Bepaal actuele orphans: notities zonder links en niet gelinkt door anderen
    const noteIds   = new Set(notes.map(n => n.id));
    const linkedIds = new Set(
      notes.flatMap(n => extractLinks(n.content||"").filter(id => noteIds.has(id)))
    );
    const orphans = notes.filter(n =>
      extractLinks(n.content||"").filter(id => noteIds.has(id)).length === 0 &&
      !linkedIds.has(n.id)
    );
    if (!orphans.length) {
      setOrphanMsg("✓ Geen wezen-notities");
      setTimeout(() => setOrphanMsg(""), 3000);
      return;
    }
    // Stap 1: toon aantal met bevestiging
    if (!orphanMsg.startsWith("⚠")) {
      setOrphanMsg(`⚠ ${orphans.length} wezen — klik nogmaals`);
      return;
    }
    // Stap 2: verwijder
    let deleted = 0;
    for (const note of orphans) {
      try {
        await fetch(`/api/notes/${encodeURIComponent(note.id)}`, {method:"DELETE"});
        onDeleteNote?.(note.id);
        deleted++;
      } catch {}
    }
    setOrphanMsg(`✓ ${deleted} wezen-notitie${deleted!==1?"s":""} verwijderd`);
    setTimeout(() => setOrphanMsg(""), 4000);
  }, [notes, orphanMsg, onDeleteNote]);
  const cleanupCssGarbage = React.useCallback(async () => {
    setCssCleanMsg("⏳ Bezig…");
    try {
      const res = await fetch("/api/cleanup-vault", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        const n = data.cleaned || 0;
        setCssCleanMsg(n > 0 ? `✓ ${n} notitie${n!==1?"s":""} opgeschoond` : "✓ Alles al schoon");
        if (n > 0) NoteStore.load();
      } else {
        setCssCleanMsg("⚠ " + (data.error || "Mislukt"));
      }
    } catch(e) {
      setCssCleanMsg("⚠ " + e.message);
    }
    setTimeout(() => setCssCleanMsg(""), 5000);
  }, []);
  const fetchSemanticEdges = useCallback(async () => {
    if (!notes.length) return;
    setSemLoading(true);
    try {
      const seen = new Set(), edges = [];
      await Promise.all(notes.slice(0,80).map(async n => {
        const r = await fetch("/api/llm/similar", {method:"POST",
          headers:{"Content-Type":"application/json"},
          body: JSON.stringify({note_id:n.id, top_n:4})});
        const d = await r.json();
        (d.similar||[]).forEach(sim => {
          if (sim.score < 0.12) return;
          if ((n.content||"").includes("[["+sim.id+"]]")) return;
          const key=[n.id,sim.id].sort().join("~");
          if (seen.has(key)) return;
          seen.add(key);
          edges.push({from:n.id, to:sim.id, score:sim.score});
        });
      }));
      setSemanticEdges(edges);
    } catch(e) { console.warn("Semantic edges:",e); }
    finally { setSemLoading(false); }
  }, [notes]);

  useEffect(() => {
    if (semanticMode) fetchSemanticEdges();
    else setSemanticEdges([]);
  }, [semanticMode, fetchSemanticEdges]);

  // ── BFS pad ──────────────────────────────────────────────────────────────
  const bfsPath = useCallback((fromId, toId) => {
    const map = {};
    nodesRef.current.forEach(n => { map[n.id]=n; });
    if (!map[fromId]||!map[toId]) return null;
    const visited=new Set([fromId]), queue=[[fromId]];
    while (queue.length) {
      const path=queue.shift(), cur=path[path.length-1];
      if (cur===toId) return path;
      const node=map[cur];
      const nb=[...(node?.links||[]),
        ...nodesRef.current.filter(n=>(n.links||[]).includes(cur)).map(n=>n.id)];
      for (const id of nb) {
        if (!visited.has(id)&&map[id]){ visited.add(id); queue.push([...path,id]); }
      }
    }
    return null;
  }, []);

  // ── Tag kleuren ───────────────────────────────────────────────────────────
  const tagColors = useMemo(()=>{
    const all=[...new Set(notes.flatMap(n=>n.tags||[]))];
    const pal=[W.blue,W.comment,W.orange,W.purple,W.string,W.type];
    const m={};
    all.forEach((t,i)=>{ m[t]=pal[i%pal.length]; });
    return m;
  },[notes]);

  // ── Viewport helpers ──────────────────────────────────────────────────────
  const toWorld  = (sx,sy) => {
    const v=viewRef.current;
    return { x:(sx-v.ox)/v.scale, y:(sy-v.oy)/v.scale };
  };
  const toScreen = (wx,wy) => {
    const v=viewRef.current;
    return { x:wx*v.scale+v.ox, y:wy*v.scale+v.oy };
  };

  // ── Fit all nodes into viewport ───────────────────────────────────────────
  const fitToView = useCallback(()=>{
    const cv=cvRef.current; if(!cv) return;
    const dpr=window.devicePixelRatio||1;

    const attempt = (tries=0) => {
      const CW=cv.width/dpr, CH=cv.height/dpr;
      // Canvas nog niet gemeten — probeer opnieuw
      if(!CW || !CH) {
        if (tries < 10) setTimeout(()=>attempt(tries+1), 50);
        return;
      }
      const ns=nodesRef.current;
      if (!ns.length) return;
      const minX=Math.min(...ns.map(n=>n.x));
      const maxX=Math.max(...ns.map(n=>n.x));
      const minY=Math.min(...ns.map(n=>n.y));
      const maxY=Math.max(...ns.map(n=>n.y));
      const pw=maxX-minX||1, ph=maxY-minY||1;
      const padding=80;
      const s=Math.min((CW-padding)/pw,(CH-padding)/ph,2);
      viewRef.current={
        scale:s,
        ox: CW/2 - ((minX+maxX)/2)*s,
        oy: CH/2 - ((minY+maxY)/2)*s,
      };
      setScale(s); // trigger re-render
    };
    attempt();
  }, []);

  // ── Build graph nodes ─────────────────────────────────────────────────────
  const build = useCallback(()=>{
    const cv=cvRef.current; if(!cv) return;
    const dpr=window.devicePixelRatio||1;
    fitDoneRef.current = false; // reset zodat nieuwe graaf automatisch fit
    const CW=cv.width/dpr, CH=cv.height/dpr;

    // Zet viewport direct zodat world-origin (0,0) in het midden staat
    // fitToView verfijnt dit zodra simulatie stabiel is
    if (CW && CH) {
      viewRef.current = { scale:1, ox: CW/2, oy: CH/2 };
    }

    let allNotes=notes;

    // Verwijder lege notities uit de graaf (geen titel én geen zinvolle content)
    allNotes = allNotes.filter(n => {
      const t = (n.title||"").trim();
      const c = (n.content||"").replace(/[-\s*#\n]/g,"").trim();
      return t || c;
    });

    // ── Tag-filter ──────────────────────────────────────────────────────────
    if (filterTag) {
      allNotes = allNotes.filter(n => (n.tags||[]).includes(filterTag));
    }

    // ── Dieptefilter: BFS vanuit seed-nodes, max N stappen ────────────────
    // Seed = geselecteerde node (of alle tag-gefilterde nodes als geen selectie)
    if (depthLimit > 0) {
      // Bepaal seed-set
      const seedIds = new Set();
      if (selectedId && allNotes.find(n=>n.id===selectedId)) {
        seedIds.add(selectedId);
      } else if (filterTag) {
        // Alle tag-gefilterde nodes zijn seed
        allNotes.forEach(n => seedIds.add(n.id));
      } else {
        // Geen anker: sla dieptefilter over
      }

      if (seedIds.size > 0) {
        // Bouw link-index over ALLE notes (niet alleen gefilterd) voor accurate BFS
        const linkIndex = {};
        notes.forEach(n => {
          linkIndex[n.id] = [
            ...extractLinks(n.content),
            ...notes.filter(x=>extractLinks(x.content).includes(n.id)).map(x=>x.id),
          ];
        });

        // BFS
        const visited = new Set(seedIds);
        let frontier  = [...seedIds];
        for (let d = 0; d < depthLimit; d++) {
          const next = [];
          frontier.forEach(id => {
            (linkIndex[id]||[]).forEach(nb => {
              if (!visited.has(nb)) { visited.add(nb); next.push(nb); }
            });
          });
          frontier = next;
          if (!frontier.length) break;
        }
        allNotes = allNotes.filter(n => visited.has(n.id));
      }
    }

    // Orphan filter
    // Lokale graaf
    if (showLocal && selectedId) {
      const sel = allNotes.find(n=>n.id===selectedId);
      const fwd = sel ? extractLinks(sel.content) : [];
      const bwd = allNotes.filter(n=>extractLinks(n.content).includes(selectedId)).map(n=>n.id);
      const keep = new Set([selectedId,...fwd,...bwd]);
      allNotes = allNotes.filter(n=>keep.has(n.id));
    }

    const tagNodes = [...new Set(allNotes.flatMap(n=>n.tags||[]))].map(t=>({
      id:"tag-"+t, title:"#"+t, links:[], tags:[t], type:"tag", color:tagColors[t]||W.comment
    }));

    const all=[
      ...allNotes.map(n=>({
        id:n.id, title:n.title,
        links:extractLinks(n.content),
        typedLinks:extractTypedLinks(n.content||""),
        tags:n.tags||[], type:"note",
        linkCount:extractLinks(n.content).length,
        backCount:notes.filter(x=>extractLinks(x.content).includes(n.id)).length,
      })),
      ...tagNodes,
    ];

    // Bouw een set van geldige IDs én een titel→ID map voor title-based links
    const validIds  = new Set(all.map(n=>n.id));
    const titleToId = {};
    all.forEach(n=>{ if(n.title) titleToId[n.title.toLowerCase().trim()] = n.id; });

    // Resolveer alle links: ID direct geldig → behoud; anders probeer titel-lookup
    all.forEach(n=>{
      n.links = (n.links||[]).map(raw => {
        if (validIds.has(raw)) return raw;                           // al een geldig ID
        const byTitle = titleToId[raw.toLowerCase().trim()];
        return byTitle || null;                                      // titel gevonden of weg
      }).filter(Boolean);
      // Dedupliceer
      n.links = [...new Set(n.links)];
      n.linkCount = n.links.length;
    });

    // Bouw snelle lookup: welke note-IDs worden gelinkt vanuit andere notes
    const linkedByOthers = new Set();
    all.forEach(n => n.links.forEach(lid => linkedByOthers.add(lid)));

    // Orphan-filter: gebaseerd op gefilterde links
    if (orphansOnly) {
      const orphanIds = new Set(
        all.filter(n => n.type==="note" && n.links.length===0 && !linkedByOthers.has(n.id))
           .map(n => n.id)
      );
      // Verwijder alle non-orphan noten én bijbehorende tag-nodes
      const orphanTags = new Set(
        all.filter(n => orphanIds.has(n.id)).flatMap(n => n.tags||[])
      );
      all.splice(0, all.length, ...all.filter(n =>
        n.type !== "note" && n.type !== "tag"
          ? false  // pdf ook weghalen in orphan-modus
          : n.type === "note"
            ? orphanIds.has(n.id)
            : orphanTags.has(n.tags?.[0])  // tag-node alleen als weesgeval die tag heeft
      ));
    }

    nodesRef.current = all.map(n => {
      const ex=nodesRef.current.find(x=>x.id===n.id);
      if (ex) return {...ex,...n, pinned:pinnedRef.current.has(n.id)};
      const angle=(all.indexOf(n)/all.length)*Math.PI*2;
      // Fallback radius als canvas nog geen grootte heeft (tab nog niet zichtbaar)
      const r=Math.min(CW||600, CH||600)*0.28 || 300;
      return {...n, x:r*Math.cos(angle)+(Math.random()-.5)*60,
                    y:r*Math.sin(angle)+(Math.random()-.5)*60,
                    vx:0, vy:0, pinned:false};
    });

    nodesRef.current.forEach(n=>{
      n.tagLinks=(n.tags||[]).map(t=>"tag-"+t)
        .filter(tid=>nodesRef.current.find(x=>x.id===tid));
    });

    // Hub scores
    nodesRef.current.forEach(n=>{
      n.inDegree  = nodesRef.current.filter(x=>(x.links||[]).includes(n.id)).length;
      n.outDegree = (n.links||[]).length;
      n.hubScore  = n.inDegree + n.outDegree;
    });
    const maxHub=Math.max(1,...nodesRef.current.filter(x=>x.type==="note").map(x=>x.hubScore));
    nodesRef.current.forEach(n=>{ n.hubNorm=n.hubScore/maxHub; });

    // Edge weights
    nodesRef.current.forEach(n=>{
      n.edgeWeights={};
      (n.links||[]).forEach(lid=>{
        const t=nodesRef.current.find(x=>x.id===lid); if(!t) return;
        const shared=(n.tags||[]).filter(tg=>(t.tags||[]).includes(tg)).length;
        const mutual=(t.links||[]).includes(n.id)?1:0;
        n.edgeWeights[lid]=Math.min(5, 1+shared*2+mutual*1.5);
      });
    });

    // Community detection
    const noteNodes=nodesRef.current.filter(n=>n.type==="note");
    noteNodes.forEach(n=>{ n.community=n.id; });
    for(let iter=0;iter<6;iter++){
      for(let i=noteNodes.length-1;i>0;i--){
        const j=Math.floor(Math.random()*(i+1));
        [noteNodes[i],noteNodes[j]]=[noteNodes[j],noteNodes[i]];
      }
      noteNodes.forEach(n=>{
        const nb=[
          ...(n.links||[]).map(id=>nodesRef.current.find(x=>x.id===id)).filter(Boolean),
          ...noteNodes.filter(x=>(x.links||[]).includes(n.id)),
        ];
        if(!nb.length) return;
        const votes={};
        nb.forEach(x=>{ const w=(n.edgeWeights||{})[x.id]||(x.edgeWeights||{})[n.id]||1;
          votes[x.community]=(votes[x.community]||0)+w; });
        const best=Object.entries(votes).sort((a,b)=>b[1]-a[1])[0];
        if(best) n.community=best[0];
      });
    }
    const commIds=[...new Set(noteNodes.map(n=>n.community))];
    noteNodes.forEach(n=>{ n.communityIdx=commIds.indexOf(n.community); });
    const commPal=["#8ac6f2","#9fca56","#e5786d","#d787ff","#eae788",
                   "#cae682","#e99a5a","#92b5dc","#5fd7ff","#87d787"];
    noteNodes.forEach(n=>{ n.communityColor=commPal[n.communityIdx%commPal.length]; });

  },[notes,selectedId,showLocal,orphansOnly,tagColors,filterTag,depthLimit]);

  // ── Resize + initial build ────────────────────────────────────────────────
  useEffect(()=>{
    const cv=cvRef.current; if(!cv) return;
    const dpr=window.devicePixelRatio||1;
    const resize=()=>{
      const p=cv.parentElement;
      const w=p.offsetWidth||p.clientWidth||p.getBoundingClientRect().width;
      const h=p.offsetHeight||p.clientHeight||p.getBoundingClientRect().height;
      if(!w||!h) return;
      // Verwijder flex:1 zodat canvas een vaste grootte heeft
      cv.style.flex="none";
      cv.width=w*dpr; cv.height=h*dpr;
      cv.style.width=w+"px"; cv.style.height=h+"px";
      cv.getContext("2d").scale(dpr,dpr);
      build();
    };
    // requestAnimationFrame garandeert dat de browser layout klaar is
    // Op iOS Safari: gebruik dubbele rAF om zeker te zijn dat layout klaar is
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        fitDoneRef.current = false;
        resize();
        // iOS Safari fallback: als canvas nog geen grootte heeft, probeer opnieuw
        setTimeout(()=>{
          const p=cv.parentElement;
          if(p && (p.offsetWidth||p.clientWidth) > 0) {
            fitDoneRef.current = false;
            resize();
          }
        }, 100);
      });
    });
    let hadSize = false;
    const ro=new ResizeObserver(()=>{
      const p=cv.parentElement;
      const w=p.offsetWidth||p.clientWidth;
      const h=p.offsetHeight||p.clientHeight;
      if(!w||!h) return;
      // Eerste keer dat canvas een geldige grootte heeft: fit triggeren
      if (!hadSize) { hadSize=true; fitDoneRef.current=false; }
      resize();
    }); ro.observe(cv.parentElement);
    return()=>ro.disconnect();
  },[build]);

  useEffect(()=>{ build(); },[notes,build,showLocal,orphansOnly,filterTag,depthLimit]);
  useEffect(()=>{ pathRef.current=pathResult; },[pathResult]);

  // ── Zoek-highlight ────────────────────────────────────────────────────────
  const searchMatch = useMemo(()=>{
    if (!searchQ.trim()) return new Set();
    const q=searchQ.toLowerCase();
    return new Set(nodesRef.current
      .filter(n=>n.title?.toLowerCase().includes(q)||(n.tags||[]).some(t=>t.includes(q)))
      .map(n=>n.id));
  },[searchQ, scale]); // scale als proxy voor nodes-change

  // Navigeer viewport naar gezochte node
  const jumpToSearch = useCallback(()=>{
    if (!searchQ.trim()) return;
    const q=searchQ.toLowerCase();
    const hit=nodesRef.current.find(n=>n.title?.toLowerCase().includes(q));
    if (!hit) return;
    const cv=cvRef.current; if(!cv) return;
    const dpr=window.devicePixelRatio||1;
    const CW=cv.width/dpr, CH=cv.height/dpr;
    const v=viewRef.current;
    viewRef.current={...v, ox:CW/2-hit.x*v.scale, oy:CH/2-hit.y*v.scale};
  },[searchQ]);

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(()=>{
    const cv=cvRef.current; if(!cv) return;
    const ctx=cv.getContext("2d");
    const dpr=window.devicePixelRatio||1;
    const CW=()=>cv.width/dpr, CH=()=>cv.height/dpr;

    const tick=()=>{
      const nodes=nodesRef.current;
      const v=viewRef.current;
      if(!nodes.length){ afRef.current=requestAnimationFrame(tick); return; }

      // Forces in world space
      for(let i=0;i<nodes.length;i++){
        for(let j=i+1;j<nodes.length;j++){
          const dx=nodes[j].x-nodes[i].x, dy=nodes[j].y-nodes[i].y;
          const d=Math.sqrt(dx*dx+dy*dy)||1;
          const f=2000/(d*d);
          nodes[i].vx-=(dx/d)*f; nodes[i].vy-=(dy/d)*f;
          nodes[j].vx+=(dx/d)*f; nodes[j].vy+=(dy/d)*f;
        }
      }
      nodes.forEach(n=>{
        const att=(id,str)=>{
          const t=nodes.find(x=>x.id===id); if(!t) return;
          const dx=t.x-n.x, dy=t.y-n.y, d=Math.sqrt(dx*dx+dy*dy)||1;
          const f=str*d;
          n.vx+=(dx/d)*f; n.vy+=(dy/d)*f;
          t.vx-=(dx/d)*f; t.vy-=(dy/d)*f;
        };
        n.links.forEach(l=>{ const w=(n.edgeWeights||{})[l]||1; att(l,0.015+w*0.006); });
        (n.tagLinks||[]).forEach(l=>att(l,0.015));
        if(n===dragging.current||n.pinned) return;
        // Zwaartekracht naar world-oorsprong (0,0) — sterker voor stabiliteit
        n.vx+=(0-n.x)*0.004; n.vy+=(0-n.y)*0.004;
        n.vx*=0.78; n.vy*=0.78;
        n.x+=n.vx; n.y+=n.vy;
      });

      // Auto-fit zodra simulatie stabiel is
      if (!fitDoneRef.current && nodes.length > 0) {
        const maxV = Math.max(...nodes.map(n => Math.abs(n.vx) + Math.abs(n.vy)));
        if (maxV < 0.8) {
          fitDoneRef.current = true;
          fitToView();
        }
      }

      // Draw
      ctx.clearRect(0,0,CW(),CH());
      ctx.fillStyle=W.bg; ctx.fillRect(0,0,CW(),CH());

      // Grid (world→screen)
      ctx.save();
      ctx.translate(v.ox,v.oy); ctx.scale(v.scale,v.scale);

      ctx.strokeStyle="rgba(255,255,255,0.02)"; ctx.lineWidth=1/v.scale;
      const gridSize=80;
      const x0=Math.floor((-v.ox/v.scale)/gridSize)*gridSize;
      const y0=Math.floor((-v.oy/v.scale)/gridSize)*gridSize;
      for(let x=x0;x<(CW()-v.ox)/v.scale+gridSize;x+=gridSize){
        ctx.beginPath();ctx.moveTo(x,-v.oy/v.scale);ctx.lineTo(x,(CH()-v.oy)/v.scale);ctx.stroke();
      }
      for(let y=y0;y<(CH()-v.oy)/v.scale+gridSize;y+=gridSize){
        ctx.beginPath();ctx.moveTo(-v.ox/v.scale,y);ctx.lineTo((CW()-v.ox)/v.scale,y);ctx.stroke();
      }

      // Semantische edges
      const semEdges=semEdgesRef.current;
      if(semEdges.length){
        semEdges.forEach(({from,to,score})=>{
          const a=nodes.find(n=>n.id===from), b=nodes.find(n=>n.id===to);
          if(!a||!b) return;
          const alpha=(0.15+score*0.5).toFixed(2);
          ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
          ctx.setLineDash([2/v.scale,6/v.scale]);
          ctx.strokeStyle=`rgba(215,135,255,${alpha})`;
          ctx.lineWidth=(0.8+score*1.2)/v.scale;
          ctx.stroke(); ctx.setLineDash([]);
        });
      }

      // Edges
      const activePath=pathRef.current;
      const pathSet=activePath?new Set(activePath):null;
      const isOnPath=(a,b)=>{
        if(!pathSet) return false;
        for(let i=0;i<activePath.length-1;i++){
          if((activePath[i]===a&&activePath[i+1]===b)||(activePath[i]===b&&activePath[i+1]===a)) return true;
        }
        return false;
      };
      nodes.forEach(n=>{
        const drawEdge=(id,col,dashed)=>{
          const t=nodes.find(x=>x.id===id); if(!t) return;
          const sel=n.id===selectedId||t.id===selectedId||
                    n.id===hovering.current?.id||t.id===hovering.current?.id;
          const onPath=isOnPath(n.id,t.id);
          const w=(n.edgeWeights||{})[id]||1;
          ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(t.x,t.y);
          ctx.setLineDash(dashed?[3/v.scale,5/v.scale]:[]);
          if(onPath){
            ctx.strokeStyle="#eae788"; ctx.lineWidth=3/v.scale; ctx.setLineDash([]);
          } else if(sel){
            ctx.strokeStyle=col; ctx.lineWidth=(1.5+w*0.5)/v.scale;
          } else {
            // Duidelijk zichtbare alpha — verhoogd voor beter contrast
            const alpha=w>=4?0.75:w>=3?0.60:0.45;
            const r2=parseInt(col.slice(1,3),16),g2=parseInt(col.slice(3,5),16),b2=parseInt(col.slice(5,7),16);
            ctx.strokeStyle=`rgba(${r2},${g2},${b2},${alpha})`;
            ctx.lineWidth=(0.8+w*0.4)/v.scale;
          }
          ctx.stroke(); ctx.setLineDash([]);
        };
        n.links.forEach(l=>drawEdge(l,W.blue,false));
        (n.tagLinks||[]).forEach(l=>drawEdge(l,n.color||W.comment,true));
      });

      // Nodes
      const searchSet=new Set(
        searchQ.trim()
          ? nodes.filter(n=>n.title?.toLowerCase().includes(searchQ.toLowerCase())||(n.tags||[]).some(t=>t.includes(searchQ.toLowerCase()))).map(n=>n.id)
          : []
      );
      const hasSearch=searchSet.size>0;

      nodes.forEach(n=>{
        const sel=n.id===selectedId;
        const hov=n.id===hovering.current?.id;
        const isTag=n.type==="tag";
        const totalLinks=(n.linkCount||0)+(n.backCount||0)+(n.tagLinks||[]).length;
        const r=isTag?5:Math.max(6,Math.min(18,7+totalLinks*1.5));
        const onPathNode=pathSet?.has(n.id);
        const isSearchHit=searchSet.has(n.id);
        const dimmed=hasSearch&&!isSearchHit&&!sel;

        if(sel){
          ctx.beginPath();ctx.arc(n.x,n.y,r+12,0,Math.PI*2);
          const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,r+12);
          g.addColorStop(0,"rgba(234,231,136,0.3)");g.addColorStop(1,"rgba(234,231,136,0)");
          ctx.fillStyle=g;ctx.fill();
        }
        if(hov&&!sel){
          ctx.beginPath();ctx.arc(n.x,n.y,r+6,0,Math.PI*2);
          ctx.fillStyle="rgba(255,255,255,0.06)";ctx.fill();
        }

        // Kleur
        let color=W.keyword;
        if(isTag) color=n.color||W.comment;
        else if(n.type==="pdf") color=W.orange;
        else if(communityMode&&n.type==="note") color=n.communityColor||W.keyword;
        else if(hubMode&&n.type==="note"){
          const h=n.hubNorm||0;
          const r2=Math.round(h>0.5?(h-0.5)*2*200+55:55);
          const g2=Math.round(h<0.5?h*2*160+40:Math.max(0,(1-h)*2*160));
          const b2=Math.round(h<0.3?(1-h/0.3)*180:0);
          color=`rgb(${r2},${g2},${b2})`;
        } else if(n.tags?.length) color=tagColors[n.tags[0]]||W.keyword;
        if(sel) color=W.yellow;
        if(onPathNode&&!sel) color="#eae788";
        if(n.id===pathFrom&&!sel) color="#9fca56";
        if(n.id===pathTo&&!sel) color="#e5786d";
        if(isSearchHit&&!sel) color="#ffd700";

        ctx.globalAlpha=dimmed?0.18:1;
        ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);
        ctx.fillStyle=color;ctx.fill();
        ctx.strokeStyle=onPathNode?"#eae788":sel?W.cursorBg:hov?"rgba(255,255,255,0.4)":"rgba(140,198,242,0.15)";
        ctx.lineWidth=(onPathNode?2.5:sel?2:hov?1.5:0.8)/v.scale;ctx.stroke();

        // Pin-icoon
        if(n.pinned){
          ctx.fillStyle="rgba(255,255,255,0.7)";
          ctx.font=`${Math.max(8,10/v.scale)}px sans-serif`;
          ctx.textAlign="center";
          ctx.fillText("📌",n.x,n.y-r-2);
        }

        // Label
        ctx.globalAlpha=dimmed?0.18:1;
        const label=(n.title?.length>24?n.title.substring(0,22)+"…":n.title)||"";
        ctx.fillStyle=sel?W.statusFg:hov?W.fg:isSearchHit?"#ffd700":isTag?"#a8d8f0":W.fgDim;
        ctx.font=`${sel||hov||isSearchHit?"bold ":""}${Math.max(9,(isTag?11:12)/Math.sqrt(v.scale))}px 'Courier New'`;
        ctx.textAlign="center";
        ctx.fillText(label,n.x,n.y+r+15/v.scale);
        ctx.globalAlpha=1;

        // Hover tooltip
        if(hov){
          const lines=[];
          if(n.title) lines.push(n.title.substring(0,34));
          if(n.type==="note"){
            lines.push(`← ${n.inDegree||0} in  · → ${n.outDegree||0} out`);
            if(n.tags?.length) lines.push(n.tags.map(t=>"#"+t).join(" ").substring(0,36));
            if(communityMode&&n.communityIdx!==undefined) lines.push(`community ${n.communityIdx+1}`);
            if(n.pinned) lines.push("📌 vastgezet");
          }
          const ttW=Math.min(240,Math.max(...lines.map(l=>l.length))*7+24);
          const ttH=lines.length*16+12;
          const ts=toScreen(n.x,n.y);
          let tx=ts.x-ttW/2, ty=ts.y-r*v.scale-ttH-8;
          // Tooltip in screen space
          ctx.restore(); // tijdelijk buiten world transform
          ctx.fillStyle="rgba(22,22,22,0.94)";
          ctx.beginPath();
          if(ctx.roundRect) ctx.roundRect(tx,ty,ttW,ttH,4); else ctx.rect(tx,ty,ttW,ttH);
          ctx.fill();
          ctx.strokeStyle="rgba(255,255,255,0.1)";ctx.lineWidth=0.5;ctx.stroke();
          lines.forEach((line,i)=>{
            ctx.fillStyle=i===0?W.statusFg:i===1?"#a8d8f0":W.fgDim;
            ctx.font=`${i===0?"bold ":""}11px 'Courier New'`;
            ctx.textAlign="center";
            ctx.fillText(line,tx+ttW/2,ty+14+i*16);
          });
          ctx.save();
          ctx.translate(v.ox,v.oy);ctx.scale(v.scale,v.scale);
        }
      });

      ctx.restore(); // einde world transform

      // ── Minimap ────────────────────────────────────────────────────────
      const mmW=130,mmH=80,mmX=CW()-mmW-10,mmY=CH()-mmH-10;
      ctx.fillStyle="rgba(20,20,20,0.88)";
      ctx.strokeStyle="rgba(255,255,255,0.08)";ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect?ctx.roundRect(mmX,mmY,mmW,mmH,4):ctx.rect(mmX,mmY,mmW,mmH);
      ctx.fill();ctx.stroke();

      if(nodes.length){
        const xs=nodes.map(n=>n.x), ys=nodes.map(n=>n.y);
        const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
        const pw=maxX-minX||1, ph=maxY-minY||1;
        const ms=Math.min((mmW-16)/pw,(mmH-16)/ph);
        const mox=mmX+8+(mmW-16)/2-(minX+maxX)/2*ms;
        const moy=mmY+8+(mmH-16)/2-(minY+maxY)/2*ms;

        // Nodes op minimap
        nodes.forEach(n=>{
          const mx=n.x*ms+mox, my=n.y*ms+moy;
          const mr=n.type==="tag"?1.5:Math.max(1.5,Math.min(4,1.5+(n.hubScore||0)*0.15));
          ctx.beginPath();ctx.arc(mx,my,mr,0,Math.PI*2);
          ctx.fillStyle=n.id===selectedId?W.yellow:n.color||W.keyword;
          ctx.fill();
        });

        // Viewport rechthoek op minimap
        const vx0=(-v.ox/v.scale)*ms+mox;
        const vy0=(-v.oy/v.scale)*ms+moy;
        const vw=CW()/v.scale*ms, vh=CH()/v.scale*ms;
        ctx.strokeStyle="rgba(138,198,242,0.5)";ctx.lineWidth=1;
        ctx.strokeRect(vx0,vy0,vw,vh);
      }

      afRef.current=requestAnimationFrame(tick);
    };
    afRef.current=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(afRef.current);
  },[notes,selectedId,tagColors,hubMode,communityMode,pathFrom,pathTo,searchQ,scale]);

  // ── Node under cursor (world coords) ─────────────────────────────────────
  const nodeAt=(sx,sy)=>{
    const {x,y}=toWorld(sx,sy);
    return nodesRef.current.find(n=>{
      const dx=n.x-x, dy=n.y-y;
      const r=n.type==="tag"?5:Math.max(6,Math.min(18,7+((n.linkCount||0)+(n.backCount||0))*1.5));
      return Math.sqrt(dx*dx+dy*dy)<(r+8)/viewRef.current.scale;
    });
  };

  const allGraphTags=[...new Set(notes.flatMap(n=>n.tags||[]))];

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  const handleWheel=useCallback(e=>{
    e.preventDefault();
    const cv=cvRef.current; if(!cv) return;
    const r=cv.getBoundingClientRect();
    const mx=e.clientX-r.left, my=e.clientY-r.top;
    const v=viewRef.current;
    const factor=e.deltaY<0?1.12:1/1.12;
    const ns=Math.max(0.15,Math.min(4,v.scale*factor));
    viewRef.current={scale:ns, ox:mx-(mx-v.ox)*(ns/v.scale), oy:my-(my-v.oy)*(ns/v.scale)};
    setScale(ns);
  },[]);

  // Attach wheel handler (passive:false nodig voor preventDefault)
  useEffect(()=>{
    const cv=cvRef.current; if(!cv) return;
    cv.addEventListener("wheel",handleWheel,{passive:false});
    return()=>cv.removeEventListener("wheel",handleWheel);
  },[handleWheel]);

  // ── Context menu ──────────────────────────────────────────────────────────
  const handleContextMenu=useCallback(e=>{
    e.preventDefault();
    const r=cvRef.current.getBoundingClientRect();
    const sx=e.clientX-r.left, sy=e.clientY-r.top;
    const n=nodeAt(sx,sy);
    if(n&&n.type==="note") {
      // Node aangeklikt → context menu tonen
      isPanning.current=false;
      setCtxMenu({x:sx,y:sy,node:n});
    } else {
      // Leeg canvas → geen menu (pan werd al afgehandeld in onMouseDown)
      setCtxMenu(null);
    }
  },[nodeAt]);

  return React.createElement("div",{
    style:{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden",position:"relative"},
    onClick:()=>setCtxMenu(null),
  },

    // ── Controls paneel ───────────────────────────────────────────────────
    React.createElement("div",{style:{
      position:"absolute",top:"10px",left:"10px",zIndex:10,
      display:"flex",flexDirection:"column",gap:"6px",
      background:"rgba(28,28,28,0.88)",borderRadius:"8px",
      border:"1px solid rgba(255,255,255,0.08)",
      padding:"10px 12px",backdropFilter:"blur(6px)",
      maxWidth:"270px",
    }},

      // Zoekbalk
      React.createElement("div",{style:{display:"flex",gap:"5px",alignItems:"center"}},
        React.createElement("input",{
          value:searchQ,
          onChange:e=>setSearchQ(e.target.value),
          onKeyDown:e=>{ if(e.key==="Enter") jumpToSearch(); if(e.key==="Escape") setSearchQ(""); },
          placeholder:"Zoek node…",
          style:{flex:1,background:"rgba(0,0,0,0.4)",border:"1px solid rgba(255,255,255,0.12)",
                 borderRadius:"4px",padding:"4px 8px",color:W.fg,fontSize:"12px",outline:"none"}
        }),
        searchQ&&React.createElement("button",{
          onClick:()=>setSearchQ(""),
          style:{background:"none",border:"none",color:W.fgMuted,cursor:"pointer",fontSize:"14px",padding:"0 2px"}
        },"×")
      ),

      // Tag-filter
      React.createElement("div",{style:{fontSize:"9px",color:"rgba(138,198,242,0.5)",
        letterSpacing:"1.5px",marginBottom:"1px"}},"FILTER OP TAG"),
      React.createElement(TagFilterBar,{
        tags:allGraphTags, activeTag:filterTag,
        onChange:t=>{ setFilterTag(t); },
        tagColors, compact:true, maxVisible:6
      }),

      // ── Dieptefilter ─────────────────────────────────────────────────
      React.createElement("div",{style:{marginTop:"4px"}},
        React.createElement("div",{style:{
          display:"flex",alignItems:"center",gap:"8px",
        }},
          React.createElement("span",{style:{fontSize:"9px",color:"rgba(138,198,242,0.5)",
            letterSpacing:"1.5px",flexShrink:0}},"DIEPTE"),
          React.createElement("input",{
            type:"range", min:0, max:5, step:1,
            value:depthLimit,
            onChange:e=>setDepthLimit(Number(e.target.value)),
            style:{flex:1, accentColor:"#8ac6f2", height:"3px"}
          }),
          React.createElement("span",{style:{
            fontSize:"12px", fontWeight:"600",
            color: depthLimit===0 ? W.fgDim : "#8ac6f2",
            minWidth:"28px", textAlign:"right",
          }}, depthLimit===0 ? "∞" : depthLimit),
        ),
        depthLimit > 0 && React.createElement("div",{style:{
          fontSize:"11px", color:W.fgDim, marginTop:"2px", lineHeight:"1.4",
        }},
          selectedId
            ? `Nodes ≤${depthLimit} stap${depthLimit>1?"pen":"je"} van geselecteerde`
            : filterTag
            ? `Nodes ≤${depthLimit} stap${depthLimit>1?"pen":"je"} van #${filterTag}`
            : "Selecteer een node of tag als anker"
        ),
      ),

      React.createElement("div",{style:{height:"1px",background:"rgba(255,255,255,0.06)",margin:"2px 0"}}),

      // Weergave toggles
      React.createElement("div",{style:{fontSize:"11px",fontWeight:"600",
        color:"rgba(138,198,242,0.7)",letterSpacing:"1px",marginBottom:"3px"}},"WEERGAVE"),
      React.createElement("div",{style:{display:"flex",gap:"5px",flexWrap:"wrap"}},
        [{label:"lokaal",     val:showLocal,      set:setShowLocal},
         {label:"orphans",    val:orphansOnly,    set:setOrphansOnly},
         {label:"hubs 🔥",    val:hubMode,        set:setHubMode,        col:"#e5786d"},
         {label:"community",  val:communityMode,  set:setCommunityMode,  col:"#d787ff"},
         {label:"pad 🔍",     val:pathMode,       set:v=>{setPathMode(v);if(!v){setPathFrom(null);setPathTo(null);setPathResult(null);}},col:W.yellow},
         {label:semLoading?"≈ laden…":"≈ sem.",   val:semanticMode, set:v=>setSemanticMode(v), col:"#d787ff"},
        ].map(({label,val,set,col})=>React.createElement("button",{
          key:label,onClick:()=>set(!val),
          style:{background:val?`${col||"#8ac6f2"}22`:"rgba(0,0,0,0.4)",
                 border:`1px solid ${val?(col||"rgba(138,198,242,0.5)"):"rgba(255,255,255,0.1)"}`,
                 color:val?(col||"#a8d8f0"):W.fgMuted,
                 borderRadius:"4px",padding:"3px 9px",fontSize:"13px",cursor:"pointer",fontWeight:val?"600":"400"}
        },label))
      ),

      // Viewport knoppen
      React.createElement("div",{style:{display:"flex",gap:"5px",marginTop:"2px"}},
        React.createElement("button",{
          onClick:fitToView,
          title:"Pas zoom aan zodat alle nodes zichtbaar zijn",
          style:{background:"rgba(138,198,242,0.1)",border:"1px solid rgba(138,198,242,0.25)",
                 color:"#a8d8f0",borderRadius:"4px",padding:"3px 9px",fontSize:"12px",cursor:"pointer",flex:1}
        },"⊞ fit"),
        React.createElement("button",{
          onClick:()=>{ viewRef.current={scale:1,ox:0,oy:0}; setScale(1); },
          title:"Reset zoom naar 1:1",
          style:{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",
                 color:W.fgMuted,borderRadius:"4px",padding:"3px 9px",fontSize:"12px",cursor:"pointer"}
        },"1:1"),
        React.createElement("span",{style:{fontSize:"11px",color:W.fgDim,alignSelf:"center",paddingLeft:"2px"}},
          `${Math.round(viewRef.current.scale*100)}%`)
      ),

      // Cleanup knoppen
      onUpdateNote && React.createElement("div",{style:{marginTop:"4px",display:"flex",flexDirection:"column",gap:"4px"}},
        React.createElement("button",{
          onClick: cleanupBrokenLinks,
          title:"Verwijder [[links]] naar niet-bestaande notities",
          style:{
            background:"rgba(229,120,109,0.08)",
            border:"1px solid rgba(229,120,109,0.2)",
            color: cleanupMsg.startsWith("✓") ? W.comment : "#e5786d",
            borderRadius:"4px", padding:"4px 9px",
            fontSize:"11px", cursor:"pointer", textAlign:"left",
          }
        }, cleanupMsg || "🧹 Gebroken links opruimen"),
        React.createElement("button",{
          onClick: cleanupEmptyNotes,
          title:"Zoek en verwijder lege notities (geen titel, geen inhoud)",
          style:{
            background: emptyMsg.startsWith("⚠") ? "rgba(234,231,136,0.08)" : "rgba(229,120,109,0.08)",
            border:`1px solid ${emptyMsg.startsWith("⚠") ? "rgba(234,231,136,0.3)" : "rgba(229,120,109,0.2)"}`,
            color: emptyMsg.startsWith("✓") ? W.comment : emptyMsg.startsWith("⚠") ? W.yellow : "#e5786d",
            borderRadius:"4px", padding:"4px 9px",
            fontSize:"11px", cursor:"pointer", textAlign:"left",
          }
        }, emptyMsg || "🗑 Lege notities verwijderen"),
        React.createElement("button",{
          onClick: deleteOrphans,
          title:"Verwijder wezen-notities — geen links naar of van andere notities",
          style:{
            background: orphanMsg.startsWith("⚠") ? "rgba(234,231,136,0.08)" : "rgba(229,120,109,0.08)",
            border:`1px solid ${orphanMsg.startsWith("⚠") ? "rgba(234,231,136,0.3)" : "rgba(229,120,109,0.2)"}`,
            color: orphanMsg.startsWith("✓") ? W.comment : orphanMsg.startsWith("⚠") ? W.yellow : "#e5786d",
            borderRadius:"4px", padding:"4px 9px",
            fontSize:"11px", cursor:"pointer", textAlign:"left",
          }
        }, orphanMsg || "🔗 Wezen-notities verwijderen"),
        React.createElement("button",{
          onClick: cleanupCssGarbage,
          title:"Verwijder LLM-CSS-rommel (font-weight:bold;color:#hex) uit alle notities",
          style:{
            background: cssCleanMsg.startsWith("✓") ? "rgba(159,202,86,0.08)" : "rgba(138,198,242,0.08)",
            border:`1px solid ${cssCleanMsg.startsWith("✓") ? "rgba(159,202,86,0.3)" : "rgba(138,198,242,0.2)"}`,
            color: cssCleanMsg.startsWith("✓") ? W.comment : cssCleanMsg.startsWith("⚠") ? W.orange : W.blue,
            borderRadius:"4px", padding:"4px 9px",
            fontSize:"11px", cursor:"pointer", textAlign:"left",
          }
        }, cssCleanMsg || "✨ CSS-rommel opschonen")
      ),

      // Tip
      React.createElement("div",{style:{fontSize:"11px",color:"rgba(255,255,255,0.2)",
        lineHeight:"1.5",marginTop:"2px"}},
        "scroll = zoom · spatie+drag = pan · 2× klik = pin · rechtsklik = menu"
      ),

      // Pad-finder
      pathMode&&React.createElement("div",{style:{marginTop:"6px",borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:"8px"}},
        React.createElement("div",{style:{fontSize:"11px",fontWeight:"600",color:W.yellow,
          letterSpacing:"0.8px",marginBottom:"6px"}},"PAD-FINDER — klik 2 nodes"),
        React.createElement("div",{style:{display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap"}},
          React.createElement("div",{style:{fontSize:"12px",color:"#9fca56",minWidth:"70px"}},
            pathFrom?(nodesRef.current.find(n=>n.id===pathFrom)?.title||pathFrom).substring(0,18)+"…":"▶ van: —"),
          React.createElement("span",{style:{color:W.fgDim}},"→"),
          React.createElement("div",{style:{fontSize:"12px",color:"#e5786d",minWidth:"70px"}},
            pathTo?(nodesRef.current.find(n=>n.id===pathTo)?.title||pathTo).substring(0,18)+"…":"▶ naar: —"),
          pathFrom&&pathTo&&React.createElement("button",{
            onClick:()=>{ const p=bfsPath(pathFrom,pathTo); setPathResult(p||[]); },
            style:{background:"rgba(234,231,136,0.15)",border:"1px solid rgba(234,231,136,0.4)",
                   color:W.yellow,borderRadius:"4px",padding:"2px 8px",fontSize:"12px",cursor:"pointer"}
          },"zoek"),
          (pathFrom||pathTo)&&React.createElement("button",{
            onClick:()=>{setPathFrom(null);setPathTo(null);setPathResult(null);},
            style:{background:"none",border:"none",color:W.fgDim,cursor:"pointer",fontSize:"13px"}
          },"✕")
        ),
        pathResult&&React.createElement("div",{style:{marginTop:"6px",fontSize:"12px"}},
          pathResult.length===0
            ?React.createElement("span",{style:{color:W.orange}},"geen pad gevonden")
            :React.createElement("span",{style:{color:W.yellow}},
              `${pathResult.length-1} stap${pathResult.length>2?"pen":""}: `,
              pathResult.map((id,i)=>{
                const n=nodesRef.current.find(x=>x.id===id);
                return React.createElement("span",{key:id},
                  i>0&&React.createElement("span",{style:{color:W.fgDim}}," → "),
                  React.createElement("span",{onClick:()=>onSelect(id),
                    style:{color:"#eae788",cursor:"pointer",textDecoration:"underline",
                           textDecorationColor:"rgba(234,231,136,0.3)"}},
                    (n?.title||id).substring(0,14))
                );
              })
            )
        )
      ),

      // Hub top-5
      hubMode&&!pathMode&&React.createElement("div",{style:{marginTop:"6px",borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:"8px"}},
        React.createElement("div",{style:{fontSize:"9px",color:"#e5786d",letterSpacing:"1px",marginBottom:"4px"}},"TOP HUBS"),
        [...nodesRef.current].filter(n=>n.type==="note")
          .sort((a,b)=>(b.hubScore||0)-(a.hubScore||0)).slice(0,5)
          .map((n,i)=>React.createElement("div",{key:n.id,onClick:()=>onSelect(n.id),
            style:{fontSize:"12px",cursor:"pointer",padding:"2px 0",
                   overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                   color:i===0?"#e5786d":i===1?"#e99a5a":W.fgMuted}},
            React.createElement("span",{style:{color:"#e5786d",marginRight:"4px"}},"↑"),
            `${n.title||n.id} `,
            React.createElement("span",{style:{fontSize:"11px",color:W.fgDim}},
              `(←${n.inDegree||0} →${n.outDegree||0})`)))
      ),

      // Community legenda
      communityMode&&!pathMode&&React.createElement("div",{style:{marginTop:"6px",borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:"8px"}},
        React.createElement("div",{style:{fontSize:"9px",color:"#d787ff",letterSpacing:"1px",marginBottom:"4px"}},"COMMUNITIES"),
        (()=>{
          const pal=["#8ac6f2","#9fca56","#e5786d","#d787ff","#eae788","#cae682","#e99a5a","#92b5dc","#5fd7ff","#87d787"];
          const byComm={};
          nodesRef.current.filter(n=>n.type==="note"&&n.communityIdx!==undefined)
            .forEach(n=>{ const idx=n.communityIdx;(byComm[idx]=byComm[idx]||[]).push(n); });
          return Object.entries(byComm).sort((a,b)=>b[1].length-a[1].length).slice(0,8)
            .map(([idx,members])=>{
              const col=pal[Number(idx)%pal.length];
              const top=members.sort((a,b)=>(b.hubScore||0)-(a.hubScore||0))[0];
              return React.createElement("div",{key:idx,onClick:()=>top&&onSelect(top.id),
                style:{display:"flex",alignItems:"center",gap:"6px",padding:"2px 0",cursor:"pointer"}},
                React.createElement("span",{style:{width:"9px",height:"9px",borderRadius:"50%",
                  background:col,flexShrink:0,display:"inline-block"}}),
                React.createElement("span",{style:{fontSize:"12px",color:W.fgMuted,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}},
                  top?.title||`cluster ${Number(idx)+1}`),
                React.createElement("span",{style:{fontSize:"11px",color:W.fgDim,flexShrink:0}},members.length)
              );
            });
        })()
      ),

      // Semantisch
      semanticMode&&React.createElement("div",{style:{marginTop:"6px",borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:"8px"}},
        React.createElement("div",{style:{fontSize:"9px",color:"#d787ff",letterSpacing:"1px",marginBottom:"6px"}},"SEMANTISCH VERWANT"),
        semLoading
          ?React.createElement("div",{style:{fontSize:"12px",color:W.fgDim}},"berekenen…")
          :React.createElement(React.Fragment,null,
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}},
              React.createElement("div",{style:{width:"28px",height:"1px",borderTop:"1.5px dashed rgba(215,135,255,0.5)"}}),
              React.createElement("span",{style:{fontSize:"12px",color:W.fgDim}},
                `${semanticEdges.length} mogelijke link${semanticEdges.length!==1?"s":""}`)),
            semanticEdges.slice(0,6).map((e,i)=>{
              const a=nodesRef.current.find(n=>n.id===e.from),b=nodesRef.current.find(n=>n.id===e.to);
              if(!a||!b) return null;
              return React.createElement("div",{key:i,onClick:()=>onSelect(e.from),
                style:{display:"flex",alignItems:"center",gap:"4px",padding:"2px 0",
                       fontSize:"12px",color:W.fgMuted,cursor:"pointer"}},
                React.createElement("span",{style:{color:"#d787ff",flexShrink:0}},
                  `${Math.round(e.score*100)}%`),
                React.createElement("span",{style:{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}},
                  `${(a.title||a.id).substring(0,14)}… ↔ ${(b.title||b.id).substring(0,14)}…`)
              );
            })
          )
      )
    ),

    // ── Canvas ────────────────────────────────────────────────────────────
    React.createElement("canvas",{
      ref:cvRef,
      style:{flex:1,cursor:isPanning.current?"grabbing":"crosshair"},
      onContextMenu:handleContextMenu,
      onMouseDown:e=>{
        const r=cvRef.current.getBoundingClientRect();
        const sx=e.clientX-r.left, sy=e.clientY-r.top;
        if(e.button===1||e.button===2||e.button===0&&e.altKey||e.button===0&&e.shiftKey){
          // Panning: middenknop, rechterknop, alt+klik, of shift+klik
          isPanning.current=true;
          panStart.current={x:sx,y:sy,ox:viewRef.current.ox,oy:viewRef.current.oy};
          e.preventDefault();
          return;
        }
        const n=nodeAt(sx,sy);
        if(n){ dragging.current={...n, _startX:sx, _startY:sy, moved:false}; }
      },
      onMouseMove:e=>{
        const r=cvRef.current.getBoundingClientRect();
        const sx=e.clientX-r.left, sy=e.clientY-r.top;
        if(isPanning.current){
          const ps=panStart.current;
          viewRef.current={...viewRef.current, ox:ps.ox+(sx-ps.x), oy:ps.oy+(sy-ps.y)};
          return;
        }
        const n=nodeAt(sx,sy);
        hovering.current=n||null;
        if(dragging.current){
          const d=Math.hypot(sx-dragging.current._startX,sy-dragging.current._startY);
          if(d>4) dragging.current.moved=true;
          const w=toWorld(sx,sy);
          dragging.current.x=w.x; dragging.current.y=w.y;
          dragging.current.vx=0; dragging.current.vy=0;
          // Sync naar nodesRef
          const real=nodesRef.current.find(x=>x.id===dragging.current.id);
          if(real){ real.x=w.x; real.y=w.y; real.vx=0; real.vy=0; }
        }
      },
      onMouseUp:e=>{
        isPanning.current=false;
        const r=cvRef.current.getBoundingClientRect();
        const sx=e.clientX-r.left, sy=e.clientY-r.top;
        const n=nodeAt(sx,sy);
        if(n&&!dragging.current?.moved&&(n.type==="note"||n.type==="pdf")){
          if(pathMode){
            if(!pathFrom){ setPathFrom(n.id);setPathTo(null);setPathResult(null); }
            else if(!pathTo&&n.id!==pathFrom){
              setPathTo(n.id);
              setTimeout(()=>{ const p=bfsPath(pathFrom,n.id); setPathResult(p||[]); },0);
            } else { setPathFrom(n.id);setPathTo(null);setPathResult(null); }
          } else { onSelect(n.id); }
        }
        dragging.current=null;
      },
      onDoubleClick:e=>{
        const r=cvRef.current.getBoundingClientRect();
        const n=nodeAt(e.clientX-r.left,e.clientY-r.top);
        if(n&&n.type==="note"){
          setPinnedIds(prev=>{
            const next=new Set(prev);
            if(next.has(n.id)) next.delete(n.id); else next.add(n.id);
            const real=nodesRef.current.find(x=>x.id===n.id);
            if(real) real.pinned=!real.pinned;
            return next;
          });
        }
      },
      onMouseLeave:()=>{ hovering.current=null; dragging.current=null; isPanning.current=false; }
    }),

    // ── Context menu ──────────────────────────────────────────────────────
    ctxMenu&&React.createElement("div",{
      style:{position:"absolute",left:ctxMenu.x,top:ctxMenu.y,zIndex:30,
             background:"rgba(22,22,22,0.97)",border:"1px solid rgba(255,255,255,0.12)",
             borderRadius:"6px",boxShadow:"0 8px 32px rgba(0,0,0,0.7)",
             minWidth:"170px",overflow:"hidden"},
      onClick:e=>e.stopPropagation(),
    },
      [
        {label:"📖 Open notitie", action:()=>{ onSelect(ctxMenu.node.id); setCtxMenu(null); }},
        {label:pinnedIds.has(ctxMenu.node.id)?"📌 Losmaak (unpin)":"📌 Vastzetten (pin)",
         action:()=>{
           setPinnedIds(prev=>{
             const next=new Set(prev);
             if(next.has(ctxMenu.node.id)) next.delete(ctxMenu.node.id);
             else next.add(ctxMenu.node.id);
             const real=nodesRef.current.find(x=>x.id===ctxMenu.node.id);
             if(real) real.pinned=!real.pinned;
             return next;
           });
           setCtxMenu(null);
         }},
        {label:"🟢 Stel in als 'van'",
         action:()=>{ setPathMode(true);setPathFrom(ctxMenu.node.id);setPathTo(null);setPathResult(null);setCtxMenu(null); }},
        {label:"🔴 Stel in als 'naar'",
         action:()=>{ setPathMode(true);setPathTo(ctxMenu.node.id);
           if(pathFrom) setTimeout(()=>{ const p=bfsPath(pathFrom,ctxMenu.node.id); setPathResult(p||[]); },0);
           setCtxMenu(null); }},
        {label:"🔍 Zoom naar node",
         action:()=>{
           const n=ctxMenu.node;
           const cv=cvRef.current; if(!cv) return;
           const dpr=window.devicePixelRatio||1;
           const CW=cv.width/dpr, CH=cv.height/dpr;
           viewRef.current={scale:1.5, ox:CW/2-n.x*1.5, oy:CH/2-n.y*1.5};
           setScale(1.5); setCtxMenu(null);
         }},
        {label:"🏷 Filter op tags",
         action:()=>{
           if(ctxMenu.node.tags?.length){ setFilterTag(ctxMenu.node.tags[0]); }
           setCtxMenu(null);
         }, disabled:!(ctxMenu.node.tags?.length)},
      ].map(({label,action,disabled})=>React.createElement("div",{
        key:label,onClick:disabled?undefined:action,
        style:{padding:"9px 14px",fontSize:"13px",cursor:disabled?"default":"pointer",
               color:disabled?W.fgDim:W.fg,borderBottom:"1px solid rgba(255,255,255,0.05)",
               background:"transparent",
               transition:"background 0.1s",
               userSelect:"none"},
        onMouseEnter:e=>{ if(!disabled)e.target.style.background="rgba(255,255,255,0.07)"; },
        onMouseLeave:e=>{ e.target.style.background="transparent"; },
      },label))
    ),

    // ── Legenda onderaan ──────────────────────────────────────────────────
    React.createElement("div",{style:{
      position:"absolute",bottom:"12px",left:"50%",transform:"translateX(-50%)",
      background:"rgba(28,28,28,0.92)",border:`1px solid ${W.splitBg}`,
      borderRadius:"6px",padding:"5px 14px",fontSize:"13px",color:W.fgMuted,
      display:"flex",gap:"12px",backdropFilter:"blur(8px)",
    }},
      React.createElement("span",null,React.createElement("span",{style:{color:W.yellow}},"● "),selectedId?"geselecteerd":""),
      React.createElement("span",null,React.createElement("span",{style:{color:W.keyword}},"● "),"notitie"),
      React.createElement("span",null,React.createElement("span",{style:{color:W.orange}},"● "),"pdf"),
      React.createElement("span",null,React.createElement("span",{style:{color:W.comment}},"● "),"tag"),
      filterTag&&React.createElement("span",{style:{color:"#a8d8f0"}},`filter: #${filterTag}`),
      depthLimit>0&&React.createElement("span",{style:{color:"#8ac6f2"}},`diepte: ≤${depthLimit}`),
      pinnedIds.size>0&&React.createElement("span",null,`📌 ${pinnedIds.size} vastgezet`)
    )
  );
};


// ── Canvas/TextLayer mounters (React wrappers voor imperatieve DOM-elementen) ──
const CanvasMount = ({canvas, width, height}) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && canvas) {
      ref.current.innerHTML = "";
      ref.current.appendChild(canvas);
    }
  }, [canvas]);
  return React.createElement("div", {
    ref, style:{width:width+"px", height:height+"px", display:"block", lineHeight:0}
  });
};

const TextLayerMount = ({textLayer, width, height}) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (ref.current && textLayer) {
      ref.current.innerHTML = "";
      textLayer.style.position        = "absolute";
      textLayer.style.top             = "0";
      textLayer.style.left            = "0";
      textLayer.style.pointerEvents   = "auto";
      // touchAction "none" is nodig op iOS zodat de native tekst-selectie
      // niet onderbroken wordt aan pagina-grenzen. Scroll werkt via de
      // parent scroll-container.
      textLayer.style.touchAction     = "none";
      textLayer.style.userSelect      = "text";
      textLayer.style.webkitUserSelect= "text";
      ref.current.appendChild(textLayer);
    }
  }, [textLayer]);
  return React.createElement("div", {
    ref,
    style:{
      position:"absolute", top:0, left:0,
      width:width+"px", height:height+"px",
      pointerEvents:"auto",
      overflow:"visible",
      touchAction:"none",
      userSelect:"text", WebkitUserSelect:"text",
    }
  });
};

// ── PDF Viewer ─────────────────────────────────────────────────────────────────

// Online modellen gegroepeerd per provider
const ONLINE_MODELS = [
  // ── Anthropic ──────────────────────────────────────────────────────────────
  { id:"claude-opus-4-20250514",      label:"Claude Opus 4",       provider:"anthropic",  group:"Anthropic",  icon:"⚡" },
  { id:"claude-sonnet-4-20250514",    label:"Claude Sonnet 4",     provider:"anthropic",  group:"Anthropic",  icon:"⚡" },
  { id:"claude-haiku-4-5-20251001",   label:"Claude Haiku 4.5",    provider:"anthropic",  group:"Anthropic",  icon:"⚡" },
  // ── Google ─────────────────────────────────────────────────────────────────
  { id:"gemini-2.5-pro",              label:"Gemini 2.5 Pro",      provider:"google",     group:"Google",     icon:"🔷" },
  { id:"gemini-2.0-flash",            label:"Gemini 2.0 Flash",    provider:"google",     group:"Google",     icon:"🔷" },
  // ── OpenAI ─────────────────────────────────────────────────────────────────
  { id:"gpt-4.1",                     label:"GPT-4.1",             provider:"openai",     group:"OpenAI",     icon:"🟢" },
  { id:"gpt-4.1-mini",                label:"GPT-4.1 mini",        provider:"openai",     group:"OpenAI",     icon:"🟢" },
  { id:"o4-mini",                     label:"o4-mini (redeneren)", provider:"openai",     group:"OpenAI",     icon:"🟢" },
  // ── Mistral (direct) ───────────────────────────────────────────────────────
  { id:"mistral-medium-latest",       label:"Mistral Medium 3",    provider:"mistral",    group:"Mistral",    icon:"🌬" },
  { id:"mistral-small-latest",        label:"Mistral Small 3.1",   provider:"mistral",    group:"Mistral",    icon:"🌬" },
  { id:"magistral-medium-latest",     label:"Magistral Medium",    provider:"mistral",    group:"Mistral",    icon:"🌬" },
  // ── Open Source via OpenRouter ─────────────────────────────────────────────
  { id:"moonshotai/kimi-k2.5",        label:"Kimi K2.5",           provider:"openrouter", group:"Open source",icon:"🌙" },
  { id:"moonshotai/kimi-k2",          label:"Kimi K2",             provider:"openrouter", group:"Open source",icon:"🌙" },
  { id:"meta-llama/llama-4-maverick", label:"Llama 4 Maverick",    provider:"openrouter", group:"Open source",icon:"🦙" },
  { id:"meta-llama/llama-4-scout",    label:"Llama 4 Scout",       provider:"openrouter", group:"Open source",icon:"🦙" },
  { id:"google/gemma-3-27b-it",       label:"Gemma 3 27B",         provider:"openrouter", group:"Open source",icon:"💎" },
  { id:"mistralai/mistral-small-3.1", label:"Mistral Small (OR)",  provider:"openrouter", group:"Open source",icon:"🌬" },
  { id:"deepseek/deepseek-r1",        label:"DeepSeek R1",         provider:"openrouter", group:"Open source",icon:"🔍" },
  { id:"qwen/qwen3-30b-a3b",          label:"Qwen3 30B",           provider:"openrouter", group:"Open source",icon:"🐉" },
];

// Provider-kleuren
const PROVIDER_COLOR = {
  anthropic:  "#d787ff",
  google:     "#8ac6f2",
  openai:     "#9fca56",
  openrouter: "#e5786d",
  mistral:    "#eae788",
};

const MODEL_LABEL = (m) => {
  const o = ONLINE_MODELS.find(x => x.id === m);
  if (o) return o.icon + " " + o.label;
  if (!m) return "geen model";
  return "🖥 " + (m.split(":")[0] || m);
};

const MODEL_COLOR = (m) => {
  const o = ONLINE_MODELS.find(x => x.id === m);
  return o ? (PROVIDER_COLOR[o.provider] || "#e3e0d7") : "#9fca56";
};

// ── PDFUploadPanel — clean upload-paneel voor Invoer → PDF tab ───────────────
const PDFUploadPanel = ({ serverPdfs=[], onRefreshPdfs, onOpenPdf, llmModel,
                          allTags=[], notes=[], onAddNote, addJob, updateJob }) => {
  const { useState, useRef, useCallback } = React;
  const [dragOver,   setDragOver]   = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [uploaded,   setUploaded]   = useState([]);   // [{name, isNew}]
  const [error,      setError]      = useState(null);
  const fileRef = useRef(null);

  const doUpload = useCallback(async (files) => {
    const pdfs = [...files].filter(f => f.name.toLowerCase().endsWith(".pdf"));
    if (!pdfs.length) return;
    setUploading(true); setError(null);
    const added = [];
    for (const file of pdfs) {
      try {
        const jid = addJob?.({ id: Math.random().toString(36).slice(2),
          type: "pdf", label: "📄 Uploaden: " + file.name.slice(0,30) + "…" });
        const res = await PDFService.uploadPdf(file);
        const name = res?.name || file.name;
        added.push({ name });
        updateJob?.(jid, { status: "done", result: "Geüpload" });
      } catch(e) {
        setError(e.message);
      }
    }
    await onRefreshPdfs?.();
    setUploaded(prev => [...added, ...prev]);
    setUploading(false);
  }, [onRefreshPdfs, addJob, updateJob]);

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false);
    doUpload(e.dataTransfer.files);
  }, [doUpload]);

  return React.createElement("div", {
    style: { flex: 1, display: "flex", flexDirection: "column",
             overflow: "hidden", minHeight: 0, background: W.bg }
  },
    // Header
    React.createElement("div", {
      style: { background: W.bg2, borderBottom: `1px solid ${W.splitBg}`,
               padding: "10px 16px", flexShrink: 0,
               display: "flex", alignItems: "center", gap: "12px" }
    },
      React.createElement("span", {
        style: { fontSize: "13px", color: W.statusFg, fontWeight: "700",
                 letterSpacing: "1.5px" }
      }, "PDF IMPORTEREN"),
      React.createElement("span", {
        style: { background: W.blue, color: W.bg,
                 borderRadius: "10px", padding: "0 8px", fontSize: "13px" }
      }, serverPdfs.length),
      React.createElement("button", {
        onClick: () => fileRef.current?.click(),
        style: { marginLeft: "auto", background: W.blue, color: W.bg,
                 border: "none", borderRadius: "6px",
                 padding: "6px 14px", fontSize: "13px",
                 cursor: "pointer", fontWeight: "bold" }
      }, uploading ? "⏳ Bezig…" : "+ Kies bestand(en)")
    ),

    // Scroll-gebied
    React.createElement("div", {
      style: { flex: 1, overflowY: "auto", padding: "20px",
               WebkitOverflowScrolling: "touch" }
    },
      // Drop-zone
      React.createElement("div", {
        style: {
          border: `2px dashed ${dragOver ? W.blue : W.splitBg}`,
          borderRadius: "12px",
          background: dragOver ? "rgba(138,198,242,0.06)" : "rgba(255,255,255,0.02)",
          padding: "40px 20px", textAlign: "center",
          cursor: "pointer", marginBottom: "20px",
          transition: "all 0.15s",
        },
        onClick: () => fileRef.current?.click(),
        onDragOver: e => { e.preventDefault(); setDragOver(true); },
        onDragLeave: () => setDragOver(false),
        onDrop,
      },
        React.createElement("div", { style: { fontSize: "40px", marginBottom: "10px" } }, "📄"),
        React.createElement("div", {
          style: { fontSize: "15px", color: W.fg, fontWeight: "500", marginBottom: "6px" }
        }, "Sleep PDF-bestanden hierheen"),
        React.createElement("div", {
          style: { fontSize: "13px", color: W.fgMuted }
        }, "of klik om te bladeren · Meerdere bestanden tegelijk mogelijk"),
        error && React.createElement("div", {
          style: { marginTop: "10px", fontSize: "13px", color: W.orange }
        }, "⚠ " + error)
      ),

      // Recent geüpload
      uploaded.length > 0 && React.createElement("div", null,
        React.createElement("div", {
          style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                   marginBottom: "8px", fontWeight: "600" }
        }, "ZOJUIST GEÜPLOAD"),
        ...uploaded.map((u, i) =>
          React.createElement("div", {
            key: i,
            style: { display: "flex", alignItems: "center", gap: "10px",
                     padding: "8px 12px", borderRadius: "6px",
                     background: "rgba(159,202,86,0.06)",
                     border: `1px solid rgba(159,202,86,0.2)`,
                     marginBottom: "6px" }
          },
            React.createElement("span", { style: { fontSize: "16px" } }, "📄"),
            React.createElement("span", {
              style: { flex: 1, fontSize: "13px", color: W.fg,
                       overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
            }, u.name),
            React.createElement("button", {
              onClick: () => onOpenPdf?.(u.name),
              style: { background: "rgba(138,198,242,0.1)",
                       border: `1px solid rgba(138,198,242,0.3)`,
                       borderRadius: "5px", color: W.blue,
                       padding: "3px 10px", fontSize: "12px", cursor: "pointer" }
            }, "→ Openen")
          )
        )
      ),

      // Vault bibliotheek overzicht
      serverPdfs.length > 0 && React.createElement("div", null,
        React.createElement("div", {
          style: { fontSize: "11px", color: W.fgMuted, letterSpacing: "1px",
                   marginBottom: "8px", fontWeight: "600", marginTop: uploaded.length ? "20px" : "0" }
        }, `IN VAULT (${serverPdfs.length})`),
        ...serverPdfs.map((pdf, i) => {
          const pdfName = typeof pdf === "string" ? pdf : pdf.name;
          const pdfSize = pdf.size ? ` · ${(pdf.size/1024/1024).toFixed(1)} MB` : "";
          return React.createElement("div", {
            key: i,
            style: { display: "flex", alignItems: "center", gap: "10px",
                     padding: "7px 12px", borderRadius: "5px",
                     borderBottom: `1px solid ${W.splitBg}`,
                     cursor: "pointer" },
            onClick: () => onOpenPdf?.(pdfName),
            onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.03)",
            onMouseLeave: e => e.currentTarget.style.background = "transparent",
          },
            React.createElement("span", { style: { fontSize: "14px", flexShrink: 0 } }, "📄"),
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              React.createElement("div", {
                style: { fontSize: "13px", color: W.fg,
                         overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
              }, pdfName),
              pdfSize && React.createElement("div", {
                style: { fontSize: "10px", color: W.fgMuted, marginTop: "1px" }
              }, pdfSize)
            ),
            React.createElement("span", {
              style: { fontSize: "11px", color: W.blue, flexShrink: 0 }
            }, "→ open")
          );
        })
      ),

      serverPdfs.length === 0 && uploaded.length === 0 &&
        React.createElement("div", {
          style: { textAlign: "center", color: W.fgMuted, fontSize: "13px",
                   marginTop: "20px" }
        }, "Nog geen PDFs in de vault.")
    ),

    React.createElement("input", {
      ref: fileRef, type: "file", multiple: true, accept: ".pdf",
      style: { display: "none" },
      onChange: e => { doUpload(e.target.files); e.target.value = ""; }
    })
  );
};

const PDFViewer = ({pdfNotes, setPdfNotes, allTags, serverPdfs, onRefreshPdfs, onAutoSummarize, onDeletePdf, onPasteToNote=null, onAddNote=null, notes=[], isTablet=false}) => {
  const [pdfDoc,     setPdfDoc]     = useState(null);
  const [pdfFile,    setPdfFile]    = useState(null);
  const [pageNum,    setPageNum]    = useState(1);   // huidige zichtbare pagina (voor annotaties)
  const [numPages,   setNumPages]   = useState(0);
  const [scale,      setScale]      = useState(1.4);
  // highlights gespiegeld vanuit AnnotationStore
  const [highlights, setHighlights] = useState(AnnotationStore.getAll());
  const [pendingSel, setPendingSel] = useState(null);
  const [selPos,     setSelPos]     = useState({x:0,y:0});
  const [editingId,  setEditingId]  = useState(null);
  const [isLoading,  setIsLoading]  = useState(false);
  const [pdfjsReady, setPdfjsReady] = useState(false);
  const [activeColor,setActiveColor]= useState(HCOLORS[0]);
  const [filterTag,  setFilterTag]  = useState(null);
  const [quickNote,  setQuickNote]  = useState("");
  const [quickTags,  setQuickTags]  = useState([]);
  const [showLibrary,   setShowLibrary]   = useState(true);
  const [showAnnotPanel,setShowAnnotPanel]= useState(!isTablet);
  const [summarizing,   setSummarizing]   = useState(false);
  const [summarizeErr,  setSummarizeErr]  = useState(null);
  const [renderedPages, setRenderedPages] = useState([]);  // [{num, canvas, textLayer}]

  const canvasRef   = useRef(null);    // enkel canvas (legacy, voor annotatie-hit-test)
  const textLayerRef= useRef(null);
  const wrapRef     = useRef(null);
  const scrollRef   = useRef(null);
  const fileRef     = useRef(null);
  const renderRef   = useRef(null);
  const tlRenderRef = useRef(null);
  const pinchRef    = useRef({active:false, dist0:0, scale0:1.4});
  const pageRefs    = useRef({});      // {pageNum: domNode} voor scroll-to-page
  const renderingRef= useRef(false);
  const libRef      = useRef(null);    // bibliotheek scroll-container

  // iOS Safari fix: stel hoogte expliciet in zodat overflow:auto werkt
  // Werkt voor zowel de PDF scroll-area als de bibliotheek
  const _iosScrollFix = React.useCallback((el) => {
    if (!el) return () => {};
    // Verwijder de _iosScrollFix — we gebruiken het NotePreview patroon:
    // De scroll-container zelf heeft flex:1 + overflow:auto
    // iOS Safari werkt dan correct als de parent overflow:hidden heeft
    return () => {};
  }, []);

  React.useEffect(() => _iosScrollFix(scrollRef.current), [pdfDoc, renderedPages, _iosScrollFix]);
  React.useEffect(() => _iosScrollFix(libRef.current),    [pdfDoc, _iosScrollFix]);
  const isSelectingRef = useRef(false); // true terwijl muisknop ingedrukt is in PDF

  // ── Fix: selectie over pagina-grenzen heen ───────────────────────────────
  // Tijdens een muisknop-drag zetten we userSelect op de hele container zodat
  // de browser de selectie niet reset als de cursor de text-layer van één pagina verlaat.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const onDown = (e) => {
      // Alleen linker muisknop, niet op de popup
      if (e.button !== 0) return;
      if (e.target.closest?.('[data-annot-popup]')) return;
      isSelectingRef.current = true;
      // Zet userSelect op de wrapper zodat selectie door gaat over pagina-grenzen
      if (wrapRef.current) {
        wrapRef.current.style.userSelect = "text";
        wrapRef.current.style.webkitUserSelect = "text";
      }
    };

    const onUp = () => {
      if (!isSelectingRef.current) return;
      isSelectingRef.current = false;
      // Reset na de selectie (tryOpenAnnotPopup leest de selectie al)
      if (wrapRef.current) {
        wrapRef.current.style.userSelect = "";
        wrapRef.current.style.webkitUserSelect = "";
      }
    };

    el.addEventListener("mousedown", onDown);
    document.addEventListener("mouseup", onUp);
    return () => {
      el.removeEventListener("mousedown", onDown);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(()=>{
    // PDF.js en workerSrc worden al ingesteld in index.html
    // Hier alleen wachten tot de library beschikbaar is
    const check = () => {
      if(window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions?.workerSrc){
        setPdfjsReady(true);
      } else if(window.pdfjsLib) {
        // Worker nog niet gezet — stel alsnog in
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        setPdfjsReady(true);
      } else {
        // Library nog niet geladen — laad hem dynamisch
        const s=document.createElement("script");
        s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
        s.onload=()=>{
          window.pdfjsLib.GlobalWorkerOptions.workerSrc=
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
          if(!document.getElementById("pdfjsCss")){
            const l=document.createElement("link");
            l.id="pdfjsCss"; l.rel="stylesheet";
            l.href="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.css";
            document.head.appendChild(l);
          }
          setPdfjsReady(true);
        };
        document.head.appendChild(s);
      }
    };
    // Kleine vertraging zodat index.html scripts zeker klaar zijn
    setTimeout(check, 50);
  },[]);

  // Render alle pagina's in de scroll-container
  const renderAllPages = useCallback(async (doc, sc) => {
    if (!doc || renderingRef.current) return;
    renderingRef.current = true;
    setRenderedPages([]);
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      try {
        const page = await doc.getPage(i);
        const vp   = page.getViewport({scale: sc});
        const canvas = document.createElement("canvas");
        canvas.width  = Math.floor(vp.width);
        canvas.height = Math.floor(vp.height);
        canvas.style.display = "block";
        const ctx = canvas.getContext("2d");
        await page.render({canvasContext: ctx, viewport: vp}).promise;

        // Tekst-laag div
        const tl = document.createElement("div");
        tl.className = "textLayer";
        tl.style.width  = Math.floor(vp.width)  + "px";
        tl.style.height = Math.floor(vp.height) + "px";
        const tc = await page.getTextContent();
        try {
          await window.pdfjsLib.renderTextLayer({
            textContentSource: tc, container: tl, viewport: vp, textDivs: []
          }).promise;
        } catch {}

        pages.push({num: i, canvas, textLayer: tl,
                    width: Math.floor(vp.width), height: Math.floor(vp.height)});
        // Progressief renderen: toon pagina's zodra ze klaar zijn
        setRenderedPages(prev => [...prev, {num:i, canvas, textLayer:tl,
                                             width:Math.floor(vp.width), height:Math.floor(vp.height)}]);
      } catch(e) { console.warn("Pagina "+i+" render fout:", e); }
    }
    renderingRef.current = false;
  }, []);

  useEffect(() => {
    if (pdfDoc) renderAllPages(pdfDoc, scale);
  }, [pdfDoc, scale, renderAllPages]);

  // Scroll naar pagina via knoppen ◀/▶ — alleen als het een GEBRUIKER-actie is
  // (niet elke keer dat pageNum wijzigt via de observer, anders loop)
  const userNavRef = useRef(false);   // true = knop-klik, false = scroll
  const scrollToPage = useCallback((n) => {
    const node = pageRefs.current[n];
    if (!node) return;
    userNavRef.current = true;
    node.scrollIntoView({behavior: "smooth", block: "start"});
    // Reset de vlag zodra de scroll-animatie klaar kan zijn (~700ms)
    setTimeout(() => { userNavRef.current = false; }, 700);
  }, []);

  // Intersection observer: update pageNum ALLEEN bij vrij scrollen (niet bij knop-navigatie)
  useEffect(() => {
    if (!scrollRef.current || renderedPages.length === 0) return;
    const obs = new IntersectionObserver(entries => {
      if (userNavRef.current) return;   // negeer tijdens programmatisch scrollen
      let best = null, bestRatio = 0;
      entries.forEach(e => {
        if (e.intersectionRatio > bestRatio) {
          bestRatio = e.intersectionRatio;
          best = e.target;
        }
      });
      if (best) {
        const n = parseInt(best.dataset.page);
        if (n) setPageNum(n);
      }
    }, {root: scrollRef.current, threshold: [0.1, 0.3, 0.5, 0.7, 0.9]});
    Object.values(pageRefs.current).forEach(el => { if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [renderedPages]);

  const loadPdf=async(arrayBuffer,name)=>{
    setIsLoading(true);
    setRenderedPages([]);          // wis oude pagina's bij nieuw PDF
    renderingRef.current = false;
    pageRefs.current = {};
    try{
      if(!window.pdfjsLib) throw new Error("PDF.js nog niet geladen — herlaad de pagina");
      if(!window.pdfjsLib.GlobalWorkerOptions.workerSrc){
        window.pdfjsLib.GlobalWorkerOptions.workerSrc=
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      }
      const doc=await window.pdfjsLib.getDocument({data:arrayBuffer}).promise;
      setPdfDoc(doc); setNumPages(doc.numPages); setPageNum(1);
      setPdfFile({name});
    }catch(err){
      console.error("loadPdf:",err);
      setSummarizeErr("PDF laden mislukt: "+err.message);
    }
    setIsLoading(false);
  };

  const onFileInput=async(e)=>{
    const file=e.target.files[0]; if(!file||!pdfjsReady) return;
    e.target.value = ""; // reset zodat hetzelfde bestand opnieuw geselecteerd kan worden

    // Duplicate check: kijk of bestandsnaam al in een notitie voorkomt
    const fname = file.name;
    const dupNote = notes.find(n =>
      n.content && (
        n.content.includes(`[[pdf:${fname}]]`) ||
        n.content.includes(`📄 **Bron:** [[pdf:${fname}]]`)
      )
    );
    if (dupNote) {
      const ok = window.confirm(
        `"${fname}" is al eerder geïmporteerd in notitie:\n"${dupNote.title||dupNote.id}"\n\nToch opnieuw uploaden?`
      );
      if (!ok) return;
    }

    let savedName=file.name;
    setSummarizeErr(null);
    try{
      const res=await PDFService.uploadPdf(file);
      if(res?.name) savedName=res.name;
      onRefreshPdfs?.();
    }catch(err){ console.error("upload:",err); }

    // PDF in browser laden (arrayBuffer vóór async samenvatten, anders is file al verbruikt)
    try{
      const ab=await file.arrayBuffer();
      await loadPdf(ab,file.name);
    }catch(err){ console.error("loadPdf:",err); }

    // Samenvatting starten NA het laden — fire and forget met indicator
    if(onAutoSummarize){
      setSummarizing(true);
      try{
        await onAutoSummarize(savedName);
      }catch(err){
        setSummarizeErr(err?.message||"Samenvatten mislukt");
      }finally{
        setSummarizing(false);
      }
    }
  };

  const openFromServer=async(name)=>{
    setShowLibrary(false); setIsLoading(true);
    try{
      const ab=await PDFService.fetchPdfBlob(name);
      await loadPdf(ab,name);
    }catch(err){console.error(err);}
    setIsLoading(false);
  };

  // Bewaar selectie-rects voor visuele highlight overlay
  const pendingRectsRef = useRef([]);
  const pendingPageRef  = useRef(1);  // pagina van de actieve selectie — los van pageNum state
  const [iosAnnotBtn, setIosAnnotBtn] = useState(null);

  // ── tryOpenAnnotPopup ──────────────────────────────────────────────────────
  // Wordt aangeroepen na mouseup (desktop) of via iOS-knop.
  // Leest altijd live state via closure — geen stale refs nodig.
  const tryOpenAnnotPopup = useCallback(() => {
    const sel = window.getSelection();
    const txt = sel?.toString().trim();
    if (!txt || txt.length < 2) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    try {
      const range = sel.getRangeAt(0);
      if (!scrollEl.contains(range.commonAncestorContainer)) return;

      // Zoek omhoog naar een element met data-page
      let node = range.commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentElement; // tekstnode → element
      while (node && node !== scrollEl) {
        if (node.dataset && node.dataset.page) break;
        node = node.parentElement;
      }
      const foundPage = node && node !== scrollEl && node.dataset && node.dataset.page;
      const detectedPage = foundPage ? parseInt(node.dataset.page, 10) : null;

      // Rects relatief aan pagina-wrapper
      const refEl = (foundPage && node) ? node : scrollEl;
      const refRect = refEl.getBoundingClientRect();
      const rects = Array.from(range.getClientRects())
        .map(r => ({ x: r.left - refRect.left, y: r.top - refRect.top, w: r.width, h: r.height }))
        .filter(r => r.w > 1 && r.h > 1);

      pendingRectsRef.current = rects;
      // Sla de pagina op in een ref — NIET via setPageNum, anders scrollt de viewer
      pendingPageRef.current = detectedPage || pageNum;

      // Sla de huidige scroll-positie op zodat we die na de state-update kunnen herstellen
      const scrollEl2 = scrollRef.current;
      const savedTop  = scrollEl2 ? scrollEl2.scrollTop  : 0;
      const savedLeft = scrollEl2 ? scrollEl2.scrollLeft : 0;

      setQuickNote('');
      setQuickTags([]);
      setPendingSel(txt);

      // Herstel scroll-positie na React re-render (rAF = na paint)
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop  = savedTop;
          scrollRef.current.scrollLeft = savedLeft;
        }
      });
    } catch(e) { console.warn('[PDF] tryOpenAnnotPopup:', e); }
  }, []);

  // iOS selectionchange → zweefknop
  useEffect(() => {
    if (navigator.maxTouchPoints < 1) return;
    let t = null;
    const fn = () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const sel = window.getSelection();
        const txt = sel?.toString().trim();
        if (!txt || txt.length < 2) { setIosAnnotBtn(null); return; }
        const scrollEl = scrollRef.current; if (!scrollEl) return;
        try {
          const range = sel.getRangeAt(0);
          if (!scrollEl.contains(range.commonAncestorContainer)) { setIosAnnotBtn(null); return; }
          const r = range.getBoundingClientRect();
          const viewH = window.innerHeight;
          // Plaats de knop ONDER de selectie zodat hij niet overlapt met de iOS copy/paste balk
          const btnY = r.bottom + 12;
          // Als de knop te laag zou komen, toch boven plaatsen (maar dan ver genoeg: +60px)
          const y = btnY + 48 < viewH ? btnY : Math.max(8, r.top - 60);
          const x = Math.max(8, Math.min((r.left+r.right)/2 - 60, window.innerWidth - 128));
          setIosAnnotBtn({ x, y });
        } catch(e) { setIosAnnotBtn(null); }
      }, 400);
    };
    document.addEventListener('selectionchange', fn);
    return () => { document.removeEventListener('selectionchange', fn); clearTimeout(t); };
  }, []);

  // Subscribe op AnnotationStore — blijft in sync met andere tabs
  React.useEffect(() => {
    const unsub = AnnotationStore.subscribe(all => {
      setHighlights([...all]);
      setPdfNotes([...all]);
    });
    return unsub;
  }, []);

  const saveHighlight=async()=>{
    if(!pendingSel)return;
    // Gebruik de pagina van de selectie (ref), niet de huidige scroll-pagina
    const hlPage = pendingPageRef.current;
    console.log("[PDF] saveHighlight: page=",hlPage,"rects=",pendingRectsRef.current.length);
    const pgWrap = pageRefs.current[hlPage];
    const cw = pgWrap ? pgWrap.offsetWidth  : (renderedPages.find(p=>p.num===hlPage)?.width  || 1);
    const ch = pgWrap ? pgWrap.offsetHeight : (renderedPages.find(p=>p.num===hlPage)?.height || 1);
    const rects = pendingRectsRef.current.map(r=>({
      x: r.x/cw, y: r.y/ch, w: r.w/cw, h: r.h/ch,
    })).filter(r => r.w>0 && r.h>0);
    const fname = pdfFile?.name||"PDF";
    const hid = genId();
    const h={id:hid, text:pendingSel, note:quickNote, tags:quickTags,
             page:hlPage, file:fname,
             colorId:activeColor.id, rects,
             created:new Date().toISOString()};
    await AnnotationStore.add(h);
    // Maak ook een Zettelkasten-notitie aan
    if (onAddNote) {
      const stem = fname.replace(/\.pdf$/i,"");
      const lines = [
        `> ${pendingSel}`,
        "",
        ...(quickNote ? [quickNote, ""] : []),
        `---`,
        `📄 **Bron:** [[pdf:${fname}]] · pagina ${hlPage}`,
        `🏷 annotatie-id: ${hid}`,
      ];
      await onAddNote({
        id: genId(),
        title: `📌 ${pendingSel.slice(0,60)}${pendingSel.length>60?"…":""}`,
        content: lines.join("\n"),
        tags: [...new Set(["highlight","pdf",stem,...(quickTags||[])])],
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      });
    }
    const savedTop  = scrollRef.current?.scrollTop  || 0;
    const savedLeft = scrollRef.current?.scrollLeft || 0;

    setPendingSel(null); setQuickNote(""); setQuickTags([]);
    pendingRectsRef.current=[];
    pendingPageRef.current=1;
    window.getSelection()?.removeAllRanges();

    // Herstel scroll-positie na re-render
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop  = savedTop;
        scrollRef.current.scrollLeft = savedLeft;
      }
    });
  };

  const updateHighlight=async(id,patch)=>{
    await AnnotationStore.update(id, patch);
  };

  const removeHighlight=async(id)=>{
    await AnnotationStore.remove(id);
    if(editingId===id)setEditingId(null);
  };

  // Alleen annotaties van de actief geopende PDF tonen
  const fileHl = pdfFile ? highlights.filter(h=>h.file===pdfFile.name) : [];
  const allAnnotTags=[...new Set(fileHl.flatMap(h=>h.tags||[]))];
  const panelHl = (filterTag ? fileHl.filter(h=>(h.tags||[]).includes(filterTag)) : fileHl)
    .sort((a,b)=>a.page-b.page);  // gesorteerd op pagina

  return React.createElement("div",{style:{display:"flex",flex:1,minHeight:0,background:W.bg,overflow:"hidden",position:"relative"}},
    // Main PDF column
    React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0,minHeight:0}},
      // Toolbar
      React.createElement("div",{style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,padding:"5px 10px",display:"flex",alignItems:"center",gap:"8px",fontSize:"14px",flexShrink:0,flexWrap:"wrap"}},
        // Importeer-knop alleen zichtbaar als PDF open is (bibliotheek heeft eigen knop)
        pdfDoc && React.createElement("button",{onClick:()=>fileRef.current.click(),style:{background:W.blue,color:W.bg,border:"none",borderRadius:"4px",padding:"4px 10px",fontSize:"14px",cursor:"pointer",fontWeight:"bold"}},"⬆ Importeer PDF"),
        !pdfDoc && React.createElement("button",{
          onClick:()=>{ setShowLibrary(!showLibrary); },
          style:{background:showLibrary?W.comment:"none",color:showLibrary?W.bg:W.fgMuted,
                 border:`1px solid ${showLibrary?W.comment:W.splitBg}`,
                 borderRadius:"4px",padding:"4px 10px",fontSize:"14px",cursor:"pointer"}
        },`📚 Bibliotheek (${serverPdfs?.length||0})`),
        React.createElement("input",{ref:fileRef,type:"file",accept:".pdf",style:{display:"none"},onChange:onFileInput}),
        !pdfjsReady&&React.createElement("span",{style:{color:W.orange,fontSize:"14px"}},"pdf.js laden…"),
        // AI samenvatten indicator
        summarizing && React.createElement("div",{
          style:{display:"flex",alignItems:"center",gap:"5px",
                 background:"rgba(138,198,242,0.08)",
                 border:"1px solid rgba(138,198,242,0.25)",
                 borderRadius:"10px",padding:"2px 10px",
                 color:"#a8d8f0",fontSize:"14px",
                 animation:"ai-pulse 1.4s ease-in-out infinite"}
        },
          React.createElement("span",{style:{
            display:"inline-block",width:"6px",height:"6px",borderRadius:"50%",
            background:"#a8d8f0",animation:"ai-dot 1.4s ease-in-out infinite"}}),
          "Samenvatten…"
        ),
        // Foutmelding samenvatting
        summarizeErr && React.createElement("span",{
          style:{color:W.orange,fontSize:"14px",cursor:"pointer"},
          title:summarizeErr,
          onClick:()=>setSummarizeErr(null)
        },"⚠ samenvatten mislukt ×"),
        pdfDoc&&React.createElement(React.Fragment,null,
          React.createElement("span",{style:{color:W.fgMuted}},"│"),
          React.createElement("button",{onClick:()=>{ const p=Math.max(1,pageNum-1); setPageNum(p); scrollToPage(p); },style:{background:"none",border:"none",color:W.fg,cursor:"pointer",fontSize:"16px",padding:"0 3px"}},"◀"),
          React.createElement("span",{style:{color:W.statusFg,minWidth:"60px",textAlign:"center"}},pageNum," / ",numPages),
          React.createElement("button",{onClick:()=>{ const p=Math.min(numPages,pageNum+1); setPageNum(p); scrollToPage(p); },style:{background:"none",border:"none",color:W.fg,cursor:"pointer",fontSize:"16px",padding:"0 3px"}},"▶"),
          React.createElement("span",{style:{color:W.fgMuted}},"│"),
          React.createElement("button",{onClick:()=>setScale(s=>Math.max(0.5,+(s-0.2).toFixed(1))),style:{background:"none",border:"none",color:W.fg,cursor:"pointer",padding:"0 4px",fontSize:"16px"}},"−"),
          React.createElement("span",{style:{color:W.fgMuted,minWidth:"40px",textAlign:"center"}},Math.round(scale*100),"%"),
          React.createElement("button",{onClick:()=>setScale(s=>Math.min(3,+(s+0.2).toFixed(1))),style:{background:"none",border:"none",color:W.fg,cursor:"pointer",padding:"0 4px",fontSize:"16px"}},"+"),
          React.createElement("span",{style:{color:W.fgMuted}},"│"),
          ...HCOLORS.map(c=>React.createElement("button",{key:c.id,onClick:()=>setActiveColor(c),title:c.label,style:{width:"18px",height:"18px",borderRadius:"4px",background:c.bg,border:`2px solid ${activeColor.id===c.id?c.border:"transparent"}`,cursor:"pointer",padding:0,boxShadow:activeColor.id===c.id?`0 0 6px ${c.border}`:"none"}})),
          React.createElement("span",{style:{color:W.fgMuted,fontSize:"14px",marginLeft:"4px",maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},pdfFile?.name),
          pdfFile && onAutoSummarize && React.createElement("button",{
            title:"Maak nu een samenvatting van deze PDF",
            disabled:summarizing,
            onClick:async()=>{
              setSummarizeErr(null);
              setSummarizing(true);
              try{ await onAutoSummarize(pdfFile.name); }
              catch(err){ setSummarizeErr(err?.message||"Samenvatten mislukt"); }
              finally{ setSummarizing(false); }
            },
            style:{background:"rgba(138,198,242,0.08)",
                   border:"1px solid rgba(138,198,242,0.25)",
                   color:summarizing?"#666":"#a8d8f0",
                   borderRadius:"4px",padding:"3px 9px",
                   fontSize:"14px",cursor:summarizing?"not-allowed":"pointer",
                   marginLeft:"6px",flexShrink:0,opacity:summarizing?0.5:1}
          }, summarizing ? "⏳…" : "🧠 samenvatten"),
          pdfFile&&React.createElement("button",{
            title:"Verwijder deze PDF + annotaties",
            onClick:async()=>{
              if(!confirm(`Verwijder "${pdfFile.name}" en alle annotaties?`)) return;
              const name=pdfFile.name;
              await PDFService.deletePdf(name);
              setPdfDoc(null); setPdfFile(null);
              onRefreshPdfs?.();
              onDeletePdf?.(name);
            },
            style:{background:"rgba(229,120,109,0.1)",border:"1px solid rgba(229,120,109,0.25)",
                   color:W.orange,borderRadius:"4px",padding:"3px 9px",
                   fontSize:"14px",cursor:"pointer",marginLeft:"6px",flexShrink:0}
          },"🗑 verwijder")
        ),
        React.createElement("div",{style:{flex:1}}),
        pdfDoc&&React.createElement("span",{style:{color:W.comment,fontSize:"14px"}},"① selecteer tekst  ② popup  ③ opslaan")
      ),

      // ── Bibliotheek — volledig scherm als geen PDF open is ─────────────────
      (showLibrary || !pdfDoc) && !pdfDoc && React.createElement("div",{ref:libRef, style:{
        flex:1, overflowY:"auto", background:W.bg,
        display:"flex", flexDirection:"column", minHeight:0, WebkitOverflowScrolling:"touch",}},
        // Header
        React.createElement("div",{style:{
          padding:"20px 24px 12px",
          borderBottom:`1px solid ${W.splitBg}`,
          display:"flex", alignItems:"center", gap:"12px",
        }},
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:"18px",fontWeight:"600",color:W.statusFg}},"📚 PDF-bibliotheek"),
            React.createElement("div",{style:{fontSize:"13px",color:W.fgMuted,marginTop:"2px"}},
              `${serverPdfs?.length||0} document${(serverPdfs?.length||0)!==1?"en":""} opgeslagen in je vault`)
          ),
          React.createElement("div",{style:{flex:1}}),
          React.createElement("button",{
            onClick:()=>fileRef.current.click(),
            style:{background:W.blue,color:W.bg,border:"none",borderRadius:"6px",
                   padding:"8px 18px",fontSize:"14px",cursor:"pointer",fontWeight:"700"}
          },"⬆ Importeer PDF")
        ),

        // Leeg
        (!serverPdfs||serverPdfs.length===0) && React.createElement("div",{style:{
          flex:1, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center",
          gap:"12px", color:W.fgMuted, padding:"40px",
        }},
          React.createElement("div",{style:{fontSize:"56px"}},"📄"),
          React.createElement("div",{style:{fontSize:"15px",color:W.fgDim}},"Nog geen PDF's in je bibliotheek"),
          React.createElement("div",{style:{fontSize:"13px",color:W.fgDim,textAlign:"center",maxWidth:"320px",lineHeight:"1.8"}},"Klik op '⬆ Importeer PDF' om je eerste document toe te voegen. PDF's worden opgeslagen in je vault en kun je annoteren en bevragen."),
          React.createElement("button",{
            onClick:()=>fileRef.current.click(),
            style:{marginTop:"8px",background:"rgba(138,198,242,0.15)",
                   border:`1px solid ${W.blue}`,color:W.blue,
                   borderRadius:"6px",padding:"8px 20px",fontSize:"14px",
                   cursor:"pointer",fontWeight:"600"}
          },"⬆ Importeer eerste PDF")
        ),

        // Grid van PDF-kaarten
        serverPdfs?.length > 0 && React.createElement("div",{style:{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",
          gap:"14px", padding:"20px 24px",
        }},
          ...(serverPdfs||[]).map(p => {
            const annotCount = (AnnotationStore.getAll()||[]).filter(a=>a.file===p.name).length;
            const sizeKb = Math.round((p.size||0)/1024);
            const isOpen = pdfFile?.name === p.name;
            // Zoek samenvatting-notitie
            const stem = p.name.replace(/\.pdf$/i,"");
            return React.createElement("div",{
              key:p.name,
              style:{
                background:W.bg2,
                border:`1px solid ${isOpen?W.blue:W.splitBg}`,
                borderRadius:"8px", overflow:"hidden",
                display:"flex", flexDirection:"column",
                transition:"border-color 0.15s",
                cursor:"pointer",
              },
              onMouseEnter:e=>e.currentTarget.style.borderColor=W.blue,
              onMouseLeave:e=>e.currentTarget.style.borderColor=isOpen?W.blue:W.splitBg,
            },
              // Kaart-preview (kleurvlak met icoon)
              React.createElement("div",{
                onClick:()=>openFromServer(p.name),
                style:{
                  height:"110px", background:"rgba(138,198,242,0.06)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  borderBottom:`1px solid ${W.splitBg}`, position:"relative",
                  flexShrink:0,
                }
              },
                React.createElement("span",{style:{fontSize:"42px",opacity:0.7}},"📄"),
                annotCount > 0 && React.createElement("div",{style:{
                  position:"absolute",top:"8px",right:"8px",
                  background:"rgba(159,202,86,0.2)",
                  border:"1px solid rgba(159,202,86,0.4)",
                  borderRadius:"10px",padding:"1px 8px",
                  fontSize:"11px",color:W.comment,fontWeight:"600",
                }}, `${annotCount} ✏`),
              ),
              // Kaart-inhoud
              React.createElement("div",{style:{padding:"10px 12px",flex:1,display:"flex",flexDirection:"column",gap:"4px"}},
                React.createElement("div",{
                  onClick:()=>openFromServer(p.name),
                  style:{fontSize:"13px",fontWeight:"600",color:W.fg,
                         lineHeight:"1.4",cursor:"pointer",
                         overflow:"hidden",display:"-webkit-box",
                         WebkitLineClamp:2,WebkitBoxOrient:"vertical"}
                }, stem),
                React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,marginTop:"2px"}},
                  sizeKb > 1024
                    ? `${(sizeKb/1024).toFixed(1)} MB`
                    : `${sizeKb} KB`,
                  annotCount > 0 ? ` · ${annotCount} annotatie${annotCount!==1?"s":""}` : ""
                ),
              ),
              // Kaart-footer: knoppen
              React.createElement("div",{style:{
                padding:"7px 10px",
                borderTop:`1px solid ${W.splitBg}`,
                display:"flex", gap:"5px",
              }},
                React.createElement("button",{
                  onClick:()=>openFromServer(p.name),
                  style:{flex:1,background:"rgba(138,198,242,0.1)",
                         border:`1px solid rgba(138,198,242,0.25)`,
                         color:W.blue,borderRadius:"4px",padding:"4px 0",
                         fontSize:"12px",cursor:"pointer",fontWeight:"600"}
                },"📖 Openen"),
                React.createElement("button",{
                  title:"Verwijder PDF + annotaties",
                  onClick:async e=>{
                    e.stopPropagation();
                    if(!confirm(`Verwijder "${p.name}" en alle annotaties?`)) return;
                    await PDFService.deletePdf(p.name);
                    onRefreshPdfs?.();
                    onDeletePdf?.(p.name);
                    if(pdfFile?.name===p.name){ setPdfDoc(null); setPdfFile(null); }
                  },
                  style:{background:"rgba(229,120,109,0.08)",
                         border:"1px solid rgba(229,120,109,0.2)",
                         color:W.orange,borderRadius:"4px",
                         padding:"4px 8px",fontSize:"12px",cursor:"pointer"}
                },"🗑")
              )
            );
          })
        )
      ),

      // ── Scroll area: PDF-viewer (alleen zichtbaar als PDF open is) ──────────
      pdfDoc && React.createElement("div",{style:{
        padding:"4px 12px",background:W.bg2,
        borderBottom:`1px solid ${W.splitBg}`,
        display:"flex",alignItems:"center",gap:"6px",
        fontSize:"13px",flexShrink:0,
      }},
        React.createElement("button",{
          onClick:()=>{ setPdfDoc(null); setPdfFile(null); setShowLibrary(true); },
          style:{background:"none",border:`1px solid ${W.splitBg}`,
                 color:W.fgMuted,borderRadius:"4px",padding:"2px 9px",
                 fontSize:"12px",cursor:"pointer"}
        },"◀ Bibliotheek"),
        React.createElement("span",{style:{color:W.fgMuted}},"│"),
        React.createElement("span",{style:{color:W.fg,maxWidth:"200px",overflow:"hidden",
          textOverflow:"ellipsis",whiteSpace:"nowrap",fontSize:"13px"}},
          pdfFile?.name?.replace(/\.pdf$/i,"")||""),
      ),

      // ── Scroll area: alle pagina's doorlopend ───────────────────────────────
      // Wrapper: flex:1 + position:relative — bewezen iOS Safari patroon (zelfde als NotePreview)
      React.createElement("div",{style:{flex:1, position:"relative", minHeight:0, overflow:"hidden"}},
      React.createElement("div",{
        ref:scrollRef,
        style:{
          position:"absolute", inset:0, overflow:"auto", background:W.lineNrBg,
          WebkitOverflowScrolling:"touch",
          // iOS: touch-action auto zodat scrollen én selectie beide werken
        },
        onMouseUp: e => {
          if (e.target.closest && e.target.closest('[data-annot-popup]')) return;
          setTimeout(() => tryOpenAnnotPopup(), 80);
        },
        onTouchStart:(e)=>{
          if(e.touches.length===2){
            const dx=e.touches[0].clientX-e.touches[1].clientX;
            const dy=e.touches[0].clientY-e.touches[1].clientY;
            pinchRef.current={active:true, dist0:Math.hypot(dx,dy), scale0:scale};
            // Geen preventDefault hier — dat blokkeert iOS single-finger scroll
          }
        },
        onTouchMove:(e)=>{
          if(!pinchRef.current.active||e.touches.length!==2)return;
          e.preventDefault();
          const dx=e.touches[0].clientX-e.touches[1].clientX;
          const dy=e.touches[0].clientY-e.touches[1].clientY;
          const dist=Math.hypot(dx,dy);
          const ratio=dist/pinchRef.current.dist0;
          const newScale=Math.min(4,Math.max(0.5,+(pinchRef.current.scale0*ratio).toFixed(2)));
          setScale(newScale);
        },
        onTouchEnd:()=>{ pinchRef.current.active=false; },
      },
        isLoading&&React.createElement("div",{style:{display:"flex",alignItems:"center",
          justifyContent:"center",height:"200px"}},
          React.createElement("span",{style:{color:W.blue,fontSize:"14px"}},"laden…")
        ),
        !pdfDoc&&!isLoading&&React.createElement("div",{style:{display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",height:"100%",gap:"16px",color:W.fgMuted}},
          React.createElement("div",{style:{fontSize:"56px"}},"📄"),
          React.createElement("div",{style:{fontSize:"14px",color:W.fgDim}},"PDF laden…"),
        ),

        // Alle pagina's als doorlopende kolom
        pdfDoc && React.createElement("div",{
          ref:wrapRef,
          style:{
            display:"flex", flexDirection:"column", alignItems:"center",
            padding:"20px 0 40px", gap:0,
            userSelect:"text", WebkitUserSelect:"text",
          }
        },
          renderedPages.map(pg =>
            React.createElement("div",{
              key:pg.num,
              "data-page":pg.num,
              ref:el=>{ pageRefs.current[pg.num]=el; },
              style:{
                position:"relative", flexShrink:0,
                boxShadow:"0 4px 20px rgba(0,0,0,0.6)",
                marginBottom:"16px",
                userSelect:"text", WebkitUserSelect:"text",
                // touchAction:"pan-y" zodat iOS verticaal scrollen doorgeeft
                // aan de scroll-container, maar pinch-zoom ook werkt
                touchAction:"pan-y",
              }
            },
              // Canvas als img-achtige container
              React.createElement(CanvasMount,{canvas:pg.canvas,width:pg.width,height:pg.height}),
              // Highlight overlay SVG
              React.createElement("svg",{
                style:{position:"absolute",top:0,left:0,pointerEvents:"none",overflow:"visible"},
                width:pg.width, height:pg.height,
              },
                highlights.filter(h=>h.page===pg.num&&h.file===pdfFile?.name&&h.rects?.length)
                  .flatMap((h,hi)=>{
                    const col=HCOLORS.find(c=>c.id===h.colorId)||HCOLORS[0];
                    const isActive=editingId===h.id;
                    return h.rects.map((r,ri)=>React.createElement("rect",{
                      key:`${hi}-${ri}`,
                      x:r.x*pg.width, y:r.y*pg.height,
                      width:r.w*pg.width, height:r.h*pg.height,
                      fill:col.bg, stroke:isActive?col.border:"none",
                      strokeWidth:isActive?1.5:0, rx:2,
                      style:{cursor:"pointer",pointerEvents:"all"},
                      onClick:()=>setEditingId(h.id===editingId?null:h.id),
                      title:h.text.substring(0,60),
                    }));
                  })
              ),
              // Tekst-laag
              React.createElement(TextLayerMount,{textLayer:pg.textLayer,width:pg.width,height:pg.height}),
              // Pagina-nummer badge
              React.createElement("div",{style:{
                position:"absolute",bottom:"6px",right:"8px",
                background:"rgba(0,0,0,0.55)",borderRadius:"10px",
                padding:"2px 8px",fontSize:"12px",color:"rgba(255,255,255,0.5)",
                pointerEvents:"none",userSelect:"none"
              }}, pg.num, " / ", numPages)
            )
          ),
          // Laad-indicator voor nog-te-renderen pagina's
          renderedPages.length < numPages && renderedPages.length > 0 &&
            React.createElement("div",{style:{
              color:W.fgMuted,fontSize:"14px",padding:"16px",
              display:"flex",alignItems:"center",gap:"8px"
            }},
              React.createElement("span",{style:{animation:"ai-pulse 1.4s ease-in-out infinite"}},
                "⏳"),
              `Pagina ${renderedPages.length+1} van ${numPages} laden…`
            )
        ),

        // iOS Annoteren-knop (position:fixed — staat buiten scroll-container)
        iosAnnotBtn&&!pendingSel&&React.createElement("button",{
          onTouchStart:e=>{ e.preventDefault(); tryOpenAnnotPopup(); setIosAnnotBtn(null); },
          onClick:()=>{ tryOpenAnnotPopup(); setIosAnnotBtn(null); },
          style:{
            position:"fixed", left:iosAnnotBtn.x, top:iosAnnotBtn.y,
            zIndex:9998, background:W.blue, color:W.bg,
            border:"none", borderRadius:"20px", padding:"8px 18px",
            fontSize:"14px", fontWeight:"bold", cursor:"pointer",
            boxShadow:"0 3px 16px rgba(0,0,0,0.6)",
            WebkitTapHighlightColor:"transparent",
          }
        },"✏ Annoteren"),
        // Annotatie-popup — fixed onder de menubalk
        pendingSel&&React.createElement("div",{
          "data-annot-popup":"1",
          style:{
            position:"fixed", top:"80px", left:0, right:0,
            background:W.bg3,
            borderBottom:`2px solid ${activeColor.border}`,
            borderLeft:`3px solid ${activeColor.border}`,
            padding:"10px 14px",
            zIndex:9999,
            boxShadow:"0 4px 24px rgba(0,0,0,0.7)",
            display:"flex", flexDirection:"column", gap:"8px",
          },
          onMouseDown:e=>e.stopPropagation(),
          onMouseUp:e=>e.stopPropagation(),
          onTouchStart:e=>e.stopPropagation(),
        },
          // Rij 1: citaat + sluiten
          React.createElement("div",{style:{display:"flex",gap:"10px",alignItems:"flex-start"}},
            React.createElement("div",{style:{
              flex:1, fontSize:"13px", color:W.fgDim,
              padding:"5px 9px", background:activeColor.bg, borderRadius:"4px",
              fontStyle:"italic", lineHeight:"1.5",
              borderLeft:`3px solid ${activeColor.border}`,
              overflow:"hidden", whiteSpace:"nowrap", textOverflow:"ellipsis",
            }},
              '"',pendingSel.substring(0,100),pendingSel.length>100?"…":"",'"'
            ),
            React.createElement("button",{
              onClick:()=>{
                const savedTop = scrollRef.current?.scrollTop||0;
                const savedLeft = scrollRef.current?.scrollLeft||0;
                setPendingSel(null); window.getSelection()?.removeAllRanges();
                requestAnimationFrame(()=>{
                  if(scrollRef.current){ scrollRef.current.scrollTop=savedTop; scrollRef.current.scrollLeft=savedLeft; }
                });
              },
              style:{background:"none",border:"none",color:W.fgMuted,
                     fontSize:"18px",cursor:"pointer",lineHeight:1,flexShrink:0,padding:"2px 4px"}
            },"×")
          ),

          // Rij 2: notitieveld + kleurkiezer naast elkaar
          React.createElement("div",{style:{display:"flex",gap:"8px",alignItems:"flex-start"}},
            React.createElement("textarea",{
              value:quickNote,
              onChange:e=>setQuickNote(e.target.value),
              onKeyDown:e=>{
                if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();saveHighlight();}
                if(e.key==="Escape"){
                  const savedTop = scrollRef.current?.scrollTop||0;
                  const savedLeft = scrollRef.current?.scrollLeft||0;
                  setPendingSel(null); window.getSelection()?.removeAllRanges();
                  requestAnimationFrame(()=>{
                    if(scrollRef.current){ scrollRef.current.scrollTop=savedTop; scrollRef.current.scrollLeft=savedLeft; }
                  });
                }
              },
              placeholder:"Notitie… (Enter=opslaan · Shift+Enter=nieuwe regel · Esc=sluiten)",
              rows:2,
              autoFocus:true,
              style:{flex:1,background:W.bg,border:`1px solid ${W.splitBg}`,
                     borderRadius:"4px",padding:"6px 9px",color:W.fg,
                     fontSize:"13px",outline:"none",resize:"none",
                     boxSizing:"border-box"},
            }),
            // Kleurkiezer verticaal
            React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"4px",flexShrink:0}},
              ...HCOLORS.map(c=>React.createElement("button",{key:c.id,
                onClick:()=>setActiveColor(c),
                title:c.id,
                style:{width:"18px",height:"18px",borderRadius:"3px",background:c.bg,
                       border:`2px solid ${activeColor.id===c.id?c.border:W.splitBg}`,
                       cursor:"pointer",padding:0}}))
            )
          ),

          // Rij 3: tags
          React.createElement("div",{style:{display:"flex",gap:"8px",alignItems:"center"}},
            React.createElement("span",{style:{fontSize:"12px",color:W.fgMuted,flexShrink:0}},"tags:"),
            React.createElement("div",{style:{flex:1}},
              React.createElement(SmartTagEditor,{tags:quickTags,onChange:setQuickTags,allTags:[...allTags,...allAnnotTags]})
            )
          ),

          // Rij 4: knoppen
          React.createElement("div",{style:{display:"flex",gap:"6px",flexWrap:"wrap"}},
            React.createElement("button",{onClick:saveHighlight,
              style:{background:activeColor.border,color:W.bg,border:"none",
                     borderRadius:"4px",padding:"5px 14px",fontSize:"13px",
                     cursor:"pointer",fontWeight:"bold"}},"✓ Opslaan"),
            onPasteToNote&&React.createElement("button",{
              onClick:()=>{
                onPasteToNote({text:pendingSel,source:pdfFile?.name||"PDF",page:pageNum,url:null});
                setPendingSel(null); window.getSelection()?.removeAllRanges();
              },
              style:{background:"rgba(159,202,86,0.15)",color:W.comment,
                     border:"1px solid rgba(159,202,86,0.3)",borderRadius:"4px",
                     padding:"5px 11px",fontSize:"13px",cursor:"pointer"}
            },"📋 → notitie"),
            React.createElement("button",{
              onClick:()=>{setPendingSel(null);window.getSelection()?.removeAllRanges();},
              style:{background:"none",color:W.fgMuted,border:`1px solid ${W.splitBg}`,
                     borderRadius:"4px",padding:"5px 11px",fontSize:"13px",cursor:"pointer"}
            },"Annuleren")
          )
        )
      ))
    ),
    // Annotatiepaneel — knop om te openen (alleen als PDF open is)
    pdfFile && React.createElement("button",{
      onClick:()=>setShowAnnotPanel(p=>!p),
      title: showAnnotPanel ? "Annotaties verbergen" : "Annotaties tonen",
      style:{
        position:"absolute", right:(showAnnotPanel && !isTablet)?286:0, top:"50%",
        transform:"translateY(-50%)",
        background:W.bg2, border:`1px solid ${W.splitBg}`,
        borderRight:showAnnotPanel?"none":"1px solid "+W.splitBg,
        borderRadius:showAnnotPanel?"4px 0 0 4px":"0 4px 4px 0",
        color:W.fgMuted, fontSize:"14px", cursor:"pointer",
        padding:"8px 5px", zIndex:10, lineHeight:1,
        writingMode:"vertical-rl",
      }
    }, showAnnotPanel ? "▶" : "◀ " + (fileHl.length > 0 ? fileHl.length : "")),

    // Annotations panel
    pdfFile && showAnnotPanel&&React.createElement("div",{style:{
      width:"280px",flexShrink:0,background:W.bg2,
      borderLeft:`1px solid ${W.splitBg}`,
      display:"flex",flexDirection:"column",
      // Op mobile/tablet als absolute overlay
      ...(isTablet ? {
        position:"absolute",right:0,top:0,bottom:0,zIndex:20,
        boxShadow:"-4px 0 20px rgba(0,0,0,0.5)"
      } : {}),
    }},
      React.createElement("div",{style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,padding:"6px 10px",display:"flex",alignItems:"center",gap:"6px",flexShrink:0}},
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"1px",flex:1}},
          React.createElement("span",{style:{fontSize:"14px",color:W.statusFg,letterSpacing:"1px"}},"ANNOTATIES"),
          pdfFile&&React.createElement("span",{style:{fontSize:"11px",color:"#c8c0b4",maxWidth:"180px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},pdfFile.name)
        ),
        React.createElement("span",{style:{background:W.blue,color:W.bg,borderRadius:"10px",padding:"0 6px",fontSize:"14px"}},fileHl.length),
        React.createElement("div",{style:{flex:1}}),
        filterTag&&React.createElement("button",{
          onClick:()=>setFilterTag(null),
          style:{background:"rgba(159,202,86,0.16)",color:"#b8e06a",
                 border:"1px solid rgba(159,202,86,0.45)",
                 borderRadius:"5px",fontSize:"12px",fontWeight:"600",
                 padding:"3px 9px",cursor:"pointer",
                 display:"flex",alignItems:"center",gap:"4px"}
        },
          React.createElement("span",{style:{fontSize:"10px",opacity:0.7}},"#"),
          filterTag,
          React.createElement("span",{style:{marginLeft:"3px",fontSize:"13px",opacity:0.7}},"×")
        ),
        React.createElement("button",{onClick:()=>setShowAnnotPanel(false),style:{background:"none",border:"none",color:W.fgMuted,fontSize:"16px",cursor:"pointer",padding:"0 2px",lineHeight:1}}, "×")
      ),
      allAnnotTags.length>0&&React.createElement("div",{style:{padding:"5px 8px",borderBottom:`1px solid ${W.splitBg}`,background:"rgba(0,0,0,0.15)",flexShrink:0}},
        React.createElement(TagFilterBar,{tags:allAnnotTags,activeTag:filterTag,onChange:setFilterTag,compact:true,maxVisible:5})
      ),
      React.createElement("div",{style:{flex:1,overflow:"auto"}},
        panelHl.length===0
          ?React.createElement("div",{style:{padding:"24px 14px",color:W.fgMuted,fontSize:"14px",textAlign:"center",lineHeight:"2"}},
              !pdfFile
              ? React.createElement(React.Fragment,null,
                  React.createElement("div",{style:{fontSize:"28px",marginBottom:"8px"}},"📄"),
                  React.createElement("div",{style:{color:W.fgDim,marginBottom:"4px"}},"Geen PDF geopend"),
                  React.createElement("div",{style:{fontSize:"14px",color:W.splitBg,lineHeight:"1.7"}},
                    "Open een PDF via de toolbar.","\n","Annotaties worden hier getoond.")
                )
              : filterTag
                ? `Geen annotaties met #${filterTag}`
                : React.createElement(React.Fragment,null,
                    React.createElement("div",{style:{fontSize:"20px",marginBottom:"8px"}},"✏"),
                    React.createElement("div",{style:{color:W.fgDim}},"Nog geen annotaties"),
                    React.createElement("div",{style:{fontSize:"14px",color:W.splitBg,lineHeight:"1.7",marginTop:"4px"}},
                      "Selecteer tekst in de PDF","\n","om een annotatie te maken.")
                  ))
          :panelHl.map(h=>{
            const col=HCOLORS.find(c=>c.id===h.colorId)||HCOLORS[0];
            const isEditing=editingId===h.id;
            return React.createElement("div",{key:h.id,style:{borderBottom:`1px solid ${W.splitBg}`,borderLeft:`3px solid ${col.border}`,background:isEditing?"rgba(255,255,255,0.025)":"transparent"}},
              React.createElement("div",{style:{padding:"8px 10px",cursor:"pointer"},onClick:()=>setEditingId(isEditing?null:h.id)},
                React.createElement("div",{style:{fontSize:"14px",color:W.string,fontStyle:"italic",lineHeight:"1.5",marginBottom:"3px"}},'"',h.text.substring(0,70),h.text.length>70?"…":"",'"'),
                h.note&&!isEditing&&React.createElement("div",{style:{fontSize:"14px",color:W.fg,lineHeight:"1.4",marginBottom:"4px"}},h.note.substring(0,60),h.note.length>60?"…":""),
                React.createElement("div",{style:{display:"flex",gap:"3px",flexWrap:"wrap",alignItems:"center"}},
                  ...(h.tags||[]).map(t=>React.createElement(TagPill,{key:t,tag:t,small:true})),
                  React.createElement("span",{style:{fontSize:"9px",color:W.fgMuted,marginLeft:"auto"}},"p.",h.page),
                  React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted}},isEditing?"▲":"▼")
                )
              ),
              isEditing&&React.createElement("div",{style:{padding:"0 10px 12px",borderTop:`1px solid ${W.splitBg}`}},
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,margin:"8px 0 4px",letterSpacing:"1px"}},"NOTITIE"),
                React.createElement("textarea",{value:h.note||"",onChange:e=>updateHighlight(h.id,{note:e.target.value}),rows:3,style:{width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"4px",padding:"6px 8px",color:W.fg,fontSize:"14px",outline:"none",resize:"vertical"},placeholder:"Notitie toevoegen…"}),
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,margin:"8px 0 4px",letterSpacing:"1px"}},"TAGS"),
                React.createElement(SmartTagEditor,{tags:h.tags||[],onChange:tags=>updateHighlight(h.id,{tags}),allTags:[...allTags,...allAnnotTags]}),
                React.createElement("div",{style:{display:"flex",gap:"5px",margin:"8px 0"}},...HCOLORS.map(c=>React.createElement("button",{key:c.id,onClick:()=>updateHighlight(h.id,{colorId:c.id}),style:{width:"18px",height:"18px",borderRadius:"3px",background:c.bg,border:`2px solid ${h.colorId===c.id?c.border:W.splitBg}`,cursor:"pointer",padding:0}}))),
                React.createElement("div",{style:{display:"flex",gap:"6px"}},
                  React.createElement("button",{onClick:()=>setEditingId(null),style:{background:W.comment,color:W.bg,border:"none",borderRadius:"3px",padding:"3px 10px",fontSize:"14px",cursor:"pointer",fontWeight:"bold"}},"✓ klaar"),
                  React.createElement("button",{onClick:()=>removeHighlight(h.id),style:{background:"none",color:W.orange,border:`1px solid rgba(229,120,109,0.3)`,borderRadius:"3px",padding:"3px 8px",fontSize:"14px",cursor:"pointer"}},":del")
                )
              )
            );
          })
      )
    )
  );
};


// ── Vault Settings Panel ───────────────────────────────────────────────────────
const VaultSettings = ({vaultPath, onChangeVault, onClose}) => {
  const { useState, useEffect } = React;
  const [tab,      setTab]     = useState("vault");   // "vault" | "keys" | "pdf"
  const [newPath,  setNewPath] = useState(vaultPath);
  const [msg,      setMsg]     = useState("");

  // API-sleutels state
  const [keys, setKeys] = useState({ anthropic:"", openai:"", google:"", openrouter:"", mistral:"" });
  const [keyStatus, setKeyStatus] = useState({});
  const [keysMsg, setKeysMsg] = useState("");
  const [showKey, setShowKey] = useState({});
  const [expandedProvider, setExpandedProvider] = useState(null);

  // PDF personal use state
  const [personalUse,      setPersonalUse]      = useState(false);
  const [personalEmail,    setPersonalEmail]    = useState("");
  const [pdfMsg,           setPdfMsg]           = useState("");

  // Laad huidige instellingen bij openen
  useEffect(() => {
    fetch("/api/api-keys").then(r=>r.json()).then(d => setKeyStatus(d)).catch(()=>{});
    fetch("/api/config").then(r=>r.json()).then(d => {
      const cfg = d.config || {};
      setPersonalUse(!!cfg.pdf_personal_use);
      setPersonalEmail(cfg.pdf_personal_email || "");
    }).catch(()=>{});
  }, []);

  const savePdfSettings = async () => {
    try {
      await api.post("/config", {
        pdf_personal_use:   personalUse,
        pdf_personal_email: personalEmail.trim(),
      });
      setPdfMsg("✓ Opgeslagen");
      setTimeout(() => setPdfMsg(""), 3000);
    } catch(e) { setPdfMsg("✗ " + e.message); }
  };

  const applyVault = async () => {
    if (!newPath.trim()) return;
    try {
      const r = await api.post("/vault", {path: newPath.trim()});
      setMsg("✓ Vault gewijzigd naar: " + r.vault_path + " — herlaad de pagina");
      onChangeVault(r.vault_path);
    } catch(e) { setMsg("✗ Fout: " + e.message); }
  };

  const saveKey = async (providerId) => {
    const val = keys[providerId];
    if (!val.trim()) return;
    try {
      const res = await api.post("/api-keys", { [providerId]: val });
      if (res?.ok === false) throw new Error(res.error || "Opslaan mislukt");
      // Herlaad status
      const status = await fetch("/api/api-keys").then(r=>r.json()).catch(()=>({}));
      setKeyStatus(status);
      setKeys(prev => ({...prev, [providerId]: ""}));
      setExpandedProvider(null);
      setKeysMsg("✓ Sleutel opgeslagen");
      setTimeout(()=>setKeysMsg(""), 3000);
    } catch(e) { setKeysMsg("✗ Fout: "+e.message); }
  };

  const inputStyle = {
    flex:1, background:W.bg, border:`1px solid ${W.splitBg}`,
    borderRadius:"4px", padding:"7px 10px", color:W.fg,
    fontSize:"13px", outline:"none", fontFamily:"'Hack','Courier New',monospace",
  };

  const providers = [
    {
      id:"anthropic", label:"Anthropic (Claude)",
      placeholder:"sk-ant-api03-…",
      hint: React.createElement("span",null,
        "Maak een sleutel aan op ",
        React.createElement("a",{href:"https://console.anthropic.com/settings/keys",
          target:"_blank",style:{color:W.blue,textDecoration:"none"}},"console.anthropic.com"),
        " → Settings → API keys → Create Key"
      ),
      color: W.purple,
    },
    {
      id:"openai", label:"OpenAI (GPT-4o)",
      placeholder:"sk-…",
      hint: React.createElement("span",null,
        "Maak een sleutel aan op ",
        React.createElement("a",{href:"https://platform.openai.com/api-keys",
          target:"_blank",style:{color:W.blue,textDecoration:"none"}},"platform.openai.com"),
        " → API keys → Create new secret key"
      ),
      color: W.green,
    },
    {
      id:"google", label:"Google (Gemini)",
      placeholder:"AIza…",
      hint: React.createElement("span",null,
        "Maak een sleutel aan op ",
        React.createElement("a",{href:"https://aistudio.google.com/app/apikey",
          target:"_blank",style:{color:W.blue,textDecoration:"none"}},"aistudio.google.com"),
        " → Get API key"
      ),
      color: W.blue,
    },
    {
      id:"openrouter", label:"OpenRouter",
      placeholder:"sk-or-v1-…",
      hint: React.createElement("span",null,
        "Gratis sleutel op ",
        React.createElement("a",{href:"https://openrouter.ai/keys",
          target:"_blank",style:{color:W.blue,textDecoration:"none"}},"openrouter.ai"),
        " → Keys → Create key (geeft toegang tot 100+ modellen)"
      ),
      color: W.orange,
    },
    {
      id:"mistral", label:"Mistral AI",
      placeholder:"…",
      hint: React.createElement("span",null,
        "Sleutel aanmaken op ",
        React.createElement("a",{href:"https://console.mistral.ai/api-keys",
          target:"_blank",style:{color:W.blue,textDecoration:"none"}},"console.mistral.ai"),
        " → API Keys → Create new key"
      ),
      color: W.yellow,
    },
  ];

  return React.createElement("div",{
    style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",
           alignItems:"center",justifyContent:"center",zIndex:1000},
    onClick:e=>{if(e.target===e.currentTarget)onClose();}
  },
    React.createElement("div",{style:{
      background:W.bg2, border:`1px solid ${W.splitBg}`, borderRadius:"8px",
      width:"540px", maxHeight:"88vh", overflow:"hidden", display:"flex", flexDirection:"column",
      boxShadow:"0 16px 64px rgba(0,0,0,0.8)"
    }},
      // ── Header ────────────────────────────────────────────────────────────
      React.createElement("div",{style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,
        padding:"10px 16px",display:"flex",alignItems:"center",flexShrink:0}},
        React.createElement("span",{style:{color:W.statusFg,fontSize:"14px",
          letterSpacing:"1.5px",fontWeight:"bold"}},":INSTELLINGEN"),
        React.createElement("div",{style:{flex:1}}),
        React.createElement("button",{onClick:onClose,style:{background:"none",border:"none",
          color:W.fgMuted,fontSize:"18px",cursor:"pointer",lineHeight:1}},"×")
      ),

      // ── Tabs ──────────────────────────────────────────────────────────────
      React.createElement("div",{style:{display:"flex",borderBottom:`1px solid ${W.splitBg}`,
        flexShrink:0,background:W.bg}},
        [
          {id:"vault", icon:"📁", label:"Vault"},
          {id:"keys",  icon:"🔑", label:"API-sleutels"},
          {id:"pdf",   icon:"📄", label:"PDF"},
        ].map(t => React.createElement("button",{
          key:t.id, onClick:()=>{ setTab(t.id); setMsg(""); setKeysMsg(""); },
          style:{
            background: tab===t.id ? W.bg2 : "transparent",
            border:"none", borderBottom: tab===t.id ? `2px solid ${W.blue}` : "2px solid transparent",
            color: tab===t.id ? W.fg : W.fgMuted,
            padding:"9px 20px", fontSize:"13px", cursor:"pointer",
            display:"flex", alignItems:"center", gap:"6px", fontWeight: tab===t.id ? "600" : "400",
          }
        }, t.icon+" "+t.label))
      ),

      // ── Tab inhoud ────────────────────────────────────────────────────────
      React.createElement("div",{style:{overflowY:"auto",flex:1,padding:"20px"}},

        // ── VAULT TAB ───────────────────────────────────────────────────────
        tab==="vault" && React.createElement(React.Fragment,null,
          React.createElement("div",{style:{fontSize:"11px",color:W.comment,
            letterSpacing:"1.5px",marginBottom:"8px",fontWeight:"600"}},"📁 VAULT MAP"),
          React.createElement("div",{style:{fontSize:"13px",color:W.fgDim,lineHeight:"1.7",marginBottom:"12px"}},
            "De vault bevat alle notities, PDF bestanden en annotaties. Verander het pad om een andere vault te gebruiken."
          ),
          React.createElement("div",{style:{background:"rgba(0,0,0,0.25)",borderRadius:"4px",
            padding:"10px 12px",marginBottom:"14px",fontSize:"13px"}},
            React.createElement("div",{style:{color:W.fgMuted,marginBottom:"4px"}},"Huidige vault:"),
            React.createElement("div",{style:{color:W.yellow,wordBreak:"break-all",
              fontFamily:"'Hack','Courier New',monospace"}},vaultPath),
            React.createElement("div",{style:{color:W.fgMuted,fontSize:"12px",marginTop:"8px",marginBottom:"2px"}},"Structuur:"),
            React.createElement("div",{style:{color:W.fgDim,fontSize:"12px",lineHeight:"1.8",
              fontFamily:"'Hack','Courier New',monospace"}},
              vaultPath+"/notes/\n"+vaultPath+"/pdfs/\n"+
              vaultPath+"/annotations/\n"+vaultPath+"/config.json")
          ),
          React.createElement("div",{style:{fontSize:"11px",color:W.comment,
            letterSpacing:"1.5px",marginBottom:"8px",fontWeight:"600"}},"📂 NIEUW PAD"),
          React.createElement("div",{style:{display:"flex",gap:"8px",marginBottom:"10px"}},
            React.createElement("input",{
              value:newPath, onChange:e=>setNewPath(e.target.value),
              onKeyDown:e=>e.key==="Enter"&&applyVault(),
              placeholder:"/pad/naar/vault of ~/Zettelkasten",
              style:{...inputStyle,fontFamily:"'Hack','Courier New',monospace"},
            }),
            React.createElement("button",{onClick:applyVault,style:{
              background:W.blue,color:W.bg,border:"none",borderRadius:"4px",
              padding:"7px 16px",fontSize:"13px",cursor:"pointer",fontWeight:"bold",flexShrink:0
            }},"Toepassen")
          ),
          msg && React.createElement("div",{style:{
            fontSize:"13px",padding:"6px 10px",borderRadius:"3px",marginBottom:"10px",
            background:msg.startsWith("✓")?"rgba(159,202,86,0.1)":"rgba(229,120,109,0.1)",
            color:msg.startsWith("✓")?W.comment:W.orange
          }},msg),
          React.createElement("div",{style:{fontSize:"12px",color:W.fgMuted,lineHeight:"1.8",
            background:"rgba(0,0,0,0.15)",borderRadius:"4px",padding:"8px 12px"}},
            "💡 Of start de server met een ander pad:",React.createElement("br"),
            React.createElement("code",{style:{color:W.string,fontSize:"12px"}},
              "python3 server.py --vault /pad/naar/vault")
          )
        ),

        // ── API-SLEUTELS TAB ────────────────────────────────────────────────
        tab==="keys" && React.createElement(React.Fragment,null,
          React.createElement("div",{style:{fontSize:"13px",color:W.fgDim,lineHeight:"1.7",marginBottom:"16px"}},
            "Vul hieronder je API-sleutels in voor online AI-modellen. Sleutels worden opgeslagen in ",
            React.createElement("code",{style:{color:W.string,fontSize:"12px"}},"config.json"),
            " in je vault — alleen leesbaar op jouw machine."
          ),

          providers.map(p => {
            const status   = keyStatus[p.id] || {};
            const hasKey   = status.set;
            const preview  = status.preview || "";
            const isOpen   = expandedProvider === p.id;
            const keyVal   = keys[p.id];

            return React.createElement("div",{key:p.id,style:{
              marginBottom:"8px",
              border:`1px solid ${isOpen ? p.color+"55" : W.splitBg}`,
              borderRadius:"7px", overflow:"hidden",
              transition:"border-color 0.15s",
            }},
              // ── Header (altijd zichtbaar, klikbaar) ─────────────────────────
              React.createElement("div",{
                onClick:()=>setExpandedProvider(isOpen ? null : p.id),
                style:{
                  display:"flex", alignItems:"center", gap:"10px",
                  padding:"10px 14px", cursor:"pointer",
                  background: isOpen ? `${p.color}0d` : "transparent",
                  userSelect:"none",
                }
              },
                // Status-dot
                React.createElement("div",{style:{
                  width:"8px",height:"8px",borderRadius:"50%",flexShrink:0,
                  background: hasKey ? "#9fca56" : "rgba(255,255,255,0.15)",
                  boxShadow: hasKey ? "0 0 6px rgba(159,202,86,0.5)" : undefined,
                }}),
                // Label
                React.createElement("span",{style:{
                  fontSize:"13px",fontWeight:"600",color:p.color,flex:1
                }}, p.label),
                // Badge
                hasKey
                  ? React.createElement("span",{style:{
                      fontSize:"11px",color:W.comment,
                      background:"rgba(159,202,86,0.12)",
                      borderRadius:"8px",padding:"1px 8px",
                      border:"1px solid rgba(159,202,86,0.3)",flexShrink:0
                    }}, "✓ ingesteld")
                  : React.createElement("span",{style:{
                      fontSize:"11px",color:W.fgDim,
                      background:"rgba(255,255,255,0.04)",
                      borderRadius:"8px",padding:"1px 8px",
                      border:`1px solid ${W.splitBg}`,flexShrink:0
                    }}, "niet ingesteld"),
                // Chevron
                React.createElement("span",{style:{
                  fontSize:"10px",color:W.fgMuted,
                  transform:isOpen?"rotate(180deg)":"rotate(0deg)",
                  transition:"transform 0.15s",
                }}, "▼")
              ),

              // ── Body (alleen als open) ──────────────────────────────────────
              isOpen && React.createElement("div",{style:{
                padding:"0 14px 14px",
                borderTop:`1px solid ${W.splitBg}`,
              }},
                // Huidig preview
                hasKey && preview && React.createElement("div",{style:{
                  fontSize:"12px",color:W.fgMuted,
                  fontFamily:"'Hack','Courier New',monospace",
                  padding:"8px 0 6px",
                }}, "Huidig: "+preview),

                // Invoerveld
                React.createElement("div",{style:{display:"flex",gap:"6px",marginTop:"10px"}},
                  React.createElement("input",{
                    type: showKey[p.id] ? "text" : "password",
                    value: keyVal,
                    onChange: e=>setKeys(prev=>({...prev,[p.id]:e.target.value})),
                    onKeyDown: e=>{ if(e.key==="Enter"&&keyVal.trim()) saveKey(p.id); },
                    placeholder: hasKey ? "Nieuwe sleutel…" : p.placeholder,
                    autoFocus:true,
                    style:{...inputStyle},
                    autoComplete:"off", spellCheck:false,
                  }),
                  React.createElement("button",{
                    onClick:()=>setShowKey(prev=>({...prev,[p.id]:!prev[p.id]})),
                    title: showKey[p.id]?"Verbergen":"Tonen",
                    style:{background:"rgba(255,255,255,0.04)",border:`1px solid ${W.splitBg}`,
                           borderRadius:"4px",padding:"0 10px",color:W.fgMuted,
                           cursor:"pointer",fontSize:"13px",flexShrink:0}
                  }, showKey[p.id]?"🙈":"👁")
                ),

                // Hint
                React.createElement("div",{style:{
                  fontSize:"12px",color:W.fgDim,marginTop:"6px",lineHeight:"1.6"
                }}, p.hint),

                // Knoppen
                React.createElement("div",{style:{
                  display:"flex",gap:"8px",marginTop:"10px",alignItems:"center"
                }},
                  React.createElement("button",{
                    onClick:()=>saveKey(p.id),
                    disabled:!keyVal.trim(),
                    style:{
                      background: keyVal.trim() ? W.blue : "rgba(255,255,255,0.06)",
                      color: keyVal.trim() ? W.bg : W.fgMuted,
                      border:"none",borderRadius:"5px",
                      padding:"6px 16px",fontSize:"13px",
                      cursor:keyVal.trim()?"pointer":"default",fontWeight:"bold",
                    }
                  },"💾 Opslaan"),
                  hasKey && React.createElement("button",{
                    onClick:async()=>{
                      await api.post("/api-keys",{[p.id]:""});
                      fetch("/api/api-keys").then(r=>r.json()).then(d=>setKeyStatus(d));
                      setExpandedProvider(null);
                      setKeysMsg("✓ Sleutel gewist");
                      setTimeout(()=>setKeysMsg(""),3000);
                    },
                    style:{background:"rgba(229,120,109,0.08)",
                           border:"1px solid rgba(229,120,109,0.25)",
                           color:W.orange,borderRadius:"5px",
                           padding:"6px 12px",fontSize:"13px",cursor:"pointer"}
                  },"✕ Wis sleutel"),
                  React.createElement("button",{
                    onClick:()=>setExpandedProvider(null),
                    style:{background:"none",border:`1px solid ${W.splitBg}`,
                           color:W.fgMuted,borderRadius:"5px",
                           padding:"6px 10px",fontSize:"13px",cursor:"pointer"}
                  },"Annuleren")
                )
              )
            );
          }),

          // Status-bericht
          keysMsg && React.createElement("div",{style:{
            marginTop:"8px",fontSize:"13px",
            color:keysMsg.startsWith("✓")?W.comment:W.orange
          }},keysMsg),

          // Beveiligingsnoot
          React.createElement("div",{style:{
            marginTop:"16px",fontSize:"12px",color:W.fgMuted,lineHeight:"1.8",
            background:"rgba(0,0,0,0.15)",borderRadius:"4px",padding:"8px 12px"
          }},
            "🔒 Sleutels worden opgeslagen in ",
            React.createElement("code",{style:{color:W.string,fontSize:"11px"}},
              "config.json"),
            " — nooit gedeeld buiten je machine. Je kunt ze ook instellen als omgevingsvariabele:",
            React.createElement("br"),
            React.createElement("code",{style:{color:W.string,fontSize:"11px"}},
              "export ANTHROPIC_API_KEY=sk-ant-…")
          )
        ),

        // ── PDF TAB ─────────────────────────────────────────────────────────
        tab==="pdf" && React.createElement(React.Fragment, null,

          // Personal use sectie
          React.createElement("div",{style:{
            background:"rgba(138,198,242,0.05)",
            border:`1px solid rgba(138,198,242,0.2)`,
            borderRadius:"7px", padding:"16px 18px", marginBottom:"20px",
          }},
            React.createElement("div",{style:{
              fontSize:"11px",color:W.blue,letterSpacing:"1.5px",
              fontWeight:"600",marginBottom:"10px"
            }}, "📄 PERSOONLIJK GEBRUIK"),
            React.createElement("div",{style:{
              fontSize:"13px",color:W.fgMuted,lineHeight:"1.8",marginBottom:"14px"
            }},
              "Sommige PDF's zijn beveiligd voor kopiëren maar mogen voor persoonlijk gebruik worden gelezen. ",
              "Als je je eigen e-mailadres invult, wordt dat als eigenaarsindicatie gebruikt en worden extractie-beperkingen genegeerd voor samenvatten en bevragen in Notebook."
            ),

            // Toggle
            React.createElement("div",{style:{
              display:"flex",alignItems:"center",gap:"12px",marginBottom:"14px",
            }},
              React.createElement("div",{
                onClick:()=>setPersonalUse(v=>!v),
                style:{
                  width:"44px",height:"24px",borderRadius:"12px",
                  background: personalUse ? W.comment : W.splitBg,
                  position:"relative",cursor:"pointer",
                  transition:"background 0.2s",flexShrink:0,
                }
              },
                React.createElement("div",{style:{
                  position:"absolute",top:"3px",
                  left: personalUse ? "23px" : "3px",
                  width:"18px",height:"18px",borderRadius:"50%",
                  background: personalUse ? W.bg : W.fgMuted,
                  transition:"left 0.2s",
                }})
              ),
              React.createElement("span",{style:{
                fontSize:"13px",fontWeight:"600",
                color: personalUse ? W.comment : W.fgMuted,
              }},
                personalUse ? "Persoonlijk gebruik ingeschakeld" : "Persoonlijk gebruik uitgeschakeld"
              )
            ),

            // E-mail veld (zichtbaar als toggle aan)
            personalUse && React.createElement("div",null,
              React.createElement("div",{style:{
                fontSize:"11px",color:W.fgMuted,letterSpacing:"1px",marginBottom:"6px"
              }}, "E-MAILADRESSEN (als eigenaarsindicatie)"),
              React.createElement("textarea",{
                value: personalEmail,
                onChange: e => setPersonalEmail(e.target.value),
                placeholder: "jouw@email.com\nwerk@bedrijf.nl\noud@adres.com",
                rows: 3,
                style:{
                  width:"100%", background:W.bg,
                  border:`1px solid ${
                    personalEmail.split(/[\n,;]/).map(s=>s.trim()).some(s=>s.includes("@"))
                      ? W.comment : W.splitBg
                  }`,
                  borderRadius:"5px", color:W.fg, padding:"8px 12px",
                  fontSize:"13px", outline:"none", boxSizing:"border-box",
                  resize:"vertical", lineHeight:"1.6", fontFamily:"inherit",
                }
              }),
              React.createElement("div",{style:{
                fontSize:"12px",color:W.fgDim,marginTop:"6px",lineHeight:"1.6"
              }},
                "Één adres per regel, of gescheiden door komma's. ",
                "Worden opgeslagen in config.json en nooit verstuurd."
              )
            )
          ),

          // Uitleg
          React.createElement("div",{style:{
            background:"rgba(234,231,136,0.05)",
            border:`1px solid rgba(234,231,136,0.15)`,
            borderRadius:"6px",padding:"12px 16px",marginBottom:"20px",
            fontSize:"12px",color:W.fgMuted,lineHeight:"1.8",
          }},
            React.createElement("span",{style:{color:W.yellow,fontWeight:"600"}},"ℹ Wanneer gebruiken?"),
            React.createElement("br"),
            "Sommige uitgevers voegen restricties toe aan PDF's (geen kopiëren, geen selecteren). ",
            "Als je de PDF rechtmatig bezit — bijv. een gekochte paper of een eigen rapport — ",
            "kun je deze instelling inschakelen zodat de AI de tekst alsnog kan samenvatten en bevragen. ",
            "Dit is alleen bedoeld voor PDF's die je zelf rechtmatig bezit."
          ),

          // Opslaan
          React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"12px"}},
            React.createElement("button",{
              onClick: savePdfSettings,
              style:{
                background:W.blue,color:W.bg,border:"none",
                borderRadius:"5px",padding:"8px 20px",
                fontSize:"13px",cursor:"pointer",fontWeight:"bold"
              }
            },"💾 Opslaan"),
            pdfMsg && React.createElement("span",{style:{
              fontSize:"13px",
              color: pdfMsg.startsWith("✓") ? W.comment : W.orange
            }}, pdfMsg)
          )
        )
      )
    )
  );
};

// ── Main App ───────────────────────────────────────────────────────────────────

// ── Responsive App ─────────────────────────────────────────────────────────────
// Breakpoints:
//   mobile  < 768px  : bottom nav + slide-in drawer
//   tablet  768–1200 : inklapbare sidebar met toggle
//   desktop > 1200px : volledige 3-kolom layout

const useWindowSize = () => {
  const [size, setSize] = React.useState({w: window.innerWidth, h: window.innerHeight});
  React.useEffect(() => {
    const fn = () => setSize({w: window.innerWidth, h: window.innerHeight});
    window.addEventListener("resize", fn);
    window.addEventListener("orientationchange", fn);
    return () => { window.removeEventListener("resize", fn); window.removeEventListener("orientationchange", fn); };
  }, []);
  return size;
};

// ── ImagesGallery ───────────────────────────────────────────────────────────────
// Tab voor afbeeldingen: upload, AI-beschrijving, notitie aanmaken.
// Annotaties via klikpunt op afbeelding — zelfde methodiek als PDF annotaties.

const ImagesGallery = ({serverImages, onRefresh, llmModel, onAddNote, setAiStatus,
                        notes, onDeleteNote, imgNotes, setImgNotes, allTags,
                        addJob, updateJob, onPasteToNote=null}) => {
  const { useState, useRef, useCallback, useEffect, useMemo } = React;

  const [busy,          setBusy]         = useState(null);
  const [descriptions,  setDescs]        = useState({});
  const [lightbox,      setLightbox]     = useState(null);
  const [dragOver,      setDragOver]     = useState(false);
  const [descFilter,    setDescFilter]   = useState("");  // zoek in beschrijvingen
  const [ageFilter,     setAgeFilter]    = useState("alle"); // "alle"|"week"|"maand"|"jaar"
  const [orphanFilter,  setOrphanFilter] = useState(false);  // geen notitie-link
  const [noDescFilter,  setNoDescFilter] = useState(false);  // geen beschrijving
  const [cleanupMsg,    setCleanupMsg]   = useState("");
  const [selected,      setSelected]     = useState(new Set()); // voor bulk-delete
  const galleryRef = React.useRef(null);
  const toolbarRef  = React.useRef(null);

  // Annotatie state — identiek aan PDF
  const [annotations,   setAnnotations]  = useState(imgNotes||[]);
  const [activeImg,     setActiveImg]    = useState(null);    // fname van geselecteerde afbeelding
  const [pendingPin,    setPendingPin]   = useState(null);    // {x,y} fractie van afbeelding
  const [quickNote,     setQuickNote]    = useState("");
  const [quickTags,     setQuickTags]    = useState([]);
  const [activeColor,   setActiveColor]  = useState(HCOLORS[0]);
  const [editingId,     setEditingId]    = useState(null);
  const [showAnnotPanel,setShowAnnotPanel] = useState(true);
  const [filterTag,     setFilterTag]   = useState(null);

  const fileRef   = useRef(null);
  const imgRef    = useRef(null);   // ref naar actieve afbeelding in annotatiemodus

  // Sync imgNotes → lokale state + herstel descriptions
  useEffect(() => {
    const notes = imgNotes||[];
    setAnnotations(notes);
    // Beschrijvingen zitten als {file, description} entries in imgNotes
    const descMap = {};
    notes.forEach(n => { if (n.file && n.description) descMap[n.file] = n.description; });
    if (Object.keys(descMap).length > 0) setDescs(p => ({...p, ...descMap}));
  }, [imgNotes]);

  const saveAnnotations = useCallback(async (updated) => {
    setAnnotations(updated);
    setImgNotes?.(updated);
    await api.saveImgAnnotations(updated);
  }, [setImgNotes]);

  const addAnnotation = useCallback(async () => {
    if (!pendingPin || !activeImg) return;
    const a = {
      id:      genId(),
      text:    quickNote || "(pin)",
      note:    quickNote,
      tags:    quickTags,
      file:    activeImg,
      x:       pendingPin.x,   // fractie 0–1
      y:       pendingPin.y,
      colorId: activeColor.id,
      created: new Date().toISOString(),
    };
    await saveAnnotations([...annotations, a]);
    setPendingPin(null); setQuickNote(""); setQuickTags([]);
  }, [pendingPin, activeImg, quickNote, quickTags, activeColor, annotations, saveAnnotations]);

  const updateAnnotation = useCallback(async (id, patch) => {
    await saveAnnotations(annotations.map(a => a.id===id ? {...a,...patch} : a));
  }, [annotations, saveAnnotations]);

  const removeAnnotation = useCallback(async (id) => {
    await saveAnnotations(annotations.filter(a => a.id!==id));
    if (editingId===id) setEditingId(null);
  }, [annotations, saveAnnotations, editingId]);

  // Annotaties voor de actieve afbeelding
  const fileAnnots = useMemo(() =>
    activeImg ? annotations.filter(a => a.file===activeImg) : [],
  [annotations, activeImg]);

  const allAnnotTags = useMemo(() =>
    [...new Set(fileAnnots.flatMap(a => a.tags||[]))],
  [fileAnnots]);

  const panelAnnots = (filterTag
    ? fileAnnots.filter(a => (a.tags||[]).includes(filterTag))
    : fileAnnots
  ).sort((a,b) => new Date(a.created) - new Date(b.created));

  // Klik op afbeelding in annotatiemodus → pin plaatsen
  const handleImgClick = useCallback((e) => {
    if (!activeImg) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top)  / rect.height;
    setPendingPin({x, y});
    setQuickNote(""); setQuickTags([]);
    setShowAnnotPanel(true);  // sidebar altijd zichtbaar bij nieuwe pin
  }, [activeImg]);

  const upload = useCallback((files) => {
    const imgFiles = Array.from(files).filter(f => f.type.startsWith("image/"));
    if (!imgFiles.length) return;
    // Alle bestanden parallel uploaden + beschrijven
    imgFiles.forEach(f => {
      const jid = genId();
      const shortName = f.name.slice(0, 26);
      addJob && addJob({id: jid, type: "upload", label: "📤 Uploaden: " + shortName});
      setBusy(f.name);
      (async () => {
        try {
          const res = await api.uploadImage(f);
          if (res?.name) {
            await onRefresh();
            updateJob && updateJob(jid, {status: "done", result: "Geüpload → beschrijven…"});
            describeImage(res.name);
          } else {
            updateJob && updateJob(jid, {status: "error", error: "Upload mislukt"});
          }
        } catch(e) {
          console.error("upload:", e);
          updateJob && updateJob(jid, {status: "error", error: e.message});
        } finally {
          setBusy(null);
        }
      })();
    });
  }, [onRefresh, addJob, updateJob]);

  const describeImage = useCallback((fname) => {
    setBusy(fname);
    const stem = fname.replace(/\.[^.]+$/,"");
    const jid = genId();
    addJob && addJob({id:jid, type:"describe", label:"🖼 Beschrijven: "+stem.slice(0,26)+"…"});
    // Achtergrond — UI blijft vrij
    (async () => {
      try {
        const model = llmModel || "llama3.2-vision";
        const res   = await api.llmDescribeImage(fname, model);
        if (res?.description) {
          // Sla beschrijving op in setDescs (live UI)
          setDescs(p=>({...p, [fname]: res.description}));
          // Sla ook op in imgNotes voor persistentie + badge na herlaad
          const current = await api.getImgAnnotations();
          const updated = (current||[]).filter(a=>!(a.file===fname && !a.x));
          updated.push({file:fname, description:res.description});
          await api.saveImgAnnotations(updated);
          setImgNotes?.([...updated]);
          // Maak notitie aan
          if (onAddNote) {
            await onAddNote({
              id: genId(), title: "Afbeelding — "+stem,
              content: "![[img:"+fname+"]]\n\n## Beschrijving\n\n"+res.description,
              tags: ["afbeelding","media"],
              created: new Date().toISOString(), modified: new Date().toISOString(),
            });
          }
          updateJob && updateJob(jid,{status:"done", result:"Opgeslagen als notitie"});
        } else {
          setDescs(p=>({...p, [fname]: "⚠ Beschrijving niet beschikbaar (ollama pull llama3.2-vision)"}));
          updateJob && updateJob(jid,{status:"error", error:"Geen beschrijving ontvangen"});
        }
      } catch(e) {
        setDescs(p=>({...p, [fname]: "⚠ "+e.message}));
        updateJob && updateJob(jid,{status:"error", error:e.message});
      } finally { setBusy(null); }
    })();
  }, [llmModel, onAddNote, addJob, updateJob, setImgNotes]);

  const deleteImg = useCallback(async (fname) => {
    const linked = (notes||[]).filter(n =>
      n.content?.includes(`![[img:${fname}]]`) ||
      n.title?.includes(fname.replace(/\.[^.]+$/,""))
    );
    const imgAnnotCount = annotations.filter(a => a.file===fname).length;
    const parts = [];
    if (linked.length) parts.push(`${linked.length} notitie(s):\n`+linked.map(n=>"• "+n.title).join("\n"));
    if (imgAnnotCount) parts.push(`${imgAnnotCount} annotatie(s)`);
    const msg = parts.length
      ? `Verwijder "${fname}" én:\n${parts.join("\n")}?`
      : `Verwijder "${fname}"?`;
    if (!confirm(msg)) return;
    await api.deleteImage(fname);
    for (const n of linked) { await api.del("/notes/"+n.id); onDeleteNote?.(n.id); }
    // Verwijder ook annotaties van dit bestand
    if (imgAnnotCount) await saveAnnotations(annotations.filter(a => a.file!==fname));
    setDescs(p=>{ const q={...p}; delete q[fname]; return q; });
    if (activeImg===fname) setActiveImg(null);
    await onRefresh();
  }, [onRefresh, notes, onDeleteNote, annotations, saveAnnotations, activeImg]);

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); upload(e.dataTransfer.files); };

  // Filter logica
  const imgs = (serverImages || []).filter(img => {
    // Tekstzoek op naam of beschrijving
    if (descFilter.trim()) {
      const q = descFilter.toLowerCase();
      const desc = descriptions[img.name] || "";
      if (!img.name.toLowerCase().includes(q) && !desc.toLowerCase().includes(q)) return false;
    }
    // Ouderdomsfilter — gebruik modified datum van serverImage of naam-timestamp
    if (ageFilter !== "alle") {
      const now = Date.now();
      const limits = { week: 7, maand: 30, jaar: 365 };
      const days = limits[ageFilter] || 9999;
      const cutoff = now - days * 86400000;
      // Probeer datum uit img.modified of uit naam (bijv. timestamp prefix)
      const ts = img.modified ? new Date(img.modified).getTime()
               : (parseInt(img.name) > 1e12 ? parseInt(img.name) : null);
      if (ts && ts < cutoff) return false;
    }
    // Wees-filter: geen notitie die naar dit plaatje linkt of het bevat
    if (orphanFilter) {
      const allNotes = notes || [];
      const linked = allNotes.some(n =>
        (n.content || "").includes("img:" + img.name) ||
        (n.content || "").includes(img.name)
      );
      if (linked) return false;
    }
    // Geen-beschrijving filter
    if (noDescFilter) {
      const desc = descriptions[img.name] || "";
      const annotDesc = annotations.find(a => a.file === img.name)?.description || "";
      if (desc || annotDesc) return false;
    }
    return true;
  });

  return React.createElement("div", {
    style:{display:"flex",flex:1,minHeight:0,overflow:"hidden"}
  },

    // ── Hoofdkolom: toolbar + galerij ────────────────────────────────────────
    React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0,minHeight:0}},

      // Toolbar
      React.createElement("div",{
        ref: toolbarRef,
        style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,
               padding:"8px 14px",display:"flex",alignItems:"center",
               gap:"10px",flexShrink:0,flexWrap:"wrap"}
      },
        React.createElement("span",{style:{fontSize:"14px",color:W.statusFg,
          letterSpacing:"1.5px",fontWeight:"bold"}},"AFBEELDINGEN"),
        React.createElement("span",{style:{background:W.blue,color:W.bg,
          borderRadius:"10px",padding:"0 7px",fontSize:"14px"}}, imgs.length),
        React.createElement("div",{style:{flex:1}}),
        // Zoekbalk
        React.createElement("input",{
          value: descFilter,
          onChange: e => setDescFilter(e.target.value),
          placeholder: "zoek naam of beschrijving…",
          style:{background:W.bg3,border:`1px solid ${descFilter?W.blue:W.splitBg}`,
                 borderRadius:"5px",color:W.fg,padding:"4px 10px",fontSize:"13px",
                 width:"160px",outline:"none"}
        }),

        // Ouderdomsfilter
        React.createElement("select",{
          value: ageFilter,
          onChange: e => setAgeFilter(e.target.value),
          title: "Filter op importdatum",
          style:{background:W.bg3,border:`1px solid ${ageFilter!=="alle"?W.blue:W.splitBg}`,
                 borderRadius:"5px",color:ageFilter!=="alle"?W.blue:W.fgMuted,
                 padding:"4px 8px",fontSize:"12px",outline:"none",cursor:"pointer"}
        },
          React.createElement("option",{value:"alle"},"📅 alle"),
          React.createElement("option",{value:"week"},"📅 < 1 week"),
          React.createElement("option",{value:"maand"},"📅 < 1 maand"),
          React.createElement("option",{value:"jaar"},"📅 < 1 jaar"),
        ),

        // Filter: geen notitie-link
        React.createElement("button",{
          onClick: () => { setOrphanFilter(p=>!p); setSelected(new Set()); },
          title: "Toon alleen afbeeldingen zonder link naar een notitie",
          style:{background:orphanFilter?"rgba(229,120,109,0.15)":"rgba(255,255,255,0.04)",
                 color:orphanFilter?W.orange:W.fgMuted,
                 border:`1px solid ${orphanFilter?"rgba(229,120,109,0.4)":W.splitBg}`,
                 borderRadius:"5px",padding:"4px 10px",fontSize:"12px",cursor:"pointer",
                 fontWeight:orphanFilter?"600":"400",whiteSpace:"nowrap"}
        }, orphanFilter?"⚠ geen notitie ×":"geen notitie"),

        // Filter: geen beschrijving
        React.createElement("button",{
          onClick: () => { setNoDescFilter(p=>!p); setSelected(new Set()); },
          title: "Toon alleen afbeeldingen zonder AI-beschrijving",
          style:{background:noDescFilter?"rgba(234,231,136,0.15)":"rgba(255,255,255,0.04)",
                 color:noDescFilter?W.yellow:W.fgMuted,
                 border:`1px solid ${noDescFilter?"rgba(234,231,136,0.4)":W.splitBg}`,
                 borderRadius:"5px",padding:"4px 10px",fontSize:"12px",cursor:"pointer",
                 fontWeight:noDescFilter?"600":"400",whiteSpace:"nowrap"}
        }, noDescFilter?"⚠ geen beschrijving ×":"geen beschrijving"),

        // Selecteer alle zichtbare afbeeldingen
        imgs.length > 0 && React.createElement("button",{
          onClick: () => {
            if (selected.size === imgs.length) setSelected(new Set());
            else setSelected(new Set(imgs.map(i=>i.name)));
          },
          style:{background:"rgba(255,255,255,0.04)",color:W.fgMuted,
                 border:`1px solid ${W.splitBg}`,borderRadius:"5px",
                 padding:"4px 10px",fontSize:"12px",cursor:"pointer",whiteSpace:"nowrap"}
        }, selected.size===imgs.length && imgs.length>0 ? "☑ deselecteer":"☐ selecteer alle"),

        // Bulk-delete
        selected.size > 0 && React.createElement("button",{
          onClick: async () => {
            const n = selected.size;
            if (!confirm(`${n} afbeelding${n>1?"en":""} permanent verwijderen?`)) return;
            for (const fname of selected) {
              try { await fetch("/api/images/"+encodeURIComponent(fname),{method:"DELETE"}); }
              catch(e) {}
            }
            setSelected(new Set());
            setCleanupMsg("✓ "+n+" verwijderd");
            setTimeout(()=>setCleanupMsg(""),3000);
            await onRefresh();
          },
          style:{background:"rgba(229,120,109,0.15)",color:W.orange,
                 border:"1px solid rgba(229,120,109,0.4)",borderRadius:"5px",
                 padding:"4px 10px",fontSize:"12px",cursor:"pointer",fontWeight:"600",
                 whiteSpace:"nowrap"}
        }, "🗑 "+selected.size+" verwijderen"),

        cleanupMsg && React.createElement("span",{
          style:{fontSize:"12px",color:W.comment,whiteSpace:"nowrap"}
        }, cleanupMsg),

        React.createElement("div",{style:{flex:1}}),
        React.createElement("button",{
          onClick:()=>fileRef.current?.click(),
          style:{background:W.blue,color:W.bg,border:"none",borderRadius:"6px",
                 padding:"6px 14px",fontSize:"14px",cursor:"pointer",fontWeight:"bold"}
        },"+ upload"),
        React.createElement("input",{
          ref:fileRef, type:"file", multiple:true, accept:"image/*",
          style:{display:"none"},
          onChange:e=>{ upload(e.target.files); e.target.value=""; }
        })
      ),

      // Galerij / annotatie-view
      React.createElement("div",{
        ref: galleryRef,
        style:{flex:1, overflowY:"auto", padding:"16px", minHeight:0,
               background: dragOver?"rgba(138,198,242,0.05)":W.bg,
               WebkitOverflowScrolling:"touch"},
        onDragOver:e=>{ e.preventDefault(); setDragOver(true); },
        onDragLeave:()=>setDragOver(false),
        onDrop,
      },

        // Lege staat
        imgs.length===0 && React.createElement("div",{
          style:{display:"flex",flexDirection:"column",alignItems:"center",
                 justifyContent:"center",height:"60%",gap:"14px",color:W.fgMuted,
                 border:`2px dashed ${dragOver?"rgba(138,198,242,0.5)":W.splitBg}`,
                 borderRadius:"12px",margin:"20px",padding:"40px"}
        },
          React.createElement("div",{style:{fontSize:"48px"}},"🖼"),
          React.createElement("div",{style:{fontSize:"15px",color:W.fgDim}},"Nog geen afbeeldingen"),
          React.createElement("div",{style:{fontSize:"14px",textAlign:"center",lineHeight:"1.7"}},
            "Sleep afbeeldingen hierheen of klik '+ upload'.\n",
            React.createElement("br"),
            "De AI maakt automatisch een beschrijving en een notitie aan."
          ),
          React.createElement("button",{
            onClick:()=>fileRef.current?.click(),
            style:{marginTop:"8px",background:"rgba(138,198,242,0.1)",
                   border:"1px solid rgba(138,198,242,0.3)",color:"#a8d8f0",
                   borderRadius:"8px",padding:"10px 24px",fontSize:"14px",cursor:"pointer"}
          },"+ afbeelding kiezen")
        ),

        // Annotatiemodus: grote weergave met klikbare afbeelding + pinnen
        activeImg && React.createElement("div",{style:{position:"relative",display:"inline-block",maxWidth:"100%"}},
          React.createElement("img",{
            ref:imgRef,
            src:"/api/image/"+encodeURIComponent(activeImg),
            alt:activeImg,
            onClick:handleImgClick,
            style:{maxWidth:"100%",maxHeight:"calc(100vh - 140px)",objectFit:"contain",
                   display:"block",cursor:"crosshair",borderRadius:"6px",
                   boxShadow:"0 4px 24px rgba(0,0,0,0.5)",
                   border:`2px solid ${W.splitBg}`}
          }),

          // Bestaande pins
          ...fileAnnots.map(a => {
            const col = HCOLORS.find(c=>c.id===a.colorId)||HCOLORS[0];
            const isEditing = editingId===a.id;
            return React.createElement("div",{
              key:a.id,
              onClick:e=>{ e.stopPropagation(); setEditingId(isEditing?null:a.id); setPendingPin(null); },
              style:{position:"absolute",
                     left:`calc(${a.x*100}% - 10px)`,
                     top:`calc(${a.y*100}% - 20px)`,
                     zIndex: isEditing ? 20 : 10,
                     cursor:"pointer"}
            },
              // Pin symbool
              React.createElement("div",{style:{
                width:"20px",height:"20px",borderRadius:"50% 50% 50% 0",
                background:col.border,border:"2px solid white",
                transform:"rotate(-45deg)",
                boxShadow:`0 2px 8px rgba(0,0,0,0.6)`,
                transition:"transform 0.1s",
              }}),
              // Tooltip / edit popup boven de pin
              isEditing && React.createElement("div",{
                onClick:e=>e.stopPropagation(),
                style:{position:"absolute",bottom:"28px",left:"-160px",
                       width:"300px",background:W.bg3,
                       border:`2px solid ${col.border}`,borderRadius:"8px",
                       padding:"12px 14px",zIndex:500,
                       boxShadow:"0 8px 32px rgba(0,0,0,0.8)"}
              },
                // Notitietekst
                React.createElement("div",{style:{fontSize:"14px",color:W.fgDim,
                  marginBottom:"8px",padding:"6px 8px",background:col.bg,
                  borderRadius:"4px",fontStyle:"italic",lineHeight:"1.5",
                  borderLeft:`4px solid ${col.border}`}},
                  a.note||"(geen notitie)"),
                // Notitie bewerken
                React.createElement("textarea",{
                  value:a.note||"",
                  onChange:e=>updateAnnotation(a.id,{note:e.target.value}),
                  onKeyDown:e=>{ if(e.key==="Escape") setEditingId(null); },
                  rows:2,
                  placeholder:"Notitie…",
                  style:{width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,
                         borderRadius:"4px",padding:"6px 8px",color:W.fg,
                         fontSize:"14px",outline:"none",resize:"none",marginBottom:"6px"}
                }),
                // Tags
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
                  marginBottom:"4px",letterSpacing:"1px"}},"TAGS"),
                React.createElement(SmartTagEditor,{tags:a.tags||[],
                  onChange:tags=>updateAnnotation(a.id,{tags}),
                  allTags:[...(allTags||[]),...allAnnotTags]}),
                // Kleur
                React.createElement("div",{style:{display:"flex",gap:"5px",margin:"8px 0"}},
                  ...HCOLORS.map(c=>React.createElement("button",{key:c.id,
                    onClick:()=>updateAnnotation(a.id,{colorId:c.id}),
                    style:{width:"18px",height:"18px",borderRadius:"3px",background:c.bg,
                           border:`2px solid ${a.colorId===c.id?c.border:W.splitBg}`,
                           cursor:"pointer",padding:0}}))
                ),
                // Acties
                React.createElement("div",{style:{display:"flex",gap:"6px",marginTop:"4px"}},
                  React.createElement("button",{
                    onClick:()=>setEditingId(null),
                    style:{background:W.comment,color:W.bg,border:"none",borderRadius:"3px",
                           padding:"3px 10px",fontSize:"14px",cursor:"pointer",fontWeight:"bold"}
                  },"✓ klaar"),
                  React.createElement("button",{
                    onClick:()=>removeAnnotation(a.id),
                    style:{background:"none",color:W.orange,
                           border:`1px solid rgba(229,120,109,0.3)`,
                           borderRadius:"3px",padding:"3px 8px",fontSize:"14px",cursor:"pointer"}
                  },":del")
                )
              )
            );
          }),

          // Pending pin: visuele indicator op de afbeelding (invoer loopt via sidebar)
          pendingPin && React.createElement("div",{
            style:{position:"absolute",
                   left:`calc(${pendingPin.x*100}% - 10px)`,
                   top:`calc(${pendingPin.y*100}% - 20px)`,
                   zIndex:30, pointerEvents:"none"}
          },
            React.createElement("div",{style:{
              width:"20px",height:"20px",borderRadius:"50% 50% 50% 0",
              background:activeColor.border,border:"2px solid white",
              transform:"rotate(-45deg)",
              animation:"ai-pulse 0.8s ease-in-out infinite",
            }})
          )
        ),

        // Galerij grid (als geen activeImg)
        !activeImg && imgs.length>0 && React.createElement("div",{
          style:{display:"grid",
                 gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",
                 gap:"14px"}
        },
          imgs.map(img => {
            const desc       = descriptions[img.name];
            const isBusy     = busy===img.name;
            const annotCount = annotations.filter(a=>a.file===img.name).length;
            const isSel = selected.has(img.name);
            return React.createElement("div",{
              key:img.name,
              style:{background:W.bg2,
                     border:`2px solid ${isSel?W.orange:isBusy?"rgba(138,198,242,0.4)":W.splitBg}`,
                     borderRadius:"8px",overflow:"hidden",
                     display:"flex",flexDirection:"column",
                     position:"relative",
                     transition:"border-color 0.15s",
                     opacity: isSel ? 0.85 : 1}
            },
              // Selectie-checkbox overlay
              React.createElement("div",{
                onClick: e=>{ e.stopPropagation();
                  setSelected(p=>{ const n=new Set(p);
                    isSel?n.delete(img.name):n.add(img.name); return n; }); },
                style:{position:"absolute",top:"6px",right:"6px",zIndex:10,
                       width:"20px",height:"20px",borderRadius:"4px",cursor:"pointer",
                       background:isSel?W.orange:"rgba(0,0,0,0.5)",
                       border:`2px solid ${isSel?W.orange:"rgba(255,255,255,0.3)"}`,
                       display:"flex",alignItems:"center",justifyContent:"center",
                       fontSize:"12px",color:W.bg,fontWeight:"bold",flexShrink:0}
              }, isSel?"✓":""),
              // Thumbnail
              React.createElement("div",{
                style:{position:"relative",paddingTop:"65%",background:W.bg,cursor:"pointer"},
                onClick:()=>setLightbox(img.name)
              },
                React.createElement("img",{
                  src:"/api/image/"+encodeURIComponent(img.name),
                  alt:img.name, loading:"lazy",
                  style:{position:"absolute",inset:0,width:"100%",height:"100%",
                         objectFit:"contain",padding:"4px"}
                }),
                isBusy && React.createElement("div",{
                  style:{position:"absolute",inset:0,background:"rgba(0,0,0,0.5)",
                         display:"flex",alignItems:"center",justifyContent:"center",
                         color:"#a8d8f0",fontSize:"14px",gap:"6px"}
                },"⏳ AI verwerkt…"),
                // Beschrijving-badge op thumbnail
                React.createElement("div",{
                  style:{position:"absolute",top:"6px",left:"6px",
                         background: desc ? "rgba(159,202,86,0.88)" : "rgba(80,80,90,0.75)",
                         color:"white", borderRadius:"10px",
                         padding:"1px 8px",fontSize:"11px",
                         fontWeight:"600",backdropFilter:"blur(4px)"}
                }, desc ? "✓ beschrijving" : "geen beschrijving")
              ),
              // Info
              React.createElement("div",{style:{padding:"10px 12px",flex:1,
                display:"flex",flexDirection:"column",gap:"6px"}},
                React.createElement("div",{style:{fontSize:"13px",color:W.fg,
                  fontWeight:"600",overflow:"hidden",textOverflow:"ellipsis",
                  whiteSpace:"nowrap"}}, img.name),
                // Beschrijving of knop om te genereren
                desc
                  ? React.createElement("div",{style:{fontSize:"13px",color:W.fgDim,
                      lineHeight:"1.5",flex:1,
                      display:"-webkit-box",WebkitLineClamp:3,
                      WebkitBoxOrient:"vertical",overflow:"hidden"}}, desc)
                  : React.createElement("button",{
                      onClick:()=>describeImage(img.name), disabled:!!busy,
                      style:{background:"rgba(138,198,242,0.07)",
                             border:"1px solid rgba(138,198,242,0.2)",color:"#a8d8f0",
                             borderRadius:"4px",padding:"4px 10px",fontSize:"13px",
                             cursor:busy?"not-allowed":"pointer",opacity:busy?0.5:1,
                             textAlign:"left"}
                    },"🧠 Beschrijving genereren"),
                // Acties
                React.createElement("div",{style:{display:"flex",gap:"5px",marginTop:"4px"}},
                  // 🔍 Lightbox
                  React.createElement("button",{
                    onClick:()=>setLightbox(img.name),
                    title:"Vergroot",
                    style:{flex:1,background:"none",border:`1px solid ${W.splitBg}`,
                           color:W.fgMuted,borderRadius:"4px",padding:"4px",
                           fontSize:"14px",cursor:"pointer"}
                  },"🔍"),
                  // → Notitie openen of aanmaken
                  onAddNote && React.createElement("button",{
                    onClick:async()=>{
                      const stem = img.name.replace(/\.[^.]+$/,"");
                      // Zoek bestaande notitie voor deze afbeelding
                      const existing = (notes||[]).find(n =>
                        n.content?.includes(`![[img:${img.name}]]`) ||
                        n.title === "Afbeelding — "+stem
                      );
                      if (existing) {
                        // Navigeer naar bestaande notitie
                        await onAddNote({_navigate: existing.id});
                      } else {
                        // Maak nieuwe notitie
                        await onAddNote({
                          id:genId(), title:"Afbeelding — "+stem,
                          content: "![[img:"+img.name+"]]"
                            + (desc ? "\n\n## Beschrijving\n\n"+desc : ""),
                          tags:["afbeelding","media"],
                          created:new Date().toISOString(),
                          modified:new Date().toISOString()
                        });
                      }
                    },
                    title: desc ? "Open of maak notitie met beschrijving"
                                : "Maak notitie met afbeelding",
                    style:{flex:2,
                           background: desc ? "rgba(138,198,242,0.08)" : "rgba(138,198,242,0.04)",
                           border:"1px solid rgba(138,198,242,0.2)",color:"#a8d8f0",
                           borderRadius:"4px",padding:"4px",fontSize:"13px",cursor:"pointer"}
                  }, desc ? "📝 → notitie" : "📝 notitie"),
                  // 📋 Plakken in split-modus
                  onPasteToNote && React.createElement("button",{
                    onClick:()=>onPasteToNote({
                      text: desc ? `![[img:${img.name}]]\n\n${desc}` : `![[img:${img.name}]]`,
                      source: img.name, page:null,
                      url: `/api/image/${encodeURIComponent(img.name)}`,
                    }),
                    title:"Plak in open notitie",
                    style:{flex:1,background:"rgba(159,202,86,0.08)",
                           border:"1px solid rgba(159,202,86,0.25)",color:W.comment,
                           borderRadius:"4px",padding:"4px",fontSize:"14px",cursor:"pointer"}
                  },"📋"),
                  // 🗑 Verwijderen
                  React.createElement("button",{
                    onClick:()=>deleteImg(img.name),
                    title:"Verwijder afbeelding",
                    style:{background:"rgba(229,120,109,0.08)",
                           border:"1px solid rgba(229,120,109,0.2)",color:W.orange,
                           borderRadius:"4px",padding:"4px 8px",fontSize:"14px",cursor:"pointer"}
                  },"🗑")
                )
              )
            );
          })
        )
      )
    ),


    // ── Lightbox ─────────────────────────────────────────────────────────────
    lightbox && React.createElement("div",{
      onClick:()=>setLightbox(null),
      style:{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1000,
             display:"flex",alignItems:"center",justifyContent:"center",cursor:"zoom-out"}
    },
      React.createElement("img",{
        src:"/api/image/"+encodeURIComponent(lightbox), alt:lightbox,
        onClick:e=>e.stopPropagation(),
        style:{maxWidth:"92vw",maxHeight:"88vh",objectFit:"contain",
               borderRadius:"8px",boxShadow:"0 16px 64px rgba(0,0,0,0.8)"}
      }),
      React.createElement("button",{
        onClick:()=>setLightbox(null),
        style:{position:"absolute",top:"16px",right:"20px",background:"rgba(0,0,0,0.5)",
               border:"1px solid rgba(255,255,255,0.2)",color:"white",
               borderRadius:"50%",width:"36px",height:"36px",fontSize:"18px",
               cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}
      },"×"),
      React.createElement("div",{
        style:{position:"absolute",bottom:"16px",left:"50%",
               transform:"translateX(-50%)",color:"rgba(255,255,255,0.7)",
               fontSize:"14px",background:"rgba(0,0,0,0.5)",padding:"4px 12px",
               borderRadius:"12px"}
      }, lightbox)
    )
  );
};





// ── Mindmap ────────────────────────────────────────────────────────────────────
// Interactieve mindmap op basis van notities en tags.
// Layout: radiale boom — root in midden, takken per tag, notities als bladeren.
// Editor: klik node om te hernoemen/verwijderen, sleep om te herpositioneren.
// Exporteerbaar als JSON (opgeslagen in vault).

const MM_NODE_W  = 130;
const MM_NODE_H  = 32;
const MM_RADIUS  = 200;  // afstand root→tag
const MM_LEAF_R  = 140;  // afstand tag→notitie

// ── Mermaid Mindmap Parser & Canvas Renderer ─────────────────────────────────
// Parseert mermaid mindmap-syntax en rendert het op een canvas.
// Syntax:
//   mindmap
//     root((Titel))
//       Tak A
//         Sub A1
//         Sub A2
//       Tak B

const parseMermaidMindmap = (text) => {
  // Verwijder "mindmap" header en lege regels
  const raw = text.replace(/^\s*mindmap\s*/i, "");
  const lines = raw.split("\n").filter(l => l.trimEnd());

  const getDepth = (line) => {
    const m = line.match(/^(\s*)/);
    return m ? Math.floor(m[1].length / 2) : 0;
  };

  const cleanLabel = (s) => s.trim()
    .replace(/^root\(\((.+?)\)\)/, "$1")  // root((label))
    .replace(/^\(\((.+?)\)\)/, "$1")      // ((label)) = round
    .replace(/^\((.+?)\)/, "$1")          // (label)
    .replace(/^\[(.+?)\]/, "$1")          // [label]
    .replace(/^::icon\([^)]*\)/, "")      // icon directives
    .replace(/^\s*/, "");

  const nodes = [];
  const stack = [];  // {id, depth}
  let idCounter = 0;

  lines.forEach(line => {
    if (!line.trim()) return;
    const depth = getDepth(line);
    const label = cleanLabel(line);
    if (!label) return;

    const id = "mm_" + (idCounter++);
    const parentId = stack.filter(s => s.depth < depth).slice(-1)[0]?.id || null;

    nodes.push({ id, label, depth, parentId });

    // Update stack: verwijder alles op zelfde/diepere depth
    while (stack.length && stack[stack.length-1].depth >= depth) stack.pop();
    stack.push({ id, depth });
  });

  return nodes;
};

const MermaidCanvas = ({ text, width, height, interactive=false }) => {
  const cvRef   = React.useRef(null);
  const stateRef = React.useRef({ pan:{x:0,y:0}, zoom:1, dragging:false,
                                   lastX:0, lastY:0 });

  const render = React.useCallback(() => {
    const cv = cvRef.current;
    if (!cv || !text) return;
    const ctx   = cv.getContext("2d");
    const dpr   = window.devicePixelRatio || 1;
    const W_px  = width;
    const H_px  = height;
    cv.width    = W_px * dpr;
    cv.height   = H_px * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W_px, H_px);
    ctx.fillStyle = W.bg;
    ctx.fillRect(0, 0, W_px, H_px);

    const allNodes = parseMermaidMindmap(text);
    if (!allNodes.length) {
      ctx.fillStyle = W.fgMuted;
      ctx.font = "12px 'Hack','Courier New',monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Typ een mindmap om de preview te zien…", W_px/2, H_px/2);
      return;
    }

    const PALETTE = [W.blue, W.comment, W.orange, W.purple,
                     W.string, W.type, W.keyword, "#e8d44d"];

    // ── Bereken tekstbreedte ─────────────────────────────────────────────────
    const FONT_ROOT = "bold 13px 'Hack','Courier New',monospace";
    const FONT_L1   = "bold 12px 'Hack','Courier New',monospace";
    const FONT_L2   = "11px 'Hack','Courier New',monospace";
    const FONT_L3   = "10px 'Hack','Courier New',monospace";
    const getFont  = (d) => d===0 ? FONT_ROOT : d===1 ? FONT_L1 : d===2 ? FONT_L2 : FONT_L3;
    const NODE_PAD_X = 14, NODE_H = 26;

    const measured = {};
    allNodes.forEach(n => {
      ctx.font = getFont(n.depth);
      const tw = ctx.measureText(n.label).width;
      measured[n.id] = { tw, nw: Math.max(tw + NODE_PAD_X*2, 60), nh: n.depth===0?32:NODE_H };
    });

    // ── Tree layout: Reingold-Tilford stijl ──────────────────────────────────
    // We doen een horizontale boom: root links, kinderen rechts.
    const byParent = {};
    allNodes.forEach(n => { byParent[n.id] = []; });
    allNodes.forEach(n => { if (n.parentId) byParent[n.parentId].push(n); });

    const LEVEL_W  = 180;   // horizontale afstand per diepte-niveau
    const MIN_GAP  = 10;    // minimale verticale ruimte tussen nodes

    // Post-order: bereken benodigde hoogte per node
    const subtreeH = {};
    const calcH = (id) => {
      const ch = byParent[id] || [];
      if (!ch.length) { subtreeH[id] = measured[id]?.nh || NODE_H; return; }
      ch.forEach(c => calcH(c.id));
      const total = ch.reduce((s,c) => s + subtreeH[c.id], 0) + (ch.length-1)*MIN_GAP;
      subtreeH[id] = Math.max(measured[id]?.nh || NODE_H, total);
    };
    const root = allNodes[0];
    calcH(root.id);

    // Pre-order: wijs y-posities toe
    const pos = {};
    const assignPos = (id, x, topY) => {
      const ch = byParent[id] || [];
      const totalH = subtreeH[id];
      const cy = topY + totalH / 2;
      pos[id] = { x, y: cy };

      let curY = topY;
      ch.forEach(c => {
        assignPos(c.id, x + LEVEL_W, curY);
        curY += subtreeH[c.id] + MIN_GAP;
      });
    };
    assignPos(root.id, 0, -subtreeH[root.id]/2);

    // ── Auto-fit: schaal + centreer op canvas ────────────────────────────────
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    allNodes.forEach(n => {
      const p = pos[n.id]; if (!p) return;
      const m = measured[n.id] || {nw:60};
      minX = Math.min(minX, p.x - m.nw/2);
      maxX = Math.max(maxX, p.x + m.nw/2);
      minY = Math.min(minY, p.y - NODE_H/2);
      maxY = Math.max(maxY, p.y + NODE_H/2);
    });
    const treeW = maxX - minX + 40;
    const treeH = maxY - minY + 40;
    const fitZoom = Math.min(1.2, Math.min((W_px-20)/treeW, (H_px-20)/treeH));

    const s = stateRef.current;
    // Bij eerste render of als niet interactief: reset zoom/pan
    if (!interactive || (s.zoom === 1 && s.pan.x === 0 && s.pan.y === 0)) {
      s.zoom = fitZoom;
      s.pan  = {
        x: W_px/2 - (minX + treeW/2) * fitZoom,
        y: H_px/2 - (minY + treeH/2) * fitZoom
      };
    }

    ctx.save();
    ctx.translate(s.pan.x, s.pan.y);
    ctx.scale(s.zoom, s.zoom);

    // ── Kleur per tak (gebaseerd op eerste-niveau kind) ──────────────────────
    const nodeColor = {};
    nodeColor[root.id] = W.blue;
    (byParent[root.id]||[]).forEach((c,i) => {
      const col = PALETTE[i % PALETTE.length];
      const paint = (id, col) => {
        nodeColor[id] = col;
        (byParent[id]||[]).forEach(ch => paint(ch.id, col));
      };
      paint(c.id, col);
    });

    // ── Edges ────────────────────────────────────────────────────────────────
    allNodes.forEach(n => {
      if (!n.parentId) return;
      const f = pos[n.id], t = pos[n.parentId];
      if (!f || !t) return;
      const col = nodeColor[n.id] || W.fgMuted;
      const fm  = measured[n.id]  || {nw:60};
      const tm  = measured[n.parentId] || {nw:60};

      ctx.beginPath();
      const x1 = t.x + tm.nw/2;     // rechterkant parent
      const y1 = t.y;
      const x2 = f.x - fm.nw/2;     // linkerkant kind
      const y2 = f.y;
      const mx = (x1+x2)/2;
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(mx, y1, mx, y2, x2, y2);
      ctx.strokeStyle = col + "70";
      ctx.lineWidth   = n.depth <= 1 ? 2.5 : 1.5;
      ctx.stroke();
    });

    // ── Nodes ────────────────────────────────────────────────────────────────
    allNodes.forEach(n => {
      const p   = pos[n.id]; if (!p) return;
      const m   = measured[n.id] || {nw:60, nh:NODE_H};
      const col = nodeColor[n.id] || W.fgMuted;
      const isRoot = n.depth === 0;
      const nx  = p.x - m.nw/2;
      const ny  = p.y - m.nh/2;

      // Schaduw
      ctx.shadowColor   = col + "40";
      ctx.shadowBlur    = isRoot ? 12 : 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      // Achtergrond
      ctx.beginPath();
      if (isRoot) {
        const r = m.nh / 2;
        ctx.roundRect(nx, ny, m.nw, m.nh, r);
      } else {
        ctx.roundRect(nx, ny, m.nw, m.nh, 5);
      }
      ctx.fillStyle   = isRoot ? col + "35" : col + "18";
      ctx.strokeStyle = col + (isRoot ? "ee" : "99");
      ctx.lineWidth   = isRoot ? 2 : 1.5;
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Tekst
      ctx.font        = getFont(n.depth);
      ctx.fillStyle   = isRoot ? W.statusFg : col;
      ctx.textAlign   = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.label, p.x, p.y);
    });

    ctx.restore();

    // Hint bij interactieve modus
    if (interactive) {
      ctx.fillStyle = "rgba(255,255,255,0.15)";
      ctx.font = "9px 'Hack','Courier New',monospace";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.fillText("scroll=zoom · sleep=pan", W_px-8, H_px-6);
    }
  }, [text, width, height, interactive]);

  React.useEffect(() => { render(); }, [render]);

  // Pan & zoom handlers (alleen als interactive)
  const onWheel = (e) => {
    if (!interactive) return;
    e.preventDefault();
    const s = stateRef.current;
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    const rect = cvRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    s.pan.x = mx - (mx - s.pan.x) * factor;
    s.pan.y = my - (my - s.pan.y) * factor;
    s.zoom *= factor;
    render();
  };
  const onMouseDown = (e) => {
    if (!interactive) return;
    const s = stateRef.current;
    s.dragging = true; s.lastX = e.clientX; s.lastY = e.clientY;
  };
  const onMouseMove = (e) => {
    const s = stateRef.current;
    if (!s.dragging) return;
    s.pan.x += e.clientX - s.lastX;
    s.pan.y += e.clientY - s.lastY;
    s.lastX = e.clientX; s.lastY = e.clientY;
    render();
  };
  const onMouseUp = () => { stateRef.current.dragging = false; };

  return React.createElement("canvas", {
    ref: cvRef,
    style: { display:"block", width:"100%", height:"100%",
             cursor: interactive ? "grab" : "default" },
    onWheel, onMouseDown, onMouseMove, onMouseUp,
    onMouseLeave: onMouseUp,
  });
};

// ── Mermaid inline preview blok (in note-viewer) ──────────────────────────────
// Vervangt het klikbare code-blok met een echte canvas render + knoppen.
const MermaidPreviewBlock = ({ code, onEdit }) => {
  const containerRef = React.useRef(null);
  const [size, setSize]       = React.useState({w:600, h:320});
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => {
      const r = e[0].contentRect;
      setSize({ w: r.width||600, h: expanded ? 520 : 320 });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [expanded]);

  return React.createElement("div", {
    style:{ margin:"14px 0", border:`1px solid rgba(159,202,86,0.35)`,
            borderRadius:"8px", overflow:"hidden",
            background:"rgba(0,0,0,0.2)" }
  },
    // Header
    React.createElement("div",{style:{
      display:"flex", alignItems:"center", gap:"8px",
      padding:"6px 12px",
      background:"rgba(159,202,86,0.06)",
      borderBottom:`1px solid rgba(159,202,86,0.2)`
    }},
      React.createElement("span",{style:{fontSize:"14px",color:W.comment,
        fontWeight:"600",letterSpacing:"1px"}},"🌿 MINDMAP"),
      React.createElement("div",{style:{flex:1}}),
      React.createElement("button",{
        onClick:()=>setExpanded(v=>!v),
        style:{background:"none",border:"none",color:W.fgMuted,
               fontSize:"14px",cursor:"pointer",padding:"2px 6px"}
      }, expanded ? "⊟ inklappen" : "⊞ uitvouwen"),
      onEdit && React.createElement("button",{
        onClick: onEdit,
        style:{background:"rgba(138,198,242,0.1)",
               border:"1px solid rgba(138,198,242,0.3)",
               color:W.blue,borderRadius:"4px",fontSize:"14px",
               cursor:"pointer",padding:"2px 8px"}
      }, "✏ bewerken")
    ),
    // Canvas
    React.createElement("div",{
      ref:containerRef,
      style:{ height: expanded ? "520px" : "320px",
              transition:"height 0.2s", position:"relative" }
    },
      React.createElement(MermaidCanvas,{
        text:code, width:size.w, height:size.h, interactive:true
      })
    )
  );
};

// ── MermaidCodeEditor — canvas-based editor, identiek gedrag aan VimEditor ────
// Volledig VIM-modes (INSERT/NORMAL/COMMAND/SEARCH), cursorline+cursorcolumn,
// syntax highlighting per regel via canvas drawLine, statusbalk met mode-badge.
const MermaidCodeEditor = ({ value, onChange, editorRef, noteTags=[], onTagsChange=()=>{}, allTags=[], onModeChange=()=>{} }) => {
  const { useState, useEffect, useRef, useCallback } = React;

  const FONT_SZ = 13;
  const LINE_H2 = 22;
  const PAD_L   = 6;

  // ── PALETTE voor syntax kleuring (zelfde als highlight()-functie hierboven) ─
  const MM_PALETTE = [W.blue, W.comment, W.orange, W.purple,
                      W.string, W.type, W.keyword, "#e8d44d"];

  // ── React state (alleen voor statusbalk re-render) ────────────────────────
  const [mode,      setModeState] = useState("INSERT");
  const [cmdBuf,    setCmdBuf]    = useState("");
  const [statusMsg, setStatus]    = useState("");

  // ── Alle editor-staat in één ref ─────────────────────────────────────────
  const S = useRef({
    lines:   value.split("\n"),
    cur:     {row:0, col:0},
    scroll:  0,
    mode:    "INSERT",
    cmdBuf:  "",
    undo:    [value.split("\n")],
    undoIdx: 0,
    yank:    "",
    search:  "",
    matches: [],
    matchIdx:0,
    charW:   7.8,
    visRows: 20,
  });

  const cvRef      = useRef(null);
  const inputRef   = useRef(null);
  const rafRef     = useRef(null);
  const blinkRef   = useRef(null);
  const blinkOn    = useRef(true);
  const undoTimer  = useRef(null);
  const prevValue  = useRef(value);

  const setMode = useCallback((m) => {
    S.current.mode = m;
    setModeState(m);
    blinkOn.current = true;
  }, []);

  // ── Externe value sync ───────────────────────────────────────────────────
  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      S.current.lines = value.split("\n");
      clamp();
      draw();
    }
  }, [value]);

  // ── editorRef API (focus + insertAtCursor + triggerInsert) ──────────────
  useEffect(() => {
    if (!editorRef) return;
    editorRef.current = {
      focus: () => inputRef.current?.focus(),
      // Zet editor in INSERT mode en geef focus — voor "✏ bewerken" knop
      triggerInsert: () => {
        setMode("INSERT");
        draw();
        inputRef.current?.focus();
      },
      insertAtCursor: (text) => {
        const s = S.current;
        setMode("INSERT");
        text.split("\n").forEach((part, i) => {
          for (const ch of part) insertChar(s, ch);
          if (i < text.split("\n").length - 1) {
            const {row,col} = s.cur;
            const before = s.lines[row].slice(0,col);
            const after  = s.lines[row].slice(col);
            s.lines[row] = before;
            s.lines.splice(row+1, 0, after);
            s.cur.row++; s.cur.col=0;
          }
        });
        emit(s); scrollToCursor(s); draw();
        inputRef.current?.focus();
      },
    };
  });

  // ── Canvas setup ──────────────────────────────────────────────────────────
  useEffect(() => {
    const cv  = cvRef.current;
    const inp = inputRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    ctx.font  = `${FONT_SZ}px 'Hack','Courier New',monospace`;
    S.current.charW = ctx.measureText("M").width;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const pw  = cv.parentElement.clientWidth;
      const ph  = cv.parentElement.clientHeight;
      cv.width  = pw * dpr;
      cv.height = ph * dpr;
      cv.style.width  = pw + "px";
      cv.style.height = ph + "px";
      ctx.scale(dpr, dpr);
      S.current.visRows = Math.floor((ph - LINE_H2) / LINE_H2);
      draw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv.parentElement);

    blinkRef.current = setInterval(() => { blinkOn.current = !blinkOn.current; draw(); }, 530);

    // Auto-focus bij mount zodat toetsenbord direct werkt (ook bij tab-navigatie)
    requestAnimationFrame(() => inp.focus());

    const focusInput = () => inp.focus();

    const onMouseDown = (e) => {
      const r  = cv.getBoundingClientRect();
      const s  = S.current;
      const cw = s.charW;
      const row = Math.min(s.lines.length-1, Math.max(0, Math.floor((e.clientY-r.top)/LINE_H2)+s.scroll));
      const col = Math.min(s.lines[row].length, Math.max(0, Math.round((e.clientX-r.left-PAD_L)/cw)));
      s.cur = {row,col};
      setMode("INSERT");
      scrollToCursor(s);
      inp.focus();
      draw();
    };
    cv.addEventListener("mousedown", onMouseDown);
    // Canvas focus-event → stuur door naar hidden input
    cv.addEventListener("focus", focusInput);

    const onWheel = (e) => {
      e.preventDefault();
      const s = S.current;
      s.scroll = Math.max(0, Math.min(s.lines.length-1, s.scroll + (e.deltaY>0?3:-3)));
      draw();
    };
    cv.addEventListener("wheel", onWheel, {passive:false});

    return () => {
      ro.disconnect();
      clearInterval(blinkRef.current);
      cancelAnimationFrame(rafRef.current);
      cv.removeEventListener("mousedown", onMouseDown);
      cv.removeEventListener("focus", focusInput);
      cv.removeEventListener("wheel", onWheel);
    };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const clamp = () => {
    const s = S.current;
    s.cur.row = Math.max(0, Math.min(s.lines.length-1, s.cur.row));
    s.cur.col = Math.max(0, Math.min(s.lines[s.cur.row].length, s.cur.col));
  };
  const scrollToCursor = (s) => {
    if (s.cur.row < s.scroll) s.scroll = s.cur.row;
    if (s.cur.row >= s.scroll + s.visRows) s.scroll = s.cur.row - s.visRows + 1;
    s.scroll = Math.max(0, s.scroll);
  };
  const emit = (s) => {
    const v = s.lines.join("\n");
    prevValue.current = v;
    onChange(v);
  };
  const pushUndo = (s) => {
    const cut = s.undo.slice(0, s.undoIdx+1);
    cut.push(s.lines.slice());
    s.undo = cut; s.undoIdx = cut.length-1;
  };
  const scheduleUndo = (s) => {
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(()=>pushUndo(s), 600);
  };
  const insertChar = (s, ch) => {
    const {row,col} = s.cur;
    s.lines[row] = s.lines[row].slice(0,col) + ch + s.lines[row].slice(col);
    s.cur.col += ch.length;
  };

  // ── Zoeken ────────────────────────────────────────────────────────────────
  const buildMatches = (s, term) => {
    s.search=term; s.matches=[]; s.matchIdx=0;
    if (!term) return;
    s.lines.forEach((line,r)=>{
      let i=0;
      while((i=line.indexOf(term,i))>=0){ s.matches.push({row:r,col:i}); i+=term.length; }
    });
  };
  const jumpMatch = (s, dir) => {
    if (!s.matches.length) return;
    s.matchIdx=((s.matchIdx+dir)+s.matches.length)%s.matches.length;
    const m=s.matches[s.matchIdx]; s.cur={row:m.row,col:m.col}; scrollToCursor(s);
  };

  // ── Command handler (incl. :tag) ──────────────────────────────────────────
  const runCmd = useCallback((s, cmd) => {
    cmd = cmd.trim();
    if (/^tag\+/.test(cmd))  { const t=cmd.replace(/^tag\+\s*/,"").replace(/^#/,"").trim(); if(t) onTagsChange([...new Set([...noteTags,t])]); setStatus(`+tag: ${t}`); return; }
    if (/^tag-/.test(cmd))   { const t=cmd.replace(/^tag-\s*/,"").replace(/^#/,"").trim(); onTagsChange(noteTags.filter(x=>x!==t)); setStatus(`-tag: ${t}`); return; }
    if (/^tag\s/.test(cmd))  { const ts=cmd.slice(4).split(/[\s,]+/).map(t=>t.replace(/^#/,"")).filter(Boolean); onTagsChange([...new Set(ts)]); setStatus("tags: "+ts.join(" ")); return; }
    if (cmd==="tags")         { setStatus("tags: "+noteTags.join(" ")); return; }
    if (cmd==="w")            { setStatus("✓ gebruik '💾 opslaan' in toolbar"); return; }
    setStatus(`onbekend: :${cmd}`);
  }, [noteTags, onTagsChange]);

  // ── Keyboard handler ──────────────────────────────────────────────────────
  const handleKey = useCallback((e) => {
    const s = S.current;
    const m = s.mode;

    // ── INSERT ───────────────────────────────────────────────────────────────
    if (m === "INSERT") {
      if (e.key === "Escape") { e.preventDefault(); setMode("NORMAL"); setStatus(""); draw(); return; }
      if (e.ctrlKey && e.key==="s") { e.preventDefault(); setStatus("gebruik '💾 opslaan' in toolbar"); draw(); return; }

      if (e.key==="ArrowLeft")  { e.preventDefault(); s.cur.col=Math.max(0,s.cur.col-1); scrollToCursor(s); draw(); return; }
      if (e.key==="ArrowRight") { e.preventDefault(); s.cur.col=Math.min(s.lines[s.cur.row].length,s.cur.col+1); scrollToCursor(s); draw(); return; }
      if (e.key==="ArrowUp")    { e.preventDefault(); if(s.cur.row>0){s.cur.row--;s.cur.col=Math.min(s.cur.col,s.lines[s.cur.row].length);} scrollToCursor(s); draw(); return; }
      if (e.key==="ArrowDown")  { e.preventDefault(); if(s.cur.row<s.lines.length-1){s.cur.row++;s.cur.col=Math.min(s.cur.col,s.lines[s.cur.row].length);} scrollToCursor(s); draw(); return; }
      if (e.key==="Home")       { e.preventDefault(); s.cur.col=0; draw(); return; }
      if (e.key==="End")        { e.preventDefault(); s.cur.col=s.lines[s.cur.row].length; draw(); return; }

      if (e.key==="Tab") {
        e.preventDefault();
        insertChar(s,"  "); emit(s); scrollToCursor(s); draw(); return;
      }
      if (e.key==="Enter") {
        e.preventDefault();
        const {row,col}=s.cur; const line=s.lines[row];
        // Behoud inspringing (belangrijk voor mermaid-hiërachie)
        const indent=line.match(/^( *)/)[1];
        const after=line.slice(col);
        s.lines[row]=line.slice(0,col);
        s.lines.splice(row+1,0,indent+after);
        s.cur.row++; s.cur.col=indent.length;
        scheduleUndo(s); emit(s); scrollToCursor(s); draw(); return;
      }
      if (e.key==="Backspace") {
        e.preventDefault();
        const {row,col}=s.cur;
        if (col>0){ s.lines[row]=s.lines[row].slice(0,col-1)+s.lines[row].slice(col); s.cur.col--; }
        else if (row>0){ const prev=s.lines[row-1]; s.cur.col=prev.length; s.lines[row-1]=prev+s.lines[row]; s.lines.splice(row,1); s.cur.row--; }
        scheduleUndo(s); emit(s); scrollToCursor(s); draw(); return;
      }
      if (e.key==="Delete") {
        e.preventDefault();
        const {row,col}=s.cur;
        if(col<s.lines[row].length){ s.lines[row]=s.lines[row].slice(0,col)+s.lines[row].slice(col+1); }
        else if(row<s.lines.length-1){ s.lines[row]=s.lines[row]+s.lines[row+1]; s.lines.splice(row+1,1); }
        scheduleUndo(s); emit(s); draw(); return;
      }
      if (e.key.length===1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        insertChar(s,e.key); scheduleUndo(s); emit(s); scrollToCursor(s); draw(); return;
      }
      return;
    }

    // ── COMMAND ──────────────────────────────────────────────────────────────
    if (m==="COMMAND") {
      e.preventDefault();
      if (e.key==="Escape") { setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); setStatus(""); draw(); return; }
      if (e.key==="Enter")  { runCmd(s,s.cmdBuf); setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); draw(); return; }
      if (e.key==="Backspace"){ s.cmdBuf=s.cmdBuf.slice(0,-1); setCmdBuf(s.cmdBuf); draw(); return; }
      if (e.key==="Tab") {
        const tm=s.cmdBuf.match(/^(tag[+-]?\s+)(\S*)$/);
        if(tm){ const p=tm[2].replace(/^#/,""); const hit=allTags.find(t=>t.startsWith(p)&&t!==p); if(hit){s.cmdBuf=tm[1]+hit; setCmdBuf(s.cmdBuf);} }
        draw(); return;
      }
      if (e.key.length===1){ s.cmdBuf+=e.key; setCmdBuf(s.cmdBuf); draw(); return; }
      return;
    }

    // ── SEARCH ───────────────────────────────────────────────────────────────
    if (m==="SEARCH") {
      e.preventDefault();
      if (e.key==="Escape") { setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); buildMatches(s,""); draw(); return; }
      if (e.key==="Enter")  { buildMatches(s,s.cmdBuf); jumpMatch(s,0); setMode("NORMAL"); s.cmdBuf=""; setCmdBuf(""); draw(); return; }
      if (e.key==="Backspace"){ s.cmdBuf=s.cmdBuf.slice(0,-1); setCmdBuf(s.cmdBuf); draw(); return; }
      if (e.key.length===1)   { s.cmdBuf+=e.key; setCmdBuf(s.cmdBuf); draw(); return; }
      return;
    }

    // ── NORMAL ───────────────────────────────────────────────────────────────
    e.preventDefault();
    const {row,col}=s.cur; const line=s.lines[row];

    switch(e.key) {
      case "i": setMode("INSERT"); break;
      case "I": setMode("INSERT"); s.cur.col=0; break;
      case "a": setMode("INSERT"); s.cur.col=Math.min(col+1,line.length); break;
      case "A": setMode("INSERT"); s.cur.col=line.length; break;
      case "o": s.lines.splice(row+1,0,"  ".repeat(Math.floor((line.match(/^( *)/)[1].length)/2))); s.cur.row++; s.cur.col=s.lines[s.cur.row].length; setMode("INSERT"); break;
      case "O": s.lines.splice(row,0,"  ".repeat(Math.floor((line.match(/^( *)/)[1].length)/2))); s.cur.col=s.lines[row].length; setMode("INSERT"); break;
      case ":": setMode("COMMAND"); s.cmdBuf=""; setCmdBuf(""); break;
      case "/": setMode("SEARCH");  s.cmdBuf=""; setCmdBuf(""); break;
      case "h": case "ArrowLeft":  s.cur.col=Math.max(0,col-1); break;
      case "l": case "ArrowRight": s.cur.col=Math.min(line.length,col+1); break;
      case "j": case "ArrowDown":  if(row<s.lines.length-1){s.cur.row++;s.cur.col=Math.min(col,s.lines[s.cur.row].length);} break;
      case "k": case "ArrowUp":    if(row>0){s.cur.row--;s.cur.col=Math.min(col,s.lines[s.cur.row].length);} break;
      case "w": { const rest=line.slice(col+1); const m2=rest.search(/\b\w/); if(m2>=0)s.cur.col=col+1+m2; else if(row<s.lines.length-1){s.cur.row++;s.cur.col=0;} break; }
      case "b": { const before=line.slice(0,col); const m2=before.search(/\w+$/); if(m2>=0)s.cur.col=m2; else if(row>0){s.cur.row--;s.cur.col=s.lines[s.cur.row].length;} break; }
      case "0": s.cur.col=0; break;
      case "$": s.cur.col=line.length; break;
      case "g": s.cur.row=0; s.cur.col=0; break;
      case "G": s.cur.row=s.lines.length-1; s.cur.col=0; break;
      case "n": jumpMatch(s,1); break;
      case "N": jumpMatch(s,-1); break;
      // Tab in NORMAL: inspringen (mermaid-specifiek)
      case "Tab":
        { const ind=line.match(/^( *)/)[1]; s.lines[row]="  "+line; s.cur.col+=2; scheduleUndo(s); emit(s); break; }
      // Shift+Tab: uitspringen
      case "S":
        if(e.shiftKey){ const ind=line.slice(0,2)==="  "?line.slice(2):line; s.lines[row]=ind; s.cur.col=Math.max(0,col-2); scheduleUndo(s); emit(s); } break;
      case "x": if(col<line.length){s.yank=line[col]; pushUndo(s); s.lines[row]=line.slice(0,col)+line.slice(col+1); emit(s);} break;
      case "d": s.yank=line; pushUndo(s); s.lines.splice(row,1); if(s.lines.length===0)s.lines=[""]; clamp(); emit(s); break;
      case "D": pushUndo(s); s.lines[row]=line.slice(0,col); emit(s); break;
      case "y": s.yank=line; setStatus("gekopieerd"); break;
      case "p": pushUndo(s); s.lines.splice(row+1,0,s.yank); s.cur.row++; s.cur.col=0; emit(s); break;
      case "P": pushUndo(s); s.lines.splice(row,0,s.yank); s.cur.col=0; emit(s); break;
      case "u": if(s.undoIdx>0){s.undoIdx--;s.lines=s.undo[s.undoIdx].slice();clamp();emit(s);setStatus("undo");} break;
      case "r": if(e.ctrlKey&&s.undoIdx<s.undo.length-1){s.undoIdx++;s.lines=s.undo[s.undoIdx].slice();clamp();emit(s);setStatus("redo");} break;
      case " ": setStatus(""); buildMatches(s,""); break;
      case "Escape": setStatus(""); break;
    }
    clamp(); scrollToCursor(s); draw();
  }, [allTags, noteTags, onTagsChange, runCmd]);

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const s=S.current; if(s.mode!=="INSERT") return;
    const text=e.clipboardData.getData("text");
    text.split("\n").forEach((ln,i)=>{
      if(i===0){ insertChar(s,ln); }
      else {
        const {row,col}=s.cur; const rest=s.lines[row].slice(col);
        s.lines[row]=s.lines[row].slice(0,col); s.lines.splice(row+1,0,ln);
        s.cur.row++; s.cur.col=ln.length;
        if(i===text.split("\n").length-1) s.lines[s.cur.row]+=rest;
      }
    });
    scheduleUndo(s); emit(s); scrollToCursor(s); draw();
  }, []);

  // ── Draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawFrame);
  }, []);

  // Bouw per-regel kleurinformatie (tak-index) voor canvas drawLine
  const buildLineColors = (lines) => {
    let bi=0, bd=null; const lbi=[];
    lines.forEach(line=>{
      const t=line.trimEnd();
      if(!t||t.toLowerCase().startsWith("mindmap")){lbi.push(-2);return;}
      const depth=Math.floor((line.match(/^( *)/)[1].length)/2);
      if(depth===1){lbi.push(-1);bi=0;bd=null;}
      else if(depth===2){if(bd!==null)bi++;bd=2;lbi.push(bi);}
      else{lbi.push(bd!==null?bi:0);}
    });
    return lbi;
  };

  // Teken één regel met syntax kleuring op canvas
  const drawMermaidLine = (ctx, line, x, y, cw, isCur, branchIdx, lineColors) => {
    if (!line) return;
    const depth  = Math.floor((line.match(/^( *)/)[1].length)/2);
    const rest   = line.slice(depth*2);
    const idx    = branchIdx;

    // Indent guides — verticale lijnen (zelfde logica als highlight())
    for (let lvl=0; lvl<depth; lvl++) {
      const isLast = lvl===depth-1;
      const branchCol = idx>=0 ? MM_PALETTE[idx%MM_PALETTE.length] : W.fgMuted;
      const lineCol = isLast ? branchCol+"99" : "rgba(255,255,255,0.08)";
      ctx.fillStyle = lineCol;
      ctx.fillRect(x + lvl*2*cw, y, 1, LINE_H2);
    }

    const drawSpan = (text, color, bold=false, sx) => {
      ctx.fillStyle = color;
      ctx.font = bold ? `bold ${FONT_SZ}px 'Hack','Courier New',monospace`
                      : `${FONT_SZ}px 'Hack','Courier New',monospace`;
      ctx.fillText(text, sx, y+4);
      ctx.font = `${FONT_SZ}px 'Hack','Courier New',monospace`;
    };

    const tx = x + depth*2*cw; // tekst-x na inspring

    if (idx===-2) {
      // mindmap header
      drawSpan(line, W.fgMuted, false, x);
      return;
    }
    if (idx===-1) {
      // root node
      const rootM = rest.match(/^(root)(\(\()(.*)(\)\))(.*)$/);
      if (rootM) {
        let cx = tx;
        drawSpan(rootM[1], W.fgMuted, false, cx); cx+=rootM[1].length*cw;
        drawSpan(rootM[2], "rgba(255,255,255,0.3)", false, cx); cx+=rootM[2].length*cw;
        drawSpan(rootM[3], W.blue, true, cx); cx+=rootM[3].length*cw;
        drawSpan(rootM[4], "rgba(255,255,255,0.3)", false, cx); cx+=rootM[4].length*cw;
        if(rootM[5]) drawSpan(rootM[5], W.fg, false, cx);
      } else {
        drawSpan(rest, W.blue, true, tx);
      }
      return;
    }

    // tak/sub-node
    const col = MM_PALETTE[idx%MM_PALETTE.length];
    const opHex = depth===2?"ff":depth===3?"cc":depth===4?"99":"77";
    const finalCol = col+opHex;

    const bracM = rest.match(/^(\(\()(.*)(\)\))(.*)$/) ||
                  rest.match(/^(\()(.*)(\))(.*)$/)      ||
                  rest.match(/^(\[)(.*)(\])(.*)$/);
    if (bracM) {
      let cx=tx;
      drawSpan(bracM[1], "rgba(255,255,255,0.3)", false, cx); cx+=bracM[1].length*cw;
      drawSpan(bracM[2], finalCol, depth<=2, cx); cx+=bracM[2].length*cw;
      drawSpan(bracM[3], "rgba(255,255,255,0.3)", false, cx); cx+=bracM[3].length*cw;
      if(bracM[4]) drawSpan(bracM[4], W.fgDim, false, cx);
    } else {
      drawSpan(rest, finalCol, depth<=2, tx);
    }
  };

  const drawFrame = useCallback(() => {
    const cv=cvRef.current; if(!cv) return;
    const ctx=cv.getContext("2d");
    const dpr=window.devicePixelRatio||1;
    const CW=cv.width/dpr; const CH=cv.height/dpr;
    const s=S.current;
    const cw=s.charW;
    const {row:curRow,col:curCol}=s.cur;

    ctx.font=`${FONT_SZ}px 'Hack','Courier New',monospace`;
    ctx.textBaseline="top";

    // Achtergrond
    ctx.fillStyle=W.bg; ctx.fillRect(0,0,CW,CH);

    // ── Cursorline (horizontaal) + cursorcolumn (verticaal) ────────────────
    const cyPos=(curRow-s.scroll)*LINE_H2;
    const cxPos=PAD_L+curCol*cw;
    if(curRow>=s.scroll && curRow<s.scroll+s.visRows+1){
      ctx.fillStyle="rgba(255,255,255,0.055)";
      ctx.fillRect(0, cyPos, CW, LINE_H2);
    }
    ctx.fillStyle="rgba(255,255,255,0.035)";
    ctx.fillRect(cxPos, 0, cw, CH-LINE_H2);

    // ── Regels ────────────────────────────────────────────────────────────
    const lineColors = buildLineColors(s.lines);
    for(let i=0; i<=s.visRows; i++){
      const li=i+s.scroll;
      if(li>=s.lines.length) break;
      const y=i*LINE_H2;
      const line=s.lines[li];

      // Zoek-highlights
      if(s.search && s.matches.length){
        s.matches.filter(m=>m.row===li).forEach((m,mi)=>{
          const isActive=mi===s.matchIdx&&s.matches[s.matchIdx].row===li;
          ctx.fillStyle=isActive?"rgba(234,231,136,0.5)":"rgba(138,198,242,0.2)";
          ctx.fillRect(PAD_L+m.col*cw, y, s.search.length*cw, LINE_H2);
        });
      }

      drawMermaidLine(ctx, line, PAD_L, y, cw, li===curRow, lineColors[li], lineColors);
    }

    // ── Cursor ─────────────────────────────────────────────────────────────
    if(curRow>=s.scroll && curRow<s.scroll+s.visRows+1){
      const cx=PAD_L+curCol*cw;
      const cy=(curRow-s.scroll)*LINE_H2;
      if(s.mode==="INSERT"){
        if(blinkOn.current){ ctx.fillStyle=W.cursorBg; ctx.fillRect(cx-1,cy+2,2,LINE_H2-4); }
      } else {
        const bColor=s.mode==="COMMAND"?W.orange:s.mode==="SEARCH"?W.purple:W.cursorBg;
        ctx.globalAlpha=blinkOn.current?0.9:0.4;
        ctx.fillStyle=bColor; ctx.fillRect(cx,cy,cw,LINE_H2);
        ctx.globalAlpha=1;
        const ch=(s.lines[curRow]||"")[curCol]||" ";
        ctx.fillStyle=W.bg; ctx.fillText(ch,cx,cy+4);
      }
    }

    // ── Statusbalk — identiek aan VimEditor ───────────────────────────────
    const sbY=CH-LINE_H2;
    ctx.fillStyle=W.statusBg; ctx.fillRect(0,sbY,CW,LINE_H2);

    const modeLabel=` ${s.mode} `;
    const modeColor=s.mode==="INSERT"?W.comment:s.mode==="COMMAND"?W.orange:s.mode==="SEARCH"?W.purple:W.blue;
    const badgeW=modeLabel.length*cw+4;
    ctx.fillStyle=modeColor; ctx.fillRect(0,sbY,badgeW,LINE_H2);
    ctx.fillStyle=W.bg;
    ctx.font=`bold ${FONT_SZ}px 'Hack','Courier New',monospace`;
    ctx.fillText(modeLabel,2,sbY+4);
    ctx.font=`${FONT_SZ}px 'Hack','Courier New',monospace`;

    let stxt="";
    if(s.mode==="COMMAND") stxt=":"+s.cmdBuf+"█";
    else if(s.mode==="SEARCH") stxt="/"+s.cmdBuf+"█";
    else if(statusMsg) stxt="  "+statusMsg;
    else if(s.mode==="INSERT") stxt="  -- INSERT --  Esc=NORMAL  Tab=inspringing  Enter=nieuwe regel";
    else stxt=`  ${s.lines.length}L  |  i=INSERT  :tag+=naam  :tag-=naam  /=zoeken  dd=delete  u=undo`;

    ctx.fillStyle=W.fgMuted; ctx.fillText(stxt,badgeW+6,sbY+4);
    const posStr=`${curRow+1}:${curCol+1}`;
    ctx.textAlign="right"; ctx.fillStyle=W.fgDim; ctx.fillText(posStr,CW-6,sbY+4);
    ctx.textAlign="left";
  }, [statusMsg]);

  return React.createElement("div",{
    style:{flex:1, position:"relative", overflow:"hidden", background:W.bg},
    // Klik op de container (ook buiten canvas) → focus naar hidden input
    onClick: () => inputRef.current?.focus(),
    onFocus: () => inputRef.current?.focus(),
    tabIndex: -1,
  },
    React.createElement("canvas",{
      ref:cvRef,
      style:{display:"block", outline:"none"},
      tabIndex: 0,
      // Canvas focus → stuur door naar input
      onFocus: () => inputRef.current?.focus(),
    }),
    React.createElement("input",{
      ref:inputRef, onKeyDown:handleKey, onPaste:handlePaste,
      readOnly:true,
      style:{position:"absolute",top:0,left:0,width:"1px",height:"1px",
             opacity:0,border:"none",outline:"none",padding:0,
             fontSize:"1px"},
      tabIndex: -1,
    })
  );
};

// ── Mermaid Mindmap Editor (split: code | preview) ───────────────────────────
const MermaidEditor = ({ initialText="", onSave, onCancel, notes=[], serverPdfs=[], serverImages=[] }) => {
  const DEFAULT = `mindmap\n  root((Mijn Mindmap))\n    Tak A\n      Sub A1\n      Sub A2\n    Tak B\n      Sub B1\n    Tak C`;
  const [code, setCode]               = React.useState(initialText || DEFAULT);
  const [title, setTitle]             = React.useState("");
  const [tags, setTags]               = React.useState(["mindmap"]);
  const [saving, setSaving]           = React.useState(false);
  const [saveMsg, setSaveMsg]         = React.useState("");
  const [showLink, setShowLink]       = React.useState(false);
  const [linkSearch, setLinkSearch]   = React.useState("");
  const [linkType, setLinkType]       = React.useState("all");
  const containerRef                  = React.useRef(null);
  const editorRef                     = React.useRef(null);   // {insertAtCursor}
  const [previewSize, setPreviewSize] = React.useState({w:400, h:400});

  // Sluit link-dropdown bij klik buiten
  React.useEffect(() => {
    if (!showLink) return;
    const h = () => { setShowLink(false); setLinkSearch(""); };
    setTimeout(() => document.addEventListener("click", h), 0);
    return () => document.removeEventListener("click", h);
  }, [showLink]);

  // Resize observer preview canvas
  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => {
      const r = e[0];
      if (r) setPreviewSize({w: r.contentRect.width, h: r.contentRect.height});
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Automatisch titel afleiden uit root-node
  React.useEffect(() => {
    const nodes = parseMermaidMindmap(code);
    if (nodes[0] && !title) setTitle("Mindmap — " + nodes[0].label);
  }, []);

  const handleSave = async () => {
    if (!onSave || saving) return;
    setSaving(true);
    const ns = parseMermaidMindmap(code);
    const noteTitle = title || "Mindmap — " + (ns[0]?.label || "mindmap");
    const content = `\`\`\`mindmap\n${code}\n\`\`\``;
    try {
      await onSave({ title: noteTitle, content, tags });
      setSaveMsg("✓ Opgeslagen");
      setTimeout(() => { setSaveMsg(""); if(onCancel) onCancel(); }, 1200);
    } catch(e) {
      setSaveMsg("⚠ " + e.message);
    }
    setSaving(false);
  };

  // Voeg link in op huidige cursorpositie in de code-editor
  const insertLink = (linkText) => {
    editorRef.current?.insertAtCursor(linkText);
    setShowLink(false);
    setLinkSearch("");
  };

  // ── Preview toggle + nieuw mindmap state (voor linkDropdown) ───────────────
  const [showPreview, setShowPreview] = React.useState(true);
  const [editorMode, setEditorMode]   = React.useState("INSERT");

  const enterInsert = () => {
    editorRef.current?.focus();
    editorRef.current?.triggerInsert?.();
  };

  const newMindmap = () => {
    const NW = `mindmap\n  root((Nieuwe Mindmap))\n    Tak A\n      Sub A1\n    Tak B`;
    setCode(NW);
    setTitle("");
    setTimeout(() => { editorRef.current?.focus(); editorRef.current?.triggerInsert?.(); }, 60);
  };

  // ── Link dropdown (identiek aan notitie-editor) ───────────────────────────
  const linkDropdown = showLink && React.createElement("div",{
    style:{position:"absolute", top:"calc(100% + 4px)", right:0, zIndex:210,
           background:W.bg2, border:`1px solid ${W.splitBg}`, borderRadius:"8px",
           width:"300px", maxHeight:"420px", display:"flex", flexDirection:"column",
           boxShadow:"0 8px 32px rgba(0,0,0,0.75)"}
  },
    // Type-filter tabs
    React.createElement("div",{style:{display:"flex",borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}},
      [["all","Alles"],["notes","📝 Notities"],["pdf","📄 PDF"],["images","🖼 Plaatjes"]].map(([id,lbl])=>
        React.createElement("button",{key:id, onClick:()=>setLinkType(id),
          style:{flex:1, background:linkType===id?"rgba(138,198,242,0.12)":"none",
                 border:"none", borderBottom:linkType===id?`2px solid ${W.blue}`:"2px solid transparent",
                 color:linkType===id?W.blue:W.fgMuted,
                 fontSize:"9px", padding:"7px 2px", cursor:"pointer", letterSpacing:"0.3px"}
        }, lbl)
      )
    ),
    // Zoekbalk
    React.createElement("div",{style:{padding:"7px 10px",borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}},
      React.createElement("input",{
        autoFocus:true, value:linkSearch,
        onChange:e=>setLinkSearch(e.target.value),
        placeholder:"Zoeken…",
        style:{width:"100%", background:"rgba(255,255,255,0.06)",
               border:`1px solid ${W.splitBg}`, borderRadius:"5px",
               padding:"5px 9px", color:W.fg, fontSize:"14px",
               outline:"none", fontFamily:"inherit"}
      })
    ),
    // Resultatenlijst
    React.createElement("div",{style:{overflowY:"auto",flex:1}},
      // Notities
      (linkType==="all"||linkType==="notes") && (() => {
        const ns = notes.filter(n =>
          !linkSearch || n.title?.toLowerCase().includes(linkSearch.toLowerCase()) ||
          (n.tags||[]).some(t=>t.includes(linkSearch.toLowerCase()))
        ).slice(0,20);
        if (!ns.length) return null;
        return React.createElement(React.Fragment,null,
          linkType==="all" && React.createElement("div",{style:{
            padding:"5px 12px 3px", fontSize:"9px", color:W.fgMuted,
            letterSpacing:"1.5px", background:"rgba(0,0,0,0.2)"
          }},"NOTITIES"),
          ns.map(n => React.createElement("div",{key:n.id,
            onMouseDown: e => { e.preventDefault(); insertLink("[["+n.title+"]]"); },
            style:{padding:"7px 12px", cursor:"pointer",
                   borderBottom:`1px solid rgba(255,255,255,0.03)`,
                   display:"flex", flexDirection:"column", gap:"1px"}
          },
            React.createElement("span",{style:{fontSize:"14px",color:W.fg,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},n.title),
            (n.tags||[]).length>0 && React.createElement("div",{
              style:{display:"flex",gap:"3px",flexWrap:"wrap",marginTop:"2px"}},
              (n.tags||[]).slice(0,4).map(t=>React.createElement("span",{key:t,style:{
                fontSize:"11px",color:"#b8e06a",fontWeight:"500",
                background:"rgba(159,202,86,0.13)",
                border:"1px solid rgba(159,202,86,0.35)",
                borderRadius:"4px",padding:"1px 6px",lineHeight:"1.3",
              }},"#"+t)))
          ))
        );
      })(),
      // PDFs
      (linkType==="all"||linkType==="pdf") && (() => {
        const ps = serverPdfs.filter(p =>
          !linkSearch || p.name.toLowerCase().includes(linkSearch.toLowerCase())
        ).slice(0,15);
        if (!ps.length) return null;
        return React.createElement(React.Fragment,null,
          linkType==="all" && React.createElement("div",{style:{
            padding:"5px 12px 4px", fontSize:"11px", color:W.orange,
            letterSpacing:"1.2px", fontWeight:"600", background:"rgba(0,0,0,0.2)"
          }},"PDF"),
          ps.map(p => React.createElement("div",{key:p.name,
            onMouseDown: e => { e.preventDefault(); insertLink("[[pdf:"+p.name+"]]"); },
            style:{padding:"7px 12px", cursor:"pointer",
                   borderBottom:`1px solid rgba(255,255,255,0.03)`,
                   display:"flex", alignItems:"center", gap:"8px"}
          },
            React.createElement("span",{style:{fontSize:"14px"}},"📄"),
            React.createElement("span",{style:{fontSize:"14px",color:W.fgDim,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}},p.name)
          ))
        );
      })(),
      // Afbeeldingen
      (linkType==="all"||linkType==="images") && (() => {
        const imgs = serverImages.filter(i =>
          !linkSearch || i.name.toLowerCase().includes(linkSearch.toLowerCase())
        ).slice(0,15);
        if (!imgs.length) return null;
        return React.createElement(React.Fragment,null,
          linkType==="all" && React.createElement("div",{style:{
            padding:"5px 12px 4px", fontSize:"11px", color:W.blue,
            letterSpacing:"1.2px", fontWeight:"600", background:"rgba(0,0,0,0.2)"
          }},"AFBEELDINGEN"),
          imgs.map(img => React.createElement("div",{key:img.name,
            onMouseDown: e => { e.preventDefault(); insertLink("![[img:"+img.name+"]]"); },
            style:{padding:"7px 12px", cursor:"pointer",
                   borderBottom:`1px solid rgba(255,255,255,0.03)`,
                   display:"flex", alignItems:"center", gap:"8px"}
          },
            React.createElement("span",{style:{fontSize:"14px"}},"🖼"),
            React.createElement("span",{style:{fontSize:"14px",color:W.fgDim,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}},img.name)
          ))
        );
      })(),
      // Lege staat
      [notes, serverPdfs, serverImages].every(arr =>
        !arr.filter(x => !linkSearch || (x.title||x.name||"").toLowerCase().includes(linkSearch.toLowerCase())).length
      ) && React.createElement("div",{style:{padding:"20px",color:W.fgMuted,
        fontSize:"14px",textAlign:"center"}},"Geen resultaten")
    )
  );

  return React.createElement("div",{style:{
    display:"flex", flexDirection:"column", width:"100%", height:"100%", overflow:"hidden",
    background:W.bg
  }},

    // ── Toolbar — identiek aan notitie-editor ────────────────────────────────
    React.createElement("div",{style:{
      background:W.bg2, borderBottom:`1px solid ${W.splitBg}`,
      padding:"6px 10px", display:"flex",
      alignItems:"center", gap:"6px", flexShrink:0,
    }},
      // Titel
      React.createElement("input",{
        value:title, onChange:e=>setTitle(e.target.value),
        placeholder:"Mindmap titel…",
        onKeyDown:e=>{ if(e.key==="Enter"){ e.preventDefault(); editorRef.current?.focus(); editorRef.current?.triggerInsert?.(); } },
        style:{
          flex:1, minWidth:"120px", background:"transparent",
          border:"none", color:W.statusFg,
          fontSize:"16px", fontWeight:"bold", outline:"none",
          WebkitAppearance:"none",
        }
      }),
      // Tags
      React.createElement(SmartTagEditor,{tags, onChange:setTags, allTags:["mindmap","ai","overzicht"]}),

      // ── Knoppen — zelfde stijl/volgorde als notitie-editor ──────────────
      // ✏ bewerken — brengt editor naar INSERT mode; licht op als INSERT actief
      React.createElement("button",{
        onClick: enterInsert,
        title: "Klik om te bewerken (INSERT mode) — of druk 'i' in de editor",
        style:{
          background: editorMode==="INSERT" ? "rgba(159,202,86,0.12)" : "none",
          border: `1px solid ${editorMode==="INSERT" ? W.comment : W.splitBg}`,
          borderRadius:"6px", padding:"4px 10px",
          color: editorMode==="INSERT" ? W.comment : W.fgMuted,
          fontSize:"14px", cursor:"pointer", flexShrink:0,
        }
      }, "✏ bewerken"),

      // 🔗 koppelen
      React.createElement("div",{style:{position:"relative",flexShrink:0}, onClick:e=>e.stopPropagation()},
        React.createElement("button",{
          onClick:()=>{ setShowLink(v=>!v); setLinkSearch(""); setLinkType("all"); },
          title:"Link invoegen op cursorpositie",
          style:{
            background: showLink?"rgba(138,198,242,0.15)":"none",
            border:`1px solid ${showLink?"rgba(138,198,242,0.4)":W.splitBg}`,
            borderRadius:"6px", padding:"4px 10px",
            color: showLink?W.blue:W.fgMuted,
            fontSize:"14px", cursor:"pointer", flexShrink:0,
          }
        }, "🔗 koppelen"),
        linkDropdown
      ),

      // ⊞/⊟ preview
      React.createElement("button",{
        onClick:()=>setShowPreview(v=>!v),
        title: showPreview ? "Preview verbergen" : "Preview tonen",
        style:{
          background: showPreview?"rgba(138,198,242,0.1)":"none",
          border:`1px solid ${showPreview?"rgba(138,198,242,0.35)":W.splitBg}`,
          borderRadius:"6px", padding:"4px 10px",
          color: showPreview?W.blue:W.fgMuted,
          fontSize:"14px", cursor:"pointer", flexShrink:0,
        }
      }, showPreview ? "⊟ preview" : "⊞ preview"),

      // ✓ opslaan
      React.createElement("button",{
        onClick:handleSave, disabled:saving,
        style:{
          background:W.comment, border:`1px solid ${W.comment}`,
          borderRadius:"6px", padding:"4px 10px",
          color:W.bg, fontSize:"14px", fontWeight:"bold",
          cursor:saving?"default":"pointer", flexShrink:0,
        }
      }, saving ? "⏳…" : "✓ opslaan"),

      saveMsg && React.createElement("span",{style:{
        fontSize:"14px", flexShrink:0,
        color:saveMsg.startsWith("✓")?W.comment:W.orange,
      }}, saveMsg),

      // ✕ sluiten
      onCancel && React.createElement("button",{
        onClick:onCancel,
        style:{
          background:"none", border:`1px solid ${W.splitBg}`,
          borderRadius:"6px", padding:"4px 10px",
          color:W.fgMuted, fontSize:"14px",
          cursor:"pointer", flexShrink:0,
        }
      }, "✕ sluiten"),
    ),

    // ── Split: editor | preview ──────────────────────────────────────────────
    React.createElement("div",{style:{flex:1, display:"flex", overflow:"hidden"}},

      // Code editor (neemt volledige breedte als preview verborgen)
      React.createElement("div",{style:{
        width: showPreview ? "42%" : "100%",
        flexShrink:0, display:"flex", flexDirection:"column",
        borderRight: showPreview ? `1px solid ${W.splitBg}` : "none",
        transition:"width 0.2s",
      }},
        React.createElement(MermaidCodeEditor, {
          value: code,
          onChange: setCode,
          editorRef,
          noteTags: tags,
          onTagsChange: setTags,
          allTags: ["mindmap","ai","overzicht","notitie","pdf","import"],
          onModeChange: setEditorMode,
        })
      ),

      // Preview canvas — verborgen als showPreview false
      showPreview && React.createElement("div",{
        ref:containerRef,
        style:{flex:1, position:"relative", background:W.bg, overflow:"hidden"}
      },
        React.createElement(MermaidCanvas,{
          text:code, width:previewSize.w||400, height:previewSize.h||400,
          interactive:true
        })
      )
    )
  );
};

const MindMap = ({notes, allTags, onSelectNote, aiMindmap, onAddNote, serverPdfs=[], serverImages=[]}) => {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  // ── Node state ────────────────────────────────────────────────────────────
  // Elke node: {id, label, type:'root'|'tag'|'note'|'branch'|'sub'|'detail', x, y, parentId, noteId?, color?}
  const [nodes,      setNodes]     = useState([]);
  const [edges,      setEdges]     = useState([]);
  const [selId,      setSelId]     = useState(null);
  const [editingId,  setEditingId] = useState(null);
  const [editLabel,  setEditLabel] = useState("");
  const [zoom,       setZoom]      = useState(1);
  const [pan,        setPan]       = useState({x:0, y:0});
  const [mode,       setMode]      = useState("view");
  const [layout,     setLayout]    = useState("radial");
  const [showTags,   setShowTags]  = useState(true);
  const [showNotes,  setShowNotes] = useState(true);
  const [tagFilter,  setTagFilter] = useState(null);
  const [aiMode,     setAiMode]    = useState(false);  // toon AI mindmap ipv vault
  const [mmView,     setMmView]    = useState("canvas"); // "canvas" | "mermaid"
  const [editMermaid,setEditMermaid]=useState(null);   // null = nieuw, string = bestaande code

  const cvRef     = useRef(null);
  const dragRef   = useRef(null);   // {nodeId, startX, startY, origX, origY}
  const panRef    = useRef(null);   // {startX, startY, origPanX, origPanY}
  const afRef     = useRef(null);
  const editRef   = useRef(null);
  const nodesRef  = useRef([]);     // voor canvas rendering
  const edgesRef  = useRef([]);
  const selRef    = useRef(null);
  const mmCentredRef = useRef(false); // centrering al gedaan voor huidige layout

  // Sync refs
  nodesRef.current = nodes;
  edgesRef.current = edges;
  selRef.current   = selId;

  // ── Tag kleur palet ───────────────────────────────────────────────────────
  const tagColorMap = useMemo(() => {
    const palette = [W.blue, W.comment, W.orange, W.purple,
                     W.string, W.type, W.keyword, "#e8d44d"];
    const map = {};
    allTags.forEach((t,i) => { map[t] = palette[i % palette.length]; });
    return map;
  }, [allTags]);

  // ── Bouw mindmap op basis van notities + tags ─────────────────────────────
  const buildLayout = useCallback(() => {
    const cv = cvRef.current; if (!cv) return;
    const dpr = window.devicePixelRatio||1;
    const CW = cv.clientWidth  || cv.width/dpr  || 800;
    const CH = cv.clientHeight || cv.height/dpr || 600;
    const cx = CW / 2, cy = CH / 2;

    const visibleTags = tagFilter ? [tagFilter]
      : (showTags ? allTags : []);

    const newNodes = [];
    const newEdges = [];

    // Root node
    const root = {id:"root", label:"Zettelkasten", fullLabel:"Zettelkasten", type:"root",
                  x:cx, y:cy, fixed:true};
    newNodes.push(root);

    if (layout === "radial") {
      // Radiale layout: tags als eerste ring, notities als tweede ring
      const tagCount = visibleTags.length;
      visibleTags.forEach((tag, ti) => {
        const angle = (ti / tagCount) * Math.PI * 2 - Math.PI/2;
        const tx = cx + MM_RADIUS * Math.cos(angle);
        const ty = cy + MM_RADIUS * Math.sin(angle);
        const tagNode = {
          id: "tag-"+tag, label:"#"+tag, fullLabel:tag, type:"tag",
          x: tx, y: ty, color: tagColorMap[tag]||W.comment,
          parentId:"root"
        };
        newNodes.push(tagNode);
        newEdges.push({from:"root", to:"tag-"+tag});

        if (showNotes) {
          const tagNotes = notes.filter(n => (n.tags||[]).includes(tag));
          const nCount   = tagNotes.length;
          tagNotes.forEach((note, ni) => {
            const spread  = Math.min(Math.PI * 0.8, (nCount * 0.35));
            const leafAngle = angle - spread/2 + (nCount>1 ? (ni/(nCount-1))*spread : 0);
            // Al toegevoegd? Gebruik bestaande positie
            const existingNode = newNodes.find(n => n.id === "note-"+note.id);
            if (!existingNode) {
              newNodes.push({
                id:      "note-"+note.id,
                label:   note.title?.length > 20 ? note.title.slice(0,18)+"…" : (note.title||"–"),
                fullLabel: note.title || "–",
                type:    "note",
                x:       tx + MM_LEAF_R * Math.cos(leafAngle),
                y:       ty + MM_LEAF_R * Math.sin(leafAngle),
                noteId:  note.id,
                color:   tagColorMap[tag]||W.keyword,
                parentId:"tag-"+tag,
              });
              newEdges.push({from:"tag-"+tag, to:"note-"+note.id});
            } else {
              // Extra edge van andere tag naar dezelfde notitie
              newEdges.push({from:"tag-"+tag, to:"note-"+note.id, secondary:true});
            }
          });
        }
      });

      // Notities zonder tags
      if (showNotes) {
        const untagged = notes.filter(n => !(n.tags||[]).length ||
          !(n.tags||[]).some(t => visibleTags.includes(t)));
        if (untagged.length > 0) {
          const utAngle = tagCount > 0 ? (tagCount/(tagCount+1)) * Math.PI*2 - Math.PI/2
                                       : 0;
          const utNode = {id:"untagged", label:"zonder tag", type:"tag",
                          x: cx + MM_RADIUS * Math.cos(utAngle),
                          y: cy + MM_RADIUS * Math.sin(utAngle),
                          color: W.fgMuted, parentId:"root"};
          newNodes.push(utNode);
          newEdges.push({from:"root", to:"untagged"});
          untagged.slice(0,15).forEach((note,ni) => {
            const spread = Math.min(Math.PI*0.8, untagged.length*0.3);
            const la = utAngle - spread/2 + (untagged.length>1?(ni/(untagged.length-1))*spread:0);
            newNodes.push({
              id:"note-"+note.id, label:note.title?.slice(0,18)||(note.title||"–"),
              fullLabel:note.title||"–", type:"note",
              x:utNode.x + MM_LEAF_R*Math.cos(la),
              y:utNode.y + MM_LEAF_R*Math.sin(la),
              noteId:note.id, color:W.fgDim, parentId:"untagged"
            });
            newEdges.push({from:"untagged", to:"note-"+note.id});
          });
        }
      }
    } else if (layout === "tree") {
      // Horizontale boom naar rechts: root links, tags als kolom, notities rechts
      const tagCount = visibleTags.length;
      const rootX  = 80;
      const tagX   = 260;
      const noteX  = 440;
      const tGap   = Math.min(80, (CH - 80) / Math.max(tagCount, 1));
      const tStartY = cy - ((tagCount-1)/2) * tGap;

      // Root naar links
      newNodes[0].x = rootX;
      newNodes[0].y = cy;

      visibleTags.forEach((tag, ti) => {
        const ty = tStartY + ti * tGap;
        const tagNode = {id:"tag-"+tag, label:"#"+tag, fullLabel:tag, type:"tag",
                         x:tagX, y:ty, color:tagColorMap[tag]||W.comment, parentId:"root"};
        newNodes.push(tagNode);
        newEdges.push({from:"root", to:"tag-"+tag});

        if (showNotes) {
          const tagNotes = notes.filter(n=>(n.tags||[]).includes(tag));
          const nGap = Math.min(55, tGap / Math.max(tagNotes.length, 1));
          const nStartY = ty - ((tagNotes.length-1)/2) * nGap;
          tagNotes.forEach((note, ni) => {
            if (newNodes.find(n=>n.id==="note-"+note.id)) {
              newEdges.push({from:"tag-"+tag, to:"note-"+note.id, secondary:true});
              return;
            }
            newNodes.push({
              id:"note-"+note.id, label:note.title?.slice(0,18)||"–",
              fullLabel:note.title||"–", type:"note",
              x: noteX, y: nStartY + ni * nGap,
              noteId:note.id, color:tagColorMap[tag]||W.keyword, parentId:"tag-"+tag
            });
            newEdges.push({from:"tag-"+tag, to:"note-"+note.id});
          });
        }
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
    mmCentredRef.current = false; // volgende resize centreert opnieuw
    setZoom(0.85);
  }, [notes, allTags, tagFilter, showTags, showNotes, layout, tagColorMap]);

  useEffect(() => { buildLayout(); }, [buildLayout]);

  // Na elke layout-rebuild: centreer opnieuw zodra canvas klaar is
  useEffect(() => {
    if (!nodes.length) return;
    const cv = cvRef.current; if (!cv) return;
    const attempt = (tries = 0) => {
      const p = cv.parentElement; if (!p) return;
      const w = p.offsetWidth || p.clientWidth || p.getBoundingClientRect().width;
      const h = p.offsetHeight || p.clientHeight || p.getBoundingClientRect().height;
      if (!w || !h) {
        if (tries < 10) setTimeout(() => attempt(tries + 1), 50);
        return;
      }
      const root = nodesRef.current.find(n => n.id === "root");
      if (!root) return;
      const z = 0.85;
      setPan({ x: w/2 - root.x * z, y: h/2 - root.y * z });
    };
    setTimeout(attempt, 0);
  }, [nodes]);

  // ── AI mindmap layout (3-laags: root → tak → subtopic → detail) ───────────
  const buildAiLayout = useCallback(() => {
    if (!aiMindmap || !cvRef.current) return;
    const cv = cvRef.current;
    const dpr = window.devicePixelRatio||1;
    const CW = cv.clientWidth  || cv.width/dpr  || 800;
    const CH = cv.clientHeight || cv.height/dpr || 600;
    const cx = CW/2, cy = CH/2;

    const newNodes = [];
    const newEdges = [];
    const branches = aiMindmap.branches || [];

    newNodes.push({id:"root", label: aiMindmap.root||"Overzicht",
                   fullLabel: aiMindmap.root||"Overzicht",
                   type:"root", x:cx, y:cy, fixed:true});

    const BRANCH_R  = Math.min(220, CW*0.28);
    const SUB_R     = 130;
    const DETAIL_R  = 90;
    const PALETTE   = ["#8ac6f2","#9fcf56","#e5786d","#d4a4f7","#e8d44d","#f4bf75","#a8d8a0","#f097c0"];

    if (layout === "tree") {
      // Horizontale boom naar rechts: root links, takken als rij rechts, subtopics verder rechts
      const bCount = branches.length;
      const LEVEL1_X = 220;   // root → tak
      const LEVEL2_X = 420;   // tak → subtopic
      const LEVEL3_X = 580;   // subtopic → detail
      const rootX    = 80;

      // Overschrijf root x-positie naar links
      newNodes[0].x = rootX;
      newNodes[0].y = cy;

      // Verdeel takken verticaal
      const bGap = Math.min(90, (CH - 80) / Math.max(bCount, 1));
      const bStartY = cy - ((bCount-1)/2) * bGap;

      branches.forEach((b, bi) => {
        const color = b.color || PALETTE[bi % PALETTE.length];
        const bx = LEVEL1_X;
        const by = bStartY + bi * bGap;
        const bId = "branch-"+bi;
        newNodes.push({id:bId, label:b.label, fullLabel:b.label, type:"branch",
                       x:bx, y:by, color, parentId:"root", important:b.importance==="high"});
        newEdges.push({from:"root", to:bId, weight: b.importance==="high"?3:1.5});

        const children = b.children || [];
        const cGap = Math.min(70, bGap / Math.max(children.length, 1));
        const cStartY = by - ((children.length-1)/2) * cGap;

        children.forEach((c, ci) => {
          const cLabel = typeof c==="string" ? c : c.label;
          const cDetails = typeof c==="string" ? [] : (c.details||[]);
          const sx = LEVEL2_X;
          const sy = cStartY + ci * cGap;
          const sId = "sub-"+bi+"-"+ci;
          newNodes.push({id:sId, label:cLabel, fullLabel:cLabel, type:"sub", x:sx, y:sy, color, parentId:bId});
          newEdges.push({from:bId, to:sId});

          const dGap = Math.min(50, cGap / Math.max(cDetails.length, 1));
          const dStartY = sy - ((Math.min(cDetails.length,3)-1)/2) * dGap;
          cDetails.slice(0,3).forEach((d, di) => {
            const dId = "detail-"+bi+"-"+ci+"-"+di;
            newNodes.push({id:dId, label: d.length>28?d.slice(0,26)+"…":d,
                           fullLabel:d, type:"detail",
                           x: LEVEL3_X,
                           y: dStartY + di * dGap,
                           color: color+"99", parentId:sId});
            newEdges.push({from:sId, to:dId, detail:true});
          });
        });
      });
    } else {
      // Radiaal (standaard)
      branches.forEach((b, bi) => {
        const angle = (bi / branches.length) * Math.PI*2 - Math.PI/2;
        const bx = cx + BRANCH_R * Math.cos(angle);
        const by = cy + BRANCH_R * Math.sin(angle);
        const color = b.color || PALETTE[bi % PALETTE.length];
        const bId = "branch-"+bi;
        newNodes.push({id:bId, label:b.label, fullLabel:b.label, type:"branch",
                       x:bx, y:by, color, parentId:"root", important:b.importance==="high"});
        newEdges.push({from:"root", to:bId, weight: b.importance==="high"?3:1.5});

        const children = b.children || [];
        children.forEach((c, ci) => {
          const cLabel = typeof c==="string" ? c : c.label;
          const cDetails = typeof c==="string" ? [] : (c.details||[]);
          const spread = Math.min(Math.PI*0.7, children.length*0.28);
          const cAngle = angle - spread/2 + (children.length>1?(ci/(children.length-1))*spread:0);
          const sx = bx + SUB_R * Math.cos(cAngle);
          const sy = by + SUB_R * Math.sin(cAngle);
          const sId = "sub-"+bi+"-"+ci;
          newNodes.push({id:sId, label:cLabel, fullLabel:cLabel, type:"sub", x:sx, y:sy, color, parentId:bId});
          newEdges.push({from:bId, to:sId});

          cDetails.slice(0,3).forEach((d, di) => {
            const detailSpread = Math.min(Math.PI*0.4, cDetails.length*0.2);
            const dAngle = cAngle - detailSpread/2 +
                           (cDetails.length>1?(di/(cDetails.length-1))*detailSpread:0);
            const dId = "detail-"+bi+"-"+ci+"-"+di;
            newNodes.push({id:dId, label: d.length>28?d.slice(0,26)+"…":d,
                           fullLabel:d, type:"detail",
                           x: sx + DETAIL_R*Math.cos(dAngle),
                           y: sy + DETAIL_R*Math.sin(dAngle),
                           color: color+"99", parentId:sId});
            newEdges.push({from:sId, to:dId, detail:true});
          });
        });
      });
    }

    setNodes(newNodes);
    setEdges(newEdges);
    mmCentredRef.current = false; // volgende resize centreert opnieuw
    // Pan wordt gezet door de canvas resize zodra echte afmetingen bekend zijn
    setZoom(0.85);
  }, [aiMindmap, layout]);

  // Schakel automatisch naar AI-modus als nieuwe mindmap binnenkomt
  useEffect(() => {
    if (aiMindmap) {
      setAiMode(true);
      setTimeout(()=>buildAiLayout(), 60);
    }
  }, [aiMindmap, buildAiLayout]);

  useEffect(() => {
    if (!aiMode) buildLayout();
    else buildAiLayout();
  }, [aiMode, buildLayout, buildAiLayout]);

  // ── Canvas rendering ──────────────────────────────────────────────────────
  useEffect(() => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    const dpr = window.devicePixelRatio||1;

    const centredRef = mmCentredRef; // gedeelde ref zodat layout-reset ook centrering reset
    const resize = () => {
      const p = cv.parentElement;
      const w = p.offsetWidth  || p.clientWidth  || p.getBoundingClientRect().width;
      const h = p.offsetHeight || p.clientHeight || p.getBoundingClientRect().height;
      if (!w || !h) return;
      cv.style.flex = "none"; // verwijder flex:1 na eerste meting
      cv.width  = w * dpr;
      cv.height = h * dpr;
      cv.style.width  = w + "px";
      cv.style.height = h + "px";
      ctx.scale(dpr, dpr);
      // Eerste keer dat we echte afmetingen hebben: centreer de root-node
      if (!centredRef.current) {
        centredRef.current = true;
        const ns = nodesRef.current;
        const root = ns.find(n => n.id === "root");
        if (root) {
          const z = 0.85;
          setPan({ x: w/2 - root.x * z, y: h/2 - root.y * z });
          setZoom(z);
        }
      }
    };
    requestAnimationFrame(()=>{ requestAnimationFrame(()=>{
      resize();
      setTimeout(resize, 100); // iOS Safari fallback
    }); });
    const ro = new ResizeObserver(resize);
    ro.observe(cv.parentElement);

    const draw = () => {
      const CW = cv.clientWidth, CH = cv.clientHeight;
      ctx.clearRect(0,0,CW,CH);
      ctx.fillStyle = W.bg;
      ctx.fillRect(0,0,CW,CH);

      // Lichte grid
      ctx.strokeStyle = "rgba(255,255,255,0.02)";
      ctx.lineWidth = 1;
      for (let x=0; x<CW; x+=40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,CH); ctx.stroke(); }
      for (let y=0; y<CH; y+=40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(CW,y); ctx.stroke(); }

      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      const ns = nodesRef.current;
      const es = edgesRef.current;
      const sel = selRef.current;

      // Edges
      es.forEach(e => {
        const from = ns.find(n=>n.id===e.from);
        const to   = ns.find(n=>n.id===e.to);
        if (!from||!to) return;
        ctx.beginPath();
        const mx = (from.x+to.x)/2;
        const my = (from.y+to.y)/2;
        ctx.moveTo(from.x, from.y);
        ctx.quadraticCurveTo(mx, my, to.x, to.y);
        ctx.strokeStyle = e.secondary
          ? "rgba(255,255,255,0.06)"
          : e.detail
            ? (to.color||W.splitBg)+"30"
            : (to.color||W.splitBg)+"55";
        ctx.lineWidth = e.secondary ? 0.5
          : e.detail ? 0.6
          : e.weight ? e.weight
          : (from.type==="root" ? 2 : 1);
        ctx.setLineDash(e.secondary?[3,5]:e.detail?[2,4]:[]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Nodes
      ns.forEach(n => {
        const isSel = n.id === sel;
        const color = n.color || W.fgMuted;

        if (n.type === "root") {
          // Root: grote cirkel
          const r = 38;
          if (isSel) {
            ctx.beginPath(); ctx.arc(n.x,n.y,r+8,0,Math.PI*2);
            const g = ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,r+8);
            g.addColorStop(0,"rgba(138,198,242,0.25)"); g.addColorStop(1,"rgba(138,198,242,0)");
            ctx.fillStyle=g; ctx.fill();
          }
          ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2);
          ctx.fillStyle   = isSel?"rgba(138,198,242,0.25)":"rgba(138,198,242,0.1)";
          ctx.strokeStyle = isSel?"rgba(138,198,242,0.9)":"rgba(138,198,242,0.4)";
          ctx.lineWidth   = isSel ? 2.5 : 1.5;
          ctx.fill(); ctx.stroke();
          ctx.fillStyle  = isSel ? W.statusFg : W.fg;
          ctx.font       = `bold 13px 'Hack','Courier New',monospace`;
          ctx.textAlign  = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n.label, n.x, n.y);

        } else if (n.type === "tag") {
          // Tag: afgeronde pill
          const pw = 100, ph = 26, pr = 13;
          const lx = n.x - pw/2, ly = n.y - ph/2;
          if (isSel) {
            ctx.shadowBlur = 12; ctx.shadowColor = color+"80";
          }
          ctx.beginPath();
          ctx.roundRect(lx,ly,pw,ph,pr);
          ctx.fillStyle   = color+"28";
          ctx.strokeStyle = isSel ? color : color+"70";
          ctx.lineWidth   = isSel ? 2 : 1.2;
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur  = 0;
          ctx.fillStyle   = isSel ? W.statusFg : color;
          ctx.font        = `${isSel?"bold ":""}11px 'Hack','Courier New',monospace`;
          ctx.textAlign   = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(n.label, n.x, n.y);

        } else if (n.type === "branch") {
          // AI Hoofdtak: hexagon-achtige pill, groter dan tag
          const pw = 140, ph = 32, pr = 16;
          const lx = n.x - pw/2, ly = n.y - ph/2;
          if (isSel || n.important) {
            ctx.shadowBlur = 16; ctx.shadowColor = color+"90";
          }
          ctx.beginPath(); ctx.roundRect(lx,ly,pw,ph,pr);
          ctx.fillStyle   = color+"35";
          ctx.strokeStyle = isSel ? color : color+"90";
          ctx.lineWidth   = isSel ? 2.5 : (n.important ? 2 : 1.5);
          ctx.fill(); ctx.stroke();
          if (n.important) {
            // Ster icoontje voor high-importance
            ctx.fillStyle = color;
            ctx.font = "10px sans-serif";
            ctx.textAlign = "right"; ctx.textBaseline = "middle";
            ctx.fillText("⭐", n.x + pw/2 - 5, n.y);
          }
          ctx.shadowBlur = 0;
          ctx.fillStyle  = isSel ? W.statusFg : color;
          ctx.font       = `bold 11px 'Hack','Courier New',monospace`;
          ctx.textAlign  = "center"; ctx.textBaseline = "middle";
          ctx.fillText(n.label.length>20?n.label.slice(0,18)+"…":n.label, n.x, n.y);

        } else if (n.type === "sub") {
          // AI Subtopic: afgeronde pill, medium
          const pw = 110, ph = 24, pr = 12;
          const lx = n.x - pw/2, ly = n.y - ph/2;
          if (isSel) { ctx.shadowBlur=8; ctx.shadowColor=color+"60"; }
          ctx.beginPath(); ctx.roundRect(lx,ly,pw,ph,pr);
          ctx.fillStyle   = isSel ? color+"28" : color+"18";
          ctx.strokeStyle = isSel ? color       : color+"55";
          ctx.lineWidth   = isSel ? 1.8 : 1;
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur  = 0;
          ctx.fillStyle   = isSel ? W.statusFg : W.fg;
          ctx.font        = `${isSel?"bold ":""}10px 'Hack','Courier New',monospace`;
          ctx.textAlign   = "center"; ctx.textBaseline = "middle";
          ctx.fillText(n.label.length>18?n.label.slice(0,16)+"…":n.label, n.x, n.y);

        } else if (n.type === "detail") {
          // AI Detail: klein, subtiel
          const pw = 86, ph = 18, pr = 9;
          const lx = n.x - pw/2, ly = n.y - ph/2;
          ctx.beginPath(); ctx.roundRect(lx,ly,pw,ph,pr);
          ctx.fillStyle   = isSel ? color+"25" : "transparent";
          ctx.strokeStyle = isSel ? color       : color+"40";
          ctx.lineWidth   = isSel ? 1.5 : 0.8;
          ctx.fill(); ctx.stroke();
          ctx.fillStyle  = isSel ? W.statusFg : W.fgMuted;
          ctx.font       = `9px 'Hack','Courier New',monospace`;
          ctx.textAlign  = "center"; ctx.textBaseline = "middle";
          ctx.fillText(n.label, n.x, n.y);

        } else {
          // Notitie (vault): rechthoekje
          const nw = 124, nh = 28, nr = 5;
          const lx = n.x - nw/2, ly = n.y - nh/2;
          if (isSel) { ctx.shadowBlur=10; ctx.shadowColor=color+"60"; }
          ctx.beginPath(); ctx.roundRect(lx,ly,nw,nh,nr);
          ctx.fillStyle   = isSel ? color+"30" : W.bg2;
          ctx.strokeStyle = isSel ? color       : color+"45";
          ctx.lineWidth   = isSel ? 2 : 0.8;
          ctx.fill(); ctx.stroke();
          ctx.shadowBlur  = 0;
          ctx.fillStyle   = isSel ? W.statusFg : W.fgDim;
          ctx.font        = `${isSel?"bold ":""}10px 'Hack','Courier New',monospace`;
          ctx.textAlign   = "center"; ctx.textBaseline = "middle";
          ctx.fillText(n.label, n.x, n.y);
        }
      });

      ctx.restore();
      afRef.current = requestAnimationFrame(draw);
    };

    afRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(afRef.current);
      ro.disconnect();
    };
  }, [nodes, edges, selId, zoom, pan]);

  // ── Muis/touch interactie ─────────────────────────────────────────────────
  const worldPos = useCallback((clientX, clientY) => {
    const r = cvRef.current.getBoundingClientRect();
    return {
      x: (clientX - r.left - pan.x) / zoom,
      y: (clientY - r.top  - pan.y) / zoom,
    };
  }, [pan, zoom]);

  const nodeAt = useCallback((wx, wy) => {
    return nodesRef.current.find(n => {
      const dx = n.x - wx, dy = n.y - wy;
      const hitR = n.type==="root" ? 38 : n.type==="tag" ? 55 : 65;
      return Math.sqrt(dx*dx+dy*dy) < hitR/2 + 8;
    });
  }, []);

  const onMouseDown = useCallback((e) => {
    if (e.button === 1 || e.button === 2 || (e.button===0 && e.altKey)) {
      // Middelklik, rechterknop of Alt+klik = pannen
      e.preventDefault();
      panRef.current = {startX:e.clientX, startY:e.clientY,
                        origPanX:pan.x, origPanY:pan.y};
      return;
    }
    const {x,y} = worldPos(e.clientX, e.clientY);
    const n = nodeAt(x,y);
    if (n) {
      dragRef.current = {nodeId:n.id, startX:e.clientX, startY:e.clientY,
                         origX:n.x, origY:n.y, moved:false};
      setSelId(n.id);
    } else {
      setSelId(null);
      panRef.current = {startX:e.clientX, startY:e.clientY,
                        origPanX:pan.x, origPanY:pan.y};
    }
  }, [worldPos, nodeAt, pan]);

  const onMouseMove = useCallback((e) => {
    if (panRef.current) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setPan({x: panRef.current.origPanX+dx, y: panRef.current.origPanY+dy});
      return;
    }
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx)>3||Math.abs(dy)>3) dragRef.current.moved = true;
    const nx = dragRef.current.origX + dx/zoom;
    const ny = dragRef.current.origY + dy/zoom;
    setNodes(prev => prev.map(n =>
      n.id===dragRef.current.nodeId ? {...n,x:nx,y:ny} : n
    ));
  }, [zoom]);

  const onMouseUp = useCallback((e) => {
    if (panRef.current) { panRef.current=null; return; }
    if (!dragRef.current) return;
    const {nodeId, moved} = dragRef.current;
    dragRef.current = null;
    if (!moved) {
      // Klik zonder bewegen
      const n = nodesRef.current.find(x=>x.id===nodeId);
      if (!n) return;
      if (n.type==="note" && n.noteId) {
        onSelectNote?.(n.noteId);
      }
    }
  }, [onSelectNote]);

  const onDblClick = useCallback((e) => {
    const {x,y} = worldPos(e.clientX, e.clientY);
    const n = nodeAt(x,y);
    if (n && mode==="edit") {
      setEditingId(n.id);
      setEditLabel(n.fullLabel||n.label);
      setTimeout(()=>editRef.current?.focus(),30);
    }
  }, [worldPos, nodeAt, mode]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(z => Math.max(0.2, Math.min(3, z*factor)));
  }, []);

  // ── Nieuwe custom node toevoegen ──────────────────────────────────────────
  const addCustomNode = () => {
    const sel = nodesRef.current.find(n=>n.id===selId);
    const parentId = sel?.id || "root";
    const parent   = nodesRef.current.find(n=>n.id===parentId);
    const angle    = Math.random() * Math.PI*2;
    const dist     = 120;
    const newNode  = {
      id: "custom-"+Date.now(), label:"Nieuw", fullLabel:"Nieuw",
      type: "custom", color: W.yellow,
      x: (parent?.x||300) + dist*Math.cos(angle),
      y: (parent?.y||300) + dist*Math.sin(angle),
      parentId,
    };
    setNodes(p=>[...p, newNode]);
    setEdges(p=>[...p,{from:parentId, to:newNode.id}]);
    setSelId(newNode.id);
    setEditingId(newNode.id);
    setEditLabel("Nieuw");
    setMode("edit");
    setTimeout(()=>editRef.current?.focus(),30);
  };

  const deleteSelected = () => {
    if (!selId || selId==="root") return;
    setNodes(p=>p.filter(n=>n.id!==selId));
    setEdges(p=>p.filter(e=>e.from!==selId&&e.to!==selId));
    setSelId(null);
  };

  const commitEdit = () => {
    if (!editingId) return;
    setNodes(p=>p.map(n=>n.id===editingId
      ?{...n, label:editLabel.slice(0,22)+(editLabel.length>22?"…":""),
               fullLabel:editLabel} : n));
    setEditingId(null);
  };

  const selNode = nodes.find(n=>n.id===selId);

  // ── Mindmap → Markdown boomstructuur ──────────────────────────────────────
  // Bouwt een hiërarchische markdown-string uit de huidige nodes+edges.
  const nodesToMarkdown = useCallback(() => {
    const ns = nodes;
    if (!ns.length) return "";

    // Bouw parent→children map
    const childrenOf = {};
    ns.forEach(n => { childrenOf[n.id] = []; });
    edges.forEach(e => {
      if (childrenOf[e.from] !== undefined) childrenOf[e.from].push(e.to);
    });

    const root = ns.find(n => n.type === "root" || n.id === "root");
    if (!root) return "";

    const title = root.fullLabel || root.label;
    const lines = [`# ${title}`, ""];

    // Recursief de boom afdrukken
    const walk = (nodeId, depth) => {
      const children = (childrenOf[nodeId] || [])
        .map(cid => ns.find(n => n.id === cid))
        .filter(Boolean)
        .sort((a, b) => (a.y || 0) - (b.y || 0));  // volgorde top→bottom

      children.forEach(child => {
        const label = child.fullLabel || child.label;
        if (depth === 1) {
          // Hoofd-takken als ## sectie
          lines.push(`## ${label}`);
          lines.push("");
        } else if (depth === 2) {
          lines.push(`### ${label}`);
          lines.push("");
        } else {
          // Dieper: geneste bullet
          const indent = "  ".repeat(depth - 3);
          lines.push(`${indent}- **${label}**`);
        }
        walk(child.id, depth + 1);
      });
    };

    walk(root.id, 1);

    // Voeg footer toe
    const modeLabel = aiMode ? "AI-mindmap" : "Vault-mindmap";
    lines.push("");
    lines.push("---");
    lines.push(`*Gegenereerd vanuit ${modeLabel} op ${new Date().toLocaleDateString("nl-NL")}*`);

    return lines.join("\n");
  }, [nodes, edges, aiMode]);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // ── Mindmap nodes → Mermaid syntax ────────────────────────────────────────
  const nodesToMermaid = useCallback(() => {
    const ns = nodes;
    if (!ns.length) return "mindmap\n  root((Mindmap))";

    const childrenOf = {};
    ns.forEach(n => { childrenOf[n.id] = []; });
    edges.forEach(e => {
      if (childrenOf[e.from] !== undefined) childrenOf[e.from].push(e.to);
    });

    const root = ns.find(n => n.type === "root" || n.id === "root");
    if (!root) return "mindmap\n  root((Mindmap))";

    const lines = ["mindmap"];

    const walk = (nodeId, depth) => {
      const node = ns.find(n => n.id === nodeId);
      if (!node) return;
      const indent = "  ".repeat(depth);
      // fullLabel heeft altijd de onafgekapte tekst
      const label = (node.fullLabel || node.label || "")
        .replace(/…$/, "")   // strip visuele truncatie
        .trim();

      if (depth === 1) {
        lines.push(`${indent}root((${label}))`);
      } else {
        lines.push(`${indent}${label}`);
      }

      const children = (childrenOf[nodeId] || [])
        .map(cid => ns.find(n => n.id === cid))
        .filter(Boolean)
        .sort((a, b) => (a.y || 0) - (b.y || 0));

      children.forEach(child => walk(child.id, depth + 1));
    };

    walk(root.id, 1);
    return lines.join("\n");
  }, [nodes, edges]);

  const saveAsNote = useCallback(async () => {
    if (!onAddNote || saving) return;
    setSaving(true);
    const root = nodes.find(n => n.type==="root" || n.id==="root");
    const md = nodesToMarkdown();
    const title = "Mindmap — " + (root?.fullLabel || root?.label || "overzicht");
    try {
      await onAddNote({
        id:       genId(),
        title,
        content:  md,
        tags:     ["mindmap", aiMode ? "ai" : "vault"],
        created:  new Date().toISOString(),
        modified: new Date().toISOString(),
      });
      setSaveMsg("✓ Opgeslagen als notitie");
      setTimeout(() => setSaveMsg(""), 2500);
    } catch(e) {
      setSaveMsg("⚠ Fout bij opslaan");
      setTimeout(() => setSaveMsg(""), 2500);
    }
    setSaving(false);
  }, [nodes, edges, aiMode, onAddNote, nodesToMarkdown, saving]);

  // ── Render ────────────────────────────────────────────────────────────────
  // Mermaid editor modus
  if (mmView === "mermaid") {
    return React.createElement(MermaidEditor, {
      initialText: editMermaid,
      notes,
      serverPdfs,
      serverImages,
      onSave: async ({title, content, tags}) => {
        if (!onAddNote) return;
        await onAddNote({
          id:       genId(),
          title,
          content,
          tags,
          created:  new Date().toISOString(),
          modified: new Date().toISOString(),
        });
      },
      onCancel: () => { setMmView("canvas"); setEditMermaid(null); }
    });
  }

  return React.createElement("div", {
    style:{flex:1,display:"flex",flexDirection:"column",minHeight:0,overflow:"hidden",position:"relative"}
  },

    // Canvas
    React.createElement("canvas", {
      ref: cvRef,
      style:{flex:1,cursor: (dragRef.current||panRef.current)?"grabbing":"crosshair"},
      onMouseDown, onMouseMove, onMouseUp, onDblClick,
      onWheel,
      onContextMenu: e=>e.preventDefault(),
    }),

    // ── Controls panel linksboven ────────────────────────────────────────────
    React.createElement("div", {
      style:{position:"absolute",top:"10px",left:"10px",zIndex:10,
             background:"rgba(28,28,28,0.88)",border:`1px solid ${W.splitBg}`,
             borderRadius:"8px",padding:"10px 12px",backdropFilter:"blur(6px)",
             display:"flex",flexDirection:"column",gap:"7px",minWidth:"210px"}
    },

      // ✦ Nieuwe lege mindmap — boven de tabs
      React.createElement("button",{
        onClick:()=>{ setMmView("mermaid"); setEditMermaid(null); },
        title:"Nieuwe lege mindmap openen in editor",
        style:{
          width:"100%", padding:"6px 10px",
          background:"rgba(138,198,242,0.07)",
          border:`1px solid rgba(138,198,242,0.3)`,
          borderRadius:"6px", color:W.blue,
          fontSize:"14px", fontWeight:"600",
          cursor:"pointer", marginBottom:"4px",
          display:"flex", alignItems:"center",
          justifyContent:"center", gap:"6px",
          transition:"all 0.12s",
        },
        onMouseEnter:e=>{
          e.currentTarget.style.background="rgba(138,198,242,0.15)";
          e.currentTarget.style.borderColor="rgba(138,198,242,0.55)";
        },
        onMouseLeave:e=>{
          e.currentTarget.style.background="rgba(138,198,242,0.07)";
          e.currentTarget.style.borderColor="rgba(138,198,242,0.3)";
        },
      },
        React.createElement("span",null,"✦"),
        "Nieuwe mindmap"
      ),

      // AI/Vault/Mermaid toggle — onder de nieuwe-knop
      React.createElement("div",{
        style:{display:"flex",gap:"4px",background:"rgba(0,0,0,0.3)",
               borderRadius:"6px",padding:"3px",marginBottom:"2px"}
      },
        [
          ...(aiMindmap ? [{id:"ai",label:"🧠 AI"},{id:"vault",label:"🕸 Vault"}] : [{id:"vault",label:"🕸 Vault"}]),
          {id:"mermaid",label:"🌿 Mermaid"},
        ].map(opt =>
          React.createElement("button",{key:opt.id,
            onClick:()=>{
              if (opt.id==="mermaid") { setMmView("mermaid"); setEditMermaid(nodesToMermaid()); }
              else { setAiMode(opt.id==="ai"); }
            },
            style:{
              flex:1,
              background: (opt.id==="mermaid" ? mmView==="mermaid"
                          : opt.id==="ai" ? (aiMode&&mmView==="canvas")
                          : (!aiMode&&mmView==="canvas"))
                ? "rgba(138,198,242,0.2)" : "none",
              border:`1px solid ${
                (opt.id==="mermaid" ? mmView==="mermaid"
                : opt.id==="ai" ? (aiMode&&mmView==="canvas")
                : (!aiMode&&mmView==="canvas"))
                ? "rgba(138,198,242,0.5)" : "transparent"}`,
              color: (opt.id==="mermaid" ? mmView==="mermaid"
                     : opt.id==="ai" ? (aiMode&&mmView==="canvas")
                     : (!aiMode&&mmView==="canvas"))
                ? "#a8d8f0" : W.fgMuted,
              borderRadius:"4px",padding:"3px 6px",fontSize:"14px",cursor:"pointer"
            }
          },opt.label)
        )
      ),

      // AI mindmap info
      aiMode && aiMindmap && React.createElement("div",{
        style:{fontSize:"9px",color:W.comment,padding:"3px 6px",
               background:"rgba(159,202,86,0.08)",borderRadius:"4px",
               borderLeft:"2px solid rgba(159,202,86,0.4)"}
      },
        "📄 ",aiMindmap.root,
        React.createElement("br"),
        `${aiMindmap.branches?.length||0} takken · `,
        `${aiMindmap.branches?.reduce((a,b)=>(a+(b.children?.length||0)),0)||0} subtopics`
      ),

      // ── Opslaan als notitie ──────────────────────────────────────────────
      onAddNote && nodes.length > 1 && React.createElement("div",{
        style:{borderTop:`1px solid ${W.splitBg}`,paddingTop:"7px"}
      },
        React.createElement("button",{
          onClick: saveAsNote,
          disabled: saving,
          style:{
            width:"100%", padding:"6px 10px",
            background: saving
              ? "rgba(159,202,86,0.08)"
              : "linear-gradient(135deg,rgba(159,202,86,0.22),rgba(159,202,86,0.12))",
            border:`1px solid rgba(159,202,86,${saving?0.15:0.45})`,
            borderRadius:"5px", color:saving?W.fgMuted:W.comment,
            fontSize:"14px", fontWeight:"600", cursor:saving?"default":"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:"5px",
            transition:"all 0.15s",
          }
        },
          saving
            ? React.createElement(React.Fragment,null,
                React.createElement("span",{style:{fontSize:"14px"}},"⏳"),
                "Opslaan…")
            : React.createElement(React.Fragment,null,
                React.createElement("span",{style:{fontSize:"14px"}},"💾"),
                "Opslaan als notitie")
        ),
        saveMsg && React.createElement("div",{style:{
          marginTop:"5px", fontSize:"14px", textAlign:"center",
          color: saveMsg.startsWith("✓") ? W.comment : W.orange,
        }}, saveMsg)
      ),
      React.createElement("div",{style:{display:"flex",gap:"5px",alignItems:"center"}},
        React.createElement("span",{style:{fontSize:"9px",color:"rgba(138,198,242,0.5)",
          letterSpacing:"1.5px",flex:1}},"MODUS"),
        [{id:"view",label:"👁 bekijk"},{id:"edit",label:"✏ bewerk"}].map(m=>
          React.createElement("button",{key:m.id, onClick:()=>setMode(m.id),
            style:{background:mode===m.id?"rgba(138,198,242,0.18)":"none",
                   border:`1px solid ${mode===m.id?"rgba(138,198,242,0.5)":W.splitBg}`,
                   color:mode===m.id?"#a8d8f0":W.fgMuted,
                   borderRadius:"4px",padding:"2px 8px",fontSize:"14px",cursor:"pointer"}
          },m.label))
      ),

      // Layout + weergave — in vault-modus ook tag-filter
      React.createElement(React.Fragment,null,
        // Layout
        React.createElement("div",{style:{display:"flex",gap:"5px",alignItems:"center"}},
          React.createElement("span",{style:{fontSize:"9px",color:"rgba(138,198,242,0.5)",
            letterSpacing:"1.5px",flex:1}},"LAYOUT"),
          [{id:"radial",label:"⊙"},{id:"tree",label:"⊤"}].map(l=>
            React.createElement("button",{key:l.id, onClick:()=>setLayout(l.id),
              style:{background:layout===l.id?"rgba(138,198,242,0.18)":"none",
                     border:`1px solid ${layout===l.id?"rgba(138,198,242,0.5)":W.splitBg}`,
                     color:layout===l.id?"#a8d8f0":W.fgMuted,
                     borderRadius:"4px",padding:"2px 10px",fontSize:"14px",cursor:"pointer"}
            },l.label))
        ),
        // Weergave (tags/notities toggle alleen zinvol in vault-modus)
        !aiMode && React.createElement("div",{style:{display:"flex",gap:"5px",flexWrap:"wrap"}},
          [{label:"tags",val:showTags,set:setShowTags},
           {label:"notities",val:showNotes,set:setShowNotes}].map(({label,val,set})=>
            React.createElement("button",{key:label,onClick:()=>set(v=>!v),
              style:{background:val?"rgba(138,198,242,0.12)":"none",
                     border:`1px solid ${val?"rgba(138,198,242,0.4)":W.splitBg}`,
                     color:val?"#a8d8f0":W.fgMuted,
                     borderRadius:"4px",padding:"2px 9px",fontSize:"14px",cursor:"pointer"}
            },val?"✓ "+label:"○ "+label))
        ),
        // Tag filter: alleen in vault-modus
        !aiMode && allTags.length>0 && React.createElement("div",null,
          React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
            letterSpacing:"1.5px",marginBottom:"4px"}},"TAG FILTER"),
          React.createElement(TagFilterBar,{tags:allTags,activeTag:tagFilter,onChange:setTagFilter,compact:true,tagColors:tagColorMap,maxVisible:6})
        )
      ),

      // Edit-modus acties — beschikbaar in beide modi
      mode==="edit" && React.createElement("div",{
        style:{borderTop:`1px solid ${W.splitBg}`,paddingTop:"7px",
               display:"flex",gap:"5px",flexWrap:"wrap"}
      },
        React.createElement("button",{onClick:addCustomNode,
          style:{background:"rgba(138,198,242,0.1)",border:`1px solid rgba(138,198,242,0.3)`,
                 color:"#a8d8f0",borderRadius:"4px",padding:"3px 9px",
                 fontSize:"14px",cursor:"pointer"}
        },"+ knoop"),
        selId&&selId!=="root"&&React.createElement("button",{onClick:deleteSelected,
          style:{background:"rgba(229,120,109,0.08)",border:`1px solid rgba(229,120,109,0.25)`,
                 color:W.orange,borderRadius:"4px",padding:"3px 9px",
                 fontSize:"14px",cursor:"pointer"}
        },"✕ verwijder"),
        React.createElement("button",{onClick:()=>aiMode?buildAiLayout():buildLayout(),
          style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                 borderRadius:"4px",padding:"3px 9px",fontSize:"14px",cursor:"pointer"}
        },"↺ reset"),
        React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,
          width:"100%",marginTop:"2px"}},"dubbelklik = hernoemen · sleep = verplaatsen")
      )
    ),

    // ── Zoom controls rechtsonder ─────────────────────────────────────────────
    React.createElement("div",{
      style:{position:"absolute",bottom:"14px",right:"14px",zIndex:10,
             display:"flex",gap:"5px",alignItems:"center"}
    },
      React.createElement("button",{onClick:()=>setZoom(z=>Math.max(0.2,z/1.2)),
        style:{background:W.bg2,border:`1px solid ${W.splitBg}`,color:W.fg,
               borderRadius:"4px",padding:"4px 10px",fontSize:"16px",cursor:"pointer"}
      },"−"),
      React.createElement("span",{
        onClick:()=>{setZoom(1);setPan({x:0,y:0});},
        style:{fontSize:"14px",color:W.fgMuted,cursor:"pointer",minWidth:"38px",textAlign:"center"}
      },Math.round(zoom*100)+"%"),
      React.createElement("button",{onClick:()=>setZoom(z=>Math.min(3,z*1.2)),
        style:{background:W.bg2,border:`1px solid ${W.splitBg}`,color:W.fg,
               borderRadius:"4px",padding:"4px 10px",fontSize:"16px",cursor:"pointer"}
      },"＋")
    ),

    // ── Geselecteerde node info rechtsbovenin ─────────────────────────────────
    selNode && React.createElement("div",{
      style:{position:"absolute",top:"10px",right:"10px",zIndex:10,
             background:"rgba(28,28,28,0.9)",border:`1px solid ${selNode.color||W.splitBg}40`,
             borderRadius:"8px",padding:"10px 14px",maxWidth:"220px",
             backdropFilter:"blur(6px)"}
    },
      React.createElement("div",{style:{fontSize:"14px",color:selNode.color||W.fgMuted,
        letterSpacing:"1px",marginBottom:"4px"}},
        selNode.type==="root"?"ROOT":selNode.type==="tag"?"TAG":"NOTITIE"),
      React.createElement("div",{style:{fontSize:"14px",color:W.fg,
        fontWeight:"bold",wordBreak:"break-word",marginBottom:"6px"}},
        selNode.fullLabel||selNode.label),
      selNode.type==="note"&&selNode.noteId&&React.createElement("button",{
        onClick:()=>onSelectNote?.(selNode.noteId),
        style:{background:"rgba(138,198,242,0.1)",border:"1px solid rgba(138,198,242,0.3)",
               color:"#a8d8f0",borderRadius:"4px",padding:"4px 10px",
               fontSize:"14px",cursor:"pointer",width:"100%"}
      },"→ open notitie")
    ),

    // ── Inline label-editor (bij dubbelklik in edit-modus) ────────────────────
    editingId && React.createElement("div",{
      style:{position:"absolute",inset:0,zIndex:50,
             display:"flex",alignItems:"center",justifyContent:"center",
             background:"rgba(0,0,0,0.3)"},
      onClick:commitEdit,
    },
      React.createElement("div",{
        onClick:e=>e.stopPropagation(),
        style:{background:W.bg2,border:`2px solid rgba(138,198,242,0.5)`,
               borderRadius:"8px",padding:"16px 20px",
               display:"flex",flexDirection:"column",gap:"10px",
               minWidth:"260px",boxShadow:"0 8px 32px rgba(0,0,0,0.7)"}
      },
        React.createElement("div",{style:{fontSize:"14px",color:"rgba(138,198,242,0.6)",
          letterSpacing:"1.5px"}},"LABEL BEWERKEN"),
        React.createElement("input",{
          ref:editRef,
          value:editLabel,
          onChange:e=>setEditLabel(e.target.value),
          onKeyDown:e=>{
            if(e.key==="Enter"){ e.preventDefault(); commitEdit(); }
            if(e.key==="Escape"){ setEditingId(null); }
          },
          style:{background:W.bg,border:`1px solid rgba(138,198,242,0.4)`,
                 borderRadius:"5px",padding:"8px 12px",color:W.fg,
                 fontSize:"14px",outline:"none"}
        }),
        React.createElement("div",{style:{display:"flex",gap:"8px"}},
          React.createElement("button",{onClick:commitEdit,
            style:{flex:1,background:"rgba(138,198,242,0.15)",
                   border:"1px solid rgba(138,198,242,0.4)",
                   color:"#a8d8f0",borderRadius:"5px",padding:"6px",
                   fontSize:"14px",cursor:"pointer",fontWeight:"bold"}
          },"✓ opslaan"),
          React.createElement("button",{onClick:()=>setEditingId(null),
            style:{background:"none",border:`1px solid ${W.splitBg}`,
                   color:W.fgMuted,borderRadius:"5px",padding:"6px 12px",
                   fontSize:"14px",cursor:"pointer"}
          },"Esc")
        )
      )
    ),

    // ── Legenda onderin ────────────────────────────────────────────────────────
    React.createElement("div",{
      style:{position:"absolute",bottom:"14px",left:"50%",transform:"translateX(-50%)",
             background:"rgba(28,28,28,0.85)",border:`1px solid ${W.splitBg}`,
             borderRadius:"6px",padding:"5px 14px",fontSize:"14px",color:W.fgMuted,
             display:"flex",gap:"14px",backdropFilter:"blur(8px)"}
    },
      React.createElement("span",null,"⊙ root"),
      React.createElement("span",{style:{color:"#a8d8f0"}},"▬ tag"),
      React.createElement("span",{style:{color:W.fgDim}},"□ notitie"),
      React.createElement("span",null,"scroll = zoom"),
      React.createElement("span",null,"sleep = pannen/verplaatsen"),
      mode==="edit"&&React.createElement("span",{style:{color:W.yellow}},"✏ dubbelklik = bewerken")
    )
  );
};



// ── LLM Notebook ───────────────────────────────────────────────────────────────
// Notebook-stijl chat interface tegen lokale Ollama LLM.
// Context: selecteer notities en/of PDF-annotaties als kennisbasis.
// Aanbevolen modellen: llama3, mistral, phi3, gemma2
//
// Installatie Ollama:
//   curl -fsSL https://ollama.com/install.sh | sh
//   ollama pull llama3          (8B, goede balans kwaliteit/snelheid)
//   ollama pull mistral         (7B, snel, goed voor Europese talen)
//   ollama pull phi3:medium     (14B, sterk voor analyse)
//   ollama serve                (start de server op poort 11434)

const SUGGESTED_MODELS = [
  { id:"llama3.2-vision", label:"Llama 3.2 Vision 11B", desc:"Meta · tekst + afbeeldingen, aanbevolen" },
  { id:"llama3",          label:"Llama 3 8B",            desc:"Meta · snel, goed algemeen gebruik" },
  { id:"mistral",         label:"Mistral 7B",             desc:"Mistral AI · snel, goed voor EU-talen" },
  { id:"phi3:medium",     label:"Phi-3 Medium 14B",      desc:"Microsoft · sterk in redeneren & analyse" },
  { id:"gemma2",          label:"Gemma 2 9B",             desc:"Google · modern, goed voor lange context" },
];

const LLMNotebook = ({notes, pdfNotes, serverPdfs, serverImages, allTags, onAddNote, llmModel, setLlmModel, onMindmapReady, onPasteToNote=null}) => {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  // ── State ─────────────────────────────────────────────────────────────────
  const [messages,      setMessages]     = useState([]);
  const [input,         setInput]        = useState("");
  const [streaming,     setStreaming]    = useState(false);
  const [model,         setModel]        = useState("llama3.2-vision");
  const [availModels,   setAvailModels]  = useState([]);
  const [ollamaStatus,  setOllamaStatus] = useState("onbekend"); // ok / fout / laden
  const [ollamaUrl,     setOllamaUrl]    = useState("http://localhost:11434");
  const [ctxNotes,      setCtxNotes]     = useState([]);
  const [ctxPdfs,       setCtxPdfs]      = useState([]);
  const [ctxImages,     setCtxImages]    = useState([]);
  const [showContext,   setShowContext]  = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // sidebar standaard ingeklapt
  const [showInstall,   setShowInstall]  = useState(false);
  const [tagFilter,     setTagFilter]    = useState(null);
  const [savingNote,    setSavingNote]   = useState(false);
  const [mmPending,     setMmPending]    = useState(false);   // mindmap genereren
  const [graphRagMode,  setGraphRagMode] = useState(true);   // GraphRAG standaard aan
  const [graphRagInfo,  setGraphRagInfo] = useState(null);   // info over de query

  const [ctxExtPdfs,    setCtxExtPdfs]   = useState([]);   // absolute paden
  const [extPdfFiles,   setExtPdfFiles]  = useState([]);   // {name,path,dir,size}
  const [extPdfDirs,    setExtPdfDirs]   = useState([]);   // geconfigureerde mappen
  const [newExtDir,     setNewExtDir]    = useState("");
  const [showExtPdfs,   setShowExtPdfs]  = useState(true);
  const [extPdfLoading, setExtPdfLoading]= useState(false);
  const [extPdfSearch,  setExtPdfSearch]  = useState("");
  const [showExtPanel,  setShowExtPanel]  = useState(false);
  const [browseItems,   setBrowseItems]   = useState([]);
  const [browsePath,    setBrowsePath]    = useState("");
  const [browseParent,  setBrowseParent]  = useState("");
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError,   setBrowseError]   = useState("");
  const [browseMode,    setBrowseMode]    = useState("dirs");  // "dirs" | "browser"
  const [selectedDirs,  setSelectedDirs]  = useState(new Set());

  const chatEndRef  = useRef(null);
  const inputRef    = useRef(null);
  const abortRef    = useRef(null);  // AbortController voor streaming
  const browseCacheRef = useRef({});  // pad → items cache
  const chatAreaRef = useRef(null);   // ref op het scroll-gebied voor selectie-detectie

  // ── Tekst-selectie detectie voor "plak selectie" knop ────────────────────────
  const [selectionPopup, setSelectionPopup] = useState(null); // {text, x, y}

  const handleChatMouseUp = useCallback(() => {
    if (!onPasteToNote) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) { setSelectionPopup(null); return; }
    const text = sel.toString().trim();
    if (!text || text.length < 10) { setSelectionPopup(null); return; }
    // Controleer dat de selectie binnen het chat-gebied valt
    const range = sel.getRangeAt(0);
    const rect  = range.getBoundingClientRect();
    const area  = chatAreaRef.current?.getBoundingClientRect();
    if (!area) return;
    setSelectionPopup({ text, x: rect.left - area.left + rect.width / 2, y: rect.top - area.top - 8 });
  }, [onPasteToNote]);

  // Sluit popup bij klik buiten
  useEffect(() => {
    const hide = () => setSelectionPopup(null);
    document.addEventListener("selectionchange", () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) setSelectionPopup(null);
    });
  }, []);

  // ── Plak helper ──────────────────────────────────────────────────────────────
  const pasteToNote = useCallback((text, label = "Notebook AI") => {
    if (!onPasteToNote) return;
    onPasteToNote({ text, source: label, page: null, url: null, type: "ai" });
    setSelectionPopup(null);
  }, [onPasteToNote]);

  // ── Model sync: statusbalk → Notebook (eenrichtingsverkeer) ─────────────────
  // llmModel is de bron van waarheid (statusbalk ModelPicker).
  // Notebook toont het actieve model, wijzigen gaat via de statusbalk.
  useEffect(()=>{ if(llmModel) setModel(llmModel); },[llmModel]);

  const checkOllama = useCallback(async () => {
    setOllamaStatus("laden");
    try {
      const r = await fetch("/api/llm/models");
      const d = await r.json();
      setOllamaUrl(d.ollama_url);
      if (d.ok && d.models.length > 0) {
        setAvailModels(d.models);
        setOllamaStatus("ok");
        if (!d.models.includes(model)) setModel(d.models[0]);
      } else if (d.ok) {
        setAvailModels([]);
        setOllamaStatus("geen-modellen");
      } else {
        setOllamaStatus("fout");
      }
    } catch(e) {
      setOllamaStatus("fout");
    }
  }, [model]);

  useEffect(() => { checkOllama(); }, []);

  const browseTo = useCallback(async (path) => {
    const key = path==null ? "" : path;

    // Toon gecachede inhoud direct — geen laadvertraging
    if (browseCacheRef.current[key]) {
      const cached = browseCacheRef.current[key];
      setBrowseItems(cached.items);
      setBrowsePath(cached.path);
      setBrowseParent(cached.parent);
      setBrowseError("");
      // Haal op de achtergrond toch vers op (stille refresh)
    } else {
      setBrowseLoading(true);
    }

    setBrowseError("");
    try {
      const r = await fetch("/api/browse?path="+encodeURIComponent(key));
      if (!r.ok) throw new Error("HTTP "+r.status);
      const d = await r.json();
      if (d.error) {
        setBrowseError(d.error);
        setBrowseItems([]);
      } else {
        const result = {
          items:  d.items||[],
          path:   d.path||"",
          parent: d.parent!=null ? d.parent : ""
        };
        browseCacheRef.current[key] = result;
        setBrowseItems(result.items);
        setBrowsePath(result.path);
        setBrowseParent(result.parent);
      }
    } catch(e) {
      if (!browseCacheRef.current[key])  // alleen fout tonen als er geen cache is
        setBrowseError("Verbindingsfout: "+e.message);
    }
    setBrowseLoading(false);
  }, []);

  const loadExtPdfs = useCallback(async () => {
    setExtPdfLoading(true);
    try {
      const r = await fetch("/api/ext-pdfs");
      const d = await r.json();
      setExtPdfDirs(d.dirs || []);
      setExtPdfFiles(d.files || []);
    } catch(e) {}
    setExtPdfLoading(false);
  }, []);

  useEffect(() => { loadExtPdfs(); }, []);

  const saveExtDirs = async (dirs) => {
    setExtPdfDirs(dirs);
    await fetch("/api/ext-pdfs", {method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({dirs})});
    await loadExtPdfs();
  };

  // ── Auto-scroll naar onderste bericht ────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Context samenvatting ──────────────────────────────────────────────────
  const contextSummary = useMemo(() => {
    const nCount = ctxNotes.length;
    const pCount = ctxPdfs.length;
    const iCount = ctxImages.length;
    const eCount = ctxExtPdfs.length;
    if (!nCount && !pCount && !iCount && !eCount) return null;
    const parts = [];
    if (nCount) parts.push(nCount+" notitie"+(nCount>1?"s":""));
    if (pCount) parts.push(pCount+" PDF"+(pCount>1?"'s":""));
    if (eCount) parts.push(eCount+" extern PDF"+(eCount>1?"'s":""));
    if (iCount) parts.push(iCount+" afb.");
    return parts.join(" + ");
  }, [ctxNotes, ctxPdfs, ctxImages, ctxExtPdfs]);

  // ── Gefilterde notities voor context-selector ─────────────────────────────
  const filteredNotes = useMemo(() => {
    if (!tagFilter) return notes;
    return notes.filter(n => (n.tags||[]).includes(tagFilter));
  }, [notes, tagFilter]);

  // ── Altijd alle (gefilterde) notities meenemen ───────────────────────────
  useEffect(() => {
    setCtxNotes(filteredNotes.map(n => n.id));
  }, [filteredNotes]);

  // ── Alle beschikbare PDF's (met annotaties) ───────────────────────────────
  const pdfsWithAnnots = useMemo(() => {
    // Alle PDFs tonen in de context-selector, ook die zonder annotaties
    return (serverPdfs||[]).map(p => ({
      ...p,
      annotCount: pdfNotes.filter(a => a.file === p.name).length,
    }));
  }, [serverPdfs, pdfNotes]);

  // ── Selecteer alles / niets ────────────────────────────────────────────────
  const selectAllNotes = () => setCtxNotes(filteredNotes.map(n => n.id));
  const selectNone     = () => { setCtxNotes([]); setCtxPdfs([]); };

  // ── Verstuur bericht ──────────────────────────────────────────────────────
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg = { role: "user", content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setStreaming(true);

    // Placeholder assistent bericht
    const assistantPlaceholder = { role: "assistant", content: "", streaming: true };
    setMessages([...history, assistantPlaceholder]);

    try {
      let endpoint, body;
      if (graphRagMode) {
        // GraphRAG: stuur vraag + model → server bouwt graaf-context
        endpoint = "/api/llm/graphrag";
        body = JSON.stringify({ question: text, model, top_n: 5 });
      } else {
        endpoint = "/api/llm/chat";
        body = JSON.stringify({
          model,
          messages: history.map(m => ({ role: m.role, content: m.content })),
          context_notes:    ctxNotes,
          context_pdfs:     ctxPdfs,
          context_images:   ctxImages,
          context_ext_pdfs: ctxExtPdfs,
        });
      }

      const resp = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const reader = resp.body.getReader();
      const dec    = new TextDecoder();
      let   buf    = "";
      let   full   = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.error) throw new Error(evt.error);
            if (evt.delta) {
              full += evt.delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant", content: full, streaming: true
                };
                return updated;
              });
            }
            if (evt.done) break;
          } catch(e) {
            if (e.message && !e.message.includes("JSON")) throw e;
          }
        }
      }

      // Finaliseer bericht
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: full };
        return updated;
      });

    } catch(e) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "",
          error: e.message || "Onbekende fout",
        };
        return updated;
      });
    } finally {
      setStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, messages, model, ctxNotes, ctxPdfs, streaming]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const clearChat = () => { setMessages([]); setInput(""); };

  // ── Hiaat-analyse: vraagt AI om kennisleemtes te detecteren ─────────────────
  const runHiaatAnalyse = useCallback(async () => {
    const userMsg = {
      role:"user",
      content:"Analyseer mijn Zettelkasten knowledge graph grondig. Identificeer:\n"
             +"1. **Kennishiaten** — onderwerpen die aangestipt worden maar nauwelijks uitgewerkt zijn\n"
             +"2. **Zwakke bruggen** — notities die communities verbinden maar zelf weinig inhoud hebben\n"
             +"3. **Eiland-clusters** — groepen notities die geïsoleerd zijn van de rest\n"
             +"4. **Ontbrekende verbindingen** — ideeën die logisch verwant zijn maar niet gelinkt\n"
             +"5. **Aanbevelingen** — concrete volgende stappen om het kennisnetwerk te versterken\n\n"
             +"Wees specifiek en verwijs naar echte notitietitels uit de context."
    };
    setMessages(prev=>[...prev,userMsg,{role:"assistant",content:"",streaming:true}]);
    setStreaming(true);
    try {
      const resp = await fetch("/api/llm/graphrag",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          question:userMsg.content,
          model,
          top_n:8,
        }),
      });
      const reader=resp.body.getReader();
      const dec=new TextDecoder();
      let buf="",full="";
      while(true){
        const {done,value}=await reader.read();
        if(done) break;
        buf+=dec.decode(value,{stream:true});
        const lines=buf.split("\n"); buf=lines.pop()||"";
        for(const line of lines){
          if(!line.startsWith("data: ")) continue;
          try{
            const evt=JSON.parse(line.slice(6));
            if(evt.error) throw new Error(evt.error);
            if(evt.delta){ full+=evt.delta; setMessages(prev=>{const u=[...prev];u[u.length-1]={role:"assistant",content:full,streaming:true};return u;}); }
          }catch(e){ if(e.message&&!e.message.includes("JSON")) throw e; }
        }
      }
      setMessages(prev=>{const u=[...prev];u[u.length-1]={role:"assistant",content:full};return u;});
    } catch(e){
      setMessages(prev=>{const u=[...prev];u[u.length-1]={role:"assistant",content:"Fout: "+e.message};return u;});
    } finally { setStreaming(false); }
  }, [model]);

  // ── Analyse → nieuwe notitie ─────────────────────────────────────────────
  const saveAnalysisAsNote = useCallback(async () => {
    if (!messages.length || !onAddNote) return;
    setSavingNote(true);
    try {
      const assistantMsgs = messages.filter(m=>m.role==="assistant"&&m.content);
      const content = assistantMsgs.map(m=>m.content).join("\n\n---\n\n");
      const date    = new Date().toLocaleDateString("nl-NL");
      const ctxLabel= ctxNotes.length||ctxPdfs.length
        ? " (" + [...ctxNotes.slice(0,2), ...ctxPdfs.slice(0,2)].join(", ") + ")"
        : "";
      const note = {
        id: genId(),
        title: "Analyse " + date + ctxLabel,
        content: "# Notebook LLM Analyse\n\n*" + date + "*\n\n" + content,
        tags: ["analyse","llm"],
        created: new Date().toISOString(), modified: new Date().toISOString(),
      };
      await onAddNote(note);
    } catch(e){ console.error(e); }
    setSavingNote(false);
  }, [messages, ctxNotes, ctxPdfs, onAddNote]);

  // ── Mindmap genereren op basis van context ────────────────────────────────
  const generateMindmap = useCallback(async () => {
    const hasContext = ctxNotes.length || ctxPdfs.length;
    if (!hasContext) {
      setMessages(p=>[...p,{role:"assistant",
        content:"⚠ Selecteer eerst notities of PDF's in het contextpaneel (links) om een mindmap te genereren."}]);
      return;
    }
    setMmPending(true);
    try {
      const res = await api.llmMindmap({
        model, context_notes: ctxNotes, context_pdfs: ctxPdfs
      });
      if (res?.ok && res.mindmap) {
        const mm = res.mindmap;
        // Stuur naar visuele MindMap tab
        onMindmapReady?.(mm);
        // Toon ook tekstsamenvatting in chat
        let md = "## 🗺 Mindmap gegenereerd: **" + (mm.root||"Overzicht") + "**\n\n";
        md += `*${mm.branches?.length||0} hoofdtakken — bekijk de visuele weergave in het 🗺 Mindmap tab*\n\n`;
        (mm.branches||[]).forEach(b=>{
          md += "**" + b.label + "**";
          if (b.importance==="high") md += " ⭐";
          md += "\n";
          (b.children||[]).forEach(c=>{
            const lbl = typeof c==="string" ? c : c.label;
            md += "  - " + lbl + "\n";
            if (c.details?.length) {
              c.details.forEach(d=>{ md += "    · " + d + "\n"; });
            }
          });
          md += "\n";
        });
        setMessages(p=>[...p,{role:"assistant",content:md}]);
      } else {
        setMessages(p=>[...p,{role:"assistant",
          content:"⚠ Mindmap genereren mislukt: "+(res?.error||"geen JSON response van model")+
          (res?.raw ? "\n\n```\n"+res.raw.slice(0,300)+"\n```" : "")}]);
      }
    } catch(e){
      setMessages(p=>[...p,{role:"assistant",content:"⚠ "+e.message}]);
    }
    setMmPending(false);
  }, [model, ctxNotes, ctxPdfs, onMindmapReady]);

  // ── Render markdown in chat (eenvoudig) ───────────────────────────────────
  const renderMsg = (content) => {
    if (!content) return "";
    // Code blocks
    let html = content
      .replace(/```(\w*)\n?([\s\S]*?)```/g, (_,lang,code) =>
        `<pre style="background:#1a1a1a;border:1px solid #3a4046;border-radius:6px;padding:12px;overflow-x:auto;font-size:12px;line-height:1.5;margin:8px 0"><code style="color:#cae682;font-family:'Hack','Courier New',monospace">${code.trim().replace(/</g,"&lt;")}</code></pre>`)
      // Inline code
      .replace(/`([^`]+)`/g, `<code style="background:#1a1a1a;color:#cae682;padding:1px 5px;border-radius:3px;font-family:'Hack',monospace;font-size:12px">$1</code>`)
      // Bold
      .replace(/\*\*(.+?)\*\*/g, `<strong style="color:#ffffd7">$1</strong>`)
      // Headers
      .replace(/^### (.+)$/gm, `<div style="color:#8ac6f2;font-weight:bold;margin:10px 0 4px;font-size:13px">$1</div>`)
      .replace(/^## (.+)$/gm,  `<div style="color:#ffffd7;font-weight:bold;margin:12px 0 5px;font-size:14px">$1</div>`)
      .replace(/^# (.+)$/gm,   `<div style="color:#ffffd7;font-weight:bold;margin:14px 0 6px;font-size:15px">$1</div>`)
      // Lists
      .replace(/^[-*] (.+)$/gm, `<div style="margin:2px 0;padding-left:14px">• $1</div>`)
      .replace(/^\d+\. (.+)$/gm, (_,t,i) => `<div style="margin:2px 0;padding-left:14px">${_}</div>`)
      // Line breaks
      .replace(/\n\n/g, `<div style="height:8px"></div>`)
      .replace(/\n/g, `<br>`);
    return html;
  };

  // ── Status indicator ──────────────────────────────────────────────────────
  const statusDot = {
    ok:           { color: W.comment,  label: `Ollama actief · ${availModels.length} model${availModels.length!==1?"s":""}` },
    fout:         { color: W.orange,   label: "Ollama niet bereikbaar" },
    laden:        { color: W.blue,     label: "Verbinden…" },
    "geen-modellen": { color: W.yellow, label: "Ollama actief maar geen modellen" },
    onbekend:     { color: W.fgMuted,  label: "Status onbekend" },
  }[ollamaStatus] || { color: W.fgMuted, label: ollamaStatus };

  // ── Tags voor context filter ──────────────────────────────────────────────
  const allNoteTags = useMemo(() => [...new Set(notes.flatMap(n=>n.tags||[]))], [notes]);

  // ── Render ────────────────────────────────────────────────────────────────
  const isMobileView = window.innerWidth < 1200;  // tablet én mobile behandelen als "compact"

  return React.createElement("div", {
    style:{ display:"flex", flex:1, minHeight:0, background:W.bg, overflow:"hidden", position:"relative" }
  },

    // ── Context zijpaneel (inklapbaar) ──────────────────────────────────────
    React.createElement("div", {
      style:{
        width: sidebarCollapsed ? "40px" : (isMobileView ? "280px" : "260px"),
        flexShrink:0,
        background:W.bg2,
        borderRight:`1px solid ${W.splitBg}`,
        display:"flex", flexDirection:"column",
        // Op compact: overlay over de chat maar NIET over de topbar
        position: isMobileView && !sidebarCollapsed ? "absolute" : "relative",
        top:    isMobileView && !sidebarCollapsed ? 0 : "auto",
        left:   isMobileView && !sidebarCollapsed ? 0 : "auto",
        bottom: isMobileView && !sidebarCollapsed ? 0 : "auto",
        zIndex: isMobileView && !sidebarCollapsed ? 50 : "auto",
        transition:"width 0.18s ease",
        overflow:"hidden",
        boxShadow: isMobileView && !sidebarCollapsed ? "4px 0 20px rgba(0,0,0,0.5)" : "none",
      }
    },

      // ── Ingeklapte rail ────────────────────────────────────────────────────
      sidebarCollapsed
        ? React.createElement("div", {
            style:{display:"flex",flexDirection:"column",alignItems:"center",paddingTop:"10px",gap:"10px"}
          },
            // Uitklap-knop
            React.createElement("button", {
              onClick:()=>setSidebarCollapsed(false),
              title:"Filter notities",
              style:{background:"none",border:"none",cursor:"pointer",
                     color:W.fgMuted,fontSize:"16px",padding:"4px",
                     display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"}
            },
              React.createElement("span",null,"▶"),
              // teller badge
              React.createElement("span",{style:{
                fontSize:"10px",background:"rgba(138,198,242,0.15)",
                color:"#a8d8f0",borderRadius:"8px",padding:"1px 5px",
                border:"1px solid rgba(138,198,242,0.25)",lineHeight:"1.4",
                whiteSpace:"nowrap",
              }}, ctxNotes.length),
              tagFilter && React.createElement("span",{style:{
                fontSize:"9px",background:"rgba(159,202,86,0.2)",
                color:W.green,borderRadius:"8px",padding:"1px 4px",
                border:"1px solid rgba(159,202,86,0.35)",
              }},"F")
            )
          )

        // ── Uitgeklapte sidebar ──────────────────────────────────────────────
        : React.createElement(React.Fragment, null,
            // Header
            React.createElement("div", {
              style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,
                     padding:"10px 12px",flexShrink:0}
            },
              React.createElement("div", {style:{display:"flex",alignItems:"center",gap:"8px",marginBottom:"8px"}},
                React.createElement("span", {style:{fontSize:"13px",fontWeight:"bold",
                  color:W.statusFg,letterSpacing:"1.5px",flex:1}}, "FILTER NOTITIES"),
                React.createElement("button", {
                  onClick:()=>setSidebarCollapsed(true),
                  title:"Sidebar inklappen",
                  style:{background:"none",border:"none",color:W.fgMuted,
                         fontSize:"14px",cursor:"pointer",padding:"2px 4px",lineHeight:1}
                }, "◀")
              ),
              // Context teller
              React.createElement("div",{style:{fontSize:"12px",color:"#a8d8f0",marginBottom:"8px",
                background:"rgba(138,198,242,0.08)",borderRadius:"4px",padding:"4px 8px",
                border:"1px solid rgba(138,198,242,0.2)"}},
                `📚 ${ctxNotes.length} notitie${ctxNotes.length!==1?"s":""} in context`
                + (tagFilter ? ` · filter: #${tagFilter}` : " · alle")
              ),
              // Tag-filter
              allNoteTags.length > 0 && React.createElement("div",null,
                React.createElement("span",{style:{fontSize:"9px",color:W.fgMuted,display:"block",
                  marginBottom:"4px",letterSpacing:"1px"}},"FILTER OP TAG:"),
                React.createElement(TagFilterBar,{tags:allNoteTags,activeTag:tagFilter,
                  onChange:setTagFilter,compact:true,maxVisible:6})
              )
            ),

            // Notities lijst
            React.createElement("div", {style:{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch", minHeight:0,}},

        // Notities sectie
        React.createElement("div", {
          style:{padding:"8px 10px 4px",fontSize:"11px",fontWeight:"600",color:"rgba(138,198,242,0.75)",
                 letterSpacing:"1.5px",borderBottom:`1px solid ${W.splitBg}`,
                 display:"flex",alignItems:"center",gap:"6px",background:W.bg}
        },
          React.createElement("span",null,"NOTITIES"),
          React.createElement("span",{style:{background:W.blue,color:W.bg,borderRadius:"8px",
            padding:"1px 6px",fontSize:"11px",fontWeight:"500",borderRadius:"4px",background:"rgba(138,198,242,0.1)"}},ctxNotes.length+"/"+filteredNotes.length)
        ),
        filteredNotes.map(n => {
          const sel = ctxNotes.includes(n.id);
          return React.createElement("div", {
            key:n.id,
            onClick:()=>setCtxNotes(p=>sel?p.filter(x=>x!==n.id):[...p,n.id]),
            style:{
              padding:"7px 12px",borderBottom:`1px solid rgba(255,255,255,0.03)`,
              cursor:"pointer",display:"flex",alignItems:"flex-start",gap:"8px",
              background:sel?"rgba(138,198,242,0.08)":"transparent",
              borderLeft:`3px solid ${sel?"rgba(138,198,242,0.6)":"transparent"}`,
            }
          },
            React.createElement("div", {
              style:{width:"14px",height:"14px",borderRadius:"3px",flexShrink:0,marginTop:"1px",
                     background:sel?"rgba(138,198,242,0.3)":"transparent",
                     border:`1.5px solid ${sel?"rgba(138,198,242,0.7)":"rgba(255,255,255,0.15)"}`,
                     display:"flex",alignItems:"center",justifyContent:"center"}
            }, sel && React.createElement("span",{style:{fontSize:"9px",color:"#a8d8f0",lineHeight:1}},"✓")),
            React.createElement("div", {style:{minWidth:0}},
              React.createElement("div",{style:{fontSize:"14px",color:sel?W.fg:W.fgDim,
                lineHeight:"1.3",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}, n.title),
              (n.tags||[]).length>0 && React.createElement("div",{style:{marginTop:"3px",display:"flex",gap:"3px",flexWrap:"wrap"}},
                (n.tags||[]).slice(0,3).map(t=>React.createElement("span",{key:t,
                  style:{fontSize:"11px",color:"#b8e06a",fontWeight:"500",
                         background:"rgba(159,202,86,0.12)",
                         borderRadius:"4px",padding:"1px 6px",lineHeight:"1.3",
                         border:"1px solid rgba(159,202,86,0.35)"}
                },"#"+t))
              )
            )
          );
        }),

        // Afbeeldingen sectie
        (serverImages||[]).length > 0 && React.createElement(React.Fragment, null,
          React.createElement("div", {
            style:{padding:"8px 10px 4px",fontSize:"9px",
                   color:"rgba(229,193,120,0.6)",
                   letterSpacing:"1.5px",borderBottom:`1px solid ${W.splitBg}`,
                   display:"flex",alignItems:"center",gap:"6px",background:W.bg}
          },
            React.createElement("span",null,"AFBEELDINGEN"),
            React.createElement("span",{style:{background:W.yellow,color:W.bg,borderRadius:"8px",
              padding:"0 5px",fontSize:"9px"}},ctxImages.length+"/"+(serverImages||[]).length)
          ),
          (serverImages||[]).map(img => {
            const sel = ctxImages.includes(img.name);
            return React.createElement("div", {
              key:img.name,
              onClick:()=>setCtxImages(p=>sel?p.filter(x=>x!==img.name):[...p,img.name]),
              style:{
                padding:"7px 12px",borderBottom:`1px solid rgba(255,255,255,0.03)`,
                cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",
                background:sel?"rgba(229,193,120,0.07)":"transparent",
                borderLeft:`3px solid ${sel?"rgba(229,193,120,0.5)":"transparent"}`,
              }
            },
              React.createElement("div", {
                style:{width:"14px",height:"14px",borderRadius:"3px",flexShrink:0,
                       background:sel?"rgba(229,193,120,0.25)":"transparent",
                       border:`1.5px solid ${sel?"rgba(229,193,120,0.6)":"rgba(255,255,255,0.15)"}`,
                       display:"flex",alignItems:"center",justifyContent:"center"}
              }, sel&&React.createElement("span",{style:{fontSize:"9px",color:W.yellow,lineHeight:1}},"✓")),
              React.createElement("img",{src:img.url,alt:img.name,
                style:{width:"28px",height:"28px",objectFit:"cover",borderRadius:"3px",
                       flexShrink:0,background:W.lineNrBg}}),
              React.createElement("div",{style:{minWidth:0,fontSize:"14px",
                color:sel?W.fg:W.fgDim,overflow:"hidden",
                textOverflow:"ellipsis",whiteSpace:"nowrap"}},img.name)
            );
          })
        ),

        // PDF's sectie — alle PDFs tonen, ook zonder annotaties
        pdfsWithAnnots.length > 0 && React.createElement(React.Fragment, null,
          React.createElement("div", {
            style:{padding:"8px 10px 4px",fontSize:"9px",color:"rgba(229,120,109,0.6)",
                   letterSpacing:"1.5px",borderBottom:`1px solid ${W.splitBg}`,
                   display:"flex",alignItems:"center",gap:"6px",background:W.bg}
          },
            React.createElement("span",null,"PDF'S"),
            React.createElement("span",{style:{background:W.orange,color:W.bg,borderRadius:"8px",
              padding:"0 5px",fontSize:"9px"}},ctxPdfs.length+"/"+pdfsWithAnnots.length)
          ),
          pdfsWithAnnots.map(p => {
            const sel = ctxPdfs.includes(p.name);
            return React.createElement("div", {
              key:p.name,
              onClick:()=>setCtxPdfs(prev=>sel?prev.filter(x=>x!==p.name):[...prev,p.name]),
              style:{
                padding:"7px 12px",borderBottom:`1px solid rgba(255,255,255,0.03)`,
                cursor:"pointer",display:"flex",alignItems:"flex-start",gap:"8px",
                background:sel?"rgba(229,120,109,0.07)":"transparent",
                borderLeft:`3px solid ${sel?"rgba(229,120,109,0.5)":"transparent"}`,
              }
            },
              React.createElement("div", {
                style:{width:"14px",height:"14px",borderRadius:"3px",flexShrink:0,marginTop:"1px",
                       background:sel?"rgba(229,120,109,0.25)":"transparent",
                       border:`1.5px solid ${sel?"rgba(229,120,109,0.6)":"rgba(255,255,255,0.15)"}`,
                       display:"flex",alignItems:"center",justifyContent:"center"}
              }, sel && React.createElement("span",{style:{fontSize:"9px",color:W.orange,lineHeight:1}},"✓")),
              React.createElement("div",{style:{minWidth:0}},
                React.createElement("div",{style:{fontSize:"14px",color:sel?W.fg:W.fgDim,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}, "📄 "+p.name),
                React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,marginTop:"2px"}},
                  p.annotCount > 0
                    ? p.annotCount+" annotatie"+(p.annotCount!==1?"s":"")
                    : "geen annotaties — tekst via AI")
              )
            );
          })
        ),
      )   // einde notities-lijst div
    )     // einde React.Fragment (uitgeklapt)
    ),    // einde sidebar-div

    // ── Hoofd chat kolom ─────────────────────────────────────────────────────
    React.createElement("div", {
      style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0,minHeight:0}
    },

      // Chat toolbar
      React.createElement("div", {
        style:{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,
               padding:"6px 12px",display:"flex",alignItems:"center",
               gap:"8px",flexShrink:0,flexWrap:"wrap"}
      },
        // Filter-sidebar toggle (vervangt oude context-toggle)
        React.createElement("button", {
          onClick:()=>setSidebarCollapsed(p=>!p),
          title: sidebarCollapsed ? "Filter notities op tag" : "Sidebar inklappen",
          style:{background:!sidebarCollapsed?"rgba(138,198,242,0.15)":"rgba(255,255,255,0.04)",
                 border:`1px solid ${!sidebarCollapsed?"rgba(138,198,242,0.4)":W.splitBg}`,
                 color:!sidebarCollapsed?"#a8d8f0":W.fgMuted,
                 borderRadius:"5px",padding:"4px 10px",fontSize:"14px",cursor:"pointer",
                 display:"flex",alignItems:"center",gap:"6px"}
        },
          React.createElement("span",null, sidebarCollapsed ? "▶" : "◀"),
          React.createElement("span",null, "filter"),
          tagFilter && React.createElement("span",{style:{
            fontSize:"11px",background:"rgba(159,202,86,0.2)",color:W.green,
            borderRadius:"8px",padding:"1px 6px",border:"1px solid rgba(159,202,86,0.35)"
          }}, "#"+tagFilter)
        ),

        // Context badge — altijd zichtbaar
        React.createElement("span", {
          style:{fontSize:"14px",color:"#a8d8f0",background:"rgba(138,198,242,0.08)",
                 border:"1px solid rgba(138,198,242,0.2)",borderRadius:"10px",
                 padding:"2px 8px"}
        }, `📚 ${ctxNotes.length} notitie${ctxNotes.length!==1?"s":""}` +
           (ctxPdfs.length ? ` + ${ctxPdfs.length} PDF` : "") +
           (ctxExtPdfs.length ? ` + ${ctxExtPdfs.length} ext.` : "") +
           (tagFilter ? ` · #${tagFilter}` : "")
        ),

        // Externe PDF's knop
        React.createElement("button", {
          onClick:()=>{ setShowExtPanel(p=>!p); if(!showExtPanel) browseTo(""); },
          style:{background:showExtPanel?"rgba(180,140,255,0.2)":"none",
                 border:`1px solid ${showExtPanel?"rgba(180,140,255,0.5)":W.splitBg}`,
                 color:showExtPanel?"rgba(180,140,255,0.9)":W.fgMuted,
                 borderRadius:"5px",padding:"4px 10px",fontSize:"14px",cursor:"pointer",
                 display:"flex",alignItems:"center",gap:"5px"}
        },
          React.createElement("span",null,"📂"),
          "ext. PDF's",
          ctxExtPdfs.length>0 && React.createElement("span",{style:{
            background:"rgba(180,140,255,0.3)",borderRadius:"8px",
            padding:"0 5px",fontSize:"9px",color:"rgba(180,140,255,0.9)"}},
            ctxExtPdfs.length)
        ),

        React.createElement("div",{style:{flex:1}}),

        // Model badge — toont actief model (wijzigen via statusbalk)
        React.createElement("div",{
          style:{display:"flex",alignItems:"center",gap:"6px",
                 background:"rgba(255,255,255,0.04)",
                 border:`1px solid ${W.splitBg}`,
                 borderRadius:"6px",padding:"3px 10px",fontSize:"13px"}
        },
          React.createElement("div",{style:{width:"7px",height:"7px",borderRadius:"50%",
            background:statusDot.color,flexShrink:0,cursor:"pointer"},
            onClick:checkOllama,title:"Klik om opnieuw te verbinden"}),
          React.createElement("span",{style:{color:W.fgMuted}}, MODEL_LABEL(model) || model),
        ),

        // Install button als Ollama niet bereikbaar
        (ollamaStatus==="fout"||ollamaStatus==="geen-modellen") && React.createElement("button",{
          onClick:()=>setShowInstall(p=>!p),
          style:{background:"none",border:`1px solid ${W.orange}`,color:W.orange,
                 borderRadius:"4px",padding:"3px 8px",fontSize:"14px",cursor:"pointer"}
        },"? installatie"),

        // GraphRAG toggle
        React.createElement("button", {
          onClick:()=>setGraphRagMode(p=>!p),
          title: graphRagMode
            ? "GraphRAG actief — klik om uit te zetten"
            : "GraphRAG uit — klik om aan te zetten (AI gebruikt graaf-structuur als context)",
          style:{
            background: graphRagMode?"rgba(234,231,136,0.15)":"rgba(255,255,255,0.04)",
            border:`1px solid ${graphRagMode?"rgba(234,231,136,0.5)":W.splitBg}`,
            color: graphRagMode?W.yellow:W.fgMuted,
            borderRadius:"4px",padding:"3px 10px",fontSize:"14px",cursor:"pointer",
            display:"flex",alignItems:"center",gap:"5px",
            boxShadow: graphRagMode?"0 0 8px rgba(234,231,136,0.15)":"none",
            transition:"all 0.15s",
          }
        },
          React.createElement("span",{style:{fontSize:"13px"}},"🕸"),
          graphRagMode?"GraphRAG ✓":"GraphRAG"
        ),

        // Mindmap knop
        ctxNotes.length>0 && React.createElement("button", {
          onClick:generateMindmap, disabled:mmPending,
          style:{background:"rgba(138,198,242,0.08)",
                 border:"1px solid rgba(138,198,242,0.25)",
                 color:mmPending?W.fgMuted:"#a8d8f0",
                 borderRadius:"4px",padding:"3px 10px",fontSize:"14px",cursor:"pointer"}
        }, mmPending?"🗺 genereren…":"🗺 mindmap"),

        // Hiaat-analyse knop
        React.createElement("button", {
          onClick: runHiaatAnalyse,
          disabled: streaming,
          title:"Analyseer kennishiaten en zwakke verbindingen in je Zettelkasten",
          style:{
            background:"rgba(229,120,109,0.08)",
            border:"1px solid rgba(229,120,109,0.25)",
            color: streaming?W.fgMuted:W.orange,
            borderRadius:"4px",padding:"3px 10px",fontSize:"14px",cursor:"pointer",
            display:"flex",alignItems:"center",gap:"5px",
          }
        },
          React.createElement("span",{style:{fontSize:"13px"}},"🔍"),
          "hiaten"
        ),

        // Analyse → notitie
        messages.length>0 && onAddNote && React.createElement("button", {
          onClick:saveAnalysisAsNote, disabled:savingNote,
          style:{background:"rgba(159,202,86,0.08)",
                 border:"1px solid rgba(159,202,86,0.25)",
                 color:savingNote?W.fgMuted:W.comment,
                 borderRadius:"4px",padding:"3px 10px",fontSize:"14px",cursor:"pointer"}
        }, savingNote?"💾 opslaan…":"💾 → notitie"),

        // Clear
        messages.length > 0 && React.createElement("button", {
          onClick:clearChat,
          style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                 borderRadius:"4px",padding:"3px 8px",fontSize:"14px",cursor:"pointer"}
        }, "✕ wis chat")
      ),

      // Installatie instructies
      showInstall && React.createElement("div", {
        style:{background:"rgba(229,120,109,0.06)",borderBottom:`1px solid rgba(229,120,109,0.2)`,
               padding:"14px 16px",fontSize:"14px",flexShrink:0}
      },
        React.createElement("div",{style:{color:W.orange,fontWeight:"bold",marginBottom:"10px",
          fontSize:"14px"}},"Ollama installatie"),
        React.createElement("div",{style:{color:W.fgDim,marginBottom:"10px",lineHeight:"1.7"}},
          "Ollama draait lokale LLM modellen op je eigen machine. Geen internet vereist, volledig privé."
        ),
        // Stappen
        [
          { label:"1. Installeer Ollama", code:"curl -fsSL https://ollama.com/install.sh | sh" },
          { label:"2. Start de server",   code:"ollama serve" },
          { label:"3. Download een model (kies één):", code:null },
        ].map(({label,code},i) => React.createElement("div",{key:i,style:{marginBottom:"8px"}},
          React.createElement("div",{style:{fontSize:"14px",color:W.fgMuted,marginBottom:"3px"}},label),
          code && React.createElement("code",{style:{display:"block",background:"#1a1a1a",
            color:"#cae682",padding:"6px 10px",borderRadius:"4px",fontFamily:"'Hack',monospace",fontSize:"14px"}},code)
        )),
        // Model opties
        React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"6px",marginTop:"8px"}},
          SUGGESTED_MODELS.map(m => React.createElement("div",{key:m.id,
            style:{background:"rgba(0,0,0,0.2)",border:`1px solid ${W.splitBg}`,
                   borderRadius:"5px",padding:"7px 10px"}},
            React.createElement("code",{style:{color:"#cae682",fontSize:"14px",fontFamily:"'Hack',monospace"}},
              "ollama pull "+m.id),
            React.createElement("div",{style:{fontSize:"14px",color:W.fgMuted,marginTop:"3px"}},m.label+" — "+m.desc)
          ))
        ),
        React.createElement("button",{
          onClick:checkOllama,
          style:{marginTop:"12px",background:W.blue,color:W.bg,border:"none",
                 borderRadius:"5px",padding:"6px 16px",fontSize:"14px",cursor:"pointer",fontWeight:"bold"}
        },"🔄 Opnieuw verbinden")
      ),

      // ── Chat berichten ──────────────────────────────────────────────────────
      React.createElement("div", {
        ref: chatAreaRef,
        onMouseUp: handleChatMouseUp,
        style:{flex:1,overflowY:"auto",padding:"16px",
               display:"flex",flexDirection:"column",gap:"12px",
               WebkitOverflowScrolling:"touch",
               position:"relative", minHeight:0,}
      },
        // Selectie-popup: zweeft boven geselecteerde tekst
        selectionPopup && React.createElement("div",{
          style:{
            position:"fixed",
            left: (chatAreaRef.current?.getBoundingClientRect().left||0) + selectionPopup.x,
            top:  (chatAreaRef.current?.getBoundingClientRect().top||0)  + selectionPopup.y,
            transform:"translate(-50%, -100%)",
            zIndex:200,
            background:W.bg3,
            border:`1px solid ${W.comment}`,
            borderRadius:"8px",
            boxShadow:"0 4px 16px rgba(0,0,0,0.5)",
            display:"flex",
            overflow:"hidden",
          }
        },
          React.createElement("button",{
            onMouseDown: e => { e.preventDefault(); pasteToNote(selectionPopup.text, MODEL_LABEL(model)||model); },
            style:{
              background:"none", border:"none",
              color:W.comment, padding:"7px 14px",
              fontSize:"13px", cursor:"pointer", fontWeight:"bold",
              display:"flex", alignItems:"center", gap:"6px",
              whiteSpace:"nowrap",
            }
          },
            React.createElement("span",null,"↙"),
            "plak selectie in notitie"
          ),
          React.createElement("div",{style:{width:"1px",background:W.splitBg}}),
          React.createElement("button",{
            onMouseDown: e => { e.preventDefault(); setSelectionPopup(null); window.getSelection()?.removeAllRanges(); },
            style:{background:"none",border:"none",color:W.fgDim,padding:"7px 10px",fontSize:"14px",cursor:"pointer"}
          },"✕")
        ),
        // Welkomstbericht als er geen berichten zijn
        messages.length === 0 && React.createElement("div", {
          style:{display:"flex",flexDirection:"column",alignItems:"center",
                 justifyContent:"center",height:"100%",gap:"16px",
                 color:W.fgMuted,textAlign:"center",padding:"0 24px"}
        },
          React.createElement("div",{style:{fontSize:"48px"}},"🧠"),
          React.createElement("div",{style:{fontSize:"16px",color:W.fgDim,fontWeight:"bold"}},
            "Notebook LLM"),
          React.createElement("div",{style:{fontSize:"14px",maxWidth:"420px",lineHeight:"1.8"}},
            "Stel vragen over je notities en PDF-annotaties. " +
            "Selecteer context in het linkerpaneel om de LLM kennis te geven over je zettelkasten."
          ),
          // Split-modus tip als onPasteToNote beschikbaar is
          onPasteToNote && React.createElement("div",{
            style:{display:"flex",alignItems:"center",gap:"10px",
                   background:"rgba(159,202,86,0.08)",
                   border:"1px solid rgba(159,202,86,0.25)",
                   borderRadius:"10px",padding:"10px 16px",
                   fontSize:"13px",color:W.comment,maxWidth:"420px"}
          },
            React.createElement("span",{style:{fontSize:"20px",flexShrink:0}},"↙"),
            React.createElement("span",null,
              "Split-modus actief — hover over een antwoord en klik ",
              React.createElement("strong",null,"↙ plak in notitie"),
              ", of selecteer tekst voor een gedeeltelijk citaat."
            )
          ),
          // Suggesties
          React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:"8px",justifyContent:"center",maxWidth:"520px"}},
            [
              "Geef een overzicht van mijn notities",
              "Welke verbanden zie je tussen de notities?",
              "Maak een samenvatting van de geselecteerde PDF-annotaties",
              "Welke thema's komen het meest voor?",
              "Stel verdiepende vragen over dit onderwerp",
            ].map(s => React.createElement("button",{key:s,
              onClick:()=>{ setInput(s); setTimeout(()=>inputRef.current?.focus(),0); },
              style:{background:"rgba(138,198,242,0.07)",border:"1px solid rgba(138,198,242,0.2)",
                     color:"rgba(168,216,240,0.8)",borderRadius:"16px",padding:"6px 14px",
                     fontSize:"14px",cursor:"pointer",WebkitTapHighlightColor:"transparent"}
            },s))
          )
        ),

        // Berichten
        messages.map((msg, i) => React.createElement("div", {
          key:i,
          style:{
            display:"flex",
            flexDirection:"column",
            alignItems: msg.role==="user" ? "flex-end" : "flex-start",
            gap:"4px",
          }
        },
          // Rol label
          React.createElement("div",{style:{fontSize:"9px",color:W.fgMuted,letterSpacing:"1px",
            marginBottom:"2px",paddingLeft: msg.role==="user"?"0":"4px"}},
            msg.role==="user" ? "JIJ" : model.toUpperCase()
          ),
          // Bericht bubble + plak-knop wrapper
          React.createElement("div",{
            style:{maxWidth:"85%", position:"relative"},
            className:"chat-msg-wrap",
          },
            // Bericht bubble
            React.createElement("div",{style:{
              background: msg.role==="user"
                ? "rgba(138,198,242,0.12)"
                : msg.error ? "rgba(229,120,109,0.1)" : W.bg2,
              border: msg.role==="user"
                ? "1px solid rgba(138,198,242,0.25)"
                : msg.error ? "1px solid rgba(229,120,109,0.3)" : `1px solid ${W.splitBg}`,
              borderRadius: msg.role==="user" ? "12px 12px 3px 12px" : "3px 12px 12px 12px",
              padding:"10px 14px",
              fontSize:"14px",
              lineHeight:"1.7",
              color: msg.error ? W.orange : W.fg,
            }},
              msg.error
                ? React.createElement("div",null,
                    React.createElement("div",{style:{fontWeight:"bold",marginBottom:"5px"}},"⚠ Fout"),
                    React.createElement("div",{style:{fontSize:"14px"}},msg.error),
                    React.createElement("button",{onClick:checkOllama,
                      style:{marginTop:"8px",background:"none",border:`1px solid ${W.orange}`,
                             color:W.orange,borderRadius:"4px",padding:"3px 8px",
                             fontSize:"14px",cursor:"pointer"}},"Ollama status controleren")
                  )
                : msg.role==="user"
                  ? React.createElement("div",null,msg.content)
                  : React.createElement("div",{
                      dangerouslySetInnerHTML:{__html:renderMsg(msg.content)+(msg.streaming?"<span style='color:#8ac6f2;animation:blink 1s infinite'>▊</span>":"")}
                    })
            ),
            // Plak-knop — alleen voor assistant berichten als onPasteToNote beschikbaar + niet streaming
            onPasteToNote && msg.role==="assistant" && !msg.streaming && msg.content && React.createElement("div",{
              className:"chat-paste-btn",
              style:{
                position:"absolute", bottom:"-1px", right:"-1px",
                opacity:0, transition:"opacity 0.15s",
                display:"flex", gap:"4px",
              }
            },
              // Plak volledig bericht
              React.createElement("button",{
                onClick:()=>pasteToNote(msg.content, MODEL_LABEL(model)||model),
                title:"Plak volledig antwoord in de actieve notitie",
                style:{
                  background:W.bg3, border:`1px solid ${W.splitBg}`,
                  color:W.comment, borderRadius:"0 0 10px 6px",
                  padding:"3px 10px", fontSize:"12px", cursor:"pointer",
                  display:"flex", alignItems:"center", gap:"4px",
                  whiteSpace:"nowrap",
                }
              },
                React.createElement("span",null,"↙"),
                "plak in notitie"
              )
            )
          )
        )),
        React.createElement("div",{ref:chatEndRef})
      ),

      // ── Invoerbalk ─────────────────────────────────────────────────────────
      React.createElement("div", {
        style:{borderTop:`1px solid ${graphRagMode?"rgba(234,231,136,0.3)":W.splitBg}`,
               padding:"12px", background:W.bg, flexShrink:0,
               boxShadow: graphRagMode?"0 -2px 12px rgba(234,231,136,0.06)":"none",
               transition:"all 0.2s"}
      },
        // GraphRAG actief-banner
        graphRagMode && React.createElement("div",{
          style:{display:"flex",alignItems:"center",gap:"8px",
                 marginBottom:"8px",padding:"6px 10px",
                 background:"rgba(234,231,136,0.07)",
                 border:"1px solid rgba(234,231,136,0.2)",
                 borderRadius:"6px",fontSize:"12px",color:W.yellow}
        },
          React.createElement("span",null,"🕸"),
          React.createElement("span",null,
            "GraphRAG actief — je vraag gebruikt de volledige kennisgraaf als context"
          ),
          React.createElement("span",{
            onClick:()=>setGraphRagMode(false),
            style:{marginLeft:"auto",cursor:"pointer",color:W.fgDim,fontSize:"14px"}
          },"✕")
        ),
        React.createElement("div",{style:{display:"flex",gap:"8px",alignItems:"flex-end"}},
          React.createElement("textarea",{
            ref:inputRef,
            value:input,
            onChange:e=>setInput(e.target.value),
            onKeyDown:handleKeyDown,
            placeholder: graphRagMode
              ? "Stel een vraag over je volledige kennisbasis… (GraphRAG)"
              : ollamaStatus==="ok"
                ? "Stel een vraag… (Enter=verstuur · Shift+Enter=nieuwe regel)"
                : "Start Ollama om vragen te stellen…",
            disabled: streaming || ollamaStatus==="laden",
            rows:1,
            style:{
              flex:1,background:W.bg2,
              border:`1px solid ${graphRagMode?"rgba(234,231,136,0.35)":W.splitBg}`,
              borderRadius:"8px",padding:"10px 14px",color:W.fg,
              fontSize:"14px",outline:"none",resize:"none",
              lineHeight:"1.5",maxHeight:"120px",overflowY:"auto",
              WebkitAppearance:"none",
              opacity: (streaming||ollamaStatus==="laden") ? 0.6 : 1,
              transition:"border-color 0.2s",
            },
            onInput:(e)=>{
              e.target.style.height="auto";
              e.target.style.height=Math.min(e.target.scrollHeight,120)+"px";
            }
          }),
          React.createElement("button",{
            onClick: streaming ? ()=>{} : send,
            disabled: !input.trim() || (ollamaStatus!=="ok" && !graphRagMode),
            style:{
              background: streaming ? W.fgMuted : graphRagMode ? W.yellow : W.blue,
              color: graphRagMode ? W.bg : W.bg,
              border:"none",borderRadius:"8px",
              padding:"10px 16px",fontSize:"14px",cursor: streaming?"not-allowed":"pointer",
              fontWeight:"bold",flexShrink:0,alignSelf:"flex-end",
              height:"40px",minWidth:"64px",
              opacity: (!input.trim()) ? 0.5 : 1,
              transition:"background 0.2s",
            }
          }, streaming ? "⏳" : graphRagMode ? "🕸 Ask" : "↑ Send")
        ),
        // Context hint — altijd tonen
        React.createElement("div",{
          style:{marginTop:"6px",fontSize:"11px",color:graphRagMode?W.yellow:W.fgMuted,
                 display:"flex",alignItems:"center",gap:"6px"}
        },
          React.createElement("span",null,
            graphRagMode
              ? `🕸 GraphRAG · ${ctxNotes.length} notitie${ctxNotes.length!==1?"s":""} + graafstructuur`
              : `📚 ${ctxNotes.length} notitie${ctxNotes.length!==1?"s":""}` +
                (ctxPdfs.length?` + ${ctxPdfs.length} PDF`:"") +
                (ctxExtPdfs.length?` + ${ctxExtPdfs.length} ext.`:"") +
                " meegestuurd" +
                (tagFilter?` · filter: #${tagFilter}`:"")
          )
        )
      )
    ),

    // ── Rechter zijbalk: Externe PDF's ──────────────────────────────────────
    showExtPanel && React.createElement("div", {
      style:{
        width:"300px", flexShrink:0, background:W.bg2,
        borderLeft:`1px solid ${W.splitBg}`,
        display:"flex", flexDirection:"column", overflow:"hidden",
      }
    },

      // Header
      React.createElement("div",{style:{
        padding:"10px 12px", borderBottom:`1px solid ${W.splitBg}`,
        flexShrink:0, background:W.bg2
      }},
        React.createElement("div",{style:{display:"flex",alignItems:"center",marginBottom:"8px"}},
          React.createElement("span",{style:{
            fontSize:"14px",fontWeight:"bold",color:"rgba(180,140,255,0.9)",
            letterSpacing:"1.5px",flex:1
          }},"📂 EXTERNE PDF'S"),
          React.createElement("button",{
            onClick:()=>setShowExtPanel(false),
            style:{background:"none",border:"none",color:W.fgMuted,
                   fontSize:"18px",cursor:"pointer",padding:"0 2px",lineHeight:1}
          },"×")
        ),
        // Modus tabs
        React.createElement("div",{style:{display:"flex",gap:"4px",marginBottom:"8px"}},
          ["dirs","browser"].map(m=>
            React.createElement("button",{key:m,
              onClick:()=>{ setBrowseMode(m); if(m==="browser") browseTo(browsePath||""); },
              style:{flex:1,background:browseMode===m?"rgba(180,140,255,0.15)":"none",
                     border:`1px solid ${browseMode===m?"rgba(180,140,255,0.4)":W.splitBg}`,
                     borderRadius:"4px",padding:"4px 0",fontSize:"11px",cursor:"pointer",
                     color:browseMode===m?"rgba(180,140,255,0.9)":W.fgMuted}
            }, m==="dirs" ? "📋 Mijn mappen" : "🗂 Bladeren")
          )
        ),

        // Geselecteerde teller + wis
        ctxExtPdfs.length > 0 && React.createElement("div",{style:{
          display:"flex",alignItems:"center",gap:"6px",
          background:"rgba(180,140,255,0.08)",border:"1px solid rgba(180,140,255,0.2)",
          borderRadius:"5px",padding:"4px 8px"
        }},
          React.createElement("span",{style:{fontSize:"11px",color:"rgba(180,140,255,0.8)",flex:1}},
            ctxExtPdfs.length+" PDF"+(ctxExtPdfs.length>1?"'s":"")+" geselecteerd"),
          React.createElement("button",{
            onClick:()=>setCtxExtPdfs([]),
            style:{background:"none",border:"none",color:W.orange,
                   fontSize:"11px",cursor:"pointer",padding:0}
          },"× wis")
        )
      ),

      // ── MODUS: Mijn mappen ──────────────────────────────────────────────
      browseMode==="dirs" && React.createElement("div",{
        style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}
      },
        // Pad toevoegen
        React.createElement("div",{style:{padding:"8px 10px",borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}},
          React.createElement("div",{style:{fontSize:"9px",color:"rgba(180,140,255,0.5)",
            letterSpacing:"1px",marginBottom:"5px"}},"MAP TOEVOEGEN"),
          React.createElement("div",{style:{display:"flex",gap:"4px"}},
            React.createElement("input",{
              value:newExtDir, onChange:e=>setNewExtDir(e.target.value),
              placeholder:"/pad/naar/map",
              onKeyDown:e=>{ if(e.key==="Enter"&&newExtDir.trim()){
                saveExtDirs([...extPdfDirs,newExtDir.trim()]); setNewExtDir("");
              }},
              style:{flex:1,background:W.bg,border:`1px solid rgba(180,140,255,0.3)`,
                     borderRadius:"4px",padding:"5px 7px",color:"rgba(180,140,255,0.8)",
                     fontSize:"11px",outline:"none",fontFamily:"'Hack',monospace"}
            }),
            React.createElement("button",{
              onClick:()=>{ if(!newExtDir.trim()) return;
                saveExtDirs([...extPdfDirs,newExtDir.trim()]); setNewExtDir(""); },
              style:{background:"rgba(180,140,255,0.15)",border:"1px solid rgba(180,140,255,0.3)",
                     borderRadius:"4px",padding:"5px 10px",color:"rgba(180,140,255,0.8)",
                     fontSize:"13px",cursor:"pointer"}
            },"+"),
            React.createElement("button",{
              onClick:loadExtPdfs, disabled:extPdfLoading,
              title:"Vernieuwen",
              style:{background:"none",border:`1px solid ${W.splitBg}`,
                     borderRadius:"4px",padding:"5px 7px",color:W.fgMuted,
                     fontSize:"11px",cursor:"pointer"}
            }, extPdfLoading?"…":"↻")
          )
        ),

        // Geconfigureerde mappen
        extPdfDirs.length > 0 && React.createElement("div",{
          style:{padding:"6px 10px",borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}
        },
          extPdfDirs.map((d,i)=>
            React.createElement("div",{key:i,style:{display:"flex",alignItems:"center",
              gap:"5px",padding:"3px 0",borderBottom:`1px solid rgba(255,255,255,0.03)`}},
              React.createElement("span",{
                onClick:()=>{ setBrowseMode("browser"); browseTo(d); },
                style:{flex:1,fontSize:"10px",color:"rgba(180,140,255,0.7)",
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                  fontFamily:"'Hack',monospace",cursor:"pointer",
                  padding:"2px 0",
                  textDecoration:"underline",textDecorationColor:"rgba(180,140,255,0.3)"}
              }, "📁 "+d),
              React.createElement("button",{
                onClick:()=>saveExtDirs(extPdfDirs.filter((_,j)=>j!==i)),
                style:{background:"none",border:"none",color:W.orange,
                       fontSize:"12px",cursor:"pointer",padding:"0 2px",flexShrink:0}
              },"×")
            )
          )
        ),

        // Zoekbalk
        React.createElement("div",{style:{padding:"6px 10px",borderBottom:`1px solid ${W.splitBg}`,flexShrink:0}},
          React.createElement("input",{
            value:extPdfSearch, onChange:e=>setExtPdfSearch(e.target.value),
            placeholder:"🔍 PDF zoeken in mappen…",
            style:{width:"100%",background:W.bg,
                   border:`1px solid ${extPdfSearch?"rgba(180,140,255,0.5)":W.splitBg}`,
                   borderRadius:"4px",padding:"5px 8px",color:W.fg,
                   fontSize:"11px",outline:"none",boxSizing:"border-box",fontFamily:"inherit"}
          })
        ),

        // PDF-lijst
        React.createElement("div",{style:{flex:1,overflowY:"auto", minHeight:0, WebkitOverflowScrolling:"touch",}},
          (() => {
            const filtered = extPdfFiles.filter(f=>
              !extPdfSearch||f.name.toLowerCase().includes(extPdfSearch.toLowerCase()));
            if(filtered.length===0) return React.createElement("div",{style:{
              padding:"20px",fontSize:"11px",color:W.fgMuted,textAlign:"center",lineHeight:"1.8"}},
              extPdfDirs.length===0 ? "Voeg een map toe\nom PDF's te laden"
              : extPdfLoading ? "Laden…"
              : extPdfSearch ? "Geen resultaten"
              : "Geen PDF's gevonden");
            return filtered.map(f => {
              const sel = ctxExtPdfs.includes(f.path);
              return React.createElement("div",{key:f.path,
                onClick:()=>setCtxExtPdfs(prev=>sel?prev.filter(x=>x!==f.path):[...prev,f.path]),
                style:{padding:"7px 12px",borderBottom:`1px solid rgba(255,255,255,0.03)`,
                       cursor:"pointer",display:"flex",alignItems:"flex-start",gap:"8px",
                       background:sel?"rgba(180,140,255,0.1)":"transparent",
                       borderLeft:`3px solid ${sel?"rgba(180,140,255,0.6)":"transparent"}`}
              },
                React.createElement("div",{style:{width:"15px",height:"15px",borderRadius:"3px",
                  flexShrink:0,marginTop:"1px",
                  background:sel?"rgba(180,140,255,0.3)":"transparent",
                  border:`1.5px solid ${sel?"rgba(180,140,255,0.7)":"rgba(255,255,255,0.15)"}`,
                  display:"flex",alignItems:"center",justifyContent:"center"}},
                  sel&&React.createElement("span",{style:{fontSize:"10px",
                    color:"rgba(180,140,255,1)",lineHeight:1,fontWeight:"bold"}},"✓")),
                React.createElement("div",{style:{minWidth:0,flex:1}},
                  React.createElement("div",{style:{fontSize:"12px",
                    color:sel?"rgba(180,140,255,0.95)":W.fgDim,
                    overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
                    "📄 "+f.name),
                  React.createElement("div",{style:{fontSize:"9px",color:"rgba(180,140,255,0.35)",
                    marginTop:"1px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                    fontFamily:"'Hack',monospace"}},
                    f.path.replace(f.name,""))
                )
              );
            });
          })()
        )
      ),

      // ── MODUS: Bladeren ─────────────────────────────────────────────────
      browseMode==="browser" && React.createElement("div",{
        style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}
      },
        // Pad-broodkruimel + terug
        React.createElement("div",{style:{
          padding:"6px 10px",borderBottom:`1px solid ${W.splitBg}`,
          flexShrink:0,display:"flex",alignItems:"center",gap:"6px"
        }},
          browseParent !== "" && React.createElement("button",{
            onClick:()=>browseTo(browseParent),
            style:{background:"none",border:`1px solid ${W.splitBg}`,borderRadius:"4px",
                   padding:"3px 8px",color:W.fgMuted,fontSize:"13px",cursor:"pointer",
                   flexShrink:0}
          },"← terug"),
          browsePath==="" && React.createElement("button",{
            onClick:()=>browseTo(""),
            style:{background:"none",border:`1px solid ${W.splitBg}`,borderRadius:"4px",
                   padding:"3px 8px",color:W.fgMuted,fontSize:"13px",cursor:"pointer"}
          },"🏠 roots"),
          React.createElement("span",{style:{
            fontSize:"10px",color:"rgba(180,140,255,0.5)",overflow:"hidden",
            textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1,
            fontFamily:"'Hack',monospace"
          }}, browsePath||"Kies een map"),
          browseLoading && React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted}},"⏳")
        ),

        // Selecteer hele map als PDF-bron
        browsePath && React.createElement("div",{style:{
          padding:"5px 10px",borderBottom:`1px solid ${W.splitBg}`,
          flexShrink:0,display:"flex",gap:"6px"
        }},
          React.createElement("button",{
            onClick:()=>{
              if(!extPdfDirs.includes(browsePath))
                saveExtDirs([...extPdfDirs, browsePath]);
            },
            disabled:extPdfDirs.includes(browsePath),
            style:{flex:1,background:"rgba(180,140,255,0.1)",
                   border:"1px solid rgba(180,140,255,0.3)",borderRadius:"4px",
                   padding:"4px 0",fontSize:"10px",
                   color:extPdfDirs.includes(browsePath)?"rgba(180,140,255,0.35)":"rgba(180,140,255,0.8)",
                   cursor:extPdfDirs.includes(browsePath)?"default":"pointer"}
          }, extPdfDirs.includes(browsePath)?"✓ Map al toegevoegd":"＋ Voeg map toe als bron")
        ),

        // Foutmelding
        browseError && React.createElement("div",{style:{
          margin:"8px 10px",padding:"8px 10px",
          background:"rgba(229,120,109,0.1)",border:"1px solid rgba(229,120,109,0.3)",
          borderRadius:"5px",fontSize:"11px",color:W.orange,lineHeight:"1.5"
        }}, "⚠ "+browseError),

        // Bestanden & mappen lijst
        React.createElement("div",{style:{flex:1,overflowY:"auto", minHeight:0, WebkitOverflowScrolling:"touch",}},
          browseLoading
            ? React.createElement("div",{style:{padding:"20px",fontSize:"11px",
                color:W.fgMuted,textAlign:"center"}},"⏳ Laden…")
            : browseItems.length===0 && !browseError
              ? React.createElement("div",{style:{padding:"20px",fontSize:"11px",
                  color:W.fgMuted,textAlign:"center",lineHeight:"1.8"}},
                  "Klik op een map om te bladeren,\nof klik 🏠 om te starten")
              : browseItems.map((item,i)=>{
                  const isPdf = item.type==="pdf";
                  const isDir = item.type==="dir";
                  const sel   = isPdf && ctxExtPdfs.includes(item.path);
                  return React.createElement("div",{key:item.path+i,
                    onClick:()=>{
                      if(isDir) browseTo(item.path);
                      else if(isPdf)
                        setCtxExtPdfs(prev=>sel?prev.filter(x=>x!==item.path):[...prev,item.path]);
                    },
                    style:{padding:"7px 12px",
                           borderBottom:`1px solid rgba(255,255,255,0.03)`,
                           cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",
                           background:sel?"rgba(180,140,255,0.1)":"transparent",
                           borderLeft:`3px solid ${sel?"rgba(180,140,255,0.6)":"transparent"}`,
                    }
                  },
                    // Checkbox voor PDFs, map-icon voor dirs
                    isPdf
                      ? React.createElement("div",{style:{width:"15px",height:"15px",
                          borderRadius:"3px",flexShrink:0,
                          background:sel?"rgba(180,140,255,0.3)":"transparent",
                          border:`1.5px solid ${sel?"rgba(180,140,255,0.7)":"rgba(255,255,255,0.15)"}`,
                          display:"flex",alignItems:"center",justifyContent:"center"}},
                          sel&&React.createElement("span",{style:{fontSize:"10px",
                            color:"rgba(180,140,255,1)",lineHeight:1,fontWeight:"bold"}},"✓"))
                      : React.createElement("span",{style:{fontSize:"15px",flexShrink:0}},"📁"),

                    React.createElement("div",{style:{minWidth:0,flex:1}},
                      React.createElement("div",{style:{
                        fontSize:"12px",
                        color: sel?"rgba(180,140,255,0.95)":isDir?W.fg:W.fgDim,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                        fontWeight:isDir?"500":"normal"
                      }}, item.name),
                      React.createElement("div",{style:{fontSize:"9px",
                        color:"rgba(180,140,255,0.35)",marginTop:"1px"}},
                        isPdf && item.size ? Math.round(item.size/1024)+" KB" : "")
                    ),
                    isDir && React.createElement("span",{style:{color:W.fgMuted,fontSize:"13px",
                      flexShrink:0}}, "›")
                  );
                })
        )
      )
    )
  );
};


// Streaming cursor animatie
if(!document.getElementById("llm-css")){
  const s=document.createElement("style");
  s.id="llm-css";
  s.textContent=`
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
    .chat-msg-wrap:hover .chat-paste-btn { opacity: 1 !important; }
    .chat-paste-btn button:hover { background: rgba(159,202,86,0.15) !important; color: #9fca56 !important; }
  `;
  document.head.appendChild(s);
}

// ── MarkdownWithMermaid ───────────────────────────────────────────────────────
// Rendert markdown maar vervangt mermaid-mindmap blokken door MermaidPreviewBlock.
const MarkdownWithMermaid = ({ content, notes, renderMode, isMobile, onClick, onEditMermaid }) => {
  const html = renderMd(content, notes);

  // Splits HTML op mermaid placeholders
  const MARKER = /<div class="mermaid-mindmap-block" data-mermaid="([^"]+)"><\/div>/g;
  const parts  = [];
  let last = 0, m;
  while ((m = MARKER.exec(html)) !== null) {
    if (m.index > last)
      parts.push({ type:"html", html: html.slice(last, m.index) });
    const code = m[1]
      .replace(/&amp;/g,"&")
      .replace(/&quot;/g,'"')
      .replace(/&#10;/g,"\n");
    parts.push({ type:"mermaid", code });
    last = m.index + m[0].length;
  }
  if (last < html.length) parts.push({ type:"html", html: html.slice(last) });

  const mdStyle = {
    fontSize:   renderMode==="rich" ? (isMobile?"17px":"15px") : (isMobile?"15px":"13px"),
    lineHeight: renderMode==="rich" ? "2.0" : (isMobile?"1.9":"1.85"),
    maxWidth:   renderMode==="rich" ? "720px" : "none",
    margin:     renderMode==="rich" ? "0 auto" : "0",
    fontFamily: renderMode==="rich" ? "'Georgia','Times New Roman',serif" : "inherit",
  };

  return React.createElement("div", { style: mdStyle, onClick },
    parts.map((p, i) => {
      if (p.type === "mermaid") {
        return React.createElement(MermaidPreviewBlock, {
          key: i,
          code: p.code,
          onEdit: onEditMermaid ? () => onEditMermaid(p.code) : null,
        });
      }
      return React.createElement("div", {
        key: i,
        className: renderMode==="rich" ? "mdv mdv-rich" : "mdv",
        dangerouslySetInnerHTML: { __html: p.html },
      });
    })
  );
};

// ── FuzzySearch ────────────────────────────────────────────────────────────────
// FZF-stijl zoeken over notities én vault-PDFs (per pagina + regelnummer).
// Resultaten zijn inline bewerkbaar en opslaan als Zettelkasten notitie.
const FuzzySearch = ({ notes, allTags, onOpenNote, onAddNote, onUpdateNote, onPasteToNote=null, focusTrigger=0 }) => {
  const { useState, useEffect, useRef, useCallback, useMemo } = React;

  const [query,      setQuery]      = useState("");
  const [results,    setResults]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [selIdx,     setSelIdx]     = useState(null);   // welk resultaat geselecteerd
  const [editState,  setEditState]  = useState({});     // {id → {title, content, tags, dirty}}
  const [saving,     setSaving]     = useState({});     // {id → bool}
  const [saved,      setSaved]      = useState({});     // {id → bool}  (groen vinkje)
  const [tagInput,   setTagInput]   = useState({});     // {id → string}
  const [typeFilter, setTypeFilter] = useState("all"); // "all" | "note" | "pdf"
  const [searchMode, setSearchMode] = useState("fuzzy"); // "fuzzy" | "fulltext"
  const inputRef = useRef(null);
  const debRef   = useRef(null);

  // Focust bij mount én elke keer dat focusTrigger omhoog gaat (split-wissel)
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (focusTrigger > 0) inputRef.current?.focus(); }, [focusTrigger]);

  // Gefilterde resultaten op basis van typeFilter
  const filteredResults = useMemo(() =>
    typeFilter === "all" ? results : results.filter(r => r.type === typeFilter),
    [results, typeFilter]
  );

  // Debounced zoekfunctie — fuzzy of fulltext
  const doSearch = useCallback((q, mode) => {
    const m = mode || searchMode;
    if (!q.trim()) { setResults([]); setSelIdx(null); setError(null); return; }
    setLoading(true); setError(null);
    const endpoint = m === "fulltext" ? "/api/fulltext" : "/api/search";
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: q }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setResults([]); }
        else {
          setResults(d.results || []);
          setSelIdx(d.results?.length ? 0 : null);
        }
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [searchMode]);

  const handleQueryChange = (q) => {
    setQuery(q);
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => doSearch(q, searchMode), 280);
  };

  const handleModeChange = (mode) => {
    setSearchMode(mode);
    setResults([]);
    if (query.trim()) {
      clearTimeout(debRef.current);
      debRef.current = setTimeout(() => doSearch(query, mode), 100);
    }
  };

  // Toetsenbord navigatie (pijl op/neer, Enter opent)
  // Edit state initialiseren voor een resultaat
  const openEdit = (r, idx) => {
    const key = resultKey(r, idx);
    setSelIdx(idx);
    if (!editState[key]) {
      setEditState(s => ({ ...s, [key]: {
        title:   r.type === "note" ? r.title : suggestTitle(r),
        content: r.type === "note" ? (r.content||"") : suggestContent(r),
        tags:    r.type === "note" ? (r.tags||[]) : suggestTags(r),
        dirty:   false,
        isNew:   r.type !== "note",  // PDF-hits worden nieuwe notities
      }}));
    }
  };

  const resultKey = (r, idx) => r.type === "note" ? ("note-"+r.id) : ("pdf-"+idx);

  const suggestTitle = (r) =>
    r.source ? `Aantekening — ${r.source} p.${r.page}` : r.title;

  const suggestContent = (r) => {
    const bron = r.type === "pdf"
      ? `📄 **Bron:** [[pdf:${r.source}]]  —  pagina ${r.page}, regel ${r.line}\n\n`
      : "";
    return bron + (r.excerpt || "");
  };

  const suggestTags = (r) =>
    r.type === "pdf" ? ["pdf", "excerpt"] : (r.tags || []);

  // Highlight zoektermen in tekst
  const highlight = (text, q) => {
    if (!q.trim() || !text) return text;
    const tokens = q.trim().split(/\s+/).filter(Boolean);
    // Escape regex special chars
    const pattern = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const re = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(re);
    return parts.map((p, i) =>
      re.test(p)
        ? React.createElement("mark", {
            key: i,
            style: { background: W.yellow+"44", color: W.fg, borderRadius: "2px",
                     padding: "0 1px", fontWeight: "bold" }
          }, p)
        : p
    );
  };

  // Opslaan — bijwerken of nieuw aanmaken
  const handleSave = async (r, idx) => {
    const key = resultKey(r, idx);
    const es  = editState[key];
    if (!es) return;
    setSaving(s => ({ ...s, [key]: true }));
    try {
      const noteData = {
        title:    es.title,
        content:  es.content,
        tags:     es.tags,
        modified: new Date().toISOString(),
      };
      if (!es.isNew && r.type === "note" && r.id) {
        // Bijwerken bestaande notitie
        await onUpdateNote({ ...noteData, id: r.id });
      } else {
        // Nieuwe notitie aanmaken
        const created = { ...noteData, id: genId(), created: new Date().toISOString() };
        await onAddNote(created);
      }
      setEditState(s => ({ ...s, [key]: { ...es, dirty: false, isNew: false } }));
      setSaved(s => ({ ...s, [key]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2200);
    } catch(e) {
      alert("Opslaan mislukt: " + e.message);
    }
    setSaving(s => ({ ...s, [key]: false }));
  };

  // Tag toevoegen vanuit tagInput
  const addTag = (key, tag) => {
    const t = tag.trim().toLowerCase().replace(/\s+/g, "-");
    if (!t) return;
    setEditState(s => {
      const es = s[key]; if (!es) return s;
      if (es.tags.includes(t)) return s;
      return { ...s, [key]: { ...es, tags: [...es.tags, t], dirty: true } };
    });
    setTagInput(s => ({ ...s, [key]: "" }));
  };

  const removeTag = (key, tag) => {
    setEditState(s => {
      const es = s[key]; if (!es) return s;
      return { ...s, [key]: { ...es, tags: es.tags.filter(t=>t!==tag), dirty: true } };
    });
  };

  // ── Stijlen ───────────────────────────────────────────────────────────────
  const css = {
    root:   { display:"flex", flexDirection:"column", flex:1, minHeight:0, background:W.bg,
               fontFamily:"'Hack', monospace, sans-serif", overflow:"hidden" },
    header: { padding:"12px 16px 10px", borderBottom:`1px solid ${W.splitBg}`,
               background:W.bg2, flexShrink:0 },
    searchRow: { display:"flex", gap:"8px", alignItems:"center" },
    input:  { flex:1, background:W.bg, border:`2px solid ${W.blue}`, borderRadius:"6px",
               color:W.fg, padding:"8px 14px", fontSize:"15px", outline:"none",
               fontFamily:"inherit", letterSpacing:"0.3px" },
    meta:   { fontSize:"12px", color:W.fgMuted, marginTop:"6px" },
    body:   { display:"flex", flex:1, overflow:"hidden" },
    // Resultatenlijst links
    list:   { width:"340px", flexShrink:0, overflowY:"auto", borderRight:`1px solid ${W.splitBg}` },
    item:   (selected, type) => ({
      padding:"10px 14px", cursor:"pointer", borderBottom:`1px solid ${W.splitBg}`,
      background: selected ? (type==="note"?W.bg2+"ee":"rgba(230,180,0,0.08)") : "transparent",
      borderLeft: selected ? `3px solid ${type==="note"?W.blue:W.yellow}` : "3px solid transparent",
      transition:"background 0.1s",
    }),
    itemTitle: { fontSize:"13px", fontWeight:"bold", color:W.fg,
                  whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" },
    itemMeta:  { fontSize:"11px", color:W.fgMuted, marginTop:"3px" },
    itemExcerpt: { fontSize:"11px", color:W.fgDim, marginTop:"4px",
                    lineHeight:"1.5", display:"-webkit-box",
                    WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" },
    badge: (type) => ({
      display:"inline-block", fontSize:"10px", padding:"1px 6px", borderRadius:"10px",
      marginRight:"5px", fontWeight:"bold",
      background: type==="note" ? W.blue+"33" : W.yellow+"33",
      color:       type==="note" ? W.blue      : W.yellow,
      border: `1px solid ${type==="note" ? W.blue+"66" : W.yellow+"66"}`,
    }),
    // Editor rechts
    editor: { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
    editorInner: { flex:1, overflowY:"auto", padding:"16px 20px" },
    editorEmpty: { flex:1, display:"flex", alignItems:"center", justifyContent:"center",
                    flexDirection:"column", gap:"12px", color:W.fgMuted },
    fieldLabel: { fontSize:"11px", color:W.fgMuted, letterSpacing:"1px",
                   textTransform:"uppercase", marginBottom:"4px" },
    titleInput: { width:"100%", background:W.bg2, border:`1px solid ${W.splitBg}`,
                   borderRadius:"4px", color:W.fg, padding:"6px 10px",
                   fontSize:"15px", fontWeight:"bold", outline:"none", boxSizing:"border-box",
                   fontFamily:"inherit" },
    textarea: { width:"100%", background:W.bg, border:`1px solid ${W.splitBg}`,
                 borderRadius:"4px", color:W.fg, padding:"8px 10px",
                 fontSize:"13px", outline:"none", boxSizing:"border-box",
                 fontFamily:"'Hack', monospace", lineHeight:"1.65", resize:"vertical" },
    tagPill: { display:"inline-flex", alignItems:"center", gap:"4px",
                background:W.bg2, border:`1px solid ${W.splitBg}`, borderRadius:"12px",
                padding:"2px 8px", fontSize:"12px", color:W.comment },
    tagX: { cursor:"pointer", color:W.fgMuted, marginLeft:"2px" },
    saveBar: { padding:"10px 16px", borderTop:`1px solid ${W.splitBg}`,
                background:W.bg2, display:"flex", alignItems:"center", gap:"10px",
                flexShrink:0 },
    saveBtn: (s) => ({
      padding:"6px 18px", borderRadius:"5px", border:"none", cursor:"pointer",
      fontWeight:"bold", fontSize:"13px", fontFamily:"inherit",
      background: s ? W.green : W.blue, color: W.bg,
      opacity: s ? 0.7 : 1,
    }),
    openBtn: { padding:"6px 14px", borderRadius:"5px", border:`1px solid ${W.blue}`,
                cursor:"pointer", fontSize:"13px", fontFamily:"inherit",
                background:"transparent", color:W.blue },
    sourceBox: { background:W.bg2, borderLeft:`3px solid ${W.yellow}`,
                  padding:"8px 12px", borderRadius:"0 4px 4px 0",
                  fontSize:"12px", color:W.yellow, marginBottom:"14px" },
    excerptBox: { background:W.bg, border:`1px solid ${W.splitBg}`, borderRadius:"4px",
                   padding:"8px 12px", fontSize:"12px", color:W.fgDim,
                   fontFamily:"'Hack', monospace", lineHeight:"1.6", marginBottom:"14px",
                   whiteSpace:"pre-wrap" },
  };

  // ── Render resultatenlijst ────────────────────────────────────────────────
  // Score → kleur (groen=hoog, geel=midden, grijs=laag)
  const scoreColor = (sc) => sc > 300 ? W.green : sc > 100 ? W.yellow : W.fgMuted;
  const maxScore   = useMemo(() => results.reduce((m,r) => Math.max(m, r.score||0), 1), [results]);

  const renderList = () => {
    if (loading) return React.createElement("div", { style:{padding:"20px",color:W.fgMuted,fontSize:"13px"} },
      "⏳ Zoeken in notities en PDFs…");
    if (error)  return React.createElement("div", { style:{padding:"20px",color:W.red,fontSize:"13px"} },
      "⚠️ " + error);
    if (!query.trim()) return React.createElement("div", { style:{padding:"20px",color:W.fgMuted,fontSize:"13px"} },
      React.createElement("div",{style:{fontSize:"32px",marginBottom:"12px"}},"🔍"),
      React.createElement("div",{style:{fontWeight:"bold",marginBottom:"8px",color:W.fg}},"FZF Zoeken"),
      React.createElement("div",null,"Doorzoek alle notities en volledige PDF-inhoud."),
      React.createElement("div",{style:{marginTop:"10px",display:"flex",flexDirection:"column",gap:"5px"}}),
      React.createElement("div",{style:{color:W.fgDim,marginTop:"8px"}},"• Spatie = AND  (meerdere woorden)"),
      React.createElement("div",{style:{color:W.fgDim}},"• ↑↓ navigeert resultaten  ·  Enter opent"),
      React.createElement("div",{style:{color:W.fgDim}},"• Fuzzy: typ letters in volgorde, geen exacte match nodig"),
      React.createElement("div",{style:{color:W.fgDim}},"• PDF-hits tonen pagina + regelnummer")
    );
    if (!filteredResults.length) return React.createElement("div",{style:{padding:"20px",color:W.fgMuted,fontSize:"13px"}},
      results.length
        ? `Geen ${typeFilter === "note" ? "notitie" : "PDF"}-resultaten — ${results.length} resultaten totaal`
        : `Geen resultaten voor "${query}"`
    );

    // Full-text modus: toon alle matches per notitie
    if (searchMode === "fulltext") {
      return filteredResults.map((r, idx) => {
        const sel = selIdx === idx;
        const mc  = r.match_count || 0;
        return React.createElement("div", {
          key: r.id || idx,
          style: { ...css.item(sel, "note"), cursor: "pointer" },
          onClick: () => { setSelIdx(idx); onOpenNote?.(r.id); },
        },
          // Kop
          React.createElement("div", { style:{display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px"} },
            r.title_match && React.createElement("span",{style:{fontSize:"10px",color:W.yellow,background:"rgba(234,231,136,0.15)",borderRadius:"3px",padding:"1px 5px"}},"titel"),
            React.createElement("span", { style: css.itemTitle }, r.title || "(geen titel)"),
            React.createElement("span",{style:{marginLeft:"auto",fontSize:"10px",color:W.blue,flexShrink:0,background:"rgba(138,198,242,0.1)",borderRadius:"10px",padding:"1px 7px"}},
              mc + "×"
            ),
          ),
          // Tags
          r.tags?.length > 0 && React.createElement("div",{style:{display:"flex",gap:"3px",flexWrap:"wrap",marginBottom:"5px"}},
            r.tags.slice(0,4).map(t => React.createElement(TagPill,{key:t,tag:t,small:true}))
          ),
          // Match-snippets (max 3 tonen)
          React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"3px"}},
            (r.matches||[]).slice(0,3).map((m,i) =>
              React.createElement("div",{key:i,style:{
                fontSize:"11px",color:W.fgDim,lineHeight:"1.5",
                background:"rgba(255,255,255,0.03)",borderRadius:"3px",
                padding:"3px 6px",borderLeft:`2px solid rgba(138,198,242,0.3)`,
              }},
                React.createElement("span",{style:{color:W.fgMuted,marginRight:"5px",fontSize:"10px"}},
                  `r.${m.line_no}`
                ),
                highlight(m.line, query)
              )
            ),
            mc > 3 && React.createElement("div",{style:{fontSize:"10px",color:W.fgMuted,padding:"2px 6px"}},
              `+ ${mc-3} meer treffer${mc-3>1?"s":""}…`
            )
          )
        );
      });
    }

    return filteredResults.map((r, idx) => {
      const key = resultKey(r, idx);
      const sel = selIdx === idx;
      const es  = editState[key];
      const isNote = r.type === "note";
      const sc  = r.score || 0;
      const barW = Math.round((sc / maxScore) * 100);

      return React.createElement("div", {
        key, style: css.item(sel, r.type),
        onClick: () => openEdit(r, idx),
      },
        // Titel rij: badge + titel
        React.createElement("div", { style:{ display:"flex", alignItems:"flex-start", gap:"6px", marginBottom:"3px" } },
          React.createElement("span", { style: css.badge(r.type) },
            isNote ? "📝" : "📄"
          ),
          React.createElement("div", { style: css.itemTitle },
            isNote ? highlight(r.title, query) : highlight(r.source, query)
          )
        ),
        // Meta-regel: bron + pagina/regel
        React.createElement("div", { style: css.itemMeta },
          isNote
            ? React.createElement("span", null,
                (r.tags||[]).slice(0,4).map(t =>
                  React.createElement("span",{key:t,style:{
                    fontSize:"11px",color:"#b8e06a",fontWeight:"500",
                    background:"rgba(159,202,86,0.12)",border:"1px solid rgba(159,202,86,0.35)",
                    borderRadius:"4px",padding:"1px 6px",marginRight:"3px",lineHeight:"1.3",
                  }},"#"+t)
                ),
                r.line > 1 && React.createElement("span",{style:{color:W.fgDim}},` · regel ${r.line}`)
              )
            : React.createElement("span", null,
                React.createElement("span",{style:{color:W.yellow,fontWeight:"bold"}},"p."+r.page),
                React.createElement("span",{style:{color:W.fgDim}},`  ·  r.${r.line}  ·  `),
                React.createElement("span",{style:{color:W.fgMuted}}, r.source.length>28 ? "…"+r.source.slice(-26) : r.source)
              )
        ),
        // Score-balk
        React.createElement("div",{style:{height:"2px",background:W.splitBg,borderRadius:"1px",margin:"4px 0",overflow:"hidden"}},
          React.createElement("div",{style:{height:"100%",width:barW+"%",background:scoreColor(sc),borderRadius:"1px",transition:"width 0.2s"}})
        ),
        // Excerpt
        r.excerpt && React.createElement("div", { style: css.itemExcerpt },
          highlight(r.excerpt, query)
        ),
        // Bewerkingsindicator
        es?.dirty && React.createElement("div", { style:{fontSize:"10px",color:W.yellow,marginTop:"4px"} },
          "● gewijzigd"
        )
      );
    });
  };

  // ── Render editor rechts ──────────────────────────────────────────────────
  const renderEditor = () => {
    if (selIdx === null || !filteredResults[selIdx]) return React.createElement("div", { style: css.editorEmpty },
      React.createElement("div",{style:{fontSize:"48px"}},"🔍"),
      React.createElement("div",{style:{fontSize:"14px"}},"Selecteer een resultaat om te bewerken")
    );

    const r   = filteredResults[selIdx];
    const key = resultKey(r, selIdx);
    const es  = editState[key];
    const isSaving = saving[key];
    const isSaved  = saved[key];

    if (!es) return React.createElement("div", { style: css.editorEmpty },
      React.createElement("div",null,"Klik op een resultaat om te openen")
    );

    const fieldSep = React.createElement("div", { style:{marginBottom:"14px"} });

    return React.createElement(React.Fragment, null,
      React.createElement("div", { style: css.editorInner },

        // Bronmelding
        React.createElement("div", { style: css.sourceBox },
          r.type === "pdf"
            ? `📄 ${r.source}  ·  pagina ${r.page}  ·  regel ${r.line}`
            : `📝 Notitie${r.line > 1 ? `  ·  regel ${r.line}` : ""}`
        ),

        // Plakken in open notitie (alleen in split-modus zichtbaar)
        onPasteToNote && React.createElement("button", {
          onClick: () => {
            const text = r.excerpt || es.content || "";
            onPasteToNote({
              text,
              source: r.type === "pdf" ? r.source : (r.title || "Notitie"),
              page:   r.type === "pdf" ? r.page : null,
              url:    null,
            });
          },
          title: "Plak fragment met bronvermelding in open notitie",
          style: { background:"rgba(138,198,242,0.15)", border:`1px solid rgba(138,198,242,0.4)`,
                   borderRadius:"5px", color:"#8ac6f2", fontSize:"12px", cursor:"pointer",
                   padding:"4px 12px", marginBottom:"10px", display:"flex", alignItems:"center", gap:"6px" }
        }, "📋 Plak in notitie"),

        // Excerpt (alleen-lezen context)
        r.excerpt && React.createElement(React.Fragment, null,
          React.createElement("div", { style: css.fieldLabel }, "Gevonden fragment"),
          React.createElement("div", { style: css.excerptBox },
            highlight(r.excerpt, query)
          )
        ),

        // Titelfield
        React.createElement("div", { style: css.fieldLabel }, "Titel"),
        React.createElement("input", {
          style: css.titleInput,
          value: es.title,
          onChange: e => setEditState(s => ({ ...s, [key]: { ...s[key], title: e.target.value, dirty: true } })),
          placeholder: "Notitie-titel…",
        }),
        fieldSep,

        // Inhoud
        React.createElement("div", { style: css.fieldLabel }, "Inhoud"),
        React.createElement("textarea", {
          style: { ...css.textarea, minHeight:"220px" },
          value: es.content,
          rows: 14,
          onChange: e => setEditState(s => ({ ...s, [key]: { ...s[key], content: e.target.value, dirty: true } })),
          placeholder: "Notitie-inhoud (Markdown)…",
        }),
        fieldSep,

        // Tags
        React.createElement("div", { style: css.fieldLabel }, "Tags"),
        React.createElement("div", { style:{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"8px" } },
          (es.tags||[]).map(tag =>
            React.createElement("span", { key: tag, style: css.tagPill },
              "#" + tag,
              React.createElement("span", {
                style: css.tagX,
                onClick: () => removeTag(key, tag)
              }, "×")
            )
          )
        ),
        React.createElement("input", {
          style: { ...css.titleInput, fontSize:"12px", padding:"4px 8px", width:"auto", minWidth:"160px" },
          value:  tagInput[key] || "",
          placeholder: "tag toevoegen…",
          onChange: e => setTagInput(s => ({ ...s, [key]: e.target.value })),
          onKeyDown: e => {
            if (["Enter","Tab",","," "].includes(e.key)) {
              e.preventDefault();
              addTag(key, tagInput[key]||"");
            }
          }
        }),
        fieldSep,

        // Zettelkasten-info box
        es.isNew && React.createElement("div", {
          style:{ background:W.bg2, border:`1px solid ${W.green}44`, borderRadius:"6px",
                  padding:"10px 14px", fontSize:"12px", color:W.comment,
                  display:"flex", gap:"10px", alignItems:"flex-start" }
        },
          React.createElement("span",{style:{fontSize:"16px"}},"💡"),
          React.createElement("div",null,
            React.createElement("strong",{style:{color:W.green}},"Opslaan als Zettelkasten-notitie"),
            React.createElement("div",{style:{marginTop:"4px"}},
              "Dit PDF-fragment wordt een nieuwe notitie met automatische bronverwijzing. ",
              "Je kunt de inhoud aanpassen vóór het opslaan."
            )
          )
        ),
      ),

      // Save-balk
      React.createElement("div", { style: css.saveBar },
        React.createElement("button", {
          style: css.saveBtn(isSaved),
          disabled: isSaving,
          onClick: () => handleSave(r, selIdx),
        }, isSaving ? "⏳ opslaan…" : isSaved ? "✓ opgeslagen" : es.isNew ? "＋ Opslaan als notitie" : "💾 Wijzigingen opslaan"),

        !es.isNew && r.type === "note" && r.id &&
          React.createElement("button", {
            style: css.openBtn,
            onClick: () => onOpenNote(r.id),
          }, "→ Open in editor"),

        es.dirty && React.createElement("span", { style:{fontSize:"12px",color:W.yellow} },
          "● Niet opgeslagen"
        ),
        isSaved && React.createElement("span", { style:{fontSize:"12px",color:W.green} },
          "✓ Opgeslagen in vault"
        ),
      )
    );
  };

  // ── Hoofd render ──────────────────────────────────────────────────────────
  // Keyboard nav werkt op filteredResults
  const handleKeyDown = (e) => {
    if (!filteredResults.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx(i => Math.min((i??-1)+1, filteredResults.length-1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelIdx(i => Math.max((i??1)-1, 0)); }
    if (e.key === "Enter" && selIdx !== null) {
      const r = filteredResults[selIdx];
      if (r) openEdit(r, selIdx);
    }
  };

  const nNotes = results.filter(r=>r.type==="note").length;
  const nPdfs  = results.filter(r=>r.type==="pdf").length;

  const filterBtnStyle = (active) => ({
    padding:"3px 12px", borderRadius:"12px", fontSize:"11px", fontWeight:"bold",
    cursor:"pointer", border:"none", fontFamily:"inherit",
    background: active ? W.blue : W.bg,
    color:       active ? W.bg   : W.fgMuted,
    transition:"all 0.15s",
  });

  return React.createElement("div", { style: css.root },

    // Zoekbalk header
    React.createElement("div", { style: css.header },
      React.createElement("div", { style: css.searchRow },
        React.createElement("span", { style:{fontSize:"18px"} }, "🔍"),
        React.createElement("input", {
          ref: inputRef,
          style: css.input,
          value: query,
          placeholder: "Fuzzy zoeken in notities en PDFs…  (spatie = AND, volgorde telt)",
          onChange: e => handleQueryChange(e.target.value),
          onKeyDown: handleKeyDown,
          autoFocus: true,
          spellCheck: false,
        }),
        loading && React.createElement("span", { style:{color:W.fgMuted,fontSize:"13px",marginLeft:"4px"} }, "⏳"),
        query && React.createElement("span", {
          style:{cursor:"pointer",color:W.fgMuted,fontSize:"16px",marginLeft:"4px",padding:"0 4px"},
          onClick:()=>{ setQuery(""); setResults([]); setSelIdx(null); inputRef.current?.focus(); }
        }, "×"),
      ),
      // Mode-toggle: fuzzy vs full-text
      React.createElement("div", { style:{display:"flex",alignItems:"center",gap:"6px",marginTop:"8px",flexWrap:"wrap"} },
        // Zoek-modus
        React.createElement("div", { style:{display:"flex",background:W.bg3,borderRadius:"8px",padding:"2px",gap:"2px",flexShrink:0} },
          React.createElement("button", {
            onClick: () => handleModeChange("fuzzy"),
            style:{ padding:"3px 12px", borderRadius:"6px", fontSize:"11px", fontWeight:"bold",
                    cursor:"pointer", border:"none", fontFamily:"inherit", transition:"all 0.15s",
                    background: searchMode==="fuzzy" ? W.blue : "transparent",
                    color:       searchMode==="fuzzy" ? W.bg   : W.fgMuted }
          }, "⚡ Fuzzy"),
          React.createElement("button", {
            onClick: () => handleModeChange("fulltext"),
            style:{ padding:"3px 12px", borderRadius:"6px", fontSize:"11px", fontWeight:"bold",
                    cursor:"pointer", border:"none", fontFamily:"inherit", transition:"all 0.15s",
                    background: searchMode==="fulltext" ? W.yellow : "transparent",
                    color:       searchMode==="fulltext" ? W.bg     : W.fgMuted }
          }, "🔎 Volledig"),
        ),
        // Type-filters
        React.createElement("button", { style:filterBtnStyle(typeFilter==="all"), onClick:()=>setTypeFilter("all") },
          `Alles${results.length ? " ("+results.length+")" : ""}`),
        searchMode === "fuzzy" && React.createElement("button", {
          style:{...filterBtnStyle(typeFilter==="pdf"), background:typeFilter==="pdf"?W.yellow:W.bg, color:typeFilter==="pdf"?W.bg:W.fgMuted},
          onClick:()=>setTypeFilter(typeFilter==="pdf" ? "all" : "pdf")
        }, `📄 PDF${nPdfs ? " ("+nPdfs+")" : ""}`),
        results.length > 0 && React.createElement("span",{style:{fontSize:"11px",color:W.fgDim,marginLeft:"4px"}},
          `${filteredResults.length} gevonden`
        ),
      ),
    ),

    // Body: lijst + editor
    React.createElement("div", { style: css.body },
      React.createElement("div", { style: css.list }, renderList()),
      React.createElement("div", { style: css.editor }, renderEditor())
    )
  );
};

// ── ModelPicker — statusbalk badge + dropdown ─────────────────────────────────
const ModelPicker = ({llmModel, setLlmModel, compact=false}) => {
  const [open, setOpen]       = React.useState(false);
  const [localModels, setLocal] = React.useState([]);
  const ref = React.useRef(null);

  // Sluit bij klik buiten
  React.useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  // Haal lokale Ollama-modellen op bij openen
  React.useEffect(() => {
    if (!open) return;
    fetch("/api/llm/models").then(r=>r.json()).then(d=>{
      if (d.models) setLocal(d.models);
    }).catch(()=>{});
  }, [open]);

  const select = (id) => { setLlmModel(id); setOpen(false); };
  const activeColor = MODEL_COLOR(llmModel);
  const isOnline = ONLINE_MODELS.some(x => x.id === llmModel);

  // Groepeer online modellen per group-label
  const groups = [];
  ONLINE_MODELS.forEach(m => {
    let g = groups.find(x => x.label === m.group);
    if (!g) { g = {label: m.group, provider: m.provider, items: []}; groups.push(g); }
    g.items.push(m);
  });

  return React.createElement("div", {ref, style:{position:"relative"}},
    // Badge — compact = alleen icoon
    React.createElement("button", {
      onClick: () => setOpen(p => !p),
      title: compact ? (MODEL_LABEL(llmModel) || "geen model") : "Kies AI-model",
      style:{
        background: `${activeColor}18`,
        border: `1px solid ${activeColor}55`,
        borderRadius:"10px",
        padding: compact ? "4px 8px" : "2px 10px",
        color: activeColor,
        fontSize: compact ? "16px" : "13px",
        cursor:"pointer", whiteSpace:"nowrap",
        maxWidth: compact ? "36px" : "180px",
        overflow:"hidden", textOverflow:"ellipsis",
      }
    }, compact ? "🧠" : (MODEL_LABEL(llmModel) || "🖥 geen model")),

    // Dropdown
    open && React.createElement("div", {
      style:{
        position:"fixed", top:"52px", right:"8px",
        background:W.bg3, border:`1px solid ${W.splitBg}`,
        borderRadius:"10px", padding:"6px 0",
        zIndex:9999, minWidth:"260px", maxHeight:"70vh", overflowY:"auto",
        boxShadow:"0 12px 40px rgba(0,0,0,0.8)",
      }
    },
      // Koptekst
      React.createElement("div",{style:{padding:"6px 14px 8px",fontSize:"12px",
        color:W.fgMuted,letterSpacing:"0.8px",borderBottom:`1px solid ${W.splitBg}`}},"AI MODEL KIEZEN"),

      // Online groepen
      ...groups.map(g => {
        const gc = PROVIDER_COLOR[g.provider] || W.fg;
        return React.createElement("div", {key:g.label},
          React.createElement("div",{style:{padding:"8px 14px 3px",fontSize:"11px",
            color:gc, letterSpacing:"0.7px", opacity:0.8, fontWeight:"bold"}}, g.label.toUpperCase()),
          ...g.items.map(m =>
            React.createElement("button", {
              key:m.id, onClick:()=>select(m.id),
              style:{
                display:"flex", alignItems:"center", gap:"8px",
                width:"100%", textAlign:"left",
                background: llmModel===m.id ? `${gc}20` : "none",
                border:"none", padding:"5px 14px 5px 18px",
                color: llmModel===m.id ? gc : W.fg,
                fontSize:"14px", cursor:"pointer",
              }
            },
              React.createElement("span",{style:{fontSize:"15px",width:"20px",flexShrink:0}}, m.icon),
              React.createElement("span",null, m.label),
              llmModel===m.id && React.createElement("span",{style:{marginLeft:"auto",fontSize:"11px",color:gc}},"✓")
            )
          )
        );
      }),

      // Divider lokaal
      React.createElement("div",{style:{height:"1px",background:W.splitBg,margin:"6px 0"}}),
      React.createElement("div",{style:{padding:"4px 14px 3px",fontSize:"11px",
        color:W.comment, letterSpacing:"0.7px", opacity:0.8, fontWeight:"bold"}},"LOKAAL (OLLAMA)"),
      localModels.length === 0
        ? React.createElement("div",{style:{padding:"6px 18px",fontSize:"14px",color:W.fgDim}},"laden…")
        : localModels.map(m =>
            React.createElement("button", {
              key:m, onClick:()=>select(m),
              style:{
                display:"flex", alignItems:"center", gap:"8px",
                width:"100%", textAlign:"left",
                background: llmModel===m ? "rgba(159,202,86,0.15)" : "none",
                border:"none", padding:"5px 14px 5px 18px",
                color: llmModel===m ? W.comment : W.fg,
                fontSize:"14px", cursor:"pointer",
              }
            },
              React.createElement("span",{style:{fontSize:"15px",width:"20px"}},"🖥"),
              React.createElement("span",null, m),
              llmModel===m && React.createElement("span",{style:{marginLeft:"auto",fontSize:"11px",color:W.comment}},"✓")
            )
          ),

      // API-key hint
      React.createElement("div",{style:{padding:"8px 14px 4px",fontSize:"12px",
        color:W.fgDim,borderTop:`1px solid ${W.splitBg}`,marginTop:"4px"}},
        "Online: stel API-key in als env-variabele")
    )
  );
};


const App = () => {
  const { useState, useEffect, useRef, useMemo, useCallback } = React;

  // ── Notities-state (gedelegeerd aan NoteStore + NotesTab) ───────────────────
  const [notes,    setNotes]   = useState([]);   // gespiegeld vanuit NoteStore
  const [goyoMode, setGoyoMode] = useState(false); // App-level: beïnvloedt topbar
  const [splitMode,  setSplitMode]  = useState(false);
  const [splitTab,   setSplitTab]   = useState("pdf");
  const [splitFocus, setSplitFocus] = useState("left");  // "left" | "right"
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
  const [tab,      setTab]     = useState("notes");
  const [pdfNotes,     setPdfNotes]    = useState([]);
  const [imgNotes,     setImgNotes]    = useState([]);
  const [serverPdfs,   setServerPdfs]  = useState([]);
  const [serverImages, setServerImages]= useState([]);
  const [llmModel,     setLlmModel]    = useState("llama3.2-vision");
  const [aiMindmap,    setAiMindmap]   = useState(null);
  const [showSettings, setShowSettings]= useState(false);
  const [vaultPath,    setVaultPath]   = useState("…");
  const [loaded,       setLoaded]      = useState(false);
  const [error,        setError]       = useState(null);
  const [sidebarOpen,  setSidebarOpen] = useState(false);
  const [aiStatus,      setAiStatus]    = useState(null);  // legacy (enkele taak)
  const [jobs,          setJobs]         = useState([]);    // [{id,type,label,status,result,error}]
  const [jobsPanelOpen, setJobsPanelOpen] = useState(false);
  const [importPreview, setImportPreview] = useState(null); // resultaat URL-import (overleeft tab-wissel)

  // Jobs API — te gebruiken vanuit child-componenten
  const addJob = React.useCallback((job) => {
    // job = {id, type, label}  → status wordt "running"
    setJobs(prev => [...prev, {...job, status:"running", ts: Date.now()}]);
  }, []);
  const updateJob = React.useCallback((id, patch) => {
    setJobs(prev => prev.map(j => j.id===id ? {...j,...patch} : j));
  }, []);
  const removeJob = React.useCallback((id) => {
    setJobs(prev => prev.filter(j => j.id!==id));
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
        const [ns, as, ias, ps, imgs, cfg] = await Promise.all([
          NoteStore.load(), AnnotationStore.load(), api.get("/img-annotations"),
          api.get("/pdfs"), api.get("/images"), api.get("/config"),
        ]);
        setNotes(ns); setPdfNotes(as); setImgNotes(ias||[]); setServerPdfs(ps); setServerImages(imgs||[]);
        setVaultPath(cfg.vault_path || "…");
        if (ns.length > 0) setSelId(ns[0].id);
        setLoaded(true);
      } catch(e) {
        setError("Kan server niet bereiken.\nStart de server met: python3 server.py");
      }
    };
    // Subscribe: NoteStore of AnnotationStore wijzigt → App-state bijwerken
    const unsubNotes  = NoteStore.subscribe(ns => setNotes([...ns]));
    const unsubAnnots = AnnotationStore.subscribe(as => setPdfNotes([...as]));
    load();
    return () => { unsubNotes(); unsubAnnots(); };
  }, []);

  const refreshPdfs   = async () => { setServerPdfs(await PDFService.listPdfs()); };
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
    { id:"notes",     icon:"📝", label:"Schrijven",  sub: null },
    { id:"library",   icon:"📚", label:"Bibliotheek", sub: [
        {id:"pdf",     icon:"📄", label:"PDF"},
        {id:"images",  icon:"🖼",  label:"Plaatjes"},
        {id:"reading", icon:"📖", label:"Leeslijst"},
        {id:"review",  icon:"🔁", label:"Review"},
      ]},
    { id:"discover",  icon:"🔍", label:"Ontdekken",  sub: [
        {id:"search",  icon:"🔍", label:"Zoeken"},
        {id:"graph",   icon:"🕸",  label:"Graaf"},
        {id:"mindmap", icon:"🗺",  label:"Mindmap"},
        {id:"llm",     icon:"🧠", label:"Notebook"},
      ]},
    { id:"input",     icon:"🌐", label:"Invoer",     sub: [
        {id:"import",  icon:"🌐", label:"URL / Word"},
        {id:"pdfimport",icon:"📄", label:"PDF"},
      ]},
    { id:"manage",    icon:"⚙",  label:"Beheer",     sub: [
        {id:"tags",    icon:"🏷",  label:"Tags"},
        {id:"stats",   icon:"📊", label:"Statistieken"},
      ]},
  ];

  // Bepaal welke hoofdtab actief is op basis van de huidige subtab
  const activeMain = React.useMemo(() => {
    if (tab === "notes") return "notes";
    for (const mt of MAIN_TABS) {
      if (mt.sub?.some(s => s.id === tab)) return mt.id;
    }
    return "notes";
  }, [tab]);

  // Haal subtabs op voor actieve hoofdtab
  const activeSubs = React.useMemo(() => {
    const mt = MAIN_TABS.find(m => m.id === activeMain);
    return mt?.sub || null;
  }, [activeMain]);

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
    if (mainId === "notes") { setTab("notes"); return; }
    const mt = MAIN_TABS.find(m => m.id === mainId);
    if (!mt?.sub) return;
    // Blijf op huidige subtab als die al tot deze hoofdtab behoort
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
      style:{background:sidebarOpen?"rgba(138,198,242,0.15)":"none",
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
      // Jobs indicator
      (jobs.length > 0) && React.createElement("div",{style:{position:"relative"}},
        React.createElement("button",{
          onClick: e => { e.stopPropagation(); setJobsPanelOpen(p=>!p); },
          style:{
            display:"flex", alignItems:"center", gap:"4px",
            background: runningJobs.length>0 ? "rgba(138,198,242,0.1)" : "rgba(159,202,86,0.1)",
            border: `1px solid ${runningJobs.length>0 ? "rgba(138,198,242,0.35)" : "rgba(159,202,86,0.35)"}`,
            borderRadius:"20px",
            padding: isTablet ? "3px 8px" : "3px 11px",
            cursor:"pointer",
            color: runningJobs.length>0 ? "#a8d8f0" : W.comment,
            fontSize:"14px",
            animation: runningJobs.length>0 ? "ai-pulse 1.4s ease-in-out infinite" : "none",
          }
        },
          runningJobs.length>0
            ? React.createElement("span",{style:{display:"inline-block",width:"7px",height:"7px",
                borderRadius:"50%",background:"#a8d8f0",flexShrink:0,
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
                    style:{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.04)",
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
                    job.status!=="running" && React.createElement("button",{
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
        const renderTab = (t) => {
          if(t==="search") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(FuzzySearch,{
              onPasteToNote: selId ? handlePasteToNote : null,
              notes, allTags,
              onOpenNote: (id) => { setSelId(id); setTab("notes"); },
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
          if(t==="pdf") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(PDFViewer,{pdfNotes,setPdfNotes,allTags,serverPdfs,
              notes,isTablet,
              onRefreshPdfs:refreshPdfs,
              onPasteToNote: selId ? handlePasteToNote : null,
              onAddNote:async(note)=>{ await NoteStore.save(note); setNotes([...NoteStore.getAll()]); },
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
                addJob({id:jid, type:"summarize", label:"🧠 Samenvatten: "+stem.slice(0,26)+"…"});
                // Return Promise zodat PDFViewer fouten kan tonen in de eigen balk
                return (async()=>{
                  const res=await PDFService.summarizePdf(fname,llmModel);
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
          if(t==="pdfimport") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(PDFUploadPanel,{
              serverPdfs,
              onRefreshPdfs: refreshPdfs,
              onOpenPdf: (name) => { setSplitTab("pdf"); setTab("pdf"); },
              allTags,
              notes,
              onAddNote: async(note) => { await NoteStore.save(note); setNotes([...NoteStore.getAll()]); },
              llmModel,
              addJob, updateJob,
            }));
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
                      const annots = AnnotationStore.getAll().filter(a=>!(a.file===fname && !a.x));
                      annots.push({file:fname, description:res.description, pins:[]});
                      AnnotationStore.setAll(annots);
                      await fetch("/api/image-annotations", {
                        method:"POST",
                        headers:{"Content-Type":"application/json"},
                        body: JSON.stringify(annots)
                      });

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
                setNotes([...NoteStore.getAll()]); setSelId(saved.id); setTab("notes");
                return saved;  // zodat onDescribeImages de id heeft
              }}));
          if(t==="reading") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(ReadingList,{
              notes,
              onSelectNote: id=>{ setSelId(id); setTab("notes"); },
              onUpdateNote: async note=>{
                await NoteStore.save(note);
                setNotes([...NoteStore.getAll()]);
              },
              onDeleteNote: async ids => {
                // ids is een array van note-IDs
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
              onPasteToNote: selId ? handlePasteToNote : null}));
          if(t==="tags") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(TagManagerPanel,{
              allTags, notes,
              llmModel,
              onMergeTags: handleMergeTags,
              onRenameTag: handleRenameTag,
              onDeleteTag: handleDeleteTag,
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
              style:{flex:1,display:"flex",flexDirection:"row",overflow:"hidden",
                borderRight:bL,minWidth:0,minHeight:0,outline:"none",transition:"border-color 0.15s"}
            }, notesTabEl),
            React.createElement("div",{
              onClick:()=>setSplitFocus("right"),
              style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",
                borderLeft:bR,minWidth:0,minHeight:0,transition:"border-color 0.15s"}
            },
              React.createElement("div",{style:{
                background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,
                padding:"0",display:"flex",alignItems:"center",flexShrink:0,height:"36px"
              }},
                // Platte lijst van alle subtabs voor de split-balk
                MAIN_TABS.flatMap(mt => mt.sub || [])
                  .map(({id,icon,label})=>React.createElement("button",{
                    key:id,
                    onClick:e=>{e.stopPropagation();setSplitTab(id);},
                    style:{background:splitTab===id?W.bg:"none",
                      border:"none",borderBottom:splitTab===id?`2px solid ${W.yellow}`:"2px solid transparent",
                      color:splitTab===id?W.statusFg:W.fgMuted,
                      padding:"0 10px",height:"100%",fontSize:"13px",
                      cursor:"pointer",flexShrink:0,
                      display:"flex",alignItems:"center",gap:"4px"}
                  },
                    React.createElement("span",{style:{fontSize:"14px"}},icon),
                    label
                  ))
              ),
              renderTab(splitTab)
            )
          );
        }

        return renderTab(tab);
      })()
    ),

    bottomNav
  );
};