// ── VaultSettings ────────────────────────────────────────────────────────────
// Deps: W, api

const VaultSettings = ({vaultPath, onChangeVault, onClose, onTaskModelsChange=null}) => {
  const { useState, useEffect } = React;
  const [tab,      setTab]     = useState("vault");   // "vault" | "keys" | "pdf" | "weergave" | "offline"
  const [newPath,  setNewPath] = useState(vaultPath);
  const [msg,      setMsg]     = useState("");
  const [appVersion, setAppVersion] = React.useState({sw:"…", app:"…"});

  React.useEffect(() => {
    // Haal app + SW versie op
    fetch("/api/version").then(r=>r.json()).then(d=>
      setAppVersion(v=>({...v,
        app: d.hash || d.version || d.app || "onbekend",
        sw:  d.sw   || v.sw,
      }))
    ).catch(()=>{});
    // SW versie via directe message (scriptURL bevat geen versienummer)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        const ctrl = reg.active;
        if (!ctrl) return;
        const ch = new MessageChannel();
        ch.port1.onmessage = e => {
          if (e.data?.version) setAppVersion(v=>({...v, sw: e.data.version}));
        };
        ctrl.postMessage({ type: "GET_VERSION" }, [ch.port2]);
      }).catch(()=>{});
    }
  }, []);
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem("zk_font_size");
    return saved ? Math.max(11, Math.min(18, parseInt(saved))) : 13;
  });

  const applyFontSize = (size) => {
    const clamped = Math.max(11, Math.min(18, size));
    setFontSize(clamped);
    localStorage.setItem("zk_font_size", clamped);
    document.documentElement.style.setProperty("--app-font-size", clamped + "px");
  };

  // ── Offline opslag state ────────────────────────────────────────────────
  const [storageInfo,  setStorageInfo]  = useState(null);
  const [pdfMaxMb,     setPdfMaxMb]     = useState(150);
  const [storageMsg,   setStorageMsg]   = useState("");

  const loadStorageInfo = async () => {
    if (!navigator.serviceWorker?.controller) return;
    try {
      const ch = new MessageChannel();
      const result = await new Promise((res, rej) => {
        ch.port1.onmessage = e => res(e.data);
        navigator.serviceWorker.controller.postMessage({type:"GET_STORAGE_INFO"}, [ch.port2]);
        setTimeout(() => rej(new Error("timeout")), 5000);
      });
      setStorageInfo(result);
    } catch(e) { setStorageInfo({error: e.message}); }
  };

  const removePdf = async (pdfUrl) => {
    if (!navigator.serviceWorker?.controller) return;
    const ch = new MessageChannel();
    await new Promise(res => {
      ch.port1.onmessage = res;
      navigator.serviceWorker.controller.postMessage({type:"REMOVE_PDF", url:pdfUrl}, [ch.port2]);
    });
    await loadStorageInfo();
    setStorageMsg("✓ Verwijderd");
    setTimeout(() => setStorageMsg(""), 2000);
  };

  // Laad storage info als offline tab actief wordt
  React.useEffect(() => {
    if (tab === "offline") loadStorageInfo();
  }, [tab]);

  // API-sleutels state
  const [keys, setKeys] = useState({ anthropic:"", openai:"", google:"", openrouter:"", mistral:"", jan:"" });
  const [janUrl, setJanUrl] = useState("http://127.0.0.1:1337");
  const [activeTheme, setActiveTheme] = useState(() => window._currentTheme ? window._currentTheme() : "void-cyan");

  // Custom modellen state
  const [customModels, setCustomModels] = useState([]);
  const [newModel, setNewModel] = useState({ id:"", label:"", endpoint:"", key:"" });
  const [modelsMsg, setModelsMsg] = useState("");
  const [keyStatus, setKeyStatus] = useState({});
  const [keysMsg, setKeysMsg] = useState("");
  const [showKey, setShowKey] = useState({});
  const [expandedProvider, setExpandedProvider] = useState(null);
  const [testResults, setTestResults] = useState({}); // {providerId: {ok, msg, loading}}

  // Model per taak — "" betekent: val terug op het standaardmodel voor die taak
  const [imageLlmModel,    setImageLlmModel]    = useState("");
  const [semanticLlmModel, setSemanticLlmModel] = useState("");
  const [textImproveLlmModel, setTextImproveLlmModel] = useState("");
  const [taskModelsMsg,    setTaskModelsMsg]    = useState("");
  // Welke modellen zijn daadwerkelijk lokaal geïnstalleerd (Ollama) — om de
  // standaardwaarden (llama3.2-vision / nomic-embed-text) als beschikbaar
  // of ontbrekend te kunnen tonen i.p.v. een blinde lege keuze.
  const [installedModels,  setInstalledModels]  = useState(null); // null = nog aan het laden

  // PDF personal use state
  const [personalUse,      setPersonalUse]      = useState(false);
  const [personalEmail,    setPersonalEmail]    = useState("");
  const [pdfMsg,           setPdfMsg]           = useState("");

  // Laad huidige instellingen bij openen
  useEffect(() => {
    fetch("/api/api-keys").then(r=>r.json()).then(d => setKeyStatus(d)).catch(()=>{});
    fetch("/api/custom-models").then(r=>r.json()).then(d => {
      if (d.custom_models) setCustomModels(d.custom_models);
    }).catch(()=>{});
    fetch("/api/config").then(r=>r.json()).then(d => {
      const cfg = d.config || {};
      setPersonalUse(!!cfg.pdf_personal_use);
      setPersonalEmail(cfg.pdf_personal_email || "");
      setJanUrl(cfg.jan_url || "http://127.0.0.1:1337");
      setImageLlmModel(cfg.image_llm_model || "");
      setSemanticLlmModel(cfg.semantic_llm_model || "");
      setTextImproveLlmModel(cfg.text_improve_llm_model || "");
    }).catch(()=>{});
    // Lokaal geïnstalleerde Ollama-modellen — voor de beschikbaarheids-
    // indicator bij "Model per taak" hieronder.
    fetch("/api/ollama-models", { method:"POST", headers:{"Content-Type":"application/json"}, body:"{}" })
      .then(r=>r.json())
      .then(d => setInstalledModels(d.models || []))
      .catch(() => setInstalledModels([]));
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

  const saveTaskModels = async (patch) => {
    try {
      await api.post("/config", patch);
      onTaskModelsChange?.(patch);
      setTaskModelsMsg("✓ Opgeslagen");
      setTimeout(() => setTaskModelsMsg(""), 2000);
    } catch(e) { setTaskModelsMsg("✗ " + e.message); }
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
    // Jan accepteert elke string als key — ook een lege string is geldig
    if (!val.trim() && providerId !== "jan") return;
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

  const testKey = async (providerId) => {
    setTestResults(p => ({...p, [providerId]: {loading: true, ok: null, msg: "Testen…"}}));
    // Stuur een klein test-verzoek via de server
    try {
      const resp = await fetch("/api/llm/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          model: {
            anthropic: "claude-haiku-4-5-20251001",
            openai:    "gpt-4.1-mini",
            google:    "gemini-2.0-flash",
            mistral:   "mistral-small-latest",
            openrouter:"meta-llama/llama-4-scout",
          }[providerId] || "",
          messages: [{role:"user", content:"Zeg alleen: OK"}],
          system: "Antwoord alleen met OK.",
        }),
      });
      // Lees eerste SSE chunk
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "", found = false;
      for (let i = 0; i < 20 && !found; i++) {
        const {done, value} = await reader.read();
        if (done) break;
        buf += dec.decode(value, {stream: true});
        for (const line of buf.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.error) {
              setTestResults(p => ({...p, [providerId]: {loading:false, ok:false, msg: evt.error}}));
              found = true; break;
            }
            if (evt.token || evt.delta) {
              setTestResults(p => ({...p, [providerId]: {loading:false, ok:true, msg: "✓ Verbinding werkt"}}));
              found = true; break;
            }
          } catch {}
        }
      }
      reader.cancel();
      if (!found) setTestResults(p => ({...p, [providerId]: {loading:false, ok:null, msg: "Geen reactie ontvangen"}}));
    } catch(e) {
      setTestResults(p => ({...p, [providerId]: {loading:false, ok:false, msg: "Fout: " + e.message}}));
    }
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
    {
      id:"jan", label:"Jan.ai (lokaal)",
      placeholder:"jan-local-key (elke string)",
      hint: React.createElement("div",null,
        React.createElement("div",{style:{marginBottom:"6px"}},
          "Open Jan → Settings → Local API Server → Start Server. ",
          "Stel hieronder de URL en API-key in die je in Jan hebt geconfigureerd."
        ),
        React.createElement("div",{style:{display:"flex",gap:"6px",alignItems:"center",marginTop:"6px"}},
          React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted,flexShrink:0}},"URL:"),
          React.createElement("input",{
            value: janUrl,
            onChange: e => setJanUrl(e.target.value),
            placeholder: "http://127.0.0.1:1337",
            style:{flex:1,background:W.bg,border:`1px solid ${W.splitBg}`,borderRadius:"4px",
                   padding:"3px 8px",fontSize:"12px",color:W.fg,outline:"none",
                   fontFamily:"'Hack','Courier New',monospace"},
          }),
          React.createElement("button",{
            onClick: async () => {
              await api.post("/config", { jan_url: janUrl.trim() });
              setKeysMsg("✓ Jan URL opgeslagen");
              setTimeout(()=>setKeysMsg(""),2000);
            },
            style:{background:"rgba(232,164,74,0.15)",border:"1px solid rgba(232,164,74,0.4)",
                   borderRadius:"4px",padding:"3px 10px",fontSize:"12px",
                   color:"#e8a44a",cursor:"pointer"}
          },"Opslaan")
        )
      ),
      color: "#e8a44a",
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
          {id:"vault",    icon:"📁", label:"Vault"},
          {id:"theme",    icon:"🎨", label:"Thema"},
      {id:"keys",     icon:"🔑", label:"API-sleutels"},
          {id:"modellen", icon:"🤖", label:"Modellen"},
          {id:"pdf",      icon:"📄", label:"PDF"},
          {id:"weergave", icon:"🔤", label:"Weergave"},
          {id:"offline",  icon:"📲", label:"Offline"},
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
        tab==="theme" && React.createElement("div",{style:{padding:"0 4px"}},
          React.createElement("p",{style:{fontSize:"13px",color:W.fgMuted,marginBottom:"16px",lineHeight:"1.6"}},
            "Kies het kleurenschema. De keuze wordt direct toegepast en opgeslagen."),
          React.createElement("div",{style:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"8px"}},
            ...Object.entries(window.THEMES || {}).map(([id, theme]) => {
              const isActive = activeTheme === id;
              return React.createElement("div",{
                key: id,
                onClick: () => { setActiveTheme(id); if (window._setTheme) window._setTheme(id); },
                style:{
                  cursor:"pointer",
                  border:`2px solid ${isActive ? W.blue : W.splitBg}`,
                  borderRadius:"10px", overflow:"hidden",
                  transition:"border-color 0.15s",
                  boxShadow: isActive ? `0 0 0 3px ${W.blue}33` : "none",
                }
              },
                React.createElement("div",{style:{
                  background:theme.bg2, padding:"8px 12px",
                  borderBottom:`1px solid ${theme.splitBg}`,
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                }},
                  React.createElement("span",{style:{fontSize:"13px",fontWeight:"600",color:theme.fg}}, theme.label),
                  isActive && React.createElement("span",{style:{
                    fontSize:"10px",padding:"2px 7px",borderRadius:"10px",
                    background:theme.blue+"22",color:theme.blue,
                    border:`1px solid ${theme.blue}44`,
                  }},"✓ Actief")
                ),
                React.createElement("div",{style:{background:theme.bg, padding:"10px 12px", display:"flex", flexDirection:"column", gap:"4px"}},
                  React.createElement("div",{style:{height:"9px",width:"60%",background:theme.yellow,borderRadius:"2px",opacity:.85}}),
                  React.createElement("div",{style:{height:"7px",width:"92%",background:theme.splitBg,borderRadius:"2px"}}),
                  React.createElement("div",{style:{height:"7px",width:"72%",background:theme.splitBg,borderRadius:"2px"}}),
                  React.createElement("div",{style:{height:"7px",width:"48%",background:theme.green,borderRadius:"2px",opacity:.85}}),
                  React.createElement("div",{style:{display:"flex",gap:"5px",marginTop:"4px"}},
                    ...[theme.blue,theme.green,theme.yellow,theme.orange,theme.purple].map((c,i)=>
                      React.createElement("div",{key:i,style:{width:"13px",height:"13px",borderRadius:"50%",background:c}})
                    )
                  )
                ),
                React.createElement("div",{style:{
                  background:theme.statusBg, padding:"3px 10px",
                  borderTop:`1px solid ${theme.splitBg}`,
                  fontSize:"9px", color:theme.blue, fontFamily:"monospace",
                }},"NORMAL  ·  " + theme.label)
              );
            })
          )
        ),

        // ── Versienummer (onderaan vault tab) ───────────────────────────────
        tab==="vault" && React.createElement("div",{style:{
          marginTop:"24px", paddingTop:"16px",
          borderTop:`1px solid ${W.splitBg}`,
          display:"flex", justifyContent:"space-between", alignItems:"center",
        }},
          React.createElement("div",null,
            React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,
              letterSpacing:"1px",marginBottom:"4px"}},"VERSIE"),
            React.createElement("div",{style:{fontSize:"13px",color:W.fg,
              fontFamily:"monospace",display:"flex",gap:"14px"}},
              React.createElement("span",null,"App: ",
                React.createElement("span",{style:{color:W.blue}},appVersion.app)),
              React.createElement("span",null,"SW: ",
                React.createElement("span",{style:{color:W.comment}},appVersion.sw))
            )
          ),
          React.createElement("button",{
            onClick:()=>window.location.reload(true),
            title:"Herladen om updates te activeren",
            style:{background:"none",border:`1px solid ${W.splitBg}`,
              color:W.fgMuted,borderRadius:"5px",padding:"4px 10px",
              fontSize:"12px",cursor:"pointer"}
          },"↻ Herladen")
        ),

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
                // Test resultaat
                testResults[p.id] && React.createElement("div",{style:{
                  marginTop:"10px",
                  padding:"7px 10px",
                  borderRadius:"5px",
                  fontSize:"12px",
                  background: testResults[p.id].ok === true ? "rgba(166,209,137,0.08)"
                            : testResults[p.id].ok === false ? "rgba(229,120,109,0.08)"
                            : "rgba(255,255,255,0.04)",
                  border: `1px solid ${testResults[p.id].ok === true ? "rgba(166,209,137,0.3)"
                            : testResults[p.id].ok === false ? "rgba(229,120,109,0.3)"
                            : W.splitBg}`,
                  color: testResults[p.id].ok === true ? W.comment
                       : testResults[p.id].ok === false ? W.orange : W.fgDim,
                  wordBreak:"break-word",
                }}, testResults[p.id].msg),

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
                  display:"flex",gap:"8px",marginTop:"10px",alignItems:"center",flexWrap:"wrap"
                }},
                  // Test knop (alleen als sleutel al ingesteld)
                  hasKey && React.createElement("button",{
                    onClick: e => { e.stopPropagation(); testKey(p.id); },
                    disabled: testResults[p.id]?.loading,
                    style:{
                      padding:"6px 12px", borderRadius:"5px",
                      background:"rgba(255,255,255,0.04)",
                      border:`1px solid ${W.splitBg}`,
                      color:W.fgDim, fontSize:"12px", cursor:"pointer",
                    }
                  }, testResults[p.id]?.loading ? "⏳ Testen…" : "⚡ Test"),
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
        ),

        // ── MODELLEN TAB ─────────────────────────────────────────────────────
        tab==="modellen" && React.createElement("div", {
          style: { display:"flex", flexDirection:"column", gap:"20px" }
        },
          // ── Model per taak ───────────────────────────────────────────────
          // Voor sommige taken is een ander model handiger dan het hoofdmodel
          // (bv. een vision-model voor afbeeldingen, of een lichter/sneller
          // model voor semantisch zoeken). Leeg = val terug op het hoofdmodel
          // dat je in de hoofdbalk kiest (ModelPicker).
          React.createElement("div", {
            style: { border:`1px solid ${W.splitBg}`, borderRadius:"7px", padding:"14px 16px" }
          },
            React.createElement("div", {
              style: { fontSize:"13px", fontWeight:"600", color:W.fg, marginBottom:"4px" }
            }, "Model per taak"),
            React.createElement("div", {
              style: { fontSize:"12px", color:W.fgDim, lineHeight:"1.5", marginBottom:"14px" }
            },
              "Leeg = gebruik het hoofdmodel dat je bovenin kiest. Alleen invullen als je",
              " voor deze taak bewust een ander model wilt."
            ),

            [
              { key:"image_llm_model",    label:"Afbeeldingen",        value:imageLlmModel,    setValue:setImageLlmModel,
                defaultModel:"llama3.2-vision",
                hint:"Gebruikt bij het analyseren/beschrijven van afbeeldingen (Plaatjes-tab)." },
              { key:"semantic_llm_model", label:"Semantisch zoeken",   value:semanticLlmModel, setValue:setSemanticLlmModel,
                defaultModel:"nomic-embed-text",
                hint:"Gebruikt voor de embeddings bij semantisch zoeken (Ontdekken-tab) — bewust niet het hoofdmodel, want dat is meestal een chat-model en geen embedding-model. Vault overwegend niet-Engelstalig? bge-m3 is native meertalig (100+ talen) en vaak nauwkeuriger dan nomic-embed-text voor Nederlandse tekst. Let op: na het wisselen van embeddingmodel moet je herindexeren — voor notities \"Alles herindexeren\", voor PDF's \"Volledig herindexeren\" (niet de gewone \"bijwerken\"-knoppen: die zien oude embeddings van het vorige model ten onrechte als \"al gedaan\")." },
              { key:"text_improve_llm_model", label:"Tekstverbetering", value:textImproveLlmModel, setValue:setTextImproveLlmModel,
                defaultModel:null,
                hint:"Gebruikt bij AI-tekstverbetering in de notitie-editor (selecteer tekst → \\a, of \"✨ verbeter\" onderaan). Valt terug op het hoofdmodel — hier alleen invullen als je bewust een ander (bv. sneller of specifieker) model wilt voor deze taak." },
            ].map(row => {
              // Staat het standaardmodel voor deze taak lokaal geïnstalleerd?
              // Zo ja: toon 'm automatisch geselecteerd i.p.v. een lege
              // placeholder — precies het model dat er anders toch gebruikt
              // wordt als je hier niets kiest.
              const defaultInstalled = row.defaultModel ? installedModels?.some(
                m => m === row.defaultModel || m.startsWith(row.defaultModel + ":")
              ) : false;
              const effectiveValue = row.value || (defaultInstalled ? row.defaultModel : "");
              return React.createElement("div", {
                key: row.key, style:{ marginBottom:"12px" }
              },
                React.createElement("label", {
                  style:{ display:"block", fontSize:"12px", color:W.fgMuted, marginBottom:"4px" }
                }, row.label),
                React.createElement("select", {
                  value: effectiveValue,
                  onChange: e => {
                    const v = e.target.value;
                    row.setValue(v);
                    saveTaskModels({ [row.key]: v });
                  },
                  style: {
                    width:"100%", background:W.bg, border:`1px solid ${W.splitBg}`,
                    borderRadius:"5px", padding:"6px 8px", color:W.fg, fontSize:"13px",
                  }
                },
                  React.createElement("option", { value:"" },
                    row.defaultModel
                      ? (defaultInstalled ? `— Automatisch (${row.defaultModel}) —` : "— Automatisch —")
                      : "— Automatisch (hoofdmodel) —"),
                  React.createElement("optgroup", { label:"Online" },
                    ...ONLINE_MODELS.map(m => React.createElement("option", { key:m.id, value:m.id }, m.label))
                  ),
                  React.createElement("optgroup", { label:"Lokaal (Ollama)" },
                    ...[
                      {id:"qwen3:8b",       label:"Qwen3 8B"},
                      {id:"gemma3:12b",     label:"Gemma 3 12B"},
                      {id:"llama3.3:8b",    label:"Llama 3.3 8B"},
                      {id:"llama3.2-vision",label:"Llama 3.2 Vision"},
                      {id:"nomic-embed-text",label:"nomic-embed-text (embeddings)"},
                      {id:"bge-m3",         label:"bge-m3 (embeddings, meertalig)"},
                    ].map(m => React.createElement("option", { key:m.id, value:m.id }, m.label))
                  ),
                  customModels.length > 0 && React.createElement("optgroup", { label:"Aangepast" },
                    ...customModels.map(m => React.createElement("option", { key:m.id, value:m.id }, m.label || m.id))
                  ),
                ),
                // Rustige, niet-blokkerende toelichting — geen waarschuwing.
                // Alle modellen blijven altijd gewoon kiesbaar, ongeacht of
                // het standaardmodel al dan niet geïnstalleerd is.
                React.createElement("div", {
                  style:{ fontSize:"11px", color:W.fgDim, marginTop:"3px", lineHeight:"1.4" }
                },
                  row.hint,
                  installedModels !== null && !defaultInstalled && !row.value &&
                    ` (${row.defaultModel} is nog niet geïnstalleerd — kies hierboven gerust een ander model, of installeer met `,
                  installedModels !== null && !defaultInstalled && !row.value &&
                    React.createElement("code",{key:"cmd",style:{fontSize:"10.5px"}}, `ollama pull ${row.defaultModel}`),
                  installedModels !== null && !defaultInstalled && !row.value && ".)"
                )
              );
            }),

            taskModelsMsg && React.createElement("div", {
              style:{ fontSize:"12px", marginTop:"4px",
                      color: taskModelsMsg.startsWith("✓") ? W.comment : W.orange }
            }, taskModelsMsg)
          ),

          // Instructie
          React.createElement("div", {
            style: { fontSize:"13px", color:W.fgDim, lineHeight:"1.6",
                     background: `rgba(125,216,198,0.04)`,
                     border: `1px solid ${W.splitBg}`,
                     borderRadius:"6px", padding:"10px 14px" }
          },
            "Voeg een custom AI-model toe met een OpenAI-compatibele API. " +
            "Denk aan lokale modellen via LM Studio, Ollama met specifiek endpoint, of andere providers. " +
            "Het model wordt daarna beschikbaar in de ModelPicker."
          ),

          // Bestaande modellen
          customModels.length > 0 && React.createElement("div", null,
            React.createElement("div", {
              style: { fontSize:"11px", color:W.fgMuted, letterSpacing:"1px",
                       textTransform:"uppercase", marginBottom:"8px" }
            }, "Toegevoegde modellen"),
            customModels.map((m, i) =>
              React.createElement("div", {
                key: m.id,
                style: {
                  display:"flex", alignItems:"center", gap:"8px",
                  padding:"8px 12px",
                  background: W.bg2, border:`1px solid ${W.splitBg}`,
                  borderRadius:"6px", marginBottom:"6px",
                }
              },
                React.createElement("div", { style:{flex:1} },
                  React.createElement("div", {
                    style:{fontSize:"13px", color:W.fg, fontWeight:"500"}
                  }, m.label || m.id),
                  React.createElement("div", {
                    style:{fontSize:"11px", color:W.fgMuted, marginTop:"2px",
                           fontFamily:"'Hack',monospace"}
                  }, m.endpoint || "geen endpoint")
                ),
                React.createElement("span", {
                  style:{fontSize:"10px", color: m.key ? W.comment : W.fgMuted}
                }, m.key ? "🔑" : "geen key"),
                React.createElement("button", {
                  onClick: async () => {
                    const updated = customModels.filter((_, j) => j !== i);
                    await fetch("/api/custom-models", {
                      method:"POST",
                      headers:{"Content-Type":"application/json"},
                      body: JSON.stringify({custom_models: updated})
                    });
                    setCustomModels(updated);
                    // Stuur event zodat ModelPicker ververst
                    window.dispatchEvent(new Event("custom-models-changed"));
                  },
                  style:{background:"none", border:`1px solid ${W.splitBg}`,
                         color:W.orange, borderRadius:"4px", padding:"3px 8px",
                         fontSize:"11px", cursor:"pointer"}
                }, "verwijder")
              )
            )
          ),

          // Nieuw model toevoegen
          React.createElement("div", null,
            React.createElement("div", {
              style:{fontSize:"11px", color:W.fgMuted, letterSpacing:"1px",
                     textTransform:"uppercase", marginBottom:"10px"}
            }, "Nieuw model toevoegen"),

            // Model ID
            React.createElement("div", {style:{marginBottom:"10px"}},
              React.createElement("div", {
                style:{fontSize:"12px", color:W.fgDim, marginBottom:"4px"}
              }, "Model ID (technische naam)"),
              React.createElement("input", {
                placeholder: "bijv. llama3.2, gpt-4o-mini, mijn-model",
                value: newModel.id,
                onChange: e => setNewModel(p => ({...p, id: e.target.value})),
                style:{width:"100%", background:W.bg, border:`1px solid ${W.splitBg}`,
                       borderRadius:"4px", padding:"7px 10px", color:W.fg,
                       fontSize:"13px", outline:"none",
                       fontFamily:"'Hack','Courier New',monospace", boxSizing:"border-box"}
              })
            ),

            // Weergavenaam
            React.createElement("div", {style:{marginBottom:"10px"}},
              React.createElement("div", {
                style:{fontSize:"12px", color:W.fgDim, marginBottom:"4px"}
              }, "Weergavenaam"),
              React.createElement("input", {
                placeholder: "bijv. Llama 3.2 (lokaal)",
                value: newModel.label,
                onChange: e => setNewModel(p => ({...p, label: e.target.value})),
                style:{width:"100%", background:W.bg, border:`1px solid ${W.splitBg}`,
                       borderRadius:"4px", padding:"7px 10px", color:W.fg,
                       fontSize:"13px", outline:"none", boxSizing:"border-box"}
              })
            ),

            // Endpoint URL
            React.createElement("div", {style:{marginBottom:"10px"}},
              React.createElement("div", {
                style:{fontSize:"12px", color:W.fgDim, marginBottom:"4px"}
              }, "API Endpoint (OpenAI-compatibel)"),
              React.createElement("input", {
                placeholder: "bijv. http://localhost:1234/v1/chat/completions",
                value: newModel.endpoint,
                onChange: e => setNewModel(p => ({...p, endpoint: e.target.value})),
                style:{width:"100%", background:W.bg, border:`1px solid ${W.splitBg}`,
                       borderRadius:"4px", padding:"7px 10px", color:W.fg,
                       fontSize:"13px", outline:"none",
                       fontFamily:"'Hack','Courier New',monospace", boxSizing:"border-box"}
              })
            ),

            // API Key (optioneel)
            React.createElement("div", {style:{marginBottom:"14px"}},
              React.createElement("div", {
                style:{fontSize:"12px", color:W.fgDim, marginBottom:"4px"}
              }, "API Key (optioneel)"),
              React.createElement("input", {
                type: "password",
                placeholder: "laat leeg voor lokale modellen zonder authenticatie",
                value: newModel.key,
                onChange: e => setNewModel(p => ({...p, key: e.target.value})),
                style:{width:"100%", background:W.bg, border:`1px solid ${W.splitBg}`,
                       borderRadius:"4px", padding:"7px 10px", color:W.fg,
                       fontSize:"13px", outline:"none", boxSizing:"border-box"}
              })
            ),

            // Opslaan knop
            React.createElement("div", {
              style:{display:"flex", alignItems:"center", gap:"10px"}
            },
              React.createElement("button", {
                disabled: !newModel.id.trim() || !newModel.endpoint.trim(),
                onClick: async () => {
                  const model = {
                    id:       newModel.id.trim(),
                    label:    newModel.label.trim() || newModel.id.trim(),
                    endpoint: newModel.endpoint.trim(),
                    key:      newModel.key.trim(),
                  };
                  const updated = [...customModels, model];
                  try {
                    const r = await fetch("/api/custom-models", {
                      method:"POST",
                      headers:{"Content-Type":"application/json"},
                      body: JSON.stringify({custom_models: updated})
                    });
                    const d = await r.json();
                    if (d.ok) {
                      setCustomModels(updated);
                      setNewModel({id:"", label:"", endpoint:"", key:""});
                      setModelsMsg("✓ Model toegevoegd");
                      setTimeout(() => setModelsMsg(""), 3000);
                      window.dispatchEvent(new Event("custom-models-changed"));
                    }
                  } catch(e) { setModelsMsg("✗ " + e.message); }
                },
                style:{
                  background: "rgba(125,216,198,0.12)",
                  border:`1px solid rgba(125,216,198,0.35)`,
                  borderRadius:"5px", color:W.blue,
                  padding:"7px 18px", fontSize:"13px", cursor:"pointer",
                  fontWeight:"600",
                  opacity: (!newModel.id.trim() || !newModel.endpoint.trim()) ? 0.4 : 1,
                }
              }, "+ Toevoegen"),
              modelsMsg && React.createElement("span", {
                style:{fontSize:"12px",
                       color: modelsMsg.startsWith("✓") ? W.comment : W.orange}
              }, modelsMsg)
            )
          )
        ),

        tab==="offline" && React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"16px"}},
          // Header
          React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between"}},
            React.createElement("div",{style:{fontSize:"15px",fontWeight:"600",color:W.fg}},"📲 Offline opslag"),
            React.createElement("button",{
              onClick:loadStorageInfo,
              style:{background:"none",border:`1px solid ${W.splitBg}`,color:W.fgMuted,
                borderRadius:"5px",padding:"4px 10px",fontSize:"12px",cursor:"pointer"}
            },"↻ Vernieuwen")
          ),

          // Opslaggebruik overview
          storageInfo && !storageInfo.error && React.createElement("div",{style:{
            background:W.bg2,border:`1px solid ${W.splitBg}`,borderRadius:"8px",padding:"14px",
          }},
            React.createElement("div",{style:{fontSize:"12px",color:W.fgMuted,marginBottom:"10px",fontWeight:"600",letterSpacing:"1px"}},"GEBRUIK"),
            // App-modules
            React.createElement("div",{style:{display:"flex",justifyContent:"space-between",fontSize:"13px",marginBottom:"6px"}},
              React.createElement("span",{style:{color:W.fg}},"App (modules + HTML)"),
              React.createElement("span",{style:{color:W.fgMuted}},"~10 MB")
            ),
            // Notities (IDB)
            React.createElement("div",{style:{display:"flex",justifyContent:"space-between",fontSize:"13px",marginBottom:"6px"}},
              React.createElement("span",{style:{color:W.fg}},"Notities (IndexedDB)"),
              React.createElement("span",{style:{color:W.fgMuted}},"~"+Math.round((storageInfo.storage?.used||0)/1048576-10)+" MB")
            ),
            // PDFs
            React.createElement("div",{style:{display:"flex",justifyContent:"space-between",fontSize:"13px",marginBottom:"10px"}},
              React.createElement("span",{style:{color:W.fg}},"PDFs offline"),
              React.createElement("span",{style:{color:storageInfo.pdfTotalMb>100?W.orange:"#72b660",fontWeight:"600"}},
                storageInfo.pdfTotalMb.toFixed(1)+" / "+storageInfo.pdfMaxMb+" MB")
            ),
            // Voortgangsbalk PDF cache
            React.createElement("div",{style:{height:"6px",background:W.bg3||W.splitBg,borderRadius:"3px",overflow:"hidden"}},
              React.createElement("div",{style:{
                height:"100%",borderRadius:"3px",
                background: (storageInfo.pdfTotalMb/storageInfo.pdfMaxMb)>0.8 ? W.orange : "#72b660",
                width:`${Math.min(100,(storageInfo.pdfTotalMb/storageInfo.pdfMaxMb)*100).toFixed(1)}%`,
                transition:"width .3s",
              }})
            ),
            // Totaal
            storageInfo.storage && React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,marginTop:"8px"}},
              "Totaal apparaat: ",
              Math.round(storageInfo.storage.used/1048576)+" MB gebruikt van ",
              Math.round(storageInfo.storage.quota/1048576)+" MB beschikbaar"
            )
          ),

          // Limiet instelling
          React.createElement("div",{style:{background:W.bg2,border:`1px solid ${W.splitBg}`,borderRadius:"8px",padding:"14px"}},
            React.createElement("div",{style:{fontSize:"12px",color:W.fgMuted,marginBottom:"10px",fontWeight:"600",letterSpacing:"1px"}},"PDF CACHE LIMIET"),
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"10px"}},
              React.createElement("input",{
                type:"range", min:50, max:500, step:25, value:pdfMaxMb,
                onChange:e=>setPdfMaxMb(Number(e.target.value)),
                style:{flex:1}
              }),
              React.createElement("span",{style:{fontSize:"13px",color:W.fg,minWidth:"55px"}},pdfMaxMb+" MB")
            ),
            React.createElement("div",{style:{fontSize:"11px",color:W.fgDim,marginTop:"6px"}},
              "Bij overschrijding worden de minst recent gebruikte PDFs automatisch verwijderd."
            )
          ),

          // Gecachede PDFs
          storageInfo?.pdfs?.length > 0 && React.createElement("div",{style:{
            background:W.bg2,border:`1px solid ${W.splitBg}`,borderRadius:"8px",overflow:"hidden"
          }},
            React.createElement("div",{style:{
              fontSize:"12px",color:W.fgMuted,padding:"10px 14px",fontWeight:"600",
              letterSpacing:"1px",borderBottom:`1px solid ${W.splitBg}`,
              display:"flex",justifyContent:"space-between",alignItems:"center",
            }},
              `OFFLINE PDFS (${storageInfo.pdfs.length})`,
              React.createElement("button",{
                onClick:async()=>{
                  if(!confirm("Alle offline PDFs verwijderen?")) return;
                  for(const p of storageInfo.pdfs) await removePdf(p.key);
                },
                style:{background:"none",border:`1px solid rgba(229,120,109,0.3)`,
                  color:W.orange,borderRadius:"4px",fontSize:"11px",padding:"2px 8px",cursor:"pointer"}
              },"Alles wissen")
            ),
            ...storageInfo.pdfs.map((p,i)=>
              React.createElement("div",{key:p.key,style:{
                display:"flex",alignItems:"center",padding:"8px 14px",gap:"10px",
                borderBottom:i<storageInfo.pdfs.length-1?`1px solid ${W.splitBg}`:"none",
              }},
                React.createElement("span",{style:{flex:1,fontSize:"13px",color:W.fg,
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}},
                  p.name || decodeURIComponent(p.key.split("/").pop())
                ),
                React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted,flexShrink:0}},
                  p.size ? ((p.size/1048576).toFixed(1)+" MB") : "?"
                ),
                React.createElement("button",{
                  onClick:()=>removePdf(p.key),
                  style:{background:"none",border:`1px solid ${W.splitBg}`,
                    color:W.fgMuted,borderRadius:"4px",fontSize:"11px",
                    padding:"2px 8px",cursor:"pointer",flexShrink:0}
                },"✕")
              )
            )
          ),

          storageInfo?.pdfs?.length === 0 && React.createElement("div",{style:{
            color:W.fgDim,fontSize:"13px",textAlign:"center",padding:"20px",
            fontStyle:"italic",
          }},"Geen PDFs offline beschikbaar.\nGebruik de ⬇ Offline knop in de PDF bibliotheek."),

          !storageInfo && React.createElement("div",{style:{color:W.fgMuted,fontSize:"13px"}},
            "Service Worker niet actief. Open de app eerst terwijl de server bereikbaar is."),

          storageInfo?.error && React.createElement("div",{style:{color:W.orange,fontSize:"13px"}},
            "⚠ "+storageInfo.error),

          storageMsg && React.createElement("div",{style:{color:"#72b660",fontSize:"13px"}},storageMsg)
        ),

        tab==="weergave" && React.createElement("div",{style:{display:"flex",flexDirection:"column",gap:"20px"}},

          // Font-grootte sectie
          React.createElement("div",null,
            React.createElement("div",{style:{
              fontSize:"11px",color:W.fgMuted,letterSpacing:"1.5px",
              fontWeight:"600",marginBottom:"12px"
            }},"🔤 TEKSTGROOTTE"),

            // Slider + waarde
            React.createElement("div",{style:{display:"flex",alignItems:"center",gap:"14px"}},
              React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted,flexShrink:0}},"11"),
              React.createElement("input",{
                type:"range", min:11, max:18, step:1,
                value:fontSize,
                onChange:e=>applyFontSize(parseInt(e.target.value)),
                style:{flex:1,accentColor:W.blue,height:"4px",cursor:"pointer"}
              }),
              React.createElement("span",{style:{fontSize:"11px",color:W.fgMuted,flexShrink:0}},"18"),
              React.createElement("span",{style:{
                minWidth:"38px",textAlign:"center",
                fontSize:"14px",fontWeight:"700",color:W.blue,
                background:"rgba(138,198,242,0.1)",
                border:"1px solid rgba(138,198,242,0.3)",
                borderRadius:"5px",padding:"2px 6px",flexShrink:0
              }},fontSize+"px")
            ),

            // Snelkeuze knoppen
            React.createElement("div",{style:{display:"flex",gap:"6px",marginTop:"10px"}},
              ...[11,12,13,14,15,16,18].map(size=>
                React.createElement("button",{
                  key:size,
                  onClick:()=>applyFontSize(size),
                  style:{
                    flex:1,padding:"6px 0",
                    background:fontSize===size?"rgba(138,198,242,0.15)":"rgba(255,255,255,0.04)",
                    border:`1px solid ${fontSize===size?"rgba(138,198,242,0.4)":W.splitBg}`,
                    color:fontSize===size?W.blue:W.fgMuted,
                    borderRadius:"5px",cursor:"pointer",
                    fontSize:size+"px",fontWeight:fontSize===size?"700":"400",
                    transition:"all 0.12s",
                  }
                },size+"px")
              )
            ),

            // Preview tekst
            React.createElement("div",{style:{
              marginTop:"16px",padding:"12px 14px",
              background:W.bg,border:`1px solid ${W.splitBg}`,
              borderRadius:"7px",lineHeight:"1.8",
            }},
              React.createElement("div",{style:{
                fontSize:fontSize+"px",color:W.fg,marginBottom:"4px"
              }},"Voorbeeldtekst op "+fontSize+"px"),
              React.createElement("div",{style:{
                fontSize:(fontSize-1)+"px",color:W.fgMuted
              }},"De snelle bruine vos springt over de luie hond."),
              React.createElement("div",{style:{
                fontSize:(fontSize-2)+"px",color:W.fgDim,marginTop:"2px"
              }},"Tags · Links · Metadata · Datums")
            )
          ),

          // Font-info
          React.createElement("div",{style:{
            padding:"10px 12px",background:"rgba(255,255,255,0.02)",
            border:`1px solid ${W.splitBg}`,borderRadius:"6px",
            fontSize:"12px",color:W.fgMuted,lineHeight:"1.7",
          }},
            React.createElement("strong",{style:{color:W.fgDim}},"Gebruikte lettertypes:"),
            React.createElement("br"),
            "UI & notities: ",React.createElement("span",{style:{color:W.fg}},"DM Sans"),
            React.createElement("br"),
            "Code & editor: ",React.createElement("span",{style:{color:W.fg}},"Hack"),
            React.createElement("br"),
            React.createElement("span",{style:{fontSize:"11px",color:W.splitBg}},
              "De instelling wordt automatisch opgeslagen.")
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

