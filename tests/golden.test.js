import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateFCFS } from '../modules/algorithms/fcfs.js';
import { simulateSJF, simulateSRTF } from '../modules/algorithms/sjf.js';
import { simulateRR } from '../modules/algorithms/roundRobin.js';
import { simulatePriority } from '../modules/algorithms/priority.js';

const close = (a, b, m = '') => assert.ok(Math.abs(a - b) < 1e-9, `${m} ${a} != ${b}`);
const segs = r => r.timeline.map(t => [t.pid, t.start, t.end]);
const col = (r, k) => r.metrics.map(m => m[k]);

// Textbook workload: three processes, all arrive at 0 (bursts 24, 3, 3).
const TB = [{ pid: 'P1', at: 0, bt: 24, pr: 3 }, { pid: 'P2', at: 0, bt: 3, pr: 1 }, { pid: 'P3', at: 0, bt: 3, pr: 2 }];

test('golden FCFS: textbook convoy (hand computed)', () => {
  const r = simulateFCFS(TB);
  assert.deepEqual(segs(r), [['P1', 0, 24], ['P2', 24, 27], ['P3', 27, 30]]);
  assert.deepEqual(col(r, 'wt'), [0, 24, 27]); assert.deepEqual(col(r, 'tat'), [24, 27, 30]);
  close(r.avgWt, 17); close(r.avgTat, 27); close(r.avgRt, 17);
});
test('golden SJF: same workload, short jobs first', () => {
  const r = simulateSJF(TB);
  assert.deepEqual(segs(r), [['P2', 0, 3], ['P3', 3, 6], ['P1', 6, 30]]);
  assert.deepEqual(col(r, 'wt'), [6, 0, 3]); close(r.avgWt, 3); close(r.avgTat, 13);
});
test('golden SRTF: classic 4-process example', () => {
  const r = simulateSRTF([{ pid: 'P1', at: 0, bt: 7, pr: 1 }, { pid: 'P2', at: 2, bt: 4, pr: 1 }, { pid: 'P3', at: 4, bt: 1, pr: 1 }, { pid: 'P4', at: 5, bt: 4, pr: 1 }]);
  assert.deepEqual(segs(r), [['P1', 0, 2], ['P2', 2, 4], ['P3', 4, 5], ['P2', 5, 7], ['P4', 7, 11], ['P1', 11, 16]]);
  assert.deepEqual(col(r, 'wt'), [9, 1, 0, 2]); close(r.avgWt, 3); close(r.avgTat, 7); close(r.avgRt, 0.5);
});
test('golden Round Robin q=4 on the textbook workload', () => {
  const r = simulateRR(TB, 4);
  assert.deepEqual(segs(r), [['P1', 0, 4], ['P2', 4, 7], ['P3', 7, 10], ['P1', 10, 14], ['P1', 14, 18], ['P1', 18, 22], ['P1', 22, 26], ['P1', 26, 30]]);
  assert.deepEqual(col(r, 'wt'), [6, 4, 7]); assert.deepEqual(col(r, 'tat'), [30, 7, 10]);
  close(r.avgWt, 17 / 3); close(r.avgTat, 47 / 3); close(r.avgRt, 11 / 3);
});
test('golden Round Robin with staggered arrivals q=2', () => {
  const r = simulateRR([{ pid: 'P1', at: 0, bt: 4, pr: 1 }, { pid: 'P2', at: 1, bt: 3, pr: 1 }, { pid: 'P3', at: 2, bt: 2, pr: 1 }], 2);
  assert.deepEqual(segs(r), [['P1', 0, 2], ['P2', 2, 4], ['P3', 4, 6], ['P1', 6, 8], ['P2', 8, 9]]);
  assert.deepEqual(col(r, 'wt'), [4, 5, 2]); assert.deepEqual(col(r, 'rt'), [0, 1, 2]);
  close(r.avgWt, 11 / 3); close(r.avgTat, 20 / 3); close(r.avgRt, 1);
});
test('golden Priority (preemptive): urgent job preempts, lower urgency waits', () => {
  const r = simulatePriority([{ pid: 'P1', at: 0, bt: 5, pr: 2 }, { pid: 'P2', at: 1, bt: 3, pr: 1 }, { pid: 'P3', at: 2, bt: 2, pr: 3 }]);
  assert.deepEqual(segs(r), [['P1', 0, 1], ['P2', 1, 4], ['P1', 4, 8], ['P3', 8, 10]]);
  assert.deepEqual(col(r, 'wt'), [3, 0, 6]); close(r.avgWt, 3); close(r.avgTat, 19 / 3); close(r.avgRt, 2);
});
test('golden: equal priorities behave like FCFS', () => {
  const procs = [{ pid: 'P1', at: 0, bt: 4, pr: 2 }, { pid: 'P2', at: 1, bt: 2, pr: 2 }, { pid: 'P3', at: 2, bt: 1, pr: 2 }];
  assert.deepEqual(segs(simulatePriority(procs)), segs(simulateFCFS(procs)));
});
test('golden: RR with a quantum larger than every burst equals FCFS', () => {
  const procs = [{ pid: 'P1', at: 0, bt: 4, pr: 1 }, { pid: 'P2', at: 1, bt: 2, pr: 1 }, { pid: 'P3', at: 9, bt: 3, pr: 1 }];
  assert.deepEqual(segs(simulateRR(procs, 100)), segs(simulateFCFS(procs)));
});
test('golden: all arrive together, ties broken by input order', () => {
  const procs = [{ pid: 'X', at: 0, bt: 2, pr: 1 }, { pid: 'Y', at: 0, bt: 2, pr: 1 }, { pid: 'Z', at: 0, bt: 2, pr: 1 }];
  for (const r of [simulateFCFS(procs), simulateSJF(procs), simulateSRTF(procs), simulatePriority(procs)])
    assert.deepEqual(r.timeline.map(t => t.pid), ['X', 'Y', 'Z']);
});
