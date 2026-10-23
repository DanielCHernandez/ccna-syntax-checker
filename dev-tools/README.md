# Developer test tools

Used by Claude to check every change before it ships. Not part of the
app; nothing here is loaded by any page.

- `syncjs.py <version-folder> <version>` — regenerates
  `ios-engine-vX.js` from the engine section of `terminal-vX.html`
  (run after every engine edit; keeps the reference copy in sync).
- `regress.js <ios-engine-vX.js> <out.txt>` — plays every Syntax
  Checker exercise's expected commands and writes the full transcript.
  Diff against `regress-baseline-v1.42.0.txt`: any difference must be
  an intended output change.
- `labsmoke.mjs <chrome-profile-dir> <url>` — headless Chrome: loads
  every Home Lab, pokes every device, checks for page errors and text
  sizing. Needs a local server (e.g. `python3 -m http.server`) and
  `node --experimental-websocket`.
- `lab1646.mjs <chrome-profile-dir> <screenshot-dir> <url>` — plays
  Home Lab 16.4.6 end to end through the real UI (plus 10.3 / 10.3.5
  checks): 34 checks against the real Packet Tracer captures.
