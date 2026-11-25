import test from 'node:test';
import assert from 'node:assert/strict';
import { compareAll, ALGORITHMS, summarise } from '../modules/analysis/compareAll.js';
import { simulateFCFS } from '../modules/algorithms/fcfs.js';
import { simulateSJF, simulateSRTF } from '../modules/algorithms/sjf.js';
import { simulateRR } from '../modules/algorithms/roundRobin.js';
import { simulatePriority } from '../modules/algorithms/priority.js';
import { rng, randomWorkload } from './reference.js';

const workloads = (seed, n = 600) => { const r = rng(seed); return Array.from({ length: n }, () => ({ procs: randomWorkload(r, 9, 15, 10), q: 1 + Math.floor(r() * 7) })); };

test('total burst equals CPU busy time for every algorithm', () => {
  for (const { procs, q } of workloads(11)) for (const row of compareAll(procs, q)) {
    const busy = row.result.timeline.filter(t => t.pid !== 'IDLE').reduce((s, t) => s + t.end - t.start, 0);
    assert.equal(busy, procs.reduce((s, p) => s + p.bt, 0), row.name);
  }
});
test('timeline is gapless, ordered, positive-length and ends at the last completion', () => {
  for (const { procs, q } of workloads(12)) for (const row of compareAll(procs, q)) {
    const tl = row.result.timeline;
    for (let i = 0; i < tl.length; i++) {
      assert.ok(tl[i].end > tl[i].start, `${row.name} empty slice`);
      if (i) assert.equal(tl[i].start, tl[i - 1].end, `${row.name} gap or overlap`);
    }
    assert.equal(tl[0].start, Math.min(...procs.map(p => p.at)), `${row.name} start`);
    assert.equal(tl[tl.length - 1].pid === 'IDLE', false, `${row.name} trailing idle`);
  }
});
test('avg turnaround = avg waiting + avg burst, and RT <= WT, all >= 0', () => {
  for (const { procs, q } of workloads(13)) for (const row of compareAll(procs, q)) {
    const avgBt = procs.reduce((s, p) => s + p.bt, 0) / procs.length;
    assert.ok(Math.abs(row.result.avgTat - (row.result.avgWt + avgBt)) < 1e-9, row.name);
    for (const m of row.result.metrics) assert.ok(m.rt >= 0 && m.rt <= m.wt && m.wt >= 0, `${row.name} ${m.pid}`);
  }
});
test('CPU utilisation is in (0, 1] and is 1 when nobody waits idle', () => {
  for (const { procs, q } of workloads(14)) for (const row of compareAll(procs, q)) {
    assert.ok(row.cpuUtilization > 0 && row.cpuUtilization <= 1);
    const hasIdle = row.result.timeline.some(t => t.pid === 'IDLE');
    assert.equal(row.cpuUtilization === 1, !hasIdle);
  }
});
test('non-preemptive algorithms run every process in exactly one slice', () => {
  for (const { procs } of workloads(15)) for (const r of [simulateFCFS(procs), simulateSJF(procs)]) {
    const seen = {};
    for (const t of r.timeline.filter(t => t.pid !== 'IDLE')) { seen[t.pid] = (seen[t.pid] || 0) + 1; }
    for (const p of procs) assert.equal(seen[p.pid], 1);
  }
});
test('Round Robin never runs a slice longer than the quantum', () => {
  for (const { procs, q } of workloads(16)) for (const t of simulateRR(procs, q).timeline.filter(t => t.pid !== 'IDLE'))
    assert.ok(t.end - t.start <= q);
});
test('SRTF is optimal for average waiting time (<= every other algorithm)', () => {
  for (const { procs, q } of workloads(17)) {
    const srtf = simulateSRTF(procs).avgWt;
    for (const row of compareAll(procs, q)) assert.ok(srtf <= row.avgWt + 1e-9, row.name);
  }
});
test('SJF never beats SRTF and FCFS metrics ignore priorities', () => {
  for (const { procs } of workloads(18)) {
    assert.ok(simulateSRTF(procs).avgWt <= simulateSJF(procs).avgWt + 1e-9);
    const shuffledPr = procs.map(p => ({ ...p, pr: 6 - p.pr }));
    assert.deepEqual(simulateFCFS(procs).timeline, simulateFCFS(shuffledPr).timeline);
    assert.deepEqual(simulateSJF(procs).timeline, simulateSJF(shuffledPr).timeline);
  }
});
test('results do not depend on the input row order except for tie-breaking by arrival', () => {
  for (const { procs, q } of workloads(19, 300)) {
    const uniqueAt = new Set(procs.map(p => p.at)).size === procs.length;
    if (!uniqueAt) continue;
    const rev = [...procs].reverse();
    for (const [a, b] of [[simulateFCFS(procs), simulateFCFS(rev)], [simulateRR(procs, q), simulateRR(rev, q)], [simulatePriority(procs), simulatePriority(rev)]])
      assert.deepEqual(a.timeline, b.timeline);
  }
});
test('inputs are not mutated and results are deterministic', () => {
  for (const { procs, q } of workloads(20, 100)) {
    const copy = JSON.parse(JSON.stringify(procs));
    const a = compareAll(procs, q), b = compareAll(procs, q);
    assert.deepEqual(procs, copy);
    assert.deepEqual(a, b);
  }
});
test('compareAll returns the five algorithms and context switches count process changes only', () => {
  const rows = compareAll([{ pid: 'P1', at: 0, bt: 5, pr: 1 }], 2);
  assert.deepEqual(rows.map(r => r.key), ['fcfs', 'sjf', 'srtf', 'rr', 'pr']);
  assert.equal(ALGORITHMS.length, 5);
  for (const r of rows) assert.equal(r.contextSwitches, 0);   // one process split in slices is not a switch
  assert.equal(summarise(rows[3].result).contextSwitches, 0);
});
