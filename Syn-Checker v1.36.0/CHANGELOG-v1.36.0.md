# CCNA CLI Engine — Version Index

This file tracks what changed between versions and which files belong
to each version. Versions are never overwritten — each gets its own
suffixed files so old versions stay inspectable side by side.

---

## v1.0.0 — Initial working engine

**Date:** 2026-08-05

**Files:**
- `ios-engine-v1.0.0.js` — core engine (grammar, state, execution). No DOM dependency.
- `terminal-v1.0.0.html` — browser terminal UI, loads the engine script.

**Scope:**
- Modes: `user_exec`, `priv_exec`, `global_config`, `interface_config`
- Commands (full form only, no abbreviations):
  - `enable`
  - `configure terminal`
  - `hostname <name>`
  - `interface <full-interface-name>`
  - `ip address <ip> <mask>`
  - `shutdown`
  - `no shutdown`
  - `exit`
  - `end`
  - `show running-config`
  - `show ip interface brief`
- Device state: hostname, current mode, current interface context,
  interfaces map (ip, mask, shutdown — default shutdown is `true`,
  matching real IOS).
- Basic error handling, two flat categories:
  - Unknown command shape → `% Invalid input detected`
  - Right shape, wrong mode → `% Command not available in this mode (...)`
- Custom, non-IOS training command: `?commands` — lists every command's
  exact required syntax and flags which are usable in the current mode.
  This command is specific to this early version for our own testing
  and is expected to be reconsidered/removed as abbreviation support
  and real `?` behavior are added later.

**Explicitly deferred (not in v1.0.0):**
- Abbreviation / prefix matching (e.g. `conf t`, `int g0/0`)
- Real IOS-style `?` help and Tab completion
- Three-way error classification (unknown vs wrong-mode vs bad-argument
  with concept-specific hints)
- Passwords, banners, `line console`/`line vty` config
- Order-independent goal-state grading
- Multi-device topology, ping, CDP, routing
- `/CIDR` mask notation (dotted-decimal only for now)

---

## v1.0.1 — Bug fix: silent failure when engine script doesn't load

**Date:** 2026-08-05

**Files:**
- `ios-engine-v1.0.1.js` — same logic as v1.0.0, version string updated only.
- `terminal-v1.0.1.html` — fixed script reference + new error handling (see below).

**Bug reported:** Typing a command (e.g. `enable`) and pressing Enter did
nothing — no echo, no output, no error.

**Root cause:** If `ios-engine-vX.X.X.js` fails to load in the browser
(wrong filename after a version rename, a cloud-sync tool like Dropbox
not having fully downloaded the file to disk, or a browser blocking
local `file://` script loading), `window.IOSEngine` is `undefined`. The
old inline script referenced `window.IOSEngine.createDevice(...)`
immediately, which threw an error at page load — silently, with no
visible message — and stopped the rest of the script from running,
including the Enter-key listener. Result: a UI that looks normal but
does nothing, with no clue why.

**Fixed:**
- Page now checks `window.IOSEngine` on load. If missing, it displays
  a clear on-page error box with a numbered troubleshooting checklist
  (matching filenames, same folder, cloud-sync fully downloaded, try a
  different browser, check the browser console) instead of failing
  silently.
- `handleSubmit()` now wraps the engine call in try/catch, so any
  future internal engine error prints to the terminal (`% Internal
  engine error: ...`) instead of doing nothing.

**Versioning convention confirmed this session (for future updates):**
- **MAJOR** — large/structural upgrades, possibly breaking changes
- **MINOR** — new features/capabilities, existing behavior unchanged
- **PATCH** — small bug fixes only, no new features

**Explicitly deferred:** same list as v1.0.0 — no scope changes in this
version, bug fix only.

---

## v1.0.2 — Bug fix: single self-contained HTML file (no more script loading)

**Date:** 2026-08-05

**Files:**
- `terminal-v1.0.2.html` — **this is the file to open.** Fully
  self-contained: engine logic is inlined in the same `<script>` block
  as the UI code. No external `.js` file needs to load for the page
  to work.
- `ios-engine-v1.0.2.js` — dev-only reference copy of the same engine
  logic, kept for testing in Node. **Not required alongside the HTML
  file** — the HTML file does not reference or load it.

**Bug reported (continued from v1.0.1):** Even with both files
confirmed in the same folder, the v1.0.1 error box reported the engine
script failed to load. Root cause: browsers (Chrome in particular)
restrict `<script src="...">` cross-file loading on pages opened
directly from disk (`file://` URLs) as a security measure — this is
independent of whether the files are actually in the same folder.
File-manager quirks (no "Open with" browser option, drag-and-drop into
Firefox not registering) compounded troubleshooting but were a
separate, secondary issue.

**Fixed:**
- Eliminated the `<script src="...">` cross-file dependency entirely.
  Engine code now lives directly inside `terminal-v1.0.2.html`, in the
  same script block as the UI wiring. There is no second file for the
  browser to fetch, so the entire class of `file://` script-loading
  restriction no longer applies.
- This is now genuinely a single file: download it, double-click it
  (or open it however works on your system), done.

**Behavior/scope:** unchanged from v1.0.1 — same commands, same
modes, same error handling, same `?commands` training command. This
was a delivery/loading fix only, not a feature or logic change.

**Note on going forward:** starting now, distribution will default to
single self-contained HTML files unless there's a specific reason to
split into multiple files again (e.g. if the project grows large
enough that a build step becomes worthwhile). The separate `.js`
engine file will still be kept up to date as a dev/testing artifact,
but it is not part of what you need to download and run.

---

## v1.1.0 — Guided Practice, Free Practice, and the 2.2 exercise

**Date:** 2026-08-05

**Files:**
- `terminal-v1.1.0.html` — **this is the file to open.** Single
  self-contained file, same as v1.0.2's approach.
- `ios-engine-v1.1.0.js` — dev-only reference copy for Node testing.
  Not required alongside the HTML file.

**Curriculum research:** confirmed via NetAcad's actual ITN (CCNA
Course 1) Module 2 — Basic Switch and End Device Configuration
content. The real Syntax Checker command set for this module maps to
five teaching sections: 2.2 Navigate Between IOS Modes, 2.4 Basic
Device Configuration, 2.5 Save Configurations, 2.7 Configure IP
Addressing, 2.8 Verify Connectivity. This drove which commands were
added and the module list in the dropdown.

**Added — new IOS modes and commands:**
- New mode: `line_config` (prompt: `(config-line)#`)
- `disable` (priv_exec → user_exec)
- `line console 0` (global_config OR interface_config → line_config —
  matches real IOS: subconfig-mode commands implicitly return to
  global config context first)
- `line vty 0 15` (same mode transitions as line console 0)
- `password <password>` (in line_config)
- `login` (in line_config)
- `interface vlan 1` (global_config → interface_config; models the
  switch virtual interface / SVI)
- `exit` and `end` extended to handle line_config correctly
- `no shutdown` now prints a realistic IOS message:
  `%LINK-5-CHANGED: Interface <name>, changed state to up`

**Added — Guided Practice / Free Practice dual mode:**
- Top mode bar toggle: **Guided Practice** (instruction-driven,
  checked step by step, modeled directly on NetAcad's Syntax Checker
  script) vs **Free Practice** (open CLI, no grading — this is what
  v1.0.2 already was, now framed as one of two explicit modes).
- Module dropdown lists all five planned exercises. Modules without
  built commands yet are shown as "(coming soon)" and are disabled/
  unselectable, per this version's design goal — the dropdown is the
  live roadmap for what to build next.
- **2.2 — Navigate Between IOS Modes** is the one fully working
  exercise this version, built to match NetAcad's own 13-step script
  exactly (including the mid-sequence quirk where `line console 0` is
  valid directly from interface config mode, not just global config).
- **Graduated hint escalation** on wrong answers, resets per step on
  advancing:
  - Attempts 1–2 wrong: bare "Not quite — try again."
  - Attempt 3 wrong: concept/mode-level hint text
  - Attempt 4+ wrong: exact expected command shown as text — student
    must still type it in themselves to advance (no auto-pass).
- **Device state is shared** across Guided Practice, Free Practice,
  and across switching exercises — resetting only happens via the
  explicit "Reset device" button. "Reset exercise" only resets step
  progress on the current exercise, not device state.
- Two separate reset controls to reflect this distinction: "Reset
  exercise" (restart current guided exercise's steps) and "Reset
  device" (wipe hostname/interfaces/lines/mode back to a fresh
  device).

**Explicitly deferred (still not in v1.1.0):**
- Exercises for modules 2.4, 2.5, 2.7, 2.8 — commands they need
  (`enable secret`, `service password-encryption`, `banner motd`,
  `copy running-config startup-config`, `show startup-config`,
  `reload`, `erase startup-config`, `ping`) are not yet built.
- Abbreviation/prefix matching — still full-form only.
- Three-way error classification with concept-linked hints for free
  (non-exercise) command errors — exercise mode now has hints, but
  free-practice errors are still the flat v1.0.x messages.
- Multi-device topology, ping, routing.

---

## v1.1.1 — Bug fix: remove per-step "Correct" messages, zip naming convention

**Date:** 2026-08-05

**Files:**
- `terminal-v1.1.1.html` — this is the file to open.
- `ios-engine-v1.1.1.js` — dev-only reference copy for Node testing.

**Changed:**
- Guided Practice no longer prints "Correct." after each successful
  step. Progress is still visible via the instruction bar advancing
  to the next step — silence on success now matches real IOS/NetAcad
  behavior (no feedback unless something is wrong). The
  "Exercise complete." message on finishing the whole exercise is
  kept, since that's a meaningful state change rather than per-step
  praise.
- Error messages, hints, and the answer-reveal on repeated wrong
  attempts are unchanged.

**Naming convention established this version:** distributed zip
archives use the pattern `Syn-checker-<major>-<minor>-<patch>.zip`
(dashes, not dots, matching common zip-naming safety) so the version
is identifiable from the filename alone without opening the archive.
This zip: `Syn-checker-1-1-1.zip`.

---

## v1.2.0 — Tab completion, module 2.4, "Completed" wording

**Date:** 2026-08-05

**Files:**
- `terminal-v1.2.0.html` — this is the file to open.
- `ios-engine-v1.2.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-2-0.zip` per the established naming
  convention.

**Curriculum research:** confirmed via multiple cross-referenced
NetAcad-based sources (ITExamAnswers 2.4.8 Check Your Understanding,
Quizlet flashcards mapping 2.4.1–2.4.5, and independent CCNA cheat
sheets) that ITN Module 2.4 — Basic Device Configuration — covers, in
order: device naming, `enable secret`, console/VTY line passwords with
`login`, `service password-encryption`, and `banner motd`.

**Added — new commands:**
- `enable secret <password>` (global_config) — sets the encrypted
  privileged-EXEC password.
- `service password-encryption` (global_config) — flips a device-wide
  flag; `show running-config` now displays all configured passwords
  in an obfuscated form when this is on, and in plaintext when it's
  off, so students can see the actual effect of the command, not just
  toggle it blindly. (Note: the obfuscation used is cosmetic, not real
  Cisco type-7 encryption — good enough to teach the concept visually,
  not intended to be reversible/decodable the way real type-7 is.)
- `banner motd <delimiter>text<delimiter>` (global_config) — supports
  any single delimiter character chosen by the user, matching real
  IOS behavior. This required a special-case parser separate from the
  fixed-token command matcher, since banner text contains spaces and
  arbitrary characters.

**Added — Module 2.4 exercise:** second fully working guided exercise,
14 steps, sourced from the real NetAcad script (hostname → enable
secret → console line password/login → VTY line password/login →
service password-encryption → banner motd → end). Module dropdown
entry flips from "(coming soon)" to selectable.

**Added — Tab completion:** pressing Tab in the CLI input now
completes the current word the same way real IOS does:
- Completes one token at a time, only from literal keywords (never
  free-form arguments like `<name>`, `<ip>`, `<password>`).
- Only offers completions valid for commands reachable in the
  device's current mode — e.g. `con` + Tab completes to `configure`
  from priv_exec (console isn't valid there yet), but is correctly
  ambiguous between `console`/`vty` after typing `line ` + Tab in
  global_config.
- Exact-prefix-of-exactly-one → silently completes with a trailing
  space, cursor at the end.
- Prefix of multiple → prints "% Ambiguous command. Possible
  completions: ..." (real IOS just beeps; since we can't beep, this
  is a deliberate, minimal accommodation, not a hint).
- Prefix of none → does nothing, matching real IOS silence.
- Implemented as a pure function (`getCompletions`) that walks the
  same `COMMANDS` token-pattern table used for execution, so any
  future command added to that table automatically gets correct tab
  completion for free — no separate abbreviation table to maintain.

**Changed:**
- The completion message on finishing a guided exercise now reads
  "Completed." instead of "Exercise complete." (wording only, no
  behavior change — it already only appeared once, at the very end).

**Explicitly deferred:**
- Exercises for modules 2.5, 2.7, 2.8 still coming soon — needed
  commands (`copy running-config startup-config`, `show
  startup-config`, `reload`, `erase startup-config`, `ping`) not yet
  built.
- Tab completion does not yet handle the `?` help-listing behavior of
  real IOS (showing candidates without completing) — only true Tab
  completion was requested and built this version.
- Real Cisco type-7 password encryption (reversible XOR cipher) was
  intentionally not implemented — the visual obfuscation is
  sufficient for the teaching goal and avoids implying a security
  property that type-7 doesn't actually have anyway.

---

## v1.2.1 — Bug fix: realistic tab-completion ambiguity (reserved words)

**Date:** 2026-08-06

**Files:**
- `terminal-v1.2.1.html` — this is the file to open.
- `ios-engine-v1.2.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-2-1.zip`.

**Bug reported:** Tab completion in v1.2.0 let a single letter like `c`
complete immediately to `configure`, because `configure` was the only
priv_exec command in our engine starting with `c`. On a real router,
`c` is ambiguous — other real IOS commands like `copy`, `clock`,
`clear`, `connect` also start with `c`, so real IOS requires `conf`
(at minimum) before `configure terminal` resolves unambiguously.
Confirmed against Cisco's own documentation and community references:
"co" and "con" do not uniquely identify a command; "conf" is the
minimum for `configure`.

**Root cause:** Our tab-completion ambiguity check only considered
commands we've actually implemented. Since we've only built a small
subset of real IOS so far, short prefixes that would be ambiguous on
a real device were artificially unique in our engine.

**Fixed — reserved words:**
- Added `RESERVED_WORDS`, a curated (CCNA-relevant, not exhaustive)
  list of real IOS command words we have NOT implemented, grouped by
  mode. These words are NOT executable — typing one in full still
  falls through to the normal "not implemented" error path, exactly
  like any other unbuilt command. They exist solely so Tab-completion
  treats them as competing candidates, recreating realistic ambiguity.
- `getCompletions` now folds these in, but only at the first word of
  a command (token position 0) — that's the only place an
  unimplemented command would realistically compete with one we've
  built. Sub-token completion (e.g. `line c` → `line console`) is
  unaffected, since both `console` and `vty` are commands we've
  actually built.
- Verified: `c` in priv_exec is now ambiguous (`configure`, `copy`,
  `clock`, `clear`, `connect`); `co`/`con` remain ambiguous; `conf`
  correctly resolves uniquely to `configure` — matching real IOS
  exactly and matching the specific example that prompted this fix.

**Maintenance note for future versions:** when a reserved word is
later actually implemented (e.g. `copy running-config
startup-config` in module 2.5), remove it from `RESERVED_WORDS` and
add it properly to `COMMANDS` — no other changes needed, since it
already participated in ambiguity checks as a placeholder.

**Explicitly out of scope:** full real-IOS command parity in the
reserved list (real routers have 200+ priv_exec commands) — the list
is intentionally curated to CCNA-relevant words a student would
plausibly encounter, not an exhaustive IOS command dump.

---

## v1.3.0 — Module 2.5: Save Configurations (interactive prompts)

**Date:** 2026-08-06

**Files:**
- `terminal-v1.3.0.html` — this is the file to open.
- `ios-engine-v1.3.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-3-0.zip`.

**Curriculum research:** confirmed via Cisco community docs, CCNA
study guides, and IOS command references that `copy running-config
startup-config`, `erase startup-config`, and `reload` all use
multi-step interactive prompts in real IOS (not single-line commands
like everything built so far):
- `copy running-config startup-config` → `Destination filename
  [startup-config]?` → (Enter accepts default) → `Building
  configuration...` / `[OK]`
- `erase startup-config` → `Erasing the nvram filesystem will remove
  all configuration files!` `Continue? [confirm]` → (Enter confirms)
  → `[OK]` / `Erase of nvram: complete`
- `reload` → if there are unsaved running-config changes: `System
  configuration has been modified. Save? [yes/no]:` → then always:
  `Proceed with reload? [confirm]`

**Added — architecture change: interactive prompt state.** This is
the first version where a command doesn't fully execute on one line.
Added `device.pendingPrompt`, checked at the very start of
`executeLine` (even before blank-input handling, since Enter-alone is
a meaningful "accept default" answer to these prompts). A new
`handlePendingPrompt` function routes the next line typed as an
*answer* to the active prompt rather than parsing it as a command,
and can chain to a further prompt (e.g. reload's Save? → Proceed?).

**Added — new commands:**
- `show startup-config` — displays the saved NVRAM config, or
  "startup-config is not present" if nothing has been saved yet.
- `copy running-config startup-config` — saves current config to
  NVRAM via the interactive filename prompt described above.
- `erase startup-config` — clears the saved NVRAM config via the
  interactive confirm prompt.
- `reload` — reboots the simulated device: rebuilds live device state
  from the saved startup-config (or factory-default blank state if
  none was ever saved), correctly discarding any unsaved running-config
  changes when the student answers "no" to Save?. This is the real
  teaching payoff of the module — students can see unsaved work
  actually get lost, not just read about it.

**Added — config snapshot/restore system**, supporting the above:
`snapshotConfig()` captures the config-relevant subset of device state
(hostname, interfaces, lines, secrets, banner — deliberately excluding
transient things like current mode), `applyConfigSnapshot()` restores
it, `hasUnsavedChanges()` compares live state against saved
startup-config to decide whether reload should prompt to save.
`renderRunningConfig`/`show startup-config` now both go through one
shared `renderConfigText()` so running-config and startup-config are
guaranteed to render identically for identical underlying state.

**Added — Module 2.5 exercise:** third fully working guided exercise,
10 steps, walking through show running-config → show startup-config →
save → verify → erase → reload with unsaved changes discarded. Blank
Enter-only steps are real, correctly-checked steps (not skipped),
matching the real multi-turn prompts. Module dropdown entry flips
from "(coming soon)" to selectable.

**Fixed (found during this version's testing, not previously
reported):** `handleSubmit()`'s blank-input guard would have silently
swallowed the Enter-only answers these new prompts require, breaking
both guided practice and free practice. Fixed by only suppressing
blank input when there's no active pending prompt and the current
guided step doesn't explicitly expect a blank answer. Also fixed:
`hasUnsavedChanges()` initially flagged a completely fresh,
never-configured device as having unsaved changes, which would have
made `reload` show an incorrect Save? prompt on an untouched device;
fixed by comparing against true factory-default state when no
startup-config has ever been saved.

**Explicitly deferred:**
- Exercises for modules 2.7, 2.8 still coming soon — needed commands
  (`ip address` on Vlan1 in the SVI-addressing context, `ping`) exist
  partially but the exercises themselves aren't built.
- `copy running-config startup-config` doesn't model an alternate
  destination filename — any typed answer is treated the same as
  accepting the default, since we don't model multiple saved config
  files.
- Switch-specific `delete vlan.dat` (paired with `erase startup-config`
  on real switches for a full factory reset) not implemented — noted
  in research but judged out of scope for this module's core teaching
  goal.

---

## v1.4.0 — Modules 2.7 and 2.8: IP Addressing and Verify Connectivity

**Date:** 2026-08-06

**Files:**
- `terminal-v1.4.0.html` — this is the file to open.
- `ios-engine-v1.4.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-4-0.zip`.

**Curriculum research:** confirmed via NetAcad's own 2.7.6 Packet
Tracer lab and ITN Module 2 curriculum text that IP addressing on a
switch is configured on the VLAN 1 SVI (`interface vlan 1` → `ip
address` → `no shutdown`), verified with `show ip interface brief`,
and that `ping` is the standard connectivity-verification command.
The lab's own addressing table (S1 = 192.168.1.253/24, S2 =
192.168.1.254/24, same /24 subnet) was used as the basis for this
version's exercises.

**Design decision, discussed and confirmed before building:** real
NetAcad Syntax Checkers are scripted text-matchers with no network
simulation — a `ping` step there would likely accept correctly-typed
`ping <ip>` regardless of device state. This version deliberately goes
further, matching Packet Tracer's behavior instead: `ping` succeeds or
fails based on whether the device's own configuration is actually
correct. This is intentional, per this project's original goal of
being closer to Packet Tracer than the basic Syntax Checker, not a
misunderstanding of what the real Syntax Checker does.

**Added — new commands:**
- `ping <ip-address>` (user_exec, priv_exec) — simulates ICMP echo
  against one fixed "neighbor" device at `192.168.1.1` (matching the
  real lab's addressing table). Succeeds only if: the device has an
  interface with an IP address configured, that interface is `no
  shutdown` (up), and that interface's address is in the same subnet
  as the target — otherwise realistic IOS-style timeout output
  (`.....` / `Success rate is 0 percent`). This ties ping's result
  directly to whether the student's own earlier configuration was
  actually correct, which is the real teaching point.

**Added — subnet math helpers:** `ipToInt()` and `sameSubnet()`,
needed to determine ping reachability. First numeric/bitwise logic in
the engine — everything before this was string/state matching.

**Added — Module 2.7 exercise:** 6 steps — enter global config, enter
`interface vlan 1`, configure IP/mask, `no shutdown`, `end`, verify
with `show ip interface brief`.

**Added — Module 2.8 exercise:** 2 steps — verify with `show ip
interface brief`, then `ping 192.168.1.1`. Deliberately short and
deliberately dependent on 2.7 having already been completed in the
same session — device state is shared across exercises by design
(confirmed back in v1.1.0), so a student going through modules in
order will have working connectivity by the time they reach this
step; a student jumping straight to 2.8 on a fresh device will see
the ping correctly fail, which is itself instructive.

**Fixed (found during this version's testing, not previously
reported):** `RESERVED_WORDS` for `user_exec`/`priv_exec` still listed
`ping`, and `priv_exec` still listed `copy`, `erase`, `reload` as
placeholder/unimplemented words from before those commands were
actually built in v1.3.0/v1.4.0. Per the maintenance note written in
v1.2.1's changelog, these are now removed from the reserved list since
they're real, implemented commands — verified tab-completion
ambiguity behavior is unaffected (e.g. `c` in priv_exec is still
correctly ambiguous via the real `copy` command in `COMMANDS`, not a
stale reserved-word duplicate).

**Explicitly deferred:**
- Only one simulated neighbor IP is modeled — no broader simulated
  network, no traceroute, no DNS-name ping targets.
- Real multi-device topology (actual second configurable device) is
  still future work (Stage 4/5 from the original project roadmap) —
  this version's ping is a scoped simulation tied to the student's own
  device state, not a real second device.
- All five ITN Module 2 Syntax Checkers (2.2, 2.4, 2.5, 2.7, 2.8) are
  now built — this completes Module 2's full command surface as
  originally scoped from NetAcad's own curriculum.

---

## v1.5.0 — Abbreviation matching at Enter, command history, Ctrl+C

**Date:** 2026-08-06

**Files:**
- `terminal-v1.5.0.html` — this is the file to open.
- `ios-engine-v1.5.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-5-0.zip`.

Staying within v1 per this session's direction (feature-level, not a
structural/breaking change).

**Added — abbreviation matching at Enter, not just Tab:** real IOS
accepts unambiguous abbreviations directly at Enter (`conf t` works,
not just via Tab-completion). Added `resolveAbbreviations()`, which
walks every token of the input line and expands any that uniquely
match a literal command keyword, using the exact same candidate logic
as Tab completion (refactored into a shared `findCandidatesAt()`
helper so the two can never drift apart). Free-form argument tokens
(IPs, passwords, hostnames, banner text) are always left untouched —
abbreviation only ever applies to command keywords. Genuinely
ambiguous input (e.g. `c` alone in priv_exec) now fails with `%
Ambiguous command: "..."  (possible: ...)` instead of guessing,
matching real IOS. The `banner motd` special-case parser runs before
abbreviation resolution and is completely unaffected by it, since
banner text must never be reinterpreted as command keywords.

**Added — command history (Up/Down arrows):** shared across Guided
and Free practice, consistent with the existing shared-device-state
design. Up recalls progressively older submitted commands; Down moves
back toward the present and restores whatever was being typed before
Up was first pressed (standard shell behavior). History stores exactly
what was submitted via Enter.

**Added — Ctrl+C to abort:** aborts an active interactive prompt
(copy/erase/reload mid-sequence) and returns to a clean prompt without
completing the action, printing `^C` — matches real IOS. Also aborts
whatever's currently typed on the input line if there's no active
prompt. Deliberately does NOT intercept Ctrl+C when text is selected
in the input field, so normal browser copy still works.

**Not added — Ctrl+A / Ctrl+E:** verified these already work via
default browser/OS text-field behavior (jump to line start/end) on
every major platform, so no custom handling was needed or added;
adding our own risked overriding working native behavior for no
benefit.

**Explicitly deferred:** multi-device topology, richer free-practice
error classification with concept hints (both discussed this session
as bigger future items, not part of this version's scope).

**Test commands for this version** (try in Free Practice on a fresh
device):
1. `ena` — should enter privileged EXEC mode (abbreviation → `enable`)
2. `conf t` — from priv_exec, should enter global config mode
3. `c` — from priv_exec, should fail with `% Ambiguous command` and
   list `configure, copy, clock, clear, connect`
4. Type `enable`, `configure terminal`, `interface vlan 1`, then press
   **Up arrow twice** — input should show `configure terminal`, then
   `enable`
5. Type `copy running-config startup-config`, then press **Ctrl+C** at
   the `Destination filename [startup-config]?` prompt — should print
   `^C` and return to a normal prompt without saving

---

## v1.5.1 — Bug fix: exercises silently advancing past rejected commands

**Date:** 2026-08-06

**Files:**
- `terminal-v1.5.1.html` — this is the file to open.
- `ios-engine-v1.5.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-5-1.zip`.

**Bug reported:** In Module 2.4, typing `configure terminal` as the
first step appeared to succeed (the instruction bar advanced to step
2, "rename the host") but the device stayed in user EXEC mode instead
of entering global config mode.

**Root cause:** `checkExerciseStep()` only ever compared the typed
text against the expected text for that step — it never checked
whether the command actually succeeded when run through the real
engine. Module 2.4's first step, `configure terminal`, requires
privileged EXEC mode, but the exercise didn't first get the student
there. A student going straight to 2.4 (without having done 2.2
earlier in the same session) starts in user EXEC mode, so the real
engine correctly rejected the command — but the text-only checker had
already said "correct" and advanced to step 2 before that rejection
was even checked. This is the same underlying gap for any exercise
whose first step assumes a mode the student isn't actually in yet.

**Fixed — two layers, so this class of bug can't recur silently:**
1. **Safety net (`handleSubmit`):** when the exercise checker says a
   step's text is correct, we now also check whether `executeLine`
   actually succeeded on the real device. If the engine rejects it
   (wrong mode, etc.), the step index and attempt count are rolled
   back, the exercise is NOT marked complete even if it was the last
   step, and the real IOS error is shown to the student along with a
   clarifying note — instead of silently advancing past a command
   that didn't really execute. This protects every exercise, present
   and future, against the same class of mismatch.
2. **Root cause (exercise data):** audited every existing exercise's
   first step against the actual mode each command requires. Found
   and fixed the same missing-precondition bug in **2.4** (needed
   `enable` before `configure terminal`) and **2.5** (needed `enable`
   before `show running-config`, which is priv_exec-only). Added an
   explicit "Enter privileged EXEC mode" first step to both. 2.2 and
   2.8 were already correct (2.2 starts from user EXEC by design; 2.8
   opens with `show ip interface brief`, which is valid in both user
   and privileged EXEC). Fixed the same gap in **2.7** as a preventive
   measure — its first step was `configure terminal` with no
   precondition, so it had the identical latent bug even though it
   hadn't yet been reported.

**Verified:** all five exercises (2.2, 2.4, 2.5, 2.7, 2.8) now run
cleanly start-to-finish from a completely fresh device (user EXEC
mode, nothing configured) with zero text/engine mismatches — matching
how a student jumping directly into any single module, without doing
earlier modules first in the same session, should actually be able to
work.

**Test commands for this version:**
1. Reset the device, go straight to **2.4 — Basic Device
   Configuration** in Guided Practice (skip 2.2), and type `enable` —
   step should advance and the device should actually be in
   privileged EXEC mode (prompt changes to `#`).
2. Same fresh-device setup, go straight to **2.5 — Save
   Configurations** and type `enable` — same check.
3. Same fresh-device setup, go straight to **2.7 — Configure IP
   Addressing** and type `enable` — same check.
4. In any Guided exercise, deliberately type a command that's correct
   text but wrong for the current mode (e.g. type `configure terminal`
   twice in a row on the same step) — the second attempt should show
   a real IOS-style error AND stay on the same step, not silently
   advance.
5. Full run of **2.2 — Navigate Between IOS Modes** start to finish on
   a completely fresh device — should still complete cleanly with no
   regressions from this fix.

---

## v1.6.0 — Ground-truth corrections + Number Systems mode

**Date:** 2026-08-06

**Files:**
- `terminal-v1.6.0.html` — this is the file to open.
- `ios-engine-v1.6.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-6-0.zip`.

**Ground truth obtained:** the person supplied an existing exact-replica
reference implementation covering the real NetAcad Syntax Checker
content for CCNA1 (17 modules), CCNA2 (16 modules), and CCNA3 (14
modules), including the literal step-by-step command data for CCNA1's
8 real Syntax Checkers. This is a primary source, unlike the
secondary-source research (course-answer sites, PDFs, search snippets)
used up to this point, and revealed several real inaccuracies.

**Corrected — 2.4 Basic Device Configuration:** reordered to match the
real lab exactly (console/VTY line setup now comes before `enable
secret`, not after); fixed banner text from "Authorized access only"
to the correct "Warning! Authorized access only!"; removed a trailing
`end` step not present in the real lab; removed the leading `enable`
step added in v1.5.1 (the real lab has no such step — it assumes
privileged EXEC as a starting precondition rather than teaching it).

**Corrected — 2.7:** retitled to "Configure a Switch Virtual
Interface" (matching the real lab's actual name, 2.7.5); trimmed from
7 steps to the real 4 (`configure terminal` → `interface vlan 1` →
`ip address` → `no shutdown` — no `end` or verification step in the
real lab); corrected the IP address from `192.168.1.253` to the real
lab's `192.168.1.20`; removed the leading `enable` step for the same
reason as 2.4.

**Added — `precondition` field on exercises:** since removing the
leading `enable` steps reopens the "wrong starting mode" scenario
fixed in v1.5.1 (a student jumping directly into 2.4 or 2.7 without
prior context), each exercise can now carry a `precondition` string,
shown as a note on step 1 only (not counted as a step, not repeated on
later steps) — e.g. "This lab assumes the device is already in
privileged EXEC mode." This is more honest than either silently
padding in a fake step or leaving the student to hit an unexplained
error. The v1.5.1 safety net (rolling back a step if the engine
actually rejects it) is unchanged and still catches this case
regardless.

**Confirmed accurate, no changes:** 2.2 Navigate Between IOS Modes
matched the ground truth exactly, command for command, with no
corrections needed.

**Decision — 2.5 and 2.8 kept as extended practice:** these two
exercises do not correspond to any of the 8 real Syntax Checkers found
in the ground truth reference. Per explicit direction this session,
they are being kept rather than removed, since the whole point of this
project is to go beyond what the basic Syntax Checker offers. Both are
now labeled "(extended practice)" in the module dropdown so the
distinction from official Cisco lab content is visible in the UI
itself.

**Newly confirmed real Syntax Checkers, not yet built:** the ground
truth reference revealed 5 more real CCNA1 Syntax Checkers beyond
Module 2: **10.1.2** Configure Initial Router Settings, **10.2.5**
Configure Router Interfaces, **12.6.5** Configure IPv6 Addressing,
**16.4.5** Configure Secure Passwords and SSH, **17.5.7** Verify
Directly Connected Networks — each with exact, verified step data now
available for building in future versions. Also confirmed: the
reference's CCNA2 and CCNA3 sections mean equivalent ground-truth data
exists for the rest of the CCNA curriculum whenever we get there.

**Added — Number Systems mode:** new third top-level mode alongside
Guided/Free Practice, for binary/decimal/hex conversion practice
(Module 5 — Number Systems has no real Syntax Checker, per earlier
research, but is one of the highest-friction early CCNA topics and
directly supports subnetting and the newly-confirmed IPv6 module).
- Selecting it fully replaces the CLI terminal, module dropdown, and
  instruction bar with a dedicated panel — no CLI elements bleed
  through, since this isn't a CLI activity. CLI device state and
  exercise progress are left completely untouched in the background;
  switching back to Guided or Free Practice resumes exactly where
  things were left off, per this session's explicit direction.
- **Drill sub-mode:** random practice problems covering
  decimal↔binary and decimal↔hex, scoped to 0-255 (one IPv4 octet, the
  actual CCNA-relevant range) rather than arbitrary numbers. Graduated
  hint on request (place-value breakdown), running score tracker,
  skip/next control. Accepts binary answers with or without leading
  zeros.
- **Converter sub-mode:** live reference tool — typing into any of the
  three fields (decimal/binary/hex) updates the other two instantly,
  with input validation (range 0-255, correct digit sets per base) and
  inline error styling on invalid entries. No grading — this is a
  scratchpad, not a quiz.

**Test commands for this version:**
1. Guided Practice → select **2.4 — Basic Device Configuration** →
   confirm the precondition note appears above step 1, and the first
   real step is `configure terminal` (no `enable` step first).
2. Same for **2.7 — Configure a Switch Virtual Interface** → confirm
   only 4 steps total and the IP address step expects
   `192.168.1.20 255.255.255.0`.
3. Complete **2.4** fully and confirm the banner step requires exactly
   `banner motd #Warning! Authorized access only!#`.
4. Switch to **Number Systems → Drill**, answer a few questions
   (correct and deliberately wrong) to confirm scoring and feedback
   both update correctly.
5. Switch to **Number Systems → Converter**, type `192` into the
   Decimal field — Binary should show `11000000` and Hex should show
   `C0` instantly; then switch back to **Guided Practice** and confirm
   your exercise step/progress is exactly where you left it.

---

## v1.6.1 — Bug fix: no way back from Number Systems mode

**Date:** 2026-08-06

**Files:**
- `terminal-v1.6.1.html` — this is the file to open.
- `ios-engine-v1.6.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-6-1.zip`.

**Bug reported:** after selecting Number Systems mode, there was no
way to return to Guided/Free Practice — the CLI environment appeared
completely inaccessible.

**Root cause:** the top-level mode toggle (Guided Practice / Free
Practice / Number Systems buttons) was placed inside the same
`.mode-bar` container as CLI-only controls (module select, reset
buttons). When Number Systems mode hid all CLI-only elements by
selector, it hid the container holding the toggle buttons themselves
— removing the only way to switch back.

**Fixed:** split the single mode-bar into two separate elements: a
persistent top-level toggle bar (Guided/Free/Number Systems) that is
never hidden regardless of which mode is active, and a separate
CLI-only sub-bar (module select, reset exercise, reset device) that
hides only when Number Systems is selected. The CLI-only element list
now targets the sub-bar specifically by ID rather than matching on a
shared class, preventing this category of mistake from recurring as
more modes or panels get added later. Added a subtle accent-colored
border to the top bar so it reads visually as permanent navigation,
distinct from the content beneath it.

**Verified:** switching Number Systems → Guided Practice → Free
Practice → Number Systems repeatedly all work correctly; CLI device
state and exercise progress remain untouched across the round trip,
per the existing v1.6.0 design.

**Test commands for this version:**
1. Open the page, click **Number Systems** — confirm the Guided
   Practice / Free Practice / Number Systems buttons are still visible
   and clickable at the top.
2. From Number Systems, click **Free Practice** — confirm the CLI
   terminal reappears and works normally.
3. Type a command in Free Practice (e.g. `enable`), switch to Number
   Systems, then switch back to Guided Practice — confirm the terminal
   still shows your typed command and the device is still in
   privileged EXEC mode (state preserved across the round trip).
4. In Number Systems → Drill, answer a question, then switch to Free
   Practice and back to Number Systems → confirm your score is still
   there (score is only reset by a full page reload, not by switching
   modes).
5. Confirm the module dropdown and Reset buttons are hidden while in
   Number Systems mode, and reappear correctly in Guided Practice.

---

## v1.7.0 — Drill categories, reference chart, binary space input

**Date:** 2026-08-07

**Files:**
- `terminal-v1.7.0.html` — this is the file to open.
- `ios-engine-v1.7.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-7-0.zip`.

**Added — drill category selector:** Number Systems → Drill now has a
dropdown to choose what to practice, instead of a random mix:
- Binary → Decimal
- Decimal → Binary
- Binary → Hex
- Hex → Binary

Decimal↔hex direct conversion is intentionally not a drill category —
real CCNA subnetting/IPv6 work goes through binary as the
intermediate step (binary↔hex nibble conversion is the actually-tested
skill), so that's what's drilled. Decimal↔hex is still available for
reference in the Converter.

**Added — scope toggle for binary↔hex drills:** since hex/binary shows
up in two different real shapes in CCNA (8-bit/2-hex-digit for IPv4
octets and subnet math, 16-bit/4-hex-digit for IPv6 hextets), the
Binary↔Hex categories expose a second dropdown to choose which. Only
shown for the categories where it's relevant — hidden for
binary↔decimal, which is octet-scope only (matching IPv4 addressing,
the only place decimal↔binary conversion is actually used in CCNA).

**Added — Reference Chart tab:** third sub-tab in Number Systems
alongside Drill/Converter. Two static tables: the classic
decimal/binary/hex nibble table (0-15), and the binary place-value
row for one octet (128/64/32/16/8/4/2/1) — the two references people
most commonly want on hand while working subnetting problems by hand.

**Added — binary input with optional space grouping:** both the Drill
input and the Converter's Binary field now accept a single space
after the 4th digit (e.g. `1100 0000`), matching how people naturally
group an octet into two nibbles when reading/writing it by hand. This
is deliberately narrow: leading/trailing whitespace is tolerated as a
typing accident, but any OTHER spacing — wrong position, multiple
spaces, spaces in more than one place — is rejected as invalid rather
than silently accepted, since the goal is reinforcing correct
grouping, not being permissive about arbitrary whitespace. Applies to
8-bit octet input; 16-bit hextet drill answers are not space-grouped
(binary grouping conventions for 16-bit values vary too much to pick
one authoritatively).

**Changed:** Converter's binary field placeholder updated to show the
space-grouped form (`1100 0000`) so the accepted format is visible
without reading documentation.

**Test commands for this version:**
1. Number Systems → Drill → select **Binary → Decimal** from the
   category dropdown — confirm the scope toggle is hidden (this
   category is octet-only) and a question appears.
2. Switch category to **Binary → Hex** — confirm the scope toggle
   appears; try both **8-bit octet** and **16-bit hextet** and confirm
   the question length changes accordingly (8 vs 16 binary digits).
3. On a Binary → Decimal or Binary → Hex question, type your answer's
   *source* format with a space in the middle (e.g. answer a
   Decimal → Binary question with `1100 0000` instead of `11000000`)
   — should be accepted as correct.
4. Try an invalid space pattern, e.g. `11 000000` or `1100  0000`
   (double space) — should be rejected with a clear message, not
   silently accepted.
5. Click the **Reference Chart** tab — confirm both tables render
   (16-row nibble table, 8-column place-value table) and that
   switching away and back to Drill preserves your running score.

---

## v1.7.1 — Add Decimal↔Hex drill categories

**Date:** 2026-08-07

**Files:**
- `terminal-v1.7.1.html` — this is the file to open.
- `ios-engine-v1.7.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-7-1.zip`.

**Added:** two more drill categories, requested right after v1.7.0
shipped (originally intended to be part of that version):
- Decimal → Hex
- Hex → Decimal

Both are scope-aware like Binary↔Hex (8-bit/2-digit octet vs
16-bit/4-digit hextet toggle), for the same reason — decimal↔hex shows
up in both IPv4-adjacent contexts and IPv6 addressing. Both flowed
through existing, already-tested code paths in `newDrill()` and
`checkDrillAnswer()` with no special-casing needed, since those
functions were already written generically per-base rather than
per-category. Added the two missing hint branches to
`showDrillHint()`, which previously had no hint text for a
decimal↔hex question (would have shown nothing if clicked).

**Test commands for this version:**
1. Number Systems → Drill → select **Decimal → Hex** — confirm a
   decimal question appears and the scope toggle is visible.
2. Try **Hex → Decimal** in 16-bit hextet scope — confirm the hex
   value shown is 4 digits (e.g. `ABCD`) and the expected answer is a
   decimal number 0-65535.
3. Answer a Decimal → Hex question correctly — confirm score
   increments and a new question loads.
4. Click **Hint** on a Hex → Decimal question — confirm hint text
   appears (previously would have shown nothing for this category).
5. Cycle through all 6 categories in the dropdown and confirm the
   scope toggle correctly shows for Binary↔Hex and Decimal↔Hex, and
   correctly hides for Binary↔Decimal.

---

## v1.7.2 — Bug fix: exact real-IOS output formatting (verified against real Packet Tracer capture)

**Date:** 2026-08-07

**Files:**
- `terminal-v1.7.2.html` — this is the file to open.
- `ios-engine-v1.7.2.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-7-2.zip`.

**Ground truth obtained:** the person ran commands in real Packet
Tracer and pasted the exact copied output (`show running-config`,
`show ip interface`, `show ip interface brief`), finally resolving the
column-spacing question that had been open since v1.3.0 — this is a
primary source, not reconstructed from secondary research.

**Fixed — `show ip interface brief` column widths:** were
`[22, 15, 5, 8, 22, 8]` (all fixed-width, including a padded final
column); real widths, measured exactly from the capture, are
`[23, 16, 4, 7, 22]` for the first five columns, with the final
Protocol column printed unpadded (no trailing spaces). This
specifically mattered for `administratively down` (21 characters),
which nearly fills the 22-wide Status column — our old fixed-width
Protocol column produced incorrect trailing padding after `down` in
that case, which the real capture confirmed doesn't exist. Verified
byte-for-byte matches against the real capture for the header row, a
normal `up`/`up` row, and the `administratively down` row.

**Fixed — `show running-config` / `show startup-config` missing
line:** real IOS shows a `Current configuration : N bytes` line
immediately after `Building configuration...`, which we were missing
entirely. Added, computed from the actual rendered config body length
(not a fake static number). Also corrected: no blank line between
`Building configuration...` and `Current configuration : N bytes` —
earlier secondary-source research had suggested one existed; the real
capture shows there isn't one.

**Noted, not changed:** the real capture also shows a `version 15.0`
line and several IOS default lines (`no service timestamps...`, `no
service password-encryption`, `spanning-tree mode pvst`, etc.) that
real switches include even with no explicit configuration. Not added
in this version — these are cosmetic IOS-version-specific boilerplate
rather than something students configure or that changes based on
their commands, so the teaching value of reproducing them exactly is
low relative to the effort. Flagged here in case that judgment should
be revisited later.

**Test commands for this version:**
1. Free Practice: `enable`, `configure terminal`, `interface vlan 1`,
   `end`, then `show ip interface brief` — confirm the Vlan1 row reads
   exactly `Vlan1                  unassigned      YES manual administratively down down`
   with no trailing spaces.
2. Same session, `interface FastEthernet0/1`, `no shutdown`, `end`,
   `show ip interface brief` — confirm that row reads exactly
   `FastEthernet0/1        unassigned      YES manual up                    up`.
3. `show running-config` — confirm it now shows `Current configuration
   : N bytes` immediately after `Building configuration...`, with no
   blank line between them.
4. Confirm the header row of `show ip interface brief` reads exactly
   `Interface              IP-Address      OK? Method Status                Protocol`
   (note: wider spacing than previous versions).
5. Re-run Guided Practice module **2.5 — Save Configurations** start
   to finish — confirms the renderer changes didn't break the
   copy/erase/reload flow that depends on this same rendering code.

---

## v1.7.3 — Bug fix: interface name abbreviation, plus router-capture corrections

**Date:** 2026-08-07

**Files:**
- `terminal-v1.7.3.html` — this is the file to open.
- `ios-engine-v1.7.3.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-7-3.zip`.

**Ground truth obtained:** two real Packet Tracer captures from a
router (Cisco 1941), including a full login/enable/banner/password
configuration session and a `show run` — the first real router output
we've had (all previous captures were switch-only), revealing several
gaps.

**Bug reported and fixed — interface name abbreviation:** typing `g0/0`
was silently treated as a completely separate interface from
`GigabitEthernet0/0`, rather than resolving to the same one — real IOS
accepts abbreviated interface type names and always resolves them to
the canonical full name. Added `normalizeInterfaceName()`, matching
against known interface type prefixes (`GigabitEthernet`,
`FastEthernet`, `Serial`, `Loopback`, `Vlan`) using the same
shortest-unambiguous-prefix principle as command-keyword abbreviation,
applied specifically to the type portion of the name (before the first
digit) — the numbering/slot portion is always kept exactly as typed.
Unknown/unrecognized type prefixes pass through unchanged rather than
being rejected, so free-form or future interface types still work.
Verified: `g0/0`, `Gi0/0`, and `GigabitEthernet0/0` all now resolve to
the same interface; `fa0/1` → `FastEthernet0/1`; `se0/0/0` →
`Serial0/0/0`.

**Added — `enable password <password>`:** a command we were missing
entirely, confirmed present in the real capture alongside `enable
secret`. Included in `show running-config` output, respects `service
password-encryption` exactly like other passwords (type-7 obfuscated
when on, plaintext when off — verified against the real capture's
exact behavior). Device state, snapshot/restore (for `copy`/`reload`),
and the "has unsaved changes" comparison were all updated to track
this new field consistently.

**Added — `%SYS-5-CONFIG_I: Configured from console by console`:**
real IOS prints this automatically the moment you leave global
configuration mode back to privileged EXEC (via `exit` or `end` from
global config or any of its subconfig modes) — confirmed in the real
capture appearing right after `R1(config)#exit` → `R1#`. Added to both
`exit` and `end` handlers, only firing on that specific transition
(not on every `exit`/`end`, e.g. not on `exit` from priv_exec to user
EXEC). Verified this doesn't break exercise grading, since exercises
check for `error`, not `text`, on success.

**Fixed — `copy running-config startup-config` prompt:** was missing
a trailing space after `Destination filename [startup-config]?` —
confirmed present in the real capture.

**Fixed — `show running-config` line ordering:** `hostname` is now
immediately followed by `!`, then `enable secret`, then `enable
password`, then `service password-encryption`, then `!` — closer to
the real capture's structure. Real IOS boilerplate we don't model
(`version 15.1`, `ip cef`, `license udi`, `spanning-tree mode pvst`,
etc.) remains intentionally excluded, per the judgment call noted in
v1.7.2 — low teaching value relative to the effort of reproducing
IOS-version-specific defaults that don't reflect anything the student
configured.

**Explicitly deferred (identified from the same captures, not yet
built):** positional caret error messages (`% Invalid input detected
at '^' marker`, pointing at the exact failing character) — a real
parser upgrade, not a quick fix; actual password enforcement (`enable`
and console login currently always succeed regardless of configured
passwords — the real capture shows a full logout/banner/login/enable-
password-prompt flow we don't simulate at all); real Cisco type-7
password hash format matching (ours is a cosmetic stand-in, not the
real algorithm) — judged low teaching value and deprioritized.

**Test commands for this version:**
1. `enable`, `configure terminal`, `interface g0/0`, `ip address
   192.168.1.1 255.255.255.0`, `exit`, `interface GigabitEthernet0/0`
   — confirm `show running-config` shows only ONE
   `interface GigabitEthernet0/0` block with the IP address you set
   (not two separate interfaces).
2. `interface fa0/1` then `interface se0/0/0` — confirm both resolve
   without error and use realistic full names in `show running-config`.
3. `enable`, `configure terminal`, `enable password cisco`, `enable
   secret class`, `end`, `show running-config` — confirm both
   `enable secret 5 ...` and `enable password 7 ...` (wait — only 7-
   prefixed if encryption is on; try without `service
   password-encryption` first to see plaintext, then with it on to see
   the difference).
4. `enable`, `configure terminal`, `exit` — confirm
   `%SYS-5-CONFIG_I: Configured from console by console` appears
   immediately.
5. `copy running-config startup-config` — confirm the prompt text ends
   with a visible trailing space before your cursor (matches real IOS
   exactly; mostly a copy-paste-verification test rather than
   something visually obvious).

---

## v1.7.4 — Bug fix: dead end in exercises with a privileged-EXEC precondition

**Date:** 2026-08-07

**Files:**
- `terminal-v1.7.4.html` — this is the file to open.
- `ios-engine-v1.7.4.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-7-4.zip`.

**Bug reported:** starting Guided Practice on module 2.7 (which
assumes the device is already in privileged EXEC mode, per the
ground-truth correction in v1.6.0) from a fresh device, typing `enable`
was rejected as wrong (correct — it's not step 1's expected text), and
then typing the step's actual expected command (`configure terminal`)
was ALSO rejected, with `% Command not available in this mode
(user_exec)` — because the device was still stuck in user EXEC mode.
This left no way to proceed at all: the exact expected command kept
failing on mode grounds, and the one command that would fix the mode
(`enable`) kept getting rejected as "not the right step."

**Root cause:** the exercise checker only ever ran the real engine when
the typed text matched the current step's expected text. Typing
anything else, including a perfectly reasonable and necessary command
like `enable`, was pure text-rejection with no effect on device state
at all — so there was no way to actually fix the underlying mode
problem from within the exercise.

**Fixed — escape hatch:** if the student types `enable` while the
device is in user EXEC mode, it now actually runs (moving the device
to privileged EXEC) even though it isn't literally the current step's
expected text, with a clear message explaining what just happened and
prompting them to retry the real step. This does not mark anything as
"correct" or advance the step counter — it only fixes the underlying
device state so the actual expected command can then succeed.

**Fixed — clearer error when this situation occurs anyway:** the
existing v1.5.1 safety-net message ("that command is correct... see
the error above") has been made specific for this exact case: if the
engine rejects a step's command because the device is in user EXEC
mode, the message now directly says "Type enable to reach privileged
EXEC mode, then try this step again" instead of a generic pointer.

**Fixed — precondition note visibility:** the note explaining an
exercise's starting assumption (e.g. "this lab assumes privileged EXEC
mode") was previously squeezed inline above the instruction text in
small dim gray — easy to miss, which likely contributed to how this
bug was first encountered. It's now a separate, visually distinct
amber-highlighted note box, impossible to mistake for regular
instruction text.

**Test commands for this version:**
1. Reset device, go straight to Guided Practice → **2.7 — Configure a
   Switch Virtual Interface** (skip 2.2) — confirm an amber note box
   is clearly visible above step 1's instruction.
2. On that same fresh session, type `enable` — confirm it's accepted
   as an escape hatch (device moves to privileged EXEC, clear message
   shown) rather than a flat "not quite."
3. Immediately after, type `configure terminal` — confirm it now
   succeeds and advances to step 2 (this was the exact dead end from
   the bug report).
4. Repeat the same test starting from **2.4 — Basic Device
   Configuration** instead of 2.7, to confirm the fix applies there
   too (both exercises share the same precondition).
5. Full run of **2.2 — Navigate Between IOS Modes** start to finish —
   confirms this fix doesn't change behavior for exercises that don't
   have this precondition at all.

---

## v1.7.5 — Remove explanatory message on the enable escape hatch

**Date:** 2026-08-07

**Files:**
- `terminal-v1.7.5.html` — this is the file to open.
- `ios-engine-v1.7.5.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-7-5.zip`.

**Changed:** the v1.7.4 escape-hatch message ("Moved to privileged
EXEC mode. Now try the step's actual command.") has been removed per
direction — it's implementation detail the student doesn't need to
see. The prompt itself changing from `Switch>` to `Switch#` is
sufficient feedback, matching how real IOS gives no extra commentary
on a successful `enable` either. The underlying fix from v1.7.4 (typing
`enable` while stuck in user EXEC mode actually runs it rather than
being flatly rejected) is unchanged — only the message was removed.

**Noted for a future version:** this still isn't the definitive design
for exercises that assume a privileged-EXEC starting state; the
escape hatch is a workaround, not a first-class solution. Flagged in
this session for follow-up later.

**Test commands for this version:**
1. Reset device, go to **2.7** directly, type `enable` — confirm no
   extra message appears, just the prompt changing from `Switch>` to
   `Switch#`.
2. Continue with `configure terminal`, `interface vlan 1`,
   `ip address 192.168.1.20 255.255.255.0`, `no shutdown` — confirm
   the exercise completes cleanly, matching the working run confirmed
   this session.
3. Repeat on **2.4** — same silent mode-fix behavior expected.
4. Full run of **2.2** — confirms no regression for exercises that
   don't need the escape hatch at all.
5. In Free Practice, type `enable` from user EXEC — confirm normal
   behavior (mode changes, no message), since the escape hatch should
   only ever be reachable from Guided Practice's wrong-answer path.

---

## v1.8.0 — Module 10.1: Configure Initial Router Settings

**Date:** 2026-08-07

**Files:**
- `terminal-v1.8.0.html` — this is the file to open.
- `ios-engine-v1.8.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-8-0.zip`.

**Correction to prior planning:** this version was originally expected
to need zero engine changes (all commands assumed already built).
Pulling the exact ground-truth step data from the reference file
before building — as this project's process requires — revealed the
real lab is 22 steps, not the ~13 estimated, and needs three commands
we didn't have: `no ip domain-lookup`, `logging synchronous`, and
`exec-timeout <min> <sec>`. Corrected course before building rather
than after.

**Added — new commands:**
- `no ip domain-lookup` (global_config) — disables DNS lookup, so a
  mistyped command doesn't hang for a long DNS timeout. Tracked as
  `device.ipDomainLookup` (defaults to `true`, matching real IOS),
  shown in `show running-config` as `no ip domain-lookup` when off.
- `logging synchronous` (line_config) — prevents unsolicited log
  messages from interrupting command entry on a line.
- `exec-timeout <minutes> <seconds>` (line_config) — sets a line's
  idle disconnect timeout; `0 0` disables it entirely.
- `line vty 0 4` (global_config/interface_config) — the router
  convention (5 VTY lines), added alongside the existing `line vty 0
  15` (switch convention, 16 lines) rather than replacing it, since
  both are real, distinct commands depending on device type.

All three new line-level settings and the domain-lookup flag are
tracked through `snapshotConfig`/`applyConfigSnapshot` (so `copy` and
`reload` handle them correctly) and rendered in `show running-config`
in realistic positions.

**Added — Module 10.1 exercise:** "10.1 — Configure Initial Router
Settings", 22 steps, sourced exactly from the ground-truth reference
file's `10.1.2` lab data: privileged EXEC → global config → hostname →
disable DNS lookup → enable secret → console line (password, login,
logging synchronous, exec-timeout) → VTY lines 0-4 (same four
settings) → service password-encryption → banner motd → end → save to
NVRAM (including the blank-Enter destination-filename step). Verified
step-for-step against the reference data before building, and
end-to-end tested — all 22 steps pass, exercise completes, and the
resulting `show running-config` correctly reflects every setting.

**Test commands for this version:**
1. Guided Practice → select **10.1 — Configure Initial Router
   Settings** → complete all 22 steps → confirm it reaches "Completed."
2. After completing, `show running-config` — confirm `no ip
   domain-lookup`, both `line console 0` and `line vty 0 4` blocks
   with `logging synchronous` and `exec-timeout 0 0`, and the banner
   all appear correctly.
3. In Free Practice, try `line vty 0 15` on a fresh device, then
   separately `line vty 0 4` — confirm both work independently as
   distinct lines (switch vs. router convention coexisting).
4. `configure terminal`, `no ip domain-lookup`, `end`, `show
   running-config` — confirm the line appears; then in a fresh
   session, skip that command and confirm it's absent (default is on,
   only shown when explicitly disabled).
5. Re-run **2.4 — Basic Device Configuration** start to finish —
   confirms the existing `line vty 0 15` path and switch exercises are
   unaffected by adding the router-specific `line vty 0 4` variant.

---

## v1.8.1 — 2.8 is now self-contained (adds the addressing steps it depended on)

**Date:** 2026-08-07

**Files:**
- `terminal-v1.8.1.html` — this is the file to open.
- `ios-engine-v1.8.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-8-1.zip`.

**Bug reported:** running the ping step in **2.8 — Verify
Connectivity** showed as unsuccessful (timeout) instead of successful.

**Investigated and root cause found:** the ping logic itself was
correct — a Packet-Tracer-style simulation tied to real device state,
by design (confirmed back in v1.4.0). The actual problem: 2.8's ping
step only succeeds if VLAN 1 is already addressed and up, but 2.8 never
configured that itself — it silently assumed the student had just
finished 2.7 in the same session. Confirmed via the person's own
session transcript: they had pressed "Reset device" then switched
straight to 2.7 with a device that had no addressing configured at
all, so the ping correctly reported failure given that actual state —
it just wasn't the state the exercise assumed.

**Fixed — 2.8 restructured to be fully self-contained:** rather than
special-casing the ping result or silently making it always succeed
(which would have defeated the actual teaching point — a ping should
fail if connectivity genuinely isn't set up), 2.8 now includes the
real addressing steps as its own steps 1-5 (`configure terminal` →
`interface vlan 1` → `ip address 192.168.1.20 255.255.255.0` → `no
shutdown` → `end`), followed by `show ip interface brief` and finally
`ping 192.168.1.1` — now 7 steps total, up from 2. This means 2.8 no
longer depends on 2.7 having been run first, and the ping now
genuinely succeeds as the natural result of the exercise's own steps,
not as a hardcoded pass. Confirmed this also still fails correctly for
a wrong/unreachable address (e.g. `ping 8.8.8.8`).

Also added the same precondition note used on 2.4/2.7/10.1 ("this lab
assumes privileged EXEC mode"), consistent with the rest of the
exercises.

**Also investigated this session, confirmed NOT a bug:** the person
separately reported the precondition note on 2.7 as not appearing —
their follow-up transcript showed it rendering correctly ("Step 1 of
4 / This lab assumes the device is already in privileged EXEC
mode..."). No code change was needed; this was a case of the note
being present but easy to miss on first read, not a display defect.

**Test commands for this version:**
1. Click **Reset device**, then go straight to Guided Practice →
   **2.8 — Verify Connectivity** (skip 2.7 entirely) — confirm it now
   has 7 steps and the precondition note is visible on step 1.
2. Complete all 7 steps in order — confirm the final `ping
   192.168.1.1` shows `!!!!!` and `Success rate is 100 percent`.
3. In Free Practice on a fresh device, without configuring anything,
   try `ping 192.168.1.1` directly — confirm it still correctly times
   out (`.....`, 0 percent), since nothing is addressed yet.
4. After completing 2.8's addressing steps, try `ping 8.8.8.8` (a
   different, unreachable address) in Free Practice — confirm it
   still fails, per the explicit request that a wrong address must
   remain unsuccessful.
5. Re-run **2.7** independently, start to finish — confirms it's
   unaffected by 2.8's restructuring (both exercises configure the
   same VLAN 1 address, but as fully independent, self-contained
   sequences).

---

## v1.9.0 — Module 10.2: Configure Router Interfaces

**Date:** 2026-08-07

**Files:**
- `terminal-v1.9.0.html` — this is the file to open.
- `ios-engine-v1.9.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-9-0.zip`.

**Ground truth obtained:** pulled 10.2.5's exact step data from the
reference file before building, same discipline as 10.1. Revealed a
real syntax detail worth verifying independently: the reference shows
`interface GigabitEthernet 0/0/0` typed WITH a space between the type
name and numbering. Cross-checked against Cisco's own documentation
(multiple IOS/IOS XR sources showing `interface GigabitEthernet
0/0/0/31` and `show controllers GigabitEthernet 0/0/0/31` as valid
typed input) — confirmed this is real, accepted syntax: you type it
with a space, it displays canonically without one. Our reference
file's data was correct, not a typo.

**Added — new commands:**
- `description <text>` (interface_config) — free-text interface
  description, needed its own special-case parser (like `banner motd`)
  since the fixed-token matcher can't accept a variable-length phrase.
  Rendered in `show running-config` immediately after `interface
  <name>`, before `ip address`.
- Interface names now accept an optional space between the type and
  numbering (`interface GigabitEthernet 0/0/0` as well as `interface
  GigabitEthernet0/0/0`), normalized to the canonical no-space form
  before being stored — narrow regex, doesn't affect `interface vlan
  1` or other unrelated commands.

**Fixed — real bug found during testing, unrelated to today's other
changes: `interface <name>` only allowed `global_config` as a starting
mode.** Real IOS lets you jump directly from one interface's config
mode to another (`interface GigabitEthernet0/0/0` → `interface
GigabitEthernet0/0/1`, no `exit` needed in between) — same pattern
already correctly implemented for `line console 0`/`line vty` back in
v1.1.0, but never extended to `interface`/`interface vlan 1`. Without
this fix, configuring a second interface in the same session was
silently impossible: the command failed with "not available in this
mode," but since it's the CORRECT step text in a guided exercise, the
v1.5.1 safety net was catching it — 10.2 would have been unbuildable
without this fix, since it requires configuring two interfaces in a
row. Fixed by adding `interface_config` to both `interface` and
`interface_vlan1`'s valid modes.

**Fixed — `no shutdown` now shows two status lines on physical
interfaces, matching a real router capture:** `%LINK-5-CHANGED`
followed by `%LINEPROTO-5-UPDOWN` on its own line, for any interface
that isn't a Vlan/SVI (which only ever shows the LINK line, per
earlier switch captures). Distinguished by checking whether the
interface name starts with "Vlan".

**Fixed — `show ip interface brief` Method/OK? columns:** were
hardcoded to `manual`/`YES` regardless of whether an IP had actually
been configured. Real IOS (confirmed via a router capture showing
`Serial0/1/0  unassigned  NO  unset  down  down`) shows `unset`/`NO`
for an interface that was visited but never given an IP address.
Fixed to reflect actual per-interface state.

**Added — Module 10.2 exercise:** "10.2 — Configure Router
Interfaces", 11 steps, sourced exactly from the ground-truth
reference: global config → GigabitEthernet0/0/0 (IP, description, no
shutdown) → GigabitEthernet0/0/1 (same three) → end → verify with
show ip interface brief. Verified end-to-end — all 11 steps pass,
exercise completes, and both `show ip interface brief` and `show
running-config` correctly reflect both interfaces' full configuration.

**Noted, not fixed — minor cosmetic gap:** an interface that's
entered but never configured or brought up shows `administratively
down` in our output; the real capture shows plain `down` for this
specific case (an untouched Serial interface). Root cause unclear —
possibly a real distinction between interface types' default states
that we haven't modeled — and doesn't affect any exercise grading,
since exercises check command text, not `show` output content.
Flagged for a future session rather than guessing at a fix now.

**Test commands for this version:**
1. Guided Practice → **10.2 — Configure Router Interfaces** → complete
   all 11 steps, using the space form `interface GigabitEthernet
   0/0/0` exactly as the exercise shows it — confirm it's accepted.
2. After completing, `show ip interface brief` — confirm both
   GigabitEthernet0/0/0 and GigabitEthernet0/0/1 appear with correct
   IPs, `YES`/`manual`/`up`/`up`.
3. In Free Practice, `configure terminal`, `interface
   GigabitEthernet0/0/0`, then directly `interface
   GigabitEthernet0/0/1` (no `exit` in between) — confirm this works
   without error (this was the real bug found and fixed this version).
4. `description Test description with spaces`, then `show
   running-config` — confirm the full multi-word description appears
   correctly.
5. `no shutdown` on a non-Vlan interface — confirm you see BOTH
   `%LINK-5-CHANGED` and `%LINEPROTO-5-UPDOWN` lines; then `interface
   vlan 1`, `no shutdown` — confirm Vlan1 still shows only the single
   `%LINK-5-CHANGED` line.

---

## v1.9.1 — Bug fix: Tab completion for interface type names

**Date:** 2026-08-07

**Files:**
- `terminal-v1.9.1.html` — this is the file to open.
- `ios-engine-v1.9.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-9-1.zip`.

**Bug reported:** typing `interface g` and pressing Tab did nothing,
even though `interface g0/0/0` followed by Enter has correctly
resolved to `GigabitEthernet0/0/0` since v1.7.3.

**Root cause:** `getCompletions()` (which powers Tab) and
`normalizeInterfaceName()` (which powers abbreviation at Enter) were
disconnected logic paths. `getCompletions()` deliberately skips
offering completions for any `<name>`-style free-form argument slot —
correct for things like IPs, passwords, and hostnames, which have no
fixed vocabulary — but interface type names (`GigabitEthernet`,
`FastEthernet`, `Serial`, etc.) DO have a fixed vocabulary, the same
`INTERFACE_TYPES` list `normalizeInterfaceName()` already used.
`getCompletions()` just never consulted it.

**Fixed:** `getCompletions()` now special-cases the token right after
`interface` (when in `global_config` or `interface_config` mode,
matching where the `interface` command is valid), drawing candidates
from the same `INTERFACE_TYPES` list already used at Enter-time, so
the two can't drift apart again. `interface g` + Tab now completes to
`interface GigabitEthernet`; `interface ` (trailing space, nothing
typed) + Tab correctly shows all five types as ambiguous.

**Confirmed already working, no fix needed:** typing the full
abbreviated form at Enter (`interface g0/0/0`) without ever pressing
Tab — this was raised as a possible concern but was already correct
since v1.7.3; only the Tab-specific path had the gap.

**Test commands for this version:**
1. `enable`, `configure terminal`, then type `interface g` and press
   Tab — should complete to `interface GigabitEthernet`.
2. Type `interface ` (with a trailing space, nothing else) and press
   Tab — should show all five interface types as ambiguous
   (GigabitEthernet, FastEthernet, Serial, Loopback, Vlan).
3. `interface f` + Tab — should complete to `interface FastEthernet`.
4. Enter `interface GigabitEthernet0/0/0`, then from inside that
   interface's config mode, type `interface g` + Tab — should still
   complete correctly (jumping directly to another interface).
5. Confirm `interface g0/0/1` + Enter (no Tab at all) still works
   exactly as before — this path was never broken, verifying the fix
   didn't regress it.

---

## Ideas Backlog

**Project purpose and design priorities (context from the person,
2026-08-08):** this tool exists specifically for CLI repetition
practice. The person has already passed Network+ and is familiar with
most CCNA concepts from that exam — the gap is CLI muscle memory, not
conceptual understanding. Packet Tracer is useful but has slow setup
per session; this tool's core value is running the SAME exercises
MANY times, quickly, from any browser, with near-zero setup. This
should be a standing filter on future design decisions: prefer low
friction and fast repetition over topology realism, even where
Packet Tracer would do something more elaborate. A perfectly accurate
multi-device setup that takes minutes to configure before typing a
single command would undermine the actual point of this tool.

**Future Packet Tracer-style (`_pt_`) exercises will need a device
switcher UI** — buttons to switch between the specific
routers/switches involved in a given problem, not a topology map to
navigate. Each Packet Tracer-style problem will need its own defined
device set (unlike Syntax Checker exercises, which all share one
device). This builds on the `DEVICE_MODELS`/multi-device foundation
laid in v1.12.0, but needs a selector UI on top of it that doesn't
exist yet.

**Future: a Windows-CMD-style pane**, separate from the router/switch
IOS terminal — for `ping`, `ipconfig`, and similar host-side commands,
relevant once Packet Tracer-style exercises involve PCs, not just
network devices. Explicitly not being built yet — logged here so it
isn't lost.

Running list of future work, gathered from Cisco Networking Academy
official lab worksheets (uploaded 2026-08-07: Network Representation,
Deploying/Cabling Devices, Navigate the IOS, Navigate the IOS via Tera
Term, Basic Switch/End Device Config, View NIC Info, Connect the
Physical Layer, Wireshark Ethernet Frames, View Device MAC Addresses,
View Switch MAC Address Table, Identify MAC/IP Addresses, Examine ARP
Table, IPv6 Neighbor Discovery, Configure Initial Router Settings,
Connect a Router to a LAN, Troubleshoot Default Gateway Issues, Basic
Device Configuration) plus earlier sessions. Not scoped or committed
to — just candidates to pull from deliberately when picking the next
piece of work.

**New commands/behavior worth building:**
- `show mac address-table` / `clear mac address-table dynamic` —
  needs some notion of other devices existing to be meaningful.
- `show arp` — same dependency.
- `clock` / `clock set` / `show clock` — fully self-contained, no
  multi-device dependency, could build any time.
- `show version` — commonly taught, currently unused anywhere.
- Partial ping success (e.g. `.!!!!` → `80 percent (4/5)`) — real
  Cisco lab output shows this; our engine currently only does
  all-success or all-fail, never partial.
- Real IOS boilerplate lines in `show running-config` (`version`,
  `no service timestamps...`, `ip cef`, `spanning-tree mode pvst`,
  etc.) — previously judged low-value/high-effort (see v1.7.2/v1.7.3
  notes) but flagged again here in case that judgment should be
  revisited.
- Confirmed via a real capture: an `unset`-method interface can be
  `up`/`up`, not only `down`/`down` — worth double-checking our
  `unset` logic (added in v1.9.0) handles this correctly, since it
  was built from a single capture showing only the down case.

**New exercise types/shapes, not yet represented in our tool:**
- A troubleshooting-style exercise (find and fix a pre-seeded
  misconfiguration) — every exercise built so far is
  build-from-scratch; this is a structurally different shape.
- `?`-based exploratory help practice (`S1> ?`, `t?`, `te?`) —
  distinct from our `?commands` training command, which lists
  everything rather than teaching context-sensitive narrowing.

**Multi-device / topology-dependent (still blocked on the bigger
multi-device architecture work discussed earlier in this project):**
- ARP table exploration, MAC address table building across multiple
  switches, PDU/simulation-mode style packet tracing, IPv6 Neighbor
  Discovery — all of these are core content in the uploaded PDFs but
  fundamentally require more than one device to be meaningful.

---

## v1.10.0 — Module 12.6: Configure IPv6 Addressing

**Date:** 2026-08-08

**Files:**
- `terminal-v1.10.0.html` — this is the file to open.
- `ios-engine-v1.10.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-10-0.zip`.

**Ground truth obtained:** exact step data for 12.6.5 pulled from the
reference file, plus a real router capture (a Cisco 2911 router
session) covering `ipv6 unicast-routing`, `ipv6 address .../64`,
`ipv6 address ... link-local`, and the full real `show ipv6 interface
brief` and `show running-config` output.

**Added — new commands:**
- `ipv6 unicast-routing` (global_config) — IPv6 routing disabled by
  default, must be explicitly enabled. Confirmed via the real capture
  that this correctly fails with a mode error from priv_exec.
- `ipv6 address <address>/<prefix-length>` (interface_config) — the
  global IPv6 address, with genuine RFC 4291 syntax validation (see
  below).
- `ipv6 address <address> link-local` (interface_config) — a second,
  separate command on the same interface; no prefix length on this
  form, matching real IOS syntax exactly.
- `show ipv6 interface brief` — an entirely different output shape
  from the IPv4 version, not a variant of it: bracketed
  `[status/protocol]` per interface, with link-local and global
  addresses listed on their own indented lines below, link-local
  first. Verified BYTE-FOR-BYTE against both the ground-truth lab
  script's expected output and a separate live router capture.

**Investigated and deliberately NOT implemented as originally
suspected:** the real router capture showed `200:db8:1:1::1/64`
rejected by real IOS. Independently verified (via a standard IPv6
library) that this address is actually valid IPv6 syntax — likely a
typo for `2001:db8:1:1::1` that happened to still parse. Rather than
guess at an unverified stricter-than-standard rule, the validator
follows genuine RFC 4291 syntax rules instead: full 8-group hex
addresses or `::`-compressed forms, rejecting only genuinely malformed
input (too many groups, multiple `::`, invalid characters, oversized
groups).

**Fixed — real regression found via full regression testing:** adding
`ipv6` as a recognized keyword broke every existing `ip address` / `ip
domain-lookup` command. Root cause: abbreviation resolution (both at
Enter and via Tab) checked "is this ambiguous?" before checking "is
this an exact match?" — so a fully-typed `ip` was incorrectly flagged
as ambiguous with `ipv6`, since `ip` is a literal prefix of `ipv6`.
Fixed by checking for an exact match first, in both
`resolveAbbreviations()` (Enter) and `getCompletions()` (Tab) — an
exact full-word match now always wins immediately, regardless of what
else happens to share that prefix. Verified genuine ambiguity (e.g.
`c` for configure/copy/clock/clear/connect) still correctly triggers;
this was a precise fix, not an overcorrection.

**Added — Module 12.6 exercise:** "12.6 — Configure IPv6 Addressing",
12 steps, sourced exactly from the ground-truth reference: enable
IPv6 routing, configure two interfaces each with a global `/64`
address and a link-local address, bring both up, verify. Full
regression across all 8 exercises (2.2, 2.4, 2.5, 2.7, 2.8, 10.1,
10.2, 12.6) passes cleanly.

**Test commands for this version:**
1. Guided Practice → **12.6 — Configure IPv6 Addressing** → complete
   all 12 steps.
2. After completing, confirm `show ipv6 interface brief` matches
   exactly: `GigabitEthernet0/0/0       [up/up]` then indented
   `FE80::1:1` and `2001:DB8:ACAD:1::1` lines.
3. Free Practice: `ipv6 unicast-routing` from priv_exec (not global
   config) — confirm it's rejected with a mode error.
4. Free Practice: `ip address 192.168.1.1 255.255.255.0` in full —
   confirm this still works with no "ambiguous" error (this was the
   regression found and fixed this version).
5. Tab-complete `ip` alone — confirm it completes/confirms as `ip`,
   not reported as ambiguous with `ipv6`.

---

## v1.10.1 — Bug fix: Tab completion echoes on a new line, matching real IOS

**Date:** 2026-08-08

**Files:**
- `terminal-v1.10.1.html` — this is the file to open.
- `ios-engine-v1.10.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-10-1.zip`.

**Behavior clarified by the person:** real IOS Tab completion does
NOT rewrite the current input line in place. Typing `conf` and
pressing Tab drops to a NEW line showing `configure` (prompt repeated,
cursor ready to continue typing after the completed word) — not an
edit of the line you were on. Confirmed this applies on every Tab
press, not just the first: continuing to type `t` and pressing Tab
again drops to another new line showing `configure terminal`, and so
on.

**Fixed:** Tab completion in the terminal UI now appends a new
terminal-output line showing `<prompt> <completed-so-far>` each time
Tab resolves a unique completion, then clears the input box and
continues typing from a blank input (visually appearing to continue
on from the echoed line) — matching the real multi-line echo behavior
instead of editing the input box's existing text. Ambiguous and
no-match Tab presses are unaffected (ambiguous still lists candidates
inline; no-match still does nothing, per existing real-IOS-accurate
behavior).

**Test commands for this version:**
1. Type `conf`, press Tab — confirm a new line appears showing
   `<prompt> configure`, and the input box is now empty/ready for more
   typing (not showing `configure` in the input box itself).
2. Continue typing `t`, press Tab — confirm ANOTHER new line appears
   showing `<prompt> configure terminal`.
3. Press Enter — confirm the command actually executes correctly
   (global config mode entered), since the multi-line echo shouldn't
   change what actually gets submitted.
4. Type `int g0/0` then Tab on an ambiguous or interface-name
   completion — confirm this still works correctly with the new
   line-echo behavior applied consistently.
5. Full run of **2.2 — Navigate Between IOS Modes** using Tab
   completion throughout instead of typing full commands — confirms
   the exercise checker still correctly recognizes the final
   completed commands regardless of how many Tab-echoed lines
   preceded each Enter.

---

## v1.10.2 — Bug fix: Tab completion should pre-fill the input, not clear it

**Date:** 2026-08-08

**Files:**
- `terminal-v1.10.2.html` — this is the file to open.
- `ios-engine-v1.10.2.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-10-2.zip`.

**Bug reported:** after v1.10.1's fix (Tab echoes the completed word
on a new terminal line), the input box was left EMPTY after each Tab
press. This broke the actual real-IOS behavior it was meant to
replicate: typing `conf` + Tab should echo `configure` on a new line
AND leave `configure ` sitting in the input box, ready to continue
typing (e.g. `t` next) — not force retyping from scratch.

**Fixed:** Tab completion now both echoes the completed word as a new
terminal line AND pre-fills the input box with that same completed
word (plus a trailing space, cursor at the end) — matching the
original v1.0.0-era in-place completion behavior, just with the
addition of the new-line echo from v1.10.1. This also simplified the
code: since the input box now naturally accumulates the full line
across multiple Tabs, the separate `tabAccumulatedPrefix` tracking
variable added in v1.10.1 is no longer needed and was removed — the
Enter handler now just uses the input box's value directly, same as
before v1.10.1.

**Also fixed (cosmetic):** the final Enter echo line had a trailing
space when the input box's last content came from a Tab completion
(e.g. `configure terminal ` instead of `configure terminal`). Trimmed
trailing whitespace from the echoed display line only — what actually
gets executed is unchanged.

**Verified end-to-end** (traced through the underlying completion
logic precisely, since this is UI/DOM behavior that can't run directly
in Node): typing `conf` + Tab, then `t` + Tab, then Enter with nothing
more typed, produces exactly:
```
R1#configure
R1#configure terminal
R1#configure terminal
```
with the device correctly entering global config mode on the final
Enter. Full regression on 2.2 and 12.6 passes.

**Test commands for this version:**
1. Type `conf`, press Tab — confirm a new line echoes `configure` AND
   the input box now shows `configure ` (not empty).
2. Without clearing anything, type `t` — confirm it appends onto the
   existing `configure ` text in the box, then press Tab — confirm
   another new line echoes `configure terminal`, input box now shows
   `configure terminal `.
3. Press Enter — confirm the command executes (global config mode
   entered) and the final echoed line has no trailing space.
4. Type `c` (genuinely ambiguous) + Tab — confirm the input box is
   left unchanged (still just `c`), matching real IOS's silent
   non-completion on ambiguity.
5. Full run of **2.2 — Navigate Between IOS Modes** using Tab
   completion throughout — confirms the exercise checker still
   recognizes each completed command correctly.

---

## v1.10.3 — Course-prefixed exercise IDs and labels, ahead of Course 2/3

**Date:** 2026-08-08

**Files:**
- `terminal-v1.10.3.html` — this is the file to open.
- `ios-engine-v1.10.3.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-10-3.zip`.

**Rationale:** all 8 exercises built so far are Course 1 (ITN) content,
but nothing distinguished them as such — module numbers like "2.2" or
"10.1" will collide with Course 2 (SRWE) and Course 3 (ENSA) module
numbering once that content gets built. Doing this rename now, while
there are only 8 exercises, is far cheaper than retrofitting later.
Confirmed with the person: do the deeper rename (internal IDs, not
just the visible label) so future course additions follow the
established pattern from day one.

**Changed — every exercise ID prefixed with `c1_`:**
- `2.2_navigate_ios_modes` → `c1_2.2_navigate_ios_modes`
- `2.4_basic_device_configuration` → `c1_2.4_basic_device_configuration`
- `2.5_save_configurations` → `c1_2.5_save_configurations`
- `2.7_configure_ip_addressing` → `c1_2.7_configure_ip_addressing`
- `2.8_verify_connectivity` → `c1_2.8_verify_connectivity`
- `10.1_configure_initial_router_settings` → `c1_10.1_configure_initial_router_settings`
- `10.2_configure_router_interfaces` → `c1_10.2_configure_router_interfaces`
- `12.6_configure_ipv6_addressing` → `c1_12.6_configure_ipv6_addressing`
- The default exercise on page load (`currentExerciseId`) updated to
  match.

**Changed — every `moduleLabel` prefixed with `Course 1 · `**, e.g.
"2.2 — Navigate Between IOS Modes" is now "Course 1 · 2.2 — Navigate
Between IOS Modes", visible in the module dropdown.

**Convention established for future course content:** Course 2
(SRWE) exercises should use `c2_` / `Course 2 · `, Course 3 (ENSA)
should use `c3_` / `Course 3 · `, following this same pattern exactly.

**Verified:** searched the full file for any remaining unprefixed
reference to the old IDs — none found, confirming the rename is
complete and consistent (no stragglers using the old ID that would
silently fail to match). Full regression across all 8 exercises,
addressed by their new IDs, passes cleanly.

**Also investigated this session, confirmed NOT a bug:** the person's
own testing found `ipv6 address 200:db8:acad:1::1/64` was accepted
rather than rejected. This is expected and already documented — see
v1.10.0's notes: that address is genuinely valid IPv6 syntax
(confirmed independently), even though it resembles a likely typo;
the real router's rejection of a near-identical address wasn't from a
verifiable rule, so an unconfirmed stricter-than-standard check was
deliberately not implemented.

**Test commands for this version:**
1. Open the page fresh — confirm the default Guided Practice exercise
   is "Course 1 · 2.2 — Navigate Between IOS Modes" (not just "2.2 —
   ...").
2. Open the module dropdown — confirm all 8 entries show the
   "Course 1 · " prefix consistently.
3. Select and complete **Course 1 · 12.6 — Configure IPv6 Addressing**
   start to finish — confirms the rename didn't break exercise
   lookup/execution.
4. Switch between two different exercises via the dropdown (e.g. 2.2
   → 10.1 → 2.8) — confirms `startExercise()` correctly resolves the
   new IDs in both directions.
5. Reset the device and exercise, reload the page — confirms nothing
   about page load/initialization broke from the ID rename.

---

## v1.10.4 — Distinguish Syntax Checker vs. Packet Tracer content in naming

**Date:** 2026-08-08

**Files:**
- `terminal-v1.10.4.html` — this is the file to open.
- `ios-engine-v1.10.4.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-10-4.zip`.

**Rationale:** all 8 exercises built so far are scripted, step-by-step
Syntax Checker drills, sourced from the ground-truth reference file.
Future work will also include Packet Tracer-style activities —
typically more open-ended/scenario-based, sometimes multi-device, and
using entirely different module numbering than the Syntax Checkers
(so a Packet Tracer "10.4" and a Syntax Checker "10.1" are unrelated
content, not the same module referenced two ways). Nothing currently
distinguishes which kind an exercise is. Doing this rename now, right
after the Course-prefix rename in v1.10.3 and while there are still
only 8 exercises, is far cheaper than doing it after Packet Tracer
content already exists.

**Changed — every exercise ID gets a `syn_` marker after the course
prefix:**
- `c1_2.2_navigate_ios_modes` → `c1_syn_2.2_navigate_ios_modes`
- `c1_2.4_basic_device_configuration` → `c1_syn_2.4_basic_device_configuration`
- `c1_2.5_save_configurations` → `c1_syn_2.5_save_configurations`
- `c1_2.7_configure_ip_addressing` → `c1_syn_2.7_configure_ip_addressing`
- `c1_2.8_verify_connectivity` → `c1_syn_2.8_verify_connectivity`
- `c1_10.1_configure_initial_router_settings` → `c1_syn_10.1_configure_initial_router_settings`
- `c1_10.2_configure_router_interfaces` → `c1_syn_10.2_configure_router_interfaces`
- `c1_12.6_configure_ipv6_addressing` → `c1_syn_12.6_configure_ipv6_addressing`
- Default exercise on page load (`currentExerciseId`) updated to match.

**Changed — every `moduleLabel` gets an 8-character tag inserted after
the course prefix**, e.g. "Course 1 · 2.2 — Navigate Between IOS
Modes" is now "Course 1 · SyntxChk · 2.2 — Navigate Between IOS
Modes", visible in the module dropdown.

**Convention established for future Packet Tracer content:** ID
prefix `_pt_` (e.g. `c1_pt_10.4_basic_device_configuration`), label
tag `PacketTr` (also 8 characters, chosen to visually align with
`SyntxChk` in the dropdown) — e.g. "Course 1 · PacketTr · 10.4 —
Basic Device Configuration". Both course (`c1`/`c2`/`c3`) and type
(`syn`/`pt`) prefixes now compose independently, so e.g. a future
Course 2 Packet Tracer exercise would be `c2_pt_...` with label
"Course 2 · PacketTr · ...".

**Verified:** searched the full file for any remaining reference to
the pre-rename IDs (`c1_2.`, etc.) — none found. Full regression
across all 8 exercises, addressed by their new `c1_syn_` IDs, passes
cleanly.

**Test commands for this version:**
1. Open the page fresh — confirm the default Guided Practice exercise
   label reads "Course 1 · SyntxChk · 2.2 — Navigate Between IOS
   Modes".
2. Open the module dropdown — confirm all 8 entries show the
   "Course 1 · SyntxChk · " prefix, and that `SyntxChk` visually
   lines up consistently across every entry.
3. Select and complete **Course 1 · SyntxChk · 12.6 — Configure IPv6
   Addressing** start to finish — confirms the second rename in two
   versions didn't break exercise lookup/execution.
4. Switch between several exercises via the dropdown — confirms
   `startExercise()` resolves the new `c1_syn_` IDs correctly in both
   directions.
5. Reset device and exercise, reload the page — confirms
   initialization still works correctly after the ID change.

---

## v1.11.0 — Module 16.4: Configure Secure Passwords and SSH

**Date:** 2026-08-08

**Files:**
- `terminal-v1.11.0.html` — this is the file to open.
- `ios-engine-v1.11.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-11-0.zip`.

**Scope confirmed before building:** configure-and-store only, no
behavioral login enforcement (consistent with how `enable secret` and
line passwords already work) — real SSH/local-login enforcement
remains part of the already-deferred future password-enforcement
project, not folded in here.

**Added — new device state: named local user database.** `device.users`
is now a map of `username -> { secret }`, built as reusable
infrastructure rather than a one-off field, since future
AAA/login-related exercises will likely need the same shape. Tracked
through `snapshotConfig`/`applyConfigSnapshot` like everything else,
so `copy`/`reload` handle it correctly.

**Added — new commands:**
- `security passwords min-length <n>` (global_config) — stored only,
  not enforced against other password commands (matches the
  configure-and-store scope decision).
- `ip domain-name <name>` (global_config) — required by real IOS
  before RSA keys can be generated.
- `username <name> secret <password>` (global_config) — creates an
  entry in the new local user database.
- `crypto key generate rsa modulus <bits>` (global_config) — the
  command that actually "enables" SSH. Requires a domain name to
  already be set (matches real IOS: fails with "% Please define a
  domain-name first." otherwise, verified this precondition check
  against the ground-truth lab's own framing). On success, the key
  name is derived from `hostname + "." + domainName` (e.g.
  `R1.cisco.com`) — not hardcoded — and the full multi-line real IOS
  response is reproduced exactly: key name, modulus confirmation,
  generation message, `[OK]`, and the separate `%SSH-5-ENABLED`
  system message.
- `ip ssh version <n>` (global_config) — stored, shown in `show
  running-config`.
- `login local` (line_config) — distinct from the existing `login`
  command; requires username/password from the local database rather
  than a single shared line password.
- `transport input ssh` (line_config) — restricts a line to SSH,
  rendered in `show running-config`.

**`show running-config` updated** to include all of the above in
reasonable positions (security settings near the top, domain name and
users before SSH version, line-level `login local`/`transport input
ssh` alongside existing line settings). No real capture was available
for this module's exact `show run` ordering, so positions are a
considered best judgment rather than verified byte-for-byte like
earlier modules — flagged here in case a real capture surfaces later
to check against.

**Added — Module 16.4 exercise:** "16.4 — Configure Secure Passwords
and SSH", 13 steps, sourced exactly from the ground-truth reference:
global config → minimum password length → enable secret → domain
name → local user → RSA key generation → SSH version 2 → VTY lines
with `login local` and `transport input ssh` → save. Verified
end-to-end: all 13 steps pass, exercise completes, user database
correctly populated, `show running-config` reflects every setting
correctly.

**Full regression:** all 9 exercises (2.2, 2.4, 2.5, 2.7, 2.8, 10.1,
10.2, 12.6, 16.4) pass cleanly.

**Test commands for this version:**
1. Guided Practice → **Course 1 · SyntxChk · 16.4 — Configure Secure
   Passwords and SSH** → complete all 13 steps.
2. Free Practice: `configure terminal`, `crypto key generate rsa
   modulus 1024` WITHOUT setting a domain name first — confirm it's
   rejected with "% Please define a domain-name first."
3. Set `hostname R2`, `ip domain-name example.com`, then `crypto key
   generate rsa modulus 1024` — confirm the response shows "The name
   for the keys will be: R2.example.com" (derived, not hardcoded).
4. `username admin secret cisco12345`, then `username guest secret
   guestpass` — confirm both appear correctly in `show running-config`
   as separate `username ... secret ...` lines.
5. On a VTY line, `login local` and `transport input ssh` — confirm
   both show up under that line's block in `show running-config`,
   alongside (not replacing) other line settings like
   `logging synchronous` if also set.

---

## v1.11.1 — Module 17.5 (last of Course 1's Syntax Checkers): Verify Directly Connected Networks

**Date:** 2026-08-08

**Files:**
- `terminal-v1.11.1.html` — this is the file to open.
- `ios-engine-v1.11.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-11-1.zip`.

**This completes all 8 of Course 1's real Syntax Checkers** (2.2, 2.4,
2.7, 10.1, 10.2, 12.6, 16.4, 17.5), confirmed against the ground-truth
reference file's own lab list.

**Ground truth obtained:** a real live router capture (`ISPRouter`,
Cisco 1941) covering full, complete output for `show ip route`, `show
interfaces` (all four interfaces: up GigabitEthernet, admin-down
GigabitEthernet, admin-down Serial, up Serial, plus Vlan1), and `show
ip interface brief` — the most detailed capture obtained so far.

**Fixed — real bug found and corrected: `OK?` column logic was wrong
since v1.9.0.** Previously tied to whether an IP was configured
(`NO` when unassigned). The new capture proves this wrong:
`GigabitEthernet0/1  unassigned  YES  unset  administratively down
down` — `OK?` is `YES` regardless of IP configuration; it reflects
config validity, not IP presence. `Method` is what actually reflects
IP state (`unset` vs `manual`), which was already correct. This
directly contradicted the ground-truth reference file's own Serial0/1/0
example (which showed `NO`) — since a real live router capture is a
stronger source than a third-party recreation, the live capture was
treated as authoritative. Verified all 5 rows of `show ip interface
brief` now match the real capture byte-for-byte.

**Added — `show ip route`:** directly-connected/local routes only (no
static/dynamic routing — consistent with this being a single-device
engine; full routing remains blocked on the future multi-device
topology work). Groups routes by network, shows the "variably
subnetted" summary line, then `C` (connected) and `L` (local /32)
entries. Verified real IOS sorts route groups NUMERICALLY by network
address, not by configuration order (a Serial interface configured
AFTER a GigabitEthernet interface still appeared first in the real
capture, since its network number was numerically smaller) — matched
exactly. New subnet-math helpers added: `intToIp`, `maskToPrefixLength`,
`networkAddress`. Verified the full multi-line output is an EXACT
character-for-character match against the real capture.

**Added — `show interfaces <name>`** (the detailed/long form, distinct
from `show ip interface brief`): hardware line, description, IP/prefix,
MTU/bandwidth/delay (correctly different for Serial vs Ethernet:
1544 Kbit/20000 usec vs 1000000 Kbit/10 usec), encapsulation (HDLC vs
ARPA), and the full counter/queue block. Deliberately simplified in
two documented ways: hardware address is a plausible generated value
(deterministic per interface name, not a real/meaningful MAC), and
packet/error counters are always zero (no real traffic history to
report) — judged sufficient since the parts that matter for CCNA
verification (state, IP, MTU/BW, description) are accurate.

**Fixed — bug found during testing: `show interfaces <Type> <slot>`
(with a space) failed with "% Invalid input detected."** The
space-normalization logic added in v1.9.0 only matched lines starting
with `interface `, never extended to `show interfaces `. Both forms
now share one normalization step.

**Fixed — Serial interface hardware line was wrong.** Initially
reused the Ethernet "CN Gigabit Ethernet" hardware string with a fake
MAC for Serial interfaces too. Real capture shows Serial interfaces
report `Hardware is HD64570` with NO MAC address at all. Fixed to
distinguish Serial from Ethernet interfaces in the hardware line.

**Added — Module 17.5 exercise:** "17.5 — Verify Directly Connected
Networks", 13 steps. Built SELF-CONTAINED per direction — includes the
same GigabitEthernet0/0/0 / 0/0/1 addressing steps as 10.2 (rather
than assuming that module was already completed), followed by the
four real verification commands from the ground-truth script:
`show ip interface brief`, `show interfaces GigabitEthernet 0/0/0`,
`show ip route`, `show running-config`. Verified end-to-end.

**Full regression:** all 10 exercises pass cleanly.

**Test commands for this version:**
1. Guided Practice → **Course 1 · SyntxChk · 17.5 — Verify Directly
   Connected Networks** → complete all 13 steps (starting fresh, no
   prior module needed).
2. After the addressing steps, `show ip interface brief` — confirm
   `OK?` shows `YES` even for interfaces you haven't configured
   (e.g. check a router interface you never touched).
3. `show ip route` — confirm output matches the real format: grouped
   by network, sorted numerically (try configuring a lower-numbered
   network after a higher one and confirm it still sorts first).
4. `show interfaces GigabitEthernet 0/0/0` (with the space) — confirm
   it works (this was the specific bug found and fixed this version).
5. `show interfaces Serial0/0/1` on a configured, up Serial interface
   — confirm the hardware line reads `Hardware is HD64570` with no
   MAC address, and MTU/BW/DLY show `1544 Kbit`/`20000 usec`.

---

## v1.12.0 — Device models with fixed interface inventories (foundation for multi-device work)

**Date:** 2026-08-08

**Files:**
- `terminal-v1.12.0.html` — this is the file to open.
- `ios-engine-v1.12.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-12-0.zip`.

**Bug reported:** `show interfaces Serial0/0/1` failed with "% Invalid
interface" even on a router, because the interface had never been
manually entered via `interface Serial0/0/1` first. Root cause: the
engine only ever "knew about" an interface once a human typed
`interface <name>` for it — it had no concept of a device's real,
fixed hardware inventory existing from boot, unconfigured or not.
This also explained why `show ip interface brief`/`show interfaces`
could never show hardware-present-but-untouched interfaces the way
real captures (v1.11.1's ISPRouter session) do.

**Design decision, discussed and confirmed before building:** rather
than a narrow patch, build this as the foundation for eventual
multi-device support — a Device is now a self-contained object with a
real identity (`deviceType` + its fixed interface inventory), so a
future topology holding multiple Device instances is a natural
extension rather than a rewrite later. Scoped to single-device for
now; true multi-device topology remains a separate future project.

**Added — `DEVICE_MODELS`:** two device types with fixed interface
inventories present from device creation, matching real Cisco
hardware:
- `router` — GigabitEthernet0/0, GigabitEthernet0/1, Serial0/0/0,
  Serial0/0/1, Vlan1 (matches the Cisco 1941 used in every real
  router capture gathered so far, including the ISPRouter session).
- `switch` — FastEthernet0/1 through 0/24, GigabitEthernet0/1,
  GigabitEthernet0/2, Vlan1 (standard 2960-style access switch).

`createDevice(hostname, deviceType)` now pre-populates
`device.interfaces` with every entry from the model's list (all
defaulted to unconfigured/administratively-down), instead of starting
with an empty map. A shared `freshInterfaceState()` helper is used by
both `createDevice()` and `getOrCreateInterface()`'s lazy fallback, so
the two default shapes can never drift apart.

**Fixed — `applyConfigSnapshot()`'s "no startup-config" boot path**
and **`hasUnsavedChanges()`'s fresh-device comparator** both
previously assumed an empty `interfaces: {}` on a blank device — now
both correctly rebuild the device-type-appropriate fresh inventory,
so a `reload` with nothing saved correctly restores the FULL physical
interface set (unconfigured) rather than wiping it to nothing, and a
genuinely untouched fresh device is still not incorrectly flagged as
having "unsaved changes."

**Changed — the shared device (used across all Guided/Free practice)
now defaults to `deviceType: "router"`**, since most actively-developed
exercises are router-based and a router's interface set is a strict
superset of what switch exercises need (they only ever touch Vlan1).
Verified all 10 existing exercises — including the switch-flavored
ones (2.2, 2.4, 2.7, 2.8) — still pass correctly on a router-typed
device. Explicitly NOT doing per-exercise device-type switching in
this version, since that would destroy in-progress device state,
conflicting with the shared-state design principle established back
in v1.1.0 — flagged for reconsideration once real multi-device
support exists.

**Verified against real capture data:** a fresh router's `show ip
interface brief` now matches the real ISPRouter capture's shape
exactly (all interfaces listed, `YES`/`unset`/`administratively down`
for untouched ones). `show running-config` on a partially-configured
router now correctly shows every physical interface's block
(configured ones with their settings, untouched ones with just
`shutdown`), matching the real captures from v1.9.0/v1.11.1.

**Reference material logged for future Packet Tracer work (not yet
built):** the person shared
https://itexamanswers.net/ccna-1-v7-exam-answers-introduction-to-networks-v7-0-itn.html
— a complete Packet Tracer + Lab index for Course 1, with individual
answer pages per activity (confirms real numbering for
activities like 17.5.9, 12.6.6, 16.4.6, and gives a ready reference
source for future `_pt_`-prefixed exercise work once that phase
starts).

**Full regression:** all 10 exercises pass cleanly on the new
router-typed shared device.

**Test commands for this version:**
1. Reset device, Free Practice: `show ip interface brief` on a
   completely untouched device — confirm all 5 router interfaces
   appear (not just ones you've configured).
2. `show interfaces Serial0/0/1` without ever entering it via
   `interface Serial0/0/1` first — confirm it now works (this was the
   exact bug reported) and shows realistic administratively-down
   detail.
3. Configure one interface, then `reload` and answer `no` to discard
   — confirm `show ip interface brief` afterward still shows ALL 5
   interfaces (not an empty list), just with the configured one now
   reset to unconfigured.
4. Complete **17.5 — Verify Directly Connected Networks** end to
   end — confirms the new inventory doesn't break existing exercises.
5. `show running-config` on a device with only one interface
   configured — confirm the other 4 interfaces still appear in the
   output with just `shutdown` (matching real IOS behavior).

---

## v1.12.1 — Bug fix: Tab completion for "show interfaces <Type>"

**Date:** 2026-08-08

**Files:**
- `terminal-v1.12.1.html` — this is the file to open.
- `ios-engine-v1.12.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-12-1.zip`.

**Bug reported:** `show interfaces gi` + Tab did nothing (no
completion); `show interfaces s` + Tab also did nothing.

**Root cause:** the interface-type Tab-completion special case (added
in v1.9.1 to fix the same class of bug for `interface <Type>`) only
ever checked for the pattern "interface" at token position 0 followed
by the type at position 1. `show interfaces <Type>` (added in v1.11.1)
has the type name at position 2, after "show" and "interfaces" — a
different token shape the original fix never covered, so it silently
fell through to "no completion" instead.

**Fixed:** generalized the special case to recognize BOTH shapes —
`interface <Type>` (position 1, valid in global_config/interface_config)
and `show interfaces <Type>` (position 2, valid in
user_exec/priv_exec) — sharing one completion path against the same
`INTERFACE_TYPES` list, so the two command forms can't drift apart
again the way they just did. Verified: `show interfaces s` + Tab now
completes to `show interfaces Serial`; `show interfaces gi` + Tab
completes to `show interfaces GigabitEthernet`.

**Also verified, working as intended (not a bug):** `show interfaces
f` + Tab completes to `show interfaces FastEthernet` even on a router
device, which has no FastEthernet interfaces. This is correct —
real IOS's Tab completion matches against the vocabulary of valid
interface TYPE NAMES generically, independent of what a specific
device actually has; the "does this interface exist on this device"
check correctly happens separately at Enter/execution time (confirmed
`show interfaces FastEthernet0/1` on a router still fails with "%
Invalid interface" when actually run).

**Full regression:** all 10 exercises pass cleanly.

**Test commands for this version:**
1. From priv_exec, `show interfaces s` + Tab — confirm it completes
   to `show interfaces Serial`.
2. `show interfaces gi` + Tab — confirm it completes to `show
   interfaces GigabitEthernet`.
3. `show interfaces ` (trailing space, nothing typed) + Tab — confirm
   it shows all 5 interface types as ambiguous candidates.
4. `show interfaces f` + Tab on a router device — confirm it
   completes to `show interfaces FastEthernet`, then press Enter —
   confirm it correctly FAILS with "% Invalid interface" (router has
   no FastEthernet).
5. Full run of **17.5 — Verify Directly Connected Networks**,
   completing the `show interfaces GigabitEthernet 0/0/0` step using
   Tab completion instead of typing it in full — confirms the fix
   works end-to-end inside a real guided exercise.

---

## v1.12.2 — Bug fix: router interface names didn't match what our own exercises configure

**Date:** 2026-08-08

**Files:**
- `terminal-v1.12.2.html` — this is the file to open.
- `ios-engine-v1.12.2.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-12-2.zip`.

**Bug reported:** after configuring `interface GigabitEthernet 0/0/0`
and `GigabitEthernet 0/0/1` in a real testing session, `show ip
interface brief` showed SEVEN interfaces instead of five — the fixed
5-interface router inventory added in v1.12.0 PLUS two new
"unknown"-to-the-model interfaces auto-created by
`getOrCreateInterface()`'s fallback path.

**Root cause:** a genuine naming mismatch between v1.12.0's fixed
router inventory and this project's own exercises. v1.12.0's
`DEVICE_MODELS.router` used 2-segment interface names
(`GigabitEthernet0/0`), matching the Cisco 1941 seen in the 10.1 and
17.5/ISPRouter real captures. But three of our five router exercises
— 10.2, 12.6, and 17.5 — actually configure 3-segment ISR4000-style
names (`GigabitEthernet0/0/0`), which don't match the 1941's naming
at all. This reflects a real inconsistency in the underlying
ground-truth reference material itself: different labs were
apparently captured against different real Cisco router models.
Confirmed 10.1 (the source of the 2-segment naming) never actually
references a physical interface name in any of its steps, so it was
unaffected either way.

**Fixed:** `DEVICE_MODELS.router` now uses 3-segment ISR4000-style
names (`GigabitEthernet0/0/0`, `GigabitEthernet0/0/1`, `Serial0/0/0`,
`Serial0/0/1`, `Vlan1`), matching the majority of what this project's
own exercises actually configure. Verified: configuring
`GigabitEthernet 0/0/0` and `0/0/1` now results in exactly 5 total
interfaces (not 7), matching real hardware.

**Full regression:** all 10 exercises pass cleanly, including 17.5's
full verification sequence (`show ip interface brief` now correctly
shows exactly 5 rows: the two configured GigabitEthernet interfaces
plus the three untouched ones, no duplicates).

**Test commands for this version:**
1. Reset device, `enable`, `configure terminal`, `interface
   GigabitEthernet 0/0/0`, `ip address 192.168.10.1 255.255.255.0`,
   `no shutdown`, `end`, `show ip interface brief` — confirm exactly
   5 rows total, not 7.
2. Same session, `show interfaces GigabitEthernet 0/0/1` (never
   configured) — confirm it shows as a real, untouched,
   administratively-down interface, not a separate/duplicate entry.
3. Full run of **10.2 — Configure Router Interfaces** — confirms the
   fix doesn't break the exercise that originally exposed this gap.
4. Full run of **17.5 — Verify Directly Connected Networks** —
   confirms `show ip route` and `show running-config` both correctly
   reflect exactly 5 interfaces, 2 configured + 3 untouched.
5. Full run of **10.1 — Configure Initial Router Settings** —
   confirms this exercise (the source of the old 2-segment naming) is
   completely unaffected by the change, since it never touches a
   physical interface name.

---

## v1.13.0 — Course 2 begins: 1.1 Configure SSH on a Switch

**Date:** 2026-08-08

**Files:**
- `terminal-v1.13.0.html` — this is the file to open.
- `ios-engine-v1.13.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-13-0.zip`.

**This is the first Course 2 (SRWE) Syntax Checker.** Confirmed via
the ground-truth reference file that Course 2 has 14 real Syntax
Checkers (roughly double Course 1's 8) — genuinely new territory
ahead: VLANs, trunking, router-on-a-stick, DHCP, port security, and
static routing. 1.1 was chosen as the natural starting point since it
overlaps heavily with Course 1's 16.4, letting the new `c2_syn_`
naming convention get exercised on mostly-reused command
infrastructure before tackling genuinely new material.

**Confirmed: nearly everything needed already existed** from Course
1's 16.4 (Configure Secure Passwords and SSH) — `ip domain-name`,
`username ... secret ...`, `crypto key generate rsa modulus`, `ip ssh
version`, `line vty 0 15` (the switch-width VTY form, already
distinct from the router's `line vty 0 4`), `login local`, `transport
input ssh`. This exercise is essentially the switch-flavored
counterpart to 16.4's router version — same core commands, no
`security passwords min-length` or banner step, verified with `show
ip ssh` instead of saving to NVRAM.

**Added — one new command: `show ip ssh`.** Reports SSH status,
version, and authentication settings. Correctly reflects whether RSA
keys have actually been generated (`crypto key generate rsa`) —
before keys exist, real IOS reports "SSH Disabled" and a message
about needing keys first (matching the fact that SSH literally
doesn't function without them); after keys exist, reports "SSH
Enabled - version X.X" with the configured `ip ssh version` (or
1.99, matching real IOS's minimum/default). Timeout, retry count, and
DH key size are shown as real IOS defaults, not yet individually
tracked state — noted for a future exercise if one ever asks a
student to configure these individually.

**Added — Module 1.1 exercise:** "Course 2 · SyntxChk · 1.1 —
Configure SSH on a Switch", 10 steps, sourced exactly from the
ground-truth reference. Verified end-to-end: all 10 steps pass,
exercise completes, `show ip ssh` correctly shows both the
pre-keys-generated "Disabled" state and the post-generation "Enabled
- version 2.0" state matching the reference's expected output.

**Full regression:** all 11 exercises (8 from Course 1 + this one)
pass cleanly.

**Test commands for this version:**
1. Free Practice: `enable`, `show ip ssh` on a completely fresh
   device — confirm it reports "SSH Disabled" with the
   need-RSA-keys message, not an error.
2. Guided Practice → **Course 2 · SyntxChk · 1.1 — Configure SSH on a
   Switch** → complete all 10 steps.
3. After completing, `show ip ssh` again — confirm it now reports
   "SSH Enabled - version 2.0".
4. Compare against Course 1's 16.4 side-by-side — confirm `line vty 0
   15` here vs. `line vty 0 4` there are correctly treated as
   distinct, valid commands (switch vs. router VTY line count).
5. Full run of **Course 1 · SyntxChk · 16.4** — confirms adding the
   new Course 2 exercise didn't regress the router-flavored original.

---

## v1.14.0 — Course 2: 1.2 Configure Router Interfaces

**Date:** 2026-08-08

**Files:**
- `terminal-v1.14.0.html` — this is the file to open.
- `ios-engine-v1.14.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-14-0.zip`.

**Confirmed before building: zero new engine work needed.** This
exercise is structurally identical to Course 1's 10.2 — same
commands (`interface <Type> <slot/port>`, `ip address`,
`description`, `no shutdown`, `end`, `show ip interface brief`), same
3-segment GigabitEthernet naming, same two-interface pattern. Only
the specific IP addresses (10.0.0.1/10.0.1.1) and descriptions (Link
to S1/S2) differ — pure exercise data, no new capability required.
This is the simplest addition so far.

**Added — Module 1.2 exercise:** "Course 2 · SyntxChk · 1.2 —
Configure Router Interfaces", 11 steps, sourced exactly from the
ground-truth reference. Verified end-to-end: all 11 steps pass,
exercise completes, `show ip interface brief` output matches the
reference's expected two configured rows exactly (and correctly also
shows the 3 untouched interfaces, which the reference tool itself
doesn't model but our device-inventory system, added in v1.12.0,
does).

**Full regression:** all 12 exercises pass cleanly.

**Test commands for this version:**
1. Guided Practice → **Course 2 · SyntxChk · 1.2 — Configure Router
   Interfaces** → complete all 11 steps.
2. After completing, `show ip interface brief` — confirm
   GigabitEthernet0/0/0 shows 10.0.0.1 and GigabitEthernet0/0/1 shows
   10.0.1.1, both up/up.
3. `show running-config` — confirm both interface descriptions (Link
   to S1, Link to S2) appear correctly.
4. Compare against **Course 1 · SyntxChk · 10.2** side-by-side —
   confirm both exercises work independently despite using the same
   underlying commands with different values.
5. Full run of **Course 2 · SyntxChk · 1.1** — confirms adding 1.2
   didn't regress the exercise built just before it.

---

## v1.15.0 — Shortened hint escalation: 2 attempts + hint, answer on 3rd

**Date:** 2026-08-09

**Files:**
- `terminal-v1.15.0.html` — this is the file to open.
- `ios-engine-v1.15.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-15-0.zip`.

**Changed, per direction after real practice sessions revealed the
original ladder felt too slow:** Guided Practice's wrong-answer
escalation shortened from "3 bare attempts, hint on 4th, answer on
5th+" (established back in v1.1.0) to "1 bare attempt, hint on 2nd,
answer on 3rd+". Still never auto-advances — the exact answer is
shown starting on the 3rd wrong attempt, but the student must still
type it themselves to move on, same as before. `attemptCount` still
resets to 0 on every successful step, same as before. Verified: a
wrong-answer sequence now shows bare → hint → answer → answer... in
exactly 3 steps instead of 5. Full regression across all 12 exercises
passes cleanly with the new ladder.

**Confirmed with the person: this session's test transcripts covered
v1.13.0 and v1.14.0** (SSH on a switch, router interfaces) — both
completed successfully, no issues found; logged here since testing
was explicitly mentioned but no bugs were reported from it.

**Research completed for the next build (not yet built — will ship
with whichever version implements it): Course 2 · 1.3 — Secure
Remote Access on a Switch.** Pulled exact ground-truth step data.
Findings:
- Reuses almost everything already built: `configure terminal`,
  `security passwords min-length`, `enable secret`, `ip domain-name`,
  `crypto key generate rsa modulus`, `ip ssh version`, `line vty 0
  15`, `login local`, `transport input ssh`, `end`, `exec-timeout`
  (already exists on line_config since Course 1's 10.1).
- **Three genuinely new commands needed:**
  1. `login block-for <seconds> attempts <n> within <seconds>`
     (global_config) — brute-force login protection, new 4-argument
     token pattern. Per the "configure and store only" scope decision
     (confirmed back before building 16.4), this would be stored, not
     behaviorally enforced.
  2. `username <name> privilege <n> secret <password>` — a NEW
     VARIANT of the existing `username_secret` command, not just new
     data. Real IOS's `username` command genuinely supports an
     optional `privilege <n>` clause; the existing command should be
     extended to accept it optionally, rather than adding a second
     separate command, and `device.users` entries will need a new
     `privilege` field.
  3. `ip ssh time-out <seconds>` and `ip ssh authentication-retries
     <n>` — same shape as the existing `ip ssh version`. Notably,
     these feed directly into `show ip ssh`'s output, which currently
     hardcodes "Authentication timeout: 120 secs; Authentication
     retries: 3" as fixed defaults (flagged as a known simplification
     back in v1.13.0's changelog entry for `show ip ssh`) — this is
     exactly the "future exercise" case anticipated there. When 1.3 is
     built, `renderShowIpSsh()` should be updated to use real tracked
     state for these two values instead of hardcoded numbers.

**Test commands for this version:**
1. In any Guided exercise, deliberately type a wrong command once —
   confirm you see the bare "Not quite — try again." message.
2. Type wrong again (2nd attempt on the same step) — confirm you now
   see a concept-level hint, not just "try again."
3. Type wrong a 3rd time — confirm the exact expected command is now
   shown, but the input box is empty (you must still type it in
   yourself).
4. Type the shown answer correctly — confirm it's accepted and the
   exercise advances normally.
5. On the very next step, deliberately type wrong once — confirm the
   ladder reset back to a bare "Not quite" message (not continuing
   from where the previous step left off).

---

## v1.16.0 — Course 2: 1.3 Secure Remote Access on a Switch

**Date:** 2026-08-09

**Files:**
- `terminal-v1.16.0.html` — this is the file to open.
- `ios-engine-v1.16.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-16-0.zip`.

**Reference material confirmed/corrected this session:** the person's
two links both resolved to the same Course 1 (ITN) index page already
on record. Searched and confirmed the correct Course 2 (SRWE) and
Course 3 (ENSA) index pages instead:
- Course 2: https://itexamanswers.net/ccna-2-v7-exam-answers-switching-routing-and-wireless-essentials-v7-0-srwe.html
- Course 3: https://itexamanswers.net/ccna-3-v7-exam-answers-enterprise-networking-security-and-automation-v7-0-ensa.html

Both confirmed as real, complete Packet Tracer + Lab indexes (same
structure/publisher as the Course 1 one already used), for future
Packet Tracer ground-truth work.

**Full game plan researched for all 26 remaining checkers** (12 more
in Course 2, 14 in Course 3) — pulled exact ground-truth step data for
every one and organized by new-capability category:
- Near-zero new work: 14.3 (Basic Router Config Review, 100% reused
  commands), 10.1 CDP/LLDP (C3, trivial flag commands).
- New mode + moderate commands: VLANs (new vlan_config mode), trunk
  links, port security.
- New subsystems: subinterfaces/router-on-a-stick (dot-notation
  interface naming), DHCPv4/DHCPv6 (new pool modes), OSPF (4
  checkers — router_config mode, real neighbor/DR-BDR simulation),
  ACLs (new rule-list data structure), NAT (inside/outside marking,
  pools).
- Cross-cutting: `show ip route` needs real upgrading to support
  static (S) and OSPF (O) routes plus "Gateway of last resort" —
  currently only shows connected/local — flagged to tackle once,
  deliberately, rather than patch per-module.
- Confirmed sequencing: reuse-leverage order — 1.3 → 14.3/CDP-LLDP →
  VLANs/Trunking/Port Security → Static Routes (forces the show ip
  route upgrade) → Router-on-a-Stick → DHCP → OSPF cluster → ACLs →
  NAT → NTP/SNMP/Syslog.

**Built this version — Module 1.3, per the confirmed plan's first
step.** Three new pieces of capability, as scoped in the prior
session:
- `login block-for <seconds> attempts <n> within <seconds>`
  (global_config) — brute-force login protection, new 4-argument
  token pattern. Configure-and-store only, no behavioral lockout
  simulation, consistent with the project's established scope
  decision.
- `username <name> privilege <n> secret <password>` — added as a
  genuinely separate command entry (not a variant of the existing
  2-argument form, since the fixed-token matcher can't express
  optional clauses), both routing through the same underlying
  `setUser()`, now updated to accept an optional privilege level.
  `device.users` entries gained a `privilege` field.
- `ip ssh time-out <seconds>` and `ip ssh authentication-retries <n>`
  — new commands, AND `renderShowIpSsh()` updated to use this real
  tracked state instead of the hardcoded "120 secs / 3 retries"
  defaults noted as a known simplification back in v1.13.0. Verified:
  configuring `ip ssh time-out 90` + `ip ssh authentication-retries 2`
  now correctly shows those exact values in `show ip ssh`; leaving
  them unconfigured still correctly falls back to real IOS's actual
  defaults (120/3), confirmed against 1.1's still-passing expected
  output.

**Added — Module 1.3 exercise:** "Course 2 · SyntxChk · 1.3 — Secure
Remote Access (Switch)", 15 steps, sourced exactly from the
ground-truth reference. Verified end-to-end: all 15 steps pass,
exercise completes, `show running-config` correctly shows every new
setting (login block-for, privileged username, both new ip ssh
settings) in sensible positions, and `show ip ssh` correctly reflects
the real configured timeout/retries.

**Full regression:** all 13 exercises pass cleanly.

**Test commands for this version:**
1. Guided Practice → **Course 2 · SyntxChk · 1.3 — Secure Remote
   Access (Switch)** → complete all 15 steps.
2. After completing, `show ip ssh` — confirm it shows "Authentication
   timeout: 90 secs; Authentication retries: 2" (the configured
   values), not the old hardcoded 120/3.
3. `show running-config` — confirm `login block-for 120 attempts 3
   within 60` and `username netadmin privilege 15 secret Cisco_CCNA7`
   both appear correctly.
4. Re-run **Course 2 · 1.1 — Configure SSH on a Switch** (which never
   configures timeout/retries) — confirm `show ip ssh` still correctly
   shows the real IOS defaults (120 secs / 3 retries), not broken by
   this version's changes.
5. Free Practice: `username guest secret simplepass` (no privilege)
   followed by `username admin privilege 15 secret adminpass` —
   confirm `show running-config` shows the first WITHOUT a privilege
   clause and the second WITH one, proving both command forms coexist
   correctly.

---

## v1.17.0 — Course 2: 3.2 VLANs and 3.3 Trunk Links (real Packet Tracer captures verified)

**Date:** 2026-08-09

**Files:**
- `terminal-v1.17.0.html` — this is the file to open.
- `ios-engine-v1.17.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-17-0.zip`.

**Ground truth obtained:** the person captured real `show vlan brief`
output from Packet Tracer with exact spacing preserved (using Packet
Tracer's built-in copy button, confirmed not to mangle whitespace),
including a manual dash-count to pin down exact column widths, plus a
full real session creating VLANs 10/20/30/99/150 with names including
special characters (`Faculty/Staff`, `Guest(Default)`,
`Management&Native`). This is now the most precisely-verified `show`
command output in the project.

**Added — VLAN subsystem, genuinely new mode:**
- New `vlan_config` mode (prompt `(config-vlan)#`), entered via
  `vlan <id>` from `global_config` (creates the VLAN if it doesn't
  exist) — VLAN 1 and the four legacy default VLANs (1002-1005) exist
  on every device from creation, matching a real capture showing
  these on a completely fresh switch.
- `name <name>` (vlan_config) — real IOS allows special characters
  like `/`, `(`, `)`, `&` in VLAN names since they contain no
  whitespace (confirmed our existing whitespace-only tokenizer already
  handles this correctly, no changes needed there).
- `switchport mode access` / `switchport access vlan <id>` /
  `switchport mode trunk` / `switchport trunk native vlan <id>` /
  `switchport trunk allowed vlan <list>` (interface_config).
- `show vlan brief` — column widths (VLAN=4, Name=32, Status=9,
  Ports=31) verified EXACTLY via the person's manual dash-count of a
  real capture; port list wraps at 4 ports per line under the Ports
  column; empty-ports rows correctly keep real IOS's un-trimmed
  trailing whitespace rather than being cleaned up.
- `show interfaces <name> trunk` — three-section report (mode/
  encapsulation/native VLAN, allowed VLANs, VLANs in STP forwarding
  state), verified against the ground-truth reference's exact expected
  output.
- Real IOS behaviors reproduced, all verified against real captures:
  `%LINK-5-CHANGED` fires automatically the moment a NEW VLAN is
  created via `vlan <id>` (not from a later `no shutdown`);
  `%LINEPROTO-5-UPDOWN` fires on the matching SVI the first time a
  port is assigned to that VLAN via `switchport access vlan`;
  `switchport mode trunk` flaps the line protocol down then up;
  assigning a port to a VLAN that doesn't exist yet auto-creates it
  (confirmed via Cisco's own VLAN Configuration Guide); a duplicate
  VLAN name produces a warning matching the real wording exactly
  ("VLAN #20 and #30 have an identical name: ...").

**Fixed — three real bugs found while building and testing against
the captures, all in code, not exercise data:**
1. **`interface vlan <id>` previously succeeded even for VLANs that
   were never created.** Confirmed via multiple independent real
   Cisco sources that real IOS genuinely requires the VLAN to exist
   first (`vlan <id>`) before its SVI is reachable via `interface
   vlan <id>` — this is real, reproducible hardware behavior, not a
   simulator quirk. Fixed with a proper existence check; `interface
   vlan 1` still correctly works since VLAN 1 always exists by
   default.
2. **That fix initially didn't work** — traced to a second, deeper
   bug: the interface-space-normalization regex (added in v1.9.0 for
   `interface GigabitEthernet 0/0/0`) was ALSO matching `interface
   vlan 10`, silently mangling it into a shape that bypassed the new
   VLAN-existence check entirely by falling through to the generic
   free-form `interface <name>` command. Fixed by excluding `vlan` as
   a matched type name via a negative lookahead.
3. **`show interfaces FastEthernet 0/1 trunk` failed entirely** —
   traced to the same class of regex bug: the `show interfaces`
   space-normalization was anchored to match only when nothing
   followed the slot number, so the trailing `trunk` keyword broke
   the match. Fixed to allow an optional trailing word.
4. **`vlan 20` immediately followed by `vlan 30`** (no `exit` between
   them, matching the real capture's actual sequence) was rejected —
   `vlan <id>` only accepted `global_config` as a starting mode.
   Fixed by also accepting `vlan_config`, same jump-between-siblings
   pattern already correct for `interface`/`line console` since
   earlier versions.

**Added — Module 3.2 and 3.3 exercises:** "Course 2 · SyntxChk · 3.2
— Configure VLANs on a Switch" (16 steps) and "Course 2 · SyntxChk ·
3.3 — Configure 802.1Q Trunk Links" (7 steps, with a precondition
noting it assumes 3.2's VLANs already exist), both sourced exactly
from the ground-truth reference. Verified end-to-end: all steps pass,
both exercises complete, `show vlan brief` and `show interfaces ...
trunk` outputs match the reference's expected data exactly (our
column widths are the real, hardware-verified ones, which differ
slightly from the reference tool's own approximated dash-line width —
judged the real capture as authoritative).

**Full regression:** all 15 exercises pass cleanly.

**Test commands for this version:**
1. Guided Practice → **Course 2 · SyntxChk · 3.2 — Configure VLANs on
   a Switch** → complete all 16 steps.
2. After completing, `show vlan brief` — confirm VLAN 1002-1005
   appear even though never configured, and Fa0/6 / Fa0/11 show up
   correctly under VLANs 10 and 20.
3. Free Practice: `configure terminal`, `interface vlan 20` WITHOUT
   creating VLAN 20 first — confirm it's rejected with `% Invalid
   input detected`; then `vlan 20`, `exit`, `interface vlan 20` —
   confirm it now works.
4. `vlan 10` then immediately `vlan 20` (no `exit` between) — confirm
   this works, matching the real capture's actual sequence.
5. Complete **Course 2 · SyntxChk · 3.3 — Configure 802.1Q Trunk
   Links** (after creating VLANs 10/20/30/99 per its precondition) —
   confirm `show interfaces FastEthernet 0/1 trunk` shows the correct
   three-section report.

---

## v1.17.1 — Bug fix: 3.3 Trunk Links no longer depends on 3.2's leftover state

**Date:** 2026-08-09

**Files:**
- `terminal-v1.17.1.html` — this is the file to open.
- `ios-engine-v1.17.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-17-1.zip`.
- **Naming change starting this version:** the changelog file shipped
  in each zip is now named `CHANGELOG-v<version>.md` (this one:
  `CHANGELOG-v1.17.1.md`), so each zip's snapshot is self-labeled with
  the version it documents, confirmed as the preferred approach
  (Option A — one running master changelog, version-stamped on
  export) over splitting into fully separate per-version files.

**Bug reported:** 3.3 — Configure 802.1Q Trunk Links assumed VLANs
10/20/30/99 already existed (created in 3.2), shown only as a
step-1 precondition note. If the device was reset mid-3.3, or a
student started 3.3 directly, the note disappeared once they moved
past step 1 — leaving no way to recall the exact VLAN numbers/names
without leaving the exercise. Same underlying shape of problem
already solved once before for 2.8 (which depended on 2.7's
addressing) — a cross-exercise dependency expressed only as a
one-time note is fragile.

**Fixed — 3.3 restructured to be fully self-contained**, same pattern
used for 2.8: now creates VLANs 10 (Faculty), 20 (Students), 30
(Guest), and 99 (Management) itself as its own first steps — VLAN 99
is new to this exercise specifically (3.2 never named it, since it's
specific to trunk configuration). No more dependency on 3.2 having
been run first, and no more precondition note needed at all beyond
the standard "type enable first" one.

**Added, per follow-up direction:** a `show vlan brief` verification
step immediately after creating the four VLANs, with an instruction
line noting "these are the same VLANs 3.2 created, if you did that
exercise first" — this keeps the conceptual link between the two
exercises visible and intentional (not just a silent duplication),
while also reinforcing a good verify-before-you-configure habit.
Exercise grew from 7 steps to 18. Verified the repeated `configure
terminal` step (once before creating VLANs, again before configuring
the trunk) works correctly, since exercise steps are checked by
position, not by text uniqueness.

**Full regression:** all 15 exercises pass cleanly, including the
now-fully-self-contained 3.3 tested from a genuinely fresh device with
zero prior VLAN state (the exact scenario that surfaced this bug).

**Test commands for this version:**
1. Reset device, go straight to Guided Practice → **Course 2 ·
   SyntxChk · 3.3 — Configure 802.1Q Trunk Links** (skip 3.2 entirely)
   — confirm the exercise now creates its own VLANs as steps, not a
   precondition note.
2. Continue through to the `show vlan brief` step — confirm VLANs 10,
   20, 30, and 99 all appear, along with the note connecting this back
   to 3.2.
3. Complete the rest of the exercise (trunk configuration) — confirm
   it still finishes successfully and `show interfaces FastEthernet
   0/1 trunk` shows the correct report.
4. Do **3.2** first, then immediately do **3.3** in the same session
   (device state carries over) — confirm no errors or duplicate-VLAN
   warnings occur even though the VLANs already exist from 3.2 (VLAN
   99 is new either way, so no conflict there; 10/20/30 already exist
   with matching names, so `vlan 10`/`name Faculty` etc. should just
   re-enter/re-confirm them without complaint).
5. Confirm the shipped zip's changelog file is named
   `CHANGELOG-v1.17.1.md`, not the old generic `CHANGELOG.md`.

---

## v1.18.0 — Course 2: 11.1 Configure Port Security (real Packet Tracer captures verified)

**Date:** 2026-08-09

**Files:**
- `terminal-v1.18.0.html` — this is the file to open.
- `ios-engine-v1.18.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-18-0.zip` with `CHANGELOG-v1.18.0.md`.

**Ground truth obtained:** the person captured real Packet Tracer
output for `show port-security` (summary table, all secured ports),
`show port-security address` (secure MAC address table), `show
port-security interface fastEthernet 0/1` (the specific command this
exercise needs), and `show running-config | begin interface` showing
the real config structure with sticky MAC addresses persisted as
individual config lines.

**Added — port security state and commands:**
- New interface fields: `portSecurityEnabled`, `portSecurityMax`
  (default 1, matching real IOS), `portSecurityViolation` (default
  "shutdown", matching real IOS), `portSecurityStickyEnabled`,
  `portSecurityStickyMacs` (array).
- `switchport port-security` (bare, enable with defaults).
- `switchport port-security maximum <n>`.
- `switchport port-security violation <protect|restrict|shutdown>`.
- `switchport port-security mac-address sticky` (bare — enables
  dynamic sticky learning).
- `switchport port-security mac-address sticky <mac>` — a second,
  distinct command discovered via the real `show running-config`
  capture: real IOS persists each specific learned (or manually
  specified) sticky MAC as its OWN config line, separate from the
  bare enable-sticky-learning command. Since this engine doesn't
  simulate real traffic/MAC learning, this command lets a session
  explicitly specify a sticky MAC to reflect that same real-world
  running-config shape without pretending to detect real frames.
- `show port-security interface <name>` — vertical key:value report.
  Column alignment (label padded to 28 characters before the colon)
  was NOT directly measured from a spacing-preserved capture — same
  issue hit once before with `show vlan brief` — but reconstructed
  from a defensible, standard IOS convention (pad to the longest
  label + gap) using the real capture's own labels. Flagged as
  inferred, not directly verified; worth re-checking against a
  spacing-preserved capture if one becomes available.

**Fixed — `show running-config` was missing switchport settings
entirely.** VLAN/trunk `switchport` lines (added in v1.17.0) were
never actually rendered in `show running-config` — a real gap only
caught now, confirmed by the real capture explicitly showing
`switchport mode access` as its own config line. Fixed for access
mode, trunk mode, and all port-security settings together in this
version, in the order confirmed by the real capture (mode → security
enable → sticky flag → violation mode → explicit sticky MAC lines).

**Fixed — third occurrence of the same bug class:** `show
port-security interface FastEthernet 0/1` (with a space) failed with
"% Invalid input detected" — the interface-space-normalization regex
had already been patched twice before (v1.9.1 for `interface <Type>
<slot>`, v1.17.0 for `show interfaces <Type> <slot> [trunk]`) but
never covered this third word order (`show port-security interface
<Type> <slot>`). Fixed with a third dedicated case. **Flagged as a
recurring pattern** — worth a more systemic fix before a fourth
`show ... interface <Type> <slot>`-shaped command is added, rather
than continuing to patch one case at a time.

**Investigated, NOT fixed this version — flagged as a real, deferred
gap:** cross-referencing the real captures against this project's own
ground-truth reference data revealed that real Cisco SWITCH access
ports default to administratively UP, unlike router physical
interfaces (which correctly default to shutdown in this engine
already). Confirmed via two independent pieces of evidence: 11.1's
own real script never runs `no shutdown` yet expects `Secure-up`, and
3.2's own real script never runs `no shutdown` on FastEthernet 0/6
yet `show vlan brief` shows it working. This engine currently
defaults EVERY interface to `shutdown: true` regardless of device
type — a real accuracy gap, but changing it now was judged too risky
to fold into an otherwise-focused 11.1 build (could affect every
existing switch exercise's behavior). Needs its own careful, fully
regression-tested pass.

**Added — Module 11.1 exercise:** "Course 2 · SyntxChk · 11.1 —
Configure Port Security", 9 steps, sourced exactly from the
ground-truth reference. Verified end-to-end: all 9 steps pass,
exercise completes, `show port-security interface` and `show
running-config` both reflect real captured behavior (Total MAC
Addresses, Last Source Address:Vlan, etc. update correctly once a
sticky MAC and `no shutdown` are applied).

**Full regression:** all 16 exercises pass cleanly.

**Naming, continuing from v1.17.1:** shipped changelog is
`CHANGELOG-v1.18.0.md`.

**Test commands for this version — recommend MORE than the usual 5,
given this touched shared parsing logic (the interface-space regex)
for a third time and fixed a real show-running-config gap:**
1. Guided Practice → **Course 2 · SyntxChk · 11.1 — Configure Port
   Security** → complete all 9 steps.
2. Free Practice: `show port-security interface FastEthernet 0/1`
   (with the space) on a device where that interface has port
   security configured — confirm it works (this was the specific bug
   found and fixed this version).
3. After completing 11.1, `show running-config` — confirm
   `switchport mode access`, `switchport port-security`, `switchport
   port-security mac-address sticky`, `switchport port-security
   maximum 2`, and `switchport port-security violation restrict` all
   appear as separate lines under the interface block.
4. `switchport port-security mac-address sticky 00E0.B027.2245` (an
   explicit MAC) — confirm it appears as its OWN line in `show
   running-config`, separate from the bare sticky-enable line, and
   that `show port-security interface` reflects it in "Total MAC
   Addresses" and "Last Source Address:Vlan".
5. Try an invalid violation mode (`switchport port-security violation
   blah`) — confirm it's rejected with an error, not silently
   accepted.
6. Try an invalid MAC address format (`switchport port-security
   mac-address sticky notamac`) — confirm it's rejected.
7. Re-run **3.2 — Configure VLANs on a Switch** and confirm
   `show running-config` now ALSO shows `switchport mode access` /
   `switchport access vlan <id>` lines for those ports (this was a
   pre-existing gap fixed as part of this version's work, not
   specific to port security).

---

## v1.18.1 — Bug fix: `show port-security interface` column width corrected (exact)

**Date:** 2026-08-09

**Files:**
- `terminal-v1.18.1.html` — this is the file to open.
- `ios-engine-v1.18.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-18-1.zip` with `CHANGELOG-v1.18.1.md`.

**Ground truth obtained:** the person confirmed the real terminal
uses Courier (monospace font), meaning raw character positions in a
correctly-preserved paste ARE the real column positions — no
reconstruction needed if the paste itself is exact. After two earlier
attempts collapsed whitespace in transit, a third paste preserved it
correctly, giving an exact measurement.

**Fixed:** `show port-security interface`'s label column width was
28 characters in v1.18.0 (inferred from the longest label + a
standard 2-space gap, since exact spacing wasn't available at the
time). The real capture confirms it's actually **27 characters** —
close, but not exact. Verified the fix produces an EXACT
character-for-character match against the real capture, including
correctly handling "Last Source Address:Vlan" (a label that contains
its own embedded colon, requiring the real field-delimiter colon to
be found specifically, not just the first one in the string).

**Logged for later, not built this version:** the same capture also
included exact, spacing-preserved real output for `show
port-security` (summary table across all secured ports) and `show
port-security address` (secure MAC address table) — neither is
required by 11.1's actual Syntax Checker script, so per the earlier
scope discussion these remain backlog candidates rather than being
built now. Both use right-aligned numeric columns, a different and
more involved format than anything built so far — worth its own
careful pass if/when they're added as bonus commands.

**Full regression:** confirmed clean on the affected exercise (11.1)
plus two others.

**Test commands for this version:**
1. Complete **Course 2 · SyntxChk · 11.1 — Configure Port Security**
   (including `switchport port-security violation restrict` and a
   sticky MAC), then run `show port-security interface FastEthernet
   0/1` — confirm every colon lines up at the same column across all
   12 lines.
2. Specifically check the "Last Source Address:Vlan" line — confirm
   its OWN embedded colon doesn't throw off the alignment of the
   field-delimiter colon that follows it.
3. Compare visually against the real Packet Tracer capture if you
   still have it open — the two should now match exactly, character
   for character.

---

## v1.19.0 — Path-aware reserved words: honest Tab completion at any depth, not just word 1

**Date:** 2026-08-09

**Files:**
- `terminal-v1.19.0.html` — this is the file to open.
- `ios-engine-v1.19.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-19-0.zip` with `CHANGELOG-v1.19.0.md`.

**Question raised, worth investigating properly rather than a quick
patch:** the person asked whether `switchport port-security
mac-address sticky` completing as "unique" via Tab was because real
IOS genuinely has no other option there, or because our reserved-words
system just hadn't been checked that deep. Confirmed via Cisco's own
`switchport port-security ?` output: real siblings exist
(`aging`) that we hadn't implemented — meaning Tab completion was
giving false confidence, not reflecting real IOS ambiguity.

**Root cause, structural:** `RESERVED_WORDS` was a flat `{ mode:
[word, word, ...] }` list, and `findCandidatesAt()` only ever
consulted it at token position 0. This made sense when it only needed
to distinguish top-level commands like `configure` from `copy` from
`clock`, but breaks down for any multi-word command family where
we've built the first word or two but not every sibling deeper in —
exactly the `switchport port-security <?>` situation.

**Fixed — `RESERVED_WORDS` is now path-aware, not just mode-aware:**
restructured to `{ mode: { "<space-joined prior tokens>": [words] } }`
— position 0 is simply the special case where the path is the empty
string `""`, so all EXISTING position-0 behavior is preserved exactly
(verified: `c` in priv_exec still correctly shows
configure/copy/clock/clear/connect as ambiguous). `findCandidatesAt()`
now builds the path from whatever tokens are already typed and looks
up reserved words at that exact path, at any depth. This is a genuine
mechanism, not a one-off fix — the same technique now applies to any
future partially-implemented command family without needing new code,
just a new path entry.

**Audited (per direction to also check "other words and the position
we're already exposed to") — one more real gap found and fixed:**
`ip ssh` at global_config. Cross-referenced Cisco's own `ip ssh ?`
output via multiple independent documentation/community sources:
real siblings `port`, `rsa` (keypair-name), `source-interface`, and
`maxstartups` exist beyond the `version`/`time-out`/
`authentication-retries` we've actually built. Added as a second path
entry (`"ip ssh": [...]`), verified `ip ssh ` + Tab now correctly
shows all 7 real options as ambiguous, while fully-typed prefixes
(`ip ssh v`, `ip ssh p`) still correctly resolve uniquely.

**Verified:** the fix applies at BOTH Tab-completion time and
Enter-time abbreviation resolution, since both share the same
`findCandidatesAt()` core — confirmed `switchport port-security m 5`
(abbreviated, typed and submitted directly) is now correctly rejected
as ambiguous rather than silently guessing which command was meant.

**Full regression:** all 16 exercises pass cleanly.

**Test commands for this version:**
1. In `interface_config` mode, type `switchport port-security ` (with
   a trailing space) and press Tab — confirm it now shows 4 ambiguous
   candidates (maximum, violation, mac-address, aging), not silently
   completing.
2. Continue narrowing: `switchport port-security m` + Tab (ambiguous:
   maximum, mac-address), then `switchport port-security mac` + Tab
   (unique: mac-address) — confirm narrowing works correctly at each
   step.
3. `switchport port-security a` + Tab — confirm it completes to
   `switchport port-security aging` (the newly-added reserved word),
   even though `aging` itself isn't implemented as a real command
   (typing it in full should still correctly fail with a normal
   "not implemented" style error, matching how every other reserved
   word behaves).
4. In `global_config` mode, `ip ssh ` (trailing space) + Tab — confirm
   7 candidates show as ambiguous, including `port`/`rsa`/
   `source-interface`/`maxstartups` (newly added).
5. Confirm position-0 reserved words are completely unaffected: `c`
   in priv_exec should still show the same 5 candidates
   (configure/copy/clock/clear/connect) as before this version.
6. Full run of **16.4** and **1.3** (both configure `ip ssh ...`
   commands) — confirms the new `ip ssh` reserved words don't
   interfere with commands that ARE implemented.

---

## v1.19.1 — Bug fix: `?commands` broken inside Guided Practice; `?commands` redesigned for scale; 16-bit binary grouping

**Date:** 2026-08-10

**Files:**
- `terminal-v1.19.1.html` — this is the file to open.
- `ios-engine-v1.19.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-19-1.zip` with `CHANGELOG-v1.19.1.md`.

**Bug reported: `?commands` gives an error.** Root cause: `?commands`
was never special-cased ahead of Guided Practice's step-checking
logic in the UI layer — typing it while inside a Guided exercise sent
it straight into `checkExerciseStep()` like any other typed command,
so it was silently graded as a WRONG ANSWER against whatever the
current step expected, instead of ever reaching the real `?commands`
handler. Fixed by checking for `?commands` (and the new `?commands
all`, see below) before the guided/free branch, so it now works
identically in any mode, at any point in any exercise, matching how a
meta/help command should behave.

**Fixed — stale header text.** The banner above the terminal still
read "Full-form commands only," left over from before Tab completion
existed (added back in v1.2.0). Updated to reflect current behavior.

**Redesigned — `?commands` at ~90 commands had become genuinely hard
to use.** Previously a single flat list of every command with a `*`
marker for ones unusable in the current mode — meaning most of the
screen, in any given mode, was commands you couldn't currently run.
Default behavior is now to show ONLY commands usable in the current
mode (verified: `user_exec` now shows 6 relevant commands instead of
scrolling through 63). `?commands all` still shows the full
unfiltered list with the original `*` marker, for anyone who wants
the complete picture.

**Changed, per direction — Number Systems 16-bit binary display now
grouped every 4 characters**, matching the existing 8-bit octet
convention (`1010 0100 1100 0011` instead of an unbroken 16-character
string). This was a deliberate choice left unresolved back in
v1.7.0/v1.6.0 ("conventions vary too much to pick one authoritatively")
— now resolved per direct request, since an unbroken 16-character
binary string was hard to read at a glance. `normalizeBinaryInput()`
updated to accept the new fully-grouped form as valid typed input
(in addition to the pre-existing single-space-at-position-4 form,
still accepted for anyone typing out of octet habit), and the
on-screen hint text updated to match.

**Full regression:** all 16 exercises pass cleanly.

**Test commands for this version:**
1. Start any Guided Practice exercise, get to any step, type
   `?commands` — confirm it now shows the help list instead of "Not
   quite — try again."
2. From `priv_exec`, type `?commands` — confirm it shows a short,
   mode-filtered list (not all ~90 commands).
3. Type `?commands all` — confirm it shows the full list with `*`
   markers, same as the old default behavior.
4. In Number Systems → Drill, select a Hex↔Binary category with
   16-bit scope — confirm the binary value now displays as 4 groups
   of 4 characters, not one unbroken string.
5. In that same drill, type the answer back using the new grouped
   format (e.g. `1010 0100 1100 0011`) — confirm it's accepted;
   also try the old no-space form — confirm that still works too.

---

## v1.20.0 — New "Subnetting" mode: CIDR/mask, magic number, classful addressing, private/public

**Date:** 2026-08-10

**Files:**
- `terminal-v1.20.0.html` — this is the file to open.
- `ios-engine-v1.20.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-20-0.zip` with `CHANGELOG-v1.20.0.md`.

**Research done before building:** reviewed Professor Messer's
Network+ N10-009 course materials directly (Binary Math, Magic
Number Subnetting, Seven Second Subnetting transcripts), per explicit
direction to follow his teaching approach specifically. Also reviewed
a 100-page Cisco Networking Academy / Frederick County Career &
Technology Center subnetting workbook the person provided — confirmed
its ANDing-based method would NOT be adopted (per direction), but its
classful-addressing content (Class A-E ranges, default masks, private
ranges, and ~19 real worked example IPs) was used as real
ground-truth data to verify this build's logic against, independent
of Messer's own material.

**Added — new top-level "Subnetting" mode**, a sibling to Guided
Practice / Free Practice / Number Systems, with its own toggle button.
Switching to/from it leaves CLI device state and exercise progress
completely untouched, same principle as Number Systems.

**Added — 5 drill categories, selected via category buttons (not a
dropdown)**, per direction, with a "New Problem" button (equivalent
to Number Systems' "Skip/Next") and a running score:
1. **CIDR ↔ Subnet Mask** — bidirectional, e.g. `/26` ↔
   `255.255.255.192`.
2. **Magic Number** — given a CIDR, identify the interesting octet's
   mask value and compute the magic number (256 − mask value),
   following Messer's magic number method terminology exactly.
   Excludes CIDR values that land exactly on an octet boundary (/8,
   /16, /24 — no interesting octet) and /31-/32 (no usable host
   range), matching his own stated conventions.
3. **Address Class** — given an IP, identify Class A-E from the first
   octet. Verified against all ~9 relevant real examples from the
   workbook's own "Address Class Identification" page — exact match.
4. **Default Subnet Mask** — given an IP, state its class's default
   mask (A/B/C only, since D/E have none).
5. **Private / Public** — given an IP, determine whether it falls in
   a private range (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16).

Random problem generation is deliberately biased where a fully random
IP would rarely hit the interesting case (e.g. 192.168.0.0/16 is a
narrow target within all possible IPs) — verified this doesn't
compromise correctness, only ensures reasonable practice-problem
variety.

**Added — expanded reference chart**, accessed via its own "Reference
Chart" button (matching the existing Number Systems pattern) rather
than a permanent fixture, since the full CIDR table (/1 through /32)
would otherwise dominate the screen — implemented as a dropdown
selecting between three charts (IP Address Classes, full CIDR↔Mask
table, Private Address Ranges), per the person's own suggestion for
handling a chart that "gets too big."

**Verified all core logic independently before shipping:**
CIDR↔mask conversion and magic-number calculation checked against
every worked example from Messer's own video transcripts (/24, /26,
/20, /27, /11, /17 — all exact matches); classful identification
checked against 9 real IPs from the workbook (all exact matches,
including the D/E edge cases); private/public logic checked
specifically at the tricky 172.16–172.31 boundary (172.20.x.x
correctly private, 172.5.x.x correctly public).

**Full regression:** CLI engine (all 16 exercises) confirmed
unaffected by the HTML restructuring this required.

**Known limitation, noted honestly:** the interactive DOM/button
wiring for this new mode could not be tested live in this session (no
browser available in this environment) — the underlying calculation
logic was verified thoroughly in isolation, and the HTML structure
was checked for consistency against Number Systems' already-working
patterns (same CSS classes, same event-wiring style), but real
in-browser testing of clicking through categories, checking answers,
and viewing the reference chart is still needed. Please test this
one more thoroughly than usual given it's new UI, not just new logic.

**Test commands for this version:**
1. Click **Subnetting** in the top mode bar — confirm the panel
   appears with 5 category buttons and a CIDR ↔ Mask question loaded.
2. Answer a few CIDR ↔ Mask questions correctly and incorrectly —
   confirm score updates, feedback shows, and "New Problem" generates
   a fresh question.
3. Click through each of the other 4 category buttons — confirm each
   one loads a sensible question matching its category (magic number
   should mention an octet number; Address Class should show a plain
   IP; Private/Public should show a plain IP).
4. Click "Reference Chart" — confirm it shows the IP Address Classes
   table by default, and the dropdown correctly switches to the
   full CIDR table and the Private Ranges table.
5. Switch to Guided Practice, do something, then switch to
   Subnetting and back — confirm CLI device/exercise state is
   completely unaffected, matching how Number Systems already behaves.
6. Try the Magic Number category specifically with a few different
   "New Problem" clicks — confirm it never lands on /8, /16, /24,
   /31, or /32 (no interesting octet cases).

---

## v1.20.1 — Bug fix: stuck in Subnetting's reference chart; multiple-choice for fixed-answer categories; Magic Number explainer

**Date:** 2026-08-10

**Files:**
- `terminal-v1.20.1.html` — this is the file to open.
- `ios-engine-v1.20.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-20-1.zip` with `CHANGELOG-v1.20.1.md`.

**Bug reported: no way back from the Subnetting reference chart.**
Root cause: the "Reference Chart" toggle button lived INSIDE
`subnetDrillCard` — the very card it hides when clicked. Once the
chart was showing, the only button that could switch back was itself
invisible, since its parent container had `display: none`. Switching
away to Guided Practice and back didn't help either, since the chart
card's visibility state correctly persisted (by design — matching
Number Systems' own behavior) but the toggle button was still
unreachable. Fixed by pulling Practice/Reference Chart out to their
own always-visible top-level toggle row, matching the pattern Number
Systems' own Drill/Converter/Chart toggle already used correctly
(three always-visible sibling buttons, never nested inside the thing
being hidden) — this was the safer fix, reusing an already-proven
pattern rather than inventing a new one.

**Added, per direction — multiple-choice buttons for
Address Class, Default Mask, and Private/Public.** These three
categories have a small, fixed set of valid answers (A-E; the three
class default masks; private/public), so typing a free-text answer
added friction without adding any real practice value. Clicking a
labeled button now submits immediately, same scoring/feedback path as
typing an answer and pressing Enter. CIDR ↔ Mask and Magic Number
remain free-text, since their answer space is large enough that
buttons wouldn't make sense.

**Added, per direction — a one-time explainer for Magic Number.**
Confirmed this technique is less immediately memorable than the
others; a short refresher (interesting octet, the 256-minus-mask-value
formula, a worked /26 example) now appears above the question the
FIRST time Magic Number is selected in a session, then doesn't repeat
— intended as a quick refresher, not a permanent fixture that would
clutter repeated practice once it's been seen.

**Full regression:** CLI engine confirmed unaffected by this
version's changes (isolated entirely to the Subnetting mode's HTML/
JS).

**Known limitation, still true from v1.20.0:** live browser testing
of this interactive UI still hasn't been possible in this
environment — please test thoroughly again this version, especially
the reference-chart fix and the new choice buttons.

**Test commands for this version:**
1. In Subnetting, click "Reference Chart" — confirm a "Practice"
   button is now visible and clicking it returns you to the question
   (this was the exact reported bug).
2. Switch category to Address Class — confirm you now see 5 clickable
   buttons (A-E) instead of a text box, and clicking one submits
   immediately.
3. Switch to Default Mask and Private/Public — confirm both also show
   clickable buttons with the correct small set of options.
4. Switch to CIDR ↔ Mask and Magic Number — confirm these still show
   the free-text input box, unchanged.
5. Select Magic Number for the first time in a fresh page load —
   confirm an amber explainer box appears above the question. Answer
   it (right or wrong) and get a new problem — confirm the explainer
   does NOT reappear on subsequent Magic Number questions in the same
   session.
6. Reference Chart → switch the chart dropdown between all 3 options
   — confirm this still works correctly after the button restructuring.

---

## v1.21.0 — Course 2: 15.4 Static Routes + 16.2 Floating Static Routes (real `show ip route` route-selection logic)

**Date:** 2026-08-10

**Files:**
- `terminal-v1.21.0.html` — this is the file to open.
- `ios-engine-v1.21.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-21-0.zip` with `CHANGELOG-v1.21.0.md`.

**Confirmed before building: this was the planned point to force a
real `show ip route` upgrade**, since it only ever rendered connected/
local routes before now (a known, deliberate limitation since
v1.11.1) — needed regardless for OSPF later, so built properly now
rather than patched narrowly for just static routes.

**Added — `ip route <network> <mask> <next-hop> [admin-distance]`**
(global_config). Optional trailing AD argument handled as a special
case (fixed-token matcher can't express optional args), default AD 1
when omitted matching real IOS. Re-entering the same
network/mask/next-hop replaces the existing entry rather than
duplicating it.

**Rebuilt `show ip route`** — the substantial part of this version:
- Added `S`/`S*` route codes, admin-distance/metric display
  (`[1/0]`), and a real conditional "Gateway of last resort" line
  (previously always hardcoded to "not set").
- **Real administrative-distance route selection**: when a floating
  static route (higher AD) exists for the same destination as a
  lower-AD route, only the lower-AD route is shown — the floating one
  stays completely hidden, exactly matching 16.2's ground-truth
  expected behavor and explanatory note. Verified directly: with a
  primary AD-1 default route and a floating AD-5 default route both
  configured, only the AD-1 route appears in output.
- **Real bug found and fixed during testing**: initial classful
  grouping used a naive fixed-/24 assumption, which didn't match a
  real capture showing a static route and a connected route grouped
  TOGETHER under one shared classful header despite being different
  /24 subnets. Researched the actual rule via multiple independent
  Cisco community/documentation sources and implemented it correctly:
  group by true classful major network (Class A /8, B /16, C /24);
  within a group, show "is subnetted" (uniform prefix, all-static) vs.
  "is variably subnetted" (mixed prefixes, e.g. a connected route's
  own /24 alongside its /32 local route) based on the ACTUAL prefixes
  present, not a fixed assumption.
- Noted honestly: this project's own ground-truth reference tool's
  own sample `show ip route` text for 15.4 uses a simplified
  rendering (no `/32` local-route lines at all, coarser grouping) that
  conflicts with real Packet Tracer captures verified earlier in this
  project. Since `show` output content is never what exercises grade
  (only the typed command is checked), the real-IOS-accurate rendering
  was kept rather than degrading fidelity to match the simplified
  reference text — documented in code for future reference.

**Fixed, found while in this code — two pre-existing gaps unrelated to
static routes specifically**: VLANs and (now) static routes were never
included in `snapshotConfig`/`applyConfigSnapshot`, meaning both
would have been silently lost across `copy running-config
startup-config` / `reload` cycles. Fixed alongside the main work.

**Added — Module 15.4 and 16.2 exercises**, sourced exactly from the
ground-truth reference: "Course 2 · SyntxChk · 15.4 — Configure IP
Static Routes" (6 steps) and "Course 2 · SyntxChk · 16.2 — Configure
Floating Static Routes" (7 steps). Verified end-to-end: all steps
pass for both, `show ip route` and `show running-config` both reflect
real captured/researched behavior correctly, including floating-route
suppression.

**Full regression:** all 18 exercises pass cleanly.

**Test commands for this version — recommend more than the usual 5,
given this rebuilt a shared, non-trivial piece of routing logic that
OSPF will also depend on later:**
1. Complete **15.4 — Configure IP Static Routes** — confirm `show ip
   route` shows the default route (S*), both static routes (S), and
   correctly conditional "Gateway of last resort" line.
2. Complete **16.2 — Configure Floating Static Routes** — confirm
   `show ip route` shows ONLY the AD-1 primary routes; the AD-5
   floating routes should NOT appear anywhere in the output.
3. In Free Practice, remove the primary route's effect by configuring
   a DIFFERENT next-hop with a lower AD than the floating route (or
   simply verify by re-reading the routing table) — confirm floating
   routes remain hidden as long as any lower-AD route to the same
   destination exists.
4. `show running-config` after configuring several static routes,
   including at least one floating one — confirm all routes appear as
   separate `ip route` lines, sorted numerically, with the AD number
   shown ONLY on the floating (non-default-AD) ones.
5. Configure a connected interface AND a static route in the same
   classful major network (e.g. a router interface at 172.16.2.x plus
   a static route to 172.16.1.0/24) — confirm `show ip route` groups
   them under one shared classful header, not two separate ones.
6. Configure a static route AND a VLAN, `copy running-config
   startup-config` (accept the default filename), then `reload` and
   confirm it (single "Proceed with reload? [confirm]" prompt, since
   there are no unsaved changes at that point) — confirm both the
   static route and VLAN survive the reload correctly.

---

## v1.21.1 — Added `no ip route`, enabling real floating static route failover testing

**Date:** 2026-08-10

**Files:**
- `terminal-v1.21.1.html` — this is the file to open.
- `ios-engine-v1.21.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-21-1.zip` with `CHANGELOG-v1.21.1.md`.

**Gap found while writing a test case for the previous version:**
suggested testing floating-route failover by removing the primary
route and confirming the backup takes over — but `no ip route` didn't
exist, so that test couldn't actually be performed. Confirmed via a
real testing session (`no ip route 192.168.10.0 255.255.255.0
172.16.2.2` → `% Invalid input detected`).

**Added:** `no ip route <network> <mask> <next-hop> [admin-distance]`
(global_config), same optional-trailing-AD shape as `ip route`. Real
IOS matches for removal purposes on network+mask+next-hop alone,
whether or not the AD is included in the removal command — the
special-case handler reflects this (AD, if given, is accepted but not
required to match). Removing a route that doesn't exist correctly
returns an error rather than silently doing nothing.

**Verified the complete failover scenario now works end-to-end:**
configure a primary (AD 1) and floating (AD 5) route to the same
destination → `show ip route` shows only the primary → `no ip route`
the primary → `show ip route` now shows the floating route taking
over automatically, with the correct AD/next-hop, no other changes
needed. This is the full demonstration of what 16.2 teaches.

**Full regression:** confirmed clean on 15.4, 16.2, and a spot-check
of an unrelated earlier exercise (2.2).

**Test commands for this version:**
1. Configure a primary static route and a floating (higher-AD)
   backup to the SAME destination network — confirm `show ip route`
   shows only the primary.
2. `no ip route <same network/mask/next-hop as the primary>` — confirm
   it's removed without error.
3. `show ip route` again — confirm the floating route now appears in
   the primary's place, with its own AD and next-hop.
4. Try `no ip route` on a network/mask/next-hop combination that was
   never configured — confirm it's correctly rejected with an error,
   not silently accepted.
5. Re-run **16.2 — Configure Floating Static Routes** fully — confirms
   this addition didn't change any existing behavior.

---

## v1.22.0 — Course 2: 4.2 Router-on-a-Stick (subinterfaces, verified against real captures)

**Date:** 2026-08-10

**Files:**
- `terminal-v1.22.0.html` — this is the file to open.
- `ios-engine-v1.22.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-22-0.zip` with `CHANGELOG-v1.22.0.md`.

**Ground truth obtained:** a real router capture (`show running-config`
and `show interfaces gigabitethernet 0/0.10`) from the matching real
Packet Tracer activity (4.2.7), confirmed as the same module number as
this project's Syntax Checker data. Revealed several details that
would have been very difficult to guess correctly, including a
genuinely odd real IOS message quirk (see below).

**Design decision, confirmed with the person before building:** the
real capture used a 2-segment router model (`GigabitEthernet0/0`,
matching the ground-truth script's own interface naming for THIS
specific exercise), different from this project's established
3-segment `GigabitEthernet0/0/0` convention used everywhere else.
Confirmed treating this exercise's interfaces as genuinely different
from the rest, rather than forcing consistency — the exercise itself
was built using the 3-segment form to match the ground-truth script
exactly, and it works correctly since `interface <name>` already
accepts any interface name outside the fixed inventory via its
existing generic fallback (no engine change needed for this part).

**Added — subinterfaces, a new dynamically-created interface
category:** unlike physical interfaces (fixed inventory from
DEVICE_MODELS) or VLANs (global, keyed by ID), subinterfaces are
child interfaces of a specific parent, created on demand via
`interface <physical>.<number>` — recognized via a dotted-number
suffix pattern (`isSubinterfaceName()` / `parentInterfaceName()`
helpers), auto-created the same way VLANs already are. New per-
interface state: `dot1qVlan`, `dot1qNative`.

**Added — `encapsulation dot1Q <vlan-id> [native]`**
(interface_config only, and only on a subinterface — real IOS rejects
this on a physical interface). Optional trailing `native` keyword
handled as a special case, same pattern as `ip route`'s optional AD.

**Added — real cascading `no shutdown` behavior**, verified EXACTLY
against the real capture, including a genuinely odd IOS message quirk
that would have been very hard to guess: bringing up a PHYSICAL
interface with existing subinterfaces also brings up every
subinterface underneath it (subinterfaces have no independent
admin-up/down state), and each subinterface's status message reads
`%LINK-3-UPDOWN: ... changed state to DOWN` immediately followed by
`%LINEPROTO-5-UPDOWN: ... changed state to UP` — the link message
says "down" while the very next line says "up." Verified the full
message sequence (physical interface's own two lines, then each
subinterface's odd down/up pair, in configuration order) is an EXACT
match against the real capture.

**Fixed — `show running-config` for subinterfaces**, verified against
the real capture: `encapsulation dot1Q` now correctly appears BEFORE
`ip address` (not after), and subinterfaces correctly show NO
shutdown/no-shutdown line at all (they don't carry independent
admin-up/down state).

**Added — `show interfaces <subinterface>`** as a genuinely distinct
rendering, not a trimmed variant of the physical-interface report —
verified against the real capture: different hardware type string
(`PQUICC_FEC`), different default BW/DLY (100000 Kbit / 100 usec vs.
a physical port's 1000000/10), a completely different encapsulation
line (`802.1Q Virtual LAN, Vlan ID <n>` instead of `ARPA`), and none
of the duplex/keepalive/queueing/packet-counter lines a physical
interface's report includes.

**Fixed — real bug found during testing: `show ip interface brief`
produced zero space between a long interface name and its IP address**
when the name reached or exceeded the column's nominal width (e.g.
`GigabitEthernet0/0/0.10` is exactly 23 characters, the column's full
width) — `padEnd()` alone provides no separation once a string is
already at or past its target length. Fixed to always guarantee at
least one space, matching standard real IOS tabular-output behavior.
Verified this doesn't affect any previously-verified exact-match case
(shorter interface names still render identically to before).

**Added — Module 4.2 exercise:** "Course 2 · SyntxChk · 4.2 —
Router-on-a-Stick Inter-VLAN Routing", 14 steps, sourced exactly from
the ground-truth reference (three subinterfaces for VLANs 10, 20, and
99-native, using the project's standard 3-segment interface naming).
Verified end-to-end: all 14 steps pass, exercise completes, `show ip
interface brief` correctly shows all three subinterfaces up/up with
their addresses.

**Full regression:** all 19 exercises pass cleanly.

**Test commands for this version:**
1. Complete **Course 2 · SyntxChk · 4.2 — Router-on-a-Stick
   Inter-VLAN Routing** fully.
2. Watch the message output when you run `no shutdown` on the
   physical interface — confirm you see the physical interface's own
   two lines, THEN each subinterface's down/up message pair (4 lines
   total per subinterface pair × 3 subinterfaces + 2 for the physical
   = 8 lines).
3. `show running-config` — confirm each subinterface shows
   `encapsulation dot1Q <n>` BEFORE `ip address`, and NO shutdown
   line at all on any subinterface.
4. `show interfaces GigabitEthernet 0/0/0.10` — confirm the shorter,
   distinct report (Hardware is PQUICC_FEC, BW 100000 Kbit,
   `Encapsulation 802.1Q Virtual LAN, Vlan ID 10`), not the physical
   interface's longer template.
5. `show ip interface brief` — confirm the subinterface rows (long
   names) still have a visible space before the IP address column,
   not run together.

---

## v1.22.1 — Four fixes: Magic Number explainer expanded, `?commands all` grouped by mode, Syntax Checkers reordered by course/number

**Date:** 2026-08-10

**Files:**
- `terminal-v1.22.1.html` — this is the file to open.
- `ios-engine-v1.22.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-22-1.zip` with `CHANGELOG-v1.22.1.md`.

**Noted, not changed:** the person confirmed the `show ip interface
brief` column alignment being "off by one space" for long subinterface
names (e.g. `GigabitEthernet0/0/0.10`) is expected — real Cisco IOS
has this exact same visual limitation with long interface names, so
this isn't something to fix; still readable, matches real behavior.
Another Packet Tracer capture could help refine this further if
needed later.

**Expanded, per direction — Magic Number explainer is now much more
thorough**, walking through the full concept (what makes an octet
"interesting," why 255/0/in-between matters, the complete formula,
and what the resulting number tells you about both subnet size and
boundary spacing), plus the same fully-worked /26 example as before.
Added two reference links for anyone who wants Professor Messer's
full treatment: the article page and the exact matching YouTube
video, confirmed as the correct N10-009 (matching this project's
course version) resources via direct search. Per direction, both
URLs are shown as plain, fully-visible text (not a clickable link an
unfamiliar viewer might be wary of) — a student can read the full
address before deciding whether to type it in themselves.

**Redesigned, per direction — `?commands all` now groups commands
by mode with clear section headers**, instead of one flat list with
a `*` marker for unusable ones. A fixed mode order (user_exec →
priv_exec → global_config → interface_config → line_config →
vlan_config) keeps the structure predictable as more modes get added
later. A command valid in multiple modes appears once under EACH
mode section it belongs to. The section matching the device's actual
current mode is marked "<- you are here" for quick orientation.

**Fixed, per direction — Syntax Checkers are now listed by course,
then by module number**, both in the underlying data and therefore
in the module dropdown (which iterates that same array in order).
Course 1 was already correctly ordered; Course 2 had drifted out of
order because each new exercise was simply appended at the end as it
was built — most visibly, 4.2 (built most recently) had ended up
after 16.2 instead of its correct numeric position right after 3.3.
Reordered Course 2 to: 1.1, 1.2, 1.3, 3.2, 3.3, 4.2, 11.1, 15.4, 16.2.
IDs are unchanged — this is purely a display/ordering fix, confirmed
via full regression that nothing else was affected.

**Full regression:** all 19 exercises pass cleanly.

**Started (not yet built) — scoping the next Syntax Checker.** Per
the established build sequence, Course 2's DHCP cluster (7.1
DHCPv4, 7.2 DHCP Relay, then Course 3's 8.2/8.3 DHCPv6) is next.
Ground-truth data for 7.1 has not yet been pulled this session —
planned for the next work session.

**Test commands for this version:**
1. In Subnetting mode, select Magic Number for the first time in a
   fresh session — confirm the expanded explainer appears with both
   full URLs shown as plain visible text, not hidden behind a link.
2. From any mode, type `?commands all` — confirm commands are now
   grouped under mode section headers, and the section matching your
   CURRENT mode is marked "<- you are here".
3. Open the module dropdown — confirm Course 2's exercises now appear
   in the order 1.1, 1.2, 1.3, 3.2, 3.3, 4.2, 11.1, 15.4, 16.2 (not
   with 4.2 at the very end).
4. Select and complete **4.2** from its new position in the dropdown
   — confirms the reordering didn't break exercise selection/loading.
5. Confirm `?commands` (without "all") is unaffected — still shows
   the short, current-mode-only list as before.

---

## v1.22.2 — Bug fix: switch access ports now correctly default to administratively UP

**Date:** 2026-08-10

**Files:**
- `terminal-v1.22.2.html` — this is the file to open.
- `ios-engine-v1.22.2.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-22-2.zip` with `CHANGELOG-v1.22.2.md`.

**Real, already-confirmed gap addressed** (flagged since v1.18.0,
picked up now since it needed no new Packet Tracer capture — the
evidence already existed in two separate ground-truth Syntax Checker
scripts): real Cisco switch physical access ports default to
administratively UP, unlike router physical interfaces (which
correctly default DOWN, unaffected by this fix) — confirmed via 11.1
and 3.2's own real scripts, both of which configure a switch port and
expect it to show as `up`/`Secure-up` WITHOUT ever running `no
shutdown`. This engine had every interface, regardless of device
type, defaulting to `shutdown: true`.

**Fixed:** `freshInterfaceState()` now takes a `defaultUp` parameter;
a new `defaultsUpAtCreation(deviceType, name)` helper determines it
correctly per interface — true only for a SWITCH's physical access
ports (FastEthernet/GigabitEthernet), explicitly false for
Vlan/SVI interfaces on ANY device type (confirmed via many real
captures showing `Vlan1 ... administratively down` even on switches)
and for all router physical interfaces (unaffected, still correctly
default down). Applied consistently across all 4 places interface
state gets created: `createDevice()`'s initial inventory,
`getOrCreateInterface()`'s fallback (for dynamically-created/
non-inventory interfaces), and both `applyConfigSnapshot()`'s and
`hasUnsavedChanges()`'s "fresh device" reconstructions — the latter
two needed the same fix or a fresh switch would have incorrectly
appeared to have "unsaved changes" the moment it was created, and a
`reload` with no saved config would have incorrectly brought ports
back down instead of restoring the true factory-default (up) state.

**Verified — no unconditional-vs-conditional messaging concern**:
confirmed real IOS re-prints the same `%LINK-5-CHANGED`/
`%LINEPROTO-5-UPDOWN` messages when `no shutdown` is run on an
already-up interface too (not just on an actual down→up transition),
so this project's existing unconditional messaging in the
`no_shutdown` handler was already correct and needed no change.

**Verified directly against the exact real captures that originally
revealed this gap:** re-ran 3.2 and 11.1 end-to-end — `show vlan
brief` now correctly shows Fa0/6 and Fa0/11 as active/up (no `no
shutdown` was ever run on them in the script), and `show
port-security interface` now correctly shows `Secure-up` (same). Also
verified `reload` (discarding unsaved changes) correctly restores a
switch's ports to their true default-up state, not down.

**Full regression:** all 19 exercises pass cleanly.

**Test commands for this version:**
1. Free Practice, fresh switch device, `show ip interface brief`
   immediately with zero configuration — confirm every FastEthernet/
   GigabitEthernet port shows `up`/`up` (not administratively down),
   while `Vlan1` still correctly shows administratively down.
2. Same test on a fresh ROUTER device — confirm physical interfaces
   still correctly default to administratively down (unaffected by
   this fix).
3. Re-run **3.2 — Configure VLANs on a Switch** fully — confirm
   `show vlan brief`'s final output shows Fa0/6 and Fa0/11 as active
   without ever needing a `no shutdown` step (there isn't one in this
   exercise).
4. Re-run **11.1 — Configure Port Security** fully — confirm `show
   port-security interface` shows `Port Status : Secure-up`.
5. On a switch, manually `shutdown` a port, save, then `reload`
   WITHOUT saving that shutdown (answer "no" to the save prompt) —
   confirm the port comes back UP after reload, matching a real
   factory-default boot.

---

## v1.23.0 — New "Packet Tracer" mode: multi-device, task-checklist exercises (first version, narrow scope)

**Date:** 2026-08-10

**Files:**
- `terminal-v1.23.0.html` — this is the file to open.
- `ios-engine-v1.23.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-23-0.zip` with `CHANGELOG-v1.23.0.md`.

**Ground truth obtained:** the real Packet Tracer lab worksheet for
"10.3.4 Connect a Router to a LAN" (Course 1) — a genuinely simple,
early lab (2 routers, a WAN link between them, 2 LANs per router),
deliberately chosen as the basis for this first version rather than
inventing a generic topology, per direction. Confirmed via its
addressing table: R1 (Gi0/0 → 192.168.10.1/24, Gi0/1 →
192.168.11.1/24), R2 (Gi0/0 → 10.1.1.1/24, Gi0/1 → 10.1.2.1/24), each
router also saving its config — exactly the task set built into this
version.

**Design confirmed with the person before building — genuinely
different grading philosophy from Guided Practice:** Guided Practice
checks exact typed command text, in strict order — right for drilling
exact CLI syntax. This new mode instead defines a set of TASKS
checked against actual RESULTING DEVICE STATE, not typed text — so
Tab completion, abbreviations, or any equivalent valid syntax all
count correctly, since the point is verifying real competency on a
multi-device scenario, not command memorization. Verified directly:
a task like "configure GigabitEthernet 0/0 correctly" is satisfied
identically whether typed in full or via heavily abbreviated commands
(`en`, `conf t`, `int g0/0`, `ip add`, `desc`, `no shut`). Tasks are
grouped by device but explicitly NOT ordered relative to each other —
confirmed this matches how a real multi-device lab is actually worked
(you can do R2's tasks before finishing R1's).

**Added — new top-level mode: "Packet Tracer"**, its own button
alongside Guided Practice / Free Practice / Number Systems /
Subnetting. Per direction, selecting it reveals its OWN dropdown
(populated only in this mode, not visible anywhere else), so there's
no ambiguity about which mode is active. CLI device state and Guided/
Free progress are completely untouched by entering or leaving this
mode, same principle as Number Systems and Subnetting.

**Added — multi-device architecture**: each Packet Tracer-style
exercise defines its own set of independent `Device` objects (built
on the `DEVICE_MODELS`/multi-device foundation laid back in v1.12.0),
persisting separately as you switch between them via device buttons.
Verified directly: configuring R1's hostname has zero effect on R2's
state, and vice versa — confirmed both devices maintain fully
independent interfaces, config, and saved startup-config.

**Added — device switcher UI**: buttons for each device in the
current lab: clicking one switches the active terminal to that
device's own persistent session (own prompt, own scrollback going
forward). The main CLI terminal's Tab-completion and interactive
multi-turn prompts (`copy`/`erase`/`reload`) are fully reused here via
the same underlying `getCompletions()`/`handlePendingPrompt()`
functions — verified the `copy running-config startup-config`
interactive sequence works correctly through this new terminal too.

**Added — task checklist UI**: a live-updating list of tasks (checked
after every command, on any device) showing device tag, description,
and a checkmark once satisfied. Built the first lab's exact 6 tasks
(4 interface configurations + 2 saves) matching the ground-truth
lab's Part 2 exactly.

**Scoped deliberately narrow, per the plan — NOT a generic framework
yet.** This version is built specifically around one real lab, not
an abstract system for arbitrary future Packet Tracer content —
intentional, to see how the concept feels in practice before
generalizing. Explicitly out of scope for this version, flagged
honestly:
- PC-side simulation (`ping`, `ipconfig`) — remains the already-logged
  future "Windows-CMD-style pane" backlog item; this version only
  covers the two routers, no PCs.
- Command history (Up/Down arrow recall) in the Packet Tracer
  terminal — declared per-device but not yet wired up to actual
  keyboard navigation, unlike the main CLI terminal which has this.
- Switches are implied by the lab's own narrative text ("LAN
  connection to S1") but not separately simulated as their own
  configurable devices in this version.

**Full regression:** all 19 existing Guided/Free Syntax Checker
exercises confirmed unaffected by this version's HTML/JS additions.

**Known limitation — could not be tested in a live browser** (no
browser available in this environment). All underlying logic (task
checking against device state, multi-device independence, Tab
completion, interactive prompts) was verified thoroughly via direct
engine testing in Node, and the HTML/CSS/wiring was checked carefully
against already-working patterns from Number Systems and Subnetting,
but real in-browser testing of the actual clicking/typing experience
is still needed — please test this one thoroughly.

**Test commands for this version:**
1. Click **Packet Tracer** in the top mode bar — confirm its own
   dropdown appears (showing "Course 1 · PacketTr · 10.3 — Connect a
   Router to a LAN"), device buttons for R1 and R2 appear, and a task
   checklist with 6 unchecked items appears on the right.
2. On R1 (should be the default active device), type `enable`,
   `configure terminal`, `interface GigabitEthernet0/0`, `ip address
   192.168.10.1 255.255.255.0`, `description test`, `no shutdown` —
   confirm the "R1: Configure GigabitEthernet 0/0" task checks off
   automatically.
3. Click the **R2** button — confirm the terminal switches to R2's own
   session (different prompt, starts fresh), and R1's task remains
   checked off in the list (not reset).
4. Configure R2's GigabitEthernet 0/0 the same way — confirm its task
   checks off too, while R1's tasks are unaffected.
5. On either device, `copy running-config startup-config` then press
   Enter with nothing typed (accept the default filename) — confirm
   the save prompt sequence works correctly and that device's "Save"
   task checks off.
6. Switch back to Guided Practice — confirm your normal CLI
   device/exercise state (from before entering Packet Tracer mode) is
   completely unaffected and picks up right where you left it.
7. Try Tab completion in the Packet Tracer terminal (e.g. type `conf`
   and press Tab) — confirm it completes the same way it does in the
   main CLI terminal.

---

## v1.23.1 — Packet Tracer mode: expandable task hints + addressing table; new `show interfaces` variants

**Date:** 2026-08-10

**Files:**
- `terminal-v1.23.1.html` — this is the file to open.
- `ios-engine-v1.23.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-23-1.zip` with `CHANGELOG-v1.23.1.md`.

**Feedback from real testing of v1.23.0:** the person completed the
full Packet Tracer lab successfully, but noted the "description" task
gave no indication of what to actually type — they guessed correctly
from prior Guided Practice experience, but a genuinely new student
wouldn't have that context. Also asked whether `show interfaces
gigabitethernet` (no slot/port) would ever work, since it currently
returned nothing useful.

**Added, per direction — expandable task hints.** Task list items
now show a short summary by default (no answer given away); clicking
an incomplete task reveals a hint with the actual command pattern
needed, so a student can genuinely try to recall it themselves first
rather than being handed the answer immediately. Completed tasks are
no longer clickable (no hint needed once done). Hint state persists
across the list's frequent re-renders (it redraws after every typed
command) via a small tracking object, so hints don't collapse
unexpectedly mid-task.

**Added, per direction — an addressing table**, shown above the
device buttons, matching how real Packet Tracer worksheets present
this information (a table to look up, not values embedded in
instructions). IP addresses were removed from task labels and hints
entirely — a student now looks up "R1, GigabitEthernet 0/0" in the
table themselves, the same way they would with a real lab handout.

**Investigated and fixed — `show interfaces gigabitethernet` (type
only, no slot/port) and bare `show interfaces` (no argument at all)
both previously failed.** Confirmed via real Cisco documentation
these are genuine, valid IOS behaviors on at least some platforms
(not something to guess at): `show interfaces <Type>` with no number
defaults to the first interface of that type (a Cisco IOS reference
doc explicitly describes this for an ISR4451-X: "port 0"); bare `show
interfaces` with zero arguments shows every interface on the device
in sequence (confirmed via a Cisco IOS Cookbook reference). Both now
implemented: `show interfaces gigabitethernet` on a fresh router shows
`GigabitEthernet0/0/0`'s detail; bare `show interfaces` shows all 5
interfaces' full detail reports back to back.

**Full regression:** confirmed no impact on existing exercises that
exercise `show interfaces` in its other forms (17.5, 3.3, 11.1).

**Test commands for this version:**
1. Free Practice: `show interfaces gigabitethernet` (no number) on a
   fresh router — confirm it now shows GigabitEthernet0/0/0's detail
   instead of failing.
2. `show interfaces` (completely bare) — confirm it shows all 5
   interfaces' detail reports, one after another.
3. In Packet Tracer mode, load the lab — confirm an addressing table
   now appears above the device buttons, and task labels no longer
   contain IP addresses (just a short summary like "Configure
   GigabitEthernet 0/0").
4. Click an incomplete task — confirm a hint expands showing the
   command pattern (still no exact IP — that comes from the table).
5. Complete that task's actual configuration — confirm the task
   checks off AND its hint area disappears/becomes non-clickable.
6. Type a few more commands on the same device (making the task list
   re-render several times) — confirm any hint you'd expanded stays
   expanded rather than collapsing on its own.

---

## v1.23.2 — Packet Tracer task hints now suggest an actual description text

**Date:** 2026-08-10

**Files:**
- `terminal-v1.23.2.html` — this is the file to open.
- `ios-engine-v1.23.2.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-23-2.zip` with `CHANGELOG-v1.23.2.md`.

**Feedback from real testing of v1.23.1:** the expanded hints told a
student to add "a description" without saying what it should actually
say — still not enough for someone genuinely new to the material.

**Fixed:** all 4 interface-configuration task hints now suggest the
real, specific description text from the ground-truth lab ("LAN
connection to S1" / "S2" / "S3" / "S4", one per interface), worded as
an example ("e.g. ...") rather than presented as the single required
answer — since the underlying check genuinely accepts ANY non-empty
description (confirmed this is still true: a completely different
description text still satisfies the task). The hint is now honestly
informative without overstating how strict the grading actually is.

**Full regression:** confirmed no impact on existing exercises.

**Test commands for this version:**
1. In Packet Tracer mode, click an incomplete interface-configuration
   task — confirm the hint now suggests a specific example description
   (e.g. "LAN connection to S1" for R1's GigabitEthernet 0/0).
2. Configure that interface using a DIFFERENT description than the
   one suggested — confirm the task still checks off correctly (the
   hint is a suggestion, not a strict requirement).

---

## v1.23.3 — New feature: adjustable text size (7 levels, whole app)

**Date:** 2026-08-10

**Files:**
- `terminal-v1.23.3.html` — this is the file to open.
- `ios-engine-v1.23.3.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-23-3.zip` with `CHANGELOG-v1.23.3.md`.

**Requested:** a text size control near Reset exercise/Reset device,
with a couple of sizes smaller than default and about 4 sizes larger.
Concern raised: could this break column alignment in the terminal
output, or cause layout problems in the new Packet Tracer panel?

**Investigated before building:** confirmed the entire page already
uses a single monospace font (Courier New) applied globally — this
matters because scaling a monospace font's SIZE never breaks column
alignment (every character, including spaces, scales together
proportionally); the only real risk is COSMETIC — fixed-width layout
containers (like the Packet Tracer task list's 280px column)
potentially wrapping awkwardly at larger sizes, not any actual
misalignment of `show` command output.

**Added — a "Text size" dropdown**, 7 levels: Smaller (0.85×), Small
(0.92×), Default (1×), Large (1.15×), Larger (1.3×), Largest (1.5×),
Huge (1.7×) — matching the requested "2 smaller, 4 bigger" range.
Applies to the ENTIRE app uniformly (CLI, Number Systems, Subnetting,
Packet Tracer) via the CSS `zoom` property on the single outer `.wrap`
container, rather than converting every one of the dozens of existing
hardcoded pixel font-size declarations scattered through the file to
a relative unit — `zoom` scales the whole rendered layout (not just
text) proportionally with a single property, which is both far safer
than a large risky CSS rewrite and guarantees every panel's fixed-
width elements scale together consistently rather than drifting out
of proportion with each other.

**Verified before committing to this approach:** confirmed via
current browser compatibility data that CSS `zoom` reached Baseline
(widely available across all major browsers, including Firefox as of
version 126) in May 2024 — safely supported today, not a
compatibility risk.

**Added:** the chosen size persists across page reloads via
localStorage (wrapped in a try/catch, since some browser privacy
modes block storage access — falls back to the default size
gracefully rather than erroring).

**Full regression:** confirmed no impact on existing CLI exercises.

**Known limitation, not yet tested:** could not visually confirm
whether the Packet Tracer panel's task-list column develops awkward
text wrapping at the largest sizes (Largest/Huge) — no browser
available in this environment. Please check the two largest settings
specifically in that panel; if the task list wraps badly, the
available range can be narrowed in a follow-up patch.

**Test commands for this version:**
1. In the CLI panel, open the "Text size" dropdown next to Reset
   exercise/Reset device — confirm all 7 options are present.
2. Select "Larger" or "Largest" — confirm the ENTIRE page (terminal,
   buttons, dropdowns) scales up together, and `show ip interface
   brief`'s columns still line up correctly (this is expected to work
   given the monospace-font reasoning above, but worth eyeballing).
3. Switch to Number Systems, Subnetting, and Packet Tracer modes with
   a non-default size selected — confirm all three scale consistently
   with the CLI panel, not independently.
4. Specifically in Packet Tracer mode at "Largest" or "Huge" — check
   whether the task list column wraps awkwardly; report back if so.
5. Reload the page after selecting a non-default size — confirm the
   size choice is remembered.

---

## v1.23.4 — Text size control now in all 4 modes; added "Reset lab" for Packet Tracer mode

**Date:** 2026-08-11

**Files:**
- `terminal-v1.23.4.html` — this is the file to open.
- `ios-engine-v1.23.4.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-23-4.zip` with `CHANGELOG-v1.23.4.md`.

**Reported: text size worked correctly in a real Firefox browser, but
Dropbox's file preview resized the WINDOW instead of the text.**
Explained (not a bug in this project): Dropbox's built-in preview
renders the file inside its own constrained viewer, not a real
browser tab — `zoom` gets misinterpreted there. The file itself is
fully portable and needs no server; the fix is to export/download it
out of Dropbox first (not use its in-app preview) and open the
downloaded copy directly in a real browser (Safari/Chrome/Firefox),
which then behaves identically to opening it any other way. No code
change needed for this part — genuinely a Dropbox-preview limitation,
not a bug here.

**Fixed, per direction — text size control was only visible in the
CLI panel's toolbar.** The underlying `zoom` scaling already applied
to the whole app (confirmed back in v1.23.3), but the actual dropdown
control only appeared in one of the four modes. Moved it to the
always-visible top-level mode bar (next to Guided/Free/Number
Systems/Subnetting/Packet Tracer buttons) instead of the CLI-only sub
bar, so it's now visible and usable from every mode without
duplicating the control four times or needing to keep multiple
dropdowns in sync.

**Added, per direction — a "Reset lab" button for Packet Tracer
mode.** Previously there was no explicit way to reset a Packet Tracer
lab at all — switching the lab dropdown away and back happened to
work (since changing it calls the same rebuild function), but wasn't
an obvious or intentional reset action, and wouldn't do anything if
only one lab exists in the list (no "change" event fires). Unlike the
CLI panel's separate "Reset exercise" (progress only) vs. "Reset
device" (device state) buttons, Packet Tracer mode's task completion
is entirely DERIVED from device state — there's no separate progress
counter to reset independently — so one unified "Reset lab (all
devices)" button correctly rebuilds fresh devices for every device in
the lab, clears the terminal, and resets any expanded task hints.

**Full regression:** confirmed no impact on existing exercises.

**Test commands for this version:**
1. Confirm the "Text size" dropdown is now visible in ALL four modes
   (Guided/Free CLI, Number Systems, Subnetting, Packet Tracer) — not
   just the CLI panel.
2. Change the size while in Number Systems or Subnetting — confirm it
   still scales the whole app, same as before.
3. In Packet Tracer mode, configure part of one router, then click
   "Reset lab (all devices)" — confirm BOTH devices return to a
   completely fresh state and all tasks become unchecked again.
4. After resetting, confirm the terminal shows the same "Lab loaded"
   messages as when you first entered the mode, and the active device
   returns to the first one (R1).
5. If you have Dropbox available: try exporting/downloading the file
   out of Dropbox (not using its preview) and opening the downloaded
   copy directly in a browser — confirm text size now works correctly
   there too.

---

## v1.23.5 — Bug fix: text size only scaled the dropdown's own bar in Subnetting/Packet Tracer, not the actual content

**Date:** 2026-08-11

**Files:**
- `terminal-v1.23.5.html` — this is the file to open.
- `ios-engine-v1.23.5.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-23-5.zip` with `CHANGELOG-v1.23.5.md`.

**Bug reported:** changing text size in Packet Tracer, Number
Systems, or Subnetting mode only resized the small bar containing the
dropdown itself — not the terminal, task list, or drill content below
it.

**Root cause:** the `zoom` scaling (added in v1.23.3) is applied to
the single outer `.wrap` container, but `.wrap`'s closing `</div>`
tag had been placed too early — right after the Number Systems panel
— back when Subnetting and Packet Tracer mode were first built as
new top-level sibling panels. Both ended up as SIBLINGS of `.wrap` in
the actual HTML structure, not children of it, even though visually
they appeared "inside" the same page. Number Systems (built earlier,
correctly nested before that boundary) was scaling correctly the
whole time; Subnetting and Packet Tracer's own toolbars happened to
still be affected only because their font-size dropdown itself lives
in the top-level mode bar, which IS inside `.wrap` — but everything
below that boundary, including their actual panel content, was not.

**Fixed:** moved `.wrap`'s closing tag to after ALL FOUR panels
(CLI, Number Systems, Subnetting, Packet Tracer), so every panel is
now genuinely nested inside the single scaling container. Verified
the fix directly: div open/close tag counts across the entire page
body are balanced (64/64), and all three panels' container elements
now appear between `.wrap`'s open and close tags at the raw HTML
level, not just visually.

**Full regression:** confirmed no impact on existing CLI exercises.

**Test commands for this version:**
1. Switch to Subnetting mode, change text size to Larger or Largest —
   confirm the ENTIRE panel (category buttons, question text, input
   box, reference chart) scales up now, not just the top toolbar.
2. Switch to Packet Tracer mode with a non-default size already
   selected — confirm the terminal, device buttons, addressing table,
   and task list are all scaled correctly.
3. Switch to Number Systems — confirm it's still scaling correctly
   (this one was actually fine before; just confirming no regression).
4. Switch back to Guided/Free CLI — confirm it's still scaling
   correctly too.
5. Try the largest size (Huge) in each of the four modes — confirm
   nothing looks visually broken or clipped in a way that suggests
   the div structure is still wrong.

---

## v1.23.6 — Two text-size UI fixes: terminal shrinks at largest sizes; "Text size:" merged into the dropdown

**Date:** 2026-08-11

**Files:**
- `terminal-v1.23.6.html` — this is the file to open.
- `ios-engine-v1.23.6.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-23-6.zip` with `CHANGELOG-v1.23.6.md`.

**Reported:** at large text sizes, the instruction bar at the top of
Guided Practice and Packet Tracer mode scrolled out of view — the
terminal's own fixed 420px height was scaling up along with
everything else via `zoom`, pushing the whole page taller than the
screen. Suggested fix: shrink the visible output area specifically at
the largest sizes, keeping scrollback available via the scrollbar.

**Fixed, per direction:** added a body-level class toggled at the two
largest text sizes (Largest/Huge) that shrinks `.terminal`'s fixed
height from 420px to 260px specifically at those levels — trading
some visible scrollback (still fully reachable by scrolling within
the terminal box itself) for keeping the overall page short enough
that the instruction bar and other controls stay visible without
scrolling the whole page. Applies automatically to BOTH the main CLI
terminal and the Packet Tracer terminal, since both share the same
`.terminal` CSS class — no separate rule needed for Packet Tracer
specifically.

**Reported:** the "Text size:" label appeared on its own line, not
next to the dropdown, since the top mode bar's 5 buttons plus a
separate label plus the select didn't all fit on one line at typical
widths.

**Fixed, per direction:** removed the standalone label entirely and
merged "Text size: " directly into each dropdown option's own text
(e.g. "Text size: Default", "Text size: Largest") — since it's all
now one single element, it can never wrap apart from the select box
the way a separate label could.

**Full regression:** confirmed no impact on existing exercises.

**Test commands for this version:**
1. Select "Largest" or "Huge" text size in Guided Practice — confirm
   the terminal output box is now noticeably shorter (more compact),
   and the instruction bar above it stays visible without needing to
   scroll the page.
2. Confirm you can still scroll WITHIN the shorter terminal box to see
   earlier output — nothing is lost, just less visible at once.
3. Do the same check in Packet Tracer mode — confirm its terminal also
   shrinks at the two largest sizes.
4. Select "Default", "Large", or "Larger" — confirm the terminal stays
   at its normal 420px height at these sizes (only the two largest
   trigger the shrink).
5. Confirm the dropdown now reads "Text size: Default" (etc.) as a
   single line inside the select box itself, with no separate label
   text appearing above or beside it.

---

## v1.24.0 — Course 2: 7.1 Configure DHCPv4 (real `show ip dhcp pool` output verified exactly)

**Date:** 2026-08-11

**Files:**
- `terminal-v1.24.0.html` — this is the file to open.
- `ios-engine-v1.24.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-24-0.zip` with `CHANGELOG-v1.24.0.md`.

**Ground truth obtained:** a real, precisely-spaced Packet Tracer
capture (Notepad-relay method) of the full 7.1 sequence — `ip dhcp
excluded-address`, pool creation, all four pool sub-commands, `show
ip dhcp pool`, and `show running-config`. Also included a bonus real
OSPF configuration (`router ospf 10`, `network ... area 0`) banked
for whenever the OSPF cluster is built.

**Added — new mode: `dhcp_pool_config`**, entered via `ip dhcp pool
<name>` (auto-creates the pool if new, same pattern as `vlan <id>`),
prompt `(dhcp-config)#` — confirmed exact against the real capture.

**Added commands:** `ip dhcp excluded-address <start> <end>`
(global_config); `network <network> <mask>`, `default-router <ip>`,
`dns-server <ip>`, `domain-name <name>` (all dhcp_pool_config —
confirmed `domain-name` here is a genuinely separate command from the
existing global `ip domain-name`, no token collision).

**Added — `show ip dhcp pool`**, verified EXACTLY against the real
capture. Found and fixed two real off-by-one spacing bugs while
diffing character-by-character against the capture: the label column
width was set to 32, needed to be 31 (colon position measured
directly: 32nd character, preceded by one leading space); the address
range column needed one additional character of padding before the
Leased/Excluded/Total counts. Every line now matches the real capture
exactly except the excluded-address count (see below).

**Investigated a discrepancy rather than blindly matching the one
capture:** the real capture showed "Excluded addresses: 1" for a
9-address exclusion range (`192.168.10.1`-`192.168.10.9`), which
doesn't match straightforward raw counting. Cross-checked against six
independent real Cisco documentation/community sources (Cisco's own
SD-WAN troubleshooting doc, two Catalyst switch CLI guides, and
several community threads) — every one confirms plain raw-range
counting is the well-documented general behavior (e.g., a 20-address
exclusion correctly showing 20 excluded in one real example).
Implemented the well-corroborated general rule rather than overfit to
one ambiguous data point, with the reasoning documented directly in
the code for future reference if a clearer capture surfaces.

**Verified `show running-config`'s DHCP block matches the real
capture EXACTLY**: `ip dhcp excluded-address` first, then `ip dhcp
pool <name>` with `network`/`default-router`/`dns-server`/
`domain-name` in that exact order, positioned right after security
settings and before interfaces.

**Fixed, found while adding this feature — DHCP state (excluded
ranges, pools) was initially missing from `snapshotConfig`/
`applyConfigSnapshot`/the "no startup-config" boot path/
`hasUnsavedChanges`'s comparator.** Added to all four locations
immediately (same category of oversight caught and fixed for VLANs/
static routes back in v1.21.0) — DHCP configuration now correctly
survives `copy`/`reload` cycles.

**Added — Module 7.1 exercise:** "Course 2 · SyntxChk · 7.1 —
Configure DHCPv4", 9 steps, sourced exactly from the ground-truth
reference, inserted in correct numeric order (after 4.2, before 11.1,
maintaining the course/number ordering fixed back in v1.22.1).
Verified end-to-end: all 9 steps pass, exercise completes, `show ip
dhcp pool` output matches the real capture.

**Full regression:** all 20 exercises pass cleanly.

**Test commands for this version:**
1. Complete **Course 2 · SyntxChk · 7.1 — Configure DHCPv4** fully.
2. `show ip dhcp pool` after completing — confirm every label's colon
   lines up at the same column, matching a real capture's precision.
3. `show running-config` — confirm `ip dhcp excluded-address` appears
   before the `ip dhcp pool` block, and the pool's four sub-lines
   appear in the order network/default-router/dns-server/domain-name.
4. Configure a SECOND, different excluded-address range (e.g.
   `ip dhcp excluded-address 192.168.10.200 192.168.10.219`, a
   20-address range) — confirm `show ip dhcp pool` shows exactly 20
   excluded for that range, confirming the raw-count behavior.
5. `copy running-config startup-config`, then `reload` confirming with
   nothing else typed — confirm the DHCP pool and excluded-address
   configuration both survive the reload correctly.

---

## v1.24.1 — Bug fix: 7.1's default-router/dns-server/domain-name steps never stated the actual values to type

**Date:** 2026-08-11

**Files:**
- `terminal-v1.24.1.html` — this is the file to open.
- `ios-engine-v1.24.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-24-1.zip` with `CHANGELOG-v1.24.1.md`.

**Reported:** the last 3 steps of 7.1 (default gateway, DNS server,
domain name) asked the student to configure these without ever
stating what value to actually type — asked whether this was
intentional, testing whether a student "should know" the value some
other way.

**Investigated against the ground-truth reference this exercise was
built from:** confirmed the reference material's own instruction text
DOES include the specific values (192.168.10.1 for both, ccna-lab.com
for the domain) directly in each step — this project's exercise had
been consistent about stating exact values for the first four steps
(excluded-address range, pool name, network/mask) but the last three
steps dropped them, an inconsistency introduced when the exercise was
originally written, not a deliberate design choice. There is no CCNA
concept served by withholding these specific values — the step is
about practicing the `default-router`/`dns-server`/`domain-name`
syntax itself, not inferring an address from context.

**Fixed:** all three steps now explicitly state the value to type,
matching the exact wording style already used for the earlier steps
in this same exercise (e.g. "Set the default gateway to 192.168.10.1
— the router's own interface on this network").

**Full regression:** confirmed the exercise still completes correctly
end-to-end.

**Test commands for this version:**
1. Start **Course 2 · SyntxChk · 7.1 — Configure DHCPv4** fresh —
   confirm the default gateway, DNS server, and domain name steps now
   each state the specific value to type, not just the general
   instruction.
2. Complete the exercise fully — confirm nothing else changed.

---

## v1.25.0 — Course 2: 7.2 DHCP Relay + 14.3 Basic Router Config Review; generalized the interface-space regex; fixed a real command-collision bug

**Date:** 2026-08-11

**Files:**
- `terminal-v1.25.0.html` — this is the file to open.
- `ios-engine-v1.25.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-25-0.zip` with `CHANGELOG-v1.25.0.md`.

**Ground truth obtained:** a real, exact Packet Tracer capture of
`show ip interface <name>` (a genuinely long, 28-line report, mostly
fixed boilerplate reflecting default/disabled feature states) —
confirmed the real router (a Cisco 2911) rejected 3-segment interface
naming (`gigabitEthernet 0/0/0` → `%Invalid interface type and
number`), using 2-segment naming instead, consistent with this
project's established pattern of matching each real capture's own
device model rather than forcing one universal naming scheme.

**Added — `ip helper-address <ip>`** (interface_config) — DHCP relay,
forwards client broadcasts as unicast to a server on another subnet.

**Added — `show ip interface <name>`**, verified EXACTLY against the
real capture (character-for-character match). Only the state line,
addresses, and a conditional "Helper address" line reflect real
tracked state; the remaining ~24 lines are fixed boilerplate matching
the capture exactly, since none of those settings are configurable in
any exercise built so far.

**Fixed — real bug found in testing: adding `show ip interface
<name>` silently broke the EXISTING `show ip interface brief`
command.** Both command shapes match the same 4-token input
(`show`,`ip`,`interface`,`brief`) — one via an exact literal 4th
token, the other via a wildcard `<name>` slot — and the command
execution loop had never had any "prefer the more specific match"
logic; it simply returned whichever command happened to appear FIRST
in the `COMMANDS` array, which had worked by pure insertion-order
luck until now. Fixed properly: the execution loop now collects ALL
matching command shapes first, then prefers the one with the FEWEST
wildcard tokens — a literal match beats a wildcard claiming the same
words, matching intuitive behavior rather than depending on array
order. Verified: `show ip interface brief` and `show ip interface
GigabitEthernet0/0/0` both now route correctly to their own separate
handlers.

**Generalized, per the note left in v1.18.0's changelog about this
being "a recurring pattern":** the interface-space-normalization
regex had accumulated THREE separate copy-pasted special cases across
past versions (`interface <Type> <slot>`, `show interfaces <Type>
<slot> [trunk]`, `show port-security interface <Type> <slot>`), each
added when a new command needed the same space-collapsing fix. Adding
`show ip interface <name>` would have been a fourth. Replaced all
three with ONE general regex matching any command ending in
"<phrase containing interface/interfaces> <Type> <slot/port>[.subif]
[trailing word]" — verified it correctly handles all 5 known real
cases (the 3 original plus the new `show ip interface` case) with
identical output to the old special-cased versions, and correctly
still excludes `interface vlan <id>` (which must keep its own
existence-checking logic, unaffected by this regex).

**Added — Module 7.2 and 14.3 exercises**, both sourced exactly from
the ground-truth reference: "Course 2 · SyntxChk · 7.2 — Configure a
DHCP Relay Agent" (5 steps) and "Course 2 · SyntxChk · 14.3 — Basic
Router Configuration Review" (13 steps, confirmed needing ZERO new
engine capability — every command already existed). Both inserted in
correct numeric order (7.2 after 7.1 before 11.1; 14.3 after 11.1
before 15.4).

**Course 2 status: 12 of 14 Syntax Checkers now built** (only the
DHCPv6 pair, 8.2/8.3, remain).

**Full regression:** all 22 exercises pass cleanly, including
confirming the collision fix didn't break any of the many existing
exercises that use `show ip interface brief`.

**Test commands for this version — recommend more than usual, since
this touched shared command-matching logic used by every exercise:**
1. Complete **Course 2 · SyntxChk · 7.2 — Configure a DHCP Relay
   Agent** fully — confirm `show ip interface GigabitEthernet 0/0/0`
   shows the full detail report with "Helper address is 192.168.11.5".
2. Complete **Course 2 · SyntxChk · 14.3 — Basic Router Configuration
   Review** fully.
3. In Free Practice, `show ip interface brief` — confirm this STILL
   shows the short summary table, not the new long detail report
   (this was the exact bug found and fixed this version).
4. `show ip interface <any configured interface name>` (not "brief")
   — confirm it shows the new long detail report.
5. Re-run **17.5 — Verify Directly Connected Networks** and **10.2 —
   Configure Router Interfaces** fully — both exercise `show ip
   interface brief` heavily and would have been directly broken by
   the collision bug if it weren't fixed.
6. `show interfaces FastEthernet 0/1 trunk` and `show port-security
   interface FastEthernet 0/1` (from 3.3/11.1) — confirm both still
   work correctly after the regex generalization replaced their old
   individual special cases.

---

## v1.25.1 — Bug fix: Tab completion for interface types generalized (fourth recurrence, now fixed for good)

**Date:** 2026-08-11

**Files:**
- `terminal-v1.25.1.html` — this is the file to open.
- `ios-engine-v1.25.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-25-1.zip` with `CHANGELOG-v1.25.1.md`.

**Bug reported: `show ip interface gigabitethernet 0/0/0` + Tab did
not complete the interface type.** Confirmed and reproduced directly:
`show ip interface g` + Tab returned nothing.

**Root cause: the interface-type Tab-completion special case had the
exact same "recurring pattern" problem already flagged and partially
fixed for the SPACE-COLLAPSING regex back in this same version
(v1.25.0) — but this is a DIFFERENT piece of logic (type-name
completion, not space normalization) that had NOT yet been
generalized.** It had been patched at specific token positions three
separate times across past versions (`interface <Type>` at position 1
in v1.9.1/v1.12.0, `show interfaces <Type>` at position 2 in v1.11.1),
and the newly-added `show ip interface <Type>` (position 3, added
earlier in v1.25.0) was never added as a fourth special case.

**Fixed properly this time — generalized rather than patched again:**
replaced the position-specific checks with one rule that matches ANY
prior-token sequence whose LAST word is "interface" or "interfaces",
regardless of length or what precedes it. Verified all three
previously-working cases still work identically, and the new `show ip
interface <Type>` case now works too — without needing a fourth
special case, and without needing a fifth if another such command is
added later.

**Investigated, could not reproduce: `show ip interface brief`
reportedly printing "Building configuration...\n[OK]" (the output of
a preceding `copy` command) instead of the actual interface table.**
Traced through the exact reported sequence directly in the engine —
`copy running-config startup-config` correctly clears its pending-
prompt state, and `show ip interface brief` immediately afterward
correctly returns the real table, not stale copy output, in every
test performed. Reviewed the UI-layer submit handler for both Guided
and Free Practice paths and found no code path that could attach one
command's output to a different command's prompt echo. Not dismissed
as impossible, but no reproducible cause was found this session — if
it happens again, the exact sequence of keystrokes (including any Tab
presses or corrections) immediately beforehand would help pin it
down, since it wasn't reproducible from the transcript text alone.

**Full regression:** all 22 exercises pass cleanly.

**Test commands for this version:**
1. `show ip interface g` + Tab — confirm it now completes to `show ip
   interface GigabitEthernet` (this was the exact reported bug).
2. `interface g` + Tab, `show interfaces g` + Tab — confirm both still
   work exactly as before (regression check on the generalization).
3. Re-run **10.2**, **17.5**, **3.3**, and **11.1** fully — these
   exercise the three other `show`/`interface` commands most heavily
   and would reveal any regression from this generalization.
4. If the `show ip interface brief` issue happens again: please note
   the exact commands typed immediately before it, including any Tab
   presses, so it can be reproduced and fixed directly.

---

## v1.25.2 — 7.2's verification step now shows a realistic, working interface

**Date:** 2026-08-11

**Files:**
- `terminal-v1.25.2.html` — this is the file to open.
- `ios-engine-v1.25.2.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-25-2.zip` with `CHANGELOG-v1.25.2.md`.

**Noted from real testing:** 7.2's ground-truth script (matching a
real lab that assumes the interface was already addressed in an
earlier part of that same lab) never included `ip address`/`no
shutdown` steps, so completing this exercise on its own showed a
technically-correct-but-inactive interface — `administratively down,
line protocol is down (disabled)` with `Internet protocol processing
disabled` — even though the exercise passed and the helper-address
line was correctly present.

**Fixed, per direction — made the exercise self-contained and
realistic:** added two steps (assign 192.168.10.1/24, then `no
shutdown`) before the helper-address step, so the final verification
now shows a genuinely up, addressed interface — `is up, line protocol
is up (connected)` with a real `Internet address` line — the same
kind of realistic result you'd see completing the real multi-part
lab this Syntax Checker is based on. Exercise grew from 5 steps to 7.

**Full regression:** all 22 exercises pass cleanly.

**Test commands for this version:**
1. Complete **Course 2 · SyntxChk · 7.2 — Configure a DHCP Relay
   Agent** fully — confirm it's now 7 steps, including assigning an
   IP address and enabling the interface before the helper-address
   step.
2. `show ip interface GigabitEthernet 0/0/0` at the end — confirm it
   now shows "is up, line protocol is up (connected)" with a real
   Internet address line, not an administratively-down interface.

---

## v1.26.0 — New in Free Practice: Setup Checklist reference panel + Router/Switch device-type selector

**Date:** 2026-08-11

**Files:**
- `terminal-v1.26.0.html` — this is the file to open.
- `ios-engine-v1.26.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-26-0.zip` with `CHANGELOG-v1.26.0.md`.

**Source material:** a router/switch setup checklist PDF the person
created in a separate conversation — a 4-phase planning/build/verify
checklist plus copy-paste-style router and switch config templates.

**Design confirmed before building:** this is explicitly a REFERENCE,
not something Free Practice checks or grades — Free Practice remains
fully open-ended; the checklist is a "did I forget anything?" guide
alongside it, matching how the PDF itself describes its own purpose.

**Added — "Setup Checklist" button**, Free Practice only (next to
Reset exercise/Reset device, hidden entirely in Guided Practice since
that mode already has its own instruction/hint system serving the
same purpose). Toggles a reference panel containing BOTH sections
from the PDF, per direction: the Phase 1-4 planning/build/verify
checklist AND the two fill-in-the-blank Router/Switch config
templates — with a note clarifying the templates are for reference
only, since typing commands individually (not bulk-pasting a
template block) is how this tool's exercises and grading are
actually designed to work.

**Added — a Router/Switch device-type selector, Free Practice only.**
Design question worked through before building: should switching
device type try to preserve partial state (hostname, passwords) or
reset cleanly? Chosen: switching ALWAYS resets the device to a fresh
instance of the newly-selected type — deliberate and clearly
communicated (a message appears confirming the switch), rather than
attempting a partial-state-preservation that would be confusing given
a router and switch have fundamentally different physical interface
inventories. This mirrors "Reset device" already resetting
unconditionally; the type selector is really "Reset device, but as a
different type." "Reset device" itself now also respects whichever
type is currently selected, rather than always defaulting to router.

**Noted honestly, not treated as a new bug:** since device state is
shared across all CLI modes by design (established back in v1.1.0),
selecting "Switch" in Free Practice and then switching to Guided
Practice means Guided Practice's shared device is now switch-typed
until reset again. Verified this doesn't actually break router-style
Guided exercises structurally (interface names outside a device's
fixed inventory still work via the existing generic fallback,
confirmed directly), but is still worth knowing — resetting the
device (or switching back to Router) before starting a router-focused
Guided exercise, if you'd been using Free Practice's switch mode, is
the safe habit.

**Full regression:** all 22 exercises pass cleanly; confirmed no
impact from the new HTML/CSS additions.

**Test commands for this version:**
1. Switch to Free Practice — confirm "Setup Checklist" button and a
   "Device:" dropdown (Router/Switch) now appear, and confirm BOTH
   disappear when you switch to Guided Practice.
2. Click "Setup Checklist" — confirm it shows both the 4-phase
   checklist AND the two config templates, and toggles closed again
   when clicked a second time.
3. Select "Switch" in the Device dropdown — confirm the terminal
   resets with a message, and the device now behaves like a switch
   (e.g. `show vlan brief` should work correctly).
4. Select "Router" again — confirm it resets back to a router
   correctly.
5. Click "Reset device" while "Switch" is selected — confirm it
   creates a fresh SWITCH (not silently reverting to router).
6. After using Free Practice's Switch mode, switch to Guided Practice
   and try a router-based exercise (e.g. 10.2) — confirm it's still
   usable (may want to Reset device first for a clean start, per the
   note above).

---

## v1.26.1 — New: warning when a Guided exercise's expected device type doesn't match the shared device

**Date:** 2026-08-11

**Files:**
- `terminal-v1.26.1.html` — this is the file to open.
- `ios-engine-v1.26.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-26-1.zip` with `CHANGELOG-v1.26.1.md`.

**Raised proactively, before the person had tested v1.26.0's new
Router/Switch selector:** since v1.26.0 made it possible to leave the
shared device switch-typed via Free Practice, should something warn
if that carries into a Guided exercise that expects a router (or vice
versa)?

**Design decided before building — where to actually place the
warning:** considered warning at the moment of SELECTING a type in
Free Practice, but rejected that — it would fire regardless of
whether it turns out to matter for whatever the person does next.
Chosen instead: warn specifically when ENTERING/SELECTING a Guided
exercise whose real device type doesn't match the shared device's
current type — the exact moment the mismatch actually becomes
relevant.

**Added — real `deviceType` tracking per exercise**, replacing an
initially-considered but rejected shortcut (guessing from whether the
word "Switch" appears in the module label) after checking it against
the actual exercise list and finding it genuinely unreliable — e.g.
"2.7 — Configure a Switch Virtual Interface" mentions "Switch" but
that's a coincidental match, while "3.3 — Configure 802.1Q Trunk
Links" is switch-based but never says so, and "14.3 — Basic Router
Configuration Review" says "Router" correctly. Built the honest
version instead: tagged the 9 exercises that are genuinely
switch-based (2.2, 2.4, 2.7, 2.8, 1.1, 1.3, 3.2, 3.3, 11.1 — verified
directly, since each configures only a Vlan1/switchport-family
interface with no 3-segment router interface names) with a real
`deviceType: "switch"` field; everything else correctly defaults to
router.

**Added — the warning itself**: fires when switching to Guided
Practice, or selecting a different module while already in Guided
Practice, if the exercise's real device type doesn't match the
device's current type. States plainly what's expected, what the
device currently is, and suggests "Reset device" as the fix — doesn't
block anything or force a reset, since the mismatch doesn't always
actually cause a problem (confirmed back in v1.26.0's testing that
router-named interfaces still work on a switch-typed device via the
generic interface fallback).

**Full regression:** all 22 exercises pass cleanly — the new
`deviceType` field is purely informational for the warning and is
never consulted by the actual grading logic.

**Test commands for this version:**
1. In Free Practice, select "Switch" from the Device dropdown.
2. Switch to Guided Practice with a ROUTER-flavored exercise selected
   (e.g. 10.2) — confirm a note appears explaining the mismatch and
   suggesting "Reset device."
3. Click "Reset device" — confirm the note's suggestion works and a
   normal router device is created.
4. Select a SWITCH-flavored exercise (e.g. 3.2) while the device is
   still a router — confirm the same kind of note appears, this time
   the other direction.
5. With the device type correctly matching the exercise, switch
   between Guided exercises normally — confirm no note appears when
   there's no mismatch.

---

## v1.26.2 — Bug fix: "Reset device" ignored practice mode, kept creating a switch in Guided Practice

**Date:** 2026-08-11

**Files:**
- `terminal-v1.26.2.html` — this is the file to open.
- `ios-engine-v1.26.2.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-26-2.zip` with `CHANGELOG-v1.26.2.md`.

**Bug reported:** after selecting "Switch" in Free Practice, switching
to Guided Practice on a router exercise (10.2) and clicking "Reset
device" still produced a switch, not a router.

**Root cause:** "Reset device" always read `freeDeviceTypeSelect`'s
value directly, with no check for which practice mode was actually
active. That dropdown keeps whatever it was last set to even while
hidden in Guided Practice (a hidden `<select>` doesn't clear its own
value) — so any leftover "Switch" selection from an earlier Free
Practice session silently carried into every future "Reset device"
click, including from Guided Practice, which has no device-type
concept of its own at all.

**Fixed:** "Reset device" now only honors the Free Practice selector
while genuinely in Free Practice (`practiceMode === "free"`); from
Guided Practice it always resets to a plain router, matching its
correct behavior from before v1.26.0 introduced the selector.
Verified directly: resetting from Guided Practice with a leftover
"switch" selection now correctly produces a router; resetting from
Free Practice with "Switch" actually selected still correctly
produces a switch.

**Full regression:** confirmed no impact on existing exercises.

**Test commands for this version:**
1. Free Practice → select "Switch" → switch to Guided Practice on a
   ROUTER exercise (e.g. 10.2) → click "Reset device" — confirm it
   now correctly creates a ROUTER, not another switch (this was the
   exact reported bug).
2. Free Practice → confirm "Reset device" there still correctly
   respects whichever type is selected in the dropdown.
3. After the fix in test 1, confirm the device-type-mismatch warning
   (from v1.26.1) does NOT appear, since the device now correctly
   matches the exercise.

---

## v1.27.0 — Course 2 complete: 8.2 Stateless DHCPv6 + 8.3 Stateful DHCPv6 (real prompt correction verified)

**Date:** 2026-08-11

**Files:**
- `terminal-v1.27.0.html` — this is the file to open.
- `ios-engine-v1.27.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-27-0.zip` with `CHANGELOG-v1.27.0.md`.

**Ground truth obtained:** the person captured a real Packet Tracer
sequence entering `ipv6 dhcp pool` — confirmed the real prompt is
`(config-dhcpv6)#`, NOT `(config-dhcp)#` as this project's own
ground-truth reference data had shown (an apparent error in the
reference itself, since it used the same prompt text as the IPv4 DHCP
pool mode). Also confirmed via the same session that this project's
existing Tab-completion behavior (each Tab press echoes the
in-progress line on its own new line; Enter submits and executes the
fully-assembled line) matches real Packet Trace's own behavior
exactly — good independent confirmation of work done back in
v1.9.0/v1.10.1.

**Added — new mode: `ipv6_dhcp_pool_config`**, entered via `ipv6 dhcp
pool <name>` (auto-creates the pool if new, same pattern as `vlan
<id>` and the IPv4 `ip dhcp pool`), prompt `(config-dhcpv6)#` —
verified correct against the real capture, deliberately DIFFERENT
from the IPv4 pool's `(dhcp-config)#` prompt (both verified against
real captures, in v1.24.0 and this version respectively) — confirmed
these are genuinely two separate, non-colliding prompts in real IOS,
not a single shared one.

**Added commands:** `ipv6 dhcp pool <name>` (global_config);
`address prefix <ipv6>/<len>`, `dns-server <ipv6>`, `domain-name
<name>` (all ipv6_dhcp_pool_config — confirmed the pool-scoped
`dns-server`/`domain-name` correctly coexist with their IPv4-pool and
global-config namesakes with no collision, since mode filtering keeps
them separate); `ipv6 nd other-config-flag` and `ipv6 nd
managed-config-flag` (interface_config, the O-flag/M-flag for
stateless vs. stateful DHCPv6); `ipv6 dhcp server <pool-name>`
(interface_config, binds a pool to an interface).

**No new `show` command needed** — neither exercise's real
ground-truth script includes a verification `show` command (both end
at `end`), which also meant no new rendering/column-width risk for
this pair, unlike most previous DHCP-family work.

**Added — both new pool types and interface flags to `show
running-config`, `snapshotConfig`/`applyConfigSnapshot`, and the
"no startup-config" boot/`hasUnsavedChanges` comparator paths**,
proactively this time (not found as a gap after the fact) — following
the exact pattern established for every other piece of new device
state so far in this project.

**Added — Module 8.2 and 8.3 exercises**, both sourced exactly from
the ground-truth reference (with the corrected real prompt).
Verified end-to-end: both complete all 11 steps correctly, and `show
running-config` correctly renders the pool blocks and interface flags
in sensible order.

**Course 2 status: all 14 of 14 Syntax Checkers now built.** Course 2
is complete — next up per the established plan is Course 3's OSPF
cluster (4 checkers), the largest single remaining investment,
followed by ACLs and NAT.

**Full regression:** all 24 exercises pass cleanly.

**Test commands for this version:**
1. Complete **Course 2 · SyntxChk · 8.2 — Configure Stateless
   DHCPv6** fully — confirm the prompt reads `(config-dhcpv6)#` while
   inside the pool, not `(dhcp-config)#`.
2. Complete **Course 2 · SyntxChk · 8.3 — Configure Stateful
   DHCPv6** fully.
3. `show running-config` after completing 8.3 — confirm the
   `ipv6 dhcp pool R1-STATEFUL` block shows `address prefix`,
   `dns-server`, and `domain-name` in that order, and the interface
   block shows `ipv6 nd managed-config-flag` and `ipv6 dhcp server
   R1-STATEFUL`.
4. Configure BOTH an IPv4 DHCP pool (7.1) and an IPv6 DHCP pool (8.2
   or 8.3) on the same device in Free Practice — confirm both pools'
   `dns-server`/`domain-name` settings stay correctly separate (no
   cross-contamination between the two pool types).
5. `copy running-config startup-config`, then `reload` confirming —
   confirm the IPv6 DHCP pool and interface flags survive correctly.

---

## v1.28.0 — Subnetting Phase 2: Full Subnet Calculation (4-field, difficulty toggle)

**Date:** 2026-08-11

**Files:**
- `terminal-v1.28.0.html` — this is the file to open.
- `ios-engine-v1.28.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-28-0.zip` with `CHANGELOG-v1.28.0.md`.

**Confirmed before building** (this was Phase 2 of the original
Subnetting plan from back in v1.20.0, never built until now): the
core skill — given an IP + CIDR, compute Network Address, Broadcast
Address, First Usable Host, and Last Usable Host together — using the
same Magic Number method already taught in Phase 1.

**Added — new "Full Subnet Calc" category**, 6th button in
Subnetting's category row. Per direction, uses 4 separate blank
fields (Network/Broadcast/First Host/Last Host) rather than a single
text answer, checked as a set — all-or-nothing for scoring purposes
(consistent with every other Subnetting category), but each field is
still individually marked correct/wrong so a student can see exactly
which values they got right even on a failed attempt.

**Added, per direction — a CIDR-range difficulty toggle**, specific to
this category: "Common (/24–/30)" (the narrow, host-scarce range
students see most often on the real exam) and "All (/1–/30)" (the
full range, excluding /31-/32 which have no usable host range at all
— same convention already used for Magic Number). Switching ranges
starts a fresh problem immediately.

**Verified the underlying math independently before wiring up the
UI** (no browser available in this environment): confirmed block-size
and boundary calculations exactly against a manual /26 example
(192.168.1.64/26 → network .64, broadcast .127, first host .65, last
host .126), and confirmed the random block-selection logic produces a
properly ALIGNED network boundary (not an arbitrary IP) across the
full range from /1 through /30.

**Added, per direction — hint text refers back to the Magic Number
category** rather than re-explaining subnetting from scratch, since
that's the method this calculation is built on and the explainer
already lives in this same panel.

**Full regression:** all 24 CLI exercises confirmed unaffected —
this work was isolated entirely to the Subnetting panel's own HTML/
CSS/JS.

**Known limitation — could not be tested in a live browser.** Same
caveat as every previous Subnetting UI change in this project: the
underlying calculation logic was verified thoroughly via direct
testing, and the HTML/CSS follows the same patterns as the
already-working Phase 1 categories, but real in-browser testing of
the 4-field grid, the difficulty toggle, and the per-field correct/
wrong styling is still needed.

**Test commands for this version:**
1. In Subnetting, click "Full Subnet Calc" — confirm a difficulty
   toggle appears (Common/All) and the question shows an IP + CIDR
   with 4 blank input fields below it.
2. Fill in all 4 fields correctly for a given problem — confirm it's
   marked correct and a new problem loads automatically.
3. Fill in 3 correct and 1 wrong — confirm the wrong field is
   outlined in a different color than the correct ones, and the
   overall attempt is marked wrong (not partial credit).
4. Click "Hint" — confirm it references the Magic Number method
   rather than re-teaching subnetting from scratch.
5. Switch between "Common" and "All" — confirm "Common" only
   generates /24–/30 problems, while "All" can generate anything from
   /1 to /30.
6. Switch to a different category (e.g. CIDR ↔ Mask) and back to
   "Full Subnet Calc" — confirm the difficulty toggle correctly
   hides/reappears only for this category.

---

## v1.28.1 — Full Subnet Calc: added a "Private ranges only" difficulty option

**Date:** 2026-08-11

**Files:**
- `terminal-v1.28.1.html` — this is the file to open.
- `ios-engine-v1.28.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-28-1.zip` with `CHANGELOG-v1.28.1.md`.

**Question raised:** does CCNA/Network+ normally subnet PUBLIC
addresses (e.g. 116.120.216.2/28), or is this typically done on
private ranges only?

**Investigated before building — checked both the underlying math and
real exam-practice convention.** Confirmed via Professor Messer's own
material that subnetting math is genuinely address-agnostic — he uses
a real public block (208.130.28.0/22, a real historical MCI
allocation) as a teaching example in one lesson. However, checking
several real CCNA 200-301 practice question sources showed the actual
EXAM CONVENTION consistently favors private/lab-realistic addressing
scenarios (192.168.x.x, 10.x.x.x, private point-to-point /30 links) —
confirming the person's instinct was right for practical exam-prep
reasons, even though it's not a strict mathematical rule.

**Added, per direction — a third difficulty option: "Private ranges
only."** Restricts generated problems to genuine subnets OF the three
real RFC 1918 blocks (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16) —
implemented correctly as an actual sub-block of one of these three
real ranges (verified directly: 2,000 generated problems all
confirmed genuinely private and correctly block-aligned), not just
biased random octets that happen to start with a private-looking
number.

**Full regression:** all 24 CLI exercises confirmed unaffected.

**Known limitation, same as v1.28.0 — could not be tested in a live
browser.** The generation logic was verified thoroughly via direct
testing (2,000-trial confirmation), but real in-browser testing of
the third button's appearance/behavior is still needed.

**Test commands for this version:**
1. In Full Subnet Calc, confirm a THIRD button now appears: "Private
   ranges only", between "Common" and "All".
2. Select it and generate several new problems — confirm every
   generated network genuinely starts within 10.x.x.x, 172.16-31.x.x,
   or 192.168.x.x (not just any address that happens to look private).
3. Confirm switching back to "Common" or "All" still works exactly as
   before.

---

## v1.29.0 — Course 3 begins: OSPF cluster (2.1, 2.3, 2.4, 2.6) with simulated neighbor adjacency

**Date:** 2026-08-11

**Files:**
- `terminal-v1.29.0.html` — this is the file to open.
- `ios-engine-v1.29.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-29-0.zip` with `CHANGELOG-v1.29.0.md`.

**Ground truth obtained:** a real router capture (`show ip ospf
neighbor`, `show ip protocol`, `show ip ospf interface` — rejected,
revealing 2-segment naming on that specific router model — and `show
ip route` with real `O`/`O*E2` entries), plus the full Course 3
ground-truth reference data for all 4 OSPF Syntax Checkers. The real
capture also revealed `show run | begin ...` is rejected on this
router/IOS combination — logged as a separate, real backlog item
(pipe/filter support), out of scope for this version.

**Added — new `router_config` mode**, entered via `router ospf
<process-id>` (auto-creates the process, prompt `(config-router)#`).
Commands: `router-id`, `network <net> <wildcard> area <n>` (with real
wildcard-mask matching — an interface is "OSPF-enabled" only if its
IP genuinely falls within the network/wildcard range, verified
directly), `passive-interface`, `auto-cost reference-bandwidth`.
Per-interface: `ip ospf priority`, `ip ospf hello-interval`, `ip ospf
dead-interval`, `ip ospf message-digest-key ... md5 ...`, `ip ospf
authentication message-digest`.

**Added — simulated neighbor adjacency**, consistent with this
project's established approach (DHCP pools, port security, etc.):
since there's no second real device to form a genuine OSPF
relationship with, a plausible, DETERMINISTIC (not random — stays
stable across repeated show commands) neighbor is shown once an
interface is genuinely OSPF-enabled. Point-to-point (Serial)
interfaces get "FULL/  -" (no DR/BDR concept); multiaccess (Ethernet)
interfaces get a real DR/BDR outcome based on this router's own
configured priority. This is a plausibility check on the
CONFIGURATION, not a real routing simulation — same teaching
philosophy as everywhere else in this project.

**Added and verified EXACTLY against the real capture:**
- `show ip ospf neighbor` — confirmed column positions (State at 22,
  Dead Time at 38, Address at 50, Interface at 66) using ABSOLUTE
  positions rather than fixed spacing after the ID, so it stays
  correct regardless of neighbor ID length.
- `show ip protocol` (singular — confirmed via the real capture
  rejecting "protocols") — exact Gateway/Distance column alignment
  (110 at column 25).
- `show ip ospf interface <name>` — built from the Course 3
  ground-truth reference (a real capture wasn't available for a
  SUCCESSFUL query on this project's own router model), correctly
  distinguishing point-to-point (no DR/BDR lines at all) from
  multiaccess (shows State DR/BDR/DROTHER and a Designated Router
  line when this router wins the simulated election).

**Added — `show ip ospf` (process summary) and `show ip route ospf`
(filtered routing table)**, both new commands discovered from the
Course 3 ground-truth data, not in the original capture. `show ip
route ospf` uses a deliberately simpler flat format (no "variably
subnetted" grouping, a short "Codes: O - OSPF" line) — confirmed via
the reference data this is genuinely different from bare `show ip
route`'s format, not just a filtered version of it.

**Added — real `O`/`O*E2` route support in `show ip route`**: OSPF
routes (AD 110) now participate in the same admin-distance-based
route selection as connected/static routes, correctly losing to any
lower-AD route to the same destination. Verified the existing
"variably subnetted vs. subnetted" classful grouping logic (built for
static routes) correctly extends to include OSPF routes without
requiring changes to that logic.

**Real bug found and fixed while building the exercises**: the
Course 3 ground-truth reference for 2.4 has "router ospf 10" as a
step directly from `(config-if)#` with no `exit` first — confirmed
via multiple Cisco documentation sources that `router ospf` is
strictly a global-config-mode command and cannot be entered from
interface config mode in real IOS. Rather than replicate what appears
to be an error in the reference data, added the correct `exit` step
that real IOS actually requires.

**Generalized the interface-space regex a third time** (previously
generalized in v1.25.0 and further in v1.25.1's Tab-completion fix):
a new command shape (`show ip ospf interface <Type> <slot>`) didn't
match the v1.25.0 version's fixed list of known prefixes. Replaced
with a truly prefix-agnostic version matching ANY text ending in
"interface"/"interfaces" — verified against all 6 known real cases,
correctly future-proof against any similarly-shaped command added
later without needing another change here.

**Added — `show running-config` support** for the OSPF process block
(position verified against the real capture: right after interfaces,
before static routes) and per-interface OSPF settings (MD5 key,
priority, hello/dead intervals, matching the "only show if non-
default" pattern used throughout this project). Added OSPF state to
`snapshotConfig`/`applyConfigSnapshot` and both reset paths,
proactively (not found as a gap afterward).

**Added — 4 exercises**: "Course 3 · SyntxChk · 2.1 — Configure
OSPFv2 on Point-to-Point Networks" (10 steps), "2.3 — Configure
OSPFv2 on Multiaccess Networks" (10 steps), "2.4 — Modify OSPFv2:
Timers and Authentication" (9 steps, includes the corrected `exit`
step), "2.6 — Verify Single-Area OSPFv2" (5 steps, pure verification,
assumes OSPF already configured). All verified end-to-end.

**Course 3 status: 4 of 14 built.** ACLs are next per the established
plan (needed by NAT afterward).

**Full regression:** all 28 exercises pass cleanly.

**Test commands for this version — recommend more than usual, given
the real complexity of neighbor simulation and DR/BDR logic:**
1. Complete **2.1 — Point-to-Point** fully — confirm `show ip ospf
   neighbor` shows a plausible neighbor with "FULL/  -" state (no
   DR/BDR), and `show ip route ospf` shows a simulated O route.
2. Complete **2.3 — Multiaccess** fully — confirm `show ip ospf
   interface` shows "State DR" and a "Designated Router (ID)" line,
   since priority 255 should make this router win the simulated
   election.
3. Complete **2.4 — Modify OSPFv2** fully — confirm the corrected
   `exit` step is required (typing `router ospf 10` directly from
   interface config mode should fail, matching real IOS).
4. Complete **2.6 — Verify** fully — confirm all 5 verification
   commands produce sensible output even though this exercise never
   configures anything itself (it assumes prior configuration).
5. In Free Practice, configure OSPF on a router with BOTH a Serial
   and a GigabitEthernet interface — confirm `show ip route` groups
   the resulting O routes correctly alongside connected/static
   routes, with OSPF (AD 110) correctly losing to any lower-AD route
   to the same destination.
6. `show running-config` after configuring OSPF with MD5
   authentication and a non-default priority — confirm the OSPF
   process block and the per-interface OSPF settings both appear
   with correct values.
7. Re-run several PRE-EXISTING exercises that use `show interfaces`,
   `show port-security interface`, or `show ip interface` variants
   (e.g. 3.3, 11.1, 7.2) — confirming the third regex generalization
   didn't disturb any of them.

---

## v1.30.0 — Course 3: 5.2 Configure Numbered Standard ACLs (verified exactly against a real capture)

**Date:** 2026-08-11

**Files:**
- `terminal-v1.30.0.html` — this is the file to open.
- `ios-engine-v1.30.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-30-0.zip` with `CHANGELOG-v1.30.0.md`.

**Ground truth obtained:** a real router capture of `show
access-lists` and `show ip interface <name>` with a standard ACL
configured and applied. Revealed a real correction to this project's
own ground-truth reference: the reference text showed ACL entries
displayed with a "wildcard bits" phrase (`permit 192.168.20.0,
wildcard bits 0.0.0.255`); the real capture shows NO such phrase
(`permit 192.168.20.0 0.0.0.255`) — the real capture was trusted over
the reference text.

**Added — numbered standard ACLs**: `access-list <1-99> permit|deny
host <ip>` and `access-list <1-99> permit|deny <network> <wildcard>`
(global_config, handled as a special case since the two forms have
different token counts), auto-creating the ACL on first use (same
pattern as VLANs/DHCP pools) and auto-numbering entries 10, 20, 30...
in the order added — confirmed exactly against the real capture.

**Added — `ip access-group <number> in|out`** (interface_config),
binding an ACL to an interface in a direction.

**Added — `show access-lists`**, verified EXACTLY against the real
capture (character-for-character match), including the corrected
entry format (no "wildcard bits" phrase).

**Fixed — real bug found while extending `show ip interface
<name>` for the new ACL lines**: the existing "Helper address" line
(built for 7.2's DHCP relay work) was previously OMITTED entirely
when no helper address was configured. This new capture's "no ACL
applied outbound" scenario revealed the correct real behavior is to
ALWAYS show the line, explicitly stating "not set" when unconfigured
— the exact same pattern the new "Outbound access list"/"Inbound
access list" lines needed anyway. Fixed the Helper address line to
match, verified this doesn't regress 7.2 (still passes with the
Helper address correctly shown when configured).

**Added — `show ip interface <name>`'s ACL lines**, verified EXACTLY
against the real capture: "Outgoing access list is &lt;n&gt;" and
"Inbound  access list is &lt;n&gt;" (note the real double space after
"Inbound," confirmed both here and in the original reference data),
both showing "not set" when nothing is bound.

**Added — `show running-config` support** for access-list
definitions (positioned before interfaces, matching real IOS's
natural "define then use" config order, since interfaces reference
ACLs by number) and per-interface `ip access-group` lines. Added ACL
state to `snapshotConfig`/`applyConfigSnapshot` and both reset paths,
proactively, following this project's established pattern.

**Added — Module 5.2 exercise**: "Course 3 · SyntxChk · 5.2 —
Configure Numbered Standard ACLs", 8 steps, sourced from the
ground-truth reference. Verified end-to-end: all 8 steps pass, `show
access-lists` and `show ip interface` both match the real capture
exactly.

**Course 3 status: 5 of 14 built.** Extended ACLs (5.4) are next —
they share the same underlying ACL data model just built, so should
be a smaller addition than this version was.

**Full regression:** all 29 exercises pass cleanly.

**Test commands for this version:**
1. Complete **Course 3 · SyntxChk · 5.2 — Configure Numbered Standard
   ACLs** fully.
2. `show access-lists` after completing — confirm entries show as
   "permit host 192.168.10.10" and "permit 192.168.20.0 0.0.0.255"
   with NO "wildcard bits" phrase, numbered 10 and 20.
3. `show ip interface GigabitEthernet 0/0/0` — confirm "Inbound
   access list is 1" and "Outgoing access list is not set" both
   appear.
4. On a DIFFERENT, unconfigured interface, `show ip interface
   <name>` — confirm "Helper address is not set", "Outgoing access
   list is not set", and "Inbound  access list is not set" ALL appear
   explicitly (none silently omitted).
5. `show running-config` — confirm the `access-list` lines appear
   before the interface blocks, and the interface with the ACL
   applied shows `ip access-group 1 in`.
6. Re-run **7.2 — Configure a DHCP Relay Agent** fully — confirm the
   Helper address line fix didn't break this exercise (it should
   still show "Helper address is 192.168.11.5" once configured).

---

## v1.31.0 — Course 3: 5.4 Configure Named Extended ACLs (well-known port names verified against a real capture)

**Date:** 2026-08-11

**Files:**
- `terminal-v1.31.0.html` — this is the file to open.
- `ios-engine-v1.31.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-31-0.zip` with `CHANGELOG-v1.31.0.md`.

**Ground truth obtained:** a real router capture running the exact
5.4 sequence, including a genuinely useful bonus — the router already
had TWO pre-existing extended ACLs from earlier in that lab, giving
real confirmation of `icmp` (no port) and `host` destination matching
beyond what this project's own exercise needed. Also confirmed a real
mode-checking bug IN THE PERSON'S OWN typed sequence (`ip
access-group SURFING in` correctly rejected from global_config mode,
since they hadn't yet successfully entered interface config) —
consistent with, and validating, this engine's existing mode-checking
behavior.

**Resolved the open question about port name display**: confirmed
port 80 displays as `eq www` in `show access-lists`, while port 443
stays as `eq 443` — NOT every well-known port gets a name, only ones
real IOS has a built-in name for. Implemented a small, confirmed-only
port-name table (ftp-data, ftp, telnet, smtp, domain, tftp, www,
pop3) rather than guessing at a fuller mapping; unmapped ports
(including 443) correctly display as plain numbers, matching the
real capture exactly.

**Added — new mode: `ext_nacl_config`**, entered via `ip access-list
extended <name>` (auto-creates the ACL, prompt `(config-ext-nacl)#`
— confirmed exact against the real capture).

**Added — extended ACL entries**: `permit|deny tcp|udp <src> <dst>
[eq <port> | established]`, with source/destination each independently
parsed as `any`, `host <ip>`, or `<network> <wildcard>` — handled via
careful positional parsing (not a single fixed regex) since each side
can have a different token length depending on which form is used.

**Real bug found and fixed while testing against the capture**: the
existing `renderShowAccessLists` (built for 5.2, standard ACLs only)
inserted a blank line between multiple ACLs — an assumption that had
never actually been checked against a REAL multi-ACL capture. This
new capture's 4 consecutive ACL blocks confirmed there is NO blank
line between them at all. Fixed and verified against the real
4-block sequence.

**Fixed — `show running-config` now correctly distinguishes ACL
types**: standard (numbered) ACLs render as flat `access-list <n>
...` lines; extended (named) ACLs now correctly render as `ip
access-list extended <name>` followed by INDENTED entries — matching
each type's own real config-mode syntax. The existing renderer had
only ever handled the standard/flat form.

**Verified `show ip interface <name>`'s ACL lines correctly display
ACL NAMES** (not just numbers) for both inbound and outbound —
already worked correctly since the underlying field just stores
whatever string was bound, but confirmed directly against the real
capture (`Outgoing access list is BROWSING`, `Inbound  access list is
SURFING`).

**Added — Module 5.4 exercise**: "Course 3 · SyntxChk · 5.4 —
Configure Named Extended ACLs", 12 steps, sourced from the
ground-truth reference. Verified end-to-end: all 12 steps pass, `show
access-lists` matches the real capture exactly (character-for-
character), and standard/extended ACLs coexist correctly with no
cross-contamination.

**Course 3 status: 6 of 14 built. The ACL foundation is now
complete** — NAT (4 checkers) is next, and depends on this work.

**Full regression:** all 30 exercises pass cleanly.

**Test commands for this version:**
1. Complete **Course 3 · SyntxChk · 5.4 — Configure Named Extended
   ACLs** fully.
2. `show access-lists` — confirm port 80 shows as "eq www" and port
   443 shows as "eq 443" (not "eq https"), and confirm there's NO
   blank line between the SURFING and BROWSING blocks.
3. `show ip interface GigabitEthernet 0/0/0` — confirm "Inbound
   access list is SURFING" and "Outgoing access list is BROWSING"
   (names, not numbers).
4. `show running-config` — confirm the ACL blocks show as `ip
   access-list extended SURFING` followed by INDENTED entries (not
   flat `access-list SURFING ...` lines).
5. Configure BOTH a standard numbered ACL (5.2) and a named extended
   ACL (5.4) on the same device — confirm `show access-lists` shows
   both correctly, one "Standard IP access list" and one "Extended IP
   access list", with no cross-contamination.
6. Save, then reload confirming — confirm the extended ACL survives
   correctly.

---

## v1.32.0 — Course 3: NAT cluster complete (6.4 Static, 6.5 Dynamic, 6.6 PAT×2)

**Date:** 2026-08-12

**Files:**
- `terminal-v1.32.0.html` — this is the file to open.
- `ios-engine-v1.32.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-32-0.zip` with `CHANGELOG-v1.32.0.md`.

**Ground truth obtained:** a real router capture of Static NAT
(`show ip nat translations`, `show ip nat statistics`, `show
running-config`), cross-checked against multiple independent
real-lab answer-key sources for Dynamic NAT and PAT. Confirmed
`show ip nat statistics` uses "Outside Interfaces:"/"Inside
Interfaces:" (capital I, plural — this project's own reference data
had shown lowercase), multiple interfaces comma-separated with a
space before the comma, and — critically — that "Total translations"
counts ACTIVE translations, not configured rules (a real capture
showing 2 for two always-active static entries, vs. the reference
data correctly showing 0 for a fully-configured but traffic-free
dynamic NAT rule; both are correct real behavior for their own
scenarios).

**Added — one shared NAT data model for all 4 checkers**: `ip nat
inside`/`ip nat outside` (interface role marking), `ip nat inside
source static <local> <global>` (Static NAT), `ip nat pool <name>
<start> <end> netmask <mask>`, and `ip nat inside source list <acl>
pool <name> [overload]` / `... interface <name> overload` (Dynamic
NAT and both PAT variants, sharing one command shape distinguished by
"pool" vs. "interface" and the optional "overload").

**Added and verified EXACTLY against the real capture: `show ip nat
translations`** (static entries show immediately, "Pro" column shows
"---" for static, character-for-character match) and **`show ip nat
statistics`** (exact phrasing, interface listing format, and the
active-vs-configured distinction described above).

**Real bug found and fixed during testing: "Total translations" was
initially counting configured RULES, not active translations** —
would have shown "1" for a freshly-configured Dynamic NAT rule with
zero real traffic, contradicting the ground-truth reference's
confirmed "0". Fixed to count only genuinely active translations
(static entries, plus simulated PAT-via-interface entries — see
below); Dynamic NAT (pool-based, non-overload) correctly always
shows 0 without simulated traffic, matching real IOS behavior.

**Added — one simulated PAT translation entry**, specifically for
PAT-via-single-interface (not pool-based Dynamic NAT), consistent
with this project's established "no second real device" approach —
the one NAT scenario where the ground-truth reference's own sample
output showed populated translation entries. Found and fixed a real
column-spacing bug here too: the first field's padding was too
narrow for a real IP:port value, producing zero separation before
the next column — recalculated exact widths directly from the
reference's sample row and verified the fix.

**Fixed — real bug found while testing exercise 6.6b (PAT using a
single interface's address): a broader latent gap affecting every
special-case command built since v1.25.0.** The NAT command for
binding an ACL to an interface (`ip nat inside source list 1
interface GigabitEthernet 0/0/0 overload`) failed with "Invalid input
detected" whenever the interface name included a space — because
this special case (and, it turns out, EVERY special case added since
v1.25.0's generic space-collapsing regex, including access-list, ip
access-group, and extended ACL entries) matched against the RAW input
directly rather than the pre-processed "workingLine" that already has
interface-name spaces collapsed. Fixed for the NAT command; the same
latent gap likely affects the others too and is worth a dedicated
pass to confirm and fix broadly.

**Added — `show running-config` support** for NAT: `ip nat pool`/`ip
nat inside source ...` lines positioned right after interfaces
(verified against the real capture), each interface's `ip nat
inside`/`ip nat outside` line positioned immediately after `ip
address` (also verified), and the real trailing-space detail on
static NAT lines preserved exactly as captured.

**Added — 4 exercises**: "6.4 — Configure Static NAT" (8 steps), "6.5
— Configure Dynamic NAT" (10 steps), "6.6 — Configure PAT Using an
Address Pool" (9 steps), "6.6 — Configure PAT Using a Single
Interface Address" (9 steps). All sourced from the ground-truth
reference, verified end-to-end.

**Course 3 status: 10 of 14 built.** Only the 4 small utility
checkers remain (CDP/LLDP, NTP, SNMP, Syslog), planned as two paired
versions per the earlier grouping discussion.

**Full regression:** all 34 exercises pass cleanly.

**Test commands for this version:**
1. Complete **6.4 — Configure Static NAT** fully — confirm `show ip
   nat translations` shows the entry immediately, matching the real
   capture's exact format.
2. Complete **6.5 — Configure Dynamic NAT** fully — confirm `show ip
   nat statistics` shows the pool details but "Total translations: 0"
   (no traffic simulated for pool-based Dynamic NAT).
3. Complete **6.6 (address pool)** fully.
4. Complete **6.6 (single interface)** fully — confirm `show ip nat
   translations` now shows a simulated entry with a port number.
5. Configure BOTH static and dynamic NAT on the same device — confirm
   `show ip nat statistics` correctly reports "(1 static, 0 dynamic,
   0 extended)" or similar, reflecting genuinely active translations.
6. `show running-config` after any NAT exercise — confirm `ip nat
   inside`/`ip nat outside` appear right after each interface's `ip
   address` line, and the NAT source/pool lines appear right after
   all interfaces.
7. Re-run a few pre-existing exercises using `interface <Type>
   <slot>` with a space (e.g. 10.2, 3.3) — confirm the workingLine
   fix didn't disturb any command that was already working correctly.

---

## v1.32.1 — Bug fixes: Tab completion for pipe-separated options; 6.6a/6.6b missing ACL values

**Date:** 2026-08-12

**Files:**
- `terminal-v1.32.1.html` — this is the file to open.
- `ios-engine-v1.32.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-32-1.zip` with `CHANGELOG-v1.32.1.md`.

**Bug reported: `ip nat out` + Tab did not complete.** Confirmed and
diagnosed precisely: `COMMANDS` table entries occasionally use a
pipe-separated token to document multiple valid words in one slot for
help purposes (e.g. `"inside|outside"` for `ip nat inside/outside`,
`"in|out"` for ACL/NAT direction — 7 such entries exist across this
project). Tab-completion's candidate-matching function had never been
taught to treat a pipe-separated token as multiple individually-
completable alternatives — it checked whether the WHOLE string
(`"inside|outside"`) started with the typed partial (`"out"`), which
is false even though "out" is clearly a valid completion for the
"outside" half. Fixed by splitting on "|" and checking each
alternative individually. Verified against all 7 real pipe-separated
cases in the codebase (`ip nat in/out`, `ip access-group in/out`, `ip
nat inside source list pool/interface`, and others) — all now
complete correctly; confirmed no regression on any previously-working
completion.

**Reported: 6.6a and 6.6b's ACL-creation steps never stated the
actual network/wildcard values to type**, unlike 6.4 and 6.5's steps
in the same version, which do state their exact values. Investigated
and confirmed this was the same class of inconsistency found and
fixed once before (7.1's DHCP steps back in v1.24.1) — an oversight
introduced when writing the exercise, not a deliberate design choice.
There's no CCNA concept served by withholding this specific value.

**Fixed:** both steps now explicitly state "the 192.168.0.0/16
private range (wildcard 0.0.255.255)", matching the style already
used elsewhere in this project's exercises.

**Full regression:** all 34 exercises pass cleanly, including
re-confirming 6.6a and 6.6b still complete correctly with the updated
instruction text.

**Test commands for this version:**
1. In Free Practice, type `ip nat out` and press Tab — confirm it now
   completes to `ip nat outside` (this was the exact reported bug).
2. Try a few other pipe-separated completions: `ip access-group 1 i`
   + Tab (should complete to "in"), `ip nat inside source list 1 po`
   + Tab (should complete to "pool") — confirm all work correctly.
3. Start **6.6 — Configure PAT Using an Address Pool** and **6.6 —
   Configure PAT Using a Single Interface Address** fresh — confirm
   the ACL step now states the exact network/wildcard to type.
4. Complete both PAT exercises fully — confirm nothing else changed.

---

## v1.33.0 — Course 3: 10.1 CDP and LLDP + 10.2 Configure NTP (two real captures verified)

**Date:** 2026-08-12

**Files:**
- `terminal-v1.33.0.html` — this is the file to open.
- `ios-engine-v1.33.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-33-0.zip` with `CHANGELOG-v1.33.0.md`.

**Ground truth obtained: TWO real router captures.** The first
(a fresh, disconnected router) confirmed the exact EMPTY-table format
for both `show cdp neighbors` and `show lldp neighbors`, and revealed
`cdp run` never appears in `show running-config` at all (CDP is on by
default; the command exists only to re-enable it after `no cdp run`)
while `lldp run` does appear. A second capture — made by physically
connecting two routers and bringing the link up — confirmed the
POPULATED table format, and revealed CDP and LLDP abbreviate
interface names DIFFERENTLY from each other ("Gig 0/0/0" with a
space for CDP; "Gig0/0/0" no space for LLDP) — a genuinely easy
detail to get wrong without a real capture.

**Added — CDP/LLDP commands**: `cdp run`/`no cdp run` (global_config,
tracks state even though it matches the real default), `lldp run`
(global_config, real default is OFF), `lldp transmit`/`lldp receive`
(interface_config, LLDP is directional — confirmed both must be set
before a simulated neighbor appears in `show lldp neighbors`, unlike
CDP which has no separate transmit/receive toggle).

**Added and verified EXACTLY against both real captures: `show cdp
neighbors`** (empty AND populated formats) **and `show lldp
neighbors`** (same). Found and fixed a real column-width bug during
testing — LLDP's row fields were off by one character in three
places; recalculated exact widths directly from the real capture's
header row and verified all three positions match exactly.

**Added — simulated CDP/LLDP neighbor**, consistent with this
project's established "no second real device" approach — modeled as
a generic switch (matching the ORIGINAL ground-truth reference's own
sample data: "S1", "WS-C2960"), shown once the relevant protocol and
interface conditions are genuinely met.

**Added — NTP commands**: `ntp master <stratum>` and `ntp server
<ip>` (both global_config), `show ntp status` and `show ntp
associations` — built from the ground-truth reference's own detailed
sample output (a real capture wasn't obtained for this pair, but the
reference data was specific and detailed enough to trust directly,
consistent with how this project has handled similarly strong
reference data before).

**Design decision confirmed before building — NTP's exercise
genuinely spans two named devices (R1 and R2) in its own
instructions.** Since this project's Guided/Free Practice has always
been a single shared device, modeled this the same way established
back when similar multi-device narration first came up (10.1/14.3):
the student stays on ONE device throughout, with instruction text
explicitly narrating "now imagine you're on R2" rather than requiring
an actual device switch — the precondition text states this
explicitly so it's not confusing.

**Fixed — a pre-existing gap found while extending the `freshBlank`
comparator for this version's new fields**: `natStaticRules`/
`natPools`/`natDynamicRules` (added back in v1.32.0) had never
actually been added to this comparator, meaning a device with NAT
configured could have incorrectly appeared to have "no unsaved
changes" immediately after a fresh device creation in some edge
cases. Fixed alongside this version's own new fields, following this
project's established pattern of fixing any adjacent gap found along
the way.

**Added — Module 10.1 and 10.2 exercises**: "10.1 — Configure CDP and
LLDP" (9 steps) and "10.2 — Configure NTP" (8 steps, spanning the
narrated R1/R2 scenario). Both sourced from the ground-truth
reference, verified end-to-end.

**Course 3 status: 12 of 14 built.** Only SNMP (10.3) and Syslog
(10.4) remain — planned as the final paired version to complete
Course 3 entirely.

**Full regression:** all 36 exercises pass cleanly.

**Test commands for this version:**
1. Complete **10.1 — Configure CDP and LLDP** fully — confirm `show
   cdp neighbors` shows "Gig 0/0/0" (WITH a space) while `show lldp
   neighbors` shows "Gig0/0/0" (NO space) for the same interface.
2. Complete **10.2 — Configure NTP** fully, including the narrated
   "now imagine you're on R2" step — confirm `show ntp associations`
   shows the configured server with a `*` marker.
3. `show running-config` after 10.1 — confirm `lldp run` appears but
   `cdp run` does NOT, even though both were configured.
4. On a fresh device with CDP/LLDP enabled but the interface still
   shutdown, run `show cdp neighbors`/`show lldp neighbors` — confirm
   BOTH correctly show the empty-table format (no simulated neighbor
   until the interface is actually up).
5. Enable LLDP globally and `no shutdown` an interface, but only run
   `lldp transmit` (not `lldp receive`) on it — confirm `show lldp
   neighbors` still shows 0 entries, since LLDP requires BOTH
   directions.

---

## v1.33.1 — Bug fix: `ntp master`/`ntp server` never appeared in `show running-config`

**Date:** 2026-08-12

**Files:**
- `terminal-v1.33.1.html` — this is the file to open.
- `ios-engine-v1.33.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-33-1.zip` with `CHANGELOG-v1.33.1.md`.

**Bug reported:** after completing 10.2 (Configure NTP), `show
running-config` showed no trace of the configured `ntp server
10.1.1.1` at all.

**Root cause:** `ntpMasterStratum`/`ntpServer` were correctly tracked
in device state and correctly used by `show ntp status`/`show ntp
associations` (both confirmed working in the reported transcript),
and correctly included in save/reload state — but `renderConfigText`
(the function behind `show running-config`) never actually had a
case for either field. A real gap from v1.33.0, not caught at the
time since the exercise's own last step was `show ntp associations`,
not `show running-config`.

**Fixed:** `ntp master <stratum>` and `ntp server <ip>` now render in
`show running-config`, positioned near the end of the config (close
to the line con/vty blocks), matching standard real IOS convention
for NTP configuration placement.

**Also confirmed, while reviewing the reported transcript, that
Guided Practice's grading behavior was working correctly throughout**
— "Not quite" on an out-of-sequence `show ntp status`, and "Exercise
already complete" after finishing, are both intentional, correct
behavior, not bugs.

**Full regression:** all 36 exercises pass cleanly.

**Test commands for this version:**
1. Configure `ntp master 1` and `ntp server 10.1.1.1` in Free
   Practice, then `show running-config` — confirm both lines now
   appear, positioned near the end of the config.
2. Re-run **10.2 — Configure NTP** fully, then check `show
   running-config` — confirm `ntp server 10.1.1.1` appears (this was
   the exact reported gap).

---

## v1.34.0 — Course 3 COMPLETE: 10.3 Configure SNMPv2c + 10.4 Configure Syslog (final pair, 38 of 38 target checkers built)

**Date:** 2026-08-12

**Files:**
- `terminal-v1.34.0.html` — this is the file to open.
- `ios-engine-v1.34.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-34-0.zip` with `CHANGELOG-v1.34.0.md`.

**Investigated whether a Packet Tracer capture was available before
building**: confirmed there is no direct-match, dedicated capture lab
for SNMP or Syslog configuration specifically in this curriculum —
only a large skills-integration challenge combines them with many
unrelated topics. Given the ground-truth reference data for both
commands was unusually detailed and specific (real-looking field
names and structure), proceeded using it directly, consistent with
how strong reference data was already trusted for NTP — clearly
documented in code as NOT independently verified against a live
capture, so it's easy to correct later if one surfaces.

**Added — SNMP commands**: `snmp-server community <string> ro|rw`,
`snmp-server location <text>` / `snmp-server contact <text>` (both
needing rest-of-line handling, like `banner`/`description`, since the
reference confirms multi-word values like "Cisco NetAcad"),
`snmp-server host <ip> version 2c <community>`, `snmp-server enable
traps`. **`show snmp community`** verified character-for-character
against the reference's own sample output.

**Added — Syslog commands**: `logging host <ip>`, `logging trap
<level>`, `logging source-interface <name>` (confirmed `Loopback`
was already a recognized interface type from earlier work, so
`Loopback 0` normalizes correctly with no new code needed — also
needed the interface-space-collapsing fix, matched against
`workingLine` correctly this time, learning from the NAT bug found
in v1.32.0), `service timestamps log datetime msec`. **`show
logging`** built from the reference's detailed sample structure.

**Added — `show running-config` support** for all of the above,
positioned near NTP's own config lines (same "late in the config,
near line con/vty" convention), plus `service timestamps log`
rendered near the top of the config when enabled.

**Learned from two earlier mistakes this session and got both right
proactively this time**: (1) a missing trailing comma in the device-
state object — caught immediately via `node --check` before it went
further, same class of typo that slipped through twice in recent
prior versions; (2) added ALL new fields to `snapshotConfig`,
`applyConfigSnapshot`, the "no startup-config" reset path, AND the
`hasUnsavedChanges` `freshBlank` comparator from the start, rather
than finding a gap in one of them afterward (the NAT/NTP pattern from
the last two versions).

**Added — Module 10.3 and 10.4 exercises**: "10.3 — Configure
SNMPv2c" (9 steps) and "10.4 — Configure Syslog" (7 steps). Both
sourced from the ground-truth reference, verified end-to-end.

**COURSE 3 STATUS: COMPLETE — all 14 of 14 planned Syntax Checkers
built.** Combined with Course 1 (10) and Course 2 (14), this brings
the total Guided/Free Practice Syntax Checker library to 38
exercises. Remaining project scope: the Packet Tracer-style
multi-device mode (currently one lab, 10.3.4) and the previously
logged `| begin`/`| include` output-filtering backlog item.

**Full regression:** all 38 exercises pass cleanly.

**Test commands for this version:**
1. Complete **10.3 — Configure SNMPv2c** fully — confirm `show snmp
   community` matches the exact format (Community name/Index/
   Security Name/storage-type, blank line between multiple entries).
2. Complete **10.4 — Configure Syslog** fully — confirm `show
   logging` shows the Trap logging section only once a syslog host is
   actually configured.
3. `show running-config` after both exercises — confirm SNMP and
   logging lines both appear, positioned near the NTP lines.
4. Configure `snmp-server location` with a multi-word value (e.g.
   "Building A Floor 2") — confirm the ENTIRE phrase is captured, not
   just the first word.
5. Configure `logging source-interface Loopback 0` — confirm it
   normalizes to `Loopback0` and works correctly even though Loopback
   isn't part of any fixed router's physical inventory.
6. Save, then reload confirming — confirm SNMP and Syslog settings
   both survive correctly.

---

## v1.34.1 — Two small UI changes: reordered Free Practice buttons; renamed "Packet Tracer" mode to "Home Labs"

**Date:** 2026-08-12

**Files:**
- `terminal-v1.34.1.html` — this is the file to open.
- `ios-engine-v1.34.1.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-34-1.zip` with `CHANGELOG-v1.34.1.md`.

**Requested — reorder Free Practice's buttons.** Per direction, moved
"Setup Checklist" to AFTER "Reset exercise"/"Reset device" (previously
first) — since the two reset buttons are conceptually related, having
them adjacent to each other reads more naturally than a checklist
button splitting them apart. Pure HTML reordering, no logic changes,
since all three buttons are independent siblings in the same
container.

**Requested — rename the "Packet Tracer" top-level mode button to
"Home Labs".** Per direction, changed only the VISIBLE button label —
deliberately left the internal variable name (`btnPacketTracer`) and
code comments referencing real Packet Tracer captures unchanged,
since those describe where verification data came from (still
accurate) rather than the mode's own display name. Exercise labels
like "Course 1 · PacketTr · 10.3" also intentionally unchanged, since
they describe the SOURCE material (a real Packet Tracer lab), not the
mode button itself.

**Full regression:** confirmed no impact — both changes are purely
cosmetic (HTML label/order), with no logic depending on button text
or DOM position.

**Test commands for this version:**
1. Switch to Free Practice — confirm the button order now reads
   "Reset exercise", "Reset device", "Setup Checklist" (checklist
   moved to the end).
2. Confirm the checklist button still works correctly in its new
   position (opens/closes the reference panel as before).
3. Confirm the top-level mode button now reads "Home Labs" instead of
   "Packet Tracer", and clicking it still opens the same lab-selection
   panel as before.

---

## v1.35.0 — Two backlog items closed: `workingLine` audit fix + `| begin/include/exclude` output filtering

**Date:** 2026-08-12

**Files:**
- `terminal-v1.35.0.html` — this is the file to open.
- `ios-engine-v1.35.0.js` — dev-only reference copy for Node testing.
- Ships as `Syn-checker-1-35-0.zip` with `CHANGELOG-v1.35.0.md`.

**Item 1 — the `workingLine` audit, closed.** Back in v1.32.0, a real
bug was found and fixed for ONE special-case command (NAT's `ip nat
inside source list ... interface <name> overload`) that matched
against the raw typed line instead of the space-corrected
`workingLine`, meaning an interface name with a space in the wrong
spot could silently fail. At the time, 14 other special cases
(access-list, ip access-group, extended ACL entries, SNMP, etc.) were
flagged as having the same latent pattern, though not necessarily the
same actual exposure. Audited all of them this version: confirmed
none of the OTHER 14 actually take an interface name as an argument
(they take ACL numbers, IPs, community strings, protocol names), so
the practical risk was genuinely limited to the one case already
fixed — but fixed all 15 mechanically anyway (`trimmed.match` →
`workingLine.match`), since it's a safe, zero-behavior-change swap
for any case without an interface-space pattern present, and
correctly future-proofs anything added later.

**Item 2 — `show ... | begin/include/exclude <pattern>` output
filtering, added.** Confirmed missing entirely back during OSPF
research (a real router capture showed `show run | begin router
ospf` rejected). Built as a GENERIC layer wrapping the entire command
engine, not per-command special-casing — the original `executeLine`
was renamed to `executeLineInner` (completely unchanged internally),
and a new public `executeLine` now detects a `|`, splits the line
into the base command and filter clause, runs the base command
through the untouched inner engine, then filters the resulting text.
A line with no `|` passes straight through with zero overhead or
behavior change.

**Scope for this first pass, deliberately limited:** only the three
most common, CCNA-relevant filters — `begin` (show the matching line
and everything after), `include` (show only matching lines),
`exclude` (show everything except matching lines) — using plain
case-sensitive substring matching (real IOS's own default). NOT
included: `section`, regex patterns, or Tab-completion after `|`
(e.g. `show run | ?`) — all reasonable candidates for a future pass
if ever needed, but kept out to keep this addition focused. Malformed
or unrecognized filter clauses correctly return `% Invalid input
detected`.

**Verified the filtering works generically** — tested against `show
running-config` (all three filter types) and `show ip ospf neighbor`
(a completely different command), confirming this isn't hardcoded to
one report.

**Full regression:** all 38 exercises pass cleanly, confirming both
changes are fully backward-compatible.

**Test commands for this version:**
1. `show running-config | begin router ospf` (with OSPF configured)
   — confirm it shows the `router ospf` block and everything after it,
   nothing before.
2. `show running-config | include interface` — confirm it shows ONLY
   the `interface <name>` lines, nothing else.
3. `show running-config | exclude shutdown` — confirm every
   `shutdown`/`no shutdown` line is removed, everything else stays.
4. Try filtering a DIFFERENT command, e.g. `show ip route | include
   O` (with OSPF routes present) — confirm filtering works generically,
   not just on `show running-config`.
5. Try a malformed filter, e.g. `show running-config | foo bar` —
   confirm it correctly errors with "Invalid input detected".
6. Confirm a normal command with NO pipe (e.g. plain `show ip route`)
   still works exactly as before — no change in behavior.

---

## v1.36.0 — Home Labs: new Topology diagram for 10.3 (first version, static reference only)

**Date:** 2026-09-13

**Files:**
- `terminal-v1.36.0.html` — **this is the file to open.**
- `ios-engine-v1.36.0.js` — dev-only reference copy for Node testing; version string updated only, no logic changes (this feature is entirely UI/HTML-side, same as the rest of Home Labs mode).

**Added — Topology diagram button in Home Labs mode.** A new "Show
Topology"/"Hide Topology" button (next to "Reset lab (all devices)")
reveals a diagram of the current lab's full network layout: devices,
connections, and which physical interface connects to what. Built as
an inline SVG generated from a generic `topology` field on the
exercise data (`nodes`: id/type/grid position; `connections`:
from/to/kind/interface labels) — nothing about the renderer is
specific to this one lab's shape, so a future Home Lab just needs to
supply its own topology data. The button only appears for a lab that
actually has topology data, same pattern as the addressing table
hiding itself when a lab has none.

**Extended — 10.3's addressing table** now includes the pre-configured
R1↔R2 serial link and all 4 PCs (10 rows total, up from 4). The
original 4 graded rows are unchanged; the 6 new rows are reference-only
(not graded — same as a real Packet Tracer worksheet, which documents
the full picture including links the student didn't configure
themselves). Source: verified against the real ITExamAnswers.net
instructor-copy page for 10.3.4, cross-checked against a live
inspection of the actual Packet Tracer file (confirming the R1-R2
serial link direction and the exact switch/PC fan-out on each side).

**Deliberately scoped narrow for this first version** (same precedent
already set by the Home Labs framework itself): the diagram is
static — it does not reflect live task-completion state (e.g. an
interface turning green once configured). A generic renderer was
chosen specifically so that adding live status coloring later
wouldn't require rebuilding it. Also deferred: switches and PCs drawn
in the diagram are still not simulated devices (no CLI session) —
unchanged from before this version.

**Naming note:** the diagram's node list is called `topology.nodes`,
NOT `topology.devices` — `devices` already means something specific
elsewhere in this lab's data (the routers that get an actual simulated
CLI session). Reusing it for the diagram's switches/PCs (which never
get a CLI session) would invite exactly the kind of mix-up this
project has been burned by before with overloaded names.

**Full regression:** all 38 Syntax Checker exercises pass cleanly
(this change touches only Home Labs' one existing lab's display data,
plus new additive code — no shared engine logic changed). Confirmed
`node --check` passes on both the dev-reference engine file and the
HTML file's inlined script.

**Test commands for this version:**
1. Switch to Home Labs mode, lab "10.3 — Connect a Router to a LAN".
   Confirm the addressing table now shows 10 rows (previously 4): R1's
   2 Gigabit rows + 1 serial row, R2's 2 Gigabit rows + 1 serial row,
   then PC1–PC4.
2. Click "Show Topology". Confirm the diagram shows R1 and R2 connected
   by a dashed serial link, each router branching to 2 switches, each
   switch connecting down to 1 PC (10 boxes, 9 lines total), with
   interface labels (G0/0, G0/1, S0/0/0, S0/0/0 (DCE)) near the router
   ends of the relevant lines.
3. Click "Hide Topology" — confirm the panel collapses and the button
   label reverts.
4. Reset the lab / switch away and back to 10.3 — confirm the topology
   panel starts collapsed again each time (not stuck open from a
   previous view).
5. Complete the lab's 6 existing graded tasks as before — confirm they
   still check correctly (this version changed no grading logic).
6. Spot-check the other 4 top-level modes (Guided Practice, Free
   Practice, Number Systems, Subnetting) still work normally — this
   version's code is additive and scoped to Home Labs only, but it's
   one shared HTML file.

---

## Template for future entries

```
## vX.Y.Z — <short summary>

**Date:** YYYY-MM-DD

**Files:**
- ...

**Added:**
- ...

**Changed:**
- ...

**Fixed:**
- ...

**Explicitly deferred:**
- ...
```
