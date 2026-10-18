/* Tiny i18n. Modules: window.SP_I18N_MODULES (default ["common"]). Files: i18n/<module>.<lang>.json
   Use: <span data-i18n="key">fallback</span>  |  data-i18n-attr="aria-label:key,title:key2"  |  SP.t("key","fallback") */
(function () {
  var SP = (window.SP = window.SP || {});
  var LANGS = ["en", "pt-BR"], dict = {}, lang = "en";
  function pick() {
    try { var s = localStorage.getItem("sp-lang"); if (s && LANGS.indexOf(s) >= 0) return s; } catch (e) {}
    return (navigator.language || "en").toLowerCase().indexOf("pt") === 0 ? "pt-BR" : "en";
  }
  function apply(root) {
    (root || document).querySelectorAll("[data-i18n]").forEach(function (el) {
      var v = dict[el.getAttribute("data-i18n")]; if (v != null) el.textContent = v;
    });
    (root || document).querySelectorAll("[data-i18n-attr]").forEach(function (el) {
      el.getAttribute("data-i18n-attr").split(",").forEach(function (pair) {
        var p = pair.split(":"); var v = dict[p[1] && p[1].trim()]; if (v != null) el.setAttribute(p[0].trim(), v);
      });
    });
    document.documentElement.lang = lang;
  }
  function load() {
    var mods = window.SP_I18N_MODULES || ["common"];
    return Promise.all(mods.map(function (m) {
      return fetch("i18n/" + m + "." + lang + ".json").then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
    })).then(function (parts) { dict = Object.assign.apply(null, [{}].concat(parts)); apply(); document.dispatchEvent(new CustomEvent("sp:lang", { detail: lang })); });
  }
  SP.t = function (k, fb) { return dict[k] != null ? dict[k] : (fb != null ? fb : k); };
  SP.apply = apply;
  SP.getLang = function () { return lang; };
  SP.setLang = function (l) { if (LANGS.indexOf(l) < 0) return; lang = l; try { localStorage.setItem("sp-lang", l); } catch (e) {} return load(); };
  SP.langs = LANGS;
  lang = pick();
  SP.ready = new Promise(function (res) { document.addEventListener("DOMContentLoaded", function () { load().then(res); }); });
})();
