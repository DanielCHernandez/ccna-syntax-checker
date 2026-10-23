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
