/* Demo "training": cue training simulator.
   Concept demo, not real gameplay. Follows SPEC section 8 and specs/behaviors 01 (name/attention), 02 (commands),
   03 (training). Journal event names are the ones used in those specs; every number marked "demo" is a stand-in. */
(function (root) {
  "use strict";
  var D = root.SPDemos; if (!D) return;
  var t = D.t, h = D.h, ui = D.ui, PAL = D.palette;

  var NAME_CUE = "felicia";   // the name cue used in specs/behaviors
  var C = {                   // demo values (the real ones live in config/data, see CLAUDE.md section 2)
    nameReps: 3, attention: 4, attentionRelaxed: 12, nameWindow: 10, lessonWindow: 10,
    full: 20, satietyDecay: 8, fatWarn: 8, fatDisinterest: 14, fatDecay: 3, fatRecover: 4, sitSeconds: 5
  };

  /* ---------- pure simulation ---------- */
  function norm(w) { return String(w == null ? "" : w).trim().toLowerCase().replace(/\s+/g, " "); }

  function createSim(opts) {
    opts = opts || {};
    var emit = opts.emit || function () {};
    var s;
    function fresh() {
      return { intel: s ? s.intel : (opts.intel == null ? 50 : opts.intel), relaxed: s ? s.relaxed : !!opts.relaxed,
        nameReps: 0, nameKnown: false, nameHeard: 0, attention: 0, lesson: null, counts: {}, learned: {},
        sitting: 0, lureT: 0, satiety: 0, satT: 0, fatigue: 0, fatT: 0, warned: false, disinterested: false, mischief: false, mischiefT: 0 };
    }
    s = fresh();
    function ev(tag, key, fb, vars, anim) { emit({ kind: "event", tag: tag, key: key, fb: fb, vars: vars, anim: anim }); }
    function dog(key, fb, vars, anim) { emit({ kind: "dog", key: key, fb: fb, vars: vars, anim: anim }); }
    function you(key, fb, vars) { emit({ kind: "you", key: key, fb: fb, vars: vars }); }
    var sim = {
      state: s, C: C, NAME_CUE: NAME_CUE,
      get s() { return s; },
      repsNeeded: function () { return Math.round(6 - 3 * s.intel / 100); },
      reset: function () { s = fresh(); sim.state = s; emit({ kind: "reset" }); },
      setIntel: function (v) { s.intel = Math.max(0, Math.min(100, +v || 0)); },
      setRelaxed: function (b) { s.relaxed = !!b; },
      attnSeconds: function () { return s.relaxed ? C.attentionRelaxed : C.attention; },
      sayName: function () {
        you("demos.training.you.name", "You say the name cue \"{w}\".", { w: NAME_CUE });
        if (!s.nameKnown) {
          s.nameHeard = C.nameWindow;
          dog("demos.training.dog.tilt", "Rex shows head_tilt (an unknown sound; no attention gained yet).", null, { pose: "tilt", secs: 1.6, icon: "question", look: true });
          return "unknownName";
        }
        if (s.attention <= 0) {
          s.attention = sim.attnSeconds();
          ev("ATTENTION_GAINED", "demos.training.ev.attention", "Rex shows look_at_player. No command yet.", null, { pose: "stand", secs: 0, icon: "exclaim", iconSecs: 1.2, look: true });
          return "attention";
        }
        s.attention = sim.attnSeconds();
        dog("demos.training.dog.alreadyLooking", "Rex is already looking at you (repeating the name adds nothing).", null, { look: true });
        return "attentionRepeat";
      },
      sayCue: function (raw) {
        var w = norm(raw);
        if (!w) { emit({ kind: "hint", key: "demos.training.hint.empty", fb: "Type a word first." }); return "empty"; }
        if (w === NAME_CUE) return sim.sayName();
        you("demos.training.you.cue", "You say \"{w}\".", { w: w });
        if (s.disinterested) {
          dog("demos.training.dog.ignore", "Rex shows ignore (refusal is visible).", null, { pose: "stand", secs: 1.2, look: false });
          return "disinterested";
        }
        if (s.learned[w]) {
          if (s.attention <= 0) {
            ev("COMMAND_IGNORED_NO_ATTENTION", "demos.training.ev.noAttention", "Rex does not perform SIT: the name did not come first (low mastery).", null, { pose: "stand", secs: 1.2, icon: "question", look: false });
            return "noAttention";
          }
          s.attention = 0;
          if (s.sitting > 0) {
            ev("COMMAND_REDUNDANT", "demos.training.ev.redundant", "Rex is already sitting.", null, { pose: "sit", secs: C.sitSeconds, look: true });
            return "redundant";
          }
          s.sitting = C.sitSeconds;
          dog("demos.training.dog.sit", "Rex performs SIT.", null, { pose: "sit", secs: C.sitSeconds, icon: "heart", iconSecs: 1.4, look: true });
          return "sit";
        }
        if (s.attention > 0) {
          s.attention = 0;
          s.lesson = { token: w, lured: false, t: C.lessonWindow };
          dog("demos.training.dog.tiltUnknown", "Rex shows head_tilt (unknown cue after the name). Now lure and reward.", null, { pose: "tilt", secs: 1.6, icon: "question", look: true });
          return "tilt";
        }
        dog("demos.training.dog.noReact", "Rex does not react (an unknown word, and no attention).", null, { look: false });
        return "noReact";
      },
      lure: function () {
        you("demos.training.you.lure", "You lure Rex into a sit with a treat in hand.");
        if (s.disinterested) { dog("demos.training.dog.ignore", "Rex shows ignore (refusal is visible).", null, { look: false }); return "disinterested"; }
        s.sitting = C.sitSeconds; s.lureT = C.lessonWindow;
        if (s.lesson && !s.lesson.lured) s.lesson.lured = true;
        dog("demos.training.dog.lured", "Rex follows the lure and sits.", null, { pose: "sit", secs: C.sitSeconds, icon: "bone", iconSecs: 1.5, look: true });
        return "lured";
      },
      treat: function () {
        you("demos.training.you.treat", "You give a treat.");
        if (s.satiety >= C.full) {
          ev("REWARD_REJECTED_FULL", "demos.training.ev.full", "Rex is full and turns away from the treat. No learning from it.", null, { pose: "stand", secs: 1.5, icon: "exclaim", iconSecs: 0, look: false, mood: "neutral" });
          return "full";
        }
        s.satiety += 1;
        var anim = { icon: "heart", iconSecs: 1.5, look: true, mood: "happy", pose: "stand", secs: 1.5 };
        if (s.disinterested) {
          dog("demos.training.dog.takesTreat", "Rex takes the treat but is not in the mood to train.", null, anim);
          return "takes";
        }
        if (!s.nameKnown && s.nameHeard > 0) {
          s.nameReps += 1; s.nameHeard = 0;
          if (s.nameReps >= C.nameReps) {
            s.nameKnown = true;
            ev("COMMAND_LEARNED", "demos.training.ev.nameLearned", "Rex learned his name cue \"{w}\" (NAME). He looks at you and hearts appear.", { w: NAME_CUE }, anim);
            return "nameLearned";
          }
          ev("ASSOCIATION_STRENGTHENED", "demos.training.ev.nameStrength", "Name cue + treat: {n} of {need}. Rex shows hearts.", { n: s.nameReps, need: C.nameReps }, anim);
          return "nameStrength";
        }
        if (s.lesson && s.lesson.lured) {
          var w = s.lesson.token, need = sim.repsNeeded();
          s.counts[w] = (s.counts[w] || 0) + 1;
          s.lesson = null; s.lureT = 0;
          s.fatigue += 1; s.fatT = 0;
          var res;
          if (s.counts[w] >= need && !s.learned[w]) {
            s.learned[w] = true;
            ev("COMMAND_LEARNED", "demos.training.ev.learned", "Rex learned \"{w}\" for SIT after {n} consistent repetitions.", { w: w, n: s.counts[w] }, anim);
            res = "learned";
          } else {
            ev("ASSOCIATION_STRENGTHENED", "demos.training.ev.strength", "\"{w}\" + lure + treat: {n} of {need}. Rex shows hearts.", { w: w, n: s.counts[w], need: need }, anim);
            res = "strength";
          }
          fatigueCheck();
          return res;
        }
        if (s.lureT > 0) { s.lureT = 0; s.fatigue += 1; s.fatT = 0; dog("demos.training.dog.plainTreat", "Rex enjoys the treat. Nothing to associate with it.", null, anim); fatigueCheck(); return "plain"; }
        dog("demos.training.dog.plainTreat", "Rex enjoys the treat. Nothing to associate with it.", null, anim);
        return "plain";
      },
      sayNo: function () {
        you("demos.training.you.no", "You say the \"no\" cue.");
        if (s.attention <= 0) { dog("demos.training.dog.noReact2", "Rex does not react (the name did not come first).", null, { look: false }); return "noReact"; }
        s.attention = 0;
        if (s.mischief) {
          s.mischief = false;
          ev("BEHAVIOR_WEIGHT_DECREASED", "demos.training.ev.weight", "Rex stops chewing the slipper. No damage; only attention is withdrawn.", null, { pose: "stand", secs: 1.5, icon: "drop", iconSecs: 1.2, look: true, walkBack: true });
          return "weight";
        }
        s.lesson = null;
        dog("demos.training.dog.calm", "Rex looks away calmly. The lesson is cleared; nothing is punished.", null, { pose: "stand", secs: 1.2, look: false });
        return "calm";
      },
      tick: function (dt) {
        if (s.attention > 0) {
          s.attention -= dt;
          if (s.attention <= 0) { s.attention = 0; ev("ATTENTION_EXPIRED", "demos.training.ev.expired", "No command followed. Rex goes back to what he was doing.", null, { look: false }); }
        }
        if (s.nameHeard > 0) s.nameHeard = Math.max(0, s.nameHeard - dt);
        if (s.lesson) { s.lesson.t -= dt; if (s.lesson.t <= 0) s.lesson = null; }
        if (s.sitting > 0) s.sitting = Math.max(0, s.sitting - dt);
        if (s.lureT > 0) s.lureT = Math.max(0, s.lureT - dt);
        s.satT += dt; if (s.satT >= C.satietyDecay) { s.satT = 0; if (s.satiety > 0) s.satiety -= 1; }
        if (s.fatigue > 0) {
          s.fatT += dt;
          if (s.fatT >= C.fatDecay) { s.fatT = 0; s.fatigue -= 1; }
          if (s.fatigue < C.fatRecover) {
            s.warned = false;
            if (s.disinterested) { s.disinterested = false; s.mischief = false; dog("demos.training.dog.interested", "Rex has rested and is interested again.", null, { look: true, walkBack: true }); }
          }
        }
        if (s.disinterested && !s.mischief) {
          s.mischiefT += dt;
          if (s.mischiefT >= 2) { s.mischief = true; s.mischiefT = 0; dog("demos.training.dog.mischief", "Rex wanders off and starts chewing a slipper (a forbidden item). Try the name cue, then \"no\".", null, { look: false, mischief: true }); }
        }
      }
    };
    function fatigueCheck() {
      if (s.fatigue >= C.fatDisinterest && !s.disinterested) {
        s.disinterested = true; s.mischiefT = 0; s.lesson = null;
        ev("TRAINING_DISINTEREST", "demos.training.ev.disinterest", "Rex loses interest and wanders off. Let him rest; reps will count again.", null, { pose: "stand", secs: 0.5, look: false, wander: true });
      } else if (s.fatigue >= C.fatWarn && !s.warned) {
        s.warned = true;
        ev("FATIGUE_WARNING", "demos.training.ev.fatigue", "Rex shows yawn. Too many repetitions in a row; stop soon.", null, { pose: "yawn", secs: 2, icon: "zzz", iconSecs: 2, look: true });
      }
    }
    return sim;
  }
  D.lib.training = { createSim: createSim, C: C, norm: norm, NAME_CUE: NAME_CUE };

  /* ---------- UI ---------- */
  var SW = 96, SH = 48, GY = 38;

  function drawPlayer(g, x, y) { // original generic block figure
    g.fillStyle = "#e0b48a"; g.fillRect(x + 1, y, 5, 5);
    g.fillStyle = "#4a3320"; g.fillRect(x + 1, y, 5, 2);
    g.fillStyle = "#111"; g.fillRect(x + 4, y + 2, 1, 1);
    g.fillStyle = "#3a6fb5"; g.fillRect(x, y + 5, 7, 6);
    g.fillStyle = "#e0b48a"; g.fillRect(x + 6, y + 6, 2, 3);
    g.fillStyle = "#2f3f7a"; g.fillRect(x + 1, y + 11, 5, 5);
    g.fillStyle = "#222"; g.fillRect(x + 1, y + 15, 5, 1);
  }

  D.register("training", function (el, ctx) {
    var anim = { pose: "stand", until: 0, icon: null, iconUntil: 0, look: false, mood: null };
    var now = 0, frame = 0, dogX = 40, targetX = 40, wandering = false, mischiefOn = false;
    var sim, intelId = ctx.id + "-int", cueId = ctx.id + "-cue";

    el.appendChild(ui.header(ctx, ["demos.training.title", "Cue training simulator"],
      ["demos.training.blurb", "Teach Rex a cue the way the design describes: his name first (attention), then a cue word, a lure, and a treat. Any word works, but it must be the same word each time."]));

    var canvas = h("canvas", { class: "spd-canvas spd-scene", role: "img" });
    ctx.bind(canvas, function () { return t("demos.training.sceneAria", "Scene: the player on the left, the dog Rex on the right."); }, "aria-label");
    var wrap = h("div", { class: "spd-canvas-wrap spd-scene-wrap" }, [canvas]);
    var g = ctx.fit(canvas, SW, SH, 7);

    var status = ui.status(ctx), log = ui.log(ctx, 14);

    sim = createSim({
      intel: 50,
      emit: function (e) {
        if (e.kind === "reset") { log.clear(); anim.pose = "stand"; anim.until = 0; anim.icon = null; wandering = false; mischiefOn = false; targetX = 40; updateAll(); return; }
        if (e.kind === "hint") { status.set(e.key, e.fb); return; }
        if (e.kind === "you") { log.add("you", "", [e.key, e.fb, e.vars]); return; }
        log.add(e.kind === "event" ? "event" : "dog", e.kind === "event" ? e.tag : "", [e.key, e.fb, e.vars]);
        if (e.kind === "event" || e.kind === "dog") status.set(e.key, e.fb, e.vars);
        var a = e.anim; if (!a) return;
        if (a.pose) { anim.pose = a.pose; anim.until = now + (a.secs || 0); }
        if (a.icon) { anim.icon = a.icon; anim.iconUntil = now + (a.iconSecs || a.secs || 1.2); }
        if (a.look != null) anim.look = a.look;
        anim.mood = a.mood || (a.icon === "heart" ? "happy" : null);
        if (a.wander) { wandering = true; targetX = 68; mischiefOn = false; }
        if (a.mischief) mischiefOn = true;
        if (a.walkBack) { wandering = false; mischiefOn = false; targetX = 40; }
        if (e.tag === "TRAINING_DISINTEREST") anim.look = false;
      }
    });

    /* controls */
    var nameBtn = ui.button(ctx, ["demos.training.btnName", "Say name cue"], function () { sim.sayName(); updateAll(); });
    var kbd = h("span", { class: "mc-kbd spd-namecue", text: NAME_CUE });
    var cueIn = h("input", { class: "spd-input spd-cue-input", id: cueId, type: "text", maxlength: 24, value: "potato", autocomplete: "off", spellcheck: "false",
      onkeydown: function (ev) { if (ev.key === "Enter") { ev.preventDefault(); sim.sayCue(cueIn.value); updateAll(); } } });
    var cueBtn = ui.button(ctx, ["demos.training.btnCue", "Say cue"], function () { sim.sayCue(cueIn.value); updateAll(); });
    var lureBtn = ui.button(ctx, ["demos.training.btnLure", "Lure (sit)"], function () { sim.lure(); updateAll(); });
    var treatBtn = ui.button(ctx, ["demos.training.btnTreat", "Give treat"], function () { sim.treat(); updateAll(); }, "mc-btn--green");
    var noBtn = ui.button(ctx, ["demos.training.btnNo", "Say NO"], function () { sim.sayNo(); updateAll(); });
    var resetBtn = ui.button(ctx, ["demos.training.btnReset", "Reset"], function () { sim.reset(); status.set("demos.training.resetDone", "Reset. Rex knows nothing again."); });

    var intel = h("input", { type: "range", min: 0, max: 100, step: 1, value: 50, id: intelId, class: "spd-range",
      oninput: function () { sim.setIntel(this.value); updateAll(); } });
    var relaxedId = ctx.id + "-relaxed";
    var relaxed = h("input", { type: "checkbox", id: relaxedId, class: "spd-check", onchange: function () { sim.setRelaxed(this.checked); } });
    var relaxedLab = h("label", { for: relaxedId, class: "spd-check-label" }); ctx.bind(relaxedLab, function () { return t("demos.training.relaxed", "Relaxed timing ({s} s attention)", { s: C.attentionRelaxed }); });
    var repsOut = h("span", { class: "spd-readout" });
    var repsUpd = ctx.bind(repsOut, function () { return t("demos.training.reps", "needs {n} reps (demo)", { n: sim.repsNeeded() }); });

    var row1 = h("div", { class: "spd-row" }, [nameBtn, kbd]);
    var row2 = h("div", { class: "spd-row spd-cue-row" }, [ui.field(ctx, cueId, ["demos.training.cueLabel", "Cue word"], cueIn), cueBtn]);
    var row3 = h("div", { class: "spd-row" }, [lureBtn, treatBtn, noBtn, resetBtn]);
    var row4 = h("div", { class: "spd-row spd-row-sliders" }, [ui.field(ctx, intelId, ["demos.training.intel", "Intelligence (gene)"], h("span", { class: "spd-range-wrap" }, [intel, repsOut])),
      h("span", { class: "spd-check-wrap" }, [relaxed, relaxedLab])]);

    /* meters */
    function metric(labelKey, labelFb) {
      var m = ui.meter(); var lab = h("span", { class: "spd-meter-label" }); ctx.tx(lab, labelKey, labelFb);
      var val = h("span", { class: "spd-meter-val" });
      return { box: h("div", { class: "spd-metric" }, [h("div", { class: "spd-metric-head" }, [lab, val]), m.el]), m: m, val: val };
    }
    var mAttn = metric("demos.training.mAttention", "Attention window"), mSat = metric("demos.training.mSatiety", "Treats eaten (full at 20, demo)"), mInt = metric("demos.training.mInterest", "Interest in training");
    var known = h("div", { class: "spd-known" });
    var panel = h("div", { class: "mc-panel mc-panel--dark spd-side" }, [mAttn.box, mSat.box, mInt.box, known]);
    var cueTitle = h("h4", { class: "spd-card-title" }); ctx.tx(cueTitle, "demos.training.knows", "What Rex knows");
    panel.insertBefore(cueTitle, panel.firstChild);

    var knownKey = "";
    function renderKnown(force) {
      var s = sim.s, need = sim.repsNeeded();
      var key = [s.nameKnown, s.nameReps, need, JSON.stringify(s.counts), JSON.stringify(s.learned)].join("|");
      if (!force && key === knownKey) return;
      knownKey = key;
      while (known.firstChild) known.removeChild(known.firstChild);
      var ul = h("ul", { class: "spd-know-list" });
      ul.appendChild(h("li", { text: s.nameKnown ? t("demos.training.nameKnown", "Name cue \"{w}\": learned", { w: NAME_CUE }) : t("demos.training.nameProgress", "Name cue: {n} of {need} (name + treat)", { n: s.nameReps, need: C.nameReps }) }));
      var toks = Object.keys(s.counts);
      if (!toks.length) ul.appendChild(h("li", { text: t("demos.training.noCues", "SIT cues: none yet") }));
      toks.forEach(function (w) {
        ul.appendChild(h("li", { text: s.learned[w] ? t("demos.training.cueLearned", "\"{w}\" = SIT: learned", { w: w }) : t("demos.training.cueProgress", "\"{w}\": {n} of {need}", { w: w, n: s.counts[w], need: need }) }));
      });
      known.appendChild(ul);
    }
    function updateMeters() {
      var s = sim.s, aMax = sim.attnSeconds();
      mAttn.m.set(s.attention > 0 ? (s.attention / aMax) * 100 : 0);
      mAttn.val.textContent = s.attention > 0 ? s.attention.toFixed(1) + " s" : (s.lesson ? t("demos.training.lessonOpen", "lesson open") : "-");
      mSat.m.set(s.satiety / C.full * 100); mSat.val.textContent = s.satiety + "/" + C.full;
      var intr = Math.max(0, 100 - s.fatigue / C.fatDisinterest * 100);
      mInt.m.set(intr); mInt.val.textContent = s.disinterested ? t("demos.training.bored", "disinterested") : s.warned ? t("demos.training.tired", "tired") : t("demos.training.keen", "keen");
      mInt.m.el.classList.toggle("spd-meter--warn", s.warned || s.disinterested);
    }
    function updateAll() {
      updateMeters(); renderKnown(); repsUpd();
    }

    var layout = h("div", { class: "spd-train-grid" }, [
      h("div", { class: "spd-main" }, [wrap, row1, row2, row3, row4, status.el]), panel]);
    el.appendChild(layout);
    var logTitle = h("h4", { class: "spd-card-title" }); ctx.tx(logTitle, "demos.training.logTitle", "Event log (names from the behavior specs)");
    el.appendChild(logTitle); el.appendChild(log.el);
    el.appendChild(h("p", { class: "spd-foot" }, [(function () { var sp = h("span"); ctx.tx(sp, "demos.training.foot", "Demo values: reps needed (3 to 6 by intelligence), attention window, treats until full, and the tiredness limits are stand-ins; the real numbers will live in config and be tuned by playtesting."); return sp; })()]));

    ctx.onLang(function () { renderKnown(true); updateMeters(); });
    status.set("demos.training.start", "Start by saying the name cue, then give a treat. Three times and Rex learns his name.");
    updateAll();

    function draw() {
      var reduced = ctx.reduced();
      D.drawBackdrop(g, SW, SH, GY, "outdoor");
      drawPlayer(g, 12, GY - 16);
      // movement
      if (!reduced) { if (dogX < targetX) dogX = Math.min(targetX, dogX + 3); else if (dogX > targetX) dogX = Math.max(targetX, dogX - 3); }
      else dogX = targetX;
      var moving = dogX !== targetX, s = sim.s;
      var pose = now < anim.until ? anim.pose : "stand";
      if (s.sitting > 0 && now >= anim.until) pose = "sit";
      var faceLeft = (anim.look || s.attention > 0 || (s.lesson != null)) && !moving && !wandering;
      var mood = anim.mood === "happy" && now < anim.iconUntil ? "happy" : "neutral";
      if (wandering && !moving) { pose = mischiefOn ? "sniff" : (now < anim.until ? pose : "stand"); faceLeft = false; }
      if (moving) pose = reduced ? "stand" : "stand";
      var fr = reduced ? 0 : (moving ? frame & 1 : (frame >> 1) & 1);
      D.drawDog(g, { base: "red", patterns: { chest: true, socks: true }, seed: 5, stage: "adult", pose: pose, mood: mood, x: dogX, y: GY - 16, scale: 1, flip: faceLeft, frame: fr, shadow: true });
      if (mischiefOn && !moving) D.drawIcon(g, "slipper", dogX + 17, GY - 3, 1, "#8e4a14");
      var cx = dogX + (faceLeft ? 8 : 14);
      if (now < anim.iconUntil && anim.icon) {
        var ic = anim.icon, col = ic === "heart" ? PAL.heart : ic === "question" ? PAL.gold : ic === "exclaim" ? PAL.gold : ic === "zzz" ? PAL.blue : ic === "drop" ? PAL.blue : PAL.gold;
        var bob = reduced ? 0 : ((frame >> 1) & 1);
        D.drawIcon(g, ic, cx, GY - 28 - bob, 1, col);
      }
      if (s.attention > 0) D.drawIcon(g, "exclaim", 14, GY - 24, 1, PAL.gold);
    }

    ctx.loop(function (dt, n) {
      now += dt; frame = n;
      sim.tick(dt);
      updateMeters();
      if (frame % 5 === 0) renderKnown();
      draw();
    }, 10);
    draw();
  });
})(typeof window !== "undefined" ? window : globalThis);
