# CCNA CLI Engine / Syntax Checker — Project Notes for Claude

## What this project is

A browser-based CCNA CLI practice tool — a single self-contained HTML
file that simulates Cisco IOS command-line behavior (Tab completion,
device state, guided exercises) for someone studying the CCNA
curriculum. There's also a smaller "Home Labs" mode (formerly called
"Packet Tracer" mode) that simulates a multi-device topology with its
own task checklist.

## Who you're working with

The person building this has **very limited coding experience** —
some HTML, a little Python, no JavaScript. They cannot read or
evaluate JavaScript code themselves. This has real, concrete
implications for how to work with them:

- **Explain what changed and why, in plain English, every time** —
  not "I refactored the regex," but "I found a bug where X happened
  because Y, so I changed Z, and here's how to check it worked."
- **They test everything themselves, by hand, in a real browser** —
  they are the QA process. Always give them specific, numbered test
  commands with what to type and exactly what to look for in the
  output. Don't assume a fix works just because it looks right — they
  will genuinely run it and report back.
- **Never assume they'll catch a subtle bug on their own.** If
  something has any risk of being wrong, say so explicitly and tell
  them what to check.
- Match a Packet Tracer/real Cisco device's ACTUAL behavior — don't
  guess at plausible IOS output. If uncertain, say so and suggest a
  real capture rather than presenting a guess as fact.

## The core research discipline (this is the most important pattern)

**Never guess at real IOS output/format when it can be verified.**
Before building any new command or `show` output:

1. Check if a ground-truth reference (a real curriculum answer-key
   site like ITExamAnswers.net, or the project's own prior research)
   already describes the exact expected commands/output.
2. If the formatting is genuinely uncertain (exact column spacing,
   exact wording, a real device's exact behavior), **say so and
   suggest the person capture it from a real Packet Tracer session**
   — give them the exact command sequence to run and copy.
3. **A real capture always wins over reference-tool text when they
   conflict.** This has happened multiple times — reference sites
   sometimes have inaccurate spacing/wording that only a real
   capture catches.
4. When asking for a capture, tell them which specific real lab
   (with its module number, e.g. "5.4.12 Packet Tracer – Configure
   Extended IPv4 ACLs") is the closest real match, and a link to it
   on ITExamAnswers.net if you can find one via search.
5. Real captures should be pasted as plain text (the person uses a
   Notepad/TextEdit relay from Packet Tracer to preserve exact
   spacing — copying directly into rich-text apps has repeatedly
   collapsed whitespace and broken column alignment in transcripts).

## Simulated "second device" pattern

This tool has no real second device to form genuine adjacencies/
neighbors with (OSPF neighbors, CDP/LLDP neighbors, DHCP relay, NAT
translations, etc.). The established pattern: show a **plausible,
DETERMINISTIC (not random) simulated neighbor/entry** once the
relevant configuration is genuinely correct and would plausibly
succeed in real IOS. Deterministic matters — the same simulated
neighbor should appear consistently across repeated `show` commands
in one session, not change randomly each time.

## Development workflow

- This project has moved from a chat-based workflow (manual
  versioned zip files, changelogs) to Claude Code with git. Continue
  the same rigor, now backed by real version control.
- **Commit at meaningful checkpoints**, not every tiny edit — a
  completed bug fix, a completed feature, verified and tested. Write
  clear, specific commit messages (not "fix bug" — say what bug and
  what the fix was).
- **Always run full regression before considering something done.**
  This project has ~38 Syntax Checker exercises; a change to shared
  logic (Tab completion, command matching, interface-name handling)
  has repeatedly broken unrelated exercises in the past. Test broadly,
  not just the one thing that was changed.
- **Use a real browser to test UI/DOM behavior** before reporting
  something as working — this project's past chat-based workflow
  could only test the underlying JS logic via Node, which repeatedly
  missed real browser-only bugs (CSS scaling, Tab-completion DOM
  behavior, multi-line rendering). This is one of the concrete
  advantages of working in Claude Code — use it.
- Check `git log` / `git diff` to understand recent history before
  assuming you need to re-derive context from scratch — a lot of the
  "why" for existing code is in commit messages and code comments.

## Known recurring bug patterns (learn from these, don't repeat them)

- **Interface names with a space** (e.g. "GigabitEthernet 0/0/0",
  which is valid real IOS input) have repeatedly broken newly-added
  commands that take an interface name as an argument, because the
  space needs to be collapsed before matching. There's a generic,
  already-built mechanism for this (`workingLine` vs `trimmed` in the
  main command dispatcher) — any new command taking an interface name
  argument must be matched against `workingLine`, not the raw input.
- **Pipe-separated documentation tokens** (e.g. `"in|out"` in a
  command's help/token definition) need special handling in
  Tab-completion — the completion matcher must split on `|` and treat
  each alternative as its own completable option, not treat the whole
  string as one literal.
- **A trailing/missing comma in a large JS object literal** has
  caused a full syntax error more than once when adding new device-
  state fields. Always run a syntax check (e.g. `node --check`) after
  editing large state objects before considering an edit done.
- When adding new device state, remember to update it in ALL of:
  the state initializer, `snapshotConfig`/`applyConfigSnapshot` (save/
  reload), the device reset path, `show running-config` rendering,
  and the "unsaved changes" comparator. Missing one of these has
  happened more than once — new state has looked like it worked, then
  silently failed to persist through save/reload, or failed to render
  in the config, because one of these five places was missed.
- Real IOS abbreviates interface names DIFFERENTLY across different
  commands (e.g. CDP uses "Gig 0/0/0" with a space; LLDP uses
  "Gig0/0/0" without one; `show vlan brief` uses yet another
  convention) — never assume one abbreviation style applies
  everywhere; verify per-command.

## Content/scope conventions

- CCNA exercises are grouped into three courses (Course 1, 2, 3),
  each with its own set of Syntax Checker exercises sourced from real
  Cisco NetAcademy curriculum structure. Exercise IDs follow the
  pattern `c{course}_syn_{module}_{short_name}` or
  `c{course}_pt_{module}_{short_name}` for Home Labs exercises.
- When multiple related exercises share a new underlying subsystem
  (e.g. all 4 OSPF exercises, all 4 NAT exercises), build them
  TOGETHER in one pass rather than one at a time — this avoids
  redoing the same foundational data-model work repeatedly.
- Small, independent exercises with no shared dependency can be
  batched 2 at a time purely for efficiency (this was the pattern for
  the final CDP/LLDP + NTP, then SNMP + Syslog pairs).
- This project intentionally does NOT reproduce copyrighted diagrams/
  images from reference sites (e.g. ITExamAnswers.net) — topology
  diagrams are built from first-party verified data (addressing
  tables, connection lists) and rendered as original, simple diagrams
  instead.

## Communication style expectations

- Be direct and honest about uncertainty — don't present a guess as
  a verified fact.
- When something is fixed, explain what the ROOT CAUSE was, not just
  that a fix was applied — this person genuinely wants to understand
  what went wrong, even though they can't read the code themselves.
- Flag real backlog items and technical debt honestly rather than
  letting them go unmentioned (this has happened successfully several
  times — e.g. explicitly noting when a fix only covers the one
  case that broke, and flagging that a similar latent risk might
  exist elsewhere).
