// v1.43.0: plays Home Lab 2.9.1 through the real UI, and checks the "^" marker in
// all three terminals (Guided/Free, Home Labs device, SSH session in a PC prompt).
// Usage: node --experimental-websocket lab291.mjs <chrome-profile-dir> <url>
import { spawn } from 'node:child_process';
const [,, PROFILE, URL] = process.argv;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=9344', `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let t;
for (let i = 0; i < 50; i++) { try { t = await (await fetch('http://127.0.0.1:9344/json')).json(); break } catch { await sleep(200) } }
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description) };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(x.slice(0, 80) + ' -> ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result.result.value; };
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: URL }); await sleep(1500);
const results = []; const ok = (c, m) => results.push((c ? 'PASS ' : 'FAIL ') + m);
const lines = el => ev(`${el}.innerText.split('\\n')`);

// ---- "^" in the Free Practice terminal
await ev(`document.getElementById('btnFree') ? document.getElementById('btnFree').click() : [...document.querySelectorAll('button')].find(b=>b.textContent==='Free Practice').click()`);
for (const l of ['enable', 'configure terminal', 'show ip interface brief']) await ev(`inputEl.value=${JSON.stringify(l)};inputEl.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))`);
let L = await lines('terminalEl'); let k = L.findIndex(x => x.endsWith('show ip interface brief'));
ok(k >= 0 && L[k + 1].indexOf('^') === L[k].indexOf('show') && L[k + 2] === "% Invalid input detected at '^' marker.", 'Free Practice: ^ under "show" + real IOS message');

// ---- Home Lab 2.9.1 end to end
await ev(`document.getElementById('btnPacketTracer').click();ptModuleSelect.value='c1_pt_2.9.1_basic_switch_end_device';ptModuleSelect.dispatchEvent(new Event('change'))`);
const pick = d => ev(`[...document.querySelectorAll('#ptDeviceButtons button')].find(b=>b.textContent==='${d}').click()`);
const cli = async (d, ls) => { await pick(d); for (const l of ls) await ev(`ptInputEl.value=${JSON.stringify(l)};handlePtSubmit()`); };
const pc = async (d, ls) => { await pick(d); await ev(`document.getElementById('ptPcTabCmd').click()`); for (const l of ls) await ev(`ptPcInput.value=${JSON.stringify(l)};ptPcInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))`); };
const done = () => ev(`(function(){const ex=getPtExercise(ptExerciseId);return ex.tasks.map(t=>(t.check(ptDevices[t.device])?'x':'.')+' '+t.id)})()`);
ok((await ev(`[...document.querySelectorAll('#ptDeviceButtons button')].map(b=>b.textContent).join(',')`)) === 'Class-A,Class-B,Student-1,Student-2', 'device buttons Class-A, Class-B, Student-1, Student-2');
ok((await done()).every(x => x.startsWith('.')), 'no task starts done');
const sw = (name, ip) => ['enable', 'configure terminal', 'hostname ' + name, 'enable secret C4aJa', 'line console 0', 'password R4Xe3', 'login', 'exit', 'line vty 0 15', 'password R4Xe3', 'login', 'exit',
  'service password-encryption', 'banner motd #Unauthorized access to this device is prohibited!#', 'interface vlan 1', 'ip address ' + ip + ' 255.255.255.0', 'no shutdown', 'exit', 'end', 'copy running-config startup-config', ''];
await cli('Class-A', sw('Class-A', '128.107.20.10'));
await cli('Class-A', ['banana']);
L = await lines('ptTerminalEl'); k = L.findIndex(x => x.endsWith('# banana'));
ok(k >= 0 && L[k + 1].indexOf('^') === L[k].indexOf('banana') && L[k + 2] === "% Invalid input detected at '^' marker.", 'Home Labs terminal: ^ under "banana"');
await cli('Class-A', ['show running-config']);
const run = (await ev(`ptTerminalEl.innerText`));
ok(/enable secret 5 \$1\$[.\/0-9A-Za-z]{4}\$[.\/0-9A-Za-z]{22}/.test(run), 'running-config: enable secret shown hashed (5 $1$...)');
ok(/interface Vlan1\n ip address 128\.107\.20\.10 255\.255\.255\.0\n!/.test(run), 'running-config: active Vlan1 has no "no shutdown" line');
await cli('Class-B', sw('Class-B', '128.107.20.15'));
await pc('Student-1', ['ipconfig 128.107.20.25 255.255.255.0']);
await pc('Student-2', ['ipconfig 128.107.20.30 255.255.255.0']);
ok((await done()).filter(x => x.startsWith('.')).join(' ') === '. verify_ping', 'everything but the ping-verify task done: ' + (await done()).filter(x => x.startsWith('.')).join(' '));
await pc('Student-1', ['ping 128.107.20.10', 'ping 128.107.20.15', 'ping 128.107.20.30']);
const out = await ev(`pcConsoleFor('Student-1').lines.join('\\n')`);
ok(out.includes('Reply from 128.107.20.10: bytes=32 time<1ms TTL=255') && out.includes('Reply from 128.107.20.15: bytes=32 time<1ms TTL=255') && out.includes('Reply from 128.107.20.30: bytes=32 time<1ms TTL=128'),
  'Student-1 pings both switches (TTL 255) and Student-2 (TTL 128) across the Fa0/1-Fa0/2 link');
ok((await done()).every(x => x.startsWith('x')), 'ALL 2.9.1 tasks done');
// v1.43.0: a COMPLETED task's hint can still be shown/hidden (passwords!)
const rowOf = `[...document.querySelectorAll('#ptTaskList .pt-task-item')].find(r=>r.textContent.includes('Set an encrypted privileged EXEC password'))`;
await ev(`${rowOf}.click()`);
const hint = await ev(`(function(){const r=${rowOf};const h=r.querySelector('.pt-task-hint');return {done:r.classList.contains('done'),text:h?h.textContent:null,deco:h?getComputedStyle(h).textDecorationLine:null}})()`);
ok(hint.done && hint.text === 'enable secret C4aJa' && hint.deco === 'none', 'completed task still shows its hint (enable secret C4aJa), not struck through');
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 900, deviceScaleFactor: 1, mobile: false });
await ev(`${rowOf}.scrollIntoView({block:'center'})`); await sleep(200);
{ const sh = await send('Page.captureScreenshot', { format: 'png' }); (await import('node:fs')).writeFileSync(PROFILE + '-done-hint.png', Buffer.from(sh.result.data, 'base64')); }
await ev(`${rowOf}.click()`);
ok((await ev(`!${rowOf}.querySelector('.pt-task-hint')`)), 'clicking the completed task again hides the hint');
// cutting the switch-to-switch link breaks Student-1 -> Student-2
await cli('Class-A', ['configure terminal', 'interface fa0/1', 'shutdown', 'end']);
await pc('Student-1', ['ping 128.107.20.30']);
ok(/Pinging 128\.107\.20\.30[\s\S]*100% loss\),\n$/.test(await ev(`pcConsoleFor('Student-1').lines.join('\\n')`)), 'shutting Class-A Fa0/1 (the link to Class-B) breaks the ping');

// ---- "^" inside an SSH session (PC prompt echo has no space)
await ev(`ptModuleSelect.value='c1_pt_16.4.6_secure_passwords_ssh';ptModuleSelect.dispatchEvent(new Event('change'))`);
await cli('RTA', ['enable', 'configure terminal', 'hostname RTA', 'interface g0/0', 'ip address 172.16.1.1 255.255.255.0', 'no shutdown', 'ip domain-name CCNA.com', 'username jony secret itexamanswers.net',
  'crypto key generate rsa general-keys modulus 1024', 'line vty 0 4', 'transport input ssh', 'login local', 'end']);
await pc('PCA', ['ipconfig 172.16.1.10 255.255.255.0 172.16.1.1', 'ssh -l jony 172.16.1.1', 'itexamanswers.net', 'shw version']);
const P = await ev(`pcConsoleFor('PCA').lines`); k = P.findIndex(x => x === 'RTA>shw version');
ok(k >= 0 && P[k + 1] === '    ^' && P[k + 2] === "% Invalid input detected at '^' marker." && P[k + 3] === '', 'SSH session: ^ under "shw" (prompt echoed without a space) + blank line');

ok(errs.length === 0, 'no page errors: ' + JSON.stringify(errs));
console.log(results.join('\n'));
console.log(`${results.length} checks, ${results.filter(r => r.startsWith('FAIL')).length} failed`);
ws.close(); chrome.kill(); process.exit(0);
