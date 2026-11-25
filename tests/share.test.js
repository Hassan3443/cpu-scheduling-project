import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeSetup, decodeSetup } from '../modules/ui/share.js';
import { stateAt } from '../modules/ui/cpuDiagram.js';
import { ALGORITHMS } from '../modules/analysis/compareAll.js';
import { PRESETS } from '../modules/input/presets.js';
import { simulateRR } from '../modules/algorithms/roundRobin.js';
import { simulateFCFS } from '../modules/algorithms/fcfs.js';
import { simulatePriority } from '../modules/algorithms/priority.js';
import { simulateSJF } from '../modules/algorithms/sjf.js';

test('share link round-trips every preset', () => {
  for (const p of PRESETS) {
    const back = decodeSetup('#' + encodeSetup(p.procs, p.quantum));
    assert.deepEqual(back, { procs: p.procs.map(({ pid, at, bt, pr }) => ({ pid, at, bt, pr })), quantum: p.quantum });
  }
});
test('share link rejects bad or hostile input', () => {
  for (const bad of ['', '#', '#q=0&p=A.0.1.1', '#q=2&p=A.0.0.1', '#q=2&p=A.0.1.1~A.1.1.1', '#q=2&p=<b>.0.1.1', '#q=x&p=A.0.1.1', '#q=2&p=A.-1.1.1', '#q=2&p=A.0.1', '#q=2&p=A.0.1.1.9', '#q=2&p=A.1e3.1.1'])
    assert.equal(decodeSetup(bad), null, bad);
});
test('equal priority and equal burst ties are broken by arrival then input order', () => {
  const P = [{ pid: 'A', at: 0, bt: 4, pr: 2 }, { pid: 'B', at: 0, bt: 4, pr: 2 }, { pid: 'C', at: 0, bt: 4, pr: 2 }];
  const order = r => r.timeline.map(s => s.pid).join('');
  assert.equal(order(simulateFCFS(P)), 'ABC');
  assert.equal(order(simulateSJF(P)), 'ABC');
  assert.equal(order(simulatePriority(P)), 'ABC');
});
test('RR convention: arrival at the instant a slice ends is queued before the preempted process', () => {
  const r = simulateRR([{ pid: 'A', at: 0, bt: 4, pr: 1 }, { pid: 'B', at: 2, bt: 2, pr: 1 }], 2);
  assert.deepEqual(r.timeline.map(s => s.pid), ['A', 'B', 'A']);
});
test('diagram snapshots are consistent for random workloads and every algorithm', () => {
  let seed = 7; const rnd = n => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
  for (let k = 0; k < 300; k++) {
    const n = 1 + rnd(5), P = [];
    for (let i = 0; i < n; i++) P.push({ pid: 'P' + i, at: rnd(8), bt: 1 + rnd(6), pr: 1 + rnd(4) });
    const q = 1 + rnd(4);
    for (const a of ALGORITHMS) {
      const tl = a.run(P, q).timeline, total = tl[tl.length - 1].end;
      let prevDone = 0;
      for (let t = 0; t <= total; t++) {
        const st = stateAt(P, tl, t);
        assert.ok(st.filter(s => s.status === 'running').length <= 1);
        for (const s of st) {
          const p = P.find(x => x.pid === s.pid);
          assert.ok(s.rem >= 0 && s.rem <= p.bt);
          if (s.status === 'incoming') assert.ok(p.at > t && s.rem === p.bt);
          if (s.status === 'done') assert.equal(s.rem, 0);
          if (s.status === 'ready' || s.status === 'running') assert.ok(p.at <= t && s.rem > 0);
        }
        const done = st.filter(s => s.status === 'done').length;
        assert.ok(done >= prevDone); prevDone = done;
      }
      assert.ok(stateAt(P, tl, total).every(s => s.status === 'done'));
    }
  }
});

test('ready queue order shown matches RR convention (arrival ahead of preempted)', () => {
  const P = [{ pid: 'A', at: 0, bt: 5, pr: 1 }, { pid: 'B', at: 2, bt: 3, pr: 2 }, { pid: 'C', at: 4, bt: 2, pr: 1 }];
  const tl = simulateRR(P, 2).timeline;
  const st = stateAt(P, tl, 5).filter(x => x.status === 'ready').sort((a, b) => a.since - b.since || (a.ran - b.ran) || a.at - b.at);
  assert.deepEqual(st.map(x => x.pid), ['C', 'B']);
  assert.deepEqual(tl.map(s => s.pid + s.start), ['A0', 'B2', 'A4', 'C6', 'B8', 'A9']);
});
