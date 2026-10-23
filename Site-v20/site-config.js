// ============================================================
// Site v20 — shared settings. This is the ONE place to change
// where every "Open CLI Engine" link on the site points.
// ============================================================
//
// Leave CLI_ENGINE_URL empty ("") when the CLI Engine is hosted
// together with these notes (the default). The links then use the
// relative path cli-engine/ccna-cli-engine.html, which works on any
// host and when opened straight from disk.
//
// If the notes and the engine are hosted in different places (e.g.
// notes on Netlify, engine on GitHub Pages), put the engine's full
// URL here instead, for example:
//   var CLI_ENGINE_URL = "https://danielchernandez.github.io/ccna-syntax-checker/Site-v20/cli-engine/ccna-cli-engine.html";
var CLI_ENGINE_URL = "";

(function () {
  if (!CLI_ENGINE_URL) return;
  function apply() {
    var links = document.querySelectorAll('a.cli-engine-link');
    for (var i = 0; i < links.length; i++) links[i].href = CLI_ENGINE_URL;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
  else apply();
})();
