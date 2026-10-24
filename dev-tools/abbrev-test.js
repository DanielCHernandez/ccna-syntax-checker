// v1.42.2: Guided Practice must accept equivalent spellings and reject wrong ones.
// Usage: node abbrev-test.js <ios-engine-vX.js>
const E = require(process.argv[2]);
const SUBS = [
  [/\bconfigure terminal\b/gi, 'conf t'], [/\binterface\b/gi, 'int'], [/\bshow\b/gi, 'sh'],
  [/\bGigabitEthernet ?/gi, 'g'], [/\bFastEthernet ?/gi, 'fa'], [/\bSerial ?(?=\d)/gi, 's'],
  [/\brunning-config\b/gi, 'run'], [/\bstartup-config\b/gi, 'start'], [/\bshutdown\b/gi, 'shut'],
  [/\bbrief\b/gi, 'br'], [/\bswitchport\b/gi, 'sw'], [/\bdescription\b/gi, 'desc'], [/\baddress\b/gi, 'add'],
];
const variant = l => SUBS.reduce((s, [re, to]) => s.replace(re, to), l);
const prep = (ex, d) => {
  if (ex.precondition && /privileged EXEC/.test(ex.precondition)) E.executeLine(d, 'enable');
  if (ex.id === 'c3_syn_2.6_verify_ospfv2') { E.executeLine(d, 'enable'); E.getExercise('c3_syn_2.1_ospfv2_point_to_point').steps.forEach(s => E.executeLine(d, s.expected)); E.executeLine(d, 'end'); }
};
let rejectedVariants = [], wrongAccepted = [], tried = 0, exactBad = 0;
for (const ex of E.EXERCISES) {
  if (ex.status !== 'available') continue;
  const dev = () => E.createDevice(ex.deviceType === 'switch' ? 'Switch' : 'Router', ex.deviceType || 'router');
  // 1) exact text, device passed in
  let d = dev(); prep(ex, d); let run = E.createExerciseRun(ex.id);
  for (const s of ex.steps) { const c = E.checkExerciseStep(run, s.expected, d); if (!c.correct) exactBad++; E.executeLine(d, s.expected); }
  // 2) shorthand variants + 3) one-number-changed wrong answers
  d = dev(); prep(ex, d); run = E.createExerciseRun(ex.id);
  for (const s of ex.steps) {
    const v = variant(s.expected);
    if (v !== s.expected) {
      tried++;
      const probe = E.createExerciseRun(ex.id); probe.stepIndex = run.stepIndex;
      if (!E.checkExerciseStep(probe, v, d).correct) rejectedVariants.push(ex.id + ' | ' + s.expected + '  ->  ' + v);
    }
    const m = s.expected.match(/\d+(?!.*\d)/);
    if (m && !d.pendingPrompt) {
      const n = Number(m[0]); const wrong = s.expected.slice(0, m.index) + (n === 9 ? 8 : n + 1) + s.expected.slice(m.index + m[0].length);
      const probe = E.createExerciseRun(ex.id); probe.stepIndex = run.stepIndex;
      if (E.checkExerciseStep(probe, wrong, d).correct) wrongAccepted.push(ex.id + ' | expected ' + s.expected + ' | accepted ' + wrong);
    }
    E.checkExerciseStep(run, s.expected, d); E.executeLine(d, s.expected);
  }
}
console.log('exact commands not accepted:', exactBad);
console.log('shorthand variants tried:', tried, '| rejected:', rejectedVariants.length); rejectedVariants.forEach(x => console.log('   REJECTED', x));
console.log('wrong answers accepted:', wrongAccepted.length); wrongAccepted.forEach(x => console.log('   ACCEPTED', x));
