# Home Labs Plan — Course 1 (ITN v7)

Written 2026-10-28 from the real ITExamAnswers.net pages for every Course 1
Packet Tracer activity (each linked below — open the page itself to check;
these notes are summaries). Update this file as labs get built or plans
change.

## Status

**Built (9):** 2.5, 2.7, 2.5+2.7 combined, 2.9.1, 10.1, 10.3, 10.3.5, 16.4.6,
16.5.1 (v1.44.0).

**Next:** 11.5.5 (batch 2).

**Not portable (skipped):** every "Physical Mode" lab (cabling — this tool
never simulates cabling); 1.0.5 and 1.5.x (exploring the Packet Tracer
program); 3.5.5, 9.1.3, 9.2.9, 9.3.4, 14.8.1 (Simulation-mode packet
watching); 4.6.5 (wireless GUI screens); 4.7.2 (cabling).

## Recommended order

| # | Batch | Labs | New tool work needed | Size |
|---|---|---|---|---|
| 1 | Quick win | 16.5.1 | Almost none | Small |
| 2 | Subnetting, one router | 11.5.5 | Router serial port, pre-set ISP side | Small–medium |
| 3 | Subnetting, two routers | 11.7.5, 11.9.3, 11.10.1 | Pings that cross two routers | Medium |
| 4 | IPv6 | 10.4.3, 12.6.6, 12.9.1 | IPv6 on PCs, IPv6 ping, `show ipv6 route`, `no ipv6 address`, IPv6 static routes | Large |
| 5 | Traceroute | 13.2.6, 13.2.7, 13.3.1 | `tracert` on PCs, `ipconfig /all`, `ipv6config` | Medium–large |
| 6 | IOS help | 2.3.7 | `?` help, `clock set`, `show clock` | Medium (shared code — risky) |
| 7 | Capstones | 17.8.3, 17.7.6, 17.8.2 | Nothing new if 1–5 are done | Medium each |
| 8 | Optional | 17.5.9 | 6+ new `show` commands, `--More--` paging | Large, low value |

Batches follow the CLAUDE.md rule: labs sharing a new subsystem are built
together.

## Batch details

### 1. ✅ Built in v1.44.0 — [16.5.1 – Secure Network Devices](https://itexamanswers.net/16-5-1-packet-tracer-secure-network-devices-instructions-answer.html)
- RTR-A, SW-1, PC, Laptop, Remote PC. Router ports start pre-addressed
  (192.168.1.1 / 192.168.2.1).
- ~13 router tasks, ~8 switch tasks — all features already exist from 16.4.6.
- Unused-ports task must leave Fa0/2, Fa0/10, Gi0/1 up.
- `show login` / `show run | section line` (verification only) not built —
  optional, would need a capture.

### 2. [11.5.5 – Subnet an IPv4 Network](https://itexamanswers.net/11-5-5-packet-tracer-subnet-an-ipv4-network-instructions-answer.html)
- CustomerRouter, 2 LAN switches, PC-A, PC-B; ISP side pre-set (diagram only).
- Part 1 is paper subnetting (/26) — see decision 1.
- Router needs Serial0/1/0.

### 3. Two-router subnetting
- [11.7.5 – Subnetting Scenario](https://itexamanswers.net/11-7-5-packet-tracer-subnetting-scenario-instruction-answers.html)
- [11.9.3 – VLSM Design and Implementation Practice](https://itexamanswers.net/11-9-3-packet-tracer-vlsm-design-and-implementation-practice-answers.html)
- [11.10.1 – Design and Implement a VLSM Addressing Scheme](https://itexamanswers.net/11-10-1-packet-tracer-design-and-implement-a-vlsm-addressing-scheme-instructions-answer.html)
- Same shape: 2 routers (serial link), 4 switches, 4 PCs. Router-to-router
  routing treated as pre-configured and working (deterministic "second
  device" pattern). 11.9.3 / 11.10.1 are randomized — Scenario 1 only (see
  decision 2). 11.10.1's scripts configure no routing yet expect cross-LAN
  pings.
- **Capture needed:** a ping across two routers (first-packet loss?).

### 4. IPv6
- [10.4.3 – Basic Device Configuration](https://itexamanswers.net/10-4-3-packet-tracer-basic-device-configuration-instructions-answer.html) (randomized — use the published College / Class-B sample)
- [12.6.6 – Configure IPv6 Addressing](https://itexamanswers.net/12-6-6-packet-tracer-configure-ipv6-addressing-answers.html) (web-browser test skipped)
- [12.9.1 – Implement a Subnetted IPv6 Addressing Scheme](https://itexamanswers.net/12-9-1-packet-tracer-implement-a-subnetted-ipv6-addressing-scheme-answers.html) (SLAAC on PCs, `ipv6 route ... Serial0/0/0`)
- PC object gains IPv6 fields — extend the existing `{ ip, mask, gateway }`
  shape, don't rebuild it (CLAUDE.md).
- **Captures needed:** PC `ipconfig` with IPv6, IPv6 ping, `show ipv6 route`.

### 5. Traceroute
- [13.2.6 – Verify IPv4 and IPv6 Addressing](https://itexamanswers.net/13-2-6-packet-tracer-verify-ipv4-and-ipv6-addressing-answers.html) (no config; 3-router chain)
- [13.2.7 – Use Ping and Traceroute to Test Network Connectivity](https://itexamanswers.net/13-2-7-packet-tracer-use-ping-and-traceroute-to-test-network-connectivity-answers.html) (faults: R2 S0/0/0 IP, PC4 IPv6 gateway)
- [13.3.1 – Use ICMP to Test and Correct Network Connectivity](https://itexamanswers.net/13-3-1-packet-tracer-use-icmp-to-test-and-correct-network-connectivity-instructions-answer.html) (faults: Server 1 DHCP, RTR-3 IPv6, PC-4 gateway)
- After batch 4 (all use IPv6).
- **Capture needed:** real PC `tracert` output, IPv4 + IPv6, incl. a failing trace.

### 6. [2.3.7 – Navigate the IOS](https://itexamanswers.net/2-3-7-packet-tracer-navigate-the-ios-instruction-answers.html)
- `?` context help (shared command-matching code — careful regression),
  `clock set`, `show clock`. Few checkable tasks.
- **Captures needed:** `?`, `t?`, `clock ?`, `clock set ?`, `show clock`.

### 7. Capstones
- [17.8.3 – Troubleshooting Challenge](https://itexamanswers.net/17-8-3-packet-tracer-troubleshooting-challenge-instructions-answer.html) — 6 faults (router port, SSH user, VTY SSH-only, switch address, PC IPv4/IPv6).
- [17.7.6 – Troubleshoot Connectivity Issues](https://itexamanswers.net/17-7-6-packet-tracer-troubleshoot-connectivity-issues-answers.html) — partly depends on web browser / broken DNS (GUI). See decision 3.
- [17.8.2 – Skills Integration Challenge](https://itexamanswers.net/17-8-2-packet-tracer-skills-integration-challenge-instructions-answer.html) — subnetting, dual-stack router with 3 LANs, 3 switches, 3 PCs, SSH, security.

### 8. Optional: [17.5.9 – Interpret show Command Output](https://itexamanswers.net/17-5-9-packet-tracer-interpret-show-command-output-instructions-answer.html)
- Reading `show version` / `flash:` / `arp` / `users` / `protocols` /
  `interfaces` output; no config, few checkable tasks. Each output would
  need a real capture.

## Open decisions

1. **Paper-design parts** (batches 2, 3, 7): read-only note with the answer
   hidden until clicked, or skip?
2. **Randomized labs** (10.4.3, 11.9.3, 11.10.1): Scenario 1 only, or all
   three scenarios as separate labs?
3. **17.7.6:** port just the PC/router faults, or leave it out?
