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

## v1.43.2 — "% Incomplete command."; " no ip address" in running-config; "^" under a bad wildcard; Tab after permit/deny

Open the main link (https://danielchernandez.github.io/ccna-syntax-checker/) once pushed, or `Syn-Checker v1.43.2/terminal-v1.43.2.html`.

1. Free Practice: `enable`, `show running-config` — every interface
   (G0/0/0, G0/0/1, Serial0/0/0, Serial0/0/1, Vlan1) shows ` no ip
   address` then ` shutdown`. Compare with the 4321 capture in
   `Syn-Checker v1.43.1/captures-v1.43.1.md`.
2. `configure terminal`, `interface g0/0/0`, `ip address 192.168.1.1
   255.255.255.0`, `end`, `show running-config` — G0/0/0 now shows the
   `ip address` line and NO ` no ip address` line; the others still do.
3. `configure terminal`, `access-list 1 permit 192.168.20.0 0.0.0255`
   (note the missing dot) — the "^" sits under `0.0.0255`, not under
   `192.168.20.0`. Then the correct `access-list 1 permit 192.168.20.0
   0.0.0.255` is accepted.
4. Tab: type `access-list 1 permit ho` and press Tab — it completes to
   `access-list 1 permit host`. Finish it with `192.168.10.10`.
5. Tab: `ip access-list extended TEST`, then type `permit t` and press
   Tab — it completes to `permit tcp`. Clear the line, type `deny u` +
   Tab — `deny udp`.
6. Home Labs → 16.4.6 → SW1: `enable`, `show running-config` — the
   FastEthernet/GigabitEthernet ports have NO ` no ip address` line;
   `interface Vlan1` does. After giving Vlan1 its address (the task
   hint), Vlan1 shows ` ip address 172.16.1.2 255.255.255.0` instead.
7. Same lab, RTA: `show running-config` — G0/1 and the Serial ports
   show ` no ip address`; G0/0 shows its address.
8. Regression: Course 1 · 2.5 Save Configurations, and Course 3 · 5.2
   Standard ACLs and 5.4 Extended ACLs — each completes end to end.
9. "Incomplete" — Free Practice: `enable`, `configure terminal`, then
   each of these on its own: `hostname`, `access-list 1 permit`, then
   `interface g0/0/0`, `ip address`, `exit`, `ip access-list extended
   TEST`, `permit tcp`. Each of `hostname`, `access-list 1 permit`,
   `ip address` and `permit tcp` answers `% Incomplete command.` — no
   "^" line and no blank line under it, the next prompt right after.
   Compare with `Syn-Checker v1.43.2/captures-v1.43.2.md`.
10. Still "Invalid input": at `Router(config-if)#`, `ip address
    999.1.1.1` — "^" under `999.1.1.1`; and in a fresh Free Practice
    (`Router>`), `configure terminal` — "^" under it, message, blank line.
11. Guided Practice: pick any exercise (e.g. Course 3 · 5.2), click
    **Reset exercise** — the terminal says `Exercise reset: Course 3 ·
    SyntxChk · 5.2 — Configure Numbered Standard ACLs` (the same name as
    in the dropdown), not just "Exercise reset."

---

## v1.43.1 — Access lists now appear after the interfaces in show running-config

Open the main link (https://danielchernandez.github.io/ccna-syntax-checker/) once pushed, or `Syn-Checker v1.43.1/terminal-v1.43.1.html`.

1. Free Practice: `enable`, `configure terminal`, then
   `access-list 1 permit host 192.168.10.10`,
   `access-list 1 permit 192.168.20.0 0.0.0.255`,
   `ip access-list extended SURFING`,
   `permit tcp 192.168.10.0 0.0.0.255 any eq 80`,
   `permit tcp 192.168.10.0 0.0.0.255 any eq 443`, `exit`,
   `interface g0/0/0`, `ip access-group 1 in`, `no shutdown`, `end`.
2. `show running-config` — the `interface ...` blocks come FIRST; the
   two `access-list 1 ...` lines come after the last interface (`Vlan1`),
   then `ip access-list extended SURFING` right below them with its two
   entries indented — the first one ending `eq www`, not `eq 80`. Compare
   with the capture in `captures-v1.43.1.md`.
3. `ip access-group 1 in` appears under `interface GigabitEthernet0/0/0`.
4. `copy running-config startup-config`, then `show startup-config` —
   same order there.
5. Regression: Home Lab 16.4.6 — after the RTA steps, `show
   running-config` shows `ip access-list extended sl_def_acl` AFTER the
   interfaces (it used to be above them), and the lab still completes.
6. Regression: Course 3 · 5.2 Standard ACLs and 5.4 Extended ACLs both
   complete end to end; `show access-lists` looks the same as before.

---

## v1.43.0 — New Home Lab 2.9.1; "^" error marker; real running-config details

Open `Syn-Checker v1.43.0/terminal-v1.43.0.html` from Finder (or the main link once pushed).

1. Free Practice: `enable`, `configure terminal`, `show ip interface
   brief` — a "^" under the "s" of show, then "% Invalid input detected
   at '^' marker." (compare with your RTA screenshot from v1.42.0).
2. Type a misspelled word, e.g. `show ip interfase brief` — "^" under
   "interfase".
3. Home Labs → "2.9.1 — Basic Switch and End Device Configuration":
   device buttons Class-A, Class-B, Student-1, Student-2; no task
   checked. Configure Class-A and Class-B with the task hints (or the
   lab's own script), set both PCs' IPs.
4. On Class-A, `show running-config`: `enable secret 5 $1$...`
   (scrambled), and `interface Vlan1` shows its IP with no `no
   shutdown` line under it.
5. Student-1's Command Prompt: `ping 128.107.20.10`, `ping
   128.107.20.15`, `ping 128.107.20.30` — all reply (switches TTL=255,
   Student-2 TTL=128); every task checked.
6. On Class-A: `configure terminal`, `interface fa0/1`, `shutdown` —
   Student-1 can no longer reach Student-2. `no shutdown` restores it.
7. Guided Practice, any exercise starting at `configure terminal`: at
   `Router>` type `conf t` — you get "Type enable to reach privileged
   EXEC mode…" instead of "Not quite".
8. Regression: one Guided Practice exercise end to end; Home Lab
   16.4.6 still works (SSH in, then type a bad command — the "^" lines
   up under it in the PC prompt).
9. In any Home Lab, finish a task that sets a password (e.g. 2.9.1's
   "Set an encrypted privileged EXEC password"), then click the ticked
   task — its hint (`enable secret C4aJa`) appears, readable; click
   again to hide it.
10. In any Home Lab, every task has an amber "▸" on its right; clicking
    a task turns it to "▾" and shows the hint, clicking again turns it
    back to "▸".

---

## v1.42.2 — Guided Practice accepts abbreviations and interface shorthand

Open the main link (https://danielchernandez.github.io/ccna-syntax-checker/) or, before it's pushed, `Syn-Checker v1.42.2/terminal-v1.42.2.html` from Finder.

1. Guided Practice → Course 1 · 12.6. Type it all the short way: `en`,
   `conf t`, `ipv6 unicast-routing`, `int g0/0/0`, `ipv6 add
   2001:db8:acad:1::1/64`, `ipv6 add fe80::1:1 link-local`, `no shut`,
   `int g0/0/1`, … `end`, `sh ipv6 int br` — every step accepted,
   "Completed." at the end.
2. In any exercise, type a wrong port in shorthand (e.g. `int g0/0/1`
   when the step wants 0/0/0) — still "Not quite".
3. `con t` when the step wants `configure terminal` — still rejected
   (ambiguous, like real IOS).
4. Course 2 · 4.2 (router-on-a-stick): `int g0/0/0.10` for the
   subinterface step — accepted.
5. Any exercise with a `copy running-config startup-config` step:
   `copy run start` accepted, then press Enter at the filename question.
6. Regression: complete one exercise typing the full commands exactly
   as shown — still accepted as before.

---

## v1.42.1 — Fixes from testing v1.42.0: per-device terminal history, global commands from sub-modes, copyable blank lines

Open the main link (https://danielchernandez.github.io/ccna-syntax-checker/) or `Syn-Checker v1.42.1/terminal-v1.42.1.html`.

1. Home Labs → 16.4.6. Click RTA: `enable`, `configure terminal`,
   `hostname RTA`. Click PCA, then RTA again — RTA's terminal should
   still show those commands (and its prompt is still `RTA(config)#`).
   Do the same with SW1 — each device keeps its own text.
2. Click "Reset lab (all devices)" — every device's terminal starts
   fresh again.
3. On RTA: `interface g0/0`, then (still at `RTA(config-if)#`)
   `ip domain-name CCNA.com` — no error; the prompt changes to
   `RTA(config)#`. Then `crypto key generate rsa general-keys modulus
   1024` works straight away.
4. On RTA: `interface g0/0`, then `show ip interface brief` — still
   rejected, and the prompt stays `RTA(config-if)#` (real IOS needs
   `end` or `do` for that).
5. PCA → Command Prompt → `ping 172.16.1.1`; select the output with the
   mouse, copy, paste into TextEdit — the blank lines should be truly
   empty (put the cursor on one: nothing to delete but the line itself).
6. Regression: complete one Guided Practice exercise end to end (any),
   and confirm the main link opens v1.42.1.

---

## v1.42.0 — PC Command Prompt (ipconfig/ping/ssh), new Home Lab 16.4.6, iPad instruction-size fix

Open the main link (https://danielchernandez.github.io/ccna-syntax-checker/)
or `Syn-Checker v1.42.0/terminal-v1.42.0.html`.

**Found during testing (all fixed in v1.42.1 — see above):**
- ✅ (fixed in v1.42.1) Switching to another device and back clears a router/switch's
  terminal text (its settings are kept). The PC Command Prompt keeps
  its text. Fix: every device keeps its own scrollback until "Reset lab".
- ✅ (fixed in v1.42.1) A global command typed while still inside a sub-mode (e.g.
  `ip domain-name …` at `RTA(config-if)#`) is rejected with "% Command
  not available in this mode"; real IOS steps out to `(config)#` and
  runs it. Fix: behave like real IOS.
- ✅ (fixed in v1.42.1) Blank lines copied from the PC Command Prompt contain a space
  instead of being empty. Fix: copy as truly empty lines.
- ✅ Not a bug: "% Please define a domain-name first." — correct when
  `ip domain-name` hasn't been set yet (the old step 7 wording made that
  easy to skip; reworded below).
- ✅ Not a bug: `enable` over SSH → "% No password set" — correct when
  RTA has no enable secret yet.

1. **On the iPad:** Guided Practice, set Text size to "Huge" — confirm
   the step's instruction text (and the "STEP 1 OF 13" label) grow as
   large as the terminal text. Try "Largest" too.
2. Home Labs → "16.4.6 — Configure Secure Passwords and SSH" — confirm
   the device buttons are PCA, RTA, SW1 and no task starts checked.
3. Click PCA → **Command Prompt** tab → `ipconfig` — compare against
   your own Packet Tracer screenshot (same layout, FE80::204:9AFF:FE64:227D).
4. `ipconfig 172.16.1.10 255.255.255.0 172.16.1.1` (prints nothing),
   then `ping 172.16.1.1` — 4 × "Request timed out." (RTA isn't set up).
5. Click RTA: `enable`, `configure terminal`, `hostname RTA`,
   `interface g0/0`, `ip address 172.16.1.1 255.255.255.0`, `no
   shutdown`, `end`. Back on PCA: `ping 172.16.1.1` — 4 replies, TTL=255.
6. On RTA: `ping 172.16.1.10` — "Type escape sequence to abort." and !!!!!.
7. On RTA, type these in this order (the real lab's order):
   ```
   configure terminal
   service password-encryption
   security passwords min-length 10
   enable secret short
   ```
   → expect "% Password too short - must be at least 10 characters.
   Password not configured." Then continue:
   ```
   enable secret itexamanswers
   no ip domain-lookup
   ip domain-name CCNA.com
   username jony secret itexamanswers.net
   crypto key generate rsa general-keys modulus 1024
   login block-for 180 attempts 4 within 120
   line vty 0 4
   transport input ssh
   login local
   exec-timeout 6
   end
   copy running-config startup-config
   ```
   (press Enter at the filename question). Expect the RSA key output
   ("The name for the keys will be: RTA.CCNA.com" …). Then
   `show running-config`: `exec-timeout 6 0` should be the first line
   under `line vty 0 4`, and the `ip access-list extended sl_def_acl`
   list should appear. Every RTA task should now be checked.
8. PCA's Command Prompt: `ssh -l jony 172.16.1.1` — type a wrong
   password 3 times (it stays hidden as you type); confirm it matches
   your Packet Tracer screenshot. Then again with the right password
   (`itexamanswers.net`) → `RTA>`; try `show ip interface brief`, then
   `enable` → `Password:` → `itexamanswers` → `RTA#`. Then `exit` →
   "[Connection to 172.16.1.1 closed by foreign host]". The PCA SSH
   task should check off.
9. Click RTA itself — its **prompt** should be where you left it (the
   SSH session didn't change it). Its terminal text will be cleared —
   that's the first known issue above.
10. Click SW1 and type:
    ```
    enable
    configure terminal
    hostname SW1
    interface vlan 1
    ip address 172.16.1.2 255.255.255.0
    no shutdown
    exit
    ip default-gateway 172.16.1.1
    interface range fastethernet 0/2-24, gigabitethernet 0/2
    shutdown
    exit
    service password-encryption
    enable secret itexamanswers
    no ip domain-lookup
    ip domain-name CCNA.com
    username jony secret itexamanswers.net
    crypto key generate rsa general-keys modulus 1024
    line vty 0 15
    transport input ssh
    login local
    exec-timeout 6
    end
    copy running-config startup-config
    ```
    → after `interface range …` the prompt is `SW1(config-if-range)#`;
    `shutdown` prints one "administratively down" message per port.
    Every task in the lab should now be checked.
11. Shut down SW1's F0/1 (`configure terminal`, `interface fa0/1`,
    `shutdown`) and ping RTA from PCA — it should fail, and the "unused
    ports" task should un-check. `no shutdown` on F0/1 fixes both.
12. Home Labs → 10.3.5: on PC4's Command Prompt `ping 192.168.10.10`
    fails (wrong gateway); fix PC1's IP (192.168.10.10) and PC4's
    gateway (192.168.11.1) on their IP Configuration tabs, then from
    PC1 → `ping 192.168.11.11` works with TTL=127.
13. Home Labs → 10.3: on R1, `enable`, `show ip interface brief` —
    exactly 5 interfaces (G0/0, G0/1, S0/0/0, S0/0/1, Vlan1), not 7.
14. Regression: spot-check a few Syntax Checker exercises end to end,
    including Course 1 · 16.4 and Course 2 · 1.1 (new RSA output) and
    Course 1 · 2.8 Verify Connectivity (new ping output).

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
