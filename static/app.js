// ─── VOID CYAN COLOR SCHEME ─────────────────────────────────────────────────────
// Zwarte basis + cyaan/mintgroen accenten. Alle tekst-tokens ≥ 7:1 contrast (WCAG AA+)
const W = {
  // Backgrounds — bijna-zwart met subtiele koele tint
  bg:"#090d0f",bg2:"#050708",bg3:"#0f1518",
  statusBg:"#0a0e10",visualBg:"#1a3035",cursorBg:"#7dd8c6",
  splitBg:"#1a2428",lineNrBg:"#060a0c",

  // Tekst — off-white met koele tint, géén puur wit
  fg:"#c8deda",       // body  13.9:1
  fgMuted:"#4e6a70",  // hints  3.4:1 (subtiel, opzettelijk)
  fgDim:"#7aaba6",    // meta   7.6:1
  statusFg:"#e8f4f2", // titels 17.3:1

  // Editor syntax
  comment:"#a6d189",string:"#a6d189",keyword:"#7dd8c6",
  type:"#8ec8c0",special:"#f5a97f",

  // UI accenten
  orange:"#f5a97f",   // 10.1:1 — vluchtig, tags, waarschuwing
  purple:"#c0a8e8",   // 9.3:1  — index, AI
  green:"#a6d189",    // 11.2:1 — permanent, succes
  yellow:"#e8c87a",   // 12.1:1 — review badge, cursor
  blue:"#7dd8c6",     // 11.6:1 — navigatie, links, cyaan
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
    // Sanitize payload om circular refs te voorkomen
    const safe = {
      url:   String(payload.url   || ""),
      model: String(payload.model || ""),
      force: Boolean(payload.force),
    };
    const opts = {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(safe),
    };
    if (signal) opts.signal = signal;
    const r = await fetch(API+"/import-url", opts);
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

// ── App (zie modules/ voor componenten) ─────────────────────────────────────

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
    if (cmd === "vs") { setSplitMode(true); setSplitFocus("right"); setSplitTab("llm"); }
    else if (cmd === "close" || cmd === "only") { setSplitMode(false); setSplitFocus("left"); }
    else if (cmd === "focus-right") { if (splitMode) setSplitFocus("right"); }
    else if (cmd === "focus-left")  { setSplitFocus("left"); }
    else if (cmd === "focus-toggle") { setSplitFocus(f => f === "left" ? "right" : "left"); }
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
  // Review: notities die vandaag aan de beurt zijn (voor badge in topbar)
  const [reviewDueCount, setReviewDueCount] = React.useState(0);
  React.useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    // Gebruik de al geladen notes array — controleer of noteId nog bestaat
    const noteIds = new Set(notes.map(n => n.id));
    fetch("/api/config").then(r => r.json()).then(d => {
      const rd = d.config?.review_data || {};
      const due = Object.entries(rd).filter(([noteId, v]) =>
        noteIds.has(noteId) &&        // notitie bestaat nog
        v && typeof v === "object" &&
        v.due && v.due <= today       // expliciet gepland en vandaag/eerder
      ).length;
      setReviewDueCount(due);
    }).catch(() => {});
  }, [notes]);

  // Recent geopende notities (max 8, voor dropdown in topbalk)
  const [recentIds, setRecentIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('zk_recent') || '[]'); }
    catch { return []; }
  });
  const [showRecent, setShowRecent] = useState(false);
  const pushRecent = React.useCallback((id) => {
    setRecentIds(prev => {
      const next = [id, ...prev.filter(x => x !== id)].slice(0, 8);
      try { localStorage.setItem('zk_recent', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);
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
  const abortControllers = React.useRef(new Map()); // jobId → AbortController
  const [importPreview, setImportPreview] = useState(null); // resultaat URL-import (overleeft tab-wissel)
  const [serverOnline, setServerOnline] = useState(true);   // server bereikbaar?
  const serverCheckRef = React.useRef(null);

  // ── Server health check ─────────────────────────────────────────────────
  React.useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("/api/health", {signal: AbortSignal.timeout(3000)});
        setServerOnline(r.ok);
      } catch {
        setServerOnline(false);
      }
    };
    check(); // direct bij start
    serverCheckRef.current = setInterval(check, 10000);
    return () => clearInterval(serverCheckRef.current);
  }, []);

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

  // Sluit recent-dropdown bij klik buiten
  React.useEffect(()=>{
    if(!showRecent) return;
    const h=()=>setShowRecent(false);
    setTimeout(()=>document.addEventListener("click",h),0);
    return ()=>document.removeEventListener("click",h);
  },[showRecent]);

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
    { id:"review",    icon:"🔁", label:"Review",     sub: null },
    { id:"canvas",    icon:"⬜", label:"Canvas",     sub: null },
  ];

  // Bepaal welke hoofdtab actief is op basis van de huidige subtab
  const activeMain = React.useMemo(() => {
    if (tab === "notes") return "notes";
    if (tab === "review") return "review";
    if (tab === "canvas") return "canvas";
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
    onSelectNote:   id => { setSelId(id); pushRecent(id); },
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
    splitMode,
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
    if (mainId === "review") { setTab("review"); return; }
    if (mainId === "canvas") { setTab("canvas"); return; }
    const mt = MAIN_TABS.find(m => m.id === mainId);
    if (!mt?.sub) return;
    // Blijf op huidige subtab als die al tot deze hoofdtab behoort
    if (mt.sub.some(s => s.id === tab)) return;
    setTab(mt.sub[0].id);
  };

  // Mobile tabs = alleen de hoofdtabs
  const tabs = MAIN_TABS;

  // ── Top bar (desktop/tablet) ──────────────────────────────────────────────
  // ── Top bar (desktop/tablet) — Optie B redesign ──────────────────────────
  const topBar = !isMobile && React.createElement("div", {
    style:{
      height:"40px", background:"#080c0e",
      borderBottom:`1px solid #1a2428`,
      display:"flex", alignItems:"center", flexShrink:0,
      overflow:"visible", position:"relative", zIndex:200,
    }
  },
    // Logo — icoon + ZK
    React.createElement("div", {
      style:{
        padding: isTablet ? "0 10px" : "0 14px",
        height:"100%", display:"flex", alignItems:"center", gap:"8px",
        flexShrink:0, borderRight:`1px solid #1a2428`,
        userSelect:"none",
      }
    },
      // Kaartenbak SVG icoon
      React.createElement("svg", {
        width:"22", height:"18", viewBox:"0 0 22 18", fill:"none",
        style:{ flexShrink:0 }
      },
        // Bak (body)
        React.createElement("rect", {
          x:"1", y:"1", width:"20", height:"13", rx:"2.5",
          fill:"rgba(159,202,86,0.06)", stroke:"#9fca56", strokeWidth:"1.4"
        }),
        // Groene kaart (links, gekanteld)
        React.createElement("rect", {
          x:"3.5", y:"3.5", width:"6", height:"8", rx:"1.2",
          fill:"#1c1c1c", stroke:"#9fca56", strokeWidth:"1.1",
          transform:"rotate(-7 6.5 7.5)"
        }),
        // Blauwe kaart (rechts, licht gekanteld)
        React.createElement("rect", {
          x:"12", y:"2.5", width:"6", height:"8", rx:"1.2",
          fill:"#1c1c1c", stroke:"#8ac6f2", strokeWidth:"1.1",
          transform:"rotate(5 15 6.5)"
        }),
        // Bodem-lijn
        React.createElement("line", {
          x1:"1", y1:"15.5", x2:"21", y2:"15.5",
          stroke:"#9fca56", strokeWidth:"0.8", opacity:"0.2",
          strokeLinecap:"round"
        })
      ),
      // ZK tekst — alleen op desktop
      !isTablet && React.createElement("span", {
        style:{
          fontFamily:"'Hack', monospace",
          fontSize:"10px", fontWeight:"700",
          color:"#c0b8b0", letterSpacing:"2.5px",
        }
      }, "ZK")
    ),

    // Tablet sidebar toggle
    isTablet && React.createElement("button", {
      onClick: () => setSidebarOpen(p => !p),
      style:{background:sidebarOpen?"rgba(138,198,242,0.15)":"none",
             border:"none", borderRight:`1px solid #2a2a2a`,
             color:sidebarOpen?W.blue:"#6a6360",
             padding:"0 10px", height:"100%",
             fontSize:"16px", cursor:"pointer", flexShrink:0}
    }, "☰"),

    // ── Navigatietabs ────────────────────────────────────────────────────────
    React.createElement("div", {
      className: "tab-scroll-strip",
      style:{
        display:"flex", alignItems:"center", flex:1, minWidth:0,
        overflowX:"auto", overflowY:"hidden",
        WebkitOverflowScrolling:"touch", height:"100%",
      }
    },
      MAIN_TABS.map(({id, icon, label}) => {
        const isActive = activeMain === id;
        return React.createElement("button", {
          key:id,
          onClick: () => handleMainTab(id),
          className:`topbar-tab${isActive?" active":""}`,
          style:{
            borderRight: "none",
            flexShrink: 0,
            whiteSpace: "nowrap",
            padding: isTablet ? "0 10px" : "0 14px",
            fontSize: isTablet ? "18px" : "13px",
            gap: isTablet ? "0" : "5px",
            letterSpacing: ".2px",
            // Actieve tab: lichtere tekst, zachte pill achter de tab
            fontWeight: isActive ? "500" : "400",
          }
        },
          isTablet
            ? React.createElement("span",{style:{fontSize:"18px",lineHeight:1}}, icon)
            : React.createElement(React.Fragment, null,
                label,
                id === "review" && reviewDueCount > 0 && React.createElement("span", {
                  style:{
                    background: W.orange, color: W.bg,
                    borderRadius: "10px", fontSize: "10px",
                    fontWeight: "700", padding: "1px 6px",
                    marginLeft: "4px", lineHeight: "1.4",
                    display: "inline-block",
                    boxShadow: "0 0 6px rgba(245,169,127,0.4)",
                  }
                }, reviewDueCount)
              )
        );
      })
    ),

    // ── Split-knop — tussen tabs en rechterzone ──────────────────────────────
    !isTablet && React.createElement("button", {
      onClick:()=>{ setSplitMode(p=>{ if(!p){ setSplitTab("llm"); setSplitFocus("right"); } return !p; }); },
      title: splitMode ? "Split-scherm sluiten (⊟)" : "Split-scherm openen (⊞)",
      style:{
        flexShrink: 0,
        background: splitMode ? `rgba(125,216,198,0.12)` : "transparent",
        border: `1px solid ${splitMode ? "rgba(125,216,198,0.35)" : "#1a2428"}`,
        borderRadius: "6px",
        padding: "0 12px",
        height: "26px",
        margin: "0 6px",
        color: splitMode ? W.blue : W.fgDim,
        fontSize: "12px", cursor: "pointer",
        display: "flex", alignItems: "center", gap: "5px",
        transition: "all 0.12s",
        fontWeight: splitMode ? "600" : "400",
      },
      onMouseEnter: e => { if (!splitMode) { e.currentTarget.style.background="rgba(125,216,198,0.06)"; e.currentTarget.style.borderColor="rgba(125,216,198,0.2)"; e.currentTarget.style.color=W.fgDim; } },
      onMouseLeave: e => { if (!splitMode) { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="#1a2428"; e.currentTarget.style.color=W.fgDim; } },
    },
      React.createElement("span", {style:{fontSize:"13px", lineHeight:1}}, splitMode ? "⊟" : "⊞"),
      React.createElement("span", null, splitMode ? "sluit split" : "split")
    ),

    // ── Scheidingslijn ────────────────────────────────────────────────────────
    React.createElement("div", {
      style:{ width:"1px", height:"20px", background:"#1a2428", flexShrink:0, margin:"0 2px" }
    }),

    // ── Rechter zone: acties + status ─────────────────────────────────────────
    React.createElement("div", {
      style:{
        display:"flex", alignItems:"center", gap:"2px",
        padding:"0 6px", flexShrink:0,
      }
    },

      // Recent-dropdown (alleen desktop)
      !isTablet && recentIds.length > 0 && React.createElement(React.Fragment, null,
        React.createElement("button", {
          onClick: () => setShowRecent(p => !p),
          title:"Recent geopende notities",
          style:{
            background: showRecent?"rgba(138,198,242,0.08)":"transparent",
            border: showRecent?`1px solid rgba(138,198,242,0.25)`:"1px solid transparent",
            borderRadius:"5px", color: showRecent?W.blue:"#6a6360",
            padding:"3px 8px", height:"26px",
            fontSize:"13px", cursor:"pointer", flexShrink:0,
            display:"flex", alignItems:"center",
            transition:"all .12s",
          }
        }, "🕐"),
        showRecent && React.createElement("div", {
          style:{
            position:"absolute", top:"40px", left:"0",
            background:W.bg2, border:`1px solid ${W.splitBg}`,
            borderRadius:"0 0 8px 8px", zIndex:300,
            minWidth:"280px", boxShadow:"0 8px 24px rgba(0,0,0,0.5)",
            padding:"4px 0",
          }
        },
          React.createElement("div", {
            style:{padding:"6px 14px 4px", fontSize:"10px",
                   color:W.fgMuted, letterSpacing:"1px", textTransform:"uppercase"}
          }, "Recent geopend"),
          recentIds.map(id => {
            const n = notes.find(x => x.id === id);
            if (!n) return null;
            return React.createElement("div", {
              key: id,
              onClick: () => { setSelId(id); setTab("notes"); setShowRecent(false); pushRecent(id); },
              style:{
                padding:"8px 14px", cursor:"pointer",
                display:"flex", alignItems:"center", gap:"8px",
                background: id === selId ? "rgba(138,198,242,0.08)" : "transparent",
                borderLeft: id === selId ? `2px solid ${W.yellow}` : "2px solid transparent",
              },
              onMouseEnter: e => e.currentTarget.style.background = "rgba(255,255,255,0.04)",
              onMouseLeave: e => e.currentTarget.style.background = id === selId ? "rgba(138,198,242,0.08)" : "transparent",
            },
              React.createElement("span", {style:{fontSize:"12px",opacity:0.5}}, "📝"),
              React.createElement("span", {
                style:{fontSize:"13px", color:W.fg, flex:1,
                       overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}
              }, n.title || "–"),
              n.tags?.slice(0,2).map(t =>
                React.createElement("span", {
                  key:t,
                  style:{fontSize:"10px", color:W.comment, opacity:0.7,
                         background:"rgba(159,202,86,0.08)", borderRadius:"3px",
                         padding:"1px 5px", flexShrink:0}
                }, "#"+t)
              )
            );
          }),
          React.createElement("div", {
            style:{margin:"4px 8px 0", borderTop:`1px solid ${W.splitBg}`, paddingTop:"4px", paddingBottom:"4px"}
          },
            React.createElement("div", {
              onClick: () => setShowRecent(false),
              style:{padding:"6px 14px", fontSize:"11px", color:W.fgMuted,
                     cursor:"pointer", textAlign:"center"}
            }, "Sluiten")
          )
        )
      ),

      // Jobs indicator
      jobs.length > 0 && React.createElement("div",{style:{position:"relative"}},
        React.createElement("button",{
          onClick: e => { e.stopPropagation(); setJobsPanelOpen(p=>!p); },
          style:{
            display:"flex", alignItems:"center", gap:"4px",
            background: runningJobs.length>0 ? "rgba(138,198,242,0.08)" : "rgba(159,202,86,0.06)",
            border: `1px solid ${runningJobs.length>0 ? "rgba(138,198,242,0.2)" : "rgba(159,202,86,0.15)"}`,
            borderRadius:"5px",
            padding:"3px 8px", height:"26px",
            cursor:"pointer",
            color: runningJobs.length>0 ? "#a8d8f0" : W.comment,
            fontSize:"11px",
            animation: runningJobs.length>0 ? "ai-pulse 1.4s ease-in-out infinite" : "none",
          }
        },
          runningJobs.length>0
            ? React.createElement("span",{style:{display:"inline-block",width:"6px",height:"6px",
                borderRadius:"50%",background:"#a8d8f0",flexShrink:0,
                animation:"ai-dot 1.4s ease-in-out infinite"}})
            : React.createElement("span",null,"✓"),
          isTablet
            ? (runningJobs.length>0 ? runningJobs.length : doneJobs.length)
            : (runningJobs.length>0
                ? (runningJobs.length===1 ? runningJobs[0].label.slice(0,18) : runningJobs.length+" actief")
                : doneJobs.length+" klaar")
        ),
        jobsPanelOpen && React.createElement("div",{
          onClick: e=>e.stopPropagation(),
          style:{position:"absolute",top:"calc(100% + 6px)",right:0,width:"320px",
                 background:W.bg2,border:`1px solid ${W.splitBg}`,borderRadius:"10px",
                 boxShadow:"0 12px 40px rgba(0,0,0,0.7)",zIndex:2000,overflow:"hidden",
                 animation:"fadeIn 0.14s ease-out"}
        },
          React.createElement("div",{style:{padding:"10px 14px",borderBottom:`1px solid ${W.splitBg}`,
            display:"flex",alignItems:"center",justifyContent:"space-between"}},
            React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted,letterSpacing:"1px",textTransform:"uppercase"}},"Achtergrondtaken"),
            React.createElement("div",{style:{display:"flex",gap:"6px",alignItems:"center"}},
              doneJobs.length>0 && React.createElement("button",{onClick:clearDoneJobs,
                style:{background:"none",border:"none",color:W.fgMuted,fontSize:"12px",cursor:"pointer",textDecoration:"underline",padding:"0"}},"wis"),
              React.createElement("button",{onClick:()=>setJobsPanelOpen(false),
                style:{background:"none",border:"none",color:W.fgMuted,fontSize:"16px",cursor:"pointer",padding:"0 2px",lineHeight:1}},"×")
            )
          ),
          React.createElement("div",{style:{maxHeight:"340px",overflowY:"auto"}},
            jobs.length===0
              ? React.createElement("div",{style:{padding:"20px",color:W.fgMuted,fontSize:"13px",textAlign:"center"}},"Geen taken")
              : [...jobs].reverse().map(job =>
                  React.createElement("div",{key:job.id,
                    style:{padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.04)",
                           display:"flex",alignItems:"flex-start",gap:"10px"}},
                    React.createElement("span",{style:{fontSize:"14px",marginTop:"1px",flexShrink:0,
                      animation:job.status==="running"?"ai-dot 1.4s ease-in-out infinite":"none"}},
                      job.status==="running"?"⏳":job.status==="done"?"✓":"✕"),
                    React.createElement("div",{style:{flex:1,minWidth:0}},
                      React.createElement("div",{style:{fontSize:"13px",
                        color:job.status==="running"?W.fg:job.status==="done"?W.comment:W.orange,
                        overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},job.label),
                      job.status==="running" && React.createElement("div",{style:{marginTop:"5px",height:"2px",
                        borderRadius:"1px",background:"rgba(255,255,255,0.08)",overflow:"hidden"}},
                        React.createElement("div",{style:{height:"100%",width:"40%",borderRadius:"1px",
                          background:W.blue,animation:"progress-slide 1.4s ease-in-out infinite"}})),
                      job.error && React.createElement("div",{style:{fontSize:"12px",color:W.orange,
                        marginTop:"3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},job.error),
                      job.result && React.createElement("div",{style:{fontSize:"12px",color:W.fgMuted,
                        marginTop:"3px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},job.result),
                      job.type==="import" && job.status==="done" && job.importResult &&
                        React.createElement("button",{
                          onClick:()=>{setImportPreview(job.importResult);setTab("import");setJobsPanelOpen(false);},
                          style:{marginTop:"5px",background:"rgba(138,198,242,0.1)",
                                 border:"1px solid rgba(138,198,242,0.35)",borderRadius:"5px",
                                 padding:"3px 10px",color:"#a8d8f0",fontSize:"12px",
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
                          style:{background:"none",border:"none",color:W.splitBg,
                                 fontSize:"14px",cursor:"pointer",padding:"0",flexShrink:0,
                                 lineHeight:1}},"×")
                  )
                )
          )
        )
      ),

      // Model picker
      React.createElement(ModelPicker, {llmModel, setLlmModel, compact: false}),

      // Server status — compact stip + label
      React.createElement("div", {
        title: serverOnline ? "Server bereikbaar" : "Server niet bereikbaar — herstart server.py",
        style:{
          display:"flex", alignItems:"center", gap:"4px",
          padding:"3px 8px", borderRadius:"5px", height:"26px",
          background: serverOnline?"rgba(159,202,86,0.06)":"rgba(229,120,109,0.08)",
          border:`1px solid ${serverOnline?"rgba(159,202,86,0.18)":"rgba(229,120,109,0.25)"}`,
          cursor:"default", flexShrink:0, transition:"all 0.4s ease",
        }
      },
        React.createElement("div",{style:{
          width:"5px", height:"5px", borderRadius:"50%", flexShrink:0,
          background: serverOnline?"#9fca56":"#e5786d",
          animation: serverOnline?"none":"ai-pulse 1.4s ease-in-out infinite",
        }}),
        !isTablet && React.createElement("span",{style:{
          fontSize:"11px",
          color: serverOnline?"#9fca56":"#e5786d",
        }}, serverOnline?"online":"offline")
      ),

      // Instellingen knop — icoon only
      React.createElement("button", {
        onClick:()=>setShowSettings(true),
        title:"Instellingen",
        style:{
          background:"transparent",
          border:"1px solid transparent",
          borderRadius:"5px", padding:"3px 7px", height:"26px",
          color:"#6a6360", fontSize:"14px", cursor:"pointer",
          display:"flex", alignItems:"center",
          transition:"all .12s", flexShrink:0,
        },
        onMouseEnter: e => { e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor="#383838"; e.currentTarget.style.color="#a09890"; },
        onMouseLeave: e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="transparent"; e.currentTarget.style.color="#6a6360"; },
      }, "⚙")
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

      // Canvas altijd in DOM — bewaart board state bij tab-wissel
      React.createElement("div", {
        key:"canvas-always",
        style:{
          flex:1, display:(tab==="canvas"&&!splitMode)?"flex":"none",
          flexDirection:"row", overflow:"hidden", minHeight:0
        }
      }, React.createElement(Whiteboard,{
        notes, llmModel, serverImages,
        onCreateNote: async ({ title, content }) => {
          const id = genId();
          const note = { id, title: title || "Nieuw", content: content || "",
                         tags: [], created: new Date().toISOString() };
          await NoteStore.save(note);
          setNotes([...NoteStore.getAll()]);
          return note;
        },
      })),

      // Andere tabs: alleen renderen als actief
      (tab!=="notes"&&tab!=="canvas"||splitMode) && (() => {
        const renderTab = (t) => {
          // "notes" in rechter split: toon een aparte NotesTab instantie
          if(t==="notes" && splitMode) return React.createElement("div",{
            style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}
          }, notesTabEl);
          if(t==="search") return React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minHeight:0}},
            React.createElement(FuzzySearch,{
              onPasteToNote: selId ? handlePasteToNote : null,
              notes, allTags,
              onOpenNote: (id) => {
                setSelId(id);
                if (splitMode) {
                  // Split modus: open links, blijf in zoek-tab rechts
                  setSplitFocus("left");
                } else {
                  setTab("notes");
                }
              },
              onAddNote:  async(note) => {
                const saved = await NoteStore.save(note);
                setNotes([...NoteStore.getAll()]);
                setSelId(saved.id);
                if (splitMode) {
                  setSplitFocus("left");
                } else {
                  setTab("notes");
                }
              },
              onUpdateNote: async(note) => {
                await NoteStore.save(note);
                setNotes([...NoteStore.getAll()]);
              },
              openLabel: splitMode ? "◀ Open links" : "→ Open in editor",
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
              onRefreshPdfs: refreshPdfs,
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
            llmModel,
            onOpenNote: id => { setSelId(id); setTab("notes"); },
            onUpdateNote: async note => { await NoteStore.save(note); setNotes([...NoteStore.getAll()]); },
          });
          // Canvas in split-mode: apart instance
          if(t==="canvas") return React.createElement("div",{
            style:{flex:1,display:"flex",flexDirection:"row",overflow:"hidden",minHeight:0}
          }, React.createElement(Whiteboard,{
            notes, llmModel, serverImages,
            onCreateNote: async ({ title, content }) => {
              const id = genId();
              const note = { id, title: title || "Nieuw", content: content || "",
                             tags: [], created: new Date().toISOString() };
              await NoteStore.save(note);
              setNotes([...NoteStore.getAll()]);
              return note;
            },
          }));
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
                // Vaste set tabs voor rechter split-paneel
                [
                  {id:"notes",   icon:"✏️",  label:"Schrijven"},
                  {id:"search",  icon:"🔍", label:"Zoeken"},
                  {id:"canvas",  icon:"⬜", label:"Canvas"},
                  {id:"graph",   icon:"🕸",  label:"Graaf"},
                  {id:"mindmap", icon:"🗺",  label:"Mindmap"},
                  {id:"llm",     icon:"🧠", label:"Notebook"},
                  {id:"pdf",     icon:"📄", label:"PDF"},
                  {id:"images",  icon:"🖼",  label:"Plaatjes"},
                ].map(({id,icon,label})=>React.createElement("button",{
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