/* Demo "coats": genes + seed coat lab. Mendelian-style sampling with dominance and hidden recessive carriers.
   Concept demo, not real gameplay. Spec: SPEC section 13 (litter 3-5, sometimes 2, rarely 6) and section 15
   (alleles with dominance + hidden carriers; pure-line parents give a near-identical litter; genes + seed = coat). */
(function (root) {
  "use strict";
  var D = root.SPDemos; if (!D) return;
  var t = D.t, h = D.h, ui = D.ui, PAL = D.palette;

  var BASES = D.baseIds;                         // dominance order, high to low (demo values)
  var PATS = ["socks", "chest", "blaze", "patches"];
  var LETTER = { black: "K", gray: "G", red: "R", brown: "B", white: "W" };

  /* ---------- pure genetics (unit-testable) ---------- */
  function rank(b) { return BASES.indexOf(b); }
  function patAlleles(v) { return v === 1 ? ["P", "P"] : v === 2 ? ["P", "p"] : ["p", "p"]; }
  function litterSize(r) { // demo values: 2 sometimes, 3-5 usual, 6 rarely
    var x = r.next();
    return x < 0.12 ? 2 : x < 0.40 ? 3 : x < 0.68 ? 4 : x < 0.95 ? 5 : 6;
  }
  function visibleBase(alleles) { return rank(alleles[0]) <= rank(alleles[1]) ? alleles[0] : alleles[1]; }
  function makePup(a, b, r) {
    var ba = [r.pick([a.base, a.carry || a.base]), r.pick([b.base, b.carry || b.base])];
    ba.sort(function (x, y) { return rank(x) - rank(y); });
    var pat = {};
    PATS.forEach(function (k) {
      var x = r.pick(patAlleles(a.pat[k])), y = r.pick(patAlleles(b.pat[k]));
      pat[k] = (x === "P" ? "P" : "p") + (y === "P" ? "P" : "p");
      if (pat[k] === "pP") pat[k] = "Pp";
    });
    return { alleles: ba, pat: pat, seed: Math.floor(r.next() * 0xFFFFFF) + 1 };
  }
  function breed(a, b, litterSeed) {
    var r = D.rng(litterSeed), n = litterSize(r), out = [];
    for (var i = 0; i < n; i++) out.push(makePup(a, b, r));
    return out;
  }
  function phenotype(p) {
    var pt = {};
    PATS.forEach(function (k) { pt[k] = p.pat[k].indexOf("P") >= 0; });
    return { base: visibleBase(p.alleles), patterns: pt };
  }
  function lookKey(p) {
    var ph = phenotype(p);
    return ph.base + "|" + PATS.map(function (k) { return ph.patterns[k] ? 1 : 0; }).join("");
  }
  function distinctLooks(l) { var s = {}; l.forEach(function (p) { s[lookKey(p)] = 1; }); return Object.keys(s).length; }
  function encode(p) { return p.alleles.join(".") + "|" + PATS.map(function (k) { return p.pat[k]; }).join(",") + "|" + p.seed.toString(16); }
  function decode(s) {
    var a = s.split("|"), pat = {}, bits = a[1].split(",");
    PATS.forEach(function (k, i) { pat[k] = bits[i]; });
    return { alleles: a[0].split("."), pat: pat, seed: parseInt(a[2], 16) };
  }
  function dogOpts(p, extra) {
    var ph = phenotype(p), o = { base: ph.base, patterns: ph.patterns, seed: p.seed, stage: "puppy", pose: "stand" };
    for (var k in (extra || {})) o[k] = extra[k];
    return o;
  }
  function parentOf(base, carry, s, c, b, p) { return { base: base, carry: carry, pat: { socks: s, chest: c, blaze: b, patches: p } }; }
  var PRESETS = {
    pure: [parentOf("red", null, 0, 1, 0, 0), parentOf("red", null, 0, 1, 0, 0)],
    mixed: [parentOf("black", "red", 2, 0, 1, 2), parentOf("gray", "brown", 1, 2, 0, 2)],
    carriers: [parentOf("black", "white", 0, 0, 2, 0), parentOf("black", "white", 0, 0, 2, 0)]
  };
  function avgLooks(a, b, n) {
    var tot = 0, sz = 0;
    for (var i = 1; i <= n; i++) { var l = breed(a, b, 90000 + i); tot += distinctLooks(l); sz += l.length; }
    return { looks: tot / n, size: sz / n };
  }
  D.lib.coats = { breed: breed, phenotype: phenotype, lookKey: lookKey, distinctLooks: distinctLooks, encode: encode, decode: decode,
    dogOpts: dogOpts, PRESETS: PRESETS, avgLooks: avgLooks, litterSize: litterSize, PATS: PATS };

  /* ---------- labels ---------- */
  function baseName(id) {
    switch (id) {
      case "black": return t("demos.coats.base.black", "Black");
      case "gray": return t("demos.coats.base.gray", "Gray");
      case "red": return t("demos.coats.base.red", "Golden");
      case "brown": return t("demos.coats.base.brown", "Brown");
      default: return t("demos.coats.base.white", "White");
    }
  }
  function patName(k) {
    switch (k) {
      case "socks": return t("demos.coats.pat.socks", "White socks");
      case "chest": return t("demos.coats.pat.chest", "White chest");
      case "blaze": return t("demos.coats.pat.blaze", "Face blaze");
      default: return t("demos.coats.pat.patches", "Patches");
    }
  }
  function describe(p) {
    var ph = phenotype(p), bits = [baseName(ph.base)];
    PATS.forEach(function (k) { if (ph.patterns[k]) bits.push(patName(k).toLowerCase()); });
    return bits.join(", ");
  }
  function geneText(p) {
    return p.alleles.map(function (a) { return LETTER[a]; }).join("/") + " · " +
      PATS.map(function (k) { return k.charAt(0).toUpperCase() + ":" + p.pat[k]; }).join(" ");
  }

  /* ---------- UI ---------- */
  D.register("coats", function (el, ctx) {
    var S = 3, CW = 28, CH = 19;
    var parents = [JSON.parse(JSON.stringify(PRESETS.mixed[0])), JSON.parse(JSON.stringify(PRESETS.mixed[1]))];
    var litter = [], seedVal = 1, reveal = false, frame = 0, lastKnown = null;

    el.appendChild(ui.header(ctx, ["demos.coats.title", "Coat lab: genes + seed"],
      ["demos.coats.blurb", "Pick two parents and breed a litter. A coat is stored as genes plus a seed, never as a picture, so the same genes and seed always redraw the same dog. In the real mod genes stay hidden (no scanner); the reveal toggle here is only for this demo."]));

    var parentBox = h("div", { class: "spd-parents" });
    var ariaUpd = [], pcanv = [], baseSel = [], carrySel = [], patSel = [];

    function carryOptions(base) {
      var opts = [{ value: "", label: ["demos.coats.carry.none", "none"] }];
      BASES.forEach(function (b) { if (rank(b) > rank(base)) opts.push({ value: b, label: ["demos.coats.base." + b, baseName(b)] }); });
      return opts;
    }
    function fillCarry(i) {
      var sel = carrySel[i], p = parents[i];
      while (sel.firstChild) sel.removeChild(sel.firstChild);
      carryOptions(p.base).forEach(function (o) {
        var op = h("option", { value: o.value, text: o.value ? baseName(o.value) : t("demos.coats.carry.none", "none") });
        op.__v = o.value; sel.appendChild(op);
      });
      if (p.carry && rank(p.carry) <= rank(p.base)) p.carry = null;
      sel.value = p.carry || "";
    }
    function relabelSelects() {
      parents.forEach(function (p, i) {
        Array.prototype.forEach.call(baseSel[i].options, function (op) { op.textContent = baseName(op.value); });
        Array.prototype.forEach.call(carrySel[i].options, function (op) { op.textContent = op.value ? baseName(op.value) : t("demos.coats.carry.none", "none"); });
      });
    }
    function patStateLabel(v) {
      return v === 0 ? t("demos.coats.pstate.off", "off") : v === 1 ? t("demos.coats.pstate.on", "on") : t("demos.coats.pstate.carrier", "on, carries \"off\"");
    }
    function buildParent(i) {
      var p = parents[i], title = h("h4", { class: "spd-card-title" });
      ctx.bind(title, function () { return i === 0 ? t("demos.coats.parentA", "Parent A") : t("demos.coats.parentB", "Parent B"); });
      var cv = h("canvas", { class: "spd-canvas", width: CW * S, height: CH * S, role: "img" });
      ariaUpd[i] = ctx.bind(cv, function () { return t("demos.coats.parentAria", "Parent {n}: {look}", { n: i === 0 ? "A" : "B", look: describe(dogOptsToPup(p)) }); }, "aria-label");
      pcanv[i] = cv;
      var id = ctx.id + "-p" + i;
      baseSel[i] = h("select", { class: "spd-select", id: id + "-base", onchange: function () { p.base = this.value; fillCarry(i); redrawParents(); } });
      BASES.forEach(function (b) { baseSel[i].appendChild(h("option", { value: b, text: baseName(b) })); });
      baseSel[i].value = p.base;
      carrySel[i] = h("select", { class: "spd-select", id: id + "-carry", onchange: function () { p.carry = this.value || null; } });
      var box = h("div", { class: "mc-panel spd-card spd-parent" }, [title, h("div", { class: "spd-canvas-wrap" }, [cv]),
        ui.field(ctx, id + "-base", ["demos.coats.baseColor", "Coat color"], baseSel[i]),
        ui.field(ctx, id + "-carry", ["demos.coats.hidden", "Hidden carrier of"], carrySel[i])]);
      patSel[i] = {};
      PATS.forEach(function (k) {
        var s = h("select", { class: "spd-select", id: id + "-" + k, onchange: function () { p.pat[k] = parseInt(this.value, 10); redrawParents(); } });
        [0, 1, 2].forEach(function (v) { s.appendChild(h("option", { value: v, text: patStateLabel(v) })); });
        s.value = p.pat[k]; patSel[i][k] = s;
        var lab = h("label", { class: "spd-field-label", for: id + "-" + k }); ctx.bind(lab, function () { return patName(k); });
        box.appendChild(h("div", { class: "spd-field" }, [lab, s]));
      });
      fillCarry(i);
      return box;
    }
    function dogOptsToPup(p) { // parent -> displayable (homozygous-looking) record
      var pat = {}; PATS.forEach(function (k) { pat[k] = p.pat[k] ? "PP" : "pp"; });
      return { alleles: [p.base, p.carry || p.base], pat: pat, seed: 7 };
    }
    function drawAt(c, opts) {
      var g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height);
      opts.scale = S; opts.x = 2 * S; opts.y = 2 * S; opts.shadow = true; D.drawDog(g, opts);
    }
    function redrawParents() {
      parents.forEach(function (p, i) {
        var o = dogOpts(dogOptsToPup(p), { stage: "adult", seed: i ? 22 : 11, frame: frame }); drawAt(pcanv[i], o);
        if (ariaUpd[i]) ariaUpd[i]();
      });
    }
    parents.forEach(function (p, i) { parentBox.appendChild(buildParent(i)); });
    el.appendChild(parentBox);

    function setParents(pr) {
      parents.forEach(function (p, i) {
        p.base = pr[i].base; p.carry = pr[i].carry; PATS.forEach(function (k) { p.pat[k] = pr[i].pat[k]; });
        baseSel[i].value = p.base; fillCarry(i); carrySel[i].value = p.carry || "";
        PATS.forEach(function (k) { patSel[i][k].value = p.pat[k]; });
      });
      redrawParents();
    }

    /* controls */
    var status = ui.status(ctx);
    var seedId = ctx.id + "-seed";
    var seedIn = h("input", { class: "spd-input", id: seedId, type: "number", min: 1, max: 999999, value: seedVal, onchange: function () { seedVal = Math.max(1, Math.floor(+this.value) || 1); this.value = seedVal; } });
    var presetRow = h("div", { class: "spd-row" }, [
      ui.button(ctx, ["demos.coats.presetPure", "Preset: pure golden line"], function () { setParents(PRESETS.pure); doBreed(true); }),
      ui.button(ctx, ["demos.coats.presetMixed", "Preset: mixed parents"], function () { setParents(PRESETS.mixed); doBreed(true); }),
      ui.button(ctx, ["demos.coats.presetCarriers", "Preset: hidden carriers"], function () { setParents(PRESETS.carriers); doBreed(true); })]);
    var revealId = ctx.id + "-reveal";
    var revealCb = h("input", { type: "checkbox", id: revealId, class: "spd-check", onchange: function () { reveal = this.checked; renderLitter(false); } });
    var revealLab = h("label", { for: revealId, class: "spd-check-label" }); ctx.tx(revealLab, "demos.coats.reveal", "Reveal genes (demo only)");
    var breedBtn = ui.button(ctx, ["demos.coats.breed", "Breed"], function () { doBreed(false); }, "mc-btn--green");
    var detBtn = ui.button(ctx, ["demos.coats.determinism", "Determinism check"], function () { determinism(); });
    var statBtn = ui.button(ctx, ["demos.coats.stats", "Run 200 test litters"], function () { runStats(); });
    var controls = h("div", { class: "spd-row spd-controls" }, [
      ui.field(ctx, seedId, ["demos.coats.litterSeed", "Litter seed"], seedIn), breedBtn, h("span", { class: "spd-check-wrap" }, [revealCb, revealLab]), detBtn, statBtn]);
    el.appendChild(presetRow); el.appendChild(controls); el.appendChild(status.el);
    var results = h("p", { class: "mc-note spd-note", role: "status", "aria-live": "polite" }); el.appendChild(results);
    var resCur = null; var resUpd = ctx.bind(results, function () { return resCur ? t(resCur[0], resCur[1], resCur[2]) : t("demos.coats.hint", "Same parents and same litter seed always give the same litter. Change the seed to replay a different one."); });
    function setRes(k, fb, v) { resCur = [k, fb, v]; resUpd(); }

    var grid = h("div", { class: "spd-litter", "aria-label": t("demos.coats.litterAria", "Litter") });
    ctx.bind(grid, function () { return t("demos.coats.litterAria", "Litter"); }, "aria-label");
    el.appendChild(grid);
    el.appendChild(h("p", { class: "spd-foot" }, [(function () { var s = h("span"); ctx.tx(s, "demos.coats.foot", "Demo values: dominance order (black > gray > golden > brown > white), litter size odds, and the patterns' on/off model are simplified stand-ins, not final design."); return s; })()]));

    var pupCanvas = [];
    function pupLabel(p, i) { return t("demos.coats.pupAria", "Puppy {n}: {look}", { n: i + 1, look: describe(p) }); }
    function renderLitter(animate) {
      while (grid.firstChild) grid.removeChild(grid.firstChild);
      pupCanvas = [];
      litter.forEach(function (p, i) {
        var cv = h("canvas", { class: "spd-canvas", width: CW * S, height: CH * S, role: "img" });
        var ph = phenotype(p), surprise = parents.every(function (pa) { return pa.base !== ph.base; });
        var card = h("div", { class: "mc-panel mc-panel--dark spd-pup" + (animate ? " spd-pop" : ""), style: "animation-delay:" + (i * 90) + "ms" });
        var nm = h("div", { class: "spd-pup-name" }); ctx.bind(nm, function () { return t("demos.coats.pup", "Pup {n}", { n: i + 1 }); });
        var look = h("div", { class: "spd-pup-look" }); ctx.bind(look, function () { return describe(p); });
        ctx.bind(cv, function () { return pupLabel(p, i); }, "aria-label");
        card.appendChild(h("div", { class: "spd-canvas-wrap" }, [cv])); card.appendChild(nm); card.appendChild(look);
        if (surprise) { var b = h("span", { class: "mc-badge mc-badge--progress spd-surprise" }); ctx.tx(b, "demos.coats.surprise", "Recessive surprise"); card.appendChild(b); }
        if (reveal) card.appendChild(h("code", { class: "spd-genes", text: geneText(p) }));
        grid.appendChild(card); pupCanvas.push(cv);
      });
      drawLitter();
    }
    function drawLitter() { litter.forEach(function (p, i) { if (pupCanvas[i]) drawAt(pupCanvas[i], dogOpts(p, { frame: frame, mood: "happy" })); }); }

    function doBreed(fromPreset) {
      var sd = seedVal;
      // mix the parents' genes into the litter seed so changing a parent changes the litter
      litter = breed(parents[0], parents[1], D.hashStr(JSON.stringify(parents) + "#" + sd));
      renderLitter(!ctx.reduced());
      seedVal = sd + 1; seedIn.value = seedVal;
      lastKnown = { n: litter.length, looks: distinctLooks(litter), seed: sd };
      status.set("demos.coats.born", "Litter {n} born with {looks} distinct look(s) (seed {seed}).", lastKnown);
      setRes("demos.coats.hint", "Same parents and same litter seed always give the same litter. Change the seed to replay a different one.");
    }
    function determinism() {
      if (!litter.length) { doBreed(false); }
      var ok = 0, hashes = [];
      litter.forEach(function (p) {
        var h1 = D.spriteHash(dogOpts(p, { mood: "happy" }));
        var back = decode(encode(p));
        var h2 = D.spriteHash(dogOpts(back, { mood: "happy" }));
        var h3 = D.spriteHash(dogOpts(p, { mood: "happy" }));
        if (h1 === h2 && h2 === h3) ok++;
        hashes.push(h1);
      });
      drawLitter();
      var same = ok === litter.length;
      if (same) {
        setRes("demos.coats.identical", "Identical: all {n} puppies were redrawn from their genes + seed and match pixel for pixel.", { n: litter.length });
        status.set("demos.coats.identicalShort", "Determinism check: identical.");
      } else {
        setRes("demos.coats.notIdentical", "Mismatch found in {bad} of {n} puppies.", { n: litter.length, bad: litter.length - ok });
        status.set("demos.coats.notIdenticalShort", "Determinism check: mismatch.");
      }
    }
    function runStats() {
      var cur = avgLooks(parents[0], parents[1], 200), pure = avgLooks(PRESETS.pure[0], PRESETS.pure[1], 200);
      var v = { cur: cur.looks.toFixed(2), pure: pure.looks.toFixed(2), size: cur.size.toFixed(1) };
      setRes("demos.coats.statsResult", "200 test litters: your parents average {cur} distinct looks per litter (average size {size}); the pure golden line averages {pure}.", v);
      status.set("demos.coats.statsShort", "Test litters done: {cur} distinct looks on average.", v);
    }

    ctx.onLang(function () { relabelSelects(); renderLitter(false); });
    redrawParents(); doBreed(true);
    if (!ctx.reduced()) {
      ctx.loop(function (dt, n) { frame = (n >> 2) & 1; redrawParentsQuiet(); drawLitter(); }, 6);
    }
    function redrawParentsQuiet() {
      parents.forEach(function (p, i) { drawAt(pcanv[i], dogOpts(dogOptsToPup(p), { stage: "adult", seed: i ? 22 : 11, frame: frame })); });
    }
  });
})(typeof window !== "undefined" ? window : globalThis);
