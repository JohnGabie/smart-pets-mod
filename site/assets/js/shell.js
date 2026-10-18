/* Injects the shared header/footer and exposes SP.loadStatus(). Pages provide <header id="sp-header"></header> and <footer id="sp-footer"></footer>.
   Pages set document.body.dataset.page = "home" | "dev". Built with DOM APIs (no innerHTML). */
(function () {
  var SP = (window.SP = window.SP || {});
  function el(tag, attrs, text) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
  SP.loadStatus = function () { return fetch("data/status.json").then(function (r) { return r.json(); }); };
  function build(status) {
    var page = document.body.dataset.page || "home";
    var h = document.getElementById("sp-header");
    if (h) {
      h.className = "sp-header"; h.textContent = "";
      var c = el("div", { class: "sp-container" }); h.appendChild(c);
      var brand = el("a", { class: "sp-brand", href: "index.html" }); brand.appendChild(el("img", { src: "assets/img/logo.svg", width: "32", height: "32", alt: "" }));
      brand.appendChild(el("span", {}, "SMART PETS")); c.appendChild(brand);
      var nav = el("nav", { class: "sp-nav", "aria-label": "Main" }); c.appendChild(nav);
      var a1 = el("a", { class: "mc-btn", href: "index.html", "data-i18n": "nav.players" }, "Players"); if (page === "home") a1.setAttribute("aria-current", "page");
      var a2 = el("a", { class: "mc-btn", href: "dev.html", "data-i18n": "nav.devs" }, "Developers"); if (page === "dev") a2.setAttribute("aria-current", "page");
      var a3 = el("a", { class: "mc-btn", href: (status && status.links && status.links.repo) || "#", rel: "noopener" }, "GitHub");
      var lb = el("button", { class: "mc-btn", type: "button", "aria-label": "Language" }, "EN / PT");
      lb.addEventListener("click", function () { SP.setLang(SP.getLang() === "en" ? "pt-BR" : "en"); });
      [a1, a2, a3, lb].forEach(function (n) { nav.appendChild(n); });
    }
    var f = document.getElementById("sp-footer");
    if (f) {
      f.className = "sp-footer"; f.textContent = "";
      var fc = el("div", { class: "sp-container" }); f.appendChild(fc);
      fc.appendChild(el("div", {}, "Smart Pets — a fan-made mod concept. Not affiliated with Mojang or Microsoft."));
      fc.appendChild(el("div", {}, "Status updated " + ((status && status.updated) || "") + " · " + ((status && status.project && status.project.license) || "")));
    }
    if (window.SP.apply) SP.apply();
  }
  document.addEventListener("DOMContentLoaded", function () { SP.loadStatus().then(build).catch(function () { build(null); }); });
})();
