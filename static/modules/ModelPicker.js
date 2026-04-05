// ── ModelPicker ──────────────────────────────────────────────────────────────
// Deps: W, ONLINE_MODELS, MODEL_LABEL, MODEL_COLOR, PROVIDER_COLOR

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

      // Aanbevolen lokale modellen — altijd zichtbaar
      ...[
        {id:"qwen3:8b",      label:"Qwen3 8B",      desc:"Aanbevolen · NL/EN · 128K context", icon:"🐉"},
        {id:"gemma3:12b",    label:"Gemma 3 12B",   desc:"16GB RAM · lang context · sterk NL", icon:"💎"},
        {id:"llama3.3:8b",   label:"Llama 3.3 8B",  desc:"Stabiel · snel · 8GB RAM",          icon:"🦙"},
        {id:"llama3.2-vision",label:"Llama 3.2 Vision",desc:"Beelden + tekst · vision model",  icon:"👁"},
      ].map(m => {
        const isInstalled = localModels.includes(m.id) || localModels.some(l => l.startsWith(m.id.split(":")[0]));
        const isActive = llmModel === m.id;
        return React.createElement("button", {
          key: m.id,
          onClick: () => isInstalled ? select(m.id) : null,
          title: isInstalled ? m.label : `Niet geïnstalleerd — voer uit: ollama pull ${m.id}`,
          style:{
            display:"flex", alignItems:"center", gap:"8px",
            width:"100%", textAlign:"left",
            background: isActive ? "rgba(159,202,86,0.15)" : "none",
            border:"none", padding:"5px 14px 5px 18px",
            color: isActive ? W.comment : isInstalled ? W.fg : W.fgDim,
            fontSize:"14px", cursor: isInstalled ? "pointer" : "default",
            opacity: isInstalled ? 1 : 0.55,
          }
        },
          React.createElement("span",{style:{fontSize:"15px",width:"20px",flexShrink:0}}, m.icon),
          React.createElement("div",{style:{flex:1,minWidth:0}},
            React.createElement("div",null, m.label),
            React.createElement("div",{style:{fontSize:"10px",color:W.fgMuted,marginTop:"1px"}},
              isInstalled ? m.desc : `ollama pull ${m.id}`)
          ),
          isActive && React.createElement("span",{style:{marginLeft:"auto",fontSize:"11px",color:W.comment}},"✓"),
          !isInstalled && React.createElement("span",{style:{marginLeft:"auto",fontSize:"10px",color:W.fgDim}},"↓")
        );
      }),

      // Overige geïnstalleerde modellen
      localModels.filter(m => !["qwen3","gemma3","llama3.3","llama3.2"].some(p => m.startsWith(p))).length > 0 &&
        React.createElement("div",{style:{padding:"6px 14px 2px",fontSize:"10px",color:W.fgMuted}},"Overige geïnstalleerd:"),
      ...localModels
        .filter(m => !["qwen3","gemma3","llama3.3","llama3.2"].some(p => m.startsWith(p)))
        .map(m =>
          React.createElement("button", {
            key:m, onClick:()=>select(m),
            style:{
              display:"flex", alignItems:"center", gap:"8px",
              width:"100%", textAlign:"left",
              background: llmModel===m ? "rgba(159,202,86,0.15)" : "none",
              border:"none", padding:"4px 14px 4px 18px",
              color: llmModel===m ? W.comment : W.fg,
              fontSize:"13px", cursor:"pointer",
            }
          },
            React.createElement("span",{style:{fontSize:"14px",width:"20px"}},"🖥"),
            React.createElement("span",null, m),
            llmModel===m && React.createElement("span",{style:{marginLeft:"auto",fontSize:"11px",color:W.comment}},"✓")
          )
        ),
      localModels.length === 0 &&
        React.createElement("div",{style:{padding:"4px 18px 6px",fontSize:"12px",color:W.fgDim}},
          "Ollama niet gevonden — start Ollama om lokale modellen te gebruiken"),

      // API-key hint
      React.createElement("div",{style:{padding:"8px 14px 4px",fontSize:"12px",
        color:W.fgDim,borderTop:`1px solid ${W.splitBg}`,marginTop:"4px"}},
        "Online: stel API-key in als env-variabele")
    )
  );
};


