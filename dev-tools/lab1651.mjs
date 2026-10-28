// v1.44.0: plays Home Lab 16.5.1 (Secure Network Devices) end to end through
// the real UI, using every task's hint commands.
// Usage: node --experimental-websocket lab1651.mjs <chrome-profile-dir> <url>
import { spawn } from 'node:child_process';
const [,, PROFILE, URL] = process.argv;
const chrome = spawn(process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), ['--headless=new', '--remote-debugging-port=9346', `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let t;
for (let i = 0; i < 50; i++) { try { t = await (await fetch('http://127.0.0.1:9346/json')).json(); break } catch { await sleep(200) } }
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description) };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(x.slice(0, 80) + ' -> ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result.result.value; };
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: URL }); await sleep(1500);
const results = []; const ok = (c, m) => results.push((c ? 'PASS ' : 'FAIL ') + m);

await ev(`document.getElementById('btnPacketTracer').click();ptModuleSelect.value='c1_pt_16.5.1_secure_network_devices';ptModuleSelect.dispatchEvent(new Event('change'))`);
const pick = d => ev(`[...document.querySelectorAll('#ptDeviceButtons button')].find(b=>b.textContent==='${d}').click()`);
const cli = async (d, ls) => { await pick(d); for (const l of ls) await ev(`ptInputEl.value=${JSON.stringify(l)};handlePtSubmit()`); };
const pc = async (d, ls) => { await pick(d); await ev(`document.getElementById('ptPcTabCmd').click()`); for (const l of ls) await ev(`ptPcInput.value=${JSON.stringify(l)};ptPcInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))`); };
const pcLines = d => ev(`pcConsoleFor('${d}').lines`);
const done = () => ev(`(function(){const ex=getPtExercise(ptExerciseId);return ex.tasks.filter(t=>t.check(ptDevices[t.device])).map(t=>t.id)})()`);
const termText = () => ev(`ptTerminalEl.innerText`);

ok((await ev(`[...document.querySelectorAll('#ptDeviceButtons button')].map(b=>b.textContent).join(',')`)) === 'RTR-A,SW-1,PC,Laptop,Remote PC', 'device buttons RTR-A, SW-1, PC, Laptop, Remote PC');
ok((await done()).length === 0, 'no task done at start: ' + (await done()).join(','));
ok((await ev(`getPtExercise(ptExerciseId).tasks.length`)) === 25, '25 tasks (13 RTR-A, 9 SW-1, 3 pings)');

// Starting state: RTR-A's two ports are already addressed and up; only the 4321's 3 ports exist
await cli('RTR-A', ['enable', 'show ip interface brief']);
let T = await termText();
ok(/GigabitEthernet0\/0\/0\s+192\.168\.1\.1\s+YES manual up\s+up/.test(T) && /GigabitEthernet0\/0\/1\s+192\.168\.2\.1\s+YES manual up\s+up/.test(T),
  'RTR-A starts with G0/0/0 192.168.1.1 and G0/0/1 192.168.2.1 up/up');
ok(!/Serial/.test(T) && /Vlan1/.test(T), 'RTR-A (ISR4321) has no Serial ports, just G0/0/0, G0/0/1, Vlan1');

// Before SW-1 is configured, nobody reaches 192.168.1.254 — but PC reaches its gateway already
await pc('PC', ['ping 192.168.1.1', 'ping 192.168.1.254']);
let P = (await pcLines('PC')).join('\n');
ok(/Reply from 192\.168\.1\.1/.test(P), 'PC reaches RTR-A (its gateway) from the start');
ok(!(await done()).includes('pc_ping'), 'ping to SW-1 fails before SW-1 has an address');

// RTR-A, every hint
await cli('RTR-A', ['configure terminal', 'no ip domain-lookup', 'hostname RTR-A', 'security passwords min-length 10',
  'line console 0', 'password @Cons1234!', 'login', 'exec-timeout 7 0', 'exit',
  'enable secret short',              // too short — must be refused
  'enable secret @Cons1234!', 'banner motd #Authorized access only!#', 'service password-encryption',
  'username NETadmin secret LogAdmin!9', 'ip domain-name security.com', 'crypto key generate rsa general-keys modulus 1024',
  'line vty 0 4', 'transport input ssh', 'login local', 'exec-timeout 7 0', 'exit',
  'login block-for 45 attempts 3 within 100', 'end', 'copy running-config startup-config', '']);
T = await termText();
ok(/% Password too short/i.test(T) || /too short/i.test(T), '"enable secret short" refused under min-length 10');
const rtr = ['rtr_dns', 'rtr_hostname', 'rtr_minlength', 'rtr_console', 'rtr_timeout', 'rtr_enable_secret', 'rtr_banner', 'rtr_encrypt', 'rtr_user', 'rtr_ssh_keys', 'rtr_vty', 'rtr_block', 'rtr_save'];
let D = await done();
ok(rtr.every(x => D.includes(x)), 'all 13 RTR-A tasks done: missing ' + rtr.filter(x => !D.includes(x)).join(','));

// SW-1, every hint
await cli('SW-1', ['enable', 'configure terminal', 'hostname SW-1',
  'interface range fastethernet 0/1, fastethernet 0/3-9, fastethernet 0/11-24, gigabitethernet 0/2', 'shutdown', 'exit',
  'interface vlan 1', 'ip address 192.168.1.254 255.255.255.0', 'no shutdown', 'exit', 'ip default-gateway 192.168.1.1',
  'enable secret @Cons1234!', 'ip domain-name security.com', 'crypto key generate rsa general-keys modulus 1024',
  'username NETadmin secret LogAdmin!9', 'line vty 0 15', 'transport input ssh', 'login local', 'end',
  'copy running-config startup-config', '']);
const sw = ['sw_hostname', 'sw_unused_ports', 'sw_vlan1', 'sw_gateway', 'sw_enable_secret', 'sw_ssh_keys', 'sw_user', 'sw_vty', 'sw_save'];
D = await done();
ok(sw.every(x => D.includes(x)), 'all 9 SW-1 tasks done: missing ' + sw.filter(x => !D.includes(x)).join(','));

// Verify pings — same LAN and across RTA
await pc('PC', ['ping 192.168.1.254']);
await pc('Laptop', ['ping 192.168.1.254']);
await pc('Remote PC', ['ping 192.168.1.254']);
P = (await pcLines('RemotePC')).join('\n');
ok(/Reply from 192\.168\.1\.254: bytes=32 time\S* TTL=254/.test(P), 'Remote PC reaches SW-1 across RTR-A (TTL 254 = switch 255 minus one router)');
D = await done();
ok(['pc_ping', 'laptop_ping', 'remote_ping'].every(x => D.includes(x)), 'all 3 ping tasks done');
ok(D.length === 25, 'ALL 25 tasks done (' + D.length + ')');

// Shutting the PC's port breaks its ping; the unused-ports task un-checks if a used port is shut
await cli('SW-1', ['configure terminal', 'interface fastethernet 0/2', 'shutdown', 'end']);
ok(!(await done()).includes('sw_unused_ports'), 'shutting F0/2 (in use) un-checks the unused-ports task');
await pc('PC', ['ping 192.168.1.254']);
P = (await pcLines('PC')); const last = P.slice(-8).join('\n');
ok(/Request timed out/.test(last), 'PC can no longer reach SW-1 with F0/2 shut');
await cli('SW-1', ['configure terminal', 'interface fastethernet 0/2', 'no shutdown', 'end']);
ok((await done()).includes('sw_unused_ports'), 'no shutdown on F0/2 restores the task');

// ("no ip default-gateway" isn't built yet — logged as backlog in CHANGELOG-v1.44.0.)

// running-config on RTR-A: ports keep their pre-set addresses
await cli('RTR-A', ['show running-config']);
T = await termText();
ok(/interface GigabitEthernet0\/0\/0\n ip address 192\.168\.1\.1 255\.255\.255\.0\n!/.test(T), 'RTR-A running-config: G0/0/0 address, no shutdown line');
ok(/line vty 0 4\n exec-timeout 7 0\n login local\n transport input ssh/.test(T), 'RTR-A running-config: vty 0 4 block');

// SSH from PC into RTR-A with NETadmin (not a lab requirement, but the lab sets it up)
await pc('PC', ['ssh -l NETadmin 192.168.1.1', 'LogAdmin!9']);
// (the RTR-A> prompt shows in the PC's input row, not in its output lines)
ok((await ev(`ptDevices['PC'].sshSucceeded === true && pcConsoleFor('PC').ssh !== null && pcConsoleFor('PC').ssh.stage === 'session'`)) === true,
  'PC can SSH to RTR-A as NETadmin (password LogAdmin!9)');
await pc('PC', ['exit']);

// Topology: SW-2 (diagram-only, verified from the real activity) sits between RTR-A and Remote PC
const topo = await ev(`(function(){ptTopologyBtn.click();return ptTopologySvgWrap.textContent})()`);
ok(/SW-2/.test(topo) && /G0\/0\/1/.test(topo), 'topology diagram shows SW-2 and RTR-A G0/0/1');
await send('Emulation.setDeviceMetricsOverride', { width: 1300, height: 1000, deviceScaleFactor: 1, mobile: false });
await ev(`ptTopologyPanel.scrollIntoView()`); await sleep(300);
{ const sh = await send('Page.captureScreenshot', { format: 'png' }); (await import('node:fs')).writeFileSync(PROFILE + '-topology.png', Buffer.from(sh.result.data, 'base64')); }
await ev(`ptTopologyBtn.click()`);
ok((await ev(`[...document.querySelectorAll('#ptDeviceButtons button')].some(b=>b.textContent==='SW-2')`)) === false, 'SW-2 has no device button (no tasks)');

// Reset
await ev(`ptResetBtn.click()`);
ok((await done()).length === 0, 'reset: every task back to not done');
await cli('RTR-A', ['enable', 'show ip interface brief']);
ok(/GigabitEthernet0\/0\/0\s+192\.168\.1\.1/.test(await termText()), 'reset: RTR-A still starts pre-addressed');

ok(errs.length === 0, 'no page errors: ' + JSON.stringify(errs));
console.log(results.join('\n'));
console.log(results.length + ' checks, ' + results.filter(r => r.startsWith('FAIL')).length + ' failed');
ws.close(); chrome.kill(); process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
