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
  const P = [{ pid: 'P1', at: 0, bt: 4, pr: 2 }, { pid: 'P2', at: 0, bt: 4, pr: 2 }, { pid: 'P3', at: 0, bt: 4, pr: 2 }];
  const order = r => r.timeline.map(s => s.pid).join('');
  assert.equal(order(simulateFCFS(P)), 'P1P2P3');
  assert.equal(order(simulateSJF(P)), 'P1P2P3');
  assert.equal(order(simulatePriority(P)), 'P1P2P3');
});
test('RR convention: arrival at the instant a slice ends is queued before the preempted process', () => {
  const r = simulateRR([{ pid: 'P1', at: 0, bt: 4, pr: 1 }, { pid: 'P2', at: 2, bt: 2, pr: 1 }], 2);
  assert.deepEqual(r.timeline.map(s => s.pid), ['P1', 'P2', 'P1']);
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
  const P = [{ pid: 'P1', at: 0, bt: 5, pr: 1 }, { pid: 'P2', at: 2, bt: 3, pr: 2 }, { pid: 'P3', at: 4, bt: 2, pr: 1 }];
  const tl = simulateRR(P, 2).timeline;
  const st = stateAt(P, tl, 5).filter(x => x.status === 'ready').sort((a, b) => a.since - b.since || (a.ran - b.ran) || a.at - b.at);
  assert.deepEqual(st.map(x => x.pid), ['P3', 'P2']);
  assert.deepEqual(tl.map(s => s.pid + s.start), ['P10', 'P22', 'P14', 'P36', 'P28', 'P19']);
});

import { mergeSlices, referenceTicks } from '../modules/ui/ganttChart.js';
test('mergeSlices joins back-to-back slices of one process and counts them', () => {
  const tl = [{ pid: 'P1', start: 0, end: 3 }, { pid: 'P1', start: 3, end: 6 }, { pid: 'P2', start: 6, end: 8 }, { pid: 'P1', start: 8, end: 11 }, { pid: 'IDLE', start: 11, end: 12 }, { pid: 'IDLE', start: 12, end: 13 }];
  const m = mergeSlices(tl);
  assert.deepEqual(m.map(x => [x.pid, x.start, x.end, x.slices]), [['P1', 0, 6, 2], ['P2', 6, 8, 1], ['P1', 8, 11, 1], ['IDLE', 11, 12, 1], ['IDLE', 12, 13, 1]]);
  assert.equal(tl.length, 6); // input untouched
});
test('referenceTicks fills long gaps without repeating event ticks', () => {
  assert.deepEqual(referenceTicks(27, [0, 1, 3, 5, 8, 27]), [10, 15, 20, 25]);
  assert.deepEqual(referenceTicks(100, [0, 50, 100]), [10, 20, 30, 40, 60, 70, 80, 90]);
});

import { slot } from '../modules/ui/cpuDiagram.js';
test('diagram slots: tokens never overlap in Incoming/Done and the queue squeezes when long', () => {
  for (const n of [1, 2, 4, 6, 8]) {
    const pts = Array.from({ length: n }, (_, i) => slot('incoming', -1, -1, i, { inc: n }));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      assert.ok(d >= 44 || n > 6, `n=${n} tokens ${i},${j} too close (${d.toFixed(1)})`);
    }
    pts.forEach(p => assert.ok(p.x >= 20 && p.x <= 130 && p.y >= 45 && p.y <= 215));
  }
  const q = Array.from({ length: 10 }, (_, i) => slot('ready', i, -1, -1, { ready: 10 }));
  assert.ok(q[9].x >= 170 && q[0].x <= 490);
  assert.deepEqual(slot('running', 0, 0, 0), { x: 655, y: 130, k: 1 });
});
