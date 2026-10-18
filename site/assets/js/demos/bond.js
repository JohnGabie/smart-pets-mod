/* Demo "bond": bond meter with daily caps (anti-grind), slow decay on absence with a floor,
   and the waiting-at-the-door behavior by clinginess.
   Concept demo, not real gameplay. Spec: SPEC section 7 (bond), docs/06 (neediness, arrival at the door),
   specs/behaviors/05 (WAITED_AT_DOOR, GREETED_OWNER). Every number here is a "demo value". */
(function (root) {
  "use strict";
  var D = root.SPDemos; if (!D) return;
  var t = D.t, h = D.h, ui = D.ui, PAL = D.palette;

  var CFG = {                                   // demo values only
    gain: { walk: 5, fetch: 4, pet: 2, feed: 3, train: 3, back: 2 },
    cap:  { walk: 2, fetch: 3, pet: 5, feed: 2, train: 3, back: 1 },   // counted uses per day
    dailyTotal: 20, grace: 2, decay: 2, floor: 25, start: 10,
    unlocks: [{ at: 30, id: "call" }, { at: 50, id: "stay" }, { at: 75, id: "init" }]
  };

  function levelOf(cling) { return cling < 34 ? "low" : cling < 67 ? "mid" : "high"; }

  function createBond() {
    var s = { bond: CFG.start, day: 1, pts: 0, uses: {}, touched: false, apart: 0, hist: [CFG.start] };
    var api = {
      s: s,
      act: function (name) {
        if (name === "ignore") return { res: "ignored", gain: 0 };
        s.touched = true;
        var used = s.uses[name] || 0;
        if (used >= CFG.cap[name]) return { res: "capUse", gain: 0 };
        if (s.pts >= CFG.dailyTotal) return { res: "capDay", gain: 0 };
        var g = Math.min(CFG.gain[name], CFG.dailyTotal - s.pts, 100 - s.bond);
        s.uses[name] = used + 1; s.pts += g; s.bond = Math.min(100, s.bond + g);
        return { res: "gain", gain: g };
      },
      left: function (name) { return Math.max(0, CFG.cap[name] - (s.uses[name] || 0)); },
      nextDay: function () {
        var out = { decayed: 0, apart: 0 };
        if (s.touched) s.apart = 0; else s.apart += 1;
        if (s.apart > CFG.grace) {
          var before = s.bond, floor = Math.min(before, CFG.floor);
          s.bond = Math.max(floor, before - CFG.decay); out.decayed = before - s.bond;
        }
        out.apart = s.apart;
        s.day += 1; s.pts = 0; s.uses = {}; s.touched = false;
        s.hist.push(s.bond); if (s.hist.length > 16) s.hist.shift();
        return out;
      }
    };
    return api;
  }
  D.lib.bond = { createBond: createBond, CFG: CFG, levelOf: levelOf };

  var SW = 96, SH = 44, GY = 36, HOME_X = 34, DOOR_DOG_X = 52;
  var ACT_ANIM = {
    walk: { pose: "stand", icon: "heart", moveTo: 62 }, fetch: { pose: "frenzy", icon: "bone" }, pet: { pose: "stand", icon: "heart" },
    feed: { pose: "sniff", icon: "heart" }, train: { pose: "sit", icon: "note" }, ignore: { pose: "lie", icon: "dots" }
  };

  function actName(a) {
    switch (a) {
      case "walk": return t("demos.bond.walk", "Walk");
      case "fetch": return t("demos.bond.fetch", "Fetch");
      case "pet": return t("demos.bond.pet", "Pet");
      case "feed": return t("demos.bond.feed", "Feed");
      case "train": return t("demos.bond.train", "Train");
      default: return t("demos.bond.ignore", "Ignore");
    }
  }
  function unlockLabel(id) {
    return id === "call" ? t("demos.bond.u.call", "Comes when called from afar") : id === "stay" ? t("demos.bond.u.stay", "Firmer stay (distance grows)") : t("demos.bond.u.init", "More initiative (asks for food, warns, brings gifts)");
  }

  D.register("bond", function (el, ctx) {
    var sim = createBond(), s = sim.s;
    var cling = 70, frame = 0, now = 0;
    var anim = { pose: "stand", until: 0, icon: null, iconUntil: 0, mood: null, x: HOME_X, tx: HOME_X };
    var away = false, awayT = 0, waited = false, greet = 0;
    var clingId = ctx.id + "-cling";

    el.appendChild(ui.header(ctx, ["demos.bond.title", "Bond and the door"],
      ["demos.bond.blurb", "Bond grows from time spent together, but each day only counts so much (no grinding). Long absences wear it down slowly, never below a floor. Try leaving the house to see how neediness changes the waiting."]));

    var canvas = h("canvas", { class: "spd-canvas spd-scene", role: "img" });
    ctx.bind(canvas, function () { return t("demos.bond.sceneAria", "Room with a door on the right. The dog is {w}.", { w: away ? t("demos.bond.awayWait", "waiting for you") : t("demos.bond.homeWith", "with you") }); }, "aria-label");
    var wrap = h("div", { class: "spd-canvas-wrap spd-scene-wrap" }, [canvas]);
    var g = ctx.fit(canvas, SW, SH, 7);
    var status = ui.status(ctx), log = ui.log(ctx, 6);

    /* bond meter */
    var meter = ui.meter("spd-bondbar"); meter.el.setAttribute("role", "meter"); meter.el.setAttribute("aria-valuemin", 0); meter.el.setAttribute("aria-valuemax", 100);
    CFG.unlocks.forEach(function (u) { meter.el.appendChild(h("i", { class: "spd-tick", style: "left:" + u.at + "%" })); });
    meter.el.appendChild(h("i", { class: "spd-tick spd-tick-floor", style: "left:" + CFG.floor + "%" }));
    var bondVal = h("span", { class: "spd-meter-val" });
    var bondLab = h("span", { class: "spd-meter-label" }); ctx.tx(bondLab, "demos.bond.meter", "Bond (ticks: unlocks; short tick: decay floor)");
    var meterUpd = ctx.bind(meter.el, function () { return t("demos.bond.meterAria", "Bond {p} percent", { p: Math.round(s.bond) }); }, "aria-label");

    /* daily panel */
    var dayLine = h("div", { class: "spd-readout spd-dayline" });
    var dayBar = ui.meter("spd-daybar");
    var dayLab = h("span", { class: "spd-meter-label" }); var dayVal = h("span", { class: "spd-meter-val" });
    ctx.bind(dayLab, function () { return t("demos.bond.todayCap", "Counted today (daily cap {c}, demo)", { c: CFG.dailyTotal }); });

    /* activity buttons */
    var actRow = h("div", { class: "spd-row spd-acts" });
    var actBtns = {};
    ["walk", "fetch", "pet", "feed", "train", "ignore"].forEach(function (a) {
      var b = h("button", { type: "button", class: "mc-btn spd-btn" + (a === "ignore" ? "" : " mc-btn--green"), onclick: function () { doAct(a); } });
      actBtns[a] = ctx.bind(b, function () { return a === "ignore" ? actName(a) : actName(a) + " (" + sim.left(a) + ")"; });
      actRow.appendChild(b);
    });
    var dayRow = h("div", { class: "spd-row" }, [
      ui.button(ctx, ["demos.bond.nextDay", "Next day"], function () { nextDay(1); }),
      ui.button(ctx, ["demos.bond.skip5", "Skip 5 days without visiting"], function () { nextDay(5); })]);

    /* unlock list */
    var unlockList = h("ul", { class: "spd-unlocks" });
    function renderUnlocks() {
      while (unlockList.firstChild) unlockList.removeChild(unlockList.firstChild);
      CFG.unlocks.forEach(function (u) {
        var on = s.bond >= u.at;
        var li = h("li", { class: on ? "is-on" : "is-off" }, [
          h("span", { class: "mc-badge " + (on ? "mc-badge--done" : "mc-badge--planned"), text: on ? t("demos.bond.unlocked", "unlocked") : t("demos.bond.locked", "locked") }),
          h("span", { text: " " + unlockLabel(u.id) + " (" + u.at + "%, " + t("demos.bond.demoVal", "demo value") + ")" })]);
        unlockList.appendChild(li);
      });
    }

    /* history */
    var hist = h("div", { class: "spd-hist", role: "img" });
    var histUpd = ctx.bind(hist, function () { return t("demos.bond.histAria", "Bond per day: {v}", { v: s.hist.map(function (v) { return Math.round(v) + "%"; }).join(", ") }); }, "aria-label");
    function renderHist() {
      while (hist.firstChild) hist.removeChild(hist.firstChild);
      s.hist.forEach(function (v) { hist.appendChild(h("span", { class: "spd-hbar", style: "height:" + Math.max(4, v) + "%" })); });
      histUpd();
    }

    /* door section */
    var clingIn = h("input", { type: "range", class: "spd-range", id: clingId, min: 0, max: 100, step: 1, value: cling, oninput: function () { cling = +this.value; clingUpd(); } });
    var clingOut = h("span", { class: "spd-readout" });
    var clingUpd = ctx.bind(clingOut, function () { var l = levelOf(cling); return l === "low" ? t("demos.bond.cl.low", "low: naps, does not wait") : l === "mid" ? t("demos.bond.cl.mid", "medium: sits by the door") : t("demos.bond.cl.high", "high: lies at the door, big greeting"); });
    var awayLine = h("div", { class: "spd-readout spd-away" });
    var awayUpd = ctx.bind(awayLine, function () {
      if (!away) return t("demos.bond.home", "You are home.");
      var m = Math.min(5, Math.floor(awayT / 60)), sec = awayT >= 300 ? 0 : Math.floor(awayT % 60);
      return t("demos.bond.awayClock", "You have been away {m}:{s} (of 5:00)", { m: m, s: (sec < 10 ? "0" : "") + sec });
    });
    var leaveBtn = ui.button(ctx, ["demos.bond.leave", "Leave for 5 minutes"], function () { leave(); });
    var backBtn = ui.button(ctx, ["demos.bond.back", "Come back"], function () { comeBack(); }, "mc-btn--green");

    var left = h("div", { class: "spd-main" }, [wrap,
      h("div", { class: "spd-metric" }, [h("div", { class: "spd-metric-head" }, [bondLab, bondVal]), meter.el]),
      h("div", { class: "spd-metric" }, [h("div", { class: "spd-metric-head" }, [dayLab, dayVal]), dayBar.el]),
      dayLine, actRow, dayRow, status.el]);
    var doorTitle = h("h4", { class: "spd-card-title" }); ctx.tx(doorTitle, "demos.bond.doorTitle", "Waiting at the door");
    var unTitle = h("h4", { class: "spd-card-title" }); ctx.tx(unTitle, "demos.bond.unTitle", "What bond unlocks");
    var histTitle = h("h4", { class: "spd-card-title" }); ctx.tx(histTitle, "demos.bond.histTitle", "Bond by day");
    var right = h("div", { class: "mc-panel mc-panel--dark spd-side" }, [
      doorTitle, ui.field(ctx, clingId, ["demos.bond.clinginess", "Clinginess (gene)"], h("span", { class: "spd-range-wrap" }, [clingIn, clingOut])),
      h("div", { class: "spd-row" }, [leaveBtn, backBtn]), awayLine, unTitle, unlockList, histTitle, hist]);
    el.appendChild(h("div", { class: "spd-train-grid" }, [left, right]));
    var lt = h("h4", { class: "spd-card-title" }); ctx.tx(lt, "demos.bond.logTitle", "Event log");
    el.appendChild(lt); el.appendChild(log.el);
    el.appendChild(h("p", { class: "spd-foot" }, [(function () { var sp = h("span"); ctx.tx(sp, "demos.bond.foot", "Demo values: gains, daily caps, unlock thresholds, the decay rate and the floor are stand-ins; the real ones will be tuned by playtesting. Ignoring never lowers bond here; only long absence does."); return sp; })()]));

    function setAnim(a, secs, icon, mood) {
      anim.pose = a; anim.until = now + secs; if (icon) { anim.icon = icon; anim.iconUntil = now + secs; } anim.mood = mood || null;
    }
    function refresh() {
      meter.set(s.bond); bondVal.textContent = Math.round(s.bond) + "%"; meter.el.setAttribute("aria-valuenow", Math.round(s.bond)); meterUpd();
      dayBar.set(s.pts / CFG.dailyTotal * 100); dayVal.textContent = s.pts + "/" + CFG.dailyTotal;
      dayLine.textContent = t("demos.bond.dayLine", "Day {d}", { d: s.day });
      for (var k in actBtns) actBtns[k]();
      renderUnlocks(); renderHist();
    }
    function doAct(name) {
      if (away) { status.set("demos.bond.busyAway", "You are away. Come back first."); return; }
      var r = sim.act(name), a = ACT_ANIM[name];
      if (name === "walk") { anim.tx = ACT_ANIM.walk.moveTo; }
      if (r.res === "gain") {
        setAnim(a.pose, 1.6, "heart", "happy");
        status.set("demos.bond.gain", "{a}: bond +{g}.", { a: actName(name), g: r.gain });
      } else if (r.res === "capUse") {
        setAnim("stand", 1.6, "note", "neutral");
        status.set("demos.bond.capUse", "{a}: Rex has had enough of this today. No bond gained (daily cap).", { a: actName(name) });
      } else if (r.res === "capDay") {
        setAnim("stand", 1.6, "note", "neutral");
        status.set("demos.bond.capDay", "That is all the bond today can give. Come back tomorrow (daily cap).");
      } else {
        setAnim("lie", 2, "dots", "neutral");
        status.set("demos.bond.ignored", "You ignore Rex. No bond gained, and none lost.");
      }
      refresh();
    }
    function nextDay(n) {
      var tot = 0, apart = 0;
      for (var i = 0; i < n; i++) { var o = sim.nextDay(); tot += o.decayed; apart = o.apart; }
      if (tot > 0) status.set("demos.bond.decayed", "{n} day(s) passed. After {a} days apart, bond fell by {d} (never below the floor of {f}%).", { n: n, a: apart, d: tot, f: CFG.floor });
      else if (apart > 0) status.set("demos.bond.grace", "{n} day(s) passed without visiting ({a} apart). Bond only starts to fade after {g} days.", { n: n, a: apart, g: CFG.grace });
      else status.set("demos.bond.newDay", "A new day: the daily cap is reset.");
      refresh();
    }
    function leave() {
      if (away) { status.set("demos.bond.alreadyAway", "You are already away. Use Come back."); return; }
      away = true; awayT = 0; waited = false; greet = 0; awayUpd();
      var l = levelOf(cling);
      if (l === "low") { anim.tx = HOME_X; setAnim("lie", 6, "zzz"); status.set("demos.bond.leaveLow", "You leave. Rex is not clingy: he curls up for a nap."); }
      else { anim.tx = DOOR_DOG_X; status.set("demos.bond.leaveMove", "You leave. Rex trots to the door."); }
    }
    function comeBack() {
      if (!away) { status.set("demos.bond.alreadyHome", "You are already home."); return; }
      away = false; awayUpd();
      var l = levelOf(cling), r = sim.act("back");
      anim.tx = HOME_X;
      if (l === "low") { setAnim("stand", 2, null, "neutral"); status.set("demos.bond.backLow", "You return. Rex glances up, then goes back to his nap. Calm."); }
      else {
        greet = l === "high" ? 3 : 1.6;
        setAnim(l === "high" ? "frenzy" : "stand", greet, "heart", "happy");
        log.add("event", "GREETED_OWNER", ["demos.bond.ev.greeted", "Rex greets you at the door.", null]);
        status.set("demos.bond.backGreet", "You return. Rex greets you at the door.");
      }
      if (r.res === "gain") status.set("demos.bond.backGain", "Returning home counts as time together: bond +{g}.", { g: r.gain });
      refresh();
    }

    ctx.onLang(function () { refresh(); awayUpd(); clingUpd(); });
    status.set("demos.bond.start", "Spend time with Rex. Each activity counts only a few times per day.");
    refresh();

    function draw() {
      var reduced = ctx.reduced(), l = levelOf(cling);
      D.drawBackdrop(g, SW, SH, GY, "indoor");
      // door (right wall)
      g.fillStyle = PAL.door; g.fillRect(78, GY - 26, 14, 26);
      g.fillStyle = PAL.doorLight; g.fillRect(80, GY - 24, 10, 10); g.fillRect(80, GY - 12, 10, 10);
      g.fillStyle = PAL.gold; g.fillRect(81, GY - 12, 2, 2);
      if (away) { g.fillStyle = "#2a2a30"; g.fillRect(84, GY - 26, 8, 26); }
      // player
      if (!away) {
        g.fillStyle = "#e0b48a"; g.fillRect(8, GY - 16, 5, 5); g.fillStyle = "#4a3320"; g.fillRect(8, GY - 16, 5, 2);
        g.fillStyle = "#3a6fb5"; g.fillRect(7, GY - 11, 7, 6); g.fillStyle = "#2f3f7a"; g.fillRect(8, GY - 5, 5, 5);
      }
      // movement
      var moving = false;
      if (!away && anim.tx !== HOME_X && now >= anim.until) anim.tx = HOME_X;
      if (anim.x !== anim.tx) {
        moving = true;
        if (reduced) anim.x = anim.tx; else anim.x += Math.max(-3, Math.min(3, anim.tx - anim.x));
      }
      var pose = now < anim.until ? anim.pose : "stand", flip = false, mood = (anim.mood === "happy" && now < anim.until) ? "happy" : "neutral";
      if (away) {
        if (l !== "low" && !moving) {
          pose = l === "mid" ? "sit" : "lie";
          flip = false;
          if (!waited) { waited = true; log.add("event", "WAITED_AT_DOOR", ["demos.bond.ev.waited", "Rex waits at the door ({l}).", { l: l === "mid" ? t("demos.bond.sits", "sitting") : t("demos.bond.lies", "lying") }]); }
        } else if (l === "low" && !moving) { pose = "lie"; }
        else pose = "stand";
        mood = "neutral";
      } else if (!moving) { flip = true; if (now >= anim.until) pose = "stand"; }
      if (moving) { pose = "stand"; flip = anim.tx < anim.x; if (away) flip = false; }
      var fr = reduced ? 0 : (moving || pose === "frenzy") ? (frame & 1) : ((frame >> 1) & 1);
      var x = Math.round(anim.x);
      D.drawDog(g, { base: "red", patterns: { chest: true, socks: true, blaze: true }, seed: 9, stage: "adult", pose: pose, mood: mood, x: x, y: GY - 16, scale: 1, flip: flip, frame: fr, shadow: true });
      var ic = anim.icon;
      if (away && waited && l !== "low") { ic = "dots"; }
      if (away && l === "low" && !moving) ic = "zzz";
      var show = (now < anim.iconUntil && anim.icon) || (away && ic);
      if (show) {
        var col = ic === "heart" ? PAL.heart : ic === "dots" ? PAL.ink : ic === "bone" ? "#f8f4ea" : ic === "zzz" ? PAL.blue : PAL.gold;
        D.drawIcon(g, ic, x + 10, GY - 26 - (reduced ? 0 : ((frame >> 1) & 1)), 1, col);
      }
    }
    ctx.loop(function (dt, n) {
      frame = n; now += dt;
      if (away) { awayT = Math.min(awayT + dt * 60, 301); awayUpd(); }
      draw();
    }, 10);
    draw();
  });
})(typeof window !== "undefined" ? window : globalThis);
