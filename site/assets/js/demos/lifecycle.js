/* Demo "lifecycle": age slider (mod years / world days), life stages and the energy + frenzy toy.
   Concept demo, not real gameplay. Spec: SPEC section 4 (time and age, stages), section 9 (energy and frenzy),
   docs/18 (life stages), specs/behaviors/05 (FRENZY_STARTED, FRENZY_ENDED, ENERGY_DEBT). Numbers marked demo are stand-ins. */
(function (root) {
  "use strict";
  var D = root.SPDemos; if (!D) return;
  var t = D.t, h = D.h, ui = D.ui, PAL = D.palette;

  var DAYS_PER_YEAR = 10;                      // SPEC 4 [T/O]
  var K = { frenzyAt: 130, maxE: 140, minFrenzy: 3, maxFrenzy: 8, exitAt: 85, drain: 14, sleepSecs: 4, wakeAt: 25 }; // demo values
  var CAP = { puppy: { cap: 60, rech: 1.5 }, adolescent: { cap: 120, rech: 1 }, adult: { cap: 100, rech: 1 }, senior: { cap: 70, rech: 0.8 } }; // demo capacities (relative)
  var ACT = { walk: 10, play: 18, rest: 15, build: 20, sleep: 40 }; // demo energy units

  function stageOf(age, life) {
    if (age < 1) return "puppy";
    if (age < 2) return "adolescent";
    if (age < 0.75 * life) return "adult";
    return "senior";
  }
  function stageBounds(life) { return { puppy: [0, 1], adolescent: [1, 2], adult: [2, 0.75 * life], senior: [0.75 * life, life] }; }
  function ageDays(prev, today, birth) { return Math.max(prev, today - birth); }

  /* ---------- energy / frenzy simulation (pure) ---------- */
  function createEnergy(opts) {
    var emit = (opts && opts.emit) || function () {};
    var st = { stage: (opts && opts.stage) || "adult", e: 60, frenzy: false, ft: 0, asleep: 0, debt: false };
    function ev(tag, key, fb, vars) { emit({ tag: tag, key: key, fb: fb, vars: vars }); }
    function pct(units) { return units * 100 / CAP[st.stage].cap; }
    function clampStart() {
      if (st.e > K.maxE) st.e = K.maxE;
      if (st.e >= K.frenzyAt && !st.frenzy && !st.asleep) startFrenzy();
    }
    function startFrenzy() {
      st.frenzy = true; st.ft = 0;
      ev("FRENZY_STARTED", "demos.life.ev.frenzyStart", "Energy overflowed past {p}%: zoomies begin.", { p: Math.round(st.e) });
    }
    var api = {
      st: st, K: K,
      setStage: function (s) { st.stage = s; },
      act: function (name) {
        if (st.asleep > 0) return "asleep";
        if (st.frenzy && name !== "force") return "frenzy";
        var u = ACT[name];
        if (name === "walk" || name === "play") st.e -= pct(u);
        else if (name === "rest") st.e += pct(u) * CAP[st.stage].rech;
        else if (name === "sleep") st.e += pct(u) * CAP[st.stage].rech;
        else if (name === "build") st.e += pct(u);
        else if (name === "force") { if (!st.frenzy) { startFrenzy(); } }
        if (st.e < 0 && !st.frenzy) { /* debt only arises from a frenzy; plain activity floors at 0 */ st.e = 0; }
        if (name !== "force") clampStart();
        return "ok";
      },
      tick: function (dt) {
        if (st.asleep > 0) {
          st.asleep -= dt; st.e += (K.wakeAt - st.e) * Math.min(1, dt / 1.5);
          if (st.asleep <= 0) { st.asleep = 0; st.e = K.wakeAt; st.debt = false; ev("WOKE_UP", "demos.life.ev.woke", "Rex wakes up rested. No damage taken.", null); }
          return;
        }
        if (st.frenzy) {
          st.ft += dt; st.e -= K.drain * dt;
          var done = st.ft >= K.minFrenzy && (st.e <= K.exitAt || st.ft >= K.maxFrenzy || st.e < 0);
          if (done) {
            st.frenzy = false;
            ev("FRENZY_ENDED", "demos.life.ev.frenzyEnd", "The frenzy ends after {s} s at {p}% energy.", { s: st.ft.toFixed(1), p: Math.round(st.e) });
            if (st.e < 0) {
              st.debt = true; st.asleep = K.sleepSecs;
              ev("ENERGY_DEBT", "demos.life.ev.debt", "Energy went below 0%: Rex collapses asleep (no damage).", null);
            }
          }
        }
      }
    };
    return api;
  }

  D.lib.lifecycle = { stageOf: stageOf, stageBounds: stageBounds, ageDays: ageDays, createEnergy: createEnergy, K: K, CAP: CAP, DAYS_PER_YEAR: DAYS_PER_YEAR };

  /* ---------- UI ---------- */
  function stageName(s) {
    return s === "puppy" ? t("demos.life.stage.puppy", "Puppy") : s === "adolescent" ? t("demos.life.stage.adolescent", "Adolescent")
      : s === "adult" ? t("demos.life.stage.adult", "Adult") : t("demos.life.stage.senior", "Senior");
  }
  var LISTS = {
    puppy: {
      can: [["demos.life.puppy.c1", "Follows you closely and learns its name"], ["demos.life.puppy.c2", "Learns sit and simple tricks, and learns fast"], ["demos.life.puppy.c3", "Plays; energy comes in short bursts"], ["demos.life.puppy.c4", "Sleeps a lot"]],
      no: [["demos.life.puppy.n1", "Cannot fight, go far, or use \"go home\""], ["demos.life.puppy.n2", "Cannot dig, wear armor or have puppies"], ["demos.life.puppy.n3", "Suffers if left alone too long"]]
    },
    adolescent: {
      can: [["demos.life.adol.c1", "Tier 1 skills and basic combat (with risk)"], ["demos.life.adol.c2", "Explores nearby; learns well but unevenly"], ["demos.life.adol.c3", "Large energy pool"]],
      no: [["demos.life.adol.n1", "Stubborn: obedience sometimes regresses"], ["demos.life.adol.n2", "No full tier 2/3, long expeditions, leading or puppies"]]
    },
    adult: {
      can: [["demos.life.adult.c1", "All skill trees, including legend skills"], ["demos.life.adult.c2", "Can lead, wear armor, go on expeditions, use \"go home\""], ["demos.life.adult.c3", "Can have puppies (from 2 years, until senior)"], ["demos.life.adult.c4", "Senses at their peak; stable, predictable temperament"]],
      no: [["demos.life.adult.n1", "Vices still change with training, only slowly"]]
    },
    senior: {
      can: [["demos.life.senior.c1", "Keeps everything it already knows"], ["demos.life.senior.c2", "Advises the pack, calms puppies, waits at the door"], ["demos.life.senior.c3", "Calm and more affectionate"]],
      no: [["demos.life.senior.n1", "Learns new things slowly; no heavy combat or long trips"], ["demos.life.senior.n2", "Smell and hearing fade; home range shrinks"], ["demos.life.senior.n3", "No puppies; leadership passes on"]]
    }
  };
  var SCAP = { puppy: ["demos.life.cap.puppy", "small pool, fast recharge"], adolescent: ["demos.life.cap.adol", "large pool"], adult: ["demos.life.cap.adult", "medium pool"], senior: ["demos.life.cap.senior", "small pool"] };

  var SW = 96, SH = 40, GY = 32;

  D.register("lifecycle", function (el, ctx) {
    var life = 12, age = 0.5, frame = 0, now = 0, dogX = 36, dir = 1, shown = null;
    var birth = 100, today = 140, prev = 0;
    var ageId = ctx.id + "-age", lifeId = ctx.id + "-life";

    el.appendChild(ui.header(ctx, ["demos.life.title", "Life stages and energy"],
      ["demos.life.blurb", "Drag the age and see how the design changes a dog over its life. Below, try the energy toy: energy can overflow past 100%, which triggers a frenzy, and overspending ends in a harmless collapse into sleep."]));

    var status = ui.status(ctx), log = ui.log(ctx, 8);
    var canvas = h("canvas", { class: "spd-canvas spd-scene", role: "img" });
    var wrap = h("div", { class: "spd-canvas-wrap spd-scene-wrap" }, [canvas]);
    var g = ctx.fit(canvas, SW, SH, 7);

    var energy = createEnergy({ stage: "puppy", emit: function (e) {
      log.add("event", e.tag, [e.key, e.fb, e.vars]); status.set(e.key, e.fb, e.vars);
      if (e.tag === "WOKE_UP") dogX = 36;
      updateEnergyUI();
    } });

    /* controls: lifespan + age */
    var lifeSel = h("select", { class: "spd-select", id: lifeId, onchange: function () { life = +this.value; setAge(Math.min(age, life), true); renderTimeline(); } });
    for (var y = 8; y <= 16; y++) lifeSel.appendChild(h("option", { value: y, text: String(y) }));
    lifeSel.value = String(life);
    var ageIn = h("input", { type: "range", class: "spd-range", id: ageId, min: 0, max: life * 10, step: 1, value: age * 10, oninput: function () { setAge(+this.value / 10, false); } });
    var readout = h("div", { class: "spd-readout spd-age-readout", "aria-live": "polite" });
    var timeline = h("div", { class: "spd-timeline", role: "img" });
    var marker = h("span", { class: "spd-marker" });
    timeline.appendChild(marker);
    var tlTexts = {};

    var chips = h("div", { class: "spd-row spd-chips" });
    ["puppy", "adolescent", "adult", "senior"].forEach(function (s) {
      var b = h("button", { type: "button", class: "mc-btn spd-btn spd-chip", onclick: function () { setAge(Math.ceil(stageBounds(life)[s][0] * 10 - 1e-9) / 10, true); } });
      ctx.bind(b, function () { return stageName(s); });
      chips.appendChild(b); tlTexts[s] = b;
    });

    var listCan = h("ul", { class: "spd-list spd-list-can" }), listNo = h("ul", { class: "spd-list spd-list-no" });
    var canTitle = h("h4", { class: "spd-card-title" }); ctx.tx(canTitle, "demos.life.can", "What it can do now");
    var noTitle = h("h4", { class: "spd-card-title" }); ctx.tx(noTitle, "demos.life.cannot", "Limits at this age");
    var capLine = h("p", { class: "spd-readout" });
    var stageBadge = h("span", { class: "mc-badge mc-badge--done spd-stage-badge" });

    function renderLists() {
      var st = stageOf(age, life), L = LISTS[st];
      [[listCan, L.can], [listNo, L.no]].forEach(function (p) {
        while (p[0].firstChild) p[0].removeChild(p[0].firstChild);
        p[1].forEach(function (it) { p[0].appendChild(h("li", { text: t(it[0], it[1]) })); });
      });
      capLine.textContent = t("demos.life.capLabel", "Energy capacity: {c}", { c: t(SCAP[st][0], SCAP[st][1]) });
      stageBadge.textContent = stageName(st);
    }
    function renderReadout() {
      var st = stageOf(age, life), b = stageBounds(life)[st];
      var days = Math.round(age * DAYS_PER_YEAR);
      readout.textContent = t("demos.life.readout", "Age {y} mod years = {d} world days. Stage: {s} ({from} to {to} years, days {df} to {dt}).",
        { y: age.toFixed(1), d: days, s: stageName(st), from: +b[0].toFixed(1), to: +b[1].toFixed(1), df: Math.round(b[0] * 10), dt: Math.round(b[1] * 10) });
    }
    function renderTimeline() {
      var bd = stageBounds(life);
      Array.prototype.slice.call(timeline.querySelectorAll(".spd-seg")).forEach(function (n) { n.remove(); });
      ["puppy", "adolescent", "adult", "senior"].forEach(function (s) {
        var w = (bd[s][1] - bd[s][0]) / life * 100;
        var seg = h("span", { class: "spd-seg spd-seg-" + s, style: "width:" + w + "%" });
        seg.textContent = w > 12 ? stageName(s) : "";
        timeline.insertBefore(seg, marker);
      });
      ageIn.max = life * 10;
      timeline.setAttribute("aria-label", t("demos.life.timelineAria", "Life timeline for a {y}-year lifespan ({d} world days)", { y: life, d: life * 10 }));
    }
    function setAge(v, fromChip) {
      age = Math.max(0, Math.min(life, v)); ageIn.value = Math.round(age * 10);
      marker.style.left = (age / life * 100) + "%";
      var st = stageOf(age, life);
      if (st !== shown) {
        shown = st; energy.setStage(st); renderLists();
        if (fromChip || true) status.set("demos.life.stageNow", "Stage: {s}.", { s: stageName(st) });
      }
      renderReadout(); updateEnergyUI();
    }

    /* energy toy */
    var eBar = h("span", { class: "spd-ebar-fill" }), eOver = h("span", { class: "spd-ebar-over" });
    var eTrack = h("div", { class: "mc-xp spd-ebar", role: "meter", "aria-valuemin": 0, "aria-valuemax": 140 }, [eBar, eOver, h("i", { class: "spd-ebar-100" })]);
    var eVal = h("span", { class: "spd-meter-val" });
    var eLab = h("span", { class: "spd-meter-label" }); ctx.tx(eLab, "demos.life.energy", "Energy (% of capacity; the line marks 100%)");
    var eAria = ctx.bind(eTrack, function () { return t("demos.life.energyAria", "Energy {p} percent", { p: Math.round(energy.st.e) }); }, "aria-label");
    function updateEnergyUI() {
      var e = energy.st.e;
      eTrack.setAttribute("aria-valuenow", Math.round(e));
      eBar.style.width = (Math.max(0, Math.min(100, e)) / K.maxE * 100) + "%";
      eOver.style.left = (100 / K.maxE * 100) + "%";
      eOver.style.width = (Math.max(0, e - 100) / K.maxE * 100) + "%";
      eVal.textContent = Math.round(e) + "%" + (e < 0 ? " (" + t("demos.life.debt", "debt") + ")" : "");
      eTrack.classList.toggle("spd-ebar--hot", e > 100);
      eAria();
    }
    function act(name) {
      var r = energy.act(name);
      if (r === "asleep") status.set("demos.life.isAsleep", "Rex is fast asleep. Wait for him to wake.");
      else if (r === "frenzy") status.set("demos.life.inFrenzy", "Rex is in a frenzy; he cannot be given anything to do until it ends.");
      else {
        var key = { walk: ["demos.life.did.walk", "A walk costs energy."], play: ["demos.life.did.play", "Play costs energy."], rest: ["demos.life.did.rest", "Rest restores energy."],
          sleep: ["demos.life.did.sleep", "A nap restores a lot of energy."], build: ["demos.life.did.build", "Energy builds up with nothing to spend it on."], force: ["demos.life.did.force", "Frenzy forced for its minimum duration."] }[name];
        status.set(key[0], key[1]);
      }
      updateEnergyUI();
    }
    var eRow = h("div", { class: "spd-row" }, [
      ui.button(ctx, ["demos.life.btnWalk", "Walk"], function () { act("walk"); }),
      ui.button(ctx, ["demos.life.btnPlay", "Play"], function () { act("play"); }),
      ui.button(ctx, ["demos.life.btnRest", "Rest"], function () { act("rest"); }),
      ui.button(ctx, ["demos.life.btnSleep", "Nap"], function () { act("sleep"); }),
      ui.button(ctx, ["demos.life.btnBuild", "Pen him in (+energy)"], function () { act("build"); }, "mc-btn--green"),
      ui.button(ctx, ["demos.life.btnForce", "Force frenzy"], function () { act("force"); })]);

    /* age rule panel */
    var rule = h("pre", { class: "mc-code spd-rule", "aria-live": "polite" });
    function renderRule() {
      var raw = today - birth, res = ageDays(prev, today, birth);
      rule.textContent = t("demos.life.rule", "age_days = max(previous, today - birth)\n          = max({p}, {t} - {b})\n          = max({p}, {r}) = {res} days", { p: prev, t: today, b: birth, r: raw, res: res });
    }
    function clock(delta) {
      today = Math.max(0, today + delta);
      var res = ageDays(prev, today, birth);
      var back = delta < 0;
      prev = res; renderRule();
      if (back) status.set("demos.life.rewound", "The world clock went back {d} days, but age never decreases: it stays {a} days.", { d: -delta, a: res });
      else status.set("demos.life.advanced", "The world moved forward {d} day(s): age is now {a} days.", { d: delta, a: res });
    }
    var ruleRow = h("div", { class: "spd-row" }, [
      ui.button(ctx, ["demos.life.plus1", "+1 day"], function () { clock(1); }),
      ui.button(ctx, ["demos.life.plus10", "+10 days (1 mod year)"], function () { clock(10); }),
      ui.button(ctx, ["demos.life.rewind", "Rewind clock 30 days (/time set)"], function () { clock(-30); })]);
    var ruleTitle = h("h4", { class: "spd-card-title" }); ctx.tx(ruleTitle, "demos.life.ruleTitle", "How age is counted");
    var ruleNote = h("p", { class: "spd-readout" }); ctx.tx(ruleNote, "demos.life.ruleNote", "Demo birth day: 100. 1 mod year = 10 world days. There is no clock of its own; age follows the world's day counter, and never goes backwards.");

    var ageField = ui.field(ctx, ageId, ["demos.life.ageLabel", "Age (mod years)"], ageIn);
    var lifeField = ui.field(ctx, lifeId, ["demos.life.lifespanLabel", "Lifespan gene (mod years)"], lifeSel);
    var left = h("div", { class: "spd-main" }, [wrap, h("div", { class: "spd-row spd-row-sliders" }, [ageField, lifeField]), chips, timeline, readout, stageBadge]);
    var right = h("div", { class: "mc-panel mc-panel--dark spd-side" }, [canTitle, listCan, noTitle, listNo, capLine]);
    el.appendChild(h("div", { class: "spd-train-grid" }, [left, right]));

    var eTitle = h("h4", { class: "spd-card-title" }); ctx.tx(eTitle, "demos.life.energyTitle", "Energy and frenzy toy");
    el.appendChild(h("div", { class: "mc-panel spd-card" }, [eTitle, h("div", { class: "spd-metric" }, [h("div", { class: "spd-metric-head" }, [eLab, eVal]), eTrack]), eRow, status.el, log.el]));
    el.appendChild(h("div", { class: "mc-panel spd-card" }, [ruleTitle, rule, ruleRow, ruleNote]));
    el.appendChild(h("p", { class: "spd-foot" }, [(function () { var sp = h("span"); ctx.tx(sp, "demos.life.foot", "Demo values: stage limits follow the current proposals (1 year, 2 years, last 25% of life); energy numbers, capacities and frenzy timing are stand-ins to be tuned by playtesting."); return sp; })()]));

    ctx.onLang(function () { renderLists(); renderReadout(); renderTimeline(); renderRule(); updateEnergyUI(); });
    renderTimeline(); setAge(age, false); renderRule(); updateEnergyUI();

    function draw() {
      var reduced = ctx.reduced(), s = energy.st, st = stageOf(age, life);
      D.drawBackdrop(g, SW, SH, GY, "outdoor");
      var pose = s.asleep > 0 ? "sleep" : s.frenzy ? "frenzy" : (frame % 40 < 28 ? "stand" : "sit");
      if (reduced && !s.frenzy && !s.asleep) pose = "stand";
      var flip = dir < 0;
      if (s.frenzy && !reduced) {
        dogX += dir * 5;
        if (dogX > SW - 26) { dogX = SW - 26; dir = -1; } else if (dogX < 2) { dogX = 2; dir = 1; }
      } else if (!s.frenzy) { dogX = 36; dir = 1; flip = false; }
      var fr = reduced ? 0 : s.frenzy ? frame & 1 : (frame >> 1) & 1;
      D.drawDog(g, { base: "red", patterns: { chest: true, socks: true, blaze: true }, seed: 9, stage: st, pose: pose, mood: s.asleep > 0 ? "neutral" : "happy", x: Math.round(dogX), y: GY - 16, scale: 1, flip: flip, frame: fr, shadow: true });
      if (s.asleep > 0) D.drawIcon(g, "zzz", Math.round(dogX) + 14, GY - 28 - (reduced ? 0 : (frame >> 1) & 1), 1, PAL.blue);
      if (s.frenzy) D.drawIcon(g, "exclaim", Math.round(dogX) + 10, GY - 28, 1, PAL.red);
    }
    ctx.loop(function (dt, n) { frame = n; now += dt; energy.tick(dt); updateEnergyUI(); draw(); }, 10);
    draw();
  });
})(typeof window !== "undefined" ? window : globalThis);
