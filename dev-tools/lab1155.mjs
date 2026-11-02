// v1.45.0: plays Home Lab 11.5.5 (Subnet an IPv4 Network) through the real UI.
// Usage: node --experimental-websocket lab1155.mjs <chrome-profile-dir> <screenshot-dir> <url>
import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const [,, PROFILE, OUT, URL] = process.argv;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=9348', `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let t;
for (let i = 0; i < 50; i++) { try { t = await (await fetch('http://127.0.0.1:9348/json')).json(); break } catch { await sleep(200) } }
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description) };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(x.slice(0, 80) + ' -> ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result.result.value; };
const shot = async (name, h = 1100) => { await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: h, deviceScaleFactor: 1, mobile: false }); await sleep(300); const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.result.data, 'base64')); };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 1100, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL }); await sleep(1500);
const results = []; const ok = (c, m) => results.push((c ? 'PASS ' : 'FAIL ') + m);
await ev(`document.getElementById('btnPacketTracer').click();ptModuleSelect.value='c1_pt_11.5.5_subnet_ipv4_network';ptModuleSelect.dispatchEvent(new Event('change'))`);
const pick = d => ev(`[...document.querySelectorAll('#ptDeviceButtons button')].find(b=>b.textContent==='${d}').click()`);
const cli = async (d, ls) => { await pick(d); for (const l of ls) await ev(`ptInputEl.value=${JSON.stringify(l)};handlePtSubmit()`); };
const pc = async (d, ls) => { await pick(d); await ev(`document.getElementById('ptPcTabCmd').click()`); for (const l of ls) await ev(`ptPcInput.value=${JSON.stringify(l)};ptPcInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))`); };
const done = () => ev(`(function(){const ex=getPtExercise(ptExerciseId);return ex.tasks.map(t=>(t.check(ptDevices[t.device])?'x':'.')+' '+t.id)})()`);

ok((await ev(`[...document.querySelectorAll('#ptDeviceButtons button')].map(b=>b.textContent).join(',')`)) === 'CustomerRouter,LAN-A,LAN-B,PC-A,PC-B', 'device buttons: CustomerRouter, LAN-A, LAN-B, PC-A, PC-B (ISP side diagram-only)');
ok((await done()).every(x => x.startsWith('.')), 'no task starts done');
ok((await ev(`document.querySelectorAll('#ptAddressingTable .pt-blank').length`)) === 16 && (await ev(`!!document.querySelector('.pt-blank-note')`)), 'addressing table: 16 blank cells + "work these out" note');
ok((await ev(`document.querySelector('#ptAddressingTable').textContent.includes('209.165.201.2')`)), 'WAN address (ISP-given) is filled in');
ok((await ev(`document.querySelectorAll('#ptPart1 .pt-part1-q').length`)) === 8 && (await ev(`document.querySelectorAll('#ptPart1 .pt-part1-a').length`)) === 0, 'Part 1: 8 questions, all answers hidden');
await shot('1155-start');
await ev(`document.querySelectorAll('#ptPart1 .pt-part1-q')[4].click()`);
ok((await ev(`document.querySelector('#ptPart1 .pt-part1-a').textContent`)).startsWith('/26'), 'clicking question 5 reveals its answer (/26)');
await shot('1155-part1-open');
await ev(`document.querySelectorAll('#ptPart1 .pt-part1-q')[4].click()`);
ok((await ev(`document.querySelectorAll('#ptPart1 .pt-part1-a').length`)) === 0, 'clicking again hides it');

await cli('CustomerRouter', ['enable', 'configure terminal', 'enable secret Class123', 'line console 0', 'password Cisco123', 'login', 'exit', 'hostname CustomerRouter',
  'interface gigabitethernet 0/0', 'ip address 192.168.0.1 255.255.255.192', 'no shutdown', 'exit',
  'interface gigabitethernet 0/1', 'ip address 192.168.0.65 255.255.255.192', 'no shutdown', 'exit',
  'interface serial 0/1/0', 'ip address 209.165.201.2 255.255.255.252', 'no shutdown', 'exit', 'end', 'copy running-config startup-config', '']);
await cli('LAN-A', ['enable', 'configure terminal', 'interface vlan 1', 'ip address 192.168.0.2 255.255.255.192', 'no shutdown', 'exit', 'ip default-gateway 192.168.0.1', 'end', 'copy running-config startup-config', '']);
await cli('LAN-B', ['enable', 'configure terminal', 'interface vlan 1', 'ip address 192.168.0.66 255.255.255.192', 'no shutdown', 'exit', 'ip default-gateway 192.168.0.65', 'end', 'copy running-config startup-config', '']);
await pc('PC-A', ['ipconfig 192.168.0.62 255.255.255.192 192.168.0.1']);
await pc('PC-B', ['ipconfig 192.168.0.126 255.255.255.192 192.168.0.65']);
ok((await done()).filter(x => x.startsWith('.')).join(' ') === '. verify_ping', 'everything but the ping-verify task done: ' + (await done()).filter(x => x.startsWith('.')).join(' '));
await pc('PC-A', ['ping 192.168.0.1', 'ping 192.168.0.126', 'ping 192.168.0.66']);
const out = await ev(`pcConsoleFor('PC-A').lines.join('\\n')`);
ok(out.includes('Reply from 192.168.0.1: bytes=32 time<1ms TTL=255') && out.includes('Reply from 192.168.0.126: bytes=32 time<1ms TTL=127') && out.includes('Reply from 192.168.0.66: bytes=32 time<1ms TTL=254'),
  'PC-A pings its gateway (255), PC-B across the router (127) and the LAN-B switch (254)');
ok((await done()).every(x => x.startsWith('x')), 'ALL 11.5.5 tasks done');
await cli('CustomerRouter', ['ping 209.165.201.1', 'show ip interface brief']);
const term = await ev(`ptTerminalEl.innerText`);
ok(/Sending 5, 100-byte ICMP Echos to 209\.165\.201\.1[^\n]*\n!!!!!/.test(term), 'CustomerRouter reaches the ISP router over the serial link (!!!!!)');
ok(/Serial0\/1\/0\s+209\.165\.201\.2\s+YES manual up\s+up/.test(term), 'show ip interface brief: Serial0/1/0 up/up with the WAN address');
// a wrong subnet answer is caught: give PC-B a /25 mask
await pc('PC-B', ['ipconfig 192.168.0.126 255.255.255.128 192.168.0.65']);
ok((await done()).includes('. pcb_ip'), 'a wrong mask on PC-B un-checks its task');
await ev(`document.getElementById('ptTopologyBtn').click()`); await sleep(300);
await ev(`document.getElementById('ptTopologyPanel').scrollIntoView()`);
await shot('1155-topology', 900);
ok(errs.length === 0, 'no page errors: ' + JSON.stringify(errs));
console.log(results.join('\n')); console.log(`${results.length} checks, ${results.filter(r => r.startsWith('FAIL')).length} failed`);
ws.close(); chrome.kill(); process.exit(0);
