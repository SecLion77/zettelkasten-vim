// ── Graph ───────────────────────────────────────────────────────────────────
// Deps: W, genId, extractLinks, extractTags, TagFilterBar

const Graph = ({notes, onSelect, selectedId, localMode=false, onUpdateNote, onDeleteNote}) => {
  const { useState, useRef, useCallback, useMemo, useEffect } = React;

  const cvRef      = useRef(null);
  const nodesRef   = useRef([]);
  const afRef      = useRef(null);
  const fitDoneRef = useRef(false); // voorkomt herhaald fitten
  const alphaRef   = useRef(1.0);   // simulatie-cooling (1=heet, 0=gestabiliseerd)
  const dirtyRef   = useRef(true);  // true = hertekenen nodig
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
  const [pathOnly,     setPathOnly]    = useState(false); // toon alleen pad-nodes
  const [ctxMenu,      setCtxMenu]     = useState(null);
  const [pinnedIds,    setPinnedIds]   = useState(new Set());
  const [scale,        setScale]       = useState(1);
  const [lassoRect,    setLassoRect]   = useState(null);  // {x,y,w,h} in screen coords
  const [lassoSel,     setLassoSel]    = useState(new Set()); // geselecteerde node-ids
  const pathRef    = useRef(null);
  const semEdgesRef= useRef([]);
  const lassoRef   = useRef(null); // {active, sx, sy} startpunt lasso
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
      // Volg links, backlinks EN tag-links voor pad via tags
      const nb=[
        ...(node?.links||[]),
        ...(node?.tagLinks||[]),
        ...nodesRef.current.filter(n=>(n.links||[]).includes(cur)||(n.tagLinks||[]).includes(cur)).map(n=>n.id)
      ];
      for (const id of nb) {
        if (!visited.has(id)&&map[id]){ visited.add(id); queue.push([...path,id]); }
      }
    }
    return null;
  }, []);

  // ── Spread geselecteerde nodes uiteen ───────────────────────────────────────
  const spreadSelected = React.useCallback((ids) => {
    if (!ids || ids.size === 0) return;
    const center = { x: 0, y: 0 };
    let count = 0;
    nodesRef.current.forEach(n => {
      if (ids.has(n.id)) { center.x += n.x; center.y += n.y; count++; }
    });
    if (count === 0) return;
    center.x /= count; center.y /= count;
    nodesRef.current.forEach(n => {
      if (!ids.has(n.id)) return;
      const dx = n.x - center.x, dy = n.y - center.y;
      const dist = Math.sqrt(dx*dx + dy*dy) || 1;
      const force = 180 + Math.random() * 80;
      n.vx += (dx/dist) * force;
      n.vy += (dy/dist) * force;
    });
    alphaRef.current = 0.6;
    dirtyRef.current = true;
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

    fitDoneRef.current = false;
    alphaRef.current = 1.0;  // herstart simulatie
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

    // dirtyRef (component-level): true = hertekenen nodig bij volgende frame

    const tick=()=>{
      const nodes=nodesRef.current;
      const v=viewRef.current;
      if(!nodes.length){ afRef.current=requestAnimationFrame(tick); return; }

      // O(1) node lookup — bouw Map eenmalig per frame
      const nodeMap = new Map(nodes.map(n=>[n.id,n]));

      const alpha = alphaRef.current;
      const simActive = alpha > 0.005;

      if (simActive) {
        // Repulsie
        for(let i=0;i<nodes.length;i++){
          for(let j=i+1;j<nodes.length;j++){
            const dx=nodes[j].x-nodes[i].x, dy=nodes[j].y-nodes[i].y;
            const d=Math.sqrt(dx*dx+dy*dy)||1;
            const f=(d < 50 ? 3600 : 1600)/(d*d);
            nodes[i].vx-=(dx/d)*f*alpha; nodes[i].vy-=(dy/d)*f*alpha;
            nodes[j].vx+=(dx/d)*f*alpha; nodes[j].vy+=(dy/d)*f*alpha;
          }
        }
        nodes.forEach(n=>{
          const att=(id,str)=>{
            const t=nodeMap.get(id); if(!t) return;
            const dx=t.x-n.x, dy=t.y-n.y, d=Math.sqrt(dx*dx+dy*dy)||1;
            const f=str*d*alpha;
            n.vx+=(dx/d)*f; n.vy+=(dy/d)*f;
            t.vx-=(dx/d)*f; t.vy-=(dy/d)*f;
          };
          n.links.forEach(l=>{ const w=(n.edgeWeights||{})[l]||1; att(l,0.018+w*0.007); });
          (n.tagLinks||[]).forEach(l=>att(l,0.012));
          if(n===dragging.current||n.pinned) return;
          n.vx+=(0-n.x)*0.006*alpha; n.vy+=(0-n.y)*0.006*alpha;
          // Sterke damping: 0.65 ipv 0.72 — nodes stoppen sneller
          n.vx*=0.65; n.vy*=0.65;
          n.x+=n.vx; n.y+=n.vy;
        });
        // Alpha sneller afkoelen: 0.91 ipv 0.94
        alphaRef.current = alpha * 0.91;
        dirtyRef.current = true;

        // Auto-fit + stop zodra stabiel
        const maxV = Math.max(...nodes.map(n => Math.abs(n.vx) + Math.abs(n.vy)));
        if (maxV < 0.3) {
          // Alles op nul zetten zodat er geen restvibratie is
          nodes.forEach(n => { n.vx = 0; n.vy = 0; });
          alphaRef.current = 0;
          if (!fitDoneRef.current) {
            fitDoneRef.current = true;
            fitToView();
          }
          dirtyRef.current = true;
        }
      }

      // Alleen hertekenen als er iets veranderd is (physics of gebruiker)
      if (!dirtyRef.current) {
        afRef.current = requestAnimationFrame(tick);
        return;
      }
      dirtyRef.current = false;

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
          const a=nodeMap.get(from), b=nodeMap.get(to);
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
          const t=nodeMap.get(id); if(!t) return;
          const sel=n.id===selectedId||t.id===selectedId||
                    n.id===hovering.current?.id||t.id===hovering.current?.id;
          const onPath=isOnPath(n.id,t.id);
          const w=(n.edgeWeights||{})[id]||1;

          // Bereken node-stralen zodat lijn stopt aan de rand van de node
          const totalLinksT=(t.linkCount||0)+(t.backCount||0)+(t.tagLinks||[]).length;
          const rT=t.type==="tag"?5:Math.max(6,Math.min(18,7+totalLinksT*1.5));
          const totalLinksN=(n.linkCount||0)+(n.backCount||0)+(n.tagLinks||[]).length;
          const rN=n.type==="tag"?5:Math.max(6,Math.min(18,7+totalLinksN*1.5));

          const dx=t.x-n.x, dy=t.y-n.y;
          const dist=Math.sqrt(dx*dx+dy*dy)||1;
          const ux=dx/dist, uy=dy/dist;

          // Start- en eindpunt aan de rand van de nodes
          const sx=n.x+ux*rN, sy=n.y+uy*rN;
          const ex=t.x-ux*(rT+2), ey=t.y-uy*(rT+2);

          // Lijnkleur en dikte
          let lineColor, lineWidth;
          ctx.setLineDash(dashed?[3/v.scale,5/v.scale]:[]);
          if(onPath){
            lineColor="#eae788"; lineWidth=3/v.scale; ctx.setLineDash([]);
          } else if(sel){
            lineColor=col; lineWidth=(1.5+w*0.5)/v.scale;
          } else {
            const alpha=w>=4?0.7:w>=3?0.55:0.38;
            const r2=parseInt(col.slice(1,3),16),g2=parseInt(col.slice(3,5),16),b2=parseInt(col.slice(5,7),16);
            lineColor=`rgba(${r2},${g2},${b2},${alpha})`;
            lineWidth=(0.8+w*0.4)/v.scale;
          }

          // Lijn
          ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);
          ctx.strokeStyle=lineColor; ctx.lineWidth=lineWidth;
          ctx.stroke(); ctx.setLineDash([]);

          // Pijlpunt (arrowhead) — alleen als afstand groot genoeg
          if(dist > rN+rT+8 && !dashed){
            const arrowSize=(sel||onPath?9:6)/v.scale;
            const angle=Math.atan2(uy,ux);
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex-arrowSize*Math.cos(angle-0.45), ey-arrowSize*Math.sin(angle-0.45));
            ctx.lineTo(ex-arrowSize*Math.cos(angle+0.45), ey-arrowSize*Math.sin(angle+0.45));
            ctx.closePath();
            ctx.fillStyle=lineColor;
            ctx.fill();
          }
        };
        // pathOnly: alleen pad-edges tekenen
        if(pathOnly && pathSet) {
          n.links.forEach(l=>{ if(pathSet.has(n.id)&&pathSet.has(l)) drawEdge(l,W.blue,false); });
          (n.tagLinks||[]).forEach(l=>{ if(pathSet.has(n.id)&&pathSet.has(l)) drawEdge(l,n.color||W.comment,true); });
        } else {
          n.links.forEach(l=>drawEdge(l,W.blue,false));
          (n.tagLinks||[]).forEach(l=>drawEdge(l,n.color||W.comment,true));
        }
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
        const isPathNode=pathSet?.has(n.id);
        const isLassoSel=lassoSel.has(n.id);
        // pathOnly: verberg alles behalve pad-nodes
        if(pathOnly && pathSet && !isPathNode && !sel) return;
        const dimmed=(hasSearch&&!isSearchHit&&!sel)||(pathOnly&&pathSet&&!isPathNode);

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
        // Lasso-selectie ring
        if(isLassoSel && !sel){
          ctx.beginPath();ctx.arc(n.x,n.y,r+5,0,Math.PI*2);
          ctx.strokeStyle="rgba(234,231,136,0.6)";ctx.lineWidth=1.5/v.scale;
          ctx.setLineDash([3/v.scale,2/v.scale]);ctx.stroke();ctx.setLineDash([]);
        }
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

      // Lasso rechthoek tekenen (screen space, buiten world transform)
      const lr = lassoRef.current;
      if (lr?.active && lr.x2 !== undefined) {
        const lx = Math.min(lr.x1, lr.x2), ly = Math.min(lr.y1, lr.y2);
        const lw = Math.abs(lr.x2 - lr.x1), lh = Math.abs(lr.y2 - lr.y1);
        ctx.save();
        ctx.strokeStyle="rgba(234,231,136,0.8)";
        ctx.fillStyle="rgba(234,231,136,0.07)";
        ctx.lineWidth=1.5; ctx.setLineDash([5,4]);
        ctx.strokeRect(lx, ly, lw, lh);
        ctx.fillRect(lx, ly, lw, lh);
        ctx.setLineDash([]); ctx.restore();
      }

      afRef.current=requestAnimationFrame(tick);
    };
    afRef.current=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(afRef.current);
  },[notes,selectedId,tagColors,hubMode,communityMode,pathFrom,pathTo,searchQ,scale,pathOnly]);

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
    dirtyRef.current = true;
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
      position:"absolute",
      top:"10px", left:"10px", bottom:"10px",  // top+bottom = betrouwbaar in Safari
      zIndex:10,
      width:"260px",
      display:"flex", flexDirection:"column",
      background:"rgba(28,28,28,0.92)",borderRadius:"8px",
      border:"1px solid rgba(255,255,255,0.1)",
      WebkitBackdropFilter:"blur(6px)",backdropFilter:"blur(6px)",
      // overflow op het element zelf — top+bottom geeft Safari de hoogte-context
      overflowY:"auto",
      WebkitOverflowScrolling:"touch",
      // Verberg de scrollbar maar behoud functie
      scrollbarWidth:"thin",
      scrollbarColor:"rgba(255,255,255,0.15) transparent",
    }},
    // Inner wrapper met padding — buiten overflow element zodat padding niet mee-scrollt
    React.createElement("div",{style:{
      padding:"10px 12px 16px",
      display:"flex", flexDirection:"column", gap:"6px",
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
         {label:"pad 🔍",     val:pathMode,       set:v=>{setPathMode(v);if(!v){setPathFrom(null);setPathTo(null);setPathResult(null);setPathOnly(false);}},col:W.yellow},
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
      // Uiteen / herstart knoppen
      React.createElement("div",{style:{display:"flex",gap:"5px",marginTop:"2px"}},
        React.createElement("button",{
          onClick:()=>{
            const target = lassoSel.size > 0 ? lassoSel
              : new Set(nodesRef.current.filter(n=>!n.pinned).map(n=>n.id));
            spreadSelected(target);
            if(lassoSel.size===0){
              nodesRef.current.forEach(n=>{
                if(n.pinned) return;
                const angle=Math.random()*Math.PI*2;
                const force=80+Math.random()*120;
                n.vx+=Math.cos(angle)*force; n.vy+=Math.sin(angle)*force;
              });
            }
          },
          title:lassoSel.size>0?`Spreid ${lassoSel.size} geselecteerde nodes uiteen`:"Schud alle nodes uiteen (Shift+sleep = lasso selectie)",
          style:{flex:1,background:lassoSel.size>0?"rgba(234,231,136,0.2)":"rgba(234,231,136,0.1)",
                 border:`1px solid ${lassoSel.size>0?"rgba(234,231,136,0.5)":"rgba(234,231,136,0.25)"}`,
                 color:W.yellow,borderRadius:"4px",padding:"3px 9px",fontSize:"12px",cursor:"pointer"}
        }, lassoSel.size>0 ? `\uD83D\uDCA5 spreid ${lassoSel.size}` : "\uD83D\uDCA5 uiteen"),
        React.createElement("button",{
          onClick:()=>{
            fitDoneRef.current=false;
            alphaRef.current=1.0;
            setLassoSel(new Set());
            const nodes=nodesRef.current;
            nodes.forEach((n,i)=>{
              if(n.pinned) return;
              const angle=(i/nodes.length)*Math.PI*2;
              const r=200+Math.random()*80;
              n.x=r*Math.cos(angle); n.y=r*Math.sin(angle);
              n.vx=(Math.random()-.5)*10; n.vy=(Math.random()-.5)*10;
            });
          },
          title:"Herstart de layout vanaf nul",
          style:{background:"rgba(229,120,109,0.08)",border:"1px solid rgba(229,120,109,0.2)",
                 color:W.orange,borderRadius:"4px",padding:"3px 9px",fontSize:"12px",cursor:"pointer"}
        },"\u21BA herstart")
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
        "scroll = zoom · alt+drag = pan · Shift+sleep = lasso · 2× klik = pin · rechtsklik = menu"
      ),

      // Pad-finder
      pathMode&&React.createElement("div",{style:{marginTop:"6px",borderTop:"1px solid rgba(255,255,255,0.08)",paddingTop:"8px"}},
        React.createElement("div",{style:{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px"}},
          React.createElement("div",{style:{fontSize:"11px",fontWeight:"600",color:W.yellow,letterSpacing:"0.8px"}},"PAD-FINDER — klik 2 nodes"),
          pathResult?.length>0&&React.createElement("button",{
            onClick:()=>setPathOnly(p=>!p),
            title:pathOnly?"Toon alle nodes":"Toon alleen het pad",
            style:{fontSize:"10px",padding:"2px 7px",borderRadius:"4px",cursor:"pointer",border:"none",
                   background:pathOnly?"rgba(234,231,136,0.25)":"rgba(255,255,255,0.07)",
                   color:pathOnly?W.yellow:W.fgMuted,fontWeight:pathOnly?"700":"400"}
          },pathOnly?"● alleen pad":"◎ toon alles")
        ),
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
        if(e.button===1||e.button===2||e.button===0&&e.altKey){
          // Panning: middenknop, rechterknop, alt+klik
          isPanning.current=true;
          panStart.current={x:sx,y:sy,ox:viewRef.current.ox,oy:viewRef.current.oy};
          e.preventDefault();
          return;
        }
        // Shift+klik op leeg canvas = start lasso selectie
        if(e.button===0&&e.shiftKey){
          const n=nodeAt(sx,sy);
          if(!n){
            lassoRef.current={active:true, x1:sx, y1:sy, x2:sx, y2:sy};
            dirtyRef.current=true;
            e.preventDefault();
            return;
          }
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
          dirtyRef.current = true;
          return;
        }
        // Lasso updaten
        if(lassoRef.current?.active){
          lassoRef.current.x2=sx; lassoRef.current.y2=sy;
          dirtyRef.current=true;
          return;
        }
        const n=nodeAt(sx,sy);
        if(n !== hovering.current) dirtyRef.current = true;
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
          dirtyRef.current = true;
        }
      },
      onMouseUp:e=>{
        // Lasso afronden — selecteer nodes in de rechthoek
        const lr=lassoRef.current;
        if(lr?.active){
          lr.active=false;
          const x1=Math.min(lr.x1,lr.x2), y1=Math.min(lr.y1,lr.y2);
          const x2=Math.max(lr.x1,lr.x2), y2=Math.max(lr.y1,lr.y2);
          const selected=new Set();
          nodesRef.current.forEach(n=>{
            const sc=toScreen(n.x,n.y);
            if(sc.x>=x1&&sc.x<=x2&&sc.y>=y1&&sc.y<=y2) selected.add(n.id);
          });
          lassoRef.current={active:false};
          dirtyRef.current=true;
          if(selected.size>0){
            setLassoSel(selected);
            // Spreid geselecteerde nodes meteen uiteen
            spreadSelected(selected);
          }
          return;
        }
        isPanning.current=false;
        const r=cvRef.current.getBoundingClientRect();
        const sx=e.clientX-r.left, sy=e.clientY-r.top;
        const n=nodeAt(sx,sy);
        if(n&&!dragging.current?.moved&&(n.type==="note"||n.type==="pdf"||n.type==="tag")){
          if(pathMode){
            if(!pathFrom){ setPathFrom(n.id);setPathTo(null);setPathResult(null);setPathOnly(false); }
            else if(!pathTo&&n.id!==pathFrom){
              setPathTo(n.id);
              setTimeout(()=>{
                const p=bfsPath(pathFrom,n.id);
                setPathResult(p||[]);
                if(p && p.length>0) setPathOnly(true); // automatisch alleen pad tonen
              },0);
            } else { setPathFrom(n.id);setPathTo(null);setPathResult(null);setPathOnly(false); }
          } else if(n.type!=="tag") { onSelect(n.id); }
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
