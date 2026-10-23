// Plays every exercise's expected commands; prints a transcript + any step that
// errors or isn't accepted. Usage: node regress.js <engine.js>
const E = require(process.argv[2]);
let out = [], bad = 0;
for (const ex of E.EXERCISES) {
  if (ex.status !== 'available') continue;
  const d = E.createDevice(ex.deviceType === 'switch' ? 'Switch' : 'Router', ex.deviceType || 'router');
  if (ex.precondition && /privileged EXEC/.test(ex.precondition)) E.executeLine(d, 'enable');
  // 2.6 Verify OSPF assumes 2.1 was already done on the same device (shared state, as in the app)
  if (ex.id === 'c3_syn_2.6_verify_ospfv2') { E.executeLine(d, 'enable'); E.getExercise('c3_syn_2.1_ospfv2_point_to_point').steps.forEach(s => E.executeLine(d, s.expected)); E.executeLine(d, 'end'); }
  const run = E.createExerciseRun(ex.id);
  out.push('### ' + ex.id);
  for (const s of ex.steps) {
    const before = E.getPrompt(d);
    const r = E.executeLine(d, s.expected);
    const c = E.checkExerciseStep(run, s.expected);
    out.push(before + ' ' + s.expected);
    if (r.text) out.push(r.text);
    if (r.error) { out.push('ERR ' + r.error); bad++; console.log('ERROR', ex.id, JSON.stringify(s.expected), r.error); }
    if (!c.correct) { bad++; console.log('NOT ACCEPTED', ex.id, s.expected); }
  }
  if (!run.complete) { bad++; console.log('INCOMPLETE', ex.id); }
}
require('fs').writeFileSync(process.argv[3], out.join('\n') + '\n');
console.log(E.EXERCISES.length + ' exercises, problems: ' + bad);
