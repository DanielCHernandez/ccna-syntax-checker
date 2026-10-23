# Real Packet Tracer captures used for v1.42.0

Taken by the user on 2026-10-22 (Packet Tracer on a Mac). Most came from
**16.4.6 Packet Tracer – Configure Secure Passwords and SSH**
(https://itexamanswers.net/16-4-6-packet-tracer-configure-secure-passwords-and-ssh-instructions-answer.html),
after File → Reset Activity. That activity locks the routers' CLI tab, so
RTA was reached through PCA → Desktop → Terminal, and most captures are
**transcribed from screenshots** (exact spacing re-derived from the fixed-
width font; anything uncertain is marked). The 2960 `interface range`
capture and the PC-to-PC ping came from a blank Packet Tracer file.

## RTA (CISCO1941/K9), factory state — `show ip interface brief`

```
Interface              IP-Address      OK? Method Status                Protocol
GigabitEthernet0/0     unassigned      YES unset  administratively down down
GigabitEthernet0/1     unassigned      YES unset  administratively down down
Serial0/0/0            unassigned      YES unset  administratively down down
Serial0/0/1            unassigned      YES unset  administratively down down
Vlan1                  unassigned      YES unset  administratively down down
```

## PCA Command Prompt

Opening banner: `Cisco Packet Tracer PC Command Line 1.0`

`ipconfig` (no address yet). Labels are dot-padded to 32 characters + ": ".
The gateway is two lines: IPv6 (`::`) then IPv4 aligned under the values.

```
C:\>ipconfig

FastEthernet0 Connection:(default port)

   Connection-specific DNS Suffix..: 
   Link-local IPv6 Address.........: FE80::204:9AFF:FE64:227D
   IPv6 Address....................: ::
   IPv4 Address....................: 0.0.0.0
   Subnet Mask.....................: 0.0.0.0
   Default Gateway.................: ::
                                     0.0.0.0

Bluetooth Connection:

   Connection-specific DNS Suffix..: 
   Link-local IPv6 Address.........: ::
   IPv6 Address....................: ::
   IPv4 Address....................: 0.0.0.0
   Subnet Mask.....................: 0.0.0.0
   Default Gateway.................: ::
                                     0.0.0.0

C:\>
```

`ipconfig 172.16.1.10 255.255.255.0 172.16.1.1` prints nothing; the next
prompt follows immediately (no blank line).

Failed ping (RTA G0/0 still shut down; also identical for an address no
device owns, 172.16.1.99). Note the trailing comma after "(100% loss),":

```
C:\>ping 172.16.1.1

Pinging 172.16.1.1 with 32 bytes of data:

Request timed out.
Request timed out.
Request timed out.
Request timed out.

Ping statistics for 172.16.1.1:
    Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),

C:\>
```

Successful ping to the router (first AND second attempt both 4/4 — no
first-packet loss on the same subnet):

```
C:\>ping 172.16.1.1

Pinging 172.16.1.1 with 32 bytes of data:

Reply from 172.16.1.1: bytes=32 time<1ms TTL=255
Reply from 172.16.1.1: bytes=32 time<1ms TTL=255
Reply from 172.16.1.1: bytes=32 time<1ms TTL=255
Reply from 172.16.1.1: bytes=32 time<1ms TTL=255

Ping statistics for 172.16.1.1:
    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = 0ms, Maximum = 0ms, Average = 0ms

C:\>
```

PC replying to a PC (blank file, 2960 + two PCs): identical shape with
`TTL=128`. (Its first attempt failed only because the switch port was
shut down; after `no shutdown` it was 4/4.)

Unknown command:

```
C:\>ssh-l jony 172.16.1.1
Invalid Command.

C:\>
```

SSH success (password not echoed; 3 blank lines before the prompt —
counted from the screenshot's line spacing):

```
C:\>ssh -l jony 172.16.1.1

Password: 



RTA>exit

[Connection to 172.16.1.1 closed by foreign host]
C:\>
```

SSH, wrong password three times (no "% Login invalid" after the third):

```
C:\>ssh -l jony 172.16.1.1

Password: 
% Login invalid


Password: 
% Login invalid


Password: 

[Connection to 172.16.1.1 closed by foreign host]
C:\>
```

## RTA

`no shutdown` on G0/0 (matches the engine's existing output):

```
RTA(config-if)#no shutdown

RTA(config-if)#
%LINK-5-CHANGED: Interface GigabitEthernet0/0, changed state to up

%LINEPROTO-5-UPDOWN: Line protocol on Interface GigabitEthernet0/0, changed state to up
```

Router ping:

```
RTA#ping 172.16.1.10

Type escape sequence to abort.
Sending 5, 100-byte ICMP Echos to 172.16.1.10, timeout is 2 seconds:
!!!!!
Success rate is 100 percent (5/5), round-trip min/avg/max = 0/0/0 ms
```

`security passwords min-length 10` then `enable secret short`:

```
% Password too short - must be at least 10 characters. Password not configured.
```

`crypto key generate rsa general-keys modulus 1024`:

```
The name for the keys will be: RTA.CCNA.com

% The key modulus size is 1024 bits
% Generating 1024 bit RSA keys, keys will be non-exportable...[OK]
*Feb 28 21:23:26.651: %SSH-5-ENABLED: SSH 1.99 has been enabled
```

`login block-for 180 attempts 4 within 120` prints nothing.

Full `show running-config` after the lab's RTA steps (three screenshots;
runs of `!` lines counted from the screenshots — the long runs are the
least certain part):

```
Building configuration...

Current configuration : 1199 bytes
!
version 15.1
no service timestamps log datetime msec
no service timestamps debug datetime msec
service password-encryption
security passwords min-length 10
!
hostname RTA
!
login block-for 180 attempts 4 within 120
!
!
enable secret 5 $1$mERr$BtwPcSaOohH2Kf0DFoO7X0
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
username jony secret 5 $1$mERr$N7Tq1O3.4NSwmKRnUHmnj/
!
!
license udi pid CISCO1941/K9 sn FTX1524OSTD
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
no ip domain-lookup
ip domain-name CCNA.com
!
!
spanning-tree mode pvst
!
!
!
!
!
!
interface GigabitEthernet0/0
 ip address 172.16.1.1 255.255.255.0
 duplex auto
 speed auto
!
interface GigabitEthernet0/1
 no ip address
 duplex auto
 speed auto
 shutdown
!
interface Serial0/0/0
 no ip address
 clock rate 2000000
 shutdown
!
interface Serial0/0/1
 no ip address
 clock rate 2000000
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
ip access-list extended sl_def_acl
 deny tcp any any eq telnet
 deny tcp any any eq www
 deny tcp any any eq 22
 permit tcp any any eq 22
!
no cdp run
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
 exec-timeout 6 0
 login local
 transport input ssh
line vty 5 15
 no login
!
!
!
end
```

Notes: `sl_def_acl` appears to be generated by `login block-for` (the
quiet-mode ACL). `no cdp run` is most likely this activity's own starting
config rather than a 1941 default.

## 2960 switch (blank file) — `interface range`

```
Switch(config)#interface range fastethernet 0/2-24, gigabitethernet 0/2
Switch(config-if-range)#shutdown

%LINK-5-CHANGED: Interface FastEthernet0/2, changed state to administratively down

%LINK-5-CHANGED: Interface FastEthernet0/3, changed state to administratively down

... (one per port, same pattern) ...

%LINK-5-CHANGED: Interface GigabitEthernet0/2, changed state to administratively down
Switch(config-if-range)#
```

(The ports were not cabled at the time, so no %LINEPROTO lines.)
