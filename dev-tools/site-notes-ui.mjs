// Site v20 notes pages: text-size dropdown + "Collapse" button at the end of each section.
// Usage: node --experimental-websocket site-notes-ui.mjs <chrome-profile-dir> <screenshot-dir> <base-url-of-Site-v20>
import { spawn } from 'node:child_process'; import { writeFileSync } from 'node:fs';
const [,, PROFILE, OUT, BASE] = process.argv;
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', '--remote-debugging-port=9347', `--user-data-dir=${PROFILE}`, 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms)); let t;
for (let i = 0; i < 50; i++) { try { t = await (await fetch('http://127.0.0.1:9347/json')).json(); break } catch { await sleep(200) } }
const ws = new WebSocket(t.find(x => x.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
let id = 0; const pend = new Map(); const errs = [];
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } if (m.method === 'Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.exception?.description) };
const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(x.slice(0, 90) + ' -> ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text)); return r.result.result.value; };
const go = async u => { await send('Page.navigate', { url: BASE + u }); await sleep(700); };
const shot = async (name, w, h, mobile) => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile }); await sleep(300); const s = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.result.data, 'base64')); };
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });
const results = []; const ok = (c, m) => results.push((c ? 'PASS ' : 'FAIL ') + m);
const bodyFs = () => ev(`getComputedStyle(document.body).fontSize`);
const M1 = 'study-hub/ccna1/ccna1_module1_networking_today_v2.2.html';
const C2M3 = 'study-hub/ccna2/ccna2_module3_vlans_v2.2.html';

// --- every notes page: a 7-option dropdown, no old S/M/L/XL buttons, one Collapse per section
const pages = await (async () => { await go('index.html'); return ['study-hub/ccna1/index.html', 'study-hub/ccna2/index.html', 'study-hub/ccna3/index.html'] })();
const modules = JSON.parse(process.argv[5] || '[]');
for (const p of [...pages, ...modules]) {
  await go(p);
  const r = await ev(`({opts:[...document.querySelectorAll('.fs-select option')].map(o=>o.value).join(','),btns:document.querySelectorAll('.fs-btn').length,
    secs:document.querySelectorAll('.sec > .sb, .section > .section-body').length, cols:document.querySelectorAll('.sec-collapse').length})`);
  const good = r.opts === '14px,16px,18px,20px,23px,26px,30px' && r.btns === 0 && r.secs === r.cols;
  if (!good) ok(false, p + ' ' + JSON.stringify(r));
}
ok(true, `checked ${pages.length + modules.length} pages for dropdown/no old buttons/one Collapse per section`);

// --- text size: pick Huge (26px) on one page; it sticks after reload and on other pages
await go(M1);
await ev(`localStorage.removeItem('ccna-fs')`); await go(M1);
const def = await bodyFs();
await ev(`(function(){const s=document.querySelector('.fs-select');s.value='26px';s.dispatchEvent(new Event('change'))})()`);
ok((await bodyFs()) === '26px', `choosing Huge sets body text to 26px (default was ${def})`);
await go(M1);
ok((await bodyFs()) === '26px' && (await ev(`document.querySelector('.fs-select').value`)) === '26px', 'Huge survives a reload and the dropdown shows it');
await go('study-hub/ccna2/index.html');
ok((await bodyFs()) === '26px' && (await ev(`document.querySelector('.fs-select').value`)) === '26px', 'Huge also applies on another page (CCNA 2 course page)');
await go(M1);
await ev(`(function(){const s=document.querySelector('.fs-select');s.value='30px';s.dispatchEvent(new Event('change'))})()`);
ok((await bodyFs()) === '30px', 'Giant = 30px');
await ev(`(function(){const s=document.querySelector('.fs-select');s.value='16px';s.dispatchEvent(new Event('change'))})()`);

// --- collapse at the bottom of a long section
for (const [page, sec] of [[M1, 's2'], [C2M3, 's32']]) {
  await go(page);
  await ev(`(function(){const s=document.getElementById('${sec}');const h=s.querySelector('.sh,.section-header'),b=s.querySelector('.sb,.section-body');if(!b.classList.contains('open')){h.classList.add('open');b.classList.add('open');}})()`);
  await ev(`document.querySelector('#${sec} .sec-collapse').scrollIntoView({block:'center'})`); await sleep(300);
  if (page === M1) await shot('collapse-button', 1024, 900, false);
  const label = await ev(`document.querySelector('#${sec} .sec-collapse').textContent`);
  await ev(`document.querySelector('#${sec} .sec-collapse').click()`); await sleep(900);
  const r = await ev(`(function(){const s=document.getElementById('${sec}');const b=s.querySelector('.sb,.section-body');const bar=document.querySelector('.fs-bar');
    return {open:b.classList.contains('open'), top:Math.round(s.getBoundingClientRect().top), bar:bar.offsetHeight}})()`);
  ok(!r.open && r.top >= 0 && r.top <= r.bar + 20, `${page.split('/').pop().split('_v2')[0]} ${sec}: "${label}" closes the section and brings its header to the top (top=${r.top}px, bar=${r.bar}px)`);
}
// --- check marks unaffected
await go(M1); await ev(`localStorage.removeItem('ccna1-module1-networking-today')`); await go(M1);
await ev(`document.getElementById('sch-s3').click()`); await go(M1);
ok(await ev(`document.getElementById('sch-s3').classList.contains('checked') && document.getElementById('pill-s3').classList.contains('checked')`), 'Mark done still saves across a reload');

// --- screenshots: phone bar, tablet at Huge
await go(M1); await shot('phone-bar', 390, 700, true);
await ev(`(function(){const s=document.querySelector('.fs-select');s.value='26px';s.dispatchEvent(new Event('change'))})()`);
await ev(`(function(){const s=document.getElementById('s1');s.querySelector('.sh').classList.add('open');s.querySelector('.sb').classList.add('open');s.scrollIntoView()})()`);
await shot('tablet-huge', 1024, 1300, true);
await ev(`localStorage.removeItem('ccna-fs')`);

ok(errs.length === 0, 'no page errors: ' + JSON.stringify(errs));
console.log(results.join('\n')); console.log(`${results.length} checks, ${results.filter(r => r.startsWith('FAIL')).length} failed`);
ws.close(); chrome.kill(); process.exit(0);
