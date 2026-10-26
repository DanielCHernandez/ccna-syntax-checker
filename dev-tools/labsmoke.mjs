import { spawn } from 'node:child_process';
const chrome=spawn(process.env.CHROME || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),['--headless=new','--remote-debugging-port=9341',`--user-data-dir=${process.argv[2]}`,'about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); let t;
for(let i=0;i<50;i++){try{t=await(await fetch('http://127.0.0.1:9341/json')).json();break}catch{await sleep(200)}}
const ws=new WebSocket(t.find(x=>x.type==='page').webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0;const pend=new Map();const errs=[];ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)} if(m.method==='Runtime.exceptionThrown')errs.push(m.params.exceptionDetails.exception?.description)};
const send=(method,params={})=>new Promise(r=>{const i=++id;pend.set(i,r);ws.send(JSON.stringify({id:i,method,params}))});
const ev=async x=>(await send('Runtime.evaluate',{expression:x,returnByValue:true})).result.result.value;
await send('Runtime.enable');await send('Page.enable'); await send('Page.navigate',{url:process.argv[3]}); await sleep(1500);
await ev(`document.getElementById('btnPacketTracer').click()`);
const labs=await ev(`PT_EXERCISES.map(e=>e.id)`);
for (const l of labs) {
  await ev(`ptModuleSelect.value='${l}';ptModuleSelect.dispatchEvent(new Event('change'))`); await sleep(100);
  const r=await ev(`(function(){const ex=getPtExercise(ptExerciseId);const out=[];for(const d of ex.devices){[...document.querySelectorAll('#ptDeviceButtons button')].find(b=>b.textContent===d.label).click();
     if(d.deviceType==='pc'){document.getElementById('ptPcTabCmd').click();ptPcInput.value='ipconfig';ptPcInput.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter'}));out.push(d.id+':'+(pcConsoleFor(d.id).lines.length>5?'ok':'??'));}
     else {ptInputEl.value='show ip interface brief';handlePtSubmit();out.push(d.id+':'+(ptTerminalEl.innerText.includes('Interface')?'ok':'??'));}}
     return out.join(' ')+' | tasks done at start: '+ex.tasks.filter(t=>t.check(ptDevices[t.device])).length})()`);
  console.log(l.padEnd(46), r);
}
// Huge text: PC prompt scales like the device terminals
await ev(`fontSizeSelect.value='1.7';fontSizeSelect.dispatchEvent(new Event('change'))`); await sleep(200);
console.log('Huge: PC prompt font', await ev(`document.getElementById('ptPcTerminal').style.fontSize`), '| device terminal font', await ev(`ptTerminalEl.style.fontSize`), '| PC input', await ev(`ptPcInput.style.fontSize`));
console.log('page errors:', errs.length?errs:'none');
ws.close();chrome.kill();process.exit(0);
