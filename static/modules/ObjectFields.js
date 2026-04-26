// ── ObjectFields ───────────────────────────────────────────────────────────────
// Aanbeveling 5: type-specifieke gestructureerde velden per notitie
// Gebaseerd op noteType: boek, persoon, artikel, project, concept, tool
// Velden worden opgeslagen in frontmatter als fields.xxx: waarde
// Props: note, onSave

const OBJECT_SCHEMAS = {
  literature: {
    label: "Literatuurnotitie",
    icon:  "📖",
    hint:  "Brongebonden notitie — leg externe informatie vast in eigen woorden.",
    fields: [
      { key:"author",    label:"Auteur",      type:"text",   placeholder:"Naam auteur" },
      { key:"year",      label:"Jaar",         type:"number", placeholder:"2024" },
      { key:"source",    label:"Bron/Titel",   type:"text",   placeholder:"Boek, artikel, URL" },
      { key:"isbn",      label:"ISBN",         type:"text",   placeholder:"978-…" },
      { key:"rating",    label:"Beoordeling",  type:"select", options:["","⭐","⭐⭐","⭐⭐⭐","⭐⭐⭐⭐","⭐⭐⭐⭐⭐"] },
      { key:"status",    label:"Status",       type:"select", options:["","lezen","gelezen","referentie"] },
    ],
    usage: [
      "Gebruik [citaat]{.bron} voor directe aanhalingen",
      "Gebruik [inzicht]{.eigen} voor eigen interpretaties",
      "Promoveer rijpe inzichten naar permanente notities",
    ],
  },
  permanent: {
    label: "Permanente notitie",
    icon:  "💎",
    hint:  "Atomair, zelfstandig begrijpelijk — één idee per notitie.",
    fields: [
      { key:"concept",   label:"Kernbegrip",   type:"text",   placeholder:"Het centrale idee in één zin" },
      { key:"context",   label:"Domein",        type:"text",   placeholder:"Veld, vakgebied" },
      { key:"strength",  label:"Zekerheid",     type:"select", options:["","hypothese","aannemelijk","zeker"] },
    ],
    usage: [
      "Schrijf de titel als een volledige zin (stelling)",
      "Link naar bronnotities via [[Titel]]",
      "Voeg toe aan een index-notitie als de notitie rijp is",
    ],
  },
  fleeting: {
    label: "Vluchtige notitie",
    icon:  "⚡",
    hint:  "Snelle capture — verwerk binnen 2 dagen naar literatuur of permanent.",
    fields: [
      { key:"context",   label:"Context",      type:"text",   placeholder:"Waar/wanneer bezonnen" },
      { key:"next",      label:"Volgende stap", type:"select", options:["","uitwerken","linken","verwijderen","promoveren"] },
    ],
    usage: [
      "Verwerk vluchtige notities regelmatig (inbox-review)",
      "Gebruik de Review-tab voor spaced repetition",
      "Promoveer via de 'Promoveer' knop als rijp",
    ],
  },
  index: {
    label: "Index / MOC",
    icon:  "🗺",
    hint:  "Map of Content — navigatienotitie die andere notities ordent.",
    fields: [
      { key:"scope",     label:"Scope",        type:"text",   placeholder:"Onderwerp of domein" },
      { key:"audience",  label:"Doelgroep",    type:"text",   placeholder:"Voor wie?" },
      { key:"maturity",  label:"Rijpheid",     type:"select", options:["","groeiend","stabiel","archief"] },
    ],
    usage: [
      "Gebruik als startpunt voor een thema of project",
      "Link alle relevante permanente notities hiervandaan",
      "Houd de index actueel door nieuwe notities toe te voegen",
    ],
  },
};

const ObjectFields = ({ note, onSave }) => {
  const { useState, useEffect } = React;
  const schema = OBJECT_SCHEMAS[note?.noteType];

  // Lees bestaande field-waarden uit note.fields (object in frontmatter)
  const [vals, setVals] = useState(() => note?.fields || {});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setVals(note?.fields || {});
  }, [note?.id]);

  if (!note || !schema) return null;

  const handleChange = (key, val) => {
    setVals(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    const updated = { ...note, fields: vals, modified: new Date().toISOString() };
    await onSave?.(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const S = {
    wrap:    { padding:"14px 12px", borderTop:`1px solid ${W.splitBg}` },
    header:  { display:"flex", alignItems:"center", gap:"6px", marginBottom:"10px" },
    icon:    { fontSize:"16px" },
    label:   { fontSize:"11px", fontWeight:"700", color:W.statusFg },
    hint:    { fontSize:"10px", color:W.fgMuted, marginBottom:"10px", lineHeight:"1.5" },
    field:   { marginBottom:"8px" },
    flabel:  { fontSize:"9px", color:W.fgMuted, letterSpacing:"0.5px",
               textTransform:"uppercase", marginBottom:"3px" },
    input:   { width:"100%", background:W.bg, border:`1px solid ${W.splitBg}`,
               borderRadius:"4px", padding:"4px 8px", color:W.fg, fontSize:"12px",
               outline:"none", fontFamily:"inherit" },
    select:  { width:"100%", background:W.bg, border:`1px solid ${W.splitBg}`,
               borderRadius:"4px", padding:"4px 6px", color:W.fg, fontSize:"12px",
               outline:"none", cursor:"pointer" },
    saveBtn: { width:"100%", marginTop:"10px", padding:"5px 0",
               background:saved ? `${W.comment}22` : "rgba(255,255,255,0.05)",
               border:`1px solid ${saved ? W.comment+"55" : W.splitBg}`,
               borderRadius:"5px", color: saved ? W.comment : W.fgMuted,
               fontSize:"11px", cursor:"pointer", transition:"all 0.2s" },
    usageWrap: { marginTop:"12px", borderTop:`1px solid ${W.splitBg}`, paddingTop:"10px" },
    usageTitle: { fontSize:"9px", color:W.fgMuted, letterSpacing:"0.5px",
                  textTransform:"uppercase", marginBottom:"6px" },
    usageItem: { fontSize:"10px", color:W.fgDim, lineHeight:"1.6",
                 paddingLeft:"8px", borderLeft:`2px solid ${W.splitBg}`,
                 marginBottom:"4px" },
  };

  return React.createElement("div", { style:S.wrap },
    // Header
    React.createElement("div", { style:S.header },
      React.createElement("span", { style:S.icon }, schema.icon),
      React.createElement("span", { style:S.label }, schema.label),
    ),
    React.createElement("div", { style:S.hint }, schema.hint),

    // Velden
    ...schema.fields.map(f =>
      React.createElement("div", { key:f.key, style:S.field },
        React.createElement("div", { style:S.flabel }, f.label),
        f.type === "select"
          ? React.createElement("select", {
              value: vals[f.key] || "",
              onChange: e => handleChange(f.key, e.target.value),
              style: S.select,
            },
              f.options.map(o => React.createElement("option", { key:o, value:o }, o || "— geen —"))
            )
          : React.createElement("input", {
              type: f.type || "text",
              value: vals[f.key] || "",
              onChange: e => handleChange(f.key, e.target.value),
              placeholder: f.placeholder || "",
              style: S.input,
              onKeyDown: e => { if ((e.ctrlKey||e.metaKey) && e.key==="s") handleSave(); }
            })
      )
    ),

    // Opslaan
    React.createElement("button", { onClick:handleSave, style:S.saveBtn },
      saved ? "✓ Opgeslagen" : "Velden opslaan"
    ),

    // Gebruikstips
    React.createElement("div", { style:S.usageWrap },
      React.createElement("div", { style:S.usageTitle }, "💡 Hoe te gebruiken"),
      ...schema.usage.map((tip, i) =>
        React.createElement("div", { key:i, style:S.usageItem }, tip)
      )
    )
  );
};
