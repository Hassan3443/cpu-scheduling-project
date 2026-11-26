// Regression tests for the review fixes (Claude + Gemini review of commit dd118bd).
import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateFCFS } from '../modules/algorithms/fcfs.js';
import { simulateSJF, simulateSRTF } from '../modules/algorithms/sjf.js';
import { simulatePriority } from '../modules/algorithms/priority.js';
import { simulateRR } from '../modules/algorithms/roundRobin.js';
import { LIMITS, countSwitches } from '../modules/algorithms/common.js';
import { compareAll, best, bestRows } from '../modules/analysis/compareAll.js';
import { buildSummary, overallWinner, detectStarvation } from '../modules/analysis/analysis.js';
import { encodeSetup, decodeSetup } from '../modules/ui/share.js';
import { SCENARIOS, renderScenarioResultsHtml } from '../modules/testing/testScenarios.js';
import { rng, randomWorkload } from './reference.js';

const P = (pid, at, bt, pr = 1) => ({ pid, at, bt, pr });
const ALL = [simulateFCFS, simulateSJF, simulateSRTF, simulatePriority, p => simulateRR(p, 2)];

test('a process named IDLE is rejected by every algorithm, in any case', () => {
  for (const pid of ['IDLE', 'idle', 'Idle'])
    for (const run of ALL) assert.throws(() => run([P(pid, 0, 3), P('P2', 10, 2)]), /IDLE/);
});

test('huge or unsafe numbers throw instead of hanging the engine', () => {
  for (const bad of [1e21, 1e20, 1e9, LIMITS.maxTime + 1, 2 ** 53, Infinity, NaN, 1.5, '5'])
    for (const run of ALL) {
      assert.throws(() => run([P('A', 0, bad)]), RangeError, `bt ${bad}`);
      assert.throws(() => run([P('A', bad, 1)]), RangeError, `at ${bad}`);
    }
  assert.throws(() => simulateRR([P('A', 0, 3)], 1e21), RangeError);
  assert.throws(() => simulateRR([P('A', 0, 3)], 0), RangeError);
  assert.throws(() => simulateRR([P('A', 0, 3)], LIMITS.maxQuantum + 1), RangeError);
});

test('the maximum allowed values still run and are exact', () => {
  const r = simulatePriority([P('A', LIMITS.maxTime, LIMITS.maxTime)]);
  assert.equal(r.metrics[0].tat, LIMITS.maxTime);
});

test('too many processes, bad ids and duplicates that differ only in case are rejected', () => {
  const many = Array.from({ length: LIMITS.maxProcs + 1 }, (_, i) => P('P' + i, 0, 1));
  assert.throws(() => simulateFCFS(many), RangeError);
  assert.throws(() => simulateFCFS([P('p1', 0, 1), P('P1', 0, 1)]), /unique/);
  assert.throws(() => simulateFCFS([P('<b>', 0, 1)]), RangeError);
  assert.throws(() => simulateFCFS([P('a'.repeat(13), 0, 1)]), RangeError);
});

test('priority must be a whole number 1 to 99 for the priority algorithm only', () => {
  for (const pr of [undefined, NaN, 'x', 0, 100, 1.5, null])
    assert.throws(() => simulatePriority([{ pid: 'A', at: 0, bt: 2, pr }, { pid: 'B', at: 0, bt: 1, pr: 1 }]), RangeError, String(pr));
  assert.doesNotThrow(() => simulateFCFS([{ pid: 'A', at: 0, bt: 2 }])); // FCFS ignores pr
});

test('contextSwitches on every result counts changes of process, not slices', () => {
  const one = simulateRR([P('X', 0, 5)], 2);
  assert.equal(one.contextSwitches, 0);
  assert.equal(countSwitches(one.timeline), 0);
  const tb = [P('P1', 0, 8), P('P2', 1, 4), P('P3', 2, 9), P('P4', 3, 5)];
  for (const row of compareAll(tb, 4)) {
    assert.equal(row.result.contextSwitches, countSwitches(row.result.timeline), row.name);
    assert.equal(row.contextSwitches, row.result.contextSwitches, row.name);
  }
  assert.equal(countSwitches([{ pid: 'A', start: 0, end: 1 }, { pid: 'IDLE', start: 1, end: 3 }, { pid: 'A', start: 3, end: 4 }]), 0);
  assert.equal(countSwitches([{ pid: 'A', start: 0, end: 1 }, { pid: 'IDLE', start: 1, end: 3 }, { pid: 'B', start: 3, end: 4 }]), 1);
});

test('best() picks the highest CPU utilisation and every tied row is reported', () => {
  const rows = [{ key: 'a', cpuUtilization: 0.5, avgWt: 2 }, { key: 'b', cpuUtilization: 0.9, avgWt: 2 }, { key: 'c', cpuUtilization: 0.9, avgWt: 3 }];
  assert.equal(best(rows, 'cpuUtilization').key, 'b');
  assert.deepEqual(bestRows(rows, 'cpuUtilization').map(r => r.key), ['b', 'c']);
  assert.deepEqual(bestRows(rows, 'avgWt').map(r => r.key), ['a', 'b']);
  assert.equal(best(rows, 'avgWt').key, 'a');
});

test('share links: same rules as the engine (case, IDLE, limits, quantum text)', () => {
  assert.equal(decodeSetup('#q=2&p=p1.0.2.1~P1.1.2.1'), null);
  assert.equal(decodeSetup('#q=2&p=IDLE.0.2.1'), null);
  assert.equal(decodeSetup('#q=1e1&p=A.0.2.1'), null);
  assert.equal(decodeSetup('#q=100&p=A.0.2.1'), null);
  assert.equal(decodeSetup('#q=2&p=A.0.1000.1'), null);
  assert.equal(decodeSetup('#q=2&p=A.0.2.0'), null);
  assert.ok(decodeSetup('#q=2&p=A.0.2.1'));
});

test('every setup the editor limits allow also round-trips through a share link', () => {
  const rand = rng(7);
  for (let i = 0; i < 100; i++) {
    const procs = randomWorkload(rand, LIMITS.maxProcs, LIMITS.maxTime, LIMITS.maxTime).map(p => ({ ...p, pr: 1 + (p.pr % LIMITS.maxPriority) }));
    const q = 1 + (i % LIMITS.maxQuantum);
    assert.deepEqual(decodeSetup('#' + encodeSetup(procs, q)), { procs, quantum: q });
  }
  const edge = [P('A'.repeat(12), LIMITS.maxTime, LIMITS.maxTime, LIMITS.maxPriority)];
  assert.deepEqual(decodeSetup('#' + encodeSetup(edge, LIMITS.maxQuantum)), { procs: edge, quantum: LIMITS.maxQuantum });
});

const rrOf = (procs, q) => simulateRR(procs, q), prOf = procs => simulatePriority(procs);
const SC = i => SCENARIOS[i - 1];

test('overall winner: tie is a tie, not Priority', () => {
  for (const n of [3, 7]) {
    const sc = SC(n);
    assert.equal(overallWinner(rrOf(sc.procs, sc.quantum), prOf(sc.procs)), 'tie', `scenario ${n}`);
  }
  assert.equal(overallWinner(rrOf(SC(6).procs, 3), prOf(SC(6).procs)), 'rr');
  assert.equal(overallWinner(rrOf(SC(1).procs, 4), prOf(SC(1).procs)), 'pr');
});

test('scenario results card says tied on a tie and names no winner', () => {
  for (const n of [3, 7]) {
    const sc = SC(n), rr = rrOf(sc.procs, sc.quantum), pr = prOf(sc.procs);
    const html = renderScenarioResultsHtml(n - 1, rr, pr, detectStarvation(rr.metrics), detectStarvation(pr.metrics));
    assert.match(html, /Tied overall/);
    assert.doesNotMatch(html, /wins overall/);
  }
  const sc = SC(1), rr = rrOf(sc.procs, 4), pr = prOf(sc.procs);
  assert.match(renderScenarioResultsHtml(0, rr, pr, [], []), /Priority wins overall/);
});

test('summary text on a tie is neutral and never names a winner', () => {
  const sc = SC(3), s = buildSummary(rrOf(sc.procs, 5), prOf(sc.procs), 5);
  assert.equal(s.winner, 'tie');
  assert.match(s.conclusionHtml, /both scored the same/);
  assert.doesNotMatch(s.conclusionHtml, /Tied achieved|more efficient/);
});

test('summary: long waits are reported for BOTH algorithms, outside the strengths lists', () => {
  const sc = SC(3), s = buildSummary(rrOf(sc.procs, 5), prOf(sc.procs), 5);
  assert.match(s.conclusionHtml, /under Round Robin: P1 \(WT=30\), P2 \(WT=30\), P3 \(WT=25\)/);
  assert.match(s.conclusionHtml, /under Priority Scheduling: P3 \(WT=35\), P4 \(WT=45\)/);
  assert.doesNotMatch(s.gridHtml, /⚠|Starvation/);
  assert.doesNotMatch(s.conclusionHtml, /prevents starvation/);
});

test('summary: strengths follow the data, not fixed text', () => {
  // Priority has the shorter longest wait here, so Round Robin must not claim fairness.
  const procs = [P('P1', 0, 10, 2), P('P2', 0, 1, 1)];
  const s = buildSummary(rrOf(procs, 5), prOf(procs), 5);
  assert.ok(s.prWins.some(t => /Shorter longest wait \(1 vs 5\)/.test(t)));
  assert.ok(!s.rrWins.some(t => /Fair|longest wait/.test(t)));
  // both algorithms credited symmetrically when nobody waits long
  assert.ok(s.rrWins.some(t => /No process waited longer/.test(t)) && s.prWins.some(t => /No process waited longer/.test(t)));
});

// ---- scenario prose: every number quoted in the text is recomputed from the real engine ----
const g = r => r.timeline.map(t => `${t.pid} ${t.start}-${t.end}`).join(', ');
const wts = r => Object.fromEntries(r.metrics.map(m => [m.pid, m.wt]));

test('scenario 1 prose matches the real output', () => {
  const sc = SC(1), rr = rrOf(sc.procs, 4), pr = prOf(sc.procs);
  assert.equal(g(pr), 'P1 0-1, P2 1-5, P4 5-10, P1 10-17, P3 17-26');
  assert.deepEqual(wts(rr), { P1: 12, P2: 3, P3: 15, P4: 17 });
  assert.deepEqual(wts(pr), { P1: 9, P2: 0, P3: 15, P4: 2 });
  assert.equal(rr.avgWt.toFixed(2), '11.75'); assert.equal(pr.avgWt.toFixed(2), '6.50');
  for (const t of ['P1 runs first (0-1)', '6.50 vs 11.75', 'P1 9 vs 12, P2 0 vs 3, P3 15 vs 15, P4 2 vs 17']) assert.ok(sc.expected.includes(t), t);
});
test('scenario 2 prose matches the real output', () => {
  const sc = SC(2), rr = rrOf(sc.procs, 3), pr = prOf(sc.procs);
  assert.equal(g(pr), 'P1 0-4, P3 4-8, P1 8-12, P_urgent 12-14, P1 14-18, P2 18-24');
  assert.equal(wts(pr).P_urgent, 0); assert.equal(wts(rr).P_urgent, 6);
  assert.equal(rr.timeline.find(t => t.pid === 'P_urgent').start, 18);
  assert.equal(rr.avgWt.toFixed(2), '9.50'); assert.equal(pr.avgWt.toFixed(2), '5.50');
  assert.equal(wts(pr).P2, 16); assert.equal(wts(rr).P2, 7);
  for (const t of ['5.50 vs 9.50', 'waits 6 units and runs 18-20', '(16 vs 7)']) assert.ok(sc.expected.includes(t), t);
});
test('scenario 3 prose matches the real output', () => {
  const sc = SC(3), rr = rrOf(sc.procs, 5), pr = prOf(sc.procs);
  assert.equal(rr.avgWt, 25); assert.equal(pr.avgWt, 25); assert.equal(rr.avgTat, 37.5); assert.equal(pr.avgTat, 37.5);
  assert.deepEqual(detectStarvation(pr.metrics).map(p => p.pid), ['P3', 'P4']);
  assert.deepEqual(detectStarvation(rr.metrics).map(p => p.pid), ['P1', 'P2', 'P3']);
  assert.equal(wts(pr).P1, 0); assert.equal(wts(pr).P4, 45);
  for (const t of ['(25.00)', '(37.50)', 'P1 waits 0 and P4 waits 45', 'P3 and P4 wait more than 20', 'P1, P2 and P3 also exceed 20', '50 units']) assert.ok(sc.expected.includes(t) || sc.desc.includes(t), t);
});
test('scenario 4 prose matches the real output', () => {
  const sc = SC(4), rr = rrOf(sc.procs, 4), pr = prOf(sc.procs);
  assert.equal(g(pr).startsWith('P_low 0-1, P_hi1 1-9'), true);
  assert.equal(pr.timeline.at(-1).start, 30); assert.equal(pr.timeline.at(-1).end, 34);
  assert.equal(wts(pr).P_low, 29); assert.equal(wts(rr).P_low, 16);
  assert.deepEqual(rr.timeline.filter(t => t.pid === 'P_low').map(t => [t.start, t.end]), [[0, 4], [20, 21]]);
  assert.equal(wts(rr).P_hi3, 22); assert.equal(wts(rr).P_hi4, 24);
  assert.equal(pr.avgWt.toFixed(2), '13.80'); assert.equal(rr.avgWt.toFixed(2), '19.40');
  for (const t of ['wait 29', 'finishes at 34', 'wait 16', '22 and 24', '13.80 vs 19.40']) assert.ok(sc.expected.includes(t), t);
});
test('scenario 6 prose matches the real output (no idle bar, timeline starts at t=3)', () => {
  const sc = SC(6), rr = rrOf(sc.procs, 3), pr = prOf(sc.procs);
  assert.ok(!rr.timeline.some(t => t.pid === 'IDLE') && !pr.timeline.some(t => t.pid === 'IDLE'));
  assert.equal(rr.timeline[0].start, 3);
  assert.equal(g(pr), 'P1 3-5, P4 5-11, P1 11-13, P2 13-16, P3 16-18');
  assert.equal(rr.avgWt.toFixed(2), '5.50'); assert.equal(pr.avgWt.toFixed(2), '6.75');
  assert.doesNotMatch(sc.desc + sc.expected, /idle from t=0|Idle gap t=0/);
  for (const t of ['5.50 vs 6.75', 'finishes first (5-11)']) assert.ok(sc.expected.includes(t), t);
});
test('scenario 7 prose matches the real output', () => {
  const sc = SC(7), rr = rrOf(sc.procs, 5), pr = prOf(sc.procs);
  assert.equal(pr.timeline.length, 1);
  assert.deepEqual(rr.timeline.map(t => [t.start, t.end]), [[0, 5], [5, 7]]);
  for (const r of [rr, pr]) { assert.equal(r.metrics[0].wt, 0); assert.equal(r.metrics[0].rt, 0); assert.equal(r.metrics[0].tat, 7); }
  assert.ok(sc.expected.includes('two slices of 5 and 2'));
});
