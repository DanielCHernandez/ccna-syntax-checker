// Plays lab 16.4.6 (and checks on 10.3 / 10.3.5) through the real Home Labs UI.
import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const [,, PROFILE, OUT, URL] = process.argv;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=9340', `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let t;
for (let i = 0; i < 50; i++) { try { t = await (await fetch('http://127.0.0.1:9340/json')).json(); break } catch { await sleep(200) } }
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description) };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(x.slice(0, 80) + ' -> ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result.result.value; };
const shot = async (name, w = 1180, h = 900) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false }); await sleep(250); const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.result.data, 'base64')); };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: URL }); await sleep(1500);
const results = []; const ok = (c, m) => results.push((c ? 'PASS ' : 'FAIL ') + m);

const openLab = async labId => { await ev(`document.getElementById('btnPacketTracer').click()`); await ev(`ptModuleSelect.value='${labId}';ptModuleSelect.dispatchEvent(new Event('change'))`); await sleep(150); };
const pickDevice = async dev => { await ev(`[...document.querySelectorAll('#ptDeviceButtons button')].find(b=>b.textContent==='${dev}').click()`); };
const cli = async (dev, lines) => { await pickDevice(dev); for (const l of lines) { await ev(`ptInputEl.value=${JSON.stringify(l)};handlePtSubmit()`); } };
const pcTab = async which => ev(`document.getElementById('${which === 'cmd' ? 'ptPcTabCmd' : 'ptPcTabIp'}').click()`);
const pc = async (dev, lines) => { await pickDevice(dev); await pcTab('cmd'); for (const l of lines) { await ev(`ptPcInput.value=${JSON.stringify(l)};ptPcInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}))`); } };
const pcText = () => ev(`pcConsoleFor(ptActiveDeviceId).lines.join('\\n')`);
const done = async () => ev(`(function(){const ex=getPtExercise(ptExerciseId);return ex.tasks.map(t=>(t.check(ptDevices[t.device])?'x':'.')+' '+t.id)})()`);
const termText = () => ev(`ptTerminalEl.innerText`);

// ---------- 16.4.6 ----------
await openLab('c1_pt_16.4.6_secure_passwords_ssh');
ok((await ev(`[...document.querySelectorAll('#ptDeviceButtons button')].map(b=>b.textContent).join(',')`)) === 'PCA,RTA,SW1', 'device buttons are PCA, RTA, SW1');
ok((await done()).every(x => x.startsWith('.')), 'no task starts already done');
await pickDevice('PCA'); await pcTab('cmd');
await pc('PCA', ['ipconfig']);
let txt = await pcText();
ok(txt.includes('   Link-local IPv6 Address.........: FE80::204:9AFF:FE64:227D'), 'PCA ipconfig shows the captured link-local address');
ok(txt.includes('   IPv4 Address....................: 0.0.0.0') && txt.includes('                                     0.0.0.0'), 'blank PCA shows 0.0.0.0 incl. gateway second line');
await pc('PCA', ['ipconfig 172.16.1.10 255.255.255.0 172.16.1.1', 'ping 172.16.1.1']);
txt = await pcText();
ok(/C:\\>ipconfig 172\.16\.1\.10 255\.255\.255\.0 172\.16\.1\.1\nC:\\>ping 172\.16\.1\.1\n\nPinging 172\.16\.1\.1 with 32 bytes of data:\n\nRequest timed out\.\n(Request timed out\.\n){3}\nPing statistics for 172\.16\.1\.1:\n    Packets: Sent = 4, Received = 0, Lost = 4 \(100% loss\),\n$/.test(txt), 'set-IP prints nothing; ping to shut G0/0 fails exactly as captured');
await shot('1646-pca-fail');
await cli('RTA', ['enable', 'configure terminal', 'hostname RTA', 'interface gigabitethernet 0/0', 'ip address 172.16.1.1 255.255.255.0', 'no shutdown', 'exit']);
await pc('PCA', ['ping 172.16.1.1', 'ping 172.16.1.99']);
txt = await pcText();
ok(txt.includes('Reply from 172.16.1.1: bytes=32 time<1ms TTL=255\nReply from 172.16.1.1: bytes=32 time<1ms TTL=255') &&
   txt.includes('    Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),\nApproximate round trip times in milli-seconds:\n    Minimum = 0ms, Maximum = 0ms, Average = 0ms'), 'ping to RTA succeeds, TTL=255, exact summary');
ok(/Pinging 172\.16\.1\.99[\s\S]*Lost = 4 \(100% loss\),\n$/.test(txt), 'ping to unused address times out');
await cli('RTA', ['end', 'ping 172.16.1.10', 'configure terminal', 'service password-encryption', 'security passwords min-length 10', 'enable secret short']);
txt = await termText();
ok(txt.includes('Type escape sequence to abort.') && txt.includes('!!!!!') && txt.includes('round-trip min/avg/max = 0/0/0 ms'), 'RTA pings PCA through the lab model (!!!!!, 0/0/0)');
ok(txt.includes('% Password too short - must be at least 10 characters. Password not configured.'), 'short enable secret rejected with captured message');
// v1.42.1: RTA's terminal text survives a trip to PCA and back
ok(txt.includes('hostname RTA') && txt.includes('ip address 172.16.1.1 255.255.255.0'), "RTA's earlier commands are still in its terminal after switching to PCA and back");
await cli('RTA', ['enable secret itexamanswers', 'no ip domain-lookup', 'ip domain-name CCNA.com', 'username jony secret itexamanswers.net',
  'crypto key generate rsa general-keys modulus 1024', 'login block-for 180 attempts 4 within 120', 'line vty 0 4', 'transport input ssh', 'login local', 'exec-timeout 6', 'end', 'copy running-config startup-config', '']);
await shot('1646-rta');
let d = await done();
ok(d.filter(x => x.includes(' rta_')).every(x => x.startsWith('x')), 'all RTA tasks done: ' + d.filter(x => x.includes(' rta_') && x.startsWith('.')).join(' '));
ok(d.includes('x pca_ip') && d.includes('. pca_ssh'), 'PCA IP task done, SSH task not yet');
// SSH: wrong x3 then right
await pc('PCA', ['ssh -l jony 172.16.1.1', 'wrong1', 'wrong2', 'wrong3']);
txt = await pcText();
ok(txt.endsWith('C:\\>ssh -l jony 172.16.1.1\n\nPassword: \n% Login invalid\n\n\nPassword: \n% Login invalid\n\n\nPassword: \n\n[Connection to 172.16.1.1 closed by foreign host]'), 'wrong password x3 matches capture exactly');
ok((await ev(`ptPcPromptLabel.textContent`)) === 'C:\\>', 'back at C:\\> after 3 failures');
await pc('PCA', ['ssh -l jony 172.16.1.1']);
ok((await ev(`ptPcPromptLabel.textContent+'|'+ptPcInput.type`)) === 'Password:|password', 'password prompt masks input');
await pc('PCA', ['itexamanswers.net']);
ok((await ev(`ptPcPromptLabel.textContent`)) === 'RTA>', 'logged in: prompt is RTA>');
await pc('PCA', ['show ip interface brief', 'enable', 'itexamanswers', 'configure terminal', 'end']);
txt = await pcText();
ok(txt.includes('RTA>show ip interface brief\nInterface') && txt.includes('GigabitEthernet0/0     172.16.1.1'), 'commands run on RTA over SSH');
ok(txt.includes('%SYS-5-CONFIG_I: Configured from console by jony on vty0 (172.16.1.10)'), 'config change logged against the vty session');
ok((await ev(`ptDevices.RTA.mode`)) === 'priv_exec', "RTA's own console session untouched by the SSH session (still priv_exec)");
await pc('PCA', ['exit']);
txt = await pcText();
ok(txt.endsWith('RTA#exit\n\n[Connection to 172.16.1.1 closed by foreign host]'), 'exit closes session exactly as captured');
await shot('1646-pca-ssh');
// v1.42.1: copying the PC prompt gives truly empty blank lines (no stray space)
const copied = await ev(`(function(){const r=document.createRange();r.selectNodeContents(document.getElementById('ptPcTerminal'));const s=getSelection();s.removeAllRanges();s.addRange(r);const t=s.toString();s.removeAllRanges();return t})()`);
ok(copied.includes('\n\nPassword: \n% Login invalid\n\n\nPassword: ') && !/\n[ \u00a0]+\n/.test(copied), 'copied PC prompt text has truly empty blank lines');
await pc('PCA', ['ssh-l jony 172.16.1.1']);
ok((await pcText()).endsWith('C:\\>ssh-l jony 172.16.1.1\nInvalid Command.\n'), 'typo gives Invalid Command. + blank line');
ok((await done()).includes('x pca_ssh'), 'SSH task done');
// SW1
await cli('SW1', ['enable', 'configure terminal', 'hostname SW1', 'interface vlan 1', 'ip address 172.16.1.2 255.255.255.0', 'no shutdown', 'exit',
  'ip default-gateway 172.16.1.1', 'interface range fastethernet 0/2-24, gigabitethernet 0/2', 'shutdown', 'exit', 'service password-encryption', 'enable secret itexamanswers',
  'no ip domain-lookup', 'ip domain-name CCNA.com', 'username jony secret itexamanswers.net', 'crypto key generate rsa general-keys modulus 1024',
  'line vty 0 15', 'transport input ssh', 'login local', 'exec-timeout 6', 'end', 'copy running-config startup-config', '']);
txt = await termText();
ok(txt.includes('SW1(config-if-range)#') || txt.includes('SW1(config-if-range)'), 'range prompt shown');
await shot('1646-sw1');
d = await done();
ok(d.every(x => x.startsWith('x')), 'ALL tasks done: ' + d.filter(x => x.startsWith('.')).join(' '));
await pc('PCA', ['ping 172.16.1.2']);
ok((await pcText()).includes('Reply from 172.16.1.2: bytes=32 time<1ms TTL=255'), 'PCA pings SW1 (SVI) through F0/1');
// shutting PCA's own port breaks it
await cli('SW1', ['configure terminal', 'interface fa0/1', 'shutdown', 'end']);
await pc('PCA', ['ping 172.16.1.1']);
ok(/Pinging 172\.16\.1\.1[\s\S]*Lost = 4 \(100% loss\),\n$/.test(await pcText()), "shutting PCA's switch port F0/1 breaks PCA's ping");
ok((await done()).includes('. sw1_unused_ports'), 'unused-ports task un-checks when F0/1 is shut too');
// reset
await ev(`ptResetBtn.click()`); await sleep(100);
await pickDevice('PCA'); await pcTab('cmd');
ok((await pcText()) === 'Cisco Packet Tracer PC Command Line 1.0', 'reset clears the PC prompt');
ok((await done()).every(x => x.startsWith('.')), 'reset: every task back to not done');

// ---------- 10.3: R1 now a 1941 (5 interfaces, not 7) ----------
await openLab('c1_pt_10.3_connect_router_to_lan');
await cli('R1', ['enable', 'configure terminal', 'interface g0/0', 'ip address 192.168.10.1 255.255.255.0', 'no shutdown', 'end', 'show ip interface brief']);
txt = await termText();
const rows = txt.split('\n').filter(l => /^(GigabitEthernet|Serial|Vlan)/.test(l));
ok(rows.length === 5 && rows[0].startsWith('GigabitEthernet0/0 '), '10.3 R1 lists exactly 5 interfaces (G0/0 first): ' + rows.length);
// v1.42.1: a global command typed inside interface mode steps out to (config)# and runs
await cli('R1', ['configure terminal', 'interface g0/1', 'ip domain-name CCNA.com']);
ok((await ev(`ptPromptLabel.textContent`)) === 'R1(config)#' && (await ev(`ptDevices.R1.domainName`)) === 'CCNA.com', 'ip domain-name from (config-if)# applies and returns to (config)#');

// ---------- 10.3.5: PC ping teaches the lab ----------
await openLab('c1_pt_10.3.5_troubleshoot_default_gateway');
await pc('PC4', ['ping 192.168.11.1', 'ping 192.168.10.10']);
txt = await pcText();
ok(txt.includes('Reply from 192.168.11.1: bytes=32 time<1ms TTL=255'), '10.3.5: PC4 reaches its own LAN gateway');
await pc('PC1', ['ping 192.168.10.1']);
ok(/Pinging 192\.168\.10\.1[\s\S]*100% loss/.test(await pcText()), '10.3.5: PC1 (wrong IP) cannot reach its gateway');
await pickDevice('PC1'); await pcTab('ip');
await ev(`ptPcIp.value='192.168.10.10';ptPcMask.value='255.255.255.0';ptPcGateway.value='192.168.10.1';ptPcSetBtn.click()`);
await pc('PC1', ['ping 192.168.11.11']);
ok(/Pinging 192\.168\.11\.11[\s\S]*100% loss/.test(await pcText()), '10.3.5: PC1 -> PC4 fails while PC4 gateway is wrong');
await pickDevice('PC4'); await pcTab('ip');
await ev(`ptPcGateway.value='192.168.11.1';ptPcSetBtn.click()`);
await pc('PC1', ['ping 192.168.11.11']);
ok((await pcText()).includes('Reply from 192.168.11.11: bytes=32 time<1ms TTL=127'), '10.3.5: after fixing PC4, PC1 -> PC4 works across the router (TTL=127)');
await shot('1035-pc1');

ok(errs.length === 0, 'no page errors: ' + JSON.stringify(errs));
writeFileSync(`${OUT}/lab-results.txt`, results.join('\n') + '\n');
console.log(results.join('\n'));
console.log(`${results.length} checks, ${results.filter(r => r.startsWith('FAIL')).length} failed`);
ws.close(); chrome.kill(); process.exit(0);
