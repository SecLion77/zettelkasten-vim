// ── CalendarWidget ─────────────────────────────────────────────────────────────
// Mini-kalender voor de notitieslijst sidebar.
// Toont welke dagen een dagnotitie hebben; klik opent of maakt dagnotitie.
// Props: notes, onDailyNote(dateStr), onClose

const CalendarWidget = ({ notes = [], onDailyNote, onClose }) => {
  const { useState, useMemo } = React;
  const now   = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based

  // Verzamel datums met dagnotities — gebruik titel formaat
  const daysWithNotes = useMemo(() => {
    const set = new Set();
    for (const n of notes) {
      if (!n.tags?.includes("dagnotitie")) continue;
      // Probeer datum uit title: "maandag 22-3-2026" of "zondag 1-4-2026"
      const m = (n.title||"").match(/(\d{1,2})-(\d{1,2})-(\d{4})/);
      if (m) {
        const d = `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
        set.add(d);
      }
      // Fallback: created datum
      if (n.created) set.add(n.created.slice(0,10));
    }
    return set;
  }, [notes]);

  const daysInMonth = new Date(year, month+1, 0).getDate();
  const firstDay    = (new Date(year, month, 1).getDay() + 6) % 7; // maandag = 0
  const today       = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
  const MONTHS = ["januari","februari","maart","april","mei","juni",
                  "juli","augustus","september","oktober","november","december"];
  const DAYS   = ["Ma","Di","Wo","Do","Vr","Za","Zo"];

  const prevMonth = () => { if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); };
  const nextMonth = () => { if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); };

  const handleDay = (day) => {
    const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    onDailyNote?.(dateStr);
  };

  const S = {
    wrap: { background:W.bg2, border:`1px solid ${W.splitBg}`, borderRadius:"8px",
             padding:"10px 12px", margin:"6px 6px 0", flexShrink:0 },
    nav: { display:"flex", alignItems:"center", justifyContent:"space-between",
            marginBottom:"8px" },
    navBtn: { background:"none", border:"none", color:W.fgMuted, cursor:"pointer",
               fontSize:"14px", padding:"0 4px", lineHeight:1 },
    monthLabel: { fontSize:"12px", fontWeight:"600", color:W.statusFg },
    grid: { display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"2px" },
    dayHead: { fontSize:"9px", color:W.fgMuted, textAlign:"center",
                padding:"2px 0", letterSpacing:"0.3px" },
    day: (dateStr, isEmpty, isToday, hasNote) => ({
      fontSize:"11px", textAlign:"center", padding:"3px 0",
      borderRadius:"4px", cursor: isEmpty ? "default" : "pointer",
      color: isEmpty ? "transparent"
           : isToday ? W.bg
           : hasNote ? W.comment
           : W.fg,
      background: isToday ? W.blue
                : hasNote ? `${W.comment}25`
                : "transparent",
      fontWeight: isToday || hasNote ? "600" : "400",
      border: isToday ? "none"
            : hasNote ? `1px solid ${W.comment}40`
            : "1px solid transparent",
      transition:"all 0.1s",
    }),
    closeBtn: { float:"right", background:"none", border:"none", color:W.fgMuted,
                 cursor:"pointer", fontSize:"13px", padding:"0 0 0 4px" },
  };

  // Bouw kalender-cellen
  const cells = [];
  for (let i=0; i<firstDay; i++) cells.push(null); // lege cellen
  for (let d=1; d<=daysInMonth; d++) cells.push(d);

  return React.createElement("div", {style:S.wrap},
    // Navigatie
    React.createElement("div", {style:S.nav},
      React.createElement("button", {style:S.navBtn, onClick:prevMonth}, "‹"),
      React.createElement("span", {style:S.monthLabel}, `${MONTHS[month]} ${year}`),
      React.createElement("button", {style:S.navBtn, onClick:nextMonth}, "›"),
      React.createElement("button", {style:S.closeBtn, onClick:onClose, title:"Sluit kalender"}, "×"),
    ),

    // Dag-headers
    React.createElement("div", {style:S.grid},
      ...DAYS.map(d => React.createElement("div",{key:d,style:S.dayHead},d)),

      // Cellen
      ...cells.map((day, i) => {
        if (!day) return React.createElement("div",{key:`e${i}`,style:{...S.day("",true,false,false)}});
        const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
        const isToday = dateStr === today;
        const hasNote = daysWithNotes.has(dateStr);
        return React.createElement("div", {
          key:dateStr,
          style:S.day(dateStr, false, isToday, hasNote),
          onClick:()=>handleDay(day),
          title: hasNote ? `Dagnotitie ${day}-${month+1}-${year} openen`
                         : `Dagnotitie aanmaken voor ${day}-${month+1}-${year}`,
          onMouseEnter:e=>{if(!isToday)e.currentTarget.style.background=hasNote?`${W.comment}40`:"rgba(255,255,255,0.06)";},
          onMouseLeave:e=>{e.currentTarget.style.background=isToday?W.blue:hasNote?`${W.comment}25`:"transparent";},
        }, day);
      })
    )
  );
};
