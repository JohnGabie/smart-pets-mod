/* Smart Pets landing page behavior. Owner: landing (agent A).
   - Repo link from data/status.json
   - FAQ answers with {version}/{license} placeholders
   - Roadmap rendered from data/status.json (DOM APIs only, no innerHTML)
   - Mounts the concept demos through window.SPDemos.mount(name, element) */
(function () {
  "use strict";
  var SP = (window.SP = window.SP || {});
  var status = null;

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) { if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]); }
    if (text != null) e.textContent = text;
    return e;
  }
  function t(key, fallback) { return SP.t ? SP.t(key, fallback) : (fallback != null ? fallback : key); }
  function fmt(str, vars) {
    return str.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; });
  }
  var STATES = ["done", "progress", "planned", "research"];
  function stateOf(s) { return STATES.indexOf(s) >= 0 ? s : "planned"; }

  /* ---------- status-driven bits ---------- */
  function applyLinks() {
    var a = document.getElementById("cta-github");
    if (a && status && status.links && status.links.repo) a.setAttribute("href", status.links.repo);
  }
  function applyFormatted() {
    if (!status) return; // keep the pre-filled English fallback until the data is here
    var vars = {
      version: (status && status.project && status.project.targetVersion) || "",
      license: (status && status.project && status.project.license) || ""
    };
    document.querySelectorAll("[data-fmt]").forEach(function (n) {
      var key = n.getAttribute("data-fmt");
      n.textContent = fmt(t(key, n.textContent), vars);
    });
  }

  function badge(state) {
    var s = stateOf(state);
    return el("span", { class: "mc-badge mc-badge--" + s }, t("landing.state." + s, s));
  }

  function renderRoadmap() {
    var grid = document.getElementById("road-grid");
    var upd = document.getElementById("road-updated");
    if (!grid) return;
    if (!status || !Array.isArray(status.phases)) {
      grid.textContent = "";
      grid.appendChild(el("p", { class: "mc-note" }, t("landing.road.failed", "The roadmap could not load.")));
      return;
    }
    if (upd) upd.textContent = fmt(t("landing.road.updated", "Status updated {date}"), { date: status.updated || "" });
    grid.textContent = "";
    status.phases.forEach(function (ph) {
      var id = String(ph.id || "");
      var name = t("landing.road." + id + ".name", ph.name);
      var summary = t("landing.road." + id + ".summary", ph.summary);
      var pct = Math.max(0, Math.min(100, Number(ph.progress) || 0));
      var panel = el("article", { class: "mc-panel road-panel", "aria-labelledby": "road-" + id });
      var head = el("div", { class: "road-head" });
      head.appendChild(el("h3", { id: "road-" + id }, name));
      head.appendChild(badge(ph.state));
      panel.appendChild(head);
      var bar = el("div", { class: "mc-xp", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100",
        "aria-valuenow": String(pct), "aria-label": name + ": " + t("landing.road.progress", "progress") });
      var fill = el("span"); fill.style.width = pct + "%"; bar.appendChild(fill);
      panel.appendChild(bar);
      panel.appendChild(el("p", { class: "road-pct" }, pct + "%"));
      if (summary) panel.appendChild(el("p", { class: "road-summary" }, summary));
      if (Array.isArray(ph.items) && ph.items.length) {
        var ul = el("ul", { class: "road-items" });
        ph.items.forEach(function (it) {
          var li = el("li");
          li.appendChild(badge(it.state));
          li.appendChild(el("span", {}, it.name));
          ul.appendChild(li);
        });
        panel.appendChild(ul);
      }
      grid.appendChild(panel);
    });
  }

  /* ---------- demos ---------- */
  function showDemoFailed(host) {
    host.textContent = "";
    var note = el("p", { class: "mc-note demo-failed", "data-i18n": "landing.demos.failed" }, "The demo could not load. Try reloading the page.");
    host.appendChild(note);
    if (SP.apply) SP.apply(host);
  }
  function mountDemos(isRetry) {
    var hosts = document.querySelectorAll("[data-demo]");
    var ready = window.SPDemos && typeof window.SPDemos.mount === "function";
    if (!ready && !isRetry) {
      // The deferred demo scripts may still be running: retry once after full load.
      window.addEventListener("load", function () { mountDemos(true); }, { once: true });
      return;
    }
    hosts.forEach(function (host) {
      if (host.getAttribute("data-mounted") === "1") return;
      if (!ready) { showDemoFailed(host); return; }
      try {
        window.SPDemos.mount(host.getAttribute("data-demo"), host);
        host.setAttribute("data-mounted", "1");
      } catch (e) {
        if (window.console) console.error("Demo failed:", host.getAttribute("data-demo"), e);
        showDemoFailed(host);
      }
    });
  }

  /* ---------- boot ---------- */
  function init() {
    var ready = SP.ready || Promise.resolve();
    ready.then(function () { mountDemos(false); });
    Promise.all([SP.loadStatus ? SP.loadStatus() : Promise.reject(new Error("no shell")), ready]).then(function (r) {
      status = r[0];
      applyLinks(); applyFormatted(); renderRoadmap();
    }).catch(function () {
      renderRoadmap();
    });
    document.addEventListener("sp:lang", function () { applyFormatted(); if (status) renderRoadmap(); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
