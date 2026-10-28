# Real Packet Tracer capture used for v1.43.2

Taken by the user on 2026-10-28: a blank Packet Tracer file with one
**ISR4331** router (IOS XE 16.6.4 boot banner), pasted as plain text via
Notepad. Purpose: what real IOS prints when a command is typed without
all of its parts — found while testing v1.43.2, where this tool answered
`permit tcp` with "% Invalid input detected at '^' marker." instead.

(Boot banner and System Configuration Dialog omitted. The session was
ended with Ctrl+Z from `(config-ext-nacl)#`.)

```
Router>en
Router#conf t
Enter configuration commands, one per line.  End with CNTL/Z.
Router(config)#hostname
% Incomplete command.
Router(config)#access-list 1 permit
% Incomplete command.
Router(config)#interface g0/0/0
Router(config-if)#ip address
% Incomplete command.
Router(config-if)#exit
Router(config)#ip access-list extended TEST
Router(config-ext-nacl)#permit tcp
% Incomplete command.
Router(config-ext-nacl)#
Router#
%SYS-5-CONFIG_I: Configured from console by console

Router#
```

## What it settled (used in v1.43.2)

- A command typed without all its parts gets `% Incomplete command.` —
  in global config, interface config and extended-ACL config alike.
- Unlike "% Invalid input detected at '^' marker.", there is **no "^"
  line** and **no blank line** after the message — the next prompt
  follows directly.
