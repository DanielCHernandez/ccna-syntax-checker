// v1.43.2: checks the three fixes against the real captures
// (captures-v1.42.0.md 1941, captures-v1.43.1.md ISR4321).
// Usage: node fixes-v1432.js <absolute path to ios-engine-vX.js>
const E = require(process.argv[2]);
let fail = 0, total = 0;
const check = (ok, what) => { total++; console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) fail++; };
const run = (d, cmds) => cmds.forEach(c => E.executeLine(d, c));
const block = (lines, name) => { const i = lines.indexOf('interface ' + name); return lines.slice(i + 1, lines.indexOf('!', i)); };

// 1. " no ip address" — router: every interface without an address
const r = E.createDevice('Router', 'router');
run(r, ['enable', 'configure terminal', 'access-list 1 permit host 192.168.10.10',
  'interface g0/0/0', 'ip access-group 1 in', 'no shutdown', 'exit',
  'interface g0/0/1', 'ip address 10.0.0.1 255.255.255.0', 'end']);
let lines = E.executeLine(r, 'show running-config').text.split('\n');
check(JSON.stringify(block(lines, 'GigabitEthernet0/0/0')) === JSON.stringify([' no ip address', ' ip access-group 1 in']),
  'G0/0/0: " no ip address" then " ip access-group 1 in" (as in the 4321 capture)');
check(block(lines, 'GigabitEthernet0/0/1')[0] === ' ip address 10.0.0.1 255.255.255.0' &&
  block(lines, 'GigabitEthernet0/0/1').indexOf(' no ip address') === -1, 'G0/0/1 with an address: no " no ip address"');
check(JSON.stringify(block(lines, 'Vlan1')) === JSON.stringify([' no ip address', ' shutdown']), 'router Vlan1: no ip address, shutdown');
check(block(lines, 'Serial0/0/0')[0] === ' no ip address', 'Serial0/0/0: no ip address');
const bytes = Number(lines[1].match(/(\d+) bytes/)[1]);
check(bytes === lines.slice(2).join('\n').length + 1, 'byte count still matches the body');
run(r, ['copy running-config startup-config', '']);
const st = E.executeLine(r, 'show startup-config').text.split('\n');
check(block(st, 'GigabitEthernet0/0/0')[0] === ' no ip address', 'startup-config shows it too');

// switch: physical ports never, Vlan1 yes
const s = E.createDevice('Switch', 'switch');
run(s, ['enable']);
lines = E.executeLine(s, 'show running-config').text.split('\n');
const phys = lines.filter((l, i) => /^interface (Fast|Gigabit)/.test(l)).map(l => l.slice(10));
check(phys.length > 0 && phys.every(n => block(lines, n).indexOf(' no ip address') === -1), 'switch physical ports: no " no ip address" (' + phys.length + ' ports)');
check(block(lines, 'Vlan1')[0] === ' no ip address', 'switch Vlan1: no ip address');
run(s, ['configure terminal', 'interface vlan 1', 'ip address 172.16.1.2 255.255.255.0', 'end']);
lines = E.executeLine(s, 'show running-config').text.split('\n');
check(block(lines, 'Vlan1')[0] === ' ip address 172.16.1.2 255.255.255.0', 'switch Vlan1 with an address shows it instead');

// 2. "^" under a bad wildcard (4321 capture: under 0.0.0255)
const c = E.createDevice('Router', 'router');
run(c, ['enable', 'configure terminal']);
let line = 'access-list 1 permit 192.168.20.0 0.0.0255';
let res = E.executeLine(c, line);
check(res.caretIndex === line.indexOf('0.0.0255'), '"^" under the bad wildcard 0.0.0255');
line = 'acces-list 1 permit 192.168.20.0 0.0.0.255';
res = E.executeLine(c, line);
check(res.caretIndex === 0, '"^" under a misspelled first word still at 0');
check(!E.executeLine(c, 'access-list 1 permit 192.168.20.0 0.0.0.255').error, 'good network/wildcard entry still accepted');
check(!E.executeLine(c, 'access-list 1 permit host 192.168.10.10').error, 'good host entry still accepted');

// 3. Tab after a two-choice word
const t = (d, s) => E.getCompletions(d, s);
let g = t(c, 'access-list 1 permit ho');
check(g.type === 'unique' && g.completedLine === 'access-list 1 permit host', 'Tab: "access-list 1 permit ho" -> host');
g = t(c, 'access-list 1 deny ho');
check(g.type === 'unique' && g.completedLine === 'access-list 1 deny host', 'Tab: "access-list 1 deny ho" -> host');
g = t(c, 'access-list 1 permit ');
check(g.type !== 'ambiguous' && !(g.completedLine || '').includes('<'), 'Tab after "permit " offers no "<network>"');
g = t(c, 'access-list 1 permit n');
check(g.type !== 'unique', 'Tab: "permit n" no longer completes to a fake "network" word');
run(c, ['ip access-list extended SURFING']);
g = t(c, 'permit t');
check(g.type === 'unique' && g.completedLine === 'permit tcp', 'Tab in (config-ext-nacl): "permit t" -> tcp');
g = t(c, 'deny u');
check(g.type === 'unique' && g.completedLine === 'deny udp', 'Tab in (config-ext-nacl): "deny u" -> udp');

console.log((total - fail) + ' of ' + total + ' checks passed');
process.exit(fail ? 1 : 0);
