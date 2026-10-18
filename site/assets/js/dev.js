/* Developers page behavior. Owner: C. Progressive enhancement: without JS every panel is visible and
   the tab links are plain in-page anchors. With JS: accessible tabs, arrow keys, hash deep links,
   repo link rewriting from status.json, copy buttons and the roadmap rendered from SP.loadStatus(). */
(function () {
  "use strict";
  var app = document.querySelector(".dev-app");
  if (!app) return;
  var tabs = Array.prototype.slice.call(app.querySelectorAll('[role="tab"]'));
  var panels = Array.prototype.slice.call(app.querySelectorAll('[role="tabpanel"]'));
  var tocLinks = Array.prototype.slice.call(app.querySelectorAll("[data-toc]"));
  var sub = document.getElementById("dev-toc-sub");
  var current = null;

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function panelOf(node) { while (node && node !== app) { if (node.getAttribute && node.getAttribute("role") === "tabpanel") return node; node = node.parentNode; } return null; }
  function reducedMotion() { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }

  function buildSub(panel) {
    if (!sub) return;
    sub.textContent = "";
    var hs = panel.querySelectorAll("h3[id]");
    if (!hs.length) { sub.hidden = true; return; }
    sub.appendChild(el("h2", {}, "On this tab"));
    var ul = el("ul");
    Array.prototype.forEach.call(hs, function (h) {
      var li = el("li"), a = el("a", { href: "#" + h.id }, h.textContent.replace(/\s*\[[DPOT]\]\s*$/, ""));
      li.appendChild(a); ul.appendChild(li);
    });
    sub.appendChild(ul);
    sub.hidden = false;
  }

  function activate(id, opts) {
    opts = opts || {};
    var panel = document.getElementById(id);
    if (!panel || panels.indexOf(panel) < 0) { id = panels[0].id; panel = panels[0]; }
    current = id;
    panels.forEach(function (p) { p.hidden = p !== panel; });
    tabs.forEach(function (t) {
      var on = t.getAttribute("aria-controls") === id;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    tocLinks.forEach(function (a) { if (a.getAttribute("data-toc") === id) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    buildSub(panel);
    var label = "";
    tabs.forEach(function (t) { if (t.getAttribute("aria-controls") === id) label = t.textContent; });
    document.title = "Smart Pets - Developers - " + label;
    if (opts.focusTab) { tabs.forEach(function (t) { if (t.getAttribute("aria-controls") === id) t.focus(); }); }
    if (opts.scrollTop) { var top = app.querySelector(".mc-tabs").getBoundingClientRect().top + window.pageYOffset - 90; if (window.pageYOffset > top) window.scrollTo(0, Math.max(0, top)); }
  }

  function fromHash(initial) {
    var h = decodeURIComponent((location.hash || "").replace(/^#/, ""));
    var target = h ? document.getElementById(h) : null;
    var panel = target ? panelOf(target) || (panels.indexOf(target) >= 0 ? target : null) : null;
    activate(panel ? panel.id : (current || panels[0].id), { scrollTop: !initial && !target });
    if (target && target !== panel) { target.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" }); }
  }

  function setHash(id) {
    try { history.replaceState(null, "", "#" + id); } catch (e) { location.hash = id; }
  }

  app.classList.add("dev-js");
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function (ev) {
      ev.preventDefault();
      var id = t.getAttribute("aria-controls");
      activate(id, { scrollTop: true }); setHash(id);
    });
    t.addEventListener("keydown", function (ev) {
      var n = tabs.length, j = -1;
      if (ev.key === "ArrowRight" || ev.key === "ArrowDown") j = (i + 1) % n;
      else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") j = (i - 1 + n) % n;
      else if (ev.key === "Home") j = 0;
      else if (ev.key === "End") j = n - 1;
      if (j < 0) return;
      ev.preventDefault();
      var id = tabs[j].getAttribute("aria-controls");
      activate(id, { focusTab: true }); setHash(id);
    });
  });
  tocLinks.forEach(function (a) {
    a.addEventListener("click", function (ev) { ev.preventDefault(); var id = a.getAttribute("data-toc"); activate(id, { scrollTop: true }); setHash(id); });
  });
  if (sub) sub.addEventListener("click", function (ev) {
    var a = ev.target.closest ? ev.target.closest("a") : null;
    if (!a) return;
    var t = document.getElementById(a.getAttribute("href").slice(1));
    if (!t) return;
    ev.preventDefault(); setHash(t.id);
    t.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  });
  window.addEventListener("hashchange", function () { fromHash(false); });
  fromHash(true);

  /* Copy buttons on code blocks */
  Array.prototype.forEach.call(app.querySelectorAll("pre.mc-code"), function (pre) {
    if (!navigator.clipboard) return;
    var txt = pre.textContent;
    var b = el("button", { type: "button", class: "dev-copy", "aria-label": "Copy code" }, "COPY");
    b.addEventListener("click", function () {
      navigator.clipboard.writeText(txt).then(function () { b.textContent = "COPIED"; setTimeout(function () { b.textContent = "COPY"; }, 1500); }, function () {});
    });
    pre.appendChild(b);
  });

  /* Roadmap from data/status.json + repo link rewrite */
  var STATE = { done: "DONE", progress: "IN PROGRESS", planned: "PLANNED", research: "RESEARCH" };
  function badge(state) { return el("span", { class: "mc-badge mc-badge--" + (STATE[state] ? state : "planned") }, STATE[state] || String(state).toUpperCase()); }
  function renderRoadmap(box, status) {
    box.textContent = "";
    (status.phases || []).forEach(function (ph) {
      var card = el("div", { class: "dev-phase" });
      var h = el("h4"); h.appendChild(document.createTextNode(ph.name + " ")); h.appendChild(badge(ph.state)); card.appendChild(h);
      if (typeof ph.progress === "number") {
        var bar = el("div", { class: "mc-xp", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(ph.progress), "aria-label": ph.name + " progress" });
        var fill = el("span"); fill.style.width = Math.max(0, Math.min(100, ph.progress)) + "%"; bar.appendChild(fill); card.appendChild(bar);
        card.appendChild(el("p", { class: "dev-cap" }, ph.progress + "% (as stated in status.json)"));
      }
      if (ph.summary) card.appendChild(el("p", {}, ph.summary));
      var ul = el("ul");
      (ph.items || []).forEach(function (it) { var li = el("li"); li.appendChild(badge(it.state)); li.appendChild(el("span", {}, it.name)); ul.appendChild(li); });
      card.appendChild(ul); box.appendChild(card);
    });
    box.appendChild(el("p", { class: "dev-cap" }, "Status data updated " + (status.updated || "unknown") + "."));
  }
  if (window.SP && SP.loadStatus) {
    SP.loadStatus().then(function (status) {
      var repo = status && status.links && status.links.repo;
      if (repo) {
        Array.prototype.forEach.call(app.querySelectorAll("a[data-repo]"), function (a) {
          a.href = repo.replace(/\/$/, "") + "/blob/main/" + a.getAttribute("data-repo");
        });
      }
      var box = document.getElementById("dev-roadmap");
      if (box) renderRoadmap(box, status);
    }).catch(function () {
      var box = document.getElementById("dev-roadmap");
      if (box) box.textContent = "Could not load data/status.json. Open it directly: data/status.json.";
    });
  }
})();
