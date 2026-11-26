import { simulateRR } from '../algorithms/roundRobin.js';
import { simulatePriority } from '../algorithms/priority.js';
import { simulateFCFS } from '../algorithms/fcfs.js';
import { simulateSJF, simulateSRTF } from '../algorithms/sjf.js';

export const ALGORITHMS = [
  { key: 'fcfs', name: 'FCFS', run: (p) => simulateFCFS(p) },
  { key: 'sjf', name: 'SJF', run: (p) => simulateSJF(p) },
  { key: 'srtf', name: 'SRTF', run: (p) => simulateSRTF(p) },
  { key: 'rr', name: 'Round Robin', run: (p, q) => simulateRR(p, q) },
  { key: 'pr', name: 'Priority (preemptive)', run: (p) => simulatePriority(p) }
];

// Context switches and utilisation come from the engine result (one definition, in common.js).
export function summarise(result) {
  return {
    avgWt: result.avgWt, avgTat: result.avgTat, avgRt: result.avgRt,
    cpuUtilization: result.cpuUtilization,
    contextSwitches: result.contextSwitches
  };
}

export function compareAll(procs, quantum) {
  return ALGORITHMS.map(a => {
    const result = a.run(procs, quantum);
    return { key: a.key, name: a.name, result, ...summarise(result) };
  });
}

// Higher is better for these; everything else is better when smaller.
const HIGHER_IS_BETTER = new Set(['cpuUtilization']);

// Every row that ties for the best value of `key` (so a tie highlights all of them).
export function bestRows(rows, key) {
  const up = HIGHER_IS_BETTER.has(key);
  const top = rows.reduce((b, r) => (up ? r[key] > b : r[key] < b) ? r[key] : b, rows[0][key]);
  return rows.filter(r => r[key] === top);
}

// The first of the best rows.
export function best(rows, key) {
  return bestRows(rows, key)[0];
}
