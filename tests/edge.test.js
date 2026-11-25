import test from 'node:test';
import assert from 'node:assert/strict';
import { compareAll } from '../modules/analysis/compareAll.js';
import { simulateRR } from '../modules/algorithms/roundRobin.js';
import { simulateFCFS } from '../modules/algorithms/fcfs.js';
import { detectStarvation, STARVATION_THRESHOLD } from '../modules/analysis/analysis.js';
import { PRESETS } from '../modules/input/presets.js';

test('every preset is valid and runs through all five algorithms', () => {
  assert.ok(PRESETS.length >= 6);
  for (const p of PRESETS) {
    assert.ok(Number.isInteger(p.quantum) && p.quantum >= 1, p.name);
    assert.equal(new Set(p.procs.map(x => x.pid)).size, p.procs.length, p.name);
    const rows = compareAll(p.procs, p.quantum);
    assert.equal(rows.length, 5);
    for (const r of rows) assert.ok(Number.isFinite(r.avgWt) && Number.isFinite(r.avgTat) && Number.isFinite(r.avgRt), `${p.name} ${r.name}`);
  }
});
test('preset claims are true: long job first hurts FCFS, idle preset shows IDLE, urgent job preempts', () => {
  const by = n => PRESETS.find(p => p.name === n);
  const lj = by('Long job first'); const rows = Object.fromEntries(compareAll(lj.procs, lj.quantum).map(r => [r.key, r]));
  assert.ok(rows.sjf.avgWt < rows.fcfs.avgWt);
  const idle = by('CPU sits idle');
  assert.ok(compareAll(idle.procs, idle.quantum).every(r => r.result.timeline.some(t => t.pid === 'IDLE')));
  const late = by('Urgent job arrives late'); const pr = compareAll(late.procs, late.quantum).find(r => r.key === 'pr').result;
  assert.ok(pr.timeline.filter(t => t.pid === 'A').length >= 2);
  const lp = by('Low priority waits'); const p4 = compareAll(lp.procs, lp.quantum).find(r => r.key === 'pr').result.timeline.filter(t => t.pid !== 'IDLE').pop();
  assert.equal(p4.pid, 'P4');
});
test('single-unit bursts and quantum 1', () => {
  const procs = [{ pid: 'A', at: 0, bt: 1, pr: 1 }, { pid: 'B', at: 0, bt: 1, pr: 1 }];
  assert.deepEqual(simulateRR(procs, 1).timeline.map(t => t.pid), ['A', 'B']);
});
test('very large times and 60 processes stay exact', () => {
  const big = [{ pid: 'A', at: 1000000, bt: 500000, pr: 1 }, { pid: 'B', at: 1000001, bt: 1, pr: 1 }];
  const r = simulateFCFS(big);
  assert.equal(r.metrics[1].wt, 499999);
  const many = Array.from({ length: 60 }, (_, i) => ({ pid: 'P' + i, at: i % 7, bt: 1 + (i % 5), pr: 1 + (i % 4) }));
  for (const row of compareAll(many, 3)) assert.equal(row.result.metrics.length, 60);
});
test('metrics are listed by arrival time then input order', () => {
  const r = simulateFCFS([{ pid: 'late', at: 5, bt: 1, pr: 1 }, { pid: 'b', at: 0, bt: 1, pr: 1 }, { pid: 'a', at: 0, bt: 1, pr: 1 }]);
  assert.deepEqual(r.metrics.map(m => m.pid), ['b', 'a', 'late']);
});
test('starvation detection uses the documented threshold', () => {
  assert.equal(STARVATION_THRESHOLD, 20);
  assert.deepEqual(detectStarvation([{ pid: 'A', wt: 20 }, { pid: 'B', wt: 21 }]), [{ pid: 'B', wt: 21 }]);
});
test('Round Robin queue snapshot lists the ready queue the first time it is non-empty', () => {
  const r = simulateRR([{ pid: 'P1', at: 0, bt: 8, pr: 3 }, { pid: 'P2', at: 1, bt: 4, pr: 1 }, { pid: 'P3', at: 2, bt: 9, pr: 4 }, { pid: 'P4', at: 3, bt: 5, pr: 2 }], 4);
  assert.deepEqual(r.queueSnapshot, ['P2', 'P3', 'P4', 'P1']);
});
