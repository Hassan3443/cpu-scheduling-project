import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateRR } from '../modules/algorithms/roundRobin.js';
import { simulatePriority } from '../modules/algorithms/priority.js';
import { simulateFCFS } from '../modules/algorithms/fcfs.js';
import { simulateSJF, simulateSRTF } from '../modules/algorithms/sjf.js';
import { compareAll } from '../modules/analysis/compareAll.js';

// The demo workload from the app (Load Demo button).
const DEMO = [
  { pid: 'P1', at: 0, bt: 8, pr: 3 },
  { pid: 'P2', at: 1, bt: 4, pr: 1 },
  { pid: 'P3', at: 2, bt: 9, pr: 4 },
  { pid: 'P4', at: 3, bt: 5, pr: 2 }
];

const by = (r, pid) => r.metrics.find(m => m.pid === pid);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test('FCFS on the demo workload (hand computed)', () => {
  const r = simulateFCFS(DEMO);
  assert.deepEqual(r.timeline.map(t => [t.pid, t.start, t.end]),
    [['P1', 0, 8], ['P2', 8, 12], ['P3', 12, 21], ['P4', 21, 26]]);
  close(r.avgWt, 8.75); close(r.avgTat, 15.25); close(r.avgRt, 8.75);
});

test('SJF (non-preemptive) on the demo workload', () => {
  const r = simulateSJF(DEMO);
  assert.deepEqual(r.timeline.map(t => t.pid), ['P1', 'P2', 'P4', 'P3']);
  close(r.avgWt, 7.75); close(r.avgTat, 14.25);
});

test('SRTF preempts P1 when the shorter P2 arrives', () => {
  const r = simulateSRTF(DEMO);
  assert.deepEqual(r.timeline.map(t => [t.pid, t.start, t.end]),
    [['P1', 0, 1], ['P2', 1, 5], ['P4', 5, 10], ['P1', 10, 17], ['P3', 17, 26]]);
  close(r.avgWt, 6.5); close(r.avgTat, 13); close(r.avgRt, 4.25);
});

test('Round Robin q=4 on the demo workload', () => {
  const r = simulateRR(DEMO, 4);
  close(r.avgWt, 11.75); close(r.avgTat, 18.25); close(r.avgRt, 4.5);
});

test('Priority (preemptive) on the demo workload', () => {
  const r = simulatePriority(DEMO);
  close(r.avgWt, 6.5); close(r.avgTat, 13); close(r.avgRt, 4.25);
  assert.equal(by(r, 'P3').wt, 15);
});

test('an idle gap between two arrivals is drawn, and the timeline starts at the first arrival', () => {
  const procs = [{ pid: 'P1', at: 3, bt: 2, pr: 1 }, { pid: 'P2', at: 10, bt: 1, pr: 1 }];
  const r = simulateFCFS(procs);
  assert.deepEqual(r.timeline.map(t => [t.pid, t.start, t.end]),
    [['P1', 3, 5], ['IDLE', 5, 10], ['P2', 10, 11]]);
  assert.equal(by(r, 'P2').wt, 0);
});

test('single process', () => {
  const one = [{ pid: 'X', at: 0, bt: 5, pr: 1 }];
  for (const r of [simulateFCFS(one), simulateSJF(one), simulateSRTF(one), simulateRR(one, 2), simulatePriority(one)]) {
    assert.equal(r.avgWt, 0); assert.equal(r.avgTat, 5); assert.equal(r.avgRt, 0);
  }
});

// Small deterministic generator so the property tests are repeatable.
function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; }

test('invariants hold on 200 random workloads for every algorithm', () => {
  const rand = rng(42);
  for (let i = 0; i < 200; i++) {
    const n = 1 + Math.floor(rand() * 7);
    const procs = Array.from({ length: n }, (_, k) => ({
      pid: 'P' + (k + 1), at: Math.floor(rand() * 10), bt: 1 + Math.floor(rand() * 9), pr: 1 + Math.floor(rand() * 5)
    }));
    const q = 1 + Math.floor(rand() * 5);
    for (const row of compareAll(procs, q)) {
      const r = row.result;
      // turnaround = waiting + burst, and nobody finishes before arrival + burst
      for (const m of r.metrics) {
        assert.equal(m.tat, m.wt + m.bt, `${row.name} tat`);
        assert.ok(m.wt >= 0 && m.rt >= 0 && m.rt <= m.wt, `${row.name} wt/rt`);
      }
      // each process is given exactly its burst time, and slices never overlap or start early
      const ran = {};
      let prevEnd = -Infinity;
      for (const t of r.timeline.filter(t => t.pid !== 'IDLE')) {
        assert.ok(t.start >= prevEnd, `${row.name} overlap`);
        prevEnd = t.end;
        ran[t.pid] = (ran[t.pid] || 0) + (t.end - t.start);
        const p = procs.find(x => x.pid === t.pid);
        assert.ok(t.start >= p.at, `${row.name} ran before arrival`);
      }
      for (const p of procs) assert.equal(ran[p.pid], p.bt, `${row.name} burst of ${p.pid}`);
    }
  }
});

test('SRTF never has a worse average waiting time than FCFS or SJF', () => {
  const rand = rng(7);
  for (let i = 0; i < 200; i++) {
    const procs = Array.from({ length: 2 + Math.floor(rand() * 5) }, (_, k) => ({
      pid: 'P' + (k + 1), at: Math.floor(rand() * 8), bt: 1 + Math.floor(rand() * 9), pr: 1
    }));
    const srtf = simulateSRTF(procs).avgWt;
    assert.ok(srtf <= simulateSJF(procs).avgWt + 1e-9);
    assert.ok(srtf <= simulateFCFS(procs).avgWt + 1e-9);
  }
});

test('the same idle gap between arrivals shows in Round Robin and Priority too', () => {
  const procs = [{ pid: 'P1', at: 3, bt: 2, pr: 1 }, { pid: 'P2', at: 10, bt: 1, pr: 1 }];
  for (const r of [simulateRR(procs, 2), simulatePriority(procs)]) {
    assert.deepEqual(r.timeline.map(t => [t.pid, t.start, t.end]),
      [['P1', 3, 5], ['IDLE', 5, 10], ['P2', 10, 11]]);
    close(r.cpuUtilization, 3 / 8);
  }
});

test('Round Robin puts a new arrival ahead of the preempted process (hand computed)', () => {
  // A(0,5) B(2,3) q=2: A 0-2, B 2-4, A 4-6, B 6-7, A 7-8
  const r = simulateRR([{ pid: 'P1', at: 0, bt: 5, pr: 1 }, { pid: 'P2', at: 2, bt: 3, pr: 1 }], 2);
  assert.deepEqual(r.timeline.map(t => [t.pid, t.start, t.end]),
    [['P1', 0, 2], ['P2', 2, 4], ['P1', 4, 6], ['P2', 6, 7], ['P1', 7, 8]]);
  assert.equal(by(r, 'P1').wt, 3); assert.equal(by(r, 'P2').wt, 2);
});

test('bad input is rejected instead of looping forever', () => {
  const ok = [{ pid: 'P1', at: 0, bt: 2, pr: 1 }];
  assert.throws(() => simulateRR(ok, 0), RangeError);
  assert.throws(() => simulateRR(ok, 1.5), RangeError);
  assert.throws(() => simulateFCFS([{ pid: 'P1', at: 0, bt: 0, pr: 1 }]), RangeError);
  assert.throws(() => simulatePriority([{ pid: 'P1', at: -1, bt: 2, pr: 1 }]), RangeError);
  assert.throws(() => simulateSJF([ok[0], ok[0]]), RangeError);
});
