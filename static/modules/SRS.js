// ── SRS: gedeelde spaced-repetition-engine (FSRS-4.5) ───────────────────────
// Vervangt de twee losstaande, bijna-identieke SM-2-implementaties die eerder
// in DailyView.js (store: sr_data) en ReviewPanel.js (store: review_data)
// zaten. Beide bestanden gebruiken nu deze ene module en dezelfde store
// (sr_data) — een notitie gemarkeerd voor review verschijnt overal.
//
// Algoritme: FSRS-4.5 (Free Spaced Repetition Scheduler), publieke formules
// en default-parameters. Bron: open-spaced-repetition/fsrs4anki (zie ook
// https://borretti.me/article/implementing-fsrs-in-100-lines voor een
// heldere doorloop van dezelfde formules). Dit is de kleine, niet-
// geoptimaliseerde variant: de default-parameters zijn getraind op een
// brede dataset van Anki-reviews en zijn niet per-vault bijgesteld — voor
// persoonlijk gebruik ruim voldoende, en altijd beter dan SM-2's vaste
// ease-factor die vooral omlaag kan bewegen.
//
// Cijfers (grade), consistent gebruikt in DailyView.js en ReviewPanel.js:
//   1 = vergeten   (Again)
//   2 = moeite      (Hard)
//   3 = goed        (Good)
//   4 = makkelijk   (Easy)
//
// sr_data[noteId]-schema (grotendeels intact t.o.v. de oude SM-2-kaarten):
//   due          — ISO-datum (YYYY-MM-DD), wanneer de volgende review moet
//   lastReview   — ISO-datum van de laatste review
//   lastRating   — laatst gegeven cijfer (1-4)
//   stability    — FSRS-stabiliteit in dagen (vervangt interval/ease)
//   difficulty   — FSRS-moeilijkheid, 1 (makkelijkst) – 10 (moeilijkst)
//   reps         — aantal reviews (vervangt repetitions)
//   lapses       — aantal keer "vergeten"
//   algo         — "fsrs-4.5", aanwezig zodra een kaart gemigreerd is

const SRS = {
  ALGO: "fsrs-4.5",
  // 19 default-parameters (w0..w18), publieke FSRS-4.5-waarden.
  W: [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
      0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621],
  F: 19 / 81,   // schaalconstante in de retrievability-curve
  C: -0.5,      // exponent in de retrievability-curve
  REQUEST_RETENTION: 0.9, // doel-retentie (R_d) waarop intervallen gepland worden

  // ── Kernformules ──────────────────────────────────────────────────────
  retrievability(t, s) {
    if (!s || s <= 0) return 0;
    return Math.pow(1 + this.F * (t / s), this.C);
  },
  intervalDays(s) {
    const rd = this.REQUEST_RETENTION;
    return (s / this.F) * (Math.pow(rd, 1 / this.C) - 1);
  },
  clampD(d) { return Math.max(1, Math.min(10, d)); },
  d0(g) { return this.clampD(this.W[4] - Math.exp(this.W[5] * (g - 1)) + 1); },
  s0(g) { return this.W[g - 1]; }, // g=1..4 → W[0..3]

  sSuccess(d, s, r, g) {
    const td = 11 - d;
    const ts = Math.pow(s, -this.W[9]);
    const tr = Math.exp(this.W[10] * (1 - r)) - 1;
    const h  = g === 2 ? this.W[15] : 1; // Hard-penalty
    const b  = g === 4 ? this.W[16] : 1; // Easy-bonus
    const c  = Math.exp(this.W[8]);
    const alpha = 1 + td * ts * tr * h * b * c;
    return s * alpha;
  },
  sFail(d, s, r) {
    const df  = Math.pow(d, -this.W[12]);
    const sf  = Math.pow(s + 1, this.W[13]) - 1;
    const rf  = Math.exp(this.W[14] * (1 - r));
    const val = df * sf * rf * this.W[11];
    return Math.min(val, s); // stabiliteit na falen kan nooit toenemen
  },
  difficulty(d, g) {
    const deltaD = -this.W[6] * (g - 3);
    const dp = d + deltaD * ((10 - d) / 9);
    return this.clampD(this.W[7] * this.d0(4) + (1 - this.W[7]) * dp);
  },

  // ── Kaart bijwerken na een review ────────────────────────────────────
  // card: bestaande sr_data-kaart (of leeg/undefined voor een nieuwe notitie)
  // grade: 1..4
  next(card, grade) {
    const g = Math.max(1, Math.min(4, Math.round(grade)));
    const now    = new Date();
    const nowStr = now.toISOString().slice(0, 10);
    let stability, difficulty;

    if (!card || !card.stability) {
      // Eerste review van deze kaart
      stability  = this.s0(g);
      difficulty = this.d0(g);
    } else {
      // Defensief: een beschadigde/handmatig bewerkte kaart kan wel
      // stability maar geen difficulty hebben (of omgekeerd) — val terug op
      // een neutrale waarde in plaats van NaN te laten doorsijpelen.
      const curD = card.difficulty || this.d0(3);
      const last = new Date(card.lastReview || nowStr);
      const t    = Math.max(0, Math.round((now - last) / 86400000));
      const r    = this.retrievability(t, card.stability);
      stability  = g === 1
        ? this.sFail(curD, card.stability, r)
        : this.sSuccess(curD, card.stability, r, g);
      difficulty = this.difficulty(curD, g);
    }

    const days = Math.max(1, Math.round(this.intervalDays(stability)));
    const due  = new Date(); due.setDate(due.getDate() + days);

    return {
      algo:       this.ALGO,
      stability:  Math.round(stability * 1000) / 1000,
      difficulty: Math.round(difficulty * 1000) / 1000,
      reps:       (card?.reps || 0) + 1,
      lapses:     (card?.lapses || 0) + (g === 1 ? 1 : 0),
      due:        due.toISOString().slice(0, 10),
      lastReview: nowStr,
      lastRating: g,
    };
  },

  // Voorspel het label ("→ 6d") voor een cijfer, zonder de kaart echt te
  // updaten — voor de knop-previews in de review-UI.
  previewLabel(card, grade) {
    const n = this.next(card, grade);
    const days = Math.max(1, Math.round(
      (new Date(n.due) - new Date(new Date().toISOString().slice(0, 10))) / 86400000
    ));
    return this.intervalLabel(days);
  },

  // ── Migratie: oude SM-2-kaart (interval/ease/repetitions) → FSRS ──────
  // Behoudt de due-datum (geen reviews vervroegen door de migratie); schat
  // een startpunt voor stability/difficulty op basis van de oude
  // ease-factor, zodat de eerstvolgende FSRS-review een redelijke basis
  // heeft in plaats van bij nul te beginnen.
  migrateCard(card) {
    if (!card || card.algo === this.ALGO) return card; // al gemigreerd, of leeg
    const ease       = card.ease || 2.5;
    const stability   = Math.max(0.5, card.interval || 1);
    const difficulty  = this.clampD(11 - ease * 3); // hoge ease → lage moeilijkheid
    return {
      algo: this.ALGO, stability, difficulty,
      reps: card.repetitions || 0, lapses: 0,
      // Defensief: een kaart zonder due (bv. handmatig bewerkt config.json)
      // mag niet stil uit de review-wachtrij verdwijnen — val terug op vandaag.
      due: card.due || new Date().toISOString().slice(0, 10),
      lastReview: card.lastReview, lastRating: card.lastRating,
    };
  },

  // ── Opslag ────────────────────────────────────────────────────────────
  async load() {
    try {
      const d   = await fetch("/api/config").then(r => r.json());
      const cfg = d.config || {};
      let sr = { ...(cfg.sr_data || {}) };
      let changed = false;

      // Eenmalige migratie: notities die alleen in het oude, losstaande
      // review_data-systeem (ReviewPanel) gemarkeerd waren, overnemen als
      // ze nog niet in sr_data staan.
      const legacy = cfg.review_data || {};
      Object.keys(legacy).forEach(id => {
        if (!sr[id]) { sr[id] = legacy[id]; changed = true; }
      });

      // Alle SM-2-vormige kaarten (oud, of net overgenomen) migreren naar
      // het FSRS-schema.
      Object.keys(sr).forEach(id => {
        const migrated = this.migrateCard(sr[id]);
        if (migrated !== sr[id]) { sr[id] = migrated; changed = true; }
      });

      if (changed) await this.save(sr);
      return sr;
    } catch { return {}; }
  },
  async save(srData) {
    try {
      await fetch("/api/config", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sr_data: srData }),
      });
    } catch {}
  },

  dueToday(notes, srData) {
    const t = new Date().toISOString().slice(0, 10);
    return notes.filter(n => { const d = srData[n.id]; return d?.due && d.due <= t; })
      .sort((a, b) => (srData[a.id]?.due || "").localeCompare(srData[b.id]?.due || ""));
  },
  intervalLabel(days) {
    if (!days) return "";
    if (days === 1) return "morgen";
    if (days < 7)   return `${days}d`;
    if (days < 30)  return `${Math.round(days / 7)}w`;
    return `${Math.round(days / 30)}m`;
  },
};
