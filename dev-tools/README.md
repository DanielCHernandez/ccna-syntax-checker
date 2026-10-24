# Developer test tools

Used by Claude to check every change before it ships. Not part of the
app; nothing here is loaded by any page.

- `syncjs.py <version-folder> <version>` — regenerates
  `ios-engine-vX.js` from the engine section of `terminal-vX.html`
  (run after every engine edit; keeps the reference copy in sync).
- `regress.js <ios-engine-vX.js> <out.txt>` — plays every Syntax
  Checker exercise's expected commands and writes the full transcript.
  Diff against the newest `regress-baseline-v*.txt`: any difference must be
  an intended output change.
- `labsmoke.mjs <chrome-profile-dir> <url>` — headless Chrome: loads
  every Home Lab, pokes every device, checks for page errors and text
  sizing. Needs a local server (e.g. `python3 -m http.server`) and
  `node --experimental-websocket`.
- `lab1646.mjs <chrome-profile-dir> <screenshot-dir> <url>` — plays
  Home Lab 16.4.6 end to end through the real UI (plus 10.3 / 10.3.5
  checks): 34 checks against the real Packet Tracer captures.
- `abbrev-test.js <ios-engine-vX.js>` — (v1.42.2) Guided Practice
  equivalence: every exercise's exact commands accepted, common
  shorthand rewrites (conf t, int g0/0/0, sh, shut, run/start...)
  accepted, and "one number changed" wrong answers rejected.
- `lab291.mjs <chrome-profile-dir> <url>` — (v1.43.0) Home Lab 2.9.1 end
  to end, plus the "^" error marker in all three terminals.
