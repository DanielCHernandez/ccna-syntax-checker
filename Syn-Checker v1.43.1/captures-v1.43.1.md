# Real Packet Tracer capture used for v1.43.1

Taken by the user on 2026-10-26: a blank Packet Tracer file with one
**ISR4321** router (IOS XE 15.5(3)S5 boot banner; running-config says
`version 15.4`), pasted as plain text via Notepad. Purpose: backlog item D
— where real IOS puts access lists in `show running-config`. The commands
are a cut-down version of this tool's own Course 3 5.2/5.4 exercises.
Closest real lab: 5.4.12 Packet Tracer – Configure Extended IPv4 ACLs –
Scenario 1
(https://itexamanswers.net/5-4-12-packet-tracer-configure-extended-ipv4-acls-scenario-1-answers.html).

(Boot banner omitted. The user typed a couple of commands twice, e.g.
`ip access-list extended SURFING`; shown as captured.)

```
Router>en
Router#conf t
Enter configuration commands, one per line.  End with CNTL/Z.
Router(config)#access-list 1 permit host 192.168.10.10
Router(config)#access-list 1 permit 192.168.20.0 0.0.0255
                                                 ^
% Invalid input detected at '^' marker.
    
Router(config)#access-list 1 permit 192.168.20.0 0.0.0.255
Router(config)#ip access-list extended SURFING
Router(config)#ip access-list extended SURFING
Router(config-ext-nacl)#permit tcp 192.168.10.0 0.0.0.255 any eq 80
Router(config-ext-nacl)#permit tcp 192.168.10.0 0.0.0.255 any eq 443
Router(config-ext-nacl)#exit
Router(config)#int g0/0/0
Router(config-if)#ip access-group 1 in
Router(config-if)#no shut
Router(config-if)#no shutdown 

Router(config-if)#
%LINK-5-CHANGED: Interface GigabitEthernet0/0/0, changed state to up

Router(config-if)#end
Router#
%SYS-5-CONFIG_I: Configured from console by console

Router#show running-config 
Building configuration...

Current configuration : 781 bytes
!
version 15.4
no service timestamps log datetime msec
no service timestamps debug datetime msec
no service password-encryption
!
hostname Router
!
!
!
!
!
!
!
!
ip cef
no ipv6 cef
!
!
!
!
!
!
!
!
!
!
!
!
spanning-tree mode pvst
!
!
!
!
!
!
interface GigabitEthernet0/0/0
 no ip address
 ip access-group 1 in
 duplex auto
 speed auto
!
interface GigabitEthernet0/0/1
 no ip address
 duplex auto
 speed auto
 shutdown
!
interface Vlan1
 no ip address
 shutdown
!
ip classless
!
ip flow-export version 9
!
!
access-list 1 permit host 192.168.10.10
access-list 1 permit 192.168.20.0 0.0.0.255
ip access-list extended SURFING
 permit tcp 192.168.10.0 0.0.0.255 any eq www
 permit tcp 192.168.10.0 0.0.0.255 any eq 443
!
!
!
!
!
line con 0
!
line aux 0
!
line vty 0 4
 login
!
!
!
end
```

## What it settled (used in v1.43.1)

- Access lists come AFTER the interfaces, below `ip classless` / `ip
  flow-export version 9` — same spot as `sl_def_acl` in the v1.42.0 1941
  capture.
- Numbered ACL lines first, then the named ACL directly after them (no
  `!` between), then `!`.
- `eq 80` is shown as `eq www`; `eq 443` stays a number (the engine
  already did this).
- `ip access-group 1 in` sits right after the interface's address line.

## Other differences it shows (NOT changed in v1.43.1 — backlog)

1. **"^" position for a bad value:** real IOS put the "^" under the bad
   wildcard `0.0.0255` (the 5th word). This engine puts it under
   `192.168.20.0` (the 4th word).
2. **The 4321's interfaces:** a blank 4321 has only GigabitEthernet0/0/0,
   GigabitEthernet0/0/1 and Vlan1. This engine's router also lists
   Serial0/0/0 and Serial0/0/1 (curriculum labs often add a serial
   module, so this may be intended — check before changing).
3. **`no ip address`:** real IOS prints ` no ip address` under an
   interface with no address; this engine prints nothing there.
   (` duplex auto` / ` speed auto` and the other boilerplate lines —
   `version`, `no service timestamps ...`, `ip cef`, `no ipv6 cef`,
   `spanning-tree mode pvst`, `ip classless`, `ip flow-export`, `line con
   0`/`aux 0` — are already deliberately not rendered; see v1.7.2/v1.7.3.)
4. **`no shutdown` on an unplugged port:** Packet Tracer printed only
   `%LINK-5-CHANGED ... changed state to up` (no `%LINEPROTO-5-UPDOWN`
   line, since nothing is cabled). This engine prints both, which fits
   its "always connected" model.
5. Tiny: the blank line after "% Invalid input detected" held 4 spaces.
