// v1.43.2: replays the real ISR4331 "% Incomplete command." capture
// (Syn-Checker v1.43.2/captures-v1.43.2.md) through the real UI — the Free
// Practice terminal and a Home Labs device — checking the exact lines shown
// (no "^", no blank line after), plus the "^" under a bad wildcard and Tab
// after permit/deny.
// Usage: node --experimental-websocket incomplete.mjs <chrome-profile-dir> <url>
import { spawn } from 'node:child_process';
const [,, PROFILE, URL] = process.argv;
const chrome = spawn(process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'), ['--headless=new', '--remote-debugging-port=9345', `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let t;
for (let i = 0; i < 50; i++) { try { t = await (await fetch('http://127.0.0.1:9345/json')).json(); break } catch { await sleep(200) } }
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description) };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(x.slice(0, 80) + ' -> ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result.result.value; };
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: URL }); await sleep(1500);
const results = []; const ok = (c, m) => results.push((c ? 'PASS ' : 'FAIL ') + m);
const lines = el => ev(`[...${el}.children].map(d=>d.textContent)`);

// The capture's lines, as this tool shows them (a space after each prompt).
const expected = [
  'Router> enable', 'Router# configure terminal',
  'Router(config)# hostname', '% Incomplete command.',
  'Router(config)# access-list 1 permit', '% Incomplete command.',
  'Router(config)# interface g0/0/0',
  'Router(config-if)# ip address', '% Incomplete command.',
  'Router(config-if)# exit',
  'Router(config)# ip access-list extended TEST',
  'Router(config-ext-nacl)# permit tcp', '% Incomplete command.',
  'Router(config-ext-nacl)# end'];
const typed = ['enable', 'configure terminal', 'hostname', 'access-list 1 permit', 'interface g0/0/0', 'ip address', 'exit',
  'ip access-list extended TEST', 'permit tcp', 'end'];
const tail = (L, n) => L.slice(L.length - n).filter(x => !x.startsWith('%SYS-5-CONFIG_I'));

// ---- Free Practice terminal
await ev(`document.getElementById('btnFree') ? document.getElementById('btnFree').click() : [...document.querySelectorAll('button')].find(b=>b.textContent==='Free Practice').click()`);
const enter = l => ev(`inputEl.value=${JSON.stringify(l)};inputEl.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))`);
for (const l of typed) await enter(l);
let L = await lines('terminalEl');
let got = tail(L, expected.length + 1);
ok(JSON.stringify(got) === JSON.stringify(expected), 'Free Practice: capture replayed line for line (no ^, no blank line)' + (JSON.stringify(got) === JSON.stringify(expected) ? '' : '\n   got: ' + JSON.stringify(got)));

// bad wildcard "^" in the page
for (const l of ['configure terminal', 'access-list 1 permit 192.168.20.0 0.0.0255']) await enter(l);
L = await lines('terminalEl'); let k = L.lastIndexOf('Router(config)# access-list 1 permit 192.168.20.0 0.0.0255');
ok(k >= 0 && L[k + 1] === ' '.repeat(L[k].indexOf('0.0.0255')) + '^' && L[k + 2] === "% Invalid input detected at '^' marker." && L[k + 3] === '',
  'Free Practice: ^ under 0.0.0255, then the message, then a blank line');

// Tab after "permit" in the page
await ev(`inputEl.value='access-list 1 permit ho';inputEl.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab'}))`);
ok((await ev(`inputEl.value`)) === 'access-list 1 permit host ', 'Free Practice: Tab completes "access-list 1 permit ho" to host (input box)');
L = await lines('terminalEl');
ok(L[L.length - 1] === 'Router(config)# access-list 1 permit host', 'Free Practice: Tab echoes the completed line');
await enter('end');

// ---- Home Labs device terminal
await ev(`document.getElementById('btnPacketTracer').click();ptModuleSelect.value='c1_pt_16.4.6_secure_passwords_ssh';ptModuleSelect.dispatchEvent(new Event('change'))`);
await ev(`[...document.querySelectorAll('#ptDeviceButtons button')].find(b=>b.textContent==='RTA').click()`);
for (const l of typed) await ev(`ptInputEl.value=${JSON.stringify(l)};handlePtSubmit()`);
L = await lines('ptTerminalEl');
got = tail(L, expected.length + 1);
ok(JSON.stringify(got) === JSON.stringify(expected), 'Home Labs RTA: capture replayed line for line' + (JSON.stringify(got) === JSON.stringify(expected) ? '' : '\n   got: ' + JSON.stringify(got)));

// ---- v1.43.2 (per direction): "Exercise reset" names the exercise
await ev(`document.getElementById('btnGuided').click();moduleSelectEl.value='c3_syn_5.2_standard_acls';moduleSelectEl.dispatchEvent(new Event('change'));resetExerciseBtn.click()`);
L = await lines('terminalEl');
ok(L[L.length - 1] === 'Exercise reset: Course 3 · SyntxChk · 5.2 — Configure Numbered Standard ACLs', 'Reset exercise names it: ' + L[L.length - 1]);

ok(errs.length === 0, 'no page errors: ' + JSON.stringify(errs));
console.log(results.join('\n'));
console.log(results.length + ' checks, ' + results.filter(r => r.startsWith('FAIL')).length + ' failed');
ws.close(); chrome.kill(); process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
