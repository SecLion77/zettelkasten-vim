// ── TagManager ────────────────────────────────────────────────────────────────
// Slim tag-beheer voor Zettelkasten
//
// Globals: SmartTagEditor, TagManagerPanel

"use strict";

// ── Levenshtein ───────────────────────────────────────────────────────────────
function _lev(a,b){
  const m=a.length,n=b.length;
  const dp=Array.from({length:m+1},(_,i)=>Array.from({length:n+1},(_,j)=>i===0?j:j===0?i:0));
  for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)
    dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
  return dp[m][n];
}
function _similarTags(tag,pool,maxDist=2){
  return pool.filter(t=>t!==tag)
    .map(t=>({t,d:_lev(tag.toLowerCase(),t.toLowerCase())}))
    .filter(x=>x.d>0&&x.d<=maxDist).sort((a,b)=>a.d-b.d).map(x=>x.t);
}
function _groupSimilar(tags){
  const used=new Set(),groups=[];
  for(const tag of tags){
    if(used.has(tag))continue;
    const sim=_similarTags(tag,tags,2).filter(t=>!used.has(t));
    if(sim.length){[tag,...sim].forEach(t=>used.add(t));groups.push([tag,...sim]);}
  }
  return groups;
}

// ── AI via dedicated suggest-tags endpoint ────────────────────────────────────
async function _aiTagSuggest(content, currentTags, allTags, llmModel) {
  if (!content?.trim() || !llmModel) return [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    let r;
    try {
      r = await fetch("/api/llm/suggest-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content:      content.slice(0, 1500),
          model:        llmModel,
          current_tags: currentTags,
          all_tags:     allTags.slice(0, 60),
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return (data.tags || [])
      .map(t => String(t).trim().toLowerCase().replace(/\s+/g, "_").replace(/^#/, ""))
      .filter(t => t.length > 0 && !currentTags.includes(t))
      .slice(0, 8);
  } catch (e) {
    if (e.name === "AbortError")
      throw new Error("Time-out (>25s) — probeer een sneller model of lokale Ollama");
    console.warn("[TagManager] AI suggest:", e);
    throw e;
  }
}

async function _aiMergeSuggest(allTags,llmModel){
  if(!llmModel||allTags.length<3)return[];
  try{
    const prompt=`Analyseer deze Zettelkasten tags en stel samenvoegingen voor.
Tags: ${allTags.slice(0,80).join(", ")}

Zoek: typo's, meervoud/enkelvoud, synoniemen, te specifieke varianten van hetzelfde concept.
Antwoord ALLEEN als JSON-array: [{"from":["tag1","tag2"],"to":"doel","reden":"..."}]
Maximaal 6 suggesties. Wees conservatief.`;
    const r=await fetch("/api/llm/chat",{method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({model:llmModel,messages:[{role:"user",content:prompt}]})});
    const data=await r.json();
    const text=(data.message?.content||data.response||"[]").replace(/```json|```/g,"").trim();
    const match=text.match(/\[[\s\S]*?\]/);if(!match)return[];
    return JSON.parse(match[0]);
  }catch(e){console.warn("[TagManager] AI merge:",e);return[];}
}

// ── SmartTagEditor ─────────────────────────────────────────────────────────────
const SmartTagEditor=({tags=[],onChange,allTags=[],content="",llmModel=""})=>{
  const {useState,useRef,useCallback,useMemo}=React;
  const [input,setInput]=useState("");
  const [open,setOpen]=useState(false);
  const [aiLoading,setAiLoading]=useState(false);
  const [aiSuggested,setAiSuggested]=useState([]);
  const [aiError,setAiError]=useState("");
  const [typoWarn,setTypoWarn]=useState(null);
  const inputRef=useRef(null);

  const uniqueAll=useMemo(()=>[...new Set(allTags)],[allTags]);
  const tagFreq=useMemo(()=>{const f={};allTags.forEach(t=>{f[t]=(f[t]||0)+1;});return f;},[allTags]);

  const suggestions=useMemo(()=>{
    if(!input)return[];
    const q=input.toLowerCase();
    return uniqueAll.filter(t=>t.toLowerCase().includes(q)&&!tags.includes(t))
      .sort((a,b)=>{
        const ap=a.toLowerCase().startsWith(q)?0:1,bp=b.toLowerCase().startsWith(q)?0:1;
        return ap-bp||(tagFreq[b]||0)-(tagFreq[a]||0);
      }).slice(0,9);
  },[input,uniqueAll,tags,tagFreq]);

  const _slug=t=>t.trim().toLowerCase().replace(/\s+/g,"_").replace(/^#/,"");

  const add=useCallback((raw)=>{
    const t=_slug(raw);
    if(!t||tags.includes(t)){setInput("");setOpen(false);return;}
    const sim=_similarTags(t,uniqueAll.filter(x=>!tags.includes(x)&&x!==t),2);
    if(sim.length)setTypoWarn({added:t,similar:sim});
    onChange([...tags,t]);
    setInput("");setOpen(false);
    setAiSuggested(p=>p.filter(s=>s!==t));
  },[tags,uniqueAll,onChange]);

  const remove=useCallback(t=>onChange(tags.filter(x=>x!==t)),[tags,onChange]);
  const replaceTag=useCallback((o,n)=>{onChange(tags.map(t=>t===o?n:t));setTypoWarn(null);},[tags,onChange]);

  const onKey=useCallback(e=>{
    if(["Enter","Tab",","," "].includes(e.key)){e.preventDefault();if(input.trim())add(input);}
    else if(e.key==="Backspace"&&!input&&tags.length)remove(tags[tags.length-1]);
    else if(e.key==="Escape"){setOpen(false);setTypoWarn(null);}
  },[input,tags,add,remove]);

  const requestAi=useCallback(async()=>{
    if(!content||!llmModel)return;
    setAiLoading(true);setAiSuggested([]);setAiError("");
    try{
      const res=await _aiTagSuggest(content,tags,uniqueAll,llmModel);
      if(res.length===0) setAiError("Geen suggesties — probeer een ander model of voeg meer tekst toe.");
      else setAiSuggested(res);
    }catch(e){
      setAiError("Fout: "+(e.message||String(e)));
    }finally{
      setAiLoading(false);
    }
  },[content,tags,uniqueAll,llmModel]);

  const W2=typeof W!=="undefined"?W:{bg:"#242424",bg3:"#2a2a2a",fg:"#e3e0d7",
    comment:"#9fca56",blue:"#8ac6f2",fgMuted:"#857b6f",yellow:"#eae788",splitBg:"#3a3a3a"};

  // Bepaal of AI beschikbaar is
  const aiAvailable = !!(content && llmModel);
  const hasContent  = !!(content && content.trim().length > 20);

  return React.createElement("div",{style:{position:"relative"}},

    // ── Rij 1: tag-input + AI knop naast elkaar ─────────────────────────────
    React.createElement("div",{style:{display:"flex",gap:"6px",alignItems:"flex-start"}},

      // Tag input veld
      React.createElement("div",{
        style:{flex:1,display:"flex",flexWrap:"wrap",gap:"4px",alignItems:"center",
          padding:"5px 8px",background:W2.bg,
          border:`1px solid ${W2.splitBg}`,borderRadius:"5px",
          cursor:"text",minHeight:"34px"},
        onClick:()=>inputRef.current?.focus()
      },
        ...tags.map(t=>React.createElement("span",{key:t,style:{
          display:"inline-flex",alignItems:"center",gap:"3px",
          background:"rgba(184,224,106,0.14)",border:"1px solid rgba(184,224,106,0.42)",
          borderRadius:"11px",padding:"3px 10px",fontSize:"12px",
          color:"#b8e06a",fontWeight:"500",flexShrink:0,
        }},
          "#"+t,
          React.createElement("span",{
            onMouseDown:e=>{e.preventDefault();e.stopPropagation();remove(t);},
            style:{cursor:"pointer",color:"rgba(184,224,106,0.55)",fontSize:"11px",
                   lineHeight:1,marginLeft:"2px",fontWeight:"bold"}
          },"✕")
        )),
        React.createElement("input",{
          ref:inputRef,value:input,
          onChange:e=>{setInput(e.target.value);setOpen(true);setTypoWarn(null);},
          onKeyDown:onKey,onFocus:()=>setOpen(true),
          onBlur:()=>setTimeout(()=>setOpen(false),180),
          placeholder:tags.length?"tag toevoegen…":"tag toevoegen (of klik ✦ AI)…",
          style:{border:"none",background:"transparent",outline:"none",
            fontSize:"13px",color:W2.fg,minWidth:"90px",flex:1}
        })
      ),

      // AI-knop — altijd zichtbaar, disabled als geen model/content
      React.createElement("button",{
        onMouseDown:e=>{e.preventDefault();if(aiAvailable&&!aiLoading)requestAi();},
        disabled:aiLoading||!aiAvailable,
        title: !llmModel
          ? "Selecteer een AI-model in de statusbalk om tags te laten voorstellen"
          : !hasContent
          ? "Voeg inhoud toe aan de notitie — AI analyseert de tekst"
          : "AI analyseert de notitie en stelt relevante tags voor",
        style:{
          flexShrink:0,
          background: aiLoading
            ? "rgba(138,198,242,0.08)"
            : aiAvailable
            ? "rgba(138,198,242,0.13)"
            : "rgba(255,255,255,0.04)",
          border:`1px solid ${
            aiLoading    ? W2.blue
            : aiAvailable ? "rgba(138,198,242,0.5)"
            : "rgba(255,255,255,0.12)"}`,
          borderRadius:"7px",
          padding:"5px 12px",
          fontSize:"12px",
          fontWeight:"600",
          color: aiLoading    ? W2.blue
               : aiAvailable  ? W2.blue
               : W2.fgMuted,
          cursor: aiLoading||!aiAvailable ? "default" : "pointer",
          whiteSpace:"nowrap",
          display:"flex",alignItems:"center",gap:"5px",
          transition:"background 0.15s,border 0.15s,color 0.15s",
          alignSelf:"stretch",
        }
      },
        React.createElement("span",{style:{fontSize:"14px",lineHeight:1}},
          aiLoading ? "⏳" : "✦"
        ),
        aiLoading ? "AI bezig…" : "AI-tags"
      )
    ),

    // Autocomplete dropdown
    open&&(suggestions.length>0||input.trim())&&React.createElement("div",{style:{
      position:"absolute",top:"calc(100% + 2px)",left:0,
      right:"0",
      background:W2.bg3,border:`1px solid ${W2.splitBg}`,
      borderRadius:"5px",zIndex:400,boxShadow:"0 6px 20px rgba(0,0,0,0.5)",overflow:"hidden",
    }},
      input.trim()&&React.createElement("div",{
        onMouseDown:e=>{e.preventDefault();add(input);},
        style:{padding:"7px 12px",fontSize:"13px",color:W2.blue,cursor:"pointer",
          borderBottom:suggestions.length?`1px solid ${W2.splitBg}`:"none",
          display:"flex",alignItems:"center",gap:"6px"}
      },React.createElement("span",{style:{fontSize:"11px",opacity:.7}},"＋"),`"${_slug(input)}" aanmaken`),
      ...suggestions.map(t=>React.createElement("div",{key:t,
        onMouseDown:e=>{e.preventDefault();add(t);},
        style:{padding:"6px 12px",fontSize:"13px",color:W2.fg,cursor:"pointer",
          display:"flex",justifyContent:"space-between",alignItems:"center",
          borderTop:"1px solid rgba(255,255,255,0.03)"}
      },
        React.createElement("span",null,"#"+t),
        React.createElement("span",{style:{fontSize:"11px",color:W2.fgMuted}},
          (tagFreq[t]||0)>1?`${tagFreq[t]}×`:"")
      ))
    ),

    // ── AI-suggesties ────────────────────────────────────────────────────────
    aiSuggested.length>0&&React.createElement("div",{style:{
      marginTop:"7px",padding:"10px 12px",
      background:"rgba(138,198,242,0.07)",
      border:"1px solid rgba(138,198,242,0.28)",
      borderRadius:"7px",
    }},
      React.createElement("div",{style:{
        fontSize:"12px",color:W2.blue,fontWeight:"600",
        marginBottom:"8px",
        display:"flex",justifyContent:"space-between",alignItems:"center",
      }},
        React.createElement("span",null,
          React.createElement("span",{style:{marginRight:"6px"}},"✦"),
          "AI-suggesties — klik om toe te voegen"
        ),
        React.createElement("button",{
          onClick:()=>setAiSuggested([]),
          style:{background:"none",border:"none",color:W2.fgMuted,
                 cursor:"pointer",fontSize:"16px",lineHeight:1,padding:"0 2px"}
        },"×")
      ),
      React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:"6px"}},
        ...aiSuggested.map(t=>{
          const alreadyAdded=tags.includes(t);
          return React.createElement("button",{key:t,
            onClick:()=>{ if(!alreadyAdded) add(t); },
            disabled:alreadyAdded,
            style:{
              background: alreadyAdded
                ? "rgba(159,202,86,0.1)"
                : "rgba(138,198,242,0.12)",
              border: `1px solid ${alreadyAdded
                ? "rgba(159,202,86,0.35)"
                : "rgba(138,198,242,0.35)"}`,
              borderRadius:"20px",
              padding:"4px 13px",
              fontSize:"12px",fontWeight:"500",
              color: alreadyAdded ? "#b8e06a" : W2.blue,
              cursor: alreadyAdded ? "default" : "pointer",
              display:"flex",alignItems:"center",gap:"4px",
            }
          },
            alreadyAdded
              ? React.createElement("span",{style:{fontSize:"10px"}},"✓")
              : React.createElement("span",{style:{fontSize:"11px",opacity:0.7}},"＋"),
            "#"+t
          );
        })
      ),
      // Alles-toevoegen knop als er meerdere nieuwe zijn
      aiSuggested.filter(t=>!tags.includes(t)).length > 1 &&
        React.createElement("button",{
          onClick:()=>{ aiSuggested.filter(t=>!tags.includes(t)).forEach(t=>add(t)); },
          style:{
            marginTop:"8px",
            background:"rgba(138,198,242,0.18)",
            border:"1px solid rgba(138,198,242,0.45)",
            borderRadius:"6px",padding:"4px 14px",
            fontSize:"12px",fontWeight:"600",color:W2.blue,cursor:"pointer",
            display:"block",width:"100%",
          }
        },"＋ voeg alle nieuwe toe")
    ),

    // ── AI-foutmelding ───────────────────────────────────────────────────────
    aiError&&!aiLoading&&React.createElement("div",{style:{
      marginTop:"7px",padding:"8px 12px",
      background:"rgba(229,120,109,0.08)",
      border:"1px solid rgba(229,120,109,0.28)",
      borderRadius:"6px",fontSize:"12px",
      display:"flex",alignItems:"flex-start",gap:"8px",
    }},
      React.createElement("span",{style:{color:"#e5786d",flexShrink:0}},"⚠"),
      React.createElement("span",{style:{color:"#e5786d",flex:1,lineHeight:"1.5"}},aiError),
      React.createElement("button",{
        onClick:()=>setAiError(""),
        style:{background:"none",border:"none",color:"rgba(229,120,109,0.5)",
               cursor:"pointer",fontSize:"14px",lineHeight:1,flexShrink:0}
      },"×")
    ),

    // ── Typo-waarschuwing ────────────────────────────────────────────────────
    typoWarn&&React.createElement("div",{style:{
      marginTop:"6px",padding:"8px 11px",
      background:"rgba(234,231,136,0.06)",border:"1px solid rgba(234,231,136,0.22)",
      borderRadius:"6px",fontSize:"12px",display:"flex",flexWrap:"wrap",alignItems:"center",gap:"6px",
    }},
      React.createElement("span",{style:{color:W2.yellow}},`⚠ Bedoel je voor "#${typoWarn.added}":`),
      ...typoWarn.similar.map(s=>React.createElement("button",{key:s,onClick:()=>replaceTag(typoWarn.added,s),style:{
        background:"rgba(234,231,136,0.12)",border:"1px solid rgba(234,231,136,0.25)",
        borderRadius:"8px",padding:"3px 10px",fontSize:"12px",color:W2.yellow,cursor:"pointer",
      }},"#"+s+" ?")),
      React.createElement("button",{onClick:()=>setTypoWarn(null),style:{
        background:"none",border:"none",color:W2.fgMuted,cursor:"pointer",fontSize:"11px",marginLeft:"4px"
      }},"nee, bewaar zo")
    )
  );
};

// ── TagManagerPanel ───────────────────────────────────────────────────────────
const TagManagerPanel=({allTags=[],notes=[],onMergeTags,onRenameTag,onDeleteTag,llmModel=""})=>{
  const {useState,useMemo,useCallback}=React;
  const [tab,setTab]=useState("overzicht");
  const [search,setSearch]=useState("");
  const [renaming,setRenaming]=useState(null);
  const [renameVal,setRenameVal]=useState("");
  const [mergeFrom,setMergeFrom]=useState([]);
  const [mergeTo,setMergeTo]=useState("");
  const [confirmDel,setConfirmDel]=useState(null);
  const [aiMerge,setAiMerge]=useState([]);
  const [aiLoading,setAiLoading]=useState(false);
  const [mergeSearch,setMergeSearch]=useState("");

  const W2=typeof W!=="undefined"?W:{bg:"#242424",bg2:"#1c1c1c",bg3:"#2a2a2a",
    fg:"#e3e0d7",fgMuted:"#857b6f",comment:"#9fca56",blue:"#8ac6f2",
    orange:"#e5786d",yellow:"#eae788",statusFg:"#ffffd7",splitBg:"#3a3a3a"};

  const uniqueTags=useMemo(()=>[...new Set(allTags)],[allTags]);
  const tagStats=useMemo(()=>{
    const s={};
    notes.forEach(n=>(n.tags||[]).forEach(t=>{if(!s[t])s[t]={count:0};s[t].count++;}));
    return s;
  },[notes]);
  const freq=t=>tagStats[t]?.count||0;

  const filtered=useMemo(()=>{
    const q=search.toLowerCase();
    return uniqueTags.filter(t=>!q||t.toLowerCase().includes(q)).sort((a,b)=>freq(b)-freq(a));
  },[uniqueTags,search,tagStats]);

  const similarGroups=useMemo(()=>_groupSimilar(uniqueTags),[uniqueTags]);

  const toggleMergeFrom=t=>setMergeFrom(p=>p.includes(t)?p.filter(x=>x!==t):[...p,t]);
  const _slug=t=>t.trim().toLowerCase().replace(/\s+/g,"_").replace(/^#/,"");

  const doMerge=useCallback(()=>{
    if(!mergeFrom.length||!mergeTo.trim())return;
    onMergeTags(mergeFrom,_slug(mergeTo));
    setMergeFrom([]);setMergeTo("");
  },[mergeFrom,mergeTo,onMergeTags]);

  const requestAiMerge=useCallback(async()=>{
    if(!llmModel)return;
    setAiLoading(true);setAiMerge([]);
    const res=await _aiMergeSuggest(uniqueTags,llmModel);
    setAiMerge(res);setAiLoading(false);
  },[uniqueTags,llmModel]);

  const tabBtn=(id,label)=>React.createElement("button",{
    key:id,onClick:()=>setTab(id),
    style:{
      background:tab===id?W2.bg3:"none",
      border:`1px solid ${tab===id?W2.blue:W2.splitBg}`,
      color:tab===id?W2.blue:W2.fgMuted,
      borderRadius:"4px",padding:"4px 12px",fontSize:"12px",cursor:"pointer",
      fontWeight:tab===id?"bold":"normal",
    }
  },label);

  // ── Statistieken data ──────────────────────────────────────────────────────
  const stats=useMemo(()=>{
    const sorted=[...uniqueTags].sort((a,b)=>freq(b)-freq(a));
    const total=notes.length||1;
    const withTags=notes.filter(n=>(n.tags||[]).length>0).length;
    const withoutTags=total-withTags;
    const avgTagsPerNote=notes.length
      ? (notes.reduce((s,n)=>s+(n.tags||[]).length,0)/notes.length).toFixed(1)
      : 0;
    // Verdeling: hoeveel notities hebben N tags
    const tagCountDist={};
    notes.forEach(n=>{
      const c=(n.tags||[]).length;
      tagCountDist[c]=(tagCountDist[c]||0)+1;
    });
    // Top co-occurrences: welke tags komen samen voor
    const coMap={};
    notes.forEach(n=>{
      const t=n.tags||[];
      for(let i=0;i<t.length;i++) for(let j=i+1;j<t.length;j++){
        const key=[t[i],t[j]].sort().join("‖");
        coMap[key]=(coMap[key]||0)+1;
      }
    });
    const topCo=Object.entries(coMap).sort((a,b)=>b[1]-a[1]).slice(0,8)
      .map(([k,c])=>({pair:k.split("‖"),count:c}));
    return {sorted,total,withTags,withoutTags,avgTagsPerNote,tagCountDist,topCo};
  },[uniqueTags,notes,tagStats]);

  return React.createElement("div",{style:{display:"flex",flexDirection:"column",flex:1,minHeight:0,
    background:W2.bg,color:W2.fg,overflow:"hidden"}},

    // Header
    React.createElement("div",{style:{
      padding:"10px 16px",background:W2.bg2,borderBottom:`1px solid ${W2.splitBg}`,
      display:"flex",alignItems:"center",gap:"8px",flexShrink:0,flexWrap:"wrap",
    }},
      React.createElement("span",{style:{fontWeight:"bold",color:W2.statusFg,fontSize:"15px"}},"🏷 Tag-beheer"),
      React.createElement("span",{style:{fontSize:"12px",color:W2.fgMuted}},
        `${uniqueTags.length} tags · ${notes.length} notities`),
      React.createElement("div",{style:{flex:1}}),
      tabBtn("overzicht","📋 Overzicht"),
      tabBtn("samenvoegen","⇢ Samenvoegen"),
      tabBtn("statistieken","📊 Statistieken"),
      tabBtn("opruimen","🗑 Opruimen"),
    ),

    // ── OVERZICHT ────────────────────────────────────────────────────────────
    tab==="overzicht"&&React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}},
      React.createElement("div",{style:{padding:"8px 16px",flexShrink:0}},
        React.createElement("input",{value:search,onChange:e=>setSearch(e.target.value),
          placeholder:"Zoek tag…",
          style:{width:"100%",background:W2.bg3,border:`1px solid ${W2.splitBg}`,
            borderRadius:"4px",color:W2.fg,padding:"6px 10px",fontSize:"13px",
            outline:"none",boxSizing:"border-box"}})
      ),
      React.createElement("div",{style:{flex:1,overflowY:"auto",position:"relative", minHeight:0, WebkitOverflowScrolling:"touch",}},
        filtered.length===0&&React.createElement("div",{style:{color:W2.fgMuted,padding:"24px",textAlign:"center",fontSize:"13px"}},"Geen tags"),
        filtered.map(tag=>{
          const isRen=renaming===tag;
          return React.createElement("div",{key:tag,style:{
            display:"flex",alignItems:"center",gap:"8px",padding:"7px 16px",
            borderBottom:"1px solid rgba(255,255,255,0.04)",
            background:mergeFrom.includes(tag)?"rgba(138,198,242,0.07)":"transparent",
          }},
            React.createElement("input",{type:"checkbox",checked:mergeFrom.includes(tag),
              onChange:()=>toggleMergeFrom(tag),title:"Selecteer voor samenvoegen",
              style:{accentColor:W2.blue,cursor:"pointer",flexShrink:0}}),
            React.createElement("span",{style:{flex:1,color:W2.comment,fontSize:"13px",
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
              isRen?React.createElement("input",{autoFocus:true,value:renameVal,
                onChange:e=>setRenameVal(e.target.value),
                onKeyDown:e=>{
                  if(e.key==="Enter"&&renameVal.trim()){onRenameTag(tag,renameVal.trim());setRenaming(null);}
                  if(e.key==="Escape")setRenaming(null);
                },
                style:{background:W2.bg2,border:`1px solid ${W2.blue}`,borderRadius:"3px",
                  color:W2.fg,padding:"2px 8px",fontSize:"13px",outline:"none",width:"160px"}
              }):"#"+tag
            ),
            React.createElement("span",{style:{fontSize:"11px",color:W2.fgMuted,
              background:W2.bg3,borderRadius:"8px",padding:"1px 8px",
              flexShrink:0,minWidth:"28px",textAlign:"center"}},freq(tag)+"×"),
            React.createElement("button",{onClick:()=>{setRenaming(tag);setRenameVal(tag);},title:"Hernoemen",
              style:{background:"none",border:"none",color:W2.fgMuted,cursor:"pointer",fontSize:"14px",padding:"2px 5px"}},"✎"),
            React.createElement("button",{onClick:()=>{setMergeFrom([tag]);setMergeTo("");setTab("samenvoegen");},title:"Samenvoegen",
              style:{background:"none",border:"none",color:W2.blue,cursor:"pointer",fontSize:"14px",padding:"2px 5px"}},"⇢"),
            React.createElement("button",{onClick:()=>setConfirmDel(tag),title:"Verwijderen",
              style:{background:"none",border:"none",color:W2.orange,cursor:"pointer",fontSize:"14px",padding:"2px 5px"}},"✕")
          );
        }),

        // Snel samenvoegen sticky bar
        mergeFrom.length>0&&React.createElement("div",{style:{
          position:"sticky",bottom:0,background:W2.bg2,borderTop:`1px solid ${W2.splitBg}`,
          padding:"10px 16px",display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap",
        }},
          React.createElement("span",{style:{fontSize:"12px",color:W2.blue,flexShrink:0}},
            `${mergeFrom.length} geselecteerd →`),
          React.createElement("input",{value:mergeTo,onChange:e=>setMergeTo(e.target.value),
            placeholder:"doeltag…",list:"mglist",
            style:{flex:1,background:W2.bg,border:`1px solid ${W2.splitBg}`,borderRadius:"4px",
              color:W2.fg,padding:"5px 10px",fontSize:"13px",outline:"none",minWidth:"100px"}}),
          React.createElement("datalist",{id:"mglist"},...uniqueTags.map(t=>React.createElement("option",{key:t,value:t}))),
          React.createElement("button",{disabled:!mergeTo.trim(),onClick:doMerge,style:{
            background:W2.blue,border:"none",borderRadius:"4px",color:W2.bg,padding:"5px 14px",
            fontSize:"13px",cursor:mergeTo.trim()?"pointer":"default",opacity:mergeTo.trim()?1:0.4,whiteSpace:"nowrap"
          }},"Samenvoegen ⇢"),
          React.createElement("button",{onClick:()=>{setMergeFrom([]);setMergeTo("");},style:{
            background:"none",border:`1px solid ${W2.splitBg}`,borderRadius:"4px",
            color:W2.fgMuted,padding:"5px 10px",fontSize:"13px",cursor:"pointer"
          }},"✕")
        ),

        // Verwijder modal
        confirmDel&&React.createElement("div",{style:{
          position:"fixed",top:"50%",left:"50%",transform:"translate(-50%,-50%)",
          background:W2.bg3,border:`1px solid ${W2.orange}`,borderRadius:"8px",
          padding:"16px 20px",zIndex:999,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",
          display:"flex",flexDirection:"column",gap:"10px",minWidth:"260px",
        }},
          React.createElement("div",{style:{color:W2.orange,fontWeight:"bold"}},"\"#"+confirmDel+"\" verwijderen?"),
          React.createElement("div",{style:{fontSize:"12px",color:W2.fgMuted}},
            `Wordt verwijderd uit ${freq(confirmDel)} ${freq(confirmDel)===1?"notitie":"notities"}.`),
          React.createElement("div",{style:{display:"flex",gap:"8px"}},
            React.createElement("button",{onClick:()=>{onDeleteTag(confirmDel);setConfirmDel(null);},
              style:{flex:1,background:W2.orange,border:"none",borderRadius:"4px",
                color:W2.bg,padding:"7px",cursor:"pointer",fontWeight:"bold"}},"Verwijderen"),
            React.createElement("button",{onClick:()=>setConfirmDel(null),
              style:{flex:1,background:"none",border:`1px solid ${W2.splitBg}`,borderRadius:"4px",
                color:W2.fgMuted,padding:"7px",cursor:"pointer"}},"Annuleren")
          )
        )
      )
    ),

    // ── SAMENVOEGEN ──────────────────────────────────────────────────────────
    tab==="samenvoegen"&&React.createElement("div",{style:{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}},
      React.createElement("div",{style:{padding:"8px 16px",borderBottom:`1px solid ${W2.splitBg}`,
        display:"flex",gap:"8px",alignItems:"center",flexShrink:0,flexWrap:"wrap"}},
        React.createElement("button",{onClick:requestAiMerge,disabled:aiLoading||!llmModel,style:{
          background:"rgba(138,198,242,0.1)",border:"1px solid rgba(138,198,242,0.3)",
          borderRadius:"5px",padding:"6px 14px",color:llmModel?W2.blue:W2.fgMuted,
          fontSize:"13px",cursor:"pointer",opacity:aiLoading?.5:1,whiteSpace:"nowrap",
        }},aiLoading?"⏳ Analyseren…":"✦ AI: stel samenvoegingen voor"),
        !llmModel&&React.createElement("span",{style:{fontSize:"12px",color:W2.fgMuted}},"(stel model in via Notebook)"),
        React.createElement("div",{style:{flex:1}}),
        React.createElement("input",{value:mergeSearch,onChange:e=>setMergeSearch(e.target.value),
          placeholder:"Filter…",style:{background:W2.bg3,border:`1px solid ${W2.splitBg}`,
          borderRadius:"4px",color:W2.fg,padding:"5px 10px",fontSize:"12px",outline:"none",width:"110px"}})
      ),
      React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"12px 16px", minHeight:0, WebkitOverflowScrolling:"touch",}},

        // Handmatig samenvoegen
        React.createElement("div",{style:{
          padding:"12px",background:"rgba(138,198,242,0.05)",
          border:"1px solid rgba(138,198,242,0.2)",borderRadius:"6px",marginBottom:"16px",
        }},
          React.createElement("div",{style:{fontSize:"12px",color:W2.blue,fontWeight:"bold",marginBottom:"8px"}},"Handmatig samenvoegen"),
          React.createElement("div",{style:{display:"flex",gap:"8px",alignItems:"flex-end",flexWrap:"wrap"}},
            React.createElement("div",{style:{flex:1,minWidth:"130px"}},
              React.createElement("div",{style:{fontSize:"11px",color:W2.fgMuted,marginBottom:"3px"}},"Van (komma-gescheiden):"),
              React.createElement("input",{value:mergeFrom.join(", "),
                onChange:e=>setMergeFrom(e.target.value.split(",").map(t=>t.trim()).filter(Boolean)),
                placeholder:"tag1, tag2…",
                style:{width:"100%",background:W2.bg,border:`1px solid ${W2.splitBg}`,borderRadius:"4px",
                  color:W2.fg,padding:"5px 10px",fontSize:"13px",outline:"none",boxSizing:"border-box"}})
            ),
            React.createElement("span",{style:{color:W2.fgMuted,fontSize:"18px",paddingBottom:"4px"}},"→"),
            React.createElement("div",{style:{flex:1,minWidth:"130px"}},
              React.createElement("div",{style:{fontSize:"11px",color:W2.fgMuted,marginBottom:"3px"}},"Naar:"),
              React.createElement("input",{value:mergeTo,onChange:e=>setMergeTo(e.target.value),
                placeholder:"doeltag",list:"mg2list",
                style:{width:"100%",background:W2.bg,border:`1px solid ${W2.splitBg}`,borderRadius:"4px",
                  color:W2.fg,padding:"5px 10px",fontSize:"13px",outline:"none",boxSizing:"border-box"}}),
              React.createElement("datalist",{id:"mg2list"},...uniqueTags.map(t=>React.createElement("option",{key:t,value:t})))
            ),
            React.createElement("button",{disabled:!mergeFrom.length||!mergeTo.trim(),onClick:doMerge,style:{
              background:W2.blue,border:"none",borderRadius:"4px",color:W2.bg,
              padding:"7px 16px",fontSize:"13px",whiteSpace:"nowrap",
              cursor:(mergeFrom.length&&mergeTo.trim())?"pointer":"default",
              opacity:(mergeFrom.length&&mergeTo.trim())?1:0.4,
            }},"Samenvoegen ⇢")
          )
        ),

        // AI-suggesties
        aiMerge.length>0&&React.createElement("div",{style:{marginBottom:"16px"}},
          React.createElement("div",{style:{fontSize:"12px",color:W2.fgMuted,fontWeight:"bold",marginBottom:"8px"}},"✦ AI-suggesties:"),
          ...aiMerge.map((m,i)=>React.createElement("div",{key:i,style:{
            padding:"10px 12px",background:W2.bg2,border:`1px solid ${W2.splitBg}`,
            borderRadius:"6px",marginBottom:"6px",
          }},
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"6px",marginBottom:"4px",flexWrap:"wrap"}},
              React.createElement("span",{style:{color:W2.fgMuted,fontSize:"12px"}},(m.from||[]).map(t=>"#"+t).join(" + ")+" →"),
              React.createElement("span",{style:{color:W2.comment,fontWeight:"bold"}},"#"+(m.to||"?"))
            ),
            m.reden&&React.createElement("div",{style:{fontSize:"11px",color:W2.fgMuted,marginBottom:"8px"}},m.reden),
            React.createElement("div",{style:{display:"flex",gap:"6px"}},
              React.createElement("button",{onClick:()=>{onMergeTags(m.from,m.to);setAiMerge(p=>p.filter((_,j)=>j!==i));},style:{
                background:"rgba(159,202,86,0.12)",border:"1px solid rgba(159,202,86,0.28)",
                borderRadius:"4px",padding:"3px 14px",color:W2.comment,fontSize:"12px",cursor:"pointer",
              }},"✓ Toepassen"),
              React.createElement("button",{onClick:()=>setAiMerge(p=>p.filter((_,j)=>j!==i)),style:{
                background:"none",border:`1px solid ${W2.splitBg}`,borderRadius:"4px",
                color:W2.fgMuted,padding:"3px 10px",fontSize:"12px",cursor:"pointer"
              }},"Overslaan")
            )
          ))
        ),

        // Auto-gedetecteerde spellinggroepen — BUGFIX: tweede arg was array ipv string
        React.createElement("div",null,
          React.createElement("div",{style:{fontSize:"12px",color:W2.fgMuted,fontWeight:"bold",marginBottom:"8px"}},
            `🔍 Automatisch gedetecteerd (${similarGroups.length} groepen):`),
          similarGroups.length===0
            ?React.createElement("div",{style:{color:W2.fgMuted,fontSize:"12px",padding:"8px 0"}},"Geen vergelijkbare tags ✓")
            :similarGroups
              .filter(g=>!mergeSearch||g.some(t=>t.includes(mergeSearch.toLowerCase())))
              .map((group,i)=>{
                // Beste doeltag = degene met hoogste frequentie
                const bestTarget=[...group].sort((a,b)=>freq(b)-freq(a))[0];
                const others=group.filter(t=>t!==bestTarget);
                return React.createElement("div",{key:i,style:{
                  padding:"9px 12px",background:W2.bg2,border:`1px solid ${W2.splitBg}`,
                  borderRadius:"5px",marginBottom:"5px",
                }},
                  // Tags als pills
                  React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap",marginBottom:"7px"}},
                    ...group.map(t=>React.createElement("span",{key:t,style:{
                      background: t===bestTarget?"rgba(159,202,86,0.15)":"rgba(234,231,136,0.1)",
                      border:`1px solid ${t===bestTarget?"rgba(159,202,86,0.35)":"rgba(234,231,136,0.22)"}`,
                      borderRadius:"10px",padding:"2px 9px",fontSize:"12px",
                      color:t===bestTarget?W2.comment:W2.yellow,
                      fontWeight:t===bestTarget?"bold":"normal",
                    }},
                      "#"+t,
                      React.createElement("span",{style:{opacity:0.6,marginLeft:"3px",fontSize:"11px"}},"("+freq(t)+"×)"),
                      t===bestTarget&&React.createElement("span",{style:{marginLeft:"4px",fontSize:"10px",
                        color:"rgba(159,202,86,0.7)"}},"← doel")
                    ))
                  ),
                  // Actieknoppen
                  React.createElement("div",{style:{display:"flex",gap:"6px",flexWrap:"wrap"}},
                    React.createElement("button",{
                      // BUGFIX: was onMergeTags(group.slice(1), [group[0]]) — array ipv string
                      onClick:()=>onMergeTags(others, bestTarget),
                      style:{
                        background:"rgba(159,202,86,0.12)",border:"1px solid rgba(159,202,86,0.28)",
                        borderRadius:"4px",padding:"4px 13px",color:W2.comment,
                        fontSize:"12px",cursor:"pointer",whiteSpace:"nowrap",
                      }
                    },`✓ Samenvoegen → "#${bestTarget}"`),
                    React.createElement("button",{
                      onClick:()=>{
                        setMergeFrom(others);
                        setMergeTo(bestTarget);
                      },
                      style:{
                        background:"none",border:`1px solid ${W2.splitBg}`,
                        borderRadius:"4px",padding:"4px 10px",color:W2.fgMuted,
                        fontSize:"12px",cursor:"pointer",whiteSpace:"nowrap",
                      }
                    },"✎ Aanpassen")
                  )
                );
              })
        )
      )
    ),

    // ── STATISTIEKEN ─────────────────────────────────────────────────────────
    tab==="statistieken"&&React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"14px 16px",
      display:"flex",flexDirection:"column",gap:"20px", minHeight:0, WebkitOverflowScrolling:"touch",}},

      // Samenvattingskaarten
      React.createElement("div",{style:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"8px"}},
        ...[
          {label:"Unieke tags",   val:uniqueTags.length,      color:W2.blue},
          {label:"Notities met tag", val:stats.withTags,      color:W2.comment},
          {label:"Zonder tag",   val:stats.withoutTags,       color:stats.withoutTags>0?W2.orange:W2.fgMuted},
          {label:"Gem. tags/notitie", val:stats.avgTagsPerNote, color:W2.blue},
          {label:"Meest gebruikt", val:stats.sorted[0]?"#"+stats.sorted[0]:"—", color:W2.yellow},
          {label:"Alleen 1×",    val:uniqueTags.filter(t=>freq(t)===1).length, color:W2.fgMuted},
        ].map(({label,val,color})=>React.createElement("div",{key:label,style:{
          background:W2.bg2,border:`1px solid ${W2.splitBg}`,borderRadius:"6px",
          padding:"10px 12px",
        }},
          React.createElement("div",{style:{fontSize:"10px",color:W2.fgMuted,letterSpacing:"0.8px",marginBottom:"4px",textTransform:"uppercase"}}),
          React.createElement("div",{style:{fontSize:"18px",fontWeight:"bold",color,marginBottom:"2px"}},""+val),
          React.createElement("div",{style:{fontSize:"11px",color:W2.fgMuted}}),
          React.createElement("div",{style:{fontSize:"11px",color:W2.fgMuted,marginTop:"2px"}},""+label)
        ))
      ),

      // Top-20 tags horizontale staafgrafiek
      React.createElement("div",null,
        React.createElement("div",{style:{fontSize:"13px",color:W2.comment,fontWeight:"bold",
          marginBottom:"10px",display:"flex",alignItems:"center",gap:"8px"}},
          "⭐ Tag-frequentie (top 20)"
        ),
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"4px"}},
          (()=>{
            const top=stats.sorted.slice(0,20);
            const max=top.length?freq(top[0]):1;
            const pct=stats.total;
            return top.map(t=>React.createElement("div",{key:t,style:{display:"flex",alignItems:"center",gap:"8px"}},
              React.createElement("span",{style:{fontSize:"12px",color:W2.comment,
                width:"140px",overflow:"hidden",textOverflow:"ellipsis",
                whiteSpace:"nowrap",flexShrink:0,textAlign:"right"}},"#"+t),
              React.createElement("div",{style:{flex:1,background:W2.bg3,borderRadius:"3px",height:"14px",overflow:"hidden",position:"relative"}},
                React.createElement("div",{style:{
                  width:`${(freq(t)/max)*100}%`,height:"100%",
                  background:"rgba(159,202,86,0.5)",borderRadius:"3px",
                  transition:"width 0.3s",
                }}),
                React.createElement("span",{style:{
                  position:"absolute",left:"6px",top:"50%",transform:"translateY(-50%)",
                  fontSize:"10px",color:"rgba(255,255,255,0.5)",pointerEvents:"none",
                }},`${Math.round((freq(t)/pct)*100)}% van notities`)
              ),
              React.createElement("span",{style:{fontSize:"11px",color:W2.fgMuted,
                width:"32px",textAlign:"right",flexShrink:0}},freq(t)+"×")
            ));
          })()
        )
      ),

      // Verdeling: N tags per notitie
      React.createElement("div",null,
        React.createElement("div",{style:{fontSize:"13px",color:W2.blue,fontWeight:"bold",marginBottom:"10px"}}),
        React.createElement("div",{style:{fontSize:"13px",color:W2.blue,fontWeight:"bold",marginBottom:"10px"}},
          "📊 Hoeveel tags per notitie?"),
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"4px"}},
          (()=>{
            const dist=stats.tagCountDist;
            const keys=Object.keys(dist).map(Number).sort((a,b)=>a-b);
            const maxV=Math.max(...Object.values(dist));
            return keys.map(k=>React.createElement("div",{key:k,style:{display:"flex",alignItems:"center",gap:"8px"}},
              React.createElement("span",{style:{fontSize:"12px",color:W2.fgMuted,
                width:"60px",flexShrink:0,textAlign:"right"}},
                k===0?"geen":k===1?"1 tag":k+" tags"),
              React.createElement("div",{style:{flex:1,background:W2.bg3,borderRadius:"3px",height:"14px",overflow:"hidden"}},
                React.createElement("div",{style:{
                  width:`${(dist[k]/maxV)*100}%`,height:"100%",
                  background:k===0?"rgba(229,120,109,0.4)":"rgba(138,198,242,0.45)",
                  borderRadius:"3px",
                }})
              ),
              React.createElement("span",{style:{fontSize:"11px",color:W2.fgMuted,
                width:"40px",textAlign:"right",flexShrink:0}},dist[k]+" nts")
            ));
          })()
        )
      ),

      // Co-occurrences
      stats.topCo.length>0&&React.createElement("div",null,
        React.createElement("div",{style:{fontSize:"13px",color:W2.purple||"#d787ff",fontWeight:"bold",marginBottom:"10px"}},
          "🔗 Meest samen gebruikte tags"),
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"5px"}},
          (()=>{
            const max=stats.topCo[0]?.count||1;
            return stats.topCo.map(({pair,count},i)=>React.createElement("div",{key:i,
              style:{display:"flex",alignItems:"center",gap:"8px"}},
              React.createElement("span",{style:{fontSize:"12px",color:W2.comment,
                width:"200px",flexShrink:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
                "#"+pair[0]+" + #"+pair[1]),
              React.createElement("div",{style:{flex:1,background:W2.bg3,borderRadius:"3px",height:"10px",overflow:"hidden"}},
                React.createElement("div",{style:{
                  width:`${(count/max)*100}%`,height:"100%",
                  background:"rgba(215,135,255,0.45)",borderRadius:"3px",
                }})
              ),
              React.createElement("span",{style:{fontSize:"11px",color:W2.fgMuted,
                width:"28px",textAlign:"right",flexShrink:0}},count+"×")
            ));
          })()
        )
      )
    ),

    // ── OPRUIMEN ─────────────────────────────────────────────────────────────
    tab==="opruimen"&&React.createElement("div",{style:{flex:1,overflowY:"auto",padding:"14px 16px", minHeight:0, WebkitOverflowScrolling:"touch",}},

      // Ongebruikt
      React.createElement("div",{style:{marginBottom:"20px"}},
        React.createElement("div",{style:{fontSize:"13px",color:W2.orange,fontWeight:"bold",marginBottom:"8px"}},"🗑 Ongebruikte tags"),
        (()=>{
          const unused=uniqueTags.filter(t=>freq(t)===0);
          return unused.length===0
            ?React.createElement("div",{style:{color:W2.fgMuted,fontSize:"12px"}},"Geen ✓")
            :React.createElement("div",null,
                React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:"5px",marginBottom:"8px"}},
                  ...unused.map(t=>React.createElement("span",{key:t,style:{
                    display:"inline-flex",alignItems:"center",gap:"4px",
                    background:"rgba(229,120,109,0.1)",border:"1px solid rgba(229,120,109,0.22)",
                    borderRadius:"10px",padding:"2px 9px",fontSize:"12px",color:W2.orange,
                  }},"#"+t,React.createElement("span",{onClick:()=>onDeleteTag(t),style:{cursor:"pointer",fontSize:"10px"}},"✕")))
                ),
                React.createElement("button",{onClick:()=>unused.forEach(t=>onDeleteTag(t)),style:{
                  background:"rgba(229,120,109,0.12)",border:"1px solid rgba(229,120,109,0.25)",
                  borderRadius:"4px",padding:"5px 14px",color:W2.orange,fontSize:"12px",cursor:"pointer",
                }},`Alle ${unused.length} verwijderen`)
              );
        })()
      ),

      // Zelden gebruikt
      React.createElement("div",{style:{marginBottom:"20px"}},
        React.createElement("div",{style:{fontSize:"13px",color:W2.yellow,fontWeight:"bold",marginBottom:"8px"}},"⚠ Slechts 1 notitie"),
        (()=>{
          const rare=uniqueTags.filter(t=>freq(t)===1);
          return rare.length===0
            ?React.createElement("div",{style:{color:W2.fgMuted,fontSize:"12px"}},"Geen ✓")
            :React.createElement("div",{style:{display:"flex",flexWrap:"wrap",gap:"5px"}},
                ...rare.map(t=>React.createElement("span",{key:t,style:{
                  background:"rgba(234,231,136,0.08)",border:"1px solid rgba(234,231,136,0.2)",
                  borderRadius:"10px",padding:"2px 9px",fontSize:"12px",color:W2.yellow,
                }},"#"+t))
              );
        })()
      ),

      // Top tags met balk
      React.createElement("div",null,
        React.createElement("div",{style:{fontSize:"13px",color:W2.comment,fontWeight:"bold",marginBottom:"8px"}},"⭐ Meest gebruikte tags"),
        React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"4px"}},
          (()=>{
            const sorted=uniqueTags.filter(t=>freq(t)>1).sort((a,b)=>freq(b)-freq(a)).slice(0,20);
            const max=sorted.length?freq(sorted[0]):1;
            return sorted.map(t=>React.createElement("div",{key:t,style:{display:"flex",alignItems:"center",gap:"8px"}},
              React.createElement("span",{style:{fontSize:"12px",color:W2.comment,width:"160px",
                overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}},"#"+t),
              React.createElement("div",{style:{flex:1,background:W2.bg3,borderRadius:"3px",height:"6px",overflow:"hidden"}},
                React.createElement("div",{style:{width:`${(freq(t)/max)*100}%`,height:"100%",
                  background:"rgba(159,202,86,0.45)",borderRadius:"3px"}})
              ),
              React.createElement("span",{style:{fontSize:"11px",color:W2.fgMuted,width:"28px",textAlign:"right",flexShrink:0}},freq(t)+"×")
            ));
          })()
        )
      )
    )
  );
};
