import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── WOMBAT COLOR SCHEME ────────────────────────────────────────────────────────
const W = {
  bg:        "#242424", bg2: "#1c1c1c", bg3: "#2d2d2d",
  statusBg:  "#444444", visualBg: "#554d4b", cursorBg: "#eae788",
  splitBg:   "#3a4046", lineNrBg: "#303030",
  fg:        "#e3e0d7", fgMuted: "#857b6f", fgDim: "#a0a8b0",
  statusFg:  "#ffffd7", visualFg: "#c3c6ca",
  comment:   "#9fca56", string: "#cae682", keyword: "#8ac6f2",
  type:      "#92b5dc", special: "#e5786d", identifier: "#c3c6ca",
  orange:    "#e5786d", purple: "#d787ff", green: "#9fca56",
  yellow:    "#eae788", blue:   "#8ac6f2",
};

// ─── Highlight color palette for PDF ───────────────────────────────────────────
const HCOLORS = [
  { id:"yellow", label:"Geel",   bg:"rgba(234,231,136,0.45)", border:"#eae788" },
  { id:"green",  label:"Groen",  bg:"rgba(159,202,86,0.40)",  border:"#9fca56" },
  { id:"blue",   label:"Blauw",  bg:"rgba(138,198,242,0.40)", border:"#8ac6f2" },
  { id:"orange", label:"Oranje", bg:"rgba(229,120,109,0.40)", border:"#e5786d" },
  { id:"purple", label:"Paars",  bg:"rgba(215,135,255,0.40)", border:"#d787ff" },
];

const NOTES_KEY    = "zk-v3-notes";
const PDFNOTES_KEY = "zk-v3-pdfnotes";

const SEED = [
  {
    id: "20240101000001",
    title: "Zettelkasten — Begin hier",
    content: `# Zettelkasten\n\n*Elke notitie is een atoom van kennis.*\n\n## VIM commando's voor tags\n\n- \`:tag rust async\` — vervang alle tags\n- \`:tag+ newtag\` — voeg één tag toe\n- \`:tag- rust\` — verwijder een tag\n- \`:tags\` — toon huidige tags\n- \`:retag\` — herbereken tags uit #hash in tekst\n- \`:tagsug\` — toon beschikbare tags (Tab voor autocomplete)\n\n## Navigatie\n\n- \`h j k l\` — bewegen · \`w/b\` — woord\n- \`gg / G\` — begin/einde · \`0 / $\` — regel\n- \`dd\` — verwijder · \`yy\` — kopieer · \`p\` — plak\n- \`u\` — undo · \`Ctrl+r\` — redo\n- \`:w\` opslaan · \`:wq\` opslaan+sluiten\n\nZie ook [[20240101000002]] voor links.\n#meta #vim`,
    tags: ["meta","vim"],
    created: new Date().toISOString(), modified: new Date().toISOString(),
  },
  {
    id: "20240101000002",
    title: "Links en Verbindingen",
    content: `# Links en Verbindingen\n\nGebruik \`[[ID]]\` of \`[[Titel]]\` voor links.\n\nTerug naar [[20240101000001]].\n\n#methode #links`,
    tags: ["methode","links"],
    created: new Date().toISOString(), modified: new Date().toISOString(),
  },
];

// ─── Utils ─────────────────────────────────────────────────────────────────────
const genId = () => {
  const n = new Date();
  return [n.getFullYear(), String(n.getMonth()+1).padStart(2,"0"),
    String(n.getDate()).padStart(2,"0"), String(n.getHours()).padStart(2,"0"),
    String(n.getMinutes()).padStart(2,"0"), String(n.getSeconds()).padStart(2,"0"),
    String(Math.floor(Math.random()*99)).padStart(2,"0")].join("");
};
const extractLinks = (c="") => [...new Set([...c.matchAll(/\[\[([^\]]+)\]\]/g)].map(m=>m[1]))];
const extractTags  = (c="") => [...new Set([...c.matchAll(/#(\w+)/g)].map(m=>m[1]))];

// ─── Markdown renderer ─────────────────────────────────────────────────────────
const renderMd = (text, notes) => {
  if (!text) return "";
  let h = text.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  h = h.replace(/^### (.+)$/gm,"<h3>$1</h3>");
  h = h.replace(/^## (.+)$/gm,"<h2>$1</h2>");
  h = h.replace(/^# (.+)$/gm,"<h1>$1</h1>");
  h = h.replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  h = h.replace(/\*(.+?)\*/g,"<em>$1</em>");
  h = h.replace(/`(.+?)`/g,"<code>$1</code>");
  h = h.replace(/\[\[([^\]]+)\]\]/g,(_,id)=>{
    const n=notes.find(x=>x.id===id||x.title===id);
    return `<span class="zlink" data-id="${id}">${n?n.title:id}</span>`;
  });
  h = h.replace(/#(\w+)/g,'<span class="taghl">#$1</span>');
  h = h.replace(/^[-*] (.+)$/gm,"<li>$1</li>");
  h = h.replace(/(<li>[\s\S]*?<\/li>\n?)+/g,"<ul>$&</ul>");
  return h.split(/\n\n+/).map(b=>{
    if(/^<(h[123]|ul|li)/.test(b)) return b;
    return `<p>${b.replace(/\n/g,"<br>")}</p>`;
  }).join("\n");
};

// ─── Tag Pill ──────────────────────────────────────────────────────────────────
const TagPill = ({ tag, onRemove, small }) => (
  <span style={{
    display:"inline-flex", alignItems:"center", gap:"3px",
    fontSize: small ? "9px" : "10px",
    background:"rgba(159,202,86,0.13)",
    color:W.comment,
    padding: small ? "1px 5px" : "2px 7px",
    borderRadius:"3px",
    border:`1px solid rgba(159,202,86,0.25)`,
    fontFamily:"'Hack','Courier New',monospace",
  }}>
    #{tag}
    {onRemove && (
      <span onClick={()=>onRemove(tag)} style={{cursor:"pointer",color:W.fgMuted,marginLeft:"2px",lineHeight:1,fontSize:"10px"}}>×</span>
    )}
  </span>
);

// ─── Inline Tag Editor ─────────────────────────────────────────────────────────
const TagEditor = ({ tags=[], onChange, allTags=[] }) => {
  const [input, setInput] = useState("");
  const [open,  setOpen]  = useState(false);
  const inputRef = useRef(null);

  const suggestions = allTags.filter(t=>t.toLowerCase().includes(input.toLowerCase())&&!tags.includes(t)).slice(0,8);

  const add = (tag) => {
    const t = tag.trim().replace(/^#/,"").replace(/\s+/g,"_");
    if (!t||tags.includes(t)) return;
    onChange([...tags,t]); setInput("");
  };
  const remove = (tag) => onChange(tags.filter(t=>t!==tag));

  return (
    <div style={{position:"relative"}}>
      <div style={{
        display:"flex", flexWrap:"wrap", gap:"4px", alignItems:"center",
        background:W.bg2, border:`1px solid ${W.splitBg}`,
        borderRadius:"4px", padding:"4px 6px", minHeight:"28px", cursor:"text",
      }} onClick={()=>{setOpen(true);inputRef.current?.focus();}}>
        {tags.map(t=><TagPill key={t} tag={t} onRemove={remove} small/>)}
        <input ref={inputRef} value={input}
          onChange={e=>{setInput(e.target.value);setOpen(true);}}
          onKeyDown={e=>{
            if((e.key==="Enter"||e.key===" "||e.key===",")&&input.trim()){e.preventDefault();add(input);}
            if(e.key==="Escape") setOpen(false);
            if(e.key==="Backspace"&&!input&&tags.length) remove(tags[tags.length-1]);
          }}
          onFocus={()=>setOpen(true)}
          onBlur={()=>setTimeout(()=>setOpen(false),150)}
          placeholder={tags.length?"+ tag":"#tag toevoegen…"}
          style={{
            background:"transparent",border:"none",outline:"none",
            color:W.fg,fontSize:"10px",fontFamily:"'Hack','Courier New',monospace",
            width:input?`${input.length*7+20}px`:"90px",minWidth:"60px",
          }}
        />
      </div>
      {open&&(input||suggestions.length>0)&&(
        <div style={{
          position:"absolute",top:"calc(100% + 4px)",left:0,right:0,
          background:W.bg3,border:`1px solid ${W.splitBg}`,
          borderRadius:"4px",zIndex:200,overflow:"hidden",
          boxShadow:`0 4px 16px rgba(0,0,0,0.5)`,
        }}>
          {input&&(
            <div onMouseDown={()=>add(input)} style={{
              padding:"6px 10px",cursor:"pointer",fontSize:"11px",
              color:W.string,borderBottom:`1px solid ${W.splitBg}`,
              fontFamily:"'Hack','Courier New',monospace",
            }}>+ nieuw: <strong>#{input.replace(/^#/,"")}</strong></div>
          )}
          {suggestions.map(s=>(
            <div key={s} onMouseDown={()=>add(s)} style={{
              padding:"5px 10px",cursor:"pointer",fontSize:"11px",
              color:W.comment,fontFamily:"'Hack','Courier New',monospace",
            }}>#{s}</div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── VIM Editor ───────────────────────────────────────────────────────────────
const VimEditor = ({ value, onChange, onSave, onEscape, noteTags=[], onTagsChange, allTags=[] }) => {
  const [mode,        setMode]        = useState("NORMAL");
  const [cmdBuf,      setCmdBuf]      = useState("");
  const [statusMsg,   setStatusMsg]   = useState("");
  const [cursor,      setCursor]      = useState({ line:0, col:0 });
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm,  setSearchTerm]  = useState("");
  const [clipboard,   setClipboard]   = useState("");
  const [undoStack,   setUndoStack]   = useState([value]);
  const [undoIdx,     setUndoIdx]     = useState(0);
  const [pendingG,    setPendingG]    = useState(false);
  const [pendingD,    setPendingD]    = useState(false);
  const [pendingY,    setPendingY]    = useState(false);
  const textareaRef  = useRef(null);
  const containerRef = useRef(null);

  const pushUndo = useCallback((nv)=>{
    setUndoStack(prev=>[...prev.slice(0,undoIdx+1),nv]);
    setUndoIdx(p=>p+1);
  },[undoIdx]);

  const lines = value.split("\n");

  const syncCursor = () => {
    const ta=textareaRef.current; if(!ta) return;
    const pos=ta.selectionStart, before=value.substring(0,pos);
    const lineIdx=(before.match(/\n/g)||[]).length;
    setCursor({line:lineIdx, col:pos-before.lastIndexOf("\n")-1});
  };

  const moveTo = (li,ci) => {
    const ta=textareaRef.current; if(!ta) return;
    const ls=value.split("\n");
    let pos=0;
    for(let i=0;i<Math.min(li,ls.length-1);i++) pos+=ls[i].length+1;
    pos+=Math.min(ci,(ls[li]||"").length);
    ta.setSelectionRange(pos,pos); syncCursor();
  };

  const insertMode = () => { setMode("INSERT"); setStatusMsg(""); setTimeout(()=>textareaRef.current?.focus(),0); };
  const normalMode = () => {
    setMode("NORMAL"); setCmdBuf("");
    setPendingG(false); setPendingD(false); setPendingY(false); setStatusMsg("");
    setTimeout(()=>containerRef.current?.focus(),0);
  };

  // ─── :command handler with full tag commands ─────────────────────────────
  const runCommand = (raw) => {
    const cmd = raw.trim();

    if (/^tag\s+/.test(cmd)) {
      const tags=cmd.replace(/^tag\s+/,"").split(/[\s,]+/).map(t=>t.replace(/^#/,"").trim()).filter(Boolean);
      onTagsChange([...new Set(tags)]);
      setStatusMsg(`tags ingesteld: ${tags.map(t=>"#"+t).join(" ")}`);
      setMode("NORMAL"); setCmdBuf(""); return;
    }
    if (/^tag\+/.test(cmd)) {
      const add=cmd.replace(/^tag\+\s*/,"").replace(/^#/,"").trim();
      if(add){onTagsChange([...new Set([...noteTags,add])]);setStatusMsg(`tag toegevoegd: #${add}`);}
      setMode("NORMAL"); setCmdBuf(""); return;
    }
    if (/^tag-/.test(cmd)) {
      const rem=cmd.replace(/^tag-\s*/,"").replace(/^#/,"").trim();
      onTagsChange(noteTags.filter(t=>t!==rem));
      setStatusMsg(`tag verwijderd: #${rem}`);
      setMode("NORMAL"); setCmdBuf(""); return;
    }
    if (cmd==="tags") {
      setStatusMsg(noteTags.length?`tags: ${noteTags.map(t=>"#"+t).join(" ")}`:"(geen tags — gebruik :tag+ naam)");
      setMode("NORMAL"); setCmdBuf(""); return;
    }
    if (cmd==="retag") {
      const found=extractTags(value);
      onTagsChange([...new Set([...noteTags,...found])]);
      setStatusMsg(`retag: ${found.length?found.map(t=>"#"+t).join(" "):"geen #hash gevonden"}`);
      setMode("NORMAL"); setCmdBuf(""); return;
    }
    if (cmd==="tagsug"||cmd==="taglist") {
      setStatusMsg(allTags.length?`tags: ${allTags.slice(0,15).map(t=>"#"+t).join(" ")}`:"(nog geen tags in systeem)");
      setMode("NORMAL"); setCmdBuf(""); return;
    }
    if (cmd==="w"||cmd==="write"){onSave();setStatusMsg('"[opgeslagen]"');}
    else if(cmd==="q"||cmd==="quit"){onEscape();}
    else if(cmd==="wq"){onSave();onEscape();}
    else if(cmd==="q!"){onEscape();}
    else setStatusMsg(`E492: onbekend commando: ${cmd}`);
    setMode("NORMAL"); setCmdBuf("");
  };

  const handleNormalKey = (e) => {
    const ta=textareaRef.current; if(!ta) return;
    const k=e.key, ctrl=e.ctrlKey;

    if (mode==="COMMAND") {
      if(k==="Enter"){runCommand(cmdBuf);return;}
      if(k==="Escape"){setMode("NORMAL");setCmdBuf("");return;}
      if(k==="Backspace"){setCmdBuf(p=>p.slice(0,-1));return;}
      if(k==="Tab"){
        e.preventDefault();
        // Autocomplete tag names
        const m=cmdBuf.match(/^(tag[+\-]?\s+)(\S*)$/);
        if(m){
          const partial=m[2].replace(/^#/,"");
          const match=allTags.find(t=>t.startsWith(partial)&&t!==partial);
          if(match) setCmdBuf(m[1]+match);
        }
        return;
      }
      if(k.length===1){setCmdBuf(p=>p+k);}
      return;
    }
    if(mode==="SEARCH"){
      if(k==="Enter"){setSearchTerm(searchInput);setStatusMsg(`/${searchInput}`);setMode("NORMAL");setSearchInput("");return;}
      if(k==="Escape"){setMode("NORMAL");setSearchInput("");return;}
      if(k==="Backspace"){setSearchInput(p=>p.slice(0,-1));return;}
      if(k.length===1) setSearchInput(p=>p+k); return;
    }

    e.preventDefault();

    if(pendingG){setPendingG(false);if(k==="g"){ta.setSelectionRange(0,0);syncCursor();}return;}
    if(pendingD){
      setPendingD(false);
      if(k==="d"){
        const ls=value.split("\n"),cur=cursor.line;
        setClipboard(ls[cur]);ls.splice(cur,1);
        const nv=ls.join("\n");pushUndo(nv);onChange(nv);
        setTimeout(()=>moveTo(Math.min(cur,ls.length-1),0),0);
      }return;
    }
    if(pendingY){
      setPendingY(false);
      if(k==="y"){setClipboard(value.split("\n")[cursor.line]||"");setStatusMsg("1 line yanked");}
      return;
    }

    switch(k){
      case "i": insertMode(); break;
      case "I":{const st=value.split("\n").slice(0,cursor.line).join("\n").length+(cursor.line>0?1:0);ta.setSelectionRange(st,st);insertMode();break;}
      case "a":{ta.setSelectionRange((ta.selectionStart||0)+1,(ta.selectionStart||0)+1);insertMode();break;}
      case "A":{const e2=value.split("\n").slice(0,cursor.line+1).join("\n").length;ta.setSelectionRange(e2,e2);insertMode();break;}
      case "o":{const pos=value.split("\n").slice(0,cursor.line+1).join("\n").length;const nv=value.substring(0,pos)+"\n"+value.substring(pos);pushUndo(nv);onChange(nv);setTimeout(()=>{ta.setSelectionRange(pos+1,pos+1);insertMode();},0);break;}
      case "O":{const st=value.split("\n").slice(0,cursor.line).join("\n").length+(cursor.line>0?1:0);const nv=value.substring(0,st)+"\n"+value.substring(st);pushUndo(nv);onChange(nv);setTimeout(()=>{ta.setSelectionRange(st,st);insertMode();},0);break;}
      case "h":{const p=Math.max(0,(ta.selectionStart||1)-1);ta.setSelectionRange(p,p);syncCursor();break;}
      case "l":{const p=(ta.selectionStart||0)+1;ta.setSelectionRange(p,p);syncCursor();break;}
      case "j":{moveTo(Math.min(cursor.line+1,lines.length-1),cursor.col);break;}
      case "k":{moveTo(Math.max(0,cursor.line-1),cursor.col);break;}
      case "w":{let p=ta.selectionStart||0;while(p<value.length&&!/\s/.test(value[p]))p++;while(p<value.length&&/\s/.test(value[p]))p++;ta.setSelectionRange(p,p);syncCursor();break;}
      case "b":{let p=Math.max(0,(ta.selectionStart||1)-1);while(p>0&&/\s/.test(value[p]))p--;while(p>0&&!/\s/.test(value[p-1]))p--;ta.setSelectionRange(p,p);syncCursor();break;}
      case "0":{moveTo(cursor.line,0);break;}
      case "$":{moveTo(cursor.line,(lines[cursor.line]||"").length);break;}
      case "G":{ta.setSelectionRange(value.length,value.length);syncCursor();break;}
      case "g":{setPendingG(true);break;}
      case "d":{setPendingD(true);break;}
      case "y":{setPendingY(true);break;}
      case "p":{if(!clipboard)break;const pos=value.split("\n").slice(0,cursor.line+1).join("\n").length;const nv=value.substring(0,pos)+"\n"+clipboard+value.substring(pos);pushUndo(nv);onChange(nv);break;}
      case "x":{const p=ta.selectionStart||0;if(p<value.length){const nv=value.substring(0,p)+value.substring(p+1);pushUndo(nv);onChange(nv);ta.setSelectionRange(p,p);syncCursor();}break;}
      case "u":{if(undoIdx>0){const ni=undoIdx-1;setUndoIdx(ni);onChange(undoStack[ni]);setStatusMsg("-- undo --");}break;}
      case "r":{if(ctrl&&undoIdx<undoStack.length-1){const ni=undoIdx+1;setUndoIdx(ni);onChange(undoStack[ni]);setStatusMsg("-- redo --");}break;}
      case ":":{setMode("COMMAND");setCmdBuf("");break;}
      case "/":{setMode("SEARCH");setSearchInput("");break;}
      case "Escape": onEscape(); break;
    }
  };

  const handleInsertKey=(e)=>{if(e.key==="Escape"){e.preventDefault();pushUndo(value);normalMode();}};

  useEffect(()=>{if(mode!=="INSERT")containerRef.current?.focus();},[mode]);

  const modeColor={NORMAL:W.blue,INSERT:W.green,VISUAL:W.purple,COMMAND:W.orange,SEARCH:W.yellow};
  const modeLabel={NORMAL:"-- NORMAL --",INSERT:"-- INSERT --",VISUAL:"-- VISUAL --",COMMAND:":",SEARCH:"/"};

  const cmdHint=useMemo(()=>{
    if(mode!=="COMMAND") return null;
    if(/^tag\s*$/.test(cmdBuf)) return " <tag1 tag2…>  vervang alle";
    if(/^tag\+\s*$/.test(cmdBuf)) return " <tag>  toevoegen (Tab=autocomplete)";
    if(/^tag-\s*$/.test(cmdBuf)) return " <tag>  verwijderen";
    if(cmdBuf==="tags") return " → toon huidige tags";
    if(cmdBuf==="retag") return " → herbereken uit #hash";
    if(cmdBuf==="tagsug") return " → alle beschikbare tags";
    return null;
  },[mode,cmdBuf]);

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:W.bg,fontFamily:"'Hack','Hack','Courier New',monospace"}}>

      {/* Current tags strip */}
      {noteTags.length>0&&(
        <div style={{
          background:"rgba(159,202,86,0.06)",borderBottom:`1px solid rgba(159,202,86,0.15)`,
          padding:"4px 56px",display:"flex",gap:"4px",flexWrap:"wrap",alignItems:"center",flexShrink:0,
        }}>
          <span style={{fontSize:"10px",color:W.fgMuted,marginRight:"2px"}}>tags:</span>
          {noteTags.map(t=><TagPill key={t} tag={t} small/>)}
          <span style={{fontSize:"9px",color:W.splitBg,marginLeft:"8px"}}>:tag+ naam  :tag- naam  :retag  :tags</span>
        </div>
      )}

      <div style={{flex:1,display:"flex",overflow:"hidden",position:"relative"}}>
        {/* Line numbers */}
        <div style={{
          width:"48px",background:W.bg2,borderRight:`1px solid ${W.splitBg}`,
          paddingTop:"4px",overflowY:"hidden",flexShrink:0,userSelect:"none",
        }}>
          {lines.map((_,i)=>(
            <div key={i} style={{
              height:"21px",lineHeight:"21px",textAlign:"right",paddingRight:"8px",fontSize:"12px",
              color:i===cursor.line?W.statusFg:W.fgMuted,
              background:i===cursor.line?W.splitBg:"transparent",
              fontWeight:i===cursor.line?"bold":"normal",
            }}>{i+1}</div>
          ))}
        </div>

        {mode!=="INSERT"&&(
          <div ref={containerRef} tabIndex={0} onKeyDown={handleNormalKey}
            style={{position:"absolute",inset:0,zIndex:10,outline:"none",cursor:"text",background:"transparent"}}
          />
        )}

        <textarea
          ref={textareaRef}
          value={value}
          onChange={e=>{if(mode==="INSERT"){onChange(e.target.value);syncCursor();}}}
          onKeyDown={mode==="INSERT"?handleInsertKey:undefined}
          onSelect={syncCursor}
          onClick={()=>{if(mode==="NORMAL")syncCursor();}}
          readOnly={mode!=="INSERT"}
          spellCheck={false}
          style={{
            flex:1,background:W.bg,color:W.fg,border:"none",outline:"none",
            resize:"none",padding:"4px 12px",fontSize:"13px",lineHeight:"21px",
            fontFamily:"'Hack','Hack','Courier New',monospace",
            caretColor:mode==="INSERT"?W.cursorBg:"transparent",
          }}
        />

        {mode==="NORMAL"&&(
          <div style={{
            position:"absolute",top:`${cursor.line*21+4}px`,
            left:"48px",right:0,height:"21px",
            background:"rgba(85,77,75,0.35)",pointerEvents:"none",
            borderLeft:`2px solid ${W.visualBg}`,
          }}/>
        )}
      </div>

      {/* Status bar */}
      <div style={{
        height:"22px",background:W.statusBg,
        display:"flex",alignItems:"center",padding:"0 8px",gap:"10px",
        fontSize:"12px",flexShrink:0,borderTop:"1px solid #333",
      }}>
        <span style={{
          background:modeColor[mode]||W.blue,color:"#1c1c1c",
          padding:"0 8px",fontWeight:"bold",fontSize:"11px",
          letterSpacing:"1px",height:"100%",display:"flex",alignItems:"center",
        }}>{modeLabel[mode]}</span>

        {mode==="COMMAND"&&(
          <span style={{color:W.statusFg,fontSize:"12px"}}>
            :{cmdBuf}<span style={{background:W.statusFg,color:W.bg,width:"8px",display:"inline-block"}}> </span>
            {cmdHint&&<span style={{color:W.fgMuted,fontSize:"10px",marginLeft:"8px"}}>{cmdHint}</span>}
          </span>
        )}
        {mode==="SEARCH"&&(
          <span style={{color:W.yellow}}>/{searchInput}<span style={{background:W.yellow,color:W.bg,width:"8px",display:"inline-block"}}> </span></span>
        )}
        {(pendingG||pendingD||pendingY)&&<span style={{color:W.fgMuted}}>{pendingG?"g":pendingD?"d":"y"}</span>}

        <div style={{flex:1}}/>
        {statusMsg&&<span style={{color:W.string,fontSize:"11px",maxWidth:"420px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{statusMsg}</span>}
        <span style={{color:W.fgMuted,fontSize:"11px"}}>{cursor.line+1}:{cursor.col+1}</span>
        <span style={{color:W.fgDim,fontSize:"11px"}}>{Math.round(((cursor.line+1)/lines.length)*100)}%</span>
      </div>

      {/* Cheatsheet */}
      {mode==="NORMAL"&&(
        <div style={{
          background:W.bg2,borderTop:`1px solid ${W.splitBg}`,
          padding:"3px 12px",fontSize:"10px",color:W.fgMuted,
          display:"flex",gap:"10px",flexWrap:"wrap",flexShrink:0,
        }}>
          {[["i","ins"],["hjkl","move"],["w/b","word"],["dd","del"],["yy","yank"],["p","paste"],["u","undo"],["C-r","redo"],[":w","save"],[":tag","set tags"],[":tag+","add tag"],[":tag-","rem tag"],[":retag","auto tags"],[":tags","show"]].map(([k,v])=>(
            <span key={k}><span style={{color:W.blue,fontWeight:"bold"}}>{k}</span> <span style={{color:W.fgMuted}}>{v}</span></span>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── PDF Viewer — robust text selection via official PDF.js renderTextLayer ────
const PDFViewer = ({ pdfNotes, setPdfNotes, allTags }) => {
  const [pdfDoc,      setPdfDoc]      = useState(null);
  const [pdfFile,     setPdfFile]     = useState(null);
  const [pageNum,     setPageNum]     = useState(1);
  const [numPages,    setNumPages]    = useState(0);
  const [scale,       setScale]       = useState(1.4);
  const [highlights,  setHighlights]  = useState(pdfNotes||[]);
  const [pendingSel,  setPendingSel]  = useState(null);
  const [selPos,      setSelPos]      = useState({x:0,y:0});
  const [editingId,   setEditingId]   = useState(null);
  const [isLoading,   setIsLoading]   = useState(false);
  const [pdfjsLoaded, setPdfjsLoaded] = useState(false);
  const [activeColor, setActiveColor] = useState(HCOLORS[0]);
  const [filterTag,   setFilterTag]   = useState(null);
  const [quickNote,   setQuickNote]   = useState("");
  const [quickTags,   setQuickTags]   = useState([]);

  const canvasRef    = useRef(null);
  const textLayerRef = useRef(null);
  const wrapRef      = useRef(null);
  const scrollRef    = useRef(null);
  const fileRef      = useRef(null);
  const renderRef    = useRef(null);
  const tlRenderRef  = useRef(null);

  // ── Load PDF.js + text layer CSS ──────────────────────────────────────────
  useEffect(()=>{
    // Inject official PDF.js text layer CSS
    if (!document.getElementById("pdfjsTlCss")) {
      const link = document.createElement("link");
      link.id   = "pdfjsTlCss";
      link.rel  = "stylesheet";
      link.href = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf_viewer.min.css";
      document.head.appendChild(link);
    }
    if (window.pdfjsLib) { setPdfjsLoaded(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      setPdfjsLoaded(true);
    };
    document.head.appendChild(s);
  },[]);

  // ── Render page canvas + official text layer ───────────────────────────────
  const renderPage = useCallback(async (doc, num, sc) => {
    if (!doc || !canvasRef.current || !textLayerRef.current) return;

    // Cancel previous renders
    if (renderRef.current)   { try { renderRef.current.cancel();   } catch {} }
    if (tlRenderRef.current) { try { tlRenderRef.current.cancel(); } catch {} }

    const page = await doc.getPage(num);
    const vp   = page.getViewport({ scale: sc });

    // ── Canvas ──
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    canvas.width  = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.style.width  = Math.floor(vp.width)  + "px";
    canvas.style.height = Math.floor(vp.height) + "px";

    const renderTask = page.render({ canvasContext: ctx, viewport: vp });
    renderRef.current = renderTask;
    try { await renderTask.promise; } catch (e) { if (e?.name !== "RenderingCancelledException") console.warn(e); }

    // ── Text layer — using official PDF.js renderTextLayer ──
    const tl = textLayerRef.current;
    tl.innerHTML = "";
    tl.style.width  = Math.floor(vp.width)  + "px";
    tl.style.height = Math.floor(vp.height) + "px";
    // Remove any old pdfjs class then re-add
    tl.className = "textLayer";

    const textContent = await page.getTextContent();

    // Use official renderTextLayer (available in pdfjs 3.x)
    const tlTask = window.pdfjsLib.renderTextLayer({
      textContentSource: textContent,
      container:         tl,
      viewport:          vp,
      textDivs:          [],
    });
    tlRenderRef.current = tlTask;
    try { await tlTask.promise; } catch {}

  }, []);

  useEffect(() => {
    if (pdfDoc) renderPage(pdfDoc, pageNum, scale);
  }, [pdfDoc, pageNum, scale, renderPage]);

  // ── Load PDF file ──────────────────────────────────────────────────────────
  const loadPDF = async (e) => {
    const file = e.target.files[0];
    if (!file || !pdfjsLoaded) return;
    setPdfFile(file); setIsLoading(true);
    try {
      const ab  = await file.arrayBuffer();
      const doc = await window.pdfjsLib.getDocument({ data: ab }).promise;
      setPdfDoc(doc); setNumPages(doc.numPages); setPageNum(1);
    } catch (err) { console.error(err); }
    setIsLoading(false);
  };

  // ── Text selection → popup ─────────────────────────────────────────────────
  // Listen on the scroll container so we catch mouseup after dragging
  const handleMouseUp = useCallback((e) => {
    // Small delay so browser finalises selection
    setTimeout(() => {
      const sel = window.getSelection();
      const txt = sel?.toString().trim();
      if (!txt || txt.length < 2) return;

      // Only trigger when selection is inside our text layer
      const tl = textLayerRef.current;
      if (!tl) return;
      const range = sel.getRangeAt(0);
      if (!tl.contains(range.commonAncestorContainer)) return;

      const scrollEl = scrollRef.current;
      const sRect    = range.getBoundingClientRect();
      const cRect    = scrollEl.getBoundingClientRect();

      setPendingSel(txt);
      setSelPos({
        x: Math.max(8, Math.min(sRect.left - cRect.left + scrollEl.scrollLeft, cRect.width - 360)),
        y: sRect.bottom - cRect.top  + scrollEl.scrollTop  + 10,
      });
      setQuickNote(""); setQuickTags([]);
    }, 10);
  }, []);

  // ── Save / update / remove ─────────────────────────────────────────────────
  const saveHighlight = () => {
    if (!pendingSel) return;
    const h = {
      id: genId(), text: pendingSel, note: quickNote,
      tags: quickTags, page: pageNum,
      file: pdfFile?.name || "PDF", colorId: activeColor.id,
      created: new Date().toISOString(),
    };
    const updated = [...highlights, h];
    setHighlights(updated); setPdfNotes(updated);
    setPendingSel(null); setQuickNote(""); setQuickTags([]);
    window.getSelection()?.removeAllRanges();
  };

  const updateHighlight = (id, patch) => {
    const updated = highlights.map(h => h.id===id ? {...h,...patch} : h);
    setHighlights(updated); setPdfNotes(updated);
  };

  const removeHighlight = (id) => {
    const updated = highlights.filter(h => h.id!==id);
    setHighlights(updated); setPdfNotes(updated);
    if (editingId===id) setEditingId(null);
  };

  const allAnnotTags = [...new Set(highlights.flatMap(h=>h.tags||[]))];
  const panelHl      = filterTag ? highlights.filter(h=>(h.tags||[]).includes(filterTag)) : highlights;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{display:"flex",height:"100%",background:W.bg}}>

      {/* ── PDF column ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>

        {/* Toolbar */}
        <div style={{
          background:W.statusBg, borderBottom:`1px solid ${W.splitBg}`,
          padding:"5px 10px", display:"flex", alignItems:"center",
          gap:"8px", fontSize:"12px", flexShrink:0, flexWrap:"wrap",
        }}>
          <button onClick={()=>fileRef.current.click()} style={{
            background:W.blue,color:W.bg,border:"none",borderRadius:"4px",
            padding:"4px 10px",fontSize:"11px",cursor:"pointer",fontWeight:"bold",
          }}>:open PDF</button>

          {!pdfjsLoaded && <span style={{color:W.orange,fontSize:"10px"}}>pdf.js laden…</span>}
          <input ref={fileRef} type="file" accept=".pdf" style={{display:"none"}} onChange={loadPDF}/>

          {pdfDoc && (<>
            <span style={{color:W.fgMuted}}>│</span>
            <button onClick={()=>setPageNum(p=>Math.max(1,p-1))}
              style={{background:"none",border:"none",color:W.fg,cursor:"pointer",fontSize:"15px",padding:"0 3px"}}>◀</button>
            <span style={{color:W.statusFg,minWidth:"60px",textAlign:"center"}}>{pageNum} / {numPages}</span>
            <button onClick={()=>setPageNum(p=>Math.min(numPages,p+1))}
              style={{background:"none",border:"none",color:W.fg,cursor:"pointer",fontSize:"15px",padding:"0 3px"}}>▶</button>
            <span style={{color:W.fgMuted}}>│</span>
            <button onClick={()=>setScale(s=>Math.max(0.5,+(s-0.2).toFixed(1)))}
              style={{background:"none",border:"none",color:W.fg,cursor:"pointer",padding:"0 4px",fontSize:"16px"}}>−</button>
            <span style={{color:W.fgMuted,minWidth:"40px",textAlign:"center"}}>{Math.round(scale*100)}%</span>
            <button onClick={()=>setScale(s=>Math.min(3,+(s+0.2).toFixed(1)))}
              style={{background:"none",border:"none",color:W.fg,cursor:"pointer",padding:"0 4px",fontSize:"16px"}}>+</button>
            <span style={{color:W.fgMuted}}>│</span>
            {HCOLORS.map(c=>(
              <button key={c.id} onClick={()=>setActiveColor(c)} title={c.label} style={{
                width:"18px",height:"18px",borderRadius:"4px",
                background:c.bg, border:`2px solid ${activeColor.id===c.id?c.border:"transparent"}`,
                cursor:"pointer",padding:0,
                boxShadow:activeColor.id===c.id?`0 0 6px ${c.border}`:"none",
              }}/>
            ))}
            <span style={{color:W.fgMuted,fontSize:"10px",marginLeft:"4px",maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pdfFile?.name}</span>
          </>)}

          <div style={{flex:1}}/>
          {pdfDoc && <span style={{color:W.comment,fontSize:"10px"}}>① selecteer tekst  ② popup verschijnt  ③ sla op</span>}
        </div>

        {/* Scroll area — mouseUp here catches all drags */}
        <div ref={scrollRef}
          style={{flex:1,overflow:"auto",background:W.lineNrBg,position:"relative",cursor:"text"}}
          onMouseUp={handleMouseUp}
        >
          {isLoading && (
            <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{color:W.blue,fontSize:"14px"}}>laden…</span>
            </div>
          )}

          {!pdfDoc && !isLoading && (
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:"16px",color:W.fgMuted}}>
              <div style={{fontSize:"56px"}}>📄</div>
              <div style={{fontSize:"14px",color:W.fgDim}}>:open PDF om te beginnen</div>
              <div style={{fontSize:"11px",color:W.splitBg,maxWidth:"300px",textAlign:"center",lineHeight:"1.8"}}>
                Laad een PDF · Sleep tekst om te selecteren<br/>
                Kies kleur · Voeg tags toe · Opslaan
              </div>
            </div>
          )}

          {pdfDoc && (
            <div ref={wrapRef}
              style={{position:"relative",margin:"24px auto",width:"fit-content"}}
            >
              {/* PDF canvas */}
              <canvas ref={canvasRef}
                style={{display:"block",boxShadow:"0 4px 32px rgba(0,0,0,0.7)"}}
              />

              {/* Official PDF.js text layer — MUST be sibling of canvas, same size */}
              <div ref={textLayerRef}
                className="textLayer"
                style={{
                  position:"absolute",
                  top:0, left:0,
                  // width/height set dynamically in renderPage
                  overflow:"hidden",
                  lineHeight:1,
                  // ensure text is selectable
                  userSelect:"text",
                  WebkitUserSelect:"text",
                  MozUserSelect:"text",
                  cursor:"text",
                }}
              />

              {/* Highlight dot markers in right margin */}
              {highlights
                .filter(h=>h.page===pageNum && h.file===pdfFile?.name)
                .map((h,i)=>{
                  const col = HCOLORS.find(c=>c.id===h.colorId)||HCOLORS[0];
                  return (
                    <div key={h.id}
                      onClick={()=>setEditingId(h.id===editingId?null:h.id)}
                      title={h.text.substring(0,80)}
                      style={{
                        position:"absolute",
                        top:`${12+i*28}px`, right:"-22px",
                        width:"14px", height:"14px", borderRadius:"50%",
                        background:col.border, cursor:"pointer",
                        border:"2px solid rgba(0,0,0,0.4)",
                        boxShadow:`0 0 6px ${col.border}`,
                        zIndex:30,
                      }}
                    />
                  );
              })}

              {/* Selection popup — fixed to scroll container */}
              {pendingSel && (
                <div
                  style={{
                    position:"absolute",
                    left: selPos.x,
                    top:  selPos.y,
                    background:W.bg3,
                    border:`2px solid ${activeColor.border}`,
                    borderRadius:"8px", padding:"14px 16px",
                    zIndex:500, width:"350px",
                    boxShadow:`0 8px 32px rgba(0,0,0,0.8), 0 0 20px ${activeColor.border}30`,
                  }}
                  // Prevent mouseUp inside popup from immediately re-triggering
                  onMouseUp={e=>e.stopPropagation()}
                >
                  {/* Selected text preview */}
                  <div style={{
                    fontSize:"11px", color:W.fgDim, marginBottom:"10px",
                    padding:"7px 10px", background:activeColor.bg,
                    borderRadius:"4px", fontStyle:"italic", lineHeight:"1.6",
                    borderLeft:`4px solid ${activeColor.border}`,
                  }}>
                    "{pendingSel.substring(0,100)}{pendingSel.length>100?"…":""}"
                  </div>

                  {/* Color picker */}
                  <div style={{display:"flex",gap:"6px",marginBottom:"10px",alignItems:"center"}}>
                    <span style={{fontSize:"10px",color:W.fgMuted,marginRight:"2px"}}>kleur:</span>
                    {HCOLORS.map(c=>(
                      <button key={c.id} onClick={()=>setActiveColor(c)} title={c.label} style={{
                        width:"22px",height:"22px",borderRadius:"4px",
                        background:c.bg, border:`2px solid ${activeColor.id===c.id?c.border:W.splitBg}`,
                        cursor:"pointer", padding:0,
                        boxShadow:activeColor.id===c.id?`0 0 8px ${c.border}`:"none",
                        transition:"all 0.1s",
                      }}/>
                    ))}
                  </div>

                  {/* Note textarea */}
                  <textarea
                    autoFocus
                    value={quickNote}
                    onChange={e=>setQuickNote(e.target.value)}
                    onKeyDown={e=>{
                      if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();saveHighlight();}
                      if(e.key==="Escape"){setPendingSel(null);window.getSelection()?.removeAllRanges();}
                    }}
                    placeholder="Notitie (optioneel) — Enter = opslaan · Shift+Enter = nieuwe regel · Esc = sluiten"
                    rows={2}
                    style={{
                      width:"100%", background:W.bg, border:`1px solid ${W.splitBg}`,
                      borderRadius:"4px", padding:"8px 10px", color:W.fg,
                      fontSize:"12px", outline:"none", resize:"none", marginBottom:"8px",
                    }}
                  />

                  {/* Tag editor */}
                  <div style={{marginBottom:"12px"}}>
                    <div style={{fontSize:"10px",color:W.fgMuted,marginBottom:"4px"}}>tags:</div>
                    <TagEditor tags={quickTags} onChange={setQuickTags} allTags={[...allTags,...allAnnotTags]}/>
                  </div>

                  <div style={{display:"flex",gap:"8px"}}>
                    <button onClick={saveHighlight} style={{
                      background:activeColor.border, color:W.bg,
                      border:"none", borderRadius:"4px",
                      padding:"6px 16px", fontSize:"11px",
                      cursor:"pointer", fontWeight:"bold",
                    }}>✓ Opslaan</button>
                    <button onClick={()=>{setPendingSel(null);window.getSelection()?.removeAllRanges();}} style={{
                      background:"none", color:W.fgMuted,
                      border:`1px solid ${W.splitBg}`, borderRadius:"4px",
                      padding:"6px 12px", fontSize:"11px", cursor:"pointer",
                    }}>Esc</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Annotations panel ── */}
      <div style={{
        width:"292px", flexShrink:0, background:W.bg2,
        borderLeft:`1px solid ${W.splitBg}`,
        display:"flex", flexDirection:"column",
      }}>
        {/* Header */}
        <div style={{
          background:W.statusBg, borderBottom:`1px solid ${W.splitBg}`,
          padding:"6px 10px", display:"flex", alignItems:"center", gap:"6px", flexShrink:0,
        }}>
          <span style={{fontSize:"11px",color:W.statusFg,letterSpacing:"1px"}}>ANNOTATIES</span>
          <span style={{background:W.blue,color:W.bg,borderRadius:"10px",padding:"0 6px",fontSize:"10px"}}>{highlights.length}</span>
          <div style={{flex:1}}/>
          {filterTag && (
            <button onClick={()=>setFilterTag(null)} style={{
              background:"rgba(159,202,86,0.15)",color:W.comment,
              border:`1px solid rgba(159,202,86,0.3)`,borderRadius:"3px",
              fontSize:"10px",padding:"1px 6px",cursor:"pointer",
            }}>#{filterTag} ×</button>
          )}
        </div>

        {/* Tag filter chips */}
        {allAnnotTags.length>0 && (
          <div style={{
            padding:"5px 8px", borderBottom:`1px solid ${W.splitBg}`,
            display:"flex", gap:"3px", flexWrap:"wrap",
            background:"rgba(0,0,0,0.15)",
          }}>
            {allAnnotTags.map(t=>(
              <span key={t} onClick={()=>setFilterTag(filterTag===t?null:t)} style={{
                fontSize:"9px", padding:"1px 5px", borderRadius:"3px", cursor:"pointer",
                background:filterTag===t?"rgba(159,202,86,0.3)":"rgba(159,202,86,0.08)",
                color:W.comment,
                border:`1px solid rgba(159,202,86,${filterTag===t?0.5:0.15})`,
              }}>#{t}</span>
            ))}
          </div>
        )}

        {/* Annotation list */}
        <div style={{flex:1,overflow:"auto"}}>
          {panelHl.length===0 ? (
            <div style={{padding:"28px 14px",color:W.fgMuted,fontSize:"11px",textAlign:"center",lineHeight:"1.9"}}>
              {filterTag
                ? `Geen annotaties met #${filterTag}`
                : <>Selecteer tekst in de PDF<br/>om een annotatie te maken.</>
              }
            </div>
          ) : panelHl.map(h=>{
            const col      = HCOLORS.find(c=>c.id===h.colorId)||HCOLORS[0];
            const isEditing = editingId===h.id;
            return (
              <div key={h.id} style={{
                borderBottom:`1px solid ${W.splitBg}`,
                borderLeft:`3px solid ${col.border}`,
                background:isEditing?"rgba(255,255,255,0.025)":"transparent",
              }}>
                <div style={{padding:"8px 10px",cursor:"pointer"}}
                  onClick={()=>setEditingId(isEditing?null:h.id)}>
                  <div style={{fontSize:"11px",color:W.string,fontStyle:"italic",lineHeight:"1.5",marginBottom:"3px"}}>
                    "{h.text.substring(0,70)}{h.text.length>70?"…":""}"
                  </div>
                  {h.note && !isEditing && (
                    <div style={{fontSize:"11px",color:W.fg,lineHeight:"1.4",marginBottom:"4px"}}>
                      {h.note.substring(0,60)}{h.note.length>60?"…":""}
                    </div>
                  )}
                  <div style={{display:"flex",gap:"3px",flexWrap:"wrap",alignItems:"center"}}>
                    {(h.tags||[]).map(t=><TagPill key={t} tag={t} small/>)}
                    <span style={{fontSize:"9px",color:W.fgMuted,marginLeft:"auto"}}>p.{h.page}</span>
                    <span style={{fontSize:"9px",color:W.splitBg}}>{isEditing?"▲":"▼"}</span>
                  </div>
                </div>

                {isEditing && (
                  <div style={{padding:"0 10px 12px",borderTop:`1px solid ${W.splitBg}`}}>
                    <div style={{fontSize:"9px",color:W.fgMuted,margin:"8px 0 4px",letterSpacing:"1px"}}>NOTITIE</div>
                    <textarea
                      value={h.note||""}
                      onChange={e=>updateHighlight(h.id,{note:e.target.value})}
                      rows={3}
                      style={{
                        width:"100%",background:W.bg,border:`1px solid ${W.splitBg}`,
                        borderRadius:"4px",padding:"6px 8px",color:W.fg,
                        fontSize:"11px",outline:"none",resize:"vertical",
                      }}
                      placeholder="Notitie toevoegen…"
                    />
                    <div style={{fontSize:"9px",color:W.fgMuted,margin:"8px 0 4px",letterSpacing:"1px"}}>TAGS</div>
                    <TagEditor tags={h.tags||[]} onChange={tags=>updateHighlight(h.id,{tags})} allTags={[...allTags,...allAnnotTags]}/>
                    <div style={{fontSize:"9px",color:W.fgMuted,margin:"8px 0 4px",letterSpacing:"1px"}}>KLEUR</div>
                    <div style={{display:"flex",gap:"5px",marginBottom:"10px"}}>
                      {HCOLORS.map(c=>(
                        <button key={c.id} onClick={()=>updateHighlight(h.id,{colorId:c.id})} title={c.label} style={{
                          width:"18px",height:"18px",borderRadius:"3px",
                          background:c.bg,border:`2px solid ${h.colorId===c.id?c.border:W.splitBg}`,
                          cursor:"pointer",padding:0,
                        }}/>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:"6px"}}>
                      <button onClick={()=>setEditingId(null)} style={{
                        background:W.comment,color:W.bg,border:"none",borderRadius:"3px",
                        padding:"3px 10px",fontSize:"10px",cursor:"pointer",fontWeight:"bold",
                      }}>✓ klaar</button>
                      <button onClick={()=>removeHighlight(h.id)} style={{
                        background:"none",color:W.orange,
                        border:`1px solid rgba(229,120,109,0.3)`,borderRadius:"3px",
                        padding:"3px 8px",fontSize:"10px",cursor:"pointer",
                      }}>:del</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Knowledge Graph ───────────────────────────────────────────────────────────
const Graph = ({ notes, pdfNotes, onSelect, selectedId }) => {
  const cvRef=useRef(null), nodesRef=useRef([]), afRef=useRef(null), dragging=useRef(null);

  const build=useCallback(()=>{
    const cv=cvRef.current; if(!cv) return;
    const CW=cv.clientWidth,CH=cv.clientHeight;
    const allAnnotTags=[...new Set(pdfNotes.flatMap(p=>p.tags||[]))];
    const noteTagNodes=[...new Set(notes.flatMap(n=>n.tags||[]))].map(t=>({id:"tag-"+t,title:"#"+t,links:[],tags:[t],type:"tag"}));
    const pdfTagNodes=allAnnotTags.filter(t=>!notes.flatMap(n=>n.tags||[]).includes(t)).map(t=>({id:"tag-"+t,title:"#"+t,links:[],tags:[t],type:"tag"}));
    const all=[
      ...notes.map(n=>({id:n.id,title:n.title,links:extractLinks(n.content),tags:n.tags||[],type:"note"})),
      ...pdfNotes.slice(0,20).map(p=>({id:"pdf-"+p.id,title:"📄 "+p.text.substring(0,22),links:[],tags:p.tags||[],type:"pdf"})),
      ...noteTagNodes,...pdfTagNodes,
    ];
    nodesRef.current=all.map(n=>{
      const ex=nodesRef.current.find(x=>x.id===n.id);
      if(ex) return {...ex,...n};
      const angle=(all.indexOf(n)/all.length)*Math.PI*2;
      const r=Math.min(CW,CH)*0.28;
      return {...n,x:CW/2+r*Math.cos(angle)+(Math.random()-.5)*80,y:CH/2+r*Math.sin(angle)+(Math.random()-.5)*80,vx:0,vy:0};
    });
    nodesRef.current.forEach(n=>{
      n.tagLinks=(n.tags||[]).map(t=>"tag-"+t).filter(tid=>nodesRef.current.find(x=>x.id===tid));
    });
  },[notes,pdfNotes]);

  useEffect(()=>{
    const cv=cvRef.current; if(!cv) return;
    const dpr=window.devicePixelRatio||1;
    const resize=()=>{
      const p=cv.parentElement;
      cv.width=p.clientWidth*dpr; cv.height=p.clientHeight*dpr;
      cv.style.width=p.clientWidth+"px"; cv.style.height=p.clientHeight+"px";
      cv.getContext("2d").scale(dpr,dpr); build();
    };
    resize();
    const ro=new ResizeObserver(resize); ro.observe(cv.parentElement);
    return()=>ro.disconnect();
  },[build]);

  useEffect(()=>{build();},[notes,pdfNotes,build]);

  useEffect(()=>{
    const cv=cvRef.current; if(!cv) return;
    const ctx=cv.getContext("2d");
    const dpr=window.devicePixelRatio||1;
    const CW=()=>cv.width/dpr,CH=()=>cv.height/dpr;

    const tick=()=>{
      const nodes=nodesRef.current;
      if(!nodes.length){afRef.current=requestAnimationFrame(tick);return;}
      for(let i=0;i<nodes.length;i++){
        for(let j=i+1;j<nodes.length;j++){
          const dx=nodes[j].x-nodes[i].x,dy=nodes[j].y-nodes[i].y;
          const d=Math.sqrt(dx*dx+dy*dy)||1;
          const f=1600/(d*d);
          nodes[i].vx-=(dx/d)*f; nodes[i].vy-=(dy/d)*f;
          nodes[j].vx+=(dx/d)*f; nodes[j].vy+=(dy/d)*f;
        }
      }
      nodes.forEach(n=>{
        const att=(id,str)=>{const t=nodes.find(x=>x.id===id);if(!t)return;const dx=t.x-n.x,dy=t.y-n.y,d=Math.sqrt(dx*dx+dy*dy)||1;const f=str*d;n.vx+=(dx/d)*f;n.vy+=(dy/d)*f;t.vx-=(dx/d)*f;t.vy-=(dy/d)*f;};
        n.links.forEach(l=>att(l,0.025));
        (n.tagLinks||[]).forEach(l=>att(l,0.018));
        if(n===dragging.current)return;
        n.vx+=(CW()/2-n.x)*0.0008; n.vy+=(CH()/2-n.y)*0.0008;
        n.vx*=0.82; n.vy*=0.82;
        n.x=Math.max(50,Math.min(CW()-50,n.x+n.vx));
        n.y=Math.max(36,Math.min(CH()-36,n.y+n.vy));
      });

      ctx.clearRect(0,0,CW(),CH());
      ctx.fillStyle=W.bg; ctx.fillRect(0,0,CW(),CH());
      ctx.strokeStyle="rgba(255,255,255,0.025)"; ctx.lineWidth=1;
      for(let x=0;x<CW();x+=32){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,CH());ctx.stroke();}
      for(let y=0;y<CH();y+=32){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(CW(),y);ctx.stroke();}

      nodes.forEach(n=>{
        const draw=(id,color,dashed)=>{
          const t=nodes.find(x=>x.id===id); if(!t)return;
          const sel=n.id===selectedId||t.id===selectedId;
          ctx.beginPath(); ctx.moveTo(n.x,n.y); ctx.lineTo(t.x,t.y);
          ctx.setLineDash(dashed?[3,5]:[]);
          ctx.strokeStyle=sel?color:color+"35"; ctx.lineWidth=sel?1.5:0.8; ctx.stroke();
          ctx.setLineDash([]);
        };
        n.links.forEach(l=>draw(l,W.blue,false));
        (n.tagLinks||[]).forEach(l=>draw(l,W.comment,true));
      });

      nodes.forEach(n=>{
        const sel=n.id===selectedId;
        const r=n.type==="tag"?5:8+((n.links||[]).length+(n.tagLinks||[]).length)*2;
        if(sel){
          ctx.beginPath(); ctx.arc(n.x,n.y,r+9,0,Math.PI*2);
          const g=ctx.createRadialGradient(n.x,n.y,0,n.x,n.y,r+9);
          g.addColorStop(0,"rgba(234,231,136,0.3)"); g.addColorStop(1,"rgba(234,231,136,0)");
          ctx.fillStyle=g; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(n.x,n.y,r,0,Math.PI*2);
        ctx.fillStyle=n.type==="tag"?W.comment:n.type==="pdf"?W.orange:sel?W.yellow:W.keyword;
        ctx.fill();
        ctx.strokeStyle=sel?W.cursorBg:"rgba(140,198,242,0.2)";
        ctx.lineWidth=sel?2:1; ctx.stroke();
        ctx.fillStyle=sel?W.statusFg:W.fgDim;
        ctx.font=`${sel?"bold ":""}10px 'Courier New'`; ctx.textAlign="center";
        ctx.fillText(n.title.length>20?n.title.substring(0,18)+"…":n.title,n.x,n.y+r+12);
      });
      afRef.current=requestAnimationFrame(tick);
    };
    afRef.current=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(afRef.current);
  },[notes,pdfNotes,selectedId]);

  const nodeAt=(x,y)=>nodesRef.current.find(n=>{
    const dx=n.x-x,dy=n.y-y,r=n.type==="tag"?5:8+((n.links||[]).length+(n.tagLinks||[]).length)*2;
    return Math.sqrt(dx*dx+dy*dy)<r+6;
  });

  return (
    <div style={{position:"relative",width:"100%",height:"100%"}}>
      <canvas ref={cvRef} style={{width:"100%",height:"100%",cursor:"crosshair"}}
        onMouseDown={e=>{const r=cvRef.current.getBoundingClientRect();const n=nodeAt(e.clientX-r.left,e.clientY-r.top);if(n)dragging.current=n;}}
        onMouseMove={e=>{if(!dragging.current)return;const r=cvRef.current.getBoundingClientRect();dragging.current.x=e.clientX-r.left;dragging.current.y=e.clientY-r.top;dragging.current.vx=0;dragging.current.vy=0;}}
        onMouseUp={e=>{const r=cvRef.current.getBoundingClientRect();const n=nodeAt(e.clientX-r.left,e.clientY-r.top);if(n&&n.type==="note")onSelect(n.id);dragging.current=null;}}
      />
      <div style={{
        position:"absolute",bottom:"14px",left:"50%",transform:"translateX(-50%)",
        background:"rgba(28,28,28,0.9)",border:`1px solid ${W.splitBg}`,
        borderRadius:"6px",padding:"5px 14px",fontSize:"10px",color:W.fgMuted,
        display:"flex",gap:"12px",backdropFilter:"blur(8px)",fontFamily:"'Hack','Courier New',monospace",
      }}>
        <span><span style={{color:W.yellow}}>●</span> geselecteerd</span>
        <span><span style={{color:W.blue}}>●</span> notitie</span>
        <span><span style={{color:W.orange}}>●</span> pdf-annotatie</span>
        <span><span style={{color:W.comment}}>●</span> tag-node</span>
        <span style={{color:W.splitBg}}>·</span>
        <span>klik=open · sleep=beweg · stippel=tag-link</span>
      </div>
    </div>
  );
};

// ─── Settings Panel ────────────────────────────────────────────────────────────
const SettingsPanel = ({ notes, pdfNotes, setNotes, setPdfNotes, vault, setVault, onClose }) => {
  const [newVault,    setNewVault]    = useState(vault);
  const [importMsg,   setImportMsg]   = useState("");
  const [exportMsg,   setExportMsg]   = useState("");
  const importRef = useRef(null);

  // Export all data as a single JSON file
  const exportData = () => {
    const data = { vault, notes, pdfNotes, exportedAt: new Date().toISOString(), version: 3 };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `zettelkasten-${vault}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg(`✓ Geëxporteerd: ${notes.length} notities + ${pdfNotes.length} annotaties`);
    setTimeout(()=>setExportMsg(""), 3000);
  };

  // Import from a JSON file
  const importData = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.notes) throw new Error("Ongeldig formaat");
        if (window.confirm(`Importeer ${data.notes.length} notities + ${(data.pdfNotes||[]).length} annotaties?\n\nBestaande data wordt VERVANGEN.`)) {
          setNotes(data.notes);
          setPdfNotes(data.pdfNotes || []);
          setImportMsg(`✓ Geïmporteerd: ${data.notes.length} notities`);
          setTimeout(()=>setImportMsg(""), 3000);
        }
      } catch(err) {
        setImportMsg("✗ Fout bij importeren: " + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Export individual notes as separate .md files (zip via data URLs)
  const exportMarkdown = () => {
    notes.forEach(n => {
      const content = `---\nid: ${n.id}\ntitle: ${n.title}\ntags: [${(n.tags||[]).join(", ")}]\ncreated: ${n.created}\nmodified: ${n.modified}\n---\n\n${n.content}`;
      const blob = new Blob([content], { type: "text/markdown" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${n.id}-${n.title.replace(/[^a-z0-9]/gi,"_").toLowerCase()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    });
    setExportMsg(`✓ ${notes.length} markdown bestanden gedownload`);
    setTimeout(()=>setExportMsg(""), 3000);
  };

  const applyVault = () => {
    const v = newVault.trim().replace(/[^a-z0-9_-]/gi,"_") || "default";
    setVault(v);
    setImportMsg(`✓ Vault gewijzigd naar: "${v}" — herlaad de pagina om te activeren`);
  };

  const s = (extra={}) => ({
    background:W.bg, border:`1px solid ${W.splitBg}`, borderRadius:"4px",
    padding:"6px 10px", color:W.fg, fontSize:"12px", outline:"none",
    width:"100%", ...extra,
  });

  return (
    <div style={{
      position:"fixed", inset:0, background:"rgba(0,0,0,0.7)",
      display:"flex", alignItems:"center", justifyContent:"center",
      zIndex:1000,
    }} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{
        background:W.bg2, border:`1px solid ${W.splitBg}`,
        borderRadius:"8px", width:"480px", maxHeight:"85vh",
        overflow:"auto", boxShadow:"0 16px 64px rgba(0,0,0,0.8)",
      }}>
        {/* Header */}
        <div style={{
          background:W.statusBg, borderBottom:`1px solid ${W.splitBg}`,
          padding:"10px 16px", display:"flex", alignItems:"center",
        }}>
          <span style={{color:W.statusFg, fontSize:"12px", letterSpacing:"2px", fontWeight:"bold"}}>:INSTELLINGEN</span>
          <div style={{flex:1}}/>
          <button onClick={onClose} style={{background:"none",border:"none",color:W.fgMuted,fontSize:"18px",cursor:"pointer",lineHeight:1}}>×</button>
        </div>

        <div style={{padding:"20px"}}>

          {/* ── Vault / opslaglocatie ── */}
          <div style={{marginBottom:"24px"}}>
            <div style={{fontSize:"10px",color:W.comment,letterSpacing:"2px",marginBottom:"10px",textTransform:"uppercase"}}>
              📁 Vault — Opslaglocatie
            </div>
            <div style={{fontSize:"11px",color:W.fgDim,lineHeight:"1.7",marginBottom:"10px"}}>
              Een <em style={{color:W.yellow}}>vault</em> is een benoemde opslaglocatie in je browser.
              Verschillende vaults zijn volledig gescheiden — handig voor werk/privé of meerdere projecten.
            </div>
            <div style={{display:"flex",gap:"8px",marginBottom:"6px"}}>
              <input
                value={newVault}
                onChange={e=>setNewVault(e.target.value)}
                placeholder="vault naam (bijv. werk, privé, studie)"
                style={s({flex:1})}
              />
              <button onClick={applyVault} style={{
                background:W.blue, color:W.bg, border:"none", borderRadius:"4px",
                padding:"6px 14px", fontSize:"11px", cursor:"pointer", fontWeight:"bold", whiteSpace:"nowrap",
              }}>Opslaan</button>
            </div>
            <div style={{
              fontSize:"10px", padding:"6px 10px",
              background:"rgba(0,0,0,0.25)", borderRadius:"4px",
              color:W.fgMuted, display:"flex", gap:"8px", alignItems:"center",
            }}>
              <span style={{color:W.comment}}>●</span>
              <span>Huidige vault: <span style={{color:W.yellow, fontWeight:"bold"}}>"{vault}"</span></span>
              <span style={{color:W.splitBg}}>│</span>
              <span>Sleutel: <span style={{color:W.fgDim}}>zk-v3-notes-{vault}</span></span>
            </div>
          </div>

          {/* ── Export ── */}
          <div style={{marginBottom:"24px"}}>
            <div style={{fontSize:"10px",color:W.comment,letterSpacing:"2px",marginBottom:"10px",textTransform:"uppercase"}}>
              ⬇ Exporteren
            </div>
            <div style={{display:"flex",gap:"8px",marginBottom:"8px"}}>
              <button onClick={exportData} style={{
                flex:1, background:W.bg3, border:`1px solid ${W.splitBg}`,
                borderRadius:"4px", padding:"8px", fontSize:"11px",
                color:W.fg, cursor:"pointer", textAlign:"left",
              }}>
                <div style={{color:W.keyword, marginBottom:"2px"}}>📦 Alles exporteren (.json)</div>
                <div style={{color:W.fgMuted, fontSize:"10px"}}>Notities + PDF annotaties in één bestand</div>
              </button>
              <button onClick={exportMarkdown} style={{
                flex:1, background:W.bg3, border:`1px solid ${W.splitBg}`,
                borderRadius:"4px", padding:"8px", fontSize:"11px",
                color:W.fg, cursor:"pointer", textAlign:"left",
              }}>
                <div style={{color:W.string, marginBottom:"2px"}}>📝 Exporteer als Markdown</div>
                <div style={{color:W.fgMuted, fontSize:"10px"}}>Elke notitie als apart .md bestand</div>
              </button>
            </div>
            {exportMsg && <div style={{fontSize:"11px",color:W.comment,padding:"5px 8px",background:"rgba(159,202,86,0.1)",borderRadius:"3px"}}>{exportMsg}</div>}
          </div>

          {/* ── Import ── */}
          <div style={{marginBottom:"24px"}}>
            <div style={{fontSize:"10px",color:W.comment,letterSpacing:"2px",marginBottom:"10px",textTransform:"uppercase"}}>
              ⬆ Importeren
            </div>
            <button onClick={()=>importRef.current.click()} style={{
              width:"100%", background:W.bg3, border:`2px dashed ${W.splitBg}`,
              borderRadius:"4px", padding:"14px", fontSize:"11px",
              color:W.fgMuted, cursor:"pointer", textAlign:"center",
            }}>
              <div style={{fontSize:"20px",marginBottom:"4px"}}>📂</div>
              <div style={{color:W.fg, marginBottom:"2px"}}>Klik om een backup te importeren</div>
              <div style={{fontSize:"10px"}}>Ondersteund: .json (eerder geëxporteerd vanuit deze app)</div>
            </button>
            <input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={importData}/>
            {importMsg && <div style={{marginTop:"6px",fontSize:"11px",color:importMsg.startsWith("✓")?W.comment:W.orange,padding:"5px 8px",background:importMsg.startsWith("✓")?"rgba(159,202,86,0.1)":"rgba(229,120,109,0.1)",borderRadius:"3px"}}>{importMsg}</div>}
          </div>

          {/* ── Statistieken ── */}
          <div style={{
            padding:"12px", background:"rgba(0,0,0,0.2)", borderRadius:"4px",
            fontSize:"11px", color:W.fgMuted, display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px",
          }}>
            <div>📝 <span style={{color:W.fg}}>{notes.length}</span> notities</div>
            <div>🏷 <span style={{color:W.fg}}>{[...new Set(notes.flatMap(n=>n.tags||[]))].length}</span> unieke tags</div>
            <div>📄 <span style={{color:W.fg}}>{pdfNotes.length}</span> PDF annotaties</div>
            <div>💾 <span style={{color:W.fg}}>{Math.round(JSON.stringify({notes,pdfNotes}).length/1024)}KB</span> opgeslagen</div>
          </div>

        </div>
      </div>
    </div>
  );
};

// ─── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [notes,       setNotes]       = useState(SEED);
  const [selId,       setSelId]       = useState(SEED[0].id);
  const [vimMode,     setVimMode]     = useState(false);
  const [editTitle,   setEditTitle]   = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTags,    setEditTags]    = useState([]);
  const [tab,         setTab]         = useState("notes");
  const [search,      setSearch]      = useState("");
  const [pdfNotes,    setPdfNotes]    = useState([]);
  const [loaded,      setLoaded]      = useState(false);
  const [tagFilter,   setTagFilter]   = useState(null);
  const [showSettings,setShowSettings]= useState(false);
  const [vault,       setVaultState]  = useState("default");

  // Vault bepaalt de storage keys
  const notesKey    = `zk-v3-notes-${vault}`;
  const pdfKey      = `zk-v3-pdfnotes-${vault}`;

  const setVault = (v) => {
    setVaultState(v);
    window.storage.set("zk-vault", v).catch(()=>{});
  };

  // Laad vault-naam eerst, dan de data
  useEffect(()=>{
    const load=async()=>{
      try {
        // Laad vault naam
        const rv = await window.storage.get("zk-vault");
        const v  = rv?.value || "default";
        setVaultState(v);
        // Laad notities voor deze vault
        const r  = await window.storage.get(`zk-v3-notes-${v}`);
        if (r?.value) setNotes(JSON.parse(r.value));
        const rp = await window.storage.get(`zk-v3-pdfnotes-${v}`);
        if (rp?.value) setPdfNotes(JSON.parse(rp.value));
      } catch {}
      setLoaded(true);
    };
    load();
  },[]);

  useEffect(()=>{ if(!loaded) return; window.storage.set(notesKey,   JSON.stringify(notes)).catch(()=>{}); },[notes,   loaded, notesKey]);
  useEffect(()=>{ if(!loaded) return; window.storage.set(pdfKey,     JSON.stringify(pdfNotes)).catch(()=>{}); },[pdfNotes, loaded, pdfKey]);

  const selNote=notes.find(n=>n.id===selId);
  const allTags=useMemo(()=>[...new Set([...notes.flatMap(n=>n.tags||[]),...pdfNotes.flatMap(p=>p.tags||[])])]
  ,[notes,pdfNotes]);
  const sidebarTags=useMemo(()=>[...new Set(notes.flatMap(n=>n.tags||[]))]
  ,[notes]);
  const filtered=useMemo(()=>{
    const base=search?notes.filter(n=>n.title.toLowerCase().includes(search.toLowerCase())||n.content.toLowerCase().includes(search.toLowerCase())||n.tags?.some(t=>t.includes(search.toLowerCase()))):notes;
    return tagFilter?base.filter(n=>(n.tags||[]).includes(tagFilter)):base;
  },[notes,search,tagFilter]);

  const newNote=()=>{
    const id=genId();
    const n={id,title:"Nieuw zettel",content:`# Nieuw zettel\n\n`,tags:[],created:new Date().toISOString(),modified:new Date().toISOString()};
    setNotes(p=>[n,...p]); setSelId(id);
    setEditTitle(n.title); setEditContent(n.content); setEditTags([]);
    setVimMode(true);
  };
  const openEdit=()=>{
    if(!selNote)return;
    setEditTitle(selNote.title); setEditContent(selNote.content); setEditTags(selNote.tags||[]);
    setVimMode(true);
  };
  const save=()=>{
    setNotes(prev=>prev.map(n=>n.id===selId?{
      ...n,title:editTitle,content:editContent,
      tags:[...new Set([...editTags,...extractTags(editContent)])],
      modified:new Date().toISOString(),
    }:n));
  };
  const closeEdit=()=>setVimMode(false);
  const del=()=>{
    if(!selNote||!window.confirm("Verwijder dit zettel?"))return;
    const rest=notes.filter(n=>n.id!==selId);
    setNotes(rest); setSelId(rest[0]?.id||null); setVimMode(false);
  };
  const backlinks=useMemo(()=>selId?notes.filter(n=>extractLinks(n.content).includes(selId)):[]
  ,[notes,selId]);
  const handleLink=e=>{
    const el=e.target.closest(".zlink"); if(!el)return;
    const n=notes.find(x=>x.id===el.dataset.id||x.title===el.dataset.id);
    if(n)setSelId(n.id);
  };

  return (
    <div style={{
      display:"flex",flexDirection:"column",height:"100vh",
      background:W.bg,color:W.fg,
      fontFamily:"'Hack','Hack','Courier New',monospace",overflow:"hidden",
    }}>

      {/* Top bar */}
      <div style={{height:"40px",background:W.statusBg,borderBottom:`1px solid ${W.splitBg}`,display:"flex",alignItems:"center",flexShrink:0}}>
        <div style={{background:W.blue,color:W.bg,padding:"0 14px",height:"100%",display:"flex",alignItems:"center",fontWeight:"bold",fontSize:"12px",letterSpacing:"2px"}}>ZETTELKASTEN</div>
        {[{id:"notes",label:"notities"},{id:"graph",label:"graaf"},{id:"pdf",label:"pdf"}].map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            background:tab===t.id?W.bg:"transparent",
            color:tab===t.id?W.statusFg:W.fgMuted,
            border:"none",borderRight:`1px solid ${W.splitBg}`,
            padding:"0 18px",height:"100%",fontSize:"12px",
            fontFamily:"inherit",cursor:"pointer",letterSpacing:"1px",
            borderBottom:tab===t.id?`2px solid ${W.yellow}`:"2px solid transparent",
          }}>{t.label}</button>
        ))}
        <div style={{flex:1}}/>
        <div style={{padding:"0 14px",fontSize:"11px",color:W.fgMuted,display:"flex",gap:"14px",alignItems:"center"}}>
          <span>{notes.length} zettels</span>
          <span>{pdfNotes.length} annotaties</span>
          <span>{allTags.length} tags</span>
          <span style={{color:W.splitBg}}>│</span>
          <span style={{color:W.fgDim,fontSize:"10px"}}>vault: <span style={{color:W.yellow}}>{vault}</span></span>
          <button onClick={()=>setShowSettings(true)} style={{
            background:"none", border:`1px solid ${W.splitBg}`,
            borderRadius:"4px", padding:"3px 10px", color:W.fgMuted,
            fontSize:"11px", cursor:"pointer", letterSpacing:"1px",
          }}>:set</button>
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <SettingsPanel
          notes={notes} pdfNotes={pdfNotes}
          setNotes={setNotes} setPdfNotes={setPdfNotes}
          vault={vault} setVault={setVault}
          onClose={()=>setShowSettings(false)}
        />
      )}

      {/* Content */}
      {tab==="graph"?(
        <div style={{flex:1,overflow:"hidden"}}>
          <Graph notes={notes} pdfNotes={pdfNotes} onSelect={id=>{setSelId(id);setTab("notes");}} selectedId={selId}/>
        </div>
      ):tab==="pdf"?(
        <div style={{flex:1,overflow:"hidden"}}>
          <PDFViewer pdfNotes={pdfNotes} setPdfNotes={setPdfNotes} allTags={allTags}/>
        </div>
      ):(
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>

          {/* Sidebar */}
          <div style={{width:"220px",flexShrink:0,background:W.bg2,borderRight:`1px solid ${W.splitBg}`,display:"flex",flexDirection:"column"}}>
            <div style={{padding:"8px",borderBottom:`1px solid ${W.splitBg}`,background:W.statusBg,display:"flex",flexDirection:"column",gap:"6px"}}>
              <button onClick={newNote} style={{background:W.blue,color:W.bg,border:"none",borderRadius:"4px",padding:"6px",fontSize:"11px",fontFamily:"inherit",cursor:"pointer",fontWeight:"bold",letterSpacing:"1px"}}>:new zettel</button>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="/zoeken…"
                style={{background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"4px",padding:"5px 8px",color:W.fg,fontSize:"12px",fontFamily:"inherit",outline:"none",width:"100%"}}
              />
            </div>

            {/* Tag filter chips */}
            {sidebarTags.length>0&&(
              <div style={{padding:"5px 7px",borderBottom:`1px solid ${W.splitBg}`,display:"flex",gap:"3px",flexWrap:"wrap",background:"rgba(0,0,0,0.1)"}}>
                {sidebarTags.map(t=>(
                  <span key={t} onClick={()=>setTagFilter(tagFilter===t?null:t)} style={{
                    fontSize:"9px",padding:"1px 5px",borderRadius:"3px",cursor:"pointer",
                    fontFamily:"'Hack','Courier New',monospace",
                    background:tagFilter===t?"rgba(159,202,86,0.3)":"rgba(159,202,86,0.08)",
                    color:W.comment,border:`1px solid rgba(159,202,86,${tagFilter===t?0.5:0.15})`,
                  }}>#{t}</span>
                ))}
              </div>
            )}

            <div style={{flex:1,overflow:"auto"}}>
              {filtered.map(n=>{
                const sel=n.id===selId;
                return (
                  <div key={n.id} onClick={()=>{setSelId(n.id);setVimMode(false);}} style={{
                    padding:"7px 10px",borderBottom:`1px solid ${W.splitBg}`,cursor:"pointer",
                    background:sel?W.visualBg:"transparent",
                    borderLeft:`3px solid ${sel?W.yellow:"transparent"}`,
                  }}>
                    <div style={{fontSize:"12px",color:sel?W.statusFg:W.fg,lineHeight:"1.3",marginBottom:"2px"}}>{n.title}</div>
                    <div style={{fontSize:"9px",color:W.fgMuted,marginBottom:"3px"}}>{n.id.substring(0,12)}</div>
                    {n.tags?.length>0&&(
                      <div style={{display:"flex",flexWrap:"wrap",gap:"2px"}}>
                        {n.tags.slice(0,4).map(t=><TagPill key={t} tag={t} small/>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Main */}
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            {selNote?(
              vimMode?(
                <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
                  <div style={{background:W.bg2,borderBottom:`1px solid ${W.splitBg}`,padding:"5px 10px",display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
                    <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} placeholder="Titel…"
                      style={{flex:1,background:"transparent",border:"none",color:W.statusFg,fontSize:"15px",fontFamily:"inherit",fontWeight:"bold",outline:"none"}}
                    />
                    <button onClick={()=>{save();closeEdit();}} style={{background:W.comment,color:W.bg,border:"none",borderRadius:"4px",padding:"4px 12px",fontSize:"11px",fontFamily:"inherit",cursor:"pointer",fontWeight:"bold"}}>:wq</button>
                    <button onClick={closeEdit} style={{background:"none",color:W.fgMuted,border:`1px solid ${W.splitBg}`,borderRadius:"4px",padding:"4px 10px",fontSize:"11px",fontFamily:"inherit",cursor:"pointer"}}>:q</button>
                    <button onClick={del} style={{background:"none",color:W.orange,border:`1px solid rgba(229,120,109,0.3)`,borderRadius:"4px",padding:"4px 10px",fontSize:"11px",fontFamily:"inherit",cursor:"pointer"}}>:del</button>
                  </div>
                  <VimEditor
                    value={editContent} onChange={setEditContent}
                    onSave={save} onEscape={closeEdit}
                    noteTags={editTags} onTagsChange={setEditTags}
                    allTags={allTags}
                  />
                </div>
              ):(
                <div style={{flex:1,display:"flex",overflow:"hidden"}}>
                  <div style={{flex:1,overflow:"auto",padding:"24px 32px"}}>
                    <div style={{display:"flex",gap:"6px",marginBottom:"18px",paddingBottom:"10px",borderBottom:`1px solid ${W.splitBg}`,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{fontSize:"10px",color:W.fgMuted}}>{selNote.id}</span>
                      {(selNote.tags||[]).map(t=>(
                        <TagPill key={t} tag={t} onRemove={t=>{
                          setNotes(prev=>prev.map(n=>n.id===selId?{...n,tags:(n.tags||[]).filter(x=>x!==t)}:n));
                        }}/>
                      ))}
                      <div style={{flex:1}}/>
                      <button onClick={openEdit} style={{background:"none",color:W.blue,border:`1px solid rgba(138,198,242,0.3)`,borderRadius:"4px",padding:"4px 12px",fontSize:"11px",fontFamily:"inherit",cursor:"pointer"}}>i — bewerken</button>
                      <button onClick={del} style={{background:"none",color:W.orange,border:`1px solid rgba(229,120,109,0.2)`,borderRadius:"4px",padding:"4px 10px",fontSize:"11px",fontFamily:"inherit",cursor:"pointer"}}>:del</button>
                    </div>

                    <div className="mdv" dangerouslySetInnerHTML={{__html:renderMd(selNote.content,notes)}} onClick={handleLink}/>

                    {backlinks.length>0&&(
                      <div style={{marginTop:"40px",paddingTop:"14px",borderTop:`1px solid ${W.splitBg}`}}>
                        <div style={{fontSize:"10px",color:W.fgMuted,letterSpacing:"2px",marginBottom:"8px"}}>BACKLINKS</div>
                        {backlinks.map(n=>(
                          <div key={n.id} onClick={()=>setSelId(n.id)} style={{padding:"5px 10px",cursor:"pointer",background:"rgba(138,198,242,0.06)",border:`1px solid rgba(138,198,242,0.12)`,borderRadius:"4px",marginBottom:"5px",fontSize:"12px",color:W.keyword}}>
                            ← {n.title} <span style={{color:W.fgMuted,fontSize:"10px"}}>{n.id}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Meta panel */}
                  <div style={{width:"176px",flexShrink:0,background:W.bg2,borderLeft:`1px solid ${W.splitBg}`,padding:"14px 12px",fontSize:"11px",overflow:"auto"}}>
                    <div style={{color:W.fgMuted,letterSpacing:"1px",fontSize:"9px",marginBottom:"4px",textTransform:"uppercase"}}>ID</div>
                    <div style={{color:W.comment,wordBreak:"break-all",marginBottom:"14px",fontSize:"10px"}}>{selNote.id}</div>

                    <div style={{color:W.fgMuted,letterSpacing:"1px",fontSize:"9px",marginBottom:"6px",textTransform:"uppercase"}}>Tags</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"4px",marginBottom:"6px"}}>
                      {(selNote.tags||[]).map(t=>(
                        <TagPill key={t} tag={t} onRemove={t=>{
                          setNotes(prev=>prev.map(n=>n.id===selId?{...n,tags:(n.tags||[]).filter(x=>x!==t)}:n));
                        }}/>
                      ))}
                      {!(selNote.tags||[]).length&&<span style={{fontSize:"10px",color:W.splitBg}}>geen</span>}
                    </div>
                    <div style={{fontSize:"9px",color:W.splitBg,lineHeight:"1.8",marginBottom:"14px",padding:"6px 8px",background:"rgba(0,0,0,0.2)",borderRadius:"3px"}}>
                      <span style={{color:W.fgMuted}}>:tag</span> naam1 naam2<br/>
                      <span style={{color:W.fgMuted}}>:tag+</span> naam<br/>
                      <span style={{color:W.fgMuted}}>:tag-</span> naam<br/>
                      <span style={{color:W.fgMuted}}>:retag</span> (auto)<br/>
                      <span style={{color:W.fgMuted}}>Tab</span> autocomplete
                    </div>

                    {extractLinks(selNote.content).length>0&&(<>
                      <div style={{color:W.fgMuted,letterSpacing:"1px",fontSize:"9px",marginBottom:"6px",textTransform:"uppercase"}}>Links →</div>
                      {extractLinks(selNote.content).map(id=>{
                        const n=notes.find(x=>x.id===id);
                        return(
                          <div key={id} onClick={()=>n&&setSelId(n.id)} style={{fontSize:"10px",color:n?W.keyword:W.fgMuted,cursor:n?"pointer":"default",padding:"3px 0",borderBottom:`1px solid ${W.splitBg}`,marginBottom:"2px"}}>
                            → {n?n.title:id}
                          </div>
                        );
                      })}
                    </>)}

                    <div style={{marginTop:"14px",color:W.fgMuted,fontSize:"9px",letterSpacing:"1px",textTransform:"uppercase",marginBottom:"4px"}}>Gewijzigd</div>
                    <div style={{fontSize:"10px",color:W.fgDim}}>{new Date(selNote.modified).toLocaleString("nl-NL")}</div>
                  </div>
                </div>
              )
            ):(
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",color:W.fgMuted,fontSize:"13px"}}>Selecteer een zettel</div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @import url('https://cdn.jsdelivr.net/npm/hack-font@3/build/web/hack.css');

        *, *::before, *::after { box-sizing: border-box; }

        html, body, input, textarea, button, select, pre, code {
          font-family: 'Hack', 'Courier New', Courier, monospace !important;
        }

        .mdv h1{font-size:20px;color:${W.statusFg};margin:0 0 14px;border-bottom:1px solid ${W.splitBg};padding-bottom:6px;}
        .mdv h2{font-size:16px;color:${W.string};margin:18px 0 8px;}
        .mdv h3{font-size:13px;color:${W.fg};margin:14px 0 6px;}
        .mdv p{color:${W.fg};line-height:1.85;margin:0 0 10px;font-size:13px;}
        .mdv ul{padding-left:20px;margin:6px 0 10px;}
        .mdv li{color:${W.fg};line-height:1.8;font-size:13px;margin-bottom:3px;}
        .mdv strong{color:${W.statusFg};}
        .mdv em{color:${W.fgDim};font-style:italic;}
        .mdv code{background:rgba(255,255,255,0.07);padding:1px 5px;border-radius:3px;font-size:12px;color:${W.string};}
        .zlink{color:${W.keyword};cursor:pointer;text-decoration:underline;text-decoration-color:rgba(138,198,242,0.4);font-size:13px;}
        .zlink:hover{color:${W.statusFg};}
        .taghl{color:${W.comment};font-size:13px;}

        /* ── PDF.js official text layer overrides ── */
        .textLayer {
          position: absolute !important;
          inset: 0 !important;
          overflow: hidden !important;
          opacity: 1 !important;
          line-height: 1 !important;
          user-select: text !important;
          -webkit-user-select: text !important;
          cursor: text !important;
          pointer-events: auto !important;
        }
        .textLayer span,
        .textLayer br {
          color: transparent !important;
          position: absolute !important;
          white-space: pre !important;
          cursor: text !important;
          transform-origin: 0% 0% !important;
          user-select: text !important;
          -webkit-user-select: text !important;
          pointer-events: auto !important;
        }
        .textLayer ::selection {
          background: rgba(138,198,242,0.55) !important;
          color: transparent !important;
        }
        .textLayer ::-moz-selection {
          background: rgba(138,198,242,0.55) !important;
          color: transparent !important;
        }
        /* Hide PDF.js highlight/endOfContent markers */
        .textLayer .highlight,
        .textLayer .endOfContent {
          background: none !important;
          border: none !important;
          pointer-events: none !important;
        }

        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:${W.splitBg};border-radius:3px;}
        ::-webkit-scrollbar-thumb:hover{background:${W.statusBg};}
        textarea::placeholder,input::placeholder{color:${W.fgMuted};}
      `}</style>
    </div>
  );
}
