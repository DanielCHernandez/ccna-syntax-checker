# Test Commands — Quick Reference

This file exists so you never have to dig through the full CHANGELOG
to find a version's test list — per direction (2026-10-22). It's a
duplicate of the same "Test commands for this version" section that
also lives in each version's own `CHANGELOG-vX.Y.Z.md`, kept here
**newest version first** so the one you're about to run is always at
the top. The changelog still carries the same list for the permanent
record — this file is just for convenience when it's time to actually
test.

Going forward, every new version's test list gets added here (at the
top) at the same time it's added to that version's changelog — you
shouldn't need to ask for this again.

---

## Site v20 — Study Hub + Simple Syntax Checker + CLI Engine combined

Open http://127.0.0.1:8720/ (local server, while it's running) or
`Site-v20/index.html` directly.

1. Landing page: confirm the three course Study Hub cards, then ONE
   "Practice tools" row with two cards side by side: Simple Syntax
   Checker (with CCNA 1 / 2 / 3 buttons) and CLI Engine. Click each of the
   7 links and confirm each opens a NEW window/tab while the landing page
   stays open.
2. CCNA 1 → Module 10: scroll to "Syntax Checker — 10.1.2". Confirm the
   green and blue buttons sit side by side, each with its one-line
   description, and hovering shows the same text as a tooltip.
3. Click Open Syntax Checker → confirm it opens on lab 10.1.2 and has a
   🏠 Home link top-left that goes back to the landing page.
4. Click Open CLI Engine → confirm the engine opens. Pick the menu entry
   the button named ("Course 1 · 10.1 — Configure Initial Router
   Settings") and confirm it's the matching exercise.
5. Click "🏠 All study tools (home)" under the buttons, and the "🏠 Home"
   breadcrumb at the top of a module page: both go to the landing page.
6. Course index pages (all 3): confirm there's no progress bar anymore.
   On CCNA 3, confirm Modules 1–2 now sit under a "Single-Area OSPFv2"
   heading like the other groups.
7. Module pages: confirm there's no progress bar; the panel is now called
   "📚 Sections" and lists every section, including Packet Tracer ones
   (shown as "PT 2.9" etc.).
8. Ticks: on CCNA 1 Module 1, tick 1.9 and Exam Traps; on Module 2, tick
   2.8 and PT 2.9; on Module 5, tick 5.0 and the converter (📋). Reload
   each page and confirm the button, the pill at the top and the row in
   the Sections panel all still show ✓.
9. CCNA 2 Module 3 (VLANs): tap a section header and confirm it opens and
   closes. Before this, tapping did nothing.
10. Spot-check a few other modules' Syntax Checker buttons (e.g. CCNA 2
    Module 3, CCNA 3 Module 6) and confirm each opens its own lab.
11. Readability fixes. Confirm each is now easy to read:
    - CCNA 1 Module 5, "Subnet Mask Octet Values (Binary)": the Bits Set column.
    - Any CCNA 2 or 3 module: the "📚 Sections" panel header now shows (it
      was an invisible white-on-white box), and ticking a section turns its
      pill and button green.
    - CCNA 1 Module 1, PT 1.0: the activity name, now inside a dark box.
    - CCNA 2 Module 1, 1.1.2 tip box: `config.text` is now a readable chip.
    - CCNA 2 Module 3, "DTP Negotiation Matrix": the Auto and Trunk rows.
    - CCNA 1 Module 11, Logical AND: "0 AND 1 = 0" and the other zero rules.
    - CCNA 1 Module 13: traceroute output text. CCNA 1 Module 16: the DDoS card.

---

## v1.41.0 — New Home Lab: 10.3.5 Troubleshoot Default Gateway Issues

1. Open `terminal-v1.41.0.html`, confirm the header says v1.41.0.
2. Home Labs → "10.3.5 — Troubleshoot Default Gateway Issues" — confirm
   the device tabs show exactly S1, S2, PC1, PC4 (not R1/PC2/PC3), and
   the addressing table + topology diagram show all 7 real devices.
3. Click S1, `show running-config` — confirm VLAN 1 already shows
   192.168.10.2/255.255.255.0 and is up, but there's no "ip
   default-gateway" line yet.
4. On S1: `enable`, `configure terminal`, `ip default-gateway
   192.168.10.1`, `end`, `copy running-config startup-config` (Enter
   for the default filename) — confirm both S1 tasks check off, and
   `show running-config` now shows the new line.
5. Click S2, `show running-config` — confirm VLAN 1 is completely
   unconfigured (no IP, administratively down).
6. On S2: `enable`, `configure terminal`, `interface vlan 1`, `ip
   address 192.168.11.2 255.255.255.0`, `no shutdown`, `exit`, `ip
   default-gateway 192.168.11.1`, `end`, `copy running-config
   startup-config` — confirm all 3 S2 tasks check off.
7. Click PC1 — confirm its IP Configuration panel shows the WRONG
   starting IP (192.168.20.10). Correct it to 192.168.10.10 / mask
   255.255.255.0 — confirm the task checks off.
8. Click PC4 — confirm its panel shows the correct IP but the WRONG
   gateway (192.168.10.1). Correct the gateway to 192.168.11.1 —
   confirm the task checks off.
9. Confirm all 7 tasks now show checked off.
10. Click "Reset lab (all devices)", then re-check S1/S2/PC1/PC4 —
    confirm every device goes back to exactly its ORIGINAL broken
    state (not blank, not the fixed state) every time you reset.
11. Full regression: open a couple of the other Home Labs (e.g. 2.5,
    10.1, 10.3) and confirm they still start exactly as before
    (factory-default/blank) — this version's new "start broken"
    plumbing should have zero effect on labs that don't use it.
12. Full regression: spot-check a handful of the 38 Syntax Checker
    exercises still complete normally end to end, and that Tab
    completion after typing `ip d` in global config mode now offers
    `default-gateway` alongside the existing `dhcp`/`domain-name`
    options without any conflict.
