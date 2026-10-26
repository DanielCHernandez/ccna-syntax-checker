// v1.43.1: replays the user's real ISR4321 capture (captures-v1.43.1.md) and
// checks where show running-config puts access lists.
// Usage: node acl-order.js <absolute path to ios-engine-vX.js>
const E = require(process.argv[2]);
const d = E.createDevice('Router', 'router');
const cmds = ['enable', 'configure terminal', 'access-list 1 permit host 192.168.10.10',
  'access-list 1 permit 192.168.20.0 0.0.0.255', 'ip access-list extended SURFING',
  'permit tcp 192.168.10.0 0.0.0.255 any eq 80', 'permit tcp 192.168.10.0 0.0.0.255 any eq 443',
  'exit', 'int g0/0/0', 'ip access-group 1 in', 'no shutdown', 'end'];
let fail = 0;
const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) fail++; };
for (const c of cmds) { const r = E.executeLine(d, c); if (r.error) check(false, c + ' -> ' + r.error); }
const lines = E.executeLine(d, 'show running-config').text.split('\n');
const at = s => lines.indexOf(s);
const lastIface = lines.map((l, i) => l.startsWith('interface ') ? i : -1).reduce((a, b) => Math.max(a, b));
check(at('access-list 1 permit host 192.168.10.10') > lastIface, 'numbered ACL comes after every interface');
check(at('access-list 1 permit 192.168.20.0 0.0.0.255') === at('access-list 1 permit host 192.168.10.10') + 1, 'ACL 1 entries in typed order');
check(at('ip access-list extended SURFING') === at('access-list 1 permit 192.168.20.0 0.0.0.255') + 1, 'named ACL directly follows the numbered one (no "!")');
check(at(' permit tcp 192.168.10.0 0.0.0.255 any eq www') === at('ip access-list extended SURFING') + 1, 'port 80 shown as "eq www"');
check(at(' permit tcp 192.168.10.0 0.0.0.255 any eq 443') === at('ip access-list extended SURFING') + 2, 'port 443 stays "eq 443"');
check(lines[at(' permit tcp 192.168.10.0 0.0.0.255 any eq 443') + 1] === '!', '"!" after the last ACL');
check(at(' ip access-group 1 in') === at('interface GigabitEthernet0/0/0') + 1, 'ip access-group under GigabitEthernet0/0/0');
// login block-for's own ACL and a static route: ACLs after the ip route lines
for (const c of ['configure terminal', 'login block-for 180 attempts 4 within 120', 'ip route 0.0.0.0 0.0.0.0 10.0.0.2', 'end']) E.executeLine(d, c);
const l2 = E.executeLine(d, 'show running-config').text.split('\n');
check(l2.indexOf('ip access-list extended sl_def_acl') > l2.indexOf('ip route 0.0.0.0 0.0.0.0 10.0.0.2'), 'sl_def_acl after the ip route lines');
check(l2.indexOf('access-list 1 permit host 192.168.10.10') > l2.indexOf('ip route 0.0.0.0 0.0.0.0 10.0.0.2'), 'ACL 1 after the ip route lines');
console.log((9 - fail) + ' of 9 checks passed');
process.exit(fail ? 1 : 0);
