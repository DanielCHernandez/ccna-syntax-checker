# Site v20 — CCNA NetAcad Study Hub + Simple Syntax Checker + CLI Engine

Built 2026-10-22 from `site_v19` (Dropbox: `CCNA Study/Claude-NetAcad/site_v19.zip`)
plus the CLI Engine at v1.41.0. "Site v20" is the version of this combined
folder; it is separate from the CLI Engine's own version number.

```
Site-v20/
├── index.html                  landing page: Study Hub + both tools, per course (each opens in a new window)
├── site-config.js              the ONE setting for where "Open CLI Engine" links point (see below)
├── update-cli-engine.sh        copies the newest engine into cli-engine/
├── study-hub/ccna{1,2,3}/      course index + module notes (47 module pages)
├── syntax-checker-simple/      ccna{1,2,3}_syntax_checker.html (open with ?lab=X.X.X)
├── cli-engine/
│   └── ccna-cli-engine.html    stable name; always holds the current engine version
├── _headers                    Netlify headers (iframe rules)
└── iframe_test.html            old debugging page from site_v19, paths updated
```

## When the CLI Engine gets a new version

Run `sh Site-v20/update-cli-engine.sh`. It finds the highest
`Syn-Checker vX.Y.Z/` folder and copies its `terminal-vX.Y.Z.html` to
`cli-engine/ccna-cli-engine.html`. Nothing in `study-hub/` or
`syntax-checker-simple/` mentions the engine's version or filename, so
nothing else changes. (The engine is a single self-contained HTML file;
the `ios-engine-vX.Y.Z.js` beside it is only a Node-testing copy and is
not needed here.)

One soft dependency: each module's "Open CLI Engine" text names the
engine's exercise-menu entry (e.g. "Course 1 · 10.1 — Configure Initial
Router Settings"). If an engine release renames a Syntax Checker
exercise, that hint text goes stale. The link itself still works.

## Hosting the notes and the engine in different places

All links inside the site are relative, so the whole folder works on
any host or straight from disk. If the notes go somewhere the engine
isn't (e.g. notes on Netlify, engine on GitHub Pages), set
`CLI_ENGINE_URL` in `site-config.js` to the engine's full URL. Every
"Open CLI Engine" link on the landing page and the module pages follows it.
